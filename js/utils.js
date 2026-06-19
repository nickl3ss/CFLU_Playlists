// utils.js — pure helper functions; no DOM, no state writes, no TRACK_DATA; safe to import in Node.js tests
import { BPM_GROUPS, BPM_RANGES, SUFFIX_RE, PHASE_CONFIG, BPM_TRANSITION_CONFIG } from './config.js';
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
    // BPM pushed twice: intentional double weight so BPM dominates the phase score
    // (every phase has bpmCore, so this always applies)
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

// log2-based BPM transition score [0.00–1.00].
// allowLog2: also considers ×2/÷2 ratio (same beatgrid → first-class compatibility).
// Missing or zero BPM → neutral 0.5 (incomplete data, not a hard reject).
export function calcBpmTransitionScore(bpmPrev, bpmNext, allowLog2) {
  if (!bpmPrev || !bpmNext || bpmPrev <= 0 || bpmNext <= 0) return 0.5;
  const ratio = bpmNext / bpmPrev;
  let d = Math.abs(Math.log2(ratio));
  if (allowLog2) {
    d = Math.min(d, Math.abs(Math.log2(ratio / 2)), Math.abs(Math.log2(ratio * 2)));
  }
  const bp = BPM_TRANSITION_CONFIG.breakpoints;
  if (d <= bp[0][0]) return bp[0][1];
  if (d > bp[bp.length - 1][0]) return 0.00;
  for (let i = 0; i < bp.length - 1; i++) {
    if (d <= bp[i + 1][0]) {
      const f = (d - bp[i][0]) / (bp[i + 1][0] - bp[i][0]);
      return bp[i][1] + f * (bp[i + 1][1] - bp[i][1]);
    }
  }
  return 0.00;
}

// Returns BPM normalized to the phase's target band via ×2 or ÷2 if that brings it into range.
// Used for monotonicity checks — prevents 156→78 appearing as a BPM drop when 78×2=156.
export function effectiveBpm(bpm, phase) {
  const cfg = PHASE_CONFIG[phase];
  if (!cfg || !bpm) return bpm;
  const [lo, hi] = cfg.bpm;
  if (bpm >= lo && bpm <= hi) return bpm;
  if (bpm * 2 >= lo && bpm * 2 <= hi) return bpm * 2;
  if (bpm / 2 >= lo && bpm / 2 <= hi) return bpm / 2;
  return bpm;
}

export function calcEraScore(t, cur) {
  const parseYear = d => { if (!d) return null; const y = parseInt(d); return isNaN(y) ? null : y; };
  const y1 = parseYear(t.album_date), y2 = parseYear(cur.album_date);
  if (y1 === null || y2 === null) return 0;
  const diff = Math.abs(y1 - y2);
  if (diff <= 5) return 30;
  if (diff >= 15) return 0;
  return Math.round(30 * (1 - (diff - 5) / 10));
}

