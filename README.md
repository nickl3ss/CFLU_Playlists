# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Local class-phase playlist generator with Spotify export

Builds rule-based playlists for all four phases of a CrossFit class from the track pool across 12 genre groups. Select a class phase, pick a reference song, configure duration — and get a scored, Camelot-compatible playlist with audio preview and direct Spotify export.

Architecture, algorithm details and ADR decisions → [`docs/PROJECT.md`](docs/PROJECT.md)

---

## Requirements

- **Python 3.x** (in PATH) — runs the local server and auto-rebuilds the track pool
- **Node.js LTS** (optional) — runs the test suite from the command line without a browser
- A modern browser (Chrome, Firefox, Edge)
- A Spotify account + Developer App (for export and audio preview — one-time setup)

---

## Quick Start

Double-click **`CFLU_Start.bat`**.

What it does automatically:
1. Checks Python is installed
2. If CSVs are present in `Playlists/` — rebuilds `cflu_tracks.js` from scratch
3. Starts `python -m http.server 8888`
4. Opens `http://127.0.0.1:8888/CFLU_WOD_Builder.html` in the default browser

Keep the terminal window open while using the app. Closing it stops the server.

### Manual start

```bash
cd path/to/CFLUPlaylist
python CFLU_Pool_Build.py   # optional: only needed after adding/updating CSVs
python -m http.server 8888
# open: http://127.0.0.1:8888/CFLU_WOD_Builder.html
```

> **Why a local server?** Spotify OAuth requires an `http://` redirect URI. `file://` won't work.

---

## Spotify Setup (one-time)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. **Create App** → select **Web API**
3. **Settings → Redirect URIs** → add exactly:
   ```
   http://127.0.0.1:8888/CFLU_WOD_Builder.html
   ```
4. Copy your **Client ID**

**Recommended:** save the Client ID in a file named `cflu_client_id.txt` in the app folder. It will be loaded automatically on startup. The file is gitignored — it never leaves your machine.

Uses PKCE OAuth — no backend, Client ID never written to localStorage.

---

## Using the App

| Phase | Name | BPM | Character |
|---|---|---|---|
| **A** | Whiteboard & Prep | 90–110 | Calm, instrumental background |
| **B** | Skill & Strength | 80–130 | Focused, gently ascending |
| **C** | WOD — Intensive | 125–195 | Maximum performance, BPM build |
| **D** | Cool-Down | 60–100 | Descending, recovery |

1. **Pick a phase** — pre-fills BPM, tolerance, max-jump and energy range
2. **Pick a reference song** — three independent modes:
   - **Genre & BPM** — filter by genre, BPM and Camelot key; selected track defines the generation pool
   - **Direktsuche** — full-text search across the entire pool (all genres, no filter restrictions); selected track's genre defines the pool
   - **Spotify-Link** — paste a track URL; if found in pool the genre is auto-detected; if external (not in pool), enter BPM/Camelot/Energy and choose pool genre manually
3. **Set position** (B/C only): Start · Ende · Midpoint · Mid Plateau
4. **Adjust settings** — WOD duration, max BPM jump, Cool-Down toggle
5. **Generate** — BPM step chart + track list with Camelot dots, phase scores, preview and Spotify links

---

## Adding Songs / Rebuilding the Pool

Song metadata comes from **[Chosic Spotify Playlist Analyzer](https://www.chosic.com//spotify-playlist-analyzer/)** — export CSV and place it in the `Playlists/` subfolder.

`CFLU_Start.bat` (or `CFLU_Pool_Build.py` manually) picks up all CSVs in `Playlists/`, deduplicates by Spotify Track ID, and regenerates `cflu_tracks.js` automatically on every start.

---

## Components

| Kürzel | Name | Pfad | Beschreibung |
|--------|------|------|--------------|
| **PLB** | Pool Builder | `CFLU_Pool_Build.py` | Python ETL-Pipeline: liest `Playlists/*.csv`, generiert `cflu_tracks.js` |
| **WOD** | WOD Generator | `CFLU_WOD_Builder.html` + `js/` | Haupt-App: Playlist-Logik, Scoring, UI, Spotify-Export |
| **TRK** | Track Store | `cflu_tracks.js` | Auto-generierter Track-Pool (nicht manuell editieren) |
| **TST** | Test Suite | `js/cflu_tests.js` · `CFLU_Tests.html` | Dual-mode: `node js/cflu_tests.js` (CLI) · Browser-Renderer (160 Tests / 21 Suiten) |

## File Overview

```
CFLU_WOD_Builder.html   ← [WOD] Main UI (markup only)
cflu_tracks.js          ← [TRK] Auto-generated track pool (gitignored after rebuild)
CFLU_Tests.html         ← [TST] Browser renderer — thin shell, imports js/cflu_tests.js
CFLU_Start.bat          ← Windows launcher
CFLU_Pool_Build.py      ← [PLB] Pool builder (Playlists/*.csv → cflu_tracks.js)
package.json            ← {"type":"module"} — enables node js/cflu_tests.js
CLAUDE.md               ← Workflow rules for Claude Code sessions
css/cflu_style.css
js/
  cflu_tests.js         ← [TST] Canonical test class (dual-mode: Node.js + browser export)
  config · state · utils · algorithm · chart · spotify · app  ← [WOD] ES modules
docs/PROJECT.md         ← Architecture & ADR decisions
docs/CHANGELOG.md       ← Version history
```

### Running the tests

**CLI (Node.js):**
```bash
node js/cflu_tests.js
```
Exit code `0` = all pass · `1` = failures. Node.js installation: `winget install OpenJS.NodeJS.LTS`

**Browser:**
```
http://127.0.0.1:8888/CFLU_Tests.html
```

---

*Developed for CrossFit Ludwigshafen with [Claude Code](https://claude.ai/code)*
