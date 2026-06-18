# Claude Code Prompt: Komplette Umstellung der Datenhaltung auf Online-MariaDB + Multi-Source-Datenmodell + Initial-Load

> **Sprache:** Antworte und arbeite auf Deutsch.
> **Workflow-Pflicht:** Konzept- und Implementierungsprompt. Du **bewertest zuerst kritisch**, lieferst einen **Plan**, und schreibst **erst nach explizitem „Go"** Code (Stop-and-Confirm-Gate). CHANGELOG/BACKLOG-Updates sind Pflicht-Nachschritt.
> **Change-Marker** in deiner Plan-Antwort: `[BESTÄTIGT]` / `[GEÄNDERT]` / `[RISIKO]` / `[OFFEN]` / `[NEU]` / `[ENTFERNT]`.

---

## 1. Ziel (Was wir bauen)

**Die Datenhaltung wird vollständig auf die Online-MariaDB (netclusive) umgestellt.** Der bisherige JS-Datei-Ansatz (`cflu_tracks.js` etc.) als Speicher- und Quellformat wird **abgelöst** — die DB wird die alleinige Single Source of Truth.

Gleichzeitig erweitern wir das Modell von einem flachen Track-Modell zu einem **Multi-Objekt-Multi-Source-Modell**:

1. **Drei Objekttypen** als eigenständige Entitäten: `Track`, `Artist`, `Album`.
2. **Drei Verbindungstypen** als explizite Relationen: `Artist ↔ Album`, `Artist ↔ Track`, `Album ↔ Track`.
3. **Quelltrennung pro Objekt** als **separate Tabelle pro (Objekttyp × Quelle)** — `spotify`, `lastfm`, `chosic`, `manual` werden nie vermischt.
4. **Initial-Load (voll):** Schema anlegen + bestehende Chosic-Daten aus `cflu_tracks.js` in die DB migrieren + Spotify-Enrichment + Last.fm-Enrichment + Resolve-View.

> **`[ENTFERNT]`** JS-Dateien als Datenhaltung. **`[NEU]`** MariaDB als alleinige Datenquelle. Falls das Frontend aus Performancegründen einen schlanken generierten JSON-/JS-Export des Resolve-Views braucht, ist das ein **abgeleiteter Cache aus der DB**, nicht die Quelle — im Plan bewerten, nicht eigenmächtig bauen.

---

## 2. Persistenz-Entscheidung [GEÄNDERT → vollständig MariaDB]

- **Speicher = Online-MariaDB auf netclusive Business 6.0** (PHP 8.3, `pdo_mysql` bestätigt verfügbar). Vollständige Ablösung des JS-Datei-Ansatzes.
- **Datenzugriff:** serverseitig über PHP/PDO. Eine **zentrale DB-Zugriffsschicht** (eine Stelle, kein verstreuter Connection-Code).
- **Quelltrennung = echte Tabellen pro Quelle**, nicht JSON-Blobs, nicht vermischte Spalten.

### Credentials [BESTÄTIGT / kleiner Restpunkt]
- DB-Zugangsdaten liegen in **`keyvault/DB.txt`** und sind via **`.gitignore` ausgeschlossen** (bestätigt) → kein Repo-Leak-Risiko. Lies die Credentials aus `keyvault/DB.txt`.
- **`[OFFEN]`** Kläre im Plan kurz das Format von `keyvault/DB.txt` (Key-Value? JSON? Reihenfolge der Felder?) und parse robust. Lege eine zentrale Config-Schicht an, die `keyvault/DB.txt` liest; halte den Pfad konfigurierbar, damit ein späterer Umstieg auf `.env` o.ä. trivial ist.

### DB-Vorbedingungen prüfen [OFFEN]
- Vor Schema-Anlage: Verbindung testen (Projekt-Konvention: `DB_TEST_ENABLED=true`), Server-Version, Default-Charset/Collation ausgeben.
- **`utf8mb4` / `utf8mb4_unicode_ci`** erzwingen (Namen mit Sonderzeichen/Diakritika/Emojis — „Tiësto", „Motörhead").
- Engine **InnoDB** (Foreign Keys, Transaktionen).

---

## 3. Schema-Entwurf (Vorschlag — im Plan bestätigen lassen)

### 3.1 Kern-Identitäts-Tabellen (eine Zeile = ein Objekt)
Schlanke „Spine"-Tabellen, nur Identität:

- `track`  (`track_id` PK, `created_at`, `updated_at`)
- `artist` (`artist_id` PK, …)
- `album`  (`album_id` PK, …)

PK = **Spotify-ID** (base62-String → `VARCHAR`, **kein** Auto-Increment-Int), damit die Spotify-ID direkt PK sein kann.

