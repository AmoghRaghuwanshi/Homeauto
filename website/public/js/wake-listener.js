import { recognitionConstructor, browserVoiceAvailable, recognitionLocale } from './browser-voice.js';
import './assistant-language.js';

// Opt-in, visible-page recognition only. Ambient transcripts never leave this
// class for HomeAuto's hub. The browser's own recognition service may be online.
export class WakeListener {
  constructor({ getLanguage, canListen, onState, onWake, onError }) {
    Object.assign(this, { getLanguage, canListen, onState, onWake, onError });
    this.enabled = false; this.paused = false; this.generation = 0; this.state = 'off'; this.ends = [];
  }
  setState(value) { this.state = value; this.onState?.(value); }
  start(language = 'auto') {
    this.stop();
    if (!browserVoiceAvailable()) { this.onError?.({ code: 'BROWSER_RECOGNITION_UNAVAILABLE' }); return; }
    this.enabled = true; this.language = language; this.ends = []; this.resume();
  }
  dispose() {
    clearTimeout(this.restart); clearTimeout(this.endDeadline);
    const r = this.recognition; this.recognition = null;
    if (r) { r.onstart = r.onresult = r.onerror = r.onend = null; try { r.abort(); } catch {} }
  }
  pause() { this.generation++; this.paused = true; this.dispose(); this.setState(this.enabled ? 'paused' : 'off'); }
  stop() { this.enabled = false; this.pause(); }
  resume() {
    if (!this.enabled || this.recognition || !this.canListen()) return;
    this.paused = false; const generation = ++this.generation;
    const current = () => generation === this.generation && this.enabled && !this.paused;
    const open = () => {
      if (!current() || !this.canListen()) return;
      let recognition;
      try { recognition = this.recognition = new (recognitionConstructor())(); } catch { return this.fail({ code: 'BROWSER_RECOGNITION_FAILED' }); }
      recognition.lang = recognitionLocale(this.language, this.getLanguage());
      recognition.continuous = true; recognition.interimResults = false; recognition.maxAlternatives = 1;
      let wake = null, handled = -1;
      const ownsRecognition = () => current() && this.recognition === recognition;
      recognition.onstart = () => { if (ownsRecognition()) this.setState('listening'); };
      recognition.onresult = event => {
        if (!ownsRecognition() || wake) return;
        if (!this.canListen()) { this.pause(); return; }
        for (let i = event.resultIndex || 0; i < event.results.length; i++) {
          if (!event.results[i].isFinal || i <= handled) continue;
          handled = i; const text = event.results[i][0]?.transcript || '';
          const match = globalThis.HomeAutoLanguage.wakePhrase(text);
          if (!match.found) continue;
          if (text.length > 500) return this.fail({ code: 'VOICE_REQUEST_TOO_LONG' });
          wake = { ...match, language: globalThis.HomeAutoLanguage.inputLanguage(match.command || text, this.language) };
          this.setState('activating');
          this.endDeadline = setTimeout(() => { if (ownsRecognition()) this.fail({ code: 'VOICE_RESPONSE_TIMEOUT' }); }, 3000);
          try { recognition.stop(); } catch { this.fail({ code: 'BROWSER_RECOGNITION_FAILED' }); }
          break;
        }
      };
      recognition.onerror = event => {
        if (!ownsRecognition() || event.error === 'no-speech') return;
        const code = ({ 'not-allowed': 'MICROPHONE_DENIED', 'service-not-allowed': 'BROWSER_RECOGNITION_SERVICE_DENIED', 'network': 'BROWSER_RECOGNITION_NETWORK', 'audio-capture': 'MICROPHONE_UNAVAILABLE', 'language-not-supported': 'BROWSER_LANGUAGE_UNAVAILABLE' })[event.error] || 'BROWSER_RECOGNITION_FAILED';
        this.fail({ code });
      };
      recognition.onend = () => {
        if (!ownsRecognition()) return;
        clearTimeout(this.endDeadline); this.recognition = null;
        if (wake) { this.paused = true; this.generation++; this.setState('paused'); this.onWake?.(wake); return; }
        const now = Date.now(); this.ends = this.ends.filter(at => now - at < 10000); this.ends.push(now);
        if (this.ends.length > 6) return this.fail({ code: 'WAKE_LISTENING_STOPPED' });
        this.restart = setTimeout(open, 350);
      };
      this.setState('starting');
      try { recognition.start(); } catch { this.fail({ code: 'BROWSER_RECOGNITION_FAILED' }); }
    };
    open();
  }
  fail(error) { this.stop(); this.onError?.(error); }
}
