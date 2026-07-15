# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Local class-phase playlist generator with Spotify export

Builds rule-based playlists for all four phases of a CrossFit class from a pool spanning 12 genre groups. Select a class phase, pick a reference song, configure duration — and get a scored, Camelot-compatible playlist with direct Spotify export.

Architecture, algorithm details and ADR decisions → [`docs/PROJECT.md`](docs/PROJECT.md)

---

## Requirements

- **Python 3.x** (in PATH) — runs the local server and auto-rebuilds the track pool
- **Node.js LTS** (optional) — runs the test suite from the command line without a browser
- A modern browser (Chrome, Firefox, Edge)
- A Spotify account + Developer App (for export — one-time setup)

---

## Quick Start

**Windows:** Double-click **`CFLU_Start.bat`**.

**macOS / Linux:** Run **`./CFLU_Start.sh`** in a terminal.

What both launchers do automatically:
1. Checks Python is installed (`py -3` on Windows, `python3` on Linux/macOS)
2. Runs `CFLU_Pool_Build.py` — rebuilds the track pool from any CSVs in `Playlists/`; if no CSVs are present, re-applies genre classification to the existing pool
3. Starts `python cflu_server.py` (custom HTTP server on port 8888)
4. Opens `http://127.0.0.1:8888/CFLU_WOD_Builder.html` in the default browser

Keep the terminal window open while using the app. Closing it stops the server.

### Manual start

```bash
cd path/to/CFLUPlaylist
python CFLU_Pool_Build.py   # optional: only needed after adding/updating CSVs
python cflu_server.py
# open: http://127.0.0.1:8888/CFLU_WOD_Builder.html
```

> **Why a local server?** Spotify OAuth requires an `http://` redirect URI. `file://` won't work.

---

## Spotify Setup (one-time)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. **Create App** → select **Web API**
3. **Settings → Redirect URIs** → add exactly:
   ```
   http://127.0.0.1:8888/api/spotify/callback
   ```
4. Copy your **Client ID** and **Client Secret**

Save credentials in two gitignored files — loaded automatically on startup:
```
keyvault/cflu_client_id.txt      ← Client ID
keyvault/cflu_client_secret.txt  ← Client Secret
```

Uses server-side Authorization Code Flow (`cflu_server.py`). The browser never holds a Spotify token — all OAuth and API calls are proxied through the local server.

---

## Using the App

| Phase | Name | BPM | Character |
|---|---|---|---|
| **A** | Whiteboard & Prep | 85–110 | Calm, instrumental background |
| **B** | Skill & Strength | 80–120 | Focused, gently ascending |
| **C** | WOD — Intensive | 125–195 | Maximum performance, BPM build |
| **D** | Cool-Down | 60–100 | Descending, recovery |

1. **Pick a phase** — pre-fills BPM range and energy range
2. **Pick a reference song** — three independent modes:
   - **Genre & BPM** — filter by genre, BPM and Camelot key; selected track defines the generation pool
   - **Direct search** — full-text search across the entire pool (all genres, no filter restrictions); selected track's genre defines the pool
   - **Spotify-Link** — paste a track URL; if found in pool the genre is auto-detected; if external (not in pool), enter BPM/Camelot/Energy and choose pool genre manually
3. **Set position** (B/C only): Start · End · Midpoint · Mid Plateau
4. **Adjust settings** — WOD duration, Cool-Down toggle, score weights (spider-web panel)
5. **Generate** — BPM step chart + track list with Camelot dots, phase scores, preview and Spotify links

---

## Adding Songs / Rebuilding the Pool

