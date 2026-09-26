"""Build dist/VippeDash.html: the whole game in one file that you can e-mail to yourself and open in Chrome on a phone.

Scripts, CSS and the font are inlined, so the file needs nothing else (not even internet). The build is stamped
with a version (date + short git commit, see compute_version()) so you can tell which build you're looking at;
that's shown faintly in the main menu (js/version.js). Run it again whenever the game changes:

    python tools/build_single.py

Other scripts (tools/release.py) can reuse the builder directly:

    from build_single import build, compute_version
    path = build(version='2026-09-26 21:05 · 6de8a5d')
"""
import base64
import pathlib
import re
import subprocess
import sys
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'VippeDash.html'
FONT_TYPES = {'.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2'}


def compute_version():
    """'YYYY-MM-DD HH:MM · <short commit>', with ' *' appended if the working tree has uncommitted changes.
    Falls back to just the date when git is missing or this isn't a git checkout."""
    now = datetime.now().strftime('%Y-%m-%d %H:%M')
    try:
        commit = subprocess.run(
            ['git', 'rev-parse', '--short', 'HEAD'], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = subprocess.run(
            ['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip() != ''
    except (OSError, subprocess.CalledProcessError):
        return now
    return now + ' · ' + commit + (' *' if dirty else '')


def inline_css(m):
    path = ROOT / m.group(1)
    css = path.read_text(encoding='utf-8')

    def font(u):
        f = (path.parent / u.group(1)).resolve()
        return 'url("data:%s;base64,%s")' % (FONT_TYPES[f.suffix], base64.b64encode(f.read_bytes()).decode('ascii'))

    css = re.sub(r'url\("?([^")]+\.(?:ttf|otf|woff2?))"?\)', font, css)
    return '<style>\n' + css + '</style>'


def inline_js(m):
    js = (ROOT / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + js.replace('</script', '<\\/script') + '</script>'


def stamp_version(html, version):
    """Replace the 'dev' literal from js/version.js with the build version, inside the built file only
    (the repo's own js/version.js is never touched: inline_js only reads it)."""
    escaped = version.replace('\\', '\\\\').replace("'", "\\'")
    stamped, n = re.subn(r"VERSION = 'dev'", "VERSION = '" + escaped + "'", html, count=1)
    if n != 1:
        sys.exit('Could not find the version literal to stamp (did js/version.js change?)')
    return stamped


def build(version=None):
    """Build dist/VippeDash.html and return its path."""
    if version is None:
        version = compute_version()
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
    # the manifest, app icon and service worker only matter for the installed app, which is served over http
    html = re.sub(r'<link rel="(?:manifest|apple-touch-icon)"[^>]*>\n', '', html)
    html = re.sub(r'<script>\s*// offline support.*?</script>\n', '', html, flags=re.S)

    left = re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
    if left:
        sys.exit('Not inlined: ' + ', '.join(left))

    html = stamp_version(html, version)

    OUT.parent.mkdir(exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    return OUT


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    out = build()
    print('Wrote %s (%d KB)' % (out.relative_to(ROOT), out.stat().st_size // 1024))
