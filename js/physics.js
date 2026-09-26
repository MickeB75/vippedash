// VippeDash — deterministic fixed-step physics (units: blocks, seconds; y is up, ground at y = 0)
(function () {
  const VD = (window.VD = window.VD || {});

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
      dead: false,
      cause: null,
    };
  }

  function clone(s) {
    return {
      x: s.x, y: s.y, vy: s.vy, mode: s.mode, gdir: s.gdir, ceil: s.ceil, grounded: s.grounded,
      held: s.held, pressAge: s.pressAge, lastOrb: s.lastOrb, lastPad: s.lastPad,
      lastPortal: s.lastPortal, dead: s.dead, cause: s.cause,
    };
  }

  function setMode(s, portal) {
    const oldH = boxH(s);
    s.mode = portal.mode;
    const newH = boxH(s);
    s.y += (oldH - newH) / 2;
    if (s.y < 0) s.y = 0;
    s.ceil = portal.ceil;
    s.gdir = -1;
    s.grounded = false;
    if (portal.mode === 'ship') s.vy *= 0.4;
    else s.vy *= 0.5;
    if (s.ceil != null && s.y + newH > s.ceil) s.y = s.ceil - newH;
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

    if (s.y < 0) {
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
        if (ix0 < o.hx1 + m && ix1 > o.hx0 - m && iy0 < o.hy1 + m && iy1 > o.hy0 - m) {
          s.dead = true;
          s.cause = o.kind;
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

  VD.Physics = { spawn, clone, step, boxH };
})();
