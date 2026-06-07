# PROJECT.md — CFLU WOD Playlist Builder

## Projektübersicht

Lokaler, regelbasierter Playlist-Generator für alle vier Phasen eines CrossFit-Trainings (Whiteboard, Skill, WOD, Cool-Down). Auf Basis des aktuellen Track-Pools erstellt der Builder phasenoptimierte Playlists mit Camelot-Kompatibilität, BPM-Steuerung und direktem Spotify-Export — alles lokal ohne Backend, betrieben via `cflu_server.py`. Entwickelt und genutzt für CrossFit Ludwigshafen.

---

## Architektur

### Komponenten

| ID | Name | Pfad | Verantwortung |
|----|------|------|---------------|
| C1 | Pool Builder | `CFLU_Pool_Build.py` | ETL-Pipeline: liest `Playlists/**/*.csv` rekursiv, dedup per Spotify Track-ID, schreibt `cflu_tracks.js` |
| C2 | WOD Builder UI | `CFLU_WOD_Builder.html` + `js/` + `css/` | Haupt-UI: Song-Auswahl, Playlist-Generierung, BPM-Chart, Spotify-Export |
| C3 | Track Data | `cflu_tracks.js` | Auto-generierter Track-Pool (non-module global `TRACK_DATA`) |
| C4 | Tests | `js/cflu_tests.js` + `CFLU_Tests.html` | Kanonische Testklasse (dual-mode): `node js/cflu_tests.js` → stdout + Exit-Code; Browser: `CFLU_Tests.html` importiert und rendert. 281 Tests. |

### JS-Module (C2 intern)

| Modul | Verantwortung |
|-------|---------------|
| `js/config.js` | Konstanten: PHASE_CONFIG, BPM_RANGES, DUR_STEPS, Farb-Stops |
| `js/state.js` | Mutabler App-Zustand (currentPhase, selectedTrack, poolGenre, Token, …) |
| `js/utils.js` | Pure Helpers: bpmGroup, camCompat, calcPhaseScore, titleDuplicate, camelotZoneDistance, … |
| `js/genres.js` | GENRE_CONFIG: 12 Main Genres, gewichteter Neighbour-Graph, Bridge-Subgenres, Rollen-Affinität |
| `js/algorithm.js` | Kern: pickNext/pickPrev (4-stufig), buildUp/Down/Plateau/Decreasing/Alternating |
| `js/chart.js` | BPM-Step-Chart + bidirektionale Hover-Synchronisation |
| `js/spotify.js` | Spotify PKCE Auth, Token-Expiry (55 min), Logout, Playlist-Export |
| `js/upload.js` | CSV-Upload-Helfer: sanitizeFilename, extractPlaylistName, formatUploadSuccess |
| `js/app.js` | UI-Handler, _gen(), renderResult(), Event-Wiring, Init |

### Abhängigkeiten

```
cflu_tracks.js  (non-module global, lädt zuerst → TRACK_DATA global)
     ↓
config.js
     ↓
utils.js   (importiert: config.js)
genres.js  (importiert: config.js)
     ↓
algorithm.js (importiert: config.js, state.js, utils.js, genres.js)
chart.js     (importiert: state.js)
spotify.js   (importiert: state.js)
upload.js    (importiert: –, genutzt von cflu_server.py + app.js)
     ↓
app.js (importiert alle Module, verdrahtet Events)
```

---

## Entscheidungen (ADR)

| # | Entscheidung | Begründung | Datum |
|---|-------------|------------|-------|
| 1 | Vanilla ES-Module, kein Build-System | Kein Node.js benötigt; direkter Browser-Import via Python http.server; maximale Transparenz | 2024 |
| 2 | `cflu_tracks.js` als non-module global `<script>` | Track-Pool; non-module erlaubt lazy Zugriff aus ES-Modulen ohne Top-Level-Import; importierbar in Tests ohne echte Daten | 2025 |
| 3 | Spotify PKCE ohne Backend | Kein Server nötig; Client ID bleibt lokal; Development Mode reicht für Einzelnutzer | 2024 |
| 4 | `cflu_server.py` als lokaler Server | Custom SimpleHTTPRequestHandler mit POST /api/upload-csv; Spotify OAuth benötigt `http://`-Redirect (kein `file://`) | 2024/2026 |
| 5 | cflu_tracks.js im Repo (obwohl generiert) | Vollständige Nutzbarkeit nach Clone ohne Pool-Rebuild-Pflicht; nach CSV-Update neu committen | 2025 |
| 6 | state.poolGenre als SSOT für Generations-Pool-Genre | genre-sel steuert nur Filter-Modus; Direktsuche und Spotify-Link setzen poolGenre aus t.genre; externer Track: manueller Dropdown | 2026-06-06 |
| 7 | Direktsuche ohne Camelot-/Energy-Filter | Referenz-Song-Auswahl soll nicht durch Generierungs-Filter eingeschränkt werden; Filter-Modus hat eigene gefilterte Liste | 2026-06-06 |
| 8 | Testklasse als dual-mode JS-Modul (`js/cflu_tests.js`) | Trennung von Test-Logik und HTML-Rendering: `js/cflu_tests.js` ist die kanonische Testklasse (importierbar von Node.js + Browser); `CFLU_Tests.html` ist nur noch ein Rendering-Shell (~90 Zeilen). Ermöglicht `node js/cflu_tests.js` ohne Browser/Server für Claude Code und CI. `package.json` mit `{"type":"module"}` aktiviert ES-Modul-Support in Node.js. | 2026-06-06 |

