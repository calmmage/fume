import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const srcRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./audio" && context.parentURL?.endsWith("/fume-game.ts")) {
      return { url: "data:text/javascript,export class FumeAudio { unlock() {} pop() {} startBlow() {} stopBlow() {} setMuted() {} dispose() {} }", shortCircuit: true };
    }
    if (specifier === "./renderer" && context.parentURL?.endsWith("/fume-game.ts")) {
      return { url: "data:text/javascript,export class Renderer { static async create() { return new Renderer(); } resize() {} draw() {} dispose() {} }", shortCircuit: true };
    }
    const relative = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), srcRoot)
      : specifier.startsWith(".") && context.parentURL?.startsWith(srcRoot.href)
        ? new URL(specifier, context.parentURL)
        : null;
    if (relative) {
      for (const extension of [".ts", ".tsx"]) {
        const url = new URL(relative.href + extension);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(srcRoot.href) && /\.tsx?$/.test(url)) {
      const output = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        fileName: fileURLToPath(url),
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      });
      return { format: "module", source: output.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const sim = await import("../src/game/sim.ts");
const { FumeGame } = await import("../src/game/fume-game.ts");
const { ToolDock } = await import("../src/components/tool-dock.tsx");
const { TOOLS } = await import("../src/game/tools.ts");

function mountGame(t) {
  const win = new EventTarget();
  Object.assign(win, { innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1, matchMedia: () => ({ matches: false }) });
  const doc = new EventTarget();
  Object.assign(doc, { hidden: false, body: { tagName: "BODY" }, documentElement: { tagName: "HTML" } });
  const previous = { window: globalThis.window, document: globalThis.document, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  Object.assign(globalThis, { window: win, document: doc, cancelAnimationFrame() {} });
  const canvas = new EventTarget();
  Object.assign(canvas, { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }), setPointerCapture() {} });
  const snapshots = [];
  const game = new FumeGame(canvas, (snapshot) => snapshots.push(snapshot));
  game.world.look.room = false;
  t.after(() => { game.destroy(); Object.assign(globalThis, previous); });
  const event = (type, x, y, extra = {}) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { clientX: x, clientY: y, pointerId: 1, button: 0, deltaX: 0, deltaY: 0, deltaMode: 0, ...extra });
    canvas.dispatchEvent(e);
    return e;
  };
  const click = (x, y, extra) => { event("pointerdown", x, y, extra); event("pointerup", x, y, extra); };
  return { game, world: game.world, snapshots, event, click };
}

test("Empty uses identity placement even with old room framing and camera offsets", () => {
  for (const [w,h] of [[390,844],[1440,900]]) {
    const world=sim.createWorld(w,h);
    Object.assign(world.look,{room:true,roomStyle:"empty",parallaxX:20,parallaxY:.65,roomX:.2,roomY:.75});
    for(const [x,y] of [[0,0],[w,h],[w*.2,h*.8]]) assert.deepEqual(sim.screenToWorld(world,x,y),{x,y});
  }
});

test("long Geometry scrolling stops the room and dust camera together and reverses immediately", () => {
  const world=sim.createWorld(1000,700);
  Object.assign(world.look,{room:true,roomStyle:"geometry"});
  sim.panRoom(world,100_000,-100_000,.1);
  assert.equal(world.look.parallaxX,1.5);
  assert.equal(world.look.parallaxY,-.65);
  assert.equal(world.look.panVx,0);
  assert.equal(world.look.panVy,0);
  sim.panRoom(world,-10,10,.1);
  assert.ok(world.look.parallaxX<1.5&&world.look.parallaxY>-.65);
  assert.ok(world.look.panVx<0&&world.look.panVy>0);
});

