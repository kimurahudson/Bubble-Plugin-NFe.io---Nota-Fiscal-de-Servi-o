const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

// Em produção (deploy), defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN apontando
// para um banco Turso (SQLite hospedado, persiste de verdade entre deploys/reinícios).
// Sem essas variáveis, usa um arquivo SQLite local em DATA_DIR — ótimo para
// desenvolvimento, mas não deve ser usado em hospedagens com disco não-persistente.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!process.env.TURSO_DATABASE_URL && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(DATA_DIR, 'financas.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function rowToObject(row) {
  return { ...row };
}

function normalizeResult(result) {
  return {
    rows: result.rows.map(rowToObject),
    rowsAffected: result.rowsAffected,
    lastInsertRowid:
      result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined,
  };
}

async function run(sql, args = []) {
  const result = await client.execute({ sql, args });
  return normalizeResult(result);
}

async function get(sql, args = []) {
  const result = await run(sql, args);
  return result.rows[0];
}

async function all(sql, args = []) {
  const result = await run(sql, args);
  return result.rows;
}

async function migrate() {
  try {
    await client.execute('PRAGMA foreign_keys = ON');
  } catch {
    // Alguns backends remotos do libsql não suportam PRAGMA; seguimos sem ele.
  }

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
      color TEXT NOT NULL DEFAULT '#323e48',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name, type)
    );

    CREATE TABLE IF NOT EXISTS banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      value_cents INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
      installment INTEGER NOT NULL DEFAULT 1,
      installment_total INTEGER NOT NULL DEFAULT 1,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      bank_id INTEGER REFERENCES banks(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_banks_user ON banks(user_id);
  `);
}

module.exports = { client, run, get, all, migrate };
