// resolve.js — computes resolved view from raw track/artist sources; no DOM, no state, no Spotify calls

// Source precedence: higher index = lower priority (user wins over everything)
export const SOURCE_PRECEDENCE = ['user', 'spotify', 'ai', 'lastfm', 'chosic'];

/**
 * Returns a flat resolved object for a track, merging all sources by precedence.
 * Identity/meta fields: user > spotify; audio features: user > chosic;
 * genre: user > ai; mood: user > ai; raw tags: lastfm.
 */
export function resolveTrack(t) {
  const sp = t.sources?.spotify    || {};
  const ch = t.sources?.chosic     || {};
  const lf = t.sources?.lastfm     || {};
  const ai = t.sources?.ai         || {};
  const u  = t.sources?.user       || {};
  return {
    id:           t.id,
    song:         u.song         ?? sp.song         ?? null,
    artist:       u.artist       ?? sp.artist       ?? null,
    album:        u.album        ?? sp.album        ?? null,
    album_date:   sp.album_date  ?? null,
    dur:          sp.dur         ?? null,
    popularity:   u.popularity   ?? sp.popularity   ?? null,
    explicit:     sp.explicit    ?? false,
    isrc:         sp.isrc        ?? null,
    label:        sp.label       ?? null,
    added_at:     sp.added_at    ?? null,
    bpm:          u.bpm          ?? ch.bpm          ?? null,
    energy:       u.energy       ?? ch.energy       ?? null,
    camelot:      u.camelot      ?? ch.camelot      ?? null,
    dance:        ch.dance       ?? null,
    acoustic:     ch.acoustic    ?? null,
    instrumental: ch.instrumental ?? null,
    valence:      ch.valence     ?? null,
    speech:       ch.speech      ?? null,
    live:         ch.live        ?? null,
    loud:         ch.loud        ?? null,
    key:          ch.key         ?? null,
    time_sig:     ch.time_sig    ?? null,
    bpmg:         ch.bpmg        ?? null,
    genres_raw:   lf.genres_raw  ?? [],
    track_tags:   lf.track_tags  ?? [],
    album_tags:   lf.album_tags  ?? [],
    genre:        u.genre        ?? ai.genre        ?? null,
    mood_tags:    u.mood_tags    ?? ai.mood_tags    ?? [],
    open_genre:   ai.open_genre  ?? 0,
    avg_color:    t.avg_color    ?? null,
    avg_xy:       t.avg_xy       ?? null,
    locked:       t.locked       ?? 0,
  };
}

/**
 * Returns a flat resolved object for an artist.
 */
export function resolveArtist(artist) {
  const lf = artist.sources?.lastfm || {};
  const u  = artist.sources?.user   || {};
  return {
    id:      artist.id,
    name:    u.name    ?? artist.name ?? null,
    tags:    lf.tags   ?? [],
    similar: lf.similar ?? [],
  };
}

/**
 * Computes aggregate statistics for an artist across all their tracks.
 * tracksById: Map/object of track_id → raw track object (from data/tracks.json).
 */
export function resolveArtistAggregates(artist, tracksById) {
  const tracks = (artist.track_ids || [])
    .map(tid => tracksById[tid])
    .filter(Boolean)
    .map(resolveTrack);

  if (!tracks.length) {
    return { track_count: 0, bpm_min: null, bpm_max: null, bpm_median: null,
             energy_min: null, energy_max: null, genre_counts: {}, mood_counts: {} };
  }

  const bpms     = tracks.map(t => t.bpm).filter(v => v > 0).sort((a, b) => a - b);
  const energies = tracks.map(t => t.energy).filter(v => v != null);
  const genreCounts = {};
  const moodCounts  = {};

  for (const t of tracks) {
    if (t.genre) genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
    for (const m of (t.mood_tags || [])) moodCounts[m] = (moodCounts[m] || 0) + 1;
  }

  const mid = Math.floor(bpms.length / 2);
  return {
    track_count: tracks.length,
    bpm_min:     bpms.length ? bpms[0] : null,
    bpm_max:     bpms.length ? bpms[bpms.length - 1] : null,
    bpm_median:  bpms.length
      ? (bpms.length % 2 ? bpms[mid] : Math.round((bpms[mid - 1] + bpms[mid]) / 2))
      : null,
    energy_min:  energies.length ? Math.min(...energies) : null,
    energy_max:  energies.length ? Math.max(...energies) : null,
    genre_counts: genreCounts,
    mood_counts:  moodCounts,
  };
}

/**
 * Computes aggregate statistics for an album across all its tracks.
 */
export function resolveAlbumAggregates(album, tracksById) {
  const tracks = (album.track_ids || [])
    .map(tid => tracksById[tid])
    .filter(Boolean)
    .map(resolveTrack);

  if (!tracks.length) return { track_count: 0, genre_counts: {}, mood_counts: {} };

  const genreCounts = {};
  const moodCounts  = {};
  for (const t of tracks) {
    if (t.genre) genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
    for (const m of (t.mood_tags || [])) moodCounts[m] = (moodCounts[m] || 0) + 1;
  }

  return { track_count: tracks.length, genre_counts: genreCounts, mood_counts: moodCounts };
}
