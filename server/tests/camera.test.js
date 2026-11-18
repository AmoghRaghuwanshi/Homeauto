const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FrameSource } = require('../camera/frame-source');
const { CameraService } = require('../camera/service');
const { createPreview } = require('../scripts/preview');
const image = fs.readFileSync(path.join(__dirname, '../camera/fixture.png'));

test('frame freshness, source generation, sequence and buffer ownership prevent stale evidence', () => {
  let now = 10000;
  const source = new FrameSource({ now: () => now });
  source.start();
  const generation = source.generation;
  const bytes = Buffer.from(image);
  assert.equal(source.publishFrame({ data: bytes, generation, sequence: 1 }), true);
  bytes.fill(0);
  assert.deepEqual(source.latestFrame().data, image);
  const returned = source.latestFrame(); returned.data.fill(0);
  assert.deepEqual(source.latestFrame().data, image);
  assert.equal(source.publishFrame({ data: image, generation, sequence: 1 }), false);
  now += 1501;
  assert.equal(source.health().state, 'stale'); assert.equal(source.latestFrame(), null);
  source.start();
  assert.notEqual(source.generation, generation);
  assert.equal(source.publishFrame({ data: image, generation, sequence: 2 }), false);
  assert.equal(source.publishFrame({ data: Buffer.from('bad'), generation: source.generation, sequence: 1 }), false);
  assert.equal(source.publishFrame({ data: image, generation: source.generation, sequence: 1 }), true);
  now -= 100;
  assert.equal(source.latestFrame(), null);
  source.stop(); assert.equal(source.health().state, 'disabled'); assert.equal(source.latestFrame(), null);
});

test('disabled defaults and physical profiles cannot activate the simulation source', () => {
  for (const config of [{}, { mode: 'fixture', simulation: false }, { mode: 'rtsp', simulation: true }]) {
    const camera = new CameraService(config); camera.start();
    assert.equal(camera.status().state, 'disabled'); assert.equal(camera.status().capabilities.unlock, false);
    assert.throws(() => camera.frame(), error => error.code === 'CAMERA_FRAME_UNAVAILABLE');
    assert.throws(() => camera.scenario('live'), error => error.code === 'CAMERA_SIMULATION_UNAVAILABLE');
    camera.close();
  }
});

test('fixture lifecycle clears unavailable frames and starts a new stream after recovery', t => {
  const camera = new CameraService({ mode: 'fixture', simulation: true }); t.after(() => camera.close());
  camera.start(); const generation = camera.status().generation;
  assert.deepEqual(camera.frame().data, image);
  for (const scenario of ['stale', 'offline', 'fault']) {
    camera.scenario(scenario);
    assert.throws(() => camera.frame(), error => error.code === 'CAMERA_FRAME_UNAVAILABLE');
    camera.scenario('live'); assert.equal(camera.status().state, 'live');
  }
  assert.notEqual(camera.status().generation, generation);
  assert.throws(() => camera.scenario('unlock'), error => error.code === 'VALIDATION_ERROR');
  camera.source.start = () => { throw Error('decoder failed'); };
  camera.start(); assert.equal(camera.status().state, 'fault'); assert.equal(camera.status().reason, 'CAMERA_START_FAILED');
});

test('real HTTP camera routes enforce ownership, CSRF, explicit simulation and zero device commands', async t => {
  const fixture = await createPreview({ cameraMode: 'fixture' }); t.after(() => fixture.runtime.stop());
  const { repo, home, sessions } = fixture.runtime;
  let publications = 0;
  home.publisher = () => { publications++; };
  const originalSession = sessions.readRequest;
  const request = (route, body, csrf = originalSession().session.csrf_token) => fetch(fixture.url + route, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: fixture.url, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const status = await request('/api/camera/status'); assert.equal(status.status, 200);
  assert.equal((await status.json()).capabilities.face_verification, false);
  const frame = await request('/api/camera/frame'); assert.equal(frame.status, 200);
  assert.match(frame.headers.get('content-type'), /image\/png/); assert.equal(frame.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await frame.arrayBuffer()), image);
  assert.equal((await request('/api/camera/fixture', { scenario: 'offline' }, 'wrong')).status, 403);
  assert.equal((await request('/api/camera/fixture', { scenario: 'live', matched: true })).status, 400);
  for (const scenario of ['offline', 'stale', 'fault']) {
    assert.equal((await request('/api/camera/fixture', { scenario })).status, 200);
    assert.equal((await request('/api/camera/frame')).status, 503);
    assert.equal((await request('/api/snapshot')).status, 200);
    assert.equal((await request('/api/camera/fixture', { scenario: 'live' })).status, 200);
  }
  home.simulation = false;
  assert.equal((await request('/api/camera/fixture', { scenario: 'live' })).status, 409);
  home.simulation = true;
  sessions.readRequest = () => { const result = originalSession(); return { ...result, session: { ...result.session, role: 'viewer' } }; };
  assert.equal((await request('/api/camera/status')).status, 403);
  assert.equal((await request('/api/camera/frame')).status, 403);
  assert.equal((await request('/api/camera/fixture', { scenario: 'live' })).status, 403);
  sessions.readRequest = () => ({ session: null });
  assert.equal((await request('/api/camera/frame', undefined, 'none')).status, 401);
  assert.equal(publications, 0); assert.equal(repo.one('SELECT COUNT(*) n FROM commands').n, 0);
});
