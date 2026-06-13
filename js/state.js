// state.js — single mutable app state; never import app.js or algorithm.js (would create cycles)
export const state = {
  currentPhase: 'C',
  selMode: 'filter',
  selectedTrack: null,
  poolGenre: '',
  position: 'start',
  maxJump: 5,      // deprecated — stillgelegt; wird vom Algorithmus nicht mehr gelesen
  allowLog2: true, // log2-Score: Half/Double-Time ×2/÷2 als kompatibel werten
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
  crossfadeSec: 20,
  spToken: null,
  spUserId: null,
  spTokenExpiry: 0,
  spPlayer: null,
  spDeviceId: null,
  spPlayingIdx: -1,
  hoveredTrackIdx: null,
  bpmChartData: [],
  chartCtx: null,
  previewCache: new Map(),
  currentAudio: null,
};
