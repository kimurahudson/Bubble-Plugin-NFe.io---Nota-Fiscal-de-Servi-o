const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../auth');
const { sendEmail } = require('../mailer');

const router = express.Router();

// URL do frontend publicado, usada para montar os links dos e-mails (confirmação
// de e-mail e redefinição de senha). Configure em produção; sem isso, assume
// localhost (só útil em desenvolvimento).
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createToken(userId, type, ttlMs) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.run(
    'INSERT INTO verification_tokens (user_id, type, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [userId, type, hashToken(token), expiresAt]
  );
  return token;
}

async function sendVerificationEmail(user) {
  const token = await createToken(user.id, 'email_verify', 24 * 60 * 60 * 1000);
  const link = `${FRONTEND_URL}/verificar-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Confirme seu e-mail — Finanças Pessoais',
    html: `
      <p>Olá, ${user.name}!</p>
      <p>Confirme seu e-mail no Finanças Pessoais clicando no link abaixo:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Este link expira em 24 horas. Se você não criou essa conta, pode ignorar este e-mail.</p>
    `,
  });
}

router.post('/resend-verification', requireAuth, async (req, res) => {
  const row = await db.get('SELECT id, name, email, email_verified FROM users WHERE id = ?', [
    req.userId,
  ]);
  if (row.email_verified) return res.status(400).json({ error: 'E-mail já confirmado' });
  await sendVerificationEmail(row);
  res.json({ sent: true });
});

router.post('/verify-email', async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Token ausente' });

  const row = await db.get(
    "SELECT * FROM verification_tokens WHERE token_hash = ? AND type = 'email_verify' AND used_at IS NULL",
    [hashToken(token)]
  );
  if (!row || new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'Link inválido ou expirado' });

  await db.run("UPDATE verification_tokens SET used_at = datetime('now') WHERE id = ?", [row.id]);
  await db.run('UPDATE users SET email_verified = 1 WHERE id = ?', [row.user_id]);
  res.json({ verified: true });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Informe o e-mail' });

  const user = await db.get('SELECT id, name, email FROM users WHERE email = ?', [
    email.toLowerCase(),
  ]);
  if (user) {
    const token = await createToken(user.id, 'password_reset', 60 * 60 * 1000);
    const link = `${FRONTEND_URL}/redefinir-senha?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Redefinir senha — Finanças Pessoais',
      html: `
        <p>Olá, ${user.name}!</p>
        <p>Clique no link abaixo para definir uma nova senha:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Se você não pediu isso, ignore este e-mail — sua senha continua a mesma. O link expira em 1 hora.</p>
      `,
    });
  }
  // Resposta sempre genérica, para não revelar se o e-mail existe na base.
  res.json({ sent: true });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Dados incompletos' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres' });

  const row = await db.get(
    "SELECT * FROM verification_tokens WHERE token_hash = ? AND type = 'password_reset' AND used_at IS NULL",
    [hashToken(token)]
  );
  if (!row || new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'Link inválido ou expirado. Peça uma nova redefinição.' });

  const passwordHash = bcrypt.hashSync(password, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id]);
  // Invalida este e qualquer outro pedido de redefinição pendente da mesma conta.
  await db.run(
    "UPDATE verification_tokens SET used_at = datetime('now') WHERE user_id = ? AND type = 'password_reset' AND used_at IS NULL",
    [row.user_id]
  );

  res.json({ reset: true });
});

module.exports = { router, sendVerificationEmail };
