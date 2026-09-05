# Finanças Pessoais

App web para controle financeiro pessoal: lance receitas e despesas manualmente ou importando o
extrato CSV do banco, categorize os gastos e acompanhe tudo com a mesma conta no celular e no
computador (os dados ficam no servidor, então qualquer dispositivo logado vê as mesmas informações
sempre atualizadas).

## Estrutura

```
financas-pessoais/
├── backend/     API REST (Node.js + Express + SQLite/Turso)
└── frontend/    App web (React + Vite + Tailwind, responsivo e instalável como PWA)
```

O backend usa [libSQL](https://turso.tech/libsql) (SQLite): em desenvolvimento local grava num
arquivo `.db` normalmente; em produção, aponta para um banco Turso (SQLite hospedado com camada
gratuita permanente), para os dados nunca serem perdidos mesmo em hospedagens cujo disco não é
persistente.

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

Caminho recomendado, **100% gratuito e sem cartão de crédito**: banco de dados no **Turso**,
backend no **Render** e frontend no **Vercel**. Como cada um desses serviços exige login na sua
própria conta (GitHub, Google, etc.), esses passos precisam ser feitos por você mesmo(a) no seu
navegador — eu não tenho como fazer login nessas contas por você. Depois de criado o projeto em
cada serviço, os deploys seguintes acontecem sozinhos a cada `git push`.

### 1. Banco de dados (Turso)

1. Crie uma conta gratuita em [turso.tech](https://turso.tech) (login com GitHub ou e-mail).
2. Crie um banco de dados novo (qualquer nome, ex: `financas-pessoais`).
3. Copie a **Database URL** (algo como `libsql://financas-pessoais-seuusuario.turso.io`) e gere um
   **auth token** — ambos ficam disponíveis no painel do banco.

### 2. Backend (Render)

1. Crie uma conta gratuita em [render.com](https://render.com) e conecte sua conta do GitHub.
2. "New +" → "Web Service" → selecione este repositório e a branch
   `claude/personal-finance-app-sync-2dtna8` (ou `main`, depois que este código for mesclado).
3. Em "Root Directory" coloque `financas-pessoais/backend`. O Render detecta o `Dockerfile`
   automaticamente (ambiente "Docker").
4. Em "Environment Variables", adicione:
   - `JWT_SECRET`: qualquer texto longo e aleatório
   - `TURSO_DATABASE_URL`: a Database URL copiada no passo anterior
   - `TURSO_AUTH_TOKEN`: o auth token copiado no passo anterior
5. Deploy. Ao terminar, copie a URL gerada (algo como `https://financas-pessoais-api.onrender.com`).

> No plano gratuito do Render o serviço "dorme" após alguns minutos sem uso e demora ~1 minuto para
> acordar na próxima visita — isso é só uma demora inicial, os dados continuam seguros no Turso.

### 3. Frontend (Vercel)

1. Crie uma conta gratuita em [vercel.com](https://vercel.com) e conecte sua conta do GitHub.
2. "Add New..." → "Project" → selecione o mesmo repositório.
3. Em "Root Directory" coloque `financas-pessoais/frontend` (framework Vite é detectado
   automaticamente).
4. Em "Environment Variables", adicione `VITE_API_BASE_URL` com a URL do backend + `/api` (ex:
   `https://financas-pessoais-api.onrender.com/api`).
5. Deploy. Copie a URL gerada (algo como `https://financas-pessoais.vercel.app`).

### 4. Últimos ajustes

Volte no Render e adicione a variável `CORS_ORIGIN` com a URL do Vercel (ex:
`https://financas-pessoais.vercel.app`), depois clique em "Manual Deploy" para reiniciar o
backend com essa configuração.

### 5. Pronto

Acesse a URL do Vercel pelo celular e "adicione à tela inicial" para usar como app. Como os dados
ficam no Turso (não no celular nem no computador), entrar com a mesma conta nos dois lugares
mantém tudo sincronizado automaticamente.

### Alternativas

Qualquer serviço que rode Docker (Railway, Fly.io, um VPS) também funciona para o backend — o
`Dockerfile` já está pronto. Para o frontend, qualquer host de arquivos estáticos (Netlify,
Cloudflare Pages) funciona; `vercel.json` e `public/_redirects` já cobrem o fallback de rotas para
Vercel e Netlify.

## Importação de CSV

O importador aceita CSV com separador `,` ou `;` (detectado automaticamente) e funciona com
qualquer banco, pois você mapeia manualmente qual coluna do arquivo é Data, Valor, Descrição,
Parcela e Categoria antes de confirmar. Também é possível:

- Marcar todos os lançamentos do arquivo como receita ou despesa (útil para fatura de cartão)
- Inverter o sinal dos valores
- Escolher (ou cadastrar na hora) o banco de origem do extrato

Linhas com data ou valor inválidos são destacadas e não são importadas.
