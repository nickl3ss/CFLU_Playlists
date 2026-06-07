// All application constants — no DOM, no state, no TRACK_DATA dependency

export const GERMAN_GENRES = ['Moderne Deutsche Musik', 'Deutschrock / NDW / Schlager'];
export const BPM_GROUPS = ['A','B','C','D','E','F','G','H','I'];
export const BPM_RANGES = {A:[0,90],B:[90,110],C:[110,120],D:[120,130],E:[130,140],F:[140,150],G:[150,160],H:[160,175],I:[175,999]};
export const CAM_ZONE1 = new Set(['8B','9B','10B','11B','12B','1B']);
export const CAM_ZONE2 = new Set(['8A','9A','10A','11A','12A','1A']);
export const SUFFIX_RE = /[\s\-–(]*(radio\s*edit|single\s*edit|album\s*version|original\s*mix|club\s*mix|extended\s*(mix|version)?|long\s*version|remaster(ed)?.*|feat\..*|ft\..*|live.*|acoustic.*|mono.*|stereo.*)[^)]*\)?/gi;
export const MIN_POOL_SIZE = 15;

export const PHASE_CONFIG = {
  A: {
    label: 'Whiteboard & Prep', color: '#5b8fd6',
    bpm: [85,110], bpmCore: [90,105], energy: [20,45], valence: [50,80], dance: [30,60],
    instrumental: {min:40}, speech: {max:20}, acoustic: {min:30}, loud: {max:-10},
    bpmDefault: 100, tolDefault: 5, maxJumpDefault: 5,
    progression: 'plateau', positionVisible: false,
  },
  B: {
    label: 'Skill & Strength', color: '#f7c948',
    bpm: [80,120], bpmCore: [90,110], energy: [40,65], valence: [35,65], dance: [35,65],
    instrumental: {min:25}, speech: {max:25}, acoustic: {min:5,max:40}, live: {max:40}, loud: {min:-10,max:-5},
    bpmDefault: 105, tolDefault: 5, maxJumpDefault: 7,
    progression: 'gentle', positionVisible: true,
  },
  C: {
    label: 'WOD — Intensiv', color: '#1db954',
    bpm: [125,195], bpmCore: [140,175], energy: [75,100], valence: [60,90], dance: [60,80],
    instrumental: {max:25}, acoustic: {max:10}, loud: {min:-8},
    bpmDefault: 145, tolDefault: 5, maxJumpDefault: 10,
    progression: 'ascending', positionVisible: true,
  },
  D: {
    label: 'Cool-Down', color: '#a855f7',
    bpm: [60,100], bpmCore: [65,85], energy: [15,40], valence: [40,70], dance: [0,45],
    instrumental: {min:50}, acoustic: {min:40}, loud: {max:-10},
    bpmDefault: 80, tolDefault: 5, maxJumpDefault: 8,
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
// Green = 5-8 BPM (DJ-Norm ≤5%), Yellow = 8-12 BPM, Red = >12 BPM (range 5-20)
export const JUMP_STOPS = [
  {p:0,...GRN},{p:.2,...GRN},{p:.27,...YEL},{p:.47,...YEL},{p:.53,...RED},{p:1,...RED},
];

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
