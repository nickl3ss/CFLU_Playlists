"""
CFLU_Pool_Build.py
==================
Generiert die Datenbasis (cflu_tracks.json) aus Spotify_Source.xlsx.
Ausgabe muss manuell als TRACK_DATA in CFLU_WOD_Builder.html eingebettet werden.

Verwendung:
    python CFLU_Pool_Build.py

Voraussetzungen:
    pip install pandas openpyxl
"""

import pandas as pd
import json
import datetime
import re
from collections import defaultdict

# ===== KONFIGURATION =====
INPUT_FILE = 'Spotify_Source.xlsx'
OUTPUT_FILE = 'cflu_tracks.json'

# Suffixe die vor Titelvergleich entfernt werden
SUFFIX_RE = re.compile(
    r'[\s\-\u2013(]*(radio\s*edit|single\s*edit|album\s*version|original\s*mix|'
    r'club\s*mix|extended\s*(mix|version)?|long\s*version|remaster(ed)?.*|'
    r'feat\..*|ft\..*|live.*|acoustic.*|mono.*|stereo.*|\d{4}\s*remaster.*)'
    r'[^)]*\)?',
    re.IGNORECASE
)

GERMAN_KEYWORDS = [
    'neue deutsche welle', 'deutscher pop', 'ndw', 'deutschrock',
    'deutsch', 'schlager', 'schlagerparty', 'german', 'deutschrap',
    'deutscher hip', 'kolsch', 'karneval'
]

# ===== DURATION PARSING =====
def parse_dur(d):
    """Parse duration from datetime.time or string MM:SS"""
    try:
        if isinstance(d, datetime.time):
            # Excel stores MM:SS as HH:MM in datetime.time
            return d.hour * 60 + d.minute
        s = str(d).strip()
        parts = s.split(':')
        if len(parts) >= 2:
            return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        pass
    return 210  # Fallback: 3:30

# ===== TITLE KEY =====
def title_key(song):
    """Normalize title for deduplication"""
    s = SUFFIX_RE.sub('', str(song))
    s = re.sub(r'[^a-z0-9]', '', s.lower())
    return s[:15]

# ===== GENRE CLASSIFICATION =====
def classify(row):
    genres = str(row.get('Genres', '')).lower()
    parent = str(row.get('Parent Genres', '')).lower()
    bpm = row.get('BPM', 0)
    album_date = row.get('Album Date')

    is_german = any(x in genres for x in GERMAN_KEYWORDS)
    is_modern = (
        album_date is not None
        and not pd.isnull(album_date)
        and album_date.year >= 2000
    )

    # Ska (before Punk)
    if any(x in genres for x in ['ska', 'rocksteady']):
        ska_w = sum(1 for x in ['ska', 'rocksteady', 'ska punk'] if x in genres)
        punk_w = sum(1 for x in ['punk rock', 'skate punk', 'pop punk', 'hardcore punk'] if x in genres)
        if ska_w >= punk_w:
            return 'Ska & Reggae'
    if any(x in genres for x in ['reggae', 'dub', 'dancehall']):
        return 'Ska & Reggae'

    # Punk
    if any(x in genres for x in ['punk', 'skate punk', 'ska punk', 'pop punk', 'hardcore punk', 'oi!', 'street punk']):
        return 'Punk'

    # EDM (high BPM)
    if any(x in genres for x in [
        'edm', 'house', 'techno', 'trance', 'dubstep', 'hardstyle', 'hypertechno',
        'big room', 'melodic techno', 'melodic house', 'eurobeat', 'electro house',
        'bass house', 'tech house', 'future bass', 'slap house', 'melbourne bounce',
        'big beat', 'eurodance', 'hi-nrg', 'bubblegum dance', 'italo disco'
    ]) and bpm >= 118:
        return 'EDM / Electronic'

    # Synthwave / Electronica
    if any(x in genres for x in [
        'synthwave', 'vaporwave', 'chillwave', 'outrun', 'retrowave',
        'darksynth', 'dreamwave', 'trip-hop', 'downtempo', 'new age', 'ambient', 'lo-fi'
    ]):
        return 'Synthwave / Electronica'

    # Dance Pop
    if any(x in genres for x in ['tropical house', 'dance pop', 'electro swing']):
        return 'EDM / Electronic' if bpm >= 118 else 'Pop & New Wave'

    # German
    if is_german and is_modern:
        return 'Moderne Deutsche Musik'
    if is_german:
        return 'Deutschrock / NDW / Schlager'

    # Metal
    if any(x in genres for x in ['metal', 'glam metal', 'heavy metal', 'thrash metal', 'death metal']):
        return 'Metal & Hard Rock'

    # Rock
    if any(x in genres for x in [
        'rock', 'hard rock', 'klassischer rock', 'classic rock', 'soft rock',
        'aor', 'arena rock', 'album rock', 'glam rock', 'post-grunge',
        'alternative rock', 'indie rock', 'grunge', 'new wave', 'post-punk'
    ]):
        return 'Rock'

    # Hip Hop & R&B
    if any(x in genres for x in ['hip-hop', 'hip hop', 'rap', 'r&b', 'old school', 'east coast', 'west coast', 'trap', 'grime']):
        return 'Hip Hop & R&B'

    # Funk & Disco
    if any(x in genres for x in ['funk', 'disco', 'soul', 'motown', 'boogie']):
        return 'Funk & Disco'

    # Pop
    if any(x in genres for x in ['pop', 'new wave', 'new romantic', 'synthpop', 'singer-songwriter', 'country', 'europop']) \
            or 'pop' in parent or 'rock' in parent:
        return 'Pop & New Wave'

    # Fallbacks
    if 'electronic' in parent:
        return 'EDM / Electronic' if bpm >= 118 else 'Synthwave / Electronica'
    if 'reggae' in parent:
        return 'Ska & Reggae'
    if 'r&b' in parent or 'hip hop' in parent:
        return 'Hip Hop & R&B'
    if bpm >= 118 and row.get('Energy', 0) >= 70:
        return 'EDM / Electronic'

    return 'Pop & New Wave'


