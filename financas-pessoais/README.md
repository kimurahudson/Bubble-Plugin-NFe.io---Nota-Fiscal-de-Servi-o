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

O app foi feito para funcionar com backend e frontend hospedados separadamente:

1. **Backend**: publique a pasta `backend/` em qualquer serviço que rode Node.js com disco
   persistente (Render, Railway, Fly.io, um VPS, etc.). Configure as variáveis de ambiente
   `JWT_SECRET` (obrigatório, use um valor longo e aleatório) e opcionalmente `PORT` e `DATA_DIR`.
2. **Frontend**: publique a pasta `frontend/` (após `npm run build`, o resultado fica em
   `frontend/dist`) em qualquer host de arquivos estáticos (Vercel, Netlify, Cloudflare Pages,
   etc.), apontando as chamadas `/api` para a URL do backend publicado (ajuste `VITE_API_PROXY_TARGET`
   em desenvolvimento, ou configure um proxy/rewrite equivalente no host escolhido em produção).
3. Depois de publicado, acesse a URL do frontend pelo celular e "adicione à tela inicial" para
   usar como app. Como os dados ficam no backend, entrar com a mesma conta no computador e no
   celular mantém tudo sincronizado automaticamente — não existe armazenamento local que precise
   ser sincronizado manualmente.

Se preferir, posso ajudar a fazer esse deploy num provedor específico — é só indicar qual (Render,
Railway, Vercel, etc.) e as credenciais/acesso necessários.

## Importação de CSV

O importador aceita CSV com separador `,` ou `;` (detectado automaticamente) e funciona com
qualquer banco, pois você mapeia manualmente qual coluna do arquivo é Data, Valor, Descrição,
Parcela e Categoria antes de confirmar. Também é possível:

- Marcar todos os lançamentos do arquivo como receita ou despesa (útil para fatura de cartão)
- Inverter o sinal dos valores
- Escolher (ou cadastrar na hora) o banco de origem do extrato

Linhas com data ou valor inválidos são destacadas e não são importadas.
