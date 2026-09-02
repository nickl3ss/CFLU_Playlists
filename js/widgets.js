// widgets.js — SVG widgets (Camelot wheel, scoring/filter radar); reads state, writes DOM only; no business logic, no Spotify calls
import { POOL_FILTER_DEFAULT } from './config.js';
import { state } from './state.js';

// ===== SCORING RADAR =====
// BPM and Camelot are fixed internal weights (not user-adjustable).
export const SW_KEYS = ['energy', 'loudness', 'valence', 'dance', 'popularity'];
const _SW_LABELS = ['E', 'Loud', 'Val', 'Dance', 'Pop'];

export function drawScoringRadar() {
  const svg = document.getElementById('scoring-radar');
  if (!svg) return;
  const cx = 100, cy = 100, r = 72;
  const n = SW_KEYS.length;
  const angle = i => (i * 2 * Math.PI / n) - Math.PI / 2; // BPM at top

  const pt = (i, frac) => {
    const a = angle(i);
    return [cx + frac * r * Math.cos(a), cy + frac * r * Math.sin(a)];
  };

  let html = '';

  // Concentric rings at 25/50/75/100
  for (const pct of [0.25, 0.5, 0.75, 1.0]) {
    const pts = Array.from({length: n}, (_, i) => pt(i, pct).join(',')).join(' ');
    html += `<polygon points="${pts}" fill="none" stroke="#333" stroke-width="1"/>`;
  }

  // Axis lines
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 1.0);
    html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#333" stroke-width="1"/>`;
  }

  // Labels
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 1.18);
    const anchor = Math.abs(Math.cos(angle(i))) < 0.1 ? 'middle'
      : Math.cos(angle(i)) < 0 ? 'end' : 'start';
    html += `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" fill="#888" font-size="9" font-family="monospace">${_SW_LABELS[i]}</text>`;
  }

  // Data polygon
  const vals = SW_KEYS.map(k => Math.max(0, Math.min(100, state.scoreWeights[k] || 0)) / 100);
  const polyPts = vals.map((v, i) => pt(i, v).join(',')).join(' ');
  html += `<polygon points="${polyPts}" fill="#1db954" fill-opacity="0.35" stroke="#1db954" stroke-width="1.5"/>`;

  svg.innerHTML = html;
}

// ===== CAMELOT WHEEL =====
const _CAM_COLORS = [
  null,       // 0 — unused (1-indexed)
  '#f04040',  // 1
  '#f07820',  // 2
  '#e8c020',  // 3
  '#90cc20',  // 4
  '#1db954',  // 5 — Spotify green
  '#18b87a',  // 6
  '#18b0cc',  // 7
  '#2090e0',  // 8
  '#4060e8',  // 9
  '#8040e0',  // 10
  '#cc30c8',  // 11
  '#e82070',  // 12
];

// #197: darken via HSL lightness rather than raw RGB scaling. RGB×0.55 dims perceptually
// unevenly (the eye reads green as brighter than blue at equal RGB) — HSL lightness scaling
// is uniform across all 12 wheel colours.
function _camDarken(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const l2 = l * 0.55;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l2;
  } else {
    const q = l2 < 0.5 ? l2 * (1 + s) : l2 + s - l2 * s;
    const p = 2 * l2 - q;
    r2 = hue2rgb(p, q, h + 1 / 3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1 / 3);
  }
  return `rgb(${Math.round(r2 * 255)},${Math.round(g2 * 255)},${Math.round(b2 * 255)})`;
}

function _camArcPath(cx, cy, r1, r2, startDeg, endDeg) {
  const rad = d => d * Math.PI / 180;
  const s = rad(startDeg), e = rad(endDeg);
  const f = n => n.toFixed(2);
  const x1 = cx + r1 * Math.cos(s), y1 = cy + r1 * Math.sin(s);
  const x2 = cx + r2 * Math.cos(s), y2 = cy + r2 * Math.sin(s);
  const x3 = cx + r2 * Math.cos(e), y3 = cy + r2 * Math.sin(e);
  const x4 = cx + r1 * Math.cos(e), y4 = cy + r1 * Math.sin(e);
  return `M${f(x1)},${f(y1)} L${f(x2)},${f(y2)} A${r2},${r2},0,0,1,${f(x3)},${f(y3)} L${f(x4)},${f(y4)} A${r1},${r1},0,0,0,${f(x1)},${f(y1)} Z`;
}