test("room projection keeps bubble radii circular across portrait, landscape, and room proportions", () => {
  for (const [w, h] of [[390, 844], [650, 708], [1440, 900], [900, 900]]) {
    for (const [roomW, roomH] of [[0.9, 0.62], [0.3, 1.2], [1.5, 0.3]]) {
      const world = sim.createWorld(w, h);
      Object.assign(world.look, { room: true, roomStyle: "geometry", roomW, roomH, parallaxX: 0.4, parallaxY: -0.2 });
      const center = sim.screenToWorld(world, w / 2, h / 2);
      const right = sim.screenToWorld(world, w / 2 + 20, h / 2);
      const below = sim.screenToWorld(world, w / 2, h / 2 + 20);
      const scaleX = right.x - center.x;
      const scaleY = below.y - center.y;
      assert.ok(Math.abs(scaleX - scaleY) < 1e-8,
        `${w}x${h}, room ${roomW}x${roomH}: a circular bubble renders at width/height ${scaleY / scaleX}`);
    }
  }
});

test("Geometry has no artificial smoke ceiling or side boundary anywhere on the canvas", () => {
  for (const [w, h] of [[390, 844], [650, 708], [1440, 900], [1920, 600]]) {
    const world = sim.createWorld(w, h);
    Object.assign(world.look, { room: true, roomStyle: "geometry" });
    for (const [roomW, roomH, roomDepth, sceneZ] of [[0.9, 0.62, 5, 0.35], [0.35, 0.25, 9, 0.88], [1.6, 1.2, 1.6, 0.12]]) {
      Object.assign(world.look, { roomW, roomH, roomDepth, sceneZ });
      for (const [roomX, roomY] of [[0.2, 0.25], [0.5, 0.5], [0.8, 0.75]]) {
        for (const panX of [-1e6, 0, 1e6]) {
          for (const panY of [-0.65, 0, 0.65]) {
            Object.assign(world.look, { roomX, roomY, parallaxX: panX, parallaxY: panY });
            for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h * 0.1]]) {
              const p = sim.screenToWorld(world, x, y);
              assert.ok(p.x > 0 && p.x < w, `${w}×${h}: visible x=${x} must sample live fluid`);
              assert.ok(p.y > 0 && p.y < h, `${w}×${h}: visible y=${y} must sample live fluid`);
            }
          }
        }
      }
    }
  }
});

test("empty scene starts with only an active held Candle, no placed tools or bubbles", () => {
  const world = sim.createWorld(1000, 700);
  assert.equal(world.tool, "candle");
  assert.equal(world.heldToolActive, true);
  const held = world.gadgets.filter((g) => g.bound);
  assert.equal(held.length, 1);
  assert.equal(held[0].kind, "candle");
  assert.equal(held[0].on, true);
  assert.equal(world.gadgets.filter((g) => !g.bound).length, 0);
  assert.equal(world.bubbles.length, 0);
});

test("Shelf and the other saved layouts remain available after an empty start", () => {
  const world = sim.createWorld(1000, 700);
  sim.applyScene(world, "shelf");
  assert.deepEqual(world.gadgets.filter((g) => !g.bound).map((g) => g.kind), ["candle", "block"]);
  sim.applyScene(world, "hearth");
  assert.deepEqual(world.gadgets.filter((g) => !g.bound).map((g) => g.kind), ["fire", "block", "candle", "vent"]);
  sim.applyScene(world, "empty");
  assert.equal(world.gadgets.length, 1);
  assert.equal(world.gadgets[0].kind, "candle");
  assert.equal(world.gadgets[0].bound, true);
});

test("Empty stays empty before Begin even when the former demo random condition would trigger", (t) => {
  const world = sim.createWorld(1000, 700);
  t.mock.method(Math, "random", () => 0);
  for (let i = 0; i < 180; i++) sim.stepWorld(world, sim.STEP);
  assert.equal(world.playing, false);
  assert.equal(world.bubbles.length, 0);
  assert.equal(world.gadgets.filter((g) => !g.bound).length, 0);
  assert.equal(world.gadgets[0].bound, true);
  assert.equal(world.gadgets[0].on, true);
});

test("held-effect toggle never changes placed tools or the activity of new copies", () => {
  const world = sim.createWorld(1000, 700);
  const first = sim.placeGadgetAt(world, 100, 100);
  sim.setHeldToolActive(world, false);
  assert.equal(world.gadgets.find((g) => g.bound).on, false);
  assert.equal(first.on, true);
  const second = sim.placeGadgetAt(world, 200, 100);
  assert.equal(second.on, true);
  sim.setTool(world, "fan");
  assert.equal(world.gadgets.find((g) => g.bound).on, false);
  sim.setHeldToolActive(world, true);
  assert.equal(first.on, true);
  assert.equal(second.on, true);
  assert.equal(world.gadgets.find((g) => g.bound).on, true);
});

