"""A small static web server for the project folder that never lets the browser cache anything.

    python tools/serve.py             -> http://127.0.0.1:8765/
    python tools/serve.py 8766        -> another port
    python tools/serve.py --bind 0.0.0.0

Like `python -m http.server`, but it always serves the project root (whatever the current folder is) and
sends `Cache-Control: no-store` on every reply, so the preview always shows the files as they are on disk.
Only errors are logged.
"""
import argparse
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # quiet: log_error still prints a short line for failed requests

    def log_error(self, format, *args):
        print('%s %s' % (self.address_string(), format % args), flush=True)


def main():
    ap = argparse.ArgumentParser(description='Serve the VippeDash folder without caching.')
    ap.add_argument('port', nargs='?', type=int, default=8765, help='port (default 8765)')
    ap.add_argument('--bind', default='127.0.0.1', help='address to listen on (default 127.0.0.1)')
    a = ap.parse_args()
    handler = functools.partial(NoStoreHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((a.bind, a.port), handler) as httpd:
        print('Serving %s on http://%s:%d/ (no-store)' % (ROOT, a.bind, a.port), flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
