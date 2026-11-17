const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../lifecycle');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');
const { SpeechService } = require('../voice/speech-service');

test('active local runtime has no native speech model configuration', () => {
  const config = loadConfig({});
  assert.equal(config.STT_MODEL_DIR, undefined);
  assert.equal(config.STT_PYTHON, undefined);
  assert.equal(loadConfig({ HOMEAUTO_STT_MODEL_DIR: 'custom-model' }).STT_MODEL_DIR, undefined);
});

test('Windows retirement stops the owned Python process tree, with a handle fallback', () => {
  const { stopWorker } = require('../voice/stop-worker');
  let killed = 0, call;
  const child = { pid: 12345, exitCode: null, kill() { killed++; } };
  stopWorker(child, 'win32', (...args) => { call = args; return { status: 0 }; });
  assert.match(call[0], /System32[\\/]taskkill\.exe$/);
  assert.deepEqual(call[1], ['/PID', '12345', '/T', '/F']);
  assert.equal(call[2].windowsHide, true); assert.equal(killed, 0);
  stopWorker(child, 'win32', () => ({ status: 1 })); assert.equal(killed, 1);
  stopWorker(child, 'linux', () => assert.fail('No Windows tool on Linux')); assert.equal(killed, 2);
  stopWorker({ kill() { killed++; } }, 'win32', () => assert.fail('Never pass an absent PID'));
  assert.equal(killed, 3);
  stopWorker(null);
});

test('corrupt replacement assets fail closed rather than silently falling back to Vosk', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-whisper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'config.json'), '{}');
  await assert.rejects(require('../voice/assets').verifyProfile('stt', { STT_MODEL_DIR: root }), /verification failed/);
});

test('model settings advertise Whisper and refuse retired Vosk activation', async t => {
  const repo = await createRepository();
  const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home));
  t.after(() => { speech.close(); repo.close(); });
  assert.equal(speech.assets()[0].id, 'whisper-medium-bilingual');
  assert.equal(speech.assets()[0].ready, false);
  await assert.rejects(speech.activate('vosk-bilingual'), e => e.code === 'NOT_FOUND');
  await assert.rejects(speech.activate('whisper-medium-bilingual'), e => e.code === 'VOICE_NOT_READY');
  speech.ready.stt_ready = true;
  assert.deepEqual(await speech.activate('whisper-medium-bilingual'), { active_id: 'whisper-medium-bilingual', ready: true });
});

test('natural Hindi plurals, spelling and spoken English numerals retain explicit targets', async t => {
  const repo = await createRepository(); t.after(() => repo.close());
  const home = new Home(repo);
  const { resolveCommand } = require('../voice/intent');
  for (const [text, ids] of [
    ['सभी लाइटें बंद करो।', ['light-1','light-2','light-3','light-4']],
    ['सारी लाइट्स बन्द कर दो।', ['light-1','light-2','light-3','light-4']],
    ['रूम वन की लाइट बंद करो।', ['light-1','light-2']],
    ['कमरे एक की बत्तियाँ बंद करो।', ['light-1','light-2']],
    ['कम्रा एक की लाईट बंद करो', ['light-1','light-2']],
    ['सभी लाईटे बंद करो।', ['light-1','light-2','light-3','light-4']],
  ]) {
    const result = resolveCommand(text, repo.getDevices(), home.rooms());
    assert.equal(result.ok, true, text); assert.equal(result.intent.action, 'off'); assert.deepEqual(result.intent.device_ids, ids);
  }
  for (const text of ['रूम वन की लाइट बन्द मत करो।', 'सभी लाइटें बंद करो लेकिन लाइट दो नहीं।', 'रूम वन की लाइट बंद करो कल।', 'Turn on light, too.']) {
    assert.equal(resolveCommand(text, repo.getDevices(), home.rooms()).ok, false, text);
  }
  assert.equal(resolveCommand('लाइट बन्द करो', repo.getDevices(), home.rooms()).reason, 'ambiguous');
});

test('startup reports checking and loading until a worker confirms readiness', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home));
  const assets = require('../voice/assets'); const original = assets.verifyProfile;
  const pending = {}; let calls = 0;
  assets.verifyProfile = kind => { calls++; return new Promise(resolve => { pending[kind] = resolve; }); };
  t.after(() => { assets.verifyProfile = original; speech.close(); repo.close(); });
  const starts = []; speech.startWorker = kind => starts.push(kind);
  speech.start(); speech.start(); assert.equal(calls, 2);
  assert.equal(speech.readiness().stt_state, 'checking');
  assert.equal(speech.readiness().stt_ready, false);
  assert.throws(() => speech.ticket({ token_hash: 'synthetic' }), e => e.code === 'VOICE_NOT_READY');
  for (const resolve of Object.values(pending)) resolve({ sha256: 'synthetic-test', bytes: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(starts, ['stt', 'tts']);
  assert.equal(speech.assets()[0].state, 'loading');
  assert.equal(speech.readiness().stt_ready, false);
  speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] });
  assert.equal(speech.readiness().stt_state, 'ready');
  assert.equal(speech.readiness().stt_ready, true);
  assert.equal(speech.readiness().tts_ready, false);
  speech.close(); speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] });
  assert.equal(speech.readiness().stt_state, 'stopped');
  assert.equal(speech.readiness().stt_ready, false);
});

