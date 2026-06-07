// Pure helper functions — no DOM, no state, no TRACK_DATA dependency
import { BPM_GROUPS, BPM_RANGES, SUFFIX_RE, PHASE_CONFIG } from './config.js';
import { bridgeTagsForMain } from './genres.js';

export function bpmGroup(bpm) {
  for (const [g,[lo,hi]] of Object.entries(BPM_RANGES)) if (bpm >= lo && bpm < hi) return g;
  return 'I';
}
export function groupIdx(g) { return BPM_GROUPS.indexOf(g); }
export function neighbour(g1, g2) { return Math.abs(groupIdx(g1) - groupIdx(g2)) <= 1; }

export function fmtDur(s) {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return m + 'm' + String(sec).padStart(2, '0') + 's';
}
export function fmtMin(s) { return Math.round(s / 60) + 'min'; }

export function lerpColor(t, stops) {
  if (t <= stops[0].p) return stops[0];
  if (t >= stops[stops.length - 1].p) return stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= a.p && t <= b.p) {
      const f = (t - a.p) / (b.p - a.p);
      return {r: Math.round(a.r + (b.r - a.r) * f), g: Math.round(a.g + (b.g - a.g) * f), b: Math.round(a.b + (b.b - a.b) * f)};
    }
  }
  return stops[stops.length - 1];
}
export function toRgb(c) { return `rgb(${c.r},${c.g},${c.b})`; }
export function toHex(c) { return '#' + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join(''); }

export function camCompat(c1, c2) {
  if (!c1 || !c2 || c1 === 'nan' || c2 === 'nan') return 'unknown';
  try {
    const n1 = parseInt(c1), l1 = c1.slice(-1).toUpperCase();
    const n2 = parseInt(c2), l2 = c2.slice(-1).toUpperCase();
    if (n1 === n2) return 'green';
    const diff = Math.min(Math.abs(n1 - n2), 12 - Math.abs(n1 - n2));
    if (diff === 1 && l1 === l2) return 'green';
    if (diff === 2 && l1 === l2) return 'yellow';
    return 'red';
  } catch { return 'unknown'; }
}
export function camStrictOk(c1, c2) { return camCompat(c1, c2) === 'green'; }

