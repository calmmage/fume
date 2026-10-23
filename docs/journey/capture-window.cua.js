// Execute in cua_repl, after selecting the current IAB from its inventory and
// reading its viewport documentation. Pass that browser as the argument.
// Original captures: 14 October 2026, source 9f25dd0. No hidden app state writes.
async function captureMeasuredWindow(browser) {
  const fs = await import("node:fs/promises");
  const out = "/private/tmp/fume-window-shots";
  await fs.mkdir(out, { recursive: true });
  const native = await cua.createBrowserTab("iab", "http://127.0.0.1:5188/", { visible: false });
  const tab = await browser.tabs.get(native.id);
  const viewport = await browser.capabilities.get("viewport");
  async function size(width, height) {
    await viewport.set({ width, height });
    nodeRepl.write(await tab.playwright.evaluate(() => ({ width: innerWidth, height: innerHeight })));
  }
  async function choose(label) {
    nodeRepl.write(await tab.playwright.domSnapshot());
    await tab.playwright.getByRole("button", { name: /^Background style:/ }).click();
    nodeRepl.write(await tab.playwright.domSnapshot());
    await tab.playwright.getByRole("button", { name: `${label} background`, exact: true }).click();
    nodeRepl.write(await tab.playwright.domSnapshot());
  }
  async function capture(name) {
    // IAB screenshot bytes are JPEG; convert to WebP separately, with sidecars.
    await fs.writeFile(`${out}/${name}.jpg`, await tab.screenshot({ fullPage: true }));
  }
  try {
    await size(1440, 900);
    await choose("Wood"); await capture("81-wood-measured-desktop");
    await choose("Stone"); await capture("82-stone-measured-desktop");
    await choose("Pixel art"); await capture("83-pixel-measured-desktop");
    await size(390, 844); await capture("84-pixel-measured-phone");
    await tab.playwright.getByLabel("Smoke lab canvas", { exact: true }).click();
    nodeRepl.write(await tab.playwright.domSnapshot());
    await choose("Stone"); await capture("85-stone-measured-phone");
    await choose("Wood"); await capture("86-wood-measured-phone");
    await size(664, 640); await capture("87-wood-measured-reference-size");
    await size(1440, 900);
    await native.getAXState();
    await native.scroll([500, 400], "left", 1);
    await native.getAXState();
    await capture("88-wood-measured-after-pan");
    nodeRepl.write(await tab.dev.logs({ levels: ["error", "warn"], limit: 15 }));
    await tab.markDeliverable();
  } finally {
    await viewport.reset();
  }
}
