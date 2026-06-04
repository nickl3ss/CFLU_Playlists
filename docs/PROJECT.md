# PROJECT.md — CFLU WOD Playlist Builder

## Projektübersicht

Lokaler, regelbasierter Playlist-Generator für alle vier Phasen eines CrossFit-Trainings (Whiteboard, Skill, WOD, Cool-Down). Auf Basis von 3.313 Spotify-Tracks erstellt der Builder phasenoptimierte Playlists mit Camelot-Kompatibilität, BPM-Steuerung, Audio-Preview und direktem Spotify-Export — alles lokal ohne Backend, betrieben via Python HTTP-Server. Entwickelt und genutzt für CrossFit Ludwigshafen.

---

## Architektur

### Komponenten

| ID | Name | Pfad | Verantwortung |
|----|------|------|---------------|
| C1 | Pool Builder | `CFLU_Pool_Build.py` | Liest `Spotify_Source.xlsx`, bereinigt Duplikate, klassifiziert Genres, schreibt `cflu_tracks.js` |
| C2 | WOD Builder UI | `CFLU_WOD_Builder.html` + `js/` + `css/` | Haupt-UI: Song-Auswahl, Playlist-Generierung, BPM-Chart, Spotify-Export |
| C3 | Track Data | `cflu_tracks.js` | Auto-generierter Track-Pool (3.313 Tracks, ~874 KB, non-module global `TRACK_DATA`) |
| C4 | Tests | `CFLU_Tests.html` | Browser-Test-Suite (160 Tests, 21 Suiten, importiert echte JS-Module) |

### JS-Module (C2 intern)

| Modul | Verantwortung |
|-------|---------------|
| `js/config.js` | Konstanten: PHASE_CONFIG, GENRE_NEIGHBOURS, BPM_RANGES, Farb-Stops |
| `js/state.js` | Mutabler App-Zustand (currentPhase, selectedTrack, Token, …) |
| `js/utils.js` | Pure Helpers: bpmGroup, camCompat, calcPhaseScore, lerpColor, … |
| `js/algorithm.js` | Kern: pickNext, buildUp, buildDown, buildPlateau, buildDecreasing |
| `js/chart.js` | BPM-Step-Chart + bidirektionale Hover-Synchronisation |
| `js/spotify.js` | Spotify PKCE Auth, Playlist-Export, Audio-Preview |
| `js/app.js` | UI-Handler, _gen(), renderResult(), Event-Wiring, Init |

### Abhängigkeiten

```
cflu_tracks.js  (non-module global, lädt zuerst → TRACK_DATA global)
     ↓
config.js
     ↓
utils.js   (importiert: config.js)
     ↓
algorithm.js (importiert: config.js, state.js, utils.js)
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
| 2 | `cflu_tracks.js` als non-module global `<script>` | ~874 KB Track-Pool; non-module erlaubt lazy Zugriff aus ES-Modulen ohne Top-Level-Import; importierbar in Tests ohne echte Daten | 2025 |
| 3 | Spotify PKCE ohne Backend | Kein Server nötig; Client ID bleibt lokal; Development Mode reicht für Einzelnutzer | 2024 |
| 4 | Python `http.server` als lokaler Server | Kein Setup; Spotify OAuth benötigt `http://`-Redirect (kein `file://`) | 2024 |
| 5 | cflu_tracks.js im Repo (obwohl generiert) | Vollständige Nutzbarkeit nach Clone ohne Pool-Rebuild-Pflicht; nach xlsx-Update neu committen | 2025 |

---

## Changelog

| BL-ID | Titel | Datum | Commit |
|-------|-------|-------|--------|
| – | v1.0: Initiale Version — EDM-spezifischer Builder mit eingebetteter EDM-Liste | – | – |
| – | v2.0: Gesamtliste (3.347 Tracks), 13 Genre-Gruppen, Spotify PKCE Export | – | – |
| – | v2.1: Ref/Peak Modi, Suchfunktion alle Genres, Camelot-Priorität | – | – |
| – | v2.2: ±BPM Toleranz-Regler, Titeldedup, Camelot-Zonierung | – | – |
| – | v3.0: Song-zuerst-Workflow, Positions-Ampel, farbige Regler, Hover-Sync Chart↔Liste, Spotify-Link pro Track, Cool-Down Dauer, 3.314 Tracks | – | – |
| – | v3.1: WOD-Typ-Slider, BPM-Chart Stufen-Visualisierung + Zeitachse + WOD-Ende-Marker, Spotify-Setup-Anleitung, Test-Suite | – | – |
| – | v4.0: Klassen-Phase A/B/C/D, Unified Scoring System, 8 neue Audio-Feature-Felder, cflu_tracks.js extern, CFLU_Start.bat, Phase-Match-Score Badge, Audio-Preview, Genre-Nachbarn-Fallback, 3.313 Tracks | – | – |
| – | v4.1: ES-Module-Refactor (7 Module: config/state/utils/algorithm/chart/spotify/app), kein Inline-JS, Test-Suite importiert echte Module, registerTrack konsolidiert, Slider-Thumb via CSS Custom Property, Chart-Resize debounced, cflu_client_id.txt | – | – |
| – | v4.2: Tonart-Filter (Camelot-Buchstaben-Slider + Zahlenfeld mit Wrap-around), Blues & Soul Genre-Gruppe, GENRE_NEIGHBOURS vollständig, 129 Tests / 18 Suiten | – | – |
| – | v4.3: Startup Login Modal (auto-vorausgefüllt, abbrechbar, ESC/Backdrop), Generierungs-Log (kopierbares Textfeld, Einstellungen/Pool/Track-Entscheidungen/Zusammenfassung), tolDefault phasenspezifisch (A=±10/B=±25/C=±35/D=±20), Toleranz-Slider max=40, Chosic als Datenbasis-Quelle dokumentiert, 160 Tests / 21 Suiten | 2026-06 | 01db4cf |
| – | chore: Methodik-Workflow integriert (CLAUDE.md, BACKLOG.md, docs/PROJECT.md, .github/ISSUE_TEMPLATE) | 2026-06-04 | b941e3f |
| – | v5.0: Methodik-Workflow aktiviert — .gitignore korrigiert (war ohne Punkt, nie aktiv), README aktualisiert, BACKLOG.md mit BL-001–BL-003 befüllt | 2026-06-04 | – |

---

## Offene Punkte / Risiken

- BL-001 · `buildDown()` Dauer-Ziel nicht immer exakt — P3 Mittel
- BL-002 · Direktsuche Genre-Dropdown nach Auswahl nicht korrekt gesperrt — P4 Niedrig
- BL-003 · BPM-Chart Tooltip Song-Name vollständig anzeigen — P4 Niedrig
- Blues & Soul: Genre-Gruppe implementiert, Tracks erscheinen erst nach nächstem Pool-Rebuild (Quelldaten fehlen noch)
- `GET /audio-features` Spotify API im Development Mode nicht verfügbar — BPM/Camelot kommen ausschließlich aus lokaler Datenbasis
