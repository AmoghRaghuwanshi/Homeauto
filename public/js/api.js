export const Api = {
  mode: 'local',
  demo: null,
  demoMarker: 'homeauto.demo.active.v1',
  startDemo(session, model) { if(this.mode!=='cloud'||!model?.request)throw new Error('Demo is available online');this.sessionVersion++;this.demo=model;try{sessionStorage.setItem(this.demoMarker,JSON.stringify({version:1,user:session.user.id,home:session.household_id}));}catch{} },
  restoreDemo(session) { try{const m=JSON.parse(sessionStorage.getItem(this.demoMarker)||'null');return m?.version===1&&m.user===session.user.id&&m.home===session.household_id;}catch{return false;} },
  exitDemo() { this.sessionVersion++;this.demo=null;try{sessionStorage.removeItem(this.demoMarker);}catch{} },
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
  async request(path, { method = 'GET', body, signal, timeoutMs = 10000 } = {}) {
    if (!path.startsWith('/api/')) throw new Error('Same-origin API path required');
    if (this.demo && !path.startsWith('/api/auth/')) return this.demo.request(path,{method,body});
    const sessionVersion = this.sessionVersion; const started = performance.now(); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? Math.max(1000, Math.min(25000, timeoutMs)) : 10000);
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
    try {
      const response = await fetch(path, { method, credentials: 'same-origin', signal: controller.signal, cache: 'no-store', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && this.csrf ? { 'X-CSRF-Token': this.csrf } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      let result;
      try { result = await response.json(); if (!result || typeof result !== 'object') throw new Error('JSON response required'); }
      catch { throw Object.assign(new Error('HomeAuto did not return a valid response'), { code: 'RESPONSE_UNAVAILABLE', status: response.status, request_id: response.headers.get('x-request-id'), retryable: response.status >= 500 }); }
      if (result.server_time && Array.isArray(result.devices)) result.client_rtt_ms = Math.min(10000, Math.max(0, performance.now() - started));
      if (!response.ok) { const error = new Error(result.error?.message || 'Request failed'); Object.assign(error, result.error, { status: response.status }); if (response.status === 401 && sessionVersion === this.sessionVersion) window.dispatchEvent(new CustomEvent('session-expired')); throw error; }
      if (result.csrf_token && sessionVersion === this.sessionVersion) { if (result.csrf_token !== this.csrf) this.sessionVersion++; this.csrf = result.csrf_token; }
      return result;
    } catch (error) { if (typeof error.code !== 'string') throw Object.assign(new Error('Connection unavailable'), { code: 'CONNECTION_LOST', cause: error }); throw error; } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); }
  },
};
