const crypto = require('node:crypto');
const { scoped, fail } = require('./db');
const { hash, fn } = require('./auth');
const { fields } = require('../lib/errors');

function createGatewaySetup(pool, origin) {
  const owner = actor => { if (actor.role !== 'owner') fail('FORBIDDEN', 403); };
  return {
    async status(actor) {
      owner(actor);
      return scoped(pool, actor, async client => {
        const gateway = (await client.query('SELECT gateway_id,last_seen_at,revoked_at FROM homeauto_online.gateways WHERE household_id=$1', [actor.household_id])).rows[0];
        const available = (await client.query("SELECT to_regprocedure('homeauto_online.enroll_browser_gateway(text,uuid,uuid,text,boolean)') IS NOT NULL AS available")).rows[0].available;
        return { available, registered: !!gateway, gateway_id: gateway?.gateway_id || null, last_seen_at: gateway?.last_seen_at || null,
          state: !gateway ? 'not_enrolled' : gateway.revoked_at ? 'revoked' : !gateway.last_seen_at ? 'awaiting_connection' : Date.now() - Date.parse(gateway.last_seen_at) <= 15000 ? 'connected' : 'offline' };
      });
    },
    async enroll(actor, input) {
      owner(actor); fields(input, ['replace_unused'], ['replace_unused']);
      if (typeof input.replace_unused !== 'boolean') fail('VALIDATION_ERROR');
      const token = crypto.randomBytes(32).toString('hex'); let result;
      try { result = await fn(pool, 'enroll_browser_gateway', [actor.token_hash, crypto.randomUUID(), crypto.randomUUID(), hash(token), input.replace_unused]); }
      catch (error) {
        if (error.code === '42883') fail('GATEWAY_SETUP_UNAVAILABLE', 503);
        const known = { LOGIN_REQUIRED: 401, FORBIDDEN: 403, REAUTH_REQUIRED: 403, GATEWAY_ALREADY_ENROLLED: 409, VALIDATION_ERROR: 400 };
        if (known[error.message]) fail(error.message, known[error.message]);
        throw error;
      }
      return { ...result, config: { version: 1, household_id: result.household_id, gateway_id: result.gateway_id, gateway_token: token, origin: typeof origin === 'function' ? origin() : origin, expires_at: result.expires_at,
        notice: 'Private gateway credential. Keep this file on your home hub. Remote physical control remains disabled.' } };
    },
  };
}
module.exports = { createGatewaySetup };
