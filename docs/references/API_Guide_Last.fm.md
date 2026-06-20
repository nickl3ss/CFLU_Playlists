# Last.fm API — Developer Handoff Guide for the CrossFit WOD Playlist Builder

**Official Reference:** https://www.last.fm/api  
**Method index:** https://www.last.fm/api/intro  
**Register API key:** https://www.last.fm/api/account/create  
**No OpenAPI/OAS spec available** — Last.fm does not publish a machine-readable schema. Canonical reference is the developer portal above. Always verify method signatures and response shapes against the live documentation; do not assume field names from memory.

---

## TL;DR
- The Last.fm API is a free, key-based HTTP web service (root `https://ws.audioscrobbler.com/2.0/`) whose crowd-sourced tag ("folksonomy") data is the right tool for *track-level* genre identification — something the Spotify API cannot give you, since Spotify assigns genres only at the artist level. All the read methods you need (`track.getTopTags`, `album.getTopTags`, `artist.getTopTags`, `track.getSimilar`, `artist.getSimilar`, `tag.*`) require only an API key and **no** signed/authenticated session.
- Build a 5-tier cascading genre resolver (track tags → album tags → artist tags → similar-track tags → similar-artist tags) that escalates only when the higher tier is empty/weak, scores tags by Last.fm's 0–100 weighted `count`, filters folksonomy noise against a canonical genre allowlist, and emits a ranked genre list with per-tier confidence weights.
- Respect the Terms of Service: the API is licensed for **non-commercial use only** (commercial use requires a written agreement with partners@last.fm), capped at a 100 MB "Reasonable Usage Cap," limited to no more than 5 requests per originating IP per second (averaged over a 5-minute period), and you must cache aggressively and send an identifiable User-Agent. A CrossFit playlist product that monetizes will need a commercial agreement.

## Key Findings

### Authentication & access model
- **One API account** gives you an **API key** (32-char) and a **shared secret** (32-char). Register at `last.fm/api/account/create`.
- **The vast majority of genre/tag read methods do NOT require authentication** — only the API key as a query parameter. This includes every method the playlist builder needs: `track.getInfo`, `track.getTopTags`, `track.getSimilar`, `track.getCorrection`, `track.search`, all `artist.*` getters, all `album.*` getters, and all `tag.*` methods. Each of these doc pages explicitly states "This service does not require authentication."
- **The API secret + signed session is only needed for write/user-context methods** you will not use: `track.love`, `track.scrobble`, `track.addTags`, `track.removeTag`, `album.addTags`, `artist.addTags`, `track.updateNowPlaying`. The intro page states "All write services require authentication." The signing flow (for completeness): call `auth.getToken`, send the user to `last.fm/api/auth/?api_key=…&token=…`, then call `auth.getSession` with an `api_sig`. The `api_sig` is `md5(sorted-concatenated-params + secret)`, excluding `format` and `callback`. Session keys do not expire.
- **Practical takeaway:** the PHP backend needs to store only the API key (in env/secrets), and can omit the secret entirely for the genre-identification feature.

### Rate limits, caching & Terms of Service
- **Rate limit:** the verbatim Terms of Service text is "You will not make more than 5 requests per originating IP address per second, averaged over a 5 minute period, without prior written consent." Exceeding it returns **error code 29 / HTTP 429** ("Rate Limit Exceeded"). The intro guidance: "Your account may be suspended if your application is continuously making several calls per second." Last.fm also reserves the right to limit usage "in our sole discretion."
- **Caching is mandatory per TOS:** "You will implement suitable caching in accordance with the HTTP headers sent with web service responses."
- **Reasonable Usage Cap:** "a maximum of 100 MB" of stored Last.fm data without written consent.
- **Non-commercial only:** "You are permitted to use the Last.fm Data solely for non-commercial purposes." Commercial use requires a separate agreement via partners@last.fm. **This is the single biggest compliance risk for a playlist product if it is ever monetized.**
- **User-Agent:** "Please use an identifiable User-Agent header on all requests."
- **Attribution / IP:** all rights in the data remain Last.fm's; you may not use the data to support unauthorized exploitation of IP.

