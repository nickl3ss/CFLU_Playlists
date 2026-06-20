# CLAUDE.md — CFLU WOD Playlist Builder

## Communication
- Brief, precise, no padding.
- Always clarify assumptions before implementing.
- Structured responses: bullet points > prose.

---

## Stack

- **Runtime:** Python 3
- **Test:** `node js/cflu_tests.js` (Node.js, no browser needed) · `CFLU_Tests.html` (browser visualisation)
- **Lint:** `npm run lint` (ESLint 9) · `ruff check .` (Python)
- **Build:** `python CFLU_Pool_Build.py` (generates `cflu_tracks.js`)

---

## Project Structure

```
/
├── CLAUDE.md                   # This file — workflow rules (tracked in git)
├── README.md                   # Project overview and user guide
├── package.json                # {"type":"module"} — enables node js/cflu_tests.js
├── pyproject.toml              # Ruff linter config (Python)
├── eslint.config.js            # ESLint 9 flat config (JS)
├── keyvault/                   # All secrets (gitignored — never committed)
│   ├── cflu_client_id.txt      # Spotify Client ID
│   ├── cflu_client_secret.txt  # Spotify Client Secret
│   ├── cflu_refresh_token.txt  # Spotify OAuth refresh token (auto-written)
│   ├── anthropic_api_key.txt   # Anthropic API key (for AI genre + mood tagging)
│   ├── lastfm_api_key.txt      # Last.fm API key
│   ├── lastfm_api_secret.txt   # Last.fm API secret
│   └── DB.txt                  # Online DB credentials
├── cflu.service                # systemd user-service for Linux auto-start
├── docs/
│   ├── DOMAIN.md               # Domain theory: sports science + music theory (no implementation)
│   ├── REQUIREMENTS.md         # What the system must do (MUST/SHOULD/MAY) — derived from DOMAIN.md
│   ├── PROJECT.md              # Architecture, data model, scoring algorithm, ADRs, Key Invariants
│   ├── TESTING.md              # Manual + regression test protocol (updated per commit)
│   ├── implementationPrompts/  # Historical Claude Code implementation prompts (reference only)
│   └── references/             # Background research: WOD music theory, genre network, BPM theory
│       ├── WODability_Playlist-WodMusicTheory.md
│       ├── Genre_MatchingTheory.md
│       ├── Genre_NetworkResearch.md
│       ├── Genre_Position-Aware_Displacement.md
│       ├── BPM_theory.md
│       ├── API_Guide_Spotify.md
│       └── API_Guide_Last.fm.md
├── Playlists/                  # Spotify CSV exports (source data for pool build — .gitignored)
├── .github/
│   └── ISSUE_TEMPLATE/
│       └── backlog-item.md
├── CFLU_WOD_Builder.html       # [WOD] Main UI (markup only — no inline logic)
├── CFLU_Tests.html             # [TST] Browser renderer — thin shell, imports js/cflu_tests.js
├── cflu_tracks.js              # [TRK] Auto-generated track pool (tracked; do not edit manually)
├── CFLU_Pool_Build.py          # [PLB] Pool builder (reads Playlists/*.csv, writes cflu_tracks.js)
├── cflu_server.py              # [PLB] Custom HTTP server (port 8888, POST /api/upload-csv)
├── CFLU_Start.bat              # Windows launcher (runs pool build + starts server + opens browser)
├── CFLU_Start.sh               # macOS/Linux launcher (identical logic to .bat)
├── css/
│   └── cflu_style.css
└── js/
    ├── cflu_tests.js           # [TST] Canonical test class (dual-mode: Node + browser export)
    ├── config.js               # Constants only — no DOM, no state, no TRACK_DATA
    ├── state.js                # Single mutable app state — never import app.js (cycle)
    ├── utils.js                # Pure helpers — no DOM, no state, no TRACK_DATA
    ├── genres.js               # GENRE_CONFIG — single source of truth for genre logic
    ├── algorithm.js            # Playlist generation — no DOM, no state writes
    ├── chart.js                # BPM chart — reads state, writes canvas only
    ├── spotify.js              # Auth proxy + export + device control — browser never holds Spotify token (Invariant 2)
    ├── genre_space.js          # 3D genre/BPM visualisation (Three.js) — reads state + TRACK_DATA, writes canvas only
    ├── optimizer.js            # Playlist import, flow analysis, reorder, gap fill — no DOM, no token handling
    ├── upload.js               # CSV upload UI (standalone <script> in HTML) + exported pure helpers (Node.js-safe)
    ├── resolve.js              # SOURCE_PRECEDENCE + pure resolve functions — no DOM, no state, no Spotify calls
    ├── register.js             # Pool Register tab — lazy-loads data/*.json, writes DOM only; no Spotify, no state mutation
    └── app.js                  # UI wiring — imports all modules; no business logic
```

