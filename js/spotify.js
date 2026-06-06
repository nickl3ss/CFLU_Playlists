// Spotify PKCE auth, playlist export, audio preview
import { state } from './state.js';

const REDIRECT_URI = 'http://127.0.0.1:8888/CFLU_WOD_Builder.html';

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
      scope: 'playlist-modify-public playlist-modify-private',
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256', code_challenge: ch,
    });
    window.location.href = 'https://accounts.spotify.com/authorize?' + p;
  });
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
    const d = await r.json();
    if (d.access_token) {
      state.spToken = d.access_token;
      const me = await (await fetch('https://api.spotify.com/v1/me', {headers: {Authorization: 'Bearer ' + state.spToken}})).json();
      state.spUserId = me.id;
      document.getElementById('sp-user').textContent = me.display_name || me.id;
      document.getElementById('sp-connected').style.display = 'block';
      if (state.generatedWod.length) document.getElementById('sp-export-btn').style.display = 'block';
      if (state.generatedWod.length) document.getElementById('sp-export-btn2').style.display = 'block';
      showStatus('✓ Verbunden!', 'info');
      sessionStorage.removeItem('pkce_v');
      sessionStorage.removeItem('sp_cid');
    } else {
      showStatus('Fehler: ' + JSON.stringify(d), 'error');
    }
  } catch (e) { showStatus('Fehler: ' + e.message, 'error'); }
}

export async function exportPlaylist() {
  if (!state.spToken) { showStatus('Zuerst verbinden.', 'error'); return; }
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
    if (!pl.id) { showStatus('Fehler: ' + JSON.stringify(pl), 'error'); return; }
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
  } catch (e) { showStatus('Export-Fehler: ' + e.message, 'error'); }
}
