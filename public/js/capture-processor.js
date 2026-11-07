// Continuous box-filter resampling preserves fractional phase between blocks.
// The muted output keeps the worklet graph running without microphone playback.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.sum = 0; this.weight = 0; this.ratio = sampleRate / 16000; this.frame = []; this.total = 0; this.speech = false; this.silence = 0; this.done = false; }
  process(inputs) {
    if (this.done) return false;
    const samples = inputs[0]?.[0]; if (!samples) return true;
    for (const raw of samples) {
      let remaining = 1;
      while (remaining > 1e-8) {
        const take = Math.min(remaining, this.ratio - this.weight); this.sum += raw * take; this.weight += take; remaining -= take;
        if (this.weight >= this.ratio - 1e-8) { const value = Math.max(-1, Math.min(1, this.sum / this.ratio)); this.frame.push(value); this.sum = 0; this.weight = 0; }
      }
      if (this.frame.length >= 1600) {
        const values = this.frame.splice(0, 1600); this.total += 1600;
        const rms = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);
        if (rms > .009) { this.speech = true; this.silence = 0; } else if (this.speech) this.silence++;
        const pcm = new Int16Array(values.map(v => Math.round(v * (v < 0 ? 32768 : 32767))));
        this.port.postMessage({ type: 'audio', pcm: pcm.buffer }, [pcm.buffer]);
        if (this.total >= 320000 || this.speech && this.silence >= 7 || !this.speech && this.total >= 80000) { this.done = true; this.port.postMessage({ type: 'end', no_speech: !this.speech }); return false; }
      }
    }
    return true;
  }
}
registerProcessor('homeauto-capture', CaptureProcessor);
