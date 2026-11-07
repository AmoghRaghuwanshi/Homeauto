/*
 * ═══════════════════════════════════════════════════════════
 *  Bilingual Command Parser (English + Hindi)
 *  Parses natural-language voice commands into device actions
 * ═══════════════════════════════════════════════════════════
 */
const config = require('../config/config');

// ─── Wake Words ────────────────────────────────────────────
const WAKE_WORDS_EN = [
  'hey shrimaan', 'shrimaan ji', 'shrimaan',
  'hey shreeman', 'shreeman ji', 'shreeman',
  'hey shriman', 'shriman ji', 'shriman',
];

const WAKE_WORDS_HI = [
  'हे श्रीमान', 'श्रीमान जी', 'श्रीमान',
];

const ALL_WAKE_WORDS = [...WAKE_WORDS_EN, ...WAKE_WORDS_HI];

// ─── Action Keywords ───────────────────────────────────────
const ON_WORDS = [
  'on', 'turn on', 'switch on', 'enable', 'start', 'open',
  'चालू', 'ऑन', 'ओन', 'जला', 'जलाओ', 'खोल', 'खोलो',
  'chalu', 'jala', 'jalao', 'khol', 'kholo',
];

const OFF_WORDS = [
  'off', 'turn off', 'switch off', 'disable', 'stop', 'close',
  'बंद', 'ऑफ', 'बुझा', 'बुझाओ',
  'band', 'bandh', 'bujha', 'bujhao',
];

const LOCK_WORDS = [
  'lock', 'secure',
  'लॉक', 'बंद', 'ताला',
  'lock', 'tala', 'band',
];

const UNLOCK_WORDS = [
  'unlock', 'open',
  'अनलॉक', 'खोल', 'खोलो',
  'unlock', 'khol', 'kholo',
];

const ALL_WORDS = ['all', 'every', 'each', 'सब', 'सारी', 'सारे', 'सभी', 'sab', 'saari', 'saare', 'sabhi'];

const LIGHT_WORDS = ['light', 'lights', 'lamp', 'bulb', 'लाइट', 'लाइटें', 'बत्ती', 'बल्ब', 'batti'];
const DOOR_WORDS = ['door', 'gate', 'दरवाज़ा', 'दरवाजा', 'गेट', 'darwaza', 'darwaja', 'gate'];
const GAS_WORDS = ['gas', 'गैस', 'gas'];
const MOTION_WORDS = ['motion', 'movement', 'मोशन', 'हलचल', 'motion'];

// ─── Detect Wake Word ──────────────────────────────────────
function detectWakeWord(text) {
  const lower = text.toLowerCase().trim();
  // Sort by length descending so longer matches take priority
  const sorted = ALL_WAKE_WORDS.slice().sort((a, b) => b.length - a.length);
  for (const ww of sorted) {
    const idx = lower.indexOf(ww.toLowerCase());
    if (idx !== -1) {
      const after = lower.substring(idx + ww.length).trim();
      // Remove common filler words after wake word
      const command = after.replace(/^(please|karo|kar|करो|कर)\s*/i, '').trim();
      return { found: true, command };
    }
  }
  return { found: false, command: '' };
}

