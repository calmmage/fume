import { Grid, WorldInfo, Splat, index_of, splat_weight } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> splat: Splat;
@group(0) @binding(3) var<storage, read_write> dye: array<vec4f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.dye_size)) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(grid.dye_size);
  let pos = uv * world.size;
  let mag = splat_weight(pos, splat);
  let peak = mag * mag * mag;
  if (peak < 1e-6) { return; }
  let i = index_of(vec2i(id.xy), grid.dye_size);
  var c = dye[i];
  c = vec4f(min(c.rgb + splat.color.rgb * peak, vec3f(1.15)), c.a);
  dye[i] = c;
}
