// Central genre configuration — single source of truth for all genre logic
// No imports, no side effects. Pure data + pure helper functions.

export const GENRE_CONFIG = {

  mainGenres: [
    { id: 'EDM / Electronic',          role: 'peak',     tempoBand: [120,165],
      neighbours: [
        { mainId: 'Pop & New Wave',           weight: 1.0 },
        { mainId: 'Synthwave / Electronica',  weight: 1.0 },
        { mainId: 'Funk & Disco',             weight: 1.0 },
        { mainId: 'Moderne Deutsche Musik',   weight: 0.7 },
      ]},
    { id: 'Rock',                      role: 'peak',     tempoBand: [90,140],
      neighbours: [
        { mainId: 'Metal & Hard Rock',        weight: 1.0 },
        { mainId: 'Pop & New Wave',           weight: 0.7 },
        { mainId: 'Synthwave / Electronica',  weight: 0.7 },
        { mainId: 'Punk',                     weight: 0.7 },
        { mainId: 'Blues & Soul',             weight: 0.5 },
      ]},
    { id: 'Pop & New Wave',            role: 'peak',     tempoBand: [110,128],
      neighbours: [
        { mainId: 'EDM / Electronic',         weight: 1.0 },
        { mainId: 'Rock',                     weight: 0.7 },
        { mainId: 'Synthwave / Electronica',  weight: 0.7 },
        { mainId: 'Moderne Deutsche Musik',   weight: 0.7 },
        { mainId: 'Funk & Disco',             weight: 0.5 },
      ]},
    { id: 'Metal & Hard Rock',         role: 'peak',     tempoBand: [110,220],
      neighbours: [
        { mainId: 'Rock',                     weight: 1.0 },
        { mainId: 'Punk',                     weight: 1.0 },
        { mainId: 'Hip Hop & R&B',            weight: 0.7 },
        { mainId: 'EDM / Electronic',         weight: 0.5 },
      ]},
    { id: 'Ska & Reggae',              role: 'peak',     tempoBand: [120,200],
      neighbours: [
        { mainId: 'Punk',                     weight: 1.0 },
        { mainId: 'Funk & Disco',             weight: 0.7 },
        { mainId: 'Rock',                     weight: 0.5 },
        { mainId: 'Hip Hop & R&B',            weight: 0.5 },
      ]},
    { id: 'Synthwave / Electronica',   role: 'warmup',   tempoBand: [80,140],
      neighbours: [
        { mainId: 'EDM / Electronic',         weight: 1.0 },
        { mainId: 'Pop & New Wave',           weight: 0.7 },
        { mainId: 'Rock',                     weight: 0.7 },
        { mainId: 'Moderne Deutsche Musik',   weight: 0.5 },
      ]},
    { id: 'Moderne Deutsche Musik',    role: 'peak',     tempoBand: [120,128],
      neighbours: [
        { mainId: 'Deutschrock / NDW / Schlager', weight: 1.0 },
        { mainId: 'Pop & New Wave',               weight: 0.7 },
        { mainId: 'EDM / Electronic',             weight: 0.7 },
        { mainId: 'Hip Hop & R&B',                weight: 0.5 },
      ]},
    { id: 'Hip Hop & R&B',             role: 'peak',     tempoBand: [85,100],
      neighbours: [
        { mainId: 'Funk & Disco',             weight: 1.0 },
        { mainId: 'Moderne Deutsche Musik',   weight: 0.7 },
        { mainId: 'Metal & Hard Rock',        weight: 0.7 },
        { mainId: 'EDM / Electronic',         weight: 0.5 },
      ]},
    { id: 'Punk',                      role: 'peak',     tempoBand: [140,200],
      neighbours: [
        { mainId: 'Ska & Reggae',             weight: 1.0 },
        { mainId: 'Metal & Hard Rock',        weight: 1.0 },
        { mainId: 'Rock',                     weight: 0.7 },
        { mainId: 'Pop & New Wave',           weight: 0.5 },
      ]},
    { id: 'Funk & Disco',              role: 'peak',     tempoBand: [100,130],
      neighbours: [
        { mainId: 'EDM / Electronic',         weight: 1.0 },
        { mainId: 'Hip Hop & R&B',            weight: 0.7 },
        { mainId: 'Pop & New Wave',           weight: 0.5 },
        { mainId: 'Blues & Soul',             weight: 0.5 },
        { mainId: 'Synthwave / Electronica',  weight: 0.5 },
      ]},
    { id: 'Deutschrock / NDW / Schlager', role: 'peak',  tempoBand: [120,128],
      neighbours: [
        { mainId: 'Moderne Deutsche Musik',   weight: 1.0 },
        { mainId: 'Rock',                     weight: 0.7 },
        { mainId: 'Pop & New Wave',           weight: 0.5 },
        { mainId: 'Punk',                     weight: 0.5 },
      ]},
    { id: 'Blues & Soul',              role: 'cooldown', tempoBand: [60,90],
      neighbours: [
        { mainId: 'Rock',                     weight: 1.0 },
        { mainId: 'Funk & Disco',             weight: 0.7 },
        { mainId: 'Hip Hop & R&B',            weight: 0.5 },
      ]},
  ],

  bridgeSubgenres: {
    'dance pop':           ['EDM / Electronic', 'Pop & New Wave', 'Moderne Deutsche Musik'],
    'synthpop':            ['Synthwave / Electronica', 'Rock', 'Pop & New Wave'],
    'ska punk':            ['Punk', 'Ska & Reggae'],
    'skate punk':          ['Punk', 'Ska & Reggae'],
    'rap metal':           ['Metal & Hard Rock', 'Hip Hop & R&B'],
    'nu metal':            ['Metal & Hard Rock', 'Hip Hop & R&B'],
    'eurodance':           ['EDM / Electronic', 'Pop & New Wave', 'Moderne Deutsche Musik'],
    'europop':             ['EDM / Electronic', 'Pop & New Wave', 'Moderne Deutsche Musik'],
    'new wave':            ['Rock', 'Punk', 'Pop & New Wave', 'Deutschrock / NDW / Schlager'],
    'neue deutsche welle': ['Moderne Deutsche Musik', 'Deutschrock / NDW / Schlager'],
    'schlager':            ['Moderne Deutsche Musik', 'Deutschrock / NDW / Schlager'],
    'deutscher pop':       ['Moderne Deutsche Musik', 'Deutschrock / NDW / Schlager'],
    'disco house':         ['EDM / Electronic', 'Funk & Disco', 'Synthwave / Electronica'],
    'italo disco':         ['EDM / Electronic', 'Funk & Disco', 'Synthwave / Electronica'],
    'hip house':           ['EDM / Electronic', 'Hip Hop & R&B'],
    'glam metal':          ['Metal & Hard Rock', 'Rock'],
    'hard rock':           ['Metal & Hard Rock', 'Rock'],
    'bluesrock':           ['Blues & Soul', 'Rock'],
    'klassischer rock':    ['Blues & Soul', 'Rock'],
    'southern rock':       ['Blues & Soul', 'Rock'],
  },

  bridges: {
    A: ['Funk & Disco','EDM / Electronic','Synthwave / Electronica','Pop & New Wave','Moderne Deutsche Musik'],
    B: ['Ska & Reggae','Punk'],
    C: ['Punk','Metal & Hard Rock','Rock','Hip Hop & R&B'],
    D: ['Moderne Deutsche Musik','Deutschrock / NDW / Schlager'],
  },

  pickerStrategy: {
    subgenreFirst: true,
    neighbourEarly: true,
    escalation: ['subgenre','mainGenre','bridgePivot','neighbourMain'],
  },
};

