// algorithm.js — playlist generation only; no DOM, no state writes, no Spotify calls
// TRACK_DATA accessed lazily — safe to import in Node.js tests without cflu_tracks.js
import { GERMAN_GENRES, PHASE_CONFIG, CAM_ZONE1, CAM_ZONE2, BPM_GATE_MIN_SCORE, MONO_STEP_BACK_BPM } from './config.js';
import { getNeighboursWeighted, getNeighbours, getRoleBonus, getSubgenres, bridgeTagsForMain } from './genres.js';
import { titleKey, titleDuplicate, camStrictOk, camCompat, calcPhaseScore, calcSortScore, isHalfDouble, calcBpmTransitionScore, effectiveBpm, artistKeys } from './utils.js';
import { state } from './state.js';

const NEIGHBOUR_BLEND_FACTOR = 0.3;

const _energyOk = (t, min, max) => t.energy >= min && t.energy <= max;

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
  const [bpmLo, bpmHi] = cfg.bpm || [0, 999];
  return base.filter(t => {
    if (t.energy < eMin || t.energy > eMax) return false;
    const eff = effectiveBpm(t.bpm, phase);
    return eff >= bpmLo && eff <= bpmHi;
  });
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
  for (const ak of artistKeys(t.artist)) usedArtists.set(ak, (usedArtists.get(ak) || 0) + 1);
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

function _pfOk(t) {
  const pf = state.poolFilter;
  if (pf.minBpm > 0 && t.bpm < pf.minBpm) return false;
  if (pf.maxBpm < 220 && t.bpm > pf.maxBpm) return false;
  if (pf.minEnergy > 0 && (t.energy || 0) < pf.minEnergy) return false;
  if (pf.minValence > 0 && (t.valence || 0) < pf.minValence) return false;
  if (pf.minDance > 0 && (t.dance || 0) < pf.minDance) return false;
  if (pf.minPopularity > 0 && (t.popularity || 0) < pf.minPopularity) return false;
  return true;
}

function _pick(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover, asc) {
  const { wodEnergyMin, wodEnergyMax, currentPhase } = state;
  const maxArtist = Math.max(1, Math.floor(totalTracks * 0.1));

  // BPM gate: score must reach BPM_GATE_MIN_SCORE (Spotify-crossfade-safe threshold).
  // Ascending monotonicity: effective BPM may step back by at most MONO_STEP_BACK_BPM
  // so the playlist trends upward overall without being locked step-by-step.
  // Descending monotonicity: stays strict (no forward step allowed).
  const bpmOk = t => {
    if (calcBpmTransitionScore(cur.bpm, t.bpm) < BPM_GATE_MIN_SCORE) return false;
    const effCur = effectiveBpm(cur.bpm, currentPhase);
    const effT   = effectiveBpm(t.bpm, currentPhase);
    if (asc  && effT < effCur - MONO_STEP_BACK_BPM) return false;
    if (!asc && effT >  effCur) return false;
    return true;
  };

  const baseOk = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (!bpmOk(t)) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    if (artistKeys(t.artist).some(ak => (usedArtists.get(ak) || 0) >= maxArtist)) return false;
    if (!_energyOk(t, wodEnergyMin, wodEnergyMax)) return false;
    if (!_camLockOk(t)) return false;
    if (state.explicitFilter === 'exclude' && t.explicit) return false;
    if (state.explicitFilter === 'only' && !t.explicit) return false;
    return true;
  };

  const baseOkNoEnergy = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (!bpmOk(t)) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    if (artistKeys(t.artist).some(ak => (usedArtists.get(ak) || 0) >= maxArtist)) return false;
    if (!_camLockOk(t)) return false;
    if (state.explicitFilter === 'exclude' && t.explicit) return false;
    if (state.explicitFilter === 'only' && !t.explicit) return false;
    return true;
  };

  // REQUIREMENTS.md §3.2: red Camelot transitions are a hard gate, never a fallback —
  // if nothing survives (even the "any non-red" tier), return empty, not the unfiltered subset.
  function applyInnerCamelot(subset) {
    let c = subset.filter(t => camStrictOk(cur.camelot, t.camelot) && (CAM_ZONE1.has(t.camelot) || CAM_ZONE2.has(t.camelot)));
    if (c.length) return c;
    c = subset.filter(t => camStrictOk(cur.camelot, t.camelot));
    if (c.length) return c;
    return subset.filter(t => camCompat(cur.camelot, t.camelot) !== 'red');
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
        const isHD = isHalfDouble(cur.bpm, t.bpm);
        if (!isHD && !_energyOk(t, wodEnergyMin, wodEnergyMax)) return false;
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

  cands.sort((a, b) => calcSortScore(b, cur, currentPhase, state.scoreWeights) - calcSortScore(a, cur, currentPhase, state.scoreWeights));

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
  const { wodEnergyMin, wodEnergyMax } = state;
  const maxArtist = Math.max(1, Math.floor(count * 0.1));
  for (let i = 0; i < count; i++) {
    const cands = pool.filter(t => {
      if (usedIds.has(t.id || t.song)) return false;
      if (t.bpm > cur.bpm) return false;
      if (calcBpmTransitionScore(cur.bpm, t.bpm) < BPM_GATE_MIN_SCORE) return false;
      // REQUIREMENTS.md §3.2: red Camelot transitions are a hard gate, not a score component.
      if (camCompat(cur.camelot, t.camelot) === 'red') return false;
      if (titleDuplicate(t.song, usedTitleKeys)) return false;
      if (artistKeys(t.artist).some(ak => (usedArtists.get(ak) || 0) >= maxArtist)) return false;
      if (!_energyOk(t, wodEnergyMin, wodEnergyMax)) return false;
      if (!_camLockOk(t)) return false;
      if (state.explicitFilter === 'exclude' && t.explicit) return false;
      if (state.explicitFilter === 'only' && !t.explicit) return false;
      return true;
    });
    if (!cands.length) break;
    cands.sort((a, b) => calcSortScore(b, cur, state.currentPhase, state.scoreWeights) - calcSortScore(a, cur, state.currentPhase, state.scoreWeights));
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
    if (state.explicitFilter === 'exclude' && t.explicit) return false;
    if (state.explicitFilter === 'only' && !t.explicit) return false;
    return true;
  }).sort((a, b) => calcPhaseScore(b, 'A') - calcPhaseScore(a, 'A'));
  for (const t of cands) {
    if (totalDur >= targetSec) break;
    addTrack(t, result, usedIds, usedTitleKeys, usedArtists);
    totalDur += t.dur;
  }
  return result;
}

