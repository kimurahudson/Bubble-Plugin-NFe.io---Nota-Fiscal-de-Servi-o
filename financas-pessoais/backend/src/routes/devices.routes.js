const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { hashDeviceToken } = require('../devices');

const router = express.Router();
router.use(requireAuth);

function serialize(row, currentHash) {
  return {
    id: row.id,
    label: row.label,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    isCurrent: currentHash ? row.token_hash === currentHash : false,
  };
}

router.get('/', async (req, res) => {
  const deviceToken = req.headers['x-device-token'];
  const currentHash = deviceToken ? hashDeviceToken(deviceToken) : null;

  const rows = await db.all(
    "SELECT * FROM devices WHERE user_id = ? ORDER BY (status = 'pending') DESC, last_seen_at DESC",
    [req.userId]
  );
  res.json({ devices: rows.map((r) => serialize(r, currentHash)) });
});

router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const device = await db.get('SELECT * FROM devices WHERE id = ? AND user_id = ?', [
    id,
    req.userId,
  ]);
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado' });

  await db.run("UPDATE devices SET status = 'trusted' WHERE id = ?", [id]);
  const row = await db.get('SELECT * FROM devices WHERE id = ?', [id]);
  res.json({ device: serialize(row) });
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const device = await db.get('SELECT * FROM devices WHERE id = ? AND user_id = ?', [
    id,
    req.userId,
  ]);
  if (!device) return res.status(404).json({ error: 'Dispositivo não encontrado' });

  await db.run("UPDATE devices SET status = 'revoked' WHERE id = ?", [id]);
  res.status(204).end();
});

module.exports = router;
