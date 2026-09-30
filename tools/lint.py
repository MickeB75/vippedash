"""Find the mistakes in a VippeDash level that otherwise turn up late in review, from the command line.

Runs tools/lint.html in headless Chrome (via headless.dump_dom, one Chrome per level, in parallel) and prints a
compact report.

    python tools/lint.py                    # all levels
    python tools/lint.py chess              # one level
    python tools/lint.py forest metro       # a few levels
    python tools/lint.py --json             # print the raw JSON report instead
    python tools/lint.py chess --step 5 --scale 1   # the thorough version: every 5 blocks, full 1280x720 pixels (about 4x slower)

Exit code is 0 when there are no errors (warnings are printed but don't fail the run), 1 otherwise.

What is checked:

  1. Theme: every area of the level has a `ground` value (drawGround looks it up by area id with no 'default'
     fallback; a missing one draws no ground), and `glow`/`field`/`far`/`midFill` entries, sky stops, stray or
     misspelled theme keys, and the area lists in mist/beams/canopy/tilt.
  2. Unknown style names: the names of obstacle, block, spike, deco, landmark, ground, far-layer, indoor and corridor
     styles the level really uses but that js/art.js and js/render.js have no case for. Collected while the level
     is drawn (step 4) through the no-op `VD.lintMiss(kind, name)` hooks in the default branches of those switches;
     field styles are compared with the styles drawField() handles (read from render.js).
  3. The LEVELS entry (required fields, unique consecutive `num`, a `.lvl.d<difficulty>` rule in css/style.css) and
     the music: the theme's `song` exists in audio.js SONGS, its sections have no gaps, name existing progressions,
     leads and chords, and cover the level up to the finish (156 BPM, 4 blocks per beat, so 1 bar = 16 blocks).
  4. Render smoke: the real renderer (js/render.js) draws the level on an offscreen 1280x720 canvas at x = 0, 10, 20 ... (--step)
     to the finish, at every checkpoint (several times each, plus the dead and won poses), at the jump scares, and in the
     menu's attract mode. Any exception is reported with its x range and the top of the stack.
  5. Console: uncaught errors, console.error calls and scripts that failed to load while all that ran.

Other scripts can reuse the checker directly:

    from lint import run, all_ok
    report = run(['chess'])
    ok = all_ok(report)
"""
import argparse
import concurrent.futures
import json
import os
import pathlib
import re
import subprocess
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from headless import ROOT, dump_dom  # noqa: E402

REPORT_RE = re.compile(r'<script type="application/json" id="report">(.*?)</script>', re.S)

PAGE_TIMEOUT = 150  # seconds for one level's page; a level normally takes 3-10 s

# the LEVELS entry (js/level.js): fields every entry has, and the ones only some have (read by game.js)
REQUIRED_FIELDS = ['id', 'num', 'name', 'difficulty', 'diffName', 'reward', 'route', 'winTitle', 'winSub', 'build', 'theme']
OPTIONAL_FIELDS = ['localOnly', 'health', 'age', 'strobe']


# ---------------------------------------------------------------------------------------------------------------
# running the page
# ---------------------------------------------------------------------------------------------------------------
def _page_report(query, budget_ms):
    html = ''
    for attempt in (1, 2):  # a Chrome that hangs (a busy PC) is killed after PAGE_TIMEOUT s and tried once more
        try:
            html = dump_dom('tools/lint.html?' + query, budget_ms=budget_ms, timeout=PAGE_TIMEOUT)
            break
        except subprocess.TimeoutExpired:
            if attempt == 2:
                raise SystemExit('lint.html (%s) did not finish within %d s, twice' % (query, PAGE_TIMEOUT))
    m = REPORT_RE.search(html)
    if not m:
        raise SystemExit('lint.html did not produce a report (Chrome output was:\n' + html[:2000] + ')')
    return json.loads(m.group(1))


def _timed(base, level_id, budget_ms):
    t = time.perf_counter()
    page = _page_report('&'.join(base + ['level=' + level_id]), budget_ms)
    for lvl in page['levels']:
        lvl['ms'] = int((time.perf_counter() - t) * 1000)  # wall time of the whole page (Chrome start included)
    return page


