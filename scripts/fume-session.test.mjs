import assert from "node:assert/strict";
import test from "node:test";
import { loadSessionModules } from "./session-test-loader.mjs";

loadSessionModules(
  new Map([
    [
      "fume-game.ts:./audio",
      "export class FumeAudio { unlock() {} pop() {} startBlow() {} stopBlow() {} setMuted() {} dispose() {} }",
    ],
    [
      "fume-game.ts:./renderer",
      `export class Renderer {
    static async create(_canvas, onGpuError) { const renderer = new Renderer(); renderer.onGpuError = onGpuError; return renderer; }
    resize() {} draw() {} dispose() {} enterSession(world,probe,onAllocationFailure) { this.world=world; this.probe=probe; this.onAllocationFailure=onAllocationFailure; return !this.fail; }
    replaceSession(world,probe,onAllocationFailure) { return this.enterSession(world,probe,onAllocationFailure); } restoreSession() { this.restored=true; }
  }`,
    ],
  ]),
);
const { FumeGame } = await import("../src/game/fume-game.ts");
const { sessionViewport, sessionPointer, sessionPoint } =
  await import("../src/game/session-view.ts");
const { createWorld, screenToWorld, stepWorld, STEP } = await import("../src/game/sim.ts");

async function mount(t) {
  const window = new EventTarget();
  Object.assign(window, {
    innerWidth: 1000,
    innerHeight: 700,
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
  });
  const document = new EventTarget();
  Object.assign(document, { hidden: false, body: {}, documentElement: {} });
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  Object.assign(globalThis, { window, document, cancelAnimationFrame() {} });
  const box = { left: 20, top: 30, width: 1000, height: 700 };
  const canvas = new EventTarget();
  Object.assign(canvas, { style: {}, getBoundingClientRect: () => box, setPointerCapture() {} });
  let hud;
  const game = new FumeGame(canvas, (value) => {
    hud = value;
  });
  await new Promise((resolve) => setImmediate(resolve));
  game.world.look.room = false;
  t.after(() => {
    game.destroy();
    Object.assign(globalThis, original);
  });
  const event = (type, x, y, extra = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      clientX: x + box.left,
      clientY: y + box.top,
      pointerId: 1,
      button: 0,
      deltaX: 0,
      deltaY: 0,
      deltaMode: 0,
      ...extra,
    });
    canvas.dispatchEvent(event);
  };
  const click = (x, y, extra) => {
    event("pointerdown", x, y, extra);
    event("pointerup", x, y, extra);
  };
  return { game, box, window, event, click, hud: () => hud };
}

test("playground world, queued smoke, time and fractional accumulator survive challenge/retry/resize exactly", async (t) => {
  const { game, box, window } = await mount(t);
  const world = game.world;
  world.time = 48.5;
  world.fluidSplats.push({
    x: 20,
    y: 30,
    density: 1,
    radius: 4,
    vx: 0,
    vy: 0,
    temp: 0,
    radial: 0,
    spin: 0,
  });
  game.acc = 0.006;
  assert.equal(game.enterChallenge("draft", { ...world.params }), true);
  const parked = structuredClone({ ...world, onPop: undefined });
  for (let i = 0; i < 60; i++) stepWorld(game.world, STEP);
  Object.assign(box, { width: 390, height: 844 });
  window.dispatchEvent(new Event("resize"));
  assert.equal(game.world.w, 1000);
  assert.equal(game.retryChallenge(), true);
  assert.equal(game.world.time, 0);
  assert.deepEqual(structuredClone({ ...world, onPop: undefined }), parked);
  game.leaveChallenge();
  assert.equal(game.world, world);
  assert.equal(game.acc, 0.006);
  assert.equal(game.world.time, 48.5);
  assert.equal(game.world.fluidSplats.length, 1);
  window.dispatchEvent(new Event("resize"));
  assert.equal(game.world.w, 1000);
  assert.equal(game.world.h, 700);
});

