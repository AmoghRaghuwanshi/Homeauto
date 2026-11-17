// Live-update/modal focus regression; disposable simulator, no hardware.
const { chromium, webkit } = require('playwright');
const { createPreview } = require('./preview');
const assert = require('node:assert/strict');
async function main() {
  const engine = process.argv.includes('--browser=webkit') ? 'webkit' : 'chromium';
  const f = await createPreview(); let browser;
  try {
    browser = await ({ chromium, webkit }[engine]).launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 320 }, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(f.url + '/rooms'); await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached' });
    const opener = page.getByRole('button', { name: 'Add room', exact: true });
    for (let i = 0; i < 12; i++) {
      await opener.tap(); const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox').fill('Synthetic focus draft');
      // Re-render while the dialog is open and again as it closes.
      f.runtime.home.emitChange();
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).tap();
      f.runtime.home.emitChange();
      await dialog.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.tagName === 'BUTTON' && document.activeElement.textContent.trim() === 'Add room');
      await page.waitForTimeout(150);
      assert.equal(await opener.evaluate(n => n === document.activeElement), true, 'stable focus iteration ' + i);
    }
    assert.deepEqual(errors, []); console.log(JSON.stringify({ engine, iterations: 12, errors }));
  } finally { await browser?.close(); await f.runtime.stop(); }
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
