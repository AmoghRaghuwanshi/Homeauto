const express = require('express');
const router = express.Router();
const db = require('../db/database');
const mqttClient = require('../mqtt/mqttClient');

// POST /api/devices/:id/command — send a command to a device
router.post('/:id/command', (req, res) => {
  try {
    const { action } = req.body;
    const deviceId = req.params.id;

    if (!action) {
      return res.status(400).json({ error: 'action is required (e.g., "on", "off", "toggle", "lock", "unlock")' });
    }

    const device = db.getDevice(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check if the ESP32 board for this device is online
    const config = require('../config/config');
    const espStatus = mqttClient.getEspStatus();
    for (const [boardId, board] of Object.entries(config.ESP_BOARDS || {})) {
      if (board.devices.includes(deviceId) && espStatus[boardId] && !espStatus[boardId].online) {
        return res.status(503).json({
          error: `${espStatus[boardId].name} is offline. Cannot send command.`,
          board: boardId,
          boardName: espStatus[boardId].name,
        });
      }
    }

    // Build the MQTT topic based on device type
    let topic;
    const idNum = deviceId.replace(/^(light|door|sensor)-/, '');

    if (device.type === 'light') {
      topic = `home/light/${idNum}/command`;
    } else if (device.type === 'door') {
      topic = `home/door/${idNum}/command`;
    } else {
      topic = `home/sensor/${idNum}/command`;
    }

    // Handle toggle: resolve to the actual action
    let resolvedAction = action;
    if (action === 'toggle') {
      if (device.type === 'light') {
        resolvedAction = device.status === 'on' ? 'off' : 'on';
      } else if (device.type === 'door') {
        resolvedAction = device.status === 'locked' ? 'unlock' : 'lock';
      }
    }

    // Publish the command via MQTT
    const published = mqttClient.publishCommand(topic, resolvedAction);

    if (!published) {
      return res.status(503).json({ error: 'MQTT broker not connected' });
    }

    // Optimistically update the device status in the database
    let newStatus = resolvedAction;
    if (resolvedAction === 'on' || resolvedAction === 'off') {
      newStatus = resolvedAction;
    } else if (resolvedAction === 'lock') {
      newStatus = 'locked';
    } else if (resolvedAction === 'unlock') {
      newStatus = 'unlocked';
    }

    db.updateDeviceStatus(deviceId, newStatus);

    // Log the command
    db.addLogEntry(deviceId, 'command', { action: resolvedAction, topic });

    // Return updated device
    const updatedDevice = db.getDevice(deviceId);

    // Broadcast to all WebSocket clients so every screen updates instantly
    const broadcast = req.app.get('broadcast');
    if (broadcast) {
      broadcast({ type: 'device_update', data: updatedDevice });
      broadcast({
        type: 'log',
        data: {
          device_id: deviceId,
          event_type: 'command',
          details: JSON.stringify({ action: resolvedAction }),
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({ success: true, device: updatedDevice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
