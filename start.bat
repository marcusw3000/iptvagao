@echo off
cd /d "%~dp0"

echo Iniciando API (porta 3001)...
start "API" cmd /k "cd apps\api && pnpm dev"

echo Iniciando Admin Web (porta 3000)...
start "Web Admin" cmd /k "cd apps\web && pnpm dev"

echo Iniciando App TV (porta 3002)...
start "TV App" cmd /k "cd apps\tv && pnpm dev"

echo Aguardando servidores subirem...
timeout /t 8 /nobreak >nul

start "" http://localhost:3000
start "" http://localhost:3002

echo.
echo Tudo rodando:
echo   API:    http://localhost:3001
echo   Admin:  http://localhost:3000
echo   TV App: http://localhost:3002
echo.
