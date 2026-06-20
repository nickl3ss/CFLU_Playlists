# Practical Mixology — Domain Theory

> This document describes the **domain knowledge** underlying the CFLU WOD Builder: sports science and music theory as they apply to CrossFit workout playlists. It contains no implementation detail and no software requirements. A CrossFit coach and an experienced DJ should be able to read this and recognise it as accurate.
>
> Sources: `docs/references/` — cited inline.

---

## 1. The WOD as a Four-Phase Musical Journey

A CrossFit class is not a uniform block of effort. It follows a structured energy arc across four distinct phases, each demanding different physiological and psychological states from athletes. Music has a corresponding role in each.

| Phase | Label | Primary demand | Music's role |
|---|---|---|---|
| A | Warmup & Prep | Low arousal, motor activation | Background; athletes must hear the coach |
| B | Skill & Strength | Focused effort, technical precision | Moderate energisation; overstimulation disrupts technique |
| C | WOD / Intensive | Peak effort, high heart rate | Motivation and identity; not primarily RPE reduction |
| D | Cool-Down | Parasympathetic recovery | Physiological downregulation |

The energy arc is not optional — it is the training structure. A playlist that ignores it works against the coach, not with them.

---

## 2. Music's Effect on Exercise

### 2.1 The Entrainment Effect

The human brain tends to synchronise neural oscillations with external rhythmic stimuli — a phenomenon called **entrainment**. In exercise, this manifests as movement synchronising to the beat. When synchronisation occurs, metabolic efficiency can improve and effort feels subjectively lower. This is the scientific foundation for tempo-matched workout music.

### 2.2 RPE Reduction and Its Physiological Ceiling

Karageorghis et al. (Brunel University) demonstrated that motivational music reduces **Rated Perceived Exertion (RPE)** by approximately 10 % at low-to-moderate intensities, and increases endurance by ~15 % compared to a control condition. However, there is a ceiling:

> "At high exercise intensities (i.e. beyond 75 % of aerobic capacity; VO2max), the afferent signals from the musculature and vital organs become overwhelming in attentional terms, and so music is far less effective in reducing perceived exertion." — Terry et al. (2020)

**Implication for Phase C:** A WOD operating above ~75 % VO2max — which most CrossFit MetCons do — receives no meaningful RPE benefit from music. Music in Phase C works through **arousal**, **identity**, and **motivation** (the drive to keep moving), not through perceptual filtering of effort signals.

**Implication for Phases A, B, D:** These phases operate at lower intensity where entrainment and RPE effects are active. Tempo matching matters more here.

### 2.3 Optimal Tempo Bands

Evidence from sports physiology and CrossFit coaching practice converges on phase-specific tempo bands. The values below represent well-supported target ranges — not hard cutoffs.

| Phase | Optimal BPM | Rationale |
|---|---|---|
| A — Warmup/Prep | 85–110 | Motor unit recruitment research; coach communication must remain possible |
| B — Skill/Strength | 80–120 | Fast tempos increase mental arousal in ways that impair technical focus (Snatch, Clean & Jerk) |
| C — WOD Intensive | 140–180 (core) | Karageorghis MetCon research; HIIT studies; >180 appropriate only for specific genres (punk, DnB) |
| D — Cool-Down | 60–100, descending | Recovery music at ~71 BPM lowers arousal more effectively than silence; ~60 BPM promotes alpha-wave / parasympathetic states |

Source: `references/WODability_Playlist-WodMusicTheory.md §1.1`

### 2.4 Audio Attributes Beyond BPM

Spotify provides several audio features that modulate the psychological effect of music in exercise:

| Attribute | Definition | Exercise relevance |
|---|---|---|
| **Energy** | Perceptual intensity (dynamic range, loudness, onset rate) | Strongest validated Spotify field for arousal; Phase C → 75–100, Phase A/D → 15–45 |
| **Loudness** | Overall dB level | Karageorghis: "for an invigorating effect, music must be loud AND fast"; Phase C favours near-0 dB |
| **Danceability** | Rhythmic stability and beat regularity | Predicts synchronisability for cyclic movements (box jumps, barbell cycling); useful in B/C |
| **Valence** | Musical positiveness (0–100) | He et al. 2025 meta-analysis: positive music improves affective valence during exercise (g=0.403); high valence aids motivation in Phase C |
| **Speechiness** | Proportion of spoken word | >0.66 = spoken word (exclude); 0.33–0.66 = rap (acceptable in Phase C) |
| **Instrumentalness** | Confidence of no vocals | Phase A benefits from instrumental (no cognitive distraction); lyrics can boost Phase C motivation via lyric content |
| **Acousticness** | Confidence of acoustic recording | Phases A/D tolerate acoustic; Phase C prefers electronic/amplified |
| **Liveness** | Audience noise confidence | >0.8 = live recording; inconsistent loudness — mild penalty for playlist continuity |

