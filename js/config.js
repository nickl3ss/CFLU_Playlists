// config.js — all application constants; no DOM, no state, no TRACK_DATA; never import other app modules

export const GERMAN_GENRES = ['Deutsche Musik'];
export const BPM_GROUPS = ['A','B','C','D','E','F','G','H','I'];
export const BPM_RANGES = {A:[0,90],B:[90,110],C:[110,120],D:[120,130],E:[130,140],F:[140,150],G:[150,160],H:[160,175],I:[175,999]};
export const CAM_ZONE1 = new Set(['8B','9B','10B','11B','12B','1B']);
export const CAM_ZONE2 = new Set(['8A','9A','10A','11A','12A','1A']);
// Keep in sync with SUFFIX_RE in CFLU_Pool_Build.py
export const SUFFIX_RE = /[\s\-–(]*(radio\s*edit|single\s*edit|album\s*version|original\s*mix|club\s*mix|extended\s*(mix|version)?|long\s*version|remaster(ed)?.*|feat\..*|ft\..*|live.*|acoustic.*|mono.*|stereo.*)[^)]*\)?/gi;
export const MIN_POOL_SIZE = 15;
export const GOING_WILD_GENRE = 'Going Wild';  // sentinel: all genres in pool
export const BPM_SLIDER_MIN = 60;
export const BPM_SLIDER_MAX = 220;
export const LASTFM_STALE_WARN_DAYS   = 30;  // show sync button (info badge)
export const LASTFM_STALE_DANGER_DAYS = 45;  // show sync button (warn badge)

export const PHASE_CONFIG = {
  A: {
    label: 'Whiteboard & Prep', color: '#5b8fd6',
    bpm: [85,110], bpmCore: [90,105], energy: [20,45], valence: [50,80], dance: [30,60],
    instrumental: {min:40}, speech: {max:20}, acoustic: {min:30}, loud: {max:-10},
    bpmDefault: 100, tolDefault: 5,
    progression: 'plateau', positionVisible: false,
  },
  B: {
    label: 'Skill & Strength', color: '#f7c948',
    bpm: [80,120], bpmCore: [90,110], energy: [40,65], valence: [35,65], dance: [35,65],
    instrumental: {min:25}, speech: {max:25}, acoustic: {min:5,max:40}, live: {max:40}, loud: {min:-10,max:-5},
    bpmDefault: 105, tolDefault: 5,
    progression: 'gentle', positionVisible: true,
  },
  C: {
    label: 'WOD — Intensiv', color: '#1db954',
    bpm: [125,195], bpmCore: [140,175], energy: [75,100], valence: [60,90], dance: [60,80],
    instrumental: {max:25}, acoustic: {max:10}, loud: {min:-8},
    bpmDefault: 145, tolDefault: 5,
    progression: 'ascending', positionVisible: true,
  },
  D: {
    label: 'Cool-Down', color: '#a855f7',
    bpm: [60,100], bpmCore: [65,85], energy: [15,40], valence: [40,70], dance: [0,45],
    instrumental: {min:50}, acoustic: {min:40}, loud: {max:-10},
    bpmDefault: 80, tolDefault: 5,
    progression: 'decreasing', positionVisible: false,
  },
};

// Slider color primitives
export const RED = {r:241,g:94,b:108};
export const YEL = {r:247,g:201,b:72};
export const GRN = {r:29,g:185,b:84};

export const BPM_STOPS = [
  {p:0,...RED},{p:.19,...RED},{p:.31,...YEL},{p:.38,...GRN},
  {p:.69,...GRN},{p:.78,...YEL},{p:.88,...YEL},{p:1,...RED},
];