// calcSortScore — linear combination of calibrated-by-use components:
//   camPoints      [0,100,200]  Camelot compatibility; green outweighs all other differences.
//   phasePoints    [0–200]      calcPhaseScore (0–100) × 2, equal weight to Camelot.
//   energyPoints   [0–100]      direct energy value; secondary tie-breaker.
//   bridge         [0,50]       bonus for bridge-subgenre tracks.
//   dEnergy        (≤0)         penalty: Δenergy ×-2 outside ±15.
//   loudScore      [0,7]        reward: 7 at same loudness, 0 at diff ≥7 dB.
//   valenceScore   [0,6]        reward: 6 at same valence, 0 at diff ≥30.
//   danceScore     [0,5]        reward: 5 at same danceability (B/C only), 0 at diff ≥25.
//   moodScore      [0,8]        reward: proportional tag overlap from mood_tags field.
//   colorScore     [0,10]       reward: similar Everynoise avg_color (sonic texture proximity).
//   genreDistScore [0,25]       reward: cosine similarity of Last.fm genre_conf vectors;
//                               falls back to xyScore [0,10] when genre_conf absent on either track.
//   eraScore       [0,30]       reward: ≤5yr gap = 30, linear decay to 0 at ≥15yr gap.
function _cosineSim(a, b) {
  // Cosine similarity between two genre_conf objects {mainId: float}.
  // Returns 0 if either is falsy/empty.
  if (!a || !b) return 0;
  let dot = 0, na = 0, nb = 0;
  for (const [id, va] of Object.entries(a)) {
    na += va * va;
    if (b[id] !== undefined) dot += va * b[id];
  }
  for (const vb of Object.values(b)) nb += vb * vb;
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function _colorDist(h1, h2) {
  if (!h1 || !h2 || h1.length < 7 || h2.length < 7) return 0;
  const p = h => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
  const [r1,g1,b1] = p(h1), [r2,g2,b2] = p(h2);
  return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
}

// allowLog2: passed from state.allowLog2; used for bpmTransScore calculation.
export function calcSortScore(t, cur, phase, allowLog2 = false) {
  const cs = {green: 200, yellow: 100, red: 0, unknown: 0};
  const camPoints    = cs[camCompat(cur.camelot, t.camelot)] || 0;
  const phasePoints  = calcPhaseScore(t, phase) * 2;
  const energyPoints = t.energy;
  const bpmTransScore = Math.round(calcBpmTransitionScore(cur.bpm, t.bpm, allowLog2) * 250);

  let bridge = 0;
  if (cur.genre && Array.isArray(t.genres_raw)) {
    const tags = bridgeTagsForMain(cur.genre);
    if (t.genres_raw.some(tag => tags.includes(tag))) bridge = 50;
  }

  const dEnergy    = (t.energy  != null && cur.energy  != null) ? Math.max(0, Math.abs(t.energy  - cur.energy)  - 15) * -2 : 0;
  const loudScore  = (t.loud    != null && cur.loud    != null) ? Math.max(0, 7 - Math.abs(t.loud    - cur.loud))                                    : 0;
  const valScore   = (t.valence != null && cur.valence != null) ? Math.max(0, Math.round(6 * (30 - Math.abs(t.valence - cur.valence)) / 30))         : 0;
  const danceScore = (phase === 'B' || phase === 'C') && t.dance != null && cur.dance != null
    ? Math.max(0, Math.round(5 * (25 - Math.abs(t.dance - cur.dance)) / 25)) : 0;
  const moodScore  = Array.isArray(t.mood_tags) && Array.isArray(cur.mood_tags) && cur.mood_tags.length && t.mood_tags.length
    ? Math.round(8 * t.mood_tags.filter(tag => cur.mood_tags.includes(tag)).length / Math.min(t.mood_tags.length, cur.mood_tags.length)) : 0;
  const colorScore = (t.avg_color && cur.avg_color)
    ? Math.max(0, Math.round(10 * (1 - _colorDist(t.avg_color, cur.avg_color) / 1.732))) : 0;
  // genreDistScore: cosine similarity of Last.fm genre_conf vectors (max 25).
  // Falls back to Everynoise avg_xy distance (max 10) when genre_conf absent.
  const genreDistScore = (t.genre_conf && cur.genre_conf && Object.keys(t.genre_conf).length && Object.keys(cur.genre_conf).length)
    ? Math.max(0, Math.round(25 * _cosineSim(t.genre_conf, cur.genre_conf)))
    : (t.avg_xy && cur.avg_xy)
      ? Math.max(0, 10 * (1 - Math.sqrt((t.avg_xy[0] - cur.avg_xy[0]) ** 2 + (t.avg_xy[1] - cur.avg_xy[1]) ** 2) / Math.SQRT2))
      : 0;
  const eraScore   = calcEraScore(t, cur);

  return camPoints + phasePoints + energyPoints + bpmTransScore + bridge + dEnergy + loudScore + valScore + danceScore + moodScore + colorScore + genreDistScore + eraScore;
}

const _BPM_HINTS = {
  A: ['Zu langsam für Prep', 'Untere Grenze', 'Idealbereich Prep ✓', 'Obere Grenze', 'Zu schnell für Prep'],
  B: ['Zu langsam für Skill', 'Ruhiger Einstieg', 'Idealbereich Skill ✓', 'Obere Grenze', 'Zu schnell für Skill'],
  C: ['Zu langsam für WOD', 'Aufbau-Bereich', 'WOD-Idealbereich ✓', 'Finisher-Bereich', 'Grenzbereich'],
  D: ['Zu langsam', 'Sehr ruhig', 'Idealbereich Cool-Down ✓', 'Noch akzeptabel', 'Zu schnell für Cool-Down'],
};
// Returns a zone-specific hint label for the BPM slider based on the active phase's acceptable/ideal ranges.
export function bpmHint(v, phase) {
  const cfg = PHASE_CONFIG[phase];
  if (!cfg) return '';
  const [bLo, bHi] = cfg.bpm;
  const [cLo, cHi] = cfg.bpmCore;
  const [h0, h1, h2, h3, h4] = _BPM_HINTS[phase];
  if (v < bLo)  return h0;
  if (v < cLo)  return h1;
  if (v <= cHi) return h2;
  if (v <= bHi) return h3;
  return h4;
}
