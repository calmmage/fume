/**
 * Keep the complete visible canvas inside the existing fluid field. A single
 * scale preserves circular bubbles; overscan reserves room for bounded panning.
 * This is a view transform only, independent of the decorative room's walls.
 * Match the Geometry scene_uv expression in composite.wgsl.
 */
export function screenToScene(
  width: number,
  height: number,
  x: number,
  y: number,
  panX: number,
  panY: number,
) {
  return {
    x: ((x / width - Math.tanh(panX) * 0.11 - 0.5) / 1.28 + 0.5) * width,
    y: ((y / height - Math.tanh(panY * 2) * 0.08 - 0.5) / 1.28 + 0.5) * height,
  };
}
