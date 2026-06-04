@echo off
setlocal

:: ============================================================
::  CFLU WOD Playlist Builder - Starter v4
::  Doppelklick oder Aufruf aus Terminal zum Starten.
:: ============================================================

set HTML_FILE=CFLU_WOD_Builder.html
set JS_FILE=cflu_tracks.js
set PORT=8888

cd /d "%~dp0"

echo.
echo  CFLU WOD Playlist Builder v4
echo  ============================================================
echo.

:: ---- HTML-Datei pruefen -------------------------------------
if not exist "%HTML_FILE%" (
    echo  [FEHLER] %HTML_FILE% nicht gefunden^^!
    echo  Bitte HTML-Datei in diesen Ordner legen.
    echo.
    pause
    exit /b 1
)
echo  [OK] %HTML_FILE% gefunden.

:: ---- Python finden ------------------------------------------
::  "py -3" (Python Launcher^) ist zuverlaessiger als "python",
::  da "python" auf Windows 10/11 den Store oeffnen kann.
set PYTHON=

py -3 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON=py -3
    for /f "tokens=*" %%v in ('py -3 --version 2^>^&1') do set PY_VER=%%v
    goto :python_ok
)

python --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON=python
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
    goto :python_ok
)

echo.
echo  [FEHLER] Python nicht gefunden^^!
echo  Download: https://www.python.org/downloads/
echo  Bei Installation "Add Python to PATH" aktivieren.
echo.
pause
exit /b 1

:python_ok
echo  [OK] %PY_VER%  ^(Befehl: %PYTHON%^)

:: ---- Track-Pool aktualisieren -------------------------------
set SOURCE_FOUND=0
if exist "Spotify Source.xlsx" set SOURCE_FOUND=1
if exist "Spotify_Source.xlsx" set SOURCE_FOUND=1

if "%SOURCE_FOUND%"=="1" goto :do_pool_build
echo  [HINWEIS] Keine Quelldatei - bestehendes %JS_FILE% wird verwendet.
goto :pool_done

:do_pool_build
echo.
echo  Aktualisiere Track-Pool aus Quelldatei...
%PYTHON% CFLU_Pool_Build.py
if errorlevel 1 (
    echo  [WARNUNG] Pool-Update fehlgeschlagen. Bestehendes %JS_FILE% wird verwendet.
) else (
    echo  [OK] Track-Pool aktualisiert.
)

:pool_done

:: ---- JS-Datenbasis pruefen ----------------------------------
if not exist "%JS_FILE%" (
    echo.
    echo  [FEHLER] %JS_FILE% nicht gefunden^^!
    echo  Bitte Spotify Source.xlsx hinzufuegen und neu starten.
    echo.
    pause
    exit /b 1
)
echo  [OK] %JS_FILE% gefunden.

:: ---- Port pruefen -------------------------------------------
netstat -an 2>nul | find ":%PORT% " | find "LISTENING" >nul 2>&1
if errorlevel 1 goto :port_free

echo.
echo  [HINWEIS] Port %PORT% ist bereits belegt.
echo  Loesung A: Browser direkt oeffnen ^(Server laeuft noch^):
echo             http://127.0.0.1:%PORT%/%HTML_FILE%
echo  Loesung B: Fenster schliessen, kurz warten, neu starten.
echo.
start "" "http://127.0.0.1:%PORT%/%HTML_FILE%"
pause
exit /b 0

:port_free
echo  [OK] Port %PORT% frei.

:: ---- Info ---------------------------------------------------
echo.
echo  ============================================================
if exist "cflu_client_id.txt" (
    echo  Spotify Client ID wird aus cflu_client_id.txt geladen.
    goto :info_done
)
echo  SPOTIFY EINRICHTUNG - einmalig:
echo  1. developer.spotify.com/dashboard
echo  2. App erstellen, Web API, Redirect URI:
echo     http://127.0.0.1:%PORT%/%HTML_FILE%
echo  3. Client ID in cflu_client_id.txt speichern ^(auto-geladen^)

:info_done
echo  ============================================================
echo.
echo  Starte Server auf Port %PORT%...
echo  Browser oeffnet sich in ca. 2 Sekunden automatisch.
echo  Dieses Fenster OFFEN lassen - Schliessen beendet den Server.
echo.

:: ---- Browser nach 2 Sek oeffnen ----------------------------
::  ping als Timer ^(3 x 1s^), kein komplexes Quoting noetig.
start "" /b cmd /c "ping 127.0.0.1 -n 3 >nul & start http://127.0.0.1:%PORT%/%HTML_FILE%"

:: ---- Server starten -----------------------------------------
%PYTHON% -m http.server %PORT% 2>&1
set SERVER_EXIT=%errorlevel%

echo.
echo  ============================================================
if %SERVER_EXIT% neq 0 (
    echo  [FEHLER] Server beendet mit Code %SERVER_EXIT%.
    echo.
    echo  Moegliche Ursachen:
    echo  - Port %PORT% war belegt ^(kurz warten, neu starten^)
    echo  - Keine Berechtigung fuer diesen Port
    echo  - http.server Modul fehlt ^(Python-Installation pruefen^)
) else (
    echo  [OK] Server normal beendet.
)
echo  ============================================================
echo.
pause
