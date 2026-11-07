const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/devices — list all devices
router.get('/', (req, res) => {
  try {
    const devices = db.getDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices/:id — get a single device
router.get('/:id', (req, res) => {
  try {
    const device = db.getDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices — register a new device
router.post('/', (req, res) => {
  try {
    const { id, name, type, location, status } = req.body;
    if (!id || !name || !type) {
      return res.status(400).json({ error: 'id, name, and type are required' });
    }
    const result = db.addDevice(id, name, type, location || '', status || 'off');
    if (!result.success) {
      return res.status(409).json({ error: result.error });
    }
    const device = db.getDevice(id);
    res.status(201).json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/devices/:id — update device metadata
router.put('/:id', (req, res) => {
  try {
    const { name, type, location } = req.body;
    const existing = db.getDevice(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }
    db.updateDevice(
      req.params.id,
      name || existing.name,
      type || existing.type,
      location !== undefined ? location : existing.location
    );
    const device = db.getDevice(req.params.id);
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/devices/:id — remove a device
router.delete('/:id', (req, res) => {
  try {
    const result = db.deleteDevice(req.params.id);
    if (!result.success) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
