# CFLU WOD Builder — Requirements

> This document describes **what** the system must do and why. It is derived from domain theory in `DOMAIN.md` and is intentionally free of implementation detail. When implementation decisions are referenced, they belong in `PROJECT.md` (the how) or in GitHub Issues (the change backlog).
>
> Format: narrative with embedded **MUST** (hard requirement) / **SHOULD** (strong preference) / **MAY** (acceptable option). Where precise thresholds are implementation decisions rather than domain requirements, they are noted as such.

---

## 1. Vision

CrossFit coaches spend significant time building playlists manually. Most existing tools (streaming radio, AI playlists) generate music that ignores the four-phase energy structure of a CrossFit class — they produce a uniform-energy playlist appropriate for one phase, not a journey across four.

CFLU WOD Builder solves this for a single trainer working with a personal music library: given a reference song and a target phase, generate a playlist that follows the correct energy arc, transitions smoothly between tracks, and can be exported directly to Spotify.

The system is **local-first**: it runs on the trainer's own machine, uses only their own music, stores no credentials in the browser, and operates without an internet connection except for Spotify playback and export. See `PROJECT.md §Key Invariants` for the security constraints that follow from this.

---

## 2. Phase Requirements

The system MUST enforce the four-phase energy arc described in `DOMAIN.md §1`. Each phase has distinct constraints on tempo, energy, and musical character.

### 2.1 Warmup & Prep (Phase A)

The purpose is gentle physical activation and coach communication. Athletes must be able to hear the coach without effort.

The system MUST select tracks whose tempo supports motor activation without creating arousal that competes with the coach's briefing. Energy level MUST be low. Instrumental tracks SHOULD be preferred — lyrics compete for cognitive attention during instruction. Duration is typically 5–15 minutes.

### 2.2 Skill & Strength (Phase B)

Athletes perform technical movements requiring focus. Overstimulation impairs technique.

The system MUST select tracks that provide moderate energisation without driving athletes toward peak arousal. Tempo MUST be moderate — fast tempos are counterproductive for technical Olympic lifts. The playlist MUST ascend gradually through this phase, never reversing direction. Duration is typically 10–20 minutes.

### 2.3 WOD / Intensive (Phase C)

Athletes operate near or above 75 % VO2max. At this intensity, RPE reduction from music is minimal; the music functions through arousal, motivation, and identity.

The system MUST select high-energy tracks with strong rhythmic drive. Tempo SHOULD be in the 140–180 BPM range for most workout styles (see `DOMAIN.md §2.3` for genre-specific variations). BPM MUST only increase within this phase — never step backward. Duration is typically 10–25 minutes.

### 2.4 Cool-Down (Phase D)

Athletes need physiological downregulation: heart rate reduction, parasympathetic activation.

The system MUST select tracks with descending energy and tempo. BPM MUST only decrease within this phase. The first Cool-Down track SHOULD connect rhythmically to the last WOD track — the 2:1 half-time relationship (`DOMAIN.md §3.3`) is the cleanest mechanism for this transition. Duration is typically 5–20 minutes.

---

## 3. Transition Requirements

Transitions between consecutive tracks are the primary quality dimension of the playlist. Poor transitions are immediately audible and undermine the workout experience.

### 3.1 BPM Transitions

A BPM transition MUST be evaluated as a **relative ratio**, not an absolute difference (`DOMAIN.md §3.1`). The system MUST reject any transition whose relative tempo difference falls in the "hard break" zone (>~13 % with no integer ratio match) — such transitions produce audible disruption mid-phase.

Within-tolerance transitions (≤~7 % relative) SHOULD be preferred. The system MUST explicitly recognise integer ratio relationships (2:1, 3:2, 4:3) as valid transitions regardless of their absolute BPM difference — these are musically equivalent beatgrid alignments, not approximations (`DOMAIN.md §3.3`).

The precise thresholds and ratio weights are implementation decisions documented in `PROJECT.md §ADR-17`.

### 3.2 Harmonic Compatibility (Camelot)

