# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Lokaler Playlist-Generator für WOD-Begleitung  
> Standalone HTML-Anwendung · Python HTTP Server · Spotify PKCE Export

---

## Projektübersicht

Ein lokal laufender WOD Playlist Builder für CrossFit Ludwigshafen. Auf Basis einer bereinigten Spotify-Trackliste (3.313 Songs, 17 Felder) erstellt der Builder phasenbasierte WOD-Playlists mit Camelot-Kompatibilität, BPM-Steuerung, Audio-Preview und direktem Spotify-Export.

### Technologie-Stack

| Komponente | Technologie |
|---|---|
| Frontend | Vanilla HTML + CSS (extern) + ES-Module JavaScript |
| Datenbasis | Externe JS-Datei `cflu_tracks.js` (~874 KB, 3.313 Tracks, non-module global) |
| Charts | Canvas 2D (eigene Implementierung) |
| Fonts | Google Fonts (IBM Plex Mono, Barlow Condensed) |
| Server | Python `http.server` (lokal) |
| Auth | Spotify PKCE OAuth 2.0 (kein Backend) |
| Datenbuild | Python 3 (pandas, json) |
| Tests | Browser-Test-Suite (`CFLU_Tests.html`, ~100 Tests, importiert echte Module) |

### Dateien

```
CFLU_WOD_Builder.html       ← Markup only — kein Inline-JS, keine Inline-Handler
cflu_tracks.js              ← Datenbasis (auto-generiert, ~874 KB, setzt TRACK_DATA global)
cflu_client_id.txt          ← Spotify Client ID (lokal, gitignored)
CFLU_Tests.html             ← Browser-Test-Suite (~100 Tests, importiert js/-Module)
CFLU_Start.bat              ← Windows Starter (Pool-Build + Server + Browser)
CFLU_Pool_Build.py          ← Datenbasis-Generator (aus Spotify Source.xlsx)
Spotify Source.xlsx         ← Quelldaten (nicht im Repo — lokal ablegen)
CFLU_WOD_Builder_PROJECT.md ← Diese Datei
README.md                   ← Kurzanleitung

css/
  cflu_style.css            ← Alle Styles (aus HTML extrahiert)

js/
  config.js                 ← Konstanten: PHASE_CONFIG, GENRE_NEIGHBOURS, BPM_RANGES, Slider-Farben
  state.js                  ← Mutierbarer App-Zustand (einzelnes exportiertes Objekt)
                               Felder: currentPhase, selMode, selectedTrack, position,
                               maxJump, bpmTol, camLetter, camNumbers, wodMinutes,
                               cdActive, cdMinutes, wodEnergyMin/Max, generatedWod/Cd,
                               spToken, spUserId, hoveredTrackIdx, bpmChartData, …
  utils.js                  ← Reine Hilfsfunktionen: bpmGroup, camCompat, calcPhaseScore, lerpColor …
  algorithm.js              ← Kern-Algorithmus: pickNext, buildUp, buildDown, buildPlateau, buildDecreasing
  chart.js                  ← BPM-Step-Chart + bidirektionale Hover-Synchronisation
  spotify.js                ← Spotify PKCE Auth, Playlist-Export, Audio-Preview
  app.js                    ← UI-Handler, _gen(), renderResult(), Event-Wiring, Init
```

---

## Lokaler Start

### Voraussetzungen

- Python 3.x installiert, im PATH
- Alle Dateien im gleichen Ordner

### Start

```batch
CFLU_Start.bat
```

Die BAT-Datei:
1. Prüft ob `CFLU_WOD_Builder.html` vorhanden ist
2. Prüft ob Python installiert ist
3. Prüft ob Port 8888 frei ist
4. Startet `python -m http.server 8888`
5. Öffnet `http://127.0.0.1:8888/CFLU_WOD_Builder.html` automatisch im Browser

### Manuell

```bash
cd /pfad/zum/ordner
python -m http.server 8888
# Browser: http://127.0.0.1:8888/CFLU_WOD_Builder.html
```

---

## Spotify-Integration

### Einmalige Einrichtung

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → App erstellen
2. API-Typ: **Web API** auswählen
3. Settings → Redirect URI eintragen: `http://127.0.0.1:8888/CFLU_WOD_Builder.html`
4. Client ID aus den App-Settings kopieren

### Pro Session

- Client ID liegt in `cflu_client_id.txt` (lokal, gitignored) → wird beim Start **automatisch geladen**
- Alternativ: Client ID manuell im Builder eingeben (wird **nicht in localStorage gespeichert**)
- "Verbinden" → PKCE OAuth Flow
- Scopes: `playlist-modify-public`, `playlist-modify-private`
- Export via `POST /me/playlists` + `POST /playlists/{id}/items`
- Hartes Limit: **100 Tracks** (Spotify API) — Warnung bei Überschreitung

### API-Einschränkungen (Stand Februar 2026)

- `GET /audio-features` ist im Development Mode **nicht verfügbar** — BPM/Camelot kommen ausschließlich aus der lokalen Datenbasis
- Development Mode: max. 25 User pro App (ausreichend für Einzelnutzer)
- Redirect URI muss exakt `http://127.0.0.1:8888/CFLU_WOD_Builder.html` lauten