### Components

| Abbr. | Name | Path | Description |
|-------|------|------|-------------|
| **PLB** | Pool Builder | `CFLU_Pool_Build.py` | Python ETL pipeline: reads `Playlists/*.csv`, generates `cflu_tracks.js` |
| **WOD** | WOD Generator | `CFLU_WOD_Builder.html` + `js/` | Main app: playlist logic, scoring, UI, Spotify export |
| **TRK** | Track Store | `cflu_tracks.js` | Auto-generated track pool (non-module global `TRACK_DATA`) |
| **TST** | Test Suite | `js/cflu_tests.js` · `CFLU_Tests.html` | Dual-mode: `node js/cflu_tests.js` for Claude Code / CI; browser for visualisation |

---

## Reference Documents (`docs/references/`)

These files are **background research only** — they document the scientific basis for the algorithm but are not primary project documentation.

**Rules:**
- Do **not** read or cite reference documents unless the user explicitly asks.
- Before using a reference document to inform an implementation decision, state which file and ask for permission.
- When an implementation draws on reference material, document the relevant essentials in `docs/PROJECT.md` with a one-line attribution (e.g. `— see docs/references/Genre_MatchingTheory.md`). Do not copy large passages.

---

## Workflow

> **Source of Truth: GitHub Issues** (https://github.com/nickl3ss/CFLU_Playlists/issues)
> `BACKLOG.md` is archived — do not use.

### GitHub Projects

| Project | URL | Scope |
|---------|-----|-------|
| **CFLUPlaylist-Local** | https://github.com/users/nickl3ss/projects/2 | Local app: Issues #1–#30, #61–current. Active focus. |
| **CFLUPlaylist-Web** | https://github.com/users/nickl3ss/projects/3 | Web app variant: Issues #31–#60. **Parked** — do not implement. |

Always assign new issues to the relevant project (`gh project item-add <nr> --owner nickl3ss --url <issue-url>`).

### Issue Format

**Title:** `[ABBR] Short description` — e.g. `[WOD] pickNext() Phase 3.5`
**Labels:** Type (`bug` / `enhancement` / `documentation`) + Priority (`P1`–`P4`) + Component (`WOD` / `PLB` / `TRK` / `TST`)

**Body template:**
```
## Beschreibung
<!-- Was soll geändert werden? Warum? -->

## Algorithmus / Umsetzung
<!-- Optional: konkrete Schritte oder Pseudocode -->

## Betroffene Module
<!-- Welche Module werden geändert? Welche explizit NICHT? -->
- Ändert:
- Berührt nicht:

## Akzeptanzkriterium
- [ ] ...
```

---

## Step 0 · Session Opener (mandatory at the start of every conversation)

Before accepting any request, run these four checks and report the results in one short block:

```
1. git log --oneline -5          → know what just changed
2. gh issue list --state open    → know what is active
3. node js/cflu_tests.js         → confirm baseline (report: N/N passed)
4. Read docs/PROJECT.md          → confirm ADRs and Key Invariants are loaded
```

Only then accept the first request. If any check fails (e.g. red tests), report it before proceeding.

---

## Step A · New Request

1. Run **Step 0** if not already done this session.
2. **Small change?** (single UI string, CSS value, copy, or trivial rename with no design decision) → **Step A3-Quick**.
3. State open assumptions as numbered questions — **one round, then wait**.
4. After reply → Step B.

### A3-Quick · Fast track (small changes only)

**Not eligible** if the change touches: `state.js`, `spotify.js`, `algorithm.js`, `cflu_server.py`, or any Key Invariant (see below).

1. Identify the one file that changes. Read the relevant section. Confirm no Key Invariant applies.
2. Ask one short question about motivation, then wait for reply.
3. Create a minimal GitHub issue (`gh issue create`): component, priority, one-line reason.
4. Go directly to **Step D**.

---

## Step B · Issue Segmentation

1. Break the request into atomic issues.
2. Present issues as a preview (title + labels + body draft including `Betroffene Module`).
3. **User confirms** → create GitHub issues (`gh issue create`).

---

## Step C · Prioritisation

1. Suggest top-3 issues by priority (one-sentence justification each).
2. User confirms or provides alternative issue numbers.

---

## Step D · Implementation (per issue)

Follow this order strictly:

**D1 · Prior Art Check — before writing any new function:**
- New scoring/weighting? → read `js/utils.js` (`calcPhaseScore`, `calcSortScore`)
- New state variable? → read `js/state.js` completely
- New genre logic? → read `js/genres.js` (`GENRE_CONFIG` is the SSOT)
- New selection/filter? → read `js/algorithm.js` (`_pick`, `getPool`, `getPhasePool`)
- New server endpoint? → read `cflu_server.py` completely
Report what you found and whether you are extending existing code or creating new.

**D2 · Implement:**
Scope determines file: `js/` · `css/` · HTML · Python.
Every new file must open with a **module contract comment** — one line: what this module owns and what it must not do. Example:
```js
// algorithm.js — playlist generation only; no DOM, no state writes, no Spotify calls
```

**D3 · Quality Gate — run in order, all must pass:**
```
a. node js/cflu_tests.js      → must exit 0
b. npm run lint               → errors block; warnings are informational
c. ruff check .               → only if Python files changed
```
If `a` fails: iterate until green (max 2 rounds). After 2 failures: stop, report error, wait for decision.
Do **not** skip with `--no-verify`.

**D4 · Tests:**
Update or create test cases in `js/cflu_tests.js` for any new or changed behaviour.
If the change affects user-visible behaviour, update `docs/TESTING.md`:
- Add steps to **New Since Last Push** if a feature was added or changed
- Revise **Regression Suite** if an existing step no longer applies
Commit the `docs/TESTING.md` update in the same commit as the code change.

**D5 · Close — Acceptance Criteria review:**
Before closing, re-read the issue's `Akzeptanzkriterium`. Post a close comment listing each criterion as ✓ or ✗. Only close if all ✓.
```
gh issue close <nr> --reason "completed" --comment "AC: ✓ ... ✓ ... ✓ ..."
```

**D6 · Report:** issue #, changed files, test count.

---

## Issue Rules

- **Never delete** issues — only close them.
- Priority: `P1` (critical) · `P2` (high) · `P3` (normal) · `P4` (nice-to-have).
- Type labels: `bug` · `enhancement` · `documentation` · `wontfix`
- `parked` label: issues #31–#60 (Web variant) — do not implement.

---

## Git

- Commits: `<type>(<scope>): <what>` — e.g. `feat(algorithm): add plateau builder`
- Types: `feat` · `fix` · `test` · `docs` · `chore`
- No commit without green tests (Step D3).

---

## Step E · Push Gate

### E1 · Push Prompt
After any change that touches a core module (`algorithm.js`, `state.js`, `spotify.js`, `cflu_server.py`, `cflu_tracks.js`, `genres.js`, `CFLU_Pool_Build.py`) or closes a `P1`/`P2` issue, ask:
> "Significant change done. Push to origin?"

### E2 · Pre-Push Audit (runs when push is confirmed)
Four personas review the diff + whole project state and each produce a finding list:

**ME — The German Mechanical Engineer**
Engineering excellence, latest SE patterns, CI rigor, clean architecture. Never satisfied.
Flags: code smells, missing abstraction, untested paths, doc gaps, outdated patterns.

**PhD — The Mathematical PhD (aspiring EE)**
Calm and precise. Data protection, algorithmic correctness, edge-case coverage, optimization.
Flags: unsound logic, missing guards, informal contracts, privacy leaks, inefficient paths.

**BI — The Bioinformatician (fantastic beast)**
Curious and inventive. Listens to user ideas, imagines features that aren't there yet, and prunes what is.
Owns: feature ideation, architecture/UI/feature optimization, dead-weight elimination.
Flags: missing opportunities, feature bloat, redundant components, awkward UX-architecture fit, scope creep.

**UX — The Chill Non-IT User**
Uses the app, not the code.
Flags: confusing labels, missing feedback, broken flows, ergonomic friction, visual inconsistency.

Each finding is classified:
- **Quick Win** → fix immediately; include in this push before `git push`
- **Issue** → `gh issue create` with standard template, assign to CFLUPlaylist-Local project

### E3 · Post-Push Test Request
After push + quick wins applied, send:
> "Push done. Please test — steps in `docs/TESTING.md`."

Present the **New Since Last Push** section from `docs/TESTING.md` as the active test list, followed by the **Regression Suite** summary.

After user confirms testing is done, clear the **New Since Last Push** section and commit:
`docs(testing): clear new-features section after confirmed test`

---

## Pool Builder — ETL Phases (E-T-L-C-G-A-M)

```
[E] Extract         reads Playlists/**/*.csv recursively; FileNotFoundError → _reclassify_only()
                    add-only: skips IDs already in pool before Transform (--rebuild: all IDs processed)
[T] Transform       CSV rows → track dicts; genres_raw empty allowed (open_genre=1)
[L] Load & Merge    add-only (default) or full-update (--rebuild); preserves dynamic fields
[*] Reset AI        --reclassify-ai only: resets open_genre=2 → 1, clears genres_raw
                    (explicit opt-in; not part of --rebuild; does NOT reset open_genre=6)
[C] Cleanup         deduplication (artist+title key; locked=1 wins) — runs before G+F+A
[G] Genre inherit   open_genre=1 → 4: borrow genres_raw from same-artist tracks (sources: 0,2,4,6)
[F] Last.fm Genre   open_genre=1/4/5/2 → 6; BYOK via keyvault/lastfm_api_key.txt
                    track.getTopTags first, artist.getTopTags as fallback; min count=15
                    can set multiple canonicals in genres_raw; AI must not overwrite state 6
                    open_genre=5 + no Last.fm result → open_genre=7 (both failed, no retry)
                    network error (None return) → open_genre unchanged (not counted as "no find")
[A] AI Genre        open_genre=1/4 → 2 or 5; BYOK via keyvault/anthropic_api_key.txt; Claude Haiku
                    context per track: album+year, known artist genres from pool, inherited genres
                    skips open_genre=6 (Last.fm already classified)
[*] Color Enrich    avg_color per track from Everynoise hex data — runs after A, before M; no label
[M] Mood Tags       Claude Haiku batch tagging; skips already-tagged tracks
```

## open_genre — State Machine

| State | Name | Transition |
|-------|------|------------|
| `0` | Spotify Find | base state — `genres_raw` from CSV |
| `1` | No Find | base state — transient, exhausted after full ETL |
| `2` | AI Find | from `1` or `4` — Claude confident ≥99% |
| `3` | User Find | from `5` — manually set in Admin Panel (#105) |
| `4` | Auto Find | from `1` — inherited from same-artist track |
| `5` | No AI Find | from `1` — Claude responded but couldn't classify; `4` stays `4` |
| `6` | Last.fm Find | from `1`, `4`, `5` or `2` — Last.fm tags resolved to genre (#155) |
| `7` | No Last.fm Find | from `5` only — AI already failed AND Last.fm also found nothing; ignored by both [F] and [A] |

**Preserve rules in `merge()` (rebuild-safe):**
- States `2`, `3`, `5`, `6`, `7`: `open_genre` preserved; for states `2`+`6`: also `genres_raw`, `genre`, `decisive_genre`
- State `4`: recalculated on every rebuild
- `mood_tags`: always preserved (both modes)

---

## Key Invariants (never break)

1. Redirect URI must be exactly `http://127.0.0.1:{PORT}/api/spotify/callback` (default PORT=8888) — must match Spotify Dashboard exactly
2. `client_secret` and `refresh_token` must **never** leave the server (cflu_server.py). The browser never holds a Spotify token — all API calls proxied through `POST /api/spotify/call`.
3. Spotify export: max. 100 tracks per batch (API limit) — always hard-cap
4. BPM in ascending phases (B/C) may step back by at most `MONO_STEP_BACK_BPM` (10 BPM effective) per pick; large backward steps are forbidden. Overall trend must rise — enforced by `getPhasePool` BPM-band filter preventing out-of-band drift.
5. BPM groups: max. ±1 step per move (except _pick() stage 4 BPM escalation)
6. _pick() stage 4 (BPM escalation) intentionally ignores energy filter and BPM groups — last resort within _pick(), not a UI phase
7. `cflu_tracks.js` must be loaded BEFORE the ES modules (`<script>` in `<head>`)
8. `CFLU_Start.bat` / `CFLU_Start.sh` always run pool build on startup — no CSV means reclassify-only mode
9. `open_genre=2/3/5/6/7` never overwritten by `--rebuild` — preserve logic in `merge()` is mandatory; `--reclassify-ai` resets state-2 only (not 6 or 7); state-7 is terminal: ignored by both [F] and [A]; only set from state-5 (never from 1, 4, or 2)
10. `tag_genres_ai()` only sets `open_genre=5` when API actually responded (not on network/parse errors)
