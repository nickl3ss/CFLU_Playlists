# test_cflu_server.py — unit tests for cflu_server.py's pure helpers + the HTTP routing gate (#208)
# Run: python -m unittest test_cflu_server  (or: python -m unittest discover -p "test_*.py")
# Covers _origin_allowed() (CSRF gate), _parse_port(), and — against the real CFLUHandler bound
# to an ephemeral 127.0.0.1 port — do_POST's Origin gate and the GET→POST move of
# /api/spotify/logout. No keyvault, no network, no ETL subprocess: _clear_refresh_token is
# stubbed so a real keyvault/cflu_refresh_token.txt can never be deleted by a test run.
import http.client
import json
import socketserver
import threading
import unittest
from unittest import mock

import cflu_server


class OriginAllowedTests(unittest.TestCase):
    PORT = 8899

    def allowed(self, origin):
        return cflu_server._origin_allowed(origin, self.PORT)

    # --- non-browser clients: no Origin header at all ---

    def test_none_is_allowed(self):
        self.assertTrue(self.allowed(None))

    def test_empty_string_is_allowed(self):
        self.assertTrue(self.allowed(''))

    # --- own origin ---

    def test_exact_loopback_ip_match(self):
        self.assertTrue(self.allowed('http://127.0.0.1:8899'))

    def test_exact_localhost_match(self):
        self.assertTrue(self.allowed('http://localhost:8899'))

    def test_port_argument_is_honoured(self):
        self.assertTrue(cflu_server._origin_allowed('http://127.0.0.1:8888', 8888))
        self.assertFalse(cflu_server._origin_allowed('http://127.0.0.1:8888', 8899))

    def test_default_port_80_is_serialised_without_port(self):
        # browsers never send ':80' in Origin — on port 80 the gate must accept the port-less form
        self.assertTrue(cflu_server._origin_allowed('http://127.0.0.1', 80))
        self.assertTrue(cflu_server._origin_allowed('http://localhost', 80))
        self.assertFalse(cflu_server._origin_allowed('http://127.0.0.1:80', 80))   # not a browser serialisation
        self.assertFalse(cflu_server._origin_allowed('http://127.0.0.1', 8899))    # port-less only means 80

    # --- everything else is rejected ---

    def test_wrong_port(self):
        self.assertFalse(self.allowed('http://127.0.0.1:8888'))
        self.assertFalse(self.allowed('http://localhost:8888'))

    def test_port_prefix_is_not_enough(self):
        self.assertFalse(self.allowed('http://127.0.0.1:88990'))  # 8899 is a prefix of 88990

    def test_missing_port(self):
        self.assertFalse(self.allowed('http://127.0.0.1'))
        self.assertFalse(self.allowed('http://localhost'))

    def test_wrong_host(self):
        self.assertFalse(self.allowed('http://evil.example'))
        self.assertFalse(self.allowed('http://evil.example:8899'))
        self.assertFalse(self.allowed('http://127.0.0.2:8899'))
        self.assertFalse(self.allowed('http://[::1]:8899'))

    def test_host_suffix_trick(self):
        # Both would pass a naive startswith() check.
        self.assertFalse(self.allowed('http://127.0.0.1:8899.evil.example'))
        self.assertFalse(self.allowed('http://127.0.0.1:8899@evil.example'))

    def test_opaque_null_origin(self):
        # Sandboxed iframes, file:// pages and cross-site redirect chains send "null".
        self.assertFalse(self.allowed('null'))

    def test_https_scheme(self):
        self.assertFalse(self.allowed('https://127.0.0.1:8899'))
        self.assertFalse(self.allowed('https://localhost:8899'))

    def test_trailing_slash_or_path(self):
        self.assertFalse(self.allowed('http://127.0.0.1:8899/'))
        self.assertFalse(self.allowed('http://127.0.0.1:8899/CFLU_WOD_Builder.html'))

    def test_uppercase_host_is_not_normalised(self):
        # Browsers serialise Origin lowercase (URL-spec host serialisation), so an uppercase
        # host can only come from a hand-crafted client — exact compare, no normalisation.
        self.assertFalse(self.allowed('http://LOCALHOST:8899'))
        self.assertFalse(self.allowed('HTTP://127.0.0.1:8899'))

    def test_surrounding_whitespace(self):
        self.assertFalse(self.allowed(' http://127.0.0.1:8899'))
        self.assertFalse(self.allowed('http://127.0.0.1:8899 '))


