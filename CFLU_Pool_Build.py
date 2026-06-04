"""
CFLU_Pool_Build.py
==================
Generiert die Datenbasis (cflu_tracks.js) aus Spotify_Source.xlsx
oder 'Spotify Source.xlsx'.

Ausgabe: cflu_tracks.js  →  wird via <script src="cflu_tracks.js"> in
CFLU_WOD_Builder.html geladen (kein manuelles Einbetten mehr nötig).

Verwendung:
    python CFLU_Pool_Build.py

Voraussetzungen:
    pip install pandas openpyxl
"""

import pandas as pd
import json
import datetime
import re
import os
from collections import defaultdict

# ===== KONFIGURATION =====
# Akzeptiert beide Dateinamen (mit Leerzeichen und mit Underscore)
for _name in ['Spotify Source.xlsx', 'Spotify_Source.xlsx']:
    if os.path.exists(_name):
        INPUT_FILE = _name
        break
else:
    raise FileNotFoundError(
        "Quelldatei nicht gefunden. Erwartet: 'Spotify Source.xlsx' "
        "oder 'Spotify_Source.xlsx' im gleichen Ordner."
    )

OUTPUT_FILE = 'cflu_tracks.js'

# Suffixe die vor Titelvergleich entfernt werden
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
    'deutscher hip', 'kolsch', 'karneval'
]

