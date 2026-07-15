# CFLU WOD Builder — Test Protocol

> **How to use this file**
> - Run the **Regression Suite** after every push to confirm nothing broke.
> - Run **New Since Last Push** to verify the specific changes introduced.
> - After confirming all tests pass, clear the *New Since Last Push* section (Claude handles this on confirmation).
> - Update this file in the same commit as any behaviour change (Step D4 mandate).

---

## New Since Last Push

### N26 · Deutsche Musik/EDM Neighbour-Gewicht korrigiert (#166)

| # | Step | Erwartet |
|---|------|----------|
| N26-1 | Genre EDM / Electronic, Phase C, hoher Referenz-BPM (≥170), 150 min generieren | Playlist bleibt deutlich länger im EDM/Pop/Hip-Hop/Synthwave-Bereich, bevor (falls überhaupt) auf Deutsche Musik zurückgefallen wird — kein Umspringen auf Schlager nach 2–3 Tracks |
| N26-2 | Browser-Konsole: `getNeighboursWeighted('EDM / Electronic')` | Erster Eintrag ist nicht mehr `Deutsche Musik`; `Deutsche Musik` erscheint mit weight 0.3 am Ende |

### N25 · Optimizer nutzt konfigurierte Score-Gewichte (#186)

| # | Step | Erwartet |
|---|------|----------|
| N25-1 | Score-Gewichte im Spider-Web deutlich verändern (z. B. BPM=0, Camelot=0, Energy=100), dann eine Spotify-Playlist im Optimizer importieren | Flow-Analyse (Ø-Score, grün/gelb/rot-Zählung) reflektiert die geänderten Gewichte, nicht mehr die Default-Gewichte |
| N25-2 | "🔀 Reihenfolge optimieren" mit geänderten Gewichten | Neue Reihenfolge optimiert nach den aktuell konfigurierten Gewichten |

### N24 · Featuring-Künstler werden bei Diversität berücksichtigt (#165)

| # | Step | Erwartet |
|---|------|----------|
| N24-1 | Playlist mit Genre, in dem ein Künstler sowohl als Primär- als auch als Featuring-Partner auftritt, generieren (z. B. "Blümchen, 2 Engel & Charlie" und "Tream, Blümchen") | Beide Tracks erscheinen nicht gemeinsam in einer kurzen Playlist — Featuring-Künstler zählt für das Artist-Limit |
| N24-2 | Track-Replace (↺) auf einen Slot anwenden, dessen Nachbar-Track einen Featuring-Künstler enthält, der bereits mehrfach in der Playlist vorkommt | Ersatz-Track wiederholt diesen Künstler nicht (weder primär noch featuring) |

### N23 · CSP style-src Duplicate-Directive Fix (Code Review finding)

| # | Step | Erwartet |
|---|------|----------|
| N23-1 | Open app, DevTools → Network → reload → click document request → Response Headers | Single `style-src` directive containing `'self' 'unsafe-inline' https://fonts.googleapis.com` (previously two separate `style-src` entries, browser only honoured the first) |
| N23-2 | DevTools → Console on load | No CSP violation for `fonts.googleapis.com` |
| N23-3 | Inspect rendered text (headings, mono labels) | IBM Plex Mono / Barlow Condensed render (not a system-font fallback) |

### N22 · buildDecreasing Plateau-Fallback + Pool-Warning (#201)

| # | Step | Erwartet |
|---|------|----------|
| N22-1 | Phase D, Rock, Ref ~85 BPM, 150 min generieren | Playlist >41 min; nach BPM-Abstieg auf ~60 hält das BPM-Level (Plateau ±5 BPM) |
| N22-2 | Playlist kürzer als 85 % der Zieldauer (z.B. Rock Phase D 150 min) | Log zeigt "⚠ Pool erschöpft: X min generiert von Y min Ziel" mit Handlungsempfehlung |
| N22-3 | Phase D, größeres Genre (EDM/Pop), 150 min | Genug Tracks → kein Pool-Warning, Playlist deutlich länger |

### N21 · buildDecreasing Phase-D-WOD Fix (#200)

