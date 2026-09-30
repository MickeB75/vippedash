"""Take screenshots of VippeDash pages with Chrome, without opening a window.

    python tools/shot.py "index.html?debug&level=forest&cp=5&freeze"     -> shots/index.png
    python tools/shot.py "tools/map.html?level=metro&from=440&to=560" -o shots/hole.png
    python tools/shot.py "tools/skins.html?t=0" --size 1600x2000
    python tools/shot.py "index.html?debug&shop&skin=afModo" --realtime 2500   -> the shop (see below)
    python tools/shot.py "index.html?debug&level=chess&cp=2&freeze" "index.html?debug&level=chess&cp=6&freeze"
    python tools/shot.py --cps chess                                     -> shots/chess_cp0.png ... chess_cp9.png

The page is opened straight from disk. Without --size, the page's own data-shot-size is used, else 1280x720
(index.html never sets one, so it is always 1280x720 and no extra Chrome start is needed to find out).
The shots/ folder is git-ignored.

Several pages can be given at once. They are shot one after the other (about 3 s each for the game): Chromes
running in virtual time at the same time slow each other down badly (2 in parallel took 22 s, 2 in a row 6 s), so
--jobs N (parallel Chromes) is only worth trying on a big PC. For a whole level, tools/sheet.html is faster still:
one picture of every checkpoint and more in about 7 s. With several pages -o is not allowed; the files go in
--outdir (default shots/) and are named after the page and its query, so different queries never overwrite each other, e.g.
index.html?debug&level=chess&cp=5&freeze -> index_debug_level-chess_cp-5_freeze.png. With a single page
everything works as before: shots/<page name>.png, or the file given with -o.

--cps LEVEL takes one picture per checkpoint of a level: index.html?debug&level=LEVEL&cp=N&freeze for
N = 0..count-1, saved as <outdir>/LEVEL_cpN.png. The count comes from one quick Chrome start
(headless.checkpoint_counts) that builds every level with util.js, physics.js and level.js on a throwaway page
and reads the counts back from its DOM. That was chosen over the alternatives: tools/map.html only draws the
count on a canvas (not in the DOM) and takes as long, and game.js only warns in the console when cp is out of
range (and a screenshot can't see the console), so probing with cp=N until it fails would cost a Chrome per try.

The page normally runs in virtual time, which is deterministic (same code, same PNG) but slow for a page that
redraws a lot every frame, like the shop. --realtime MS lets the page run for MS real milliseconds instead.
"""
import argparse
import concurrent.futures
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from headless import ROOT, checkpoint_counts, screenshot  # noqa: E402


def page_name(page):
    """'index.html?debug&level=chess&cp=5' -> 'index_debug_level-chess_cp-5' (only [A-Za-z0-9_-])"""
    path, query = (re.split(r'[?#]', page, maxsplit=1) + [''])[:2]
    name = pathlib.Path(path).stem
    query = re.sub(r'[^A-Za-z0-9_-]', '_', query.replace('=', '-').replace('&', '_'))
    query = re.sub(r'_+', '_', query).strip('_')
    return name + ('_' + query if query else '')


def shoot_all(jobs, size, realtime, workers=1):
    """jobs: [(page, out path)]. Runs them (workers at a time) and prints one line per finished picture.
    Returns the number that failed."""
    t0 = time.time()
    failed = 0

    def one(job):
        page, out = job
        t = time.time()
        try:
            w, h = screenshot(page, out, size, realtime_ms=realtime)
            return '%s (%dx%d, %.1f s)' % (out, w, h, time.time() - t), None
        except SystemExit as e:
            return None, '%s: %s' % (page, e)

    workers = max(1, min(workers, len(jobs)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for ok, err in pool.map(one, jobs):
            if ok:
                print('Wrote ' + ok)
            else:
                failed += 1
                print('FAILED ' + err)
    if len(jobs) > 1:
        print('%d picture(s) in %.1f s' % (len(jobs) - failed, time.time() - t0))
    return failed


def main():
    ap = argparse.ArgumentParser(description='Screenshot VippeDash pages with headless Chrome.')
    ap.add_argument('page', nargs='*', help='page(s) relative to the project folder, with an optional ?query')
    ap.add_argument('-o', '--out', help='PNG file to write (one page only; default: shots/<page name>.png)')
    ap.add_argument('--outdir', help='folder for the PNGs when there are several pages or --cps (default: shots/)')
    ap.add_argument('--cps', metavar='LEVEL', help='one picture per checkpoint of this level (e.g. chess)')
    ap.add_argument('--size', help='window size WxH, e.g. 1280x720')
    ap.add_argument('--realtime', type=int, metavar='MS', help='run the page for MS real milliseconds instead of in virtual time')
    ap.add_argument('--jobs', type=int, default=1, metavar='N', help='Chromes at a time with several pages (default 1: parallel Chromes slow each other down)')
    a = ap.parse_args()
    size = None
    if a.size:
        m = re.match(r'^(\d+)x(\d+)$', a.size)
        if not m:
            ap.error('--size must look like 1280x720')
        size = (int(m.group(1)), int(m.group(2)))
    outdir = pathlib.Path(a.outdir) if a.outdir else ROOT / 'shots'
    if not a.page and not a.cps:
        ap.error('give at least one page, or --cps LEVEL')
    if a.out and (len(a.page) > 1 or a.cps):
        ap.error('-o works with a single page only; use --outdir with several pages or --cps')

    jobs = []
    if a.cps:
        counts = checkpoint_counts()
        if a.cps not in counts:
            ap.error('unknown level "%s" (levels: %s)' % (a.cps, ', '.join(counts)))
        for n in range(counts[a.cps]):
            jobs.append(('index.html?debug&level=%s&cp=%d&freeze' % (a.cps, n), outdir / ('%s_cp%d.png' % (a.cps, n))))
    if len(a.page) == 1 and not a.cps:
        page = a.page[0]
        out = pathlib.Path(a.out) if a.out else outdir / (pathlib.Path(re.split(r'[?#]', page)[0]).stem + '.png')
        jobs.append((page, out))
    else:
        used = set()
        for page in a.page:
            name = page_name(page)
            n, base = 2, name
            while name in used:  # the same page given twice
                name = '%s-%d' % (base, n)
                n += 1
            used.add(name)
            jobs.append((page, outdir / (name + '.png')))

    if shoot_all(jobs, size, a.realtime, a.jobs):
        sys.exit(1)


if __name__ == '__main__':
    main()