---

## Theorie-Quellen

| Dokument | Inhalt | Genutzt in |
|----------|--------|-----------|
| [`docs/theory/WODability_Playlist-WodMusicTheory.md`](theory/WODability_Playlist-WodMusicTheory.md) | BPM-Progressionstheorie, DJ-Norm ±5 BPM, Phasen-Energie-Fenster | #94 maxJump-Default, #80 PHASE_CONFIG |
| [`docs/theory/Genre_MatchingTheory.md`](theory/Genre_MatchingTheory.md) | Genre-Kompatibilitätsmatrix, Neighbour-Graph, Bridge-Subgenres | #85–#88 genres.js |

## Changelog

Offene Items → GitHub Issues (https://github.com/nickl3ss/CFLU_Playlists/issues)

### 2026-06-07 — Security-Review, Qualitäts-Hardening, neue Features

#### Sicherheit (`cflu_server.py`, `js/spotify.js`)
- **S-01** Spotify OAuth-Scope auf `playlist-modify-private` eingeschränkt (war zu breit)
- **S-02** Token-Expiry in `state.spTokenExpiry` getrackt (55 min); `isTokenValid()` + `spotifyLogout()` ergänzt; Export prüft Gültigkeit vor API-Aufruf
- **S-03** Spotify-API-Fehler werden nicht mehr roh per `JSON.stringify` in die UI gegeben — `console.error` + generische Fehlermeldung
- **S-04** Upload-Size-Limit 10 MB in `cflu_server.py` (vor Body-Read geprüft)
- **S-05** BOM-Entfernung beim CSV-Upload per `removeprefix('﻿')` statt `lstrip` (entfernt exakt eine BOM)
- **S-06** Security-Headers auf allen Responses: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`; CSP erlaubt `frame-src https://open.spotify.com` für den Track-Preview-Embed

#### Linux / Deployment (`CFLU_Start.sh`, `cflu.service`)
- **L-01** Port-Check in `CFLU_Start.sh` via `ss -tlnp` mit `lsof` als Fallback (ersetzt macOS-spezifisches `lsof`)
- **L-02** `cflu.service` — systemd User-Service für automatischen Start nach Login
- **L-03** CWD-Unabhängigkeit: `cflu_server.py` und `CFLU_Pool_Build.py` wechseln per `os.chdir(pathlib.Path(__file__).parent)` ins Skript-Verzeichnis

#### Algorithmus (`js/algorithm.js`, `js/utils.js`)
- `pickNext` / `pickPrev` zu einer gemeinsamen `_pick(…, asc)` zusammengeführt (DRY; formaler Unterschied: BPM-Delta-Richtung)
- `Math.random()` → `crypto.getRandomValues()` (kryptographisch sicher; gleiche Web-Crypto-API wie PKCE)
- Leerer `scores`-Array in `calcSortScore` gibt jetzt `50` statt `NaN`

#### Qualitäts-Tooling (neu)
- `eslint.config.js` — ESLint 9 flat config mit allen Browser-Globals; `npm run lint` → `npx eslint js/`
- `pyproject.toml` — Ruff-Config (target py311, E/W/F/I/B/UP); `cflu_server.py` B904 ausgenommen
- `.github/workflows/tests.yml` — GitHub Actions CI: `node js/cflu_tests.js` bei Push/PR

#### Pool-Builder (`CFLU_Pool_Build.py`)
- Alle Keyword-Listen als Modul-Level-Konstanten (`_SKA_TRIGGER`, `_EDM_KEYWORDS`, …)
- BPM-Gruppen als `_BPM_GROUPS`-Liste statt Inline-Kette
- `pathlib` importiert; CWD-Fix im `__main__`-Block

#### Neue Features
- **CSV-Export** (`js/app.js`, `CFLU_WOD_Builder.html`): Playlist als `CFLU_WOD_YYYY-MM-DD.csv` herunterladen (WOD + Cool-Down; UTF-8 BOM für Excel)
- **Datenschutzhinweise** (`README.md`): D-01 Chosic (Playlist temporär öffentlich), D-02 Spotify (private Playlist, Workout-Pattern)
- **Track-Metadaten-Spalten** (`css/cflu_style.css`, `js/app.js`, `CFLU_WOD_Builder.html`): 8 neue Spalten im Track-Grid — POP, VAL, DNC, ACU, INS, SPE, LVE, LOU — mit WOD-relevantem Farb-Coding; Hover über Spaltenkopf zeigt Erklärung
- **Playlist-Log Genre** (`js/app.js`): Jede Log-Zeile zeigt das zugeordnete Genre; Fallback-Tracks als `(Fallback)` markiert

#### Archivierung
- `docs/CHANGELOG.md` → `archive/CHANGELOG.md` (gitignored); Verweise in CLAUDE.md und README bereinigt

---

## Offene Punkte / Risiken

Offene Items → GitHub Issues (BACKLOG.md ist archiviert).

Bekannte Einschränkungen: `GET /audio-features` Spotify API im Development Mode nicht verfügbar — BPM/Camelot kommen ausschließlich aus lokaler Datenbasis.
