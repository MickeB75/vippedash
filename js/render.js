// VippeDash — scene renderer: parallax sky/scenery, gameplay objects, player, particles, HUD
(function () {
  const VD = (window.VD = window.VD || {});
  const U = VD.U, Art = VD.Art, P = VD.PHYS;
  const W = 1280, H = 720, BS = 48, GY = 552, PX = 8;
  const HALF = W / BS / 2; // 13.33 blocks
  const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';
  const R = (VD.Render = { W, H, BS, GY, PX, FONT });

  // the sky (time of day), ground styles etc. come from the level's theme (see level.js)
  function skyAt(SKY, x) {
    let i = 0;
    while (i < SKY.length - 2 && x > SKY[i + 1].x) i++;
    const a = SKY[i], b = SKY[i + 1];
    const t = U.smooth(U.clamp((x - a.x) / (b.x - a.x), 0, 1));
    return {
      top: U.mixHex(a.top, b.top, t), bot: U.mixHex(a.bot, b.bot, t), far: U.mixHex(a.far, b.far, t),
      dark: U.lerp(a.dark, b.dark, t), sun: U.lerp(a.sun, b.sun, t),
    };
  }

  const MID_HALFWIDTH = {
    cottage: 5, barn: 6, church: 6, mounds: 10, oldchurch: 5, cityrow: 8, castle: 10, stadium: 7, cathedral: 11,
    willows: 6, farm: 9, hall: 6, villas: 9, home: 4, pines: 6, birches: 5, moose: 3,
    spruces: 6, tarn: 6, cranes: 4, deadtrees: 5, deer: 3, moosecalf: 4, foxrun: 2, rockhill: 9, firetower: 2, jakttorn: 2,
  };
  // 0..1: how much of x lies inside one of the listed areas, eased over `fade` blocks at each border
  function areaWeight(lvl, ids, x, fade = 12) {
    if (!ids) return 0;
    let w = 0;
    for (const a of lvl.areas) {
      if (ids.indexOf(a.id) < 0) continue;
      const k = U.smooth(U.clamp((x - a.x0 + fade / 2) / fade, 0, 1)) * (1 - U.smooth(U.clamp((x - a.x1 + fade / 2) / fade, 0, 1)));
      if (k > w) w = k;
    }
    return w;
  }

  R.init = function (canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    addEventListener('resize', () => this.resize());
  };
  R.resize = function () {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sc = Math.min(innerWidth / W, innerHeight / H);
    const cw = Math.floor(W * sc), ch = Math.floor(H * sc);
    this.cv.style.width = cw + 'px';
    this.cv.style.height = ch + 'px';
    const wrap = this.cv.parentElement;
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    document.documentElement.style.setProperty('--u', sc);
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.scale = (cw * dpr) / W;
    this.cssScale = sc;
  };

  // ------------------------------------------------------------------ precompute parallax layers
  R.build = function (lvl) {
    this.lvl = lvl;
    const th = (this.theme = lvl.theme);
    this.sky = th.sky;
    const pick = (map, id) => (id in map ? map[id] : map.default);
    const rnd = U.rng(20250926);
    // far layer (parallax 0.12)
    const pF = 0.12;
    this.pF = pF;
    const far = [];
    let u = -12;
    const uMaxF = (lvl.length + 80) * pF + 40;
    while (u < uMaxF) {
      const X = (u - HALF) / pF + PX;
      const kind = pick(th.far, lvl.areaAt(X).id);
      if (kind === 'city') {
        const w = 0.8 + rnd() * 1.1, h = 1.3 + rnd() * 2.2;
        far.push({ u, t: 'bldg', w, h, seed: Math.floor(rnd() * 1e6) });
        u += w + 0.08;
      } else if (kind === 'forest' || kind === 'sparse') {
        // a dense wall of spruces (or a thin line of them across the open bog)
        const sparse = kind === 'sparse';
        far.push({ u, t: 'spruce', h: sparse ? 0.6 + rnd() * 0.7 : 1.0 + rnd() * 1.3 });
        u += sparse ? 0.5 + rnd() * 1.2 : 0.16 + rnd() * 0.3;
      } else {
        const pine = kind === 'pine' || rnd() < 0.55;
        far.push({ u, t: pine ? 'pine' : 'birch', h: 0.8 + rnd() * 1.1 });
        u += 0.35 + rnd() * 0.7;
      }
    }
    for (const e of th.farExtra || []) far.push({ u: (e.x - PX) * pF + HALF + 4, t: e.t });
    far.sort((a, b) => a.u - b.u);
    this.far = far;

    // mid layer (parallax 0.4)
    const pM = 0.4;
    this.pM = pM;
    const mid = [];
    for (const L of lvl.landmarks) mid.push({ u: (L.X - PX) * pM + HALF, d: L, t: L.type, hw: MID_HALFWIDTH[L.type] || 6 });
    const uMaxM = (lvl.length + 80) * pM + 40;
    const [s0, s1] = th.midStep || [4, 6];
    for (let uu = -10; uu < uMaxM; uu += s0 + rnd() * s1) {
      const X = (uu - HALF) / pM + PX;
      const fill = pick(th.midFill, lvl.areaAt(X).id);
      if (!fill) continue;
      if (mid.some((m) => Math.abs(m.u - uu) < m.hw + 1.2)) continue;
      let type = 'pine1', h;
      if (fill === 'mixed') type = rnd() < 0.5 ? 'pine1' : 'birch1';
      else if (fill === 'spruce') type = rnd() < 0.75 ? 'spruce1' : 'pine1';
      else if (fill === 'dead') type = rnd() < 0.6 ? 'dead1' : 'pine1';
      h = 90 + rnd() * 60;
      if (type === 'spruce1') h += 40;
      mid.push({ u: uu, t: type, hw: 1.5, d: { h } });
    }
    mid.sort((a, b) => a.u - b.u);
    this.mid = mid;
    // field bands in mid-layer space
    this.fields = lvl.areas.map((ar) => ({ u0: (ar.x0 - PX) * pM + HALF, u1: (ar.x1 - PX) * pM + HALF, style: th.field[ar.id] }));
    this.indoors = lvl.areas.filter((a) => th.indoor && th.indoor[a.id]).map((a) => ({ x0: a.x0, x1: a.x1, kind: th.indoor[a.id] }));
    // flocks of birds for the forest sky: [start offset, height, size, count]
    this.flocks = [];
    if (th.flocks) for (let i = 0; i < 4; i++) this.flocks.push({ o: i * 0.27 + rnd() * 0.1, y: 70 + rnd() * 150, s: 0.7 + rnd() * 0.5, n: 3 + Math.floor(rnd() * 5), sp: 0.035 + rnd() * 0.02 });
    // stars
    const sr = U.rng(99);
    this.stars = [];
    for (let i = 0; i < 110; i++) this.stars.push({ x: sr() * W, y: sr() * 400, r: 0.6 + sr() * 1.6, p: sr() * 6 });
    this.clouds = [];
    for (let i = 0; i < 14; i++) this.clouds.push({ u: i * 9 + sr() * 5, y: 60 + sr() * 170, s: 0.6 + sr() * 0.8 });
  };

  const sx = (wx, camX) => (wx - camX) * BS;
  const sy = (wy) => GY - wy * BS;
  R.sx = sx;
  R.sy = sy;
  // first x <= x0 on a world-aligned grid of `step` px (off = how far the layer has scrolled, in px).
  // Patterns start from here so they scroll with the world, even where an area or a corridor starts on screen.
  const gridStart = (x0, off, step) => x0 - ((((x0 + off) % step) + step) % step);

  // ------------------------------------------------------------------ main draw
  R.draw = function (G, dt) {
    const ctx = this.ctx;
    const t = G.clock;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    let camX = G.camX;
    const shake = G.shake > 0 ? G.shake : 0;
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    const center = camX + HALF;
    const sky = skyAt(this.sky, center);
    Art.setDark(sky.dark);
    const px = G.s ? G.s.x : center - HALF + PX;
    // indoor areas (floorball hall, bear cave) fade in as you run through the door
    let inT = 0, inKind = null;
    for (const r of this.indoors) {
      const k = U.smooth(U.clamp((px - r.x0) / 6, 0, 1)) * (1 - U.smooth(U.clamp((px - (r.x1 - 8)) / 6, 0, 1)));
      if (k > inT) (inT = k), (inKind = r.kind);
    }

    if (inT < 1) {
      this.drawOutdoor(ctx, camX, sky, t, center);
      this.drawNear(ctx, camX, t, false);
      if (this.theme.canopy) this.drawCanopy(ctx, camX, t, areaWeight(this.lvl, this.theme.canopy, center));
    }
    if (inT > 0) {
      ctx.globalAlpha = inT;
      if (inKind === 'cave') {
        this.drawCave(ctx, camX, t);
        this.drawNear(ctx, camX, t, true);
        // a dark veil pushes the bear and the crystals behind the (brightly outlined) hazards
        ctx.fillStyle = 'rgba(16,12,24,0.45)';
        ctx.fillRect(0, 0, W, GY);
      } else {
        this.drawHall(ctx, camX, t);
        this.drawNear(ctx, camX, t, true);
      }
      ctx.globalAlpha = 1;
    }
    this.drawGround(ctx, camX, t, inT);
    this.drawCorridors(ctx, camX, t);
    this.drawObjects(ctx, camX, t, G);
    this.drawTexts(ctx, camX, G);
    if (G.s && G.state !== 'menu') this.drawPlayer(ctx, camX, G, t);
    this.drawParticles(ctx, camX, G);
    if (G.debug) this.drawDebug(ctx, camX, G);
    ctx.restore();
    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, G.flash) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (G.state !== 'menu') this.drawHUD(ctx, G, t);
  };

  // ------------------------------------------------------------------ sky + parallax
  R.drawOutdoor = function (ctx, camX, sky, t, center) {
    const th = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);

    // stars + moon
    const sa = U.clamp((sky.dark - 0.3) * 3, 0, 1);
    if (sa > 0) {
      ctx.fillStyle = '#ffffff';
      for (const s of this.stars) {
        ctx.globalAlpha = sa * (0.55 + 0.45 * Math.sin(t * 2 + s.p));
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = sa;
      const mg = ctx.createRadialGradient(260, 120, 20, 260, 120, 110);
      mg.addColorStop(0, 'rgba(255,246,218,0.35)');
      mg.addColorStop(1, 'rgba(255,246,218,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(150, 10, 220, 220);
      ctx.fillStyle = '#fff6da';
      ctx.beginPath();
      ctx.arc(260, 120, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(190,180,150,0.35)';
      for (const [mx, my, mr] of [[250, 110, 7], [272, 126, 5], [256, 134, 4], [268, 106, 3]]) {
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // sun
    if (sky.sun < 1.15) {
      const sunX = 1010 - sky.sun * 260, sunY = 90 + sky.sun * 460;
      const col = sky.sun < 0.5 ? U.mixHex('#fff7cf', '#ffd27a', sky.sun * 2) : U.mixHex('#ffd27a', '#ff5a3a', Math.min(1, (sky.sun - 0.5) * 2));
      const gl = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 150);
      gl.addColorStop(0, U.rgba(col, 0.55));
      gl.addColorStop(1, U.rgba(col, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
      ctx.fill();
    }
    // clouds
    const ca = U.clamp(1 - sky.dark * 1.3, 0.1, 1);
    const cloudCol = U.mixHex('#ffffff', '#ffc3b0', U.clamp((sky.sun - 0.4) * 1.5, 0, 1));
    ctx.fillStyle = U.rgba(cloudCol, 0.85 * ca);
    const cw = 14 * 9 * BS;
    for (const c of this.clouds) {
      let x = (c.u * BS - camX * BS * 0.05 - t * 6) % cw;
      if (x < -200) x += cw;
      if (x > W + 200) continue;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(x, c.y, 70 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 40 * s, c.y + 6 * s, 40 * s, 16 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 30 * s, c.y - 12 * s, 44 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // far layer
    const pF = this.pF;
    const farBase = GY - 26;
    const off = camX * pF;
    const hill = (u) => (1.1 + 0.45 * Math.sin(u * 0.13) + 0.3 * Math.sin(u * 0.37 + 1.7)) * 30;
    const farCol = sky.far, farDark = U.mixHex(sky.far, '#101830', 0.18);
    ctx.fillStyle = farCol;
    ctx.beginPath();
    ctx.moveTo(0, GY);
    for (let x = 0; x <= W + 16; x += 16) ctx.lineTo(x, farBase - hill(off + x / BS));
    ctx.lineTo(W, GY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = farDark;
    const lit = sky.dark > 0.35;
    for (const f of this.far) {
      const x = (f.u - off) * BS;
      if (x < -120 || x > W + 120) continue;
      const base = farBase - hill(f.u) + 4;
      if (f.t === 'pine') {
        const h = f.h * 48;
        ctx.beginPath();
        ctx.moveTo(x - h * 0.28, base);
        ctx.lineTo(x, base - h);
        ctx.lineTo(x + h * 0.28, base);
        ctx.fill();
      } else if (f.t === 'spruce') {
        // narrow, layered spruce silhouette
        const h = f.h * 52;
        ctx.beginPath();
        ctx.moveTo(x - h * 0.2, base);
        for (let k = 0; k < 4; k++) {
          const y0 = base - h * (0.08 + k * 0.23), w = h * (0.2 - k * 0.04);
          ctx.lineTo(x - w * 0.55, y0 - h * 0.08);
          ctx.lineTo(x - w, y0 - h * 0.04);
        }
        ctx.lineTo(x, base - h);
        for (let k = 3; k >= 0; k--) {
          const y0 = base - h * (0.08 + k * 0.23), w = h * (0.2 - k * 0.04);
          ctx.lineTo(x + w, y0 - h * 0.04);
          ctx.lineTo(x + w * 0.55, y0 - h * 0.08);
        }
        ctx.lineTo(x + h * 0.2, base);
        ctx.fill();
      } else if (f.t === 'birch') {
        ctx.beginPath();
        ctx.ellipse(x, base - f.h * 30, f.h * 18, f.h * 26, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.t === 'bldg') {
        const w = f.w * BS * 0.7, h = f.h * 30;
        ctx.fillRect(x, base - h, w, h + 6);
        if (lit) {
          ctx.fillStyle = 'rgba(255,214,130,0.8)';
          const r = U.rng(f.seed);
          for (let yy = base - h + 6; yy < base - 6; yy += 9) for (let xx = x + 4; xx < x + w - 4; xx += 8) if (r() > 0.6) ctx.fillRect(xx, yy, 3, 4);
          ctx.fillStyle = farDark;
        }
      } else if (f.t === 'spires') {
        for (const dx of [-14, 14]) {
          ctx.fillRect(x + dx - 9, base - 70, 18, 74);
          ctx.beginPath();
          ctx.moveTo(x + dx - 9, base - 70);
          ctx.lineTo(x + dx, base - 150);
          ctx.lineTo(x + dx + 9, base - 70);
          ctx.fill();
        }
        ctx.fillRect(x + 14, base - 46, 90, 50);
      }
    }

    // mid layer
    const pM = this.pM;
    const offM = camX * pM;
    const mb = GY - 18;
    for (const f of this.fields) {
      const x0 = Math.max(-10, (f.u0 - offM) * BS), x1 = Math.min(W + 10, (f.u1 - offM) * BS);
      if (x1 <= x0) continue;
      this.drawField(ctx, f.style, x0, x1, mb, offM, t);
    }
    for (const m of this.mid) {
      const x = (m.u - offM) * BS;
      if (x < -m.hw * BS - 40 || x > W + m.hw * BS + 40) continue;
      if (m.t === 'pine1') Art.pineTree(ctx, x, mb + 2, m.d.h, '#2f5e37');
      else if (m.t === 'birch1') Art.birchTree(ctx, x, mb + 2, m.d.h);
      else if (m.t === 'spruce1') Art.spruceTree(ctx, x, mb + 2, m.d.h);
      else if (m.t === 'dead1') Art.deadSnag(ctx, x, mb + 2, m.d.h * 0.8);
      else if (Art.mid[m.t]) Art.mid[m.t](ctx, x, mb + 2, m.d, t, FONT);
    }
    // light haze pushes the scenery back behind the gameplay layer
    ctx.fillStyle = U.rgba(sky.bot, 0.16);
    ctx.fillRect(0, 0, W, GY);
    if (th.flocks) this.drawFlocks(ctx, camX, t, sky);
    if (th.mist) this.drawMist(ctx, camX, t, areaWeight(this.lvl, th.mist, center, 24));
    if (th.beams) this.drawBeams(ctx, camX, t, areaWeight(this.lvl, th.beams, center, 24) * (1 - sky.dark));
    // the regional train racing along the railway towards Storvreta
    if (th.train && camX > th.train[0] && camX < th.train[1]) {
      const tx = -700 + (camX - th.train[0] - 8) * BS * 0.3;
      this.drawTrain(ctx, tx, mb - 2, t);
    }
  };

  // ------------------------------------------------------------------ forest atmosphere
  R.drawFlocks = function (ctx, camX, t, sky) {
    ctx.strokeStyle = U.rgba(U.mixHex('#2a2a36', sky.top, 0.35), 0.8);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const f of this.flocks) {
      // each flock drifts across the screen, the parallax makes it slide back a little as you run
      const span = W + 600;
      const x0 = (((t * f.sp + f.o) * span - camX * 3) % span + span) % span - 300;
      for (let i = 0; i < f.n; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
        const bx = x0 - row * 22 * f.s, by = f.y + row * 12 * f.s * side + Math.sin(t * 1.3 + i) * 3;
        const flap = Math.sin(t * 9 + i * 1.3 + f.o * 10) * 5 * f.s;
        const w = 9 * f.s;
        ctx.lineWidth = 2.2 * f.s;
        ctx.beginPath();
        ctx.moveTo(bx - w, by - flap);
        ctx.quadraticCurveTo(bx - w * 0.4, by - 3 * f.s, bx, by);
        ctx.quadraticCurveTo(bx + w * 0.4, by - 3 * f.s, bx + w, by - flap);
        ctx.stroke();
      }
    }
  };
  R.drawBeams = function (ctx, camX, t, k) {
    if (k <= 0.01) return;
    const off = camX * BS * 0.35;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 380 - off) % 2280 + 2280) % 2280 - 400;
      if (x < -500 || x > W + 200) continue;
      const w = 60 + (i % 3) * 40, a = k * (0.1 + 0.05 * Math.sin(t * 0.7 + i));
      const g = ctx.createLinearGradient(0, 0, 0, GY);
      g.addColorStop(0, 'rgba(255,245,200,' + a + ')');
      g.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w + 260, GY);
      ctx.lineTo(x + 180, GY);
      ctx.closePath();
      ctx.fill();
    }
    // specks of pollen drifting in the light
    ctx.fillStyle = 'rgba(255,250,210,' + 0.6 * k + ')';
    for (let i = 0; i < 26; i++) {
      const x = ((U.hash(i) * W * 1.4 - camX * BS * 0.5 + t * 8) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
      const y = 120 + U.hash(i * 3.3) * 380 + Math.sin(t * 0.8 + i) * 12;
      ctx.fillRect(x, y, 2, 2);
    }
  };
  R.drawMist = function (ctx, camX, t, k) {
    if (k <= 0.01) return;
    for (let i = 0; i < 3; i++) {
      const y = GY - 70 - i * 60;
      const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      g.addColorStop(0, 'rgba(235,240,238,0)');
      g.addColorStop(0.5, 'rgba(235,240,238,' + k * (0.32 - i * 0.07) + ')');
      g.addColorStop(1, 'rgba(235,240,238,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 40, W, 80);
    }
    ctx.fillStyle = 'rgba(245,248,246,' + 0.22 * k + ')';
    for (let i = 0; i < 7; i++) {
      const x = ((i * 260 - camX * BS * (0.25 + i * 0.03) + t * 14) % 1820 + 1820) % 1820 - 270;
      ctx.beginPath();
      ctx.ellipse(x, GY - 40 - (i % 3) * 50, 170, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  // spruce branches hanging over the top of the screen in the deep forest
  R.drawCanopy = function (ctx, camX, t, k) {
    if (k <= 0.01) return;
    const off = camX * BS * 0.8;
    const drop = 80 * k;
    ctx.fillStyle = Art.T('#16341f');
    ctx.fillRect(0, 0, W, drop - 40);
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = Art.T(layer ? '#1e4428' : '#16341f');
      const step = 70;
      const start = -(((off * (1 - layer * 0.2)) % step) + step) % step - step;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      for (let x = start; x < W + step * 2; x += step) {
        const i = Math.floor((x + off * (1 - layer * 0.2)) / step);
        const d = drop - 30 + layer * 14 + (U.hash(i + layer * 50) * 34 - 10) * k;
        const sway = Math.sin(t * 0.9 + i) * 3;
        ctx.lineTo(x + step * 0.2, d * 0.6);
        ctx.lineTo(x + step * 0.5 + sway, d);
        ctx.lineTo(x + step * 0.8, d * 0.6);
      }
      ctx.lineTo(W + 10, 0);
      ctx.closePath();
      ctx.fill();
    }
  };

  R.drawField = function (ctx, style, x0, x1, mb, offM, t) {
    const T = Art.T;
    const w = x1 - x0;
    if (style === 'river') {
      ctx.fillStyle = T('#5a86ad');
      ctx.fillRect(x0, mb - 6, w, GY - mb + 10);
      ctx.fillStyle = 'rgba(255,220,180,0.35)';
      for (let x = gridStart(x0, offM * BS, 60); x < x1; x += 60) {
        const i = Math.round((x + offM * BS) / 60);
        ctx.fillRect(x + Math.sin(t + i) * 4, mb + 4 + ((i * 7) & 7), 26, 2);
      }
      return;
    }
    const base = { meadow: '#7dbb4e', golden: '#b6b25a', park: '#7a9a5a', farm: '#8ba55a', lawn: '#6f9f52', forest: '#3f6b34', bog: '#7b8a55', glade: '#86c05a' }[style] || '#7dbb4e';
    ctx.fillStyle = T(base);
    ctx.fillRect(x0, mb - 6, w, GY - mb + 10);
    if (style === 'forest') {
      // mossy forest floor with blueberry bushes
      ctx.fillStyle = T('#2f5528');
      for (let x = gridStart(x0, offM * BS, 90); x < x1; x += 90) {
        ctx.beginPath();
        ctx.ellipse(x + 30, mb - 2, 26, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = T('#2f3f8a');
      for (let x = gridStart(x0, offM * BS, 90); x < x1; x += 90) ctx.fillRect(x + 24, mb - 5, 3, 3), ctx.fillRect(x + 38, mb - 3, 3, 3);
    } else if (style === 'bog') {
      // open bog: pools of water and tufts of cotton grass
      ctx.fillStyle = T('#5a7684');
      for (let x = gridStart(x0, offM * BS, 220); x < x1; x += 220) {
        ctx.beginPath();
        ctx.ellipse(x + 90, mb + 2, 60, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = T('#f4f2ea');
      for (let x = gridStart(x0, offM * BS, 40); x < x1; x += 40) {
        const i = Math.round((x + offM * BS) / 40);
        ctx.fillRect(x + ((i * 7) & 15), mb - 7 - ((i * 3) & 3), 3, 3);
      }
    } else if (style === 'glade') {
      const cols = ['#ffffff', '#ffd21c', '#d65ab0', '#7b5bd6'];
      for (let x = gridStart(x0, offM * BS, 26); x < x1; x += 26) {
        const i = Math.round((x + offM * BS) / 26);
        ctx.fillStyle = T(cols[(i & 3)]);
        ctx.fillRect(x, mb - 4 + ((i * 5) & 7), 3, 3);
      }
    }
    if (style === 'meadow' || style === 'farm') {
      // rapeseed stripes
      ctx.fillStyle = T('#f2d43a');
      for (let x = gridStart(x0, offM * BS, 520); x < x1; x += 520) {
        const a0 = Math.max(x0, x), a1 = Math.min(x1, x + 260);
        if (a1 > a0) ctx.fillRect(a0, mb - 2, a1 - a0, 7);
      }
    }
    if (style === 'farm') {
      // railway embankment + tracks
      ctx.fillStyle = T('#7c7468');
      ctx.fillRect(x0, mb - 4, w, 8);
      ctx.fillStyle = T('#4a3b2e');
      for (let x = gridStart(x0, offM * BS, 14); x < x1; x += 14) if (x >= x0) ctx.fillRect(x, mb - 3, Math.min(6, x1 - x), 5);
      ctx.fillStyle = T('#b8bcc2');
      ctx.fillRect(x0, mb - 4, w, 2);
      // power line poles
      ctx.strokeStyle = T('#4a3b2e');
      ctx.lineWidth = 3;
      for (let x = gridStart(x0, offM * BS, 240) + 60; x < x1; x += 240) {
        if (x < x0) continue;
        ctx.beginPath();
        ctx.moveTo(x, mb);
        ctx.lineTo(x, mb - 120);
        ctx.moveTo(x - 18, mb - 110);
        ctx.lineTo(x + 18, mb - 110);
        ctx.stroke();
      }
      ctx.strokeStyle = T('#333a44');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = gridStart(x0, offM * BS, 240) + 60; x < x1 - 240; x += 240) {
        if (x < x0) continue;
        ctx.moveTo(x - 18, mb - 110);
        ctx.quadraticCurveTo(x + 102, mb - 96, x + 222, mb - 110);
        ctx.moveTo(x + 18, mb - 110);
        ctx.quadraticCurveTo(x + 138, mb - 96, x + 258, mb - 110);
      }
      ctx.stroke();
    }
  };

  R.drawTrain = function (ctx, x, base, t) {
    const T = Art.T;
    const lit = Art.dark() > 0.3;
    for (let c = 0; c < 4; c++) {
      const cx = x + c * 172;
      const front = c === 3;
      ctx.fillStyle = T('#e9ecef');
      ctx.beginPath();
      ctx.moveTo(cx, base - 8);
      ctx.lineTo(cx, base - 62);
      if (front) {
        ctx.lineTo(cx + 140, base - 62);
        ctx.quadraticCurveTo(cx + 170, base - 58, cx + 172, base - 20);
        ctx.lineTo(cx + 168, base - 8);
      } else {
        ctx.lineTo(cx + 168, base - 62);
        ctx.lineTo(cx + 168, base - 8);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = T('#c8102e');
      ctx.fillRect(cx, base - 22, front ? 170 : 168, 7);
      ctx.fillStyle = lit ? '#ffe3a0' : T('#2c3e50');
      for (let wx = cx + 10; wx < cx + (front ? 128 : 158); wx += 24) ctx.fillRect(wx, base - 52, 17, 20);
      if (front) {
        ctx.fillStyle = T('#1d2a36');
        ctx.fillRect(cx + 140, base - 54, 24, 18);
        ctx.fillStyle = '#fff8cc';
        ctx.beginPath();
        ctx.arc(cx + 166, base - 26, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = T('#222');
      for (const wx of [cx + 22, cx + 46, cx + 124, cx + 148]) {
        ctx.beginPath();
        ctx.arc(wx, base - 7, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = T('#333');
      ctx.fillRect(cx - 2, base - 66, 172, 5);
    }
  };

  // ------------------------------------------------------------------ inside the floorball hall
  R.drawHall = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#1b2233');
    g.addColorStop(1, '#3a4660');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * 0.5 * BS;
    // bleachers + crowd
    for (let row = 0; row < 6; row++) {
      const y = 290 + row * 34;
      ctx.fillStyle = row % 2 ? '#2b3448' : '#323c52';
      ctx.fillRect(0, y, W, 34);
      for (let i = 0; i < 44; i++) {
        const x = ((i * 31 + row * 13 - off * (0.9 + row * 0.02)) % (W + 60) + W + 60) % (W + 60) - 30;
        const hue = (i * 47 + row * 71) % 360;
        const bob = Math.sin(t * 6 + i * 0.7 + row) * 2;
        ctx.fillStyle = 'hsl(' + hue + ',40%,42%)';
        ctx.fillRect(x - 7, y + 12 + bob, 14, 18);
        ctx.fillStyle = '#b8977a';
        ctx.beginPath();
        ctx.arc(x, y + 8 + bob, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // banners
    const banners = ['HEJA VIPPE!', 'STORVRETA', 'INNEBANDY', 'HEJA VIPPE!'];
    ctx.font = '30px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      const x = ((i * 420 - off * 0.8) % 1680 + 1680) % 1680 - 200;
      if (x < -250 || x > W + 250) continue;
      ctx.fillStyle = i % 2 ? '#1d5fc4' : '#f2c230';
      ctx.fillRect(x - 120, 228, 240, 52);
      ctx.fillStyle = i % 2 ? '#fff' : '#1b2233';
      ctx.fillText(banners[i % banners.length], x, 255);
    }
    // boards (sarg) at the back of the rink
    ctx.fillStyle = '#c9d3dc';
    ctx.fillRect(0, GY - 26, W, 26);
    ctx.fillStyle = '#1d5fc4';
    ctx.fillRect(0, GY - 26, W, 5);
    ctx.fillStyle = '#7d8a99';
    ctx.font = '15px ' + FONT;
    for (let x = ((-camX * BS * 0.9) % 300) - 300; x < W + 300; x += 300) ctx.fillText('HEJA VIPPE', x + 150, GY - 11);
  };

  // ------------------------------------------------------------------ inside the bear cave
  R.drawCave = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#15121c');
    g.addColorStop(1, '#2f2a38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    // two layers of rock wall, the far one slower
    for (let layer = 0; layer < 2; layer++) {
      const off = camX * BS * (0.3 + layer * 0.25), step = 160 - layer * 30;
      ctx.fillStyle = layer ? '#302a3a' : '#241f2c';
      const start = -((off % step) + step) % step - step;
      for (let x = start; x < W + step; x += step) {
        const i = Math.floor((x + off) / step);
        const h = 110 + U.hash(i * 1.7 + layer * 9) * 170;
        ctx.beginPath();
        ctx.moveTo(x - step * 0.2, GY);
        ctx.quadraticCurveTo(x + step * 0.1, GY - h, x + step * 0.5, GY - h * (0.9 + 0.1 * U.hash(i)));
        ctx.quadraticCurveTo(x + step * 0.9, GY - h, x + step * 1.2, GY);
        ctx.fill();
        // hanging rock from the roof
        const hh = 40 + U.hash(i * 2.3 + layer) * 90;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + step * 0.35, hh, x + step * 0.5, hh * 1.1);
        ctx.quadraticCurveTo(x + step * 0.65, hh, x + step, 0);
        ctx.fill();
      }
    }
    // glow-worms on the roof
    for (let i = 0; i < 40; i++) {
      const x = ((U.hash(i * 5.1) * W * 1.5 - camX * BS * 0.45) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
      const y = 20 + U.hash(i * 2.9) * 440;
      ctx.fillStyle = 'rgba(130,255,230,' + (0.35 + 0.35 * Math.sin(t * 2 + i)) + ')';
      ctx.fillRect(x, y, 2.5, 2.5);
    }
    // dripping water
    ctx.fillStyle = 'rgba(160,220,255,0.7)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 290 - camX * BS * 0.55) % 1450 + 1450) % 1450 - 100;
      const u = (t * 0.7 + i * 0.37) % 1;
      ctx.fillRect(x, 200 + u * 330, 2, 6);
    }
    // bats fluttering about in the dark
    ctx.fillStyle = '#0e0b14';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 240 + Math.sin(t * 0.6 + i) * 80 - camX * BS * 0.4) % 1440 + 1440) % 1440 - 80;
      const y = 300 + (i % 3) * 45 + Math.sin(t * 1.7 + i * 2) * 25;
      const f = Math.sin(t * 14 + i) * 9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 8, y - 4 - f, x - 18, y - f);
      ctx.quadraticCurveTo(x - 10, y + 2, x - 3, y + 5);
      ctx.lineTo(x + 3, y + 5);
      ctx.quadraticCurveTo(x + 10, y + 2, x + 18, y - f);
      ctx.quadraticCurveTo(x + 8, y - 4 - f, x, y);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ------------------------------------------------------------------ near scenery (world anchored)
  // inside = only the decorations that belong inside a cave/hall (drawn over the indoor background)
  R.drawNear = function (ctx, camX, t, inside) {
    const decos = this.lvl.decos;
    for (const d of decos) {
      if (d.x + (d.span || 0) < camX - 14) continue; // span = width in blocks of extra-wide scenery
      if (d.x > camX + 30) break;
      if (!!d.inside !== inside) continue;
      const f = Art.near[d.type];
      if (f) f(ctx, sx(d.x, camX), GY, d, t, BS, FONT);
    }
  };

  // ------------------------------------------------------------------ ground
  R.drawGround = function (ctx, camX, t, inT) {
    const T = Art.TL;
    for (const a of this.lvl.areas) {
      const x0 = Math.max(-5, sx(a.x0, camX)), x1 = Math.min(W + 5, sx(a.x1, camX));
      if (x1 <= x0) continue;
      const st = this.theme.ground[a.id];
      if (st === 'forest' || st === 'peat') {
        // forest floor: dark soil under a carpet of moss and pine needles
        const peat = st === 'peat';
        ctx.fillStyle = T(peat ? '#3b2e22' : '#45311f');
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        for (let i = Math.floor(camX + x0 / BS); i <= Math.ceil(camX + x1 / BS); i++) {
          if (i & 1) continue;
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 > a0) ctx.fillRect(a0, GY + 36, a1 - a0, BS);
        }
        // roots and stones
        ctx.fillStyle = T(peat ? '#54402c' : '#6b5038');
        for (let i = Math.floor(camX / 3 + x0 / 144) - 1; i <= Math.ceil(camX / 3 + x1 / 144); i++) {
          const x = i * 144 - camX * BS + ((i * 53) % 60);
          if (x < x0 - 30 || x > x1) continue;
          Art.rr(ctx, x, GY + 24 + ((i * 17) % 60), 22, 7, 3);
          ctx.fill();
        }
        ctx.fillStyle = T(peat ? '#6f7a34' : '#3f7a2c');
        ctx.fillRect(x0, GY, x1 - x0, 12);
        ctx.fillStyle = T(peat ? '#a0a24a' : '#62a340');
        ctx.fillRect(x0, GY, x1 - x0, 4);
        ctx.fillStyle = T(peat ? '#6f7a34' : '#3f7a2c');
        for (let i = Math.floor(camX * 4 + x0 / 12); i <= Math.ceil(camX * 4 + x1 / 12); i++) {
          const x = i * 12 - camX * BS;
          if (x >= x0 && x + 6 <= x1) {
            ctx.beginPath();
            ctx.ellipse(x + 3, GY + 12, 5, 3 + ((i * 7) & 3), 0, 0, Math.PI);
            ctx.fill();
          }
        }
        // pine needles
        ctx.fillStyle = T('#b07a3e');
        for (let i = Math.floor(camX * 2 + x0 / 24); i <= Math.ceil(camX * 2 + x1 / 24); i++) {
          const x = i * 24 - camX * BS + ((i * 11) % 13);
          if (x >= x0 && x + 6 <= x1) ctx.fillRect(x, GY + 2 + ((i * 5) % 7), 6, 1.5);
        }
      } else if (st === 'cave') {
        ctx.fillStyle = '#2a2530';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = '#3a3444';
        for (let i = Math.floor(camX * 2 + x0 / 24) - 1; i <= Math.ceil(camX * 2 + x1 / 24); i++) {
          const x = i * 24 - camX * BS;
          if (x + 20 < x0 || x > x1) continue;
          const yy = GY + 16 + ((i * 29) % 110);
          ctx.beginPath();
          ctx.ellipse(Math.max(x0, Math.min(x1, x + 10)), yy, 10 + ((i * 7) % 6), 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#5b5563';
        ctx.fillRect(x0, GY, x1 - x0, 6);
        ctx.fillStyle = 'rgba(143,243,255,0.35)';
        ctx.fillRect(x0, GY, x1 - x0, 2);
      } else if (st === 'grass' || st === 'golden') {
        const top = st === 'golden' ? '#9fbf4a' : '#5fb04a', dirt = st === 'golden' ? '#7a5a36' : '#6b4a2f';
        ctx.fillStyle = T(dirt);
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        // world-aligned checker so the ground visibly scrolls
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = Math.floor(camX + x0 / BS); i <= Math.ceil(camX + x1 / BS); i++) {
          if (i & 1) continue;
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 > a0) ctx.fillRect(a0, GY + 36, a1 - a0, BS);
        }
        ctx.fillStyle = T(top);
        ctx.fillRect(x0, GY, x1 - x0, 14);
        ctx.fillStyle = T(st === 'golden' ? '#c9d86a' : '#86d06a');
        ctx.fillRect(x0, GY, x1 - x0, 4);
        ctx.fillStyle = T(top);
        for (let i = Math.floor(camX * 4 + x0 / 12); i <= Math.ceil(camX * 4 + x1 / 12); i++) {
          const x = i * 12 - camX * BS;
          if (x >= x0 && x + 5 <= x1) ctx.fillRect(x, GY + 14, 5, 4 + ((i * 7) & 3));
        }
      } else if (st === 'cobble' || st === 'quay') {
        ctx.fillStyle = T(st === 'cobble' ? '#5f5f68' : '#6d675c');
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = T(st === 'cobble' ? '#8a8a94' : '#978f80');
        const sw = 24, shh = 18;
        for (let r = 0; r < 9; r++) {
          const yy = GY + 6 + r * (shh + 3);
          const shift = (r % 2) * (sw / 2);
          const start = gridStart(x0, camX * BS + shift, sw + 3);
          for (let x = start; x < x1; x += sw + 3) {
            const a0 = Math.max(x0, x), a1 = Math.min(x1, x + sw);
            if (a1 > a0) Art.rr(ctx, a0, yy, a1 - a0, shh, 5), ctx.fill();
          }
        }
        ctx.fillStyle = T('#c9c2b4');
        ctx.fillRect(x0, GY, x1 - x0, 6);
      } else if (st === 'asphalt') {
        ctx.fillStyle = T('#3b3d43');
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = T('#b9b4a8');
        ctx.fillRect(x0, GY, x1 - x0, 8);
        ctx.fillStyle = T('#f2f2f2');
        for (let x = gridStart(x0, camX * BS, 120); x < x1; x += 120) {
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + 60);
          if (a1 > a0) ctx.fillRect(a0, GY + 70, a1 - a0, 6);
        }
        ctx.fillStyle = T('#d9c44a');
        ctx.fillRect(x0, GY + 14, x1 - x0, 3);
      } else if (st === 'hall') {
        ctx.fillStyle = '#2d6fb8';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(x0, GY, x1 - x0, 5);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let x = gridStart(x0, camX * BS, 480); x < x1; x += 480) if (x >= x0) ctx.fillRect(x, GY, 5, Math.min(H - GY, x1 - x));
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x0, GY + 50, x1 - x0, 30);
      }
    }
  };

  R.drawCorridors = function (ctx, camX, t) {
    for (const c of this.lvl.corridors) {
      const x0 = Math.max(-5, sx(c.x0, camX)), x1 = Math.min(W + 5, sx(c.x1, camX));
      if (x1 <= x0) continue;
      const y = sy(c.ceil);
      if (c.style === 'hall') {
        ctx.fillStyle = '#12161f';
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.strokeStyle = '#4b5566';
        ctx.lineWidth = 3;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, y);
        ctx.clip();
        ctx.beginPath();
        for (let x = gridStart(x0, camX * BS, 60); x < x1; x += 60) {
          ctx.moveTo(x, y - 4);
          ctx.lineTo(x + 30, y - 40);
          ctx.lineTo(x + 60, y - 4);
        }
        ctx.moveTo(x0, y - 40);
        ctx.lineTo(x1, y - 40);
        ctx.stroke();
        ctx.restore();
        for (let x = gridStart(x0, camX * BS, 240) + 30; x < x1; x += 240) {
          if (x < x0) continue;
          const gl = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 90);
          gl.addColorStop(0, 'rgba(255,255,235,0.55)');
          gl.addColorStop(1, 'rgba(255,255,235,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(x - 90, y - 10, 180, 100);
          ctx.fillStyle = '#fffbe0';
          ctx.fillRect(x - 16, y - 6, 32, 6);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x0, y - 4, x1 - x0, 4);
        const sbx = ((700 - camX * BS * 0.3) % 1800 + 1800) % 1800 - 250;
        if (sbx > x0 - 120 && sbx < x1 + 120) {
          ctx.fillStyle = '#4b5566';
          ctx.fillRect(sbx - 60, 0, 4, 60);
          ctx.fillRect(sbx + 56, 0, 4, 60);
          ctx.fillStyle = '#0d0f14';
          Art.rr(ctx, sbx - 120, 56, 240, 90, 8);
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#9fe8ff';
          ctx.font = '16px ' + FONT;
          ctx.fillText('HEMMA        BORTA', sbx, 76);
          ctx.fillStyle = '#ff5a3a';
          ctx.font = '44px ' + FONT;
          ctx.fillText('3 – 2', sbx, 116);
        }
      } else if (c.style === 'cave') {
        // rock roof with a jagged edge
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#120f17');
        g.addColorStop(1, '#3a3444');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = '#3a3444';
        ctx.beginPath();
        ctx.moveTo(x0, y - 2);
        for (let x = gridStart(x0, camX * BS, 36); x < x1 + 36; x += 36) {
          const i = Math.round((x + camX * BS) / 36);
          ctx.lineTo(U.clamp(x + 18, x0, x1), y + 4 + ((i * 7) % 9));
          ctx.lineTo(U.clamp(x + 36, x0, x1), y - 2);
        }
        ctx.lineTo(x1, y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(143,243,255,0.5)';
        ctx.fillRect(x0, y - 3, x1 - x0, 2);
      } else if (c.style === 'boughs') {
        // the forest canopy closing in over the bog
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, Art.T('#0f2616'));
        g.addColorStop(1, Art.T('#1f4a2a'));
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = Art.T('#2a5c33');
        ctx.beginPath();
        ctx.moveTo(x0, y - 4);
        for (let x = gridStart(x0, camX * BS, 32); x < x1 + 32; x += 32) {
          const i = Math.round((x + camX * BS) / 32);
          ctx.lineTo(U.clamp(x + 8, x0, x1), y + 2);
          ctx.lineTo(U.clamp(x + 16, x0, x1), y + 8 + ((i * 5) % 7));
          ctx.lineTo(U.clamp(x + 24, x0, x1), y + 2);
          ctx.lineTo(U.clamp(x + 32, x0, x1), y - 2);
        }
        ctx.lineTo(x1, y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(200,255,200,0.5)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      } else {
        // leafy canopy of the riverside trees
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, Art.T('#123018'));
        g.addColorStop(1, Art.T('#2d5a2a'));
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = Art.T('#3f7a34');
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, y + 30);
        ctx.clip();
        ctx.beginPath();
        for (let x = gridStart(x0, camX * BS, 40); x < x1 + 40; x += 40) {
          const cx = Math.round((x + camX * BS) / 40);
          const r = 16 + ((cx * 13) % 9);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI);
        }
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,220,240,0.6)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      }
    }
  };

  // ------------------------------------------------------------------ gameplay objects
  R.drawObjects = function (ctx, camX, t, G) {
    const lvl = this.lvl;
    const vis = lvl.visible(camX - 2, camX + W / BS + 2);
    const glow = (x) => this.theme.glow[lvl.areaAt(x).id];
    // water first (sits in the ground)
    for (const o of vis) if (o.t === 'haz' && o.kind === 'water') Art.water(ctx, sx(o.x, camX), sx(o.x + o.w, camX), sy(0.22), H, t, this.theme.ground[lvl.areaAt(o.x).id] === 'peat' ? 'bog' : null);
    // checkpoints
    for (const cp of lvl.checkpoints) {
      if (cp.index === 0 || cp.x < camX - 2 || cp.x > camX + 30) continue;
      const active = G.state !== 'menu' && G.cpIndex >= cp.index;
      Art.checkpoint(ctx, sx(cp.x, camX), GY, BS, active, t);
    }
    for (const o of vis) {
      const x = sx(o.x, camX), y = sy(o.y + o.h), w = o.w * BS, h = o.h * BS;
      switch (o.t) {
        case 'solid':
          Art.block(ctx, o.style, x, y, w, h, BS, o.id, t);
          break;
        case 'haz':
          if (o.kind === 'spike') Art.spike(ctx, x, y, w, h, false, o.style, glow(o.x), t);
          else if (o.kind === 'spikeDown') Art.spike(ctx, x, y, w, h, true, o.style, glow(o.x), t);
          else if (o.kind === 'half') Art.half(ctx, x, y, w, h, o.style, glow(o.x));
          else if (o.kind === 'bird') Art.bird(ctx, x + w / 2, y + h / 2, BS, t, o.id, glow(o.x));
          else if (o.kind === 'thorny') Art.block(ctx, o.style, x, y, w, h, BS, o.id, t);
          break;
        case 'pad':
          Art.pad(ctx, x, y, w, h, o.color, t);
          break;
        case 'orb':
          Art.orb(ctx, sx(o.cx, camX), sy(o.cy), BS * 0.36, o.color, t, G.s && G.s.lastOrb === o.id);
          break;
        case 'portal': {
          const cy = o.mode === 'cube' ? sy(o.y + 1.5) : sy(1.5);
          Art.portal(ctx, sx(o.x + 0.5, camX), cy, BS * 3, o.mode, t);
          break;
        }
      }
    }
    // finish line glow
    const fx = sx(lvl.finishX, camX);
    if (fx > -40 && fx < W + 40) {
      const g = ctx.createLinearGradient(fx - 30, 0, fx + 30, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,240,180,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx - 30, 0, 60, GY);
    }
  };

  R.drawTexts = function (ctx, camX, G) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const list = this.lvl.texts.slice();
    if (G.attemptText && G.state !== 'menu') list.push({ x: G.attemptText.x + 6, y: 6.2, text: 'Attempt ' + G.attemptText.n, size: 0.9 });
    for (const tx of list) {
      const x = sx(tx.x, camX);
      if (x < -500 || x > W + 500) continue;
      ctx.font = Math.round(tx.size * BS) + 'px ' + FONT;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 6;
      ctx.strokeText(tx.text, x, sy(tx.y));
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tx.text, x, sy(tx.y));
    }
  };

  // ------------------------------------------------------------------ player
  R.drawPlayer = function (ctx, camX, G, t) {
    const s = G.s, v = G.vis;
    const ph = VD.Physics.boxH(s);
    const cx = sx(s.x + 0.5, camX), cy = sy(s.y + ph / 2);
    if (G.state === 'dead') {
      // Vippe sticks his tongue out as he pops
      const k = G.deadAge;
      if (k < 0.45) {
        ctx.save();
        ctx.translate(cx, cy);
        const sc = 1 + k * 2.2;
        ctx.globalAlpha = 1 - k / 0.45;
        ctx.scale(sc, sc);
        Art.cube(ctx, BS, 'tongue', G.skin, 0);
        ctx.restore();
      }
      return;
    }
    ctx.save();
    ctx.translate(cx, cy);
    const expr = G.state === 'won' || G.state === 'winning' ? 'happy' : v.oT > 0 ? 'o' : 'grin';
    if (s.mode === 'cube') {
      ctx.rotate(v.rot);
      Art.cube(ctx, BS, expr, G.skin, 1);
    } else if (s.mode === 'ship') {
      ctx.rotate(v.rot);
      Art.ship(ctx, BS * 1.15, expr, G.skin, v.wheel, t);
    } else {
      Art.ball(ctx, BS, expr, G.skin, v.rot, s.gdir > 0);
    }
    ctx.restore();
  };

  R.drawParticles = function (ctx, camX, G) {
    for (const p of G.particles) {
      const a = U.clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const x = sx(p.x, camX), y = sy(p.y), s = p.size * (p.grow ? 2 - a : 1);
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * a;
        ctx.beginPath();
        ctx.arc(x, y, (1 - a) * p.size + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.round) {
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  };

  R.drawDebug = function (ctx, camX, G) {
    const s = G.s;
    if (!s) return;
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;
    const ph = VD.Physics.boxH(s);
    ctx.strokeRect(sx(s.x, camX), sy(s.y + ph), BS, ph * BS);
    for (const o of this.lvl.visible(camX - 2, camX + 30)) {
      if (o.t === 'haz') {
        ctx.strokeStyle = '#f00';
        ctx.strokeRect(sx(o.hx0, camX), sy(o.hy1), (o.hx1 - o.hx0) * BS, (o.hy1 - o.hy0) * BS);
      } else if (o.t === 'solid') {
        ctx.strokeStyle = '#0ff';
        ctx.strokeRect(sx(o.x, camX), sy(o.y + o.h), o.w * BS, o.h * BS);
      }
    }
    ctx.fillStyle = '#0f0';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('x ' + s.x.toFixed(2) + '  y ' + s.y.toFixed(2) + '  vy ' + s.vy.toFixed(1) + '  ' + s.mode + (G.god ? '  GOD' : '') + (G.bot ? '  BOT' : '') + '  fps ' + Math.round(G.fps || 0), 10, H - 12);
  };

  // ------------------------------------------------------------------ HUD
  R.drawHUD = function (ctx, G, t) {
    const lvl = this.lvl;
    const prog = G.s ? U.clamp(G.s.x / lvl.finishX, 0, 1) : 0;
    const bw = 440, bx = (W - bw) / 2, by = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    Art.rr(ctx, bx - 3, by - 3, bw + 6, 20, 10);
    ctx.fill();
    if (prog > 0.005) {
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#5cff7a');
      g.addColorStop(1, '#ffe14a');
      ctx.fillStyle = g;
      Art.rr(ctx, bx, by, Math.max(14, bw * prog), 14, 7);
      ctx.fill();
    }
    // checkpoint ticks
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const cp of lvl.checkpoints) if (cp.index > 0) ctx.fillRect(bx + (cp.x / lvl.finishX) * bw - 1, by + 2, 2, 10);
    ctx.font = '20px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    const pct = Math.floor(prog * 100) + '%';
    ctx.strokeText(pct, bx + bw + 14, by + 8);
    ctx.fillText(pct, bx + bw + 14, by + 8);
    // pause button
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    Art.rr(ctx, W - 58, 12, 44, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(W - 44, 23, 6, 22);
    ctx.fillRect(W - 32, 23, 6, 22);
    // area banner
    const b = G.banner;
    if (b && b.t < 3.2) {
      const a = b.t < 0.35 ? b.t / 0.35 : b.t > 2.6 ? Math.max(0, (3.2 - b.t) / 0.6) : 1;
      const slide = (1 - U.smooth(Math.min(1, b.t / 0.35))) * -40;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = '64px ' + FONT;
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(b.name, W / 2, 110 + slide);
      ctx.fillStyle = '#ffe14a';
      ctx.fillText(b.name, W / 2, 110 + slide);
      ctx.font = '26px ' + FONT;
      ctx.lineWidth = 6;
      ctx.strokeText(b.sub, W / 2, 160 + slide);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(b.sub, W / 2, 160 + slide);
      ctx.globalAlpha = 1;
    }
  };
})();
