"""
cflu_server.py
==============
Custom HTTP server — stdlib only. Extends SimpleHTTPRequestHandler with POST routing.
Replaces: python -m http.server <PORT>

Usage:
    python cflu_server.py [PORT]   (default: 8888)
"""

import sys
from http.server import SimpleHTTPRequestHandler
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888


class CFLUHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/upload-csv':
            self._respond(501, b'{"error":"not implemented"}')
        else:
            self._respond(404, b'{"error":"not found"}')

    def _respond(self, code, body):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


socketserver.TCPServer.allow_reuse_address = True

if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), CFLUHandler) as httpd:
        print(f'CFLU Server läuft auf Port {PORT}')
        httpd.serve_forever()
