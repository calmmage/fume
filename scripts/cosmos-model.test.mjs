import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/game/cosmos-model.ts", import.meta.url), "utf8"),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  },
).outputText;
const { buildCosmosPoints, COSMOS_COUNT, COSMOS_STARS, projectCosmosPoint } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);

test("Cosmos is a stable finite volume with near, middle and distant stars", () => {
  const points = buildCosmosPoints();
  assert.equal(points.length, COSMOS_COUNT * 8);
  assert.deepEqual(points, buildCosmosPoints(), "camera motion must not regenerate stars");
  assert.ok(points.every(Number.isFinite));
  const depths = Array.from({ length: COSMOS_STARS }, (_, i) => points[i * 8 + 2]);
  assert.ok(depths.filter((z) => z < 25).length > 100);
  assert.ok(depths.filter((z) => z > 120).length > 1000);
  assert.ok(
    new Set(depths).size > COSMOS_STARS * 0.99,
    "distances must not collapse into flat layers",
  );
});

test("camera movement gives near stars ten times the parallax of distant stars at desktop, phone and 8K sizes", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [7680, 4320],
  ]) {
    const shift = (z) => {
      const a = projectCosmosPoint(0, 0, z, width, height);
      const b = projectCosmosPoint(0, 0, z, width, height, 2, 1);
      return { x: a.x - b.x, y: a.y - b.y };
    };
    assert.ok(Math.abs(shift(10).x / shift(100).x - 10) < 1e-10);
    assert.ok(Math.abs(shift(10).y / shift(100).y - 10) < 1e-10);
  }
});
