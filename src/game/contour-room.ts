import { texture, type Gpu, type Texture } from "vgpu";
import type { LookState } from "./look";
import { roomCamera } from "./material-room";

type Point = readonly [number, number, number];
type Face = { points: Point[]; fill: boolean; tone: number; width: number; screen: boolean };

// Original, deliberately sparse architectural drawing. Opaque faces hide the
// edges behind furniture; this is an interior, not a transparent wire cage.
function roomDrawing(): Face[] {
  const faces: Face[] = [];
  let screen = false;
  let shiftX = 0;
  function face(points: Point[], fill = true, tone = 0.84, width = 0.85) {
    faces.push({
      points: points.map(([x, y, z]) => [x + shiftX, y, z]),
      fill,
      tone,
      width,
      screen,
    });
  }
  function line(points: Point[], tone = 0.65, width = 0.7) {
    face(points, false, tone, width);
  }
  function box(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    tone = 0.78,
  ) {
    // Bottom/back are hidden from the camera. Painter ordering handles the
    // top, front and sides, including the black space between cushions.
    face(
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y0, z0],
      ],
      true,
      tone,
    );
    face(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      true,
      tone,
    );
    face(
      [
        [x0, y0, z0],
        [x0, y1, z0],
        [x0, y1, z1],
        [x0, y0, z1],
      ],
      true,
      tone,
    );
    face(
      [
        [x1, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
      true,
      tone,
    );
  }

  // Shell and the fine inset skirting: no grid, plaster or filled window.
  face(
    [
      [-3.2, -2, 7],
      [3.2, -2, 7],
      [3.2, 1.4, 7],
      [-3.2, 1.4, 7],
    ],
    true,
    0.67,
  );
  for (const x of [-3.2, 3.2]) {
    line(
      [
        [x, -2, 0.7],
        [x, -2, 7],
      ],
      0.73,
    );
    line(
      [
        [x, 1.4, 0.7],
        [x, 1.4, 7],
      ],
      0.73,
    );
    line(
      [
        [x, 1.3, 0.7],
        [x, 1.3, 7],
      ],
      0.48,
      0.6,
    );
  }
  line(
    [
      [-3.2, 1.3, 7],
      [3.2, 1.3, 7],
    ],
    0.48,
    0.6,
  );

  // Back-wall media console, divided drawers, feet and a freestanding screen.
  box(-2.12, 1.25, 6.36, -2.04, 1.4, 6.65, 0.55);
  box(2.04, 1.25, 6.36, 2.12, 1.4, 6.65, 0.55);
  box(-2.27, 0.94, 6.16, 2.27, 1.28, 6.72);
  box(-2.32, 0.9, 6.1, 2.32, 0.96, 6.78, 0.9);
  line(
    [
      [-2.27, 1.1, 6.15],
      [2.27, 1.1, 6.15],
    ],
    0.58,
  );
  for (const x of [-1.03, 0.0, 1.03])
    line(
      [
        [x, 0.97, 6.15],
        [x, 1.27, 6.15],
      ],
      0.55,
    );
  screen = true;
  box(-0.13, 0.68, 6.47, 0.13, 0.9, 6.55, 0.65);
  box(-0.58, 0.88, 6.36, 0.58, 0.9, 6.65, 0.65);
  box(-1.42, -0.68, 6.5, 1.42, 0.7, 6.57, 0.88);
  face(
    [
      [-1.38, -0.64, 6.49],
      [1.38, -0.64, 6.49],
      [1.38, 0.66, 6.49],
      [-1.38, 0.66, 6.49],
    ],
    true,
    0.37,
    0.55,
  );

  screen = false;

  // Three-seat sofa along the left wall. Separate cushions make the scale
  // readable without adding a dense low-poly mesh or decorative hatching.
  box(-3.08, 0.65, 2.78, -1.7, 1.22, 5.98, 0.8);
  box(-3.09, -0.05, 2.8, -2.83, 0.76, 5.98, 0.9);
  for (let i = 0; i < 3; i++) {
    const z = 2.96 + i * 0.94;
    box(-2.79, 0.58, z, -1.69, 0.71, z + 0.88, 0.76);
    // Slightly reclined, tailored back cushions.
    face(
      [
        [-2.84, 0.57, z],
        [-2.84, 0.57, z + 0.88],
        [-2.96, 0.02, z + 0.88],
        [-2.96, 0.02, z],
      ],
      true,
      0.71,
    );
  }
  box(-3.08, 0.35, 5.8, -1.6, 0.93, 6.03, 0.87);
  box(-3.08, 0.35, 2.64, -1.6, 1.22, 2.89, 0.87);
  line(
    [
      [-2.89, 1.22, 2.76],
      [-2.89, 1.4, 2.76],
    ],
    0.58,
  );
  line(
    [
      [-1.79, 1.22, 2.76],
      [-1.79, 1.4, 2.76],
    ],
    0.58,
  );

  // Low square table: fine double edge and recessed legs.
  for (const x of [-0.92, 0.92]) {
    for (const z of [2.87, 4.5]) box(x - 0.025, 1.14, z, x + 0.025, 1.4, z + 0.055, 0.56);
  }
  box(-1.08, 1.03, 2.72, 1.08, 1.15, 4.68, 0.9);

  // Right-hand chaise, with a rounded upholstered nose, not a stack of cubes.
  shiftX = 0.32;
  const arc: Point[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (Math.PI * i) / 24;
    arc.push([2.34 + Math.cos(a) * 0.72, 0.73, 2.97 - Math.sin(a) * 0.55]);
  }
  const outline: Point[] = [[1.62, 0.73, 5.18], [3.06, 0.73, 5.18], ...arc];
  const lower = outline.map(([x, , z]): Point => [x, 1.23, z]);
  // One continuous skirt avoids unnecessary vertical tessellation lines.
  face([...arc, ...arc.map(([x, , z]): Point => [x, 1.23, z]).reverse()], true, 0.8);
  face([outline[0], outline[outline.length - 1], lower[lower.length - 1], lower[0]], true, 0.8);
  face([outline[1], outline[2], lower[2], lower[1]], true, 0.8);
  face(outline, true, 0.86);
  box(1.59, 0.0, 5.04, 3.09, 0.76, 5.34, 0.86);
  face(
    [
      [1.72, 0.7, 4.65],
      [2.97, 0.7, 4.65],
      [2.97, 0.17, 5.02],
      [1.72, 0.17, 5.02],
    ],
    true,
    0.7,
  );

  shiftX = 0;

  // Framed drawings on the side walls; every pane stays completely black.
  function wallFrame(x: number, top: number, bottom: number, near: number, far: number) {
    const insetX = x > 0 ? x - 0.013 : x + 0.013;
    face(
      [
        [x, top, near],
        [x, top, far],
        [x, bottom, far],
        [x, bottom, near],
      ],
      true,
      0.83,
    );
    face(
      [
        [insetX, top + 0.07, near + 0.07],
        [insetX, top + 0.07, far - 0.07],
        [insetX, bottom - 0.07, far - 0.07],
        [insetX, bottom - 0.07, near + 0.07],
      ],
      true,
      0.57,
      0.6,
    );
  }
  for (let i = 0; i < 3; i++) wallFrame(-3.195, -1.65 + i * 0.66, -1.09 + i * 0.66, 3.9, 4.75);
  wallFrame(3.195, -1.12, 0.04, 5.42, 6.6);
  wallFrame(-3.19, -1.58, 0.12, 5.4, 6.74);
  line(
    [
      [-3.17, -0.73, 5.47],
      [-3.17, -0.73, 6.67],
    ],
    0.53,
  );
  line(
    [
      [-3.17, -1.51, 6.07],
      [-3.17, 0.05, 6.07],
    ],
    0.53,
  );

  // Two sculptural vessels and a few spare stems. Curves are sampled only
  // once; no particles, opacity clouds or animated ambience masquerading as geometry.
  function vase(cx: number, cz: number, size: number) {
    const profile = [
      [0.1, 0],
      [0.11, 0.08],
      [0.1, 0.17],
      [0.23, 0.26],
      [0.28, 0.46],
      [0.24, 0.66],
      [0.15, 0.78],
    ];
    const side = profile.map(([r, y]): Point => [cx - r * size, 1.4 - (0.78 - y) * size, cz]);
    const other = profile
      .map(([r, y]): Point => [cx + r * size, 1.4 - (0.78 - y) * size, cz])
      .reverse();
    face([...side, ...other], true, 0.71, 0.7);
    line(
      [
        [cx - 0.1 * size, 1.4 - 0.78 * size, cz],
        [cx + 0.1 * size, 1.4 - 0.78 * size, cz],
      ],
      0.54,
      0.55,
    );
  }
  vase(1.99, 5.8, 1.13);
  vase(1.66, 5.62, 0.83);
  for (let i = 0; i < 7; i++) {
    const stem: Point[] = [];
    for (let j = 0; j <= 16; j++) {
      const t = j / 16;
      stem.push([
        1.99 + Math.sin(t * 7 + i * 1.8) * 0.085 * t + (i - 3) * 0.04 * t,
        0.57 - t * (1.02 + (i % 3) * 0.18),
        5.79 + (i % 2) * 0.03,
      ]);
    }
    line(stem, 0.59, 0.6);
  }
  return faces;
}

