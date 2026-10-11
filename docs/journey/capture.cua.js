// Replay in cua_repl after reading its browser and viewport documentation.
// Use the existing live tab, one GPU preview only. Never reset smoke presets.
let reportTab = await cua.getTab({ url: 'http://127.0.0.1:5188/' }, { browser: '3' });
let reportBrowser = await cua.getBrowser({ id: '3' });
let reportViewport = await reportBrowser.capabilities.get('viewport');
let reportFs = await import('node:fs/promises');
let reportDir = '/Users/petrlavrov/calm/projects/fume/docs/journey/img';
async function capture(name) {
  await reportTab.getAXState();
  await reportFs.writeFile(`${reportDir}/${name}.png`, await reportTab.screenshot({ fullPage: false }));
}
await reportViewport.set({ width: 1440, height: 900 });
await reportTab.reload();
await reportTab.getAXState();
await reportTab.playwright.getByRole('button', { name: 'Begin', exact: true }).click();
await reportTab.drag([1010, 470], [850, 505]);
await reportTab.playwright.getByRole('button', { name: 'Wand', exact: true }).click();
await reportTab.getAXState();
await reportTab.click([940, 390], { durationMs: 1200 });
await capture('06-desktop-after');
await reportViewport.set({ width: 390, height: 844 });
await reportTab.reload();
await capture('07-phone-entry');
await reportTab.playwright.getByRole('button', { name: 'Begin', exact: true }).click();
await reportTab.playwright.getByRole('button', { name: 'Wand', exact: true }).click();
await capture('08-phone-tools');
await reportTab.playwright.getByRole('button', { name: 'Open simulation lab' }).click();
await reportTab.getAXState();
await reportTab.scroll([218, 634], 'down', 1);
await capture('09-phone-lab');
await reportTab.playwright.getByRole('button', { name: 'Close lab' }).click();
await reportViewport.reset();
await reportTab.markDeliverable();
