const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../public/js/state.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture(requestSnapshot) {
  const handlers = {}, sockets = [], timers = [];
  const scope = { Api: { mode: 'local' }, document: { hidden: false, addEventListener: (name, callback) => { handlers[name] = callback; } }, window: { addEventListener: (name, callback) => { handlers[name] = callback; } }, location: { protocol: 'http:', host: 'localhost:3001' }, Date, Promise, Math,
    startFreshnessTicker() {}, connectCloud() {}, clearInterval() {}, clearTimeout() {}, setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    WebSocket: class { constructor() { sockets.push(this); } close() { this.closed = true; this.onclose?.(); } },
  };
  vm.runInNewContext(source.replace(/^import .*;\r?$/gm, '').replace(/export /g, '') + ';this.exports={state,connectState,disconnectState};', scope);
  const { state, connectState, disconnectState } = scope.exports;
  state.session = { user: 'synthetic' };
  connectState(() => {}, () => requestSnapshot(state)); sockets[0].onopen();
  return { state, scope, sockets, timers, handlers, disconnectState, connectState };
}

test('local focus/visibility reconcile one fresh snapshot even when the socket appears open', async () => {
  let calls = 0, release;
  const pending = new Promise(resolve => { release = resolve; });
  const f = fixture(async state => { calls++; await pending; state.snapshot = { speech: { stt_ready: true } }; });
  f.state.snapshot = { speech: { stt_ready: false } };
  f.handlers.focus(); f.handlers.visibilitychange(); f.handlers.pageshow({ persisted: true });
  await flush(); assert.equal(calls, 1);
  release(); await flush(); assert.equal(f.state.snapshot.speech.stt_ready, true);
  assert.equal(f.sockets.length, 1); assert.equal(f.sockets[0].closed, undefined);
});

test('hidden or signed-out pages do not issue foreground refreshes', async () => {
  let calls = 0; const f = fixture(async () => { calls++; });
  f.scope.document.hidden = true; f.handlers.focus(); f.handlers.visibilitychange(); await flush();
  assert.equal(calls, 0);
  f.scope.document.hidden = false; f.disconnectState(); f.handlers.focus(); await flush();
  assert.equal(calls, 0); assert.equal(f.state.refreshLocal, null);
});

test('foreground read failure closes only its own transport for normal reconnect', async () => {
  const f = fixture(async () => { throw Error('offline'); });
  f.handlers.focus(); await flush();
  assert.equal(f.sockets[0].closed, true); assert.equal(f.state.connected, false);
  assert.equal(f.timers.length, 1);
});

test('a late foreground failure cannot close a newer household transport', async () => {
  let reject; const pending = new Promise((_, no) => { reject = no; });
  const f = fixture(() => pending); f.handlers.focus(); await flush();
  f.disconnectState(); f.state.session = { user: 'new-home' };
  f.connectState(() => {}, async () => {}); f.sockets[1].onopen();
  reject(Error('retired')); await flush();
  assert.equal(f.sockets[1].closed, undefined); assert.equal(f.state.connected, true);
});
