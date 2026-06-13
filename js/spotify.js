// spotify.js — PKCE auth, playlist export, and Web Playback SDK; Client ID must NEVER go to localStorage (Key Invariant 2); max 100 tracks (Invariant 3)
import { state } from './state.js';

const REDIRECT_URI = 'http://127.0.0.1:8888/CFLU_WOD_Builder.html';
// Spotify access tokens expire after 3600 s; we treat them as expired after 55 min.
const TOKEN_TTL_MS = 55 * 60 * 1000;

export function showStatus(msg, type) {
  ['sp-status', 'sp-status2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.className = 'sp-status ' + type; el.style.display = 'block'; }
  });
}

export function spotifyLogin() {
  const cid = document.getElementById('sp-cid').value.trim();
  if (!cid) { showStatus('Bitte Client ID eingeben.', 'error'); return; }
  const v = generateVerifier();
  sessionStorage.setItem('pkce_v', v);
  sessionStorage.setItem('sp_cid', cid);
  generateChallenge(v).then(ch => {
    const p = new URLSearchParams({
      response_type: 'code', client_id: cid,
      // S-01: streaming + playback-state scopes added for Web Playback SDK (Issue #146)
      scope: 'playlist-modify-private streaming user-read-playback-state user-modify-playback-state',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256', code_challenge: ch,
      show_dialog: 'true', // always force consent dialog — ensures streaming scope is granted
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + p;
  });
}

export function spotifyLogout() {
  state.spPlayer?.disconnect();
  state.spPlayer = null;
  state.spDeviceId = null;
  state.spPlayingIdx = -1;
  state.spToken = null;
  state.spUserId = null;
  state.spTokenExpiry = 0;
  sessionStorage.removeItem('pkce_v');
  sessionStorage.removeItem('sp_cid');
  const bar = document.getElementById('sp-player-bar');
  if (bar) bar.style.display = 'none';
  document.getElementById('sp-connected').style.display = 'none';
  document.getElementById('sp-export-btn2').style.display = 'none';
  document.getElementById('sp-user').textContent = '';
  showStatus('Abgemeldet.', 'info');
  document.dispatchEvent(new CustomEvent('cflu-auth-state'));
}

function isTokenValid() {
  return state.spToken && Date.now() < (state.spTokenExpiry || 0);
}

function generateVerifier() {
  const a = new Uint8Array(64);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateChallenge(v) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function checkSpotifyCallback() {
  const p = new URLSearchParams(window.location.search);
  const code = p.get('code');
  if (!code) return;
  const v = sessionStorage.getItem('pkce_v'), cid = sessionStorage.getItem('sp_cid');
  if (!v || !cid) return;
  window.history.replaceState({}, '', window.location.pathname);
  showStatus('Verbinde...', 'info');
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, client_id: cid,
        redirect_uri: REDIRECT_URI, code_verifier: v,
      }),
    });
    const data = await r.json();
    if (data.access_token) {
      state.spToken = data.access_token;
      state.spTokenExpiry = Date.now() + TOKEN_TTL_MS;
      const me = await (await fetch('https://api.spotify.com/v1/me', {headers: {Authorization: 'Bearer ' + state.spToken}})).json();
      state.spUserId = me.id;
      document.getElementById('sp-user').textContent = me.display_name || me.id;
      document.getElementById('sp-connected').style.display = 'block';
      if (state.generatedWod.length) document.getElementById('sp-export-btn2').style.display = 'block';
      showStatus('✓ Verbunden!', 'info');
      sessionStorage.removeItem('pkce_v');
      sessionStorage.removeItem('sp_cid');
      document.dispatchEvent(new CustomEvent('cflu-auth-state'));
      initSpotifyPlayer(data.access_token); // fire-and-forget — non-fatal if SDK unavailable
    } else {
      // S-03: Kein JSON.stringify(data) — Spotify-Fehldetails nicht in die UI
      console.error('Spotify auth error:', data);
      showStatus('Verbindung fehlgeschlagen. Bitte Client ID und Redirect URI prüfen.', 'error');
    }
  } catch { showStatus('Verbindung fehlgeschlagen. Netzwerk prüfen.', 'error'); }
}

