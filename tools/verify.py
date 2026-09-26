"""Check that every VippeDash level is beatable, from the command line.

Runs tools/verify.html in headless Chrome (via headless.dump_dom) and prints a compact report.

    python tools/verify.py                  # all levels
    python tools/verify.py forest           # one level
    python tools/verify.py forest metro     # a few levels
    python tools/verify.py --windows        # also measure timing slack (slower)
    python tools/verify.py --json           # print the raw JSON report instead

Exit code is 0 when every checkpoint segment and every full run is beatable, 1 otherwise.
A tight ship clearance or a narrow timing window is printed as a warning but doesn't fail the run.

Other scripts can reuse the checker directly:

    from verify import run, all_ok
    report = run(['forest'], windows=True)
    ok = all_ok(report)
"""
import argparse
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from headless import dump_dom  # noqa: E402

REPORT_RE = re.compile(r'<script type="application/json" id="report">(.*?)</script>', re.S)

TIGHT_MS = 50   # matches verify.html's thresholds
WARN_MS = 90


def run(level_ids=None, windows=False, budget_ms=300000):
    """Run the verifier and return the parsed JSON report (see tools/verify.html)."""
    params = []
    if level_ids:
        params.append('level=' + ','.join(level_ids))
    if windows:
        params.append('windows')
    query = ('?' + '&'.join(params)) if params else ''
    html = dump_dom('tools/verify.html' + query, budget_ms=budget_ms)
    m = REPORT_RE.search(html)
    if not m:
        raise SystemExit('verify.html did not produce a report (Chrome output was:\n' + html[:2000] + ')')
    return json.loads(m.group(1))


def all_ok(report):
    """True when every checkpoint segment and every full run in the report is beatable."""
    for lvl in report['levels']:
        if not lvl['full']['ok']:
            return False
        if any(not r['ok'] for r in lvl['rows']):
            return False
    return True


def _tightest(row):
    """(ms, x) of the tightest timing window in a row, or (None, None) if not measured."""
    if not row.get('windows'):
        return None, None
    w = min(row['windows'], key=lambda w: w['ms'])
    return w['ms'], w['x']


def format_report(report):
    """Render the parsed JSON report as the compact plain-text report (see module docstring)."""
    lines = []
    windows = report.get('windows', False)
    seg_fails = 0
    full_fails = 0
    tight_ships = 0
    narrow_windows = 0
    total_segments = 0

    for lvl in report['levels']:
        lines.append('Level %d: %s (%d checkpoints, %.1f s)' % (lvl['num'], lvl['name'], lvl['checkpoints'], lvl['seconds']))
        for r in lvl['rows']:
            total_segments += 1
            left = '  cp%d %s->%s' % (r['cp'], r['from'], r['to'])
            if not r['ok']:
                seg_fails += 1
                lines.append('%s: FAIL (furthest x=%s)' % (left, r['maxX']))
                continue
            line = '%s: ok' % left
            if r.get('ship'):
                if r['fatOk']:
                    line += '  ship clearance ok'
                else:
                    tight_ships += 1
                    line += '  ship clearance TIGHT'
            elif windows and r.get('windows'):
                ms, x = _tightest(r)
                mark = ''
                if ms < TIGHT_MS:
                    mark = ' !!'
                    narrow_windows += 1
                elif ms < WARN_MS:
                    mark = ' !'
                    narrow_windows += 1
                line += '  tightest press %d ms @ x=%s%s' % (ms, x, mark)
            lines.append(line)
        full = lvl['full']
        if full['ok']:
            lines.append('  full run: beatable (%d nodes)' % full['nodes'])
        else:
            full_fails += 1
            lines.append('  full run: NOT beatable (%s, furthest x=%s) (%d nodes)' % (full['reason'], full['maxX'], full['nodes']))
        lines.append('')

    ok_all = seg_fails == 0 and full_fails == 0
    summary = '%d level(s), %d segment(s): ' % (len(report['levels']), total_segments)
    summary += 'all beatable' if ok_all else '%d segment failure(s), %d full-run failure(s)' % (seg_fails, full_fails)
    extras = []
    if tight_ships:
        extras.append('%d tight ship clearance(s)' % tight_ships)
    if narrow_windows:
        extras.append('%d narrow window(s)' % narrow_windows)
    if extras:
        summary += ' (' + ', '.join(extras) + ')'
    lines.append(summary)
    return '\n'.join(lines), ok_all


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description='Check that VippeDash levels are beatable (runs tools/verify.html headlessly).')
    ap.add_argument('levels', nargs='*', help='level ids to check, e.g. forest metro (default: all levels)')
    ap.add_argument('--windows', action='store_true', help='also measure timing slack for every jump (slower)')
    ap.add_argument('--json', action='store_true', help='print the raw JSON report instead of the plain-text one')
    a = ap.parse_args()

    t0 = time.perf_counter()
    report = run(a.levels or None, windows=a.windows)
    elapsed = time.perf_counter() - t0

    if a.json:
        print(json.dumps(report, indent=2))
        sys.exit(0 if all_ok(report) else 1)

    text, ok_all = format_report(report)
    print(text)
    print('Total %.1f s' % elapsed)
    sys.exit(0 if ok_all else 1)


if __name__ == '__main__':
    main()
