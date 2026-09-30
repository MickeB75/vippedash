"""Check that every VippeDash level is beatable, from the command line.

Runs tools/verify.html in headless Chrome (via headless.dump_dom) and prints a compact report.

    python tools/verify.py                  # all levels
    python tools/verify.py forest           # one level
    python tools/verify.py forest metro     # a few levels
    python tools/verify.py --windows        # also measure timing slack (slower)
    python tools/verify.py --json           # print the raw JSON report instead

Tuning a level against a difficulty target (implies --windows, ship segments are skipped):

    python tools/verify.py chess --target 83
        # per segment one line: press count, min (with its x) / median / max ms, number of TIGHT presses and
        # "LOOSE segment" when even its tightest press is well above the target; below it indented lines
        # (x and ms) for just the TIGHT presses; ends with a summary naming the loose segments
    python tools/verify.py chess --target 83 --loose 117   # LOOSE segment from a tightest press of 117 ms (default: target + 40)
    python tools/verify.py chess --target 83 --all         # list every press, sorted on x, marked ok/TIGHT

Window sizes are multiples of one physics step (67, 83, 100, 117, 133, 150 ... ms), so a press is TIGHT when
ms < target - 8 (half a step of tolerance): with --target 83 an 83 ms press is ok and 67 ms is TIGHT.
Looseness is judged per segment, not per press: a segment is a LOOSE segment (too easy for the target) when its
tightest press is >= the --loose limit (default target + 40, i.e. 123 ms at target 83). The analysis stops
shifting at 8 steps, so 150 ms is the ceiling for a press with lots of slack, and that is what most presses show.

Proving that other levels are untouched (save a baseline, change something, compare):

    python tools/verify.py --save base.json                # all levels, --windows is implied
    python tools/verify.py --compare base.json             # prints only the segments that differ
    python tools/verify.py forest --compare base.json      # compare one level (others in the file are ignored)

--compare re-runs (with windows when the saved report has them) and lists, per level, the segments whose
ok status, tightest ms, number of windows or ship clearance changed, plus a changed full-run result,
then "N level(s) unchanged". --save writes the raw JSON report (same as --json) and can be combined
with anything.

Exit code is 0 when every checkpoint segment and every full run is beatable, 1 otherwise
(with --compare it reflects the new run only, not whether it differs from the saved report).
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
import statistics
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


TARGET_TOL = 8      # ms; window sizes are multiples of one physics step (~16.7 ms), so half a step of tolerance
LOOSE_MARGIN = 40   # default --loose is target + this


def classify(ms, target):
    """'TIGHT' or 'ok' for one press window of ms milliseconds (looseness is judged per segment)."""
    return 'TIGHT' if ms < target - TARGET_TOL else 'ok'


def _num(v):
    return '%g' % v


def format_target(report, target, loose=None, show_all=False):
    """Render every non-ship segment against a difficulty target; returns (text, ok_all).

    A press is TIGHT when its window is under the target. A segment is a LOOSE segment (too easy) when its
    tightest press is at least `loose` ms.
    """
    if loose is None:
        loose = target + LOOSE_MARGIN
    lines = ['Target %s ms (press TIGHT < %s ms; LOOSE segment when its tightest press >= %s ms)' % (
        _num(target), _num(target - TARGET_TOL), _num(loose)), '']
    multi = len(report['levels']) > 1
    seg_fails = full_fails = n_tight = n_presses = 0
    loose_segs = []
    for lvl in report['levels']:
        lines.append('Level %d: %s' % (lvl['num'], lvl['name']))
        for r in lvl['rows']:
            left = '  cp%d %s->%s' % (r['cp'], r['from'], r['to'])
            if not r['ok']:
                seg_fails += 1
                lines.append('%s: FAIL (furthest x=%s)' % (left, r['maxX']))
                continue
            if r.get('ship'):
                lines.append('%s: ship segment (skipped)' % left)
                continue
            ws = sorted(r.get('windows') or [], key=lambda w: w['x'])
            if not ws:
                lines.append('%s: no presses' % left)
                continue
            marks = [classify(w['ms'], target) for w in ws]
            lo = min(ws, key=lambda w: w['ms'])
            is_loose = lo['ms'] >= loose
            n_presses += len(ws)
            n_tight += marks.count('TIGHT')
            if is_loose:
                loose_segs.append(('%s ' % lvl['id'] if multi else '') + 'cp%d' % r['cp'])
            lines.append('%s: %d presses  min %d @ x=%s  median %s  max %d  |  %d tight%s' % (
                left, len(ws), lo['ms'], lo['x'], _num(statistics.median(w['ms'] for w in ws)),
                max(w['ms'] for w in ws), marks.count('TIGHT'), '  |  LOOSE segment' if is_loose else ''))
            for w, m in zip(ws, marks):
                if show_all or m == 'TIGHT':
                    lines.append('      x=%-7s %4d ms  %s' % (w['x'], w['ms'], m))
        full = lvl['full']
        if not full['ok']:
            full_fails += 1
            lines.append('  full run: NOT beatable (%s, furthest x=%s)' % (full['reason'], full['maxX']))
        lines.append('')
    summary = '%d press(es): %d tight; %d loose segment(s)' % (n_presses, n_tight, len(loose_segs))
    if loose_segs:
        summary += ' (' + ', '.join(loose_segs) + ')'
    lines.append(summary)
    if seg_fails or full_fails:
        lines.append('%d segment failure(s), %d full-run failure(s)' % (seg_fails, full_fails))
    return '\n'.join(lines), seg_fails == 0 and full_fails == 0


def _row_sig(row):
    """The comparable facts of one segment row."""
    ms, _ = _tightest(row)
    return {
        'ok': row['ok'],
        'tightest': ms,
        'windows': len(row['windows']) if row.get('windows') is not None else None,
        'fatOk': row.get('fatOk'),
    }


def compare_reports(old, new):
    """Compare two parsed reports; returns (text, unchanged_level_count).

    Only levels present in both reports are compared; segments are matched on their cp number.
    """
    old_levels = {l['id']: l for l in old['levels']}
    lines = []
    unchanged = 0
    for lvl in new['levels']:
        o = old_levels.get(lvl['id'])
        if o is None:
            lines.append('Level %d: %s: not in the saved report (skipped)' % (lvl['num'], lvl['name']))
            continue
        diffs = []
        old_rows = {r['cp']: r for r in o['rows']}
        new_rows = {r['cp']: r for r in lvl['rows']}
        for cp in sorted(set(old_rows) | set(new_rows)):
            a, b = old_rows.get(cp), new_rows.get(cp)
            if a is None or b is None:
                r = b or a
                diffs.append('  cp%d %s->%s: segment %s' % (cp, r['from'], r['to'], 'added' if a is None else 'removed'))
                continue
            sa, sb = _row_sig(a), _row_sig(b)
            parts = []
            if sa['ok'] != sb['ok']:
                parts.append('ok %s -> %s' % (sa['ok'], sb['ok']))
            if sa['tightest'] != sb['tightest']:
                parts.append('tightest %s -> %s ms' % (sa['tightest'], sb['tightest']))
            if sa['windows'] != sb['windows']:
                parts.append('windows %s -> %s' % (sa['windows'], sb['windows']))
            if sa['fatOk'] != sb['fatOk']:
                parts.append('ship clearance ok %s -> %s' % (sa['fatOk'], sb['fatOk']))
            if parts:
                diffs.append('  cp%d %s->%s: %s' % (cp, b['from'], b['to'], '; '.join(parts)))
        if o['full']['ok'] != lvl['full']['ok']:
            diffs.append('  full run: ok %s -> %s' % (o['full']['ok'], lvl['full']['ok']))
        if diffs:
            lines.append('Level %d: %s' % (lvl['num'], lvl['name']))
            lines.extend(diffs)
        else:
            unchanged += 1
    lines.append('%d level(s) unchanged' % unchanged)
    return '\n'.join(lines), unchanged


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
    ap.add_argument('--target', type=float, metavar='MS', help='judge the timing windows against this target (implies --windows): TIGHT presses are below it, a LOOSE segment has no press near it')
    ap.add_argument('--loose', type=float, metavar='MS', help='with --target: a segment whose tightest press is at least this many ms is a LOOSE segment (default: target + %d)' % LOOSE_MARGIN)
    ap.add_argument('--all', action='store_true', help='with --target: list every press (ok/TIGHT), not just the TIGHT ones')
    ap.add_argument('--save', metavar='FILE', help='also write the raw JSON report to FILE (implies --windows)')
    ap.add_argument('--compare', metavar='FILE', help='re-run and print only the segments that differ from the report saved in FILE')
    a = ap.parse_args()
    if (a.loose is not None or a.all) and a.target is None:
        ap.error('--loose and --all need --target')

    old = None
    if a.compare:
        try:
            with open(a.compare, encoding='utf-8') as f:
                old = json.load(f)
        except (OSError, ValueError) as e:
            ap.error('cannot read %s: %s' % (a.compare, e))
    windows = a.windows or a.target is not None or bool(a.save) or bool(old and old.get('windows'))

    t0 = time.perf_counter()
    report = run(a.levels or None, windows=windows)
    elapsed = time.perf_counter() - t0

    if a.save:
        with open(a.save, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)

    if old is not None:
        text, _ = compare_reports(old, report)
        print(text)
        print('Total %.1f s' % elapsed)
        sys.exit(0 if all_ok(report) else 1)

    if a.target is not None and not a.json:
        text, ok_all = format_target(report, a.target, a.loose, a.all)
        print(text)
        print('Total %.1f s' % elapsed)
        sys.exit(0 if ok_all else 1)

    if a.json:
        print(json.dumps(report, indent=2))
        sys.exit(0 if all_ok(report) else 1)

    text, ok_all = format_report(report)
    print(text)
    print('Total %.1f s' % elapsed)
    sys.exit(0 if ok_all else 1)


if __name__ == '__main__':
    main()
