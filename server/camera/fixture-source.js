const fs = require('node:fs');
const path = require('node:path');
const { FrameSource } = require('./frame-source');

// Generated color bars exercise capture/display plumbing with no personal data.
class FixtureSource extends FrameSource {
  constructor(options = {}) {
    super(options);
    this.image = fs.readFileSync(path.join(__dirname, 'fixture.png'));
    this.timer = null;
  }

  start() {
    this.stop();
    super.start();
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
    this.timer.unref();
  }

  tick() {
    this.publishFrame({ data: this.image, generation: this.generation, sequence: this.sequence + 1 });
  }

  setScenario(scenario) {
    if (scenario === 'live') return this.start();
    clearInterval(this.timer);
    this.timer = null;
    if (scenario === 'stale') this.state = 'stale';
    else this.stop(scenario === 'offline' ? 'unavailable' : 'fault');
  }

  stop(state = 'disabled') {
    clearInterval(this.timer);
    this.timer = null;
    super.stop(state);
  }
}

module.exports = { FixtureSource };
