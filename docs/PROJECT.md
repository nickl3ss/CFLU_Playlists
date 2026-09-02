# PROJECT.md — CFLU WOD Builder

> Technical reference for the CFLU WOD Builder. Covers architecture, data model, scoring algorithm, and architectural decision records (ADRs).
>
> **Domain theory** → `DOMAIN.md` · **Requirements** → `REQUIREMENTS.md` · **Test protocol** → `TESTING.md`  
> **Change history** → `git log` · **Open issues** → https://github.com/nickl3ss/CFLU_Playlists/issues

---

## Architecture

### Components

| ID | Name | Path | Responsibility |
|----|------|------|----------------|
| C1 | Pool Builder | `CFLU_Pool_Build.py` | ETL pipeline: reads `Playlists/**/*.csv`, deduplicates by Spotify track ID, writes `cflu_tracks.js`. Standard mode: add-only; `--rebuild` for full update. |
| C2 | WOD Builder UI | `CFLU_WOD_Builder.html` + `js/` + `css/` | Main UI: song selection, playlist generation, BPM chart, Spotify export |
| C3 | Track Data | `cflu_tracks.js` | Auto-generated track pool (non-module global `TRACK_DATA`) |
| C4 | Tests | `js/cflu_tests.js` + `CFLU_Tests.html` + `test_cflu_pool_build.py` | JS: canonical dual-mode test class (`node js/cflu_tests.js` → stdout + exit code; browser: `CFLU_Tests.html`). 440 tests. Python: `python -m unittest discover`, 27 tests, covers the ETL's pure functions. |
| C5 | Server | `cflu_server.py` | Local HTTP server (port 8888): serves static files, handles CSV upload, proxies all Spotify API calls |

### JS Modules (C2 internal)

| Module | Responsibility |
|--------|----------------|
| `js/config.js` | Constants only: `PHASE_CONFIG`, `BPM_RANGES`, `BPM_TRANSITION_CONFIG`, `TRANSITION_BUDGET`, `SCORE_WEIGHTS_DEFAULT`, colour stops, `bpmStopsForPhase()` |
| `js/state.js` | Single mutable app state — never import `app.js` (cycle prevention) |
| `js/utils.js` | Pure helpers: `bpmGroup`, `camCompat`, `calcBpmTransitionScore`, `calcSortScore`, `calcPhaseScore`, `calcEraScore`, `effectiveBpm`, `bpmHint`, `titleDuplicate`, `camelotZoneDistance` |
| `js/genres.js` | `GENRE_CONFIG`: 12 main genres, Everynoise-derived neighbour weights, bridge subgenres, role affinity |
| `js/algorithm.js` | Core generation: `_pick()` (genre-cascade), `buildUp/Down/Plateau/Decreasing/Alternating/End/PlateauSplit/Cooldown`, `pickReplacement` |
| `js/optimizer.js` | Playlist import, flow analysis (`analyseFlow`, `SCORE_GREEN`/`SCORE_YELLOW`), greedy reorder, gap fill — no DOM, no Spotify token handling |
| `js/chart.js` | BPM step chart + bidirectional hover synchronisation |
| `js/spotify.js` | Spotify auth proxy, playlist export, device control — browser never holds a token (Key Invariant 2) |
| `js/genre_space.js` | 3D Everynoise star map (Three.js) — reads state + `GENRE_MAP` + `TRACK_DATA`; writes canvas only |
| `js/upload.js` | CSV upload UI + polling (`_pollUploadStatus` against `/api/upload-status` — the ETL runs in a background thread server-side); pure helpers (`sanitizeFilename`, `extractPlaylistName`, `formatUploadSuccess`) — standalone `<script>` in HTML |
| `js/resolve.js` | `SOURCE_PRECEDENCE` + pure resolve functions — no DOM, no state, no Spotify calls |
| `js/register.js` | Pool Register tab — lazy-loads `data/*.json`, writes DOM only |
| `js/app.js` | UI wiring: imports all modules, event handlers, `_gen()`, `renderResult()`, init |

### Module Dependency Graph

```
cflu_tracks.js    (non-module global → TRACK_DATA)
cflu_genres.js    (non-module global → GENRE_MAP)
       ↓
config.js
       ↓
utils.js     (← config.js)
genres.js    (← config.js)
       ↓
algorithm.js  (← config, state, utils, genres)
optimizer.js  (← utils; algorithm for getAllTracks)
chart.js      (← state)
spotify.js    (← state)
genre_space.js (← state, GENRE_MAP, TRACK_DATA)
upload.js     (standalone <script>)
resolve.js    (standalone pure module)
register.js   (← resolve, spotify)
       ↓
app.js (← all modules)
```

