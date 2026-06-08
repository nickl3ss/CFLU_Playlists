#!/usr/bin/env python3
# scripts/build_genre_config.py — generates js/genres.js from Everynoise coordinate data
# Data source: data/everynoise_genre_attrs.csv (Everynoise, frozen 2025; no auto-refresh)
# Rebuild: python scripts/build_genre_config.py [--refresh]
"""
Computes data-driven neighbour weights for GENRE_CONFIG.mainGenres using
5D Everynoise distance (x, y, R, G, B), then writes js/genres.js.

All x/y are min-max normalized across all 5,453 Everynoise genres before
computing distance (raw y-axis spans ~10× the range of raw x).

Distance formula:
    sqrt(Δx_n² + Δy_n² + 0.5·ΔR_n² + 0.5·ΔG_n² + 0.5·ΔB_n²)

Centroids per main genre = mean of 5D coords of all matched genres_raw
from tracks assigned to that main genre.

Neighbour weights:  rank 1 → 1.0 · rank 2 → 0.7 · rank 3+ → 0.5
Always ≥ 3 neighbours; up to 5 if distance < 2× rank-1 distance.
Deutsche Musik neighbours are overridden (cultural ≠ sonic in Everynoise).
"""

import csv
import json
import math
import pathlib
import re
import sys
import urllib.request
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')

# ── Paths ─────────────────────────────────────────────────────────────────
ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / 'data'
CACHE_FILE = DATA_DIR / 'everynoise_genre_attrs.csv'
TRACKS_FILE = ROOT / 'cflu_tracks.js'
OUTPUT_FILE = ROOT / 'js' / 'genres.js'
EVERYNOISE_URL = (
    'https://raw.githubusercontent.com/AyrtonB/EveryNoise-Watch'
    '/main/data/genre_attrs.csv'
)

# ── Colour weight for 5D distance ─────────────────────────────────────────
COLOR_WEIGHT = 0.5

# ── Genre roles (preserved from Issue #106 taxonomy) ─────────────────────
GENRE_ROLES = {
    'EDM / Electronic':        'peak',
    'Rock':                    'peak',
    'Pop & New Wave':          'peak',
    'Metal & Hard Rock':       'peak',
    'Ska & Reggae':            'peak',
    'Synthwave / Electronica': 'warmup',
    'Hip Hop / Rap':           'peak',
    'Punk':                    'peak',
    'Funk, Soul & R&B':        'cooldown',
    'Deutsche Musik':          'peak',
}

# ── Neighbour weights by rank (must stay in {0.5, 0.7, 1.0} — test compat) ─
RANK_WEIGHTS = {1: 1.0, 2: 0.7}   # 3+ → 0.5

MIN_NEIGHBOURS = 3
MAX_NEIGHBOURS = 5

# ── Deutsche Musik override ───────────────────────────────────────────────
# Everynoise places e.g. "neue deutsche welle" near nu-metal/rap-metal
# (sonic feature), not near German pop/schlager (cultural/linguistic).
# After the Deutsche Musik merge, auto-centroids are unreliable;
# keep the hand-verified neighbours from Issue #106.
NEIGHBOUR_OVERRIDES = {
    'Deutsche Musik': [
        {'mainId': 'Pop & New Wave',           'weight': 1.0},
        {'mainId': 'EDM / Electronic',         'weight': 0.7},
        {'mainId': 'Synthwave / Electronica',  'weight': 0.5},
    ],
}


# ──────────────────────────────────────────────────────────────────────────
# Download / cache
# ──────────────────────────────────────────────────────────────────────────

def ensure_csv(force_refresh: bool = False) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if CACHE_FILE.exists() and not force_refresh:
        print(f'[cache] {CACHE_FILE.name} already present — skipping download')
        return
    print(f'[download] fetching {EVERYNOISE_URL} …')
    urllib.request.urlretrieve(EVERYNOISE_URL, CACHE_FILE)
    print(f'[download] saved → {CACHE_FILE}')


# ──────────────────────────────────────────────────────────────────────────
# Load + normalize Everynoise data
# ──────────────────────────────────────────────────────────────────────────

def _hex_to_rgb01(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip('#')
    if len(h) != 6:
        return (0.5, 0.5, 0.5)
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)


