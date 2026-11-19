const { createPreview } = require('./preview');
const { fail } = require('../lib/errors');

async function startSimulation({ port = 3002 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid simulation port');
  // A loopback-only in-memory home. The fixture supplies no MQTT client,
  // durable DB, saved module store, gateway credentials or real camera source.
  const fixture = await createPreview({ port, voice: true, cameraMode: 'fixture' });
  // A hidden or hand-written API request must not turn simulation into a LAN probe.
  fixture.runtime.modules.configure = async () => fail('SIMULATION_ONLY', 409);
  fixture.runtime.modules.connect = async () => fail('SIMULATION_ONLY', 409);
  return fixture;
}

if (require.main === module) {
  startSimulation({ port: Number(process.env.HOMEAUTO_SIMULATION_PORT || 3002) }).then(fixture => {
    console.log('HomeAuto simulation: ' + fixture.url);
    console.log('No physical devices are connected. Camera frames are generated test images.');
    let stopping = false;
    const stop = async () => { if (!stopping) { stopping = true; await fixture.runtime.stop(); } };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  }).catch(error => { console.error('Simulation startup failed:', error.message); process.exitCode = 1; });
}

module.exports = { startSimulation };
