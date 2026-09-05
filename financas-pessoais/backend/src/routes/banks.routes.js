const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const rows = await db.all('SELECT * FROM banks WHERE user_id = ? ORDER BY name', [req.userId]);
  res.json({ banks: rows });
});

router.post('/', async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome do banco' });

  try {
    const info = await db.run('INSERT INTO banks (user_id, name) VALUES (?, ?)', [
      req.userId,
      name.trim(),
    ]);
    const row = await db.get('SELECT * FROM banks WHERE id = ?', [info.lastInsertRowid]);
    res.status(201).json({ bank: row });
  } catch (err) {
    if (String(err.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Já existe um banco com este nome' });
    res.status(500).json({ error: 'Erro ao criar banco' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await db.get('SELECT * FROM banks WHERE id = ? AND user_id = ?', [
    id,
    req.userId,
  ]);
  if (!existing) return res.status(404).json({ error: 'Banco não encontrado' });

  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome do banco' });

  try {
    await db.run('UPDATE banks SET name = ? WHERE id = ? AND user_id = ?', [
      name.trim(),
      id,
      req.userId,
    ]);
    const row = await db.get('SELECT * FROM banks WHERE id = ?', [id]);
    res.json({ bank: row });
  } catch (err) {
    if (String(err.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Já existe um banco com este nome' });
    res.status(500).json({ error: 'Erro ao atualizar banco' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await db.get('SELECT * FROM banks WHERE id = ? AND user_id = ?', [
    id,
    req.userId,
  ]);
  if (!existing) return res.status(404).json({ error: 'Banco não encontrado' });

  await db.run('DELETE FROM banks WHERE id = ? AND user_id = ?', [id, req.userId]);
  res.status(204).end();
});

module.exports = router;
