import { Api } from './api.js';
import './assistant-language.js';

export const recognitionConstructor = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export function browserVoiceAvailable() { return !!recognitionConstructor() && globalThis.isSecureContext !== false; }
export function recognitionLocale(language, appLanguage = 'en') {
  return (language === 'auto' ? appLanguage : language) === 'hi' ? 'hi-IN' : 'en-IN';
}

// Web Speech chooses one recognition language. Automatic follows the app
// language; the recognized script determines the automatic reply language.
export class BrowserVoiceCapture {
  constructor({ onState, onIntent, onTranscript, onError, getLanguage = () => 'en' }) {
    Object.assign(this, { onState, onIntent, onTranscript, onError, getLanguage });
    this.generation = 0; this.state = 'ready';
  }
  setState(state) { this.state = state; this.onState?.(state); }
  async start(language = 'auto', wakeRequired = false, { text: suppliedText } = {}) {
    this.cancel(); const generation = ++this.generation;
    const current = () => generation === this.generation;
    try {
      if (!browserVoiceAvailable()) throw { code: 'BROWSER_RECOGNITION_UNAVAILABLE' };
      this.setState('permission');
      const { ticket } = await Api.request('/api/assistant/voice-tickets', { method: 'POST', body: {} });
      if (!current()) return;
      this.utterance = crypto.randomUUID(); this.finalText = '';
      const ws = this.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/voice`);
      const ready = new Promise((resolve, reject) => {
        let settled = false;
        const settle = error => { if (settled) return; settled = true; clearTimeout(timer); this.cancelHandshake = null; error ? reject(error) : resolve(); };
        const timer = setTimeout(() => settle({ code: 'VOICE_CONNECTION_TIMEOUT' }), 5000);
        this.cancelHandshake = () => settle({ code: 'VOICE_CANCELLED' });
        const failure = error => { if (!current()) return; if (!settled) settle(error); else this.fail(error); };
        ws.onopen = () => { if (current()) ws.send(JSON.stringify({ type: 'start', schema_version: 1, ticket,
          utterance_id: this.utterance, format: 'browser_text', language, wake_required: wakeRequired })); };
        ws.onmessage = event => {
          if (!current()) return;
          let msg; try { msg = JSON.parse(event.data); } catch { return; }
          if (msg.utterance_id !== this.utterance) return;
          if (msg.type === 'voice_ready') settle();
          else if (msg.type === 'transcript') this.onTranscript?.(msg.text, msg.lang);
          else if (msg.type === 'intent') { this.cancel(); this.onIntent?.(msg); }
          else if (msg.type === 'voice_error') { if (msg.language) this.onTranscript?.(this.finalText, msg.language); failure({ code: msg.code }); }
        };
        ws.onerror = () => failure({ code: 'VOICE_CONNECTION_FAILED' });
        ws.onclose = () => failure({ code: 'VOICE_CONNECTION_LOST' });
      });
      await ready; if (!current()) return;
      const submit = () => {
        this.setState('processing');
        this.responseDeadline = setTimeout(() => { if (current()) this.fail({ code: 'VOICE_RESPONSE_TIMEOUT' }); }, 8000);
        ws.send(JSON.stringify({ type: 'transcript', utterance_id: this.utterance, text: this.finalText }));
      };
      if (typeof suppliedText === 'string') {
        if (!suppliedText.trim() || suppliedText.length > 500) throw { code: 'VOICE_REQUEST_TOO_LONG' };
        this.finalText = suppliedText; this.onTranscript?.(suppliedText, globalThis.HomeAutoLanguage.inputLanguage(suppliedText, language)); submit(); return;
      }
      const locale = recognitionLocale(language, this.getLanguage());
      const startRecognition = local => {
        if (!current()) return;
        const recognition = this.recognition = new (recognitionConstructor())();
        recognition.lang = locale;
        if (local) recognition.processLocally = true;
        recognition.continuous = false; recognition.interimResults = true; recognition.maxAlternatives = 1;
        recognition.onstart = () => { if (current() && this.recognition === recognition) this.setState('listening'); };
        recognition.onresult = event => {
        if (!current() || this.recognition !== recognition) return;
        let final = '', interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const value = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) final += value + ' '; else interim += value + ' ';
        }
        this.finalText = final.trim();
        const text = (final + interim).trim();
        if (text.length > 500) return this.fail({ code: 'VOICE_REQUEST_TOO_LONG' });
        this.onTranscript?.(text, globalThis.HomeAutoLanguage.inputLanguage(text, language));
        };
        recognition.onerror = async event => {
        if (!current() || this.recognition !== recognition) return;
        if (event.error === 'network' && !local && 'processLocally' in recognition &&
            typeof recognitionConstructor().available === 'function' && !this.finalText) {
          recognition.onend = recognition.onerror = null;
          clearTimeout(this.deadline);
          this.setState('permission');
          try {
            const availability = await recognitionConstructor().available({ langs: [locale], processLocally: true });
            if (!current()) return;
            if (availability === 'available') { startRecognition(true); return; }
          } catch { if (!current()) return; }
        }
        const code = ({ 'not-allowed': 'MICROPHONE_DENIED', 'service-not-allowed': 'MICROPHONE_DENIED',
          'audio-capture': 'MICROPHONE_UNAVAILABLE', 'no-speech': 'MICROPHONE_NO_SPEECH',
          'network': 'BROWSER_RECOGNITION_NETWORK', 'language-not-supported': 'BROWSER_LANGUAGE_UNAVAILABLE',
          'aborted': 'VOICE_CANCELLED' })[event.error] || 'BROWSER_RECOGNITION_FAILED';
        this.fail({ code });
        };
        recognition.onend = () => {
        if (!current() || this.recognition !== recognition) return;
        clearTimeout(this.deadline); clearTimeout(this.endDeadline);
        this.recognition = null;
        if (!this.finalText) return this.fail({ code: 'MICROPHONE_NO_SPEECH' });
        if (ws.readyState !== 1) return this.fail({ code: 'VOICE_CONNECTION_LOST' });
        submit();
        };
        recognition.start();
        this.deadline = setTimeout(() => { if (current()) this.end(); }, 18000);
      };
      startRecognition(false);
    } catch (error) { if (current()) this.fail(error); }
  }
  submit(text, language = 'auto') { return this.start(language, false, { text }); }
  end() {
    if (!['listening', 'permission'].includes(this.state) || !this.recognition) return;
    this.setState('processing'); clearTimeout(this.deadline);
    try { this.recognition.stop(); } catch { this.fail({ code: 'BROWSER_RECOGNITION_FAILED' }); return; }
    const generation = this.generation;
    this.endDeadline = setTimeout(() => { if (generation === this.generation) this.fail({ code: 'VOICE_RESPONSE_TIMEOUT' }); }, 3000);
  }
  cancel(reason) {
    const active = this.state !== 'ready'; this.generation++;
    clearTimeout(this.deadline); clearTimeout(this.endDeadline); clearTimeout(this.responseDeadline);
    this.cancelHandshake?.(); this.cancelHandshake = null;
    if (this.recognition) { this.recognition.onend = this.recognition.onerror = this.recognition.onresult = this.recognition.onstart = null; try { this.recognition.abort(); } catch {} }
    this.recognition = null;
    const ws = this.ws; this.ws = null;
    if (ws) { ws.onclose = ws.onerror = ws.onmessage = ws.onopen = null; if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'cancel', utterance_id: this.utterance })); ws.close(); }
    this.setState('ready'); if (reason && active) this.onError?.({ code: reason });
  }
  fail(error) { this.cancel(); this.onError?.(error); }
}

export function browserSpeechAvailable() { return !!globalThis.speechSynthesis && !!globalThis.SpeechSynthesisUtterance; }
export const browserVoiceKey = voice => JSON.stringify([voice.voiceURI || voice.name || '', voice.lang.toLowerCase().replaceAll('_', '-'), !!voice.localService]);
export function matchingBrowserVoices(language, voices = globalThis.speechSynthesis?.getVoices() || []) {
  // Web Speech has no gender or quality metadata. Prefer voices whose published
  // names identify a natural female voice, then keep the local/Indian fallback.
  const femaleName = /\b(female|aria|jenny|sonia|neerja|swara|zira|hazel)\b/i;
  const score = voice => {
    const name = voice.name || '';
    const female = femaleName.test(name) && !/\bmale\b/i.test(name);
    return Number(female && /\bnatural\b/i.test(name)) * 16 + Number(female) * 8 +
      Number(!!voice.localService) * 4 + Number(voice.lang.toLowerCase().replaceAll('_', '-') === language + '-in') * 2 + Number(!!voice.default);
  };
  return voices.filter(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === language).sort((a, b) => score(b) - score(a));
}
export function selectBrowserVoice(language, preferred, voices) {
  const matching = matchingBrowserVoices(language, voices);
  return matching.find(voice => browserVoiceKey(voice) === preferred) || matching[0];
}
export class BrowserSpeechOutput {
  constructor() { this.generation = 0; }
  stop() {
    this.generation++; this.abortWait?.(); this.abortWait = null;
    clearTimeout(this.deadline); globalThis.speechSynthesis?.cancel(); this.utterance = null;
  }
  async speak({ text, language, rate = 1, volume = 1, voiceKey = '' }, onState = () => {}) {
    this.stop(); const generation = this.generation;
    if (!browserSpeechAvailable()) throw { code: 'BROWSER_SPEECH_UNAVAILABLE' };
    const synth = globalThis.speechSynthesis;
    let voices = synth.getVoices();
    if (!matchingBrowserVoices(language, voices).length) {
      await new Promise(resolve => {
        const changed = () => { if (matchingBrowserVoices(language).length) done(); };
        const done = () => { clearTimeout(timer); synth.removeEventListener?.('voiceschanged', changed); if (this.abortWait === done) this.abortWait = null; resolve(); };
        const timer = setTimeout(done, 1500); this.abortWait = done; synth.addEventListener?.('voiceschanged', changed);
      });
      if (generation !== this.generation) return;
      voices = synth.getVoices();
    }
    const voice = selectBrowserVoice(language, voiceKey, voices);
    if (!voice) throw { code: 'BROWSER_VOICE_MISSING' };
    const utterance = this.utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang; utterance.voice = voice;
    utterance.rate = Number.isFinite(rate) ? Math.max(.8, Math.min(1.2, rate)) : 1;
    utterance.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
    utterance.pitch = 1;
    const active = () => generation === this.generation;
    const finish = state => { if (!active() || this.utterance !== utterance) return; clearTimeout(this.deadline); this.utterance = null; onState(state); };
    utterance.onstart = () => { if (active()) onState('speaking'); };
    utterance.onend = () => finish('finished');
    utterance.onerror = event => finish(event.error === 'not-allowed' ? 'blocked' : 'failed');
    this.deadline = setTimeout(() => { if (active()) { this.stop(); onState('failed'); } }, 60000);
    onState('preparing'); synth.speak(utterance);
  }
}
