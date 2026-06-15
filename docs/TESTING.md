# CFLU WOD Builder — Test Protocol

> **How to use this file**
> - Run the **Regression Suite** after every push to confirm nothing broke.
> - Run **New Since Last Push** to verify the specific changes introduced.
> - After confirming all tests pass, clear the *New Since Last Push* section (Claude handles this on confirmation).
> - Update this file in the same commit as any behaviour change (Step D4 mandate).

---

## New Since Last Push

### N9 · Track Replace: Generation Context Snapshot

| # | Step | Expected |
|---|------|----------|
| N9-1 | Generate a playlist for Genre A, Phase C | Note genre and phase selection |
| N9-2 | Change genre dropdown to Genre B | Genre badge updates; pool count changes |
| N9-3 | Click ↺ on any WOD track | Replacement candidate comes from Genre A / Phase C pool (original generation context), **not** the currently selected Genre B |
| N9-4 | Change phase selector to Phase A after generating a Phase C playlist | Phase A tile becomes active |
| N9-5 | Click ↺ on any WOD track | Replacement candidate respects Phase C BPM/energy constraints (generation context), not Phase A |

### N10 · Login Modal — Manual Trigger Only

| # | Step | Expected |
|---|------|----------|
| N10-1 | Start app fresh (no Spotify session on server) | Page loads normally; **no login modal auto-shown** |
| N10-2 | Click ▶ on any track row without Spotify connected | Login modal appears |
| N10-3 | Click "Mit Spotify verbinden" button in sidebar | Redirects directly to `/api/spotify/login` (OAuth flow) |
| N10-4 | After OAuth, reload page | `/api/spotify/status` restores session; device panel visible; no modal |
| N10-5 | After page reload with valid session | Page loads; modal does **not** appear |

### N6 · Track Replace — In-Place Swap

| # | Step | Expected |
|---|------|----------|
| N6-1 | Generate a playlist | Each WOD track (except REF) shows a ↺ button in the last column |
| N6-2 | REF track and Cool-Down tracks | No ↺ button visible |
| N6-3 | Click ↺ on a non-REF WOD track | Track is replaced in-place; BPM chart redraws; stats bar updates |
| N6-4 | Click ↺ on a track with very constrained neighbors | Yellow warning "Kein Ersatz für Slot N gefunden (BPM-Übergang oder Camelot-Filter zu eng)." appears for 4 s, then disappears |
| N6-5 | After replacement | New track satisfies BPM transition to both neighbors (no hard log2-score=0 jump) |
| N6-6 | Click ↺ multiple times on the same slot | Each swap brings a *different* track — previously swapped-out songs do not re-appear; blacklist resets when "▶ Playlist generieren" is clicked again |

### N7 · Spotify Device Control (Web API)

| # | Step | Expected |
|---|------|----------|
| N7-1 | Connect Spotify via "Mit Spotify verbinden" (new auth required for new redirect URI) | After OAuth callback, device panel appears; connect hint hidden; display name shown in sidebar |
| N7-2 | Open Spotify on any device (phone, desktop, etc.), then click ↻ in device panel | Device appears in the dropdown selector |
| N7-3 | Select a device from the dropdown, then click ▶ on any track row | Playback starts on the selected device from that track (Spotify Premium required) |
| N7-4 | Click ▶ on a track row without selecting a device | Status message "Bitte Gerät auswählen…" shown; no playback attempt |
| N7-5 | Click ↻ when no Spotify app is open on any device | Dropdown shows only "— Gerät wählen —" option; no error crash |
| N7-6 | Click "Mit Spotify verbinden" in the device panel while already logged in | Re-initiates OAuth (server uses `show_dialog=true`); existing token replaced after callback |
| N7-7 | Click "Abmelden" in the Spotify sidebar section | Device panel hides; connect hint reappears; spConnected resets to false |
| N7-8 | Reload the page after successful auth | Status auto-restored from server (`/api/spotify/status`); device panel shown without re-login |

### N8 · Explicit-Songs Filter

| # | Step | Expected |
|---|------|----------|
| N8-1 | Open sidebar | "Explicit-Songs" row visible between log2 toggle and Camelot-Lock; three chips: **Alle** (active/highlighted), **Kein E**, **Nur E** |
| N8-2 | Generate with "Alle" (default) | Playlist may include tracks with explicit flag; `[E]` badge visible on such tracks |
| N8-3 | Select "Kein E", generate | No `[E]`-badged track appears in WOD or Cool-Down |
| N8-4 | Select "Nur E", generate | All tracks carry the `[E]` badge; if pool has no explicit tracks, playlist is empty or uses fallback with a warning |
| N8-5 | Switch back to "Alle" | Active chip returns to "Alle"; explicit tracks reappear on next generation |

### N12 · UI-Modus-Tab-Leiste

