const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { loadGatewayConfig } = require('../online/gateway');
function gatewayEnvironment(filename) {
  let config;
  try { const raw=fs.readFileSync(filename);if(raw.length>16384)throw new Error();config=JSON.parse(raw); } catch { throw new Error('Could not read the gateway connection file.'); }
  if(!config || config.version!==1 || typeof config.expires_at!=='string' || Date.parse(config.expires_at)<=Date.now() || !Number.isFinite(Date.parse(config.expires_at)))throw new Error('The gateway connection file has expired or is invalid.');
  const settings={HOMEAUTO_GATEWAY_ENABLED:'1',HOMEAUTO_GATEWAY_CONSENT:'telemetry-v1',HOMEAUTO_HOUSEHOLD_ID:config.household_id,HOMEAUTO_GATEWAY_ID:config.gateway_id,HOMEAUTO_GATEWAY_TOKEN:config.gateway_token,HOMEAUTO_GATEWAY_ORIGIN:config.origin,HOMEAUTO_REMOTE_LIGHTS_ENABLED:'0',HOMEAUTO_SECURE_GATEWAY_APPROVED:'0',HOMEAUTO_DOOR_ENABLED:'0',HOMEAUTO_CLOUD_SYNC_ENABLED:'0'};
  loadGatewayConfig(settings);return settings;
}
function main(filename) {
  if(!filename)throw new Error('Usage: node server/scripts/with-gateway.js PATH_TO_CONNECTION_FILE');
  const env={...process.env,...gatewayEnvironment(filename)};
  const child=spawn(process.execPath,[path.resolve(__dirname,'../server.js')],{env,stdio:'inherit'});
  process.once('SIGINT',()=>child.kill('SIGINT'));process.once('SIGTERM',()=>child.kill('SIGTERM'));
  child.on('error',()=>{console.error('Could not start the home hub.');process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
}
if(require.main===module){try{main(process.argv[2]);}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={gatewayEnvironment};
