// register.js — Pool Register tab; lazy-loads data/*.json, browse artists/tracks/albums; no Spotify calls
import { resolveTrack, resolveArtist, resolveArtistAggregates, resolveAlbumAggregates } from './resolve.js';

// ===== Module state =====
let _d        = null;   // loaded data: {tracks[], trackById, artists{}, albums{}, everynoise{}}
let _loaded   = false;
let _loading  = false;
let _sel      = null;   // {type:'artist'|'track'|'album', id:string}
let _viewMode = 'tracks';  // 'tracks' | 'albums'
let _term     = '';

// ===== Data loading =====

async function _load() {
  if (_loaded || _loading) return;
  _loading = true;
  _setStatus('Lade Register-Daten…');
  try {
    const [tRes, aRes, alRes, gRes] = await Promise.all([
      fetch('data/tracks.json'),
      fetch('data/artists.json'),
      fetch('data/albums.json'),
      fetch('data/genres.json'),
    ]);
    if (!tRes.ok || !aRes.ok || !alRes.ok || !gRes.ok) throw new Error('HTTP-Fehler beim Laden');

    const [td, ad, ald, gd] = await Promise.all([tRes.json(), aRes.json(), alRes.json(), gRes.json()]);

    const trackById = {};
    for (const t of td.tracks) trackById[t.id] = t;

    _d = {
      tracks:     td.tracks,
      trackById,
      artists:    ad.artists,
      albums:     ald.albums,
      everynoise: gd.everynoise || {},
    };
    _loaded  = true;
    _loading = false;
    _setStatus('');
    _renderList();
  } catch (err) {
    _loading = false;
    _setStatus(`Fehler: ${err.message}. Bitte Pool-Builder ausführen.`);
  }
}

// ===== Helpers =====

function _esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _setStatus(msg) {
  const el = document.getElementById('reg-status');
  if (el) el.textContent = msg;
}

function _enEntry(genres_raw) {
  if (!_d?.everynoise || !genres_raw?.length) return null;
  for (const tag of genres_raw) {
    const e = _d.everynoise[tag.toLowerCase()];
    if (e) return e;
  }
  return null;
}

function _tableRows(entries) {
  return entries
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => {
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      return `<tr><td class="reg-key">${_esc(k)}</td><td class="reg-val">${_esc(val)}</td></tr>`;
    })
    .join('');
}

function _resolvedTable(entries) {
  const rows = _tableRows(entries);
  return rows ? `<table class="reg-table">${rows}</table>` : '';
}

function _sourcesHtml(sources) {
  if (!sources) return '';
  const order  = ['spotify', 'chosic', 'lastfm', 'ai', 'user'];
  const labels = {
    spotify: 'Spotify',
    chosic:  'Chosic',
    lastfm:  'Last.fm',
    ai:      'AI (Claude)',
    user:    'User',
  };
  return `<div class="reg-sources">
    <div class="reg-section-lbl">Quellen</div>
    ${order.map(key => {
      const src   = sources[key];
      const empty = src == null;
      const isUser = key === 'user';
      const note  = empty ? ' — leer' : isUser ? ' — nicht implementiert' : '';
      const body  = empty
        ? '<div class="reg-src-empty">Keine Daten aus dieser Quelle</div>'
        : _resolvedTable(Object.entries(src));
      return `<div class="reg-src-block${empty ? ' empty' : ''}">
        <button class="reg-src-toggle">${_esc(labels[key])}${_esc(note)}</button>
        <div class="reg-src-body" hidden>${body}</div>
      </div>`;
    }).join('')}
  </div>`;
}

// ===== List rendering =====

function _artistMatches(artist) {
  if (!_term) return true;
  if (artist.name.toLowerCase().includes(_term)) return true;
  if (_viewMode === 'tracks') {
    return (artist.track_ids || []).some(tid => {
      const t = _d.trackById[tid];
      return t && (t.sources?.spotify?.song || '').toLowerCase().includes(_term);
    });
  }
  return false;
}

function _renderList() {
  const el = document.getElementById('reg-list');
  if (!el || !_d) return;

  const artists = Object.values(_d.artists)
    .filter(_artistMatches)
    .sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = artists.map(artist => {
    const selArtist = _sel?.type === 'artist' && _sel.id === artist.id;
    const trackCount = (artist.track_ids || []).length;
    return `<div class="reg-artist${selArtist ? ' selected' : ''}" data-id="${_esc(artist.id)}" data-type="artist" role="button" tabindex="0">
      <div class="reg-artist-hdr">
        <span class="reg-artist-name">${_esc(artist.name)}</span>
        <span class="reg-artist-cnt">${trackCount}</span>
      </div>
      ${selArtist ? _childrenHtml(artist) : ''}
    </div>`;
  }).join('');

  el.querySelectorAll('.reg-artist').forEach(node => {
    node.addEventListener('click', () => _onArtistClick(node.dataset.id));
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _onArtistClick(node.dataset.id); });
  });
  el.querySelectorAll('.reg-child').forEach(node => {
    node.addEventListener('click', e => { e.stopPropagation(); _onChildClick(node.dataset.type, node.dataset.id); });
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); _onChildClick(node.dataset.type, node.dataset.id); } });
  });
}