test("fixed objects resist drag, delete, angle, wheel and legacy scene/parameter commands", async (t) => {
  const { game, click, event } = await mount(t);
  game.enterChallenge("ledge", game.world.params);
  const fixed = game.world.gadgets[0];
  const saved = { ...fixed };
  const params = { ...game.world.params };
  game.selectChallengeGadget(fixed.id);
  game.setChallengeAngle(80);
  game.removeChallengeGadget();
  click(fixed.x, fixed.y, { button: 2 });
  event("wheel", fixed.x, fixed.y, { deltaY: 100, altKey: true });
  event("pointerdown", fixed.x, fixed.y);
  event("pointermove", fixed.x + 100, fixed.y + 60);
  event("pointerup", fixed.x + 100, fixed.y + 60);
  game.setParams({ ...params, buoyancy: 999 });
  game.loadScene("shelf");
  game.clearPlaced();
  game.setTool("wand");
  game.holdBlow(true);
  assert.deepEqual(fixed, saved);
  assert.deepEqual(game.world.params, params);
  assert.equal(game.world.gadgets.length, 2);
  assert.equal(game.world.tool, "hand");
  assert.equal(game.world.blowing, false);
});

test("kit placement is active, preview stays off, last fan can still be aimed before auto-Hand, and removal refunds", async (t) => {
  const { game, event, hud, click } = await mount(t);
  game.enterChallenge("draft", game.world.params);
  game.selectChallengeTool("block");
  assert.equal(game.world.tool, "hand");
  game.selectChallengeTool("fan");
  game.setHeldToolActive(true);
  assert.equal(game.world.gadgets.find((g) => g.bound).on, false);
  event("pointerdown", 450, 450);
  event("pointermove", 530, 450);
  const fan = game.world.gadgets.find((g) => g.kind === "fan" && !g.bound);
  assert.equal(fan.on, true);
  assert.equal(fan.angle, 0);
  assert.equal(game.world.dragId, fan.id);
  event("pointerup", 530, 450);
  assert.equal(game.world.tool, "hand");
  assert.equal(hud().challenge.kit[0].remaining, 0);
  game.selectChallengeTool("fan");
  assert.equal(game.world.tool, "hand");
  game.setChallengeAngle(90);
  assert.ok(Math.abs(fan.angle - Math.PI / 2) < 1e-12);
  click(550, 450);
  assert.equal(game.world.gadgets.filter((g) => g.kind === "fan").length, 1);
  game.selectChallengeGadget(fan.id);
  game.removeChallengeGadget();
  assert.equal(hud().challenge.kit[0].remaining, 1);
});

test("touch repositioning preserves challenge aim across simulation steps and camera input; explicit aim still works", async (t) => {
  const { game, box, window, hud, event } = await mount(t);
  Object.assign(box, { width: 390, height: 844 });
  window.dispatchEvent(new Event("resize"));
  game.enterChallenge("passage", game.world.params);
  const world = game.world;
  world.look.room = true;
  const fixed = world.gadgets.map((gadget) => ({ ...gadget }));
  const screen = (point) => sessionPoint(world, hud().challenge.viewport, point);
  const touch = (type, point, extra = {}) => {
    const at = screen(point);
    event(type, at.x, at.y, { pointerType: "touch", ...extra });
  };
  game.selectChallengeTool("fan");
  touch("pointerdown", { x: 140, y: 520 });
  touch("pointermove", { x: 180, y: 520 });
  const fan = world.gadgets.find((gadget) => gadget.kind === "fan" && !gadget.bound);
  assert.ok(Math.abs(fan.angle) < 1e-12, "initial touch placement still aims the fan");
  touch("pointerup", { x: 180, y: 520 });
  game.selectChallengeGadget(fan.id);
  game.setChallengeAngle(-37);
  const angle = fan.angle;
  world.look.panVx = 1;
  world.look.panVy = 0.2;
  touch("pointerdown", fan);
  touch("pointermove", { x: 175, y: 460 });
  assert.ok(Math.abs(fan.x - 175) < 1e-8 && Math.abs(fan.y - 460) < 1e-8);
  assert.equal(fan.angle, angle);
  for (let i = 0; i < 12; i++) stepWorld(world, STEP);
  assert.equal(fan.angle, angle, "applyDrag must not re-aim on the next simulation step");
  assert.ok(
    Math.abs(fan.x - 175) < 1e-8 && Math.abs(fan.y - 460) < 1e-8,
    "room inertia must not drift a tool held under a touch",
  );
  touch("wheel", fan, { deltaX: 35, deltaY: 20 });
  for (let i = 0; i < 12; i++) stepWorld(world, STEP);
  assert.equal(fan.angle, angle, "camera movement while held must preserve the angle too");
  game.setChallengeAngle(25);
  const aimed = fan.angle;
  touch("pointermove", { x: 190, y: 500 });
  for (let i = 0; i < 12; i++) stepWorld(world, STEP);
  assert.equal(fan.angle, aimed);
  assert.ok(Math.abs(aimed - (25 * Math.PI) / 180) < 1e-12);
  touch("pointerup", fan);
  assert.equal(world.dragId, null);
  assert.equal(world.look.dragging, false);
  for (const gadget of fixed)
    assert.deepEqual(
      world.gadgets.find((item) => item.id === gadget.id),
      gadget,
    );
});