### Response formats & error handling
- **Default format is Last.fm-flavored XML.** Add `&format=json` for JSON. Use JSON in PHP.
- **Critical gotcha:** the API frequently returns **HTTP 200 even when the body contains an error** (e.g., `{"error":6,"message":"..."}`). Always parse the body for an `error` key, not just the HTTP status.
- **Key error codes:** 2 invalid service, 3 invalid method, 4 auth failed, 5 invalid format, 6 invalid parameters, 7 invalid resource, 8 operation failed, 9 invalid session key, 10 invalid API key, 11 service offline, 13 invalid signature, 16 temporary error (retry), 26 suspended key, 29 rate limit exceeded.
- **Common failure modes:** track not found (returns error 6); empty `<toptags>` lists (very common for obscure tracks — this is the normal trigger for cascade fall-through); MBID mismatches (see below); ambiguous name matches.

### Method families relevant to genre identification

**`track.*`**
- `track.getInfo` — full metadata: id, name, mbid, duration, listeners, playcount, album, artist (with mbid), **a `toptags` block (tag names only, no counts)**, and a wiki. Params: `artist`+`track` OR `mbid`, plus optional `autocorrect`, `username`. Good for a single call that yields both metadata and a quick tag list, but the embedded tags carry no weights.
- `track.getTopTags` — **the primary genre signal.** Returns `<toptags>` with `<tag>` entries each having `name`, **`count`**, and `url`, ordered by count. Params: `artist`+`track` OR `mbid`, optional `autocorrect`. No auth. Official sample (Cher – "Believe"): pop=97, dance=88.
- `track.getTags` — tags applied by **one specific user** (requires `user` param when unauthenticated). NOT for genre aggregation.
- `track.getSimilar` — similar tracks "based on listening data," each with a `match` score (float), name, artist, mbid. Params: `artist`+`track` OR `mbid`, optional `autocorrect`, `limit`. Tier-4 fallback.
- `track.getCorrection` — maps a misspelled/variant artist+track to the canonical Last.fm version (with mbid). Returns `<corrections>` with `artistcorrected`/`trackcorrected` flags.
- `track.search` — fuzzy track search, returns matches with mbid sorted by relevance.

**`artist.*`**
- `artist.getInfo` — name, mbid, stats (listeners, plays), a `similar` artist list, and a `tags` block (names only, no counts), plus bio.
- `artist.getTopTags` — artist-level weighted tags (`name`, `count`, `url`), ordered by popularity, count max 100. Tier-3 fallback. Returns up to ~100 tags.
- `artist.getTags` — single-user tags (not for aggregation).
- `artist.getSimilar` — similar artists with a `match` score. Params: `artist` OR `mbid`, optional `limit`, `autocorrect`. Tier-5 fallback.
- `artist.getCorrection` — canonicalizes artist name → canonical name + mbid (e.g., "Guns and Roses" → "Guns N' Roses").
- `artist.search` — fuzzy artist search.

**`album.*`**
- `album.getInfo` — album metadata incl. tracklist and a `toptags` block.
- `album.getTopTags` — album-level weighted tags (`name`, `count`, `url`), ordered by popularity. **This page is the only getTopTags doc that formally defines the count attribute: "A weighted count of how often the tag was applied, with a maximum of 100."** Tier-2 fallback.
- `album.getTags` — single-user tags.

**`tag.*` (the global genre vocabulary)**
- `tag.getInfo` — metadata for a tag: `reach` ("The number of users that have used this tag"), `taggings` ("The total number of times this tag has been used"), plus a wiki/description. Use to validate whether a folksonomy term is a "real" widely used tag and to weight by global popularity.
- `tag.getTopTags` — the top global tags by popularity. Useful to seed/validate a canonical genre allowlist. (Note this returns `reach`/`taggings`, not a 0–100 count.)
- `tag.getTopTracks` / `tag.getTopArtists` / `tag.getTopAlbums` — the inverse lookup: given a genre tag, get representative tracks/artists (useful for *seeding* a WOD playlist once a target genre is chosen).
- `tag.getSimilar` — intended to return related tags, but **this endpoint is currently broken and returns an empty list for all tags** (confirmed on the Last.fm support forum). Do not rely on it; use a local genre-adjacency map or Every Noise coordinates instead.

**`chart.*` / `geo.*`** — `chart.getTopTags`, `chart.getTopArtists`, `chart.getTopTracks` give global popularity charts; `geo.getTopArtists`/`geo.getTopTracks` give per-country popularity. These are useful for *popularity* and trend signals (e.g., picking high-energy crowd-pleasers for a WOD), not for per-track genre. `chart.getTopTags` returns tags with `reach`/`taggings`, mixing in noise like "seen live."

