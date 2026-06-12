// algorithm.js — playlist generation only; no DOM, no state writes, no Spotify calls
// TRACK_DATA accessed lazily — safe to import in Node.js tests without cflu_tracks.js
import { GERMAN_GENRES, PHASE_CONFIG, CAM_ZONE1, CAM_ZONE2 } from './config.js';
import { getNeighboursWeighted, getRoleBonus, getSubgenres, bridgeTagsForMain } from './genres.js';
import { titleKey, titleDuplicate, camStrictOk, camCompat, calcPhaseScore, calcSortScore, isHalfDouble, calcBpmTransitionScore, effectiveBpm } from './utils.js';
import { state } from './state.js';

const NEIGHBOUR_BLEND_FACTOR = 0.3;

function td() {
  // Lazy accessor — only evaluated when generation runs, not at module load time
  return typeof TRACK_DATA !== 'undefined' ? TRACK_DATA : {tracks: [], stats: {}};
}

export function getAllTracks() { return td().tracks; }
export function getGenreStats() { return td().stats; }

export function getPool(genre) {
  const all = getAllTracks();
  if (genre === 'Alle Deutschen Tracks') return all.filter(t => GERMAN_GENRES.includes(t.genre));
  if (genre === 'Going Wild') return all;
  return all.filter(t => t.genre === genre);
}

export function getPhasePool(genre, phase) {
  const base = getPool(genre);
  const cfg = PHASE_CONFIG[phase] || {};
  const eMin = cfg.energy ? cfg.energy[0] : 0;
  const eMax = cfg.energy ? cfg.energy[1] : 100;
  return base.filter(t => t.energy >= eMin && t.energy <= eMax);
}

export function getPhasePoolWithNeighbours(genre, phase) {
  const directPool = getPhasePool(genre, phase);
  const neighbourCandidates = [];
  for (const nb of getNeighboursWeighted(genre)) {
    const nbPool = getPhasePool(nb.mainId, phase);
    const roleBonus = getRoleBonus(nb.mainId, phase);
    const effectiveWeight = Math.min(1.0, Math.max(0, nb.weight + roleBonus));
    const quota = Math.ceil(nbPool.length * effectiveWeight * NEIGHBOUR_BLEND_FACTOR);
    neighbourCandidates.push(...nbPool.slice(0, quota));
  }
  return [...directPool, ...neighbourCandidates];
}

export function registerTrack(t, usedIds, usedTitleKeys, usedArtists) {
  usedIds.add(t.id || t.song);
  const tk = titleKey(t.song); if (tk) usedTitleKeys.add(tk);
  const ak = t.artist.split(',')[0].trim().toLowerCase();
  usedArtists.set(ak, (usedArtists.get(ak) || 0) + 1);
}

export function addTrack(t, result, usedIds, usedTitleKeys, usedArtists) {
  result.push(t);
  registerTrack(t, usedIds, usedTitleKeys, usedArtists);
}