def bpm_group(bpm):
    for g, lo, hi in [
        ('A', 0, 90), ('B', 90, 110), ('C', 110, 120),
        ('D', 120, 130), ('E', 130, 140), ('F', 140, 150),
        ('G', 150, 160), ('H', 160, 175), ('I', 175, 999)
    ]:
        if lo <= bpm < hi:
            return g
    return 'I'


# ===== MAIN =====
def build():
    print(f'Lese {INPUT_FILE}...')
    df = pd.read_excel(INPUT_FILE, sheet_name=0)

    df['BPM'] = pd.to_numeric(df['BPM'], errors='coerce').fillna(0).astype(int)
    df['Energy'] = pd.to_numeric(df['Energy'], errors='coerce').fillna(0).astype(int)
    df['Album Date'] = pd.to_datetime(df['Album Date'], errors='coerce')
    df['dur_sec'] = df['Duration'].apply(parse_dur)

    # Filter: BPM > 0
    df = df[df['BPM'] > 0].copy()
    print(f'Tracks nach BPM-Filter: {len(df)}')

    # Sort: keep best (highest energy, then longest)
    df = df.sort_values(['Energy', 'dur_sec'], ascending=[False, False])

    # Deduplication
    df['title_key'] = df['Song'].apply(title_key)
    df['artist_key'] = df['Artist'].apply(lambda x: str(x).split(',')[0].strip().lower())

    seen = []
    keep = []
    for idx, row in df.iterrows():
        cam = str(row['Camelot']).strip()
        is_dup = any(
            s['ak'] == row['artist_key']
            and s['tk'] == row['title_key']
            and abs(s['bpm'] - row['BPM']) <= 1
            and s['cam'] == cam
            for s in seen
        )
        if not is_dup:
            seen.append({'ak': row['artist_key'], 'tk': row['title_key'], 'bpm': row['BPM'], 'cam': cam})
            keep.append(idx)

    df_clean = df.loc[keep].copy()
    removed = len(df) - len(df_clean)
    print(f'Doubletten entfernt: {removed}')
    print(f'Unique Tracks: {len(df_clean)}')

    # Classify
    df_clean['genre'] = df_clean.apply(classify, axis=1)
    df_clean['bpmg'] = df_clean['BPM'].apply(bpm_group)

    # Build track list
    tracks = []
    for _, row in df_clean.iterrows():
        tid = str(row.get('Spotify Track Id', '')).strip()
        tracks.append({
            'id': tid if tid and tid != 'nan' else '',
            'song': str(row['Song']).strip(),
            'artist': str(row['Artist']).strip(),
            'bpm': int(row['BPM']),
            'camelot': str(row['Camelot']).strip(),
            'energy': int(row['Energy']),
            'dur': int(row['dur_sec']),
            'genre': row['genre'],
            'bpmg': row['bpmg'],
        })

    # Genre stats
    GERMAN_GENRES = ['Moderne Deutsche Musik', 'Deutschrock / NDW / Schlager']
    genre_groups = defaultdict(list)
    for t in tracks:
        genre_groups[t['genre']].append(t)

    stats = {}
    for genre, gt in genre_groups.items():
        durs = [t['dur'] for t in gt if t['dur'] > 30]
        stats[genre] = {
            'count': len(gt),
            'avg_dur': round(sum(durs) / len(durs)) if durs else 210,
            'avg_energy': round(sum(t['energy'] for t in gt) / len(gt)),
            'avg_bpm': round(sum(t['bpm'] for t in gt) / len(gt)),
        }

    # Virtual genres
    all_de = [t for t in tracks if t['genre'] in GERMAN_GENRES]
    stats['Alle Deutschen Tracks'] = {
        'count': len(all_de),
        'avg_dur': round(sum(t['dur'] for t in all_de) / len(all_de)) if all_de else 210,
        'avg_energy': round(sum(t['energy'] for t in all_de) / len(all_de)) if all_de else 70,
        'avg_bpm': round(sum(t['bpm'] for t in all_de) / len(all_de)) if all_de else 120,
    }
    stats['Going Wild'] = {
        'count': len(tracks),
        'avg_dur': round(sum(t['dur'] for t in tracks) / len(tracks)),
        'avg_energy': round(sum(t['energy'] for t in tracks) / len(tracks)),
        'avg_bpm': round(sum(t['bpm'] for t in tracks) / len(tracks)),
    }

    # Write JSON
    out = {'tracks': tracks, 'stats': stats}
    js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js)

    print(f'\nJSON geschrieben: {OUTPUT_FILE} ({len(js) // 1024} KB)')
    print('\nGenre-Verteilung:')
    gc = defaultdict(int)
    for t in tracks:
        gc[t['genre']] += 1
    for g in sorted(gc, key=lambda x: -gc[x]):
        print(f'  {g}: {gc[g]}')

    print('\nFertig. JSON manuell in CFLU_WOD_Builder.html einbetten:')
    print('  Suche nach: const TRACK_DATA=')
    print('  Ersetze den JSON-Block mit dem Inhalt von', OUTPUT_FILE)


if __name__ == '__main__':
    build()
