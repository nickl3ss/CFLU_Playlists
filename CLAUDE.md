# CLAUDE.md

## Kommunikation
- Kurz, präzise, keine Ausschweifungen.
- Annahmen **immer** vor Umsetzung klären.
- Antworten strukturiert: Aufzählung > Fließtext.

---

## Stack
- **Runtime:** Python 3
- **Test:** CFLU_Tests.html (manuell im Browser) + Python unittest falls vorhanden
- **Lint:** –
- **Build:** `python CFLU_Pool_Build.py` (generiert `cflu_tracks.js`)

---

## Projektstruktur

```
/
├── CLAUDE.md                   # Diese Datei – Regeln & Workflow
├── docs/
│   ├── PROJECT.md              # Projektdokumentation & umgesetzte Items
│   ├── CHANGELOG.md            # Versionshistorie
│   └── BACKLOG_archive.md      # Archiviertes Backlog (nicht mehr aktiv)
├── .github/
│   └── ISSUE_TEMPLATE/
│       └── backlog-item.md
├── CFLU_WOD_Builder.html       # [WOD] Haupt-UI (Markup only)
├── CFLU_Tests.html             # [TST] Browser-Test-Suite (manuell öffnen)
├── cflu_tracks.js              # [TRK] Auto-generierter Track-Pool (nicht manuell editieren)
├── CFLU_Pool_Build.py          # [PLB] Pool-Builder (liest Playlists/*.csv, schreibt cflu_tracks.js)
├── CFLU_Start.bat              # Windows Launcher
├── css/
│   └── cflu_style.css
└── js/
    ├── config.js
    ├── state.js
    ├── utils.js
    ├── algorithm.js
    ├── chart.js
    ├── spotify.js
    └── app.js
```

### Komponenten

| Kürzel | Name | Pfad | Beschreibung |
|--------|------|------|--------------|
| **PLB** | Pool Builder | `CFLU_Pool_Build.py` | Python ETL-Pipeline: liest `Playlists/*.csv`, generiert `cflu_tracks.js` |
| **WOD** | WOD Generator | `CFLU_WOD_Builder.html` + `js/` | Haupt-App: Playlist-Logik, Scoring, UI, Spotify-Export |
| **TRK** | Track Store | `cflu_tracks.js` | Auto-generierter Track-Pool (nicht manuell editieren) |
| **TST** | Test Suite | `CFLU_Tests.html` | Browser-Test-Suite (160 Tests / 21 Suiten) |

---

## Workflow

> **Source of Truth: GitHub Issues** (https://github.com/nickl3ss/CFLU_Playlists/issues)
> `BACKLOG.md` ist archiviert — nicht mehr verwenden.

### Issue-Format

**Titel:** `[KÜRZEL] Kurzbeschreibung` — z.B. `[WOD] pickNext() Phase 3.5`
**Labels:** Typ-Label (`bug` / `enhancement` / `documentation`) + Priorität (`P1`–`P4`)
**Komponenten-Kürzel:** `PLB` · `WOD` · `TRK` · `TST` (mehrere: `[WOD, TST]`)

**Body-Template:**
```
| Feld | Wert |
|------|------|
| Komponente | WOD |
| Priorität | P2 |
| Erstellt | YYYY-MM-DD |

**Beschreibung:**
...

**Algorithmus:** (optional)
1. ...

Akzeptanzkriterium: ...
```

### A · Neue Anfrage
1. Anfrage analysieren.
2. **Kleine Änderung?** (einzelne UI-Anpassung, Entfernung, Umbenennung, Quickfix ohne Designentscheidung) → direkt zu **Schritt A3-Quick**.
3. Offene Annahmen als nummerierte Fragen stellen – **eine Runde, dann warten**.
4. Nach Antwort → Schritt B.

#### A3-Quick · Sofortiger Einstieg für kleine Änderungen
1. **Grund erfragen:** Eine kurze Frage nach der Motivation stellen und Antwort abwarten.
2. GitHub Issue anlegen (`gh issue create`) mit minimalem Body: Komponente, Priorität, Datum, Grund als einzeiliger Beschreibung.
3. Direkt zu **Schritt D** (Implementierung).

### B · Issue-Segmentierung
1. Anfrage in atomare Issues zerlegen.
2. Issues als Vorschau präsentieren (Titel + Labels + Body-Entwurf).
3. **Nutzer bestätigt** → GitHub Issues anlegen (`gh issue create`).

### C · Priorisierung
1. Top-3 Issues nach Priorität vorschlagen (Begründung: 1 Satz je Issue).
2. Nutzer bestätigt oder nennt alternative Issue-Nummern.

### D · Implementierung (je Issue)
Reihenfolge einhalten:
1. Änderung implementieren – Scope bestimmt Datei: `js/` · `css/` · HTML · Python.
2. `CFLU_Tests.html` öffnen und prüfen ob bestehende Tests noch grün sind.
   - Falls rot: iterieren bis grün (max. 2 Runden).
   - Ausnahme: Tests, die durch die gewollte Änderung absichtlich brechen → ignorieren und im Commit-Message dokumentieren.
   - Nach 2 fehlgeschlagenen Iterationen: stoppen, Nutzer mit Fehlerbeschreibung informieren und auf Commit-Entscheidung warten.
3. `CFLU_Tests.html` – Testklassen aktualisieren / neu anlegen.
4. Nutzer zum Test auffordern und abwarten. Gemeldete Fehler als neue Issues mit Referenz auf das aktuelle Issue erfassen → zurück zu D 1.
5. `docs/CHANGELOG.md` – Eintrag hinzufügen (Issue-#, Titel, Datum, Commit).
6. GitHub Issue schließen (`gh issue close <nr> --reason "completed"`).
7. Vollzug melden: Issue-#, geänderte Dateien, Testergebnis.

---

## Issue-Regeln
- Issues **niemals löschen** — nur schließen.
- Priorität: `P1` (kritisch) · `P2` (hoch) · `P3` (normal) · `P4` (nice-to-have).
- Typ-Labels: `bug` · `enhancement` · `documentation` · `wontfix`
- Abgeschlossene Issues wandern als Eintrag in `docs/CHANGELOG.md`.

---

## Git
- Commits: `<type>(<scope>): <was>` — z.B. `feat(algorithm): add plateau builder`
- Types: `feat` · `fix` · `test` · `docs` · `chore`
- Kein Commit ohne grüne Tests.

---

## Wichtige Invarianten (niemals brechen)

1. Redirect URI muss exakt `http://127.0.0.1:8888/CFLU_WOD_Builder.html` sein
2. Client ID darf **nicht** in localStorage/sessionStorage gespeichert werden
3. Spotify Export: max. 100 Tracks pro Batch (API-Limit) — immer hard cappen
4. BPM darf in Phase B/C nie rückwärts gehen (< vorheriger Track)
5. BPM-Gruppen: max. ±1 Stufe pro Schritt (außer BPM-Eskalation Phase 4)
6. Phase 4 (BPM-Eskalation) ignoriert Energy-Filter und BPM-Gruppen absichtlich
7. `cflu_tracks.js` muss VOR den ES-Modulen geladen werden (`<script>` in `<head>`)
8. `CFLU_Start.bat` startet Pool-Build nur wenn Quelldatei vorhanden ist
