import { Api } from './api.js';
import { state } from './state.js';
import { el, button, field, pageHeader, status, link, modal } from './components.js';
import { t, dateText, errorText } from './i18n.js';

export function hardwareWaiting() {
  return el('div', { class: 'settings-wrap stack' }, pageHeader('Connect your ESP32'),
    el('section', { class: 'card stack', role: 'status' },
      el('h2', {}, t('Waiting for ESP32')),
      el('p', {}, t('Connect the controller to enable home controls and the assistant.')),
      link('Modules', '/modules', 'button button-primary'),
      el('p', { class: 'small muted' }, t('For simulation without an ESP32, run Start-HomeAuto.bat and open port 3002.'))));
}

async function simulationModules(ctx) {
  const view = el('div', { class: 'settings-wrap stack' }, pageHeader('Modules', 'Simulation controls'));
  view.append(el('section', { class: 'card stack' }, status('Simulation only'),
    el('p', {}, t('Devices run in memory. No MQTT broker, ESP32 or household database is connected.')),
    el('p', { class: 'small muted' }, t('Device changes reset when the simulation server restarts. Browser speech may require internet.'))));
  const scenario = kind => ctx.run(async () => { await Api.request('/api/simulation/scenario', { method: 'POST', body: { scenario: kind } }); await ctx.refresh(); ctx.notify(t('Simulation updated')); });
  view.append(el('section', { class: 'card stack' }, el('h2', {}, t('Try a sensor scenario')),
    el('div', { class: 'row row-wrap' }, button('Simulate gas alert', () => scenario('gas')), button('Simulate motion', () => scenario('motion')), button('Clear scenario', () => scenario('clear'), { kind: 'secondary' })),
    link('View alerts', '/security/alerts', 'button button-secondary')));
  let camera;
  try { camera = await Api.request('/api/camera/status'); }
  catch (error) { view.append(el('p', { class: 'form-error', role: 'alert' }, errorText(error))); return view; }
  const cameraSection = el('section', { class: 'card stack camera-preview' }, el('h2', {}, t('Camera simulation')),
    status(camera.state === 'live' ? 'Test frame available' : camera.state === 'stale' ? 'Test frame is stale' : 'Test camera unavailable'),
    el('p', {}, t('Generated test images only. This is not video from your CP Plus camera.')),
    el('p', { class: 'small muted' }, t('Camera microphone and speaker access have not been verified.')));
  const preview = button('Preview test camera', () => {
    const frame = el('div', { role: 'status' }, t('Loading…'));
    const content = el('div', { class: 'stack camera-preview' }, el('p', {}, t('Generated test images only. This is not video from your CP Plus camera.')), frame);
    // Open before the asynchronous status read so the real button owns return focus.
    const dialog = modal('Camera simulation', content, { readOnly: true, confirmLabel: 'Close' });
    ctx.run(async () => {
      try {
        const current = await Api.request('/api/camera/status');
        if (!dialog.isConnected || !dialog.open) return;
        if (current.state === 'live') {
          const image = el('img', { src: '/api/camera/frame?generation=' + encodeURIComponent(current.generation), alt: t('Generated camera test image') });
          image.addEventListener('error', () => image.replaceWith(el('p', { class: 'form-error', role: 'alert' }, t('Test camera unavailable'))), { once: true });
          frame.replaceChildren(image);
        } else frame.replaceChildren(el('p', {}, t('Test camera unavailable')));
      } catch (error) { if (dialog.isConnected) frame.replaceChildren(el('p', { class: 'form-error', role: 'alert' }, errorText(error))); }
    });
  }, { id: 'simulation-camera-preview', disabled: camera.state !== 'live' });
  cameraSection.append(preview, el('div', { class: 'row row-wrap' }, [['live','Restore test camera'], ['offline','Simulate camera offline'], ['stale','Simulate stale frame'], ['fault','Simulate camera failure']].map(([kind,label]) => button(label, () => ctx.run(async () => {
    await Api.request('/api/camera/fixture', { method: 'POST', body: { scenario: kind } }); await ctx.render();
  }), { kind: 'secondary', disabled: !camera.simulated }))),
    el('p', { class: 'small muted' }, t('Real camera setup stays separate. Use Start-HomeAuto-Hardware.bat to open Modules on port 3001.')));
  view.append(cameraSection);
  return view;
}