test('missing assets and failed verification have distinct startup states', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home));
  const assets = require('../voice/assets'); const original = assets.verifyProfile;
  assets.verifyProfile = async kind => { throw kind === 'stt' ? Object.assign(new Error('missing'), { code: 'ENOENT' }) : new Error('checksum mismatch'); };
  t.after(() => { assets.verifyProfile = original; speech.close(); repo.close(); });
  speech.startWorker = () => assert.fail('Unverified models must not start'); speech.start();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(speech.readiness().stt_state, 'not_configured');
  assert.equal(speech.readiness().tts_state, 'failed');
  assert.equal(speech.readiness().stt_ready, false);
});

test('disabled and crashed workers never retain ready capabilities', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home), { VOICE_ENABLED: false });
  t.after(() => { speech.close(); repo.close(); });
  speech.start(); assert.equal(speech.readiness().stt_state, 'disabled');
  speech.handle('tts', { type: 'ready', languages: ['en', 'hi'], voices: { en: 'fixture', hi: 'fixture' } });
  speech.unavailable('tts');
  assert.equal(speech.readiness().tts_state, 'failed');
  assert.deepEqual(speech.readiness().reply_languages, []);
  assert.deepEqual(speech.readiness().voices, []);
});

test('UI distinguishes loading, missing setup and failure, including legacy readiness', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/js/speech-status.js'), 'utf8');
  const { speechStatus } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(speechStatus({ stt_ready: false, stt_state: 'checking' }).label, 'Checking voice models…');
  assert.equal(speechStatus({ stt_ready: false, stt_state: 'loading' }).label, 'Loading voice models…');
  assert.equal(speechStatus({ stt_ready: false, stt_state: 'failed' }).label, 'Voice could not start');
  assert.equal(speechStatus({ stt_ready: false, stt_state: 'not_configured' }).label, 'Local setup required');
  assert.equal(speechStatus({ stt_ready: true }).label, 'Ready locally');
  assert.equal(speechStatus({ stt_ready: false }).label, 'Local setup required');
});

test('explicit retry re-verifies a failed model once and waits for worker readiness', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home), { VOICE_ENABLED: true });
  const assets = require('../voice/assets'); const original = assets.verifyProfile;
  let resolve, starts = 0; assets.verifyProfile = () => new Promise(yes => { resolve = yes; });
  t.after(() => { assets.verifyProfile = original; speech.close(); repo.close(); });
  speech.states.stt = 'failed'; speech.startWorker = () => { starts++; };
  const pending = speech.activate('whisper-medium-bilingual');
  assert.equal(speech.readiness().stt_state, 'checking');
  await assert.rejects(speech.activate('whisper-medium-bilingual'), e => e.code === 'SPEECH_BUSY');
  resolve({ bytes: 1, sha256: 'synthetic-verified-retry' });
  assert.deepEqual(await pending, { active_id: 'whisper-medium-bilingual', ready: false, state: 'loading' });
  assert.equal(starts, 1); assert.equal(speech.readiness().stt_ready, false);
  speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] });
  assert.equal(speech.readiness().stt_ready, true);
  assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
});

test('retry never starts missing or disabled models', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home), { VOICE_ENABLED: true });
  const assets = require('../voice/assets'); const original = assets.verifyProfile;
  assets.verifyProfile = async () => { throw Object.assign(new Error('missing'), { code: 'ENOENT' }); };
  t.after(() => { assets.verifyProfile = original; speech.close(); repo.close(); });
  speech.startWorker = () => assert.fail('Missing models must not start');
  await assert.rejects(speech.activate('whisper-medium-bilingual'), e => e.code === 'VOICE_NOT_READY');
  assert.equal(speech.readiness().stt_state, 'not_configured');
  speech.config.VOICE_ENABLED = false;
  await assert.rejects(speech.activate('whisper-medium-bilingual'), e => e.code === 'VOICE_NOT_READY');
});

test('retired worker messages cannot mark a replacement ready', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home));
  t.after(() => { speech.close(); repo.close(); });
  const retired = { kill() {} }, current = { kill() {} };
  speech.stt = current; speech.states.stt = 'loading';
  speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] }, retired);
  assert.equal(speech.readiness().stt_ready, false);
  speech.handle('stt', { type: 'ready', languages: ['en', 'hi'] }, current);
  assert.equal(speech.readiness().stt_ready, true);
});

