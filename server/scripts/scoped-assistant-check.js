// Scoped dialogue acceptance. Native mode uses synthetic speech and real local
// models; default mode uses fake recognition/TTS. Both use a disposable home.
const { chromium } = require('playwright');
const { createPreview } = require('./preview');
const { pcmWav } = require('../voice/whisper');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const native = process.env.HOMEAUTO_DIALOGUE_NATIVE === '1';
  const folder = process.env.HOMEAUTO_DIALOGUE_QA_DIR || path.resolve(__dirname, '../../.local/qa/scoped-assistant');
  fs.mkdirSync(folder, { recursive: true });
  const fixture = await createPreview({ voice: native });
  const { home, repo, speech } = fixture.runtime;
  const report = { native, input: 'Synthetic fixtures only; no human microphone or hardware acceptance', typed: [], voice: [], layouts: [], errors: [], external: [] };
  const tone = Buffer.alloc(16000);
  for (let i = 0; i < tone.length / 2; i++) tone.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 440 * i / 16000)), i * 2);
  let input = { language: 'en', text: 'What is the weather?' }, browser, page;
  if (!native) {
    speech.ready = { stt_ready: true, tts_ready: true, input_languages: ['en', 'hi'], reply_languages: ['en', 'hi'], voices: [{ language: 'en', id: 'fake' }, { language: 'hi', id: 'fake' }] };
    speech.run = async (kind, payload) => kind === 'stt' ? { candidates: [{ lang: input.language, text: input.text }] } : { audio: pcmWav(tone).toString('base64'), duration_ms: 1 };
  }
  try {
    const until = Date.now() + 90000;
    while (!speech.ready.stt_ready || !speech.ready.tts_ready) { if (Date.now() > until) throw Error('Local speech workers not ready'); await new Promise(resolve => setTimeout(resolve, 100)); }
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => report.errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === fixture.url ? route.continue() : (report.external.push(route.request().url()), route.abort()));
    await page.addInitScript(() => {
      window.qaInput = ''; window.qaPlayed = []; window.qaMicCalls = 0;
      navigator.mediaDevices.getUserMedia = async () => {
        window.qaMicCalls++;
        const context = new AudioContext(), source = context.createBufferSource(), destination = context.createMediaStreamDestination();
        source.buffer = await context.decodeAudioData(Uint8Array.from(atob(window.qaInput), c => c.charCodeAt(0)).buffer);
        source.connect(destination); await context.resume(); source.start(context.currentTime + 3);
        const track = destination.stream.getAudioTracks()[0], stop = track.stop.bind(track);
        track.stop = () => { stop(); try { source.stop(); } catch {} context.close(); };
        return destination.stream;
      };
      const OriginalAudio = window.Audio;
      window.Audio = function(...args) { const audio = new OriginalAudio(...args); audio.addEventListener('playing', () => window.qaPlayed.push(audio.src)); return audio; };
    });
    const actor = { user_id: repo.one("SELECT id FROM users WHERE username='preview-owner'").id };
    function spoken(enabled) {
      const { version, ...settings } = home.preferences(actor);
      repo.write('INSERT OR REPLACE INTO user_preferences(user_id,value_json,version) VALUES(?,?,?)', [actor.user_id, JSON.stringify({ ...settings, input_language: 'auto', reply_language: 'auto', spoken_replies: enabled }), version + 1]);
      home.emitChange();
    }
    spoken(false);
    const cases = [
      ['Hello', 'en', 'Hello'], ['नमस्ते', 'hi', 'नमस्ते'],
      ['What can you do?', 'en', 'I can'], ['आप क्या कर सकते हैं?', 'hi', 'मैं'],
      ['What is the weather?', 'en', "I can't help with that request yet"], ['मुझे एक कहानी सुनाओ', 'hi', 'मैं फिलहाल यह काम नहीं कर सकता'],
    ];
    for (const [text, language, expected] of cases) {
      await page.goto(fixture.url + '/assistant');
      await page.getByLabel('Type a request', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.waitForFunction(expected => document.querySelector('#assistant-messages')?.textContent.includes(expected), expected);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.equal(await page.evaluate(() => window.qaMicCalls), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      report.typed.push({ text, language, answer: await page.locator('#assistant-messages').innerText() });
    }
    if (!native) {
      for (const theme of ['05', '01', '03', '04']) for (const width of [320, 1280]) for (const [text, language, expected] of cases.slice(-2)) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(async theme => { const { applyPreferences } = await import('/js/preferences.js'); applyPreferences({ theme }); }, theme);
        await page.goto(fixture.url + '/assistant');
        await page.getByLabel('Type a request', { exact: true }).fill(text);
        await page.getByLabel('Type a request', { exact: true }).press('Enter');
        await page.waitForFunction(expected => document.querySelector('#assistant-messages')?.textContent.includes(expected), expected);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('dialog[open]').count(), 0);
        await page.screenshot({ path: path.join(folder, `${theme}-${language}-${width}-scope.png`), fullPage: true });
        report.layouts.push({ theme, language, width, keyboardSend: true, overflow: false });
      }
      await page.evaluate(async () => { const { applyPreferences } = await import('/js/preferences.js'); applyPreferences({ theme: '05' }); });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    spoken(true); await page.goto(fixture.url + '/assistant');
    const requests = [], jobs = [];
    page.on('request', req => { if (new URL(req.url()).pathname === '/api/assistant/speech' && req.method() === 'POST') requests.push(req.postDataJSON()); });
    page.on('response', async response => { if (/\/api\/assistant\/speech\//u.test(new URL(response.url()).pathname)) { try { jobs.push(await response.json()); } catch {} } });
    for (const [language, text, expected] of [['en', 'What is the weather?', "I can't help with that request yet"], ['hi', 'मुझे एक कहानी सुनाओ।', 'मैं फिलहाल यह काम नहीं कर सकता']]) {
      input = { language, text };
      let wav = pcmWav(tone);
      if (native) {
        const speaker = { user_id: 'synthetic-dialogue-input', role: 'owner' };
        const { job_id } = await speech.synthesize(text, language, speaker);
        while (speech.job(job_id, speaker).state === 'queued') await new Promise(resolve => setTimeout(resolve, 100));
        wav = speech.audio(job_id, speaker);
        fs.writeFileSync(path.join(folder, language + '-synthetic-input.wav'), wav);
      }
      await page.evaluate(base64 => { window.qaInput = base64; }, wav.toString('base64'));
      const before = await page.evaluate(() => window.qaPlayed.length);
      const started = Date.now();
      await page.getByRole('button', { name: 'Tap to speak', exact: true }).click();
      await page.waitForFunction(before => window.qaPlayed.length > before, before, { timeout: 135000 });
      assert.match(await page.locator('#assistant-messages').innerText(), new RegExp(expected));
      assert.equal(requests.at(-1).language, language);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      const audioUrl = jobs.at(-1)?.audio_url;
      if (native && audioUrl) { const response = await page.request.get(fixture.url + audioUrl); assert.ok(response.ok()); fs.writeFileSync(path.join(folder, language + '-reply.wav'), await response.body()); }
      report.voice.push({ language, text, wall_ms: Date.now() - started, spoken: true, answer: await page.locator('#assistant-messages').innerText(), recognition: speech.recognitionMetrics() });
      await page.screenshot({ path: path.join(folder, language + '-voice-mobile.png'), fullPage: true });
      const cacheJobsBefore = jobs.length, played = await page.evaluate(() => window.qaPlayed.length), cachedAt = Date.now();
      await page.getByLabel('Type a request', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.waitForFunction(played => window.qaPlayed.length > played, played, { timeout: 5000 });
      assert.equal(jobs.slice(cacheJobsBefore).at(-1).duration_ms, 0);
      report.voice.push({ language, repeatedReplyCache: true, wall_ms: Date.now() - cachedAt });
    }
    if (!native) {
      // A conversational answer needs no device confirmation in the physical
      // profile either. The publisher remains fake, and no command is sent.
      home.simulation = false; spoken(false); await page.goto(fixture.url + '/assistant');
      await page.getByLabel('Type a request', { exact: true }).fill('Hello'); await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#assistant-messages')?.textContent.includes('Hello'));
      assert.equal(await page.locator('dialog[open]').count(), 0);
    }
    assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0); report.commands_sent = 0;
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
    console.log(JSON.stringify(report));
  } catch (error) {
    report.failure = error.message;
    if (page && !page.isClosed()) { report.visibleText = await page.locator('body').innerText(); await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); }
    throw error;
  } finally {
    fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2));
    await browser?.close(); await fixture.runtime.stop();
  }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
