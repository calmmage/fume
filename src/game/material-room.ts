import type { LookState } from "./look";

export const MATERIAL_PAN_LIMIT = 0.24;
export const MATERIAL_PAN_GAIN = 0.45;

export function isMaterialRoom(look: LookState) {
  return look.room && (look.roomStyle === "wood" || look.roomStyle === "stone" || look.roomStyle === "pixel");
}

function bounded(value: number) {
  return Math.max(-MATERIAL_PAN_LIMIT, Math.min(MATERIAL_PAN_LIMIT, value));
}

/** Material cameras stop at their visible limit; reversing never unwinds hidden overshoot. */
export function panMaterialRoom(look: LookState, width: number, height: number, dx: number, dy: number, dt: number) {
  const beforeX = bounded(look.parallaxX);
  const beforeY = bounded(look.parallaxY);
  const nextX = beforeX + dx / Math.max(1, width);
  const nextY = beforeY + dy / Math.max(1, height);
  look.parallaxX = bounded(nextX);
  look.parallaxY = bounded(nextY);
  const seconds = Math.max(0.008, dt);
  look.panVx = nextX !== look.parallaxX ? 0 : Math.max(-3.2, Math.min(3.2, (look.parallaxX - beforeX) / seconds));
  look.panVy = nextY !== look.parallaxY ? 0 : Math.max(-3.2, Math.min(3.2, (look.parallaxY - beforeY) / seconds));
}

export function coastMaterialRoom(look: LookState, dt: number) {
  const x = bounded(look.parallaxX) + look.panVx * dt;
  const y = bounded(look.parallaxY) + look.panVy * dt;
  look.parallaxX = bounded(x);
  look.parallaxY = bounded(y);
  const damping = Math.exp(-6 * dt);
  look.panVx = x !== look.parallaxX || Math.abs(look.panVx * damping) < 0.02 ? 0 : look.panVx * damping;
  look.panVy = y !== look.parallaxY || Math.abs(look.panVy * damping) < 0.02 ? 0 : look.panVy * damping;
}

/** Camera/framing counterpart of material_room in composite.wgsl; units are room coordinates. */
export function materialRoomCamera(width: number, height: number, look: LookState) {
  const aspect = width / Math.max(1, height);
  return {
    halfWidth: 1.5 * aspect * (look.roomW / 0.9),
    halfHeight: 1.45 * (look.roomH / 0.62),
    depth: Math.max(1.6, look.roomDepth),
    centerX: look.roomX,
    centerY: look.roomY - 0.06,
    x: -bounded(look.parallaxX) * aspect * 5 * MATERIAL_PAN_GAIN,
    y: -bounded(look.parallaxY) * 5 * MATERIAL_PAN_GAIN,
  };
}

/** The same camera is used to draw the room and project its stationary dust. */
export function roomCamera(width: number, height: number, look: LookState) {
  const aspect = width / Math.max(1, height);
  if (look.roomStyle === "geometry") {
    const spread = Math.max(0.48, Math.min(1, aspect / 1.5));
    return {
      x: -Math.tanh(look.parallaxX) * 0.75 * spread,
      y: -Math.tanh(look.parallaxY * 2) * 0.48,
      centerX: look.roomX,
      centerY: look.roomY - (aspect < 0.8 ? 0.12 : 0.07),
      focal: Math.min(1, aspect / 0.8),
      depth: 7 * look.roomDepth / 5,
      spread,
    };
  }
  return { ...materialRoomCamera(width, height, look), focal: 1, spread: 1 };
}

/** A tall architectural opening, sized with the wall rather than a small decal. */
export function materialWindow(look: LookState) {
  const depth = Math.max(1.6, look.roomDepth);
  const halfHeight = 1.45 * look.roomH / 0.62;
  return { z0: depth * 0.14, z1: depth * 0.72, y0: -halfHeight * 0.86, y1: halfHeight * 0.70 };
}

export function roomViewConfig(width: number, height: number, look: LookState) {
  const camera = roomCamera(width, height, look);
  const opening = materialWindow(look);
  return {
    background_origin: [camera.x, camera.y],
    background_view: [camera.centerX, camera.centerY, camera.focal, camera.depth],
    window_bounds: [opening.z0, opening.z1, opening.y0, opening.y1],
  };
}
