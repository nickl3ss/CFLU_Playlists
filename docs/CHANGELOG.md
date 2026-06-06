# CHANGELOG — CFLU WOD Playlist Builder

> Format: `| BL-ID | Titel | Datum | Commit |`
> Neue Einträge werden von Claude Code nach Abschluss eines Backlog-Items hinzugefügt.

| BL-ID | Titel | Datum | Commit |
|-------|-------|-------|--------|
| BL-004 | v1.0: Initiale Version — EDM-spezifischer Builder mit eingebetteter EDM-Liste | – | – |
| BL-005 | v2.0: Gesamtliste (3.347 Tracks), 13 Genre-Gruppen, Spotify PKCE Export | – | – |
| BL-006 | v2.1: Ref/Peak Modi, Suchfunktion alle Genres, Camelot-Priorität | – | – |
| BL-007 | v2.2: ±BPM Toleranz-Regler, Titeldedup, Camelot-Zonierung | – | – |
| BL-008 | v3.0: Song-zuerst-Workflow, Positions-Ampel, farbige Regler, Hover-Sync Chart↔Liste, Spotify-Link pro Track, Cool-Down Dauer, 3.314 Tracks | – | – |
| BL-009 | v3.1: WOD-Typ-Slider, BPM-Chart Stufen-Visualisierung + Zeitachse + WOD-Ende-Marker, Spotify-Setup-Anleitung, Test-Suite | – | – |
| BL-010 | v4.0: Klassen-Phase A/B/C/D, Unified Scoring System, 8 neue Audio-Feature-Felder, cflu_tracks.js extern, CFLU_Start.bat, Phase-Match-Score Badge, Audio-Preview, Genre-Nachbarn-Fallback, 3.313 Tracks | – | – |
| BL-011 | v4.1: ES-Module-Refactor (7 Module: config/state/utils/algorithm/chart/spotify/app), kein Inline-JS, Test-Suite importiert echte Module, registerTrack konsolidiert, Slider-Thumb via CSS Custom Property, Chart-Resize debounced, cflu_client_id.txt | – | – |
| BL-012 | v4.2: Tonart-Filter (Camelot-Buchstaben-Slider + Zahlenfeld mit Wrap-around), Blues & Soul Genre-Gruppe, GENRE_NEIGHBOURS vollständig, 129 Tests / 18 Suiten | – | – |
| BL-013 | v4.3: Startup Login Modal (auto-vorausgefüllt, abbrechbar, ESC/Backdrop), Generierungs-Log (kopierbares Textfeld, Einstellungen/Pool/Track-Entscheidungen/Zusammenfassung), tolDefault phasenspezifisch (A=±10/B=±25/C=±35/D=±20), Toleranz-Slider max=40, Chosic als Datenbasis-Quelle dokumentiert, 160 Tests / 21 Suiten | 2026-06 | 01db4cf |
| BL-014 | chore: Methodik-Workflow integriert (CLAUDE.md, BACKLOG.md, docs/PROJECT.md, .github/ISSUE_TEMPLATE) | 2026-06-04 | b941e3f |
| BL-015 | v5.0: Methodik-Workflow aktiviert — .gitignore korrigiert (war ohne Punkt, nie aktiv), README aktualisiert, BACKLOG.md mit BL-001–BL-003 befüllt | 2026-06-04 | 0445470 |
| BL-021 | UI: Audio-Preview entfernt — Play-Button, tr-play-Spalte, preview-audio-Element und playPreview-Funktion aus Playlist-Darstellung entfernt | 2026-06-04 | d8ce96f |
| #26 | fix(utils): BPM-Penalty in calcSortScore korrigiert — greift jetzt nur bei BPM-Abstieg (t.bpm < cur.bpm); BPM-Anstiege werden nicht mehr bestraft; 2 Tests aktualisiert | 2026-06-04 | – |
| #7  | feat(algorithm): Top-5-Zufallsauswahl in pickNext() + Carry-over — carryover[]-Parameter, Injektion nicht-roter Carry-Kandidaten vor Sort, Zufallspick aus top-5, buildUp thread carry; 6 neue Tests | 2026-06-04 | – |
| BL-020 | C1: CSV-Direktimport — CFLU_Pool_Build.py auf ETL-Pipeline umgestellt (kein pandas/openpyxl); 40 CSVs aus Playlists/, Dedup per Spotify Track Id, 28 Felder inkl. locked; CFLU_Start.bat xlsx-Zweig entfernt; 3868 Tracks | 2026-06-04 | – |
| #24 | fix(app): Selektions- und Pool-Genre-Logik entkoppelt — state.poolGenre als SSOT; Direktsuche durchsucht kompletten Pool; genre-sel nur noch Filter-Kontrolle; externer Link-Track erhält eigenen Genre-Dropdown; Pool-Badge in Selected-Display; #3 als Duplicate geschlossen | 2026-06-06 | c66dfa9 |
| #67 | fix(app): Direktsuche Sortierung — startsWith-Priorität entfernt, Sort nach Phase-Score + BPM; Song-Titel-Treffer gleichwertig zu Artist-Treffern | 2026-06-06 | b044e56 |
| #68 | fix(app): Direktsuche ignoriert Camelot- und Energy-Filter — Referenz-Song-Auswahl ohne Generierungs-Filter-Einschränkung | 2026-06-06 | 963eaed |
| TST | refactor(test): dual-mode Testklasse — js/cflu_tests.js (kanonisch, Node.js + Browser-Export), CFLU_Tests.html als Rendering-Shell; package.json {"type":"module"}; CLAUDE.md + PROJECT.md aktualisiert | 2026-06-06 | – |
| #69 | fix(test): expect().not ergänzt — Mini-Test-Framework um vollständige .not-Chain erweitert; 166/166 Tests grün | 2026-06-06 | – |
| #61 | feat(server): cflu_server.py — Custom HTTP-Server ersetzt python -m http.server; CFLUHandler(SimpleHTTPRequestHandler) mit POST-Routing; /api/upload-csv gibt 501 (Stub); CFLU_Start.bat angepasst | 2026-06-06 | 0aabfdf |
| #62 | feat(etl): ETL importierbar — extract() liest Playlists/**/*.csv rekursiv; merge() gibt Tuple (tracks, new, updated); build() gibt (count_new, count_updated, total) zurück | 2026-06-06 | aca77d6 |
| #71 | feat(etl): Pool-Cleanup — dedup_pool() entfernt Titeldobbletten nach Load; Key=(artist,song), locked=1 hat Vorrang; 554 Doubletten entfernt (4503→3949 Tracks) | 2026-06-06 | 466a40d |
| #64 | feat(server): POST /api/upload-csv vollständig — JSON-Body, Sanitizing, WebUpload-Ordner, ETL-Trigger, JSON-Response mit added/updated/total; HTTP 400/500 Fehlerpfade | 2026-06-06 | 2fddf60 |
| #63 | feat(wod): Rechtes Panel — aside#right-panel, .rp-tab Toggle-Button, CSS Slide-Animation; Spotify-Section aus Sidebar verschoben; Klick-außerhalb schließt Panel | 2026-06-06 | b5c07e5 |
| #72 | fix(wod): Playlist exportieren nur nach Playlist-Generierung sichtbar — Guard in spotify.js + renderResult() analog sp-export-btn2 | 2026-06-06 | 1cd5743 |
| #65 | feat(wod): CSV-Upload-UI im rechten Panel — js/upload.js (sanitizeFilename, extractPlaylistName, formatUploadSuccess); Datei-Picker, Pool-aktualisieren-Button, Reload-Button; CSS upload-drop/upload-status | 2026-06-06 | 00e08e2 |
| #66 | test(upload): Upload-Test-Suite — sanitizeFilename (7 Tests), extractPlaylistName (5), formatUploadSuccess (5); 17 neue Tests; 183 gesamt | 2026-06-06 | cc1d165 |
| #1  | fix(app): Pool-Größe und Genre-Anzahl dynamisch — getAllTracks().length + Object.keys(getGenreStats()).length in init(); Versionsnummer aus Footer entfernt; placeholder und #pool-info zur Laufzeit gesetzt | 2026-06-06 | – |
| #70 | fix(spotify): sp_cid nach OAuth-Callback bereinigt — sessionStorage.removeItem('sp_cid') nach pkce_v; playPreview()/stopAllPreviews() Dead Code entfernt (BL-021); Invariante 2 in CLAUDE.md korrigiert | 2026-06-06 | – |
| HYGE | chore: SE-Hygiene — package.json committed; .claude/settings.json committed; docs/CFLU_Track_Pool.md committed; *.bak in .gitignore | 2026-06-06 | – |
