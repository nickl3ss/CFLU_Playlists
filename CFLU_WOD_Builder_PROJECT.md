# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Lokaler Playlist-Generator für WOD-Begleitung  
> Standalone HTML-Anwendung · Python HTTP Server · Spotify PKCE Export

---

## Projektübersicht

Ein lokal laufender WOD Playlist Builder für CrossFit Ludwigshafen. Auf Basis einer bereinigten Spotify-Trackliste (3.313 Songs, 17 Felder) erstellt der Builder phasenbasierte WOD-Playlists mit Camelot-Kompatibilität, BPM-Steuerung, Audio-Preview und direktem Spotify-Export.

### Technologie-Stack

| Komponente | Technologie |
|---|---|
| Frontend | Vanilla HTML / CSS / JavaScript (Single File, ~70 KB) |
| Datenbasis | Externe JS-Datei `cflu_tracks.js` (~874 KB, 3.313 Tracks) |
| Charts | Canvas 2D (eigene Implementierung) |
| Fonts | Google Fonts (IBM Plex Mono, Barlow Condensed) |
| Server | Python `http.server` (lokal) |
| Auth | Spotify PKCE OAuth 2.0 (kein Backend) |
| Datenbuild | Python 3 (pandas, json) |
| Tests | Standalone HTML (`CFLU_Tests.html`, ~100 Tests, keine Abhängigkeiten) |

### Dateien

```
CFLU_WOD_Builder.html       ← Hauptanwendung (~70 KB, ohne eingebettete Daten)
cflu_tracks.js              ← Datenbasis (auto-generiert, ~874 KB)
CFLU_Tests.html             ← Browser-Test-Suite (~100 Tests)
CFLU_Start.bat              ← Windows Starter (Pool-Build + Server + Browser)
CFLU_Pool_Build.py          ← Datenbasis-Generator (aus Spotify Source.xlsx)
Spotify Source.xlsx         ← Quelldaten (nicht im Repo — lokal ablegen)
CFLU_WOD_Builder_PROJECT.md ← Diese Datei
README.md                   ← Kurzanleitung
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

- Client ID im Builder eingeben (wird **nicht gespeichert** — kein localStorage)
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

`Spotify Source.xlsx` (auch `Spotify_Source.xlsx`) — exportiert aus Spotify via Exportify + Tunebat/Chosic.  
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
| EDM / Electronic | 650 | 133 | 81 |
| Pop & New Wave | 504 | 112 | 69 |
| Ska & Reggae | 281 | 129 | 79 |
| Synthwave / Electronica | 255 | 121 | 74 |
| Moderne Deutsche Musik (ab 2000) | 239 | 123 | 72 |
| Hip Hop & R&B | 169 | 114 | 72 |
| Metal & Hard Rock | 162 | 123 | 79 |
| Punk | 160 | 140 | 85 |
| Funk & Disco | 112 | 116 | 72 |
| Deutschrock / NDW / Schlager (vor 2000) | 89 | 121 | 64 |
| **Alle Deutschen Tracks** | 328 | 122 | 69 |
| **Going Wild (alle)** | 3.314 | 122 | 74 |

*Alle Deutschen Tracks und Going Wild sind virtuelle Gruppen — keine eigenen Datensätze*

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

| Phase | BPM | Energy | Valence | Dance | Instrumental | Speech | Acoustic | Loud (dB) | BPM-Verlauf |
|---|---|---|---|---|---|---|---|---|---|
| A Whiteboard | 90–110 | 30–55 | 50–80 | 30–60 | ≥40 | ≤20 | ≥30 | ≤–10 | Plateau |
| B Skill | 80–130 | 55–78 | 35–65 | 35–65 | ≥25 | ≤25 | 5–40 | –10 bis –5 | Sanft aufsteigend |
| C WOD | 125–195 | 70–100 | 60–90 | 60–80 | ≤25 | — | ≤10 | ≥–8 | Aufsteigend (BPM-Build) |
| D Cool-Down | 60–100 | 0–50 | 40–70 | ≤45 | ≥50 | — | ≥40 | ≤–10 | Absteigend |

*Bereichsgrenzen sind Scoring-Schwellen (Penalty), keine harten Filter — Phase 4-Fallback ignoriert sie.*

### Genre-Nachbarn (Fallback bei zu kleinem Pool)

```
Rock              → Pop & New Wave · Metal & Hard Rock · Funk & Disco
EDM / Electronic  → Synthwave / Electronica · Pop & New Wave
Punk              → Rock · Metal & Hard Rock · Ska & Reggae
Ska & Reggae      → Punk · Funk & Disco · Pop & New Wave
Metal & Hard Rock → Rock · Punk
Hip Hop & R&B     → Funk & Disco · Pop & New Wave
Funk & Disco      → Hip Hop & R&B · Pop & New Wave · Rock
Synthwave         → EDM / Electronic · Pop & New Wave
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

*Implementierung: dynamischer CSS-Gradient + Thumb-Farbe via injiziertem `<style>`-Tag*  
*Regler ohne eigene Farblogik (WOD-Dauer, ±BPM Toleranz, Cool-Down-Dauer) nutzen `var(--bg5)` als Standard-Track-Farbe.*

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

---

