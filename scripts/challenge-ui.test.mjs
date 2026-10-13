import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const srcRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
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
      const { outputText } = ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        fileName: fileURLToPath(url),
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { CHALLENGES } = await import("../src/game/challenges.ts");
const { ChallengeChoices, ChallengePanel, ChallengeOverlay } =
  await import("../src/components/challenge-panel.tsx");
const { FumeApp, SessionNotice } = await import("../src/components/fume-app.tsx");
const noop = () => {};
const fixedSource = {
  id: 1,
  kind: "candle",
  angle: -90,
  fixed: true,
  selected: false,
  x: 190,
  y: 360,
};
const movableFan = { id: 2, kind: "fan", angle: -30, fixed: false, selected: true, x: 240, y: 380 };

function hud(overrides = {}) {
  return {
    id: "draft",
    title: "Draft",
    description: CHALLENGES[0].description,
    hint: CHALLENGES[0].hint,
    status: "running",
    fill: 0,
    coverage: 0,
    hold: 0,
    probeReady: true,
    error: null,
    kit: [{ kind: "fan", label: "Fan", total: 1, remaining: 0 }],
    placement: null,
    selected: movableFan,
    tools: [fixedSource, movableFan],
    screenTarget: { x: 317, y: 214, r: 18 },
    viewport: { x: 50, y: 40, width: 720, height: 460 },
    ...overrides,
  };
}

function panel(challenge) {
  return renderToStaticMarkup(
    createElement(ChallengePanel, {
      challenge,
      nextLabel: "Next",
      error: null,
      onLeave: noop,
      onRetry: noop,
      onNext: noop,
      onTool: noop,
      onSelect: noop,
      onAngle: noop,
      onRemove: noop,
    }),
  );
}

function button(markup, name) {
  const buttons = markup.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  const found = buttons.find(
    (value) =>
      value.includes(`aria-label="${name}"`) || value.replace(/<[^>]+>/g, "").trim() === name,
  );
  assert.ok(found, `button ${name} exists`);
  return found;
}

test("playground remains the direct entry with Candle, audio off, and a discreet challenge entry", () => {
  const markup = renderToStaticMarkup(createElement(FumeApp));
  assert.match(markup, /aria-label="Smoke lab canvas"/);
  assert.match(markup, /aria-label="Candle" aria-pressed="true"/);
  assert.match(markup, /aria-label="Unmute"/);
  assert.match(markup, /aria-label="Choose a smoke challenge"/);
  assert.doesNotMatch(
    markup,
    /<h1\b|>Begin<|data-challenge-controls|data-challenge-overlay|data-session-notice|Dismiss message/,
  );
});

test("rollback notice displays the supplied recovery message and has a reachable manual dismiss action", () => {
  const message = "This challenge could not start. Your playground has been restored.";
  let dismissals = 0;
  const notice = SessionNotice({
    notice: message,
    onDismiss: () => {
      dismissals++;
    },
  });
  const markup = renderToStaticMarkup(notice);
  assert.match(markup, /data-session-notice="true"/);
  assert.ok(markup.includes(message));
  assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/);
  const dismissMarkup = button(markup, "Dismiss message");
  assert.doesNotMatch(dismissMarkup, /disabled=""|tabindex="-1"/);
  assert.match(dismissMarkup, /size-11 shrink-0.*rounded-\[6px\]/);
  assert.match(markup, /absolute top-.*max-w-md/);
  assert.doesNotMatch(markup, /role="dialog"|data-challenge-controls/);
  const dismiss = notice.props.children.find(
    (child) => child.props?.["aria-label"] === "Dismiss message",
  );
  assert.equal(dismissals, 0, "the notice never dismisses itself during rendering");
  dismiss.props.onClick();
  assert.equal(dismissals, 1, "manual dismiss invokes the runtime callback");
});

test("null session notice contributes no markup or action to the normal playground", () => {
  let dismissals = 0;
  const markup = renderToStaticMarkup(
    createElement(SessionNotice, {
      notice: null,
      onDismiss: () => {
        dismissals++;
      },
    }),
  );
  assert.equal(markup, "");
  assert.equal(dismissals, 0);
});

