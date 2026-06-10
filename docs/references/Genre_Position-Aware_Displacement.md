# Should You Build a Per-Genre, Position-Aware "Displacement" Track-Matching Model on Every Noise at Once? A Technical Assessment for the CFLU Playlist Builder

## TL;DR
- **Build the per-genre displacement model only as a v2 experiment behind an A/B test — start with the simpler weighted-centroid (avg_x, avg_y) feature first.** The Every Noise coordinate space is rich enough to support distances and small local "pulls," but it is a manually-tuned, t-SNE-like layout whose *global* geometry and *long-range linear interpolation* are not metric-reliable, which is exactly what an aggressive pull model leans on. Cap displacement hard, freeze it per song, and never let a point cross into a contradictory region.
- **The xy-distance feature is NOT redundant with your existing avg_color RGB feature — it is complementary.** Glenn McDonald confirms color encodes *three additional* audio attributes (R, G, B channels) beyond the two that define the x/y axes, deliberately so that genres far apart on the map can share a color ("timbral quality"). xy captures organic↔mechanical and dense↔spiky; color captures a near-orthogonal set of timbral dimensions. Use both, but test their empirical correlation on your pool before trusting them as independent.
- **For contradictory tags (e.g., "german pop" + "metal"), the most defensible design is a per-song coherence/spread metric plus a dominance filter keyed to your authoritative `genre` field** — let consistent co-tags pull, flag or down-weight incoherent tracks, and treat large displacement as a *warning signal* rather than blindly trusting it as musical distance.

## Key Findings

**1. What the axes mean and how the space was built.** Every Noise at Once is an "algorithmically-generated, readability-adjusted scatter-plot of the musical genre-space." Per McDonald's own calibration text: "down is more organic, up is more mechanical and electric; left is denser and more atmospheric, right is spikier and bouncier." The Y axis runs organic/acoustic (bottom) to synthetic/mechanized (top); the X axis runs dense/atmospheric (left) to choppy/bouncy/spiky (right). The positions are a 2D readability-adjusted projection of a higher-dimensional audio model. PopMatters quotes McDonald directly: "The thirteen audio dimensions include tempo, loudness, energy, emotional valence and danceability… The vertical axis represents the spectrum from mechanistic to organic" ("On Wandering the Paths of a Spotify Analyst's Mad Music Map," PopMatters); his 2013 intro essay cites "10 dimensions internally" and "two completely independent measures of genre similarity," so the dimension count is stated as 10 (2013) rising to 13 (later). Crucially, it is **not** a similarity-stipulated layout: "this isn't based on similarity… they're in a cluster because they share aggregate audio qualities." The dataset is frozen at 6,291 genres as of 2023-11-19; per Wikipedia/Billboard, McDonald's team "categorized tracks from about one million artists into 6,291 named genres, including 56 kinds of reggae, 202 kinds of folk and 230 kinds of hip hop." Treat it as static reference data.

**2. The CSV schema is confirmed.** The `genre_attrs.csv` exposes exactly six columns: `genre, x, y, r, g, b` (e.g., `piano blues, 696, 3870, 102, 136, 45`). The x/y are large integer pixel-style coordinates; r/g/b are 0–255 channels. This matches what drives your existing `enrich_colors()` avg_color feature.

**3. Color is an independent dimension, not a function of position — this is the single most important finding for your design.** PopMatters reports: "The color system also arose from a trial-and-error process to map three more of the 13 attributes using shades of red, green and blue." McDonald adds that "the colors indicate dissimilar neighbors… you can follow the blue-purple hues across the middle of the map to track a bunch of ambient, atmospheric genres that have different positions in the two-dimensional space, but share a timbral quality." This means xy-distance and color-distance are **largely orthogonal by construction**: two genres can be far apart in (x,y) yet identically colored, and vice versa. Therefore adding an explicit xy-distance feature is *not* duplicative of your avg_color RGB-distance feature — it adds genuine information.

