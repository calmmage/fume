import assert from "node:assert/strict";
import test from "node:test";
import { loadSessionModules } from "./session-test-loader.mjs";

loadSessionModules(
  new Map([
    [
      "renderer.ts:./fluid",
      `
    export const createFluid = (...args) => globalThis.__sessionTest.create(...args);
    export const destroyFluid = f => { for (const b of f.buffers) b.destroy(); };
    export const stepFluid = (...args) => globalThis.__sessionTest.step(...args);
    export const ensureFluidSize = (_gpu, fluid) => fluid;
  `,
    ],
    [
      "renderer.ts:./smoke-probe",
      `
    export class SmokeProbe {
      constructor() { globalThis.__sessionTest.probes = (globalThis.__sessionTest.probes ?? 0) + 1; }
      configure(session) {
        this.session = session;
        const error = globalThis.__sessionTest.probeError;
        if (session && error) queueMicrotask(() => session.onError(error));
      }
      sample() { throw new Error("Probe must not run while pending"); }
      dispose() {}
    }
  `,
    ],
  ]),
);
const { Renderer } = await import("../src/game/renderer.ts");

const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture() {
  const scopes = [],
    checks = [],
    allocated = [],
    fluids = [];
  const gpu = {
    device: {
      createBuffer() {
        const buffer = {
          destroyed: false,
          size: 16,
          write() {},
          destroy() {
            this.destroyed = true;
          },
        };
        allocated.push(buffer);
        return buffer;
      },
    },
    gpu: {
      pushErrorScope(filter) {
        scopes.push(filter);
      },
      popErrorScope() {
        const filter = scopes.pop();
        return new Promise((resolve, reject) => checks.push({ filter, resolve, reject }));
      },
    },
    dispose() {
      this.disposed = true;
    },
  };
  globalThis.__sessionTest = {
    throwAt: -1,
    create() {
      const buffers = [];
      for (let i = 0; i < 9; i++) {
        if (i === this.throwAt) throw new Error("synchronous allocation failed");
        buffers.push(gpu.device.createBuffer({ size: 16 }));
      }
      const f = {
        buffers,
        steps: 0,
        seeded: new Set(),
        velocity: { read: buffers[0], write: buffers[1] },
        dye: { read: buffers[2], write: buffers[3] },
        pressure: { read: buffers[4], write: buffers[5] },
        divergence: buffers[6],
        curl: buffers[7],
        obst: buffers[8],
      };
      fluids.push(f);
      return f;
    },
    step(fluid) {
      fluid.steps++;
      if (!fluid.uniform) fluid.uniform = gpu.device.createBuffer({ size: 16 });
    },
  };
  const original = globalThis.__sessionTest.create();
  const noop = { dispose() {} };
  const renderer = new Renderer(gpu, { size: [320, 200] }, original, {}, {}, {}, noop, noop, noop);
  const errors = [];
  const config = { onError: (message) => errors.push(`probe: ${message}`) };
  const world = { w: 320, h: 200, reducedMotion: true };
  const onFailure = (message) => errors.push(message);
  async function settle(error = null, filter = "validation") {
    const batch = checks.splice(0);
    for (const check of batch) check.resolve(check.filter === filter ? error : null);
    await flush();
  }
  return {
    renderer,
    original,
    gpu,
    errors,
    config,
    world,
    onFailure,
    settle,
    checks,
    allocated,
    fluids,
  };
}

test("candidate dispatch/render/probe wait for allocation and first-use scope checks", async () => {
  const f = fixture();
  assert.equal(f.renderer.enterSession(f.world, f.config, f.onFailure), true);
  const candidate = f.renderer.fluid;
  f.renderer.draw(f.world, 0, 1 / 60);
  assert.equal(candidate.steps, 0);
  assert.equal(f.renderer.probe, null);
  await f.settle();
  f.renderer.draw(f.world, 0, 1 / 60);
  f.renderer.draw(f.world, 0, 1 / 60);
  assert.equal(candidate.steps, 1);
  assert.equal(f.renderer.probe, null);
  await f.settle();
  assert.equal(f.renderer.pendingSession, null);
  assert.equal(f.renderer.probeSession, f.config);
  f.renderer.restoreSession();
  assert.equal(f.renderer.fluid, f.original);
  assert.equal(f.original.steps, 0);
  assert.ok(candidate.uniform.destroyed);
  assert.ok(candidate.buffers.every((buffer) => buffer.destroyed));
  assert.ok(f.original.buffers.every((buffer) => !buffer.destroyed));
});

