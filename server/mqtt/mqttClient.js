const mqtt = require('mqtt');
const config = require('../config/config');
const db = require('../db/database');

let client = null;
let wsBroadcast = null; // Will be set by server.js

// ─── ESP32 online/offline tracking ─────────────────────────
const espStatus = {};  // { boardId: { online: bool, lastSeen: Date, name: string } }
function initEspTracking() {
  for (const [boardId, board] of Object.entries(config.ESP_BOARDS || {})) {
    espStatus[boardId] = { online: false, lastSeen: null, name: board.name };
  }
}

function connect(broadcastFn) {
  wsBroadcast = broadcastFn;

  client = mqtt.connect(config.MQTT_BROKER, config.MQTT_OPTIONS);

  client.on('connect', () => {
    console.log('[MQTT] Connected to broker at', config.MQTT_BROKER);

    // Subscribe to all device status and RFID topics
    const subs = [
      config.TOPICS.SUB_LIGHT_STATUS,
      config.TOPICS.SUB_DOOR_STATUS,
      config.TOPICS.SUB_RFID_EVENT,
      config.TOPICS.SUB_SENSOR_DATA,
      config.TOPICS.SUB_ESP_ONLINE,
    ];
    client.subscribe(subs, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err);
      } else {
        console.log('[MQTT] Subscribed to:', subs.join(', '));
      }
    });

    // Broadcast MQTT connection status to frontend
    if (wsBroadcast) {
      wsBroadcast({ type: 'mqtt_status', data: { connected: true } });
    }
  });

  client.on('message', (topic, message) => {
    const payload = message.toString();
    console.log(`[MQTT] ${topic} → ${payload}`);

    // Parse topic: home/<type>/<id>/<action>
    const parts = topic.split('/');
    if (parts.length < 4) return;

    const deviceType = parts[1]; // 'light', 'door', 'sensor', or 'esp32'
    const deviceId = `${deviceType}-${parts[2]}`; // e.g. 'light-1'
    const action = parts[3]; // 'status', 'rfid', 'data', or 'online'

    // Handle ESP32 board online/offline messages
    if (deviceType === 'esp32' && action === 'online') {
      handleEspOnline(parts[2], payload);
      return;
    }

    // Any message from a device → mark its ESP32 board as alive
    touchEspBoard(deviceId);

    if (action === 'status') {
      handleStatusUpdate(deviceId, payload);
    } else if (action === 'rfid') {
      handleRfidEvent(deviceId, payload);
    } else if (action === 'data') {
      handleSensorData(deviceId, payload);
    }
  });

  // Start ESP32 timeout checker
  initEspTracking();
  setInterval(checkEspTimeouts, 15000);

  client.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  client.on('offline', () => {
    console.log('[MQTT] Client went offline');
    if (wsBroadcast) {
      wsBroadcast({ type: 'mqtt_status', data: { connected: false } });
    }
  });

  client.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  return client;
}

