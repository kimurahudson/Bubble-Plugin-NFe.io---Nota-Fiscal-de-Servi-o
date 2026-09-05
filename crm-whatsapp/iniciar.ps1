# Alternativa em PowerShell ao iniciar.bat - faz a mesma coisa.
# Se o Windows bloquear a execucao, rode antes (uma vez, como administrador):
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$connectorDir = Join-Path $root "whatsapp-connector"

Write-Host "============================================"
Write-Host "  CRM WhatsApp - iniciando backend e conector"
Write-Host "============================================"
Write-Host ""

function Test-Comando($nome) {
    return $null -ne (Get-Command $nome -ErrorAction SilentlyContinue)
}

if (-not (Test-Comando "python")) {
    Write-Host "[ERRO] Python nao encontrado no PATH." -ForegroundColor Red
    Write-Host "Instale em https://www.python.org/downloads/ marcando 'Add python.exe to PATH'."
    Read-Host "Pressione Enter para sair"
    exit 1
}

if (-not (Test-Comando "node")) {
    Write-Host "[ERRO] Node.js nao encontrado no PATH." -ForegroundColor Red
    Write-Host "Instale a versao LTS em https://nodejs.org/"
    Read-Host "Pressione Enter para sair"
    exit 1
}

$venvPath = Join-Path $backendDir ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "Criando ambiente virtual do backend, isso so acontece uma vez..."
    python -m venv $venvPath
}

Write-Host "Instalando/atualizando dependencias do backend..."
& "$venvPath\Scripts\pip.exe" install -q -r (Join-Path $backendDir "requirements.txt")

$nodeModulesPath = Join-Path $connectorDir "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "Instalando dependencias do conector do WhatsApp, primeira vez, pode demorar alguns minutos..."
    Push-Location $connectorDir
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "Subindo backend, API + painel web, em http://127.0.0.1:8000 ..."
Start-Process -FilePath "$venvPath\Scripts\uvicorn.exe" `
    -ArgumentList "main:app --host 127.0.0.1 --port 8000" `
    -WorkingDirectory $backendDir

Start-Sleep -Seconds 3

Write-Host "Subindo conector do WhatsApp..."
Start-Process -FilePath "node" `
    -ArgumentList "index.js" `
    -WorkingDirectory $connectorDir

Write-Host ""
Write-Host "============================================"
Write-Host "Pronto! Duas janelas foram abertas: backend e conector."
Write-Host "Na primeira vez, escaneie o QR Code que aparece na"
Write-Host "janela do conector, usando WhatsApp no celular:"
Write-Host "  Aparelhos conectados > Conectar um aparelho"
Write-Host ""
Write-Host "Painel do CRM: http://127.0.0.1:8000"
Write-Host "============================================"
