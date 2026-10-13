// Static layout proof of the actual recovery component; no application state
// injection or simulated GPU completion. Run after production compilation.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const path = specifier.startsWith("@/") ? new URL(specifier.slice(2), source)
      : specifier.startsWith(".") && context.parentURL?.startsWith(source.href)
        ? new URL(specifier, context.parentURL) : null;
    if (path) for (const ext of [".ts", ".tsx"]) {
      try { readFileSync(new URL(path.href + ext)); return { url: path.href + ext, shortCircuit: true }; }
      catch { /* try the other source extension */ }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(source.href) && /\.tsx?$/.test(url)) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        fileName: new URL(url).pathname,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    };
    return next(url, context);
  },
});
const { SessionNotice } = await import("../src/components/fume-app.tsx");
const notice = "The challenge could not open. There was not enough graphics memory. Your playground is still here, including its smoke. Try again or continue playing.";
const markup = renderToStaticMarkup(createElement(SessionNotice, { notice, onDismiss() {} }));
const assets = new URL("../.vercel/output/static/assets/", import.meta.url);
const stylesheet = readdirSync(assets).find(name => /^styles-.*\.css$/.test(name));
if (!stylesheet) throw new Error("Compile the production stylesheet first.");
const css = readFileSync(new URL(stylesheet, assets), "utf8");
const out = resolve(process.argv[2] ?? "/private/tmp/fume-notice-proof");
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FUME recovery notice — controlled layout proof</title><style>${css}</style><main style="height:100dvh;position:relative">${markup}<p style="position:absolute;bottom:2rem;left:1rem;right:1rem;font:12px/1.6 system-ui;color:#aaa">Controlled layout proof using the actual FUME component and production CSS. GPU rollback is tested separately; this page does not contain a live simulation. Dismiss behavior is covered by the component test.</p></main></html>`);
console.log(resolve(out, "index.html"));
