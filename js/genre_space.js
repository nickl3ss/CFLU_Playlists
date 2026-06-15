// genre_space.js — 3D genre space star map; reads GENRE_MAP, TRACK_DATA; writes canvas only; no Spotify, no generation logic
import * as THREE from './vendor/three.module.min.js';

const SCALE = 15;

let _scene, _camera, _renderer;
let _rotGroup = null, _clock = null, _elapsed = 0;
let _centroid = null;
let _starPoints, _starGeometry;
let _playlistMarkers = null, _sequenceLine = null;
let _canvas = null;
let _genreToTracks = new Map();
let _zMin = 0, _zRange = 1;
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

  _rotGroup = new THREE.Group();
  _scene.add(_rotGroup);
  _clock = new THREE.Clock();

  _buildStarField();

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

  // Count pool tracks per genre for size scaling
  const genreCount = new Map();
  for (const t of TRACK_DATA.tracks) {
    for (const g of (t.genres_raw || [])) {
      genreCount.set(g, (genreCount.get(g) || 0) + 1);
    }
  }
  let maxCount = 0;
  for (const cnt of genreCount.values()) {
    if (cnt > maxCount) maxCount = cnt;
  }

  const names = Object.keys(GENRE_MAP);
  const n = names.length;
  const positions = new Float32Array(n * 3);
  const colors    = new Float32Array(n * 3);
  const sizes     = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const name = names[i];
    const g    = GENRE_MAP[name];
    positions[i * 3]     = (g.x - 0.5) * SCALE;
    positions[i * 3 + 1] = (g.y - 0.5) * SCALE;
    positions[i * 3 + 2] = ((g.z - _zMin) / _zRange - 0.5) * SCALE;
    colors[i * 3]     = g.r / 255;
    colors[i * 3 + 1] = g.g / 255;
    colors[i * 3 + 2] = g.b / 255;
    // <10 songs → ~2px; ≥10 songs → 5px–20px scaled to max (shader: size * 80 / z, z≈28)
    const cnt = genreCount.get(name) || 0;
    if (cnt < 10) {
      sizes[i] = 0.7;
    } else {
      const t = maxCount > 10 ? (cnt - 10) / (maxCount - 10) : 0;
      sizes[i] = 1.75 + t * 5.25;
    }
  }

  // Use bounding box midpoint (not arithmetic mean) — unbiased by cluster density
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zBMin = Infinity, zBMax = -Infinity;
  for (let i = 0; i < n; i++) {
    xMin = Math.min(xMin, positions[i * 3]);
    xMax = Math.max(xMax, positions[i * 3]);
    yMin = Math.min(yMin, positions[i * 3 + 1]);
    yMax = Math.max(yMax, positions[i * 3 + 1]);
    zBMin = Math.min(zBMin, positions[i * 3 + 2]);
    zBMax = Math.max(zBMax, positions[i * 3 + 2]);
  }
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const cz = (zBMin + zBMax) / 2;
  for (let i = 0; i < n; i++) {
    positions[i * 3]     -= cx;
    positions[i * 3 + 1] -= cy;
    positions[i * 3 + 2] -= cz;
  }
  _centroid = new THREE.Vector3(cx, cy, cz);

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
  _rotGroup.add(_starPoints);
}

export function updatePlaylistMode(wod) {
  _clearPlaylistObjects();
  if (!wod || !wod.length || typeof GENRE_MAP === 'undefined') return;

  _genreToTracks = new Map();
  const lineVerts = [];
  const cx = _centroid ? _centroid.x : 0;
  const cy = _centroid ? _centroid.y : 0;
  const cz = _centroid ? _centroid.z : 0;

  for (const track of wod) {
    const genre = track.genres_raw && track.genres_raw[0];
    const gd    = genre && GENRE_MAP[genre];
    if (!gd) continue;

    if (!_genreToTracks.has(genre)) _genreToTracks.set(genre, []);
    _genreToTracks.get(genre).push(track);

    lineVerts.push(new THREE.Vector3(
      (gd.x - 0.5) * SCALE - cx,
      (gd.y - 0.5) * SCALE - cy,
      ((gd.z - _zMin) / _zRange - 0.5) * SCALE - cz,
    ));
  }

  if (!lineVerts.length) return;

  // Sequence line
  const lineGeo = new THREE.BufferGeometry().setFromPoints(lineVerts);
  _sequenceLine = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true }),
  );
  _rotGroup.add(_sequenceLine);

  // Playlist markers — one per unique genre star, coloured by track avg_color
  const uniqueStars = [..._genreToTracks.entries()];
  const mPos    = new Float32Array(uniqueStars.length * 3);
  const mColors = new Float32Array(uniqueStars.length * 3);
  const mSizes  = new Float32Array(uniqueStars.length);

  uniqueStars.forEach(([genre, tracks], i) => {
    const gd  = GENRE_MAP[genre];
    const col = _avgColor(tracks.map(t => t.avg_color).filter(Boolean));
    mPos[i * 3]     = (gd.x - 0.5) * SCALE - cx;
    mPos[i * 3 + 1] = (gd.y - 0.5) * SCALE - cy;
    mPos[i * 3 + 2] = ((gd.z - _zMin) / _zRange - 0.5) * SCALE - cz;
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
  _rotGroup.add(_playlistMarkers);
}

export function clearPlaylistMode() {
  _clearPlaylistObjects();
}

export function resizeGenreSpace() { _onResize(); }

// ===== INTERNALS =====

function _clearPlaylistObjects() {
  if (_playlistMarkers) {
    _rotGroup.remove(_playlistMarkers);
    _playlistMarkers.geometry.dispose();
    _playlistMarkers.material.dispose();
    _playlistMarkers = null;
  }
  if (_sequenceLine) {
    _rotGroup.remove(_sequenceLine);
    _sequenceLine.geometry.dispose();
    _sequenceLine.material.dispose();
    _sequenceLine = null;
  }
  _genreToTracks = new Map();
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
  if (_rotGroup && _clock) {
    const dt = _clock.getDelta();
    _elapsed += dt;
    // Three independent axes drift at different base speeds and slowly varying rates
    _rotGroup.rotation.x += (0.05 + 0.03 * Math.sin(_elapsed * 0.11)) * dt;
    _rotGroup.rotation.y += (0.09 + 0.05 * Math.sin(_elapsed * 0.07)) * dt;
    _rotGroup.rotation.z += (0.03 + 0.02 * Math.sin(_elapsed * 0.13)) * dt;
  }
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
