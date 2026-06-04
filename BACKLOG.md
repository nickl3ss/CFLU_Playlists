# BACKLOG

> Source of Truth. Sync → GitHub Issues.
> Format: `[ ] OPEN` · `[~] IN PROGRESS` · `[x] DONE`
> Priorität: P1 kritisch · P2 hoch · P3 normal · P4 nice-to-have

---

## OPEN

### BL-001 · buildDown() Dauer-Ziel nicht immer exakt eingehalten
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P3 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
`buildDown()` für die "Ende"-Position trifft das Dauer-Ziel nicht immer exakt. Betrifft Phase B/C wenn der Referenz-Song als letzter Track platziert wird. Akzeptanzkriterium: Playlist-Dauer weicht maximal um eine Song-Länge vom Zielwert ab.

---

### BL-002 · Direktsuche Genre-Dropdown nach Auswahl nicht korrekt gesperrt
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P4 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
In der Direktsuche ist das Genre-Dropdown nach Auswahl eines Tracks gelegentlich nicht korrekt deaktiviert. Visueller Bug, keine funktionale Auswirkung. Akzeptanzkriterium: Dropdown ist nach Track-Auswahl konsistent gesperrt.

---

### BL-003 · BPM-Chart Tooltip Song-Name vollständig anzeigen
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P4 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
Der Hover-Tooltip im BPM-Verlauf-Chart kürzt Song-Namen auf 20 Zeichen. Akzeptanzkriterium: vollständiger Titel sichtbar (ggf. zweizeilig oder mit dynamischer Breite).

---

### BL-016 · pickNext() Phase 3.5 — Camelot/Energy-Relaxierung vor BPM-Eskalation
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P2 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
`pickNext()` springt nach Phase 3 (gelbes Camelot) direkt zu Phase 4 (BPM-Eskalation, ignoriert Energy-Filter). Eine neue Phase 3.5 soll zwischen Phase 3 und Phase 4 eingeschoben werden: Camelot-Constraint vollständig aufgehoben, aber Energy-Filter und BPM-Gruppen-Regel bleiben aktiv. Erst wenn auch das keine Kandidaten liefert, greift Phase 4.

Akzeptanzkriterium: `pickNext()` durchläuft Phase 3.5 bevor BPM-Eskalation einsetzt; bestehende Tests bleiben grün.

---

### BL-017 · Dynamisches Nachbar-Genre-Laden bei erschöpftem Pool
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P3 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
Aktuell werden Nachbar-Genres einmalig beim Pool-Aufbau (`getPhasePoolWithNeighbours`) ergänzt, wenn der Primär-Pool unter `MIN_POOL_SIZE` fällt. Wenn `buildUp()` während der Generierung keinen nächsten Track findet (`pickNext()` → `null`), werden keine weiteren Nachbarn hinzugezogen. BL-017 erweitert `buildUp()` so, dass beim ersten `null`-Ergebnis iterativ Nachbar-Genres nachgeladen werden (jeweils ein Nachbar pro Iteration) und `pickNext()` erneut versucht wird.

Akzeptanzkriterium: WOD-Playlisten mit kleinen Genre-Pools erreichen die Ziel-Dauer häufiger; Log zeigt nachträglich ergänzte Genres.

---

### BL-018 · Top-5-Zufallsauswahl in pickNext() mit Carry-over
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P2 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
`pickNext()` wählt immer deterministisch den bestbewerteten Kandidaten (`cands[0]`). Um Playlist-Varianz zu erhöhen, soll stattdessen gleichgewichtet zufällig aus den Top-5 Kandidaten gewählt werden (`Math.floor(Math.random() * Math.min(5, cands.length))`). Carry-over: die 2 nächstbesten Kandidaten (Rang 2 + 3) aus dem vorherigen Schritt werden als Bonuskandidaten für den nächsten `pickNext()`-Aufruf vorgezogen, um harmonische Übergänge zu sichern.

Akzeptanzkriterium: Zwei Generierungen mit identischen Einstellungen liefern unterschiedliche Playlisten; bestehende Tests bleiben grün.

---

### BL-019 · Pool-Sufficiency-Check mit BFS-Nachbar-Expansion
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | P2 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
Vor der Generierung soll geprüft werden, ob der verfügbare Pool ausreicht, um die Ziel-Dauer zu füllen. Der Algorithmus ermittelt die relevante BPM-Range automatisch aus dem selektierten Referenz-Song und der gewählten Position (kein neues UI-Element). Wenn der Pool unzureichend ist, werden iterativ Nachbar-Genres per BFS (Breadth-First-Search, Nachbarn-der-Nachbarn) ergänzt — vollautomatisch ohne Popup. Das Generierungslog zeigt welche Genres in welcher Runde ergänzt wurden.

