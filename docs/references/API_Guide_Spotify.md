# SPOTIFY_API_GUIDE.md — CFLU WOD Playlist Builder

**Zweck:** Verbindliche Leitplanken für Claude Code beim Bauen/Ändern der Spotify-Integration des CFLU WOD Builders (PHP-WebApp auf netclusive).
**Stand:** Juni 2026. Berücksichtigt die Spotify-Dev-Mode-Änderungen vom Februar/März 2026.
**Autoritative Quelle für Endpoints/Felder:** OpenAPI-Spec unter `https://developer.spotify.com/reference/web-api/open-api-schema.yaml`. **Endpoints und Feldnamen niemals raten** — immer gegen die Spec prüfen.

---

## 0. TL;DR — die wichtigsten Entscheidungen

1. **Auth:** Server-side **Authorization Code Flow** (PHP-Backend hält `client_secret` + `refresh_token`). Kein PKCE, kein Secret im Browser. Implicit Grant ist deprecated — niemals verwenden.
2. **Playback-Architektur:** Zwei klar getrennte Modi:
   - **Klasse (Primärfall):** Playlist wird in der **nativen Spotify-App** abgespielt (Bluetooth an die Box-Anlage). Die WebApp **erzeugt/kuratiert nur die Playlist** — sie steuert die Wiedergabe im Kurs nicht.
   - **Fine-Tuning (Sekundärfall):** Vorhören einzelner Tracks **während** des Playlist-Baus, direkt in der WebApp.
3. **Web Playback SDK:** **Optional** und nur für das Fine-Tuning-Vorhören. Empfehlung: **zunächst weglassen**, stattdessen Web-API-Steuerung eines vorhandenen Connect-Geräts (Details §4). Begründung und Trade-off in §4.3 — finale Entscheidung liegt bei Niklas.
4. **Audio Features:** `/audio-features` & `/audio-analysis` bleiben für Dev-Mode-Apps **deprecated** (403). Weiter über **Chosic-CSV-Export** beziehen. Keine neue Abhängigkeit auf diese Endpoints bauen.
5. **Dev-Mode-Limits (ab 09.03.2026, gelten für bestehende Apps):** App-Owner braucht **Spotify Premium**; **max. 5 autorisierte User pro Client ID**; **1 Client ID pro Entwickler**. Endpoint-Reduktionen wurden für bestehende Apps **verschoben**, kommen aber — defensiv bauen (§7).

---

## 1. Spotify-Produkte: was wir nutzen und was nicht

Spotify bietet mehrere Entwickler-Oberflächen. Für den WOD Builder relevant:

| Produkt | Was es ist | Nutzen wir? |
|---|---|---|
| **Web API** | REST-API für Metadaten, Suche, Playlist-Management, Player-Steuerung | **Ja — Kern.** |
| **Web Playback SDK** | JS-Library, die einen Spotify-Connect-Player **im Browser-Tab** erzeugt (Streaming im Tab) | **Optional**, nur Fine-Tuning. Empfehlung: weglassen (§4). |
| **Embeds (iFrame/oEmbed)** | Eingebetteter Spotify-Player als iframe; spielt 30s-Preview oder (eingeloggt) volle Tracks | Mögliche **leichtgewichtige Alternative** fürs Vorhören (§4.4). |
| **Open Access (SOA)** | Account-Linking für Partner mit eigenem Entitlement-System | **Nein.** Nicht relevant. |
| **iOS/Android SDK** | Native Mobile-SDKs (`app-remote-control`) | **Nein.** WebApp-Projekt. |
| **Ads API / Commercial Hardware** | — | **Nein.** |

---

## 2. Authorization — Server-side Authorization Code Flow

**Ziel-Flow:** `Authorization Code` (nicht PKCE). Das PHP-Backend ist ein vertraulicher Client und kann das `client_secret` sicher halten.

Referenz: `https://developer.spotify.com/documentation/web-api/tutorials/code-flow`

### 2.1 Ablauf (3 Schritte)

