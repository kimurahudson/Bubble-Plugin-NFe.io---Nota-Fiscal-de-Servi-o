require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const categoriesRoutes = require('./routes/categories.routes');
const banksRoutes = require('./routes/banks.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const importRoutes = require('./routes/import.routes');

const app = express();

// CORS_ORIGIN: lista separada por vírgula das origens do frontend em produção
// (ex: https://meu-app.vercel.app). Sem essa variável, aceita qualquer origem
// (ok para uso local/pessoal, mas defina em produção para maior segurança).
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : null;
app.use(
  cors({
    origin: allowedOrigins ?? true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/banks', banksRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/import', importRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
