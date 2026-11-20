const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createPreview } = require('./preview');

async function main() {
  const fixture = await createPreview({ voice: true });
  let browser;
  const errors = [], commands = [];
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/command$|\/assistant\/(interpret|execute)$/.test(new URL(request.url()).pathname)) commands.push(request.url()); });
    await page.addInitScript(() => {
      window.__micMode = 'sound'; window.__released = 0;
      navigator.mediaDevices.getUserMedia = async () => {
        if (window.__micMode === 'denied') throw new DOMException('Denied', 'NotAllowedError');
        const track = { label: 'Realtek test input', stop() { window.__released++; } };
        return { getTracks: () => [track], getAudioTracks: () => [track] };
      };
      window.AudioContext = class {
        constructor() { this.state = 'running'; }
        async resume() {}
        async close() {}
        createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
        createAnalyser() { return { fftSize: 2048, getFloatTimeDomainData: values => values.fill(window.__micMode === 'sound' ? .04 : 0) }; }
      };
      window.SpeechRecognition = class {
        start() { queueMicrotask(() => this.onerror?.({ error: 'service-not-allowed' })); }
        abort() {}
      };
    });
    await page.goto(fixture.url + '/assistant');
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await page.getByRole('button', { name: 'Start microphone test', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Active microphone: Realtek test input', { exact: true }).waitFor();
    await dialog.getByText('Sound detected.', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => window.__released), 1);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => { window.__micMode = 'silence'; });
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await dialog.getByRole('button', { name: 'Start microphone test', exact: true }).click();
    await dialog.getByText('No sound detected.', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => { window.__micMode = 'denied'; });
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await dialog.getByRole('button', { name: 'Start microphone test', exact: true }).click();
    await dialog.getByText('Microphone access is blocked.', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => { window.__micMode = 'sound'; });
    await page.locator('#assistant-mic').click();
    await page.getByText('The browser refused its speech recognition service.', { exact: false }).first().waitFor();
    await page.goto(fixture.url + '/settings/voice');
    await page.getByRole('button', { name: 'Test microphone', exact: true }).waitFor();
    assert.deepEqual(errors, []); assert.deepEqual(commands, []);
    console.log(JSON.stringify({ checks: ['Physical input label and sound level', 'Silence and microphone permission denial', 'Speech-service refusal differs from microphone denial', 'No diagnostic audio or device commands sent'], errors, commands }));
  } finally { await browser?.close(); await fixture.runtime.stop(); }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
