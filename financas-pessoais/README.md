# Finanças Pessoais

App web para controle financeiro pessoal: lance receitas e despesas manualmente ou importando o
extrato CSV do banco, categorize os gastos e acompanhe tudo com a mesma conta no celular e no
computador (os dados ficam no servidor, então qualquer dispositivo logado vê as mesmas informações
sempre atualizadas).

## Estrutura

```
financas-pessoais/
├── backend/     API REST (Node.js + Express + SQLite)
└── frontend/    App web (React + Vite + Tailwind, responsivo e instalável como PWA)
```

## Funcionalidades

- Cadastro/login por e-mail e senha (cada usuário só vê os próprios dados)
- Lançamentos manuais de receitas e despesas com: Data, Valor, Parcela, Parcela total, Categoria e Banco
- Incluir, alterar e excluir lançamentos, categorias e bancos
- Importação de extrato em CSV: upload → mapeamento de colunas → pré-visualização → confirmação
- Filtros por mês, tipo, categoria e banco, com totais de receitas/despesas/saldo
- Layout responsivo (tabela no desktop, cards no celular) e instalável como app (PWA)

## Como rodar localmente

### 1. Backend

```bash
cd backend
cp .env.example .env   # ajuste o JWT_SECRET para algo seguro
npm install
npm start
```

A API sobe em `http://localhost:4000`. O banco de dados SQLite é criado automaticamente em
`backend/data/financas.db` (pasta ignorada pelo git).

### 2. Frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O app abre em `http://localhost:5173` e já usa um proxy para a API em `/api`.

## Deploy (para acessar do celular e do computador pela internet)

O app foi feito para funcionar com backend e frontend hospedados separadamente, em domínios
diferentes.

### 1. Backend

Publique a pasta `backend/` em qualquer serviço que rode Node.js com disco persistente (Render,
Railway, Fly.io, um VPS, etc.). Já existe um `Dockerfile` pronto em `backend/Dockerfile`, então
qualquer provedor que aceite Docker funciona sem configuração extra.

Variáveis de ambiente:

| Variável      | Obrigatória | Descrição                                                        |
|---------------|-------------|-------------------------------------------------------------------|
| `JWT_SECRET`  | Sim         | Segredo longo e aleatório para assinar os tokens de login          |
| `PORT`        | Não         | Porta da API (padrão 4000; a maioria dos provedores já define)     |
| `DATA_DIR`    | Não         | Onde salvar o banco SQLite (padrão `./data`; no Docker use `/data`, montando um volume persistente) |
| `CORS_ORIGIN` | Não         | URL(s) do frontend em produção, separadas por vírgula (ex: `https://meu-app.vercel.app`). Sem isso, aceita qualquer origem. |

### 2. Frontend

Rode `npm run build` dentro de `frontend/` (gera `frontend/dist`) e publique num host de arquivos
estáticos (Vercel, Netlify, Cloudflare Pages, etc.):

- `vercel.json` e `public/_redirects` já estão prontos para Vercel e Netlify (garantem que
  atualizar a página em qualquer tela, como `/categorias`, não dê erro 404).
- Defina a variável de ambiente de build `VITE_API_BASE_URL` com a URL da API publicada (ex:
  `https://minha-api.onrender.com/api`), já que frontend e backend ficam em domínios diferentes.
  Veja `frontend/.env.example`.

### 3. Depois de publicado

Acesse a URL do frontend pelo celular e "adicione à tela inicial" para usar como app. Como os
dados ficam no backend, entrar com a mesma conta no computador e no celular mantém tudo
sincronizado automaticamente — não existe armazenamento local que precise ser sincronizado
manualmente.

Se quiser, posso ajudar a fazer esse deploy num provedor específico — é só indicar qual (Render,
Railway, Vercel, etc.) e, quando chegar a hora, criar a conta/projeto lá (eu não tenho acesso a
contas externas por conta própria).

## Importação de CSV

O importador aceita CSV com separador `,` ou `;` (detectado automaticamente) e funciona com
qualquer banco, pois você mapeia manualmente qual coluna do arquivo é Data, Valor, Descrição,
Parcela e Categoria antes de confirmar. Também é possível:

- Marcar todos os lançamentos do arquivo como receita ou despesa (útil para fatura de cartão)
- Inverter o sinal dos valores
- Escolher (ou cadastrar na hora) o banco de origem do extrato

Linhas com data ou valor inválidos são destacadas e não são importadas.
