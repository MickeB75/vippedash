"""Run VippeDash pages in Chrome (or Edge) without a window, from Python.

Used by the command-line tools (verify.py, shot.py, release.py), so levels can be checked and pictures
taken without opening a browser. Nothing to install: it uses the Chrome or Edge that is already on the PC.

    from headless import dump_dom, screenshot
    html = dump_dom('tools/verify.html?level=forest')            # the page's HTML once its scripts have run
    screenshot('tools/skins.html?t=0', 'out/skins.png')          # a PNG of the page

Pages are given relative to the project folder (a query string is fine) and are opened straight from disk.
A page can set data-shot-size="WxH" on <body> to tell screenshot() how big it wants the window.
Set the CHROME environment variable to use a particular browser.
"""
import os
import pathlib
import re
import shutil
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


def screenshot(page, out, size=None, budget_ms=5000, timeout=900, realtime_ms=None):
    """Save a PNG of the page. size=(w, h); if None, use the page's data-shot-size, else 1280x720.

    By default the page runs in virtual time (deterministic: timers are fast-forwarded and pending file loads,
    such as fonts, are waited for). A page that redraws a lot every frame (the shop) is slow to fast-forward;
    pass realtime_ms to instead let it run for that many real milliseconds (then size isn't read from the page)."""
    if realtime_ms:
        size = size or (1280, 720)
        wait = ['--timeout=%d' % realtime_ms]
    else:
        size = size or shot_size(page) or (1280, 720)
        wait = ['--virtual-time-budget=%d' % budget_ms]
    out = pathlib.Path(out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    _run(wait + ['--window-size=%d,%d' % size, '--screenshot=' + str(out), page_url(page)], timeout)
    if not out.exists():
        raise SystemExit('Chrome did not save a screenshot of ' + page)
    return size