Song metadata is sourced via **[Chosic Spotify Playlist Analyzer](https://www.chosic.com/spotify-playlist-analyzer/)**. The CSV files exported there are the sole input for the track pool.

### Best Practice: Creating a CSV

1. **Create a temporary playlist in Spotify** — add a new, empty playlist to your own account.
2. **Make the playlist public** — Chosic can only analyse public playlists.
3. **Collect songs** — mark all tracks from existing playlists that are suitable for workouts and drag & drop them into the new playlist. In the pop-up, choose **"Only add new songs"** to avoid duplicates.
4. **Copy the playlist link** — share the playlist in Spotify → copy the link to the clipboard.
5. **Start the analysis** — paste the link at [chosic.com/spotify-playlist-analyzer](https://www.chosic.com/spotify-playlist-analyzer/) and run the analysis.
6. **Download the CSV** — at the bottom of the analysis page there is a download button for the CSV file.
7. **Place the CSV** — move the downloaded file into the `Playlists/` subfolder of the project directory. Multiple CSV files from different playlists can coexist there.

### Rebuilding the Pool

Run **`CFLU_Start.bat`** — the script automatically picks up all CSVs in `Playlists/`, deduplicates by Spotify Track ID, and rewrites `cflu_tracks.js`.

Alternatively, run manually:
```bash
python CFLU_Pool_Build.py
```

### Data & Privacy Notes

- **D-01 — Chosic:** To analyse a playlist, Chosic requires it to be **public** on Spotify. Chosic is a third-party web service; your playlist metadata (track names, artists, audio features) is sent to their servers and may be processed according to their privacy policy. Make the playlist private again after the CSV download, or delete it entirely.
- **D-02 — Spotify Export:** When you export a generated playlist to Spotify, the app requests only the `playlist-modify-private` scope. The playlist is created as **private**. Spotify may still infer workout patterns from your listening and playlist data according to their own privacy policy.

---

## Components

| Abbr. | Name | Path | Description |
|-------|------|------|-------------|
| **PLB** | Pool Builder | `CFLU_Pool_Build.py` | Python ETL pipeline: reads `Playlists/*.csv`, generates `cflu_tracks.js` |
| **WOD** | WOD Generator | `CFLU_WOD_Builder.html` + `js/` | Main app: playlist logic, scoring, UI, Spotify export |
| **TRK** | Track Store | `cflu_tracks.js` | Auto-generated track pool — tracked in repo; do not edit manually |
| **TST** | Test Suite | `js/cflu_tests.js` · `CFLU_Tests.html` · `test_cflu_pool_build.py` | JS: dual-mode (`node js/cflu_tests.js` CLI · browser renderer). Python: `python -m unittest discover` |

## File Overview

```
CFLU_WOD_Builder.html   ← [WOD] Main UI (markup only)
cflu_tracks.js          ← [TRK] Auto-generated track pool (tracked in repo; do not edit manually)
CFLU_Tests.html         ← [TST] Browser renderer — thin shell, imports js/cflu_tests.js
CFLU_Start.bat          ← Windows launcher
CFLU_Start.sh           ← macOS/Linux launcher
cflu_server.py          ← [PLB] Custom HTTP server (port 8888, POST /api/upload-csv)
cflu.service            ← Linux systemd user-service (auto-start on login)
CFLU_Pool_Build.py      ← [PLB] Pool builder (Playlists/*.csv → cflu_tracks.js)
test_cflu_pool_build.py ← [TST] Python unit tests for the ETL's pure functions
package.json            ← {"type":"module"} — enables node js/cflu_tests.js
pyproject.toml          ← Ruff linter config (Python)
CLAUDE.md               ← Workflow rules for Claude Code sessions
css/cflu_style.css
js/
  cflu_tests.js         ← [TST] Canonical test class (dual-mode: Node.js + browser export)
  config · state · utils · genres · algorithm · optimizer · chart · spotify
  genre_space · upload · resolve · register · app  ← [WOD] ES modules
docs/PROJECT.md         ← Architecture & ADR decisions
docs/references/        ← Background research: WOD music theory, genre network analysis

```

### Linux — Autostart as a systemd service

To have the app start automatically on login (Linux only):

```bash
# Copy the service file to your systemd user directory
mkdir -p ~/.config/systemd/user
cp cflu.service ~/.config/systemd/user/

# Edit the path inside the service file to match your installation directory
nano ~/.config/systemd/user/cflu.service

# Enable and start
systemctl --user enable cflu
systemctl --user start cflu

# Check status
systemctl --user status cflu
```

The browser still needs to be opened manually to `http://127.0.0.1:8888/CFLU_WOD_Builder.html`.

---

### Running the tests

**JS — CLI (Node.js):**
```bash
node js/cflu_tests.js
```
Exit code `0` = all pass · `1` = failures. Node.js installation: `winget install OpenJS.NodeJS.LTS`

**JS — Browser:**
```
http://127.0.0.1:8888/CFLU_Tests.html
```

**Python — Pool Builder ETL:**
```bash
python -m unittest discover -p "test_*.py"
ruff check .
```
CI (`.github/workflows/tests.yml`) runs all of the above — JS tests, ESLint, ruff, and the Python unit tests — on every push and pull request.

---

*Developed for CrossFit Ludwigshafen with [Claude Code](https://claude.ai/code)*