export async function modulesPage(ctx) {
  const view = el('div', { class: 'settings-wrap stack' }, pageHeader('Modules', 'Connect and configure your home hardware'));
  if (Api.mode === 'cloud') return el('div', { class: 'settings-wrap stack' }, pageHeader('Modules'),
    el('p', {}, t('Configure modules on the local home hub.')), link('Home gateway', '/settings/gateway', 'button button-primary'));
  if (state.snapshot.system.simulation && state.session.user.role === 'owner') return simulationModules(ctx);
  if (state.session.user.role !== 'owner') {
    view.append(el('p', {}, t('Ask the home owner to configure modules.')));
    return view;
  }
  let data;
  try { data = await Api.request('/api/modules'); }
  catch (error) { view.append(el('p', { role: 'alert', class: 'form-error' }, errorText(error)), button('Refresh', ctx.render)); return view; }
  if (data.warning) view.append(el('p', { class: 'warning-note', role: 'alert' }, t(data.warning === 'MQTT_CREDENTIALS_REQUIRED'
    ? 'Enter the MQTT username and password to connect the broker.'
    : 'Saved module settings could not be loaded. Configure the connections again.')));
  view.append(el('section', { class: 'card stack' }, status(data.hardware_ready ? 'ESP32 connected' : 'Waiting for ESP32'),
    el('p', {}, t(data.hardware_ready ? 'Home controls and assistant are available.' : 'Connect the controller to enable home controls and the assistant.')),
    button('Refresh', ctx.render, { symbol: 'wifi' })));

  const broker = el('section', { class: 'card stack' }, el('h2', {}, 'ESP32 / MQTT'),
    status(data.mqtt.connected ? 'Broker connected' : 'Broker disconnected'),
    el('p', { class: 'small muted' }, t('The broker connection and a fresh ESP32 heartbeat are both required.')),
    el('p', { class: 'small muted' }, t('Enter the MQTT broker used by your ESP32. Controller Wi-Fi settings are provisioned in its firmware.')));
  for (const board of data.boards) broker.append(el('div', { class: 'row row-wrap' },
    el('strong', {}, board.name), status(board.state === 'connected' ? 'Connected' : 'Disconnected'),
    el('span', { class: 'small muted' }, dateText(board.last_seen))));
  const url = field('MQTT broker URL', { name: 'module-broker-url', value: data.mqtt.url || 'mqtts://localhost:8883', maxLength: 2048 });
  const username = field('MQTT username', { name: 'module-broker-username', value: data.mqtt.username, autocomplete: 'off', maxLength: 2048 });
  const password = field('MQTT password', { name: 'module-broker-password', type: 'password', required: false, autocomplete: 'new-password', maxLength: 2048 });
  const form = el('form', { class: 'stack' }, url.node, username.node, password.node,
    el('p', { class: 'small muted' }, t('Leave the password empty to keep it when the broker and username are unchanged.')),
    el('button', { type: 'submit', class: 'button button-primary' }, t('Save and connect')));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const body = { url: url.input.value.trim(), username: username.input.value.trim(), password: password.input.value };
    password.input.value = '';
    ctx.sensitive(() => Api.request('/api/modules/esp32', { method: 'PUT', body }).finally(() => ctx.refresh().then(ctx.render)));
  });
  broker.append(form, button('Reconnect ESP32', () => ctx.sensitive(() => Api.request('/api/modules/esp32/connect', { method: 'POST', body: {} }).finally(() => ctx.refresh().then(ctx.render))), { disabled: !data.mqtt.configured }));
  view.append(broker);

  const camera = el('section', { class: 'card stack' }, el('h2', {}, t('Entrance camera')),
    status(data.camera.state === 'reachable_unverified' ? 'Camera reachable; video unverified' : data.camera.state === 'disconnected' ? 'Camera unavailable' : data.camera.configured ? 'Camera setup pending' : 'Camera not set up', 'warning'),
    el('p', {}, t('The camera is optional. Complete ESP32 control remains available while camera setup is pending.')),
    el('p', { class: 'small muted' }, t('This connection check tests network reachability. Live video and recognition require a verified camera stream.')));
  if (data.camera.last_checked) camera.append(el('p', { class: 'small muted' }, t('Last checked'), ' ', dateText(data.camera.last_checked)));
  const host = field('Camera LAN address', { name: 'module-camera-host', value: data.camera.host || '', maxLength: 253 });
  const port = field('Camera port', { name: 'module-camera-port', type: 'number', value: data.camera.port || 554, min: 1, max: 65535 });
  const cameraForm = el('form', { class: 'stack' }, host.node, port.node, el('button', { type: 'submit', class: 'button button-primary' }, t('Save camera')));
  cameraForm.addEventListener('submit', event => {
    event.preventDefault();
    const body = { host: host.input.value.trim(), port: Number(port.input.value) };
    ctx.sensitive(() => Api.request('/api/modules/camera', { method: 'PUT', body }).then(ctx.render));
  });
  camera.append(cameraForm, button('Check camera connection', () => ctx.sensitive(() => Api.request('/api/modules/camera/connect', { method: 'POST', body: {} }).then(ctx.render)), { disabled: !data.camera.configured }));
  view.append(camera, el('section', { class: 'card stack' }, el('h2', {}, t('Sensors')),
    data.sensors.map(sensor => el('p', {}, t(sensor.id === 'sensor-gas' ? 'Gas sensor' : 'Motion sensor'), ' — ', t(sensor.connected ? 'Connected' : 'Module disconnected'))),
    el('p', { class: 'small muted' }, t('Sensors report through the ESP32. Check wiring and controller firmware if a report is missing.'))));
  return view;
}
