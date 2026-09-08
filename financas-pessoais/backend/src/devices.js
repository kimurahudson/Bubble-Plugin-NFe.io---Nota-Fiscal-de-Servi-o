const crypto = require('crypto');

function hashDeviceToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function labelFromUserAgent(userAgent) {
  if (!userAgent) return 'Dispositivo';
  const ua = userAgent.toLowerCase();

  let os = 'Dispositivo';
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('mac os')) os = 'Mac';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = '';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('chromium')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';

  return browser ? `${os} · ${browser}` : os;
}

module.exports = { hashDeviceToken, labelFromUserAgent };
