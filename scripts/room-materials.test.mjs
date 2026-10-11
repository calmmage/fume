import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "vgpu") {
      return { shortCircuit: true, url: "data:text/javascript,export const sampler=()=>({}); export const texture=(_gpu,options)=>({gpu:{},label:options.label,destroy(){}});" };
    }
    return next(specifier, context);
  },
});
const source = ts.transpileModule(readFileSync(new URL("../src/game/materials.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { loadRoomMaterials } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

function fixture(t, respond) {
  let now = 0;
  const requests = [];
  const previous = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas };
  Object.assign(globalThis, {
    fetch: async (url, options) => { requests.push(url); return respond(url, options); },
    createImageBitmap: async () => ({ width: 2, height: 2, close() {} }),
    OffscreenCanvas: class { getContext() { return { drawImage() {} }; } },
  });
  t.mock.method(performance, "now", () => now);
  t.mock.method(console, "warn", () => {});
  const materials = loadRoomMaterials({ gpu: { queue: { writeTexture() {}, copyExternalImageToTexture() {} } } });
  t.after(() => { materials.dispose(); Object.assign(globalThis, previous); });
  return { materials, requests, advance: (ms) => { now += ms; } };
}
const ok = () => ({ ok: true, blob: async () => ({}) });
const settle = () => new Promise(setImmediate);

test("Geometry stays network-free and failed environment maps retry with bounded requests", async (t) => {
  let attempts = 0;
  const { materials, requests, advance } = fixture(t, (url) => {
    if (url.includes("stone-room") && attempts++ === 0) return { ok: false, status: 503 };
    return ok();
  });
  materials.selectStyle("geometry");
  await settle();
  assert.equal(requests.length, 0);
  materials.selectStyle("stone");
  await settle();
  const neutral = materials.bindings.environmentMap;
  for (let i = 0; i < 120; i++) materials.selectStyle("stone");
  assert.equal(requests.length, 1, "render frames do not spam failed requests");
  advance(1001);
  materials.selectStyle("stone");
  assert.equal(materials.bindings.environmentMap, neutral, "neutral remains visible during retry");
  await settle();
  assert.notEqual(materials.bindings.environmentMap, neutral);
  assert.equal(materials.bindings.environmentMap.label, "/styles/stone-room.webp");
  assert.equal(requests.filter((url) => url.includes("stone-room")).length, 2);
  advance(100_000);
  materials.selectStyle("stone");
  await settle();
  assert.equal(requests.length, 2, "successful style stops retrying");
  const stone = materials.bindings.environmentMap;
  materials.selectStyle("geometry");
  materials.selectStyle("stone");
  await settle();
  assert.equal(materials.bindings.environmentMap, stone);
  assert.equal(requests.length, 2, "reselecting a successful style uses its cached texture");
});

test("reselecting a style retries a failed map immediately", async (t) => {
  let fail = true;
  const { materials, requests } = fixture(t, () => fail ? { ok: false, status: 404 } : ok());
  materials.selectStyle("cosmos");
  await settle();
  fail = false;
  materials.selectStyle("geometry");
  materials.selectStyle("cosmos");
  await settle();
  assert.equal(requests.length, 2);
  assert.equal(materials.bindings.environmentMap.label, "/styles/cosmos.webp");
});

test("persistent failure backs off, and old style results cannot overwrite the selected style", async (t) => {
  let finishStone;
  const { materials, requests, advance } = fixture(t, (url) => {
    if (url.includes("stone-room")) return new Promise((resolve) => { finishStone = resolve; });
    if (url.includes("cosmos")) return { ok: false, status: 503 };
    return ok();
  });
  materials.selectStyle("stone");
  materials.selectStyle("cosmos");
  finishStone(ok());
  await settle();
  assert.equal(materials.bindings.environmentMap.label, undefined);
  advance(1001);
  materials.selectStyle("cosmos");
  await settle();
  advance(1001);
  materials.selectStyle("cosmos");
  assert.equal(requests.filter((url) => url.includes("cosmos")).length, 2);
  advance(1000);
  materials.selectStyle("cosmos");
  await settle();
  assert.equal(requests.filter((url) => url.includes("cosmos")).length, 3);
  materials.dispose();
  advance(100_000);
  materials.selectStyle("cosmos");
  assert.equal(requests.filter((url) => url.includes("cosmos")).length, 3);
});