**`[RISIKO]` ID-Fallback:** Objekte ohne Spotify-Match brauchen stabile, kollisionsarme Fallback-IDs (z.B. `local:` + Hash). Schema im Plan definieren.

### 3.2 Quell-Tabellen (separate Tabelle pro Objekt × Quelle)
Jede referenziert die Spine per FK. Beispiele:

```
track_src_chosic   (track_id FK, bpm, camelot, energy, danceability, valence, loudness, …, locked, raw_csv_row?)
track_src_spotify  (track_id FK, name, duration_ms, explicit, isrc?, popularity?, track_number, disc_number, uri, fetched_at)
track_src_lastfm   (track_id FK, tags JSON, top_tag, confidence_tier, fetched_at)
track_src_manual   (track_id FK, …)

artist_src_spotify (artist_id FK, name, genres JSON, popularity, followers_total, uri, fetched_at)
artist_src_lastfm  (artist_id FK, tags JSON, fetched_at)
artist_src_manual  (artist_id FK, …)

album_src_spotify  (album_id FK, name, release_date, release_date_precision, total_tracks, album_type, label?, uri, fetched_at)
album_src_lastfm   (album_id FK, tags JSON, fetched_at)
album_src_manual   (album_id FK, …)
```

- `manual`-Tabellen: im Plan **breit** (Spalte je überschreibbarem Feld) vs **schmal/EAV** (`field`/`value`-Zeilen) abwägen. EAV passt zum „beliebiges Feld überschreiben"/`locked`-Override-Prinzip; breit ist simpler. Empfehlung mit Begründung.
- `fetched_at` je Quell-Zeile → Re-Enrichment/Staleness-Erkennung.

### 3.3 Relations-Tabellen
```
rel_artist_track (artist_id FK, track_id FK, position INT, role VARCHAR NULL, PK(artist_id,track_id))
rel_artist_album (artist_id FK, album_id FK, position INT, PK(artist_id,album_id))
rel_album_track  (album_id FK, track_id FK, disc_number INT, track_number INT, PK(album_id,track_id))
```
- **`position`** in `rel_artist_track` = gelieferte Reihenfolge aus dem Spotify-`artists`-Array (nicht algorithmisch normiert; speichern wie geliefert).
- **`role`**: NULL, außer aus Track-Titel-Parse (`(... Remix)`) ableitbar → `remixer`. **Spotify liefert keine Rollendifferenzierung im `artists`-Array** — nicht aus der API konstruieren.

### 3.4 Resolve-View
- `pool_resolved` als **DB-View** oder materialisierte Tabelle (im Plan abwägen: View = immer aktuell, teurer; materialisiert = schnell, muss regeneriert werden). Gemergtes Endbild pro Track für die App.

---

## 4. Spotify-API-Realität (verifizieren, bevor Code entsteht) [OFFEN]

**Stand Dev Mode nach Feb/März-2026-Changes. Gegen aktuelle Doku prüfen, Unbestätigtes `[OFFEN]` markieren:**

- **Audio-Features bleiben Chosic-Domäne** (`/audio-features` + `/audio-analysis` für Dev Mode 403). Nicht über Spotify holen.
- **`artists`-Array auf Track-Level hat KEINE Rollendifferenzierung** (kein Remixer/Original-Flag). Remixer-Erkennung = Track-Titel-Parse.
- **Dev-Mode-Feldentfernungen (Feb 2026):** `available_markets`, `linked_from`, **`popularity` (Track-Level)** entfernt; `external_ids`/ISRC entfernt, dann für **März 2026 reverted → verifizieren**.
  - Track-`popularity` ggf. nicht aus API → Chosic-Snapshot als Fallback, Spalte `null`-tolerant.
- **Batch-Endpoints entfernt** → **Einzel-Fetches**. ~4.300 Tracks = viele Calls → **Throttle + exponentielles Backoff bei 429 Pflicht**, resumierbar mit in DB persistiertem Fortschritt.
- **Auth:** serverseitiger Authorization Code Flow (bestehende Konvention), Client Secret + Refresh Token verlassen den Server nie.

### Zu sichernde Felder
- **Track:** `id`, `name`, `artists[]`(id+name+position), `album.id`, `duration_ms`, `explicit`, `external_ids.isrc`?, `popularity`?, `track_number`, `disc_number`, `uri`.
- **Artist:** `id`, `name`, `genres[]` (grob/oft leer — nur ergänzend, ersetzt **nicht** `genres_raw`/Last.fm/Every-Noise), `popularity`, `followers.total`, `uri`.
- **Album:** `id`, `name`, `release_date`, `release_date_precision`, `total_tracks`, `album_type`, `label`?, `uri`.

