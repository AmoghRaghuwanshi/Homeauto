const crypto = require('crypto');
const { resolveCommand } = require('../voice/intent');
const { authorize } = require('../auth/sessions');
const { fail, uuid } = require('../lib/errors');
function queryText(devices,language){const labels={on:'चालू',off:'बंद',locked:'लॉक',unlocked:'अनलॉक',normal:'सामान्य',alert:'चेतावनी',clear:'हलचल नहीं',detected:'हलचल हुई'};return devices.map(d=>`${d.name}: ${d.observation.freshness==='current'?(language==='hi'?labels[d.observation.reported_status]||'स्थिति उपलब्ध नहीं है':d.observation.reported_status):language==='hi'?'स्थिति उपलब्ध नहीं है':'status unavailable'}`).join('. ');}
class Assistant {
  constructor(home) { this.home = home; this.intents = new Map(); this.answers = new Map(); }
  interpret(text, actor) {
    const { home } = this;
    const parsed = resolveCommand(text, home.repo.getDevices(), home.rooms(), home.repo.all('SELECT * FROM room_aliases WHERE confirmed=1'));
    if (!parsed.ok) fail('INTENT_' + parsed.reason.toUpperCase(), 422, parsed.reason, { choices: parsed.choices });
    const id = crypto.randomUUID(); const expires = home.now() + 30000;
    if (this.intents.size >= 100) this.prune();
    if (this.intents.size >= 100) fail('ASSISTANT_BUSY', 429);
    this.intents.set(id, { actor: actor.user_id, session: actor.token_hash, intent: parsed.intent, expires, result: null, key: null });
    return { intent: parsed.intent, intent_id: id, expires_at: new Date(expires).toISOString() };
  }
  execute(id, key, actor) {
    if (!uuid(key)) fail('INVALID_IDEMPOTENCY_KEY');
    const stored = this.intents.get(id);
    if (!stored || stored.actor !== actor.user_id || stored.session !== actor.token_hash || stored.expires <= this.home.now()) fail('INTENT_EXPIRED', 409);
    const intent = stored.intent;
    authorize(actor, intent.kind === 'query' ? 'read' : 'control');
    if (stored.result) { if (key !== stored.key) fail('INTENT_ALREADY_USED', 409); return stored.result; }
    if (intent.sensitive) fail('SENSITIVE_ACTION_REQUIRES_UI', 403);
    if (intent.kind === 'query') {
      const devices = intent.device_ids.map(d => this.home.device(d));
      const result_id = crypto.randomUUID();
      const language = this.home.preferences(actor).reply_language === 'auto' ? intent.language === 'hi' ? 'hi' : 'en' : this.home.preferences(actor).reply_language;
      const text = queryText(devices,language);
      const answer = { result_id, message_key: 'query_result', text, language };
      this.answers.set(result_id, { actor: actor.user_id, answer, devices, expires: this.home.now() + 60000 });
      stored.result = { answer };
    } else {
      // Stable per-device keys make repeated group execution safe even after a partial error.
      const commands = [], errors = [];
      for (const device of intent.device_ids) {
        const bytes = crypto.createHash('sha256').update(key + device).digest('hex');
        const derived = `${bytes.slice(0, 8)}-${bytes.slice(8, 12)}-4${bytes.slice(13, 16)}-8${bytes.slice(17, 20)}-${bytes.slice(20, 32)}`;
        try { commands.push(this.home.request(device, { action: intent.action, idempotency_key: derived }, actor, 'assistant')); }
        catch (e) { errors.push({ device_id: device, code: e.code || 'INTERNAL_ERROR' }); }
      }
      const result_id = crypto.randomUUID();
      const preferred = this.home.preferences(actor).reply_language;
      const language = preferred === 'auto' ? intent.language === 'hi' ? 'hi' : 'en' : preferred;
      this.answers.set(result_id, { actor: actor.user_id, commandIds: commands.map(c => c.id), errors, expires: this.home.now() + 60000 });
      stored.result = { commands, errors, result_id, language };
    }
    stored.key = key; return stored.result;
  }
  speechText(id, actor, language) {
    const c = this.home.command(id);
    if (c) {
      if (c.actor_id !== actor.user_id && actor.role !== 'owner') fail('NOT_FOUND', 404);
      const d = this.home.device(c.device_id);
      return c.state === 'observed' ? language === 'hi' ? `${d.name}: पहले मिली कंट्रोलर रिपोर्ट (${c.observed_at}): ${c.action === 'on' ? 'चालू' : c.action === 'off' ? 'बंद' : c.action === 'lock' ? 'लॉक' : 'अनलॉक'}। वास्तविक लॉक की स्थिति मापी नहीं जाती।` : `Earlier controller report for ${d.name} at ${c.observed_at}: ${c.action}. Physical lock position is not sensed.` : language === 'hi' ? 'बदलाव की पुष्टि अभी नहीं हुई है। कृपया स्थिति जाँचें।' : 'The change has not been confirmed. Please check its status.';
    }
    const a = this.answers.get(id); if (!a || a.actor !== actor.user_id || a.expires <= this.home.now()) fail('RESULT_EXPIRED', 410);
    if (a.commandIds) return [...a.commandIds.map(command => this.speechText(command, actor, language)), ...a.errors.map(error => language === 'hi' ? `${this.home.device(error.device_id)?.name || error.device_id}: अनुरोध पूरा नहीं हुआ (${error.code})।` : `${this.home.device(error.device_id)?.name || error.device_id}: request failed (${error.code}).`)].join(' ');
    return queryText(a.devices.map(d => this.home.device(d.id)),language);
  }
  prune() { for (const [k, v] of this.intents) if (v.expires <= this.home.now()) this.intents.delete(k); for (const [k, v] of this.answers) if (v.expires <= this.home.now()) this.answers.delete(k); }
}
module.exports = { Assistant };
