const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocket } = require('ws');
const { createPreview } = require('../scripts/preview');
const { BrowserSpeechService } = require('../voice/browser-speech-service');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');

const source = file => fs.readFileSync(path.join(__dirname, '../../public/js/', file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/\bexport /g, '');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function clientFixture() {
  const states = [], transcripts = [], intents = [], errors = [], messages = [], recognizers = [], sockets = [];
  class Recognition {
    constructor() { recognizers.push(this); }
    start() { this.onstart?.(); }
    stop() { queueMicrotask(() => this.onend?.()); }
    abort() { this.aborted = true; }
    result(text, final) { const item = [{ transcript: text }]; item.isFinal = final; this.onresult?.({ results: [item] }); }
  }
  class Socket {
    constructor() { sockets.push(this); this.readyState = 0; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
    send(data) { const msg = JSON.parse(data); messages.push(msg); if (msg.type === 'start') queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ type: 'voice_ready', utterance_id: msg.utterance_id }) })); }
    close() { this.readyState = 3; this.onclose?.(); }
    intent() { this.onmessage?.({ data: JSON.stringify({ type: 'intent', utterance_id: messages[0].utterance_id, intent: { kind: 'query' } }) }); }
  }
  const scope = { Api: { request: async () => ({ ticket: 'fixture' }) }, SpeechRecognition: Recognition, isSecureContext: true,
    WebSocket: Socket, location: { protocol: 'http:', host: 'localhost' }, crypto, setTimeout, clearTimeout, console,
    HomeAutoLanguage: require('../../public/js/assistant-language') };
  vm.runInNewContext(source('browser-voice.js') + ';this.Capture=BrowserVoiceCapture;', scope);
  const capture = new scope.Capture({ onState: s => states.push(s), onTranscript: (text, language) => transcripts.push({ text, language }), onIntent: i => intents.push(i), onError: e => errors.push(e), getLanguage: () => 'hi' });
  return { capture, scope, states, transcripts, intents, errors, messages, recognizers, sockets };
}

test('browser capture sends only final text over the ticketed socket and waits for recognition end', async t => {
  const f = clientFixture(); t.after(() => f.capture.cancel());
  await f.capture.start('auto'); assert.equal(f.capture.state, 'listening');
  const r = f.recognizers[0]; assert.equal(r.lang, 'hi-IN'); assert.equal(r.continuous, false);
  r.result('लाइट दो', false); assert.equal(f.messages.length, 1); assert.equal(f.transcripts.at(-1).language, 'hi');
  r.result('लाइट दो चालू करो', true); assert.equal(f.messages.length, 1);
  r.onend(); assert.equal(f.messages.at(-1).type, 'transcript'); assert.equal(f.messages.at(-1).text, 'लाइट दो चालू करो');
  assert.equal(f.capture.state, 'processing'); f.sockets[0].intent(); assert.equal(f.intents.length, 1); assert.equal(f.capture.state, 'ready');
  assert.deepEqual(f.errors, []);
});

test('cloud microphone sends final transcripts through HTTP without creating a WebSocket', async t => {
  const f=clientFixture();t.after(()=>f.capture.cancel());
  f.scope.queueMicrotask=queueMicrotask;f.scope.AbortController=AbortController;
  f.scope.Api.mode='cloud';
  const requests=[];f.scope.Api.request=async(path,options)=>{requests.push({path,options});return path.endsWith('voice-tickets')?{transport:'http',provider:'browser'}:{intent_id:crypto.randomUUID(),intent:{kind:'query',device_ids:['light-1']}};};
  await f.capture.start('hi');assert.equal(f.capture.state,'listening');assert.equal(f.sockets.length,0);
  const r=f.recognizers[0];r.result('लाइट एक की स्थिति',true);assert.equal(requests.length,0);r.onend();await flush();
  assert.equal(requests[0].path,'/api/assistant/interpret');assert.equal(requests[0].options.body.text,'लाइट एक की स्थिति');assert.equal(f.intents.length,1);assert.equal(f.capture.state,'ready');
});

