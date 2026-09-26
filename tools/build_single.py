"""Build dist/VippeDash.html: the whole game in one file that you can e-mail to yourself and open in Chrome on a phone.

Scripts, CSS and the font are inlined, so the file needs nothing else (not even internet).
Run it again whenever the game changes:

    python tools/build_single.py
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'VippeDash.html'
FONT_TYPES = {'.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2'}


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


html = (ROOT / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)
# the manifest, app icon and service worker only matter for the installed app, which is served over http
html = re.sub(r'<link rel="(?:manifest|apple-touch-icon)"[^>]*>\n', '', html)
html = re.sub(r'<script>\s*// offline support.*?</script>\n', '', html, flags=re.S)

left = re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
if left:
    sys.exit('Not inlined: ' + ', '.join(left))

OUT.parent.mkdir(exist_ok=True)
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write(html)
print('Wrote %s (%d KB)' % (OUT.relative_to(ROOT), OUT.stat().st_size // 1024))
