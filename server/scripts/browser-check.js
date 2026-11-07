const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { createPreview } = require('./preview');
async function main() {
  const preview = await createPreview({ loginRequired: true }); const browser = await chromium.launch();
  const folder = path.join(__dirname, '../../.local/qa/browser'); fs.mkdirSync(folder, { recursive: true });
  const result = { date: new Date().toISOString(), mode: 'isolated in-memory simulator; no physical broker', screenshots: [], violations: [], errors: [], external_requests: [], checks: [] };
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => result.errors.push(e.message));
  await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== preview.url) { result.external_requests.push(url.origin); return route.abort(); } return route.continue(); });
  const goto = async route => { await page.goto(preview.url + route); await page.locator('.primary-nav').waitFor(); await page.locator('main h1').waitFor(); await page.waitForFunction(() => document.documentElement.dataset.connected === 'true'); };
  try {
    await page.goto(preview.url); assert.equal(await page.locator('html').getAttribute('data-theme'), '05');
    await page.getByLabel('Username', { exact: true }).fill(preview.credentials.username); await page.getByLabel('Password', { exact: true }).fill(preview.credentials.password); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.locator('.primary-nav').waitFor(); result.checks.push('login, default05');
    await goto('/settings/devices'); await page.getByRole('button', { name: 'Favorite: Light 1', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[aria-label="Favorite: Light 1"]')?.getAttribute('aria-pressed') === 'true');
    await goto('/'); assert.ok(await page.locator('[data-device-id="light-1"]').count()); result.checks.push('favorite persisted and visible on Home');
    await goto('/rooms/room-1'); const d = page.locator('[data-device-id="light-1"]'); await d.getByRole('button', { name: 'Light 1: Turn off', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[data-device-id="light-1"]')?.textContent.includes('Turn on')); result.checks.push('light pending then simulated controller report');
    await goto('/assistant'); await page.getByLabel('Type a request', { exact: true }).fill('turn off room one lights'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.waitForFunction(() => document.getElementById('assistant-messages')?.textContent.includes('Controller reports')); result.checks.push('typed assistant uses real command service');
    await page.getByLabel('Type a request', { exact: true }).fill('do not unlock door'); await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.waitForFunction(() => document.getElementById('assistant-messages')?.textContent.includes('negated')); result.checks.push('negated request rejected');
    await goto('/security/door'); await page.getByRole('button', { name: 'Unlock front door', exact: true }).click(); await page.getByLabel('Password', { exact: true }).fill(preview.credentials.password); await page.getByRole('button', { name: 'Reauthenticate', exact: true }).click(); await page.getByRole('dialog').filter({ hasText: 'Unlock front door' }).waitFor(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); result.checks.push('unlock reauthentication and Cancel');
    await goto('/security/access-cards'); await page.getByRole('button', { name: 'Add access card', exact: true }).first().click(); await page.getByLabel('Card UID', { exact: true }).fill('aa bb cc dd'); await page.getByLabel('Owner name', { exact: true }).fill('<img src=x onerror=alert(1)>'); await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.getByRole('heading', { name: '<img src=x onerror=alert(1)>', exact: true }).waitFor(); assert.equal(await page.locator('img[src="x"]').count(), 0); result.checks.push('RFID creates, displays injection as text');
    await goto('/settings/appearance');
    const widths = [320, 390, 768, 1024, 1440]; const routes = ['/', '/rooms', '/security', '/assistant', '/settings'];
    for (const theme of ['05', '01', '03', '04']) {
      await goto('/settings/appearance'); await page.locator('input[name="theme"][value="' + theme + '"]').check(); await page.reload(); await page.locator('.primary-nav').waitFor(); assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of routes) {
          await goto(route); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); if (overflow) throw new Error('Horizontal overflow ' + theme + '/' + width + route);
          const filename = theme + '-' + width + '-' + (route.slice(1) || 'home') + '.png'; await page.screenshot({ path: path.join(folder, filename), fullPage: true }); result.screenshots.push(filename);
          if ([390, 1440].includes(width)) {
            await page.addScriptTag({ url: preview.url + '/__qa/axe.js' });
            const a11y = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } }));
            for (const issue of a11y.violations) result.violations.push({ theme, width, route, id: issue.id, impact: issue.impact, nodes: issue.nodes.map(n => n.target) });
          }
        }
      }
    }
    await goto('/settings/language'); await page.getByRole('radio', { name: 'हिन्दी', exact: true }).check(); await page.setViewportSize({ width: 320, height: 900 });
    for (const route of routes) { await goto(route); assert.equal(await page.locator('html').getAttribute('lang'), 'hi'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); await page.screenshot({ path: path.join(folder, 'hindi-320-' + (route.slice(1) || 'home') + '.png'), fullPage: true }); }
    result.checks.push('Hindi five screens at320px');
    await goto('/settings/language'); await page.getByRole('radio',{name:'English',exact:true}).check(); await goto('/settings/appearance');await page.locator('input[name="theme"][value="05"]').check();
    for(const width of [390,1440]){await page.setViewportSize({width,height:1000});for(const route of ['/rooms/room-1','/devices/light-1','/devices/sensor-gas','/devices/sensor-motion','/security/door','/security/access-cards','/security/activity','/security/alerts','/settings/appearance','/settings/accessibility','/settings/language','/settings/voice','/settings/notifications','/settings/home','/settings/privacy','/settings/help','/settings/about','/settings/advanced','/settings/advanced/ai','/settings/devices']){await goto(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Overflow '+route);await page.addScriptTag({url:preview.url+'/__qa/axe.js'});const a11y=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));for(const issue of a11y.violations)result.violations.push({theme:'05',width,route,id:issue.id,impact:issue.impact,nodes:issue.nodes.map(n=>n.target)});const filename='secondary-'+width+'-'+route.replaceAll('/','-')+'.png';await page.screenshot({path:path.join(folder,filename),fullPage:true});result.screenshots.push(filename);}}
    result.checks.push('20 secondary routes at390/1440px with axe');
    await page.setViewportSize({width:320,height:900});
    await page.emulateMedia({ reducedMotion: 'reduce' }); await goto('/settings/accessibility'); const checkboxes = page.locator('input[type="checkbox"]'); await checkboxes.nth(0).check(); await checkboxes.nth(1).check(); await goto('/security'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false); result.checks.push('large text/controls and reduced motion at320px');
    assert.equal(result.external_requests.length, 0); assert.deepEqual(result.errors, []); assert.deepEqual(result.violations, []);
    console.log(JSON.stringify({ screenshots: result.screenshots.length + 5, checks: result.checks, violations: result.violations.length, errors: result.errors, external_requests: result.external_requests }));
  } catch (error) { result.failure = error.message; result.route = page.url(); result.visible_text = await page.locator('body').innerText(); result.session_status = (await page.request.get(preview.url + '/api/auth/session')).status(); await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); throw error; }
  finally { fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(result, null, 2)); await browser.close(); await preview.runtime.stop(); }
}
main().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
