// Capture recipe for the CUA REPL, not a terminal/browser driver.
// Execute the first binding call alone in a fresh REPL and read its returned
// browser documentation. Execute the remaining snippets in separate calls,
// reading the current snapshot after each interaction group.
// Ordinary-flow captures: 1c40483; final source and recovery: a0cda91.
// Local URL: http://127.0.0.1:5188/.
// Never use hidden Fume state or storage injection to manufacture completion.

// First call only:
let browser = await cua.getBrowser({ url: "http://127.0.0.1:5188/" });

// Next call: select the existing local tab from this browser. If there is none,
// create one with cua.createBrowserTab(browser.browserId, URL, {visible:false}).
let tab = await cua.getTab({ url: "http://127.0.0.1:5188/" }, { browser: browser.browserId });
let viewport = await browser.capabilities.get("viewport");
await viewport.documentation();
await viewport.set({ width: 390, height: 844 });

// Verify in a subsequent call; the viewport API's paint can settle later.
await tab.reload();
await tab.getAXState();
nodeRepl.write(await tab.playwright.evaluate(() => ({ width: innerWidth, height: innerHeight })));

// Playground parking proof: two ordinary active candle placements, then Hand.
await tab.click([125, 535]);
await tab.click([290, 580]);
await tab.playwright.getByRole("button", { name: "Hand", exact: true }).click();
await tab.getAXState();
// Save screenshot as 58-park-phone; inspect that both candles are rendered.

// Enter Draft; match completed and uncompleted labels without changing storage.
await tab.playwright.getByRole("button", { name: "Choose a smoke challenge" }).click();
await tab.getAXState();
await tab.playwright.getByRole("button", { name: /^Draft/ }).click();
await tab.playwright.getByRole("button", { name: "Place fan, 1 remaining" }).click();
await tab.click([100, 476]);
await tab.playwright.getByRole("spinbutton", { name: "Selected tool angle in degrees" }).fill("-37");
await tab.playwright.getByRole("spinbutton", { name: "Selected tool angle in degrees" }).press("Enter");
await tab.getAXState();

// Move preserves the explicit angle. Use the 44px clockwise/counterclockwise
// buttons too; either is accessible with keyboard focus and activation.
await tab.drag([100, 476], [118, 460]);
await tab.getAXState();
// Save/inspect 63-move-aim-phone: moved fan, angle -37, unchanged dock rows.
await tab.drag([118, 460], [100, 476]);
await tab.getAXState();

// Spend the wait on independent work, then inspect the actual sampled result.
// A screenshot must show smoke crossing the ring, success and enabled Next;
// never label a generic running state as completed.
await tab.getAXStateAndScreenshot();
nodeRepl.write(await tab.playwright.getByRole("progressbar", { name: "Smoke settling in target" }).getAttribute("aria-valuenow"));
// Save/inspect 56-draft-complete-phone when the real probe reaches completion.

await tab.playwright.getByRole("button", { name: "Reset", exact: true }).click();
await tab.getAXStateAndScreenshot();
// 57-retry-phone: 1 fan restored, Next disabled, same three 44px control rows.
await tab.playwright.getByRole("button", { name: "Playground", exact: true }).click();
await tab.getAXStateAndScreenshot();
// 59-return-phone: same two candles, Hand, Geometry and sound off.

// Resize proof uses an active portrait challenge without reloading. After
// viewport.set({width:1440,height:900}), inspect a fresh snapshot and screenshot:
// logical 390x844 field stays centered at approximately415.88x900; target,
// fan, pointer mapping and round circles stay aligned. This is 64-resize-letterbox.

// Full-width desktop requires a fresh1440x900 playground before challenge entry.
// Passage solution through normal UI (default Geometry projection):
//   fan1 at [314,508], angle -49deg
//   fan2 at [775,300], angle -14deg
//   barrier at [573,680], angle0deg
// Select Place fan / Place barrier with the remaining counts before each click.
// Read a snapshot after each group. Actual smoke completion enables Choose.
// Choose opens the picker with three real local completion marks:65-completion-marks.
// Read console warn/error logs; no new entries were observed in this walkthrough.

// Offline archive (served locally from the separate personal skill archive):
// http://127.0.0.1:5191. Search 'fluid' gives1of269; Physics & Simulation gives10.
// Original inline animations continue; no automatic remote resource elements.
// Durable raw search/category captures and SHA-256 are in that skill's receipt.

// Save captures using the documented getScreenshot/screenshot API and normal
// filesystem output; do not fetch canvas pixels through injected application JS.
// Inspect every file for valid dimensions, loaded content and the claimed state.
// Reset temporary viewport override before finishing and mark the local preview
// and journey tabs as deliverables if they should remain open.