1. **User-Authorization anfordern** — Redirect auf `https://accounts.spotify.com/authorize` mit:
   - `client_id` *(required)*
   - `response_type=code` *(required)*
   - `redirect_uri` *(required, muss exakt mit Dashboard-Eintrag übereinstimmen — inkl. Slash/Case)*
   - `scope` *(space-separated, nur Minimal-Set — §3)*
   - `state` *(stark empfohlen — CSRF-Schutz; serverseitig generieren und in Session ablegen, beim Callback vergleichen)*
2. **Token-Tausch** — `POST https://accounts.spotify.com/api/token` (vom **Backend**, nicht Browser):
   - Header `Authorization: Basic base64(client_id:client_secret)`
   - Header `Content-Type: application/x-www-form-urlencoded`
   - Body: `grant_type=authorization_code`, `code`, `redirect_uri`
   - Antwort enthält `access_token`, `token_type=Bearer`, `expires_in` (i.d.R. 3600 s), `refresh_token`, `scope`.
3. **API-Calls** mit `Authorization: Bearer {access_token}`.

### 2.2 Token-Management (PHP-Backend)

- **`client_secret` und `refresh_token` ausschließlich serverseitig** speichern (DB/verschlüsselt). Niemals an den Browser ausliefern, niemals ins Git, niemals in JS.
- **Access Token läuft nach `expires_in` ab.** Vor Ablauf (Puffer ~60 s) per Refresh erneuern:
  `POST /api/token` mit `grant_type=refresh_token`, `refresh_token=...`, Header `Authorization: Basic ...`.
  Referenz: `https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens`
- Spotify kann **gelegentlich einen neuen `refresh_token`** mitliefern — falls vorhanden, **persistieren und alten ersetzen**.
- Browser/Frontend bekommt nie den Spotify-Token, sondern spricht nur mit **unserem** PHP-Endpoint, der serverseitig proxyt. So bleibt das Token-Handling zentral.

### 2.3 Redirect URIs (harte Regeln)

Referenz: `https://developer.spotify.com/documentation/web-api/concepts/redirect_uri`
- **Nur HTTPS** (Produktion). Ausnahme nur lokale Entwicklung: `http://127.0.0.1` (**nicht** `http://localhost`).
- **Keine Wildcards.** Exakter Match Pflicht.
- Produktions-Redirect z.B. `https://metaschmerz.de/spotify/callback` — exakt so im Dashboard hinterlegen.

---

## 3. Scopes — nur das Minimum

Referenz: `https://developer.spotify.com/documentation/web-api/concepts/scopes`
**Keine breiten Scopes auf Vorrat anfordern.** Für den WOD Builder relevant:

| Scope | Wofür | Wann nötig |
|---|---|---|
| `playlist-modify-private` | Private Playlists erstellen/ändern | **Ja** (Playlist-Erzeugung) |
| `playlist-modify-public` | Öffentliche Playlists erstellen/ändern | Nur falls Playlists öffentlich sein sollen |
| `playlist-read-private` | Private Playlists des Users lesen | Falls bestehende Playlists gelesen werden |
| `user-read-private` | Sucht & Profil (Abo-Status) | Für `/search` empfohlen |
| `user-modify-playback-state` | Wiedergabe steuern (`/me/player/*`) | **Nur** wenn Fine-Tuning-Vorhören via Web API (§4) |
| `user-read-playback-state` | Geräte-/Player-Status lesen | **Nur** mit Web-API-Vorhören (§4) |
| `streaming` | Web Playback SDK (Premium) | **Nur** falls SDK doch genutzt wird (§4.3) |

**Hinweis:** Reines Playlist-Bauen braucht **keine** Player-Scopes. Player-Scopes erst hinzunehmen, wenn das Vorhören tatsächlich über die Web API läuft.

---

## 4. Playback / Vorhören — Architektur

### 4.1 Primärfall Klasse: kein App-gesteuertes Playback nötig
Im Kurs wird die fertige Playlist in der **nativen Spotify-App** gestartet und per **Bluetooth** an die Box-Anlage gegeben. Die WebApp muss dafür **nichts** steuern — ihr Job endet beim **Erstellen/Aktualisieren der Playlist** (`POST /me/playlists`, `POST /playlists/{id}/items`). Das ist robust, DRM-frei und unabhängig von Browser/HTTPS-Eigenheiten.