| # | Step | Erwartet |
|---|------|----------|
| N21-1 | Phase D, Rock, Ref ~76 BPM, 85 min Playlist generieren | Playlist hat ~20–25 Tracks (ca. 85 min) — kein frühes Abbrechen bei 4 Tracks |
| N21-2 | Phase D Playlist — Camelot-Spalte prüfen | Mindestens einige grüne (+) Übergänge; nicht mehr 0× grün / alle rot |
| N21-3 | Phase D, leerer Pool | Leere Playlist (kein Absturz) |
| N21-4 | Phase D mit Camelot-Filter aktiv | Nur Tracks mit erlaubten Camelot-Nummern erscheinen |

### N20 · Wave 1 — Algorithm Bug Fixes

| # | Step | Erwartet |
|---|------|----------|
| N20-1 | Phase C WOD mit Cool-Down generieren — Log prüfen | Erster CD-Track hat BPM, der Ratio-Lattice-kompatibel zum letzten WOD-Track ist (kein harter BPM-Sprung) |
| N20-2 | Phase A → Phase D → Phase A wechseln — Pool-Filter prüfen | Filter-Sliders springen einmal auf Phase-Defaults (nicht zweimal); kein doppeltes Flackern beim Init |
| N20-3 | Position=End Playlist generieren | Funktioniert fehlerfrei; Overfetch-Count skaliert mit Zieldauer |
| N20-4 | Position=End mit langer Playlist (z.B. 50 min) | Artist-Limit korrekt relativ zur Playlist-Länge (nicht mehr fest 30-Track-Basis) |
| N20-5 | Cool-Down nach lautem WOD (Phase C) | Erster CD-Track ≤ 40 Energy (nicht mehr bis genre avg_energy) |

### N16 · Camelot-Wheel, Playlist-Filter, UI-Restructure

| # | Step | Erwartet |
|---|------|----------|
| N16-1 | Tonart-Filter-Section öffnen | Collapsible `<details>` mit ▶ "TONART-FILTER"; Camelot-Wheel (SVG, 12 Segmente) rechts neben A/B-Slider und Zahlen-Input |
| N16-2 | Wheel bei leerem Filter (alle aktiv) | Alle 12 Segmente in Vollfarbe (Regenbogen); innerer Ring (A minor) ~55 % Helligkeit; äußerer Ring (B major) Vollfarbe |
| N16-3 | Zahlen-Input "9 10 11" eingeben | Segmente 9, 10, 11 leuchten; alle anderen neutral (fast schwarz) |
| N16-4 | Segment 5 im Wheel anklicken | Segment 5 leuchtet auf; Zahlen-Input zeigt "9 10 11 5" (sortiert: "5 9 10 11"); Kamelot-Hint aktualisiert sich |
| N16-5 | Leuchtendes Segment anklicken | Segment wird neutral; Zahl aus Input entfernt |
| N16-6 | A/B-Slider auf "A" schieben | Nur innerer Ring (A) farbig; äußerer Ring (B) neutral — auch bei selektierten Nummern |
| N16-7 | "Auf Playlist anwenden" Toggle unter Zahlen-Input | Toggle erscheint erst aktiv (nicht ausgegraut) wenn ein Camelot-Filter gesetzt ist |
| N16-8 | Phase auf D wechseln | Score-Gewichtung & Playlist-Filter-Panel: BPM↓ springt auf Phase-D-Minimum (60), BPM↑ auf Maximum (100), E≥ auf 15, Val≥ auf 40 — sichtbar in Slidern und Zahlenfeldern |
| N16-9 | Phase auf C wechseln | Filter-Werte wechseln zu Phase-C-Defaults: BPM 125–195, E≥75, Val≥60, Dce≥60 |
| N16-10 | Playlist generieren mit Swap-Filter gesetzt (z.B. Pop≥75) | Generierungs-Log zeigt "Swap-Filter: Pop≥75  (gilt für Tausch-Kandidaten)" — NICHT "Playlist-Filter" |
| N16-11 | Generierungslauf ohne Swap-Filter | Kein "Swap-Filter"-Eintrag im Log |
| N16-12 | ↺ Reset im Playlist-Filter-Panel klicken | Filter-Werte springen auf die aktuellen Phase-Defaults (nicht auf 0/220) |
| N16-13 | Score-Gewichtung & Playlist-Filter section: Lage prüfen | Section erscheint UNTER Cool-Down und UNMITTELBAR ÜBER "▶ Playlist generieren" |
| N16-14 | 🔧 Optimizer-Tab anklicken | Tab ist ausgegraut/disabled; Cursor zeigt not-allowed; kein Panel öffnet sich |
| N16-15 | ↺ Track-Tausch bei aktivem Swap-Filter (Pop≥75) | Ersatz-Track hat Popularity ≥ 75; automatisch generierte Tracks sind davon nicht betroffen |

