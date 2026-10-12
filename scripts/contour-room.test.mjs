import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "vgpu") return {
      shortCircuit: true,
      url: "data:text/javascript,export const texture=(_gpu,options)=>({gpu:{},options,destroyed:false,destroy(){this.destroyed=true}})",
    };
    return next(specifier, context);
  },
});
const source = ts.transpileModule(readFileSync(new URL("../src/game/contour-room.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { createContourRoom } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const look = { roomX: 0.5, roomY: 0.5, roomW: 0.9, roomH: 0.62, roomDepth: 5, parallaxX: 0, parallaxY: 0 };

function fixture(t) {
  let uploads = 0;
  const original = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {} }; }
  };
  const room = createContourRoom({ gpu: { queue: { copyExternalImageToTexture() { uploads++; } } } });
  t.after(() => { room.dispose(); globalThis.OffscreenCanvas = original; });
  return { room, uploads: () => uploads };
}

test("a stationary room reuses one GPU image across smoke frames and unrelated look changes", (t) => {
  const f = fixture(t);
  const first = f.room.update(1440, 900, 2, look);
  for (let frame = 0; frame < 600; frame++) {
    assert.equal(f.room.update(1440, 900, 2, { ...look, dust: frame % 2 === 0 }), first);
  }
  assert.equal(f.uploads(), 1);
  assert.equal(f.room.update(1440, 900, 2, { ...look, parallaxX: 0.2 }), first);
  assert.equal(f.uploads(), 2, "camera changes redraw the same texture");
});

test("resize releases the old GPU image; returning from portrait rebuilds at the right size", (t) => {
  const f = fixture(t);
  const wide = f.room.update(1440, 900, 1, look);
  const phone = f.room.update(390, 844, 2, look);
  assert.equal(wide.destroyed, true);
  assert.deepEqual(phone.options.size, [780, 1688]);
  assert.equal(f.uploads(), 2);
  const wideAgain = f.room.update(1440, 900, 1, look);
  assert.equal(phone.destroyed, true);
  assert.deepEqual(wideAgain.options.size, [1440, 900]);
  f.room.dispose();
  assert.equal(wideAgain.destroyed, true);
});
