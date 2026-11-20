// Generates private board headers. Input JSON must be stored outside Git.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
function configure(filename, destination = path.resolve(__dirname, '../firmware')) {
  const config = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!config.ssid || typeof config.wifi_password !== 'string' || !net.isIPv4(config.broker_ip)) throw Error('SSID, Wi-Fi password and broker IPv4 are required.');
  const ca = fs.readFileSync(config.ca_file, 'utf8');
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || ca.includes('PRIVATE KEY')) throw Error('Provide only the broker CA certificate.');
  const boards = [['light_controller', 'esp32-lights', config.lights_password], ...(config.board === 'lights' ? [] : [['door_security', 'esp32-door', config.door_password]])];
  for (const [folder, username, password] of boards) {
    if (typeof password !== 'string' || password.length < 20) throw Error('Each board needs its own MQTT password of at least 20 characters.');
    const values = {WIFI_SSID:config.ssid,WIFI_PASSWORD:config.wifi_password,MQTT_SERVER:config.broker_ip,MQTT_CLIENT:username,MQTT_USERNAME:username,MQTT_PASSWORD:password,MQTT_CA_CERT:ca};
    const header = '#pragma once\n// Private installation settings; never commit.\n' + Object.entries(values).map(([name,value]) => `const char* ${name} = ${JSON.stringify(value)};`).join('\n') + '\nconst int MQTT_PORT = 8883;\n#define HOMEAUTO_MOTION_ENABLED ' + (config.motion_enabled === false ? '0' : '1') + '\n';
    fs.mkdirSync(path.join(destination,folder),{recursive:true});
    const target=path.join(destination,folder,'homeauto_config.h');
    fs.writeFileSync(target,header,{mode:0o600});
    if(process.platform==='win32'){
      const result=require('node:child_process').spawnSync('icacls',[target,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:F`],{windowsHide:true,encoding:'utf8'});
      if(result.status!==0)throw Error('Could not restrict private firmware header access.');
    }
  }
  console.log('Private board headers generated. No credentials printed.');
}
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node scripts/configure-firmware.js PRIVATE_JSON [OUTPUT_DIRECTORY]');configure(process.argv[2],process.argv[3]);}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={configure};
