// Read-only measurement of the same opacity used by smoke_volume. One workgroup
// covers a 16x16 circle; the CPU receives only one vec4, never the fluid field.
struct Probe {
  world: vec2f,
  dye_size: vec2u,
  area: vec4f, // xy/r in world units, visible-opacity threshold
}
@group(0) @binding(0) var<uniform> probe: Probe;
@group(0) @binding(1) var<storage, read> dye: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> result: array<vec4f>;
var<workgroup> totals: array<vec4f, 64>;

fn fetch_dye(p: vec2i) -> vec3f {
  let c = clamp(p, vec2i(0), vec2i(probe.dye_size) - vec2i(1));
  return dye[u32(c.y) * probe.dye_size.x + u32(c.x)].rgb;
}
fn sample_dye(uv: vec2f) -> vec3f {
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return vec3f(0.0); }
  let coord = uv * vec2f(probe.dye_size) - 0.5;
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  return mix(mix(fetch_dye(cell), fetch_dye(cell + vec2i(1, 0)), f.x),
             mix(fetch_dye(cell + vec2i(0, 1)), fetch_dye(cell + vec2i(1, 1)), f.x), f.y);
}
fn density(uv: vec2f) -> f32 {
  let c = sample_dye(uv);
  return max(c.r, max(c.g, c.b));
}
fn opacity(uv: vec2f) -> f32 {
  let d = density(uv);
  if (d < 0.022) { return 0.0; }
  let texel = 1.0 / vec2f(probe.dye_size);
  let blur = (density(uv + vec2f(texel.x, 0.0)) + density(uv - vec2f(texel.x, 0.0)) +
              density(uv + vec2f(0.0, texel.y)) + density(uv - vec2f(0.0, texel.y))) * 0.25;
  let d_vis = mix(d, blur, 0.72);
  return clamp((1.0 - exp(-d_vis * 1.15)) * smoothstep(0.022, 0.1, d), 0.0, 0.48);
}
@compute @workgroup_size(64)
fn main(@builtin(local_invocation_index) thread: u32) {
  var total = vec4f(0.0);
  for (var i = thread; i < 256u; i += 64u) {
    let local = (vec2f(f32(i % 16u), f32(i / 16u)) + 0.5) / 8.0 - 1.0;
    if (dot(local, local) <= 1.0) {
      let alpha = opacity((probe.area.xy + local * probe.area.z) / probe.world);
      total += vec4f(clamp(alpha / 0.1, 0.0, 1.0), select(0.0, 1.0, alpha >= probe.area.w), alpha, 1.0);
    }
  }
  totals[thread] = total;
  workgroupBarrier();
  for (var stride = 32u; stride > 0u; stride /= 2u) {
    if (thread < stride) { totals[thread] += totals[thread + stride]; }
    workgroupBarrier();
  }
  if (thread == 0u) {
    result[0] = vec4f(totals[0].xyz / max(totals[0].w, 1.0), totals[0].w);
  }
}