test('microphone permission is requested before transport and canceled permission cannot start recognition', async t=>{
  const f=clientFixture();t.after(()=>f.capture.cancel());const order=[];
  f.scope.navigator={mediaDevices:{getUserMedia:async()=>{order.push('permission');return {getTracks:()=>[{stop:()=>order.push('released')}]};}}};
  f.scope.Api.request=async()=>{order.push('transport');return {ticket:'fixture'};};
  await f.capture.start();assert.deepEqual(order,['permission','released','transport']);
  f.capture.cancel();let allow;f.scope.navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>allow=resolve);
  const pending=f.capture.start();f.capture.cancel();allow({getTracks:()=>[{stop:()=>order.push('canceled-stream-released')}]});await pending;
  assert.equal(order.at(-1),'canceled-stream-released');assert.equal(f.recognizers.length,1);
});
test('interim-only speech never becomes a command; microphone and network failures have specific errors', async t => {
  for (const [input, expected] of [['interim', 'MICROPHONE_NO_SPEECH'], ['not-allowed', 'MICROPHONE_DENIED'], ['service-not-allowed', 'BROWSER_RECOGNITION_SERVICE_DENIED'], ['network', 'BROWSER_RECOGNITION_NETWORK']]) {
    const f = clientFixture(); t.after(() => f.capture.cancel()); await f.capture.start('en');
    assert.equal(f.recognizers[0].lang, 'en-IN');
    if (input === 'interim') { f.recognizers[0].result('turn on', false); f.recognizers[0].onend(); }
    else f.recognizers[0].onerror({ error: input });
    assert.equal(f.errors[0].code, expected); assert.equal(f.messages.filter(m => m.type === 'transcript').length, 0);
  }
});
test('recognition refusal after successful capture is distinct from blocked microphone access', async t => {
  const f = clientFixture(); t.after(() => f.capture.cancel());
  let stopped = false;
  f.scope.navigator = { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped = true; } }] }) } };
  await f.capture.start('en'); f.recognizers[0].onerror({ error: 'not-allowed' });
  assert.equal(stopped, true); assert.equal(f.errors.at(-1).code, 'BROWSER_RECOGNITION_BLOCKED');
  assert.equal(f.messages.filter(m => m.type === 'transcript').length, 0);
});

function microphoneFixture({ level = .03, denied = false } = {}) {
  const timers = new Map(), intervals = new Set(), states = [], results = [], errors = [], devices = [];
  let stopped = 0, closed = 0, disconnected = 0, next = 0;
  const track = { label: 'Physical test microphone', stop: () => stopped++ };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const scope = {
    isSecureContext: true, Float32Array, Math, t: value => value,
    navigator: { mediaDevices: { getUserMedia: async () => { if (denied) throw Object.assign(new Error(), { name: 'NotAllowedError', code: 0 }); return stream; } } },
    AudioContext: class {
      constructor() { this.state = 'running'; }
      async resume() {}
      async close() { closed++; }
      createAnalyser() { return { fftSize: 0, getFloatTimeDomainData: values => values.fill(level) }; }
      createMediaStreamSource() { return { connect() {}, disconnect: () => disconnected++ }; }
    },
    setTimeout: (fn, ms) => { const id = ++next; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: fn => { intervals.add(fn); return fn; }, clearInterval: fn => intervals.delete(fn),
  };
  vm.runInNewContext(source('microphone-check.js') + ';this.Check=MicrophoneCheck;', scope);
  const check = new scope.Check({ onState: value => states.push(value), onResult: value => results.push(value), onDevice: value => devices.push(value), onError: value => errors.push(value) });
  return { check, scope, stream, states, results, errors, devices, timers, intervals, counts: () => ({ stopped, closed, disconnected }) };
}

test('microphone test distinguishes sound from silence, shows active input, and releases every resource', async () => {
  for (const [level, expected] of [[.03, true], [0, false]]) {
    const f = microphoneFixture({ level }); await f.check.start();
    assert.equal(f.states.at(-1), 'listening'); assert.equal(f.devices[0], 'Physical test microphone');
    for (const tick of f.intervals) tick();
    [...f.timers.values()].find(timer => timer.ms === 6000).fn();
    assert.equal(f.results[0], expected); assert.deepEqual(f.counts(), { stopped: 1, closed: 1, disconnected: 1 });
    assert.equal(f.timers.size, 0); assert.equal(f.intervals.size, 0);
  }
});

test('microphone test denial and a late permission grant after close never leak input or start sampling', async () => {
  const denied = microphoneFixture({ denied: true }); await denied.check.start();
  assert.equal(denied.errors[0].code, 'MICROPHONE_DENIED'); assert.equal(denied.counts().closed, 1);
  const f = microphoneFixture(); let allow;
  f.scope.navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { allow = resolve; });
  const pending = f.check.start(); f.check.stop(); allow(f.stream); await pending;
  assert.equal(f.counts().stopped, 1); assert.equal(f.intervals.size, 0); assert.equal(f.results.length, 0);
});