// ─── Parse Command ─────────────────────────────────────────
function parseCommand(text) {
  if (!text || text.trim().length < 2) return null;
  const lower = text.toLowerCase().trim();

  // Try to detect action + target
  let action = null;
  let targetType = null;
  let targetDevices = [];

  // --- Determine action ---
  if (matchesAny(lower, UNLOCK_WORDS)) {
    action = 'unlock';
  } else if (matchesAny(lower, LOCK_WORDS)) {
    action = 'lock';
  } else if (matchesAny(lower, ON_WORDS)) {
    action = 'on';
  } else if (matchesAny(lower, OFF_WORDS)) {
    action = 'off';
  }

  if (!action) {
    // Try pattern: "{target} {action_word} karo/करो"
    action = detectActionFromSuffix(lower);
  }

  if (!action) return null;

  // --- Determine target type ---
  if (matchesAny(lower, DOOR_WORDS)) {
    targetType = 'door';
  } else if (matchesAny(lower, LIGHT_WORDS)) {
    targetType = 'light';
  } else if (matchesAny(lower, GAS_WORDS)) {
    targetType = 'sensor';
    return { action: 'query', devices: ['sensor-gas'], type: 'sensor', response: 'gas_level' };
  } else if (matchesAny(lower, MOTION_WORDS)) {
    targetType = 'sensor';
    return { action: 'query', devices: ['sensor-motion'], type: 'sensor', response: 'motion_status' };
  }

  if (!targetType) {
    // Default to light if action is on/off, door if lock/unlock
    if (action === 'on' || action === 'off') targetType = 'light';
    else if (action === 'lock' || action === 'unlock') targetType = 'door';
  }

  // --- Determine specific devices ---
  if (targetType === 'door') {
    // We only have one door
    targetDevices = ['door-1'];
    // Normalize action for door
    if (action === 'on' || action === 'open') action = 'unlock';
    if (action === 'off' || action === 'close') action = 'lock';
  } else if (targetType === 'light') {
    // Check for "all"
    if (matchesAny(lower, ALL_WORDS)) {
      targetDevices = getAllLightIds();
    } else {
      // Check for specific light number
      const numMatch = lower.match(/(?:light|लाइट|बत्ती|lamp)\s*(\d+)/);
      if (numMatch) {
        targetDevices = [`light-${numMatch[1]}`];
      } else {
        // Check for room name
        const room = detectRoom(lower);
        if (room) {
          targetDevices = config.ROOMS[room] || [];
          targetDevices = targetDevices.filter(id => id.startsWith('light-'));
        } else {
          // Default: all lights
          targetDevices = getAllLightIds();
        }
      }
    }
  }

  if (targetDevices.length === 0) return null;

  return { action, devices: targetDevices, type: targetType };
}

// ─── Helper Functions ──────────────────────────────────────
function matchesAny(text, words) {
  return words.some(w => text.includes(w.toLowerCase()));
}

function detectActionFromSuffix(text) {
  // Hindi pattern: "light चालू करो" or "light on karo"
  if (/(?:चालू|ऑन|ओन|जला|chalu|jala)\s*(?:करो|कर|karo|kar)?/i.test(text)) return 'on';
  if (/(?:बंद|ऑफ|बुझा|band|bandh|bujha)\s*(?:करो|कर|karo|kar)?/i.test(text)) return 'off';
  if (/(?:खोल|अनलॉक|khol|kholo|unlock)\s*(?:करो|कर|कर दो|karo|kar)?/i.test(text)) return 'unlock';
  if (/(?:लॉक|ताला|lock|tala)\s*(?:करो|कर|लगाओ|karo|kar|lagao)?/i.test(text)) return 'lock';
  return null;
}

function detectRoom(text) {
  const rooms = config.ROOMS || {};
  // Also build Hindi/alias maps
  const roomAliases = config.ROOM_ALIASES || {};
  // Check aliases first (they might be Hindi names)
  for (const [alias, roomName] of Object.entries(roomAliases)) {
    if (text.includes(alias.toLowerCase())) {
      return roomName;
    }
  }
  // Check room names directly
  for (const roomName of Object.keys(rooms)) {
    if (text.includes(roomName.toLowerCase())) {
      return roomName;
    }
  }
  return null;
}

function getAllLightIds() {
  const rooms = config.ROOMS || {};
  const ids = new Set();
  for (const devices of Object.values(rooms)) {
    for (const id of devices) {
      if (id.startsWith('light-')) ids.add(id);
    }
  }
  // Fallback if no rooms configured
  if (ids.size === 0) {
    return ['light-1', 'light-2', 'light-3', 'light-4'];
  }
  return [...ids];
}

module.exports = { detectWakeWord, parseCommand, ALL_WAKE_WORDS };
