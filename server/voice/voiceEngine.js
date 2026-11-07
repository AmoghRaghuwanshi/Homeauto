/*
 * ═══════════════════════════════════════════════════════════
 *  Vosk Voice Engine — Offline Speech Recognition
 *  Loads English + Hindi models, manages per-client recognisers
 * ═══════════════════════════════════════════════════════════
 */
const path = require('path');
const fs = require('fs');

let vosk = null;
let enModel = null;
let hiModel = null;
let modelsReady = false;

const MODELS_DIR = path.join(__dirname, 'models');

// ─── Initialise Vosk and load models ──────────────────────
function init() {
  try {
    vosk = require('vosk');
    vosk.setLogLevel(-1); // Suppress Vosk logs
  } catch (err) {
    console.error('[Voice] ❌ vosk package not installed. Run: npm install vosk');
    return false;
  }

  const enPath = path.join(MODELS_DIR, 'en');
  const hiPath = path.join(MODELS_DIR, 'hi');

  // Check if models exist
  const enExists = fs.existsSync(enPath) && fs.readdirSync(enPath).length > 0;
  const hiExists = fs.existsSync(hiPath) && fs.readdirSync(hiPath).length > 0;

  if (!enExists && !hiExists) {
    console.error('[Voice] ❌ No speech models found. Run: node server/voice/download-models.js');
    return false;
  }

  try {
    if (enExists) {
      enModel = new vosk.Model(enPath);
      console.log('[Voice] ✅ English model loaded');
    }
    if (hiExists) {
      hiModel = new vosk.Model(hiPath);
      console.log('[Voice] ✅ Hindi model loaded');
    }
    modelsReady = true;
    return true;
  } catch (err) {
    console.error('[Voice] ❌ Failed to load models:', err.message);
    return false;
  }
}

// ─── Create recogniser pair for a client ──────────────────
function createRecognisers() {
  const recs = {};
  if (enModel) {
    recs.en = new vosk.Recognizer({ model: enModel, sampleRate: 16000 });
  }
  if (hiModel) {
    recs.hi = new vosk.Recognizer({ model: hiModel, sampleRate: 16000 });
  }
  return recs;
}

// ─── Feed audio to recognisers and get results ────────────
function processAudio(recognisers, audioBuffer) {
  const results = { partials: [], finals: [] };

  for (const [lang, rec] of Object.entries(recognisers)) {
    const isFinal = rec.acceptWaveform(audioBuffer);
    if (isFinal) {
      const result = rec.result();
      if (result && result.text && result.text.trim().length > 0) {
        results.finals.push({ lang, text: result.text.trim() });
      }
    } else {
      const partial = rec.partialResult();
      if (partial && partial.partial && partial.partial.trim().length > 0) {
        results.partials.push({ lang, text: partial.partial.trim() });
      }
    }
  }

  return results;
}

// ─── Free recognisers ─────────────────────────────────────
function freeRecognisers(recognisers) {
  for (const rec of Object.values(recognisers)) {
    try { rec.free(); } catch (e) { /* ignore */ }
  }
}

// ─── Get best partial text from both languages ────────────
function getBestPartial(partials) {
  if (partials.length === 0) return '';
  // Pick the longer text (more likely to be correct)
  return partials.reduce((best, p) => p.text.length > best.text.length ? p : best, partials[0]).text;
}

function isReady() {
  return modelsReady;
}

module.exports = { init, createRecognisers, processAudio, freeRecognisers, getBestPartial, isReady };
