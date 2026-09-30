"""Run VippeDash pages in Chrome (or Edge) without a window, from Python.

Used by the command-line tools (verify.py, shot.py, release.py), so levels can be checked and pictures
taken without opening a browser. Nothing to install: it uses the Chrome or Edge that is already on the PC.

    from headless import dump_dom, screenshot
    html = dump_dom('tools/verify.html?level=forest')            # the page's HTML once its scripts have run
    screenshot('tools/skins.html?t=0', 'out/skins.png')          # a PNG of the page

Pages are given relative to the project folder (a query string is fine) and are opened straight from disk.
A page can set data-shot-size="WxH" on <body> to tell screenshot() how big it wants the window (the game itself,
index.html, never does, so it is always 1280x720 and screenshot() skips the extra Chrome start that would ask).
Every Chrome gets its own temporary profile, so several can run at the same time (shot.py does this).
Set the CHROME environment variable to use a particular browser.
"""
import os
import pathlib
import re
import shutil
import json
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

_CANDIDATES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]


def find_browser():
    env = os.environ.get('CHROME')
    if env and pathlib.Path(env).exists():
        return env
    for c in _CANDIDATES:
        if pathlib.Path(c).exists():
            return c
    for name in ('chrome', 'google-chrome', 'chromium', 'chromium-browser', 'msedge'):
        p = shutil.which(name)
        if p:
            return p
    raise SystemExit('Could not find Chrome or Edge. Set the CHROME environment variable to its path.')


def page_url(page):
    """'tools/verify.html?level=forest' -> file:///C:/Projects/VippeDash/tools/verify.html?level=forest"""
    if re.match(r'^(https?|file):', page):
        return page
    path, rest = re.match(r'^([^?#]*)(.*)$', page).groups()
    return (ROOT / path).resolve().as_uri() + rest


def _run(args, timeout):
    with tempfile.TemporaryDirectory(prefix='vd-chrome-') as prof:
        cmd = [
            find_browser(), '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files',
            '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--user-data-dir=' + prof,
        ] + args
        res = subprocess.run(cmd, capture_output=True, timeout=timeout)
        return res.stdout.decode('utf-8', errors='replace')


def dump_dom(page, budget_ms=300000, timeout=900):
    """Open the page, let its scripts (and timers) run, and return the resulting HTML.
    budget_ms is virtual time: timers are fast-forwarded, so a page that is idle returns at once."""
    return _run(['--virtual-time-budget=%d' % budget_ms, '--dump-dom', page_url(page)], timeout)


def shot_size(page):
    """The window size a page asks for with <body data-shot-size="WxH">, or None.
    A short budget: pages set the size as soon as they have drawn, and a page that animates every frame
    would otherwise be fast-forwarded through thousands of frames."""
    m = re.search(r'data-shot-size="(\d+)x(\d+)"', dump_dom(page, budget_ms=3000))
    return (int(m.group(1)), int(m.group(2))) if m else None


def checkpoint_counts():
    """{level id: number of checkpoints} for every level, from one quick Chrome start (about 3-6 s).
    Builds the levels with js/util.js, physics.js and level.js on a throwaway page and reads the numbers back
    from its DOM; the levels are not drawn or solved, so it takes about as long as Chrome needs to start."""
    scripts = ''.join('<script src="%s"></script>' % (ROOT / 'js' / n).as_uri() for n in ('util.js', 'physics.js', 'level.js'))
    js = ('document.body.setAttribute("data-cps",JSON.stringify(VD.LEVELS.map(function(L)'
          '{return [L.id,VD.buildLevel(L.id).checkpoints.length]})))')
    with tempfile.TemporaryDirectory(prefix='vd-cps-') as d:
        f = pathlib.Path(d) / 'cps.html'
        f.write_text('<!doctype html><meta charset="utf-8"><body>%s<script>%s</script>' % (scripts, js), encoding='utf-8')
        html = dump_dom(f.as_uri(), budget_ms=500, timeout=120)
    m = re.search(r'data-cps="([^"]*)"', html)
    if not m:
        raise SystemExit('Could not read the checkpoint counts from Chrome.')
    return dict(json.loads(m.group(1).replace('&quot;', '"')))


def screenshot(page, out, size=None, budget_ms=None, timeout=900, realtime_ms=None):
    """Save a PNG of the page. size=(w, h); if None, use the page's data-shot-size, else 1280x720.
    The game (index.html, any query) never sets data-shot-size, so for it 1280x720 is used without asking the page;
    other pages are opened once first (shot_size) to see if they want a particular size.

    By default the page runs in virtual time (deterministic: timers are fast-forwarded and pending file loads,
    such as fonts, are waited for). A page that redraws a lot every frame (the shop) is slow to fast-forward;
    pass realtime_ms to instead let it run for that many real milliseconds (then size isn't read from the page).
    budget_ms defaults to 1500 for the game (it draws every frame, and 1.5 s of virtual time is enough for the fonts
    and a debug start; 5 s took about twice as long for the same picture) and 5000 for other pages."""
    if realtime_ms:
        size = size or (1280, 720)
        wait = ['--timeout=%d' % realtime_ms]
    else:
        is_game = re.split(r'[?#]', page)[0] == 'index.html'
        if not size and not is_game:
            size = shot_size(page)
        budget_ms = budget_ms or (1500 if is_game else 5000)
        size = size or (1280, 720)
        wait = ['--virtual-time-budget=%d' % budget_ms]
    out = pathlib.Path(out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    _run(wait + ['--window-size=%d,%d' % size, '--screenshot=' + str(out), page_url(page)], timeout)
    if not out.exists():
        raise SystemExit('Chrome did not save a screenshot of ' + page)
    return size
