# PROJECT.md — CFLU WOD Playlist Builder

## Projektübersicht

Lokaler, regelbasierter Playlist-Generator für alle vier Phasen eines CrossFit-Trainings (Whiteboard, Skill, WOD, Cool-Down). Auf Basis des aktuellen Track-Pools erstellt der Builder phasenoptimierte Playlists mit Camelot-Kompatibilität, BPM-Steuerung, Audio-Preview und direktem Spotify-Export — alles lokal ohne Backend, betrieben via Python HTTP-Server. Entwickelt und genutzt für CrossFit Ludwigshafen.

---

## Architektur

### Komponenten

| ID | Name | Pfad | Verantwortung |
|----|------|------|---------------|
| C1 | Pool Builder | `CFLU_Pool_Build.py` | Liest `Spotify_Source.xlsx`, bereinigt Duplikate, klassifiziert Genres, schreibt `cflu_tracks.js` |
| C2 | WOD Builder UI | `CFLU_WOD_Builder.html` + `js/` + `css/` | Haupt-UI: Song-Auswahl, Playlist-Generierung, BPM-Chart, Spotify-Export |
| C3 | Track Data | `cflu_tracks.js` | Auto-generierter Track-Pool (non-module global `TRACK_DATA`) |
| C4 | Tests | `CFLU_Tests.html` | Browser-Test-Suite (160 Tests, 21 Suiten, importiert echte JS-Module) |

### JS-Module (C2 intern)

| Modul | Verantwortung |
|-------|---------------|
| `js/config.js` | Konstanten: PHASE_CONFIG, GENRE_NEIGHBOURS, BPM_RANGES, Farb-Stops |
| `js/state.js` | Mutabler App-Zustand (currentPhase, selectedTrack, poolGenre, Token, …) |
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
| 2 | `cflu_tracks.js` als non-module global `<script>` | Track-Pool; non-module erlaubt lazy Zugriff aus ES-Modulen ohne Top-Level-Import; importierbar in Tests ohne echte Daten | 2025 |
| 3 | Spotify PKCE ohne Backend | Kein Server nötig; Client ID bleibt lokal; Development Mode reicht für Einzelnutzer | 2024 |
| 4 | Python `http.server` als lokaler Server | Kein Setup; Spotify OAuth benötigt `http://`-Redirect (kein `file://`) | 2024 |
| 5 | cflu_tracks.js im Repo (obwohl generiert) | Vollständige Nutzbarkeit nach Clone ohne Pool-Rebuild-Pflicht; nach xlsx-Update neu committen | 2025 |
| 6 | state.poolGenre als SSOT für Generations-Pool-Genre | genre-sel steuert nur Filter-Modus; Direktsuche und Spotify-Link setzen poolGenre aus t.genre; externer Track: manueller Dropdown | 2026-06-06 |
| 7 | Direktsuche ohne Camelot-/Energy-Filter | Referenz-Song-Auswahl soll nicht durch Generierungs-Filter eingeschränkt werden; Filter-Modus hat eigene gefilterte Liste | 2026-06-06 |

---

## Changelog

Siehe [`docs/CHANGELOG.md`](CHANGELOG.md) · Offene Items → [`BACKLOG.md`](../BACKLOG.md)

---

## Offene Punkte / Risiken

Offene Items → [`BACKLOG.md`](../BACKLOG.md) (BL-001–BL-003)

Bekannte Einschränkungen: `GET /audio-features` Spotify API im Development Mode nicht verfügbar — BPM/Camelot kommen ausschließlich aus lokaler Datenbasis. Blues & Soul Genre-Gruppe implementiert, Tracks erscheinen erst nach nächstem Pool-Rebuild.
