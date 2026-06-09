// chart.js — BPM step-chart and bidirectional hover sync; reads state, writes canvas only; no Spotify, no generation logic
import { state } from './state.js';

export function drawChart(wodCount) {
  const canvas = document.getElementById('bpm-canvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 800;
  const H = canvas.offsetHeight || 80;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  state.chartCtx = canvas.getContext('2d');
  state.chartCtx.scale(dpr, dpr);
  _drawChart(wodCount, -1);

  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    if (!state.bpmChartData.length) return;
    const pad = {l:36, r:12, t:8, b:22};
    const w = W - pad.l - pad.r;
    const totalD = state.bpmChartData.reduce((s, t) => s + (t.dur || 210), 0);
    const tRatio = Math.max(0, Math.min(1, (mx - pad.l) / w));
    let cumA = 0, clamped = state.bpmChartData.length - 1;
    for (let i = 0; i < state.bpmChartData.length; i++) {
      cumA += (state.bpmChartData[i].dur || 210);
      if (cumA / totalD >= tRatio) { clamped = i; break; }
    }
    if (clamped !== state.hoveredTrackIdx) {
      state.hoveredTrackIdx = clamped;
      _drawChart(wodCount, clamped);
      highlightFromChart(clamped);
    }
  };
  canvas.onmouseleave = () => {
    state.hoveredTrackIdx = -1;
    _drawChart(wodCount, -1);
    clearHighlight();
  };
}

export function _drawChart(wodCount, hoverIdx) {
  const canvas = document.getElementById('bpm-canvas');
  if (!canvas || !state.chartCtx || !state.bpmChartData.length) return;
  const W = canvas.offsetWidth || 800;
  const H = canvas.offsetHeight || 80;
  const bpms = state.bpmChartData.map(t => t.bpm);
  const minB = Math.min(...bpms) - 5, maxB = Math.max(...bpms) + 5;
  const pad = {l:36, r:12, t:8, b:22};
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
  const ctx = state.chartCtx;
  ctx.clearRect(0, 0, W * (window.devicePixelRatio || 1), H * (window.devicePixelRatio || 1));
  ctx.save();

  // Cumulative time positions
  const cumDur = []; let cumAcc = 0;
  state.bpmChartData.forEach(t => { cumDur.push(cumAcc); cumAcc += (t.dur || 210); });
  const totalDur = cumAcc || 1;
  const wodDur = state.bpmChartData.slice(0, wodCount).reduce((s, t) => s + (t.dur || 210), 0);

  // Y-axis grid
  [.25, .5, .75, 1].forEach(f => {
    const y = pad.t + h * (1 - f);
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.font = '8px IBM Plex Mono,monospace'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(minB + (maxB - minB) * f), 2, y + 3);
  });

  // X-axis time grid
  const totalMin = totalDur / 60;
  const stepMin = totalMin < 10 ? 1 : totalMin < 20 ? 2 : totalMin < 50 ? 5 : 10;
  const stepSec = stepMin * 60;
  ctx.font = '8px IBM Plex Mono,monospace'; ctx.textAlign = 'center';
  for (let ts = stepSec; ts < totalDur; ts += stepSec) {
    const x = pad.l + (ts / totalDur) * w;
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillText(Math.floor(ts / 60) + ':00', x, H - pad.b + 11);
  }

  // Track points
  const pts = state.bpmChartData.map((t, i) => ({
    x: pad.l + (cumDur[i] / totalDur) * w,
    y: pad.t + h * (1 - (t.bpm - minB) / (maxB - minB)),
    cd: i >= wodCount,
  }));

  // Step path (horizontal per track, vertical at transitions)
  function stepPath(ctx, close) {
    ctx.moveTo(pts[0].x, close ? H - pad.b : pts[0].y);
    if (close) ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length; i++) {
      const ex = i < pts.length - 1 ? pts[i + 1].x : pad.l + w;
      ctx.lineTo(ex, pts[i].y);
      if (i < pts.length - 1) ctx.lineTo(ex, pts[i + 1].y);
    }
    if (close) { ctx.lineTo(pad.l + w, H - pad.b); ctx.closePath(); }
  }

  // Fill — split at WOD/Cool-Down boundary
  const acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#ffffff';
  const grad = ctx.createLinearGradient(pad.l, 0, W - pad.r, 0);
  const sp = wodDur / totalDur;
  grad.addColorStop(0, acc + '1f');
  grad.addColorStop(Math.min(sp, .99), acc + '1f');
  if (wodCount < state.bpmChartData.length) {
    grad.addColorStop(Math.min(sp + .001, 1), 'rgba(168,85,247,.08)');
    grad.addColorStop(1, 'rgba(168,85,247,.08)');
  }
  ctx.beginPath(); stepPath(ctx, true);
  ctx.fillStyle = grad; ctx.fill();

  // Step line
  ctx.beginPath(); stepPath(ctx, false);
  ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke();

  // WOD end marker
  const wodTargetSec = Math.min(state.wodMinutes * 60, totalDur);
  const wx = pad.l + (wodTargetSec / totalDur) * w;
  ctx.strokeStyle = 'rgba(100,140,175,.75)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(wx, pad.t); ctx.lineTo(wx, H - pad.b); ctx.stroke();

  // Dots
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === hoverIdx ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = i === hoverIdx ? '#fff' : p.cd ? '#a855f7' : acc;
    ctx.fill();
    if (i === hoverIdx) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
  });

  // Hover vertical line + tooltip
  if (hoverIdx >= 0 && hoverIdx < pts.length) {
    const p = pts[hoverIdx];
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(p.x, pad.t); ctx.lineTo(p.x, H - pad.b); ctx.stroke();
    ctx.setLineDash([]);
    const t = state.bpmChartData[hoverIdx];
    const label = t.bpm + ' BPM — ' + t.song;
    ctx.font = 'bold 9px IBM Plex Mono,monospace';
    const tw = ctx.measureText(label).width;
    const tx = Math.min(Math.max(p.x - tw / 2, pad.l), W - pad.r - tw);
    const ty = p.y > H / 2 ? p.y - 8 : p.y + 16;
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(tx - 4, ty - 10, tw + 8, 14);
    ctx.fillStyle = '#fff'; ctx.fillText(label, tx, ty);
  }
  ctx.restore();
}

export function highlightFromRow(idx) {
  clearHighlight();
  const rows = document.querySelectorAll('.tr');
  if (rows[idx]) rows[idx].classList.add('hovered');
  if (state.bpmChartData.length) _drawChart(state.generatedWod.length, idx);
}

function highlightFromChart(idx) {
  clearHighlight();
  const rows = document.querySelectorAll('.tr');
  if (rows[idx]) {
    rows[idx].classList.add('hovered');
    rows[idx].scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }
}

export function clearHighlight() {
  document.querySelectorAll('.tr.hovered').forEach(r => r.classList.remove('hovered'));
}
