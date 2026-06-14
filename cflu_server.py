# cflu_server.py — HTTP server: static files, /api/upload-csv, Spotify OAuth proxy
"""
cflu_server.py
==============
Custom HTTP server — stdlib only. Extends SimpleHTTPRequestHandler with GET + POST routing.

Spotify auth: Authorization Code Flow (server-side). The server holds client_id + client_secret
and the refresh_token; the browser never receives a Spotify access token.

Files (gitignored, local):
    cflu_client_id.txt     — Spotify app Client ID
    cflu_client_secret.txt — Spotify app Client Secret

Redirect URI (must match Spotify Dashboard exactly):
    http://127.0.0.1:<PORT>/api/spotify/callback   (default PORT=8888)

Usage:
    python cflu_server.py [PORT]   (default: 8888)
"""

import base64
import json
import os
import pathlib
import re
import secrets
import socketserver
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import SimpleHTTPRequestHandler

# L-03: Work from the script's own directory regardless of CWD at launch.
os.chdir(pathlib.Path(__file__).parent)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
UPLOAD_DIR = os.path.join('Playlists', 'WebUpload')
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # S-04: 10 MB hard cap

_UNSAFE_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

# S-06: Security headers sent on every response.
_SECURITY_HEADERS = [
    ('X-Content-Type-Options', 'nosniff'),
    ('X-Frame-Options', 'DENY'),
    ('Referrer-Policy', 'no-referrer'),
    # CSP: all Spotify API calls now proxied through this server — browser only needs 'self'.
    ('Content-Security-Policy',
     "default-src 'self'; "
     "script-src 'self'; "
     "style-src 'self' 'unsafe-inline'; "
     "connect-src 'self'; "
     "img-src 'self' data:; "
     "frame-src https://open.spotify.com; "
     "font-src https://fonts.gstatic.com; "
     "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
     "object-src 'none';"),
]

# ===== SPOTIFY AUTH STATE (server-side, in-memory) =====

_SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
_SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
_SCOPE = 'playlist-modify-private user-modify-playback-state user-read-playback-state'
_REDIRECT_URI = f'http://127.0.0.1:{PORT}/api/spotify/callback'

_sp_pending_state: str | None = None  # CSRF token for current OAuth flow
_sp_tokens: dict = {
    'access_token': None,
    'refresh_token': None,
    'expires_at': 0.0,
    'user_id': None,
    'display_name': None,
}


def _load_credentials() -> tuple[str, str]:
    cid = secret = ''
    for fname, tag in (('cflu_client_id.txt', 'cid'), ('cflu_client_secret.txt', 'secret')):
        try:
            with open(fname) as f:
                val = f.read().strip()
            if tag == 'cid':
                cid = val
            else:
                secret = val
        except FileNotFoundError:
            pass
    return cid, secret


def _basic_auth(cid: str, secret: str) -> str:
    return base64.b64encode(f'{cid}:{secret}'.encode()).decode()


def _refresh_access_token() -> None:
    """Refresh the Spotify access token using the stored refresh_token."""
    global _sp_tokens
    if not _sp_tokens.get('refresh_token'):
        return
    cid, secret = _load_credentials()
    if not cid or not secret:
        return
    data = urllib.parse.urlencode({
        'grant_type': 'refresh_token',
        'refresh_token': _sp_tokens['refresh_token'],
    }).encode()
    req = urllib.request.Request(_SPOTIFY_TOKEN_URL, data=data)
    req.add_header('Authorization', f'Basic {_basic_auth(cid, secret)}')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        with urllib.request.urlopen(req) as resp:
            tokens = json.loads(resp.read())
        _sp_tokens['access_token'] = tokens['access_token']
        _sp_tokens['expires_at'] = time.time() + tokens.get('expires_in', 3600) - 60
        if 'refresh_token' in tokens:
            _sp_tokens['refresh_token'] = tokens['refresh_token']
    except Exception:
        _sp_tokens['access_token'] = None  # force re-auth on next call