export function drawCamWheel() {
  const svg = document.getElementById('cam-wheel');
  if (!svg) return;
  svg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const cx = 90, cy = 90;
  const rA1 = 34, rA2 = 60;  // inner ring = A (minor)
  const rB1 = 61, rB2 = 84;  // outer ring = B (major)
  const GAP = 1.8;
  const { camLetter, camNumbers } = state;
  const allNums = camNumbers.length === 0;
  const hasA = camLetter === 'A' || camLetter === 'both';
  const hasB = camLetter === 'B' || camLetter === 'both';
  const NEUTRAL = '#1e1e1e';
  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  for (let n = 1; n <= 12; n++) {
    const midDeg   = (n - 1) * 30 - 90;
    const startDeg = midDeg - 15 + GAP;
    const endDeg   = midDeg + 15 - GAP;
    const midRad   = midDeg * Math.PI / 180;
    const col      = _CAM_COLORS[n];
    const numSel   = allNums || camNumbers.includes(n);

    svg.appendChild(mk('path', {
      d: _camArcPath(cx, cy, rA1, rA2, startDeg, endDeg),
      fill: (hasA && numSel) ? _camDarken(col) : NEUTRAL,
      'data-cam-n': n,
    }));

    svg.appendChild(mk('path', {
      d: _camArcPath(cx, cy, rB1, rB2, startDeg, endDeg),
      fill: (hasB && numSel) ? col : NEUTRAL,
      'data-cam-n': n,
    }));

    const labelR = (rA1 + rA2) / 2;
    const lbl = mk('text', {
      x: (cx + labelR * Math.cos(midRad)).toFixed(1),
      y: (cy + labelR * Math.sin(midRad)).toFixed(1),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': '9',
      'font-weight': '700',
      'font-family': 'var(--ff-mono)',
      fill: numSel && (hasA || hasB) ? '#fff' : '#444',
      'pointer-events': 'none',
    });
    lbl.textContent = n;
    svg.appendChild(lbl);
  }

  // Ring labels in center
  [['A', cy - 7, '#666'], ['B', cy + 7, '#999']].forEach(([t, y, fill]) => {
    const el = mk('text', { x: cx, y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': '8', 'font-family': 'var(--ff-mono)', fill, 'pointer-events': 'none' });
    el.textContent = t;
    svg.appendChild(el);
  });
}

// ===== POOL FILTER RADAR =====
export const PF_KEYS   = ['minBpm', 'maxBpm', 'minEnergy', 'minValence', 'minDance', 'minPopularity'];
const _PF_LABELS = ['BPM↓', 'BPM↑', 'E≥', 'Val≥', 'Dce≥', 'Pop≥'];
export const PF_MAX    = { minBpm: 220, maxBpm: 220, minEnergy: 100, minValence: 100, minDance: 100, minPopularity: 100 };

export function drawFilterRadar() {
  const svg = document.getElementById('filter-radar');
  if (!svg) return;
  const cx = 100, cy = 100, r = 72;
  const n = PF_KEYS.length;
  const angle = i => (i * 2 * Math.PI / n) - Math.PI / 2;

  const pt = (i, frac) => {
    const a = angle(i);
    return [cx + frac * r * Math.cos(a), cy + frac * r * Math.sin(a)];
  };

  let html = '';
  for (const pct of [0.25, 0.5, 0.75, 1.0]) {
    const pts = Array.from({length: n}, (_, i) => pt(i, pct).join(',')).join(' ');
    html += `<polygon points="${pts}" fill="none" stroke="#333" stroke-width="1"/>`;
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 1.0);
    html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#333" stroke-width="1"/>`;
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, 1.18);
    const anchor = Math.abs(Math.cos(angle(i))) < 0.1 ? 'middle'
      : Math.cos(angle(i)) < 0 ? 'end' : 'start';
    html += `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" fill="#888" font-size="9" font-family="monospace">${_PF_LABELS[i]}</text>`;
  }
  // "Permissiveness" view: full polygon (1.0) = default = pool fully open.
  // Restrictions shrink the polygon on the corresponding axis.
  //   minBpm:  0 (no floor)  → 1.0;   high floor  → smaller
  //   maxBpm:  220 (no ceil) → 1.0;   low ceiling → smaller
  //   min*:    0 (no filter) → 1.0;   high min    → smaller
  const vals = PF_KEYS.map(k => {
    const raw = Math.max(0, Math.min(PF_MAX[k], state.poolFilter[k] ?? POOL_FILTER_DEFAULT[k]));
    return k === 'maxBpm' ? raw / PF_MAX[k] : 1 - raw / PF_MAX[k];
  });
  const polyPts = vals.map((v, i) => pt(i, v).join(',')).join(' ');
  html += `<polygon points="${polyPts}" fill="#f7c948" fill-opacity="0.35" stroke="#f7c948" stroke-width="1.5"/>`;
  svg.innerHTML = html;
}
