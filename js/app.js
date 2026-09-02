// app.js — UI wiring only; no business logic here — delegate to algorithm.js, spotify.js, chart.js etc.
import { PHASE_CONFIG, PROGRESSION_LABEL, MIN_POOL_SIZE,
         POS_BPM, CAM_COLOR, CAM_ZONE1, CAM_ZONE2, DUR_STEPS,
         bpmStopsForPhase,
         BPM_SLIDER_MIN, BPM_SLIDER_MAX,
         GOING_WILD_GENRE,
         LASTFM_STALE_WARN_DAYS, LASTFM_STALE_DANGER_DAYS,
         SCORE_WEIGHTS_DEFAULT } from './config.js';
import { getNeighbours } from './genres.js';
import { state } from './state.js';
import { titleKey, fmtDur, fmtMin, lerpColor, toHex, camCompat, calcPhaseScore, bpmHint, effectiveBpm, artistKeys } from './utils.js';
import { getAllTracks, getPool, getPhasePool, getPhasePoolWithNeighbours, getGenreStats,
         registerTrack, buildUp, buildEnd, buildPlateauSplit, buildCooldown,
         buildPlateau, buildDecreasing, buildAlternating, pickReplacement } from './algorithm.js';
import { drawChart, highlightFromRow, clearHighlight } from './chart.js';
import { drawCamWheel, drawScoringRadar, drawFilterRadar, SW_KEYS, PF_KEYS, PF_MAX } from './widgets.js';
import { buildGenLog, buildCsv, csvFilename } from './report.js';
import { spotifyLogin, spotifyLogout, checkSpotifyCallback,
         exportPlaylist, getDevices, playOnDevice, spotifyCall } from './spotify.js';
import { initGenreSpace, updatePlaylistMode, resizeGenreSpace } from './genre_space.js';
import { parsePlaylistId, importPlaylist, analyseFlow, flowSummary, reorderGreedy, suggestGapFills, exportOptimized } from './optimizer.js';
import { initRegister, openRegister } from './register.js';

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

// ===== LOGIN MODAL =====

export function showLoginModal() {
  document.getElementById('login-modal').style.display = 'flex';
}

export function closeLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
}

