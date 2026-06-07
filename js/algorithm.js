// Core playlist generation algorithm
// TRACK_DATA is accessed lazily inside functions so this module is safe to import
// in test environments that don't load cflu_tracks.js.
import { GERMAN_GENRES, MIN_POOL_SIZE, PHASE_CONFIG, CAM_ZONE1, CAM_ZONE2 } from './config.js';
import { getNeighbours, getNeighboursWeighted, getRoleBonus, getSubgenres, bridgeTagsForMain } from './genres.js';
import { bpmGroup, neighbour, titleKey, titleDuplicate, camStrictOk, camCompat, calcPhaseScore, calcSortScore, isHalfDouble, camelotZoneDistance } from './utils.js';
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

export function pickNext(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover = []) {
  const { maxJump, wodEnergyMin, wodEnergyMax, currentPhase } = state;
  const cg = bpmGroup(cur.bpm);
  const maxArtist = Math.max(1, Math.floor(totalTracks * 0.1));

  const baseOk = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (t.bpm < cur.bpm) return false;
    if (t.bpm - cur.bpm > maxJump) return false;
    if (!neighbour(cg, bpmGroup(t.bpm))) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
    if (t.energy < wodEnergyMin || t.energy > wodEnergyMax) return false;
    return true;
  };

  const baseOkNoEnergy = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
    return true;
  };

  // Inner Camelot phases applied within each escalation level
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

  // Stufe 4: neighbour main (by weight), with half/double-time BPM bridge along neighbour edges
  if (!cands.length) {
    for (const nb of getNeighboursWeighted(curGenre)) {
      const s4 = pool.filter(t => {
        if (!baseOkNoEnergy(t)) return false;
        if (t.genre !== nb.mainId) return false;
        const bpmOk = (t.bpm >= cur.bpm && t.bpm - cur.bpm <= maxJump && neighbour(cg, bpmGroup(t.bpm)))
          || isHalfDouble(cur.bpm, t.bpm);
        if (!bpmOk) return false;
        if (!isHalfDouble(cur.bpm, t.bpm) && (t.energy < wodEnergyMin || t.energy > wodEnergyMax)) return false;
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

  // Phase 4: BPM escalation — ignores energy + BPM-group rules; last resort
  let fromPhase4 = false;
  if (!cands.length) {
    for (let extra = 5; extra <= 40; extra += 5) {
      cands = pool.filter(t => {
        if (!baseOkNoEnergy(t)) return false;
        if (t.bpm < cur.bpm + extra) return false;
        if (t.bpm - cur.bpm > maxJump + extra) return false;
        return true;
      });
      if (cands.length) { fromPhase4 = true; break; }
    }
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

  if (fromPhase4) {
    // Prefer candidates closer to Zone 1/2 (minimises key-cluster drift after fallback)
    cands.sort((a, b) => {
      const dA = camelotZoneDistance(a.camelot), dB = camelotZoneDistance(b.camelot);
      if (dA !== dB) return dA - dB;
      return calcSortScore(b, cur, currentPhase) - calcSortScore(a, cur, currentPhase);
    });
  } else {
    cands.sort((a, b) => calcSortScore(b, cur, currentPhase) - calcSortScore(a, cur, currentPhase));
  }

  const pickIdx = Math.floor(Math.random() * Math.min(5, cands.length));
  const picked = cands[pickIdx];
  carryover.length = 0;
  cands.slice(0, Math.min(5, cands.length))
    .filter(t => t !== picked)
    .slice(0, 2)
    .forEach(t => carryover.push(t));

  return picked;
}

export function pickPrev(pool, cur, usedIds, usedTitleKeys, usedArtists, totalTracks, carryover = []) {
  const { maxJump, wodEnergyMin, wodEnergyMax, currentPhase } = state;
  const cg = bpmGroup(cur.bpm);
  const maxArtist = Math.max(1, Math.floor(totalTracks * 0.1));

  const baseOk = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (t.bpm > cur.bpm) return false;
    if (cur.bpm - t.bpm > maxJump) return false;
    if (!neighbour(cg, bpmGroup(t.bpm))) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
    if (t.energy < wodEnergyMin || t.energy > wodEnergyMax) return false;
    return true;
  };

  const baseOkNoEnergy = t => {
    if (usedIds.has(t.id || t.song)) return false;
    if (t.speech > 66) return false;
    if (titleDuplicate(t.song, usedTitleKeys)) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
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

  if (curSubgenres.length) {
    const s1 = pool.filter(t => baseOk(t) && getSubgenres(t).some(tag => curSubgenres.includes(tag)));
    cands = applyInnerCamelot(s1);
  }

  if (!cands.length) {
    const s2 = pool.filter(t => baseOk(t) && t.genre === curGenre);
    cands = applyInnerCamelot(s2);
  }

  if (!cands.length && activeBridgeTags.length) {
    const s3 = pool.filter(t => baseOk(t) && getSubgenres(t).some(tag => activeBridgeTags.includes(tag)));
    cands = applyInnerCamelot(s3);
  }

  if (!cands.length) {
    for (const nb of getNeighboursWeighted(curGenre)) {
      const s4 = pool.filter(t => {
        if (!baseOkNoEnergy(t)) return false;
        if (t.genre !== nb.mainId) return false;
        const bpmOk = (t.bpm <= cur.bpm && cur.bpm - t.bpm <= maxJump && neighbour(cg, bpmGroup(t.bpm)))
          || isHalfDouble(cur.bpm, t.bpm);
        if (!bpmOk) return false;
        if (!isHalfDouble(cur.bpm, t.bpm) && (t.energy < wodEnergyMin || t.energy > wodEnergyMax)) return false;
        return true;
      });
      const s4cam = applyInnerCamelot(s4);
      if (s4cam.length) { cands = s4cam; break; }
    }
  }

  if (!cands.length) {
    const sf = pool.filter(t => baseOk(t));
    cands = applyInnerCamelot(sf);
  }

  // BPM escalation downward — ignores energy + BPM-group; last resort
  let fromPhase4 = false;
  if (!cands.length) {
    for (let extra = 5; extra <= 40; extra += 5) {
      cands = pool.filter(t => {
        if (!baseOkNoEnergy(t)) return false;
        if (t.bpm > cur.bpm) return false;
        if (cur.bpm - t.bpm > maxJump + extra) return false;
        return true;
      });
      if (cands.length) { fromPhase4 = true; break; }
    }
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

  if (fromPhase4) {
    cands.sort((a, b) => {
      const dA = camelotZoneDistance(a.camelot), dB = camelotZoneDistance(b.camelot);
      if (dA !== dB) return dA - dB;
      return calcSortScore(b, cur, currentPhase) - calcSortScore(a, cur, currentPhase);
    });
  } else {
    cands.sort((a, b) => calcSortScore(b, cur, currentPhase) - calcSortScore(a, cur, currentPhase));
  }

  const pickIdx = Math.floor(Math.random() * Math.min(5, cands.length));
  const picked = cands[pickIdx];
  carryover.length = 0;
  cands.slice(0, Math.min(5, cands.length))
    .filter(t => t !== picked)
    .slice(0, 2)
    .forEach(t => carryover.push(t));

  return picked;
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

export function buildDown(pool, endT, usedIds, usedTitleKeys, usedArtists, count) {
  const result = [];
  let cur = endT;
  const { maxJump, wodEnergyMin, wodEnergyMax } = state;
  const maxArtist = Math.max(1, Math.floor(count * 0.1));
  for (let i = 0; i < count; i++) {
    const cg = bpmGroup(cur.bpm);
    let cands = pool.filter(t => {
      if (usedIds.has(t.id || t.song)) return false;
      if (t.bpm > cur.bpm) return false;
      if (cur.bpm - t.bpm > maxJump) return false;
      if (!neighbour(cg, bpmGroup(t.bpm))) return false;
      if (titleDuplicate(t.song, usedTitleKeys)) return false;
      const ak = t.artist.split(',')[0].trim().toLowerCase();
      if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
      if (t.energy < wodEnergyMin || t.energy > wodEnergyMax) return false;
      return true;
    });
    if (!cands.length) break;
    cands.sort((a, b) => calcSortScore(b, cur, state.currentPhase) - calcSortScore(a, cur, state.currentPhase));
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
  const { maxJump } = state;
  const isFirst = () => result.length === 0;
  while (totalDur < targetSec) {
    const cands = pool.filter(t => {
      if (usedIds.has(t.id || t.song)) return false;
      if (titleDuplicate(t.song, usedTitleKeys)) return false;
      if (isFirst() && isHalfDouble(cur.bpm, t.bpm)) return true;
      if (t.bpm > cur.bpm) return false;
      if (cur.bpm - t.bpm > maxJump * 2) return false;
      return true;
    }).sort((a, b) => calcPhaseScore(b, 'D') - calcPhaseScore(a, 'D'));
    if (!cands.length) break;
    const pick = cands[0];
    addTrack(pick, result, usedIds, usedTitleKeys, usedArtists);
    totalDur += pick.dur;
    cur = pick;
  }
  return result;
}