## Bekannte Einschränkungen & Offene Punkte

### Bekannte Bugs (Stand aktueller Version)

| # | Problem | Status |
|---|---|---|
| 1 | `selectedTrack?.(...)` TypeError bei Playlist-Generierung | ✅ Behoben |
| 2 | `addTrack()` doppelt in `buildUp()` | ✅ Behoben |
| 3 | Plateau-Filter Operator-Precedence `&&!...||!` | ✅ Behoben |
| 4 | Redirect URI fehlte Dateiname → Directory Listing | ✅ Behoben |
| 5 | Regler (WOD-Dauer, ±BPM Toleranz, Cool-Down) nicht sichtbar | ✅ Behoben |
| 6 | Chart mit `height=80` gezeichnet bevor result-area sichtbar (offsetHeight=0) | ✅ Behoben |

### Offene Erweiterungen (noch nicht implementiert)

| # | Anforderung | Priorität |
|---|---|---|
| 1 | Datenbasis als externe JSON-Datei (statt eingebettet) | Mittel |
| 2 | BPM-Verlauf Chart: Hover-Tooltip verbessern (Song-Name vollständig) | Niedrig |
| 3 | `buildDown()` für "Ende"-Position: Dauer-Ziel nicht exakt eingehalten | Mittel |
| 4 | Plateau-Modus: usedArtists-Tracking unvollständig | Niedrig |
| 5 | Direktsuche: Genre-Dropdown nach Auswahl nicht immer korrekt gesperrt | Niedrig |

### Technische Schulden

- `addTrack()` Hilfsfunktion ist definiert aber in `buildUp`/`buildDown` nicht konsistent genutzt — vereinheitlichen
- Slider-Farbgradient via injiziertem `<style>`-Tag ist ein Workaround — besser: CSS Custom Properties mit `@property`
- Chart-Resize bei Fenstergrößenänderung: funktioniert, aber kurzes Flackern möglich

---

## Tests

### Ausführen

```
http://127.0.0.1:8888/CFLU_Tests.html
```

Standalone HTML-Datei — kein npm, keine Abhängigkeiten. Alle Funktionen werden mit einem eigenen Mini-Test-Framework (describe/it/expect) geprüft.

### Abgedeckte Funktionen (~80 Tests)

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
| calcWodEnergy | Energy-Bereich je WOD-Typ | Alle Slider-Stufen, Monotonie, Min < Max |
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
6. Schreibt `cflu_tracks.json`
7. JSON muss manuell in `CFLU_WOD_Builder.html` eingebettet werden (oder Build-Script anpassen)

### Genre-Klassifizierungs-Logik (Reihenfolge)

```python
1. Ska & Reggae    → 'ska', 'rocksteady', 'reggae', 'dub', 'dancehall'
2. Punk            → 'punk', 'skate punk', 'pop punk', 'hardcore punk', 'oi!'
3. EDM / Electronic (BPM >= 118) → 'edm', 'house', 'techno', 'trance', ...
4. Synthwave       → 'synthwave', 'vaporwave', 'chillwave', 'lo-fi', ...
5. Moderne Deutsche Musik (Album >= 2000) → 'deutsch*', 'german', 'ndw', ...
6. Deutschrock / NDW / Schlager (Album < 2000) → gleiche Keywords
7. Metal & Hard Rock → 'metal', 'glam metal', 'heavy metal', ...
8. Rock            → 'rock', 'hard rock', 'classic rock', 'indie rock', ...
9. Hip Hop & R&B   → 'hip-hop', 'rap', 'r&b', 'trap', ...
10. Funk & Disco   → 'funk', 'disco', 'soul', 'motown', ...
11. Pop & New Wave → 'pop', 'new wave', 'synthpop', 'singer-songwriter', ...
12. Fallback       → Pop & New Wave
```

---

## Entwicklungshinweise für Claude Code

### Projekt-Kontext

- Der Builder ist eine **Single-File-Anwendung** — HTML, CSS und JS in einer Datei
- Die Datenbasis (JSON) ist **eingebettet** — Änderungen am Build-Script erfordern HTML-Neugeneration
- Kein Build-System, kein npm, kein Framework — bewusst einfach gehalten für lokalen Betrieb

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
# 1. HTML bearbeiten in VS Code
# 2. BAT starten (oder manuell: python -m http.server 8888)
# 3. Browser: http://127.0.0.1:8888/CFLU_WOD_Builder.html
# 4. Tests: http://127.0.0.1:8888/CFLU_Tests.html
# 5. Änderungen: Browser-Reload (kein Hot-Reload)
# 6. Datenbasis ändern: CFLU_Pool_Build.py ausführen, JSON neu einbetten
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
cflu_tracks.json       # Generiert — nicht ins Repo
*.log
```

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

---

## Kontakt / Kontext

- **Betreiber:** CrossFit Ludwigshafen (CFLU)
- **Zweck:** WOD-Musik-Planung für Gruppentraining
- **Trainingsbox:** ~11m × 20m · 10 Rower · 10 Assault Bikes · 2 Ski Ergs · 23 Pull-Up Bars · 13–15 Barbell Stations
- **Entwickelt mit:** Claude (Anthropic) — Fortsetzung via Claude Code empfohlen
