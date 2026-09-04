const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome' });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Já existe uma conta com este e-mail' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name.trim(), email.toLowerCase(), passwordHash);

  const user = { id: info.lastInsertRowid, name: name.trim(), email: email.toLowerCase() };

  const defaultCategories = [
    ['Salário', 'receita'],
    ['Outras receitas', 'receita'],
    ['Alimentação', 'despesa'],
    ['Moradia', 'despesa'],
    ['Transporte', 'despesa'],
    ['Saúde', 'despesa'],
    ['Lazer', 'despesa'],
    ['Outras despesas', 'despesa'],
  ];
  const insertCat = db.prepare(
    'INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)'
  );
  const insertMany = db.transaction((cats) => {
    for (const [name2, type] of cats) insertCat.run(user.id, name2, type);
  });
  insertMany(defaultCategories);

  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row) return res.status(401).json({ error: 'E-mail ou senha inválidos' });

  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha inválidos' });

  const user = { id: row.id, name: row.name, email: row.email };
  const token = signToken(user);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.userId);
  if (!row) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ user: row });
});

module.exports = router;