**Algorithmus:**
1. `deriveBpmRange(phase, refBpm, position)` — leitet BPM-Range ab:
   - `plateau` → volle Phase-A-Range
   - `decreasing` → `[lo, refBpm]`
   - `start` → `[refBpm, hi]`
   - `end` / `mid` → `[lo, hi]` (volle Range)
2. `isPoolSufficient(pool, bpmMin, bpmMax, targetSec)` — prüft: `cands.length >= ceil(targetSec / avgDur)`
3. `expandPoolForSufficiency(genre, phase, refBpm, position, targetSec)` — BFS-Schleife über `GENRE_NEIGHBOURS` bis Pool ausreicht oder alle Nachbarn erschöpft

**Keine Nutzereingabe.** `_gen()` ruft `expandPoolForSufficiency` statt `getPhasePoolWithNeighbours` auf.

Akzeptanzkriterium: 30-min Funk-&-Disco-WOD generiert ≥ 8 Tracks; Log zeigt ergänzte Genre-Runden; bestehende Tests bleiben grün; neue Unit-Tests für alle 3 Hilfsfunktionen.

---

### BL-020 · CSV-Direktimport aus Playlists/ — Pool aktualisieren/erweitern
| Feld | Wert |
|------|------|
| Komponente | C1 |
| Priorität | P3 |
| GitHub Issue | #? |
| Erstellt | 2026-06-04 |

**Beschreibung:**
`CFLU_Pool_Build.py` wird vollständig auf CSV-Eingang umgestellt. Die `Spotify_Source.xlsx` entfällt ersatzlos. Der Ablauf folgt einem klassischen **ETL-Muster**:

---

**E — Extract**
- Alle `Playlists/*.csv` alphabetisch sortiert einlesen (`csv.DictReader`, `encoding='utf-8-sig'` für Chosic-BOM, kein pandas, kein openpyxl).
- Doublettenkontrolle direkt bei der Extraktion: `Spotify Track Id` ist der eindeutige Schlüssel. Jede ID wird nur einmal übernommen — erster Fund gewinnt (alphabetische Dateireihenfolge). Alle weiteren Vorkommen derselben ID in anderen CSVs werden gefiltert und im Log gezählt.
- Ergebnis: `extracted = {spotify_id: raw_row}` — Dict mit Spotify Track Id als Schlüssel; Wert ist die vollständige, unberührte CSV-Zeile (alle 26 Spalten als `str`, wie von `csv.DictReader` geliefert).

**T — Transform**
- Quell-Werte werden **nicht verändert** — keine inhaltliche Korrektur, keine Normalisierung von Messwerten.
- Ausschließlich Typ-Casting, Format-Konversion und Anreicherung/Ableitung aus App-Anforderungen:
  - Typ-Casting: `int()` für numerische Felder; `"yes"/"no"` → `bool` für `explicit`
  - Format-Konversion: `"MM:SS"` → `int` Sekunden für `dur`
  - `song`: Suffix-Bereinigung (Radio Edit, Remastered, …) — App-Anforderung für Dedup im UI
  - `genres_raw` / `parent_genres`: Split by `,`, Whitespace strippen → `list[str]`
  - `genre`: Ableitung aus `genres_raw` via 661-Tag-Tabelle → eine der 12 Genre-Gruppen
  - `bpmg`: Ableitung aus `bpm` → Buchstabe A–H
- Pflicht-Validierung: jedes ✓-Feld wird nach Cast auf Leer/Ungültig geprüft. Erster Fehler → Track verwerfen, Feldname im Log ausgeben.
- Optionale Felder (O): leer → `null` / `[]` / `false` ohne Verwurf.

Pflicht-Klassifikation:
- **✓ — Pflicht:** Feld leer oder ungültig → Track wird verworfen und im Log gezählt. Gilt für alle Pflicht-, Scoring- und Display-Felder gleichwertig.
- **O — Optional:** Leer → `null` / `[]` / `false`; App liest das Feld nicht für Playlist-Generierung.

