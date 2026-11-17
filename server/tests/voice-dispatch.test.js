const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function fixture(simulation) {
  const source = fs.readFileSync(path.join(__dirname, '../../public/js/main.js'), 'utf8');
  const code = source.slice(source.indexOf('function reviewVoiceIntent('), source.indexOf('ctx.voice = new VoiceCapture'));
  const events = []; let confirm;
  const scope = { state: { snapshot: { system: { simulation }, devices: [{ id: 'light-1', name: 'Light 1' }] } }, ctx: { assistantGeneration: 1, conversation: { transcript: 'turn on light one' } }, executeIntent: p => events.push(p), modal: (title, body, options) => { confirm = options.onConfirm; }, el: () => ({}), t: s => s };
  vm.runInNewContext(code + ';this.review = reviewVoiceIntent;', scope);
  return { review: scope.review, events, confirm: () => confirm?.(), hasConfirmation: () => !!confirm, ctx: scope.ctx };
}
const request = { intent: { kind: 'control', sensitive: false, action: 'on', device_ids: ['light-1'] } };
test('a clear simulation voice command executes without a confirmation dialog', () => {
  const f = fixture(true); f.review(request); assert.equal(f.events.length, 1); assert.equal(f.hasConfirmation(), false);
});
test('physical profile still requires review and ignores retired confirmation', () => {
  const f = fixture(false); f.review(request); assert.equal(f.events.length, 0); assert.equal(f.hasConfirmation(), true);
  f.ctx.assistantGeneration++; f.confirm(); assert.equal(f.events.length, 0);
  f.review(request); f.confirm(); assert.equal(f.events.length, 1);
});
test('an unspecified simulation flag cannot authorize automatic device execution', () => {
  const f = fixture(undefined); f.review(request); assert.equal(f.events.length, 0); assert.equal(f.hasConfirmation(), true);
});
test('read-only conversational replies do not require a physical-device confirmation', () => {
  const f = fixture(false); f.review({ intent: { kind: 'conversation', sensitive: false, action: 'reply', device_ids: [] } });
  assert.equal(f.events.length, 1); assert.equal(f.hasConfirmation(), false);
});
test('Hindi command-result text follows reply language even with an English interface',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../public/js/main.js'),'utf8');
 const code=source.slice(source.indexOf('function updateCommandConversation('),source.indexOf('function reviewVoiceIntent('));
 const ctx={conversation:{commandIds:['synthetic'],replyLanguage:'hi'},updateConversation(){}};
 const state={snapshot:{system:{simulation:true},preferences:{spoken_replies:false},commands:[{id:'synthetic',device_id:'light-1',state:'observed',action:'off'}],devices:[{id:'light-1',name:'Light 1'}]}};
 vm.runInNewContext(code+';updateCommandConversation();',{ctx,state,Api:{demo:null},t:s=>s});
 assert.match(ctx.conversation.response,/डेमो बंद/);assert.doesNotMatch(ctx.conversation.response,/Controller reports/);
});
test('backgrounding stops capture but does not discard an already processing response',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../public/js/main.js'),'utf8');
 const handler=source.split('\n').find(line=>line.startsWith("document.addEventListener('visibilitychange'"));
 for(const state of ['permission','listening','processing','ready']){
  let onVisibility,cancelled=0,stopped=0;
  vm.runInNewContext(handler,{document:{hidden:true,addEventListener:(name,fn)=>{onVisibility=fn;}},ctx:{voice:{state,cancel:()=>cancelled++},stopAudio:()=>stopped++}});
  onVisibility();assert.equal(cancelled,['permission','listening'].includes(state)?1:0);assert.equal(stopped,1);
 }
});
test('a legitimate synthesis longer than thirty seconds reaches playback within its bounded poll window', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/js/main.js'), 'utf8');
  const block = source.slice(source.indexOf('const ctx = {'), source.indexOf('function renderTransition('));
  let reads = 0, played = 0; const notices = [];
  class Audio { pause() {} setAttribute() {} async play() { played++; } }
  const scope = { state: { snapshot: { preferences: { reply_language: 'auto' } } }, preferences: { language: 'en' },
    document: { hidden: false, getElementById: () => ({ replaceChildren() {} }) }, el: () => ({}), t: s => s, errorText: error => error.message,
    setTimeout: fn => { fn(); }, Map, Set, Audio,
    Api: { request: async route => route === '/api/assistant/speech' ? { job_id: 'synthetic' } : ++reads <= 80 ? { state: 'queued' } : { state: 'ready', audio_url: '/synthetic.wav' } } };
  vm.runInNewContext(block + ';this.ctx=ctx;', scope); scope.ctx.notify = message => notices.push(message);
  await scope.ctx.speak('synthetic-result');
  assert.equal(reads, 81); assert.equal(played, 1); assert.deepEqual(notices, []);
});
