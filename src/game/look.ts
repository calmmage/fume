export type PaletteId = "ink" | "dusk" | "blue" | "ember" | "mist" | "violet";
export type DepthMode = "off" | "layers" | "lines" | "woods";
export type RayMode = "off" | "shafts" | "sun";

export interface LookState {
  palette: PaletteId;
  pixel: boolean;
  grain: boolean;
  depth: DepthMode;
  rays: RayMode;
  /** Stone corridor. Off leaves the flat room, and the woods layers. */
  room: boolean;
  /** How many stone courses run toward the door. */
  slices: number;
  /** How far the door sits, in corridor depth. */
  roomDepth: number;
  /** Where the smoke plane sits, 0 near the camera and 1 at the door. */
  sceneZ: number;
  roomX: number;
  roomY: number;
  roomW: number;
  roomH: number;
  pixelCols: number;
  parallaxX: number;
  parallaxY: number;
  /** Screens per second, left after a drag. Not saved. */
  panVx: number;
  panVy: number;
  dragging: boolean;
}

export const DEFAULT_LOOK: LookState = {
  palette: "ink",
  pixel: false,
  grain: true,
  depth: "off",
  rays: "shafts",
  room: true,
  pixelCols: 160,
  slices: 14,
  roomDepth: 5,
  sceneZ: 0.35,
  roomX: 0.5,
  roomY: 0.5,
  roomW: 0.9,
  roomH: 0.62,
  parallaxX: 0,
  parallaxY: 0,
  panVx: 0,
  panVy: 0,
  dragging: false,
};

const STORE_KEY = "fume-look-v1";

const PALETTES: PaletteId[] = ["ink", "dusk", "blue", "ember", "mist", "violet"];

export function loadLook(): LookState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_LOOK };
    const parsed = JSON.parse(raw) as Partial<LookState>;
    const palette = PALETTES.includes(parsed.palette as PaletteId) ? (parsed.palette as PaletteId) : "ink";
    const depth =
      parsed.depth === "layers" || parsed.depth === "lines" || parsed.depth === "woods"
        ? parsed.depth
        : "off";
    const rays = parsed.rays === "shafts" || parsed.rays === "sun" ? parsed.rays : "off";
    const cols = Number(parsed.pixelCols);
    const slices = Number(parsed.slices);
    const depthN = Number(parsed.roomDepth);
    const sceneZ = Number(parsed.sceneZ);
    const roomX = Number(parsed.roomX);
    const roomY = Number(parsed.roomY);
    const roomW = Number(parsed.roomW);
    const roomH = Number(parsed.roomH);
    const num = (n: number, lo: number, hi: number, fallback: number) =>
      Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
    return {
      ...DEFAULT_LOOK,
      palette,
      pixel: Boolean(parsed.pixel),
      pixelCols: Number.isFinite(cols) ? Math.min(480, Math.max(72, Math.round(cols))) : DEFAULT_LOOK.pixelCols,
      slices: Number.isFinite(slices) ? Math.min(28, Math.max(6, Math.round(slices))) : DEFAULT_LOOK.slices,
      room: parsed.room !== false,
      roomDepth: num(depthN, 1.6, 9, DEFAULT_LOOK.roomDepth),
      sceneZ: num(sceneZ, 0.12, 0.88, DEFAULT_LOOK.sceneZ),
      roomX: num(roomX, 0.2, 0.8, DEFAULT_LOOK.roomX),
      roomY: num(roomY, 0.25, 0.75, DEFAULT_LOOK.roomY),
      roomW: num(roomW, 0.35, 1.6, DEFAULT_LOOK.roomW),
      roomH: num(roomH, 0.25, 1.2, DEFAULT_LOOK.roomH),
      grain: parsed.grain !== false,
      depth,
      rays,
    };
  } catch {
    return { ...DEFAULT_LOOK };
  }
}

export function saveLook(look: LookState) {
  try {
    const { parallaxX: _x, parallaxY: _y, panVx: _vx, panVy: _vy, dragging: _d, ...rest } = look;
    localStorage.setItem(STORE_KEY, JSON.stringify(rest));
  } catch {
    /* private mode */
  }
}
