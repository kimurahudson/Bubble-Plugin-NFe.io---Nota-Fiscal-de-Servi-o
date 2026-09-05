# CRM WhatsApp Local

CRM local para registrar o histórico de conversas do WhatsApp com seus clientes.
Roda inteiramente na sua máquina (Windows) — nenhum dado sai do seu computador.

## Arquitetura

```
crm-whatsapp/
├── backend/               API (FastAPI) + banco SQLite + painel web
│   ├── main.py            rotas da API e do painel
│   ├── database.py        conexão e criação das tabelas
│   ├── models.py          esquemas (Pydantic)
│   ├── crud.py            operações no banco
│   ├── requirements.txt
│   ├── static/            painel web (HTML/CSS/JS)
│   └── crm.db             banco SQLite (criado automaticamente, não versionado)
│
├── whatsapp-connector/    conector do WhatsApp (Node.js)
│   ├── index.js           conecta ao WhatsApp Web, envia mensagens para a API
│   ├── package.json
│   └── .wwebjs_auth/      sessão do WhatsApp (criada automaticamente, não versionada)
│
├── iniciar.bat            sobe backend + conector (duplo clique)
├── iniciar.ps1            mesma coisa, em PowerShell
└── README.md
```

- **Backend**: guarda clientes e mensagens em um arquivo SQLite local (`backend/crm.db`) e expõe tanto a API quanto o painel web.
- **Conector**: usa [whatsapp-web.js](https://wwebjs.dev/) para ler/escrever no seu WhatsApp através do navegador (via WhatsApp Web) e replica cada mensagem para o backend.
- **Painel**: página simples servida pelo próprio backend, sem instalar nada a mais.

## Pré-requisitos

- **Windows 10/11**
- **Python 3.10+** — [python.org/downloads](https://www.python.org/downloads/) (marque a opção **"Add python.exe to PATH"** no instalador)
- **Node.js LTS (18 ou superior)** — [nodejs.org](https://nodejs.org/)

O script `iniciar.bat` verifica se os dois estão instalados e avisa se algum estiver faltando.

## Primeira execução

1. Copie a pasta `crm-whatsapp` inteira para o seu computador (ou clone o repositório).
2. Dê duplo clique em **`iniciar.bat`** (ou clique com o botão direito em `iniciar.ps1` → "Executar com PowerShell").
   - Na primeira vez, ele vai criar o ambiente Python (`venv`) e instalar as dependências do backend e do conector — isso pode levar alguns minutos.
3. Duas janelas de terminal vão abrir:
   - **CRM WhatsApp - Backend**: sobe a API e o painel em `http://127.0.0.1:8000`
   - **CRM WhatsApp - Conector WhatsApp**: depois de alguns segundos, mostra um **QR Code**
4. No celular, abra o WhatsApp → **Configurações (⋮) → Aparelhos conectados → Conectar um aparelho** e escaneie o QR Code que apareceu na janela do conector.
5. Depois de escanear, a janela do conector mostra `[OK] Sessão autenticada com sucesso.` — a sessão fica salva em `whatsapp-connector/.wwebjs_auth`, então você **não precisa escanear de novo** nas próximas vezes (a não ser que resete a sessão, veja abaixo).
6. Abra `http://127.0.0.1:8000` no navegador para ver o painel.

## Uso do dia a dia

- Toda mensagem recebida ou enviada no número conectado (fora de grupos) é automaticamente registrada no CRM e vinculada ao cliente pelo telefone. Se o número ainda não estiver cadastrado, um cliente novo é criado sozinho.
- O painel atualiza a lista de clientes e a conversa aberta automaticamente a cada 5 segundos.
- Para encerrar, basta fechar as duas janelas de terminal (ou `Ctrl+C` em cada uma).
- Documentação interativa da API (Swagger): `http://127.0.0.1:8000/docs`.

## Iniciar automaticamente com o Windows

Para o CRM subir sozinho quando o Windows liga, siga o mesmo padrão que você já usa para outros scripts na pasta Startup:

1. Pressione `Win + R`, digite `shell:startup` e Enter — isso abre a pasta de inicialização do Windows.
2. Clique com o botão direito em **`iniciar.bat`** → **Criar atalho**.
3. Mova esse atalho para a pasta que abriu no passo 1.

Na próxima vez que o Windows ligar, as duas janelas (backend e conector) vão subir automaticamente. Como a sessão do WhatsApp já fica salva, não é preciso escanear o QR de novo.

> Se preferir que as janelas fiquem minimizadas ao iniciar com o Windows, edite as propriedades do atalho (botão direito → Propriedades → "Executar": **Minimizada**).

## Resetar a sessão do WhatsApp (trocar de número)

Se precisar conectar um número diferente:

1. Feche a janela do conector (ou `Ctrl+C`).
2. Apague a pasta `whatsapp-connector/.wwebjs_auth`.
3. Rode `iniciar.bat` de novo (ou só a janela do conector).
4. Um novo QR Code vai aparecer — escaneie com o número que quiser conectar a partir de agora.

Isso **não apaga o histórico de clientes e mensagens já registrados** no CRM (isso fica em `backend/crm.db`, que é um arquivo separado).

## Privacidade e dados sensíveis

- `backend/crm.db` (nomes, telefones e todo o histórico de mensagens) e `whatsapp-connector/.wwebjs_auth` (credenciais da sessão do WhatsApp) **nunca são enviados ao Git** — já estão no `.gitignore` do projeto.
- Se quiser fazer backup dos seus dados, copie o arquivo `backend/crm.db` manualmente para um local seguro.
- Se você apagar `backend/crm.db`, todo o histórico de clientes e mensagens é perdido (o arquivo é recriado vazio na próxima vez que o backend subir).

## Solução de problemas

- **"Python nao encontrado" / "Node.js nao encontrado"**: reinstale marcando a opção de adicionar ao PATH, depois feche e abra o terminal (ou reinicie o Windows) antes de tentar de novo.
- **QR Code não aparece**: espere alguns segundos após a janela do conector abrir; se demorar muito, verifique se o antivírus/firewall não está bloqueando o Node.js ou o Chromium baixado pelo `whatsapp-web.js` de acessar a internet.
- **Porta 8000 já em uso**: outro programa está usando essa porta. Feche o outro programa, ou troque a porta no `iniciar.bat`/`iniciar.ps1` (no trecho `--port 8000`) e ajuste também a variável de ambiente `CRM_API_URL` do conector (veja `whatsapp-connector/index.js`) para apontar para a nova porta.
- **Sessão cai sozinha com frequência**: o conector tenta reconectar automaticamente a cada 5 segundos sem perder a sessão salva. Se continuar caindo, confira se o celular está com internet e o WhatsApp aberto pelo menos ocasionalmente (o WhatsApp Web exige que o celular sincronize de tempos em tempos).
- **`npm audit` mostra vulnerabilidades**: são vulnerabilidades conhecidas na cadeia de dependências do Puppeteer, usada internamente pelo `whatsapp-web.js`, e não em código deste projeto. Evite rodar `npm audit fix --force`, pois costuma quebrar a compatibilidade com o `whatsapp-web.js`.

## Limitações conhecidas

- O conector lê apenas conversas individuais (não registra mensagens de grupos nem status/broadcast).
- O painel é somente leitura (visualização do histórico) — não é possível enviar mensagens novas pelo painel.