test("Fire starts upright for the held preview, placed copies, and the Hearth scene", (t) => {
  const { game, world, click } = mountGame(t);
  game.setTool("fire");
  const held = world.gadgets.find((g) => g.bound);
  assert.equal(held.angle, 0, "the upward local flame must not receive a quarter-turn");
  click(400, 300);
  const placed = world.gadgets.find((g) => !g.bound && g.kind === "fire");
  assert.equal(placed.angle, 0);
  assert.deepEqual([placed.w, placed.h, placed.power], [64, 34, 1.15], "source size and strength remain unchanged");
  sim.rotateGadget(world, held, 0.4);
  click(650, 300);
  assert.equal(world.gadgets.filter((g) => !g.bound && g.kind === "fire").at(-1).angle, 0.4, "deliberate rotation is still copied");
  sim.applyScene(world, "hearth");
  const hearth = world.gadgets.find((g) => !g.bound && g.kind === "fire");
  assert.equal(hearth.angle, 0);
  assert.deepEqual([hearth.w, hearth.h, hearth.power], [70, 38, 1.15]);
});

test("primary gadget clicks always place, including over a placed tool or a bubble", (t) => {
  const { game, world, click, snapshots } = mountGame(t);
  world.gadgets = world.gadgets.filter((g) => g.bound);
  world.bubbles = [];
  click(200, 200);
  game.setHeldToolActive(false);
  click(200, 200);
  const bubble = sim.spawnBubble(world, 600, 300, 40);
  click(600, 300);
  const placed = world.gadgets.filter((g) => !g.bound);
  assert.equal(placed.length, 3);
  assert.ok(placed.every((g) => g.kind === "candle" && g.on));
  assert.equal(bubble.popping, false);
  assert.equal(snapshots.at(-1).heldToolActive, false);
});

test("Hand moves an existing tool and pans empty space without spawning", (t) => {
  const { game, world, event } = mountGame(t);
  world.gadgets = world.gadgets.filter((g) => g.bound);
  world.bubbles = [];
  const candle = sim.placeGadgetAt(world, 200, 200);
  game.setTool("hand");
  event("pointerdown", 200, 200);
  event("pointermove", 260, 240);
  event("pointerup", 260, 240);
  assert.equal(candle.x, 260);
  assert.equal(candle.y, 240);
  assert.equal(world.gadgets.length, 1);
  assert.equal(world.look.parallaxX, 0);
  event("pointerdown", 700, 400);
  event("pointermove", 780, 400);
  event("pointerup", 780, 400);
  assert.ok(world.look.parallaxX > 0);
  assert.equal(world.gadgets.length, 1);
});

