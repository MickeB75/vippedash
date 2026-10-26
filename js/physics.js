// VippeDash — deterministic fixed-step physics (units: blocks, seconds; y is up, ground at y = 0)
(function () {
  const VD = (window.VD = window.VD || {});

  const BEAT = 60 / 156; // seconds per beat (156 BPM), used by moveOf's periodic movement types

  const P = {
    SPEED: 10.4, // blocks / second (156 BPM -> exactly 4 blocks per beat)
    DT: 1 / 240,
    G: 90,
    JUMP_V: 20,
    MAX_FALL: 24,
    PAD_V: { yellow: 27.5, pink: 16 },
    ORB_V: { yellow: 20.5, pink: 15 },
    SHIP_UP: 44,
    SHIP_DOWN: 38,
    SHIP_VUP: 8.5,
    SHIP_VDOWN: 9.5,
    SHIP_H: 0.7,
    BALL_G: 72,
    BALL_VMAX: 20,
    BALL_FLIP_V: 3.5,
    LAND_TOL: 0.2, // how far below a platform top you can be and still snap onto it
    BUFFER: 0.09, // a fresh press stays "live" this long (orbs, landing jumps)
    INSET: 0.06, // player hitbox inset against hazards
    ORB_R: 0.6,
    LANE_RATE: 0.16, // seconds for a full lane switch (laneP 0 -> 1 or back)
    LANE_HIT: 0.4, // an object with a `lane` only interacts within this much of |laneP - lane|
  };
  VD.PHYS = P;

  function boxH(s) {
    return s.mode === 'ship' ? P.SHIP_H : 1;
  }

  // Shared scratch object returned by moveOf — read it right away and never keep a reference,
  // so the bot's hot loop (millions of steps) allocates nothing.
  const MV = { dx: 0, dy: 0, a: 0, k: 0, vy: 0 };

  // The player's x-based "level clock" offset/state of a moving hazard, at player position x.
  // mv.type: 'bob' (sine bob), 'pop' (jack-in-the-box), 'drop' (falling/rising nun), 'swing' (pendulum),
  // 'leap' (a piranha jumping out of the river, see Builder.piranha()),
  // 'throw' (a pawn thrown by the level 4 king boss, see level.js Builder.pawn() — or, with mv.hx set, a
  // hazard/coin thrown by a stationary thrower standing at a fixed point, see Builder.lob()),
  // 'orbit' (Nöjesparken's Ferris-wheel gondolas, see Builder.wheel(): MV.dx/dy = the hanging point minus the
  // wheel's centre, MV.vy = its vertical speed in blocks/s) and 'roll' (a barrel rolling towards the player,
  // see Builder.barrel(): MV.dx = clamp(k * (mv.bx - x), -4, max), mv.bx = the barrel's own x, MV.a = the roll angle)
  // and 'dive' (Sjunde himlen's diving angels, see Builder.angel() — the angel flies in from the upper right and
  // swoops down to its lowest point at x = mv.bx, then climbs away behind the player; see the 'dive' case below).
  // `lvl` (optional) is only used for the beat clock (bob/pop/swing): when the level has speed zones,
  // moveOf needs the real elapsed time at x, not just x / P.SPEED (see timeAt below). step() passes it;
  // callers without a level clock nearby (or on a level with no speed zones) can omit it.
  function moveOf(o, x, lvl) {
    MV.dx = 0;
    MV.dy = 0;
    MV.a = 0;
    MV.k = 0;
    MV.vy = 0;
    const mv = o.mv;
    if (!mv) return MV;
    if (mv.type === 'drop') {
      // x, not the beat clock: how far the player has travelled since the trigger point
      let p = (x - (o.x - mv.trigger)) / mv.fall;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;
      MV.dy = -mv.dist * p * p;
      return MV;
    }
    if (mv.type === 'throw') {
      // x, not the beat clock: 0 at the trigger point, 1 once it's landed (o.x, o.y)
      let p = (x - (o.x - mv.trigger)) / mv.fall;
      if (p < 0) p = 0;
      else if (p > 1) p = 1;
      // the thrower's hand: mv.hx/mv.hy when it's a fixed point (Builder.lob()), otherwise the level 4
      // king's hand, always mv.ahead blocks ahead of the player at height mv.handY. The thrown object's
      // world position is the lerp from there to its landing spot, plus a parabolic arc in y.
      const handX = mv.hx != null ? mv.hx : x + mv.ahead;
      const handY = mv.hx != null ? mv.hy : mv.handY;
      MV.dx = (handX - o.x) * (1 - p);
      MV.dy = (handY - o.y) * (1 - p) + mv.arc * 4 * p * (1 - p);
      MV.k = p;
      return MV;
    }
    if (mv.type === 'dive') {
      // a diving angel (Builder.angel()): like the barrel it flies towards the player at mv.k blocks per block run
      // and meets the player exactly at its own x (mv.bx), but along a curve: from far up at the top right it
      // plunges steeply and levels out into a low swoop (dy = top * u^p, u = dx / max), and after the meeting it
      // pulls up and away behind the player. Everything is a function of x only, so physics and drawing agree.
      //   MV.dx / MV.dy  offset of the hitbox from its resting spot (bx, y) — the lowest point of the dive
      //   MV.a   body angle in radians: PI/2 = flying level to the left, > PI/2 = head down in the dive, < PI/2 =
      //          climbing away (heading + PI/2, i.e. 0 = upright, PI = head straight down)
      //   MV.k   0 = start of the dive (wings swept back) .. 0.5 = the swoop (wings spread) .. 1 = climbing away
      const dx0 = mv.k * (mv.bx - x);
      if (dx0 >= 0) {
        const u = (dx0 > mv.max ? mv.max : dx0) / mv.max;
        MV.dx = u * mv.max;
        MV.dy = mv.top * Math.pow(u, mv.p);
        // slope of the path (blocks down per block flown), the heading is atan(slope) below horizontal
        MV.a = Math.PI / 2 + Math.atan((mv.top * mv.p * Math.pow(u, mv.p - 1)) / mv.max);
        MV.k = 0.5 * (1 - u);
      } else {
        const w = (dx0 < -mv.out ? mv.out : -dx0) / mv.out; // 0..1 over the `out` blocks behind the player
        MV.dx = -w * mv.out;
        MV.dy = mv.rise * w * w;
        MV.a = Math.PI / 2 - Math.atan((2 * mv.rise * w) / mv.out);
        MV.k = 0.5 + 0.5 * w;
      }
      return MV;
    }
    if (mv.type === 'roll') {
      // a barrel rolling towards the player: x-based (not the beat clock), so it meets the player exactly at
      // its own x; once passed it keeps rolling away behind (down to -4)
      let dx = mv.k * (mv.bx - x);
      if (dx < -4) dx = -4;
      else if (dx > mv.max) dx = mv.max;
      MV.dx = dx;
      MV.a = -dx / 0.45;
      return MV;
    }
    const t = lvl ? timeAt(lvl, x) : x / P.SPEED;
    const u = t / (mv.beats * BEAT) + (mv.phase || 0);
    if (mv.type === 'bob') {
      MV.dy = mv.amp * Math.sin(2 * Math.PI * u);
      MV.vy = mv.amp * Math.cos(2 * Math.PI * u) * (2 * Math.PI) / (mv.beats * BEAT);
    } else if (mv.type === 'orbit') {
      // a Ferris-wheel gondola: its hanging point circles the wheel's centre counter-clockwise, one turn per
      // mv.beats beats (u already holds the gondola's own phase offset)
      const ang = 2 * Math.PI * u;
      MV.dx = mv.R * Math.cos(ang);
      MV.dy = mv.R * Math.sin(ang);
      MV.vy = mv.R * Math.cos(ang) * (2 * Math.PI) / (mv.beats * BEAT);
    } else if (mv.type === 'pop') {
      const f = u - Math.floor(u);
      const k = f < 0.08 ? f / 0.08 : f < 0.5 ? 1 : f < 0.65 ? 1 - (f - 0.5) / 0.15 : 0;
      MV.k = k;
      MV.dy = k * mv.rise;
    } else if (mv.type === 'swing') {
      const a = mv.amp * Math.sin(2 * Math.PI * u);
      MV.a = a;
      MV.dx = mv.len * Math.sin(a);
      MV.dy = mv.len * (1 - Math.cos(a));
    } else if (mv.type === 'leap') {
      // Amazonas' piranhas: a fish leaping straight up out of the water (Builder.piranha()). For the first
      // `air` of each period it flies a parabola (dy 0 -> rise -> 0, k = 0..1, a = nose-up then nose-down);
      // the rest of the time it hides under the surface (dy -2, k = -1: nothing to hit and nothing to draw).
      const f = u - Math.floor(u);
      if (f < mv.air) {
        const q = f / mv.air;
        MV.dy = mv.rise * 4 * q * (1 - q);
        MV.k = q;
        MV.a = (0.5 - q) * 2.2;
      } else {
        MV.dy = -2;
        MV.k = -1;
      }
    }
    return MV;
  }

  function spawn(cp) {
    return {
      x: cp.x,
      y: cp.y || 0,
      vy: 0,
      mode: cp.mode || 'cube',
      gdir: -1, // direction gravity pulls (-1 = down)
      ceil: cp.ceil == null ? null : cp.ceil,
      grounded: (cp.mode || 'cube') !== 'ship' && !cp.y,
      held: false,
      pressAge: 99,
      lastOrb: -1,
      lastPad: -1,
      lastPortal: -1,
      layer: cp.layer || 0, // 0 = the normal floor; +1 for every hole you've fallen through (level 2)
      lane: cp.lane || 0, // 'lane' mode (Stratusvägen): which lane (0 near, 1 far) the player is headed to
      laneP: cp.lane || 0, // 0..1 position between the lanes; follows `lane` at P.LANE_RATE
      dead: false,
      cause: null,
      dmg: null, // how much damage the last death dealt (null until a hazard/solid kills)
    };
  }

  function clone(s) {
    return {
      x: s.x, y: s.y, vy: s.vy, mode: s.mode, gdir: s.gdir, ceil: s.ceil, grounded: s.grounded,
      held: s.held, pressAge: s.pressAge, lastOrb: s.lastOrb, lastPad: s.lastPad,
      lastPortal: s.lastPortal, layer: s.layer, lane: s.lane, laneP: s.laneP,
      dead: s.dead, cause: s.cause, dmg: s.dmg,
    };
  }

  // ---- speed zones (Stratusvägen's 1.5x stretch; a no-op everywhere else) ----
  // lvl.speeds (always an array, empty by default — see level.js Builder.speed()/Level) holds
  // { x0, x1, mult } zones, sorted by x0 and non-overlapping. speedAt is the instant speed at x (the
  // change is a hard step at a zone's edges, which is fine at 240 Hz). timeAt is the level clock in
  // seconds at x — the integral of dx / speed — used everywhere x used to be divided by the constant
  // P.SPEED. It must return exactly x / P.SPEED when there are no zones (the fast path every other
  // level takes), and it's O(zones) with no allocation so it's safe to call every tick.
  function speedAt(lvl, x) {
    const zs = lvl && lvl.speeds;
    if (!zs || !zs.length) return P.SPEED;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (x >= z.x0 && x < z.x1) return P.SPEED * z.mult;
    }
    return P.SPEED;
  }

  function timeAt(lvl, x) {
    const zs = lvl && lvl.speeds;
    if (!zs || !zs.length) return x / P.SPEED;
    let t = 0, cx = 0;
    for (let i = 0; i < zs.length && cx < x; i++) {
      const z = zs[i];
      if (z.x1 <= cx) continue; // behind us already
      if (z.x0 > cx) {
        // a normal-speed gap before this zone
        const gapEnd = Math.min(z.x0, x);
        t += (gapEnd - cx) / P.SPEED;
        cx = gapEnd;
        if (cx >= x) break;
      }
      if (x > z.x0) {
        const segEnd = Math.min(z.x1, x);
        if (segEnd > cx) {
          t += (segEnd - cx) / (P.SPEED * z.mult);
          cx = segEnd;
        }
      }
    }
    if (x > cx) t += (x - cx) / P.SPEED;
    return t;
  }

  // ---- Sjunde himlen's low-gravity zones ----
  // lvl.gravs (always an array, empty by default — see level.js Builder.lowgrav()/Level) holds { x0, x1, g } zones,
  // sorted by x0. gravAt is the gravity multiplier at x: g inside a zone, exactly 1 everywhere else (and on every
  // level without zones, which takes the fast path). Only the cube mode feels it: gravity and the fall-speed cap
  // MAX_FALL are both multiplied by it, so a jump is longer, higher and floatier but can still be tuned by the bot.
  function gravAt(lvl, x) {
    const zs = lvl && lvl.gravs;
    if (!zs || !zs.length) return 1;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (x >= z.x0 && x < z.x1) return z.g;
    }
    return 1;
  }

  // ---- Amazonas' rapids (raft mode) ----
  // lvl.rapids (always an array, empty by default — see level.js Builder.rapids()/Level) holds
  // { x0, x1, amp, len, base } water zones. Inside one the surface is base + amp * sin(2 pi (x - x0) / len) * env,
  // where env ramps 0 -> 1 over the first 4 blocks and 1 -> 0 over the last 4; outside every zone it is 0.
  // rapidsAt fills RS with the height (h) and the slope (dh, blocks per block) and returns h. The raft mode
  // below rides this surface: its floor is the height at the middle of the player (x + RAFT_CX).
  const RS = { h: 0, dh: 0 };
  const RAMP = 4;
  function rapidsAt(lvl, x) {
    RS.h = 0;
    RS.dh = 0;
    const zs = lvl && lvl.rapids;
    if (!zs || !zs.length) return 0;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (x < z.x0 || x >= z.x1) continue;
      const d = x - z.x0, e = z.x1 - x, kk = (2 * Math.PI) / z.len;
      let env = 1, denv = 0;
      if (d < RAMP && d <= e) {
        env = d / RAMP;
        denv = 1 / RAMP;
      } else if (e < RAMP) {
        env = e / RAMP;
        denv = -1 / RAMP;
      }
      const sn = Math.sin(kk * d);
      RS.h = z.base + z.amp * sn * env;
      RS.dh = z.amp * (Math.cos(kk * d) * kk * env + sn * denv);
      return RS.h;
    }
    return 0;
  }
  function rapidsHeight(lvl, x) {
    return rapidsAt(lvl, x);
  }
  const RAFT_CX = 0.5;

  // ---- Nöjesparken's rails (cart mode) ----
  // lvl.tracks (always an array, empty by default — see level.js Builder.track()/Level) holds compiled rails:
  // { x0, x1, style, gaps, xs, hs, ms } where xs/hs are the knots and ms the slope (blocks per block) at each
  // knot. Between two knots the height is a cubic Hermite curve, so it is C1 and a run of knots on one straight
  // line is a straight ramp. trackAt fills TS with the height (h), the slope (dh) and the style, and returns
  // the height, or null where there is no rail (inside a gap, or outside every track). The cart mode rides
  // this surface the same way the raft rides the rapids: its floor is the height at the middle of the player.
  const TS = { h: 0, dh: 0, style: null };
  function trackAt(lvl, x) {
    const ts = lvl && lvl.tracks;
    if (!ts || !ts.length) return null;
    for (let i = 0; i < ts.length; i++) {
      const tr = ts[i];
      if (x < tr.x0 || x >= tr.x1) continue;
      TS.style = tr.style;
      const g = tr.gaps;
      for (let j = 0; j < g.length; j++) if (x >= g[j][0] && x < g[j][1]) return null;
      const xs = tr.xs, hs = tr.hs, ms = tr.ms;
      let lo = 0, hi = xs.length - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (xs[mid] <= x) lo = mid;
        else hi = mid - 1;
      }
      const w = xs[lo + 1] - xs[lo], t = (x - xs[lo]) / w, t2 = t * t, t3 = t2 * t;
      TS.h = (2 * t3 - 3 * t2 + 1) * hs[lo] + (t3 - 2 * t2 + t) * w * ms[lo] + (-2 * t3 + 3 * t2) * hs[lo + 1] + (t3 - t2) * w * ms[lo + 1];
      TS.dh = ((6 * t2 - 6 * t) * (hs[lo] - hs[lo + 1])) / w + (3 * t2 - 4 * t + 1) * ms[lo] + (3 * t2 - 2 * t) * ms[lo + 1];
      return TS.h;
    }
    return null;
  }
  function trackHeight(lvl, x) {
    return trackAt(lvl, x);
  }
  // 'flume' / 'coaster' if x lies inside a track (also over a gap), else null — render picks the vehicle with it
  function trackStyleAt(lvl, x) {
    const ts = lvl && lvl.tracks;
    if (ts) for (let i = 0; i < ts.length; i++) if (x >= ts[i].x0 && x < ts[i].x1) return ts[i].style;
    return null;
  }
  // slope (blocks per block) of the rail at x, 0 where there is none
  function trackSlope(lvl, x) {
    return trackAt(lvl, x) === null ? 0 : TS.dh;
  }

  function setMode(s, portal) {
    const oldH = boxH(s);
    s.mode = portal.mode;
    const newH = boxH(s);
    s.y += (oldH - newH) / 2;
    if (s.y < 0) s.y = 0;
    s.ceil = portal.ceil;
    s.gdir = portal.grav || -1;
    s.grounded = false;
    if (portal.mode === 'ship') s.vy *= 0.4;
    else s.vy *= 0.5;
    if (s.ceil != null && s.y + newH > s.ceil) s.y = s.ceil - newH;
  }

  // the hole (if any) under the middle of the player, on the layer the player is on
  function holeAt(lvl, s) {
    const cx = s.x + 0.5;
    for (const d of lvl.drops) if (d.layer === s.layer && cx >= d.x0 && cx < d.x1) return d;
    return null;
  }

  // Advance one fixed step. `held` = is the jump input down. `ev` (optional) receives event names.
  function step(s, held, lvl, ev) {
    const dt = P.DT;
    const freshPress = held && !s.held; // the raw press edge, used by 'lane' mode below
    if (freshPress) s.pressAge = 0;
    else s.pressAge += dt;
    s.held = held;
    let fresh = s.pressAge <= P.BUFFER;

    // ---- input + gravity ----
    if (s.mode === 'cube') {
      if (s.grounded && (held || fresh)) {
        // + s.vy: 0 on the floor and on static blocks, the gondola's own speed when standing on a moving one
        s.vy = -s.gdir * P.JUMP_V + s.vy;
        s.grounded = false;
        s.pressAge = 99;
        if (ev) ev.push('jump');
      }
      // gg = 1 except inside a low-gravity zone (Sjunde himlen); P.G * 1 and P.MAX_FALL * 1 are exact
      const gg = gravAt(lvl, s.x);
      s.vy += s.gdir * P.G * gg * dt;
      // cap falling speed only (never the upward launch from pads)
      const maxFall = P.MAX_FALL * gg;
      if (s.gdir < 0 ? s.vy < -maxFall : s.vy > maxFall) s.vy = s.gdir * maxFall;
    } else if (s.mode === 'ship') {
      const up = -s.gdir;
      s.vy += (held ? P.SHIP_UP : -P.SHIP_DOWN) * up * dt;
      if (s.vy > P.SHIP_VUP) s.vy = P.SHIP_VUP;
      else if (s.vy < -P.SHIP_VDOWN) s.vy = -P.SHIP_VDOWN;
    } else if (s.mode === 'raft' || s.mode === 'cart') {
      // Nöjesparken's 'cart' mode (log / roller-coaster car) behaves exactly like the raft below, except that
      // its floor is the rail (trackAt) instead of the rapids, and that a cart that is riding the rail is not
      // held to MAX_FALL (a steep dive is followed down; only a cart already in the air is capped).
      const ride = s.mode === 'cart' && s.grounded;
      // the raft: jumps like a cube, but its floor is the rapids' water surface (see rapidsAt). While it
      // rides the surface, s.vy is the surface's own vertical speed, so a jump (P.JUMP_V on top of it) off a
      // rising wave goes higher and off a falling one lower; when the surface falls away faster than gravity
      // can follow, the raft is thrown into the air.
      if (s.grounded && (held || fresh)) {
        s.vy = -s.gdir * P.JUMP_V + s.vy;
        s.grounded = false;
        s.pressAge = 99;
        if (ev) ev.push('jump');
      }
      s.vy += s.gdir * P.G * dt;
      if (!ride && (s.gdir < 0 ? s.vy < -P.MAX_FALL : s.vy > P.MAX_FALL)) s.vy = s.gdir * P.MAX_FALL;
    } else if (s.mode === 'lane') {
      // Stratusvägen's two-lane street: runs on the ground like cube (same gravity, no ceiling flip),
      // but a fresh press never jumps — it toggles which lane (0 near, 1 far) the player is headed to.
      // laneP eases towards it below at P.LANE_RATE, regardless of mode, so leaving lane mode just
      // freezes it in place (see the "lane easing" block after this if/else chain).
      if (freshPress) {
        s.lane = s.lane ? 0 : 1;
        if (ev) ev.push('lane');
      }
      s.vy += s.gdir * P.G * dt;
      if (s.gdir < 0 ? s.vy < -P.MAX_FALL : s.vy > P.MAX_FALL) s.vy = s.gdir * P.MAX_FALL;
    } else {
      // ball
      if (s.grounded && (fresh || held)) {
        s.gdir = -s.gdir;
        s.vy = s.gdir * P.BALL_FLIP_V;
        s.grounded = false;
        s.pressAge = 99;
        if (ev) ev.push('flip');
      }
      s.vy += s.gdir * P.BALL_G * dt;
      if (s.vy > P.BALL_VMAX) s.vy = P.BALL_VMAX;
      else if (s.vy < -P.BALL_VMAX) s.vy = -P.BALL_VMAX;
    }

    // laneP eases towards `lane` at a constant rate (a full switch takes P.LANE_RATE seconds); this runs
    // in every mode, but outside 'lane' mode `lane` never changes so laneP just sits at 0 — zero effect.
    if (s.laneP !== s.lane) {
      const laneStep = dt / P.LANE_RATE;
      if (s.laneP < s.lane) s.laneP = Math.min(s.lane, s.laneP + laneStep);
      else s.laneP = Math.max(s.lane, s.laneP - laneStep);
    }

    // ---- move ----
    const ph = boxH(s);
    const prevY = s.y;
    s.x += speedAt(lvl, s.x) * dt;
    s.y += s.vy * dt;
    // the raft integrates exactly (y += v0 dt + g dt^2 / 2 instead of v1 dt): then a raft riding a wave lets go
    // as soon as the surface falls away faster than gravity (not 2x as fast, as the plain step would need)
    if (s.mode === 'raft' || s.mode === 'cart') s.y -= 0.5 * s.gdir * P.G * dt * dt;
    s.grounded = false;

    // a hole in the floor: no ground under you, and once you've fallen deep enough you come out of the
    // roof of the layer below (same x, y shifted up so the fall is continuous)
    const hole = lvl.drops.length && s.mode !== 'raft' && s.mode !== 'cart' ? holeAt(lvl, s) : null;
    if (s.mode === 'raft') {
      // the water surface under the middle of the raft is the floor (it can lie below 0 in a trough)
      const fy = rapidsAt(lvl, s.x + RAFT_CX);
      if (s.y <= fy) {
        s.y = fy;
        s.vy = RS.dh * speedAt(lvl, s.x);
        s.grounded = true;
      }
    } else if (s.mode === 'cart') {
      // the rail under the middle of the cart is the floor. No rail (a gap): no floor — fall to y <= 0 and
      // you're out. Come out of a gap more than 0.6 under the rail and you've hit the far end of it.
      const fy = trackAt(lvl, s.x + RAFT_CX);
      if (fy === null) {
        if (s.y <= 0) {
          s.dead = true;
          s.cause = 'fall';
          s.dmg = 12;
          return s;
        }
      } else if (s.y < fy - 0.6) {
        s.dead = true;
        s.cause = 'solid';
        s.dmg = 12;
        return s;
      } else if (s.y <= fy) {
        s.y = fy;
        s.vy = TS.dh * speedAt(lvl, s.x);
        s.grounded = true;
      }
    } else if (hole) {
      if (s.y < -hole.depth) {
        s.y += hole.shift;
        s.layer++;
        if (ev) ev.push('drop');
      }
    } else if (s.y < 0) {
      s.y = 0;
      if (s.vy < 0) s.vy = 0;
      if (s.gdir < 0) s.grounded = true;
    }
    if (s.ceil != null && s.y + ph > s.ceil) {
      s.y = s.ceil - ph;
      if (s.vy > 0) s.vy = 0;
      if (s.gdir > 0) s.grounded = true;
    }

    const near = lvl.query(s.x);
    const n = near.length;

    // ---- solids ----
    // A solid with o.mv and a box (bx0..by1: Ferris-wheel gondolas) is moved by moveOf first; standing on one
    // you ride along (landing sets vy to the gondola's own speed, so jumps and landings work while it rises or
    // sinks). Static solids take exactly the old path (pvy = 0).
    for (let i = 0; i < n; i++) {
      const o = near[i];
      if (o.t !== 'solid') continue;
      if (o.lane != null && Math.abs(s.laneP - o.lane) >= P.LANE_HIT) continue;
      let ox0 = o.x, ox1 = o.x + o.w, oy0 = o.y, oy1 = o.y + o.h, pvy = 0;
      if (o.mv !== undefined && o.bx0 !== undefined) {
        const mo = moveOf(o, s.x, lvl);
        ox0 = o.bx0 + mo.dx;
        ox1 = o.bx1 + mo.dx;
        oy0 = o.by0 + mo.dy;
        oy1 = o.by1 + mo.dy;
        pvy = mo.vy;
      }
      if (s.x < ox1 && s.x + 1 > ox0 && s.y < oy1 && s.y + ph > oy0) {
        const top = oy1, bot = oy0;
        const cubeLike = s.mode === 'cube' || s.mode === 'raft' || s.mode === 'cart';
        const canTop = !cubeLike || s.gdir < 0;
        const canBot = !cubeLike || s.gdir > 0;
        if (canTop && s.vy - pvy <= 0 && prevY >= top - pvy * dt - P.LAND_TOL) {
          s.y = top;
          s.vy = pvy;
          if (s.gdir < 0) s.grounded = true;
        } else if (canBot && s.vy - pvy >= 0 && prevY + ph <= bot - pvy * dt + P.LAND_TOL) {
          s.y = bot - ph;
          s.vy = pvy;
          if (s.gdir > 0) s.grounded = true;
        } else {
          s.dead = true;
          s.cause = 'solid';
          s.dmg = o.dmg || 12;
          return s;
        }
      }
    }

    // ---- hazards / pads / orbs / portals ----
    const m = lvl.margin || 0;
    const ix0 = s.x + P.INSET, ix1 = s.x + 1 - P.INSET, iy0 = s.y + P.INSET, iy1 = s.y + ph - P.INSET;
    for (let i = 0; i < n; i++) {
      const o = near[i];
      const t = o.t;
      if (o.lane != null && Math.abs(s.laneP - o.lane) >= P.LANE_HIT) continue;
      if (t === 'haz') {
        let hx0 = o.hx0, hx1 = o.hx1, hy0 = o.hy0, hy1 = o.hy1;
        if (o.mv) {
          const mo = moveOf(o, s.x, lvl);
          hx0 += mo.dx; hx1 += mo.dx; hy0 += mo.dy; hy1 += mo.dy;
        }
        if (ix0 < hx1 + m && ix1 > hx0 - m && iy0 < hy1 + m && iy1 > hy0 - m) {
          s.dead = true;
          s.cause = o.kind;
          s.dmg = o.dmg || 12;
          return s;
        }
      } else if (t === 'pad') {
        if (o.id !== s.lastPad && s.x < o.x + o.w && s.x + 1 > o.x && s.y < o.y + o.h && s.y + ph > o.y) {
          s.vy = -s.gdir * P.PAD_V[o.color];
          s.grounded = false;
          s.lastPad = o.id;
          if (ev) ev.push('pad');
        }
      } else if (t === 'orb') {
        fresh = s.pressAge <= P.BUFFER;
        if (fresh && o.id !== s.lastOrb) {
          const r = P.ORB_R;
          if (s.x < o.cx + r && s.x + 1 > o.cx - r && s.y < o.cy + r && s.y + ph > o.cy - r) {
            s.vy = -s.gdir * P.ORB_V[o.color];
            s.grounded = false;
            s.lastOrb = o.id;
            s.pressAge = 99;
            if (ev) ev.push('orb');
          }
        }
      } else if (t === 'portal') {
        if (o.id !== s.lastPortal && s.x + 1 > o.x + 0.3 && s.x < o.x + 0.7) {
          s.lastPortal = o.id;
          setMode(s, o);
          if (ev) ev.push('portal');
        }
      }
    }
    return s;
  }

  VD.Physics = { spawn, clone, step, boxH, moveOf, speedAt, timeAt, gravAt, rapidsHeight, trackHeight, trackStyleAt, trackSlope };
})();
