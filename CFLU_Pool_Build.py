"""
CFLU_Pool_Build.py
==================
ETL-Pipeline: Playlists/*.csv → cflu_tracks.js

E — Extract : Alle CSVs alphabetisch einlesen, Dedup per Spotify Track Id
T — Transform: Typ-Cast, Format-Konversion, Genre-Ableitung, Suffix-Bereinigung
L — Load     : Bestehende cflu_tracks.js einlesen, mergen, neu schreiben

Verwendung:
    python CFLU_Pool_Build.py
"""

import csv
import json
import re
import os
import glob
import pathlib
from collections import defaultdict

# ===== KONFIGURATION =====
PLAYLISTS_DIR = 'Playlists'
OUTPUT_FILE = 'cflu_tracks.js'
GERMAN_GENRES = ['Moderne Deutsche Musik', 'Deutschrock / NDW / Schlager']

# ===== SUFFIX-BEREINIGUNG =====
SUFFIX_RE = re.compile(
    r'[\s\-–(]*(radio\s*edit|single\s*edit|album\s*version|original\s*mix|'
    r'club\s*mix|extended\s*(mix|version)?|long\s*version|remaster(ed)?.*|'
    r'feat\..*|ft\..*|live.*|acoustic.*|mono.*|stereo.*|\d{4}\s*remaster.*)'
    r'[^)]*\)?',
    re.IGNORECASE
)

GERMAN_KEYWORDS = [
    'neue deutsche welle', 'deutscher pop', 'ndw', 'deutschrock',
    'deutsch', 'schlager', 'schlagerparty', 'german', 'deutschrap',
    'deutscher hip', 'kolsch', 'karneval',
]

# ===== GENRE-KEYWORD-TABELLEN =====
# Änderungen am Genre-Mapping hier vornehmen, nicht in classify() selbst.

_SKA_TRIGGER       = ['ska', 'rocksteady']
_SKA_WEIGHT_KEYS   = ['ska', 'rocksteady', 'ska punk']
_PUNK_WEIGHT_KEYS  = ['punk rock', 'skate punk', 'pop punk', 'hardcore punk']
_REGGAE_KEYWORDS   = ['reggae', 'dub', 'dancehall', 'ragga']
_PUNK_KEYWORDS     = ['punk', 'skate punk', 'ska punk', 'pop punk', 'hardcore punk',
                      'oi!', 'street punk', 'melodic hardcore']
_EDM_KEYWORDS      = ['edm', 'house', 'techno', 'trance', 'dubstep', 'hardstyle', 'hypertechno',
                      'big room', 'melodic techno', 'melodic house', 'eurobeat', 'electro house',
                      'bass house', 'tech house', 'future bass', 'slap house', 'melbourne bounce',
                      'big beat', 'eurodance', 'hi-nrg', 'bubblegum dance', 'italo disco',
                      'happy hardcore', 'italo dance', 'gabba', 'hands up',
                      'electroclash', 'indie dance', 'elektronische musik', 'electronica',
                      'indietronica']
_SYNTH_KEYWORDS    = ['synthwave', 'vaporwave', 'chillwave', 'outrun', 'retrowave',
                      'darksynth', 'dreamwave', 'trip-hop', 'downtempo', 'new age', 'ambient',
                      'lo-fi', 'darkwave']
_DANCE_POP_KEYS    = ['tropical house', 'dance pop', 'electro swing']
_BLUES_EXCLUDE     = ['hip-hop', 'hip hop', 'rap', 'r&b', 'funk', 'disco', 'metal', 'soul', 'motown']
_BLUES_KEYWORDS    = ['classic blues', 'traditional blues', 'chicago blues', 'delta blues',
                      'modern blues', 'british blues', 'texas blues']
_METAL_KEYWORDS    = ['metal', 'glam metal', 'heavy metal', 'thrash metal', 'death metal']
_ROCK_KEYWORDS     = ['rock', 'hard rock', 'klassischer rock', 'classic rock', 'soft rock',
                      'aor', 'arena rock', 'album rock', 'glam rock', 'post-grunge',
                      'alternative rock', 'indie rock', 'grunge', 'new wave', 'post-punk',
                      'mellow gold', 'permanent wave', 'emo', 'neo mellow', 'lilith',
                      'folk rock', 'celtic rock', 'keltische musik', 'bluesrock']
