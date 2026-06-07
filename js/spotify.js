// Spotify PKCE auth and playlist export
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
      // S-01: playlist-modify-private reicht — Playlists werden immer als private erstellt.
      scope: 'playlist-modify-private',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256', code_challenge: ch,
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + p;
  });
}

export function spotifyLogout() {
  state.spToken = null;
  state.spUserId = null;
  state.spTokenExpiry = 0;
  sessionStorage.removeItem('pkce_v');
  sessionStorage.removeItem('sp_cid');
  document.getElementById('sp-connected').style.display = 'none';
  document.getElementById('sp-export-btn2').style.display = 'none';
  document.getElementById('sp-user').textContent = '';
  showStatus('Abgemeldet.', 'info');
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
    } else {
      // S-03: Kein JSON.stringify(data) — Spotify-Fehldetails nicht in die UI
      console.error('Spotify auth error:', data);
      showStatus('Verbindung fehlgeschlagen. Bitte Client ID und Redirect URI prüfen.', 'error');
    }
  } catch { showStatus('Verbindung fehlgeschlagen. Netzwerk prüfen.', 'error'); }
}

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
