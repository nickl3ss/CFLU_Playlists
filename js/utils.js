// Pure helper functions — no DOM, no state, no TRACK_DATA dependency
import { BPM_GROUPS, BPM_RANGES, SUFFIX_RE, PHASE_CONFIG } from './config.js';

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
  } catch (e) { return 'unknown'; }
}
export function camStrictOk(c1, c2) { return camCompat(c1, c2) === 'green'; }

export function titleKey(s) {
  return s.replace(SUFFIX_RE, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
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

export function calcPhaseCBonus(t) {
  let bonus = 0;
  if (t.energy >= 82) bonus += 20;
  if (t.valence >= 60 && t.valence <= 90) bonus += 15;
  if (t.dance >= 60 && t.dance <= 80) bonus += 10;
  if (t.loud >= -8) bonus += 10;
  return Math.min(100, bonus);
}

export function calcPhaseScore(t, phase) {
  if (!phase || phase === 'C') return calcPhaseCBonus(t);
  const cfg = PHASE_CONFIG[phase];
  if (!cfg) return 50;
  const scores = [];
  scores.push(attrScore(t.bpm, {min: cfg.bpm[0], max: cfg.bpm[1]}));
  scores.push(attrScore(t.energy, {min: cfg.energy?.[0], max: cfg.energy?.[1]}));
  if (cfg.valence)       scores.push(attrScore(t.valence,       {min: cfg.valence[0],       max: cfg.valence[1]}));
  if (cfg.dance)         scores.push(attrScore(t.dance,         {min: cfg.dance[0],         max: cfg.dance[1]}));
  if (cfg.instrumental)  scores.push(attrScore(t.instrumental,  cfg.instrumental));
  if (cfg.speech)        scores.push(attrScore(t.speech,        cfg.speech));
  if (cfg.acoustic)      scores.push(attrScore(t.acoustic,      cfg.acoustic));
  if (cfg.live)          scores.push(attrScore(t.live,          cfg.live));
  if (cfg.loud)          scores.push(attrScore(t.loud,          cfg.loud));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function calcSortScore(t, cur, phase) {
  const cs = {green: 200, yellow: 100, red: 0, unknown: 0};
  const camPoints   = cs[camCompat(cur.camelot, t.camelot)] || 0;
  const phasePoints = calcPhaseScore(t, phase) * 2;
  const energyPoints = t.energy;
  const bpmPenalty  = t.bpm < cur.bpm ? t.bpm - cur.bpm : 0;
  return camPoints + phasePoints + energyPoints + bpmPenalty;
}
