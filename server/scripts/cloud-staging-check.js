const assert = require('node:assert/strict'); const crypto = require('crypto');
const { createPool, assertRuntimeRole, createPostgresCatalog } = require('../cloud/postgres');
const { identity } = require('../cloud/config'); const { hash, projectCatalog } = require('../cloud/protocol');
const { createRepository } = require('../db/repository');
async function main(env=process.env) {
  if(env.HOMEAUTO_CLOUD_STAGING_TEST_APPROVED!=='1')throw new Error('Staging tests require explicit disposable-target authorization.');
  const url=new URL(env.DATABASE_URL);
  if(!env.HOMEAUTO_STAGING_EXPECTED_DATABASE || decodeURIComponent(url.pathname.slice(1))!==env.HOMEAUTO_STAGING_EXPECTED_DATABASE)throw new Error('Staging database identity does not match the approved target.');
  const first={householdId:env.HOMEAUTO_STAGING_HOUSEHOLD_ID,hubId:env.HOMEAUTO_STAGING_HUB_ID};
  const second={householdId:env.HOMEAUTO_STAGING_OTHER_HOUSEHOLD_ID,hubId:env.HOMEAUTO_STAGING_OTHER_HUB_ID};
  for(const scope of [first,second])identity({...scope,consent:'catalog-v1'});
  if(first.householdId===second.householdId || first.hubId===second.hubId)throw new Error('Two separate synthetic enrolled households are required.');
  const pool=createPool(env.DATABASE_URL);let repo;
  try{
    await assertRuntimeRole(pool);const store=createPostgresCatalog(pool);repo=await createRepository();const catalog=projectCatalog(repo);catalog.home.name='HomeAuto staging fixture';
    const previous=await Promise.all([store.read(first),store.read(second)]);
    if(previous.some(record=>record && record.catalog.home.name!==catalog.home.name))throw new Error('Refusing to replace a non-fixture catalog.');
    const base=previous[0]?.revision || 0;
    const operation=(scope,revision)=>{const body={schema_version:1,household_id:scope.householdId,hub_id:scope.hubId,operation_id:crypto.randomUUID(),revision,catalog};return {...body,digest:hash(body)};};
    const uploads=[8,3,6,1,7,2,5,4].map(n=>operation(first,base+n));const started=performance.now();
    await Promise.all(uploads.map(op=>store.ingest(first,op)));
    assert.equal((await store.read(first)).revision,base+8);
    const highest=uploads.find(op=>op.revision===base+8);assert.equal((await store.ingest(first,highest)).status,'accepted');
    const peer=operation(second,(previous[1]?.revision || 0)+1);await store.ingest(second,peer);
    await assert.rejects(store.ingest(first,peer),{code:'SYNC_SCOPE_MISMATCH'});
    for(let i=0;i<8;i++)assert.equal((await pool.query('SELECT household_id FROM homeauto_cloud.catalogs')).rows.length,0);
    const result={result:'passed',synthetic_uploads:9,pool_max:4,elapsed_ms:Math.round(performance.now()-started),scope_reset_checks:8,hardware_tests:0};console.log(JSON.stringify(result));return result;
  }finally{repo?.close();await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Staging check failed or was not authorized. No secrets are logged. Inspect target configuration and run only on approved synthetic staging data.');process.exitCode=1;});
module.exports={main};
