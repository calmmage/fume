export struct Grid {
  vel_size: vec2u,
  dye_size: vec2u,
}

export struct WorldInfo {
  size: vec2f,
  dt: f32,
  time: f32,
}

export struct Sim {
  vorticity: f32,
  buoyancy: f32,
  weight: f32,
  vel_decay: f32,
  smoke_decay: f32,
  turb: f32,
  sharpen: f32,
  dye_inject: f32,
}

export struct Jet {
  pos: vec2f,
  force: f32,
  radius: f32,
  enabled: f32,
  held: f32,
  attached_xy: vec2f,
  attached_r: f32,
  attached: f32,
}

export struct Splat {
  center: vec2f,
  radius: f32,
  spin: f32,
  vel: vec2f,
  radial: f32,
  aspect: vec2f,
  angle: f32,
  color: vec4f,
}

export struct Gadgets {
  count: vec4f,
  pose: array<vec4f, 16>,
  body: array<vec4f, 16>,
  flow: array<vec4f, 16>,
}

export const VEL_LIMIT: f32 = 0.36;
export const VEL_RIM: i32 = 1;
export const DYE_RIM: i32 = 4;
export const KIND_CANDLE: f32 = 1.0;
export const KIND_SMOKE: f32 = 2.0;
export const KIND_FAN: f32 = 3.0;
export const KIND_BLOCK: f32 = 4.0;
export const KIND_VENT: f32 = 5.0;
export const KIND_VORTEX: f32 = 6.0;
export const KIND_FIRE: f32 = 7.0;

export fn index_of(p: vec2i, size: vec2u) -> u32 {
  let q = clamp(p, vec2i(0), vec2i(size) - 1);
  return u32(q.y) * size.x + u32(q.x);
}

export fn uv_inside(uv: vec2f) -> bool {
  return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0;
}

export fn is_rim(p: vec2i, size: vec2u, width: i32) -> bool {
  let w = max(width, 1);
  return p.x < w || p.y < w || p.x >= i32(size.x) - w || p.y >= i32(size.y) - w;
}

export fn cell_uv(p: vec2i, size: vec2u) -> vec2f {
  return (vec2f(p) + 0.5) / vec2f(size);
}

export fn world_to_uv(world: vec2f, size: vec2f) -> vec2f {
  return world / max(size, vec2f(1.0));
}

export fn rotate2(p: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(c * p.x + s * p.y, -s * p.x + c * p.y);
}

export fn sd_box(p: vec2f, b: vec2f) -> f32 {
  let d = abs(p) - b;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

export fn sd_ellipse(p: vec2f, r: vec2f) -> f32 {
  let ab = max(r, vec2f(0.8));
  let k = p / ab;
  return (length(k) - 1.0) * min(ab.x, ab.y);
}

export fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

export fn noise21(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

export fn fbm21(p0: vec2f) -> f32 {
  var p = p0;
  var v = 0.0;
  var a = 0.5;
  for (var i = 0; i < 4; i++) {
    v += a * noise21(p);
    p = p * 2.07 + 19.2;
    a *= 0.5;
  }
  return v;
}

export fn splat_weight(world: vec2f, s: Splat) -> f32 {
  let d = world - s.center;
  let c = cos(s.angle);
  let sn = sin(s.angle);
  let along = vec2f(c, sn);
  let perp = vec2f(-sn, c);
  var local = vec2f(dot(d, perp), dot(d, along));
  let r = max(s.radius, 1.0);
  local /= r;
  local.x /= max(s.aspect.x, 0.05);
  local.y /= max(s.aspect.y, 0.05);
  return exp(-dot(local, local));
}
