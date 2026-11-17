// Isolated UI/protocol check: synthetic audio, fake recognizer, no native models.
const { chromium } = require('playwright');
const { createPreview } = require('./preview');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const folder = process.env.HOMEAUTO_PROGRESS_QA_DIR || path.resolve(__dirname, '../../.local/qa/speech-progress');
  fs.mkdirSync(folder, { recursive: true });
  const fixture = await createPreview();
  const { speech, repo, home } = fixture.runtime;
  speech.ready.stt_ready = true; speech.ready.input_languages = ['en', 'hi'];
  let pending, activePage;
  speech.transcribe = (_pcm, _language, _wake, notify) => new Promise(resolve => { pending = { resolve, notify }; notify('encoding'); });
  const browser = await chromium.launch();
  const report = { fixture: 'Fake recognition progress, synthetic oscillator, disposable simulated home', checks: [], errors: [], external: [], network: [] };
  try {
    for (const theme of ['05', '01', '03', '04']) for (const language of ['en', 'hi']) for (const width of [390, 1280]) {
      const actor = { user_id: repo.one("SELECT id FROM users WHERE username='preview-owner'").id };
      const { version, ...settings } = home.preferences(actor);
      repo.write('INSERT OR REPLACE INTO user_preferences(user_id,value_json,version) VALUES(?,?,?)', [actor.user_id, JSON.stringify({ ...settings, language, spoken_replies: false }), version + 1]);
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      activePage = page;
      page.setDefaultTimeout(60000);
      page.on('pageerror', e => report.errors.push(e.message));
      page.on('requestfailed', req => report.network.push({ path: new URL(req.url()).pathname, failure: req.failure()?.errorText }));
      page.on('response', response => { if (!response.ok()) report.network.push({ path: new URL(response.url()).pathname, status: response.status() }); });
      await page.route('**/*', route => new URL(route.request().url()).origin === fixture.url ? route.continue() : (report.external.push(route.request().url()), route.abort()));
      await page.addInitScript(({ language, theme }) => {
        localStorage.setItem('homeauto.language.v1', language);
        localStorage.setItem('homeauto.theme.v1', theme);
        navigator.mediaDevices.getUserMedia = async () => {
          const context = new AudioContext(), tone = context.createOscillator(), gain = context.createGain(), destination = context.createMediaStreamDestination();
          gain.gain.value = .1; tone.connect(gain).connect(destination);
          await context.resume(); tone.start(context.currentTime + .5); tone.stop(context.currentTime + 1.2);
          const track = destination.stream.getAudioTracks()[0], stop = track.stop.bind(track);
          track.stop = () => { stop(); context.close(); };
          return destination.stream;
        };
      }, { language, theme });
      await page.goto(fixture.url + '/assistant');
      await page.locator('#assistant-mic').click();
      const encoding = language === 'hi' ? 'आपके कंप्यूटर पर आवाज़ पहचान रहा हूँ। इसमें एक मिनट तक लग सकता है।' : 'Recognizing speech locally. This may take up to a minute.';
      const decoding = language === 'hi' ? 'आवाज़ से शब्द लिख रहा हूँ…' : 'Turning speech into text…';
      await page.waitForFunction(text => document.getElementById('voice-status')?.textContent === text, encoding, { timeout: 15000 });
      assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
      assert.equal(await page.locator('#cancel-voice').isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
      const accessibility = await page.evaluate(() => axe.run('#cancel-voice', { runOnly: ['color-contrast'] }));
      assert.deepEqual(accessibility.violations, [], 'Cancel must remain readable on every theme panel');
      assert.ok(accessibility.passes.some(check => check.id === 'color-contrast'));
      await page.screenshot({ path: path.join(folder, `${theme}-${language}-${width}-encoding.png`), fullPage: true });
      pending.notify('decoding');
      await page.waitForFunction(text => document.getElementById('voice-status')?.textContent === text, decoding);
      await page.locator('#cancel-voice').click();
      assert.equal(await page.locator('#assistant-mic').isDisabled(), false);
      pending.notify('encoding'); pending.resolve({ text: 'Turn off all lights.', lang: 'en' });
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#cancel-voice').isHidden(), true);
      assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
      report.checks.push({ theme, language, width, cancelContrast: true, progressVisible: true, cancelWorks: true, staleProgressIgnored: true, commandsSent: 0 });
      await page.close();
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
    console.log(JSON.stringify(report));
  } catch (error) { report.failure = error.message; if (activePage && !activePage.isClosed()) { report.visibleText = await activePage.locator('body').innerText(); await activePage.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); } throw error; }
  finally { pending?.resolve({ text: 'Unsupported synthetic fixture phrase', lang: 'en' }); fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2)); await browser.close(); await fixture.runtime.stop(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
