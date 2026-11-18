const crypto = require('node:crypto');
const { fail } = require('../lib/errors');

// The hub validates transcripts and owns intent/results. Recognition and speech
// belong to the user's browser; no native workers or model files are loaded.
class BrowserSpeechService {
  constructor(home, assistant, config = {}) {
    this.home = home; this.assistant = assistant;
    this.enabled = config.VOICE_ENABLED !== false;
    this.tickets = new Map(); this.closed = false;
  }
  start() {}
  readiness() {
    const enabled = this.enabled && !this.closed && (!this.home.hardwareRequired || this.home.hardwareReady());
    return { provider: 'browser', stt_ready: enabled, tts_ready: enabled,
      stt_state: enabled ? 'browser' : 'disabled', tts_state: enabled ? 'browser' : 'disabled',
      input_languages: ['en', 'hi'], reply_languages: ['en', 'hi'], voices: [] };
  }
  ticket(actor) {
    this.home.assertHardwareReady();
    if (!this.enabled || this.closed) fail('VOICE_NOT_READY', 503);
    this.prune(); if (this.tickets.size >= 50) fail('SPEECH_BUSY', 429);
    const ticket = crypto.randomBytes(24).toString('hex');
    const expires = this.home.now() + 30000;
    this.tickets.set(ticket, { actor: actor.token_hash, expires });
    return { ticket, expires_at: new Date(expires).toISOString(), provider: 'browser' };
  }
  consume(ticket, actor) {
    this.home.assertHardwareReady();
    const value = this.tickets.get(ticket); this.tickets.delete(ticket);
    if (!value || value.actor !== actor.token_hash || value.expires <= this.home.now()) fail('INVALID_VOICE_TICKET', 403);
  }
  async synthesize(text, language, actor) {
    this.home.assertHardwareReady();
    if (!this.enabled || this.closed) fail('VOICE_NOT_READY', 503);
    if (!['en', 'hi'].includes(language)) fail('VALIDATION_ERROR');
    return { provider: 'browser', text, language, rate: this.home.preferences(actor).voice_rate };
  }
  job() { fail('NOT_FOUND', 404); }
  audio() { fail('NOT_FOUND', 404); }
  assets() { return []; }
  activate() { fail('BROWSER_SPEECH_ONLY', 409); }
  prune() { for (const [key, value] of this.tickets) if (value.expires <= this.home.now()) this.tickets.delete(key); }
  close() { this.closed = true; this.tickets.clear(); }
}
module.exports = { BrowserSpeechService };
