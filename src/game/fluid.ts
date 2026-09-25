/**
 * Incompressible Navier–Stokes on WebGPU via Vercel vgpu.
 *
 * Stam stable fluids + Fedkiw vorticity confinement, matching the vgpu
 * Interactive Fluid example (compute + ping-pong storage), with soap-film
 * obstacles, a vortex-pair blow jet, and volume-lit dye.
 *
 * Domain BCs are OPEN: pressure Dirichlet 0 on the rim, dye absorbing
 * halo, no reflecting walls. Smoke leaves through every edge; empty air
 * is zero dye.
 */

import {
  compute,
  pingPongStorage,
  storage,
  type Compute,
  type Gpu,
  type PingPongStorage,
  type StorageBuffer,
} from "vgpu";
import { screenToWorld, type FluidSplat, type World } from "./sim";
import { packGadgets } from "./tools";

import obstaclesWgsl from "./wgsl/obstacles.wgsl";
import splatVelWgsl from "./wgsl/splat-vel.wgsl";
import splatDyeWgsl from "./wgsl/splat-dye.wgsl";
import seedWgsl from "./wgsl/seed.wgsl";
import forcesWgsl from "./wgsl/forces.wgsl";
import curlWgsl from "./wgsl/curl.wgsl";
import vorticityWgsl from "./wgsl/vorticity.wgsl";
import divergenceWgsl from "./wgsl/divergence.wgsl";
import pressureWgsl from "./wgsl/pressure.wgsl";
import projectWgsl from "./wgsl/project.wgsl";
import applyObstWgsl from "./wgsl/apply-obst.wgsl";
import advectVelWgsl from "./wgsl/advect-vel.wgsl";
import advectDyeWgsl from "./wgsl/advect-dye.wgsl";
import sharpenWgsl from "./wgsl/sharpen.wgsl";

const MAX_BALLS = 18;
const VEL_LONG = 256;
const DYE_LONG = 1024;
const VEL_LONG_LO = 128;
const DYE_LONG_LO = 512;

export interface Fluid {
  gpu: Gpu;
  velW: number;
  velH: number;
  dyeW: number;
  dyeH: number;
  velocity: PingPongStorage;
  dye: PingPongStorage;
  pressure: PingPongStorage;
  divergence: StorageBuffer;
  curl: StorageBuffer;
  obst: StorageBuffer;
  passes: FluidPasses;
  seeded: Set<number>;
}

interface FluidPasses {
  obstacles: Compute;
  splatVel: Compute;
  splatDye: Compute;
  seed: Compute;
  forces: Compute;
  curl: Compute;
  vorticity: Compute;
  divergence: Compute;
  pressure: Compute;
  project: Compute;
  applyObst: Compute;
  advectVel: Compute;
  advectDye: Compute;
  sharpen: Compute;
}

function align8(n: number) {
  return Math.max(8, Math.ceil(n / 8) * 8);
}

function pickGrid(w: number, h: number, long: number) {
  if (w >= h) {
    return { gw: align8(long), gh: align8(Math.max(64, Math.round((long * h) / w))) };
  }
  return { gw: align8(Math.max(64, Math.round((long * w) / h))), gh: align8(long) };
}

function destroyBuf(buffer: StorageBuffer) {
  (buffer as StorageBuffer & { destroy(): void }).destroy();
}

