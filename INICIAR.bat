@echo off
setlocal
cd /d "%~dp0"
set PORT=3000

echo.
echo   IMPRENTA SANCHEZ - Iniciando servidor local
echo   --------------------------------------------

where node >nul 2>nul
if %errorlevel%==0 goto USAR_NODE

where python >nul 2>nul
if %errorlevel%==0 goto USAR_PYTHON

echo   [ERROR] No se encontro Node.js ni Python 3.
echo   Instala Node.js (https://nodejs.org) o Python 3 y vuelve a intentar.
echo.
pause
exit /b 1

:USAR_NODE
echo   Backend detectado: Node.js
echo   Web:    http://localhost:%PORT%/
echo   Admin:  http://localhost:%PORT%/admin
echo.
powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/admin'"
node "backend\server.js"
goto FIN

:USAR_PYTHON
echo   Backend detectado: Python 3
echo   Web:    http://localhost:%PORT%/
echo   Admin:  http://localhost:%PORT%/admin
echo.
powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%/admin'"
python "backend\server.py"

:FIN
echo.
pause
