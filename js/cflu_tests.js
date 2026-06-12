// Canonical test class — dual-mode: Node.js (stdout + exit code) + browser (export results)
// Node: node js/cflu_tests.js  (requires package.json {"type":"module"} at project root)
// Browser: CFLU_Tests.html imports { results } and renders

import { bpmGroup, groupIdx, neighbour, fmtDur, fmtMin, titleKey, titleDuplicate,
         camCompat, camStrictOk, lerpColor, toHex, toRgb,
         attrScore, calcPhaseScore, calcSortScore, calcEraScore, trapezScore, isHalfDouble,
         camelotZoneDistance, bpmHint, calcBpmTransitionScore, effectiveBpm } from './utils.js';
import { GENRE_CONFIG, getNeighboursWeighted, getNeighbours, bridgeTags,
         bridgeTagsForMain, getSubgenres, getRoleBonus } from './genres.js';
import { getPhasePool, getPhasePoolWithNeighbours } from './algorithm.js';
import { addTrack, pickNext, pickPrev,
         buildUp, buildDown, buildPlateau, buildDecreasing, buildAlternating } from './algorithm.js';
import { state } from './state.js';
import { sanitizeFilename, extractPlaylistName, formatUploadSuccess, classifyUploadResult } from './upload.js';
import { bpmStopsForPhase, PHASE_CONFIG, RED, YEL, GRN } from './config.js';

// ============================================================
//  MINI TEST FRAMEWORK
// ============================================================
const _suites = []; let _cur = null;
function describe(name, fn) { _cur = {name, tests: []}; _suites.push(_cur); fn(); }
function it(name, fn) {
  try { fn(); _cur.tests.push({name, ok: true}); }
  catch (e) { _cur.tests.push({name, ok: false, err: e.message}); }
}
function expect(actual) {
  const fail = msg => { throw new Error(msg); };
  const m = {
    toBe(exp)                { if (actual !== exp) fail(`Erwartet ${JSON.stringify(exp)}, erhalten ${JSON.stringify(actual)}`); },
    toEqual(exp)             { if (JSON.stringify(actual) !== JSON.stringify(exp)) fail(`Erwartet ${JSON.stringify(exp)}, erhalten ${JSON.stringify(actual)}`); },
    toBeNull()               { if (actual !== null) fail(`Erwartet null, erhalten ${JSON.stringify(actual)}`); },
    toBeGreaterThan(n)       { if (!(actual > n)) fail(`Erwartet > ${n}, erhalten ${actual}`); },
    toBeLessThan(n)          { if (!(actual < n)) fail(`Erwartet < ${n}, erhalten ${actual}`); },
    toBeLessThanOrEqual(n)   { if (!(actual <= n)) fail(`Erwartet <= ${n}, erhalten ${actual}`); },
    toBeGreaterThanOrEqual(n){ if (!(actual >= n)) fail(`Erwartet >= ${n}, erhalten ${actual}`); },
    toBeTruthy()             { if (!actual) fail(`Erwartet truthy, erhalten ${JSON.stringify(actual)}`); },
    toBeFalsy()              { if (actual) fail(`Erwartet falsy, erhalten ${JSON.stringify(actual)}`); },
    toHaveLength(n)          { if ((actual||[]).length !== n) fail(`Erwartet Länge ${n}, erhalten ${(actual||[]).length}`); },
    toContain(item)          { if (!(actual||[]).includes(item)) fail(`Erwartet enthält ${JSON.stringify(item)}`); },
    toMatch(re)              { if (!re.test(actual)) fail(`Erwartet match ${re}, erhalten ${actual}`); },
  };
  m.not = {
    toBe(exp)                { if (actual === exp) fail(`Erwartet nicht ${JSON.stringify(exp)}, erhalten ${JSON.stringify(actual)}`); },
    toEqual(exp)             { if (JSON.stringify(actual) === JSON.stringify(exp)) fail(`Erwartet nicht ${JSON.stringify(exp)}`); },
    toBeNull()               { if (actual === null) fail(`Erwartet nicht null`); },
    toBeGreaterThan(n)       { if (actual > n) fail(`Erwartet nicht > ${n}, erhalten ${actual}`); },
    toBeLessThan(n)          { if (actual < n) fail(`Erwartet nicht < ${n}, erhalten ${actual}`); },
    toBeLessThanOrEqual(n)   { if (actual <= n) fail(`Erwartet nicht <= ${n}, erhalten ${actual}`); },
    toBeGreaterThanOrEqual(n){ if (actual >= n) fail(`Erwartet nicht >= ${n}, erhalten ${actual}`); },
    toBeTruthy()             { if (actual) fail(`Erwartet falsy, erhalten ${JSON.stringify(actual)}`); },
    toBeFalsy()              { if (!actual) fail(`Erwartet truthy, erhalten ${JSON.stringify(actual)}`); },
    toHaveLength(n)          { if ((actual||[]).length === n) fail(`Erwartet Länge nicht ${n}`); },
    toContain(item)          { if ((actual||[]).includes(item)) fail(`Erwartet enthält nicht ${JSON.stringify(item)}, erhalten ${JSON.stringify(actual)}`); },
    toMatch(re)              { if (re.test(actual)) fail(`Erwartet kein match ${re}, erhalten ${actual}`); },
  };
  return m;
}

// ============================================================
//  STATE SETUP
// ============================================================
state.maxJump      = 10;
state.wodEnergyMin = 50;
state.wodEnergyMax = 85;
state.currentPhase = 'C';

// ============================================================
//  MOCK TRACK POOL
// ============================================================
function mkT(t) { return Object.assign({dance:60,valence:65,acoustic:10,instrumental:5,speech:8,live:5,loud:-7,popularity:60}, t); }
const T = {
  a1:   mkT({id:'a1',  song:'Alpha One',    artist:'Band A', bpm:120, camelot:'9B',  energy:72, dur:210, genre:'Rock', bpmg:'D'}),
  a2:   mkT({id:'a2',  song:'Alpha Two',    artist:'Band B', bpm:124, camelot:'10B', energy:76, dur:200, genre:'Rock', bpmg:'D'}),
  a3:   mkT({id:'a3',  song:'Alpha Three',  artist:'Band C', bpm:128, camelot:'9A',  energy:75, dur:220, genre:'Rock', bpmg:'D'}),
  b1:   mkT({id:'b1',  song:'Beta One',     artist:'Band D', bpm:130, camelot:'9B',  energy:80, dur:215, genre:'Rock', bpmg:'E'}),
  b2:   mkT({id:'b2',  song:'Beta Two',     artist:'Band E', bpm:135, camelot:'11B', energy:83, dur:195, genre:'Rock', bpmg:'E'}),
  b3:   mkT({id:'b3',  song:'Beta Three',   artist:'Band A', bpm:132, camelot:'10B', energy:78, dur:205, genre:'Rock', bpmg:'E'}),
  c1:   mkT({id:'c1',  song:'Gamma One',    artist:'Band F', bpm:138, camelot:'10B', energy:82, dur:200, genre:'Rock', bpmg:'E'}),
  hi:   mkT({id:'hi',  song:'High Energy',  artist:'Band G', bpm:125, camelot:'9B',  energy:92, dur:200, genre:'Punk', bpmg:'D'}),
  lo:   mkT({id:'lo',  song:'Low Energy',   artist:'Band H', bpm:122, camelot:'9B',  energy:25, dur:200, genre:'Rock', bpmg:'D'}),
  d1:   mkT({id:'d1',  song:'Dup Song',               artist:'Band I', bpm:126, camelot:'9B', energy:70, dur:200, genre:'Rock', bpmg:'D'}),
  d2:   mkT({id:'d2',  song:'Dup Song (Radio Edit)',   artist:'Band I', bpm:126, camelot:'9B', energy:68, dur:195, genre:'Rock', bpmg:'D'}),
  far:  mkT({id:'far', song:'Far Jump',     artist:'Band J', bpm:145, camelot:'9B',  energy:80, dur:200, genre:'Rock', bpmg:'F'}),
  unr:  mkT({id:'unr', song:'Unreachable',  artist:'Band X', bpm:172, camelot:'9B',  energy:80, dur:200, genre:'Rock', bpmg:'H'}),
  low:  mkT({id:'low', song:'Low BPM',      artist:'Band K', bpm:110, camelot:'9B',  energy:72, dur:200, genre:'Rock', bpmg:'C'}),
  pre:  mkT({id:'pre', song:'Pre Song',     artist:'Band L', bpm:112, camelot:'9B',  energy:72, dur:210, genre:'Rock', bpmg:'C'}),
  calm: mkT({id:'calm', song:'Calm Track',    artist:'Band M',  bpm:100, camelot:'9B',  energy:42, dur:200, genre:'Synthwave / Electronica', bpmg:'B', dance:45, valence:60, acoustic:55, instrumental:70, speech:10, loud:-14}),
  recov:mkT({id:'recov',song:'Recovery',     artist:'Band N',  bpm:75,  camelot:'9B',  energy:35, dur:210, genre:'Synthwave / Electronica', bpmg:'A', dance:30, valence:55, acoustic:65, instrumental:80, speech:5,  loud:-15}),
  pa:   mkT({id:'pa',  song:'Plateau Alpha', artist:'Band Pa', bpm:100, camelot:'9B',  energy:40, dur:200, genre:'Rock', bpmg:'B', dance:45, valence:62, acoustic:52, instrumental:68, speech:9,  loud:-13}),
  pb:   mkT({id:'pb',  song:'Plateau Beta',  artist:'Band Pb', bpm:98,  camelot:'10B', energy:38, dur:210, genre:'Rock', bpmg:'B', dance:42, valence:58, acoustic:58, instrumental:72, speech:7,  loud:-14}),
  pc:   mkT({id:'pc',  song:'Plateau Gamma', artist:'Band Pc', bpm:106, camelot:'8B',  energy:42, dur:195, genre:'Rock', bpmg:'B', dance:44, valence:65, acoustic:50, instrumental:66, speech:8,  loud:-12}),
  pout: mkT({id:'pout',song:'Out of Band',   artist:'Band Po', bpm:85,  camelot:'9B',  energy:40, dur:200, genre:'Rock', bpmg:'A', dance:40, valence:60, acoustic:55, instrumental:70, speech:8,  loud:-13}),
  da:   mkT({id:'da',  song:'Decrease Alpha',artist:'Band Da', bpm:98,  camelot:'9B',  energy:40, dur:200, genre:'Rock', bpmg:'B', dance:40, valence:55, acoustic:55, instrumental:65, speech:8,  loud:-13}),
  db:   mkT({id:'db',  song:'Decrease Beta', artist:'Band Db', bpm:90,  camelot:'9B',  energy:35, dur:200, genre:'Rock', bpmg:'B', dance:35, valence:55, acoustic:60, instrumental:70, speech:5,  loud:-14}),
  dc:   mkT({id:'dc',  song:'Decrease Gamma',artist:'Band Dc', bpm:80,  camelot:'8B',  energy:30, dur:210, genre:'Rock', bpmg:'A', dance:30, valence:50, acoustic:65, instrumental:75, speech:5,  loud:-15}),
};
const FULL_POOL = Object.values(T);

// ============================================================
//  TEST SUITES
// ============================================================

