import { el, icon, button, link, field, empty, modal, loadingPanel } from './components.js';
import { t, errorText } from './i18n.js';
import { preferences, applyPreferences } from './preferences.js';
import { Api } from './api.js';
import { state, acceptSnapshot, connectState, disconnectState, isGatewayCurrent } from './state.js';
import { renderView } from './views.js';
import { BrowserVoiceCapture as VoiceCapture, BrowserSpeechOutput } from './browser-voice.js';
import { refreshBrowserVoiceChoices } from './browser-voice-settings.js';
import { showMicrophoneCheck } from './microphone-check.js';
import { LiveConversation } from './live-conversation.js';
import { WakeListener } from './wake-listener.js';
import { beginChatTurn } from './chat-history.js';
import { Navigation, routeInfo, captureFocus, restoreFocus } from './navigation.js';
import { createDemoHome } from './demo.js';
import { speechStatus, speechAvailable } from './speech-status.js';

const app = document.getElementById('app'); const toasts = document.getElementById('toasts');
let renderId = 0, lastPath = '', main, shellBuilt = false, assistantBuilt = false, knownAlerts = new Set(), initialAlerts = false, navigation;
let pendingNavigation = { direction: 'none', restore: true, initial: true };
let authNotice = false, authUsername = '', authInitialized = false;
let signupRequest = null, signupFailure = null;
let realDemoSession = null;
let pageLeaving = false;
let renderingPath = null;
const ctx = {
  transitioning: false, realmGeneration: 0, preferenceOperation: null,
  pending: new Set(), commandOwners: new Map(), feedback: new Map(), readingAlerts: new Set(), filters: {}, conversation: { transcript: '', response: '', draft: '', resultId: null, securityLink: false }, wakeRequired: false,
  notify(message, error = false) { const node = el('div', { class: 'toast' + (error ? ' toast-error' : '') }, message); toasts.append(node); while (toasts.children.length > 3) toasts.firstChild.remove(); let timer; const resume = () => { clearTimeout(timer); timer = setTimeout(() => node.remove(), error ? 12000 : 6500); }; resume(); node.addEventListener('mouseenter', () => clearTimeout(timer)); node.addEventListener('mouseleave', resume); },
  async run(fn) { try { return await fn(); } catch (e) { ctx.notify(errorText(e), true); } },
  async refresh() { if (pageLeaving) return; const revision = state.revision; const sessionVersion = Api.sessionVersion; const s = await Api.request('/api/snapshot'); if (state.session && sessionVersion === Api.sessionVersion && (Api.mode === 'cloud' || revision === state.revision)) { acceptSnapshot(s); if (Api.mode === 'cloud') { state.connected = true; state.connecting = false; } } onUpdate(); },
  render: () => render(),
  navigate: path => navigation.go(path),
  setQuery(patch, renderNow = true) { navigation.query(patch); if (renderNow) render(); },
  async logout() { await ctx.run(async () => { await Api.request('/api/auth/logout', { method: 'POST', body: {} }); resetSession(); }); },
  switchHome(householdId) { return ctx.run(() => switchHousehold(householdId)); },
  async command(id, action, realm = ctx.realmGeneration) {
    if (realm !== ctx.realmGeneration) return;
    if (ctx.transitioning || !state.session) return ctx.notify(errorText({ code: 'HOME_SWITCH_IN_PROGRESS' }), true);
    if (ctx.pending.has(id)) return; const sessionVersion = Api.sessionVersion; const owner = Symbol('device-command'); ctx.commandOwners.set(id, owner); ctx.pending.add(id); ctx.feedback.delete(id); render();
    try { const result = await Api.request('/api/devices/' + id + '/command', { method: 'POST', body: { action, idempotency_key: crypto.randomUUID() } }); if (sessionVersion !== Api.sessionVersion || !state.session) return; ctx.notify(t(Api.demo ? 'Demo light updated' : ({ observed: 'Controller reports', expired: 'Request expired', rejected: 'Request rejected', failed: 'Request failed', uncertain: 'Not confirmed' })[result.command.state] || 'Request accepted')); await ctx.refresh(); return result.command; }
    catch (e) { if (sessionVersion !== Api.sessionVersion || !state.session) return; ctx.feedback.set(id, errorText(e)); ctx.notify(errorText(e), true); }
    finally { if (ctx.commandOwners.get(id) === owner) { ctx.commandOwners.delete(id); ctx.pending.delete(id); render(); } }
  },
  async bulkOff() { if (ctx.transitioning || !state.session || !state.snapshot) return; const realm = ctx.realmGeneration; const lights = state.snapshot.devices.filter(d => d.type === 'light' && (Api.demo || d.id !== 'light-4')); const outcomes = []; for (let i = 0; i < lights.length; i += 2) { if (realm !== ctx.realmGeneration) return; outcomes.push(...await Promise.all(lights.slice(i, i + 2).map(d => ctx.command(d.id, 'off', realm)))); } if (realm !== ctx.realmGeneration) return; const unavailable = outcomes.filter(r => !r).length; if (unavailable) ctx.notify(`${unavailable} ${t('unavailable')}`, true); },
  async preference(patch) {
    if (ctx.preferenceBusy || ctx.transitioning || !state.session) return;
    const operation = ctx.preferenceOperation = Symbol('preference-save');
    ctx.preferenceBusy = true; const sessionVersion = Api.sessionVersion; render();
    try { return await ctx.run(async () => {
      const p = await Api.request('/api/preferences', { method: 'PUT', body: { ...patch, version: state.snapshot.preferences.version } });
      if (sessionVersion !== Api.sessionVersion || !state.session || !state.snapshot) return;
      state.snapshot.preferences = p; await ctx.refresh();
    }); } finally {
      if (ctx.preferenceOperation === operation) { ctx.preferenceOperation = null; ctx.preferenceBusy = false; render(); }
    }
  },
  favorite(id) { const ids = state.snapshot.preferences.favorites; return ctx.preference({ favorites: ids.includes(id) ? ids.filter(d => d !== id) : [...ids, id] }); },
  async sensitive(action) {
    if (ctx.transitioning || !state.session) return;
    const realm = ctx.realmGeneration;
    if (state.session.user.preview) return ctx.run(action);
    if (state.session.reauth_until && Date.parse(state.session.reauth_until) > Date.now()) return ctx.run(action);
    const password = field('Password', { name: 'reauth-password', type: 'password', autocomplete: 'current-password', maxLength: 256 });
    modal('Reauthenticate', el('div', { class: 'stack' }, el('p', { class: 'muted' }, t('Confirm your password to continue.')), password.node), { confirmLabel: 'Reauthenticate', onConfirm: async () => { state.session = await Api.request('/api/auth/reauth', { method: 'POST', body: { password: password.input.value } }); setTimeout(() => { if (!ctx.transitioning && realm === ctx.realmGeneration && state.session) ctx.run(action); }, 0); } });
  },
  unlock() { return ctx.sensitive(() => modal('Unlock front door', el('div', { class: 'stack' }, el('p', {}, t('The controller normally relocks after about 5 seconds. Network failures can delay relocking.')), el('p', { class: 'warning-note' }, t('Physical lock position is not sensed.'))), { confirmLabel: 'Request unlock', danger: true, onConfirm: async () => { const key = crypto.randomUUID(); const c = await Api.request('/api/security/unlock-challenges', { method: 'POST', body: Api.mode === 'cloud' ? { device_id: 'door-1', idempotency_key: key } : { device_id: 'door-1' } }); const result = await Api.request('/api/devices/door-1/command', { method: 'POST', body: { action: 'unlock', idempotency_key: key, confirmation_id: c.confirmation_id } }); ctx.notify(t('Request accepted')); await ctx.refresh(); return result; } })); },
  clearConversation() { ctx.wake?.stop(); ctx.endLive?.(); ctx.live?.stop(); ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1; ctx.voice.cancel(); ctx.stopAudio(); ctx.conversation = { transcript: '', response: '', draft: '', resultId: null, securityLink: false }; if (location.pathname === '/assistant') { assistantBuilt = false; render(); } else ctx.notify(t('Clear conversation')); },
  async typed(text) { if (!text.trim()) return; ctx.pauseWake?.(); ctx.endLive?.(); ctx.voice.cancel(); ctx.stopAudio(); ctx.conversation.commandIds = null; ctx.conversation.commandErrors = []; const generation = ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1; ctx.beginTurn?.(); ctx.conversation.transcript = text; ctx.conversation.replyLanguage = globalThis.HomeAutoLanguage.inputLanguage(text, state.snapshot.preferences.input_language); ctx.conversation.response = t('Understanding…'); ctx.conversation.resultId = null; ctx.conversation.securityLink = false; ctx.updateConversation?.(); try { const parsed = await Api.request('/api/assistant/interpret', { method: 'POST', body: { text, language: state.snapshot.preferences.input_language } }); if (generation !== ctx.assistantGeneration) return; await executeIntent(parsed, generation); } catch (e) { if (generation === ctx.assistantGeneration) assistantError(e); } },
  stopAudio() { ctx.audioGeneration = (ctx.audioGeneration || 0) + 1; ctx.browserSpeech?.stop(); ctx.audio?.pause(); ctx.audio = null; document.getElementById('assistant-audio-output')?.replaceChildren(); },
  previewVoice(language) {
    if (state.snapshot.system.hardware_required && !state.snapshot.system.hardware_ready) return ctx.notify(errorText({ code: 'ESP32_REQUIRED' }), true);
    ctx.endLive(); ctx.pauseWake();
    return ctx.run(() => ctx.browserOutput({ language, rate: state.snapshot.preferences.voice_rate,
      text: language === 'hi' ? 'नमस्ते! मैं श्रीमान हूँ। बताइए, मैं आपकी क्या मदद करूँ?' : 'Hello! I’m Shrimaan. How can I help you with your home?' }));
  },
  async browserOutput(result, generation = ctx.audioGeneration) {
    ctx.browserSpeech ||= new BrowserSpeechOutput();
    await ctx.browserSpeech.speak({ ...result, volume: preferences.voiceVolume, voiceKey: result.language === 'hi' ? preferences.hindiVoice : preferences.englishVoice }, status => {
      if (generation !== ctx.audioGeneration) return;
      const code = status === 'blocked' ? 'AUDIO_PLAYBACK_BLOCKED' : status === 'failed' ? 'BROWSER_SPEECH_FAILED' : null;
      const message = code ? errorText({ code }) : t(status === 'finished' ? 'Spoken reply finished.' : status === 'speaking' ? 'Playing spoken reply…' : 'Preparing spoken reply…');
      document.getElementById('assistant-audio-output')?.replaceChildren(el('p', { role: 'status', class: code ? 'form-error' : 'small muted' }, message));
      ctx.live?.output(status); if (status === 'finished') ctx.scheduleWake?.();
    });
  },
  async speak(resultId, test = false, messageCode = null) {
    if (!test && !resultId && !messageCode) return; ctx.pauseWake?.(); ctx.voice?.cancel(); ctx.stopAudio(); ctx.live?.output('preparing'); const generation = ctx.audioGeneration;
    const preferred = state.snapshot.preferences.reply_language; const language = !test && ctx.conversation.replyLanguage ? ctx.conversation.replyLanguage : preferred === 'auto' ? preferences.language : preferred;
    document.getElementById('assistant-audio-output')?.replaceChildren(el('p', { role: 'status', class: 'small muted' }, t('Preparing spoken reply…')));
    try {
      const result = await Api.request('/api/assistant/speech', { method: 'POST', body: { ...(messageCode ? { message_code: messageCode } : test ? { test_phrase: 'voice_check' } : { result_id: resultId }), language } });
      if (generation !== ctx.audioGeneration) return;
      if (result.provider === 'browser') {
        if (document.hidden) return;
        await ctx.browserOutput(result, generation);
        return;
      }
      for (let i = 0; i < 130; i++) { if (generation !== ctx.audioGeneration) return; const job = await Api.request('/api/assistant/speech/' + result.job_id); if (generation !== ctx.audioGeneration) return; if (job.state === 'failed') throw Object.assign(new Error('Synthesis failed'), { code: 'VOICE_NOT_READY' }); if (job.state === 'ready') { const audio = new Audio(job.audio_url); ctx.audio = audio; audio.controls = true; audio.setAttribute('aria-label', t('Spoken reply')); document.getElementById('assistant-audio-output')?.replaceChildren(audio); if (!document.hidden) await audio.play(); return; } await new Promise(resolve => setTimeout(resolve, 500)); }
      throw new Error('TTS_TIMEOUT');
    } catch (e) { if (generation === ctx.audioGeneration) { ctx.live?.stop(); ctx.scheduleWake?.(); const blocked = e.name === 'NotAllowedError'; const message = errorText(blocked ? { code: 'AUDIO_PLAYBACK_BLOCKED' } : e); if (!blocked) document.getElementById('assistant-audio-output')?.replaceChildren(el('p', { role: 'status', class: 'form-error' }, message)); ctx.notify(message, true); } }
  },
};
function renderTransition() {
  app.replaceChildren(el('main', { class: 'transition-screen', 'aria-busy': 'true' }, el('div', {}, loadingPanel('Changing home…'))));
  main = null; shellBuilt = false; assistantBuilt = false;
}
function beginRealmTransition() {
  ctx.transitioning = true; ctx.realmGeneration++; Api.mutationsPaused = true; Api.sessionVersion++;
  ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1;
  ctx.wake?.stop(); ctx.live?.stop(); ctx.voice.cancel(); ctx.stopAudio(); disconnectState();
  ctx.pending.clear(); ctx.commandOwners.clear(); ctx.feedback.clear(); ctx.activityPage = null; ctx.readingAlerts.clear();
  ctx.preferenceOperation = null; ctx.preferenceBusy = false;
  ctx.conversation = { transcript: '', response: '', draft: '', resultId: null };
  knownAlerts = new Set(); initialAlerts = false;
  document.querySelectorAll('dialog[open]').forEach(d => d.close()); renderTransition();
  return ctx.realmGeneration;
}
async function switchHousehold(householdId) {
  if (ctx.transitioning) return;
  const realm = beginRealmTransition();
  try {
    const session = await Api.request('/api/auth/household', { method: 'POST', body: { household_id: householdId } });
    if (realm !== ctx.realmGeneration) return;
    state.session = session;
    Api.exitDemo(); realDemoSession = null;
    await ctx.refresh();
    if (realm !== ctx.realmGeneration) return;
    ctx.transitioning = false; Api.mutationsPaused = false;
    connectState(onUpdate, ctx.refresh); navigation.go('/'); render(true);
  } catch (error) {
    if (realm !== ctx.realmGeneration) return;
    if (error.status === 401) { resetSession(); }
    else {
      // Rotation may have committed even when its response was lost. Never
      // restore an old home's controls on an unverified current session.
      state.session = null; state.snapshot = null;
      app.replaceChildren(el('main', { class: 'main' }, empty('HomeAuto is unavailable', 'Check your local connection.', button('Try again', () => ctx.switchHome(householdId)))));
    }
    throw error;
  } finally { if (realm === ctx.realmGeneration) { ctx.transitioning = false; Api.mutationsPaused = false; } }
}
async function switchDemo(enabled, destination = '/') {
  if (ctx.transitioning || !state.session) return;
  const previous = { session: state.session, snapshot: state.snapshot, connected: state.connected, demo: Api.demo, realSession: realDemoSession };
  const session = realDemoSession || state.session;
  const realm = beginRealmTransition();
  let committed = false;
  try {
    if (enabled) {
      let storage = null; try { storage = sessionStorage; } catch {}
      realDemoSession = structuredClone(session); Api.startDemo(session, createDemoHome(session, storage)); state.session = session;
    } else {
      Api.exitDemo(); realDemoSession = null; const current = await Api.request('/api/auth/session'); if (realm !== ctx.realmGeneration) return; state.session = current;
    }
    await ctx.refresh(); if (realm !== ctx.realmGeneration) return; committed = true;
  } catch (error) {
    if (realm !== ctx.realmGeneration) return;
    if (error.status === 401) { ctx.transitioning = false; Api.mutationsPaused = false; resetSession(); }
    else {
      if (previous.demo) Api.startDemo(previous.session, previous.demo); else Api.exitDemo();
      realDemoSession = previous.realSession; state.session = previous.session; state.snapshot = previous.snapshot;
      state.connected = previous.connected; state.connecting = false;
    }
    throw error;
  } finally {
    if (realm === ctx.realmGeneration) {
    ctx.transitioning = false; Api.mutationsPaused = false;
    if (state.session) { connectState(onUpdate, ctx.refresh); if (committed) navigation.go(destination, { replace: true, direction: 'none' }); render(true); }
    }
  }
}
ctx.startDemo=()=>ctx.run(()=>switchDemo(true));
ctx.exitDemo=destination=>ctx.run(()=>switchDemo(false,typeof destination==='string'?destination:'/'));
ctx.demoScenario=kind=>ctx.run(async()=>{Api.demo?.scenario(kind);ctx.activityPage=null;await ctx.refresh();});
ctx.resetDemo=()=>modal('Reset demo home',el('p',{},t('Reset only the simulated lights, favorites and scenarios in this browser tab.')),{confirmLabel:'Reset demo',onConfirm:async()=>{Api.demo?.reset();ctx.activityPage=null;await ctx.refresh();}});
ctx.retryVoice = () => ctx.sensitive(async () => {
  const realm = ctx.realmGeneration;
  const { assets } = await Api.request('/api/ai/models');
  for (const asset of assets.filter(a => !a.ready && ['failed', 'not_configured'].includes(a.state))) {
    if (realm !== ctx.realmGeneration || !state.session) return;
    await Api.request('/api/ai/models/' + encodeURIComponent(asset.id) + '/activate', { method: 'POST', body: {} });
  }
  if (realm === ctx.realmGeneration && state.session) await ctx.refresh();
});
function voiceProgressText(phase) {
  return t(phase === 'encoding' ? 'Recognizing speech locally. This may take up to a minute.' : phase === 'decoding' ? 'Turning speech into text…' : phase === 'received' || phase === 'preparing' ? 'Checking the recording…' : 'Understanding…');
}
function setVoiceState(value) {
  const mic = document.getElementById('assistant-mic'); const label = document.getElementById('mic-label'); const status = document.getElementById('voice-status'); const cancel = document.getElementById('cancel-voice');
  if (!mic) return; const meter = document.getElementById('microphone-level'); if (meter && value !== 'listening') meter.value = 0; const listening = value === 'listening';
  const ready = speechAvailable(state.snapshot?.speech);
  const startup = speechStatus(state.snapshot?.speech);
  const cloud = Api.mode === 'cloud';
  const readiness = document.getElementById('assistant-readiness'); if (readiness) readiness.textContent = t(startup.label);
  const setupNote = document.getElementById('assistant-setup-note'); if (setupNote) { setupNote.hidden = ready && state.snapshot?.speech.provider !== 'browser'; setupNote.textContent = t(startup.note); }
  const retry = document.getElementById('retry-voice'); if (retry) retry.hidden = cloud || state.session?.user.role !== 'owner' || !['stt', 'tts'].some(kind => ['failed', 'not_configured'].includes(state.snapshot?.speech?.[kind + '_state']));
  const actionLabel = t(listening ? 'Finish recording' : value === 'processing' ? 'Processing voice' : 'Tap to speak');
  mic.setAttribute('aria-pressed', String(listening)); mic.setAttribute('aria-label', actionLabel);
  mic.disabled = !ready || !!ctx.preferenceBusy || ['processing', 'permission'].includes(value);
  mic.replaceChildren(icon(listening ? 'stop' : 'mic')); label.textContent = actionLabel; status.textContent = value === 'processing' ? voiceProgressText(ctx.voice?.phase) : t(listening ? 'Listening. Stops after a short pause. You can also tap Finish recording.' : value === 'permission' ? 'Connecting…' : ready ? 'Ready when you are' : startup.label); cancel.hidden = value === 'ready';
}
function assistantError(error) { ctx.conversation.error = true; ctx.assistantBusy = false; ctx.scheduleWake?.(); if (!['INTENT_AMBIGUOUS','RECOGNITION_UNCLEAR','RECOGNITION_AMBIGUOUS','WAKE_PHRASE_REQUIRED','INTENT_UNSUPPORTED','INTENT_UNKNOWN_TARGET','INTENT_NEGATED','INTENT_CONFLICTING'].includes(error.code)) ctx.live?.stop(); ctx.conversation.response = errorText(error, ctx.conversation.replyLanguage); ctx.conversation.securityLink = error.code === 'SENSITIVE_ACTION_REQUIRES_UI'; ctx.updateConversation?.(); ctx.notify(errorText(error), true); if (['INTENT_AMBIGUOUS','RECOGNITION_UNCLEAR','RECOGNITION_AMBIGUOUS','MICROPHONE_NO_SPEECH','WAKE_PHRASE_REQUIRED','VOICE_REQUEST_TOO_LONG','INTENT_UNSUPPORTED','INTENT_UNKNOWN_TARGET','INTENT_NEGATED','INTENT_CONFLICTING','SENSITIVE_ACTION_REQUIRES_UI'].includes(error.code) && state.snapshot?.speech?.tts_ready && state.snapshot.preferences.spoken_replies) ctx.speak(null, false, error.code); }
async function executeIntent(parsed, generation = ctx.assistantGeneration) {
  if (generation !== ctx.assistantGeneration) return;
  if (['en', 'hi'].includes(parsed.intent.reply_language)) ctx.conversation.replyLanguage = parsed.intent.reply_language;
  if (parsed.intent.sensitive) { assistantError({ code: 'SENSITIVE_ACTION_REQUIRES_UI' }); return; }
  if (parsed.intent.reply_key === 'goodbye' && ctx.live?.active) ctx.live.ending = true;
  ctx.conversation.commandIds = null; ctx.conversation.commandErrors = [];
  try {
    const result = await Api.request('/api/assistant/execute', { method: 'POST', body: { intent_id: parsed.intent_id, idempotency_key: crypto.randomUUID() } });
    if (generation !== ctx.assistantGeneration) return;
    ctx.assistantBusy = false; ctx.conversation.replyLanguage = result.answer?.language || result.language || parsed.intent.reply_language || ctx.conversation.replyLanguage || 'en';
    if (result.answer) { ctx.conversation.response = result.answer.text; ctx.conversation.resultId = result.answer.result_id; if (state.snapshot.preferences.spoken_replies) ctx.speak(result.answer.result_id); }
    else {
      const ids = result.commands.map(c => c.id); ctx.assistantBusy = ids.length > 0; ctx.conversation.commandIds = ids;
      ctx.conversation.resultId = result.result_id || null; ctx.conversation.commandErrors = result.errors || [];
      ctx.conversation.response = result.errors?.length ? result.errors.map(e => (state.snapshot.devices.find(d => d.id === e.device_id)?.name || e.device_id) + ': ' + errorText(e)).join(' ') : t('Request accepted') + '. ' + t(Api.mode === 'cloud' ? 'Queued for home hub' : 'Waiting for controller');
      if (!ids.length) { ctx.conversation.commandIds = null; if (state.snapshot.preferences.spoken_replies) ctx.speak(ctx.conversation.resultId); }
      await ctx.refresh(); if (generation !== ctx.assistantGeneration) return; updateCommandConversation();
    }
    ctx.updateConversation?.(); ctx.scheduleWake?.();
  } catch (e) { if (generation === ctx.assistantGeneration) assistantError(e); }
}
function updateCommandConversation() {
  const ids = ctx.conversation.commandIds; if (!ids?.length || !state.snapshot) return;
  const commands = ids.map(id => state.snapshot.commands.find(c => c.id === id)); if (commands.some(c => !c)) return;
  if (commands.every(c => ['observed', 'uncertain', 'failed', 'rejected', 'expired'].includes(c.state))) {
    ctx.conversation.response = commands.map(c => { const d = state.snapshot.devices.find(d => d.id === c.device_id); const hindi = ctx.conversation.replyLanguage === 'hi'; const label = c.state === 'observed' ? (hindi ? (state.snapshot.system.simulation || Api.demo ? 'डेमो' : 'कंट्रोलर की रिपोर्ट') : t(Api.demo ? 'Simulated report' : 'Controller reports')) : hindi ? 'पुष्टि नहीं हुई' : t('Not confirmed'); const action = hindi ? ({on:'चालू',off:'बंद',lock:'लॉक',unlock:'अनलॉक'})[c.action] || c.action : t(c.action); return `${d.name}: ${label} ${c.state === 'observed' ? action : ''}`; }).join('. ');
    ctx.conversation.response += (ctx.conversation.commandErrors || []).map(error => { const device = state.snapshot.devices.find(d => d.id === error.device_id); return '. ' + (device?.name || error.device_id) + ': ' + errorText(error, ctx.conversation.replyLanguage); }).join('');
    ctx.assistantBusy = false; ctx.conversation.commandIds = null; if (state.snapshot.preferences.spoken_replies) ctx.speak(ctx.conversation.resultId); ctx.updateConversation?.(); ctx.scheduleWake?.();
  }
}
function reviewVoiceIntent(parsed) {
  if (parsed.intent.sensitive || ['query', 'conversation'].includes(parsed.intent.kind) || state.snapshot?.system?.simulation === true) return executeIntent(parsed);
  const generation = ctx.assistantGeneration;
  ctx.assistantBusy = false; ctx.live?.stop();
  const devices = parsed.intent.device_ids.map(id => state.snapshot.devices.find(d => d.id === id)?.name || id).join(', ');
  modal('Review voice request', el('div', { class: 'stack' }, el('p', {}, ctx.conversation.transcript), el('p', {}, devices + ': ' + t(parsed.intent.action)), el('p', { class: 'small muted' }, t('Check the recognized device and action before sending.'))), { confirmLabel: 'Send request', onConfirm: () => generation === ctx.assistantGeneration ? executeIntent(parsed, generation) : undefined });
}
ctx.voice = new VoiceCapture({ getLanguage: () => preferences.language, onLevel: level => { const meter = document.getElementById('microphone-level'); if (meter) meter.value = level; }, onProgress: phase => { setVoiceState('processing'); ctx.conversation.response = voiceProgressText(phase); ctx.updateConversation?.(); }, onState: value => { ctx.live?.capture(value); if (value === 'permission') { ctx.beginTurn?.(); ctx.conversation.replyLanguage = state.snapshot.preferences.input_language === 'auto' ? preferences.language : state.snapshot.preferences.input_language; ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1; ctx.conversation.transcript = ''; ctx.conversation.commandIds = null; ctx.conversation.commandErrors = []; ctx.conversation.resultId = null; ctx.conversation.securityLink = false; } setVoiceState(value); if (['listening','processing'].includes(value)) { ctx.conversation.response = t(value === 'listening' ? 'Listening…' : 'Understanding…'); ctx.updateConversation?.(); } }, onError: assistantError, onTranscript: (text, language) => { if (['en','hi'].includes(language)) ctx.conversation.replyLanguage = language; ctx.conversation.transcript = text; ctx.updateConversation?.(); }, onIntent: reviewVoiceIntent });
navigation = new Navigation({ getSnapshot: () => state.snapshot || {}, onChange: change => {
  if (location.pathname !== '/signup') signupFailure = null;
  clearTimeout(ctx.roomSearchTimer); ctx.assistantBusy = false;
  ctx.live?.stop(); ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1; ctx.voice.cancel(); ctx.stopAudio();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  assistantBuilt = false; pendingNavigation = change; render(true);
} });
ctx.live = new LiveConversation({ listen: () => { if (document.hidden || location.pathname !== '/assistant' || !state.session) return ctx.endLive(); ctx.stopAudio(); ctx.pauseWake?.(); ctx.voice.start(state.snapshot.preferences.input_language, false); }, changed: () => { ctx.updateLive?.(); ctx.scheduleWake?.(); }, expired: () => { ctx.endLive(); ctx.notify(t('Conversation paused. Select Start conversation to continue.'), true); } });
ctx.updateLive = () => { const toggle = document.getElementById('live-conversation-toggle'); if (toggle) { toggle.textContent = t(ctx.live.active ? 'End conversation' : 'Start conversation'); toggle.setAttribute('aria-pressed', String(ctx.live.active)); } const status = document.getElementById('live-conversation-status'); if (status) status.textContent = t(ctx.live.active ? ({listening:'Listening…',processing:'Understanding…',speaking:'Speaking…',waiting:'Getting ready to listen…'})[ctx.live.phase] || 'Listening…' : 'The microphone opens again after each spoken reply. End conversation to stop.'); };
ctx.endLive = () => { ctx.assistantBusy = false; ctx.live?.stop(); ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1; ctx.voice.cancel(); ctx.stopAudio(); };
ctx.toggleLive = () => { if (ctx.live.active) return ctx.endLive(); if (!state.snapshot.preferences.spoken_replies) return ctx.notify(t('Enable spoken replies in Voice settings to start a conversation.'), true); if (!speechAvailable(state.snapshot.speech) || !speechAvailable(state.snapshot.speech, 'tts')) return ctx.notify(errorText({code:'BROWSER_RECOGNITION_UNAVAILABLE'}), true); ctx.pauseWake?.(); ctx.live.start(); };

