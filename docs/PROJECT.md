# PROJECT.md — CFLU WOD Playlist Builder

## Projektübersicht

Lokaler, regelbasierter Playlist-Generator für alle vier Phasen eines CrossFit-Trainings (Whiteboard, Skill, WOD, Cool-Down). Auf Basis des aktuellen Track-Pools erstellt der Builder phasenoptimierte Playlists mit Camelot-Kompatibilität, BPM-Steuerung und direktem Spotify-Export — alles lokal ohne Backend, betrieben via `cflu_server.py`. Entwickelt und genutzt für CrossFit Ludwigshafen.

---

## Architektur

### Komponenten

| ID | Name | Pfad | Verantwortung |
|----|------|------|---------------|
| C1 | Pool Builder | `CFLU_Pool_Build.py` | ETL-Pipeline: liest `Playlists/**/*.csv` rekursiv, dedup per Spotify Track-ID, schreibt `cflu_tracks.js`. Phasen: E-T-L-C-G-A-[Color]-M. Standard: Add-only (`--rebuild` für vollständigen Update). `parent_genres` intern für `classify()` benötigt, aber nicht in `cflu_tracks.js` geschrieben (`_JS_EXCLUDE_FIELDS`). |
| C2 | WOD Builder UI | `CFLU_WOD_Builder.html` + `js/` + `css/` | Haupt-UI: Song-Auswahl, Playlist-Generierung, BPM-Chart, Spotify-Export |
| C3 | Track Data | `cflu_tracks.js` | Auto-generierter Track-Pool (non-module global `TRACK_DATA`) |
| C4 | Tests | `js/cflu_tests.js` + `CFLU_Tests.html` | Kanonische Testklasse (dual-mode): `node js/cflu_tests.js` → stdout + Exit-Code; Browser: `CFLU_Tests.html` importiert und rendert. 313 Tests. |

### JS-Module (C2 intern)

| Modul | Verantwortung |
|-------|---------------|
| `js/config.js` | Konstanten: PHASE_CONFIG, BPM_RANGES, DUR_STEPS, Farb-Stops |
| `js/state.js` | Mutabler App-Zustand (currentPhase, selectedTrack, poolGenre, lockCamFilter, Token, …) |
| `js/utils.js` | Pure Helpers: bpmGroup, camCompat, calcPhaseScore, calcEraScore, calcSortScore, titleDuplicate, camelotZoneDistance, … |
| `js/genres.js` | GENRE_CONFIG: 10 Main Genres (Everynoise-derived neighbour weights), Bridge-Subgenres, Rollen-Affinität |
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
upload.js    (importiert: –; standalone &lt;script&gt; in HTML; exportierte Funktionen genutzt von cflu_tests.js)
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
| 9 | ETL-Default: Add-only statt Full-Update | Bestehende Tracks im Pool sollen durch ein reguläres Startup-Build nicht überschrieben werden — insbesondere AI-gepflegte (`open_genre=2`) und manuell gepflegte Felder (`open_genre=3`, `mood_tags`) müssen erhalten bleiben. `--rebuild` erzwingt vollständigen Update und schützt dynamische Felder explizit in `merge()`. | 2026-06-08 |
| 10 | `open_genre`-State-Machine für Genre-Herkunft | Spotify liefert Genres nur auf Artist-Ebene — manche Tracks haben keine Genres (z. B. wenig bekannte Künstler, Remixe mit anderer Artist-ID). Statt diese Tracks zu verwerfen, wird der Herkunftszustand in `open_genre` getrackt und schrittweise verbessert: Vererbung → AI → Manuell. Reherstelungssicherheit durch Preserve-Logik in `merge()`. | 2026-06-08 |
| 11 | ETL: [C] Cleanup vor [G] Genre-Vererbung und [A] AI-Genre | Doubletten-Entfernung läuft zuerst, damit kein Claude-Haiku-API-Call auf Tracks verschwendet wird, die anschließend durch Dedup entfernt werden — spart Kosten und Zeit. | 2026-06-09 |
| 12 | `genres_raw[0]` als Proxy für das entscheidende Genre-Tag | `classify()` speichert nicht, welcher `genres_raw`-Tag die Klassifikation ausgelöst hat. `genres_raw[0]` wird als Näherung für die Farb- und Fett-Darstellung im UI verwendet. Für AI-klassifizierte Tracks (`open_genre=2`) ist dies exakt. Issue #122 verfolgt die saubere Lösung. | 2026-06-09 |

---

## Theorie-Quellen

