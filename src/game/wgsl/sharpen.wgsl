import { Grid, Sim, index_of, is_rim, DYE_RIM } from "./common.wgsl";

@group(0) @binding(0) var<uniform> grid: Grid;
@group(0) @binding(1) var<uniform> sim: Sim;
@group(0) @binding(2) var<storage, read> src: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> dst: array<vec4f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= grid.dye_size)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, grid.dye_size);
  if (is_rim(p, grid.dye_size, DYE_RIM)) {
    dst[i] = vec4f(0.0);
    return;
  }
  let c = src[i];
  let d0 = max(c.r, max(c.g, c.b));
  if (sim.sharpen < 0.001 || d0 < 0.04) {
    dst[i] = c;
    return;
  }
  let nL = src[index_of(p + vec2i(-1, 0), grid.dye_size)];
  let nR = src[index_of(p + vec2i(1, 0), grid.dye_size)];
  let nB = src[index_of(p + vec2i(0, -1), grid.dye_size)];
  let nT = src[index_of(p + vec2i(0, 1), grid.dye_size)];
  let blur = (nL + nR + nB + nT) * 0.25;
  // Stay inside the neighborhood. An unsharp mask that can exceed its
  // neighbors paints the white scratches.
  let lo = min(min(min(nL.rgb, nR.rgb), min(nB.rgb, nT.rgb)), c.rgb);
  let hi = max(max(max(nL.rgb, nR.rgb), max(nB.rgb, nT.rgb)), c.rgb);
  let w = smoothstep(0.08, 0.4, d0) * clamp(sim.sharpen, 0.0, 1.0);
  let boosted = clamp(c.rgb + (c.rgb - blur.rgb) * 0.45, lo, hi);
  let outc = mix(c.rgb, boosted, w);
  dst[i] = vec4f(max(outc, vec3f(0.0)), c.a);
}