_HIP_HOP_KEYWORDS  = ['hip-hop', 'hip hop', 'rap', 'r&b', 'old school', 'east coast', 'west coast',
                      'trap', 'grime', 'urban contemporary', 'new jack swing', 'crunk']
_FUNK_KEYWORDS     = ['funk', 'disco', 'soul', 'motown', 'boogie']
_POP_KEYWORDS      = ['pop', 'new wave', 'new romantic', 'synthpop', 'singer-songwriter',
                      'country', 'europop', 'boy band', 'girl group']

# Muss mit BPM_RANGES in js/config.js identisch bleiben.
_BPM_GROUPS = [('A',0,90),('B',90,110),('C',110,120),('D',120,130),('E',130,140),
               ('F',140,150),('G',150,160),('H',160,175),('I',175,999)]


# ===== GENRE-KLASSIFIZIERUNG =====
def is_modern_year(album_date_str):
    """True wenn Jahr >= 2000."""
    if not album_date_str:
        return False
    try:
        return int(album_date_str[:4]) >= 2000
    except (ValueError, IndexError):
        return False


def classify(genres_str, parent_str, bpm, album_date_str=''):
    """Gibt eine der 12 Genre-Gruppen zurück. Keyword-Tabellen → Modul-Ebene."""
    genres = genres_str.lower()
    parent = parent_str.lower()

    is_german = any(kw in genres for kw in GERMAN_KEYWORDS)
    is_modern = is_modern_year(album_date_str)

    # Ska & Reggae (vor Punk — ska-punk Gewichtung)
    if any(x in genres for x in _SKA_TRIGGER):
        ska_w  = sum(1 for x in _SKA_WEIGHT_KEYS if x in genres)
        punk_w = sum(1 for x in _PUNK_WEIGHT_KEYS if x in genres)
        if ska_w >= punk_w:
            return 'Ska & Reggae'
    if any(x in genres for x in _REGGAE_KEYWORDS):
        return 'Ska & Reggae'

    if any(x in genres for x in _PUNK_KEYWORDS):
        return 'Punk'

    if any(x in genres for x in _EDM_KEYWORDS) and bpm >= 118:
        return 'EDM / Electronic'

    if any(x in genres for x in _SYNTH_KEYWORDS):
        return 'Synthwave / Electronica'

    # Dance Pop: BPM-konditional zwischen EDM und Pop
    if any(x in genres for x in _DANCE_POP_KEYS):
        return 'EDM / Electronic' if bpm >= 118 else 'Pop & New Wave'

    if is_german and is_modern:
        return 'Moderne Deutsche Musik'
    if is_german:
        return 'Deutschrock / NDW / Schlager'

    if 'blues' in parent and 'rock' not in parent and not any(x in genres for x in _BLUES_EXCLUDE):
        return 'Blues & Soul'
    if any(x in genres for x in _BLUES_KEYWORDS) and 'metal' not in genres:
        return 'Blues & Soul'

    if any(x in genres for x in _METAL_KEYWORDS):
        return 'Metal & Hard Rock'

    if any(x in genres for x in _ROCK_KEYWORDS):
        return 'Rock'

    if any(x in genres for x in _HIP_HOP_KEYWORDS):
        return 'Hip Hop & R&B'

    if any(x in genres for x in _FUNK_KEYWORDS):
        return 'Funk & Disco'

    if any(x in genres for x in _POP_KEYWORDS) or 'pop' in parent or 'rock' in parent:
        return 'Pop & New Wave'

    # Parent-Genre-Fallbacks
    if 'blues' in parent and 'rock' not in parent:
        return 'Blues & Soul'
    if 'electronic' in parent:
        return 'EDM / Electronic' if bpm >= 118 else 'Synthwave / Electronica'
    if 'reggae' in parent:
        return 'Ska & Reggae'
    if 'r&b' in parent or 'hip hop' in parent:
        return 'Hip Hop & R&B'

    return 'Pop & New Wave'


def bpm_group(bpm):
    for g, lo, hi in _BPM_GROUPS:
        if lo <= bpm < hi:
            return g
    return 'I'


# ===== HILFSFUNKTIONEN =====
def clean_song(title):
    return SUFFIX_RE.sub('', title).strip()


