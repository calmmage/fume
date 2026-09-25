import {
  Grid, WorldInfo, Sim, Gadgets, VEL_LIMIT,
  KIND_CANDLE, KIND_SMOKE, KIND_FIRE,
  index_of, fbm21, uv_inside,
} from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> sim: Sim;
@group(0) @binding(3) var<uniform> gadgets: Gadgets;
@group(0) @binding(4) var<storage, read> src: array<vec2f>;
@group(0) @binding(5) var<storage, read> dye: array<vec4f>;
@group(0) @binding(6) var<storage, read> obst: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> dst: array<vec2f>;

fn dye_at_uv(uv: vec2f) -> f32 {
  if (!uv_inside(uv)) { return 0.0; }
  let coord = uv * vec2f(grid.dye_size) - 0.5;
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let i00 = index_of(cell, grid.dye_size);
  let i10 = index_of(cell + vec2i(1, 0), grid.dye_size);
  let i01 = index_of(cell + vec2i(0, 1), grid.dye_size);
  let i11 = index_of(cell + vec2i(1, 1), grid.dye_size);
  let a = dye[i00].rgb;
  let b = dye[i10].rgb;
  let c = dye[i01].rgb;
  let d = dye[i11].rgb;
  let col = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  return max(col.r, max(col.g, col.b));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
  var vel = src[i];
  let o = obst[i];
  if (o.x > 0.5) {
    dst[i] = o.yz;
    return;
  }
  if (o.w > 0.5) {
    dst[i] = o.yz;
    return;
  }
  let uv = (vec2f(p) + 0.5) / vec2f(grid.vel_size);
  let pos = uv * world.size;
  let d = dye_at_uv(uv);
  vel.y -= (sim.buoyancy - sim.weight) * d * world.dt * 0.01;
  let texel = 1.0 / vec2f(grid.dye_size);
  let dL = dye_at_uv(uv - vec2f(texel.x, 0.0));
  let dR = dye_at_uv(uv + vec2f(texel.x, 0.0));
  vel.x += (dL - dR) * sim.buoyancy * world.dt * 0.00012;

  if (o.w < 0.5 && d > 0.008) {
    vel.y -= (0.028 + 0.05 * (1.0 - uv.y)) * world.dt;
  }

  if (d > 0.02 && sim.turb > 0.5) {
    let wp = uv * world.size * 0.016 + vec2f(world.time * 1.5, -world.time * 1.1);
    let e = 0.18;
    let nL = fbm21(wp - vec2f(e, 0.0));
    let nR = fbm21(wp + vec2f(e, 0.0));
    let nB = fbm21(wp - vec2f(0.0, e));
    let nT = fbm21(wp + vec2f(0.0, e));
    var force = vec2f(nT - nB, nL - nR) / (2.0 * e);
    let wp2 = wp * 1.65 + 9.4;
    force += 0.35 * vec2f(
      fbm21(wp2 + vec2f(0.0, e)) - fbm21(wp2 - vec2f(0.0, e)),
      fbm21(wp2 - vec2f(e, 0.0)) - fbm21(wp2 + vec2f(e, 0.0)),
    ) / (2.0 * e);
    vel += force * (sim.turb * 0.00018) * min(d, 0.7) * world.dt;
  }

  // Candle / machine only — fan, vent and vortex are applied after the
  // pressure solve so the projection cannot cancel them into a global haze.
  for (var gi = 0; gi < 16; gi++) {
    if (gi >= i32(gadgets.count.x)) { break; }
    let pose = gadgets.pose[gi];
    let body = gadgets.body[gi];
    if (body.w < 0.5) { continue; }
    let kind = pose.z;
    let power = body.z;
    let dir = vec2f(cos(pose.w), sin(pose.w));

    if (abs(kind - KIND_CANDLE) < 0.5) {
      let tip = pose.xy + vec2f(0.0, -body.y * 0.55);
      let dd = pos - tip;
      let mag = exp(-(dd.x * dd.x) / 110.0 - (dd.y * dd.y) / 320.0);
      vel += vec2f(0.0, -1.0) * (0.07 * power * mag) * world.dt;
    } else if (abs(kind - KIND_SMOKE) < 0.5) {
      let nozzle = pose.xy + dir * (body.x * 0.55);
      let dd = pos - nozzle;
      let mag = exp(-dot(dd, dd) / 360.0);
      vel += dir * (0.085 * power * mag) * world.dt;
    } else if (abs(kind - KIND_FIRE) < 0.5) {
      let tip = pose.xy + vec2f(0.0, -body.y * 0.62);
      let dd = pos - tip;
      let mag = exp(-(dd.x * dd.x) / 180.0 - (dd.y * dd.y) / 380.0);
      vel += vec2f(0.0, -1.0) * (0.05 * power * mag) * world.dt;
    }
  }

  dst[i] = clamp(vel, vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
}