test('network recognition failure retries with an installed on-device Web Speech pack', async t => {
  const f = clientFixture(); t.after(() => f.capture.cancel());
  f.scope.SpeechRecognition.prototype.processLocally = false;
  f.scope.SpeechRecognition.available = async () => 'available';
  await f.capture.start('en');
  const remote = f.recognizers[0];
  await remote.onerror({ error: 'network' }); await flush();
  assert.equal(f.recognizers.length, 2);
  assert.equal(f.recognizers[1].processLocally, true);
  assert.equal(f.recognizers[1].lang, 'en-IN');
  assert.equal(f.errors.length, 0);
  remote.onend?.();
  f.recognizers[1].result('turn on light one', true);
  f.recognizers[1].onend();
  assert.equal(f.messages.at(-1).type, 'transcript');
  assert.equal(f.messages.at(-1).text, 'turn on light one');
});
test('cancel, replacement turns and lost sockets retire stale recognizer callbacks', async t => {
  const f = clientFixture(); t.after(() => f.capture.cancel()); await f.capture.start();
  const stale = f.recognizers[0].onresult; f.capture.cancel();
  const result = [{ transcript: 'turn on light one' }]; result.isFinal = true; stale({ results: [result] });
  assert.equal(f.transcripts.length, 0); assert.equal(f.recognizers[0].aborted, true);
  await f.capture.start(); f.sockets[1].onclose(); assert.equal(f.errors.at(-1).code, 'VOICE_CONNECTION_LOST');
  assert.equal(f.capture.state, 'ready');
});
test('manual finish stops recognition; unsupported browsers fail before requesting a ticket', async t => {
  const f = clientFixture(); t.after(() => f.capture.cancel()); await f.capture.start();
  f.recognizers[0].result('Hello', true); f.capture.end(); await flush();
  assert.equal(f.messages.filter(m => m.type === 'transcript').length, 1);
  f.capture.cancel(); delete f.scope.SpeechRecognition; await f.capture.start();
  assert.equal(f.errors.at(-1).code, 'BROWSER_RECOGNITION_UNAVAILABLE'); assert.equal(f.sockets.length, 1);
});

