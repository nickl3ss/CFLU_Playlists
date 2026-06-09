// app.js — UI wiring only; no business logic here — delegate to algorithm.js, spotify.js, chart.js etc.
import { PHASE_CONFIG, MIN_POOL_SIZE, BPM_STOPS, JUMP_STOPS,
         POS_BPM, CAM_COLOR, CAM_ZONE1, CAM_ZONE2, DUR_STEPS } from './config.js';
import { getNeighbours } from './genres.js';
import { state } from './state.js';
import { titleKey, fmtDur, fmtMin, lerpColor, toHex, camCompat, calcPhaseScore } from './utils.js';
import { getAllTracks, getPool, getPhasePool, getPhasePoolWithNeighbours, getGenreStats,
         registerTrack, addTrack, pickNext, buildUp, buildDown,
         buildPlateau, buildDecreasing, buildAlternating } from './algorithm.js';
import { drawChart, highlightFromRow, clearHighlight } from './chart.js';
import { spotifyLogin, spotifyLogout, checkSpotifyCallback, exportPlaylist } from './spotify.js';

// ===== SLIDER UI =====
function updateSliderStyle(slider, stops, minV, maxV) {
  const t = (+slider.value - minV) / (maxV - minV);
  const c = lerpColor(t, stops);
  const hex = toHex(c);
  const gradStops = stops.map(s => toHex(s) + ' ' + Math.round(s.p * 100) + '%').join(',');
  slider.style.background = `linear-gradient(90deg,${gradStops})`;
  slider.style.setProperty('--thumb-color', hex);
  return c;
}
function bpmHint(v) {
  if (v < 90) return 'Zu langsam für WOD';
  if (v < 110) return 'Warm-Up Zone';
  if (v < 120) return 'Moderat';
  if (v <= 170) return 'WOD-Idealbereich ✓';
  if (v <= 185) return 'Hoch — gut für Finisher';
  if (v <= 199) return 'Sehr hoch';
  return 'Grenzbereich';
}
function jumpHint(v) {
  if (v <= 5) return 'Standard ✓ (DJ-Norm ≤5 BPM)';
  if (v <= 8) return 'Akzeptabel (≤5 % bei 160 BPM)';
  if (v <= 12) return 'Sprunghaft — Übergänge hörbar';
  return 'Harte Sprünge möglich';
}

// ===== LOGIN MODAL =====

export function showLoginModal() {
  document.getElementById('login-modal').style.display = 'flex';
  document.getElementById('modal-sp-cid').focus();
}

export function closeLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
}

function modalConnect() {
  const cid = document.getElementById('modal-sp-cid').value.trim();
  if (!cid) {
    const s = document.getElementById('modal-sp-status');
    s.textContent = 'Bitte Client ID eingeben.';
    s.className = 'sp-status error';
    s.style.display = 'block';
    document.getElementById('modal-sp-cid').focus();
    return;
  }
  document.getElementById('sp-cid').value = cid;
  closeLoginModal();
  spotifyLogin();
}

// ===== CAMELOT FILTER =====

// Parses "8 9 10", "8-11", "11-2" (wrap-around 12→1), "1,3,5" → number array
function parseCamNumbers(input) {
  const str = input.trim();
  if (!str) return [];
  const result = [], seen = new Set();
  const addN = n => { if (n >= 1 && n <= 12 && !seen.has(n)) { seen.add(n); result.push(n); } };
  for (const part of str.split(/[\s,]+/).filter(Boolean)) {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) {
      let cur = parseInt(m[1], 10); const end = parseInt(m[2], 10);
      if (cur < 1 || cur > 12 || end < 1 || end > 12) continue;
      for (let i = 0; i <= 12; i++) { addN(cur); if (cur === end) break; cur = cur === 12 ? 1 : cur + 1; }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) addN(n);
    }
  }
  return result;
}

function applyCamFilter(tracks) {
  const { camLetter, camNumbers } = state;
  if (camLetter === 'both' && camNumbers.length === 0) return tracks;
  return tracks.filter(t => {
    if (!t.camelot || t.camelot === 'nan') return false;
    if (camLetter !== 'both' && t.camelot.slice(-1).toUpperCase() !== camLetter) return false;
    if (camNumbers.length > 0 && !camNumbers.includes(parseInt(t.camelot, 10))) return false;
    return true;
  });
}

function updateCamHint() {
  const { camLetter, camNumbers } = state;
  const badge = document.getElementById('cam-filter-badge');
  const hint  = document.getElementById('cam-hint');
  const inactive = camLetter === 'both' && camNumbers.length === 0;

  if (inactive) { badge.style.display = 'none'; hint.textContent = ''; return; }

  const badgeParts = [];
  if (camLetter !== 'both') badgeParts.push(camLetter);
  if (camNumbers.length > 0) badgeParts.push(camNumbers.join(' '));
  badge.textContent = badgeParts.join(' · ');
  badge.style.display = '';

  // Show resulting Camelot keys as compact hint
  const letters = camLetter === 'both' ? ['A','B'] : [camLetter];
  const nums    = camNumbers.length > 0 ? camNumbers : [1,2,3,4,5,6,7,8,9,10,11,12];
  const keys    = [];
  for (const n of nums) for (const l of letters) keys.push(n + l);
  hint.textContent = keys.length > 10 ? keys.slice(0,10).join(' ') + ' …' : keys.join(' ');
}

function updateCamLockRow() {
  const active = !(state.camLetter === 'both' && state.camNumbers.length === 0);
  const row = document.getElementById('cam-lock-row');
  row.style.opacity = active ? '' : '.4';
  row.style.pointerEvents = active ? '' : 'none';
  if (!active) {
    state.lockCamFilter = false;
    document.getElementById('cam-lock-toggle').checked = false;
  }
}

function onCamLetterSlider(el) {
  state.camLetter = ['A','both','B'][+el.value];
  updateCamHint();
  updateCamLockRow();
  updateFilterList();
  if (state.selMode === 'direct') onDirectSearch();
}

function onCamNumbers() {
  const el = document.getElementById('cam-numbers');
  state.camNumbers = parseCamNumbers(el.value);
  document.getElementById('clear-cam-numbers').style.display = el.value ? '' : 'none';
  updateCamHint();
  updateCamLockRow();
  updateFilterList();
  if (state.selMode === 'direct') onDirectSearch();
}

