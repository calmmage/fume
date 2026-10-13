import assert from "node:assert/strict";
import test from "node:test";
import { loadSessionModules } from "./session-test-loader.mjs";

loadSessionModules(
  new Map([
    [
      "vgpu",
      `
  export const compute = (...args) => globalThis.__probeTest.compute(...args);
  export const storage = (...args) => globalThis.__probeTest.storage(...args);
`,
    ],
  ]),
);
const { SmokeProbe } = await import("../src/game/smoke-probe.ts");

function fixture(creationFault = null) {
  const pending = [];
  let dispatches = 0;
  let allocated = 0;
  let destroyed = 0;
  const pass = {
    set() {
      return this;
    },
    dispatch() {
      dispatches++;
    },
  };
  globalThis.__probeTest = {
    compute: () => pass,
    storage: (_gpu, bytes) => {
      allocated += bytes;
      return {
        read: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
        destroy: () => {
          destroyed++;
        },
      };
    },
  };
  const scopes = [];
  const gpu = {
    device: { createBuffer() {} },
    gpu: {
      pushErrorScope(filter) {
        scopes.push(filter);
      },
      popErrorScope: async () => {
        const filter = scopes.pop();
        return filter === creationFault ? { message: `probe ${filter} failure` } : null;
      },
    },
  };
  const probe = new SmokeProbe(gpu);
  const world = { w: 1000, h: 700 };
  const fluid = {
    dyeW: 32,
    dyeH: 32,
    dye: {
      read: {
        read() {
          throw new Error("Full dye readback is forbidden");
        },
      },
    },
  };
  const samples = [],
    errors = [];
  const config = {
    target: { x: 300, y: 300, r: 30, visibleOpacity: 0.02 },
    onSample: (x) => samples.push(x),
    onError: (x) => errors.push(x),
  };
  probe.configure(config);
  const settle = async (index, values = [0.5, 0.6, 0.05, 208]) => {
    pending[index].resolve(new Float32Array(values).buffer);
    await new Promise((resolve) => setImmediate(resolve));
  };
  return {
    gpu,
    probe,
    world,
    fluid,
    samples,
    errors,
    config,
    pending,
    settle,
    stats: () => ({ dispatches, allocated, destroyed }),
  };
}

test("16-byte readback is throttled to 10Hz and never has two reads in flight", async () => {
  const f = fixture();
  f.probe.sample(f.fluid, f.world, 1);
  f.probe.sample(f.fluid, f.world, 1.2);
  assert.deepEqual(f.stats(), { dispatches: 1, allocated: 16, destroyed: 0 });
  await f.settle(0);
  f.probe.sample(f.fluid, f.world, 1.05);
  assert.equal(f.stats().dispatches, 1);
  f.probe.sample(f.fluid, f.world, 1.11);
  assert.equal(f.stats().dispatches, 2);
  await f.settle(1);
  assert.equal(f.samples.length, 2);
  f.probe.dispose();
});

test("a failed validation scope cannot reopen the gate while its buffer read is still pending", async () => {
  const f = fixture();
  f.gpu.gpu.popErrorScope = async () => {
    throw new Error("scope failed");
  };
  f.probe.sample(f.fluid, f.world, 1);
  await new Promise((resolve) => setImmediate(resolve));
  f.probe.configure(f.config);
  f.probe.sample(f.fluid, f.world, 2);
  assert.equal(f.stats().dispatches, 1);
  await f.settle(0);
  f.gpu.gpu.popErrorScope = async () => null;
  f.probe.sample(f.fluid, f.world, 3);
  await f.settle(1);
  assert.equal(f.samples.length, 1);
  assert.equal(f.errors.length, 0);
  f.probe.dispose();
});

test("changing attempt tokens discards old results and errors without overlapping the GPU read", async () => {
  const f = fixture();
  f.probe.sample(f.fluid, f.world, 1);
  f.probe.configure(f.config);
  f.probe.sample(f.fluid, f.world, 2);
  assert.equal(f.stats().dispatches, 1);
  await f.settle(0);
  assert.equal(f.samples.length, 0);
  f.probe.sample(f.fluid, f.world, 2.1);
  await f.settle(1);
  assert.equal(f.samples.length, 1);
  f.probe.sample(f.fluid, f.world, 3);
  f.probe.configure(null);
  f.pending[2].reject(new Error("retired read"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.errors.length, 0);
  f.probe.dispose();
});

test("readback failure disables measurement safely and can be retried; disposal ignores pending completion", async () => {
  const f = fixture();
  f.probe.sample(f.fluid, f.world, 1);
  f.pending[0].reject(new Error("device failed"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.errors, ["device failed"]);
  f.probe.sample(f.fluid, f.world, 2);
  assert.equal(f.stats().dispatches, 1);
  f.probe.configure(f.config);
  f.probe.sample(f.fluid, f.world, 3);
  f.probe.dispose();
  f.probe.dispose();
  await f.settle(1);
  assert.equal(f.samples.length, 0);
  assert.equal(f.stats().destroyed, 1);
});

test("constructor validation, OOM and internal failures report without waiting for a sample", async () => {
  for (const filter of ["validation", "out-of-memory", "internal"]) {
    const f = fixture(filter);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(f.errors, [`probe ${filter} failure`]);
    f.probe.sample(f.fluid, f.world, 1);
    assert.equal(f.stats().dispatches, 0);
    assert.equal(f.pending.length, 0);
    f.probe.dispose();
  }
});
