// spotify.js — Spotify auth (server-side proxy) + playlist export + device control
// Auth: Authorization Code Flow handled by cflu_server.py — browser never holds a Spotify token.
// All Spotify API calls proxied through POST /api/spotify/call.
import { state } from './state.js';

export function showStatus(msg, type) {
  ['sp-status', 'sp-status2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.className = 'sp-status ' + type; el.style.display = 'block'; }
  });
}

// Redirect browser to server-side OAuth start — server holds credentials
export function spotifyLogin() {
  window.location.href = '/api/spotify/login';
}

export async function spotifyLogout() {
  await fetch('/api/spotify/logout').catch(() => {});
  state.spConnected = false;
  state.spDisplayName = null;
  state.spDevices = [];
  state.spSelectedDeviceId = null;
  document.getElementById('sp-connected').style.display = 'none';
  document.getElementById('sp-export-btn2').style.display = 'none';
  document.getElementById('sp-user').textContent = '';
  showStatus('Abgemeldet.', 'info');
  document.dispatchEvent(new CustomEvent('cflu-auth-state'));
}

// Called on page load — handles ?sp_connected=1 and ?sp_error=... from OAuth callback
export async function checkSpotifyCallback() {
  const p = new URLSearchParams(window.location.search);
  if (p.has('sp_error')) {
    window.history.replaceState({}, '', window.location.pathname);
    showStatus('Verbindung fehlgeschlagen: ' + p.get('sp_error'), 'error');
    return;
  }
  if (p.has('sp_connected')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  // Always refresh status from server (handles both callback and page reload with existing session)
  await checkSpotifyStatus();
  document.dispatchEvent(new CustomEvent('cflu-init-done'));
}

export async function checkSpotifyStatus() {
  try {
    const r = await fetch('/api/spotify/status');
    const data = await r.json();
    // #164: Admin Panel showed a hardcoded port/redirect URI — inject the real one so it's
    // still correct when the server runs on a non-default port.
    if (data.redirect_uri) {
      const redirectEl = document.getElementById('admin-redirect-uri');
      if (redirectEl) redirectEl.textContent = data.redirect_uri;
    }
    if (data.port) {
      const browserEl = document.getElementById('admin-browser-url');
      if (browserEl) browserEl.textContent = `http://127.0.0.1:${data.port}/CFLU_WOD_Builder.html`;
    }
    if (data.connected) {
      state.spConnected = true;
      state.spDisplayName = data.display_name;
      document.getElementById('sp-user').textContent = data.display_name;
      document.getElementById('sp-connected').style.display = 'block';
      if (state.generatedWod.length) document.getElementById('sp-export-btn2').style.display = 'block';
      showStatus('✓ Verbunden!', 'info');
      document.dispatchEvent(new CustomEvent('cflu-auth-state'));
    }
  } catch { /* network error — non-fatal */ }
}

// ===== API PROXY =====

// Proxy a Spotify API call through the local server.
// Returns parsed JSON, or null for 204 No Content / parse errors.
export async function spotifyCall(method, path, body = null) {
  const r = await fetch('/api/spotify/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, body }),
  });
  if (r.status === 204) return null;
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    console.error('Spotify API error', r.status, path, err);
    throw Object.assign(new Error('Spotify API error ' + r.status), { status: r.status, detail: err });
  }
  return r.json().catch(() => null);
}

// ===== DEVICE CONTROL =====

export async function getDevices() {
  const data = await spotifyCall('GET', '/me/player/devices');
  return data?.devices || [];
}

export async function playOnDevice(deviceId, uris, startIndex = 0) {
  await spotifyCall('PUT', `/me/player/play?device_id=${deviceId}`, {
    uris,
    offset: { position: startIndex },
  });
}

// ===== PLAYLIST EXPORT =====

export async function exportPlaylist() {
  if (!state.spConnected) {
    showStatus('Zuerst verbinden.', 'error');
    return;
  }
  const all = [...state.generatedWod, ...state.generatedCd];
  if (!all.length) { showStatus('Keine Playlist.', 'error'); return; }
  const name = document.getElementById('pl-name').value || 'CFLU WOD';
  showStatus('Erstelle Playlist...', 'info');
  try {
    const pl = await spotifyCall('POST', '/me/playlists', {
      name, description: 'CFLU WOD Playlist Builder', public: false,
    });
    if (!pl?.id) {
      console.error('Spotify playlist create error:', pl);
      showStatus('Playlist-Erstellung fehlgeschlagen.', 'error');
      return;
    }
    showStatus('Füge Tracks hinzu...', 'info');
    const uris = all.filter(t => t.id && t.id !== 'nan').map(t => 'spotify:track:' + t.id);
    for (let i = 0; i < uris.length; i += 100) { // max 100 URIs per API call (Invariant 3)
      await spotifyCall('POST', `/playlists/${pl.id}/items`, { uris: uris.slice(i, i + 100) });
    }
    showStatus('✓ Exportiert!', 'info');
    document.getElementById('sp-link-wrap').classList.remove('hidden');
    document.getElementById('sp-pl-link').href = pl.external_urls?.spotify || '#';
  } catch { showStatus('Export-Fehler. Verbindung prüfen.', 'error'); }
}