export function createFluid(gpu: Gpu, worldW: number, worldH: number, reduced: boolean): Fluid {
  const vLong = reduced ? VEL_LONG_LO : VEL_LONG;
  const dLong = reduced ? DYE_LONG_LO : DYE_LONG;
  const vel = pickGrid(worldW, worldH, vLong);
  const dye = pickGrid(worldW, worldH, dLong);
  const cells = vel.gw * vel.gh;
  const dyeCells = dye.gw * dye.gh;

  const velocity = pingPongStorage(gpu, cells * 8);
  const dyeBuf = pingPongStorage(gpu, dyeCells * 16);
  const pressure = pingPongStorage(gpu, cells * 4);
  const divergence = storage(gpu, cells * 4, "read-write");
  const curl = storage(gpu, cells * 4, "read-write");
  const obst = storage(gpu, cells * 16, "read-write");

  const zerosV = new Float32Array(cells * 2);
  const zerosD = new Float32Array(dyeCells * 4);
  const zeros1 = new Float32Array(cells);
  const zerosO = new Float32Array(cells * 4);
  const buf = (arr: Float32Array) => arr as unknown as BufferSource;
  velocity.read.write(buf(zerosV));
  velocity.write.write(buf(zerosV));
  dyeBuf.read.write(buf(zerosD));
  dyeBuf.write.write(buf(zerosD));
  pressure.read.write(buf(zeros1));
  pressure.write.write(buf(zeros1));
  divergence.write(buf(zeros1));
  curl.write(buf(zeros1));
  obst.write(buf(zerosO));

  const grid = { vel_size: [vel.gw, vel.gh], dye_size: [dye.gw, dye.gh] };
  const withGrid = (shader: typeof obstaclesWgsl, label: string) =>
    compute(gpu, shader, { label, set: { grid } });

  return {
    gpu,
    velW: vel.gw,
    velH: vel.gh,
    dyeW: dye.gw,
    dyeH: dye.gh,
    velocity,
    dye: dyeBuf,
    pressure,
    divergence,
    curl,
    obst,
    seeded: new Set(),
    passes: {
      obstacles: withGrid(obstaclesWgsl, "obstacles"),
      splatVel: withGrid(splatVelWgsl, "splat-vel"),
      splatDye: withGrid(splatDyeWgsl, "splat-dye"),
      seed: withGrid(seedWgsl, "seed"),
      forces: withGrid(forcesWgsl, "forces"),
      curl: withGrid(curlWgsl, "curl"),
      vorticity: withGrid(vorticityWgsl, "vorticity"),
      divergence: withGrid(divergenceWgsl, "divergence"),
      pressure: withGrid(pressureWgsl, "pressure"),
      project: withGrid(projectWgsl, "project"),
      applyObst: withGrid(applyObstWgsl, "apply-obst"),
      advectVel: withGrid(advectVelWgsl, "advect-vel"),
      advectDye: withGrid(advectDyeWgsl, "advect-dye"),
      sharpen: withGrid(sharpenWgsl, "sharpen"),
    },
  };
}

export function destroyFluid(fluid: Fluid) {
  destroyBuf(fluid.velocity.read);
  destroyBuf(fluid.velocity.write);
  destroyBuf(fluid.dye.read);
  destroyBuf(fluid.dye.write);
  destroyBuf(fluid.pressure.read);
  destroyBuf(fluid.pressure.write);
  destroyBuf(fluid.divergence);
  destroyBuf(fluid.curl);
  destroyBuf(fluid.obst);
}

export function ensureFluidSize(gpu: Gpu, fluid: Fluid, world: World): Fluid {
  const reduced = world.reducedMotion;
  const vLong = reduced ? VEL_LONG_LO : VEL_LONG;
  const dLong = reduced ? DYE_LONG_LO : DYE_LONG;
  const vel = pickGrid(world.w, world.h, vLong);
  const dye = pickGrid(world.w, world.h, dLong);
  if (vel.gw === fluid.velW && vel.gh === fluid.velH && dye.gw === fluid.dyeW && dye.gh === fluid.dyeH) {
    return fluid;
  }
  destroyFluid(fluid);
  return createFluid(gpu, world.w, world.h, reduced);
}

function worldInfo(world: World, dt: number) {
  return { size: [world.w, world.h], dt, time: world.time };
}

function simUniforms(world: World) {
  const p = world.params;
  const lo = world.reducedMotion ? 0.45 : 1;
  return {
    vorticity: p.vorticity * lo,
    buoyancy: p.buoyancy,
    weight: p.smokeWeight,
    vel_decay: p.velDecay * (world.reducedMotion ? 1.8 : 1),
    smoke_decay: p.smokeDecay * (world.reducedMotion ? 1.8 : 1),
    turb: p.turbulence * lo,
    sharpen: p.sharpen,
    dye_inject: p.dyeInject,
  };
}

