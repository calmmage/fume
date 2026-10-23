export type PaletteId = "ink" | "dusk" | "blue" | "ember" | "mist" | "violet";
export type DepthMode = "off" | "layers" | "lines" | "woods";
export type RayMode = "off" | "shafts" | "sun";
export type RoomStyle = "empty" | "geometry" | "pixel" | "cosmos" | "stone" | "wood";

export const ROOM_STYLES: { id: RoomStyle; label: string; detail: string; image: string }[] = [
  { id: "empty", label: "Empty", detail: "Just smoke on black.", image: "" },
  { id: "geometry", label: "Geometry", detail: "A room drawn in light.", image: "geometry" },
  { id: "pixel", label: "Pixel art", detail: "Quiet light, drawn in pixels.", image: "pixel-room" },
  { id: "cosmos", label: "Cosmos", detail: "Stars at every distance.", image: "cosmos-native" },
  { id: "stone", label: "Stone", detail: "Verde marble & brass.", image: "stone-room" },
  { id: "wood", label: "Wood", detail: "Smoked walnut. Soft daylight.", image: "wood-room" },
];

export interface LookState {
  roomStyle: RoomStyle;
  dust: boolean;
  palette: PaletteId;
  pixel: boolean;
  grain: boolean;
  depth: DepthMode;
  rays: RayMode;
  /** Enable the selected background. Off leaves the flat palette. */
  room: boolean;
  /** Legacy saved layer preference; no longer used by the room. */
  slices: number;
  /** Depth used by the geometry room and spatial cues. */
  roomDepth: number;
  /** Geometry smoke plane: 0 near the camera and 1 at the back wall. */
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
  roomStyle: "empty",
  dust: true,
  palette: "ink",
  pixel: false,
  grain: false,
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

// A new visual direction starts clean; saved smoke parameters are independent.
const STORE_KEY = "fume-look-v2";

const PALETTES: PaletteId[] = ["ink", "dusk", "blue", "ember", "mist", "violet"];

export function loadLook(): LookState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_LOOK };
    const parsed = JSON.parse(raw) as Partial<LookState>;
    const palette = PALETTES.includes(parsed.palette as PaletteId)
      ? (parsed.palette as PaletteId)
      : "ink";
    const depth =
      parsed.depth === "layers" || parsed.depth === "lines" || parsed.depth === "woods"
        ? parsed.depth
        : "off";
    const rays =
      parsed.rays === "off" || parsed.rays === "shafts" || parsed.rays === "sun"
        ? parsed.rays
        : DEFAULT_LOOK.rays;
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
      roomStyle: ROOM_STYLES.some((s) => s.id === parsed.roomStyle)
        ? parsed.roomStyle!
        : DEFAULT_LOOK.roomStyle,
      dust: parsed.dust !== false,
      palette,
      pixel: Boolean(parsed.pixel),
      pixelCols: Number.isFinite(cols)
        ? Math.min(480, Math.max(72, Math.round(cols)))
        : DEFAULT_LOOK.pixelCols,
      slices: Number.isFinite(slices)
        ? Math.min(28, Math.max(6, Math.round(slices)))
        : DEFAULT_LOOK.slices,
      room: parsed.room !== false,
      roomDepth: num(depthN, 1.6, 9, DEFAULT_LOOK.roomDepth),
      sceneZ: num(sceneZ, 0.12, 0.88, DEFAULT_LOOK.sceneZ),
      roomX: num(roomX, 0.2, 0.8, DEFAULT_LOOK.roomX),
      roomY: num(roomY, 0.25, 0.75, DEFAULT_LOOK.roomY),
      roomW: num(roomW, 0.35, 1.6, DEFAULT_LOOK.roomW),
      roomH: num(roomH, 0.25, 1.2, DEFAULT_LOOK.roomH),
      grain: parsed.grain === true,
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
