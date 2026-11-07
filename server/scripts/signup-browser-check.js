const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createOnlinePreview } = require('../tests/helpers/online-preview');

async function main() {
  const engine = process.argv.includes('--browser=webkit') ? 'webkit' : 'chromium';
  const functionalOnly = process.argv.includes('--functional-only');
  const folder = process.env.HOMEAUTO_SIGNUP_QA_DIR || path.resolve(__dirname, '../../.local/qa/signup', engine);
  fs.mkdirSync(folder, { recursive: true });
  const result = { engine, fixture: 'Disposable PostgreSQL and simulated gateway; no production accounts or hardware', screenshots: [], axe_scans: 0, violations: [], errors: [], external_requests: [], checks: [] };
  const fixture = await createOnlinePreview(); let browser, page;
  try {
    browser = await ({ chromium, webkit }[engine]).launch();
    const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page = await context.newPage(); page.on('pageerror', e => result.errors.push(e.message));
    let submissions = 0;
    page.on('request', r => { if (new URL(r.url()).pathname === '/api/auth/signup' && r.method() === 'POST') submissions++; });
    await page.route('**/*', route => { if (new URL(route.request().url()).origin === fixture.url) return route.continue(); result.external_requests.push(route.request().url()); return route.abort(); });
    const signup = async () => { await page.goto(fixture.url + '/signup'); await page.getByRole('heading', { name: 'Create your account', exact: true }).waitFor(); };
    const inspect = async name => {
      const issues = await page.evaluate(() => {
        const issues = []; if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('Horizontal overflow');
        for (const n of document.querySelectorAll('h1,h2,input,button,a')) {
          const r = n.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const label = n.getAttribute('aria-label') || n.name || n.textContent.trim().slice(0,60);
          if (r.left < -1 || r.right > innerWidth + 1) issues.push('Clipped control: ' + label);
          if (n.matches('button,a') && (r.width < 44 || r.height < 44)) issues.push('Small touch target: ' + label);
          if (innerWidth <= 1023 && n.matches('input') && parseFloat(getComputedStyle(n).fontSize) < 16) issues.push('Small input text: ' + label);
        } return issues;
      }); assert.deepEqual(issues, [], name);
      await page.addScriptTag({ url: '/__qa/axe.js' });
      const violations = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
      result.axe_scans++; if (violations.length) result.violations.push({ name, violations }); assert.deepEqual(violations, [], name);
      await page.screenshot({ path: path.join(folder,name + '.png'), fullPage: true }); result.screenshots.push(name + '.png');
    };
    await page.goto(fixture.url); await page.getByRole('link', { name: 'Create account', exact: true }).click(); await page.waitForURL(fixture.url + '/signup'); await page.reload(); await page.getByRole('heading', { name: 'Create your account', exact: true }).waitFor();
    await page.goBack(); await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor(); await page.goForward(); await page.getByRole('button', { name: 'Create account', exact: true }).waitFor();
    result.checks.push('Sign-in signup link, direct/signup refresh and browser Back/Forward');
    if (!functionalOnly) for (const theme of ['05','01','03','04']) {
      await page.evaluate(async theme => (await import('/js/preferences.js')).applyPreferences({ theme }), theme);
      for (const [width,height] of [[320,568],[390,844],[844,390],[1440,1000]]) {
        await page.setViewportSize({ width,height });
        for (const route of ['/signup','/login']) { await page.goto(fixture.url + route); await page.getByRole('button', { name: route === '/signup' ? 'Create account' : 'Sign in', exact: true }).waitFor(); await inspect(theme + '-' + width + '-' + route.slice(1)); }
      }
    }
    if (!functionalOnly) result.checks.push('Signup and sign-in in all four themes at320/390/844/1440 with touch and accessibility checks');
    await page.setViewportSize({ width: 390,height: 844 }); await signup();
    const password = 'a long synthetic browser password';
    await page.getByLabel('Your name', { exact: true }).fill('New test owner'); await page.getByLabel('Username', { exact: true }).fill('new-browser-owner'); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByLabel('Confirm password', { exact: true }).fill(password + ' mismatch');
    await page.getByRole('button', { name: 'Create account', exact: true }).click(); await page.getByText('Passwords do not match.', { exact: true }).waitFor(); assert.equal(submissions, 0);
    await page.getByRole('button', { name: 'Show passwords', exact: true }).click(); assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text'); assert.equal(await page.getByLabel('Confirm password', { exact: true }).getAttribute('type'), 'text'); await page.getByRole('button', { name: 'Hide passwords', exact: true }).click();
    await page.getByRole('button', { name: 'हिन्दी', exact: true }).click(); await page.getByLabel('आपका नाम', { exact: true }).waitFor(); assert.equal(await page.getByLabel('आपका नाम', { exact: true }).inputValue(), 'New test owner'); assert.equal(await page.getByLabel('पासवर्ड', { exact: true }).inputValue(), password); await inspect('hindi-signup');
    await page.getByRole('button', { name: 'English', exact: true }).click(); assert.equal(await page.evaluate(password => Object.values(localStorage).some(v => v.includes(password)), password), false);
    result.checks.push('Password confirmation blocks submission; visibility toggle, Hindi labels and in-memory language-switch drafts work without password persistence');
    await page.getByLabel('Confirm password', { exact: true }).fill(password); await page.getByLabel('Username', { exact: true }).fill('cloud-owner'); await page.getByRole('button', { name: 'Create account', exact: true }).click(); await page.getByText('That username is taken. Choose another one.', { exact: true }).waitFor();
    const username = 'registered-' + crypto.randomBytes(5).toString('hex'); await page.getByLabel('Username', { exact: true }).fill(username); await page.getByRole('button', { name: 'Create account', exact: true }).click(); await page.waitForURL(fixture.url + '/login'); await page.getByText('Account created. Sign in to continue.', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Username', { exact: true }).inputValue(), username);
    await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.locator('.primary-nav').waitFor(); await page.waitForURL(fixture.url + '/'); await page.getByRole('heading', { name: 'Connect your home gateway', exact: true }).waitFor();
    const session = await page.request.get(fixture.url + '/api/auth/session'); const identity = await session.json(); assert.equal(identity.user.role, 'owner'); assert.ok(identity.household_id); assert.notEqual(identity.household_id, fixture.database.household); const snapshot = await (await page.request.get(fixture.url + '/api/snapshot')).json(); assert.equal(snapshot.devices.length, 0);
    result.checks.push('Duplicate feedback, real signup, separate sign-in and empty isolated home succeed');
    await page.goto(fixture.url + '/signup'); await page.waitForURL(fixture.url + '/'); await page.goto(fixture.url + '/settings'); await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor(); assert.equal((await page.request.get(fixture.url + '/api/auth/session')).status(), 401);
    result.checks.push('Signed-in users redirect from signup; Sign out revokes the session');
    assert.deepEqual(result.errors, []); assert.deepEqual(result.external_requests, []);
  } catch (error) { result.failure = error.stack || error.message; if (page) { result.route = page.url(); await page.screenshot({ path: path.join(folder,'failure.png'), fullPage: true }).catch(() => {}); } throw error; }
  finally { fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(result,null,2)); await browser?.close(); await fixture.stop(); console.log(JSON.stringify({ engine, checks: result.checks.length, screenshots: result.screenshots.length, axe_scans: result.axe_scans, violations: result.violations.length, errors: result.errors, failure: !!result.failure, folder })); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { main };
