import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";

const compile = (path) =>
  `data:text/javascript;base64,${Buffer.from(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText,
  ).toString("base64")}`;
const gpuModule = `data:text/javascript,${encodeURIComponent(`
  export const calls={writes:0,sets:0,resizes:0,destroys:0,camera:null};
  export const storage=()=>({write(){calls.writes++}});
  export const draw=()=>({set(values){calls.sets++;calls.camera=values.view.camera},async compile(){}});
  export const target=()=>({size:[1,1],color:{destroy(){calls.destroys++}},resize(size){this.size=size;calls.resizes++}});
`)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "vgpu") return { shortCircuit: true, url: gpuModule };
    if (specifier === "./cosmos-model")
      return { shortCircuit: true, url: compile("../src/game/cosmos-model.ts") };
    if (specifier.endsWith("cosmos.wgsl"))
      return { shortCircuit: true, url: "data:text/javascript,export default 'shader'" };
    return next(specifier, context);
  },
});
const { calls } = await import(gpuModule);
const { Cosmos } = await import(compile("../src/game/cosmos.ts"));

test("stationary Cosmos renders once; camera, pixel density and size invalidate the cache", async () => {
  const cosmos = new Cosmos({});
  await cosmos.compile();
  const view = { parallaxX: 0, parallaxY: 0 };
  let passes = 0;
  const frame = {
    pass() {
      passes++;
    },
  };
  for (let i = 0; i < 600; i++) {
    cosmos.update(1440, 900, 1, view);
    cosmos.render(frame);
  }
  assert.equal(passes, 1);
  assert.equal(calls.writes, 1, "star positions upload once");
  assert.equal(calls.resizes, 1);
  cosmos.update(1440, 900, 1, { parallaxX: 0.1, parallaxY: 0.2 });
  cosmos.render(frame);
  assert.equal(passes, 2);
  assert.equal(calls.resizes, 1, "panning reuses the texture");
  assert.ok(
    Math.abs(calls.camera[0] + 1.2) < 1e-10 && Math.abs(calls.camera[1] + 2.4) < 1e-10,
    "stars follow the same room-drag direction as smoke and placed tools",
  );
  cosmos.update(1440, 900, 2, view);
  cosmos.render(frame);
  assert.equal(passes, 3);
  cosmos.update(390, 844, 2, view);
  cosmos.render(frame);
  assert.equal(passes, 4);
  assert.equal(calls.resizes, 2);
  assert.equal(calls.writes, 1);
  cosmos.dispose();
  assert.equal(calls.destroys, 1);
});