---

## Datenbasis

### Quelle

`Spotify Source.xlsx` (auch `Spotify_Source.xlsx`) — Song-Metadaten exportiert via **Chosic Spotify Playlist Analyzer**:

> **https://www.chosic.com//spotify-playlist-analyzer/**

Der Analyzer liefert eine CSV-Datei pro Playlist mit allen 17 Feldern (BPM, Camelot, Energy, Dance, Valence, Acoustic, Instrumental, Speech, Live, Loud, Popularity u.a.), die direkt der Spaltenstruktur entsprechen, die `CFLU_Pool_Build.py` erwartet. Neue Songs aus beliebigen Spotify-Playlists können so ohne manuelle Datenaufbereitung hinzugefügt werden.

**Workflow zum Erweitern der Datenbasis:**
1. Playlist in Spotify öffnen
2. Playlist-URL in den Chosic Analyzer einfügen
3. CSV exportieren
4. CSV-Inhalte in `Spotify Source.xlsx` einfügen (gleiche Spaltenstruktur)
5. `CFLU_Pool_Build.py` ausführen (oder App via `CFLU_Start.bat` starten)

`CFLU_Start.bat` führt `CFLU_Pool_Build.py` automatisch aus, falls die Quelldatei vorhanden ist.

### Felder pro Track (v4 — 17 Felder)

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | string | Spotify Track ID |
| `song` | string | Songtitel |
| `artist` | string | Interpret(en), kommagetrennt |
| `bpm` | int | Beats per Minute |
| `camelot` | string | Camelot Key (z.B. `9B`, `11A`) |
| `energy` | int | Spotify Energy 0–100 |
| `dur` | int | Dauer in Sekunden |
| `genre` | string | Genre-Gruppe (klassifiziert) |
| `bpmg` | string | BPM-Gruppe A–I |
| `dance` | int | Spotify Danceability 0–100 |
| `valence` | int | Spotify Valence (Positivität) 0–100 |
| `acoustic` | int | Spotify Acousticness 0–100 |
| `instrumental` | int | Spotify Instrumentalness 0–100 |
| `speech` | int | Spotify Speechiness 0–100 |
| `live` | int | Spotify Liveness 0–100 |
| `loud` | int | Spotify Loudness (dB, typisch –26 bis 0) |
| `popularity` | int | Spotify Popularity 0–100 |

### Bereinigung (CFLU_Pool_Build.py)

- Akzeptiert beide Dateinamen: `Spotify Source.xlsx` und `Spotify_Source.xlsx`
- Ausgabe: `cflu_tracks.js` mit `const TRACK_DATA={...};` (kein manuelles Einbetten mehr)
- Duplikate entfernen: gleicher Artist + normalisierter 15-Zeichen-Titelkey + BPM ±1 + gleicher Camelot
- Suffix-Strip vor Titelvergleich: `Radio Edit`, `Single Edit`, `Extended Mix`, `Remix`, `Remastered`, `Live`, `Acoustic` u.ä.
- Bei Duplikat: höhere Energy behalten, bei Gleichstand längere Duration
- Ergebnis: **3.313 unique Tracks** (Stand aktueller Build)

### Genre-Gruppen

| Genre | Tracks | Ø BPM | Ø Energy |
|---|---|---|---|
| Rock | 693 | 122 | 69 |
| EDM / Electronic | 649 | 133 | 81 |
| Pop & New Wave | 504 | 112 | 69 |
| Ska & Reggae | 281 | 129 | 79 |
| Synthwave / Electronica | 255 | 121 | 74 |
| Moderne Deutsche Musik (ab 2000) | 239 | 123 | 72 |
| Hip Hop & R&B | 169 | 114 | 72 |
| Metal & Hard Rock | 162 | 123 | 79 |
| Punk | 160 | 140 | 85 |
| Funk & Disco | 112 | 116 | 72 |
| Deutschrock / NDW / Schlager (vor 2000) | 89 | 121 | 64 |
| Blues & Soul | 0* | — | — |
| **Alle Deutschen Tracks** | 328 | 122 | 69 |
| **Going Wild (alle)** | 3.313 | 122 | 74 |

*Alle Deutschen Tracks und Going Wild sind virtuelle Gruppen — keine eigenen Datensätze*
*Blues & Soul: Genre-Gruppe und Klassifizierungslogik sind implementiert. Tracks erscheinen nach dem nächsten Pool-Build (CFLU_Pool_Build.py).*

### BPM-Gruppen

| Stufe | Bereich | Kontext |
|---|---|---|
| A | 0–89 | Cool-Down / Ambient |
| B | 90–109 | Warm-Up |
| C | 110–119 | Moderat |
| D | 120–129 | WOD-Einstieg |
| E | 130–139 | WOD Mid |
| F | 140–149 | WOD High |
| G | 150–159 | Peak |
| H | 160–174 | Finisher |
| I | 175+ | Maximum |

**Sprungregeln:** Innerhalb einer Gruppe ✅ · ±1 Gruppe ✅ · ±2 Gruppen ❌ · Rückwärts (BPM sinkt) ❌

