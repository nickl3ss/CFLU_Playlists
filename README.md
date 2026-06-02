# CFLU WOD Playlist Builder

> CrossFit Ludwigshafen — Local WOD playlist generator with Spotify export

A fully self-contained, single-file web application that builds rule-based workout playlists from a curated pool of 3,314 tracks. Set the workout intensity, pick a reference song, configure duration and BPM parameters — and get a complete playlist with Camelot key harmony, BPM progression, and optional Cool-Down. Export directly to Spotify with one click.

---

## Requirements

- **Python 3.x** (in PATH) — used only as a local HTTP server
- A modern browser (Chrome, Firefox, Edge)
- A Spotify account + Developer App (for export — one-time setup, see below)

---

## Quick Start

### 1. Start the local server

Double-click **`CFLU_Start.bat`**.

The script:
1. Checks that `CFLU_WOD_Builder.html` is present
2. Verifies Python is installed
3. Checks that port 8888 is free (or opens the browser directly if a server is already running)
4. Starts `python -m http.server 8888`
5. Opens `http://127.0.0.1:8888/CFLU_WOD_Builder.html` in the default browser

Keep the terminal window open while using the app. Closing it stops the server.

### Manual start

```bash
cd path/to/CFLUPlaylist
python -m http.server 8888
# then open: http://127.0.0.1:8888/CFLU_WOD_Builder.html
```

> **Why a local server?** Spotify's OAuth redirect URI must be an `http://` address. Opening the file directly via `file://` won't work.

---

## Spotify Export Setup (one-time)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in
2. Click **Create App**
3. Fill in a name, select **Web API** as the API type
4. In **Settings → Redirect URIs**, add exactly:
   ```
   http://127.0.0.1:8888/CFLU_WOD_Builder.html
   ```
5. Copy your **Client ID** from the app settings

In the builder, paste the Client ID into the *Spotify Export* section and click **Verbinden**. Authorization uses PKCE OAuth — no backend required, and the Client ID is never stored persistently.

> **Note:** In Development Mode, Spotify allows up to 25 users per app — more than sufficient for personal use.

---

## Using the App

The workflow has four steps in the left sidebar:

### Step 0 — Set workout type

A slider between **Skill / Strength** and **Intensity WOD** determines the Spotify Energy range applied to all track selections for the entire playlist.

| Position | Energy Range | Typical use |
|---|---|---|
| Skill / Strength (0) | E: 28–70 | Technique work, weightlifting, gymnastics |
| Mixed (50, default) | E: 50–85 | Balanced strength + conditioning |
| Intensity WOD (100) | E: 72–100 | MetCon, AMRAPs, high-output intervals |

The energy range filters the search lists, the generated playlist, and all intermediate track picks. The Cool-Down section uses its own separate energy filter and is unaffected.

### Step 1 — Pick a reference song

| Mode | Description |
|---|---|
| **Genre & BPM** | Filter by genre, target BPM ± tolerance, and text search |
| **Direktsuche** | Search all 3,314 tracks across all genres |
| **Spotify-Link** | Paste a Spotify track URL — the app finds it in the pool or lets you enter BPM/Energy/Camelot manually |

Selected song metadata (BPM, Camelot key, Energy, Genre) is shown below the search.

### Step 2 — Set the song's position

| Position | Behaviour |
|---|---|
| **Start** | Reference song is track #1; playlist builds upward from there |
| **Ende** | Playlist builds up to the reference song; it plays last |
| **Midpoint** | Reference song at ~50%; playlist rises before and after |
| **Mid Plateau** | Reference song at ~50%; second half stays in the same BPM band |

A **traffic-light indicator** rates the reference song's BPM and Camelot key for the chosen position (green / yellow / red).

### Step 3 — Configure settings

- **WOD-Dauer** — Total workout duration: 5–240 min (default: 20 min)
- **Max. BPM-Sprung** — Maximum BPM increase per track: +5–+20 (default: +10)
- **Cool-Down** — Toggle on to append a calm section; set its duration (5–60 min, default: 15 min)