### N13 · Popularity als Scoring-Kriterium

| # | Step | Erwartet |
|---|------|----------|
| N13-1 | Score-Gewichtung öffnen | 7. Achse "Pop" im Spider-Web sichtbar; Pop-Slider mit Wert 5 |
| N13-2 | Pop-Slider auf 80 schieben | Radar-Polygon erweitert sich auf der Pop-Achse; Score-Gewichte-Log zeigt Pop:80 |
| N13-3 | Pop auf 0 setzen, Playlist generieren | Popularity hat keinen Einfluss auf Selektion; andere Gewichte unverändert |
| N13-4 | ↺ Reset klicken | Pop-Slider springt auf 5 zurück |

### N12 · BPM-Übergänge — Spotify-sicherer Gate & relaxierte Monotonie

| # | Step | Erwartet |
|---|------|----------|
| N12-1 | Phase C Playlist generieren (Position=Start); BPM-Chart öffnen | BPM-Kurve steigt über die Playlist; kein Sprung größer als ~7,5 % des aktuellen BPM (Gate) |
| N12-2 | BPM-Chart: einzelne Kurvensenken prüfen | Bis zu 10 BPM Rückschritt zwischen zwei aufeinanderfolgenden Tracks möglich (kein harter Fehler) |
| N12-3 | Log aufklappen → EINSTELLUNGEN-Block lesen | Kein "Ziel-BPM"-Eintrag (wurde entfernt); Referenz-Song BPM steht im Song-Block |
| N12-4 | Generierungslog: BPM-Übergänge prüfen | Keine Übergänge die 4:3 oder 3:2 Ratio nur grob approximieren (z.B. 140→174 erscheint nicht mehr) |
| N12-5 | Phase C mit leerem BPM-Gewicht (Score-Gewichte: BPM=0) generieren | BPM bleibt im Phase-C-Band [125–195]; kein Drift in Phase-B-Territorium |

### N11 · Pool Register Tab (Issue #184)

| # | Step | Expected |
|---|------|----------|
| N11-1 | Open app (Python server must be running, Pool Builder run at least once) | Header tab bar shows "▤ Register" as 4th tab |
| N11-2 | Click "▤ Register" | Sidebar shows search box + Tracks/Alben toggle + loading message; WOD result area hidden; right panel shows "← Artist, Track oder Album wählen" |
| N11-3 | After data loads | Artist list fills sidebar (A–Z); status message clears |
| N11-4 | Type an artist name in the search box | List filters live to matching artists; non-matching artists hidden |
| N11-5 | Clear search box | Full artist list returns |
| N11-6 | Click an artist in the list | Artist row expands showing its tracks with BPM/Energy/Genre meta; right panel shows artist aggregate (BPM min/med/max, Energy range, top genres) |
| N11-7 | Click a track under an artist | Right panel shows track detail: Resolved view (Song, Artist, BPM, Energy, Camelot, Genre, Moods, …) + 5 collapsible source blocks (Spotify, Chosic, Last.fm, AI, User) |
| N11-8 | Click any source block toggle button | Block expands showing raw source data; click again to collapse |
| N11-9 | Track has genres_raw (Last.fm data) | EveryNoise color chip appears in header with genre name; chip color matches EveryNoise palette |
| N11-10 | Switch toggle to "Alben" | Artist rows re-expand showing albums instead of tracks; click an album → right panel shows album aggregate |
| N11-11 | Switch back to "Tracks" | Track view restores; album selection cleared |
| N11-12 | Click the same artist again (already selected) | Artist row collapses; right panel resets to empty state |
| N11-13 | Switch to another mode tab (e.g. Advanced) and back to Register | List and detail state persists; data not re-fetched (already loaded) |
| N11-14 | Run without data files (rename data/ folder) | Status shows "Fehler: HTTP-Fehler beim Laden. Bitte Pool-Builder ausführen." — no crash |

