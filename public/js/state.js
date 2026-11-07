import { Api } from './api.js';
import { acceptCloudOrder, connectCloud, startFreshnessTicker, reportCurrent, cloudGatewayCurrent } from './cloud-state.js';
export const isCurrentReport = device => reportCurrent(state, device, Api.mode === 'cloud');
export const isGatewayCurrent = () => cloudGatewayCurrent(state);
export const state = { session: null, snapshot: null, connected: false, connecting: false, loaded: false, connectionError: null, revision: 0, socket: null, reconnect: null, serverOffset: 0, transportGeneration: 0 };
export function acceptSnapshot(snapshot) { if (!snapshot || !Array.isArray(snapshot.devices) || !Array.isArray(snapshot.rooms)) return false; if (Api.mode === 'cloud' && !acceptCloudOrder(snapshot, state.snapshot)) return false; if(snapshot.snapshot_seq!==undefined){if(state.epoch===snapshot.server_epoch&&snapshot.snapshot_seq<=state.sequence)return false;state.epoch=snapshot.server_epoch;state.sequence=snapshot.snapshot_seq;} state.serverOffset = Number.isFinite(Date.parse(snapshot.server_time)) ? Date.parse(snapshot.server_time) - Date.now() + Math.min(10000, Math.max(0, snapshot.client_rtt_ms || 0)) : 0; state.snapshot = snapshot; state.loaded = true; state.revision++; return true; }
export function connectState(onUpdate, requestSnapshot) {
  startFreshnessTicker(state, onUpdate, () => Api.mode === 'cloud');
  if (Api.mode === 'cloud') return connectCloud(state, onUpdate, requestSnapshot);
  clearTimeout(state.reconnect); state.socket?.close(); state.connecting = true; const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); state.socket = socket;
  socket.onopen = () => { if(state.socket!==socket)return; state.sequence=0; state.connected = true; state.connecting = false; state.connectionError = null; onUpdate(); };
  socket.onmessage = event => { if(state.socket!==socket)return; try { const msg = JSON.parse(event.data); if (msg.type === 'init' && acceptSnapshot(msg.data)) onUpdate(); } catch {} };
  socket.onerror = () => socket.close();
  socket.onclose = () => { if (state.socket !== socket) return; state.connected = false; state.connecting = false; onUpdate(); if (state.session) state.reconnect = setTimeout(() => requestSnapshot().then(() => { if (state.session) connectState(onUpdate, requestSnapshot); }).catch(() => { if (state.session) connectState(onUpdate, requestSnapshot); }), 3000 + Math.random() * 1500); };
}
export function disconnectState() { state.transportGeneration++; state.revision++; state.pollNow = null; clearInterval(state.freshnessTimer); clearTimeout(state.reconnect); const old = state.socket; state.socket = null; old?.close(); state.connected = false; state.snapshot = null; state.session = null; state.loaded = false; }
export const deviceById = id => state.snapshot?.devices.find(d => d.id === id);
export const pendingById = id => state.snapshot?.commands.find(c => c.id === id);

document.addEventListener('visibilitychange', () => { if (!document.hidden && Api.mode === 'cloud' && state.session) state.pollNow?.(); });
