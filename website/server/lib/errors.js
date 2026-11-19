class DomainError extends Error {
  constructor(code, status = 400, message = code, fields = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}
const fail = (code, status = 400, message, fields) => { throw new DomainError(code, status, message, fields); };
function text(value, max = 80) {
  if (typeof value !== 'string') fail('VALIDATION_ERROR');
  const clean = value.normalize('NFC').trim();
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) fail('VALIDATION_ERROR');
  return clean;
}
function fields(body, allowed, required = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) fail('VALIDATION_ERROR');
  if (required.some(k => body[k] === undefined)) fail('VALIDATION_ERROR');
}
function uid(value) {
  const compact = text(value, 40).replace(/[:\s]/g, '').toUpperCase();
  if (!/^(?:[A-F0-9]{8}|[A-F0-9]{14}|[A-F0-9]{20})$/.test(compact)) fail('INVALID_UID');
  return compact.match(/.{2}/g).join(':');
}
function version(input, current) {
  if (!Number.isInteger(input) || input !== current) fail('VERSION_CONFLICT', 409);
}
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
module.exports = { DomainError, fail, text, fields, uid, version, uuid };
