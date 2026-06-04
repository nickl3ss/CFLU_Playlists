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
