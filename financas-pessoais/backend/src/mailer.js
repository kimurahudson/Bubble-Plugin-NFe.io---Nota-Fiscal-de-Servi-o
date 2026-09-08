// Envio de e-mails transacionais via Resend (https://resend.com), que tem camada
// gratuita permanente sem cartão de crédito. Sem RESEND_API_KEY configurada (ex: em
// desenvolvimento local), o e-mail só é exibido no log do servidor — assim o fluxo
// de confirmação/recuperação continua testável sem precisar de uma conta de verdade.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'onboarding@resend.dev';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`\n--- E-mail (RESEND_API_KEY não configurada) ---\nPara: ${to}\nAssunto: ${subject}\n${html}\n---\n`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Falha ao enviar e-mail:', res.status, text);
  }
}

module.exports = { sendEmail };
