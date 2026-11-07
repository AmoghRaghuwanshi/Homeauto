const { test } = require('node:test'); const assert = require('node:assert/strict');
const crypto = require('crypto'); const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http');
const { PGlite } = require('@electric-sql/pglite');
const { createRepository } = require('../db/repository');
const { Home } = require('../services/home');
const { hash, validateOperation, projectCatalog } = require('../cloud/protocol');
const { loadSyncConfig } = require('../cloud/config');
const { acknowledge } = require('../cloud/journal');
const { createSyncWorker, syncStatus } = require('../cloud/worker');
const { migrate, grantSQL } = require('../cloud/migrate');
const { poolOptions, assertRuntimeRole, createPostgresCatalog } = require('../cloud/postgres');
const { createCloudApp } = require('../cloud/app');
const { inspectSQLite, inspectFile, normalizeTimestamp } = require('../cloud/sqlite-inspect');
const { devices } = require('../lib/registry');
const { startRuntime, loadConfig } = require('../lifecycle');
const scope = { householdId:'11111111-1111-4111-8111-111111111111', hubId:'22222222-2222-4222-8222-222222222222' };
const other = { householdId:'33333333-3333-4333-8333-333333333333', hubId:'44444444-4444-4444-8444-444444444444' };
const config = { ...scope, consent:'catalog-v1', origin:'https://catalog.invalid', token:'a'.repeat(64) };
const clone = value => JSON.parse(JSON.stringify(value));
const next = repo => JSON.parse(repo.one('SELECT operation_json FROM cloud_outbox LIMIT 1').operation_json);
const accepted = op => ({ operation_id:op.operation_id,revision:op.revision,digest:op.digest,status:'accepted' });
function operation(catalog, revision=1, auth=scope) { const body={schema_version:1,household_id:auth.householdId,hub_id:auth.hubId,operation_id:crypto.randomUUID(),revision,catalog:clone(catalog)};return {...body,digest:hash(body)}; }
function resign(value) { const {digest,...body}=value;return {...body,digest:hash(body)}; }
const renamed = (repo, name) => repo.write("UPDATE home_settings SET value_json=?,version=version+1 WHERE key='home_name'",[JSON.stringify(name)]);
async function pgFixture() {
  const db = new PGlite(); await db.waitReady;
  let tail=Promise.resolve();
  const query = async (sql,args=[]) => args.length || !sql.includes(';') ? db.query(sql,args) : (await db.exec(sql),{rows:[]});
  const pool = { query, async connect() { const previous=tail;let release;tail=new Promise(resolve=>release=resolve);await previous;return {query,release:()=>release()}; } };
  await migrate(pool);
  await db.exec(`INSERT INTO homeauto_cloud.households(household_id) VALUES('${scope.householdId}'),('${other.householdId}');
    INSERT INTO homeauto_cloud.hubs(household_id,hub_id) VALUES('${scope.householdId}','${scope.hubId}'),('${other.householdId}','${other.hubId}');
    CREATE ROLE homeauto_fixture NOLOGIN NOSUPERUSER NOBYPASSRLS; ${grantSQL('homeauto_fixture')}`);
  await db.exec('SET ROLE homeauto_fixture');
  return { db,pool,store:createPostgresCatalog(pool),close:()=>db.close() };
}
async function listen(app) { const server=http.createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return { url:'http://127.0.0.1:'+server.address().port,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));} }; }

