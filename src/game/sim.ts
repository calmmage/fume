import { DEFAULT_PARAMS, loadParams, type SimParams } from "./params";
import { loadLook, type LookState } from "./look";
import { sceneGadgets } from "./scenes";
import {
  createGadget,
  hitGadget,
  MAX_GADGETS,
  scaleGadget as scaleGadgetBody,
  stretchGadget as stretchGadgetBody,
  type Gadget,
  type ToolKind,
} from "./tools";

export const STEP = 1 / 60;
const MAX_BUBBLES = 18;
const MIN_R = 26;
const BEST_KEY = "fume-best";

export interface OscMode {
  n: number;
  amp: number;
  phase: number;
}

export interface Bubble {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  pr: number;
  attached: boolean;
  thickness: number;
  smoke: number;
  seed: number;
  age: number;
  modes: OscMode[];
  popping: boolean;
  popT: number;
  popX: number;
  popY: number;
  alive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  size: number;
  kind: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Floater {
  id: number;
  x: number;
  y: number;
  text: string;
  born: number;
}

export interface FluidSplat {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  density: number;
  temp: number;
  radial: number;
  spin: number;
  aspectX?: number;
  aspectY?: number;
  angle?: number;
  dyeScale?: number;
}

export interface World {
  w: number;
  h: number;
  time: number;
  bubbles: Bubble[];
  particles: Particle[];
  floaters: Floater[];
  fluidSplats: FluidSplat[];
  wandX: number;
  wandY: number;
  blowing: boolean;
  blowHeld: number;
  attachedId: number | null;
  score: number;
  combo: number;
  comboT: number;
  best: number;
  pops: number;
  trauma: number;
  hitstop: number;
  reducedMotion: boolean;
  pointerX: number;
  pointerY: number;
  playing: boolean;
  scoreArmed: number;
  params: SimParams;
  look: LookState;
  gadgets: Gadget[];
  tool: ToolKind;
  placeMode: boolean;
  dragId: number | null;
  dragMode: "move" | "draw" | "aim" | null;
  dragX: number;
  dragY: number;
  dragThick: number;
  onPop?: (b: Bubble, scored: boolean) => void;
}

let nextId = 1;

export function loadBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY) ?? "0");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode */
  }
}

export function createWorld(w: number, h: number): World {
  const world: World = {
    w,
    h,
    time: 0,
    bubbles: [],
    particles: [],
    floaters: [],
    fluidSplats: [],
    wandX: w * 0.5,
    wandY: h - 132,
    blowing: false,
    blowHeld: 0,
    attachedId: null,
    score: 0,
    combo: 0,
    comboT: 0,
    best: loadBest(),
    pops: 0,
    trauma: 0,
    hitstop: 0,
    reducedMotion: false,
    pointerX: w * 0.5,
    pointerY: h * 0.4,
    playing: false,
    scoreArmed: 0,
    params: loadParams(),
    look: loadLook(),
    gadgets: [],
    tool: "hand",
    placeMode: false,
    dragId: null,
    dragMode: null,
    dragX: 0,
    dragY: 0,
    dragThick: 26,
  };
  seedDemo(world);
  return world;
}

export function resizeWorld(world: World, w: number, h: number) {
  world.w = w;
  world.h = h;
  world.wandY = h - 132;
  world.wandX = Math.max(48, Math.min(w - 48, world.wandX));
}

export function setWorldParams(world: World, params: SimParams) {
  world.params = { ...DEFAULT_PARAMS, ...params };
}

export function setWorldLook(world: World, look: LookState) {
  world.look = {
    ...look,
    parallaxX: world.look.parallaxX,
    parallaxY: world.look.parallaxY,
    panVx: world.look.panVx,
    panVy: world.look.panVy,
    dragging: world.look.dragging,
  };
}

export function applyScene(world: World, id: string) {
  world.gadgets = world.gadgets.filter((g) => g.bound);
  world.dragId = null;
  world.dragMode = null;
  for (const g of sceneGadgets(id, world.w, world.h)) world.gadgets.push(g);
}

export function setTool(world: World, tool: ToolKind) {
  world.tool = tool;
  world.dragId = null;
  world.dragMode = null;
  syncBoundGadget(world, 0);
}

export function setPlaceMode(world: World, place: boolean) {
  world.placeMode = place;
  world.dragId = null;
  world.dragMode = null;
  syncBoundGadget(world, 0);
}

