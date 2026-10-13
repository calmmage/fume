// Regenerate the Geometry picker illustration from the same authored scene.
// No browser, network service or screenshot of the reference is involved.
import { readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({ resolve(specifier, context, next) {
  if (specifier === "vgpu") return { shortCircuit: true, url: "data:text/javascript,export const texture=()=>{}" };
  return next(specifier, context);
} });
const source = ts.transpileModule(readFileSync(new URL("../src/game/contour-room.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { drawContourRoom } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const paths = [];
let path = "";
let filled = false;
const ctx = {
  setTransform() {}, fillRect() {},
  beginPath() { path = ""; filled = false; },
  moveTo(x,y) { path += `M${x.toFixed(2)},${y.toFixed(2)}`; },
  lineTo(x,y) { path += `L${x.toFixed(2)},${y.toFixed(2)}`; },
  closePath() { path += "Z"; },
  fill() { filled = true; },
  stroke() { paths.push(`<path d="${path}" fill="${filled ? "black" : "none"}" stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"/>`); },
};
drawContourRoom(ctx,480,270,{roomX:0.5,roomY:0.5,roomW:0.9,roomH:0.62,roomDepth:5,parallaxX:0,parallaxY:0},1);
writeFileSync(new URL("../public/styles/geometry.svg",import.meta.url),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270"><rect width="480" height="270" fill="black"/><g stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</g></svg>\n`);
console.log("Updated public/styles/geometry.svg from the live contour drawing.");
