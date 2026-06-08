# WODability & Playlist-Kompatibilität: Ein metadatenbasiertes Regelwerk für CrossFit-Playlists

## TL;DR
- **WOD-Score (Einzelsong):** BPM ist mit Abstand das wichtigste und wissenschaftlich am besten gestützte Feld und sollte je nach Phase ~35-45 % des Scores tragen; Energy/Loudness/Danceability/Valence bilden den motivationalen Kern; Instrumental/Speech/Acoustic dienen v.a. als Phasen-Filter; Liveness/Popularity/Duration/Time Signature als kleine Qualitäts-Modifikatoren.
- **Kompatibilität (Übergänge):** Zwei harte Regeln dominieren — BPM-Sprung ≤ ±5 % (≈ ±6 BPM) beim Mix innerhalb einer Phase, und Camelot-Kompatibilität (gleicher Code, ±1 auf gleichem Ring, oder A/B-Wechsel bei gleicher Zahl). Phasenübergänge nutzen bewusst größere Sprünge oder Half-/Double-Time-Relationen (×2 / ÷2 teilen dasselbe Beatgrid).
- **Evidenzlage:** Tempo-Bereiche und der ergogene Effekt (RPE-Reduktion ~10 %, +15 % Ausdauer) sind durch Sportphysiologie (Karageorghis et al.) gestützt; Camelot-Regeln, BPM-Toleranzen und Energiekurven sind DJ-Praxiswissen ohne sportwissenschaftliche Validierung, aber branchenweit standardisiert.

## Key Findings

1. **BPM ist das Fundament — aber mit einer wissenschaftlichen Obergrenze.** Karageorghis' Forschung an der Brunel University zeigt, dass Musik die wahrgenommene Anstrengung (RPE) bei niedriger bis moderater Intensität senkt: „during the asynchronous application of music, the rating of perceived exertion (RPE) is lowered by 10% at low-to-moderate intensities of exercise". Synchrone, motivierende Musik steigerte in einem Laufband-Test die Ausdauer deutlich — „the motivational music elicited a marked 15% increase in treadmill endurance when compared to the control, and a clear 6% increase relative to the oudeterous [neutralen] condition". Entscheidend für die Phase C: **Oberhalb von ~75 % der aeroben Kapazität verliert Musik ihre RPE-senkende Wirkung** — „At high exercise intensities (i.e. beyond 75% of aerobic capacity; VO2max), the afferent signals from the musculature and vital organs become overwhelming in attentional terms, and so music is far less effective in reducing perceived exertion" (Terry et al., 2020). Musik bleibt dort dennoch wertvoll für Stimmung, Arousal und Freude.

2. **Optimale Tempobänder pro Phase sind durch Evidenz + CrossFit-Coaching-Praxis gut belegt** und decken sich weitgehend mit den aktuellen Phasen-Settings, mit Korrekturbedarf an den Rändern (siehe Details).

3. **Camelot-Harmonic-Mixing ist der Standard für tonale Kompatibilität:** Kompatibel sind gleicher Code, ±1 auf gleichem Ring, A/B-Wechsel bei gleicher Zahl, sowie +2 als bewusster Energie-Boost.

4. **BPM-Übergangstoleranz aus der DJ-Praxis:** ±2 BPM praktisch unhörbar, ±3-5 BPM mit Pitch-Anpassung machbar, >5-6 % wird hörbar/unnatürlich. Half-/Double-Time (×2 bzw. ÷2) erlaubt große Phasensprünge ohne Rhythmusbruch.

5. **Energy/Valence/Loudness/Danceability steuern Verlaufskurven und Kohärenz**, sind aber überwiegend DJ-/Kurations-Praxiswissen; die Spotify-Definitionen sind präzise, ihre Validität als Stimmungsmaß ist wissenschaftlich nur teilweise bestätigt.

## Details

### Teil 1 — WOD-Score / WODability eines einzelnen Songs

#### 1.1 BPM (Tempo) — wichtigstes Feld, ~35-45 % Gewicht
Wissenschaftlich gestützte Tempobänder: Für asynchrone Nutzung gilt laut Karageorghis et al. (2011, Part II) „the appropriate band of tempi for exercise intensities in the range 40–90% max HRR is 125–140 bpm when the music is used asynchronously" — dieses Band stammt aus Radergometrie-Studien; eine spätere Laufband-Untersuchung (Karageorghis & Jones, 2014) ergab ein engeres Präferenzband von ~123-131 BPM. Kombiniert mit CrossFit-Coaching-Empfehlungen (CrossFit.com, Renzi 2026):