test('a token-limited recognition prefix never reaches command interpretation', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home));
  t.after(() => { speech.close(); repo.close(); });
  speech.run = async () => ({ limit_reached: true, candidates: [{ text: 'Turn on light one.', lang: 'en' }] });
  await assert.rejects(speech.transcribe(Buffer.alloc(6400), 'auto'), e => e.code === 'VOICE_REQUEST_TOO_LONG');
  assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
});

test('recognition diagnostics retain only coarse timings, not audio or transcripts', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home)); let request;
  speech.stt = { stdin: { write: data => { request = JSON.parse(data); } }, kill() {} }; speech.ready.stt_ready = true;
  t.after(() => { speech.close(); repo.close(); });
  const phases = [];
  const pending = speech.run('stt', { pcm: Buffer.alloc(6400).toString('base64'), language: 'auto' }, phase => { phases.push(phase); throw Error('Observer disconnected'); });
  assert.equal(speech.recognitionMetrics().audio_ms, 200);
  speech.handle('stt', { id: request.id, type: 'progress', stage: 'encoding' });
  assert.equal(speech.recognitionMetrics().phase, 'encoding');
  assert.deepEqual(phases, ['encoding']);
  assert.equal(speech.pending.size, 1);
  assert.equal(speech.busy, true);
  assert.equal(speech.recognitionMetrics().state, 'processing');
  speech.handle('stt', { id: request.id, type: 'progress', stage: 'private fixture phrase' });
  assert.equal(speech.recognitionMetrics().phase, 'encoding');
  assert.deepEqual(phases, ['encoding']);
  speech.handle('stt', { id: request.id, candidates: [{ text: 'private fixture phrase' }], encoder_passes: 1, encoder_reuses: 1 });
  await pending;
  const metrics = speech.recognitionMetrics();
  assert.deepEqual(Object.keys(metrics).sort(), ['audio_ms','encoder_passes','encoder_reuses','phase','processing_ms','state']);
  assert.equal(metrics.state, 'completed'); assert.equal(metrics.encoder_passes, 1);
  metrics.state = 'tampered'; assert.equal(speech.recognitionMetrics().state, 'completed');
});

test('a synchronous worker write failure releases the job and reports failure', async t => {
  const repo = await createRepository(); const home = new Home(repo);
  const speech = new SpeechService(home, new Assistant(home));
  speech.stt = { stdin: { write() { throw Error('closed'); } }, kill() {} }; speech.ready.stt_ready = true;
  t.after(() => { speech.close(); repo.close(); });
  await assert.rejects(speech.run('stt', { pcm: Buffer.alloc(6400).toString('base64') }), /STT_UNAVAILABLE/);
  assert.equal(speech.busy, false); assert.equal(speech.pending.size, 0);
  assert.equal(speech.recognitionMetrics().error_code, 'SPEECH_TRANSPORT_ERROR');
});

test('the deadline retires its owner but a completed old deadline cannot kill a replacement', async t => {
  const vm = require('node:vm'); const { createRequire } = require('node:module');
  const filename = path.resolve(__dirname, '../voice/speech-service.js');
  const source = fs.readFileSync(filename, 'utf8');
  const repo = await createRepository(); const home = new Home(repo); t.after(() => repo.close());
  async function check(completed) {
    let timer, request, killed = 0, now = 0;
    const scope = { require: createRequire(filename), module: { exports: {} }, __dirname: path.dirname(filename), Buffer, performance: { now: () => now }, setTimeout: fn => { timer = fn; return 1; }, clearTimeout() {} };
    vm.runInNewContext(source + ';this.Service=SpeechService;', scope);
    const speech = new scope.Service(home, new Assistant(home));
    speech.stt = { stdin: { write: raw => { request = JSON.parse(raw); } }, kill() { killed++; } }; speech.ready.stt_ready = true;
    const job = speech.run('stt', { pcm: Buffer.alloc(6400).toString('base64') });
    if (completed) {
      speech.handle('stt', { id: request.id, candidates: [] }); await job;
      speech.stt = { kill() { killed++; } }; speech.ready.stt_ready = true;
      timer(); assert.equal(killed, 0); assert.equal(speech.ready.stt_ready, true);
    } else {
      now = 60000; timer(); await assert.rejects(job, /SPEECH_TIMEOUT/);
      assert.equal(killed, 1); assert.equal(speech.ready.stt_ready, false);
      assert.equal(speech.recognitionMetrics().state, 'timeout');
      assert.equal(speech.recognitionMetrics().processing_ms, 60000);
    }
  }
  await check(false); await check(true);
});