test("touch-moving a challenge barrier preserves its drawn shape and angle", async (t) => {
  const { game, event } = await mount(t);
  game.enterChallenge("passage", game.world.params);
  game.selectChallengeTool("block");
  event("pointerdown", 680, 500, { pointerType: "touch" });
  event("pointermove", 800, 550, { pointerType: "touch" });
  event("pointerup", 800, 550, { pointerType: "touch" });
  const block = game.world.gadgets.find(
    (gadget) => gadget.kind === "block" && !game.challenge.setup.fixedIds.has(gadget.id),
  );
  const shape = { angle: block.angle, w: block.w, h: block.h };
  event("pointerdown", block.x, block.y, { pointerType: "touch" });
  event("pointermove", 700, 400, { pointerType: "touch" });
  for (let i = 0; i < 12; i++) stepWorld(game.world, STEP);
  event("pointerup", 700, 400, { pointerType: "touch" });
  assert.equal(block.x, 700);
  assert.equal(block.y, 400);
  assert.deepEqual({ angle: block.angle, w: block.w, h: block.h }, shape);
});

test("playground Hand touch still uses the original move-and-aim fan behavior", async (t) => {
  const { game, event, click } = await mount(t);
  game.setTool("fan");
  click(500, 450);
  game.setTool("hand");
  const fan = game.world.gadgets.find((gadget) => gadget.kind === "fan" && !gadget.bound);
  event("pointerdown", 500, 450, { pointerType: "touch" });
  event("pointermove", 580, 490, { pointerType: "touch" });
  stepWorld(game.world, STEP);
  assert.ok(Math.abs(fan.angle - Math.atan2(40, 80)) < 1e-12);
  assert.ok(Math.abs(fan.x - 580) < 1e-8 && Math.abs(fan.y - 490) < 1e-8);
  event("pointerup", 580, 490, { pointerType: "touch" });
});

test("viewport maps resized pointer and overlays identically; letterbox clicks cannot place", async (t) => {
  const { game, box, window, hud, click } = await mount(t);
  game.enterChallenge("draft", game.world.params);
  Object.assign(box, { width: 390, height: 844 });
  window.dispatchEvent(new Event("resize"));
  const view = hud().challenge.viewport;
  assert.deepEqual(view, { x: 0, y: 285.5, width: 390, height: 273 });
  game.selectChallengeTool("fan");
  click(195, 20);
  assert.equal(hud().challenge.kit[0].remaining, 1);
  click(195, 422);
  const fan = game.world.gadgets.find((g) => g.kind === "fan" && !g.bound);
  assert.equal(fan.x, 500);
  assert.equal(fan.y, 350);
  assert.equal(hud().challenge.tools.find((g) => g.id === fan.id).x, 195);
  assert.equal(hud().challenge.tools.find((g) => g.id === fan.id).y, 422);
});