**4. The t-SNE / dimensionality-reduction caveat is real and directly threatens the "pull" model.** Every Noise is a t-SNE-style / manually-readability-adjusted layout, not a learned metric embedding. The well-established caveat — Wattenberg, Viégas & Johnson, "How to Use t-SNE Effectively," Distill 1(10), Oct 2016, DOI:10.23915/distill.00002 ("t-SNE plots can sometimes be mysterious or misleading") — is that **distances between well-separated clusters are not reliably meaningful, and cluster sizes mean nothing**: these layouts optimize *local* neighborhood preservation while *global* geometry and inter-cluster distance are arbitrary. A recent formal result — Bergam, Snoeck & Verma (Columbia University), arXiv:2510.07746, submitted Oct 9, 2025 — proves that "(1) the strength of the input clustering, and (2) the extremity of outlier points, cannot be reliably inferred from the t-SNE output." The implication: (a) *short-range* distances between nearby genres are roughly trustworthy; (b) *long-range* distances and especially **linear interpolation ("pulling" point A a fraction of the way toward distant point B)** may pass through musically meaningless intermediate regions. Your pull model is most defensible when pulls are small and between *nearby* co-tags, and least defensible when a contradictory co-tag is far away — precisely the case the model is designed to exploit.

**5. Force-directed / attraction math is well-understood and transfers cleanly.** The classical spring-electrical model (Eades 1984; Fruchterman–Reingold 1991; Kamada–Kawai) defines attractive forces F_a ∝ ‖x_i − x_j‖ between connected nodes and repulsive forces between all nodes, with weighted edges ("larger weight = stronger attractive force," per NetworkX). Your displacement is a *single-step, attraction-only, anchored* special case: each per-tag position is pulled toward co-tag coordinates by a weighted average, with the original tag coordinate acting as an anchor (analogous to gravity toward a fixed point). This is mathematically meaningful as a vector operation; the question is whether the *underlying space* justifies it (see Finding 4).