# ===== MULTI-GROUP MAPPING (alle 661 Tags, vollständig manuell geprüft) =====
# Ein Track kann mehreren Gruppen angehören (Mehrfachzuordnung gewollt).
# Matching erfolgt per Substring auf dem lowercased Genres-Feld.
GENRE_GROUPS = {
    'Pop': [
        'dance pop','europop','new wave pop','deutscher pop','canadian pop','softer pop',
        'boy band','girl group','neo mellow','lilith','post-teen pop','candy pop',
        'jangle pop','power pop','bubblegum pop','bubblegum dance','art pop','folk pop',
        'chamber pop','soft pop','uk pop','australian pop','austrian pop','swedish pop',
        'schwedischer pop','nederpop','metropopolis','stomp pop','talent show',
        'classic uk pop','pop soul','pop urbaine','sophisti-pop','shimmer pop',
        'viral pop','pop house','new romantic','retro pop','adult standards',
        'vari','chanson','k-pop','indie pop','acoustic pop','barbadian pop',
        'nz pop','bahamian pop','soft rock','mellow gold','brill building pop','nyc pop',
        'disco','nu disco','hi-nrg','post-disco','motown','quiet storm','neo soul',
        'neo-soul','contemporary r&b','r&b','new jack swing','funk','philly soul',
        'soul','classic soul','northern soul','soul jazz','british soul','klassischer soul',
        'schlager','schlagerparty','kolsche karneval',
        ' pop',  # trailing-space ensures bare 'pop' matches but not sub-words
    ],
    'Rock': [
        'klassischer rock','hard rock','album rock','classic rock','alternative rock',
        'modern rock','modern alternative rock','post-grunge','grunge','indie rock',
        'garage rock','psychedelic rock','progressive rock','art rock','southern rock',
        'aor','arena rock','heartland rock','classic canadian rock','yacht rock',
        'folk rock','bluesrock','dance rock','piano rock','country rock','britpop',
        'baroque pop','proto-punk','beatlesque','british invasion','merseybeat',
        'roots rock','australian rock','german rock','german alternative rock',
        'german pop rock','mexikanischer rock','latin rock','rock en espa',
        'indonesischer rock','indorock','argentinischer rock','celtic rock','norsk rock',
        'finnischer rock','irish rock','surf rock','rockabilly','psychobilly','madchester',
        'space rock','neo-psychedelic','dream pop','shoegaze','pov: indie','ectofolk',
        'classic garage rock','permanent wave','mellow gold','power pop',
        'singer-songwriter','stomp and holler',"rock 'n' roll",'rock-and-roll','indie',
        # Bare 'rock' matched last (most common, catches remainders)
        'soft rock','new wave','synthpop',
    ],
    'Electronic / EDM': [
        'edm','eurodance','synthwave','vaporwave','chillwave','synthpop',
        'new wave','new wave pop','electro house','progressive house','big room',
        'tropical house','slap house','future house','deep euro house','funky house',
        'vocal house','disco house','trance','progressive trance',
        'progressive electro house','hardstyle','hypertechno','happy hardcore','gabba',
        'hardcore techno','hands up','german dance','indie dance','electroclash',
        'indietronica','electronica','electropop','alternative dance','italo dance',
        'italo disco','melbourne bounce','electro','elektronische musik','big beat',
        'trip-hop','dubstep','drum and bass','techno','minimal techno','acid techno',
        'german techno','hard techno','tech house','house','deep house','classic house',
        'chicago house','tribal house','diva house','nordic house','organic house',
        'afro house','soulful house','bass house','g-house','dark ambient','downtempo',
        'ambient','space music','lo-fi','lo-fi beats','chillstep','future bass',
        'melodic bass','melodic techno','melodic house','pop edm','deep pop edm',
        'belgian edm','uk dance','breakbeat','nightcore','nightrun','swedish electropop',
        'swedish tropical house','australian dance','australian electropop','aussietronica',
        'dark clubbing','russian edm','danish electronic','acid house','chill house',
        'vapor twitch','phonk','drift phonk','electronic djent','popwave',
        'german house','city pop','eurotrance','darkwave',
    ],
    'Hip Hop & R&B': [
        'hip-hop','hip hop','old school hip-hop','east coast hip-hop','west coast hip-hop',
        'west coast hip hop','pop rap','gangster rap','rap rock','rap metal',
        'southern hip-hop','southern hip hop','miami hip hop','g-funk','atl hip hop',
        'boom bap','crunk','trap','trap latino','dark trap','electronic trap',
        'viral trap','drill','hardcore hip-hop','hardcore hip hop','alternative hip hop',
        'underground hip hop','underground hip-hop','urban contemporary','hip pop',
        'hip house','deutscher hip-hop','latin hip-hop','seattle hip hop','ohio hip hop',
        'st louis rap','queens hip hop','pittsburgh rap','philly rap','chicago rap',
        'detroit hip hop','nyc rap','harlem hip hop','old school atlanta hip hop',
        'new jersey underground rap','horrorcore','comedy rap','jazz rap','punk rap',
        'canadian old school hip hop','japanese old school hip hop',
        'asian american hip hop','norwegian hip-hop','new jack swing','neo soul',
        'neo-soul','uk contemporary r&b','canadian contemporary r&b','alternative r&b',
        'chill r&b','afroswing','afro r&b','uk funky','contemporary r&b',
        'marokkanischer rap','german viral rap','rap kreyol',
        ' rap','r&b',
    ],
    'Metal': [
        'heavy metal','glam metal','alternative metal','thrash metal','speed metal',
        'doom metal','stoner metal','power metal','gothic metal','industrial metal',
        'groove metal','symphonic metal','folk metal','mittelalter-metal','sludge metal',
        'metalcore','post-hardcore','screamo','nu metal','rap metal','metal cover',
        'deathrock','electronic djent',
        ' metal',
    ],
    'Punk': [
        'pop punk','skate punk','ska punk','hardcore punk','melodic hardcore','hardcore',
        'indie punk','folk punk','celtic punk','horror punk','german punk',
        'german punk rock','queercore','riot grrrl','anarcho-punk','anti-folk',
        'post-punk','gothic rock','emo','dance-punk','neon pop punk',
        ' punk',
    ],
    'Ska & Reggae': [
        'ska','ska punk','rocksteady','reggae','roots reggae','dub','dancehall','ragga',
        'reggae rock','reggae fusion','reggae en espa','lovers rock','mexikanischer ska',
        'calypso','reggaeton','reggae pop','french reggae','german reggae',
    ],
    'Deutsch / Schlager': [
        'neue deutsche welle','schlager','schlagerparty','kolsche karneval',
        'deutscher indie','deutscher indie pop','german pop','german pop rock',
        'german rock','german punk','german punk rock','german alternative rock',
        'german dance','german techno','german house','german viral rap','deutschrock',
        'kabarett','volkspop','antideutsche','deutscher pop','deutscher hip-hop',
    ],
    'Blues & Jazz': [
        'blues','bluesrock','blues rock','klassischer blues','modern blues',
        'british blues','southern gothic','jazz','jazz funk','jazz fusion',
        'jazz rap','jazz beats','soul jazz','acid jazz','vocal jazz','smooth jazz',
        'big band','bossa nova','brasilianischer jazz','chicago bop','classic soul',
        'swing','nu jazz','doo-wop','soul blues',
    ],
    'Folk & Country': [
        'folk rock','folk punk','folk pop','folk-pop','folk metal','indie folk',
        'ectofolk','anti-folk','newgrass','bluegrass','americana','outlaw country',
        'country rock','country hip-hop','swedish country','traditional country',
        'honky tonk','gothic country','alt country','country dawn','country road',
        'roots rock','seemannslieder','keltische musik','celtic rock','celtic punk',
        ' folk',' country',
    ],
    'Latin': [
        'latin alternative','latin pop','latin rock','latin hip-hop','latin dance',
        'rock en espa','mexikanischer rock','mexikanischer ska','reggaeton','salsa',
        'bachata','tango','bolero','cuarteto','murga','candombe','timba','samba',
        'bossa nova','flamenco','flamenco pop','flamenco urbano','flamenco electronica',
        'salsa choke','urbano latino','trap latino','reggae en espa',
    ],
    'Sonstige': [
        'weihnachten','soundtrack','filmmusik','musicals','theme','new age',
        'classical crossover','workout product','kindermusik','comedy','wrestling',
        'fussball','fake','video game music','idol','vocaloid','a cappella',
        'orchester','neoklassik','score','oper','klassik','elektronische klassik',
        'neo-classical','musik der native americans','musique tahitienne',
        'pacific islands pop','samoan pop','bhangra','k-balladen','afrobeats',
        'afrobeat','afropop',
    ],
}