### 4.2 Sekundärfall Fine-Tuning: Track-Vorhören beim Bauen
Hier gibt es drei Optionen. Reihenfolge = Empfehlung.

**Option A (empfohlen): Web-API-Steuerung eines vorhandenen Connect-Geräts.**
Der Coach hat die Spotify-App ohnehin offen (Handy/Desktop = ein Connect-Gerät). Die WebApp steuert dieses Gerät per Web API:
1. `GET /me/player/devices` → Zielgerät wählen (`device_id`).
2. `PUT /me/player/play` mit Body `{ "uris": ["spotify:track:..."] }` oder `{ "context_uri": "spotify:playlist:..." }`, optional `?device_id=...`.
3. Bei Bedarf `PUT /me/player/pause`, `POST /me/player/next`, `PUT /me/player/seek?position_ms=...`, `PUT /me/player/volume?volume_percent=...`.
- **Scopes:** `user-modify-playback-state` (+ `user-read-playback-state` fürs Geräte-Listing).
- **Voraussetzung:** Spotify **Premium**; mind. ein aktives Connect-Gerät.
- **Kein** DRM/EME, **kein** Zwang zum Browser-Streaming, **kein** iOS-Autoplay-Problem.

**Option B: Web Playback SDK (Streaming im Browser-Tab).**
Erzeugt einen eigenen Connect-Player im Tab. Details/Trade-off → §4.3.

**Option C: Embed-iFrame.** Leichtgewichtig, kein Token-Handling fürs Abspielen → §4.4.

### 4.3 Trade-off Web Playback SDK — Empfehlung: zunächst weglassen
Referenz: `https://developer.spotify.com/documentation/web-playback-sdk`

**Pro SDK:** Vollständige Track-Wiedergabe **direkt im WebApp-Tab**, ohne dass ein separates Spotify-Gerät offen sein muss; feine Programmkontrolle + Playback-Events/Metadaten.

**Contra SDK (relevant für uns):**
- Erfordert **`streaming`-Scope + Spotify Premium**.
- Erfordert **HTTPS** und — bei Cross-Origin-iframes — `allow="encrypted-media; autoplay"`; nutzt **EME/DRM**, was mit Privacy-/Adblock-Extensions bricht.
- **iOS:** Wiedergabe startet nach Transfer **nicht automatisch**; User-Interaktion mit den SDK-Events nötig.
- **Nur für nicht-kommerzielle Projekte ohne Spotifys schriftliche Freigabe** (Developer Terms).

**Empfehlung:** Da das Klassen-Playback ohnehin **nicht** über den Browser läuft und das Vorhören mit **Option A** (Web-API-Steuerung eines ohnehin offenen Spotify-Geräts) erfüllt wird, bringt das SDK **zusätzliche Komplexität ohne proportionalen Nutzen**. → **SDK in v1 nicht einbauen.** Nachrüsten ist später ohne Architekturbruch möglich (nur `streaming`-Scope + SDK-Init ergänzen). **Finale Entscheidung: Niklas.**

### 4.4 Embeds als minimal-invasive Vorhör-Variante (Option C)
Referenz: `https://developer.spotify.com/documentation/embeds`
- **iFrame-Embed** eines Tracks/Playlists: per HTML einbinden, optional über die **iFrame API** dynamisch laden/pausieren.
- Ohne Spotify-Login spielt der Embed nur eine **Preview**; eingeloggte Premium-User hören in der Regel den vollen Track.
- **Kein** OAuth-Token fürs Abspielen nötig, **kein** `streaming`-Scope → sehr geringer Integrationsaufwand.
- Trade-off: weniger programmatische Kontrolle als Web API/SDK; nützlich, wenn nur „kurz reinhören" reicht.

---

## 5. Kern-Workflows (Endpoints)

Immer Pfade/Parameter/Response-Felder gegen die **OpenAPI-Spec** verifizieren.