export function getNeighboursWeighted(mainId) {
  const m = GENRE_CONFIG.mainGenres.find(g => g.id === mainId);
  return m ? [...m.neighbours].sort((a,b) => b.weight - a.weight) : [];
}

export function getNeighbours(mainId) {
  return getNeighboursWeighted(mainId).map(n => n.mainId);
}

export function bridgeTags(mainId, neighbourId) {
  return Object.entries(GENRE_CONFIG.bridgeSubgenres)
    .filter(([, mains]) => mains.includes(mainId) && mains.includes(neighbourId))
    .map(([tag]) => tag);
}

export function bridgeTagsForMain(mainId) {
  return Object.entries(GENRE_CONFIG.bridgeSubgenres)
    .filter(([, mains]) => mains.includes(mainId))
    .map(([tag]) => tag);
}

export function getSubgenres(t) {
  return Array.isArray(t.genres_raw) ? t.genres_raw : [];
}

export function getGenreRole(mainId) {
  const m = GENRE_CONFIG.mainGenres.find(g => g.id === mainId);
  return m ? m.role : 'peak';
}

export function getRoleBonus(mainId, phase) {
  const m = GENRE_CONFIG.mainGenres.find(g => g.id === mainId);
  if (!m) return 0;
  if (phase === 'A' && m.role === 'warmup')   return  0.3;
  if (phase === 'D' && m.role === 'cooldown') return  0.3;
  if ((phase === 'A' || phase === 'D') && m.role === 'peak') return -0.2;
  return 0;
}
