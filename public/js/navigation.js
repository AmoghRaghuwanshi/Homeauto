// One route registry and one owner of History API writes. Only navigation and
// list context enter history.state; device state and form secrets never do.
const roots = { '/': ['Home', 'home'], '/rooms': ['Rooms', 'rooms'], '/security': ['Security', 'security'], '/assistant': ['Shrimaan', 'assistant'], '/settings': ['Settings', 'settings'] };
const pages = {
  '/security/door': ['Front door', '/security', 'security'],
  '/security/access-cards': ['Access cards', '/security', 'security'],
  '/security/activity': ['Activity', '/security', 'security'],
  '/security/alerts': ['Alerts', '/security', 'security'],
  '/settings/appearance': ['Appearance', '/settings', 'settings'],
  '/settings/accessibility': ['Accessibility', '/settings', 'settings'],
  '/settings/language': ['Language', '/settings', 'settings'],
  '/settings/voice': ['Voice & assistant', '/settings', 'settings'],
  '/settings/notifications': ['Notifications', '/settings', 'settings'],
  '/settings/home': ['Home details', '/settings', 'settings'],
  '/settings/privacy': ['Security & privacy', '/settings', 'settings'],
  '/settings/help': ['Help & support', '/settings', 'settings'],
  '/settings/about': ['About', '/settings', 'settings'],
  '/settings/devices': ['Devices', '/settings', 'settings'],
  '/settings/advanced': ['Advanced', '/settings', 'settings'],
  '/settings/advanced/ai': ['Local AI', '/settings/advanced', 'settings'],
};
export function routeInfo(path, snapshot = {}) {
  const pathname = path.split('?')[0];
  if (roots[pathname]) return { known: true, root: true, title: roots[pathname][0], section: roots[pathname][1], parent: '/' };
  if (pages[pathname]) return { known: true, root: false, title: pages[pathname][0], parent: pages[pathname][1], section: pages[pathname][2] };
  const room = pathname.match(/^\/rooms\/([^/]+)$/);
  if (room) { const r = snapshot.rooms?.find(r => r.id === room[1]); if (r) return { known: true, title: r.name, parent: '/rooms', section: 'rooms' }; }
  const device = pathname.match(/^\/devices\/([^/]+)$/);
  if (device) { const d = snapshot.devices?.find(d => d.id === device[1]); if (d) return { known: true, title: d.name, parent: d.type === 'door' ? '/security' : '/rooms/' + d.room_id, section: d.type === 'door' ? 'security' : 'rooms' }; }
  if (/^\/security\/alerts\/[^/]+$/.test(pathname) && snapshot.alerts?.some(a => pathname.endsWith('/' + a.id))) return { known: true, title: 'Alert details', parent: '/security/alerts', section: 'security' };
  return { known: false, title: 'Page not found', section: null, parent: '/' };
}
export function captureFocus(element = document.activeElement) {
  if (!element || element === document.body) return null;
  const scope = element.closest('[data-device-id]')?.dataset.deviceId || null;
  if (element.id) return { type: 'id', value: element.id, scope };
  if (element.name) return { type: 'name', value: element.name, option: element.type === 'radio' ? element.value : undefined, scope };
  if (element.tagName === 'A') return { type: 'href', value: element.getAttribute('href'), scope };
  if (element.tagName === 'BUTTON') return { type: 'button', value: element.getAttribute('aria-label') || element.textContent, scope };
  return null;
}
export function restoreFocus(saved) {
  if (!saved) return false;
  const scope = saved.scope ? [...document.querySelectorAll('[data-device-id]')].find(n => n.dataset.deviceId === saved.scope) : document;
  if (!scope) return false;
  const node = saved.type === 'id' ? document.getElementById(saved.value) : [...scope.querySelectorAll(saved.type === 'button' ? 'button' : saved.type === 'href' ? 'a[href]' : '[name]')].find(n => (saved.type === 'button' ? n.getAttribute('aria-label') || n.textContent : saved.type === 'href' ? n.getAttribute('href') : n.name) === saved.value && (saved.option === undefined || n.value === saved.option));
  if (!node || node.disabled || node.hidden) return false;
  node.focus({ preventScroll: true }); return document.activeElement === node;
}
const validPath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && value.length <= 2000;
const entry = value => value && validPath(value.path) && typeof value.key === 'string';
export class Navigation {
  constructor({ getSnapshot, onChange }) {
    this.getSnapshot = getSnapshot; this.onChange = onChange;
    this.current = this.read(history.state); this.persist(true); history.scrollRestoration = 'manual';
    let scrolling = false;
    window.addEventListener('scroll', () => { if (scrolling) return; scrolling = true; const key = this.current.key; requestAnimationFrame(() => { scrolling = false; if (this.current.key === key) { this.current.scroll = [scrollX, scrollY]; this.persist(); } }); }, { passive: true });
    document.addEventListener('focusin', event => { if (!event.target.closest('dialog')) { this.current.focus = captureFocus(event.target); this.persist(); } });
    window.addEventListener('pagehide', () => this.save());
    window.addEventListener('popstate', event => {
      clearTimeout(this.persistTimer);
      const previous = this.current; this.current = this.read(event.state);
      const direction = previous.trail.some(e => e.key === this.current.key) ? 'back' : 'forward';
      this.onChange({ direction, restore: true });
    });
  }
  path() { return location.pathname + location.search; }
  read(state) {
    const value = state?.homeautoNavigation;
    if (value?.version === 1 && entry(value) && value.path === this.path() && Array.isArray(value.trail)) return { ...value, trail: value.trail.filter(entry).slice(-32) };
    return { version: 1, key: crypto.randomUUID(), path: this.path(), trail: [], scroll: [0, 0], focus: null };
  }
  persist(immediate = false) {
    clearTimeout(this.persistTimer);
    // Focus and scrolling can emit dozens of events per second. Keep the latest
    // position in memory, then coalesce the history write; Safari limits writes.
    if (!immediate) { this.persistTimer = setTimeout(() => this.persist(true), 300); return; }
    if (this.path() === this.current.path && JSON.stringify(history.state?.homeautoNavigation) === JSON.stringify(this.current)) return;
    history.replaceState({ ...history.state, homeautoNavigation: this.current }, '', this.current.path);
  }
  save() { this.current.scroll = [scrollX, scrollY]; this.current.focus = captureFocus(); this.persist(true); }
  destination() {
    const info = routeInfo(this.path(), this.getSnapshot());
    const previous = this.current.trail.at(-1);
    return previous && routeInfo(previous.path, this.getSnapshot()).known ? previous.path : info.parent;
  }
  hasBack() { const info = routeInfo(this.path(), this.getSnapshot()); return this.path() !== '/' && (!info.root || this.current.trail.length > 0); }
  go(path, { replace = false, direction = 'forward' } = {}) {
    if (!validPath(path)) return;
    const url = new URL(path, location.origin); if (url.origin !== location.origin || url.hash) return;
    path = url.pathname + url.search;
    if (path === this.path()) { this.onChange({ direction: 'none', restore: false }); return; }
    this.save();
    const { trail, ...previous } = this.current;
    this.current = { version: 1, key: crypto.randomUUID(), path, trail: replace ? trail : [...trail, previous].slice(-32), scroll: [0, 0], focus: null };
    const state = { homeautoNavigation: this.current };
    if (replace) history.replaceState(state, '', path); else history.pushState(state, '', path);
    this.onChange({ direction, restore: false });
  }
  back() {
    const previous = this.current.trail.at(-1);
    if (previous && routeInfo(previous.path, this.getSnapshot()).known) history.back();
    else this.go(routeInfo(this.path(), this.getSnapshot()).parent, { replace: true, direction: 'back' });
  }
  query(patch) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(patch)) if (value === '' || value === null || value === undefined || value === 'all') url.searchParams.delete(key); else url.searchParams.set(key, String(value));
    this.current.path = url.pathname + url.search; this.persist(true);
  }
  restore(focus = true) {
    window.scrollTo(...(this.current.scroll || [0, 0]));
    if (focus && !restoreFocus(this.current.focus)) document.querySelector('main h1')?.focus({ preventScroll: true });
  }
}
