// Headless real-GPU evidence. Full-field readback appears only in this test,
// where it proves that a parked playground is byte-for-byte untouched.
import assert from "node:assert/strict";
import { readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { effect, init, storage, target as renderTarget } from "vgpu/node";
import { loadSessionModules } from "./session-test-loader.mjs";

const gpu = await init();
const errors = [];
gpu.onError((error) => errors.push(error.message));
try {
  const dir = new URL("../src/game/wgsl/", import.meta.url);
  const shaders = new Map();
  for (const file of readdirSync(dir).filter(
    (name) => name.endsWith(".wgsl") && name !== "common.wgsl",
  )) {
    const url = new URL(file, dir);
    shaders.set(url.href, (await resolveShader({ entry: url.pathname, validate: false })).wgsl);
  }
  loadSessionModules(new Map(), shaders);
  const { SmokeProbe } = await import("../src/game/smoke-probe.ts");
  const { Renderer } = await import("../src/game/renderer.ts");
  const { createFluid, stepFluid } = await import("../src/game/fluid.ts");
  const { createWorld } = await import("../src/game/sim.ts");
  const { createChallengeSetup } = await import("../src/game/challenges.ts");

  const width = 320,
    height = 200,
    dyeW = 32,
    dyeH = 20;
  const world = createWorld(width, height);
  const target = { x: 160, y: 100, r: 55, visibleOpacity: 0.02 };
  const dye = storage(gpu, dyeW * dyeH * 16, "read-write");
  const probe = new SmokeProbe(gpu);
  const fixture = { dyeW, dyeH, dye: { read: dye } };
  const uniform = (value) =>
    Float32Array.from({ length: dyeW * dyeH * 4 }, (_, i) => (i % 4 === 3 ? 0 : value));
  const cases = [
    ["empty", uniform(0)],
    ["invisible-density", uniform(0.021)],
    ["visible-density", uniform(0.06)],
    ["dense", uniform(0.2)],
    [
      "spatial-max-channel",
      Float32Array.from({ length: dyeW * dyeH * 4 }, (_, i) => {
        const x = Math.floor(i / 4) % dyeW,
          y = Math.floor(i / 4 / dyeW);
        return i % 4 === 1 && x > 14 && x < 22 && y > 4 && y < 15 ? 0.16 : 0;
      }),
    ],
    [
      "square-corners-outside-circle",
      Float32Array.from({ length: dyeW * dyeH * 4 }, (_, i) => {
        const x = (((Math.floor(i / 4) % dyeW) + 0.5) * width) / dyeW;
        const y = ((Math.floor(i / 4 / dyeW) + 0.5) * height) / dyeH;
        return i % 4 === 0 && Math.abs(x - target.x) > 48 && Math.abs(y - target.y) > 48 ? 1 : 0;
      }),
    ],
  ];
  const measurements = [];
  for (const [name, data] of cases) {
    dye.write(data);
    const sample = await new Promise((resolve, reject) => {
      probe.configure({
        target,
        onSample: resolve,
        onError: (message) => reject(new Error(message)),
      });
      probe.sample(fixture, world);
    });
    // onSample runs before finally releases the one-in-flight gate.
    await new Promise((resolve) => setImmediate(resolve));
    const expected = reference(data, dyeW, dyeH, world, target);
    assert.ok(
      Math.abs(sample.fill - expected.fill) < 2e-5,
      `${name}: fill ${sample.fill} != ${expected.fill}`,
    );
    assert.ok(Math.abs(sample.coverage - expected.coverage) < 1e-6, `${name}: coverage`);
    if (
      name === "empty" ||
      name === "invisible-density" ||
      name === "square-corners-outside-circle"
    )
      assert.equal(sample.fill, 0);
    measurements.push({ name, fill: sample.fill, coverage: sample.coverage });
  }
  probe.dispose();
  dye.destroy();
  const overhead = await benchmarkProbe(gpu, SmokeProbe, createWorld);

  const original = createFluid(gpu, width, height, true);
  original.velocity.swap();
  original.pressure.swap();
  original.seeded.add(481);
  const buffers = [
    original.velocity.read,
    original.velocity.write,
    original.dye.read,
    original.dye.write,
    original.pressure.read,
    original.pressure.write,
    original.divergence,
    original.curl,
    original.obst,
  ];
  for (const [i, buffer] of buffers.entries())
    buffer.write(new Float32Array(buffer.size / 4).fill((i + 1) / 100));
  const hash = async () => {
    const hash = createHash("sha256");
    for (const buffer of buffers) hash.update(new Uint8Array(await buffer.read()));
    return hash.digest("hex");
  };
  const before = await hash();
  const surface = {
    size: [width, height],
    resize(size) {
      this.size = size;
    },
  };
  const noop = { dispose() {} };
  const renderer = new Renderer(gpu, surface, original, {}, {}, {}, noop, noop, noop);
  const setup = createChallengeSetup("draft", width, height, world.params, world.look, true);
  const config = {
    target,
    onSample() {},
    onError(message) {
      throw new Error(message);
    },
  };
  assert.equal(renderer.enterSession(setup.world, config), true);
  const first = renderer.fluid;
  assert.notEqual(first, original);
  for (let i = 0; i < 4; i++) stepFluid(first, setup.world, 1 / 60);
  renderer.resize(390, 844, 2);
  assert.equal(await hash(), before);
  assert.equal(renderer.replaceSession(setup.world, config), true);
  assert.equal(renderer.fluid, first, "retry reuses its sole challenge allocation and passes");
  for (const buffer of [
    first.velocity.read,
    first.velocity.write,
    first.dye.read,
    first.dye.write,
    first.pressure.read,
    first.pressure.write,
    first.divergence,
    first.curl,
    first.obst,
  ]) {
    assert.ok(
      new Float32Array(await buffer.read()).every((value) => value === 0),
      "retry clears both ping-pong halves and all scratch fields",
    );
  }
  stepFluid(renderer.fluid, setup.world, 1 / 60);
  renderer.restoreSession();
  assert.equal(renderer.fluid, original);
  assert.equal(renderer.fluid.velocity.read, buffers[0]);
  assert.equal(renderer.fluid.pressure.read, buffers[4]);
  assert.deepEqual([...renderer.fluid.seeded], [481]);
  const after = await hash();
  assert.equal(after, before);
  // Exercise the actual draw hook after return. The minimal presentation pass
  // keeps this focused on dispatch behavior rather than background assets.
  const image = renderTarget(gpu, { size: [width, height], format: "rgba8unorm" });
  const presentation = effect(
    gpu,
    "@fragment fn main(@location(0) uv: vec2f) -> @location(0) vec4f { return vec4f(uv, 0.0, 1.0); }",
  );
  await presentation.compile({ colors: ["rgba8unorm"] });
  presentation.set = () => presentation;
  renderer.surface = image;
  renderer.composite = presentation;
  renderer.particles = storage(gpu, 48 * 32, "read");
  renderer.materials = { ...noop, bindings: {}, selectStyle() {} };
  world.look.room = false;
  world.reducedMotion = true;
  let ordinaryProbeCalls = 0;
  renderer.probe.sample = () => {
    ordinaryProbeCalls++;
  };
  renderer.draw(world, 0, 1 / 60);
  renderer.draw(world, 0, 1 / 60);
  assert.equal(ordinaryProbeCalls, 0, "returned playground must not even call the probe");
  await gpu.settled();
  assert.deepEqual(errors, []);
  const receipt = {
    measuredAt: new Date().toISOString(),
    adapter: gpu.adapter,
    measurements,
    overhead,
    returnedPlayground: { drawCalls: 2, probeCalls: ordinaryProbeCalls },
    parked: {
      bytes: buffers.reduce((sum, buffer) => sum + buffer.size, 0),
      before,
      after,
      sameWorldFluidBuffersAndParity: true,
      resizeAndRetryPreserved: true,
    },
    gpuErrors: errors,
  };
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(receipt, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        ...receipt,
        overhead: {
          ...overhead,
          samples: `${overhead.samples.length} raw samples${process.argv[2] ? ` saved to ${process.argv[2]}` : "; pass an output path to retain them"}`,
        },
      },
      null,
      2,
    ),
  );
  renderer.dispose();
} finally {
  gpu.dispose();
}

