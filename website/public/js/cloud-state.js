export function cloudGatewayCurrent(state) {
  const gateway = state.snapshot?.gateway;
  const age = Date.now() + state.serverOffset - Date.parse(gateway?.last_seen_at);
  return !!(state.connected && gateway?.connected && age >= 0 && age <= 15000);
}

export function reportCurrent(state, device, cloud) {
  if (!device?.observation || !state.connected) return false;
  const now = Date.now() + state.serverOffset;
  const age = now - Date.parse(device.observation.received_at);
  const board = state.snapshot?.espBoards?.[device.board_id];
  const boardAge = now - Date.parse(board?.lastSeen);
  return !!(device.connectivity === 'online' && device.observation.freshness === 'current' && !device.observation.retained && age >= 0 && age <= (device.id === 'sensor-gas' ? 10000 : 65000) && board?.online && boardAge >= 0 && boardAge <= 60000 && (!cloud || cloudGatewayCurrent(state)));
}

export function acceptCloudOrder(incoming, previous) {
  if (!previous || incoming.server_epoch !== previous.server_epoch) return true;
  const cursor = value => /^\d+$/.test(String(value ?? '0')) ? BigInt(value ?? '0') : 0n;
  const nextCursor = cursor(incoming.cloud_cursor), oldCursor = cursor(previous.cloud_cursor);
  const nextGateway = Number(incoming.gateway_sequence || 0), oldGateway = Number(previous.gateway_sequence || 0);
  if (nextCursor < oldCursor || nextGateway < oldGateway) return false;
  if (nextCursor === oldCursor && nextGateway === oldGateway && Date.parse(incoming.server_time) < Date.parse(previous.server_time)) return false;
  if (incoming.session?.id === previous.session?.id && incoming.preferences?.version < previous.preferences?.version) incoming.preferences = previous.preferences;
  return true;
}

export function startFreshnessTicker(state, onUpdate, isCloud) {
  clearInterval(state.freshnessTimer);
  let signature = '';
  state.freshnessTimer = setInterval(() => {
    if (!state.session || !state.snapshot || document.hidden) return;
    const current = (isCloud() ? String(cloudGatewayCurrent(state)) : '') + state.snapshot.devices.map(device => reportCurrent(state, device, isCloud()) ? '1' : '0').join('');
    if (current !== signature) { signature = current; onUpdate(); }
  }, 1000);
}

export function connectCloud(state, onUpdate, requestSnapshot) {
  clearTimeout(state.reconnect); state.socket?.close(); state.socket = null;
  const generation = ++state.transportGeneration;
  let failures = 0, busy = false;
  const poll = async () => {
    if (busy || generation !== state.transportGeneration || !state.session) return;
    busy = true;
    try {
      await requestSnapshot();
      if (generation !== state.transportGeneration || !state.session) return;
      state.connected = true; state.connecting = false; state.connectionError = null; failures = 0; onUpdate();
    } catch (error) {
      if (generation !== state.transportGeneration) return;
      state.connected = false; state.connecting = false; state.connectionError = error.code; failures++; onUpdate();
    } finally {
      busy = false;
      if (generation === state.transportGeneration && state.session) state.reconnect = setTimeout(poll, document.hidden ? 15000 : Math.min(30000, 2000 * 2 ** Math.min(failures, 4)));
    }
  };
  state.pollNow = () => { clearTimeout(state.reconnect); poll(); };
  state.connecting = true; poll();
}