// ─── Handle device status updates ──────────────────────────────────
function handleStatusUpdate(deviceId, status) {
  // Update database
  const result = db.updateDeviceStatus(deviceId, status);

  // Log the event
  db.addLogEntry(deviceId, 'status_change', { status });

  // Get full device info for broadcast
  const device = db.getDevice(deviceId);

  // Broadcast to all connected WebSocket clients
  if (wsBroadcast) {
    wsBroadcast({
      type: 'device_update',
      data: device || { id: deviceId, status },
    });

    wsBroadcast({
      type: 'log',
      data: {
        device_id: deviceId,
        event_type: 'status_change',
        details: JSON.stringify({ status }),
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// ─── Handle RFID scan events ───────────────────────────────────────
function handleRfidEvent(deviceId, payload) {
  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    data = { uid: payload };
  }

  const uid = data.uid || 'unknown';
  console.log(`[RFID] Card scanned: ${uid} at device ${deviceId}`);

  // Check if the card is authorized
  const card = db.getRfidCard(uid);
  const isAuthorized = card && card.is_authorized === 1;

  // Log the RFID event
  db.addLogEntry(deviceId, 'rfid_scan', {
    uid,
    owner: card ? card.owner_name : 'Unknown',
    authorized: isAuthorized,
  });

  // Send unlock or deny command back to the door
  const doorIdNum = deviceId.replace('door-', '');
  const commandTopic = `home/door/${doorIdNum}/command`;

  if (isAuthorized) {
    console.log(`[RFID] Access GRANTED for ${card.owner_name} (${uid})`);
    publishCommand(commandTopic, 'unlock');
    db.updateDeviceStatus(deviceId, 'unlocked');
  } else {
    console.log(`[RFID] Access DENIED for uid ${uid}`);
    publishCommand(commandTopic, 'deny');
  }

  // Broadcast to frontend
  if (wsBroadcast) {
    wsBroadcast({
      type: 'rfid_event',
      data: {
        device_id: deviceId,
        uid,
        owner: card ? card.owner_name : 'Unknown',
        authorized: isAuthorized,
        timestamp: new Date().toISOString(),
      },
    });

    wsBroadcast({
      type: 'device_update',
      data: db.getDevice(deviceId),
    });

    wsBroadcast({
      type: 'log',
      data: {
        device_id: deviceId,
        event_type: 'rfid_scan',
        details: JSON.stringify({
          uid,
          owner: card ? card.owner_name : 'Unknown',
          authorized: isAuthorized,
        }),
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// ─── Handle sensor data (gas, motion) ──────────────────────────────
function handleSensorData(deviceId, payload) {
  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    data = { raw: payload };
  }

  console.log(`[Sensor] ${deviceId} data:`, data);

  // Determine status string for the device
  let status = 'normal';
  if (data.gas_ppm !== undefined) {
    // Gas sensor
    status = data.alert ? 'alert' : 'normal';
  } else if (data.motion !== undefined) {
    // Motion sensor
    status = data.motion ? 'detected' : 'clear';
  }

  // Update device status in DB
  db.updateDeviceStatus(deviceId, status);

  // Log sensor reading
  db.addLogEntry(deviceId, 'sensor_data', data);

  // Broadcast to frontend
  if (wsBroadcast) {
    wsBroadcast({
      type: 'device_update',
      data: db.getDevice(deviceId),
    });

    // Send the raw sensor data for live display
    wsBroadcast({
      type: 'sensor_data',
      data: { device_id: deviceId, ...data, timestamp: new Date().toISOString() },
    });

    // If gas alert, send a special alert message
    if (data.alert) {
      wsBroadcast({
        type: 'alert',
        data: {
          device_id: deviceId,
          level: 'danger',
          message: `⚠️ Gas level critical: ${data.gas_ppm} PPM!`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // If motion detected, send alert
    if (data.motion) {
      wsBroadcast({
        type: 'alert',
        data: {
          device_id: deviceId,
          level: 'warning',
          message: `🚶 Motion detected!`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    wsBroadcast({
      type: 'log',
      data: {
        device_id: deviceId,
        event_type: 'sensor_data',
        details: JSON.stringify(data),
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// ─── Publish a command to a device ─────────────────────────────────
function publishCommand(topic, payload) {
  if (!client || !client.connected) {
    console.error('[MQTT] Cannot publish — not connected');
    return false;
  }
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, payloadStr, { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] Publish error:', err);
    } else {
      console.log(`[MQTT] Published: ${topic} → ${payloadStr}`);
    }
  });
  return true;
}

// ─── ESP32 board online/offline handling ───────────────────
function handleEspOnline(boardId, payload) {
  const isOnline = payload.toLowerCase() === 'true' || payload === '1';
  if (!espStatus[boardId]) {
    espStatus[boardId] = { online: false, lastSeen: null, name: boardId };
  }

  const prev = espStatus[boardId].online;
  espStatus[boardId].online = isOnline;
  espStatus[boardId].lastSeen = new Date();

  if (prev !== isOnline) {
    const label = espStatus[boardId].name || boardId;
    console.log(`[ESP32] ${label}: ${isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
    broadcastEspStatus();
  }
}

// Mark the ESP32 board that owns this device as alive
function touchEspBoard(deviceId) {
  for (const [boardId, board] of Object.entries(config.ESP_BOARDS || {})) {
    if (board.devices.includes(deviceId)) {
      if (!espStatus[boardId]) {
        espStatus[boardId] = { online: false, lastSeen: null, name: board.name };
      }
      const wasOffline = !espStatus[boardId].online;
      espStatus[boardId].online = true;
      espStatus[boardId].lastSeen = new Date();
      if (wasOffline) {
        console.log(`[ESP32] ${board.name}: 🟢 ONLINE (heartbeat)`);
        broadcastEspStatus();
      }
      break;
    }
  }
}

// Periodic check: mark boards offline if no message received within timeout
function checkEspTimeouts() {
  const timeout = config.ESP_TIMEOUT || 60000;
  const now = Date.now();
  for (const [boardId, status] of Object.entries(espStatus)) {
    if (status.online && status.lastSeen) {
      const elapsed = now - status.lastSeen.getTime();
      if (elapsed > timeout) {
        status.online = false;
        console.log(`[ESP32] ${status.name}: 🔴 OFFLINE (timeout: ${(elapsed/1000).toFixed(0)}s)`);
        broadcastEspStatus();
      }
    }
  }
}

// Broadcast ESP32 status to all WebSocket clients
function broadcastEspStatus() {
  if (!wsBroadcast) return;
  const boards = {};
  for (const [boardId, status] of Object.entries(espStatus)) {
    boards[boardId] = {
      name: status.name,
      online: status.online,
      lastSeen: status.lastSeen ? status.lastSeen.toISOString() : null,
    };
  }
  wsBroadcast({ type: 'esp_status', data: boards });
}

function getEspStatus() {
  const boards = {};
  for (const [boardId, status] of Object.entries(espStatus)) {
    boards[boardId] = {
      name: status.name,
      online: status.online,
      lastSeen: status.lastSeen ? status.lastSeen.toISOString() : null,
    };
  }
  return boards;
}

module.exports = {
  connect,
  publishCommand,
  getEspStatus,
};