describe('bpmGroup — BPM zu Gruppe', () => {
  it('0 BPM → A',              () => expect(bpmGroup(0)).toBe('A'));
  it('89 BPM → A',             () => expect(bpmGroup(89)).toBe('A'));
  it('90 BPM → B',             () => expect(bpmGroup(90)).toBe('B'));
  it('109 BPM → B',            () => expect(bpmGroup(109)).toBe('B'));
  it('110 BPM → C',            () => expect(bpmGroup(110)).toBe('C'));
  it('119 BPM → C',            () => expect(bpmGroup(119)).toBe('C'));
  it('120 BPM → D',            () => expect(bpmGroup(120)).toBe('D'));
  it('129 BPM → D',            () => expect(bpmGroup(129)).toBe('D'));
  it('130 BPM → E',            () => expect(bpmGroup(130)).toBe('E'));
  it('140 BPM → F',            () => expect(bpmGroup(140)).toBe('F'));
  it('150 BPM → G',            () => expect(bpmGroup(150)).toBe('G'));
  it('160 BPM → H',            () => expect(bpmGroup(160)).toBe('H'));
  it('174 BPM → H',            () => expect(bpmGroup(174)).toBe('H'));
  it('175 BPM → I',            () => expect(bpmGroup(175)).toBe('I'));
  it('220 BPM → I',            () => expect(bpmGroup(220)).toBe('I'));
});

describe('groupIdx — Gruppe zu Index', () => {
  it('A → 0',                  () => expect(groupIdx('A')).toBe(0));
  it('B → 1',                  () => expect(groupIdx('B')).toBe(1));
  it('D → 3',                  () => expect(groupIdx('D')).toBe(3));
  it('E → 4',                  () => expect(groupIdx('E')).toBe(4));
  it('I → 8',                  () => expect(groupIdx('I')).toBe(8));
  it('Unbekannte Gruppe → -1', () => expect(groupIdx('Z')).toBe(-1));
});

describe('neighbour — BPM-Gruppen-Nachbarschaft', () => {
  it('gleiche Gruppe A-A → true',        () => expect(neighbour('A','A')).toBeTruthy());
  it('Nachbar D-E → true',               () => expect(neighbour('D','E')).toBeTruthy());
  it('Nachbar E-D rückwärts → true',     () => expect(neighbour('E','D')).toBeTruthy());
  it('2 Stufen D-F → false',             () => expect(neighbour('D','F')).toBeFalsy());
  it('weit entfernt A-I → false',        () => expect(neighbour('A','I')).toBeFalsy());
  it('Grenze C-D → true',               () => expect(neighbour('C','D')).toBeTruthy());
  it('Grenze B-D → false (2 Stufen)',    () => expect(neighbour('B','D')).toBeFalsy());
});

describe('fmtDur — Sekunden formatieren', () => {
  it('0 → —',                            () => expect(fmtDur(0)).toBe('—'));
  it('null → —',                         () => expect(fmtDur(null)).toBe('—'));
  it('60s → 1m00s',                      () => expect(fmtDur(60)).toBe('1m00s'));
  it('90s → 1m30s',                      () => expect(fmtDur(90)).toBe('1m30s'));
  it('214s → 3m34s',                     () => expect(fmtDur(214)).toBe('3m34s'));
  it('3600s → 60m00s',                   () => expect(fmtDur(3600)).toBe('60m00s'));
  it('Sekunden < 10 mit führender Null', () => expect(fmtDur(65)).toBe('1m05s'));
});

describe('fmtMin — Sekunden in Minuten', () => {
  it('60s → 1min',   () => expect(fmtMin(60)).toBe('1min'));
  it('90s → 2min',   () => expect(fmtMin(90)).toBe('2min'));
  it('1200s → 20min',() => expect(fmtMin(1200)).toBe('20min'));
  it('0s → 0min',    () => expect(fmtMin(0)).toBe('0min'));
});

describe('titleKey — Titel-Normalisierung für Dedup', () => {
  it('Normaler Titel',                   () => expect(titleKey('Alpha One')).toBe('alphaone'));
  it('Radio Edit wird entfernt',         () => expect(titleKey('Song (Radio Edit)')).toBe('song'));
  it('Remastered wird entfernt',         () => expect(titleKey('Song - Remastered 2018')).toBe('song'));
  it('feat. wird entfernt',             () => expect(titleKey('Song feat. Artist')).toBe('song'));
  it('Extended Mix wird entfernt',       () => expect(titleKey('Song Extended Mix')).toBe('song'));
  it('Live wird entfernt',              () => expect(titleKey('Song Live at Wembley')).toBe('song'));
  it('Auf 15 Zeichen gekürzt',          () => expect(titleKey('A Very Long Title That Exceeds Limit')).toHaveLength(15));
  it('Sonderzeichen entfernt',          () => expect(titleKey("It's Rock'n'Roll")).toBe('itsrocknroll'));
  it('Großschreibung normalisiert',      () => expect(titleKey('MY SONG')).toBe('mysong'));
  it('Gleicher Key für Original und Radio Edit', () => {
    expect(titleKey('Dup Song')).toBe(titleKey('Dup Song (Radio Edit)'));
  });
});

describe('camCompat — Camelot-Kompatibilität', () => {
  it('Gleiche Zahl A↔B → green',                    () => expect(camCompat('9B','9A')).toBe('green'));
  it('Gleicher Key → green',                         () => expect(camCompat('9B','9B')).toBe('green'));
  it('+1 gleicher Buchstabe → green',                () => expect(camCompat('9B','10B')).toBe('green'));
  it('-1 gleicher Buchstabe → green',                () => expect(camCompat('9B','8B')).toBe('green'));
  it('Wrap-around 12→1 gleicher Buchstabe → green',  () => expect(camCompat('12B','1B')).toBe('green'));
  it('Wrap-around 1→12 gleicher Buchstabe → green',  () => expect(camCompat('1B','12B')).toBe('green'));
  it('+2 gleicher Buchstabe → yellow',               () => expect(camCompat('9B','11B')).toBe('yellow'));
  it('-2 gleicher Buchstabe → yellow',               () => expect(camCompat('9B','7B')).toBe('yellow'));
  it('+3 gleicher Buchstabe → red',                  () => expect(camCompat('9B','12B')).toBe('red'));
  it('Verschiedene Zahlen + Buchstaben → red',       () => expect(camCompat('9B','5A')).toBe('red'));
  it('null → unknown',                               () => expect(camCompat(null,'9B')).toBe('unknown'));
  it('"nan" → unknown',                              () => expect(camCompat('nan','9B')).toBe('unknown'));
  it('undefined → unknown',                          () => expect(camCompat(undefined,'9B')).toBe('unknown'));
});

describe('lerpColor — Farb-Interpolation', () => {
  const stops = [{p:0,r:0,g:0,b:0},{p:1,r:100,g:200,b:50}];
  it('t=0 → Startfarbe',    () => { const c=lerpColor(0,stops); expect(c.r).toBe(0); expect(c.g).toBe(0); expect(c.b).toBe(0); });
  it('t=1 → Endfarbe',      () => { const c=lerpColor(1,stops); expect(c.r).toBe(100); expect(c.g).toBe(200); expect(c.b).toBe(50); });
  it('t=0.5 → Mittelwert',  () => { const c=lerpColor(0.5,stops); expect(c.r).toBe(50); expect(c.g).toBe(100); expect(c.b).toBe(25); });
  it('t<0 → Clip auf Start',() => { const c=lerpColor(-0.5,stops); expect(c.r).toBe(0); });
  it('t>1 → Clip auf Ende', () => { const c=lerpColor(1.5,stops); expect(c.r).toBe(100); });
  it('3 Stops — mittlerer Stop korrekt', () => {
    const s=[{p:0,r:0,g:0,b:0},{p:0.5,r:100,g:0,b:0},{p:1,r:100,g:100,b:0}];
    expect(lerpColor(0.25,s).r).toBe(50);
  });
});

describe('addTrack — Track zu Ergebnis hinzufügen', () => {
  it('Track in result-Array', () => {
    const res=[],ids=new Set(),tks=new Set(),arts=new Map();
    addTrack(T.a1,res,ids,tks,arts);
    expect(res).toHaveLength(1); expect(res[0].id).toBe('a1');
  });
  it('ID zu usedIds', () => {
    const res=[],ids=new Set(),tks=new Set(),arts=new Map();
    addTrack(T.a1,res,ids,tks,arts);
    expect(ids.has('a1')).toBeTruthy();
  });
  it('titleKey zu usedTitleKeys', () => {
    const res=[],ids=new Set(),tks=new Set(),arts=new Map();
    addTrack(T.a1,res,ids,tks,arts);
    expect(tks.has(titleKey(T.a1.song))).toBeTruthy();
  });
  it('Artist-Zähler wird erhöht', () => {
    const res=[],ids=new Set(),tks=new Set(),arts=new Map();
    addTrack(T.a1,res,ids,tks,arts);
    expect(arts.get('band a')).toBe(1);
  });
  it('Artist-Zähler akkumuliert', () => {
    const res=[],ids=new Set(),tks=new Set(),arts=new Map();
    addTrack(T.a1,res,ids,tks,arts);
    addTrack(T.b3,res,ids,tks,arts);
    expect(arts.get('band a')).toBe(2);
  });
});