def run(level_ids=None, step=10, drop=None, scale=0.5, budget_ms=600000):
    """Lint the levels (default: all) and return the merged report: {'levels': [...], 'global': [...], 'defs': [...]}.
    Every level, and every problem found in it, is in report['levels'][i]['issues'] as {'sev', 'check', 'msg'}."""
    base = ['step=%d' % step, 'scale=%s' % scale]
    if drop:
        base.append('drop=' + ','.join(drop))
    # one Chrome per level, in parallel. Without level ids, one quick Chrome start first learns the ids.
    if level_ids:
        ids = list(level_ids)
    else:
        ids = [d['id'] for d in _page_report('&'.join(base + ['level=-']), budget_ms)['defs']]
    workers = max(1, min(len(ids), os.cpu_count() or 1))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        pages = list(pool.map(lambda i: _timed(base, i, budget_ms), ids))
    defs = pages[0]['defs']
    unknown = [i for i in ids if i not in [d['id'] for d in defs]]
    if unknown:
        raise SystemExit('unknown level %s (levels: %s)' % (', '.join('"%s"' % u for u in unknown), ', '.join(d['id'] for d in defs)))
    report = {'defs': defs, 'dropped': pages[0].get('dropped', []), 'step': step, 'levels': [], 'global': []}
    for page in pages:
        report['levels'].extend(page['levels'])
        for c in page['console']:
            if ':' in c['phase'] and c['phase'].split(':')[0] in ids:
                continue  # attached to its level below
            if not any(g['kind'] == c['kind'] and g['msg'] == c['msg'] for g in report['global']):
                report['global'].append(dict(c))
    for page in pages:
        for c in page['console']:
            lid = c['phase'].split(':')[0]
            for lvl in page['levels']:
                if lvl['id'] == lid:
                    lvl.setdefault('console', []).append(c)
    _analyse(report, ids)
    return report


# ---------------------------------------------------------------------------------------------------------------
# checks done here in Python (they read audio.js, css/style.css and render.js as text)
# ---------------------------------------------------------------------------------------------------------------
def _read(rel):
    return (ROOT / rel).read_text(encoding='utf-8', errors='replace')


def _block(src, start_re, end_re):
    m = re.search(start_re, src)
    if not m:
        return ''
    e = re.search(end_re, src[m.end():])
    return src[m.end(): m.end() + (e.start() if e else len(src))]


def parse_audio():
    """Read the song data out of js/audio.js: {'bpm', 'songs': {id: {'end_chord', 'sections': [(from, to, cfg)]}},
    'prog': {name: [chords]}, 'mel': set, 'chords': set}."""
    src = _read('js/audio.js')
    bpm = int((re.search(r'const BPM = (\d+)', src) or [0, 156])[1])
    prog = {}
    for name, chords in re.findall(r"^\s{4}(\w+): \[((?:'[\w#]+',?\s*)+)\]", _block(src, r'const PROG = \{', r'\n  \};'), re.M):
        prog[name] = re.findall(r"'([\w#]+)'", chords)
    mel = set(re.findall(r'^\s{4}(\w+): parseMelody\(', _block(src, r'const MEL = \{', r'\n  \};'), re.M))
    chords = set(re.findall(r'(\w+): \[\d+, \[', _block(src, r'const CH = \{', r'\n  \};')))
    songs = {}
    body = _block(src, r'const SONGS = \{', r'\n  \};\n  let SONG')
    for m in re.finditer(r'^    (\w+): \{\n(.*?)^    \},?$', body, re.M | re.S):
        text = m.group(2)
        end = re.search(r"endChord: '(\w+)'", text)
        sections = []
        for a, b, cfg in re.findall(r'\[(\d+), (\d+), (\{.*\})\]', text):
            sections.append((int(a), int(b), {
                'end': bool(re.search(r'\bend: true', cfg)),
                'prog': (re.search(r"prog: '(\w+)'", cfg) or [None, None])[1],
                'lead': (re.search(r"lead: '(\w+)'", cfg) or [None, None])[1],
            }))
        songs[m.group(1)] = {'end_chord': end.group(1) if end else None, 'sections': sections}
    return {'bpm': bpm, 'songs': songs, 'prog': prog, 'mel': mel, 'chords': chords}


