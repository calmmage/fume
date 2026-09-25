import {
  Grid, WorldInfo, Sim, Jet, Gadgets,
  KIND_CANDLE, KIND_SMOKE, KIND_VENT, KIND_FIRE,
  index_of, is_rim, uv_inside, DYE_RIM,
} from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> sim: Sim;
@group(0) @binding(3) var<uniform> jet: Jet;
@group(0) @binding(4) var<uniform> gadgets: Gadgets;
@group(0) @binding(5) var<storage, read> src: array<vec4f>;
@group(0) @binding(6) var<storage, read> velocity: array<vec2f>;
@group(0) @binding(7) var<storage, read> obst: array<vec4f>;
@group(0) @binding(8) var<storage, read_write> dst: array<vec4f>;

fn solid_uv(uv: vec2f) -> bool {
  if (!uv_inside(uv)) { return false; }
  let obst_uv = vec2i(clamp(uv * vec2f(grid.vel_size), vec2f(0), vec2f(grid.vel_size) - 1.0));
  return obst[index_of(obst_uv, grid.vel_size)].x > 0.5;
}

fn tap_dye(cell: vec2i, fallback: vec4f) -> vec4f {
  let uv = (vec2f(cell) + 0.5) / vec2f(grid.dye_size);
  if (solid_uv(uv)) { return fallback; }
  return src[index_of(cell, grid.dye_size)];
}

