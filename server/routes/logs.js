const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/logs — get recent activity logs
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type;

    let logs;
    if (type) {
      logs = db.getLogsByType(type, limit);
    } else {
      logs = db.getRecentLogs(limit);
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rfid-cards — list all RFID cards
router.get('/rfid-cards', (req, res) => {
  try {
    const cards = db.getRfidCards();
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rfid-cards — register a new RFID card
router.post('/rfid-cards', (req, res) => {
  try {
    const { uid, owner_name, is_authorized } = req.body;
    if (!uid || !owner_name) {
      return res.status(400).json({ error: 'uid and owner_name are required' });
    }
    const result = db.addRfidCard(uid, owner_name, is_authorized !== false);
    if (!result.success) {
      return res.status(409).json({ error: result.error });
    }

    // Log the action
    db.addLogEntry(null, 'rfid_card_added', { uid, owner_name });

    const card = db.getRfidCard(uid);
    res.status(201).json(card);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rfid-cards/:uid — revoke an RFID card
router.delete('/rfid-cards/:uid', (req, res) => {
  try {
    const card = db.getRfidCard(req.params.uid);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    db.deleteRfidCard(req.params.uid);

    // Log the action
    db.addLogEntry(null, 'rfid_card_removed', { uid: req.params.uid, owner_name: card.owner_name });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