// Returns gradient stops for a smooth RED→YEL→GRN→YEL→RED bell curve matching a phase's BPM zones.
// Single stop per boundary → CSS interpolates linearly between them (no hard cuts).
// Slider range is always 60–220 BPM.
export function bpmStopsForPhase(phase) {
  const cfg = PHASE_CONFIG[phase];
  if (!cfg) return BPM_STOPS;
  const range = BPM_SLIDER_MAX - BPM_SLIDER_MIN;
  const p = v => (v - BPM_SLIDER_MIN) / range;
  const [bLo, bHi] = cfg.bpm;
  const [cLo, cHi] = cfg.bpmCore;
  const stops = [];
  if (bLo > BPM_SLIDER_MIN) { stops.push({p: 0, ...RED}); }
  stops.push({p: p(bLo), ...YEL});   // RED fades into YEL at acceptable-zone start
  stops.push({p: p(cLo), ...GRN});   // YEL fades into GRN at ideal-zone start
  stops.push({p: p(cHi), ...GRN});   // solid GRN through ideal zone
  stops.push({p: p(bHi), ...YEL});   // GRN fades into YEL at ideal-zone end
  if (bHi < BPM_SLIDER_MAX) { stops.push({p: 1, ...RED}); }  // YEL fades into RED at acceptable-zone end
  return stops;
}
// log2-based BPM transition scoring: Ratio-Lattice model.
// breakpoints: [d_threshold, proximity] — linearly interpolated; d > last → 0.00.
// RATIO_LATTICE: integer ratios with lock weights. SCORE = proximity × lock_weight.
export const BPM_TRANSITION_CONFIG = {
  breakpoints: [
    [0.030, 1.00],   // ±2 % — unhörbar
    [0.070, 0.85],   // ±5 % — Standard-Toleranz (DJ-Norm)
    [0.135, 0.40],   // ±10 % — hörbar; nur bei starkem Genre/Camelot-Match akzeptieren
  ],
  RATIO_LATTICE: [
    { p: 1, q: 1, w: 1.00 },
    { p: 2, q: 1, w: 1.00 }, { p: 1, q: 2, w: 1.00 },
    { p: 3, q: 2, w: 0.90 }, { p: 2, q: 3, w: 0.90 },
    { p: 4, q: 3, w: 0.78 }, { p: 3, q: 4, w: 0.78 },
  ],
};

export const TRANSITION_BUDGET = 500;
export const SCORE_WEIGHTS_DEFAULT = { bpm: 40, camelot: 20, energy: 15, loudness: 10, valence: 8, dance: 7, popularity: 5 };
// BPM and Camelot weights are fixed/internal (not user-adjustable via the UI spider web).
// Pool filter: hard minimum/maximum thresholds applied before scoring (0 = inactive).
export const POOL_FILTER_DEFAULT = { minBpm: 0, maxBpm: 220, minEnergy: 0, minValence: 0, minDance: 0, minPopularity: 0 };

// Hard BPM gate: Ratio-Lattice score must meet this threshold for a candidate to be eligible.
// 0.60 rejects loose 4:3 / 3:2 approximations (e.g. 140→174 scores 0.495) while passing
// clean 1:1 (±7.5 %), 2:1/1:2 (±10 %) and near-exact ratio matches — safe for Spotify crossfade.
export const BPM_GATE_MIN_SCORE = 0.60;

// Ascending phases (B/C) allow up to this many effective-BPM backward steps per pick.
// Prevents "no step allowed at all" freezes near phase boundaries while overall playlist
// BPM is kept in-band by getPhasePool's BPM-band filter.
export const MONO_STEP_BACK_BPM = 10;

export const CAM_COLOR = {green:'#1db954',yellow:'#f7c948',red:'#f15e6c',unknown:'#535353'};

// Non-linear duration steps (5–360 min). Slider index = array index; .length - 1 = max slider value.
function buildDurSteps() {
  const s = [];
  for (let i = 5;   i <= 30;  i += 1)  s.push(i);  // 5..30   step 1  (26 values, idx 0–25)
  for (let i = 35;  i <= 90;  i += 5)  s.push(i);  // 35..90  step 5  (12 values, idx 26–37)
  for (let i = 100; i <= 180; i += 10) s.push(i);  // 100..180 step 10 (9 values, idx 38–46)
  for (let i = 210; i <= 360; i += 30) s.push(i);  // 210..360 step 30 (6 values, idx 47–52)
  return s;
}
export const DUR_STEPS = buildDurSteps(); // 53 values, max index = 52

export const POS_BPM = {
  start:   {green:[110,145], yellow:[[90,109],[146,160]]},
  end:     {green:[155,190], yellow:[[145,154],[191,205]]},
  mid:     {green:[130,165], yellow:[[115,129],[166,180]]},
  plateau: {green:[130,165], yellow:[[115,129],[166,180]]},
};