test('cloud catalog protocol, journal, PostgreSQL and failures', async t => {
  const repo=await createRepository({sync:config}); t.after(()=>repo.close());
  const catalog=next(repo).catalog;
  await t.test('disabled default and explicit consent/HTTPS/identity gates',async()=>{
    assert.equal(loadSyncConfig({DATABASE_URL:'ignored'}),null);
    assert.throws(()=>loadSyncConfig({HOMEAUTO_CLOUD_SYNC_ENABLED:'1'}));
    const env={HOMEAUTO_CLOUD_SYNC_ENABLED:'1',HOMEAUTO_CLOUD_CONSENT:'catalog-v1',HOMEAUTO_HOUSEHOLD_ID:scope.householdId,HOMEAUTO_HUB_ID:scope.hubId,HOMEAUTO_HUB_TOKEN:config.token,HOMEAUTO_CLOUD_ORIGIN:config.origin};
    assert.deepEqual(loadSyncConfig(env),config);
    for(const url of ['http://catalog.invalid','https://user:password@catalog.invalid','https://catalog.invalid/path','https://catalog.invalid/?secret=1'])assert.throws(()=>loadSyncConfig({...env,HOMEAUTO_CLOUD_ORIGIN:url}));
    const disabled=await createRepository();try{assert.equal(disabled.one("SELECT name FROM sqlite_master WHERE name='cloud_outbox'"),null);assert.deepEqual(syncStatus(disabled,false),{enabled:false,state:'disabled'});}finally{disabled.close();}
  });
  await t.test('staging harness refuses missing approval or mismatched target before opening a connection',async()=>{
    const {main}=require('../scripts/cloud-staging-check');await assert.rejects(main({}),/authorization/);
    await assert.rejects(main({HOMEAUTO_CLOUD_STAGING_TEST_APPROVED:'1',DATABASE_URL:'postgresql://fixture:private@db.invalid/unapproved',HOMEAUTO_STAGING_EXPECTED_DATABASE:'approved'}),/identity/);
  });
  await t.test('isolated preview never inherits real cloud consent or credentials',async()=>{
    const previous=process.env.HOMEAUTO_CLOUD_SYNC_ENABLED;process.env.HOMEAUTO_CLOUD_SYNC_ENABLED='1';let preview;
    try{preview=await require('../scripts/preview').createPreview({voice:false});const response=await fetch(preview.url+'/api/system');assert.equal(response.status,200);assert.deepEqual((await response.json()).cloud_sync,{enabled:false,state:'disabled'});assert.equal(preview.runtime.repo.one("SELECT name FROM sqlite_master WHERE name='cloud_outbox'"),null);}finally{if(previous===undefined)delete process.env.HOMEAUTO_CLOUD_SYNC_ENABLED;else process.env.HOMEAUTO_CLOUD_SYNC_ENABLED=previous;await preview?.runtime.stop();}
  });
  await t.test('strict allowlist excludes device status, credentials, commands and unsupported schemas',()=>{
    const op=operation(catalog);assert.equal(validateOperation(op),op);
    for(const key of ['commands','password_hash','rfid_cards','audio','sensor_latest'])assert.throws(()=>validateOperation({...op,[key]:'private'}));
    const changed=clone(op);changed.catalog.devices[0].status='locked';assert.throws(()=>validateOperation(resign(changed)));
    assert.throws(()=>validateOperation({...op,schema_version:2}),{code:'UNSUPPORTED_SYNC_VERSION'});
    assert.throws(()=>validateOperation({...op,revision:2}),{code:'DIGEST_MISMATCH'});
    assert.throws(()=>validateOperation(resign({...op,revision:Number.MAX_SAFE_INTEGER+1})));
    const bad=clone(op);bad.catalog.devices[0].id='unknown';assert.throws(()=>validateOperation(resign(bad)));
    const duplicate=clone(op);duplicate.catalog.rooms.push(duplicate.catalog.rooms[0]);assert.throws(()=>validateOperation(resign(duplicate)));
  });
  await t.test('telemetry is not exported; metadata enqueues and rollback is atomic',()=>{
    const initial=next(repo);repo.write("UPDATE devices SET status='on',last_seen=?,is_online=1 WHERE id='light-1'",[new Date().toISOString()]);assert.equal(next(repo).operation_id,initial.operation_id);
    assert.throws(()=>repo.transaction(tx=>{tx.run("UPDATE devices SET name='Rolled back' WHERE id='light-1'");throw new Error('rollback');}));assert.equal(next(repo).operation_id,initial.operation_id);assert.equal(repo.getDevice('light-1').name,'Light 1');
    renamed(repo,'Family home');const op=next(repo);assert.equal(op.revision,initial.revision+1);assert.equal(op.catalog.home.name,'Family home');assert.equal(repo.one('SELECT count(*) n FROM cloud_outbox').n,1);
    const serial=JSON.stringify(op);for(const key of ['status','last_seen','is_online','password','uid','transcript'])assert.ok(!serial.includes('"'+key+'"'));
  });
  await t.test('delayed acknowledgments cannot erase a newer local snapshot',()=>{
    const sent=next(repo);renamed(repo,'New name');const current=next(repo);acknowledge(repo,sent,accepted(sent),1000);assert.equal(next(repo).operation_id,current.operation_id);
    assert.throws(()=>acknowledge(repo,current,{...accepted(current),digest:'0'.repeat(64)},1001));assert.equal(next(repo).operation_id,current.operation_id);
  });
  await t.test('durable restart preserves journal; identity mismatch leaves file unchanged',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-cloud-journal-'));const filename=path.join(dir,'fixture.db');let disk;
    try{disk=await createRepository({filename,sync:config});renamed(disk,'Restart test');const pending=next(disk);disk.close();disk=null;
      const before=fs.readFileSync(filename);await assert.rejects(createRepository({filename,sync:{...config,hubId:other.hubId}}));assert.deepEqual(fs.readFileSync(filename),before);
      disk=await createRepository({filename,sync:config});assert.equal(next(disk).operation_id,pending.operation_id);assert.equal(next(disk).revision,pending.revision);
    }finally{disk?.close();fs.rmSync(dir,{recursive:true,force:true});}
  });
  await t.test('prolonged outage uses bounded backoff while local light control still works',async()=>{
    const local=await createRepository({sync:config});let clock=1000,calls=0;const worker=createSyncWorker(local,config,{now:()=>clock,random:()=>.5,fetchImpl:async()=>{calls++;throw new Error('secret must not be saved');}});
    try{for(let i=0;i<15;i++){assert.equal((await worker.runOnce()).state,'retry');const row=local.one('SELECT * FROM cloud_outbox');assert.equal(row.attempts,i+1);assert.ok(row.next_attempt_at-clock<=300000);clock=row.next_attempt_at;}
      renamed(local,'Edited during outage');assert.equal(next(local).catalog.home.name,'Edited during outage');
      const publications=[];const home=new Home(local,{now:()=>clock,publisher:(...args)=>{publications.push(args);args[3](null);}});
      home.connected=true;home.boards.lights.online=true;home.boards.lights.lastSeen=clock;
      const result=home.request('light-1',{action:'on',idempotency_key:crypto.randomUUID()},{user_id:'fixture-owner',role:'owner'});
      assert.equal(result.state,'published');assert.equal(publications.length,1);assert.ok(calls>=15);assert.ok(!JSON.stringify(local.all('SELECT * FROM cloud_outbox')).includes('secret'));
      assert.throws(()=>home.request('door-1',{action:'unlock',idempotency_key:crypto.randomUUID()},{user_id:'fixture-owner',role:'owner'}),{code:'DOOR_SAFETY_SETUP_REQUIRED'});
    }finally{worker.stop();local.close();}
  });
  await t.test('cloud size limits suspend mirroring without rejecting local edits or telemetry',()=>{
    repo.transaction(tx=>{for(let i=0;i<101;i++)tx.run('INSERT INTO rooms(id,name,name_key) VALUES(?,?,?)',['extra-'+i,'Extra '+i,'extra '+i]);});
    assert.equal(syncStatus(repo,true).state,'blocked');assert.equal(repo.one('SELECT count(*) n FROM cloud_outbox').n,0);
    repo.write("UPDATE devices SET status='off' WHERE id='light-1'");assert.equal(repo.getDevice('light-1').status,'off');
    repo.write("DELETE FROM rooms WHERE id LIKE 'extra-%'");assert.equal(syncStatus(repo,true).state,'pending');
  });
  await t.test('HTTP 503, auth rejection, malformed/large ack and cancellation fail safely',async()=>{
    for(const [response,state] of [[()=>new Response('unavailable',{status:503}),'retry'],[()=>new Response('',{status:401}),'blocked'],[()=>Response.json({status:'accepted',operation_id:'wrong'}),'retry'],[()=>new Response('x'.repeat(3000)),'retry']]){
      const local=await createRepository({sync:config});const worker=createSyncWorker(local,config,{fetchImpl:async()=>response(),random:()=>.5});try{assert.equal((await worker.runOnce()).state,state);assert.equal(syncStatus(local,true).state,state==='blocked'?'blocked':'pending');}finally{worker.stop();local.close();}
    }
    const local=await createRepository({sync:config});let begun;const entered=new Promise(resolve=>begun=resolve);const worker=createSyncWorker(local,config,{fetchImpl:async(url,{signal})=>{begun();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));}});
    const running=worker.runOnce();await entered;worker.stop();assert.equal((await running).state,'stopped');assert.equal(next(local).revision,1);local.close();
  });
  await t.test('TLS cannot be disabled by a remote PostgreSQL URL and migration role is guarded',()=>{
    const options=poolOptions('postgresql://runtime:private@db.invalid/catalog?sslmode=disable');assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.equal(options.max,4);assert.equal(options.connectionTimeoutMillis,3000);assert.equal(options.connectionString,undefined);
    assert.equal(poolOptions('postgresql://fixture:test@127.0.0.1/fixture',{allowLoopback:true}).ssl,false);assert.throws(()=>poolOptions('postgresql://a:b@db.invalid/catalog?options=unsafe'));
    assert.throws(()=>grantSQL('runtime; DROP SCHEMA public'));assert.throws(()=>grantSQL('"owner"'));
  });
  await t.test('backward clock jumps are bounded and corrupt local operations stop safely',async()=>{
    const local=await createRepository({sync:config});let clock=10000000;
    const worker=createSyncWorker(local,config,{now:()=>clock,random:()=>.5,fetchImpl:async()=>{throw new Error('offline');}});
    try{await worker.runOnce();clock=1000;assert.equal((await worker.runOnce()).state,'idle');assert.equal(local.one('SELECT next_attempt_at FROM cloud_outbox').next_attempt_at,clock+300000);
      clock+=300000;local.write("UPDATE cloud_outbox SET operation_json='invalid'");assert.equal((await worker.runOnce()).state,'blocked');assert.equal(syncStatus(local,true).last_error,'INVALID_LOCAL_CATALOG');
    }finally{worker.stop();local.close();}
  });
  await t.test('failed disk export rolls back both metadata and journal',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-cloud-io-'));let local,broken=false;const io=Object.create(fs);io.renameSync=(...args)=>{if(broken)throw Object.assign(new Error('fault'),{code:'EIO'});return fs.renameSync(...args);};
    try{const filename=path.join(dir,'fixture.db');local=await createRepository({filename,io,sync:config});const before=fs.readFileSync(filename),pending=next(local);broken=true;
      assert.throws(()=>renamed(local,'Never committed'));assert.deepEqual(fs.readFileSync(filename),before);assert.deepEqual(next(local),pending);assert.equal(local.healthy(),false);
    }finally{local?.close();fs.rmSync(dir,{recursive:true,force:true});}
  });
  await t.test('interrupted PostgreSQL DDL rolls back schema and migration marker together',async()=>{
    const db=new PGlite();await db.waitReady;let fail=true;
    const pool={connect:async()=>({query:async(sql,args=[])=>{if(fail&&sql.startsWith('INSERT INTO public.homeauto_cloud_migrations'))throw new Error('interrupted migration');return args.length||!sql.includes(';')?db.query(sql,args):(await db.exec(sql),{rows:[]});},release:()=>{}})};
    try{await assert.rejects(migrate(pool),/interrupted/);assert.equal((await db.query("SELECT to_regnamespace('homeauto_cloud') AS value")).rows[0].value,null);assert.equal((await db.query("SELECT to_regclass('public.homeauto_cloud_migrations') AS value")).rows[0].value,null);fail=false;assert.equal((await migrate(pool)).applied,true);}finally{await db.close();}
  });
  const pg=await pgFixture();t.after(()=>pg.close());
  await t.test('actual PostgreSQL migration, checksum, least privilege and forced RLS',async()=>{
    await assertRuntimeRole(pg.pool);
    assert.equal((await pg.db.query('SELECT * FROM homeauto_cloud.households')).rows.length,0);
    await assert.rejects(pg.db.query('INSERT INTO homeauto_cloud.households(household_id) VALUES($1)',[crypto.randomUUID()]));
    await pg.db.exec('RESET ROLE');assert.equal((await migrate(pg.pool)).applied,false);await assert.rejects(assertRuntimeRole(pg.pool));
    await pg.db.query("UPDATE public.homeauto_cloud_migrations SET checksum='wrong' WHERE version=1");await assert.rejects(migrate(pg.pool),/checksum/);
    await pg.db.query('UPDATE public.homeauto_cloud_migrations SET checksum=$1 WHERE version=1',[(await import('node:crypto')).createHash('sha256').update(require('../cloud/migrate').migrationSQL()).digest('hex')]);
    await pg.db.exec('SET ROLE homeauto_fixture');
  });
  await t.test('duplicate, stale, conflicting and tombstoned catalogs have transactional results',async()=>{
    const first=operation(catalog,10);const result=await pg.store.ingest(scope,first);assert.equal(result.status,'accepted');assert.deepEqual(await pg.store.ingest(scope,first),result);
    assert.equal((await pg.store.ingest(scope,operation(catalog,9))).status,'stale');
    const conflict=clone(first);conflict.catalog.home.name='Conflicting replay';await assert.rejects(pg.store.ingest(scope,resign(conflict)),{code:'OPERATION_CONFLICT'});
    await assert.rejects(pg.store.ingest(scope,operation(catalog,10)),{code:'REVISION_CONFLICT'});
    const withRoom=clone(catalog);withRoom.rooms.push({id:'spare',name:'Spare',version:1,sort_order:10});await pg.store.ingest(scope,operation(withRoom,11));await pg.store.ingest(scope,operation(catalog,12));
    const mirror=await pg.store.read(scope);assert.deepEqual(mirror.catalog,catalog);assert.equal(mirror.revision,12);assert.equal(mirror.source,'cloud_metadata');assert.equal(mirror.catalog.rooms.some(r=>r.id==='spare'),false);
  });
  await t.test('tenant isolation and transaction-local context do not leak across clients',async()=>{
    const second=operation(catalog,1,other);await pg.store.ingest(other,second);assert.equal((await pg.store.read(other)).revision,1);
    await assert.rejects(pg.store.ingest(scope,second),{code:'SYNC_SCOPE_MISMATCH'});
    assert.equal((await pg.db.query('SELECT * FROM homeauto_cloud.catalogs')).rows.length,0);
    await pg.db.exec('BEGIN');await pg.db.query("SELECT set_config('homeauto.household_id',$1,true),set_config('homeauto.hub_id',$2,true)",[scope.householdId,scope.hubId]);
    assert.equal((await pg.db.query('SELECT * FROM homeauto_cloud.catalogs')).rows.length,1);
    await assert.rejects(pg.db.query('UPDATE homeauto_cloud.catalogs SET household_id=$1',[other.householdId]));await pg.db.exec('ROLLBACK');
    assert.equal((await pg.db.query('SELECT * FROM homeauto_cloud.catalogs')).rows.length,0);
  });
  await t.test('multiple clients and out-of-order catalogs converge to the highest revision',async()=>{
    const revisions=[18,15,17,14,16,19];await Promise.all(revisions.map(revision=>pg.store.ingest(scope,operation(catalog,revision))));
    assert.equal((await pg.store.read(scope)).revision,19);
  });
  await t.test('commit followed by lost ack retries idempotently and newer edits win',async()=>{
    const local=await createRepository({sync:{...config,...other}});let lose=true;let clock=1000;
    const worker=createSyncWorker(local,{...config,...other},{now:()=>clock,random:()=>.5,fetchImpl:async(url,opts)=>{assert.equal(opts.redirect,'error');const receipt=await pg.store.ingest(other,JSON.parse(opts.body));if(lose){lose=false;throw new Error('connection lost after commit');}return Response.json(receipt);}});
    // Start this separate writer above its synthetic cloud baseline.
    renamed(local,'Second revision');
    try{assert.equal((await worker.runOnce()).state,'retry');clock=local.one('SELECT next_attempt_at FROM cloud_outbox').next_attempt_at;assert.equal((await worker.runOnce()).state,'acknowledged');assert.equal(local.one('SELECT count(*) n FROM cloud_outbox').n,0);assert.equal((await pg.store.read(other)).catalog.home.name,'Second revision');}finally{worker.stop();local.close();}
  });
  await t.test('a restored local revision behind cloud blocks instead of claiming synchronization',async()=>{
    const local=await createRepository({sync:config});const worker=createSyncWorker(local,config,{fetchImpl:async()=>Response.json({...accepted(next(local)),status:'stale'})});
    try{assert.equal((await worker.runOnce()).state,'blocked');assert.equal(syncStatus(local,true).last_error,'CLOUD_AHEAD');assert.equal(next(local).revision,1);}finally{worker.stop();local.close();}
  });
  await t.test('cloud API authenticates scope, bounds bodies, blocks browsers and exposes no controls',async()=>{
    const service=await listen(createCloudApp({store:pg.store,hubs:[config,{...other,token:'b'.repeat(64)}]}));
    const headers={Authorization:'Bearer '+config.token,'Content-Type':'application/json'};
    try{assert.equal((await fetch(service.url+'/health/live')).status,200);assert.equal((await fetch(service.url+'/v1/sync/catalog')).status,401);
      assert.equal((await fetch(service.url+'/v1/sync/catalog',{headers:{...headers,Origin:'https://browser.invalid'}})).status,403);
      assert.equal((await fetch(service.url+'/v1/sync/catalog',{method:'POST',headers,body:JSON.stringify(operation(catalog,3,other))})).status,403);
      assert.equal((await fetch(service.url+'/v1/sync/catalog',{method:'POST',headers,body:'{'})).status,400);
      assert.equal((await fetch(service.url+'/v1/sync/catalog',{method:'POST',headers,body:JSON.stringify({x:'a'.repeat(40000)})})).status,413);
      assert.equal((await fetch(service.url+'/api/devices/door-1/command',{method:'POST',headers,body:'{}'})).status,404);
      const response=await fetch(service.url+'/v1/sync/catalog',{headers});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),null);assert.equal((await response.json()).metadata.source,'cloud_metadata');
      for(let i=0;i<60;i++)await fetch(service.url+'/not-found',{headers});assert.equal((await fetch(service.url+'/v1/sync/catalog',{headers})).status,429);
    }finally{await service.close();}
  });
  await t.test('revoked hub and unavailable or exhausted pool return safe errors',async()=>{
    await pg.db.exec('RESET ROLE');await pg.db.query('UPDATE homeauto_cloud.hubs SET revoked_at=now() WHERE household_id=$1',[other.householdId]);await pg.db.exec('SET ROLE homeauto_fixture');
    await assert.rejects(pg.store.ingest(other,operation(catalog,50,other)),{code:'HUB_NOT_ENROLLED'});
    const service=await listen(createCloudApp({store:createPostgresCatalog({connect:async()=>{throw new Error('password=private db.invalid');}}),hubs:[config]}));
    try{const response=await fetch(service.url+'/v1/sync/catalog',{headers:{Authorization:'Bearer '+config.token}});assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:{code:'CLOUD_UNAVAILABLE',retryable:true}});}finally{await service.close();}
    const calls=[];const store=createPostgresCatalog({connect:async()=>({query:async sql=>{calls.push(sql);if(sql==='BEGIN')return {rows:[]};throw new Error('broken');},release:broken=>calls.push(broken)})});await assert.rejects(store.read(scope));assert.ok(calls.includes('ROLLBACK'));assert.equal(calls.at(-1),true);
  });
  await t.test('read-only legacy extraction maps catalog and preserves every source table',async()=>{
    const SQL=await require('sql.js')();const legacy=new SQL.Database();
    try{legacy.run("CREATE TABLE devices(id TEXT PRIMARY KEY,name TEXT,type TEXT,location TEXT,status TEXT,is_online INTEGER DEFAULT 0,last_seen TEXT,created_at TEXT DEFAULT (datetime('now')));CREATE TABLE rfid_cards(uid TEXT PRIMARY KEY,owner_name TEXT,is_authorized INTEGER DEFAULT 1,created_at TEXT DEFAULT (datetime('now')));CREATE TABLE activity_log(id INTEGER PRIMARY KEY,timestamp TEXT DEFAULT (datetime('now')),device_id TEXT,event_type TEXT,details TEXT);");
      for(const d of devices)legacy.run('INSERT INTO devices(id,name,type,location,status) VALUES(?,?,?,?,?)',[d.id,d.name,d.type,d.location,d.status]);
      legacy.run("INSERT INTO rfid_cards(uid,owner_name) VALUES('AA:BB:CC:DD','Private owner');INSERT INTO activity_log(device_id,event_type,details) VALUES('door-1','legacy','private history')");
      const bytes=Buffer.from(legacy.export());const result=await inspectSQLite(bytes);assert.equal(result.report.source_schema_version,0);assert.equal(result.report.catalog_ready,true);assert.equal(result.catalog.devices.length,7);assert.equal(result.report.tables.find(t=>t.name==='rfid_cards').count,1);assert.ok(!JSON.stringify(result).includes('AA:BB'));assert.ok(!JSON.stringify(result).includes('Private owner'));assert.ok(!JSON.stringify(result).includes('private history'));
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-cloud-source-'));let migrated;try{const file=path.join(dir,'backup.db');fs.writeFileSync(file,bytes);await inspectFile(file);assert.deepEqual(fs.readFileSync(file),bytes);migrated=await createRepository({filename:file});assert.deepEqual(projectCatalog(migrated),result.catalog);}finally{migrated?.close();fs.rmSync(dir,{recursive:true,force:true});}
      legacy.run("UPDATE devices SET is_online=2 WHERE id='light-1'");assert.equal((await inspectSQLite(Buffer.from(legacy.export()))).report.catalog_ready,false);
      legacy.run('PRAGMA user_version=99');await assert.rejects(inspectSQLite(Buffer.from(legacy.export())),/Unsupported/);
      assert.equal(normalizeTimestamp('2026-11-06 12:00:00'),'2026-11-06T12:00:00.000Z');assert.throws(()=>normalizeTimestamp('2026-02-30 00:00:00'));
    }finally{legacy.close();}
  });
  await t.test('version-5 migration manifest verifies source hashes and catalog roundtrip',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeauto-cloud-v5-'));let source;
    try{const filename=path.join(dir,'fixture.db');source=await createRepository({filename});renamed(source,'Version five');source.close();source=null;
      const bytes=fs.readFileSync(filename),result=await inspectFile(filename);assert.equal(result.report.source_schema_version,5);assert.equal(result.report.catalog_ready,true);assert.equal(result.report.source_sha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(result.report.tables.length,17);
      const op=operation(result.catalog,20);await pg.store.ingest(scope,op);await pg.store.ingest(scope,op);assert.equal(hash((await pg.store.read(scope)).catalog),result.report.catalog_checksum);assert.deepEqual(fs.readFileSync(filename),bytes);
    }finally{source?.close();fs.rmSync(dir,{recursive:true,force:true});}
  });
  await t.test('100 synthetic metadata changes stay bounded and meet the declared fixture target',()=>{
    const started=performance.now();const initial=next(repo).revision;
    for(let i=0;i<100;i++)renamed(repo,'Benchmark '+i);
    const elapsed=performance.now()-started;assert.equal(next(repo).revision,initial+100);assert.equal(repo.one('SELECT count(*) n FROM cloud_outbox').n,1);assert.ok(Buffer.byteLength(JSON.stringify(next(repo)))<=32768);assert.ok(elapsed<10000);
    console.log('METADATA_BENCHMARK '+JSON.stringify({edits:100,elapsed_ms:Math.round(elapsed),pending_snapshots:1}));
  });
  await t.test('opt-in runtime sends a catalog through HTTP and PostgreSQL without starting hardware or speech',async()=>{
    const local=await createRepository({sync:config});for(let i=0;i<30;i++)renamed(local,'Runtime '+i);
    const service=await listen(createCloudApp({store:pg.store,hubs:[config]}));const originalFetch=global.fetch;let uploaded;const sent=new Promise(resolve=>uploaded=resolve);let runtime,voiceStarts=0;
    const fakeFetch=async(url,opts)=>{const result=await originalFetch(url.replace(config.origin,service.url),opts);uploaded();return result;};global.fetch=fakeFetch;
    try{
      const settings={...loadConfig({HOMEAUTO_PORT:'0',HOMEAUTO_VOICE_ENABLED:'0'}),CERT_PATH:path.join(os.tmpdir(),'homeauto-nonexistent-cert'),KEY_PATH:path.join(os.tmpdir(),'homeauto-nonexistent-key'),CLOUD_SYNC:config};
      const readiness=()=>({stt_ready:false,tts_ready:false,input_languages:[],reply_languages:[],voices:[]});
      runtime=await startRuntime(settings,{repo:local,broker:{close:async()=>{}},sessions:{readRequest:()=>({token:'fixture',session:{user_id:'fixture-owner',role:'owner'}})},speech:{readiness,start:()=>voiceStarts++,close:()=>{}}});
      await sent;for(let i=0;i<20&&local.one('SELECT count(*) n FROM cloud_outbox').n;i++)await new Promise(resolve=>setTimeout(resolve,10));
      const response=await originalFetch('http://127.0.0.1:'+runtime.server.address().port+'/api/system');const system=await response.json();assert.equal(response.status,200);assert.equal(system.cloud_sync.state,'idle');assert.equal(system.door_enabled,false);assert.equal(system.broker.enabled,false);assert.equal((await pg.store.read(scope)).catalog.home.name,'Runtime 29');assert.equal(voiceStarts,1);assert.ok(!JSON.stringify(system.cloud_sync).includes(config.token));
    }finally{global.fetch=originalFetch;await runtime?.stop();if(!runtime)local.close();await service.close();}
  });
});
