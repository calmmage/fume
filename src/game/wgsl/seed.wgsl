import { Grid, WorldInfo, VEL_LIMIT, index_of } from "./common.wgsl";

struct Seed {
  center: vec2f,
  radius: f32,
  spin: f32,
  color: vec4f,
  density: f32,
  mode: f32,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> seed: Seed;
@group(0) @binding(3) var<storage, read_write> vel: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> dye: array<vec4f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let size = select(grid.vel_size, grid.dye_size, seed.mode > 0.5);
  if (any(id.xy >= size)) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
  let pos = uv * world.size;
  let d = pos - seed.center;
  let dist = length(d);
  let r = max(seed.radius, 1.0);
  let fill = smoothstep(r + 1.2, r * 0.86, dist);
  if (fill < 1e-4) { return; }

  if (seed.mode < 0.5) {
    let tang = vec2f(-d.y, d.x) / max(dist, 1.0);
    let addw = tang * seed.spin * fill * clamp(dist / r, 0.0, 1.0);
    let i = index_of(vec2i(id.xy), grid.vel_size);
    var v = vel[i] + addw / max(world.size, vec2f(1.0));
    vel[i] = clamp(v, vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
  } else {
    let i = index_of(vec2i(id.xy), grid.dye_size);
    var c = dye[i];
    c = vec4f(min(c.rgb + seed.color.rgb * seed.density * fill, vec3f(1.15)), c.a);
    dye[i] = c;
  }
}
