# Claude Code Task: Zentrales Genre-Konzept umstellen (Main / Sub / Neighbours + Picker-Logik)

## Kontext
Datenbasis: `cflu_tracks.js` (`const TRACK_DATA = {...}`), **4.293 Tracks**, **744 unique Subgenres** im Feld `genres_raw`. Jeder Track trägt bereits ein zugewiesenes Main Genre im Feld `genre`. Diese **12 Main Genres sind verbindlich** (datengetrieben, nicht umbenennen, nicht ersetzen).

Diese Vorgabe basiert auf einem Research Report zu **musiktheoretischen und DJ-praktischen Genre-Verbindungen** und definiert das neue Genre-Konzept. Ziel ist eine **zentrale Genre-Konfiguration**, auf die *alle* Funktionen der App zugreifen (Picker, Pooling, Filter, Score, UI). Aktuell sind Genre-Logiken vermutlich über mehrere Stellen verstreut — diese werden konsolidiert.

---

## Teil A — Genre-Konzept (Research-fundiert)

### Die 4 primären Bridges (höchste Neighbour-Gewichtung)
Alle Neighbour-Beziehungen leiten sich aus vier dokumentierten Verbindungslinien ab:

- **Bridge A — Four-on-the-floor Dance-Kontinuum:** Funk & Disco → EDM/Electronic → Synthwave → Pop & New Wave → Moderne Deutsche Musik (Discofox/Schlager). Gemeinsamer 4/4-Kick, Tempo-Kernband 120–145 BPM. Dichtester, sicherster Cluster.
- **Bridge B — Jamaican Offbeat-Lineage:** Ska & Reggae ↔ Punk (Skank/Offbeat, 2-Tone, Ska Punk). Sehr starke Einzelkante.
- **Bridge C — Distorted-Guitar / Aggression-Achse:** Punk → Metal & Hard Rock → Rock; zusätzlich Metal ↔ Hip Hop & R&B (Rap Metal / Nu Metal).
- **Bridge D — Deutschsprachiger Szene-Cluster:** Moderne Deutsche Musik ↔ Deutschrock / NDW / Schlager (nahezu identische Subgenre-Überlappung — als Zwillingsknoten behandeln, immer benachbart).

### Verbindliche Main-Genre-Struktur (12, nach Track-Count)

| Main Genre | Tracks | Distinkte Subgenres | Charakteristische Subgenres (Top, mit Count) | Tempo-Band (BPM) |
|---|---|---|---|---|
| **EDM / Electronic** | 1084 | 321 | eurodance(231), hypertechno(168), techno(133), edm(128), disco house(118), dance pop(107), slap house(86) | 120–165 (Core 120–145) |
| **Rock** | 823 | 209 | rock(163), klassischer rock(160), soft rock(119), new wave pop(86), new wave(86), synthpop(76), glam rock(81) | 90–140 |
| **Pop & New Wave** | 548 | 273 | pop(89), dance pop(71), europop(31), eurodance(29), synthpop(15) | 110–128 |
| **Metal & Hard Rock** | 346 | 85 | metal(120), hard rock(92), nu metal(89), alternative metal(87), glam metal(86), rap metal(77) | 110–220 |
| **Ska & Reggae** | 302 | 138 | ska(190), ska punk(151), punk(85), reggae(72), skate punk(67), rocksteady(55) | ska uptempo / reggae one-drop |
| **Synthwave / Electronica** | 290 | 72 | synthwave(231), vaporwave(128), chillwave(116), synthpop(28), darkwave(11) | 80–140 (oft 80–118) |
| **Moderne Deutsche Musik** | 264 | 46 | deutscher pop(154), deutscher hip-hop(83), schlager(68), neue deutsche welle(67), schlagerparty(55) | 120–128 (Discofox) |
| **Hip Hop & R&B** | 213 | 120 | old school hip-hop(60), east coast hip-hop(48), hip-hop(45), r&b(44), rap(34), pop rap(22) | 85–95 (R&B 60–100) |
| **Punk** | 205 | 89 | punk(107), pop punk(100), emo(53), skate punk(40), hardcore punk(21), post-punk(21) | 140–200+ |
| **Funk & Disco** | 120 | 46 | disco(70), motown(24), funk(18), soul(18), klassischer soul(14), italo disco(10) | 100–130 |
| **Deutschrock / NDW / Schlager** | 81 | 15 | neue deutsche welle(60), schlager(43), deutscher pop(43), schlagerparty(24) | 120–128 |
| **Blues & Soul** | 17 | 19 | bluesrock(13), blues(12), klassischer rock(4), modern blues(4), southern rock(3) | 60–90 |

### Neighbour-Graph (Research-fundiert, gewichtet)
Pro Main 3–4 Neighbours, primäre Bridge zuerst. `weight`: 1.0 = primäre Bridge, 0.7 = sekundär, 0.5 = Lineage/schwach.

