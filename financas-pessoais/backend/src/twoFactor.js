const crypto = require('crypto');
const { TOTP, Secret } = require('otpauth');
const QRCode = require('qrcode');

const ISSUER = 'Finanças Pessoais';

function generateSecret() {
  return new Secret({ size: 20 }).base32;
}

function buildTotp(secretBase32, email) {
  return new TOTP({
    issuer: ISSUER,
    label: email,
    secret: secretBase32,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
}

async function buildQrCodeDataUrl(secretBase32, email) {
  const uri = buildTotp(secretBase32, email).toString();
  return QRCode.toDataURL(uri);
}

function verifyTotpCode(secretBase32, email, code) {
  if (!code || !/^\d{6}$/.test(code)) return false;
  const delta = buildTotp(secretBase32, email).validate({ token: code, window: 1 });
  return delta !== null;
}

function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

module.exports = {
  generateSecret,
  buildQrCodeDataUrl,
  verifyTotpCode,
  generateRecoveryCodes,
  hashRecoveryCode,
};