def _ensure_valid_token() -> None:
    """Refresh token if it expires within 60 s."""
    if _sp_tokens.get('access_token') and time.time() < _sp_tokens.get('expires_at', 0):
        return
    _refresh_access_token()


def _sanitize(name):
    """Removes NTFS-illegal characters and collapses whitespace."""
    name = _UNSAFE_CHARS.sub('', name).strip()
    return re.sub(r'\s+', ' ', name) or 'Upload'


class CFLUHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        for name, value in _SECURITY_HEADERS:
            self.send_header(name, value)
        super().end_headers()

    # ===== GET routing =====

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/api/spotify/login':
            self._handle_spotify_login()
        elif path == '/api/spotify/callback':
            self._handle_spotify_callback()
        elif path == '/api/spotify/status':
            self._handle_spotify_status()
        elif path == '/api/spotify/logout':
            self._handle_spotify_logout()
        else:
            super().do_GET()

    # ===== POST routing =====

    def do_POST(self):
        if self.path == '/api/upload-csv':
            self._handle_upload()
        elif self.path == '/api/spotify/call':
            self._handle_spotify_call()
        else:
            self._respond(404, {'error': 'not found'})

    # ===== Spotify OAuth =====

    def _handle_spotify_login(self):
        global _sp_pending_state
        cid, secret = _load_credentials()
        if not cid or not secret:
            missing = 'cflu_client_id.txt' if not cid else 'cflu_client_secret.txt'
            return self._redirect_to_app(
                f'?sp_error={urllib.parse.quote(missing + " fehlt — im Projektordner anlegen.")}'
            )
        _sp_pending_state = secrets.token_urlsafe(32)
        params = urllib.parse.urlencode({
            'response_type': 'code',
            'client_id': cid,
            'scope': _SCOPE,
            'redirect_uri': _REDIRECT_URI,
            'state': _sp_pending_state,
            'show_dialog': 'true',
        })
        self.send_response(302)
        self.send_header('Location', 'https://accounts.spotify.com/authorize?' + params)
        self.end_headers()

    def _handle_spotify_callback(self):
        global _sp_pending_state, _sp_tokens
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        error = (params.get('error') or [None])[0]
        code = (params.get('code') or [None])[0]
        state = (params.get('state') or [None])[0]

        if error:
            return self._redirect_to_app(f'?sp_error={urllib.parse.quote(str(error))}')
        if not code or state != _sp_pending_state:
            return self._redirect_to_app('?sp_error=invalid_state')

        _sp_pending_state = None  # consume state token

        cid, secret = _load_credentials()
        data = urllib.parse.urlencode({
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': _REDIRECT_URI,
        }).encode()
        req = urllib.request.Request(_SPOTIFY_TOKEN_URL, data=data)
        req.add_header('Authorization', f'Basic {_basic_auth(cid, secret)}')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')

        try:
            with urllib.request.urlopen(req) as resp:
                tokens = json.loads(resp.read())
        except Exception:
            return self._redirect_to_app('?sp_error=token_exchange_failed')

        if 'access_token' not in tokens:
            return self._redirect_to_app('?sp_error=no_token')

        _sp_tokens['access_token'] = tokens['access_token']
        _sp_tokens['refresh_token'] = tokens.get('refresh_token')
        _sp_tokens['expires_at'] = time.time() + tokens.get('expires_in', 3600) - 60

        # Fetch user profile
        try:
            me_req = urllib.request.Request(f'{_SPOTIFY_API_BASE}/me')
            me_req.add_header('Authorization', f'Bearer {_sp_tokens["access_token"]}')
            with urllib.request.urlopen(me_req) as resp:
                me = json.loads(resp.read())
            _sp_tokens['user_id'] = me.get('id', '')
            _sp_tokens['display_name'] = me.get('display_name') or me.get('id', 'Verbunden')
        except Exception:
            _sp_tokens['user_id'] = ''
            _sp_tokens['display_name'] = 'Verbunden'

        self._redirect_to_app('?sp_connected=1')

    def _handle_spotify_status(self):
        if _sp_tokens.get('access_token'):
            _ensure_valid_token()
        connected = bool(_sp_tokens.get('access_token'))
        self._respond(200, {
            'connected': connected,
            'display_name': _sp_tokens.get('display_name') or '',
            'user_id': _sp_tokens.get('user_id') or '',
        })

    def _handle_spotify_logout(self):
        global _sp_tokens
        _sp_tokens['access_token'] = None
        _sp_tokens['refresh_token'] = None
        _sp_tokens['expires_at'] = 0.0
        _sp_tokens['user_id'] = None
        _sp_tokens['display_name'] = None
        self._respond(200, {'ok': True})

    # ===== Spotify API proxy =====

    def _handle_spotify_call(self):
        if not _sp_tokens.get('access_token'):
            return self._respond(401, {'error': 'not authenticated'})

        length = int(self.headers.get('Content-Length', 0))
        if length > 512 * 1024:  # 512 KB limit for proxy requests
            return self._respond(413, {'error': 'request too large'})

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            return self._respond(400, {'error': 'invalid JSON'})

        method = str(payload.get('method', 'GET')).upper()
        sp_path = str(payload.get('path', ''))
        body = payload.get('body')

        # Basic path validation — prevent path traversal
        if not sp_path.startswith('/') or '..' in sp_path:
            return self._respond(400, {'error': 'invalid path'})

        _ensure_valid_token()
        if not _sp_tokens.get('access_token'):
            return self._respond(401, {'error': 'token refresh failed — please reconnect'})

        url = _SPOTIFY_API_BASE + sp_path
        body_bytes = json.dumps(body).encode('utf-8') if body is not None else None

        req = urllib.request.Request(url, data=body_bytes, method=method)
        req.add_header('Authorization', f'Bearer {_sp_tokens["access_token"]}')
        if body_bytes:
            req.add_header('Content-Type', 'application/json')

        try:
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                if resp_body:
                    self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(resp_body)))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception:
            self._respond(500, {'error': 'proxy error'})

    # ===== CSV upload =====

    def _handle_upload(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length > MAX_UPLOAD_BYTES:
                return self._respond(413, {'error': 'Payload too large'})
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                return self._respond(400, {'error': 'invalid JSON'})

            content = payload.get('content')
            if not content:
                return self._respond(400, {'error': 'missing content'})

            filename_raw = payload.get('filename', 'Upload.csv')
            playlist_name = _sanitize(os.path.splitext(filename_raw)[0])

            ts = datetime.now().strftime('%Y.%m.%d-%H-%M-%S')
            out_filename = f'Web-{ts}-{playlist_name}.csv'

            os.makedirs(UPLOAD_DIR, exist_ok=True)
            out_path = os.path.join(UPLOAD_DIR, out_filename)

            # S-05: removeprefix strips exactly one leading BOM; lstrip would strip all.
            with open(out_path, 'w', encoding='utf-8', newline='') as f:
                f.write(content.removeprefix('﻿'))

            from CFLU_Pool_Build import build
            count_new, count_updated, total = build()

            self._respond(200, {
                'ok': True,
                'added': count_new,
                'updated': count_updated,
                'total': total,
                'filename': out_filename,
            })

        except Exception:
            self._respond(500, {'ok': False, 'error': 'Internal server error'})

    # ===== Helpers =====

    def _respond(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _redirect_to_app(self, query=''):
        self.send_response(302)
        self.send_header('Location', f'http://127.0.0.1:{PORT}/CFLU_WOD_Builder.html{query}')
        self.end_headers()


socketserver.TCPServer.allow_reuse_address = True

if __name__ == '__main__':
    print(f'Redirect URI für Spotify Dashboard: {_REDIRECT_URI}')
    with socketserver.TCPServer(('127.0.0.1', PORT), CFLUHandler) as httpd:
        print(f'CFLU Server läuft auf Port {PORT}')
        httpd.serve_forever()