test("stale samples after retry and return cannot complete the current session; allocation failure restores playground", async (t) => {
  const { game, hud } = await mount(t);
  const world = game.world;
  game.enterChallenge("draft", world.params);
  const stale = game.renderer.probe;
  game.retryChallenge();
  stale.onSample({ fill: 1, coverage: 1, at: 1 });
  assert.equal(hud().challenge.probeReady, false);
  const live = game.renderer.probe;
  live.onError("test failure");
  assert.equal(hud().challenge.status, "error");
  game.renderer.fail = true;
  assert.equal(game.retryChallenge(), false);
  assert.equal(game.world, world);
  assert.equal(hud().challenge, null);
  live.onSample({ fill: 1, coverage: 1, at: 2 });
  assert.equal(hud().challenge, null);
});

test("initial allocation failure preserves the playground; GPU loss blocks entry and ignores late probe results", async (t) => {
  t.mock.method(console, "error", () => {});
  const { game, hud } = await mount(t);
  const world = game.world;
  game.acc = 0.007;
  const saved = structuredClone({ ...world, onPop: undefined });
  game.renderer.fail = true;
  assert.equal(game.enterChallenge("draft", world.params), false);
  assert.equal(game.world, world);
  assert.equal(game.acc, 0.007);
  assert.deepEqual(structuredClone({ ...world, onPop: undefined }), saved);
  assert.equal(hud().challenge, null);
  game.renderer.fail = false;
  assert.equal(game.enterChallenge("draft", world.params), true);
  const probe = game.renderer.probe;
  const progress = { ...game.challenge.progress };
  game.renderer.onGpuError(
    "The GPU connection was lost. Smoke buffers cannot be restored; reload to continue.",
  );
  assert.equal(hud().challenge.status, "error");
  assert.match(hud().glError, /cannot be restored; reload/i);
  for (let at = 1; at < 4; at += 0.1) probe.onSample({ fill: 1, coverage: 1, at });
  assert.deepEqual(game.challenge.progress, progress);
  assert.equal(game.retryChallenge(), false);
  assert.equal(game.enterChallenge("ledge", world.params), false);
  game.leaveChallenge();
  assert.equal(
    game.world,
    world,
    "CPU scene remains available without claiming GPU smoke recovery",
  );
  assert.equal(hud().challenge, null);
  assert.match(hud().glError, /reload/i);
  assert.equal(game.enterChallenge("draft", world.params), false);
});

test("projected target circles and points round-trip under both aspect ratios and room pan", () => {
  for (const [width, height] of [
    [390, 844],
    [1440, 900],
  ]) {
    const world = createWorld(1000, 700);
    Object.assign(world.look, { room: true, parallaxX: 0.7, parallaxY: -0.3 });
    const view = sessionViewport(width, height, world.w, world.h);
    const point = { x: 600, y: 280, r: 30 };
    const screen = sessionPoint(world, view, point);
    const logical = sessionPointer(view, world.w, world.h, screen.x, screen.y);
    const returned = screenToWorld(world, logical.x, logical.y);
    assert.ok(Math.abs(returned.x - point.x) < 1e-8);
    assert.ok(Math.abs(returned.y - point.y) < 1e-8);
    const top = sessionPoint(world, view, { x: point.x, y: point.y - point.r });
    assert.ok(Math.abs(screen.y - top.y - screen.r) < 1e-8);
  }
});

test("asynchronous allocation rollback restores CPU session and reports a dismissible nonfatal notice", async (t) => {
  const { game, hud } = await mount(t);
  const world = game.world;
  game.acc = 0.004;
  world.time = 32;
  game.enterChallenge("draft", world.params);
  const saved = structuredClone({ ...world, onPop: undefined });
  const stale = game.renderer.onAllocationFailure;
  game.retryChallenge();
  stale("obsolete allocation failure");
  assert.notEqual(game.world, world);
  const live = game.renderer.onAllocationFailure;
  live("out of memory allocating buffer");
  assert.equal(game.world, world);
  assert.equal(game.acc, 0.004);
  assert.deepEqual(structuredClone({ ...world, onPop: undefined }), saved);
  assert.equal(hud().challenge, null);
  assert.equal(hud().glError, null);
  assert.match(hud().sessionNotice, /graphics memory.*including its smoke/i);
  game.dismissSessionNotice();
  assert.equal(hud().sessionNotice, null);
  assert.equal(game.enterChallenge("draft", world.params), true);
  game.leaveChallenge();
  live("late allocation failure after return");
  assert.equal(hud().sessionNotice, null);
});
