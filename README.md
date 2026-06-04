# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Local class-phase playlist generator with Spotify export

Builds rule-based playlists for all four phases of a CrossFit class from a pool of 3,313 tracks across 12 genre groups. Select a class phase, pick a reference song, configure duration — and get a scored, Camelot-compatible playlist with audio preview and direct Spotify export.

Architecture, algorithm details and ADR decisions → [`docs/PROJECT.md`](docs/PROJECT.md)

---

## Requirements

- **Python 3.x** (in PATH) — runs the local server and auto-rebuilds the track pool
- `pandas` + `openpyxl`: `pip install pandas openpyxl`
- A modern browser (Chrome, Firefox, Edge)
- A Spotify account + Developer App (for export and audio preview — one-time setup)

---

## Quick Start

Double-click **`CFLU_Start.bat`**.

What it does automatically:
1. Checks Python is installed
2. If `Spotify Source.xlsx` is present — rebuilds `cflu_tracks.js` from scratch
3. Starts `python -m http.server 8888`
4. Opens `http://127.0.0.1:8888/CFLU_WOD_Builder.html` in the default browser

Keep the terminal window open while using the app. Closing it stops the server.

### Manual start

```bash
cd path/to/CFLUPlaylist
python CFLU_Pool_Build.py   # optional: only needed after updating the xlsx
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
2. **Pick a reference song** — by genre/BPM, Direktsuche, or Spotify link; optional Tonart-Filter (Camelot key)
3. **Set position** (B/C only): Start · Ende · Midpoint · Mid Plateau
4. **Adjust settings** — WOD duration, max BPM jump, Cool-Down toggle
5. **Generate** — BPM step chart + track list with Camelot dots, phase scores, preview and Spotify links

---

## Adding Songs / Rebuilding the Pool

Song metadata comes from **[Chosic Spotify Playlist Analyzer](https://www.chosic.com//spotify-playlist-analyzer/)** — export CSV, paste into `Spotify Source.xlsx`, run `CFLU_Pool_Build.py` (or restart via `CFLU_Start.bat`).

---

## File Overview

```
CFLU_WOD_Builder.html   ← Main UI (markup only)
cflu_tracks.js          ← Auto-generated track pool (~874 KB, gitignored after rebuild)
CFLU_Tests.html         ← Browser test suite (160 tests)
CFLU_Start.bat          ← Windows launcher
CFLU_Pool_Build.py      ← Pool builder (xlsx → cflu_tracks.js)
CLAUDE.md               ← Workflow rules for Claude Code sessions
BACKLOG.md              ← Feature requests & bugs
css/cflu_style.css
js/                     ← ES modules: config · state · utils · algorithm · chart · spotify · app
docs/PROJECT.md         ← Architecture & ADR decisions
docs/CHANGELOG.md       ← Version history
```

### Running the tests

```
http://127.0.0.1:8888/CFLU_Tests.html
```

---

*Developed for CrossFit Ludwigshafen with [Claude Code](https://claude.ai/code)*