```yaml
neighbours:
  EDM / Electronic:        [Pop & New Wave(1.0), Synthwave / Electronica(1.0), Funk & Disco(1.0), Moderne Deutsche Musik(0.7)]
  Rock:                    [Metal & Hard Rock(1.0), Pop & New Wave(0.7), Synthwave / Electronica(0.7), Punk(0.7), Blues & Soul(0.5)]
  Pop & New Wave:          [EDM / Electronic(1.0), Rock(0.7), Synthwave / Electronica(0.7), Moderne Deutsche Musik(0.7), Funk & Disco(0.5)]
  Metal & Hard Rock:       [Rock(1.0), Punk(1.0), Hip Hop & R&B(0.7), EDM / Electronic(0.5)]
  Ska & Reggae:            [Punk(1.0), Funk & Disco(0.7), Rock(0.5), Hip Hop & R&B(0.5)]
  Synthwave / Electronica: [EDM / Electronic(1.0), Pop & New Wave(0.7), Rock(0.7), Moderne Deutsche Musik(0.5)]
  Moderne Deutsche Musik:  [Deutschrock / NDW / Schlager(1.0), Pop & New Wave(0.7), EDM / Electronic(0.7), Hip Hop & R&B(0.5)]
  Hip Hop & R&B:           [Funk & Disco(1.0), Moderne Deutsche Musik(0.7), Metal & Hard Rock(0.7), EDM / Electronic(0.5)]
  Punk:                    [Ska & Reggae(1.0), Metal & Hard Rock(1.0), Rock(0.7), Pop & New Wave(0.5)]
  Funk & Disco:            [EDM / Electronic(1.0), Hip Hop & R&B(0.7), Pop & New Wave(0.5), Blues & Soul(0.5), Synthwave / Electronica(0.5)]
  Deutschrock / NDW / Schlager: [Moderne Deutsche Musik(1.0), Rock(0.7), Pop & New Wave(0.5), Punk(0.5)]
  Blues & Soul:            [Rock(1.0), Funk & Disco(0.7), Hip Hop & R&B(0.5)]
```

### Bridge-Subgenres (Connective Tissue)
Diese `genres_raw`-Tags verbinden zwei Mains und sind die **sichersten Pivot-Tracks** für Genre-Übergänge. Trägt ein Track ein Bridge-Tag, erhält der Cross-Main-Übergang einen Bonus:

```yaml
bridge_subgenres:
  dance pop:            [EDM / Electronic, Pop & New Wave, Moderne Deutsche Musik]
  synthpop:             [Synthwave / Electronica, Rock, Pop & New Wave]
  ska punk:             [Punk, Ska & Reggae]
  skate punk:           [Punk, Ska & Reggae]
  rap metal:            [Metal & Hard Rock, Hip Hop & R&B]
  nu metal:             [Metal & Hard Rock, Hip Hop & R&B]
  eurodance:            [EDM / Electronic, Pop & New Wave, Moderne Deutsche Musik]
  europop:              [EDM / Electronic, Pop & New Wave, Moderne Deutsche Musik]
  new wave:             [Rock, Punk, Pop & New Wave, Deutschrock / NDW / Schlager]
  neue deutsche welle:  [Moderne Deutsche Musik, Deutschrock / NDW / Schlager]
  schlager:             [Moderne Deutsche Musik, Deutschrock / NDW / Schlager]
  deutscher pop:        [Moderne Deutsche Musik, Deutschrock / NDW / Schlager]
  disco house:          [EDM / Electronic, Funk & Disco, Synthwave / Electronica]
  italo disco:          [EDM / Electronic, Funk & Disco, Synthwave / Electronica]
  hip house:            [EDM / Electronic, Hip Hop & R&B]
  glam metal:           [Metal & Hard Rock, Rock]
  hard rock:            [Metal & Hard Rock, Rock]
  bluesrock:            [Blues & Soul, Rock]
  klassischer rock:     [Blues & Soul, Rock]
  southern rock:        [Blues & Soul, Rock]
```

### Tempo-Bridging (Half/Double-Time)
Beim Cross-Genre-Matching gilt die 2:1-Regel: Ein ~90-BPM-Hip-Hop-Track ist rhythmisch kompatibel zu einem ~180-BPM-Punk/Metal-Track (gleiches Beatgrid). BPM-Kompatibilität immer auf **Roh-Ratio UND Half/Double-Ratio** prüfen, besseren Score nehmen. Ohne Half-Time gilt das DJ-Fenster ±5–6 %. **Hinweis:** Half-Time-Sprünge wirken energetisch wie ein Drop — nur als bewusster Phasenübergang einsetzen, nicht als Default im Peak-WOD.

