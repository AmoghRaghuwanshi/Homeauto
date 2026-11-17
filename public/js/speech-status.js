// Keep startup feedback consistent across Assistant, Voice settings and Local AI.
export function modelStatus(ready, phase) {
  if (ready) return { label: 'Ready locally', note: '', tone: 'success' };
  if (phase === 'checking' || phase === 'loading') return {
    label: phase === 'checking' ? 'Checking voice models…' : 'Loading voice models…',
    note: 'Voice is starting on this computer. You can type while it loads.',
    tone: 'neutral',
  };
  if (phase === 'failed' || phase === 'stopped') return {
    label: 'Voice could not start', note: 'The speech model stopped or could not start. Try Retry voice, or ask the home owner to check Local AI.', tone: 'warning',
  };
  if (phase === 'disabled') return {
    label: 'Voice is disabled', note: 'Voice is disabled on the home hub. You can still type.', tone: 'neutral',
  };
  return { label: 'Local setup required', note: 'Voice needs local setup. You can still type.', tone: 'neutral' };
}
export function speechStatus(speech, kind = 'stt') {
  if (speech?.provider === 'browser') {
    if (!speech[kind + '_ready']) return modelStatus(false, 'disabled');
    const supported = speechAvailable(speech, kind);
    return { label: supported ? 'Browser voice' : 'Browser voice unavailable',
      note: supported ? 'Your browser handles listening and speaking. Recognition may use an online service.' : kind === 'stt' ? 'This browser cannot recognize speech here. Use a supported browser on HTTPS or localhost, or type a request.' : 'Speech output is unavailable in this browser. Replies remain visible as text.', tone: supported ? 'success' : 'neutral' };
  }
  return modelStatus(speech?.[kind + '_ready'], speech?.[kind + '_state']);
}
export function speechAvailable(speech, kind = 'stt') {
  if (!speech?.[kind + '_ready']) return false;
  if (speech.provider !== 'browser') return true;
  return kind === 'stt' ? !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition) && globalThis.isSecureContext !== false : !!globalThis.speechSynthesis && !!globalThis.SpeechSynthesisUtterance;
}