| CSV-Spalte | Track-Feld | Zieltyp | Pflicht | Art | Anmerkung |
|------------|-----------|---------|---------|-----|-----------|
| ` #` | — | — | — | **Ausgeschlossen** | Playlist-interne Sequenz |
| `Spotify Track Id` | `id` | `str` | **✓** | Übernahme | Eindeutiger Schlüssel |
| `Song` | `song` | `str` | **✓** | Übernahme + Suffix-Bereinigung | |
| `Artist` | `artist` | `str` | **✓** | Übernahme | |
| `BPM` | `bpm` | `int` | **✓** | Cast `int()` | |
| `Camelot` | `camelot` | `str` | **✓** | Übernahme | z.B. `"4A"`, `"11B"` |
| `Energy` | `energy` | `int` | **✓** | Cast `int()` | 0–100 |
| `Added At` | `added_at` | `str` | **O** | Übernahme | ISO-Datum; kein Date-Cast; Leer → `null` |
| `Duration` | `dur` | `int` | **✓** | Format-Konversion | `"MM:SS"` → `int(m)*60 + int(s)` |
| `Popularity` | `popularity` | `int` | **✓** | Cast `int()` | 0–100 |
| `Genres` | `genres_raw` | `list[str]` | **✓** | Split `,` + strip | Basis für `genre`-Ableitung |
| `Parent Genres` | `parent_genres` | `list[str]` | **O** | Split `,` + strip | Leer → `[]` |
| `Album` | `album` | `str` | **O** | Übernahme | Leer → `null` |
| `Album Date` | `album_date` | `str` | **O** | Übernahme | Ungültige Daten möglich (`2002-00-00`); Leer → `null` |
| `Dance` | `dance` | `int` | **✓** | Cast `int()` | 0–100 |
| `Acoustic` | `acoustic` | `int` | **✓** | Cast `int()` | 0–100 |
| `Instrumental` | `instrumental` | `int` | **✓** | Cast `int()` | 0–100 |
| `Valence` | `valence` | `int` | **✓** | Cast `int()` | 0–100 |
| `Speech` | `speech` | `int` | **✓** | Cast `int()` | 0–100 |
| `Live` | `live` | `int` | **✓** | Cast `int()` | 0–100 |
| `Loud (Db)` | `loud` | `int` | **✓** | Cast `int()` | Ganzzahlig in Quelle (−26 bis −3, geprüft) |
| `Key` | `key` | `str` | **O** | Übernahme | Unicode ♭ ♯ (z.B. `"A#/B♭ minor"`); Leer → `null` |
| `Time Signature` | `time_sig` | `int` | **O** | Cast `int()` | Werte: 0, 1, 3, 4, 5; Leer → `null` |
| `Label` | `label` | `str` | **O** | Übernahme | Leer → `null` |
| `ISRC` | `isrc` | `str` | **O** | Übernahme | Leer → `null` |
| `Explicit` | `explicit` | `bool` | **✓** | Cast `"yes" → True`, sonst `False` | |
| _(kein CSV-Pendant)_ | `genre` | `str` | **✓** | Ableitung aus `genres_raw` | 661-Tag-Mapping → eine der 12 Genre-Gruppen; kein Match → Verwurf |
| _(kein CSV-Pendant)_ | `bpmg` | `str` | **O** | Ableitung aus `bpm` | Buchstabe A–H; nicht von `algorithm.js` gelesen; Leer → `null` |

**L — Load**

**`locked`-Feld:** Neues Feld in `cflu_tracks.js`, Typ `int` (1/0).
- Alle bestehenden Tracks erhalten beim ersten Ausführen von BL-020 `locked: 0`.
- Neue Tracks aus CSV erhalten `locked: 0`.
- `locked: 1` schützt einen Track vor Überschreiben — muss manuell in `cflu_tracks.js` gesetzt werden.

**Ablauf:**
1. Bestehende `cflu_tracks.js` einlesen → Dict `{id: track}` (O(1)-Lookup). Fehlende `locked`-Felder werden beim Einlesen auf `0` normalisiert.
2. Pro transformiertem Track aus CSV:
   - ID neu → anhängen mit `locked: 0`.
   - ID bekannt, `locked == 1` → überspringen; CSV-Quelle für diese ID wird ignoriert.
   - ID bekannt, `locked == 0` → **überschreiben** (vollständige Ersetzung durch CSV-Daten; `locked`-Wert aus bestehendem Eintrag beibehalten).
3. `stats`-Objekt über den vollständigen Dict neu berechnen.
4. Einmaliger Schreibvorgang: `json.dumps()` → JS-Template → `cflu_tracks.js`.

---

**`CFLU_Start.bat`-Änderung:** xlsx-Zweig entfernen. Wenn `Playlists\*.csv` vorhanden → `python CFLU_Pool_Build.py` ausführen.

**Ausgabe-Log:** CSVs gelesen · Tracks extrahiert · Quelldoubletten gefiltert · Tracks neu (append) · Tracks aktualisiert (overwrite) · Tracks gesperrt (locked, skip) · Tracks verworfen (Pflichtfeld fehlt) · Tracks gesamt.

Akzeptanzkriterium: CSV überschreibt bestehende Tracks (locked=0) vollständig; locked=1 schützt Track vor Änderung; neue Tracks erhalten locked=0; alle bestehenden Tracks erhalten locked=0 bei erstem Run; alle 28 Felder (27 + `locked`) korrekt; `stats` neu berechnet; `CFLU_Start.bat` triggert via CSV-Check; keine xlsx-Abhängigkeit; bestehende Tests grün.

