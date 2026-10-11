import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ts from "typescript";

const srcRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), srcRoot)
      : specifier.startsWith(".") && context.parentURL?.startsWith(srcRoot.href)
        ? new URL(specifier, context.parentURL)
        : null;
    if (relative) {
      for (const extension of [".ts", ".tsx"]) {
        const url = new URL(relative.href + extension);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(srcRoot.href) && /\.tsx?$/.test(url)) {
      const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        fileName: fileURLToPath(url),
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { FumeApp } = await import("../src/components/fume-app.tsx");

test("first render is identical with server defaults and persisted browser settings", (t) => {
  const previous = globalThis.localStorage;
  t.after(() => { globalThis.localStorage = previous; });
  delete globalThis.localStorage;
  const server = renderToString(createElement(FumeApp));
  assert.match(server, /Background style: Geometry/);
  for (const roomStyle of ["pixel", "wood", "stone", "cosmos"]) {
    let reads = 0;
    const saved = new Map([
      ["fume-look-v2", JSON.stringify({ roomStyle, grain: true, rays: "off" })],
      ["fume-params-v8", JSON.stringify({ vorticity: 31, buoyancy: 49 })],
    ]);
    globalThis.localStorage = { getItem: (key) => { reads++; return saved.get(key) ?? null; } };
    const firstClientRender = renderToString(createElement(FumeApp));
    assert.equal(firstClientRender, server, `${roomStyle} must hydrate the server's initial markup`);
    assert.equal(reads, 0, "saved state is read after hydration, not during rendering");
  }
});