---

## 5. Resolve-/Merge-Strategie

- Quellen **roh und getrennt** in ihren Tabellen — **nie** beim Schreiben mergen.
- **Zentrale `SOURCE_PRECEDENCE_CONFIG`** (eine Stelle, analog `GENRE_CONFIG`-Prinzip). Präzedenz (Vorschlag, bestätigen lassen):
  1. `manual` (höchste Priorität — Override, analog `locked`)
  2. feldweise Autorität:
     - **Audio-Features → `chosic`** (immer)
     - **Identität/Runtime (duration, explicit, ISRC, popularity) → `spotify`**, Fallback `chosic`
     - **Genres/Tags → `lastfm`** (Kaskade) + `genres_raw`; Spotify-Genres nur ergänzend
  3. nirgends vorhanden → `null`, sauber abfangen.
- Resolve erzeugt `pool_resolved` (§3.4).

---

## 6. Initial-Load (voll) — idempotent & resumierbar

1. **DB-Check & Schema** (§2.3, §3) per **versionierter Migration** (`migrations/001_*.sql` …) in Transaktion anlegen; wiederholbar ohne Datenverlust.
2. **Chosic-Migration:** Daten aus `cflu_tracks.js` → `track_src_chosic` + `track`-Spine. **Keine** Feature-/Lock-Verluste; bestehende IDs erhalten. (Dies ist eine **Einmal-Migration**; danach ist `cflu_tracks.js` kein Speicher mehr.)
3. **Objekt-Extraktion:** distinct Artists/Albums aus Tracks ableiten → `artist`/`album`-Spine-Stubs.
4. **Spotify-Enrichment** (throttled, resumierbar, Fortschritt in DB):
   - Track-Felder → `track_src_spotify`; Artists → `artist_src_spotify`; Albums → `album_src_spotify`.
   - Relationen befüllen inkl. `position`/`disc`/`track_number`.
5. **Last.fm-Enrichment** (throttled, 5 req/IP/s; `count` ist within-item, **nicht** cross-track vergleichbar) → `*_src_lastfm`.
6. **Resolve** → `pool_resolved`.
7. **Validierung & Report:** Counts (Tracks/Artists/Albums/Relationen), Tracks ohne Spotify-Match, Feld-Vollständigkeit je Quelle, Liste der Fallback-IDs.

### Robustheit (Pflicht)
- Transaktionen + FK-Constraints; Teil-Fehler dürfen die DB nicht inkonsistent lassen.
- 429-Backoff, Fortschritt nach jedem Batch committen, Lauf abbrech-/fortsetzbar.
- Graceful Degradation: fehlende Dev-Mode-Felder = `null`, kein Crash.
- Secrets serverseitig; nichts ins Frontend.
- `--dry-run`: geplante Calls/Counts + Schema-Diff ohne Schreiben.

### Rollback / Sicherheit der Altdaten [NEU]
- Vor der Migration: `cflu_tracks.js` **nicht löschen**, sondern als Read-Only-Backup behalten, bis die DB-Migration validiert ist. Erst nach erfolgreichem Validierungs-Report (§6.7) den App-Code von JS-Lesen auf DB-Lesen umstellen.

---

## 7. Auftrag an dich (Reihenfolge)

1. **Kritische Bewertung zuerst:** Schwachstellen/Risiken/Alternativen zu §2–§6. Besonders: Schema-Normalisierungsgrad, `manual`-Tabelle breit-vs-EAV, Resolve View-vs-materialisiert, ID-Fallback, Migrations-/Idempotenz-Strategie, Umstellung des **App-Lesepfads** von JS auf DB (welche Code-Stellen betroffen sind).
2. **Plan** mit Change-Markern: finales DB-Schema (DDL-Entwurf), Migrations-Dateien-Struktur, Throttling-Design, Resolve-Mechanismus, Liste der umzustellenden App-Code-Stellen.
3. **Offene Fragen** (`[OFFEN]`) bündeln — v.a. `keyvault/DB.txt`-Format, Spotify-Dev-Mode-Felder, DB-Vorbedingungen (Charset/Version), Composer-Verfügbarkeit falls Libraries nötig.
4. **STOP.** Warte auf mein explizites „Go", bevor du Code schreibst.
5. Nach Implementierung: **CHANGELOG + BACKLOG** (BL-ID-Format), Commit-Konventionen aus `CLAUDE.md`.

**Schreibe jetzt noch keinen Code. Liefere Bewertung + Plan + offene Fragen und halte am Stop-and-Confirm-Gate.**