### N9 · Track Replace: Generation Context Snapshot

| # | Step | Expected |
|---|------|----------|
| N9-1 | Generate a playlist for Genre A, Phase C | Note genre and phase selection |
| N9-2 | Change genre dropdown to Genre B | Genre badge updates; pool count changes |
| N9-3 | Click ↺ on any WOD track | Replacement candidate comes from Genre A / Phase C pool (original generation context), **not** the currently selected Genre B |
| N9-4 | Change phase selector to Phase A after generating a Phase C playlist | Phase A tile becomes active |
| N9-5 | Click ↺ on any WOD track | Replacement candidate respects Phase C BPM/energy constraints (generation context), not Phase A |

### N10 · Login Modal — Manual Trigger Only

| # | Step | Expected |
|---|------|----------|
| N10-1 | Start app fresh (no Spotify session on server) | Page loads normally; **no login modal auto-shown** |
| N10-2 | Click ▶ on any track row without Spotify connected | Login modal appears |
| N10-3 | Click "Mit Spotify verbinden" button in sidebar | Redirects directly to `/api/spotify/login` (OAuth flow) |
| N10-4 | After OAuth, reload page | `/api/spotify/status` restores session; device panel visible; no modal |
| N10-5 | After page reload with valid session | Page loads; modal does **not** appear |

### N6 · Track Replace — In-Place Swap

| # | Step | Expected |
|---|------|----------|
| N6-1 | Generate a playlist | Each WOD track (except REF) shows a ↺ button in the last column |
| N6-2 | REF track and Cool-Down tracks | No ↺ button visible |
| N6-3 | Click ↺ on a non-REF WOD track | Track is replaced in-place; BPM chart redraws; stats bar updates |
| N6-4 | Click ↺ on a track with very constrained neighbors | Yellow warning "Kein Ersatz für Slot N gefunden (BPM-Übergang oder Camelot-Filter zu eng)." appears for 4 s, then disappears |
| N6-5 | After replacement | New track satisfies BPM transition to both neighbors (no Ratio-Lattice score=0 jump) |
| N6-6 | Click ↺ multiple times on the same slot | Each swap brings a *different* track — previously swapped-out songs do not re-appear; blacklist resets when "▶ Playlist generieren" is clicked again |

### N7 · Spotify Device Control (Web API)

| # | Step | Expected |
|---|------|----------|
| N7-1 | Connect Spotify via "Mit Spotify verbinden" (new auth required for new redirect URI) | After OAuth callback, device panel appears; connect hint hidden; display name shown in sidebar |
| N7-2 | Open Spotify on any device (phone, desktop, etc.), then click ↻ in device panel | Device appears in the dropdown selector |
| N7-3 | Select a device from the dropdown, then click ▶ on any track row | Playback starts on the selected device from that track (Spotify Premium required) |
| N7-4 | Click ▶ on a track row without selecting a device | Status message "Bitte Gerät auswählen…" shown; no playback attempt |
| N7-5 | Click ↻ when no Spotify app is open on any device | Dropdown shows only "— Gerät wählen —" option; no error crash |
| N7-6 | Click "Mit Spotify verbinden" in the device panel while already logged in | Re-initiates OAuth (server uses `show_dialog=true`); existing token replaced after callback |
| N7-7 | Click "Abmelden" in the Spotify sidebar section | Device panel hides; connect hint reappears; spConnected resets to false |
| N7-8 | Reload the page after successful auth | Status auto-restored from server (`/api/spotify/status`); device panel shown without re-login |

### N8 · Explicit-Songs Filter

| # | Step | Expected |
|---|------|----------|
| N8-1 | Open Advanced sidebar | "Explicit-Songs" row visible at the top of **Schritt 1**, before the mode chips; three chips: **Alle** (active/highlighted), **Kein E**, **Nur E** |
| N8-2 | Generate with "Alle" (default) | Playlist may include tracks with explicit flag; `[E]` badge visible on such tracks |
| N8-3 | Select "Kein E", generate | No `[E]`-badged track appears in WOD or Cool-Down |
| N8-4 | Select "Nur E", generate | All tracks carry the `[E]` badge; if pool has no explicit tracks, playlist is empty or uses fallback with a warning |
| N8-5 | Switch back to "Alle" | Active chip returns to "Alle"; explicit tracks reappear on next generation |

