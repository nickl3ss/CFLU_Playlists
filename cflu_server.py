# cflu_server.py — HTTP server + /api/upload-csv endpoint only; no ETL logic (delegates to CFLU_Pool_Build)
"""
cflu_server.py
==============
Custom HTTP server — stdlib only. Extends SimpleHTTPRequestHandler with POST routing.
Replaces: python -m http.server <PORT>

Usage:
    python cflu_server.py [PORT]   (default: 8888)
"""

import json
import os
import pathlib
import re
import socketserver
import sys
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
    # CSP: scripts/styles self-only; fetch() to Spotify endpoints allowed.
    ('Content-Security-Policy',
     "default-src 'self'; "
     "script-src 'self'; "
     "style-src 'self' 'unsafe-inline'; "
     "connect-src 'self' https://accounts.spotify.com https://api.spotify.com; "
     "img-src 'self' data:; "
     "frame-src https://open.spotify.com; "
     "object-src 'none';"),
]


def _sanitize(name):
    """Removes NTFS-illegal characters and collapses whitespace."""
    name = _UNSAFE_CHARS.sub('', name).strip()
    return re.sub(r'\s+', ' ', name) or 'Upload'


class CFLUHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        for name, value in _SECURITY_HEADERS:
            self.send_header(name, value)
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/upload-csv':
            self._handle_upload()
        else:
            self._respond(404, {'error': 'not found'})

    def _handle_upload(self):
        try:
            # S-04: Enforce upload size cap before reading body.
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

    def _respond(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


socketserver.TCPServer.allow_reuse_address = True

if __name__ == '__main__':
    with socketserver.TCPServer(('127.0.0.1', PORT), CFLUHandler) as httpd:
        print(f'CFLU Server läuft auf Port {PORT}')
        httpd.serve_forever()