---

## Anwendungslogik

### Workflow (4 Schritte)

```
Klassen-Phase wählen (Schritt 0)
    ├── A: Whiteboard & Prep  → Plateau, BPM 90–110, ruhig, instrumental
    ├── B: Skill & Strength   → sanft aufsteigend, BPM 80–130, moderat
    ├── C: WOD — Intensiv     → aufsteigend BPM, max. Performance [Standard]
    └── D: Cool-Down          → absteigend/plateau, BPM 60–100, Erholung
    → Setzt Energy-Bereich, BPM-Slider, Toleranz und maxJump automatisch vor
    → Zeigt Phase-Match-Score [0-100] neben jedem Track in der Auswahl

Schritt 1: Song wählen
    ├── Weg A: Genre + BPM-Slider + Toleranz ± BPM + Textsuche
    ├── Weg B: Direktsuche (in aktivem Genre, gefiltert nach Phase)
    └── Weg C: Spotify-Link → Track ID → Pool suchen / manuelle Eingabe
    → Alle Suchlisten zeigen Phase-Match-Score und sind danach sortiert
    → Tonart-Filter (optional): Buchstaben-Slider A / Beide / B +
      Zahlenfeld (Einzel, kommagetrennt oder Bereiche mit Wrap-around, z.B. "8-11", "11-2")
      wirkt auf alle drei Suchmodi

Schritt 2: Position wählen (nur für Phase B und C)
    ├── Start       → Song als #1, Playlist steigt aufwärts
    ├── Ende        → Song als letzter Track, Playlist baut sich auf
    ├── Midpoint    → Song bei ~50%, davor aufsteigend, danach weiter
    └── Mid Plateau → Song bei ~50%, danach BPM-Band konstant
    + Positions-Ampel: BPM · Camelot · Gesamt · Phase Fit

Schritt 3: Einstellungen
    ├── WOD-Dauer: 5–240 min (Standard phase-abhängig)
    ├── Max. BPM-Sprung: +5–+20 BPM (Standard phase-abhängig)
    └── Cool-Down: Toggle + Dauer 5–60 min
        → Phase D + Cool-Down: Recovery-Sektion + nachgelagerter Cool-Down
```

### Klassen-Phase — Konfiguration

| Phase | BPM | Energy | Valence | Dance | Instrumental | Speech | Acoustic | Loud (dB) | BPM-Verlauf | Toleranz | Max-Sprung |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A Whiteboard | 90–110 | 30–55 | 50–80 | 30–60 | ≥40 | ≤20 | ≥30 | ≤–10 | Plateau | ±10 | +5 |
| B Skill | 80–130 | 55–78 | 35–65 | 35–65 | ≥25 | ≤25 | 5–40 | –10 bis –5 | Sanft aufsteigend | ±25 | +7 |
| C WOD | 125–195 | 70–100 | 60–90 | 60–80 | ≤25 | — | ≤10 | ≥–8 | Aufsteigend (BPM-Build) | ±35 | +10 |
| D Cool-Down | 60–100 | 0–50 | 40–70 | ≤45 | ≥50 | — | ≥40 | ≤–10 | Absteigend | ±20 | +8 |

*Bereichsgrenzen sind Scoring-Schwellen (Penalty), keine harten Filter — Phase 4-Fallback ignoriert sie.*
*Toleranz und Max-Sprung: phasenspezifische Defaults in `PHASE_CONFIG` (`tolDefault`, `maxJumpDefault`); Slider-Bereich ±BPM-Toleranz: 1–40.*

### Genre-Nachbarn (Fallback bei zu kleinem Pool)

```
Rock                          → Pop & New Wave · Metal & Hard Rock · Funk & Disco · Blues & Soul
EDM / Electronic              → Synthwave / Electronica · Pop & New Wave
Pop & New Wave                → Rock · Synthwave / Electronica · Funk & Disco
Punk                          → Rock · Metal & Hard Rock · Ska & Reggae
Ska & Reggae                  → Punk · Funk & Disco · Pop & New Wave
Metal & Hard Rock             → Rock · Punk
Moderne Deutsche Musik        → Deutschrock / NDW / Schlager · Pop & New Wave · Rock
Deutschrock / NDW / Schlager  → Moderne Deutsche Musik · Rock · Pop & New Wave
Hip Hop & R&B                 → Funk & Disco · Pop & New Wave · Blues & Soul
Synthwave / Electronica       → EDM / Electronic · Pop & New Wave
Funk & Disco                  → Hip Hop & R&B · Pop & New Wave · Rock · Blues & Soul
Blues & Soul                  → Funk & Disco · Hip Hop & R&B · Rock
Alle Deutschen Tracks         → Rock · Pop & New Wave
Going Wild                    → (kein Fallback — enthält bereits alle Tracks)
```

Mindest-Poolgröße: **15 Tracks**. Bei Unterschreitung werden Nachbar-Genres hinzugezogen und ein Hinweis angezeigt.

### Positions-Ampel — BPM-Referenzwerte

