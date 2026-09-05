import sqlite3
from typing import Optional

from fastapi import FastAPI, HTTPException

import crud
from database import init_db
from models import ClienteCreate, ClienteOut, ClienteUpdate, MensagemCreate, MensagemOut

app = FastAPI(title="CRM WhatsApp - API")


@app.on_event("startup")
def startup() -> None:
    init_db()


# ---------------------- Clientes ----------------------


@app.get("/clientes", response_model=list[ClienteOut])
def listar_clientes(busca: Optional[str] = None):
    return crud.listar_clientes(busca)


@app.post("/clientes", response_model=ClienteOut, status_code=201)
def criar_cliente(dados: ClienteCreate):
    try:
        return crud.criar_cliente(dados)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Já existe um cliente com esse telefone")


@app.get("/clientes/{cliente_id}", response_model=ClienteOut)
def obter_cliente(cliente_id: int):
    cliente = crud.obter_cliente(cliente_id)
    if cliente is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return cliente


@app.put("/clientes/{cliente_id}", response_model=ClienteOut)
def atualizar_cliente(cliente_id: int, dados: ClienteUpdate):
    if crud.obter_cliente(cliente_id) is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    try:
        return crud.atualizar_cliente(cliente_id, dados)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Já existe um cliente com esse telefone")


@app.delete("/clientes/{cliente_id}", status_code=204)
def excluir_cliente(cliente_id: int):
    if not crud.excluir_cliente(cliente_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")


@app.get("/clientes/{cliente_id}/mensagens", response_model=list[MensagemOut])
def listar_mensagens_do_cliente(cliente_id: int):
    if crud.obter_cliente(cliente_id) is None:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return crud.listar_mensagens_por_cliente(cliente_id)


# ------------- Endpoint interno (conector WhatsApp) -------------


@app.post("/mensagens", response_model=MensagemOut, status_code=201)
def registrar_mensagem(dados: MensagemCreate):
    """Usado pelo conector do WhatsApp. Vincula a mensagem a um cliente
    existente pelo telefone ou cria um novo cliente automaticamente."""
    return crud.registrar_mensagem(dados)
