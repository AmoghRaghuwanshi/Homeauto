// Deterministic startup transitions: disposable simulator, fake workers, never microphone/hardware.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path');
const assert = require('node:assert/strict');
const { createPreview } = require('./preview');

async function main() {
  const folder = process.env.HOMEAUTO_STARTUP_QA_DIR || path.resolve(__dirname, '../../.local/qa/speech-startup');
  fs.mkdirSync(folder, { recursive: true });
  const fixture = await createPreview();
  const speech = fixture.runtime.speech;
  speech.states = { stt: 'checking', tts: 'checking' };
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const result = { fixture: 'Fake startup states; no native model, microphone or hardware', checks: [], errors: [], external: [] };
  page.on('pageerror', e => result.errors.push(e.message));
  let snapshotReads = 0; page.on('request', request => { if (new URL(request.url()).pathname === '/api/snapshot') snapshotReads++; });
  await page.route('**/*', route => new URL(route.request().url()).origin === fixture.url ? route.continue() : (result.external.push(route.request().url()), route.abort()));
  await page.addInitScript(() => { window.microphoneCalls = 0; navigator.mediaDevices.getUserMedia = async () => { window.microphoneCalls++; throw Error('Unexpected microphone capture'); }; });
  const phase = value => { speech.states.stt = value; speech.states.tts = value; speech.ready.stt_ready = false; speech.ready.tts_ready = false; fixture.runtime.home.emitChange(); };
  try {
    await page.goto(fixture.url + '/assistant');
    await page.locator('#assistant-readiness').getByText('Checking voice models…', { exact: true }).waitFor();
    assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
    await page.getByLabel('Type a request', { exact: true }).fill('Preserved draft');
    phase('loading');
    await page.locator('#assistant-readiness').getByText('Loading voice models…', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Type a request', { exact: true }).inputValue(), 'Preserved draft');
    await page.screenshot({ path: path.join(folder, 'loading-mobile.png'), fullPage: true });
    result.checks.push('Checking/loading keep mic disabled, explain startup and preserve typing');

    for (const route of ['/settings/voice', '/settings/advanced/ai', '/settings/advanced']) {
      await page.goto(fixture.url + route);
      await page.getByText('Loading voice models…', { exact: true }).first().waitFor();
      assert.equal(await page.getByText('Local setup required', { exact: true }).count(), 0);
    }
    result.checks.push('Voice settings, Local AI and diagnostics show loading rather than missing setup');

    await page.goto(fixture.url + '/assistant'); phase('failed');
    await page.locator('#assistant-readiness').getByText('Voice could not start', { exact: true }).waitFor();
    assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
    phase('not_configured');
    await page.locator('#assistant-readiness').getByText('Local setup required', { exact: true }).waitFor();
    result.checks.push('Failure and missing installation remain distinct, without enabling capture');

    phase('loading');
    speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] });
    await page.waitForFunction(() => document.getElementById('assistant-mic')?.disabled === false);
    assert.equal(await page.locator('#assistant-readiness').innerText(), 'Ready locally');
    assert.equal(await page.locator('#assistant-setup-note').isHidden(), true);
    assert.equal(await page.evaluate(() => window.microphoneCalls), 0);
    await page.screenshot({ path: path.join(folder, 'ready-mobile.png'), fullPage: true });
    result.checks.push('Worker ready automatically enables mic without reload or starting it');

    speech.unavailable('stt');
    await page.locator('#assistant-readiness').getByText('Voice could not start', { exact: true }).waitFor();
    assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
    result.checks.push('Worker failure removes readiness and disables capture again');

    const assets = require('../voice/assets'); const verify = assets.verifyProfile; const startWorker = speech.startWorker;
    let restarts = 0;
    try {
      speech.config.VOICE_ENABLED = true;
      assets.verifyProfile = async () => ({ bytes: 1, sha256: 'synthetic-startup-browser' });
      speech.startWorker = () => { restarts++; };
      const commands = fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n;
      await page.getByRole('button', { name: 'Retry voice', exact: true }).click();
      await page.locator('#assistant-readiness').getByText('Loading voice models…', { exact: true }).waitFor();
      assert.equal(restarts, 1); assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
      speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] });
      await page.waitForFunction(() => document.getElementById('assistant-mic')?.disabled === false);
      assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n, commands);
      assert.equal(await page.evaluate(() => window.microphoneCalls), 0);
      result.checks.push('Explicit authorized Retry reloads the worker once, without replaying a command or opening the mic');
    } finally { assets.verifyProfile = verify; speech.startWorker = startWorker; speech.config.VOICE_ENABLED = false; }

    speech.unavailable('stt');
    await page.locator('#assistant-readiness').getByText('Voice could not start', { exact: true }).waitFor();

    const originalEmit = fixture.runtime.home.emitChange;
    try {
      // Reproduce the actual stale-Chrome case: the hub is ready, no WS update reaches the page.
      fixture.runtime.home.emitChange = () => {};
      speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] });
      assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
      const reads = snapshotReads;
      await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForFunction(() => document.getElementById('assistant-mic')?.disabled === false);
      assert.equal(snapshotReads, reads + 1);
      assert.equal(await page.evaluate(() => window.microphoneCalls), 0);
      result.checks.push('Foreground return refreshes stale readiness with one read, no WS update or microphone capture');
    } finally { fixture.runtime.home.emitChange = originalEmit; }

    speech.handle('tts', { type: 'ready', languages: ['en', 'hi'], voices: { en: 'fixture', hi: 'fixture' } });
    await page.goto(fixture.url + '/settings/voice');
    assert.equal(await page.getByRole('button', { name: 'Test voice', exact: true }).isEnabled(), true);
    await page.goto(fixture.url + '/settings/language');
    await page.getByRole('radio', { name: 'हिन्दी', exact: true }).check();
    phase('loading'); speech.ready.stt_ready = false; fixture.runtime.home.emitChange();
    await page.goto(fixture.url + '/assistant');
    await page.locator('#assistant-readiness').getByText('वॉइस मॉडल लोड हो रहे हैं…', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(folder, 'loading-hindi.png'), fullPage: true });
    result.checks.push('Hindi startup feedback is translated; TTS readiness independently enables its test');
    assert.deepEqual(result.errors, []); assert.deepEqual(result.external, []);
    console.log(JSON.stringify(result));
  } catch (error) { result.failure = error.message; await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); throw error; }
  finally { fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(result, null, 2)); await browser.close(); await fixture.runtime.stop(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