// ===== WEB PLAYBACK SDK =====

function _loadSpotifySdk() {
  return new Promise(resolve => {
    if (window.Spotify) { resolve(); return; }
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(s);
  });
}

export async function initSpotifyPlayer(token) {
  try {
    await _loadSpotifySdk();
    const player = new window.Spotify.Player({
      name: 'CFLU WOD Player',
      getOAuthToken: cb => cb(token),
      volume: 0.8,
    });
    player.addListener('ready', ({ device_id }) => {
      state.spDeviceId = device_id;
      const bar = document.getElementById('sp-player-bar');
      if (bar) bar.style.display = '';
    });
    player.addListener('not_ready', () => {
      state.spDeviceId = null;
    });
    player.addListener('initialization_error', ({ message }) => {
      showStatus('Browser-Wiedergabe nicht verfügbar: ' + message, 'error');
    });
    player.addListener('authentication_error', () => {
      showStatus('Wiedergabe: Bitte neu verbinden (neue Berechtigungen erforderlich).', 'error');
    });
    player.addListener('account_error', () => {
      showStatus('Browser-Wiedergabe erfordert Spotify Premium.', 'error');
    });
    player.addListener('player_state_changed', st => {
      if (!st) return;
      document.dispatchEvent(new CustomEvent('cflu-player-state', { detail: st }));
    });
    state.spPlayer = player;
    await player.connect();
  } catch { /* SDK load failure is non-fatal — export still works */ }
}

export async function playPlaylist(uris, startIndex = 0) {
  if (!state.spDeviceId || !isTokenValid()) return;
  await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + state.spDeviceId, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + state.spToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris, offset: { position: startIndex } }),
  }).catch(() => {});
}

export function pausePlayer() { state.spPlayer?.pause(); }
export function resumePlayer() { state.spPlayer?.resume(); }
export function skipToNext() { state.spPlayer?.nextTrack(); }
export function skipToPrev() { state.spPlayer?.previousTrack(); }

export async function exportPlaylist() {
  if (!isTokenValid()) {
    showStatus(state.spToken ? 'Sitzung abgelaufen — bitte neu verbinden.' : 'Zuerst verbinden.', 'error');
    if (state.spToken) spotifyLogout();
    return;
  }
  const all = [...state.generatedWod, ...state.generatedCd].slice(0, 100);
  if (!all.length) { showStatus('Keine Playlist.', 'error'); return; }
  const name = document.getElementById('pl-name').value || 'CFLU WOD';
  showStatus('Erstelle Playlist...', 'info');
  try {
    const pl = await (await fetch('https://api.spotify.com/v1/me/playlists', {
      method: 'POST',
      headers: {Authorization: 'Bearer ' + state.spToken, 'Content-Type': 'application/json'},
      body: JSON.stringify({name, description: 'CFLU WOD Playlist Builder', public: false}),
    })).json();
    if (!pl.id) {
      // S-03: Playlist-Erstellungsfehler nicht roh ausgeben
      console.error('Spotify playlist create error:', pl);
      showStatus('Playlist-Erstellung fehlgeschlagen. Token abgelaufen?', 'error');
      return;
    }
    showStatus('Füge Tracks hinzu...', 'info');
    const uris = all.filter(t => t.id && t.id !== 'nan').map(t => 'spotify:track:' + t.id);
    for (let i = 0; i < uris.length; i += 100) {
      await fetch(`https://api.spotify.com/v1/playlists/${pl.id}/items`, {
        method: 'POST',
        headers: {Authorization: 'Bearer ' + state.spToken, 'Content-Type': 'application/json'},
        body: JSON.stringify({uris: uris.slice(i, i + 100)}),
      });
    }
    showStatus('✓ Exportiert!', 'info');
    document.getElementById('sp-link-wrap').classList.remove('hidden');
    document.getElementById('sp-pl-link').href = pl.external_urls?.spotify || '#';
  } catch { showStatus('Export-Fehler. Verbindung prüfen.', 'error'); }
}
