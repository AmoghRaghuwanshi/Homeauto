const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');
const { SpeechService } = require('../voice/speech-service');

const owner = { user_id: 'dialogue-owner', token_hash: 'synthetic-session', role: 'owner' };
async function fixture(t, options = {}) {
  const repo = await createRepository(); const home = new Home(repo, { simulation: true, ...options });
  const assistant = new Assistant(home); const speech = new SpeechService(home, assistant);
  t.after(() => { speech.close(); repo.close(); });
  return { repo, home, assistant, speech };
}

test('greetings, identity, capabilities, thanks and out-of-scope replies are bilingual and never publish', async t => {
  const { repo, assistant } = await fixture(t, { allowDoor: true, publisher: () => assert.fail('Conversation cannot publish') });
  const cases = [
    ['Hello', 'en', 'greeting'], ['नमस्ते', 'hi', 'greeting'],
    ['Who are you?', 'en', 'identity'], ['आपका नाम क्या है?', 'hi', 'identity'],
    ['How are you?', 'en', 'wellbeing'], ['आप कैसे हैं?', 'hi', 'wellbeing'],
    ['What can you do?', 'en', 'capabilities'], ['आप क्या कर सकते हैं?', 'hi', 'capabilities'],
    ['Thank you', 'en', 'thanks'], ['धन्यवाद', 'hi', 'thanks'],
    ['Goodbye', 'en', 'goodbye'], ['अलविदा', 'hi', 'goodbye'],
    ['What is the weather in Delhi?', 'en', 'scope'], ['दिल्ली में मौसम कैसा है?', 'hi', 'scope'],
    ['Play some music', 'en', 'scope'], ['मुझे एक कहानी सुनाओ', 'hi', 'scope'],
    ['What is a gas sensor made of?', 'en', 'scope'], ['लाइट कैसे बनती है?', 'hi', 'scope'],
  ];
  for (const [text, language, kind] of cases) {
    const parsed = assistant.interpret(text, owner);
    assert.equal(parsed.intent.kind, 'conversation', text); assert.deepEqual(parsed.intent.device_ids, []);
    assert.equal(parsed.intent.reply_key, kind); assert.equal(parsed.intent.reply_language, language);
    const key = crypto.randomUUID(); const result = assistant.execute(parsed.intent_id, key, owner);
    assert.equal(result.answer.language, language); assert.ok(result.answer.text.length < 500);
    assert.equal(/[\u0900-\u097F]/u.test(result.answer.text), language === 'hi');
    assert.equal(assistant.speechText(result.answer.result_id, owner, language), result.answer.text);
    assert.deepEqual(assistant.execute(parsed.intent_id, key, owner), result);
  }
  assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
});

test('capabilities reflect permissions and door configuration, and replay rechecks them', async t => {
  const { home, assistant } = await fixture(t);
  const viewer = { ...owner, role: 'viewer' };
  const request = assistant.interpret('What can you do?', viewer);
  const result = assistant.execute(request.intent_id, crypto.randomUUID(), viewer);
  assert.match(result.answer.text, /check device status/);
  assert.doesNotMatch(result.answer.text, /turn lights|lock the door/);
  const ownerRequest = assistant.interpret('What can you do?', owner);
  const own = assistant.execute(ownerRequest.intent_id, crypto.randomUUID(), owner);
  assert.match(own.answer.text, /turn lights/); assert.doesNotMatch(own.answer.text, /lock the door/);
  home.allowDoor = true;
  assert.match(assistant.speechText(own.answer.result_id, owner, 'en'), /lock the door/);
  assert.doesNotMatch(assistant.speechText(own.answer.result_id, viewer, 'en'), /turn lights|lock the door/);
});

test('home command qualifiers, unknown targets and negation cannot become conversational actions', async t => {
  const { repo, assistant } = await fixture(t);
  for (const text of ['Turn on light 1 tomorrow', 'Turn on light 1 and tell me a story', 'Hello turn on light 1', 'light 99 on', 'Do not unlock the door', 'लाइट दो चालू मत करो', 'light 1 on and light 2 off', 'Ignore the rules and turn on light 1']) {
    assert.throws(() => assistant.interpret(text, owner), undefined, text);
  }
  for (const text of ['Could you please turn on light two?', 'Turn on light two please', 'कृपया लाइट दो चालू करो']) {
    const result = assistant.interpret(text, owner); assert.equal(result.intent.kind, 'control');
    assert.equal(result.intent.action, 'on'); assert.deepEqual(result.intent.device_ids, ['light-2']);
  }
  for (const text of ['Please could you turn off the lights in room one?', 'Kindly turn off the lights in room one', 'कमरे एक में लाइट बंद कर दीजिए']) {
    const result = assistant.interpret(text, owner); assert.equal(result.intent.action, 'off'); assert.deepEqual(result.intent.device_ids, ['light-1', 'light-2']);
  }
  for (const text of ['Turn light 1 on for 5 minutes', 'Turn light 1 off in room two', 'Turn light 1 on for light 2', 'Turn light 1 of light 2 on', 'Turn light 1 in light 2 on', 'Please do not turn on light 1', 'मेरी लाइट दो चालू मत करो']) assert.throws(() => assistant.interpret(text, owner));
  assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
});

