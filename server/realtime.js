const { WebSocketServer } = require('ws');
const { uuid } = require('./lib/errors');
function heartbeatClients(sockets, sessions, home) {
  for (const ws of sockets) {
    try { if (!ws.alive || !sessions.get(ws.token)) { ws.terminate(); continue; } ws.alive = false; ws.ping(); }
    catch { home.fault = 'PERSISTENCE_UNAVAILABLE'; try { ws.terminate(); } catch {} }
  }
}
function attachRealtime(server, { app, home, sessions, speech, assistant }) {
  const devices = new WebSocketServer({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  const voice = new WebSocketServer({ noServer: true, maxPayload: 4096, perMessageDeflate: false });
  const sockets = new Set(); let capturing = null;
  server.on('upgrade', (req, socket, head) => {
    try {
      app.locals.boundary(req); if (!req.headers.origin) throw new Error('Origin required');
      const { session, token } = sessions.readRequest(req); if (!session) throw new Error('Unauthorized');
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const target = pathname === '/ws' ? devices : pathname === '/voice' ? voice : null;
      if (!target || sockets.size >= 20 || pathname === '/voice' && [...sockets].filter(w => w.voice).length >= 2) throw new Error('Unavailable');
      target.handleUpgrade(req, socket, head, ws => { ws.actor = session; ws.token = token; ws.voice = pathname === '/voice'; ws.alive = true; sockets.add(ws); target.emit('connection', ws); });
    } catch { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); }
  });
  const send = (ws, msg) => { if (ws.readyState === 1 && ws.bufferedAmount < 1048576) ws.send(JSON.stringify(msg)); else if (ws.readyState === 1) ws.close(1013, 'Slow client'); };
  const snapshot = ws => {
    try { const actor = sessions.get(ws.token); if (!actor) return ws.close(1008, 'Session expired'); ws.actor = actor; const seq = (ws.seq || 0) + 1; ws.seq = seq; send(ws, { type: 'init', schema_version: 1, server_epoch: home.epoch, seq, sent_at: new Date().toISOString(), data: { ...home.snapshot(actor, speech.readiness()), snapshot_seq: seq } }); } catch { ws.close(1011, 'State unavailable'); }
  };
  const onChange = () => { for (const ws of devices.clients) snapshot(ws); };
  const revoke = tokenHash => { for (const ws of sockets) if (ws.actor.token_hash === tokenHash) ws.close(1008, 'Session revoked'); };
  home.on('change', onChange); home.on('revoke', revoke);
  devices.on('connection', ws => { snapshot(ws); ws.on('message', () => ws.close(1008, 'Read only')); });
  voice.on('connection', ws => {
    let buffer = [], total = 0, utterance = null, cancelled = false, ending = false;
    const reset = () => { cancelled = true; buffer = []; total = 0; if (capturing === ws) capturing = null; };
    const limit = setTimeout(() => { reset(); ws.close(1008, 'Recording timed out'); }, 23000);
    const handshake = setTimeout(() => { if (!utterance) ws.close(1008, 'Start required'); }, 3000);
    ws.on('message', async (data, isBinary) => {
      try {
        const actor = sessions.get(ws.token); if (!actor) throw new Error('LOGIN_REQUIRED');
        if (isBinary) { if (!utterance || ending || cancelled || data.length > 3200 || data.length % 2 || total + data.length > 640000) throw new Error('INVALID_AUDIO'); total += data.length; buffer.push(Buffer.from(data)); return; }
        const msg = JSON.parse(data.toString());
        if (msg.type === 'start') {
          if (utterance || capturing || !uuid(msg.utterance_id) || msg.format !== 'pcm_s16le' || msg.sample_rate !== 16000 || msg.channels !== 1 || !['auto', 'en', 'hi'].includes(msg.language)) throw new Error('INVALID_START');
          speech.consume(msg.ticket, actor); capturing = ws; utterance = msg.utterance_id; ws.language = msg.language; ws.wakeRequired = msg.wake_required === true;
          clearTimeout(handshake); send(ws, { type: 'voice_ready', utterance_id: utterance });
        } else if (msg.type === 'cancel' && msg.utterance_id === utterance) { reset(); ws.close(); }
        else if (msg.type === 'end' && msg.utterance_id === utterance && !ending && !cancelled) {
          ending = true; clearTimeout(limit); if (total < 6400) throw new Error('NO_SPEECH');
          const pcm = Buffer.concat(buffer); buffer = []; if (capturing === ws) capturing = null;
          const result = await speech.transcribe(pcm, ws.language, ws.wakeRequired);
          if (cancelled || ws.readyState !== 1 || !sessions.get(ws.token)) return;
          const parsed = assistant.interpret(result.text, actor);
          send(ws, { type: 'transcript', utterance_id: utterance, text: result.text, lang: result.lang });
          send(ws, { type: 'intent', utterance_id: utterance, ...parsed });
        } else throw new Error('INVALID_CONTROL');
      } catch (error) { send(ws, { type: 'voice_error', utterance_id: utterance, code: error.code || error.message || 'VOICE_ERROR', retryable: true }); reset(); ws.close(1008); }
    });
    ws.on('close', () => { reset(); clearTimeout(limit); clearTimeout(handshake); });
  });
  for (const wss of [devices, voice]) wss.on('connection', ws => { ws.on('pong', () => { ws.alive = true; }); ws.on('close', () => sockets.delete(ws)); ws.on('error', () => ws.terminate()); });
  const heartbeat = setInterval(() => heartbeatClients(sockets, sessions, home), 20000); heartbeat.unref();
  return { close() { clearInterval(heartbeat); home.off('change', onChange); home.off('revoke', revoke); for (const ws of sockets) ws.terminate(); devices.close(); voice.close(); } };
}
module.exports = { attachRealtime, heartbeatClients };
