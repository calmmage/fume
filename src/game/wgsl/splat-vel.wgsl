import { Grid, WorldInfo, Splat, VEL_LIMIT, index_of, splat_weight } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> splat: Splat;
@group(0) @binding(3) var<storage, read_write> vel: array<vec2f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(grid.vel_size);
  let pos = uv * world.size;
  let mag = splat_weight(pos, splat);
  if (mag < 1e-5) { return; }
  let i = index_of(vec2i(id.xy), grid.vel_size);
  var addw = splat.vel;
  let d = pos - splat.center;
  let len = length(d);
  if (splat.radial != 0.0 && len > 0.4) {
    addw += (d / len) * splat.radial;
  }
  if (splat.spin != 0.0 && len > 0.4) {
    addw += vec2f(-d.y, d.x) / len * splat.spin;
  }
  var v = vel[i] + (addw / max(world.size, vec2f(1.0))) * mag;
  v = clamp(v, vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
  vel[i] = v;
}