Source: `references/WODability_Playlist-WodMusicTheory.md §1.2–1.7`

---

## 3. Tempo Theory

### 3.1 Why Relative BPM Differences Matter

A jump from 120 to 127 BPM (+5.8 %) feels different to a jump from 160 to 169 BPM (+5.6 %) — and both feel the same proportionally, even though the absolute delta differs by 2 BPM. Tempo perception is **logarithmic**: the brain hears ratios, not differences.

> "5 BPM at 80 BPM = 6.3 %; 5 BPM at 170 BPM = 2.9 %. The first is jarring; the second is imperceptible." — `references/BPM_theory.md §1`

Therefore, transition smoothness must always be measured as a **relative ratio** (percentage or log₂ distance), not an absolute BPM delta.

### 3.2 The DJ Tolerance Ladder

DJ practice, confirmed by Mixgraph analysis of 49,500+ tracks, defines the following tolerance zones:

| Relative difference | log₂ distance | Perceptual effect | Technique |
|---|---|---|---|
| ≤2 % | d ≤ 0.029 | Inaudible | Beatmatch directly |
| 2–7 % | d ≤ 0.100 | Subtle — minor pitch shift needed | Pitch correction |
| 7–13 % | d ≤ 0.195 | Noticeable — audible tempo shift | Short transition window |
| >13 %, no ratio | d > 0.135 | Hard break | Gear change / cut |

Source: `references/BPM_theory.md §2`

### 3.3 Integer Ratio Relationships (Half/Double Time)

Beyond the ±13 % tolerance window, a special class of transitions remains musically valid: **integer ratios** of the form p:q where beatgrids align without perceptual conflict.

The 2:1 ratio (half/double time) is the most powerful: every beat of the fast track coincides with every other beat of the slow track. A 78 BPM track and a 156 BPM track share an identical beatgrid — they are rhythmically indistinguishable to most listeners.

> "If you are playing a song that is 120BPM you can beatmix a song that is 60BPM and they should mix smoothly in most cases." — Digital DJ Tips, cited in `references/Genre_MatchingTheory.md §7`

Adjacent ratios (3:2, 4:3) also produce usable alignments, with diminishing alignment precision.

**The C→D transition** is the canonical use case: after a peak Phase C at 155–175 BPM, a track at half that tempo (78–87 BPM) provides an instantaneous cool-down feel while maintaining rhythmic continuity.

Source: `references/BPM_theory.md §4`

### 3.4 Monotonicity: The Energy Direction Rule

Within an ascending phase (B, C), BPM should only increase. A backward step — even within tolerance — reads to athletes as an energy drop and undermines the psychological momentum of the build.

Within Phase D, BPM should only decrease.

At phase transitions (A→B, B→C, C→D), a deliberate larger break is not only acceptable but functional: it signals the workout structure to athletes. The first track of a new phase is chosen for its phase fitness, not its compatibility with the last track of the previous phase.

---

## 4. Harmonic Compatibility (Camelot System)

### 4.1 The Camelot Wheel

The Camelot wheel maps all 24 musical keys to a clock-face notation: minor keys (A) and major keys (B), numbered 1–12. Adjacent positions on the wheel share at least 6 of 7 scale notes and produce harmonically resolved transitions.

### 4.2 Compatibility Rules

| Relationship | Example | Perceptual result |
|---|---|---|
| Same code | 8A → 8A | Transparent — same key |
| ±1, same ring | 8A → 7A or 9A | Compatible — adjacent scale |
| Same number, A↔B | 8A → 8B | Compatible — relative major/minor |
| +2, same ring | 8A → 10A | Semi-compatible — brightness shift; deliberate energy boost |
| All other combinations | 8A → 3B | Incompatible — audible tonal clash |

Camelot compatibility is **categorical, not continuous**: a transition is either harmonically resolved or it produces audible dissonance. There is no "somewhat in key." This makes Camelot fundamentally different from BPM (which allows gradual tolerance) — it is a hard gate, not a gradient.

