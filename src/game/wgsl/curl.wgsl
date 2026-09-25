import { Grid, index_of, is_rim, VEL_RIM } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<storage, read> velocity: array<vec2f>;
@group(0) @binding(2) var<storage, read_write> curl: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
  if (is_rim(p, grid.vel_size, VEL_RIM)) {
    curl[i] = 0.0;
    return;
  }
  let left = velocity[index_of(p - vec2i(1, 0), grid.vel_size)].y;
  let right = velocity[index_of(p + vec2i(1, 0), grid.vel_size)].y;
  let top = velocity[index_of(p + vec2i(0, 1), grid.vel_size)].x;
  let bottom = velocity[index_of(p - vec2i(0, 1), grid.vel_size)].x;
  curl[i] = 0.5 * (right - left - top + bottom);
}
