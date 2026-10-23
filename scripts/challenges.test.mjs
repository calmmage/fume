import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      return next(new URL(`${specifier}.ts`, context.parentURL).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return next(url, context);
  },
});
const {
  CHALLENGES, getChallenge, createChallengeSetup, remainingKit,
  emptyChallengeProgress, advanceChallengeProgress,
  readChallengeCompletions, saveChallengeCompletion,
} = await import("../src/game/challenges.ts");
const { DEFAULT_PARAMS } = await import("../src/game/params.ts");
const { DEFAULT_LOOK } = await import("../src/game/look.ts");

test("three accessible puzzles use the kept preset unchanged, with fixed sources and finite distinct toolkits", () => {
  const kept = { ...DEFAULT_PARAMS, vorticity: 7, smokeDecay: 0.18 };
  const look = { ...DEFAULT_LOOK, roomStyle: "stone", parallaxX: 0.2, panVx: 0.3 };
  const before = JSON.stringify({ kept, look });
  assert.deepEqual(CHALLENGES.map((definition) => definition.id), ["draft", "ledge", "passage"]);
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const definition of CHALLENGES) {
      const setup = createChallengeSetup(definition.id, width, height, kept, look);
      assert.equal(setup.definition, definition);
      assert.deepEqual(setup.world.params, kept);
      assert.notEqual(setup.world.params, kept);
      assert.equal(setup.world.tool, "hand");
      assert.equal(setup.world.heldToolActive, false);
      assert.equal(setup.world.look.roomStyle, "stone");
      assert.equal(setup.world.look.parallaxX, 0);
      assert.equal(setup.world.look.panVx, 0);
      assert.equal(setup.world.gadgets.filter((g) => g.kind === "candle").length, 1);
      assert.ok(setup.world.gadgets.every((g) => setup.fixedIds.has(g.id) && g.on && !g.bound));
      assert.deepEqual(remainingKit(setup.world, setup).map(({ kind, total, remaining }) => ({ kind, total, remaining })),
        definition.kit.map(({ kind, count }) => ({ kind, total: count, remaining: count })));
      assert.ok(setup.target.r > 0);
      assert.ok(setup.target.x - setup.target.r > 0 && setup.target.x + setup.target.r < width);
      assert.ok(setup.target.y - setup.target.r > 0 && setup.target.y + setup.target.r < height);
    }
  }
  assert.equal(JSON.stringify({ kept, look }), before);
  assert.throws(() => getChallenge("unknown"));
});

test("kit quantities count active placed copies, ignore previews and fixed barriers, and recover on removal", () => {
  const setup = createChallengeSetup("passage", 1440, 900, DEFAULT_PARAMS, DEFAULT_LOOK);
  const held = { id: -1, kind: "fan", bound: true };
  setup.world.gadgets.push(held);
  assert.equal(remainingKit(setup.world, setup)[0].remaining, 2);
  setup.world.gadgets.push({ id: -2, kind: "fan", bound: false });
  assert.equal(remainingKit(setup.world, setup)[0].remaining, 1);
  setup.world.gadgets.push({ id: -3, kind: "fan", bound: false });
  assert.equal(remainingKit(setup.world, setup)[0].remaining, 0);
  setup.world.gadgets.push({ id: -4, kind: "fan", bound: false });
  assert.equal(remainingKit(setup.world, setup)[0].remaining, 0);
  setup.world.gadgets = setup.world.gadgets.filter((g) => g.id !== -2 && g.id !== -4);
  assert.equal(remainingKit(setup.world, setup)[0].remaining, 1);
  assert.equal(remainingKit(setup.world, setup)[1].remaining, 1, "fixed obstruction does not spend the movable barrier");
});

test("visible smoke must cover the target stably; faint traces and one dense pixel cannot complete", () => {
  for (const sample of [{ fill: 0, coverage: 0 }, { fill: 0.005, coverage: 0.4 }, { fill: 0.3, coverage: 1 / 200 }]) {
    let progress = emptyChallengeProgress();
    for (let tick = 0; tick < 100; tick++) progress = advanceChallengeProgress(progress, { ...sample, at: tick / 10 });
    assert.equal(progress.complete, false);
    assert.equal(progress.heldSeconds, 0);
  }
  let progress = emptyChallengeProgress();
  for (let tick = 0; tick < 15; tick++) progress = advanceChallengeProgress(progress, { fill: 0.2, coverage: 0.2, at: tick / 10 });
  assert.equal(progress.complete, false);
  progress = advanceChallengeProgress(progress, { fill: 0.2, coverage: 0.2, at: 1.5 });
  assert.equal(progress.complete, true);
  assert.equal(advanceChallengeProgress(progress, { fill: 0, coverage: 0, at: 2 }), progress, "completion latches");
});

test("a dip, stale result or suspended session cannot falsely accumulate confirmation time", () => {
  let progress = emptyChallengeProgress();
  for (let tick = 0; tick < 10; tick++) progress = advanceChallengeProgress(progress, { fill: 0.2, coverage: 0.2, at: tick / 10 });
  assert.equal(advanceChallengeProgress(progress, { fill: 1, coverage: 1, at: 0.5 }), progress);
  progress = advanceChallengeProgress(progress, { fill: 0, coverage: 0, at: 1 });
  assert.equal(progress.heldSeconds, 0);
  progress = advanceChallengeProgress(progress, { fill: 1, coverage: 1, at: 1.1 });
  assert.equal(progress.heldSeconds, 0, "first passing sample begins confirmation");
  progress = advanceChallengeProgress(progress, { fill: 1, coverage: 1, at: 90 });
  assert.equal(progress.complete, false);
  assert.equal(progress.heldSeconds, 0, "hidden elapsed time is not progress");
  progress = advanceChallengeProgress(progress, { fill: NaN, coverage: Infinity, at: 90.1 });
  assert.equal(progress.fill, 0);
  assert.equal(progress.coverage, 0);
});

test("completion persistence is separate, ordered, resilient and never touches smoke or look keys", () => {
  const previous = globalThis.localStorage;
  const data = new Map([["fume-params-v8", "owner settings"], ["fume-preset-kept", "approved preset"], ["fume-look-v2", "owner room"]]);
  globalThis.localStorage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  try {
    assert.deepEqual(readChallengeCompletions(), []);
    assert.deepEqual(saveChallengeCompletion("passage"), ["passage"]);
    assert.deepEqual(saveChallengeCompletion("draft"), ["draft", "passage"]);
    assert.deepEqual(saveChallengeCompletion("draft"), ["draft", "passage"]);
    assert.equal(data.get("fume-params-v8"), "owner settings");
    assert.equal(data.get("fume-preset-kept"), "approved preset");
    assert.equal(data.get("fume-look-v2"), "owner room");
    data.set("fume-challenges-v1", "{bad");
    assert.deepEqual(readChallengeCompletions(), []);
    globalThis.localStorage = { getItem() { throw new Error("private mode"); }, setItem() { throw new Error("private mode"); } };
    assert.deepEqual(saveChallengeCompletion("ledge"), ["ledge"]);
  } finally { globalThis.localStorage = previous; }
});
