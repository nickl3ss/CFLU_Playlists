// Single mutable application state object.
// Exported by reference — all modules share the same object.
export const state = {
  currentPhase: 'C',
  selMode: 'filter',
  selectedTrack: null,
  position: 'start',
  maxJump: 10,
  bpmTol: 5,
  camLetter: 'both',   // 'A' | 'both' | 'B'
  camNumbers: [],      // [] = kein Filter, sonst Array mit Zahlen 1–12
  wodMinutes: 20,
  cdActive: false,
  cdMinutes: 15,
  wodEnergyMin: 70,
  wodEnergyMax: 100,
  generatedWod: [],
  generatedCd: [],
  spToken: null,
  spUserId: null,
  hoveredTrackIdx: null,
  bpmChartData: [],
  chartCtx: null,
  previewCache: new Map(),
  currentAudio: null,
};