function modalConnect() {
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
  drawCamWheel();
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

let _camNumbersDebounce = null;
function onCamNumbers() {
  const el = document.getElementById('cam-numbers');
  state.camNumbers = parseCamNumbers(el.value);
  document.getElementById('clear-cam-numbers').style.display = el.value ? '' : 'none';

  // #182: distinguish "rejected" from "empty" — silent [] gave no feedback on invalid input.
  const errEl = document.getElementById('cam-numbers-error');
  if (el.value.trim() && state.camNumbers.length === 0) {
    errEl.textContent = 'Ungültig — gültige Zahlen: 1–12';
    errEl.style.display = '';
  } else {
    errEl.style.display = 'none';
  }

  // #196: debounce the expensive tail (full SVG wheel rebuild + list re-filter) so fast
  // typing doesn't trigger a rebuild on every keystroke.
  clearTimeout(_camNumbersDebounce);
  _camNumbersDebounce = setTimeout(() => {
    updateCamHint();
    updateCamLockRow();
    updateFilterList();
    if (state.selMode === 'direct') onDirectSearch();
  }, 80);
}

// #198: quick "Alle" reset — clears the Camelot number filter entirely (letter slider unaffected).
function onCamWheelReset() {
  state.camNumbers = [];
  const el = document.getElementById('cam-numbers');
  el.value = '';
  document.getElementById('clear-cam-numbers').style.display = 'none';
  document.getElementById('cam-numbers-error').style.display = 'none';
  updateCamHint();
  updateCamLockRow();
  updateFilterList();
  if (state.selMode === 'direct') onDirectSearch();
}

// #195: brief toast when a phase switch silently overwrites manually-set swap-filter values.
function _showPhaseFilterResetToast(phase) {
  const wm = document.getElementById('warn-msg');
  const label = PHASE_CONFIG[phase]?.label || phase;
  wm.textContent = `Filter auf Phase-${phase}-Defaults zurückgesetzt (${label})`;
  wm.classList.add('warn-toast');
  wm.style.display = 'block';
  setTimeout(() => { wm.style.display = 'none'; wm.classList.remove('warn-toast'); }, 3000);
}

// #162: render phase-tile text from PHASE_CONFIG — no freetext in HTML, so a config change
// (e.g. adjusting PHASE_CONFIG.B.bpm) automatically updates the tile without a markup edit.
function _renderPhaseTiles() {
  for (const phase of ['A', 'B', 'C', 'D']) {
    const cfg = PHASE_CONFIG[phase];
    const tile = document.getElementById('phase-' + phase);
    if (!cfg || !tile) continue;
    tile.querySelector('.pt-letter').textContent = phase;
    tile.querySelector('.pt-name').textContent = cfg.label;
    tile.querySelector('.pt-desc').textContent = cfg.desc || '';
    const progLabel = PROGRESSION_LABEL[cfg.progression] || cfg.progression;
    tile.querySelector('.pt-bpm').textContent = `${cfg.bpm[0]}–${cfg.bpm[1]} BPM · ${progLabel}`;
  }
}

// ===== PHASE SELECT =====
function onPhaseSelect(phase) {
  const prevPhase = state.currentPhase;
  state.currentPhase = phase;
  ['A','B','C','D'].forEach(p => document.getElementById('phase-' + p).classList.toggle('active', p === phase));
  const cfg = PHASE_CONFIG[phase];
  state.wodEnergyMin = cfg.energy ? cfg.energy[0] : 0;
  state.wodEnergyMax = cfg.energy ? cfg.energy[1] : 100;
  const bpmEl = document.getElementById('bpm-slider');
  bpmEl.value = cfg.bpmDefault;
  onBpmSlider(bpmEl);
  const tolEl = document.getElementById('bpm-tol');
  tolEl.value = cfg.tolDefault;
  document.getElementById('bpm-tol-badge').textContent = '±' + cfg.tolDefault;
  state.bpmTol = cfg.tolDefault;
  const step2 = document.getElementById('step2');
  if (cfg.positionVisible) {
    step2.style.display = '';
  } else {
    step2.style.display = 'none';
    // #162: dispatch on progression, not the phase letter — stays correct if a phase's
    // letter-to-behaviour mapping ever changes in PHASE_CONFIG.
    if (cfg.progression === 'plateau') setPosition('plateau');
    if (cfg.progression === 'decreasing') setPosition('start');
  }
  if (phase === 'D') {
    state.wodMinutes = 15;
    document.getElementById('dur-slider').value = DUR_STEPS.indexOf(15);
    document.getElementById('dur-badge').textContent = '15 min';
    document.getElementById('q-dur-slider').value = DUR_STEPS.indexOf(15);
    document.getElementById('q-dur-badge').textContent = '15 min';
  }
  updateFilterList();
  updateAmpel();
  checkPoolAndWarn();
  checkRefBpmAndWarn();
  // #195: detect manual swap-filter changes (relative to the outgoing phase's defaults)
  // before they get silently overwritten below.
  const prevDefaults = phaseFilterDefaults(prevPhase);
  const filterWasModified = prevPhase !== phase && PF_KEYS.some(k => state.poolFilter[k] !== prevDefaults[k]);
  applyPhaseFilter(phase);
  if (filterWasModified) _showPhaseFilterResetToast(phase);
}

function checkPoolAndWarn() {
  const genre = state.poolGenre || document.getElementById('genre-sel').value;
  const pool = getPhasePool(genre, state.currentPhase);
  const warn = document.getElementById('pool-warn');
  if (pool.length < MIN_POOL_SIZE) {
    const neighbours = getNeighbours(genre);
    warn.textContent = `Nur ${pool.length} Tracks für Phase ${state.currentPhase} in "${genre}".`
      + (neighbours.length ? ` Nachbar-Genres automatisch ergänzt: ${neighbours.slice(0, 2).join(', ')}.` : '');
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }
}

function checkRefBpmAndWarn() {
  const warn = document.getElementById('ref-bpm-warn');
  const ref = state.selectedTrack;
  if (!ref || !ref.bpm) { warn.style.display = 'none'; return; }
  const cfg = PHASE_CONFIG[state.currentPhase];
  if (!cfg) { warn.style.display = 'none'; return; }
  const [lo, hi] = cfg.bpm;
  if (ref.bpm >= lo && ref.bpm <= hi) { warn.style.display = 'none'; return; }
  const effBpm = effectiveBpm(ref.bpm, state.currentPhase);
  if (effBpm >= lo && effBpm <= hi) {
    warn.textContent = `ℹ Referenz-Song (${ref.bpm} BPM) liegt außerhalb Phase ${state.currentPhase} [${lo}–${hi} BPM], wird als ${effBpm} BPM gewertet (×2-Normalisierung).`;
  } else {
    warn.textContent = `⚠ Referenz-Song (${ref.bpm} BPM) liegt außerhalb Phase ${state.currentPhase} [${lo}–${hi} BPM]. Playlist-Qualität eingeschränkt.`;
  }
  warn.style.display = 'block';
}

// ===== UI MODE (Quick / Optimizer / Advanced / Register) =====
function setUiMode(mode) {
  state.uiMode = mode;
  const isRegister = mode === 'register';
  ['quick','optimizer','advanced','register'].forEach(m => {
    document.getElementById('mode-tab-' + m).classList.toggle('active', m === mode);
    document.getElementById('mode-' + m + '-panel').style.display = m === mode ? '' : 'none';
  });
  // Register uses its own main panel; WOD result area shown for all other modes
  document.getElementById('result-area').style.display   = isRegister ? 'none' : '';
  document.getElementById('reg-main-panel').style.display = isRegister ? '' : 'none';
  if (isRegister) openRegister();
}

// ===== QUICK MODE =====
function onQuickSearch() {
  const q = document.getElementById('q-search').value.toLowerCase().trim();
  const sel = document.getElementById('q-list');
  const count = document.getElementById('q-search-count');
  document.getElementById('q-search-clear').style.display = q ? '' : 'none';
  if (q.length < 2) { count.textContent = 'Mind. 2 Zeichen eingeben'; sel.innerHTML = ''; return; }
  const res = getAllTracks().filter(t =>
    t.song.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  ).slice(0, 60);
  sel.innerHTML = res.map(t =>
    `<option value="${t.id || t.song}">${t.artist} — ${t.song} (${t.bpm} BPM, ${t.camelot || '—'})</option>`
  ).join('');
  sel._qTracks = res;
  count.textContent = res.length + ' Ergebnisse';
}

function onQuickSelect(sel) {
  const idx = sel.selectedIndex;
  if (idx < 0 || !sel._qTracks) return;
  const t = sel._qTracks[idx];
  selectTrack(t);  // sets state.selectedTrack + state.poolGenre; updates Advanced DOM (hidden)
  document.getElementById('q-sel-title').textContent  = t.song;
  document.getElementById('q-sel-artist').textContent = t.artist;
  document.getElementById('q-sel-bpm').textContent    = t.bpm + ' BPM';
  document.getElementById('q-sel-cam').textContent    = t.camelot || '—';
  document.getElementById('q-sel-genre').textContent  = t.genre;
  document.getElementById('q-selected').classList.remove('section-hidden');
  document.getElementById('q-gen-btn').disabled = false;
}

function onQuickGenerate() {
  if (!state.selectedTrack || state.selectedTrack.bpm <= 0) { alert('Bitte Song wählen.'); return; }
  const phase    = document.getElementById('q-segment').value;
  const position = document.getElementById('q-position').value;
  const cfg = PHASE_CONFIG[phase];
  // Apply phase + position to state; also sync Advanced panel phase tile highlights
  state.currentPhase   = phase;
  ['A','B','C','D'].forEach(p => document.getElementById('phase-' + p).classList.toggle('active', p === phase));
  state.wodEnergyMin   = cfg.energy ? cfg.energy[0] : 0;
  state.wodEnergyMax   = cfg.energy ? cfg.energy[1] : 100;
  state.bpmTol         = cfg.tolDefault;
  state.position       = position;
  _gen();
}

// ===== LAST.FM SYNC STATUS =====
async function _checkLastfmSync() {
  const info  = document.getElementById('lastfm-sync-info');
  const badge = document.getElementById('rp-sync-badge');
  const btn   = document.getElementById('lastfm-sync-btn');
  // Both requests fire together (independent, unrelated endpoints) — each still awaited/caught
  // separately below so one endpoint failing doesn't affect the other's handling.
  const statusPromise   = fetch('/api/lastfm/status');
  const progressPromise = fetch('/api/lastfm/progress');
  try {
    const r = await statusPromise;
    const d = await r.json();
    if (!d.last_full_sync) {
      info.textContent  = 'Letzter Last.fm Sync: Nie';
      badge.className   = 'warn';
      btn.style.display = '';
    } else {
      const syncDate = new Date(d.last_full_sync);
      const days     = Math.floor((Date.now() - syncDate) / 86_400_000);
      const dateStr  = syncDate.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'});
      info.textContent = `Letzter Last.fm Sync: ${dateStr} · vor ${days} Tag${days !== 1 ? 'en' : ''} · ${d.track_count} Tracks`;
      if (days >= LASTFM_STALE_DANGER_DAYS) {
        badge.className   = 'warn';
        btn.style.display = '';
      } else if (days >= LASTFM_STALE_WARN_DAYS) {
        badge.className   = 'info';
        btn.style.display = '';
      } else {
        badge.className   = '';
        btn.style.display = 'none';
      }
    }
  } catch {
    info.textContent = 'Last.fm Sync: Server nicht erreichbar';
  }
  // Auto-resume progress display if a sync was running before page reload
  try {
    const rp = await progressPromise;
    const dp = await rp.json();
    if (dp.running) {
      const btn2 = document.getElementById('lastfm-sync-btn');
      btn2.style.display = '';
      btn2.disabled      = true;
      btn2.textContent   = '⏳ Sync läuft…';
      _pollLastfmProgress();
    }
  } catch { /* progress endpoint not available — no active sync */ }
}

let _lastfmPollTimer = null;

function _pollLastfmProgress() {
  if (_lastfmPollTimer) { clearTimeout(_lastfmPollTimer); _lastfmPollTimer = null; }
  const msg = document.getElementById('lastfm-sync-msg');
  const btn = document.getElementById('lastfm-sync-btn');

  async function poll() {
    try {
      const r = await fetch('/api/lastfm/progress');
      const d = await r.json();

      if (d.error) {
        msg.textContent = `Sync-Fehler: ${d.error}`;
        msg.className   = 'upload-status error';
        btn.disabled    = false;
        btn.textContent = '↺ Vollständig neu synchronisieren';
        return;
      }
      if (!d.running && d.phase === 'done') {
        msg.textContent = '✓ Sync abgeschlossen — Seite neu laden um aktuelle Daten zu verwenden.';
        msg.className   = 'upload-status info';
        btn.disabled    = false;
        btn.textContent = '↺ Vollständig neu synchronisieren';
        _checkLastfmSync();
        return;
      }
      if (!d.running) return;

      const parts = [];
      if (d.tracks_total > 0) parts.push(`Tracks: ${d.tracks_done}/${d.tracks_total}`);
      if (d.artists_total > 0) parts.push(`Artists: ${d.artists_done}/${d.artists_total}`);
      const phaseLabel = d.phase === 'tracks'  ? 'Phase 1/2'
                       : d.phase === 'artists' ? 'Phase 2/2' : '';
      const progress   = parts.length ? ` · ${parts.join(' · ')}` : '';
      msg.textContent  = `↻ Sync läuft${phaseLabel ? ` — ${phaseLabel}` : ''}${progress}`;
      msg.className    = 'upload-status info';

      _lastfmPollTimer = setTimeout(poll, 2000);
    } catch {
      _lastfmPollTimer = setTimeout(poll, 3000);
    }
  }

  poll();
}

// ===== OPTIMIZER =====
let _optTracks  = [];   // imported + optionally reordered track list
let _optTitle   = '';   // original playlist name (for export)

function _optSetStatus(msg, elId = 'opt-url-status') {
  const el = document.getElementById(elId);
  if (el) el.textContent = msg;
}

function _optShowActions(show) {
  document.getElementById('opt-phase-section').style.display = show ? '' : 'none';
  document.getElementById('opt-actions').style.display = show ? '' : 'none';
  document.getElementById('opt-export-section').style.display = show ? '' : 'none';
}

function _optRunAnalysis() {
  const phase = document.getElementById('opt-phase').value;
  const transitions = analyseFlow(_optTracks, phase);
  document.getElementById('opt-flow-summary').textContent = flowSummary(transitions);
  _renderOptimizerResult(_optTracks, transitions);
}

function _renderOptimizerResult(tracks, transitions) {
  // Show in main result area (reusing track-rows + main-top)
  document.getElementById('main-top').style.display = 'none';
  document.getElementById('result-footer').style.display = 'none';
  document.getElementById('genre-space-section').style.display = 'none';

  const container = document.getElementById('track-rows');
  container.innerHTML = tracks.map((t, i) => {
    const trans = transitions && transitions[i - 1];
    const dot   = trans ? ({ green: '🟢', yellow: '🟡', red: '🔴', unknown: '⬜' }[trans.rating] || '') : '';
    const score = trans && trans.score !== null ? `(${trans.score})` : '';
    const ext   = t._external ? ' <span style="color:var(--text3);font-size:.65rem">[ext]</span>' : '';
    return `<div class="track-row" style="padding:6px 12px;border-bottom:1px solid var(--border);font-size:var(--fz-sm)">
      <span style="color:var(--text3);min-width:28px;display:inline-block">${i + 1}.</span>
      <span style="margin-right:6px">${dot} ${score}</span>
      <span style="font-weight:600">${t.artist} — ${t.song}</span>${ext}
      ${t.bpm ? `<span style="color:var(--text2);margin-left:8px;font-family:var(--ff-mono);font-size:var(--fz-xs)">${t.bpm} BPM · ${t.camelot || '—'} · E:${t.energy}</span>` : ''}
    </div>`;
  }).join('');

  document.getElementById('main-scroll').style.display = '';
}

async function onOptImport() {
  if (!state.spConnected) {
    _optSetStatus('Bitte zuerst mit Spotify verbinden (Admin-Panel rechts ⚙).');
    return;
  }
  const url = document.getElementById('opt-url').value.trim();
  const pid = parsePlaylistId(url);
  if (!pid) { _optSetStatus('Keine gültige Spotify-Playlist-URL.'); return; }

  const btn = document.getElementById('opt-import-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Lade…';
  _optSetStatus('Importiere Playlist…');
  _optShowActions(false);

  try {
    _optTracks = await importPlaylist(pid);
    _optTitle = pid; // fallback if the name lookup below fails
    try {
      const meta = await spotifyCall('GET', `/playlists/${pid}?fields=name`);
      if (meta?.name) _optTitle = meta.name;
    } catch { /* keep UUID fallback — non-fatal */ }
    const matched  = _optTracks.filter(t => !t._external).length;
    const external = _optTracks.filter(t => t._external).length;
    _optSetStatus(`✓ ${_optTracks.length} Tracks · ${matched} im Pool · ${external} extern`);
    _optShowActions(true);
    _optRunAnalysis();
  } catch (e) {
    const detail = e.detail?.error?.message;
    if (e.status === 403) {
      _optSetStatus(`Fehler 403 — ${detail || 'Kein Zugriff'}. Playlist privat oder Spotify-App benötigt Extended Quota Mode. Abmelden → neu verbinden kann helfen (neuer Scope).`);
    } else {
      _optSetStatus(`Fehler: ${detail || e.message}`);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ Importieren';
  }
}

async function onOptReorder() {
  const phase = document.getElementById('opt-phase').value;
  _optTracks = reorderGreedy(_optTracks, phase);
  const transitions = analyseFlow(_optTracks, phase);
  document.getElementById('opt-flow-summary').textContent = 'Optimiert · ' + flowSummary(transitions);
  _renderOptimizerResult(_optTracks, transitions);
}

async function onOptGaps() {
  const phase = document.getElementById('opt-phase').value;
  const suggestions = suggestGapFills(_optTracks, phase);
  if (!suggestions.length) {
    document.getElementById('opt-flow-summary').textContent += ' · Keine schwachen Übergänge gefunden.';
    return;
  }
  // Auto-insert best candidate for each weak transition (highest combined score)
  const inserts = [...suggestions].sort((a, b) => b.afterIndex - a.afterIndex);
  for (const { afterIndex, candidates } of inserts) {
    if (candidates.length) _optTracks.splice(afterIndex + 1, 0, candidates[0]);
  }
  const transitions = analyseFlow(_optTracks, phase);
  document.getElementById('opt-flow-summary').textContent = `+${suggestions.length} Lücken gefüllt · ` + flowSummary(transitions);
  _renderOptimizerResult(_optTracks, transitions);
}

async function onOptExport() {
  const btn = document.getElementById('opt-export-btn');
  btn.disabled = true;
  _optSetStatus('Exportiere…', 'opt-export-status');
  try {
    const url = await exportOptimized(_optTracks, _optTitle || 'Playlist');
    _optSetStatus('✓ Exportiert!', 'opt-export-status');
    const link = document.getElementById('opt-pl-link');
    link.href = url;
    link.style.display = 'inline';
  } catch (e) {
    _optSetStatus(`Fehler: ${e.message}`, 'opt-export-status');
  } finally {
    btn.disabled = false;
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
  const c = updateSliderStyle(el, bpmStopsForPhase(state.currentPhase), BPM_SLIDER_MIN, BPM_SLIDER_MAX);
  const v = +el.value;
  document.getElementById('bpm-val-display').textContent = v + ' BPM';
  document.getElementById('bpm-val-display').style.color = toHex(c);
  document.getElementById('bpm-hint-display').textContent = bpmHint(v, state.currentPhase);
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
  if (state.explicitFilter === 'exclude') filtered = filtered.filter(t => !t.explicit);
  if (state.explicitFilter === 'only')    filtered = filtered.filter(t =>  t.explicit);
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
    o.textContent = `[${ps}]${t.explicit ? ' [E]' : ''} ${t.artist} — ${t.song} — ${t.bpm} BPM — ${t.camelot} — E:${t.energy}`;
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
  const genrePool = getPool(GOING_WILD_GENRE);
  let res = genrePool.filter(t =>
    t.song.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
  );
  if (state.explicitFilter === 'exclude') res = res.filter(t => !t.explicit);
  if (state.explicitFilter === 'only')    res = res.filter(t =>  t.explicit);
  res = res.sort((a, b) => {
    const ps = calcPhaseScore(b, state.currentPhase) - calcPhaseScore(a, state.currentPhase);
    return ps || a.bpm - b.bpm;
  }).slice(0, 80);
  res.forEach(t => {
    const ps = calcPhaseScore(t, state.currentPhase);
    const o = document.createElement('option');
    o.value = t.id || t.song;
    o.textContent = `[${ps}]${t.explicit ? ' [E]' : ''} ${t.artist} — ${t.song} — ${t.bpm} BPM — ${t.camelot} — E:${t.energy}`;
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
  const allTracks = getPool(GOING_WILD_GENRE);
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
  const allTracks = getPool(GOING_WILD_GENRE);
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
  checkRefBpmAndWarn();
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

function setExplicitFilter(mode) {
  state.explicitFilter = mode;
  ['allow','exclude','only'].forEach(m => document.getElementById('explicit-' + m).classList.toggle('active', m === mode));
  updateFilterList();
  if (state.selMode === 'direct') onDirectSearch();
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
  document.getElementById('q-dur-badge').textContent = min + ' min';
  const other = el.id === 'dur-slider' ? 'q-dur-slider' : 'dur-slider';
  document.getElementById(other).value = el.value;
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

// ===== SCORING RADAR (wiring — drawScoringRadar lives in widgets.js) =====

// #191: the reset button doubles as the "you're off default" indicator — hidden unless at
// least one score weight deviates from SCORE_WEIGHTS_DEFAULT.
function _updateSwResetVisibility() {
  const btn = document.getElementById('sw-reset-btn');
  if (!btn) return;
  const isDefault = SW_KEYS.every(k => state.scoreWeights[k] === SCORE_WEIGHTS_DEFAULT[k]);
  btn.style.display = isDefault ? 'none' : '';
}

function onScoreWeightChange(key, raw) {
  const val = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
  state.scoreWeights[key] = val;
  // Sync sibling input (slider ↔ number)
  const slider = document.getElementById('sw-' + key);
  const num    = document.getElementById('sn-' + key);
  if (slider) slider.value = val;
  if (num)    num.value    = val;
  drawScoringRadar();
  _updateSwResetVisibility();
  try { localStorage.setItem('cflu_score_weights', JSON.stringify(state.scoreWeights)); } catch (e) { void e; /* storage unavailable */ }
}

// ===== CAMELOT WHEEL (wiring — drawCamWheel lives in widgets.js) =====

function onCamWheelClick(e) {
  const seg = e.target.closest('[data-cam-n]');
  if (!seg) return;
  const n = +seg.getAttribute('data-cam-n');

  let nums = [...state.camNumbers];
  if (nums.length === 0) {
    nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(x => x !== n);
  } else {
    const idx = nums.indexOf(n);
    if (idx >= 0) nums.splice(idx, 1);
    else { nums.push(n); nums.sort((a, b) => a - b); }
    if (nums.length === 12) nums = [];
  }

  state.camNumbers = nums;
  const el = document.getElementById('cam-numbers');
  el.value = nums.length ? nums.join(' ') : '';
  document.getElementById('clear-cam-numbers').style.display = el.value ? '' : 'none';
  updateCamHint();
  updateCamLockRow();
  updateFilterList();
  if (state.selMode === 'direct') onDirectSearch();
}

// ===== PLAYLIST FILTER DEFAULTS (per phase) =====
function phaseFilterDefaults(phase) {
  const cfg = PHASE_CONFIG[phase] || {};
  return {
    minBpm:        cfg.bpm     ? cfg.bpm[0]     : 0,
    maxBpm:        cfg.bpm     ? cfg.bpm[1]     : 220,
    minEnergy:     cfg.energy  ? cfg.energy[0]  : 0,
    minValence:    cfg.valence ? cfg.valence[0] : 0,
    minDance:      cfg.dance   ? cfg.dance[0]   : 0,
    minPopularity: 0,
  };
}

function applyPhaseFilter(phase) {
  Object.assign(state.poolFilter, phaseFilterDefaults(phase));
  PF_KEYS.forEach(key => {
    const v = state.poolFilter[key];
    const sl = document.getElementById('pf-' + key);
    const nm = document.getElementById('pfn-' + key);
    if (sl) sl.value = v;
    if (nm) nm.value = v;
  });
  drawFilterRadar();
}

// ===== POOL FILTER RADAR (wiring — drawFilterRadar lives in widgets.js) =====

function onPoolFilterChange(key, raw) {
  const maxVal = PF_MAX[key];
  const val = Math.max(0, Math.min(maxVal, parseInt(raw, 10) || 0));
  state.poolFilter[key] = val;
  const slider = document.getElementById('pf-' + key);
  const num    = document.getElementById('pfn-' + key);
  if (slider) slider.value = val;
  if (num)    num.value    = val;
  drawFilterRadar();
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
// Snapshot of the state values + pool sizes that buildGenLog() (report.js, pure) used to read
// directly — app.js gathers them here so report.js stays free of state.js and algorithm.js.
function _genLogContext(genre) {
  const phase = state.currentPhase;
  const { selectedTrack: ref, position, wodMinutes, crossfadeSec, wodEnergyMin, wodEnergyMax,
          scoreWeights, poolFilter, cdActive, cdMinutes, camLetter, camNumbers } = state;
  return { phase, ref, position, wodMinutes, crossfadeSec, wodEnergyMin, wodEnergyMax,
           scoreWeights, poolFilter, cdActive, cdMinutes, camLetter, camNumbers,
           directPoolSize: getPhasePool(genre, phase).length,
           fullPoolSize:   getPhasePoolWithNeighbours(genre, phase).length };
}

// ===== DEVICE PLAYBACK =====
function _updatePlayBtnState() {
  const active = !!(state.spConnected && state.spSelectedDeviceId);
  document.querySelectorAll('.tr-play-btn').forEach(btn => {
    btn.style.opacity = active ? '' : '0.2';
    btn.style.pointerEvents = active ? '' : 'none';
    btn.title = active ? 'Ab hier abspielen' : 'Spotify-Gerät wählen für Wiedergabe';
  });
}

function _showPlaybackStatus(msg, isError = false) {
  const el = document.getElementById('sp-playback-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'sp-status ' + (isError ? 'error' : 'info');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function _updateSpPlaybackSection() {
  const connected = state.spConnected;
  const hint = document.getElementById('sp-playback-connect-hint');
  if (hint) hint.style.display = connected ? 'none' : '';
  const panel = document.getElementById('sp-device-panel');
  if (panel) panel.style.display = connected ? '' : 'none';
}

async function refreshDevices() {
  const sel = document.getElementById('sp-device-sel');
  if (!sel) return;
  try {
    const devices = await getDevices();
    state.spDevices = devices;
    sel.innerHTML = '<option value="">— Gerät wählen —</option>';
    let autoSelected = false;
    devices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name} (${d.type})${d.is_active ? ' ●' : ''}`;
      if (d.is_active && !autoSelected) {
        state.spSelectedDeviceId = d.id;
        opt.selected = true;
        autoSelected = true;
      }
      sel.appendChild(opt);
    });
    if (!autoSelected && state.spSelectedDeviceId) {
      const still = devices.find(d => d.id === state.spSelectedDeviceId);
      if (!still) state.spSelectedDeviceId = null;
    }
    _updatePlayBtnState();
    if (devices.length === 0) {
      _showPlaybackStatus('Kein Spotify-Gerät gefunden. Spotify öffnen, dann ↻ klicken.', false);
    }
  } catch { _showPlaybackStatus('Geräte konnten nicht geladen werden.', true); }
}

async function onPlayFromTrack(idx) {
  if (!state.spConnected) { showLoginModal(); return; }
  const deviceId = state.spSelectedDeviceId;
  if (!deviceId) {
    _showPlaybackStatus('Bitte Gerät auswählen (↻ klicken um Spotify-Geräte zu laden).', false);
    return;
  }
  const validTracks = state.generatedWod.filter(t => t.id && t.id !== 'nan');
  const uris = validTracks.map(t => 'spotify:track:' + t.id);
  if (!uris.length) { _showPlaybackStatus('Keine abspielbaren Tracks (fehlende Spotify-IDs).', true); return; }
  const clickedTrack = state.generatedWod[idx];
  const startIdx = (clickedTrack?.id && clickedTrack.id !== 'nan') ? validTracks.indexOf(clickedTrack) : 0;
  try {
    await playOnDevice(deviceId, uris, Math.max(0, startIdx));
    const devName = state.spDevices.find(d => d.id === deviceId)?.name || 'Gerät';
    _showPlaybackStatus('Wiedergabe gestartet auf ' + devName + '.', false);
  } catch { _showPlaybackStatus('Wiedergabe fehlgeschlagen — Gerät erreichbar?', true); }
}

function onPlayMain() {
  onPlayFromTrack(0);
}

// ===== REPLACE TRACK =====
function _buildUsedFromWod(wod, excludeIdx) {
  const usedIds = new Set(), usedTitleKeys = new Set(), usedArtists = new Map();
  wod.forEach((t, i) => {
    if (i === excludeIdx) return;
    usedIds.add(t.id || t.song);
    const tk = titleKey(t.song); if (tk) usedTitleKeys.add(tk);
    for (const ak of artistKeys(t.artist)) usedArtists.set(ak, (usedArtists.get(ak) || 0) + 1);
  });
  return { usedIds, usedTitleKeys, usedArtists };
}

function onReplaceTrack(idx) {
  const wod = state.generatedWod;
  if (idx < 0 || idx >= wod.length) return;
  // Track the outgoing song so it can't be re-selected in future swaps this session
  const outgoing = wod[idx];
  state.swapBlacklist.add(outgoing.id || outgoing.song);
  const { genre: ctxGenre, phase: ctxPhase } = state.generationContext;
  const pool = getPhasePoolWithNeighbours(ctxGenre, ctxPhase);
  const { usedIds, usedTitleKeys, usedArtists } = _buildUsedFromWod(wod, idx);
  state.swapBlacklist.forEach(id => usedIds.add(id));
  const prev = idx > 0 ? wod[idx - 1] : null;
  const next = idx < wod.length - 1 ? wod[idx + 1] : null;
  const maxArtist = Math.max(1, Math.floor(wod.length * 0.1));
  const replacement = pickReplacement(pool, prev, next, usedIds, usedTitleKeys, usedArtists, maxArtist, ctxPhase);
  if (!replacement) {
    const wm = document.getElementById('warn-msg');
    wm.textContent = `↺ Kein Ersatz für Slot ${idx + 1} gefunden (BPM-Übergang oder Camelot-Filter zu eng).`;
    wm.classList.add('warn-toast');
    wm.style.display = 'block';
    // Fixed-position toast (#180) — no scrollIntoView; doesn't disrupt the user's scroll position.
    setTimeout(() => { wm.style.display = 'none'; wm.classList.remove('warn-toast'); }, 6000);
    return;
  }
  state.generatedWod.splice(idx, 1, replacement);
  const logText = document.getElementById('gen-log').value;
  renderResult(state.poolGenre, state.generatedWod, state.generatedCd, [], logText);
  // Flash the replaced row to confirm the change
  requestAnimationFrame(() => {
    const replaced = document.querySelector(`.tr[data-idx="${idx}"]`);
    if (replaced) {
      replaced.classList.add('tr-replaced');
      setTimeout(() => replaced.classList.remove('tr-replaced'), 1200);
    }
  });
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
  state.swapBlacklist = new Set();
  const genre = state.poolGenre;
  state.generationContext = { genre, phase: state.currentPhase };
  const pool = getPhasePoolWithNeighbours(genre, state.currentPhase);
  const targetSec = state.wodMinutes * 60;
  const crossfadeSec = state.crossfadeSec || 0;
  const avgDur = Math.max(60, (getGenreStats()[genre] || {avg_dur: 210}).avg_dur);
  const estTracks = Math.max(1, Math.round(targetSec / avgDur));
  const rawTargetSec = crossfadeSec > 0
    ? targetSec + Math.max(0, estTracks - 1) * crossfadeSec
    : targetSec;
  const usedIds = new Set(), usedTitleKeys = new Set(), usedArtists = new Map();
  const warnMsgs = [];
  let wod = [];
  const ref = state.selectedTrack;

  // Warn if reference BPM is outside the phase's acceptable range
  {
    const cfg = PHASE_CONFIG[state.currentPhase];
    const [lo, hi] = cfg.bpm;
    if (ref.bpm < lo || ref.bpm > hi) {
      const effBpm = effectiveBpm(ref.bpm, state.currentPhase);
      if (effBpm >= lo && effBpm <= hi) {
        warnMsgs.push(`Referenz-Song (${ref.bpm} BPM) liegt außerhalb Phase ${state.currentPhase} [${lo}–${hi} BPM] — als ${effBpm} BPM gewertet (log2).`);
      } else {
        warnMsgs.push(`⚠ Referenz-Song (${ref.bpm} BPM) liegt außerhalb Phase ${state.currentPhase} [${lo}–${hi} BPM].`);
      }
    }
  }

  // #162: dispatch on progression, not the phase letter (see onPhaseSelect for the same pattern).
  const progression = PHASE_CONFIG[state.currentPhase]?.progression;
  if (progression === 'plateau') {
    wod = buildPlateau(pool, ref.bpm, usedIds, usedTitleKeys, usedArtists, rawTargetSec);
    if (!usedIds.has(ref.id || ref.song)) { wod.unshift(ref); registerTrack(ref, usedIds, usedTitleKeys, usedArtists); }

  } else if (progression === 'decreasing') {
    registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
    wod = [ref, ...buildDecreasing(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec - ref.dur)];

  } else {
    if (state.position === 'start') {
      wod = buildUp(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec, 0);

    } else if (state.position === 'end') {
      wod = buildEnd(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec, estTracks);

    } else if (state.position === 'mid') {
      registerTrack(ref, usedIds, usedTitleKeys, usedArtists);
      wod = buildAlternating(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec);

    } else if (state.position === 'plateau') {
      wod = buildPlateauSplit(pool, ref, usedIds, usedTitleKeys, usedArtists, rawTargetSec);
    }
  }

  // Cool-Down
  let cd = [];
  if (state.cdActive) {
    const cdResult = buildCooldown(genre, wod, usedIds, usedTitleKeys, usedArtists);
    cd = cdResult.cd;
    warnMsgs.push(...cdResult.warnings);
  }

  usedArtists.forEach((cnt, ak) => {
    if (cnt > Math.max(1, Math.floor(wod.length * 0.1)) + 1)
      warnMsgs.push(`"${ak}" mehrfach in Playlist (${cnt}×)`);
  });

  // Warn when pool exhausted before target duration
  const wodSec = wod.reduce((s, t) => s + (t.dur || 0), 0);
  if (wodSec < rawTargetSec * 0.85) {
    const got = Math.round(wodSec / 60), need = Math.round(rawTargetSec / 60);
    warnMsgs.push(`⚠ Pool erschöpft: ${got} min generiert von ${need} min Ziel — Genre wechseln oder Zieldauer reduzieren`);
  }

  state.generatedWod = wod;
  state.generatedCd  = cd;
  const logText = buildGenLog(genre, wod, cd, warnMsgs, _genLogContext(genre));
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
    const idx = parseInt(row.dataset.idx, 10);
    row.querySelector('.tr-replace-btn')?.addEventListener('click', () => onReplaceTrack(idx));
    row.querySelector('.tr-play-btn')?.addEventListener('click', () => onPlayFromTrack(idx));
    row.querySelector('.sp-icon')?.addEventListener('click', e => {
      window.open(`https://open.spotify.com/track/${e.currentTarget.dataset.trackId}`, '_blank');
    });
  });
  _updatePlayBtnState();

  if (state.spConnected) document.getElementById('sp-export-btn2').style.display = 'block';
  document.getElementById('csv-export-btn').style.display = 'block';
  _updateSpPlaybackSection();

  document.getElementById('gen-log').value = logText || '';

  document.getElementById('genre-space-section').style.display = 'none';

  document.getElementById('main-top').style.display = '';
  document.getElementById('result-footer').style.display = '';

  state.bpmChartData = [...wod, ...cd];
  requestAnimationFrame(() => {
    drawChart(wod.length);
    resizeGenreSpace();
    const gsCanvas = document.getElementById('genre-space-canvas');
    if (gsCanvas) initGenreSpace(gsCanvas);
    updatePlaylistMode(wod);
  });
}

// Thin download wrapper — CSV text and filename come from report.js (pure, unit-tested).
function exportCsv() {
  const all = [...state.generatedWod, ...state.generatedCd];
  if (!all.length) return;
  const csv = buildCsv(state.generatedWod, state.generatedCd);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });  // UTF-8 BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename(state.poolGenre, state.currentPhase);
  a.click();
  URL.revokeObjectURL(url);
}

// #163: derives a 3-tier (green/yellow/red) indicator from a PHASE_CONFIG range spec
// ({min}, {max}, or {min,max}) instead of fixed magic numbers. green = well within the
// phase's acceptable band; yellow = within the band but near an edge; red = outside the
// band (would be filtered out by getPhasePool for this phase). null spec (field not
// defined for this phase) → caller falls back to a neutral colour.
function _rangeColor(v, spec) {
  if (!spec) return null;
  const { min, max } = spec;
  if (min !== undefined && v < min) return '#ef4444';
  if (max !== undefined && v > max) return '#ef4444';
  const span = (max ?? min * 2) - (min ?? 0);
  const margin = Math.max(span * 0.25, 5);
  if (min !== undefined && v < min + margin) return '#f7c948';
  if (max !== undefined && v > max - margin) return '#f7c948';
  return '#1db954';
}

function _metaColor(field, v) {
  if (v == null || isNaN(v)) return 'var(--text3)';
  const cfg = PHASE_CONFIG[state.currentPhase] || {};
  switch (field) {
    // popularity is a general prominence metric, not a PHASE_CONFIG filter dimension —
    // stays a fixed, named threshold rather than a magic number scattered inline.
    case 'popularity':   return v >= 70 ? '#1db954' : v >= 40 ? '#f7c948' : 'var(--text3)';
    case 'valence':      return _rangeColor(v, cfg.valence && { min: cfg.valence[0], max: cfg.valence[1] }) || '#a855f7';
    case 'dance':        return _rangeColor(v, cfg.dance && { min: cfg.dance[0], max: cfg.dance[1] }) || 'var(--text3)';
    case 'acoustic':     return _rangeColor(v, cfg.acoustic) || 'var(--text3)';
    case 'instrumental': return _rangeColor(v, cfg.instrumental) || 'var(--text3)';
    case 'speech':       return _rangeColor(v, cfg.speech) || 'var(--text3)';
    case 'live':         return _rangeColor(v, cfg.live) || 'var(--text3)';
    case 'loud':         return _rangeColor(v, cfg.loud) || 'var(--text3)';
    default: return 'var(--text3)';
  }
}

function makeRow(idx, t, num, delta, cc, isCd, isRef) {
  const row = document.createElement('div');
  row.className = 'tr' + (isCd ? ' cooldown' : '') + (isRef ? ' ref-track' : '');
  row.dataset.idx = idx;
  const engColor = t.energy >= 90 ? '#1db954' : t.energy >= 75 ? '#a855f7' : t.energy >= 60 ? '#f7c948' : '#535353';
  const songRaw   = t.song   || '';
  const artistRaw = t.artist || '';
  const song   = songRaw.length   > 32 ? songRaw.slice(0, 30)   + '…' : songRaw;
  const artist = artistRaw.length > 28 ? artistRaw.slice(0, 26) + '…' : artistRaw;
  const explicitBadge = t.explicit ? '<span class="explicit-badge">E</span>' : '';
  const genreColor = t.avg_color || 'var(--text2)';
  let genreHtml = '';
  if (t.genres_raw && t.genres_raw.length) {
    const primary = t.decisive_genre || t.genres_raw[0];
    const rest = t.genres_raw.filter(g => g !== primary).slice(0, 2);
    const prefix = t.genre ? `<span class="tr-genre-tags">${t.genre}: </span>` : '';
    const restHtml = rest.length ? `, <span class="tr-genre-tags">${rest.join(', ')}</span>` : '';
    genreHtml = `<div class="tr-genres">${prefix}<span class="tr-genre-main" style="color:${genreColor}">${primary}</span>${restHtml}</div>`;
  } else if (t.genre) {
    genreHtml = `<div class="tr-genres"><span class="tr-genre-main" style="color:${genreColor}">${t.genre}</span></div>`;
  }
  const spLink = t.id && t.id !== 'nan' && t.id
    ? `<svg class="sp-icon" data-track-id="${t.id}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#1db954"/><path d="M16.5 16.5c-2.5-1.5-5.5-1.8-9-1" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M17.5 13.5c-3-1.8-7-2-10.5-1" stroke="white" stroke-width="1.4" stroke-linecap="round"/><path d="M18 10c-3.5-2-8-2.2-11.5-1" stroke="white" stroke-width="1.4" stroke-linecap="round"/></svg>` : '';
  const ps = calcPhaseScore(t, state.currentPhase);
  const psCls = ps >= 80 ? 'ps-green' : ps >= 50 ? 'ps-yellow' : 'ps-red';
  const m = (field, v) => `<div class="tr-meta" style="color:${_metaColor(field, v)}">${v ?? '—'}</div>`;
  row.innerHTML = `
    <div class="tr-num">${num}${isRef ? '<br><span class="ref-label">REF</span>' : ''}</div>
    <div><div class="tr-song" title="${t.song}">${explicitBadge}${song}</div><div class="tr-artist" title="${t.artist}">${artist}</div>${genreHtml}</div>
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
    <div class="tr-sp">${spLink}${!isCd ? `<button class="tr-play-btn" title="Ab hier abspielen">▶</button>` : ''}${(!isCd && !isRef) ? `<button class="tr-replace-btn" title="Track ersetzen">↺</button>` : ''}</div>`;
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
  if (genres.includes('EDM / Electronic')) genreSel.value = 'EDM / Electronic';

  const manualGenre = document.getElementById('manual-genre');
  genres.forEach(g => { const o = document.createElement('option'); o.value = g; o.textContent = g; manualGenre.appendChild(o); });
}

// ===== INIT =====
function init() {
  _renderPhaseTiles();
  // UI mode tabs (Quick / Optimizer / Advanced / Register)
  ['quick','optimizer','advanced','register'].forEach(m =>
    document.getElementById('mode-tab-' + m).addEventListener('click', () => setUiMode(m))
  );
  initRegister();
  // Quick mode
  document.getElementById('q-search').addEventListener('input', onQuickSearch);
  document.getElementById('q-search-clear').addEventListener('click', () => {
    document.getElementById('q-search').value = '';
    onQuickSearch();
  });
  document.getElementById('q-list').addEventListener('change', e => onQuickSelect(e.target));
  document.getElementById('q-gen-btn').addEventListener('click', onQuickGenerate);
  // Optimizer mode
  document.getElementById('opt-url').addEventListener('input', () => {
    const val = document.getElementById('opt-url').value.trim();
    document.getElementById('opt-url-clear').style.display = val ? '' : 'none';
    document.getElementById('opt-import-btn').disabled = !parsePlaylistId(val);
    if (!val) _optSetStatus('');
  });
  document.getElementById('opt-url-clear').addEventListener('click', () => {
    document.getElementById('opt-url').value = '';
    document.getElementById('opt-url-clear').style.display = 'none';
    document.getElementById('opt-import-btn').disabled = true;
    _optSetStatus('');
    _optShowActions(false);
  });
  document.getElementById('opt-import-btn').addEventListener('click', onOptImport);
  document.getElementById('opt-phase').addEventListener('change', () => { if (_optTracks.length) _optRunAnalysis(); });
  document.getElementById('opt-reorder-btn').addEventListener('click', onOptReorder);
  document.getElementById('opt-gaps-btn').addEventListener('click', onOptGaps);
  document.getElementById('opt-export-btn').addEventListener('click', onOptExport);
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
  document.getElementById('cam-wheel').addEventListener('click', onCamWheelClick);
  drawCamWheel();
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
  // Explicit filter chips
  ['allow','exclude','only'].forEach(m =>
    document.getElementById('explicit-' + m).addEventListener('click', () => setExplicitFilter(m))
  );
  // Settings
  document.getElementById('dur-slider').addEventListener('input', e => onDurSlider(e.target));
  document.getElementById('q-dur-slider').addEventListener('input', e => onDurSlider(e.target));
  document.getElementById('xfade-slider').addEventListener('input', e => onXfadeSlider(e.target));
  document.getElementById('cd-toggle').addEventListener('change', onCdToggle);
  document.getElementById('cam-lock-toggle').addEventListener('change', e => { state.lockCamFilter = e.target.checked; });
  document.getElementById('cam-wheel-reset').addEventListener('click', onCamWheelReset);
  // Score weight sliders and number inputs
  SW_KEYS.forEach(key => {
    document.getElementById('sw-' + key)?.addEventListener('input', e => onScoreWeightChange(key, e.target.value));
    document.getElementById('sn-' + key)?.addEventListener('input', e => onScoreWeightChange(key, e.target.value));
  });
  document.getElementById('sw-reset-btn')?.addEventListener('click', () => {
    Object.assign(state.scoreWeights, SCORE_WEIGHTS_DEFAULT);
    SW_KEYS.forEach(key => {
      const v = SCORE_WEIGHTS_DEFAULT[key];
      const sl = document.getElementById('sw-' + key);
      const nm = document.getElementById('sn-' + key);
      if (sl) sl.value = v;
      if (nm) nm.value = v;
    });
    drawScoringRadar();
    _updateSwResetVisibility();
    try { localStorage.setItem('cflu_score_weights', JSON.stringify(state.scoreWeights)); } catch (e) { void e; }
  });
  // Pool filter sliders and number inputs
  PF_KEYS.forEach(key => {
    document.getElementById('pf-' + key)?.addEventListener('input', e => onPoolFilterChange(key, e.target.value));
    document.getElementById('pfn-' + key)?.addEventListener('input', e => onPoolFilterChange(key, e.target.value));
  });
  document.getElementById('pf-reset-btn')?.addEventListener('click', () => {
    applyPhaseFilter(state.currentPhase);
  });
  document.getElementById('cd-dur-slider').addEventListener('input', e => onCdDurSlider(e.target));
  // Generate & Spotify
  document.getElementById('gen-btn').addEventListener('click', generatePlaylist);
  document.getElementById('lastfm-sync-btn').addEventListener('click', async () => {
    const btn = document.getElementById('lastfm-sync-btn');
    const msg = document.getElementById('lastfm-sync-msg');
    btn.disabled    = true;
    btn.textContent = '⏳ Sync läuft…';
    try {
      const r = await fetch('/api/lastfm/sync', {method: 'POST'});
      const d = await r.json();
      if (d.started) {
        msg.textContent = '↻ Sync gestartet…';
        msg.className   = 'upload-status info';
        _pollLastfmProgress();
      } else {
        msg.textContent = d.error || 'Sync konnte nicht gestartet werden.';
        msg.className   = 'upload-status error';
        btn.disabled    = false;
        btn.textContent = '↺ Vollständig neu synchronisieren';
      }
    } catch {
      msg.textContent = 'Fehler beim Starten des Sync.';
      msg.className   = 'upload-status error';
      btn.disabled    = false;
      btn.textContent = '↺ Vollständig neu synchronisieren';
    }
  });
  document.getElementById('sp-connect-btn').addEventListener('click', spotifyLogin);
  document.getElementById('sp-logout-btn').addEventListener('click', spotifyLogout);
  document.getElementById('sp-export-btn2').addEventListener('click', exportPlaylist);
  document.getElementById('csv-export-btn').addEventListener('click', exportCsv);
  // Device playback
  document.getElementById('sp-play-main-btn')?.addEventListener('click', onPlayMain);
  document.getElementById('sp-device-refresh')?.addEventListener('click', refreshDevices);
  document.getElementById('sp-device-sel')?.addEventListener('change', e => {
    state.spSelectedDeviceId = e.target.value || null;
    _updatePlayBtnState();
  });
  // Auth state changes
  document.addEventListener('cflu-auth-state', () => {
    _updateSpPlaybackSection();
    if (state.spConnected) refreshDevices();
  });
  document.getElementById('sp-playback-connect-btn')?.addEventListener('click', showLoginModal);

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
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLoginModal();
  });

  // Restore persisted score weights and sync to UI
  try {
    const saved = JSON.parse(localStorage.getItem('cflu_score_weights') || 'null');
    if (saved && typeof saved === 'object') {
      SW_KEYS.forEach(k => { if (typeof saved[k] === 'number') state.scoreWeights[k] = saved[k]; });
    }
  } catch (e) { void e; /* storage unavailable or invalid JSON */ }
  SW_KEYS.forEach(key => {
    const v = state.scoreWeights[key] ?? 0;
    document.getElementById('sw-' + key)?.setAttribute('value', v);
    const sl = document.getElementById('sw-' + key);
    const nm = document.getElementById('sn-' + key);
    if (sl) sl.value = v;
    if (nm) nm.value = v;
  });
  drawScoringRadar();
  _updateSwResetVisibility();

  // Derive BPM slider bounds from config constants so HTML doesn't need to be updated manually
  const bpmSliderEl = document.getElementById('bpm-slider');
  bpmSliderEl.min = BPM_SLIDER_MIN;
  bpmSliderEl.max = BPM_SLIDER_MAX;

  // Populate phase <select> options from PHASE_CONFIG so labels stay in sync
  ['q-segment', 'opt-phase'].forEach(selId => {
    const sel = document.getElementById(selId);
    sel.innerHTML = Object.entries(PHASE_CONFIG).map(([key, cfg]) =>
      `<option value="${key}"${key === 'C' ? ' selected' : ''}>${key} — ${cfg.label}</option>`
    ).join('');
  });
  document.getElementById('q-segment')?.addEventListener('change', e => applyPhaseFilter(e.target.value));

  // Populate genre dropdowns from track data (must run before onPhaseSelect reads the select)
  _initGenreDropdowns();

  // Init pool genre from filter default
  state.poolGenre = document.getElementById('genre-sel').value;

  // Default phase
  onPhaseSelect('C');


  // Spotify: check for OAuth callback (?sp_connected / ?sp_error) or existing server session.
  // checkSpotifyCallback is async and dispatches 'cflu-init-done' when complete.
  const urlParams = new URLSearchParams(window.location.search);
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

  // Init genre space on page load — canvas is always visible
  requestAnimationFrame(() => {
    const gsCanvas = document.getElementById('genre-space-canvas');
    if (gsCanvas) initGenreSpace(gsCanvas);
  });

  _checkLastfmSync();
}

document.addEventListener('DOMContentLoaded', init);
