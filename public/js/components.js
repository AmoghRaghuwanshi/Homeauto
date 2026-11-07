import { t } from './i18n.js';
import { captureFocus, restoreFocus } from './navigation.js';
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), event => {
      const failure = error => document.dispatchEvent(new CustomEvent('action-error', { detail: error }));
      try { const result = value(event); if (result?.then) { const pending = node.tagName === 'BUTTON' && !node.disabled; if (pending) { node.disabled = true; node.setAttribute('aria-busy', 'true'); } Promise.resolve(result).catch(failure).finally(() => { if (pending) { node.disabled = false; node.removeAttribute('aria-busy'); } }); } } catch (error) { failure(error); }
    });
    else if (key === 'checked' || key === 'disabled' || key === 'value') node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== undefined && child !== null && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const shapes = {
  home: ['path', 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z'],
  rooms: ['path', 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
  shield: ['path', 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z M8 12l3 3 5-6'],
  mic: ['path', 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8'],
  settings: ['path', 'm9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3z M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0'],
  bulb: ['path', 'M9 18h6 M10 22h4 M8 15a7 7 0 1 1 8 0v2H8Z'],
  lock: ['path', 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3'],
  unlock: ['path', 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 7-3 M12 14v3'],
  gas: ['path', 'M12 2c1 5 7 7 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 4 2-2 1-5 1-9Z'],
  motion: ['path', 'M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M5 11l5-4 4 2 4 4 M10 8l-2 7 5 2 1 5 M8 15l-4 6'],
  bell: ['path', 'M5 16h14l-2-4V8a5 5 0 0 0-10 0v4z M10 20h4'],
  arrow: ['path', 'm9 5 7 7-7 7'],
  back: ['path', 'm14 5-7 7 7 7'],
  plus: ['path', 'M12 5v14 M5 12h14'],
  check: ['path', 'm5 12 4 4L19 6'],
  star: ['path', 'm12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z'],
  clock: ['path', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2'],
  alert: ['path', 'm12 3 10 18H2Z M12 8v6 M12 17v1'],
  leaf: ['path', 'M20 3C8 1 1 10 6 17s16 0 14-14Z M5 21l10-12'],
  user: ['path', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 22v-3a8 8 0 0 1 16 0v3'],
  card: ['path', 'M3 5h18v14H3z M3 10h18 M7 15h3'],
  search: ['path', 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6'],
  sun: ['path', 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10 M12 1v3 M12 20v3 M1 12h3 M20 12h3 M4 4l2 2 M18 18l2 2 M20 4l-2 2 M6 18l-2 2'],
  sound: ['path', 'M3 9h4l5-5v16l-5-5H3Z M16 8a6 6 0 0 1 0 8 M19 4a11 11 0 0 1 0 16'],
  stop: ['path', 'M6 6h12v12H6z'],
  help: ['path', 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17v1'],
  edit: ['path', 'm15 3 6 6L8 22H2v-6Z M12 6l6 6'],
  wifi: ['path', 'M2 8a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M8 16a6 6 0 0 1 8 0 M12 20h.01'],
};
export function icon(name, className = '') {
  const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon ' + className })) svg.setAttribute(k, v);
  const shape = document.createElementNS(ns, 'path'); shape.setAttribute('d', (shapes[name] || shapes.home)[1]); svg.append(shape); return svg;
}
export const button = (label, action, { kind = 'secondary', symbol, disabled = false, className = '', ...rest } = {}) => el('button', { type: 'button', class: `button button-${kind} ${className}`, disabled, onclick: action, ...rest }, symbol && icon(symbol), el('span', {}, t(label)));
export const link = (label, href, className = '') => el('a', { href, class: className }, t(label));
export function field(label, { name, type = 'text', value = '', required = true, maxLength = 80, ...props } = {}) {
  const id = 'field-' + (name || crypto.randomUUID());
  const input = el('input', { id, name: name || id, type, value, required, maxlength: maxLength, ...props });
  return { input, node: el('label', { class: 'field', for: id }, el('span', {}, t(label)), input) };
}
export function select(label, name, options, selected) {
  const input = el('select', { id: name, name, 'aria-label': t(label) }, options.map(o => el('option', { value: o.value, ...(o.value === selected ? { selected: 'selected' } : {}) }, t(o.label))));
  return { input, node: el('label', { class: 'field', for: name }, el('span', {}, t(label)), input) };
}
export function empty(title, description, action) { return el('section', { class: 'empty-panel' }, el('span', { class: 'icon-well' }, icon('leaf')), el('h2', {}, t(title)), el('p', { class: 'muted' }, t(description)), action); }
export function status(text, tone = 'neutral') { return el('span', { class: `status status-${tone}` }, t(text)); }
export function modal(title, content, { confirmLabel = 'Save', onConfirm, danger = false, readOnly = false } = {}) {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  const headingId = 'dialog-' + crypto.randomUUID();
  const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': headingId });
  const error = el('p', { class: 'form-error', role: 'alert', hidden: true });
  const cancel = button('Cancel', () => dialog.close());
  const form = el('form', { class: 'dialog-content' }, el('h2', { id: headingId }, t(title)), content, error);
  const submit = el('button', { type: 'submit', class: `button button-${danger ? 'danger' : 'primary'}` }, t(confirmLabel));
  form.append(el('div', { class: 'dialog-actions' }, !readOnly && cancel, submit)); dialog.append(form); document.body.append(dialog);
  form.addEventListener('submit', async event => { event.preventDefault(); if (submit.disabled) return; submit.disabled = true; cancel.disabled = true; error.hidden = true; try { await onConfirm?.(form); dialog.close(); } catch (e) { const { errorText } = await import('./i18n.js'); error.textContent = errorText(e); error.hidden = false; error.tabIndex = -1; error.focus(); } finally { submit.disabled = false; cancel.disabled = false; } });
  dialog.addEventListener('cancel', event => { if (submit.disabled) event.preventDefault(); });
  const opener = document.activeElement; const saved = captureFocus(opener); dialog.returnFocus = saved; dialog.addEventListener('close', () => { dialog.remove(); if (opener?.isConnected) opener.focus(); else restoreFocus(saved); }, { once: true }); dialog.showModal(); (danger || title.includes('Unlock') ? cancel : form.querySelector('input,select,button'))?.focus(); return dialog;
}
