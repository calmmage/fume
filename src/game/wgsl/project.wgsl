import { Grid, index_of, is_rim, VEL_RIM } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<storage, read> src: array<vec2f>;
@group(0) @binding(2) var<storage, read> pressure: array<f32>;
@group(0) @binding(3) var<storage, read> obst: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> dst: array<vec2f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
  let o = obst[i];
  if (o.x > 0.5) {
    dst[i] = o.yz;
    return;
  }
  if (is_rim(p, grid.vel_size, VEL_RIM)) {
    dst[i] = src[i];
    return;
  }
  let pc = pressure[i];
  var L = pressure[index_of(p - vec2i(1, 0), grid.vel_size)];
  var R = pressure[index_of(p + vec2i(1, 0), grid.vel_size)];
  var T = pressure[index_of(p + vec2i(0, 1), grid.vel_size)];
  var B = pressure[index_of(p - vec2i(0, 1), grid.vel_size)];
  if (obst[index_of(p - vec2i(1, 0), grid.vel_size)].x > 0.5) { L = pc; }
  if (obst[index_of(p + vec2i(1, 0), grid.vel_size)].x > 0.5) { R = pc; }
  if (obst[index_of(p + vec2i(0, 1), grid.vel_size)].x > 0.5) { T = pc; }
  if (obst[index_of(p - vec2i(0, 1), grid.vel_size)].x > 0.5) { B = pc; }
  var vel = src[i] - vec2f(R - L, T - B);
  dst[i] = vel;
}