Click **▶ Playlist generieren** to build the playlist.

---

## Reading the Result

| Element | Meaning |
|---|---|
| BPM chart | Step chart — each track's horizontal width = its duration; X-axis shows time in minutes |
| Gray-blue vertical line | Configured WOD end time (always shown) |
| Green step / dot | WOD track |
| Purple step / dot | Cool-Down track |
| Camelot dot (🟢/🟡/🔴) | Harmonic compatibility with the previous track |
| REF badge | Your chosen reference song |
| Spotify icon | Opens the track directly in Spotify |

Hovering over a track row highlights the corresponding chart point, and vice versa.

**BPM chart X-axis intervals** are chosen automatically based on total playlist duration:

| Total duration | Label interval |
|---|---|
| < 10 min | 1:00 |
| 10–20 min | 2:00 |
| 20–50 min | 5:00 |
| > 50 min | 10:00 |

---

## Playlist Rules

- All tracks must fall within the **Energy range** set by the WOD-Typ slider
- BPM never decreases within the WOD section
- Maximum ±1 BPM group per step (groups: A 0–89, B 90–109, C 110–119, D 120–129, E 130–139, F 140–149, G 150–159, H 160–174, I 175+)
- No artist appears in more than 10% of the playlist
- Duplicate titles (normalized, suffixes stripped) are excluded
- Cool-Down: BPM ≤ 70% of peak WOD BPM, Energy below genre average, no Camelot rule, no Energy range filter

---

## Track Pool

3,314 unique tracks across 11 genre groups, embedded directly in the HTML:

| Genre | Tracks | Avg BPM |
|---|---|---|
| Rock | 693 | 122 |
| EDM / Electronic | 650 | 133 |
| Pop & New Wave | 504 | 112 |
| Ska & Reggae | 281 | 129 |
| Synthwave / Electronica | 255 | 121 |
| Moderne Deutsche Musik | 239 | 123 |
| Hip Hop & R&B | 169 | 114 |
| Metal & Hard Rock | 162 | 123 |
| Punk | 160 | 140 |
| Funk & Disco | 112 | 116 |
| Deutschrock / NDW / Schlager | 89 | 121 |

*Virtual groups "Alle Deutschen Tracks" and "Going Wild" combine existing tracks.*

### Rebuild the track pool

If you update `Spotify_Source.xlsx` (exported via Exportify + Tunebat/Chosic):

```bash
pip install pandas openpyxl
python CFLU_Pool_Build.py
```

This writes `cflu_tracks.json`. Open `CFLU_WOD_Builder.html`, find `const TRACK_DATA=` and replace the JSON block with the contents of that file.

---

## File Overview

```
CFLU_WOD_Builder.html       ← Single-file app (HTML + CSS + JS + embedded track data)
CFLU_Tests.html             ← Browser-based test suite (~80 tests, no dependencies)
CFLU_Start.bat              ← Windows launcher
CFLU_Pool_Build.py          ← Track pool generator (reads Spotify_Source.xlsx)
CFLU_WOD_Builder_PROJECT.md ← Full technical specification
README.md                   ← This file
Spotify_Source.xlsx         ← Source data (not in repo — place locally)
```

### Running the tests

Open in the running server:
```
http://127.0.0.1:8888/CFLU_Tests.html
```

Tests cover all pure functions and algorithm logic: `bpmGroup`, `groupIdx`, `neighbour`, `fmtDur`, `titleKey`, `camCompat`, `lerpColor`, `addTrack`, `pickNext`, `buildUp`, `buildDown`, energy range calculation, and integration scenarios.

---

## Built With

- Vanilla HTML / CSS / JavaScript — no framework, no build step
- [Chart.js 4.x](https://www.chartjs.org/) (CDN) — BPM chart
- [Google Fonts](https://fonts.google.com/) — IBM Plex Mono, Barlow Condensed
- Python `http.server` — local server
- Spotify Web API — PKCE OAuth 2.0 export

---

*Developed for CrossFit Ludwigshafen with [Claude Code](https://claude.ai/code)*