export function clearGadgets(world: World) {
  world.gadgets = world.gadgets.filter((g) => g.bound);
  world.dragId = null;
  world.dragMode = null;
}

export function placeGadgetAt(world: World, x: number, y: number): Gadget | null {
  if (world.tool === "wand" || world.tool === "hand") return null;
  const staticCount = world.gadgets.filter((g) => !g.bound).length;
  if (staticCount >= MAX_GADGETS - 1) return null;
  const g = createGadget(world.tool, x, y, false);
  const bound = world.gadgets.find((item) => item.bound);
  if (bound) {
    g.angle = bound.angle;
    g.w = bound.w;
    g.h = bound.h;
    g.power = bound.power;
    g.shape = bound.shape;
  }
  g.on = true;
  world.gadgets.push(g);
  return g;
}

export function removeGadget(world: World, g: Gadget) {
  if (g.bound) return;
  world.gadgets = world.gadgets.filter((item) => item.id !== g.id);
  if (world.dragId === g.id) {
    world.dragId = null;
    world.dragMode = null;
  }
}

export function rotateGadget(world: World, g: Gadget, delta: number) {
  g.angle += delta;
}

export function scaleGadget(world: World, g: Gadget, factor: number) {
  scaleGadgetBody(g, factor);
}

export function stretchGadget(world: World, g: Gadget, factor: number) {
  stretchGadgetBody(g, factor);
}

export function pickGadget(world: World, x: number, y: number) {
  return hitGadget(world.gadgets, x, y, true);
}

function syncBoundGadget(world: World, dt: number) {
  const bound = world.gadgets.find((g) => g.bound);
  if (world.tool === "wand" || world.tool === "hand") {
    if (bound) world.gadgets = world.gadgets.filter((g) => !g.bound);
    return;
  }
  let g = bound;
  const at = screenToWorld(world, world.pointerX, world.pointerY);
  if (!g) {
    g = createGadget(world.tool, at.x, at.y, true);
    world.gadgets.push(g);
  } else if (g.kind !== world.tool) {
    const fresh = createGadget(world.tool, g.x, g.y, true);
    fresh.id = g.id;
    fresh.x = g.x;
    fresh.y = g.y;
    Object.assign(g, fresh);
  }
  const nx = at.x;
  const ny = at.y;
  if (dt > 1e-4) {
    g.vx = (nx - g.x) / dt;
    g.vy = (ny - g.y) / dt;
    if ((g.kind === "fan" || g.kind === "smoke") && Math.hypot(g.vx, g.vy) > 45) {
      g.angle = Math.atan2(g.vy, g.vx);
    }
  }
  g.x = nx;
  g.y = ny;
  g.on = !world.placeMode;
}

export function panRoom(world: World, dx: number, dy: number, dt: number) {
  const sx = dx / Math.max(1, world.w);
  const sy = (dy / Math.max(1, world.h)) * 0.42;
  world.look.parallaxX += sx;
  world.look.parallaxY = Math.min(0.65, Math.max(-0.65, world.look.parallaxY + sy));
  const k = 1 / Math.max(dt, 0.008);
  world.look.panVx = Math.min(3.2, Math.max(-3.2, sx * k));
  world.look.panVy = Math.min(1.4, Math.max(-1.4, sy * k));
}

function coastRoom(world: World, dt: number) {
  if (world.look.dragging) return;
  const vx = world.look.panVx;
  const vy = world.look.panVy;
  if (vx * vx + vy * vy < 1e-4) return;
  world.look.parallaxX += vx * dt;
  world.look.parallaxY = Math.min(0.65, Math.max(-0.65, world.look.parallaxY + vy * dt));
  const damp = Math.exp(-1.7 * dt);
  world.look.panVx = Math.abs(vx * damp) < 0.02 ? 0 : vx * damp;
  world.look.panVy = Math.abs(vy * damp) < 0.02 ? 0 : vy * damp;
}

export function screenToWorld(world: World, x: number, y: number) {
  const look = world.look;
  if (!look.room) return { x, y };
  const aspect = world.w / Math.max(1, world.h);
  const z0 = 0.7;
  const z1 = Math.max(look.roomDepth, z0 + 0.4);
  const zS = z0 + (z1 - z0) * Math.min(0.92, Math.max(0.08, look.sceneZ));
  const nx = (x / world.w - look.roomX) * aspect;
  const ny = y / world.h - look.roomY;
  const px = -look.parallaxX * 0.35 + nx * zS;
  const py = -look.parallaxY * 0.22 + ny * zS;
  return {
    x: (px / (look.roomW * 2) + 0.5) * world.w,
    y: (py / (look.roomH * 2) + 0.5) * world.h,
  };
}