def song_issues(lvl, audio):
    """Problems with the level's music: missing song, gaps, unknown names, sections that stop before the finish."""
    out = []
    err = lambda msg: out.append({'sev': 'error', 'check': 'song', 'msg': msg})  # noqa: E731
    warn = lambda msg: out.append({'sev': 'warn', 'check': 'song', 'msg': msg})  # noqa: E731
    sid = lvl.get('song')
    if not sid:
        return [{'sev': 'error', 'check': 'song', 'msg': 'theme.song is missing'}]
    song = audio['songs'].get(sid)
    if not song:
        return [{'sev': 'error', 'check': 'song', 'msg': "theme.song '%s' is not in audio.js SONGS (the level would play the 'home' song). Known: %s" % (sid, ', '.join(audio['songs']))}]
    secs = sorted(song['sections'], key=lambda s: s[0])
    if not secs:
        return [{'sev': 'error', 'check': 'song', 'msg': "song '%s' has no sections" % sid}]
    if secs[0][0] != 0:
        err("song '%s': first section starts at bar %d, not 0 (no music before it)" % (sid, secs[0][0]))
    for a, b in zip(secs, secs[1:]):
        if b[0] > a[1]:
            err("song '%s': no section covers bars %d-%d (silence)" % (sid, a[1], b[0]))
        elif b[0] < a[1]:
            warn("song '%s': sections overlap at bars %d-%d (the first one wins)" % (sid, b[0], a[1]))
    for a, b, cfg in secs:
        if cfg['end']:
            continue
        if cfg['prog'] not in audio['prog']:
            err("song '%s' bars %d-%d: progression '%s' is not in PROG" % (sid, a, b, cfg['prog']))
        else:
            for ch in audio['prog'][cfg['prog']]:
                if ch not in audio['chords']:
                    err("progression '%s' uses chord '%s' which is not in CH" % (cfg['prog'], ch))
        if cfg['lead'] and cfg['lead'] not in audio['mel']:
            err("song '%s' bars %d-%d: lead '%s' is not in MEL" % (sid, a, b, cfg['lead']))
    if song['end_chord'] and song['end_chord'] not in audio['chords']:
        err("song '%s': endChord '%s' is not in CH" % (sid, song['end_chord']))
    # coverage: 1 bar = 16 steps = 4 beats; the level clock is Physics.timeAt(x) (speed zones included)
    bar_s = 240.0 / audio['bpm']
    finish_bar = lvl['finishTime'] / bar_s
    music = [s for s in secs if not s[2]['end']]
    ends = [s for s in secs if s[2]['end']]
    music_end = max(s[1] for s in music) if music else 0
    if not ends:
        warn("song '%s' has no end section (no closing chord at the finish)" % sid)
    if finish_bar > music_end + 1.0:
        err("song '%s' stops at bar %d but the finish is at bar %.1f (x=%s): %.0f s without music" % (sid, music_end, finish_bar, _fmt(lvl['finishX']), (finish_bar - music_end) * bar_s))
    elif music_end - finish_bar > 3.0:
        warn("song '%s' plays until bar %d but the finish is at bar %.1f (x=%s): the last %.1f bars are never heard" % (sid, music_end, finish_bar, _fmt(lvl['finishX']), music_end - finish_bar))
    lvl['song_info'] = {'finish_bar': round(finish_bar, 2), 'music_end': music_end, 'end_sections': [s[0] for s in ends]}
    return out


def _fmt(x):
    return ('%d' % x) if abs(x - round(x)) < 1e-9 else ('%.1f' % x)


def css_diff_rules():
    css = _read('css/style.css')
    return set(int(n) for n in re.findall(r'\.lvl\.d(\d+)\b', css)), set(int(n) for n in re.findall(r'\.diff\.d(\d+)\b', css))


def field_styles_handled():
    """The style names R.drawField in js/render.js has a case for."""
    body = _block(_read('js/render.js'), r'R\.drawField = function', r'\n  \};')
    return set(re.findall(r"style === '(\w+)'", body))


