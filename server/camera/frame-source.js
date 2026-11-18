const crypto = require('node:crypto');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_FRAME_BYTES = 1024 * 1024;

class FrameSource {
  constructor({ now = Date.now, maxAgeMs = 1500 } = {}) {
    this.now = now;
    this.maxAgeMs = maxAgeMs;
    this.state = 'disabled';
    this.generation = null;
    this.frame = null;
    this.sequence = 0;
  }

  start() {
    this.generation = crypto.randomUUID();
    this.sequence = 0;
    this.frame = null;
    this.state = 'connecting';
  }

  publishFrame({ data, sequence, generation }) {
    if (!['connecting', 'live'].includes(this.state)) return false;
    if (generation !== this.generation || !Number.isSafeInteger(sequence) || sequence <= this.sequence) return false;
    if (!Buffer.isBuffer(data) || data.length < 24 || data.length > MAX_FRAME_BYTES) return false;
    if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
    this.sequence = sequence;
    this.frame = { data: Buffer.from(data), sequence, generation, receivedAt: this.now() };
    this.state = 'live';
    return true;
  }

  health() {
    const age = this.frame ? this.now() - this.frame.receivedAt : null;
    const state = this.state === 'live' && (age === null || age < 0 || age > this.maxAgeMs) ? 'stale' : this.state;
    return { state, generation: this.generation, sequence: this.sequence,
      received_at: this.frame ? new Date(this.frame.receivedAt).toISOString() : null };
  }

  latestFrame() {
    if (this.health().state !== 'live') return null;
    return { ...this.frame, data: Buffer.from(this.frame.data) };
  }

  stop(state = 'disabled') {
    this.state = state;
    this.frame = null;
    this.generation = null;
    this.sequence = 0;
  }
}

module.exports = { FrameSource };