fn sample_dye(uv: vec2f, fallback: vec4f) -> vec4f {
  if (!uv_inside(uv)) { return vec4f(0.0); }
  if (solid_uv(uv)) { return fallback; }
  let coord = uv * vec2f(grid.dye_size) - 0.5;
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let a = tap_dye(cell, fallback);
  let b = tap_dye(cell + vec2i(1, 0), fallback);
  let c = tap_dye(cell + vec2i(0, 1), fallback);
  let d = tap_dye(cell + vec2i(1, 1), fallback);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn sample_vel(uv: vec2f) -> vec2f {
  if (!uv_inside(uv)) { return vec2f(0.0); }
  let coord = uv * vec2f(grid.vel_size) - 0.5;
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let a = velocity[index_of(cell, grid.vel_size)];
  let b = velocity[index_of(cell + vec2i(1, 0), grid.vel_size)];
  let c = velocity[index_of(cell + vec2i(0, 1), grid.vel_size)];
  let d = velocity[index_of(cell + vec2i(1, 1), grid.vel_size)];
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.dye_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.dye_size);
  if (is_rim(p, grid.dye_size, DYE_RIM)) {
    dst[i] = vec4f(0.0);
    return;
  }
  let uv = (vec2f(p) + 0.5) / vec2f(grid.dye_size);
  let obst_uv = vec2i(clamp(uv * vec2f(grid.vel_size), vec2f(0), vec2f(grid.vel_size) - 1.0));
  let o = obst[index_of(obst_uv, grid.vel_size)];
  if (o.x > 0.5) {
    dst[i] = vec4f(0.0);
    return;
  }
  var vel = sample_vel(uv);
  var back = uv - world.dt * vel;
  // Stop the backtrace on the solid. Sampling through the wall (or letting
  // dye step inside and get zeroed next frame) is what ate plumes.
  if (solid_uv(back)) {
    var lo = 0.0;
    var hi = 1.0;
    for (var s = 0; s < 6; s++) {
      let mid = (lo + hi) * 0.5;
      let q = mix(uv, back, mid);
      if (solid_uv(q)) { hi = mid; } else { lo = mid; }
    }
    back = mix(uv, back, lo);
  }
  let here = src[i];
  var color = sample_dye(back, here);
  let dens = max(color.r, max(color.g, color.b));
  let trapped = o.w;
  let haze = 1.0 - smoothstep(0.04, 0.28, dens);
  var rate = sim.smoke_decay * mix(1.35, 0.08, trapped);
  rate *= 0.45 + 1.35 * haze;
  color = vec4f(color.rgb * exp(-rate * world.dt), color.a);

  if (jet.enabled > 0.5) {
    let pos = uv * world.size;
    let amp = world.dt * 1.8 * sim.dye_inject;
    let axis = vec2f(0.0, -1.0);
    let perp = vec2f(1.0, 0.0);
    let d = pos - (jet.pos + vec2f(0.0, -28.0));
    var local = vec2f(dot(d, perp), dot(d, axis));
    local.x /= max(jet.radius * 0.22, 1.0);
    local.y /= max(jet.radius * 2.4, 1.0);
    let mag = exp(-dot(local, local));
    let peak = mag * mag * mag;
    color = vec4f(min(color.rgb + vec3f(0.7, 0.68, 0.64) * amp * peak, vec3f(1.15)), color.a);
    if (jet.attached > 0.5) {
      let ad = pos - (jet.attached_xy + vec2f(0.0, jet.attached_r * 0.4));
      let ar = max(4.0, jet.attached_r * 0.055);
      let magA = exp(-dot(ad, ad) / max(ar * ar, 1.0));
      color = vec4f(min(color.rgb + vec3f(0.58, 0.62, 0.68) * amp * 0.4 * magA * magA, vec3f(1.15)), color.a);
    }
  }

  let pos = uv * world.size;
  for (var gi = 0; gi < 16; gi++) {
    if (gi >= i32(gadgets.count.x)) { break; }
    let pose = gadgets.pose[gi];
    let body = gadgets.body[gi];
    if (body.w < 0.5) { continue; }
    let kind = pose.z;
    let dir = vec2f(cos(pose.w), sin(pose.w));
    let power = body.z;
    if (abs(kind - KIND_CANDLE) < 0.5) {
      let tip = pose.xy + vec2f(0.0, -body.y * 0.58);
      let dd = pos - tip;
      let mag = exp(-(dd.x * dd.x) / 70.0 - (dd.y * dd.y) / 260.0);
      let amp = world.dt * 11.0 * sim.dye_inject * power;
      color = vec4f(min(color.rgb + vec3f(0.74, 0.71, 0.66) * amp * mag, vec3f(1.15)), color.a);
    } else if (abs(kind - KIND_SMOKE) < 0.5) {
      let nozzle = pose.xy + dir * (body.x * 0.55);
      let dlt = pos - nozzle;
      let along = dot(dlt, dir);
      let across = dlt.x * dir.y - dlt.y * dir.x;
      let mag = exp(-(across * across) / 95.0 - (along * along) / 380.0) * smoothstep(-14.0, 6.0, along);
      let amp = world.dt * 14.0 * sim.dye_inject * power;
      color = vec4f(min(color.rgb + vec3f(0.64, 0.67, 0.72) * amp * mag, vec3f(1.15)), color.a);
    } else if (abs(kind - KIND_VENT) < 0.5) {
      // Dye-only drain. A velocity sink makes the pressure solve spray
      // pale haze across the whole room.
      let delta = pos - pose.xy;
      let dist = length(delta);
      let rad = max(min(body.x, body.y) * 0.48, 9.0);
      let mag = smoothstep(rad, rad * 0.22, dist);
      if (dist > 2.0 && mag > 0.02) {
        let away = delta / dist;
        let pull = (away / world.size) * (36.0 * power) * mag * world.dt;
        let pulled = sample_dye(uv + pull, color);
        color = vec4f(mix(color.rgb, pulled.rgb, mag * 0.8), color.a);
      }
      color = vec4f(color.rgb * exp(-mag * 10.0 * power * world.dt), color.a);
    } else if (abs(kind - KIND_FIRE) < 0.5) {
      let tip = pose.xy + vec2f(0.0, -body.y * 0.7);
      let dd = pos - tip;
      let mag = exp(-(dd.x * dd.x) / 160.0 - (dd.y * dd.y) / 420.0);
      let amp = world.dt * 9.0 * sim.dye_inject * power;
      color = vec4f(min(color.rgb + vec3f(0.72, 0.62, 0.52) * amp * mag, vec3f(1.15)), color.a);
    }
  }

  var outc = max(color.rgb, vec3f(0.0));
  let after = max(outc.r, max(outc.g, outc.b));
  if (trapped < 0.5 && after < 0.012) { outc = vec3f(0.0); }
  dst[i] = vec4f(outc, color.a);
}