| Phase | Aktuelles Setting | Empfohlenes optimales Band | Quelle/Evidenz |
|---|---|---|---|
| A — Entrance/Briefing | 90-110 | **85-110** (ruhig, Hintergrund) | Warm-up-Evidenz 90-110 BPM (motor unit recruitment); CrossFit Warm-up 90-110 |
| B — Skill/Strength | 80-130 | **80-120** (Obergrenze senken) | CrossFit: Strength 80-120; schnelle Tempi erhöhen mentale Anspannung, kontraproduktiv für technische Lifts (Snatch, Clean & Jerk) |
| C — Intensive WOD | 125-195 | **140-180** (Kern); ~140-150 für die meisten | CrossFit Met-Con 140-180; HIIT-Studien 135-150+; >180 nur für Punk/DnB-Spitzen |
| D — Cool Down | 60-100 | **60-100** (absteigend) | Rekuperative Musik mit „ave. tempo = 71 bpm" senkt Arousal stärker als keine/schnelle Musik (Karageorghis et al. 2021); ~120-125 BPM „Respite"-Musik verbessert aktive Erholungs-Valenz; ~60 BPM → Alpha-Wellen/Parasympathikus |

Scoring-Logik: Gauß-/Trapez-Funktion um das Phasen-Optimum. Song im Kernband = 1.0, linear abfallend zu den Rändern, 0 außerhalb eines Toleranzfensters (z.B. ±15 BPM über die Bandgrenze). **Wichtig:** Half-/Double-Time berücksichtigen — ein 70-BPM-Track kann für Phase C als 140-BPM-Track (Double-Time-Feel) zählen, da beide dasselbe Beatgrid teilen.

#### 1.2 Energy (0-100) — motivationaler Kern, ~15-20 %
Spotify-Definition (verbatim): „Energy is a measure from 0.0 to 1.0 and represents a perceptual measure of intensity and activity. Typically, energetic tracks feel fast, loud, and noisy ... death metal has high energy, while a Bach prelude scores low ... Perceptual features contributing to this attribute include dynamic range, perceived loudness, timbre, onset rate, and general entropy." Phasen-Zielwerte:
- Phase A: niedrig, ~20-45
- Phase B: moderat, ~40-65 (leicht ansteigend)
- Phase C: hoch, ~75-100
- Phase D: niedrig-absteigend, ~15-40

Hinweis zur Validität: In einer Validierungsstudie (N=244) korrelierte Spotifys Energy stark mit menschlichen Arousal-Ratings — das verlässlichste der Stimmungsfelder.

#### 1.3 Loudness (dB) — ~5-10 %, v.a. Kohärenz
Spotify (verbatim): „The overall loudness of a track in decibels (dB). Loudness values are averaged across the entire track ... Values typically range between -60 and 0 db." „Für eine aufrüttelnde Wirkung muss Musik laut UND schnell sein" (Karageorghis). Höhere Loudness (näher an 0) passt zu Phase C, niedrigere zu A/D. Gehörschutz beachten: Belastung bei Schalldruck >75 dB(A) kann temporäre Hörschäden verursachen.

#### 1.4 Danceability (0-100) — ~10 %
Spotify (verbatim): „Danceability describes how suitable a track is for dancing based on a combination of musical elements including tempo, rhythm stability, beat strength, and overall regularity." Hoher Wert = stabiler, gut synchronisierbarer Beat → wichtig für zyklische Bewegungen (Box Jumps, Double-Unders, Barbell Cycling). Phase B/C: hoch (>60). Phase A/D: weniger relevant. **Caveat:** Eine Validierungsstudie fand, dass „Spotify audio feature danceability did not predict human ratings of song danceability" — als Heuristik nutzbar, nicht als Ground Truth.

#### 1.5 Valence (0-100) — ~5-10 %
Spotify (verbatim): „A measure from 0.0 to 1.0 describing the musical positiveness conveyed by a track. Tracks with high valence sound more positive (e.g. happy, cheerful, euphoric), while tracks with low valence sound more negative (e.g. sad, depressed, angry)." Meta-Analyse von He et al. (2025, Applied Psychology: Health and Well-Being, DOI 10.1111/aphw.70092; 507 Effektstärken aus 59 Studien): „music had a positive effect on affective valence (g = 0.403, 95% CI [0.317, 0.489]) and arousal (g = 0.391, 95% CI [0.252, 0.530]) in response to acute exercise." Empfehlung: Phase A/B mittel-hoch (positiv-aktivierend), Phase C hoch oder bewusst „angry/turbulent" (hohe Energy bei mittlerer Valence funktioniert für aggressive Tracks), Phase D mittel-hoch (Zufriedenheit/Abschluss, serotonin-fördernd).

