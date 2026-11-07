import { el, icon, button, link, field, select, empty, status, modal } from './components.js';
import { t, dateText, errorText } from './i18n.js';
import { preferences, themes, applyPreferences } from './preferences.js';
import { Api } from './api.js';
import { state, deviceById, isCurrentReport } from './state.js';
import { routeInfo } from './navigation.js';

const symbol = d => d.type === 'light' ? 'bulb' : d.type === 'door' ? 'lock' : d.id === 'sensor-gas' ? 'gas' : 'motion';
const tone = d => !reported(d) ? 'neutral' : ['alert', 'unlocked'].includes(d.observation.reported_status) ? 'warning' : ['on', 'locked'].includes(d.observation.reported_status) ? 'success' : 'neutral';
const name = d => d.id === 'door-1' && d.name === 'Front Door' ? t('Front door') : d.id === 'sensor-gas' && d.name === 'Gas Sensor' ? t('Gas sensor') : d.id === 'sensor-motion' && d.name === 'Motion Sensor' ? t('Motion sensor') : d.name;
const reported = isCurrentReport;
const owner = () => state.session?.user.role === 'owner';
const metadataOwner = () => owner() && Api.mode !== 'cloud';
const control = () => ['owner', 'resident'].includes(state.session?.user.role);
const title = (text, description, actions) => el('div', { class: 'page-head' }, el('div', { class: 'page-heading' }, el('h1', { tabindex: '-1' }, t(text)), description && el('p', {}, t(description))), actions && el('div', { class: 'page-tools' }, actions));
const section = (heading, body, href) => el('section', { class: 'content-section' }, el('div', { class: 'section-heading' }, el('h2', {}, t(heading)), href && link('View all', href)), body);
const navButton = (label, href, symbolName, kind = 'secondary') => el('a', { class: `button button-${kind}`, href }, symbolName && icon(symbolName), t(label));
const well = (key, kind = key) => el('span', { class: 'icon-well icon-well-' + kind }, icon(key));
const helpNote = text => el('p', { class: 'warning-note' }, t(text));
function checkbox(label, checked, onChange, description, disabled = false) { const input = el('input', { id: 'preference-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), type: 'checkbox', checked, disabled, onchange: e => onChange(e.target.checked) }); return el('label', { class: 'check-field' }, input, el('span', {}, el('span', {}, t(label)), description && el('span', { class: 'small muted' }, '. ', t(description)))); }
function dataList(items) { return el('dl', { class: 'details-list' }, Object.entries(items).flatMap(([k, v]) => [el('dt', {}, t(k)), el('dd', {}, v)])); }
function deviceStatus(d) { const labels = { on:'On', off:'Off', locked:'Locked', unlocked:'Unlocked', normal:'No alert reported', alert:'Alert reported', clear:'No motion reported', detected:'Motion reported' }; return reported(d) ? t(labels[d.observation.reported_status] || d.observation.reported_status) : t(d.observation.freshness === 'unknown' ? 'No reading yet' : 'Unavailable'); }
function deviceCard(d, ctx, { manage = false } = {}) {
  const pending = d.pending_command_id || ctx.pending.has(d.id); const favorite = state.snapshot.preferences.favorites.includes(d.id);
  const latestCommand = state.snapshot.commands.find(c => c.device_id === d.id); const recent = ['uncertain', 'failed', 'expired', 'rejected'].includes(latestCommand?.state) ? latestCommand : null;
  const live = state.connected && d.connectivity === 'online' && !pending && control() && (Api.mode !== 'cloud' || (state.snapshot.capabilities?.remote_lights && reported(d)));
  const route = d.type === 'door' ? '/security/door' : '/devices/' + d.id;
  const visualState = pending ? 'pending' : !reported(d) ? 'unavailable' : d.observation.reported_status;
  const favoriteButton = el('button', { class: 'favorite-button', type: 'button', disabled: ctx.preferenceBusy, 'aria-label': t('Favorite') + ': ' + name(d), 'aria-pressed': String(favorite), onclick: () => ctx.favorite(d.id) }, icon('star'));
  const card = el('article', { class: 'card device-card', 'data-device-id': d.id, 'data-type': d.type, 'data-state': visualState },
    el('div', { class: 'device-card-header' }, el('div', { class: 'device-identity' }, well(symbol(d), d.type === 'light' ? 'light' : d.type === 'door' ? 'door' : d.id === 'sensor-gas' ? 'gas' : 'motion'), el('div', { class: 'grow' }, el('h3', {}, link(name(d), route)), el('p', { class: 'small muted' }, d.location))), favoriteButton),
    el('div', { class: 'device-state' }, status(deviceStatus(d), tone(d))));
  if (pending) { const commandState = state.snapshot.commands.find(c => c.id === d.pending_command_id)?.state; card.append(el('p', { class: 'device-pending', role: 'status' }, t(commandState === 'queued' ? 'Queued for home hub' : commandState === 'delivered' ? 'Waiting for home hub' : 'Waiting for controller'))); }
  if (ctx.feedback.has(d.id)) card.append(el('p', { class: 'form-error' }, ctx.feedback.get(d.id)));
  else if (recent && !pending) card.append(el('p', { class: 'device-error' }, t(recent.state === 'expired' ? 'Request expired' : recent.state === 'rejected' ? 'Request rejected' : recent.state === 'failed' ? 'Request failed' : 'Not confirmed'), '. ', t('Check again')));
  const footer = el('div', { class: 'device-card-footer' });
  if (d.type === 'light') {
    const actions = el('div', { class: 'device-control' });
    if (reported(d)) actions.append(button(d.observation.reported_status === 'on' ? 'Turn off' : 'Turn on', () => ctx.command(d.id, d.observation.reported_status === 'on' ? 'off' : 'on'), { kind: d.observation.reported_status === 'on' ? 'tonal' : 'secondary', symbol: 'bulb', disabled: !live, 'aria-label': name(d) + ': ' + t(d.observation.reported_status === 'on' ? 'Turn off' : 'Turn on') }));
    else for (const action of ['on', 'off']) actions.append(button(action === 'on' ? 'Turn on' : 'Turn off', () => ctx.command(d.id, action), { disabled: !live, 'aria-label': name(d) + ': ' + t(action === 'on' ? 'Turn on' : 'Turn off') }));
    footer.append(actions);
  } else footer.append(navButton('Details', route, 'arrow'));
  if (manage && metadataOwner()) footer.append(button('Edit', () => editDevice(d, ctx), { kind: 'ghost', symbol: 'edit' }));
  card.append(footer); return card;
}
function roomCard(room, index = 0) {
  const devices = state.snapshot.devices.filter(d => d.room_id === room.id); const on = devices.filter(d => d.type === 'light' && reported(d) && d.observation.reported_status === 'on').length;
  const unavailable = devices.filter(d => !reported(d)).length;
  return el('a', { class: 'card room-card', href: '/rooms/' + room.id },
    el('div', { class: 'room-cover', 'data-room': room.id }, icon(room.id === 'entrance' ? 'lock' : room.id === 'kitchen' ? 'gas' : 'home'), el('span', { class: 'room-cover-count', 'aria-hidden': 'true' }, String(devices.length))),
    el('div', { class: 'room-card-content' }, el('div', { class: 'grow' }, el('h3', {}, room.name), el('p', { class: 'small muted' }, devices.length, ' ', t(devices.length === 1 ? 'device' : 'devices')), el('div', { class: 'room-device-preview' }, devices.map(d => el('span', { class: 'room-device-symbol', 'data-state': reported(d) ? d.observation.reported_status : 'unavailable', 'aria-hidden': 'true' }, icon(symbol(d)))), on ? el('span', { class: 'small' }, on, ' ', t('on')) : null, unavailable ? el('span', { class: 'small muted' }, unavailable, ' ', t('unavailable')) : null)), icon('arrow')));
}
function editDevice(d, ctx) {
  const titleField = field('Name', { name: 'name', value: d.name }); const roomField = select('Room', 'room_id', state.snapshot.rooms.map(r => ({ value: r.id, label: r.name })), d.room_id);
  modal('Edit', el('div', { class: 'stack' }, titleField.node, roomField.node), { onConfirm: async () => { await Api.request('/api/devices/' + d.id, { method: 'PUT', body: { name: titleField.input.value, room_id: roomField.input.value, version: d.version } }); await ctx.refresh(); } });
}
function editRoom(room, ctx) {
  const value = field('Room name', { name: 'name', value: room?.name || '', maxLength: 60 });
  modal(room ? 'Edit room' : 'Add room', value.node, { onConfirm: async () => { await Api.request('/api/rooms' + (room ? '/' + room.id : ''), { method: room ? 'PUT' : 'POST', body: { name: value.input.value, ...(room ? { version: room.version } : { idempotency_key: crypto.randomUUID() }) } }); await ctx.refresh(); } });
}
function summaryCard(label, value, iconName, href, sub, iconKind) { return el('a', { class: 'summary-card', href }, well(iconName, iconKind), el('div', {}, el('p', { class: 'small muted' }, t(label)), el('p', { class: 'summary-value' }, value)), sub && el('p', { class: 'small muted' }, sub)); }
function sensorRow(d) { return el('a', { class: 'sensor-item', href: '/devices/' + d.id }, well(symbol(d), d.id === 'sensor-gas' ? 'gas' : 'motion'), el('div', { class: 'grow' }, el('h3', {}, name(d)), el('p', { class: 'small muted' }, deviceStatus(d)), el('p', { class: 'small muted' }, t(d.id === 'sensor-gas' ? 'Experimental gas sensor' : 'Last report'))), icon('arrow')); }

function homeView(ctx) {
  const s = state.snapshot; const lights = s.devices.filter(d => d.type === 'light'); const on = lights.filter(d => reported(d) && d.observation.reported_status === 'on').length; const unknown = lights.filter(d => !reported(d)).length;
  const door = deviceById('door-1'); const gas = deviceById('sensor-gas'); const motion = deviceById('sensor-motion');
  const heading = el('section', { class: 'home-intro home-heading' }, el('div', { class: 'hero-copy' }, el('h1', { tabindex: '-1' }, t('Welcome home.')), el('p', { class: 'muted' }, t('Simple controls.'))), status(s.devices.some(d => !reported(d)) ? 'Some devices are unavailable' : 'Devices connected'));
  const overview = el('div', { class: 'home-overview' }, el('div', { class: 'summary-grid home-status-grid' },
    summaryCard('Lights', on + ' ' + t('on'), 'bulb', '/rooms?type=light', unknown ? unknown + ' ' + t('unavailable') : '', 'light'),
    summaryCard('Front door', deviceStatus(door), 'lock', '/security/door', t('Controller reports'), 'door'),
    summaryCard('Gas sensor', deviceStatus(gas), 'gas', '/devices/sensor-gas', t('Experimental gas sensor'), 'gas'),
    summaryCard('Motion sensor', deviceStatus(motion), 'motion', '/devices/sensor-motion', t('Last report'), 'motion')));
  const actions = el('section', { class: 'home-controls content-section' }, el('div', { class: 'section-heading' }, el('h2', {}, t('Quick actions'))), el('div', { class: 'quick-grid' },
    button('All lights off', () => ctx.bulkOff(), { symbol: 'bulb', disabled: !state.connected || !control() || (Api.mode === 'cloud' && !state.snapshot.capabilities?.remote_lights) || !lights.some(d => d.connectivity === 'online') || ctx.pending.size > 0 }),
    button('Lock front door', () => ctx.command('door-1', 'lock'), { symbol: 'lock', disabled: !state.connected || !s.system.door_enabled || !control() || door.connectivity !== 'online' || !!door.pending_command_id || ctx.pending.has(door.id) }),
    navButton('Check home', '/security', 'shield'), navButton('View alerts', '/security/alerts', 'bell')));
  const favoriteIds = s.preferences.favorites;
  const favorites = favoriteIds.length ? el('div', { class: 'device-grid' }, s.devices.filter(d => favoriteIds.includes(d.id)).map(d => deviceCard(d, ctx))) : el('section', { class: 'favorites-empty' }, well('star'), el('div', { class: 'grow' }, el('h3', {}, t('No favorites yet')), el('p', { class: 'small muted' }, t('Choose devices to show on Home.'))), navButton('Choose favorites', '/settings/devices', null, 'tonal'));
  const rooms = el('section', { class: 'home-rooms content-section' }, el('div', { class: 'section-heading' }, el('h2', {}, t('Your rooms')), link('View all', '/rooms')), el('div', { class: 'room-shortcuts' }, s.rooms.map(r => {
    const count = s.devices.filter(d => d.room_id === r.id).length;
    return el('a', { href: '/rooms/' + r.id, class: 'room-shortcut' }, icon(r.id === 'entrance' ? 'lock' : r.id === 'kitchen' ? 'gas' : 'home'), el('span', { class: 'grow' }, el('span', {}, r.name), el('span', { class: 'small muted' }, count, ' ', t(count === 1 ? 'device' : 'devices'))), icon('arrow'));
  })));
  const invite = el('section', { class: 'assistant-invite home-assistant' }, well('mic'), el('div', { class: 'grow' }, el('h2', {}, t('Talk to Shrimaan')), el('p', { class: 'small muted' }, t('Ask in Hindi, English, or Hinglish.'))), navButton('Open assistant', '/assistant', 'arrow', 'tonal'));
  return el('div', { class: 'home-page stack' }, heading, overview, actions, el('div', { class: 'home-layout' }, el('div', { class: 'home-favorites' }, section('Favorites', favorites, '/settings/devices'), invite), rooms));
}
function roomsView(ctx, id) {
  const rooms = state.snapshot.rooms;
  if (id) {
    const room = rooms.find(r => r.id === id); if (!room) return notFound();
    const ds = state.snapshot.devices.filter(d => d.room_id === id);
    return el('div', { class: 'stack room-detail-page' }, title(room.name, 'Control your home, one room at a time.', metadataOwner() && button('Edit room', () => editRoom(room, ctx), { symbol: 'edit' })),
      ds.length ? el('div', { class: 'device-grid' }, ds.map(d => deviceCard(d, ctx))) : empty('No devices in this room', 'Manage devices', navButton('Manage devices', '/settings/devices', 'rooms')),
      metadataOwner() && !ds.length && button('Remove empty room', () => modal('Remove empty room', el('p', {}, room.name), { confirmLabel: 'Remove', danger: true, onConfirm: async () => { await Api.request('/api/rooms/' + room.id, { method: 'DELETE', body: {} }); ctx.navigate('/rooms'); await ctx.refresh(); } }), { kind: 'ghost' }));
  }
  const queryParams = new URLSearchParams(location.search); const requestedType = queryParams.get('type');
  const filter = ['light','sensor','door'].includes(requestedType) ? requestedType : 'all'; const query = queryParams.get('q') || '';
  const input = field('Search rooms or devices', { name: 'room-search', value: query, type: 'search', required: false });
  input.input.addEventListener('input', event => { ctx.setQuery({ q: event.target.value }, false); clearTimeout(ctx.roomSearchTimer); ctx.roomSearchTimer = setTimeout(() => { if (location.pathname === '/rooms') ctx.render(); }, 150); });
  const chips = el('div', { class: 'filters', 'aria-label': t('Rooms') }, [['all', 'All'], ['light', 'Lights'], ['sensor', 'Sensors'], ['door', 'Door']].map(([value, label]) => button(label, () => ctx.setQuery({ type: value }), { className: 'chip', 'aria-pressed': String(filter === value) })));
  const matches = rooms.filter(r => { const ds = state.snapshot.devices.filter(d => d.room_id === r.id); return (filter === 'all' || ds.some(d => d.type === filter)) && (r.name.toLowerCase().includes(query.toLowerCase()) || ds.some(d => d.name.toLowerCase().includes(query.toLowerCase()))); });
  return el('div', { class: 'rooms-page' }, title('Rooms', 'Control your home, one room at a time.', metadataOwner() && button('Add room', () => editRoom(null, ctx), { kind: 'primary', symbol: 'plus' })), el('div', { class: 'rooms-toolbar' }, el('div', { class: 'search-box' }, input.node), chips),
    matches.length ? el('div', { class: 'room-grid' }, matches.map((r, i) => roomCard(r, i))) : empty('No matching rooms', 'Clear filters', button('Clear filters', () => ctx.setQuery({ type: null, q: null }))));
}
function deviceView(ctx, id) {
  if (id === 'door-1') return doorView(ctx);
  const d = deviceById(id); if (!d) return notFound();
  const details = dataList({ 'Room': d.location, 'Last report': dateText(d.observation.received_at), [reported(d) ? 'Controller reports' : 'Last known']: t(d.observation.reported_status || 'Unavailable') });
  return el('div', { class: 'settings-wrap stack device-detail-page' }, title(name(d), d.location, metadataOwner() && button('Edit', () => editDevice(d, ctx), { symbol: 'edit' })), deviceCard(d, ctx),
    d.id === 'sensor-gas' && helpNote('Uncalibrated reading. Use an independent gas alarm.'), d.id === 'sensor-motion' && helpNote('Last movement report; not proof of absence.'), el('section', { class: 'card stack' }, details, navButton('Activity', '/security/activity?device_id=' + id, 'clock')));
}
function doorView(ctx) {
  const d = deviceById('door-1'); const disabled = !state.connected || !state.snapshot.system.door_enabled || d.connectivity !== 'online' || !control() || !!d.pending_command_id;
  return el('div', { class: 'settings-wrap stack door-detail-page' }, title('Front door', 'Doors & access'), el('section', { class: 'card door-hero' }, el('span', { class: 'lock-orb' }, icon(reported(d) && d.observation.reported_status === 'unlocked' ? 'unlock' : 'lock')), el('h2', {}, reported(d) ? t('Controller reports') + ' ' + deviceStatus(d) : t('Door status unavailable')),
    el('p', { class: 'small muted' }, dateText(d.observation.received_at)), el('p', { class: 'muted' }, t('Physical lock position is not sensed.')),
    el('div', { class: 'door-actions' }, button('Lock door', () => ctx.command('door-1', 'lock'), { kind: 'primary', symbol: 'lock', disabled }), button('Unlock front door', () => ctx.unlock(), { symbol: 'unlock', disabled: disabled || !state.session.user.can_unlock })),
    d.pending_command_id && el('p', { role: 'status', class: 'device-pending' }, t('Waiting for controller')), ctx.feedback.has(d.id) && el('p', { class: 'form-error' }, ctx.feedback.get(d.id)),
    !state.snapshot.system.door_enabled && helpNote('Door control needs supervised safety setup.'), el('p', { class: 'small muted' }, t('The controller normally relocks after about 5 seconds. Network failures can delay relocking.'))),
    el('div', { class: 'row row-wrap' }, button('Check again', ctx.refresh, { symbol: 'wifi' }), navButton('Activity', '/security/activity?device_id=door-1', 'clock'), Api.mode !== 'cloud' && owner() && navButton('Access cards', '/security/access-cards', 'card')));
}
function securityView(ctx) {
  const d = deviceById('door-1');
  const door = el('section', { class: 'card door-hero door-overview security-door' }, el('div', { class: 'security-door-heading' }, el('span', { class: 'lock-orb' }, icon(reported(d) && d.observation.reported_status === 'unlocked' ? 'unlock' : 'lock')), el('div', {}, el('h2', {}, t('Front door')), el('p', { class: 'small muted' }, dateText(d.observation.received_at)))), el('p', { class: 'door-report' }, reported(d) ? t('Controller reports') + ' ' + deviceStatus(d) : t('Door status unavailable')), el('p', { class: 'small muted security-door-caveat' }, t('Physical lock position is not sensed.')), navButton('View details', '/security/door', 'arrow', 'primary'));
  const sensors = el('section', { class: 'security-sensors' }, el('div', { class: 'section-heading' }, el('h2', {}, t('Your sensors'))), el('div', { class: 'sensor-list' }, [deviceById('sensor-gas'), deviceById('sensor-motion')].map(sensorRow)));
  const access = Api.mode !== 'cloud' && owner() && el('a', { class: 'security-link', href: '/security/access-cards', 'aria-label': t('Access cards') }, well('card'), el('div', { class: 'grow' }, el('h2', {}, t('Access cards')), el('p', { class: 'small muted' }, t('Manage who can enter.'))), icon('arrow'));
  const activity = el('a', { class: 'activity-shortcut security-link', href: '/security/activity' }, well('clock'), el('div', { class: 'grow' }, el('h2', {}, t('Activity')), el('p', { class: 'small muted' }, t('Door, light and sensor events.'))), icon('arrow'));
  return el('div', { class: 'security-page stack' }, title('Security', Api.mode === 'cloud' ? 'Door reports and sensors.' : 'Doors, access cards and sensors.', navButton('View alerts', '/security/alerts', 'bell')), el('div', { class: 'security-grid' }, door, el('div', { class: 'security-side' }, sensors, el('div', { class: 'security-links' }, access, activity))));
}
async function cardsView(ctx) {
  if (Api.mode === 'cloud') return empty('Access cards stay on the home hub', 'Manage access cards locally.');
  if (!owner()) return denied();
  const cards = await Api.request('/api/logs/rfid-cards');
  const edit = card => ctx.sensitive(async () => {
    const uidField = field('Card UID', { name: 'uid', value: card?.uid || '', readOnly: !!card, maxLength: 40 }); const label = field('Owner name', { name: 'owner_name', value: card?.owner_name || '' }); const auth = el('input', { type: 'checkbox', checked: card ? !!card.is_authorized : true, name: 'is_authorized' });
    modal(card ? 'Edit' : 'Add access card', el('div', { class: 'stack' }, uidField.node, label.node, el('label', { class: 'check-field' }, auth, t('Authorized'))), { onConfirm: async () => { await Api.request('/api/logs/rfid-cards' + (card ? '/' + encodeURIComponent(card.uid) : ''), { method: card ? 'PUT' : 'POST', body: { ...(card ? { version: card.version } : { uid: uidField.input.value }), owner_name: label.input.value, is_authorized: auth.checked } }); ctx.render(); } });
  });
  return el('div', { class: 'settings-wrap stack access-cards-page' }, title('Access cards', 'Manage who can enter.', button('Add access card', () => edit(null), { kind: 'primary', symbol: 'plus' })), helpNote('UID cards can be cloned. Only an owner can manage access.'),
    cards.length ? el('div', { class: 'stack' }, cards.map(card => el('article', { class: 'card stack-tight' }, el('div', { class: 'row' }, well('card'), el('div', { class: 'grow' }, el('h2', {}, card.owner_name), el('p', { class: 'small muted' }, '••:••:' + card.uid.split(':').slice(-2).join(':'))), status(card.is_authorized ? 'Authorized' : 'Not authorized', card.is_authorized ? 'success' : 'neutral')),
      el('div', { class: 'row row-wrap' }, button('Edit', () => edit(card), { symbol: 'edit' }), button('Remove card', () => ctx.sensitive(() => modal('Remove card', el('p', {}, card.owner_name), { confirmLabel: 'Remove', danger: true, onConfirm: async () => { await Api.request('/api/logs/rfid-cards/' + encodeURIComponent(card.uid), { method: 'DELETE', body: {} }); ctx.render(); } })), { kind: 'ghost' }))))) : empty('No cards added', 'Add access card', button('Add access card', () => edit(null), { kind: 'primary' })));
}
const eventLabels = { command_queued: 'Queued for home hub', command_delivered: 'Waiting for home hub', command_pending_observation: 'Waiting for controller', command_rejected: 'Request rejected', command_expired: 'Request expired', command_failed: 'Request failed', command_uncertain: 'Not confirmed', gateway_report: 'Last report', metadata_updated: 'Home details', command: 'Request sent', command_requested: 'Request accepted', command_observed: 'Controller reports', status_change: 'Last report', rfid_scan: 'Access cards', rfid_card_added: 'Add access card', rfid_card_removed: 'Remove card', rfid_card_updated: 'Access cards', sensor_data: 'Sensors', alert_opened: 'View alert', user_created: 'System', device_updated: 'Edit' };
function activityRow(row) {
  const d = deviceById(row.device_id); let details = row.details; if (typeof details === 'string') try { details = JSON.parse(details); } catch { details = {}; }
  const description = [details?.action && t(details.action), details?.status && t(details.status), details?.authorized !== undefined && t(details.authorized ? 'Authorized' : 'Not authorized')].filter(Boolean).join('. ');
  return el('li', { class: 'activity-item' }, well(d ? symbol(d) : 'clock'), el('div', { class: 'grow' }, el('h3', {}, t(eventLabels[row.event_type] || 'Activity')), el('p', { class: 'small muted' }, d ? name(d) : t('System'), description ? '. ' + description : ''), el('time', { datetime: row.timestamp }, dateText(row.timestamp))),
    button('Details', () => modal('Event details', el('div', { class: 'stack-tight' }, dataList({ 'Name': d ? name(d) : t('System'), 'Last report': dateText(row.timestamp) }), el('p', {}, t(eventLabels[row.event_type] || 'Activity')), el('p', { class: 'small muted' }, description)), { confirmLabel: 'Close', readOnly: true, onConfirm: async () => {} }), { kind: 'ghost', 'aria-label': t('Event details') + ': ' + (d ? name(d) : t('System')) }));
}
async function activityView(ctx) {
  const url = new URLSearchParams(location.search);
  const filter = { category: ['doors','lights','sensors','system'].includes(url.get('category')) ? url.get('category') : 'all', from: url.get('from') || '', to: url.get('to') || '', q: url.get('q') || '' };
  const params = new URLSearchParams({ limit: '30', category: filter.category }); const device = new URLSearchParams(location.search).get('device_id'); if (device) params.set('device_id', device);
  let invalid = false;
  for (const k of ['from','to']) if (filter[k]) { const value = new Date(filter[k]+'T00:00:00'); if (!/^\d{4}-\d{2}-\d{2}$/.test(filter[k]) || Number.isNaN(value.getTime()) || value.getMonth()+1 !== Number(filter[k].slice(5,7)) || value.getDate() !== Number(filter[k].slice(8))) { invalid = true; filter[k] = ''; } else params.set(k,new Date(filter[k]+(k==='to'?'T23:59:59':'T00:00:00')).toISOString()); }
  if (filter.from && filter.to && filter.from > filter.to) invalid = true;
  if (filter.q) params.set('q',filter.q);
  const cacheKey = params.toString();
  let fetchError; if (invalid) ctx.activityPage = {key: 'invalid:'+cacheKey, items: [], next_cursor: null}; else if (ctx.activityPage?.key !== cacheKey) { try { const result = await Api.request('/api/activity?' + params); ctx.activityPage = { key: cacheKey, items: result.items, next_cursor: result.next_cursor }; } catch (error) { fetchError = error; ctx.activityPage = null; } }
  const result = ctx.activityPage || {items:[],next_cursor:null}; const list = el('ol', { class: 'list' }, result.items.map(activityRow));
  const filters = el('div', { class: 'filters' }, [['all', 'All'], ['doors', 'Doors'], ['lights', 'Lights'], ['sensors', 'Sensors'], ['system', 'System']].map(([k, label]) => button(label, () => ctx.setQuery({ category: k }), { className: 'chip', 'aria-pressed': String(k === filter.category) })));
  const inputs = el('div', { class: 'filter-fields' });
  for (const [k, label, type] of [['from', 'From', 'date'], ['to', 'To', 'date'], ['q', 'Search activity', 'search']]) { const f = field(label, { name: 'activity-' + k, type, value: filter[k], required: false, maxLength: 100 }); f.input.addEventListener('change', e => ctx.setQuery({ [k]: e.target.value })); inputs.append(f.node); }
  let cursor = result.next_cursor;
  const more = button('Load more', async () => { more.disabled = true; try { params.set('cursor', cursor); const next = await Api.request('/api/activity?' + params); const fresh = next.items.filter(row => !result.items.some(old => old.id === row.id)); fresh.forEach(row => list.append(activityRow(row))); result.items.push(...fresh); cursor = result.next_cursor = next.next_cursor; more.hidden = !cursor; } catch (e) { ctx.notify(errorText(e), true); } finally { more.disabled = false; } }); more.hidden = !cursor;
  const clear = () => ctx.setQuery({ category: null, from: null, to: null, q: null, device_id: null });
  return el('div', { class: 'stack activity-page' }, title('Activity', Api.mode === 'cloud' ? 'Cloud requests and gateway reports.' : 'Requests, controller reports and access events.', button('Refresh', () => { ctx.activityPage = null; ctx.render(); }, { symbol: 'clock' })), el('section', { class: 'card' }, filters, inputs, invalid && el('p',{role:'alert',class:'form-error'},t('Check the date range.')), fetchError && el('p',{role:'alert',class:'form-error'},errorText(fetchError)), device && el('div', { class: 'row row-wrap filter-summary' }, el('p', {}, deviceById(device)?.name || device), button('Show all devices', () => ctx.setQuery({ device_id: null }), { kind: 'ghost' })), result.items.length ? list : empty('No activity for this period', 'Clear filters', button('Clear filters', clear)), more));
}
function alertsView(ctx, id) {
  const filter = ctx.filters.alerts || 'active'; const alerts = state.snapshot.alerts.filter(a => id ? a.id === id : a.state === filter);
  if (id && !alerts.length) return notFound();
  const cards = alerts.map(a => el('article', { class: 'card stack' }, el('div', { class: 'row' }, well(a.kind === 'gas' ? 'gas' : 'motion', a.kind === 'gas' ? 'gas' : 'motion'), el('div', {}, el('h2', {}, t(a.kind === 'gas' ? 'Gas sensor reports a possible issue.' : 'Movement was detected.')), el('p', { class: 'small muted' }, dateText(a.opened_at)))), status(a.state === 'active' ? 'Active' : 'History', a.state === 'active' && a.severity === 'critical' ? 'danger' : 'neutral'),
    a.kind === 'gas' && helpNote('Uncalibrated reading. Use an independent gas alarm.'), el('p', { class: 'small muted' }, t('Acknowledging does not clear the sensor warning.')),
    el('div', { class: 'row row-wrap' }, navButton('View alert', '/security/alerts/' + a.id, 'arrow'), navButton('View details', '/devices/' + a.device_id, 'arrow'), control() && button(a.receipt.acknowledged_at ? 'Acknowledged' : "I've seen this", async () => { await Api.request('/api/alerts/' + a.id + '/acknowledge', { method: 'POST', body: {} }); await ctx.refresh(); }, { disabled: !!a.receipt.acknowledged_at }))));
  if (id && !alerts[0].receipt.read_at && !ctx.readingAlerts.has(id)) { ctx.readingAlerts.add(id); Api.request('/api/alerts/' + id + '/read', { method: 'POST', body: {} }).then(ctx.refresh).catch(() => ctx.readingAlerts.delete(id)); }
  return el('div', { class: 'settings-wrap stack alerts-page' }, title('Alerts'), !id && el('div', { class: 'filters' }, ['active', 'resolved'].map(k => button(k === 'active' ? 'Active' : 'History', () => { ctx.filters.alerts = k; ctx.render(); }, { className: 'chip', 'aria-pressed': String(k === filter) }))), cards.length ? el('div', { class: 'stack' }, cards) : empty(filter === 'active' ? 'No active alerts' : 'No past alerts', null, navButton('Security', '/security', 'shield')));
}
function settingsRow(label, description, href, key) { return el('a', { href, class: 'settings-row' }, well(key), el('div', { class: 'grow' }, el('div', { class: 'settings-title' }, t(label)), description && el('p', { class: 'settings-description' }, t(description))), icon('arrow')); }
function settingsIndex(ctx) {
  const group = (heading, rows) => el('section', { class: 'settings-section' }, el('div', { class: 'settings-section-head' }, el('h2', {}, t(heading))), el('div', { class: 'settings-group' }, rows));
  return el('div', { class: 'settings-wrap stack settings-page' }, title('Settings'), !state.session.user.preview && el('div', { class: 'card row' }, well('user'), el('div', { class: 'grow' }, el('h2', {}, state.session.user.display_name), el('p', { class: 'small muted' }, t(state.session.user.role === 'owner' ? 'Owner' : state.session.user.role === 'resident' ? 'Resident' : 'Viewer'))), button('Sign out', ctx.logout, { kind: 'ghost' })),
    el('div', { class: 'settings-columns' },
      group('Preferences', [settingsRow('Appearance', 'Choose from four themes', '/settings/appearance', 'sun'), settingsRow('Accessibility', 'Text, controls, and motion', '/settings/accessibility', 'user'), settingsRow('Language', preferences.language === 'hi' ? 'हिन्दी' : 'English', '/settings/language', 'help'), settingsRow('Voice & assistant', null, '/settings/voice', 'mic'), settingsRow('Notifications', null, '/settings/notifications', 'bell')]),
      el('div', { class: 'settings-column' }, group('Home', [settingsRow('Devices', 'Manage devices', '/settings/devices', 'rooms'), settingsRow('Rooms', null, '/rooms', 'home'), settingsRow('Home details', null, '/settings/home', 'home')]),
        group('General', [settingsRow('Security & privacy', null, '/settings/privacy', 'shield'), settingsRow('Help & support', null, '/settings/help', 'help'), settingsRow('About', null, '/settings/about', 'leaf'), owner() && settingsRow('Advanced', null, '/settings/advanced', 'settings')]))));
}
function appearanceView() {
  return el('div', { class: 'settings-wrap stack appearance-page' }, title('Appearance', 'Choose from four themes'), el('fieldset', { class: 'theme-grid' }, el('legend', { class: 'sr-only' }, t('Appearance')), themes.map(theme => {
    const input = el('input', { type: 'radio', name: 'theme', value: theme.id, checked: preferences.theme === theme.id, onchange: () => applyPreferences({ theme: theme.id }) });
    return el('label', { class: 'theme-option' }, el('div', { class: 'theme-sample', 'data-theme': theme.id, 'aria-hidden': 'true' }, el('div', { class: 'theme-sample-pill' }), el('div', { class: 'theme-sample-cards' }, el('div', { class: 'theme-sample-card' }, icon('bulb')), el('div', { class: 'theme-sample-card' }, icon('lock')))), input, el('div', { class: 'theme-option-copy' }, el('strong', {}, theme.name), el('p', {}, t(theme.description)), theme.id === '05' && el('p', {}, t('Default')), preferences.theme === theme.id && el('p', {}, t('Selected'))));
  })), button('Reset to Serene Emerald', () => applyPreferences({ theme: '05' }), { symbol: 'sun' }), !preferences.persistent && helpNote('Saved for this visit only'));
}
function accessibilityView() {
  return el('div', { class: 'settings-wrap stack' }, title('Accessibility', 'Text, controls, and motion'), el('section', { class: 'card stack' }, ['largeText', 'largeControls', 'reducedMotion', 'strongOutlines'].map((key, i) => checkbox(['Large text', 'Large controls', 'Reduce motion', 'Stronger outlines'][i], preferences[key], value => applyPreferences({ [key]: value })))),
    el('section', { class: 'card stack' }, el('p', { class: 'eyebrow' }, t('Preview')), el('h2', {}, t('Your home stays yours.')), el('p', { class: 'muted' }, t('Internet is not needed for everyday controls.')), navButton('Home', '/', 'home')));
}
function languageView() { return el('div', { class: 'settings-wrap stack' }, title('Language'), el('fieldset', { class: 'card stack' }, el('legend', { class: 'sr-only' }, t('Language')), [['en', 'English'], ['hi', 'हिन्दी']].map(([value, label]) => el('label', { class: 'check-field' }, el('input', { type: 'radio', name: 'language', value, checked: preferences.language === value, onchange: () => applyPreferences({ language: value }) }), label)))); }
function voiceSettings(ctx) {
  if (Api.mode === 'cloud') return el('div', { class: 'settings-wrap stack' }, title('Voice & assistant'), empty('Voice stays on the home hub', 'Use Shrimaan locally for voice. You can type requests in Assistant here.', navButton('Assistant', '/assistant', 'mic')));
  const p = state.snapshot.preferences; const s = state.snapshot.speech; const options = [{ value: 'auto', label: 'Automatic' }, { value: 'en', label: 'English' }, { value: 'hi', label: 'Hindi' }];
  const input = select('Input language', 'input_language', options, p.input_language); const reply = select('Reply language', 'reply_language', options, p.reply_language);
  for (const f of [input, reply]) { f.input.disabled = !!ctx.preferenceBusy; f.input.addEventListener('change', () => ctx.preference({ [f.input.name]: f.input.value })); }
  const speed = el('input', { type: 'range', name: 'voice_rate', id: 'voice-rate', min: '.8', max: '1.2', step: '.1', value: p.voice_rate, disabled: !!ctx.preferenceBusy, 'aria-valuetext': p.voice_rate + '×' }); const output = el('output', { for: 'voice-rate' }, p.voice_rate + '×'); speed.addEventListener('input', () => { output.textContent = speed.value + '×'; speed.setAttribute('aria-valuetext', speed.value + '×'); }); speed.addEventListener('change', () => ctx.preference({ voice_rate: Number(speed.value) }));
  return el('div', { class: 'settings-wrap stack' }, title('Voice & assistant', 'Your private, local assistant.'), el('section', { class: 'card stack' }, status(s.stt_ready ? 'Ready locally' : 'Local setup required', s.stt_ready ? 'success' : 'neutral'), input.node, reply.node,
    checkbox('Spoken replies', p.spoken_replies, value => ctx.preference({ spoken_replies: value }), undefined, !!ctx.preferenceBusy), el('label', { class: 'field', for: 'voice-rate' }, t('Voice speed'), speed, output), checkbox('Require Shrimaan wake phrase', preferences.wakeRequired, value => applyPreferences({ wakeRequired: value }), 'The microphone still starts only when you tap.'),
    el('div', { class: 'row row-wrap' }, button('Test voice', () => ctx.speak(null, true), { symbol: 'sound', disabled: !s.tts_ready }), button('Stop speech', ctx.stopAudio, { kind: 'ghost', symbol: 'stop' }))), el('p', { class: 'privacy-note' }, icon('shield'), t(Api.mode === 'cloud' ? 'Voice stays on the home hub. You can type here.' : 'Audio travels only to your home hub for local processing. It is not saved by default.')), owner() && navButton('Local AI', '/settings/advanced/ai', 'settings'));
}
function notificationsView(ctx) {
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  return el('div', { class: 'settings-wrap stack' }, title('Notifications'), el('section', { class: 'card stack' }, el('p', {}, t('Permission'), ': ', t(({ granted:'Enabled', denied:'Blocked', default:'Not enabled', unsupported:'Not supported' })[permission])), el('p', { class: 'muted' }, t('In-app alerts stay available. Background delivery is not guaranteed.')), permission === 'denied' && el('p', { class: 'small muted' }, t('Notifications are blocked in this browser. You can change this in browser settings.')),
    permission === 'default' && button('Enable browser notifications', async () => { await Notification.requestPermission(); ctx.render(); }, { symbol: 'bell', kind: 'primary' }),
    [['gas', 'Gas sensor'], ['motion', 'Motion sensor']].map(([key, label]) => checkbox(label, state.snapshot.preferences.notification_categories.includes(key), checked => { const old = state.snapshot.preferences.notification_categories; ctx.preference({ notification_categories: checked ? [...new Set([...old, key])] : old.filter(k => k !== key) }); }, undefined, !!ctx.preferenceBusy))));
}
async function homeSettings(ctx) {
  if (Api.mode === 'cloud') { const homes = (await Api.request('/api/households')).items; const chooser = homes.length > 1 ? select('Home', 'active-household', homes.map(home => ({ value: home.household_id, label: home.name })), state.session.household_id) : null; if (chooser) { chooser.input.disabled = !!ctx.switchingHome; chooser.input.addEventListener('change', event => ctx.switchHome(event.target.value)); } return el('div', { class: 'settings-wrap stack' }, title('Home details'), el('section', { class: 'card stack' }, chooser?.node, dataList({ 'Home name': state.snapshot.home.home_name }), el('p', {}, t('Manage home details and rooms on the home hub.')))); }
  const f = field('Home name', { name: 'home_name', value: state.snapshot.home.home_name, maxLength: 60, disabled: !owner() });
  const submit = el('button', { class: 'button button-primary', type: 'submit', disabled: !!ctx.homeSaving }, t('Save'));
  const form = el('form', { class: 'card stack', onsubmit: async event => { event.preventDefault(); if (ctx.homeSaving) return; ctx.homeSaving = true; submit.disabled = true; try { await ctx.run(async () => { await Api.request('/api/settings/home', { method: 'PUT', body: { home_name: f.input.value, version: state.snapshot.home.version } }); await ctx.refresh(); ctx.notify(t('Saved')); }); } finally { ctx.homeSaving = false; ctx.render(); } } }, f.node, owner() && submit);
  return el('div', { class: 'settings-wrap stack' }, title('Home details'), form);
}
function privacyView(ctx) { if (Api.mode === 'cloud') return el('div', { class: 'settings-wrap stack' }, title('Security & privacy'), el('section', { class: 'card stack' }, el('h2', {}, t('Cloud access and local control')), el('p', {}, t('Your cloud account protects online access. Device reports and allowed light requests pass through your home gateway.')), el('p', {}, t('Voice processing and access cards stay on the home hub.')), button('Sign out', ctx.logout, { kind: 'ghost' })));  return el('div', { class: 'settings-wrap stack' }, title('Security & privacy', 'Your data stays at home.'), el('section', { class: 'card stack' }, well('shield'), el('h2', {}, t('Your data stays at home.')), el('p', { class: 'muted' }, t('No cloud inference. No default audio recording. Theme and accessibility preferences stay in this browser.')), el('p', { class: 'muted' }, t(Api.mode === 'cloud' ? 'Voice stays on the home hub. You can type here.' : 'Audio travels only to your home hub for local processing. It is not saved by default.')), button('Delete current conversation', ctx.clearConversation, { symbol: 'mic' }), !state.session.user.preview && button('Sign out', ctx.logout, { kind: 'ghost' })), owner() && !state.session.user.preview && el('section', { class: 'card stack' }, el('h2', {}, t('Owner')), el('p', { class: 'muted' }, preferences.language === 'hi' ? 'खाते और पासवर्ड का प्रबंधन हब के स्थानीय टर्मिनल से करें। बैकअप केवल स्थानीय ऑपरेटर बहाल कर सकता है।' : 'Manage accounts and passwords from the local hub terminal. Backups are restored by the local operator with the hub stopped.'))); }
const helpTopics = [
  ['Lights', 'Open Rooms, choose a room, then Turn on or Turn off. A request stays pending until the controller reports its state.', 'कमरे खोलें, कमरा चुनें और लाइट चालू या बंद करें। कंट्रोलर की रिपोर्ट आने तक अनुरोध लंबित रहता है।'],
  ['Front door', 'Unlock needs an authorized account, your password and explicit confirmation. Relay reports do not verify the physical bolt. Local operator safety setup is required.', 'अनलॉक के लिए अधिकृत खाता, पासवर्ड और स्पष्ट पुष्टि चाहिए। रिले की रिपोर्ट वास्तविक बोल्ट की पुष्टि नहीं करती। पहले स्थानीय सुरक्षा सेटअप करें।'],
  ['Access cards', 'An owner can add, revoke or remove cards. UID cards can be cloned. Revoking access is saved before confirmation is shown.', 'मालिक कार्ड जोड़, निष्क्रिय या हटा सकता है। UID कार्ड की नकल हो सकती है। पुष्टि से पहले बदलाव सहेजा जाता है।'],
  ['Assistant', 'Tap the microphone or type a request. Stop listening sends the utterance; Cancel discards it. Models must be installed on your hub. No cloud fallback is used.', 'माइक्रोफ़ोन दबाएँ या अनुरोध लिखें। सुनना रोकने पर रिकॉर्ड की गई बात भेजी जाती है; रद्द करने पर मिट जाती है। मॉडल हब पर स्थापित होने चाहिए। क्लाउड का उपयोग नहीं होता।'],
  ['Home hub unavailable', 'Internet is not needed, but your browser must reach the hub over the local network. Check Wi-Fi and hub power. Reconnect never replays an unlock.', 'इंटरनेट की ज़रूरत नहीं है, लेकिन स्थानीय नेटवर्क पर हब से जुड़ना ज़रूरी है। वाई-फ़ाई और हब की बिजली जाँचें। दोबारा जुड़ने पर अनलॉक फिर नहीं भेजा जाता।'],
  ['Gas sensor', 'This experimental ADC reading is not calibrated PPM. Keep an independent gas detector/alarm. Browser alerts are not a life-safety system.', 'यह प्रायोगिक ADC रीडिंग अंशांकित PPM नहीं है। अलग गैस डिटेक्टर और अलार्म रखें। ब्राउज़र चेतावनियाँ जीवन-सुरक्षा प्रणाली नहीं हैं।'],
  ['Motion sensor', 'The PIR reports movement changes. An old clear report or an online board does not prove that the room is empty.', 'PIR हलचल में बदलाव बताता है। पुरानी स्पष्ट रिपोर्ट या जुड़ा बोर्ड कमरे के खाली होने का प्रमाण नहीं है।'],
];
function helpView() { if (Api.mode === 'cloud') return el('div', { class: 'settings-wrap stack help-page' }, title('Help & support'), el('section', { class: 'card stack' }, el('h2', {}, t('Cloud access and local control')), el('p', {}, t('Remote light requests need an approved, connected home gateway. A request is not a device confirmation.')), el('p', {}, t('Door control, access cards and voice stay on the home hub.')), el('p', {}, t('If cloud access is unavailable, use the local hub on your home network.'))));  return el('div', { class: 'settings-wrap stack help-page' }, title('Help & support'), el('section', { class: 'card' }, helpTopics.map(([heading, en, hi]) => el('details', { class: 'help-topic' }, el('summary', {}, t(heading)), el('p', {}, preferences.language === 'hi' ? hi : en))))); }
async function advancedView(ctx, ai) {
  if (Api.mode === 'cloud' && ai) return empty('Voice stays on the home hub', 'Install and check voice models locally.');
  if (!owner()) return denied();
  if (ai) { const { assets } = await Api.request('/api/ai/models'); return el('div', { class: 'settings-wrap stack advanced-page ai-page' }, title('Local AI', 'Installed models'), assets.map(asset => el('section', { class: 'card stack' }, el('h2', {}, asset.provider), status(asset.ready ? 'Ready locally' : 'Local setup required', asset.ready ? 'success' : 'neutral'), dataList({ 'Language': asset.languages.join(', ') || t('Not set up'), 'About': asset.license_status, 'Installed models': asset.bytes ? (asset.bytes / 1048576).toFixed(1) + ' MiB' : t('Not set up') }), button('Check readiness', () => ctx.sensitive(async () => { await Api.request('/api/ai/models/' + asset.id + '/activate', { method: 'POST', body: {} }); await ctx.refresh(); ctx.notify(t('Model is ready locally.')); }), { disabled: !asset.ready }))), el('p', { class: 'muted' }, preferences.language === 'hi' ? 'मॉडल हब पर स्थानीय ऑपरेटर स्थापित करता है। मॉडल फ़ाइल का आकार और उपयोग होने वाली RAM अलग हैं।' : 'The local operator provisions models on the hub. Model file size and runtime RAM are different measurements.')); }
  const system = await Api.request('/api/system');
  if (Api.mode === 'cloud') return el('div', { class: 'settings-wrap stack advanced-page' }, title('Advanced', 'Cloud access and local control', button('Refresh diagnostics', ctx.render, { symbol: 'wifi' })), el('section', { class: 'card stack' }, dataList({ 'Home gateway': system.gateway.connected ? t('Ready') : t('Unavailable'), 'Broker': system.broker.connected ? t('Ready') : t('Unavailable'), 'Database': system.database.healthy ? t('Ready') : t('Unavailable') }), el('p', {}, t('Voice stays on the home hub. You can type here.'))), section('Controller boards', el('div', { class: 'stack' }, Object.values(system.boards).map(board => el('div', { class: 'card stack-tight' }, el('h2', {}, board.name), status(board.online ? 'Ready' : 'Unavailable'), el('p', { class: 'small muted' }, dateText(board.lastSeen)))))), el('section', { class: 'card stack' }, el('h2', {}, t('Requests')), system.diagnostics.commands.map(item => el('p', {}, t(item.state), ': ', item.count))), helpNote('Physical lock position is not sensed.'));

  return el('div', { class: 'settings-wrap stack advanced-page' }, title('Advanced', 'Home hub', button('Refresh diagnostics', ctx.render, { symbol: 'wifi' })), el('section', { class: 'card stack' }, dataList({ 'Home hub': system.version, 'Broker': system.broker.connected ? t('Ready') : t('Unavailable'), 'Database': system.database.healthy ? t('Ready') : t('Unavailable'), 'Local AI': system.speech.stt_ready && system.speech.tts_ready ? t('Ready locally') : t('Local setup required') })),
    section('Controller boards', el('div', { class: 'stack' }, Object.values(system.boards).map(b => el('div', { class: 'card stack-tight' }, el('h3', {}, b.name), status(b.online ? 'Ready' : 'Unavailable', b.online ? 'success' : 'neutral'), el('p', { class: 'small muted' }, t('Last report'), ': ', dateText(b.lastSeen)))))), navButton('Local AI', '/settings/advanced/ai', 'mic'), !system.door_enabled && helpNote('Door control needs supervised safety setup.'));
}
export function assistantView(ctx) {
  const panel = el('div', { id: 'assistant-messages', class: 'conversation', 'aria-live': 'polite' });
  const mic = el('button', { id: 'assistant-mic', class: 'mic-button', type: 'button', disabled: !state.snapshot.speech.stt_ready, 'aria-label': t('Tap to speak'), 'aria-pressed': 'false', onclick: () => ctx.voice.state === 'listening' ? ctx.voice.end() : ctx.voice.start(state.snapshot.preferences.input_language, ctx.wakeRequired) }, icon('mic'));
  const voiceState = el('p', { id: 'voice-status', role: 'status' }, t('Ready when you are'));
  const cancel = button('Cancel request', () => ctx.voice.cancel(), { kind: 'ghost', symbol: 'stop', id: 'cancel-voice', hidden: true });
  const input = field('Type a request', { name: 'assistant-text', required: true, maxLength: 500, value: ctx.conversation.draft || '', placeholder: preferences.language === 'hi' ? 'कमरा 1 की लाइट बंद करो' : 'Turn off Room 1 lights' }); input.input.addEventListener('input', () => { ctx.conversation.draft = input.input.value; });
  const form = el('form', { class: 'composer', onsubmit: event => { event.preventDefault(); ctx.typed(input.input.value); } }, input.node, el('button', { class: 'button button-primary', type: 'submit' }, icon('arrow'), t('Send')));
  const cloud = Api.mode === 'cloud';
  const suggestions = cloud ? preferences.language === 'hi' ? ['लाइट 1 की स्थिति', 'गैस की स्थिति', 'मोशन की स्थिति', 'दरवाजा की स्थिति'] : ['Light 1 status', 'Gas sensor status', 'Motion sensor status', 'Door status'] : preferences.language === 'hi' ? ['कमरा 1 की लाइट बंद करो', 'सभी लाइटें बंद करो', 'दरवाजा लॉक करो', 'गैस की स्थिति क्या है'] : ['Turn off Room 1 lights', 'Turn off all lights', 'Lock the front door', 'Check gas sensor status'];
  const stage = el('section', { class: 'assistant-stage assistant-control-panel' }, el('span', { id: 'assistant-readiness', class: 'status' }, t(cloud ? 'Voice is local' : state.snapshot.speech.stt_ready ? 'Ready locally' : 'Local setup required')), el('div', { class: 'mic-orbit' }, mic), el('h2', { id: 'mic-label' }, t(cloud ? 'Voice stays on the home hub' : 'Tap to speak')), voiceState, cancel, el('p', { id: 'assistant-setup-note', class: 'small muted', hidden: cloud || state.snapshot.speech.stt_ready }, t(cloud ? 'Voice stays on the home hub. You can type here.' : 'Voice needs local setup. You can still type.')));
  const workspace = el('div', { class: 'assistant-workspace' }, panel, form,
    el('section', { class: 'assistant-suggestions' }, el('h2', {}, t(cloud ? 'Try a request' : 'Try saying')), el('div', { class: 'suggestions' }, suggestions.map(value => button(value, () => { input.input.value = value; ctx.conversation.draft = value; input.input.focus(); }, { symbol: value.includes('Door') || value.includes('door') || value.includes('दरवाजा') ? 'lock' : value.includes('Gas') || value.includes('gas') || value.includes('गैस') ? 'gas' : value.includes('Motion') || value.includes('मोशन') ? 'motion' : 'bulb' })))),
    el('div', { class: 'row row-wrap assistant-audio-actions' }, button('Clear conversation', ctx.clearConversation, { kind: 'ghost' }), button('Replay', () => ctx.speak(ctx.conversation.resultId), { kind: 'ghost', symbol: 'sound', 'data-action': 'replay', disabled: !state.snapshot.speech.tts_ready || !ctx.conversation.resultId }), button('Stop speech', ctx.stopAudio, { kind: 'ghost', symbol: 'stop' })));
  const view = el('div', { class: 'assistant-page stack' }, title('Shrimaan', cloud ? 'Type a request. Voice stays on the home hub.' : 'Your private, local assistant.', navButton('Voice settings', '/settings/voice', 'settings')), el('div', { class: 'assistant-layout' }, stage, workspace), el('p', { class: 'privacy-note' }, icon('shield'), t(cloud ? 'Remote door control is disabled. Voice stays on the home hub.' : 'Audio travels only to your home hub for local processing. It is not saved by default.')));
  ctx.updateConversation = () => {
    const replay = [...view.querySelectorAll('button')].find(b => b.dataset.action === 'replay'); if (replay) replay.disabled = !state.snapshot.speech.tts_ready || !ctx.conversation.resultId;
    panel.replaceChildren();
    if (ctx.conversation.transcript) panel.append(el('section', { class: 'message' }, el('p', { class: 'message-label' }, t('You said')), el('p', {}, ctx.conversation.transcript)));
    if (ctx.conversation.response) panel.append(el('section', { class: 'message message-answer' }, el('p', { class: 'message-label' }, t('Shrimaan says')), el('p', {}, ctx.conversation.response), ctx.conversation.securityLink && navButton('Security', '/security/door', 'lock')));
  };
  ctx.updateConversation(); return view;
}
function denied() { return empty('Access denied', 'This page needs owner access.', navButton('Home', '/', 'home')); }
function notFound() { return empty('Page not found', 'Check the address or go home.', navButton('Go home', '/', 'home')); }
export async function renderView(ctx) {
  if (!routeInfo(location.pathname, state.snapshot).known) return notFound();
  if (Api.mode === 'cloud' && !state.snapshot.devices.length && !location.pathname.startsWith('/settings')) return empty('Connect your home gateway', 'Devices will appear after your gateway connects.');
  const parts = location.pathname.split('/').filter(Boolean); const [primary, secondary, third] = parts;
  if (!primary) return homeView(ctx);
  if (primary === 'rooms') return roomsView(ctx, secondary);
  if (primary === 'devices' && secondary) return deviceView(ctx, secondary);
  if (primary === 'security') { if (!secondary) return securityView(ctx); if (secondary === 'door') return doorView(ctx); if (secondary === 'access-cards') return cardsView(ctx); if (secondary === 'activity') return activityView(ctx); if (secondary === 'alerts') return alertsView(ctx, third); }
  if (primary === 'assistant') return assistantView(ctx);
  if (primary === 'settings') {
    if (!secondary) return settingsIndex(ctx);
    if (secondary === 'appearance') return appearanceView(); if (secondary === 'accessibility') return accessibilityView(); if (secondary === 'language') return languageView();
    if (secondary === 'voice') return voiceSettings(ctx); if (secondary === 'notifications') return notificationsView(ctx); if (secondary === 'home') return homeSettings(ctx); if (secondary === 'privacy') return privacyView(ctx); if (secondary === 'help') return helpView();
    if (secondary === 'about') return el('div', { class: 'settings-wrap stack' }, title('About'), el('section', { class: 'card stack' }, el('h2', {}, 'HomeAuto'), el('p', { class: 'muted' }, t('Your home stays yours.')), el('p', {}, Api.mode === 'cloud' ? '2.0.0. Vercel / Express. PostgreSQL. Local MQTT gateway' : '2.0.0. Node / Express. sql.js. MQTT. Vosk. Kokoro ONNX'), link('Open-source notices', '/assets/NOTICE.txt')));
    if (secondary === 'advanced') return advancedView(ctx, third === 'ai');
    if (secondary === 'devices') return el('div', { class: 'stack' }, title('Devices', 'Manage devices'), el('div', { class: 'device-grid' }, state.snapshot.devices.map(d => deviceCard(d, ctx, { manage: true }))));
  }
  return notFound();
}
