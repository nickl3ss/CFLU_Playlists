@echo off
setlocal

:: ============================================================
::  CFLU WOD Playlist Builder — Starter v3
::  Beide Dateien in gleichen Ordner legen und per
::  Doppelklick starten.
:: ============================================================

set HTML_FILE=CFLU_WOD_Builder.html
set PORT=8888
set URL=http://127.0.0.1:%PORT%/%HTML_FILE%

:: Wechsle in den Ordner dieser BAT-Datei
cd /d "%~dp0"

echo.
echo  CFLU WOD Playlist Builder v3
echo  ============================================================
echo.

:: Prüfe HTML-Datei
if not exist "%HTML_FILE%" (
    echo  [FEHLER] %HTML_FILE% nicht gefunden!
    echo.
    echo  Ordner: %~dp0
    echo  Bitte HTML-Datei in diesen Ordner legen.
    echo.
    pause
    exit /b 1
)
echo  [OK] %HTML_FILE% gefunden.

:: Prüfe Python
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [FEHLER] Python nicht gefunden!
    echo  Download: https://www.python.org/downloads/
    echo  Bei Installation "Add Python to PATH" aktivieren.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  [OK] %%v

:: Prüfe ob Port bereits belegt
netstat -an 2>nul | find ":%PORT% " | find "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo  [HINWEIS] Port %PORT% bereits belegt - Server lauft evtl. schon.
    echo  Oeffne Browser direkt auf:
    echo    %URL%
    echo.
    start "" "%URL%"
    pause
    exit /b 0
)
echo  [OK] Port %PORT% frei.

echo.
echo  ============================================================
echo  SPOTIFY EINRICHTUNG (einmalig notwendig):
echo  1. https://developer.spotify.com/dashboard
echo  2. App erstellen ^> Settings ^> Redirect URI:
echo     %URL%
echo  3. Client ID im Builder eingeben (wird nicht gespeichert)
echo  ============================================================
echo.
echo  Starte Server... Browser oeffnet sich automatisch.
echo  Dieses Fenster OFFEN lassen waehrend du den Builder nutzt.
echo  Schliessen beendet den Server.
echo.

:: Browser nach 2 Sek öffnen
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start """" ""%URL%"""

:: Server starten
python -m http.server %PORT%

echo.
echo  Server beendet.
pause