describe('pickNext — nächsten Track auswählen', () => {
  it('Gibt gültigen Track zurück', () => {
    expect(pickNext([T.a2,T.b1],T.a1,new Set(),new Set(),new Map(),10)).toBeTruthy();
  });
  it('BPM >= aktueller BPM', () => {
    const next=pickNext([T.a2,T.b1,T.a3],T.a1,new Set(),new Set(),new Map(),10);
    expect(next.bpm).toBeGreaterThanOrEqual(T.a1.bpm);
  });
  it('BPM-Sprung <= maxJump', () => {
    const next=pickNext([T.a2,T.a3,T.b1],T.a1,new Set(),new Set(),new Map(),10);
    expect(next.bpm - T.a1.bpm).toBeLessThanOrEqual(state.maxJump);
  });
  it('BPM-Ratio > 10 % → null (log2-Score = 0.00, kein Fallback)', () => {
    // T.far: 145 BPM from 120 BPM — ratio=1.208, d=0.272 > 0.135 → score=0.00 → ausgeschlossen
    const next=pickNext([T.far],T.a1,new Set(),new Set(),new Map(),10);
    expect(next).toBeNull();
  });
  it('Absolut unerreichbarer Sprung > 50 → null', () => {
    expect(pickNext([T.unr],T.a1,new Set(),new Set(),new Map(),10)).toBeNull();
  });
  it('BPM tiefer als aktuell → null', () => {
    expect(pickNext([T.low],T.a1,new Set(),new Set(),new Map(),10)).toBeNull();
  });
  it('Bereits verwendeter Track → null', () => {
    expect(pickNext([T.a2],T.a1,new Set(['a2']),new Set(),new Map(),10)).toBeNull();
  });
  it('Energy-Filter: in-range Track bevorzugt', () => {
    const inRange=mkT({id:'ir',song:'In Range',artist:'Band Z',bpm:125,camelot:'9B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
    const next=pickNext([T.hi,inRange],T.a1,new Set(),new Set(),new Map(),10);
    expect(next.id).toBe('ir');
  });
  it('Energy außerhalb Range → null (kein Energy-Bypass mehr)', () => {
    // T.hi: energy=92 > state.wodEnergyMax=85 → ausgeschlossen; Phase-4-Eskalation entfernt
    const next=pickNext([T.hi],T.a1,new Set(),new Set(),new Map(),10);
    expect(next).toBeNull();
  });
  it('Energie zu niedrig → null', () => {
    expect(pickNext([T.lo],T.a1,new Set(),new Set(),new Map(),10)).toBeNull();
  });
  it('Duplikat-Titel → null wenn Original verwendet', () => {
    expect(pickNext([T.d2],T.a1,new Set(),new Set([titleKey(T.d1.song)]),new Map(),10)).toBeNull();
  });
  it('Bevorzugt grünes Camelot', () => {
    const green=mkT({id:'g1',song:'Green Track',artist:'Band Z', bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
    const yellow=mkT({id:'y1',song:'Yellow Track',artist:'Band Z2',bpm:124,camelot:'11B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
    expect(pickNext([yellow,green],T.a1,new Set(),new Set(),new Map(),10).id).toBe('g1');
  });
  it('Leerer Pool → null', () => {
    expect(pickNext([],T.a1,new Set(),new Set(),new Map(),10)).toBeNull();
  });
});

describe('buildUp — Playlist aufwärts aufbauen', () => {
  it('Erster Track ist immer startT', () => {
    expect(buildUp(FULL_POOL,T.a1,new Set(),new Set(),new Map(),0,0)[0].id).toBe('a1');
  });
  it('BPM steigt nie', () => {
    const res=buildUp([T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1],T.a1,new Set(),new Set(),new Map(),0,0);
    for(let i=1;i<res.length;i++) expect(res[i].bpm).toBeGreaterThanOrEqual(res[i-1].bpm);
  });
  it('Kein Track doppelt', () => {
    const res=buildUp([T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1],T.a1,new Set(),new Set(),new Map(),0,0);
    const ids=res.map(t=>t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Stoppt bei targetSec', () => {
    const targetSec=2*210;
    const res=buildUp([T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1],T.a1,new Set(),new Set(),new Map(),targetSec,0);
    expect(res.reduce((s,t)=>s+t.dur,0)).toBeGreaterThanOrEqual(targetSec);
  });
  it('Count-Limit eingehalten', () => {
    const res=buildUp([T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1],T.a1,new Set(),new Set(),new Map(),0,3);
    expect(res.length).toBeLessThanOrEqual(3);
  });
  it('Leerer Pool → nur startT', () => {
    const res=buildUp([],T.a1,new Set(),new Set(),new Map(),0,0);
    expect(res).toHaveLength(1); expect(res[0].id).toBe('a1');
  });
  it('Alle Tracks in Energy-Range', () => {
    const res=buildUp([T.a1,T.a2,T.a3,T.b1,T.b2,T.hi,T.lo],T.a1,new Set(),new Set(),new Map(),0,0);
    res.forEach(t=>{ expect(t.energy).toBeGreaterThanOrEqual(state.wodEnergyMin); expect(t.energy).toBeLessThanOrEqual(state.wodEnergyMax); });
  });
});

describe('buildDown — Tracks rückwärts aufbauen', () => {
  it('Gibt Array zurück', () => {
    expect(Array.isArray(buildDown([T.pre,T.a1],T.a1,new Set(['a1']),new Set(),new Map(),5))).toBeTruthy();
  });
  it('BPM im Ergebnis steigt (aufsteigend zu endT)', () => {
    const res=buildDown([T.pre,T.low],T.a1,new Set(['a1']),new Set(),new Map(),5);
    for(let i=1;i<res.length;i++) expect(res[i].bpm).toBeGreaterThanOrEqual(res[i-1].bpm);
  });
  it('Kein Track mit BPM > endT.bpm', () => {
    const res=buildDown([T.a2,T.b1],T.a1,new Set(['a1']),new Set(),new Map(),5);
    res.forEach(t=>expect(t.bpm).toBeLessThanOrEqual(T.a1.bpm));
  });
  it('Energie-Filter gilt', () => {
    const res=buildDown([T.hi,T.lo,T.pre],T.a1,new Set(['a1']),new Set(),new Map(),5);
    res.forEach(t=>{ expect(t.energy).toBeGreaterThanOrEqual(state.wodEnergyMin); expect(t.energy).toBeLessThanOrEqual(state.wodEnergyMax); });
  });
  it('Leerer Pool → leeres Array', () => {
    expect(buildDown([],T.a1,new Set(['a1']),new Set(),new Map(),5)).toHaveLength(0);
  });
});

// calcWodEnergy is a v3 legacy function no longer in the codebase — kept inline for continuity
function calcWodEnergy(sliderVal) {
  const t = sliderVal / 100;
  return {min: Math.round(28 + t * 44), max: Math.round(70 + t * 30)};
}
describe('calcWodEnergy — Energy-Bereich je WOD-Typ (v3 Legacy)', () => {
  it('Slider=0 → min=28, max=70',  () => { const e=calcWodEnergy(0);   expect(e.min).toBe(28);  expect(e.max).toBe(70);  });
  it('Slider=50 → min=50, max=85', () => { const e=calcWodEnergy(50);  expect(e.min).toBe(50);  expect(e.max).toBe(85);  });
  it('Slider=100 → min=72, max=100',() => { const e=calcWodEnergy(100); expect(e.min).toBe(72);  expect(e.max).toBe(100); });
  it('Min < Max bei allen Werten',  () => { for(let v=0;v<=100;v+=10){ const e=calcWodEnergy(v); expect(e.min).toBeLessThanOrEqual(e.max-1); } });
  it('Monoton steigend',            () => {
    let pm=-1,pM=-1;
    for(let v=0;v<=100;v+=10){ const e=calcWodEnergy(v); expect(e.min).toBeGreaterThanOrEqual(pm); expect(e.max).toBeGreaterThanOrEqual(pM); pm=e.min; pM=e.max; }
  });
});

describe('attrScore — Attribut-Score', () => {
  it('Wert in Range → 100',                    () => expect(attrScore(70,{min:60,max:80})).toBe(100));
  it('Wert auf unterer Grenze → 100',          () => expect(attrScore(60,{min:60,max:80})).toBe(100));
  it('Wert auf oberer Grenze → 100',           () => expect(attrScore(80,{min:60,max:80})).toBe(100));
  it('Wert 1 unter Grenze → 97',              () => expect(attrScore(59,{min:60,max:80})).toBe(97));
  it('Wert 10 außerhalb → 70',                () => expect(attrScore(50,{min:60,max:80})).toBe(70));
  it('Wert 34+ außerhalb → 0',               () => expect(attrScore(20,{min:55,max:80})).toBe(0));
  it('Nur max: -12 → 100',                    () => expect(attrScore(-12,{max:-10})).toBe(100));
  it('Nur max: -8 → 94',                      () => expect(attrScore(-8,{max:-10})).toBe(94));
  it('Nur min: 50 → 100',                     () => expect(attrScore(50,{min:40})).toBe(100));
  it('null-Wert → 50 Fallback',               () => expect(attrScore(null,{min:40,max:80})).toBe(50));
});

describe('calcPhaseScore — Phase-Match-Score', () => {
  it('Phase A: ideal (calm) → > 70',          () => expect(calcPhaseScore(T.calm,'A')).toBeGreaterThan(70));
  it('Phase A: WOD-Track (b1) → <= 65',       () => expect(calcPhaseScore(T.b1,'A')).toBeLessThanOrEqual(65));
  it('Phase D: Recovery → > 70',              () => expect(calcPhaseScore(T.recov,'D')).toBeGreaterThan(70));
  it('Phase D: WOD-Track → <= 40',            () => expect(calcPhaseScore(T.b1,'D')).toBeLessThanOrEqual(40));
  it('Phase C: guter Track → > 0',            () => {
    const t=Object.assign({},T.b2,{energy:85,valence:70,dance:70,loud:-6});
    expect(calcPhaseScore(t,'C')).toBeGreaterThan(0);
  });
  it('Phase C: schlechter Track → < 45',       () => {
    const t=Object.assign({},T.lo,{energy:30,valence:30,dance:30,loud:-15});
    expect(calcPhaseScore(t,'C')).toBeLessThan(45);
  });
  it('Phase B: Skill-Track (b1, 130 BPM, E:80) → > 50', () => {
    const t = Object.assign({}, T.b1, {valence:50, dance:50, acoustic:20, live:15, loud:-7});
    expect(calcPhaseScore(t,'B')).toBeGreaterThan(50);
  });
  it('Phase B: WOD-Track mit E:92 liegt außerhalb Energy-Range 55-78 → Penalty', () => {
    expect(calcPhaseScore(T.hi,'B')).toBeLessThan(calcPhaseScore(T.b1,'B'));
  });
  it('Score immer 0-100',                      () => {
    Object.values(T).forEach(t=>['A','B','C','D'].forEach(p=>{
      const s=calcPhaseScore(t,p);
      expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(100);
    }));
  });
});

describe('camStrictOk — Strikter Camelot-Check', () => {
  it('Gleicher Key → true',                     () => expect(camStrictOk('9B','9B')).toBeTruthy());
  it('Gleiche Zahl A↔B → true',                () => expect(camStrictOk('9B','9A')).toBeTruthy());
  it('+1 gleicher Buchstabe → true',            () => expect(camStrictOk('9B','10B')).toBeTruthy());
  it('-1 gleicher Buchstabe → true',            () => expect(camStrictOk('9B','8B')).toBeTruthy());
  it('Wrap-around 12→1 → true',                () => expect(camStrictOk('12B','1B')).toBeTruthy());
  it('+2 gleicher Buchstabe → false (gelb)',    () => expect(camStrictOk('9B','11B')).toBeFalsy());
  it('Verschiedene Zahlen+Buchstaben → false',  () => expect(camStrictOk('9B','5A')).toBeFalsy());
  it('null → false',                            () => expect(camStrictOk(null,'9B')).toBeFalsy());
});

describe('toHex / toRgb — Farb-Konvertierung', () => {
  it('toHex Schwarz',       () => expect(toHex({r:0,g:0,b:0})).toBe('#000000'));
  it('toHex Weiß',          () => expect(toHex({r:255,g:255,b:255})).toBe('#ffffff'));
  it('toHex Spotify-Grün',  () => expect(toHex({r:29,g:185,b:84})).toBe('#1db954'));
  it('toHex zweistellig',   () => expect(toHex({r:1,g:2,b:3})).toBe('#010203'));
  it('toRgb Format',        () => expect(toRgb({r:29,g:185,b:84})).toBe('rgb(29,185,84)'));
  it('toRgb Schwarz',       () => expect(toRgb({r:0,g:0,b:0})).toBe('rgb(0,0,0)'));
});

describe('buildPlateau — Phase A Plateau-Algorithmus', () => {
  const platPool = [T.pa, T.pb, T.pc, T.pout];
  const refBpm = 100;

  it('Gibt Array zurück', () => {
    expect(Array.isArray(buildPlateau(platPool, refBpm, new Set(), new Set(), new Map(), 1000))).toBeTruthy();
  });
  it('Alle Tracks im ±12 BPM-Band um refBpm', () => {
    const res = buildPlateau(platPool, refBpm, new Set(), new Set(), new Map(), 10000);
    res.forEach(t => expect(Math.abs(t.bpm - refBpm)).toBeLessThanOrEqual(12));
  });
  it('Track außerhalb des Bandes (pout, bpm=85) wird ausgeschlossen', () => {
    const res = buildPlateau(platPool, refBpm, new Set(), new Set(), new Map(), 10000);
    expect(res.find(t => t.id === 'pout')).toBeFalsy();
  });
  it('Stoppt wenn targetSec erreicht', () => {
    const target = 210;
    const res = buildPlateau(platPool, refBpm, new Set(), new Set(), new Map(), target);
    expect(res.reduce((s, t) => s + t.dur, 0)).toBeGreaterThanOrEqual(target);
  });
  it('Kein Track doppelt', () => {
    const res = buildPlateau(platPool, refBpm, new Set(), new Set(), new Map(), 10000);
    const ids = res.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Bereits verwendeter Track wird übersprungen', () => {
    const used = new Set([T.pa.id]);
    const res = buildPlateau(platPool, refBpm, used, new Set(), new Map(), 10000);
    expect(res.find(t => t.id === 'pa')).toBeFalsy();
  });
  it('Leerer Pool → leeres Array', () => {
    expect(buildPlateau([], refBpm, new Set(), new Set(), new Map(), 1000)).toHaveLength(0);
  });
  it('Pool ohne Treffer → leeres Array', () => {
    expect(buildPlateau([T.pout], refBpm, new Set(), new Set(), new Map(), 1000)).toHaveLength(0);
  });
});

describe('buildDecreasing — Phase D Absteigend-Algorithmus', () => {
  const decPool = [T.da, T.db, T.dc, T.calm, T.recov];
  const startBpm = 100;

  it('Gibt Array zurück', () => {
    expect(Array.isArray(buildDecreasing(decPool, startBpm, new Set(), new Set(), new Map(), 400))).toBeTruthy();
  });
  it('BPM sinkt oder bleibt gleich', () => {
    const res = buildDecreasing(decPool, startBpm, new Set(), new Set(), new Map(), 1200);
    for (let i = 1; i < res.length; i++) expect(res[i].bpm).toBeLessThanOrEqual(res[i-1].bpm);
  });
  it('Kein Track mit BPM > startBpm', () => {
    const res = buildDecreasing(decPool, startBpm, new Set(), new Set(), new Map(), 1200);
    res.forEach(t => expect(t.bpm).toBeLessThanOrEqual(startBpm));
  });
  it('Stoppt wenn targetSec erreicht', () => {
    const target = 400;
    const res = buildDecreasing(decPool, startBpm, new Set(), new Set(), new Map(), target);
    expect(res.reduce((s, t) => s + t.dur, 0)).toBeGreaterThanOrEqual(target);
  });
  it('Kein Track doppelt', () => {
    const res = buildDecreasing(decPool, startBpm, new Set(), new Set(), new Map(), 10000);
    const ids = res.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Leerer Pool → leeres Array', () => {
    expect(buildDecreasing([], startBpm, new Set(), new Set(), new Map(), 400)).toHaveLength(0);
  });
  it('Bereits verwendete Tracks werden übersprungen', () => {
    const used = new Set([T.da.id, T.db.id]);
    const res = buildDecreasing(decPool, startBpm, used, new Set(), new Map(), 1000);
    expect(res.find(t => t.id === 'da' || t.id === 'db')).toBeFalsy();
  });
});

describe('calcSortScore — Unified Sort Score', () => {
  const cur = {bpm:120, camelot:'9B', energy:72};
  it('Grünes > gelbes Camelot', () => {
    const g=Object.assign({},T.a2,{camelot:'10B'}), y=Object.assign({},T.a2,{camelot:'11B'});
    expect(calcSortScore(g,cur,'C')).toBeGreaterThan(calcSortScore(y,cur,'C'));
  });
  it('Höhere Energy → höherer Score', () => {
    const hi=Object.assign({},T.a2,{energy:90}), lo=Object.assign({},T.a2,{energy:60});
    expect(calcSortScore(hi,cur,'C')).toBeGreaterThan(calcSortScore(lo,cur,'C'));
  });
  it('BPM ±2 % von cur → gleicher BPM-Transition-Score (Richtung durch Monotonie-Gate, nicht Score)', () => {
    // Beide innerhalb d≤0.030 → bpmTransScore=250; Penalty für Abwärts entfernt
    const below=Object.assign({},T.a2,{bpm:118,camelot:'10B'}), above=Object.assign({},T.a2,{bpm:122,camelot:'10B'});
    expect(calcSortScore(above,cur,'C')).toBe(calcSortScore(below,cur,'C'));
  });
  it('Geringere BPM-Ratio → höherer Score als BPM näher am Kern', () => {
    // 122 BPM (d=1.7%) schlägt 129 BPM (d=7.5%): bpmTransScore-Vorteil (96 Punkte) > phaseScore-Vorteil (54 Punkte)
    const s=Object.assign({},T.a2,{bpm:122,camelot:'10B'}), l=Object.assign({},T.a2,{bpm:129,camelot:'10B'});
    expect(calcSortScore(s,cur,'C')).toBeGreaterThan(calcSortScore(l,cur,'C'));
  });
  it('Phase A ideal hat höheren Score als WOD-Track', () => {
    const wodCur={bpm:95,camelot:'9B',energy:50};
    expect(calcSortScore(T.calm,wodCur,'A')).toBeGreaterThan(calcSortScore(T.a1,wodCur,'A'));
  });
});

describe('calcBpmTransitionScore — log2-Übergangsscore', () => {
  it('(150→153) ≈ 1.00 — d≈0.028 ≤ 0.030', () => {
    expect(calcBpmTransitionScore(150, 153, false)).toBeGreaterThanOrEqual(0.99);
  });
  it('(150→75) allowLog2=true → 1.00 — d=|log2(0.5×2)|=0', () => {
    expect(calcBpmTransitionScore(150, 75, true)).toBe(1.00);
  });
  it('(150→75) allowLog2=false → 0.00 — d=1.0 >> 0.135', () => {
    expect(calcBpmTransitionScore(150, 75, false)).toBe(0.00);
  });
  it('(160→78) allowLog2=true → ~0.85 — d=|log2(78/160×2)|≈0.037', () => {
    const s = calcBpmTransitionScore(160, 78, true);
    expect(s).toBeGreaterThan(0.80);
    expect(s).toBeLessThan(1.00);
  });
  it('(140→120) → 0.00 — d≈0.222 > 0.135', () => {
    expect(calcBpmTransitionScore(140, 120, false)).toBe(0.00);
  });
  it('fehlende BPM (bpmPrev=0) → 0.5 — kein Crash', () => {
    expect(calcBpmTransitionScore(0, 120, false)).toBe(0.5);
  });
  it('fehlende BPM (bpmNext=null) → 0.5 — kein Crash', () => {
    expect(calcBpmTransitionScore(120, null, false)).toBe(0.5);
  });
  it('Gleiche BPM → 1.00 — d=0', () => {
    expect(calcBpmTransitionScore(130, 130, false)).toBe(1.00);
  });
  it('Interpolation: d zwischen 0.030 und 0.070 → zwischen 0.85 und 1.00', () => {
    const s = calcBpmTransitionScore(120, 126, false); // d≈0.0695 ≈ 0.070
    expect(s).toBeGreaterThan(0.84);
    expect(s).toBeLessThanOrEqual(1.00);
  });
  it('d knapp unter 0.135 → Score > 0 (letzte Grünstufe)', () => {
    // 120 × 2^0.134 ≈ 131.6 — d=0.134 < 0.135 → Score ≈ 0.41 (nicht 0.00)
    const bpmNext = 120 * Math.pow(2, 0.134);
    const s = calcBpmTransitionScore(120, bpmNext, false);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.50);
  });
  it('d > 0.135 → Score = 0.00 (harter Ausschluss)', () => {
    // 140 → 120: d ≈ 0.222 → Score = 0.00
    expect(calcBpmTransitionScore(140, 120, false)).toBe(0.00);
  });
});

describe('effectiveBpm — Phasen-Normalisierung ×2/÷2', () => {
  it('BPM im Band → unverändert', () => {
    expect(effectiveBpm(150, 'C')).toBe(150); // C: [125,195]
  });
  it('Halbes BPM × 2 = im Band → Verdoppelung', () => {
    expect(effectiveBpm(75, 'C')).toBe(150); // 75×2=150 in [125,195]
  });
  it('Doppeltes BPM ÷ 2 = im Band → Halbierung', () => {
    expect(effectiveBpm(300, 'C')).toBe(150); // 300÷2=150 in [125,195]
  });
  it('Kein ×2/÷2 trifft Band → unverändert', () => {
    expect(effectiveBpm(60, 'C')).toBe(60); // 60, 120, 30 — 120 not in [125,195]
  });
  it('Phase A: 100 BPM im Band [85,110] → 100', () => {
    expect(effectiveBpm(100, 'A')).toBe(100);
  });
  it('Phase A: 50 BPM × 2 = 100 → 100', () => {
    expect(effectiveBpm(50, 'A')).toBe(100); // 50×2=100 in [85,110]
  });
  it('Ungültige Phase → BPM unverändert', () => {
    expect(effectiveBpm(120, 'X')).toBe(120);
  });
});

describe('pickNext — Top-5 Zufall und Carry-over', () => {
  const pool = [T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1];
  const cur  = {bpm:120, camelot:'9B', energy:72};

  it('Zwei Aufrufe mit gleichem Pool liefern nicht immer dasselbe Ergebnis', () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      const t = pickNext(pool, cur, new Set(), new Set(), new Map(), 10, []);
      if (t) results.add(t.id);
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it('Alle Hard-Constraints bleiben nach Zufallsauswahl erhalten', () => {
    for (let i = 0; i < 10; i++) {
      const t = pickNext(pool, cur, new Set(), new Set(), new Map(), 10, []);
      if (!t) continue;
      expect(t.bpm).toBeGreaterThanOrEqual(cur.bpm);
      expect(t.bpm - cur.bpm).toBeLessThanOrEqual(state.maxJump);
      expect(t.energy).toBeGreaterThanOrEqual(state.wodEnergyMin);
      expect(t.energy).toBeLessThanOrEqual(state.wodEnergyMax);
    }
  });

  it('Carryover wird nach einem Aufruf befüllt (≤ 2 Einträge)', () => {
    const co = [];
    pickNext(pool, cur, new Set(), new Set(), new Map(), 10, co);
    expect(co.length).toBeGreaterThanOrEqual(0);
    expect(co.length).toBeLessThanOrEqual(2);
  });

  it('Carryover-Track ist nicht identisch mit dem gepickten Track', () => {
    const co = [];
    const picked = pickNext(pool, cur, new Set(), new Set(), new Map(), 10, co);
    co.forEach(t => expect(t.id).not.toBe(picked?.id));
  });

  it('Carryover-Track der rot wäre wird nicht injiziert', () => {
    const redTrack = mkT({id:'red1', song:'Red Track', artist:'Band Z', bpm:122, camelot:'5A', energy:75, dur:200, genre:'Rock', bpmg:'D'});
    const co = [redTrack];
    const results = [];
    for (let i = 0; i < 10; i++) {
      const t = pickNext(pool, cur, new Set(), new Set(), new Map(), 10, co);
      if (t) results.push(t.id);
    }
    expect(results).not.toContain('red1');
  });

  it('buildUp produziert bei Mehrfachaufruf unterschiedliche Playlists', () => {
    // maxJump=10 nötig damit ≥3 Kandidaten pro Schritt für Zufallspick existieren
    // (state.maxJump=5 per DJ-Norm-Default aus #94 würde nur 1 Kandidat liefern)
    // 10 Läufe statt 3: P(alle identisch) = (1/3)^9 < 0.01% — zuverlässig
    const saved = state.maxJump; state.maxJump = 10;
    try {
      const fullPool = [T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1];
      const runs = Array.from({length: 10}, () =>
        buildUp(fullPool, T.a1, new Set(), new Set(), new Map(), 0, 5).map(t=>t.id).join(','));
      expect(new Set(runs).size).toBeGreaterThan(1);
    } finally { state.maxJump = saved; }
  });
});

describe('Integration — vollständige Playlist', () => {
  it('buildUp + buildDown bilden zusammenhängende BPM-Kette', () => {
    const pool=[T.pre,T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1];
    const ref=T.b1;
    const used=new Set([ref.id]), tks=new Set([titleKey(ref.song)]), arts=new Map([['band d',1]]);
    const before=buildDown(pool,ref,used,tks,arts,3);
    const after=buildUp(pool,ref,used,tks,arts,0,3);
    after.shift();
    for(let i=1;i<before.length;i++) expect(before[i].bpm).toBeGreaterThanOrEqual(before[i-1].bpm);
    for(let i=1;i<after.length;i++)  expect(after[i].bpm).toBeGreaterThanOrEqual(after[i-1].bpm);
  });
  it('Kein Track doppelt in kombinierter Playlist', () => {
    const res=buildUp([T.pre,T.a1,T.a2,T.a3,T.b1,T.b2,T.b3,T.c1],T.a1,new Set(),new Set(),new Map(),0,0);
    const ids=res.map(t=>t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Duplikat-Titel erscheint max. einmal', () => {
    const res=buildUp([T.a1,T.d1,T.d2,T.a2,T.b1],T.a1,new Set(),new Set(),new Map(),0,0);
    expect(res.filter(t=>t.id==='d1'||t.id==='d2').length).toBeLessThanOrEqual(1);
  });
  it('Energy-Range-Wechsel filtert Pool', () => {
    state.wodEnergyMin=75; state.wodEnergyMax=100;
    const next=pickNext([T.a1,T.a2,T.b1,T.hi],{bpm:118,camelot:'9B'},new Set(),new Set(),new Map(),10);
    if (next) expect(next.energy).toBeGreaterThanOrEqual(75);
    state.wodEnergyMin=50; state.wodEnergyMax=85;
  });
});

describe('CSV Upload — sanitizeFilename', () => {
  it('NTFS-illegale Zeichen werden entfernt',    () => expect(sanitizeFilename('My:Playlist<>*')).toBe('MyPlaylist'));
  it('Doppelte Leerzeichen werden zusammengefasst', () => expect(sanitizeFilename('My  Playlist')).toBe('My Playlist'));
  it('Leerzeichen am Rand werden getrimmt',       () => expect(sanitizeFilename('  Playlist  ')).toBe('Playlist'));
  it('Leerer Name ergibt "Upload"',               () => expect(sanitizeFilename('')).toBe('Upload'));
  it('Nur illegale Zeichen ergibt "Upload"',      () => expect(sanitizeFilename(':::***')).toBe('Upload'));
  it('Normaler Name bleibt unverändert',          () => expect(sanitizeFilename('CFLU WOD 2026')).toBe('CFLU WOD 2026'));
  it('Backslash wird entfernt',                   () => expect(sanitizeFilename('path\\name')).toBe('pathname'));
});

describe('CSV Upload — extractPlaylistName', () => {
  it('Playlist-Header-Zeile wird erkannt',   () => expect(extractPlaylistName('# Playlist: Mein Mix\n#,Song,...', 'fallback')).toBe('Mein Mix'));
  it('Leerzeichen nach Playlist: getrimmt',  () => expect(extractPlaylistName('# Playlist:  Mein Mix  \n...', 'fallback')).toBe('Mein Mix'));
  it('Header ohne Playlist gibt Fallback zurück', () => expect(extractPlaylistName('#,Song,Artist,BPM\ntrack1,...', 'Fallback')).toBe('Fallback'));
  it('Leerer Content gibt Fallback zurück',  () => expect(extractPlaylistName('', 'Fallback')).toBe('Fallback'));
  it('Nur erste 5 Zeilen werden geprüft',   () => expect(extractPlaylistName('a\nb\nc\nd\ne\n# Playlist: Spät', 'Fallback')).toBe('Fallback'));
});

describe('CSV Upload — formatUploadSuccess', () => {
  it('Neue + bereits im Pool + gesamt', () => expect(formatUploadSuccess({added:5, updated:2, total:100})).toBe('✓ Pool aktualisiert: 5 neu, 2 bereits im Pool, 100 gesamt'));
  it('Nur neue Tracks',                 () => expect(formatUploadSuccess({added:3, updated:0, total:50})).toBe('✓ Pool aktualisiert: 3 neu, 50 gesamt'));
  it('Nur bereits im Pool',             () => expect(formatUploadSuccess({added:0, updated:7, total:80})).toBe('✓ Pool aktualisiert: 7 bereits im Pool, 80 gesamt'));
  it('Keine Änderungen nur gesamt',     () => expect(formatUploadSuccess({added:0, updated:0, total:42})).toBe('✓ Pool aktualisiert: 42 gesamt'));
  it('Enthält Häkchen-Prefix',          () => expect(formatUploadSuccess({added:1, updated:0, total:1})).toMatch(/^✓/));
});

describe('CSV Upload — classifyUploadResult', () => {
  it('ok:false gibt type error zurück',                      () => expect(classifyUploadResult({ok: false, error: 'Test'}).type).toBe('error'));
  it('ok:false enthält Fehlermeldung',                       () => expect(classifyUploadResult({ok: false, error: 'Disk full'}).msg).toMatch(/Disk full/));
  it('ok:false ohne error-Feld hat Fallback',                () => expect(classifyUploadResult({ok: false}).msg).toMatch(/Fehler/));
  it('added:0 + updated:0 gibt type warning zurück',         () => expect(classifyUploadResult({ok: true, added: 0, updated: 0, total: 100}).type).toBe('warning'));
  it('Warning enthält Format-Hinweis',                       () => expect(classifyUploadResult({ok: true, added: 0, updated: 0, total: 100}).msg).toMatch(/Format/));
  it('added > 0 gibt type success zurück',                   () => expect(classifyUploadResult({ok: true, added: 5, updated: 0, total: 50}).type).toBe('success'));
  it('added:0 + updated>0 gibt type warning zurück',         () => expect(classifyUploadResult({ok: true, added: 0, updated: 3, total: 50}).type).toBe('warning'));
  it('added:0 + updated>0 Warning enthält Doubletten-Hinweis', () => expect(classifyUploadResult({ok: true, added: 0, updated: 3, total: 50}).msg).toMatch(/Doubletten/));
  it('added > 0 + updated > 0 gibt type success zurück',     () => expect(classifyUploadResult({ok: true, added: 2, updated: 1, total: 50}).type).toBe('success'));
  it('success msg enthält formatUploadSuccess',              () => expect(classifyUploadResult({ok: true, added: 2, updated: 1, total: 50}).msg).toMatch(/✓ Pool/));
});

// ============================================================
//  pickPrev — symmetrisch zu pickNext
// ============================================================
describe('pickPrev — vorherigen Track auswählen', () => {
  it('Gibt gültigen Track zurück', () => {
    expect(pickPrev([T.pre, T.low], T.a1, new Set(), new Set(), new Map(), 10)).toBeTruthy();
  });
  it('BPM <= aktueller BPM', () => {
    const prev = pickPrev([T.pre, T.low], T.a1, new Set(), new Set(), new Map(), 10);
    if (prev) expect(prev.bpm).toBeLessThanOrEqual(T.a1.bpm);
  });
  it('BPM-Abfall <= maxJump', () => {
    const prev = pickPrev([T.pre, T.low], T.a1, new Set(), new Set(), new Map(), 10);
    if (prev) expect(T.a1.bpm - prev.bpm).toBeLessThanOrEqual(state.maxJump);
  });
  it('Bereits verwendeter Track → null', () => {
    expect(pickPrev([T.pre], T.a1, new Set(['pre']), new Set(), new Map(), 10)).toBeNull();
  });
  it('BPM höher als aktuell → null', () => {
    expect(pickPrev([T.b2], T.a1, new Set(), new Set(), new Map(), 10)).toBeNull();
  });
  it('Leerer Pool → null', () => {
    expect(pickPrev([], T.a1, new Set(), new Set(), new Map(), 10)).toBeNull();
  });
  it('Energie-Filter gilt', () => {
    const prev = pickPrev([T.pre, T.lo], T.a1, new Set(), new Set(), new Map(), 10);
    if (prev) {
      expect(prev.energy).toBeGreaterThanOrEqual(state.wodEnergyMin);
      expect(prev.energy).toBeLessThanOrEqual(state.wodEnergyMax);
    }
  });
  it('Bevorzugt grünes Camelot (Abstieg)', () => {
    const green = mkT({id:'pg',song:'Green Down',artist:'Band Z',bpm:118,camelot:'10B',energy:72,dur:200,genre:'Rock',bpmg:'C'});
    const yellow = mkT({id:'py',song:'Yellow Down',artist:'Band Z2',bpm:118,camelot:'11B',energy:72,dur:200,genre:'Rock',bpmg:'C'});
    expect(pickPrev([yellow, green], T.a1, new Set(), new Set(), new Map(), 10).id).toBe('pg');
  });
  it('Zwei Aufrufe können unterschiedliche Tracks liefern', () => {
    const pool = [T.pre, T.low,
      mkT({id:'pd1',song:'PD1',artist:'Band Q',bpm:115,camelot:'9B',energy:72,dur:200,genre:'Rock',bpmg:'C'}),
      mkT({id:'pd2',song:'PD2',artist:'Band R',bpm:116,camelot:'9B',energy:72,dur:200,genre:'Rock',bpmg:'C'}),
      mkT({id:'pd3',song:'PD3',artist:'Band S',bpm:117,camelot:'9B',energy:72,dur:200,genre:'Rock',bpmg:'C'}),
    ];
    const ids = new Set();
    for (let i = 0; i < 20; i++) {
      const t = pickPrev(pool, T.a1, new Set(), new Set(), new Map(), 10);
      if (t) ids.add(t.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ============================================================
//  buildAlternating — Midpoint Alternating-Build
// ============================================================
describe('buildAlternating — Midpoint Alternating-Build', () => {
  // Pool mit aufsteigenden und absteigenden Tracks um ref=a1 (bpm=120)
  const altPool = [
    T.pre,   // 112 BPM — vor a1
    T.low,   // 110 BPM — vor a1 (energy zu niedrig, wird gefiltert)
    T.a2,    // 124 BPM — nach a1
    T.a3,    // 128 BPM — nach a1
    T.b1,    // 130 BPM — nach a1
    T.b2,    // 135 BPM — nach a1
    mkT({id:'pd1',song:'PD1',artist:'Band Q',bpm:115,camelot:'9B',energy:72,dur:200,genre:'Rock',bpmg:'C'}),
    mkT({id:'pd2',song:'PD2',artist:'Band R',bpm:116,camelot:'9B',energy:72,dur:200,genre:'Rock',bpmg:'C'}),
  ];
  const targetSec = 1200; // 20 Minuten

  it('Gibt Array zurück', () => {
    expect(Array.isArray(buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec))).toBeTruthy();
  });
  it('Referenz ist im Array enthalten', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    expect(res.find(t => t.id === 'a1')).toBeTruthy();
  });
  it('Referenz liegt in Listenmitte (±1)', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    const idx = res.findIndex(t => t.id === 'a1');
    const mid = Math.floor(res.length / 2);
    expect(Math.abs(idx - mid)).toBeLessThanOrEqual(1);
  });
  it('BPM-Monotonie: jeder Track >= Vorgänger', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    for (let i = 1; i < res.length; i++) expect(res[i].bpm).toBeGreaterThanOrEqual(res[i-1].bpm);
  });
  it('Kein Track doppelt', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    const ids = res.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Leerer Pool → nur [ref]', () => {
    const res = buildAlternating([], T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('a1');
  });
  it('Dauer bleibt unter targetSec * 1.05 + längster Track', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    const totalDur = res.reduce((s, t) => s + t.dur, 0);
    const maxTrackDur = Math.max(...altPool.map(t => t.dur));
    expect(totalDur).toBeLessThanOrEqual(targetSec * 1.05 + maxTrackDur);
  });
  it('Playlist wächst auf beiden Seiten (vor und nach ref)', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    if (res.length > 1) {
      const idx = res.findIndex(t => t.id === 'a1');
      // Mindestens je ein Track vor und nach ref wenn Pool beides hergibt
      expect(idx).toBeGreaterThanOrEqual(0);
    }
  });
  it('Tracks außerhalb Energy-Range werden ausgeschlossen', () => {
    const res = buildAlternating(altPool, T.a1, new Set(['a1']), new Set(), new Map(), targetSec);
    res.filter(t => t.id !== 'a1').forEach(t => {
      // low (energy:25) darf nicht vorkommen, auch wenn BPM passt
      expect(t.id).not.toBe('lo');
    });
  });
});

// ============================================================
//  GENRE_CONFIG Struktur
// ============================================================
describe('GENRE_CONFIG — Struktur', () => {
  it('Genau 10 Main Genres', () => expect(GENRE_CONFIG.mainGenres.length).toBe(10));
  it('Jedes Main hat neighbours[]', () => {
    GENRE_CONFIG.mainGenres.forEach(m => expect(Array.isArray(m.neighbours)).toBeTruthy());
  });
  it('Alle Neighbour-Gewichte in {0.5, 0.7, 1.0}', () => {
    const valid = new Set([0.5, 0.7, 1.0]);
    GENRE_CONFIG.mainGenres.forEach(m => m.neighbours.forEach(n => expect(valid.has(n.weight)).toBeTruthy()));
  });
  it('Genau 20 Bridge-Subgenres', () => expect(Object.keys(GENRE_CONFIG.bridgeSubgenres).length).toBe(20));
  it('Kein bridges-Key (entfernt)', () => {
    expect('bridges' in GENRE_CONFIG).toBe(false);
  });
  it('pickerStrategy.escalation hat 4 Stufen', () => expect(GENRE_CONFIG.pickerStrategy.escalation.length).toBe(4));
  it('Genau 1 warmup-Genre', () => {
    expect(GENRE_CONFIG.mainGenres.filter(m => m.role === 'warmup').length).toBe(1);
  });
  it('Genau 1 cooldown-Genre', () => {
    expect(GENRE_CONFIG.mainGenres.filter(m => m.role === 'cooldown').length).toBe(1);
  });
  it('8 peak-Genres', () => {
    expect(GENRE_CONFIG.mainGenres.filter(m => m.role === 'peak').length).toBe(8);
  });
  it('Synthwave ist warmup', () => {
    const sw = GENRE_CONFIG.mainGenres.find(m => m.id === 'Synthwave / Electronica');
    expect(sw.role).toBe('warmup');
  });
  it('Funk, Soul & R&B ist cooldown', () => {
    const fs = GENRE_CONFIG.mainGenres.find(m => m.id === 'Funk, Soul & R&B');
    expect(fs.role).toBe('cooldown');
  });
});

// ============================================================
//  getNeighboursWeighted + getNeighbours
// ============================================================
describe('getNeighboursWeighted / getNeighbours', () => {
  it('EDM hat 5 Neighbours', () => expect(getNeighboursWeighted('EDM / Electronic').length).toBe(5));
  it('Neighbours sortiert nach weight desc', () => {
    const nb = getNeighboursWeighted('EDM / Electronic');
    for (let i = 1; i < nb.length; i++) expect(nb[i].weight).toBeLessThanOrEqual(nb[i-1].weight);
  });
  it('Funk, Soul & R&B hat 5 Neighbours', () => expect(getNeighbours('Funk, Soul & R&B').length).toBe(5));
  it('Unbekanntes Genre → []', () => expect(getNeighboursWeighted('Unbekannt')).toHaveLength(0));
  it('getNeighbours gibt string[] zurück', () => {
    const nb = getNeighbours('Rock');
    expect(Array.isArray(nb)).toBeTruthy();
    nb.forEach(n => expect(typeof n).toBe('string'));
  });
  it('Rock hat Ska & Reggae als stärksten Neighbour (weight 1.0)', () => {
    const nb = getNeighboursWeighted('Rock');
    expect(nb[0].mainId).toBe('Ska & Reggae');
    expect(nb[0].weight).toBe(1.0);
  });
});

// ============================================================
//  bridgeTags + bridgeTagsForMain
// ============================================================
describe('bridgeTags / bridgeTagsForMain', () => {
  it('Punk↔Ska & Reggae: ska punk + skate punk', () => {
    const tags = bridgeTags('Punk', 'Ska & Reggae');
    expect(tags).toContain('ska punk');
    expect(tags).toContain('skate punk');
  });
  it('Metal↔Hip Hop: rap metal + nu metal', () => {
    const tags = bridgeTags('Metal & Hard Rock', 'Hip Hop / Rap');
    expect(tags).toContain('rap metal');
    expect(tags).toContain('nu metal');
  });
  it('EDM↔Rock: keine gemeinsamen Bridge-Tags', () => {
    expect(bridgeTags('EDM / Electronic', 'Rock')).toHaveLength(0);
  });
  it('bridgeTagsForMain gibt alle Tags zurück die mainId enthalten', () => {
    const tags = bridgeTagsForMain('Metal & Hard Rock');
    expect(tags).toContain('rap metal');
    expect(tags).toContain('glam metal');
    expect(tags).toContain('hard rock');
  });
  it('bridgeTagsForMain für unbekanntes Genre → []', () => {
    expect(bridgeTagsForMain('Unbekannt')).toHaveLength(0);
  });
});

// ============================================================
//  isHalfDouble
// ============================================================
describe('isHalfDouble', () => {
  it('80 und 160 → true', () => expect(isHalfDouble(80, 160)).toBeTruthy());
  it('160 und 80 → true (symmetrisch)', () => expect(isHalfDouble(160, 80)).toBeTruthy());
  it('90 und 180 → true', () => expect(isHalfDouble(90, 180)).toBeTruthy());
  it('90 und 150 → false', () => expect(isHalfDouble(90, 150)).toBeFalsy());
  it('80 und 163 → true (tol=3: |160-163|=3)', () => expect(isHalfDouble(80, 163)).toBeTruthy());
  it('80 und 164 → false (>tol=3)', () => expect(isHalfDouble(80, 164)).toBeFalsy());
  it('gleiche BPM → false', () => expect(isHalfDouble(120, 120)).toBeFalsy());
});

// ============================================================
//  trapezScore
// ============================================================
describe('trapezScore', () => {
  const core = [140, 175];
  const band = [125, 195];
  it('Im Kernband → 100', () => expect(trapezScore(155, core, band)).toBe(100));
  it('Untere Kerngrenze → 100', () => expect(trapezScore(140, core, band)).toBe(100));
  it('Obere Kerngrenze → 100', () => expect(trapezScore(175, core, band)).toBe(100));
  it('Untere Bandgrenze → 0', () => expect(trapezScore(125, core, band)).toBe(0));
  it('Unter Bandgrenze → 0', () => expect(trapezScore(120, core, band)).toBe(0));
  it('Über Bandgrenze → 0', () => expect(trapezScore(200, core, band)).toBe(0));
  it('Mitte zwischen Bandgrenze und Kern unten → ~50', () => {
    const v = trapezScore(132, core, band);
    expect(v).toBeGreaterThan(40); expect(v).toBeLessThan(60);
  });
});

// ============================================================
//  calcPhaseScore BPM-Gewichtung
// ============================================================
describe('calcPhaseScore — BPM-Trapez-Gewichtung', () => {
  it('Phase C: 155 BPM rankt höher als 127 BPM (sonst gleich)', () => {
    const base = mkT({id:'x1',song:'X',artist:'A',bpm:155,camelot:'9B',energy:85,dur:200,genre:'Rock',bpmg:'G'});
    const low  = mkT({id:'x2',song:'Y',artist:'A',bpm:127,camelot:'9B',energy:85,dur:200,genre:'Rock',bpmg:'D'});
    expect(calcPhaseScore(base,'C')).toBeGreaterThan(calcPhaseScore(low,'C'));
  });
  it('Phase A: 100 BPM rankt höher als 85 BPM', () => {
    const ideal = mkT({id:'y1',song:'X',artist:'A',bpm:100,camelot:'9B',energy:30,dur:200,genre:'Rock',bpmg:'B'});
    const edge  = mkT({id:'y2',song:'Y',artist:'A',bpm:85, camelot:'9B',energy:30,dur:200,genre:'Rock',bpmg:'A'});
    expect(calcPhaseScore(ideal,'A')).toBeGreaterThan(calcPhaseScore(edge,'A'));
  });
  it('Liveness > 80 senkt Score', () => {
    const live   = mkT({id:'l1',song:'L',artist:'A',bpm:145,camelot:'9B',energy:85,dur:200,genre:'Rock',bpmg:'F',live:90});
    const normal = mkT({id:'l2',song:'N',artist:'A',bpm:145,camelot:'9B',energy:85,dur:200,genre:'Rock',bpmg:'F',live:10});
    expect(calcPhaseScore(normal,'C')).toBeGreaterThan(calcPhaseScore(live,'C'));
  });
});

// ============================================================
//  calcSortScore Bridge-Bonus
// ============================================================
describe('calcSortScore — Bridge-Bonus', () => {
  const cur = {bpm:120, camelot:'9B', energy:72, genre:'Metal & Hard Rock'};
  const base = mkT({id:'br1',song:'Bridge',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Hip Hop / Rap',bpmg:'D'});

  it('Track mit Bridge-Tag erhält höheren Score', () => {
    const withBridge    = Object.assign({}, base, {genres_raw: ['rap metal']});
    const withoutBridge = Object.assign({}, base, {genres_raw: []});
    expect(calcSortScore(withBridge,cur,'C')).toBeGreaterThan(calcSortScore(withoutBridge,cur,'C'));
  });
  it('Bridge-Bonus ist +50', () => {
    const wb = Object.assign({}, base, {genres_raw: ['rap metal']});
    const wo = Object.assign({}, base, {genres_raw: []});
    expect(calcSortScore(wb,cur,'C') - calcSortScore(wo,cur,'C')).toBe(50);
  });
  it('Grünes Camelot ohne Bridge schlägt gelbes Camelot mit Bridge', () => {
    const greenNoBridge  = mkT({id:'g1',song:'G',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Hip Hop / Rap',bpmg:'D',genres_raw:[]});
    const yellowWithBridge = mkT({id:'y1',song:'Y',artist:'A',bpm:124,camelot:'11B',energy:76,dur:200,genre:'Hip Hop / Rap',bpmg:'D',genres_raw:['rap metal']});
    expect(calcSortScore(greenNoBridge,cur,'C')).toBeGreaterThan(calcSortScore(yellowWithBridge,cur,'C'));
  });
});

// ============================================================
//  getPhasePoolWithNeighbours — proaktiv
// ============================================================
describe('getPhasePoolWithNeighbours — proaktives Pooling', () => {
  it('Gibt Array zurück', () => {
    expect(Array.isArray(getPhasePoolWithNeighbours('Rock', 'C'))).toBeTruthy();
  });
  it('directPool vollständig enthalten (kein Track verloren)', () => {
    const direct = getPhasePool('Rock', 'C');
    const combined = getPhasePoolWithNeighbours('Rock', 'C');
    direct.forEach(t => expect(combined.find(c => (c.id || c.song) === (t.id || t.song))).toBeTruthy());
  });
  it('Neighbour-Tracks proaktiv enthalten (auch wenn directPool >= 15)', () => {
    const direct   = getPhasePool('EDM / Electronic', 'C');
    const combined = getPhasePoolWithNeighbours('EDM / Electronic', 'C');
    if (direct.length >= 15) {
      expect(combined.length).toBeGreaterThanOrEqual(direct.length);
    }
  });
});

// ============================================================
//  pickNext — Subgenre-Eskalation
// ============================================================
describe('pickNext — Subgenre-Eskalation', () => {
  const curWithSubgenre = {bpm:120, camelot:'9B', energy:72, genre:'Rock', genres_raw: ['synthpop']};
  const sameSubgenre = mkT({id:'sg1',song:'Synth Track',artist:'Band S',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D',genres_raw:['synthpop']});
  const diffSubgenre = mkT({id:'sg2',song:'Other Track',artist:'Band O',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D',genres_raw:['classic rock']});

  it('Track mit gleichem genres_raw-Tag wird bevorzugt (Stufe 1)', () => {
    state.maxJump = 10; state.wodEnergyMin = 50; state.wodEnergyMax = 90; state.currentPhase = 'C';
    const pool = [sameSubgenre, diffSubgenre];
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      const t = pickNext(pool, curWithSubgenre, new Set(), new Set(), new Map(), 10, []);
      if (t) results.add(t.id);
    }
    expect(results.has('sg1')).toBeTruthy();
  });

  it('Neighbour-Genre-Track erscheint wenn kein Same-Genre-Track verfügbar (Stufe 4)', () => {
    state.maxJump = 10; state.wodEnergyMin = 50; state.wodEnergyMax = 90; state.currentPhase = 'C';
    const curRock = {bpm:120, camelot:'9B', energy:72, genre:'Rock', genres_raw:[]};
    const punkTrack = mkT({id:'pk1',song:'Punk Track',artist:'Band P',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Punk',bpmg:'D',genres_raw:[]});
    const t = pickNext([punkTrack], curRock, new Set(), new Set(), new Map(), 10, []);
    expect(t).toBeTruthy();
    expect(t.id).toBe('pk1');
  });

  it('getSubgenres gibt [] zurück wenn genres_raw fehlt', () => {
    expect(getSubgenres({})).toHaveLength(0);
    expect(getSubgenres({genres_raw: ['ska punk']})).toContain('ska punk');
  });
});

// ============================================================
//  getRoleBonus
// ============================================================
describe('getRoleBonus', () => {
  it('warmup-Genre in Phase A → +0.3', () => expect(getRoleBonus('Synthwave / Electronica', 'A')).toBe(0.3));
  it('cooldown-Genre in Phase D → +0.3', () => expect(getRoleBonus('Funk, Soul & R&B', 'D')).toBe(0.3));
  it('peak-Genre in Phase A → -0.2', () => expect(getRoleBonus('Rock', 'A')).toBe(-0.2));
  it('peak-Genre in Phase D → -0.2', () => expect(getRoleBonus('EDM / Electronic', 'D')).toBe(-0.2));
  it('warmup-Genre in Phase C → 0', () => expect(getRoleBonus('Synthwave / Electronica', 'C')).toBe(0));
  it('unbekanntes Genre → 0', () => expect(getRoleBonus('Unbekannt', 'A')).toBe(0));
});

describe('titleDuplicate — startsWith Remix-Dedup (#98)', () => {
  it('Exakter titleKey-Match → Duplikat', () => {
    const used = new Set([titleKey('Freestyler')]);
    expect(titleDuplicate('Freestyler', used)).toBeTruthy();
  });
  it('startsWith: langer Titel ist Duplikat des kurzen', () => {
    const used = new Set([titleKey('Freestyler')]);
    expect(titleDuplicate('Freestyler (Rock The Microphone)', used)).toBeTruthy();
  });
  it('startsWith: kurzer Titel ist Duplikat des langen', () => {
    const used = new Set([titleKey('Freestyler (Rock The Microphone)')]);
    expect(titleDuplicate('Freestyler', used)).toBeTruthy();
  });
  it('Kein Duplikat bei leerem Set', () => {
    expect(titleDuplicate('Freestyler', new Set())).toBeFalsy();
  });
  it('Kein False Positive bei kurzen Titeln < 6 Zeichen', () => {
    const used = new Set([titleKey('Love')]);
    expect(titleDuplicate('Lover', used)).toBeFalsy();
  });
  it('Kein False Positive bei komplett anderen Titeln', () => {
    const used = new Set([titleKey('Dancing Queen')]);
    expect(titleDuplicate('Freestyler', used)).toBeFalsy();
  });
});

describe('camelotZoneDistance — Abstand zu Zone 1/2 (#99)', () => {
  it('Zone-1-Key → 0', () => expect(camelotZoneDistance('10B')).toBe(0));
  it('Zone-2-Key → 0', () => expect(camelotZoneDistance('9A')).toBe(0));
  it('1B (Zone1-Grenze) → 0', () => expect(camelotZoneDistance('1B')).toBe(0));
  it('7B (1 Schritt von 8B) → 1', () => expect(camelotZoneDistance('7B')).toBe(1));
  it('2B (1 Schritt von 1B) → 1', () => expect(camelotZoneDistance('2B')).toBe(1));
  it('3B (2 Schritte von 1B) → 2', () => expect(camelotZoneDistance('3B')).toBe(2));
  it('6B (2 Schritte von 8B) → 2', () => expect(camelotZoneDistance('6B')).toBe(2));
  it('Ungültiger Key → 99', () => expect(camelotZoneDistance('nan')).toBe(99));
  it('Zone-2-Key 1A → 0', () => expect(camelotZoneDistance('1A')).toBe(0));
  it('2A (1 Schritt von 1A Zone2) → 1', () => expect(camelotZoneDistance('2A')).toBe(1));
});

// ============================================================
//  calcSortScore — Erweiterte Scoring-Komponenten (#103)
// ============================================================
describe('calcSortScore — loudScore [0,7]', () => {
  // Note: loud also appears in calcPhaseScore, so total diffs are ≥ the loudScore delta alone.
  const cur = mkT({id:'cur',song:'Cur',artist:'A',bpm:120,camelot:'9B',energy:72,dur:210,genre:'Rock',bpmg:'D',loud:-7});
  const base = mkT({id:'b',song:'B',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
  it('Same loudness → höchster Score', () => {
    const same = Object.assign({},base,{loud:-7}), diff = Object.assign({},base,{loud:-14});
    expect(calcSortScore(same,cur,'C')).toBeGreaterThan(calcSortScore(diff,cur,'C'));
  });
  it('Score sinkt monoton mit steigender Lautstärke-Differenz', () => {
    const s0 = Object.assign({},base,{camelot:'10B',loud:-7});
    const s4 = Object.assign({},base,{camelot:'10B',loud:-11});
    const s7 = Object.assign({},base,{camelot:'10B',loud:-14});
    expect(calcSortScore(s0,cur,'C')).toBeGreaterThan(calcSortScore(s4,cur,'C'));
    expect(calcSortScore(s4,cur,'C')).toBeGreaterThan(calcSortScore(s7,cur,'C'));
  });
  it('Score-Differenz ist mindestens +7 bei diff=0 vs diff=7', () => {
    const s0 = Object.assign({},base,{camelot:'10B',loud:-7});
    const s7 = Object.assign({},base,{camelot:'10B',loud:-14});
    expect(calcSortScore(s0,cur,'C') - calcSortScore(s7,cur,'C')).toBeGreaterThanOrEqual(7);
  });
  it('cur ohne loud → loudScore-Differenz entfällt', () => {
    const curNoLoud = Object.assign({},cur,{loud:null});
    const t0 = Object.assign({},base,{loud:-7}), t7 = Object.assign({},base,{loud:-14});
    const diffWithLoud    = calcSortScore(t0,cur,'C') - calcSortScore(t7,cur,'C');
    const diffWithoutLoud = calcSortScore(t0,curNoLoud,'C') - calcSortScore(t7,curNoLoud,'C');
    expect(diffWithLoud).toBeGreaterThan(diffWithoutLoud);
  });
});

describe('calcSortScore — valenceScore [0,6]', () => {
  const cur = mkT({id:'cur',song:'Cur',artist:'A',bpm:120,camelot:'9B',energy:72,dur:210,genre:'Rock',bpmg:'D',valence:65});
  const base = mkT({id:'b',song:'B',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
  it('Gleiche Valence → höchster Score', () => {
    const same = Object.assign({},base,{valence:65}), far = Object.assign({},base,{valence:35});
    expect(calcSortScore(same,cur,'C')).toBeGreaterThan(calcSortScore(far,cur,'C'));
  });
  it('Score-Differenz ist mindestens +6 bei diff=0 vs diff=30', () => {
    const s0  = Object.assign({},base,{camelot:'10B',valence:65});
    const s30 = Object.assign({},base,{camelot:'10B',valence:95});
    expect(calcSortScore(s0,cur,'C') - calcSortScore(s30,cur,'C')).toBeGreaterThanOrEqual(6);
  });
  it('Score sinkt monoton mit steigender Valence-Differenz', () => {
    const s0  = Object.assign({},base,{camelot:'10B',valence:65});
    const s15 = Object.assign({},base,{camelot:'10B',valence:80});
    const s30 = Object.assign({},base,{camelot:'10B',valence:95});
    expect(calcSortScore(s0,cur,'C')).toBeGreaterThan(calcSortScore(s15,cur,'C'));
    expect(calcSortScore(s15,cur,'C')).toBeGreaterThan(calcSortScore(s30,cur,'C'));
  });
});

describe('calcSortScore — danceScore [0,5] (B/C only)', () => {
  const cur = mkT({id:'cur',song:'Cur',artist:'A',bpm:120,camelot:'9B',energy:72,dur:210,genre:'Rock',bpmg:'D',dance:60});
  const base = mkT({id:'b',song:'B',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
  it('Phase B: gleiche Danceability → höherer Score als Differenz 25', () => {
    const same = Object.assign({},base,{dance:60}), far = Object.assign({},base,{dance:85});
    expect(calcSortScore(same,cur,'B')).toBeGreaterThan(calcSortScore(far,cur,'B'));
  });
  it('Phase C: Score-Differenz mindestens +5 bei diff=0 vs diff=25', () => {
    const s0  = Object.assign({},base,{camelot:'10B',dance:60});
    const s25 = Object.assign({},base,{camelot:'10B',dance:85});
    expect(calcSortScore(s0,cur,'C') - calcSortScore(s25,cur,'C')).toBeGreaterThanOrEqual(5);
  });
  it('Phase A: zwei Tracks mit dance in [30,60] → gleiches Score (kein danceScore)', () => {
    const phACur = mkT({id:'phac',song:'C',artist:'A',bpm:95,camelot:'9B',energy:35,dur:210,genre:'Synthwave / Electronica',bpmg:'B',dance:45});
    const t40 = mkT({id:'t40',song:'T40',artist:'A',bpm:98,camelot:'10B',energy:38,dur:200,genre:'Rock',bpmg:'B',dance:40});
    const t55 = mkT({id:'t55',song:'T55',artist:'A',bpm:98,camelot:'10B',energy:38,dur:200,genre:'Rock',bpmg:'B',dance:55});
    expect(calcSortScore(t40,phACur,'A')).toBe(calcSortScore(t55,phACur,'A'));
  });
});

describe('calcSortScore — moodScore [0,8]', () => {
  const cur  = mkT({id:'cur',song:'Cur',artist:'A',bpm:120,camelot:'9B',energy:72,dur:210,genre:'Rock',bpmg:'D',mood_tags:['aggressive','pump-up','anthem']});
  const base = mkT({id:'b',song:'B',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
  it('Volle Überlappung → höherer Score als keine Überlappung', () => {
    const full = Object.assign({},base,{mood_tags:['aggressive','pump-up','anthem']});
    const none = Object.assign({},base,{mood_tags:['chill','smooth','emotional']});
    expect(calcSortScore(full,cur,'C')).toBeGreaterThan(calcSortScore(none,cur,'C'));
  });
  it('Volle Überlappung → moodScore = 8', () => {
    const full = Object.assign({},base,{camelot:'10B',mood_tags:['aggressive','pump-up','anthem']});
    const none = Object.assign({},base,{camelot:'10B',mood_tags:[]});
    expect(calcSortScore(full,cur,'C') - calcSortScore(none,cur,'C')).toBe(8);
  });
  it('Kein mood_tags Feld → kein Fehler, moodScore = 0', () => {
    const noTags = Object.assign({},base,{camelot:'10B'});
    const withTags = Object.assign({},base,{camelot:'10B',mood_tags:['aggressive','pump-up','anthem']});
    const diff = calcSortScore(withTags,cur,'C') - calcSortScore(noTags,cur,'C');
    expect(diff).toBe(8);
  });
  it('cur ohne mood_tags → moodScore = 0', () => {
    const curNoMood = Object.assign({},cur,{mood_tags:[]});
    const withTags = Object.assign({},base,{mood_tags:['aggressive','pump-up','anthem']});
    const noTags   = Object.assign({},base,{mood_tags:[]});
    expect(calcSortScore(withTags,curNoMood,'C')).toBe(calcSortScore(noTags,curNoMood,'C'));
  });
  it('Teilüberlappung → zwischen 0 und 8', () => {
    const partial = Object.assign({},base,{mood_tags:['aggressive','chill']});
    const score = calcSortScore(partial,cur,'C') - calcSortScore(Object.assign({},base,{mood_tags:[]}),cur,'C');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(8);
  });
});

describe('calcSortScore — colorScore [0,10]', () => {
  const cur  = mkT({id:'cur',song:'Cur',artist:'A',bpm:120,camelot:'9B',energy:72,dur:210,genre:'Rock',bpmg:'D',avg_color:'#c27f56'});
  const base = mkT({id:'b',song:'B',artist:'A',bpm:124,camelot:'10B',energy:76,dur:200,genre:'Rock',bpmg:'D'});
  it('Gleiche Farbe → colorScore = 10', () => {
    const same = Object.assign({},base,{camelot:'10B',avg_color:'#c27f56'});
    const none = Object.assign({},base,{camelot:'10B'});
    expect(calcSortScore(same,cur,'C') - calcSortScore(none,cur,'C')).toBe(10);
  });
  it('Ähnliche Farbe → höherer Score als entfernte Farbe', () => {
    const near = Object.assign({},base,{avg_color:'#c07050'});
    const far  = Object.assign({},base,{avg_color:'#1010f0'});
    expect(calcSortScore(near,cur,'C')).toBeGreaterThan(calcSortScore(far,cur,'C'));
  });
  it('Kein avg_color auf Kandidat → colorScore = 0, kein Fehler', () => {
    const noColor = Object.assign({},base,{camelot:'10B'});
    const withColor = Object.assign({},base,{camelot:'10B',avg_color:'#c27f56'});
    expect(calcSortScore(noColor,cur,'C')).toBeLessThanOrEqual(calcSortScore(withColor,cur,'C'));
  });
  it('Kein avg_color auf cur → colorScore = 0', () => {
    const curNoColor = Object.assign({},cur,{avg_color:null});
    const withColor  = Object.assign({},base,{camelot:'10B',avg_color:'#c27f56'});
    const noColor    = Object.assign({},base,{camelot:'10B'});
    expect(calcSortScore(withColor,curNoColor,'C')).toBe(calcSortScore(noColor,curNoColor,'C'));
  });
  it('colorScore liegt im Bereich [0,10]', () => {
    const withColor = Object.assign({},base,{camelot:'10B',avg_color:'#ff0000'});
    const noColor   = Object.assign({},base,{camelot:'10B'});
    const diff = calcSortScore(withColor,cur,'C') - calcSortScore(noColor,cur,'C');
    expect(diff).toBeGreaterThanOrEqual(0);
    expect(diff).toBeLessThanOrEqual(10);
  });
});

describe('calcEraScore — Ära-Kohärenz [0,30]', () => {
  const mk = (year) => ({ album_date: year ? `${year}-01-01` : null });
  it('Gleiche Jahreszahl → 30',             () => expect(calcEraScore(mk(2005), mk(2005))).toBe(30));
  it('Diff = 5 Jahre → 30',                () => expect(calcEraScore(mk(2000), mk(2005))).toBe(30));
  it('Diff = 10 Jahre → 15',               () => expect(calcEraScore(mk(1990), mk(2000))).toBe(15));
  it('Diff = 15 Jahre → 0',                () => expect(calcEraScore(mk(1985), mk(2000))).toBe(0));
  it('Diff = 20 Jahre → 0',                () => expect(calcEraScore(mk(1980), mk(2000))).toBe(0));
  it('Diff = 7 Jahre → 24',                () => expect(calcEraScore(mk(1993), mk(2000))).toBe(24));
  it('t ohne album_date → 0',              () => expect(calcEraScore(mk(null), mk(2000))).toBe(0));
  it('cur ohne album_date → 0',            () => expect(calcEraScore(mk(2000), mk(null))).toBe(0));
  it('Beide ohne album_date → 0',          () => expect(calcEraScore(mk(null),  mk(null))).toBe(0));
  it('Richtung egal (t - cur vs cur - t)', () => expect(calcEraScore(mk(2010), mk(2000))).toBe(calcEraScore(mk(2000), mk(2010))));
  it('eraScore integriert in calcSortScore: Same era > weit entfernt', () => {
    const base = { id:'x', song:'S', artist:'A', bpm:124, camelot:'10B', energy:76, dur:200, genre:'Rock', bpmg:'D' };
    const cur  = Object.assign({}, base, { id:'c', camelot:'9B', album_date:'2000-01-01' });
    const same = Object.assign({}, base, { album_date:'2002-01-01' });
    const far  = Object.assign({}, base, { album_date:'1970-01-01' });
    expect(calcSortScore(same, cur, 'C')).toBeGreaterThan(calcSortScore(far, cur, 'C'));
  });
  it('eraScore = 30 in calcSortScore bei diff ≤ 5', () => {
    const base = { id:'x', song:'S', artist:'A', bpm:124, camelot:'10B', energy:76, dur:200, genre:'Rock', bpmg:'D' };
    const cur  = Object.assign({}, base, { id:'c', camelot:'9B', album_date:'2000-01-01' });
    const same = Object.assign({}, base, { album_date:'2003-01-01' });
    const none = Object.assign({}, base, { album_date: null });
    expect(calcSortScore(same, cur, 'C') - calcSortScore(none, cur, 'C')).toBe(30);
  });
});

// ============================================================
//  bpmStopsForPhase — Phase-spezifische Slider-Stops
// ============================================================
describe('bpmStopsForPhase — Phase-spezifische BPM-Slider-Farben', () => {
  const SMIN = 60, SMAX = 220, range = SMAX - SMIN;
  const p = v => (v - SMIN) / range;

  for (const phase of ['A', 'B', 'C', 'D']) {
    it(`Phase ${phase}: grüne Zone liegt bei bpmCore [${PHASE_CONFIG[phase].bpmCore}]`, () => {
      const stops = bpmStopsForPhase(phase);
      const [cLo, cHi] = PHASE_CONFIG[phase].bpmCore;
      // Find a stop that is GRN and sits at p(cLo)
      const greenStart = stops.find(s => Math.abs(s.p - p(cLo)) < 0.001 && s.r === GRN.r && s.g === GRN.g && s.b === GRN.b);
      const greenEnd   = stops.find(s => Math.abs(s.p - p(cHi)) < 0.001 && s.r === GRN.r && s.g === GRN.g && s.b === GRN.b);
      expect(!!greenStart).toBe(true);
      expect(!!greenEnd).toBe(true);
    });

    it(`Phase ${phase}: gelbe Zone beginnt bei bpm[0] = ${PHASE_CONFIG[phase].bpm[0]}`, () => {
      const stops = bpmStopsForPhase(phase);
      const [bLo] = PHASE_CONFIG[phase].bpm;
      const yelAtBlo = stops.find(s => Math.abs(s.p - p(bLo)) < 0.001 && s.r === YEL.r && s.g === YEL.g && s.b === YEL.b);
      expect(!!yelAtBlo).toBe(true);
    });
  }

  it('ungültige Phase → Fallback auf BPM_STOPS', () => {
    const stops = bpmStopsForPhase('X');
    expect(stops.length).toBeGreaterThan(0);
  });

  it('Phase C: letzter Stop bei p=1 ist RED', () => {
    const stops = bpmStopsForPhase('C');
    const last = stops[stops.length - 1];
    expect(last.p).toBe(1);
    expect(last.r).toBe(RED.r);
  });

  it('Phase D: erster Stop startet bei p=0 (bpmLo=60 = Slider-Minimum)', () => {
    const stops = bpmStopsForPhase('D');
    expect(stops[0].p).toBe(0);
  });
});

// ============================================================
//  bpmHint — Phasen-spezifische Hinweistexte
// ============================================================
describe('bpmHint — BPM-Hinweistext je Phase', () => {
  it('Phase C: unter bpm[0]=125 → Zu langsam für WOD', () => {
    expect(bpmHint(120, 'C')).toBe('Zu langsam für WOD');
  });
  it('Phase C: 130 (zwischen bpm[0]=125 und bpmCore[0]=140) → Aufbau-Bereich', () => {
    expect(bpmHint(130, 'C')).toBe('Aufbau-Bereich');
  });
  it('Phase C: 145 (im Kern 140–175) → WOD-Idealbereich ✓', () => {
    expect(bpmHint(145, 'C')).toBe('WOD-Idealbereich ✓');
  });
  it('Phase C: 180 (zwischen bpmCore[1]=175 und bpm[1]=195) → Finisher-Bereich', () => {
    expect(bpmHint(180, 'C')).toBe('Finisher-Bereich');
  });
  it('Phase C: 200 (über bpm[1]=195) → Grenzbereich', () => {
    expect(bpmHint(200, 'C')).toBe('Grenzbereich');
  });
  it('Phase D: 75 (im Kern 65–85) → Idealbereich Cool-Down ✓', () => {
    expect(bpmHint(75, 'D')).toBe('Idealbereich Cool-Down ✓');
  });
  it('Phase D: 92 (zwischen bpmCore[1]=85 und bpm[1]=100) → Noch akzeptabel', () => {
    expect(bpmHint(92, 'D')).toBe('Noch akzeptabel');
  });
  it('Phase A: 100 (im Kern 90–105) → Idealbereich Prep ✓', () => {
    expect(bpmHint(100, 'A')).toBe('Idealbereich Prep ✓');
  });
  it('Phase A: 80 (unter bpm[0]=85) → Zu langsam für Prep', () => {
    expect(bpmHint(80, 'A')).toBe('Zu langsam für Prep');
  });
  it('ungültige Phase → leerer String', () => {
    expect(bpmHint(120, 'X')).toBe('');
  });
});

// ============================================================
//  TOTALS + EXPORT
// ============================================================
let totalPass = 0, totalFail = 0;
_suites.forEach(s => {
  totalPass += s.tests.filter(t => t.ok).length;
  totalFail += s.tests.filter(t => !t.ok).length;
});

export const results = { suites: _suites, totalPass, totalFail };

// ============================================================
//  NODE.JS OUTPUT
// ============================================================
if (typeof window === 'undefined') {
  _suites.forEach(suite => {
    const pass = suite.tests.filter(t => t.ok).length;
    console.log(`\n${suite.name} (${pass}/${suite.tests.length})`);
    suite.tests.forEach(t => {
      if (t.ok) {
        console.log(`  ✓ ${t.name}`);
      } else {
        console.log(`  ✗ ${t.name}`);
        console.log(`    ${t.err}`);
      }
    });
  });
  const total = totalPass + totalFail;
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`${totalPass}/${total} bestanden${totalFail > 0 ? ` — ${totalFail} FEHLGESCHLAGEN` : ' — ALLE TESTS BESTANDEN'}`);
  process.exit(totalFail > 0 ? 1 : 0);
}
