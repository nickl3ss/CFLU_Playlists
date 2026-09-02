// report.js — pure formatting for generation log + CSV export; no DOM, no state, no Spotify calls
import { PHASE_CONFIG, CAM_ZONE1, CAM_ZONE2, SCORE_WEIGHTS_DEFAULT, POOL_FILTER_DEFAULT } from './config.js';
import { fmtDur, fmtMin, camCompat, calcPhaseScore, isHalfDouble } from './utils.js';

// ===== GENERATION LOG =====
// Pure: every value that used to be read from `state` (or derived from the pool) arrives via `ctx`,
// a snapshot gathered by app.js at generation time:
//   phase, ref (selected track or null), position, wodMinutes, crossfadeSec, wodEnergyMin, wodEnergyMax,
//   scoreWeights, poolFilter, cdActive, cdMinutes, camLetter, camNumbers,
//   directPoolSize (Phase-Pool of the genre), fullPoolSize (incl. neighbour genres), now (Date, injectable for tests)
// Returns the plain-text log shown in the #gen-log textarea (and copied to the clipboard).
export function buildGenLog(genre, wod, cd, warnMsgs, ctx = {}) {
  const { phase, ref = null, position, wodMinutes, crossfadeSec = 0, wodEnergyMin, wodEnergyMax,
          scoreWeights = SCORE_WEIGHTS_DEFAULT, poolFilter = POOL_FILTER_DEFAULT,
          cdActive = false, cdMinutes, camLetter = 'both', camNumbers = [],
          directPoolSize = 0, fullPoolSize = 0, now = new Date() } = ctx;
  const dateStr = now.toLocaleDateString('de-DE') + '  ' + now.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
  const phaseCfg = PHASE_CONFIG[phase];
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
    add(`  Position:        ${posLabels[position] || position}`);
  }
  add(`  WOD-Dauer:       ${wodMinutes} min`);
  if (crossfadeSec > 0) add(`  Crossfade:       ${crossfadeSec}s (Spotify Mixing)`);
  add(`  Energy-Bereich:  ${wodEnergyMin}–${wodEnergyMax}`);
  const sw = scoreWeights;
  add(`  Score-Gewichte:  E:${sw.energy} Loud:${sw.loudness} Val:${sw.valence} Dance:${sw.dance} Pop:${sw.popularity}`);
  const pf = poolFilter;
  const pfParts = [];
  if (pf.minBpm > 0 || pf.maxBpm < 220) pfParts.push(`BPM:${pf.minBpm}–${pf.maxBpm}`);
  if (pf.minEnergy > 0) pfParts.push(`E≥${pf.minEnergy}`);
  if (pf.minValence > 0) pfParts.push(`Val≥${pf.minValence}`);
  if (pf.minDance > 0) pfParts.push(`Dce≥${pf.minDance}`);
  if (pf.minPopularity > 0) pfParts.push(`Pop≥${pf.minPopularity}`);
  if (pfParts.length) add(`  Swap-Filter:     ${pfParts.join('  ')}  (gilt für Tausch-Kandidaten)`);
  if (cdActive) add(`  Cool-Down:       aktiv · ${cdMinutes} min`);
  if (camLetter !== 'both' || camNumbers.length > 0) {
    const parts = [];
    if (camLetter !== 'both') parts.push('Buchstabe: ' + camLetter);
    if (camNumbers.length > 0) parts.push('Zahlen: ' + camNumbers.join(' '));
    add(`  Tonart-Filter:   ${parts.join('  ·  ')}`);
  }
  add('');
  add(sep);
  add('POOL');
  add(`  Phase-${phase}-Pool (${genre}):  ${directPoolSize} Tracks`);
  if (fullPoolSize > directPoolSize)
    add(`  Mit Nachbar-Genres:              ${fullPoolSize} Tracks`);
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
    let delta = 'REF';
    if (prev) {
      const rawD = (t.bpm >= prev.bpm ? '+' : '') + (t.bpm - prev.bpm);
      const hd   = isHalfDouble(prev.bpm, t.bpm);
      delta = rawD + (hd ? (t.bpm < prev.bpm ? '÷2' : '×2') : '');
    }
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
        reason = 'Camelot -';
      }
    }
    if (t.genre) reason += (reason ? '  | ' : '') + `Genre: ${t.genre}${!isRef && t.genre !== genre ? ' (Fallback)' : ''}`;
    add(`${rpad(i+1,3)}  ${pad(t.song,30)}  ${pad(t.artist,20)}  ${rpad(t.bpm,3)}  ${rpad(delta,5)}  ${camStr}  ${rpad(t.energy,3)}  ${rpad(ps,3)}  ${reason}`);
  });

  if (cd.length) {
    add('');
    add(`--- Cool-Down (${cdMinutes} min) ---`);
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
  const xfadeLog = crossfadeSec || 0;
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

// ===== CSV EXPORT =====
export const CSV_HEADER = ['Nr', 'Artist', 'Title', 'BPM', 'Camelot', 'Energy', 'Duration', 'Genre'];

// RFC-4180 style: a field is quoted only when it contains a comma, a double quote or a newline;
// embedded double quotes are doubled. Everything else is written verbatim.
export function csvEscape(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// CSV text for WOD + Cool-Down tracks (numbered continuously), CRLF line breaks, no trailing newline.
// No BOM — the download wrapper in app.js prepends it.
export function buildCsv(wod, cd = []) {
  const all = [...wod, ...cd];
  const rows = [CSV_HEADER];
  all.forEach((t, i) => {
    const mm = Math.floor((t.dur || 0) / 60);
    const ss = String((t.dur || 0) % 60).padStart(2, '0');
    rows.push([i + 1, t.artist, t.song, t.bpm, t.camelot || '', t.energy, `${mm}:${ss}`, t.genre || '']);
  });
  return rows.map(r => r.map(csvEscape).join(',')).join('\r\n');
}

// CFLU_WOD_<Genre>_Phase<X>_<YYYY-MM-DD>.csv — genre sanitised to [a-zA-Z0-9] (everything else → '_'),
// max 20 chars, 'Mix' when empty. dateStr defaults to today (ISO date) and is injectable for tests.
export function csvFilename(genre, phase, dateStr = new Date().toISOString().slice(0, 10)) {
  const safeName = (genre || 'Mix').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
  return `CFLU_WOD_${safeName}_Phase${phase}_${dateStr}.csv`;
}
