const { uuid } = require('../lib/errors');
function identity(config) {
  if (!config || config.consent !== 'catalog-v1' || !uuid(config.householdId) || !uuid(config.hubId) || [config.householdId, config.hubId].some(id => id !== id.toLowerCase())) throw new Error('Cloud sync needs catalog-v1 consent and lowercase household/hub UUIDs.');
  return { householdId: config.householdId, hubId: config.hubId, consent: config.consent };
}
function endpoint(value) {
  let url; try { url = new URL(value); } catch { throw new Error('Cloud sync needs an HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Cloud sync needs an HTTPS origin.');
  return url.origin;
}
function loadSyncConfig(env = process.env) {
  if (env.HOMEAUTO_CLOUD_SYNC_ENABLED !== '1') return null;
  const config = { consent: env.HOMEAUTO_CLOUD_CONSENT, householdId: env.HOMEAUTO_HOUSEHOLD_ID, hubId: env.HOMEAUTO_HUB_ID };
  identity(config); config.origin = endpoint(env.HOMEAUTO_CLOUD_ORIGIN);
  if (!/^[a-f0-9]{64}$/.test(env.HOMEAUTO_HUB_TOKEN || '')) throw new Error('Cloud sync needs a 32-byte lowercase hex hub token.');
  config.token = env.HOMEAUTO_HUB_TOKEN; return config;
}
module.exports = { identity, endpoint, loadSyncConfig };
