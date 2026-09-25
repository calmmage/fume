export type ToolKind = "hand" | "wand" | "candle" | "smoke" | "fan" | "block" | "vent" | "vortex" | "fire";

export const MAX_GADGETS = 16;

export type GadgetKind = Exclude<ToolKind, "hand" | "wand">;

export const KIND_CODE: Record<GadgetKind, number> = {
  candle: 1,
  smoke: 2,
  fan: 3,
  block: 4,
  vent: 5,
  vortex: 6,
  fire: 7,
};

export interface Gadget {
  id: number;
  kind: GadgetKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  w: number;
  h: number;
  power: number;
  /** 0 = rounded bar, 1 = disc / ellipse */
  shape: number;
  bound: boolean;
  on: boolean;
}

export interface ToolDef {
  id: ToolKind;
  label: string;
  hint: string;
}

export const TOOLS: ToolDef[] = [
  { id: "hand", label: "Hand", hint: "Drag the hall. The smoke moves with it. Click a circle to pop it" },
  { id: "wand", label: "Wand", hint: "Hold to blow · click a circle to pop it" },
  { id: "candle", label: "Candle", hint: "A thin thread of smoke" },
  { id: "smoke", label: "Machine", hint: "Drag to aim the plume" },
  { id: "fan", label: "Fan", hint: "Drag to aim the breeze" },
  { id: "block", label: "Block", hint: "Drag to draw it · scroll thickness · alt-scroll disc" },
  { id: "vent", label: "Vent", hint: "Pulls smoke in and lets it leave. Not a fog machine" },
  { id: "vortex", label: "Vortex", hint: "A spiral. Scroll to flip the spin" },
  { id: "fire", label: "Fire", hint: "A low flame. Warm thread, orange glow" },
];

let nextGadgetId = 1;

export function createGadget(
  kind: GadgetKind,
  x: number,
  y: number,
  bound: boolean,
): Gadget {
  const size = defaultSize(kind);
  return {
    id: nextGadgetId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: size.angle,
    w: size.w,
    h: size.h,
    power: size.power,
    shape: 0,
    bound,
    on: !bound,
  };
}

export function defaultSize(kind: GadgetKind) {
  switch (kind) {
    case "candle":
      return { w: 16, h: 56, angle: -Math.PI / 2, power: 1.2 };
    case "smoke":
      return { w: 34, h: 26, angle: -Math.PI / 2, power: 1.45 };
    case "fan":
      return { w: 54, h: 46, angle: -Math.PI / 2, power: 1.45 };
    case "block":
      return { w: 120, h: 26, angle: 0, power: 1 };
    case "vent":
      return { w: 38, h: 38, angle: 0, power: 1.15 };
    case "vortex":
      return { w: 58, h: 58, angle: 0, power: 1.2 };
    case "fire":
      return { w: 64, h: 34, angle: -Math.PI / 2, power: 1.15 };
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function scaleGadget(g: Gadget, factor: number) {
  const f = clamp(factor, 0.78, 1.28);
  if (g.kind === "block" && g.shape > 0.5) {
    const s = clamp(g.w * f, 16, 420);
    g.w = s;
    g.h = s;
    return;
  }
  const minS = g.kind === "block" ? 12 : 18;
  const maxW = g.kind === "block" ? 380 : 180;
  const maxH = g.kind === "block" ? 260 : 180;
  g.w = clamp(g.w * f, minS, maxW);
  g.h = clamp(g.h * f, minS, maxH);
}

export function stretchGadget(g: Gadget, factor: number) {
  const f = clamp(factor, 0.8, 1.25);
  g.w = clamp(g.w * f, 12, 420);
  g.h = clamp(g.h / f, 12, 280);
}

export function packGadgets(gadgets: Gadget[]) {
  const pose = Array.from({ length: MAX_GADGETS }, () => [0, 0, 0, 0]);
  const body = Array.from({ length: MAX_GADGETS }, () => [0, 0, 0, 0]);
  const flow = Array.from({ length: MAX_GADGETS }, () => [0, 0, 0, 0]);
  let n = 0;
  for (const g of gadgets) {
    if (n >= MAX_GADGETS) break;
    pose[n] = [g.x, g.y, KIND_CODE[g.kind], g.angle];
    body[n] = [g.w, g.h, g.power, g.on ? 1 : 0];
    flow[n] = [g.vx, g.vy, g.bound ? 1 : 0, g.shape];
    n += 1;
  }
  return { count: [n, 0, 0, 0], pose, body, flow };
}

export function hitGadget(gadgets: Gadget[], x: number, y: number, skipBound = true): Gadget | null {
  let best: Gadget | null = null;
  let bestD = Infinity;
  for (const g of gadgets) {
    if (skipBound && g.bound) continue;
    const ca = Math.cos(-g.angle);
    const sa = Math.sin(-g.angle);
    const dx = x - g.x;
    const dy = y - g.y;
    const lx = dx * ca - dy * sa;
    const ly = dx * sa + dy * ca;
    const hx = Math.max(18, g.w * 0.5 + 8);
    const hy = Math.max(18, g.h * 0.5 + 8);
    if (Math.abs(lx) > hx || Math.abs(ly) > hy) continue;
    const d = Math.abs(lx) + Math.abs(ly);
    if (d < bestD) {
      best = g;
      bestD = d;
    }
  }
  return best;
}