| Position | 🟢 Grün | 🟡 Gelb | 🔴 Rot |
|---|---|---|---|
| Start | 110–145 | 90–109 / 146–160 | <90 / >160 |
| Ende | 155–190 | 145–154 / 191–205 | <145 / >205 |
| Midpoint | 130–165 | 115–129 / 166–180 | <115 / >180 |
| Mid Plateau | 130–165 | 115–129 / 166–180 | <115 / >180 |

### Positions-Ampel — Camelot-Bewertung

| Zone | Keys | Ampel |
|---|---|---|
| Zone 1 (WOD-Kern) | 8B, 9B, 10B, 11B, 12B, 1B | 🟢 Grün |
| Zone 2 (Ergänzung) | 8A, 9A, 10A, 11A, 12A, 1A | 🟡 Gelb |
| Zone 3 (Schwach) | 2A–7B | 🔴 Rot |

---

## Algorithmus

### Camelot-Kompatibilitätsregeln

| Priorität | Regel | Beispiel |
|---|---|---|
| 🟢 Prio 1 (Grün) | Gleiche Zahl A↔B | 9A→9B |
| 🟢 Prio 1 (Grün) | ±1 Zahl, gleicher Buchstabe | 9B→10B |
| 🟢 Prio 1 (Grün) | Wrap-around 12↔1, gleicher Buchstabe | 12B→1B |
| 🟡 Prio 2 (Gelb) | +2 Zahl, gleicher Buchstabe (Energie-Boost) | 9B→11B |
| 🟡 Prio 2 (Gelb) | -2 Zahl, gleicher Buchstabe (nur wenn BPM steigt) | 11B→9B |
| 🔴 Fallback (Rot) | Alles andere + BPM-Eskalation | — |

### Track-Auswahl (pickNext)

```
1. Basis-Filter (baseOk):
   - Nicht bereits verwendet (usedIds)
   - BPM >= aktueller Track
   - BPM-Sprung <= maxJump (phase-abhängig)
   - BPM-Gruppe: max ±1 Stufe
   - Titel-Key nicht in usedTitleKeys (15-Zeichen normalisiert, Suffixe entfernt)
   - Interpret max. 10% der Playlist (min. 1)
   - Energy im Phase-Bereich (wodEnergyMin / Max)

2. Kandidaten-Selektion (Phasen):
   Phase 1: Camelot grün + Zone 1/2
   Phase 2: Camelot grün (ohne Zonen-Einschränkung)
   Phase 3: Camelot gelb
   Phase 4: BPM-Eskalation (+5 Schritte bis +40, Camelot lockern, Energy-Filter entfällt)

3. Sortierung — Unified Sort Score (höher = besser):
   score = camelot_points + phase_score*2 + energy + bpm_efficiency
   camelot: grün=200, gelb=100, rot=0
   phase_score: 0–100 × 2 = 0–200 (Ø aller Attribut-Scores für aktive Phase)
   energy: 0–100 (direkter Wert)
   bpm_efficiency: –(BPM-Sprung) (kleinere Sprünge bevorzugt)
```

### Unified Scoring System

#### Per-Attribut-Score (`attrScore`)

Für jeden Track-Attribut einer Phase wird ein Score 0–100 berechnet:
- Wert **im Zielbereich** → **100 Punkte**
- Wert **außerhalb**: `max(0, 100 - Abstand_vom_Bereich × 3)`
  - 1 Einheit außerhalb → 97 Punkte
  - 10 Einheiten außerhalb → 70 Punkte
  - 34+ Einheiten außerhalb → 0 Punkte

#### Phase-Match-Score (`calcPhaseScore`, 0–100)

Durchschnitt aller Per-Attribut-Scores für die gewählte Phase:
```
score_A = Ø(bpm, energy, valence, dance, instrumental, speech, acoustic, loud)
score_B = Ø(bpm, energy, valence, dance, instrumental, speech, acoustic, live, loud)
score_D = Ø(bpm, energy, valence, dance, instrumental, acoustic, loud)
score_C = Bonus-System: energy≥82(+20), valence 60-90(+15), dance 60-80(+10), loud≥-8(+10)
```

Der Phase-Match-Score wird in der **Track-Liste** als farbiger Badge angezeigt (🟢≥80 · 🟡50–79 · 🔴<50) und in der **Such-Dropdown** als `[Score]` Präfix. Er fließt mit Gewicht ×2 in den Sort-Score ein.

#### Algorithmen nach Phase

| Phase | Algorithmus | Position-Wahl |
|---|---|---|
| A | `buildPlateau()` — Tracks in ±12 BPM Band, sortiert nach Phase-Score | Nicht angezeigt (Plateau automatisch) |
| B | `buildUp()` + `buildDown()` — sanfter Aufbau (kleinerer maxJump) | Alle 4 Positionen |
| C | `buildUp()` + `buildDown()` — normaler Aufbau | Alle 4 Positionen |
| D | `buildDecreasing()` — BPM sinkt über Playlist | Nicht angezeigt (Start automatisch) |

#### Cool-Down (Phase D + Cool-Down-Toggle)

