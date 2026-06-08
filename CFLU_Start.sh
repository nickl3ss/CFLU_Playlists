#!/usr/bin/env bash
# CFLU WOD Playlist Builder — Launcher für macOS / Linux

HTML_FILE="CFLU_WOD_Builder.html"
JS_FILE="cflu_tracks.js"
PORT=8888

cd "$(dirname "$0")"

echo ""
echo " CFLU WOD Playlist Builder"
echo " ============================================================"
echo ""

# ---- HTML-Datei prüfen ----------------------------------------
if [ ! -f "$HTML_FILE" ]; then
    echo " [FEHLER] $HTML_FILE nicht gefunden!"
    exit 1
fi
echo " [OK] $HTML_FILE gefunden."

# ---- Python finden --------------------------------------------
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PY_VER=$("$cmd" --version 2>&1)
        PYTHON="$cmd"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo " [FEHLER] Python nicht gefunden!"
    echo " macOS:  brew install python3"
    echo " Ubuntu: sudo apt install python3"
    exit 1
fi
echo " [OK] $PY_VER  (Befehl: $PYTHON)"

# ---- Track-Pool aktualisieren ---------------------------------
echo ""
echo " Aktualisiere Track-Pool ..."
if "$PYTHON" CFLU_Pool_Build.py; then
    echo " [OK] Track-Pool aktualisiert."
else
    echo " [WARNUNG] Pool-Update fehlgeschlagen. Bestehendes $JS_FILE wird verwendet."
fi

# ---- JS-Datenbasis prüfen ------------------------------------
if [ ! -f "$JS_FILE" ]; then
    echo " [FEHLER] $JS_FILE nicht gefunden!"
    echo " Bitte CSV-Dateien in Playlists/ ablegen und neu starten."
    exit 1
fi
echo " [OK] $JS_FILE gefunden."

# ---- Port prüfen ---------------------------------------------
if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || lsof -iTCP:"$PORT" -sTCP:LISTEN &>/dev/null 2>&1; then
    echo ""
    echo " [HINWEIS] Port $PORT ist bereits belegt."
    echo " Server läuft noch — Browser wird geöffnet."
    URL="http://127.0.0.1:$PORT/$HTML_FILE"
    if command -v open &>/dev/null; then open "$URL"
    elif command -v xdg-open &>/dev/null; then xdg-open "$URL"
    fi
    exit 0
fi
echo " [OK] Port $PORT frei."

# ---- Spotify-Info --------------------------------------------
echo ""
echo " ============================================================"
if [ -f "cflu_client_id.txt" ]; then
    echo " Spotify Client ID wird aus cflu_client_id.txt geladen."
else
    echo " SPOTIFY EINRICHTUNG - einmalig:"
    echo " 1. developer.spotify.com/dashboard"
    echo " 2. App erstellen, Web API, Redirect URI:"
    echo "    http://127.0.0.1:$PORT/$HTML_FILE"
    echo " 3. Client ID in cflu_client_id.txt speichern (auto-geladen)"
fi
echo " ============================================================"
echo ""
echo " Starte Server auf Port $PORT ..."
echo " Dieses Fenster OFFEN lassen - Schließen beendet den Server."
echo ""

# ---- Browser nach 2 Sek öffnen ------------------------------
URL="http://127.0.0.1:$PORT/$HTML_FILE"
(sleep 2 && { command -v open &>/dev/null && open "$URL" || xdg-open "$URL" 2>/dev/null; }) &

# ---- Server starten ------------------------------------------
"$PYTHON" cflu_server.py "$PORT"