def load_everynoise() -> tuple[dict, dict]:
    """
    Returns:
        raw_lookup   { genre_name_lower: {'x': float, 'y': float, 'hex': str} }
        norm_lookup  { genre_name_lower: {'x_n': float, 'y_n': float, 'r': f, 'g': f, 'b': f} }
    """
    rows = []
    with open(CACHE_FILE, encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rows.append({
                    'name': row['genre'].strip().lower(),
                    'x': float(row['x']),
                    'y': float(row['y']),
                    'hex': row['hex_colour'].strip(),
                })
            except (KeyError, ValueError):
                pass

    if not rows:
        raise RuntimeError('Everynoise CSV is empty or has unexpected columns')

    xs = [r['x'] for r in rows]
    ys = [r['y'] for r in rows]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    x_range = x_max - x_min or 1
    y_range = y_max - y_min or 1

    raw_lookup: dict = {}
    norm_lookup: dict = {}
    for r in rows:
        key = r['name']
        raw_lookup[key] = {'x': r['x'], 'y': r['y'], 'hex': r['hex']}
        r2, g2, b2 = _hex_to_rgb01(r['hex'])
        norm_lookup[key] = {
            'x_n': (r['x'] - x_min) / x_range,
            'y_n': (r['y'] - y_min) / y_range,
            'r': r2, 'g': g2, 'b': b2,
        }

    print(f'[everynoise] {len(rows):,} genres loaded and normalized')
    return raw_lookup, norm_lookup


# ──────────────────────────────────────────────────────────────────────────
# Load tracks
# ──────────────────────────────────────────────────────────────────────────

def load_tracks() -> list[dict]:
    content = TRACKS_FILE.read_text(encoding='utf-8')
    json_str = re.sub(r'^\s*const\s+TRACK_DATA\s*=\s*', '', content.strip())
    json_str = json_str.rstrip().rstrip(';')
    data = json.loads(json_str)
    tracks = data['tracks'] if isinstance(data, dict) else data
    print(f'[tracks] {len(tracks):,} tracks loaded from {TRACKS_FILE.name}')
    return tracks


# ──────────────────────────────────────────────────────────────────────────
# Genre-tag → Everynoise matching (3-pass)
# ──────────────────────────────────────────────────────────────────────────

def _normalize_tag(tag: str) -> str:
    return tag.strip().lower()


def _match_tag(tag: str, norm_lookup: dict) -> str | None:
    """Return matched Everynoise key or None (3-pass: exact, hyphen, word split)."""
    key = _normalize_tag(tag)
    if key in norm_lookup:
        return key
    # Pass 2: swap spaces ↔ hyphens
    alt = key.replace(' ', '-')
    if alt in norm_lookup:
        return alt
    alt2 = key.replace('-', ' ')
    if alt2 in norm_lookup:
        return alt2
    # Pass 3: try each individual word (handles "schwedischer pop" → "pop")
    words = re.split(r'[\s\-]+', key)
    if len(words) > 1:
        for word in words:
            if word in norm_lookup:
                return word
    return None


# ──────────────────────────────────────────────────────────────────────────
# Coverage report
# ──────────────────────────────────────────────────────────────────────────

def coverage_report(tracks: list[dict], norm_lookup: dict) -> dict[str, list[str]]:
    """
    Returns { main_genre: [matched_everynoise_keys, ...] }
    and prints a coverage summary.
    """
    genre_tags: dict[str, set] = defaultdict(set)
    genre_matched: dict[str, set] = defaultdict(set)
    unmatched: set = set()

    for t in tracks:
        main = t.get('genre', '')
        if main not in GENRE_ROLES:
            continue
        for raw_tag in t.get('genres_raw', []):
            genre_tags[main].add(raw_tag)
            key = _match_tag(raw_tag, norm_lookup)
            if key:
                genre_matched[main].add(key)
            else:
                unmatched.add(raw_tag)

    print('\n── Coverage Report ──────────────────────────────────────')
    total_tags = sum(len(v) for v in genre_tags.values())
    total_matched = sum(len(v) for v in genre_matched.values())
    for g in GENRE_ROLES:
        n_total = len(genre_tags.get(g, []))
        n_match = len(genre_matched.get(g, []))
        pct = 100 * n_match / n_total if n_total else 0
        print(f'  {g:<30} {n_match:3}/{n_total:3} subgenres matched ({pct:.0f}%)')
    print(f'  {"TOTAL":<30} {total_matched:3}/{total_tags:3} ({100*total_matched/total_tags:.0f}%)')
    print(f'  Unmatched tags: {len(unmatched)}')
    if unmatched:
        sample = sorted(unmatched)[:20]
        print(f'  Sample: {sample}')
    print('─────────────────────────────────────────────────────────\n')

    return {g: list(v) for g, v in genre_matched.items()}


# ──────────────────────────────────────────────────────────────────────────
# Centroids
# ──────────────────────────────────────────────────────────────────────────

def compute_centroids(
    tracks: list[dict],
    norm_lookup: dict,
) -> dict[str, tuple[float, float, float, float, float]]:
    """
    Returns { main_genre: (x_n, y_n, r, g, b) } centroid for each genre
    that has at least one matched tag.
    """
    accum: dict[str, list] = defaultdict(list)

    for t in tracks:
        main = t.get('genre', '')
        if main not in GENRE_ROLES:
            continue
        for raw_tag in t.get('genres_raw', []):
            key = _match_tag(raw_tag, norm_lookup)
            if key:
                e = norm_lookup[key]
                accum[main].append((e['x_n'], e['y_n'], e['r'], e['g'], e['b']))

    centroids: dict = {}
    print('── Centroids ────────────────────────────────────────────')
    for g in GENRE_ROLES:
        pts = accum.get(g, [])
        if not pts:
            print(f'  {g:<30} NO DATA — genre will use fallback')
            continue
        n = len(pts)
        cx = sum(p[0] for p in pts) / n
        cy = sum(p[1] for p in pts) / n
        cr = sum(p[2] for p in pts) / n
        cg = sum(p[3] for p in pts) / n
        cb = sum(p[4] for p in pts) / n
        # Reconstruct hex for report
        hex_r = f'#{round(cr*255):02x}{round(cg*255):02x}{round(cb*255):02x}'
        print(f'  {g:<30} ({cx:.3f}, {cy:.3f})  colour {hex_r}  [{n:,} pts]')
        centroids[g] = (cx, cy, cr, cg, cb)
    print('─────────────────────────────────────────────────────────\n')
    return centroids


# ──────────────────────────────────────────────────────────────────────────
# Neighbour computation
# ──────────────────────────────────────────────────────────────────────────

def _dist5d(a: tuple, b: tuple) -> float:
    ax, ay, ar, ag, ab_ = a
    bx, by, br, bg, bb = b
    return math.sqrt(
        (ax - bx) ** 2 + (ay - by) ** 2
        + COLOR_WEIGHT * ((ar - br) ** 2 + (ag - bg) ** 2 + (ab_ - bb) ** 2)
    )


def compute_neighbours(
    centroids: dict[str, tuple],
) -> dict[str, list[dict]]:
    """
    Returns { main_genre: [ {mainId, weight}, ... ] }
    Applies NEIGHBOUR_OVERRIDES after auto-computation.
    """
    genres = list(GENRE_ROLES.keys())
    neighbours: dict[str, list[dict]] = {}

    print('── Auto-computed Neighbours ─────────────────────────────')
    for g in genres:
        if g not in centroids:
            # Fallback: use all other genres at equal weight 0.5
            nb = [{'mainId': o, 'weight': 0.5}
                  for o in genres if o != g][:MAX_NEIGHBOURS]
            neighbours[g] = nb
            print(f'  {g:<30} FALLBACK (no centroid)')
            continue

        distances = []
        for other in genres:
            if other == g or other not in centroids:
                continue
            d = _dist5d(centroids[g], centroids[other])
            distances.append((d, other))
        distances.sort()

        nb: list[dict] = []
        rank1_dist = distances[0][0] if distances else 1.0
        for rank, (d, other) in enumerate(distances, 1):
            if rank <= MIN_NEIGHBOURS:
                w = RANK_WEIGHTS.get(rank, 0.5)
                nb.append({'mainId': other, 'weight': w})
            elif rank <= MAX_NEIGHBOURS and d < 2.0 * rank1_dist:
                nb.append({'mainId': other, 'weight': 0.5})

        neighbours[g] = nb
        lines = ', '.join(f"{n['mainId']}({n['weight']})" for n in nb)
        print(f'  {g:<30} {lines}')

    print('─────────────────────────────────────────────────────────\n')

    # Apply overrides
    overridden = []
    for g, nb in NEIGHBOUR_OVERRIDES.items():
        if g in neighbours:
            neighbours[g] = nb
            overridden.append(g)
    if overridden:
        print(f'[override] Applied manual neighbours for: {overridden}\n')

    return neighbours


# ──────────────────────────────────────────────────────────────────────────
# genres.js writer
# ──────────────────────────────────────────────────────────────────────────

# Static bridgeSubgenres (manually curated in Issue #106 — not derivable from Everynoise)
_BRIDGE_SUBGENRES = """\
    'dance pop':           ['EDM / Electronic', 'Pop & New Wave', 'Deutsche Musik'],
    'synthpop':            ['Synthwave / Electronica', 'Rock', 'Pop & New Wave'],
    'ska punk':            ['Punk', 'Ska & Reggae'],
    'skate punk':          ['Punk', 'Ska & Reggae'],
    'rap metal':           ['Metal & Hard Rock', 'Hip Hop / Rap'],
    'nu metal':            ['Metal & Hard Rock', 'Hip Hop / Rap'],
    'eurodance':           ['EDM / Electronic', 'Pop & New Wave', 'Deutsche Musik'],
    'europop':             ['EDM / Electronic', 'Pop & New Wave', 'Deutsche Musik'],
    'new wave':            ['Rock', 'Punk', 'Pop & New Wave', 'Deutsche Musik'],
    'neue deutsche welle': ['Deutsche Musik', 'Rock', 'Pop & New Wave'],
    'schlager':            ['Deutsche Musik', 'Pop & New Wave'],
    'deutscher pop':       ['Deutsche Musik', 'Pop & New Wave'],
    'disco house':         ['EDM / Electronic', 'Funk, Soul & R&B', 'Synthwave / Electronica'],
    'italo disco':         ['EDM / Electronic', 'Funk, Soul & R&B', 'Synthwave / Electronica'],
    'hip house':           ['EDM / Electronic', 'Hip Hop / Rap'],
    'glam metal':          ['Metal & Hard Rock', 'Rock'],
    'hard rock':           ['Metal & Hard Rock', 'Rock'],
    'bluesrock':           ['Funk, Soul & R&B', 'Rock'],
    'klassischer rock':    ['Funk, Soul & R&B', 'Rock'],
    'southern rock':       ['Funk, Soul & R&B', 'Rock'],"""

_HELPER_FUNCTIONS = """\
export function getNeighboursWeighted(mainId) {
  const m = GENRE_CONFIG.mainGenres.find(g => g.id === mainId);
  return m ? [...m.neighbours].sort((a,b) => b.weight - a.weight) : [];
}

export function getNeighbours(mainId) {
  return getNeighboursWeighted(mainId).map(n => n.mainId);
}

export function bridgeTags(mainId, neighbourId) {
  return Object.entries(GENRE_CONFIG.bridgeSubgenres)
    .filter(([, mains]) => mains.includes(mainId) && mains.includes(neighbourId))
    .map(([tag]) => tag);
}

export function bridgeTagsForMain(mainId) {
  return Object.entries(GENRE_CONFIG.bridgeSubgenres)
    .filter(([, mains]) => mains.includes(mainId))
    .map(([tag]) => tag);
}

export function getSubgenres(t) {
  return Array.isArray(t.genres_raw) ? t.genres_raw : [];
}

export function getGenreRole(mainId) {
  const m = GENRE_CONFIG.mainGenres.find(g => g.id === mainId);
  return m ? m.role : 'peak';
}

export function getRoleBonus(mainId, phase) {
  const m = GENRE_CONFIG.mainGenres.find(g => g.id === mainId);
  if (!m) return 0;
  if (phase === 'A' && m.role === 'warmup')   return  0.3;
  if (phase === 'D' && m.role === 'cooldown') return  0.3;
  if ((phase === 'A' || phase === 'D') && m.role === 'peak') return -0.2;
  return 0;
}"""


def _js_neighbours(nb_list: list[dict]) -> str:
    lines = []
    for n in nb_list:
        mid = f"'{n['mainId']}',"
        lines.append(f"        {{ mainId: {mid:<37} weight: {n['weight']} }},")
    return '\n'.join(lines)


def write_genres_js(neighbours: dict[str, list[dict]]) -> None:
    genre_order = list(GENRE_ROLES.keys())
    main_blocks = []
    for g in genre_order:
        role = GENRE_ROLES[g]
        nb = neighbours.get(g, [])
        nb_js = _js_neighbours(nb)
        main_blocks.append(
            f"    {{ id: '{g}', role: '{role}',\n"
            f"      neighbours: [\n{nb_js}\n"
            f"      ]}}"
        )

    main_genres_js = ',\n'.join(main_blocks)

    output = f"""\
// genres.js — GENRE_CONFIG SSOT; pure data + pure helpers; no DOM, no imports, no side effects
// GENERATED by scripts/build_genre_config.py — do not edit manually
// Data: data/everynoise_genre_attrs.csv (Everynoise, frozen 2025)
// Rebuild: python scripts/build_genre_config.py

export const GENRE_CONFIG = {{

  mainGenres: [
{main_genres_js},
  ],

  bridgeSubgenres: {{
{_BRIDGE_SUBGENRES}
  }},

  pickerStrategy: {{
    subgenreFirst: true,
    neighbourEarly: true,
    escalation: ['subgenre', 'mainGenre', 'bridgePivot', 'neighbourMain'],
  }},
}};

{_HELPER_FUNCTIONS}
"""
    OUTPUT_FILE.write_text(output, encoding='utf-8')
    print(f'[write] {OUTPUT_FILE} updated ({len(output):,} bytes)')


# ──────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────

def main() -> None:
    force_refresh = '--refresh' in sys.argv

    ensure_csv(force_refresh)
    _raw_lookup, norm_lookup = load_everynoise()
    tracks = load_tracks()
    coverage_report(tracks, norm_lookup)
    centroids = compute_centroids(tracks, norm_lookup)
    neighbours = compute_neighbours(centroids)
    write_genres_js(neighbours)
    print('[done] genres.js regenerated successfully')


if __name__ == '__main__':
    main()