---

## Data Model

### Track Object Fields

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `id` | string | Spotify CSV | Spotify track ID |
| `song` | string | Spotify CSV | Track title |
| `artist` | string | Spotify CSV | Artist name(s) |
| `bpm` | number | Chosic / Spotify CSV | Tempo in BPM |
| `camelot` | string | Chosic / Spotify CSV | Camelot key (e.g. `9B`) |
| `energy` | number 0–100 | Spotify audio feature | Perceptual intensity |
| `loud` | number dB | Spotify audio feature | Overall loudness |
| `valence` | number 0–100 | Spotify audio feature | Musical positiveness |
| `dance` | number 0–100 | Spotify audio feature | Danceability |
| `acoustic` | number 0–100 | Spotify audio feature | Acousticness confidence |
| `instrumental` | number 0–100 | Spotify audio feature | Instrumentalness confidence |
| `speech` | number 0–100 | Spotify audio feature | Speechiness |
| `live` | number 0–100 | Spotify audio feature | Liveness confidence |
| `dur` | number (s) | Spotify CSV | Duration in seconds |
| `genre` | string | ETL classify() | Main genre bucket (one of 12) |
| `genres_raw` | string[] | Spotify / Last.fm / AI | Raw genre/tag strings |
| `decisive_genre` | string | ETL | Tag that triggered genre classification |
| `open_genre` | 0–7 | ETL state machine | Genre provenance (see below) |
| `mood_tags` | string[] | AI (Claude Haiku) | Mood descriptors |
| `avg_color` | [R,G,B] | Everynoise CSV | Average Everynoise RGB for genres_raw |
| `avg_xy` | [x,y] | Everynoise CSV | Average Everynoise 2D position (normalised 0–1) |
| `album_date` | string | Spotify CSV | Release year (for era scoring) |
| `bpmg` | string | ETL | BPM group bucket |
| `explicit` | bool | Spotify CSV | Explicit content flag |
| `locked` | 0/1 | ETL | Deduplication preference |

### open_genre State Machine

