struct CosmosView {
  size: vec2f,
  camera: vec2f,
  density: f32,
}
struct Star {
  point: vec4f,
  color: vec4f,
}
@group(0) @binding(0) var<uniform> view: CosmosView;
@group(0) @binding(1) var<storage, read> stars: array<Star>;

struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec3f,
  @location(2) kind: f32,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> Vertex {
  let corners = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
  let star = stars[instance];
  let local = corners[vertex];
  let z = star.point.z;
  let aspect = view.size.x / max(view.size.y, 1.0);
  // The repeating volume continues beyond the viewport as the camera travels.
  // Each star has its own depth and identity; near stars move farther and faster.
  let span = z * 5.8;
  let x = star.point.x - view.camera.x;
  let wrapped = x - floor((x + span * 0.5) / span) * span;
  let center = vec2f(wrapped / (z * aspect), -(star.point.y - view.camera.y) / z) * 1.45;
  let near = clamp(25.0 / z, 0.8, 3.6);
  let radius = max(0.42, star.point.w * near);
  let extent = radius * select(5.0, 2.4, star.color.w > 0.5) * view.density;
  var out: Vertex;
  out.position = vec4f(center + local * extent * 2.0 / view.size, 0.0, 1.0);
  out.local = local;
  out.color = star.color.rgb;
  out.kind = star.color.w;
  return out;
}

@fragment
fn fs_main(v: Vertex) -> @location(0) vec4f {
  let r2 = dot(v.local, v.local);
  if (v.kind > 0.5) {
    return vec4f(v.color * exp(-r2 * 3.5), 1.0);
  }
  let core = exp(-r2 * 52.0);
  let halo = exp(-r2 * 7.5) * 0.075;
  let axis = min(abs(v.local.x), abs(v.local.y));
  let spike = exp(-axis * 95.0) * exp(-r2 * 6.0) * 0.075;
  return vec4f(v.color * (core + halo + spike), 1.0);
}
