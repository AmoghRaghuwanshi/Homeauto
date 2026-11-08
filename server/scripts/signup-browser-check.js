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
    const historyWrites = await page.evaluate(async () => {
      const original = history.replaceState; let writes = 0;
      history.replaceState = function (...args) { writes++; return original.apply(this, args); };
      try {
        const fields = [...document.querySelectorAll('form input')];
        for (let i = 0; i < 120; i++) fields[i % fields.length].focus({ preventScroll: true });
        for (let i = 0; i < 60; i++) window.dispatchEvent(new Event('scroll'));
        await new Promise(resolve => setTimeout(resolve, 500));
        return writes;
      } finally { history.replaceState = original; }
    });
    assert.ok(historyWrites <= 2, 'Focus/scroll bursts must coalesce history writes');
    result.checks.push('Rapid focus and scroll changes preserve navigation without exhausting Safari history writes');
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
    await signup();
    const fillSignup = async (username, secret = password) => {
      await page.getByLabel('Your name', { exact: true }).fill('Integration test owner'); await page.getByLabel('Username', { exact: true }).fill(username);
      await page.getByLabel('Password', { exact: true }).fill(secret); await page.getByLabel('Confirm password', { exact: true }).fill(secret);
    };
    const signinAndLogout = async username => {
      assert.equal(await page.getByLabel('Username', { exact: true }).inputValue(), username);
      await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.getByRole('heading', { name: 'Connect your home gateway', exact: true }).waitFor();
      await page.goto(fixture.url + '/settings'); await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
    };
    const prior = submissions;
    await fillSignup('bad name'); await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Start with a letter or number.' }).waitFor(); assert.equal(submissions, prior);
    await fillSignup('valid-name', 'short'); await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByText('Use a password with 12–256 characters.', { exact: true }).waitFor(); assert.equal(submissions, prior);
    assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('aria-invalid'), 'true');
    result.checks.push('Invalid usernames and short passwords produce inline errors without submitting');

    const delayedName = 'delayed-' + crypto.randomBytes(5).toString('hex'); await fillSignup('  ' + delayedName.toUpperCase() + '  ');
    let release; let committed; let commitTimer;
    const gate = new Promise(resolve => { release = resolve; });
    const didCommit = new Promise((resolve, reject) => { committed = () => { clearTimeout(commitTimer); resolve(); }; commitTimer = setTimeout(() => reject(new Error('Signup did not reach PostgreSQL')), 15000); });
    await page.route('**/api/auth/signup', async route => { const response = await route.fetch(); assert.equal(response.status(), 201); committed(); await gate; await route.fulfill({ response }); });
    try {
      await page.getByRole('button', { name: 'Create account', exact: true }).click(); await didCommit;
      await page.getByRole('button', { name: 'हिन्दी', exact: true }).click(); assert.equal(await page.locator('button[type=submit]').isDisabled(), true);
      assert.equal(await page.locator('form input').evaluateAll(inputs => inputs.every(input => input.readOnly)), true);
      await inspect('hindi-pending-signup');
      await page.evaluate(() => document.querySelector('form').requestSubmit()); assert.equal(submissions, prior + 1);
      release(); await page.waitForURL(fixture.url + '/login');
    } finally { clearTimeout(commitTimer); release(); await page.unroute('**/api/auth/signup'); }
    await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByText('Account created. Sign in to continue.', { exact: true }).waitFor();
    await signinAndLogout(delayedName);
    result.checks.push('Whitespace/case normalization matches the API; a committed signup survives language rerender and prevents duplicate submissions');

    await signup(); const uncertainName = 'uncertain-' + crypto.randomBytes(5).toString('hex'); await fillSignup(uncertainName);
    await page.route('**/api/auth/signup', async route => { const response = await route.fetch(); assert.equal(response.status(), 201); await route.abort('failed'); });
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByText("Couldn't confirm account creation. Try signing in with these details before creating another account.", { exact: true }).waitFor();
    await page.unroute('**/api/auth/signup'); assert.equal(submissions, prior + 2);
    assert.equal(await page.evaluate(password => Object.values(localStorage).some(value => value.includes(password)), password), false);
    await page.getByRole('link', { name: 'Sign in', exact: true }).click(); await signinAndLogout(uncertainName);
    result.checks.push('A lost response after PostgreSQL commit shows honest recovery; sign-in succeeds without retrying signup');

    await signup(); await fillSignup('upstream-test');
    for (const response of [{ status: 503, contentType: 'text/html', body: '<html>Unavailable</html>' }, { status: 200, contentType: 'application/json', body: '{}' }]) {
      await page.route('**/api/auth/signup', route => route.fulfill(response)); await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.getByText("Couldn't confirm account creation. Try signing in with these details before creating another account.", { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/signup'); assert.equal(await page.getByRole('button', { name: 'Create account', exact: true }).isEnabled(), true);
      await page.unroute('**/api/auth/signup');
    }
    result.checks.push('Upstream HTML errors and malformed success payloads never claim account creation');
    assert.deepEqual(result.errors, []); assert.deepEqual(result.external_requests, []);
  } catch (error) { result.failure = error.stack || error.message; if (page) { result.route = page.url(); await page.screenshot({ path: path.join(folder,'failure.png'), fullPage: true }).catch(() => {}); } throw error; }
  finally { fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(result,null,2)); await browser?.close(); await fixture.stop(); console.log(JSON.stringify({ engine, checks: result.checks.length, screenshots: result.screenshots.length, axe_scans: result.axe_scans, violations: result.violations.length, errors: result.errors, failure: !!result.failure, folder })); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { main };
