const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const policy = require('../../public/js/assistant-language');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');
const js = file => fs.readFileSync(path.join(__dirname, '../../public/js', file), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/\bexport /g, '');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('automatic replies use actual Hindi/English words rather than decoder locale', () => {
  for (const text of ['लाइट दो चालू करो', 'नमस्ते', 'Light 2 बंद करो', 'light band karo', 'namaste', 'darwaza lock karo']) assert.equal(policy.inputLanguage(text, 'en'), 'hi', text);
  for (const text of ['Hello', 'Turn on light two', 'What can you do?', 'Play a band']) assert.equal(policy.inputLanguage(text, 'hi'), 'en', text);
  assert.equal(policy.inputLanguage('', 'hi'), 'hi');
});
test('wake aliases are anchored, shared with parser, and never match substrings or ambient mentions', () => {
  const { detectWakeWord } = require('../voice/intent');
  for (const word of ['Shrimaan', 'Shreeman', 'Shiman', 'श्रीमान', 'शिमान', 'Hey Shiman', 'श्रीमान जी']) {
    assert.equal(policy.wakePhrase(word).found, true, word);
    const full = word + ', लाइट दो बंद करो'; assert.equal(detectWakeWord(full).found, true); assert.match(detectWakeWord(full).command, /लाइट 2 बंद/);
  }
  for (const word of ['shrimaanish', 'Simon', 'Do not say Shrimaan', 'Tell me about Shiman', 'श्रीमानजीवन']) assert.equal(policy.wakePhrase(word).found, false, word);
});
test('Hindi conversation/query/control results and replay text remain Hindi with an English decoder hint', async t => {
  const repo = await createRepository(); t.after(() => repo.close());
  const home = new Home(repo, { simulation: true }), assistant = new Assistant(home), actor = { user_id: 'synthetic', token_hash: 'session', role: 'owner' };
  for (const text of ['नमस्ते', 'गैस की स्थिति', 'लाइट दो चालू करो', 'मुझे कहानी सुनाओ']) {
    const parsed = assistant.interpret(text, actor, 'en'); assert.equal(parsed.intent.reply_language, 'hi');
    const value = assistant.execute(parsed.intent_id, crypto.randomUUID(), actor);
    assert.equal(value.answer?.language || value.language, 'hi');
    assert.match(assistant.speechText(value.answer?.result_id || value.result_id, actor, 'hi'), /[\u0900-\u097f]/u);
  }
});
test('frontend fallback preserves recognized Hindi when a result has no language field', async () => {
  const code = js('main.js').slice(js('main.js').indexOf('async function executeIntent('), js('main.js').indexOf('function updateCommandConversation('));
  const ctx = { assistantGeneration: 1, conversation: {}, refresh: async () => {}, updateConversation() {} };
  const scope = { ctx, state: { snapshot: { preferences: { spoken_replies: false } } }, Api: { mode: 'local', request: async () => ({ commands: [], errors: [], result_id: 'synthetic' }) }, crypto, t: s => s, updateCommandConversation() {} };
  vm.runInNewContext(code + ';this.run=executeIntent;', scope);
  await scope.run({ intent: { kind: 'control', reply_language: 'hi' }, intent_id: 'synthetic' }); assert.equal(ctx.conversation.replyLanguage, 'hi');
});
test('manual microphone and explicitly started conversation send no wake requirement, even with wake setting enabled', () => {
  const source = js('main.js'), manual = source.split('\n').find(line => line.startsWith('ctx.startVoice ='));
  const calls = [], ctx = { wakeRequired: true, pauseWake() {}, live: { stop() {} }, stopAudio() {}, voice: { start: (...args) => calls.push(args) } };
  vm.runInNewContext(manual, { ctx, state: { snapshot: { preferences: { input_language: 'hi' } } } }); ctx.startVoice();
  assert.deepEqual(calls, [['hi', false]]);
  assert.match(source, /ctx\.voice\.start\(state\.snapshot\.preferences\.input_language, false\); \}, changed:/);
});
test('navigation retires a busy voice turn so an opted-in wake listener is not stuck paused', () => {
  const source = js('main.js'), code = source.slice(source.indexOf('navigation = new Navigation('), source.indexOf('ctx.live = new LiveConversation('));
  let callback, cancelled = 0;
  const ctx = { assistantBusy: true, assistantGeneration: 1, live: { stop() {} }, voice: { cancel: () => cancelled++ }, stopAudio() {} };
  const scope = { ctx, Navigation: class { constructor(options) { callback = options.onChange; } }, state: { snapshot: {} }, location: { pathname: '/rooms' }, document: { querySelectorAll: () => [] }, clearTimeout, render() {} };
  vm.runInNewContext(code, scope); callback({ direction: 'forward' }); assert.equal(ctx.assistantBusy, false); assert.equal(cancelled, 1);
});
test('chat history retains separate turns, updates current turn, bounds memory and stays out of persistent storage', () => {
  const scope = {}; vm.runInNewContext(js('chat-history.js') + ';this.begin=beginChatTurn;this.sync=syncChat;', scope);
  const conversation = {};
  scope.begin(conversation); conversation.transcript = 'Hello'; conversation.response = 'Hello, I am Shrimaan'; scope.sync(conversation);
  scope.begin(conversation); conversation.transcript = 'नमस्ते'; conversation.response = 'समझ रहा हूँ'; scope.sync(conversation);
  conversation.response = 'नमस्ते'; conversation.replyLanguage = 'hi'; scope.sync(conversation);
  assert.equal(conversation.turns.length, 2); assert.equal(conversation.turns[0].transcript, 'Hello'); assert.equal(conversation.turns[1].response, 'नमस्ते');
  for (let i = 0; i < 45; i++) { scope.begin(conversation); conversation.transcript = String(i); scope.sync(conversation); }
  assert.equal(conversation.turns.length, 40); assert.equal(conversation.turns.at(-1).transcript, '44');
  assert.equal(/localStorage|sessionStorage|indexedDB/.test(js('chat-history.js')), false);
});