test("every image background maps the pointer through the same bounded pan offset as the image", (t) => {
  const { game, world, click, event } = mountGame(t);
  const expected = (x, y) => ({
    x: ((x / world.w - Math.tanh(world.look.parallaxX) * 0.11 - 0.5) / 1.28 + 0.5) * world.w,
    y: ((y / world.h - Math.tanh(world.look.parallaxY * 2) * 0.08 - 0.5) / 1.28 + 0.5) * world.h,
  });
  Object.assign(world.look, { room: true, roomStyle: "cosmos", roomDepth: 8, sceneZ: 0.8 });
  for (const style of ["pixel", "wood", "stone", "cosmos"]) {
    world.look.roomStyle = style;
    Object.assign(world.look, { parallaxX: 0, parallaxY: 0 });
    assert.deepEqual(sim.screenToWorld(world, 500, 350), { x: 500, y: 350 }, `${style} starts centered`);
    assert.deepEqual(sim.screenToWorld(world, 40, 45), expected(40, 45), `${style} includes pan margin before movement`);
    Object.assign(world.look, { parallaxX: 0.6, parallaxY: -0.4 });
    for (const [x, y] of [[40, 45], [950, 650], [500, 350]]) {
      const mapped = expected(x, y);
      assert.deepEqual(sim.screenToWorld(world, x, y), mapped, style);
      click(x, y);
      const placed = world.gadgets.filter((g) => !g.bound).at(-1);
      assert.ok(Math.abs(placed.x - mapped.x) < 1e-8, style);
      assert.ok(Math.abs(placed.y - mapped.y) < 1e-8, style);
    }
  }
  const candle = world.gadgets.find((g) => !g.bound);
  game.setTool("hand");
  event("pointerdown", 40, 45);
  event("pointermove", 80, 90);
  event("pointerup", 80, 90);
  assert.ok(Math.abs(candle.x - expected(80, 90).x) < 1e-8);
  assert.ok(Math.abs(candle.y - expected(80, 90).y) < 1e-8);
  sim.panRoom(world, 100, 40, 0.016);
  assert.deepEqual(sim.screenToWorld(world, 80, 90), expected(80, 90));
  world.look.room = false;
  assert.deepEqual(sim.screenToWorld(world, 80, 90), { x: 80, y: 90 }, "flat view ignores room pan");
  world.look.room = true;
  world.look.roomStyle = "geometry";
  assert.deepEqual(sim.screenToWorld(world, 80, 90), expected(80, 90), "Geometry also keeps its full visible canvas inside the field");
});

test("image-view corners stay inside the smoke field even at extreme pan and aspect ratios", () => {
  for (const [w, h] of [[1000, 700], [390, 844], [1920, 600]]) {
    const world = sim.createWorld(w, h);
    world.look.room = true;
    for (const style of ["pixel", "wood", "stone", "cosmos"]) {
      world.look.roomStyle = style;
      for (const panX of [-1e6, 0, 1e6]) {
        for (const panY of [-1e6, 0, 1e6]) {
          Object.assign(world.look, { parallaxX: panX, parallaxY: panY });
          for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
            const p = sim.screenToWorld(world, x, y);
            assert.ok(p.x > 0 && p.x < w, `${style} ${w}×${h} corner x stays in the field`);
            assert.ok(p.y > 0 && p.y < h, `${style} ${w}×${h} corner y stays in the field`);
            const screenX = ((p.x / w - 0.5) * 1.28 + 0.5 + Math.tanh(panX) * 0.11) * w;
            const screenY = ((p.y / h - 0.5) * 1.28 + 0.5 + Math.tanh(panY * 2) * 0.08) * h;
            assert.ok(Math.abs(screenX - x) < 1e-8, "rendered tool returns to its pointer x");
            assert.ok(Math.abs(screenY - y) < 1e-8, "rendered tool returns to its pointer y");
          }
        }
      }
    }
  }
});

test("Wand still blows on hold, releases on lift, and pops on a circle click", (t) => {
  const { game, world, event, click } = mountGame(t);
  world.gadgets = [];
  world.bubbles = [];
  game.setTool("wand");
  event("pointerdown", 400, 400);
  assert.equal(world.blowing, true);
  sim.stepWorld(world, sim.STEP);
  assert.equal(world.bubbles.length, 1);
  assert.equal(world.bubbles[0].attached, true);
  event("pointerup", 400, 400);
  assert.equal(world.blowing, false);
  assert.equal(world.bubbles[0].attached, false);
  const bubble = world.bubbles[0];
  click(bubble.x, bubble.y);
  assert.equal(bubble.popping, true);
});

test("Block still draws to size, and a new fan can be aimed and resized", (t) => {
  const { game, world, event } = mountGame(t);
  world.gadgets = [];
  world.bubbles = [];
  game.setTool("block");
  event("pointerdown", 200, 200);
  event("pointermove", 360, 200);
  event("pointerup", 360, 200);
  const block = world.gadgets.find((g) => !g.bound);
  assert.equal(block.w, 160);
  assert.equal(block.x, 280);
  assert.equal(block.on, true);
  game.setTool("fan");
  event("pointerdown", 600, 400);
  event("pointermove", 680, 400);
  event("pointerup", 680, 400);
  const fan = world.gadgets.find((g) => !g.bound && g.kind === "fan");
  assert.equal(fan.x, 600);
  assert.equal(fan.angle, 0);
  event("wheel", 600, 400, { deltaY: 100, altKey: true });
  assert.equal(fan.angle, 0.4);
  const width = fan.w;
  event("wheel", 600, 400, { deltaY: -100, shiftKey: true });
  assert.ok(fan.w > width);
});