| Dokument | Inhalt | Genutzt in |
|----------|--------|-----------|
| [`references/WODability_Playlist-WodMusicTheory.md`](references/WODability_Playlist-WodMusicTheory.md) | BPM-Progressionstheorie, DJ-Norm ±5 BPM, Phasen-Energie-Fenster | #94 maxJump-Default, #80 PHASE_CONFIG |
| [`references/Genre_MatchingTheory.md`](references/Genre_MatchingTheory.md) | Genre-Kompatibilitätsmatrix, Neighbour-Graph, Bridge-Subgenres | #85–#88 genres.js |
| [`references/Genre_NetworkResearch.md`](references/Genre_NetworkResearch.md) | Datengetriebene Genre-Netzwerk-Analyse (Track-Counts, Subgenre-Verteilung, Neighbour-Graph mit Gewichtung) | #85–#88 genres.js |

## Changelog

Offene Items → GitHub Issues (https://github.com/nickl3ss/CFLU_Playlists/issues)

### 2026-06-09 — Dokumentation, Admin-Panel, Explicit-Badge, ETL-Optimierungen

#### `CFLU_WOD_Builder.html` + `css/cflu_style.css` — Admin & Info Panel (#126)

- Rechtes Panel umbenannt: „Spotify & CSV Upload" → **Admin & Info** (Tab-Button, Modal-Text, aria-label)
- Panel-Header ergänzt
- **Quellen-Sektion** hinzugefügt: Spotify, Chosic, Every Noise at Once, Claude Code — je mit Link und Kurzbeschreibung; Card-Style-Links (`.rp-source-link`)
- **Impressum-Sektion** hinzugefügt: Angaben gemäß § 5 TMG, Datenschutzhinweis (OAuth PKCE sessionStorage-only, kein Server-Speicher), Haftungsausschluss

#### `js/app.js` + `css/cflu_style.css` — Explicit-Badge (#124, #125)

- Playlist-Zeile: Songs mit `explicit: true` zeigen weißes `E`-Badge (`.explicit-badge`) als Prefix zum Titel
- Filter-Liste + Direktsuche: Optionstext zeigt `[E]` zwischen Phase-Score und Künstlername

#### `js/app.js` + `css/cflu_style.css` — Everynoise-Genre in Playlist-Zeile (#120, #121, #123)

- Neue Genre-Zeile unterhalb Artist: `<Main-Genre>: <genres_raw-Tags>` — Haupt-Genre in `var(--text2)`, erstes `genres_raw`-Tag fett in `avg_color`, weitere Tags in `var(--text2)`
- `genres_raw[0]` als farbig+fettes „Pick-Genre" (ADR 12); `t.genre` als Plaintext-Prefix
- CSS: `.tr-genres`, `.tr-genre-main`, `.tr-genre-tags`; Artist-Schrift leicht größer (`--fz-sm`), Genre-Zeile kleiner (`--fz-xs`)

#### `js/chart.js` — BPM-Tooltip (#4)

- Song-Name im Hover-Tooltip nicht mehr auf 20 Zeichen abgeschnitten — `measureText`-basierte Breite passt sich automatisch an

#### `CFLU_Pool_Build.py` — ETL-Reihenfolge + parent_genres-Strip (#117, #127)

- `[C]` Cleanup (Dedup) läuft jetzt vor `[G]` Genre-Vererbung und `[A]` AI-Genre — kein Claude-Haiku-Call auf Doubletten (ADR 11)
- `_track_for_js()`: `parent_genres` wird nicht mehr in `cflu_tracks.js` geschrieben (`_JS_EXCLUDE_FIELDS`) — im Browser ungenutzt; intern von `classify()` weiterhin verwendet

#### Architektur & Dokumentation (#128)

- `upload.js` Modul-Contract korrigiert: hat `_initUpload()` mit DOM-Zugriff; als standalone `<script>` in HTML geladen
- ETL-Phasen-Tabelle um `[*] Color Enrich` ergänzt (CLAUDE.md + PROJECT.md)
- Key Invariants 5+6: „Phase 4" → „`_pick()` stage 4" (kein UI-Phasenbuchstabe)
- ADR 11 + 12 ergänzt
- CI (`tests.yml`): `npm install` + `npm run lint` vor dem Test-Lauf

---

### 2026-06-08 — CSS-Designsystem + Launcher-Vereinfachung (#115)

#### `css/cflu_style.css`

- Vollständiges CSS-Tokensystem: `--ff-ui`, `--ff-mono`, `--fz-2xs`–`--fz-2xl` für Typography; alle Inline-Werte durch Variablen ersetzt
- Akzentfarbe `--acc` geändert: Spotify-Grün (`#1db954`) → Weiß (`#ffffff`); Spotify-Brand-Farbe in eigenständige Variablen `--spotify` / `--spotify2` ausgelagert (semantische Trennung: accent vs. Spotify-Brand)
- Sidebar-Breite: 360 px → 480 px
- Toggle: `checked`-Thumb-Farbe auf `--bg2` (statt weiß) — verbesserte Lesbarkeit auf weißem Hintergrund

#### `CFLU_Start.bat` / `CFLU_Start.sh`

- CSV-Prüf-Guard vor Pool-Build entfernt — Skripte rufen `CFLU_Pool_Build.py` immer auf; kein CSV → `_reclassify_only()` intern
- Alignt mit Key Invariant 8: „Start-Scripts always run pool build on startup"

#### `eslint.config.js`

- `getComputedStyle` als Browser-Global ergänzt (fehlte nach Nutzung in neuem CSS-Util-Code)

---

### 2026-06-08 — Ära-Score, Camelot-Lock-Toggle, Crossfade-Default (#111–#114)

#### `js/utils.js` — Ära-Score als Priorisierungsmodul (#111)

- Neue exportierte Funktion `calcEraScore(t, cur)`:
  - diff ≤ 5 Jahre → 30 Punkte (volles Fenster)
  - diff 5–15 Jahre → linearer Abfall 30 → 0
  - diff ≥ 15 Jahre → 0
  - fehlende `album_date` → 0 (kein Fehler, kein Penalty)
- Integriert als 12. Komponente in `calcSortScore()`; Kommentar-Block aktualisiert
- 13 neue Unit-Tests; Gesamtzahl: 313

#### `js/algorithm.js` + `js/state.js` — Camelot-Lock-Toggle (#113)

- Neues State-Feld `state.lockCamFilter: false`
- Neue Funktion `_camLockOk(t)`: prüft Track gegen `state.camLetter` / `state.camNumbers` wenn `lockCamFilter` aktiv
- Angewendet in `baseOk()`, `baseOkNoEnergy()`, `buildDown()`, `buildDecreasing()`, `buildPlateau()`
- UI: Toggle in Schritt 3 (`.toggle-row`-Muster); greyed-out wenn kein Tonart-Filter gesetzt
- `updateCamLockRow()` in `app.js` aktualisiert live bei Filteränderung; auto-reset bei inaktivem Filter

#### WOD Builder — Crossfade-Standard (#114)

- Spotify-Crossfade-Slider: Standardwert 0 → 20 s, Maximum 25 → 30 s
- `state.crossfadeSec` initialisiert mit 20

---

### 2026-06-08 — AI-Genre: Verbesserte Kontextualisierung + --reclassify-ai Flag (#109)

#### `CFLU_Pool_Build.py`

- **`_AI_SYSTEM_PROMPT` — Rule 3 präzisiert:** Unterscheidung zwischen explizit genre-wechselnden Remix-Labels (Club Mix, Trance Edit, EDM Remix…) und generischen Labels (Extended Mix, Shotgun Mix, Radio Edit, Remaster). Generische Labels behalten das Genre des Originalkünstlers. Behebt Fehlklassifikation von „White Wedding - Shotgun Mix" als EDM/Electronic.
- **`_AI_SYSTEM_PROMPT` — Rule 7 neu:** Bekannte Genres / Geerbte Genres als starkes Prior — Änderung nur bei explizit genre-wechselndem Remix-Label erlaubt.
- **`tag_genres_ai()` — Kontext-Anreicherung pro Track:**
  - Album + Albumjahr im Prompt
  - Bekannte Genres des Künstlers aus dem Pool (open_genre 0/2/4) — `artist_known_genres`-Dict vor der Loop
  - Geerbte Genres (open_genre=4) explizit als Prior
- **`reset_ai_genres()` (neu):** Setzt open_genre=2 → 1, leert genres_raw; open_genre=3/4 unberührt.
- **`--reclassify-ai` Flag:** Ruft `reset_ai_genres()` nach Merge auf, startet dann G+A-Phasen neu. Funktioniert in `build()` und `_reclassify_only()`.
- **`clean_song()`:** Trailing `/` aus Scraping-Artefakten wird jetzt entfernt (`.strip(' /')`).
- **Erstes Ergebnis:** 405 open_genre=2-Tracks zurückgesetzt, 412 neu klassifiziert, 0 Fehler.

---

### 2026-06-08 — ETL Extract: Bekannte IDs vor Transform überspringen (#108)

#### `CFLU_Pool_Build.py` — `build()`

- `load_existing()` wird nun zwischen [E] Extract und [T] Transform aufgerufen.
- Add-only-Modus: bereits im Pool vorhandene Spotify-IDs werden aus `extracted` gefiltert, bevor `transform()` läuft — nur echte neue Tracks werden transformiert.
- `--rebuild`-Modus: kein Skip; alle IDs aus den CSVs werden weiterhin transformiert (Preserve-Logik in `merge()` bleibt aktiv).
- [E]-Ausgabe: `Bekannte IDs: N übersprungen — M neu` wenn Tracks übersprungen wurden.
- Keine doppelte Datei-Ladung: `load_existing()` wird einmal aufgerufen und das Ergebnis für [L] Merge wiederverwendet.

---

### 2026-06-08 — Pool Builder: Genre-Management, AI-Klassifikation, ETL-Erweiterungen (#103)

#### ETL-Pipeline (`CFLU_Pool_Build.py`)

- **Add-only als Standard**: `build()` läuft standardmäßig im Ergänzungs-Modus — bestehende Tracks werden nicht verändert. `python CFLU_Pool_Build.py --rebuild` für vollständigen Update-Lauf.
- **`_reclassify_only()`**: Fallback wenn keine CSVs vorhanden — Genre-Tabellen und dynamische Felder werden auf bestehenden Tracks neu angewendet (z. B. nach Keyword-Korrekturen ohne CSV-Re-Import).
- **Start-Scripts immer aktiv**: `CFLU_Start.bat` / `CFLU_Start.sh` rufen `CFLU_Pool_Build.py` nun immer auf (vorher nur bei CSVs). Ohne CSVs → `_reclassify_only()`; bei Fehler → bestehendes `cflu_tracks.js` wird verwendet.

#### `open_genre`-Feld — State Machine

Neues Pflichtfeld in jedem Track. Dokumentiert die Herkunft der Genre-Klassifikation:

| State | Name | Bedeutung | Übergang |
|-------|------|-----------|----------|
| `0` | Spotify Find | `genres_raw` aus Spotify-CSV importiert | Grundzustand |
| `1` | No Find | Spotify hat keinen Genre zurückgegeben | Grundzustand, transient — nach vollem ETL erschöpft |
| `2` | AI Find | Claude Haiku hat Genre mit ≥99% Konfidenz bestimmt | aus `1` oder `4` |
| `3` | User Find | Manuell im Admin Panel gepflegt | aus `5` (#105) |
| `4` | Auto Find | Genre von Geschwister-Track desselben Künstlers geerbt | aus `1` |
| `5` | No AI Find | AI hat geantwortet, konnte aber nicht klassifizieren | aus `1`; `4` bleibt `4` |

**Preserve-Logik in `merge()` (rebuild-safe):** States `2`, `3`, `5` bleiben durch `--rebuild` erhalten — `genres_raw` und `genre` werden für state-2 ebenfalls restauriert. State `4` wird bei jedem Rebuild neu berechnet.

#### ETL-Phasen (E-T-L-C-G-A-M)

| Phase | Neu | Beschreibung |
|-------|-----|--------------|
| `[C]` Cleanup | ✓ | Titeldobbletten entfernen (artist+title-Key; locked=1 gewinnt) — läuft vor G+A, kein API-Call für Doubletten |
| `[G]` Genre-Vererbung | ✓ | `open_genre=1` → `4`: `genres_raw` vom gleichen Künstler erben (sucht in states `0`, `2`, `4`) |
| `[A]` AI-Genre | ✓ | `open_genre=1/4` → `2` oder `5`: Claude Haiku, 99%-Confidence-Gate, Songtitel vor Künstler priorisiert, BYOK via `anthropic_api_key.txt`; state-4 bleibt `4` bei kein Fund |

#### Bugfixes Pool Builder

- **`genres_raw` kein Pflichtfeld mehr**: Tracks ohne Spotify-Genre werden nicht mehr verworfen (Spotify liefert Genres nur auf Artist-Ebene; viele Remixe / weniger bekannte Künstler haben keine Genres).
- **Free Bird (MOONLGHT)**: War wegen leerem `genres_raw` nicht im Pool. Jetzt enthalten mit `open_genre=1` bzw. nach ETL `open_genre=2/5`.

#### Genre-Korrekturen (`classify()`)

- `dubstep`-Guard in Reggae-Check: `and 'dubstep' not in genres`
- `blues`-Substring-Guard: eigene Bedingung statt Keyword in `_BLUES_KEYWORDS` (verhindert "blues rock" → Blues & Soul)
- `new wave` aus `_ROCK_KEYWORDS` entfernt (gehört zu Pop)
- `electro swing` von `_DANCE_POP_KEYS` nach `_POP_KEYWORDS` verschoben
- Erweitert: `_PUNK_KEYWORDS`, `_EDM_KEYWORDS`, `_SYNTH_KEYWORDS`, `_METAL_KEYWORDS`, `_HIP_HOP_KEYWORDS`

#### Scoring (`js/utils.js` — `calcSortScore`)

Penalties durch bounded Rewards ersetzt; neuer `moodScore`:

| Komponente | Alt | Neu | Bereich |
|------------|-----|-----|---------|
| loudScore | Penalty (unbegrenzt) | Reward: 7 bei ΔdB=0, 0 bei ΔdB≥7 | [0, 7] |
| valScore | Penalty | Reward: 6 bei Δvalence=0, 0 bei Δ≥30 | [0, 6] |
| danceScore | Penalty | Reward: 5 bei Δdance=0, 0 bei Δ≥25 (nur Phase B/C) | [0, 5] |
| moodScore | — | Anteil gemeinsamer `mood_tags` × 8 | [0, 8] |

---

### 2026-06-08 — Everynoise Integration: datengetriebene Nachbarn + Farbmatching (#107)

#### `scripts/build_genre_config.py` (neu)

Einmaliges Build-Script, das `js/genres.js` aus Everynoise-Koordinatendaten generiert.

- Lädt `data/everynoise_genre_attrs.csv` (5 453 Genres; gecacht, kein Auto-Refresh)
- Normalisiert `x`, `y` per Min-Max über alle Genres (y-Achse sonst 10× dominanter als x)
- Berechnet 5D-Centroids pro Haupt-Genre (x_n, y_n, R_n, G_n, B_n) aus gematchten `genres_raw` aller Tracks
- 5D-Distanz: `√(Δx² + Δy² + 0.5·ΔR² + 0.5·ΔG² + 0.5·ΔB²)` — Farbe mit Gewicht 0.5
- Nachbar-Gewichtung rank-basiert: 1→1.0, 2→0.7, 3+→0.5; min. 3, max. 5 Nachbarn
- **Deutsche Musik override**: kulturelle/sprachliche Nähe ≠ sonische in Everynoise; Nachbarn bleiben manuell kuratiert
- Coverage-Report: 79% aller `genres_raw`-Tags in Everynoise gefunden
- Rebuild: `python scripts/build_genre_config.py` (--refresh erzwingt Re-Download)

**Everynoise-Datenquelle:** `data/everynoise_genre_attrs.csv` — gecacht, im Repo getrackt für reproduzierbare Offline-Builds. Schema: `genre, x, y, hex_colour`.

#### `CFLU_Pool_Build.py` — `enrich_colors()`

Neuer ETL-Schritt nach [C] Cleanup (beide Pfade: `build()` + `_reclassify_only()`):

- Berechnet `avg_color` pro Track = Mittelwert-RGB aller gematchten `genres_raw`-Farben aus Everynoise
- 3-Phasen-Matching: exakt → Bindestrich-Normalisierung → Wort-Split (z. B. "schwedischer pop" → "pop")
- 90% der Tracks erhielten `avg_color`; Rest: `null` (kein Match → kein Fehler, kein colorScore)

#### `js/utils.js` — `colorScore` in `calcSortScore`

Neue Scoring-Komponente:

| Komponente | Bereich | Formel |
|------------|---------|--------|
| colorScore | [0, 10] | `10 × (1 − RGB-Distanz / √3)` — belohnt ähnliche Everynoise-Farbe |

Gibt 0 wenn `avg_color` auf Kandidat oder `cur` fehlt — kein Fehler, kein Einfluss.

#### Taxonomie-Cleanup (#106-Folgearbeit)

- `js/config.js`: `GERMAN_GENRES` auf `['Deutsche Musik']` aktualisiert (war noch alte Namen)
- `pyproject.toml`: `CFLU_Pool_Build.py` zu B904-Ausnahmen hinzugefügt (gleicher intentionaler Re-raise-Pattern wie cflu_server.py)

---

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
- `docs/CHANGELOG.md` → `archive/` (gitignored, lokal als Referenz); Verweise in CLAUDE.md und README bereinigt

---

## Offene Punkte / Risiken

Offene Items → GitHub Issues (BACKLOG.md ist archiviert).

Bekannte Einschränkungen: `GET /audio-features` Spotify API im Development Mode nicht verfügbar — BPM/Camelot kommen ausschließlich aus lokaler Datenbasis.
