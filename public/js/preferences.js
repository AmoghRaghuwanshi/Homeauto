export const themes = [
  { id: '05', name: 'Serene Emerald', description: 'White surfaces and emerald accents.', color: '#166F46' },
  { id: '01', name: 'Warm Organic', description: 'Natural warmth and soft greens.', color: '#1D7049' },
  { id: '03', name: 'Universal Comfort', description: 'Larger text and controls.', color: '#246BC4' },
  { id: '04', name: 'Friendly Pastel', description: 'Gentle color for every room.', color: '#2565C7' },
];
const keys = { theme: 'homeauto.theme.v1', language: 'homeauto.language.v1', largeText: 'homeauto.largeText.v1', largeControls: 'homeauto.largeControls.v1', reducedMotion: 'homeauto.reducedMotion.v1', strongOutlines: 'homeauto.strongOutlines.v1', wakeRequired: 'homeauto.wakeRequired.v1' };
export function readPreferences() {
  const prefs = { theme: '05', language: 'en', largeText: false, largeControls: false, reducedMotion: false, strongOutlines: false, wakeRequired: false, persistent: true };
  try { for (const [key, storage] of Object.entries(keys)) { const value = localStorage.getItem(storage); if (key === 'theme') prefs.theme = themes.some(t => t.id === value) ? value : '05'; else if (key === 'language') prefs.language = value === 'hi' ? 'hi' : 'en'; else prefs[key] = value === 'true'; } } catch { prefs.persistent = false; }
  return prefs;
}
export let preferences = readPreferences();
export function applyPreferences(patch = {}, save = true) {
  preferences = { ...preferences, ...patch };
  if (!themes.some(t => t.id === preferences.theme)) preferences.theme = '05';
  if (!['en','hi'].includes(preferences.language)) preferences.language = 'en';
  document.documentElement.dataset.theme = preferences.theme;
  document.documentElement.lang = preferences.language === 'hi' ? 'hi' : 'en';
  for (const key of ['largeText', 'largeControls', 'reducedMotion', 'strongOutlines']) document.documentElement.dataset[key] = String(!!preferences[key]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F8F9F7');
  if (save) try { for (const [key, storage] of Object.entries(keys)) localStorage.setItem(storage, String(preferences[key])); } catch { preferences.persistent = false; }
  window.dispatchEvent(new CustomEvent('preferences-change'));
  return preferences;
}
window.addEventListener('storage', event => { if (event.key === null || Object.values(keys).includes(event.key)) { preferences = readPreferences(); applyPreferences({}, false); } });
