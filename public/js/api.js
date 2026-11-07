export const Api = {
  mode: 'local',
  sessionVersion: 0,
  async initialize() {
    const response = await fetch('/api/runtime', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return;
    const runtime = await response.json();
    if (runtime.mode === 'cloud') this.mode = 'cloud';
    if (!response.ok) throw Object.assign(new Error('Connection unavailable'), runtime.error, { status: response.status });
    this.runtime = runtime;
  },
  csrf: null,
  async request(path, { method = 'GET', body, signal } = {}) {
    if (!path.startsWith('/api/')) throw new Error('Same-origin API path required');
    const sessionVersion = this.sessionVersion; const started = performance.now(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, { method, credentials: 'same-origin', signal: signal || controller.signal, cache: 'no-store', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json();
      if (result.server_time && Array.isArray(result.devices)) result.client_rtt_ms = Math.min(10000, Math.max(0, performance.now() - started));
      if (!response.ok) { const error = new Error(result.error?.message || 'Request failed'); Object.assign(error, result.error, { status: response.status }); if (response.status === 401 && sessionVersion === this.sessionVersion) window.dispatchEvent(new CustomEvent('session-expired')); throw error; }
      if (result.csrf_token && sessionVersion === this.sessionVersion) { if (result.csrf_token !== this.csrf) this.sessionVersion++; this.csrf = result.csrf_token; }
      return result;
    } catch (error) { if (!error.code) error.code = 'CONNECTION_LOST'; throw error; } finally { clearTimeout(timeout); }
  },
};
