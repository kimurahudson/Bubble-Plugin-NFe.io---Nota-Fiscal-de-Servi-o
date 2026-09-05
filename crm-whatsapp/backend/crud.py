import unicodedata
from typing import Optional

from database import get_connection
from models import ClienteCreate, ClienteUpdate, MensagemCreate, normalizar_telefone


def _normalizar_busca(texto: str) -> str:
    """Remove acentos e caixa para permitir busca como 'joao' encontrar 'João'."""
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.lower()


def listar_clientes(busca: Optional[str] = None) -> list[dict]:
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM clientes ORDER BY nome COLLATE NOCASE")
        clientes = cursor.fetchall()
    finally:
        conn.close()

    if not busca:
        return clientes

    termo = _normalizar_busca(busca.strip())
    return [
        cliente
        for cliente in clientes
        if termo in _normalizar_busca(cliente["nome"])
        or termo in _normalizar_busca(cliente["telefone"])
        or (cliente["empresa"] and termo in _normalizar_busca(cliente["empresa"]))
    ]


def obter_cliente(cliente_id: int) -> Optional[dict]:
    conn = get_connection()
    try:
        cursor = conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,))
        return cursor.fetchone()
    finally:
        conn.close()


def obter_cliente_por_telefone(telefone: str) -> Optional[dict]:
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM clientes WHERE telefone = ?", (normalizar_telefone(telefone),)
        )
        return cursor.fetchone()
    finally:
        conn.close()


def criar_cliente(dados: ClienteCreate) -> dict:
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            INSERT INTO clientes (nome, telefone, empresa, observacoes)
            VALUES (?, ?, ?, ?)
            """,
            (
                dados.nome,
                normalizar_telefone(dados.telefone),
                dados.empresa,
                dados.observacoes,
            ),
        )
        conn.commit()
        cliente_id = cursor.lastrowid
        return conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
    finally:
        conn.close()


def atualizar_cliente(cliente_id: int, dados: ClienteUpdate) -> Optional[dict]:
    campos = dados.model_dump(exclude_unset=True)
    if "telefone" in campos:
        campos["telefone"] = normalizar_telefone(campos["telefone"])
    if not campos:
        return obter_cliente(cliente_id)

    conn = get_connection()
    try:
        set_clause = ", ".join(f"{campo} = ?" for campo in campos)
        valores = list(campos.values()) + [cliente_id]
        conn.execute(f"UPDATE clientes SET {set_clause} WHERE id = ?", valores)
        conn.commit()
        return conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
    finally:
        conn.close()


def excluir_cliente(cliente_id: int) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def listar_mensagens_por_cliente(cliente_id: int) -> list[dict]:
    conn = get_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM mensagens WHERE cliente_id = ? ORDER BY timestamp ASC, id ASC",
            (cliente_id,),
        )
        return cursor.fetchall()
    finally:
        conn.close()


def registrar_mensagem(dados: MensagemCreate) -> dict:
    """Vincula a mensagem a um cliente existente pelo telefone, ou cria um
    cliente novo automaticamente caso o número ainda não esteja cadastrado."""
    telefone = normalizar_telefone(dados.telefone)

    conn = get_connection()
    try:
        cliente = conn.execute(
            "SELECT * FROM clientes WHERE telefone = ?", (telefone,)
        ).fetchone()

        if cliente is None:
            cursor = conn.execute(
                "INSERT INTO clientes (nome, telefone) VALUES (?, ?)",
                (dados.nome or telefone, telefone),
            )
            cliente_id = cursor.lastrowid
        else:
            cliente_id = cliente["id"]

        if dados.timestamp:
            cursor = conn.execute(
                """
                INSERT INTO mensagens (cliente_id, direcao, texto, timestamp)
                VALUES (?, ?, ?, ?)
                """,
                (cliente_id, dados.direcao, dados.texto, dados.timestamp),
            )
        else:
            cursor = conn.execute(
                """
                INSERT INTO mensagens (cliente_id, direcao, texto)
                VALUES (?, ?, ?)
                """,
                (cliente_id, dados.direcao, dados.texto),
            )

        conn.commit()
        mensagem_id = cursor.lastrowid
        return conn.execute(
            "SELECT * FROM mensagens WHERE id = ?", (mensagem_id,)
        ).fetchone()
    finally:
        conn.close()