### N14 · Advanced Mode — UI Restructure & Genre Space Drag

| # | Step | Expected |
|---|------|----------|
| N14-1 | Open Advanced sidebar — look at Schritt 1 top | **Explicit-Songs** chips appear first (Alle/Kein E/Nur E), before the mode tabs |
| N14-2 | Observe Schritt 1: Genre dropdown | **Genre** selector appears directly below mode tabs and above Tonart-Filter — always visible, not hidden inside Genre&BPM panel |
| N14-3 | Default genre value on first load | Dropdown pre-selected to **EDM / Electronic** (if present in pool) |
| N14-4 | Look below Tonart-Filter slider | **"Tonart-Filter auf Playlist anwenden"** toggle appears; no sub-label; enabled/disabled based on whether a Camelot filter is active |
| N14-5 | Open Schritt 3 | Explicit-Songs chips and old "Tonart-Filter sperren" row are **gone** from Step 3; no log2 toggle anywhere |
| N14-6 | *(removed — log2 toggle no longer exists)* | — |
| N14-7 | Set Explicit-Songs to **Kein E** in Step 1, use Genre&BPM mode | Filter list shows only tracks without `[E]` flag |
| N14-8 | Set Explicit-Songs to **Kein E**, switch to Direktsuche mode, search 2+ chars | Direct search results also exclude explicit tracks |
| N14-9 | Set Explicit-Songs to **Nur E**, switch to Direktsuche mode, search 2+ chars | Direct search results show only explicit-flagged tracks |
| N14-10 | Drag genre space cloud (see N1-3) | Cloud rotates; cursor changes to `grabbing`; auto-rotation pauses while dragging |

### N15 · Last.fm Sync-Status Badge + Admin Panel

| # | Step | Expected |
|---|------|----------|
| N15-1 | Open Admin Panel (⚙ button, top-right) | "Last.fm Sync" section visible; shows last sync date or "Letzter Last.fm Sync: Nie" if never synced |
| N15-2 | `cflu_lastfm.json` has `meta.last_full_sync` set to a date >45 days ago | ⚙ badge shows yellow dot; "↺ Vollständig neu synchronisieren" button visible |
| N15-3 | `meta.last_full_sync` set to a date 30–44 days ago | ⚙ badge shows blue dot; sync button visible |
| N15-4 | `meta.last_full_sync` set to a date <30 days ago | No badge on ⚙; sync button hidden |
| N15-5 | Click "↺ Vollständig neu synchronisieren" | Button shows "⏳ Sync läuft…" and becomes disabled; status message "↻ Sync gestartet…" appears; progress updates in real-time until "✓ Sync abgeschlossen — Seite neu laden um aktuelle Daten zu verwenden." |
| N15-6 | GET `/api/lastfm/status` | Returns JSON with `last_full_sync`, `track_count`, `artist_count` |
| N15-7 | POST `/api/lastfm/sync` | Returns `{"started": true}`; `CFLU_Pool_Build.py --fetch-lastfm` starts in background |

---

### N13 · Playlist-Optimizer (118-A/C/D/E/F)

| # | Step | Expected |
|---|------|----------|
| N13-1 | Click **🔧 Optimizer** tab | Optimizer panel shown with URL input and disabled Import button |
| N13-2 | Paste a valid Spotify playlist URL (public playlist) | Import button activates immediately |
| N13-3 | Paste an invalid URL (e.g. a track URL) | Import button remains disabled; no error |
| N13-4 | Click "⬇ Importieren" with a valid playlist URL (Spotify connected) | Tracks appear in main area with match info; status shows "N Tracks · M im Pool · K extern"; Phase and action buttons appear |
| N13-5 | After import: observe track list | Each row shows index, artist, title; pool-matched tracks show BPM/Camelot/Energy; external tracks show `[ext]` badge |
| N13-6 | After import: observe flow summary (opt-flow-summary) | Shows Ø score, green/yellow/red transition counts |
| N13-7 | Click "🔀 Reihenfolge optimieren" | Track list reordered; flow summary updates with "Optimiert · …" prefix; overall score should increase or stay same |
| N13-8 | Click "🪄 Lücken füllen" | Bridge tracks inserted before red transitions (if any exist); flow summary updates with "+N Lücken gefüllt" |
| N13-9 | Click "→ Zu Spotify exportieren" (Spotify connected) | New playlist "[CFLU OPT] …" created in Spotify; "Playlist öffnen ↗" link appears |
| N13-10 | Change Phase dropdown while optimizer tracks loaded | Flow analysis reruns immediately; summary and track list updated |

