// Real CPU speech engines, synthetic microphone audio, in-memory devices only.
const { chromium } = require('playwright');
const { createPreview } = require('./preview');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const folder = process.env.HOMEAUTO_DEMO_QA_DIR || path.join(__dirname, '../../.local/qa/demo-voice');
  fs.mkdirSync(folder, { recursive: true });
  const fixture = await createPreview({ voice: true });
  if (process.env.HOMEAUTO_QA_HOST === 'localhost') fixture.url = fixture.url.replace('127.0.0.1', 'localhost');
  let browser, activePage;
  const result = { mode: 'Real CPU Whisper medium INT8/Kokoro; synthetic audio; simulated devices', checks: [], errors: [], external: [] };
  try {
    const until = Date.now() + 60000;
    while (!fixture.runtime.speech.ready.stt_ready || !fixture.runtime.speech.ready.tts_ready) {
      if (Date.now() > until) throw Error('Native speech workers not ready');
      await new Promise(r => setTimeout(r, 100));
    }
    browser = process.env.HOMEAUTO_QA_PERSISTENT_PROFILE ? await chromium.launchPersistentContext(process.env.HOMEAUTO_QA_PERSISTENT_PROFILE, { executablePath: process.env.HOMEAUTO_QA_CHROME_PATH, headless: true, viewport: { width: 390, height: 844 } }) : await chromium.launch();
    for (const [language, phrase] of [['en', 'Turn on the light.'], ['en', 'Turn off room one lights.'], ['hi', 'सभी लाइट बंद करो।']]) {
      const actor = { user_id: 'synthetic-qa', role: 'owner' };
      const { job_id } = await fixture.runtime.speech.synthesize(phrase, language, actor);
      while (fixture.runtime.speech.job(job_id, actor).state === 'queued') await new Promise(r => setTimeout(r, 100));
      const wav = fixture.runtime.speech.audio(job_id, actor);
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      activePage = page;
      const speechRequests = []; page.on('request', request => { if (new URL(request.url()).pathname === '/api/assistant/speech' && request.method() === 'POST') speechRequests.push(request.postDataJSON()); });
      page.on('response', async response => { if (/\/api\/assistant\/(execute|speech)/.test(response.url())) { try { (result.responses ||= []).push({ url: new URL(response.url()).pathname, status: response.status(), body: await response.json() }); } catch {} } });
      page.on('pageerror', e => result.errors.push(e.message));
      await page.route('**/*', r => { if (new URL(r.request().url()).origin !== fixture.url) { result.external.push(r.request().url()); return r.abort(); } return r.continue(); });
      await page.addInitScript(base64 => {
        window.fixtureAudioEnded = false; window.peakLevel = 0; window.playedReplies = []; window.voiceProgress = [];
        const NativeSocket = window.WebSocket;
        window.WebSocket = class extends NativeSocket { constructor(...args) { super(...args); this.addEventListener('message', event => { try { const value = JSON.parse(event.data); if (value.type === 'voice_progress') window.voiceProgress.push(value.stage); } catch {} }); } };
        navigator.mediaDevices.getUserMedia = async () => {
          const context = new AudioContext(); const source = context.createBufferSource();
          source.buffer = await context.decodeAudioData(Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer);
          const destination = context.createMediaStreamDestination(); source.connect(destination);
          source.onended = () => { window.fixtureAudioEnded = true; };
          await context.resume(); source.start(context.currentTime + 3);
          const track = destination.stream.getAudioTracks()[0]; const stop = track.stop.bind(track);
          track.stop = () => { stop(); try { source.stop(); } catch {} context.close(); };
          return destination.stream;
        };
        const NativeAudio = window.Audio;
        window.Audio = function(...args) { const audio = new NativeAudio(...args); audio.addEventListener('playing', () => window.playedReplies.push(audio.src)); return audio; };
        setInterval(() => { window.peakLevel = Math.max(window.peakLevel, document.getElementById('microphone-level')?.value || 0); }, 50);
      }, wav.toString('base64'));
      await page.goto(fixture.url + '/assistant'); await page.getByRole('button', { name: 'Tap to speak', exact: true }).waitFor();
      const selector = page.getByLabel('Input language', { exact: true });
      assert.equal(await selector.inputValue(), 'auto');
      const before = fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n;
      await page.getByRole('button', { name: 'Tap to speak', exact: true }).click();
      await page.waitForFunction(() => window.fixtureAudioEnded, null, { timeout: 15000 });
      assert.ok(await page.evaluate(() => window.peakLevel > .0035));
      if (phrase === 'Turn on the light.') {
        await page.waitForFunction(() => window.playedReplies.length > 0, null, { timeout: 135000 });
        assert.match(await page.locator('#assistant-messages').innerText(), /Which light/);
        assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n, before);
        assert.ok(await page.evaluate(() => window.voiceProgress.includes('encoding') && window.voiceProgress.includes('decoding')));
        result.checks.push({ language: 'auto', phrase, clarificationSpoken: true, commandsSent: 0 });
        await page.close(); continue;
      }
      await page.waitForFunction(() => window.playedReplies.length > 0, null, { timeout: 135000 });
      assert.ok(fixture.runtime.repo.one('SELECT COUNT(*) AS n FROM commands').n > before);
      assert.equal(speechRequests.at(-1).language, language);
      assert.ok(await page.evaluate(() => window.voiceProgress.includes('encoding') && window.voiceProgress.includes('decoding')));
      assert.equal(await page.getByRole('dialog', { name: 'Review voice request', exact: true }).count(), 0);
      const recognized = await page.locator('#assistant-messages').innerText();
      const after = await page.locator('#assistant-messages').innerText();
      if (language === 'hi') assert.match(after, /डेमो.*बंद/);
      await page.screenshot({ path: path.join(folder, language + '.png'), fullPage: true });
      result.checks.push({ language, recognized, after, spokenReplyPlayed: true, automaticEndpoint: true, automaticSimulationExecution: true, speechLanguage: speechRequests.at(-1).language });
      if (language === 'en') {
        await page.evaluate(() => { const Original = window.Audio; window.Audio = function(...args) { const a = new Original(...args); a.play = () => Promise.reject(Object.assign(new Error('Synthetic autoplay restriction'), { name: 'NotAllowedError' })); return a; }; });
        await page.getByRole('button', { name: 'Replay', exact: true }).click();
        await page.getByText('Your browser paused audio. Press Play in the spoken reply player.', { exact: true }).waitFor({ timeout: 30000 });
        assert.equal(await page.getByLabel('Spoken reply', { exact: true }).getAttribute('controls'), '');
        result.checks.push({ manualPlaybackFallback: true });
      }
      await page.close();
    }
    if (process.env.HOMEAUTO_QA_STRESS === '1') {
      const stress = await require('./recognition-stress-check').runStress(fixture, path.join(folder, 'stress'));
      result.checks.push({ recognitionStress: stress.rows.map(row => ({ name: row.name, duration_ms: row.duration_ms, limit_reached: row.limit_reached })), extraCommandsSent: stress.commands_sent });
    }
    assert.deepEqual(result.errors, []); assert.deepEqual(result.external, []);
    console.log(JSON.stringify({checks:result.checks,errors:result.errors,external:result.external}));
  } catch (error) {
    result.failure = error.message;
    if (activePage && !activePage.isClosed()) { result.visibleText = await activePage.locator('body').innerText(); await activePage.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); }
    throw error;
  } finally {
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(result, null, 2));
    await browser?.close(); await fixture.runtime.stop();
  }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