- Phasen-Pool mit Phase D-Kriterien (energy ≤ 50, bpm 60–100, instrumental ≥ 50, acoustic ≥ 40, loud ≤ –10)
- Sortierung nach Phase-D-Score
- Fallback auf Nachbar-Genres wenn Pool < 3 Tracks
- Bei Phase D + Toggle: Recovery-Sektion (70–85% des Phase-D-BPM) + echter Cool-Down danach

### Cool-Down

- Phase-D-Kriterien (energy ≤ 50, bpm ≤ 70–85% des WOD-Peaks)
- Sortiert nach Phase-D-Score (nicht mehr nach reinem BPM-Aufstieg)
- Fallback via Genre-Nachbarn wenn Pool zu klein
- Keine Camelot-Regel

### Interpret-Begrenzung

- Max. 10% der WOD-Tracks pro Interpret (erster Name im Artist-Feld)
- Mindestens 1 Track immer erlaubt
- `floor(trackCount * 0.1)` gerundet nach unten

---

## UI-Komponenten

### Regler mit Farbskalen

**WOD-Typ-Regler (0–100):**
- Stahlblau (0): Skill / Strength · E: 28–70
- Grün (50): Mixed · E: 50–85 [Standard]
- Rot (100): Intensity WOD · E: 72–100

**BPM-Sprung-Regler (5–20 BPM):**
- Grün: 8–15 (Idealbereich)
- Gelb: 5–7 / 16–18 (Übergang)
- Rot: <5 / >18

**Ziel-BPM-Regler (60–220):**
- Grün: 120–170 (WOD-Idealbereich)
- Gelb: 90–119 / 171–185 (Übergang)
- Rot: <90 / >185

*Implementierung: dynamischer CSS-Gradient auf `slider.style.background` + Thumb-Farbe via `--thumb-color` CSS Custom Property (ererbt von Pseudo-Element `::-webkit-slider-thumb`). Regler ohne eigene Farblogik nutzen `var(--bg5)` als Standard-Track-Farbe.*

### BPM-Verlauf Chart

- **Stufen-Chart (Step Chart):** Jeder Track wird als waagerechtes Segment dargestellt — die Breite entspricht der Song-Dauer. An Übergängen zwischen Tracks springt die Linie senkrecht auf das nächste BPM-Niveau.
- **Feste Höhe:** `10vh` (min. 70px) — kein dynamisches Wachstum
- **X-Achse:** Zeitbasiert in Minuten, dynamisches Intervall je nach Gesamtdauer:
  - < 10 min → 1:00-Ticks · 10–20 min → 2:00 · 20–50 min → 5:00 · > 50 min → 10:00
- **WOD-Ende-Marker:** Graublauer vertikaler Balken bei der konfigurierten WOD-Dauer — immer sichtbar (unabhängig von Cool-Down)
- WOD-Bereich: grün · Cool-Down: lila · Farbsplit zeitbasiert (nach `wodDur / totalDur`)
- **Hover Track-Zeile → Chart:** weißer Ring + gestrichelte Vertikallinie
- **Hover Chart-Punkt → Track-Zeile:** weiße Umrandung + Auto-Scroll
- Tooltip: BPM + Songtitel (gekürzt auf 20 Zeichen)
- Canvas-Größe beim Zeichnen aus `offsetWidth/offsetHeight` — korrekt da result-area vor `drawChart()` sichtbar gemacht wird

### Track-Liste

- Separat scrollbar (`overflow-y: auto`, max-height: 360px)
- Format: `# · Interpret — Song — BPM (+Δ) — Camelot — Energy — Dauer`
- Camelot-Dot: 🟢 grün / 🟡 gelb / 🔴 rot
- Referenz-Track: grün hinterlegt + "REF" Badge
- Spotify-Icon pro Track → öffnet `https://open.spotify.com/track/{id}`
- Cool-Down: lila Trennlinie + separater Block

### Startup Login Modal

- Erscheint beim Laden der Seite (nach `cflu_client_id.txt`-Fetch, sobald Client ID bekannt ist)
- Client ID ist automatisch vorausgefüllt, falls `cflu_client_id.txt` vorhanden
- **Verbinden** → kopiert Client ID in Sidebar-Feld und startet PKCE OAuth Flow
- **Später** / **✕** / Klick auf Backdrop / **ESC** → schließt Modal; Login weiterhin über Sidebar verfügbar
- **Enter** im Client-ID-Feld → löst Verbinden aus
- Wird übersprungen wenn `?code=` in der URL vorhanden (OAuth-Rücksprung von Spotify)

### Generierungs-Log

Erscheint als kopierbares Textfeld (`<textarea readonly>`) im Hauptbereich unterhalb des Spotify-Exports nach jeder Playlist-Generierung. Inhalt:

