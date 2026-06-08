# CFLU_Pool_Build.py — ETL pipeline only; reads Playlists/*.csv, writes cflu_tracks.js; no HTTP, no UI
"""
CFLU_Pool_Build.py
==================
ETL-Pipeline: Playlists/*.csv → cflu_tracks.js

E — Extract          : Alle CSVs rekursiv einlesen, Dedup per Spotify Track Id
T — Transform        : Typ-Cast, Format-Konversion, Genre-Ableitung, Suffix-Bereinigung
L — Load & Merge     : Bestehende cflu_tracks.js einlesen, mergen, neu schreiben
G — Genre-Vererbung  : open_genre=1 → 4: genres_raw vom gleichen Künstler erben
A — AI-Genre         : open_genre=1/4 → 2/5: Claude Haiku Klassifikation (BYOK)
C — Cleanup          : Titeldobbletten entfernen
M — Mood Tags        : Claude Haiku Batch-Tagging (BYOK)

Verwendung:
    python CFLU_Pool_Build.py           # Add-only (bestehende Tracks unverändert)
    python CFLU_Pool_Build.py --rebuild # Full-Update (dynamische Felder erhalten)
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
                      'oi!', 'street punk', 'melodic hardcore', 'post-hardcore', 'screamo',
                      'folk punk', 'psychobilly', 'celtic punk', 'dance-punk', 'riot grrrl']
_EDM_KEYWORDS      = ['edm', 'house', 'techno', 'trance', 'dubstep', 'hardstyle', 'hypertechno',
                      'big room', 'melodic techno', 'melodic house', 'eurobeat', 'electro house',
                      'bass house', 'tech house', 'future bass', 'slap house', 'melbourne bounce',
                      'big beat', 'eurodance', 'hi-nrg', 'bubblegum dance', 'italo disco',
                      'happy hardcore', 'italo dance', 'gabba', 'hands up',
                      'electroclash', 'indie dance', 'elektronische musik', 'electronica',
                      'indietronica', 'drum and bass', 'dnb', 'jungle', 'uk garage', 'uk dance']
_SYNTH_KEYWORDS    = ['synthwave', 'vaporwave', 'chillwave', 'outrun', 'retrowave',
                      'darksynth', 'dreamwave', 'trip-hop', 'downtempo', 'new age', 'ambient',
                      'lo-fi', 'darkwave', 'industrial', 'ebm', 'dark ambient']
_DANCE_POP_KEYS    = ['tropical house', 'dance pop']
_BLUES_EXCLUDE     = ['hip-hop', 'hip hop', 'rap', 'r&b', 'funk', 'disco', 'metal', 'soul', 'motown']
_BLUES_KEYWORDS    = ['classic blues', 'traditional blues', 'chicago blues', 'delta blues',
                      'modern blues', 'british blues', 'texas blues',
                      'soul jazz', 'vocal jazz', 'smooth jazz', 'nu jazz', 'jazz fusion', 'acid jazz']
_METAL_KEYWORDS    = ['metal', 'glam metal', 'heavy metal', 'thrash metal', 'death metal',
                      'groove metal', 'speed metal', 'doom metal', 'stoner metal', 'sludge metal',
                      'djent', 'melodic death metal', 'deathcore', 'grindcore']
_ROCK_KEYWORDS     = ['rock', 'hard rock', 'klassischer rock', 'classic rock', 'soft rock',
                      'aor', 'arena rock', 'album rock', 'glam rock', 'post-grunge',
                      'alternative rock', 'indie rock', 'grunge', 'post-punk',
                      'mellow gold', 'permanent wave', 'emo', 'neo mellow', 'lilith',
                      'folk rock', 'celtic rock', 'keltische musik', 'bluesrock']
_HIP_HOP_KEYWORDS  = ['hip-hop', 'hip hop', 'rap', 'r&b', 'old school', 'east coast', 'west coast',
                      'trap', 'grime', 'urban contemporary', 'new jack swing', 'crunk',
                      'hip pop', 'jazz rap', 'jazz beats']
_FUNK_KEYWORDS     = ['funk', 'disco', 'soul', 'motown', 'boogie', 'jazz funk', 'funk rock']
_POP_KEYWORDS      = ['pop', 'new wave', 'electro swing', 'new romantic', 'synthpop',
                      'singer-songwriter', 'country', 'europop', 'boy band', 'girl group']

# Muss mit BPM_RANGES in js/config.js identisch bleiben.
_BPM_GROUPS = [('A',0,90),('B',90,110),('C',110,120),('D',120,130),('E',130,140),
               ('F',140,150),('G',150,160),('H',160,175),('I',175,999)]

# Kanonisches genres_raw-Keyword pro Genre-Gruppe.
# Wird für AI-zugewiesene Tracks (open_genre=2) in genres_raw gesetzt,
# damit inherit_genres() diese Tracks als Vererbungsquelle nutzen kann.
_AI_MODEL = 'claude-haiku-4-5-20251001'

_GENRE_CANONICAL = {
    'EDM / Electronic':             'edm',
    'Pop & New Wave':               'pop',
    'Rock':                         'rock',
    'Metal & Hard Rock':            'metal',
    'Synthwave / Electronica':      'synthwave',
    'Ska & Reggae':                 'reggae',
    'Moderne Deutsche Musik':       'deutschpop',
    'Hip Hop & R&B':                'hip hop',
    'Punk':                         'punk',
    'Funk & Disco':                 'funk',
    'Deutschrock / NDW / Schlager': 'deutschrock',
    'Blues & Soul':                 'classic blues',
}
_ALLOWED_GENRES = list(_GENRE_CANONICAL.keys())


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
    if any(x in genres for x in _REGGAE_KEYWORDS) and 'dubstep' not in genres:
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
    if 'blues' in genres and 'rock' not in genres and 'metal' not in genres:
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
            # empty genres are valid — classify() falls back to 'Pop & New Wave'

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

            # 0=importiert, 1=nicht importiert (kein Genre in Spotify)
            open_genre = 0 if genres_raw else 1

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
                'open_genre':   open_genre,
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
                'mood_tags':    [],
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


def merge(transformed, existing, rebuild=False):
    """
    Merged CSV-Tracks in bestehenden Pool.
    - Neu        : anhängen (locked=0)
    - locked=1   : immer überspringen
    - rebuild=False (Default): bestehende Tracks unverändert lassen (nur ergänzen)
    - rebuild=True: bestehenden Track aktualisieren; dynamische Felder bleiben erhalten:
        mood_tags  → immer erhalten
        open_genre → erhalten wenn Wert ≥ 2 (AI- oder manuell gepflegt)
    """
    count_new      = 0
    count_skipped  = 0
    count_updated  = 0
    count_locked   = 0

    merged = dict(existing)

    for t in transformed:
        tid = t['id']
        if tid not in merged:
            t['locked'] = 0
            merged[tid] = t
            count_new += 1
        elif merged[tid].get('locked', 0) == 1:
            count_locked += 1
        elif not rebuild:
            count_skipped += 1
        else:
            existing_tags      = merged[tid].get('mood_tags', [])
            existing_og        = merged[tid].get('open_genre', 0)
            existing_ai_genres = merged[tid].get('genres_raw', []) if existing_og == 2 else None
            existing_ai_genre  = merged[tid].get('genre')          if existing_og == 2 else None
            t['locked'] = merged[tid].get('locked', 0)
            merged[tid] = t
            if existing_tags:
                merged[tid]['mood_tags'] = existing_tags
            if existing_og in (2, 3, 5):  # 4=vererbt wird neu berechnet
                merged[tid]['open_genre'] = existing_og
            if existing_og == 2 and existing_ai_genres is not None:
                merged[tid]['genres_raw'] = existing_ai_genres
                merged[tid]['genre']      = existing_ai_genre
            count_updated += 1

    print(f'  Tracks neu         : {count_new}')
    print(f'  Tracks aktualisiert: {count_updated}')
    print(f'  Tracks unverändert : {count_skipped}')
    print(f'  Tracks gesperrt    : {count_locked}')
    print(f'  Tracks gesamt      : {len(merged)}')

    return list(merged.values()), count_new, count_updated


# ===== G — GENRE-VERERBUNG =====
def inherit_genres(tracks):
    """
    Für Tracks mit open_genre=1 (kein Spotify-Genre):
    genres_raw von einem anderen Track desselben Künstlers erben (open_genre=0 oder 4).
    Setzt open_genre=4, aktualisiert genres_raw + genre + bpmg.
    Behandlung wie 0 — abgeleitet, nicht manuell/AI-gepflegt.
    """
    # Erster Fund pro Künstler mit gesichertem Genre (0=Spotify, 2=AI, 4=vererbt)
    artist_genres = {}
    for t in tracks:
        if t.get('open_genre', 0) in (0, 2, 4) and t.get('genres_raw'):
            key = t['artist'].lower()
            if key not in artist_genres:
                artist_genres[key] = t['genres_raw']

    count = 0
    for t in tracks:
        if t.get('open_genre', 0) != 1:
            continue
        inherited = artist_genres.get(t['artist'].lower())
        if not inherited:
            continue
        t['genres_raw'] = inherited
        t['genre']      = classify(
            ', '.join(inherited),
            ', '.join(t.get('parent_genres', [])),
            t.get('bpm', 0),
            t.get('album_date') or '',
        )
        t['bpmg']       = bpm_group(t.get('bpm', 0))
        t['open_genre'] = 4
        count += 1

    return count


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


# ===== M — MOOD TAGS =====
_MOOD_TAGS = [
    'aggressive', 'pump-up', 'euphoric', 'dark',
    'groovy', 'chill', 'anthem', 'build-up',
    'emotional', 'heavy', 'energetic', 'triumphant',
    'gritty', 'smooth', 'explosive',
]


def tag_moods(tracks):
    """
    Tags tracks with up to 4 WOD mood labels via Claude Haiku.
    Reads API key from anthropic_api_key.txt (gitignored).
    Skips gracefully if file missing or anthropic package not installed.
    Skips tracks that already have non-empty mood_tags (re-run safe).
    Returns count of newly tagged tracks.
    """
    key_path = 'anthropic_api_key.txt'
    if not os.path.exists(key_path):
        print('  anthropic_api_key.txt nicht gefunden — Mood-Tagging übersprungen.')
        return 0

    try:
        import anthropic
    except ImportError:
        print('  anthropic-Paket fehlt — Mood-Tagging übersprungen.')
        print('  Installation: pip install anthropic')
        return 0

    with open(key_path, 'r', encoding='utf-8') as f:
        api_key = f.read().strip()
    if not api_key:
        print('  anthropic_api_key.txt ist leer — Mood-Tagging übersprungen.')
        return 0

    untagged = [t for t in tracks if not t.get('mood_tags')]
    if not untagged:
        print('  Alle Tracks bereits getaggt.')
        return 0

    print(f'  Tracks zu taggen    : {len(untagged)}')
    client = anthropic.Anthropic(api_key=api_key)
    tag_list = ', '.join(_MOOD_TAGS)
    batch_size = 20
    tagged_count = 0
    total_batches = (len(untagged) + batch_size - 1) // batch_size

    for batch_idx in range(0, len(untagged), batch_size):
        batch = untagged[batch_idx:batch_idx + batch_size]
        lines = []
        for j, t in enumerate(batch):
            genres_preview = ', '.join(t.get('genres_raw', [])[:3])
            lines.append(
                f'{j+1}. "{t["song"]}" by {t["artist"]}'
                f' | genres: {genres_preview}'
                f' | BPM: {t["bpm"]} | Energy: {t["energy"]} | Valence: {t["valence"]}'
            )

        prompt = (
            f'Assign up to 4 WOD (CrossFit workout) mood tags to each track.\n'
            f'Use ONLY tags from this list: {tag_list}\n\n'
            f'Return exactly one line per track in format: <number>: tag1, tag2, tag3\n'
            f'No explanations, no extra text.\n\n'
            + '\n'.join(lines)
        )

        try:
            msg = client.messages.create(
                model=_AI_MODEL,
                max_tokens=512,
                messages=[{'role': 'user', 'content': prompt}]
            )
            for line in msg.content[0].text.strip().split('\n'):
                line = line.strip()
                if not line:
                    continue
                m = re.match(r'^(\d+):\s*(.+)$', line)
                if not m:
                    continue
                idx = int(m.group(1)) - 1
                if idx < 0 or idx >= len(batch):
                    continue
                raw = [tag.strip().lower() for tag in m.group(2).split(',')]
                valid = [tag for tag in raw if tag in _MOOD_TAGS][:4]
                batch[idx]['mood_tags'] = valid
                if valid:
                    tagged_count += 1
        except Exception as e:
            print(f'  Batch {batch_idx // batch_size + 1} Fehler: {e}')

        for t in batch:
            if not t.get('mood_tags'):
                t['mood_tags'] = []

        nr = batch_idx // batch_size + 1
        print(f'  Batch {nr}/{total_batches} ({min(batch_idx + batch_size, len(untagged))}/{len(untagged)})')

    return tagged_count


# ===== A — AI-GENRE-VERGABE =====
_AI_SYSTEM_PROMPT = """\
Du klassifizierst Musik-Tracks für einen WOD-Workout-Playlist-Builder.