test('browser output selects matching Hindi/Indian English voices and never falls back to English for Hindi', async t => {
  const spoken = [], states = []; let cancelled = 0;
  const voices = [{ lang: 'en-US', localService: false }, { lang: 'en-IN', localService: true }, { lang: 'hi-IN', localService: true }];
  const synth = { getVoices: () => voices, cancel: () => cancelled++, speak: u => { spoken.push(u); u.onstart(); } };
  const scope = { speechSynthesis: synth, SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } }, setTimeout, clearTimeout };
  vm.runInNewContext(source('browser-voice.js') + ';this.Output=BrowserSpeechOutput;', scope);
  const output = new scope.Output(); t.after(() => output.stop());
  await output.speak({ text: 'नमस्ते', language: 'hi', rate: .9 }, state => states.push(state));
  assert.equal(spoken[0].voice.lang, 'hi-IN'); assert.equal(spoken[0].rate, .9); spoken[0].onend(); assert.equal(states.at(-1), 'finished');
  await output.speak({ text: 'Hello', language: 'en' }); assert.equal(spoken.at(-1).voice.lang, 'en-IN'); output.stop(); assert.ok(cancelled >= 3);
  voices.pop(); await assert.rejects(output.speak({ text: 'नमस्ते', language: 'hi' }), e => e.code === 'BROWSER_VOICE_MISSING');
});
test('output waits for delayed voices and cancellation prevents late speech', async () => {
  const listeners = new Set(); let voices = [], calls = 0;
  const scope = { speechSynthesis: { getVoices: () => voices, cancel() {}, speak: () => calls++, addEventListener: (_, f) => listeners.add(f), removeEventListener: (_, f) => listeners.delete(f) }, SpeechSynthesisUtterance: class {}, setTimeout, clearTimeout };
  vm.runInNewContext(source('browser-voice.js') + ';this.Output=BrowserSpeechOutput;', scope);
  const output = new scope.Output(), pending = output.speak({ text: 'Hello', language: 'en' });
  output.stop(); voices = [{ lang: 'en-IN' }]; for (const listener of listeners) listener(); await pending;
  assert.equal(calls, 0); assert.equal(listeners.size, 0);
});
test('saved browser voice overrides automatic ranking only within its reply language; volume and pitch are explicit', async t => {
  const voices = [
    { name: 'Local English', voiceURI: 'local-en', lang: 'en-IN', localService: true },
    { name: 'Other English', voiceURI: 'other-en', lang: 'en-GB', localService: false },
    { name: 'Hindi', voiceURI: 'local-hi', lang: 'hi_IN', localService: true },
  ];
  const spoken = [], scope = { speechSynthesis: { getVoices: () => voices, cancel() {}, speak: u => spoken.push(u) }, SpeechSynthesisUtterance: class {}, setTimeout, clearTimeout };
  vm.runInNewContext(source('browser-voice.js') + ';this.Output=BrowserSpeechOutput;this.key=browserVoiceKey;', scope);
  const output = new scope.Output(); t.after(() => output.stop());
  await output.speak({ text: 'Hello', language: 'en', voiceKey: scope.key(voices[1]), volume: .7 });
  assert.equal(spoken.at(-1).voice.voiceURI, 'other-en'); assert.equal(spoken.at(-1).volume, .7); assert.equal(spoken.at(-1).pitch, 1);
  await output.speak({ text: 'Hello', language: 'en', voiceKey: scope.key(voices[2]), volume: 12 });
  assert.equal(spoken.at(-1).voice.voiceURI, 'local-en'); assert.equal(spoken.at(-1).volume, 1);
  await output.speak({ text: 'नमस्ते', language: 'hi', voiceKey: 'removed-voice', volume: NaN, rate: NaN });
  assert.equal(spoken.at(-1).voice.voiceURI, 'local-hi'); assert.equal(spoken.at(-1).volume, 1); assert.equal(spoken.at(-1).rate, 1);
});

test('automatic speech prefers named natural female voices and preserves explicit selection', () => {
  const voices = [
    { name: 'Local English', voiceURI: 'local', lang: 'en-IN', localService: true },
    { name: 'Microsoft Aria Online (Natural)', voiceURI: 'aria', lang: 'en-US', localService: false },
    { name: 'Microsoft Neerja Online (Natural)', voiceURI: 'neerja', lang: 'hi-IN', localService: false },
    { name: 'Hindi default', voiceURI: 'hindi', lang: 'hi-IN', localService: true },
  ];
  const scope = {};
  vm.runInNewContext(source('browser-voice.js') + ';this.select=selectBrowserVoice;this.key=browserVoiceKey;', scope);
  assert.equal(scope.select('en', '', voices).voiceURI, 'aria');
  assert.equal(scope.select('hi', '', voices).voiceURI, 'neerja');
  assert.equal(scope.select('en', scope.key(voices[0]), voices).voiceURI, 'local');
  assert.equal(scope.select('hi', scope.key(voices[1]), voices).voiceURI, 'neerja');
});

test('Hindi voice can arrive after an English-only initial list without early failure or listener leaks', async t => {
  const listeners = new Set(), spoken = []; const voices = [{ lang: 'en-IN' }];
  const scope = { speechSynthesis: { getVoices: () => voices, cancel() {}, speak: u => spoken.push(u), addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) }, SpeechSynthesisUtterance: class {}, setTimeout, clearTimeout };
  vm.runInNewContext(source('browser-voice.js') + ';this.Output=BrowserSpeechOutput;', scope);
  const output = new scope.Output(); t.after(() => output.stop());
  const waiting = output.speak({ text: 'नमस्ते', language: 'hi' });
  for (const fn of listeners) fn(); await flush(); assert.equal(spoken.length, 0);
  voices.push({ lang: 'hi-IN' }); for (const fn of [...listeners]) fn(); await waiting;
  assert.equal(spoken.length, 1); assert.equal(spoken[0].voice.lang, 'hi-IN'); assert.equal(listeners.size, 0);
});