Camelot compatibility is a **hard gate**, not a scoring gradient (`DOMAIN.md §4.2`). A transition that produces audible tonal clash (a "red" Camelot transition) MUST be excluded from consideration regardless of how good its BPM and energy scores are. Unlike tempo, there is no "somewhat compatible" key transition.

Compatible relationships — same code, ±1 on the same ring, same-number A/B switch — MUST be permitted. The +2 energy-boost relationship MAY be permitted depending on user preference. All other combinations MUST be excluded.

When the trainer activates a Camelot lock, ONLY same-code (green) transitions SHOULD be permitted.

Implemented as a hard filter (not merely a score component) across every generation and replacement path — see `PROJECT.md §_pick() — Genre-Cascade Candidate Selection` and ADR 18 (Issue #187).

### 3.3 Genre Continuity

The system MUST not produce jarring genre transitions within a phase. Genre compatibility is evaluated through the adjacency model described in `DOMAIN.md §5.2`. Transitions between non-adjacent genres SHOULD be bridged by a compatible intermediate track or by a bridge-subgenre track.

The system MAY blend from a primary genre's pool into adjacent genre pools to maintain BPM/energy requirements when the primary pool is exhausted — this SHOULD be noted in the generation log.

---

## 4. Data Requirements

### 4.1 Track Attributes

For meaningful playlist generation, each track in the pool MUST provide at minimum: BPM, Camelot key, genre, energy level, and duration. Tracks missing these core attributes cannot be reliably placed.

Additional attributes — loudness, valence, danceability, speechiness, acousticness, instrumentalness, liveness, Everynoise position, mood tags — SHOULD be present to enable the full scoring model. Their absence MUST NOT cause errors; the system SHOULD degrade gracefully, scoring available dimensions only.

### 4.2 Genre Provenance

Genre data MUST be traceable to its source: Spotify artist-level tags, Last.fm track/artist tags, AI classification, or manual curation. Provenance affects reliability and governs which tracks may be reclassified by automated processes. The open_genre state machine is documented in `PROJECT.md §Data Model`.

### 4.3 Pool Completeness

The track pool SHOULD cover all 12 main genres. Gaps in a genre reduce generation quality for workouts where that genre is selected. The system MUST warn the trainer when a pool is too small to fill the requested duration and SHOULD supplement from adjacent genre pools rather than silently producing a short playlist.

---

## 5. System Requirements

### 5.1 Functional

The system MUST support the following core workflows:

- **Generate**: given a reference track, phase, genre, and target duration, produce a playlist that satisfies all phase and transition requirements
- **Replace**: allow the trainer to swap any non-reference track in a generated playlist with a valid alternative that respects its neighbours
- **Export**: send the generated playlist to Spotify as a private playlist
- **Import & Optimise**: accept a Spotify playlist URL, analyse transition quality, and suggest or apply improvements
- **Pool build**: transform Spotify CSV exports into the internal track pool, applying genre classification and enrichment

### 5.2 Non-Functional

**Performance**: A playlist generation for 20 minutes MUST complete in under 2 seconds on a modern consumer laptop.

**Reliability**: The application MUST operate without an internet connection for all generation and playback-control functions. Only Spotify export and login require connectivity.

**Data integrity**: Pool rebuilds MUST NOT destroy manual genre curation (`open_genre=3`) or AI-classified data (`open_genre=2`). The merge strategy for ETL is documented in `PROJECT.md §Data Model`.

### 5.3 Security

The following constraints are non-negotiable and documented as Key Invariants in `PROJECT.md`:

- Spotify `client_secret` and `refresh_token` MUST NOT leave the server process
- The browser MUST NOT hold a Spotify token at any time
- All Spotify API calls from the browser MUST be proxied through the local server
- Spotify playlist export MUST batch in groups of ≤ 100 tracks (Spotify API limit)

---

## 6. Out of Scope

The following are explicitly not requirements for the current system:

- Real-time BPM or key detection from audio files (data comes from Spotify CSV exports and Chosic)
- Multi-user access or cloud storage
- Mobile application
- Automatic playlist scheduling or recurring generation
- Genre recommendation for unknown tracks without external data

Items under active consideration for future development are tracked as GitHub Issues in the CFLUPlaylist-Local project.
