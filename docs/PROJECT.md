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
| `js/spotify.js` | Spotify PKCE Auth, Playlist-Export |
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

## Changelog

Siehe [`docs/CHANGELOG.md`](CHANGELOG.md) · Offene Items → GitHub Issues (https://github.com/nickl3ss/CFLU_Playlists/issues)

---

## Offene Punkte / Risiken

Offene Items → GitHub Issues (BACKLOG.md ist archiviert).

Bekannte Einschränkungen: `GET /audio-features` Spotify API im Development Mode nicht verfügbar — BPM/Camelot kommen ausschließlich aus lokaler Datenbasis.