test("unmodified trackpad scrolling pans both axes for every tool without changing zoom or gadgets", (t) => {
  const { game, world, event } = mountGame(t);
  const candle = sim.placeGadgetAt(world, 400, 300);
  for (const tool of ["hand", "wand", "candle", "smoke", "fan", "block", "vent", "vortex", "fire"]) {
    game.setTool(tool);
    Object.assign(world.look, { parallaxX: 0, parallaxY: 0, panVx: 2, panVy: 1 });
    const gadgets = structuredClone(world.gadgets);
    const sceneZ = world.look.sceneZ;
    const depth = world.look.roomDepth;
    const wheel = event("wheel", candle.x, candle.y, { deltaX: 60, deltaY: 40 });
    assert.equal(wheel.defaultPrevented, true);
    assert.equal(world.look.parallaxX, -0.06, tool);
    assert.ok(Math.abs(world.look.parallaxY - -0.024) < 1e-8, tool);
    assert.deepEqual(world.gadgets, gadgets, tool);
    assert.equal(world.look.sceneZ, sceneZ, "scroll does not zoom the scene");
    assert.equal(world.look.roomDepth, depth);
    assert.equal(world.look.panVx, 0);
    assert.equal(world.look.panVy, 0);
  }
  const position = { x: world.look.parallaxX, y: world.look.parallaxY };
  sim.stepWorld(world, sim.STEP);
  assert.equal(world.look.parallaxX, position.x, "browser momentum is not amplified by room inertia");
  assert.equal(world.look.parallaxY, position.y);
});

test("wheel line/page units are normalized and Ctrl pinch stays native", (t) => {
  const { world, event } = mountGame(t);
  event("wheel", 400, 300, { deltaX: 2, deltaY: 3, deltaMode: 1 });
  assert.equal(world.look.parallaxX, -0.032);
  assert.ok(Math.abs(world.look.parallaxY - (-48 / 700 * 0.42)) < 1e-8);
  Object.assign(world.look, { parallaxX: 0, parallaxY: 0 });
  event("wheel", 400, 300, { deltaX: 0.1, deltaY: 0.1, deltaMode: 2 });
  assert.equal(world.look.parallaxX, -0.1);
  assert.ok(Math.abs(world.look.parallaxY - -0.042) < 1e-8);
  const before = { look: structuredClone(world.look), gadgets: structuredClone(world.gadgets) };
  for (const modifiers of [{ ctrlKey: true }, { ctrlKey: true, shiftKey: true }, { metaKey: true }]) {
    const wheel = event("wheel", 400, 300, { deltaY: 100, ...modifiers });
    assert.equal(wheel.defaultPrevented, false);
    assert.deepEqual(world.look, before.look);
    assert.deepEqual(world.gadgets, before.gadgets);
  }
});

test("scrolling the camera never re-aims a held fan on the next simulation step", (t) => {
  const { game, world, event } = mountGame(t);
  world.look.room = true;
  for (const style of ["geometry", "cosmos", "pixel", "wood", "stone"]) {
    world.look.roomStyle = style;
    game.setTool("fan");
    event("pointermove", 400, 300);
    const fan = world.gadgets.find((g) => g.bound);
    const angle = fan.angle;
    event("wheel", 400, 300, { deltaX: 60, deltaY: 40 });
    sim.stepWorld(world, sim.STEP);
    assert.equal(fan.angle, angle, style);
  }
});

