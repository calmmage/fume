import type { LookState } from "./look";
import type { SimParams } from "./params";
import { createWorld, setHeldToolActive, setTool, type World } from "./sim";
import { createGadget, type Gadget } from "./tools";

export type ChallengeId = "draft" | "ledge" | "passage";
export type ChallengeToolKind = "fan" | "block";

export interface ChallengeDef {
  id: ChallengeId;
  title: string;
  description: string;
  hint: string;
  kit: readonly { kind: ChallengeToolKind; count: number }[];
  source: readonly [number, number];
  target: readonly [number, number];
  /** Radius in fractions of the shorter logical dimension. */
  targetRadius: number;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "draft", title: "Draft",
    description: "Guide the candle smoke into the ring.",
    hint: "Place a fan beside the plume, then turn it toward the ring.",
    kit: [{ kind: "fan", count: 1 }],
    source: [0.30, 0.64], target: [0.68, 0.32], targetRadius: 0.045,
  },
  {
    id: "ledge", title: "Around the ledge",
    description: "Send the smoke around the ledge and into the ring.",
    hint: "One fan can move the plume sideways; the other can lift it past the ledge.",
    kit: [{ kind: "fan", count: 2 }],
    source: [0.35, 0.64], target: [0.70, 0.40], targetRadius: 0.045,
  },
  {
    id: "passage", title: "Make a passage",
    description: "Shape a clear path around the fixed wall.",
    hint: "Move the barrier and aim both fans. Leave space for the smoke to flow.",
    kit: [{ kind: "fan", count: 2 }, { kind: "block", count: 1 }],
    source: [0.28, 0.64], target: [0.71, 0.31], targetRadius: 0.045,
  },
];

export interface ChallengeTarget { x: number; y: number; r: number }
export interface ChallengeSetup {
  definition: ChallengeDef;
  world: World;
  fixedIds: Set<number>;
  target: ChallengeTarget;
}

export interface ChallengeProgress {
  fill: number;
  coverage: number;
  heldSeconds: number;
  complete: boolean;
  lastSampleTime: number | null;
}
export interface SmokeSample { fill: number; coverage: number; at: number }
export interface ChallengeKitItem {
  kind: ChallengeToolKind; label: string; total: number; remaining: number;
}
export interface ChallengeHud {
  id: ChallengeId;
  title: string;
  description: string;
  hint: string;
  status: "running" | "complete" | "error";
  fill: number;
  coverage: number;
  /** Stable-smoke confirmation, normalized to 0..1. */
  hold: number;
  probeReady: boolean;
  error: string | null;
  kit: ChallengeKitItem[];
  placement: ChallengeToolKind | null;
  selected: { id: number; kind: Gadget["kind"]; angle: number; fixed: boolean } | null;
  tools: { id: number; kind: Gadget["kind"]; angle: number; fixed: boolean; selected: boolean; x: number; y: number }[];
  /** CSS pixels relative to the complete canvas, including any letterbox. */
  screenTarget: ChallengeTarget;
  viewport: { x: number; y: number; width: number; height: number };
}

export const TARGET_FILL = 0.12;
export const TARGET_COVERAGE = 0.10;
export const TARGET_HOLD_SECONDS = 1.5;
export const VISIBLE_OPACITY = 0.02;

export function getChallenge(id: ChallengeId): ChallengeDef {
  const definition = CHALLENGES.find((challenge) => challenge.id === id);
  if (!definition) throw new Error(`Unknown challenge: ${id}`);
  return definition;
}

export function createChallengeSetup(
  id: ChallengeId, width: number, height: number,
  keptParams: SimParams, look: LookState, reducedMotion = false,
): ChallengeSetup {
  const definition = getChallenge(id);
  const world = createWorld(width, height);
  setHeldToolActive(world, false);
  setTool(world, "hand");
  world.params = { ...keptParams };
  world.look = { ...look, parallaxX: 0, parallaxY: 0, panVx: 0, panVy: 0, dragging: false };
  world.reducedMotion = reducedMotion;
  world.playing = true;
  world.gadgets = [];
  const fixedIds = new Set<number>();
  const fixed = (kind: "candle" | "block", x: number, y: number, tune?: (g: Gadget) => void) => {
    const gadget = createGadget(kind, width * x, height * y, false);
    tune?.(gadget);
    world.gadgets.push(gadget);
    fixedIds.add(gadget.id);
  };
  fixed("candle", ...definition.source);
  if (id === "ledge") fixed("block", 0.35, 0.47, (g) => { g.w = width * 0.28; g.h = 16; });
  if (id === "passage") fixed("block", 0.53, 0.48, (g) => { g.w = height * 0.20; g.h = 16; g.angle = Math.PI / 2; });
  return {
    definition, world, fixedIds,
    target: { x: width * definition.target[0], y: height * definition.target[1], r: Math.min(width, height) * definition.targetRadius },
  };
}

export function remainingKit(world: Pick<World, "gadgets">, setup: ChallengeSetup): ChallengeKitItem[] {
  return setup.definition.kit.map(({ kind, count }) => ({
    kind, label: kind === "fan" ? "Fan" : "Barrier", total: count,
    remaining: Math.max(0, count - world.gadgets.filter((g) => !g.bound && !setup.fixedIds.has(g.id) && g.kind === kind).length),
  }));
}

export function emptyChallengeProgress(): ChallengeProgress {
  return { fill: 0, coverage: 0, heldSeconds: 0, complete: false, lastSampleTime: null };
}

export function advanceChallengeProgress(progress: ChallengeProgress, sample: SmokeSample): ChallengeProgress {
  if (progress.complete || !Number.isFinite(sample.at) ||
      (progress.lastSampleTime !== null && sample.at <= progress.lastSampleTime)) return progress;
  const fill = Number.isFinite(sample.fill) ? Math.max(0, Math.min(1, sample.fill)) : 0;
  const coverage = Number.isFinite(sample.coverage) ? Math.max(0, Math.min(1, sample.coverage)) : 0;
  const gap = progress.lastSampleTime === null ? 0 : sample.at - progress.lastSampleTime;
  const passing = fill >= TARGET_FILL && coverage >= TARGET_COVERAGE;
  const wasPassing = progress.fill >= TARGET_FILL && progress.coverage >= TARGET_COVERAGE;
  const heldSeconds = passing && wasPassing && gap <= 0.4 ? Math.min(TARGET_HOLD_SECONDS,
    progress.heldSeconds + Math.min(0.15, Math.max(0, gap))) : 0;
  return { fill, coverage, heldSeconds, complete: heldSeconds >= TARGET_HOLD_SECONDS - 1e-6, lastSampleTime: sample.at };
}

const COMPLETIONS_KEY = "fume-challenges-v1";
export function readChallengeCompletions(): ChallengeId[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(COMPLETIONS_KEY) ?? "[]");
    return Array.isArray(saved) ? CHALLENGES.filter((item) => saved.includes(item.id)).map((item) => item.id) : [];
  } catch { return []; }
}
export function saveChallengeCompletion(id: ChallengeId): ChallengeId[] {
  const completed = new Set(readChallengeCompletions());
  if (CHALLENGES.some((item) => item.id === id)) completed.add(id);
  const result = CHALLENGES.filter((item) => completed.has(item.id)).map((item) => item.id);
  try { localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(result)); } catch { /* private mode */ }
  return result;
}
