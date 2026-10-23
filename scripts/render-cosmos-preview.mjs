import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { draw, frame, init, storage, target } from "vgpu/node";
import ts from "typescript";

// Render the actual GPU star field at 8K; no enlarged source bitmap is involved.
const source = ts.transpileModule(
  readFileSync(new URL("../src/game/cosmos-model.ts", import.meta.url), "utf8"),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  },
).outputText;
const { buildCosmosPoints, COSMOS_COUNT } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const width = Number(process.argv[3] || 7680);
const height = Number(process.argv[4] || 4320);
const output = process.argv[2] || "/private/tmp/fume-cosmos-8k.png";
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
  throw new Error("Invalid dimensions");

const gpu = await init({ requiredLimits: { maxTextureDimension2D: Math.max(width, height) } });
try {
  const shader = await resolveShader({ entry: "src/game/wgsl/cosmos.wgsl", validate: "require" });
  const image = target(gpu, {
    size: [width, height],
    format: "rgba8unorm",
    clearColor: [0.0003, 0.0005, 0.0014, 1],
  });
  const data = buildCosmosPoints();
  const stars = storage(gpu, data.byteLength, "read");
  stars.write(data);
  const pass = draw(gpu, {
    shader: shader.wgsl,
    vertices: 6,
    instances: COSMOS_COUNT,
    blend: "additive",
    set: {
      stars,
      view: { size: [width, height], camera: [0, 0], density: height / 900 },
    },
  });
  await pass.compile(image);
  frame(gpu, (f) => f.pass({ target: image, clear: true }, pass));
  const rgba = await image.color.read({ mipLevel: 0, region: "all" });
  writeFileSync(output, png(width, height, rgba));
  console.log(
    `${width}×${height}: ${COSMOS_COUNT} points rendered with the runtime WGSL shader → ${output}`,
  );
} finally {
  gpu.dispose();
}

// Minimal lossless PNG encoder avoids adding an image-package dependency.
function png(w, h, rgba) {
  const table = Uint32Array.from({ length: 256 }, (_, i) => {
    let n = i;
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const chunk = (kind, data) => {
    const body = Buffer.concat([Buffer.from(kind), data]);
    let crc = 0xffffffff;
    for (const byte of body) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    const result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0);
    body.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc((w * 4 + 1) * h);
  const pixels = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < h; y++) pixels.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
