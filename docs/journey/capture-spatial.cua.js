// CUA REPL capture recipe, source 7da7b25. Run snippets in separate calls,
// checking the current DOM after each action group. Never inject app/storage state.
// First invocation alone: select the existing localhost browser as documented.
let browser = await cua.getBrowser({ url: "http://127.0.0.1:5188/" });

// Bind the existing preview; obtain a fresh viewport capability before sizing.
let tab = await cua.getTab({ url: "http://127.0.0.1:5188/" }, { browser: browser.browserId });
let viewport = await browser.capabilities.get("viewport");
await viewport.documentation();
await viewport.set({ width: 1440, height: 900 });
await tab.reload(); // replace any HMR-held GPU shader before final evidence
await tab.getAXState();

// Read saved-style hydration before choosing; open Background style, then Empty.
await tab.playwright.getByRole("button", { name: /^Background style:/ }).click();
await tab.getAXState();
await tab.playwright.getByRole("button", { name: /^Empty / }).click();
await tab.getAXState();
// With Candle selected, click [620,590], then switch Held tool active off.
// Save 67-empty-desktop after actual simulated smoke is visible.
// Hint should contain Shift-scroll size, not Scroll moves room.

// Repeat normal chooser actions for Wood (68); use Hand/trackpad scroll for69.
// Geometry: Reset view in simulation lab, then70 before and71 after long scroll.
// Verify immediate reversal, continued dust and shared architecture movement.

// Resize390x844. Repeat Empty/candle placement for72; open chooser for73.
// Select Wood74, Stone75, Pixel art76 through normal controls.
// Pixel must show geometry-owned mullions only, without the baked diagonal bar.
// Check Empty Hand and Wand hints/tooltips also omit room movement instructions.

// Resize1406x1474 (the supplied image size): Wood77, Pixel80.
// Resize1440x900: Pixel79. Verify innerWidth/innerHeight through read-only DOM.
// Save fullPage browser screenshots, not native screenshots, at the tall size;
// native capture clipped1474px to1410px during the first attempt.
// Example with BrowserAPI tab and normal filesystem output:
// await fs.writeFile('/private/tmp/fume-challenge-shots/80-pixel-user-width.jpg',
//   await tab.screenshot({fullPage:true}));
// Convert to img/*.webp, retain exact source/origin text and provenance sidecar.
// Open every file and check dimensions/content before reviewer handoff.

//78 Empty Draft regression:390x844, fan [121,464], angle -37deg;
// wait through independent work, then inspect real probe completion and Next.
// Return via Playground, verify original candle restored.

// Reset viewport and mark preview/report deliverables before finishing.
await viewport.reset();
await tab.markDeliverable();