ctx.beginTurn = () => { beginChatTurn(ctx.conversation); ctx.assistantBusy = true; };
ctx.pauseWake = () => { clearTimeout(ctx.wakeResumeTimer); ctx.wake?.pause(); };
ctx.scheduleWake = () => { clearTimeout(ctx.wakeResumeTimer); if (ctx.wake?.enabled) ctx.wakeResumeTimer = setTimeout(() => ctx.wake.resume(), 350); };
ctx.startVoice = () => { ctx.pauseWake(); ctx.live.stop(); ctx.stopAudio(); ctx.voice.start(state.snapshot.preferences.input_language, false); };
ctx.checkMicrophone = () => { ctx.pauseWake(); ctx.endLive(); showMicrophoneCheck(); };
ctx.updateWake = () => {
  const enabled = !!ctx.wake?.enabled;
  const status = document.getElementById('wake-listening-status'); if (status) { status.hidden = !enabled; const label = status.querySelector('[data-wake-label]'); if (label) label.textContent = t(ctx.wake.state === 'listening' ? 'Wake listening is on. Say Shrimaan to start.' : 'Wake listening is paused while you use the assistant.'); }
  for (const id of ['wake-settings-toggle', 'assistant-wake-toggle']) { const button = document.getElementById(id); if (button) { button.textContent = t(enabled ? 'Stop wake listening' : 'Start wake listening'); button.setAttribute('aria-pressed', String(enabled)); } }
};
ctx.wake = new WakeListener({ getLanguage: () => preferences.language,
  canListen: () => !!state.session && !!preferences.wakeRequired && !ctx.transitioning && !document.hidden && !ctx.assistantBusy && !ctx.live.active && ctx.voice.state === 'ready' && !ctx.browserSpeech?.utterance && !document.querySelector('dialog[open]'),
  onState: () => ctx.updateWake(),
  onError: error => { ctx.notify(errorText(error), true); ctx.updateWake(); },
  onWake: result => {
    if (!state.session || document.hidden || !preferences.wakeRequired) return;
    ctx.pauseWake(); ctx.stopAudio();
    if (location.pathname !== '/assistant') ctx.navigate('/assistant');
    const first = () => result.command ? ctx.voice.submit(result.command, state.snapshot.preferences.input_language) : ctx.voice.start(state.snapshot.preferences.input_language, false);
    if (state.snapshot.preferences.spoken_replies) ctx.live.start(first); else first();
  },
});
ctx.startWake = () => { if (!state.session || !speechAvailable(state.snapshot?.speech)) return ctx.notify(errorText({code:'BROWSER_RECOGNITION_UNAVAILABLE'}), true); ctx.endLive(); ctx.wake.start(state.snapshot.preferences.input_language); };
ctx.toggleWake = () => { if (ctx.wake.enabled) ctx.wake.stop(); else ctx.startWake(); };
ctx.setWakeEnabled = enabled => { ctx.wake.stop(); applyPreferences({wakeRequired:enabled}); if (enabled) ctx.startWake(); };
document.addEventListener('close', () => ctx.scheduleWake(), true);

