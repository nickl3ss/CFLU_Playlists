# CFLU WOD Builder — Test Protocol

> **How to use this file**
> - Run the **Regression Suite** after every push to confirm nothing broke.
> - Run **New Since Last Push** to verify the specific changes introduced.
> - After confirming all tests pass, clear the *New Since Last Push* section (Claude handles this on confirmation).
> - Update this file in the same commit as any behaviour change (Step D4 mandate).

---

## New Since Last Push

### N1 · Genre Space — Start Screen

| # | Step | Expected |
|---|------|----------|
| N1-1 | Load app (no playlist generated) | Genre space fills the entire result area; rotating 3D star cloud visible immediately |
| N1-2 | Observe rotation for ~10 s | Cloud rotates slowly around all three axes at different speeds — calm, never repeating |
| N1-3 | Try to drag / zoom the cloud | No interaction; mouse has no effect on the model |
| N1-4 | Observe dot sizes | Tiny dots (~2px) for genres not in pool; larger dots (up to ~20px) for high-count genres |
| N1-5 | Cloud visual centre | Cloud centred in the canvas area, not pulled to bottom or side |
| N1-6 | Section title "● Genre Space" | Visible as overlay in top-left of the cloud, does not push canvas down |

### N2 · Genre Space — Playlist Mode

| # | Step | Expected |
|---|------|----------|
| N2-1 | Generate a playlist | Genre space disappears; track list + Spotify Export + Generierungs-Log fill the screen |
| N2-2 | Generate again | Same — genre space stays hidden |

### N3 · Playlist Screen Layout

| # | Step | Expected |
|---|------|----------|
| N3-1 | Generate a playlist | All four sections (BPM chart area, track list, Spotify Export, Generierungs-Log) are same width and left-aligned |
| N3-2 | Scroll check | No page-level scrollbar; Spotify Export and Generierungs-Log always visible without scrolling |
| N3-3 | Generierungs-Log height | Log textarea is compact (≈14 vh), not 280 px fixed; resizable by dragging its bottom edge |
| N3-4 | Resize window vertically | Log height scales with viewport (min 80 px, max 200 px) |

---

## Regression Suite

Run these steps in order. All must pass before a push is considered confirmed.

### R0 · Startup

| # | Step | Expected |
|---|------|----------|
| R0-1 | Run `CFLU_Start.bat` (Windows) or `CFLU_Start.sh` (Mac/Linux) | Terminal shows pool build output, server starts on port 8888, browser opens `CFLU_WOD_Builder.html` |
| R0-2 | Check browser console (F12) for errors | No red errors on load |
| R0-3 | Page title shows "CFLU WOD Builder" | Title visible in tab |

---

### R1 · Track Pool

| # | Step | Expected |
|---|------|----------|
| R1-1 | App loads — check track count indicator | Shows a non-zero track count |
| R1-2 | Open browser console, type `TRACK_DATA.length` | Returns the same count as the UI indicator |

---

### R2 · WOD Configuration

| # | Step | Expected |
|---|------|----------|
| R2-1 | Select WOD type (e.g. "Sport") | UI reflects the selection without error |
| R2-2 | Adjust BPM slider for Phase C | BPM range updates live in the display |
| R2-3 | Toggle a genre filter on and off | Filter state persists until manually changed |
| R2-4 | Set duration (e.g. 45 min) | Duration shown correctly |

---

### R3 · Playlist Generation

| # | Step | Expected |
|---|------|----------|
| R3-1 | Click "Generate" with default settings | Playlist appears; no console errors |
| R3-2 | Verify phase order A → B → C → D in the track list | Phases shown in correct sequence |
| R3-3 | Check BPM values across Phase B/C | BPM never decreases within ascending phases (Invariant 4) |
| R3-4 | Generate a second time | New playlist generated; previous one replaced |
| R3-5 | Generate with very restrictive genre filter | Either a valid short playlist OR a clear "not enough tracks" message — no silent empty result |

---

### R4 · BPM Chart

| # | Step | Expected |
|---|------|----------|
| R4-1 | Generate a playlist | BPM chart renders below or beside track list |
| R4-2 | Inspect chart shape for a WOD type with warm-up + peak + cool-down | Chart shows ascending → plateau → descending curve |
| R4-3 | Resize browser window | Chart redraws without distortion |

---

### R5 · Track Display

| # | Step | Expected |
|---|------|----------|
| R5-1 | Each track shows: artist, title, BPM | All three fields present and non-empty |
| R5-2 | Check for duplicate tracks in one playlist | No track appears twice |
| R5-3 | Track with mood tags — verify tag display (if implemented) | Tags shown correctly or field absent gracefully |

---

### R6 · Spotify Export

| # | Step | Expected |
|---|------|----------|
| R6-1 | Click "Connect Spotify" | Redirect to Spotify OAuth (PKCE flow) |
| R6-2 | After auth, return to app | No `sp_cid` or `pkce_v` remaining in sessionStorage (open DevTools → Application → Session Storage) |
| R6-3 | Click "Export to Spotify" | Playlist created in Spotify; success message shown |
| R6-4 | Check localStorage | No Spotify token in localStorage (Invariant 2) |
| R6-5 | Export a playlist with >100 tracks (if pool allows) | Export completes in batches; all tracks added (Invariant 3) |

---

### R7 · CSV Upload

| # | Step | Expected |
|---|------|----------|
| R7-1 | Drag a valid Spotify CSV onto the upload area | Upload succeeds; success message with track count |
| R7-2 | Upload a file with an invalid extension (e.g. `.txt`) | Rejection message shown; no crash |
| R7-3 | Upload a duplicate CSV (same playlist already in pool) | Handled gracefully — no crash, informative message |

---

### R8 · Automated Tests

| # | Step | Expected |
|---|------|----------|
| R8-1 | Run `node js/cflu_tests.js` | All tests pass — output ends with `N/N bestanden — ALLE TESTS BESTANDEN` |
| R8-2 | Run `npm run lint` | No errors (warnings acceptable) |

---

### R9 · Pool Builder (run if CSVs changed)

| # | Step | Expected |
|---|------|----------|
| R9-1 | Run `python CFLU_Pool_Build.py` | Completes without error; `cflu_tracks.js` updated |
| R9-2 | Reload app in browser | Track count reflects new pool |
| R9-3 | Run `python CFLU_Pool_Build.py --rebuild` | Full rebuild completes; `open_genre=2/3/5` states preserved (Invariant 9) |

---

## Known Limitations / Skipped

| # | Description | Reason |
|---|-------------|--------|
| L1 | Spotify export with >100 tracks requires a large pool | Only testable with a full production pool |
| L2 | AI genre tagging (`--reclassify-ai`) requires `anthropic_api_key.txt` | API key is local-only, not in repo |
| L3 | OAuth flow requires Spotify Client ID | `cflu_client_id.txt` is local-only, not in repo |

---

## Changelog

| Date | Change | Push / Issue |
|------|--------|--------------|
| 2026-06-10 | Initial test protocol created | docs: initial TESTING.md |
