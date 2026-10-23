#!/usr/bin/env python3
"""Local isolation headers for development; production requires HTTPS."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import functools
root = Path(__file__).resolve().parent.parent / 'dist'
if not root.is_dir():
    raise SystemExit('Run bash scripts/assemble.sh first (requires compiled whisper.cpp)')
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
ThreadingHTTPServer(('127.0.0.1', 4173), functools.partial(Handler, directory=str(root))).serve_forever()
