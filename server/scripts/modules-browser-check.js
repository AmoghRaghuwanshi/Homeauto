const { chromium } = require('playwright');
const { createPreview } = require('./preview');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const fixture = await createPreview({ voice: true, heartbeat: false });
  const { home, modules, repo } = fixture.runtime;
  home.hardwareRequired = true;
  home.simulation = false;
  home.setConnected(false);
  let reconnects = 0;
  modules.reconnect = async () => { reconnects++; home.setConnected(true); };
  modules.probe = async () => false;
  const browser = await chromium.launch();
  const folder = path.resolve(__dirname, '../../.local/qa/modules-hardware');
  fs.mkdirSync(folder, { recursive: true });
  const report = { checks: [], errors: [], external: [], captures: [] };
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === fixture.url ? route.continue() : (report.external.push(route.request().url()), route.abort()));
    await page.goto(fixture.url + '/assistant');
    await page.getByRole('heading', { name: 'Connect your ESP32', exact: true }).waitFor();
    assert.equal(await page.locator('#assistant-mic').count(), 0);
    await page.getByRole('link', { name: 'Modules', exact: true }).click();
    await page.getByRole('heading', { name: 'Modules', exact: true }).waitFor();
    await page.getByLabel('MQTT broker URL', { exact: true }).fill('mqtt://127.0.0.1:1883');
    await page.getByLabel('MQTT username', { exact: true }).fill('fixture-user');
    await page.getByLabel('MQTT password', { exact: true }).fill('fixture-password');
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/modules/esp32') && response.request().method() === 'PUT'),
      page.getByRole('button', { name: 'Save and connect', exact: true }).click(),
    ]);
    await page.waitForFunction(() => document.querySelector('input[name="module-broker-password"]')?.value === '');
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/modules/esp32/connect') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Reconnect ESP32', exact: true }).click(),
    ]);
    assert.equal(reconnects, 2);
    assert.equal(home.hardwareReady(), false);
    report.checks.push('Offline Modules page is accessible; saving/reconnecting broker alone cannot enable the assistant');
    await page.getByLabel('Camera LAN address', { exact: true }).fill('192.168.1.20');
    await page.getByRole('button', { name: 'Save camera', exact: true }).click();
    await page.getByRole('button', { name: 'Check camera connection', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Check camera connection', exact: true }).click();
    await page.getByText('Camera unavailable', { exact: true }).waitFor();
    home.ingest('home/esp32/lights/online', Buffer.from('true'));
    await page.getByText('ESP32 connected', { exact: true }).waitFor();
    await page.locator('.primary-nav a[href="/assistant"]').click();
    await page.getByLabel('Type a request', { exact: true }).fill('Hello');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#assistant-messages')?.textContent.includes('Hello'));
    home.setConnected(false);
    await page.getByRole('heading', { name: 'Connect your ESP32', exact: true }).waitFor();
    assert.equal(await page.locator('#assistant-mic').count(), 0);
    report.checks.push('Fresh ESP32 report enables the assistant despite camera failure; disconnect removes it immediately');
    await page.goto(fixture.url + '/modules');
    await page.getByLabel('Camera LAN address', { exact: true }).waitFor();
    let releaseStatus;
    await page.route('**/api/modules', async route => {
      await new Promise(resolve => { releaseStatus = resolve; });
      await route.continue();
    });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByLabel('Camera LAN address', { exact: true }).fill('192.168.1.99');
    assert.ok(releaseStatus);
    releaseStatus();
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') !== 'true');
    assert.equal(await page.getByLabel('Camera LAN address', { exact: true }).inputValue(), '192.168.1.99');
    await page.unroute('**/api/modules');
    report.checks.push('Pending status refresh preserves connection details typed during the request');
    for (const theme of ['05','01','03','04']) for (const width of [320,1280]) {
      await page.evaluate(theme => localStorage.setItem('homeauto.theme.v1', theme), theme);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(fixture.url + '/modules');
      await page.getByLabel('MQTT broker URL', { exact: true }).waitFor();
      assert.equal(await page.getByText('Explore demo home', { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      // Scanner is evaluated from the installed test package in this isolated browser.
      await page.evaluate(fs.readFileSync(require.resolve('axe-core'), 'utf8'));
      const scan = await page.evaluate(() => axe.run(document.querySelector('main'), { runOnly: ['color-contrast','button-name','label'] }));
      assert.deepEqual(scan.violations.map(item => item.id), []);
      const name = 'modules-' + theme + '-' + width + '.png';
      await page.screenshot({ path: path.join(folder, name), fullPage: true }); report.captures.push(name);
    }
    assert.equal(repo.one('SELECT COUNT(*) n FROM commands').n, 0);
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
    console.log(JSON.stringify({ checks: report.checks.length, captures: report.captures.length, commands: 0, page_errors: 0 }));
  } catch (error) {
    report.failure = error.stack;
    report.moduleStatus = modules.status();
    if (page) { report.visibleText = await page.locator('body').innerText(); await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); }
    throw error;
  }
  finally {
    fs.writeFileSync(path.join(folder, 'browser-results.json'), JSON.stringify(report, null, 2));
    await browser.close(); await fixture.runtime.stop();
  }
}

if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