#### 1.6 Instrumental / Speechiness / Acousticness — Phasen-Filter
- **Instrumentalness:** Spotify-Schwelle (verbatim) — „Values above 0.5 are intended to represent instrumental tracks, but confidence is higher as the value approaches 1.0." Phase A bevorzugt hoch (instrumental, Hintergrund, keine ablenkenden Lyrics); Phase C kann von Lyrics profitieren — eine Studie (selbstgewählte, motivierende vertraute Texte) zeigte +14 % nachhaltigen Output.
- **Speechiness:** Spotify (verbatim) — „Values above 0.66 describe tracks that are probably made entirely of spoken words. Values between 0.33 and 0.66 describe tracks that may contain both music and speech ... including such cases as rap music. Values below 0.33 most likely represent music." → >0.66 ausschließen (kein Song); Rap (0.33-0.66) für Phase C ok.
- **Acousticness:** Spotify (verbatim) — „A confidence measure from 0.0 to 1.0 of whether the track is acoustic. 1.0 represents high confidence the track is acoustic." Phase A/D hoch erlaubt (akustisch, ruhig), Phase C niedrig (elektronisch/laut).

#### 1.7 Liveness / Popularity / Duration / Time Signature / Key — Modifikatoren
- **Liveness:** Spotify (verbatim) — „A value above 0.8 provides strong likelihood that the track is live." Live-Tracks (Publikumsgeräusche, inkonsistente Lautstärke) für nahtlose Playlists leicht abwerten.
- **Time Signature:** 4/4 stark bevorzugen (synchronisierbar, beatmatchbar). 3/4, 6/8, 7/8 für zyklische Phasen (B/C) abwerten.
- **Popularity:** Vertrautheit erhöht Motivationswirkung; leichter Bonus für hohe Popularity (vertraute, lyrische Songs wirken bereits bei ~10 BPM langsamerem Tempo als unbekannte Instrumentaltracks).
- **Duration:** An Phasenlänge anpassen; sehr kurze (<2 Min) oder sehr lange (>6 Min) Tracks abwerten.
- **Key/Camelot:** Für den Einzelsong-Score neutral; entscheidend für die Kompatibilität (Teil 2).

#### Vorgeschlagene Gewichtung WOD-Score (Beispiel Phase C)
- BPM: 40 %
- Energy: 20 %
- Danceability: 12 %
- Loudness: 8 %
- Valence: 8 %
- Instrumental/Speech/Acoustic (Filter): 7 %
- Liveness/TimeSig/Popularity/Duration: 5 %

Für Phase A/D verschiebt sich Gewicht von Loudness/Danceability hin zu Acousticness/Instrumentalness.

### Teil 2 — Song-Kompatibilität / Playlist-Kombination