export function movePointer(world: World, x: number, y: number) {
  world.pointerX = x;
  world.pointerY = y;
  const bound = world.gadgets.find((g) => g.bound);
  if (bound && world.dragId == null) {
    const p = screenToWorld(world, x, y);
    bound.x = p.x;
    bound.y = p.y;
  }
  applyDrag(world);
}

function clampN(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function applyDrag(world: World) {
  if (world.dragId == null || world.dragMode == null) return;
  const drag = world.gadgets.find((g) => g.id === world.dragId);
  if (!drag) return;
  const p = screenToWorld(world, world.pointerX, world.pointerY);
  const dx = p.x - world.dragX;
  const dy = p.y - world.dragY;
  const len = Math.hypot(dx, dy);
  if (world.dragMode === "draw") {
    drag.vx = 0;
    drag.vy = 0;
    if (drag.shape > 0.5) {
      const d = clampN(Math.max(len * 2, 28), 28, 460);
      drag.w = d;
      drag.h = d;
      drag.angle = 0;
      drag.x = world.dragX;
      drag.y = world.dragY;
      return;
    }
    if (len > 8) {
      drag.w = clampN(len, 22, 540);
      drag.h = clampN(world.dragThick, 10, 260);
      drag.angle = Math.atan2(dy, dx);
      drag.x = world.dragX + dx * 0.5;
      drag.y = world.dragY + dy * 0.5;
    }
    return;
  }
  if (world.dragMode === "aim") {
    drag.vx = 0;
    drag.vy = 0;
    drag.x = world.dragX;
    drag.y = world.dragY;
    if (len > 10) drag.angle = Math.atan2(dy, dx);
    return;
  }
  if ((drag.kind === "fan" || drag.kind === "smoke") && len > 6) {
    drag.angle = Math.atan2(dy, dx);
  }
  drag.x = p.x;
  drag.y = p.y;
}

export function beginGadgetDrag(
  world: World,
  g: Gadget,
  x: number,
  y: number,
  mode: "move" | "draw" | "aim",
) {
  world.dragId = g.id;
  world.dragMode = mode;
  world.dragX = x;
  world.dragY = y;
  world.dragThick = g.h;
}

export function endGadgetDrag(world: World) {
  const g = world.dragId != null ? world.gadgets.find((item) => item.id === world.dragId) : null;
  if (g) {
    g.vx = 0;
    g.vy = 0;
  }
  world.dragId = null;
  world.dragMode = null;
}

export function tuneBlock(world: World, g: Gadget, deltaY: number, alt: boolean) {
  if (g.kind !== "block") return;
  if (alt) {
    g.shape = g.shape > 0.5 ? 0 : 1;
    if (g.shape > 0.5) {
      const s = Math.max(g.w, g.h, 28);
      g.w = s;
      g.h = s;
      world.dragThick = s;
    } else {
      world.dragThick = clampN(Math.max(14, g.w * 0.18), 12, 80);
      g.h = world.dragThick;
    }
  } else {
    const f = Math.exp(-deltaY * 0.0015);
    if (g.shape > 0.5) {
      const s = clampN(g.w * f, 18, 460);
      g.w = s;
      g.h = s;
      world.dragThick = s;
    } else if (world.dragMode === "draw") {
      world.dragThick = clampN(world.dragThick * f, 10, 240);
      g.h = world.dragThick;
    } else {
      g.h = clampN(g.h * f, 10, 260);
    }
  }
  applyDrag(world);
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix * 13.1 + iy * 7.7);
  const b = hash((ix + 1) * 13.1 + iy * 7.7);
  const c = hash(ix * 13.1 + (iy + 1) * 7.7);
  const d = hash((ix + 1) * 13.1 + (iy + 1) * 7.7);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function wind(world: World, x: number, y: number): [number, number] {
  const s = 0.0042;
  const e = 1.4;
  const t = world.time;
  const n1 = noise2(x * s, y * s + t * 0.11);
  const n2 = noise2(x * s + e, y * s + t * 0.11);
  const n3 = noise2(x * s, y * s + e + t * 0.11);
  const amp = world.params.wind;
  return [(n1 - n3) * amp, (n2 - n1) * amp];
}

function freshModes(): OscMode[] {
  return [
    { n: 2, amp: 0, phase: Math.random() * Math.PI * 2 },
    { n: 3, amp: 0, phase: Math.random() * Math.PI * 2 },
    { n: 4, amp: 0, phase: Math.random() * Math.PI * 2 },
    { n: 5, amp: 0, phase: Math.random() * Math.PI * 2 },
  ];
}

export function spawnBubble(
  world: World,
  x: number,
  y: number,
  r: number,
  attached = false,
): Bubble | null {
  if (world.bubbles.length >= MAX_BUBBLES) return null;
  const b: Bubble = {
    id: nextId++,
    x,
    y,
    px: x,
    py: y,
    vx: (Math.random() - 0.5) * 4,
    vy: -4 - Math.random() * 5,
    r,
    pr: r,
    attached,
    thickness: 160 + Math.random() * 220,
    smoke: attached ? 0.28 : 0.45,
    seed: Math.random() * 1000,
    age: 0,
    modes: freshModes(),
    popping: false,
    popT: 0,
    popX: 0,
    popY: 0,
    alive: true,
  };
  world.bubbles.push(b);
  return b;
}

function seedDemo(world: World) {
  const { w, h } = world;
  const spots = [[0.62, 0.38, 48, 210]] as const;
  for (const [nx, ny, r, thick] of spots) {
    const b = spawnBubble(world, nx * w, ny * h, r);
    if (!b) continue;
    b.thickness = thick;
    b.smoke = 0.55;
    b.vy = -3 - Math.random() * 4;
    b.vx = (Math.random() - 0.5) * 6;
    b.modes[0].amp = 0.05 + Math.random() * 0.04;
    b.modes[1].amp = 0.025 + Math.random() * 0.02;
  }
  const candle = createGadget("candle", w * 0.34, h * 0.78, false);
  candle.on = true;
  world.gadgets.push(candle);
  const block = createGadget("block", w * 0.34, h * 0.48, false);
  block.on = true;
  block.w = 200;
  block.h = 22;
  block.angle = 0;
  world.gadgets.push(block);
}

export function radiusAt(b: Bubble, theta: number): number {
  let r = b.r;
  for (const m of b.modes) {
    r += b.r * m.amp * Math.cos(m.n * theta + m.phase);
  }
  return r;
}

export function hitBubble(world: World, x: number, y: number): Bubble | null {
  let best: Bubble | null = null;
  let bestR = Infinity;
  for (const b of world.bubbles) {
    if (!b.alive || b.popping) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    const theta = Math.atan2(dy, dx);
    const r = radiusAt(b, theta);
    if (dx * dx + dy * dy <= r * r && r < bestR) {
      best = b;
      bestR = r;
    }
  }
  return best;
}

function excite(b: Bubble, nIndex: number, amp: number, phase: number) {
  const m = b.modes[nIndex];
  if (!m) return;
  m.amp = Math.min(0.2, m.amp + amp);
  m.phase = phase;
}

export function popBubble(world: World, b: Bubble, hx: number, hy: number, scored: boolean) {
  if (!b.alive || b.popping) return;
  b.popping = true;
  b.popT = 0;
  b.popX = (hx - b.x) / Math.max(1, b.r);
  b.popY = (hy - b.y) / Math.max(1, b.r);
  world.onPop?.(b, scored);
  if (world.attachedId === b.id) world.attachedId = null;

  const shake = world.reducedMotion ? 0.08 : Math.min(0.85, 0.22 + b.r / 160);
  world.trauma = Math.min(1, world.trauma + shake);
  if (!world.reducedMotion) world.hitstop = Math.min(0.07, 0.028 + b.r / 4000);

  burst(world, b);
  world.fluidSplats.push({
    x: b.x,
    y: b.y,
    radius: b.r,
    vx: b.vx * 0.2,
    vy: Math.min(b.vy, 0) - 28,
    density: 0.95,
    temp: 0,
    radial: 150,
    spin: (Math.random() < 0.5 ? -1 : 1) * 4,
    dyeScale: 0.86,
  });

  if (scored && world.playing && world.time >= world.scoreArmed) {
    const thinBonus = b.thickness < 90 ? 1.6 : b.thickness < 160 ? 1.25 : 1;
    const sizePts = 8 + Math.round(b.r * 0.38) + Math.round(b.smoke * 6);
    world.combo = world.comboT > 0 ? world.combo + 1 : 1;
    world.comboT = 0.85;
    const pts = Math.round(sizePts * thinBonus * (1 + (world.combo - 1) * 0.35));
    world.score += pts;
    world.pops += 1;
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.best);
    }
  }

  for (const o of world.bubbles) {
    if (o === b || !o.alive || o.popping || o.attached) continue;
    const dx = o.x - b.x;
    const dy = o.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > b.r + o.r + 90 || d < 1) continue;
    const falloff = 1 - d / (b.r + o.r + 90);
    const ang = Math.atan2(dy, dx);
    o.vx += (dx / d) * 8 * falloff;
    o.vy += (dy / d) * 8 * falloff;
    excite(o, 0, 0.05 * falloff, ang);
    excite(o, 1, 0.03 * falloff, ang * 1.4);
    if (o.thickness < 48 && falloff > 0.45) {
      popBubble(world, o, o.x, o.y, scored);
    }
  }
}

