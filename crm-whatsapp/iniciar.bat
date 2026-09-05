@echo off
setlocal

echo ============================================
echo   CRM WhatsApp - iniciando backend e conector
echo ============================================
echo.

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "CONNECTOR_DIR=%ROOT%whatsapp-connector"

where python >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Python nao encontrado no PATH.
    echo Instale em https://www.python.org/downloads/ marcando a opcao "Add python.exe to PATH".
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado no PATH.
    echo Instale a versao LTS em https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\.venv" (
    echo Criando ambiente virtual do backend, isso so acontece uma vez...
    python -m venv "%BACKEND_DIR%\.venv"
)

echo Instalando/atualizando dependencias do backend...
call "%BACKEND_DIR%\.venv\Scripts\pip.exe" install -q -r "%BACKEND_DIR%\requirements.txt"
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias do backend. Veja a mensagem acima.
    pause
    exit /b 1
)

if not exist "%CONNECTOR_DIR%\node_modules" (
    echo Instalando dependencias do conector do WhatsApp, primeira vez, pode demorar alguns minutos...
    pushd "%CONNECTOR_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias do conector. Veja a mensagem acima.
        popd
        pause
        exit /b 1
    )
    popd
)

echo.
echo Subindo backend, API + painel web, em http://127.0.0.1:8000 ...
start "CRM WhatsApp - Backend" /D "%BACKEND_DIR%" cmd /k ".venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo Subindo conector do WhatsApp...
start "CRM WhatsApp - Conector WhatsApp" /D "%CONNECTOR_DIR%" cmd /k "node index.js"

echo.
echo ============================================
echo Pronto! Duas janelas foram abertas:
echo   1. Backend  ^(API + painel web^)
echo   2. Conector do WhatsApp
echo.
echo Na primeira vez, escaneie o QR Code que aparece na
echo janela do conector, usando WhatsApp no celular:
echo   Aparelhos conectados ^> Conectar um aparelho
echo.
echo Painel do CRM: http://127.0.0.1:8000
echo ============================================
echo.

endlocal
