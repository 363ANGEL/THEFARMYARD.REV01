#!/usr/bin/env python3
"""Local development static server for The Farmyard. DEVELOPMENT ONLY.

A drop-in for `python -m http.server` that tells the browser never to cache,
so an edited .js/.css file is picked up on the next reload even though the
?v= token in the page has not changed. The live site is served by GitHub
Pages; this file plays no part there.

    python tools/devserve.py [--port 8000] [--directory <folder>]
"""
import argparse
import functools
import http.server
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Brief: only report errors (4xx/5xx), not every request.
        if len(args) > 1 and str(args[1])[:1] in "45":
            super().log_message(fmt, *args)


def main():
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser(description="No-cache static server (development only)")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--directory", default=str(root))
    a = ap.parse_args()
    handler = functools.partial(NoCacheHandler, directory=a.directory)
    with http.server.ThreadingHTTPServer(("", a.port), handler) as srv:
        print(f"Serving {a.directory} on http://localhost:{a.port} (no-store)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