**6. Tag-weighting by specificity is standard and recommended.** TF-IDF / inverse-document-frequency (Spärck Jones 1972, who defined the inverse function of the number of documents in which a term occurs as "term specificity") directly formalizes "rarer tag = more informative." A tag carried by few tracks in your pool (e.g., "neurofunk") is more informative than "pop"; weighting pulls by IDF (or by Every Noise's own genre centrality, where "rock is the biggest and most central") is well-grounded.

**7. Playlist-sequencing literature supports transition-smoothness objectives but warns coherence ≠ satisfaction.** Automatic Playlist Continuation (APC) work (RecSys Challenge 2018) and sequencing work (Bittner et al., ISMIR 2017, framing playlist ordering as a Traveling Salesman/Hamiltonian-path problem over feature distances) validate using a continuous feature space for smooth transitions. But intra-list similarity (ILS) research — Ziegler, McNee, Konstan & Lausen, "Improving Recommendation Lists Through Topic Diversification," WWW 2005, pp. 22–32 (DOI:10.1145/1060745.1060754) — shows maximizing similarity is *not* always what users want: their topic-diversification method, "though being detrimental to average accuracy… improves user satisfaction" (evaluated on 361,349 ratings and an online study of >2,100 subjects). Follow-up work (Jannach et al., 2022) shows the ILS-metric implementation details materially change whether the metric tracks human perception.

## Details

### RQ1 — Validity of the coordinate space for distance and displacement

The axes are interpretable and stable: organic↔mechanical (Y) and dense/atmospheric↔spiky/bouncy (X). For a CrossFit-workout use case, both axes are musically relevant — "up/mechanical" and "right/spiky/bouncy" broadly track higher-energy, more driving material suited to high-intensity intervals, while "down/organic, left/dense-atmospheric" track calmer warm-up/cool-down material. So the space is *substantively* meaningful for your domain.

However, three limitations bound how much you can lean on it:
- **It is a projection, not a metric embedding.** 10–13 internal dimensions are compressed to 2. Two genres adjacent on screen are genuinely similar on the two displayed audio measures, but may differ on the 8–11 hidden ones (and on the 3 carried by color).
- **Local Euclidean distance is "roughly metric"; global distance is not.** This is the standard t-SNE caveat (Distill 2016; arXiv:2510.07746). Computing distance between two *nearby* genres is fine; comparing a *small* distance to a *large* distance across the map is unreliable.
- **Readability adjustment adds non-audio jitter.** McDonald explicitly shifts labels to prevent overlap ("readability-adjusted"), so fine positions carry a layout-cosmetic component, not pure audio signal.

**Verdict:** Distances are meaningful *locally*. Linear displacement is meaningful *as a vector operation* but inherits the global-distortion risk — pulling a point a long way across the map is the operation least supported by the underlying layout.

### RQ2 — Formalizing the pull

Recommended per-song frozen formulation. For a song with tags T = {t₁…tₙ}, each with canonical coordinate p(tᵢ):

displaced(tᵢ) = p(tᵢ) + α · Σⱼ≠ᵢ wⱼ · (p(tⱼ) − p(tᵢ)) / Σⱼ≠ᵢ wⱼ

where:
- **α (pull strength), default 0.15–0.30.** This is the fraction of the way the anchor moves toward the weighted centroid of co-tags. Keep it well below 0.5 so the displaced point stays in the neighborhood of its own genre — this directly mitigates the t-SNE long-range-interpolation risk.
- **wⱼ (co-tag weight) = IDF-style specificity.** wⱼ = log(N / df(tⱼ)), where df is the number of tracks in your ~4,300-pool carrying tag tⱼ. Rarer co-tags pull harder. Optionally multiply by Every Noise centrality so generic "pop" pulls weakly.
- **Distance decay (optional):** multiply wⱼ by exp(−‖p(tⱼ)−p(tᵢ)‖ / σ) so that *near* co-tags pull more and *far* (likely-contradictory) co-tags pull less. This is the single most important guard: it makes the model trust short, reliable distances and distrust long, unreliable ones — directly aligning the math with the t-SNE caveat. **Recommend enabling decay.**
- **Hard cap:** clamp ‖displaced(tᵢ) − p(tᵢ)‖ ≤ d_max (e.g., the median nearest-neighbor genre distance × 2). A displaced point must never cross into a contradictory region; the cap enforces this.
- **Freeze per song.** Do NOT run a joint global layout optimization across all 4,300 tracks. Per-song frozen displacement is deterministic, debuggable, cache-friendly, order-independent, and avoids introducing a second uninterpretable embedding on top of an already-uninterpretable one. Joint optimization would compound the t-SNE problem and make every song's coordinates depend on the whole pool. **Strong recommendation: per-song frozen.**

### RQ3 — Contradictory genres

Options, assessed:
- **(a) Let the pull happen, treat large displacement as signal.** Risky alone: it relies on long-range interpolation in exactly the regime where the layout is least trustworthy, and a single mislabeled tag can wreck a position.
- **(b) Dominance filter keyed to the authoritative `genre` field.** Only let co-tags that are "consistent" with the assigned main genre exert pull (e.g., within a distance threshold of the main-genre coordinate, or sharing the main genre's broad region). Defensible and cheap; leverages the field you already trust.
- **(c) Outlier rejection.** Drop co-tags whose coordinate is a statistical outlier relative to the rest of the song's tags before computing the pull. Good complement to (b).
- **(d) Per-song coherence/spread metric.** Compute the spread (e.g., mean pairwise distance, or max distance from the main-genre coordinate) of a song's tag coordinates; flag high-spread songs as "incoherent." McDonald himself computes a per-genre "coherence" score (comedy most coherent, moombahton least), so this is squarely in the spirit of the data.

**Most defensible: combine (d) + (b).** Use the coherence metric to *flag* incoherent tracks (and optionally exclude them from tight-transition slots), and use the dominance filter so only main-genre-consistent co-tags pull. Distance decay (RQ2) already softens contradictory pulls. Pure (a) is not defensible on a t-SNE-style layout.

### RQ4 — Comparison to the single weighted-centroid alternative

The centroid model collapses a song to one (avg_x, avg_y) point — directly analogous to your existing avg_color RGB mean.

| | Single centroid (avg_x, avg_y) | Per-genre displacement |
|---|---|---|
| Complexity | Trivial; one point/song | n points/song + params (α, σ, d_max, weights) |
| Interpretability | High | Moderate |
| Expressiveness | One blended location | Per-genre comparison; captures that a track's "german-pop-ness" differs from a pure german-pop track |
| Risk on t-SNE layout | **Low** (averaging nearby points is safe; averaging far points yields a meaningless midpoint, but at least it's not amplified) | **Higher** (relies on directional interpolation) |
| Matches existing avg_color pattern | Yes (drop-in) | No |

**The centroid's key weakness is real:** for a multi-genre track, averaging coordinates that are far apart yields a centroid in "no man's land" that represents *neither* genre — the classic averaging artifact. The displacement model's appeal is that it preserves a per-genre anchor and only *nudges* it, so the "german pop" comparison stays in german-pop territory. **That is a genuine expressiveness gain — but only realized if α is small and decay/caps are on.** With large α and no caps, displacement degenerates toward the same no-man's-land problem the centroid has, plus extra noise.

**Recommendation:** Ship the centroid first (it mirrors avg_color, is one line of code, and gives you a baseline). Add displacement as a v2 candidate and justify the complexity *only if* the A/B test (RQ6) shows it beats the centroid on coherence/transition metrics. The extra complexity is justified when (i) your pool has many multi-tag tracks with widely-separated tags, and (ii) per-genre matching at pick time measurably improves transitions.

### RQ5 — Relation to color

This is where the most important finding changes the naive expectation. One might assume that because Every Noise "encodes position as color," xy-distance and color-distance are collinear and one is redundant. **They are not.** McDonald assigns R/G/B to *three additional* audio attributes beyond the two axis attributes ("a trial-and-error process to map three more of the 13 attributes using shades of red, green and blue"), explicitly so that "genres that have different positions in the two-dimensional space… share a timbral quality" (same color). So:
- **xy-distance** ≈ organic↔mechanical + dense↔spiky (2 audio dims).
- **color-distance** ≈ three *other* audio dims (a near-orthogonal, partly timbral set).
- They are **complementary, not duplicative** — combining them effectively gives you a 5-dimensional audio proxy from a frozen, free dataset.

**But verify empirically on your pool.** "Largely orthogonal by design" does not guarantee low correlation *on your specific 4,300 tracks*, because genre popularity and co-occurrence can induce correlation. Concrete test: build the N×N pairwise xy-distance matrix and the N×N color-distance matrix over your pool (or over the unique genres present), flatten the upper triangles, and compute Pearson and Spearman correlation, plus a Mantel test for matrix correlation. Interpretation thresholds: |r| < 0.3 → strongly complementary, keep both as independent features; 0.3–0.6 → partially complementary, keep both but expect some collinearity (consider PCA or a single combined distance); > 0.7 → effectively redundant on your data, keep only one (probably xy, since its axes are documented and interpretable). Also scatter-plot the two distances to spot non-linear structure a single correlation coefficient would miss.

### RQ6 — Validation methodology

You have no public "playlist quality" ground truth, so validate on your own pool with a layered approach:

**A. Offline structural metrics (compute immediately, no users needed).**
- **Intra-playlist genre coherence:** mean pairwise xy-distance (and separately color-distance) among consecutive tracks in generated playlists. Lower = tighter. Report inverse-ILS for diversity too — you want *controlled* coherence, not minimum distance (a CrossFit set wants an energy arc, not monotony).
- **Transition smoothness:** mean step-size between consecutive tracks in (a) xy space, (b) color space, and (c) the displaced per-genre space. Compare the three candidate models: current single-main-genre bucket vs. single-centroid vs. per-genre displacement.
- **Energy-arc fit:** since your axes track energy/mechanical-ness, score how well a playlist follows an intended workout intensity curve (warm-up → high-intensity → cool-down) — this is more domain-relevant than raw coherence.
- **Displacement sanity audit:** for the displacement model, log the distribution of displacement magnitudes and the count of capped/flagged tracks. If most displacements hit the cap or most tracks flag incoherent, the model is over-reaching.

**B. The xy-vs-color correlation study** (RQ5) — run this before committing to two features.

**C. A/B / preference test (the only thing that measures real quality).** Three arms: (1) current single-main-genre bucket, (2) single-centroid xy+color, (3) per-genre displacement. Because skip data may be sparse in a gym-coach app, use forced-choice pairwise preference ("which transition sounds better?") with your coaches/members as raters, plus skip-rate and manual-override proxies if you have telemetry. Power it with enough transitions to detect a modest effect.

**Supporting / cautionary literature:** APC and sequencing work (RecSys Challenge 2018; Bittner et al. ISMIR 2017 TSP-style sequencing) supports continuous-feature transition optimization. Music genre/word embeddings (Herremans & Chuan, word2vec for musical context; McFee & Lanckriet artist-similarity embeddings; "Musical Word Embedding," 2024) show learned metric spaces capture genre relationships — a reminder that Every Noise is a *visualization* layout, not such a learned metric space, so its distances are weaker evidence than a purpose-trained embedding would be. ILS research (Ziegler et al. 2005, WWW; Jannach et al. 2022) cautions that coherence metrics are imperfect proxies for satisfaction and that implementation details matter.

## Recommendations

**Stage 0 — Foundation (do now).**
1. Load frozen `genre_attrs.csv`; join each `genres_raw` tag to (x,y,r,g,b). Log unmatched tags (Every Noise is frozen since 2023-11-19; newer microgenres will miss).
2. Run the **xy-vs-color correlation study** (RQ5). Decision gate: if r > 0.7, drop color or xy; else keep both.

**Stage 1 — Ship the simple baseline.**
3. Implement the **single weighted-centroid** (avg_x, avg_y), weighting tags by IDF specificity. This mirrors avg_color and gives an immediate, low-risk improvement over single-main-genre buckets.
4. Stand up the **offline metric harness** (coherence, transition step-size, energy-arc fit) and benchmark bucket vs. centroid.

**Stage 2 — Build displacement as a challenger (only if Stage 1 metrics motivate it).**
5. Implement per-genre frozen displacement with: α = 0.2 (tune 0.15–0.3), IDF co-tag weights, **distance decay on**, **hard cap on**, dominance filter keyed to `genre`, and a per-song coherence/spread flag.
6. A/B the three arms with forced-choice preference + any skip/override telemetry.

**Decision thresholds that change the plan:**
- If displacement does **not** beat centroid on transition smoothness AND preference → ship centroid, shelve displacement.
- If a large fraction of tracks hit the displacement cap or flag incoherent → your pool's tags are too contradictory for the pull model; fall back to centroid + coherence filter.
- If xy and color correlate > 0.7 on your pool → collapse to one distance feature.
- If many `genres_raw` tags are unmatched in the frozen dataset → consider a fallback (map to nearest parent genre) before either model is trustworthy.

## Caveats

- **Established vs. speculative.** Established: the axis semantics, the CSV schema, color-as-independent-dimension, force-directed/TF-IDF math, the t-SNE distance caveat, ILS/APC literature. **Speculative (your design):** the specific single-step anchored displacement formulation, the α/σ/d_max defaults, and the claim that per-genre comparison improves CrossFit transitions. The defaults are reasoned starting points, not empirically validated for music — the A/B test is what converts them from speculation to evidence.
- **The core epistemic risk:** the pull model's whole premise — that pulling a genre point *toward* or *away from* co-tags yields musically meaningful displacement — assumes linear interpolation in Every Noise space corresponds to musical interpolation. On a t-SNE-style layout this holds *locally* but breaks down over long distances. Small α + decay + caps keep you in the safe local regime; without them, the model is built on the layout's weakest property.
- **Frozen data drift.** Every Noise stopped updating after McDonald was laid off on December 4, 2023 (Spotify's cut of 1,500 employees, 17% of its workforce); per the site's own note, "With my layoff from Spotify on 2023-12-04, I lost the internal data-access required for ongoing updates to many parts of this site" (corroborated by TechCrunch, 2024-02-12, and Wikipedia). Genres coined since then are absent, and the layout will slowly diverge from current music. Treat coverage gaps as a first-class data-quality issue.
- **Color caveat is itself secondhand.** The decisive statement that color encodes three additional attributes comes from a PopMatters interview quoting McDonald, corroborated by his own statements about 10–13 internal dimensions but not itemized in a first-party algorithm doc. The exact R/G/B→attribute mapping is undocumented ("trial-and-error," per McDonald), so treat color as "an independent audio dimension of unknown precise composition," and let the empirical correlation study, not the interview, make the final feature decision.
- **Readability jitter and centrality bias.** Fine positions include layout-cosmetic shifts, and dense central regions (rock/pop) are more reliable than sparse peripheries (e.g., the isolated "indian classical / show tunes" region McDonald himself flags) — distances in sparse regions are noisier.