const nav = [['Home', '/', 'home'], ['Rooms', '/rooms', 'rooms'], ['Security', '/security', 'shield'], ['Assistant', '/assistant', 'mic'], ['Settings', '/settings', 'settings']];
function brand() { return el('a', { class: 'brand', href: '/', 'aria-label': 'HomeAuto, ' + t('Home') }, icon('home'), el('span', { class: 'brand-name' }, 'HomeAuto')); }
function buildShell() {
  const current = routeInfo(location.pathname, state.snapshot).section;
  const sidebar = el('aside', { class: 'sidebar' }, brand(), el('p', { class: 'nav-label' }, t('Controls')), el('nav', { class: 'primary-nav', 'aria-label': t('Main navigation') }, nav.map(([label, href, key]) => el('a', { href, class: 'nav-item', ...(current === (href === '/' ? 'home' : href.slice(1)) ? { 'aria-current': 'page' } : {}) }, icon(key), el('span', {}, t(label))))),
    el('div', { class: 'sidebar-bottom' }, el('a', { href: '/security/activity', class: 'nav-item' }, icon('clock'), t('Activity')), el('a', { href: '/settings/help', class: 'nav-item' }, icon('help'), t('Help & support'))), el('p', { class: 'sidebar-note' }, icon('leaf', 'icon-small'), t(Api.mode === 'cloud' ? 'HomeAuto online' : 'Local and private')));
  const session = state.session.user; const activeAlerts = state.snapshot.alerts.filter(a => a.state === 'active' && !a.receipt.read_at).length;
  const top = el('header', { class: 'topbar' }, el('a', { class: 'home-name', href: '/', 'aria-label': t('My home'), title: t('Go home') }, icon('home'), el('span', {}, state.snapshot.home.home_name)), el('div', { class: 'top-actions' }, el('a', { href: '/security/alerts', class: 'icon-button', 'aria-label': t('Alerts') + (activeAlerts ? ' (' + activeAlerts + ')' : '') }, icon('bell')), el('a', { href: '/settings', class: 'icon-button profile', 'aria-label': t('Settings') }, session.preview ? icon('settings') : session.display_name.slice(0, 2).toUpperCase())));
  main = el('main', { class: 'main', id: 'main', tabindex: '-1' }); const workspace = el('div', { class: 'workspace' }, top);
  if (state.snapshot.system.simulation && !Api.demo) workspace.append(el('div', { class: 'banner banner-simulation', role: 'status' }, icon('info'), t('Simulation — no physical devices connected')));
  workspace.append(el('div', {class:'banner banner-wake', id:'wake-listening-status', role:'status', hidden:true}, icon('mic'), el('span', {'data-wake-label':''}), button('Stop wake listening', () => ctx.wake.stop(), {kind:'ghost'}))); workspace.append(main); app.replaceChildren(link('Skip to content', '#main', 'skip'), sidebar, workspace); shellBuilt = true; ctx.updateWake?.();
}
function frameView(view) {
  const info = routeInfo(location.pathname, state.snapshot);
  const heading = view.querySelector('h1') || el('h1', { tabindex: '-1' }, t(info.title));
  document.title = `${t(info.title)} | HomeAuto`;
  if (!view.contains(heading)) view.prepend(heading);
  if (!navigation.hasBack()) return view;
  const destination = routeInfo(navigation.destination(), state.snapshot);
  const back = button(t(destination.title), () => navigation.back(), { kind: 'ghost', symbol: 'back', className: 'back-control', 'aria-label': t('Back') + ': ' + t(destination.title), 'data-navigation-back': '' });
  const pageHead = heading.closest('.page-head'); const tools = pageHead?.querySelector('.page-tools');
  const header = el('div', { class: 'screen-navigation' }, back, heading, tools);
  if (pageHead) { if (!pageHead.textContent.trim()) pageHead.remove(); else pageHead.classList.add('page-description'); }
  view.prepend(header); return view;
}
function globalBanner() {
  if (state.connected && state.snapshot?.system?.hardware_required && state.snapshot.system.hardware_ready && (Api.mode !== 'cloud' || isGatewayCurrent() && state.snapshot.capabilities?.remote_lights)) {
    return el('div', { class: 'banner', role: 'status' }, t('Camera setup is pending. Check optional module connections on the Modules page.'), link('Modules', '/modules', 'button button-secondary'));
  }
  if (Api.demo) return el('div',{class:'banner banner-simulation demo-mode-bar',role:'status'},icon('info'),el('div',{class:'grow'},el('strong',{},t('Demo home')),el('p',{class:'small'},t('Simulated devices. No physical commands are sent.'))),button('Use my real home',()=>ctx.exitDemo(),{kind:'secondary'}));
  if (state.connecting) return el('p', { class: 'small muted' }, t('Connecting…'));
  if (Api.mode==='cloud' && state.connected && state.snapshot.gateway?.state === 'not_enrolled') return null;
  if (Api.mode==='cloud' && state.connected && ['awaiting_connection','revoked'].includes(state.snapshot.gateway?.state)) return el('div',{class:'banner',role:'status'},icon('home'),el('div',{class:'grow'},el('strong',{},t(state.snapshot.gateway.state==='revoked'?'Gateway access revoked':'Waiting for your home hub')),el('p',{class:'small'},t('Open gateway setup to finish connecting this home.'))),link('Gateway setup','/settings/gateway','button button-secondary'));
  if (Api.mode === 'cloud' && (!state.connected || !isGatewayCurrent())) return el('div', { class: 'banner', role: 'status' }, icon('wifi'), el('div', { class: 'grow' }, el('strong', {}, t(!state.connected ? 'Cloud connection lost' : 'Home gateway is offline')), el('p', { class: 'small' }, t(!state.connected ? 'Device reports may be old. Check your internet connection.' : 'Check the gateway power and internet connection.'))), link('Gateway setup', '/settings/gateway', 'button button-secondary'), button('Try again', () => ctx.run(ctx.refresh), { kind: 'ghost' }));
  if (!state.connected) return el('div', { class: 'banner', role: 'status' }, icon('wifi'), el('div', { class: 'grow' }, el('strong', {}, t('Home hub unavailable')), el('p', { class: 'small' }, t('Check your local connection.'))), button('Try again', () => ctx.run(ctx.refresh), { kind: 'ghost' }));
  const critical = state.snapshot.alerts.find(a => a.state === 'active' && a.severity === 'critical');
  if (critical && !location.pathname.includes('/alerts/')) return el('div', { class: 'banner banner-danger' }, icon('alert'), el('div', { class: 'grow' }, el('strong', {}, t('Gas sensor reports a possible issue.')), el('p', { class: 'small' }, t('Uncalibrated reading. Use an independent gas alarm.'))), link('View alert', '/security/alerts/' + critical.id));
  if (Api.mode === 'cloud' && !state.snapshot.capabilities?.remote_lights) return el('div', { class: 'banner', role: 'status' }, icon('shield'), el('div', { class: 'grow' }, el('strong', {}, t('Remote light control is off')), el('p', { class: 'small' }, t('Use the home hub for local controls.'))), link('Help & support', '/settings/help'));
  return null;
}
async function render(focus = false) {
  if (pageLeaving) return;
  if (ctx.transitioning) { renderTransition(); return; }
  if (!state.session) return renderLogin();
  if (['/signup', '/login'].includes(location.pathname)) { navigation.go('/', { replace: true, direction: 'none' }); return; }
  if (!state.snapshot) return;
  const id = ++renderId; renderingPath = navigation.path(); const active = document.activeElement; const samePath = lastPath.split('?')[0] === location.pathname;
  const drafts = samePath && lastPath === navigation.path() && main ? [...main.querySelectorAll('input,textarea,select')].filter(n => n.name && n.type !== 'radio' && n.type !== 'checkbox' && n.type !== 'range').map(n => [n.name, n.value]) : [];
  let focused = samePath ? active?.closest('dialog')?.returnFocus || captureFocus(active) : null; let selection = active?.selectionStart;
  const disclosures = samePath && main ? [...main.querySelectorAll('details')].map(n => n.open) : [];
  if (!shellBuilt || focus) buildShell();
  if (!samePath || !main.children.length) main.replaceChildren(frameView(el('div', {}, loadingPanel())));
  main.setAttribute('aria-busy', 'true');
  try {
    const view = await renderView(ctx); if (id !== renderId || !state.session) return;
    if (location.pathname === '/modules' && samePath && main) {
      // A status request can finish while the owner is editing connection details.
      // Preserve the values present now, including a deliberately cleared password.
      const latestDrafts = [...main.querySelectorAll('input,textarea,select')]
        .filter(input => input.name && !['radio', 'checkbox', 'range'].includes(input.type))
        .map(input => [input.name, input.value]);
      drafts.splice(0, drafts.length, ...latestDrafts);
    }
    // Focus may have returned from a dialog while this asynchronous view was
    // loading. Preserve the current owner instead of an earlier body focus.
    const currentFocus = document.activeElement;
    if (samePath && currentFocus?.isConnected && !currentFocus.closest('dialog')) {
      const latestFocus = captureFocus(currentFocus);
      if (latestFocus) { focused = latestFocus; selection = currentFocus.selectionStart; }
    }
    main.replaceChildren(el('div', { id: 'global-banner' }, globalBanner()), frameView(view)); lastPath = navigation.path();
    assistantBuilt = location.pathname === '/assistant';
    for (const [name, value] of drafts) { const input = [...main.querySelectorAll('input,textarea,select')].find(n => n.name === name); if (input) input.value = value; }
    [...main.querySelectorAll('details')].forEach((node, index) => { node.open = !!disclosures[index]; });
    if (pendingNavigation) {
      const change = pendingNavigation; pendingNavigation = null; main.dataset.direction = change.direction;
      if (change.direction !== 'none') { main.classList.remove('route-enter'); void main.offsetWidth; main.classList.add('route-enter'); }
      if (change.restore) navigation.restore(!change.initial); else { window.scrollTo(0, 0); main.querySelector('h1')?.focus({ preventScroll: true }); }
      document.querySelectorAll('.nav-item[href]').forEach(n => { if (routeInfo(location.pathname, state.snapshot).section === (n.getAttribute('href') === '/' ? 'home' : n.getAttribute('href').slice(1))) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
    } else if (!document.querySelector('dialog[open]') && focused) { restoreFocus(focused); try { document.activeElement?.setSelectionRange(selection, selection); } catch {} }
    setVoiceState(ctx.voice.state);
  } catch (e) { if (id !== renderId || !state.session) return; main.replaceChildren(frameView(el('div', {}, el('h1', { tabindex: '-1' }, t(routeInfo(location.pathname, state.snapshot).title)), empty('Unavailable', errorText(e), button('Try again', () => render()))))); }
  finally { if (id === renderId) { renderingPath = null; main?.removeAttribute('aria-busy'); } }
}
function onUpdate() {
  if (pageLeaving) return;
  if (ctx.transitioning) return;
  const hardwareBlocked = Api.mode === 'local' && state.snapshot?.system?.hardware_required && (!state.connected || !state.snapshot.system.hardware_ready);
  if (hardwareBlocked) {
    ctx.wake?.stop();
    ctx.endLive?.();
    assistantBuilt = false;
  }
  if (state.session && state.snapshot?.session) state.session.user = { ...state.session.user, ...state.snapshot.session };
  document.documentElement.dataset.connected = String(state.connected);
  document.getElementById('global-banner')?.replaceChildren(...[globalBanner()].filter(Boolean));
  const homeLabel = document.querySelector('.home-name span'); if (homeLabel && state.snapshot) homeLabel.textContent = state.snapshot.home.home_name;
  const bell = document.querySelector('.top-actions a[href="/security/alerts"]'); if (bell) { const count = state.snapshot.alerts.filter(a => a.state === 'active' && !a.receipt.read_at).length; bell.setAttribute('aria-label', t('Alerts') + (count ? ' (' + count + ')' : '')); }
  updateCommandConversation();
  for (const a of state.snapshot?.alerts || []) if (a.state === 'active' && !knownAlerts.has(a.id)) {
    knownAlerts.add(a.id);
    if (initialAlerts && ['gas', 'motion', 'access_denied'].includes(a.kind)) { const message = t(Api.demo ? 'Demo sensor scenario updated' : a.kind === 'gas' ? 'Gas sensor reports a possible issue.' : a.kind === 'access_denied' ? 'Door access was denied.' : 'Movement was detected.'); ctx.notify(message, a.kind === 'gas' || a.kind === 'access_denied'); if (!Api.demo && 'Notification' in window && Notification.permission === 'granted' && state.snapshot.preferences.notification_categories.includes(a.kind)) try { new Notification('HomeAuto', { body: message, tag: a.id }); } catch {} }
  }
  initialAlerts = true;
  if (location.pathname === '/assistant' && assistantBuilt) { setVoiceState(ctx.voice.state); ctx.updateConversation?.(); return; }
  // Keep cursor pages and reading position until the user explicitly refreshes.
  if (!hardwareBlocked && location.pathname === '/security/activity' && lastPath === navigation.path() && main?.children.length) return;
  // A laptop round trip may take longer than a cloud snapshot poll. Let the
  // current page finish instead of invalidating it with every telemetry update.
  if(renderingPath === navigation.path())return;
  render();
}
function authLanguages() {
  return el('div', { class: 'login-lang', role: 'group', 'aria-label': t('Language') }, el('button', { type: 'button', class: 'button button-ghost', onclick: () => applyPreferences({ language: 'en' }), 'aria-pressed': String(preferences.language === 'en') }, 'English'), el('button', { type: 'button', class: 'button button-ghost', onclick: () => applyPreferences({ language: 'hi' }), 'aria-pressed': String(preferences.language === 'hi') }, 'हिन्दी'));
}
function accountError(error, signup = false) {
  const code = ['CONNECTION_LOST', 'RESPONSE_UNAVAILABLE', 'CLOUD_UNAVAILABLE'].includes(error.code) ? (signup ? 'SIGNUP_NOT_CONFIRMED' : 'SIGNIN_UNAVAILABLE')
    : error.code === 'VALIDATION_ERROR' ? (signup ? 'ACCOUNT_DETAILS_INVALID' : 'INVALID_LOGIN')
    : ['INVALID_JSON', 'JSON_REQUIRED'].includes(error.code) ? 'ACCOUNT_FORM_UNREADABLE' : error.code;
  return { code, status: error.status };
}
function authLayout(form, signup = false) {
  const cloud = Api.mode === 'cloud';
  document.title = t(signup ? 'Create account' : 'Sign in') + ' · HomeAuto';
  app.replaceChildren(el('main', { class: 'login-layout' }, el('section', { class: 'login-story' }, brand(), el('p', { class: 'eyebrow' }, t(cloud ? 'HomeAuto online' : 'Local and private')), el('h1', { tabindex: '-1' }, t(signup ? 'Create your account' : cloud ? 'Sign in to HomeAuto' : 'Your home stays yours.')), el('p', {}, t(signup ? 'New accounts get a separate home. Devices connect through your home gateway.' : cloud ? 'Use your cloud account for online access. Local controls stay on the home hub.' : 'Internet is not needed for everyday controls.')), el('img', { src: '/assets/home-scene.svg', alt: '', width: 260, height: 220 })), el('section', { class: 'login-form-wrap', 'aria-label': t(signup ? 'Create account' : 'Sign in') }, form)));
  const heading = app.querySelector('h1'); requestAnimationFrame(() => { if (heading.isConnected && (document.activeElement === document.body || !app.contains(document.activeElement))) heading.focus({ preventScroll: true }); });
}
function renderSignup(draft = signupRequest?.draft || {}) {
  shellBuilt = false; main = null; ++renderId; lastPath = '';
  const display = field('Your name', { name: 'signup-name', value: draft['signup-name'] || '', autocomplete: 'name', maxLength: 80 });
  const username = field('Username', { name: 'signup-username', value: draft['signup-username'] || '', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', minlength: 3, maxLength: 32, pattern: '[A-Za-z0-9][A-Za-z0-9._\\-]{2,31}', title: t('Start with a letter or number.'), 'aria-describedby': 'signup-username-help' });
  username.node.append(el('span', { id: 'signup-username-help', class: 'small muted' }, t('Use 3–32 letters, numbers, dots, dashes or underscores.'), ' ', t('Start with a letter or number.')));
  username.node.firstElementChild.id = 'signup-username-label'; username.input.setAttribute('aria-labelledby', 'signup-username-label');
  const password = field('Password', { name: 'signup-password', value: draft['signup-password'] || '', type: 'password', autocomplete: 'new-password', minlength: 10, maxLength: 256, 'aria-describedby': 'signup-password-help' });
  password.node.append(el('span', { id: 'signup-password-help', class: 'small muted' }, t('Use at least 10 characters.')));
  password.node.firstElementChild.id = 'signup-password-label'; password.input.setAttribute('aria-labelledby', 'signup-password-label');
  const confirmation = field('Confirm password', { name: 'signup-confirm', value: draft['signup-confirm'] || '', type: 'password', autocomplete: 'new-password', minlength: 10, maxLength: 256 });
  const error = el('p', { class: 'form-error', role: 'alert', hidden: !signupFailure, tabindex: '-1' }, signupFailure && errorText(signupFailure));
  const submit = el('button', { type: 'submit', class: 'button button-primary button-full' }, t('Create account'));
  const pending = el('p', { class: 'small muted', role: 'status', hidden: !signupRequest }, t('Creating your account…'));
  const values = () => Object.fromEntries([...app.querySelectorAll('form input[name]')].map(input => [input.name, input.value]));
  const form = el('form', { class: 'login-form', novalidate: true }, authLanguages(), el('h2', {}, t('Your details')), display.node, username.node, password.node, confirmation.node,
    button('Show passwords', event => { const show = password.input.type === 'password'; password.input.type = confirmation.input.type = show ? 'text' : 'password'; event.currentTarget.querySelector('span').textContent = t(show ? 'Hide passwords' : 'Show passwords'); event.currentTarget.setAttribute('aria-pressed', String(show)); }, { kind: 'ghost', 'aria-pressed': 'false' }), error, pending, submit,
    el('div', { class: 'auth-footer' }, el('p', { class: 'small muted' }, t('Already have an account?')), link('Sign in', '/login', 'button button-secondary button-full')));
  const updatePending = () => {
    submit.disabled = !!signupRequest; pending.hidden = !signupRequest;
    form.setAttribute('aria-busy', String(!!signupRequest));
    for (const { input } of [display, username, password, confirmation]) input.readOnly = !!signupRequest;
    if (signupRequest) submit.setAttribute('aria-busy', 'true'); else submit.removeAttribute('aria-busy');
  };
  for (const { input } of [display, username, password, confirmation]) input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
  updatePending();
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (signupRequest) return; signupFailure = null; error.hidden = true;
    for (const { input } of [display, username, password, confirmation]) input.removeAttribute('aria-invalid');
    display.input.value = display.input.value.normalize('NFC').trim(); username.input.value = username.input.value.trim().toLowerCase();
    const invalid = !display.input.value || display.input.value.length > 80 || /[\u0000-\u001f\u007f]/u.test(display.input.value) ? [display.input, { code: 'INVALID_DISPLAY_NAME' }]
      : !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username.input.value) ? [username.input, { code: 'INVALID_USERNAME' }]
      : password.input.value.length < 10 || password.input.value.length > 256 ? [password.input, { code: 'PASSWORD_LENGTH' }]
      : password.input.value !== confirmation.input.value ? [confirmation.input, { code: 'PASSWORD_MISMATCH' }] : null;
    if (invalid) { invalid[0].setAttribute('aria-invalid', 'true'); error.textContent = errorText(invalid[1]); error.hidden = false; invalid[0].focus(); return; }
    const request = signupRequest = { draft: values() }; authNotice = false; updatePending();
    try {
      const result = await Api.request('/api/auth/signup', { method: 'POST', timeoutMs: 25000, body: { display_name: display.input.value, username: username.input.value, password: password.input.value } });
      if (result.created !== true || result.username !== request.draft['signup-username']) throw Object.assign(new Error('Account creation was not confirmed'), { code: 'RESPONSE_UNAVAILABLE' });
      if (!state.session) { authUsername = result.username; authNotice = true; if (location.pathname === '/signup') navigation.go('/login', { replace: true, direction: 'back' }); }
    } catch (e) {
      if (!state.session) authUsername = request.draft['signup-username'];
      if (!state.session && location.pathname === '/signup') signupFailure = accountError(e, true);
    } finally {
      if (signupRequest === request) signupRequest = null;
      request.draft = null;
      if (!state.session && location.pathname === '/signup') { const current = values(); renderSignup(current); if (signupFailure) app.querySelector('[role="alert"]')?.focus(); }
    }
  });
  authLayout(form, true);
}
function renderLocalSetup() {
  shellBuilt = false; main = null;
  const name = field('Display name', { name: 'setup-name', autocomplete: 'name' });
  const username = field('Username', { name: 'setup-username', autocomplete: 'username', autocapitalize: 'none' });
  const password = field('Password', { name: 'setup-password', type: 'password', autocomplete: 'new-password', minlength: 10, maxLength: 256 });
  const failure = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = el('button', { type: 'submit', class: 'button button-primary' }, t('Set up local owner'));
  const form = el('form', { class: 'login-form' }, el('h2', {}, t('Set up local owner')),
    el('p', {}, t('Choose the account that will manage this laptop’s home hardware. Use a password of at least 10 characters.')),
    name.node, username.node, password.node, failure, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true; failure.hidden = true;
    try {
      await Api.request('/api/auth/setup', { method: 'POST', body: { username: username.input.value.trim(), display_name: name.input.value.trim(), password: password.input.value } });
      password.input.value = '';
      await bootstrap();
    } catch (error) { failure.textContent = errorText(error); failure.hidden = false; }
    finally { submit.disabled = false; }
  });
  authLayout(form);
  document.title = t('Set up local owner') + ' · HomeAuto';
}
function renderLogin(draft = {}) {
  if (Api.mode === 'cloud' && location.pathname === '/signup') return renderSignup(draft);
  shellBuilt = false; main = null; const generation = ++renderId; lastPath = '';
  const username = field('Username', { name: 'username', value: draft.username || authUsername, autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' }); const password = field('Password', { name: 'password', value: draft.password || '', type: 'password', autocomplete: 'current-password', maxLength: 256 });
  const error = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = el('button', { type: 'submit', class: 'button button-primary button-full' }, t('Sign in'));
  const form = el('form', { class: 'login-form' }, authLanguages(), el('div', {}, el('h2', {}, t('Sign in to your home')), el('p', { class: 'muted' }, t(Api.mode === 'cloud' ? 'Use your username and password.' : 'Private controls, right here.'))), authNotice && el('p', { class: 'status status-success', role: 'status' }, t('Account created. Sign in to continue.')), username.node, password.node,
    button('Show password', event => { password.input.type = password.input.type === 'password' ? 'text' : 'password'; event.currentTarget.querySelector('span').textContent = t(password.input.type === 'password' ? 'Show password' : 'Hide password'); }, { kind: 'ghost' }), error, submit,
    Api.mode === 'cloud' ? el('div', { class: 'auth-footer' }, el('p', { class: 'small muted' }, t('New to HomeAuto?')), link('Create account', '/signup', 'button button-secondary button-full')) : el('p', { class: 'small muted' }, t('Set up an owner on the home hub first.')));
  form.addEventListener('submit', async event => { event.preventDefault(); if (submit.disabled) return; submit.disabled = true; error.hidden = true; try { const session = await Api.request('/api/auth/login', { method: 'POST', body: { username: username.input.value.trim(), password: password.input.value } }); if (generation !== renderId) { await bootstrap(); return; } authNotice = false; authUsername = ''; state.session = session; await ctx.refresh(); connectState(onUpdate, ctx.refresh); render(true); } catch (e) { if (generation === renderId) { error.textContent = errorText(Api.mode === 'cloud' ? accountError(e) : e); error.hidden = false; } } finally { submit.disabled = false; } });
  authLayout(form);
}
function resetSession() { ctx.wake?.stop(); ctx.realmGeneration++; ctx.commandOwners.clear(); ctx.transitioning = false; ctx.preferenceOperation = null; Api.mutationsPaused = false; Api.exitDemo(); realDemoSession=null; Api.sessionVersion++; ctx.pending.clear(); ctx.feedback.clear(); ctx.preferenceBusy = false; ctx.activityPage = null; ctx.live?.stop(); ctx.assistantGeneration = (ctx.assistantGeneration || 0) + 1; ctx.voice.cancel(); ctx.stopAudio(); disconnectState(); Api.csrf = null; ctx.conversation = { transcript: '', response: '', draft: '' }; knownAlerts = new Set(); initialAlerts = false; document.querySelectorAll('dialog').forEach(d => d.close()); renderLogin(); }
document.addEventListener('click', event => { const anchor = event.target.closest('a'); if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || anchor.target || anchor.hasAttribute('download')) return; const url = new URL(anchor.href); if (url.origin === location.origin && !url.hash && !url.pathname.startsWith('/assets/')) { event.preventDefault(); ctx.navigate(url.pathname + url.search); } });
window.addEventListener('session-expired', () => { if (state.session) resetSession(); });
globalThis.speechSynthesis?.addEventListener('voiceschanged', () => refreshBrowserVoiceChoices());
document.addEventListener('action-error', event => ctx.notify(errorText(event.detail), true));
let storageNotice = false;
window.addEventListener('preferences-change', () => { ctx.wakeRequired = preferences.wakeRequired; if (!preferences.wakeRequired) ctx.wake?.stop(); if (!state.session) { if (!authInitialized) return; const draft = Object.fromEntries([...app.querySelectorAll('form input[name]')].map(input => [input.name, input.value])); renderLogin(draft); return; } if (!preferences.persistent && !storageNotice) { storageNotice = true; ctx.notify(t('Saved for this visit only')); } shellBuilt = false; assistantBuilt = false; render(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { ctx.wake?.stop(); if (ctx.live?.active) ctx.endLive?.(); if (['permission','listening'].includes(ctx.voice.state)) ctx.voice.cancel('VOICE_PAGE_HIDDEN'); ctx.stopAudio(); } });
window.addEventListener('beforeunload', () => { ctx.wake?.stop(); ctx.live?.stop(); ctx.voice.cancel(); });
let lastActivity = 0;
for (const eventName of ['pointerdown', 'keydown']) document.addEventListener(eventName, event => {
  if (!event.isTrusted || !state.session || Date.now() - lastActivity < 60000) return;
  lastActivity = Date.now(); Api.request('/api/auth/activity', { method: 'POST', body: {} }).catch(() => {});
}, { passive: true });
applyPreferences({}, false);
// WebKit may deliver a final socket/poll event while this document is leaving.
// Do not start another view read in the departing document.
window.addEventListener('beforeunload', () => { pageLeaving = true; });
window.addEventListener('pagehide', () => { pageLeaving = true; });
window.addEventListener('pageshow', () => { pageLeaving = false; });
async function bootstrap() {
  try { await Api.initialize(); authInitialized = true; state.session = await Api.request('/api/auth/session'); if(Api.mode==='cloud'&&Api.restoreDemo(state.session)){realDemoSession=structuredClone(state.session);let storage=null;try{storage=sessionStorage;}catch{}Api.startDemo(state.session,createDemoHome(state.session,storage));} await ctx.refresh(); connectState(onUpdate, ctx.refresh); render(); }
  catch (error) {
    if (error.status === 401) {
      if (Api.mode === 'local') {
        try { if ((await Api.request('/api/auth/setup-status')).setup_required) return renderLocalSetup(); } catch {}
      }
      return renderLogin();
    }
    shellBuilt = false; app.replaceChildren(el('main', { class: 'main' }, empty(Api.mode === 'cloud' ? (['CLOUD_CONFIGURATION_REQUIRED', 'CLOUD_SCHEMA_REQUIRED', 'UNSAFE_DATABASE_ROLE'].includes(error.code) ? 'Cloud setup is incomplete' : 'HomeAuto is unavailable') : 'Home hub unavailable', Api.mode === 'cloud' ? (['CLOUD_CONFIGURATION_REQUIRED', 'CLOUD_SCHEMA_REQUIRED', 'UNSAFE_DATABASE_ROLE'].includes(error.code) ? 'Ask the home owner to finish cloud setup.' : 'Check your internet connection and try again.') : 'Check your local connection.', button('Try again', bootstrap))));
  }
}
await bootstrap();
