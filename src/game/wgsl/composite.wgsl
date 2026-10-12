import {
  index_of, hash21, uv_inside, rotate2, sd_box, sd_ellipse,
  Gadgets, KIND_CANDLE, KIND_SMOKE, KIND_FAN, KIND_BLOCK, KIND_VENT, KIND_VORTEX, KIND_FIRE,
} from "./common.wgsl";

struct Config {
  world: vec2f,
  time: f32,
  blowing: f32,
  wand: vec2f,
  shake: vec2f,
  dye_size: vec2u,
  n_balls: f32,
  n_particles: f32,
  iri: f32,
  refr: f32,
  gloss: f32,
  glass: f32,
  bands: f32,
  show_wand: f32,
  n_gadgets: f32,
  palette: f32,
  pixel: f32,
  depth: f32,
  rays: f32,
  parallax: vec2f,
  grain: f32,
  slices: f32,
  room_on: f32,
  room_depth: f32,
  room_cx: f32,
  room_cy: f32,
  room_hw: f32,
  room_hh: f32,
  scene_z: f32,
  room_style: f32,
  dust_on: f32,
  material_height: f32,
  visual_style: f32,
}

struct Balls {
  xy_r_thick: array<vec4f, 18>,
  modes0: array<vec4f, 18>,
  modes1: array<vec4f, 18>,
  pop_seed: array<vec4f, 18>,
  smoke: array<vec4f, 18>,
}

@group(0) @binding(0) var<uniform> config: Config;
@group(0) @binding(1) var<uniform> balls: Balls;
@group(0) @binding(2) var<uniform> gadgets: Gadgets;
@group(0) @binding(3) var<storage, read> dye: array<vec4f>;
@group(0) @binding(4) var<storage, read> lut: array<vec4f>;
@group(0) @binding(5) var<storage, read> particles: array<vec4f>;
@group(0) @binding(6) var environmentMap: texture_2d<f32>;
@group(0) @binding(7) var materialSampler: sampler;
@group(0) @binding(8) var wallMap: texture_2d<f32>;
@group(0) @binding(9) var floorMap: texture_2d<f32>;
@group(0) @binding(10) var windowMap: texture_2d<f32>;

fn sample_dye(uv: vec2f) -> vec3f {
  if (!uv_inside(uv)) { return vec3f(0.0); }
  let size = config.dye_size;
  let coord = uv * vec2f(size) - 0.5;
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let a = dye[index_of(cell, size)].rgb;
  let b = dye[index_of(cell + vec2i(1, 0), size)].rgb;
  let c = dye[index_of(cell + vec2i(0, 1), size)].rgb;
  let d = dye[index_of(cell + vec2i(1, 1), size)].rgb;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn dens(uv: vec2f) -> f32 {
  let c = sample_dye(uv);
  return max(c.r, max(c.g, c.b));
}

fn film_color(thick: f32) -> vec3f {
  let u = clamp(thick / 1400.0, 0.001, 0.999);
  let n = f32(arrayLength(&lut) - 1u);
  let x = u * n;
  let i = u32(floor(x));
  let f = fract(x);
  let a = lut[i].rgb;
  let b = lut[min(i + 1u, u32(n))].rgb;
  var col = mix(a, b, f);
  let luma = dot(col, vec3f(0.3, 0.5, 0.2));
  col = mix(vec3f(luma), col, 1.35 + 0.55 * config.iri);
  return col * (0.7 + 0.55 * config.iri);
}

fn smoke_volume(uv: vec2f) -> vec4f {
  let c = sample_dye(uv);
  let d = max(c.r, max(c.g, c.b));
  if (d < 0.022) { return vec4f(0.0); }
  let texel = 1.0 / vec2f(config.dye_size);
  let dL = dens(uv - vec2f(texel.x, 0.0));
  let dR = dens(uv + vec2f(texel.x, 0.0));
  let dB = dens(uv - vec2f(0.0, texel.y));
  let dT = dens(uv + vec2f(0.0, texel.y));
  let blur = (dL + dR + dT + dB) * 0.25;
  let dVis = mix(d, blur, 0.72);
  let n = normalize(vec3f(
    (dR - dL) * 0.45,
    (dT - dB) * 0.45,
    0.82,
  ));
  let Ldir = normalize(vec3f(-0.32, 0.78, 0.52));
  let ndotl = clamp(dot(n, Ldir) * 0.25 + 0.72, 0.0, 1.1);
  var t = uv;
  var shadow = 0.0;
  var stride = 1.4;
  let stepS = normalize(vec2f(-0.18, 0.9)) * texel;
  for (var i = 0; i < 4; i++) {
    t += stepS * stride;
    shadow += dens(t);
    stride *= 1.14;
  }
  let trans = exp(-shadow * 0.22);
  let od = dVis * 1.15;
  var alpha = 1.0 - exp(-od);
  alpha *= smoothstep(0.022, 0.1, d);
  alpha = clamp(alpha, 0.0, 0.48);
  let cool = vec3f(0.72, 0.74, 0.78);
  let warm = vec3f(0.88, 0.86, 0.82);
  var albedo = mix(cool, warm, clamp(trans * 0.3 + d * 0.15, 0.0, 1.0));
  albedo = mix(albedo, c, 0.06);
  var lit = albedo * (0.5 + 0.06 * ndotl + 0.32 * trans);
  return vec4f(lit * alpha, alpha);
}

fn bubble_at(world: vec2f, i: i32) -> vec4f {
  let br = balls.xy_r_thick[i];
  let center = br.xy;
  let radius = max(br.z, 1.0);
  let vp = (world - center) / radius;
  let nd = length(vp);
  if (nd > 1.04) { return vec4f(0.0); }

  let pop = balls.pop_seed[i];
  let fade = 1.0 - smoothstep(0.02, 0.72, pop.x);
  if (fade < 0.02) { return vec4f(0.0); }

  // This is only the film. The unchanged fluid field is composited separately.
  // Never replace the interior with an opaque, synthetic gray smoke disc.
  let aa = max(0.008, 1.4 / radius);
  let coverage = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, nd);
  let nz = sqrt(max(0.001, 1.0 - min(nd * nd, 1.0)));
  let normal = vec3f(vp, nz);
  let fresnel = 0.018 + 0.982 * pow(1.0 - nz, 5.0);
  let rim = exp(-pow((nd - 0.985) / max(0.012, aa * 1.3), 2.0));
  let thickness = max(80.0, br.w) * (0.78 + 0.24 * vp.y + 0.08 * sin(vp.x * 4.0 + pop.w));
  let film = film_color(thickness * (0.3 + 0.7 * nz));
  let reflected = reflect(vec3f(0.0, 0.0, -1.0), normal);
  let w = (reflected.xy - vec2f(-0.63, -0.32)) / vec2f(0.22, 0.52);
  let window = (1.0 - smoothstep(0.7, 1.0, abs(w.x))) * (1.0 - smoothstep(0.82, 1.0, abs(w.y)));
  let mullion = smoothstep(0.035, 0.075, abs(w.x)) * smoothstep(0.035, 0.075, abs(w.y));
  let highlight = window * mullion * min(config.gloss, 1.5);
  let opposite = exp(-pow((vp.x - 0.68) / 0.085, 2.0) - pow((vp.y - 0.55) / 0.23, 2.0));
  var rgb = mix(vec3f(0.76, 0.74, 0.69), film, clamp(config.iri * 0.34, 0.0, 0.65));
  rgb += vec3f(0.95, 0.89, 0.74) * highlight * 0.8;
  let alpha = min(0.82, fresnel * 0.27 + rim * 0.3 + highlight * 0.44 + opposite * 0.22) * coverage * fade;
  return vec4f(rgb * alpha, alpha);
}