# Sprachfilter — separat von den Genre-Gruppen
GERMAN_LANGUAGE_TAGS = [
    'neue deutsche welle','deutscher pop','schlager','schlagerparty','kolsche karneval',
    'deutscher indie','deutscher indie pop','german pop','german pop rock','german rock',
    'german punk','german punk rock','german alternative rock','german dance',
    'german techno','german house','german viral rap','deutschrock','kabarett',
    'volkspop','antideutsche','deutscher hip-hop',
    'deutsch','german',
]


def get_groups(genres_str):
    """Gibt alle passenden Hauptgruppen für einen Track zurück (Mehrfachzuordnung)."""
    genres = genres_str.lower()
    groups = [name for name, tags in GENRE_GROUPS.items()
               if any(tag in genres for tag in tags)]
    # Sonderfall bare 'rock' und 'pop' — nur wenn keine spezifischere Gruppe zutrifft
    if not any(g in groups for g in ('Rock',)) and 'rock' in genres:
        groups.append('Rock')
    if not any(g in groups for g in ('Pop',)) and 'pop' in genres:
        groups.append('Pop')
    if not any(g in groups for g in ('Hip Hop & R&B',)) and ' rap' in (' ' + genres):
        groups.append('Hip Hop & R&B')
    if not any(g in groups for g in ('Metal',)) and ' metal' in (' ' + genres):
        groups.append('Metal')
    if not any(g in groups for g in ('Punk',)) and ' punk' in (' ' + genres):
        groups.append('Punk')
    if not any(g in groups for g in ('Ska & Reggae',)) and 'ska' in genres:
        groups.append('Ska & Reggae')
    if not any(g in groups for g in ('Folk & Country',)) and ' folk' in (' ' + genres):
        groups.append('Folk & Country')
    if not groups:
        groups = ['Sonstige']
    return sorted(set(groups))  # dedupliziert, sortiert


def is_german_track(genres_str):
    """True wenn mindestens ein Deutsch-Sprach-Tag im Genres-Feld vorkommt."""
    genres = genres_str.lower()
    return any(tag in genres for tag in GERMAN_LANGUAGE_TAGS)

# ===== DURATION PARSING =====
def parse_dur(d):
    """Parse duration: Excel stores MM:SS as datetime.time(hour=MM, minute=SS)."""
    try:
        if isinstance(d, datetime.time):
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
    """Normalize title for deduplication."""
    s = SUFFIX_RE.sub('', str(song))
    s = re.sub(r'[^a-z0-9]', '', s.lower())
    return s[:15]

