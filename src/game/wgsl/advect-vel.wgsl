import {
  Grid, WorldInfo, Sim, Jet, Gadgets, VEL_LIMIT,
  KIND_FAN, KIND_VORTEX,
  index_of, uv_inside,
} from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> sim: Sim;
@group(0) @binding(3) var<uniform> jet: Jet;
@group(0) @binding(4) var<uniform> gadgets: Gadgets;
@group(0) @binding(5) var<storage, read> src: array<vec2f>;
@group(0) @binding(6) var<storage, read> obst: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> dst: array<vec2f>;

fn sample_vel(uv: vec2f) -> vec2f {
  if (!uv_inside(uv)) { return vec2f(0.0); }
  let coord = uv * vec2f(grid.vel_size) - 0.5;
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let a = src[index_of(cell, grid.vel_size)];
  let b = src[index_of(cell + vec2i(1, 0), grid.vel_size)];
  let c = src[index_of(cell + vec2i(0, 1), grid.vel_size)];
  let d = src[index_of(cell + vec2i(1, 1), grid.vel_size)];
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.vel_size);
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
  let vel0 = src[i];
  let mid = uv - 0.5 * world.dt * vel0;
  let v1 = sample_vel(mid);
  let coord = uv - world.dt * v1;
  var vel = sample_vel(coord);
  let decay = 1.0 + sim.vel_decay * world.dt;
  vel /= decay;

  if (jet.enabled > 0.5) {
    let pos = uv * world.size;
    let power = (jet.force + jet.held * jet.force * 0.18) / max(world.size.y, 1.0);
    let sep = max(4.0, jet.radius * 0.55);
    let left = pos - (jet.pos + vec2f(-sep, -14.0));
    let right = pos - (jet.pos + vec2f(sep, -14.0));
    let midp = pos - (jet.pos + vec2f(0.0, -28.0));
    let rl = jet.radius * 0.7;
    let magL = exp(-dot(left, left) / max(rl * rl, 1.0));
    let magR = exp(-dot(right, right) / max(rl * rl, 1.0));
    let magC = exp(-dot(midp, midp) / max((rl * 0.5) * (rl * 0.5), 1.0));
    let spin = 22.0 / max(world.size.x, 1.0);
    let tL = vec2f(-left.y, left.x);
    let tR = vec2f(-right.y, right.x);
    let dt = world.dt;
    if (length(left) > 0.4) { vel += (vec2f(0.0, -power) + normalize(tL) * spin) * magL * dt; }
    if (length(right) > 0.4) { vel += (vec2f(0.0, -power) - normalize(tR) * spin) * magR * dt; }
    vel += vec2f(0.0, -power * 0.85) * magC * dt;
    if (jet.attached > 0.5) {
      let ad = pos - (jet.attached_xy + vec2f(0.0, jet.attached_r * 0.42));
      let ar = max(5.0, jet.attached_r * 0.08);
      let magA = exp(-dot(ad, ad) / max(ar * ar, 1.0));
      vel += vec2f(0.0, -power * 0.35) * magA * dt;
    }
  }

  // Post-projection gadgets: a persistent jet / whirl / drain that the
  // incompressible solve cannot smear across the whole room.
  let pos = uv * world.size;
  for (var gi = 0; gi < 16; gi++) {
    if (gi >= i32(gadgets.count.x)) { break; }
    let pose = gadgets.pose[gi];
    let body = gadgets.body[gi];
    if (body.w < 0.5) { continue; }
    let kind = pose.z;
    let power = body.z;
    let dir = vec2f(cos(pose.w), sin(pose.w));
    let delta = pos - pose.xy;
    let along = dot(delta, dir);
    let across = delta.x * dir.y - delta.y * dir.x;

    if (abs(kind - KIND_FAN) < 0.5) {
      // Wide desk-fan cone. A steady breeze, not an additive laser that
      // stacks to the speed cap.
      let span = max(body.y * 1.05, 32.0);
      let reach = max(max(body.x, body.y) * 4.2, 140.0);
      let front = smoothstep(-body.x * 0.15, body.x * 0.28, along);
      let along01 = max(along, 0.0) / reach;
      let mag = exp(-(across * across) / (span * span)) * exp(-along01 * along01 * 1.6) * front;
      let breeze = dir * (0.13 * power);
      vel += (breeze - vel) * clamp(mag, 0.0, 1.0) * 0.72;
    } else if (abs(kind - KIND_VORTEX) < 0.5) {
      let dist = length(delta);
      let rad = max(min(body.x, body.y) * 1.05, 22.0);
      let mag = exp(-(dist * dist) / (rad * rad)) * smoothstep(4.0, 14.0, dist);
      if (dist > 1.0) {
        let tang = vec2f(-delta.y, delta.x) / dist;
        let spin = select(1.0, -1.0, power < 0.0);
        let whirl = tang * (0.16 * abs(power) * spin);
        vel += (whirl - vel) * mag * 0.62;
      }
    }
  }

  dst[i] = clamp(vel, vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
}
