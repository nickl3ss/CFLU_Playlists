# Genre Neighbour/Adjacency Model for a CrossFit WOD Playlist Builder

## TL;DR
- The 12 Main Genres connect through four well-documented "bridges" — a four-on-the-floor dance lineage (Disco→Funk→House→Eurodance→Synthwave), a distorted-guitar/aggression axis (Punk→Metal→Rock), an offbeat-skank Jamaican lineage (Ska&Reggae↔Punk), and a German-language scene cluster (Modern German Music↔Deutschrock/NDW/Schlager) — plus specific subgenre "connective tissue" tags (ska punk, synthpop, dance pop, rap metal) that let the app route smoothly between buckets.
- For a workout context, tempo compatibility is the master variable: most of these genres cluster usefully in the 120–145 BPM band, and where they don't (hip-hop ~85–95, metal/punk 160–200), DJs bridge via the half-time/double-time 2:1 relationship — so the model should treat a 90 BPM hip-hop track and a 180 BPM punk/DnB track as tempo-adjacent, not distant.
- The recommended neighbour graph (below) gives each Main Genre 3–5 evidence-based neighbours weighted by shared rhythmic DNA, tempo overlap, harmonic/modal tendencies, and historical lineage; the strongest universal hub is EDM/Electronic and the most isolated node is Blues&Soul, which should connect upstream as the historical root rather than as a workout-energy peer.

## Key Findings

1. **Four-on-the-floor is the spine of the dance cluster.** The pounding four-on-the-floor kick that defines disco was popularized by Philadelphia drummer Earl Young (b. June 2, 1940), drummer/founder of The Trammps, who improvised the beat on Harold Melvin & the Blue Notes' "The Love I Lost" (1973); Wikipedia credits him with "popularizing four-on-the-floor bass drum beats, and as being the first drummer to make extensive and distinctive use of the hi-hat cymbal." Disco's strings descended directly from Philly soul (itself an evolution of Motown). House emerged from disco in early-1980s Chicago — per PBS Sound Field, artists like Jesse Saunders and Frankie Knuckles, "inspired by early synth pop pioneers, started using electronic instruments to make their own versions of the four on the floor beat," translating Earl Young's beat onto the Roland TR-909. Eurodance then grew from house/techno/hi-NRG/Italo in late-1980s Germany. This gives a continuous rhythmic chain: **Funk&Disco → EDM/Electronic**, with **Synthwave** attached via Italo-disco and nu-disco influence.

2. **The skank/offbeat lineage binds Ska&Reggae to Punk.** Ska's defining trait is the guitar/organ "skank" on the offbeat upbeats; 2-Tone, whose name derives from 2 Tone Records (founded 1979 by Jerry Dammers of The Specials, originating in Coventry, West Midlands), fused Jamaican ska with punk's faster tempos and harder edge, and "influenced the ska punk movement that developed in the US in the late 1980s and 1990s" (Wikipedia). Dammers' own rationale (quoted via Culture Space Coventry) makes the tempo logic explicit: "you can combine punk and ska much more effectively because they're both up-tempo music." This makes **Ska&Reggae ↔ Punk** one of the strongest single edges in the graph, with **ska punk** as the connective subgenre.