test("all three choices remain playable before and after any completion", () => {
  for (const completed of [[], ["draft"], ["draft", "ledge", "passage"]]) {
    const markup = renderToStaticMarkup(
      createElement(ChallengeChoices, {
        choices: CHALLENGES,
        completed,
        activeId: "draft",
        onChoose: noop,
      }),
    );
    assert.equal((markup.match(/<button\b/g) ?? []).length, 3);
    assert.doesNotMatch(markup, /disabled|locked|unlock/i);
    for (const choice of CHALLENGES) assert.ok(markup.includes(choice.title));
    assert.equal((markup.match(/, completed"/g) ?? []).length, completed.length);
    assert.match(markup, /aria-current="true"/);
  }
});

test("fixed pieces are identified and cannot be rotated or removed through the controls", () => {
  const markup = panel(hud({ selected: fixedSource }));
  assert.match(markup, /Candle 1 · fixed/);
  assert.match(markup, /This piece stays fixed/);
  assert.match(
    button(markup, "Rotate selected tool counterclockwise by 15 degrees"),
    /disabled=""/,
  );
  assert.match(button(markup, "Rotate selected tool clockwise by 15 degrees"), /disabled=""/);
  assert.match(button(markup, "Remove"), /disabled=""/);
  assert.match(markup, /<input[^>]*type="number"[^>]*disabled=""/);
});

test("placed movable tools have a keyboard selector and degree input plus both touch rotation buttons", () => {
  const markup = panel(hud());
  assert.match(markup, /aria-label="Select placed tool"/);
  assert.match(markup, /Fan 1 · movable/);
  assert.match(markup, /Selected tool angle in degrees/);
  assert.match(markup, /type="number"[^>]*value="-30"/);
  assert.doesNotMatch(
    button(markup, "Rotate selected tool counterclockwise by 15 degrees"),
    /disabled=""/,
  );
  assert.doesNotMatch(
    button(markup, "Rotate selected tool clockwise by 15 degrees"),
    /disabled=""/,
  );
  assert.doesNotMatch(button(markup, "Remove"), /disabled=""/);
});

test("used or absent kit items cannot place extra tools but another available item stays usable", () => {
  const markup = panel(
    hud({
      kit: [
        { kind: "fan", label: "Fan", total: 2, remaining: 0 },
        { kind: "block", label: "Barrier", total: 1, remaining: 1 },
      ],
    }),
  );
  assert.match(button(markup, "Place fan, 0 remaining"), /disabled=""/);
  assert.doesNotMatch(button(markup, "Place barrier, 1 remaining"), /disabled=""/);
  assert.match(button(panel(hud()), "Barrier not in this kit"), /disabled=""/);
});

test("completion is gentle and preserves the kit, angle and action rows instead of shifting controls", () => {
  const states = [
    hud({ selected: null }),
    hud({ selected: fixedSource }),
    hud(),
    hud({ hold: 0.45 }),
    hud({ status: "complete", hold: 1 }),
  ];
  const markups = states.map(panel);
  for (const markup of markups) {
    assert.match(markup, /data-challenge-kit="true" class="grid h-11 grid-cols-3/);
    assert.match(markup, /data-challenge-angle="true" class="grid h-11/);
    assert.match(markup, /data-challenge-actions="true" class="grid h-11 grid-cols-3/);
    assert.match(markup, /data-challenge-feedback="true" class="flex h-10 /);
    assert.match(markup, /role="status" aria-live="polite" aria-atomic="true"/);
    assert.equal((markup.match(/<button\b/g) ?? []).length, 9);
    assert.doesNotMatch(markup, /score|seconds|timer|congratulations/i);
  }
  assert.match(button(markups[0], "Next"), /disabled=""/);
  assert.match(button(markups[3], "Next"), /disabled=""/);
  assert.doesNotMatch(button(markups[4], "Next"), /disabled=""/);
  assert.match(markups[4], /The smoke found its way/);
});

test("settling indicator reflects confirmed hold without presenting faint smoke as completion", () => {
  for (const [state, expected] of [
    [{ hold: 0, fill: 0, coverage: 0 }, 0],
    [{ hold: 0, fill: 0.02, coverage: 0.03 }, 0],
    [{ hold: 0.45 }, 45],
    [{ hold: -0.5 }, 0],
    [{ hold: Number.NaN }, 0],
    [{ hold: 0.8, probeReady: false }, 0],
    [{ hold: 0.8, error: "Smoke measurement unavailable." }, 0],
    [{ hold: 1.5 }, 100],
    [{ status: "complete", hold: 1 }, 100],
  ]) {
    const markup = panel(hud(state));
    assert.match(
      markup,
      /role="progressbar" aria-label="Smoke settling in target" aria-valuemin="0" aria-valuemax="100"/,
    );
    assert.ok(markup.includes(`aria-valuenow="${expected}"`));
    assert.ok(markup.includes(`style="width:${expected}%"`));
    assert.match(markup, /class="h-0\.5 w-16 shrink-0 /);
    if (state.status === "complete") {
      assert.match(markup, /aria-valuetext="Target reached"/);
      assert.match(markup, /The smoke found its way/);
    } else {
      assert.doesNotMatch(markup, /The smoke found its way|aria-valuetext="Target reached"/);
      assert.match(button(markup, "Next"), /disabled=""/);
    }
    if (expected > 0 && state.status !== "complete")
      assert.match(markup, /Smoke is settling in the ring/);
    if (expected === 0) assert.doesNotMatch(markup, /Smoke is settling in the ring/);
  }
});

test("read-only target follows emitted CSS coordinates inside a letterboxed viewport without rescaling", () => {
  const markup = renderToStaticMarkup(createElement(ChallengeOverlay, { challenge: hud() }));
  assert.match(
    markup,
    /aria-hidden="true" data-challenge-overlay="true" class="pointer-events-none/,
  );
  assert.match(markup, /left:50px;top:40px;width:720px;height:460px/);
  assert.match(markup, /left:267px;top:174px;width:36px;height:36px/);
  assert.match(markup, /fill="none"/);
  assert.match(markup, /Fixed/);
  assert.doesNotMatch(markup, /<button|<canvas|<img/);
});

test("invalid runtime target dimensions cannot produce a misleading target marker", () => {
  for (const r of [0, -1, Number.NaN]) {
    assert.equal(
      renderToStaticMarkup(
        createElement(ChallengeOverlay, {
          challenge: hud({ screenTarget: { x: 100, y: 200, r } }),
        }),
      ),
      "",
    );
  }
});
