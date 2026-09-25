import { Grid, index_of, is_rim, VEL_RIM } from "./common.wgsl";

struct PressureParams {
  decay: f32,
}

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> params: PressureParams;
@group(0) @binding(2) var<storage, read> src: array<f32>;
@group(0) @binding(3) var<storage, read> divergence: array<f32>;
@group(0) @binding(4) var<storage, read> obst: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
  // Open domain on the rim only. Solids are Neumann (dp/dn = 0), not
  // Dirichlet-0 — that made blocks act like sinks and eat the smoke.
  if (is_rim(p, grid.vel_size, VEL_RIM)) {
    dst[i] = 0.0;
    return;
  }
  if (obst[i].x > 0.5) {
    dst[i] = src[i];
    return;
  }
  let pc = src[i] * params.decay;
  var L = src[index_of(p - vec2i(1, 0), grid.vel_size)];
  var R = src[index_of(p + vec2i(1, 0), grid.vel_size)];
  var T = src[index_of(p + vec2i(0, 1), grid.vel_size)];
  var B = src[index_of(p - vec2i(0, 1), grid.vel_size)];
  if (obst[index_of(p - vec2i(1, 0), grid.vel_size)].x > 0.5) { L = pc; }
  if (obst[index_of(p + vec2i(1, 0), grid.vel_size)].x > 0.5) { R = pc; }
  if (obst[index_of(p + vec2i(0, 1), grid.vel_size)].x > 0.5) { T = pc; }
  if (obst[index_of(p - vec2i(0, 1), grid.vel_size)].x > 0.5) { B = pc; }
  dst[i] = (L + R + B + T - divergence[i]) * 0.25;
}
