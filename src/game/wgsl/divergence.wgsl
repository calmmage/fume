import { Grid, index_of } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<storage, read> velocity: array<vec2f>;
@group(0) @binding(2) var<storage, read> obst: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> divergence: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
  if (obst[i].x > 0.5) {
    divergence[i] = 0.0;
    return;
  }
  var l = velocity[index_of(p - vec2i(1, 0), grid.vel_size)].x;
  var r = velocity[index_of(p + vec2i(1, 0), grid.vel_size)].x;
  var b = velocity[index_of(p - vec2i(0, 1), grid.vel_size)].y;
  var t = velocity[index_of(p + vec2i(0, 1), grid.vel_size)].y;
  let oL = obst[index_of(p - vec2i(1, 0), grid.vel_size)];
  let oR = obst[index_of(p + vec2i(1, 0), grid.vel_size)];
  let oT = obst[index_of(p + vec2i(0, 1), grid.vel_size)];
  let oB = obst[index_of(p - vec2i(0, 1), grid.vel_size)];
  if (oL.x > 0.5) { l = oL.y; }
  if (oR.x > 0.5) { r = oR.y; }
  if (oT.x > 0.5) { t = oT.z; }
  if (oB.x > 0.5) { b = oB.z; }
  let last = vec2i(grid.vel_size) - 1;
  if (p.x == 0) { l = 0.0; }
  if (p.x == last.x) { r = 0.0; }
  if (p.y == 0) { b = 0.0; }
  if (p.y == last.y) { t = 0.0; }
  divergence[i] = 0.5 * (r - l + t - b);
}