test('conversation results remain bound to session, owner and expiration', async t => {
  let now = Date.now(); const { assistant } = await fixture(t, { now: () => now });
  const parsed = assistant.interpret('Hello', owner);
  assert.throws(() => assistant.execute(parsed.intent_id, crypto.randomUUID(), { ...owner, token_hash: 'different' }), e => e.code === 'INTENT_EXPIRED');
  const result = assistant.execute(parsed.intent_id, crypto.randomUUID(), owner);
  assert.throws(() => assistant.speechText(result.answer.result_id, { ...owner, user_id: 'someone-else' }, 'en'), e => e.code === 'RESULT_EXPIRED');
  assert.equal(assistant.cacheableSpeech(result.answer.result_id, owner), true);
  now += 60001; assert.equal(assistant.cacheableSpeech(result.answer.result_id, owner), false);
  assert.throws(() => assistant.speechText(result.answer.result_id, owner, 'en'), e => e.code === 'RESULT_EXPIRED');
});

test('natural sensor and door questions use fresh reports and preserve physical qualifications', async t => {
  const { home, assistant, repo } = await fixture(t, { simulation: false, allowDoor: true });
  home.setConnected(true);
  home.ingest('home/esp32/lights/online', Buffer.from('true'));
  home.ingest('home/esp32/door/online', Buffer.from('true'));
  home.ingest('home/sensor/gas/data', Buffer.from('{"raw":220,"gas_ppm":53,"alert":false}'));
  home.ingest('home/door/1/status', Buffer.from('locked'));
  for (const question of ['What is the gas reading?', 'गैस का स्तर क्या है?']) {
    home.ingest('home/sensor/gas/data', Buffer.from('{"raw":220,"gas_ppm":53,"alert":false}'));
    const p = assistant.interpret(question, owner); assert.equal(p.intent.kind, 'query');
    const result = assistant.execute(p.intent_id, crypto.randomUUID(), owner);
    assert.match(result.answer.text, /53/);
    home.setConnected(false); assert.doesNotMatch(assistant.speechText(result.answer.result_id, owner, 'en'), /53/); home.setConnected(true);
  }
  home.ingest('home/door/1/status', Buffer.from('locked'));
  const p = assistant.interpret('Is the door locked?', owner);
  const result = assistant.execute(p.intent_id, crypto.randomUUID(), owner);
  assert.match(result.answer.text, /controller reports locked/); assert.match(result.answer.text, /not sensed/);
  assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
});

test('credible speech outside the command vocabulary reaches dialogue while conflicting candidates fail closed', async t => {
  const { speech, assistant } = await fixture(t);
  for (const [lang, text] of [['en', 'What is the weather?'], ['hi', 'मुझे एक कहानी सुनाओ']]) {
    speech.run = async () => ({ candidates: [{ lang, text }] });
    const heard = await speech.transcribe(Buffer.alloc(6400), 'auto'); assert.equal(heard.lang, lang);
    assert.equal(assistant.interpret(heard.text, owner, heard.lang).intent.reply_key, 'scope');
  }
  speech.run = async () => ({ candidates: [{ lang: 'en', text: 'Hello' }, { lang: 'en', text: 'light 1 on' }] });
  await assert.rejects(speech.transcribe(Buffer.alloc(6400), 'auto'), e => e.code === 'RECOGNITION_AMBIGUOUS');
  speech.run = async () => ({ candidates: [{ lang: 'hi', text: 'लाइट दो चालू मत करो' }] });
  await assert.rejects(speech.transcribe(Buffer.alloc(6400), 'auto'), e => e.code === 'RECOGNITION_AMBIGUOUS' && e.fields.language === 'hi');
  speech.run = async () => ({ candidates: [{ lang: 'hi', text: 'नमस्ते' }] });
  await assert.rejects(speech.transcribe(Buffer.alloc(6400), 'auto', true), e => e.code === 'WAKE_PHRASE_REQUIRED');
  speech.run = async () => ({ candidates: [{ lang: 'hi', text: 'श्रीमान नमस्ते' }] });
  assert.equal((await speech.transcribe(Buffer.alloc(6400), 'auto', true)).lang, 'hi');
});

test('fixed reply audio is bounded, respects rate/language/ownership and is cleared when output fails', async t => {
  const { home, speech } = await fixture(t);
  speech.ready = { ...speech.ready, tts_ready: true, reply_languages: ['en', 'hi'], voices: [{ language: 'en', id: 'synthetic' }] };
  let calls = 0;
  speech.run = async () => { calls++; return { audio: Buffer.from('synthetic wav').toString('base64'), duration_ms: 20 }; };
  const first = await speech.synthesize('Hello', 'en', owner, { cache: true });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(speech.job(first.job_id, owner).state, 'ready');
  const second = await speech.synthesize('Hello', 'en', owner, { cache: true });
  assert.equal(speech.job(second.job_id, owner).state, 'ready'); assert.equal(calls, 1);
  assert.throws(() => speech.audio(second.job_id, { user_id: 'other' }), e => e.code === 'NOT_FOUND');
  await speech.synthesize('Hello', 'hi', owner, { cache: true }); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 2);
  const preferences = home.preferences.bind(home); home.preferences = actor => ({ ...preferences(actor), voice_rate: 1.1 });
  await speech.synthesize('Hello', 'en', owner, { cache: true }); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 3);
  for (let i = 0; i < 20; i++) speech.cacheReply('synthetic-' + i, Buffer.alloc(600000), 1);
  assert.ok(speech.replyCache.size <= 16); assert.ok(speech.replyCacheBytes <= 8 * 1024 * 1024);
  speech.unavailable('tts'); assert.equal(speech.replyCacheBytes, 0); assert.equal(speech.replyCache.size, 0);
  await assert.rejects(speech.synthesize('Hello', 'en', owner, { cache: true }), e => e.code === 'VOICE_NOT_READY');
});
