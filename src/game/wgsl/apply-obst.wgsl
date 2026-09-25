import { Grid, index_of } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<storage, read> src: array<vec2f>;
@group(0) @binding(2) var<storage, read> obst: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> dst: array<vec2f>;

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
  // Smoke trapped in a bubble rides with it.
  if (o.w > 0.5) {
    dst[i] = o.yz;
    return;
  }
  var vel = src[i];
  let oL = obst[index_of(p - vec2i(1, 0), grid.vel_size)];
  let oR = obst[index_of(p + vec2i(1, 0), grid.vel_size)];
  let oT = obst[index_of(p + vec2i(0, 1), grid.vel_size)];
  let oB = obst[index_of(p - vec2i(0, 1), grid.vel_size)];
  // Kill the wall-normal component so dye slides around solids instead of
  // being advected into them and deleted.
  if (oL.x > 0.5 && vel.x < oL.y) { vel.x = oL.y; }
  if (oR.x > 0.5 && vel.x > oR.y) { vel.x = oR.y; }
  if (oB.x > 0.5 && vel.y < oB.z) { vel.y = oB.z; }
  if (oT.x > 0.5 && vel.y > oT.z) { vel.y = oT.z; }
  dst[i] = vel;
}
