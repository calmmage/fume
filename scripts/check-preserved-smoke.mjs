import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// The user's accepted solver and accepted rays are separate reference points.
const baseline = '1864ab79da40eb18006e4fc4794fda805eaaef6c';
const original = (file) => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const read = (file) => readFileSync(file, 'utf8');
const files = ['fluid.ts', 'params.ts', 'scenes.ts', 'tools.ts'].map(f => `src/game/${f}`);
files.push(...readdirSync('src/game/wgsl').filter(f => f.endsWith('.wgsl') && f !== 'composite.wgsl').map(f => `src/game/wgsl/${f}`));
for (const file of files) assert.equal(read(file), original(file), `Protected simulation changed: ${file}`);

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
// Compare the entire simulation after ONLY those named, reviewed exceptions plus image pointer mapping.
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
console.log(`${files.length} complete simulation files plus sim.ts outside explicit tool/empty-start/image-pointer changes, smoke shading, game timing and approved ray functions preserved.`);
