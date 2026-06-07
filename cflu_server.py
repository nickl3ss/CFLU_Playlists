"""
cflu_server.py
==============
Custom HTTP server — stdlib only. Extends SimpleHTTPRequestHandler with POST routing.
Replaces: python -m http.server <PORT>

Usage:
    python cflu_server.py [PORT]   (default: 8888)
"""

import sys
import json
import os
import re
from datetime import datetime
from http.server import SimpleHTTPRequestHandler
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
UPLOAD_DIR = os.path.join('Playlists', 'WebUpload')

_UNSAFE_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _sanitize(name):
    """Removes NTFS-illegal characters and collapses whitespace."""
    name = _UNSAFE_CHARS.sub('', name).strip()
    return re.sub(r'\s+', ' ', name) or 'Upload'


class CFLUHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/upload-csv':
            self._handle_upload()
        else:
            self._respond(404, {'error': 'not found'})

    def _handle_upload(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
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

            # Strip UTF-8 BOM if present, then write as utf-8
            with open(out_path, 'w', encoding='utf-8', newline='') as f:
                f.write(content.lstrip('﻿'))

            from CFLU_Pool_Build import build
            count_new, count_updated, total = build(import_only=True)

            self._respond(200, {
                'ok': True,
                'added': count_new,
                'updated': count_updated,
                'total': total,
                'filename': out_filename,
            })

        except Exception as e:
            self._respond(500, {'ok': False, 'error': str(e)})

    def _respond(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


socketserver.TCPServer.allow_reuse_address = True

if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), CFLUHandler) as httpd:
        print(f'CFLU Server läuft auf Port {PORT}')
        httpd.serve_forever()
