const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),main=fs.readFileSync(path.join(root,'public/js/main.js'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

function coordinator({failSnapshot=false,holdCommands=false,holdExecute=false}={}){
  const effects={posts:[],retired:0,notices:[],requests:[]},commands=[],execution=deferred();
  const session=id=>({household_id:id,user:{id:'synthetic-user',role:'owner',can_unlock:false}});
  const snapshot=id=>({devices:[1,2,3,4].map(n=>({id:'light-'+n,type:'light',name:id+' light '+n})),rooms:[],commands:[],preferences:{version:0,input_language:'auto',spoken_replies:false}});
  let cookieHouse='home-a';
  const state={session:session(cookieHouse),snapshot:snapshot(cookieHouse),connected:true,revision:0};
  const model={request:async()=>({})};
  const Api={mode:'cloud',sessionVersion:1,demo:null,mutationsPaused:false,startDemo(s,m){this.demo=m;this.sessionVersion++;},exitDemo(){this.demo=null;this.sessionVersion++;},async request(p,o={}){
    effects.requests.push({path:p,house:cookieHouse,method:o.method||'GET'});
    if(p==='/api/auth/household'){cookieHouse=o.body.household_id;this.sessionVersion++;return session(cookieHouse);}
    if(p==='/api/snapshot'){if(failSnapshot)throw Object.assign(Error('Synthetic failed refresh'),{code:'CONNECTION_LOST'});return snapshot(cookieHouse);}
    if(p.endsWith('/command')){const post={house:cookieHouse,path:p};effects.posts.push(post);if(holdCommands&&cookieHouse==='home-a'){const d=deferred();commands.push(d);return d.promise;}return {command:{id:'command-'+effects.posts.length,state:'observed'}};}
    if(p==='/api/assistant/interpret')return {intent_id:'intent',intent:{kind:'query',sensitive:false}};
    if(p==='/api/assistant/execute'){if(holdExecute&&effects.requests.filter(x=>x.path===p).length===1)return execution.promise;return {answer:{text:'Current reply',result_id:'current-result',language:'en'}};}
    throw Error('Unexpected mocked API '+p);
  }};
  const scope={state,Api,HomeAutoLanguage:require('../../public/js/assistant-language'),pageLeaving:false,structuredClone,console,Map,Set,clearInterval,clearTimeout,setTimeout,crypto:crypto.webcrypto,
    location:{pathname:'/assistant'},document:{querySelectorAll:()=>[],getElementById:()=>null},empty:()=>({}),button:()=>({}),app:{replaceChildren(){effects.retired++;}},el:()=>({}),loadingPanel:()=>({}),
    render(){},onUpdate(){},acceptSnapshot(s){state.snapshot=s;},connectState(){},navigation:{go(){}},createDemoHome:()=>model,t:x=>x,errorText:e=>e.code||e.message};
  const disconnect=fs.readFileSync(root+'/public/js/state.js','utf8').split('\n').find(l=>l.startsWith('export function disconnectState')).replace('export ','');
  const code=main.slice(main.indexOf('const ctx = {'),main.indexOf('ctx.startDemo='));
  const assistant=main.slice(main.indexOf('function assistantError('),main.indexOf('function updateCommandConversation('));
  vm.createContext(scope);vm.runInContext('let realDemoSession=null,main,shellBuilt=true,assistantBuilt=false,knownAlerts=new Set(),initialAlerts=true;'+disconnect+'\n'+code+'\n'+assistant+'\nctx.voice={cancel(){}};ctx.notify=(m)=>effects.notices.push(m);ctx.navigate=()=>{};this.coordinator={ctx,switchDemo};',Object.assign(scope,{effects}));
  return {...scope.coordinator,state,Api,effects,commands,execution};
}
function voiceFixture(){
  const ready=deferred(),sockets=[],timers=new Map();let timerId=0,stops=0;
  class FakeNode{constructor(){this.port={};}connect(node){return node;}disconnect(){}}
  class FakeContext{constructor(){this.audioWorklet={addModule:async()=>{}};this.destination={};}createMediaStreamSource(){return new FakeNode();}createGain(){const g=new FakeNode();g.gain={value:1};return g;}resume(){return ready.promise;}close(){return Promise.resolve();}}
  class FakeSocket{constructor(){this.readyState=0;sockets.push(this);}send(){}close(){this.readyState=3;}}
  const stream={getTracks:()=>[{stop(){stops++;}}]};
  const scope={Api:{request:async()=>({ticket:'synthetic-ticket'})},navigator:{mediaDevices:{getUserMedia:async()=>stream}},location:{protocol:'http:',host:'synthetic.invalid'},WebSocket:FakeSocket,AudioContext:FakeContext,AudioWorkletNode:FakeNode,crypto:crypto.webcrypto,
    setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);}};
  let code=fs.readFileSync(root+'/public/js/voice-controller.js','utf8').replace("import { Api } from './api.js';",'').replace('export class VoiceCapture','class VoiceCapture');
  vm.createContext(scope);vm.runInContext(code+'\nthis.Capture=VoiceCapture;',scope);
  const states=[],errors=[],progress=[],capture=new scope.Capture({onState:s=>states.push(s),onIntent(){},onTranscript(){},onProgress:s=>progress.push(s),onError:e=>errors.push(e.message||e.code)});
  return {capture,ready,sockets,timers,states,errors,progress,stops:()=>stops};
}

