// Core playlist generation algorithm
// TRACK_DATA is accessed lazily inside functions so this module is safe to import
// in test environments that don't load cflu_tracks.js.
import { GERMAN_GENRES, GENRE_NEIGHBOURS, MIN_POOL_SIZE, PHASE_CONFIG, CAM_ZONE1, CAM_ZONE2 } from './config.js';
import { state } from './state.js';
import { bpmGroup, neighbour, titleKey, camStrictOk, camCompat, calcPhaseScore, calcSortScore } from './utils.js';

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
  let pool = getPhasePool(genre, phase);
  if (pool.length < MIN_POOL_SIZE) {
    for (const nb of (GENRE_NEIGHBOURS[genre] || [])) {
      pool = [...pool, ...getPhasePool(nb, phase)];
      if (pool.length >= MIN_POOL_SIZE) break;
    }
  }
  return pool;
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
    if (t.bpm < cur.bpm) return false;
    if (t.bpm - cur.bpm > maxJump) return false;
    if (!neighbour(cg, bpmGroup(t.bpm))) return false;
    if (titleKey(t.song) && usedTitleKeys.has(titleKey(t.song))) return false;
    const ak = t.artist.split(',')[0].trim().toLowerCase();
    if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
    if (t.energy < wodEnergyMin || t.energy > wodEnergyMax) return false;
    return true;
  };

  // Phase 1: strict Camelot + zone 1/2
  let cands = pool.filter(t => baseOk(t) && camStrictOk(cur.camelot, t.camelot) && (CAM_ZONE1.has(t.camelot) || CAM_ZONE2.has(t.camelot)));
  // Phase 2: relax zone constraint
  if (!cands.length) cands = pool.filter(t => baseOk(t) && camStrictOk(cur.camelot, t.camelot));
  // Phase 3: yellow Camelot
  if (!cands.length) cands = pool.filter(t => baseOk(t) && camCompat(cur.camelot, t.camelot) !== 'red');
  // Phase 4: BPM escalation — ignores energy filter and BPM-group rule; no carryover injection
  if (!cands.length) {
    for (let extra = 5; extra <= 40; extra += 5) {
      cands = pool.filter(t => {
        if (usedIds.has(t.id || t.song)) return false;
        if (t.bpm < cur.bpm + extra) return false;
        if (t.bpm - cur.bpm > maxJump + extra) return false;
        if (titleKey(t.song) && usedTitleKeys.has(titleKey(t.song))) return false;
        const ak = t.artist.split(',')[0].trim().toLowerCase();
        if ((usedArtists.get(ak) || 0) >= maxArtist) return false;
        return true;
      });
      if (cands.length) break;
    }
  }
  if (!cands.length) return null;

  // Inject carryover candidates from the previous step that still satisfy hard constraints
  // and are at least Camelot-yellow with the new cur. calcSortScore handles their ranking.
  if (carryover.length) {
    const candIds = new Set(cands.map(t => t.id || t.song));
    for (const t of carryover) {
      if (candIds.has(t.id || t.song)) continue;
      if (!baseOk(t)) continue;
      if (camCompat(cur.camelot, t.camelot) === 'red') continue;
      cands.push(t);
    }
  }

  cands.sort((a, b) => calcSortScore(b, cur, currentPhase) - calcSortScore(a, cur, currentPhase));

  // Pick randomly from top-5; update carryover with top-2 unselected from that window
  const pickIdx = Math.floor(Math.random() * Math.min(5, cands.length));
  const picked = cands[pickIdx];
  carryover.length = 0;
  cands.slice(0, Math.min(5, cands.length))
    .filter(t => t !== picked)
    .slice(0, 2)
    .forEach(t => carryover.push(t));

  return picked;
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
    const next = pickNext(pool, cur, usedIds, usedTitleKeys, usedArtists, limit || 20, carryover);
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
      if (titleKey(t.song) && usedTitleKeys.has(titleKey(t.song))) return false;
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
    if (titleKey(t.song) && usedTitleKeys.has(titleKey(t.song))) return false;
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
  while (totalDur < targetSec) {
    const cands = pool.filter(t => {
      if (usedIds.has(t.id || t.song)) return false;
      if (t.bpm > cur.bpm) return false;
      if (cur.bpm - t.bpm > maxJump * 2) return false;
      if (titleKey(t.song) && usedTitleKeys.has(titleKey(t.song))) return false;
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