class ParsePortTests(unittest.TestCase):
    def test_default_without_argument(self):
        self.assertEqual(cflu_server._parse_port(['cflu_server.py']), 8888)

    def test_explicit_port(self):
        self.assertEqual(cflu_server._parse_port(['cflu_server.py', '8899']), 8899)

    def test_garbage_still_raises_when_run_directly(self):
        # Direct-run behaviour is unchanged: `python cflu_server.py foo` must not silently fall
        # back to 8888 — that would mask a typo behind a wrong redirect URI (Invariant 1).
        with self.assertRaises(ValueError):
            cflu_server._parse_port(['cflu_server.py', 'foo'])

    def test_import_does_not_read_sys_argv(self):
        # cflu_server was imported by `python -m unittest …`, whose argv is not a port number;
        # before #208 that import raised ValueError. Now it must fall back to the default.
        self.assertEqual(cflu_server.PORT, 8888)


class _QuietHandler(cflu_server.CFLUHandler):
    def log_message(self, *args):  # keep the unittest output free of access-log lines
        pass


class RoutingGateTests(unittest.TestCase):
    """Runs the real CFLUHandler on an ephemeral 127.0.0.1 port — no keyvault needed."""

    @classmethod
    def setUpClass(cls):
        cls.server = socketserver.TCPServer(('127.0.0.1', 0), _QuietHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        # The gate compares against the module-level PORT — point it at the test port so
        # "own origin" means this test server, exactly like a real run on that port.
        cls._port_patch = mock.patch.object(cflu_server, 'PORT', cls.port)
        cls._port_patch.start()
        # Never let a test delete keyvault/cflu_refresh_token.txt (it exists on a dev box).
        cls._clear_patch = mock.patch.object(cflu_server, '_clear_refresh_token')
        cls._clear_patch.start()

    @classmethod
    def tearDownClass(cls):
        cls._clear_patch.stop()
        cls._port_patch.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def request(self, method, path, origin=None, body=b''):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        headers = {'Content-Length': str(len(body))}
        if origin is not None:
            headers['Origin'] = origin
        try:
            conn.request(method, path, body=body, headers=headers)
            resp = conn.getresponse()
            return resp.status, resp.read()
        finally:
            conn.close()

    def own_origin(self):
        return f'http://127.0.0.1:{self.port}'

    # --- Origin gate: AC "Origin ungleich eigener Host → 403" ---

    def test_foreign_origin_is_rejected_on_every_post_route(self):
        for path in ('/api/upload-csv', '/api/spotify/call', '/api/lastfm/sync', '/api/spotify/logout'):
            with self.subTest(path=path):
                status, body = self.request('POST', path, origin='http://evil.example')
                self.assertEqual(status, 403)
                self.assertEqual(json.loads(body), {'error': 'origin not allowed'})

    def test_gate_runs_before_routing(self):
        # Even an unknown POST path answers 403 (not 404) when the Origin is foreign.
        status, _ = self.request('POST', '/api/does-not-exist', origin='http://evil.example')
        self.assertEqual(status, 403)

    def test_wrong_port_origin_is_rejected(self):
        status, _ = self.request('POST', '/api/does-not-exist', origin=f'http://127.0.0.1:{self.port + 1}')
        self.assertEqual(status, 403)

    # --- Origin gate: own origin / missing Origin pass through to normal routing ---

    def test_own_origin_passes_the_gate(self):
        # Unknown path + own Origin → the ordinary 404 fallthrough, i.e. the gate let it pass.
        status, body = self.request('POST', '/api/does-not-exist', origin=self.own_origin())
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body), {'error': 'not found'})

    def test_localhost_origin_passes_the_gate(self):
        status, _ = self.request('POST', '/api/does-not-exist', origin=f'http://localhost:{self.port}')
        self.assertEqual(status, 404)

    def test_missing_origin_passes_the_gate(self):
        status, body = self.request('POST', '/api/does-not-exist')
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body), {'error': 'not found'})

    # --- logout: AC "/api/spotify/logout nur noch via POST; GET → 404" ---

    def test_logout_via_get_is_404(self):
        status, _ = self.request('GET', '/api/spotify/logout')
        self.assertEqual(status, 404)

    def test_logout_via_post_works(self):
        cflu_server._sp_tokens['access_token'] = 'dummy'
        status, body = self.request('POST', '/api/spotify/logout', origin=self.own_origin())
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'ok': True})
        self.assertIsNone(cflu_server._sp_tokens['access_token'])
        cflu_server._clear_refresh_token.assert_called()

    def test_logout_via_post_without_origin_works(self):
        # Non-browser client (curl / script): missing Origin is processed normally.
        status, body = self.request('POST', '/api/spotify/logout')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'ok': True})


if __name__ == '__main__':
    unittest.main()