### N12 · UI-Modus-Tab-Leiste

| # | Step | Expected |
|---|------|----------|
| N12-1 | Load app | Three mode tabs visible below CFLU header: **⚡ Quick**, **🔧 Optimizer**, **⚙ Advanced** — Advanced highlighted as active |
| N12-2 | Click **⚡ Quick** | Quick panel shown; all Step 1–3 and Advanced generate button hidden; Quick tab highlighted |
| N12-3 | In Quick tab: type 2+ characters in "Song wählen" search | Matching tracks appear in list with artist, title, BPM, Camelot |
| N12-4 | Select a track from Quick search list | Selected-song card appears below list showing song name, artist, BPM, Camelot, genre; "⚡ Generieren" button enabled |
| N12-5 | Choose segment "C — WOD Intensiv" and position "Anfang", click "⚡ Generieren" | Playlist generated in the main result area — same output as Advanced mode |
| N12-6 | Choose segment "A — Warmup & Prep", click "⚡ Generieren" | Playlist uses Phase A energy/BPM defaults; plateau-style build |
| N12-7 | Click **🔧 Optimizer** | Optimizer placeholder panel shown: 🔧 icon + "Playlist-Optimizer / Coming soon — Issue #118" |
| N12-8 | Click **⚙ Advanced** | Full Step 1–3 sidebar reappears; previously generated playlist still visible; Advanced tab highlighted |
| N12-9 | Switch tabs rapidly (Quick → Advanced → Optimizer → Quick) | No crash; each switch shows the correct panel; result area unchanged |

### N11 · Everynoise xy-Score — Genre-Raum-Nähe

| # | Step | Expected |
|---|------|----------|
| N11-1 | Run `python CFLU_Pool_Build.py` | Output contains two new lines: `avg_color : N/M Tracks mit Farbdaten` and `avg_xy : N/M Tracks mit xy-Daten` (N should be ≥85% of M) |
| N11-2 | Open browser console, type `TRACK_DATA.tracks[0].avg_xy` on a track with genre data | Returns a two-element array e.g. `[0.502, 0.031]`; not null |
| N11-3 | Generate two playlists: one with tracks from the same genre, one from very different genres | The same-genre playlist should generally have higher total scores (Generierungs-Log visible) — no crash |
| N11-4 | Run `python CFLU_Pool_Build.py --check-xy-correlation` | Prints Pearson r between xy-distance and RGB-distance; prints interpretation line |

### N5 · Ratio-Lattice BPM Scoring — Score-Gewichte Spider-Web

| # | Step | Expected |
|---|------|----------|
| N5-1 | Open app — look between Step 2 and Step 3 in the sidebar | Collapsed `<details>` section "Score-Gewichte" visible |
| N5-2 | Expand "Score-Gewichte" | Spider-web radar (SVG, 6 axes: BPM, Cam, E, Loud, Val, Dance) visible; 6 sliders with numeric inputs below it |
| N5-3 | Move the BPM slider to 80 | Radar polygon updates live; BPM axis extends further; numeric input shows 80 |
| N5-4 | Type 0 into the BPM numeric input | BPM slider moves to 0; radar polygon shrinks on that axis |
| N5-5 | Generate a playlist | Generation log shows "Score-Gewichte: BPM:80 Cam:20 E:15 Loud:10 Val:8 Dance:7" (or current values) |
| N5-6 | Reload the page | Score-weight slider values persist (localStorage) |
| N5-7 | Generate a playlist; check BPM chart | Adjacent tracks may show ×2/÷2 BPM jumps (e.g. 80→160) — these are Ratio-Lattice compatible transitions (d ≤ 0.135 against 2:1 ratio) |
| N5-8 | Move any slider away from default, then click **↺ Reset** | All 6 sliders snap back to defaults (BPM:40 Cam:20 E:15 Loud:10 Val:8 Dance:7); radar polygon resets; numeric inputs update |
| N5-9 | Reload page after Reset | Default values persisted in localStorage; sliders load at default positions |