3. **Distorted guitars and aggression bind Punk → Metal → Rock.** Punk drumming is "hard rock played much faster"; nu metal and rap metal fuse metal guitar with hip-hop rhythm/vocals. Anthrax's thrash cover of Public Enemy's "Bring the Noise" (released July 9, 1991, reaching No. 14 on the UK singles chart, appearing on Anthrax's *Attack of the Killer B's* and PE's *Apocalypse 91*) is, per Louder, the moment "the roots of rap metal were being sown." Rage Against the Machine and nu metal acts (Korn, Limp Bizkit, Linkin Park) are further documented metal↔hip-hop bridges.

4. **Analog-synth lineage binds Synthwave ↔ Rock(new wave/synthpop) ↔ Pop ↔ Modern German Music.** Synth-pop arose from the late-1970s new-wave/post-punk era (Gary Numan, Human League, Depeche Mode); synthwave is an explicit mid-2000s nostalgic revival of that 80s sound. NDW (Neue Deutsche Welle) is literally the German-language variant of punk/new wave. **synthpop** is the connective subgenre appearing in Rock, Pop, and Synthwave buckets simultaneously.

5. **Hip-hop's rhythmic DNA is sampled funk.** James Brown's "Funky Drummer" — Clyde Stubblefield's drum break, recorded Nov 20, 1969 in Cincinnati and released as a single in March 1970 — was, per The Conversation (Mark Edwards, 2017), "a 20-second drum loop that would go on to be sampled on over 1,300 songs, from Public Enemy and Beastie Boys to George Michael, Britney Spears and Ed Sheeran." G-funk additionally sampled Parliament-Funkadelic. This makes **Hip Hop&R&B ↔ Funk&Disco** a lineage edge, even though their workout tempos differ.

6. **Tempo bands (approximate, for workout routing):**
   - Hip Hop&R&B: ~85–95 BPM boom-bap; R&B 60–100
   - Funk&Disco: disco ~100–130, four-on-the-floor
   - Synthwave: 80–118 (upbeat 128–140)
   - Pop & New Wave: dance-pop ~110–128
   - Modern German Music / Schlager (Discofox): ~120–128 four-on-the-floor
   - EDM/Electronic: house 120–130, techno 120–150, trance 125–150, eurodance 135–145, hypertechno 140–165, hard techno 145–160+, happy hardcore higher
   - Rock: classic/soft/AOR ~90–140
   - Metal & Hard Rock: hard rock 110–140, thrash/power 160–220
   - Ska & Reggae: ska fast/uptempo; reggae slower one-drop
   - Punk: punk/pop punk 140–200, hardcore 200+
   - Blues & Soul: blues 60–90

7. **Half-time/double-time is the cross-tempo bridge.** Professional DJs deliberately mix tracks whose BPMs are in a 2:1 ratio. Per Digital DJ Tips (Marc Santaromana): "Half time and double time refers to using a song that is either half or double the tempo of the song that is currently playing. For example if you are playing a song that is 120BPM you can beatmix a song that is 60BPM and they should mix smoothly in most cases… if you are playing a song that is 70BPM beatmixing a 140BPM song should work quite well." Mixgraph adds the genre-bridging use case: "A set drifting through hip-hop and Afrobeats at 95 BPM can pivot into liquid drum and bass at 175 by aligning kicks instead of matching tempos." This matters enormously for a workout app: the slow hip-hop bucket (~90) is rhythmically compatible with the fast punk/metal/DnB material (~180), and the model should encode that relationship rather than treating them as far apart.

8. **Harmonic mixing (Camelot wheel) and modal tendencies.** DJs mix smoothly between tracks in the same key, ±1 on the Camelot wheel, or the relative major/minor (same number, A↔B). Per Mixgraph's DJ-education guide, "Most underground club music lives here — techno, minimal, deep house, dark tech house" (minor keys), while "Festival anthems, vocal house, melodic breakdowns — these tend to sit in major keys"; disco, nu-disco and trance are noted as "leaning major." A minor (8A) is corroborated as the single most common key in dance libraries. Use these tendencies as a secondary adjacency weight.

## Details

### Methodology note
Genre adjacency here draws on three independent signals that professional curation and ethnomusicology converge on: (1) **rhythmic foundation** (the actual drum/groove pattern — four-on-the-floor, offbeat skank, backbeat, breakbeat, half-time); (2) **tempo/BPM overlap** including the half/double-time relationship DJs exploit; and (3) **historical/cultural lineage and instrumentation** (genre family trees, shared scenes, shared production tools like analog synths or samplers). Spotify's own genre map (Every Noise at Once, by Glenn McDonald) corroborates the same adjacency logic: per PopMatters, McDonald stated "the map relies on 13 variables… The thirteen audio dimensions include tempo, loudness, energy, emotional valence and danceability," with a vertical axis spanning "mechanistic to organic." His team categorized roughly one million artists into 6,291 named genres before his Dec 4, 2023 Spotify layoff, and closeness on that map predicts how the recommender cross-pollinates genres.

### The four primary bridges

**Bridge A — The four-on-the-floor dance continuum.** Disco (four-on-the-floor popularized by Earl Young on "The Love I Lost," 1973; strings from Philly soul) → House (Chicago, early 80s, "from the ashes of disco," via Jesse Saunders/Frankie Knuckles and the Roland TR-909) → Eurodance (Germany/Italy, fusing house, techno, hi-NRG, Italo) → contemporary EDM (slap house ~120, eurodance 135–145, hypertechno 140–165). Synthwave attaches to this continuum through Italo-disco and nu-disco influences and its driving electronic pulse. For the app: **Funk&Disco, EDM/Electronic, Synthwave, Pop&New Wave, and Modern German Music (Discofox/Schlager)** all share the four-on-the-floor pulse and a 120–145 BPM workout band — this is the densest cluster in the graph and the safest set of transitions.

**Bridge B — The Jamaican offbeat lineage.** Ska (offbeat skank) → rocksteady → reggae (one-drop, emphasis on beat 3) on one side; 2-Tone revival fused ska with punk to create ska punk on the other. The **Ska&Reggae ↔ Punk** edge is historically explicit (Coventry 1979; The Clash incorporating Jamaican rhythms via DJ Don Letts; Dammers' "both up-tempo music" rationale). ska punk and skate punk appear in both buckets.

**Bridge C — The distorted-guitar aggression axis.** Punk → Metal&Hard Rock → Rock. Punk and metal share fast tempos, power chords, and distortion; nu metal and rap metal additionally bridge **Metal ↔ Hip Hop** (rapped vocals, DJ scratching, funk basslines, hip-hop grooves). Rock connects to Metal via hard rock/glam metal and to Punk via post-punk/new wave/proto-punk.

**Bridge D — The German-language scene cluster.** Modern German Music and Deutschrock/NDW/Schlager overlap almost entirely at the subgenre level (both contain neue deutsche welle, schlager, deutscher pop, schlagerparty). NDW itself is the German variant of punk/new wave, linking this cluster to Rock (new wave) and Punk. Schlager/Discofox's four-on-the-floor ~120 BPM links it to the dance cluster.

### Per-genre neighbour recommendations

**1. EDM / Electronic (1084).** Neighbours: **Pop&New Wave** (dance pop is the shared bridge subgenre; europop/eurodance overlap), **Synthwave** (shared analog-synth/electronic palette, Italo/nu-disco lineage), **Funk&Disco** (four-on-the-floor ancestry, disco house/funky house), **Modern German Music** (german dance, eurodance, Discofox tempo). Rationale: rhythmic (four-on-the-floor), tempo (120–145 core), lineage (disco→house→eurodance). This is the central hub.

**2. Rock (823).** Neighbours: **Metal&Hard Rock** (shared distorted-guitar rock, glam metal↔glam rock, hard rock↔rock), **Pop&New Wave** (new wave, synthpop, pop rock shared), **Synthwave** (new wave/synthpop analog-synth lineage), **Punk** (proto-punk, post-punk, new wave), **Blues&Soul** (bluesrock, classic rock, southern rock). Rationale: instrumentation + lineage; tempo overlap ~90–140.

**3. Pop & New Wave (548).** Neighbours: **EDM/Electronic** (dance pop, eurodance, europop), **Rock** (new wave, synthpop, pop rock), **Synthwave** (synthpop bridge), **Modern German Music** (german pop, swedish pop, europop), **Funk&Disco** (disco-pop). Rationale: dance pop and synthpop are the connective tissue; four-on-the-floor and ~110–128 tempo.

**4. Metal & Hard Rock (346).** Neighbours: **Rock** (hard rock, glam metal↔glam rock, rock), **Punk** (aggression, tempo, hardcore punk lineage), **Hip Hop&R&B** (rap metal/nu metal bridge), **EDM/Electronic** (industrial/electronic crossover, hard/aggressive energy for WOD peaks). Rationale: distorted guitar + aggression axis; rap metal bridges to hip-hop.

**5. Ska & Reggae (302).** Neighbours: **Punk** (ska punk, skate punk, 2-Tone), **Funk&Disco** (shared R&B/soul roots, offbeat groove, brass), **Rock** (new wave/2-Tone era), **Hip Hop&R&B** (reggae→hip-hop syncopation, sound-system culture). Rationale: ska punk is the dominant bridge; rhythmic offbeat DNA.

**6. Synthwave / Electronica (290).** Neighbours: **EDM/Electronic** (electronic production, nu-disco/Italo/house influence), **Pop&New Wave** (synthpop, new wave), **Rock** (new wave/synthpop lineage), **Modern German Music** (Kraftwerk/Krautrock electronic lineage, NDW synths). Rationale: analog-synth lineage; tempo 80–140.

**7. Modern German Music (264).** Neighbours: **Deutschrock/NDW/Schlager** (near-identical subgenre overlap — NDW, schlager, deutscher pop, schlagerparty), **Pop&New Wave** (german pop↔pop, europop), **EDM/Electronic** (german dance, Discofox tempo, eurodance), **Hip Hop&R&B** (deutscher hip-hop↔hip-hop). Rationale: language/scene cluster + Discofox four-on-the-floor.

**8. Hip Hop & R&B (213).** Neighbours: **Funk&Disco** (sampled funk/soul breakbeats, "Funky Drummer" lineage), **Modern German Music** (deutscher hip-hop), **Metal&Hard Rock** (rap metal/nu metal crossover), **EDM/Electronic** (hip house, electronic production, dance-pop crossover). Rationale: funk-sampling lineage; half-time bridge to faster genres for WOD.

**9. Punk (205).** Neighbours: **Ska&Reggae** (ska punk, skate punk, 2-Tone), **Metal&Hard Rock** (aggression, tempo, hardcore), **Rock** (proto-punk, post-punk, new wave), **Pop&New Wave** (pop punk→pop, new wave). Rationale: aggression axis + offbeat bridge; tempo 140–200.

**10. Funk & Disco (120).** Neighbours: **EDM/Electronic** (four-on-the-floor, disco house, Italo disco), **Hip Hop&R&B** (sampled breakbeats, soul/Motown), **Pop&New Wave** (disco-pop), **Blues&Soul** (soul, classic soul, Motown roots), **Synthwave** (Italo/nu-disco). Rationale: four-on-the-floor origin point + soul/funk roots.

**11. Deutschrock / NDW / Schlager (81).** Neighbours: **Modern German Music** (near-identical overlap), **Rock** (german rock, new wave), **Pop&New Wave** (NDW→new wave, schlager-pop), **Punk** (NDW punk roots). Rationale: same German-language cluster as #7; treat as twin nodes.

**12. Blues & Soul (17).** Neighbours: **Rock** (bluesrock, classic rock, southern rock — strongest edge), **Funk&Disco** (soul, Motown lineage), **Hip Hop&R&B** (R&B/soul roots). Rationale: the historical root node; small and low-energy, so connect it as a lineage ancestor rather than a peak-WOD peer.

### Subgenre-level bridges (connective tissue) to encode explicitly
- **dance pop** → EDM ↔ Pop ↔ (Modern German Music)
- **synthpop** → Synthwave ↔ Rock ↔ Pop
- **ska punk / skate punk** → Punk ↔ Ska&Reggae
- **rap metal / nu metal** → Metal ↔ Hip Hop&R&B
- **eurodance / europop** → EDM ↔ Pop ↔ Modern German Music
- **new wave** → Rock ↔ Punk ↔ Pop ↔ (NDW)
- **neue deutsche welle / schlager / deutscher pop** → Modern German Music ↔ Deutschrock/NDW/Schlager
- **disco house / funky house / italo disco** → EDM ↔ Funk&Disco ↔ Synthwave
- **hip house** → EDM ↔ Hip Hop&R&B
- **glam metal ↔ glam rock**, **hard rock ↔ rock** → Metal ↔ Rock
- **bluesrock / classic rock / southern rock** → Blues&Soul ↔ Rock

## Recommendations

**Stage 1 — Encode the four primary bridges as high-weight edges.** Build the neighbour graph so that Bridge A (dance cluster: EDM–Funk&Disco–Synthwave–Pop–Modern German Music), Bridge B (Ska&Reggae–Punk), Bridge C (Punk–Metal–Rock + Metal–Hip Hop), and Bridge D (Modern German Music–Deutschrock/NDW/Schlager) carry the strongest adjacency weights. These are the transitions least likely to feel jarring.

**Stage 2 — Add tempo compatibility as a multiplicative weight, with half/double-time logic.** For each candidate transition, compute BPM compatibility on both the raw ratio AND the 2:1 (half/double) ratio, then take the better score. This lets the app legitimately route from a ~90 BPM hip-hop track into a ~180 BPM punk/metal/DnB track. Threshold for "smooth beatmatch" without half-time is well-corroborated across Digital DJ Tips, Mixgraph and Vibes at roughly ±5–6% (≈±5–8 BPM at club tempos) — per Mixgraph: "Within 1–2 BPM, most listeners won't notice the drift… Within 3–5 BPM, you'll need to pitch-adjust one track… Beyond 5 BPM, you're either doing something intentional (like half-time mixing) or the tracks aren't meant to be beatmatched." Beyond that window, only allow the transition if the 2:1 relationship holds or if it's an intentional energy reset.

**Stage 3 — Use subgenre tags as routing shortcuts.** When a track carries a bridge subgenre tag (dance pop, synthpop, ska punk, rap metal, eurodance, new wave), boost its eligibility to cross between the two Main Genres that tag connects. These tracks are the safest "pivot" tracks for genre transitions in a set.

**Stage 4 — Layer harmonic/modal weighting last (optional, lower priority).** If key data is available, prefer same-key, ±1 Camelot, or relative-major/minor transitions. Treat minor-leaning genres (techno, trance, much EDM, metal) and major-leaning genres (much pop, schlager, happy hardcore, disco) as a soft secondary signal — useful for long blends, less critical for a WOD where energy and tempo dominate.

**Benchmarks that change the recommendations:**
- If user skip-rate is high on dance-cluster→rock/metal transitions, lower the cross-bridge weight between Bridge A and Bridge C and rely more on tempo/energy matching.
- If the app adds true beat-synced crossfading, raise the importance of the ±6% tempo window and the 2:1 half-time logic.
- If German-language users dominate, raise the weight of Bridge D and the Discofox tempo edges into the dance cluster.
- Blues&Soul has only 17 tracks; if it underperforms as a workout source, demote it to a "lineage/cool-down" tag rather than an active WOD neighbour.

## Caveats
- BPM ranges are genre-typical, not absolute; many sources are DJ-education sites (Digital DJ Tips, Mixgraph) and producer references rather than peer-reviewed, and individual tracks vary widely (especially Rock and Metal, which span 90–220 BPM). Treat per-track BPM as authoritative over genre-typical bands where available.
- The half-time/double-time technique is well-established DJ practice but is described by Digital DJ Tips' Phil Morse as an "extreme mix" better suited to lounge/radio than peak dancefloor moments — for a high-intensity WOD it may feel like an energy drop, so use it as a deliberate transition tool, not a default.
- Spotify subgenre tags are noisy and the "Main Genre" buckets already blend scenes (e.g., "rock" appears as a subgenre inside Metal&Hard Rock); the model should trust the 12 fixed buckets but use subgenre tags only as soft bridge signals.
- "Modern German Music" and "Deutschrock/NDW/Schlager" overlap so heavily they risk redundancy; keep both names as required, but functionally treat them as twin nodes that always neighbour each other.
- Synthwave's tempo is comparatively low (80–118 for much of it), so despite strong lineage ties to EDM, it may function better as a warm-up/transition genre than a peak-WOD genre.
- Modal/key tendencies by genre are broad generalisations; the strongest claims (minor-dominance in club/electronic music) are vendor-published DJ-education content (Mixgraph) rather than independent research, and Mixed In Key's own materials confirm only the Camelot mechanics, not a genre→mode mapping.