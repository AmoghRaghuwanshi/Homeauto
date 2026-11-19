const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');

// Exercise the actual frontend coordinator without a browser or physical APIs.
// A deferred network response makes the previously unsafe interleavings deterministic.
function coordinator(){
  const main=fs.readFileSync(path.join(root,'public/js/main.js'),'utf8');
  const actual=main.slice(main.indexOf('const ctx = {'),main.indexOf('ctx.startDemo='));
  const disconnect=fs.readFileSync(path.join(root,'public/js/state.js'),'utf8').split('\n').find(l=>l.startsWith('export function disconnectState')).replace('export ','');
  const effects={realWrites:0,retired:0,snapshotReads:0};let rejectSession,resolveSession,resolvePreference;
  const session={user:{id:'synthetic',role:'owner'},household_id:'synthetic-home'};
  const snapshot=()=>({devices:[],rooms:[],commands:[],preferences:{version:0}});
  const model={request:async()=>({command:{state:'observed'}})};
  const state={session,snapshot:snapshot(),revision:0,connected:true};
  const Api={mode:'cloud',demo:model,sessionVersion:0,mutationsPaused:false,startDemo(s,m){this.demo=m;this.sessionVersion++;},exitDemo(){this.demo=null;this.sessionVersion++;},async request(p,o={}){
    if(p==='/api/auth/session')return new Promise((resolve,reject)=>{resolveSession=resolve;rejectSession=reject;});
    if(p==='/api/preferences'&&o.method==='PUT')return new Promise(resolve=>{resolvePreference=resolve;});
    if(p==='/api/snapshot'){effects.snapshotReads++;return snapshot();}
    if(p.endsWith('/command')){if(!this.demo)effects.realWrites++;return {command:{state:'observed'}};}throw Error('Unexpected path '+p);
  }};
  const scope={state,Api,pageLeaving:false,console,structuredClone,Map,Set,clearInterval,clearTimeout,setTimeout,crypto:require('node:crypto').webcrypto,
    document:{querySelectorAll:()=>[],getElementById:()=>null},app:{replaceChildren(){effects.retired++;}},el:()=>({}),loadingPanel:()=>({}),render(){},onUpdate(){},acceptSnapshot(s){state.snapshot=s;},connectState(){},navigation:{go(){}},createDemoHome:()=>model,t:s=>s,errorText:e=>e.code};
  vm.createContext(scope);vm.runInContext('let realDemoSession=null,main,shellBuilt=true,assistantBuilt=true,knownAlerts=new Set(),initialAlerts=true;'+disconnect+'\n'+actual+'\nctx.voice={cancel(){}};ctx.notify=()=>{};this.coordinator={ctx,switchDemo};',scope);
  return {...scope.coordinator,state,Api,effects,setLeaving:value=>{scope.pageLeaving=value;},rejectSession:()=>rejectSession(Object.assign(Error('Synthetic timeout'),{code:'CONNECTION_LOST'})),resolveSession:()=>resolveSession(session),resolvePreference:()=>resolvePreference({version:1}),model};
}

test('failed demo exit retires controls, rejects an in-transition command and restores simulation isolation',async()=>{
  const f=coordinator();const leaving=f.switchDemo(false);
  assert.equal(f.ctx.transitioning,true);assert.equal(f.Api.mutationsPaused,true);assert.equal(f.effects.retired,1);
  await f.ctx.command('light-1','on');assert.equal(f.effects.realWrites,0);
  f.rejectSession();await assert.rejects(leaving,{code:'CONNECTION_LOST'});
  assert.equal(f.Api.demo,f.model);assert.ok(f.state.session);assert.equal(f.ctx.transitioning,false);assert.equal(f.Api.mutationsPaused,false);
  await f.ctx.command('light-1','on');assert.equal(f.effects.realWrites,0);
});

test('demo entry releases preference ownership and a late real-home save cannot re-lock the demo',async()=>{
  const f=coordinator();f.Api.demo=null;const save=f.ctx.preference({favorites:['light-1']});assert.equal(f.ctx.preferenceBusy,true);
  await f.switchDemo(true);assert.equal(f.ctx.preferenceBusy,false);f.resolvePreference();await save;assert.equal(f.ctx.preferenceBusy,false);assert.equal(f.ctx.preferenceOperation,null);
});

test('departing documents do not start snapshot reads and restored documents can reconcile again',async()=>{
  const f=coordinator();f.setLeaving(true);await f.ctx.refresh();assert.equal(f.effects.snapshotReads,0);
  f.setLeaving(false);await f.ctx.refresh();assert.equal(f.effects.snapshotReads,1);
});

test('transport blocks every non-auth mutation during a home transition before any fetch',async()=>{
  const {Api}=await import('data:text/javascript;base64,'+fs.readFileSync(path.join(root,'public/js/api.js')).toString('base64'));
  const original=global.fetch;let requests=0;global.fetch=async()=>{requests++;return new Response('{}');};
  try {Api.mutationsPaused=true;for(const method of ['POST','PUT','DELETE'])await assert.rejects(Api.request('/api/devices/light-1/command',{method,body:{}}),{code:'HOME_SWITCH_IN_PROGRESS'});assert.equal(requests,0);await Api.request('/api/auth/session');assert.equal(requests,1);}finally{global.fetch=original;Api.mutationsPaused=false;}
});

test('all-lights action leaves the fourth relay fan unchanged in the real home',async()=>{
  const f=coordinator();f.Api.demo=null;
  f.state.snapshot.devices=['light-1','light-2','light-3','light-4'].map(id=>({id,type:'light'}));
  const sent=[];f.ctx.command=async id=>{sent.push(id);return true;};
  await f.ctx.bulkOff();
  assert.deepEqual(sent,['light-1','light-2','light-3']);
});