DJ.Studio analysis places A minor (8A) as the single most common key in dance music libraries.

---

## 5. Genre Compatibility

### 5.1 Genre as Sonic Signature

Genre is shorthand for a cluster of sonic characteristics: instrumentation, rhythmic pattern, production style, and cultural context. Two tracks at identical BPM and energy levels can still produce a jarring transition if their sonic vocabulary is too different — this is why BPM alone is not sufficient for playlist quality.

Genre compatibility is grounded in three independent signals that consistently converge across musicology, DJ practice, and algorithmic music analysis:

1. **Rhythmic DNA** — the foundational groove (four-on-the-floor, backbeat, offbeat skank, breakbeat)
2. **Historical lineage** — genres sharing evolutionary ancestry share sonic vocabulary
3. **Tempo band overlap** — genres that naturally inhabit overlapping BPM ranges can transition without a gear change

### 5.2 The Four Structural Bridges

All genres in the system connect through four documented lineages:

**Dance bridge** — The four-on-the-floor spine: Funk & Disco → EDM/Electronic → Pop & New Wave → Modern German Music → Synthwave. All share the four-on-the-floor kick pattern at 120–145 BPM. This is the densest cluster and the safest sequence of transitions.

**Aggression bridge** — Distorted guitar and high tempo: Punk → Metal & Hard Rock → Rock. Nu metal and rap metal extend this bridge into Hip Hop & R&B.

**Jamaican bridge** — Offbeat skank: Ska & Reggae ↔ Punk. The 2-Tone movement (Coventry, 1979) historically fused these two genres, with "ska punk" as the explicit connective subgenre.

**German-language cluster** — Modern German Music ↔ Deutschrock/NDW/Schlager. Near-identical subgenre pools; NDW is the German variant of new wave, linking this cluster to Rock and Pop.

Source: `references/Genre_MatchingTheory.md`

### 5.3 Half/Double-Time as Cross-Genre Bridge

Hip Hop & R&B typically lives at 85–95 BPM; Metal, Punk, and DnB at 160–220 BPM. These are rhythmically compatible via the 2:1 ratio. A set can move from hip-hop to metal without a jarring tempo break — the beatgrids simply run at half/double speed.

> "A set drifting through hip-hop and Afrobeats at 95 BPM can pivot into liquid drum and bass at 175 by aligning kicks instead of matching tempos." — Mixgraph, cited in `references/Genre_MatchingTheory.md §7`

### 5.4 Bridge Subgenres

Certain subgenres are connective tissue that appear simultaneously in multiple main genre buckets: **ska punk** (Ska ↔ Punk), **rap metal** (Metal ↔ Hip Hop), **synthpop** (Synthwave ↔ Rock ↔ Pop), **dance pop** (EDM ↔ Pop), **new wave** (Rock ↔ Pop ↔ Modern German).

Tracks tagged with bridge subgenres improve cross-genre transition quality more than tracks in the core of either genre.

Source: `references/Genre_MatchingTheory.md §Subgenre-level bridges`

---

## 6. The Everynoise Coordinate System

Every Noise at Once (Glenn McDonald, Spotify) positions approximately 6,000 music genres in a 2D space derived from 13 audio dimensions (tempo, loudness, energy, valence, danceability, and others). The vertical axis ranges from mechanical to organic; the horizontal from atmospheric to dense.

Genres close on this map share sonic vocabulary measured independently of human genre labels. The coordinate system provides a continuous, data-driven complement to the discrete genre graph: two tracks from nominally different genres may be sonically close if their everynoise positions (and associated RGB colours) are proximate.

Source: `references/Genre_NetworkResearch.md`; `references/Genre_Position-Aware_Displacement.md`

---

## References

| Document | Content |
|---|---|
| `references/WODability_Playlist-WodMusicTheory.md` | Sports physiology (Karageorghis), Spotify feature validity, phase BPM recommendations |
| `references/BPM_theory.md` | DJ tolerance ladder, half/double time, sequencing rules |
| `references/Genre_MatchingTheory.md` | Genre adjacency graph, four structural bridges, subgenre connective tissue |
| `references/Genre_NetworkResearch.md` | Everynoise-derived track counts, subgenre distribution, weighted neighbour graph |
| `references/Genre_Position-Aware_Displacement.md` | 2D genre displacement scoring methodology |
| `references/API_Guide_Spotify.md` | Spotify Web API operational guide |
| `references/API_Guide_Last.fm.md` | Last.fm API operational guide |
