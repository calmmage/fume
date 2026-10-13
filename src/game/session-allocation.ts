import type { Gpu } from "vgpu";

type OwnedBuffer = ReturnType<Gpu["device"]["createBuffer"]>;

/** Buffers belonging only to the optional session, including lazy uniforms. */
export type SessionBuffers = Set<OwnedBuffer>;

/**
 * Native allocation errors arrive asynchronously. Pop every scope before
 * returning so subsequent playground work can never fall into these scopes.
 * Track the synchronous allocation batch to release partial createFluid work
 * without changing the preserved solver or disposing the shared GPU.
 */
export function captureSessionWork<T>(gpu: Gpu, buffers: SessionBuffers, work: () => T) {
  const device = gpu.device;
  const native = gpu.gpu;
  const create = device.createBuffer;
  const descriptor = Object.getOwnPropertyDescriptor(device, "createBuffer");
  const checks: Array<Promise<GPUError | null>> = [];
  let scopes = 0;
  let value: T | undefined;
  let error: string | null = null;
  try {
    for (const filter of ["out-of-memory", "internal", "validation"] as const) {
      native.pushErrorScope(filter);
      scopes += 1;
    }
    device.createBuffer = (options) => {
      const buffer = create.call(device, options);
      buffers.add(buffer);
      return buffer;
    };
    value = work();
  } catch (cause) {
    error = errorMessage(cause);
  } finally {
    if (descriptor) Object.defineProperty(device, "createBuffer", descriptor);
    else Reflect.deleteProperty(device, "createBuffer");
    while (scopes-- > 0) {
      try {
        checks.push(native.popErrorScope());
      } catch (cause) {
        checks.push(Promise.reject(cause));
      }
    }
  }
  const checked = Promise.allSettled(checks).then((results) => {
    if (error) return error;
    for (const result of results) {
      if (result.status === "rejected") return errorMessage(result.reason);
      if (result.value) return result.value.message;
    }
    return null;
  });
  return { value, error, checked };
}

export function releaseSessionBuffers(buffers: SessionBuffers) {
  for (const buffer of buffers) buffer.destroy();
  buffers.clear();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
