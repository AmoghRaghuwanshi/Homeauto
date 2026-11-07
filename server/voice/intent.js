const { fail } = require('../lib/errors');
function normalize(text) {
  const digits = { one: '1', two: '2', three: '3', four: '4', एक: '1', दो: '2', तीन: '3', चार: '4', ek: '1', do: '2' };
  return text.normalize('NFC').toLowerCase().replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x966)).replace(/[’']/g, ' ').replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/(room|light|lamp|कमरा|रूम|लाइट|बत्ती|kamra)\s+(one|two|three|four|एक|दो|तीन|चार|ek|do)(?=\s|$)/gu, (_, target, number) => target + ' ' + digits[number]);
}
const phrase = (s, words) => words.some(w => (' ' + s + ' ').includes(' ' + w + ' '));
function detectWakeWord(text) {
  const s = normalize(text);
  const match = s.match(/^(?:hey |हे )?(?:shrimaan|shreeman|shriman|श्रीमान)(?: ji| जी)?(?:\s+|$)/u);
  return { found: !!match, command: match ? s.slice(match[0].length).trim() : s };
}
function resolveCommand(input, devices, rooms, aliases = []) {
  if (typeof input !== 'string' || !input.trim() || input.length > 500) return { ok: false, reason: 'unsupported', choices: [] };
  const s = detectWakeWord(input).command;
  const reject = (reason, choices = []) => ({ ok: false, reason, choices });
  if (phrase(s, ['tomorrow','later','after','before','when','then','until','if','कल','बाद','जब','agar','baad','kal']) && !/^check if\s/.test(s)) return reject('unsupported');
  if (phrase(s, ['not', 'don t', 'dont', 'never', 'मत', 'नहीं', 'नही', 'mat', 'nahi', 'nahin'])) return reject('negated');
  if (phrase(s, ['except', 'excluding', 'unless', 'but', 'लेकिन', 'छोड़कर', 'ना'])) return reject('unsupported');
  if (phrase(s, ['camera', 'ac', 'fan', 'curtain', 'music', 'temperature', 'dim', 'brightness', 'कैमरा', 'पंखा', 'तापमान'])) return reject('unsupported');
  const query = phrase(s, ['status', 'check', 'what', 'is', 'are', 'स्थिति', 'क्या', 'kya', 'haal']);
  const door = phrase(s, ['door', 'gate', 'दरवाजा', 'दरवाज़ा', 'गेट', 'darwaza', 'darwaja']);
  const gas = phrase(s, ['gas', 'गैस']); const motion = phrase(s, ['motion', 'movement', 'मोशन', 'हलचल']);
  const homeQuery = query && phrase(s, ['home', 'house', 'घर', 'ghar']);
  const on = phrase(s, ['on', 'चालू', 'ऑन', 'जलाओ', 'जला', 'chalu', 'jala', 'jalao']);
  const off = phrase(s, ['off', 'बंद', 'बुझाओ', 'बुझा', 'ऑफ', 'band', 'bandh', 'bujhao']);
  const unlock = phrase(s, ['unlock', 'open', 'अनलॉक', 'खोलो', 'खोल', 'kholo', 'khol']);
  const lock = phrase(s, ['lock', 'close', 'secure', 'लॉक', 'ताला', 'tala']);
  if ([door, gas, motion].filter(Boolean).length > 1 || on && off || unlock && lock) return reject('conflicting');
  let action = null, targets = [], targetSource = 'explicit_device';
  if (homeQuery) { action = 'query'; targets = devices.map(d => d.id); targetSource = 'explicit_all'; }
  else if (gas || motion) { if (!query || on || off || lock || unlock) return reject('unsupported'); action = 'query'; targets = [gas ? 'sensor-gas' : 'sensor-motion']; }
  else if (door) { action = query ? 'query' : unlock ? 'unlock' : lock || off ? 'lock' : null; targets = ['door-1']; }
  else {
    if (unlock || lock) return reject('unsupported');
    action = query ? 'query' : on ? 'on' : off ? 'off' : null;
    const lights = devices.filter(d => d.type === 'light');
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
  for (const d of devices.filter(d => targets.includes(d.id))) { consume(d.name); if (d.type === 'light') for (const word of ['light','lamp','लाइट','बत्ती']) consume(word + ' ' + d.id.slice(-1)); }
  for (const r of rooms.filter(r => targets.some(id => devices.find(d => d.id === id)?.room_id === r.id))) {
    consume(r.name); if (/^room-[12]$/.test(r.id)) for (const word of ['room','कमरा','रूम','kamra']) { consume(word + ' ' + r.id.slice(-1)); consume(word + r.id.slice(-1)); }
    for (const a of aliases.filter(a => a.confirmed && a.room_id === r.id)) consume(a.alias);
  }
  const grammar = new Set('turn switch set the a please light lights lamp lamps on off all every and status check if what is are sensor gas motion movement home house door gate front lock close secure unlock open room की का करो कर दो है क्या स्थिति चालू ऑन जलाओ जला बंद बुझाओ बुझा ऑफ दरवाजा दरवाज़ा गेट खोलो खोल अनलॉक लॉक ताला गैस मोशन हलचल घर सभी सब सारी सारे light band bandh chalu jala jalao bujhao karo kar ka ki ko hai kya haal darwaza darwaja kholo khol tala sab saari sabhi ghar'.split(' '));
  for (const word of ['लाइट','बत्ती','कमरा','रूम','kamra']) grammar.add(word);
  if (rest.trim().split(/\s+/).some(word => !grammar.has(word))) return reject('unsupported');
  return { ok: true, intent: { kind: action === 'query' ? 'query' : 'control', action, device_ids: targets, devices: targets, sensitive: action === 'unlock', target_source: targetSource, language: /[\u0900-\u097F]/u.test(input) ? /[a-z]/i.test(input) ? 'mixed' : 'hi' : 'en' } };
}
module.exports = { normalize, detectWakeWord, resolveCommand };