---

### N1 · Genre Space — Start Screen

| # | Step | Expected |
|---|------|----------|
| N1-1 | Load app (no playlist generated) | Genre space fills the entire result area; rotating 3D star cloud visible immediately |
| N1-2 | Observe rotation for ~10 s | Cloud rotates slowly around all three axes at different speeds — calm, never repeating |
| N1-3 | Click and drag the cloud | Cloud rotates following mouse movement; auto-rotation pauses during drag; cursor changes to `grabbing`; center stays fixed (no orbit pan) |
| N1-4 | Observe dot sizes | Tiny dots (~2px) for genres not in pool; larger dots (up to ~20px) for high-count genres |
| N1-5 | Cloud visual centre | Cloud centred in the canvas area, not pulled to bottom or side |
| N1-6 | Section title "● Genre Space" | Visible as overlay in top-left of the cloud, does not push canvas down |

### N2 · Genre Space — Playlist Mode

| # | Step | Expected |
|---|------|----------|
| N2-1 | Generate a playlist | Genre space disappears; track list + Spotify Export + Generierungs-Log fill the screen |
| N2-2 | Generate again | Same — genre space stays hidden |

### N3 · Playlist Screen Layout

| # | Step | Expected |
|---|------|----------|
| N3-1 | Generate a playlist | All four sections (BPM chart area, track list, Spotify Export, Generierungs-Log) are same width and left-aligned |
| N3-2 | Scroll check | No page-level scrollbar; Spotify Export and Generierungs-Log always visible without scrolling |
| N3-3 | Generierungs-Log height | Log textarea is compact (≈14 vh), not 280 px fixed; resizable by dragging its bottom edge |
| N3-4 | Resize window vertically | Log height scales with viewport (min 80 px, max 200 px) |

---

## Regression Suite

Run these steps in order. All must pass before a push is considered confirmed.

### R0 · Startup

| # | Step | Expected |
|---|------|----------|
| R0-1 | Run `CFLU_Start.bat` (Windows) or `CFLU_Start.sh` (Mac/Linux) | Terminal shows pool build output, server starts on port 8888, browser opens `CFLU_WOD_Builder.html` |
| R0-2 | Check browser console (F12) for errors | No red errors on load |
| R0-3 | Page title shows "CFLU WOD Builder" | Title visible in tab |

---

### R1 · Track Pool

| # | Step | Expected |
|---|------|----------|
| R1-1 | App loads — check track count indicator | Shows a non-zero track count |
| R1-2 | Open browser console, type `TRACK_DATA.length` | Returns the same count as the UI indicator |

---

### R2 · WOD Configuration

| # | Step | Expected |
|---|------|----------|
| R2-1 | Select WOD type (e.g. "Sport") | UI reflects the selection without error |
| R2-2 | Adjust BPM slider for Phase C | BPM range updates live in the display |
| R2-3 | Toggle a genre filter on and off | Filter state persists until manually changed |
| R2-4 | Set duration (e.g. 45 min) | Duration shown correctly |

---

### R3 · Playlist Generation

| # | Step | Expected |
|---|------|----------|
| R3-1 | Click "Generate" with default settings | Playlist appears; no console errors |
| R3-2 | Verify phase order A → B → C → D in the track list | Phases shown in correct sequence |
| R3-3 | Check BPM values across Phase B/C | BPM never decreases within ascending phases (Invariant 4) |
| R3-4 | Generate a second time | New playlist generated; previous one replaced |
| R3-5 | Generate with very restrictive genre filter | Either a valid short playlist OR a clear "not enough tracks" message — no silent empty result |

---

### R4 · BPM Chart

| # | Step | Expected |
|---|------|----------|
| R4-1 | Generate a playlist | BPM chart renders below or beside track list |
| R4-2 | Inspect chart shape for a WOD type with warm-up + peak + cool-down | Chart shows ascending → plateau → descending curve |
| R4-3 | Resize browser window | Chart redraws without distortion |

---

### R5 · Track Display