### 5.1 Tracks finden
- `GET /search?q=...&type=track&limit=...` — **Achtung:** Für neue/zukünftig restriktierte Apps ist `limit` max. **10** (Default 5); ggf. via `offset` paginieren. Defensiv so bauen, dass kleine Limits + Pagination funktionieren.
- `GET /tracks/{id}` — Einzel-Track-Metadaten. (Batch-`GET /tracks?ids=` wird in der reduzierten Endpoint-Liste entfernt → **nicht** darauf verlassen; pro Track einzeln holen oder vorhandene Pool-Daten nutzen.)

### 5.2 Playlist erstellen & befüllen
- `POST /me/playlists` (Body: `name`, `public`, `description`) → liefert `playlist_id`.
  *(`POST /users/{user_id}/playlists` ist entfernt — `POST /me/playlists` verwenden.)*
- `POST /playlists/{id}/items` (Body: `uris: ["spotify:track:..."]`, optional `position`).
  **Neuer Pfad `/items`** — die alten `/playlists/{id}/tracks`-Varianten sind **deprecated**.
- `PUT /playlists/{id}/items` — Items neu ordnen/ersetzen (z.B. Phasen-Reihenfolge final setzen).
- `DELETE /playlists/{id}/items` — Items entfernen (Parameter heißt jetzt `items`, nicht `tracks`).
- `GET /playlists/{id}/items` — Inhalte lesen (**nur** bei eigenen/kollaborativen Playlists; sonst nur Metadaten). Response-Felder umbenannt: `tracks`→`items`, `tracks.tracks`→`items.items`, `tracks.tracks.track`→`items.items.item`. **Defensiv parsen** (Feld kann fehlen).
- Cover setzen (optional): `PUT /playlists/{id}/images` (Scope `ugc-image-upload`).

### 5.3 Vorhören (nur falls §4.2 Option A)
- `GET /me/player/devices`
- `PUT /me/player/play` (`uris` oder `context_uri`)
- `PUT /me/player/pause`, `POST /me/player/next`, `PUT /me/player/seek`, `PUT /me/player/volume`
- `GET /me/player` / `GET /me/player/currently-playing` — Status.
- `PUT /me/player` — Playback auf anderes Gerät transferieren.
**Die gesamte Player-Gruppe bleibt auch unter der reduzierten Endpoint-Liste erhalten.**

### 5.4 Audio Features — NICHT über die Web API
- `/audio-features` & `/audio-analysis` sind für Dev-Mode **deprecated** (403, seit 27.11.2024). **Quelle bleibt Chosic-CSV-Export.** `GET /recommendations` und Genre-Seeds ebenfalls als wegfallend behandeln → **keine** neuen Abhängigkeiten.

---

## 6. Rate Limits & Fehlerbehandlung

Referenz: `https://developer.spotify.com/documentation/web-api/concepts/rate-limits`
- Limits gelten in **rollierenden 30-s-Fenstern**; Dev-Mode hat niedrigere Limits als Extended Quota.
- Bei **HTTP 429**: den **`Retry-After`**-Header (Sekunden) respektieren. **Exponentielles Backoff**, **niemals** in Tight-Loops sofort wiederholen. (Deckt sich mit dem bekannten Throttling-Problem beim Massen-Tagging — Loops drosseln/serialisieren.)
- **Alle dokumentierten HTTP-Fehlercodes** behandeln (400/401/403/404/429/5xx). 401 → Token refreshen und **einmal** retry; 403 → Scope/Permission/Quota prüfen (oft deprecierter Endpoint); Fehlermeldung aus dem Response-Body dem User verständlich zurückgeben.
- **Batch entfernt:** Wo früher Batch-Reads genutzt wurden, Einzel-Requests mit Drossel statt paralleler Bursts.

---

## 7. Dev-Mode-Restriktionen (Feb/März 2026) — Konsequenzen