async function benchmarkProbe(gpu, SmokeProbe, createWorld) {
  const dyeW = 1024,
    dyeH = 640;
  const world = createWorld(1200, 750);
  const data = new Float32Array(dyeW * dyeH * 4);
  for (let i = 0; i < data.length; i += 4) data.set([0.06, 0.06, 0.06, 0], i);
  const dye = storage(gpu, data.byteLength, "read-write");
  dye.write(data);
  const fieldHash = async () =>
    createHash("sha256")
      .update(new Uint8Array(await dye.read()))
      .digest("hex");
  const before = await fieldHash();
  const fluid = { dyeW, dyeH, dye: { read: dye } };
  const probe = new SmokeProbe(gpu);
  let dispatchCalls = 0,
    readCalls = 0,
    bytesRead = 0,
    readsInFlight = 0,
    maxReadsInFlight = 0;
  const dispatch = probe.pass.dispatch.bind(probe.pass);
  const read = probe.result.read.bind(probe.result);
  // Counting exists only in this diagnostic; the runtime class is unchanged.
  probe.pass.dispatch = (...args) => {
    dispatchCalls++;
    return dispatch(...args);
  };
  probe.result.read = () => {
    readCalls++;
    bytesRead += probe.result.size;
    readsInFlight++;
    maxReadsInFlight = Math.max(maxReadsInFlight, readsInFlight);
    return read().finally(() => {
      readsInFlight--;
    });
  };
  let done, failed;
  probe.configure({
    target: { x: 600, y: 375, r: 33.75, visibleOpacity: 0.02 },
    onSample: (sample) => done({ sample, ended: performance.now() }),
    onError: (message) => failed(new Error(message)),
  });
  const take = async () => {
    // Keep the normal 10Hz gate active. Our queue is idle before submission;
    // unrelated applications may still be using the machine's GPU.
    await new Promise((resolve) => setTimeout(resolve, 105));
    await gpu.gpu.queue.onSubmittedWorkDone();
    let started, hostEncodeMs;
    const result = await new Promise((resolve, reject) => {
      done = resolve;
      failed = reject;
      started = performance.now();
      probe.sample(fluid, world);
      hostEncodeMs = performance.now() - started;
    });
    const endToEndMs = result.ended - started;
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(Math.abs(result.sample.fill - 0.3205474) < 2e-5);
    assert.equal(result.sample.coverage, 1);
    return { hostEncodeMs, endToEndMs };
  };
  const warmupSamples = 10,
    measuredSamples = 100;
  for (let i = 0; i < warmupSamples; i++) await take();
  const samples = [];
  for (let i = 0; i < measuredSamples; i++) samples.push(await take());
  assert.equal(dispatchCalls, warmupSamples + measuredSamples);
  assert.equal(readCalls, warmupSamples + measuredSamples);
  assert.equal(maxReadsInFlight, 1);
  assert.equal(bytesRead, (warmupSamples + measuredSamples) * 16);
  const enabled = { dispatchCalls, readCalls, bytesRead, maxReadsInFlight };
  probe.configure(null);
  const disabledSampleCalls = 100;
  for (let i = 0; i < disabledSampleCalls; i++)
    probe.sample(fluid, world, performance.now() / 1000 + i);
  await gpu.gpu.queue.onSubmittedWorkDone();
  assert.equal(dispatchCalls, enabled.dispatchCalls);
  assert.equal(readCalls, enabled.readCalls);
  const after = await fieldHash();
  assert.equal(after, before);
  probe.dispose();
  dye.destroy();
  const stats = (key) => {
    const sorted = samples.map((sample) => sample[key]).sort((a, b) => a - b);
    const percentile = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
    return {
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      minMs: sorted[0],
      maxMs: sorted.at(-1),
    };
  };
  return {
    scope:
      "Headless probe only; no concurrent solver/render submissions on this GPU queue. Not whole-app FPS or a GPU timestamp measurement. Other applications were not controlled.",
    hostEncodeDefinition:
      "Synchronous SmokeProbe.sample() call: uniforms, compute submission, staging-copy submission and validation-scope setup, including diagnostic counters.",
    endToEndDefinition:
      "Same call start through onSample after 16-byte asynchronous readback and validation; includes host scheduling and GPU queue/readback latency.",
    percentileDefinition: "Nearest rank, warmup excluded",
    dyeSize: [dyeW, dyeH],
    dyeBytes: data.byteLength,
    warmupSamples,
    measuredSamples,
    minimumCadenceMs: 105,
    bytesPerSample: 16,
    hostEncode: stats("hostEncodeMs"),
    endToEnd: stats("endToEndMs"),
    enabled,
    disabled: {
      sampleCalls: disabledSampleCalls,
      dispatchCalls: dispatchCalls - enabled.dispatchCalls,
      readCalls: readCalls - enabled.readCalls,
      bytesRead: bytesRead - enabled.bytesRead,
    },
    unchangedDye: { before, after },
    samples,
  };
}

