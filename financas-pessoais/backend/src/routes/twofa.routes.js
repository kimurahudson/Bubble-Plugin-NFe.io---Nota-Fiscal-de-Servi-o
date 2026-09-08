const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const {
  generateSecret,
  buildQrCodeDataUrl,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
} = require('../twoFactor');

const router = express.Router();
router.use(requireAuth);

async function saveRecoveryCodes(userId) {
  await db.run('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
  const codes = generateRecoveryCodes();
  for (const code of codes) {
    await db.run('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)', [
      userId,
      hashRecoveryCode(code),
    ]);
  }
  return codes;
}

router.get('/', async (req, res) => {
  const row = await db.get('SELECT totp_enabled FROM users WHERE id = ?', [req.userId]);
  const remaining = await db.get(
    'SELECT COUNT(*) as c FROM recovery_codes WHERE user_id = ? AND used = 0',
    [req.userId]
  );
  res.json({ enabled: !!row.totp_enabled, recoveryCodesRemaining: Number(remaining.c) });
});

router.post('/setup', async (req, res) => {
  const row = await db.get('SELECT email, totp_enabled FROM users WHERE id = ?', [req.userId]);
  if (row.totp_enabled)
    return res.status(400).json({ error: 'A verificação em duas etapas já está ativada' });

  const secret = generateSecret();
  await db.run('UPDATE users SET totp_pending_secret = ? WHERE id = ?', [secret, req.userId]);

  const qrCodeDataUrl = await buildQrCodeDataUrl(secret, row.email);
  res.json({ secret, qrCodeDataUrl });
});

router.post('/confirm', async (req, res) => {
  const { code } = req.body || {};
  const row = await db.get('SELECT email, totp_pending_secret FROM users WHERE id = ?', [
    req.userId,
  ]);
  if (!row.totp_pending_secret)
    return res.status(400).json({ error: 'Nenhuma configuração de 2FA pendente. Inicie novamente.' });

  const valid = verifyTotpCode(row.totp_pending_secret, row.email, code);
  if (!valid) return res.status(400).json({ error: 'Código inválido' });

  await db.run(
    "UPDATE users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled = 1 WHERE id = ?",
    [req.userId]
  );

  const recoveryCodes = await saveRecoveryCodes(req.userId);
  res.json({ enabled: true, recoveryCodes });
});

router.post('/disable', async (req, res) => {
  const { code } = req.body || {};
  const row = await db.get('SELECT email, totp_secret, totp_enabled FROM users WHERE id = ?', [
    req.userId,
  ]);
  if (!row.totp_enabled) return res.status(400).json({ error: 'A verificação em duas etapas não está ativada' });

  const valid = verifyTotpCode(row.totp_secret, row.email, code);
  if (!valid) return res.status(400).json({ error: 'Código inválido' });

  await db.run(
    "UPDATE users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled = 0 WHERE id = ?",
    [req.userId]
  );
  await db.run('DELETE FROM recovery_codes WHERE user_id = ?', [req.userId]);

  res.json({ enabled: false });
});

router.post('/recovery-codes/regenerate', async (req, res) => {
  const { code } = req.body || {};
  const row = await db.get('SELECT email, totp_secret, totp_enabled FROM users WHERE id = ?', [
    req.userId,
  ]);
  if (!row.totp_enabled)
    return res.status(400).json({ error: 'Ative a verificação em duas etapas primeiro' });

  const valid = verifyTotpCode(row.totp_secret, row.email, code);
  if (!valid) return res.status(400).json({ error: 'Código inválido' });

  const recoveryCodes = await saveRecoveryCodes(req.userId);
  res.json({ recoveryCodes });
});

module.exports = router;
