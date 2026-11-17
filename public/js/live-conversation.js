// Half-duplex session: never listen while speech output is active. Timers are
// bounded, and speech failures pause instead of treating a timeout as onend.
export class LiveConversation {
  constructor({ listen, changed, expired }) { Object.assign(this, { listen, changed, expired }); this.active = false; this.phase = 'idle'; }
  phaseChanged(phase, timeout = 0) {
    clearTimeout(this.timer); this.phase = phase; this.changed?.(this);
    if (timeout) this.timer = setTimeout(() => { if (this.active) { this.stop(); this.expired?.(); } }, timeout);
  }
  start(firstListen = this.listen) { this.stop(); this.active = true; this.ending = false; this.phaseChanged('listening', 23000); firstListen(); }
  capture(state) { if (this.active && state !== 'ready') this.phaseChanged(state === 'processing' ? 'processing' : 'listening', state === 'processing' ? 15000 : 23000); }
  output(state) {
    if (!this.active) return;
    if (['preparing', 'speaking'].includes(state)) this.phaseChanged('speaking', 65000);
    else if (state === 'finished') {
      if (this.ending) return this.stop();
      this.phaseChanged('waiting');
      this.timer = setTimeout(() => { if (this.active) { this.phaseChanged('listening', 23000); this.listen(); } }, 350);
    } else this.stop();
  }
  stop() { clearTimeout(this.timer); this.active = false; this.phaseChanged('idle'); }
}
