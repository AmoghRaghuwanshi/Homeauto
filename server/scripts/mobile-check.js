const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPreview } = require('./preview');

const roots = ['/', '/rooms', '/security', '/assistant', '/settings'];
const details = ['/rooms/room-1', '/devices/light-1', '/devices/sensor-gas', '/devices/sensor-motion', '/security/door', '/security/access-cards', '/security/activity', '/security/alerts', '/settings/appearance', '/settings/accessibility', '/settings/language', '/settings/voice', '/settings/notifications', '/settings/home', '/settings/privacy', '/settings/help', '/settings/about', '/settings/advanced', '/settings/advanced/ai', '/settings/devices'];
const profiles = [[320,568], [360,740], [390,844], [430,932], [844,390], [667,375]];
async function main() {
  const engine = process.argv.includes('--browser=webkit') ? 'webkit' : 'chromium';
  const folder = process.env.HOMEAUTO_MOBILE_QA_DIR || path.resolve(__dirname, '../../.local/qa/mobile', engine);
  fs.mkdirSync(folder, { recursive: true });
  const result = { engine, date: new Date().toISOString(), fixture: 'Loopback in-memory simulator; voice off; no physical devices', layouts: 0, screenshots: [], axe_scans: 0, violations: [], errors: [], external_requests: [], checks: [] };
  const fixture = await createPreview({ voice: false });
  let browser, page;
  try {
    browser = await ({ chromium, webkit }[engine]).launch();
    const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page = await context.newPage();
    page.on('pageerror', e => result.errors.push(e.message));
    await page.route('**/*', route => {
      if (new URL(route.request().url()).origin === fixture.url) return route.continue();
      result.external_requests.push(route.request().url()); return route.abort();
    });
    const ready = async () => { await page.locator('main h1').waitFor(); await page.waitForFunction(() => document.documentElement.dataset.connected === 'true'); };
    const visit = async route => { await page.goto(fixture.url + route); await ready(); };
    const preferences = async patch => page.evaluate(async patch => (await import('/js/preferences.js')).applyPreferences(patch), patch);
    const capture = async name => { await page.screenshot({ path: path.join(folder, name + '.png'), fullPage: true }); result.screenshots.push(name + '.png'); if (name.endsWith('390-home') || name.endsWith('844-home')) { await page.screenshot({ path: path.join(folder, name + '-viewport.png') }); result.screenshots.push(name + '-viewport.png'); } };
    const inspect = async name => {
      const problems = await page.evaluate(() => {
        const issues = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Horizontal page overflow');
        for (const n of document.querySelectorAll('main h1,main h2,main button,main a,main input,main select,main textarea,main summary')) {
          const r = n.getBoundingClientRect(); if (!r.width || !r.height || n.closest('[hidden]')) continue;
          const label = n.getAttribute('aria-label') || n.textContent.trim().slice(0, 60) || n.name;
          if (r.left < -1 || r.right > innerWidth + 1) issues.push('Clipped: ' + label);
          if (n.matches('button,a,summary') && (r.width < 44 || r.height < 44)) issues.push('Small touch target: ' + label);
          if (n.matches('input:not([type=radio]):not([type=checkbox]),select,textarea') && parseFloat(getComputedStyle(n).fontSize) < 16) issues.push('Small input text: ' + label);
        }
        if (innerWidth < 768 || (innerWidth <= 1023 && innerHeight <= 500)) {
          const bar = document.querySelector('.sidebar');
          if (bar.getBoundingClientRect().height - parseFloat(getComputedStyle(bar).paddingBottom) > 90) issues.push('Navigation consumes too much phone height');
          for (const n of document.querySelectorAll('.primary-nav .nav-item')) {
            const r = n.getBoundingClientRect();
            if (r.top < 0 || r.bottom > innerHeight + 1 || r.width < 44 || r.height < 44) issues.push('Unreachable navigation: ' + n.textContent.trim());
          }
        }
        return issues;
      });
      assert.deepEqual(problems, [], name); result.layouts++;
    };
    const axe = async name => {
      await page.addScriptTag({ url: '/__qa/axe.js' });
      const issues = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      result.axe_scans++; if (issues.length) result.violations.push({ name, issues }); assert.deepEqual(issues, [], name + ' accessibility');
    };
    await visit('/'); assert.equal(await page.locator('html').getAttribute('data-theme'), '05');
    for (const theme of ['05','01','03','04']) {
      await preferences({ theme, language: 'en' }); await page.reload(); await ready();
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      for (const [width,height] of profiles) {
        await page.setViewportSize({ width,height });
        for (const route of roots) {
          await visit(route); const name = `${theme}-${width}-${route.slice(1) || 'home'}`;
          await inspect(name);
          if (width === 390) { await axe(name); await capture(name); }
          if ((width === 320 && route === '/') || (width === 844 && theme === '05')) await capture(name);
        }
      }
    }
    result.checks.push('All four themes: six phone portrait/landscape sizes, persistent theme, five root screens, reachable touch navigation');
    await preferences({ theme: '05' });
    for (const width of [320,390]) {
      await page.setViewportSize({ width,height: 740 });
      for (const route of details) { await visit(route); await inspect(`${width}${route}`); if (width === 320) await axe(route); }
    }
    result.checks.push('Twenty detail/settings screens at320/390, including forms, sensors, RFID and activity');
    for (const theme of ['05','01','03','04']) {
      await preferences({ theme, language: 'hi', largeText: true, largeControls: true, strongOutlines: true });
      await page.setViewportSize({ width: 320,height: 568 });
      for (const route of roots) { await visit(route); await inspect(`Hindi-large-${theme}${route}`); if (theme === '05') { await axe(route); await capture('hindi-large-' + (route.slice(1) || 'home')); } }
    }
    result.checks.push('Hindi, large text/controls and strong outlines at320 in every theme');
    await preferences({ theme: '05', language: 'en', largeText: false, largeControls: false, strongOutlines: false });
    await page.setViewportSize({ width: 390,height: 844 }); await visit('/rooms');
    const opener = page.getByRole('button', { name: 'Add room', exact: true }); await opener.tap();
    await page.setViewportSize({ width: 390,height: 320 });
    const dialog = page.getByRole('dialog'); await dialog.getByRole('textbox').fill('Synthetic draft');
    const bounds = await dialog.boundingBox(); assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 321, 'Short-height dialog stays within viewport');
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true }); await cancel.scrollIntoViewIfNeeded(); await capture('short-height-dialog'); await cancel.tap(); await dialog.waitFor({ state: 'detached' }); await page.waitForFunction(() => document.activeElement?.tagName === 'BUTTON' && document.activeElement.textContent.trim() === 'Add room'); assert.equal(await opener.evaluate(n => n === document.activeElement), true);
    await visit('/assistant'); await page.getByLabel('Type a request', { exact: true }).fill('what is the gas status');
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/assistant/execute');
    const send = page.getByRole('button', { name: 'Send', exact: true }); await send.scrollIntoViewIfNeeded(); await send.tap(); assert.equal((await response).status(), 200); await capture('short-height-assistant');
    result.checks.push('320px-high viewport simulates reduced keyboard space: scrollable modal/Cancel focus restoration and typed read-only assistant request');
    await page.setViewportSize({ width: 844,height: 390 }); await visit('/');
    for (const route of roots.slice(1)) { await page.locator(`.primary-nav a[href="${route}"]`).tap(); await page.waitForURL(fixture.url + route); await ready(); }
    await page.locator('.home-name').tap(); await page.waitForURL(fixture.url + '/');
    result.checks.push('Landscape touch navigation reaches every root; My home returns Home');
    for (const [width,height] of [[768,1024],[1440,1000]]) { await page.setViewportSize({ width,height }); await visit('/'); await inspect('tablet-desktop-' + width); await capture('tablet-desktop-' + width); }
    assert.deepEqual(result.errors, []); assert.deepEqual(result.external_requests, []);
  } catch (error) {
    result.failure = error.stack || error.message;
    if (page) { result.route = page.url(); await page.screenshot({ path: path.join(folder,'failure.png'), fullPage: true }).catch(() => {}); }
    throw error;
  } finally {
    fs.writeFileSync(path.join(folder,'results.json'), JSON.stringify(result,null,2));
    await browser?.close(); await fixture.runtime.stop();
    console.log(JSON.stringify({ engine, layouts: result.layouts, screenshots: result.screenshots.length, axe_scans: result.axe_scans, violations: result.violations.length, errors: result.errors, external_requests: result.external_requests, failure: !!result.failure, folder }));
  }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { main };