function burst(world: World, b: Bubble) {
  const drops = Math.min(16, 6 + Math.round(b.r / 10));
  for (let i = 0; i < drops; i++) {
    const a = (i / drops) * Math.PI * 2 + Math.random() * 0.2;
    const sp = 28 + Math.random() * 70 + b.r * 0.25;
    world.particles.push({
      x: b.x + Math.cos(a) * b.r * 0.55,
      y: b.y + Math.sin(a) * b.r * 0.55,
      vx: Math.cos(a) * sp + b.vx * 0.3,
      vy: Math.sin(a) * sp + b.vy * 0.3,
      life: 0,
      ttl: 0.35 + Math.random() * 0.35,
      size: 1.8 + Math.random() * 2.6,
      kind: 0,
      r: 0.78,
      g: 0.8,
      b: 0.84,
      a: 0.55,
    });
  }
}

export function beginBlow(world: World) {
  world.blowing = true;
}

export function endBlow(world: World) {
  world.blowing = false;
  const id = world.attachedId;
  if (id == null) return;
  const b = world.bubbles.find((x) => x.id === id);
  if (!b || !b.alive) {
    world.attachedId = null;
    return;
  }
  detach(world, b);
}

function detach(world: World, b: Bubble) {
  b.attached = false;
  world.attachedId = null;
  const power = 10 + world.blowHeld * 16;
  b.vy -= power * 0.32;
  b.vx += (Math.random() - 0.5) * 5;
  excite(b, 0, 0.07, -Math.PI / 2);
  excite(b, 1, 0.04, Math.random() * 6);
  b.smoke = Math.min(1, b.smoke + 0.12);
}