| Abschnitt | Inhalt |
|---|---|
| EINSTELLUNGEN | Phase, Genre, Referenz-Song (BPM/Camelot/Energy/Phase-Score), Position, WOD-Dauer, Ziel-BPM ±Toleranz, Max-Sprung, Energy-Bereich, Cool-Down, Tonart-Filter |
| POOL | Pool-Größe direkt + mit Nachbar-Genre-Fallback |
| TRACKS | Tabellarisch: # · Titel · Artist · BPM · ΔBPM · Camelot+Kompatibilität(+/~/−) · Energy · Phase-Score · Entscheidungsgrund |
| COOL-DOWN | Separater Block mit D-Phase-Score |
| ZUSAMMENFASSUNG | Tracks/Dauer/BPM-Range, Camelot-Statistik, Ø Energy |

Entscheidungsgrund pro Track: `[Referenz-Song]` · `Camelot + Zone1/2` · `Camelot +` · `Camelot ~` · `Fallback (BPM-Eskalation)` · optional `Genre-Fallback: <Genre>`.
Kopier-Button mit `navigator.clipboard` + `execCommand`-Fallback und 2-Sekunden-Bestätigungsanzeige.

---

## Bekannte Einschränkungen & Offene Punkte

### Bekannte Bugs (Stand aktueller Version)

Alle bisherigen Bugs behoben — keine offenen Bug-Reports.

### Offene Erweiterungen

| # | Anforderung | Priorität |
|---|---|---|
| 1 | BPM-Verlauf Chart: Hover-Tooltip — Song-Name vollständig anzeigen (aktuell 20 Zeichen) | Niedrig |
| 2 | `buildDown()` für "Ende"-Position: Dauer-Ziel nicht immer exakt eingehalten | Mittel |
| 3 | Direktsuche: Genre-Dropdown nach Auswahl nicht immer korrekt gesperrt | Niedrig |

### Technische Schulden

Alle bekannten technischen Schulden sind bereinigt:
- ✅ `addTrack()` / `registerTrack()` konsistent in allen Build-Funktionen genutzt — `buildDown()` tracked jetzt auch `usedArtists`
- ✅ Slider-Thumb-Farbe via CSS Custom Property `--thumb-color` (kein injizierter `<style>`-Tag mehr)
- ✅ Chart-Resize debounced (100ms) — kein Flackern mehr bei Fenster-Resize

---

## Tests

### Ausführen

```
http://127.0.0.1:8888/CFLU_Tests.html
```

Browser-Test-Suite mit eigenem Mini-Test-Framework (describe/it/expect). Importiert direkt aus den `js/`-Modulen — kein Duplizieren von Funktionen mehr. `cflu_tracks.js` wird **nicht** benötigt (Tests verwenden einen eigenen Mock-Pool). Erfordert den lokalen HTTP-Server (ES-Module benötigen `http://`, nicht `file://`).

### Abgedeckte Funktionen (160 Tests, 21 Suiten)

| Suite | Getestete Funktion | Kernfälle |
|---|---|---|
| bpmGroup | BPM → Gruppe A–I | Alle Gruppen, Grenzwerte |
| groupIdx | Gruppe → Index | Bekannte + unbekannte Gruppe |
| neighbour | BPM-Gruppen-Nachbarschaft | ±1 erlaubt, ±2 verboten |
| fmtDur | Sekunden formatieren | Null, führende Nullen, große Werte |
| fmtMin | Sekunden in Minuten | Rundungsverhalten |
| titleKey | Titel-Normalisierung | Suffixe (Radio Edit, feat., Live…), Länge, Dedup-Gleichheit |
| camCompat | Camelot-Kompatibilität | green/yellow/red/unknown, Wrap-around 12↔1 |
| lerpColor | Farb-Interpolation | Start/Ende/Mitte, Clipping, 3 Stops |
| addTrack | Track registrieren | result, usedIds, titleKeys, Artist-Zähler |
| pickNext | Nächsten Track wählen | BPM-Regeln, Energy-Filter, Duplikate, Camelot-Priorität, leerer Pool |
| buildUp | Aufwärts aufbauen | Starttrack, monoton steigend, kein Duplikat, targetSec, Count-Limit |
| buildDown | Rückwärts aufbauen | BPM-Richtung, Energy-Filter, leerer Pool |
| calcWodEnergy | Energy-Bereich je WOD-Typ (v3 Legacy) | Alle Slider-Stufen, Monotonie, Min < Max |
| attrScore | Per-Attribut-Score | Im Bereich → 100, außerhalb → Penalty, clamp auf 0 |
| calcPhaseScore | Phase-Match-Score | Alle Phasen A/B/C/D, Phase-C-Bonus-System |
| camStrictOk | Strikter Camelot-Check | green → true, yellow/red/null → false, Wrap-around |
| toHex / toRgb | Farb-Konvertierung | Schwarz/Weiß/Spotify-Grün, führende Nullen |
| buildPlateau | Phase-A-Algorithmus | ±12 BPM-Band, außerhalb ausgeschlossen, targetSec, Duplikate, leerer Pool |
| buildDecreasing | Phase-D-Algorithmus | BPM sinkt, nie über startBpm, targetSec, Duplikate, leerer Pool |
| calcSortScore | Unified Sort Score | Camelot-Gewichtung, Phase-Score ×2, BPM-Penalty |
| Integration | buildUp + buildDown | Zusammenhängende Kette, keine Duplikate, Energy-Wechsel |

---

## Datenbasis neu generieren

