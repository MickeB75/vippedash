// VippeDash — level verification bot.
// Depth-first search over "hold / release" decisions using the real physics, with memoisation.
// Used by tools/verify.html (proves every checkpoint segment is beatable) and by the debug autoplay.
(function () {
  const VD = (window.VD = window.VD || {});
  const P = VD.PHYS, Ph = VD.Physics;

  function key(s, n) {
    return (
      n + '|' + Math.round(s.y * 64) + '|' + Math.round(s.vy * 8) + '|' + s.mode + s.gdir + (s.grounded ? 1 : 0) +
      (s.held ? 1 : 0) + (s.pressAge <= P.BUFFER ? 1 : 0) + '|' + s.lastOrb + '|' + s.lastPad + '|' + s.lastPortal + '|' + s.layer +
      // *64 (not a coarser bucket): laneP's reachable values are a fixed step sequence (dt / P.LANE_RATE
      // per physics step) that crosses the P.LANE_HIT safety threshold (0.4/0.6) between two adjacent
      // steps; a coarser bucket (e.g. *8) can round values from opposite sides of that threshold into the
      // same key, so the search wrongly treats a still-unsafe state as equivalent to a safe one (or vice
      // versa) and prunes a winning branch as "already visited"
      '|' + s.lane + '|' + Math.round(s.laneP * 64)
    );
  }

  // Returns { ok, path (array of booleans, one per decision), K, nodes, maxX }
  function solve(lvl, start, targetX, opts = {}) {
    const K = opts.k || 4;
    const maxNodes = opts.maxNodes || 600000;
    const prefer = opts.prefer || [false, true];
    const visited = new Set();
    const path = [];
    let nodes = 0, maxX = start.x;
    const stack = [{ s: start, n: 0, i: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.i >= 2) {
        stack.pop();
        path.pop();
        continue;
      }
      const h = prefer[top.i++];
      const t = Ph.clone(top.s);
      let dead = false;
      for (let k = 0; k < K; k++) {
        Ph.step(t, h, lvl, null);
        if (t.dead) {
          dead = true;
          break;
        }
        if (t.x >= targetX) break;
      }
      if (t.x > maxX) maxX = t.x;
      if (dead) continue;
      if (t.x >= targetX) {
        path.push(h);
        return { ok: true, path, K, nodes, maxX };
      }
      const kk = key(t, top.n + 1);
      if (visited.has(kk)) continue;
      visited.add(kk);
      if (++nodes > maxNodes) return { ok: false, reason: 'node limit', nodes, maxX };
      path.push(h);
      stack.push({ s: t, n: top.n + 1, i: 0 });
    }
    return { ok: false, reason: 'no path', nodes, maxX };
  }
  // path[d] is the choice made at depth d; when the root frame is exhausted its pop() on [] is a no-op.

  // simulate a decision list; returns final state
  function replay(lvl, start, path, K, upToDecision) {
    const s = Ph.clone(start);
    const n = upToDecision == null ? path.length : upToDecision;
    for (let d = 0; d < n; d++) {
      for (let k = 0; k < K; k++) {
        Ph.step(s, path[d], lvl, null);
        if (s.dead) return s;
      }
    }
    return s;
  }

  // For every press in the solution, how far can it be shifted earlier/later and still be survivable?
  function analyze(lvl, start, targetX, sol, opts = {}) {
    const K = sol.K, maxShift = opts.maxShift || 10;
    const path = sol.path;
    const out = [];
    for (let i = 0; i < path.length; i++) {
      if (!path[i] || (i > 0 && path[i - 1])) continue;
      const feasible = (d) => {
        const forced = path.slice(0, i);
        if (d < 0) {
          for (let j = i + d; j <= i; j++) forced[j] = true;
          forced.length = i + 1;
        } else {
          for (let j = 0; j < d; j++) forced.push(false);
          forced.push(true);
        }
        const st = replay(lvl, start, forced, K);
        if (st.dead) return false;
        if (st.x >= targetX) return true;
        return solve(lvl, st, targetX, { k: K, maxNodes: 150000 }).ok;
      };
      let lo = 0, hi = 0;
      for (let d = 1; d <= maxShift; d++) {
        if (i - d < 0) break;
        if (feasible(-d)) lo = d;
        else break;
      }
      for (let d = 1; d <= maxShift; d++) {
        if (feasible(d)) hi = d;
        else break;
      }
      const x = replay(lvl, start, path, K, i).x;
      out.push({ x: +x.toFixed(1), early: lo, late: hi, ms: Math.round((lo + hi + 1) * K * P.DT * 1000), capped: lo === maxShift || hi === maxShift });
    }
    return out;
  }

  // Verify each checkpoint segment and (optionally) the whole level in one go.
  function verifyAll(lvl, opts = {}) {
    const cps = lvl.checkpoints;
    const report = [];
    for (let i = 0; i < cps.length; i++) {
      const start = Ph.spawn(cps[i]);
      const target = i + 1 < cps.length ? cps[i + 1].x + 2 : lvl.finishX + 1;
      const t0 = performance.now();
      const res = solve(lvl, start, target, { k: opts.k || 4 });
      const row = { cp: i, from: cps[i].x, to: target, ok: res.ok, nodes: res.nodes, maxX: +res.maxX.toFixed(1), ms: Math.round(performance.now() - t0) };
      const hasShip = start.mode === 'ship' || lvl.objs.some((o) => o.t === 'portal' && o.mode === 'ship' && o.x >= cps[i].x && o.x < target);
      row.ship = hasShip;
      if (hasShip && res.ok) {
        // clearance check: a ship this much taller must still fit through every gap
        const h = P.SHIP_H;
        P.SHIP_H = opts.fatShip || 1.2;
        const fat = Ph.spawn(cps[i]);
        if (fat.mode === 'ship') fat.y -= (P.SHIP_H - h) / 2;
        row.fatOk = solve(lvl, fat, target, { k: 4, maxNodes: 800000 }).ok;
        P.SHIP_H = h;
      } else if (res.ok && opts.windows) {
        const w = analyze(lvl, start, target, res, { maxShift: opts.maxShift || 8 });
        row.windows = w;
        row.minWindow = w.length ? Math.min.apply(null, w.map((q) => q.ms)) : null;
      }
      report.push(row);
    }
    return report;
  }

  VD.Solver = { solve, replay, analyze, verifyAll };
})();
