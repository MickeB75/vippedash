// VippeDash — all procedural drawing (character, obstacles, scenery). Everything is vector, no image files.
(function () {
  const VD = (window.VD = window.VD || {});
  const U = VD.U;
  const Art = (VD.Art = {});
  const TAU = Math.PI * 2;

  // ---------- evening tint: every scenery colour is pulled towards night-blue as the sun sets ----------
  let dq = 0;
  const tintCache = new Map();
  const NIGHT = [16, 22, 56];
  Art.setDark = (d) => {
    dq = Math.round(U.clamp(d, 0, 1) * 24);
  };
  Art.dark = () => dq / 24;
  function T(hex, k = 1) {
    const q = Math.round(dq * k);
    if (!q) return hex;
    const key = hex + q;
    let v = tintCache.get(key);
    if (v) return v;
    const c = U.rgb(hex), t = (q / 24) * 0.72;
    v = 'rgb(' + Math.round(c[0] * (1 - t) + NIGHT[0] * t) + ',' + Math.round(c[1] * (1 - t) + NIGHT[1] * t) + ',' + Math.round(c[2] * (1 - t) + NIGHT[2] * t) + ')';
    tintCache.set(key, v);
    return v;
  }
  const TL = (hex) => T(hex, 0.45); // gameplay objects stay readable
  Art.T = T;
  Art.TL = TL;
  const lit = () => dq / 24 > 0.3; // are house windows lit?

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  Art.rr = rr;
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }
  function tri(ctx, x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
  }

  // =====================================================================
  // CHARACTER — Vippe: curly brown hair, blue-grey eyes, big goofy faces
  // =====================================================================
  Art.SKINS = {
    red: { name: 'Red jersey', main: '#d3122f', dark: '#6e0716', trim: '#ffffff' },
    black: { name: 'Black hoodie', main: '#2a2a31', dark: '#0b0b0f', trim: '#dcdcdc' },
    sirius: { name: 'Blue & black', main: '#1d5fc4', dark: '#0a1633', trim: '#101010', stripes: true },
  };
  // curls: [x, y, r] relative to cube size
  const HAIR = [
    [-0.5, -0.12, 0.13], [0.5, -0.12, 0.13], [-0.52, -0.3, 0.14], [0.52, -0.3, 0.14],
    [-0.4, -0.46, 0.16], [0.4, -0.46, 0.16], [-0.2, -0.56, 0.17], [0.02, -0.6, 0.18], [0.23, -0.56, 0.17],
    [-0.3, -0.66, 0.1], [0.08, -0.74, 0.11], [0.36, -0.66, 0.1],
    [-0.28, -0.3, 0.14], [-0.06, -0.34, 0.15], [0.17, -0.32, 0.14], [0.36, -0.28, 0.12],
  ];
  function hair(ctx, s) {
    ctx.fillStyle = '#2f1d10';
    for (const c of HAIR) {
      circle(ctx, c[0] * s, c[1] * s, c[2] * s + s * 0.035);
      ctx.fill();
    }
    ctx.fillStyle = '#6b4526';
    for (const c of HAIR) {
      circle(ctx, c[0] * s, c[1] * s, c[2] * s);
      ctx.fill();
    }
    ctx.strokeStyle = '#a77a45';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.028;
    for (const c of HAIR) {
      ctx.beginPath();
      ctx.arc(c[0] * s - c[2] * s * 0.12, c[1] * s - c[2] * s * 0.1, c[2] * s * 0.55, Math.PI * 1.05, Math.PI * 1.85);
      ctx.stroke();
    }
    // a couple of loose curls falling on the forehead
    ctx.strokeStyle = '#5a3a1f';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.arc(-0.02 * s, -0.19 * s, 0.05 * s, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0.2 * s, -0.18 * s, 0.04 * s, Math.PI * 1.3, Math.PI * 2.7);
    ctx.stroke();
  }
  function eyes(ctx, s, expr, look) {
    const ry = expr === 'o' || expr === 'tongue' ? 0.15 : 0.13;
    for (const sx of [-1, 1]) {
      const ex = sx * 0.17 * s, ey = -0.04 * s;
      if (expr === 'happy') {
        ctx.strokeStyle = '#2b1a10';
        ctx.lineWidth = s * 0.045;
        ctx.beginPath();
        ctx.arc(ex, ey + 0.03 * s, 0.08 * s, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 0.11 * s, ry * s, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.025;
      ctx.strokeStyle = '#3a2418';
      ctx.stroke();
      const ix = ex + look * 0.03 * s, iy = ey + 0.015 * s;
      ctx.fillStyle = '#6d9fc4';
      circle(ctx, ix, iy, 0.068 * s);
      ctx.fill();
      ctx.fillStyle = '#3d6f95';
      circle(ctx, ix, iy, 0.068 * s);
      ctx.lineWidth = s * 0.012;
      ctx.stroke();
      ctx.fillStyle = '#101010';
      circle(ctx, ix, iy, 0.034 * s);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      circle(ctx, ix - 0.022 * s, iy - 0.025 * s, 0.018 * s);
      ctx.fill();
    }
    // brows
    ctx.strokeStyle = '#4a2c18';
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    const lift = expr === 'o' || expr === 'tongue' ? -0.04 : 0;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 0.25 * s, (-0.19 + lift) * s);
      ctx.quadraticCurveTo(sx * 0.17 * s, (-0.25 + lift) * s, sx * 0.08 * s, (-0.2 + lift) * s);
      ctx.stroke();
    }
  }
  function mouth(ctx, s, expr) {
    if (expr === 'grin' || expr === 'happy') {
      const y0 = 0.14 * s;
      ctx.beginPath();
      ctx.moveTo(-0.22 * s, y0);
      ctx.lineTo(0.22 * s, y0);
      ctx.quadraticCurveTo(0.21 * s, 0.34 * s, 0, 0.34 * s);
      ctx.quadraticCurveTo(-0.21 * s, 0.34 * s, -0.22 * s, y0);
      ctx.closePath();
      ctx.fillStyle = '#5b1212';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(-0.24 * s, y0, 0.48 * s, 0.075 * s);
      ctx.fillRect(-0.24 * s, 0.29 * s, 0.48 * s, 0.05 * s);
      ctx.strokeStyle = '#d9d2c2';
      ctx.lineWidth = s * 0.012;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 0.06 * s, y0);
        ctx.lineTo(i * 0.06 * s, y0 + 0.075 * s);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#7d2b1e';
      ctx.lineWidth = s * 0.025;
      ctx.stroke();
    } else if (expr === 'o') {
      ctx.fillStyle = '#5b1212';
      ctx.beginPath();
      ctx.ellipse(0.02 * s, 0.22 * s, 0.085 * s, 0.11 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e7808f';
      ctx.beginPath();
      ctx.ellipse(0.02 * s, 0.29 * s, 0.055 * s, 0.035 * s, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7d2b1e';
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.ellipse(0.02 * s, 0.22 * s, 0.085 * s, 0.11 * s, 0, 0, TAU);
      ctx.stroke();
    } else if (expr === 'tongue') {
      ctx.fillStyle = '#5b1212';
      ctx.beginPath();
      ctx.ellipse(0, 0.19 * s, 0.13 * s, 0.075 * s, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(-0.08 * s, 0.125 * s, 0.16 * s, 0.035 * s);
      ctx.fillStyle = '#ec8797';
      ctx.strokeStyle = '#b75264';
      ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      ctx.moveTo(-0.085 * s, 0.19 * s);
      ctx.lineTo(-0.08 * s, 0.4 * s);
      ctx.quadraticCurveTo(0, 0.52 * s, 0.08 * s, 0.4 * s);
      ctx.lineTo(0.085 * s, 0.19 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0.24 * s);
      ctx.lineTo(0, 0.38 * s);
      ctx.stroke();
    }
  }

  // centred at (0,0), s = size in px
  Art.cube = function (ctx, s, expr, skinId, look = 1) {
    const k = Art.SKINS[skinId] || Art.SKINS.red, h = s / 2;
    ctx.lineJoin = 'round';
    rr(ctx, -h, -h, s, s, s * 0.16);
    ctx.fillStyle = k.main;
    ctx.fill();
    if (k.stripes) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = k.dark;
      for (let i = -2; i <= 2; i++) ctx.fillRect(i * s * 0.24 - s * 0.055, -h, s * 0.11, s);
      ctx.restore();
    } else {
      // subtle jersey pattern
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = s * 0.05;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.25 - h, h);
        ctx.lineTo(i * s * 0.25 + h, -h);
        ctx.stroke();
      }
      ctx.restore();
    }
    rr(ctx, -h, -h, s, s, s * 0.16);
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = k.dark;
    ctx.stroke();
    // collar
    ctx.strokeStyle = k.trim;
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(-0.2 * s, 0.4 * s);
    ctx.lineTo(0, 0.47 * s);
    ctx.lineTo(0.2 * s, 0.4 * s);
    ctx.stroke();
    // face
    rr(ctx, -0.36 * s, -0.3 * s, 0.72 * s, 0.68 * s, 0.16 * s);
    ctx.fillStyle = '#f2c6a0';
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#b87f58';
    ctx.stroke();
    ctx.fillStyle = 'rgba(236,120,110,0.28)';
    circle(ctx, -0.25 * s, 0.1 * s, 0.07 * s);
    ctx.fill();
    circle(ctx, 0.25 * s, 0.1 * s, 0.07 * s);
    ctx.fill();
    eyes(ctx, s, expr, look);
    // nose
    ctx.strokeStyle = '#c98c66';
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    ctx.moveTo(0.02 * s, 0.0);
    ctx.quadraticCurveTo(0.07 * s, 0.08 * s, 0.0, 0.09 * s);
    ctx.stroke();
    mouth(ctx, s, expr);
    hair(ctx, s);
  };

  // flying bike (ship mode) — Uppsala is Sweden's bicycle city
  Art.ship = function (ctx, s, expr, skinId, wheel, t) {
    const k = Art.SKINS[skinId] || Art.SKINS.red;
    // rocket flame
    const fl = 0.75 + 0.25 * Math.sin(t * 50);
    ctx.fillStyle = '#ffb02e';
    tri(ctx, -0.62 * s, 0.02 * s, -0.62 * s, 0.2 * s, (-0.62 - 0.45 * fl) * s, 0.11 * s);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    tri(ctx, -0.62 * s, 0.07 * s, -0.62 * s, 0.15 * s, (-0.62 - 0.22 * fl) * s, 0.11 * s);
    ctx.fill();
    ctx.fillStyle = '#9aa3ad';
    rr(ctx, -0.66 * s, 0.0, 0.2 * s, 0.22 * s, 0.05 * s);
    ctx.fill();
    // wheels
    for (const wx of [-0.36, 0.38]) {
      const cx = wx * s, cy = 0.2 * s, r = 0.21 * s;
      ctx.strokeStyle = '#18181c';
      ctx.lineWidth = s * 0.07;
      circle(ctx, cx, cy, r);
      ctx.stroke();
      ctx.strokeStyle = '#c9ced4';
      ctx.lineWidth = s * 0.018;
      for (let i = 0; i < 4; i++) {
        const a = wheel + (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
      }
    }
    // frame
    ctx.strokeStyle = k.main === '#2a2a31' ? '#e8e8e8' : k.main;
    ctx.lineWidth = s * 0.065;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.36 * s, 0.2 * s);
    ctx.lineTo(0.0, 0.2 * s);
    ctx.lineTo(-0.14 * s, -0.08 * s);
    ctx.lineTo(0.26 * s, -0.06 * s);
    ctx.lineTo(0.0, 0.2 * s);
    ctx.moveTo(0.26 * s, -0.06 * s);
    ctx.lineTo(0.38 * s, 0.2 * s);
    ctx.moveTo(-0.36 * s, 0.2 * s);
    ctx.lineTo(-0.14 * s, -0.08 * s);
    ctx.stroke();
    // handlebar + basket
    ctx.strokeStyle = '#222';
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(0.26 * s, -0.06 * s);
    ctx.lineTo(0.3 * s, -0.2 * s);
    ctx.lineTo(0.4 * s, -0.22 * s);
    ctx.stroke();
    ctx.fillStyle = '#8a5a2b';
    rr(ctx, 0.34 * s, -0.16 * s, 0.2 * s, 0.14 * s, 0.03 * s);
    ctx.fill();
    // rider
    ctx.save();
    ctx.translate(-0.08 * s, -0.33 * s);
    Art.cube(ctx, s * 0.52, expr, skinId, 1);
    ctx.restore();
  };

  // floorball (ball mode) with Vippe inside
  Art.ball = function (ctx, s, expr, skinId, rot, flipped) {
    const r = s * 0.5;
    ctx.fillStyle = '#f7f8f4';
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.lineWidth = s * 0.08;
    ctx.strokeStyle = '#1d2733';
    ctx.stroke();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#ff8a1f';
    circle(ctx, 0, 0, r + s * 0.06);
    ctx.stroke();
    ctx.save();
    ctx.rotate(rot);
    ctx.fillStyle = '#b3bcc5';
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10;
      circle(ctx, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, s * 0.06);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    if (flipped) ctx.scale(1, -1);
    Art.cube(ctx, s * 0.5, expr, skinId, 1);
    ctx.restore();
  };

  // =====================================================================
  // GAMEPLAY OBJECTS
  // =====================================================================
  const GLOW = {
    uppland: '#ffffff', gamla: '#fff2c4', uppsala: '#ffe0c0', fyris: '#ffd0e8', road: '#ffffff', hall: '#8ff3ff', home: '#c9d8ff',
  };
  Art.spike = function (ctx, x, y, w, h, down, style, area) {
    ctx.lineJoin = 'round';
    if (style === 'cone') {
      const bx = x + w * 0.1, bw = w * 0.8;
      if (down) return;
      ctx.fillStyle = TL('#ff6d12');
      tri(ctx, bx + bw * 0.12, y + h * 0.88, x + w / 2, y + h * 0.04, bx + bw * 0.88, y + h * 0.88);
      ctx.fill();
      ctx.strokeStyle = '#3b1500';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.37, y + h * 0.42);
      ctx.lineTo(x + w * 0.63, y + h * 0.42);
      ctx.lineTo(x + w * 0.68, y + h * 0.58);
      ctx.lineTo(x + w * 0.32, y + h * 0.58);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = TL('#2b2b2b');
      rr(ctx, bx, y + h * 0.84, bw, h * 0.16, 3);
      ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(0, down ? y + h : y, 0, down ? y : y + h);
    g.addColorStop(0, '#4a4a5c');
    g.addColorStop(1, '#101016');
    ctx.fillStyle = g;
    if (down) tri(ctx, x + 1, y, x + w / 2, y + h - 1, x + w - 1, y);
    else tri(ctx, x + 1, y + h, x + w / 2, y + 1, x + w - 1, y + h);
    ctx.fill();
    ctx.strokeStyle = GLOW[area] || '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x + w * 0.3, y + h * 0.2);
      ctx.lineTo(x + w / 2, y + h * 0.7);
    } else {
      ctx.moveTo(x + w * 0.3, y + h * 0.8);
      ctx.lineTo(x + w / 2, y + h * 0.3);
    }
    ctx.stroke();
  };

  Art.half = function (ctx, x, y, w, h, style, area) {
    // small thorny spike (rendered as a little rock shard)
    ctx.fillStyle = '#151519';
    tri(ctx, x + w * 0.15, y + h, x + w / 2, y + h * 0.1, x + w * 0.85, y + h);
    ctx.fill();
    ctx.strokeStyle = GLOW[area] || '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  Art.water = function (ctx, x0, x1, ySurf, yBot, t) {
    const g = ctx.createLinearGradient(0, ySurf, 0, yBot);
    g.addColorStop(0, TL('#3f93d6'));
    g.addColorStop(1, TL('#0f355c'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, yBot);
    for (let x = x0; x <= x1 + 8; x += 8) ctx.lineTo(Math.min(x, x1), ySurf + Math.sin(x * 0.05 + t * 3) * 3);
    ctx.lineTo(x1, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      const yy = ySurf + Math.sin(x * 0.05 + t * 3) * 3;
      if (x === x0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let x = x0 + 20; x < x1 - 20; x += 70) {
      const yy = ySurf + 18 + Math.sin(x * 0.3) * 10;
      const dx = Math.sin(t * 1.5 + x) * 6;
      ctx.beginPath();
      ctx.moveTo(x + dx, yy);
      ctx.lineTo(x + dx + 22, yy);
      ctx.stroke();
    }
  };

  Art.pad = function (ctx, x, y, w, h, color, t) {
    const c = color === 'pink' ? '#ff5fd2' : '#ffd634';
    const g = ctx.createLinearGradient(0, y - 40, 0, y + h);
    g.addColorStop(0, U.rgba(c, 0));
    g.addColorStop(1, U.rgba(c, 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, y - 36 - Math.sin(t * 8) * 4, w - 4, 36 + h);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.quadraticCurveTo(x + w / 2, y - h * 1.2, x + w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5a00';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  Art.orb = function (ctx, cx, cy, r, color, t, used) {
    const c = color === 'pink' ? '#ff5fd2' : '#ffd634';
    const pulse = 1 + Math.sin(t * 7) * 0.08;
    const g = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2);
    g.addColorStop(0, U.rgba(c, used ? 0.15 : 0.5));
    g.addColorStop(1, U.rgba(c, 0));
    ctx.fillStyle = g;
    circle(ctx, cx, cy, r * 2);
    ctx.fill();
    ctx.strokeStyle = U.rgba(c, used ? 0.3 : 0.9);
    ctx.lineWidth = 3;
    circle(ctx, cx, cy, r * 1.35 * pulse);
    ctx.stroke();
    ctx.fillStyle = c;
    circle(ctx, cx, cy, r);
    ctx.fill();
    ctx.fillStyle = '#fff8c8';
    circle(ctx, cx, cy, r * 0.55);
    ctx.fill();
    ctx.strokeStyle = '#6b4c00';
    ctx.lineWidth = 2;
    circle(ctx, cx, cy, r);
    ctx.stroke();
  };

  Art.portal = function (ctx, cx, cy, hpx, mode, t) {
    const c = mode === 'ship' ? '#ff4fd8' : mode === 'ball' ? '#ff8a1f' : '#3cff78';
    const w = hpx * 0.34;
    for (let i = 3; i >= 1; i--) {
      ctx.strokeStyle = U.rgba(c, 0.12 * i);
      ctx.lineWidth = 14 - i * 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * (1 + i * 0.08), hpx / 2 + i * 4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = U.rgba(c, 0.18);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, hpx / 2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.7, hpx / 2 - 8, 0, 0, TAU);
    ctx.stroke();
    // sparkles
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + i * 1.3;
      const yy = cy + Math.sin(a) * hpx * 0.4;
      ctx.fillRect(cx + Math.cos(a * 1.7) * w * 0.5 - 2, yy - 2, 4, 4);
    }
  };

  Art.checkpoint = function (ctx, x, base, bs, active, t) {
    ctx.strokeStyle = TL('#d9d9d9');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - bs * 2.4);
    ctx.stroke();
    ctx.fillStyle = '#ffd200';
    circle(ctx, x, base - bs * 2.4, 4);
    ctx.fill();
    const fy = active ? base - bs * 2.35 : base - bs * 1.25;
    const fw = bs * 0.95, fh = bs * 0.6;
    const wave = active ? t * 6 : 0;
    // Swedish flag
    const col = (x2) => Math.sin(wave + x2 * 0.12) * (active ? 3 : 0);
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.55;
    ctx.fillStyle = '#006aa7';
    ctx.beginPath();
    ctx.moveTo(x, fy + col(0));
    for (let i = 0; i <= 8; i++) ctx.lineTo(x + (fw * i) / 8, fy + col((fw * i) / 8));
    for (let i = 8; i >= 0; i--) ctx.lineTo(x + (fw * i) / 8, fy + fh + col((fw * i) / 8));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fecc00';
    for (let i = 0; i < 8; i++) {
      const x1 = x + (fw * i) / 8, x2 = x + (fw * (i + 1)) / 8;
      const yy = fy + fh * 0.4 + col((fw * i) / 8);
      ctx.fillRect(x1, yy, x2 - x1 + 0.5, fh * 0.2);
    }
    ctx.fillRect(x + fw * 0.3, fy + col(fw * 0.3), fw * 0.14, fh);
    ctx.restore();
  };

  // ---------- solid blocks ----------
  function cellLines(ctx, x, y, w, h, bs, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cx = x + bs; cx < x + w - 2; cx += bs) {
      ctx.moveTo(cx, y + 4);
      ctx.lineTo(cx, y + h - 4);
    }
    for (let cy = y + bs; cy < y + h - 2; cy += bs) {
      ctx.moveTo(x + 4, cy);
      ctx.lineTo(x + w - 4, cy);
    }
    ctx.stroke();
  }
  function bevel(ctx, x, y, w, h, top, bot, line, r = 6) {
    rr(ctx, x + 1, y + 1, w - 2, h - 2, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;
    ctx.stroke();
  }
  // weathered granite standing stone with a faint carved rune-serpent (runestone block + scenery)
  // rough: 0 = keeps close to its box (solid block you land on), 1 = free-form tapered scenery stone
  function runestone(ctx, x, y, w, h, seed, C, lw, rough) {
    const rnd = U.rng(seed * 4099 + 7);
    const b = y + h, tp = rough * 0.12;
    // lumpy outline in box units: flat base, bulging sides, lopsided crown sloping to one side
    let P = [
      [0.05, 1],
      [0.01 + rnd() * 0.04, 0.62],
      [0.04 + rnd() * 0.06 + tp * 0.6, 0.24],
      [0.2 + tp, 0.03 + rnd() * 0.03],
      [0.46 + rnd() * 0.12, rnd() * 0.015],
      [0.84 - tp, 0.05 + rough * 0.12 + rnd() * 0.05],
      [0.95 - tp * 0.7, 0.36 + rough * 0.08],
      [0.96 + rnd() * 0.04, 0.74],
      [0.95, 1],
    ];
    if (rnd() < 0.5) P = P.reverse().map(([u, v]) => [1 - u, v]);
    P = P.map(([u, v]) => [x + u * w, y + v * h]);
    const curve = (pts, close) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i], [nx, ny] = pts[i + 1];
        const end = i === pts.length - 2;
        ctx.quadraticCurveTo(px, py, end ? nx : (px + nx) / 2, end ? ny : (py + ny) / 2);
      }
      if (close) ctx.closePath();
    };
    curve(P, true);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, C('#b3b0a6'));
    g.addColorStop(0.55, C('#8f8c83'));
    g.addColorStop(1, C('#66635c'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // sunlit crown + shaded base
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.32, y + h * 0.12, w * 0.3, h * 0.1, -0.3, 0, TAU);
    ctx.fill();
    const sh = ctx.createLinearGradient(0, b - h * 0.25, 0, b);
    sh.addColorStop(0, 'rgba(20,18,14,0)');
    sh.addColorStop(1, 'rgba(20,18,14,0.3)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, b - h * 0.25, w, h * 0.25);
    // granite grain
    for (let i = 0; i < (w * h) / 70; i++) {
      ctx.fillStyle = i % 3 ? C('#5d5a53') : C('#d6d3c8');
      ctx.fillRect(x + rnd() * w, y + rnd() * h, 2, 2);
    }
    // lichen crusts (yellow-green and orange)
    for (let i = 0; i < 4; i++) {
      const lx = x + w * (0.15 + rnd() * 0.7), ly = y + h * (0.15 + rnd() * 0.7);
      ctx.fillStyle = U.rgba(i % 2 ? '#d7913e' : '#c7c878', 0.75 - Art.dark() * 0.4);
      for (let k = 0; k < 3; k++) {
        circle(ctx, lx + (rnd() - 0.5) * 7, ly + (rnd() - 0.5) * 7, 1.5 + rnd() * 2.5);
        ctx.fill();
      }
    }
    // moss cushion on the crown
    const [mx0, my0] = P.reduce((a, p) => (p[1] < a[1] ? p : a));
    ctx.fillStyle = C('#5e8f34');
    for (let i = 0; i < 6; i++) {
      circle(ctx, mx0 + (i - 2.5) * w * 0.1, my0 + 1 + Math.abs(i - 2.5) * 3, 4 + rnd() * 3);
      ctx.fill();
    }
    ctx.fillStyle = C('#80b447');
    for (let i = 0; i < 4; i++) {
      circle(ctx, mx0 + (i - 1.5) * w * 0.11, my0 + Math.abs(i - 1.5) * 3, 2 + rnd() * 1.5);
      ctx.fill();
    }
    // carved serpent band following the edge, with rune strokes across it
    const cx = x + w / 2, cy = y + h * 0.55;
    const S = P.map(([px, py]) => [cx + (px - cx) * 0.66, cy + (py - cy) * 0.84]);
    const bw = Math.max(4, w * 0.13);
    curve(S, false);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(38,30,24,0.45)';
    ctx.lineWidth = bw;
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = C('#9a4b37');
    ctx.lineWidth = bw * 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(38,30,24,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 1; i < S.length - 2; i++) {
      const [ax, ay] = S[i], [nx, ny] = S[i + 1];
      const mx = (ax + nx) / 2, my = (ay + ny) / 2, len = Math.hypot(nx - ax, ny - ay) || 1;
      const px = ((ay - ny) / len) * bw * 0.45, py = ((nx - ax) / len) * bw * 0.45;
      ctx.moveTo(mx - px, my - py);
      ctx.lineTo(mx + px, my + py);
    }
    ctx.stroke();
    ctx.restore();
    curve(P, true);
    ctx.lineCap = 'butt';
    ctx.lineWidth = lw;
    ctx.strokeStyle = C('#34322d');
    ctx.stroke();
    // grass tufts hugging the foot
    ctx.strokeStyle = C('#4f8a2e');
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const [gx, dir] of [[x + w * 0.04, -1], [x + w * 0.14, 1], [x + w * 0.88, 1], [x + w * 0.97, -1]]) {
      ctx.moveTo(gx, b);
      ctx.lineTo(gx + dir * 3, b - 9 - rnd() * 5);
      ctx.moveTo(gx + 3, b);
      ctx.lineTo(gx + 3 + dir * 5, b - 6 - rnd() * 4);
    }
    ctx.stroke();
  }
  Art.block = function (ctx, st, x, y, w, h, bs, seed, t) {
    const rnd = U.rng(seed * 7919 + 13);
    switch (st) {
      case 'stone': {
        bevel(ctx, x, y, w, h, TL('#a9adb6'), TL('#6a6e78'), TL('#2e3138'), 9);
        ctx.fillStyle = TL('#575b64');
        for (let i = 0; i < (w * h) / 260; i++) ctx.fillRect(x + 6 + rnd() * (w - 12), y + 8 + rnd() * (h - 14), 3, 2);
        ctx.fillStyle = TL('#6fa33b');
        rr(ctx, x + 3, y + 1, w - 6, 7, 3);
        ctx.fill();
        cellLines(ctx, x, y, w, h, bs, 'rgba(0,0,0,0.12)');
        break;
      }
      case 'bale': {
        // wrapped silage bales ("tractor eggs")
        for (let cx = x; cx < x + w - 1; cx += bs) {
          const cw = Math.min(bs, x + w - cx);
          for (let cy = y; cy < y + h - 1; cy += bs) {
            rr(ctx, cx + 2, cy + 2, cw - 4, bs - 4, bs * 0.3);
            const g = ctx.createLinearGradient(cx, cy, cx, cy + bs);
            g.addColorStop(0, TL('#ffffff'));
            g.addColorStop(1, TL('#c9cdc8'));
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = TL('#6c716c');
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(120,130,120,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx + cw / 2, cy + bs / 2, bs * 0.22, 0, TAU);
            ctx.stroke();
          }
        }
        break;
      }
      case 'rune':
        runestone(ctx, x, y, w, h, seed, TL, 3, 0.25);
        break;
      case 'moose':
        Art.moose(ctx, x, y, w, h, TL);
        break;
      case 'log': {
        rr(ctx, x + 1, y + 2, w - 2, h - 3, h * 0.35);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, TL('#8a5e37'));
        g.addColorStop(1, TL('#4d321c'));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#2a1b0e');
        ctx.stroke();
        ctx.strokeStyle = 'rgba(30,18,8,0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < w / 18; i++) {
          const yy = y + 8 + rnd() * (h - 16), xx = x + 10 + rnd() * (w - 30);
          ctx.beginPath();
          ctx.moveTo(xx, yy);
          ctx.lineTo(xx + 20, yy);
          ctx.stroke();
        }
        ctx.fillStyle = TL('#d8b27a');
        ctx.beginPath();
        ctx.ellipse(x + 8, y + h / 2, 6, h / 2 - 4, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = TL('#8a5e37');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x + 8, y + h / 2, 3, h / 4, 0, 0, TAU);
        ctx.stroke();
        // moss
        ctx.fillStyle = TL('#5d8f2f');
        rr(ctx, x + w * 0.2, y + 1, w * 0.35, 6, 3);
        ctx.fill();
        break;
      }
      case 'turf': {
        bevel(ctx, x, y, w, h, TL('#7b5a3c'), TL('#4b3322'), TL('#2a1c12'), 8);
        ctx.fillStyle = TL('#78b84a');
        rr(ctx, x + 1, y, w - 2, 12, 5);
        ctx.fill();
        ctx.strokeStyle = TL('#4d8a2c');
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let xx = x + 6; xx < x + w - 4; xx += 9) {
          ctx.moveTo(xx, y + 12);
          ctx.lineTo(xx + 3, y + 16 + (xx % 3));
        }
        ctx.stroke();
        cellLines(ctx, x, y + 12, w, h - 12, bs, 'rgba(0,0,0,0.1)');
        break;
      }
      case 'brick':
      case 'chimney': {
        ctx.fillStyle = TL('#a8452f');
        rr(ctx, x + 1, y + 1, w - 2, h - 2, 4);
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = TL('#6e2a1b');
        ctx.lineWidth = 2;
        const bh = bs / 4;
        ctx.beginPath();
        for (let r = 0, yy = y + bh; yy < y + h; yy += bh, r++) {
          ctx.moveTo(x, yy);
          ctx.lineTo(x + w, yy);
        }
        for (let r = 0, yy = y; yy < y + h; yy += bh, r++) {
          for (let xx = x + (r % 2 ? bs / 4 : 0); xx < x + w; xx += bs / 2) {
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx, yy + bh);
          }
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x, y, w, 4);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#3d140b');
        rr(ctx, x + 1, y + 1, w - 2, h - 2, 4);
        ctx.stroke();
        if (st === 'chimney') {
          ctx.fillStyle = TL('#3b3b40');
          ctx.fillRect(x - 3, y, w + 6, 6);
          ctx.fillStyle = 'rgba(200,200,210,0.35)';
          circle(ctx, x + w / 2 + Math.sin(t * 2) * 4, y - 14 - ((t * 20) % 16), 8);
          ctx.fill();
        }
        break;
      }
      case 'house': {
        const cols = ['#ecc877', '#e7a27a', '#f0dca8', '#d98f7a'];
        const c = cols[seed % cols.length];
        ctx.fillStyle = TL(c);
        ctx.fillRect(x + 1, y + 10, w - 2, h - 10);
        ctx.strokeStyle = TL('#4a3322');
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1, y + 10, w - 2, h - 10);
        // windows
        for (let wx = x + 22; wx < x + w - 30; wx += 56) {
          for (let wy = y + 36; wy < y + h - 50; wy += 56) {
            ctx.fillStyle = lit() ? '#ffd782' : TL('#9fc2dc');
            ctx.fillRect(wx, wy, 22, 30);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeRect(wx, wy, 22, 30);
            ctx.beginPath();
            ctx.moveTo(wx + 11, wy);
            ctx.lineTo(wx + 11, wy + 30);
            ctx.stroke();
          }
        }
        // door
        ctx.fillStyle = TL('#3f5f7a');
        ctx.fillRect(x + w / 2 - 14, y + h - 44, 28, 44);
        // roof ledge you run on
        ctx.fillStyle = TL('#3e4652');
        rr(ctx, x - 4, y, w + 8, 14, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x - 4, y, w + 8, 3);
        break;
      }
      case 'pillar':
      case 'quay': {
        bevel(ctx, x, y, w, h, TL('#c9bea6'), TL('#8c826d'), TL('#3e382c'), 5);
        ctx.strokeStyle = 'rgba(60,50,35,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let yy = y + bs / 2, r = 0; yy < y + h - 4; yy += bs / 2, r++) {
          ctx.moveTo(x + 3, yy);
          ctx.lineTo(x + w - 3, yy);
          for (let xx = x + (r % 2 ? bs / 2 : bs / 4); xx < x + w - 4; xx += bs * 0.75) {
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx, yy - bs / 2 + 3);
          }
        }
        ctx.stroke();
        break;
      }
      case 'bridge': {
        bevel(ctx, x, y, w, h, TL('#d4c7ab'), TL('#978a70'), TL('#3e382c'), 4);
        ctx.strokeStyle = TL('#2f2f35');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + 6);
        ctx.lineTo(x + w, y + 6);
        ctx.stroke();
        ctx.fillStyle = TL('#8c826d');
        for (let xx = x + 12; xx < x + w - 6; xx += 24) ctx.fillRect(xx, y + 10, 5, h - 18);
        break;
      }
      case 'barrier': {
        rr(ctx, x + 1, y + 1, w - 2, h - 2, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#e53935';
        for (let xx = x - h; xx < x + w + h; xx += 28) {
          ctx.beginPath();
          ctx.moveTo(xx, y + h);
          ctx.lineTo(xx + 14, y + h);
          ctx.lineTo(xx + 14 + h, y);
          ctx.lineTo(xx + h, y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#3a0c0c';
        rr(ctx, x + 1, y + 1, w - 2, h - 2, 5);
        ctx.stroke();
        // reflector lights
        ctx.fillStyle = '#ffcf33';
        circle(ctx, x + 8, y + 8, 4);
        ctx.fill();
        circle(ctx, x + w - 8, y + 8, 4);
        ctx.fill();
        break;
      }
      case 'goal':
      case 'goalTop': {
        // floorball goal: red frame, white net
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        ctx.strokeStyle = '#c8cdd2';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let xx = x + 10; xx < x + w - 4; xx += 10) {
          ctx.moveTo(xx, y + 4);
          ctx.lineTo(xx, y + h - 4);
        }
        for (let yy = y + 10; yy < y + h - 4; yy += 10) {
          ctx.moveTo(x + 4, yy);
          ctx.lineTo(x + w - 4, yy);
        }
        ctx.stroke();
        ctx.strokeStyle = '#e02a1f';
        ctx.lineWidth = 7;
        ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
        ctx.strokeStyle = '#7a0f09';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        break;
      }
      default: {
        bevel(ctx, x, y, w, h, '#30303a', '#16161c', '#ffffff', 4);
      }
    }
  };

  Art.moose = function (ctx, x, y, w, h, C) {
    C = C || T;
    const body = C('#5b3a22'), dark = C('#3a2414'), antler = C('#cdb58c');
    // legs
    ctx.fillStyle = dark;
    const legTop = y + h * 0.42;
    for (const lx of [0.3, 0.4, 0.74, 0.84]) rr(ctx, x + w * lx - 5, legTop, 10, y + h - legTop, 4), ctx.fill();
    ctx.fillStyle = '#1b120a';
    for (const lx of [0.3, 0.4, 0.74, 0.84]) ctx.fillRect(x + w * lx - 6, y + h - 6, 12, 6);
    // body
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.6, y + h * 0.32, w * 0.34, h * 0.2, 0, 0, TAU);
    ctx.fill();
    // shoulder hump + neck
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + h * 0.45);
    ctx.quadraticCurveTo(x + w * 0.36, y + h * 0.02, x + w * 0.5, y + h * 0.12);
    ctx.lineTo(x + w * 0.2, y + h * 0.28);
    ctx.closePath();
    ctx.fill();
    // head (looking at the player)
    ctx.beginPath();
    ctx.moveTo(x + w * 0.28, y + h * 0.12);
    ctx.quadraticCurveTo(x + w * 0.12, y + h * 0.1, x + w * 0.02, y + h * 0.28);
    ctx.quadraticCurveTo(x + w * 0.0, y + h * 0.36, x + w * 0.08, y + h * 0.36);
    ctx.quadraticCurveTo(x + w * 0.2, y + h * 0.34, x + w * 0.3, y + h * 0.3);
    ctx.closePath();
    ctx.fill();
    // dewlap
    ctx.beginPath();
    ctx.ellipse(x + w * 0.2, y + h * 0.4, w * 0.025, h * 0.07, 0, 0, TAU);
    ctx.fill();
    // eye + nostril
    ctx.fillStyle = '#fff';
    circle(ctx, x + w * 0.17, y + h * 0.17, 3);
    ctx.fill();
    ctx.fillStyle = '#000';
    circle(ctx, x + w * 0.165, y + h * 0.17, 1.5);
    ctx.fill();
    circle(ctx, x + w * 0.04, y + h * 0.3, 2);
    ctx.fill();
    // palmate antlers
    ctx.fillStyle = antler;
    for (const side of [-1, 1]) {
      const ax = x + w * 0.24 + side * w * 0.07, ay = y + h * 0.06;
      ctx.beginPath();
      ctx.moveTo(ax, ay + 6);
      ctx.quadraticCurveTo(ax + side * w * 0.14, ay - h * 0.02, ax + side * w * 0.16, ay - h * 0.16);
      for (let i = 0; i < 4; i++) {
        const px = ax + side * w * (0.16 - i * 0.045);
        ctx.lineTo(px + side * 4, ay - h * 0.22 + (i % 2) * 6);
        ctx.lineTo(px - side * w * 0.02, ay - h * 0.15);
      }
      ctx.quadraticCurveTo(ax + side * 6, ay - h * 0.06, ax, ay + 6);
      ctx.fill();
    }
  };

  // =====================================================================
  // NEAR SCENERY (drawn at world scale behind the gameplay layer). (x, base) = left/centre, ground line
  // =====================================================================
  const near = (Art.near = {});
  function signBoard(ctx, x, base, bw, bh, postH, fill, border, text, textCol, font) {
    ctx.fillStyle = T('#6f6f6f');
    ctx.fillRect(x - bw * 0.35, base - postH, 5, postH);
    ctx.fillRect(x + bw * 0.35 - 5, base - postH, 5, postH);
    rr(ctx, x - bw / 2, base - postH - bh, bw, bh, 6);
    ctx.fillStyle = T(fill);
    ctx.fill();
    ctx.strokeStyle = T(border);
    ctx.lineWidth = 3;
    rr(ctx, x - bw / 2 + 4, base - postH - bh + 4, bw - 8, bh - 8, 4);
    ctx.stroke();
    ctx.fillStyle = T(textCol);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, base - postH - bh / 2 + 1);
  }
  near.sign_place = function (ctx, x, base, d, t, bs, font) {
    ctx.font = '26px ' + font;
    const tw = ctx.measureText(d.text).width;
    signBoard(ctx, x, base, tw + 40, 44, 60, '#1a5fae', '#ffffff', d.text, '#ffffff', '26px ' + font);
  };
  near.sign_region = function (ctx, x, base, d, t, bs, font) {
    signBoard(ctx, x, base, 190, 60, 56, '#6b3b1c', '#f3e6d0', '', '#fff', '26px ' + font);
    // Uppland coat of arms: golden orb on red
    const sx = x - 62, sy = base - 56 - 50;
    ctx.fillStyle = T('#c8102e');
    ctx.beginPath();
    ctx.moveTo(sx - 14, sy);
    ctx.lineTo(sx + 14, sy);
    ctx.lineTo(sx + 14, sy + 20);
    ctx.quadraticCurveTo(sx, sy + 36, sx - 14, sy + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = T('#f2c230');
    circle(ctx, sx, sy + 17, 7);
    ctx.fill();
    ctx.fillRect(sx - 1.5, sy + 3, 3, 8);
    ctx.fillRect(sx - 4, sy + 5, 8, 2.5);
    ctx.fillStyle = T('#ffffff');
    ctx.font = '26px ' + font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.text, x - 40, base - 56 - 29);
  };
  near.sign_dist = function (ctx, x, base, d, t, bs, font) {
    signBoard(ctx, x, base, 190, 42, 64, '#1a5fae', '#ffffff', d.text + '  ' + d.dist + ' ➜', '#ffffff', '22px ' + font);
  };
  near.sign_moose = function (ctx, x, base) {
    ctx.fillStyle = T('#777');
    ctx.fillRect(x - 2.5, base - 90, 5, 90);
    const cy = base - 118;
    ctx.fillStyle = T('#d42020');
    tri(ctx, x, cy - 34, x - 38, cy + 30, x + 38, cy + 30);
    ctx.fill();
    ctx.fillStyle = T('#ffd21c');
    tri(ctx, x, cy - 22, x - 27, cy + 23, x + 27, cy + 23);
    ctx.fill();
    ctx.save();
    ctx.translate(x - 16, cy - 4);
    Art.moose(ctx, 0, 0, 32, 24, () => '#111');
    ctx.restore();
  };
  near.fence = function (ctx, x, base, d, t, bs) {
    // Swedish roundpole fence (gärdsgård)
    const len = (d.len || 6) * bs;
    ctx.strokeStyle = T('#7a6a55');
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let xx = x; xx < x + len; xx += 22) {
      ctx.moveTo(xx, base - 4);
      ctx.lineTo(xx + 34, base - 44);
    }
    ctx.stroke();
    ctx.strokeStyle = T('#5c4e3d');
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let xx = x + 10; xx < x + len; xx += 66) {
      ctx.moveTo(xx, base);
      ctx.lineTo(xx, base - 56);
      ctx.moveTo(xx + 6, base);
      ctx.lineTo(xx + 6, base - 56);
    }
    ctx.stroke();
  };
  near.lupins = function (ctx, x, base, d, t) {
    const cols = ['#7b5bd6', '#d65ab0', '#9b7fe8', '#f1f1ff', '#c24fa0'];
    for (let i = 0; i < 7; i++) {
      const lx = x + i * 13 + (i % 2) * 4, h = 34 + ((i * 17) % 20);
      const sway = Math.sin(t * 2 + i) * 2;
      ctx.strokeStyle = T('#3f7a2c');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, base);
      ctx.lineTo(lx + sway, base - h);
      ctx.stroke();
      ctx.fillStyle = T(cols[i % cols.length]);
      for (let k = 0; k < 7; k++) {
        circle(ctx, lx + sway * (1 - k / 10), base - h + k * 3.2 - 6, 3.2 - k * 0.2);
        ctx.fill();
      }
      ctx.fillStyle = T('#4f8f37');
      ctx.beginPath();
      ctx.ellipse(lx - 5, base - 8, 6, 2.5, -0.4, 0, TAU);
      ctx.ellipse(lx + 5, base - 10, 6, 2.5, 0.4, 0, TAU);
      ctx.fill();
    }
  };
  near.mailbox = function (ctx, x, base) {
    ctx.fillStyle = T('#6b5a45');
    ctx.fillRect(x - 3, base - 50, 6, 50);
    ctx.fillStyle = T('#e6c100');
    rr(ctx, x - 16, base - 70, 32, 22, 8);
    ctx.fill();
    ctx.fillStyle = T('#1a4fa0');
    ctx.fillRect(x - 10, base - 64, 20, 4);
  };
  near.flagpole = function (ctx, x, base, d, t, bs) {
    ctx.strokeStyle = T('#f0f0f0');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - 190);
    ctx.stroke();
    // long Swedish pennant (vimpel)
    ctx.fillStyle = T('#006aa7');
    ctx.beginPath();
    ctx.moveTo(x, base - 186);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x + i * 9, base - 186 + Math.sin(t * 4 - i * 0.6) * 4 + i * 0.6);
    for (let i = 10; i >= 0; i--) ctx.lineTo(x + i * 9, base - 186 + 12 - i * 1.0 + Math.sin(t * 4 - i * 0.6) * 4);
    ctx.fill();
    ctx.fillStyle = T('#fecc00');
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) ctx.lineTo(x + i * 9, base - 181 + Math.sin(t * 4 - i * 0.6) * 4 + i * 0.1);
    for (let i = 10; i >= 0; i--) ctx.lineTo(x + i * 9, base - 178 - i * 0.2 + Math.sin(t * 4 - i * 0.6) * 4);
    ctx.fill();
  };
  near.runestone = function (ctx, x, base, d) {
    ctx.save();
    ctx.translate(x, base);
    ctx.rotate((((d.x * 37) % 11) - 5) * 0.012); // each stone leans a little
    runestone(ctx, -28, -100, 56, 102, d.x, T, 2.5, 1);
    ctx.restore();
  };
  near.bales = function (ctx, x, base) {
    for (let i = 0; i < 3; i++) {
      const bx = x + i * 46 + (i === 2 ? -23 : 0), by = base - (i === 2 ? 40 : 0);
      ctx.fillStyle = T('#f4f4ef');
      rr(ctx, bx, by - 40, 44, 40, 12);
      ctx.fill();
      ctx.strokeStyle = T('#9da39c');
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };
  function birchTree(ctx, x, base, h, t) {
    ctx.fillStyle = T('#f2f0ea');
    ctx.fillRect(x - 5, base - h, 10, h);
    ctx.fillStyle = T('#222');
    for (let yy = base - h + 12; yy < base - 6; yy += 17) ctx.fillRect(x - 5 + ((yy * 7) % 5), yy, 6, 3);
    ctx.fillStyle = T('#7fbf4c');
    const sway = Math.sin(t * 1.5 + x) * 3;
    for (const [dx, dy, r] of [[0, -h - 10, 34], [-26, -h + 18, 26], [26, -h + 16, 26], [-8, -h + 40, 22], [14, -h + 36, 22]]) {
      circle(ctx, x + dx + sway, base + dy, r);
      ctx.fill();
    }
    ctx.fillStyle = T('#a4d86a');
    circle(ctx, x - 10 + sway, base - h - 18, 14);
    ctx.fill();
  }
  function pineTree(ctx, x, base, h, col) {
    ctx.fillStyle = T('#4a3120');
    ctx.fillRect(x - 5, base - h * 0.25, 10, h * 0.25);
    ctx.fillStyle = T(col || '#2c5a34');
    for (let i = 0; i < 4; i++) {
      const w = h * (0.42 - i * 0.08), yb = base - h * 0.15 - i * h * 0.2;
      tri(ctx, x - w, yb, x, yb - h * 0.38, x + w, yb);
      ctx.fill();
    }
  }
  Art.birchTree = birchTree;
  Art.pineTree = pineTree;
  near.birch = (ctx, x, base, d, t) => birchTree(ctx, x, base, 150, t);
  near.pine = (ctx, x, base) => pineTree(ctx, x, base, 190);
  near.maypole = function (ctx, x, base, d, t) {
    // midsommarstång
    ctx.strokeStyle = T('#3f7a2c');
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - 230);
    ctx.moveTo(x - 70, base - 170);
    ctx.lineTo(x + 70, base - 170);
    ctx.stroke();
    ctx.lineWidth = 7;
    for (const sx of [-1, 1]) {
      circle(ctx, x + sx * 58, base - 138, 28);
      ctx.stroke();
    }
    // flowers + ribbons
    const fl = ['#ffd21c', '#ff5f7a', '#ffffff', '#6b8cff'];
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = T(fl[i % 4]);
      const py = base - 20 - i * 10;
      circle(ctx, x + (i % 2 ? 4 : -4), py, 3);
      ctx.fill();
    }
    ctx.strokeStyle = T('#006aa7');
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) ctx.lineTo(x + 30 + Math.sin(t * 3 + i) * 3, base - 225 + i * 8);
    ctx.stroke();
    ctx.strokeStyle = T('#fecc00');
    ctx.beginPath();
    for (let i = 0; i < 10; i++) ctx.lineTo(x - 30 + Math.sin(t * 3 + i + 1) * 3, base - 225 + i * 8);
    ctx.stroke();
  };
  near.bike = function (ctx, x, base, d) {
    const col = T(d.color || '#d23c3c');
    ctx.strokeStyle = T('#1a1a1a');
    ctx.lineWidth = 3;
    circle(ctx, x - 22, base - 17, 16);
    ctx.stroke();
    circle(ctx, x + 24, base - 17, 16);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x - 22, base - 17);
    ctx.lineTo(x, base - 17);
    ctx.lineTo(x - 8, base - 38);
    ctx.lineTo(x + 16, base - 38);
    ctx.lineTo(x, base - 17);
    ctx.moveTo(x + 16, base - 38);
    ctx.lineTo(x + 24, base - 17);
    ctx.moveTo(x - 22, base - 17);
    ctx.lineTo(x - 8, base - 38);
    ctx.stroke();
    ctx.strokeStyle = T('#222');
    ctx.beginPath();
    ctx.moveTo(x + 16, base - 38);
    ctx.lineTo(x + 18, base - 48);
    ctx.lineTo(x + 26, base - 49);
    ctx.moveTo(x - 12, base - 42);
    ctx.lineTo(x - 2, base - 42);
    ctx.stroke();
    ctx.fillStyle = T('#8a5a2b');
    ctx.fillRect(x + 20, base - 46, 14, 9);
  };
  near.lamp = function (ctx, x, base, d, t) {
    ctx.fillStyle = T('#2c3036');
    ctx.fillRect(x - 3, base - 150, 6, 150);
    ctx.fillRect(x - 3, base - 150, 26, 5);
    ctx.fillStyle = T('#2c3036');
    rr(ctx, x + 12, base - 148, 22, 10, 3);
    ctx.fill();
    const dk = Art.dark();
    if (dk > 0.2) {
      const a = Math.min(1, (dk - 0.2) * 2);
      const g = ctx.createRadialGradient(x + 23, base - 138, 2, x + 23, base - 138, 70);
      g.addColorStop(0, 'rgba(255,220,140,' + 0.55 * a + ')');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      circle(ctx, x + 23, base - 138, 70);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,236,170,' + a + ')';
      ctx.fillRect(x + 15, base - 139, 16, 4);
    }
  };
  near.bench = function (ctx, x, base) {
    ctx.fillStyle = T('#7a4f2a');
    ctx.fillRect(x - 30, base - 26, 60, 6);
    ctx.fillRect(x - 30, base - 44, 60, 5);
    ctx.fillStyle = T('#2d2d2d');
    ctx.fillRect(x - 26, base - 26, 4, 26);
    ctx.fillRect(x + 22, base - 26, 4, 26);
  };
  near.student = function (ctx, x, base) {
    // a white student cap on a bollard — Uppsala tradition
    ctx.fillStyle = T('#2d2d2d');
    rr(ctx, x - 12, base - 50, 24, 50, 6);
    ctx.fill();
    ctx.fillStyle = T('#ffffff');
    rr(ctx, x - 16, base - 68, 32, 16, 6);
    ctx.fill();
    ctx.fillStyle = T('#111');
    ctx.fillRect(x - 18, base - 55, 36, 5);
    ctx.fillStyle = T('#e2b400');
    circle(ctx, x, base - 62, 3);
    ctx.fill();
  };
  near.crossing = function (ctx, x, base) {
    // railway crossing sign (X)
    ctx.fillStyle = T('#777');
    ctx.fillRect(x - 3, base - 140, 6, 140);
    ctx.save();
    ctx.translate(x, base - 150);
    for (const a of [0.6, -0.6]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = T('#ffffff');
      ctx.fillRect(-40, -7, 80, 14);
      ctx.fillStyle = T('#d42020');
      ctx.fillRect(-40, -7, 12, 14);
      ctx.fillRect(-4, -7, 8, 14);
      ctx.fillRect(28, -7, 12, 14);
      ctx.restore();
    }
    ctx.restore();
  };
  near.hall_front = function (ctx, x, base, d, t, bs, font) {
    // big sports-hall facade; Vippe runs in through the lit doors
    const w = 18 * bs, h = 420;
    ctx.fillStyle = T('#cfd6dd');
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = T('#b9c2cb');
    for (let xx = x + 30; xx < x + w; xx += 60) ctx.fillRect(xx, base - h + 70, 4, h - 70);
    ctx.fillStyle = T('#1c4f9c');
    ctx.fillRect(x, base - h, w, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = '46px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('INNEBANDYHALLEN', x + w * 0.42, base - h + 36);
    // windows
    for (let wx = x + 40; wx < x + w * 0.6; wx += 90) {
      ctx.fillStyle = lit() ? '#ffe3a0' : T('#9fc2dc');
      ctx.fillRect(wx, base - h + 110, 60, 80);
    }
    // glass doors
    const dx = x + 12.6 * bs, dw = 4.6 * bs, dh = 200;
    ctx.fillStyle = lit() ? '#fff1c4' : T('#bfe0f5');
    ctx.fillRect(dx, base - dh, dw, dh);
    ctx.strokeStyle = T('#4d5864');
    ctx.lineWidth = 8;
    ctx.strokeRect(dx, base - dh, dw, dh);
    ctx.beginPath();
    ctx.moveTo(dx + dw / 2, base - dh);
    ctx.lineTo(dx + dw / 2, base);
    ctx.stroke();
    ctx.fillStyle = '#1c4f9c';
    ctx.font = '22px ' + font;
    ctx.fillText('VÄLKOMMEN!', dx + dw / 2, base - dh - 22);
  };
  near.finish = function (ctx, x, base, d, t, bs, font) {
    // finish gate
    for (const px of [x - 70, x + 70]) {
      ctx.fillStyle = T('#e8e8e8');
      ctx.fillRect(px - 6, base - 300, 12, 300);
    }
    ctx.fillStyle = '#111';
    ctx.fillRect(x - 76, base - 320, 152, 56);
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 4; j++) {
        if ((i + j) % 2) continue;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 76 + i * 9.5, base - 320 + j * 14, 9.5, 14);
      }
    ctx.fillStyle = '#ffd200';
    ctx.font = '30px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText('MÅL', x, base - 292);
    ctx.fillText('MÅL', x, base - 292);
  };

  // =====================================================================
  // MID LAYER LANDMARKS — (x, base) = centre, horizon line
  // =====================================================================
  const mid = (Art.mid = {});
  function windowRect(ctx, x, y, w, h, seed) {
    const on = lit() && U.hash(seed) > 0.35;
    ctx.fillStyle = on ? '#ffd27a' : T('#9ab9cf');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = T('#f6f3ea');
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
  mid.cottage = function (ctx, x, base, d) {
    const w = 160, h = 72;
    const wall = T(d.color || '#9e2a22');
    ctx.fillStyle = wall;
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = T('#f4f1ea');
    ctx.fillRect(x - w / 2, base - h, 7, h);
    ctx.fillRect(x + w / 2 - 7, base - h, 7, h);
    ctx.fillStyle = T('#34373e');
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 12, base - h);
    ctx.lineTo(x - w / 2 + 28, base - h - 50);
    ctx.lineTo(x + w / 2 - 28, base - h - 50);
    ctx.lineTo(x + w / 2 + 12, base - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = T('#7a2a22');
    ctx.fillRect(x + 30, base - h - 66, 14, 30);
    windowRect(ctx, x - 55, base - h + 18, 22, 26, x);
    windowRect(ctx, x + 32, base - h + 18, 22, 26, x + 1);
    ctx.fillStyle = T('#f4f1ea');
    ctx.fillRect(x - 13, base - 46, 26, 46);
    ctx.fillStyle = T('#2d5c7a');
    ctx.fillRect(x - 9, base - 42, 18, 42);
  };
  mid.barn = function (ctx, x, base) {
    const w = 230, h = 100;
    ctx.fillStyle = T('#8e241c');
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = T('#3a3d45');
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 10, base - h);
    ctx.lineTo(x - w / 2 + 20, base - h - 50);
    ctx.lineTo(x, base - h - 70);
    ctx.lineTo(x + w / 2 - 20, base - h - 50);
    ctx.lineTo(x + w / 2 + 10, base - h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#f4f1ea');
    ctx.lineWidth = 5;
    ctx.strokeRect(x - 40, base - 80, 80, 80);
    ctx.beginPath();
    ctx.moveTo(x - 40, base - 80);
    ctx.lineTo(x + 40, base);
    ctx.moveTo(x + 40, base - 80);
    ctx.lineTo(x - 40, base);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let xx = x - w / 2 + 12; xx < x + w / 2; xx += 12) {
      ctx.moveTo(xx, base - h);
      ctx.lineTo(xx, base);
    }
    ctx.stroke();
  };
  mid.church = function (ctx, x, base) {
    // white medieval Uppland church + wooden bell tower
    ctx.fillStyle = T('#ecebe3');
    ctx.fillRect(x - 90, base - 90, 190, 90);
    ctx.fillStyle = T('#3b3f47');
    tri(ctx, x - 100, base - 90, x + 5, base - 160, x + 110, base - 90);
    ctx.fill();
    ctx.fillStyle = T('#e6e5dc');
    ctx.fillRect(x - 150, base - 170, 62, 170);
    ctx.fillStyle = T('#2a2d33');
    tri(ctx, x - 156, base - 170, x - 119, base - 280, x - 82, base - 170);
    ctx.fill();
    ctx.strokeStyle = T('#c9a227');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 119, base - 280);
    ctx.lineTo(x - 119, base - 300);
    ctx.moveTo(x - 126, base - 292);
    ctx.lineTo(x - 112, base - 292);
    ctx.stroke();
    for (const wx of [x - 50, x + 10, x + 60]) {
      ctx.fillStyle = lit() ? '#ffcf70' : T('#6f7f8f');
      ctx.beginPath();
      ctx.moveTo(wx, base - 30);
      ctx.lineTo(wx, base - 60);
      ctx.arc(wx + 8, base - 60, 8, Math.PI, 0);
      ctx.lineTo(wx + 16, base - 30);
      ctx.closePath();
      ctx.fill();
    }
    // klockstapel
    ctx.fillStyle = T('#5a2a22');
    ctx.fillRect(x + 150, base - 110, 44, 110);
    ctx.fillStyle = T('#2b1d18');
    tri(ctx, x + 142, base - 110, x + 172, base - 190, x + 202, base - 110);
    ctx.fill();
    ctx.fillStyle = T('#1c1c1c');
    ctx.fillRect(x + 160, base - 100, 24, 26);
  };
  mid.mounds = function (ctx, x, base) {
    // the three royal mounds of Gamla Uppsala
    for (const [dx, w, h] of [[-280, 250, 100], [0, 290, 120], [290, 250, 105]]) {
      const g = ctx.createLinearGradient(0, base - h, 0, base);
      g.addColorStop(0, T('#8fbf5a'));
      g.addColorStop(1, T('#5a8a3a'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + dx - w / 2, base);
      ctx.bezierCurveTo(x + dx - w * 0.35, base - h * 1.25, x + dx + w * 0.35, base - h * 1.25, x + dx + w / 2, base);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = T('#b8d98a');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + dx - w * 0.3, base - h * 0.62);
      ctx.bezierCurveTo(x + dx - w * 0.2, base - h * 0.92, x + dx + w * 0.05, base - h * 0.95, x + dx + w * 0.12, base - h * 0.9);
      ctx.stroke();
    }
  };
  mid.oldchurch = function (ctx, x, base) {
    ctx.fillStyle = T('#a39d92');
    ctx.fillRect(x - 60, base - 85, 170, 85);
    ctx.fillStyle = T('#4a3a34');
    tri(ctx, x - 68, base - 85, x + 25, base - 135, x + 118, base - 85);
    ctx.fill();
    ctx.fillStyle = T('#9a948a');
    ctx.fillRect(x - 130, base - 160, 76, 160);
    ctx.fillStyle = T('#3a3232');
    tri(ctx, x - 136, base - 160, x - 92, base - 205, x - 48, base - 160);
    ctx.fill();
    ctx.fillStyle = lit() ? '#ffcf70' : T('#5d6570');
    ctx.fillRect(x - 100, base - 140, 16, 26);
    ctx.fillRect(x - 20, base - 60, 14, 28);
    ctx.fillRect(x + 40, base - 60, 14, 28);
  };
  const PASTEL = ['#ecc877', '#e6a57e', '#d9d2b6', '#c97b63', '#f0dca8', '#b8c4a0', '#e3b7a6', '#d8c08a'];
  mid.cityrow = function (ctx, x, base, d) {
    const rnd = U.rng((d.seed || 1) * 101);
    let cx = x - 300;
    while (cx < x + 300) {
      const w = 70 + rnd() * 50, h = 100 + rnd() * 90, c = PASTEL[Math.floor(rnd() * PASTEL.length)];
      ctx.fillStyle = T(c);
      ctx.fillRect(cx, base - h, w, h);
      ctx.fillStyle = T('#4a3b35');
      if (rnd() > 0.5) {
        tri(ctx, cx - 4, base - h, cx + w / 2, base - h - 34, cx + w + 4, base - h);
        ctx.fill();
      } else ctx.fillRect(cx - 3, base - h - 8, w + 6, 10);
      for (let wy = base - h + 18; wy < base - 30; wy += 30)
        for (let wx = cx + 10; wx < cx + w - 18; wx += 22) windowRect(ctx, wx, wy, 12, 18, wx * 3 + wy);
      cx += w + 2;
    }
  };
  mid.castle = function (ctx, x, base) {
    // Uppsala castle: long pink building with round, copper-domed towers, on its hill
    ctx.fillStyle = T('#5f8f45');
    ctx.beginPath();
    ctx.moveTo(x - 420, base);
    ctx.quadraticCurveTo(x, base - 110, x + 420, base);
    ctx.closePath();
    ctx.fill();
    const hb = base - 70;
    ctx.fillStyle = T('#e8a397');
    ctx.fillRect(x - 250, hb - 120, 480, 120);
    ctx.fillStyle = T('#6b4a44');
    ctx.fillRect(x - 256, hb - 132, 492, 14);
    for (let wy = hb - 105; wy < hb - 20; wy += 34)
      for (let wx = x - 225; wx < x + 215; wx += 30) windowRect(ctx, wx, wy, 14, 20, wx + wy);
    // towers
    for (const [tx, tw, th] of [[x - 260, 110, 180], [x + 250, 84, 160]]) {
      ctx.fillStyle = T('#e19b8f');
      ctx.fillRect(tx - tw / 2, hb - th, tw, th);
      ctx.fillStyle = T('#4f8b76');
      ctx.beginPath();
      ctx.moveTo(tx - tw / 2 - 6, hb - th);
      ctx.bezierCurveTo(tx - tw / 2, hb - th - tw * 0.8, tx + tw / 2, hb - th - tw * 0.8, tx + tw / 2 + 6, hb - th);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(tx - 6, hb - th - tw * 0.72, 12, 26);
      ctx.fillStyle = T('#c9a227');
      circle(ctx, tx, hb - th - tw * 0.72 - 8, 5);
      ctx.fill();
      for (let wy = hb - th + 26; wy < hb - 20; wy += 36) windowRect(ctx, tx - 8, wy, 16, 22, tx + wy);
    }
  };
  mid.stadium = function (ctx, x, base, d, t) {
    // football stand with blue-black flags and floodlights
    ctx.fillStyle = T('#8a9098');
    ctx.beginPath();
    ctx.moveTo(x - 190, base);
    ctx.lineTo(x - 170, base - 90);
    ctx.lineTo(x + 170, base - 90);
    ctx.lineTo(x + 190, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = T('#2a5aa8');
    for (let r = 0; r < 4; r++) ctx.fillRect(x - 165 + r * 5, base - 78 + r * 18, 330 - r * 10, 8);
    ctx.fillStyle = T('#5d636b');
    ctx.fillRect(x - 185, base - 104, 370, 14);
    for (let i = 0; i < 5; i++) {
      const fx = x - 150 + i * 75;
      ctx.fillStyle = T('#dddddd');
      ctx.fillRect(fx, base - 150, 3, 48);
      for (let s = 0; s < 4; s++) {
        ctx.fillStyle = T(s % 2 ? '#111111' : '#1d5fc4');
        ctx.beginPath();
        const yy = base - 150 + s * 5;
        ctx.moveTo(fx + 3, yy);
        ctx.lineTo(fx + 30, yy + Math.sin(t * 4 + i) * 3);
        ctx.lineTo(fx + 30, yy + 5 + Math.sin(t * 4 + i) * 3);
        ctx.lineTo(fx + 3, yy + 5);
        ctx.fill();
      }
    }
    for (const lx of [x - 230, x + 230]) {
      ctx.fillStyle = T('#4d5259');
      ctx.fillRect(lx - 4, base - 260, 8, 260);
      ctx.fillStyle = Art.dark() > 0.15 ? '#fff6d0' : T('#cfd4da');
      ctx.fillRect(lx - 24, base - 276, 48, 22);
      if (Art.dark() > 0.15) {
        const g = ctx.createRadialGradient(lx, base - 265, 5, lx, base - 265, 120);
        g.addColorStop(0, 'rgba(255,245,200,0.5)');
        g.addColorStop(1, 'rgba(255,245,200,0)');
        ctx.fillStyle = g;
        circle(ctx, lx, base - 265, 120);
        ctx.fill();
      }
    }
  };
  mid.cathedral = function (ctx, x, base) {
    // Uppsala domkyrka: red brick, twin west towers with tall slender spires
    const brick = T('#9b3b2a'), brickD = T('#7c2d20'), spire = T('#2f4a45');
    // nave
    ctx.fillStyle = brickD;
    ctx.fillRect(x + 50, base - 170, 380, 170);
    ctx.fillStyle = T('#3e3431');
    tri(ctx, x + 45, base - 170, x + 240, base - 225, x + 435, base - 170);
    ctx.fill();
    ctx.fillStyle = spire;
    tri(ctx, x + 250, base - 215, x + 262, base - 300, x + 274, base - 215);
    ctx.fill();
    for (let wx = x + 80; wx < x + 420; wx += 50) {
      ctx.fillStyle = lit() ? '#ffcf70' : T('#3d4d63');
      ctx.beginPath();
      ctx.moveTo(wx, base - 30);
      ctx.lineTo(wx, base - 110);
      ctx.lineTo(wx + 11, base - 132);
      ctx.lineTo(wx + 22, base - 110);
      ctx.lineTo(wx + 22, base - 30);
      ctx.closePath();
      ctx.fill();
    }
    // towers
    for (const tx of [x - 55, x + 55]) {
      ctx.fillStyle = brick;
      ctx.fillRect(tx - 36, base - 250, 72, 250);
      ctx.fillStyle = T('#b8b0a0');
      ctx.fillRect(tx - 38, base - 256, 76, 8);
      ctx.fillStyle = spire;
      tri(ctx, tx - 34, base - 256, tx, base - 470, tx + 34, base - 256);
      ctx.fill();
      ctx.fillStyle = T('#c9a227');
      circle(ctx, tx, base - 474, 5);
      ctx.fill();
      ctx.fillStyle = T('#e9dfc8');
      circle(ctx, tx, base - 200, 12);
      ctx.fill();
      ctx.fillStyle = T('#2a2a2a');
      circle(ctx, tx, base - 200, 9);
      ctx.fill();
      ctx.fillStyle = lit() ? '#ffcf70' : T('#3d4d63');
      ctx.fillRect(tx - 8, base - 160, 16, 46);
    }
    // west front between the towers
    ctx.fillStyle = brick;
    ctx.fillRect(x - 20, base - 190, 40, 190);
    ctx.fillStyle = lit() ? '#ffcf70' : T('#344660');
    circle(ctx, x, base - 150, 26);
    ctx.fill();
    ctx.strokeStyle = T('#e9dfc8');
    ctx.lineWidth = 3;
    circle(ctx, x, base - 150, 26);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x, base - 150);
      ctx.lineTo(x + Math.cos((i * TAU) / 8) * 26, base - 150 + Math.sin((i * TAU) / 8) * 26);
      ctx.stroke();
    }
    ctx.fillStyle = T('#2a1d18');
    ctx.beginPath();
    ctx.moveTo(x - 22, base);
    ctx.lineTo(x - 22, base - 70);
    ctx.lineTo(x, base - 95);
    ctx.lineTo(x + 22, base - 70);
    ctx.lineTo(x + 22, base);
    ctx.closePath();
    ctx.fill();
  };
  mid.willows = function (ctx, x, base, d, t) {
    for (const dx of [-140, 0, 150]) {
      const tx = x + dx;
      ctx.fillStyle = T('#4d3a28');
      ctx.fillRect(tx - 7, base - 110, 14, 110);
      ctx.strokeStyle = T('#6e9c3f');
      ctx.lineWidth = 3;
      for (let i = -9; i <= 9; i++) {
        const sway = Math.sin(t * 1.3 + i * 0.4) * 5;
        ctx.beginPath();
        ctx.moveTo(tx + i * 7, base - 150 + Math.abs(i) * 3);
        ctx.quadraticCurveTo(tx + i * 11, base - 120, tx + i * 12 + sway, base - 40 + Math.abs(i) * 2);
        ctx.stroke();
      }
      ctx.fillStyle = T('#7fae4a');
      ctx.beginPath();
      ctx.ellipse(tx, base - 150, 75, 30, 0, 0, TAU);
      ctx.fill();
    }
  };
  mid.farm = function (ctx, x, base, d) {
    ctx.fillStyle = T(d.color || '#f2efe6');
    ctx.fillRect(x - 70, base - 90, 140, 90);
    ctx.fillStyle = T('#3a3d45');
    tri(ctx, x - 80, base - 90, x, base - 140, x + 80, base - 90);
    ctx.fill();
    for (const wx of [x - 50, x - 15, x + 20]) windowRect(ctx, wx, base - 70, 18, 24, wx);
    mid.barn(ctx, x + 230, base, {});
  };
  mid.hall = function (ctx, x, base, d, t, font) {
    ctx.fillStyle = T('#c9d1d8');
    ctx.fillRect(x - 220, base - 150, 440, 150);
    ctx.fillStyle = T('#1c4f9c');
    ctx.fillRect(x - 220, base - 150, 440, 34);
    ctx.fillStyle = T('#ffffff');
    ctx.font = '24px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STORVRETA', x, base - 133);
    for (let wx = x - 200; wx < x + 200; wx += 40) windowRect(ctx, wx, base - 100, 26, 30, wx);
  };
  mid.villas = function (ctx, x, base, d, t) {
    const rnd = U.rng((d.seed || 1) * 37);
    const cols = ['#f2efe6', '#ecc877', '#a33a2c', '#9fb3c8', '#e6d5b8'];
    for (let i = 0; i < 3; i++) {
      const hx = x - 220 + i * 210, w = 120 + rnd() * 30, h = 70 + rnd() * 20;
      ctx.fillStyle = T(cols[Math.floor(rnd() * cols.length)]);
      ctx.fillRect(hx - w / 2, base - h, w, h);
      ctx.fillStyle = T('#3a3d45');
      tri(ctx, hx - w / 2 - 10, base - h, hx, base - h - 45, hx + w / 2 + 10, base - h);
      ctx.fill();
      windowRect(ctx, hx - w / 2 + 16, base - h + 18, 22, 24, hx);
      windowRect(ctx, hx + w / 2 - 38, base - h + 18, 22, 24, hx + 5);
      pineTree(ctx, hx + 105, base, 110, '#23492c');
    }
  };
  mid.home = function (ctx, x, base, d, t, font) {
    // Vippe's home: yellow house, lights on
    ctx.fillStyle = T('#f0cf6a');
    ctx.fillRect(x - 110, base - 120, 220, 120);
    ctx.fillStyle = T('#f6f3ea');
    ctx.fillRect(x - 110, base - 120, 8, 120);
    ctx.fillRect(x + 102, base - 120, 8, 120);
    ctx.fillStyle = T('#3a3d45');
    tri(ctx, x - 125, base - 120, x, base - 190, x + 125, base - 120);
    ctx.fill();
    for (const wx of [x - 80, x - 30, x + 40]) {
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(wx, base - 95, 28, 32);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, base - 95, 28, 32);
    }
    ctx.fillStyle = T('#2d5c7a');
    ctx.fillRect(x + 10, base - 52, 26, 52);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '18px ' + font;
    ctx.textAlign = 'center';
    ctx.fillText('HEMMA', x, base - 140);
  };
  mid.pines = function (ctx, x, base) {
    for (let i = 0; i < 7; i++) pineTree(ctx, x - 180 + i * 60 + (i % 2) * 14, base, 120 + ((i * 37) % 60));
  };
  mid.birches = function (ctx, x, base, d, t) {
    for (let i = 0; i < 4; i++) birchTree(ctx, x - 150 + i * 95, base, 110 + ((i * 29) % 40), t);
  };
  mid.moose = function (ctx, x, base) {
    Art.moose(ctx, x - 36, base - 56, 72, 56, T);
  };
})();