def parse_dur(s):
    """'MM:SS' → int Sekunden. ValueError bei ungültigem Format."""
    parts = str(s).strip().split(':')
    if len(parts) < 2:
        raise ValueError(f'Ungültiges Dauerformat: {s!r}')
    return int(parts[0]) * 60 + int(parts[1])


def safe_int(val, field):
    """int-Cast; ValueError mit Feldname bei Fehler."""
    try:
        return int(val)
    except (ValueError, TypeError):
        raise ValueError(f'Ungültiger int-Wert für {field!r}: {val!r}')


def split_tags(s):
    """Komma-getrennte Tags → list[str], bereinigt."""
    if not s or not s.strip():
        return []
    return [t.strip() for t in s.split(',') if t.strip()]


# ===== E — EXTRACT =====
def extract():
    """Liest alle Playlists/*.csv, gibt {spotify_id: raw_row} zurück (erster Fund gewinnt)."""
    pattern = os.path.join(PLAYLISTS_DIR, '**', '*.csv')
    csv_files = sorted(glob.glob(pattern, recursive=True))
    if not csv_files:
        raise FileNotFoundError(
            f'Keine CSV-Dateien in {PLAYLISTS_DIR}/ gefunden.'
        )

    extracted = {}
    files_read = 0
    total_rows = 0
    duplicates = 0

    for path in csv_files:
        files_read += 1
        with open(path, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                total_rows += 1
                tid = row.get('Spotify Track Id', '').strip()
                if not tid:
                    continue
                if tid in extracted:
                    duplicates += 1
                else:
                    extracted[tid] = row

    print(f'  CSVs gelesen       : {files_read}')
    print(f'  Tracks extrahiert  : {len(extracted)}')
    print(f'  Quelldoubletten    : {duplicates}')
    return extracted


# ===== T — TRANSFORM =====
def transform(extracted):
    """
    Wandelt raw_rows in Track-Dicts um.
    Pflichtfelder (✓): bei Fehler wird der Track verworfen.
    Optionale Felder (O): Fehler → null/[]/False.
    """
    tracks = []
    rejected = 0
    rejected_reasons = defaultdict(int)

    for tid, row in extracted.items():
        try:
            # Pflichtfelder — jeder Fehler verwirft den Track
            song_raw = row.get('Song', '').strip()
            if not song_raw:
                raise ValueError('song')
            song = clean_song(song_raw)
            if not song:
                raise ValueError('song')

            artist = row.get('Artist', '').strip()
            if not artist:
                raise ValueError('artist')

            bpm = safe_int(row.get('BPM', ''), 'bpm')
            if bpm <= 0:
                raise ValueError('bpm')

            camelot = row.get('Camelot', '').strip()
            if not camelot:
                raise ValueError('camelot')

            energy = safe_int(row.get('Energy', ''), 'energy')

            dur = parse_dur(row.get('Duration', ''))
            if dur <= 0:
                raise ValueError('dur')

            popularity = safe_int(row.get('Popularity', ''), 'popularity')

            genres_raw = split_tags(row.get('Genres', ''))
            if not genres_raw:
                raise ValueError('genres_raw')

            dance        = safe_int(row.get('Dance', ''),          'dance')
            acoustic     = safe_int(row.get('Acoustic', ''),       'acoustic')
            instrumental = safe_int(row.get('Instrumental', ''),   'instrumental')
            valence      = safe_int(row.get('Valence', ''),        'valence')
            speech       = safe_int(row.get('Speech', ''),         'speech')
            live         = safe_int(row.get('Live', ''),           'live')
            loud         = safe_int(row.get('Loud (Db)', ''),      'loud')

            explicit_raw = row.get('Explicit', '').strip().lower()
            explicit     = explicit_raw == 'yes'

            # Optionale Felder — Fehler → null
            parent_genres = split_tags(row.get('Parent Genres', ''))
            album         = row.get('Album', '').strip() or None
            album_date    = row.get('Album Date', '').strip() or None
            added_at      = row.get('Added At', '').strip() or None
            key           = row.get('Key', '').strip() or None
            label         = row.get('Label', '').strip() or None
            isrc          = row.get('ISRC', '').strip() or None

            time_sig_raw = row.get('Time Signature', '').strip()
            try:
                time_sig = int(time_sig_raw) if time_sig_raw else None
            except ValueError:
                time_sig = None

            # Abgeleitete Felder
            genres_raw_str = row.get('Genres', '')
            parent_raw_str = row.get('Parent Genres', '')
            genre = classify(genres_raw_str, parent_raw_str, bpm, album_date or '')
            if genre is None:
                raise ValueError('genre')

            tracks.append({
                'id':           tid,
                'song':         song,
                'artist':       artist,
                'bpm':          bpm,
                'camelot':      camelot,
                'energy':       energy,
                'added_at':     added_at,
                'dur':          dur,
                'popularity':   popularity,
                'genres_raw':   genres_raw,
                'parent_genres': parent_genres,
                'album':        album,
                'album_date':   album_date,
                'dance':        dance,
                'acoustic':     acoustic,
                'instrumental': instrumental,
                'valence':      valence,
                'speech':       speech,
                'live':         live,
                'loud':         loud,
                'key':          key,
                'time_sig':     time_sig,
                'label':        label,
                'isrc':         isrc,
                'explicit':     explicit,
                'genre':        genre,
                'bpmg':         bpm_group(bpm),
            })

        except ValueError as e:
            rejected += 1
            rejected_reasons[str(e)] += 1

    print(f'  Tracks verworfen   : {rejected}')
    if rejected_reasons:
        for reason, cnt in sorted(rejected_reasons.items(), key=lambda x: -x[1]):
            print(f'    {reason}: {cnt}')
    return tracks


# ===== L — LOAD / MERGE =====
def load_existing():
    """Liest cflu_tracks.js → Dict {id: track}. Normalisiert fehlendes locked auf 0."""
    if not os.path.exists(OUTPUT_FILE):
        return {}
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    prefix = 'const TRACK_DATA='
    if content.startswith(prefix):
        content = content[len(prefix):]
    if content.endswith(';'):
        content = content[:-1]
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        print('  WARNUNG: cflu_tracks.js konnte nicht geparst werden — wird neu erstellt.')
        return {}

    existing = {}
    for t in data.get('tracks', []):
        tid = t.get('id', '').strip()
        if not tid:
            continue
        if 'locked' not in t:
            t['locked'] = 0
        existing[tid] = t
    return existing


def compute_stats(tracks):
    genre_groups = defaultdict(list)
    for t in tracks:
        genre_groups[t['genre']].append(t)

    stats = {}
    for genre, gt in genre_groups.items():
        durs = [t['dur'] for t in gt if t['dur'] > 30]
        stats[genre] = {
            'count':      len(gt),
            'avg_dur':    round(sum(durs) / len(durs)) if durs else 210,
            'avg_energy': round(sum(t['energy'] for t in gt) / len(gt)),
            'avg_bpm':    round(sum(t['bpm'] for t in gt) / len(gt)),
        }

    all_de = [t for t in tracks if t['genre'] in GERMAN_GENRES]
    stats['Alle Deutschen Tracks'] = {
        'count':      len(all_de),
        'avg_dur':    round(sum(t['dur'] for t in all_de) / len(all_de)) if all_de else 210,
        'avg_energy': round(sum(t['energy'] for t in all_de) / len(all_de)) if all_de else 70,
        'avg_bpm':    round(sum(t['bpm'] for t in all_de) / len(all_de)) if all_de else 120,
    }
    stats['Going Wild'] = {
        'count':      len(tracks),
        'avg_dur':    round(sum(t['dur'] for t in tracks) / len(tracks)) if tracks else 210,
        'avg_energy': round(sum(t['energy'] for t in tracks) / len(tracks)) if tracks else 70,
        'avg_bpm':    round(sum(t['bpm'] for t in tracks) / len(tracks)) if tracks else 120,
    }
    return stats


def merge(transformed, existing, import_only=False):
    """
    Merged CSV-Tracks in bestehenden Pool.
    - Neu       : anhängen (locked=0)
    - locked=1  : immer überspringen
    - locked=0  : aktualisieren (Vollmodus) oder überspringen (import_only=True)
    """
    count_new      = 0
    count_updated  = 0  # im import_only-Modus: bereits im Pool (übersprungen)
    count_locked   = 0

    merged = dict(existing)  # Kopie, enthält auch Tracks die nicht in CSVs sind

    for t in transformed:
        tid = t['id']
        if tid not in merged:
            t['locked'] = 0
            merged[tid] = t
            count_new += 1
        elif merged[tid].get('locked', 0) == 1:
            count_locked += 1
        elif import_only:
            count_updated += 1  # bereits im Pool — überspringen
        else:
            t['locked'] = 0
            merged[tid] = t
            count_updated += 1

    print(f'  Tracks neu         : {count_new}')
    if import_only:
        print(f'  Bereits im Pool    : {count_updated}')
    else:
        print(f'  Tracks aktualisiert: {count_updated}')
    print(f'  Tracks gesperrt    : {count_locked}')
    print(f'  Tracks gesamt      : {len(merged)}')

    return list(merged.values()), count_new, count_updated


# ===== POOL-CLEANUP =====
def dedup_pool(tracks):
    """Entfernt Titeldobbletten nach dem Merge.
    Key: (artist.lower(), song.lower()) — song ist zu diesem Zeitpunkt bereits SUFFIX_RE-bereinigt.
    Locked=1 hat Vorrang: locked-Tracks werden zuerst iteriert, damit sie nicht durch
    ein früher im Pool stehendes locked=0-Duplikat verdrängt werden.
    Rückgabe in Originalreihenfolge der behaltenen Tracks."""
    locked_first = sorted(range(len(tracks)), key=lambda i: -tracks[i].get('locked', 0))
    seen = {}
    keep_ids = set()
    for i in locked_first:
        t = tracks[i]
        key = (t['artist'].lower().strip(), t['song'].lower().strip())
        if key not in seen:
            seen[key] = t['id']
            keep_ids.add(t['id'])

    removed = len(tracks) - len(keep_ids)
    print(f'  Doubletten entfernt: {removed}')
    return [t for t in tracks if t['id'] in keep_ids]


# ===== HAUPTFUNKTION =====
def build(import_only=False):
    print()
    print('CFLU Pool Builder — ETL-Pipeline')
    print('=' * 40)
    if import_only:
        print('  Modus: Import-Only (bestehende Tracks werden nicht überschrieben)')

    # E — Extract
    print('\n[E] Extract')
    extracted = extract()

    # T — Transform
    print('\n[T] Transform')
    transformed = transform(extracted)

    # L — Load & Merge
    print('\n[L] Load & Merge')
    existing = load_existing()
    if existing:
        print(f'  Bestehende Tracks  : {len(existing)}')
    else:
        print('  Kein bestehender Pool — wird neu erstellt.')
    tracks, count_new, count_updated = merge(transformed, existing, import_only=import_only)

    # C — Cleanup
    print('\n[C] Cleanup')
    tracks = dedup_pool(tracks)

    # Stats berechnen
    stats = compute_stats(tracks)

    # Schreiben — ein Track pro Zeile für Lesbarkeit
    track_lines = ',\n'.join(
        json.dumps(t, ensure_ascii=False, separators=(',', ':')) for t in tracks
    )
    stat_lines = ',\n'.join(
        json.dumps(k, ensure_ascii=False) + ':' + json.dumps(v, ensure_ascii=False, separators=(',', ':'))
        for k, v in stats.items()
    )
    file_content = (
        f'const TRACK_DATA={{\n'
        f'"tracks":[\n{track_lines}\n],\n'
        f'"stats":{{\n{stat_lines}\n}}'
        f'}};\n'
    )
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(file_content)

    kb = len(file_content.encode('utf-8')) // 1024
    print(f'\ncflu_tracks.js geschrieben ({kb} KB, {len(tracks)} Tracks)')
    print('\nGenre-Verteilung:')
    gc = defaultdict(int)
    for t in tracks:
        gc[t['genre']] += 1
    for g in sorted(gc, key=lambda x: -gc[x]):
        print(f'  {g}: {gc[g]}')
    print()
    return (count_new, count_updated, len(tracks))


if __name__ == '__main__':
    # L-03: Work from script's directory so relative paths (Playlists/, cflu_tracks.js) work
    # regardless of CWD when launched from terminal, batch file, or systemd.
    os.chdir(pathlib.Path(__file__).parent)
    build()