### getTags vs getTopTags — the crucial distinction
- **`*.getTags`** = tags applied by **one individual user** to that item. Personal, sparse, requires a `user`. Not useful for genre.
- **`*.getTopTags`** = the **aggregated/global** top tags across all users, each with a **`count`**. This is what you want.
- **The `count` field:** Officially defined (on the album.getTopTags page) as "A weighted count of how often the tag was applied, with a maximum of 100." The precise mechanism is described in the research literature (arXiv:2509.06606, Sept 2025): "The tag with the highest frequency on a given track is assigned a weight of 100, and all other tags receive weights proportionally scaled to their relative frequency compared to the most common tag." Another paper (arXiv:1704.03844) characterizes the raw API output as "an array of pairs consisting of (name, count) … where 'count' represents how many users have applied that tag to that song. Notice that 'count' is capped to 100." A widely cited community project (`TheTeaCat/lastfm-tag-cloud`) describes it as "a percentage of the people who have tagged that artist that tagged it this tag" — but **note this exact percentage formula is NOT stated in the official docs**; treat `count` simply as a relative 0–100 weight within a single item's tag list (top tag ≈ 100, others scaled below it), not as a cross-item-comparable absolute. The Million Song Dataset (built from `track.getTopTags`) independently confirms: "We did not sum the count Last.fm provides (an integer between 0 and 100)."

