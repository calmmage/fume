import type { PaletteId } from "./look";

const VW = 480;
const VH = 270;
const WORLD = 1440;

type RGB = [number, number, number];

type Theme = {
  sky0: RGB;
  sky1: RGB;
  hill: [RGB, RGB, RGB, RGB];
  ink: RGB;
  berry: RGB;
  moon: RGB;
  crater: RGB;
  star: RGB;
  window: RGB;
};

const THEMES: Record<PaletteId, Theme> = {
  ink: {
    sky0: [12, 8, 20],
    sky1: [118, 138, 176],
    hill: [
      [132, 150, 186],
      [78, 90, 132],
      [46, 50, 92],
      [24, 22, 48],
    ],
    ink: [14, 8, 20],
    berry: [168, 72, 138],
    moon: [226, 234, 242],
    crater: [168, 188, 210],
    star: [220, 226, 236],
    window: [255, 214, 150],
  },
  dusk: {
    sky0: [28, 10, 18],
    sky1: [150, 90, 80],
    hill: [
      [140, 96, 100],
      [92, 52, 64],
      [54, 28, 40],
      [28, 14, 22],
    ],
    ink: [18, 8, 14],
    berry: [190, 90, 80],
    moon: [240, 220, 200],
    crater: [190, 160, 150],
    star: [240, 220, 210],
    window: [255, 180, 90],
  },
  blue: {
    sky0: [8, 14, 36],
    sky1: [110, 150, 196],
    hill: [
      [140, 170, 206],
      [70, 100, 156],
      [36, 58, 112],
      [16, 28, 60],
    ],
    ink: [8, 12, 28],
    berry: [120, 160, 210],
    moon: [232, 240, 248],
    crater: [160, 190, 220],
    star: [220, 235, 250],
    window: [190, 230, 255],
  },
  ember: {
    sky0: [24, 8, 6],
    sky1: [150, 70, 40],
    hill: [
      [140, 80, 50],
      [90, 40, 30],
      [52, 22, 18],
      [26, 10, 8],
    ],
    ink: [16, 6, 4],
    berry: [220, 120, 40],
    moon: [255, 220, 180],
    crater: [200, 140, 90],
    star: [255, 210, 170],
    window: [255, 190, 80],
  },
  mist: {
    sky0: [18, 20, 22],
    sky1: [150, 158, 160],
    hill: [
      [170, 176, 178],
      [120, 128, 132],
      [78, 84, 88],
      [36, 40, 44],
    ],
    ink: [16, 18, 20],
    berry: [180, 170, 160],
    moon: [236, 238, 236],
    crater: [190, 194, 192],
    star: [230, 232, 230],
    window: [230, 220, 180],
  },
  violet: {
    sky0: [16, 6, 28],
    sky1: [130, 110, 180],
    hill: [
      [150, 130, 190],
      [90, 70, 140],
      [52, 36, 96],
      [26, 16, 48],
    ],
    ink: [14, 6, 22],
    berry: [200, 90, 170],
    moon: [230, 220, 245],
    crater: [170, 150, 200],
    star: [230, 220, 245],
    window: [255, 200, 230],
  },
};

type Buf = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData; cols: number; rows: number };
let buf: Buf | null = null;

function buffer(cols: number, rows: number): Buf {
  if (buf && buf.cols === cols && buf.rows === rows) return buf;
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d");
  buf = { canvas, ctx, img: ctx.createImageData(cols, rows), cols, rows };
  return buf;
}

