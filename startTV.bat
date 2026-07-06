@echo off
setlocal
cd /d "%~dp0"

set "ROOT=%~dp0"
set "API_DIR=%ROOT%apps\api"
set "ANDROID_DIR=%ROOT%androidTvApk"
set "APK_PATH=%ANDROID_DIR%\app\build\outputs\apk\debug\app-debug.apk"
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
set "EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"
set "GRADLE=C:\tmp\gradle-8.7-full\gradle-8.7\bin\gradle.bat"
set "APP_ID=com.iptvagao.tv"
set "ACTIVITY=%APP_ID%/.MainActivity"
set "AVD_NAME=tv_test"

where pnpm >nul 2>nul
if errorlevel 1 (
    echo pnpm nao encontrado no PATH.
    echo Instale o pnpm ou abra este .bat em um terminal com Node.js configurado.
    pause
    exit /b 1
)

echo Iniciando fluxo local da Android TV...
echo.

call :ensure_api
if errorlevel 1 goto :fail

call :ensure_emulator
if errorlevel 1 goto :fail

call :build_install_launch
if errorlevel 1 goto :fail

echo.
echo Fluxo da TV concluido.
echo   API local:   http://localhost:3001/api/v1
echo   Emulador:    %AVD_NAME%
echo   APK Android: instalado e aberto
echo.
echo Observacoes:
echo   - O APK usa http://10.0.2.2:3001/api/v1 no emulador
echo   - Mantenha a janela da API aberta enquanto testar
echo.
exit /b 0

:ensure_api
echo [1/3] Verificando API local ^(porta 3001^)
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 3001); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo      API fora do ar. Iniciando...
    start "IPTVagao API" cmd /k "cd /d ""%API_DIR%"" && pnpm dev"
)

echo      Aguardando API responder na porta 3001...
powershell -NoProfile -Command "$deadline=(Get-Date).AddMinutes(2); do { try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1',3001); $c.Close(); exit 0 } catch { Start-Sleep -Seconds 2 } } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
    echo      Falha: API nao respondeu na porta 3001.
    exit /b 1
)
echo      API pronta.
exit /b 0

:ensure_emulator
echo [2/3] Verificando emulador Android TV
if not exist "%ADB%" (
    echo      adb.exe nao encontrado em %ADB%
    exit /b 1
)
if not exist "%EMULATOR%" (
    echo      emulator.exe nao encontrado em %EMULATOR%
    exit /b 1
)

set "DEVICE_ID="
for /f "skip=1 tokens=1" %%D in ('"%ADB%" devices') do (
    if not "%%D"=="" if not "%%D"=="offline" set "DEVICE_ID=%%D"
)

if not defined DEVICE_ID (
    echo      Nenhum device ativo. Iniciando AVD %AVD_NAME%...
    start "Android TV Emulator" "%EMULATOR%" -avd %AVD_NAME%
    echo      Aguardando device aparecer...
    "%ADB%" wait-for-device >nul 2>nul
) else (
    echo      Device encontrado: %DEVICE_ID%
)

echo      Aguardando boot completo do Android...
powershell -NoProfile -Command "$adb='%ADB%'; $deadline=(Get-Date).AddMinutes(3); do { $boot = (& $adb shell getprop sys.boot_completed 2>$null).Trim(); if ($boot -eq '1') { exit 0 }; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
    echo      Falha: emulador nao concluiu o boot.
    exit /b 1
)
echo      Emulador pronto.
exit /b 0

:build_install_launch
echo [3/3] Gerando, instalando e abrindo o APK
if not exist "%GRADLE%" (
    echo      Gradle nao encontrado em %GRADLE%
    exit /b 1
)

call "%GRADLE%" assembleDebug
if errorlevel 1 (
    echo      Falha ao gerar o APK.
    exit /b 1
)

if not exist "%APK_PATH%" (
    echo      APK nao encontrado em %APK_PATH%
    exit /b 1
)

"%ADB%" install -r "%APK_PATH%"
if errorlevel 1 (
    echo      Falha ao instalar o APK.
    exit /b 1
)

"%ADB%" shell am start -n %ACTIVITY% >nul 2>nul
if errorlevel 1 (
    "%ADB%" shell monkey -p %APP_ID% -c android.intent.category.LAUNCHER 1 >nul 2>nul
)

echo      APK aberto no emulador.
exit /b 0

:fail
echo.
echo O startTV.bat encontrou um erro e interrompeu a automacao.
pause
exit /b 1