// Unbiased integer in [0, n) via Web Crypto.
// Modulo bias = (2^32 mod n) / 2^32 ≤ 5/2^32 for n ≤ 5 — negligible for playlist selection.
function _randomInt(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

// Unified pick — asc=true → ascending BPM (pickNext), asc=false → descending (pickPrev).
// The sole algorithmic difference is the BPM-delta direction:
//   delta(t) = asc ? t.bpm - cur.bpm : cur.bpm - t.bpm
// A positive delta means a step in the intended direction; negative means wrong way.
function _camLockOk(t) {
  if (!state.lockCamFilter) return true;
  if (!t.camelot || t.camelot === 'nan') return false;
  if (state.camLetter !== 'both' && t.camelot.slice(-1).toUpperCase() !== state.camLetter) return false;
  if (state.camNumbers.length > 0 && !state.camNumbers.includes(parseInt(t.camelot, 10))) return false;
  return true;
}

function _pick(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover, asc) {
  const { wodEnergyMin, wodEnergyMax, currentPhase, allowLog2 } = state;
  const maxArtist = Math.max(1, Math.floor(totalTracks * 0.1));

  // BPM gate: score 0.00 = hard exclude within a phase.
  // Monotonicity: effective BPM (×2/÷2 normalised to phase band) must not reverse direction.
  const bpmOk = t => {
    if (calcBpmTransitionScore(cur.bpm, t.bpm, allowLog2) === 0) return false;
    const effCur = effectiveBpm(cur.bpm, currentPhase);
    const effT   = effectiveBpm(t.bpm, currentPhase);
    if (asc  && effT < effCur) return false;
    if (!asc && effT > effCur) return false;
    return true;
  };

  const baseOk = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (!bpmOk(t)) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
    if (t.energy < wodEnergyMin || t.energy > wodEnergyMax) return false;
    if (!_camLockOk(t)) return false;
    return true;
  };

  const baseOkNoEnergy = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (!bpmOk(t)) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
    if (!_camLockOk(t)) return false;
    return true;
  };

  function applyInnerCamelot(subset) {
    let c = subset.filter(t => camStrictOk(cur.camelot, t.camelot) && (CAM_ZONE1.has(t.camelot) || CAM_ZONE2.has(t.camelot)));
    if (c.length) return c;
    c = subset.filter(t => camStrictOk(cur.camelot, t.camelot));
    if (c.length) return c;
    c = subset.filter(t => camCompat(cur.camelot, t.camelot) !== 'red');
    if (c.length) return c;
    return subset;
  }

  const curSubgenres = getSubgenres(cur);
  const curGenre = cur.genre || '';
  const activeBridgeTags = bridgeTagsForMain(curGenre);
  let cands = [];

  // Stufe 1: same subgenre (genres_raw overlap)
  if (curSubgenres.length) {
    const s1 = pool.filter(t => baseOk(t) && getSubgenres(t).some(tag => curSubgenres.includes(tag)));
    cands = applyInnerCamelot(s1);
  }

  // Stufe 2: same main genre, different subgenre
  if (!cands.length) {
    const s2 = pool.filter(t => baseOk(t) && t.genre === curGenre);
    cands = applyInnerCamelot(s2);
  }

  // Stufe 3: bridge-pivot track connecting curGenre to a neighbour
  if (!cands.length && activeBridgeTags.length) {
    const s3 = pool.filter(t => baseOk(t) && getSubgenres(t).some(tag => activeBridgeTags.includes(tag)));
    cands = applyInnerCamelot(s3);
  }

  // Stufe 4: neighbour main genre (by weight); energy relaxed for half/double-time matches
  if (!cands.length) {
    for (const nb of getNeighboursWeighted(curGenre)) {
      const s4 = pool.filter(t => {
        if (!baseOkNoEnergy(t)) return false;
        if (t.genre !== nb.mainId) return false;
        // Restore energy check unless the track is a half/double-time match
        const isHD = allowLog2 && isHalfDouble(cur.bpm, t.bpm);
        if (!isHD && (t.energy < wodEnergyMin || t.energy > wodEnergyMax)) return false;
        return true;
      });
      const s4cam = applyInnerCamelot(s4);
      if (s4cam.length) { cands = s4cam; break; }
    }
  }

  // Camelot fallback: when genre context is missing or all stufen exhausted
  if (!cands.length) {
    const sf = pool.filter(t => baseOk(t));
    cands = applyInnerCamelot(sf);
  }

  if (!cands.length) return null;

  if (carryover.length) {
    const candIds = new Set(cands.map(t => t.id || t.song));
    for (const t of carryover) {
      if (candIds.has(t.id || t.song)) continue;
      if (!baseOk(t)) continue;
      if (camCompat(cur.camelot, t.camelot) === 'red') continue;
      cands.push(t);
    }
  }

  cands.sort((a, b) => calcSortScore(b, cur, currentPhase, allowLog2) - calcSortScore(a, cur, currentPhase, allowLog2));

  const top = Math.min(5, cands.length);
  const picked = cands[_randomInt(top)];
  carryover.length = 0;
  cands.slice(0, top).filter(t => t !== picked).slice(0, 2).forEach(t => carryover.push(t));
  return picked;
}

export function pickNext(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover = []) {
  return _pick(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover, true);
}

export function pickPrev(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover = []) {
  return _pick(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover, false);
}

export function buildAlternating(pool, ref, usedIds, usedTitleKeys, usedArtists, targetSec) {
  const playlist = [ref];
  let totalDur = ref.dur;
  const carryHead = [];
  const carryTail = [];
  const estTracks = Math.max(20, Math.round(targetSec / 210));

  while (true) {
    let added = false;

    const prev = pickPrev(pool, playlist[0], usedIds, usedTitleKeys, usedArtists, estTracks, carryHead);
    if (prev) {
      playlist.unshift(prev);
      registerTrack(prev, usedIds, usedTitleKeys, usedArtists);
      totalDur += prev.dur;
      added = true;
    }
    if (totalDur >= targetSec * 1.05) break;

    const next = pickNext(pool, playlist[playlist.length - 1], usedIds, usedTitleKeys, usedArtists, estTracks, carryTail);
    if (next) {
      playlist.push(next);
      registerTrack(next, usedIds, usedTitleKeys, usedArtists);
      totalDur += next.dur;
      added = true;
    }
    if (totalDur >= targetSec * 1.05) break;

    if (!added) break;
  }

  return playlist;
}

