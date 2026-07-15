// upload.js — CSV upload UI (standalone <script> in HTML) + exported pure helpers (Node.js-safe)
export function sanitizeFilename(name) {
  // eslint-disable-next-line no-control-regex -- intentional: NTFS-illegal control chars
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'Upload';
}

export function extractPlaylistName(csvContent, fallback) {
  for (const line of csvContent.split('\n').slice(0, 5)) {
    const m = line.match(/^#\s*Playlist[:\s]+(.+)/i);
    if (m && m[1].trim()) return m[1].trim();
  }
  return fallback;
}

export function formatUploadSuccess({ added, updated, total }) {
  const parts = [];
  if (added) parts.push(`${added} neu`);
  if (updated) parts.push(`${updated} bereits im Pool`);
  parts.push(`${total} gesamt`);
  return '✓ Pool aktualisiert: ' + parts.join(', ');
}

export function classifyUploadResult(data) {
  if (!data.ok) return { type: 'error', msg: '✗ ' + (data.error || 'Fehler') };
  if (data.added === 0 && data.updated === 0)
    return { type: 'warning', msg: '⚠ Keine neuen Tracks — CSV-Format prüfen (benötigt: Song, Artist, BPM, Camelot, …)' };
  if (data.added === 0 && data.updated > 0)
    return { type: 'warning', msg: `⚠ Alle Tracks bereits im Pool (${data.updated} Doubletten, ${data.total} gesamt)` };
  return { type: 'success', msg: formatUploadSuccess(data) };
}

// Polls /api/upload-status until the background ETL run finishes, then renders the result
// via classifyUploadResult (same success/warning/error shape the old synchronous path used).
async function _pollUploadStatus(statusEl, uploadBtn, reloadBtn) {
  const POLL_MS = 700;
  const MAX_POLLS = 900; // ~10.5 min hard stop — a stuck build shouldn't poll forever
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_MS));
    let state;
    try {
      state = await (await fetch('/api/upload-status')).json();
    } catch {
      continue; // transient network hiccup — keep polling
    }
    if (state.running) continue;
    const result = classifyUploadResult({
      ok: !state.error, error: state.error,
      added: state.added, updated: state.updated, total: state.total,
    });
    statusEl.textContent = result.msg;
    statusEl.className = 'upload-status ' + result.type;
    if (result.type === 'success') {
      reloadBtn.style.display = 'block';
    } else {
      uploadBtn.disabled = false;
    }
    return;
  }
  statusEl.textContent = '⚠ Pool-Build dauert ungewöhnlich lange — Server-Log prüfen.';
  statusEl.className = 'upload-status warning';
  uploadBtn.disabled = false;
}

function _initUpload() {
  const fileInput  = document.getElementById('upload-file');
  const fileLabel  = document.getElementById('upload-label');
  const uploadBtn  = document.getElementById('upload-btn');
  const statusEl   = document.getElementById('upload-status');
  const reloadBtn  = document.getElementById('upload-reload-btn');

  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (f) {
      const base  = f.name.replace(/\.csv$/i, '');
      const clean = sanitizeFilename(base);
      fileLabel.textContent = clean !== base ? `${f.name} → ${clean}.csv` : f.name;
    } else {
      fileLabel.textContent = 'Keine Datei gewählt';
    }
    uploadBtn.disabled = !fileInput.files.length;
    statusEl.textContent = '';
    statusEl.className = 'upload-status';
    reloadBtn.style.display = 'none';
  });

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    uploadBtn.disabled = true;
    statusEl.textContent = 'Lädt hoch…';
    statusEl.className = 'upload-status info';

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const resp = await fetch('/api/upload-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, content: e.target.result }),
        });
        const data = await resp.json();
        if (!resp.ok || !data.ok) {
          const result = classifyUploadResult({ ok: false, error: data.error });
          statusEl.textContent = result.msg;
          statusEl.className = 'upload-status ' + result.type;
          uploadBtn.disabled = false;
          return;
        }
        statusEl.textContent = '⏳ Pool wird aktualisiert…';
        statusEl.className = 'upload-status info';
        await _pollUploadStatus(statusEl, uploadBtn, reloadBtn);
      } catch {
        statusEl.textContent = '✗ Server nicht erreichbar';
        statusEl.className = 'upload-status error';
        uploadBtn.disabled = false;
      }
    };
    reader.readAsText(file, 'utf-8');
  });

  // Navigate to ?pool_updated=1 so init() can suppress the login modal after reload
  reloadBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('pool_updated', '1');
    location.href = url.toString();
  });
}

function _initContactLinks() {
  // Decode base64-encoded contact fields (name, address) — no plaintext in HTML source.
  document.querySelectorAll('.rp-encoded[data-b64]').forEach(el => {
    el.textContent = decodeURIComponent(atob(el.dataset.b64));
  });
  // Assemble email from split parts — no user@domain pattern in HTML source.
  document.querySelectorAll('a.rp-contact-link[data-u][data-h][data-t]').forEach(el => {
    const email = `${el.dataset.u}@${el.dataset.h}.${el.dataset.t}`;
    el.href = `mailto:${email}`;
    el.textContent = email;
  });
}

if (typeof document !== 'undefined') { _initUpload(); _initContactLinks(); }
