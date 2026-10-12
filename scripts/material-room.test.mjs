import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

async function load(name) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/game/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const { DEFAULT_LOOK } = await load("look");
const { isMaterialRoom, panMaterialRoom, coastMaterialRoom, materialRoomCamera } = await load("material-room");
const look = (extra = {}) => ({ ...DEFAULT_LOOK, roomStyle: "wood", ...extra });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} should equal ${b}`);
const project = (camera, width, height, x = 0, y = 0, z = camera.depth) => ({
  x: (camera.centerX + (x - camera.x) / z / (width / height)) * width,
  y: (camera.centerY + (y - camera.y) / z) * height,
});

test("default material rooms leave substantial side, floor and ceiling space on phone and desktop", () => {
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const camera = materialRoomCamera(width, height, look());
    assert.equal(camera.depth, 5);
    const topLeft = project(camera, width, height, -camera.halfWidth, -camera.halfHeight);
    const bottomRight = project(camera, width, height, camera.halfWidth, camera.halfHeight);
    close(topLeft.x / width, 0.2);
    close(bottomRight.x / width, 0.8);
    close(topLeft.y / height, 0.15);
    close(bottomRight.y / height, 0.73);
  }
});

test("an ordinary drag moves the distant wall visibly in the drag direction, equally on both axes", () => {
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const state = look();
    const before = project(materialRoomCamera(width, height, state), width, height);
    panMaterialRoom(state, width, height, 80, 80, 0.1);
    const after = project(materialRoomCamera(width, height, state), width, height);
    close(after.x - before.x, 36);
    close(after.y - before.y, 36);
  }
});

test("the actual camera stops at its limit and a reverse drag immediately moves back", () => {
  const state = look();
  panMaterialRoom(state, 1000, 1000, 100_000, -100_000, 0.1);
  assert.equal(state.parallaxX, 0.24);
  assert.equal(state.parallaxY, -0.24);
  assert.equal(state.panVx, 0);
  assert.equal(state.panVy, 0);
  panMaterialRoom(state, 1000, 1000, -10, 10, 0.1);
  close(state.parallaxX, 0.23);
  close(state.parallaxY, -0.23);
  assert.ok(state.panVx < 0 && state.panVy > 0);
  Object.assign(state, { parallaxX: 500, parallaxY: -500 });
  panMaterialRoom(state, 1000, 1000, -10, 10, 0.1);
  close(state.parallaxX, 0.23);
  close(state.parallaxY, -0.23);
});

test("coasting decays and cannot accumulate invisible motion beyond a wall limit", () => {
  const state = look({ panVx: 1, panVy: -1 });
  coastMaterialRoom(state, 0.05);
  assert.ok(state.parallaxX > 0 && state.parallaxY < 0);
  assert.ok(state.panVx > 0 && state.panVx < 1);
  for (let frame = 0; frame < 300; frame++) coastMaterialRoom(state, 1 / 60);
  assert.equal(state.panVx, 0);
  assert.equal(state.panVy, 0);
  Object.assign(state, { parallaxX: 0.23, parallaxY: -0.23, panVx: 3, panVy: -3 });
  coastMaterialRoom(state, 0.1);
  assert.equal(state.parallaxX, 0.24);
  assert.equal(state.parallaxY, -0.24);
  assert.equal(state.panVx, 0);
  assert.equal(state.panVy, 0);
});

test("material controls stay scoped and room depth moves only the background plane", () => {
  for (const style of ["wood", "stone", "pixel"]) assert.equal(isMaterialRoom(look({ roomStyle: style })), true);
  for (const style of ["geometry", "cosmos"]) assert.equal(isMaterialRoom(look({ roomStyle: style })), false);
  assert.equal(isMaterialRoom(look({ room: false })), false);
  const shallow = materialRoomCamera(1440, 900, look({ roomDepth: 3 }));
  const deep = materialRoomCamera(1440, 900, look({ roomDepth: 9 }));
  assert.equal(shallow.halfWidth, deep.halfWidth);
  assert.equal(shallow.halfHeight, deep.halfHeight);
  assert.equal(shallow.depth, 3);
  assert.equal(deep.depth, 9);
  assert.ok(project(deep, 1440, 900, deep.halfWidth).x < project(shallow, 1440, 900, shallow.halfWidth).x);
  const wider = materialRoomCamera(1440, 900, look({ roomW: 1.8, roomH: 1.24 }));
  close(wider.halfWidth, shallow.halfWidth * 2);
  close(wider.halfHeight, shallow.halfHeight * 2);
});