Falls `Spotify_Source.xlsx` aktualisiert wird:

```bash
python3 CFLU_Pool_Build.py
```

Das Script:
1. Liest `Spotify_Source.xlsx`
2. Bereinigt Doubletten (Titel-Key + Artist + BPM ±1 + Camelot)
3. Klassifiziert Genre-Gruppen
4. Berechnet BPM-Gruppen A–I
5. Parst Duration korrekt (Format `HH:MM` stored as `datetime.time`)
6. Schreibt `cflu_tracks.js` mit `const TRACK_DATA={...};` — direkt per `<script src>` ladbar, kein manuelles Einbetten nötig

### Genre-Klassifizierungs-Logik (Reihenfolge)

```python
1. Ska & Reggae    → 'ska', 'rocksteady', 'reggae', 'dub', 'dancehall', ...
2. Punk            → 'punk', 'skate punk', 'pop punk', 'hardcore punk', ...
3. EDM / Electronic (BPM >= 118) → 'edm', 'house', 'techno', 'trance', ...
4. Synthwave / Electronica → 'synthwave', 'vaporwave', 'trip-hop', 'darkwave', ...
5. Dance Pop bridge (BPM-conditional) → EDM wenn BPM >= 118, sonst Pop & New Wave
6. Moderne Deutsche Musik (Album >= 2000) → 'deutsch*', 'german', 'ndw', ...
7. Deutschrock / NDW / Schlager (Album < 2000) → gleiche Keywords
8. Blues & Soul    → parent 'blues' ohne 'rock', 'classic blues', 'delta blues', ...
9. Metal & Hard Rock → 'metal', 'glam metal', 'heavy metal', ...
10. Rock           → 'rock', 'hard rock', 'classic rock', 'indie rock', ...
11. Hip Hop & R&B  → 'hip-hop', 'rap', 'r&b', 'trap', ...
12. Funk & Disco   → 'funk', 'disco', 'soul', 'motown', ...
13. Pop & New Wave → 'pop', 'new wave', 'synthpop', 'singer-songwriter', ...
14. Fallback       → Pop & New Wave
```

Das Script enthält zusätzlich ein `GENRE_GROUPS`-Dict mit 661 Tags für eine
mehrfach-zuordnende Analyse (Multi-Group Mapping) — wird derzeit für Statistik und
zukünftige Erweiterungen genutzt, nicht für die Einzelzuordnung per Track.

---

## Entwicklungshinweise für Claude Code

### Projekt-Kontext

- Der Builder ist in **ES-Module** aufgeteilt: `js/config.js`, `js/state.js`, `js/utils.js`, `js/algorithm.js`, `js/chart.js`, `js/spotify.js`, `js/app.js`
- `CFLU_WOD_Builder.html` enthält nur Markup — kein Inline-JS, keine Inline-Event-Handler
- `cflu_tracks.js` ist ein **non-module Script** (setzt `TRACK_DATA` als globale Variable) — wird vor den ES-Modulen geladen
- `TRACK_DATA` wird in den Modulen **lazy** zugegriffen (innerhalb von Funktionen, nicht auf Top-Level) — so sind die Module ohne cflu_tracks.js importierbar (z.B. in Tests)
- Kein Build-System, kein npm, kein Framework — ES-Module funktionieren direkt über Python http.server

### Wichtige Invarianten (nicht brechen)

```
1. Redirect URI muss exakt 'http://127.0.0.1:8888/CFLU_WOD_Builder.html' sein
2. Client ID darf NICHT in localStorage/sessionStorage persistent gespeichert werden
3. Spotify Export: max. 100 Tracks pro Batch (API-Limit) — immer hard cappen
4. BPM darf in der WOD-Playlist (Phase B/C) nie rückwärts gehen (< vorheriger Track)
5. BPM-Gruppen: max. ±1 Stufe pro Schritt (außer bei BPM-Eskalation als Fallback Phase 4)
6. Phase 4 (BPM-Eskalation) ignoriert Energy-Filter und BPM-Gruppen absichtlich
7. cflu_tracks.js muss VOR dem HTML geladen werden (<script> in <head>)
8. CFLU_Start.bat startet Pool-Build nur wenn Quelldatei vorhanden — cflu_tracks.js muss existieren
9. Audio-Preview benötigt Spotify-Token (spToken) — Preview ohne Token → Fehlermeldung
```

### Entwicklungs-Workflow

```bash
# 1. Modul in js/ oder css/ bearbeiten (oder CFLU_WOD_Builder.html für Markup)
# 2. BAT starten (oder manuell: python -m http.server 8888)
# 3. Browser: http://127.0.0.1:8888/CFLU_WOD_Builder.html
# 4. Tests: http://127.0.0.1:8888/CFLU_Tests.html  (importiert echte Module, kein cflu_tracks.js nötig)
# 5. Änderungen: Browser-Reload (kein Hot-Reload — ES-Module werden neu geladen)
# 6. Datenbasis ändern: CFLU_Pool_Build.py ausführen (schreibt cflu_tracks.js direkt)
```

### Modul-Abhängigkeiten