function reference(data, w, h, world, target) {
  const dye = (u, v) => {
    if (u < 0 || v < 0 || u > 1 || v > 1) return [0, 0, 0];
    const x = u * w - 0.5,
      y = v * h - 0.5;
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = x - ix,
      fy = y - iy;
    const fetch = (x, y, channel) =>
      data[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + channel];
    return [0, 1, 2].map(
      (channel) =>
        (fetch(ix, iy, channel) * (1 - fx) + fetch(ix + 1, iy, channel) * fx) * (1 - fy) +
        (fetch(ix, iy + 1, channel) * (1 - fx) + fetch(ix + 1, iy + 1, channel) * fx) * fy,
    );
  };
  const density = (u, v) => Math.max(...dye(u, v));
  let fill = 0,
    coverage = 0,
    count = 0;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5) / 8 - 1,
        dy = (y + 0.5) / 8 - 1;
      if (dx * dx + dy * dy > 1) continue;
      count++;
      const u = (target.x + dx * target.r) / world.w,
        v = (target.y + dy * target.r) / world.h;
      const d = density(u, v);
      if (d < 0.022) continue;
      const blur =
        (density(u + 1 / w, v) +
          density(u - 1 / w, v) +
          density(u, v + 1 / h) +
          density(u, v - 1 / h)) /
        4;
      const t = Math.max(0, Math.min(1, (d - 0.022) / (0.1 - 0.022)));
      const alpha = Math.min(
        0.48,
        (1 - Math.exp(-(d * 0.28 + blur * 0.72) * 1.15)) * t * t * (3 - 2 * t),
      );
      fill += Math.min(1, alpha / 0.1);
      coverage += alpha >= target.visibleOpacity ? 1 : 0;
    }
  return { fill: fill / count, coverage: coverage / count };
}