### Genre-spezifische Hinweise
- **Synthwave** hat oft niedriges Tempo (80–118) → eher Warm-up/Transition als Peak-WOD.
- **Blues & Soul** (nur 17 Tracks) ist die historische Wurzel → als Lineage-/Cool-Down-Tag behandeln, nicht als aktiver Peak-WOD-Neighbour.
- **Moderne Deutsche Musik** und **Deutschrock / NDW / Schlager** überlappen stark → funktional Zwillingsknoten, immer benachbart.

---

## Teil B — Picker-Logik (NEU)

Der Playlist Song Picker bindet **Neighbouring Genres früher** in die Song-Picks ein und priorisiert **Subgenre-Kontinuität**:

1. **Subgenre-Treue zuerst:** Bei jedem Pick wird – wenn möglich – auf dem **Subgenre des Referenz-Songs** geblieben (gleicher `genres_raw`-Tag wie der zuletzt gepickte/aktive Track). Das ist die höchste Präferenz, noch vor dem Main Genre.
2. **Eskalations-Reihenfolge pro Pick** (von eng nach weit):
   - **Stufe 1:** Gleiches Subgenre wie Referenz-Song (höchste Priorität).
   - **Stufe 2:** Anderes Subgenre, aber gleiches Main Genre.
   - **Stufe 3:** Bridge-Subgenre, das aktuelles Main mit einem Neighbour verbindet (Pivot-Track).
   - **Stufe 4:** Neighbour-Main (nach `weight` absteigend), bevorzugt Tracks mit gemeinsamem oder Bridge-Subgenre.
3. **Neighbours früher einbinden:** Der Picker greift Neighbour-Kandidaten **nicht erst als Notlösung**, sondern bereits proaktiv, sobald innerhalb des Subgenres die Auswahl dünn wird oder Varianz erwünscht ist (z. B. Per-Artist-Cap, BPM-/Camelot-Fenster) — gewichtet nach Neighbour-`weight` und Bridge-Subgenre-Bonus. Ziel: weiche, kohärente Übergänge statt harter Main-Genre-Sprünge.
4. **Orthogonalität bleibt:** Subgenre-/Neighbour-Logik steuert **Genre-Varianz**. BPM-Bänder, Camelot-Zonen (1/2/3) und der WOD-Score bleiben unabhängige Filter und werden hier NICHT verändert. Genre-Picks müssen weiterhin die bestehenden BPM/Camelot-Constraints erfüllen.

---

## Teil C — Zentrale Konfiguration (Architektur-Anweisung)

1. **Eine Single Source of Truth schaffen:** Lege ein Modul `genres.js` (oder `genreConfig.js`) an, das das komplette Konzept als `GENRE_CONFIG` exportiert:
   ```js
   GENRE_CONFIG = {
     mainGenres: [{ id, label, trackCount, tempoBand:[min,max], role:"peak|warmup|cooldown",
                    subgenres:[{tag,count}], neighbours:[{mainId,weight}] }],
     bridgeSubgenres: { "<tag>": [mainId, ...] },
     bridges: { A:[...], B:[...], C:[...], D:[...] },
     pickerStrategy: { escalation:[...], subgenreFirst:true, neighbourEarly:true }
   }
   ```
2. **Alle Genre-Verwendungen umstellen:** Sämtliche Funktionen (Picker, Pooling, Filter, Score, UI-Labels, Genre-Auswahl) greifen ausschließlich auf `GENRE_CONFIG` zu. **Keine hartkodierten Genre-Listen, Neighbour-Mappings oder Subgenre-Strings** mehr verstreut im Code. Bestehende Vorkommen suchen, auflisten und auf die zentrale Config umbiegen.
3. **Vollständige Subgenre-Listen generieren:** Für jedes Main die **komplette** `genres_raw`-Liste aus den Tracks bauen (nicht nur Top-N), mit Counts. Mehrfachzuordnung über Mains erhalten (nicht deduplizieren).
4. **Neighbour-Konsistenz:** Graph wie oben übernehmen. Nicht erzwungen symmetrisch — falls Symmetrie gewünscht, vorab flaggen.

---

## WICHTIG (Workflow-Vorgaben)
- **Erst Requirements bestätigen, dann implementieren.** Diese Struktur + Architektur vorlegen, auf OK warten, bevor App-Code geändert wird.
- **Flagging:** Jede Abweichung als „geändert / ergänzt / bestätigt" melden, nicht vermischen. Entfernte/ergänzte Subgenre-Tags explizit ausweisen — keine stille Korrektur.
- **Quelle:** `genres_raw` ist die Subgenre-Quelle, **nicht** `parent_genres` (unzuverlässig, ~44 % befüllt).
- **Migration zuerst auflisten:** Vor der Umstellung alle Stellen im Projekt auflisten, die Genres verwenden (Picker, Pool-Build, Filter, Score, UI), damit der Umfang der Zentralisierung sichtbar ist.
- Kurz und knapp.
