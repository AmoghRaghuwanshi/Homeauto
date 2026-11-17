const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fail } = require('../lib/errors');
const { resolveCommand, detectWakeWord, normalize } = require('./intent');
const { stopWorker } = require('./stop-worker');
const { dialogueKind } = require('./dialogue');
const { ReplyAudioCache } = require('./reply-audio-cache');
class SpeechService {
  constructor(home, assistant, config = {}) {
    this.home = home; this.assistant = assistant; this.config = config;
    this.stt = null; this.tts = null; this.ready = { stt_ready: false, tts_ready: false, input_languages: [], reply_languages: [], voices: [] };
    this.states = { stt: 'not_configured', tts: 'not_configured' };
    this.lastRecognition = null;
    this.replyCache = new Map(); this.replyCacheBytes = 0;
    this.replyDisk = config.TTS_CACHE_DIR ? new ReplyAudioCache(config.TTS_CACHE_DIR) : null;
    this.pending = new Map(); this.jobs = new Map(); this.tickets = new Map(); this.busy = false; this.closed = false;
  }
  readiness() { return { ...this.ready, stt_state: this.ready.stt_ready ? 'ready' : this.states.stt, tts_state: this.ready.tts_ready ? 'ready' : this.states.tts }; }
  start() {
    if (this.started || this.closed) return;
    this.started = true;
    if (this.config.VOICE_ENABLED === false) { this.states = { stt: 'disabled', tts: 'disabled' }; return; }
    this.states = { stt: 'checking', tts: 'checking' };
    this.home.emitChange();
    this.home.repo.write("UPDATE model_assets SET enabled=0 WHERE id='vosk-bilingual'");
    for (const kind of ['stt','tts']) require('./assets').verifyProfile(kind,this.config).then(profile=>{
      if(this.closed) return;
      this.recordProfile(kind, profile);
      this.states[kind] = 'loading'; this.home.emitChange();
      this.startWorker(kind);
    }).catch(error=>this.unavailable(kind, error.code === 'ENOENT' ? 'not_configured' : 'failed'));
  }
  recordProfile(kind, profile) {
    if (kind === 'tts') this.ttsProfileHash = crypto.createHash('sha256').update(profile.sha256).update(fs.readFileSync(path.join(__dirname, 'tts-worker.py'))).digest('hex');
    this.home.repo.write('INSERT OR REPLACE INTO model_assets(id,provider,version,path_key,sha256,bytes,license_ref,verified_at,enabled) VALUES(?,?,?,?,?,?,?,?,?)',[kind==='stt'?'whisper-medium-bilingual':'kokoro-bilingual',kind==='stt'?'faster-whisper':'kokoro-onnx',kind==='stt'?require('./whisper-manifest.json').revision:'installed-v1',kind,profile.sha256,profile.bytes,kind==='stt'?'MIT':'See NOTICE',new Date().toISOString(),1]);
  }
  startWorker(kind) {
    const env = { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, TEMP: process.env.TEMP, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
    const python = kind === 'stt' ? this.config.STT_PYTHON : this.config.TTS_PYTHON;
    if (!python || !fs.existsSync(python)) return this.unavailable(kind, 'not_configured');
    const settings = kind === 'stt' ? { HOMEAUTO_STT_MODEL: this.config.STT_MODEL_DIR, HOMEAUTO_STT_PROGRESS: '1' } : { HOMEAUTO_TTS_MODEL: this.config.TTS_MODEL, HOMEAUTO_TTS_VOICES: this.config.TTS_VOICES };
    const child = spawn(python, [path.join(__dirname, kind === 'stt' ? 'whisper-worker.py' : 'tts-worker.py')], { env: { ...env, ...settings }, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    this[kind] = child;
    let buffer = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { if (this.closed || this[kind] !== child) return; buffer += chunk; if (buffer.length > 5000000) { this.unavailable(kind); return; } let index; while ((index = buffer.indexOf('\n')) !== -1) { const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); try { this.handle(kind, JSON.parse(line), child); } catch {} } });
    const lost = () => { if (this[kind] === child) this.unavailable(kind); };
    child.stdin.on('error', lost);
    child.on('error', lost); child.on('exit', lost);
  }
  handle(kind, msg, worker = this[kind]) {
    if (this.closed || worker !== this[kind]) return;
    if (msg.type === 'ready') {
      this.states[kind] = 'ready';
      if(kind==='tts')this.ttsWorkerPid=msg.pid;
      if(kind==='stt')this.sttWorkerPid=msg.pid;
      this.ready[kind + '_ready'] = true;
      this.ready[kind === 'stt' ? 'input_languages' : 'reply_languages'] = msg.languages;
      if (kind === 'tts') this.ready.voices = Object.entries(msg.voices).map(([language, id]) => ({ language, id }));
      this.home.emitChange(); return;
    }
    if (msg.type === 'unavailable') return this.unavailable(kind);
    if (msg.type === 'progress') {
      const job = this.pending.get(msg.id);
      if (job?.kind === kind && job.diagnostics && ['received', 'preparing', 'encoding', 'decoding'].includes(msg.stage)) {
        job.diagnostics.phase = msg.stage; job.diagnostics.processing_ms = Math.round(performance.now() - job.started);
        try { job.onProgress?.(msg.stage); } catch { /* A disconnected observer cannot settle the job. */ }
      }
      return;
    }
    const job = this.pending.get(msg.id); if (job) { this.pending.delete(msg.id); clearTimeout(job.timer); this.busy = false; this.finishMetrics(job, msg.error ? 'failed' : 'completed', msg.error, msg); msg.error ? job.reject(new Error(msg.error)) : job.resolve(msg); }
  }
  recognitionMetrics() { return this.lastRecognition ? { ...this.lastRecognition } : null; }
  finishMetrics(job, state, error, result = {}) {
    if (!job.diagnostics) return;
    Object.assign(job.diagnostics, { state, processing_ms: Math.round(performance.now() - job.started) });
    if (error) job.diagnostics.error_code = error;
    for (const key of ['encoder_passes', 'encoder_reuses', 'speech_ms']) if (Number.isFinite(result[key]) && result[key] >= 0) job.diagnostics[key] = result[key];
  }
  unavailable(kind, state = 'failed') {
    if (kind === 'tts') { this.replyCache.clear(); this.replyCacheBytes = 0; }
    const previous = this[kind]; this[kind] = null; stopWorker(previous);
    this.states[kind] = this.closed ? 'stopped' : state;
    this.ready[kind + '_ready'] = false;
    this.ready[kind === 'stt' ? 'input_languages' : 'reply_languages'] = [];
    if (kind === 'tts') this.ready.voices = [];
    for (const [id, job] of this.pending) if (job.kind === kind) { clearTimeout(job.timer); this.finishMetrics(job, 'failed', kind.toUpperCase() + '_UNAVAILABLE'); job.reject(new Error(kind.toUpperCase() + '_UNAVAILABLE')); this.pending.delete(id); this.busy = false; }
    if (!this.closed) this.home.emitChange();
  }
  run(kind, payload, onProgress) {
    if (this.busy) fail('SPEECH_BUSY', 429);
    if (!this.ready[kind + '_ready']) fail('VOICE_NOT_READY', 503);
    const id = crypto.randomUUID(); this.busy = true;
    const worker = this[kind];
    return new Promise((resolve, reject) => {
      const job = { resolve, reject, kind, onProgress, started: performance.now(), diagnostics: kind === 'stt' ? { state: 'processing', phase: 'queued', audio_ms: Buffer.byteLength(payload.pcm || '', 'base64') / 32 } : null };
      if (job.diagnostics) this.lastRecognition = job.diagnostics;
      job.timer = setTimeout(() => {
        if (this.pending.get(id) !== job) return;
        this.pending.delete(id); this.busy = false; this.finishMetrics(job, 'timeout', 'SPEECH_TIMEOUT');
        if (this[kind] === worker) this.unavailable(kind);
        reject(new Error('SPEECH_TIMEOUT'));
      }, 60000);
      this.pending.set(id, job);
      try { worker.stdin.write(JSON.stringify({ id, type: kind === 'stt' ? 'transcribe' : 'synthesize', ...payload }) + '\n'); }
      catch { clearTimeout(job.timer); this.pending.delete(id); this.busy = false; this.finishMetrics(job, 'failed', 'SPEECH_TRANSPORT_ERROR'); if (this[kind] === worker) this.unavailable(kind); reject(new Error(kind.toUpperCase() + '_UNAVAILABLE')); }
    });
  }
  ticket(actor) {
    if (!this.ready.stt_ready) fail('VOICE_NOT_READY', 503);
    this.prune(); if (this.tickets.size >= 50) fail('SPEECH_BUSY', 429);
    const ticket = crypto.randomBytes(24).toString('hex'); const expires = this.home.now() + 30000;
    this.tickets.set(ticket, { actor: actor.token_hash, expires }); return { ticket, expires_at: new Date(expires).toISOString() };
  }
  consume(ticket, actor) { const t = this.tickets.get(ticket); this.tickets.delete(ticket); if (!t || t.actor !== actor.token_hash || t.expires <= this.home.now()) fail('INVALID_VOICE_TICKET', 403); }
  async transcribe(pcm, language, wakeRequired = false, onProgress) {
    const result = await this.run('stt', { pcm: pcm.toString('base64'), language }, onProgress);
    if (result.limit_reached) fail('VOICE_REQUEST_TOO_LONG', 422, undefined, { transcripts: [], ...(['en', 'hi'].includes(result.language) ? { language: result.language } : {}) });
    const credible = result.candidates.filter(c => c && typeof c.text === 'string' && c.text.trim() && c.text.length <= 500 && ['en', 'hi'].includes(c.lang));
    const candidates = credible.filter(c => !wakeRequired || detectWakeWord(c.text).found);
    if (wakeRequired && !candidates.length && credible.length) fail('WAKE_PHRASE_REQUIRED', 422);
    const evaluated = candidates.map(c => { const parsed = resolveCommand(c.text, this.home.repo.getDevices(), this.home.rooms(), this.home.repo.all('SELECT * FROM room_aliases WHERE confirmed=1')); return { ...c, parsed, dialogue: parsed.ok ? null : dialogueKind(c.text, parsed) }; });
    const transcripts = candidates.slice(0, 2).map(c => ({ text: c.text.slice(0, 500), lang: c.lang }));
    const languages = [...new Set(candidates.map(c => c.lang))];
    const fields = { transcripts, ...(languages.length === 1 ? { language: languages[0] } : {}) };
    if (evaluated.some(c => !c.dialogue && ['negated', 'conflicting', 'unknown_target'].includes(c.parsed.reason))) fail('RECOGNITION_AMBIGUOUS', 422, undefined, fields);
    // Recognition can succeed while the requested target is unspecified. Do
    // not let the other language's decoder invent that missing target.
    const ambiguous = evaluated.find(c => c.parsed.reason === 'ambiguous' && /(?:\blights?\b|\blamps?\b|लाइट|बत्ती)/u.test(normalize(c.text)) && /(?:^|\s)(?:on|off|चालू|बंद|जलाओ|बुझाओ|chalu|band)(?:\s|$)/u.test(normalize(c.text)));
    if (ambiguous) fail('INTENT_AMBIGUOUS', 422, undefined, { transcripts, language: ambiguous.lang });
    const parsed = evaluated.filter(c => c.parsed.ok || c.dialogue);
    if (!parsed.length) fail('RECOGNITION_UNCLEAR', 422, undefined, fields);
    const unique = new Set(parsed.map(c => c.dialogue ? 'reply:' + c.dialogue : JSON.stringify({ action: c.parsed.intent.action, devices: c.parsed.intent.device_ids })));
    if (unique.size !== 1) fail('RECOGNITION_AMBIGUOUS', 422, undefined, fields);
    return { text: parsed[0].text, lang: parsed[0].lang, duration_ms: result.duration_ms, memory_bytes: result.memory_bytes };
  }
  cacheReply(key, audio, duration_ms) {
    const limit = 8 * 1024 * 1024;
    if (audio.length > limit) return;
    const old = this.replyCache.get(key); if (old) this.replyCacheBytes -= old.audio.length;
    this.replyCache.delete(key); this.replyCache.set(key, { audio, duration_ms }); this.replyCacheBytes += audio.length;
    while (this.replyCache.size > 16 || this.replyCacheBytes > limit) { const first = this.replyCache.keys().next().value; this.replyCacheBytes -= this.replyCache.get(first).audio.length; this.replyCache.delete(first); }
  }
  async synthesize(text, language, actor, { cache = false } = {}) {
    if (this.busy) fail('SPEECH_BUSY', 429);
    this.prune(); if (this.jobs.size >= 20 || [...this.jobs.values()].some(j => j.actor === actor.user_id && j.state === 'queued')) fail('SPEECH_BUSY', 429);
    if (this.closed || !this.ready.tts_ready || !this.ready.reply_languages.includes(language)) fail('VOICE_NOT_READY', 503);
    const id = crypto.randomUUID(); const job = { actor: actor.user_id, state: 'queued', expires: this.home.now() + 90000 }; this.jobs.set(id, job);
    const rate = this.home.preferences(actor).voice_rate;
    const key = cache ? crypto.createHash('sha256').update(JSON.stringify([1, text, language, rate, this.ready.voices, this.ttsProfileHash || 'memory-only'])).digest('hex') : null;
    const cached = key && (this.replyCache.get(key) || (this.ttsProfileHash && this.replyDisk?.get(key)));
    if (cached) {
      this.cacheReply(key, cached.audio, 0);
      job.audio = cached.audio; job.state = 'ready'; job.duration_ms = 0; job.expires = this.home.now() + 60000;
    } else {
      this.run('tts', { text, language, rate }).then(result => { job.audio = Buffer.from(result.audio, 'base64'); job.state = 'ready'; job.duration_ms = result.duration_ms; job.expires = this.home.now() + 60000; if (key && !this.closed && this.ready.tts_ready) { this.cacheReply(key, job.audio, result.duration_ms); if (this.ttsProfileHash) this.replyDisk?.put(key, job.audio); } }).catch(() => { job.state = 'failed'; job.error_code = 'SYNTHESIS_FAILED'; });
    }
    return { job_id: id };
  }
  job(id, actor) { this.prune(); const j = this.jobs.get(id); if (!j || j.actor !== actor.user_id) fail('NOT_FOUND', 404); return { state: j.state, error_code: j.error_code, ...(j.state === 'ready' ? { audio_url: '/api/assistant/audio/' + id, duration_ms: j.duration_ms } : {}) }; }
  audio(id, actor) { this.job(id, actor); const j = this.jobs.get(id); if (j.state !== 'ready') fail('AUDIO_NOT_READY', 409); return j.audio; }
  assets() { const status = this.readiness(); return [{ id: 'whisper-medium-bilingual', provider: 'faster-whisper', languages: ['en', 'hi'], state: status.stt_state, ready: this.ready.stt_ready, active: this.ready.stt_ready, license_status: 'MIT', bytes: this.home.repo.one("SELECT bytes FROM model_assets WHERE id='whisper-medium-bilingual'")?.bytes || null }, { id: 'kokoro-bilingual', provider: 'kokoro-onnx', languages: this.ready.reply_languages, state: status.tts_state, ready: this.ready.tts_ready, active: this.ready.tts_ready, license_status: 'See third-party notices', bytes: this.home.repo.one("SELECT bytes FROM model_assets WHERE id='kokoro-bilingual'")?.bytes || null }]; }
  async activate(id) {
    if (!['whisper-medium-bilingual', 'kokoro-bilingual'].includes(id)) fail('NOT_FOUND', 404);
    if (this.busy) fail('SPEECH_BUSY', 409);
    const kind = id.startsWith('whisper') ? 'stt' : 'tts';
    if (this.ready[kind + '_ready']) return { active_id: id, ready: true };
    if (this.closed || this.config.VOICE_ENABLED === false) fail('VOICE_NOT_READY', 503);
    if (['checking', 'loading'].includes(this.states[kind])) fail('SPEECH_BUSY', 409);
    this.states[kind] = 'checking';
    const previous = this[kind]; this[kind] = null; stopWorker(previous);
    this.home.emitChange();
    let profile;
    try { profile = await require('./assets').verifyProfile(kind, this.config); }
    catch (error) { this.unavailable(kind, error.code === 'ENOENT' ? 'not_configured' : 'failed'); fail('VOICE_NOT_READY', 503); }
    if (this.closed) fail('VOICE_NOT_READY', 503);
    try { this.recordProfile(kind, profile); this.states[kind] = 'loading'; this.home.emitChange(); this.startWorker(kind); }
    catch { this.unavailable(kind); fail('VOICE_NOT_READY', 503); }
    if (this.states[kind] === 'not_configured') fail('VOICE_NOT_READY', 503);
    return { active_id: id, ready: false, state: this.states[kind] };
  }
  prune() { for (const [id, t] of this.tickets) if (t.expires <= this.home.now()) this.tickets.delete(id); for (const [id, j] of this.jobs) if (j.expires <= this.home.now()) this.jobs.delete(id); this.assistant.prune(); }
  close() { this.closed = true; this.states = { stt: 'stopped', tts: 'stopped' }; this.ready.stt_ready = false; this.ready.tts_ready = false; for (const j of this.pending.values()) { clearTimeout(j.timer); j.reject(new Error('STOPPED')); } this.pending.clear(); stopWorker(this.stt); stopWorker(this.tts); this.stt = null; this.tts = null; this.replyCache.clear(); this.replyCacheBytes = 0; this.jobs.clear(); this.tickets.clear(); }
}
module.exports = { SpeechService };