export function stepWorld(world: World, dt: number) {
  if (world.hitstop > 0) {
    world.hitstop -= dt;
    if (world.hitstop > 0) return;
    dt = -world.hitstop;
    world.hitstop = 0;
  }

  world.time += dt;
  coastRoom(world, dt);
  world.trauma = Math.max(0, world.trauma - dt * 1.8);
  world.comboT = Math.max(0, world.comboT - dt);
  if (world.comboT <= 0) world.combo = 0;

  if (world.tool === "wand") {
    const targetWand = world.pointerX;
    const targetY = world.pointerY;
    world.wandX += (targetWand - world.wandX) * (1 - Math.exp(-14 * dt));
    world.wandY += (targetY - world.wandY) * (1 - Math.exp(-14 * dt));
    world.wandX = Math.max(40, Math.min(world.w - 40, world.wandX));
    world.wandY = Math.max(48, Math.min(world.h - 40, world.wandY));
  } else {
    world.wandX += (world.pointerX - world.wandX) * (1 - Math.exp(-8 * dt));
    world.wandY = world.h - 132;
  }

  syncBoundGadget(world, dt);
  const drag = world.dragId != null ? world.gadgets.find((g) => g.id === world.dragId) : null;
  if (drag && world.dragMode === "move") {
    const p = screenToWorld(world, world.pointerX, world.pointerY);
    drag.vx = (p.x - drag.x) / Math.max(dt, 1e-4);
    drag.vy = (p.y - drag.y) / Math.max(dt, 1e-4);
  }
  applyDrag(world);

  if (world.blowing) {
    world.blowHeld += dt;
    ensureAttached(world);
  } else {
    world.blowHeld = Math.max(0, world.blowHeld - dt * 1.6);
  }

  for (const b of world.bubbles) {
    if (!b.alive) continue;
    b.px = b.x;
    b.py = b.y;
    b.pr = b.r;
    if (b.popping) {
      b.popT += dt / 0.16;
      if (b.popT >= 1) b.alive = false;
      continue;
    }
    stepBubble(world, b, dt);
  }

  collideBubbles(world);
  collideGadgets(world);
  stepParticles(world, dt);

  world.bubbles = world.bubbles.filter((b) => b.alive);
  world.floaters = world.floaters.filter((f) => world.time - f.born < 0.85);

  if (!world.playing && world.bubbles.length < 2 && Math.random() < 0.004) {
    const b = spawnBubble(
      world,
      40 + Math.random() * (world.w - 80),
      world.h * 0.72 + Math.random() * 30,
      32 + Math.random() * 28,
    );
    if (b) b.smoke = 0.14 + Math.random() * 0.1;
  }
}

