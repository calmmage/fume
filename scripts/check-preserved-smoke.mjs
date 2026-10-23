import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The user's accepted solver and accepted rays are separate reference points.
const baseline = '1864ab79da40eb18006e4fc4794fda805eaaef6c';
const original = (file) => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const read = (file) => readFileSync(file, 'utf8');
const files = ['fluid.ts', 'params.ts', 'scenes.ts'].map(f => `src/game/${f}`);
// Protect every original simulation shader. New background-only shaders have no
// baseline counterpart; they cannot replace any of these protected files.
files.push(...execFileSync('git', ['ls-tree', '-r', '--name-only', baseline, 'src/game/wgsl'], { encoding: 'utf8' }).trim().split('\n').filter(f => f.endsWith('.wgsl') && !f.endsWith('/composite.wgsl')));
for (const file of files) assert.equal(read(file), original(file), `Protected simulation changed: ${file}`);
// The reported sideways Fire explicitly permits this single default-pose fix.
const firePose = 'case "fire":\n      return { w: 64, h: 34, angle: 0, power: 1.15 };';
const originalFirePose = 'case "fire":\n      return { w: 64, h: 34, angle: -Math.PI / 2, power: 1.15 };';
assert.ok(read('src/game/tools.ts').includes(firePose), 'Missing reviewed upright Fire default');
assert.equal(read('src/game/tools.ts').replace(firePose, originalFirePose), original('src/game/tools.ts'), 'Tool defaults outside the upright Fire pose changed');

function body(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `Missing ${marker}`);
  let end = source.indexOf('{', start) + 1;
  let depth = 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return source.slice(start, end);
}
const shaderPath = 'src/game/wgsl/composite.wgsl';
// The latest request explicitly changes initialization and held/placed tools.
// Compare the entire simulation after ONLY those named, reviewed exceptions plus view/pointer mapping.
// The former attract-mode bubble spawn is lifecycle, not physics integration.
function protectedSim(source) {
  for (const name of ['createWorld', 'seedDemo', 'setPlaceMode', 'setHeldToolActive', 'syncBoundGadget']) {
    const marker = `function ${name}(`;
    if (source.includes(marker)) {
      source = source.replace(body(source, marker), '').replace(/^export\s*$/gm, '');
    }
  }
  source = source.replace(/ {2}(placeMode|heldToolActive): boolean;\n/, '');
  const imageMapping = 'if (look.roomStyle !== "geometry")';
  if (source.includes(imageMapping)) source = source.replace(body(source, imageMapping), '');
  // The reported Geometry ceiling explicitly permits replacing only its view
  // mapping. Restore that exact call to the original mapping before comparing
  // the rest of sim.ts; solver and bubble behavior retain no new exceptions.
  source = source.replace('import { screenToScene } from "./scene-projection";\n', '');
  // Empty smoke-only rendering explicitly permits identity pointer mapping.
  source = source.replace('if (!look.room || look.roomStyle === "empty") return { x, y };', 'if (!look.room) return { x, y };');
  // The requested perceptible material-room pan permits only these exact
  // scoped delegates. Geometry/Cosmos pan and all simulation code still compare.
  source = source.replace('import { coastMaterialRoom, isMaterialRoom, panMaterialRoom } from "./material-room";\n', '');
  // The user's anchoring report also permits bounded Geometry camera movement;
  // these delegates affect only camera state, leaving all fluid stepping intact.
  source = source.replace('import { coastGeometryRoom, coastMaterialRoom, isMaterialRoom, panGeometryRoom, panMaterialRoom } from "./material-room";\n', '');
  source = source.replace(`  if (world.look.room && world.look.roomStyle === "geometry") {
    panGeometryRoom(world.look, world.w, world.h, dx, dy, dt);
    return;
  }\n`, '');
  source = source.replace(`  if (world.look.room && world.look.roomStyle === "geometry") {
    coastGeometryRoom(world.look, dt);
    return;
  }\n`, '');
  source = source.replace(`  if (isMaterialRoom(world.look)) {
    panMaterialRoom(world.look, world.w, world.h, dx, dy, dt);
    return;
  }\n`, '');
  source = source.replace(`  if (isMaterialRoom(world.look)) {
    coastMaterialRoom(world.look, dt);
    return;
  }\n`, '');
  source = source.replace('  return screenToScene(world.w, world.h, x, y, look.parallaxX, look.parallaxY);', `  const aspect = world.w / Math.max(1, world.h);
  const z0 = 0.7;
  const z1 = Math.max(look.roomDepth, z0 + 0.4);
  const zS = z0 + (z1 - z0) * Math.min(0.92, Math.max(0.08, look.sceneZ));
  const nx = (x / world.w - look.roomX) * aspect;
  const ny = y / world.h - look.roomY;
  const px = -look.parallaxX * 0.35 + nx * zS;
  const py = -look.parallaxY * 0.22 + ny * zS;
  return {
    x: (px / (look.roomW * 2) + 0.5) * world.w,
    y: (py / (look.roomH * 2) + 0.5) * world.h,
  };`);
  const demo = 'if (!world.playing && world.bubbles.length < 2 && Math.random() < 0.004)';
  if (source.includes(demo)) source = source.replace(body(source, demo), '');
  return source.replace(/\s+/g, ' ').trim();
}
assert.equal(protectedSim(read('src/game/sim.ts')), protectedSim(original('src/game/sim.ts')), 'Simulation outside requested tool/empty-start lifecycle changed');
const shader = read(shaderPath);
for (const name of ['sample_dye', 'dens', 'smoke_volume']) {
  assert.equal(body(shader, `fn ${name}(`), body(original(shaderPath), `fn ${name}(`), `Smoke presentation changed: ${name}`);
}
const gamePath = 'src/game/fume-game.ts';
assert.equal(body(read(gamePath), 'private frame ='), body(original(gamePath), 'private frame ='), 'Game timing changed');
for (const [name, expected] of Object.entries({
  window_mask: 'f02120fcc71123158b2c60eddf788044cfe570903941d52541acfd9bb7267656',
  volume_light: 'd34d0da357836ff48503d3c13908c56e1c9de5cac77d03c8e07da862da876901',
})) {
  const actual = createHash('sha256').update(body(shader, `fn ${name}(`)).digest('hex');
  assert.equal(actual, expected, `User-approved rays changed: ${name}`);
}
console.log(`${files.length} complete simulation files, tool defaults except the requested upright Fire pose, sim.ts outside explicit tool/empty-start/view-pointer changes, smoke shading, game timing and approved ray functions preserved.`);
