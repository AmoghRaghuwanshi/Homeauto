// Checks the installed broker without issuing device commands or fake telemetry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mqtt=require('../server/node_modules/mqtt');
const root=path.resolve(__dirname,'..');
async function check(){
  const hub=JSON.parse(fs.readFileSync(path.join(root,'.local/hardware/hub.json')));
  const board=JSON.parse(fs.readFileSync(path.join(root,'.local/hardware/boards.json')));
  const options={ca:fs.readFileSync(hub.HOMEAUTO_MQTT_CA),protocolVersion:5,reconnectPeriod:0,connectTimeout:5000};
  let boardClient;
  try{
    boardClient=await mqtt.connectAsync(hub.HOMEAUTO_MQTT_BROKER,{...options,username:'esp32-lights',password:board.lights_password});
    const granted=await boardClient.subscribeAsync('home/light/1/command');assert.equal(granted[0].qos,0);
    await assert.rejects(boardClient.publishAsync('homeauto/probe/'+require('node:crypto').randomUUID(),'permission-check',{qos:1}));
  }finally{await boardClient?.endAsync(true);}
  const lanClient=await mqtt.connectAsync(`mqtts://${board.broker_ip}:8883`,{...options,username:'esp32-lights',password:board.lights_password});
  await lanClient.endAsync(true);
  await assert.rejects(mqtt.connectAsync(hub.HOMEAUTO_MQTT_BROKER,{...options}));
  console.log(JSON.stringify({tls_and_board_credentials:'passed',lan_address_and_certificate:'passed',light_command_subscription:'passed',unrelated_topic_publish_denied:'passed',anonymous_connection_denied:'passed',device_commands_sent:0}));
}
check().catch(e=>{console.error('Broker verification failed: '+e.message);process.exitCode=1;});