function ensureAttached(world: World) {
  if (world.attachedId != null) {
    const b = world.bubbles.find((x) => x.id === world.attachedId);
    if (b && b.alive && !b.popping) return;
    world.attachedId = null;
  }
  if (world.bubbles.length >= MAX_BUBBLES) return;
  const wand = screenToWorld(world, world.wandX, world.wandY);
  const b = spawnBubble(world, wand.x, wand.y - 22, MIN_R, true);
  if (!b) return;
  world.attachedId = b.id;
  b.smoke = 0.35;
  b.thickness = 220 + Math.random() * 140;
  b.vy = 0;
  b.vx = 0;
}

function stepBubble(world: World, b: Bubble, dt: number) {
  b.age += dt;
  const p = world.params;

  const drain = (p.filmDrain + b.r * 0.12) * (0.7 + b.age * 0.04);
  b.thickness = Math.max(18, b.thickness - drain * dt);

  const inv = 1 / Math.max(24, Math.sqrt(b.r));
  for (const m of b.modes) {
    m.phase += (m.n * 4.6) * inv * dt * 60 * 0.12;
    m.amp *= Math.exp(-1.15 * dt);
    if (m.amp < 0.001) m.amp = 0;
  }

  if (b.attached) {
    const wand = screenToWorld(world, world.wandX, world.wandY);
    b.r = Math.min(p.maxRadius, b.r + p.growRate * dt);
    b.x += (wand.x - b.x) * (1 - Math.exp(-18 * dt));
    b.y += (wand.y - 18 - b.r * 0.72 - b.y) * (1 - Math.exp(-16 * dt));
    b.vx = 0;
    b.vy = 0;
    b.smoke = Math.min(1, b.smoke + dt * 0.45);
    excite(b, 0, 0.01 * dt * 8, -Math.PI / 2);
    if (b.r >= p.maxRadius - 0.5) {
      popBubble(world, b, b.x, b.y - b.r, world.playing);
    }
    return;
  }

  const [wx, wy] = wind(world, b.x, b.y);
  const area = b.r;
  const netG = p.gravity - p.lift * (0.85 + b.smoke * 0.25);
  b.vy += netG * dt;
  b.vx += wx * dt;
  b.vy += wy * dt;

  if (world.blowing) {
    const wand = screenToWorld(world, world.wandX, world.wandY);
    const dx = b.x - wand.x;
    const dy = b.y - wand.y;
    const d2 = dx * dx + dy * dy;
    const cone = 160 + world.blowHeld * 24;
    if (d2 < cone * cone && dy < 20) {
      const d = Math.sqrt(d2) + 1;
      const f = (1 - d / cone) * 42;
      b.vy -= f * dt * 1.1;
      b.vx += (dx / d) * f * dt * 0.22;
      excite(b, 0, 0.012 * dt * 8, Math.atan2(dy, dx));
    }
  }

  const speed = Math.hypot(b.vx, b.vy);
  const drag = p.drag * (area / 70);
  b.vx -= b.vx * drag * dt;
  b.vy -= b.vy * drag * dt;

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  applyGadgetForces(world, b, dt);

  const pad = b.r + 4;
  if (b.x < pad) {
    b.x = pad;
    b.vx = Math.abs(b.vx) * 0.18;
    excite(b, 0, 0.06, 0);
    excite(b, 1, 0.03, 0.4);
  } else if (b.x > world.w - pad) {
    b.x = world.w - pad;
    b.vx = -Math.abs(b.vx) * 0.18;
    excite(b, 0, 0.06, Math.PI);
    excite(b, 1, 0.03, Math.PI + 0.4);
  }
  if (b.y > world.h - pad - 36) {
    b.y = world.h - pad - 36;
    b.vy = -Math.abs(b.vy) * 0.12;
    excite(b, 0, 0.05, Math.PI / 2);
  }
  if (b.y < -b.r * 0.4) {
    popBubble(world, b, b.x, b.y, false);
    return;
  }

  if (speed > 18) {
    const target = Math.min(0.12, (speed - 18) / 700);
    b.modes[0].amp = Math.max(b.modes[0].amp, target);
    b.modes[0].phase = Math.atan2(b.vy, b.vx);
  }

  if (b.thickness < 36) {
    const popP = (36 - b.thickness) / 36;
    if (Math.random() < popP * popP * dt * 2.4) {
      popBubble(world, b, b.x + (Math.random() - 0.5) * b.r, b.y - b.r * 0.6, world.playing);
    }
  }
}