const drawing = roomDrawing().sort(
  (a, b) =>
    b.points.reduce((sum, p) => sum + p[2], 0) / b.points.length -
    a.points.reduce((sum, p) => sum + p[2], 0) / a.points.length,
);

/** Draw only when the camera/viewport changes; smoke keeps its own GPU field. */
export function drawContourRoom(
  ctx: OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  look: LookState,
  dpr: number,
) {
  // A narrower furnished room on a phone, rather than cropping away both sofas.
  const camera = roomCamera(w, h, { ...look, roomStyle: "geometry" });
  const { spread, focal } = camera;
  const sx = spread * (look.roomW / 0.9);
  const sy = look.roomH / 0.62;
  const sz = look.roomDepth / 5;
  const cameraX = camera.x;
  const cameraY = camera.y;
  const centerY = camera.centerY;
  const project = ([x, y, z]: Point): [number, number] => [
    w * look.roomX + ((x * sx - cameraX) * h * focal) / (z * sz),
    h * centerY + ((y * sy - cameraY) * h * focal) / (z * sz),
  ];
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const face of drawing) {
    // Preserve the screen's landscape ratio when the room narrows on phones.
    const points = face.points.map(([x, y, z]) =>
      project([x, face.screen ? 0.9 + (y - 0.9) * spread : y, z]),
    );
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    if (face.fill) {
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = `rgba(255,255,255,${face.tone})`;
    ctx.lineWidth = face.width;
    ctx.stroke();
  }
}

