import {
  effect,
  frame,
  init,
  storage,
  surface,
  type Effect,
  type Gpu,
  type StorageBuffer,
  type Surface,
} from "vgpu";
import { buildFilmLut, FILM_LUT_SIZE } from "./film";
import { createFluid, destroyFluid, ensureFluidSize, stepFluid, type Fluid } from "./fluid";
import { interpolated, type Particle, type World } from "./sim";
import { packGadgets } from "./tools";
import { loadRoomMaterials } from "./materials";
import { roomViewConfig } from "./material-room";
import { createContourRoom } from "./contour-room";
import { Cosmos } from "./cosmos";
import { SmokeProbe, type ProbeSession } from "./smoke-probe";
import { sessionViewport } from "./session-view";
import {
  captureSessionWork,
  releaseSessionBuffers,
  type SessionBuffers,
} from "./session-allocation";
import compositeWgsl from "./wgsl/composite.wgsl";

const MAX_BALLS = 18;
const MAX_PT = 48;

interface PendingSession {
  phase: "allocating" | "first-use" | "checking-first-use";
  probe: ProbeSession;
  onFailure: (message: string) => void;
}

function filmLutFloats(): Float32Array {
  const bytes = buildFilmLut();
  const out = new Float32Array(FILM_LUT_SIZE * 4);
  for (let i = 0; i < FILM_LUT_SIZE; i++) {
    const o = i * 4;
    out[o] = bytes[o] / 255;
    out[o + 1] = bytes[o + 1] / 255;
    out[o + 2] = bytes[o + 2] / 255;
    out[o + 3] = 1;
  }
  return out;
}

export class Renderer {
  dpr = 1;
  private parkedFluid: Fluid | null = null;
  private sessionShape: { w: number; h: number; reduced: boolean } | null = null;
  private probe: SmokeProbe | null = null;
  private probeSession: ProbeSession | null = null;
  private pendingSession: PendingSession | null = null;
  private sessionBuffers: SessionBuffers = new Set();
  private unavailable = false;
  private disposed = false;
  private constructor(
    readonly gpu: Gpu,
    private surface: Surface,
    private fluid: Fluid,
    private composite: Effect,
    private lut: StorageBuffer,
    private particles: StorageBuffer,
    private materials: ReturnType<typeof loadRoomMaterials>,
    private contours: ReturnType<typeof createContourRoom>,
    private cosmos: Cosmos,
  ) {}

  static async create(
    canvas: HTMLCanvasElement,
    onGpuError?: (message: string) => void,
  ): Promise<Renderer> {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser");
    }
    const gpu = await init();
    gpu.onError((err) => {
      console.error("[vgpu]", err.message);
      onGpuError?.(err.message);
    });
    const canvasSurface = surface(gpu, canvas, {
      dpr: [1, 2],
      alphaMode: "premultiplied",
      clearColor: [0.035, 0.034, 0.038, 1],
    });
    const rect = canvas.getBoundingClientRect();
    const fluid = createFluid(
      gpu,
      Math.max(1, rect.width || window.innerWidth),
      Math.max(1, rect.height || window.innerHeight),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    const lut = storage(gpu, FILM_LUT_SIZE * 16, "read");
    lut.write(filmLutFloats() as unknown as BufferSource);
    const particles = storage(gpu, MAX_PT * 2 * 16, "read");
    particles.write(new Float32Array(MAX_PT * 8) as unknown as BufferSource);
    const composite = effect(gpu, compositeWgsl, { label: "fume-composite" });
    await composite.compile({ colors: [canvasSurface.format] });
    const materials = loadRoomMaterials(gpu);
    const cosmos = new Cosmos(gpu);
    await cosmos.compile();
    const renderer = new Renderer(
      gpu,
      canvasSurface,
      fluid,
      composite,
      lut,
      particles,
      materials,
      createContourRoom(gpu),
      cosmos,
    );
    void gpu.gpu.lost.then((info) => {
      if (renderer.disposed) return;
      renderer.unavailable = true;
      renderer.probe?.configure(null);
      renderer.probeSession?.onError(
        "The GPU connection was lost. Smoke buffers cannot be restored; reload to continue.",
      );
      onGpuError?.(info.message || "The GPU connection was lost. Reload to continue.");
    });
    return renderer;
  }

