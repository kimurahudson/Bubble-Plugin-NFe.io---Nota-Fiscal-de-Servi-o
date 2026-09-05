from typing import Literal, Optional

from pydantic import BaseModel, Field


def normalizar_telefone(telefone: str) -> str:
    """Mantém apenas os dígitos do número (remove @c.us, +, espaços, etc.)."""
    return "".join(c for c in telefone if c.isdigit())


class ClienteBase(BaseModel):
    nome: str = Field(min_length=1)
    telefone: str = Field(min_length=1)
    empresa: Optional[str] = None
    observacoes: Optional[str] = None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    telefone: Optional[str] = None
    empresa: Optional[str] = None
    observacoes: Optional[str] = None


class ClienteOut(ClienteBase):
    id: int
    criado_em: str


class MensagemCreate(BaseModel):
    """Payload usado pelo conector do WhatsApp para registrar uma mensagem.

    Se o telefone ainda não existir como cliente, um novo cliente é criado
    automaticamente usando `nome` (ou o próprio telefone, se `nome` não vier).
    """

    telefone: str = Field(min_length=1)
    direcao: Literal["enviada", "recebida"]
    texto: str = Field(min_length=1)
    nome: Optional[str] = None
    timestamp: Optional[str] = None


class MensagemOut(BaseModel):
    id: int
    cliente_id: int
    direcao: Literal["enviada", "recebida"]
    texto: str
    timestamp: str