function mergeBubbles(world: World, a: Bubble, b: Bubble) {
  const keep = a.r >= b.r ? a : b;
  const drop = keep === a ? b : a;
  const mA = a.r * a.r;
  const mB = b.r * b.r;
  const m = mA + mB;
  keep.x = (a.x * mA + b.x * mB) / m;
  keep.y = (a.y * mA + b.y * mB) / m;
  keep.px = keep.x;
  keep.py = keep.y;
  keep.vx = (a.vx * mA + b.vx * mB) / m;
  keep.vy = (a.vy * mA + b.vy * mB) / m;
  const cap = world.params.maxRadius * 1.2;
  keep.r = Math.min(cap, Math.sqrt(m));
  keep.pr = keep.r;
  keep.smoke = Math.min(1, (a.smoke * mA + b.smoke * mB) / m);
  keep.thickness = (a.thickness * mA + b.thickness * mB) / m;
  keep.age = Math.min(a.age, b.age);
  for (let i = 0; i < keep.modes.length; i++) {
    const am = a.modes[i];
    const bm = b.modes[i];
    if (!am || !bm) continue;
    keep.modes[i].amp = Math.min(0.18, (am.amp + bm.amp) * 0.65 + 0.045);
    keep.modes[i].phase = am.phase;
  }
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  excite(keep, 0, 0.08, ang);
  excite(keep, 1, 0.05, ang + 0.7);
  excite(keep, 2, 0.03, ang * 0.5);
  drop.alive = false;
}

function collideBubbles(world: World) {
  const list = world.bubbles;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.alive || a.popping || a.attached) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.alive || b.popping || b.attached) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (dist >= min || dist < 0.001) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = min - dist;
      const minR = Math.min(a.r, b.r);
      if (overlap > minR * 0.08) {
        mergeBubbles(world, a, b);
        if (!a.alive) break;
        continue;
      }
      const invA = 1 / (a.r * a.r);
      const invB = 1 / (b.r * b.r);
      const sum = invA + invB;
      const corr = overlap * 0.22;
      a.x -= nx * corr * (invA / sum);
      a.y -= ny * corr * (invA / sum);
      b.x += nx * corr * (invB / sum);
      b.y += ny * corr * (invB / sum);

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const velN = rvx * nx + rvy * ny;
      if (velN > 0) continue;
      const e = 0.08;
      const jImp = (-(1 + e) * velN) / sum;
      a.vx -= jImp * nx * invA;
      a.vy -= jImp * ny * invA;
      b.vx += jImp * nx * invB;
      b.vy += jImp * ny * invB;

      const impact = Math.min(0.12, Math.abs(velN) / 220);
      const ang = Math.atan2(ny, nx);
      excite(a, 0, impact * 1.3, ang);
      excite(a, 1, impact * 0.7, ang * 1.3);
      excite(b, 0, impact * 1.3, ang + Math.PI);
      excite(b, 1, impact * 0.7, ang * 1.3 + Math.PI);
    }
  }
}

