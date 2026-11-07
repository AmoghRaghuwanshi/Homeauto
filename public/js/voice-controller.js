import { Api } from './api.js';
export class VoiceCapture {
  constructor({ onState, onIntent, onTranscript, onError }) { Object.assign(this, { onState, onIntent, onTranscript, onError }); this.generation = 0; this.ws = null; this.stream = null; this.context = null; this.state = 'ready'; }
  setState(state) { this.state = state; this.onState(state); }
  async start(language = 'auto', wakeRequired = false) {
    this.cancel(); const generation = ++this.generation;
    try {
      this.stage='ticket'; this.setState('permission'); const { ticket } = await Api.request('/api/assistant/voice-tickets', { method: 'POST', body: {} });
      if (generation !== this.generation) return;
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('Secure microphone context required'), { code: 'VOICE_NOT_READY' });
      this.stage='microphone'; const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; } this.stream = stream;
      const id = crypto.randomUUID(); this.utterance = id;
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/voice`); this.ws = ws;
      const ready = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('VOICE_CONNECTION_TIMEOUT')), 5000);
        ws.onopen = () => ws.send(JSON.stringify({ type: 'start', schema_version: 1, ticket, utterance_id: id, format: 'pcm_s16le', sample_rate: 16000, channels: 1, language, wake_required: wakeRequired }));
        ws.onmessage = event => {
          if (generation !== this.generation) return;
          let msg; try { msg = JSON.parse(event.data); } catch { return; }
          if (msg.type === 'voice_ready') { clearTimeout(timer); resolve(); }
          else if (msg.type === 'transcript') this.onTranscript(msg.text);
          else if (msg.type === 'intent') { this.setState('ready'); ws.close(); this.onIntent(msg); }
          else if (msg.type === 'voice_error') { clearTimeout(timer); const error = Object.assign(new Error(msg.code), { code: msg.code }); reject(error); this.fail(error); }
        };
        ws.onerror = () => { clearTimeout(timer); reject(new Error('VOICE_CONNECTION_FAILED')); };
        ws.onclose = () => { clearTimeout(timer); if (generation === this.generation && ['permission', 'listening', 'processing'].includes(this.state)) this.fail(new Error('VOICE_CONNECTION_LOST')); };
      });
      this.stage='socket'; await ready; if (generation !== this.generation) return;
      this.stage='worklet'; this.context = new AudioContext(); await this.context.audioWorklet.addModule('/js/capture-processor.js');
      if (generation !== this.generation) return;
      this.stage='graph'; this.source = this.context.createMediaStreamSource(stream); this.processor = new AudioWorkletNode(this.context, 'homeauto-capture'); this.gain = this.context.createGain(); this.gain.gain.value = 0;
      this.processor.port.onmessage = event => { if (generation !== this.generation || this.state !== 'listening') return; if (event.data.type === 'audio' && ws.readyState === 1) { if (ws.bufferedAmount > 64000) return this.fail(new Error('AUDIO_BACKPRESSURE')); ws.send(event.data.pcm); } else if (event.data.type === 'end') { if (event.data.no_speech) this.fail(Object.assign(new Error('NO_SPEECH'), { code: 'RECOGNITION_UNCLEAR' })); else this.end(); } };
      this.source.connect(this.processor).connect(this.gain).connect(this.context.destination); await this.context.resume(); this.setState('listening'); this.deadline = setTimeout(() => this.end(), 20000);
    } catch (error) { if (generation === this.generation) { if (error.name === 'NotAllowedError') error = { code: 'MICROPHONE_DENIED' }; else if (['NotSupportedError','NotFoundError','NotReadableError'].includes(error.name)) error = { code: 'MICROPHONE_UNAVAILABLE' }; this.fail(error); } }
  }
  cleanupCapture() { clearTimeout(this.deadline); this.processor?.disconnect(); this.source?.disconnect(); this.gain?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); this.context?.close().catch(() => {}); this.context = null; this.stream = null; }
  end() { if (this.state !== 'listening') return; this.cleanupCapture(); this.setState('processing'); if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'end', utterance_id: this.utterance })); }
  cancel() { this.generation++; this.cleanupCapture(); if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'cancel', utterance_id: this.utterance })); this.ws?.close(); this.ws = null; this.setState('ready'); }
  fail(error) { this.cancel(); this.onError(error); }
}