export function buildUp(pool, startT, usedIds, usedTitleKeys, usedArtists, targetSec, count) {
  const result = [];
  addTrack(startT, result, usedIds, usedTitleKeys, usedArtists);
  let totalDur = startT.dur;
  let cur = startT;
  const limit = count || 9999;
  const carryover = [];
  while (result.length < limit) {
    if (targetSec && totalDur >= targetSec) break;
    const next = pickNext(pool, cur, usedIds, usedTitleKeys, usedArtists, result.length, carryover);
    if (!next) break;
    addTrack(next, result, usedIds, usedTitleKeys, usedArtists);
    totalDur += next.dur;
    cur = next;
  }
  return result;
}

// buildDown is intentionally a simple BPM-descending loop rather than _pick()-based:
// Cool-Down only needs "go lower", no 4-stage genre/subgenre/bridge lookup required.
export function buildDown(pool, endT, usedIds, usedTitleKeys, usedArtists, count) {
  const result = [];
  let cur = endT;
  const { wodEnergyMin, wodEnergyMax, allowLog2 } = state;
  const maxArtist = Math.max(1, Math.floor(count * 0.1));
  for (let i = 0; i < count; i++) {
    const cands = pool.filter(t => {
      if (usedIds.has(t.id || t.song)) return false;
      if (t.bpm > cur.bpm) return false;
      if (calcBpmTransitionScore(cur.bpm, t.bpm, allowLog2) === 0) return false;
      if (titleDuplicate(t.song, usedTitleKeys)) return false;
      const ak = t.artist.split(',')[0].trim().toLowerCase();
      if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
      if (t.energy < wodEnergyMin || t.energy > wodEnergyMax) return false;
      if (!_camLockOk(t)) return false;
      return true;
    });
    if (!cands.length) break;
    cands.sort((a, b) => calcSortScore(b, cur, state.currentPhase, allowLog2) - calcSortScore(a, cur, state.currentPhase, allowLog2));
    const pick = cands[0];
    result.unshift(pick);
    registerTrack(pick, usedIds, usedTitleKeys, usedArtists);
    cur = pick;
  }
  return result;
}

export function buildPlateau(pool, refBpm, usedIds, usedTitleKeys, usedArtists, targetSec) {
  const result = [];
  const band = 12;
  let totalDur = 0;
  const cands = pool.filter(t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (Math.abs(t.bpm - refBpm) > band) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    if (!_camLockOk(t)) return false;
    return true;
  }).sort((a, b) => calcPhaseScore(b, 'A') - calcPhaseScore(a, 'A'));
  for (const t of cands) {
    if (totalDur >= targetSec) break;
    addTrack(t, result, usedIds, usedTitleKeys, usedArtists);
    totalDur += t.dur;
  }
  return result;
}

export function buildDecreasing(pool, startBpm, usedIds, usedTitleKeys, usedArtists, targetSec) {
  const result = [];
  let cur = {bpm: startBpm, camelot: '', energy: 100};
  let totalDur = 0;
  const { allowLog2 } = state;
  const isFirst = () => result.length === 0;
  while (totalDur < targetSec) {
    const cands = pool.filter(t => {
      if (usedIds.has(t.id || t.song)) return false;
      if (titleDuplicate(t.song, usedTitleKeys)) return false;
      if (!_camLockOk(t)) return false;
      // C→D first track: prefer ×2/÷2-compatible entry when allowLog2 is active
      if (isFirst() && allowLog2 && isHalfDouble(cur.bpm, t.bpm)) return true;
      if (t.bpm > cur.bpm) return false;
      if (calcBpmTransitionScore(cur.bpm, t.bpm, allowLog2) === 0) return false;
      return true;
    }).sort((a, b) => {
      // First pick: rank half/double-time matches above others (C→D rhythmic cohesion)
      if (isFirst() && allowLog2) {
        const aHD = isHalfDouble(cur.bpm, a.bpm) ? 1 : 0;
        const bHD = isHalfDouble(cur.bpm, b.bpm) ? 1 : 0;
        if (aHD !== bHD) return bHD - aHD;
      }
      return calcPhaseScore(b, 'D') - calcPhaseScore(a, 'D');
    });
    if (!cands.length) break;
    const pick = cands[0];
    addTrack(pick, result, usedIds, usedTitleKeys, usedArtists);
    totalDur += pick.dur;
    cur = pick;
  }
  return result;
}