// Returns the best replacement for a playlist slot, satisfying BPM transition to both neighbors.
// prev and next may be null for first/last slot. excludeIds must NOT contain the replaced track's id.
export function pickReplacement(pool, prev, next, excludeIds, usedTitleKeys, usedArtists, maxArtist, phase) {
  const cands = pool.filter(t => {
    if (excludeIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    if (artistKeys(t.artist).some(ak => (usedArtists.get(ak) || 0) >= maxArtist)) return false;
    if (!_camLockOk(t)) return false;
    if (state.explicitFilter === 'exclude' && t.explicit) return false;
    if (state.explicitFilter === 'only' && !t.explicit) return false;
    if (prev && calcBpmTransitionScore(prev.bpm, t.bpm) === 0) return false;
    if (next && calcBpmTransitionScore(t.bpm, next.bpm) === 0) return false;
    // REQUIREMENTS.md §3.2: red Camelot transitions are a hard gate, not a score component.
    if (prev && camCompat(prev.camelot, t.camelot) === 'red') return false;
    if (next && camCompat(t.camelot, next.camelot) === 'red') return false;
    if (!_pfOk(t)) return false;
    return true;
  });
  if (!cands.length) return null;
  const ref = prev || next;
  cands.sort((a, b) => calcSortScore(b, ref, phase, state.scoreWeights) - calcSortScore(a, ref, phase, state.scoreWeights));
  return cands[0];
}

// Position "End": reference track anchors the end of the WOD. Descend toward it via buildDown,
// then fill any remaining budget forward from that anchor point before appending ref last.
export function buildEnd(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec, estTracks) {
  const { wodEnergyMin, wodEnergyMax } = state;
  const half = Math.round((rawTargetSec / 2) / (ref.dur || 210));
  registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
  const before = buildDown(pool, ref, usedIds, usedTitleKeys, usedArtists, Math.ceil(half * 1.4));
  const beforePool = pool.filter(t => !usedIds.has(t.id || t.song) && t.bpm <= ref.bpm && t.energy >= wodEnergyMin && t.energy <= wodEnergyMax);
  const totalBefore = rawTargetSec - ref.dur;
  let durSoFar = before.reduce((s, t) => s + t.dur, 0);
  let cur = before.length ? before[before.length - 1] : null;
  if (cur) {
    while (durSoFar < totalBefore - 60) {
      const next = pickNext(beforePool, cur, usedIds, usedTitleKeys, usedArtists, estTracks);
      if (!next) break;
      addTrack(next, before, usedIds, usedTitleKeys, usedArtists);
      durSoFar += next.dur; cur = next;
    }
  }
  return [...before, ref];
}

// Position "Plateau": ref sits in the middle. Descend before it (buildDown), then hold a
// BPM plateau band (±12) after it for the second half — mirrors buildPlateau's banding but
// centred on the reference track's own BPM instead of a fixed target.
export function buildPlateauSplit(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec) {
  const { wodEnergyMin, wodEnergyMax, currentPhase } = state;
  const halfSec = Math.floor(rawTargetSec / 2);
  registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
  const before = buildDown(pool, ref, usedIds, usedTitleKeys, usedArtists, Math.ceil(halfSec / (ref.dur || 210)));
  const after = [];
  const platCands = pool.filter(t =>
    !usedIds.has(t.id || t.song) &&
    Math.abs(t.bpm - ref.bpm) <= 12 &&
    (!titleKey(t.song) || !usedTitleKeys.has(titleKey(t.song))) &&
    t.energy >= wodEnergyMin && t.energy <= wodEnergyMax &&
    // REQUIREMENTS.md §3.2: red Camelot transitions are a hard gate, not a score component.
    // This filter had no Camelot check at all prior to the #202 extraction — found live.
    camCompat(ref.camelot, t.camelot) !== 'red'
  ).sort((a, b) => calcPhaseScore(b, currentPhase) - calcPhaseScore(a, currentPhase));
  let platDur = 0;
  for (const t of platCands) {
    if (platDur >= halfSec) break;
    addTrack(t, after, usedIds, usedTitleKeys, usedArtists);
    platDur += t.dur;
  }
  return [...before, ref, ...after];
}

// Post-WOD Cool-Down block: filters the Phase-D pool below the WOD's peak BPM, falls back to
// neighbour genres if too few candidates, and anchors the first CD track to a valid
// Ratio-Lattice transition from the last WOD track. Returns { cd, warnings } — caller merges
// warnings into its own generation-log message list.
export function buildCooldown(genre, wod, usedIds, usedTitleKeys, usedArtists) {
  const warnings = [];
  const maxWodBpm = wod.length ? Math.max(...wod.map(t => t.bpm)) : 100;
  const cdBpmMax = state.currentPhase === 'D' ? Math.floor(maxWodBpm * 0.85) : Math.floor(maxWodBpm * 0.7);
  const cdEnergyMax = PHASE_CONFIG['D'].energy[1];
  let cdPool = getPhasePoolWithNeighbours(genre, 'D').filter(t => !usedIds.has(t.id || t.song) && t.bpm <= cdBpmMax && t.energy <= cdEnergyMax);
  if (cdPool.length < 3) {
    for (const nb of getNeighbours(genre)) {
      cdPool = [...cdPool, ...getPhasePool(nb, 'D').filter(t => !usedIds.has(t.id || t.song) && t.bpm <= cdBpmMax && t.energy <= cdEnergyMax)];
      if (cdPool.length >= 3) { warnings.push(`Cool-Down: Nachbar-Genre "${nb}" ergänzt`); break; }
    }
  }
  cdPool.sort((a, b) => calcPhaseScore(b, 'D') - calcPhaseScore(a, 'D') || a.bpm - b.bpm);
  const lastWodBpm = wod.length ? wod[wod.length - 1].bpm : 0;
  if (lastWodBpm && cdPool.length > 1) {
    const firstIdx = cdPool.findIndex(t => calcBpmTransitionScore(lastWodBpm, t.bpm) >= BPM_GATE_MIN_SCORE);
    if (firstIdx > 0) cdPool.unshift(cdPool.splice(firstIdx, 1)[0]);
  }
  const cd = [];
  let cdSec = 0;
  for (const t of cdPool) {
    if (cdSec >= state.cdMinutes * 60) break;
    addTrack(t, cd, usedIds, usedTitleKeys, usedArtists);
    cdSec += t.dur;
  }
  return { cd, warnings };
}

// startRef: full track object (preferred) or plain BPM number (backward-compat with tests)
export function buildDecreasing(pool, startRef, usedIds, usedTitleKeys, usedArtists, targetSec) {
  const result = [];
  let cur = (typeof startRef === 'object' && startRef !== null)
    ? startRef
    : { bpm: startRef, camelot: '', energy: 100 };
  let totalDur = 0;

  const baseFilter = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    if (!_camLockOk(t)) return false;
    // REQUIREMENTS.md §3.2: red Camelot transitions are a hard gate, not a score component.
    if (camCompat(cur.camelot, t.camelot) === 'red') return false;
    if (state.explicitFilter === 'exclude' && t.explicit) return false;
    if (state.explicitFilter === 'only' && !t.explicit) return false;
    return true;
  };

  const byScore = (a, b) => calcSortScore(b, cur, 'D', state.scoreWeights) - calcSortScore(a, cur, 'D', state.scoreWeights);

  while (totalDur < targetSec) {
    let cands = pool.filter(t => {
      if (!baseFilter(t)) return false;
      if (t.bpm > cur.bpm) return false;
      return calcBpmTransitionScore(cur.bpm, t.bpm) >= BPM_GATE_MIN_SCORE;
    }).sort(byScore);

    // Fallback 1: Ratio-Lattice in narrow descending BPM range exhausts quickly —
    // allow any track with bpm ≤ cur.bpm so long playlists don't terminate early
    if (!cands.length) {
      cands = pool.filter(t => {
        if (!baseFilter(t)) return false;
        return t.bpm <= cur.bpm;
      }).sort(byScore);
    }

    // Fallback 2: descent floor reached — plateau at current BPM level (±5 BPM)
    // Rationale: once BPM can't go lower (e.g. Phase D floor at 60), holding the
    // current tempo is musically correct for a long Cool-Down/Recovery session.
    if (!cands.length) {
      cands = pool.filter(t => {
        if (!baseFilter(t)) return false;
        return t.bpm >= cur.bpm - 5 && t.bpm <= cur.bpm + 5;
      }).sort(byScore);
    }

    if (!cands.length) break;
    const pick = cands[0];
    addTrack(pick, result, usedIds, usedTitleKeys, usedArtists);
    totalDur += pick.dur;
    cur = pick;
  }
  return result;
}
