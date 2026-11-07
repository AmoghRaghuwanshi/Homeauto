/*
 * ═══════════════════════════════════════════════════════════
 *  Voice WebSocket Handler
 *  Receives audio streams from clients, runs Vosk,
 *  detects wake word, parses commands, executes via MQTT
 * ═══════════════════════════════════════════════════════════
 */
const voiceEngine = require('./voiceEngine');
const { detectWakeWord, parseCommand } = require('./commandParser');
const db = require('../db/database');
const mqttClient = require('../mqtt/mqttClient');

let broadcastFn = null;

function setup(wss, broadcast) {
  broadcastFn = broadcast;

  wss.on('connection', (ws) => {
    console.log('[Voice] Client connected');

    if (!voiceEngine.isReady()) {
      ws.send(JSON.stringify({
        type: 'voice_error',
        error: 'Speech models not loaded. Run: node server/voice/download-models.js',
      }));
      ws.close();
      return;
    }

    // Create recogniser pair for this client
    const recognisers = voiceEngine.createRecognisers();
    let isActive = true;

    ws.on('message', (data) => {
      if (!isActive) return;

      // Binary = audio data
      if (Buffer.isBuffer(data)) {
        const results = voiceEngine.processAudio(recognisers, data);

        // Send partial transcription for live display
        if (results.partials.length > 0) {
          const bestPartial = voiceEngine.getBestPartial(results.partials);
          ws.send(JSON.stringify({ type: 'partial', text: bestPartial }));
        }

        // Process final results for wake word + command
        for (const final of results.finals) {
          console.log(`[Voice] Final (${final.lang}): "${final.text}"`);

          ws.send(JSON.stringify({ type: 'transcript', text: final.text, lang: final.lang }));

          // Check for wake word
          const wakeResult = detectWakeWord(final.text);
          if (wakeResult.found) {
            console.log(`[Voice] 🎙️ Wake word detected! Command: "${wakeResult.command}"`);

            ws.send(JSON.stringify({ type: 'wake_word', command: wakeResult.command }));

            // Parse the command
            const parsed = parseCommand(wakeResult.command);
            if (parsed) {
              executeCommand(parsed, final.text, ws);
            } else {
              ws.send(JSON.stringify({
                type: 'voice_result',
                success: false,
                transcript: final.text,
                error: 'Could not understand the command',
              }));
            }
          }
        }
      }

      // JSON = control messages
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'reset') {
            // Reset recognisers (clear buffer)
            voiceEngine.freeRecognisers(recognisers);
            const newRecs = voiceEngine.createRecognisers();
            Object.assign(recognisers, newRecs);
          }
        } catch (e) { /* ignore */ }
      }
    });

    ws.on('close', () => {
      console.log('[Voice] Client disconnected');
      isActive = false;
      voiceEngine.freeRecognisers(recognisers);
    });

    ws.on('error', (err) => {
      console.error('[Voice] WS error:', err.message);
      isActive = false;
      voiceEngine.freeRecognisers(recognisers);
    });

    // Send ready signal
    ws.send(JSON.stringify({ type: 'voice_ready' }));
  });
}

// ─── Execute parsed command ───────────────────────────────
function executeCommand(parsed, transcript, ws) {
  console.log('[Voice] Executing:', JSON.stringify(parsed));

  if (parsed.action === 'query') {
    // Handle sensor queries
    handleQuery(parsed, transcript, ws);
    return;
  }

  // ─── Check if target ESP32 board is online ────────────────
  const config = require('../config/config');
  const espStatus = mqttClient.getEspStatus();
  const offlineBoards = [];

  for (const deviceId of parsed.devices) {
    for (const [boardId, board] of Object.entries(config.ESP_BOARDS || {})) {
      if (board.devices.includes(deviceId) && espStatus[boardId] && !espStatus[boardId].online) {
        if (!offlineBoards.includes(espStatus[boardId].name)) {
          offlineBoards.push(espStatus[boardId].name);
        }
      }
    }
  }

  if (offlineBoards.length > 0) {
    const boardNames = offlineBoards.join(' and ');
    const response = {
      type: 'voice_result',
      success: false,
      transcript,
      error: `${boardNames} is offline. Cannot execute command.`,
    };
    console.log(`[Voice] ❌ Blocked — ${boardNames} is offline`);
    ws.send(JSON.stringify(response));
    if (broadcastFn) broadcastFn(response);
    return;
  }

  let successCount = 0;
  const deviceNames = [];

  for (const deviceId of parsed.devices) {
    const device = db.getDevice(deviceId);
    if (!device) continue;

    // Build MQTT topic
    const idNum = deviceId.replace(/^(light|door|sensor)-/, '');
    let topic;
    if (device.type === 'light') {
      topic = `home/light/${idNum}/command`;
    } else if (device.type === 'door') {
      topic = `home/door/${idNum}/command`;
    } else {
      topic = `home/sensor/${idNum}/command`;
    }

    // Resolve action
    let action = parsed.action;
    if (action === 'toggle') {
      if (device.type === 'light') action = device.status === 'on' ? 'off' : 'on';
      else if (device.type === 'door') action = device.status === 'locked' ? 'unlock' : 'lock';
    }

    // Publish MQTT command
    const published = mqttClient.publishCommand(topic, action);
    if (published) {
      // Optimistically update DB
      let newStatus = action;
      if (action === 'lock') newStatus = 'locked';
      if (action === 'unlock') newStatus = 'unlocked';
      db.updateDeviceStatus(deviceId, newStatus);
      db.addLogEntry(deviceId, 'voice_command', { action, transcript });

      successCount++;
      deviceNames.push(device.name);

      // Broadcast device update
      if (broadcastFn) {
        broadcastFn({ type: 'device_update', data: db.getDevice(deviceId) });
        broadcastFn({
          type: 'log',
          data: {
            device_id: deviceId,
            event_type: 'voice_command',
            details: JSON.stringify({ action, transcript }),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  }

  // Build response
  const response = {
    type: 'voice_result',
    success: successCount > 0,
    transcript,
    action: parsed.action,
    devices: deviceNames,
    message: successCount > 0
      ? `${deviceNames.join(', ')} → ${parsed.action}`
      : 'No devices responded',
  };

  ws.send(JSON.stringify(response));

  // Also broadcast so notifications.js picks it up on all clients
  if (broadcastFn) {
    broadcastFn(response);
  }
}

// ─── Handle sensor queries ────────────────────────────────
function handleQuery(parsed, transcript, ws) {
  const device = db.getDevice(parsed.devices[0]);
  if (!device) {
    ws.send(JSON.stringify({
      type: 'voice_result',
      success: false,
      transcript,
      error: 'Sensor not found',
    }));
    return;
  }

  ws.send(JSON.stringify({
    type: 'voice_result',
    success: true,
    transcript,
    action: 'query',
    devices: [device.name],
    message: `${device.name} status: ${device.status}`,
  }));
}

module.exports = { setup };
