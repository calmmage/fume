import { compute, storage, type Compute, type Gpu, type StorageBuffer } from "vgpu";
import type { Fluid } from "./fluid";
import type { World } from "./sim";
import {
  captureSessionWork,
  releaseSessionBuffers,
  type SessionBuffers,
} from "./session-allocation";
import smokeProbeWgsl from "./wgsl/smoke-probe.wgsl";

export interface ProbeTarget {
  x: number;
  y: number;
  r: number;
  visibleOpacity: number;
}
export interface ProbeSample {
  fill: number;
  coverage: number;
  at: number;
}
export interface ProbeSession {
  target: ProbeTarget;
  onSample: (sample: ProbeSample) => void;
  onError: (message: string) => void;
}

/** Only this 16-byte reduction buffer crosses the GPU/CPU boundary at runtime. */
export class SmokeProbe {
  private pass: Compute;
  private result: StorageBuffer;
  private session: ProbeSession | null = null;
  private revision = 0;
  private last = -Infinity;
  private inFlight = false;
  private disposed = false;
  private creation: Promise<string | null>;
  private buffers: SessionBuffers = new Set();

  constructor(private gpu: Gpu) {
    const creation = captureSessionWork(gpu, this.buffers, () => ({
      pass: compute(gpu, smokeProbeWgsl, { label: "challenge-smoke-probe" }),
      result: storage(gpu, 16, "read-write"),
    }));
    this.creation = creation.checked;
    if (!creation.value || creation.error) {
      releaseSessionBuffers(this.buffers);
      throw new Error(creation.error ?? "Smoke measurement could not be allocated.");
    }
    this.pass = creation.value.pass;
    this.result = creation.value.result;
  }

  configure(session: ProbeSession | null) {
    this.revision += 1;
    this.session = session;
    this.last = -Infinity;
    if (!session) return;
    const revision = this.revision;
    // Constructor failures must surface even before the first sample/readback.
    void this.creation.then((error) => {
      if (!error || this.disposed || revision !== this.revision) return;
      this.configure(null);
      session.onError(error);
    });
  }

  sample(fluid: Fluid, world: World, at = performance.now() / 1000) {
    const session = this.session;
    if (!session || this.disposed || this.inFlight || at - this.last < 0.1) return;
    const revision = this.revision;
    this.last = at;
    this.inFlight = true;
    const work = captureSessionWork(this.gpu, this.buffers, () => {
      const target = session.target;
      this.pass
        .set({
          probe: {
            world: [world.w, world.h],
            dye_size: [fluid.dyeW, fluid.dyeH],
            area: [target.x, target.y, target.r, target.visibleOpacity],
          },
          dye: fluid.dye.read,
          result: this.result,
        })
        .dispatch(1);
      // read() submits the copy now; later solver steps cannot change this sample.
      return this.result.read();
    });
    const read = work.value ?? Promise.reject(new Error(work.error ?? "Smoke measurement failed."));
    void Promise.allSettled([read, work.checked, this.creation])
      .then(([readback, validation, creation]) => {
        // Even a validation failure waits for the pending read to settle before
        // allowing another attempt to reuse the reduction buffer.
        if (readback.status === "rejected") throw readback.reason;
        for (const check of [validation, creation]) {
          if (check.status === "rejected") throw check.reason;
          if (check.value) throw new Error(check.value);
        }
        if (this.disposed || revision !== this.revision) return;
        const values = new Float32Array(readback.value);
        if (values.length !== 4 || !values.every(Number.isFinite) || values[3] < 1)
          throw new Error("Smoke measurement returned an invalid result.");
        session.onSample({ fill: values[0], coverage: values[1], at });
      })
      .catch((error: unknown) => {
        if (this.disposed || revision !== this.revision) return;
        this.configure(null);
        session.onError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        this.inFlight = false;
      });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.configure(null);
    (this.result as StorageBuffer & { destroy(): void }).destroy();
    releaseSessionBuffers(this.buffers);
  }
}
