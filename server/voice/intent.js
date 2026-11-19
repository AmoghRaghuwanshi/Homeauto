const { fail } = require('../lib/errors');
const { wakePhrase } = require('../../public/js/assistant-language');
function normalize(text) {
  const digits = { one: '1', two: '2', three: '3', four: '4', एक: '1', दो: '2', तीन: '3', चार: '4', वन: '1', टू: '2', थ्री: '3', फोर: '4', ek: '1', do: '2' };
  // Explicit noun/spelling equivalents only; never guess an action or a missing number.
  const forms = { लाइटें: 'लाइट', लाइट्स: 'लाइट', लाइटे: 'लाइट', लाईट: 'लाइट', लाईटे: 'लाइट', लाईटें: 'लाइट', लाईट्स: 'लाइट', बत्तियां: 'बत्ती', बत्तियाँ: 'बत्ती', बन्द: 'बंद', कमरे: 'कमरा', कम्रा: 'कमरा' };
  return text.normalize('NFC').toLowerCase().replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x966)).replace(/[’']/g, ' ').replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    .split(' ').map(word => Object.hasOwn(forms, word) ? forms[word] : word).join(' ')
    .replace(/(room|light|lamp|कमरा|रूम|लाइट|बत्ती|kamra)\s+(one|two|three|four|एक|दो|तीन|चार|वन|टू|थ्री|फोर|ek|do)(?=\s|$)/gu, (_, target, number) => target + ' ' + digits[number]);
}
const phrase = (s, words) => words.some(w => (' ' + s + ' ').includes(' ' + w + ' '));
function detectWakeWord(text) {
  const result = wakePhrase(text);
  return { found: result.found, command: normalize(result.command) };
}
function resolveCommand(input, devices, rooms, aliases = []) {
  if (typeof input !== 'string' || !input.trim() || input.length > 500) return { ok: false, reason: 'unsupported', choices: [] };
  const s = detectWakeWord(input).command
    .replace(/^(?:(?:(?:can|could|would) you|please|kindly|कृपया)\s+)+/u, '')
    .replace(/\s+please$/u, '');
  const reject = (reason, choices = []) => ({ ok: false, reason, choices });
  if (phrase(s, ['tomorrow','later','after','before','when','then','until','if','कल','बाद','जब','agar','baad','kal']) && !/^check if\s/.test(s)) return reject('unsupported');
  if (phrase(s, ['not', 'don t', 'dont', 'never', 'मत', 'नहीं', 'नही', 'mat', 'nahi', 'nahin'])) return reject('negated');
  if (phrase(s, ['except', 'excluding', 'unless', 'but', 'लेकिन', 'छोड़कर', 'ना'])) return reject('unsupported');
  if (phrase(s, ['camera', 'ac', 'curtain', 'music', 'temperature', 'dim', 'brightness', 'कैमरा', 'तापमान'])) return reject('unsupported');
  const query = phrase(s, ['status', 'check', 'what', 'is', 'are', 'स्थिति', 'क्या', 'kya', 'haal']);
  const door = phrase(s, ['door', 'gate', 'दरवाजा', 'दरवाज़ा', 'गेट', 'darwaza', 'darwaja']);
  const gas = phrase(s, ['gas', 'गैस']); const motion = phrase(s, ['motion', 'movement', 'मोशन', 'हलचल']);
  const fan = phrase(s, ['fan', 'पंखा', 'pankha']);
  if (fan && phrase(s, ['light', 'lights', 'lamp', 'lamps', 'लाइट', 'बत्ती'])) return reject('conflicting');
  const homeQuery = query && phrase(s, ['home', 'house', 'घर', 'ghar']);
  const on = phrase(s, ['on', 'चालू', 'ऑन', 'जलाओ', 'जला', 'chalu', 'jala', 'jalao']);
  const off = phrase(s, ['off', 'बंद', 'बुझाओ', 'बुझा', 'ऑफ', 'band', 'bandh', 'bujhao']);
  const unlock = phrase(s, ['unlock', 'open', 'अनलॉक', 'खोलो', 'खोल', 'kholo', 'khol']);
  const lock = phrase(s, ['lock', 'close', 'secure', 'लॉक', 'ताला', 'tala']);
  if ([door, gas, motion, fan].filter(Boolean).length > 1 || on && off || unlock && lock) return reject('conflicting');
  let action = null, targets = [], targetSource = 'explicit_device';
  if (homeQuery) { action = 'query'; targets = devices.map(d => d.id); targetSource = 'explicit_all'; }
  else if (gas || motion) { if (!query || on || off || lock || unlock) return reject('unsupported'); action = 'query'; targets = [gas ? 'sensor-gas' : 'sensor-motion']; }
  else if (door) { action = query ? 'query' : unlock ? 'unlock' : lock || off ? 'lock' : null; targets = ['door-1']; }
  else if (fan) { if (unlock || lock) return reject('unsupported'); action = query ? 'query' : on ? 'on' : off ? 'off' : null; targets = ['light-4']; }
  else {
    if (unlock || lock) return reject('unsupported');
    action = query ? 'query' : on ? 'on' : off ? 'off' : null;
    const lights = devices.filter(d => d.type === 'light' && d.id !== 'light-4');
    if (phrase(s, ['all', 'every', 'सब', 'सारी', 'सारे', 'सभी', 'sab', 'saari', 'sabhi'])) { targets = lights.map(d => d.id); targetSource = 'explicit_all'; }
    else {
      const numbers = [...s.matchAll(/(?:^|\s)(?:light|lamp|लाइट|बत्ती)\s*(\d+)(?=\s|$)/gu)];
      if (numbers.length) { targets = [...new Set(numbers.map(n => 'light-' + Number(n[1])))]; if (!targets.every(id => lights.some(d => d.id === id))) return reject('unknown_target'); }
      else {
        const named = lights.filter(d => phrase(s, [normalize(d.name)]));
        const matchedRooms = rooms.filter(r => phrase(s, [normalize(r.name), ...(/^room-([12])$/.test(r.id) ? ['room ' + r.id.slice(-1), 'room' + r.id.slice(-1), 'कमरा ' + r.id.slice(-1), 'कमरा' + r.id.slice(-1), 'रूम ' + r.id.slice(-1), 'kamra ' + r.id.slice(-1)] : [])]) || aliases.some(a => a.confirmed && a.room_id === r.id && phrase(s, [normalize(a.alias)])));
        if (named.length === 1) targets = [named[0].id];
        else if (matchedRooms.length === 1) { targets = lights.filter(d => d.room_id === matchedRooms[0].id).map(d => d.id); targetSource = 'explicit_room'; }
        else return reject('ambiguous', lights.map(d => d.name));
      }
    }
  }
  if (!action || !targets.length) return reject('ambiguous', devices.filter(d => d.type === 'light').map(d => d.name));
  if (!targets.every(id => devices.some(d => d.id === id))) return reject('unknown_target');
  // Consume complete target phrases, then permit only the supported grammar.
  // Any leftover qualifier or partially parsed target must fail closed.
  let rest = ' ' + s + ' ';
  const consume = value => { const token = ' ' + normalize(value) + ' '; while (rest.includes(token)) rest = rest.replace(token, ' '); };
  const numeric = [...s.matchAll(/(?:light|lamp|लाइट|बत्ती)\s*(\d+)/gu)];
  if (numeric.length && phrase(s, ['all','every','सब','सारी','सारे','सभी','sab','saari','sabhi'])) return reject('unsupported');
  const roomMatches = rooms.filter(r => phrase(s, [normalize(r.name), 'room ' + r.id.slice(-1), 'कमरा ' + r.id.slice(-1), 'kamra ' + r.id.slice(-1)]));
  if (numeric.length && roomMatches.length) return reject('unsupported');
  for (const d of devices.filter(d => targets.includes(d.id))) { consume(d.name); if (d.id === 'light-4') for (const word of ['fan','पंखा','pankha']) consume(word); else if (d.type === 'light') for (const word of ['light','lamp','लाइट','बत्ती']) consume(word + ' ' + d.id.slice(-1)); }
  for (const r of rooms.filter(r => targets.some(id => devices.find(d => d.id === id)?.room_id === r.id))) {
    consume(r.name); if (/^room-[12]$/.test(r.id)) for (const word of ['room','कमरा','रूम','kamra']) { consume(word + ' ' + r.id.slice(-1)); consume(word + r.id.slice(-1)); }
    for (const a of aliases.filter(a => a.confirmed && a.room_id === r.id)) consume(a.alias);
  }
  const grammar = new Set('turn switch set the a please light lights lamp lamps on off all every and status check if what is are sensor gas motion movement home house door gate front lock close secure unlock open room की का करो कर दो है क्या स्थिति चालू ऑन जलाओ जला बंद बुझाओ बुझा ऑफ दरवाजा दरवाज़ा गेट खोलो खोल अनलॉक लॉक ताला गैस मोशन हलचल घर सभी सब सारी सारे light band bandh chalu jala jalao bujhao karo kar ka ki ko hai kya haal darwaza darwaja kholo khol tala sab saari sabhi ghar'.split(' '));
  for (const word of ['लाइट','बत्ती','कमरा','रूम','kamra']) grammar.add(word);
  for (const word of ['my', 'मेरी', 'मेरे', 'को', 'दीजिए']) grammar.add(word);
  if (targetSource === 'explicit_room') for (const word of ['in', 'में']) grammar.add(word);
  if (action === 'query') for (const word of ['of', 'locked', 'unlocked', 'closed', 'detected', 'normal', 'alert', 'reading', 'readings', 'level', 'value', 'रीडिंग', 'स्तर']) grammar.add(word);
  if (rest.trim().split(/\s+/).some(word => !grammar.has(word))) return reject('unsupported');
  return { ok: true, intent: { kind: action === 'query' ? 'query' : 'control', action, device_ids: targets, devices: targets, sensitive: action === 'unlock', target_source: targetSource, language: /[\u0900-\u097F]/u.test(input) ? /[a-z]/i.test(input) ? 'mixed' : 'hi' : 'en' } };
}
module.exports = { normalize, detectWakeWord, resolveCommand };