// ===== PHASE SELECT =====
function onPhaseSelect(phase) {
  state.currentPhase = phase;
  ['A','B','C','D'].forEach(p => document.getElementById('phase-' + p).classList.toggle('active', p === phase));
  const cfg = PHASE_CONFIG[phase];
  state.wodEnergyMin = cfg.energy ? cfg.energy[0] : 0;
  state.wodEnergyMax = cfg.energy ? cfg.energy[1] : 100;
  state.maxJump = cfg.maxJumpDefault;
  const bpmEl = document.getElementById('bpm-slider');
  bpmEl.value = cfg.bpmDefault;
  onBpmSlider(bpmEl);
  const tolEl = document.getElementById('bpm-tol');
  tolEl.value = cfg.tolDefault;
  document.getElementById('bpm-tol-badge').textContent = '±' + cfg.tolDefault;
  state.bpmTol = cfg.tolDefault;
  const jumpEl = document.getElementById('jump-slider');
  jumpEl.value = cfg.maxJumpDefault;
  onJumpSlider(jumpEl);
  const step2 = document.getElementById('step2');
  if (cfg.positionVisible) {
    step2.style.display = '';
  } else {
    step2.style.display = 'none';
    if (phase === 'A') setPosition('plateau');
    if (phase === 'D') setPosition('start');
  }
  if (phase === 'D') {
    state.wodMinutes = 15;
    document.getElementById('dur-slider').value = DUR_STEPS.indexOf(15);
    document.getElementById('dur-badge').textContent = '15 min';
  }
  updateFilterList();
  updateAmpel();
  checkPoolAndWarn();
}

function checkPoolAndWarn() {
  const genre = state.poolGenre || document.getElementById('genre-sel').value;
  const pool = getPhasePool(genre, state.currentPhase);
  const warn = document.getElementById('pool-warn');
  if (pool.length < MIN_POOL_SIZE) {
    const neighbours = getNeighbours(genre);
    warn.textContent = `Nur ${pool.length} Tracks für Phase ${state.currentPhase} in "${genre}".`
      + (neighbours.length ? ` Fallback auf: ${neighbours.slice(0, 2).join(', ')} möglich.` : '');
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }
}

// ===== SELECTION MODE =====
function setSelMode(m) {
  state.selMode = m;
  ['filter','direct','link'].forEach(x => {
    document.getElementById('tab-' + x).classList.toggle('active', x === m);
    document.getElementById('sel-' + x).classList.toggle('section-hidden', x !== m);
  });
}

// ===== GENRE & BPM FILTER =====
function onGenreChange() {
  state.poolGenre = document.getElementById('genre-sel').value;
  updatePoolGenreBadge();
  updateFilterList();
}

function onBpmSlider(el) {
  const c = updateSliderStyle(el, BPM_STOPS, 60, 220);
  const v = +el.value;
  document.getElementById('bpm-val-display').textContent = v + ' BPM';
  document.getElementById('bpm-val-display').style.color = toHex(c);
  document.getElementById('bpm-hint-display').textContent = bpmHint(v);
  updateFilterList();
}

function onBpmTol(el) {
  state.bpmTol = +el.value;
  document.getElementById('bpm-tol-badge').textContent = '±' + state.bpmTol;
  updateFilterList();
}

function updateFilterList() {
  const genre = document.getElementById('genre-sel').value;
  const bpmTarget = +document.getElementById('bpm-slider').value;
  const q = document.getElementById('filter-search').value.toLowerCase();
  const pool = getPool(genre);
  let filtered = pool.filter(t => Math.abs(t.bpm - bpmTarget) <= state.bpmTol && t.energy >= state.wodEnergyMin && t.energy <= state.wodEnergyMax);
  if (q) filtered = filtered.filter(t => t.song.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q));
  filtered = applyCamFilter(filtered);
  filtered.sort((a, b) => {
    const ps = calcPhaseScore(b, state.currentPhase) - calcPhaseScore(a, state.currentPhase);
    return ps || a.bpm - b.bpm;
  });
  const sel = document.getElementById('filter-list');
  sel.innerHTML = '';
  filtered.forEach(t => {
    const ps = calcPhaseScore(t, state.currentPhase);
    const o = document.createElement('option');
    o.value = t.id || t.song;
    o.textContent = `[${ps}] ${t.artist} — ${t.song} — ${t.bpm} BPM — ${t.camelot} — E:${t.energy}`;
    o._track = t;
    sel.appendChild(o);
  });
  document.getElementById('filter-count').textContent = filtered.length + ' Tracks';
  document.getElementById('genre-count-badge').textContent = pool.length;
  onLenChange();
  checkPoolAndWarn();
}

// ===== DIRECT SEARCH =====
function onDirectSearch() {
  const q = document.getElementById('direct-search').value.toLowerCase().trim();
  const sel = document.getElementById('direct-list');
  sel.innerHTML = '';
  if (q.length < 2) { document.getElementById('direct-count').textContent = 'Mind. 2 Zeichen eingeben'; return; }
  const genrePool = getPool('Going Wild');
  const res = genrePool.filter(t =>
    t.song.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  ).sort((a, b) => {
    const ps = calcPhaseScore(b, state.currentPhase) - calcPhaseScore(a, state.currentPhase);
    return ps || a.bpm - b.bpm;
  }).slice(0, 80);
  res.forEach(t => {
    const ps = calcPhaseScore(t, state.currentPhase);
    const o = document.createElement('option');
    o.value = t.id || t.song;
    o.textContent = `[${ps}] ${t.artist} — ${t.song} — ${t.bpm} BPM — ${t.camelot} — E:${t.energy}`;
    o._track = t;
    sel.appendChild(o);
  });
  document.getElementById('direct-count').textContent = res.length + ' Ergebnisse';
}

// ===== LINK INPUT =====
function onLinkInput() {
  const url = document.getElementById('link-input').value.trim();
  const m = url.match(/track\/([a-zA-Z0-9]+)/);
  if (!m) { document.getElementById('link-status').textContent = ''; return; }
  const tid = m[1];
  const allTracks = getPool('Going Wild');
  const found = allTracks.find(t => t.id === tid);
  if (found) {
    document.getElementById('link-status').textContent = `✓ ${found.artist} — ${found.song}`;
    document.getElementById('link-manual').classList.add('section-hidden');
    selectTrack(found);
  } else {
    document.getElementById('link-status').textContent = 'Nicht in Pool — bitte Daten eingeben';
    document.getElementById('link-manual').classList.remove('section-hidden');
    document.getElementById('manual-genre').value = '';
    state.poolGenre = '';
    updatePoolGenreBadge();
    const ext = {id: tid, song: '[Externer Track]', artist: '', bpm: 0, camelot: '', energy: 0, dur: 210, genre: '', bpmg: 'D', external: true};
    selectTrack(ext, true);
  }
}

