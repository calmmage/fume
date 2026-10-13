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
const nativeErrors = [];
gpu.gpu.addEventListener("uncapturederror", (event) => {
  nativeErrors.push(event.error.message);
  event.preventDefault();
});
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
  const probeFailureSafety = await checkProbeSafety(gpu, SmokeProbe, world, target);
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
  await readySession(renderer, setup.world);
  for (let i = 0; i < 4; i++) stepFluid(first, setup.world, 1 / 60);
  renderer.resize(390, 844, 2);
  assert.equal(await hash(), before);
  assert.equal(renderer.replaceSession(setup.world, config), true);
  assert.equal(renderer.fluid, first, "retry reuses its sole challenge allocation and passes");
  await waitFor(() => renderer.pendingSession?.phase === "first-use", "retry allocation checks");
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
  await readySession(renderer, setup.world);
  stepFluid(renderer.fluid, setup.world, 1 / 60);
  renderer.restoreSession();
  assert.equal(renderer.fluid, original);
  assert.equal(renderer.fluid.velocity.read, buffers[0]);
  assert.equal(renderer.fluid.pressure.read, buffers[4]);
  assert.deepEqual([...renderer.fluid.seeded], [481]);
  const after = await hash();
  assert.equal(after, before);
  const allocationSafety = await checkAllocationSafety({
    gpu,
    renderer,
    setup,
    config,
    original,
    buffers,
    hash,
  });
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
  for (const check of allocationSafety.dispatchChecks) check();
  await gpu.settled();
  assert.deepEqual(errors, []);
  assert.deepEqual(nativeErrors, []);
  const receipt = {
    measuredAt: new Date().toISOString(),
    adapter: gpu.adapter,
    measurements,
    overhead,
    allocationSafety: allocationSafety.receipt,
    probeFailureSafety,
    returnedPlayground: { drawCalls: 2, probeCalls: ordinaryProbeCalls },
    parked: {
      bytes: buffers.reduce((sum, buffer) => sum + buffer.size, 0),
      before,
      after,
      sameWorldFluidBuffersAndParity: true,
      resizeAndRetryPreserved: true,
    },
    gpuErrors: errors,
    nativeGpuErrors: nativeErrors,
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

async function waitFor(check, label) {
  const deadline = performance.now() + 10000;
  while (!check()) {
    assert.ok(performance.now() < deadline, `Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function readySession(renderer, world) {
  await waitFor(() => renderer.pendingSession?.phase !== "allocating", "allocation validation");
  if (renderer.pendingSession?.phase === "first-use") renderer.draw(world, 0, 1 / 60);
  await waitFor(() => renderer.pendingSession === null, "first-use validation");
  assert.ok(renderer.parkedFluid, "successful validation must retain the parked field");
}

async function checkAllocationSafety({ gpu, renderer, setup, config, original, buffers, hash }) {
  const native = gpu.gpu;
  const receipt = [];
  const dispatchChecks = [];
  for (const mode of [
    "native-invalid-buffer",
    "injected-oom-result",
    "native-invalid-first-use-buffer",
    "partial-synchronous-failure",
  ]) {
    const before = await hash();
    const failures = [];
    const handles = [];
    const originalCreate = native.createBuffer;
    const originalPush = native.pushErrorScope;
    const originalPop = native.popErrorScope;
    const scopes = [];
    let injected = false,
      creations = 0;
    function injectInvalidBuffer() {
      native.createBuffer = function (descriptor) {
        creations++;
        if (mode === "partial-synchronous-failure" && creations === 4)
          throw new Error("Injected synchronous allocation failure after three buffers");
        if (!injected && mode !== "partial-synchronous-failure") {
          injected = true;
          // 16 bytes, deliberately invalid MAP_READ|STORAGE usage. This tests
          // native asynchronous validation without exhausting memory.
          return originalCreate.call(this, { ...descriptor, size: 16, usage: 1 | 128 });
        }
        return originalCreate.call(this, descriptor);
      };
    }
    const createCore = gpu.device.createBuffer;
    gpu.device.createBuffer = function (options) {
      const buffer = createCore.call(this, options);
      handles.push(buffer);
      return buffer;
    };
    const onFailure = (message) => {
      assert.equal(renderer.fluid, original, "restore must precede failure callback");
      failures.push(message);
    };
    let candidate;
    let dispatches = 0;
    try {
      if (mode === "native-invalid-buffer" || mode === "partial-synchronous-failure")
        injectInvalidBuffer();
      if (mode === "injected-oom-result") {
        native.pushErrorScope = function (filter) {
          scopes.push(filter);
          return originalPush.call(this, filter);
        };
        native.popErrorScope = function () {
          const filter = scopes.pop();
          const actual = originalPop.call(this);
          return filter === "out-of-memory"
            ? actual.then(
                (error) =>
                  error ?? { message: "Injected GPUOutOfMemoryError: candidate allocation failed" },
              )
            : actual;
        };
      }
      const entered = renderer.enterSession(setup.world, config, onFailure);
      assert.equal(entered, mode !== "partial-synchronous-failure");
      candidate = entered ? renderer.fluid : null;
      if (candidate) {
        for (const pass of Object.values(candidate.passes)) {
          const dispatch = pass.dispatch;
          pass.dispatch = function (...args) {
            dispatches++;
            return dispatch.apply(this, args);
          };
        }
        renderer.draw(setup.world, 0, 1 / 60);
        assert.equal(dispatches, 0, "pending allocation cannot dispatch");
      }
      native.createBuffer = originalCreate;
      native.pushErrorScope = originalPush;
      native.popErrorScope = originalPop;
      if (mode === "native-invalid-first-use-buffer") {
        await waitFor(
          () => renderer.pendingSession?.phase === "first-use",
          "first-use fault setup",
        );
        injectInvalidBuffer();
        renderer.draw(setup.world, 0, 1 / 60);
        native.createBuffer = originalCreate;
      }
      await waitFor(() => failures.length === 1, `${mode} rollback`);
      assert.equal(renderer.fluid, original);
      assert.equal(renderer.fluid.velocity.read, buffers[0]);
      assert.equal(renderer.fluid.pressure.read, buffers[4]);
      assert.deepEqual([...renderer.fluid.seeded], [481]);
      assert.equal(renderer.pendingSession, null);
      assert.equal(renderer.probeSession, null);
      assert.ok(
        handles.length > 0 && handles.every((buffer) => buffer.destroyed),
        "all partial and lazy candidate allocations must be released",
      );
      const after = await hash();
      assert.equal(after, before, "rollback must preserve every original byte before resumed step");
      const dispatchedAtRollback = dispatches;
      dispatchChecks.push(() =>
        assert.equal(
          dispatches,
          dispatchedAtRollback,
          "failed candidate must never dispatch after rollback",
        ),
      );
      receipt.push({
        fault: mode,
        nativeValidation: mode.startsWith("native-"),
        hardwareMemoryExhaustion: false,
        error: failures[0],
        buffersReleased: handles.length,
        candidateDispatchesBeforeRollback: dispatches,
        candidateDispatchesAfterRollback: 0,
        ownerHashBefore: before,
        ownerHashAfterRollback: after,
        originalBuffersParitySeededIdsPreserved: true,
      });
    } finally {
      native.createBuffer = originalCreate;
      native.pushErrorScope = originalPush;
      native.popErrorScope = originalPop;
      gpu.device.createBuffer = createCore;
      renderer.restoreSession();
    }
  }
  return { receipt, dispatchChecks };
}

async function checkProbeSafety(gpu, SmokeProbe, world, target) {
  const receipt = [];
  const native = gpu.gpu;
  const dye = storage(gpu, 32 * 20 * 16, "read-write");
  dye.write(new Float32Array(32 * 20 * 4).fill(0.1));
  const fluid = { dyeW: 32, dyeH: 20, dye: { read: dye } };
  for (const mode of [
    "native-invalid-probe-result",
    "native-invalid-probe-uniform",
    "injected-probe-oom",
  ]) {
    const originalCreate = native.createBuffer;
    const originalPush = native.pushErrorScope;
    const originalPop = native.popErrorScope;
    let probe;
    const failures = [],
      samples = [],
      scopes = [];
    let injected = false;
    const installInvalid = () => {
      native.createBuffer = function (descriptor) {
        if (!injected) {
          injected = true;
          return originalCreate.call(this, { ...descriptor, size: 16, usage: 1 | 128 });
        }
        return originalCreate.call(this, descriptor);
      };
    };
    try {
      if (mode === "native-invalid-probe-result") installInvalid();
      probe = new SmokeProbe(gpu);
      native.createBuffer = originalCreate;
      probe.configure({
        target,
        onSample: (sample) => samples.push(sample),
        onError: (error) => failures.push(error),
      });
      if (mode !== "native-invalid-probe-result") {
        // Let construction finish first; these faults exercise sample-time work.
        await new Promise((resolve) => setImmediate(resolve));
        if (mode === "native-invalid-probe-uniform") installInvalid();
        else {
          native.pushErrorScope = function (filter) {
            scopes.push(filter);
            return originalPush.call(this, filter);
          };
          native.popErrorScope = function () {
            const filter = scopes.pop();
            const actual = originalPop.call(this);
            return filter === "out-of-memory"
              ? actual.then((error) => error ?? { message: "Injected probe GPUOutOfMemoryError" })
              : actual;
          };
        }
        probe.sample(fluid, world, 1);
      }
      native.createBuffer = originalCreate;
      native.pushErrorScope = originalPush;
      native.popErrorScope = originalPop;
      await waitFor(() => failures.length === 1, mode);
      assert.deepEqual(samples, []);
      let dispatchAfterFailure = 0;
      probe.pass.dispatch = () => {
        dispatchAfterFailure++;
      };
      probe.sample(fluid, world, 2);
      assert.equal(dispatchAfterFailure, 0);
      receipt.push({
        fault: mode,
        error: failures[0],
        samples: 0,
        dispatchAfterFailure,
        hardwareMemoryExhaustion: false,
      });
    } finally {
      native.createBuffer = originalCreate;
      native.pushErrorScope = originalPush;
      native.popErrorScope = originalPop;
      probe?.dispose();
    }
  }
  dye.destroy();
  return receipt;
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
