import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "crm.db"


def _dict_row_factory(cursor: sqlite3.Cursor, row: tuple) -> dict:
    campos = [coluna[0] for coluna in cursor.description]
    return dict(zip(campos, row))


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = _dict_row_factory
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                telefone TEXT NOT NULL UNIQUE,
                empresa TEXT,
                observacoes TEXT,
                criado_em TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mensagens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                direcao TEXT NOT NULL CHECK (direcao IN ('enviada', 'recebida')),
                texto TEXT NOT NULL,
                timestamp TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_mensagens_cliente_id ON mensagens (cliente_id)"
        )
        conn.commit()
    finally:
        conn.close()
