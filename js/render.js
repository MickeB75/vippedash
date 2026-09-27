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
    const hwHorror = (Art.horror && Art.horror.midHalf) || {};
    for (const L of lvl.landmarks) mid.push({ u: (L.X - PX) * pM + HALF, d: L, t: L.type, hw: MID_HALFWIDTH[L.type] || hwHorror[L.type] || 6 });
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
    this.fields = lvl.areas.map((ar) => ({ u0: (ar.x0 - PX) * pM + HALF, u1: (ar.x1 - PX) * pM + HALF, style: pick(th.field, ar.id) }));
    // Each layer (floor) is drawn as its own scene. A layer's first area reaches back and its last area
    // reaches forward forever, so the sewer is drawn under the whole screen even before the hole.
    const nL = lvl.drops.length + 1;
    this.layers = [];
    for (let L = 0; L < nL; L++) {
      const areas = lvl.areas.filter((a) => a.layer === L).map((a) => ({ id: a.id, x0: a.x0, x1: a.x1 }));
      if (nL > 1) {
        if (L > 0) areas[0].x0 = -Infinity;
        if (L < nL - 1) areas[areas.length - 1].x1 = Infinity;
      }
      // indoor stretches (floorball hall, bear cave, subway, sewer); neighbouring areas of the same kind merge
      const indoors = [];
      for (const a of areas) {
        const kind = th.indoor && th.indoor[a.id];
        if (!kind) continue;
        const last = indoors[indoors.length - 1];
        if (last && last.kind === kind && last.x1 === a.x0) last.x1 = a.x1;
        else indoors.push({ x0: a.x0, x1: a.x1, kind });
      }
      this.layers.push({ areas, indoors });
    }
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
  // safe zone lookup: 0 if lvl.zone isn't there yet (level.js still being written)
  const zoneOf = (lvl, name, x, fade) => (lvl && typeof lvl.zone === 'function' ? lvl.zone(name, x, fade) : 0);
  // a quarter-circle cobweb anchored at a screen corner (side>0: top-left, side<0: top-right)
  function drawCobweb(ctx, cx, cy, side) {
    const a0 = side > 0 ? 0 : Math.PI / 2, a1 = side > 0 ? Math.PI / 2 : Math.PI;
    ctx.beginPath();
    for (let r = 16; r <= 72; r += 14) ctx.arc(cx, cy, r, a0, a1);
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (a1 - a0);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 76, cy + Math.sin(a) * 76);
    }
    ctx.stroke();
  }
  function heartPath(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.3);
    ctx.bezierCurveTo(cx - s, cy - s * 0.6, cx - s * 0.5, cy - s * 1.3, cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s * 1.3, cx + s, cy - s * 0.6, cx, cy + s * 0.3);
    ctx.closePath();
  }
  function makeBloodBlobs() {
    const r = U.rng(555);
    const edges = [
      () => [r() * W, -10 + r() * 6],
      () => [r() * W, H + 10 - r() * 6],
      () => [-10 + r() * 6, r() * H],
      () => [W + 10 - r() * 6, r() * H],
    ];
    const blobs = [];
    for (let i = 0; i < 16; i++) {
      const [x, y] = edges[i % 4]();
      blobs.push({ x, y, rx: 14 + r() * 22, ry: 10 + r() * 16, rot: r() * Math.PI });
    }
    return blobs;
  }
  function scareEnvelope(t) {
    const scale = t < 0.08 ? 1.3 - 0.3 * U.smooth(U.clamp(t / 0.08, 0, 1)) : 1;
    const alpha = t < 0.33 ? 1 : U.clamp(1 - (t - 0.33) / 0.27, 0, 1);
    return { scale, alpha };
  }

  // ------------------------------------------------------------------ main draw
  R.draw = function (G, dt) {
    const ctx = this.ctx;
    const t = G.clock;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    let camX = G.camX;
    const lvl = this.lvl;
    const menu = G.state === 'menu';
    const px = G.s ? G.s.x : camX + PX; // the player's x, or the camera's in the menu's attract mode
    this._eyeSpots = this._eyeSpots || [];
    this._eyeSpots.length = 0;
    this._lB = menu ? 0 : this.lightningPulse(px) * zoneOf(lvl, 'lightning', px, 6);

    // mirror: the whole world flips horizontally, animated as a "turn" through the middle (never the HUD)
    const mirW = zoneOf(lvl, 'mirror', px, 2.6);
    const scaleX = mirW > 0 ? Math.cos(Math.PI * mirW) : 1;
    const mirrored = scaleX < 0;

    // tilt: a subtle rotation on the heavy downbeats, only in theme.tilt areas
    let tiltA = 0;
    if (this.theme.tilt) {
      const tw = areaWeight(lvl, this.theme.tilt, camX + HALF, 8);
      if (tw > 0.001) tiltA = this.tiltAngle(px) * tw;
    }

    const shake = G.shake > 0 ? G.shake : 0;
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    if (scaleX !== 1 || tiltA) {
      ctx.translate(W / 2, H / 2);
      if (scaleX !== 1) ctx.scale(scaleX, 1);
      if (tiltA) ctx.rotate(tiltA);
      ctx.translate(-W / 2, -H / 2);
    }
    const drops = lvl.drops;
    if (!drops.length) this.drawScene(ctx, camX, t, G, 0);
    else {
      // Level 2 has one floor on top of another (you fall through a hole into the sewer). Each floor is a
      // whole scene, stacked shift blocks apart, and the camera looks G.camV blocks down from the top one.
      const camV = G.camV || 0;
      let top = 0;
      for (let L = 0; L <= drops.length; L++) {
        const off = (top - camV) * BS;
        if (off > -H && off < H) {
          ctx.save();
          ctx.translate(0, off);
          this.drawScene(ctx, camX, t, G, L);
          ctx.restore();
        }
        if (L < drops.length) top += drops[L].shift;
      }
    }
    ctx.restore();

    // darkness / lantern, with the glowing eyes above the mask
    this.drawDarkness(ctx, G, px, t, mirrored);

    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.6, G.flash) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    // strobe + ambient lightning, on top of the flash
    this.drawStrobe(ctx, G, px, menu);
    this.drawLightning(ctx);

    if (!menu) this.drawHUD(ctx, G, t, camX, mirrored);
    if (G.scare) this.drawScare(ctx, G, t);
  };

  // ------------------------------------------------------------------ nightmare screen effects
  // darkness/lantern mask: near-black except a soft circular hole around the player, flickering slightly
  R.drawDarkness = function (ctx, G, px, t, mirrored) {
    const lvl = this.lvl;
    const k = zoneOf(lvl, 'dark', px, 4);
    if (k <= 0.001) {
      this._eyeSpots.length = 0;
      return;
    }
    let r = 7;
    const dz = lvl.fx && lvl.fx.dark;
    if (dz) for (const z of dz) if (px >= z.x0 - 4 && px <= z.x1 + 4) { r = z.r || 7; break; }
    const s = G.s;
    const ph = s ? VD.Physics.boxH(s) : 1;
    let holeX = PX * BS;
    const holeY = s ? sy(s.y + ph / 2) : sy(0.5);
    if (mirrored) holeX = W - holeX;
    const flick = 1 + Math.sin(t * 17.3) * 0.05 + Math.sin(t * 7.1 + 1) * 0.03;
    const rad = Math.max(12, r * BS * flick);

    if (!this._darkCv) {
      this._darkCv = document.createElement('canvas');
      this._darkCv.width = W;
      this._darkCv.height = H;
    }
    const dctx = this._darkCv.getContext('2d');
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, W, H);
    dctx.fillStyle = 'rgba(4,2,6,' + (0.96 * k).toFixed(3) + ')';
    dctx.fillRect(0, 0, W, H);
    dctx.globalCompositeOperation = 'destination-out';
    const g = dctx.createRadialGradient(holeX, holeY, 0, holeX, holeY, rad);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(holeX, holeY, rad, 0, Math.PI * 2);
    dctx.fill();
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._darkCv, 0, 0);

    const AH = Art.horror;
    if (AH && AH.eyes) for (const e of this._eyeSpots) AH.eyes(ctx, e.x, e.y, e.size, t, e.seed, e.color);
    this._eyeSpots.length = 0;
  };

  // one flash per beat, full brightness 0.05s then a 0.15s fade; a steady dim light when strobeOn is off
  R.drawStrobe = function (ctx, G, px, menu) {
    const w = zoneOf(this.lvl, 'strobe', px, 4);
    if (w <= 0.001) return;
    if (menu || G.strobeOn === false) {
      ctx.fillStyle = 'rgba(4,2,6,' + (0.55 * w).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const cyc = ((px % 4) + 4) % 4;
    const phase = cyc / P.SPEED;
    let bright = 0;
    if (phase < 0.05) bright = 1;
    else if (phase < 0.2) bright = 1 - (phase - 0.05) / 0.15;
    const dark = 0.97 * (1 - bright) * w;
    ctx.fillStyle = 'rgba(4,2,6,' + dark.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    if (bright > 0.001) {
      ctx.fillStyle = 'rgba(232,240,255,' + Math.min(0.18, bright * 0.18 * w).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  };
  // double flicker (~0.3s) where x mod 32 crosses 16, i.e. on the downbeat of every odd bar
  R.lightningPulse = function (px) {
    const cyc = ((px % 32) + 32) % 32;
    const dphase = (cyc - 16) / P.SPEED;
    if (dphase < 0 || dphase > 0.3) return 0;
    const p1 = Math.exp(-Math.pow((dphase - 0.03) / 0.05, 2));
    const p2 = 0.85 * Math.exp(-Math.pow((dphase - 0.17) / 0.06, 2));
    return Math.min(1, p1 + p2);
  };
  R.drawLightning = function (ctx) {
    const a = Math.min(0.25, this._lB * 0.25);
    if (a <= 0.002) return;
    ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  };
  // a subtle rotation on the half-time downbeat (every 8 blocks), alternating sign, decaying over ~0.3s
  R.tiltAngle = function (px) {
    const cyc = ((px % 8) + 8) % 8;
    const dphase = cyc / P.SPEED;
    if (dphase > 0.3) return 0;
    const sign = Math.floor(px / 8) % 2 === 0 ? 1 : -1;
    const decay = Math.exp(-dphase * 9);
    return sign * (0.8 * Math.PI / 180) * decay;
  };

  // one floor of the level: background, scenery, ground, obstacles, and the player if they're on it
  R.drawScene = function (ctx, camX, t, G, L) {
    const center = camX + HALF;
    const sky = skyAt(this.sky, center);
    Art.setDark(sky.dark);
    const px = G.s ? G.s.x : center - HALF + PX;
    // indoor areas (floorball hall, bear cave, subway, sewer) fade in as you run through the door
    let inT = 0, inKind = null;
    for (const r of this.layers[L].indoors) {
      const k = U.smooth(U.clamp((px - r.x0) / 6, 0, 1)) * (1 - U.smooth(U.clamp((px - (r.x1 - 8)) / 6, 0, 1)));
      if (k > inT) (inT = k), (inKind = r.kind);
    }

    if (inT < 1) {
      this.drawOutdoor(ctx, camX, sky, t, center);
      this.drawNear(ctx, camX, t, false, L);
      if (this.theme.canopy) this.drawCanopy(ctx, camX, t, areaWeight(this.lvl, this.theme.canopy, center));
    }
    if (inT > 0) {
      ctx.globalAlpha = inT;
      if (inKind === 'cave') {
        this.drawCave(ctx, camX, t);
        this.drawNear(ctx, camX, t, true, L);
        // a dark veil pushes the bear and the crystals behind the (brightly outlined) hazards
        ctx.fillStyle = 'rgba(16,12,24,0.45)';
        ctx.fillRect(0, 0, W, GY);
      } else if (inKind === 'metro') {
        this.drawMetro(ctx, camX, t, center);
        this.drawNear(ctx, camX, t, true, L);
      } else if (inKind === 'sewer') {
        this.drawSewer(ctx, camX, t, center);
        this.drawNear(ctx, camX, t, true, L);
      } else if (inKind === 'convent') {
        this.drawConvent(ctx, camX, t);
        this.drawNear(ctx, camX, t, true, L);
      } else if (inKind === 'chapel') {
        this.drawChapel(ctx, camX, t);
        this.drawNear(ctx, camX, t, true, L);
      } else if (inKind === 'catacomb') {
        this.drawCatacomb(ctx, camX, t);
        this.drawNear(ctx, camX, t, true, L);
      } else if (inKind === 'mirrors') {
        this.drawMirrors(ctx, camX, t, G);
        this.drawNear(ctx, camX, t, true, L);
      } else if (inKind === 'ghosttrain') {
        this.drawGhosttrain(ctx, camX, t);
        this.drawNear(ctx, camX, t, true, L);
      } else {
        this.drawHall(ctx, camX, t);
        this.drawNear(ctx, camX, t, true, L);
      }
      ctx.globalAlpha = 1;
    }
    this.drawGround(ctx, camX, t, inT, L);
    this.drawCorridors(ctx, camX, t, L);
    if (this.lvl.drops.length) this.drawHoles(ctx, camX, t, L);
    this.drawObjects(ctx, camX, t, G, L);
    this.drawTexts(ctx, camX, G, L);
    const here = G.s && (G.s.layer || 0) === L;
    if (here && G.state !== 'menu') this.drawPlayer(ctx, camX, G, t);
    this.drawParticles(ctx, camX, G, L);
    if (G.debug && here) this.drawDebug(ctx, camX, G);
  };
  // the area at x on layer L
  R.areaIn = function (L, x) {
    const a = this.layers[L].areas;
    for (let i = a.length - 1; i >= 0; i--) if (x >= a[i].x0) return a[i];
    return a[0];
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
      const blood = !!th.moon;
      const moonCol = th.moon || '#fff6da';
      const moonR = blood ? 46 : 32, haloR = blood ? 170 : 110;
      const haloCol = blood ? '#8a0018' : '#fff6da';
      const mg = ctx.createRadialGradient(260, 120, 20, 260, 120, haloR);
      mg.addColorStop(0, U.rgba(haloCol, blood ? 0.22 : 0.35));
      mg.addColorStop(1, U.rgba(haloCol, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(260 - haloR, 120 - haloR, haloR * 2, haloR * 2);
      ctx.fillStyle = moonCol;
      ctx.beginPath();
      ctx.arc(260, 120, moonR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = blood ? 'rgba(60,0,10,0.35)' : 'rgba(190,180,150,0.35)';
      for (const [mx, my, mr] of blood ? [[246, 106, 10], [278, 130, 7], [258, 138, 6], [272, 100, 4]] : [[250, 110, 7], [272, 126, 5], [256, 134, 4], [268, 106, 3]]) {
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
    const base = { meadow: '#7dbb4e', golden: '#b6b25a', park: '#7a9a5a', farm: '#8ba55a', lawn: '#6f9f52', forest: '#3f6b34', bog: '#7b8a55', glade: '#86c05a', plaza: '#a19d93', graves: '#332b22', fairground: '#5f3f2e' }[style] || '#7dbb4e';
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
    } else if (style === 'graves') {
      // a dead field of leaning crosses and low mounds, fading into the fog
      ctx.fillStyle = T('#1c1712');
      for (let x = gridStart(x0, offM * BS, 70); x < x1; x += 70) {
        const i = Math.round((x + offM * BS) / 70);
        const gx = x + 20 + ((i * 13) % 24), gh = 10 + ((i * 7) % 10);
        if (i % 2) {
          ctx.fillRect(gx, mb - gh, 3, gh);
          ctx.fillRect(gx - 5, mb - gh + 4, 13, 3);
        } else {
          ctx.beginPath();
          ctx.ellipse(gx, mb - gh * 0.6, 6, gh * 0.6, 0, Math.PI, 0);
          ctx.fill();
        }
      }
      ctx.fillStyle = T('#4a4030');
      for (let x = gridStart(x0, offM * BS, 30); x < x1; x += 30) {
        const i = Math.round((x + offM * BS) / 30);
        ctx.fillRect(x, mb - 3 - ((i * 5) & 3), 2, 5);
      }
    } else if (style === 'fairground') {
      // dusty circus lot: striped tent tops and poles poking up from the trampled grass
      ctx.fillStyle = T('#3a2c1e');
      for (let x = gridStart(x0, offM * BS, 30); x < x1; x += 30) {
        const i = Math.round((x + offM * BS) / 30);
        if (i % 4 === 0) ctx.fillRect(x, mb - 4 - ((i * 3) & 3), 2, 6);
      }
      const cols = ['#c0081a', '#efe9dc'];
      for (let x = gridStart(x0, offM * BS, 140); x < x1; x += 140) {
        const i = Math.round((x + offM * BS) / 140);
        const tw = 30, th2 = 22;
        ctx.fillStyle = T(cols[i & 1]);
        ctx.beginPath();
        ctx.moveTo(x, mb);
        ctx.lineTo(x + tw / 2, mb - th2);
        ctx.lineTo(x + tw, mb);
        ctx.closePath();
        ctx.fill();
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

  // ------------------------------------------------------------------ the subway (level 2)
  R.drawMetro = function (ctx, camX, t, center) {
    this.drawTunnelWall(ctx, camX, t);
    // T-Centralen's painted cave fades into the plain tunnel as you run out along the tracks
    const st = areaWeight(this.lvl, ['station'], center, 24);
    if (st > 0) {
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * st;
      this.drawStation(ctx, camX, t);
      ctx.globalAlpha = a0;
    }
  };

  R.drawTunnelWall = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#0e1013');
    g.addColorStop(0.55, '#22262d');
    g.addColorStop(1, '#2d323a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    // concrete segments of the far wall
    const off = camX * BS * 0.45;
    for (let x = -(((off % 150) + 150) % 150); x < W; x += 150) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, 40, 6, GY - 40);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(x + 6, 40, 3, GY - 40);
    }
    this.drawPassingTrain(ctx, camX, t);
    // cable trays and lamps along the near wall
    const offN = camX * BS * 0.8;
    ctx.strokeStyle = '#08090b';
    ctx.lineWidth = 3;
    for (const cy of [112, 134, 150]) {
      ctx.beginPath();
      for (let x = -(((offN % 150) + 150) % 150) - 150; x < W + 150; x += 150) {
        ctx.moveTo(x, cy);
        ctx.quadraticCurveTo(x + 75, cy + 10, x + 150, cy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#3a3f47';
    for (let x = -(((offN % 150) + 150) % 150); x < W + 10; x += 150) ctx.fillRect(x - 3, 104, 6, 52);
    for (let x = -(((offN % 450) + 450) % 450) + 200; x < W + 100; x += 450) {
      const gl = ctx.createRadialGradient(x, 80, 3, x, 80, 110);
      gl.addColorStop(0, 'rgba(255,214,150,0.4)');
      gl.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 110, -30, 220, 220);
      ctx.fillStyle = '#1b1d22';
      Art.rr(ctx, x - 16, 70, 32, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#ffe3aa';
      Art.rr(ctx, x - 11, 74, 22, 10, 4);
      ctx.fill();
    }
    // the dark foot of the wall
    const fg = ctx.createLinearGradient(0, GY - 90, 0, GY);
    fg.addColorStop(0, 'rgba(8,9,11,0)');
    fg.addColorStop(1, 'rgba(8,9,11,0.7)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, GY - 90, W, 94);
  };

  // every now and then a train on the next track rushes past the other way
  R.drawPassingTrain = function (ctx, camX, t) {
    const u = (t / 9) % 1;
    if (u > 0.34) return;
    const len = 2600, top = GY - 230, bot = GY - 70;
    const x = W + 160 - (u / 0.34) * (W + len + 600);
    // headlight beams ahead of it
    const gl = ctx.createLinearGradient(x - 360, 0, x, 0);
    gl.addColorStop(0, 'rgba(255,250,220,0)');
    gl.addColorStop(1, 'rgba(255,250,220,0.35)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.moveTo(x, bot - 30);
    ctx.lineTo(x - 360, bot - 80);
    ctx.lineTo(x - 360, bot + 30);
    ctx.lineTo(x, bot - 10);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha *= 0.8;
    ctx.fillStyle = '#8f98a4';
    Art.rr(ctx, x, top, len, bot - top, 26);
    ctx.fill();
    ctx.fillStyle = '#1f5fb4';
    ctx.fillRect(x + 10, bot - 42, len - 20, 12);
    // a blur of lit windows
    ctx.fillStyle = '#ffeebd';
    for (let wx = x + 60; wx < x + len - 40; wx += 64) ctx.fillRect(wx, top + 34, 44, 48);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let k = 0; k < 5; k++) ctx.fillRect(x + 30, top + 20 + k * 26, len - 60, 2);
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.arc(x + 14, bot - 22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // T-Centralen (blue line): a cave blasted out of the bedrock, painted white with climbing blue vines
  R.drawStation = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#9cbde2');
    g.addColorStop(0.35, '#dbe7f5');
    g.addColorStop(1, '#eef3f9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.55;
    // bumpy bedrock
    for (let i = Math.floor(off / 170) - 1; i <= Math.floor((off + W) / 170) + 1; i++) {
      const x = i * 170 - off;
      ctx.fillStyle = 'rgba(50,90,150,0.09)';
      ctx.beginPath();
      ctx.ellipse(x + U.hash(i) * 80, 160 + U.hash(i * 3.1) * 300, 90 + U.hash(i * 1.7) * 60, 50 + U.hash(i * 2.3) * 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // blue vines with leaves climbing the rock
    const tile = 520, leaves = [];
    ctx.strokeStyle = '#2d63b8';
    ctx.fillStyle = '#2d63b8';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let k = Math.floor(off / tile) - 1; k <= Math.floor((off + W) / tile) + 1; k++) {
      const bx = k * tile - off;
      const r = U.rng(k * 7 + 3);
      for (let v = 0; v < 3; v++) {
        let x = bx + r() * tile, y = GY - 30 - r() * 50;
        ctx.moveTo(x, y);
        for (let sgm = 0; sgm < 6; sgm++) {
          const nx = x + (r() - 0.35) * 90, ny = y - 48 - r() * 36;
          ctx.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * 70, (y + ny) / 2, nx, ny);
          leaves.push(nx, ny, r());
          x = nx;
          y = ny;
        }
      }
    }
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < leaves.length; i += 3) {
      for (const side of [-1, 1]) {
        const a = side * (0.6 + leaves[i + 2] * 0.5), cx = leaves[i] + Math.cos(a) * side * 15, cy = leaves[i + 1] + Math.sin(a) * side * 15;
        ctx.moveTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15);
        ctx.ellipse(cx, cy, 15, 6, a, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    // the rough, painted cave roof
    const offR = camX * BS * 0.7;
    ctx.fillStyle = '#6d95c8';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    for (let x = -(((offR % 80) + 80) % 80) - 80; x < W + 160; x += 80) {
      const i = Math.round((x + offR) / 80);
      ctx.quadraticCurveTo(x + 40, 70 + U.hash(i) * 40, x + 80, 40 + U.hash(i + 0.5) * 30);
    }
    ctx.lineTo(W + 10, 0);
    ctx.closePath();
    ctx.fill();
    // strip lights hanging under the roof
    const offL = camX * BS * 0.8;
    for (let x = -(((offL % 330) + 330) % 330) + 60; x < W + 200; x += 330) {
      ctx.strokeStyle = '#54627a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 20, 60);
      ctx.lineTo(x + 20, 118);
      ctx.moveTo(x + 150, 60);
      ctx.lineTo(x + 150, 118);
      ctx.stroke();
      const gl = ctx.createLinearGradient(0, 118, 0, 260);
      gl.addColorStop(0, 'rgba(255,255,245,0.45)');
      gl.addColorStop(1, 'rgba(255,255,245,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.moveTo(x, 124);
      ctx.lineTo(x + 170, 124);
      ctx.lineTo(x + 230, 260);
      ctx.lineTo(x - 60, 260);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      Art.rr(ctx, x, 116, 170, 9, 4);
      ctx.fill();
    }
    // the back wall of the platform, with a band of tiles
    ctx.fillStyle = '#c5d2e0';
    ctx.fillRect(0, GY - 64, W, 64);
    ctx.fillStyle = '#2d63b8';
    ctx.fillRect(0, GY - 64, W, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    const offT = camX * BS;
    for (let x = -(((offT % 24) + 24) % 24); x < W; x += 24) ctx.fillRect(x, GY - 58, 2, 58);
  };

  // ------------------------------------------------------------------ the sewer (level 2)
  function archPath(ctx, x, base, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - h + w / 2);
    ctx.arc(x + w / 2, base - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, base);
    ctx.closePath();
  }
  R.drawSewer = function (ctx, camX, t, center) {
    const pk = areaWeight(this.lvl, ['pipe'], center, 24);
    if (pk < 1) this.drawSewerWall(ctx, camX, t);
    // inside the big pipe (the ball section) the wall becomes ringed concrete
    if (pk > 0) {
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * pk;
      this.drawPipeWall(ctx, camX, t);
      ctx.globalAlpha = a0;
    }
  };
  R.drawSewerWall = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#10140e');
    g.addColorStop(1, '#283022');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    // brick courses of the far wall
    const offF = camX * BS * 0.4;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0, yy = 70; yy < GY; yy += 18, r++) {
      ctx.moveTo(0, yy);
      ctx.lineTo(W, yy);
      for (let x = -((((offF + r * 21) % 42) + 42) % 42); x < W; x += 42) {
        ctx.moveTo(x, yy);
        ctx.lineTo(x, yy + 18);
      }
    }
    ctx.stroke();
    // side tunnels: dark arches in the far wall, with eyes glowing in the dark
    const stepA = 460;
    for (let x = -(((offF % stepA) + stepA) % stepA) - stepA; x < W + stepA; x += stepA) {
      const i = Math.round((x + offF) / stepA);
      const ax = x + 130, aw = 180, ah = 250, base = GY - 16;
      ctx.fillStyle = '#39402f';
      archPath(ctx, ax - 16, base, aw + 32, ah + 16);
      ctx.fill();
      const ig = ctx.createLinearGradient(0, base - ah, 0, base);
      ig.addColorStop(0, '#050605');
      ig.addColorStop(1, '#0d110b');
      ctx.fillStyle = ig;
      archPath(ctx, ax, base, aw, ah);
      ctx.fill();
      const blink = (t * 0.6 + i * 0.37) % 1 < 0.05;
      if (!blink && i % 3 === 0) {
        // a crocodile watching from the dark: yellow eyes with slit pupils
        const ex = ax + aw * 0.45, ey = base - 110 + Math.sin(t * 0.8 + i) * 2;
        for (const dx of [-13, 13]) {
          ctx.fillStyle = '#e8d23a';
          ctx.beginPath();
          ctx.ellipse(ex + dx, ey, 7, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.fillRect(ex + dx - 1, ey - 4, 2, 8);
        }
      } else if (!blink && i % 3 === 1) {
        // rats
        ctx.fillStyle = '#ff4a3a';
        for (const [dx, dy] of [[-40, -10], [-34, -10], [30, -6], [36, -6]]) ctx.fillRect(ax + aw / 2 + dx, base + dy, 3, 3);
      }
    }
    // rusty pipes along the near wall, with slime running down from the joints
    const offP = camX * BS * 0.85;
    for (const [py, pr] of [[212, 12], [244, 8]]) {
      const pg = ctx.createLinearGradient(0, py - pr, 0, py + pr);
      pg.addColorStop(0, '#8a7458');
      pg.addColorStop(0.4, '#6b5840');
      pg.addColorStop(1, '#2e261c');
      ctx.fillStyle = pg;
      ctx.fillRect(0, py - pr, W, pr * 2);
    }
    for (let x = -(((offP % 260) + 260) % 260); x < W + 20; x += 260) {
      const i = Math.round((x + offP) / 260);
      ctx.fillStyle = '#4a3c2c';
      ctx.fillRect(x - 6, 196, 12, 32);
      ctx.fillRect(x + 90, 234, 10, 20);
      const sg = ctx.createLinearGradient(0, 228, 0, 228 + 140 + (i % 3) * 50);
      sg.addColorStop(0, 'rgba(126,165,44,0.5)');
      sg.addColorStop(1, 'rgba(126,165,44,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - 5, 228, 10, 140 + (i % 3) * 50);
      // a drip from the joint
      const u = (t * 0.7 + i * 0.41) % 1;
      ctx.fillStyle = 'rgba(160,200,90,0.8)';
      ctx.fillRect(x - 2, 230 + u * (GY - 240), 4, 7);
    }
    // the vaulted brick roof
    const offV = camX * BS * 0.9;
    ctx.fillStyle = '#171b13';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    for (let x = -(((offV % 240) + 240) % 240) - 240; x < W + 240; x += 240) {
      ctx.lineTo(x, 70);
      ctx.quadraticCurveTo(x + 120, 18, x + 240, 70);
    }
    ctx.lineTo(W + 10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4f6a2a';
    for (let x = -(((offV % 240) + 240) % 240) - 240; x < W + 240; x += 240) {
      for (let k = 0; k < 4; k++) {
        const dx = 20 + k * 58, len = 10 + ((k * 7 + Math.round((x + offV) / 240)) % 4) * 6;
        const yy = 70 - Math.sin((dx / 240) * Math.PI) * 42;
        ctx.fillRect(x + dx, yy - 2, 4, len);
      }
    }
    // green haze over the water
    for (let i = 0; i < 2; i++) {
      const y = GY - 50 - i * 70;
      const mg = ctx.createLinearGradient(0, y - 40, 0, y + 40);
      mg.addColorStop(0, 'rgba(150,190,90,0)');
      mg.addColorStop(0.5, 'rgba(150,190,90,' + (0.12 - i * 0.04) + ')');
      mg.addColorStop(1, 'rgba(150,190,90,0)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, y - 40, W, 80);
    }
  };
  // the inside of the big sewer pipe: ringed concrete, rust, slime and little side pipes dribbling into it
  R.drawPipeWall = function (ctx, camX, t) {
    const pg = ctx.createLinearGradient(0, 0, 0, GY);
    pg.addColorStop(0, '#121412');
    pg.addColorStop(0.45, '#34383a');
    pg.addColorStop(1, '#1f2322');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, W, GY + 4);
    const offR = camX * BS * 0.6;
    for (let x = -(((offR % 200) + 200) % 200); x < W + 200; x += 200) {
      const i = Math.round((x + offR) / 200);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, GY / 2, 16, GY / 2 + 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 12, 0, 4, GY);
      ctx.fillStyle = 'rgba(150,80,30,0.22)';
      ctx.fillRect(x + 40, GY * 0.3, 10, GY * 0.4);
      ctx.fillStyle = 'rgba(126,165,44,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 110, GY * (0.35 + 0.3 * U.hash(i)), 40, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i % 3 === 0) {
        // a side pipe dribbling slime
        const py = GY * 0.42;
        ctx.fillStyle = '#0a0b0a';
        ctx.beginPath();
        ctx.ellipse(x + 100, py, 20, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a4036';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = 'rgba(126,165,44,0.7)';
        ctx.fillRect(x + 96, py + 16, 8, GY - py - 16);
      }
    }
  };

  // ------------------------------------------------------------------ inside the convent (level 4)
  R.drawConvent = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#140810');
    g.addColorStop(1, '#2c1522');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const moonCol = this.theme.moon || '#b3121e';
    const off = camX * BS * 0.55, step = 220;
    const start = gridStart(0, off, step) - step;
    for (let x = start; x < W + step; x += step) {
      const wx = x + step * 0.5, ww = 66, wtop = 46, wh = 230;
      // the moon glowing through the tall pointed window
      const mg = ctx.createRadialGradient(wx, wtop + wh * 0.4, 4, wx, wtop + wh * 0.4, ww * 1.1);
      mg.addColorStop(0, U.rgba(moonCol, 0.45));
      mg.addColorStop(1, U.rgba(moonCol, 0));
      ctx.fillStyle = mg;
      ctx.fillRect(wx - ww * 1.1, wtop - ww * 0.3, ww * 2.2, wh + ww);
      ctx.fillStyle = '#100710';
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wtop + wh);
      ctx.lineTo(wx - ww / 2, wtop + ww / 2);
      ctx.arc(wx, wtop + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wtop + wh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = moonCol;
      ctx.beginPath();
      ctx.ellipse(wx, wtop + wh * 0.4, ww * 0.28, ww * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(wx, wtop);
      ctx.lineTo(wx, wtop + wh);
      ctx.moveTo(wx - ww / 2, wtop + wh * 0.66);
      ctx.lineTo(wx + ww / 2, wtop + wh * 0.66);
      ctx.stroke();
      // the pillar beside it
      ctx.fillStyle = '#241019';
      ctx.fillRect(x + step - 30, 10, 28, GY - 10);
      ctx.fillStyle = '#33151f';
      ctx.fillRect(x + step - 26, 10, 6, GY - 10);
      ctx.fillStyle = '#1a0a12';
      ctx.fillRect(x + step - 36, 10, 48, 14);
    }
    // vaulted arches along the top
    ctx.fillStyle = '#140812';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-10, 60);
    for (let x = start; x < W + step; x += step) ctx.quadraticCurveTo(x + step * 0.5, 8, x + step, 60);
    ctx.lineTo(W + 10, 0);
    ctx.closePath();
    ctx.fill();
    // cobwebs in the top corners
    ctx.strokeStyle = 'rgba(215,208,220,0.22)';
    ctx.lineWidth = 1.2;
    drawCobweb(ctx, 4, 4, 1);
    drawCobweb(ctx, W - 4, 4, -1);
  };

  // ------------------------------------------------------------------ inside the chapel (level 4)
  R.drawChapel = function (ctx, camX, t) {
    const lb = this._lB || 0; // ambient lightning brightens the glass
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, U.mixHex('#0c0810', '#3a3450', lb * 0.5));
    g.addColorStop(1, '#231228');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.5, step = 170;
    const start = gridStart(0, off, step) - step;
    const glass = ['#7a1030', '#1a3f7a', '#7a6a10', '#2a6a3a'];
    for (let x = start; x < W + step; x += step) {
      const i = Math.round((x + off) / step);
      const wx = x + step * 0.5, ww = 60, wtop = 60, wh = 180;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wtop + wh);
      ctx.lineTo(wx - ww / 2, wtop + ww / 2);
      ctx.arc(wx, wtop + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wtop + wh);
      ctx.closePath();
      ctx.clip();
      const cols = [glass[i % 4], glass[(i + 1) % 4], glass[(i + 2) % 4]];
      for (let p = 0; p < 3; p++) {
        ctx.fillStyle = U.mixHex(cols[p], '#ffffff', lb * 0.6);
        ctx.fillRect(wx - ww / 2 + p * (ww / 3), wtop - 10, ww / 3, wh + 20);
      }
      ctx.globalAlpha = 0.35 + lb * 0.4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(wx - ww / 2, wtop + wh * 0.3, ww, 5);
      ctx.fillRect(wx - ww / 2, wtop + wh * 0.62, ww, 5);
      ctx.globalAlpha = 1;
      ctx.restore();
      ctx.strokeStyle = '#100714';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wtop + wh);
      ctx.lineTo(wx - ww / 2, wtop + ww / 2);
      ctx.arc(wx, wtop + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wtop + wh);
      ctx.stroke();
    }
    // organ pipes at the head of the nave
    ctx.fillStyle = '#1a1018';
    const pipeX = 60;
    for (let k = 0; k < 7; k++) {
      const ph = 90 + Math.abs(3 - k) * -14 + 70;
      ctx.fillRect(pipeX + k * 16, GY - ph, 12, ph);
    }
    // pews receding down the nave
    const offP = camX * BS * 0.75;
    ctx.fillStyle = '#150a16';
    for (let x = gridStart(0, offP, 96) - 96; x < W + 96; x += 96) {
      ctx.fillRect(x, GY - 46, 70, 14);
      ctx.fillRect(x + 4, GY - 70, 8, 24);
      ctx.fillRect(x + 58, GY - 70, 8, 24);
    }
  };

  // ------------------------------------------------------------------ inside the catacombs (level 4)
  R.drawCatacomb = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#0a0705');
    g.addColorStop(1, '#1c150f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.42, step = 130;
    const start = gridStart(0, off, step) - step;
    const eyes = this._eyeSpots;
    for (let x = start; x < W + step; x += step) {
      const i = Math.round((x + off) / step);
      ctx.fillStyle = '#0d0906';
      ctx.fillRect(x + 10, 70, step - 20, GY - 90);
      for (let r = 0; r < 5; r++) {
        const ry = 96 + r * 76;
        for (let c = 0; c < 3; c++) {
          const rx = x + 24 + c * ((step - 48) / 2);
          const bump = ((i * 7 + r * 5 + c * 3) % 5) - 2;
          ctx.fillStyle = '#c9bda2';
          ctx.beginPath();
          ctx.ellipse(rx + bump, ry, 15, 12, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0d0906';
          ctx.fillRect(rx + bump - 6, ry - 2, 4, 5);
          ctx.fillRect(rx + bump + 2, ry - 2, 4, 5);
          // one skull per handful of niches glows once the lantern reaches it
          if (eyes && (i * 7 + r * 3 + c) % 6 === 0 && rx > -30 && rx < W + 30) {
            eyes.push({ x: rx + bump, y: ry - 1, size: BS * 0.34, seed: i * 11 + r * 3 + c, color: '#f4f8ff' });
          }
        }
      }
      ctx.fillStyle = '#241c14';
      ctx.fillRect(x, 60, 10, GY - 60);
    }
  };

  // ------------------------------------------------------------------ the hall of mirrors (level 4)
  R.drawMirrors = function (ctx, camX, t, G) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#120c1a');
    g.addColorStop(1, '#241830');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.5, step = 210;
    const start = gridStart(0, off, step) - step;
    const s = G.s, skin = G.skin;
    const expr = G.vis && G.vis.oT > 0 ? 'o' : 'grin';
    for (let x = start; x < W + step; x += step) {
      const i = Math.round((x + off) / step);
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(x + 6, 30, step - 12, GY - 50);
      const px0 = x + step / 2, ptop = 60, pw = step - 60, ph = GY - 120;
      ctx.fillStyle = '#c9a13a';
      Art.rr(ctx, px0 - pw / 2 - 8, ptop - 8, pw + 16, ph + 16, 14);
      ctx.fill();
      ctx.fillStyle = '#8a6a1e';
      Art.rr(ctx, px0 - pw / 2 - 4, ptop - 4, pw + 8, ph + 8, 12);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      Art.rr(ctx, px0 - pw / 2, ptop, pw, ph, 8);
      ctx.clip();
      const mgc = ctx.createLinearGradient(px0 - pw / 2, ptop, px0 + pw / 2, ptop + ph);
      mgc.addColorStop(0, '#5a6a82');
      mgc.addColorStop(0.5, '#8a9ab2');
      mgc.addColorStop(1, '#3a4658');
      ctx.fillStyle = mgc;
      ctx.fillRect(px0 - pw / 2, ptop, pw, ph);
      // a warped, stretched reflection of Vippe, in a few panels only
      if (s && i % 2 === 0) {
        ctx.translate(px0, ptop + ph * 0.62);
        const sway = Math.sin(t * 1.3 + i) * 0.18;
        const stretch = 1.35 + 0.25 * Math.sin(t * 0.7 + i * 1.7);
        ctx.transform(1 + sway * 0.3, sway * 0.5, 0, stretch, 0, 0);
        Art.cube(ctx, BS * 1.3, expr, skin, 1);
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px0 - pw / 2 + 10, ptop + ph * 0.2);
      ctx.lineTo(px0 + pw / 2 - 14, ptop + ph * 0.1);
      ctx.stroke();
    }
  };

  // ------------------------------------------------------------------ the ghost train tunnel (level 4)
  R.drawGhosttrain = function (ctx, camX, t) {
    ctx.fillStyle = '#030204';
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.4, step = 260;
    const start = gridStart(0, off, step) - step;
    const uv = '#7dff9a', purple = '#c04aff';
    for (let x = start; x < W + step; x += step) {
      const i = Math.round((x + off) / step);
      const bx = x + step * 0.5, bh = 120 + ((i * 37) % 60);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = i % 2 ? uv : purple;
      ctx.beginPath();
      ctx.moveTo(bx - 34, GY - 40);
      ctx.lineTo(bx - 46, GY - bh);
      ctx.lineTo(bx - 10, GY - bh - 20);
      ctx.lineTo(bx + 12, GY - bh - 40);
      ctx.lineTo(bx + 30, GY - bh);
      ctx.lineTo(bx + 44, GY - 40);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(bx - 8, GY - bh - 10, 4, 0, Math.PI * 2);
      ctx.arc(bx + 10, GY - bh - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // flickering bulbs strung along the tunnel
    const offB = camX * BS * 0.7;
    for (let x = gridStart(0, offB, 90) - 90; x < W + 90; x += 90) {
      const i = Math.round((x + offB) / 90);
      if (U.hash(i * 3.7 + Math.floor(t * 8)) < 0.15) continue;
      const gl = ctx.createRadialGradient(x, 60, 2, x, 60, 40);
      gl.addColorStop(0, 'rgba(255,240,180,0.55)');
      gl.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x - 40, 20, 80, 80);
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(x, 60, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // the ride track receding into the black
    ctx.strokeStyle = 'rgba(125,255,154,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 4, GY);
    ctx.lineTo(W * 0.5 - 60, GY - 260);
    ctx.moveTo(W / 2 + 4, GY);
    ctx.lineTo(W * 0.5 + 60, GY - 260);
    ctx.stroke();
  };

  // ------------------------------------------------------------------ holes in the floor (level 2)
  // the ragged hole in the tunnel floor, and where it comes out through the sewer roof one layer down
  R.drawHoles = function (ctx, camX, t, L) {
    for (const d of this.lvl.drops) {
      const x0 = sx(d.x0, camX), x1 = sx(d.x1, camX);
      if (x1 < -400 || x0 > W + 200) continue;
      if (d.layer === L) Art.hole(ctx, x0, x1, GY, H, t);
      else if (d.layer + 1 === L) Art.holeRoof(ctx, x0, x1, GY, t);
    }
  };

  // ------------------------------------------------------------------ near scenery (world anchored)
  // inside = only the decorations that belong inside a cave/hall (drawn over the indoor background)
  R.drawNear = function (ctx, camX, t, inside, L = 0) {
    const decos = this.lvl.decos;
    for (const d of decos) {
      if (d.x + (d.span || 0) < camX - 14) continue; // span = width in blocks of extra-wide scenery
      if (d.x > camX + 30) break;
      if (!!d.inside !== inside || (d.layer || 0) !== L) continue;
      const f = Art.near[d.type];
      if (f) f(ctx, sx(d.x, camX), GY, d, t, BS, FONT);
    }
  };

  // ------------------------------------------------------------------ ground
  R.drawGround = function (ctx, camX, t, inT, L = 0) {
    const T = Art.TL;
    for (const a of this.layers[L].areas) {
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
      } else if (st === 'plattan') {
        // Sergels torg ("Plattan"): the famous black-and-white triangle paving
        ctx.fillStyle = T('#e4e2dc');
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, GY, x1 - x0, H - GY);
        ctx.clip();
        ctx.fillStyle = T('#26262a');
        const tw = 44, th = 30;
        for (let r = 0; r < 6; r++) {
          const yy = GY + 10 + r * th;
          ctx.beginPath();
          for (let x = gridStart(x0, camX * BS, tw) - tw; x < x1 + tw; x += tw) {
            if (r % 2) {
              ctx.moveTo(x, yy);
              ctx.lineTo(x + tw / 2, yy + th);
              ctx.lineTo(x + tw, yy);
            } else {
              ctx.moveTo(x, yy + th);
              ctx.lineTo(x + tw / 2, yy);
              ctx.lineTo(x + tw, yy + th);
            }
          }
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = T('#f4f2ec');
        ctx.fillRect(x0, GY, x1 - x0, 8);
        ctx.fillStyle = T('#aaa69c');
        ctx.fillRect(x0, GY + 8, x1 - x0, 2);
      } else if (st === 'platform') {
        // the platform: stone floor, the yellow safety line, the edge, and the track down in the pit
        ctx.fillStyle = '#9ba0a6';
        ctx.fillRect(x0, GY, x1 - x0, 46);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let x = gridStart(x0, camX * BS, 96); x < x1; x += 96) if (x >= x0) ctx.fillRect(x, GY + 6, 2, 16);
        ctx.fillStyle = '#d6dadf';
        ctx.fillRect(x0, GY, x1 - x0, 5);
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(x0, GY + 22, x1 - x0, 11);
        ctx.fillStyle = '#c4960e';
        for (let x = gridStart(x0, camX * BS, 12); x < x1; x += 12) if (x >= x0 && x + 7 <= x1) ctx.fillRect(x + 3, GY + 25, 4, 4);
        ctx.fillStyle = '#eef0f2';
        ctx.fillRect(x0, GY + 42, x1 - x0, 4);
        ctx.fillStyle = '#343840';
        ctx.fillRect(x0, GY + 46, x1 - x0, 34);
        ctx.fillStyle = '#121317';
        ctx.fillRect(x0, GY + 80, x1 - x0, H - GY - 80);
        ctx.fillStyle = '#3a3530';
        for (let x = gridStart(x0, camX * BS, 40); x < x1; x += 40) {
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + 22);
          if (a1 > a0) ctx.fillRect(a0, GY + 128, a1 - a0, 10);
        }
        ctx.fillStyle = '#6f767e';
        ctx.fillRect(x0, GY + 120, x1 - x0, 8);
        ctx.fillStyle = '#c3c8ce';
        ctx.fillRect(x0, GY + 120, x1 - x0, 2);
      } else if (st === 'track') {
        // the track bed: the running rail on its sleepers, gravel underneath
        ctx.fillStyle = '#3b3733';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        for (let i = Math.floor(camX * 3 + x0 / 16) - 1; i <= Math.ceil(camX * 3 + x1 / 16); i++) {
          const x = i * 16 - camX * BS + ((i * 7) % 9);
          if (x < x0 || x + 7 > x1) continue;
          ctx.fillStyle = (i * 13) % 3 ? '#534e47' : '#6a645b';
          ctx.fillRect(x, GY + 26 + ((i * 29) % 120), 7, 5);
        }
        ctx.fillStyle = '#5a4a3b';
        for (let x = gridStart(x0, camX * BS, 36); x < x1; x += 36) {
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + 22);
          if (a1 > a0) ctx.fillRect(a0, GY + 8, a1 - a0, 14);
        }
        ctx.fillStyle = '#6c7279';
        ctx.fillRect(x0, GY, x1 - x0, 8);
        ctx.fillStyle = '#d2d7dd';
        ctx.fillRect(x0, GY, x1 - x0, 3);
      } else if (st === 'sewer') {
        // a wet stone walkway along the sewer channel, dark slimy bricks below it
        ctx.fillStyle = '#262a21';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let r = 0; r < 8; r++) {
          const yy = GY + 34 + r * 17;
          ctx.moveTo(x0, yy);
          ctx.lineTo(x1, yy);
          for (let x = gridStart(x0, camX * BS + (r % 2) * 20, 40); x < x1; x += 40) {
            if (x < x0) continue;
            ctx.moveTo(x, yy);
            ctx.lineTo(x, yy + 17);
          }
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(120,165,40,0.22)';
        ctx.fillRect(x0, GY + 58, x1 - x0, 12);
        ctx.fillStyle = '#555b4b';
        ctx.fillRect(x0, GY, x1 - x0, 34);
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        for (let x = gridStart(x0, camX * BS, 72); x < x1; x += 72) if (x >= x0) ctx.fillRect(x, GY + 5, 2, 29);
        ctx.fillStyle = 'rgba(210,235,210,0.18)';
        for (let x = gridStart(x0, camX * BS, 72); x < x1; x += 72) {
          const a0 = Math.max(x0, x + 14), a1 = Math.min(x1, x + 44);
          if (a1 > a0) ctx.fillRect(a0, GY + 13, a1 - a0, 3);
        }
        ctx.fillStyle = '#5f7d34';
        ctx.fillRect(x0, GY, x1 - x0, 5);
      } else if (st === 'pipe') {
        // the bottom of the big sewer pipe, a trickle of green sludge running along it
        const g = ctx.createLinearGradient(0, GY, 0, H);
        g.addColorStop(0, '#50545a');
        g.addColorStop(1, '#1d1f22');
        ctx.fillStyle = g;
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let x = gridStart(x0, camX * BS, 144); x < x1; x += 144) if (x >= x0) ctx.fillRect(x, GY, 6, H - GY);
        ctx.fillStyle = '#7ea52c';
        ctx.fillRect(x0, GY, x1 - x0, 6);
        ctx.fillStyle = 'rgba(210,255,130,0.55)';
        ctx.fillRect(x0, GY, x1 - x0, 2);
      } else if (st === 'grave') {
        // packed grave-dirt path with patches of dead grass
        ctx.fillStyle = '#241d16';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        for (let i = Math.floor(camX + x0 / BS); i <= Math.ceil(camX + x1 / BS); i++) {
          if (i & 1) continue;
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 > a0) ctx.fillRect(a0, GY + 36, a1 - a0, BS);
        }
        ctx.fillStyle = '#3a3a24';
        ctx.fillRect(x0, GY, x1 - x0, 10);
        ctx.fillStyle = '#55552e';
        ctx.fillRect(x0, GY, x1 - x0, 3);
        ctx.fillStyle = '#2c2c1a';
        for (let i = Math.floor(camX * 4 + x0 / 12); i <= Math.ceil(camX * 4 + x1 / 12); i++) {
          const x = i * 12 - camX * BS;
          if (x >= x0 && x + 5 <= x1) ctx.fillRect(x, GY + 10, 5, 3 + ((i * 7) & 3));
        }
      } else if (st === 'flagstone') {
        ctx.fillStyle = '#232025';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = '#332e35';
        const sw = 46, shh = 24;
        for (let r = 0; r < 8; r++) {
          const yy = GY + 4 + r * (shh + 3);
          const shift = (r % 2) * (sw / 2);
          const start = gridStart(x0, camX * BS + shift, sw + 3);
          for (let x = start; x < x1; x += sw + 3) {
            const a0 = Math.max(x0, x), a1 = Math.min(x1, x + sw);
            if (a1 > a0) {
              Art.rr(ctx, a0, yy, a1 - a0, shh, 4);
              ctx.fill();
            }
          }
        }
        ctx.fillStyle = '#463f47';
        ctx.fillRect(x0, GY, x1 - x0, 5);
      } else if (st === 'bones') {
        ctx.fillStyle = '#171310';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        for (let i = Math.floor(camX * 2 + x0 / 26) - 1; i <= Math.ceil(camX * 2 + x1 / 26); i++) {
          const x = i * 26 - camX * BS;
          if (x + 20 < x0 || x > x1) continue;
          const yy = GY + 4 + ((i * 23) % 10);
          ctx.fillStyle = '#d8cdb8';
          if (i % 3 === 0) {
            // a little skull half-buried
            ctx.beginPath();
            ctx.ellipse(x + 10, yy, 7, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#171310';
            ctx.fillRect(x + 7, yy - 1, 2, 3);
            ctx.fillRect(x + 11, yy - 1, 2, 3);
          } else {
            ctx.save();
            ctx.translate(x + 10, yy);
            ctx.rotate(((i * 37) % 10) / 10 - 0.5);
            ctx.fillRect(-12, -2, 24, 4);
            ctx.beginPath();
            ctx.arc(-12, 0, 4, 0, Math.PI * 2);
            ctx.arc(12, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
        ctx.fillStyle = '#2a2118';
        ctx.fillRect(x0, GY, x1 - x0, 4);
      } else if (st === 'sawdust') {
        ctx.fillStyle = '#5a3f26';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = Math.floor(camX + x0 / BS); i <= Math.ceil(camX + x1 / BS); i++) {
          if (i & 1) continue;
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 > a0) ctx.fillRect(a0, GY + 36, a1 - a0, BS);
        }
        ctx.fillStyle = '#caa15c';
        for (let i = Math.floor(camX * 5 + x0 / 10); i <= Math.ceil(camX * 5 + x1 / 10); i++) {
          const x = i * 10 - camX * BS + ((i * 7) % 5);
          if (x >= x0 && x + 4 <= x1) ctx.fillRect(x, GY + 4 + ((i * 5) % 8), 4, 1.5);
        }
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(x0, GY, x1 - x0, 4);
      } else if (st === 'mirrorfloor') {
        const g = ctx.createLinearGradient(0, GY, 0, H);
        g.addColorStop(0, '#1a1622');
        g.addColorStop(0.4, '#332a44');
        g.addColorStop(1, '#0c0a12');
        ctx.fillStyle = g;
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.strokeStyle = 'rgba(200,220,255,0.14)';
        ctx.lineWidth = 1;
        const dw = 60;
        for (let r = 0; r < 6; r++) {
          const yy = GY + r * dw;
          const shift = (r % 2) * (dw / 2);
          ctx.beginPath();
          for (let x = gridStart(x0, camX * BS + shift, dw); x < x1; x += dw) {
            ctx.moveTo(x, yy);
            ctx.lineTo(x + dw / 2, yy + dw / 2);
            ctx.lineTo(x, yy + dw);
            ctx.lineTo(x - dw / 2, yy + dw / 2);
          }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x0, GY, x1 - x0, 3);
      } else if (st === 'ghostrail') {
        ctx.fillStyle = '#0c0a10';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = '#241c28';
        for (let x = gridStart(x0, camX * BS, 20); x < x1; x += 20) {
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + 12);
          if (a1 > a0) ctx.fillRect(a0, GY + 10, a1 - a0, 8);
        }
        ctx.fillStyle = '#5a4a68';
        ctx.fillRect(x0, GY, x1 - x0, 5);
        ctx.fillStyle = 'rgba(160,255,180,0.4)';
        ctx.fillRect(x0, GY, x1 - x0, 2);
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

  R.drawCorridors = function (ctx, camX, t, L = 0) {
    for (const c of this.lvl.corridors) {
      if ((c.layer || 0) !== L) continue;
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
      } else if (c.style === 'tunnel') {
        // the concrete tunnel roof, with cables along it and lamps
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#0f1114');
        g.addColorStop(1, '#30343c');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        for (let x = gridStart(x0, camX * BS, 192); x < x1; x += 192) if (x >= x0) ctx.fillRect(x, 0, 5, y);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, y + 30);
        ctx.clip();
        ctx.strokeStyle = '#07080a';
        ctx.lineWidth = 3;
        for (let k = 0; k < 2; k++) {
          const cy = y - 20 - k * 12;
          ctx.beginPath();
          for (let x = gridStart(x0, camX * BS, 96) - 96; x < x1 + 96; x += 96) {
            ctx.moveTo(x, cy);
            ctx.quadraticCurveTo(x + 48, cy + 9, x + 96, cy);
          }
          ctx.stroke();
        }
        for (let x = gridStart(x0, camX * BS, 288) + 70; x < x1 + 90; x += 288) {
          const gl = ctx.createRadialGradient(x, y + 2, 2, x, y + 2, 80);
          gl.addColorStop(0, 'rgba(255,214,140,0.45)');
          gl.addColorStop(1, 'rgba(255,214,140,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(x - 80, y - 10, 160, 90);
          ctx.fillStyle = '#ffe2a6';
          ctx.fillRect(x - 12, y - 7, 24, 7);
        }
        ctx.restore();
        ctx.fillStyle = '#4b5059';
        ctx.fillRect(x0, y - 5, x1 - x0, 5);
        ctx.fillStyle = 'rgba(255,207,112,0.65)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      } else if (c.style === 'pipe') {
        // the curved top of the big sewer pipe, dripping slime
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#0c0e0b');
        g.addColorStop(0.7, '#2a2d29');
        g.addColorStop(1, '#474b45');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        for (let x = gridStart(x0, camX * BS, 144); x < x1; x += 144) if (x >= x0) ctx.fillRect(x, 0, 6, y);
        ctx.fillStyle = 'rgba(150,80,30,0.25)';
        for (let x = gridStart(x0, camX * BS, 144) + 40; x < x1; x += 144) if (x >= x0) ctx.fillRect(x, y - 90, 8, 80);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, y + 60);
        ctx.clip();
        ctx.fillStyle = '#7ea52c';
        for (let x = gridStart(x0, camX * BS, 52); x < x1 + 52; x += 52) {
          const i = Math.round((x + camX * BS) / 52);
          const len = 6 + ((i * 37) % 17);
          ctx.beginPath();
          ctx.moveTo(x - 7, y - 2);
          ctx.quadraticCurveTo(x - 3, y + len * 0.5, x, y + len);
          ctx.quadraticCurveTo(x + 3, y + len * 0.5, x + 7, y - 2);
          ctx.fill();
          if (i % 3 === 0) {
            const u = (t * 0.8 + i * 0.29) % 1;
            ctx.fillRect(x - 2, y + len + u * 70, 4, 6);
          }
        }
        ctx.restore();
        ctx.fillStyle = '#7ea52c';
        ctx.fillRect(x0, y - 4, x1 - x0, 4);
        ctx.fillStyle = 'rgba(210,255,130,0.55)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      } else if (c.style === 'vault') {
        // a stone groin-vault ceiling with ribs, lit faintly red by the windows below
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#0c0810');
        g.addColorStop(1, '#2e1c28');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = gridStart(x0, camX * BS, 130) - 130; x < x1 + 130; x += 130) {
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + 65, y - 70, x + 130, y);
        }
        ctx.stroke();
        for (let x = gridStart(x0, camX * BS, 130) + 65; x < x1; x += 130) {
          if (x < x0) continue;
          const gl = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, 70);
          gl.addColorStop(0, 'rgba(179,18,30,0.3)');
          gl.addColorStop(1, 'rgba(179,18,30,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(x - 70, y - 20, 140, 90);
        }
        ctx.fillStyle = '#1c0f18';
        ctx.fillRect(x0, y - 4, x1 - x0, 4);
      } else if (c.style === 'bones') {
        // bones jammed into the low catacomb roof
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = '#c9bda2';
        for (let x = gridStart(x0, camX * BS, 30) - 30; x < x1 + 30; x += 30) {
          const i = Math.round((x + camX * BS) / 30);
          const len = 10 + ((i * 13) % 14);
          ctx.save();
          ctx.translate(x + 15, y);
          ctx.rotate(((i * 29) % 10) / 20 - 0.25);
          ctx.fillRect(-2, 0, 4, len);
          ctx.beginPath();
          ctx.arc(0, len, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#1a1512';
        ctx.fillRect(x0, y - 3, x1 - x0, 3);
      } else if (c.style === 'ghosttrain') {
        // a black tunnel roof with slack wires and smears of UV paint
        ctx.fillStyle = '#050308';
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.strokeStyle = '#1c1622';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = gridStart(x0, camX * BS, 90) - 90; x < x1 + 90; x += 90) {
          ctx.moveTo(x, y - 30);
          ctx.quadraticCurveTo(x + 45, y - 10, x + 90, y - 30);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(125,255,154,0.18)';
        for (let x = gridStart(x0, camX * BS, 220) + 40; x < x1; x += 220) {
          if (x < x0) continue;
          ctx.beginPath();
          ctx.ellipse(x, y - 40, 40, 16, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#100a16';
        ctx.fillRect(x0, y - 4, x1 - x0, 4);
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
  const WATER_STYLE = { peat: 'bog', sewer: 'sludge' };
  R.drawObjects = function (ctx, camX, t, G, L = 0) {
    const lvl = this.lvl;
    const AH = Art.horror;
    const vis = lvl.visible(camX - 2, camX + W / BS + 2).filter((o) => (o.layer || 0) === L);
    const glow = (x) => this.theme.glow[this.areaIn(L, x).id];
    const px = G.s ? G.s.x : camX + PX; // the menu's attract mode has no s, so use the camera instead
    const darkZones = lvl.fx && lvl.fx.dark;
    const inDark = (x) => {
      if (!darkZones) return false;
      for (const z of darkZones) if (x >= z.x0 - 6 && x <= z.x1 + 6) return true;
      return false;
    };
    // water and the live rail first (they sit in the ground)
    for (const o of vis) {
      if (o.t !== 'haz') continue;
      if (o.kind === 'water') {
        const x0 = sx(o.x, camX), x1 = sx(o.x + o.w, camX), ys = sy(0.22);
        const wf = AH && AH.water && AH.water[o.style];
        if (wf) wf(ctx, x0, x1, ys, H, t);
        else Art.water(ctx, x0, x1, ys, H, t, o.style || WATER_STYLE[this.theme.ground[this.areaIn(L, o.x).id]]);
      } else if (o.kind === 'rail') Art.rail(ctx, sx(o.x, camX), sx(o.x + o.w, camX), GY, t, this.theme.ground[this.areaIn(L, o.x).id]);
    }
    // checkpoints
    for (const cp of lvl.checkpoints) {
      if (cp.index === 0 || (cp.layer || 0) !== L || cp.x < camX - 2 || cp.x > camX + 30) continue;
      const active = G.state !== 'menu' && G.cpIndex >= cp.index;
      Art.checkpoint(ctx, sx(cp.x, camX), GY, BS, active, t);
    }
    for (const o of vis) {
      const x = sx(o.x, camX), y = sy(o.y + o.h), w = o.w * BS, h = o.h * BS;
      switch (o.t) {
        case 'solid': {
          const bf = AH && AH.block && AH.block[o.style];
          if (bf) bf(ctx, x, y, w, h, BS, o.id, t);
          else Art.block(ctx, o.style, x, y, w, h, BS, o.id, t);
          break;
        }
        case 'haz':
          if (o.kind === 'spike' || o.kind === 'spikeDown') {
            const down = o.kind === 'spikeDown';
            const sf = AH && AH.spike && AH.spike[o.style];
            if (sf) sf(ctx, x, y, w, h, down, glow(o.x), t, o.id);
            else Art.spike(ctx, x, y, w, h, down, o.style, glow(o.x), t, o.id);
          } else if (o.kind === 'half') Art.half(ctx, x, y, w, h, o.style, glow(o.x));
          else if (o.kind === 'bird') {
            const cx2 = x + w / 2, cy2 = y + h / 2;
            const brf = AH && AH.bird && AH.bird[o.style];
            if (brf) brf(ctx, cx2, cy2, BS, t, o.id, glow(o.x));
            else Art.bird(ctx, cx2, cy2, BS, t, o.id, glow(o.x), o.style);
            if (o.style === 'bat' && inDark(o.x)) this._eyeSpots.push({ x: cx2, y: cy2, size: BS * 0.3, seed: o.id, color: '#f4f8ff' });
          } else if (o.kind === 'thorny') {
            const bf = AH && AH.block && AH.block[o.style];
            if (bf) bf(ctx, x, y, w, h, BS, o.id, t);
            else Art.block(ctx, o.style, x, y, w, h, BS, o.id, t);
          } else if (o.kind === 'croc') Art.crocHead(ctx, x, y, w, h, o.dir, t, o.id, glow(o.x));
          else if (o.kind === 'snapper') Art.snapper(ctx, x, y, w, h, t, o.id, glow(o.x));
          else if (o.kind === 'nun') {
            const mv = VD.Physics.moveOf(o, px);
            const ncx = sx(o.x + o.w / 2 + mv.dx, camX), ncy = sy(o.y + o.h / 2 + mv.dy);
            if (AH && AH.hazard && AH.hazard.nun) AH.hazard.nun(ctx, ncx, ncy, BS, t, o.id, glow(o.x), o.style);
            else {
              ctx.fillStyle = '#3a0810';
              Art.rr(ctx, ncx - w / 2, ncy - h / 2, w, h, 6);
              ctx.fill();
            }
            if (inDark(o.x)) this._eyeSpots.push({ x: ncx, y: ncy - h * 0.28, size: BS * 0.4, seed: o.id, color: '#f4f8ff' });
          } else if (o.kind === 'jack') {
            const mv = VD.Physics.moveOf(o, px);
            const jx = sx(o.x, camX), jy = sy(o.y + o.h);
            const rise = (o.mv && o.mv.rise) || 1.5;
            if (AH && AH.hazard && AH.hazard.jack) AH.hazard.jack(ctx, jx, jy, BS, mv.k, rise, t, o.id, glow(o.x));
            else if (mv.k > 0.02) {
              ctx.fillStyle = '#efe9dc';
              ctx.beginPath();
              ctx.arc(jx + BS / 2, jy + BS * 0.45 - mv.k * rise * BS, BS * 0.35, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (o.kind === 'pendulum' && o.mv) {
            const mv = VD.Physics.moveOf(o, px);
            const pvx = sx(o.mv.px, camX), pvy = sy(o.mv.py);
            if (AH && AH.hazard && AH.hazard.pendulum) AH.hazard.pendulum(ctx, pvx, pvy, o.mv.len * BS, mv.a, BS, t, o.id, glow(o.x));
            else {
              const bx2 = pvx + Math.sin(mv.a) * o.mv.len * BS, by2 = pvy - Math.cos(mv.a) * o.mv.len * BS;
              ctx.strokeStyle = '#5a4a3a';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(pvx, pvy);
              ctx.lineTo(bx2, by2);
              ctx.stroke();
              ctx.fillStyle = '#8a1018';
              ctx.beginPath();
              ctx.arc(bx2, by2, BS * 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (o.kind === 'balloon') {
            const mv = VD.Physics.moveOf(o, px);
            const bcx = sx(o.x + o.w / 2 + mv.dx, camX), bcy = sy(o.y + 1.1 + mv.dy);
            if (AH && AH.hazard && AH.hazard.balloon) AH.hazard.balloon(ctx, bcx, bcy, BS, t, o.id, glow(o.x));
            else {
              ctx.fillStyle = '#c0081a';
              ctx.beginPath();
              ctx.arc(bcx, bcy, BS * 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        case 'pad':
          Art.pad(ctx, x, y, w, h, o.color, t);
          break;
        case 'orb':
          Art.orb(ctx, sx(o.cx, camX), sy(o.cy), BS * 0.36, o.color, t, G.s && G.s.lastOrb === o.id);
          break;
        case 'portal': {
          const cy = o.mode === 'cube' ? sy(o.y + 1.5) : sy(1.5);
          const cxp = sx(o.x + 0.5, camX);
          if (o.grav) {
            // a gravity portal: a purple halo, and the swirl itself flipped upside-down
            const hg = ctx.createRadialGradient(cxp, cy, 0, cxp, cy, BS * 1.8);
            hg.addColorStop(0, 'rgba(200,40,255,0.4)');
            hg.addColorStop(1, 'rgba(200,40,255,0)');
            ctx.fillStyle = hg;
            ctx.beginPath();
            ctx.arc(cxp, cy, BS * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(cxp, cy);
            ctx.scale(1, -1);
            ctx.translate(-cxp, -cy);
            Art.portal(ctx, cxp, cy, BS * 3, o.mode, t);
            ctx.restore();
          } else Art.portal(ctx, cxp, cy, BS * 3, o.mode, t);
          break;
        }
      }
    }
    // finish line glow
    const fx = sx(lvl.finishX, camX);
    if (fx > -40 && fx < W + 40 && lvl.layerAt(lvl.finishX) === L) {
      const g = ctx.createLinearGradient(fx - 30, 0, fx + 30, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,240,180,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx - 30, 0, 60, GY);
    }
  };

  R.drawTexts = function (ctx, camX, G, L = 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const list = this.lvl.texts.slice();
    if (G.attemptText && G.state !== 'menu') list.push({ x: G.attemptText.x + 6, y: 6.2, text: 'Attempt ' + G.attemptText.n, size: 0.9, layer: G.attemptText.layer });
    for (const tx of list) {
      if ((tx.layer || 0) !== L) continue;
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
      if (s.gdir > 0) ctx.scale(1, -1); // a gravity portal flipped him: run on the ceiling
      Art.cube(ctx, BS, expr, G.skin, 1);
    } else if (s.mode === 'ship') {
      ctx.rotate(v.rot);
      Art.ship(ctx, BS * 1.15, expr, G.skin, v.wheel, t);
    } else {
      Art.ball(ctx, BS, expr, G.skin, v.rot, s.gdir > 0);
    }
    ctx.restore();
  };

  R.drawParticles = function (ctx, camX, G, L = 0) {
    for (const p of G.particles) {
      if ((p.layer || 0) !== L) continue;
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
      if ((o.layer || 0) !== (s.layer || 0)) continue;
      if (o.t === 'haz') {
        let hx0 = o.hx0, hx1 = o.hx1, hy0 = o.hy0, hy1 = o.hy1;
        if (o.mv) {
          const mv = VD.Physics.moveOf(o, s.x);
          hx0 += mv.dx;
          hx1 += mv.dx;
          hy0 += mv.dy;
          hy1 += mv.dy;
        }
        ctx.strokeStyle = '#f00';
        ctx.strokeRect(sx(hx0, camX), sy(hy1), (hx1 - hx0) * BS, (hy1 - hy0) * BS);
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
  R.drawHUD = function (ctx, G, t, camX, mirrored) {
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

    // ---- health bar (nightmare and any future level with a health pool) ----
    if (G.hpMax > 0) {
      const ratio = U.clamp(G.hp / G.hpMax, 0, 1);
      const low = !!G.lowHp;
      const hurtOn = !!(G.hurt && G.hurt.t < 0.6 && G.hurt.n > 0);
      let ghostRatio = ratio;
      if (hurtOn) {
        const preRatio = U.clamp((G.hp + G.hurt.n) / G.hpMax, 0, 1);
        const k = 1 - U.smooth(U.clamp(G.hurt.t / 0.6, 0, 1));
        ghostRatio = ratio + (preRatio - ratio) * k;
      }
      const blink = low ? 0.55 + 0.45 * Math.sin(t * 10) : 1;
      const hx0 = 108, hx1 = 338, hy0 = 14, hy1 = 38, hw = hx1 - hx0, hh = hy1 - hy0;
      ctx.globalAlpha = blink;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      Art.rr(ctx, hx0 - 3, hy0 - 3, hw + 6, hh + 6, 8);
      ctx.fill();
      if (ghostRatio > 0.004) {
        ctx.fillStyle = '#ffffff';
        Art.rr(ctx, hx0, hy0, Math.max(2, hw * ghostRatio), hh, 6);
        ctx.fill();
      }
      if (ratio > 0.004) {
        ctx.fillStyle = ratio > 0.5 ? U.mixHex('#ffd634', '#3cff78', (ratio - 0.5) * 2) : U.mixHex('#ff2a3a', '#ffd634', ratio * 2);
        Art.rr(ctx, hx0, hy0, Math.max(2, hw * ratio), hh, 6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // heart icon, beating when low
      const beat = low ? 1 + 0.2 * Math.max(0, Math.sin(t * 9)) : 1;
      ctx.save();
      ctx.translate(86, (hy0 + hy1) / 2); // right of the mute button (a DOM button at the top left)
      ctx.scale(beat, beat);
      heartPath(ctx, 0, 0, 15);
      ctx.fillStyle = low ? '#ff3a4a' : '#ff5a68';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      // hp number
      ctx.font = '20px ' + FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const hpTxt = String(Math.max(0, Math.ceil(G.hp)));
      ctx.strokeText(hpTxt, hx1 + 12, (hy0 + hy1) / 2);
      ctx.fillText(hpTxt, hx1 + 12, (hy0 + hy1) / 2);

      if (low) {
        if (!this._vignette) {
          const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
          vg.addColorStop(0, 'rgba(255,20,30,0)');
          vg.addColorStop(1, 'rgba(255,20,30,0.55)');
          this._vignette = vg;
        }
        ctx.globalAlpha = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(t * 6));
        ctx.fillStyle = this._vignette;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (hurtOn) {
        const hk = 1 - G.hurt.t / 0.6;
        if (!this._bloodBlobs) this._bloodBlobs = makeBloodBlobs();
        ctx.fillStyle = 'rgba(170,8,18,' + (0.5 * hk).toFixed(3) + ')';
        for (const bl of this._bloodBlobs) {
          ctx.beginPath();
          ctx.ellipse(bl.x, bl.y, bl.rx, bl.ry, bl.rot, 0, Math.PI * 2);
          ctx.fill();
        }
        // the floating "-n": drawn in world space, so it scrolls with the world
        const wx = mirrored ? W - sx(G.hurt.x, camX) : sx(G.hurt.x, camX);
        const wy = sy(G.hurt.y) - (1 - hk) * 46;
        ctx.font = '30px ' + FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,50,60,' + hk.toFixed(3) + ')';
        ctx.strokeStyle = 'rgba(0,0,0,' + (0.6 * hk).toFixed(3) + ')';
        ctx.lineWidth = 5;
        const dtx = '-' + G.hurt.n;
        ctx.strokeText(dtx, wx, wy);
        ctx.fillText(dtx, wx, wy);
      }
    }
  };

  // ------------------------------------------------------------------ jump scares
  R.drawScare = function (ctx, G, clock) {
    const sc = G.scare;
    if (!sc) return;
    const AH = Art.horror;
    const et = sc.t || 0;
    const cx = W / 2, cy = H * 0.44, size = Math.min(W, H) * 0.6;

    if (sc.kind === 'window') {
      // NOT full-screen: a small lit gothic window near the top right with a nun silhouette
      if (et > 0.5) return;
      const a = (et < 0.08 ? et / 0.08 : 1) * U.clamp(1 - et / 0.5, 0, 1);
      if (a <= 0.002) return;
      const wx = W - 150, wy = 110, ww = 90, wh = 130;
      ctx.save();
      ctx.globalAlpha = a;
      const gl = ctx.createRadialGradient(wx, wy, 4, wx, wy, 150);
      gl.addColorStop(0, 'rgba(255,220,150,0.5)');
      gl.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(wx - 150, wy - 150, 300, 300);
      ctx.fillStyle = '#2a1c22';
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wy + wh / 2);
      ctx.lineTo(wx - ww / 2, wy - wh / 2 + ww / 2);
      ctx.arc(wx, wy - wh / 2 + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wy + wh / 2);
      ctx.closePath();
      ctx.fill();
      if (AH && AH.hazard && AH.hazard.nun) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(wx - ww / 2, wy - wh / 2, ww, wh + 2);
        ctx.clip();
        AH.hazard.nun(ctx, wx, wy + wh * 0.2, BS * 0.85, clock, 1, '#f4f8ff', null);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wy + wh / 2);
      ctx.lineTo(wx - ww / 2, wy - wh / 2 + ww / 2);
      ctx.arc(wx, wy - wh / 2 + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wy + wh / 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    let tt = et;
    if (sc.kind === 'skull') {
      // the lantern goes fully out first, then face.skull runs on the same timeline shifted by 0.4s
      if (et < 0.4) {
        ctx.fillStyle = '#020103';
        ctx.fillRect(0, 0, W, H);
        if (AH && AH.eyes) {
          const pulse = 0.7 + 0.3 * Math.sin(et * 22);
          ctx.globalAlpha = pulse;
          AH.eyes(ctx, cx - 40, cy, 30, clock, 2, '#f4f8ff');
          AH.eyes(ctx, cx + 40, cy + 14, 26, clock, 3, '#f4f8ff');
          ctx.globalAlpha = 1;
        }
        return;
      }
      tt = et - 0.4;
    }

    const env = scareEnvelope(tt);
    if (env.alpha <= 0.002) return;
    const backA = Math.min(0.6, env.alpha), faceA = Math.min(0.9, env.alpha);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.75);
    bg.addColorStop(0, 'rgba(120,4,10,' + backA.toFixed(3) + ')');
    bg.addColorStop(1, 'rgba(120,4,10,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const face = (fn, x) => {
      if (!fn) return;
      ctx.save();
      ctx.globalAlpha = faceA;
      ctx.translate(x, cy);
      ctx.scale(env.scale, env.scale);
      fn(ctx, 0, 0, size, clock, faceA);
      ctx.restore();
    };

    if (sc.kind === 'nun' || sc.kind === 'final') face(AH && AH.face && AH.face.nun, cx);
    else if (sc.kind === 'clown') face(AH && AH.face && AH.face.clown, cx);
    else if (sc.kind === 'skull') face(AH && AH.face && AH.face.skull, cx);
    else if (sc.kind === 'duo') {
      face(AH && AH.face && AH.face.nun, cx - size * 0.32);
      face(AH && AH.face && AH.face.clown, cx + size * 0.32);
    } else if (sc.kind === 'mirror') {
      face(AH && AH.face && AH.face.clown, cx);
      // a quick cracked-glass line pattern over it
      ctx.save();
      ctx.globalAlpha = faceA;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      const cr = U.rng(7);
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        let x = cx, y = cy, ang = cr() * Math.PI * 2;
        ctx.moveTo(x, y);
        for (let sgm = 0; sgm < 3; sgm++) {
          ang += (cr() - 0.5) * 1.2;
          x += Math.cos(ang) * size * 0.14;
          y += Math.sin(ang) * size * 0.14;
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  };
})();