| State | Name | Transition rule |
|-------|------|-----------------|
| `0` | Spotify Find | Base: `genres_raw` from Spotify CSV |
| `1` | No Find | Base: Spotify found no genre — transient, exhausted after full ETL |
| `2` | AI Find | From `1` or `4` — Claude Haiku ≥99 % confidence |
| `3` | User Find | From `5` — manual curation in Admin Panel (#105) |
| `4` | Auto Find | From `1` — inherited from same-artist track |
| `5` | No AI Find | From `1` — AI responded but could not classify; `4` stays `4` |
| `6` | Last.fm Find | From `1`, `4`, `5`, or `2` — Last.fm tags resolved to canonical genre |
| `7` | No Last.fm Find | From `5` **only** — AI already failed AND Last.fm found nothing; terminal |

**Preserve rules in `merge()` (rebuild-safe):** States `2`, `3`, `5`, `6`, `7` survive `--rebuild`; `genres_raw` + `genre` + `decisive_genre` preserved for states `2` and `6`. State `4` recalculated on every rebuild. State `7` is terminal: ignored by ETL phases [F] and [A].

### PHASE_CONFIG

Each phase entry contains: `bpm [lo, hi]`, `bpmCore [lo, hi]`, `energy {min, max}`, `dance {min, max}`, `valence {min, max}`, `loud {min}`, `instrumental {max}`, `acoustic {max}`, `label`.

Phase D (`bpm[0] = 60`) represents the slider minimum; gradients start at yellow, not red.

---

## ETL Pipeline (Pool Builder)

```
[E] Extract         reads Playlists/**/*.csv recursively
                    add-only: skips IDs already in pool before [T]
                    --rebuild: all IDs processed
[T] Transform       CSV rows → track dicts; genres_raw empty allowed (open_genre=1)
[L] Load & Merge    add-only (default) or full-update (--rebuild); preserves dynamic fields
[*] Reset AI        --reclassify-ai only: resets open_genre=2 → 1, clears genres_raw
[C] Cleanup         deduplication (artist+title key; locked=1 wins) — runs before G+F+A
[G] Genre inherit   open_genre=1 → 4: borrow genres_raw from same-artist tracks (sources 0,2,4,6)
[F] Last.fm Genre   open_genre=1/4/5/2 → 6; track.getTopTags + artist.getTopTags fallback
[A] AI Genre        open_genre=1/4 → 2 or 5; Claude Haiku; skips open_genre=6
[*] Color Enrich    avg_color + avg_xy per track from Everynoise CSV — runs after [A]
[M] Mood Tags       Claude Haiku batch tagging; skips already-tagged tracks
```

---

## Scoring Algorithm

### calcBpmTransitionScore(bpmPrev, bpmNext) → [0.0, 1.0]

Evaluates BPM transition quality using a **Ratio Lattice** of seven integer relationships:

```
{ p:1, q:1, w:1.00 }   — same tempo
{ p:2, q:1, w:1.00 }   — double time
{ p:1, q:2, w:1.00 }   — half time
{ p:3, q:2, w:0.90 }   — 3:2 ratio
{ p:2, q:3, w:0.90 }   — 2:3 ratio
{ p:4, q:3, w:0.78 }   — 4:3 ratio
{ p:3, q:4, w:0.78 }   — 3:4 ratio
```

For each ratio, `target = bpmPrev × p/q`, `d = |log₂(bpmNext / target)|`. The best (lowest d) ratio wins. Score = `proximity(d) × lock_weight`.

Proximity bands:
- `d ≤ 0.030` → 1.00 (≈±2 %, inaudible)
- `d ≤ 0.070` → 0.85 (linear interpolation from 0.030)
- `d ≤ 0.135` → 0.40 (linear interpolation from 0.070)
- `d > 0.135` → 0.00 (hard exclusion)

Score 0.00 is a **hard gate**: the track is excluded from the candidate pool regardless of other scores.

### calcSortScore(track, cur, phase, scoreWeights) → integer

Distributes `TRANSITION_BUDGET = 500` across 7 normalised audio-transition components weighted by `scoreWeights`:

| Component | Normalisation | Default weight |
|---|---|---|
| `bpmNorm` | `calcBpmTransitionScore(cur.bpm, t.bpm)` → [0,1] | 40 |
| `camNorm` | green=1.0 / yellow=0.5 / red=0.0 | 20 |
| `energyNorm` | `t.energy / 100` | 15 |
| `loudNorm` | `max(0, 7 − |Δloud|) / 7` | 10 |
| `valNorm` | `max(0, 30 − |Δvalence|) / 30` | 8 |
| `danceNorm` | `max(0, 25 − |Δdance|) / 25` (Phase B/C only) | 7 |
| `popNorm` | `min(1, t.popularity / 65)` — 65+ = full score | 5 |

`transScore = round(500 / totalWeight × Σ(weight_i × norm_i))`

Added to `transScore`: phase fitness points (`calcPhaseScore × 2`), bridge-subgenre bonus (+50), energy-direction bonus, mood-tag overlap, Everynoise colour score, xy-displacement score, era score.

Default weights (`SCORE_WEIGHTS_DEFAULT`): `{ bpm:40, camelot:20, energy:15, loudness:10, valence:8, dance:7, popularity:5 }`. User-configurable via the 7-axis spider-web UI panel; persisted in `localStorage` under `cflu_score_weights`.

### Optimizer Score Thresholds (SCORE_GREEN / SCORE_YELLOW)

`js/optimizer.js`'s `analyseFlow()` buckets each transition's `calcSortScore()` result into green/yellow/red for the flow report using two thresholds, last recalibrated 2026-07-15 (#160) after `genreDistScore` expanded from `[0,10]` to `[0,25]` (cosine similarity on Last.fm `genre_conf` vectors):

```
SCORE_GREEN  = 330   (was 320)
SCORE_YELLOW = 210   (was 200)
```

**Methodology**: measured 2026-07-15 against the real pool as it then stood (10,990 tracks, 45% with `genre_conf` populated — just under the 50% coverage originally targeted, judged sufficient to be representative; the pool has since grown to 11,832 tracks (#209) without recalibration — a recalibration is only worthwhile after the Last.fm resync of #210 raises `genre_conf` coverage) using two proxies:
- *Well-curated proxy*: same-genre tracks sorted by BPM, adjacent pairs within 15 BPM (~11,000 transitions) — approximates what a good generation/curation produces.
- *Unoptimized proxy*: 3,000 uniformly-random track pairs across the whole pool — approximates an arbitrary, un-optimized Spotify playlist import.

| Thresholds | Well-curated: green/yellow/red | Unoptimized: green/yellow/red |
|---|---|---|
| 320/200 (old) | 98.3% / 1.4% / 0.2% | 79.9% / 16.9% / 3.2% |
| 330/210 (new) | 97.6%\* / — / — | 77.6% / 18.7% / 3.7% |
| 340/220 | 97.6% / 2.1% / 0.3% | 74.2% / 21.3% / 4.4% |

\*Interpolated between the 320/200 and 340/220 rows measured directly.

**Conclusion**: the originally-assumed target of "~50% green for a well-curated playlist" (from the issue as filed, before this data existed) turned out to be miscalibrated — a genuinely well-ordered playlist should read as *mostly* green with a few flagged pinch points, not a 50/50 split. The thresholds already discriminate meaningfully between curated and unoptimized orderings at both 320/200 and 330/210; the `genreDistScore` expansion's inflationary effect is real but small (roughly 1–3 percentage points of green at any given threshold). Moved to 330/210 as a modest, evidence-informed correction rather than the dramatic jump the original issue speculated about.

### _pick() — Genre-Cascade Candidate Selection

Every candidate must pass `baseOk()` (or `baseOkNoEnergy()` in stufe 4): BPM gate (`calcBpmTransitionScore < BPM_GATE_MIN_SCORE` → reject), monotonicity (`effectiveBpm`; ascending phases may step back by at most `MONO_STEP_BACK_BPM`, descending phases never step forward), title dedup, per-artist cap, Camelot lock, explicit filter, and — except where noted below — the energy filter (`wodEnergyMin/Max`).

The candidate pool is built by cascading through genre-relatedness stages until one yields results:
1. Same subgenre (`genres_raw` overlap with the current track)
2. Same main genre, different subgenre
3. Bridge-pivot track connecting the current genre to a neighbour genre
4. Neighbour main genre (by weight) — energy filter is relaxed only for half/double-time BPM matches (`isHalfDouble`)
5. Camelot-only fallback (genre ignored) — used when genre context is missing or stufen 1–4 are exhausted; still enforces the full BPM gate, monotonicity, and energy filter via `baseOk()`

Within whichever stage succeeds, Camelot compatibility is progressively relaxed by `applyInnerCamelot()` (Zone1/2 green → any green → non-red) until candidates remain. Unlike the two tiers before it, the final "non-red" tier is never further relaxed — red transitions are a hard gate (REQUIREMENTS.md §3.2, ADR 18) and `applyInnerCamelot()` returns empty rather than falling back to an unfiltered (potentially red) subset.

Once the final candidate set is resolved, all candidates are scored by `calcSortScore()` and the top 5 are shuffled via `crypto.getRandomValues()` — one random pick at the end, not per-stage — to avoid deterministic repetition across generations.

---

## Key Invariants

These must never be broken by any implementation change:

1. Redirect URI must be exactly `http://127.0.0.1:{PORT}/api/spotify/callback` — must match Spotify Dashboard
2. `client_secret` and `refresh_token` must never leave `cflu_server.py` — browser never holds a Spotify token
3. Spotify export: max 100 tracks per batch (API limit) — always hard-cap
4. BPM in ascending phases (B/C) may step back by at most `MONO_STEP_BACK_BPM` (10 effective BPM) per pick; the overall trend must rise — enforced by `getPhasePool` BPM-band filter (tracks outside the phase band are excluded at pool level)
5. BPM groups: max ±1 step per move — enforced uniformly across every `_pick()` genre-cascade stage via `baseOk()`/`bpmOk()`; no stage bypasses this
6. `_pick()`'s final fallback stage (Camelot-only, genre ignored) still enforces the full BPM gate and energy filter via `baseOk()` — only stufe 4 (neighbour main genre) conditionally relaxes the energy filter, and only for half/double-time BPM matches (`isHalfDouble`)
7. `cflu_tracks.js` must be loaded BEFORE the ES modules (`<script>` in `<head>`)
8. `CFLU_Start.bat` / `CFLU_Start.sh` always run pool build on startup — no CSV → `_reclassify_only()` mode
9. `open_genre=2/3/5/6/7` never overwritten by `--rebuild`; `--reclassify-ai` resets state-2 only; state-7 is terminal
10. `tag_genres_ai()` only sets `open_genre=5` when the API actually responded (not on network/parse errors)

---

## Architectural Decision Records (ADR)

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Vanilla ES modules, no build system | No Node.js needed; direct browser import via Python http.server; maximum transparency | 2024 |
| 2 | `cflu_tracks.js` as non-module global `<script>` | Lazy access from ES modules without top-level import; importable in tests without real data | 2025 |
| 3 | ~~Spotify PKCE~~ → superseded by ADR 15 | Originally PKCE in browser. Replaced by server-side Authorization Code Flow. | 2024 |
| 4 | `cflu_server.py` as local server | Custom handler with `POST /api/upload-csv`; Spotify OAuth requires `http://` redirect (not `file://`) | 2024/2026 |
| 5 | `cflu_tracks.js` tracked in repo | Full usability after clone without pool rebuild; update after CSV change | 2025 |
| 6 | `state.poolGenre` as single source of truth for generation genre | `genre-sel` dropdown controls filter UI only; direct search and Spotify link set `poolGenre` from track | 2026-06-06 |
| 7 | Direct search bypasses Camelot/energy filters | Reference song selection must not be constrained by generation filters | 2026-06-06 |
| 8 | Test class as dual-mode ES module | Separation of test logic and HTML rendering; `node js/cflu_tests.js` works without browser/server for CI | 2026-06-06 |
| 9 | ETL default: add-only, not full-update | AI-curated (`open_genre=2`) and manual (`open_genre=3`) fields must survive a startup build | 2026-06-08 |
| 10 | `open_genre` state machine | Spotify provides genre only at artist level; `open_genre` tracks provenance and enables step-wise improvement without data loss | 2026-06-08 |
| 11 | ETL [C] Cleanup before [G] and [A] | Deduplicate before any API call — no Claude Haiku cost wasted on tracks that will be removed | 2026-06-09 |
| 12 | `decisive_genre` field | `find_decisive_genre_tag()` identifies the specific `genres_raw` tag that triggered classification; used in UI display | 2026-06-09 |
| 13 | Three.js vendored in `js/vendor/` | CSP (`script-src 'self'`) blocks external script domains; vendored files maintain offline capability | 2026-06-10 |
| 14 | log₂ distance for BPM transition scoring | Absolute BPM delta is tempo-dependent; log₂ distance is tempo-invariant and matches DJ perception model | 2026-06-12 |
| 15 | Spotify Authorization Code Flow (server-side) | PKCE stored token in browser; incompatible with iOS Web Crypto restrictions; `client_secret` must never leave the server (Key Invariant 2) | 2026-06-14 |
| 16 | `xyScore` as orthogonal complement to `colorScore` | Everynoise xy and RGB encode partially independent audio dimensions (Pearson r = 0.51); combined signal is richer | 2026-06-15 |
| 17 | Ratio-Lattice BPM scoring; full lattice always active | ADR 14 log₂ model extended to 7 integer-ratio lock positions (1:1, 2:1, 1:2, 3:2, 2:3, 4:3, 3:4) with per-ratio weights; `allowLog2` toggle removed — full lattice runs unconditionally. `TRANSITION_BUDGET = 500` distributed across 7 normalised components via `scoreWeights`; default weights configurable via spider-web UI. | 2026-06-19 |
| 18 | Camelot red transitions are a hard gate, not a score component | REQUIREMENTS.md §3.2: unlike BPM/energy/valence, there is no "somewhat compatible" key transition — a red transition is enforced as an exclusion filter (`applyInnerCamelot`, and an explicit `camCompat !== 'red'` check) in every generation/replacement path (`_pick`, `pickReplacement`, `buildDown`, `buildDecreasing`, `buildPlateauSplit`), not folded into `calcSortScore`'s weighted sum. `camNorm` remains in `calcSortScore` as a soft green-vs-yellow tiebreaker *among* gate-passing candidates — the gate is about exclusion, not eliminating preference. | 2026-07-15 |
| 19 | Long-running HTTP handlers run in a background thread + poll endpoint | `cflu_server.py` is a plain `socketserver.TCPServer` (single-threaded) — any handler that blocks for more than a few hundred ms freezes every other endpoint, including the Spotify playback proxy. Established first for Last.fm full-sync (`_handle_lastfm_sync` + `/api/lastfm/progress`), then applied to CSV upload (`_handle_upload` + `/api/upload-status`): save fast, spawn a daemon thread for the slow ETL work, return immediately, let the client poll a `{running, ...}` state dict. | 2026-07-15 |
| 20 | `NEIGHBOUR_OVERRIDES` covers both directions | `scripts/build_genre_config.py`'s override table originally only let a genre override its *own* auto-computed neighbour list (e.g. Deutsche Musik). Extended to also override how a genre appears as *someone else's* neighbour (EDM / Electronic's Deutsche Musik weight was auto-computed at 1.0 — a sonic-feature artifact from Eurodance's audio-feature overlap with EDM, not a real genre adjacency). A new 0.3 "demoted fallback" weight tier is reserved for this override case, distinct from the auto-computed rank tiers {0.5, 0.7, 1.0}. | 2026-07-15 |