def defs_issues(report, wanted):
    """LEVELS entry checks. Returns (per level id -> issues, global issues)."""
    per, glob = {}, []
    defs = report['defs']
    lvl_rules, diff_rules = css_diff_rules()
    nums = [d['num'] for d in defs]
    if sorted(nums) != list(range(1, len(defs) + 1)) or len(set(nums)) != len(nums):
        dup = sorted(set(n for n in nums if nums.count(n) > 1))
        msg = 'LEVELS nums are not 1..%d without repeats: %s' % (len(defs), nums)
        if dup:
            msg += ' (repeated: %s)' % dup
        glob.append({'sev': 'error', 'check': 'levels', 'msg': msg})
    for d in defs:
        if d['id'] not in wanted:
            continue
        out = per.setdefault(d['id'], [])
        for f in REQUIRED_FIELDS:
            if f == 'build':
                ok = d['hasBuild']
            elif f == 'theme':
                ok = d['hasTheme']
            else:
                ok = d.get(f) not in (None, '')
            if not ok:
                out.append({'sev': 'error', 'check': 'levels', 'msg': "LEVELS entry has no '%s'" % f})
        for k in d['keys']:
            if k not in REQUIRED_FIELDS and k not in OPTIONAL_FIELDS:
                out.append({'sev': 'warn', 'check': 'levels', 'msg': "LEVELS entry has an unknown field '%s' (typo? known: %s)" % (k, ', '.join(REQUIRED_FIELDS + OPTIONAL_FIELDS))})
        diff = d.get('difficulty')
        if isinstance(diff, int):
            # difficulty 1 is the base look (blue number, green label): css only has rules for 2 and up
            if diff > 1 and diff not in lvl_rules:
                out.append({'sev': 'error', 'check': 'levels', 'msg': 'difficulty %d has no `.lvl.d%d` rule in css/style.css (the level card would look like difficulty 1)' % (diff, diff)})
            if diff > 1 and diff not in diff_rules:
                out.append({'sev': 'warn', 'check': 'levels', 'msg': 'difficulty %d has no `.diff.d%d` rule in css/style.css (the difficulty label keeps the difficulty 1 colour)' % (diff, diff)})
            if diff < 1:
                out.append({'sev': 'error', 'check': 'levels', 'msg': 'difficulty %r must be a whole number >= 1' % diff})
        elif diff is not None:
            out.append({'sev': 'error', 'check': 'levels', 'msg': 'difficulty %r must be a whole number' % (diff,)})
        if d.get('reward') is not None and not isinstance(d['reward'], (int, float)):
            out.append({'sev': 'error', 'check': 'levels', 'msg': 'reward %r must be a number' % (d['reward'],)})
    return per, glob


def _analyse(report, wanted):
    """Turn everything the page found, plus the Python-side checks, into report['levels'][i]['issues']."""
    audio = parse_audio()
    field_ok = field_styles_handled()
    per_defs, glob = defs_issues(report, wanted)
    report['global'] = glob + [{'sev': 'error', 'check': 'console', 'msg': '%s: %s%s' % (c['kind'], c['msg'], ' (x%d)' % c['count'] if c['count'] > 1 else '')} for c in report['global']]
    for lvl in report['levels']:
        issues = list(per_defs.get(lvl['id'], []))
        issues += lvl.get('theme', [])
        # the music
        if 'finishTime' in lvl:
            issues += song_issues(lvl, audio)
        # exceptions while drawing
        for e in lvl.get('exceptions', []):
            where = 'x=%s' % _fmt(e['first']) if e['first'] == e['last'] else 'x=%s..%s' % (_fmt(e['first']), _fmt(e['last']))
            top = ' at ' + ' < '.join(e['frames']) if e['frames'] else ''
            issues.append({'sev': 'error', 'check': 'render', 'msg': '%s: %s (%s, %d frame%s, %s)%s' % (e.get('name', 'Error'), e['msg'], where, e['count'], '' if e['count'] == 1 else 's', e.get('where', ''), top)})
        # style names the renderer has no case for
        for m in lvl.get('misses', []):
            if m['name'] in ('undefined', 'null') and m['kind'] == 'ground':
                continue  # a missing theme.ground value: reported by the theme check
            issues.append({'sev': m['sev'], 'check': 'style', 'msg': "%s '%s' %s (first drawn at x=%s, %d time%s)" % (m['kind'], m['name'], m['what'], _fmt(m['x']), m['count'], '' if m['count'] == 1 else 's')})
        # field styles have no default branch, so read them from render.js
        theme_field = lvl.get('field_styles')
        if theme_field:
            bad = sorted(s for s in theme_field if s not in field_ok)
            if bad:
                issues.append({'sev': 'warn', 'check': 'style', 'msg': "field style%s '%s' %s no case in drawField, so nothing is drawn for %s" % ('s' if len(bad) > 1 else '', "', '".join(bad), 'have' if len(bad) > 1 else 'has', 'them' if len(bad) > 1 else 'it')})
        for c in lvl.get('console', []):
            issues.append({'sev': 'error', 'check': 'console', 'msg': '%s: %s%s' % (c['kind'], c['msg'], ' (x%d)' % c['count'] if c['count'] > 1 else '')})
        lvl['issues'] = issues
    return report


