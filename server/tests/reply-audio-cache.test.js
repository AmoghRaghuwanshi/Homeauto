const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ReplyAudioCache } = require('../voice/reply-audio-cache');
const { pcmWav } = require('../voice/whisper');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { Assistant } = require('../services/assistant');
const { SpeechService } = require('../voice/speech-service');
const key = text => crypto.createHash('sha256').update(text).digest('hex');
function folder(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-fixed-audio-')); t.after(() => { assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(dir, { recursive: true, force: true }); }); return dir; }
function ready(speech) { speech.ready.tts_ready = true; speech.ready.reply_languages = ['en']; speech.ready.voices = [{ language: 'en', id: 'synthetic' }]; speech.ttsProfileHash = 'verified-synthetic-profile'; }

test('fixed audio survives a cache instance restart and corruption becomes a cache miss', t => {
  const dir = folder(t), cache = new ReplyAudioCache(dir), audio = pcmWav(Buffer.alloc(6400));
  cache.put(key('greeting'), audio);
  assert.deepEqual(new ReplyAudioCache(dir).get(key('greeting')).audio, audio);
  fs.appendFileSync(cache.file(key('greeting'), '.wav'), 'corruption');
  assert.equal(cache.get(key('greeting')), null);
  assert.throws(() => cache.file('../escape', '.wav'), /Invalid/);
  assert.throws(() => cache.file(key('greeting'), '/../escape'), /Invalid/);
  assert.equal(cache.get('../escape'), null);
});

test('persistent cache evicts only its own oldest files within its byte/count budget', t => {
  const dir = folder(t), cache = new ReplyAudioCache(dir), audio = pcmWav(Buffer.alloc(600000));
  fs.writeFileSync(path.join(dir, 'keep.txt'), 'unrelated');
  for (let i = 0; i < 18; i++) cache.put(key(String(i)), audio);
  const waves = fs.readdirSync(dir).filter(name => name.endsWith('.wav'));
  assert.ok(waves.length <= 16); assert.ok(waves.reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0) <= 8 * 1024 * 1024);
  assert.equal(fs.readFileSync(path.join(dir, 'keep.txt'), 'utf8'), 'unrelated');
  assert.ok(cache.get(key('17'))); assert.ok(!fs.readdirSync(dir).some(name => name.endsWith('.tmp')));
});

test('service restart reuses only a verified matching profile and keeps job ownership', async t => {
  const dir = folder(t), repo = await createRepository(); t.after(() => repo.close());
  const home = new Home(repo), assistant = new Assistant(home), actor = { user_id: 'cache-owner', role: 'owner' };
  const first = new SpeechService(home, assistant, { TTS_CACHE_DIR: dir }); ready(first);
  first.run = async () => ({ audio: pcmWav(Buffer.alloc(6400)).toString('base64'), duration_ms: 1 });
  await first.synthesize('Hello', 'en', actor, { cache: true }); await new Promise(resolve => setImmediate(resolve)); first.close();
  const second = new SpeechService(home, assistant, { TTS_CACHE_DIR: dir }); ready(second); t.after(() => second.close());
  second.run = () => assert.fail('Matching fixed reply should not regenerate');
  const job = await second.synthesize('Hello', 'en', actor, { cache: true });
  assert.equal(second.job(job.job_id, actor).duration_ms, 0);
  assert.throws(() => second.audio(job.job_id, { user_id: 'other' }), error => error.code === 'NOT_FOUND');
  let generated = 0; second.run = async () => { generated++; return { audio: pcmWav(Buffer.alloc(6400)).toString('base64'), duration_ms: 1 }; };
  second.ttsProfileHash = 'different-verified-profile';
  await second.synthesize('Hello', 'en', actor, { cache: true }); await new Promise(resolve => setImmediate(resolve)); assert.equal(generated, 1);
  await second.synthesize('Hello', 'en', actor); await new Promise(resolve => setImmediate(resolve)); assert.equal(generated, 2);
});

test('a slow queued synthesis retains a full audio lifetime after completion', async t => {
  let now = 1000, complete; const repo = await createRepository(); const home = new Home(repo, { now: () => now });
  const speech = new SpeechService(home, new Assistant(home)); ready(speech); t.after(() => { speech.close(); repo.close(); });
  speech.run = () => new Promise(resolve => { complete = resolve; });
  const actor = { user_id: 'slow-speech', role: 'owner' }, job = await speech.synthesize('Hello', 'en', actor);
  now += 59000; assert.equal(speech.job(job.job_id, actor).state, 'queued');
  complete({ audio: pcmWav(Buffer.alloc(6400)).toString('base64'), duration_ms: 59000 }); await new Promise(resolve => setImmediate(resolve));
  now += 59000; assert.equal(speech.job(job.job_id, actor).state, 'ready');
  now += 1001; assert.throws(() => speech.job(job.job_id, actor), error => error.code === 'NOT_FOUND');
});
