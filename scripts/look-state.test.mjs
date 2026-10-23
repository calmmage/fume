import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../src/game/look.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { DEFAULT_LOOK, ROOM_STYLES, loadLook, saveLook } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

function storage(t, values = {}) {
  const store = new Map(Object.entries(values));
  const before = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  t.after(() => { globalThis.localStorage = before; });
  return store;
}

test("fresh and obsolete-style users start with smoke-only Empty and no grain", (t) => {
  storage(t, { "fume-look-v1": JSON.stringify({ roomStyle: "studio", grain: true, room: false }) });
  assert.deepEqual(loadLook(), DEFAULT_LOOK);
  assert.equal(loadLook().roomStyle, "empty");
  assert.equal(loadLook().grain, false);
  assert.equal(loadLook().room, true);
});

test("each new style persists without saving camera momentum or changing smoke settings", (t) => {
  const store = storage(t, { "fume-params-v1": "keep existing smoke" });
  for (const { id } of ROOM_STYLES) {
    saveLook({ ...DEFAULT_LOOK, roomStyle: id, parallaxX: 4, panVx: 3, dragging: true });
    assert.equal(loadLook().roomStyle, id);
    assert.equal(loadLook().parallaxX, 0);
    assert.equal(loadLook().panVx, 0);
    assert.equal(loadLook().dragging, false);
  }
  assert.equal(store.get("fume-params-v1"), "keep existing smoke");
});

test("corrupt and obsolete new-style preferences recover to valid defaults", (t) => {
  const store = storage(t, { "fume-look-v2": "corrupt" });
  assert.deepEqual(loadLook(), DEFAULT_LOOK);
  store.set("fume-look-v2", JSON.stringify({ roomStyle: "contours", roomDepth: 100, roomW: -10 }));
  assert.equal(loadLook().roomStyle, "empty");
  assert.equal(loadLook().roomDepth, 9);
  assert.equal(loadLook().roomW, 0.35);
});

test("partial style preferences keep default light while an explicit Off remains Off", (t) => {
  const store = storage(t, { "fume-look-v2": JSON.stringify({ roomStyle: "pixel" }) });
  assert.equal(loadLook().rays, DEFAULT_LOOK.rays);
  store.set("fume-look-v2", JSON.stringify({ roomStyle: "pixel", rays: "off" }));
  assert.equal(loadLook().rays, "off");
});