| # | Step | Expected |
|---|------|----------|
| N12-1 | Load app | Three mode tabs visible below CFLU header: **⚡ Quick**, **🔧 Optimizer**, **⚙ Advanced** — Advanced highlighted as active |
| N12-2 | Click **⚡ Quick** | Quick panel shown; all Step 1–3 and Advanced generate button hidden; Quick tab highlighted |
| N12-3 | In Quick tab: type 2+ characters in "Song wählen" search | Matching tracks appear in list with artist, title, BPM, Camelot |
| N12-4 | Select a track from Quick search list | Selected-song card appears below list showing song name, artist, BPM, Camelot, genre; "⚡ Generieren" button enabled |
| N12-5 | Choose segment "C — WOD Intensiv" and position "Anfang", click "⚡ Generieren" | Playlist generated in the main result area — same output as Advanced mode |
| N12-6 | Choose segment "A — Warmup & Prep", click "⚡ Generieren" | Playlist uses Phase A energy/BPM defaults; plateau-style build |
| N12-7 | Click **🔧 Optimizer** | Optimizer placeholder panel shown: 🔧 icon + "Playlist-Optimizer / Coming soon — Issue #118" |
| N12-8 | Click **⚙ Advanced** | Full Step 1–3 sidebar reappears; previously generated playlist still visible; Advanced tab highlighted |
| N12-9 | Switch tabs rapidly (Quick → Advanced → Optimizer → Quick) | No crash; each switch shows the correct panel; result area unchanged |

### N11 · Everynoise xy-Score — Genre-Raum-Nähe

| # | Step | Expected |
|---|------|----------|
| N11-1 | Run `python CFLU_Pool_Build.py` | Output contains two new lines: `avg_color : N/M Tracks mit Farbdaten` and `avg_xy : N/M Tracks mit xy-Daten` (N should be ≥85% of M) |
| N11-2 | Open browser console, type `TRACK_DATA.tracks[0].avg_xy` on a track with genre data | Returns a two-element array e.g. `[0.502, 0.031]`; not null |
| N11-3 | Generate two playlists: one with tracks from the same genre, one from very different genres | The same-genre playlist should generally have higher total scores (Generierungs-Log visible) — no crash |
| N11-4 | Run `python CFLU_Pool_Build.py --check-xy-correlation` | Prints Pearson r between xy-distance and RGB-distance; prints interpretation line |

### N5 · log2 BPM-Übergangsscore — Neues Scoring-System

| # | Step | Expected |
|---|------|----------|
| N5-1 | Open sidebar | No "Max. BPM-Sprung" slider visible; replaced by "log2-Raum zulassen" toggle (unchecked by default) |
| N5-2 | Hover over "Half/Double-Time ×2/÷2" subtitle | Tooltip appears: "Wertet Tracks mit halbem/doppeltem Tempo als kompatibel (gleiches Beatgrid)." |
| N5-3 | Generate a playlist (log2 aktiv) | Generierungs-Log shows "log2-Score:      Half/Double aktiv" |
| N5-4 | Uncheck the log2 toggle, generate again | Generierungs-Log shows "log2-Score:      Half/Double inaktiv" |
| N5-5 | Re-check the toggle, generate again | BPM transitions stay within ±10 % on the log2 scale (d ≤ 0.135); no hard jumps visible in BPM chart |
| N5-6 | With log2 active, check BPM chart | Adjacent tracks may show ×2/÷2 BPM jumps (e.g. 80→160) which are scored as compatible transitions |

---

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

### R6 · Spotify Export & Auth

| # | Step | Expected |
|---|------|----------|
| R6-1 | Click "Mit Spotify verbinden" in sidebar | Redirect to `http://127.0.0.1:8888/api/spotify/login` → Spotify OAuth (Authorization Code Flow via server); no login modal appears automatically on page load |
| R6-2 | After auth, return to app | URL contains `?sp_connected=1`; device panel visible; no Spotify token in sessionStorage, localStorage, or cookies |
| R6-3 | Open DevTools → Application → Storage | No `sp_token`, `pkce_v`, `sp_cid`, or similar Spotify credential in any browser storage (Invariant 2) |
| R6-4 | Click "Export to Spotify" | Playlist created in Spotify; success message shown |
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
| L3 | OAuth flow requires Spotify Client ID + Client Secret | `cflu_client_id.txt` and `cflu_client_secret.txt` are local-only, not in repo |
| L4 | Device playback requires Spotify Premium | Free accounts cannot use `PUT /me/player/play` |

---

## Changelog

| Date | Change | Push / Issue |
|------|--------|--------------|
| 2026-06-15 | N12 UI-Modus-Tab-Leiste (Quick/Optimizer/Advanced) added | Phase 2 (#119) |
| 2026-06-15 | N11 Everynoise xy-Score added | Phase 2 (#132) |
| 2026-06-15 | N9 generation context snapshot; N10 login modal manual-trigger-only; R6-1/R6-2 updated for no auto-modal | Phase 1 (#147, #150, #152, #153) |
| 2026-06-15 | N5-1 default corrected (unchecked); N6-6 swap blacklist added; N8 Explicit-Songs Filter added; PROJECT.md C4 test count corrected (369) | Project Audit |
| 2026-06-14 | N7 replaced (Web Playback SDK → Device Control); N6-4 warning text corrected; R6 updated for Authorization Code Flow; L4 added | Spotify Integration Redesign |
| 2026-06-10 | Initial test protocol created | docs: initial TESTING.md |
