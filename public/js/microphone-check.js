import { el, button, modal } from './components.js';
import { t, errorText } from './i18n.js';

// Samples input levels only. Audio never reaches a server or speech provider.
export class MicrophoneCheck {
  constructor({ onState, onLevel, onDevice, onResult, onError } = {}) {
    Object.assign(this, { onState, onLevel, onDevice, onResult, onError });
    this.generation = 0;
  }
  stop() {
    this.generation++;
    clearInterval(this.interval); clearTimeout(this.deadline);
    this.source?.disconnect(); this.source = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.audio?.close().catch(() => {}); this.audio = null;
    this.onLevel?.(0);
  }
  async start() {
    this.stop(); const generation = this.generation;
    const current = () => generation === this.generation;
    let stream;
    try {
      if (!globalThis.navigator?.mediaDevices?.getUserMedia || globalThis.isSecureContext === false) throw { code: 'BROWSER_CAPTURE_UNAVAILABLE' };
      this.onState?.('permission');
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      let resumed;
      if (Audio) {
        this.audio = new Audio();
        resumed = this.audio.resume().catch(() => {});
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      this.onDevice?.(stream.getAudioTracks()[0]?.label || t('Default microphone'));
      const finish = sound => {
        if (!current()) return;
        this.stop(); this.onState?.('finished'); this.onResult?.(sound);
      };
      // Always release input, even if the audio context remains suspended.
      this.deadline = setTimeout(() => finish(null), 8000);
      if (!this.audio) { finish(null); return; }
      await resumed;
      if (!current()) return;
      if (this.audio.state !== 'running') { finish(null); return; }
      const analyser = this.audio.createAnalyser(); analyser.fftSize = 2048;
      this.source = this.audio.createMediaStreamSource(stream); this.source.connect(analyser);
      const values = new Float32Array(analyser.fftSize);
      let peak = 0;
      this.onState?.('listening');
      this.interval = setInterval(() => {
        if (!current()) return;
        analyser.getFloatTimeDomainData(values);
        const rms = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
        peak = Math.max(peak, rms); this.onLevel?.(Math.min(1, rms * 8));
      }, 100);
      clearTimeout(this.deadline);
      this.deadline = setTimeout(() => finish(peak >= .01), 6000);
    } catch (error) {
      if (!current()) return;
      this.stop();
      const code = typeof error.code === 'string' ? error.code : (['NotAllowedError', 'SecurityError'].includes(error.name) ? 'MICROPHONE_DENIED' : 'MICROPHONE_UNAVAILABLE');
      this.onState?.('failed'); this.onError?.({ code });
    }
  }
}

export function showMicrophoneCheck() {
  const status = el('p', { role: 'status', 'aria-live': 'polite' }, t('Test the microphone before speech recognition.'));
  const device = el('p', { class: 'small muted' });
  const meter = el('meter', { min: 0, max: 1, value: 0, 'aria-label': t('Microphone level') });
  let start;
  const check = new MicrophoneCheck({
    onState: state => {
      start.disabled = ['permission', 'listening'].includes(state);
      if (state === 'permission') status.textContent = t('Allow microphone access for this address if your browser asks.');
      if (state === 'listening') status.textContent = t('Speak now for six seconds. Watch the microphone level.');
    },
    onDevice: label => { device.textContent = t('Active microphone') + ': ' + label; },
    onLevel: value => { meter.value = value; },
    onResult: sound => { status.textContent = t(sound === null ? 'Microphone access works. Audio levels could not be tested in this browser.' : sound ? 'Sound detected. Microphone access works. If words are still missing, check the speech language or try Chrome.' : 'No sound detected. Select your physical microphone in browser settings and check its input volume.'); },
    onError: error => { status.textContent = errorText(error); },
  });
  start = button('Start microphone test', () => { device.textContent = ''; check.start(); });
  const content = el('div', { class: 'stack' },
    el('p', { class: 'small muted' }, t('Current address') + ': ' + location.origin), status, device, meter, start,
    el('p', { class: 'small muted' }, t('This test stays in your browser. No audio is saved or sent.')),
    el('p', { class: 'small muted' }, t('In Chrome or Edge, open site controls beside the address, set Microphone to Allow, choose your physical microphone, then reload. Localhost and the online domain need separate permissions.')),
    el('p', { class: 'small muted' }, t('For voice, open this address in a regular Chrome or Edge window. An embedded browser may not provide a speech service.')));
  const dialog = modal('Test microphone', content, { readOnly: true, confirmLabel: 'Close' });
  const pause = () => { check.stop(); start.disabled = false; status.textContent = t('Microphone test stopped.'); };
  const hidden = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', hidden);
  window.addEventListener('pagehide', pause);
  dialog.addEventListener('close', () => {
    check.stop(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pause);
  }, { once: true });
  return dialog;
}