function wakeFixture() {
  const recognizers = [], states = [], wakes = [], errors = []; let permitted = true;
  class Recognition {
    constructor() { recognizers.push(this); }
    start() { this.onstart?.(); }
    stop() { queueMicrotask(() => this.onend?.()); }
    abort() { this.aborted = true; }
    result(text, final = true) { const item = [{ transcript: text }]; item.isFinal = final; this.onresult?.({ resultIndex: 0, results: [item] }); }
  }
  const scope = { HomeAutoLanguage: policy, recognitionConstructor: () => Recognition, browserVoiceAvailable: () => true, recognitionLocale: language => language === 'hi' ? 'hi-IN' : 'en-IN', setTimeout, clearTimeout, Date };
  vm.runInNewContext(js('wake-listener.js') + ';this.Wake=WakeListener;', scope);
  const wake = new scope.Wake({ getLanguage: () => 'en', canListen: () => permitted, onState: value => states.push(value), onWake: value => wakes.push(value), onError: value => errors.push(value) });
  return { wake, recognizers, states, wakes, errors, allow: value => { permitted = value; } };
}
test('ambient speech/interim wake does nothing; a final wake activates only after recognition ends', async t => {
  const f = wakeFixture(); t.after(() => f.wake.stop()); f.wake.start('hi');
  const r = f.recognizers[0]; assert.equal(r.continuous, true); assert.equal(r.lang, 'hi-IN');
  r.result('turn on light two'); assert.equal(f.wakes.length, 0);
  // Browser continuous-result indexes increase for subsequent phrases.
  const item = [{ transcript: 'शिमान लाइट दो बंद करो' }]; item.isFinal = false;
  r.onresult({ resultIndex: 1, results: [[], item] }); assert.equal(f.wakes.length, 0);
  item.isFinal = true; r.onresult({ resultIndex: 1, results: [[], item] }); assert.equal(f.wakes.length, 0);
  await flush(); assert.equal(f.wakes.length, 1); assert.equal(f.wakes[0].command, 'लाइट दो बंद करो'); assert.equal(f.wake.state, 'paused');
  assert.deepEqual(f.errors, []);
});
test('wake pause/stop retires old results and a browser error stops automatic restarts', async t => {
  const f = wakeFixture(); t.after(() => f.wake.stop()); f.wake.start(); const stale = f.recognizers[0].onresult;
  f.wake.pause(); const item = [{ transcript: 'Shrimaan turn on light two' }]; item.isFinal = true; stale({ resultIndex: 0, results: [item] }); assert.equal(f.wakes.length, 0);
  f.wake.resume(); assert.equal(f.recognizers.length, 2); f.recognizers[1].onerror({ error: 'network' });
  assert.equal(f.wake.enabled, false); assert.equal(f.errors[0].code, 'BROWSER_RECOGNITION_NETWORK'); await flush(); assert.equal(f.recognizers.length, 2);
});
test('wake matching pauses during a modal/hidden page instead of activating a command', t => {
  const f = wakeFixture(); t.after(() => f.wake.stop()); f.wake.start(); f.allow(false); f.recognizers[0].result('Shrimaan turn on light two');
  assert.equal(f.wakes.length, 0); assert.equal(f.wake.state, 'paused'); f.wake.resume(); assert.equal(f.recognizers.length, 1);
});