---

## IN PROGRESS

_Keine Items in Bearbeitung._

---

## DONE

> Abgeschlossene Items → Details in `docs/CHANGELOG.md`

### [x] BL-004 · v1.0 Initiale Version
| Feld | Wert |
|------|------|
| Komponente | C1, C2, C3 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** EDM-spezifischer Builder mit eingebetteter EDM-Liste als erste lauffähige Version.

---

### [x] BL-005 · v2.0 Gesamtliste & Spotify Export
| Feld | Wert |
|------|------|
| Komponente | C1, C2, C3 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** Erweiterung auf 3.347 Tracks über 13 Genre-Gruppen; Spotify PKCE Export integriert.

---

### [x] BL-006 · v2.1 Ref/Peak Modi & Suche
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** Ref/Peak Positionsmodi, Suchfunktion über alle Genres, Camelot-Priorität eingeführt.

---

### [x] BL-007 · v2.2 Toleranz-Regler & Titeldedup
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** ±BPM Toleranz-Regler, normalisierte Titel-Deduplizierung, Camelot-Zonierung ergänzt.

---

### [x] BL-008 · v3.0 Song-zuerst-Workflow & Neuaufbau
| Feld | Wert |
|------|------|
| Komponente | C2 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** Vollständiger Neuaufbau: Song-zuerst-Workflow, Positions-Ampel, farbige Regler, Hover-Sync Chart↔Liste, Spotify-Link pro Track, einstellbare Cool-Down-Dauer, 3.314 Tracks.

---

### [x] BL-009 · v3.1 BPM-Chart & Test-Suite
| Feld | Wert |
|------|------|
| Komponente | C2, C4 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** WOD-Typ-Slider, BPM-Chart als Stufen-Visualisierung mit Zeitachse und WOD-Ende-Marker, Spotify-Setup-Anleitung, erste Browser-Test-Suite.

---

### [x] BL-010 · v4.0 Klassen-Phasen & Unified Scoring
| Feld | Wert |
|------|------|
| Komponente | C1, C2, C3, C4 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** Phasen A/B/C/D mit Unified Scoring System, 8 neue Audio-Feature-Felder, cflu_tracks.js als externer Track-Pool, CFLU_Start.bat, Phase-Match-Score Badge, Audio-Preview via Spotify API, Genre-Nachbarn-Fallback, 3.313 Tracks.

---

### [x] BL-011 · v4.1 ES-Module-Refactor
| Feld | Wert |
|------|------|
| Komponente | C2, C4 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** Aufteilung in 7 ES-Module (config/state/utils/algorithm/chart/spotify/app), kein Inline-JS, Test-Suite importiert echte Module, registerTrack konsolidiert, Slider-Thumb via CSS Custom Property, Chart-Resize debounced, cflu_client_id.txt.

---

### [x] BL-012 · v4.2 Tonart-Filter & Blues/Soul
| Feld | Wert |
|------|------|
| Komponente | C2, C4 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | – |

**Beschreibung:** Tonart-Filter (Camelot-Buchstaben-Slider + Zahlenfeld mit Wrap-around-Bereichen), Blues & Soul Genre-Gruppe implementiert, GENRE_NEIGHBOURS vollständig, 129 Tests / 18 Suiten.

---

### [x] BL-013 · v4.3 Login-Modal & Generierungs-Log
| Feld | Wert |
|------|------|
| Komponente | C2, C4 |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | 2026-06 |

**Beschreibung:** Startup Login Modal (auto-vorausgefüllt, abbrechbar via ESC/Backdrop), Generierungs-Log als kopierbares Textfeld, tolDefault phasenspezifisch (A=±10/B=±25/C=±35/D=±20), Toleranz-Slider max=40, Chosic als Datenbasis-Quelle dokumentiert, 160 Tests / 21 Suiten.

---

### [x] BL-014 · chore: Methodik-Workflow integriert
| Feld | Wert |
|------|------|
| Komponente | – |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | 2026-06-04 |

**Beschreibung:** CLAUDE.md, BACKLOG.md, docs/PROJECT.md und .github/ISSUE_TEMPLATE angelegt; strukturierter Entwicklungs-Workflow eingeführt.

---

### [x] BL-015 · v5.0 Methodik-Workflow aktiviert
| Feld | Wert |
|------|------|
| Komponente | – |
| Priorität | – |
| GitHub Issue | – |
| Abgeschlossen | 2026-06-04 |

**Beschreibung:** .gitignore korrigiert (war ohne Punkt, nie aktiv; sensible Dateien wurden nie ignoriert), README aktualisiert (docs/-Verweis, 160 Tests), BACKLOG.md mit BL-001–BL-003 befüllt.
