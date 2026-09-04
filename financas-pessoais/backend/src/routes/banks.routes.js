const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM banks WHERE user_id = ? ORDER BY name').all(req.userId);
  res.json({ banks: rows });
});

router.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome do banco' });

  try {
    const info = db
      .prepare('INSERT INTO banks (user_id, name) VALUES (?, ?)')
      .run(req.userId, name.trim());
    const row = db.prepare('SELECT * FROM banks WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ bank: row });
  } catch (err) {
    if (String(err.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Já existe um banco com este nome' });
    res.status(500).json({ error: 'Erro ao criar banco' });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM banks WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Banco não encontrado' });

  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome do banco' });

  try {
    db.prepare('UPDATE banks SET name = ? WHERE id = ? AND user_id = ?').run(name.trim(), id, req.userId);
    const row = db.prepare('SELECT * FROM banks WHERE id = ?').get(id);
    res.json({ bank: row });
  } catch (err) {
    if (String(err.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Já existe um banco com este nome' });
    res.status(500).json({ error: 'Erro ao atualizar banco' });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM banks WHERE id = ? AND user_id = ?').get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Banco não encontrado' });

  db.prepare('DELETE FROM banks WHERE id = ? AND user_id = ?').run(id, req.userId);
  res.status(204).end();
});

module.exports = router;
