import { Grid, WorldInfo, Gadgets, VEL_LIMIT, KIND_BLOCK, index_of, rotate2, sd_box, sd_ellipse } from "./common.wgsl";

struct Balls {
  count: vec4f,
  xy_r_pop: array<vec4f, 18>,
  vel_att: array<vec4f, 18>,
}

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> world: WorldInfo;
@group(0) @binding(2) var<uniform> balls: Balls;
@group(0) @binding(3) var<uniform> gadgets: Gadgets;
@group(0) @binding(4) var<storage, read_write> obst: array<vec4f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.vel_size)) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(grid.vel_size);
  let pos = uv * world.size;
  let texel = world.size.x / f32(grid.vel_size.x);
  let wall_px = max(texel * 1.6, 3.0);

  var solid = 0.0;
  var interior = 0.0;
  var wvel = vec2f(0.0);
  for (var i = 0; i < 18; i++) {
    if (i >= i32(balls.count.x)) { break; }
    let b = balls.xy_r_pop[i];
    let info = balls.vel_att[i];
    if (b.w > 0.32) { continue; }
    let d = pos - b.xy;
    let dist = length(d);
    let rad = max(b.z, 1.0);
    let bvel = clamp(info.xy / max(world.size, vec2f(1.0)), vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
    if (dist < rad - wall_px) {
      interior = 1.0;
      wvel = bvel;
    }
    var ring = select(0.0, 1.0, abs(dist - rad) <= wall_px);
    if (info.z > 0.5) {
      let ang = atan2(d.y, d.x);
      let opening = 1.0 - smoothstep(0.62, 1.02, abs(ang - 1.5707963));
      ring *= 1.0 - opening;
    }
    if (ring > solid) {
      solid = ring;
      wvel = bvel;
    }
  }

  for (var i = 0; i < 16; i++) {
    if (i >= i32(gadgets.count.x)) { break; }
    let pose = gadgets.pose[i];
    let body = gadgets.body[i];
    if (abs(pose.z - KIND_BLOCK) > 0.5) { continue; }
    if (body.w < 0.5) { continue; }
    let local = rotate2(pos - pose.xy, pose.w);
    let half = vec2f(body.x, body.y) * 0.5;
    let flow = gadgets.flow[i];
    // Inset the mask so the outer pixels stay fluid. A mask that matches the
    // graphic exactly deletes the dye sitting on the face — it looks like the
    // smoke is soaked up by the block.
    let inset = min(max(texel * 0.45, 1.0), min(half.x, half.y) * 0.35);
    var box = sd_box(local, half);
    if (flow.w > 0.5) { box = sd_ellipse(local, half); }
    if (box < -inset) {
      solid = 1.0;
      interior = 0.0;
      wvel = clamp(flow.xy / max(world.size, vec2f(1.0)), vec2f(-VEL_LIMIT), vec2f(VEL_LIMIT));
    }
  }

  obst[index_of(vec2i(id.xy), grid.vel_size)] = vec4f(solid, wvel, interior);
}
