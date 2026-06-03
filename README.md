# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Local class-phase playlist generator with Spotify export

Builds rule-based playlists for all four phases of a CrossFit class from a pool of 3,313 tracks across 11 genre groups. Select a class phase, pick a reference song, configure duration — and get a scored, Camelot-compatible playlist with audio preview and direct Spotify export.

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

In the app, paste the Client ID in the *Spotify Export* section and click **Verbinden**. Uses PKCE OAuth — no backend, Client ID never stored.

Audio preview (▶ button in track list) also requires a connected Spotify session.

---

## Using the App

### Class Phase selector

Pick the current phase of the class before anything else:

| Phase | Name | BPM | Character |
|---|---|---|---|
| **A** | Whiteboard & Prep | 90–110 | Calm, instrumental background, coach must be audible |
| **B** | Skill & Strength | 80–130 | Focused, moderate arousal, gently ascending |
| **C** | WOD — Intensive | 125–195 | Maximum performance, BPM build (default) |
| **D** | Cool-Down | 60–100 | Parasympathetic, descending, recovery |

Selecting a phase automatically pre-fills the BPM slider, tolerance, and max-jump settings, and filters the song list to best-matching tracks.

### Step 1 — Pick a reference song

| Mode | Description |
|---|---|
| **Genre & BPM** | Filter by genre, BPM ± tolerance, text search |
| **Direktsuche** | Search within the active genre (phase-filtered) |
| **Spotify-Link** | Paste a Spotify URL — found in pool or manual BPM/Camelot entry |

Each track shows a **Phase match score [0–100]** calculated from how well all audio attributes fit the selected phase. Tracks are sorted by score.

### Step 2 — Position (Phase B and C only)

| Position | Behaviour |
|---|---|
| **Start** | Reference song is track #1; playlist builds up |
| **Ende** | Playlist builds up to reference song |
| **Midpoint** | Reference at ~50%; rises before and after |
| **Mid Plateau** | Reference at ~50%; second half stays in same BPM band |

The **traffic-light Ampel** now shows four indicators: BPM · Camelot · Overall · **Phase Fit**.

### Step 3 — Settings

- **WOD-Dauer** — 5–240 min (pre-filled by phase)
- **Max. BPM-Sprung** — +5–+20 (pre-filled by phase)
- **Cool-Down** — Toggle + duration; Phase D + Cool-Down = recovery section then deeper cool-down

---

## Reading the Result

| Element | Meaning |
|---|---|
| BPM chart | Step chart — width of each segment = song duration; X-axis in minutes |
| Gray-blue line | Configured WOD end time |
| Phase score badge | 🟢≥80 · 🟡50–79 · 🔴<50 — how well the track fits the active phase |
| ▶ button | Play 30-second Spotify preview (requires Spotify connection) |
| Camelot dot 🟢/🟡/🔴 | Harmonic compatibility with previous track |
| REF badge | Your chosen reference song |
| Spotify icon | Opens track in Spotify |

---

## Playlist Rules

- **Phase energy range** filters all track selections (Energy column in xlsx)
- BPM never decreases within Phase B/C ascending sections
- Maximum ±1 BPM group per step (except Phase 4 fallback)
- No artist in more than 10% of playlist
- Duplicate titles (normalized, suffixes stripped) excluded
- Pool too small for a phase → warning shown, neighbour genres added automatically
- Spotify export hard-capped at 100 tracks

---

## Track Pool

3,313 unique tracks, 17 fields per track including 8 audio features:

`dance` · `valence` · `acoustic` · `instrumental` · `speech` · `live` · `loud (dB)` · `popularity`

These power the per-phase scoring system.

### Rebuild the pool

Place `Spotify Source.xlsx` in the folder and run:
```bash
python CFLU_Pool_Build.py
```
Or simply start the app via `CFLU_Start.bat` — it rebuilds automatically.

Writes `cflu_tracks.js` which is loaded by the HTML as `<script src="cflu_tracks.js">`.

---

## File Overview

```
CFLU_WOD_Builder.html       ← Single-file app (~70 KB, no embedded data)
cflu_tracks.js              ← Auto-generated track database (~874 KB)
CFLU_Tests.html             ← Browser test suite (~100 tests)
CFLU_Start.bat              ← Windows launcher (auto-rebuilds pool)
CFLU_Pool_Build.py          ← Track pool builder
CFLU_WOD_Builder_PROJECT.md ← Full technical specification
README.md                   ← This file
Spotify Source.xlsx         ← Source data (not in repo — place locally)
```

### Running the tests

```
http://127.0.0.1:8888/CFLU_Tests.html
```

---

## Built With

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- Python `http.server` — local server
- Spotify Web API — PKCE OAuth 2.0 · preview_url for audio · playlist export

---

*Developed for CrossFit Ludwigshafen with [Claude Code](https://claude.ai/code)*
