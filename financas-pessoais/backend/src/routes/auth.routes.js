const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');
const { verifyTotpCode, hashRecoveryCode } = require('../twoFactor');
const { hashDeviceToken, labelFromUserAgent } = require('../devices');
const { sendVerificationEmail } = require('./verification.routes');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Garante que este dispositivo tenha um registro para o usuário, e decide se ele
// já pode ser confiado automaticamente (ex: é o primeiro dispositivo da conta, ou
// o login foi feito com um código de recuperação, prova forte o suficiente).
async function resolveDevice({ userId, deviceToken, userAgent, autoTrust }) {
  const tokenHash = hashDeviceToken(deviceToken);
  const label = labelFromUserAgent(userAgent);

  const userRow = await db.get('SELECT devices_bootstrapped FROM users WHERE id = ?', [userId]);
  const bootstrapped = !!userRow?.devices_bootstrapped;

  let device = await db.get('SELECT * FROM devices WHERE token_hash = ? AND user_id = ?', [
    tokenHash,
    userId,
  ]);

  if (!device) {
    const trust = autoTrust || !bootstrapped;
    const status = trust ? 'trusted' : 'pending';
    const info = await db.run(
      'INSERT INTO devices (user_id, token_hash, label, status) VALUES (?, ?, ?, ?)',
      [userId, tokenHash, label, status]
    );
    device = await db.get('SELECT * FROM devices WHERE id = ?', [info.lastInsertRowid]);
    if (trust && !bootstrapped) {
      await db.run('UPDATE users SET devices_bootstrapped = 1 WHERE id = ?', [userId]);
    }
  } else {
    const nextStatus = device.status === 'revoked' ? 'pending' : device.status;
    await db.run("UPDATE devices SET status = ?, last_seen_at = datetime('now') WHERE id = ?", [
      nextStatus,
      device.id,
    ]);
    device.status = nextStatus;
    if (autoTrust && device.status !== 'trusted') {
      await db.run("UPDATE devices SET status = 'trusted' WHERE id = ?", [device.id]);
      device.status = 'trusted';
    }
  }

  return device;
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome' });
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'E-mail inválido' });
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres' });

  const deviceToken = req.headers['x-device-token'];
  if (!deviceToken) return res.status(400).json({ error: 'Dispositivo não identificado' });

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) return res.status(409).json({ error: 'Já existe uma conta com este e-mail' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = await db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [
    name.trim(),
    email.toLowerCase(),
    passwordHash,
  ]);

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
  for (const [name2, type] of defaultCategories) {
    await db.run('INSERT INTO categories (user_id, name, type) VALUES (?, ?, ?)', [
      user.id,
      name2,
      type,
    ]);
  }

  // O primeiro dispositivo da conta é sempre confiado automaticamente
  // (resolveDevice cuida disso via a marcação devices_bootstrapped).
  await resolveDevice({
    userId: user.id,
    deviceToken,
    userAgent: req.headers['user-agent'],
    autoTrust: false,
  });

  try {
    await sendVerificationEmail(user);
  } catch (err) {
    console.error('Falha ao enviar e-mail de verificação:', err);
  }

  const token = signToken(user);
  res.status(201).json({ token, user: { ...user, emailVerified: false } });
});

router.post('/login', async (req, res) => {
  const { email, password, totpCode, recoveryCode } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });

  const deviceToken = req.headers['x-device-token'];
  if (!deviceToken) return res.status(400).json({ error: 'Dispositivo não identificado' });

  const row = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!row) return res.status(401).json({ error: 'E-mail ou senha inválidos' });

  const passwordOk = bcrypt.compareSync(password, row.password_hash);
  if (!passwordOk) return res.status(401).json({ error: 'E-mail ou senha inválidos' });

  let recoveryUsed = false;

  if (row.totp_enabled) {
    if (recoveryCode) {
      const codeHash = hashRecoveryCode(recoveryCode);
      const rc = await db.get(
        'SELECT * FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used = 0',
        [row.id, codeHash]
      );
      if (!rc) return res.status(401).json({ error: 'Código de recuperação inválido ou já utilizado' });
      await db.run('UPDATE recovery_codes SET used = 1 WHERE id = ?', [rc.id]);
      recoveryUsed = true;
    } else if (totpCode) {
      const valid = verifyTotpCode(row.totp_secret, row.email, totpCode);
      if (!valid) return res.status(401).json({ error: 'Código inválido' });
    } else {
      return res.json({ requires2fa: true });
    }
  }

  const device = await resolveDevice({
    userId: row.id,
    deviceToken,
    userAgent: req.headers['user-agent'],
    autoTrust: recoveryUsed,
  });

  if (device.status === 'pending') {
    return res.json({ devicePending: true, deviceLabel: device.label });
  }

  const user = { id: row.id, name: row.name, email: row.email };
  const token = signToken(user);
  res.json({
    token,
    user: { ...user, totpEnabled: !!row.totp_enabled, emailVerified: !!row.email_verified },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const row = await db.get(
    'SELECT id, name, email, totp_enabled, email_verified FROM users WHERE id = ?',
    [req.userId]
  );
  if (!row) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      totpEnabled: !!row.totp_enabled,
      emailVerified: !!row.email_verified,
    },
  });
});

module.exports = router;