Quelle: Blogpost 06.02.2026 + Migration Guide.
- **Premium-Pflicht** des App-Owners ab 09.03.2026 (sonst stoppt die App bis zur Reaktivierung).
- **Max. 5 autorisierte User / Client ID**; **1 Client ID / Entwickler**. Bestehende Übermengen sind **grandfathered**. → Für ein Coach-Tool im Box-Kontext i.d.R. ausreichend; User-Liste bewusst kuratieren.
- **Endpoint-Reduktion für bestehende Apps verschoben**, aber angekündigt. **Defensiv bauen:**
  - `popularity`, `available_markets`, `linked_from` (Track), `label`/`album_group` (Album), `followers`/`product`/`country`/`email` (User) können **wegfallen** → bei Abwesenheit **graceful** behandeln (kein Hard-Dependency). *(`external_ids` wurde laut März-2026-Changelog zurückgenommen — bleibt vorerst.)*
  - **WOD-Score:** Der Faktor **Popularity** im Score (Memory: 15 %) hängt am `popularity`-Feld der Web API. Da dieses wegfallen kann, **Popularity-Wert aus dem Pool/Chosic-Export beziehen** oder den Score so kapseln, dass eine fehlende Quelle den Faktor sauber auf neutral/0-Gewicht degradiert.
  - **Search-`limit`** defensiv ≤10 + Pagination.

---

## 8. Compliance (Developer Terms)

Referenz: `https://developer.spotify.com/terms`
- **Kein Caching** von Spotify-Content über das für den unmittelbaren Gebrauch nötige Maß hinaus. (Track-IDs/eigene Pool-Metadaten für die Tool-Funktion sind ok; keine Schatten-Datenbank von Spotify-Inhalten aufbauen.)
- **Spotify-Attribution**: Inhalte als „von Spotify" kennzeichnen, Logos/Branding gemäß **Design-Guidelines** (`/documentation/design`).
- **Kein ML-Training** auf Spotify-Daten.
- **Web Playback SDK / kommerzielle Nutzung** nur mit Spotifys schriftlicher Freigabe.
- **Accessibility-Guidelines** (`/documentation/accessibility`) für die Player-/Steuer-UI beachten (Fokus, Tastatur, ARIA, Kontrast).

---

## 9. Definition of Done (Checkliste für Claude Code)

- [ ] Auth = Authorization Code Flow; `client_secret`/`refresh_token` **nur** serverseitig; Frontend spricht nur mit unserem PHP-Proxy.
- [ ] `state`-Parameter gesetzt und beim Callback validiert.
- [ ] Redirect URI = HTTPS, exakter Match, keine Wildcard.
- [ ] Token-Refresh implementiert (Puffer ~60 s); rotierender `refresh_token` wird persistiert.
- [ ] Nur Minimal-Scopes; Player-/`streaming`-Scopes nur falls Vorhören aktiv.
- [ ] Playlist-Endpoints in `/items`-Form (nicht `/tracks`); Response defensiv geparst (`items` evtl. absent).
- [ ] Kein neuer Code gegen `/audio-features`, `/audio-analysis`, `/recommendations`, Genre-Seeds, Batch-Reads.
- [ ] 429-Handling mit `Retry-After` + exponentiellem Backoff; alle Fehlercodes behandelt.
- [ ] Felder, die wegfallen können (`popularity` etc.), graceful behandelt; WOD-Score-Popularity entkoppelt.
- [ ] Endpoints/Felder gegen die **OpenAPI-Spec** verifiziert (nichts geraten).
- [ ] Compliance: kein Übercaching, Attribution, kein ML-Training.

---

## 10. Referenz-Links

- OpenAPI-Spec: `https://developer.spotify.com/reference/web-api/open-api-schema.yaml`
- Authorization Code Flow: `https://developer.spotify.com/documentation/web-api/tutorials/code-flow`
- Refreshing Tokens: `https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens`
- Scopes: `https://developer.spotify.com/documentation/web-api/concepts/scopes`
- Redirect URIs: `https://developer.spotify.com/documentation/web-api/concepts/redirect_uri`
- Rate Limits: `https://developer.spotify.com/documentation/web-api/concepts/rate-limits`
- Feb-2026-Migration: `https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide`
- Feb-2026-Changelog (verbliebene Endpoints): `https://developer.spotify.com/documentation/web-api/references/changes/february-2026`
- Web Playback SDK: `https://developer.spotify.com/documentation/web-playback-sdk`
- Embeds: `https://developer.spotify.com/documentation/embeds`
- Developer Terms: `https://developer.spotify.com/terms`
- Design-Guidelines: `https://developer.spotify.com/documentation/design`
- Accessibility: `https://developer.spotify.com/documentation/accessibility`