test("modifier scrolling deliberately adjusts Block, Vortex, and fan without panning", (t) => {
  const { game, world, event } = mountGame(t);
  game.setTool("block");
  const block = world.gadgets.find((g) => g.bound);
  const thickness = block.h;
  event("wheel", 400, 300, { deltaY: -100, shiftKey: true });
  assert.ok(block.h > thickness);
  const width = block.w;
  event("wheel", 400, 300, { deltaY: -100, altKey: true });
  assert.ok(block.w > width);
  event("wheel", 400, 300, { deltaY: 100, shiftKey: true, altKey: true });
  assert.equal(block.shape, 1);
  game.setTool("vortex");
  const vortex = world.gadgets.find((g) => g.bound);
  event("wheel", 400, 300, { deltaY: 100, altKey: true });
  assert.ok(vortex.power < 0);
  const size = vortex.w;
  event("wheel", 400, 300, { deltaX: -100, shiftKey: true });
  assert.ok(vortex.w > size, "horizontal Shift-wheel events still resize");
  game.setTool("fan");
  const fan = world.gadgets.find((g) => g.bound);
  const ratio = fan.w / fan.h;
  event("wheel", 400, 300, { deltaY: -100, shiftKey: true, altKey: true });
  assert.ok(fan.w / fan.h > ratio);
  assert.equal(world.look.parallaxX, 0);
  assert.equal(world.look.parallaxY, 0);
});

test("right click deletes a placed device and clearing keeps the held tool", (t) => {
  const { game, world, click } = mountGame(t);
  world.gadgets = world.gadgets.filter((g) => g.bound);
  click(200, 200);
  click(200, 200, { button: 2 });
  assert.equal(world.gadgets.filter((g) => !g.bound).length, 0);
  click(300, 300);
  game.clearPlaced();
  assert.equal(world.gadgets.length, 1);
  assert.equal(world.gadgets[0].bound, true);
  assert.equal(world.gadgets[0].on, true);
});

test("Space preserves focused UI activation and still blows from the room", (t) => {
  const { game, world } = mountGame(t);
  game.setTool("wand");
  const keyboard = (type, target) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperties(e, { code: { value: "Space" }, target: { value: target } });
    window.dispatchEvent(e);
    return e;
  };
  for (const target of [{ tagName: "BUTTON", role: "switch" }, { tagName: "SELECT" }, { tagName: "INPUT" }]) {
    const e = keyboard("keydown", target);
    assert.equal(e.defaultPrevented, false, `${target.tagName} keeps its native Space behavior`);
    assert.equal(world.blowing, false);
    keyboard("keyup", target);
  }
  assert.equal(keyboard("keydown", document.body).defaultPrevented, true);
  assert.equal(world.blowing, true);
  keyboard("keyup", document.body);
  assert.equal(world.blowing, false);
  game.setTool("candle");
  assert.equal(keyboard("keydown", document.body).defaultPrevented, false);
});

test("losing focus ends a tool drag before the next hover movement", (t) => {
  const { game, world, event } = mountGame(t);
  const candle = sim.placeGadgetAt(world, 200, 200);
  game.setTool("hand");
  event("pointerdown", 200, 200);
  event("pointermove", 250, 230);
  window.dispatchEvent(new Event("blur"));
  event("pointermove", 400, 300);
  assert.equal(world.dragId, null);
  assert.equal(candle.x, 250);
  assert.equal(candle.y, 230);
});

test("a canceled Hand touch never commits a bubble pop", (t) => {
  const { game, world, event, click } = mountGame(t);
  game.setTool("hand");
  const bubble = sim.spawnBubble(world, 400, 300, 40);
  event("pointerdown", 400, 300);
  event("pointercancel", 400, 300);
  assert.equal(bubble.popping, false);
  assert.equal(world.look.dragging, false);
  click(400, 300);
  assert.equal(bubble.popping, true, "a completed Hand tap still pops");
});

test("the focused Blow button supports keyboard hold, release, and focus loss", (t) => {
  const { game, world } = mountGame(t);
  game.setTool("wand");
  const dock = ToolDock({ tool: "wand", heldToolActive: true, gadgetCount: 0, blowing: false, coarse: false, onTool() {}, onHeldToolActive() {}, onClear() {}, onBlow: (on) => game.holdBlow(on) });
  const button = dock.props.children.find((child) => child?.props["data-tool-action"])?.props.children;
  assert.ok(button, "Wand exposes the Blow button");
  for (const code of ["Space", "Enter"]) {
    const e = { code, preventDefault() {} };
    button.props.onKeyDown(e);
    assert.equal(world.blowing, true);
    button.props.onKeyUp(e);
    assert.equal(world.blowing, false);
    button.props.onKeyDown(e);
    button.props.onBlur();
    assert.equal(world.blowing, false);
  }
});