function onManualGenreChange() {
  state.poolGenre = document.getElementById('manual-genre').value;
  updatePoolGenreBadge();
  updateGenBtn();
}

// ===== TRACK SELECT =====
function updatePoolGenreBadge() {
  const el = document.getElementById('sel-pool-genre');
  if (!el) return;
  if (state.poolGenre) {
    el.textContent = 'Pool: ' + state.poolGenre;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function onTrackSelect(sel) {
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const allTracks = getPool('Going Wild');
  const t = opt._track || allTracks.find(x => (x.id && x.id === opt.value) || x.song === opt.value);
  if (t) selectTrack(t);
}

function selectTrack(t, external = false) {
  state.selectedTrack = {...t};
  if (external) {
    state.selectedTrack.bpm    = +document.getElementById('manual-bpm').value || 128;
    state.selectedTrack.energy = +document.getElementById('manual-energy').value || 75;
    state.selectedTrack.camelot = document.getElementById('manual-camelot').value || '';
  }
  document.getElementById('sel-title').textContent  = state.selectedTrack.song;
  document.getElementById('sel-artist').textContent = state.selectedTrack.artist;
  document.getElementById('sel-bpm').textContent    = state.selectedTrack.bpm + ' BPM';
  document.getElementById('sel-cam').textContent    = state.selectedTrack.camelot || '—';
  document.getElementById('sel-eng').textContent    = 'E:' + state.selectedTrack.energy;
  document.getElementById('sel-genre').textContent  = state.selectedTrack.genre;
  const spLink = document.getElementById('sel-sp-link');
  const embed  = document.getElementById('sel-sp-embed');
  const hasId  = state.selectedTrack.id && state.selectedTrack.id !== '' && state.selectedTrack.id !== 'nan';
  spLink.href         = hasId ? 'https://open.spotify.com/track/' + state.selectedTrack.id : '#';
  spLink.style.display = hasId ? 'inline-flex' : 'none';
  embed.src           = hasId ? 'https://open.spotify.com/embed/track/' + state.selectedTrack.id + '?utm_source=generator&theme=0' : '';
  embed.style.display  = hasId ? 'block' : 'none';
  document.getElementById('selected-display').classList.remove('section-hidden');
  state.poolGenre = external ? '' : (t.genre || '');
  updatePoolGenreBadge();
  enableSteps();
  updateAmpel();
  updateGenBtn();
}

function enableSteps() {
  const s2 = document.getElementById('step2');
  const s3 = document.getElementById('step3');
  s2.style.opacity = '1'; s2.style.pointerEvents = 'auto';
  s3.style.opacity = '1'; s3.style.pointerEvents = 'auto';
}

// ===== POSITION =====
function setPosition(p) {
  state.position = p;
  ['start','end','mid','plateau'].forEach(x => document.getElementById('pos-' + x).classList.toggle('active', x === p));
  updateAmpel();
  updateGenBtn();
}

// ===== AMPEL =====
function rateColor(val, ranges) {
  const {green, yellow} = ranges;
  if (val >= green[0] && val <= green[1]) return 'green';
  for (const [lo, hi] of yellow) if (val >= lo && val <= hi) return 'yellow';
  return 'red';
}

function updateAmpel() {
  if (!state.selectedTrack) return;
  const bpm = state.selectedTrack.bpm;
  const cam = state.selectedTrack.camelot || '';
  const bpmRating  = rateColor(bpm, POS_BPM[state.position] || POS_BPM.start);
  const camZone    = CAM_ZONE1.has(cam) ? 'green' : CAM_ZONE2.has(cam) ? 'yellow' : 'red';
  const overall    = bpmRating === 'green' && camZone === 'green' ? 'green' :
                     bpmRating === 'red'   || camZone === 'red'   ? 'red'   : 'yellow';
  const ps         = calcPhaseScore(state.selectedTrack, state.currentPhase);
  const phaseRating = ps >= 80 ? 'green' : ps >= 50 ? 'yellow' : 'red';
  const colorMap = {green: '#1db954', yellow: '#f7c948', red: '#f15e6c'};
  document.getElementById('amp-bpm-dot').style.background   = colorMap[bpmRating];
  document.getElementById('amp-cam-dot').style.background   = colorMap[camZone];
  document.getElementById('amp-ges-dot').style.background   = colorMap[overall];
  document.getElementById('amp-phase-dot').style.background = colorMap[phaseRating];
  document.getElementById('amp-bpm-val').textContent   = bpm + ' BPM';
  document.getElementById('amp-cam-val').textContent   = cam || '—';
  document.getElementById('amp-ges-val').textContent   = overall === 'green' ? 'Gut' : overall === 'yellow' ? 'Ok' : 'Prüfen';
  document.getElementById('amp-phase-val').textContent = ps + '%';
  const hints = [];
  if (bpmRating === 'red')   hints.push('BPM für ' + state.position + '-Position ungeeignet');
  if (camZone === 'red')     hints.push('Camelot in schwacher Zone');
  if (phaseRating === 'red') hints.push('Phase ' + state.currentPhase + ' Fit niedrig (' + ps + '%)');
  if (!hints.length)         hints.push('Gute Wahl für Phase ' + state.currentPhase + ' ✓');
  document.getElementById('ampel-hint').textContent = hints.join(' · ');
}

// ===== SETTINGS =====
function onDurSlider(el) {
  const min = DUR_STEPS[+el.value];
  state.wodMinutes = min;
  document.getElementById('dur-badge').textContent = min + ' min';
  onLenChange();
}
function onLenChange() {
  const genre = document.getElementById('genre-sel').value;
  const stats = (getGenreStats()[genre]) || {avg_dur: 210};
  const est = Math.round((state.wodMinutes * 60) / Math.max(stats.avg_dur, 60));
  document.getElementById('est-tracks').textContent = '≈ ' + est + ' Tracks geschätzt';
}
function onXfadeSlider(el) {
  state.crossfadeSec = +el.value;
  document.getElementById('xfade-badge').textContent = el.value + ' s';
}
function onJumpSlider(el) {
  const c = updateSliderStyle(el, JUMP_STOPS, 5, 20);
  state.maxJump = +el.value;
  document.getElementById('jump-badge').textContent = '+' + el.value;
  document.getElementById('jump-val-display').textContent = '+' + el.value + ' BPM';
  document.getElementById('jump-val-display').style.color = toHex(c);
  document.getElementById('jump-hint-display').textContent = jumpHint(+el.value);
}
function onCdToggle() {
  state.cdActive = document.getElementById('cd-toggle').checked;
  document.getElementById('cd-dur-wrap').classList.toggle('section-hidden', !state.cdActive);
}
function onCdDurSlider(el) {
  const min = DUR_STEPS[+el.value];
  state.cdMinutes = min;
  document.getElementById('cd-dur-badge').textContent = min + ' min';
}
function updateGenBtn() {
  document.getElementById('gen-btn').disabled = !(state.selectedTrack && state.selectedTrack.bpm > 0);
}

// ===== SEARCH UTILS =====
function clearSearch(id) {
  document.getElementById(id).value = '';
  if (id === 'filter-search') updateFilterList();
  else if (id === 'direct-search') {
    document.getElementById('direct-list').innerHTML = '';
    document.getElementById('direct-count').textContent = 'Mind. 2 Zeichen eingeben';
  }
}

// ===== GENERATION LOG =====
function buildGenLog(genre, wod, cd, warnMsgs) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE') + '  ' + now.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
  const phase = state.currentPhase;
  const phaseCfg = PHASE_CONFIG[phase];
  const ref = state.selectedTrack;
  const SEP = '='.repeat(68);
  const sep = '-'.repeat(68);
  const L = [];
  const add = s => L.push(s);
  const pad = (s, n) => String(s).slice(0, n).padEnd(n);
  const rpad = (s, n) => String(s).slice(0, n).padStart(n);

  add(SEP);
  add(`  CFLU WOD PLAYLIST LOG  —  ${dateStr}`);
  add(SEP);
  add('');
  add('EINSTELLUNGEN');
  add(`  Phase:           ${phase} — ${phaseCfg?.label || ''}`);
  add(`  Genre:           ${genre}`);
  if (ref) {
    const ps = calcPhaseScore(ref, phase);
    add(`  Referenz-Song:   ${ref.artist} — ${ref.song}`);
    add(`                   ${ref.bpm} BPM  |  Camelot: ${ref.camelot}  |  Energy: ${ref.energy}  |  Phase-Score: ${ps}`);
  }
  if (phaseCfg?.positionVisible) {
    const posLabels = {start: 'Start', end: 'Ende', mid: 'Midpoint', plateau: 'Mid Plateau'};
    add(`  Position:        ${posLabels[state.position] || state.position}`);
  }
  add(`  WOD-Dauer:       ${state.wodMinutes} min`);
  if (state.crossfadeSec > 0) add(`  Crossfade:       ${state.crossfadeSec}s (Spotify Mixing)`);
  const bpmTarget = +document.getElementById('bpm-slider').value;
  add(`  Ziel-BPM:        ${bpmTarget} BPM  ±${state.bpmTol}`);
  add(`  Max BPM-Sprung:  +${state.maxJump} BPM`);
  add(`  Energy-Bereich:  ${state.wodEnergyMin}–${state.wodEnergyMax}`);
  if (state.cdActive) add(`  Cool-Down:       aktiv · ${state.cdMinutes} min`);
  if (state.camLetter !== 'both' || state.camNumbers.length > 0) {
    const parts = [];
    if (state.camLetter !== 'both') parts.push('Buchstabe: ' + state.camLetter);
    if (state.camNumbers.length > 0) parts.push('Zahlen: ' + state.camNumbers.join(' '));
    add(`  Tonart-Filter:   ${parts.join('  ·  ')}`);
  }
  add('');
  add(sep);
  add('POOL');
  const directPool = getPhasePool(genre, phase);
  const fullPool   = getPhasePoolWithNeighbours(genre, phase);
  add(`  Phase-${phase}-Pool (${genre}):  ${directPool.length} Tracks`);
  if (fullPool.length > directPool.length)
    add(`  Mit Nachbar-Genres:              ${fullPool.length} Tracks`);
  warnMsgs.forEach(w => add(`  ! ${w}`));
  add('');
  add(sep);

  // Track table
  const refId = ref ? (ref.id || ref.song) : null;
  add('TRACKS');
  add(`${rpad('#',3)}  ${pad('Titel',30)}  ${pad('Artist',20)}  ${rpad('BPM',3)}  ${rpad('DBPM',5)}  ${pad('Cam',5)}  ${rpad('E',3)}  ${rpad('FS',3)}  Entscheidung`);
  add('-'.repeat(100));
  wod.forEach((t, i) => {
    const prev  = i > 0 ? wod[i - 1] : null;
    const delta = prev ? ((t.bpm >= prev.bpm ? '+' : '') + (t.bpm - prev.bpm)) : 'REF';
    const cc    = prev ? camCompat(prev.camelot, t.camelot) : null;
    const ccSym = cc === 'green' ? '+' : cc === 'yellow' ? '~' : cc === 'red' ? '-' : ' ';
    const camStr = pad((t.camelot || '—') + ' ' + ccSym, 5);
    const ps    = calcPhaseScore(t, phase);
    const isRef = (t.id && t.id === refId) || (t.song === ref?.song && t.artist === ref?.artist);
    let reason  = '';
    if (isRef) {
      reason = '[Referenz-Song]';
    } else if (prev && cc) {
      const zone  = CAM_ZONE1.has(t.camelot) ? ' Zone1' : CAM_ZONE2.has(t.camelot) ? ' Zone2' : '';
      if      (cc === 'green')  reason = 'Camelot +' + zone;
      else if (cc === 'yellow') reason = 'Camelot ~';
      else {
        reason = 'Fallback (BPM-Eskalation)';
        if (prev && t.bpm <= prev.bpm) reason += '  ⚠ kein BPM-Fortschritt';
      }
    }
    if (t.genre) reason += (reason ? '  | ' : '') + `Genre: ${t.genre}${!isRef && t.genre !== genre ? ' (Fallback)' : ''}`;
    add(`${rpad(i+1,3)}  ${pad(t.song,30)}  ${pad(t.artist,20)}  ${rpad(t.bpm,3)}  ${rpad(delta,5)}  ${camStr}  ${rpad(t.energy,3)}  ${rpad(ps,3)}  ${reason}`);
  });

  if (cd.length) {
    add('');
    add(`--- Cool-Down (${state.cdMinutes} min) ---`);
    add(`${rpad('#',3)}  ${pad('Titel',30)}  ${pad('Artist',20)}  ${rpad('BPM',3)}  ${pad('Cam',5)}  ${rpad('E',3)}  ${rpad('FS',3)}`);
    add('-'.repeat(75));
    cd.forEach((t, i) => {
      const ps = calcPhaseScore(t, 'D');
      const genreStr = t.genre ? `  | Genre: ${t.genre}` : '';
      add(`${rpad(wod.length+i+1,3)}  ${pad(t.song,30)}  ${pad(t.artist,20)}  ${rpad(t.bpm,3)}  ${pad(t.camelot||'—',5)}  ${rpad(t.energy,3)}  ${rpad(ps,3)}${genreStr}`);
    });
  }

  add('');
  add(sep);
  add('ZUSAMMENFASSUNG');
  const wodSec = wod.reduce((s, t) => s + t.dur, 0);
  const cdSec  = cd.reduce((s, t) => s + t.dur, 0);
  const bpms   = wod.map(t => t.bpm);
  let cG = 0, cY = 0, cR = 0;
  for (let i = 1; i < wod.length; i++) {
    const c = camCompat(wod[i-1].camelot, wod[i].camelot);
    if (c === 'green') cG++; else if (c === 'yellow') cY++; else cR++;
  }
  const avgEng = wod.length ? Math.round(wod.reduce((s, t) => s + t.energy, 0) / wod.length) : 0;
  const xfadeLog = state.crossfadeSec || 0;
  const effectiveLog = xfadeLog > 0 && wod.length > 1 ? Math.max(0, wodSec - (wod.length - 1) * xfadeLog) : wodSec;
  const durStr = xfadeLog > 0
    ? `${fmtDur(wodSec)} roh  ·  ${fmtMin(effectiveLog)} effektiv`
    : fmtDur(wodSec);
  add(`  WOD:        ${wod.length} Tracks  ·  ${durStr}  ·  BPM ${bpms[0]||0} → ${bpms[bpms.length-1]||0}`);
  if (cd.length) {
    const cdBpms = cd.map(t => t.bpm);
    add(`  Cool-Down:  ${cd.length} Tracks  ·  ${fmtDur(cdSec)}  ·  BPM ${cdBpms[0]||0} → ${cdBpms[cdBpms.length-1]||0}`);
  }
  add(`  Camelot:    ${cG}x grün (+)  ·  ${cY}x gelb (~)  ·  ${cR}x rot (-)`);
  add(`  Ø Energy:   ${avgEng}`);
  add('');
  add(SEP);
  return L.join('\n');
}

// ===== GENERATE =====
function generatePlaylist() {
  const btn = document.getElementById('gen-btn');
  btn.disabled = true; btn.textContent = 'Generiere...';
  setTimeout(() => {
    try { _gen(); } catch (e) { console.error(e); alert('Fehler: ' + e.message); }
    finally { btn.disabled = false; btn.textContent = '▶ Playlist generieren'; }
  }, 50);
}

function _gen() {
  if (!state.selectedTrack || state.selectedTrack.bpm <= 0) { alert('Bitte Song wählen.'); return; }
  if (!state.poolGenre) { alert('Bitte Pool-Genre wählen.'); return; }
  const genre = state.poolGenre;
  const pool = getPhasePoolWithNeighbours(genre, state.currentPhase);
  const targetSec = state.wodMinutes * 60;
  const crossfadeSec = state.crossfadeSec || 0;
  const avgDur = Math.max(60, (getGenreStats()[genre] || {avg_dur: 210}).avg_dur);
  const estTracks = Math.max(1, Math.round(targetSec / avgDur));
  const rawTargetSec = crossfadeSec > 0
    ? targetSec + Math.max(0, estTracks - 1) * crossfadeSec
    : targetSec;
  const usedIds = new Set(), usedTitleKeys = new Set(), usedArtists = new Map();
  let wod = [];
  const ref = state.selectedTrack;

  if (state.currentPhase === 'A') {
    wod = buildPlateau(pool, ref.bpm, usedIds, usedTitleKeys, usedArtists, rawTargetSec);
    if (!usedIds.has(ref.id || ref.song)) { wod.unshift(ref); registerTrack(ref, usedIds, usedTitleKeys, usedArtists); }

  } else if (state.currentPhase === 'D') {
    registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
    wod = [ref, ...buildDecreasing(pool, ref.bpm, usedIds, usedTitleKeys, usedArtists, rawTargetSec - ref.dur)];

  } else {
    if (state.position === 'start') {
      wod = buildUp(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec, 0);

    } else if (state.position === 'end') {
      const half = Math.round((rawTargetSec / 2) / (ref.dur || 210));
      registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
      const before = buildDown(pool, ref, usedIds, usedTitleKeys, usedArtists, half + 5);
      const beforePool = pool.filter(t => !usedIds.has(t.id || t.song) && t.bpm <= ref.bpm && t.energy >= state.wodEnergyMin && t.energy <= state.wodEnergyMax);
      const totalBefore = rawTargetSec - ref.dur;
      let durSoFar = before.reduce((s, t) => s + t.dur, 0);
      let cur = before.length ? before[before.length - 1] : null;
      if (cur) {
        while (durSoFar < totalBefore - 60) {
          const next = pickNext(beforePool, cur, usedIds, usedTitleKeys, usedArtists, 30);
          if (!next) break;
          addTrack(next, before, usedIds, usedTitleKeys, usedArtists);
          durSoFar += next.dur; cur = next;
        }
      }
      wod = [...before, ref];

    } else if (state.position === 'mid') {
      registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
      wod = buildAlternating(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec);

    } else if (state.position === 'plateau') {
      const halfSec = Math.floor(rawTargetSec / 2);
      registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
      const before = buildDown(pool, ref, usedIds, usedTitleKeys, usedArtists, Math.ceil(halfSec / (ref.dur || 210)));
      const after = [];
      const platCands = pool.filter(t =>
        !usedIds.has(t.id || t.song) &&
        Math.abs(t.bpm - ref.bpm) <= 12 &&
        (!titleKey(t.song) || !usedTitleKeys.has(titleKey(t.song))) &&
        t.energy >= state.wodEnergyMin && t.energy <= state.wodEnergyMax
      ).sort((a, b) => calcPhaseScore(b, state.currentPhase) - calcPhaseScore(a, state.currentPhase));
      let platDur = 0;
      for (const t of platCands) {
        if (platDur >= halfSec) break;
        addTrack(t, after, usedIds, usedTitleKeys, usedArtists);
        platDur += t.dur;
      }
      wod = [...before, ref, ...after];
    }
  }

  // Cool-Down
  const cd = [];
  const warnMsgs = [];
  if (state.cdActive) {
    const maxWodBpm = wod.length ? Math.max(...wod.map(t => t.bpm)) : 100;
    const cdBpmMax = state.currentPhase === 'D' ? Math.floor(maxWodBpm * 0.85) : Math.floor(maxWodBpm * 0.7);
    const cdEnergyMax = state.currentPhase === 'D' ? 40 : ((getGenreStats()[genre] || {avg_energy: 70}).avg_energy);
    let cdPool = getPhasePoolWithNeighbours(genre, 'D').filter(t => !usedIds.has(t.id || t.song) && t.bpm <= cdBpmMax && t.energy <= cdEnergyMax);
    if (cdPool.length < 3) {
      for (const nb of getNeighbours(genre)) {
        cdPool = [...cdPool, ...getPhasePool(nb, 'D').filter(t => !usedIds.has(t.id || t.song) && t.bpm <= cdBpmMax && t.energy <= cdEnergyMax)];
        if (cdPool.length >= 3) { warnMsgs.push(`Cool-Down: Nachbar-Genre "${nb}" ergänzt`); break; }
      }
    }
    cdPool.sort((a, b) => calcPhaseScore(b, 'D') - calcPhaseScore(a, 'D') || a.bpm - b.bpm);
    let cdSec = 0;
    for (const t of cdPool) {
      if (cdSec >= state.cdMinutes * 60) break;
      addTrack(t, cd, usedIds, usedTitleKeys, usedArtists);
      cdSec += t.dur;
    }
  }

  usedArtists.forEach((cnt, ak) => {
    if (cnt > Math.max(1, Math.floor(wod.length * 0.1)) + 1)
      warnMsgs.push(`"${ak}" mehrfach in Playlist (${cnt}×)`);
  });

  state.generatedWod = wod;
  state.generatedCd  = cd;
  const logText = buildGenLog(genre, wod, cd, warnMsgs);
  renderResult(genre, wod, cd, warnMsgs, logText);
}

// ===== RENDER =====
function renderResult(genre, wod, cd, warns, logText) {
  const all = [...wod, ...cd];
  const wodSec = wod.reduce((s, t) => s + t.dur, 0);
  const cdSec  = cd.reduce((s, t) => s + t.dur, 0);
  const xfade  = state.crossfadeSec || 0;
  const effectiveSec = xfade > 0 && wod.length > 1 ? Math.max(0, wodSec - (wod.length - 1) * xfade) : wodSec;
  const bpms   = wod.map(t => t.bpm);
  const avgEng = wod.length ? Math.round(wod.reduce((s, t) => s + t.energy, 0) / wod.length) : 0;
  let camG = 0, camY = 0, camR = 0;
  for (let i = 1; i < wod.length; i++) {
    const c = camCompat(wod[i - 1].camelot, wod[i].camelot);
    if (c === 'green') camG++; else if (c === 'yellow') camY++; else if (c === 'red') camR++;
  }

  const phaseLbl = PHASE_CONFIG[state.currentPhase]?.label || state.currentPhase;
  document.getElementById('pl-name').value = `CFLU ${phaseLbl} · ${genre} · ${state.wodMinutes} min${cd.length ? ' · CD' : ''}`;

  document.getElementById('stats-bar').innerHTML = `
    <div class="stat"><div class="stat-val">${wod.length}</div><div class="stat-lbl">Tracks</div></div>
    <div class="stat"><div class="stat-val">${fmtMin(effectiveSec)}</div><div class="stat-lbl">WOD${xfade > 0 ? ' eff.' : ''}</div></div>
    ${cd.length ? `<div class="stat"><div class="stat-val" style="color:var(--purple)">${fmtMin(cdSec)}</div><div class="stat-lbl">Cool-Down</div></div>` : ''}
    <div class="stat"><div class="stat-val">${bpms[0] || 0}→${bpms[bpms.length - 1] || 0}</div><div class="stat-lbl">BPM</div></div>
    <div class="stat"><div class="stat-val">${avgEng}</div><div class="stat-lbl">Ø Energy</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--green)">${camG}</div><div class="stat-lbl">Cam✓</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--yellow)">${camY}</div><div class="stat-lbl">Cam~</div></div>
    <div class="stat"><div class="stat-val" style="color:var(--red)">${camR}</div><div class="stat-lbl">Cam✗</div></div>`;

  const wm = document.getElementById('warn-msg');
  if (warns.length) { wm.textContent = warns.join(' · '); wm.style.display = 'block'; } else { wm.style.display = 'none'; }
  document.getElementById('limit-warn').style.display = all.length > 100 ? 'block' : 'none';

  const rows = document.getElementById('track-rows');
  rows.innerHTML = '';
  const refId = state.selectedTrack ? (state.selectedTrack.id || state.selectedTrack.song) : null;
  wod.forEach((t, i) => {
    const prev  = i > 0 ? wod[i - 1] : null;
    const delta = prev ? t.bpm - prev.bpm : 0;
    const cc    = prev ? camCompat(prev.camelot, t.camelot) : 'green';
    const isRef = (t.id && t.id === refId) || (t.song === state.selectedTrack?.song && t.artist === state.selectedTrack?.artist);
    rows.appendChild(makeRow(i, t, i + 1, delta, cc, false, isRef));
  });
  if (cd.length) {
    const sep = document.createElement('div');
    sep.className = 'cd-sep';
    sep.textContent = '⬇ Cool-Down — ' + fmtDur(cdSec);
    rows.appendChild(sep);
    cd.forEach((t, i) => rows.appendChild(makeRow(wod.length + i, t, wod.length + i + 1, 0, 'unknown', true, false)));
  }

  rows.querySelectorAll('.tr').forEach((row, i) => {
    row.addEventListener('mouseenter', () => highlightFromRow(i));
    row.addEventListener('mouseleave', () => clearHighlight());
  });

  if (state.spToken) document.getElementById('sp-export-btn2').style.display = 'block';
  document.getElementById('csv-export-btn').style.display = 'block';

  document.getElementById('gen-log').value = logText || '';
  document.getElementById('gen-log-section').style.display = '';

  state.bpmChartData = [...wod, ...cd];
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('result-area').classList.remove('hidden');
  requestAnimationFrame(() => drawChart(wod.length));
}

function exportCsv() {
  const all = [...state.generatedWod, ...state.generatedCd];
  if (!all.length) return;
  const esc = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = [['Nr', 'Artist', 'Title', 'BPM', 'Camelot', 'Energy', 'Duration', 'Genre']];
  all.forEach((t, i) => {
    const mm = Math.floor((t.dur || 0) / 60);
    const ss = String((t.dur || 0) % 60).padStart(2, '0');
    rows.push([i + 1, t.artist, t.song, t.bpm, t.camelot || '', t.energy, `${mm}:${ss}`, t.genre || '']);
  });
  const csv = rows.map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CFLU_WOD_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function _metaColor(field, v) {
  if (v == null || isNaN(v)) return 'var(--text3)';
  switch (field) {
    case 'popularity':   return v >= 70 ? '#1db954' : v >= 40 ? '#f7c948' : 'var(--text3)';
    case 'valence':      return v >= 65 ? '#1db954' : v >= 40 ? '#f7c948' : '#a855f7';
    case 'dance':        return v >= 70 ? '#1db954' : v >= 45 ? '#f7c948' : 'var(--text3)';
    case 'acoustic':     return v < 20  ? '#1db954' : v < 50  ? '#f7c948' : '#ef4444';
    case 'instrumental': return v < 30  ? '#1db954' : v < 65  ? '#f7c948' : '#ef4444';
    case 'speech':       return v < 15  ? '#1db954' : v < 35  ? '#f7c948' : '#ef4444';
    case 'live':         return v < 20  ? '#1db954' : v < 50  ? '#f7c948' : '#ef4444';
    case 'loud':         return v >= -6 ? '#1db954' : v >= -12 ? '#f7c948' : 'var(--text3)';
    default: return 'var(--text3)';
  }
}

function makeRow(idx, t, num, delta, cc, isCd, isRef) {
  const row = document.createElement('div');
  row.className = 'tr' + (isCd ? ' cooldown' : '') + (isRef ? ' ref-track' : '');
  row.dataset.idx = idx;
  const engColor = t.energy >= 90 ? '#1db954' : t.energy >= 75 ? '#a855f7' : t.energy >= 60 ? '#f7c948' : '#535353';
  const song   = t.song.length > 32 ? t.song.slice(0, 30) + '…' : t.song;
  const artist = t.artist.length > 28 ? t.artist.slice(0, 26) + '…' : t.artist;
  const genreColor = t.avg_color || 'var(--text2)';
  let genreHtml = '';
  if (t.genres_raw && t.genres_raw.length) {
    const [primary, ...rest] = t.genres_raw.slice(0, 3);
    const prefix = t.genre ? `<span class="tr-genre-tags">${t.genre}: </span>` : '';
    const restHtml = rest.length ? `, <span class="tr-genre-tags">${rest.join(', ')}</span>` : '';
    genreHtml = `<div class="tr-genres">${prefix}<span class="tr-genre-main" style="color:${genreColor}">${primary}</span>${restHtml}</div>`;
  } else if (t.genre) {
    genreHtml = `<div class="tr-genres"><span class="tr-genre-main" style="color:${genreColor}">${t.genre}</span></div>`;
  }
  const spLink = t.id && t.id !== 'nan' && t.id
    ? `<svg class="sp-icon" onclick="window.open('https://open.spotify.com/track/${t.id}','_blank')" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#1db954"/><path d="M16.5 16.5c-2.5-1.5-5.5-1.8-9-1" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M17.5 13.5c-3-1.8-7-2-10.5-1" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M18 10c-3.5-2-8-2.2-11.5-1" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg>` : '';
  const ps = calcPhaseScore(t, state.currentPhase);
  const psCls = ps >= 80 ? 'ps-green' : ps >= 50 ? 'ps-yellow' : 'ps-red';
  const m = (field, v) => `<div class="tr-meta" style="color:${_metaColor(field, v)}">${v ?? '—'}</div>`;
  row.innerHTML = `
    <div class="tr-num">${num}${isRef ? '<br><span class="ref-label">REF</span>' : ''}</div>
    <div><div class="tr-song" title="${t.song}">${song}</div><div class="tr-artist" title="${t.artist}">${artist}</div>${genreHtml}</div>
    <div><div class="tr-bpm">${t.bpm}</div>${delta > 0 ? `<div class="tr-bpm-delta">+${delta}</div>` : ''}</div>
    <div class="tr-cam"><span class="cam-dot" style="background:${CAM_COLOR[cc]}"></span>${t.camelot || '—'}</div>
    <div class="tr-eng" style="color:${engColor}">${t.energy}</div>
    ${m('popularity', t.popularity)}
    ${m('valence', t.valence)}
    ${m('dance', t.dance)}
    ${m('acoustic', t.acoustic)}
    ${m('instrumental', t.instrumental)}
    ${m('speech', t.speech)}
    ${m('live', t.live)}
    ${m('loud', t.loud)}
    <div class="tr-phase"><span class="phase-score ${psCls}">${ps}</span></div>
    <div class="tr-dur">${fmtDur(t.dur)}</div>
    <div class="tr-sp">${spLink}</div>`;
  return row;
}

// ===== GENRE DROPDOWNS =====
function _initGenreDropdowns() {
  const genres = [...new Set(getAllTracks().map(t => t.genre).filter(Boolean))].sort();

  const genreSel = document.getElementById('genre-sel');
  genres.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; genreSel.appendChild(o); });
  [['Alle Deutschen Tracks', 'Alle Deutschen Tracks'], ['Going Wild', 'Going Wild (alle Genres)']].forEach(([v, l]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = l; genreSel.appendChild(o);
  });

  const manualGenre = document.getElementById('manual-genre');
  genres.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; manualGenre.appendChild(o); });
}

