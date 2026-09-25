import { Grid, WorldInfo, Sim, VEL_LIMIT, index_of, is_rim, VEL_RIM } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> sim: Sim;
@group(0) @binding(3) var<storage, read> src: array<vec2f>;
@group(0) @binding(4) var<storage, read> curl: array<f32>;
@group(0) @binding(5) var<storage, read> obst: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> dst: array<vec2f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
  var vel = src[i];
  if (obst[i].x > 0.5) {
    dst[i] = obst[i].yz;
    return;
  }
  if (is_rim(p, grid.vel_size, VEL_RIM)) {
    dst[i] = vel;
    return;
  }
  let left = abs(curl[index_of(p - vec2i(1, 0), grid.vel_size)]);
  let right = abs(curl[index_of(p + vec2i(1, 0), grid.vel_size)]);
  let top = abs(curl[index_of(p + vec2i(0, 1), grid.vel_size)]);
  let bottom = abs(curl[index_of(p - vec2i(0, 1), grid.vel_size)]);
  let center = curl[i];
  var force = 0.5 * vec2f(top - bottom, right - left);
  force /= length(force) + 1e-4;
  force *= sim.vorticity * center * 0.14;
  force.y *= -1.0;
  vel += force * world.dt;
  dst[i] = clamp(vel, vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
}
