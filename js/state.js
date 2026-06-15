// state.js — single mutable app state; never import app.js or algorithm.js (would create cycles)
export const state = {
  currentPhase: 'C',
  selMode: 'filter',
  selectedTrack: null,
  poolGenre: '',
  position: 'start',
  maxJump: 5,      // deprecated — stillgelegt; wird vom Algorithmus nicht mehr gelesen
  allowLog2: false, // log2-Score: Half/Double-Time ×2/÷2 als kompatibel werten
  explicitFilter: 'allow', // 'allow' | 'exclude' | 'only'
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
  uiMode: 'advanced',                            // 'quick' | 'optimizer' | 'advanced' — volatile per session, not persisted
  generationContext: { genre: '', phase: 'C' }, // snapshot of genre + phase at generation time; used by onReplaceTrack
  swapBlacklist: new Set(), // IDs of tracks swapped out since last generation; merged into excludeIds
  crossfadeSec: 20,
  // Spotify auth + device state (managed by spotify.js / app.js)
  spConnected: false,
  spDisplayName: null,
  spDevices: [],            // array of Spotify Connect device objects from /me/player/devices
  spSelectedDeviceId: null, // currently selected device id for playback
  hoveredTrackIdx: null,
  bpmChartData: [],
  chartCtx: null,
  previewCache: new Map(),
  currentAudio: null,
};
