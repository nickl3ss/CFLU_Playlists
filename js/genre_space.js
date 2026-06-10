// genre_space.js — 3D genre space star map; reads state, GENRE_MAP, TRACK_DATA; writes canvas only; no Spotify, no generation logic
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { state } from './state.js';
import { highlightFromRow, clearHighlight } from './chart.js';

const SCALE = 15;

let _scene, _camera, _renderer, _controls;
let _starPoints, _starGeometry;
let _playlistMarkers = null, _sequenceLine = null;
let _canvas = null, _tooltip = null;
let _raycaster = null, _mouse = null;
// genre name → array of playlist tracks assigned to that star
let _genreToTracks = new Map();
// parallel array to starPoints attribute positions: maps index → genre name
let _starNames = [];
let _zMin = 0, _zRange = 1;
let _hoverSphere = null;
let _initialized = false;

export function initGenreSpace(canvasEl) {
  if (_initialized) return;
  if (typeof GENRE_MAP === 'undefined' || typeof TRACK_DATA === 'undefined') return;
  _canvas = canvasEl;

  _scene = new THREE.Scene();
  _scene.background = new THREE.Color(0x000000);

  const w = canvasEl.clientWidth  || 480;
  const h = canvasEl.clientHeight || 480;

  _camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
  _camera.position.set(0, 0, 28);

  _renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  _renderer.setPixelRatio(window.devicePixelRatio || 1);
  _renderer.setSize(w, h, false);

  _controls = new OrbitControls(_camera, _renderer.domElement);
  _controls.enableDamping = true;
  _controls.dampingFactor = 0.06;
  _controls.minDistance = 3;
  _controls.maxDistance = 80;

  _raycaster = new THREE.Raycaster();
  _raycaster.params.Points = { threshold: 0.4 };
  _mouse = new THREE.Vector2(-9, -9);

  _buildStarField();

  _tooltip = document.createElement('div');
  _tooltip.className = 'gs-tooltip';
  _tooltip.style.display = 'none';
  canvasEl.parentElement.style.position = 'relative';
  canvasEl.parentElement.appendChild(_tooltip);

  canvasEl.addEventListener('mousemove', _onMouseMove);
  canvasEl.addEventListener('mouseleave', _onMouseLeave);

  new ResizeObserver(_onResize).observe(canvasEl);

  _initialized = true;
  _animate();
}