function _childrenHtml(artist) {
  if (_viewMode === 'tracks') {
    const items = (artist.track_ids || []).map(tid => {
      const t = _d.trackById[tid];
      if (!t) return '';
      const r = resolveTrack(t);
      const selChild = _sel?.type === 'track' && _sel.id === tid;
      return `<div class="reg-child${selChild ? ' selected' : ''}" data-id="${_esc(tid)}" data-type="track" role="button" tabindex="0">
        <span class="reg-child-name">${_esc(r.song)}</span>
        <span class="reg-child-meta">${r.bpm} BPM · ${r.energy}% · ${_esc(r.genre)}</span>
      </div>`;
    }).filter(Boolean);
    return `<div class="reg-children">${items.join('')}</div>`;
  }

  // Albums view — group by album
  const seen = new Set();
  const albumGroups = [];
  for (const tid of (artist.track_ids || [])) {
    const t = _d.trackById[tid];
    if (!t) continue;
    const alid = t.refs?.album_id;
    if (!alid || seen.has(alid)) continue;
    seen.add(alid);
    const al = _d.albums[alid];
    albumGroups.push({ alid, al, tids: [] });
  }
  for (const tid of (artist.track_ids || [])) {
    const t = _d.trackById[tid];
    if (!t) continue;
    const group = albumGroups.find(g => g.alid === t.refs?.album_id);
    if (group) group.tids.push(tid);
  }

  const items = albumGroups.map(({ alid, al, tids }) => {
    const selChild = _sel?.type === 'album' && _sel.id === alid;
    const name = al?.name || alid;
    const year = (al?.date || '').slice(0, 4);
    return `<div class="reg-child${selChild ? ' selected' : ''}" data-id="${_esc(alid)}" data-type="album" role="button" tabindex="0">
      <span class="reg-child-name">${_esc(name)}</span>
      <span class="reg-child-meta">${tids.length} Track${tids.length !== 1 ? 's' : ''}${year ? ` · ${year}` : ''}</span>
    </div>`;
  });
  return `<div class="reg-children">${items.join('')}</div>`;
}

// ===== Click handlers =====

function _onArtistClick(id) {
  if (_sel?.type === 'artist' && _sel.id === id) {
    _sel = null;
    _renderDetail(null);
  } else {
    _sel = { type: 'artist', id };
    _renderDetail({ type: 'artist', obj: _d.artists[id] });
  }
  _renderList();
}

function _onChildClick(type, id) {
  _sel = { type, id };
  const obj = type === 'track' ? _d.trackById[id] : _d.albums[id];
  _renderDetail({ type, obj });
  _renderList();
}

// ===== Detail rendering =====

function _renderDetail(item) {
  const el = document.getElementById('reg-detail');
  if (!el) return;
  if (!item) {
    el.innerHTML = '<div class="reg-detail-empty">← Artist, Track oder Album wählen</div>';
    return;
  }

  if (item.type === 'track')  el.innerHTML = _trackDetailHtml(item.obj);
  if (item.type === 'artist') el.innerHTML = _artistDetailHtml(item.obj);
  if (item.type === 'album')  el.innerHTML = _albumDetailHtml(item.obj);

  el.querySelectorAll('.reg-src-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling;
      const open = btn.classList.toggle('open');
      if (body) body.hidden = !open;
    });
  });
}

function _trackDetailHtml(t) {
  if (!t) return '<div class="reg-detail-empty">Track nicht gefunden</div>';
  const r  = resolveTrack(t);
  const en = _enEntry(r.genres_raw);
  const chip = en
    ? `<span class="reg-en-chip" style="background:${_esc(en.hex)};color:${en.z > 128 ? '#000' : '#fff'}">${_esc(r.genres_raw[0] || '')}</span>`
    : '';
  return `
    <div class="reg-detail-hdr">
      ${chip}
      <div class="reg-detail-title">${_esc(r.song)}</div>
      <div class="reg-detail-sub">${_esc(r.artist)}</div>
      <div class="reg-detail-tags">${_esc(r.genre)} · ${r.bpm} BPM · ${r.energy}% · ${_esc(r.camelot)}</div>
    </div>
    <div class="reg-section">
      <div class="reg-section-lbl">Resolved</div>
      ${_resolvedTable([
        ['Song',       r.song],
        ['Artist',     r.artist],
        ['Album',      r.album],
        ['Genre',      r.genre],
        ['BPM',        r.bpm],
        ['Energy',     r.energy != null ? r.energy + '%' : null],
        ['Camelot',    r.camelot],
        ['Moods',      r.mood_tags],
        ['Dance',      r.dance != null ? r.dance + '%' : null],
        ['Acoustic',   r.acoustic != null ? r.acoustic + '%' : null],
        ['Valence',    r.valence != null ? r.valence + '%' : null],
        ['Popularity', r.popularity],
        ['Dauer',      r.dur != null ? r.dur + ' s' : null],
        ['Key',        r.key],
        ['Label',      r.label],
        ['ISRC',       r.isrc],
        ['Added',      r.added_at],
        ['genres_raw', r.genres_raw],
        ['track_tags', r.track_tags],
      ])}
    </div>
    ${_sourcesHtml(t.sources)}`;
}