// ===== INIT =====
function init() {
  // Phase tiles
  ['A','B','C','D'].forEach(p =>
    document.getElementById('phase-' + p).addEventListener('click', () => onPhaseSelect(p))
  );
  // Selection mode tabs
  ['filter','direct','link'].forEach(m =>
    document.getElementById('tab-' + m).addEventListener('click', () => setSelMode(m))
  );
  // Camelot filter
  document.getElementById('cam-letter-slider').addEventListener('input', e => onCamLetterSlider(e.target));
  document.getElementById('cam-numbers').addEventListener('input', onCamNumbers);
  document.getElementById('clear-cam-numbers').addEventListener('click', () => {
    document.getElementById('cam-numbers').value = '';
    onCamNumbers();
  });
  // Genre & BPM filter
  document.getElementById('genre-sel').addEventListener('change', onGenreChange);
  document.getElementById('bpm-slider').addEventListener('input', e => onBpmSlider(e.target));
  document.getElementById('bpm-tol').addEventListener('input', e => onBpmTol(e.target));
  document.getElementById('clear-filter-search').addEventListener('click', () => clearSearch('filter-search'));
  document.getElementById('filter-search').addEventListener('input', updateFilterList);
  document.getElementById('filter-list').addEventListener('change', e => onTrackSelect(e.target, 'filter'));
  // Direct search
  document.getElementById('direct-search').addEventListener('input', onDirectSearch);
  document.getElementById('clear-direct-search').addEventListener('click', () => clearSearch('direct-search'));
  document.getElementById('direct-list').addEventListener('change', e => onTrackSelect(e.target, 'direct'));
  // Spotify link
  document.getElementById('link-input').addEventListener('input', onLinkInput);
  document.getElementById('manual-genre').addEventListener('change', onManualGenreChange);
  // Position chips
  ['start','end','mid','plateau'].forEach(p =>
    document.getElementById('pos-' + p).addEventListener('click', () => setPosition(p))
  );
  // Settings
  document.getElementById('dur-slider').addEventListener('input', e => onDurSlider(e.target));
  document.getElementById('xfade-slider').addEventListener('input', e => onXfadeSlider(e.target));
  document.getElementById('jump-slider').addEventListener('input', e => onJumpSlider(e.target));
  document.getElementById('cd-toggle').addEventListener('change', onCdToggle);
  document.getElementById('cam-lock-toggle').addEventListener('change', e => { state.lockCamFilter = e.target.checked; });
  document.getElementById('cd-dur-slider').addEventListener('input', e => onCdDurSlider(e.target));
  // Generate & Spotify
  document.getElementById('gen-btn').addEventListener('click', generatePlaylist);
  document.getElementById('sp-connect-btn').addEventListener('click', spotifyLogin);
  document.getElementById('sp-logout-btn').addEventListener('click', spotifyLogout);
  document.getElementById('sp-export-btn2').addEventListener('click', exportPlaylist);
  document.getElementById('csv-export-btn').addEventListener('click', exportCsv);

  // Generation log copy
  document.getElementById('gen-log-copy-btn').addEventListener('click', () => {
    const ta = document.getElementById('gen-log');
    navigator.clipboard.writeText(ta.value).then(() => {
      const ok = document.getElementById('gen-log-copy-ok');
      ok.style.display = 'inline';
      setTimeout(() => { ok.style.display = 'none'; }, 2000);
    }).catch(() => { ta.select(); document.execCommand('copy'); });
  });

  // Login modal
  document.getElementById('modal-connect-btn').addEventListener('click', modalConnect);
  document.getElementById('modal-skip-btn').addEventListener('click', closeLoginModal);
  document.getElementById('modal-close-btn').addEventListener('click', closeLoginModal);
  document.getElementById('login-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('login-modal')) closeLoginModal();
  });
  document.getElementById('modal-sp-cid').addEventListener('keydown', e => {
    if (e.key === 'Enter') modalConnect();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLoginModal();
  });

  // Init slider styles
  updateSliderStyle(document.getElementById('bpm-slider'), BPM_STOPS, 60, 220);
  updateSliderStyle(document.getElementById('jump-slider'), JUMP_STOPS, 5, 20);

  // Populate genre dropdowns from track data (must run before onPhaseSelect reads the select)
  _initGenreDropdowns();

  // Init pool genre from filter default
  state.poolGenre = document.getElementById('genre-sel').value;

  // Default phase
  onPhaseSelect('C');

  // Spotify callback — if returning from OAuth, skip the login modal
  const urlParams = new URLSearchParams(window.location.search);
  const hasOAuthCode  = urlParams.has('code');
  const hasPoolUpdate = urlParams.has('pool_updated');
  if (hasPoolUpdate) history.replaceState({}, '', window.location.pathname);
  checkSpotifyCallback();

  // Chart resize debounce
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (state.bpmChartData.length) drawChart(state.generatedWod.length);
    }, 100);
  });

  // Right panel toggle
  const rpPanel = document.getElementById('right-panel');
  const rpTab   = document.getElementById('rp-tab');
  rpTab.addEventListener('click', e => {
    e.stopPropagation();
    rpPanel.classList.toggle('right-panel--open');
  });
  document.addEventListener('click', e => {
    if (rpPanel.classList.contains('right-panel--open') && !rpPanel.contains(e.target)) {
      rpPanel.classList.remove('right-panel--open');
    }
  });

  // Dynamic pool info — set from TRACK_DATA at runtime
  const allTracks  = getAllTracks();
  const genreCount = Object.keys(getGenreStats()).length;
  document.getElementById('direct-search').placeholder = `Alle ${allTracks.length.toLocaleString('de-DE')} Tracks durchsuchen...`;
  const poolInfoEl = document.getElementById('pool-info');
  poolInfoEl.textContent = `${allTracks.length.toLocaleString('de-DE')} Tracks · ${genreCount} Genre-Gruppen`;
  if (hasPoolUpdate) {
    poolInfoEl.textContent += ' · ✓ Pool aktualisiert';
    poolInfoEl.style.color = 'var(--acc)';
    setTimeout(() => { poolInfoEl.style.color = ''; poolInfoEl.textContent = poolInfoEl.textContent.replace(' · ✓ Pool aktualisiert', ''); }, 4000);
  }

  // Pre-fill Client ID from local file, then show login modal (unless OAuth callback or pool reload)
  fetch('cflu_client_id.txt')
    .then(r => r.ok ? r.text() : null)
    .then(id => {
      const cid = id ? id.trim() : '';
      if (cid) {
        document.getElementById('sp-cid').value = cid;
        document.getElementById('modal-sp-cid').value = cid;
      }
      if (!hasOAuthCode && !hasPoolUpdate) showLoginModal();
    })
    .catch(() => { if (!hasOAuthCode && !hasPoolUpdate) showLoginModal(); });
}

document.addEventListener('DOMContentLoaded', init);