  /** Keep the original ping-pong buffers, parity and seeded IDs entirely idle. */
  enterSession(
    world: World,
    probeSession: ProbeSession,
    onAllocationFailure: (message: string) => void = probeSession.onError,
  ): boolean {
    if (this.disposed || this.unavailable || this.parkedFluid) return false;
    const allocation = captureSessionWork(this.gpu, this.sessionBuffers, () =>
      createFluid(this.gpu, world.w, world.h, world.reducedMotion),
    );
    if (!allocation.value || allocation.error) {
      releaseSessionBuffers(this.sessionBuffers);
      onAllocationFailure(allocation.error ?? "Challenge buffers could not be allocated.");
      return false;
    }
    this.parkedFluid = this.fluid;
    this.fluid = allocation.value;
    this.sessionShape = { w: world.w, h: world.h, reduced: world.reducedMotion };
    const pending: PendingSession = {
      phase: "allocating",
      probe: probeSession,
      onFailure: onAllocationFailure,
    };
    this.pendingSession = pending;
    this.checkSessionWork(pending, allocation.checked, "first-use");
    return true;
  }

  replaceSession(
    world: World,
    probeSession: ProbeSession,
    onAllocationFailure: (message: string) => void = probeSession.onError,
  ): boolean {
    if (this.disposed || this.unavailable || !this.parkedFluid) return false;
    const shape = this.sessionShape;
    if (
      !this.pendingSession &&
      shape?.w === world.w &&
      shape.h === world.h &&
      shape.reduced === world.reducedMotion
    ) {
      this.probe?.configure(null);
      this.probeSession = null;
      const reset = captureSessionWork(this.gpu, this.sessionBuffers, () => {
        // vgpu owns compute-pass uniforms until GPU disposal. Reuse the
        // challenge's passes and field allocation across retries instead of
        // accumulating another set of pipeline uniforms on every attempt.
        const f = this.fluid;
        const buffers = [
          f.velocity.read,
          f.velocity.write,
          f.dye.read,
          f.dye.write,
          f.pressure.read,
          f.pressure.write,
          f.divergence,
          f.curl,
          f.obst,
        ];
        const zeros = new Float32Array(Math.max(...buffers.map((buffer) => buffer.size)) / 4);
        for (const buffer of buffers) buffer.write(zeros.subarray(0, buffer.size / 4));
        f.seeded.clear();
      });
      if (reset.error) {
        this.restoreSession();
        onAllocationFailure(reset.error);
        return false;
      }
      const pending: PendingSession = {
        phase: "allocating",
        probe: probeSession,
        onFailure: onAllocationFailure,
      };
      this.pendingSession = pending;
      this.checkSessionWork(pending, reset.checked, "first-use");
      return true;
    }
    // Release the old attempt before allocating another: never three fields.
    this.restoreSession();
    return this.enterSession(world, probeSession, onAllocationFailure);
  }

  private checkSessionWork(
    pending: PendingSession,
    checked: Promise<string | null>,
    next: "first-use" | "ready",
  ) {
    void checked.then((error) => {
      if (this.disposed || this.unavailable || this.pendingSession !== pending) return;
      if (error) {
        this.restoreSession();
        pending.onFailure(error);
      } else if (next === "first-use") {
        pending.phase = "first-use";
      } else {
        this.pendingSession = null;
        this.probeSession = pending.probe;
        const failMeasurement = (message: string) => {
          if (this.disposed || this.probeSession !== pending.probe) return;
          // A failed optional pipeline/buffer must not be cached into Retry.
          this.probe?.dispose();
          this.probe = null;
          pending.probe.onError(message);
        };
        try {
          this.probe ??= new SmokeProbe(this.gpu);
          this.probe.configure({ ...pending.probe, onError: failMeasurement });
        } catch (cause) {
          failMeasurement(cause instanceof Error ? cause.message : String(cause));
        }
      }
    });
  }

