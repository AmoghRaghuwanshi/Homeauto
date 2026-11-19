const crypto = require('crypto');
const { byId } = require('../lib/registry');
const { uuid } = require('../lib/errors');
const MAX_BYTES = 32768;
class SyncError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const reject = (code = 'INVALID_CATALOG', status = 400) => { throw new SyncError(code, status); };
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) reject();
}
function label(value, max) { if (typeof value !== 'string' || !value.trim() || value !== value.normalize('NFC').trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) reject(); }
function id(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) reject(); }
function revision(value) { if (!Number.isSafeInteger(value) || value < 1) reject(); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
function validateCatalog(value) {
  exact(value, ['home', 'rooms', 'devices']); exact(value.home, ['name', 'version']); label(value.home.name, 60); revision(value.home.version);
  if (!Array.isArray(value.rooms) || value.rooms.length > 100 || !Array.isArray(value.devices) || value.devices.length !== 7) reject();
  const rooms = new Set(), devices = new Set();
  for (const room of value.rooms) {
    exact(room, ['id', 'name', 'sort_order', 'version']); id(room.id); label(room.name, 60); revision(room.version);
    if (!Number.isSafeInteger(room.sort_order) || room.sort_order < 0 || rooms.has(room.id)) reject(); rooms.add(room.id);
  }
  for (const device of value.devices) {
    exact(device, ['id', 'name', 'type', 'room_id', 'version']); label(device.name, 80); revision(device.version);
    if (!byId[device.id] || devices.has(device.id) || device.type !== byId[device.id].type || !rooms.has(device.room_id)) reject(); devices.add(device.id);
  }
  if (Buffer.byteLength(canonical(value)) > MAX_BYTES - 1024) reject('CATALOG_TOO_LARGE', 413);
  return value;
}
function validateOperation(value) {
  exact(value, ['schema_version', 'household_id', 'hub_id', 'operation_id', 'revision', 'catalog', 'digest']);
  if (value.schema_version !== 1) reject('UNSUPPORTED_SYNC_VERSION', 422);
  for (const key of ['household_id', 'hub_id', 'operation_id']) if (!uuid(value[key]) || value[key] !== value[key].toLowerCase()) reject();
  revision(value.revision); validateCatalog(value.catalog);
  const { digest, ...body } = value;
  if (typeof digest !== 'string' || digest !== hash(body)) reject('DIGEST_MISMATCH');
  if (Buffer.byteLength(canonical(value)) > MAX_BYTES) reject('CATALOG_TOO_LARGE', 413);
  return value;
}
function projectCatalog(tx) {
  const home = tx.one("SELECT value_json,version FROM home_settings WHERE key='home_name'");
  return validateCatalog({ home: { name: JSON.parse(home.value_json), version: home.version },
    rooms: tx.all('SELECT id,name,sort_order,version FROM rooms ORDER BY id'),
    devices: tx.all('SELECT id,name,type,room_id,version FROM devices ORDER BY id') });
}
module.exports = { SyncError, reject, exact, canonical, hash, MAX_BYTES, validateCatalog, validateOperation, projectCatalog };
