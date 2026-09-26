"""Ship a new VippeDash build for the phone: check, verify, build and (optionally) serve it, in one command.

    python tools/release.py                  # check, verify, build, then serve on 127.0.0.1:8765
    python tools/release.py --no-verify       # skip the (slow) level check
    python tools/release.py --no-serve        # build only, don't start the server
    python tools/release.py --port 8080       # serve on a different port

Stops with a clear message and exit code 1 at the first failing step:

  1. File check   - every local file the game loads is listed in sw.js FILES, and every FILES entry exists.
  2. Verify        - every level is beatable (tools/verify.py); skip with --no-verify.
  3. Version       - "YYYY-MM-DD HH:MM . <short commit>" from git (plus " *" if the tree is dirty).
  4. Build         - dist/VippeDash.html, stamped with that version (tools/build_single.py).
  5. Serve         - the project folder over http, so a phone can install/update it over USB (see the
                     README, "B. Install it as an app over USB"); skip with --no-serve. Ctrl+C to stop.
"""
import argparse
import functools
import http.server
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_single import build, compute_version, stamp_version  # noqa: E402
import verify  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _add(loaded, rel_path, base_dir):
    if rel_path.startswith(('data:', 'http:', 'https:', '#')):
        return
    p = (base_dir / rel_path).resolve()
    loaded.add(p.relative_to(ROOT).as_posix())


def loaded_files():
    """Every local file index.html (its scripts, stylesheet, manifest, apple-touch-icon), the CSS files'
    url(...) fonts and manifest.json's icons cause the game to load, as project-root-relative paths."""
    loaded = set()
    index_html = (ROOT / 'index.html').read_text(encoding='utf-8')
    for m in re.finditer(r'<script\s+src="([^"]+)"', index_html):
        _add(loaded, m.group(1), ROOT)
    for m in re.finditer(r'<link\s+rel="(?:stylesheet|manifest|apple-touch-icon)"[^>]*href="([^"]+)"', index_html):
        _add(loaded, m.group(1), ROOT)

    for css_rel in [f for f in loaded if f.endswith('.css')]:
        css_path = ROOT / css_rel
        css_text = css_path.read_text(encoding='utf-8')
        for m in re.finditer(r'url\("?([^")]+\.(?:ttf|otf|woff2?))"?\)', css_text):
            _add(loaded, m.group(1), css_path.parent)

    manifest_rel = next((f for f in loaded if f.endswith('.json')), None)
    if manifest_rel:
        manifest = json.loads((ROOT / manifest_rel).read_text(encoding='utf-8'))
        for icon in manifest.get('icons', []):
            if 'src' in icon:
                _add(loaded, icon['src'], ROOT)
    return loaded


def sw_files():
    """The file list sw.js caches for offline use, as project-root-relative paths ('./' excluded)."""
    sw_text = (ROOT / 'sw.js').read_text(encoding='utf-8')
    m = re.search(r'const FILES = \[(.*?)\];', sw_text, re.S)
    if not m:
        sys.exit('Could not find FILES in sw.js')
    return set(re.findall(r"'([^']+)'", m.group(1)))


def check_files():
    """Returns (missing, extra): files the game loads but sw.js doesn't cache, and files sw.js lists
    that don't exist on disk. Both should be empty."""
    loaded = loaded_files()
    files = sw_files()
    missing = sorted(loaded - files)
    extra = sorted(f for f in files if f != './' and not (ROOT / f).exists())
    return missing, extra


def serve(port, version):
    version_js = stamp_version((ROOT / 'js' / 'version.js').read_text(encoding='utf-8'), version)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control', 'no-cache')
            http.server.SimpleHTTPRequestHandler.end_headers(self)

        def do_GET(self):
            # the phone installing over USB should see the stamped version too, without touching the repo
            if self.path.split('?', 1)[0] == '/js/version.js':
                body = version_js.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'text/javascript; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            http.server.SimpleHTTPRequestHandler.do_GET(self)

    class Server(http.server.ThreadingHTTPServer):
        # SO_REUSEADDR (the default) lets a second process silently bind to an already-busy port on
        # Windows instead of failing, so disable it here to get a clear "address already in use" error.
        allow_reuse_address = False

    handler = functools.partial(Handler, directory=str(ROOT))
    try:
        httpd = Server(('127.0.0.1', port), handler)
    except OSError as e:
        sys.exit('Could not start the server on 127.0.0.1:%d (%s). Pick a different --port, or check '
                  'nothing else is already serving on it.' % (port, e))

    print()
    print('Serving VippeDash at http://127.0.0.1:%d/  (Ctrl+C to stop)' % port)
    print('To install or update it on your phone over USB, see the README, section')
    print('"B. Install it as an app over USB" (this server is step 2; use port %d).' % port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    print('Stopped.')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='Check, verify, build and serve a VippeDash release for the phone.')
    ap.add_argument('--no-verify', action='store_true', help='skip checking that every level is beatable')
    ap.add_argument('--no-serve', action='store_true', help="build only, don't start the local server")
    ap.add_argument('--port', type=int, default=8765, help='port to serve on (default: 8765)')
    a = ap.parse_args()

    # 1. file check
    missing, extra = check_files()
    if missing or extra:
        if missing:
            print('Loaded by the game but missing from sw.js FILES:')
            for f in missing:
                print('  ' + f)
        if extra:
            print('Listed in sw.js FILES but not found on disk:')
            for f in extra:
                print('  ' + f)
        sys.exit(1)
    print('File check: ok')

    # 2. verify
    verify_result = 'skipped'
    if a.no_verify:
        print('Verify: skipped (--no-verify)')
    else:
        t0 = time.perf_counter()
        report = verify.run()
        elapsed = time.perf_counter() - t0
        text, ok = verify.format_report(report)
        print(text)
        print('Verify: %.1f s' % elapsed)
        if not ok:
            sys.exit(1)
        verify_result = 'ok'

    # 3. version
    version = compute_version()
    print('Version: ' + version)

    # 4. build
    path = build(version=version)
    size_kb = path.stat().st_size // 1024
    print('Built %s (%d KB)' % (path.relative_to(ROOT), size_kb))

    # 6. summary
    print()
    print('--- Summary ---')
    print('Version : %s' % version)
    print('Dist    : %s (%d KB)' % (path.relative_to(ROOT), size_kb))
    print('Verify  : %s' % verify_result)

    # 5. serve
    if a.no_serve:
        return
    serve(a.port, version)


if __name__ == '__main__':
    main()
