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

export async function playPreview(trackId, btnId) {
  const audio = document.getElementById('preview-audio');
  const btn = document.getElementById(btnId);
  const PLAY_SVG = '<svg viewBox="0 0 8 10" fill="currentColor"><polygon points="0,0 8,5 0,10"/></svg>';
  const PAUSE_SVG = '<svg viewBox="0 0 8 10" fill="currentColor"><rect x="0" y="0" width="3" height="10"/><rect x="5" y="0" width="3" height="10"/></svg>';

  if (state.currentAudio === btnId) {
    audio.pause(); audio.src = '';
    btn.classList.remove('playing'); btn.innerHTML = PLAY_SVG;
    state.currentAudio = null;
    return;
  }
  stopAllPreviews();
  if (!state.spToken) {
    alert('Spotify-Verbindung erforderlich für Preview.\nBitte zuerst Client ID eingeben und verbinden.');
    return;
  }
  let previewUrl = state.previewCache.get(trackId);
  if (!previewUrl) {
    try {
      const resp = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {headers: {Authorization: 'Bearer ' + state.spToken}});
      if (!resp.ok) throw new Error('API ' + resp.status);
      const data = await resp.json();
      previewUrl = data.preview_url;
      state.previewCache.set(trackId, previewUrl || 'null');
    } catch (e) { alert('Preview-Fehler: ' + e.message); return; }
  }
  if (!previewUrl || previewUrl === 'null') {
    btn.title = 'Kein Preview verfügbar'; btn.style.opacity = '.3';
    return;
  }
  audio.src = previewUrl; audio.volume = 0.8; audio.play();
  state.currentAudio = btnId;
  btn.classList.add('playing'); btn.innerHTML = PAUSE_SVG;
  audio.onended = () => {
    btn.classList.remove('playing'); btn.innerHTML = PLAY_SVG;
    state.currentAudio = null;
  };
}

export function stopAllPreviews() {
  const audio = document.getElementById('preview-audio');
  audio.pause(); audio.src = '';
  if (state.currentAudio) {
    const prevBtn = document.getElementById(state.currentAudio);
    if (prevBtn) {
      prevBtn.classList.remove('playing');
      prevBtn.innerHTML = '<svg viewBox="0 0 8 10" fill="currentColor"><polygon points="0,0 8,5 0,10"/></svg>';
    }
    state.currentAudio = null;
  }
}