function wrap(x: number, m: number) {
  return ((x % m) + m) % m;
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rect(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  return x >= x0 && x < x1 && y >= y0 && y < y1;
}

function sample(vx: number, vy: number, camX: number, camY: number, time: number, theme: Theme): RGB {
  const y = vy + camY * 0.15;
  let col: RGB = [
    theme.sky0[0] + (theme.sky1[0] - theme.sky0[0]) * Math.min(1, Math.max(0, (y - 30) / 150)),
    theme.sky0[1] + (theme.sky1[1] - theme.sky0[1]) * Math.min(1, Math.max(0, (y - 30) / 150)),
    theme.sky0[2] + (theme.sky1[2] - theme.sky0[2]) * Math.min(1, Math.max(0, (y - 30) / 150)),
  ];

  const starX = vx + camX * 0.04;
  const starCell = Math.floor(starX / 18) * 19 + Math.floor(y / 14) * 7;
  if (y < 168 && hash(starCell) > 0.82 && hash(starCell + 3) > 0.55) col = theme.star;

  const moonX = 240 + camX * 0.03;
  const moonY = 108 + camY * 0.04;
  const mdx = vx - moonX;
  const mdy = (y - moonY) * (VW / VH) * 0.72;
  const md = Math.hypot(mdx, mdy);
  if (md < 34) {
    col = theme.moon;
    if (Math.hypot(mdx - 10, mdy + 6) < 9 || Math.hypot(mdx + 12, mdy - 8) < 7 || Math.hypot(mdx - 2, mdy - 12) < 5) {
      col = theme.crater;
    }
  } else if (md < 48) {
    col = [
      (col[0] + theme.moon[0]) >> 1,
      (col[1] + theme.moon[1]) >> 1,
      (col[2] + theme.moon[2]) >> 1,
    ];
  }

  const bands = [148, 176, 202, 228];
  for (let b = 0; b < 4; b++) {
    const speed = 0.1 + b * 0.12;
    const wx = vx + camX * speed;
    const ridge =
      bands[b] +
      Math.sin((wx + b * 40) * (0.02 + b * 0.004)) * (10 - b) +
      Math.sin((wx + b * 15) * 0.05) * 4;
    if (y > ridge) col = theme.hill[b];
    if (b === 1 && y > ridge - 16 && y < ridge) {
      const tx = wrap(wx, 36);
      if (tx > 14 && tx < 22 && y > ridge - (tx < 18 ? 14 : 8)) col = theme.hill[3];
    }
  }

  const near = vx + camX * 0.55;
  const castleX = wrap(near - 200, WORLD);
  if (castleX < 150) {
    const cx = castleX - 70;
    const ground = 206;
    const wall = Math.abs(cx) < 36 && y > ground - 28 && y < ground + 4;
    const tower = Math.abs(cx) < 12 && y > ground - 58 && y < ground;
    const side = Math.abs(Math.abs(cx) - 26) < 8 && y > ground - 40 && y < ground;
    const gap = Math.abs(((cx + 40) % 10) - 5) > 3 && y > ground - 28 && y < ground - 22 && Math.abs(cx) < 34;
    if ((wall || tower || side) && !gap) {
      col = theme.ink;
      const win = Math.abs(cx) < 4 && y > ground - 48 && y < ground - 40;
      const win2 = Math.abs(Math.abs(cx) - 26) < 3 && y > ground - 32 && y < ground - 26;
      if (win || win2) col = theme.window;
    }
  }

  const front = vx + camX * 0.92;
  const gx = wrap(front, WORLD);
  const treeAt = (foot: number) => {
    const dx = gx - foot;
    const dxw = dx > WORLD * 0.5 ? dx - WORLD : dx < -WORLD * 0.5 ? dx + WORLD : dx;
    return dxw;
  };
  const feet = [90, 430, 760, 1100];
  let tree = false;
  let canopy = false;
  for (const foot of feet) {
    const dx = treeAt(foot);
    const lump = 52 + Math.sin((gx + foot) * 0.04) * 8;
    if (y < lump && Math.abs(dx) < 150) canopy = true;
    if (Math.abs(dx) < 18 && y > 48 && y < 250) tree = true;
    if (y > 214 && Math.abs(dx) < 18 + (y - 214) * 0.8) tree = true;
    if (y > 150 && y < 158 && dx > 0 && dx < 54) tree = true;
    if (y > 128 && y < 136 && dx < 0 && dx > -48) tree = true;
  }
  if (canopy || tree) {
    col = theme.ink;
    if (canopy && hash(Math.floor(gx / 7) * 13 + Math.floor(y / 6)) > 0.72) col = theme.berry;
  }

  const flap = Math.floor(time * 2.5);
  for (let b = 0; b < 4; b++) {
    const bx = 200 + camX * 0.2 + b * 28 + Math.sin(flap + b) * 6;
    const by = 96 + (b % 2) * 16 + Math.cos(flap * 0.5 + b) * 3;
    const dx = vx - bx;
    const dy = y - by;
    if (Math.abs(dx) < 12 && Math.abs(dy + Math.abs(dx) * 0.35) < 2) col = theme.ink;
  }

  if (y > 248) col = theme.ink;
  return col.map((v) => Math.max(0, Math.min(255, v | 0))) as RGB;
}

export function paintLayerRoom(
  canvas: HTMLCanvasElement,
  opts: { palette: PaletteId; cols: number; parallaxX: number; parallaxY: number; time: number },
) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const cols = Math.min(480, Math.max(72, Math.round(opts.cols)));
  const rows = Math.min(480, Math.max(48, Math.round(cols * (rect.height / rect.width))));
  const backing = buffer(cols, rows);
  const theme = THEMES[opts.palette] ?? THEMES.ink;
  const camX = opts.parallaxX * VW;
  const camY = opts.parallaxY * VH;
  const data = backing.img.data;
  for (let j = 0; j < rows; j++) {
    const vy = ((j + 0.5) / rows) * VH;
    for (let i = 0; i < cols; i++) {
      const vx = ((i + 0.5) / cols) * VW;
      const c = sample(vx, vy, camX, camY, opts.time, theme);
      const o = (j * cols + i) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  backing.ctx.putImageData(backing.img, 0, 0);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(backing.canvas, 0, 0, w, h);
}
