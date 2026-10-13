import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export function loadSessionModules(stubs = new Map(), shaders = new Map()) {
  const root = new URL("../src/", import.meta.url);
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const stub =
        stubs.get(`${context.parentURL?.split("/").at(-1)}:${specifier}`) ?? stubs.get(specifier);
      if (stub)
        return {
          url: `data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`,
          shortCircuit: true,
        };
      if (specifier.startsWith(".") && context.parentURL?.startsWith(root.href)) {
        const path = new URL(specifier, context.parentURL);
        if (specifier.endsWith(".wgsl")) return { url: path.href, shortCircuit: true };
        for (const extension of [".ts", ".tsx"]) {
          const url = new URL(path.href + extension);
          if (existsSync(url)) return { url: url.href, shortCircuit: true };
        }
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(root.href) && url.endsWith(".wgsl"))
        return {
          format: "module",
          shortCircuit: true,
          source: `export default ${JSON.stringify(shaders.get(url) ?? readFileSync(fileURLToPath(url), "utf8"))};`,
        };
      if (url.startsWith(root.href) && /\.tsx?$/.test(url))
        return {
          format: "module",
          shortCircuit: true,
          source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
            fileName: fileURLToPath(url),
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
          }).outputText,
        };
      return nextLoad(url, context);
    },
  });
}
