const { fail } = require('../lib/errors');
const { FixtureSource } = require('./fixture-source');

class CameraService {
  constructor({ mode = 'disabled', simulation = false, now = Date.now } = {}) {
    this.source = null;
    this.reason = null;
    if (mode === 'fixture' && simulation) {
      try { this.source = new FixtureSource({ now }); }
      catch { this.reason = 'CAMERA_START_FAILED'; }
    } else if (mode === 'fixture') this.reason = 'SIMULATION_REQUIRED';
    else if (mode !== 'disabled') this.reason = 'CAMERA_MODE_UNSUPPORTED';
  }

  start() {
    try { this.source?.start(); }
    catch {
      this.source?.stop('fault');
      this.reason = 'CAMERA_START_FAILED';
    }
  }

  status() {
    return { schema_version: 1, mode: this.source ? 'fixture' : 'disabled',
      ...(this.source?.health() || { state: 'disabled', generation: null, sequence: 0, received_at: null }),
      reason: this.reason, simulated: !!this.source,
      capabilities: { preview: !!this.source, face_verification: false, vehicle_recognition: false, recording: false, unlock: false } };
  }

  frame() {
    const frame = this.source?.latestFrame();
    if (!frame) fail('CAMERA_FRAME_UNAVAILABLE', 503);
    return frame;
  }

  scenario(value) {
    if (!this.source) fail('CAMERA_SIMULATION_UNAVAILABLE', 409);
    if (!['live', 'stale', 'offline', 'fault'].includes(value)) fail('VALIDATION_ERROR');
    this.source.setScenario(value);
    return this.status();
  }

  close() { this.source?.stop(); }
}

module.exports = { CameraService };