test('browser voice preferences persist safely, reject invalid values and tolerate unavailable storage', () => {
  const stored = new Map(), scope = { localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    document: { documentElement: { dataset: {} }, querySelector() {} }, getComputedStyle: () => ({ getPropertyValue: () => '#fff' }),
    window: { addEventListener() {}, dispatchEvent() {} }, CustomEvent: class {} };
  vm.runInNewContext(source('preferences.js') + ';this.read=readPreferences;this.apply=applyPreferences;', scope);
  assert.equal(scope.read().voiceVolume, 1);
  scope.apply({ englishVoice: 'saved-en', hindiVoice: 'saved-hi', voiceVolume: .6 });
  assert.equal(scope.read().englishVoice, 'saved-en'); assert.equal(scope.read().hindiVoice, 'saved-hi'); assert.equal(scope.read().voiceVolume, .6);
  stored.set('homeauto.voiceVolume.v1', 'invalid'); stored.set('homeauto.englishVoice.v1', 'x'.repeat(1025));
  assert.equal(scope.read().voiceVolume, 1); assert.equal(scope.read().englishVoice, '');
  scope.apply({ voiceVolume: 50, hindiVoice: { invalid: true } }); assert.equal(scope.read().voiceVolume, 1); assert.equal(scope.read().hindiVoice, '');
  scope.localStorage.getItem = () => { throw Error('Storage blocked'); };
  assert.equal(scope.read().persistent, false); assert.equal(scope.read().voiceVolume, 1);
});

test('live loop reopens only after synthesis onend plus 350ms; failure, stop and goodbye prevent reopening', () => {
  let now = 0, next = 0, listens = 0, expired = 0; const timers = new Map();
  const scope = { setTimeout: (fn, ms) => { timers.set(++next, { fn, at: now + ms }); return next; }, clearTimeout: id => timers.delete(id) };
  const tick = ms => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } };
  vm.runInNewContext(source('live-conversation.js') + ';this.Live=LiveConversation;', scope);
  const live = new scope.Live({ listen: () => listens++, expired: () => expired++ });
  live.start(); assert.equal(listens, 1); live.capture('processing'); live.output('speaking'); tick(6000); assert.equal(listens, 1);
  live.output('finished'); tick(349); assert.equal(listens, 1); tick(1); assert.equal(listens, 2);
  live.output('failed'); tick(1000); assert.equal(listens, 2); assert.equal(live.active, false);
  live.start(); live.output('finished'); live.stop(); tick(350); assert.equal(listens, 3);
  live.start(); live.ending = true; live.output('finished'); tick(350); assert.equal(listens, 4); assert.equal(live.active, false);
  live.start(); live.output('speaking'); tick(65000); assert.equal(expired, 1); assert.equal(live.active, false);
});
test('hiding the page ends an active conversation while preserving an ordinary processing turn', () => {
  const handler = fs.readFileSync(path.join(__dirname, '../../public/js/main.js'), 'utf8').split('\n').find(line => line.startsWith("document.addEventListener('visibilitychange'"));
  for (const active of [false, true]) {
    let hide, ended = 0, cancelled = 0;
    const ctx = { live: { active }, voice: { state: 'processing', cancel: () => cancelled++ }, stopAudio() {}, endLive: () => ended++ };
    vm.runInNewContext(handler, { document: { hidden: true, addEventListener: (_, fn) => { hide = fn; } }, ctx });
    hide(); assert.equal(ended, Number(active)); assert.equal(cancelled, 0);
  }
});

