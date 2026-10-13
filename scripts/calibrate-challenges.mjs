import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { init } from "vgpu/node";
import ts from "typescript";

// Diagnostic only: run the actual protected solver and inspect its dye in Node.
// Full reads here are offline evidence, never part of the application loop.
const shaderPaths = [...readFileSync(new URL("../src/game/fluid.ts", import.meta.url), "utf8").matchAll(/from "(\.\/wgsl\/[^\"]+)"/g)].map((match) => match[1]);
const shaderSources = new Map();
for (const path of shaderPaths) {
  const url = new URL(`../src/game/${path}`, import.meta.url);
  shaderSources.set(url.href, (await resolveShader({ entry: url.pathname, validate: "require" })).wgsl);
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "vgpu") return next("vgpu/node", context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      return next(new URL(specifier.endsWith(".wgsl") ? specifier : `${specifier}.ts`, context.parentURL).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (shaderSources.has(url)) return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(shaderSources.get(url))}` };
    if (url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});
const { createFluid, stepFluid, destroyFluid } = await import("../src/game/fluid.ts");
const { createChallengeSetup, emptyChallengeProgress, advanceChallengeProgress, TARGET_FILL, TARGET_COVERAGE } = await import("../src/game/challenges.ts");
const { DEFAULT_PARAMS } = await import("../src/game/params.ts");
const { DEFAULT_LOOK } = await import("../src/game/look.ts");
const { createGadget } = await import("../src/game/tools.ts");
const { stepWorld } = await import("../src/game/sim.ts");
const id = process.argv[2] ?? "draft";
const width = Number(process.argv[3] ?? 1200);
const height = Number(process.argv[4] ?? 750);
const seconds = Number(process.argv[5] ?? 24);
const configuration = process.argv[6] ? JSON.parse(process.argv[6]) : [];
const setup = createChallengeSetup(id, width, height, DEFAULT_PARAMS, DEFAULT_LOOK);
if (process.argv[7]) {
  const target = JSON.parse(process.argv[7]);
  setup.target = { x: target.x * width, y: target.y * height, r: target.r * Math.min(width, height) };
}
for (const item of configuration) {
  const gadget = createGadget(item.kind ?? "fan", width * item.x, height * item.y, false);
  gadget.angle = item.angle ?? 0;
  if (item.w) gadget.w = item.w;
  if (item.h) gadget.h = item.h;
  setup.world.gadgets.push(gadget);
}
const gpu = await init();
const errors = [];
gpu.onError((error) => errors.push(error.message));
const fluid = createFluid(gpu, width, height, false);
try {
  const started = performance.now();
  let maximumFill = 0;
  let maximumCoverage = 0;
  let consecutive = 0;
  let bestHold = 0;
  let wasPassing = false;
  let progress = emptyChallengeProgress();
  let completedAt = null;
  const observations = [];
  let lastDye;
  for (let tick = 1; tick <= seconds * 60; tick++) {
    stepWorld(setup.world, 1 / 60);
    stepFluid(fluid, setup.world, 1 / 60);
    if (tick % 6 !== 0) continue;
    const dye = new Float32Array(await fluid.dye.read.read());
    lastDye = dye;
    const sample = inspect(dye, fluid.dyeW, fluid.dyeH, setup.target, width, height);
    maximumFill = Math.max(maximumFill, sample.fill);
    maximumCoverage = Math.max(maximumCoverage, sample.coverage);
    const passing = sample.fill >= TARGET_FILL && sample.coverage >= TARGET_COVERAGE;
    consecutive = passing && wasPassing ? consecutive + 0.1 : 0;
    wasPassing = passing;
    bestHold = Math.max(bestHold, consecutive);
    progress = advanceChallengeProgress(progress, { ...sample, at: tick / 60 });
    if (progress.complete && completedAt === null) completedAt = tick / 60;
    if (tick % 120 === 0) observations.push({ at: tick / 60, ...sample });
  }
  const candidates = [];
  for (let y = 0.25; y <= 0.5; y += 0.025) for (let x = 0.4; x <= 0.8; x += 0.025) {
    const candidate = { x: x * width, y: y * height, r: Math.min(width, height) * 0.025 };
    candidates.push({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), ...inspect(lastDye, fluid.dyeW, fluid.dyeH, candidate, width, height) });
  }
  candidates.sort((a, b) => b.fill - a.fill);
  console.log(JSON.stringify({ id, width, height, seconds, configuration, target: setup.target, maximumFill, maximumCoverage, bestHold, completedAt,
    elapsedMs: Math.round(performance.now() - started), observations, bestTargets: candidates.slice(0, 6), errors }, null, 2));
} finally { destroyFluid(fluid); gpu.dispose(); }

function inspect(dye, gw, gh, target, width, height) {
  const density = (u, v) => {
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const x = u * gw - 0.5, y = v * gh - 0.5;
    const cx = Math.floor(x), cy = Math.floor(y), fx = x - cx, fy = y - cy;
    const rgb = (px, py, channel) => dye[(Math.max(0, Math.min(gh - 1, py)) * gw + Math.max(0, Math.min(gw - 1, px))) * 4 + channel];
    let value = 0;
    for (let channel = 0; channel < 3; channel++) {
      const a = rgb(cx, cy, channel) * (1 - fx) + rgb(cx + 1, cy, channel) * fx;
      const b = rgb(cx, cy + 1, channel) * (1 - fx) + rgb(cx + 1, cy + 1, channel) * fx;
      value = Math.max(value, a * (1 - fy) + b * fy);
    }
    return value;
  };
  let sum = 0, visible = 0, count = 0;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = ((x + 0.5) / 16) * 2 - 1, dy = ((y + 0.5) / 16) * 2 - 1;
    if (dx * dx + dy * dy > 1) continue;
    const u = (target.x + dx * target.r) / width, v = (target.y + dy * target.r) / height;
    const d = density(u, v);
    const blur = (density(u - 1 / gw, v) + density(u + 1 / gw, v) + density(u, v - 1 / gh) + density(u, v + 1 / gh)) / 4;
    const s = Math.max(0, Math.min(1, (d - 0.022) / (0.1 - 0.022)));
    const alpha = Math.max(0, Math.min(0.48, (1 - Math.exp(-1.15 * (d * 0.28 + blur * 0.72))) * s * s * (3 - 2 * s)));
    sum += Math.min(1, alpha / 0.10);
    visible += alpha >= 0.02 ? 1 : 0;
    count++;
  }
  return { fill: sum / count, coverage: visible / count };
}
