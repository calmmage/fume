import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

// The user's accepted solver and accepted rays are separate reference points.
const baseline = '1864ab79da40eb18006e4fc4794fda805eaaef6c';
const original = (file) => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const read = (file) => readFileSync(file, 'utf8');
const files = ['fluid.ts', 'sim.ts', 'params.ts', 'scenes.ts', 'tools.ts'].map(f => `src/game/${f}`);
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
console.log(`${files.length} simulation files, smoke shading, game timing and approved ray functions preserved.`);
