"""Take a screenshot of any VippeDash page with Chrome, without opening a window.

    python tools/shot.py "index.html?debug&level=forest&cp=5&freeze"     -> shots/index.png
    python tools/shot.py "tools/map.html?level=metro&from=440&to=560" -o shots/hole.png
    python tools/shot.py "tools/skins.html?t=0" --size 1600x2000
    python tools/shot.py "index.html?debug&shop&skin=afModo" --realtime 2500   -> the shop (see below)

The page is opened straight from disk. Without --size, the page's own data-shot-size is used, else 1280x720.
The shots/ folder is git-ignored.

The page normally runs in virtual time, which is deterministic (same code, same PNG) but slow for a page that
redraws a lot every frame, like the shop. --realtime MS lets the page run for MS real milliseconds instead.
"""
import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from headless import ROOT, screenshot  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description='Screenshot a VippeDash page with headless Chrome.')
    ap.add_argument('page', help='page relative to the project folder, with an optional ?query')
    ap.add_argument('-o', '--out', help='PNG file to write (default: shots/<page name>.png)')
    ap.add_argument('--size', help='window size WxH, e.g. 1280x720')
    ap.add_argument('--realtime', type=int, metavar='MS', help='run the page for MS real milliseconds instead of in virtual time')
    a = ap.parse_args()
    size = None
    if a.size:
        m = re.match(r'^(\d+)x(\d+)$', a.size)
        if not m:
            ap.error('--size must look like 1280x720')
        size = (int(m.group(1)), int(m.group(2)))
    out = pathlib.Path(a.out) if a.out else ROOT / 'shots' / (pathlib.Path(re.split(r'[?#]', a.page)[0]).stem + '.png')
    w, h = screenshot(a.page, out, size, realtime_ms=a.realtime)
    print('Wrote %s (%dx%d)' % (out, w, h))


if __name__ == '__main__':
    main()
