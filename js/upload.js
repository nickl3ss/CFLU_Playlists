// Pure, Node-testable exports
export function sanitizeFilename(name) {
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
  if (updated) parts.push(`${updated} aktualisiert`);
  parts.push(`${total} gesamt`);
  return '✓ Pool aktualisiert: ' + parts.join(', ');
}

export function classifyUploadResult(data) {
  if (!data.ok) return { type: 'error', msg: '✗ ' + (data.error || 'Fehler') };
  if (data.added === 0 && data.updated === 0)
    return { type: 'warning', msg: '⚠ Keine neuen Tracks — CSV-Format prüfen (benötigt: Song, Artist, BPM, Camelot, …)' };
  return { type: 'success', msg: formatUploadSuccess(data) };
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
        const result = classifyUploadResult(data);
        statusEl.textContent = result.msg;
        statusEl.className = 'upload-status ' + result.type;
        if (result.type === 'success') {
          reloadBtn.style.display = 'block';
        } else {
          uploadBtn.disabled = false;
        }
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

if (typeof document !== 'undefined') _initUpload();
