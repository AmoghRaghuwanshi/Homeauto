// Run after installing Mosquitto. Input holds private Wi-Fi provisioning only.
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {configure}=require('./configure-firmware');
const root=path.resolve(__dirname,'..');
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true});if(r.error||r.status!==0)throw Error('Hardware provisioning command failed: '+path.basename(exe));return r.stdout;}
function setup(filename){
  const input=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(!input.ssid||typeof input.wifi_password!=='string'||!require('node:net').isIPv4(input.broker_ip))throw Error('Provide ssid, wifi_password and broker_ip in a private JSON file.');
  const localBroker=path.join(root,'.local/tools/mosquitto');
  const mosquitto=input.mosquitto_directory||(fs.existsSync(path.join(localBroker,'mosquitto.exe'))?localBroker:'C:/Program Files/mosquitto');
  const passwd=path.join(mosquitto,'mosquitto_passwd.exe');
  const openssl=input.openssl||'C:/Program Files/Git/usr/bin/openssl.exe';
  if(!fs.existsSync(passwd)||!fs.existsSync(openssl))throw Error('Install Mosquitto and Git OpenSSL before provisioning.');
  const output=path.join(root,'.local/hardware');
  if(fs.existsSync(output))throw Error('Hardware settings already exist. Back up and rotate explicitly before provisioning again.');
  fs.mkdirSync(output,{recursive:true});
  if(process.platform==='win32')run('icacls',[output,'/inheritance:r','/grant:r',`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`]);
  const file=n=>path.join(output,n).replaceAll('\\','/');
  run(openssl,['req','-x509','-newkey','rsa:3072','-nodes','-days','365','-subj','/CN=HomeAuto MQTT CA','-addext','basicConstraints=critical,CA:TRUE','-keyout',file('ca.key'),'-out',file('ca.crt')]);
  run(openssl,['req','-new','-newkey','rsa:3072','-nodes','-subj','/CN=HomeAuto MQTT','-keyout',file('broker.key'),'-out',file('broker.csr')]);
  fs.writeFileSync(file('broker.ext'),`subjectAltName=IP:${input.broker_ip},DNS:${input.broker_ip},IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n`);
  run(openssl,['x509','-req','-in',file('broker.csr'),'-CA',file('ca.crt'),'-CAkey',file('ca.key'),'-CAcreateserial','-days','90','-extfile',file('broker.ext'),'-out',file('broker.crt')]);
  const passwords=Object.fromEntries(['homeauto-hub','esp32-lights','esp32-door'].map(n=>[n,crypto.randomBytes(24).toString('hex')]));
  for(const [i,[user,password]] of Object.entries(Object.entries(passwords)))run(passwd,['-b',...(i==='0'?['-c']:[]),file('passwords'),user,password]);
  fs.copyFileSync(path.join(root,'deploy/homeauto.acl'),file('homeauto.acl'));
  const listeners=[input.broker_ip,'127.0.0.1'].map(address=>`listener 8883 ${address}\ncafile ${file('ca.crt')}\ncertfile ${file('broker.crt')}\nkeyfile ${file('broker.key')}\ntls_version tlsv1.2\n`).join('');
  fs.writeFileSync(file('mosquitto.conf'),`allow_anonymous false\npassword_file ${file('passwords')}\nacl_file ${file('homeauto.acl')}\npersistence false\nmax_packet_size 4096\nmax_queued_messages 1\n${listeners}`);
  const board={...input,ca_file:file('ca.crt'),lights_password:passwords['esp32-lights'],door_password:passwords['esp32-door']};
  fs.writeFileSync(file('boards.json'),JSON.stringify(board),{mode:0o600});
  configure(file('boards.json'));
  fs.writeFileSync(file('hub.json'),JSON.stringify({HOMEAUTO_MQTT_ENABLED:'1',HOMEAUTO_MQTT_BROKER:'mqtts://127.0.0.1:8883',HOMEAUTO_MQTT_USERNAME:'homeauto-hub',HOMEAUTO_MQTT_PASSWORD:passwords['homeauto-hub'],HOMEAUTO_MQTT_CA:file('ca.crt'),HOMEAUTO_DOOR_ENABLED:'0',HOMEAUTO_REMOTE_DOOR_ENABLED:'0',HOMEAUTO_REMOTE_LIGHTS_ENABLED:'0',HOMEAUTO_SECURE_GATEWAY_APPROVED:'0'},null,2),{mode:0o600});
  console.log('Private broker settings, credentials and firmware headers created in .local/hardware. Keep this folder private. Door gates remain off.');
}
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node scripts/setup-hardware.js PRIVATE_WIFI_JSON');setup(process.argv[2]);}catch(e){console.error(e.message);process.exitCode=1;}}