function _artistDetailHtml(artist) {
  if (!artist) return '<div class="reg-detail-empty">Artist nicht gefunden</div>';
  const r   = resolveArtist(artist);
  const agg = resolveArtistAggregates(artist, _d.trackById);
  const topGenres = Object.entries(agg.genre_counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topMoods  = Object.entries(agg.mood_counts ).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return `
    <div class="reg-detail-hdr">
      <div class="reg-detail-title">${_esc(r.name)}</div>
      <div class="reg-detail-tags">${topGenres.map(([g]) => _esc(g)).join(' · ')}</div>
    </div>
    <div class="reg-section">
      <div class="reg-section-lbl">Aggregat — ${agg.track_count} Tracks</div>
      ${_resolvedTable([
        ['BPM min/med/max', agg.bpm_min != null ? `${agg.bpm_min} / ${agg.bpm_median} / ${agg.bpm_max}` : null],
        ['Energy',         agg.energy_min != null ? `${agg.energy_min}% – ${agg.energy_max}%` : null],
        ['Genres',         topGenres.map(([g, c]) => `${g}: ${c}`).join(', ')],
        ['Moods',          topMoods.map(([m, c]) => `${m}: ${c}`).join(', ')],
        ['Ähnlich',        r.similar.slice(0, 5)],
        ['Tags (Last.fm)', r.tags.slice(0, 10)],
      ])}
    </div>
    ${_sourcesHtml(artist.sources)}`;
}

function _albumDetailHtml(album) {
  if (!album) return '<div class="reg-detail-empty">Album nicht gefunden</div>';
  const agg = resolveAlbumAggregates(album, _d.trackById);
  const topGenres = Object.entries(agg.genre_counts).sort((a, b) => b[1] - a[1]);
  return `
    <div class="reg-detail-hdr">
      <div class="reg-detail-title">${_esc(album.name)}</div>
      <div class="reg-detail-sub">${_esc((album.date || '').slice(0, 4))}</div>
      <div class="reg-detail-tags">${topGenres.map(([g]) => _esc(g)).join(' · ')}</div>
    </div>
    <div class="reg-section">
      <div class="reg-section-lbl">Aggregat — ${agg.track_count} Tracks</div>
      ${_resolvedTable([
        ['Tracks',          agg.track_count],
        ['Genres',          topGenres.map(([g, c]) => `${g}: ${c}`).join(', ')],
        ['Album-Tags',      album.sources?.lastfm?.album_tags || []],
      ])}
    </div>
    ${_sourcesHtml(album.sources)}`;
}

// ===== Public API =====

export function initRegister() {
  document.getElementById('reg-search')?.addEventListener('input', e => {
    _term = e.target.value.toLowerCase().trim();
    _renderList();
  });

  document.getElementById('reg-view-tracks')?.addEventListener('click', () => {
    _viewMode = 'tracks';
    document.getElementById('reg-view-tracks').classList.add('active');
    document.getElementById('reg-view-albums').classList.remove('active');
    if (_sel?.type === 'album') { _sel = null; _renderDetail(null); }
    _renderList();
  });

  document.getElementById('reg-view-albums')?.addEventListener('click', () => {
    _viewMode = 'albums';
    document.getElementById('reg-view-albums').classList.add('active');
    document.getElementById('reg-view-tracks').classList.remove('active');
    if (_sel?.type === 'track') { _sel = null; _renderDetail(null); }
    _renderList();
  });
}

export async function openRegister() {
  if (!_loaded && !_loading) {
    await _load();
  } else if (_loaded) {
    _renderList();
    _renderDetail(_sel ? { type: _sel.type, obj:
      _sel.type === 'artist' ? _d.artists[_sel.id] :
      _sel.type === 'track'  ? _d.trackById[_sel.id] :
      _d.albums[_sel.id] } : null);
  }
}
