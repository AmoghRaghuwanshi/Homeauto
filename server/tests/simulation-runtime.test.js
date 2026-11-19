const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startSimulation } = require('../scripts/simulation');

test('interactive simulation ignores inherited hardware/cloud settings and never opens the household files', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'homeauto-simulation-'));
  const values = { HOMEAUTO_HOST: '0.0.0.0', HOMEAUTO_DB_PATH: path.join(folder,'household.db'), HOMEAUTO_MODULES_PATH: path.join(folder,'modules.enc.json'), HOMEAUTO_DOOR_CONFIG_PATH: path.join(folder,'door-config.enc.json'),
    HOMEAUTO_MQTT_ENABLED: '1', HOMEAUTO_MQTT_BROKER: 'mqtts://unreachable.invalid:8883', HOMEAUTO_MQTT_USERNAME: 'fixture', HOMEAUTO_MQTT_PASSWORD: 'fixture-secret', HOMEAUTO_GATEWAY_ENABLED: '1', HOMEAUTO_CLOUD_SYNC_ENABLED: '1' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key,process.env[key]]));
  fs.writeFileSync(values.HOMEAUTO_DB_PATH,'private sentinel; not a SQLite file');
  fs.writeFileSync(values.HOMEAUTO_MODULES_PATH,'private sentinel; not encrypted module settings');
  fs.writeFileSync(values.HOMEAUTO_DOOR_CONFIG_PATH,'private sentinel; not encrypted door settings');
  let fixture;
  t.after(async () => {
    await fixture?.runtime.stop();
    for (const [key,value] of Object.entries(previous)) { if(value===undefined)delete process.env[key];else process.env[key]=value; }
    assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep));
    fs.rmSync(folder,{recursive:true,force:true});
  });
  Object.assign(process.env,values);
  fixture = await startSimulation({port:0});
  assert.equal(fixture.runtime.server.address().address,'127.0.0.1');
  assert.equal(fixture.runtime.home.simulation,true);
  assert.equal(fixture.runtime.home.hardwareRequired,false);
  const descriptor=await (await fetch(fixture.url+'/api/runtime')).json();
  assert.equal(descriptor.simulation,true); assert.equal(descriptor.device_transport,'simulated');
  assert.equal(fixture.runtime.speech.readiness().stt_ready,true);
  assert.equal(fixture.runtime.speech.readiness().provider,'browser');
  assert.equal(fixture.runtime.home.doorConfig.configured(),false);
  await fixture.runtime.home.doorConfig.setPin('1234');
  assert.equal(fixture.runtime.home.doorConfig.pin(),'1234');
  assert.equal(fixture.runtime.camera.status().simulated,true);
  assert.equal(fs.readFileSync(values.HOMEAUTO_DB_PATH,'utf8'),'private sentinel; not a SQLite file');
  assert.equal(fs.readFileSync(values.HOMEAUTO_MODULES_PATH,'utf8'),'private sentinel; not encrypted module settings');
  assert.equal(fs.readFileSync(values.HOMEAUTO_DOOR_CONFIG_PATH,'utf8'),'private sentinel; not encrypted door settings');
  const csrf=(await (await fetch(fixture.url+'/api/auth/session')).json()).csrf_token;
  const request=(method,route,body)=>fetch(fixture.url+route,{method,headers:{Origin:fixture.url,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  assert.equal((await request('PUT','/api/modules/esp32',{url:'mqtts://unreachable.invalid',username:'fixture',password:'fixture'})).status,409);
  assert.equal((await request('POST','/api/modules/camera/connect',{})).status,409);
  assert.equal(fixture.runtime.repo.one('SELECT COUNT(*) n FROM commands').n,0);
});

test('simulation scenarios require CSRF and owner access, stay in memory, and reject real runtime state', async t => {
  const fixture=await startSimulation({port:0});t.after(()=>fixture.runtime.stop());
  const {home,sessions,repo}=fixture.runtime;
  const original=sessions.readRequest;
  const request=(body,csrf=original().session.csrf_token)=>fetch(fixture.url+'/api/simulation/scenario',{method:'POST',headers:{Origin:fixture.url,'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  assert.equal((await request({scenario:'gas'},'wrong')).status,403);
  assert.equal((await request({scenario:'gas',matched:true})).status,400);
  assert.equal((await request({scenario:'unlock'})).status,400);
  assert.equal((await request({scenario:'gas'})).status,200);
  assert.equal(home.device('sensor-gas').latest.alert,true);
  assert.equal((await request({scenario:'motion'})).status,200);
  assert.equal(home.device('sensor-motion').latest.motion,true);
  assert.equal((await request({scenario:'clear'})).status,200);
  assert.equal(home.device('sensor-gas').latest.alert,false);
  assert.equal(home.device('sensor-motion').latest.motion,false);
  sessions.readRequest=()=>{const value=original();return {...value,session:{...value.session,role:'viewer'}};};
  assert.equal((await request({scenario:'gas'})).status,403);
  sessions.readRequest=original;home.simulation=false;
  assert.equal((await request({scenario:'gas'})).status,409);
  assert.equal(home.device('sensor-gas').latest.alert,false);
  assert.equal(repo.one('SELECT COUNT(*) n FROM commands').n,0);
});