export function createContourRoom(gpu: Gpu) {
  let map: Texture | null = null;
  let canvas: OffscreenCanvas | null = null;
  let previous = "";
  return {
    update(w: number, h: number, dpr: number, look: LookState) {
      const width = Math.max(1, Math.round(w * dpr));
      const height = Math.max(1, Math.round(h * dpr));
      const key = [
        w,
        h,
        dpr,
        width,
        height,
        look.roomX,
        look.roomY,
        look.roomW,
        look.roomH,
        look.roomDepth,
        look.parallaxX,
        look.parallaxY,
      ].join(",");
      if (key === previous && map) return map;
      if (!canvas || canvas.width !== width || canvas.height !== height) {
        map?.destroy();
        canvas = new OffscreenCanvas(width, height);
        map = texture(gpu, {
          kind: "2d",
          size: [width, height],
          format: "rgba8unorm",
          usage: ["texture_binding", "copy_dst", "render_attachment"],
          label: "contour-room",
        });
      }
      drawContourRoom(canvas.getContext("2d")!, w, h, look, dpr);
      gpu.gpu.queue.copyExternalImageToTexture({ source: canvas }, { texture: map!.gpu }, [
        width,
        height,
      ]);
      previous = key;
      return map!;
    },
    dispose() {
      map?.destroy();
      map = null;
      canvas = null;
      previous = "";
    },
  };
}