Erlaubte Genre-Gruppen (exakt so zurückgeben):
- EDM / Electronic
- Pop & New Wave
- Rock
- Metal & Hard Rock
- Synthwave / Electronica
- Ska & Reggae
- Moderne Deutsche Musik
- Hip Hop & R&B
- Punk
- Funk & Disco
- Deutschrock / NDW / Schlager
- Blues & Soul

Regeln:
1. Antworte NUR mit einem JSON-Objekt:
   {"genre": "<eine der 12 Gruppen>", "confident": true}
   ODER {"genre": null, "confident": false}
2. Setze confident=true NUR wenn du zu mindestens 99% sicher bist.
3. Wenn der Songtitel einen Remix-/Edit-Hinweis enthält (z.B. "Remix", "Club Mix", \
"Radio Edit", "Bootleg", "Instrumental", "Mix"), priorisiere den Stil des Remixes \
über den Originalstil des Künstlers.
4. Songtitel + Künstler + BPM sind deine Grundlage. BPM ist unterstützendes Signal.
5. Erfinde keine Genres. Wenn ambivalent oder unbekannt: genre=null.
6. Gib ausschließlich das JSON-Objekt zurück, ohne Erklärung.\
"""


def tag_genres_ai(tracks):
    """
    AI-Genre-Vergabe für Tracks mit open_genre=1 (kein Spotify-Genre) oder
    open_genre=4 (vererbt, Titelprüfung kann abweichendes Genre erkennen).
    Überspringt Tracks mit open_genre=2/3 (bereits gepflegt).
    Setzt bei Treffer: genres_raw=[kanonisches Keyword], genre, bpmg, open_genre=2.
    """
    try:
        import anthropic as _anthropic
    except ImportError:
        print('  anthropic-Paket fehlt — AI-Genre übersprungen.')
        print('  Installation: pip install anthropic')
        return 0

    api_key_file = 'anthropic_api_key.txt'
    if not os.path.exists(api_key_file):
        print(f'  {api_key_file} nicht gefunden — AI-Genre übersprungen.')
        return 0
    with open(api_key_file, encoding='utf-8') as f:
        api_key = f.read().strip()
    if not api_key:
        print(f'  {api_key_file} ist leer — AI-Genre übersprungen.')
        return 0

    candidates = [t for t in tracks if t.get('open_genre') in (1, 4)]
    if not candidates:
        print('  Keine Kandidaten (open_genre=1 oder 4).')
        return 0

    n1 = sum(1 for t in candidates if t.get('open_genre') == 1)
    n4 = sum(1 for t in candidates if t.get('open_genre') == 4)
    print(f'  Kandidaten         : {len(candidates)}  (open_genre=1: {n1}, =4: {n4})')

    client = _anthropic.Anthropic(api_key=api_key)
    tagged = 0
    errors = 0

    for i, t in enumerate(candidates):
        user_msg = (
            f'Songtitel: {t.get("song", "")}\n'
            f'Künstler:  {t.get("artist", "")}\n'
            f'BPM:       {t.get("bpm", 0)}'
        )
        prev_og = t.get('open_genre', 1)
        try:
            resp = client.messages.create(
                model=_AI_MODEL,
                max_tokens=48,
                system=_AI_SYSTEM_PROMPT,
                messages=[{'role': 'user', 'content': user_msg}],
            )
            raw = resp.content[0].text.strip()
            m = re.search(r'\{[^{}]+\}', raw)
            if not m:
                raise ValueError('kein JSON in Antwort')
            result = json.loads(m.group(0))
            genre = result.get('genre')
            if result.get('confident') and genre in _ALLOWED_GENRES:
                # 1 oder 4 → 2
                canonical = _GENRE_CANONICAL[genre]
                t['genres_raw'] = [canonical]
                t['genre']      = genre
                t['bpmg']       = bpm_group(t.get('bpm', 0))
                t['open_genre'] = 2
                tagged += 1
            elif prev_og == 1:
                # API hat geantwortet, kein Fund — 1 → 5
                # State 4 bleibt 4 (geerbtes Genre ist besser als kein Genre)
                t['open_genre'] = 5
        except Exception:
            errors += 1
            # Netzwerk-/Parse-Fehler ≠ AI-Aussage → open_genre unverändert

        if (i + 1) % 25 == 0 or (i + 1) == len(candidates):
            print(f'  Fortschritt        : {i + 1}/{len(candidates)}'
                  f'  zugeordnet={tagged}  fehler={errors}')

    return tagged


# ===== R — REKLASSIFIZIERUNG (kein CSV-Import) =====
def _reclassify_only():
    """
    Reklassifizierungs-Modus: keine CSVs vorhanden.
    Liest cflu_tracks.js, wendet Keyword-Tabellen neu an, schreibt zurück.
    Nützlich nach Genre-Korrekturen ohne erneuten CSV-Import.
    """
    print('  Modus: Reklassifizierung (keine CSVs gefunden)')
    existing = load_existing()
    if not existing:
        print('  Keine bestehenden Tracks in cflu_tracks.js — nichts zu tun.')
        return (0, 0, 0)

    tracks = list(existing.values())
    changed = 0
    for t in tracks:
        genres_str = ', '.join(t.get('genres_raw', []))
        parent_str = ', '.join(t.get('parent_genres', []))
        bpm = t.get('bpm', 0)
        album_date = t.get('album_date') or ''
        new_genre = classify(genres_str, parent_str, bpm, album_date)
        new_bpmg = bpm_group(bpm)
        if t.get('genre') != new_genre or t.get('bpmg') != new_bpmg:
            t['genre'] = new_genre
            t['bpmg'] = new_bpmg
            changed += 1
        if 'mood_tags' not in t:
            t['mood_tags'] = []
        # open_genre backfill: 0=importiert, 1=kein Genre in Spotify
        if 'open_genre' not in t:
            t['open_genre'] = 0 if t.get('genres_raw') else 1

    print(f'  Tracks gesamt      : {len(tracks)}')
    print(f'  Reklassifiziert    : {changed}')

    print('\n[G] Genre-Vererbung')
    count_inherited = inherit_genres(tracks)
    print(f'  Genres vererbt     : {count_inherited}')

    print('\n[A] AI-Genre')
    tag_genres_ai(tracks)

    print('\n[C] Cleanup')
    tracks = dedup_pool(tracks)

    print('\n[M] Mood Tags')
    mood_count = tag_moods(tracks)
    if mood_count > 0:
        print(f'  Tracks neu getaggt : {mood_count}')

    stats = compute_stats(tracks)

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
    return (0, changed, len(tracks))


# ===== HAUPTFUNKTION =====
def build(rebuild=False):
    print()
    print('CFLU Pool Builder — ETL-Pipeline')
    print('=' * 40)
    print(f'  Modus: {"Rebuild (bestehende Tracks werden aktualisiert)" if rebuild else "Ergänzen (bestehende Tracks bleiben unverändert)"}')

    # E — Extract (FileNotFoundError → Reklassifizierungs-Modus)
    print('\n[E] Extract')
    try:
        extracted = extract()
    except FileNotFoundError:
        return _reclassify_only()

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
    tracks, count_new, count_updated = merge(transformed, existing, rebuild=rebuild)

    # G — Genre-Vererbung (open_genre 1→4)
    print('\n[G] Genre-Vererbung')
    count_inherited = inherit_genres(tracks)
    print(f'  Genres vererbt     : {count_inherited}')

    # A — AI-Genre (open_genre 1/4→2, optional)
    print('\n[A] AI-Genre')
    tag_genres_ai(tracks)

    # C — Cleanup
    print('\n[C] Cleanup')
    tracks = dedup_pool(tracks)

    # M — Mood Tags (optional, requires anthropic_api_key.txt + anthropic package)
    print('\n[M] Mood Tags')
    mood_count = tag_moods(tracks)
    if mood_count > 0:
        print(f'  Tracks neu getaggt : {mood_count}')

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
    import sys
    build(rebuild='--rebuild' in sys.argv)
