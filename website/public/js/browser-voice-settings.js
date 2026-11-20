import { el, select, button } from './components.js';
import { t } from './i18n.js';
import { preferences, applyPreferences } from './preferences.js';
import { browserSpeechAvailable, browserVoiceKey, matchingBrowserVoices } from './browser-voice.js';

// Refresh only the choices when the browser loads voices, preserving focus and
// the rest of the settings form. No voice enumeration opens the microphone.
export function refreshBrowserVoiceChoices(root = document) {
  for (const [language, key] of [['en', 'englishVoice'], ['hi', 'hindiVoice']]) {
    const input = root.querySelector('#browser-voice-' + language);
    if (!input) continue;
    const voices = matchingBrowserVoices(language);
    const unique = [...new Map(voices.map(voice => [browserVoiceKey(voice), voice])).values()];
    const selected = preferences[key];
    const options = [el('option', { value: '' }, t('Automatic (natural female when available)'))];
    if (selected && !unique.some(voice => browserVoiceKey(voice) === selected)) options.push(el('option', { value: selected }, t('Saved voice unavailable — using Automatic')));
    options.push(...unique.map(voice => el('option', { value: browserVoiceKey(voice) }, `${voice.name || voice.lang} · ${voice.lang} · ${t(voice.localService ? 'On-device' : 'Online voice')}`)));
    input.replaceChildren(...options); input.value = selected;
    input.disabled = !unique.length;
    const preview = root.querySelector('#preview-voice-' + language);
    if (preview) preview.disabled = !unique.length || !browserSpeechAvailable();
    const note = root.querySelector('#browser-voice-note-' + language);
    if (note) note.textContent = unique.length ? '' : t(language === 'hi' ? 'No Hindi voice is available. Add a Hindi speech voice in your device settings, then reload.' : 'No English voice is available. Check your device speech settings, then reload.');
  }
}

export function browserVoiceSettings(ctx) {
  const root = el('section', { class: 'card stack', 'aria-labelledby': 'browser-voices-title' },
    el('h2', { id: 'browser-voices-title' }, t('Browser voices')),
    el('p', { class: 'small muted' }, t('Automatic prefers a natural female voice when available. You can choose and test any listed voice.')));
  for (const [language, label, key, previewLabel] of [['en', 'English voice', 'englishVoice', 'Test English voice'], ['hi', 'Hindi voice', 'hindiVoice', 'Test Hindi voice']]) {
    const choice = select(label, 'browser-voice-' + language, [], '');
    choice.input.setAttribute('aria-describedby', 'browser-voice-note-' + language);
    choice.input.addEventListener('change', () => { ctx.endLive(); applyPreferences({ [key]: choice.input.value }); });
    root.append(choice.node, el('p', { id: 'browser-voice-note-' + language, class: 'small muted', role: 'status' }),
      button(previewLabel, () => ctx.previewVoice(language), { id: 'preview-voice-' + language, symbol: 'sound' }));
  }
  const volume = el('input', { id: 'browser-voice-volume', type: 'range', min: '.1', max: '1', step: '.1', value: preferences.voiceVolume, 'aria-label': t('Speech volume'), 'aria-valuetext': Math.round(preferences.voiceVolume * 100) + '%' });
  const output = el('output', { for: 'browser-voice-volume' }, Math.round(preferences.voiceVolume * 100) + '%');
  volume.addEventListener('input', () => { output.textContent = Math.round(Number(volume.value) * 100) + '%'; volume.setAttribute('aria-valuetext', output.textContent); });
  volume.addEventListener('change', () => { ctx.endLive(); applyPreferences({ voiceVolume: Number(volume.value) }); });
  root.append(el('label', { class: 'field', for: 'browser-voice-volume' }, t('Speech volume'), volume, output),
    button('Test microphone', ctx.checkMicrophone, { symbol: 'mic' }),
    el('p', { class: 'small muted' }, t('At 100%, speech uses the browser’s maximum volume. Your device volume still applies.')),
    el('div', { id: 'assistant-audio-output', role: 'status' }),
    button('Stop speech', () => ctx.endLive(), { kind: 'ghost', symbol: 'stop' }));
  refreshBrowserVoiceChoices(root);
  return root;
}