test('SM2-01: bulk action never dispatches its remaining batch into another home',async()=>{
 const f=coordinator({holdCommands:true});const bulk=f.ctx.bulkOff();assert.equal(f.commands.length,2);
 await f.ctx.switchHome('home-b');for(const d of f.commands)d.resolve({command:{state:'observed'}});await bulk;
 assert.deepEqual(f.effects.posts.map(x=>x.house),['home-a','home-a']);assert.equal(f.state.session.household_id,'home-b');assert.ok(f.effects.retired>0);
});
test('SM2-01: failed hydration leaves no old controls or current command authority',async()=>{
 const f=coordinator({failSnapshot:true});await f.ctx.switchHome('home-b');
 assert.equal(f.state.session,null);assert.equal(f.state.snapshot,null);assert.ok(f.effects.retired>=2);
 await f.ctx.command('light-1','off');assert.equal(f.effects.posts.length,0);assert.equal(f.ctx.transitioning,false);
});
test('SM2-02: reauth rotation discards old result but releases its own busy lock',async()=>{
 const f=coordinator({holdCommands:true});const command=f.ctx.command('light-1','off');f.Api.sessionVersion++;
 f.commands[0].resolve({command:{state:'observed'}});await command;assert.equal(f.ctx.pending.has('light-1'),false);
});
test('SM2-02: retired command cleanup cannot release a newer command owner',async()=>{
 const f=coordinator({holdCommands:true});const first=f.ctx.command('light-1','off');
 f.ctx.commandOwners.clear();f.ctx.pending.clear();f.Api.sessionVersion++;
 const second=f.ctx.command('light-1','on');f.commands[0].resolve({command:{state:'observed'}});await first;
 assert.equal(f.ctx.pending.has('light-1'),true);f.commands[1].resolve({command:{state:'observed'}});await second;assert.equal(f.ctx.pending.size,0);
});
test('SM2-04: an old failed execution cannot overwrite a newer answer',async()=>{
 const f=coordinator({holdExecute:true});const first=f.ctx.typed('old query');await flush();await f.ctx.typed('new query');
 f.execution.reject(Object.assign(Error('Old request failed'),{code:'CONNECTION_LOST'}));await first;assert.equal(f.ctx.conversation.response,'Current reply');assert.equal(f.effects.notices.length,0);
});
test('a typed request retires capture and audio before interpreting the new turn',async()=>{
 const f=coordinator();let cancelled=0,stopped=0;f.ctx.voice.cancel=()=>cancelled++;f.ctx.stopAudio=()=>stopped++;
 await f.ctx.typed('new question');assert.equal(cancelled,1);assert.equal(stopped,1);
 assert.equal(f.ctx.conversation.replyLanguage,'en');
});
test('SM2-03: cancel during resume cannot reenter listening or leave a deadline',async()=>{
 const f=voiceFixture(),start=f.capture.start();await flush();const ws=f.sockets[0];ws.readyState=1;ws.onopen();ws.onmessage({data:JSON.stringify({type:'voice_ready'})});await flush();
 assert.equal(f.capture.stage,'graph');f.capture.cancel();f.ready.resolve();await start;
 assert.equal(f.capture.state,'ready');assert.equal(f.capture.stream,null);assert.equal(f.stops(),1);assert.equal(f.timers.size,0);
});
test('SM2-03: socket closes before ready and start settles with one failure',async()=>{
 const f=voiceFixture();let settled=false;const start=f.capture.start().then(()=>{settled=true;});await flush();f.sockets[0].onclose();await flush();
 assert.equal(settled,true);await start;assert.equal(f.errors.length,1);assert.equal(f.timers.size,0);assert.equal(f.capture.state,'ready');
});
test('SM2-03: explicit cancel settles a pending handshake without an error',async()=>{
 const f=voiceFixture();let settled=false;const start=f.capture.start().then(()=>{settled=true;});await flush();f.capture.cancel();await flush();
 assert.equal(settled,true);await start;assert.equal(f.errors.length,0);assert.equal(f.timers.size,0);
});
test('speech processing has a deadline even when the socket remains open without a reply',async()=>{
 const f=voiceFixture(),start=f.capture.start();await flush();const ws=f.sockets[0];ws.readyState=1;ws.onopen();ws.onmessage({data:JSON.stringify({type:'voice_ready'})});f.ready.resolve();await start;
 f.capture.end();assert.equal(f.capture.state,'processing');const watchdog=[...f.timers.values()].find(t=>t.ms===65000);assert.ok(watchdog);watchdog.fn();
 assert.equal(f.capture.state,'ready');assert.ok(f.errors.includes('VOICE_RESPONSE_TIMEOUT'));assert.equal(f.timers.size,0);
});
test('explicit lifecycle cancellation clears processing and reports why it stopped',async()=>{
 const f=voiceFixture(),start=f.capture.start();await flush();const ws=f.sockets[0];ws.readyState=1;ws.onopen();ws.onmessage({data:JSON.stringify({type:'voice_ready'})});f.ready.resolve();await start;f.capture.end();
 f.capture.cancel('VOICE_PAGE_HIDDEN');assert.equal(f.capture.state,'ready');assert.deepEqual(f.errors,['VOICE_PAGE_HIDDEN']);assert.equal(f.timers.size,0);
});

test('only current utterance progress is shown, without extending the bounded deadline',async()=>{
 const f=voiceFixture(),start=f.capture.start();await flush();const ws=f.sockets[0];ws.readyState=1;ws.onopen();ws.onmessage({data:JSON.stringify({type:'voice_ready'})});f.ready.resolve();await start;f.capture.end();
 const timer=f.capture.processingDeadline;
 const progress=(stage,id=f.capture.utterance)=>ws.onmessage({data:JSON.stringify({type:'voice_progress',utterance_id:id,stage})});
 progress('encoding','retired-utterance');progress('untrusted');assert.deepEqual(f.progress,[]);
 progress('encoding');assert.deepEqual(f.progress,['encoding']);assert.equal(f.capture.phase,'encoding');
 progress('decoding');assert.deepEqual(f.progress,['encoding','decoding']);assert.equal(f.capture.processingDeadline,timer);
 assert.equal(f.timers.get(timer).ms,65000);f.capture.cancel();assert.equal(f.capture.phase,null);
 progress('encoding');assert.deepEqual(f.progress,['encoding','decoding']);assert.equal(f.timers.size,0);
});
