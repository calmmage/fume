import { screenToWorld, type World } from "./sim";

export interface SessionViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Fit a retained simulation without changing its domain or stretching circles. */
export function sessionViewport(
  width: number,
  height: number,
  worldW: number,
  worldH: number,
): SessionViewport {
  const scale = Math.min(width / worldW, height / worldH);
  const w = worldW * scale;
  const h = worldH * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

export function sessionPointer(
  view: SessionViewport,
  worldW: number,
  worldH: number,
  x: number,
  y: number,
) {
  return {
    x: ((x - view.x) / view.width) * worldW,
    y: ((y - view.y) / view.height) * worldH,
    inside: x >= view.x && y >= view.y && x <= view.x + view.width && y <= view.y + view.height,
  };
}

/** Invert the renderer's existing scene projection, then apply the letterbox. */
export function sessionPoint(
  world: World,
  view: SessionViewport,
  point: { x: number; y: number; r?: number },
) {
  const origin = screenToWorld(world, 0, 0);
  const corner = screenToWorld(world, world.w, world.h);
  const scale = view.width / (corner.x - origin.x);
  return {
    x: view.x + (point.x - origin.x) * scale,
    y: view.y + ((point.y - origin.y) / (corner.y - origin.y)) * view.height,
    r: (point.r ?? 0) * scale,
  };
}
