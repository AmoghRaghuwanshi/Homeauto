const devices = [
  ['light-1', 'Light 1', 'light', 'Room 1', 'off', 'room-1', 'lights', ['switch']],
  ['light-2', 'Light 2', 'light', 'Room 1', 'off', 'room-1', 'lights', ['switch']],
  ['light-3', 'Light 3', 'light', 'Room 2', 'off', 'room-2', 'lights', ['switch']],
  ['light-4', 'Light 4', 'light', 'Room 2', 'off', 'room-2', 'lights', ['switch']],
  ['door-1', 'Front Door', 'door', 'Entrance', 'locked', 'entrance', 'door', ['lock', 'unlock']],
  ['sensor-gas', 'Gas Sensor', 'sensor', 'Kitchen', 'normal', 'kitchen', 'lights', ['gas_reading']],
  ['sensor-motion', 'Motion Sensor', 'sensor', 'Hallway', 'clear', 'hallway', 'lights', ['motion_event']],
].map(([id, name, type, location, status, room_id, board_id, capabilities]) => ({ id, name, type, location, status, room_id, board_id, capabilities }));
const byId = Object.fromEntries(devices.map(d => [d.id, d]));
module.exports = { devices, byId };
