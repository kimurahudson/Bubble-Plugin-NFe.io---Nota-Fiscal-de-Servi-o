const db = require('./db');
const { normalize } = require('./textUtils');
const { serialize } = require('./transactionSerializer');

function groupKey(row) {
  return [row.date, row.value_cents, row.type, normalize(row.description)].join('|');
}

// Agrupa os lançamentos do usuário por data + valor + tipo + descrição normalizada.
// Grupos com mais de um lançamento são possíveis duplicados (ex: mesmo extrato
// importado duas vezes). O primeiro lançamento de cada grupo (mais antigo) é
// sugerido para manter; os demais são sugeridos para exclusão.
async function findDuplicateGroups({ userId, month }) {
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];
  if (month) {
    sql += " AND strftime('%Y-%m', date) = ?";
    params.push(month);
  }
  sql += ' ORDER BY date ASC, id ASC';

  const rows = await db.all(sql, params);

  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicateGroups = [];
  for (const groupRows of groups.values()) {
    if (groupRows.length < 2) continue;
    duplicateGroups.push({
      transactions: groupRows.map((row, i) => ({ ...serialize(row), suggestedKeep: i === 0 })),
    });
  }

  duplicateGroups.sort((a, b) => b.transactions[0].date.localeCompare(a.transactions[0].date));
  return duplicateGroups;
}

module.exports = { findDuplicateGroups };
