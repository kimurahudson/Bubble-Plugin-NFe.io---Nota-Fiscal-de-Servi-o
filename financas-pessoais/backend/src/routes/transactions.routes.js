const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

function toCents(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

function serialize(row) {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    value: row.value_cents / 100,
    type: row.type,
    installment: row.installment,
    installmentTotal: row.installment_total,
    categoryId: row.category_id,
    bankId: row.bank_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validatePayload(body, isPartial) {
  const errors = [];
  if (!isPartial || body.date !== undefined) {
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
      errors.push('Data inválida (use AAAA-MM-DD)');
  }
  if (!isPartial || body.value !== undefined) {
    if (body.value === undefined || body.value === null || Number.isNaN(Number(body.value)))
      errors.push('Valor inválido');
  }
  if (!isPartial || body.type !== undefined) {
    if (!['receita', 'despesa'].includes(body.type)) errors.push('Tipo deve ser receita ou despesa');
  }
  return errors;
}

// GET /api/transactions?month=2026-09&categoryId=&bankId=&type=
router.get('/', (req, res) => {
  const { month, categoryId, bankId, type } = req.query;
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [req.userId];

  if (month) {
    sql += " AND strftime('%Y-%m', date) = ?";
    params.push(month);
  }
  if (categoryId) {
    sql += ' AND category_id = ?';
    params.push(categoryId);
  }
  if (bankId) {
    sql += ' AND bank_id = ?';
    params.push(bankId);
  }
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY date DESC, id DESC';

  const rows = db.prepare(sql).all(...params);
  res.json({ transactions: rows.map(serialize) });
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = validatePayload(body, false);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const cents = toCents(body.value);
  const installment = Number.isInteger(body.installment) ? body.installment : 1;
  const installmentTotal = Number.isInteger(body.installmentTotal) ? body.installmentTotal : 1;

  const info = db
    .prepare(
      `INSERT INTO transactions
        (user_id, date, description, value_cents, type, installment, installment_total, category_id, bank_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.userId,
      body.date,
      (body.description || '').trim(),
      cents,
      body.type,
      installment,
      installmentTotal,
      body.categoryId || null,
      body.bankId || null
    );

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ transaction: serialize(row) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado' });

  const body = req.body || {};
  const errors = validatePayload(body, true);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const merged = {
    date: body.date !== undefined ? body.date : existing.date,
    description: body.description !== undefined ? body.description.trim() : existing.description,
    value_cents: body.value !== undefined ? toCents(body.value) : existing.value_cents,
    type: body.type !== undefined ? body.type : existing.type,
    installment: body.installment !== undefined ? body.installment : existing.installment,
    installment_total:
      body.installmentTotal !== undefined ? body.installmentTotal : existing.installment_total,
    category_id: body.categoryId !== undefined ? body.categoryId : existing.category_id,
    bank_id: body.bankId !== undefined ? body.bankId : existing.bank_id,
  };

  db.prepare(
    `UPDATE transactions SET date=?, description=?, value_cents=?, type=?, installment=?,
     installment_total=?, category_id=?, bank_id=?, updated_at=datetime('now')
     WHERE id=? AND user_id=?`
  ).run(
    merged.date,
    merged.description,
    merged.value_cents,
    merged.type,
    merged.installment,
    merged.installment_total,
    merged.category_id,
    merged.bank_id,
    id,
    req.userId
  );

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  res.json({ transaction: serialize(row) });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db
    .prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado' });

  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(id, req.userId);
  res.status(204).end();
});

// POST /api/transactions/bulk  { transactions: [...] }  -- usado pela importação de CSV
router.post('/bulk', (req, res) => {
  const list = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
  if (!list.length) return res.status(400).json({ error: 'Nenhum lançamento enviado' });

  const insert = db.prepare(
    `INSERT INTO transactions
      (user_id, date, description, value_cents, type, installment, installment_total, category_id, bank_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const results = [];
  const insertMany = db.transaction((items) => {
    for (const item of items) {
      const errs = validatePayload(item, false);
      if (errs.length) throw new Error(errs.join('; '));
      const cents = toCents(item.value);
      const info = insert.run(
        req.userId,
        item.date,
        (item.description || '').trim(),
        cents,
        item.type,
        Number.isInteger(item.installment) ? item.installment : 1,
        Number.isInteger(item.installmentTotal) ? item.installmentTotal : 1,
        item.categoryId || null,
        item.bankId || null
      );
      results.push(info.lastInsertRowid);
    }
  });

  try {
    insertMany(list);
  } catch (err) {
    return res.status(400).json({ error: 'Erro ao importar: ' + err.message });
  }

  const rows = db
    .prepare(`SELECT * FROM transactions WHERE id IN (${results.map(() => '?').join(',')})`)
    .all(...results);
  res.status(201).json({ transactions: rows.map(serialize), count: rows.length });
});

module.exports = router;