test('browser speech service uses bounded one-use session tickets and returns text without audio jobs/models', async t => {
  const repo = await createRepository(); t.after(() => repo.close()); const home = new Home(repo), actor = { user_id: 'fixture', token_hash: 'session' };
  const service = new BrowserSpeechService(home, new Assistant(home));
  service.start(); assert.equal(service.readiness().provider, 'browser'); assert.deepEqual(service.assets(), []);
  const ticket = service.ticket(actor); service.consume(ticket.ticket, actor);
  assert.throws(() => service.consume(ticket.ticket, actor), e => e.code === 'INVALID_VOICE_TICKET');
  const value = await service.synthesize('नमस्ते', 'hi', actor); assert.equal(value.text, 'नमस्ते'); assert.equal(value.provider, 'browser'); assert.equal(value.job_id, undefined);
  service.close(); assert.throws(() => service.ticket(actor), e => e.code === 'VOICE_NOT_READY');
});

test('real browser-text WebSocket validates final home requests without executing before protected confirmation', async t => {
  const f = await createPreview({ voice: true }); t.after(() => f.runtime.stop()); const { home, repo, sessions } = f.runtime;
  const actor = sessions.readRequest().session;
  const api = async (route, body) => {
    const response = await fetch(f.url + route, { method: 'POST', headers: { Origin: f.url, 'Content-Type': 'application/json', 'X-CSRF-Token': actor.csrf_token }, body: JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  };
  async function socket(options = {}) {
    const { ticket } = (await api('/api/assistant/voice-tickets', {})).value, rows = [];
    const ws = new WebSocket(f.url.replace('http:', 'ws:') + '/voice', { origin: f.url }); t.after(() => ws.terminate());
    ws.on('message', raw => rows.push(JSON.parse(raw)));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const id = crypto.randomUUID(); ws.send(JSON.stringify({ type: 'start', schema_version: 1, ticket, utterance_id: id, format: 'browser_text', language: 'auto', wake_required: !!options.wake }));
    const wait = async type => { const until = Date.now() + 2500; while (!rows.some(row => row.type === type)) { if (Date.now() > until) throw Error('Missing ' + type + ': ' + JSON.stringify(rows)); await new Promise(r => setTimeout(r, 5)); } return rows.find(row => row.type === type); };
    await wait('voice_ready');
    return { ws, rows, id, wait, close: async () => { ws.close(); if (ws.readyState !== 3) await new Promise(resolve => ws.once('close', resolve)); } };
  }
  assert.equal(f.runtime.speech instanceof BrowserSpeechService, true);
  for (const text of ['Hello', 'नमस्ते', 'Turn on light two']) {
    const s = await socket(); s.ws.send(JSON.stringify({ type: 'transcript', utterance_id: s.id, text }));
    const intent = await s.wait('intent'); assert.equal(repo.one('SELECT COUNT(*) n FROM commands').n, 0);
    if (text === 'नमस्ते') assert.equal(intent.intent.reply_language, 'hi');
    if (text === 'Turn on light two') {
      assert.equal(intent.intent.kind, 'control');
      const response = await api('/api/assistant/execute', { intent_id: intent.intent_id, idempotency_key: crypto.randomUUID() });
      assert.equal(response.status, 202); assert.equal(response.value.commands.length, 1);
    }
    await s.close();
  }
  for (const [text, code] of [['Do not turn off light two', 'INTENT_NEGATED'], ['Unlock the door', null]]) {
    const s = await socket(); s.ws.send(JSON.stringify({ type: 'transcript', utterance_id: s.id, text }));
    if (code) assert.equal((await s.wait('voice_error')).code, code);
    else { const intent = await s.wait('intent'); assert.equal(intent.intent.sensitive, true); assert.equal((await api('/api/assistant/execute', { intent_id: intent.intent_id, idempotency_key: crypto.randomUUID() })).status, 403); }
    await s.close();
  }
  const wake = await socket({ wake: true }); wake.ws.send(JSON.stringify({ type: 'transcript', utterance_id: wake.id, text: 'Hello' })); assert.equal((await wake.wait('voice_error')).code, 'WAKE_PHRASE_REQUIRED'); await wake.close();
  const binary = await socket(); binary.ws.send(Buffer.alloc(320)); assert.equal((await binary.wait('voice_error')).code, 'INVALID_AUDIO'); await binary.close();
  const malformed = await socket(); malformed.ws.send(JSON.stringify({ type: 'transcript', utterance_id: malformed.id, text: 'Hello', action: 'unlock' })); assert.equal((await malformed.wait('voice_error')).code, 'INVALID_TRANSCRIPT'); await malformed.close();
  assert.equal(home.simulation, true);
});