test("dock exposes one held-effect switch, with no Follow/Pin placement modes", () => {
  const props = { tool: "candle", heldToolActive: true, gadgetCount: 1, blowing: false, coarse: false, onTool() {}, onHeldToolActive() {}, onClear() {}, onBlow() {} };
  const active = renderToStaticMarkup(createElement(ToolDock, props));
  assert.equal((active.match(/role="switch"/g) ?? []).length, 1);
  assert.match(active, /aria-label="Held tool active" aria-checked="true"/);
  assert.match(active, /Click to place/);
  assert.match(active, /Scroll moves the room/);
  assert.match(active, /Shift-scroll size/);
  assert.doesNotMatch(active, /Follow pointer|Place in the room|Pin ·/);
  const inactive = renderToStaticMarkup(createElement(ToolDock, { ...props, heldToolActive: false }));
  assert.match(inactive, /aria-checked="false"/);
  for (const tool of ["hand", "wand"]) {
    const withoutHeldDevice = renderToStaticMarkup(createElement(ToolDock, { ...props, tool }));
    assert.match(withoutHeldDevice, /role="switch" aria-label="Held tool active" aria-checked="false" disabled=""/);
  }
});

test("every tool and held state retains the same dock slots and blow action footprint", () => {
  const expectedLabels = ["Held tool active", ...TOOLS.map((tool) => tool.label), "Clear placed tools"];
  let expectedStructure;
  for (const { id: tool } of TOOLS) {
    for (const heldToolActive of [false, true]) {
      for (const coarse of [false, true]) {
        for (const blowing of [false, true]) {
          const dock = ToolDock({ tool, heldToolActive, coarse, blowing, gadgetCount: 0, onTool() {}, onHeldToolActive() {}, onClear() {}, onBlow() {} });
          const [hint, grid, action] = dock.props.children;
          const buttons = grid.props.children.flat(Infinity).filter(Boolean);
          assert.deepEqual(buttons.map((button) => button.props["aria-label"]), expectedLabels);
          assert.equal(buttons[0].props.disabled, tool === "hand" || tool === "wand");
          assert.equal(action.props.children.type, "button");
          assert.equal(action.props.children.props.children, "Hold to blow", "the label never changes width while held");
          assert.equal(action.props.children.props.disabled, tool !== "wand");
          assert.equal(action.props.children.props["aria-hidden"], tool !== "wand");
          assert.equal(action.props.children.props.tabIndex, tool === "wand" ? 0 : -1);
          const structure = [dock.props.className, hint.props.className, grid.props.className, action.props.className];
          expectedStructure ??= structure;
          assert.deepEqual(structure, expectedStructure, "tool/input/state changes must not alter layout containers");
          assert.equal(hint.props.children.length, 2, "hints always reserve exactly two lines");
        }
      }
    }
  }
});

test("Empty omits room gestures from every tool while keeping the dock footprint", () => {
  for (const { id: tool } of TOOLS) {
    for (const coarse of [false, true]) {
      const props = { tool, coarse, heldToolActive: true, blowing: false, gadgetCount: 0, onTool() {}, onHeldToolActive() {}, onClear() {}, onBlow() {} };
      const empty = ToolDock({ ...props, roomAvailable: false });
      const room = ToolDock({ ...props, roomAvailable: true });
      assert.doesNotMatch(renderToStaticMarkup(empty), /moves (the )?room|move the room|pan empty space/);
      assert.match(renderToStaticMarkup(room), /Scroll moves the room/);
      assert.deepEqual(empty.props.children.map((slot) => slot.props.className), room.props.children.map((slot) => slot.props.className));
      assert.equal(empty.props.children[0].props.children.length, 2);
    }
  }
});
