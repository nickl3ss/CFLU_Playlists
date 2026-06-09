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
├── cflu_client_id.txt          # Spotify Client ID (local, .gitignored)
├── cflu.service                # systemd user-service for Linux auto-start
├── docs/
│   ├── PROJECT.md              # Architecture, ADRs, changelog, Key Invariants
│   └── references/             # Background research — WOD music theory, genre network analysis
│       ├── WODability_Playlist-WodMusicTheory.md
│       ├── Genre_MatchingTheory.md
│       └── Genre_NetworkResearch.md
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
    ├── spotify.js              # PKCE auth + export — no token in localStorage (Invariant 2)
    ├── upload.js               # Pure CSV upload helpers — no DOM, no state
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

## Pool Builder — ETL Phases (E-T-L-C-G-A-M)

```
[E] Extract         reads Playlists/**/*.csv recursively; FileNotFoundError → _reclassify_only()
                    add-only: skips IDs already in pool before Transform (--rebuild: all IDs processed)
[T] Transform       CSV rows → track dicts; genres_raw empty allowed (open_genre=1)
[L] Load & Merge    add-only (default) or full-update (--rebuild); preserves dynamic fields
[*] Reset AI        --reclassify-ai only: resets open_genre=2 → 1, clears genres_raw
                    (explicit opt-in; not part of --rebuild)
[C] Cleanup         deduplication (artist+title key; locked=1 wins) — runs before G+A
[G] Genre inherit   open_genre=1 → 4: borrow genres_raw from same-artist tracks
[A] AI Genre        open_genre=1/4 → 2 or 5; BYOK via anthropic_api_key.txt; Claude Haiku
                    context per track: album+year, known artist genres from pool, inherited genres
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

**Preserve rules in `merge()` (rebuild-safe):**
- States `2`, `3`, `5`: `open_genre` preserved; for state-2: also `genres_raw` + `genre`
- State `4`: recalculated on every rebuild
- `mood_tags`: always preserved (both modes)

---

## Key Invariants (never break)

1. Redirect URI must be exactly `http://127.0.0.1:8888/CFLU_WOD_Builder.html`
2. Client ID must **not** be stored in localStorage; sessionStorage only temporarily for the OAuth redirect flow — cleaned up immediately after callback (`pkce_v` + `sp_cid`)
3. Spotify export: max. 100 tracks per batch (API limit) — always hard-cap
4. BPM must never go backwards in phase B/C (ascending phases)
5. BPM groups: max. ±1 step per move (except BPM escalation phase 4)
6. Phase 4 (BPM escalation) intentionally ignores energy filter and BPM groups
7. `cflu_tracks.js` must be loaded BEFORE the ES modules (`<script>` in `<head>`)
8. `CFLU_Start.bat` / `CFLU_Start.sh` always run pool build on startup — no CSV means reclassify-only mode
9. `open_genre=2/3/5` never overwritten by `--rebuild` — preserve logic in `merge()` is mandatory; `--reclassify-ai` is an explicit opt-in that intentionally resets state-2 for re-classification
10. `tag_genres_ai()` only sets `open_genre=5` when API actually responded (not on network/parse errors)
