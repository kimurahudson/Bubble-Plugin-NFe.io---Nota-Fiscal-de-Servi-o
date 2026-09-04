const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY type, name')
    .all(req.userId);
  res.json({ categories: rows });
});

router.post('/', (req, res) => {
  const { name, type, color } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome da categoria' });
  if (!['receita', 'despesa'].includes(type))
    return res.status(400).json({ error: 'Tipo deve ser receita ou despesa' });

  try {
    const info = db
      .prepare('INSERT INTO categories (user_id, name, type, color) VALUES (?, ?, ?, ?)')
      .run(req.userId, name.trim(), type, color || '#323e48');
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ category: row });
  } catch (err) {
    if (String(err.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Já existe uma categoria com este nome e tipo' });
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

  const { name, type, color } = req.body || {};
  const newName = name && name.trim() ? name.trim() : existing.name;
  const newType = ['receita', 'despesa'].includes(type) ? type : existing.type;
  const newColor = color || existing.color;

  try {
    db.prepare('UPDATE categories SET name = ?, type = ?, color = ? WHERE id = ? AND user_id = ?').run(
      newName,
      newType,
      newColor,
      id,
      req.userId
    );
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json({ category: row });
  } catch (err) {
    if (String(err.message).includes('UNIQUE'))
      return res.status(409).json({ error: 'Já existe uma categoria com este nome e tipo' });
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Categoria não encontrada' });

  db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, req.userId);
  res.status(204).end();
});

module.exports = router;