  restoreSession() {
    this.pendingSession = null;
    this.probe?.configure(null);
    this.probeSession = null;
    this.sessionShape = null;
    if (!this.parkedFluid) return;
    const retired = this.fluid;
    this.fluid = this.parkedFluid;
    this.parkedFluid = null;
    destroyFluid(retired);
    releaseSessionBuffers(this.sessionBuffers);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.dpr = dpr;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    const [sw, sh] = this.surface.size;
    if (sw !== w || sh !== h) this.surface.resize([w, h]);
  }

  draw(world: World, _alpha: number, dt: number) {
    if (this.unavailable) throw new Error("The GPU connection was lost. Reload to continue.");
    const pending = this.pendingSession;
    if (pending) {
      if (pending.phase === "first-use") {
        pending.phase = "checking-first-use";
        // First use creates the solver's lazy uniform buffers. Validate this
        // candidate-only step before rendering it or issuing a smoke probe.
        const firstUse = captureSessionWork(this.gpu, this.sessionBuffers, () =>
          stepFluid(this.fluid, world, dt),
        );
        this.checkSessionWork(pending, firstUse.checked, "ready");
      }
      return;
    }
    this.fluid = ensureFluidSize(this.gpu, this.fluid, world);
    stepFluid(this.fluid, world, dt);
    const viewport = sessionViewport(this.surface.size[0], this.surface.size[1], world.w, world.h);
    const viewDpr = viewport.width / world.w;

    this.materials.selectStyle(world.look.roomStyle);
    const look = world.params;
    const shake = shakeOffset(world);
    const xy_r_thick = pad18([0, 0, 0, 0]);
    const modes0 = pad18([0, 0, 0, 0]);
    const modes1 = pad18([0, 0, 0, 0]);
    const pop_seed = pad18([0, 0, 0, 0]);
    const smoke = pad18([0, 0, 0, 0]);
    const list = world.bubbles.filter((b) => b.alive).sort((a, b) => a.r - b.r);
    const n = Math.min(list.length, MAX_BALLS);
    for (let i = 0; i < n; i++) {
      const b = list[i];
      const p = interpolated(b, _alpha);
      xy_r_thick[i] = [p.x, p.y, p.r, b.thickness];
      modes0[i] = [b.modes[0].amp, b.modes[0].phase, b.modes[1].amp, b.modes[1].phase];
      modes1[i] = [b.modes[2].amp, b.modes[2].phase, b.modes[3].amp, b.modes[3].phase];
      pop_seed[i] = [b.popping ? Math.min(1, b.popT) : 0, b.popX, b.popY, b.seed];
      smoke[i] = [b.smoke, 0, 0, 0];
    }

    const pt = new Float32Array(MAX_PT * 8);
    const drops = world.particles.filter((p) => p.kind === 0 || p.kind === 1 || p.kind === 3);
    const pn = Math.min(drops.length, MAX_PT);
    for (let i = 0; i < pn; i++) {
      packParticle(pt, i, drops[i]);
    }
    this.particles.write(pt as unknown as BufferSource);

    const gadgets = packGadgets(world.gadgets);
    this.composite.set({
      config: {
        world: [world.w, world.h],
        time: world.time,
        blowing: world.blowing ? 1 : 0,
        wand: [world.wandX, world.wandY],
        shake: [shake.x, shake.y],
        dye_size: [this.fluid.dyeW, this.fluid.dyeH],
        n_balls: n,
        n_particles: pn,
        iri: look.iridescence,
        refr: look.refraction,
        gloss: look.gloss,
        glass: look.glassBody,
        bands: look.filmBands,
        show_wand: world.tool === "wand" ? 1 : 0,
        n_gadgets: gadgets.count[0],
        palette: paletteIndex(world.look.palette),
        pixel: world.look.pixel ? 1 : 0,
        depth:
          world.look.depth === "layers"
            ? 1
            : world.look.depth === "lines"
              ? 2
              : world.look.depth === "woods"
                ? 3
                : 0,
        rays: world.look.rays === "shafts" ? 1 : world.look.rays === "sun" ? 2 : 0,
        parallax: [world.look.parallaxX, world.look.parallaxY],
        grain: world.look.grain ? 1 : 0,
        slices: world.look.slices,
        room_on: world.look.room ? 1 : 0,
        room_depth: world.look.roomDepth,
        room_cx: world.look.roomX,
        room_cy: world.look.roomY,
        room_hw: world.look.roomW,
        room_hh: world.look.roomH,
        scene_z: world.look.sceneZ,
        room_style:
          world.look.roomStyle === "geometry" || world.look.roomStyle === "cosmos" ? 2 : 0,
        visual_style: ["geometry", "pixel", "cosmos", "stone", "wood", "empty"].indexOf(
          world.look.roomStyle,
        ),
        dust_on: world.look.dust ? 1 : 0,
        material_height: viewport.height,
        ...roomViewConfig(world.w, world.h, world.look),
      },
      balls: { xy_r_thick, modes0, modes1, pop_seed, smoke },
      gadgets,
      dye: this.fluid.dye.read,
      lut: this.lut,
      particles: this.particles,
      ...this.materials.bindings,
      ...(world.look.room && world.look.roomStyle === "geometry"
        ? {
            environmentMap: this.contours.update(world.w, world.h, viewDpr, world.look),
          }
        : {}),
      ...(world.look.room && world.look.roomStyle === "cosmos"
        ? {
            environmentMap: this.cosmos.update(
              Math.max(1, Math.round(viewport.width)),
              Math.max(1, Math.round(viewport.height)),
              this.dpr,
              world.look,
            ),
          }
        : {}),
    });

    frame(this.gpu, (f) => {
      if (world.look.room && world.look.roomStyle === "cosmos") this.cosmos.render(f);
      f.pass({ target: this.surface, clear: true, viewport }, this.composite);
    });
    try {
      if (this.probeSession) this.probe?.sample(this.fluid, world);
    } catch (error) {
      this.probe?.dispose();
      this.probe = null;
      this.probeSession?.onError(error instanceof Error ? error.message : String(error));
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pendingSession = null;
    this.probe?.dispose();
    this.materials.dispose();
    this.contours.dispose();
    this.cosmos.dispose();
    destroyFluid(this.fluid);
    if (this.parkedFluid) destroyFluid(this.parkedFluid);
    this.parkedFluid = null;
    releaseSessionBuffers(this.sessionBuffers);
    this.gpu.dispose();
  }
}

function paletteIndex(id: World["look"]["palette"]) {
  switch (id) {
    case "dusk":
      return 1;
    case "blue":
      return 2;
    case "ember":
      return 3;
    case "mist":
      return 4;
    case "violet":
      return 5;
    default:
      return 0;
  }
}

function pad18(zero: number[]): number[][] {
  return Array.from({ length: MAX_BALLS }, () => zero.slice());
}

function packParticle(out: Float32Array, i: number, p: Particle) {
  const t = p.life / p.ttl;
  const fade = p.kind === 3 ? 1 - t : 1 - t;
  const size = p.kind === 3 ? p.size * 0.08 : p.size;
  const o = i * 8;
  out[o] = p.x;
  out[o + 1] = p.y;
  out[o + 2] = size;
  out[o + 3] = p.a * fade;
  out[o + 4] = p.r;
  out[o + 5] = p.g;
  out[o + 6] = p.b;
  out[o + 7] = p.kind;
}

function shakeOffset(world: World) {
  if (world.reducedMotion || world.trauma <= 0) return { x: 0, y: 0 };
  const s = world.trauma * world.trauma;
  const t = world.time * 47;
  return {
    x: (noise1(t) * 2 - 1) * s * 14,
    y: (noise1(t + 19) * 2 - 1) * s * 10,
  };
}

function noise1(t: number) {
  return (
    (Math.sin(t * 1.31) * 0.5 + Math.sin(t * 2.17 + 1.3) * 0.35 + Math.sin(t * 4.9) * 0.15) * 0.5 +
    0.5
  );
}
