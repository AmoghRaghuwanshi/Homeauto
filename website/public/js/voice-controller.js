import { Api } from './api.js';
export class VoiceCapture {
  constructor({ onState, onIntent, onTranscript, onError, onLevel, onProgress }) { Object.assign(this, { onState, onIntent, onTranscript, onError, onLevel, onProgress }); this.generation = 0; this.ws = null; this.stream = null; this.context = null; this.state = 'ready'; }
  setState(state) { this.state = state; if (state !== 'processing') this.phase = null; this.onState(state); }
  async start(language = 'auto', wakeRequired = false, manualEnd = false) {
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
        let settled = false;
        const settle = error => { if (settled) return; settled = true; clearTimeout(timer); if (this.cancelHandshake === abort) this.cancelHandshake = null; error ? reject(error) : resolve(); };
        const abort = () => settle(new Error('VOICE_CANCELLED'));
        const timer = setTimeout(() => settle(new Error('VOICE_CONNECTION_TIMEOUT')), 5000);
        this.cancelHandshake = abort;
        const connectionFailure = error => { if (generation !== this.generation) return; if (!settled) settle(error); else this.fail(error); };
        ws.onopen = () => { if (generation === this.generation) ws.send(JSON.stringify({ type: 'start', schema_version: 1, ticket, utterance_id: id, format: 'pcm_s16le', sample_rate: 16000, channels: 1, language, wake_required: wakeRequired })); };
        ws.onmessage = event => {
          if (generation !== this.generation) return;
          let msg; try { msg = JSON.parse(event.data); } catch { return; }
          if (msg.type === 'voice_ready') { settle(); }
          else if (msg.type === 'voice_progress' && this.state === 'processing' && msg.utterance_id === this.utterance && ['received','preparing','encoding','decoding'].includes(msg.stage)) { this.phase = msg.stage; this.onProgress?.(msg.stage); }
          else if (msg.type === 'transcript') this.onTranscript(msg.text, msg.lang);
          else if (msg.type === 'intent') { clearTimeout(this.processingDeadline); this.setState('ready'); ws.close(); this.onIntent(msg); }
          else if (msg.type === 'voice_error') {
            if (Array.isArray(msg.transcripts)) this.onTranscript(msg.transcripts.filter(c => typeof c.text === 'string' && ['en','hi'].includes(c.lang)).map(c => `${c.lang === 'hi' ? 'Hindi' : 'English'}: ${c.text}`).join('\n'), msg.language);
            connectionFailure(Object.assign(new Error(msg.code), { code: msg.code }));
          }
        };
        ws.onerror = () => connectionFailure(new Error('VOICE_CONNECTION_FAILED'));
        ws.onclose = () => { if (generation === this.generation && ['permission', 'listening', 'processing'].includes(this.state)) connectionFailure(new Error('VOICE_CONNECTION_LOST')); };
      });
      this.stage='socket'; await ready; if (generation !== this.generation) return;
      this.stage='worklet'; this.context = new AudioContext(); await this.context.audioWorklet.addModule('/js/capture-processor.js');
      if (generation !== this.generation) return;
      this.stage='graph'; this.source = this.context.createMediaStreamSource(stream); this.processor = new AudioWorkletNode(this.context, 'homeauto-capture', { processorOptions: { manualEnd } }); this.gain = this.context.createGain(); this.gain.gain.value = 0;
      this.processor.port.onmessage = event => { if (generation !== this.generation || this.state !== 'listening') return; if (event.data.type === 'level') { this.onLevel?.(event.data.level); } else if (event.data.type === 'audio' && ws.readyState === 1) { if (ws.bufferedAmount > 64000) return this.fail(new Error('AUDIO_BACKPRESSURE')); ws.send(event.data.pcm); } else if (event.data.type === 'end') { if (event.data.no_speech) this.fail(Object.assign(new Error('NO_SPEECH'), { code: 'MICROPHONE_NO_SPEECH' })); else this.end(); } };
      this.source.connect(this.processor).connect(this.gain).connect(this.context.destination); await this.context.resume(); if (generation !== this.generation) return; this.setState('listening'); this.deadline = setTimeout(() => this.end(), 20000);
    } catch (error) { if (generation === this.generation) { if (error.name === 'NotAllowedError') error = { code: 'MICROPHONE_DENIED' }; else if (['NotSupportedError','NotFoundError','NotReadableError'].includes(error.name)) error = { code: 'MICROPHONE_UNAVAILABLE' }; this.fail(error); } }
  }
  cleanupCapture() { clearTimeout(this.deadline); this.processor?.disconnect(); this.source?.disconnect(); this.gain?.disconnect(); this.stream?.getTracks().forEach(t => t.stop()); this.context?.close().catch(() => {}); this.context = null; this.stream = null; this.processor = null; this.source = null; this.gain = null; }
  end() { if (this.state !== 'listening') return; this.cleanupCapture(); this.setState('processing'); const generation = this.generation; this.processingDeadline = setTimeout(() => { if (generation === this.generation && this.state === 'processing') this.fail(Object.assign(new Error('VOICE_RESPONSE_TIMEOUT'), { code: 'VOICE_RESPONSE_TIMEOUT' })); }, 65000); if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'end', utterance_id: this.utterance })); else this.fail(Object.assign(new Error('VOICE_CONNECTION_LOST'), { code: 'VOICE_CONNECTION_LOST' })); }
  cancel(reason) { const active = ['permission','listening','processing'].includes(this.state); this.generation++; clearTimeout(this.processingDeadline); this.cancelHandshake?.(); this.cleanupCapture(); if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: 'cancel', utterance_id: this.utterance })); this.ws?.close(); this.ws = null; this.setState('ready'); if (reason && active) this.onError({ code: reason }); }
  fail(error) { this.cancel(); this.onError(error); }
}
