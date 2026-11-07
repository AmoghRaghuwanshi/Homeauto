const { fork, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fail } = require('../lib/errors');
const { resolveCommand, detectWakeWord } = require('./intent');
class SpeechService {
  constructor(home, assistant, config = {}) {
    this.home = home; this.assistant = assistant; this.config = config;
    this.stt = null; this.tts = null; this.ready = { stt_ready: false, tts_ready: false, input_languages: [], reply_languages: [], voices: [] };
    this.pending = new Map(); this.jobs = new Map(); this.tickets = new Map(); this.busy = false; this.closed = false;
  }
  readiness() { return { ...this.ready }; }
  start() {
    if (this.config.VOICE_ENABLED === false) return;
    for (const kind of ['stt','tts']) require('./assets').verifyProfile(kind,this.config).then(profile=>{
      if(this.closed) return;
      this.home.repo.write('INSERT OR REPLACE INTO model_assets(id,provider,version,path_key,sha256,bytes,license_ref,verified_at,enabled) VALUES(?,?,?,?,?,?,?,?,?)',[kind==='stt'?'vosk-bilingual':'kokoro-bilingual',kind==='stt'?'vosk':'kokoro-onnx','installed-v1',kind,profile.sha256,profile.bytes,kind==='stt'?'Apache-2.0':'See NOTICE',new Date().toISOString(),1]);
      this.startWorker(kind);
    }).catch(()=>this.unavailable(kind));
  }
  startWorker(kind) {
    const env = { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: process.env.TEMP, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
    if(kind==='stt') {
    this.stt = fork(path.join(__dirname, 'stt-worker.js'), [], { env: { ...env, HOMEAUTO_MODELS: this.config.MODELS_DIR || path.join(__dirname, 'models') }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    this.stt.on('message', msg => this.handle('stt', msg)); this.stt.on('error', () => this.unavailable('stt')); this.stt.on('exit', () => this.unavailable('stt'));
    } else if (this.config.TTS_PYTHON && this.config.TTS_MODEL && this.config.TTS_VOICES && [this.config.TTS_PYTHON, this.config.TTS_MODEL, this.config.TTS_VOICES].every(f => fs.existsSync(f))) {
      this.tts = spawn(this.config.TTS_PYTHON, [path.join(__dirname, 'tts-worker.py')], { env: { ...env, HOMEAUTO_TTS_MODEL: this.config.TTS_MODEL, HOMEAUTO_TTS_VOICES: this.config.TTS_VOICES }, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
      let buffer = ''; this.tts.stdout.setEncoding('utf8'); this.tts.stdout.on('data', chunk => { buffer += chunk; if (buffer.length > 5000000) { this.tts.kill(); return; } let index; while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); try { this.handle('tts', JSON.parse(line)); } catch {} } });
      this.tts.on('error', () => this.unavailable('tts')); this.tts.on('exit', () => this.unavailable('tts'));
    }
  }
  handle(kind, msg) {
    if (msg.type === 'ready') {
      if(kind==='tts')this.ttsWorkerPid=msg.pid;
      this.ready[kind + '_ready'] = true;
      this.ready[kind === 'stt' ? 'input_languages' : 'reply_languages'] = msg.languages;
      if (kind === 'tts') this.ready.voices = Object.entries(msg.voices).map(([language, id]) => ({ language, id }));
      this.home.emitChange(); return;
    }
    if (msg.type === 'unavailable') return this.unavailable(kind);
    const job = this.pending.get(msg.id); if (job) { this.pending.delete(msg.id); clearTimeout(job.timer); this.busy = false; msg.error ? job.reject(new Error(msg.error)) : job.resolve(msg); }
  }
  unavailable(kind) {
    this.ready[kind + '_ready'] = false;
    for (const [id, job] of this.pending) if (job.kind === kind) { clearTimeout(job.timer); job.reject(new Error(kind.toUpperCase() + '_UNAVAILABLE')); this.pending.delete(id); this.busy = false; }
    if (!this.closed) this.home.emitChange();
  }
  run(kind, payload) {
    if (this.busy) fail('SPEECH_BUSY', 429);
    if (!this.ready[kind + '_ready']) fail('VOICE_NOT_READY', 503);
    const id = crypto.randomUUID(); this.busy = true;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); this.busy = false; this[kind]?.kill(); this.unavailable(kind); reject(new Error('SPEECH_TIMEOUT')); }, 30000);
      this.pending.set(id, { resolve, reject, timer, kind });
      if (kind === 'stt') this.stt.send({ id, type: 'transcribe', ...payload }); else this.tts.stdin.write(JSON.stringify({ id, type: 'synthesize', ...payload }) + '\n');
    });
  }
  ticket(actor) {
    if (!this.ready.stt_ready) fail('VOICE_NOT_READY', 503);
    this.prune(); if (this.tickets.size >= 50) fail('SPEECH_BUSY', 429);
    const ticket = crypto.randomBytes(24).toString('hex'); const expires = this.home.now() + 30000;
    this.tickets.set(ticket, { actor: actor.token_hash, expires }); return { ticket, expires_at: new Date(expires).toISOString() };
  }
  consume(ticket, actor) { const t = this.tickets.get(ticket); this.tickets.delete(ticket); if (!t || t.actor !== actor.token_hash || t.expires <= this.home.now()) fail('INVALID_VOICE_TICKET', 403); }
  async transcribe(pcm, language, wakeRequired = false) {
    const result = await this.run('stt', { pcm: pcm.toString('base64'), language });
    const candidates = result.candidates.filter(c => c.text && (!wakeRequired || detectWakeWord(c.text).found));
    const evaluated = candidates.map(c => ({ ...c, parsed: resolveCommand(c.text, this.home.repo.getDevices(), this.home.rooms(), this.home.repo.all('SELECT * FROM room_aliases WHERE confirmed=1')) }));
    if (evaluated.some(c => c.parsed.reason === 'negated' || c.parsed.reason === 'conflicting')) fail('RECOGNITION_AMBIGUOUS', 422);
    const parsed = evaluated.filter(c => c.parsed.ok);
    if (!parsed.length) fail('RECOGNITION_UNCLEAR', 422);
    const unique = new Set(parsed.map(c => JSON.stringify({ action: c.parsed.intent.action, devices: c.parsed.intent.device_ids })));
    if (unique.size !== 1) fail('RECOGNITION_AMBIGUOUS', 422);
    return { text: parsed[0].text, lang: parsed[0].lang, duration_ms: result.duration_ms, memory_bytes: result.memory_bytes };
  }
  async synthesize(text, language, actor) {
    if (this.busy) fail('SPEECH_BUSY', 429);
    this.prune(); if (this.jobs.size >= 20 || [...this.jobs.values()].some(j => j.actor === actor.user_id && j.state === 'queued')) fail('SPEECH_BUSY', 429);
    if (!this.ready.reply_languages.includes(language)) fail('VOICE_NOT_READY', 503);
    const id = crypto.randomUUID(); const job = { actor: actor.user_id, state: 'queued', expires: this.home.now() + 60000 }; this.jobs.set(id, job);
    this.run('tts', { text, language, rate: this.home.preferences(actor).voice_rate }).then(result => { job.audio = Buffer.from(result.audio, 'base64'); job.state = 'ready'; job.duration_ms = result.duration_ms; }).catch(() => { job.state = 'failed'; job.error_code = 'SYNTHESIS_FAILED'; });
    return { job_id: id };
  }
  job(id, actor) { this.prune(); const j = this.jobs.get(id); if (!j || j.actor !== actor.user_id) fail('NOT_FOUND', 404); return { state: j.state, error_code: j.error_code, ...(j.state === 'ready' ? { audio_url: '/api/assistant/audio/' + id, duration_ms: j.duration_ms } : {}) }; }
  audio(id, actor) { this.job(id, actor); const j = this.jobs.get(id); if (j.state !== 'ready') fail('AUDIO_NOT_READY', 409); return j.audio; }
  assets() { return [{ id: 'vosk-bilingual', provider: 'vosk', languages: ['en', 'hi'], ready: this.ready.stt_ready, active: this.ready.stt_ready, license_status: 'Apache-2.0', bytes: this.home.repo.one("SELECT bytes FROM model_assets WHERE id='vosk-bilingual'")?.bytes || null }, { id: 'kokoro-bilingual', provider: 'kokoro-onnx', languages: this.ready.reply_languages, ready: this.ready.tts_ready, active: this.ready.tts_ready, license_status: 'See third-party notices', bytes: this.home.repo.one("SELECT bytes FROM model_assets WHERE id='kokoro-bilingual'")?.bytes || null }]; }
  async activate(id) { if (!['vosk-bilingual', 'kokoro-bilingual'].includes(id)) fail('NOT_FOUND', 404); if (this.busy) fail('SPEECH_BUSY', 409); if (!(id.startsWith('vosk') ? this.ready.stt_ready : this.ready.tts_ready)) fail('VOICE_NOT_READY', 503); return { active_id: id, ready: true }; }
  prune() { for (const [id, t] of this.tickets) if (t.expires <= this.home.now()) this.tickets.delete(id); for (const [id, j] of this.jobs) if (j.expires <= this.home.now()) this.jobs.delete(id); this.assistant.prune(); }
  close() { this.closed = true; for (const j of this.pending.values()) { clearTimeout(j.timer); j.reject(new Error('STOPPED')); } this.pending.clear(); this.stt?.kill(); this.tts?.kill(); this.jobs.clear(); this.tickets.clear(); }
}
module.exports = { SpeechService };
