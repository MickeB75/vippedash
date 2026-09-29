// VippeDash — level 8 "Stratusvägens alla helgon" art: four friendly Halloween neighbours who throw
// things, a rocket skateboard, and their props. Loaded right after horror.js. Everything vector, no
// image files. See VD.Stratus for the registry (mirrors how js/horror.js exposes level art via VD.*).
//
// Every draw function takes (ctx, x, baseY, s, t, state):
//   x, baseY   feet position in screen px (bottom-centre of the character)
//   s          scale multiplier; 1 block = BS(=48) * s px, matching Art's BS convention
//   t          time in seconds, for idle animation (breathing sway, blinking, waving)
//   state      { throwK: 0..1 } — 0 idle, rises to 1 at the moment of release, animates the throwing
//              arm/leg. nr66 also reads state.doorK (0 closed .. 1 open).
(function () {
  const VD = (window.VD = window.VD || {});
  const U = VD.U;
  const Art = VD.Art;
  const TAU = Math.PI * 2;
  const rr = Art.rr, T = Art.T, TL = Art.TL;
  const BS = 48;

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
  // a stadium/capsule shape from (x0,y0) to (x1,y1), width r*2 — used for every limb
  function capsule(ctx, x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1e-6;
    const nx = (-dy / len) * r, ny = (dx / len) * r;
    const a0 = Math.atan2(ny, nx), a1 = Math.atan2(-ny, -nx);
    ctx.beginPath();
    ctx.moveTo(x0 + nx, y0 + ny);
    ctx.lineTo(x1 + nx, y1 + ny);
    ctx.arc(x1, y1, r, a0, a1);
    ctx.lineTo(x0 - nx, y0 - ny);
    ctx.arc(x0, y0, r, a1, a0 + TAU);
    ctx.closePath();
  }
  const OUTLINE = '#2a2018';
  function outline(ctx, w) {
    ctx.lineWidth = w;
    ctx.strokeStyle = OUTLINE;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const Stratus = (VD.Stratus = {});

  // =====================================================================
  // RIG — shared proportions so all four neighbours line up on the street
  // =====================================================================
  // returns key measurements in px for a person `heightBlocks` tall, feet at (x, baseY)
  function rig(x, baseY, s, heightBlocks) {
    const b = BS * s;
    const H = heightBlocks * b;
    const headR = H * 0.185;
    const headCy = baseY - H + headR * 1.08;
    const shoulderY = headCy + headR * 1.28;
    const hipY = baseY - H * 0.45;
    const shoulderW = H * 0.155;
    const hipW = H * 0.12;
    return { b, H, headR, headCy, shoulderY, hipY, shoulderW, hipW, x, baseY, s };
  }

  function groundShadow(ctx, x, baseY, rx) {
    ctx.fillStyle = 'rgba(10,8,4,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, baseY + rx * 0.12, rx, rx * 0.32, 0, 0, TAU);
    ctx.fill();
  }

  // two-segment leg: hip -> knee (ang1 from straight down) -> foot (ang1+ang2). Returns foot pos.
  function leg(ctx, hx, hy, ang1, ang2, len1, len2, w, pantsColor, pantsDark, shoeColor) {
    const kx = hx + Math.sin(ang1) * len1, ky = hy + Math.cos(ang1) * len1;
    const totalAng = ang1 + ang2;
    const fx = kx + Math.sin(totalAng) * len2, fy = ky + Math.cos(totalAng) * len2;
    ctx.fillStyle = pantsColor;
    capsule(ctx, hx, hy, kx, ky, w * 0.5);
    ctx.fill();
    outline(ctx, w * 0.1);
    ctx.fillStyle = pantsDark;
    capsule(ctx, kx, ky, fx, fy, w * 0.44);
    ctx.fill();
    outline(ctx, w * 0.1);
    // knee: a small filled circle to smooth the seam between the two segment widths
    ctx.fillStyle = pantsDark;
    circle(ctx, kx, ky, w * 0.22);
    ctx.fill();
    // shoe
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(totalAng);
    ctx.fillStyle = shoeColor;
    rr(ctx, -w * 0.32, -w * 0.1, w * 0.9, w * 0.42, w * 0.18);
    ctx.fill();
    outline(ctx, w * 0.09);
    ctx.restore();
    return { fx, fy, kx, ky };
  }

  // two-segment arm: shoulder -> elbow (ang1) -> hand (ang1+ang2). Returns hand pos.
  function arm(ctx, sx, sy, ang1, ang2, len1, len2, w, sleeveColor, skinColor, longSleeve) {
    const ex = sx + Math.sin(ang1) * len1, ey = sy + Math.cos(ang1) * len1;
    const totalAng = ang1 + ang2;
    const hx = ex + Math.sin(totalAng) * len2, hy = ey + Math.cos(totalAng) * len2;
    ctx.fillStyle = sleeveColor;
    capsule(ctx, sx, sy, ex, ey, w * 0.46);
    ctx.fill();
    outline(ctx, w * 0.09);
    ctx.fillStyle = longSleeve ? sleeveColor : skinColor;
    capsule(ctx, ex, ey, hx, hy, w * 0.38);
    ctx.fill();
    outline(ctx, w * 0.09);
    // elbow seam
    ctx.fillStyle = longSleeve ? sleeveColor : skinColor;
    circle(ctx, ex, ey, w * 0.19);
    ctx.fill();
    ctx.fillStyle = skinColor;
    circle(ctx, hx, hy, w * 0.32);
    ctx.fill();
    outline(ctx, w * 0.08);
    return { hx, hy, ex, ey };
  }

  // a single loose lock of hair: two tapered capsule segments root->mid->tip, gently curved.
  // Safe against self-intersection (unlike a hand-built closed path), so it never creates the
  // bowtie/stripe fill artifact a crossed outline can produce.
  function hairLock(ctx, x0, y0, x1, y1, x2, y2, w0, w1, color) {
    ctx.fillStyle = color;
    capsule(ctx, x0, y0, x1, y1, w0);
    ctx.fill();
    outline(ctx, w0 * 0.18);
    capsule(ctx, x1, y1, x2, y2, w1);
    ctx.fill();
    outline(ctx, w1 * 0.22);
  }

  // ---------- face (round head, not the game's rounded-rect cube face — same warm cartoon feel) ----------
  function faceBlush(ctx, cx, cy, r) {
    ctx.fillStyle = 'rgba(236,120,110,0.28)';
    circle(ctx, cx - r * 0.5, cy + r * 0.18, r * 0.16);
    ctx.fill();
    circle(ctx, cx + r * 0.5, cy + r * 0.18, r * 0.16);
    ctx.fill();
  }
  function eyesFace(ctx, cx, cy, r, o) {
    const ex = r * 0.4, ey = -r * 0.02;
    const squint = o.angry ? 0.55 : 1;
    for (const sx of [-1, 1]) {
      const x = cx + sx * ex, y = cy + ey;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.165, r * 0.145 * squint, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = r * 0.035;
      ctx.strokeStyle = '#3a2418';
      ctx.stroke();
      const look = o.lookX || 0;
      ctx.fillStyle = o.iris;
      circle(ctx, x + look * r * 0.03, y + r * 0.02, r * 0.09);
      ctx.fill();
      ctx.fillStyle = '#101010';
      circle(ctx, x + look * r * 0.03, y + r * 0.02, r * 0.045);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      circle(ctx, x + look * r * 0.03 - r * 0.03, y - r * 0.02, r * 0.026);
      ctx.fill();
    }
  }
  function browsFace(ctx, cx, cy, r, o) {
    ctx.strokeStyle = o.color;
    ctx.lineWidth = r * 0.055;
    ctx.lineCap = 'round';
    const ex = r * 0.4, ey = -r * 0.16;
    const steep = o.steep || 0.24;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      if (o.angry) {
        // steep furrowed V, well above the eyes, inner end dropped hard toward the nose
        ctx.moveTo(cx + sx * (ex + r * 0.18), ey - r * 0.08);
        ctx.lineTo(cx + sx * (ex - r * 0.22), ey + r * steep);
      } else {
        ctx.moveTo(cx + sx * (ex + r * 0.17), ey + r * 0.02);
        ctx.quadraticCurveTo(cx + sx * ex, ey - r * 0.1, cx + sx * (ex - r * 0.17), ey);
      }
      ctx.stroke();
    }
  }
  function mouthFace(ctx, cx, cy, r, o) {
    const y = cy + r * 0.42;
    if (o.mood === 'happy') {
      const w = r * 0.5, h = r * 0.34;
      ctx.beginPath();
      ctx.moveTo(cx - w, y);
      ctx.quadraticCurveTo(cx, y + h, cx + w, y);
      ctx.quadraticCurveTo(cx, y + h * 0.4, cx - w, y);
      ctx.closePath();
      ctx.fillStyle = '#5b1212';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#fffdf4';
      ctx.fillRect(cx - w * 1.05, y, w * 2.1, h * 0.5);
      ctx.restore();
      ctx.lineWidth = r * 0.045;
      ctx.strokeStyle = '#7d2b1e';
      ctx.stroke();
    } else {
      // angry: a clear downturned frown — corners droop below the centre (opposite curve of a smile)
      const w = r * 0.36, depth = r * (o.frownDepth == null ? 0.16 : o.frownDepth);
      ctx.beginPath();
      ctx.moveTo(cx - w, y + depth);
      ctx.quadraticCurveTo(cx, y - depth * 0.35, cx + w, y + depth);
      ctx.lineWidth = r * 0.065;
      ctx.strokeStyle = '#5b1212';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  // little comic anger puffs rising above the head
  function angerSteam(ctx, cx, topY, r, t, seed) {
    ctx.strokeStyle = 'rgba(230,230,236,0.75)';
    ctx.lineWidth = r * 0.06;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.6 + i * 0.5 + seed) % 1;
      const px = cx + (i === 0 ? -1 : 1) * r * 0.5;
      const py = topY - ph * r * 1.1;
      const a = (1 - ph) * 0.8;
      ctx.strokeStyle = 'rgba(225,225,232,' + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(px - r * 0.12, py + r * 0.22);
      ctx.quadraticCurveTo(px + r * 0.14, py + r * 0.08, px - r * 0.08, py - r * 0.1);
      ctx.quadraticCurveTo(px - r * 0.22, py - r * 0.24, px, py - r * 0.36);
      ctx.stroke();
    }
  }
  function roundGlasses(ctx, cx, cy, r, frameColor) {
    const ex = r * 0.4, ey = -r * 0.02, gr = r * 0.22;
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = r * 0.06;
    for (const sx of [-1, 1]) {
      circle(ctx, cx + sx * ex, cy + ey, gr);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - ex + gr, cy + ey);
    ctx.lineTo(cx + ex - gr, cy + ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - ex - gr, cy + ey - r * 0.02);
    ctx.lineTo(cx - r * 0.95, cy + ey - r * 0.1);
    ctx.moveTo(cx + ex + gr, cy + ey - r * 0.02);
    ctx.lineTo(cx + r * 0.95, cy + ey - r * 0.1);
    ctx.stroke();
  }

  // =====================================================================
  // NR 66 — happy woman, long loose near-black hair, beige sweater, lit doorway, throws candy
  // =====================================================================
  Stratus.nr66 = function (ctx, x, baseY, s, t, st) {
    st = st || {};
    const b = BS * s, doorK = U.clamp(st.doorK == null ? 1 : st.doorK, 0, 1);
    const R = rig(x, baseY, s, 2.45);
    const skin = '#f5cda3', hairC = '#161210', sweater = '#bd9a63', sweaterDark = '#8a6c3f', pants = '#4a4038', shoe = '#3a2e28';

    // ---- doorway behind her ----
    const doorW = b * 1.35, doorH = R.H * 1.22, doorX = x - doorW / 2, doorY = baseY - doorH;
    ctx.fillStyle = T('#5c3a28');
    rr(ctx, doorX - b * 0.12, doorY - b * 0.12, doorW + b * 0.24, doorH + b * 0.12, b * 0.08);
    ctx.fill();
    outline(ctx, b * 0.06);
    // warm hallway light, wider as the door opens
    const glowW = doorW * (0.1 + doorK * 0.82);
    const grad = ctx.createLinearGradient(doorX, 0, doorX + glowW, 0);
    grad.addColorStop(0, 'rgba(255,214,140,0.98)');
    grad.addColorStop(1, 'rgba(255,180,90,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(doorX, doorY, glowW, doorH);
    const flick = 0.9 + 0.1 * Math.sin(t * 5);
    ctx.fillStyle = 'rgba(255,224,160,' + (0.18 * flick).toFixed(2) + ')';
    ctx.fillRect(doorX, doorY, glowW, doorH);
    // door panel, swinging open on the far (left) hinge — narrows as doorK rises
    const panelW = doorW * (1 - doorK * 0.78);
    ctx.fillStyle = T('#7a4a28');
    ctx.fillRect(doorX + doorW - panelW, doorY, panelW, doorH);
    ctx.strokeStyle = T('#3a2210');
    ctx.lineWidth = b * 0.04;
    ctx.strokeRect(doorX + doorW - panelW, doorY, panelW, doorH);
    if (panelW > b * 0.18) {
      ctx.fillStyle = T('#c9a227');
      circle(ctx, doorX + doorW - panelW * 0.18, doorY + doorH * 0.52, b * 0.045);
      ctx.fill();
    }
    ctx.strokeStyle = T('#3a2210');
    ctx.lineWidth = b * 0.06;
    ctx.strokeRect(doorX - b * 0.12, doorY - b * 0.12, doorW + b * 0.24, doorH + b * 0.12);

    groundShadow(ctx, x, baseY, R.H * 0.24);

    const throwK = U.clamp(st.throwK || 0, 0, 1);
    const sway = Math.sin(t * 1.6) * 0.04;
    const cx = x, cy = R.headCy, r = R.headR;

    // ---- long loose hair, BEHIND the head/shoulders — drawn first, as one simple closed
    // silhouette (no inward cuts — a hand-built inner boundary can self-intersect and fill as a
    // stray stripe), shortened so its lowest point sits just above the sweater hem and is fully
    // hidden once the torso is drawn on top. Only the crescent framing the head/shoulders shows;
    // the couple of front-falling locks are added separately, after the torso, near the face. ----
    const swayL = Math.sin(t * 1.3) * r * 0.08, swayR = Math.sin(t * 1.3 + 1) * r * 0.08;
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.22);
    ctx.quadraticCurveTo(cx - r * 1.3, cy - r * 0.92, cx - r * 1.38, cy - r * 0.1);
    ctx.quadraticCurveTo(cx - r * 1.4, cy + r * 0.5, cx - r * 0.95 + swayL, R.shoulderY - R.H * 0.02);
    ctx.quadraticCurveTo(cx - r * 0.7, R.shoulderY + R.H * 0.08, cx - r * 0.3 + swayL * 1.3, R.shoulderY + R.H * 0.14);
    ctx.quadraticCurveTo(cx - r * 0.12, R.shoulderY + R.H * 0.06, cx, R.shoulderY - R.H * 0.02);
    ctx.quadraticCurveTo(cx + r * 0.12, R.shoulderY + R.H * 0.06, cx + r * 0.3 + swayR * 1.3, R.shoulderY + R.H * 0.14);
    ctx.quadraticCurveTo(cx + r * 0.7, R.shoulderY + R.H * 0.08, cx + r * 0.95 + swayR, R.shoulderY - R.H * 0.02);
    ctx.quadraticCurveTo(cx + r * 1.4, cy + r * 0.5, cx + r * 1.38, cy - r * 0.1);
    ctx.quadraticCurveTo(cx + r * 1.3, cy - r * 0.92, cx, cy - r * 1.22);
    ctx.closePath();
    ctx.fill();
    outline(ctx, r * 0.05);
    ctx.strokeStyle = '#3a322c';
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy - r * 0.4);
    ctx.quadraticCurveTo(cx - r * 1.15, cy + r * 0.15, cx - r * 0.85, R.shoulderY);
    ctx.moveTo(cx + r * 0.7, cy - r * 0.6);
    ctx.quadraticCurveTo(cx + r * 1.0, cy - r * 0.1, cx + r * 0.75, R.shoulderY);
    ctx.stroke();

    // legs (skirt hem hides most of the leg)
    leg(ctx, x - R.hipW * 0.5, R.hipY, sway * 0.3, 0, R.H * 0.24, R.H * 0.22, R.H * 0.1, pants, pants, shoe);
    leg(ctx, x + R.hipW * 0.5, R.hipY, -sway * 0.3, 0, R.H * 0.24, R.H * 0.22, R.H * 0.1, pants, pants, shoe);

    // far arm: relaxed, waving gently
    const waveAng = -2.2 + Math.sin(t * 3) * 0.15;
    arm(ctx, x - R.shoulderW * 0.9, R.shoulderY, waveAng, 0.5 + Math.sin(t * 3) * 0.15, R.H * 0.24, R.H * 0.22, R.H * 0.11, sweater, skin);

    // torso — beige knit sweater, slightly flared at the hip; drawn ON TOP of the hair silhouette
    // so it clips away the front of it, leaving only the framing crescent and side locks visible
    ctx.fillStyle = sweater;
    ctx.beginPath();
    ctx.moveTo(x - R.shoulderW, R.shoulderY);
    ctx.quadraticCurveTo(x - R.hipW * 1.35, (R.shoulderY + R.hipY) / 2, x - R.hipW * 1.2, R.hipY + R.H * 0.06);
    ctx.lineTo(x + R.hipW * 1.2, R.hipY + R.H * 0.06);
    ctx.quadraticCurveTo(x + R.hipW * 1.35, (R.shoulderY + R.hipY) / 2, x + R.shoulderW, R.shoulderY);
    ctx.quadraticCurveTo(x, R.shoulderY - R.H * 0.05, x - R.shoulderW, R.shoulderY);
    ctx.closePath();
    ctx.fill();
    outline(ctx, R.H * 0.045);
    // knit rib texture — a clear vertical rib pattern so the sweater reads as knitwear
    ctx.strokeStyle = sweaterDark;
    ctx.lineWidth = R.H * 0.02;
    ctx.globalAlpha = 0.6;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - R.shoulderW, R.shoulderY);
    ctx.quadraticCurveTo(x - R.hipW * 1.35, (R.shoulderY + R.hipY) / 2, x - R.hipW * 1.2, R.hipY + R.H * 0.06);
    ctx.lineTo(x + R.hipW * 1.2, R.hipY + R.H * 0.06);
    ctx.quadraticCurveTo(x + R.hipW * 1.35, (R.shoulderY + R.hipY) / 2, x + R.shoulderW, R.shoulderY);
    ctx.closePath();
    ctx.clip();
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * R.hipW * 0.3, R.hipY + R.H * 0.1);
      ctx.lineTo(x + i * R.shoulderW * 0.24, R.shoulderY - R.H * 0.05);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // collar + thin necklace with a small pendant, clearly on the chest
    ctx.strokeStyle = sweaterDark;
    ctx.lineWidth = R.H * 0.03;
    ctx.beginPath();
    ctx.arc(x, R.shoulderY - R.H * 0.02, R.headR * 0.6, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = '#d8c48a';
    ctx.lineWidth = R.H * 0.014;
    ctx.beginPath();
    ctx.moveTo(x - R.headR * 0.5, R.shoulderY + R.H * 0.02);
    ctx.quadraticCurveTo(x, R.shoulderY + R.H * 0.24, x + R.headR * 0.5, R.shoulderY + R.H * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#e8c96a';
    circle(ctx, x, R.shoulderY + R.H * 0.2, R.H * 0.022);
    ctx.fill();
    outline(ctx, R.H * 0.008);

    // near arm: throws candy
    const idleAng = 0.35, cockAng = -0.5, releaseAng = 1.15;
    const ang1 = throwK < 0.5 ? U.lerp(idleAng, cockAng, throwK * 2) : U.lerp(cockAng, releaseAng, (throwK - 0.5) * 2);
    const elbowBend = U.lerp(0.9, 0.15, throwK);
    const handPos = arm(ctx, x + R.shoulderW * 0.9, R.shoulderY, ang1, elbowBend, R.H * 0.24, R.H * 0.22, R.H * 0.11, sweater, skin);
    if (Stratus.candy) Stratus.candy(ctx, handPos.hx, handPos.hy, s * 0.4, t * 4);

    // ---- face ----
    circle(ctx, cx, cy, r);
    ctx.fillStyle = skin;
    ctx.fill();
    outline(ctx, r * 0.06);
    faceBlush(ctx, cx, cy, r);
    eyesFace(ctx, cx, cy, r, { iris: '#7a93a6', angry: false });
    browsFace(ctx, cx, cy, r, { color: '#241e18', angry: false });
    mouthFace(ctx, cx, cy, r, { mood: 'happy' });
    // hair front fringe over the forehead
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.62, cy - r * 0.5);
    ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.95, cx + r * 0.1, cy - r * 0.8);
    ctx.quadraticCurveTo(cx + r * 0.35, cy - r * 0.98, cx + r * 0.62, cy - r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 0.66, cx, cy - r * 0.68);
    ctx.quadraticCurveTo(cx - r * 0.35, cy - r * 0.62, cx - r * 0.62, cy - r * 0.5);
    ctx.closePath();
    ctx.fill();
    outline(ctx, r * 0.045);
    // two long loose locks falling from the TEMPLES (outside the face circle, so they never cross
    // the cheeks/eyes) down past the shoulders to about chest/elbow level — kept wide enough in x
    // that they stay clear of the necklace at the centre of the chest. Tapered capsule strands, so
    // they can't self-intersect the way a hand-built closed path can.
    for (const sd of [-1, 1]) {
      const swaySd = sd < 0 ? swayL : swayR;
      hairLock(
        ctx,
        cx + sd * r * 1.02, cy - r * 0.05,
        cx + sd * (r * 1.1 + swaySd * 0.6), R.shoulderY + R.H * 0.12,
        cx + sd * (r * 0.95 + swaySd), R.shoulderY + R.H * 0.3,
        r * 0.17, r * 0.08, hairC
      );
    }
  };

  // =====================================================================
  // NR 62 — angry woman, long loose light-blond hair, glasses, green leaf dress, throws zucchini
  // =====================================================================
  Stratus.nr62 = function (ctx, x, baseY, s, t, st) {
    st = st || {};
    const R = rig(x, baseY, s, 2.35);
    const skin = '#f2c6a0', hairC = '#e3cf94', hairDark = '#b39a5e', dressMain = '#eef1e2', leafC = '#4c7a4f', bag = '#1c2c4a';
    const throwK = U.clamp(st.throwK || 0, 0, 1);
    const sway = Math.sin(t * 1.4) * 0.03;

    groundShadow(ctx, x, baseY, R.H * 0.23);
    const cx = x, cy = R.headCy, r = R.headR;

    // ---- long loose light-blond hair, mostly BEHIND the head/shoulders — one simple closed
    // silhouette (no inward lineTo cuts, which can self-intersect and fill as a stray stripe),
    // shortened so it's covered by the dress below; a couple of locks stay in front, added after
    // the dress, near the face ----
    const swayL2 = Math.sin(t * 1.3 + 0.4) * r * 0.08, swayR2 = Math.sin(t * 1.3 + 1.4) * r * 0.08;
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.18);
    ctx.quadraticCurveTo(cx - r * 1.28, cy - r * 0.88, cx - r * 1.35, cy - r * 0.05);
    ctx.quadraticCurveTo(cx - r * 1.38, cy + r * 0.5, cx - r * 0.9 + swayL2, R.shoulderY);
    ctx.quadraticCurveTo(cx - r * 0.65, R.shoulderY + R.H * 0.1, cx - r * 0.28 + swayL2 * 1.3, R.shoulderY + R.H * 0.16);
    ctx.quadraticCurveTo(cx - r * 0.12, R.shoulderY + R.H * 0.06, cx, R.shoulderY);
    ctx.quadraticCurveTo(cx + r * 0.12, R.shoulderY + R.H * 0.06, cx + r * 0.28 + swayR2 * 1.3, R.shoulderY + R.H * 0.16);
    ctx.quadraticCurveTo(cx + r * 0.65, R.shoulderY + R.H * 0.1, cx + r * 0.9 + swayR2, R.shoulderY);
    ctx.quadraticCurveTo(cx + r * 1.38, cy + r * 0.5, cx + r * 1.35, cy - r * 0.05);
    ctx.quadraticCurveTo(cx + r * 1.28, cy - r * 0.88, cx, cy - r * 1.18);
    ctx.closePath();
    ctx.fill();
    outline(ctx, r * 0.05);
    ctx.strokeStyle = hairDark;
    ctx.lineWidth = r * 0.035;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.85, cy - r * 0.3);
    ctx.quadraticCurveTo(cx - r * 1.1, cy + r * 0.1, cx - r * 0.85, R.shoulderY - R.H * 0.02);
    ctx.moveTo(cx + r * 0.7, cy - r * 0.5);
    ctx.quadraticCurveTo(cx + r * 0.98, cy - r * 0.1, cx + r * 0.78, R.shoulderY - R.H * 0.02);
    ctx.stroke();
    ctx.globalAlpha = 1;

    leg(ctx, x - R.hipW * 0.5, R.hipY, sway * 0.2, 0, R.H * 0.24, R.H * 0.23, R.H * 0.095, skin, skin, '#3a2e28');
    leg(ctx, x + R.hipW * 0.5, R.hipY, -sway * 0.2, 0, R.H * 0.24, R.H * 0.23, R.H * 0.095, skin, skin, '#3a2e28');

    // far arm on hip (annoyed stance)
    arm(ctx, x - R.shoulderW * 0.9, R.shoulderY, -0.9, 1.7, R.H * 0.22, R.H * 0.18, R.H * 0.1, dressMain, skin);

    // dress: leaf-print, flares at the hem — drawn on top of the hair so it clips the front of it
    ctx.fillStyle = dressMain;
    ctx.beginPath();
    ctx.moveTo(x - R.shoulderW, R.shoulderY);
    ctx.quadraticCurveTo(x - R.hipW * 1.9, R.hipY + R.H * 0.05, x - R.hipW * 2.1, R.hipY + R.H * 0.26);
    ctx.lineTo(x + R.hipW * 2.1, R.hipY + R.H * 0.26);
    ctx.quadraticCurveTo(x + R.hipW * 1.9, R.hipY + R.H * 0.05, x + R.shoulderW, R.shoulderY);
    ctx.quadraticCurveTo(x, R.shoulderY - R.H * 0.05, x - R.shoulderW, R.shoulderY);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    const rnd = U.rng(62);
    ctx.fillStyle = leafC;
    for (let i = 0; i < 30; i++) {
      const lx = x + (rnd() - 0.5) * R.hipW * 4.4;
      const ly = R.shoulderY + rnd() * (R.hipY + R.H * 0.26 - R.shoulderY);
      const lr = R.H * (0.028 + rnd() * 0.024);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rnd() * TAU);
      ctx.beginPath();
      ctx.ellipse(0, 0, lr, lr * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    outline(ctx, R.H * 0.045);
    ctx.strokeStyle = dressMain;
    ctx.lineWidth = R.H * 0.02;
    ctx.beginPath();
    ctx.moveTo(x, R.shoulderY - R.H * 0.02);
    ctx.lineTo(x, R.hipY + R.H * 0.1);
    ctx.stroke();

    // navy crossbody bag strap + pouch
    ctx.strokeStyle = bag;
    ctx.lineWidth = R.H * 0.035;
    ctx.beginPath();
    ctx.moveTo(x - R.shoulderW * 0.7, R.shoulderY - R.H * 0.02);
    ctx.lineTo(x + R.hipW * 0.6, R.hipY);
    ctx.stroke();
    ctx.fillStyle = bag;
    rr(ctx, x + R.hipW * 0.35, R.hipY - R.H * 0.02, R.H * 0.16, R.H * 0.13, R.H * 0.03);
    ctx.fill();
    outline(ctx, R.H * 0.02);

    // near arm: throws zucchini overhand
    const idleAng = 0.3, cockAng = -1.9, releaseAng = 0.95;
    const ang1 = throwK < 0.5 ? U.lerp(idleAng, cockAng, throwK * 2) : U.lerp(cockAng, releaseAng, (throwK - 0.5) * 2);
    const elbowBend = U.lerp(1.0, 0.2, throwK);
    const handPos = arm(ctx, x + R.shoulderW * 0.9, R.shoulderY, ang1, elbowBend, R.H * 0.22, R.H * 0.18, R.H * 0.1, dressMain, skin);
    if (Stratus.zucchini) Stratus.zucchini(ctx, handPos.hx, handPos.hy, s * 0.26, ang1 + elbowBend);

    // ---- face ----
    circle(ctx, cx, cy, r);
    ctx.fillStyle = skin;
    ctx.fill();
    outline(ctx, r * 0.06);
    eyesFace(ctx, cx, cy, r, { iris: '#5c7a8f', angry: true });
    browsFace(ctx, cx, cy, r, { color: '#8a7024', angry: true, steep: 0.3 });
    mouthFace(ctx, cx, cy, r, { mood: 'angry', frownDepth: 0.17 });
    roundGlasses(ctx, cx, cy, r, '#2a2420');
    angerSteam(ctx, cx, cy - r * 1.1, r, t, 1.7);
    // fringe over the forehead
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy - r * 0.48);
    ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.92, cx + r * 0.15, cy - r * 0.78);
    ctx.quadraticCurveTo(cx + r * 0.4, cy - r * 0.94, cx + r * 0.6, cy - r * 0.48);
    ctx.quadraticCurveTo(cx + r * 0.25, cy - r * 0.62, cx, cy - r * 0.64);
    ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 0.6, cx - r * 0.6, cy - r * 0.48);
    ctx.closePath();
    ctx.fill();
    outline(ctx, r * 0.04);
    // two long loose locks falling from the TEMPLES (outside the face circle, clear of the glasses
    // and cheeks) down past the shoulders to about chest/elbow level, kept to the sides so the
    // leaf print stays clearly visible down the middle of the dress
    for (const sd of [-1, 1]) {
      const swayS = sd < 0 ? swayL2 : swayR2;
      hairLock(
        ctx,
        cx + sd * r * 1.0, cy - r * 0.02,
        cx + sd * (r * 1.06 + swayS * 0.6), R.shoulderY + R.H * 0.1,
        cx + sd * (r * 0.92 + swayS), R.shoulderY + R.H * 0.28,
        r * 0.16, r * 0.075, hairC
      );
    }
  };

  // two raised wooden garden boxes with big zucchini plants, next to nr62
  Stratus.nr62Garden = function (ctx, x, baseY, s, t) {
    const b = BS * s;
    for (let i = 0; i < 2; i++) {
      const bx = x + i * b * 1.4, bw = b * 1.15, bh = b * 0.5, by = baseY - bh;
      ctx.fillStyle = T('#7a5230');
      rr(ctx, bx, by, bw, bh, b * 0.06);
      ctx.fill();
      outline(ctx, b * 0.045);
      ctx.strokeStyle = T('#4a3016');
      ctx.lineWidth = b * 0.02;
      for (let px = bx + bw * 0.2; px < bx + bw; px += bw * 0.3) {
        ctx.beginPath();
        ctx.moveTo(px, by + b * 0.03);
        ctx.lineTo(px, by + bh - b * 0.03);
        ctx.stroke();
      }
      // soil
      ctx.fillStyle = '#2e2015';
      rr(ctx, bx + b * 0.05, by - b * 0.06, bw - b * 0.1, b * 0.14, b * 0.03);
      ctx.fill();
      // big leaves
      const rnd = U.rng(200 + i * 7);
      for (let l = 0; l < 5; l++) {
        const lx = bx + bw * (0.15 + rnd() * 0.7), ly = by - b * (0.1 + rnd() * 0.28);
        const wob = Math.sin(t * 1.2 + l + i) * 0.05;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(wob + (rnd() - 0.5) * 0.6);
        ctx.fillStyle = T(l % 2 ? '#3f6e3f' : '#4c7a4f');
        ctx.beginPath();
        ctx.ellipse(0, 0, b * 0.26, b * 0.17, 0, 0, TAU);
        ctx.fill();
        outline(ctx, b * 0.02);
        ctx.restore();
      }
      // a couple of ripe zucchini peeking out
      if (Stratus.zucchini) {
        Stratus.zucchini(ctx, bx + bw * 0.35, by - b * 0.06, s * 0.3, 0.3 + i);
        Stratus.zucchini(ctx, bx + bw * 0.68, by - b * 0.1, s * 0.26, -0.4 + i);
      }
    }
  };

  // =====================================================================
  // NR 50 — tall happy man, ash-blond hair swept back, black tee, kicks footballs
  // =====================================================================
  Stratus.nr50 = function (ctx, x, baseY, s, t, st) {
    st = st || {};
    const R = rig(x, baseY, s, 2.75);
    const skin = '#e8b98c', hairC = '#c9bd98', shirt = '#1c1c22', shirtDark = '#0a0a0e', shorts = '#3d5f8a', shortsDark = '#26405e', bag = '#4a3826';
    const throwK = U.clamp(st.throwK || 0, 0, 1);
    const sway = Math.sin(t * 1.3) * 0.03;

    groundShadow(ctx, x, baseY, R.H * 0.24);
    const hemY = R.hipY + R.H * 0.02;

    // planted leg — clearly blue denim shorts down to just above the knee, then bare shin to the shoe
    leg(ctx, x - R.hipW * 0.55, R.hipY, sway * 0.2, 0, R.H * 0.21, R.H * 0.26, R.H * 0.1, shorts, skin, '#e8e2d4');

    // kicking leg: idle bent slightly, swings forward and straightens for the strike
    const kIdle1 = 0.12, kCock1 = -0.35, kStrike1 = 0.95;
    const kIdle2 = 0.35, kCock2 = 0.65, kStrike2 = -0.1;
    const kAng1 = throwK < 0.5 ? U.lerp(kIdle1, kCock1, throwK * 2) : U.lerp(kCock1, kStrike1, (throwK - 0.5) * 2);
    const kAng2 = throwK < 0.5 ? U.lerp(kIdle2, kCock2, throwK * 2) : U.lerp(kCock2, kStrike2, (throwK - 0.5) * 2);
    const footPos = leg(ctx, x + R.hipW * 0.55, R.hipY, kAng1, kAng2, R.H * 0.21, R.H * 0.26, R.H * 0.1, shorts, skin, '#e8e2d4');
    if (Stratus.football && throwK < 0.85) Stratus.football(ctx, footPos.fx, footPos.fy - R.H * 0.03, s * 0.5, t * 2);

    // far arm relaxed — bare forearm, short sleeve cap added after the torso below
    arm(ctx, x - R.shoulderW * 0.95, R.shoulderY, 0.25 + Math.sin(t * 1.5) * 0.05, 0.25, R.H * 0.22, R.H * 0.2, R.H * 0.1, skin, skin);

    // torso: black short-sleeved tee, athletic straight taper (no belly bulge) reaching the hips
    const shW = R.shoulderW * 1.15, waW = R.shoulderW * 0.88, hiW = R.hipW * 1.15;
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(x - shW, R.shoulderY);
    ctx.lineTo(x - waW, R.shoulderY + (hemY - R.shoulderY) * 0.55);
    ctx.lineTo(x - hiW, hemY);
    ctx.lineTo(x + hiW, hemY);
    ctx.lineTo(x + waW, R.shoulderY + (hemY - R.shoulderY) * 0.55);
    ctx.lineTo(x + shW, R.shoulderY);
    ctx.quadraticCurveTo(x, R.shoulderY - R.H * 0.07, x - shW, R.shoulderY);
    ctx.closePath();
    ctx.fill();
    outline(ctx, R.H * 0.045);
    // short sleeve caps, over the top of each arm at the shoulder
    for (const sd of [-1, 1]) {
      ctx.fillStyle = shirt;
      ctx.save();
      ctx.translate(x + sd * R.shoulderW * 0.95, R.shoulderY);
      ctx.beginPath();
      ctx.arc(0, 0, R.H * 0.1 * 0.62, sd > 0 ? -Math.PI * 0.15 : Math.PI * 1.15, sd > 0 ? Math.PI * 0.85 : Math.PI * 2.15);
      ctx.closePath();
      ctx.fill();
      outline(ctx, R.H * 0.03);
      ctx.restore();
    }
    // crossbody bag strap + small brown pouch, sitting low on the hip so it doesn't blend into the shirt
    ctx.strokeStyle = bag;
    ctx.lineWidth = R.H * 0.03;
    ctx.beginPath();
    ctx.moveTo(x - R.shoulderW * 0.55, R.shoulderY - R.H * 0.02);
    ctx.lineTo(x + R.hipW * 0.85, hemY + R.H * 0.1);
    ctx.stroke();
    ctx.fillStyle = bag;
    rr(ctx, x + R.hipW * 0.55, hemY + R.H * 0.06, R.H * 0.15, R.H * 0.12, R.H * 0.025);
    ctx.fill();
    outline(ctx, R.H * 0.018);

    // near arm relaxed, bare forearm, gold watch on the wrist
    const nearArm = arm(ctx, x + R.shoulderW * 0.95, R.shoulderY, -0.2 + Math.sin(t * 1.5 + 1) * 0.05, -0.15, R.H * 0.22, R.H * 0.2, R.H * 0.1, skin, skin);
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = R.H * 0.03;
    ctx.beginPath();
    ctx.arc(nearArm.ex + (nearArm.hx - nearArm.ex) * 0.7, nearArm.ey + (nearArm.hy - nearArm.ey) * 0.7, R.H * 0.045, 0, TAU);
    ctx.stroke();

    // ---- head ----
    const cx = x, cy = R.headCy, r = R.headR;
    circle(ctx, cx, cy, r);
    ctx.fillStyle = skin;
    ctx.fill();
    outline(ctx, r * 0.06);
    faceBlush(ctx, cx, cy, r);
    eyesFace(ctx, cx, cy, r, { iris: '#4a7fb0', angry: false });
    browsFace(ctx, cx, cy, r, { color: '#8a7c56', angry: false });
    mouthFace(ctx, cx, cy, r, { mood: 'happy' });
    // light stubble
    ctx.fillStyle = 'rgba(90,74,54,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.62, r * 0.55, r * 0.32, 0, 0, Math.PI);
    ctx.fill();
    // hair: short ash-blond, shorter sides (hairline sits high, well above the ears) so the round
    // head shape still shows, with a swept quiff of volume at the front
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.8, cy - r * 0.28);
    ctx.quadraticCurveTo(cx - r * 0.95, cy - r * 0.78, cx - r * 0.3, cy - r * 1.08);
    ctx.quadraticCurveTo(cx + r * 0.15, cy - r * 1.28, cx + r * 0.68, cy - r * 0.98);
    ctx.quadraticCurveTo(cx + r * 0.95, cy - r * 0.7, cx + r * 0.82, cy - r * 0.24);
    ctx.quadraticCurveTo(cx + r * 0.55, cy - r * 0.44, cx + r * 0.18, cy - r * 0.5);
    ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.48, cx - r * 0.52, cy - r * 0.38);
    ctx.quadraticCurveTo(cx - r * 0.68, cy - r * 0.32, cx - r * 0.8, cy - r * 0.28);
    ctx.closePath();
    ctx.fill();
    outline(ctx, r * 0.05);
    ctx.strokeStyle = '#a89768';
    ctx.lineWidth = r * 0.028;
    for (const dx of [-0.4, -0.1, 0.2, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx * r, cy - r * 1.0);
      ctx.quadraticCurveTo(cx + dx * r * 0.6, cy - r * 0.75, cx + dx * r * 0.4, cy - r * 0.5);
      ctx.stroke();
    }
    // swept quiff — a wave of volume above the forehead, curling up and back to one side
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.28, cy - r * 0.46);
    ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 0.82, cx - r * 0.05, cy - r * 1.05);
    ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 1.22, cx + r * 0.38, cy - r * 0.92);
    ctx.quadraticCurveTo(cx + r * 0.2, cy - r * 0.78, cx + r * 0.22, cy - r * 0.56);
    ctx.quadraticCurveTo(cx + r * 0.02, cy - r * 0.42, cx - r * 0.28, cy - r * 0.46);
    ctx.closePath();
    ctx.fill();
    outline(ctx, r * 0.04);
    ctx.strokeStyle = '#a89768';
    ctx.lineWidth = r * 0.022;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.15, cy - r * 0.48);
    ctx.quadraticCurveTo(cx - r * 0.22, cy - r * 0.78, cx + r * 0.02, cy - r * 0.96);
    ctx.stroke();
  };

  // =====================================================================
  // NR 15 — short angry man, buzz-cut greying hair, glasses, tattooed right arm, heaves dumbbells
  // =====================================================================
  Stratus.nr15 = function (ctx, x, baseY, s, t, st) {
    st = st || {};
    // clearly shorter than nr50 (2.75 blocks) — about 80%
    const R = rig(x, baseY, s, 2.2);
    const skin = '#dfa878', hairC = '#a6a49c', shirt = '#d3122f', shirtDark = '#7a0a1a', pants = '#3a3a40', pantsDark = '#1e1e22';
    const throwK = U.clamp(st.throwK || 0, 0, 1);
    const sway = Math.sin(t * 1.7) * 0.03;

    groundShadow(ctx, x, baseY, R.H * 0.26);

    leg(ctx, x - R.hipW * 0.55, R.hipY, sway * 0.25, 0, R.H * 0.23, R.H * 0.22, R.H * 0.105, pants, pantsDark, '#151515');
    leg(ctx, x + R.hipW * 0.55, R.hipY, -sway * 0.25, 0, R.H * 0.23, R.H * 0.22, R.H * 0.105, pants, pantsDark, '#151515');

    // stocky torso (wider relative to height than the other neighbours)
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(x - R.shoulderW * 1.15, R.shoulderY);
    ctx.quadraticCurveTo(x - R.hipW * 1.7, (R.shoulderY + R.hipY) / 2, x - R.hipW * 1.5, R.hipY + R.H * 0.08);
    ctx.lineTo(x + R.hipW * 1.5, R.hipY + R.H * 0.08);
    ctx.quadraticCurveTo(x + R.hipW * 1.7, (R.shoulderY + R.hipY) / 2, x + R.shoulderW * 1.15, R.shoulderY);
    ctx.quadraticCurveTo(x, R.shoulderY - R.H * 0.06, x - R.shoulderW * 1.15, R.shoulderY);
    ctx.closePath();
    ctx.fill();
    outline(ctx, R.H * 0.05);

    // both arms heave dumbbells overhead as throwK rises
    const idleAng = 0.55, cockAng = 0.15, upAng = -2.85;
    const angL = throwK < 0.5 ? U.lerp(idleAng, cockAng, throwK * 2) : U.lerp(cockAng, upAng, (throwK - 0.5) * 2);
    const angR = angL;
    const bendIdle = 1.5, bendUp = 0.15;
    const bend = throwK < 0.5 ? U.lerp(bendIdle, bendIdle * 0.6, throwK * 2) : U.lerp(bendIdle * 0.6, bendUp, (throwK - 0.5) * 2);

    const leftHand = arm(ctx, x - R.shoulderW * 1.05, R.shoulderY, -angL, -bend, R.H * 0.2, R.H * 0.19, R.H * 0.1, shirt, skin);
    // right arm: bare from just below the shoulder (short red sleeve) down to the wrist, so the
    // full-sleeve tattoo (the recognisable detail) covers almost the whole arm, not just the forearm
    const rSx = x + R.shoulderW * 1.05, rSy = R.shoulderY;
    const rEx = rSx + Math.sin(angR) * R.H * 0.2, rEy = rSy + Math.cos(angR) * R.H * 0.2;
    const rTotalAng = angR + bend;
    const rHx = rEx + Math.sin(rTotalAng) * R.H * 0.19, rHy = rEy + Math.cos(rTotalAng) * R.H * 0.19;
    ctx.fillStyle = skin;
    capsule(ctx, rSx, rSy, rEx, rEy, R.H * 0.1 * 0.46);
    ctx.fill();
    outline(ctx, R.H * 0.1 * 0.09);
    ctx.fillStyle = skin;
    capsule(ctx, rEx, rEy, rHx, rHy, R.H * 0.1 * 0.38);
    ctx.fill();
    outline(ctx, R.H * 0.1 * 0.09);
    // tattoo ink over the whole arm (shoulder to wrist) in one pass so it reads as a continuous sleeve
    ctx.save();
    capsule(ctx, rSx, rSy, rEx, rEy, R.H * 0.1 * 0.46);
    ctx.clip();
    const inkColors = ['#2a4a8a', '#8a2a3a', '#2a7a5a', '#5a2a8a', '#c9902a'];
    const rnd2 = U.rng(15);
    for (let i = 0; i < 16; i++) {
      const ux = rSx + (rEx - rSx) * (i / 16) + (rnd2() - 0.5) * R.H * 0.07;
      const uy = rSy + (rEy - rSy) * (i / 16) + (rnd2() - 0.5) * R.H * 0.07;
      ctx.fillStyle = inkColors[i % inkColors.length];
      ctx.globalAlpha = 0.92;
      circle(ctx, ux, uy, R.H * (0.03 + rnd2() * 0.02));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.save();
    capsule(ctx, rEx, rEy, rHx, rHy, R.H * 0.1 * 0.38);
    ctx.clip();
    for (let i = 0; i < 16; i++) {
      const ux = rEx + (rHx - rEx) * (i / 16) + (rnd2() - 0.5) * R.H * 0.06;
      const uy = rEy + (rHy - rEy) * (i / 16) + (rnd2() - 0.5) * R.H * 0.06;
      ctx.fillStyle = inkColors[(i + 2) % inkColors.length];
      ctx.globalAlpha = 0.92;
      circle(ctx, ux, uy, R.H * (0.028 + rnd2() * 0.018));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    capsule(ctx, rSx, rSy, rEx, rEy, R.H * 0.1 * 0.46);
    outline(ctx, R.H * 0.1 * 0.09);
    capsule(ctx, rEx, rEy, rHx, rHy, R.H * 0.1 * 0.38);
    outline(ctx, R.H * 0.1 * 0.09);
    // short red sleeve cap at the very shoulder
    ctx.fillStyle = shirt;
    ctx.save();
    ctx.translate(rSx, rSy);
    ctx.rotate(angR);
    ctx.beginPath();
    ctx.arc(0, 0, R.H * 0.1 * 0.55, 0, Math.PI);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = skin;
    circle(ctx, rHx, rHy, R.H * 0.1 * 0.32);
    ctx.fill();
    outline(ctx, R.H * 0.1 * 0.08);

    if (Stratus.dumbbell) {
      Stratus.dumbbell(ctx, leftHand.hx, leftHand.hy, s * 0.22, angL + (-bend));
      Stratus.dumbbell(ctx, rHx, rHy, s * 0.22, angR + bend);
    }

    // ---- head ----
    const cx = x, cy = R.headCy, r = R.headR;
    circle(ctx, cx, cy, r);
    ctx.fillStyle = skin;
    ctx.fill();
    outline(ctx, r * 0.06);
    eyesFace(ctx, cx, cy, r, { iris: '#5a4a3a', angry: true });
    browsFace(ctx, cx, cy, r, { color: '#8a8880', angry: true, steep: 0.34 });
    mouthFace(ctx, cx, cy, r, { mood: 'angry', frownDepth: 0.19 });
    roundGlasses(ctx, cx, cy, r, '#161616');
    angerSteam(ctx, cx, cy - r * 1.15, r, t, 4.2);
    // grey stubble beard (jaw + chin, heavier than nr50's)
    ctx.fillStyle = 'rgba(120,118,112,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.6, r * 0.62, r * 0.4, 0, 0, Math.PI);
    ctx.fill();
    // buzz-cut, thinning on top — short all over, a bit sparse at the crown
    ctx.fillStyle = hairC;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.05, r * 1.0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.lineTo(cx + r * 0.85, cy - r * 0.3);
    ctx.quadraticCurveTo(cx, cy - r * 1.02, cx - r * 0.85, cy - r * 0.3);
    ctx.closePath();
    ctx.globalAlpha = 0.85;
    ctx.fill();
    outline(ctx, r * 0.035);
    ctx.globalAlpha = 1;
    // scalp showing through at the crown (thinning)
    ctx.fillStyle = 'rgba(223,168,120,0.4)';
    circle(ctx, cx, cy - r * 0.78, r * 0.22);
    ctx.fill();
  };

  // =====================================================================
  // SKATEBOARD — rocket-powered, deck ~1.4 blocks long
  // =====================================================================
  Stratus.skateboard = function (ctx, x, baseY, s, t, st) {
    st = st || {};
    const b = BS * s, on = !!st.on;
    const deckW = b * 1.4, deckH = b * 0.22, cy = baseY - b * 0.16;
    ctx.save();
    ctx.translate(x, cy);
    // wheels
    for (const wx of [-deckW * 0.32, -deckW * 0.12, deckW * 0.12, deckW * 0.32]) {
      ctx.fillStyle = '#2a2a2e';
      circle(ctx, wx, deckH * 0.55, b * 0.09);
      ctx.fill();
      outline(ctx, b * 0.02);
      ctx.fillStyle = '#8a8a92';
      circle(ctx, wx, deckH * 0.55, b * 0.035);
      ctx.fill();
    }
    // trucks
    ctx.fillStyle = '#8a8a92';
    ctx.fillRect(-deckW * 0.36, deckH * 0.28, deckW * 0.16, deckH * 0.16);
    ctx.fillRect(deckW * 0.2, deckH * 0.28, deckW * 0.16, deckH * 0.16);
    // deck
    ctx.fillStyle = '#7a4a28';
    rr(ctx, -deckW * 0.5, -deckH * 0.5, deckW, deckH, deckH * 0.4);
    ctx.fill();
    outline(ctx, b * 0.03);
    // kicktail
    ctx.fillStyle = '#7a4a28';
    ctx.beginPath();
    ctx.moveTo(deckW * 0.42, -deckH * 0.45);
    ctx.quadraticCurveTo(deckW * 0.58, -deckH * 1.4, deckW * 0.48, -deckH * 1.7);
    ctx.lineTo(deckW * 0.36, -deckH * 1.55);
    ctx.quadraticCurveTo(deckW * 0.4, -deckH * 0.9, deckW * 0.32, -deckH * 0.45);
    ctx.closePath();
    ctx.fill();
    outline(ctx, b * 0.025);
    // grip tape
    ctx.fillStyle = '#1a1a1a';
    rr(ctx, -deckW * 0.46, -deckH * 0.42, deckW * 0.88, deckH * 0.5, deckH * 0.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let gx = -deckW * 0.42; gx < deckW * 0.4; gx += b * 0.045) ctx.fillRect(gx, -deckH * 0.4, b * 0.014, deckH * 0.46);

    // rocket tube on the back
    const tubeX = -deckW * 0.52, tubeW = b * 0.22, tubeH = b * 0.36;
    ctx.fillStyle = '#c9c9d2';
    rr(ctx, tubeX - tubeW, -tubeH * 0.5, tubeW, tubeH, tubeW * 0.3);
    ctx.fill();
    outline(ctx, b * 0.025);
    ctx.strokeStyle = '#8a8a92';
    ctx.lineWidth = b * 0.015;
    ctx.beginPath();
    ctx.moveTo(tubeX - tubeW * 0.3, -tubeH * 0.5);
    ctx.lineTo(tubeX - tubeW * 0.3, tubeH * 0.5);
    ctx.moveTo(tubeX - tubeW * 0.65, -tubeH * 0.5);
    ctx.lineTo(tubeX - tubeW * 0.65, tubeH * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#d3122f';
    tri(ctx, tubeX - tubeW, -tubeH * 0.5, tubeX - tubeW, tubeH * 0.5, tubeX - tubeW * 1.25, 0);
    ctx.fill();
    outline(ctx, b * 0.02);

    if (on) {
      const flick = 0.85 + 0.15 * Math.sin(t * 30);
      const flameLen = b * (0.55 + 0.25 * Math.sin(t * 24));
      const fx = tubeX - tubeW;
      const grad = ctx.createLinearGradient(fx, 0, fx - flameLen, 0);
      grad.addColorStop(0, 'rgba(255,240,160,0.95)');
      grad.addColorStop(0.4, 'rgba(255,150,40,0.85)');
      grad.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fx, -tubeH * 0.42 * flick);
      ctx.quadraticCurveTo(fx - flameLen * 0.6, -tubeH * 0.12, fx - flameLen, 0);
      ctx.quadraticCurveTo(fx - flameLen * 0.6, tubeH * 0.12, fx, tubeH * 0.42 * flick);
      ctx.closePath();
      ctx.fill();
      // sparks
      const rnd = U.rng(Math.floor(t * 11));
      for (let i = 0; i < 4; i++) {
        const spx = fx - rnd() * flameLen, spy = (rnd() - 0.5) * tubeH * 0.7;
        ctx.fillStyle = 'rgba(255,220,140,' + (0.5 + rnd() * 0.5).toFixed(2) + ')';
        circle(ctx, spx, spy, b * 0.02 * rnd());
        ctx.fill();
      }
    } else {
      // parked: a small unlit fuse
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = b * 0.015;
      ctx.beginPath();
      ctx.moveTo(tubeX - tubeW, 0);
      ctx.quadraticCurveTo(tubeX - tubeW * 1.15, -b * 0.04, tubeX - tubeW * 1.3, -b * 0.02);
      ctx.stroke();
    }
    ctx.restore();
  };

  // =====================================================================
  // SMALL PROPS
  // =====================================================================
  const CANDY_COLORS = ['#e0344a', '#f2a020', '#3aa8e0', '#7a4fd6', '#3ab86a'];
  // wrapped sweet; colour picked deterministically from (x,y) so it doesn't flicker frame to frame
  Stratus.candy = function (ctx, x, y, s, ang) {
    const b = s * BS;
    const seed = Math.floor((x * 7 + y * 13) % CANDY_COLORS.length + CANDY_COLORS.length) % CANDY_COLORS.length;
    const col = CANDY_COLORS[seed];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.fillStyle = col;
    rr(ctx, -b * 0.5, -b * 0.22, b, b * 0.44, b * 0.14);
    ctx.fill();
    outline(ctx, b * 0.05);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = b * 0.06;
    ctx.beginPath();
    ctx.moveTo(-b * 0.15, -b * 0.14);
    ctx.lineTo(b * 0.1, b * 0.12);
    ctx.stroke();
    for (const sx of [-1, 1]) {
      tri(ctx, sx * b * 0.5, -b * 0.18, sx * b * 0.5, b * 0.18, sx * b * 0.78, 0);
      ctx.fillStyle = col;
      ctx.fill();
      outline(ctx, b * 0.04);
    }
    ctx.restore();
  };
  // classic black-and-white football
  Stratus.football = function (ctx, x, y, s, ang) {
    const b = s * BS;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.fillStyle = '#f4f1e6';
    circle(ctx, 0, 0, b * 0.5);
    ctx.fill();
    outline(ctx, b * 0.04);
    ctx.fillStyle = '#1a1a1a';
    const pentR = b * 0.18;
    circle(ctx, 0, 0, pentR);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      const px = Math.cos(a) * b * 0.34, py = Math.sin(a) * b * 0.34;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      circle(ctx, 0, 0, pentR * 0.7);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  // a long green zucchini with a small stem
  Stratus.zucchini = function (ctx, x, y, s, ang) {
    const b = s * BS;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.fillStyle = '#3f7a3f';
    ctx.beginPath();
    ctx.moveTo(-b * 1.1, -b * 0.32);
    ctx.quadraticCurveTo(b * 0.2, -b * 0.42, b * 1.15, -b * 0.06);
    ctx.quadraticCurveTo(b * 1.3, 0, b * 1.15, b * 0.06);
    ctx.quadraticCurveTo(b * 0.2, b * 0.42, -b * 1.1, b * 0.32);
    ctx.quadraticCurveTo(-b * 1.25, 0, -b * 1.1, -b * 0.32);
    ctx.closePath();
    ctx.fill();
    outline(ctx, b * 0.05);
    ctx.strokeStyle = 'rgba(180,225,170,0.5)';
    ctx.lineWidth = b * 0.05;
    ctx.beginPath();
    ctx.moveTo(-b * 0.7, -b * 0.1);
    ctx.quadraticCurveTo(0, -b * 0.2, b * 0.6, -b * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#2a4a1a';
    rr(ctx, -b * 1.28, -b * 0.12, b * 0.22, b * 0.24, b * 0.06);
    ctx.fill();
    outline(ctx, b * 0.03);
    ctx.restore();
  };
  // a gym dumbbell: a metal handle bar with knurled grip in the middle, and 3 thin stacked
  // plates on each end (not round weights/"tyres" — same overall bounding box as before, so
  // in-game hitboxes still match: width to about x=±1.05b, height to about y=±0.42b)
  Stratus.dumbbell = function (ctx, x, y, s, ang) {
    const b = s * BS;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    const barMain = '#9aa0a6', barDark = '#4a4e54';
    const handleHalf = b * 0.5; // exposed grip length half — longer than any single plate is tall

    // sleeve rods reaching out to the plates
    ctx.strokeStyle = barMain;
    ctx.lineWidth = b * 0.085;
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * handleHalf, 0);
      ctx.lineTo(sx * b * 1.0, 0);
      ctx.stroke();
    }
    outline(ctx, b * 0.018);
    // handle grip, with a knurled crosshatch texture in the middle
    ctx.fillStyle = barMain;
    rr(ctx, -handleHalf, -b * 0.075, handleHalf * 2, b * 0.15, b * 0.06);
    ctx.fill();
    outline(ctx, b * 0.02);
    ctx.strokeStyle = barDark;
    ctx.lineWidth = b * 0.014;
    for (let i = -3; i <= 3; i++) {
      const gx = i * b * 0.055;
      ctx.beginPath();
      ctx.moveTo(gx - b * 0.022, -b * 0.06);
      ctx.lineTo(gx + b * 0.022, b * 0.06);
      ctx.stroke();
    }

    // 3 thin stacked plates per side — narrow along the bar (x), tall across it (y), metallic
    // dark grey with a light highlight edge; sized so the tallest plate stays under the handle length
    const plates = [
      { h: b * 0.78, th: b * 0.1 },
      { h: b * 0.58, th: b * 0.08 },
      { h: b * 0.4, th: b * 0.065 },
    ];
    for (const sx of [-1, 1]) {
      let px = sx * handleHalf;
      for (const p of plates) {
        px += sx * p.th * 0.5;
        const grad = ctx.createLinearGradient(px - p.th / 2, 0, px + p.th / 2, 0);
        grad.addColorStop(0, '#2c2e32');
        grad.addColorStop(0.45, '#54585e');
        grad.addColorStop(1, '#1c1e22');
        ctx.fillStyle = grad;
        rr(ctx, px - p.th / 2, -p.h / 2, p.th, p.h, Math.min(p.th * 0.4, p.h * 0.4));
        ctx.fill();
        outline(ctx, b * 0.016);
        // light highlight edge, on the outward-facing side
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = b * 0.012;
        ctx.beginPath();
        ctx.moveTo(px + sx * (p.th / 2 - b * 0.012), -p.h / 2 + b * 0.04);
        ctx.lineTo(px + sx * (p.th / 2 - b * 0.012), p.h / 2 - b * 0.04);
        ctx.stroke();
        px += sx * p.th * 0.5;
      }
      // small collar/clip locking the plates to the bar
      ctx.fillStyle = '#c8b23a';
      rr(ctx, sx * (handleHalf + b * 0.02) - b * 0.018, -b * 0.055, b * 0.036, b * 0.11, b * 0.014);
      ctx.fill();
      outline(ctx, b * 0.012);
    }
    ctx.restore();
  };
  // jack-o'-lantern with a flickering glow when lit
  Stratus.pumpkin = function (ctx, x, y, s, t, lit) {
    const b = s * BS;
    ctx.save();
    ctx.translate(x, y);
    if (lit) {
      const flick = 0.85 + 0.15 * Math.sin(t * 9) + 0.05 * Math.sin(t * 23);
      ctx.save();
      ctx.shadowColor = 'rgba(255,150,30,0.9)';
      ctx.shadowBlur = b * 0.9 * flick;
      ctx.fillStyle = 'rgba(255,150,30,0.001)';
      circle(ctx, 0, 0, b * 0.05);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#e8731f';
    ctx.beginPath();
    ctx.ellipse(0, 0, b * 0.55, b * 0.46, 0, 0, TAU);
    ctx.fill();
    outline(ctx, b * 0.05);
    ctx.strokeStyle = 'rgba(120,50,10,0.4)';
    ctx.lineWidth = b * 0.03;
    for (const dx of [-0.55, -0.18, 0.18, 0.55]) {
      ctx.beginPath();
      ctx.ellipse(dx * b * 0.5, 0, b * 0.1, b * 0.44, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#4a7a2a';
    rr(ctx, -b * 0.06, -b * 0.62, b * 0.12, b * 0.16, b * 0.04);
    ctx.fill();
    outline(ctx, b * 0.025);
    const glow = lit ? '#fff3c0' : '#241608';
    ctx.fillStyle = glow;
    tri(ctx, -b * 0.24, -b * 0.06, -b * 0.1, -b * 0.06, -b * 0.17, -b * 0.22);
    ctx.fill();
    tri(ctx, b * 0.24, -b * 0.06, b * 0.1, -b * 0.06, b * 0.17, -b * 0.22);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-b * 0.28, b * 0.14);
    ctx.lineTo(-b * 0.16, b * 0.28);
    ctx.lineTo(-b * 0.06, b * 0.14);
    ctx.lineTo(0.04 * b, b * 0.28);
    ctx.lineTo(b * 0.14, b * 0.14);
    ctx.lineTo(b * 0.26, b * 0.26);
    ctx.lineTo(b * 0.26, b * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
})();
