@echo off
rem Inicia o emulador Android TV (AVD tv_test)
set EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe

if not exist "%EMULATOR%" (
    echo Emulador nao encontrado em %EMULATOR%
    echo Instale o Android SDK ou ajuste o caminho neste .bat
    pause
    exit /b 1
)

echo Iniciando emulador Android TV (tv_test)...
start "" "%EMULATOR%" -avd tv_test