```
cflu_tracks.js  (non-module global, lädt zuerst)
     ↓ (TRACK_DATA global)
config.js  ←──────────────────────────────────────────┐
     ↓                                                 │
utils.js   (importiert: config.js)                    │
     ↓                                                 │
algorithm.js (importiert: config.js, state.js, utils.js)
chart.js     (importiert: state.js)
spotify.js   (importiert: state.js)
     ↓
app.js (importiert alle, verdrahtet Events, exponiert window.playPreview)
```

### Empfohlene VS Code Extensions

- **Live Server** (nicht direkt nutzbar wegen Spotify Redirect, aber für CSS-Debug hilfreich)
- **Prettier** für HTML/CSS/JS Formatierung
- **GitLens** für Versionskontrolle
- **Claude Code** für KI-gestützte Weiterentwicklung

### Git-Empfehlung

```gitignore
# .gitignore
Spotify_Source.xlsx    # Quelldaten — nicht ins Repo (Datenschutz)
cflu_client_id.txt     # Spotify Client ID — nicht ins Repo
*.log
```

`cflu_tracks.js` ist zwar generiert, aber groß (~874 KB) und wird von der App zwingend benötigt. Entscheidung: **im Repo** (vollständige Nutzbarkeit nach Clone), aber nach Pool-Build neu commiten.

---

## Versionsverlauf

| Version | Änderungen |
|---|---|
| v1.0 | Initiale Version — EDM-spezifischer Builder mit eingebetteter EDM-Liste |
| v2.0 | Gesamtliste (3.347 Tracks), 13 Genre-Gruppen, Spotify PKCE Export |
| v2.1 | Ref/Peak Modi, Suchfunktion alle Genres, Camelot-Priorität |
| v2.2 | ±BPM Toleranz-Regler, Titeldedup, Camelot-Zonierung |
| v3.0 | Vollständiger Neuaufbau: Song-zuerst-Workflow, Positions-Ampel, farbige Regler, Hover-Sync Chart↔Liste, Spotify-Link pro Track, Cool-Down Dauer einstellbar, nur Minuten-Modus, 3.314 Tracks nach verbesserter Bereinigung |
| v3.1 | WOD-Typ-Slider · BPM-Chart Stufen-Visualisierung + Zeitachse + WOD-Ende-Marker · Spotify-Setup-Anleitung · Test-Suite |
| **v4.0** | **Klassen-Phase A/B/C/D mit Unified Scoring System · 8 neue Audio-Feature-Felder (dance, valence, acoustic, instrumental, speech, live, loud, popularity) · Datenbasis extern (cflu_tracks.js, 874 KB) · CFLU_Start.bat auto-rebuildet Pool · Phase-Match-Score Badge in Trackliste · Audio-Preview via Spotify API · Genre-Nachbarn-Fallback · Positions-Ampel +Phase Fit · 3.313 Tracks** |
| **v4.1** | **ES-Module-Refactor: HTML, CSS, JS getrennt · 7 JS-Module (config/state/utils/algorithm/chart/spotify/app) · Keine Inline-Event-Handler · Test-Suite importiert echte Module (kein Funktions-Duplizieren) · registerTrack-Helper konsolidiert addTrack in allen Build-Funktionen · Slider-Thumb via CSS Custom Property · Chart-Resize debounced · cflu_client_id.txt für Spotify Client ID · CFLU_Start.bat: py-Launcher, Port-Diagnose, immer sichtbare Fehlerausgabe** |
| **v4.2** | **Tonart-Filter (Camelot): Buchstaben-Slider A/Beide/B + Zahlenfeld mit Wrap-around-Bereichen · Blues & Soul Genre-Gruppe (Klassifizierung + UI ready; Tracks nach Pool-Rebuild) · GENRE_NEIGHBOURS vollständig für alle Genres inkl. Blues & Soul · CFLU_Pool_Build.py: neues GENRE_GROUPS-Dict (661 Tags, Multi-Group-Mapping), GERMAN_LANGUAGE_TAGS · Tests: 129 Tests, neue Suiten für attrScore / calcPhaseScore / calcSortScore** |
| **v4.3** | **Startup Login Modal: Spotify-Verbindung beim Seitenstart (auto-vorausgefüllt, abbrechbar, ESC/Backdrop) · Generierungs-Log: kopierbares Textfeld mit Einstellungen, Pool-Info, Track-Entscheidungen (Camelot-Phase, Zone, Genre-Fallback), Zusammenfassung · tolDefault phasenspezifisch (A=±10, B=±25, C=±35, D=±20), Toleranz-Slider max auf 40 erweitert · Datenbasis-Quelle (Chosic) in README und PROJECT.md dokumentiert** |

---

## Kontakt / Kontext

- **Betreiber:** CrossFit Ludwigshafen (CFLU)
- **Zweck:** WOD-Musik-Planung für Gruppentraining
- **Trainingsbox:** ~11m × 20m · 10 Rower · 10 Assault Bikes · 2 Ski Ergs · 23 Pull-Up Bars · 13–15 Barbell Stations
- **Entwickelt mit:** Claude (Anthropic) — Fortsetzung via Claude Code empfohlen