#### 2.1 BPM-Übergänge
DJ-Praxis-Konsens (Mixgraph-Katalogmessung über 49.500+ Tracks; Digital DJ Tips):
- **±2 BPM:** für Hörer unmerklich („invisible")
- **±3-5 BPM (≈ ≤5 %):** machbar mit Pitch-Anpassung, Standard-Toleranz; Faustregel „5 % up or down" bzw. „5 BPM up or down"
- **>5-6 %:** hörbar, Tracks klingen unnatürlich (Vocals pitchen, Drums verlieren Punch)

Regel innerhalb einer Phase: aufeinanderfolgende Tracks sollten ≤ ±5 % BPM-Differenz haben. Eskalation in Phase C: schrittweise +2-3 BPM pro Track (DJ-Standard für Energieaufbau; „Small, steady increases of just 2-3 BPM help maintain a seamless flow").

**Phasenübergänge (große Sprünge):**
- Half-/Double-Time: ÷2 oder ×2 teilen dasselbe Downbeat-Grid — „Two tracks at exactly half/double BPM share the same downbeat grid — the kicks land on the same moments in time". Ein 80-BPM-Cool-Down-Track folgt so rhythmisch kohärent auf einen 160-BPM-WOD-Track. Ideal für den C→D-Übergang.
- Bewusster „Drop"/Cut bei Genre-/Phasenwechsel ist akzeptiert und signalisiert den Phasenwechsel — vom CrossFit-Coaching sogar erwünscht: „Switching from a calm track to a more aggressive one can prepare athletes mentally for the next phase."

#### 2.2 Camelot / Harmonic Mixing
Kompatibilitätsregeln (gegeben aktueller Track = Camelot X):
- **Gleicher Code** (z.B. 8A→8A): perfekt, 100 % kompatibel
- **±1 auf gleichem Ring** (8A→7A/9A): sehr glatt, leichte Energieverschiebung (+1 = Boost)
- **A/B-Wechsel bei gleicher Zahl** (8A→8B): relativer Dur/Moll-Wechsel, Stimmungswechsel
- **+2** (8A→10A): bewusster Energie-Boost, leichte, gewollte Dissonanz
- Alles andere: vermeiden (Key-Clash)

Scoring: Übergangs-Score 1.0 für gleichen Code, 0.8 für ±1/relative (A↔B), 0.6 für +2, 0 für inkompatibel. **Caveat:** Bei reinen Perkussion-Übergängen oder kurzen Cuts ist Key-Kompatibilität weniger relevant („Percussion-only mixing ... key compatibility doesn't matter because there's nothing harmonic to clash"). In einer Phasen-Playlist ohne echtes Crossfading kann Camelot daher niedriger gewichtet werden als BPM.

#### 2.3 Energy-Verlaufskurven
DJ-Modell „Ramp Up / Ramp Down / Wave". Für die 4-Phasen-Struktur:
- A: niedrig, flach
- B: sanfter Anstieg (Ramp Up)
- C: Peak, ggf. Wave (Spitzen + kurze Täler bei langen WODs, damit der Floor nicht erschöpft — „The peaks deliver euphoria; the valleys let people breathe")
- D: Ramp Down

Regel: Energy-Delta zwischen aufeinanderfolgenden Tracks innerhalb einer Phase moderat halten (z.B. |ΔEnergy| ≤ 15-20 Punkte), außer am bewussten Peak. Kein Rückfall in Phase C.

#### 2.4 Valence-Konsistenz
Abrupte Valence-Sprünge vermeiden (Stimmungsbrüche). Richtwert |ΔValence| ≤ ~20-25 zwischen Nachbartracks. Camelot hilft gezielt: A→B-Wechsel (Moll→Dur) hebt Valence kontrolliert, B→A senkt sie für Spannungsaufbau.

#### 2.5 Loudness-Angleichung
Tracks auf ein konsistentes Wahrnehmungsniveau bringen (Streaming-Referenz -14 LUFS integriert, ITU-R BS.1770). Innerhalb einer Phase |ΔLoudness| klein halten (Richtwert ≤ 3 dB), um Lautstärkesprünge zu vermeiden (Genre-/Era-bedingt sind sonst 10+ dB Sprünge möglich). Der Phasenübergang A→C darf bewusst lauter werden.

#### 2.6 Danceability-Konsistenz
Innerhalb zyklischer Phasen (B/C) Danceability hoch und stabil halten (Richtwert |ΔDance| ≤ 15), damit der „Groove" nicht abreißt.

#### Vorgeschlagene Kompatibilitäts-Score-Gewichtung (Track→Track innerhalb Phase)
- BPM-Kompatibilität: 40 %
- Camelot/Key: 20 %
- Energy-Delta: 15 %
- Loudness-Delta: 10 %
- Valence-Delta: 8 %
- Danceability-Delta: 7 %

## Recommendations

**Stufe 1 — Sofort umsetzbar (Regel-Engine):**
1. BPM-Bänder anpassen: Phase-B-Obergrenze auf 120 senken; Phase C auf Kern 140-180 fokussieren (statt 125-195), Ränder als Toleranzzone behalten. Begründung: schnelle Tempi behindern technische Lifts in B; oberhalb 75 % VO2max bringt zusätzliches Tempo physiologisch keinen RPE-Vorteil mehr.
2. Half-/Double-Time-Logik ins BPM-Matching einbauen (×2/÷2 als kompatibel werten) — kritisch für den C→D-Übergang und für die Bewertung „langsamer" Tracks mit doppeltem Feel.
3. Camelot-Kompatibilität als Übergangsfilter (gleicher Code / ±1 / A↔B / +2).
4. Harte Filter setzen: Speechiness >0.66 ausschließen; Liveness >0.8 abwerten; Time Signature ≠ 4/4 für B/C abwerten.

**Stufe 2 — Verfeinerung:**
5. Phasenspezifische Energy/Valence/Acousticness/Instrumentalness-Zielfenster (siehe Tabellen) als gewichtete Score-Komponenten.
6. Delta-Regeln für Track→Track-Kohärenz (Energy/Loudness/Valence/Danceability) einführen.
7. Energiekurven-Modell pro Phase: Ramp Up in B, Wave-Peak in C, Ramp Down in D.

**Stufe 3 — Validierung/Tuning:**
8. Gewichtungen empirisch kalibrieren (Coach-Feedback, Skip-Raten). Benchmark: Melden Athleten Tracks in Phase C als „zu langsam/zu schnell" → BPM-Gewicht/Band justieren.
9. A/B-Test gegen rein BPM-sortierte Playlists. Hinweis aus der Literatur: narrativ/manuell aufgebaute Playlists erzielten in einem berichteten Vergleich deutlich längere Time-to-Exhaustion als reine BPM-Sortierung — d.h. Verlaufskurve (Energiebogen) zahlt sich aus, nicht nur Tempo-Matching. (Dieser konkrete Vergleich stammt aus Sekundärquellen ohne direkt verifizierte Primärstudie — als Hypothese behandeln, im eigenen A/B-Test prüfen.)

**Schwellen, die Empfehlungen ändern würden:**
- Zielgruppe überwiegend Anfänger/weniger aktive Athleten → Tempo etwas senken, Valence/Vertrautheit höher gewichten (Präferenz schlägt exaktes BPM).
- Implementierung von echtem Crossfading/DJ-Mixing → Camelot- und Loudness-Gewicht erhöhen; bei reiner Track-Aneinanderreihung niedriger halten.

## Caveats
- **Evidenz vs. Praxis klar trennen:** Tempobänder, RPE-Reduktion (~10 %), +15 % Ausdauer, die 75-%-VO2max-Obergrenze und Synchronisationseffekte sind sportwissenschaftlich gestützt (Karageorghis, Terry, Priest; Meta-Analysen He et al. 2025 und Terry/Karageorghis et al.). Camelot-Regeln, BPM-Toleranzen und Energiekurven sind reines DJ-/Branchen-Praxiswissen — wirksam und standardisiert, aber nicht sportwissenschaftlich für CrossFit validiert.
- **Spotify-Audio-Features:** präzise definiert, aber Validität als Stimmungs-/Tanzbarkeitsmaß nur teilweise bestätigt. Konkret: Energy korreliert stark mit menschlichem Arousal, Valence moderat, aber „Spotify audio feature danceability did not predict human ratings of song danceability". Werte als Heuristik, nicht als Ground Truth behandeln.
- **Spotify-API-Deprecation:** Laut Spotify-for-Developers-Blog vom 27.11.2024 („Introducing some changes to our Web API") wurden die Endpoints `/audio-features` und `/audio-analysis` deprecated; neue Apps erhalten seither 403-Fehler, nur Apps mit vor dem 27.11.2024 erteiltem Extended-Quota-Zugang bleiben unberührt — ohne offiziellen Ersatz. Bereits vorhandene Metadaten/Drittanbieter weiter nutzbar, Neubeschaffung erschwert.
- **Präferenz schlägt Optimierung:** CrossFit.com betont — „All of this BPM guidance means nothing if your athletes hate what they're hearing. Even perfectly tempo-matched music will tank performance if it grates on people." Das Regelwerk sollte Genre-/Präferenz-Constraints zulassen.
- **Synchron vs. asynchron:** In CrossFit ist synchrone Musik (Beat = Bewegungskadenz) v.a. bei zyklischer Arbeit sinnvoll; bei gemischten Modalitäten (typischer WOD) wirkt Musik asynchron als motivierende Hintergrundenergie. Das BPM-Matching ist also kein striktes Cadence-Locking, sondern eine Bereichszuordnung.
- **Skala-Konvention:** Spotify-Felder sind nativ 0.0-1.0; die Aufgabe nennt 0-100. Schwellen entsprechend skalieren (Instrumentalness 0.5 → 50; Speechiness 0.66 → 66 und 0.33 → 33; Liveness 0.8 → 80).