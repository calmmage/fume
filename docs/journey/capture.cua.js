// Replay these scenario steps in cua_repl after reading current browser docs.
// Keep one live GPU preview. Adapt only coordinates to the observed viewport.
// Do not reset saved smoke parameters. Select styles through the actual UI.
let reportTab = await cua.getTab({ url: 'http://127.0.0.1:5188/' }, { browser: '3' });
let reportBrowser = await cua.getBrowser({ id: '3' });
let reportViewport = await reportBrowser.capabilities.get('viewport');
let reportFs = await import('node:fs/promises');
// Capture outside Vite's watched tree; copy/convert into docs/journey/img after the run.
let reportDir = '/private/tmp/fume-journey-shots';
await reportFs.mkdir(reportDir, { recursive: true });
async function capture(name) {
  await reportTab.getAXState();
  await reportFs.writeFile(`${reportDir}/${name}.png`, await reportTab.screenshot({ fullPage: false }));
}
async function selectWorld(current, next) {
  await reportTab.playwright.getByRole('button', { name: `Background style: ${current}`, exact: true }).click();
  await reportTab.getAXState();
  await reportTab.playwright.getByRole('button', { name: `${next} background`, exact: true }).click();
  await reportTab.getAXState();
}
await reportViewport.set({ width: 1440, height: 900 });
// Select Geometry first if a different style is persisted; observe its name.
await reportTab.reload();
// Let the opening animation finish before saving; inspect its visible result.
await capture('10-geometry-entry');
await reportTab.playwright.getByRole('button', { name: 'Begin', exact: true }).click();
await reportTab.getAXState();
await reportTab.click([570, 600]);
await reportTab.click([920, 600]);
await reportTab.playwright.getByRole('switch', { name: 'Held tool active' }).click();
await capture('11-placed-held-off');
await reportTab.scroll([920, 500], 'down', 0.3);
await capture('12-trackpad-pan');
// Inspect that the window, room and candles moved; no tool-size or light zoom.
await reportViewport.set({ width: 390, height: 844 });
await reportTab.reload();
await capture('13-phone-entry');
await reportTab.playwright.getByRole('button', { name: 'Begin', exact: true }).click();
await reportTab.getAXState();
await reportTab.click([150, 550]);
await reportTab.playwright.getByRole('switch', { name: 'Held tool active' }).click();
await capture('14-phone-tools');
await selectWorld('Geometry', 'Cosmos');
await reportTab.reload();
await reportTab.getAXState();
// Confirm persisted Cosmos and no new hydration error in tab.dev.logs().
await reportTab.playwright.getByRole('button', { name: 'Begin', exact: true }).click();
await reportTab.getAXState();
await reportTab.click([130, 540]);
await reportTab.playwright.getByRole('switch', { name: 'Held tool active' }).click();
await capture('15-phone-cosmos');
await reportTab.playwright.getByRole('button', { name: 'Background style: Cosmos', exact: true }).click();
await capture('16-phone-picker');
await reportTab.playwright.getByRole('button', { name: 'Wood background', exact: true }).click();
await capture('20-phone-wood');
await reportViewport.set({ width: 1440, height: 900 });
await capture('17-wood-desktop');
await selectWorld('Wood', 'Pixel art');
await capture('18-pixel-desktop');
await selectWorld('Pixel art', 'Stone');
await capture('19-stone-desktop');
// Open Lab: Light Off/Window should change live shafts in these room styles.
// Check Wand hold/pop, then restore desired preview and leave only one GPU tab.
await reportViewport.reset();
await reportTab.markDeliverable();

// 12 October bubble regression: fresh Geometry, desktop and portrait.
// On reload confirm the button is named Unmute; click it, check Mute, click back.
// Begin -> Wand -> hold at the center of the visible room for 750ms.
// Capture at 1280x720 and 390x844, compare a bubble's horizontal/vertical diameter.
// Reproduction uses the actual GPU canvas, not synthetic test scene injection.

// 12 October furnished Geometry, code 26efd61. Final confirmation sequence:
// Portrait 390x844: reload -> Begin -> click [191,504] -> Held tool active off.
// Capture 28-geometry-phone; horizontal scroll at [195,420], 0.12 pages -> 29-geometry-pan.
// Background style: Geometry -> capture 30-geometry-picker; close picker.
// Desktop 1440x900: reload -> Begin -> click [708,648] -> Held tool active off.
// Capture 27-geometry-desktop and inspect preview.dev.logs({levels:["error","warn"]}).
// Separately checked Wood selection -> rendered Wood -> Geometry selection.
// 25-geometry-reference and 26-geometry-rejected are Petr's attachments, not new app shots.
// Reset viewport and leave the preview marked as the deliverable.

// 12 October Cosmos/controls/Fire, code 2a4204d. These steps supersede Begin above.
// The current tab's normal preview is 540x829. Reload -> inspect muted Candle entry.
// Capture 32-cosmos-entry. Hand -> drag [410,315] to [110,315] -> 33-cosmos-pan.
// Fire -> click [271,490] -> Held tool active off -> 34-fire-upright.
// Background style: Cosmos -> 35-cosmos-picker -> Close background styles.
// Lab: confirm Spatial points is absent for Cosmos. Close Lab.
// At requested 390x844 and 1440x900 overrides, iterate all nine tool buttons.
// Read DOM bounding boxes for data-tool-grid, data-tool-hint, data-tool-action;
// read button width/height/radius. Persist as layout-cosmos.json.
// Browser's existing display scale reports 325x703 and 1200x750 CSS pixels;
// retain the reported dimensions rather than relabeling them as 390/1440.
// Reset override. Inspect dev logs (warnings/errors), leave one GPU tab open.
// The 8K artifact is generated independently from the same model and WGSL:
// node scripts/render-cosmos-preview.mjs /private/tmp/fume-cosmos-8k.png

// 12 October space correction. Run through CUA in the existing preview tab;
// never open another GPU simulation. These supersede the earlier bands/plates.
// Before mutating files, save raw captures outside Vite's watched tree at
// /private/tmp/fume-space-shots. Project writes can reload the simulation.
// Desktop override1440x900 reports1200x750 CSS: Stone ->39before-pan;
// Hand drag[550,300]→[670,360] ->40after-pan. Choose Geometry, Candle,
// place[380,440], held off; let live smoke reach the top ->41geometry.
// Select Cosmos ->42; Wood ->43; Pixel art ->44.
// Phone override390x844 reports325x703 CSS: Geometry, clear placed,
// place[135,320] with held off ->45full-height-smoke. Cosmos ->46; Stone ->47.
// Geometry ->Wand, hold[180,310]700ms ->48round-bubble.
// Reset override; native preview540x829. Capture only after sizing settles:
// Geometry ->49; Stone ->50; Hand drag[380,270]→[250,320] ->51.
// Cosmos ->52 native. Inspect every raw capture and console warns/errors.
// Native8K uses render-cosmos-preview.mjs with the current point field/shader.
// Convert actual captures to the matching numbered WebPs; do not crop away
// interface controls or relabel requested widths as measured CSS dimensions.