| # | Step | Expected |
|---|------|----------|
| R5-1 | Each track shows: artist, title, BPM | All three fields present and non-empty |
| R5-2 | Check for duplicate tracks in one playlist | No track appears twice |
| R5-3 | Track with mood tags — verify tag display (if implemented) | Tags shown correctly or field absent gracefully |

---

### R6 · Spotify Export & Auth

| # | Step | Expected |
|---|------|----------|
| R6-1 | Click "Mit Spotify verbinden" in sidebar | Redirect to `http://127.0.0.1:8888/api/spotify/login` → Spotify OAuth (Authorization Code Flow via server); no login modal appears automatically on page load |
| R6-2 | After auth, return to app | URL contains `?sp_connected=1`; device panel visible; no Spotify token in sessionStorage, localStorage, or cookies |
| R6-3 | Open DevTools → Application → Storage | No `sp_token`, `pkce_v`, `sp_cid`, or similar Spotify credential in any browser storage (Invariant 2) |
| R6-4 | Click "Export to Spotify" | Playlist created in Spotify; success message shown |
| R6-5 | Export a playlist with >100 tracks (if pool allows) | Export completes in batches; all tracks added (Invariant 3) |

---

### R7 · CSV Upload

| # | Step | Expected |
|---|------|----------|
| R7-1 | Drag a valid Spotify CSV onto the upload area | Upload succeeds; success message with track count |
| R7-2 | Upload a file with an invalid extension (e.g. `.txt`) | Rejection message shown; no crash |
| R7-3 | Upload a duplicate CSV (same playlist already in pool) | Handled gracefully — no crash, informative message |

---

### R8 · Automated Tests

| # | Step | Expected |
|---|------|----------|
| R8-1 | Run `node js/cflu_tests.js` | All tests pass — output ends with `N/N bestanden — ALLE TESTS BESTANDEN` |
| R8-2 | Run `npm run lint` | No errors (warnings acceptable) |

---

### R9 · Pool Builder (run if CSVs changed)

| # | Step | Expected |
|---|------|----------|
| R9-1 | Run `python CFLU_Pool_Build.py` | Completes without error; `cflu_tracks.js` updated |
| R9-2 | Reload app in browser | Track count reflects new pool |
| R9-3 | Run `python CFLU_Pool_Build.py --rebuild` | Full rebuild completes; `open_genre=2/3/5` states preserved (Invariant 9) |

---

## Known Limitations / Skipped

| # | Description | Reason |
|---|-------------|--------|
| L1 | Spotify export with >100 tracks requires a large pool | Only testable with a full production pool |
| L2 | AI genre tagging (`--reclassify-ai`) requires `keyvault/anthropic_api_key.txt` | API key is local-only, not in repo |
| L3 | OAuth flow requires Spotify Client ID + Client Secret | `keyvault/cflu_client_id.txt` and `keyvault/cflu_client_secret.txt` are local-only, not in repo |
| L4 | Device playback requires Spotify Premium | Free accounts cannot use `PUT /me/player/play` |

---

## Changelog

| Date | Change | Push / Issue |
|------|--------|--------------|
| 2026-06-16 | N15 Last.fm Sync-Status Badge + Admin Panel added | #159 |
| 2026-06-15 | N13 Playlist-Optimizer (118-A/C/D/E/F) added | Phase 2 (#118) |
| 2026-06-15 | N12 UI-Modus-Tab-Leiste (Quick/Optimizer/Advanced) added | Phase 2 (#119) |
| 2026-06-15 | N11 Everynoise xy-Score added | Phase 2 (#132) |
| 2026-06-15 | N9 generation context snapshot; N10 login modal manual-trigger-only; R6-1/R6-2 updated for no auto-modal | Phase 1 (#147, #150, #152, #153) |
| 2026-06-15 | N5-1 default corrected (unchecked); N6-6 swap blacklist added; N8 Explicit-Songs Filter added; PROJECT.md C4 test count corrected (369) | Project Audit |
| 2026-06-14 | N7 replaced (Web Playback SDK → Device Control); N6-4 warning text corrected; R6 updated for Authorization Code Flow; L4 added | Spotify Integration Redesign |
| 2026-06-10 | Initial test protocol created | docs: initial TESTING.md |
