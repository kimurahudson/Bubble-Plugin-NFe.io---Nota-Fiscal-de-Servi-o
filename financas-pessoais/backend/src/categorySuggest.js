const db = require('./db');

// Palavras curtas (preposições, artigos etc.) não ajudam a identificar a categoria
// e aparecem em quase toda descrição — por isso ficam fora da comparação por token.
const STOPWORDS = new Set([
  'para', 'com', 'das', 'dos', 'uma', 'umas', 'uns', 'pelo', 'pela',
  'pelos', 'pelas', 'este', 'esta', 'esse', 'essa', 'isso', 'aquele',
  'aquela', 'compra', 'pagamento', 'pagto', 'pgto', 'debito', 'credito',
]);

const KEYWORD_RULES = [
  { category: 'Alimentação', type: 'despesa', keywords: ['restaurante', 'mercado', 'supermercado', 'padaria', 'ifood', 'lanchonete', 'acougue', 'feira', 'pizza', 'hamburgueria', 'burguer', 'churrascaria', 'padoca', 'hortifruti', 'sorveteria', 'cafeteria', 'delivery'] },
  { category: 'Moradia', type: 'despesa', keywords: ['aluguel', 'condominio', 'energia', 'eletrica', 'sabesp', 'saneamento', 'iptu', 'gas encanado', 'internet', 'imobiliaria'] },
  { category: 'Transporte', type: 'despesa', keywords: ['uber', '99app', 'combustivel', 'gasolina', 'etanol', 'posto', 'estacionamento', 'pedagio', 'onibus', 'metro', 'metrô', 'ipva', 'oficina mecanica', 'mecanica', 'pneu'] },
  { category: 'Saúde', type: 'despesa', keywords: ['farmacia', 'drogaria', 'hospital', 'clinica', 'consulta medica', 'plano de saude', 'unimed', 'dentista', 'laboratorio', 'exame'] },
  { category: 'Lazer', type: 'despesa', keywords: ['cinema', 'netflix', 'spotify', 'ingresso', 'streaming', 'viagem', 'hotel', 'parque', 'show', 'bar ', 'balada'] },
  { category: 'Educação', type: 'despesa', keywords: ['escola', 'faculdade', 'curso', 'mensalidade escolar', 'livraria', 'material escolar'] },
  { category: 'Assinaturas', type: 'despesa', keywords: ['assinatura', 'mensalidade app', 'amazon prime', 'youtube premium'] },
  { category: 'Compras', type: 'despesa', keywords: ['magazine luiza', 'americanas', 'shopee', 'mercado livre', 'shopping', 'loja'] },
  { category: 'Salário', type: 'receita', keywords: ['salario', 'folha de pagamento', 'holerite', 'pro labore', 'pro-labore'] },
  { category: 'Outras receitas', type: 'receita', keywords: ['transferencia recebida', 'pix recebido', 'reembolso', 'restituicao', 'rendimento', 'dividendo', 'freela', 'freelance'] },
];

function normalize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(normalizedText) {
  return normalizedText.split(' ').filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

async function suggestFromHistory(userId, type, normDesc) {
  const tokens = significantTokens(normDesc);
  if (!tokens.length) return null;

  const rows = await db.all(
    'SELECT description, category_id FROM transactions WHERE user_id = ? AND type = ? AND category_id IS NOT NULL',
    [userId, type]
  );
  if (!rows.length) return null;

  const scoreByCategory = new Map();
  for (const row of rows) {
    const rowNorm = normalize(row.description);
    if (!rowNorm) continue;
    const exact = rowNorm === normDesc;
    const rowTokens = significantTokens(rowNorm);
    const overlaps = exact || tokens.some((t) => rowTokens.includes(t));
    if (overlaps) {
      const weight = exact ? 3 : 1;
      scoreByCategory.set(row.category_id, (scoreByCategory.get(row.category_id) ?? 0) + weight);
    }
  }
  if (!scoreByCategory.size) return null;

  const [bestId] = [...scoreByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  return db.get('SELECT id, name FROM categories WHERE id = ? AND user_id = ?', [bestId, userId]);
}

async function suggestFromKeywords(userId, type, normDesc) {
  const categories = await db.all('SELECT id, name FROM categories WHERE user_id = ? AND type = ?', [
    userId,
    type,
  ]);
  if (!categories.length) return null;

  for (const rule of KEYWORD_RULES) {
    if (rule.type !== type) continue;
    if (!rule.keywords.some((kw) => normDesc.includes(kw))) continue;
    const ruleNorm = normalize(rule.category);
    const match = categories.find((c) => {
      const catNorm = normalize(c.name);
      return catNorm.includes(ruleNorm) || ruleNorm.includes(catNorm);
    });
    if (match) return match;
  }
  return null;
}

// Sugere uma categoria já existente do usuário para uma descrição/tipo de lançamento.
// Primeiro tenta achar padrão no histórico já categorizado; se não achar, cai para
// um dicionário de palavras-chave comuns (só sugere se o usuário já tiver a categoria).
async function suggestCategoryFor({ userId, description, type }) {
  const normDesc = normalize(description);
  if (!normDesc || !['receita', 'despesa'].includes(type)) return null;

  const historyMatch = await suggestFromHistory(userId, type, normDesc);
  if (historyMatch) return { categoryId: historyMatch.id, categoryName: historyMatch.name, source: 'historico' };

  const keywordMatch = await suggestFromKeywords(userId, type, normDesc);
  if (keywordMatch) return { categoryId: keywordMatch.id, categoryName: keywordMatch.name, source: 'palavra-chave' };

  return null;
}

module.exports = { suggestCategoryFor };
