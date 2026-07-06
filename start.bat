@echo off
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
    echo pnpm nao encontrado no PATH.
    echo Instale o pnpm ou abra este .bat em um terminal com Node.js configurado.
    pause
    exit /b 1
)

echo Iniciando ambiente local do projeto...
echo.
echo [1/3] API local para o APK e apps web ^(porta 3001^)
start "IPTVagao API" cmd /k "cd /d "%~dp0apps\api" && pnpm dev"

echo [2/3] Admin Web ^(porta 3000^)
start "IPTVagao Admin" cmd /k "cd /d "%~dp0apps\web" && pnpm dev"

echo [3/3] TV App Web ^(porta 3002^)
start "IPTVagao TV Web" cmd /k "cd /d "%~dp0apps\tv" && pnpm dev"

echo.
echo Aguardando inicializacao dos servidores...
timeout /t 10 /nobreak >nul

start "" http://localhost:3000
start "" http://localhost:3002

echo.
echo Ambiente iniciado.
echo   API local:    http://localhost:3001/api/v1
echo   Admin web:    http://localhost:3000
echo   TV app web:   http://localhost:3002
echo.
echo Observacoes:
echo   - O APK Android TV em teste local usa http://10.0.2.2:3001/api/v1
echo   - Para o APK funcionar no emulador, mantenha a janela da API aberta
echo   - Para iniciar o emulador Android TV, use startTV.bat
echo.
