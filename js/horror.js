// VippeDash — level 6 "Mardrömmen" art: bloody nuns, killer clowns, bones and blood.
// Loaded right after art.js. Everything vector, no image files. See Art.horror for the registry.
(function () {
  const VD = (window.VD = window.VD || {});
  const U = VD.U;
  const Art = VD.Art;
  const TAU = Math.PI * 2;
  const T = Art.T, TL = Art.TL, rr = Art.rr;

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
  function star(ctx, cx, cy, r, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
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
  // a flickering candle flame; (x, y) is the base (wick), it burns upward by h
  function flame(ctx, x, y, h, t, seed) {
    const fl = Math.sin(t * 9 + seed * 3) * 0.15 + Math.sin(t * 23 + seed) * 0.06;
    const w = h * 0.34;
    ctx.fillStyle = '#ffdf8a';
    ctx.beginPath();
    ctx.moveTo(x, y - h * (1 + fl));
    ctx.quadraticCurveTo(x + w, y - h * 0.35, x + w * 0.25, y);
    ctx.quadraticCurveTo(x, y - h * 0.1, x - w * 0.25, y);
    ctx.quadraticCurveTo(x - w, y - h * 0.35, x, y - h * (1 + fl));
    ctx.fill();
    ctx.fillStyle = PAL.flame;
    circle(ctx, x, y - h * 0.32, w * 0.34);
    ctx.fill();
    ctx.fillStyle = T('#8a7530');
    rr(ctx, x - w * 0.16, y - 1, w * 0.32, h * 0.14, 2);
    ctx.fill();
  }

  // ---------- palette (see kontrakt.md) ----------
  const PAL = {
    night0: '#07040a', night1: '#1a0710', bloodMoon: '#b3121e',
    stone: '#2a2628', stoneL: '#3b3538',
    bloodDry: '#7a0010', bloodFresh: '#c0081a',
    habit: '#0d0b10', wimple: '#e8e2d6', eyeGlow: '#f4f8ff',
    flame: '#ffb347',
    clownWhite: '#efe9dc', clownNose: '#d4001a', stripeA: '#6a1a8a', stripeB: '#f0c020',
    strobe: '#e8f0ff',
  };

  const horror = (Art.horror = {});

  // =====================================================================
  // HAZARDS — nun, jack-in-the-box, pendulum, balloon
  // =====================================================================
  horror.hazard = {};

  // the bloody nun: fills a 1 x 1.4 block box, centred at (cx, cy) in px.
  // black veil/hood -> white wimple band -> pale face, then a habit that flares to a ragged hem.
  horror.hazard.nun = function (ctx, cx, cy, bs, t, seed, glow, style) {
    const w = bs, h = bs * 1.4;
    const top = cy - h / 2, bot = cy + h / 2;
    const sway = Math.sin(t * 2 + seed) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sway);
    ctx.translate(-cx, -cy);
    ctx.lineJoin = 'round';

    // ---- one continuous black silhouette: hood peak -> shoulders -> flared, ragged-hemmed habit ----
    const peakHalf = w * 0.26, hoodHalf = w * 0.44, shoulderHalf = w * 0.49;
    const peakY = top + h * 0.01, hoodBaseY = top + h * 0.3, shoulderY = top + h * 0.38;
    const flut = Math.sin(t * 6 + seed * 2) * bs * 0.07;
    const hemHalf = w * 0.5, hemY = bot - bs * 0.02;

    function silhouette() {
      ctx.beginPath();
      ctx.moveTo(cx - hemHalf, hemY);
      ctx.quadraticCurveTo(cx - shoulderHalf * 1.02, top + h * 0.62, cx - hoodHalf, shoulderY);
      ctx.quadraticCurveTo(cx - hoodHalf * 1.04, hoodBaseY, cx - peakHalf, peakY + h * 0.03);
      ctx.quadraticCurveTo(cx - peakHalf * 0.4, peakY - h * 0.02, cx, peakY);
      ctx.quadraticCurveTo(cx + peakHalf * 0.4, peakY - h * 0.02, cx + peakHalf, peakY + h * 0.03);
      ctx.quadraticCurveTo(cx + hoodHalf * 1.04, hoodBaseY, cx + hoodHalf, shoulderY);
      ctx.quadraticCurveTo(cx + shoulderHalf * 1.02, top + h * 0.62, cx + hemHalf, hemY);
      const teeth = 6;
      for (let i = 0; i <= teeth; i++) {
        const u = i / teeth;
        const x = cx + hemHalf - u * (hemHalf * 2) + flut * Math.sin(u * 5 + seed);
        const y = hemY - (i % 2 === 0 ? 0 : bs * 0.14);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    // soft rim-light halo peeking out from behind the black fill
    silhouette();
    ctx.strokeStyle = 'rgba(150,120,180,0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();
    silhouette();
    ctx.fillStyle = PAL.habit;
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // arms with long pale hands, hanging past the sleeves
    const skinPale = '#d8d0c0';
    for (const ex of [-1, 1]) {
      ctx.fillStyle = PAL.habit;
      rr(ctx, cx + ex * w * 0.4 - w * 0.08, shoulderY + h * 0.02, w * 0.16, h * 0.3, w * 0.07);
      ctx.fill();
      ctx.strokeStyle = glow || '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const hx = cx + ex * w * 0.4, hy = shoulderY + h * 0.34;
      ctx.fillStyle = skinPale;
      ctx.beginPath();
      ctx.ellipse(hx, hy, w * 0.06, h * 0.05, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      for (let fi = -1; fi <= 1; fi++) {
        ctx.beginPath();
        ctx.moveTo(hx + fi * w * 0.025, hy + h * 0.03);
        ctx.lineTo(hx + fi * w * 0.03, hy + h * 0.09);
        ctx.stroke();
      }
    }

    // white wimple/coif band framing the face, tucked inside the hood
    const wimpleCx = cx, wimpleCy = top + h * 0.2;
    ctx.fillStyle = TL(PAL.wimple);
    ctx.beginPath();
    ctx.ellipse(wimpleCx, wimpleCy, w * 0.2, h * 0.145, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = PAL.bloodDry;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wimpleCx - w * 0.1, wimpleCy - h * 0.12);
    ctx.lineTo(wimpleCx - w * 0.14, wimpleCy + h * 0.08);
    ctx.moveTo(wimpleCx + w * 0.15, wimpleCy - h * 0.14);
    ctx.lineTo(wimpleCx + w * 0.2, wimpleCy + h * 0.02);
    ctx.stroke();

    // corpse-pale oval face, tightly framed by the wimple
    ctx.fillStyle = skinPale;
    ctx.beginPath();
    ctx.ellipse(cx, wimpleCy + h * 0.01, w * 0.145, h * 0.12, 0, 0, TAU);
    ctx.fill();
    // dark eye sockets
    ctx.fillStyle = 'rgba(30,15,20,0.55)';
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * w * 0.075, wimpleCy - h * 0.02, w * 0.065, h * 0.06, 0, 0, TAU);
      ctx.fill();
    }
    // glowing, pupil-less eyes with a rare blink
    const blink = Math.sin(t * 0.7 + seed) > 0.92 ? 0.15 : 1;
    ctx.save();
    ctx.shadowColor = PAL.eyeGlow;
    ctx.shadowBlur = 8;
    ctx.fillStyle = PAL.eyeGlow; // always white-glowing, pupil-less — the glow colour is for the outline only
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * w * 0.075, wimpleCy - h * 0.02, w * 0.045, h * 0.035 * blink, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // blood running from the eyes, down the face and onto the wimple
    ctx.strokeStyle = PAL.bloodFresh;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const drip = (t * 0.6 + seed) % 1;
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + ex * w * 0.075, wimpleCy);
      ctx.lineTo(cx + ex * w * 0.095, wimpleCy + h * 0.24 * drip);
      ctx.stroke();
    }
    ctx.restore();
  };

  // jack-in-the-box's head, spring and open lid; the box itself is block.jackbox.
  // (x, y) = top-left of the 1x1 box in px. k = pop amount 0..1. riseBlocks = mv.rise.
  horror.hazard.jack = function (ctx, x, y, bs, k, riseBlocks, t, seed, glow) {
    if (k <= 0.001) return;
    const boxTop = y, cx = x + bs * 0.5;
    const headY = y + bs * 0.45 - k * riseBlocks * bs;
    // open lid, swung back
    ctx.save();
    ctx.translate(x + bs * 0.15, boxTop);
    ctx.rotate(-Math.min(1, k * 3) * 1.3);
    ctx.fillStyle = TL(PAL.stripeB);
    rr(ctx, 0, -bs * 0.12, bs * 0.7, bs * 0.12, 3);
    ctx.fill();
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    // spring: a zigzag from the box top up to the head
    ctx.strokeStyle = '#8a8a92';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const coils = 5;
    ctx.beginPath();
    ctx.moveTo(cx, boxTop);
    for (let i = 1; i <= coils; i++) {
      const u = i / coils;
      const yy = boxTop - u * (boxTop - headY - bs * 0.15);
      const xx = cx + (i % 2 ? bs * 0.14 : -bs * 0.14);
      ctx.lineTo(xx, yy);
    }
    ctx.lineTo(cx, headY + bs * 0.15);
    ctx.stroke();
    // head: white face paint, red nose, purple diamonds, needle grin, hair tufts
    const hy = headY;
    ctx.fillStyle = PAL.clownWhite;
    circle(ctx, cx, hy, bs * 0.32);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = TL(PAL.stripeA);
    for (const ex of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + ex * bs * 0.13, hy - bs * 0.04);
      ctx.rotate(ex * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, -bs * 0.16);
      ctx.lineTo(bs * 0.09, 0);
      ctx.lineTo(0, bs * 0.16);
      ctx.lineTo(-bs * 0.09, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = glow || '#fff';
    for (const ex of [-1, 1]) {
      circle(ctx, cx + ex * bs * 0.13, hy - bs * 0.04, bs * 0.045);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    for (const ex of [-1, 1]) {
      circle(ctx, cx + ex * bs * 0.13, hy - bs * 0.04, bs * 0.02);
      ctx.fill();
    }
    ctx.fillStyle = PAL.clownNose;
    circle(ctx, cx, hy + bs * 0.05, bs * 0.07);
    ctx.fill();
    ctx.fillStyle = '#4a0008';
    ctx.beginPath();
    ctx.moveTo(cx - bs * 0.26, hy + bs * 0.12);
    ctx.quadraticCurveTo(cx, hy + bs * 0.32, cx + bs * 0.26, hy + bs * 0.12);
    ctx.quadraticCurveTo(cx, hy + bs * 0.2, cx - bs * 0.26, hy + bs * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a0010';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = -3; i <= 3; i++) {
      const tx = cx + i * bs * 0.07, ty = hy + bs * 0.12;
      tri(ctx, tx - 3, ty, tx + 3, ty, tx, ty + (i % 2 ? 7 : 9));
      ctx.fill();
    }
    ctx.fillStyle = '#d4530f';
    for (const ex of [-1, 1]) {
      circle(ctx, cx + ex * bs * 0.34, hy - bs * 0.18, bs * 0.12);
      ctx.fill();
    }
  };

  // rusty chain from a pivot down to a crescent axe blade, rotated by `a` (0 = straight)
  horror.hazard.pendulum = function (ctx, pivotX, pivotY, lenPx, a, bs, t, seed, glow) {
    // a = 0 means straight down on screen (canvas y grows downward), so the blade hangs *below* the pivot
    const bx = pivotX + Math.sin(a) * lenPx, by = pivotY + Math.cos(a) * lenPx;
    const links = Math.max(3, Math.round(lenPx / (bs * 0.4)));
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 3;
    for (let i = 0; i < links; i++) {
      const u0 = i / links, u1 = (i + 0.85) / links;
      const x0 = pivotX + (bx - pivotX) * u0, y0 = pivotY + (by - pivotY) * u0;
      const x1 = pivotX + (bx - pivotX) * u1, y1 = pivotY + (by - pivotY) * u1;
      ctx.beginPath();
      ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, bs * 0.09, bs * 0.15, a, 0, TAU);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    const L = bs * 0.9;
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.15);
    ctx.quadraticCurveTo(L * 0.75, -L * 0.1, L * 0.6, L * 0.45);
    ctx.quadraticCurveTo(L * 0.3, L * 0.1, 0, L * 0.15);
    ctx.quadraticCurveTo(-L * 0.1, 0, 0, -L * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,60,20,0.4)';
    circle(ctx, L * 0.3, L * 0.15, L * 0.12);
    ctx.fill();
    ctx.strokeStyle = PAL.bloodFresh;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L * 0.15, L * 0.05);
    ctx.lineTo(L * 0.55, L * 0.4);
    ctx.stroke();
    ctx.fillStyle = PAL.bloodDry;
    for (let i = 0; i < 3; i++) {
      circle(ctx, L * (0.2 + i * 0.15), L * (0.15 + i * 0.1), 3);
      ctx.fill();
    }
    ctx.restore();
  };

  // a red balloon with a marker clown face; (cx, cy) is the centre of the balloon body
  horror.hazard.balloon = function (ctx, cx, cy, bs, t, seed, glow) {
    cy += Math.sin(t * 3 + seed) * bs * 0.04;
    const rx = bs * 0.34, ry = bs * 0.42;
    ctx.fillStyle = '#c0122a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.22, ry * 0.3, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8a0d1e';
    tri(ctx, cx - 4, cy + ry - 2, cx + 4, cy + ry - 2, cx, cy + ry + 6);
    ctx.fill();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1.5;
    const sway = Math.sin(t * 2.4 + seed) * bs * 0.1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + ry + 6);
    ctx.quadraticCurveTo(cx + sway, cy + ry + bs * 0.4, cx + sway * 1.4, cy + ry + bs * 0.75);
    ctx.stroke();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + ex * rx * 0.35 - 5, cy - ry * 0.15 - 5);
      ctx.lineTo(cx + ex * rx * 0.35 + 5, cy - ry * 0.15 + 5);
      ctx.moveTo(cx + ex * rx * 0.35 + 5, cy - ry * 0.15 - 5);
      ctx.lineTo(cx + ex * rx * 0.35 - 5, cy - ry * 0.15 + 5);
      ctx.stroke();
    }
    ctx.fillStyle = PAL.clownNose;
    circle(ctx, cx, cy + ry * 0.05, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.4, cy + ry * 0.25);
    ctx.quadraticCurveTo(cx, cy + ry * 0.55, cx + rx * 0.4, cy + ry * 0.2);
    ctx.stroke();
  };

  // =====================================================================
  // SPIKES — same box as Art.spike, style baked into the function name
  // =====================================================================
  horror.spike = {};

  horror.spike.fence = function (ctx, x, y, w, h, down, glow, t, seed) {
    const cx = x + w * 0.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    const shaftW = w * 0.16;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#82828c');
    g.addColorStop(1, '#2c2c32');
    ctx.fillStyle = g;
    if (!down) {
      ctx.fillRect(cx - shaftW / 2, y + h * 0.22, shaftW, h * 0.78);
      ctx.strokeRect(cx - shaftW / 2, y + h * 0.22, shaftW, h * 0.78);
      tri(ctx, cx - w * 0.16, y + h * 0.26, cx, y, cx + w * 0.16, y + h * 0.26);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(cx - w * 0.22, y + h * 0.4, w * 0.44, h * 0.06);
      ctx.strokeRect(cx - w * 0.22, y + h * 0.4, w * 0.44, h * 0.06);
    } else {
      ctx.fillRect(cx - shaftW / 2, y, shaftW, h * 0.78);
      ctx.strokeRect(cx - shaftW / 2, y, shaftW, h * 0.78);
      tri(ctx, cx - w * 0.16, y + h * 0.74, cx, y + h, cx + w * 0.16, y + h * 0.74);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(cx - w * 0.22, y + h * 0.54, w * 0.44, h * 0.06);
      ctx.strokeRect(cx - w * 0.22, y + h * 0.54, w * 0.44, h * 0.06);
    }
    ctx.strokeStyle = 'rgba(140,80,30,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 2, y + h * 0.3);
    ctx.lineTo(cx - 3, y + h * 0.7);
    ctx.stroke();
  };

  horror.spike.hand = function (ctx, x, y, w, h, down, glow, t, seed) {
    const cx = x + w * 0.5, wig = Math.sin(t * 3 + seed) * 0.05;
    const skin = TL('#6a6a62');
    ctx.save();
    ctx.translate(cx, down ? y : y + h);
    ctx.rotate(wig);
    ctx.scale(1, down ? -1 : 1); // draw "reaching up"; flip for the ceiling version
    ctx.fillStyle = skin;
    rr(ctx, -w * 0.18, -h * 0.4, w * 0.36, h * 0.4, 6);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.5, w * 0.24, h * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const fingerAngles = [-0.55, -0.25, 0, 0.25, 0.55];
    for (const fa of fingerAngles) {
      const len = h * 0.42 * (1 - Math.abs(fa) * 0.25);
      ctx.save();
      ctx.translate(Math.sin(fa) * w * 0.2, -h * 0.55);
      ctx.rotate(fa * 0.6);
      ctx.fillStyle = skin;
      rr(ctx, -w * 0.05, -len, w * 0.1, len, w * 0.05);
      ctx.fill();
      ctx.strokeStyle = glow || '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e8e2d0';
      tri(ctx, -w * 0.05, -len, w * 0.05, -len, 0, -len - h * 0.12);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  horror.spike.bone = function (ctx, x, y, w, h, down, glow, t, seed) {
    const cx = x + w * 0.5;
    ctx.save();
    ctx.translate(cx, down ? y : y + h);
    ctx.scale(1, down ? -1 : 1);
    const bw = w * 0.22;
    ctx.fillStyle = '#e8e0c8';
    ctx.beginPath();
    ctx.moveTo(-bw * 0.5, 0);
    ctx.lineTo(-bw * 0.15, -h * 0.85);
    ctx.lineTo(0, -h);
    ctx.lineTo(bw * 0.15, -h * 0.85);
    ctx.lineTo(bw * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -2, bw * 0.5, h * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,110,80,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.1, -h * 0.3);
    ctx.lineTo(bw * 0.05, -h * 0.55);
    ctx.stroke();
    ctx.restore();
  };

  // a ghost-train skeleton popping out, arms raised — meaner (dmg 14)
  horror.spike.skeleton = function (ctx, x, y, w, h, down, glow, t, seed) {
    const cx = x + w * 0.5, pop = 0.9 + Math.sin(t * 2.5 + seed) * 0.1;
    ctx.save();
    ctx.translate(cx, down ? y : y + h);
    ctx.scale(1, down ? -1 : 1);
    const bone = '#eee8d8', dark = '#8a8270';
    ctx.fillStyle = bone;
    rr(ctx, -w * 0.22, -h * 0.55 * pop, w * 0.44, h * 0.55 * pop, 6);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i <= 3; i++) {
      const yy = (-h * 0.55 * pop * i) / 4;
      ctx.moveTo(-w * 0.2, yy);
      ctx.lineTo(w * 0.2, yy);
    }
    ctx.stroke();
    ctx.fillStyle = bone;
    circle(ctx, 0, -h * 0.68 * pop, w * 0.2);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ff2a2a';
    for (const ex of [-1, 1]) {
      circle(ctx, ex * w * 0.08, -h * 0.7 * pop, w * 0.05);
      ctx.fill();
    }
    ctx.fillStyle = dark;
    rr(ctx, -w * 0.12, -h * 0.58 * pop, w * 0.24, h * 0.06, 2);
    ctx.fill();
    for (const ex of [-1, 1]) {
      ctx.save();
      ctx.translate(ex * w * 0.2, -h * 0.5 * pop);
      ctx.rotate(ex * -0.7);
      ctx.strokeStyle = bone;
      ctx.lineWidth = w * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -h * 0.4 * pop);
      ctx.stroke();
      ctx.strokeStyle = glow || '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -h * 0.4 * pop);
      ctx.stroke();
      ctx.strokeStyle = bone;
      ctx.lineWidth = 3;
      for (const fa of [-0.3, 0, 0.3]) {
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.4 * pop);
        ctx.lineTo(Math.sin(fa) * w * 0.12, -h * 0.4 * pop - Math.cos(fa) * h * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  };

  // mirror glass shards
  horror.spike.shard = function (ctx, x, y, w, h, down, glow, t, seed) {
    const dir = down ? 1 : -1, base = down ? y : y + h;
    ctx.lineJoin = 'round';
    const shards = [[-0.3, 0.7], [0, 1], [0.32, 0.6]];
    for (const [ox, sc] of shards) {
      const sx0 = x + w * (0.5 + ox) - w * 0.09, sx1 = x + w * (0.5 + ox) + w * 0.09;
      const midx = x + w * (0.5 + ox), tipY = base + dir * h * sc;
      ctx.fillStyle = 'rgba(190,225,255,0.55)';
      tri(ctx, sx0, base, sx1, base, midx, tipY);
      ctx.fill();
      ctx.strokeStyle = glow || '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(midx - 2, base - dir * 4);
      ctx.lineTo(midx, tipY);
      ctx.stroke();
    }
  };

  // =====================================================================
  // BIRDS — same call as Art.bird, style baked into the function name
  // =====================================================================
  horror.bird = {};

  horror.bird.raven = function (ctx, cx, cy, s, t, seed, glow) {
    const flap = Math.sin(t * 10 + seed * 1.7);
    cy += Math.sin(t * 3 + seed) * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const black = T('#0a0a0d'), line = glow || '#fff';
    const wing = (k) => {
      const tipX = cx + s * (0.32 + k * 0.06), tipY = cy - s * (0.14 + 0.55 * flap);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.1, cy - s * 0.05);
      ctx.quadraticCurveTo(cx, tipY - s * 0.02, tipX, tipY);
      ctx.lineTo(tipX + s * 0.05, tipY + s * 0.08);
      ctx.quadraticCurveTo(cx + s * 0.18, cy, cx + s * 0.14, cy + s * 0.05);
      ctx.closePath();
    };
    ctx.strokeStyle = line;
    ctx.lineWidth = 2.5;
    wing(1);
    ctx.fillStyle = black;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.02, s * 0.3, s * 0.19, -0.05, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - s * 0.26, cy - s * 0.1, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    tri(ctx, cx - s * 0.38, cy - s * 0.14, cx - s * 0.62, cy - s * 0.05, cx - s * 0.38, cy);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = glow || '#ff3020';
    circle(ctx, cx - s * 0.3, cy - s * 0.13, s * 0.045);
    ctx.fill();
    ctx.fillStyle = black;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = line;
    wing(0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.22, cy - s * 0.02);
    ctx.lineTo(cx + s * 0.5, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.52, cy + s * 0.08);
    ctx.lineTo(cx + s * 0.22, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  horror.bird.bat = function (ctx, cx, cy, s, t, seed, glow) {
    const flap = Math.sin(t * 14 + seed * 2);
    const by = cy + Math.sin(t * 4 + seed) * 3;
    ctx.fillStyle = T('#1c1a22');
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (const dir of [-1, 1]) {
      const spanX = cx + dir * s * (0.45 + flap * 0.1), spanY = by - s * 0.25 * flap;
      ctx.beginPath();
      ctx.moveTo(cx, by - s * 0.05);
      ctx.quadraticCurveTo(cx + dir * s * 0.2, by - s * 0.35 - flap * s * 0.15, spanX, spanY);
      ctx.lineTo(cx + dir * s * 0.3, by + s * 0.05);
      ctx.quadraticCurveTo(cx + dir * s * 0.12, by + s * 0.02, cx, by + s * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, by, s * 0.13, s * 0.17, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    tri(ctx, cx - s * 0.09, by - s * 0.14, cx - s * 0.02, by - s * 0.28, cx + s * 0.02, by - s * 0.14);
    ctx.fill();
    tri(ctx, cx + s * 0.09, by - s * 0.14, cx + s * 0.02, by - s * 0.28, cx - s * 0.02, by - s * 0.14);
    ctx.fill();
    ctx.fillStyle = glow || '#ff3020';
    circle(ctx, cx - s * 0.05, by - s * 0.02, s * 0.03);
    ctx.fill();
    circle(ctx, cx + s * 0.05, by - s * 0.02, s * 0.03);
    ctx.fill();
  };

  // =====================================================================
  // WATER
  // =====================================================================
  horror.water = {};
  horror.water.blood = function (ctx, x0, x1, ySurf, yBot, t) {
    const g = ctx.createLinearGradient(0, ySurf, 0, yBot);
    g.addColorStop(0, TL('#8a0016'));
    g.addColorStop(1, TL('#2a0008'));
    ctx.fillStyle = g;
    const wave = (x) => ySurf + Math.sin((x - x0) * 0.04 + t * 1.2) * 2;
    ctx.beginPath();
    ctx.moveTo(x0, yBot);
    for (let x = x0; x <= x1 + 8; x += 8) ctx.lineTo(Math.min(x, x1), wave(x));
    ctx.lineTo(x1, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,140,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      if (x === x0) ctx.moveTo(x, wave(x));
      else ctx.lineTo(x, wave(x));
    }
    ctx.stroke();
    const step = 60;
    for (let x = x0 + 20, k = 0; x < x1 - 10; x += step, k++) {
      const u = (t * 0.25 + k * 0.37) % 1;
      const bx = x + Math.sin(k * 13) * 8, by = yBot - (yBot - ySurf) * u;
      if (by < ySurf) continue;
      const r = 2 + Math.sin(k * 7) * 1.2;
      ctx.fillStyle = 'rgba(255,90,110,' + 0.5 * (1 - u) + ')';
      circle(ctx, bx, by, r);
      ctx.fill();
    }
  };

  // =====================================================================
  // BLOCKS — same call as Art.block, style baked into the function name
  // =====================================================================
  horror.block = {};

  horror.block.tomb = function (ctx, x, y, w, h, bs, seed, t) {
    const rnd = U.rng(seed * 53 + 3);
    bevel(ctx, x, y, w, h, T('#4a4650'), T('#26232a'), T('#141216'), Math.min(w, h) * 0.18);
    ctx.fillStyle = T('#3b3538');
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.35);
    ctx.lineTo(x + w * 0.08, y + h * 0.15);
    ctx.arc(x + w * 0.5, y + h * 0.15, w * 0.42, Math.PI, 0);
    ctx.lineTo(x + w * 0.92, y + h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(2, w * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.2);
    ctx.lineTo(x + w * 0.5, y + h * 0.55);
    ctx.moveTo(x + w * 0.32, y + h * 0.32);
    ctx.lineTo(x + w * 0.68, y + h * 0.32);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y + h * 0.1);
    ctx.lineTo(x + w * 0.38, y + h * 0.4);
    ctx.lineTo(x + w * 0.28, y + h * 0.7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,90,50,0.4)';
    for (let i = 0; i < 3; i++) {
      circle(ctx, x + w * (0.2 + rnd() * 0.6), y + h * (0.5 + rnd() * 0.4), w * 0.08);
      ctx.fill();
    }
  };

  horror.block.crypt = function (ctx, x, y, w, h, bs, seed, t) {
    bevel(ctx, x, y, w, h, T('#5a5560'), T('#332f36'), T('#1a1820'), 5);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 3, y + 3, w - 6, h * 0.18);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let cx = x + bs; cx < x + w - 2; cx += bs) {
      ctx.beginPath();
      ctx.moveTo(cx, y + 6);
      ctx.lineTo(cx, y + h - 6);
      ctx.stroke();
    }
    const cx0 = x + w / 2, cy0 = y + h * 0.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx0, cy0 - h * 0.22);
    ctx.lineTo(cx0, cy0 + h * 0.22);
    ctx.moveTo(cx0 - w * 0.08, cy0 - h * 0.08);
    ctx.lineTo(cx0 + w * 0.08, cy0 - h * 0.08);
    ctx.stroke();
  };

  horror.block.pew = function (ctx, x, y, w, h, bs, seed, t) {
    const dark = T('#1f130a');
    ctx.fillStyle = T('#3a2416');
    ctx.fillRect(x, y + h * 0.6, w, h * 0.4);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + h * 0.6, w - 2, h * 0.4 - 1);
    ctx.fillStyle = T('#4a2e1c');
    rr(ctx, x, y, w, h * 0.62, 4);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let cx = x + bs * 0.3; cx < x + w; cx += bs * 0.5) {
      ctx.moveTo(cx, y + 4);
      ctx.lineTo(cx, y + h * 0.6);
    }
    ctx.stroke();
    ctx.fillStyle = dark;
    ctx.fillRect(x + 4, y + h * 0.9, 6, h * 0.1);
    ctx.fillRect(x + w - 10, y + h * 0.9, 6, h * 0.1);
  };

  horror.block.coffin = function (ctx, x, y, w, h, bs, seed, t) {
    const dark = T('#1a0f08');
    ctx.fillStyle = T('#3a2416');
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h * 0.15);
    ctx.lineTo(x + w * 0.28, y);
    ctx.lineTo(x + w * 0.72, y);
    ctx.lineTo(x + w * 0.9, y + h * 0.15);
    ctx.lineTo(x + w * 0.9, y + h * 0.85);
    ctx.lineTo(x + w * 0.72, y + h);
    ctx.lineTo(x + w * 0.28, y + h);
    ctx.lineTo(x + w * 0.1, y + h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let cx = x + w * 0.25; cx < x + w * 0.75; cx += w * 0.16) {
      ctx.moveTo(cx, y + h * 0.06);
      ctx.lineTo(cx, y + h * 0.94);
    }
    ctx.stroke();
    ctx.fillStyle = T('#8a7530');
    rr(ctx, x + w * 0.42, y + h * 0.32, w * 0.16, h * 0.36, 3);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = Math.max(2, w * 0.03);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + h * 0.36);
    ctx.lineTo(x + w * 0.5, y + h * 0.64);
    ctx.moveTo(x + w * 0.44, y + h * 0.44);
    ctx.lineTo(x + w * 0.56, y + h * 0.44);
    ctx.stroke();
  };

  horror.block.altar = function (ctx, x, y, w, h, bs, seed, t) {
    bevel(ctx, x, y + h * 0.35, w, h * 0.65, T('#4a4650'), T('#26232a'), T('#141216'), 4);
    ctx.fillStyle = T('#5a0d18');
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.lineTo(x + w, y + h * 0.42);
    for (let i = 6; i >= 0; i--) {
      const u = i / 6;
      ctx.lineTo(x + w * u, y + h * (0.42 + (i % 2 ? 0.05 : 0)));
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + h * 0.32);
    ctx.lineTo(x + w * 0.1, y + h * 0.42);
    ctx.moveTo(x + w * 0.9, y + h * 0.32);
    ctx.lineTo(x + w * 0.9, y + h * 0.42);
    ctx.stroke();
    ctx.strokeStyle = T('#c8a227');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.stroke();
    for (const cx of [x + w * 0.22, x + w * 0.78]) flame(ctx, cx, y + h * 0.28, h * 0.22, t, seed + cx * 0.01);
  };

  horror.block.bonewall = function (ctx, x, y, w, h, bs, seed, t) {
    ctx.fillStyle = T('#3a2e28');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = T('#241a16');
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    const rowH = bs * 0.5;
    for (let ry = y + rowH * 0.4, r = 0; ry < y + h; ry += rowH, r++) {
      for (let bx = x + (r % 2 ? rowH * 0.5 : 0); bx < x + w; bx += rowH * 1.3) {
        const bw = Math.min(rowH * 1.1, x + w - bx);
        if (bw < 6) continue;
        ctx.fillStyle = T('#d8d0ba');
        rr(ctx, bx + 2, ry - rowH * 0.18, bw - 4, rowH * 0.36, rowH * 0.15);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = T('#c8c0a8');
        circle(ctx, bx + 4, ry, rowH * 0.16);
        ctx.fill();
        circle(ctx, bx + bw - 4, ry, rowH * 0.16);
        ctx.fill();
      }
    }
  };

  horror.block.skulls = function (ctx, x, y, w, h, bs, seed, t) {
    ctx.fillStyle = T('#332822');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = T('#1e1712');
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    const cols = Math.max(1, Math.round(w / bs)), rows = Math.max(1, Math.round(h / bs));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + (c + 0.5) * (w / cols), cy = y + (r + 0.5) * (h / rows);
        const rad = Math.min(w / cols, h / rows) * 0.32;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        circle(ctx, cx, cy, rad * 1.25);
        ctx.fill();
        ctx.fillStyle = '#e8e2cc';
        ctx.beginPath();
        ctx.arc(cx, cy - rad * 0.15, rad * 0.85, Math.PI, 0);
        ctx.lineTo(cx + rad * 0.6, cy + rad * 0.5);
        ctx.quadraticCurveTo(cx, cy + rad * 0.75, cx - rad * 0.6, cy + rad * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1a1512';
        circle(ctx, cx - rad * 0.35, cy - rad * 0.1, rad * 0.22);
        ctx.fill();
        circle(ctx, cx + rad * 0.35, cy - rad * 0.1, rad * 0.22);
        ctx.fill();
        tri(ctx, cx - rad * 0.08, cy + rad * 0.1, cx + rad * 0.08, cy + rad * 0.1, cx, cy + rad * 0.28);
        ctx.fill();
      }
    }
  };

  horror.block.crate = function (ctx, x, y, w, h, bs, seed, t) {
    ctx.fillStyle = T('#8a5a2a');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = T('#3a2410');
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = T('#5c3a18');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.5, y + h);
    ctx.stroke();
    ctx.fillStyle = T('#c8102e');
    star(ctx, x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.18, 5);
    ctx.fill();
  };

  horror.block.podium = function (ctx, x, y, w, h, bs, seed, t) {
    const stripeCols = [PAL.stripeA, PAL.stripeB];
    ctx.save();
    rr(ctx, x, y, w, h, 6);
    ctx.clip();
    const n = 6;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = T(stripeCols[i % 2]);
      ctx.fillRect(x + (i * w) / n, y, w / n + 1, h);
    }
    ctx.restore();
    ctx.strokeStyle = T('#241a30');
    ctx.lineWidth = 3;
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 6);
    ctx.stroke();
    ctx.fillStyle = T('#efe9dc');
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.06, w * 0.48, h * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = T('#241a30');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = T('#f2c230');
    star(ctx, x + w / 2, y + h * 0.55, Math.min(w, h) * 0.2, 5);
    ctx.fill();
  };

  horror.block.mirror = function (ctx, x, y, w, h, bs, seed, t) {
    ctx.fillStyle = T('#8a8a92');
    rr(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = T('#3a3a40');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    rr(ctx, x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.84, 6);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#cfefff');
    g.addColorStop(0.5, '#7fb8d8');
    g.addColorStop(1, '#cfefff');
    ctx.fillStyle = g;
    ctx.fill();
    rr(ctx, x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.84, 6);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const yy = y + h * 0.15 + i * h * 0.16;
      ctx.moveTo(x, yy);
      for (let xx = x; xx <= x + w; xx += 6) ctx.lineTo(xx, yy + Math.sin(xx * 0.1 + t * 1.5 + i) * 4);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,20,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5 + Math.sin(t * 0.6) * 4, y + h * 0.6, w * 0.18, h * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  horror.block.cart = function (ctx, x, y, w, h, bs, seed, t) {
    ctx.fillStyle = T('#5a1a1a');
    rr(ctx, x, y + h * 0.15, w, h * 0.7, 8);
    ctx.fill();
    ctx.strokeStyle = T('#2a0808');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = T('#c8a227');
    ctx.lineWidth = 2;
    rr(ctx, x + 4, y + h * 0.19, w - 8, h * 0.62, 6);
    ctx.stroke();
    ctx.fillStyle = T('#1a1a1a');
    for (const wx of [x + w * 0.2, x + w * 0.8]) {
      circle(ctx, wx, y + h * 0.92, h * 0.14);
      ctx.fill();
    }
    ctx.fillStyle = '#e8e2cc';
    circle(ctx, x + w * 0.14, y + h * 0.42, h * 0.22);
    ctx.fill();
    ctx.strokeStyle = T('#2a0808');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1a1512';
    circle(ctx, x + w * 0.09, y + h * 0.38, h * 0.05);
    ctx.fill();
    circle(ctx, x + w * 0.19, y + h * 0.38, h * 0.05);
    ctx.fill();
  };

  horror.block.jackbox = function (ctx, x, y, w, h, bs, seed, t) {
    ctx.save();
    rr(ctx, x, y, w, h, 6);
    ctx.clip();
    const n = 5;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = T(i % 2 ? PAL.stripeA : PAL.stripeB);
      ctx.fillRect(x + (i * w) / n, y, w / n + 1, h);
    }
    ctx.restore();
    ctx.strokeStyle = T('#1a0f28');
    ctx.lineWidth = 3;
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.12);
    ctx.lineTo(x + w, y + h * 0.12);
    ctx.stroke();
    ctx.save();
    ctx.translate(x + w + 2, y + h * 0.6);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = T('#8a8a92');
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(h * 0.22, 0);
    ctx.stroke();
    ctx.fillStyle = T('#3a3a3a');
    circle(ctx, h * 0.22, 0, 3);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = T('#3a3a3a');
    circle(ctx, x + w + 2, y + h * 0.6, 4);
    ctx.fill();
  };

  // a standing iron candelabra — the flames are the dangerous bit (thorny)
  horror.block.candles = function (ctx, x, y, w, h, bs, seed, t) {
    const n = 3 + (seed % 3);
    const cx = x + w / 2, base = y + h;
    ctx.strokeStyle = T('#3a3a40');
    ctx.lineWidth = Math.max(2, w * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.lineTo(cx, y + h * 0.3);
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      const ax = x + w * (0.15 + 0.7 * u);
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.3);
      ctx.lineTo(ax, y + h * 0.18);
      ctx.stroke();
      flame(ctx, ax, y + h * 0.18, h * 0.22, t, seed + i * 3.1);
    }
    ctx.fillStyle = T('#3a3a40');
    ctx.beginPath();
    ctx.ellipse(cx, base, w * 0.22, h * 0.04, 0, 0, TAU);
    ctx.fill();
  };

  horror.block.chandelier = function (ctx, x, y, w, h, bs, seed, t) {
    const cx = x + w / 2, sway = Math.sin(t * 1.2 + seed) * 0.04;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(sway);
    ctx.translate(-cx, -y);
    ctx.strokeStyle = T('#4a4a50');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y + h * 0.22);
    ctx.stroke();
    const ringY = y + h * 0.5, ringR = w * 0.4;
    ctx.strokeStyle = T('#5a5a5c');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(cx, ringY, ringR, h * 0.1, 0, 0, TAU);
    ctx.stroke();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const ax = cx + Math.cos(a) * ringR, ay = ringY + Math.sin(a) * h * 0.1;
      ctx.strokeStyle = T('#5a5a5c');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax, ay + h * 0.14);
      ctx.stroke();
      flame(ctx, ax, ay + h * 0.14, h * 0.16, t, seed + i * 2.3);
    }
    ctx.restore();
  };

  // a packed heap/pillar of bones and skulls, filling the whole box like bonewall/skulls,
  // with sharp bone tips sticking out along the edges (up if floor-standing, down if hanging)
  horror.block.bonespikes = function (ctx, x, y, w, h, bs, seed, t) {
    const rnd = U.rng(seed * 331 + 17);
    const vertical = h > w * 1.2;
    // dark backing so the mass reads as one solid obstacle, not scattered thorns
    ctx.fillStyle = T('#241c18');
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = T('#140f0c');
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    // packed bone knuckles and a skull or two, filling the body edge to edge
    const cell = Math.max(12, Math.min(w, h) * (vertical ? 0.44 : 0.4));
    const cols = Math.max(1, Math.round(w / cell)), rows = Math.max(1, Math.round(h / cell));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bx = x + (c + 0.5) * (w / cols) + (rnd() - 0.5) * cell * 0.3;
        const by = y + (r + 0.5) * (h / rows) + (rnd() - 0.5) * cell * 0.3;
        const rad = Math.min(w / cols, h / rows) * 0.44;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate((rnd() - 0.5) * 0.8);
        if (rnd() < 0.3) {
          // a small skull wedged into the heap
          ctx.fillStyle = T('#e8e2cc');
          ctx.beginPath();
          ctx.arc(0, -rad * 0.15, rad * 0.85, Math.PI, 0);
          ctx.lineTo(rad * 0.6, rad * 0.5);
          ctx.quadraticCurveTo(0, rad * 0.72, -rad * 0.6, rad * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = '#1a1512';
          circle(ctx, -rad * 0.35, -rad * 0.15, rad * 0.2);
          ctx.fill();
          circle(ctx, rad * 0.35, -rad * 0.15, rad * 0.2);
          ctx.fill();
        } else {
          // a knobbly long-bone segment, ball joints at both ends
          ctx.fillStyle = T('#d8d0ba');
          rr(ctx, -rad * 0.95, -rad * 0.32, rad * 1.9, rad * 0.64, rad * 0.3);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = T('#c8c0a8');
          circle(ctx, -rad * 0.88, 0, rad * 0.38);
          ctx.fill();
          circle(ctx, rad * 0.88, 0, rad * 0.38);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    // sharp bone tips along the box edges — the actual dangerous part
    function tip(px, py, ang, len) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = T('#f2ecd6');
      ctx.beginPath();
      ctx.moveTo(-len * 0.17, 0);
      ctx.lineTo(0, -len);
      ctx.lineTo(len * 0.17, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    const nTop = Math.max(3, Math.round(w / (bs * 0.32)));
    for (let i = 0; i < nTop; i++) {
      const u = (i + 0.5) / nTop, len = Math.min(w, h) * (0.22 + rnd() * 0.16);
      tip(x + w * u, y + len, 0, len);
      tip(x + w * u, y + h - len, Math.PI, len);
    }
    if (!vertical) {
      const nSide = Math.max(2, Math.round(h / (bs * 0.5)));
      for (let i = 0; i < nSide; i++) {
        const u = (i + 0.5) / nSide, len = Math.min(w, h) * (0.16 + rnd() * 0.14);
        tip(x + len, y + h * u, -Math.PI / 2, len);
        tip(x + w - len, y + h * u, Math.PI / 2, len);
      }
    }
  };

  // =====================================================================
  // FACES — huge jump-scare portraits, k = 0..1 intensity
  // =====================================================================
  horror.face = {};

  horror.face.nun = function (ctx, cx, cy, size, t, k) {
    const s = size;
    // black veil/hood, big enough that it reads as "the nun" before anything else does
    const vHalf = s * 0.48, vPeak = s * 0.24, topY = cy - s * 0.6, midY = cy - s * 0.08, botY = cy + s * 0.48;
    function veilPath() {
      ctx.beginPath();
      ctx.moveTo(cx - vHalf, botY);
      ctx.quadraticCurveTo(cx - vHalf * 1.05, midY, cx - vHalf * 0.78, topY + s * 0.08);
      ctx.quadraticCurveTo(cx - vPeak, topY - s * 0.02, cx, topY - s * 0.04);
      ctx.quadraticCurveTo(cx + vPeak, topY - s * 0.02, cx + vHalf * 0.78, topY + s * 0.08);
      ctx.quadraticCurveTo(cx + vHalf * 1.05, midY, cx + vHalf, botY);
      ctx.quadraticCurveTo(cx + vHalf * 0.6, botY + s * 0.07, cx, botY + s * 0.1);
      ctx.quadraticCurveTo(cx - vHalf * 0.6, botY + s * 0.07, cx - vHalf, botY);
      ctx.closePath();
    }
    veilPath();
    ctx.strokeStyle = 'rgba(150,120,180,0.45)'; // soft rim light so the black reads against a dark screen
    ctx.lineWidth = s * 0.035;
    ctx.stroke();
    veilPath();
    ctx.fillStyle = PAL.habit;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = s * 0.008;
    ctx.stroke();
    // white wimple/coif, tightly framing the face inside the veil
    ctx.fillStyle = PAL.wimple;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy - s * 0.08);
    ctx.quadraticCurveTo(cx - s * 0.42, cy + s * 0.32, cx - s * 0.26, cy + s * 0.46);
    ctx.lineTo(cx + s * 0.26, cy + s * 0.46);
    ctx.quadraticCurveTo(cx + s * 0.42, cy + s * 0.32, cx + s * 0.36, cy - s * 0.08);
    ctx.quadraticCurveTo(cx, cy - s * 0.5, cx - s * 0.36, cy - s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a0d10';
    ctx.lineWidth = Math.max(2, s * 0.012);
    ctx.stroke();
    ctx.strokeStyle = PAL.bloodDry;
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy - s * 0.3);
    ctx.lineTo(cx - s * 0.28, cy);
    ctx.moveTo(cx + s * 0.25, cy - s * 0.32);
    ctx.lineTo(cx + s * 0.34, cy - s * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#d6ceba';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.02, s * 0.3, s * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,20,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.2, cy + s * 0.12, s * 0.09, s * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.2, cy + s * 0.12, s * 0.09, s * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a0a10';
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * s * 0.14, cy - s * 0.05, s * 0.11, s * 0.09, 0, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = PAL.eyeGlow;
    ctx.shadowBlur = 20 + k * 30;
    ctx.fillStyle = PAL.eyeGlow;
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * s * 0.14, cy - s * 0.05, s * 0.07 * Math.min(1, 0.4 + k), s * 0.05 * Math.min(1, 0.4 + k), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = PAL.bloodFresh;
    ctx.lineWidth = s * 0.02;
    ctx.lineCap = 'round';
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + ex * s * 0.14, cy - s * 0.02);
      ctx.quadraticCurveTo(cx + ex * s * 0.17, cy + s * 0.15, cx + ex * s * 0.12, cy + s * 0.32 * Math.min(1, k + 0.3));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,30,30,0.4)';
    ctx.lineWidth = s * 0.01;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.02);
    ctx.lineTo(cx - s * 0.02, cy + s * 0.12);
    ctx.stroke();
    const mouthH = s * (0.06 + 0.16 * k);
    ctx.fillStyle = '#3a0508';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.26, s * 0.13, mouthH, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1a0304';
    ctx.lineWidth = s * 0.01;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = -2; i <= 2; i++) {
      const tx = cx + i * s * 0.045;
      tri(ctx, tx - s * 0.015, cy + s * 0.26 - mouthH, tx + s * 0.015, cy + s * 0.26 - mouthH, tx, cy + s * 0.26 - mouthH + s * 0.05);
      ctx.fill();
    }
  };

  horror.face.clown = function (ctx, cx, cy, size, t, k) {
    const s = size;
    ctx.fillStyle = '#d4530f';
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * s * 0.42, cy - s * 0.05, s * 0.22, s * 0.3, ex * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = PAL.clownWhite;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.36, s * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c8c0ac';
    ctx.lineWidth = s * 0.008;
    ctx.stroke();
    ctx.fillStyle = PAL.stripeA;
    for (const ex of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + ex * s * 0.15, cy - s * 0.05);
      ctx.rotate(ex * 0.35);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.18);
      ctx.lineTo(s * 0.11, 0);
      ctx.lineTo(0, s * 0.18);
      ctx.lineTo(-s * 0.11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#fff';
    for (const ex of [-1, 1]) {
      circle(ctx, cx + ex * s * 0.15, cy - s * 0.05, s * 0.06);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    for (const ex of [-1, 1]) {
      circle(ctx, cx + ex * s * 0.15, cy - s * 0.05, s * 0.03 * (0.6 + k * 0.6));
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = PAL.clownNose;
    ctx.shadowBlur = 10 + k * 10;
    ctx.fillStyle = PAL.clownNose;
    circle(ctx, cx, cy + s * 0.06, s * 0.09);
    ctx.fill();
    ctx.restore();
    const mouthH = s * (0.08 + 0.14 * k);
    ctx.fillStyle = '#4a0008';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.28, cy + s * 0.18);
    ctx.quadraticCurveTo(cx, cy + s * 0.18 + mouthH * 2, cx + s * 0.28, cy + s * 0.18);
    ctx.quadraticCurveTo(cx, cy + s * 0.18 + mouthH * 0.6, cx - s * 0.28, cy + s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a0010';
    ctx.lineWidth = s * 0.015;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = -4; i <= 4; i++) {
      const tx = cx + i * s * 0.06, ty = cy + s * 0.19;
      tri(ctx, tx - s * 0.02, ty, tx + s * 0.02, ty, tx, ty + (i % 2 ? s * 0.05 : s * 0.07));
      ctx.fill();
    }
  };

  horror.face.skull = function (ctx, cx, cy, size, t, k) {
    const s = size;
    ctx.fillStyle = '#e8e2cc';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.05, s * 0.34, s * 0.4, 0, Math.PI, TAU);
    ctx.lineTo(cx + s * 0.3, cy + s * 0.15);
    ctx.quadraticCurveTo(cx + s * 0.26, cy + s * 0.3, cx + s * 0.12, cy + s * 0.32);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.42);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.42);
    ctx.lineTo(cx - s * 0.12, cy + s * 0.32);
    ctx.quadraticCurveTo(cx - s * 0.26, cy + s * 0.3, cx - s * 0.3, cy + s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a8270';
    ctx.lineWidth = s * 0.01;
    ctx.stroke();
    ctx.save();
    ctx.shadowBlur = 15 + k * 25;
    ctx.shadowColor = k > 0.5 ? '#ff3020' : '#000';
    ctx.fillStyle = '#0a0604';
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * s * 0.15, cy - s * 0.05, s * 0.12, s * 0.14, 0, 0, TAU);
      ctx.fill();
    }
    if (k > 0.15) {
      ctx.fillStyle = 'rgba(255,40,20,' + Math.min(1, k) + ')';
      for (const ex of [-1, 1]) {
        circle(ctx, cx + ex * s * 0.15, cy - s * 0.05, s * 0.05 * k);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.fillStyle = '#0a0604';
    tri(ctx, cx - s * 0.04, cy + s * 0.05, cx + s * 0.04, cy + s * 0.05, cx, cy + s * 0.16);
    ctx.fill();
    // lower jaw bar the teeth sit in, so they read as a jaw rather than floating rectangles
    ctx.fillStyle = '#dcd4bc';
    rr(ctx, cx - s * 0.26, cy + s * 0.2, s * 0.52, s * 0.16, s * 0.04);
    ctx.fill();
    ctx.strokeStyle = '#8a8270';
    ctx.lineWidth = s * 0.01;
    ctx.stroke();
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(cx - s * 0.26, cy + s * 0.28, s * 0.52, s * 0.02);
    ctx.fillStyle = '#e8e2cc';
    ctx.strokeStyle = '#8a8270';
    ctx.lineWidth = s * 0.006;
    for (let i = -4; i <= 4; i++) {
      const tx = cx + i * s * 0.058;
      tri(ctx, tx - s * 0.024, cy + s * 0.22, tx + s * 0.024, cy + s * 0.22, tx, cy + s * 0.34);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = s * 0.006;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.1, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.16, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.1, cy + s * 0.05);
    ctx.stroke();
  };

  // a glowing pair of eyes, blinking now and then; drawn above the darkness
  horror.eyes = function (ctx, cx, cy, size, t, seed, color) {
    const cyc = (t * 0.3 + seed) % 4;
    const blink = cyc > 3.85 ? Math.max(0, (4 - cyc) / 0.15) : 1;
    const gap = size * 0.6;
    ctx.save();
    ctx.shadowColor = color || PAL.eyeGlow;
    ctx.shadowBlur = size * 0.8;
    ctx.fillStyle = color || PAL.eyeGlow;
    for (const ex of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + ex * gap * 0.5, cy, size * 0.22, size * 0.14 * blink, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  // =====================================================================
  // NEAR SCENERY — (ctx, x, base, d, t, bs, font)
  // =====================================================================
  const nearAdd = {};

  nearAdd.cross = function (ctx, x, base, d, t, bs) {
    const h = bs * 1.3;
    ctx.strokeStyle = T('#4a4650');
    ctx.lineWidth = bs * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - h);
    ctx.moveTo(x - bs * 0.28, base - h * 0.62);
    ctx.lineTo(x + bs * 0.28, base - h * 0.62);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, base - h * 0.9);
    ctx.lineTo(x, base - h * 0.3);
    ctx.stroke();
  };

  nearAdd.tombstone = function (ctx, x, base, d, t, bs) {
    const tilt = (((d.seed || 0) % 5) - 2) * 0.04, w = bs * 0.9, h = bs * 1.1;
    ctx.save();
    ctx.translate(x, base);
    ctx.rotate(tilt);
    ctx.fillStyle = T('#4a4650');
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -h * 0.6);
    ctx.arc(0, -h * 0.6, w / 2, Math.PI, 0);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#26232a');
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -h * 0.55);
    ctx.lineTo(w * 0.25, -h * 0.55);
    ctx.moveTo(-w * 0.22, -h * 0.42);
    ctx.lineTo(w * 0.22, -h * 0.42);
    ctx.stroke();
    ctx.restore();
  };

  nearAdd.opengrave = function (ctx, x, base, d, t, bs) {
    ctx.fillStyle = T('#1c140f');
    ctx.beginPath();
    ctx.ellipse(x, base - 4, bs * 0.7, bs * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = T('#3a2c1c');
    ctx.beginPath();
    ctx.ellipse(x - bs * 0.55, base - 6, bs * 0.35, bs * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + bs * 0.6, base - 4, bs * 0.3, bs * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = T('#6b5a45');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - bs * 0.55, base - 14);
    ctx.lineTo(x - bs * 0.4, base - bs * 1.3);
    ctx.stroke();
    ctx.fillStyle = T('#8a8a92');
    ctx.beginPath();
    ctx.moveTo(x - bs * 0.55, base - 14);
    ctx.lineTo(x - bs * 0.4, base - 4);
    ctx.lineTo(x - bs * 0.3, base - 14);
    ctx.closePath();
    ctx.fill();
  };

  nearAdd.gnarltree = function (ctx, x, base, d, t, bs) {
    const h = bs * 3.2;
    ctx.strokeStyle = T('#2a2420');
    ctx.lineWidth = bs * 0.16;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x - bs * 0.2, base - h * 0.5, x + bs * 0.1, base - h * 0.8);
    ctx.stroke();
    const sway = Math.sin(t * 0.8 + (d.seed || 0)) * 0.03;
    const branches = [[x - bs * 0.05, base - h * 0.5, -2.3, bs * 1.1], [x + bs * 0.02, base - h * 0.65, -0.7, bs * 0.9], [x + bs * 0.1, base - h * 0.8, -1.6, bs * 0.8]];
    for (const [bx, by, ang, len] of branches) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ang + sway);
      ctx.lineWidth = bs * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      ctx.restore();
    }
  };

  nearAdd.convgate = function (ctx, x, base, d, t, bs) {
    const w = bs * 1.6, h = bs * 2.4;
    ctx.strokeStyle = T('#2a2a30');
    ctx.lineWidth = bs * 0.12;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.lineTo(x - w / 2, base - h);
    ctx.moveTo(x + w / 2, base);
    ctx.lineTo(x + w / 2, base - h);
    ctx.stroke();
    ctx.lineWidth = bs * 0.05;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base - h);
    ctx.lineTo(x + w / 2, base - h);
    ctx.stroke();
    for (let bx = x - w / 2 + bs * 0.2; bx < x + w / 2; bx += bs * 0.28) {
      ctx.beginPath();
      ctx.moveTo(bx, base);
      ctx.lineTo(bx, base - h * 0.85);
      ctx.stroke();
    }
    ctx.fillStyle = T('#2a2a30');
    for (const bx of [x - w / 2, x + w / 2]) {
      circle(ctx, bx, base - h - 4, 6);
      ctx.fill();
    }
  };

  nearAdd.gaslamp = function (ctx, x, base, d, t, bs) {
    const h = bs * 2.2;
    ctx.strokeStyle = T('#2a2a30');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - h);
    ctx.stroke();
    const flick = 0.7 + 0.3 * Math.sin(t * 13 + (d.seed || 0));
    const g = ctx.createRadialGradient(x, base - h - 6, 2, x, base - h - 6, bs * 0.9);
    g.addColorStop(0, 'rgba(255,210,120,' + 0.5 * flick + ')');
    g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g;
    circle(ctx, x, base - h - 6, bs * 0.9);
    ctx.fill();
    ctx.fillStyle = T('#3a3a40');
    rr(ctx, x - bs * 0.16, base - h - bs * 0.36, bs * 0.32, bs * 0.36, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,210,120,' + flick + ')';
    rr(ctx, x - bs * 0.1, base - h - bs * 0.3, bs * 0.2, bs * 0.24, 2);
    ctx.fill();
  };

  nearAdd.tent = function (ctx, x, base, d, t, bs) {
    const w = bs * 2.2, h = bs * 1.6;
    ctx.fillStyle = T(PAL.stripeB);
    tri(ctx, x - w / 2, base, x, base - h, x + w / 2, base);
    ctx.fill();
    ctx.fillStyle = T(PAL.stripeA);
    tri(ctx, x - w * 0.26, base, x, base - h, x - w * 0.06, base);
    ctx.fill();
    tri(ctx, x + w * 0.06, base, x, base - h, x + w * 0.26, base);
    ctx.fill();
    ctx.strokeStyle = T('#241a30');
    ctx.lineWidth = 2;
    tri(ctx, x - w / 2, base, x, base - h, x + w / 2, base);
    ctx.stroke();
    ctx.fillStyle = T('#8a1a2a');
    circle(ctx, x, base - h - 4, 5);
    ctx.fill();
  };

  nearAdd.ticketbooth = function (ctx, x, base, d, t, bs) {
    const w = bs * 1.3, h = bs * 1.5;
    ctx.fillStyle = T('#5a3a1a');
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.strokeStyle = T('#241a10');
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = T(PAL.stripeB);
    tri(ctx, x - w / 2 - 6, base - h, x, base - h - bs * 0.5, x + w / 2 + 6, base - h);
    ctx.fill();
    ctx.strokeStyle = T('#241a10');
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,10,0.7)';
    rr(ctx, x - w * 0.3, base - h * 0.7, w * 0.6, h * 0.32, 3);
    ctx.fill();
  };

  nearAdd.popcorn = function (ctx, x, base, d, t, bs) {
    ctx.fillStyle = T('#c8102e');
    ctx.beginPath();
    ctx.moveTo(x - bs * 0.35, base);
    ctx.lineTo(x - bs * 0.45, base - bs * 0.9);
    ctx.lineTo(x + bs * 0.45, base - bs * 0.9);
    ctx.lineTo(x + bs * 0.35, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - bs * 0.15, base);
    ctx.lineTo(x - bs * 0.2, base - bs * 0.9);
    ctx.moveTo(x + bs * 0.15, base);
    ctx.lineTo(x + bs * 0.2, base - bs * 0.9);
    ctx.stroke();
    ctx.fillStyle = T('#1a1a1a');
    circle(ctx, x - bs * 0.25, base + 4, 5);
    ctx.fill();
    circle(ctx, x + bs * 0.25, base + 4, 5);
    ctx.fill();
    ctx.fillStyle = '#f0e2b0';
    for (let i = 0; i < 6; i++) {
      circle(ctx, x - bs * 0.5 + ((i * 7) % 50), base - 2 - ((i * 13) % 6), 3);
      ctx.fill();
    }
  };

  nearAdd.clownboard = function (ctx, x, base, d, t, bs) {
    const w = bs * 1.6, h = bs * 2;
    ctx.fillStyle = T('#e8d8b0');
    rr(ctx, x - w / 2, base - h, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = T('#8a5a2a');
    ctx.lineWidth = 6;
    rr(ctx, x - w / 2, base - h, w, h, 6);
    ctx.stroke();
    ctx.fillStyle = T(PAL.stripeB);
    ctx.beginPath();
    ctx.ellipse(x, base - h * 0.3, w * 0.42, h * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = T(PAL.stripeA);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(x, base - h * 0.3);
      ctx.lineTo(x + Math.cos(a) * w * 0.42, base - h * 0.3 + Math.sin(a) * h * 0.22);
      ctx.lineTo(x + Math.cos(a + 0.3) * w * 0.42, base - h * 0.3 + Math.sin(a + 0.3) * h * 0.22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.ellipse(x, base - h * 0.62, w * 0.24, h * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  nearAdd.terror = function (ctx, x, base, d, t, bs, font) {
    const w = bs * 4.5, h = bs * 3.6;
    ctx.fillStyle = T('#241018');
    rr(ctx, x - w / 2, base - h, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = T('#5a1a2a');
    ctx.lineWidth = 6;
    rr(ctx, x - w / 2, base - h, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = '#0a0000';
    ctx.beginPath();
    ctx.ellipse(x, base - h * 0.42, w * 0.32, h * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    const nTeeth = 8;
    for (let i = 0; i < nTeeth; i++) {
      const a = Math.PI + (i / (nTeeth - 1)) * Math.PI;
      const tx = x + Math.cos(a) * w * 0.32, ty = base - h * 0.42 + Math.sin(a) * h * 0.34;
      tri(ctx, tx - 8, ty, tx + 8, ty, tx, ty + (i % 2 ? 18 : 24));
      ctx.fill();
    }
    for (let i = 0; i < nTeeth; i++) {
      const a = (i / (nTeeth - 1)) * Math.PI;
      const tx = x + Math.cos(a) * w * 0.32, ty = base - h * 0.42 + Math.sin(a) * h * 0.34;
      tri(ctx, tx - 8, ty, tx + 8, ty, tx, ty - (i % 2 ? 18 : 24));
      ctx.fill();
    }
    ctx.fillStyle = '#ff2a3a';
    ctx.font = 'bold ' + Math.round(bs * 0.4) + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1a0004';
    ctx.lineWidth = 4;
    ctx.strokeText('TUNNEL OF TERROR', x, base - h - bs * 0.2);
    ctx.fillText('TUNNEL OF TERROR', x, base - h - bs * 0.2);
  };

  nearAdd.bellrope = function (ctx, x, base, d, t, bs) {
    const sway = Math.sin(t * 1.5 + (d.seed || 0)) * bs * 0.08;
    ctx.strokeStyle = T('#8a7550');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, base - bs * 3.5);
    ctx.quadraticCurveTo(x + sway, base - bs * 1.8, x, base - bs * 0.3);
    ctx.stroke();
    ctx.fillStyle = T('#a08050');
    rr(ctx, x - bs * 0.14, base - bs * 0.5, bs * 0.28, bs * 0.3, 4);
    ctx.fill();
  };

  nearAdd.stainedglass = function (ctx, x, base, d, t, bs) {
    const w = bs * 2, h = bs * 3.6, top = base - h;
    ctx.fillStyle = T('#241018');
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.lineTo(x - w / 2, top + w / 2);
    ctx.arc(x, top + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, base);
    ctx.closePath();
    ctx.fill();
    const cols = ['#8a1a2a', '#1a3a6a', '#6a1a8a', '#8a6a1a'];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + 4, base - 4);
    ctx.lineTo(x - w / 2 + 4, top + w / 2);
    ctx.arc(x, top + w / 2, w / 2 - 4, Math.PI, 0);
    ctx.lineTo(x + w / 2 - 4, base - 4);
    ctx.closePath();
    ctx.clip();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = cols[(r + c) % cols.length];
        ctx.fillRect(x - w / 2 + (c * w) / 3, top + (r * h) / 5, w / 3, h / 5);
      }
    }
    ctx.fillStyle = '#0a0508';
    ctx.beginPath();
    ctx.ellipse(x, top + h * 0.4, w * 0.16, h * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.16, top + h * 0.45);
    ctx.lineTo(x - w * 0.22, base - 4);
    ctx.lineTo(x + w * 0.22, base - 4);
    ctx.lineTo(x + w * 0.16, top + h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = T('#3a2a1a');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.lineTo(x - w / 2, top + w / 2);
    ctx.arc(x, top + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, base);
    ctx.stroke();
  };

  nearAdd.nunstatue = function (ctx, x, base, d, t, bs) {
    const h = bs * 2.6, stone = T('#6a6068');
    ctx.fillStyle = T('#4a4650');
    rr(ctx, x - bs * 0.35, base - bs * 0.3, bs * 0.7, bs * 0.3, 3);
    ctx.fill();
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - bs * 0.24, base - bs * 0.3);
    ctx.quadraticCurveTo(x - bs * 0.34, base - h * 0.6, x - bs * 0.16, base - h * 0.85);
    ctx.lineTo(x + bs * 0.16, base - h * 0.85);
    ctx.quadraticCurveTo(x + bs * 0.34, base - h * 0.6, x + bs * 0.24, base - bs * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#33303a');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, base - h * 0.92, bs * 0.17, bs * 0.19, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#141216';
    circle(ctx, x - bs * 0.06, base - h * 0.93, 3);
    ctx.fill();
    circle(ctx, x + bs * 0.06, base - h * 0.93, 3);
    ctx.fill();
  };

  nearAdd.candles = function (ctx, x, base, d, t, bs) {
    ctx.strokeStyle = T('#3a3a40');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - bs * 0.7);
    ctx.stroke();
    ctx.fillStyle = T('#3a3a40');
    ctx.beginPath();
    ctx.ellipse(x, base, bs * 0.16, bs * 0.04, 0, 0, TAU);
    ctx.fill();
    flame(ctx, x, base - bs * 0.7, bs * 0.26, t, d.seed || 0);
  };

  nearAdd.organ = function (ctx, x, base, d, t, bs) {
    const pipes = 7;
    for (let i = 0; i < pipes; i++) {
      const h = bs * (1.2 + Math.sin(i * 1.3) * 0.5 + (i === Math.floor(pipes / 2) ? 0.6 : 0));
      const px = x - bs * 1.6 + i * bs * 0.5;
      ctx.fillStyle = T(i % 2 ? '#8a7530' : '#a08a3a');
      rr(ctx, px - bs * 0.18, base - h, bs * 0.36, h, 4);
      ctx.fill();
      ctx.strokeStyle = T('#3a2f10');
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(px, base - h, bs * 0.14, bs * 0.05, 0, 0, TAU);
      ctx.fill();
    }
  };

  nearAdd.bonepile = function (ctx, x, base, d, t, bs) {
    const rnd = U.rng(((d.seed || 1) * 71) | 0);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, base - 2, bs * 0.8, bs * 0.16, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const bx = x + (rnd() - 0.5) * bs * 1.4, by = base - 4 - rnd() * bs * 0.3, ang = (rnd() - 0.5) * TAU;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ang);
      ctx.fillStyle = T('#d8d0ba');
      const len = bs * (0.3 + rnd() * 0.3);
      ctx.fillRect(-len / 2, -3, len, 6);
      circle(ctx, -len / 2, 0, 5);
      ctx.fill();
      circle(ctx, len / 2, 0, 5);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#e8e2cc';
    circle(ctx, x, base - bs * 0.32, bs * 0.2);
    ctx.fill();
    ctx.fillStyle = '#1a1512';
    circle(ctx, x - 6, base - bs * 0.34, 4);
    ctx.fill();
    circle(ctx, x + 6, base - bs * 0.34, 4);
    ctx.fill();
  };

  nearAdd.skullniche = function (ctx, x, base, d, t, bs) {
    const h = bs * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x, base - h * 0.6, bs * 0.4, Math.PI, 0);
    ctx.lineTo(x + bs * 0.4, base - h * 0.1);
    ctx.lineTo(x - bs * 0.4, base - h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#4a4650');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#e8e2cc';
    circle(ctx, x, base - h * 0.55, bs * 0.22);
    ctx.fill();
    ctx.fillStyle = '#1a1512';
    circle(ctx, x - 7, base - h * 0.58, 4);
    ctx.fill();
    circle(ctx, x + 7, base - h * 0.58, 4);
    ctx.fill();
    tri(ctx, x - 3, base - h * 0.5, x + 3, base - h * 0.5, x, base - h * 0.43);
    ctx.fill();
  };

  nearAdd.mirrorframe = function (ctx, x, base, d, t, bs) {
    const w = bs * 1.3, h = bs * 2;
    ctx.fillStyle = T('#8a7530');
    rr(ctx, x - w / 2, base - h, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = T('#3a2f10');
    ctx.lineWidth = 3;
    ctx.stroke();
    const g = ctx.createLinearGradient(x - w / 2, base - h, x + w / 2, base);
    g.addColorStop(0, '#cfefff');
    g.addColorStop(0.5, '#7fb8d8');
    g.addColorStop(1, '#cfefff');
    ctx.fillStyle = g;
    rr(ctx, x - w * 0.38, base - h * 0.9, w * 0.76, h * 0.8, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const yy = base - h * 0.8 + i * h * 0.2;
      ctx.moveTo(x - w * 0.3, yy);
      ctx.lineTo(x + w * 0.3, yy + Math.sin(t + i) * 3);
    }
    ctx.stroke();
  };

  nearAdd.hangskeleton = function (ctx, x, base, d, t, bs) {
    const sway = Math.sin(t * 1.1 + (d.seed || 0)) * 0.08;
    ctx.save();
    ctx.translate(x, base - bs * 2.4);
    ctx.rotate(sway);
    ctx.strokeStyle = T('#4a4a50');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -bs * 0.6);
    ctx.lineTo(0, 0);
    ctx.stroke();
    const bone = '#e8e2cc';
    ctx.fillStyle = bone;
    circle(ctx, 0, bs * 0.14, bs * 0.16);
    ctx.fill();
    ctx.fillStyle = '#1a1512';
    circle(ctx, -5, bs * 0.12, 3);
    ctx.fill();
    circle(ctx, 5, bs * 0.12, 3);
    ctx.fill();
    ctx.strokeStyle = bone;
    ctx.lineWidth = bs * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, bs * 0.3);
    ctx.lineTo(0, bs * 0.75);
    ctx.stroke();
    ctx.lineWidth = bs * 0.06;
    for (const dx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, bs * 0.4);
      ctx.lineTo(dx * bs * 0.22, bs * 0.65 + Math.sin(t * 2 + dx) * 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, bs * 0.78);
      ctx.lineTo(dx * bs * 0.16, bs * 1.1);
      ctx.stroke();
    }
    ctx.restore();
  };

  nearAdd.monsterpaint = function (ctx, x, base, d, t, bs) {
    const w = bs * 2.4, h = bs * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    rr(ctx, x - w / 2, base - h, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = T('#8a1a2a');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, base - h * 0.55, w * 0.32, h * 0.28, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = T('#ffea3a');
    circle(ctx, x - w * 0.12, base - h * 0.6, bs * 0.12);
    ctx.fill();
    circle(ctx, x + w * 0.12, base - h * 0.6, bs * 0.12);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, x - w * 0.12, base - h * 0.6, bs * 0.05);
    ctx.fill();
    circle(ctx, x + w * 0.12, base - h * 0.6, bs * 0.05);
    ctx.fill();
    ctx.strokeStyle = T('#8a1a2a');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.2, base - h * 0.35);
    ctx.quadraticCurveTo(x, base - h * 0.2, x + w * 0.2, base - h * 0.35);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = -2; i <= 2; i++) {
      tri(ctx, x + i * bs * 0.15 - 5, base - h * 0.3, x + i * bs * 0.15 + 5, base - h * 0.3, x + i * bs * 0.15, base - h * 0.22);
      ctx.fill();
    }
  };

  Object.assign(Art.near, nearAdd);

  // =====================================================================
  // MID SCENERY (landmarks) — (ctx, x, base, d, t, font)
  // =====================================================================
  const midAdd = {};

  midAdd.ruinchurch = function (ctx, x, base, d, t, font) {
    const stone = T('#2e2a30');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - 260, base);
    ctx.lineTo(x - 260, base - 140);
    ctx.lineTo(x - 210, base - 170);
    ctx.lineTo(x - 170, base - 120);
    ctx.lineTo(x - 90, base - 210);
    ctx.lineTo(x - 40, base - 140);
    ctx.lineTo(x + 30, base - 190);
    ctx.lineTo(x + 90, base - 130);
    ctx.lineTo(x + 160, base - 150);
    ctx.lineTo(x + 200, base - 100);
    ctx.lineTo(x + 260, base - 120);
    ctx.lineTo(x + 260, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#161318');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = T('#242024');
    tri(ctx, x - 230, base - 140, x - 210, base - 290, x - 190, base - 140);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = T('#c8a227');
    circle(ctx, x - 210, base - 295, 4);
    ctx.fill();
    ctx.strokeStyle = T('#5a1a2a');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - 20, base - 150, 34, 0, TAU * 0.7);
    ctx.stroke();
    for (const wx of [x + 90, x + 180]) {
      ctx.fillStyle = 'rgba(160,20,30,0.35)';
      ctx.beginPath();
      ctx.moveTo(wx - 14, base - 30);
      ctx.lineTo(wx - 14, base - 90);
      ctx.arc(wx, base - 90, 14, Math.PI, 0);
      ctx.lineTo(wx + 14, base - 30);
      ctx.closePath();
      ctx.fill();
    }
  };

  midAdd.convent = function (ctx, x, base, d, t, font) {
    const w = 440, h = 190;
    ctx.fillStyle = T('#3a3438');
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.strokeStyle = T('#1c181c');
    ctx.lineWidth = 3;
    ctx.strokeRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = T('#241f26');
    tri(ctx, x - w / 2 - 10, base - h, x, base - h - 50, x + w / 2 + 10, base - h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = T('#c8a227');
    ctx.fillRect(x - 2, base - h - 70, 4, 20);
    ctx.fillRect(x - 8, base - h - 58, 16, 4);
    for (let wx = x - w / 2 + 30; wx < x + w / 2 - 20; wx += 52) {
      ctx.fillStyle = 'rgba(200,60,30,0.3)';
      ctx.beginPath();
      ctx.moveTo(wx, base - 30);
      ctx.lineTo(wx, base - 100);
      ctx.arc(wx + 11, base - 100, 11, Math.PI, 0);
      ctx.lineTo(wx + 22, base - 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = T('#1c181c');
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = T('#161014');
    ctx.beginPath();
    ctx.moveTo(x - 22, base);
    ctx.lineTo(x - 22, base - 60);
    ctx.arc(x, base - 60, 22, Math.PI, 0);
    ctx.lineTo(x + 22, base);
    ctx.closePath();
    ctx.fill();
  };

  midAdd.belltower = function (ctx, x, base, d, t, font) {
    const w = 140, h = 420;
    ctx.fillStyle = T('#3a3438');
    ctx.fillRect(x - w / 2, base - h, w, h);
    ctx.strokeStyle = T('#1c181c');
    ctx.lineWidth = 3;
    ctx.strokeRect(x - w / 2, base - h, w, h);
    ctx.fillStyle = 'rgba(10,5,5,0.7)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.32, base - h * 0.92);
    ctx.lineTo(x - w * 0.32, base - h * 0.78);
    ctx.arc(x, base - h * 0.78, w * 0.32, Math.PI, 0);
    ctx.lineTo(x + w * 0.32, base - h * 0.92);
    ctx.closePath();
    ctx.fill();
    const sway = Math.sin(t * 0.9 + (d.seed || 0)) * 0.15;
    ctx.save();
    ctx.translate(x, base - h * 0.85);
    ctx.rotate(sway);
    // yoke + crown
    ctx.fillStyle = T('#5a4a1c');
    ctx.fillRect(-6, -8, 12, 8);
    ctx.fillStyle = T('#8a7530');
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(-26, 4, -28, 22);
    ctx.quadraticCurveTo(-30, 34, -18, 38);
    ctx.lineTo(18, 38);
    ctx.quadraticCurveTo(30, 34, 28, 22);
    ctx.quadraticCurveTo(26, 4, 8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#4a3a10');
    ctx.lineWidth = 2;
    ctx.stroke();
    // flared skirt rim (a bell's mouth is wider than its shoulder)
    ctx.fillStyle = T('#9a8438');
    ctx.beginPath();
    ctx.ellipse(0, 38, 22, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = T('#4a3a10');
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // highlight
    ctx.strokeStyle = 'rgba(255,240,180,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 4);
    ctx.quadraticCurveTo(-20, 20, -14, 34);
    ctx.stroke();
    // clapper hanging inside
    ctx.strokeStyle = T('#3a3a3a');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(0, 30);
    ctx.stroke();
    ctx.fillStyle = T('#3a3a3a');
    circle(ctx, 0, 33, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = T('#241f26');
    tri(ctx, x - w * 0.6, base - h, x, base - h - 90, x + w * 0.6, base - h);
    ctx.fill();
    ctx.strokeStyle = T('#161318');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = T('#c8a227');
    circle(ctx, x, base - h - 94, 5);
    ctx.fill();
    for (let wy = base - h * 0.5; wy > base - h * 0.7; wy -= 60) {
      ctx.fillStyle = 'rgba(160,20,30,0.3)';
      ctx.fillRect(x - 10, wy - 24, 20, 24);
    }
  };

  midAdd.bigtop = function (ctx, x, base, d, t, font) {
    const w = 520, h = 260;
    ctx.fillStyle = T(PAL.stripeB);
    tri(ctx, x - w / 2, base, x, base - h, x + w / 2, base);
    ctx.fill();
    ctx.fillStyle = T(PAL.stripeA);
    for (const dx of [-0.6, -0.2, 0.2, 0.6]) {
      tri(ctx, x + dx * w - w * 0.09, base, x, base - h, x + dx * w + w * 0.09, base);
      ctx.fill();
    }
    ctx.strokeStyle = T('#241a30');
    ctx.lineWidth = 4;
    tri(ctx, x - w / 2, base, x, base - h, x + w / 2, base);
    ctx.stroke();
    ctx.fillStyle = T('#f2c230');
    for (let sx = x - w / 2; sx < x + w / 2; sx += 36) {
      ctx.beginPath();
      ctx.moveTo(sx, base);
      ctx.quadraticCurveTo(sx + 18, base + 16, sx + 36, base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = T('#8a7530');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, base - h);
    ctx.lineTo(x, base - h - 40);
    ctx.stroke();
    const flap = Math.sin(t * 3) * 4;
    ctx.fillStyle = T('#c8102e');
    tri(ctx, x, base - h - 40, x + 30, base - h - 32 + flap, x, base - h - 24);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,5,10,0.7)';
    tri(ctx, x - 30, base, x, base - h * 0.45, x + 30, base);
    ctx.fill();
  };

  midAdd.ferris = function (ctx, x, base, d, t, font) {
    const r = 190, cy = base - r - 10;
    ctx.strokeStyle = T('#4a4650');
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 60, base);
    ctx.lineTo(x, cy);
    ctx.lineTo(x + 60, base);
    ctx.stroke();
    const n = 12, spin = t * 0.15;
    for (let i = 0; i < n; i++) {
      if (i === 3 || i === 7) continue; // broken spokes
      const a = spin + (i / n) * TAU;
      const ex = x + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
      ctx.strokeStyle = T('#4a4650');
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      const lit = i % 3 !== 0;
      ctx.fillStyle = lit ? 'rgba(255,220,120,' + (0.6 + 0.4 * Math.sin(t * 8 + i)) + ')' : '#333';
      circle(ctx, ex, ey, 6);
      ctx.fill();
      if (i % 4 === 1) {
        ctx.strokeStyle = T('#5a5a5c');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + 8, ey + 30);
        ctx.stroke();
        ctx.fillStyle = T('#8a1a2a');
        ctx.fillRect(ex, ey + 30, 14, 10);
      }
    }
  };

  midAdd.carousel = function (ctx, x, base, d, t, font) {
    const w = 360, h = 210, roofY = base - h;
    ctx.fillStyle = T('#5a1a2a');
    ctx.beginPath();
    ctx.ellipse(x, roofY + 20, w * 0.42, 30, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = T(PAL.stripeB);
    tri(ctx, x - w / 2, roofY + 30, x, roofY - 40, x + w / 2, roofY + 30);
    ctx.fill();
    ctx.fillStyle = T(PAL.stripeA);
    for (const dx of [-0.5, 0, 0.5]) {
      tri(ctx, x + dx * w - 20, roofY + 30, x, roofY - 40, x + dx * w + 20, roofY + 30);
      ctx.fill();
    }
    ctx.strokeStyle = T('#241a30');
    ctx.lineWidth = 3;
    tri(ctx, x - w / 2, roofY + 30, x, roofY - 40, x + w / 2, roofY + 30);
    ctx.stroke();
    ctx.strokeStyle = T('#8a7530');
    ctx.lineWidth = 3;
    for (const px of [x - w * 0.32, x, x + w * 0.32]) {
      ctx.beginPath();
      ctx.moveTo(px, roofY + 35);
      ctx.lineTo(px, base - 24);
      ctx.stroke();
    }
    ctx.fillStyle = T('#3a2e2a');
    ctx.beginPath();
    ctx.ellipse(x, base - 16, w * 0.46, 22, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = T('#1c1512');
    ctx.lineWidth = 2;
    ctx.stroke();
    // two broken carousel horses, bobbing up and down on their poles
    for (const hi of [-1, 1]) {
      const hx = x + hi * w * 0.2, bob = Math.sin(t * 1.5 + hi * 2) * 5;
      const hy = base - 46 + bob;
      ctx.strokeStyle = T('#8a7530');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx, roofY + 35);
      ctx.lineTo(hx, hy + 30);
      ctx.stroke();
      ctx.fillStyle = T('#c9c2b0');
      // body
      ctx.beginPath();
      ctx.ellipse(hx, hy, 24, 12, 0, 0, TAU);
      ctx.fill();
      // neck + head, rearing
      ctx.beginPath();
      ctx.moveTo(hx + 14, hy - 6);
      ctx.quadraticCurveTo(hx + 24, hy - 26, hx + 18, hy - 34);
      ctx.quadraticCurveTo(hx + 30, hy - 32, hx + 28, hy - 22);
      ctx.quadraticCurveTo(hx + 26, hy - 8, hx + 18, hy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = T('#5a5248');
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // legs, splayed as if mid-gallop
      ctx.strokeStyle = T('#c9c2b0');
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx - 14, hy + 6);
      ctx.lineTo(hx - 20, hy + 24);
      ctx.moveTo(hx + 6, hy + 8);
      ctx.lineTo(hx + 12, hy + 26);
      ctx.stroke();
      // mane
      ctx.fillStyle = T('#5a1a2a');
      ctx.beginPath();
      ctx.moveTo(hx + 16, hy - 32);
      ctx.quadraticCurveTo(hx + 8, hy - 22, hx + 10, hy - 8);
      ctx.quadraticCurveTo(hx + 14, hy - 18, hx + 20, hy - 24);
      ctx.closePath();
      ctx.fill();
      // dark hollow eye
      ctx.fillStyle = '#1a1512';
      circle(ctx, hx + 20, hy - 26, 2);
      ctx.fill();
    }
  };

  Object.assign(Art.mid, midAdd);

  // half-width in blocks for each new mid landmark, for render's culling
  horror.midHalf = { ruinchurch: 6, convent: 5, belltower: 3, bigtop: 6, ferris: 6, carousel: 5 };
})();
