// Additional reconstruction checks at tablet/desktop widths. All data and
// controller reports belong to the loopback, in-memory fixture.
const { chromium, webkit } = require('playwright');
const { createPreview } = require('./preview');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const routes = ['/', '/rooms', '/rooms/room-1', '/devices/light-1', '/devices/sensor-gas', '/devices/sensor-motion', '/security', '/security/door', '/security/access-cards', '/security/activity', '/security/alerts', '/assistant', '/settings', '/settings/appearance', '/settings/accessibility', '/settings/language', '/settings/voice', '/settings/notifications', '/settings/home', '/settings/privacy', '/settings/help', '/settings/about', '/settings/devices', '/settings/advanced', '/settings/advanced/ai'];
async function main() {
  const engine = process.argv.includes('--browser=webkit') ? 'webkit' : 'chromium';
  const folder = process.env.HOMEAUTO_REBUILD_QA_DIR || path.resolve(__dirname, '../../.local/qa/rebuild', engine);
  fs.mkdirSync(folder, { recursive: true });
  const result = { engine, fixture: 'Loopback in-memory simulator only', layouts: 0, axe_scans: 0, screenshots: [], errors: [], external_requests: [], request_failures: [] };
  const fixture = await createPreview(); let browser, page;
  try {
    browser = await ({ chromium, webkit }[engine]).launch();
    page = await browser.newPage({ viewport: { width: 1024, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') result.request_failures.push({ url: request.url(), error: request.failure()?.errorText }); });
    await page.route('**/*', route => { if (new URL(route.request().url()).origin === fixture.url) return route.continue(); result.external_requests.push(route.request().url()); return route.abort(); });
    for (const theme of (process.argv.includes('--interaction-only') ? [] : ['05', '01', '03', '04'])) {
      await page.goto(fixture.url);
      await page.locator('main h1').waitFor();
      await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached' });
      await page.evaluate(async theme => (await import('/js/preferences.js')).applyPreferences({ theme }), theme);
      for (const width of [768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of routes) {
          await page.goto(fixture.url + route);
          await page.locator('main h1').waitFor();
          await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached' });
          await page.locator('main .loading-panel').waitFor({ state: 'detached' });
          const issues = await page.evaluate(() => {
            const issues = [];
            if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Horizontal overflow');
            for (const node of document.querySelectorAll('main button,main a,main input,main select,main textarea,main summary,main h1,main h2')) {
              const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height || node.closest('[hidden]')) continue;
              const label = node.getAttribute('aria-label') || node.textContent.trim().slice(0, 60) || node.name;
              if (rect.left < -1 || rect.right > innerWidth + 1) issues.push('Clipped: ' + label);
              if (node.matches('button,a,summary') && (rect.width < 44 || rect.height < 44)) issues.push('Small target: ' + label);
            }
            return issues;
          });
          assert.deepEqual(issues, [], `${theme}/${width}${route}`); result.layouts++;
          if (width === 1024) {
            // DevTools injection avoids WebKit attributing axe's own blocked
            // inline-style probe to the script element's load. App CSP stays intact.
            await page.evaluate(axeSource);
            const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
            result.axe_scans++; assert.deepEqual(violations, [], `${theme}/${width}${route} accessibility`);
          }
          if (['/', '/rooms', '/security', '/assistant', '/settings', '/settings/appearance', '/security/door', '/devices/light-1', '/security/activity', '/security/access-cards'].includes(route)) {
            const name = `${theme}-${width}-${route.replaceAll('/', '-')}.png`;
            await page.screenshot({ path: path.join(folder, name), fullPage: true }); result.screenshots.push(name);
          }
        }
      }
    }
    await page.goto(fixture.url + '/security/door'); await page.locator('main h1').waitFor();
    await page.waitForFunction(() => document.documentElement.dataset.connected === 'true');
    await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      const { button, modal } = await import('/js/components.js');
      const control = button('Check again', () => new Promise(resolve => { window.__qaReleaseButton = resolve; }));
      control.id = 'qa-busy-control';
      const dialog = modal('Preview', control, { readOnly: true, confirmLabel: 'Close' });
      dialog.id = 'qa-test-dialog';
    });
    const refresh = page.locator('#qa-busy-control');
    await refresh.waitFor({ state: 'visible' });
    const before = await refresh.boundingBox(); assert.ok(before, 'Refresh control is visible'); await refresh.click();
    await page.waitForFunction(() => document.querySelector('#qa-busy-control')?.getAttribute('aria-busy') === 'true');
    const during = await refresh.boundingBox();
    assert.equal(during.width, before.width, 'Busy feedback keeps button width');
    assert.equal(during.height, before.height, 'Busy feedback keeps button height');
    await page.evaluate(() => window.__qaReleaseButton());
    await page.waitForFunction(() => !document.querySelector('#qa-busy-control')?.hasAttribute('aria-busy'));
    await page.locator('#qa-test-dialog').evaluate(node => node.close());
    await page.locator('#qa-test-dialog').waitFor({ state: 'detached' });
    result.busy_footprint = 'passed';
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const opacity = await page.evaluate(() => {
      const main = document.querySelector('main'); main.classList.remove('route-enter'); void main.offsetWidth;
      main.dataset.direction = 'back'; main.classList.add('route-enter');
      const animation = main.getAnimations().find(a => a.animationName === 'page-return');
      if (!animation) throw new Error('Expected contextual Back animation');
      animation.currentTime = 40; animation.pause(); return getComputedStyle(main).opacity;
    });
    assert.equal(opacity, '1', 'Motion keeps content at full contrast'); result.motion_contrast = 'passed';
    // Interrupt reads deliberately: a departing document must not start more
    // requests from late transport events (a WebKit regression).
    for (let i = 0; i < 3; i++) {
      for (const route of ['/settings/advanced', '/settings/advanced/ai']) {
        await page.goto(fixture.url + route); await page.locator('main h1').waitFor();
      }
    }
    await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached' });
    await page.goBack(); await page.waitForURL(fixture.url + '/settings/advanced'); await page.locator('main h1').waitFor();
    await page.goForward(); await page.waitForURL(fixture.url + '/settings/advanced/ai'); await page.locator('main h1').waitFor();
    await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached' }); result.rapid_navigation = 'passed';
    assert.deepEqual(result.errors, []); assert.deepEqual(result.external_requests, []);
  } catch (error) {
    result.failure = error.stack;
    if (page) { result.route = page.url(); await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }).catch(() => {}); }
    throw error;
  } finally {
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(result, null, 2));
    await browser?.close(); await fixture.runtime.stop();
    console.log(JSON.stringify({ engine, layouts: result.layouts, axe_scans: result.axe_scans, screenshots: result.screenshots.length, failure: !!result.failure, folder }));
  }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