export function titleKey(s) {
  return s.replace(SUFFIX_RE, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
}

export function titleDuplicate(song, usedTitleKeys) {
  const tk = titleKey(song);
  if (!tk) return false;
  if (usedTitleKeys.has(tk)) return true;
  // startsWith in both directions — catches "Freestyler" ↔ "Freestyler (Rock The Microphone)"
  // Guard: only when shorter key is ≥ 6 chars to avoid false positives on short titles
  for (const used of usedTitleKeys) {
    const shorter = tk.length <= used.length ? tk : used;
    const longer  = tk.length <= used.length ? used : tk;
    if (shorter.length >= 6 && longer.startsWith(shorter)) return true;
  }
  return false;
}

const CAM_ZONE_KEYS = new Set(['8B','9B','10B','11B','12B','1B','8A','9A','10A','11A','12A','1A']);
// Minimum Camelot-wheel steps from key to nearest Zone-1/2 key.
// Letter change costs 1 extra step. Zone keys return 0.
export function camelotZoneDistance(key) {
  if (!key || key === 'nan') return 99;
  if (CAM_ZONE_KEYS.has(key)) return 0;
  try {
    const n1 = parseInt(key), l1 = key.slice(-1).toUpperCase();
    let min = 99;
    for (const zk of CAM_ZONE_KEYS) {
      const n2 = parseInt(zk), l2 = zk.slice(-1).toUpperCase();
      const d = Math.min(Math.abs(n1 - n2), 12 - Math.abs(n1 - n2)) + (l1 !== l2 ? 1 : 0);
      if (d < min) min = d;
    }
    return min;
  } catch { return 99; }
}

export function attrScore(val, spec) {
  if (val === undefined || val === null) return 50;
  let lo = -Infinity, hi = Infinity;
  if (spec.min !== undefined) lo = spec.min;
  if (spec.max !== undefined) hi = spec.max;
  if (val >= lo && val <= hi) return 100;
  const dist = val < lo ? lo - val : val - hi;
  return Math.max(0, 100 - dist * 3);
}

export function trapezScore(bpm, core, band) {
  if (bpm >= core[0] && bpm <= core[1]) return 100;
  if (bpm < band[0] || bpm > band[1]) return 0;
  if (bpm < core[0]) return Math.round((bpm - band[0]) / (core[0] - band[0]) * 100);
  return Math.round((band[1] - bpm) / (band[1] - core[1]) * 100);
}

export function calcPhaseScore(t, phase) {
  const cfg = PHASE_CONFIG[phase];
  if (!cfg) return 50;
  const scores = [];
  if (cfg.bpmCore) {
    scores.push(trapezScore(t.bpm, cfg.bpmCore, cfg.bpm));
    scores.push(trapezScore(t.bpm, cfg.bpmCore, cfg.bpm));
  } else {
    scores.push(attrScore(t.bpm, {min: cfg.bpm[0], max: cfg.bpm[1]}));
  }
  scores.push(attrScore(t.energy, {min: cfg.energy?.[0], max: cfg.energy?.[1]}));
  if (cfg.valence)       scores.push(attrScore(t.valence,       {min: cfg.valence[0],       max: cfg.valence[1]}));
  if (cfg.dance)         scores.push(attrScore(t.dance,         {min: cfg.dance[0],         max: cfg.dance[1]}));
  if (cfg.instrumental)  scores.push(attrScore(t.instrumental,  cfg.instrumental));
  if (cfg.speech)        scores.push(attrScore(t.speech,        cfg.speech));
  if (cfg.acoustic)      scores.push(attrScore(t.acoustic,      cfg.acoustic));
  if (cfg.live)          scores.push(attrScore(t.live,          cfg.live));
  if (cfg.loud)          scores.push(attrScore(t.loud,          cfg.loud));
  if (t.live != null && t.live > 80) scores.push(30);
  // scores always has ≥1 element (BPM push above is unconditional), but guard for safety.
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;
}

export function isHalfDouble(bpm1, bpm2, tol = 3) {
  return Math.abs(bpm1 * 2 - bpm2) <= tol || Math.abs(bpm1 - bpm2 * 2) <= tol;
}

// calcSortScore — linear combination of calibrated-by-use components (all on 0–200 scale):
//   camPoints   [0,100,200]  Camelot compatibility is the primary sort criterion;
//                            green = same or adjacent key (200) outweighs phase score differences.
//   phasePoints [0–200]      calcPhaseScore (0–100) × 2, so phase fitness equals Camelot weight.
//   energyPoints [0–100]     direct energy value; secondary tie-breaker.
//   bridge      [0,50]       bonus for bridge-subgenre tracks; smaller than energy to avoid over-promotion.
//   penalties   (≤0)         soft deltas: Δenergy ×-2 outside ±15, Δloud ×-5 outside ±3,
//                            Δvalence ×-1 outside ±20, Δdance ×-1 outside ±15 (B/C only).
export function calcSortScore(t, cur, phase) {
  const cs = {green: 200, yellow: 100, red: 0, unknown: 0};
  const camPoints    = cs[camCompat(cur.camelot, t.camelot)] || 0;
  const phasePoints  = calcPhaseScore(t, phase) * 2;
  const energyPoints = t.energy;
  const bpmPenalty   = t.bpm < cur.bpm ? t.bpm - cur.bpm : 0;

  let bridge = 0;
  if (cur.genre && Array.isArray(t.genres_raw)) {
    const tags = bridgeTagsForMain(cur.genre);
    if (t.genres_raw.some(tag => tags.includes(tag))) bridge = 50;
  }

  const dEnergy  = (t.energy  != null && cur.energy  != null) ? Math.max(0, Math.abs(t.energy  - cur.energy)  - 15) * -2 : 0;
  const dLoud    = (t.loud    != null && cur.loud    != null) ? Math.max(0, Math.abs(t.loud    - cur.loud)    - 3)  * -5 : 0;
  const dValence = (t.valence != null && cur.valence != null) ? Math.max(0, Math.abs(t.valence - cur.valence) - 20) * -1 : 0;
  const dDance   = (phase === 'B' || phase === 'C') && t.dance != null && cur.dance != null
    ? Math.max(0, Math.abs(t.dance - cur.dance) - 15) * -1 : 0;

  return camPoints + phasePoints + energyPoints + bpmPenalty + bridge + dEnergy + dLoud + dValence + dDance;
}
