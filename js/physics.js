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
  };
  VD.PHYS = P;

  function boxH(s) {
    return s.mode === 'ship' ? P.SHIP_H : 1;
  }

  // Shared scratch object returned by moveOf — read it right away and never keep a reference,
  // so the bot's hot loop (millions of steps) allocates nothing.
  const MV = { dx: 0, dy: 0, a: 0, k: 0 };

  // The player's x-based "level clock" offset/state of a moving hazard, at player position x.
  // mv.type: 'bob' (sine bob), 'pop' (jack-in-the-box), 'drop' (falling/rising nun), 'swing' (pendulum),
  // 'throw' (a pawn thrown by the level 4 king boss, see level.js Builder.pawn()).
  function moveOf(o, x) {
    MV.dx = 0;
    MV.dy = 0;
    MV.a = 0;
    MV.k = 0;
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
      // the king's hand is always mv.ahead blocks ahead of the player, at height mv.handY; the pawn's
      // world position is the lerp from there to its landing spot, plus a parabolic arc in y
      const handX = x + mv.ahead;
      MV.dx = (handX - o.x) * (1 - p);
      MV.dy = (mv.handY - o.y) * (1 - p) + mv.arc * 4 * p * (1 - p);
      MV.k = p;
      return MV;
    }
    const t = x / P.SPEED;
    const u = t / (mv.beats * BEAT) + (mv.phase || 0);
    if (mv.type === 'bob') {
      MV.dy = mv.amp * Math.sin(2 * Math.PI * u);
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
      dead: false,
      cause: null,
      dmg: null, // how much damage the last death dealt (null until a hazard/solid kills)
    };
  }

  function clone(s) {
    return {
      x: s.x, y: s.y, vy: s.vy, mode: s.mode, gdir: s.gdir, ceil: s.ceil, grounded: s.grounded,
      held: s.held, pressAge: s.pressAge, lastOrb: s.lastOrb, lastPad: s.lastPad,
      lastPortal: s.lastPortal, layer: s.layer, dead: s.dead, cause: s.cause, dmg: s.dmg,
    };
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
    if (held && !s.held) s.pressAge = 0;
    else s.pressAge += dt;
    s.held = held;
    let fresh = s.pressAge <= P.BUFFER;

    // ---- input + gravity ----
    if (s.mode === 'cube') {
      if (s.grounded && (held || fresh)) {
        s.vy = -s.gdir * P.JUMP_V;
        s.grounded = false;
        s.pressAge = 99;
        if (ev) ev.push('jump');
      }
      s.vy += s.gdir * P.G * dt;
      // cap falling speed only (never the upward launch from pads)
      if (s.gdir < 0 ? s.vy < -P.MAX_FALL : s.vy > P.MAX_FALL) s.vy = s.gdir * P.MAX_FALL;
    } else if (s.mode === 'ship') {
      const up = -s.gdir;
      s.vy += (held ? P.SHIP_UP : -P.SHIP_DOWN) * up * dt;
      if (s.vy > P.SHIP_VUP) s.vy = P.SHIP_VUP;
      else if (s.vy < -P.SHIP_VDOWN) s.vy = -P.SHIP_VDOWN;
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

    // ---- move ----
    const ph = boxH(s);
    const prevY = s.y;
    s.x += P.SPEED * dt;
    s.y += s.vy * dt;
    s.grounded = false;

    // a hole in the floor: no ground under you, and once you've fallen deep enough you come out of the
    // roof of the layer below (same x, y shifted up so the fall is continuous)
    const hole = lvl.drops.length ? holeAt(lvl, s) : null;
    if (hole) {
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
    for (let i = 0; i < n; i++) {
      const o = near[i];
      if (o.t !== 'solid') continue;
      if (s.x < o.x + o.w && s.x + 1 > o.x && s.y < o.y + o.h && s.y + ph > o.y) {
        const top = o.y + o.h, bot = o.y;
        const canTop = s.mode !== 'cube' || s.gdir < 0;
        const canBot = s.mode !== 'cube' || s.gdir > 0;
        if (canTop && s.vy <= 0 && prevY >= top - P.LAND_TOL) {
          s.y = top;
          s.vy = 0;
          if (s.gdir < 0) s.grounded = true;
        } else if (canBot && s.vy >= 0 && prevY + ph <= bot + P.LAND_TOL) {
          s.y = bot - ph;
          s.vy = 0;
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
      if (t === 'haz') {
        let hx0 = o.hx0, hx1 = o.hx1, hy0 = o.hy0, hy1 = o.hy1;
        if (o.mv) {
          const mo = moveOf(o, s.x);
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

  VD.Physics = { spawn, clone, step, boxH, moveOf };
})();