# ===== INT FIELD HELPER =====
def safe_int(val, default=0):
    try:
        v = int(val)
        return v
    except Exception:
        return default

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

    # Ska & Reggae (before Punk to handle ska-punk overlap correctly)
    if any(x in genres for x in ['ska', 'rocksteady']):
        ska_w  = sum(1 for x in ['ska', 'rocksteady', 'ska punk'] if x in genres)
        punk_w = sum(1 for x in ['punk rock', 'skate punk', 'pop punk', 'hardcore punk'] if x in genres)
        if ska_w >= punk_w:
            return 'Ska & Reggae'
    if any(x in genres for x in ['reggae', 'dub', 'dancehall', 'ragga']):
        return 'Ska & Reggae'

    # Punk
    if any(x in genres for x in [
        'punk', 'skate punk', 'ska punk', 'pop punk', 'hardcore punk',
        'oi!', 'street punk', 'melodic hardcore',
    ]):
        return 'Punk'

    # EDM / Electronic (BPM-based; edge-cases like electronica/darkwave fall
    # through to Synthwave when BPM < 118 via the electronic parent fallback)
    if any(x in genres for x in [
        'edm', 'house', 'techno', 'trance', 'dubstep', 'hardstyle', 'hypertechno',
        'big room', 'melodic techno', 'melodic house', 'eurobeat', 'electro house',
        'bass house', 'tech house', 'future bass', 'slap house', 'melbourne bounce',
        'big beat', 'eurodance', 'hi-nrg', 'bubblegum dance', 'italo disco',
        # neu klassifiziert
        'happy hardcore', 'italo dance', 'gabba', 'hands up',
        'electroclash', 'indie dance', 'elektronische musik', 'electronica',
        'indietronica',
    ]) and bpm >= 118:
        return 'EDM / Electronic'

    # Synthwave / Electronica
    if any(x in genres for x in [
        'synthwave', 'vaporwave', 'chillwave', 'outrun', 'retrowave',
        'darksynth', 'dreamwave', 'trip-hop', 'downtempo', 'new age', 'ambient', 'lo-fi',
        'darkwave',
    ]):
        return 'Synthwave / Electronica'

    # Dance Pop (BPM-conditional bridge)
    if any(x in genres for x in ['tropical house', 'dance pop', 'electro swing']):
        return 'EDM / Electronic' if bpm >= 118 else 'Pop & New Wave'

    # German
    if is_german and is_modern:
        return 'Moderne Deutsche Musik'
    if is_german:
        return 'Deutschrock / NDW / Schlager'

    # Blues & Soul (neue Gruppe)
    # Bedingung: Parent enthält "blues" ABER NICHT "rock" (sonst → Rock)
    # und die Genres-Tags zeigen keine dominante andere Kategorie
    if 'blues' in parent and 'rock' not in parent and not any(x in genres for x in [
        'hip-hop', 'hip hop', 'rap', 'r&b', 'funk', 'disco',
        'metal', 'soul', 'motown',
    ]):
        return 'Blues & Soul'
    if any(x in genres for x in [
        'classic blues', 'traditional blues', 'chicago blues', 'delta blues',
        'modern blues', 'british blues', 'texas blues',
    ]) and 'metal' not in genres:
        return 'Blues & Soul'

    # Metal & Hard Rock
    if any(x in genres for x in ['metal', 'glam metal', 'heavy metal', 'thrash metal', 'death metal']):
        return 'Metal & Hard Rock'

    # Rock
    if any(x in genres for x in [
        'rock', 'hard rock', 'klassischer rock', 'classic rock', 'soft rock',
        'aor', 'arena rock', 'album rock', 'glam rock', 'post-grunge',
        'alternative rock', 'indie rock', 'grunge', 'new wave', 'post-punk',
        # neu klassifiziert
        'mellow gold', 'permanent wave', 'emo', 'neo mellow', 'lilith',
        'folk rock', 'celtic rock', 'keltische musik', 'bluesrock',
    ]):
        return 'Rock'

    # Hip Hop & R&B
    if any(x in genres for x in [
        'hip-hop', 'hip hop', 'rap', 'r&b', 'old school', 'east coast', 'west coast',
        'trap', 'grime',
        # neu klassifiziert
        'urban contemporary', 'new jack swing', 'crunk',
    ]):
        return 'Hip Hop & R&B'

    # Funk & Disco
    if any(x in genres for x in ['funk', 'disco', 'soul', 'motown', 'boogie']):
        return 'Funk & Disco'

    # Pop & New Wave
    if any(x in genres for x in [
        'pop', 'new wave', 'new romantic', 'synthpop', 'singer-songwriter',
        'country', 'europop',
        # neu klassifiziert
        'boy band', 'girl group',
    ]) or 'pop' in parent or 'rock' in parent:
        return 'Pop & New Wave'

    # Fallbacks über Parent Genre
    if 'blues' in parent and 'rock' not in parent:
        return 'Blues & Soul'
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
    print(f'Lese {INPUT_FILE} ...')
    df = pd.read_excel(INPUT_FILE, sheet_name=0)

    df['BPM']    = pd.to_numeric(df['BPM'],    errors='coerce').fillna(0).astype(int)
    df['Energy'] = pd.to_numeric(df['Energy'], errors='coerce').fillna(0).astype(int)
    df['Album Date'] = pd.to_datetime(df['Album Date'], errors='coerce')
    df['dur_sec'] = df['Duration'].apply(parse_dur)

    # Neue Audio-Feature-Felder
    for col in ['Dance', 'Acoustic', 'Instrumental', 'Valence', 'Speech', 'Live', 'Loud (Db)', 'Popularity']:
        if col not in df.columns:
            print(f'  WARNUNG: Spalte "{col}" nicht gefunden — wird mit 0 gefüllt.')
            df[col] = 0
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    # Filter: BPM > 0
    df = df[df['BPM'] > 0].copy()
    print(f'Tracks nach BPM-Filter: {len(df)}')

    # Sort: keep best (highest energy, then longest)
    df = df.sort_values(['Energy', 'dur_sec'], ascending=[False, False])

    # Deduplication
    df['title_key']  = df['Song'].apply(title_key)
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
    print(f'Doubletten entfernt: {len(df) - len(df_clean)}')
    print(f'Unique Tracks: {len(df_clean)}')

    # Classify
    df_clean['genre'] = df_clean.apply(classify, axis=1)
    df_clean['bpmg']  = df_clean['BPM'].apply(bpm_group)

    # Build track list
    tracks = []
    for _, row in df_clean.iterrows():
        tid = str(row.get('Spotify Track Id', '')).strip()
        tracks.append({
            'id':           tid if tid and tid != 'nan' else '',
            'song':         str(row['Song']).strip(),
            'artist':       str(row['Artist']).strip(),
            'bpm':          int(row['BPM']),
            'camelot':      str(row['Camelot']).strip(),
            'energy':       int(row['Energy']),
            'dur':          int(row['dur_sec']),
            'genre':        row['genre'],
            'bpmg':         row['bpmg'],
            # New audio feature fields
            'dance':        int(row['Dance']),
            'valence':      int(row['Valence']),
            'acoustic':     int(row['Acoustic']),
            'instrumental': int(row['Instrumental']),
            'speech':       int(row['Speech']),
            'live':         int(row['Live']),
            'loud':         int(row['Loud (Db)']),
            'popularity':   int(row['Popularity']),
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
            'count':      len(gt),
            'avg_dur':    round(sum(durs) / len(durs)) if durs else 210,
            'avg_energy': round(sum(t['energy'] for t in gt) / len(gt)),
            'avg_bpm':    round(sum(t['bpm'] for t in gt) / len(gt)),
        }

    # Virtual genres
    all_de = [t for t in tracks if t['genre'] in GERMAN_GENRES]
    stats['Alle Deutschen Tracks'] = {
        'count':      len(all_de),
        'avg_dur':    round(sum(t['dur'] for t in all_de) / len(all_de)) if all_de else 210,
        'avg_energy': round(sum(t['energy'] for t in all_de) / len(all_de)) if all_de else 70,
        'avg_bpm':    round(sum(t['bpm'] for t in all_de) / len(all_de)) if all_de else 120,
    }
    stats['Going Wild'] = {
        'count':      len(tracks),
        'avg_dur':    round(sum(t['dur'] for t in tracks) / len(tracks)),
        'avg_energy': round(sum(t['energy'] for t in tracks) / len(tracks)),
        'avg_bpm':    round(sum(t['bpm'] for t in tracks) / len(tracks)),
    }

    # Write JS file
    out = {'tracks': tracks, 'stats': stats}
    js_content = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(f'const TRACK_DATA={js_content};')

    kb = len(js_content) // 1024
    print(f'\ncflu_tracks.js geschrieben ({kb} KB, {len(tracks)} Tracks)')
    print('\nGenre-Verteilung:')
    gc = defaultdict(int)
    for t in tracks:
        gc[t['genre']] += 1
    for g in sorted(gc, key=lambda x: -gc[x]):
        print(f'  {g}: {gc[g]}')

    print(f'\nFertig. cflu_tracks.js liegt im Ordner.')
    print('CFLU_Start.bat lädt die Datei automatisch beim nächsten Start.')


if __name__ == '__main__':
    build()
