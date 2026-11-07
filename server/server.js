const { startRuntime } = require('./lifecycle');
if (require.main === module) {
  startRuntime().then(runtime => {
    const secure = !!runtime.server.setSecureContext;
    console.log(`HomeAuto: ${secure ? 'https' : 'http'}://127.0.0.1:${runtime.server.address().port}`);
    console.log('Local owner setup: stop the hub, then npm run setup -- add-user YOUR_NAME owner');
    console.log('MQTT and door actuation require explicit operator configuration.');
    let stopping = false;
    const stop = async () => { if (stopping) return; stopping = true; await runtime.stop(); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
  }).catch(error => { console.error('HomeAuto startup failed:', error.message); process.exitCode = 1; });
}
module.exports = require('./lifecycle');