test("asynchronous OOM restores original before reporting and never dispatches invalid candidate", async () => {
  const f = fixture();
  f.renderer.enterSession(f.world, f.config, (message) => {
    assert.equal(f.renderer.fluid, f.original);
    f.onFailure(message);
  });
  const candidate = f.renderer.fluid;
  await f.settle({ message: "injected out of memory" }, "out-of-memory");
  assert.deepEqual(f.errors, ["injected out of memory"]);
  assert.equal(candidate.steps, 0);
  assert.ok(candidate.buffers.every((buffer) => buffer.destroyed));
  assert.equal(f.renderer.probe, null);
  assert.equal(f.renderer.pendingSession, null);
});

test("first-use allocation error releases lazy buffers and preserves the original", async () => {
  const f = fixture();
  f.renderer.enterSession(f.world, f.config, f.onFailure);
  const candidate = f.renderer.fluid;
  await f.settle();
  f.renderer.draw(f.world, 0, 1 / 60);
  await f.settle({ message: "lazy uniform validation" });
  assert.equal(f.renderer.fluid, f.original);
  assert.equal(candidate.steps, 1);
  assert.ok(candidate.uniform.destroyed);
  assert.equal(f.original.steps, 0);
  assert.equal(f.renderer.probe, null);
  assert.deepEqual(f.errors, ["lazy uniform validation"]);
});

test("partial synchronous allocation cleanup restores Device.createBuffer and keeps original intact", async () => {
  const f = fixture();
  const create = f.gpu.device.createBuffer;
  globalThis.__sessionTest.throwAt = 3;
  assert.equal(f.renderer.enterSession(f.world, f.config, f.onFailure), false);
  await f.settle();
  assert.equal(f.gpu.device.createBuffer, create);
  assert.equal(f.renderer.fluid, f.original);
  assert.ok(f.allocated.slice(9).every((buffer) => buffer.destroyed));
  assert.ok(f.original.buffers.every((buffer) => !buffer.destroyed));
  assert.deepEqual(f.errors, ["synchronous allocation failed"]);
});

test("retry, exit and disposal invalidate pending error callbacks and release candidates", async () => {
  const f = fixture();
  f.renderer.enterSession(f.world, f.config, f.onFailure);
  const first = f.renderer.fluid;
  const stale = f.checks.splice(0);
  assert.equal(f.renderer.replaceSession(f.world, f.config, f.onFailure), true);
  const second = f.renderer.fluid;
  assert.notEqual(first, second);
  for (const check of stale) check.resolve({ message: "stale OOM" });
  await flush();
  assert.equal(f.renderer.fluid, second);
  assert.deepEqual(f.errors, []);
  f.renderer.restoreSession();
  await f.settle({ message: "after exit" });
  assert.equal(f.renderer.fluid, f.original);
  assert.deepEqual(f.errors, []);
  assert.ok(first.buffers.every((buffer) => buffer.destroyed));
  assert.ok(second.buffers.every((buffer) => buffer.destroyed));
  f.renderer.enterSession(f.world, f.config, f.onFailure);
  const third = f.renderer.fluid;
  f.renderer.dispose();
  await f.settle({ message: "after disposal" });
  assert.deepEqual(f.errors, []);
  assert.ok(third.buffers.every((buffer) => buffer.destroyed));
});

test("failed optional probe construction remains a challenge error and Retry creates a fresh probe", async () => {
  const f = fixture();
  globalThis.__sessionTest.probeError = "probe allocation OOM";
  f.renderer.enterSession(f.world, f.config, f.onFailure);
  const candidate = f.renderer.fluid;
  await f.settle();
  f.renderer.draw(f.world, 0, 1 / 60);
  await f.settle();
  assert.equal(f.renderer.probe, null);
  assert.equal(f.renderer.fluid, candidate);
  assert.equal(f.renderer.parkedFluid, f.original);
  assert.deepEqual(f.errors, ["probe: probe allocation OOM"]);
  globalThis.__sessionTest.probeError = null;
  f.renderer.replaceSession(f.world, f.config, f.onFailure);
  await f.settle();
  f.renderer.draw(f.world, 0, 1 / 60);
  await f.settle();
  assert.ok(f.renderer.probe);
  assert.equal(globalThis.__sessionTest.probes, 2);
  f.renderer.restoreSession();
});

test("asynchronous failure while resetting a validated retry restores the parked field", async () => {
  const f = fixture();
  f.renderer.enterSession(f.world, f.config, f.onFailure);
  const candidate = f.renderer.fluid;
  await f.settle();
  f.renderer.draw(f.world, 0, 1 / 60);
  await f.settle();
  assert.equal(f.renderer.replaceSession(f.world, f.config, f.onFailure), true);
  assert.equal(f.renderer.fluid, candidate);
  f.renderer.draw(f.world, 0, 1 / 60);
  assert.equal(candidate.steps, 1);
  await f.settle({ message: "retry write validation" });
  assert.equal(f.renderer.fluid, f.original);
  assert.deepEqual(f.errors, ["retry write validation"]);
});