function jetUniforms(world: World) {
  const attached = world.bubbles.find((b) => b.id === world.attachedId);
  const wand = screenToWorld(world, world.wandX, world.wandY);
  return {
    pos: [wand.x, wand.y],
    force: world.params.blowForce,
    radius: world.params.blowRadius,
    enabled: world.blowing ? 1 : 0,
    held: world.blowHeld,
    attached_xy: attached ? [attached.x, attached.y] : [0, 0],
    attached_r: attached?.r ?? 0,
    attached: attached && attached.alive && !attached.popping ? 1 : 0,
  };
}

function ballUniforms(world: World) {
  const xy_r_pop = Array.from({ length: MAX_BALLS }, () => [0, 0, 0, 1]);
  const vel_att = Array.from({ length: MAX_BALLS }, () => [0, 0, 0, 0]);
  let n = 0;
  for (const b of world.bubbles) {
    if (!b.alive || n >= MAX_BALLS) continue;
    xy_r_pop[n] = [b.x, b.y, b.r, b.popping ? b.popT : 0];
    vel_att[n] = [b.vx, b.vy, b.attached ? 1 : 0, 0];
    n += 1;
  }
  return { count: [n, 0, 0, 0], xy_r_pop, vel_att };
}

function dispatchVel(fluid: Fluid) {
  return [Math.ceil(fluid.velW / 8), Math.ceil(fluid.velH / 8)] as const;
}

function dispatchDye(fluid: Fluid) {
  return [Math.ceil(fluid.dyeW / 8), Math.ceil(fluid.dyeH / 8)] as const;
}

function splat(
  fluid: Fluid,
  world: World,
  s: FluidSplat,
  color: readonly [number, number, number],
) {
  const dt = 1 / 60;
  const info = worldInfo(world, dt);
  const spec = {
    center: [s.x, s.y],
    radius: s.radius,
    spin: s.spin,
    vel: [s.vx, s.vy],
    radial: s.radial,
    aspect: [s.aspectX ?? 1, s.aspectY ?? 1],
    angle: s.angle ?? 0,
    color: [color[0], color[1], color[2], 1],
  };
  const [vx, vy] = dispatchVel(fluid);
  fluid.passes.splatVel
    .set({ world: info, splat: spec, vel: fluid.velocity.read })
    .dispatch(vx, vy);
  const dyeAmt = Math.max(color[0], color[1], color[2]);
  const dyeScale = s.dyeScale ?? 0.32;
  if (dyeAmt > 1e-5 && dyeScale > 0) {
    const [dx, dy] = dispatchDye(fluid);
    fluid.passes.splatDye
      .set({
        world: info,
        splat: { ...spec, radius: s.radius * dyeScale },
        dye: fluid.dye.read,
      })
      .dispatch(dx, dy);
  }
}

function seedBubble(
  fluid: Fluid,
  world: World,
  x: number,
  y: number,
  r: number,
  spin: number,
  density: number,
  color: readonly [number, number, number],
  modes: { vel?: boolean; dye?: boolean } = { vel: true, dye: true },
) {
  const info = worldInfo(world, 1 / 60);
  const seed = {
    center: [x, y],
    radius: r,
    spin,
    color: [color[0], color[1], color[2], 1],
    density,
    mode: 0,
    _pad: [0, 0],
  };
  if (modes.vel !== false && spin !== 0) {
    const [vx, vy] = dispatchVel(fluid);
    fluid.passes.seed
      .set({
        world: info,
        seed,
        vel: fluid.velocity.read,
        dye: fluid.dye.read,
      })
      .dispatch(vx, vy);
  }
  if (modes.dye !== false && density > 0) {
    const [dx, dy] = dispatchDye(fluid);
    fluid.passes.seed
      .set({
        world: info,
        seed: { ...seed, mode: 1 },
        vel: fluid.velocity.read,
        dye: fluid.dye.read,
      })
      .dispatch(dx, dy);
  }
}

