// A separate, explicitly simulated home. This module never sends network requests.
const registry = [
  ['light-1', 'Sofa light', 'light', 'living-room', 'lights', 'on'], ['light-2', 'Reading light', 'light', 'living-room', 'lights', 'off'],
  ['light-3', 'Bedside light', 'light', 'bedroom', 'lights', 'off'], ['light-4', 'Desk light', 'light', 'bedroom', 'lights', 'on'],
  ['door-1', 'Front Door', 'door', 'entrance', 'door', 'locked'], ['sensor-gas', 'Gas Sensor', 'sensor', 'kitchen', 'lights', 'normal'], ['sensor-motion', 'Motion Sensor', 'sensor', 'hallway', 'lights', 'clear'],
];
const rooms = [['living-room', 'Living room'], ['bedroom', 'Bedroom'], ['entrance', 'Entrance'], ['kitchen', 'Kitchen'], ['hallway', 'Hallway']].map(([id, name]) => ({ id, name, version: 1 }));
const clone = value => JSON.parse(JSON.stringify(value));
const fail = code => { throw Object.assign(new Error(code), { code }); };
export function createDemoHome(session, storage = null, now = () => Date.now()) {
  const storageKey = 'homeauto.demo.data.v1:' + session.user.id + ':' + session.household_id;
  let values = Object.fromEntries(registry.map(([id,,,,, value]) => [id, value])), favorites = ['light-1', 'light-3'], sequence = 0;
  let preferences = { reply_language: 'auto', input_language: 'auto', spoken_replies: false, voice_rate: 1, notification_categories: [], favorites, version: 0 };
  let commands = [], activity = [], alerts = [], intents = new Map();
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (saved?.version === 1) {
      for (const [id,,,,, initial] of registry) if (saved.values?.[id] === initial || (id.startsWith('light-') && ['on','off'].includes(saved.values?.[id]))) values[id] = saved.values[id];
      if (Array.isArray(saved.favorites)) favorites = saved.favorites.filter(id => registry.some(d => d[0] === id)); preferences.favorites = favorites;
    }
  } catch {}
  const save = () => { try { storage?.setItem(storageKey, JSON.stringify({ version: 1, values, favorites: preferences.favorites })); } catch {} };
  const record = (action, deviceId = null) => { sequence++; activity.unshift({ id: crypto.randomUUID(), timestamp: new Date(now()).toISOString(), event_type: action, category: deviceId?.startsWith('light-') ? 'lights' : action === 'demo_scenario' ? 'sensors' : 'system', device_id: deviceId, actor: 'Demo home', details: { status: deviceId ? values[deviceId] : undefined } }); activity = activity.slice(0, 60); save(); };
  const snapshot = () => {
    const stamp = new Date(now()).toISOString();
    return clone({ schema_version: 1, server_epoch: 'demo:' + session.household_id, server_time: stamp, cloud_cursor: String(sequence), gateway_sequence: sequence,
      demo: true, gateway: { registered: true, state: 'demo', connected: true, last_seen_at: stamp, simulated: true },
      devices: registry.map(([id,name,type,room_id,board_id]) => ({ id,name,type,room_id,board_id, location: rooms.find(r => r.id === room_id).name, version:1, status:values[id],is_online:1,connectivity:'online', capabilities:type==='light'?['switch']:type==='door'?['lock','unlock']:[id==='sensor-gas'?'gas_reading':'motion_event'],
        observation:{reported_status:values[id],received_at:stamp,freshness:'current',retained:false,source:'demo',version:sequence},latest:id==='sensor-gas'?{raw:220,gas_ppm:53,alert:values[id]==='alert',received_at:stamp}:id==='sensor-motion'?{motion:values[id]==='detected',received_at:stamp}:null,pending_command_id:null })),
      rooms, espBoards: { lights:{id:'lights',name:'Demo lights and sensors',online:true,lastSeen:stamp},door:{id:'door',name:'Demo door',online:true,lastSeen:stamp} }, mqtt:{connected:true,simulated:true},commands,alerts,
      session:{...session.user,can_unlock:false},preferences,home:{home_name:'Demo home',version:1},speech:{stt_ready:false,tts_ready:false,input_languages:[],reply_languages:[],voices:[]},
      system:{simulation:true,mode:'demo',door_enabled:false,persistence_healthy:true,fault:null,remote_lights_enabled:true},capabilities:{metadata_edit:false,rfid:false,local_voice:false,remote_lights:true} });
  };
  const command = (id, action) => {
    if (!['owner','resident'].includes(session.user.role)) fail('FORBIDDEN');
    if (!id.startsWith('light-') || !registry.some(d => d[0] === id) || !['on','off'].includes(action)) fail('DEMO_ACTION_UNAVAILABLE');
    values[id] = action; const stamp = new Date(now()).toISOString();
    const result = { id:crypto.randomUUID(),device_id:id,action,state:'observed',created_at:stamp,updated_at:stamp,demo:true };
    commands.unshift(result); commands = commands.slice(0,32); record('demo_light_changed',id); return {command:clone(result)};
  };
  return {
    snapshot,
    reset() { try{storage?.removeItem(storageKey);}catch{}values=Object.fromEntries(registry.map(([id,,,,,v])=>[id,v]));commands=[];activity=[];alerts=[];preferences.favorites=['light-1','light-3'];record('demo_reset'); },
    scenario(kind) {
      if (!['gas','motion','clear'].includes(kind)) fail('DEMO_ACTION_UNAVAILABLE');
      values['sensor-gas']=kind==='gas'?'alert':'normal';values['sensor-motion']=kind==='motion'?'detected':'clear';
      for (const alert of alerts) if (alert.state==='active') { alert.state='resolved';alert.resolved_at=new Date(now()).toISOString(); }
      if (kind!=='clear') alerts.unshift({id:crypto.randomUUID(),kind,severity:kind==='gas'?'critical':'info',state:'active',device_id:kind==='gas'?'sensor-gas':'sensor-motion',opened_at:new Date(now()).toISOString(),receipt:{read_at:null,acknowledged_at:null},demo:true});
      alerts = alerts.slice(0, 50); record('demo_scenario');
    },
    async request(path, {method='GET',body}={}) {
      const url = new URL(path,'https://demo.invalid'), p=url.pathname;
      if (p==='/api/snapshot' && method==='GET') return snapshot();
      if (p==='/api/households' && method==='GET') return {items:[{household_id:session.household_id,name:'Demo home',role:session.user.role}]};
      if (p==='/api/preferences' && method==='PUT') { if(body.version!==preferences.version)fail('VERSION_CONFLICT');preferences={...preferences,...body,version:preferences.version+1,spoken_replies:false};record('demo_preferences');return clone(preferences); }
      const match=p.match(/^\/api\/devices\/([^/]+)\/command$/); if(match&&method==='POST')return command(match[1],body.action);
      if (p==='/api/activity' && method==='GET') { const f=Object.fromEntries(url.searchParams); return {items:clone(activity.filter(e=>(!f.device_id||e.device_id===f.device_id)&&(!f.category||f.category==='all'||e.category===f.category)&&(!f.from||e.timestamp>=f.from)&&(!f.to||e.timestamp<=f.to)&&(!f.q||JSON.stringify(e).toLowerCase().includes(f.q.toLowerCase())))),next_cursor:null}; }
      const alert=p.match(/^\/api\/alerts\/([^/]+)\/(read|acknowledge)$/);
      if(alert&&method==='POST'){const a=alerts.find(a=>a.id===alert[1]);if(!a)fail('NOT_FOUND');a.receipt[alert[2]==='read'?'read_at':'acknowledged_at']=new Date(now()).toISOString();record('demo_alert_viewed');return clone(a);}
      if(p==='/api/system'&&method==='GET')return {version:'2.0.0',mode:'demo',gateway:snapshot().gateway,broker:{connected:true,enabled:false},boards:snapshot().espBoards,database:{healthy:true,engine:'Browser demo'},speech:snapshot().speech,door_enabled:false,simulation:true,diagnostics:{commands:[]},resources:{scope:'demo',uptime_seconds:0,rss_bytes:0}};
      if(p==='/api/assistant/interpret'&&method==='POST'){
        const text=String(body.text||'').toLowerCase(), hi=/[\u0900-\u097f]/.test(text);
        let ids=registry.filter(([id,name])=>text.includes(name.toLowerCase())||text.includes(id.replace('-',' '))).map(d=>d[0]);
        if(/gas|गैस/.test(text))ids=['sensor-gas'];else if(/motion|मोशन/.test(text))ids=['sensor-motion'];else if(/door|दरवाज/.test(text))ids=['door-1'];else if(/all lights|सभी लाइट/.test(text))ids=registry.filter(d=>d[2]==='light').map(d=>d[0]);else if(!ids.length&&/light|लाइट/.test(text))ids=['light-1'];
        if(!ids.length)fail('INTENT_UNKNOWN');
        const action=/\boff\b|बंद/.test(text)?'off':/\bon\b|चालू/.test(text)?'on':null;
        const intent={kind:action?'command':'query',device_ids:ids,action,language:hi?'hi':'en',sensitive:!!action&&ids.includes('door-1')};const intent_id=crypto.randomUUID();intents.set(intent_id,{intent,expires:now()+30000});if(intents.size>32)intents.delete(intents.keys().next().value);return {intent_id,intent,expires_at:new Date(now()+30000).toISOString()};
      }
      if(p==='/api/assistant/execute'&&method==='POST'){
        const saved=intents.get(body.intent_id);intents.delete(body.intent_id);if(!saved||saved.expires<now())fail('INTENT_EXPIRED');const intent=saved.intent;if(intent.sensitive)fail('REMOTE_DOOR_DISABLED');
        if(intent.kind==='query')return {answer:{result_id:crypto.randomUUID(),language:intent.language,text:(intent.language==='hi'?'डेमो: ':'Demo: ')+intent.device_ids.map(id=>registry.find(d=>d[0]===id)[1]+': '+values[id]).join('. ')}};
        return {commands:intent.device_ids.map(id=>command(id,intent.action).command),errors:[]};
      }
      fail('DEMO_ACTION_UNAVAILABLE');
    },
  };
}
