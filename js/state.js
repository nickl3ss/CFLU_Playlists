// state.js — single mutable app state; never import app.js or algorithm.js (would create cycles)
export const state = {
  currentPhase: 'C',
  selMode: 'filter',
  selectedTrack: null,
  poolGenre: '',
  position: 'start',
  maxJump: 5,
  bpmTol: 5,
  camLetter: 'both',   // 'A' | 'both' | 'B'
  camNumbers: [],      // [] = kein Filter, sonst Array mit Zahlen 1–12
  wodMinutes: 20,
  cdActive: false,
  cdMinutes: 15,
  wodEnergyMin: 70,
  wodEnergyMax: 100,
  lockCamFilter: false,
  generatedWod: [],
  generatedCd: [],
  crossfadeSec: 0,
  spToken: null,
  spUserId: null,
  spTokenExpiry: 0,
  hoveredTrackIdx: null,
  bpmChartData: [],
  chartCtx: null,
  previewCache: new Map(),
  currentAudio: null,
};