fn sd_capsule(p: vec2f, a: vec2f, b: vec2f, r: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

fn sd_circle(p: vec2f, r: f32) -> f32 {
  return length(p) - r;
}

fn gadget_at(world: vec2f, i: i32) -> vec4f {
  let pose = gadgets.pose[i];
  let body = gadgets.body[i];
  let flow = gadgets.flow[i];
  let kind = pose.z;
  let ang = pose.w;
  let on = body.w;
  let ghost = select(1.0, 0.55, flow.z > 0.5 && on < 0.5);
  let upright = abs(kind - KIND_CANDLE) < 0.5 || abs(kind - KIND_VENT) < 0.5;
  var p = world - pose.xy;
  if (!upright) {
    p = rotate2(world - pose.xy, ang);
  }
  let hw = max(body.x, 4.0) * 0.5;
  let hh = max(body.y, 4.0) * 0.5;
  var col = vec3f(0.0);
  var alpha = 0.0;

  if (abs(kind - KIND_CANDLE) < 0.5) {
    let stem = sd_capsule(p, vec2f(0.0, 4.0), vec2f(0.0, hh * 0.92), 3.4);
    let shoulder = sd_box(p - vec2f(0.0, 3.0), vec2f(4.6, 2.2)) - 1.1;
    let wick = sd_capsule(p, vec2f(0.0, -2.0), vec2f(0.0, 6.0), 0.7);
    var flame = length((p - vec2f(0.0, -hh * 0.42)) / vec2f(0.38, 1.0)) - hh * 0.28;
    flame += 0.45 * sin(config.time * 13.0 + pose.x * 0.04);
    var rgb = vec3f(0.86, 0.8, 0.68);
    var a = max(1.0 - smoothstep(0.0, 1.5, stem), 1.0 - smoothstep(0.0, 1.4, shoulder));
    a = max(a, (1.0 - smoothstep(0.0, 0.9, wick)) * 0.75);
    let fa = 1.0 - smoothstep(0.0, 2.2, flame);
    let glow = exp(-dot(p - vec2f(0.0, -hh * 0.38), p - vec2f(0.0, -hh * 0.38)) / 140.0);
    rgb = mix(rgb, vec3f(0.98, 0.9, 0.72), fa);
    rgb += vec3f(0.7, 0.45, 0.18) * fa * (0.35 + 0.4 * on);
    alpha = max(a, fa * (0.62 + 0.35 * on));
    alpha = max(alpha, glow * 0.22 * on);
    col = rgb;
  } else if (abs(kind - KIND_SMOKE) < 0.5) {
    let box = sd_box(p - vec2f(-hw * 0.12, 0.0), vec2f(hw * 0.78, hh * 0.82)) - 2.4;
    let nozzle = sd_capsule(p, vec2f(hw * 0.25, 0.0), vec2f(hw * 1.12, 0.0), 3.6);
    var rgb = vec3f(0.46, 0.48, 0.52);
    rgb += vec3f(0.16, 0.14, 0.1) * (1.0 - smoothstep(-hh, hh, p.y));
    alpha = max(1.0 - smoothstep(0.0, 1.6, box), (1.0 - smoothstep(0.0, 1.5, nozzle)) * 0.92);
    col = rgb;
    if (on > 0.5) {
      let puffP = p - vec2f(hw * 1.35, 0.0);
      let puff = exp(-dot(puffP, puffP) / 110.0);
      col = mix(col, vec3f(0.74, 0.76, 0.78), puff * 0.4);
      alpha = max(alpha, puff * 0.2);
    }
  } else if (abs(kind - KIND_FAN) < 0.5) {
    // Side-view desk fan. Motor sits behind the cage; air leaves along +X.
    // No chevron ray — the body itself is the arrow.
    let cageC = vec2f(hw * 0.34, 0.0);
    let motor = sd_box(p - vec2f(-hw * 0.46, 0.0), vec2f(hw * 0.42, hh * 0.34)) - 2.0;
    let neck = sd_capsule(p, vec2f(-hw * 0.12, 0.0), cageC, 3.2);
    let cage = abs(sd_circle(p - cageC, hw * 0.62)) - 1.7;
    let hub = sd_circle(p - cageC, 3.6);
    var blades = 1e6;
    let spin = select(0.0, config.time * 14.0, on > 0.5);
    let pc = p - cageC;
    for (var k = 0; k < 3; k++) {
      let a = f32(k) * 2.094395 + spin;
      let q = rotate2(pc, a);
      blades = min(blades, sd_box(q - vec2f(hw * 0.28, 0.0), vec2f(hw * 0.26, 1.5)));
    }
    var rgb = vec3f(0.58, 0.6, 0.63);
    rgb += vec3f(0.08) * (1.0 - smoothstep(-hh, hh, p.y));
    alpha = 1.0 - smoothstep(0.0, 1.5, motor);
    alpha = max(alpha, (1.0 - smoothstep(0.0, 1.3, neck)) * 0.85);
    alpha = max(alpha, 1.0 - smoothstep(0.0, 1.4, cage));
    alpha = max(alpha, 1.0 - smoothstep(0.0, 1.2, hub));
    alpha = max(alpha, (1.0 - smoothstep(0.0, 1.15, blades)) * 0.78);
    col = rgb;
  } else if (abs(kind - KIND_BLOCK) < 0.5) {
    var box = sd_box(p, vec2f(hw, hh)) - 1.4;
    if (flow.w > 0.5) { box = sd_ellipse(p, vec2f(hw, hh)); }
    let edge = abs(box);
    var rgb = vec3f(0.4, 0.41, 0.45);
    rgb += vec3f(0.16) * smoothstep(7.0, 0.0, edge);
    alpha = 1.0 - smoothstep(0.0, 1.6, box);
    col = rgb;
  } else if (abs(kind - KIND_VENT) < 0.5) {
    let outer = abs(sd_circle(p, hw * 0.86)) - 2.2;
    var slats = 1e6;
    for (var k = 0; k < 4; k++) {
      let yy = -hh * 0.55 + f32(k) * hh * 0.36;
      slats = min(slats, sd_box(p - vec2f(0.0, yy), vec2f(hw * 0.72, 1.15)));
    }
    var rgb = vec3f(0.46, 0.47, 0.5);
    alpha = max(1.0 - smoothstep(0.0, 1.5, outer), (1.0 - smoothstep(0.0, 1.15, slats)) * 0.72);
    col = rgb;
    if (on > 0.5) {
      let mouth = smoothstep(hw * 0.34, hw * 0.08, length(p));
      col = mix(col, vec3f(0.16, 0.17, 0.18), mouth * 0.55);
    }
  } else if (abs(kind - KIND_FIRE) < 0.5) {
    // Keep the detailed fire work local to its footprint, even with many tools.
    if (abs(p.x) > hw * 1.4 || p.y < -hh * 2.2 || p.y > hh * 0.9) { return vec4f(0.0); }
    let phase = pose.x * 0.013 + pose.y * 0.027;
    let pulse = 0.86 + 0.09 * sin(config.time * 4.7 + phase) + 0.05 * sin(config.time * 8.3);
    let glowP = (p - vec2f(0.0, -hh * 0.35)) / vec2f(hw * 0.85, hh * 1.35);
    let glowA = exp(-dot(glowP, glowP) * 3.2) * 0.14 * on * pulse;
    var fire = vec4f(vec3f(0.85, 0.19, 0.025) * glowA, glowA);

    // Irregular coals sit below two crossed logs; their exposed centers breathe.
    let bed = sd_ellipse(p - vec2f(0.0, hh * 0.35), vec2f(hw * 0.83, hh * 0.23));
    let bedA = (1.0 - smoothstep(-0.5, 0.9, bed)) * 0.96;
    let cellSize = vec2f(max(hw * 0.19, 3.0), max(hh * 0.18, 2.5));
    let cell = floor(p / cellSize);
    let coalSeed = hash21(cell + phase);
    let coalP = fract(p / cellSize) - vec2f(0.42 + coalSeed * 0.16, 0.5);
    let hot = exp(-dot(coalP, coalP) * 14.0) * (0.65 + 0.35 * sin(config.time * 2.3 + coalSeed * 9.0)) * on;
    let coalCol = vec3f(0.055, 0.039, 0.029) + vec3f(0.9, 0.16, 0.015) * hot;
    fire = over(vec4f(coalCol * bedA, bedA), fire);
    for (var logIndex = 0; logIndex < 2; logIndex++) {
      let a = select(vec2f(-hw * 0.72, hh * 0.19), vec2f(-hw * 0.56, hh * 0.45), logIndex == 1);
      let b = select(vec2f(hw * 0.57, hh * 0.47), vec2f(hw * 0.73, hh * 0.16), logIndex == 1);
      let radius = max(hh * 0.14, 1.5);
      let axis = normalize(b - a);
      let along = dot(p - a, axis);
      let across = dot(p - a, vec2f(-axis.y, axis.x));
      let logA = 1.0 - smoothstep(-0.4, 0.9, sd_capsule(p, a, b, radius));
      let grain = 0.7 + 0.3 * sin(along * 1.6 + sin(across * 2.1));
      let rim = 1.0 - smoothstep(0.15, 1.15, abs(across + radius * 0.68));
      let crack = pow(max(0.0, sin(along * 0.83 + f32(logIndex) * 2.7)), 12.0);
      var logCol = vec3f(0.12, 0.071, 0.039) * grain * (0.65 + 0.35 * (1.0 - smoothstep(-radius, radius, across)));
      logCol += vec3f(0.76, 0.21, 0.026) * (rim * 0.65 + crack * 0.32) * on * pulse;
      fire = over(vec4f(logCol * logA, logA), fire);
    }

    // Five tapered tongues curl upward at different rates. Travelling ripples
    // carry detail from the roots to the tips, with warm edges and hot cores.
    for (var k = 0; k < 5; k++) {
      let id = f32(k);
      let seed = phase + id * 2.37;
      let central = 1.0 - abs(id - 2.0) * 0.22;
      let height = hh * (1.5 * central + 0.2 * sin(config.time * (3.1 + id * 0.31) + seed) + 0.12 * sin(config.time * 6.7 + seed * 1.3));
      let t = (hh * 0.2 - p.y) / max(height, 1.0);
      let rise = clamp(t, 0.0, 1.0);
      let root = (id - 2.0) * hw * 0.24;
      let sway = hw * rise * rise * (0.11 * sin(config.time * 3.8 + seed) + 0.075 * sin(rise * 9.0 - config.time * 5.5 + seed));
      let width = max(0.0, 1.0 - rise) * hw * (0.145 + central * 0.045) * (0.87 + 0.13 * sin(rise * 16.0 - config.time * 7.0 + seed));
      let distance = abs(p.x - root - sway);
      let vertical = smoothstep(-0.06, 0.05, t) * (1.0 - smoothstep(0.9, 1.02, t));
      let tongueA = (1.0 - smoothstep(max(0.0, width - 0.65), width + 0.65, distance)) * vertical * on * 0.88;
      let core = clamp(1.0 - distance / max(width, 0.1), 0.0, 1.0);
      let heat = core * (1.0 - smoothstep(0.18, 0.95, rise));
      var flameCol = mix(vec3f(0.98, 0.19, 0.018), vec3f(1.0, 0.68, 0.16), core);
      flameCol = mix(flameCol, vec3f(1.0, 0.95, 0.71), heat * heat * 0.88);
      fire = over(vec4f(flameCol * tongueA, tongueA), fire);
    }
    alpha = fire.a;
    col = fire.rgb / max(alpha, 0.0001);
  } else if (abs(kind - KIND_VORTEX) < 0.5) {
    let r = length(p);
    let th = atan2(p.y, p.x);
    let spinDir = select(1.0, -1.0, body.z < 0.0);
    let spin = config.time * 2.4 * spinDir * (0.4 + 0.6 * on);
    var arms = 1e6;
    for (var k = 0; k < 3; k++) {
      let ang = th - f32(k) * 2.094395 - spin - log(max(r, 1.0)) * 1.25;
      let wrapped = abs(atan2(sin(ang), cos(ang)));
      let width = 1.35 + r * 0.035;
      arms = min(arms, wrapped * max(r, 1.0) - width);
    }
    let eye = sd_circle(p, 2.8);
    var rgb = vec3f(0.78, 0.66, 0.46);
    rgb = mix(rgb, vec3f(0.55, 0.5, 0.42), smoothstep(4.0, hw, r));
    alpha = (1.0 - smoothstep(0.0, 1.25, arms)) * smoothstep(hw * 1.05, hw * 0.12, r);
    alpha = max(alpha, (1.0 - smoothstep(0.0, 1.3, eye)) * 0.95);
    col = rgb;
  }

  alpha *= ghost;
  alpha = clamp(alpha, 0.0, 0.96);
  return vec4f(col * alpha, alpha);
}

fn wand_at(world: vec2f) -> vec4f {
  let c = config.wand + vec2f(0.0, 10.0);
  let p = world - c;
  let loopC = vec2f(0.0, -22.0);
  let ring = abs(length(p - loopC) - 22.0) - 2.6;
  let handle = sd_capsule(p, vec2f(0.0, 4.0), vec2f(0.0, 52.0), 2.4);
  let d = min(ring, handle);
  var col = vec3f(0.78, 0.76, 0.7);
  col += exp(-abs(p.x) * 0.12) * 0.35;
  var alpha = 1.0 - smoothstep(0.0, 1.6, d);
  let inner = length(p - loopC);
  if (inner < 21.0) {
    let film = film_color(280.0 + 140.0 * config.blowing);
    let f = pow(smoothstep(12.0, 21.0, inner), 1.4);
    let fill = 0.16 + config.blowing * 0.35;
    col = mix(col, film, max(f, config.blowing * 0.45));
    alpha = max(alpha, mix(f * fill, 0.22 + f * 0.4, config.blowing));
  }
  return vec4f(col * alpha, alpha);
}

fn over(a: vec4f, b: vec4f) -> vec4f {
  return a + b * (1.0 - a.a);
}

fn accent_tint() -> vec3f {
  let id = i32(config.palette + 0.5);
  if (id == 1) { return vec3f(0.95, 0.48, 0.22); }
  if (id == 2) { return vec3f(0.4, 0.72, 0.9); }
  if (id == 3) { return vec3f(1.0, 0.42, 0.14); }
  if (id == 4) { return vec3f(0.72, 0.76, 0.74); }
  if (id == 5) { return vec3f(0.7, 0.42, 0.88); }
  return vec3f(0.86, 0.82, 0.72);
}

fn room_colors(uv: vec2f) -> vec3f {
  let id = i32(config.palette + 0.5);
  var top = vec3f(0.055, 0.058, 0.07);
  var bot = vec3f(0.035, 0.034, 0.038);
  var warm = vec3f(0.55, 0.5, 0.42);
  var cool = vec3f(0.25, 0.3, 0.38);
  if (id == 1) {
    top = vec3f(0.09, 0.04, 0.06);
    bot = vec3f(0.035, 0.02, 0.03);
    warm = vec3f(0.75, 0.32, 0.14);
    cool = vec3f(0.28, 0.16, 0.32);
  } else if (id == 2) {
    top = vec3f(0.04, 0.07, 0.16);
    bot = vec3f(0.015, 0.025, 0.06);
    warm = vec3f(0.25, 0.5, 0.7);
    cool = vec3f(0.12, 0.28, 0.5);
  } else if (id == 3) {
    top = vec3f(0.1, 0.04, 0.03);
    bot = vec3f(0.04, 0.015, 0.012);
    warm = vec3f(0.85, 0.32, 0.08);
    cool = vec3f(0.35, 0.12, 0.08);
  } else if (id == 4) {
    top = vec3f(0.16, 0.17, 0.18);
    bot = vec3f(0.08, 0.09, 0.1);
    warm = vec3f(0.55, 0.56, 0.54);
    cool = vec3f(0.35, 0.4, 0.42);
  } else if (id == 5) {
    top = vec3f(0.08, 0.04, 0.12);
    bot = vec3f(0.03, 0.015, 0.05);
    warm = vec3f(0.55, 0.28, 0.7);
    cool = vec3f(0.22, 0.14, 0.4);
  }
  var col = mix(bot, top, uv.y);
  var wuv = uv - vec2f(0.22, 0.22);
  wuv.x *= config.world.x / max(config.world.y, 1.0);
  col += warm * exp(-dot(wuv, wuv) * 7.5) * 0.32;
  var wuv2 = uv - vec2f(0.78, 0.38);
  wuv2.x *= config.world.x / max(config.world.y, 1.0);
  col += cool * exp(-dot(wuv2, wuv2) * 14.0) * 0.08;
  let vig = smoothstep(1.15, 0.25, distance(uv, vec2f(0.5, 0.55)));
  col *= 0.55 + 0.45 * vig;
  return col;
}

fn woods_cols(slot: i32) -> vec3f {
  // 0 ceiling, 1 glow, 2 far, 3 mid, 4 near, 5 ground, 6 grass
  let id = i32(config.palette + 0.5);
  if (id == 1) {
    if (slot == 0) { return vec3f(0.08, 0.03, 0.04); }
    if (slot == 1) { return vec3f(0.62, 0.28, 0.1); }
    if (slot == 2) { return vec3f(0.38, 0.16, 0.1); }
    if (slot == 3) { return vec3f(0.16, 0.07, 0.08); }
    if (slot == 4) { return vec3f(0.05, 0.02, 0.025); }
    if (slot == 5) { return vec3f(0.04, 0.015, 0.02); }
    return vec3f(0.18, 0.08, 0.04);
  }
  if (id == 2) {
    if (slot == 0) { return vec3f(0.05, 0.1, 0.22); }
    if (slot == 1) { return vec3f(0.18, 0.72, 0.86); }
    if (slot == 2) { return vec3f(0.1, 0.48, 0.78); }
    if (slot == 3) { return vec3f(0.07, 0.24, 0.52); }
    if (slot == 4) { return vec3f(0.03, 0.05, 0.12); }
    if (slot == 5) { return vec3f(0.035, 0.03, 0.09); }
    return vec3f(0.04, 0.07, 0.1);
  }
  if (id == 3) {
    if (slot == 0) { return vec3f(0.1, 0.03, 0.02); }
    if (slot == 1) { return vec3f(0.85, 0.32, 0.08); }
    if (slot == 2) { return vec3f(0.45, 0.16, 0.06); }
    if (slot == 3) { return vec3f(0.18, 0.06, 0.04); }
    if (slot == 4) { return vec3f(0.05, 0.02, 0.015); }
    if (slot == 5) { return vec3f(0.04, 0.015, 0.01); }
    return vec3f(0.22, 0.08, 0.03);
  }
  if (id == 4) {
    if (slot == 0) { return vec3f(0.22, 0.24, 0.26); }
    if (slot == 1) { return vec3f(0.72, 0.78, 0.76); }
    if (slot == 2) { return vec3f(0.48, 0.54, 0.56); }
    if (slot == 3) { return vec3f(0.28, 0.32, 0.34); }
    if (slot == 4) { return vec3f(0.1, 0.11, 0.12); }
    if (slot == 5) { return vec3f(0.08, 0.09, 0.1); }
    return vec3f(0.2, 0.24, 0.22);
  }
  if (id == 5) {
    if (slot == 0) { return vec3f(0.08, 0.03, 0.12); }
    if (slot == 1) { return vec3f(0.55, 0.28, 0.78); }
    if (slot == 2) { return vec3f(0.32, 0.16, 0.55); }
    if (slot == 3) { return vec3f(0.14, 0.07, 0.28); }
    if (slot == 4) { return vec3f(0.04, 0.02, 0.08); }
    if (slot == 5) { return vec3f(0.035, 0.015, 0.06); }
    return vec3f(0.16, 0.08, 0.18);
  }
  if (slot == 0) { return vec3f(0.04, 0.045, 0.05); }
  if (slot == 1) { return vec3f(0.22, 0.24, 0.26); }
  if (slot == 2) { return vec3f(0.14, 0.15, 0.17); }
  if (slot == 3) { return vec3f(0.08, 0.085, 0.09); }
  if (slot == 4) { return vec3f(0.02, 0.02, 0.025); }
  if (slot == 5) { return vec3f(0.015, 0.015, 0.018); }
  return vec3f(0.06, 0.065, 0.07);
}

fn cheap_tree(uv: vec2f, foot: vec2f, scale: vec2f) -> f32 {
  let q = vec2f((uv.x - foot.x) / max(scale.x, 0.001), (foot.y - uv.y) / max(scale.y, 0.001));
  if (q.y < -0.05 || q.y > 1.2 || abs(q.x) > 1.3) { return 0.0; }
  let trunk = (1.0 - smoothstep(0.08 * (0.45 + q.y), 0.14 * (0.45 + q.y), abs(q.x))) * (1.0 - smoothstep(0.62, 0.75, q.y));
  let crown = 1.0 - smoothstep(0.92, 1.02, length((q - vec2f(0.0, 0.68)) / vec2f(0.62, 0.26)));
  return max(trunk, crown);
}

fn woods_scene(uv: vec2f) -> vec3f {
  let par = config.parallax;
  let ceiling = woods_cols(0);
  let glow = woods_cols(1);
  let farC = woods_cols(2);
  let midC = woods_cols(3);
  let nearC = woods_cols(4);
  let groundC = woods_cols(5);
  let band = smoothstep(0.05, 0.22, uv.y) * (1.0 - smoothstep(0.5, 0.78, uv.y));
  var col = mix(ceiling, glow, clamp(band, 0.0, 1.0));
  let farS = par.x * 0.14;
  let midS = par.x * 0.4;
  let nearS = par.x * 0.82;
  for (var i = 0; i < 6; i++) {
    let h = hash21(vec2f(f32(i), 4.0));
    let x = fract((f32(i) + 0.3 * h) / 6.0 + farS * (0.8 + 0.4 * h));
    let cover = cheap_tree(uv, vec2f(x, 0.8), vec2f(0.1, 0.42) * (0.8 + 0.4 * h));
    col = mix(col, farC, cover);
  }
  for (var j = 0; j < 4; j++) {
    let h = hash21(vec2f(f32(j), 9.0));
    let x = fract((f32(j) + 0.4 * h) / 4.0 + midS);
    let cover = cheap_tree(uv, vec2f(x, 0.88 + par.y * 0.02), vec2f(0.18, 0.55));
    col = mix(col, midC, cover);
  }
  let hero = cheap_tree(uv, vec2f(fract(0.14 + nearS), 1.02 + par.y * 0.03), vec2f(0.42, 0.95));
  let side = cheap_tree(uv, vec2f(fract(0.78 + nearS), 0.98), vec2f(0.28, 0.72));
  col = mix(col, nearC, max(hero, side));
  let hill = 0.8 + par.y * 0.05 + 0.035 * sin((uv.x + par.x * 0.45) * 4.0);
  col = mix(col, groundC, smoothstep(hill - 0.004, hill + 0.01, uv.y));
  return col;
}

fn depth_color(uv: vec2f) -> vec3f {
  if (config.depth < 0.5 || config.depth > 2.5) { return vec3f(0.0); }
  let par = config.parallax;
  let ink = woods_cols(3);
  if (config.depth < 1.5) {
    var acc = vec3f(0.0);
    let bands = array<f32, 3>(0.28, 0.48, 0.7);
    let shifts = array<f32, 3>(0.12, 0.34, 0.72);
    for (var i = 0; i < 3; i++) {
      let y = uv.y + par.y * shifts[i];
      let x = uv.x + par.x * shifts[i];
      let band = smoothstep(bands[i] - 0.04, bands[i], y) * (1.0 - smoothstep(bands[i] + 0.08, bands[i] + 0.16, y));
      let hill = smoothstep(0.55, 0.0, abs(fract(x * (1.4 + f32(i)) + f32(i) * 0.2) - 0.5));
      acc += ink * band * (0.25 + 0.75 * hill) * (0.35 + 0.2 * f32(i));
    }
    return acc;
  }
  let p = uv - vec2f(0.5 + par.x * 0.35, 0.42 + par.y * 0.08);
  let z = 1.0 / max(0.12, 1.02 - uv.y);
  let x = p.x * z * 1.6;
  let vert = smoothstep(0.045, 0.0, abs(fract(x * 5.0) - 0.5));
  let horiz = smoothstep(0.04, 0.0, abs(fract((1.0 - uv.y) * z * 1.2) - 0.5));
  let floor = smoothstep(0.46, 0.62, uv.y);
  return ink * max(vert, horiz) * floor * 0.55;
}

fn light_rays(uv: vec2f) -> vec3f {
  if (config.rays < 0.5) { return vec3f(0.0); }
  let tint = accent_tint();
  if (config.rays < 1.5) {
    let ang = atan2(uv.y + 0.02, uv.x - 0.18);
    var beam = 0.0;
    for (var i = 0; i < 5; i++) {
      let a = 0.35 + f32(i) * 0.16;
      let d = ang - a;
      beam += exp(-d * d * 220.0);
    }
    let fall = smoothstep(1.15, 0.05, length(uv - vec2f(0.16, 0.0)));
    return tint * beam * fall * 0.07;
  }
  let sun = uv - vec2f(0.78, 0.14);
  let disc = exp(-dot(sun, sun) * 48.0);
  let ang = atan2(sun.y, sun.x);
  var beam = 0.0;
  for (var i = 0; i < 6; i++) {
    let a = f32(i) * 1.047;
    let d = abs(atan2(sin(ang - a), cos(ang - a)));
    beam += exp(-d * 10.0);
  }
  let fall = exp(-dot(sun, sun) * 1.8);
  return tint * (disc * 0.7 + beam * fall * 0.045);
}

fn ember_glow(world: vec2f) -> vec3f {
  if (config.depth < 2.5 && config.palette < 0.5) { return vec3f(0.0); }
  var glow = vec3f(0.0);
  let dusk = config.palette > 0.5 && config.palette < 1.5;
  let emberish = config.palette > 2.5 && config.palette < 3.5;
  let warm = select(vec3f(0.7, 0.4, 0.16), vec3f(0.95, 0.42, 0.14), dusk || emberish);
  for (var i = 0; i < 16; i++) {
    if (i >= i32(config.n_gadgets)) { break; }
    let pose = gadgets.pose[i];
    let body = gadgets.body[i];
    if (body.w < 0.5) { continue; }
    let fire = abs(pose.z - KIND_FIRE) < 0.5;
    let candle = abs(pose.z - KIND_CANDLE) < 0.5;
    if (!fire && !candle) { continue; }
    let d = world - pose.xy;
    let hot = exp(-dot(d, d) / select(1800.0, 5200.0, fire));
    glow += warm * hot * select(0.12, 0.28, fire);
  }
  return glow;
}

fn hall_tint() -> vec3f {
  let id = i32(config.palette + 0.5);
  if (id == 1) { return vec3f(1.15, 0.78, 0.62); }
  if (id == 2) { return vec3f(0.72, 0.84, 1.05); }
  if (id == 3) { return vec3f(1.2, 0.78, 0.55); }
  if (id == 4) { return vec3f(0.9, 0.92, 0.9); }
  if (id == 5) { return vec3f(1.0, 0.82, 1.05); }
  return vec3f(0.96, 0.97, 0.98);
}

fn nearer(best: vec2f, t: f32, face: f32, ro: vec3f, rd: vec3f, hw: f32, hh: f32, z0: f32, z1: f32) -> vec2f {
  if (t < 0.05 || t >= best.x) { return best; }
  let p = ro + rd * t;
  if (p.z < z0 || p.z > z1 + 0.02) { return best; }
  if (face < 2.5) {
    if (abs(p.y) > hh) { return best; }
  } else if (face < 4.5) {
    if (abs(p.x) > hw) { return best; }
  } else if (abs(p.x) > hw || abs(p.y) > hh) {
    return best;
  }
  return vec2f(t, face);
}

fn dust_motes(ro: vec3f, rd: vec3f, t1: f32) -> vec3f {
  if (config.dust_on < 0.5) { return vec3f(0.0); }
  var glow = vec3f(0.0);
  // Fixed points on four world-depth slices. Camera movement is the only
  // motion: no time offset, no regenerating identities and no volumetric blobs.
  for (var i = 0; i < 4; i++) {
    let t = 0.9 + f32(i) * 0.87;
    if (t > t1) { break; }
    let p = (ro + rd * t).xy;
    let spacing = 0.24;
    let cell = floor(p / spacing);
    let seed = cell + vec2f(f32(i) * 23.7, f32(i) * 11.3);
    let h = hash21(seed);
    let jitter = vec2f(hash21(seed + 3.4), hash21(seed + 9.1));
    let center = (cell + 0.18 + jitter * 0.64) * spacing;
    let pixel = t / max(config.world.y, 1.0);
    let radius = mix(1.1, 0.6, f32(i) / 3.0);
    let d = length(p - center) / pixel;
    let core = 1.0 - smoothstep(radius * 0.5, radius + 0.55, d);
    let visible = select(0.0, 1.0, h > 0.63);
    glow += select(vec3f(0.78, 0.76, 0.69), vec3f(0.78), config.visual_style < 0.5) * core * visible * (0.2 + h * 0.16);
  }
  return glow;
}

fn window_mask(p: vec3f) -> f32 {
  let direction = vec3f(0.86, 0.48, 0.22);
  let distance = max(0.0, (p.x + config.room_hw) / direction.x);
  let entry = p - direction * distance;
  let y = entry.y;
  let z = entry.z;
  let opening = smoothstep(-0.58, -0.49, y) * (1.0 - smoothstep(0.02, 0.12, y))
    * smoothstep(0.7, 0.86, z) * (1.0 - smoothstep(2.1, 2.35, z));
  let bars = (0.6 + 0.4 * smoothstep(0.025, 0.085, abs(y + 0.24)))
    * (0.6 + 0.4 * smoothstep(0.025, 0.085, abs(z - 1.5)));
  return opening * bars;
}

fn volume_light(ro: vec3f, rd: vec3f, t1: f32) -> vec3f {
  if (config.rays < 0.5 || config.room_style > 1.5) { return vec3f(0.0); }
  var acc = vec3f(0.0);
  let tint = vec3f(0.92, 0.87, 0.74) * hall_tint();
  let extent = min(t1, 5.0);
  for (var i = 0; i < 6; i++) {
    let t = (f32(i) + 0.5) * extent / 6.0;
    let p = ro + rd * t;
    acc += tint * window_mask(p) * extent * 0.003;
  }
  return acc;
}

// Neighbor rays intersect the SAME wall plane to supply explicit UV gradients.
// No derivative intrinsic runs inside a per-pixel wall/ceiling branch.
fn material_plane_point(ro: vec3f, rd: vec3f, plane: vec3f, normal: vec3f) -> vec3f {
  let denominator = dot(rd, normal);
  let safe = select(-1.0, 1.0, denominator >= 0.0) * max(abs(denominator), 1e-5);
  return ro + rd * (dot(plane - ro, normal) / safe);
}

fn material_face_uv(p: vec3f, face: f32, hw: f32, hh: f32, depth: f32) -> vec2f {
  if (face < 2.5) { return vec2f(p.z / depth, p.y / (hh * 2.0) + 0.5); }
  if (face < 4.5) { return vec2f(p.x / (hw * 2.0) + 0.5, p.z / depth); }
  return p.xy / vec2f(hw * 2.0, hh * 2.0) + 0.5;
}

fn material_back_uv(uv: vec2f, hw: f32, hh: f32) -> vec2f {
  // The authored plate appears once. Its baked left window is replaced by the
  // actual side-wall opening, and cover preserves the fine grain/pixel aspect.
  let size = vec2f(textureDimensions(environmentMap));
  let imageAspect = size.x * 0.88 / max(size.y, 1.0);
  let faceAspect = hw / hh;
  let cover = vec2f(min(1.0, faceAspect / imageAspect), min(1.0, imageAspect / faceAspect));
  return vec2f(0.12, 0.0) + ((uv - 0.5) * cover + 0.5) * vec2f(0.88, 1.0);
}

fn material_wall_uv(p: vec3f, uv: vec2f) -> vec2f {
  if (config.visual_style < 1.5) {
    // Fine dark paneling, never the obsolete brick/star/parquet atlas.
    return vec2f(0.36, 0.04) + uv * vec2f(0.62, 0.92);
  }
  let period = select(vec2f(3.0), vec2f(2.2, 1.2), config.visual_style > 3.5);
  return vec2f(p.z, p.y) / period + vec2f(0.0, 0.5);
}

fn material_floor_uv(p: vec3f, uv: vec2f) -> vec2f {
  if (config.visual_style < 1.5) { return vec2f(0.45, 0.14) + uv * vec2f(0.38, 0.45); }
  let period = select(vec2f(3.0), vec2f(2.2, 1.2), config.visual_style > 3.5);
  return p.xz / period;
}

fn material_window_uv(p: vec3f) -> vec2f {
  let windowOffset = max(0.0, config.room_depth - 2.5);
  let uv = vec2f((p.z - windowOffset - 0.7) / 1.65, (p.y + 0.58) / 0.7);
  if (config.visual_style < 1.5) { return vec2f(0.004, 0.004) + uv * vec2f(0.032, 0.64); }
  return uv;
}

fn material_sample(map: texture_2d<f32>, uv: vec2f, dx: vec2f, dy: vec2f) -> vec3f {
  if (config.visual_style < 1.5) {
    let size = vec2f(textureDimensions(map));
    let footprint = max(length(dx * size), length(dy * size));
    let level = u32(clamp(floor(log2(max(footprint, 1.0))), 0.0, f32(textureNumLevels(map) - 1u)));
    let mipSize = textureDimensions(map, level);
    let at = vec2i(clamp(uv, vec2f(0.0), vec2f(0.99999)) * vec2f(mipSize));
    return textureLoad(map, at, i32(level)).rgb;
  }
  return textureSampleGrad(map, materialSampler, uv, dx, dy).rgb;
}

fn material_room(uv: vec2f) -> vec3f {
  let aspect = config.world.x / max(config.world.y, 1.0);
  let pan = clamp(config.parallax, vec2f(-0.24), vec2f(0.24));
  let hw = 1.5 * aspect * (config.room_hw / 0.9);
  let hh = 1.45 * (config.room_hh / 0.62);
  let depth = max(1.6, config.room_depth);
  let windowOffset = max(0.0, depth - 2.5);
  let ro = vec3f(-pan.x * aspect * 5.0 * 0.45, -pan.y * 5.0 * 0.45, 0.0);
  let rd = vec3f((uv.x - config.room_cx) * aspect, uv.y - (config.room_cy - 0.06), 1.0);
  var best = vec2f(depth, 5.0);
  if (abs(rd.x) > 1e-5) {
    best = nearer(best, (-hw - ro.x) / rd.x, 1.0, ro, rd, hw, hh, 0.0, depth);
    best = nearer(best, (hw - ro.x) / rd.x, 2.0, ro, rd, hw, hh, 0.0, depth);
  }
  if (abs(rd.y) > 1e-5) {
    best = nearer(best, (hh - ro.y) / rd.y, 3.0, ro, rd, hw, hh, 0.0, depth);
    best = nearer(best, (-hh - ro.y) / rd.y, 4.0, ro, rd, hw, hh, 0.0, depth);
  }
  let p = ro + rd * best.x;
  var normal = vec3f(0.0, 0.0, -1.0);
  if (best.y < 1.5) { normal = vec3f(1.0, 0.0, 0.0); }
  else if (best.y < 2.5) { normal = vec3f(-1.0, 0.0, 0.0); }
  else if (best.y < 3.5) { normal = vec3f(0.0, -1.0, 0.0); }
  else if (best.y < 4.5) { normal = vec3f(0.0, 1.0, 0.0); }
  let pixelStep = 1.0 / max(config.material_height, 1.0);
  let px = material_plane_point(ro, rd + vec3f(pixelStep, 0.0, 0.0), p, normal);
  let py = material_plane_point(ro, rd + vec3f(0.0, pixelStep, 0.0), p, normal);
  let at = material_face_uv(p, best.y, hw, hh, depth);
  let ax = material_face_uv(px, best.y, hw, hh, depth);
  let ay = material_face_uv(py, best.y, hw, hh, depth);
  let toLight = vec3f(-hw + 0.05, -0.24, 1.5 + windowOffset) - p;
  let diffuse = max(0.0, dot(normal, normalize(toLight)));
  let illumination = 0.12 + 0.42 * diffuse / (1.0 + length(toLight) * 0.18);
  var col = vec3f(0.0);
  if (best.y < 2.5) {
    let wallUV = material_wall_uv(p, at);
    let wall = material_sample(wallMap, wallUV, material_wall_uv(px, ax) - wallUV, material_wall_uv(py, ay) - wallUV);
    col = wall * illumination;
    if (config.visual_style > 1.5) {
      let joint = min(fract(p.z / 1.3), 1.0 - fract(p.z / 1.3));
      col *= 0.7 + 0.3 * smoothstep(0.004, 0.015, joint);
    }
  } else if (best.y < 4.5) {
    let floorUV = material_floor_uv(p, at);
    let floor = material_sample(floorMap, floorUV, material_floor_uv(px, ax) - floorUV, material_floor_uv(py, ay) - floorUV);
    col = floor * illumination * select(0.72, 0.9, best.y < 3.5);
  } else {
    let backUV = material_back_uv(at, hw, hh);
    col = material_sample(environmentMap, backUV, material_back_uv(ax, hw, hh) - backUV, material_back_uv(ay, hw, hh) - backUV);
  }
  // Darken only the contact edges, keeping the authored back-wall lighting.
  var edge = min(hw - abs(p.x), hh - abs(p.y));
  if (best.y < 2.5) { edge = min(depth - p.z, hh - abs(p.y)); }
  else if (best.y < 4.5) { edge = min(depth - p.z, hw - abs(p.x)); }
  col *= 0.68 + 0.32 * smoothstep(0.0, 0.10, edge);
  if (best.y < 1.5) {
    let windowZ = p.z - windowOffset;
    let opening = step(-0.58, p.y) * step(p.y, 0.12) * step(0.7, windowZ) * step(windowZ, 2.35);
    let panes = smoothstep(0.016, 0.028, abs(p.y + 0.24)) * smoothstep(0.016, 0.028, abs(windowZ - 1.5));
    if (opening * panes > 0.0) {
      let glassUV = material_window_uv(p);
      let glass = material_sample(windowMap, glassUV, material_window_uv(px) - glassUV, material_window_uv(py) - glassUV);
      col = mix(col, glass * 0.88 + vec3f(0.10, 0.085, 0.06), opening * panes);
    }
  }
  col += dust_motes(ro, rd, best.x);
  // Keep the accepted ray functions unchanged; translate their left wall to
  // the wider material room in the caller's coordinates.
  col += volume_light(ro + vec3f(hw - config.room_hw, 0.0, -windowOffset), rd, best.x);
  return col;
}

struct RoomView {
  color: vec3f,
  scene_uv: vec2f,
  inside: f32,
}

fn march_room(uv: vec2f) -> RoomView {
  let aspect = config.world.x / max(config.world.y, 1.0);
  let look = config.parallax;
  let ro = vec3f(-look.x * 0.35, -look.y * 0.22, 0.0);
  let rd = vec3f((uv.x - config.room_cx) * aspect, uv.y - config.room_cy, 1.0);
  let hw = max(config.room_hw, 0.15);
  let hh = max(config.room_hh, 0.12);
  let z0 = 0.7;
  let z1 = max(config.room_depth, z0 + 0.4);
  if (config.visual_style > 0.5) {
    // Matches screenToWorld. Shared overscan keeps the visible corners inside
    // the fluid domain throughout the full bounded pan range.
    let offset = vec2f(tanh(look.x) * 0.11, tanh(look.y * 2.0) * 0.08);
    if (config.visual_style > 1.5 && config.visual_style < 2.5) {
      // Cosmos is already projected from a 3D star volume at surface resolution.
      // The live fluid plane keeps the existing pointer/bubble mapping.
      let col = textureSampleLevel(environmentMap, materialSampler, uv, 0.0).rgb;
      return RoomView(col, (uv - offset - 0.5) / 1.28 + 0.5, 1.0);
    }
    let col = material_room(uv);
    return RoomView(col, (uv - offset - 0.5) / 1.28 + 0.5, 1.0);
  }
  var best = vec2f(1e5, 0.0);
  if (abs(rd.x) > 1e-4) {
    best = nearer(best, (-hw - ro.x) / rd.x, 1.0, ro, rd, hw, hh, z0, z1);
    best = nearer(best, (hw - ro.x) / rd.x, 2.0, ro, rd, hw, hh, z0, z1);
  }
  if (abs(rd.y) > 1e-4) {
    best = nearer(best, (hh - ro.y) / rd.y, 3.0, ro, rd, hw, hh, z0, z1);
    best = nearer(best, (-hh - ro.y) / rd.y, 4.0, ro, rd, hw, hh, z0, z1);
  }
  best = nearer(best, (z1 - ro.z) / rd.z, 5.0, ro, rd, hw, hh, z0, z1);

  // The furnished backdrop does not bound the live fluid. The old room-box
  // intersection cut a rectangular ceiling through smoke and bubbles. Keep
  // every visible pixel inside the field, matching screenToScene for pointers.
  let offset = vec2f(tanh(look.x) * 0.11, tanh(look.y * 2.0) * 0.08);
  let scene_uv = (uv - offset - 0.5) / 1.28 + 0.5;

  var col = textureSampleLevel(environmentMap, materialSampler, uv, 0.0).rgb;

  let tDust = select(0.0, best.x, best.x < 1e4);
  col += dust_motes(ro, rd, tDust);
  col += volume_light(ro, rd, tDust);
  return RoomView(col, scene_uv, 1.0);
}

@fragment
fn fs_main(@location(0) uv_in: vec2f) -> @location(0) vec4f {
  let uv = uv_in;
  var scene_uv = uv;
  var show_scene = 1.0;
  var col = vec3f(0.0);
  if (config.room_on > 0.5) {
    let room = march_room(uv);
    col = room.color;
    scene_uv = room.scene_uv;
    show_scene = room.inside;
  } else {
    col = room_colors(uv);
    if (config.depth > 2.5) {
      col = woods_scene(uv);
    } else if (config.depth > 0.5) {
      col += depth_color(uv);
    }
  }
  if (config.grain > 0.5 && config.room_on < 0.5) {
    col += (hash21(uv * config.world) - 0.5) * 0.003;
  }
  let world = scene_uv * config.world + config.shake;
  let screen = uv * config.world + config.shake;
  col += ember_glow(world);
  if (config.rays > 0.5 && config.room_on < 0.5) {
    col += light_rays(uv);
  }
  let smoke = select(vec4f(0.0), smoke_volume(scene_uv), show_scene > 0.5);

  var giz = vec4f(0.0);
  if (show_scene > 0.5) {
    for (var i = 0; i < 16; i++) {
      if (i >= i32(config.n_gadgets)) { break; }
      giz = over(gadget_at(world, i), giz);
    }
  }
  var acc = vec4f(0.0);
  if (show_scene > 0.5) {
    for (var i = 0; i < 18; i++) {
      if (i >= i32(config.n_balls)) { break; }
      acc = over(bubble_at(world, i), acc);
    }
  }
  var wand = vec4f(0.0);
  if (config.show_wand > 0.5) { wand = wand_at(screen); }

  col = col * (1.0 - smoke.a) + smoke.rgb;
  col = col * (1.0 - giz.a) + giz.rgb;
  col = col * (1.0 - acc.a) + acc.rgb;
  col = col * (1.0 - wand.a) + wand.rgb;

  let nP = i32(min(config.n_particles, 48.0));
  for (var j = 0; j < 48; j++) {
    if (j >= nP || show_scene < 0.5) { break; }
    let p = particles[j * 2];
    let c = particles[j * 2 + 1];
    let d = world - p.xy;
    let r = max(p.z, 0.5);
    let dist2 = dot(d, d);
    if (dist2 > r * r) { continue; }
    let t = sqrt(dist2) / r;
    let a = p.w * smoothstep(1.0, 0.35, t);
    col = col * (1.0 - a) + c.rgb * a;
  }

  return vec4f(col, 1.0);
}
