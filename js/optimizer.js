// optimizer.js — playlist import, flow analysis, reorder, gap fill; no DOM, no Spotify token handling
import { spotifyCall } from './spotify.js';
import { getAllTracks } from './algorithm.js';
import { calcSortScore, titleKey } from './utils.js';
import { state } from './state.js';

// ===== SPOTIFY IMPORT =====

/** Extract playlist ID from various Spotify URL forms. Returns null if not a playlist URL. */
export function parsePlaylistId(url) {
  const m = url.match(/playlist\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

/**
 * Fetch all tracks from a Spotify playlist (paginated). Matches each against the local
 * pool by Spotify track ID (exact) or artist+title fuzzy. Returns an array of track objects:
 *   - Pool match: full pool track (bpm, camelot, energy, genre, …)
 *   - No match:   { id, song, artist, dur, _external: true } (no scoring data)
 */
export async function importPlaylist(playlistId) {
  const poolAll = getAllTracks();
  const poolById = new Map(poolAll.filter(t => t.id && t.id !== 'nan').map(t => [t.id, t]));

  const tracks = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const fields = 'total,items(track(id,name,duration_ms,artists(name)))';
    const data = await spotifyCall('GET', `/playlists/${playlistId}/tracks?limit=100&offset=${offset}&fields=${encodeURIComponent(fields)}`);
    if (!data || !Array.isArray(data.items)) throw new Error('Ungültige API-Antwort');
    total = data.total || 0;
    for (const item of data.items) {
      const sp = item && item.track;
      if (!sp) continue;
      const artist = (sp.artists || []).map(a => a.name).join(', ');
      const song   = sp.name || '';
      const dur    = Math.round((sp.duration_ms || 0) / 1000);
      // 1. Exact pool match by Spotify ID
      if (sp.id && poolById.has(sp.id)) {
        tracks.push({ ...poolById.get(sp.id), _external: false });
        continue;
      }
      // 2. Fuzzy match: same artist (case-insensitive) + same titleKey
      const tk = titleKey(song);
      const artistLow = artist.toLowerCase();
      const fuzzy = poolAll.find(t =>
        t.artist.toLowerCase() === artistLow && (titleKey(t.song) === tk || t.song.toLowerCase() === song.toLowerCase())
      );
      if (fuzzy) {
        tracks.push({ ...fuzzy, _external: false });
      } else {
        // No match — keep as external stub (no scoring fields)
        tracks.push({ id: sp.id || '', song, artist, dur, bpm: 0, camelot: '', energy: 0, genre: '', _external: true });
      }
    }
    offset += 100;
    if (tracks.length >= total) break;
  }
  return tracks;
}

// ===== FLOW ANALYSIS =====

const SCORE_GREEN  = 320; // same thresholds used visually
const SCORE_YELLOW = 200;

/**
 * Analyse an ordered track list for a given phase.
 * Returns an array of transition objects { from, to, score, rating }.
 * Skips pairs where either track is _external (no scoring data).
 */
export function analyseFlow(tracks, phase) {
  const transitions = [];
  for (let i = 0; i < tracks.length - 1; i++) {
    const cur  = tracks[i];
    const next = tracks[i + 1];
    if (cur._external || next._external) {
      transitions.push({ from: cur, to: next, score: null, rating: 'unknown' });
      continue;
    }
    const score = calcSortScore(next, cur, phase, state.scoreWeights);
    const rating = score >= SCORE_GREEN ? 'green' : score >= SCORE_YELLOW ? 'yellow' : 'red';
    transitions.push({ from: cur, to: next, score, rating });
  }
  return transitions;
}

/** Return a short summary string for the analysis. */
export function flowSummary(transitions) {
  const scorable = transitions.filter(t => t.score !== null);
  if (!scorable.length) return 'Keine bewertbaren Übergänge.';
  const avg = Math.round(scorable.reduce((s, t) => s + t.score, 0) / scorable.length);
  const green  = scorable.filter(t => t.rating === 'green').length;
  const yellow = scorable.filter(t => t.rating === 'yellow').length;
  const red    = scorable.filter(t => t.rating === 'red').length;
  return `Ø ${avg} Punkte · ${green}× ✓ / ${yellow}× ⚠ / ${red}× ✗`;
}

// ===== REORDER OPTIMIZATION =====

/**
 * Greedy reorder: pool-matched tracks are reordered using calcSortScore to find the
 * best append at each step; _external tracks (no scoring data) keep their relative
 * order among themselves but are appended after all pool tracks, not interleaved
 * back into their original positions.
 * Returns a new ordered array.
 */
export function reorderGreedy(tracks, phase) {
  const external = tracks.filter(t => t._external);
  const pool = tracks.filter(t => !t._external);
  if (pool.length <= 1) return tracks;

  const usedIdx = new Set();
  const result  = [];

  // Start with the pool track whose phase score is highest (natural "first" track)
  let bestStartScore = -Infinity;
  let startIdx = 0;
  pool.forEach((t, i) => {
    const s = calcSortScore(t, t, phase, state.scoreWeights); // self-score approximation as start fitness
    if (s > bestStartScore) { bestStartScore = s; startIdx = i; }
  });
  result.push(pool[startIdx]);
  usedIdx.add(startIdx);

  while (usedIdx.size < pool.length) {
    const cur  = result[result.length - 1];
    let bestScore = -Infinity;
    let bestI = -1;
    pool.forEach((t, i) => {
      if (usedIdx.has(i)) return;
      const s = calcSortScore(t, cur, phase, state.scoreWeights);
      if (s > bestScore) { bestScore = s; bestI = i; }
    });
    if (bestI < 0) break;
    result.push(pool[bestI]);
    usedIdx.add(bestI);
  }

  // Reinsert external stubs at their original relative positions (by original index)
  // Simple heuristic: append at end, preserving their order
  return [...result, ...external];
}

// ===== GAP FILLING =====

/**
 * Identify weak transitions (score < SCORE_YELLOW) in an ordered track list.
 * For each weak slot, propose up to 3 bridge tracks from the global pool
 * (not already in the playlist) using pickNext/pickPrev-style scoring.
 * Returns array of { afterIndex, candidates[] } suggestions.
 */
export function suggestGapFills(tracks, phase) {
  const playlistIds = new Set(tracks.map(t => t.id || t.song));
  const globalPool  = getAllTracks().filter(t => !playlistIds.has(t.id || t.song) && !t._external);
  const suggestions = [];

  for (let i = 0; i < tracks.length - 1; i++) {
    const cur  = tracks[i];
    const next = tracks[i + 1];
    if (cur._external || next._external) continue;
    const score = calcSortScore(next, cur, phase, state.scoreWeights);
    if (score >= SCORE_YELLOW) continue;

    // Find up to 3 candidates that bridge cur → next
    const candidates = globalPool
      .map(t => ({
        t,
        score: calcSortScore(t, cur, phase, state.scoreWeights) + (next ? calcSortScore(next, t, phase, state.scoreWeights) : 0),
      }))
      .filter(({ t }) => !playlistIds.has(t.id || t.song))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ t }) => t);

    if (candidates.length) suggestions.push({ afterIndex: i, candidates });
  }
  return suggestions;
}

// ===== EXPORT =====

/**
 * Create a new Spotify playlist named "[CFLU OPT] <title>" and add all matched
 * (non-external) tracks in order. Returns the new playlist URL.
 * Respects Key Invariant 3: max 100 URIs per batch.
 */
export async function exportOptimized(tracks, title) {
  const meData = await spotifyCall('GET', '/me');
  const userId = meData && meData.id;
  if (!userId) throw new Error('Spotify-Nutzer nicht ermittelbar.');

  const pl = await spotifyCall('POST', `/users/${userId}/playlists`, {
    name: `[CFLU OPT] ${title}`,
    public: false,
    description: 'Optimiert mit CFLU WOD Builder',
  });
  if (!pl || !pl.id) throw new Error('Playlist konnte nicht angelegt werden.');

  const uris = tracks
    .filter(t => !t._external && t.id && t.id !== 'nan' && t.id !== '')
    .map(t => `spotify:track:${t.id}`);

  for (let i = 0; i < uris.length; i += 100) {
    await spotifyCall('POST', `/playlists/${pl.id}/items`, { uris: uris.slice(i, i + 100) });
  }
  return pl.external_urls?.spotify || `https://open.spotify.com/playlist/${pl.id}`;
}