function stepParticles(world: World, dt: number) {
  const next: Particle[] = [];
  for (const p of world.particles) {
    p.life += dt;
    if (p.life >= p.ttl) continue;
    if (p.kind === 3) {
      p.size += dt * 220;
      next.push(p);
      continue;
    }
    p.vy += (p.kind === 1 ? 180 : 12) * dt;
    p.vx *= Math.exp(-1.2 * dt);
    p.vy *= Math.exp((p.kind === 0 ? 0.6 : 0.4) * -dt);
    const [wx, wy] = wind(world, p.x, p.y);
    p.vx += wx * dt * (p.kind === 0 ? 1.4 : 0.3);
    p.vy += wy * dt * 0.5;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    next.push(p);
  }
  world.particles = next.length > 900 ? next.slice(next.length - 900) : next;
}

function applyGadgetForces(world: World, b: Bubble, dt: number) {
  for (const g of world.gadgets) {
    if (!g.on) continue;
    const dx = b.x - g.x;
    const dy = b.y - g.y;
    if (g.kind === "fan") {
      const dirx = Math.cos(g.angle);
      const diry = Math.sin(g.angle);
      const along = dx * dirx + dy * diry;
      const across = dx * diry - dy * dirx;
      const span = Math.max(g.h * 0.85, 24);
      const reach = Math.max(g.w, g.h) * 4.2 * g.power;
      if (along < -g.w * 0.2 || along > reach) continue;
      const mag = Math.exp(-(across * across) / (span * span)) * Math.exp(-((along / reach) * along) / reach);
      b.vx += dirx * 90 * g.power * mag * dt;
      b.vy += diry * 90 * g.power * mag * dt;
    } else if (g.kind === "vent") {
      const d = Math.hypot(dx, dy);
      const reach = Math.max(18, Math.min(g.w, g.h) * 0.85);
      if (d < 1 || d > reach) continue;
      const mag = 1 - d / reach;
      b.vx -= (dx / d) * 70 * mag * dt;
      b.vy -= (dy / d) * 70 * mag * dt;
    } else if (g.kind === "vortex") {
      const d = Math.hypot(dx, dy);
      const reach = Math.max(g.w, g.h) * 0.7;
      if (d < 6 || d > reach) continue;
      const mag = Math.exp(-(d * d) / (reach * reach));
      const spin = g.power < 0 ? -1 : 1;
      b.vx += (-dy / d) * 110 * Math.abs(g.power) * mag * spin * dt;
      b.vy += (dx / d) * 110 * Math.abs(g.power) * mag * spin * dt;
    }
  }
}

function collideGadgets(world: World) {
  for (const b of world.bubbles) {
    if (!b.alive || b.popping || b.attached) continue;
    for (const g of world.gadgets) {
      if (g.kind !== "block" || !g.on) continue;
      if (g.shape > 0.5) {
        const rad = Math.max(g.w, g.h) * 0.5 + b.r * 0.92;
        const dx = b.x - g.x;
        const dy = b.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d >= rad || d < 0.001) continue;
        const nx = dx / d;
        const ny = dy / d;
        const push = rad - d;
        b.x += nx * push;
        b.y += ny * push;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= vn * nx;
          b.vy -= vn * ny;
        }
        continue;
      }
      const ca = Math.cos(-g.angle);
      const sa = Math.sin(-g.angle);
      const dx = b.x - g.x;
      const dy = b.y - g.y;
      const lx = dx * ca - dy * sa;
      const ly = dx * sa + dy * ca;
      const hx = g.w * 0.5 + b.r;
      const hy = g.h * 0.5 + b.r;
      const ox = hx - Math.abs(lx);
      const oy = hy - Math.abs(ly);
      if (ox <= 0 || oy <= 0) continue;
      if (ox < oy) {
        const sx = lx < 0 ? -1 : 1;
        const nx = ca * sx;
        const ny = -sa * sx;
        b.x += nx * ox;
        b.y += ny * ox;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= vn * nx * 1.08;
          b.vy -= vn * ny * 1.08;
        }
        excite(b, 0, 0.05, Math.atan2(ny, nx));
      } else {
        const sy = ly < 0 ? -1 : 1;
        const nx = sa * sy;
        const ny = ca * sy;
        b.x += nx * oy;
        b.y += ny * oy;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= vn * nx * 1.08;
          b.vy -= vn * ny * 1.08;
        }
        excite(b, 0, 0.05, Math.atan2(ny, nx));
      }
    }
  }
}

export function interpolated(
  b: Bubble,
  alpha: number,
): { x: number; y: number; r: number } {
  return {
    x: b.px + (b.x - b.px) * alpha,
    y: b.py + (b.y - b.py) * alpha,
    r: b.pr + (b.r - b.pr) * alpha,
  };
}
