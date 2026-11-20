// Real browser/UI + real authenticated local WebSocket/API + simulated home.
// Browser speech services are deterministic substitutes: no personal mic,
// external recognition service or physical device is exercised here.
const { chromium } = require('playwright');
const { createPreview } = require('./preview');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const folder = process.env.HOMEAUTO_BROWSER_VOICE_QA_DIR || path.resolve(__dirname, '../../.local/qa/browser-conversation');
  fs.mkdirSync(folder, { recursive: true });
  const fixture = await createPreview({ voice: true });
  const report = { method: 'Real UI/WebSocket/API, substituted browser speech APIs, simulated publisher only', checks: [], layouts: [], errors: [], external: [], frames: [], speech: [] };
  let browser, page;
  try {
    browser = await chromium.launch(); page = await browser.newPage({ viewport: { width: 390, height: 844 } }); page.setDefaultTimeout(10000);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('websocket', ws => { if (ws.url().endsWith('/voice')) ws.on('framesent', frame => { try { report.frames.push(JSON.parse(frame.payload)); } catch { report.frames.push({ binary: true }); } }); });
    await page.route('**/*', route => new URL(route.request().url()).origin === fixture.url ? route.continue() : (report.external.push(route.request().url()), route.abort()));
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){}}]});
      window.qa = { starts: 0, overlap: 0, played: [], hold: false, active: null, currentSpeech: null, voices: [
        { name: 'Local English', voiceURI: 'local-en', lang: 'en-IN', localService: true, default: true },
        { name: 'Other English', voiceURI: 'other-en', lang: 'en-GB', localService: false },
        { name: 'Local Hindi', voiceURI: 'local-hi', lang: 'hi-IN', localService: true, default: false },
        { name: 'Other Hindi', voiceURI: 'other-hi', lang: 'hi-IN', localService: true },
      ] };
      class Recognition {
        start() { if (window.qa.speaking) window.qa.overlap++; window.qa.starts++; window.qa.active = this; setTimeout(() => this.onstart?.(), 0); }
        stop() { setTimeout(() => { if (window.qa.active === this) window.qa.active = null; this.onend?.(); }, 0); }
        abort() { if (window.qa.active === this) window.qa.active = null; }
      }
      window.SpeechRecognition = Recognition; window.webkitSpeechRecognition = Recognition;
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      const voiceEvents = new EventTarget();
      const synth = { getVoices: () => window.qa.voices, addEventListener: (...args) => voiceEvents.addEventListener(...args), removeEventListener: (...args) => voiceEvents.removeEventListener(...args),
        cancel() { window.qa.speaking = false; window.qa.currentSpeech = null; },
        speak(value) { window.qa.currentSpeech = value; window.qa.speaking = true; window.qa.played.push({ text: value.text, language: value.lang, rate: value.rate, volume: value.volume, voice: value.voice?.voiceURI, pitch: value.pitch }); value.onstart?.(); if (!window.qa.hold) setTimeout(() => { if (window.qa.currentSpeech === value) window.qa.finishSpeech(); }, 80); } };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
      window.qa.voicesChanged = () => voiceEvents.dispatchEvent(new Event('voiceschanged'));
      window.qa.finishSpeech = () => { const value = window.qa.currentSpeech; window.qa.currentSpeech = null; window.qa.speaking = false; value?.onend?.(); };
      window.qa.result = (text, final = true, end = true) => {
        const active = window.qa.active; if (!active) throw Error('No active browser recognizer');
        const item = [{ transcript: text }]; item.isFinal = final;
        if (active.continuous) { active.results ||= []; active.results.push(item); active.onresult?.({ resultIndex: active.results.length - 1, results: active.results }); }
        else active.onresult?.({ results: [item] });
        if (end) { if (window.qa.active === active) window.qa.active = null; active.onend?.(); }
      };
    });
    const ready = async () => { await page.locator('#assistant-mic').waitFor(); await page.waitForFunction(() => document.documentElement.dataset.connected === 'true'); };
    await page.goto(fixture.url + '/assistant'); await ready();
    assert.equal(await page.locator('#assistant-mic').isEnabled(), true);
    assert.match(await page.locator('#assistant-readiness').innerText(), /Browser voice/);
    assert.equal(await page.getByText('Local setup required', { exact: true }).count(), 0);
    report.checks.push('No model setup/readiness gate; browser microphone button enabled');
    async function voice(text, expected, locale = 'en-IN') {
      const before = await page.evaluate(() => window.qa.played.length);
      await page.locator('#assistant-mic').click(); await page.waitForFunction(() => window.qa.active);
      assert.equal(await page.evaluate(() => window.qa.active.lang), locale);
      await page.evaluate(value => window.qa.result(value), text);
      await page.waitForFunction(([count, text]) => window.qa.played.length > count && window.qa.played.at(-1).text.includes(text), [before, expected]);
      await page.waitForFunction(() => !window.qa.speaking);
    }
    await voice('Turn on light two', 'on');
    assert.equal(fixture.runtime.home.device('light-2').observation.reported_status, 'on');
    await page.locator('#assistant-input-language').selectOption('hi'); await page.waitForTimeout(100);
    await voice('लाइट दो बंद करो', 'बंद', 'hi-IN');
    assert.equal(fixture.runtime.home.device('light-2').observation.reported_status, 'off');
    await page.locator('#assistant-input-language').selectOption('auto'); await page.waitForTimeout(100);
    await voice('Tell me a story', "can't help");
    await voice('मुझे कहानी सुनाओ', 'फिलहाल');
    assert.equal(await page.evaluate(() => window.qa.played.at(-1).language), 'hi-IN');
    await page.locator('#assistant-input-language').selectOption('en');
    await voice('नमस्ते', 'नमस्ते');
    assert.equal(await page.evaluate(() => window.qa.played.at(-1).language), 'hi-IN');
    assert.ok(await page.locator('[data-chat-turn]').count() >= 5);
    assert.match(await page.locator('#assistant-messages').innerText(), /Tell me a story/);
    await page.locator('#assistant-input-language').selectOption('auto');
    report.checks.push('English/Hindi simulated controls and scope replies use matching speech');
    report.checks.push('Hindi replies override English decoder hints; live chat retains distinct previous turns');
    const beforeLive = await page.evaluate(() => { window.qa.hold = true; return window.qa.starts; });
    await page.locator('#live-conversation-toggle').click(); await page.waitForFunction(n => window.qa.starts > n, beforeLive);
    await page.evaluate(() => window.qa.result('Hello'));
    await page.waitForFunction(() => window.qa.speaking); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.qa.starts), beforeLive + 1);
    await page.evaluate(() => window.qa.finishSpeech()); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.qa.starts), beforeLive + 1);
    await page.waitForFunction(n => window.qa.starts === n + 2, beforeLive);
    await page.evaluate(() => window.qa.result('नमस्ते')); await page.waitForFunction(() => window.qa.speaking);
    await page.locator('#live-conversation-toggle').click(); await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.qa.speaking), false);
    assert.equal(await page.locator('#live-conversation-toggle').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.qa.overlap), 0);
    report.checks.push('Live conversation alternates speech/listening with 350ms quiet buffer and stops cleanly');
    await page.evaluate(() => { window.qa.hold = false; });
    await page.locator('#live-conversation-toggle').click(); await page.waitForFunction(() => window.qa.active);
    await page.evaluate(() => window.qa.active.onerror({ error: 'network' }));
    await page.waitForFunction(() => document.querySelector('#live-conversation-toggle').getAttribute('aria-pressed') === 'false');
    assert.match(await page.locator('#assistant-messages').innerText(), /Browser speech recognition is unavailable/);
    await page.locator('#assistant-mic').click(); await page.waitForFunction(() => window.qa.active);
    await page.evaluate(() => window.qa.result('Hello', true, false));
    await page.locator('#assistant-mic').click(); await page.waitForFunction(() => window.qa.played.at(-1).text.startsWith('Hello'));
    report.checks.push('Network failure pauses session; Finish recording submits final text');
    // Wake mode is opt-in and never sends an ambient transcript to HomeAuto.
    await page.locator('main a[href="/settings/voice"]').click();
    const voiceKey = (uri, lang, local) => JSON.stringify([uri, lang.toLowerCase(), local]);
    await page.getByLabel('English voice', { exact: true }).selectOption(voiceKey('other-en', 'en-GB', false));
    await page.getByLabel('Hindi voice', { exact: true }).selectOption(voiceKey('other-hi', 'hi-IN', true));
    await page.getByLabel('Speech volume', { exact: true }).evaluate(input => { input.value = '.7'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.getByLabel('Speech volume', { exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByLabel('Speech volume', { exact: true }).inputValue(), '0.6');
    await page.getByLabel('Speech volume', { exact: true }).focus(); await page.keyboard.press('ArrowRight');
    const beforePreview = { commands: fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, frames: report.frames.length, starts: await page.evaluate(() => window.qa.starts) };
    for (const [name, voiceId] of [['Test English voice', 'other-en'], ['Test Hindi voice', 'other-hi']]) {
      const count = await page.evaluate(() => window.qa.played.length);
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForFunction(n => window.qa.played.length > n, count);
      assert.deepEqual(await page.evaluate(() => { const s = window.qa.played.at(-1); return { voice: s.voice, volume: s.volume, pitch: s.pitch }; }), { voice: voiceId, volume: .7, pitch: 1 });
      await page.waitForFunction(() => !window.qa.speaking);
    }
    assert.equal(await page.evaluate(() => window.qa.starts), beforePreview.starts); assert.equal(report.frames.length, beforePreview.frames);
    assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, beforePreview.commands);
    await page.evaluate(() => { window.qa.hold = true; });
    await page.getByRole('button', { name: 'Test Hindi voice', exact: true }).click();
    await page.waitForFunction(() => window.qa.speaking);
    await page.getByRole('button', { name: 'Stop speech', exact: true }).click();
    assert.equal(await page.evaluate(() => window.qa.speaking), false);
    await page.evaluate(() => { window.qa.hold = false; });
    await page.reload(); await page.getByLabel('English voice', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('English voice', { exact: true }).inputValue(), voiceKey('other-en', 'en-GB', false));
    assert.equal(await page.getByLabel('Hindi voice', { exact: true }).inputValue(), voiceKey('other-hi', 'hi-IN', true));
    assert.equal(await page.getByLabel('Speech volume', { exact: true }).inputValue(), '0.7');
    await page.evaluate(() => { window.qa.savedVoices = window.qa.voices; window.qa.voices = []; window.qa.voicesChanged(); });
    assert.equal(await page.getByRole('button', { name: 'Test Hindi voice', exact: true }).isDisabled(), true);
    assert.match(await page.locator('#browser-voice-note-hi').innerText(), /No Hindi voice/);
    await page.evaluate(() => { window.qa.voices = window.qa.savedVoices.filter(v => v.voiceURI !== 'other-hi'); window.qa.voicesChanged(); });
    assert.match(await page.locator('#browser-voice-hi option:checked').innerText(), /Saved voice unavailable/);
    await page.getByRole('button', { name: 'Test Hindi voice', exact: true }).click();
    await page.waitForFunction(() => window.qa.played.at(-1).voice === 'local-hi');
    await page.waitForFunction(() => !window.qa.speaking);
    assert.equal(await page.getByLabel('Hindi voice', { exact: true }).inputValue(), voiceKey('other-hi', 'hi-IN', true));
    await page.evaluate(() => { window.qa.voices = window.qa.savedVoices; window.qa.voicesChanged(); });
    await page.getByRole('link', { name: 'Assistant', exact: true }).first().click(); await ready();
    await voice('Hello', 'Hello'); assert.equal(await page.evaluate(() => window.qa.played.at(-1).voice), 'other-en');
    await voice('नमस्ते', 'नमस्ते'); assert.equal(await page.evaluate(() => window.qa.played.at(-1).voice), 'other-hi');
    report.checks.push('English/Hindi selections and volume persist; local previews open no mic, socket or commands; delayed/removed voices recover and actual replies use saved choices');
    await page.locator('main a[href="/settings/voice"]').click();
    await page.getByRole('checkbox', { name: /Enable wake-word listening/ }).check();
    await page.waitForFunction(() => window.qa.active?.continuous === true);
    await page.getByRole('link', { name: 'Assistant', exact: true }).first().click();
    const beforeAmbient = fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, framesBeforeAmbient = report.frames.length;
    await page.evaluate(() => window.qa.result('Turn on light two', true, false)); await page.waitForTimeout(450);
    assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, beforeAmbient); assert.equal(report.frames.length, framesBeforeAmbient);
    await page.locator('#assistant-mic').click(); await page.waitForFunction(() => window.qa.active?.continuous === false);
    await page.evaluate(() => window.qa.result('Hello')); await page.waitForFunction(() => window.qa.played.at(-1).text.startsWith('Hello'));
    await page.waitForFunction(() => window.qa.active?.continuous === true);
    assert.equal(report.frames.filter(frame => frame.type === 'start').at(-1).wake_required, false);
    report.checks.push('Wake setting persists; ambient speech sends no transcript/command; manual mic bypasses the wake word');
    await page.evaluate(() => window.qa.result('Shiman', true, false));
    await page.waitForFunction(() => window.qa.active?.continuous === false);
    await page.evaluate(() => window.qa.result('नमस्ते')); await page.waitForFunction(() => window.qa.played.at(-1).language === 'hi-IN');
    await page.locator('#live-conversation-toggle').click(); await page.waitForFunction(() => window.qa.active?.continuous === true);
    const beforeWakeCommand = fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n;
    await page.evaluate(() => window.qa.result('Shrimaan, लाइट दो बंद करो', true, false));
    await page.waitForFunction(() => window.qa.played.at(-1).text.includes('डेमो') && window.qa.played.at(-1).language === 'hi-IN');
    assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, beforeWakeCommand + 1);
    await page.locator('#live-conversation-toggle').click(); await page.waitForFunction(() => window.qa.active?.continuous === true);
    assert.equal(await page.evaluate(() => window.qa.overlap), 0);
    await page.addScriptTag({ url: fixture.url + '/__qa/axe.js' });
    const wakeAccessibility = await page.evaluate(() => window.axe.run({ include: ['.assistant-stage', '.banner-wake'] }, { runOnly: ['color-contrast', 'button-name'] }));
    assert.deepEqual(wakeAccessibility.violations.map(v => v.id), []);
    assert.equal(await page.locator('#assistant-messages').evaluate(panel => panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80), true);
    await page.screenshot({ path: path.join(folder, 'wake-chat-mobile.png'), fullPage: true });
    report.checks.push('Shiman starts conversation; combined Hindi wake/control sends exactly one simulated command; no speech/listening overlap');
    await page.evaluate(() => window.qa.active.onerror({ error: 'network' })); await page.waitForTimeout(600);
    assert.equal(await page.locator('#wake-listening-status').isHidden(), true);
    await page.reload(); await ready(); assert.equal(await page.evaluate(() => window.qa.starts), 0);
    assert.equal(await page.locator('#assistant-wake-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('main a[href="/settings/voice"]').click();
    assert.equal(await page.getByRole('checkbox', { name: /Enable wake-word listening/ }).isChecked(), true);
    await page.getByRole('checkbox', { name: /Enable wake-word listening/ }).uncheck();
    await page.getByRole('link', { name: 'Assistant', exact: true }).first().click(); await ready();
    report.checks.push('Wake network failure stops listening; reload preserves preference without opening mic; off switch stops it');
    // Physical profile keeps a fake publisher and disposable DB. Voice alone
    // cannot execute control without review, and unlock remains on Security.
    fixture.runtime.home.simulation = false; fixture.runtime.home.emitChange(); await page.goto(fixture.url + '/assistant'); await ready();
    const commandCount = fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n;
    await page.locator('#assistant-mic').click(); await page.waitForFunction(() => window.qa.active); await page.evaluate(() => window.qa.result('Turn off light two'));
    await page.locator('dialog[open]').waitFor(); assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, commandCount);
    await page.locator('dialog[open]').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.locator('dialog[open]').count(), 0);
    await voice('Unlock the door', 'Security'); assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n, commandCount);
    report.checks.push('Physical-profile control requires review; cancelled review/unlock sends no commands');
    fixture.runtime.home.simulation = true; fixture.runtime.home.emitChange();
    // Missing Hindi voice must not speak an English substitution.
    await page.evaluate(() => { window.qa.voices = [{ lang: 'en-IN', localService: true }]; });
    await page.getByLabel('Type a request', { exact: true }).fill('नमस्ते'); await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#assistant-audio-output')?.textContent.includes('No matching voice'));
    assert.match(await page.locator('#assistant-messages').innerText(), /नमस्ते/);
    report.checks.push('Missing Hindi voice leaves Hindi text visible with actionable output error');
    for (const theme of ['05', '01', '03', '04']) for (const language of ['en', 'hi']) for (const width of [320, 1280]) {
      await page.evaluate(({ theme, language }) => { localStorage.setItem('homeauto.theme.v1', theme); localStorage.setItem('homeauto.language.v1', language); }, { theme, language });
      await page.setViewportSize({ width, height: width === 320 ? 812 : 900 }); await page.goto(fixture.url + '/assistant'); await ready();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.addScriptTag({ url: fixture.url + '/__qa/axe.js' });
      const accessibility = await page.evaluate(() => window.axe.run(document.querySelector('.assistant-stage'), { runOnly: ['color-contrast', 'button-name'] }));
      assert.deepEqual(accessibility.violations.map(v => v.id), [], theme + '-' + language + '-' + width);
      const shot = `${theme}-${language}-${width}.png`; await page.screenshot({ path: path.join(folder, shot), fullPage: true }); report.layouts.push(shot);
      await page.locator('main a[href="/settings/voice"]').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const voiceAccessibility = await page.evaluate(() => window.axe.run(document.querySelector('.settings-wrap'), { runOnly: ['color-contrast', 'button-name', 'label', 'duplicate-id-aria'] }));
      assert.deepEqual(voiceAccessibility.violations.map(v => v.id), [], 'voice-settings-' + theme + '-' + language + '-' + width);
      await page.screenshot({ path: path.join(folder, 'voices-' + shot), fullPage: true });
      await page.goto(fixture.url + '/assistant'); await ready();
    }
    await page.evaluate(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; localStorage.setItem('homeauto.language.v1', 'en'); });
    // Do not reload: initScript deliberately reinstalls test speech APIs.
    await page.locator('main a[href="/settings/voice"]').click();
    await page.locator('.primary-nav a[href="/assistant"]').click();
    await ready(); assert.equal(await page.locator('#assistant-mic').isDisabled(), true);
    await page.getByLabel('अनुरोध लिखें', { exact: true }).fill('Hello'); await page.locator('form.composer button[type=submit]').click();
    await page.waitForFunction(() => document.querySelector('#assistant-messages')?.textContent.includes('Hello'));
    report.checks.push('Unsupported recognition leaves typing available');
    report.speech = await page.evaluate(() => window.qa.played); assert.equal(await page.evaluate(() => window.qa.overlap), 0);
    assert.equal(report.frames.some(frame => frame.binary), false); assert.equal(report.frames.some(frame => frame.format === 'pcm_s16le'), false);
    assert.deepEqual(report.errors, []); assert.deepEqual(report.external, []);
    console.log(JSON.stringify({ passed: report.checks.length, layouts: report.layouts.length, page_errors: 0, external_requests: 0, hardware: 'simulated only' }));
  } catch (error) {
    report.failure = error.message; if (page && !page.isClosed()) { report.visibleText = await page.locator('body').innerText(); await page.screenshot({ path: path.join(folder, 'failure.png'), fullPage: true }); } throw error;
  } finally { fs.writeFileSync(path.join(folder, 'results.json'), JSON.stringify(report, null, 2)); await browser?.close(); await fixture.runtime.stop(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