def all_ok(report):
    """True when there are no errors (warnings don't count)."""
    if any(i['sev'] == 'error' for i in report['global']):
        return False
    return not any(i['sev'] == 'error' for lvl in report['levels'] for i in lvl['issues'])


# ---------------------------------------------------------------------------------------------------------------
# output
# ---------------------------------------------------------------------------------------------------------------
def format_report(report):
    lines = []
    errors = warnings = 0
    for i in report['global']:
        errors += i['sev'] == 'error'
        warnings += i['sev'] == 'warn'
        lines.append('%s %s: %s' % (i['sev'].upper().ljust(5), i['check'], i['msg']))
    if report['global']:
        lines.append('')
    for lvl in report['levels']:
        lines.append('Level %s: %s (%s) - %d frames, %.1f s' % (lvl.get('num'), lvl['name'], lvl['id'], lvl.get('frames', 0), lvl.get('ms', 0) / 1000.0))
        order = {'error': 0, 'warn': 1}
        for i in sorted(lvl['issues'], key=lambda i: order[i['sev']]):
            errors += i['sev'] == 'error'
            warnings += i['sev'] == 'warn'
            lines.append('  %s %s: %s' % (i['sev'].upper().ljust(5), i['check'], i['msg']))
        if not lvl['issues']:
            lines.append('  ok')
        lines.append('')
    if report.get('dropped'):
        lines.append('(debug: dropped theme keys %s)' % ', '.join(report['dropped']))
    summary = '%d level(s): ' % len(report['levels'])
    summary += 'no problems' if not errors and not warnings else '%d error(s), %d warning(s)' % (errors, warnings)
    lines.append(summary)
    return '\n'.join(lines), errors == 0


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='Lint VippeDash levels: theme, unknown styles, LEVELS entry, music and a render smoke test (runs tools/lint.html headlessly).')
    ap.add_argument('levels', nargs='*', help='level ids to check, e.g. chess metro (default: all levels)')
    ap.add_argument('--step', type=int, default=10, help='draw a frame every STEP blocks (default 10; the screen shows 27 blocks and objects are drawn from 30 blocks away, so every object is still drawn several times; 5 is twice as slow)')
    ap.add_argument('--scale', type=float, default=0.5, help='pixel scale of the offscreen canvas (default 0.5 = 640x360 pixels for the 1280x720 scene, about 2x faster; 1 = full size)')
    ap.add_argument('--drop', action='append', metavar='LEVEL.MAP.KEY', help='debug: delete theme.MAP.KEY of a level before checking, e.g. chess.ground.board (to see that a check fires)')
    ap.add_argument('--json', action='store_true', help='print the raw JSON report instead of the plain-text one')
    a = ap.parse_args()

    t0 = time.perf_counter()
    report = run(a.levels or None, step=a.step, drop=a.drop, scale=a.scale)
    elapsed = time.perf_counter() - t0

    if a.json:
        print(json.dumps(report, indent=2))
        sys.exit(0 if all_ok(report) else 1)

    text, ok = format_report(report)
    print(text)
    print('Total %.1f s' % elapsed)
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