export function stepFluid(fluid: Fluid, world: World, dt: number) {
  dt = Math.min(0.016666, Math.max(0.008, dt));
  const p = fluid.passes;
  const info = worldInfo(world, dt);
  const sim = simUniforms(world);
  const jet = jetUniforms(world);
  const balls = ballUniforms(world);
  const gadgets = packGadgets(world.gadgets);
  const [vx, vy] = dispatchVel(fluid);
  const [dx, dy] = dispatchDye(fluid);

  p.obstacles.set({ world: info, balls, gadgets, obst: fluid.obst }).dispatch(vx, vy);

  for (const b of world.bubbles) {
    if (!b.alive || b.popping) continue;
    const first = !fluid.seeded.has(b.id);
    if (first) fluid.seeded.add(b.id);
    if (first || b.attached) {
      const cool: [number, number, number] = first
        ? [0.64 + Math.random() * 0.06, 0.66 + Math.random() * 0.05, 0.72 + Math.random() * 0.06]
        : [0.66, 0.68, 0.73];
      const dens = first ? 0.82 : 0.02;
      const spin = first ? (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 8) : 0;
      seedBubble(fluid, world, b.x, b.y, b.r * 0.9, spin, dens, cool, {
        vel: first,
        dye: true,
      });
    }
  }
  for (const id of [...fluid.seeded]) {
    if (!world.bubbles.some((b) => b.id === id && b.alive)) fluid.seeded.delete(id);
  }

  const queued = world.fluidSplats;
  if (queued.length) {
    for (const s of queued) {
      const k = Math.max(0.02, s.density * 0.5);
      splat(fluid, world, s, [0.68 * k, 0.69 * k, 0.71 * k]);
    }
    queued.length = 0;
  }

  p.forces
    .set({
      world: info,
      sim,
      gadgets,
      src: fluid.velocity.read,
      dye: fluid.dye.read,
      obst: fluid.obst,
      dst: fluid.velocity.write,
    })
    .dispatch(vx, vy);
  fluid.velocity.swap();

  p.curl.set({ velocity: fluid.velocity.read, curl: fluid.curl }).dispatch(vx, vy);
  p.vorticity
    .set({
      world: info,
      sim,
      src: fluid.velocity.read,
      curl: fluid.curl,
      obst: fluid.obst,
      dst: fluid.velocity.write,
    })
    .dispatch(vx, vy);
  fluid.velocity.swap();

  p.divergence
    .set({ velocity: fluid.velocity.read, obst: fluid.obst, divergence: fluid.divergence })
    .dispatch(vx, vy);

  const iters = Math.max(8, Math.round(world.params.solverIters * (world.reducedMotion ? 0.5 : 1)));
  for (let i = 0; i < iters; i++) {
    p.pressure
      .set({
        params: { decay: i === 0 ? 0.8 : 1 },
        src: fluid.pressure.read,
        divergence: fluid.divergence,
        obst: fluid.obst,
        dst: fluid.pressure.write,
      })
      .dispatch(vx, vy);
    fluid.pressure.swap();
  }

  p.project
    .set({
      src: fluid.velocity.read,
      pressure: fluid.pressure.read,
      obst: fluid.obst,
      dst: fluid.velocity.write,
    })
    .dispatch(vx, vy);
  fluid.velocity.swap();

  p.applyObst
    .set({ src: fluid.velocity.read, obst: fluid.obst, dst: fluid.velocity.write })
    .dispatch(vx, vy);
  fluid.velocity.swap();

  p.advectVel
    .set({
      world: info,
      sim,
      jet,
      gadgets,
      src: fluid.velocity.read,
      obst: fluid.obst,
      dst: fluid.velocity.write,
    })
    .dispatch(vx, vy);
  fluid.velocity.swap();

  p.applyObst
    .set({ src: fluid.velocity.read, obst: fluid.obst, dst: fluid.velocity.write })
    .dispatch(vx, vy);
  fluid.velocity.swap();

  p.advectDye
    .set({
      world: info,
      sim,
      jet,
      gadgets,
      src: fluid.dye.read,
      velocity: fluid.velocity.read,
      obst: fluid.obst,
      dst: fluid.dye.write,
    })
    .dispatch(dx, dy);
  fluid.dye.swap();

  if (!world.reducedMotion) {
    p.sharpen
      .set({ sim, src: fluid.dye.read, dst: fluid.dye.write })
      .dispatch(dx, dy);
    fluid.dye.swap();
  }
}