function _buildStarField() {
  // Compute z min/max for cube-uniform normalization (x and y are already 0–1)
  let zMin = Infinity, zMax = -Infinity;
  for (const g of Object.values(GENRE_MAP)) {
    if (g.z < zMin) zMin = g.z;
    if (g.z > zMax) zMax = g.z;
  }
  _zMin = zMin;
  _zRange = (zMax - zMin) || 1;

  const names = Object.keys(GENRE_MAP);
  const n = names.length;
  const positions = new Float32Array(n * 3);
  const colors    = new Float32Array(n * 3);
  const sizes     = new Float32Array(n);

  _starNames = names;

  for (let i = 0; i < n; i++) {
    const name = names[i];
    const g    = GENRE_MAP[name];

    positions[i * 3]     = (g.x - 0.5) * SCALE;
    positions[i * 3 + 1] = (g.y - 0.5) * SCALE;
    positions[i * 3 + 2] = ((g.z - _zMin) / _zRange - 0.5) * SCALE;

    colors[i * 3]     = g.r / 255;
    colors[i * 3 + 1] = g.g / 255;
    colors[i * 3 + 2] = g.b / 255;

    sizes[i] = 2.0;
  }

  _starGeometry = new THREE.BufferGeometry();
  _starGeometry.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
  _starGeometry.setAttribute('customColor', new THREE.BufferAttribute(colors,    3));
  _starGeometry.setAttribute('size',        new THREE.BufferAttribute(sizes,     1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 customColor;
      varying vec3 vColor;
      void main() {
        vColor = customColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (80.0 / -mv.z);
        gl_Position  = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = 1.0 - smoothstep(0.42, 0.5, d);
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  });

  _starPoints = new THREE.Points(_starGeometry, mat);
  _scene.add(_starPoints);
}

export function updatePlaylistMode(wod) {
  _clearPlaylistObjects();
  if (!wod || !wod.length || typeof GENRE_MAP === 'undefined') return;

  _genreToTracks = new Map();
  const lineVerts = [];

  for (const track of wod) {
    const genre = track.genres_raw && track.genres_raw[0];
    const gd    = genre && GENRE_MAP[genre];
    if (!gd) continue;

    if (!_genreToTracks.has(genre)) _genreToTracks.set(genre, []);
    _genreToTracks.get(genre).push(track);

    lineVerts.push(new THREE.Vector3(
      (gd.x - 0.5) * SCALE,
      (gd.y - 0.5) * SCALE,
      ((gd.z - _zMin) / _zRange - 0.5) * SCALE,
    ));
  }

  if (!lineVerts.length) return;

  // Sequence line
  const lineGeo = new THREE.BufferGeometry().setFromPoints(lineVerts);
  _sequenceLine = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true }),
  );
  _scene.add(_sequenceLine);

  // Playlist markers — one per unique genre star, coloured by track avg_color
  const uniqueStars = [..._genreToTracks.entries()];
  const mPos    = new Float32Array(uniqueStars.length * 3);
  const mColors = new Float32Array(uniqueStars.length * 3);
  const mSizes  = new Float32Array(uniqueStars.length);

  uniqueStars.forEach(([genre, tracks], i) => {
    const gd  = GENRE_MAP[genre];
    const col = _avgColor(tracks.map(t => t.avg_color).filter(Boolean));
    mPos[i * 3]     = (gd.x - 0.5) * SCALE;
    mPos[i * 3 + 1] = (gd.y - 0.5) * SCALE;
    mPos[i * 3 + 2] = ((gd.z - _zMin) / _zRange - 0.5) * SCALE;
    mColors[i * 3]     = col.r / 255;
    mColors[i * 3 + 1] = col.g / 255;
    mColors[i * 3 + 2] = col.b / 255;
    mSizes[i] = 2.0;
  });

  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position',    new THREE.BufferAttribute(mPos,    3));
  mGeo.setAttribute('customColor', new THREE.BufferAttribute(mColors, 3));
  mGeo.setAttribute('size',        new THREE.BufferAttribute(mSizes,  1));

  _playlistMarkers = new THREE.Points(mGeo, new THREE.ShaderMaterial({
    vertexShader: `
      attribute float size;
      attribute vec3 customColor;
      varying vec3 vColor;
      void main() {
        vColor = customColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (80.0 / -mv.z);
        gl_Position  = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float a = 1.0 - smoothstep(0.42, 0.5, d);
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite:  false,
    blending:    THREE.AdditiveBlending,
  }));
  _scene.add(_playlistMarkers);

  // Camera zoom to bbox of playlist stars
  const bbox = new THREE.Box3();
  lineVerts.forEach(v => bbox.expandByPoint(v));
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const dist = Math.max(size.length() * 0.9, 6);
  _animateCameraTo(center, dist);
}

export function clearPlaylistMode() {
  _clearPlaylistObjects();
}

export function resizeGenreSpace() { _onResize(); }

export function highlightGenreStar(genreName) {
  _clearHoverSphere();
  if (!_scene || typeof GENRE_MAP === 'undefined') return;
  const gd = GENRE_MAP[genreName];
  if (!gd) return;
  _hoverSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  );
  _hoverSphere.position.set(
    (gd.x - 0.5) * SCALE,
    (gd.y - 0.5) * SCALE,
    ((gd.z - _zMin) / _zRange - 0.5) * SCALE,
  );
  _scene.add(_hoverSphere);
}

export function clearGenreHighlight() {
  _clearHoverSphere();
}

// ===== INTERNALS =====

function _clearHoverSphere() {
  if (_hoverSphere) {
    _scene.remove(_hoverSphere);
    _hoverSphere.geometry.dispose();
    _hoverSphere.material.dispose();
    _hoverSphere = null;
  }
}

function _clearPlaylistObjects() {
  if (_playlistMarkers) {
    _scene.remove(_playlistMarkers);
    _playlistMarkers.geometry.dispose();
    _playlistMarkers.material.dispose();
    _playlistMarkers = null;
  }
  if (_sequenceLine) {
    _scene.remove(_sequenceLine);
    _sequenceLine.geometry.dispose();
    _sequenceLine.material.dispose();
    _sequenceLine = null;
  }
  _genreToTracks = new Map();
  if (_tooltip) _tooltip.style.display = 'none';
}

function _animateCameraTo(target, dist) {
  const p0 = _camera.position.clone();
  const t0 = _controls.target.clone();
  const dir = p0.clone().sub(t0).normalize();
  const p1  = target.clone().addScaledVector(dir, dist);
  let  pct  = 0;

  function step() {
    pct = Math.min(pct + 0.022, 1);
    const e = 1 - Math.pow(1 - pct, 3); // cubic ease-out
    _camera.position.lerpVectors(p0, p1, e);
    _controls.target.lerpVectors(t0, target, e);
    _controls.update();
    if (pct < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function _onMouseMove(e) {
  if (!_canvas || !_raycaster || !_starPoints) return;
  const rect = _canvas.getBoundingClientRect();
  _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

  // Only show tooltip after a playlist is generated
  if (!_genreToTracks.size) { _tooltip.style.display = 'none'; return; }

  _raycaster.setFromCamera(_mouse, _camera);
  const hits = _raycaster.intersectObject(_starPoints);

  if (hits.length) {
    const genreName = _starNames[hits[0].index];
    const tracks    = _genreToTracks.get(genreName);
    if (tracks && tracks.length) {
      _tooltip.style.display = 'block';
      _tooltip.style.left    = (e.clientX - rect.left + 14) + 'px';
      _tooltip.style.top     = (e.clientY - rect.top  - 10) + 'px';
      _tooltip.innerHTML     = tracks.map(t =>
        `<span style="color:${t.avg_color||'#fff'}">${t.song}</span><br><span class="gs-tt-artist">${t.artist}</span>`
      ).join('<hr class="gs-tt-sep">');

      // Highlight first track's row in the table
      const allTracks = [...(state.generatedWod || []), ...(state.generatedCd || [])];
      const rowIdx = allTracks.findIndex(t =>
        (t.id && t.id === tracks[0].id) || t.song === tracks[0].song,
      );
      if (rowIdx >= 0) highlightFromRow(rowIdx);
      return;
    }
  }

  _tooltip.style.display = 'none';
  clearHighlight();
}

function _onMouseLeave() {
  if (_tooltip) _tooltip.style.display = 'none';
  clearHighlight();
}

function _onResize() {
  if (!_canvas || !_renderer || !_camera) return;
  const w = _canvas.clientWidth;
  const h = _canvas.clientHeight;
  if (!w || !h) return;
  _camera.aspect = w / h;
  _camera.updateProjectionMatrix();
  _renderer.setSize(w, h, false);
}

function _animate() {
  requestAnimationFrame(_animate);
  if (_controls) _controls.update();
  if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
}

function _avgColor(hexArr) {
  if (!hexArr.length) return { r: 255, g: 255, b: 255 };
  let r = 0, g = 0, b = 0;
  for (const h of hexArr) {
    r += parseInt(h.slice(1, 3), 16);
    g += parseInt(h.slice(3, 5), 16);
    b += parseInt(h.slice(5, 7), 16);
  }
  return { r: Math.round(r / hexArr.length), g: Math.round(g / hexArr.length), b: Math.round(b / hexArr.length) };
}