### MBID vs name-string lookups
- Every relevant method accepts **either** `artist`+`track`/`album` name strings **or** an `mbid`. You cannot always rely on MBID:
  - **Many Last.fm tracks/artists have no MBID** (empty `<mbid/>`), so a name-string path is mandatory as a fallback.
  - **MBIDs from Last.fm can be wrong/stale:** a documented `pylast` bug shows a track with no MBID returning the *artist's* MBID; users report MBIDs from `user.getLovedTracks` failing in `track.getInfo` while name+artist works.
  - **Recommendation:** prefer name+artist strings as the canonical key (they are what Last.fm's tag database is keyed on in practice), use MBID only when present and verified, and always set **`autocorrect=1`** to map misspellings/variants to canonical names. Run `track.getCorrection`/`artist.getCorrection` once at ingest to canonicalize.

### Folksonomy noise — the key data-quality caveat
Last.fm tags are **crowd-sourced free text** and mix genres with moods, decades, activities, and personal bookmarks. Academic and developer sources are blunt about this: the Million Song Dataset's official Last.fm corpus contains **522,366 unique tags against only 505,216 unique tracks** — i.e., more distinct tags than songs. In the analyzed tag table (arXiv:1605.08486), the highest-ranked tags are dominated by non-genre noise: "favorites" ranks 7th (56,508 songs), "beautiful" 8th (51,870), "love" 9th (50,918), and "awesome" 10th (42,364), with "seen live" also high in the list. Tag-cloud projects explicitly filter "seen live," "favourite," and "all." **You must filter aggressively** — mood tags ("chill," "energetic"), decade tags ("80s," "00s"), descriptors ("female vocalists"), and personal tags ("seen live," "favorite," "i own it") are not genres and will pollute a WOD playlist's genre logic. A 7-class folksonomy taxonomy used in the research literature is: genre, mood, location, language, instrument, activity, decade — only the *genre* class is useful here (though *mood/activity* like "workout" may be a useful secondary signal for WODs).

---

## Part 2 — Cascading track genre-identification algorithm

### Goal
For one track (artist + title, optionally MBID), produce a **ranked list of canonical genres with confidence scores**, escalating through five tiers only as needed, while minimizing API calls and filtering noise.

### Canonical genre vocabulary & noise filtering (do this first)
1. **Maintain a genre allowlist** keyed to your existing 12-main-genre taxonomy plus their common sub-genre tags (e.g., main "Electronic" ← {electronic, house, techno, edm, dnb, drum and bass, dubstep, trance, electro, …}). Seed it from `tag.getTopTags` and a published genre list, then curate.
2. **Maintain a denylist / non-genre class set:** personal ("seen live," "favourite," "favorites," "i own it"), moods unless you want them ("chill," "mellow"), decades ("80s," "90s," "00s"), descriptors ("female vocalists," "male vocalists," "instrumental" — borderline), and junk ("all," "awesome," "beautiful," "love," "favorite").
3. **Normalization:** lowercase, trim, collapse whitespace/hyphens ("hip-hop" = "hip hop" = "hiphop"), map synonyms to a canonical token, then map the canonical token to one of your 12 main genres.
4. **A tag survives only if** it maps to a known genre in the allowlist (cross-referencing a canonical genre vocabulary is more robust than denylist-only, because the long tail of folksonomy junk is unbounded — there are literally more unique tags than tracks).

### The cascade

| Tier | Source method(s) | API calls | Base confidence | Fall-through trigger |
|---|---|---|---|---|
| 1 | `track.getTopTags` | 1 | **1.00** | < N_min genre tags after filtering, or top genre `count` < W_min |
| 2 | `album.getTopTags` (need album via `track.getInfo`) | 1 (+1 if album unknown) | **0.80** | same |
| 3 | `artist.getTopTags` | 1 | **0.60** | same |
| 4 | `track.getSimilar` → `track.getTopTags` on top K similars | 1 + K | **0.40** | aggregate empty |
| 5 | `artist.getSimilar` → `artist.getTopTags` on top K similars | 1 + K | **0.25** | — (final) |

**Concrete thresholds (tune empirically):**
- `W_min` (minimum genre-tag weight to "count"): **10** on the 0–100 scale. Tags with count < 10 are long-tail noise.
- `N_min` (minimum number of surviving genre tags to accept a tier and stop): **2** (or 1 if its count ≥ 50).
- `K` (number of similar items to aggregate in Tiers 4–5): **5–10**.
- Final output: keep genres whose merged score ≥ a floor (e.g., 0.15 of the top genre's score), cap at top 3–5.

### Scoring & merging across tiers
1. **Within a tier**, for each surviving tag: `tag_weight = count / 100` (0–1). For similar-item tiers (4/5), additionally multiply by the item's `match` score and average across the K items so a genre shared by many similars scores higher.
2. **Tier confidence** multiplies the tag weight: `contribution = tag_weight × tier_confidence`.
3. **Map to your 12 main genres** and **sum contributions** per main genre across all tiers actually executed (normally you stop at the first satisfying tier, so cross-tier merging mainly matters when you deliberately blend Tier 1 + a fallback for thin tracks).
4. **Normalize** the final per-genre scores to 0–1 by dividing by the max, and attach the **effective confidence** = the highest tier confidence that contributed (so the consumer knows a "low confidence, inferred from similar artists" genre vs. a "high confidence, track-tagged" genre).
5. **Output:** `[{genre: "Hip-Hop", score: 0.92, confidence: "high", source_tier: 1}, …]`.

### API-call budget & caching
- Best case (well-tagged track): **1 call** (Tier 1).
- Worst case (Tier 5): up to ~1 + 1 + 1 + (1+K) + (1+K) ≈ 14–24 calls. This is why caching and early-exit are essential.
- **Cache strategy (mandatory per TOS):**
  - Cache every method response keyed by `(method, normalized-artist, normalized-track/album)` with a long TTL (tags change slowly — 30–90 days is reasonable).
  - Cache at the **artist** and **album** level separately; many tracks by one artist will reuse Tier 2/3/5 results, collapsing call counts dramatically across a library.
  - Persist a **resolved-genre table** keyed by track so repeated playlist builds cost 0 API calls.
  - Throttle to **≤5 req/s** (use a token-bucket in the PHP worker), and **retry on error 16/29 with exponential backoff**.
  - Batch/precompute genres at **ingest time**, not on playlist-build request (the intro guidance explicitly warns against hitting the API on page load).

### MBID vs name handling in the cascade
- Use name+artist (with `autocorrect=1`) as the primary lookup key; pass MBID only when present and known-good. If a name lookup returns error 6 (not found), try `track.getCorrection` then retry; if still empty, fall through to the next tier rather than failing the track.

### How this complements the existing Spotify + Every Noise system
- **Spotify gives you artist-level genres only** (the API "associates genres with artists rather than individual songs," and the track object has no genre field; the `available-genre-seeds` endpoint is also now deprecated). Last.fm's `track.getTopTags` is therefore **complementary, not redundant**: it is your only true *track-level* genre signal.
- **Recommended fusion:** treat Spotify artist genres as a strong prior (≈ your current Tier-3-equivalent), and let Last.fm `track.getTopTags` **override/refine at the track level** when it disagrees (e.g., a ballad on a mostly-EDM artist's album). Use Last.fm's higher tiers and Spotify artist genres as mutually-reinforcing fallbacks.
- **Every Noise at Once** maps Spotify micro-genres onto a 2-D coordinate space (vertical = organic→electronic/mechanical, horizontal = atmospheric→spiky/bouncy). It is a project by former Spotify employee Glenn McDonald, who with his team "had categorized tracks from about one million artists into 6,291 named genres, including 56 kinds of reggae, 202 kinds of folk and 230 kinds of hip hop." **It has not been updated since McDonald was laid off by Spotify on December 4, 2023** (one of ~1,500 employees / 17% of staff cut), after which "he lost access to the data needed to maintain and update the website's database" — so treat its data as a fixed snapshot. Use its coordinates to (a) **canonicalize/cluster** a Last.fm tag to the nearest known Spotify micro-genre, and (b) the **vertical "mechanical/energetic" axis is a useful proxy for WOD intensity** — high-energy electronic genres cluster in one region, letting you map a track's resolved genre to a workout-intensity coordinate.
- **De-duplication / canonicalization between Last.fm tags and your 12-genre taxonomy:** build one **canonical genre dictionary** that maps {Last.fm tag synonyms, Spotify genre strings, Every Noise genre labels} → a single canonical token → one of your 12 main genres. Normalize on lowercase + de-hyphenation + synonym table. When Last.fm surfaces a micro-genre not in your taxonomy, resolve it to the nearest main genre via Every Noise proximity (or a manual mapping), and log unmapped tags for periodic curation.

## Recommendations
1. **Ship Tier 1 + 3 first** (track tags, falling back to artist tags). This covers the large majority of tracks in ≤2 calls and is the highest-value, lowest-complexity slice. Add Tiers 2/4/5 only if you measure too many "unresolved" tracks.
2. **Build the canonical genre dictionary and noise allowlist/denylist before writing the resolver** — the algorithm is only as good as this vocabulary. Seed from `tag.getTopTags` + a curated genre list; map everything to your 12 mains.
3. **Precompute and cache at ingest**, key resolved genres per track, and cache artist/album tag responses for reuse. Enforce ≤5 req/s and parse response bodies for `error` even on HTTP 200.
4. **Use `autocorrect=1` everywhere; prefer name+artist over MBID;** run corrections at ingest.
5. **Fuse with Spotify as priors, not replacements:** Last.fm = track-level truth, Spotify artist genres + Every Noise coordinates = fallback + intensity mapping.
6. **Resolve the commercial-use question now.** If the WOD playlist builder will be monetized or offered as a commercial product, email partners@last.fm for a commercial agreement before launch — non-commercial is the default license and the only one you have by default.

**Thresholds that would change the approach:** if >30% of your library's tracks fall through Tier 1, lower `W_min` to 5 or add Tier 2; if API volume approaches the 100 MB cap or sustained >5 req/s, negotiate higher limits with Last.fm; if `tag.getSimilar` is fixed (currently broken), it could replace the local genre-adjacency map.

## Caveats
- **`tag.getSimilar` is currently broken** (returns empty for all tags) per the Last.fm support forum — do not depend on it.
- The **`count` field's exact normalization is only partly documented**: official docs say "weighted count, maximum 100"; the precise "top tag = 100, others proportionally scaled" mechanism comes from the research literature, and the "percentage of taggers" reading is a community interpretation, not official. Treat counts as relative weights within one item, not absolute cross-item values.
- **MBIDs are unreliable** on Last.fm (missing or wrong); name strings are the safer key.
- **Rate-limit and non-commercial constraints are enforced** and can get your key suspended (error 26). The 5 req/s figure is verbatim TOS text but Last.fm reserves the right to limit "in our sole discretion."
- **Last.fm announced on 27 May 2026 that it is now an independent company** — the official forum post reads: "Today, Last.fm begins a new chapter as an independent company. Ownership has changed, but the product you use every day has not." It separated from Paramount Skydance (~19 years after CBS acquired it for $280M in 2007); early reports confirm "The API still works," but API terms and endpoints could change — re-verify against `last.fm/api` before launch.
- Folksonomy tags are **noisy and subjective**; even after filtering, expect occasional mis-genre-d tracks. A human spot-check pass on the resolved-genre table is advisable for a curated product.