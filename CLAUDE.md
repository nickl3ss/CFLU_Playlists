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
├── BACKLOG.md                  # Feature Requests & Bugs (Source of Truth)
├── docs/
│   └── PROJECT.md              # Projektdokumentation & umgesetzte Items
├── .github/
│   └── ISSUE_TEMPLATE/
│       └── backlog-item.md
├── CFLU_WOD_Builder.html       # Haupt-UI (Markup only)
├── CFLU_Tests.html             # Browser-Test-Suite (manuell öffnen)
├── cflu_tracks.js              # Auto-generierter Track-Pool (nicht manuell editieren)
├── CFLU_Pool_Build.py          # Pool-Builder (liest xlsx, schreibt cflu_tracks.js)
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

| ID | Name | Pfad | Beschreibung |
|----|------|------|--------------|
| C1 | Pool Builder | `CFLU_Pool_Build.py` | Liest Excel, generiert cflu_tracks.js |
| C2 | WOD Builder UI | `CFLU_WOD_Builder.html` | Haupt-UI, Playlist-Logik, Spotify-Export |
| C3 | Track Data | `cflu_tracks.js` | Generierter Track-Pool (nicht manuell editieren) |
| C4 | Tests | `CFLU_Tests.html` | Manuelle Testseite |

---

## Workflow

### A · Neue Anfrage
1. Anfrage analysieren.
2. Offene Annahmen als nummerierte Fragen stellen – **eine Runde, dann warten**.
3. Nach Antwort → Schritt B.

### B · Backlog-Segmentierung
1. Anfrage in atomare Backlog-Items zerlegen.
2. Items mit Format aus `BACKLOG.md` präsentieren (Vorschau, noch nicht schreiben).
3. **Nutzer bestätigt** → Items in `BACKLOG.md` schreiben + GitHub Issues anlegen.

### C · Priorisierung
1. Top-3 Items nach Priorität vorschlagen (Begründung: 1 Satz je Item).
2. Nutzer bestätigt oder nennt alternative Item-IDs.

### D · Implementierung (je Item)
Reihenfolge einhalten:
1. `js/` – Änderung implementieren (HTML/CSS/Python je nach Scope).
2. `CFLU_Tests.html` – Testklassen aktualisieren / neu anlegen.
3. `docs/PROJECT.md` – Abschnitt des Items dokumentieren.
4. `BACKLOG.md` – Item als `[x] DONE` flaggen.
5. GitHub Issue schließen (`gh issue close <id>`).
6. Vollzug melden: Item-ID, geänderte Dateien, Testergebnis.

---

## Backlog-Regeln
- Items **niemals löschen** – nur als `DONE` flaggen.
- IDs sind permanent und eindeutig (`BL-001`, `BL-002`, …).
- Priorität: `P1` (kritisch) · `P2` (hoch) · `P3` (normal) · `P4` (nice-to-have).
- DONE-Items wandern in `docs/PROJECT.md`, Abschnitt **Changelog**.

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
