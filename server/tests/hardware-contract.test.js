const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { DoorConfig } = require('../services/door-config');

test('local RFID and keypad decisions are logged without replaying access or storing a PIN', async t => {
  const repo = await createRepository(); t.after(() => repo.close());
  const sent = [];
  const home = new Home(repo, { allowDoor: true, publisher: (...args) => sent.push(args) });
  home.setConnected(true);
  repo.write("INSERT INTO rfid_cards(uid,owner_name,is_authorized) VALUES('AA:BB:CC:DD','Fixture',1)");
  assert.equal(home.ingest('home/door/1/rfid', Buffer.from('{"uid":"AA:BB:CC:DD","authorized":true}')), true);
  assert.equal(home.ingest('home/door/1/keypad', Buffer.from('{"pin":"123456","authorized":false,"timestamp":12}')), true);
  assert.equal(sent.length, 0);
  assert.equal(repo.one('SELECT COUNT(*) AS n FROM commands').n, 0);
  assert.equal(repo.one("SELECT details FROM activity_log WHERE event_type='keypad_entry'").details, '{"authorized":false}');
  assert.equal(home.ingest('home/door/1/keypad', Buffer.from('{"pin":"123456"}')), false);
  assert.equal(repo.one("SELECT COUNT(*) AS n FROM activity_log WHERE event_type='keypad_entry'").n, 1);
});

test('denied keypad and RFID events open one access alert and a live lock report resolves it', async t => {
  const repo = await createRepository(); t.after(() => repo.close());
  const home = new Home(repo);
  home.setConnected(true);
  assert.equal(home.ingest('home/door/1/keypad', Buffer.from('{"pin":"0000","authorized":false}')), true);
  assert.equal(home.ingest('home/door/1/status', Buffer.from('denied')), true);
  assert.equal(home.ingest('home/door/1/rfid', Buffer.from('{"uid":"AA:BB:CC:DD","authorized":false}')), true);
  assert.equal(repo.one("SELECT COUNT(*) AS n FROM alerts WHERE kind='access_denied' AND state='active'").n, 1);
  assert.equal(home.ingest('home/door/1/status', Buffer.from('locked')), true);
  assert.equal(repo.one("SELECT COUNT(*) AS n FROM alerts WHERE kind='access_denied' AND state='resolved'").n, 1);
  assert.equal(home.ingest('home/door/1/status', Buffer.from('denied'), { retain: true }), true);
  assert.equal(repo.one("SELECT COUNT(*) AS n FROM alerts WHERE kind='access_denied'").n, 1);
  assert.equal(home.ingest('home/door/1/rfid', Buffer.from('{"uid":"11:22:33:44","authorized":false}')), true);
  assert.equal(repo.one("SELECT COUNT(*) AS n FROM alerts WHERE kind='access_denied'").n, 2);
  assert.doesNotMatch(JSON.stringify(repo.all('SELECT * FROM alerts')), /0000|AA:BB:CC:DD/);
});

test('card list and PIN use the firmware config topics and retained snapshots', async t => {
  const repo = await createRepository(); t.after(() => repo.close());
  const sent = [];
  const home = new Home(repo, { publisher: (topic, payload, options, callback) => { sent.push({ topic, payload, options }); callback(); } });
  home.doorConfig = { pin: () => '9876' };
  repo.write("INSERT INTO rfid_cards(uid,owner_name,is_authorized) VALUES('AA:BB:CC:DD','A',1)");
  repo.write("INSERT INTO rfid_cards(uid,owner_name,is_authorized) VALUES('11:22:33:44','B',0)");
  home.setConnected(true);
  home.syncDoorConfiguration();
  assert.deepEqual(sent.map(x => x.topic), ['home/door/1/config/cards', 'home/door/1/config/pin']);
  assert.equal(sent[0].payload, 'AA:BB:CC:DD');
  assert.equal(sent[1].payload, '9876');
  assert.ok(sent.every(x => x.options.qos === 1 && x.options.retain === true));
});

test('door PIN is validated and saved encrypted under the local user', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-door-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'door.enc.json');
  const config = new DoorConfig(filename);
  for (const invalid of ['123', '123456789', '12AB', '1234\n']) await assert.rejects(config.setPin(invalid), { code: 'INVALID_DOOR_PIN' });
  await config.setPin('123456');
  assert.equal(config.configured(), true);
  assert.equal(new DoorConfig(filename).pin(), '123456');
  assert.doesNotMatch(fs.readFileSync(filename, 'utf8'), /123456/);
});

test('fourth relay is migrated to Fan once without overwriting a later custom name', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-fan-name-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'home.db');
  let repo = await createRepository({ filename });
  repo.transaction(tx => {
    tx.run("DELETE FROM home_settings WHERE key='vidyut_fan_name_migrated'");
    tx.run("UPDATE devices SET name='Light 4' WHERE id='light-4'");
  });
  repo.close();
  repo = await createRepository({ filename });
  assert.equal(repo.getDevice('light-4').name, 'Fan');
  repo.write("UPDATE devices SET name='Light 4' WHERE id='light-4'");
  repo.close();
  repo = await createRepository({ filename });
  assert.equal(repo.getDevice('light-4').name, 'Light 4');
  repo.close();
});
