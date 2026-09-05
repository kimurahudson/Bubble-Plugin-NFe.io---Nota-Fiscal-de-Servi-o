const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

const CRM_API_URL = process.env.CRM_API_URL || 'http://127.0.0.1:8000';
const SESSION_PATH = path.join(__dirname, '.wwebjs_auth');

let reconectando = false;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('\nEscaneie o QR Code abaixo pelo celular:');
  console.log('WhatsApp > Aparelhos conectados > Conectar um aparelho\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('[OK] Sessão autenticada com sucesso. A sessão fica salva em .wwebjs_auth.');
});

client.on('auth_failure', (msg) => {
  console.error('[ERRO] Falha na autenticação:', msg);
});

client.on('ready', () => {
  console.log(`[OK] Conector pronto. Enviando mensagens para ${CRM_API_URL}`);
});

client.on('disconnected', (motivo) => {
  console.warn('[AVISO] Sessão do WhatsApp desconectada:', motivo);
  agendarReconexao();
});

function agendarReconexao() {
  if (reconectando) return;
  reconectando = true;
  console.log('Tentando reconectar em 5 segundos...');
  setTimeout(() => {
    reconectando = false;
    client.initialize().catch((erro) => {
      console.error('[ERRO] Falha ao reconectar, tentando novamente:', erro.message);
      agendarReconexao();
    });
  }, 5000);
}

client.on('message_create', async (message) => {
  try {
    await processarMensagem(message);
  } catch (erro) {
    console.error('[ERRO] Falha ao processar mensagem:', erro.message);
  }
});

async function processarMensagem(message) {
  const chat = await message.getChat();

  // Ignora grupos e status/broadcast: o CRM registra apenas conversas 1:1 com clientes.
  if (chat.isGroup || chat.id.server === 'broadcast') {
    return;
  }

  const telefone = chat.id.user;
  const nome = chat.name || telefone;
  const texto = message.body && message.body.length > 0 ? message.body : `[${message.type}]`;

  await enviarParaCRM({
    telefone,
    nome,
    direcao: message.fromMe ? 'enviada' : 'recebida',
    texto,
    timestamp: new Date(message.timestamp * 1000).toISOString(),
  });
}

async function enviarParaCRM(payload) {
  try {
    const resposta = await fetch(`${CRM_API_URL}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resposta.ok) {
      const corpo = await resposta.text();
      console.error(`[ERRO] CRM respondeu ${resposta.status}: ${corpo}`);
    }
  } catch (erro) {
    console.error('[ERRO] Não foi possível falar com o backend do CRM:', erro.message);
  }
}

process.on('unhandledRejection', (erro) => {
  console.error('[ERRO] Erro não tratado:', erro);
});

console.log('Iniciando conector do WhatsApp...');
client.initialize();
