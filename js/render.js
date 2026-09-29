// VippeDash — scene renderer: parallax sky/scenery, gameplay objects, player, particles, HUD
(function () {
  const VD = (window.VD = window.VD || {});
  const U = VD.U, Art = VD.Art, P = VD.PHYS;
  const W = 1280, H = 720, BS = 48, GY = 552, PX = 8;
  const TAU = Math.PI * 2;
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
    cottage: 5, villa: 5, barn: 6, church: 6, mounds: 10, oldchurch: 5, cityrow: 8, castle: 10, stadium: 7, cathedral: 11,
    willows: 6, farm: 9, hall: 6, villas: 9, home: 4, pines: 6, birches: 5, moose: 3,
    spruces: 6, tarn: 6, cranes: 4, deadtrees: 5, deer: 3, moosecalf: 4, foxrun: 2, rockhill: 9, firetower: 2, jakttorn: 2,
    whale: 15, reeftower: 7, shipwreck: 10, kelpforest: 8,
    rookpiece: 4, knightpiece: 4, bishoppiece: 3.5, queenpiece: 4.5,
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
      } else if (kind === 'reef') {
        // a distant ridge of coral bumps and rock outcrops, fading into the murk
        far.push({ u, t: 'reefbg', h: 0.5 + rnd() * 1.2, w: 0.9 + rnd() * 1.4 });
        u += 0.3 + rnd() * 0.6;
      } else if (kind === 'castle') {
        // distant castle silhouettes on the horizon, level 4 "Schackmatt"
        far.push({ u, t: 'castlesil', w: 1.0 + rnd() * 1.6, h: 1.0 + rnd() * 1.8 });
        u += 0.5 + rnd() * 1.3;
      } else {
        const pine = kind === 'pine' || rnd() < 0.55;
        far.push({ u, t: pine ? 'pine' : 'birch', h: 0.8 + rnd() * 1.1 });
        u += 0.35 + rnd() * 0.7;
      }
    }
    for (const e of th.farExtra || []) far.push({ u: (e.x - PX) * pF + HALF + 4, t: e.t, w: e.w, h: e.h, seed: e.seed });
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
      else if (fill === 'kelp') type = 'kelp1';
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
    // schools of fish drifting through the ocean background, in place of bird flocks
    this.fishSchools = [];
    if (th.fish) for (let i = 0; i < 5; i++) this.fishSchools.push({ o: i * 0.21 + rnd() * 0.1, y: 90 + rnd() * 320, s: 0.6 + rnd() * 0.5, n: 4 + Math.floor(rnd() * 6), sp: 0.03 + rnd() * 0.025 });
    // a couple of bats flapping across the Halloween dusk sky, well apart so they read as occasional
    this.bats = [];
    if (th.bats) for (let i = 0; i < 2; i++) this.bats.push({ o: i * 0.5 + rnd() * 0.2, y: 60 + rnd() * 160, s: 0.7 + rnd() * 0.4, sp: 0.02 + rnd() * 0.012 });
    // Stratusvägen: the houses/terraces/background scenery along the street, computed once here and
    // cached — see buildStreetscape() and drawHouses() below
    this.streetProps = th.lanes ? buildStreetscape(lvl) : null;
    this.spriteCache = new Map(); // fresh per level load — see getSprite() below
    this.patternCache = new Map(); // fresh per level load — see getPattern() below
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
  // Stratusvägen's two-lane street ('lane' player mode, physics.js): the far lane (lane 1) is drawn
  // shifted up this many blocks and a little smaller, purely a screen trick for depth — physics never
  // moves a lane object's actual y. Zero effect on every other level (nothing there has a `lane`, and
  // the player's laneP never leaves 0 outside 'lane' mode).
  const LANE_DY = 0.8;
  const LANE_SCALE = 0.92;
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
    // seconds since the last beat boundary (px - cyc); equals cyc / P.SPEED whenever the level has no
    // speed zones (the fast path VD.Physics.timeAt takes), so this is a no-op everywhere but Stratusvägen
    const phase = VD.Physics.timeAt(this.lvl, px) - VD.Physics.timeAt(this.lvl, px - cyc);
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
    // seconds since the downbeat 16 blocks into the current 32-block cycle; see the note in drawStrobe
    const downbeatX = px - cyc + 16;
    const dphase = VD.Physics.timeAt(this.lvl, px) - VD.Physics.timeAt(this.lvl, downbeatX);
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
    const dphase = VD.Physics.timeAt(this.lvl, px) - VD.Physics.timeAt(this.lvl, px - cyc);
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

    // Stratusvägen: the camera swing (see the comment on drawSwingScene below). Only relevant inside an
    // lvl.swings zone, on this theme, with an actual player — the menu's attract mode never triggers it.
    let swingZone = null, swingP = 0, swingTheta = 0, flatAlpha = 1, threeDAlpha = 0;
    if (this.theme.lanes && this.lvl.swings.length && G.s && G.state !== 'menu') {
      for (const z of this.lvl.swings) if (px >= z.x0 && px <= z.x1) { swingZone = z; break; }
      if (swingZone) {
        swingP = U.clamp((px - swingZone.x0) / (swingZone.x1 - swingZone.x0), 0, 1);
        flatAlpha = swingEnvelope(swingP);
        threeDAlpha = 1 - flatAlpha;
        swingTheta = U.smooth(swingP) * Math.PI; // eased yaw — 0 at the start, π at the end
      }
    }
    const here = G.s && (G.s.layer || 0) === L;

    ctx.save();
    ctx.globalAlpha = flatAlpha;
    if (flatAlpha > 0.015) {
      if (inT < 1) {
        this.drawOutdoor(ctx, camX, sky, t, center);
        // Stratusvägen: lamps/benches/signs are anchored at GY, but the lane road band (drawn further
        // down) reaches well above GY too — draw them after the road instead, so they aren't painted over
        if (!this.theme.lanes) this.drawNear(ctx, camX, t, false, L);
        if (this.theme.canopy) this.drawCanopy(ctx, camX, t, areaWeight(this.lvl, this.theme.canopy, center));
      }
      if (inT > 0) {
        ctx.globalAlpha = inT * flatAlpha;
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
        } else if (inKind === 'whale') {
          this.drawWhale(ctx, camX, t);
          this.drawNear(ctx, camX, t, true, L);
        } else if (inKind === 'rooktower') {
          this.drawRooktower(ctx, camX, t);
          this.drawNear(ctx, camX, t, true, L);
        } else if (inKind === 'cathedral') {
          this.drawCathedral(ctx, camX, t);
          this.drawNear(ctx, camX, t, true, L);
        } else {
          this.drawHall(ctx, camX, t);
          this.drawNear(ctx, camX, t, true, L);
        }
        ctx.globalAlpha = flatAlpha;
      }
      this.drawGround(ctx, camX, t, inT, L);
      if (this.theme.lanes) {
        this.drawLaneRoad(ctx, camX, t);
        this.drawNear(ctx, camX, t, false, L);
        this.drawHouses(ctx, camX, t);
        this.drawPeople(ctx, camX, t, px);
        this.drawParkedBoards(ctx, camX, t);
      }
      this.drawCorridors(ctx, camX, t, L);
      if (this.lvl.drops.length) this.drawHoles(ctx, camX, t, L);
      if (this.lvl.boss) this.drawKing(ctx, camX, t, G, L);
      if (this.theme.lanes) {
        // far-lane objects, then the player and the near-lane objects in the order their depth calls for —
        // so a far-lane car sits behind the player when he's in the near lane, and in front of him when
        // he's the one in the far lane (see drawObjects' laneFilter and the comment on LANE_DY above).
        // During a swing, Vippe is drawn separately below (via the 3D projection) instead.
        const laneP = (here && G.s && G.s.laneP) || 0;
        this.drawObjects(ctx, camX, t, G, L, 1);
        this.drawTexts(ctx, camX, G, L);
        if (laneP < 0.5) {
          if (here && G.state !== 'menu' && !swingZone) this.drawPlayer(ctx, camX, G, t);
          this.drawObjects(ctx, camX, t, G, L, 0);
        } else {
          this.drawObjects(ctx, camX, t, G, L, 0);
          if (here && G.state !== 'menu' && !swingZone) this.drawPlayer(ctx, camX, G, t);
        }
        this.drawSpeedFX(ctx, camX, t, px);
      } else {
        this.drawObjects(ctx, camX, t, G, L);
        this.drawTexts(ctx, camX, G, L);
        if (here && G.state !== 'menu') this.drawPlayer(ctx, camX, G, t);
      }
    }
    ctx.restore();

    if (swingZone) {
      if (threeDAlpha > 0.015) {
        ctx.save();
        ctx.globalAlpha = threeDAlpha;
        this.drawSwingScene(ctx, swingTheta, sky);
        ctx.restore();
      }
      if (here && G.state !== 'menu') this.drawSwingPlayer(ctx, G, t, swingTheta);
    }
    if (!swingZone) this.drawParticles(ctx, camX, G, L); // particles are fine to hide during the swing
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
      } else if (f.t === 'villa') {
        // a small pale gabled villa, further back than the terraced house row (Stratusvägen). Pale early
        // (readable behind the grey terrace, like the photos), sinking to a plain silhouette once it's
        // properly dark — same blend the apartment block below uses.
        const w = (f.w || 1.3) * BS * 0.55, h = (f.h || 1.4) * 34;
        const villaCol = U.mixHex('#d8d4c8', farDark, U.clamp(sky.dark * 1.6, 0, 1));
        ctx.fillStyle = villaCol;
        ctx.fillRect(x - w / 2, base - h, w, h);
        ctx.beginPath();
        ctx.moveTo(x - w / 2 - 4, base - h);
        ctx.lineTo(x, base - h - h * 0.55);
        ctx.lineTo(x + w / 2 + 4, base - h);
        ctx.closePath();
        ctx.fill();
        if (lit) {
          ctx.fillStyle = 'rgba(255,214,130,0.65)';
          const r = U.rng(f.seed || Math.floor(f.u * 131));
          if (r() > 0.35) ctx.fillRect(x - w * 0.24, base - h * 0.55, w * 0.16, h * 0.16);
          if (r() > 0.45) ctx.fillRect(x + w * 0.08, base - h * 0.55, w * 0.16, h * 0.16);
        }
        ctx.fillStyle = farDark;
      } else if (f.t === 'apartblock') {
        // the larger apartment block in the background (Stratusvägen) — a separate type from 'bldg' (used
        // by other levels' skylines) so only this theme gets the paler, more-visible dusk tint
        const w = (f.w || 2.8) * BS * 0.7, h = (f.h || 3.2) * 30;
        const col = U.mixHex('#c7c3ba', farDark, U.clamp(sky.dark * 1.5, 0, 1));
        ctx.fillStyle = col;
        ctx.fillRect(x - w / 2, base - h, w, h + 6);
        if (lit) {
          ctx.fillStyle = 'rgba(255,214,130,0.85)';
          const r = U.rng(f.seed || Math.floor(f.u * 97));
          for (let yy = base - h + 8; yy < base - 8; yy += 11) for (let xx = x - w / 2 + 5; xx < x + w / 2 - 5; xx += 10) if (r() > 0.55) ctx.fillRect(xx, yy, 4, 5);
        }
        ctx.fillStyle = farDark;
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
      } else if (f.t === 'reefbg') {
        // a low bump of distant coral / rock, rounded rather than pointed like the treelines
        const w = f.w * 46, h = f.h * 40;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.55, base);
        ctx.quadraticCurveTo(x - w * 0.4, base - h, x, base - h * 1.08);
        ctx.quadraticCurveTo(x + w * 0.4, base - h, x + w * 0.55, base);
        ctx.closePath();
        ctx.fill();
      } else if (f.t === 'castlesil') {
        // a distant castle silhouette: a keep with battlements and two corner towers
        const w = f.w * 50, h = f.h * 46;
        ctx.fillRect(x - w / 2, base - h, w, h + 6);
        const merlon = w / 6;
        for (let k = 0; k < 6; k += 2) ctx.fillRect(x - w / 2 + k * merlon, base - h - 10, merlon, 10);
        for (const dx of [-w / 2 - 4, w / 2 - 8]) {
          ctx.fillRect(x + dx, base - h - 18, 12, h * 0.5 + 18);
          ctx.beginPath();
          ctx.moveTo(x + dx - 3, base - h - 18);
          ctx.lineTo(x + dx + 6, base - h - 36);
          ctx.lineTo(x + dx + 15, base - h - 18);
          ctx.fill();
        }
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
      else if (m.t === 'kelp1') Art.kelpSilhouette(ctx, x, mb + 2, m.d.h);
      else if (Art.mid[m.t]) Art.mid[m.t](ctx, x, mb + 2, m.d, t, FONT);
    }
    // light haze pushes the scenery back behind the gameplay layer
    ctx.fillStyle = U.rgba(sky.bot, 0.16);
    ctx.fillRect(0, 0, W, GY);
    if (th.flocks) this.drawFlocks(ctx, camX, t, sky);
    if (th.fish) this.drawFishSchool(ctx, camX, t, sky);
    if (th.bats) this.drawBats(ctx, camX, t, sky);
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
  // small schools of fish drifting through the ocean background, in place of the forest's bird flocks
  R.drawFishSchool = function (ctx, camX, t, sky) {
    ctx.fillStyle = U.rgba(U.mixHex('#1a3a42', sky.bot, 0.4), 0.75);
    for (const f of this.fishSchools) {
      const span = W + 500;
      const x0 = (((t * f.sp + f.o) * span - camX * 3) % span + span) % span - 250;
      for (let i = 0; i < f.n; i++) {
        const row = Math.ceil(i / 2), side = i % 2 ? -1 : 1;
        const bx = x0 - row * 20 * f.s, by = f.y + row * 14 * f.s * side + Math.sin(t * 1.1 + i) * 4;
        const wig = Math.sin(t * 8 + i * 1.4 + f.o * 10) * 4 * f.s;
        const len = 11 * f.s;
        ctx.beginPath();
        ctx.moveTo(bx - len, by);
        ctx.quadraticCurveTo(bx - len * 0.3, by - len * 0.32, bx + len * 0.35, by);
        ctx.quadraticCurveTo(bx - len * 0.3, by + len * 0.32, bx - len, by);
        ctx.closePath();
        ctx.fill();
        // tail flicking side to side
        ctx.beginPath();
        ctx.moveTo(bx - len, by);
        ctx.lineTo(bx - len * 1.5, by - len * 0.3 + wig);
        ctx.lineTo(bx - len * 1.5, by + len * 0.3 + wig);
        ctx.closePath();
        ctx.fill();
      }
    }
  };
  // a couple of small bat silhouettes flapping across the Halloween dusk sky (Stratusvägen only)
  R.drawBats = function (ctx, camX, t, sky) {
    ctx.fillStyle = U.rgba('#100a18', 0.75 * U.clamp(sky.dark * 1.6, 0.25, 1));
    for (const bt of this.bats) {
      const span = W + 400;
      const x0 = (((t * bt.sp + bt.o) * span - camX * 2) % span + span) % span - 200;
      const y = bt.y + Math.sin(t * 0.9 + bt.o * 8) * 14;
      const flap = Math.sin(t * 11 + bt.o * 6) * 0.8 + 0.2;
      const s = 9 * bt.s;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(x0 - s * 1.6, y - s * flap, x0 - s * 2.6, y + s * 0.3);
      ctx.quadraticCurveTo(x0 - s * 1.3, y + s * 0.15, x0, y + s * 0.35);
      ctx.quadraticCurveTo(x0 + s * 1.3, y + s * 0.15, x0 + s * 2.6, y + s * 0.3);
      ctx.quadraticCurveTo(x0 + s * 1.6, y - s * flap, x0, y);
      ctx.fill();
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
    const base = { meadow: '#7dbb4e', golden: '#b6b25a', park: '#7a9a5a', farm: '#8ba55a', lawn: '#6f9f52', forest: '#3f6b34', bog: '#7b8a55', glade: '#86c05a', plaza: '#a19d93', graves: '#332b22', fairground: '#5f3f2e',
      lagoon: '#0e5a68', wrecked: '#0a4048', openwater: '#083048', trench: '#04101c', shore: '#0e6a70', checker: '#241f38' }[style] || '#7dbb4e';
    ctx.fillStyle = T(base);
    ctx.fillRect(x0, mb - 6, w, GY - mb + 10);
    if (style === 'lagoon' || style === 'wrecked' || style === 'openwater' || style === 'trench' || style === 'shore') {
      // rising bubbles drifting up through the underwater background band
      ctx.fillStyle = 'rgba(210,250,255,0.4)';
      for (let x = gridStart(x0, offM * BS, 34); x < x1; x += 34) {
        const i = Math.round((x + offM * BS) / 34);
        const bob = (t * 14 + i * 37) % 60;
        ctx.beginPath();
        ctx.arc(x + ((i * 11) % 20), mb + 4 - bob, 1.6 + Math.abs(i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
    } else if (style === 'checker') {
      // the giant chessboard itself, receding toward the horizon: several rows of a real (file x rank)
      // checkerboard, each row taller and wider than the last (a simple perspective), scrolling with
      // the mid-layer parallax
      const rowHs = [3, 4, 5, 7, 9];
      const rowWs = [14, 18, 24, 32, 44];
      let rowY = mb - 6;
      for (let r = 0; r < rowHs.length; r++) {
        const rh = rowHs[r], cw = rowWs[r];
        const start = gridStart(x0, offM * BS, cw) - cw;
        for (let x = start; x < x1 + cw; x += cw) {
          const i = Math.round((x + offM * BS) / cw);
          ctx.fillStyle = T((i + r) & 1 ? '#d8d4c8' : '#332c46');
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + cw);
          if (a1 > a0) ctx.fillRect(a0, rowY, a1 - a0, rh);
        }
        rowY += rh;
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

  // ------------------------------------------------------------------ inside the whale (level 4, ocean)
  R.drawWhale = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#1c0509');
    g.addColorStop(1, '#3a1018');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    // the fleshy wall breathing slowly in and out
    const breathe = Math.sin(t * 0.6) * 6;
    for (let layer = 0; layer < 2; layer++) {
      const off = camX * BS * (0.3 + layer * 0.25), step = 150 - layer * 26;
      ctx.fillStyle = layer ? '#4a1620' : '#33101a';
      const start = -((off % step) + step) % step - step;
      for (let x = start; x < W + step; x += step) {
        const i = Math.floor((x + off) / step);
        const h = 100 + U.hash(i * 1.7 + layer * 9) * 150 + breathe;
        ctx.beginPath();
        ctx.moveTo(x - step * 0.2, GY);
        ctx.quadraticCurveTo(x + step * 0.1, GY - h, x + step * 0.5, GY - h * (0.9 + 0.1 * U.hash(i)));
        ctx.quadraticCurveTo(x + step * 0.9, GY - h, x + step * 1.2, GY);
        ctx.fill();
        // an arching rib hanging from the roof
        const hh = 50 + U.hash(i * 2.3 + layer) * 100 + breathe;
        ctx.fillStyle = '#e8d8c4';
        ctx.beginPath();
        ctx.moveTo(x + step * 0.12, 0);
        ctx.quadraticCurveTo(x + step * 0.3, hh, x + step * 0.5, hh * 1.08);
        ctx.quadraticCurveTo(x + step * 0.7, hh, x + step * 0.88, 0);
        ctx.lineTo(x + step * 0.78, 0);
        ctx.quadraticCurveTo(x + step * 0.62, hh * 0.8, x + step * 0.5, hh * 0.86);
        ctx.quadraticCurveTo(x + step * 0.38, hh * 0.8, x + step * 0.22, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = layer ? '#4a1620' : '#33101a';
      }
    }
    // bioluminescent motes drifting in the throat
    for (let i = 0; i < 36; i++) {
      const x = ((U.hash(i * 5.1) * W * 1.5 - camX * BS * 0.45) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
      const y = 30 + U.hash(i * 2.9) * 420;
      ctx.fillStyle = 'rgba(140,255,210,' + (0.3 + 0.35 * Math.sin(t * 2 + i)) + ')';
      ctx.fillRect(x, y, 2.5, 2.5);
    }
    // a slow pulse of red light, like a heartbeat felt from inside
    const pulse = Math.max(0, Math.sin(t * 1.1)) * 0.12;
    if (pulse > 0.01) {
      ctx.fillStyle = 'rgba(180,20,40,' + pulse + ')';
      ctx.fillRect(0, 0, W, GY);
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

  // ------------------------------------------------------------------ inside the rook tower (level 4 "Schackmatt")
  R.drawRooktower = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#241a30');
    g.addColorStop(1, '#3a2a44');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.42, step = 160;
    const start = gridStart(0, off, step) - step;
    for (let x = start; x < W + step; x += step) {
      const i = Math.round((x + off) / step);
      ctx.fillStyle = i & 1 ? '#3a2f42' : '#332838';
      ctx.fillRect(x, 0, step, GY + 4);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      for (let r = 0; r < 8; r++) ctx.strokeRect(x + 4, 20 + r * 70, step - 8, 68);
      // an arrow slit with a sliver of the twilight sky showing through
      const sg = ctx.createLinearGradient(0, 60, 0, 340);
      sg.addColorStop(0, '#caa8e8');
      sg.addColorStop(1, '#5a3a78');
      ctx.fillStyle = sg;
      ctx.fillRect(x + step * 0.42, 70, step * 0.16, 260);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + step * 0.38, 60, step * 0.06, 280);
      ctx.fillRect(x + step * 0.56, 60, step * 0.06, 280);
      // a flickering torch bracket
      const tx = x + step - 14, ty = 150;
      const flick = 0.7 + 0.3 * Math.sin(t * 11 + i * 3);
      const fg = ctx.createRadialGradient(tx, ty, 2, tx, ty, 60);
      fg.addColorStop(0, 'rgba(255,190,90,' + (0.5 * flick).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(tx - 60, ty - 60, 120, 120);
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(tx - 3, ty, 6, 20);
      ctx.fillStyle = '#ffcf6a';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 6 * flick, 5, 9 * flick, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ------------------------------------------------------------------ inside the bishop's cathedral (level 4 "Schackmatt")
  R.drawCathedral = function (ctx, camX, t) {
    const g = ctx.createLinearGradient(0, 0, 0, GY);
    g.addColorStop(0, '#1c1030');
    g.addColorStop(1, '#341c46');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GY + 4);
    const off = camX * BS * 0.5, step = 180;
    const start = gridStart(0, off, step) - step;
    const glass = ['#6a1ea8', '#c9a227', '#1e6a9a', '#8a1050'];
    for (let x = start; x < W + step; x += step) {
      const i = Math.round((x + off) / step);
      const wx = x + step * 0.5, ww = 64, wtop = 55, wh = 220;
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
        ctx.fillStyle = cols[p];
        ctx.fillRect(wx - ww / 2 + (p * ww) / 3, wtop - 10, ww / 3, wh + 20);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      for (let yy = wtop; yy < wtop + wh; yy += 26) {
        ctx.beginPath();
        ctx.moveTo(wx - ww / 2, yy);
        ctx.lineTo(wx + ww / 2, yy + 13);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#100a18';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(wx - ww / 2, wtop + wh);
      ctx.lineTo(wx - ww / 2, wtop + ww / 2);
      ctx.arc(wx, wtop + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww / 2, wtop + wh);
      ctx.stroke();
      // the pillar beside it
      ctx.fillStyle = '#241830';
      ctx.fillRect(x + step - 30, 10, 28, GY - 10);
      ctx.fillStyle = '#3a2848';
      ctx.fillRect(x + step - 26, 10, 6, GY - 10);
    }
    // vaulted arches along the top
    ctx.fillStyle = '#180e26';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-10, 60);
    for (let x = start; x < W + step; x += step) ctx.quadraticCurveTo(x + step * 0.5, 8, x + step, 60);
    ctx.lineTo(W + 10, 0);
    ctx.closePath();
    ctx.fill();
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
      } else if (st === 'seabed') {
        // sandy sea floor with coral rubble, darkening automatically with the ambient light (Art.TL)
        ctx.fillStyle = T('#0e3a44');
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        for (let i = Math.floor(camX + x0 / BS); i <= Math.ceil(camX + x1 / BS); i++) {
          if (i & 1) continue;
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 > a0) ctx.fillRect(a0, GY + 36, a1 - a0, BS);
        }
        // rubble + rocks
        ctx.fillStyle = T('#3a6a5c');
        for (let i = Math.floor(camX / 3 + x0 / 144) - 1; i <= Math.ceil(camX / 3 + x1 / 144); i++) {
          const x = i * 144 - camX * BS + ((i * 53) % 60);
          if (x < x0 - 30 || x > x1) continue;
          Art.rr(ctx, x, GY + 24 + ((i * 17) % 60), 22, 7, 3);
          ctx.fill();
        }
        ctx.fillStyle = T('#1f7a68');
        ctx.fillRect(x0, GY, x1 - x0, 12);
        ctx.fillStyle = T('#3fd0a8');
        ctx.fillRect(x0, GY, x1 - x0, 4);
        // little tufts of sand-grass / coral polyps along the edge
        ctx.fillStyle = T('#1f7a68');
        for (let i = Math.floor(camX * 4 + x0 / 12); i <= Math.ceil(camX * 4 + x1 / 12); i++) {
          const x = i * 12 - camX * BS;
          if (x >= x0 && x + 6 <= x1) {
            ctx.beginPath();
            ctx.ellipse(x + 3, GY + 12, 5, 3 + ((i * 7) & 3), 0, 0, Math.PI);
            ctx.fill();
          }
        }
      } else if (st === 'ribcage') {
        // the floor of the whale's belly: pale bone ribs curving up out of dark flesh
        ctx.fillStyle = '#2a0e14';
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = '#e8d8c4';
        for (let i = Math.floor(camX * 2 + x0 / 30) - 1; i <= Math.ceil(camX * 2 + x1 / 30); i++) {
          const x = i * 30 - camX * BS;
          if (x + 10 < x0 || x > x1) continue;
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + 12);
          if (a1 > a0) {
            ctx.beginPath();
            ctx.ellipse((a0 + a1) / 2, GY + 8, (a1 - a0) / 2, 14, 0, Math.PI, 0);
            ctx.fill();
          }
        }
        ctx.fillStyle = '#6e2230';
        ctx.fillRect(x0, GY, x1 - x0, 5);
        ctx.fillStyle = 'rgba(255,120,150,0.4)';
        ctx.fillRect(x0, GY, x1 - x0, 2);
      } else if (st === 'shallows') {
        // bright sandy shallows near the surface
        ctx.fillStyle = T('#d8c48a');
        ctx.fillRect(x0, GY, x1 - x0, H - GY);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        for (let i = Math.floor(camX + x0 / BS); i <= Math.ceil(camX + x1 / BS); i++) {
          if (i & 1) continue;
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 > a0) ctx.fillRect(a0, GY + 36, a1 - a0, BS);
        }
        ctx.fillStyle = T('#4fd8c8');
        ctx.fillRect(x0, GY, x1 - x0, 12);
        ctx.fillStyle = T('#c9fff0');
        ctx.fillRect(x0, GY, x1 - x0, 4);
        ctx.fillStyle = T('#e8dca0');
        for (let i = Math.floor(camX * 4 + x0 / 12); i <= Math.ceil(camX * 4 + x1 / 12); i++) {
          const x = i * 12 - camX * BS;
          if (x >= x0 && x + 5 <= x1) ctx.fillRect(x, GY + 14, 5, 4 + ((i * 7) & 3));
        }
      } else if (st === 'board') {
        // the giant marble chessboard: a real (file x rank) checkerboard of several rows, then a solid
        // dark marble slab underneath filling all the way down to the bottom of the screen
        const rows = 3, rowH = 27;
        for (let i = Math.floor(camX + x0 / BS) - 1; i <= Math.ceil(camX + x1 / BS); i++) {
          const x = (i - camX) * BS, a0 = Math.max(x0, x), a1 = Math.min(x1, x + BS);
          if (a1 <= a0) continue;
          for (let r = 0; r < rows; r++) {
            const light = !!((i + r) & 1);
            ctx.fillStyle = T(light ? '#e8e4da' : '#19141f');
            ctx.fillRect(a0, GY + r * rowH, a1 - a0, rowH);
            ctx.fillStyle = light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.04)';
            ctx.fillRect(a0, GY + r * rowH, a1 - a0, rowH * 0.3);
          }
        }
        // row seams
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        for (let r = 1; r < rows; r++) ctx.fillRect(x0, GY + r * rowH - 2, x1 - x0, 3);
        // the marble slab edge, filling down to the bottom of the screen
        const slabY = GY + rows * rowH;
        const sg = ctx.createLinearGradient(0, slabY, 0, H);
        sg.addColorStop(0, T('#2e2838'));
        sg.addColorStop(1, T('#0e0c14'));
        ctx.fillStyle = sg;
        ctx.fillRect(x0, slabY, x1 - x0, H - slabY);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x0, slabY, x1 - x0, 3);
        // gold inlay borders (top of the board, and the board-to-slab seam)
        ctx.fillStyle = T('#e8c85a');
        ctx.fillRect(x0, GY, x1 - x0, 3);
        ctx.fillStyle = 'rgba(232,200,90,0.35)';
        ctx.fillRect(x0, slabY, x1 - x0, 2);
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
      } else if (c.style === 'jelly') {
        // a canopy of drifting jellyfish bells, glowing softly overhead
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, Art.T('#062028'));
        g.addColorStop(1, Art.T('#0f3a44'));
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        for (let x = gridStart(x0, camX * BS, 46); x < x1 + 46; x += 46) {
          const i = Math.round((x + camX * BS) / 46);
          const bob = Math.sin(t * 1.4 + i) * 4;
          const bx = U.clamp(x + 23, x0, x1), by = y - 8 + bob;
          ctx.fillStyle = 'rgba(160,230,255,0.3)';
          ctx.beginPath();
          ctx.ellipse(bx, by, 16, 10, 0, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = 'rgba(200,245,255,0.5)';
          ctx.lineWidth = 1.5;
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(bx + k * 5, by);
            ctx.lineTo(bx + k * 5 + Math.sin(t * 2 + i + k) * 3, by + 16 + Math.abs(k) * 2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(150,240,255,0.4)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      } else if (c.style === 'rib') {
        // the inside of the whale's throat: pale arching ribs against dark red flesh
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#170408');
        g.addColorStop(1, '#3a1018');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = '#e8d8c4';
        for (let x = gridStart(x0, camX * BS, 40); x < x1 + 40; x += 40) {
          const i = Math.round((x + camX * BS) / 40);
          const len = y - (6 + ((i * 13) % 10));
          ctx.beginPath();
          ctx.moveTo(U.clamp(x + 4, x0, x1), 0);
          ctx.quadraticCurveTo(U.clamp(x + 14, x0, x1), len * 0.5, U.clamp(x + 20, x0, x1), len);
          ctx.quadraticCurveTo(U.clamp(x + 26, x0, x1), len * 0.5, U.clamp(x + 36, x0, x1), 0);
          ctx.lineTo(U.clamp(x + 30, x0, x1), 0);
          ctx.quadraticCurveTo(U.clamp(x + 24, x0, x1), len * 0.4, U.clamp(x + 20, x0, x1), len * 0.5);
          ctx.quadraticCurveTo(U.clamp(x + 16, x0, x1), len * 0.4, U.clamp(x + 10, x0, x1), 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,120,150,0.45)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      } else if (c.style === 'rooktower') {
        // the underside of the rook tower's stone ceiling, with square battlement notches
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#120c1a');
        g.addColorStop(1, '#3a2c46');
        ctx.fillStyle = g;
        ctx.fillRect(x0, 0, x1 - x0, y);
        ctx.fillStyle = '#241a30';
        const step2 = 44;
        for (let x = gridStart(x0, camX * BS, step2); x < x1; x += step2) {
          const a0 = Math.max(x0, x), a1 = Math.min(x1, x + step2 * 0.6);
          if (a1 > a0) ctx.fillRect(a0, y - 14, a1 - a0, 14);
        }
        ctx.fillStyle = '#4a3a5a';
        ctx.fillRect(x0, y - 4, x1 - x0, 4);
        ctx.fillStyle = 'rgba(232,200,90,0.4)';
        ctx.fillRect(x0, y - 2, x1 - x0, 2);
      } else if (c.style === 'cathedral') {
        // a stone groin-vault ceiling over the bishop's hall, tinted purple and gold
        const g = ctx.createLinearGradient(0, 0, 0, y);
        g.addColorStop(0, '#140a20');
        g.addColorStop(1, '#3a1c46');
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
        ctx.fillStyle = '#1c1028';
        ctx.fillRect(x0, y - 4, x1 - x0, 4);
        ctx.fillStyle = 'rgba(232,200,90,0.4)';
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

  // ------------------------------------------------------------------ level 4 "Schackmatt": the king boss
  // He is scenery only (no collision): a big chess king standing VD.KING_AHEAD blocks ahead of the player
  // for the whole boss span, sliding in at x0 and toppling over once you reach x1 (the finish).
  R.drawKing = function (ctx, camX, t, G, L) {
    const boss = this.lvl.boss;
    if (!boss || (G.s && (G.s.layer || 0) !== L)) return;
    const px = G.s ? G.s.x : camX + PX;
    const ahead = VD.KING_AHEAD || 15;
    if (px < boss.x0 - 3 || px > boss.x1 + 8) return;
    const slideIn = U.smooth(U.clamp((px - (boss.x0 - 3)) / 5, 0, 1));
    const toppled = U.clamp((px - boss.x1) / 4, 0, 1);
    const bx = px + ahead + (1 - slideIn) * 6;
    // the arm swings in time with whichever pawn is currently mid-throw, if any
    let armK = null;
    for (const o of this.lvl.objs) {
      if (o.kind !== 'pawn') continue;
      const t0 = o.x - o.mv.trigger, t1 = t0 + o.mv.fall;
      if (px >= t0 - 1 && px <= t1 + 1) {
        armK = VD.Physics.moveOf(o, px, this.lvl).k;
        break;
      }
    }
    ctx.save();
    ctx.globalAlpha = slideIn;
    Art.king(ctx, sx(bx, camX), sy(0), BS, t, toppled, armK);
    ctx.restore();
  };

  // ------------------------------------------------------------------ Stratusvägen: the two-lane street
  // Screen geometry (see the module comment on LANE_DY above): the near lane sits at screen y = GY, the far
  // lane LANE_DY blocks "higher" (further away). FAR_KERB/NEAR_KERB give a little extra room behind/in front
  // of the two lanes for the sidewalks, so houses and foreground props have somewhere to stand.
  const FAR_SIDEWALK_H = 34, FAR_KERB_GAP = 34, NEAR_KERB_GAP = 46;
  R.roadFarY = function () { return GY - LANE_DY * BS; };
  R.roadFarKerbY = function () { return this.roadFarY() - FAR_KERB_GAP; };
  R.roadNearKerbY = function () { return GY + NEAR_KERB_GAP; };
  // ---- sprite cache: performance ----------------------------------------------------------------
  // The street's houses/terraces/filler scenery are each complex (dozens of canvas calls: cladding lines,
  // a gable, two floors of windows, a fence, a car, ...) but otherwise static — the only thing that ever
  // changes is the ambient dusk tint (Art.TL/Art.T, driven by Art.dark()). So each unique sprite is drawn
  // once per "tint bucket" into an offscreen canvas and reused with cheap drawImage() calls afterwards,
  // instead of replaying its whole draw call graph every single frame. Art.dark() only takes a handful of
  // distinct values as the player crosses the level, so this stays small in practice (bucketed to 8 steps).
  R.getSprite = function (key, w, h, drawFn) {
    if (!this.spriteCache) this.spriteCache = new Map();
    const bucket = Math.floor(Art.dark() * 8);
    const fullKey = key + '#' + bucket;
    let cv = this.spriteCache.get(fullKey);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w));
      cv.height = Math.max(1, Math.ceil(h));
      drawFn(cv.getContext('2d'));
      this.spriteCache.set(fullKey, cv);
    }
    return cv;
  };
  // same idea as getSprite, but for a small repeating texture (paving joints, leaves): cache a CanvasPattern
  // once and reuse it, instead of stroking/filling dozens of tiny shapes across the screen every frame
  R.getPattern = function (ctx, key, tileW, tileH, drawFn) {
    if (!this.patternCache) this.patternCache = new Map();
    let p = this.patternCache.get(key);
    if (!p) {
      const cv = document.createElement('canvas');
      cv.width = tileW;
      cv.height = tileH;
      drawFn(cv.getContext('2d'));
      p = ctx.createPattern(cv, 'repeat');
      this.patternCache.set(key, p);
    }
    return p;
  };
  // a subtle paving-stone grid on the far sidewalk, world-aligned so it scrolls with the street — reads as
  // pavement instead of a flat wall of colour
  // a small paving-stone joint pattern, tiled — cached as a CanvasPattern (see getPattern below) instead
  // of stroking ~50 lines every frame
  function paintSidewalkTile(cctx, tile, h) {
    cctx.strokeStyle = 'rgba(0,0,0,0.14)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(0, 0);
    cctx.lineTo(0, h);
    cctx.moveTo(0, h / 2);
    cctx.lineTo(tile, h / 2);
    cctx.stroke();
    cctx.strokeStyle = 'rgba(255,255,255,0.05)';
    cctx.beginPath();
    cctx.moveTo(tile / 2, 0);
    cctx.lineTo(tile / 2, h / 2);
    cctx.stroke();
  }
  // a handful of scattered autumn leaves, tiled the same way
  function paintLeavesTile(cctx, tileW, tileH) {
    cctx.fillStyle = 'rgba(200,120,40,0.35)';
    const rnd = U.rng(77);
    for (let i = 0; i < 8; i++) {
      const lx = rnd() * tileW, ly = 6 + rnd() * Math.max(1, tileH - 12);
      cctx.beginPath();
      cctx.ellipse(lx, ly, 3.2, 2, rnd() * TAU, 0, TAU);
      cctx.fill();
    }
  }
  R.drawLaneRoad = function (ctx, camX, t) {
    const farY = this.roadFarY(), nearY = GY;
    const farKerbY = this.roadFarKerbY(), nearKerbY = this.roadNearKerbY();
    const midY = (farY + nearY) / 2;

    // far sidewalk, right in front of the far house row — paving stones, not a flat wall
    ctx.fillStyle = Art.TL('#4e4b53');
    ctx.fillRect(0, farKerbY - FAR_SIDEWALK_H, W, FAR_SIDEWALK_H);
    const swTile = 22;
    const swShift = -((((camX * BS) % swTile) + swTile) % swTile);
    ctx.save();
    ctx.translate(swShift, farKerbY - FAR_SIDEWALK_H);
    ctx.fillStyle = this.getPattern(ctx, 'sidewalk', swTile, FAR_SIDEWALK_H, (cctx) => paintSidewalkTile(cctx, swTile, FAR_SIDEWALK_H));
    ctx.fillRect(0, 0, W - swShift + swTile, FAR_SIDEWALK_H);
    ctx.restore();
    ctx.fillStyle = 'rgba(226,226,232,0.5)';
    ctx.fillRect(0, farKerbY - 3, W, 3);

    // asphalt: a soft vertical gradient (far edge a touch lighter — cheap atmospheric perspective) plus a
    // dashed white centre line at the lane midline
    const rg = ctx.createLinearGradient(0, farKerbY, 0, nearKerbY);
    rg.addColorStop(0, Art.TL('#403d48'));
    rg.addColorStop(1, Art.TL('#201e26'));
    ctx.fillStyle = rg;
    ctx.fillRect(0, farKerbY, W, nearKerbY - farKerbY);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    const dashW = 22, gap = 20, period = dashW + gap;
    for (let x = gridStart(0, camX * BS, period); x < W; x += period) ctx.fillRect(x, midY - 2, dashW, 4);

    // near kerb + the foreground pavement strip (mailboxes/props land on this, see drawHouses)
    ctx.fillStyle = 'rgba(226,226,232,0.55)';
    ctx.fillRect(0, nearKerbY, W, 3);
    ctx.fillStyle = Art.TL('#232128');
    ctx.fillRect(0, nearKerbY + 3, W, H - nearKerbY - 3);
    // a few scattered autumn leaves on the near pavement, world-aligned so they scroll with the street
    const leafTileW = 192, leafTileH = H - nearKerbY - 3;
    const leafShift = -((((camX * BS) % leafTileW) + leafTileW) % leafTileW);
    ctx.save();
    ctx.translate(leafShift, nearKerbY + 3);
    ctx.fillStyle = this.getPattern(ctx, 'leaves', leafTileW, leafTileH, (cctx) => paintLeavesTile(cctx, leafTileW, leafTileH));
    ctx.fillRect(0, 0, W - leafShift + leafTileW, leafTileH);
    ctx.restore();
  };
  // a low, flat black rubber strip lying ON the road surface — a shallow parallelogram (like a zebra-
  // crossing stripe seen at a slight angle), only ~0.2-0.25 blocks of visible thickness at its front edge,
  // with yellow reflector dashes. Drawn once per lane (near + far — see drawBump below): the game's lane
  // trick already puts the far lane a fixed distance higher on screen than the near lane, so one bump mark
  // per lane reads as "a flat strip in each lane" rather than one tall connector standing up between them.
  R.paintBumpMark = function (cctx, cx, groundY, w, thickness) {
    const skew = w * 0.22; // a slight lean, so the strip reads as angled/foreshortened, not a plain block
    cctx.fillStyle = '#15141a';
    cctx.beginPath();
    cctx.moveTo(cx - w / 2, groundY);
    cctx.lineTo(cx + w / 2, groundY);
    cctx.lineTo(cx + w / 2 - skew, groundY - thickness);
    cctx.lineTo(cx - w / 2 - skew, groundY - thickness);
    cctx.closePath();
    cctx.fill();
    cctx.strokeStyle = 'rgba(255,255,255,0.1)';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(cx - w / 2 - skew, groundY - thickness);
    cctx.lineTo(cx + w / 2 - skew, groundY - thickness);
    cctx.stroke();
    cctx.fillStyle = '#e8c23c';
    for (let p = 0.14; p <= 0.9; p += 0.24) {
      const bx = cx - w / 2 + w * p - skew * 0.5;
      cctx.fillRect(bx - 3.5, groundY - thickness + 1.5, 7, thickness - 3);
    }
  };
  // spans both lanes: one flat mark at the near lane's ground line, one (a touch smaller, matching the
  // far lane's own scale) at the far lane's — see paintBumpMark above. Cached: every bump in the level is
  // the same shape (o.w is always 1), so one sprite is reused everywhere.
  R.drawBump = function (ctx, camX, o) {
    const farY = this.roadFarY(), nearY = GY;
    const cx2 = sx(o.x + o.w / 2, camX);
    const thickness = BS * 0.22, nearW = o.w * BS * 0.85, farW = nearW * LANE_SCALE;
    const w = Math.max(nearW, farW) + 24, h = thickness + 8;
    const key = 'bump';
    const nearCv = this.getSprite(key + '#near', w, h, (cctx) => this.paintBumpMark(cctx, w / 2, h - 4, nearW, thickness));
    const farCv = this.getSprite(key + '#far', w, h, (cctx) => this.paintBumpMark(cctx, w / 2, h - 4, farW, thickness));
    ctx.drawImage(farCv, cx2 - w / 2, farY - (h - 4));
    ctx.drawImage(nearCv, cx2 - w / 2, nearY - (h - 4));
  };

  // grey untreated wood, deterministic per house/unit seed so a given unit always looks the same
  const HOUSE_WOOD = ['#5c584f', '#66625a', '#58554d', '#6c675d', '#615d54'];
  // narrow, tall terraced units (taller than wide, very steep gable) — the real street is a continuous
  // saw-tooth row of these, not lone detached cottages (see the contact-sheet photos)
  const GABLE_W = 4.0, GABLE_BODY_H = 4.6, GABLE_ROOF_H = 3.0;
  // a gap this small or smaller between two numbered far-row houses reads as one attached terrace run,
  // bridged with unnumbered filler units of the same style; a bigger gap gets background streetscape instead
  const TERRACE_MAX = 34;
  // the known cul-de-sac gap in the plan (between nr 56 and nr 50, roughly x 380-470): show it as a short
  // side street receding into the distance, with 54/52 standing tiny and far back
  const CULDESAC_X = [370, 480];
  const FILLER_KINDS = ['shed', 'fence', 'garden', 'parking', 'carport', 'bin'];

  // one streetscape pass, computed once per level load (see R.build) and cached on this.streetProps — a
  // list of world-anchored props: the numbered houses, unnumbered terrace filler units that bridge close
  // gaps into one continuous row, and denser background scenery (sheds, fences, gardens, parking, one
  // playground, the cul-de-sac) filling the wider gaps so no long stretch of the street reads as empty
  function buildStreetscape(lvl) {
    const far = lvl.houses.filter((h) => h.row === 'far').slice().sort((a, b) => a.x - b.x);
    const props = [];
    function fillerRun(x0, x1, seedBase) {
      if (x1 - x0 < 6) return;
      let x = x0 + 3 + U.hash(seedBase) * 2;
      while (x < x1 - 3) {
        const seed = Math.floor(x * 13.7) + seedBase;
        props.push({ x, kind: FILLER_KINDS[Math.floor(U.hash(seed) * FILLER_KINDS.length)], seed, t: 'filler' });
        x += 6 + U.hash(seed + 1) * 3;
      }
    }
    if (far.length) fillerRun(-56, far[0].x - 5, 1);
    for (let i = 0; i < far.length; i++) {
      const h = far[i], prev = far[i - 1], next = far[i + 1];
      const attachLeft = !!prev && h.x - prev.x <= TERRACE_MAX;
      const attachRight = !!next && next.x - h.x <= TERRACE_MAX;
      props.push({ x: h.x, kind: 'house', num: h.num, t: 'house', attachLeft, attachRight });
      if (next) {
        const gap = next.x - h.x;
        if (gap <= TERRACE_MAX) {
          // bridge the gap with attached, unnumbered gable units — a continuous saw-tooth roofline
          const span = gap - GABLE_W, n = Math.max(1, Math.round(span / GABLE_W));
          const uw = span / n;
          for (let k = 0; k < n; k++) props.push({ x: h.x + GABLE_W / 2 + uw * (k + 0.5), w: uw, kind: 'terrace', t: 'terrace', seed: h.num * 31 + k });
        } else if (h.x >= CULDESAC_X[0] - 30 && next.x <= CULDESAC_X[1] + 110 && gap > 50 && gap < 160) {
          props.push({ x: (h.x + next.x) / 2, kind: 'culdesac', t: 'culdesac', seed: 54 });
        } else {
          fillerRun(h.x + 5, next.x - 5, h.num * 7 + 3);
        }
      }
    }
    if (far.length) fillerRun(far[far.length - 1].x + 5, lvl.finishX - 10, 91);
    // one small playground, tucked into a wide gap well clear of the cul-de-sac (the "toppen" stretch)
    for (let i = props.length - 1; i >= 0; i--) if (props[i].t === 'filler' && Math.abs(props[i].x - 776) < 5) props.splice(i, 1);
    props.push({ x: 776, kind: 'playground', t: 'filler', seed: 5 });
    props.sort((a, b) => a.x - b.x);
    return props;
  }
  // the shared body+roof+windows of one narrow gable unit — used for numbered houses, unnumbered terrace
  // filler and the tiny distant cul-de-sac houses alike, so the whole row reads as one consistent style.
  // Returns the unit's screen bounds so the caller can add a door/mailbox/fence around it.
  // the shared body+roof+door+windows of one narrow gable unit (uncached — see drawGableUnit below, the
  // cached wrapper every caller actually uses)
  R.paintGableUnit = function (ctx, cx, farKerbY, unitW, seed) {
    const rnd = U.rng(seed);
    // `b` scales every vertical/detail measurement with the requested width, relative to the standard
    // GABLE_W unit — so a deliberately narrower unit (the tiny cul-de-sac houses) comes out shorter too,
    // instead of a narrow but still full-height tower
    const b = BS * (unitW / GABLE_W);
    const bw = unitW * BS, bodyH = b * GABLE_BODY_H, roofH = b * GABLE_ROOF_H;
    const x0 = cx - bw / 2, bodyY = farKerbY - bodyH, roofY = bodyY - roofH;
    ctx.fillStyle = Art.TL(HOUSE_WOOD[Math.abs(seed) % HOUSE_WOOD.length]);
    ctx.fillRect(x0, bodyY, bw, bodyH);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let bx = x0 + 6; bx < x0 + bw; bx += Math.max(4, 9 * (unitW / GABLE_W))) {
      ctx.moveTo(bx, bodyY);
      ctx.lineTo(bx, farKerbY);
    }
    ctx.stroke();
    // steep gable roof, facing the street — a small overhang on every unit, even attached ones, so the
    // roofline still reads as gable-gable-gable rather than one flat ridge
    ctx.fillStyle = Art.TL('#2b2c32');
    ctx.beginPath();
    ctx.moveTo(x0 - b * 0.14, bodyY + b * 0.08);
    ctx.lineTo(cx, roofY);
    ctx.lineTo(x0 + bw + b * 0.14, bodyY + b * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // gable-end attic window
    const duskLit = Art.dark() > 0.22;
    const attic = duskLit && rnd() > 0.4;
    ctx.fillStyle = attic ? '#ffd27a' : Art.TL('#20222a');
    ctx.beginPath();
    ctx.arc(cx, bodyY - b * 0.26, b * 0.18, Math.PI, 0);
    ctx.lineTo(cx + b * 0.18, bodyY - b * 0.08);
    ctx.lineTo(cx - b * 0.18, bodyY - b * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // two floors of white-framed windows, some lit and some dark (one column on a narrow unit)
    const winW = Math.min(b * 0.58, bw * 0.3), winH = b * 0.7;
    const cols = bw > BS * 3.1 ? [x0 + bw * 0.18, x0 + bw * 0.58] : [x0 + bw * 0.5 - winW / 2];
    for (let floor = 0; floor < 2; floor++) {
      const wy = bodyY + b * 0.28 + floor * b * 1.5;
      for (const fx of cols) {
        const on = duskLit && rnd() > 0.35;
        ctx.fillStyle = on ? '#ffd27a' : Art.TL('#8fb0c8');
        ctx.fillRect(fx, wy, winW, winH);
        ctx.strokeStyle = '#f2f0e8';
        ctx.lineWidth = 3;
        ctx.strokeRect(fx, wy, winW, winH);
        ctx.beginPath();
        ctx.moveTo(fx + winW / 2, wy);
        ctx.lineTo(fx + winW / 2, wy + winH);
        ctx.stroke();
        if (floor === 1) {
          ctx.strokeStyle = '#e8e6dc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx - b * 0.06, wy + winH + 6);
          ctx.lineTo(fx + winW + b * 0.06, wy + winH + 6);
          for (let rx = fx - b * 0.04; rx <= fx + winW + b * 0.04; rx += b * 0.12) {
            ctx.moveTo(rx, wy + winH + 6);
            ctx.lineTo(rx, wy + winH + 15);
          }
          ctx.stroke();
        }
        // a paper ghost taped up in a dark window, on some units
        if (!on && rnd() < 0.2) {
          ctx.fillStyle = 'rgba(245,245,250,0.9)';
          ctx.beginPath();
          ctx.arc(fx + winW / 2, wy + winH * 0.42, winW * 0.34, Math.PI, 0);
          ctx.lineTo(fx + winW * 0.68, wy + winH * 0.72);
          ctx.lineTo(fx + winW / 2, wy + winH * 0.6);
          ctx.lineTo(fx + winW * 0.32, wy + winH * 0.72);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.arc(fx + winW * 0.42, wy + winH * 0.38, 1.6, 0, TAU);
          ctx.arc(fx + winW * 0.58, wy + winH * 0.38, 1.6, 0, TAU);
          ctx.fill();
        }
      }
    }
    // a front door, right in the middle of the ground floor — every unit has its own entrance, numbered
    // house or unnumbered terrace filler alike
    ctx.fillStyle = Art.TL('#2a2622');
    ctx.fillRect(cx - b * 0.22, farKerbY - b * 0.92, b * 0.44, b * 0.92);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - b * 0.22, farKerbY - b * 0.92, b * 0.44, b * 0.92);
    return { x0, bw, bodyY, bodyH, duskLit };
  };
  // cached: see the R.getSprite comment above. Draws into a local-space offscreen canvas once per (seed,
  // width, tint bucket) and blits it afterwards — replaces dozens of canvas calls with one drawImage().
  R.drawGableUnit = function (ctx, cx, farKerbY, unitW, seed) {
    const b = BS * (unitW / GABLE_W);
    const bw = unitW * BS, bodyH = b * GABLE_BODY_H, roofH = b * GABLE_ROOF_H;
    const padX = b * 0.3;
    const w = bw + padX * 2, h = bodyH + roofH + 3;
    const key = 'gable#' + seed + '#' + unitW.toFixed(3);
    const cv = this.getSprite(key, w, h, (cctx) => this.paintGableUnit(cctx, w / 2, h, unitW, seed));
    ctx.drawImage(cv, cx - w / 2, farKerbY - h);
    return { x0: cx - bw / 2, bw, bodyY: farKerbY - bodyH, bodyH, duskLit: Art.dark() > 0.22 };
  };
  // a small grass patch with a young autumn tree and a low bush, filling a non-attached house corner
  R.drawCornerGarden = function (ctx, edgeX, farKerbY, side, seed) {
    const rnd = U.rng(seed);
    const w = BS * 1.6, gx = side < 0 ? edgeX - w : edgeX;
    ctx.fillStyle = Art.TL('#3a5a2e');
    ctx.fillRect(gx, farKerbY - 10, w, 10);
    ctx.fillStyle = Art.TL('#4a7038');
    ctx.fillRect(gx, farKerbY - 12, w, 4);
    const tx = gx + w * 0.5, tyBase = farKerbY - 10;
    ctx.strokeStyle = Art.TL('#4a3524');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, tyBase);
    ctx.lineTo(tx, tyBase - BS * 0.7);
    ctx.stroke();
    const leafCol = ['#c98a2e', '#d9a52e', '#8a4a24'][Math.floor(rnd() * 3)];
    ctx.fillStyle = Art.TL(leafCol);
    ctx.beginPath();
    ctx.arc(tx, tyBase - BS * 0.95, BS * 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = Art.TL('#3f5a2a');
    ctx.beginPath();
    ctx.arc(tx + (side < 0 ? -BS * 0.55 : BS * 0.55), tyBase - BS * 0.16, BS * 0.22, 0, TAU);
    ctx.fill();
  };
  // a bike leaning at (bx0, by0) — its own rear wheel touching the ground there
  R.drawLeaningBike = function (ctx, bx0, by0) {
    ctx.strokeStyle = '#c9c9c9';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(bx0, by0, BS * 0.22, 0, TAU);
    ctx.arc(bx0 + BS * 0.5, by0, BS * 0.22, 0, TAU);
    ctx.moveTo(bx0, by0);
    ctx.lineTo(bx0 + BS * 0.25, by0 - BS * 0.32);
    ctx.lineTo(bx0 + BS * 0.5, by0);
    ctx.lineTo(bx0 + BS * 0.25, by0 - BS * 0.32);
    ctx.lineTo(bx0 + BS * 0.18, by0 - BS * 0.42);
    ctx.stroke();
  };
  // a numbered far-row terraced house: the gable unit, a door, a paving path + mailbox, and — only on a
  // side that isn't attached to a terrace neighbour — a fence/garden corner with a car or a bike, plus a
  // jack-o'-lantern by the door on about half the houses and a floorball goal by nr 50/48
  // one numbered far-row terraced house (uncached — see drawTerraceHouse below, the cached wrapper every
  // caller actually uses). Calls paintGableUnit directly (not the cached drawGableUnit) since we're
  // already rendering into an offscreen canvas once here — no need for a second, redundant cache entry.
  R.paintTerraceHouse = function (ctx, cx, farKerbY, num, t, attachLeft, attachRight) {
    const seed = num * 97 + 11, rnd = U.rng(seed);
    const g = this.paintGableUnit(ctx, cx, farKerbY, GABLE_W, seed);
    const freeSides = [];
    if (!attachLeft) freeSides.push(-1);
    if (!attachRight) freeSides.push(1);
    if (freeSides.length) {
      const side = freeSides[freeSides.length > 1 && rnd() < 0.5 ? 1 : 0];
      const edgeX = side < 0 ? g.x0 : g.x0 + g.bw;
      this.drawCornerGarden(ctx, edgeX, farKerbY, side, num * 3 + 1);
      const fenceX = side < 0 ? edgeX - BS * 1.9 : edgeX + BS * 0.9;
      ctx.fillStyle = Art.TL('#4f4c45');
      ctx.fillRect(fenceX, farKerbY - BS * 1.5, BS * 0.95, BS * 1.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px2 = fenceX + 5; px2 < fenceX + BS * 0.95; px2 += 7) {
        ctx.moveTo(px2, farKerbY - BS * 1.5);
        ctx.lineTo(px2, farKerbY);
      }
      ctx.stroke();
      if (rnd() < 0.35) drawCobweb(ctx, fenceX + (side < 0 ? 4 : BS * 0.9), farKerbY - BS * 1.45, side);
      if (rnd() < 0.55) {
        const cw = BS * 1.7, chh = BS * 0.72;
        Art.block(ctx, 'car', side < 0 ? fenceX - cw - BS * 0.15 : fenceX + BS * 1.05, farKerbY - chh, cw, chh, BS, num, t);
      } else if (rnd() < 0.35) {
        this.drawLeaningBike(ctx, fenceX + BS * (side < 0 ? -0.35 : 1.25), farKerbY - BS * 0.28);
      }
    }
    if (rnd() < 0.5) {
      const pb = BS * 0.5;
      if (VD.Stratus && VD.Stratus.pumpkin) VD.Stratus.pumpkin(ctx, cx + BS * 0.4, farKerbY - pb * 0.4, pb / BS, t, g.duskLit);
      else {
        ctx.fillStyle = '#e8731f';
        ctx.beginPath();
        ctx.ellipse(cx + BS * 0.4, farKerbY - pb * 0.4, pb * 0.5, pb * 0.42, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (num === 50 || num === 48) {
      const gx = g.x0 + g.bw + BS * 0.3, gw = BS * 1.1, gh = BS * 0.82;
      ctx.strokeStyle = '#e8e0c8';
      ctx.lineWidth = 3;
      ctx.strokeRect(gx, farKerbY - gh, gw, gh);
      ctx.strokeStyle = 'rgba(232,224,200,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gxx = gx + gw * 0.2; gxx < gx + gw; gxx += gw * 0.22) {
        ctx.moveTo(gxx, farKerbY - gh);
        ctx.lineTo(gxx, farKerbY);
      }
      ctx.stroke();
    }
    // a paving path from the sidewalk up to the door, and the mailbox at its foot
    ctx.fillStyle = 'rgba(150,146,138,0.5)';
    ctx.fillRect(cx - BS * 0.34, farKerbY - FAR_SIDEWALK_H, BS * 0.68, FAR_SIDEWALK_H);
    this.drawMailbox(ctx, cx - BS * 0.95, farKerbY, num, BS * 0.9);
  };
  // cached: see the R.getSprite comment above
  R.drawTerraceHouse = function (ctx, cx, farKerbY, num, t, attachLeft, attachRight) {
    const pad = BS * 3.3; // room for a fence + car/goal extending past the gable, on whichever side is free
    const w = GABLE_W * BS + pad * 2, h = BS * (GABLE_BODY_H + GABLE_ROOF_H) + 6;
    const key = 'house#' + num + '#' + (attachLeft ? 1 : 0) + (attachRight ? 1 : 0);
    const cv = this.getSprite(key, w, h, (cctx) => this.paintTerraceHouse(cctx, w / 2, h, num, t, attachLeft, attachRight));
    ctx.drawImage(cv, cx - w / 2, farKerbY - h);
  };
  // background streetscape filling the wider gaps between terraces — sheds, fences, gardens, parking bays,
  // carports, bins/bikes, and one small playground — so no stretch of the street reads as empty
  // background streetscape scenery (uncached — see drawFillerItem below, the cached wrapper every caller
  // actually uses)
  R.paintFillerItem = function (ctx, cx, farKerbY, kind, seed, t) {
    const rnd = U.rng(seed);
    if (kind === 'shed') {
      const w = BS * 2.1, h = BS * 1.5, x0 = cx - w / 2, y0 = farKerbY - h;
      ctx.fillStyle = Art.TL(HOUSE_WOOD[seed % HOUSE_WOOD.length]);
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let bx = x0 + 5; bx < x0 + w; bx += 8) {
        ctx.moveTo(bx, y0);
        ctx.lineTo(bx, farKerbY);
      }
      ctx.stroke();
      ctx.fillStyle = Art.TL('#2b2c32');
      ctx.beginPath();
      ctx.moveTo(x0 - 4, y0);
      ctx.lineTo(x0 + w * 0.3, y0 - BS * 0.35);
      ctx.lineTo(x0 + w + 4, y0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = Art.TL('#242024');
      ctx.fillRect(x0 + w * 0.62, y0 + h * 0.35, w * 0.3, h * 0.65);
    } else if (kind === 'fence') {
      const w = BS * 2.6, x0 = cx - w / 2, h = BS * 1.35;
      ctx.fillStyle = Art.TL('#4f4c45');
      ctx.fillRect(x0, farKerbY - h, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let bx = x0 + 5; bx < x0 + w; bx += 7) {
        ctx.moveTo(bx, farKerbY - h);
        ctx.lineTo(bx, farKerbY);
      }
      ctx.stroke();
      if (rnd() < 0.5) drawCobweb(ctx, x0 + (rnd() < 0.5 ? 6 : w - 6), farKerbY - h + 8, rnd() < 0.5 ? 1 : -1);
    } else if (kind === 'garden') {
      this.drawCornerGarden(ctx, cx - BS * 0.8, farKerbY, -1, seed);
      this.drawCornerGarden(ctx, cx + BS * 0.8, farKerbY, 1, seed + 1);
    } else if (kind === 'parking') {
      ctx.fillStyle = Art.TL('#6a6670');
      ctx.fillRect(cx - BS * 1.7, farKerbY - 6, BS * 3.4, 6);
      const cw = BS * 1.6, chh = BS * 0.68;
      Art.block(ctx, 'car', cx - cw - BS * 0.15, farKerbY - chh, cw, chh, BS, seed, t);
      if (rnd() < 0.6) Art.block(ctx, 'car', cx + BS * 0.15, farKerbY - chh, cw, chh, BS, seed + 3, t);
    } else if (kind === 'carport') {
      const w = BS * 2.4, x0 = cx - w / 2, postH = BS * 1.7;
      ctx.strokeStyle = Art.TL('#3a3630');
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x0 + 4, farKerbY);
      ctx.lineTo(x0 + 4, farKerbY - postH);
      ctx.moveTo(x0 + w - 4, farKerbY);
      ctx.lineTo(x0 + w - 4, farKerbY - postH);
      ctx.stroke();
      ctx.fillStyle = Art.TL('#2b2c32');
      ctx.fillRect(x0 - 6, farKerbY - postH - 10, w + 12, 14);
      const cw = w * 0.82, chh = BS * 0.62;
      Art.block(ctx, 'car', cx - cw / 2, farKerbY - chh, cw, chh, BS, seed, t);
    } else if (kind === 'bin') {
      Art.block(ctx, 'bin', cx - BS * 0.4, farKerbY - BS * 0.9, BS * 0.8, BS * 0.9, BS, seed, t);
      this.drawLeaningBike(ctx, cx + BS * 0.55, farKerbY - BS * 0.28);
    } else if (kind === 'playground') {
      const w = BS * 2.8, x0 = cx - w / 2, postH = BS * 1.4;
      ctx.fillStyle = 'rgba(210,190,150,0.35)';
      ctx.fillRect(x0 - 10, farKerbY - 10, w + 20, 10);
      ctx.strokeStyle = Art.TL('#8a6a3a');
      ctx.lineWidth = 5;
      for (const px3 of [x0 + w * 0.1, x0 + w * 0.9]) {
        ctx.beginPath();
        ctx.moveTo(px3, farKerbY);
        ctx.lineTo(px3 + (px3 < cx ? w * 0.12 : -w * 0.12), farKerbY - postH);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.22, farKerbY - postH);
      ctx.lineTo(x0 + w * 0.78, farKerbY - postH);
      ctx.stroke();
      const sway = Math.sin(t * 1.1) * BS * 0.1;
      for (const sx2 of [x0 + w * 0.38, x0 + w * 0.62]) {
        ctx.strokeStyle = '#8a8a90';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx2, farKerbY - postH);
        ctx.lineTo(sx2 + sway, farKerbY - BS * 0.3);
        ctx.moveTo(sx2 + BS * 0.14, farKerbY - postH);
        ctx.lineTo(sx2 + BS * 0.14 + sway, farKerbY - BS * 0.3);
        ctx.stroke();
        ctx.fillStyle = Art.TL('#8a4a24');
        ctx.fillRect(sx2 + sway - 2, farKerbY - BS * 0.32, BS * 0.18, BS * 0.08);
      }
    }
  };
  // cached: see the R.getSprite comment above. The playground's swing-sway is baked in at whatever `t`
  // happened to be when that tint bucket was first built — a static pose instead of continuous animation,
  // an acceptable trade for not re-walking ~15 canvas calls every frame for scenery this far in the background.
  R.drawFillerItem = function (ctx, cx, farKerbY, kind, seed, t) {
    const w = BS * 4.4, h = BS * 2.3;
    const key = 'filler#' + kind + '#' + seed;
    const cv = this.getSprite(key, w, h, (cctx) => this.paintFillerItem(cctx, w / 2, h, kind, seed, t));
    ctx.drawImage(cv, cx - w / 2, farKerbY - h);
  };
  // the cul-de-sac gap (see CULDESAC_X): a short side street receding into the distance, with nr 54 and 52
  // standing small and further back — not the main row, but not empty either
  R.drawCuldesac = function (ctx, cx, farKerbY, t) {
    const nearW = BS * 3.8, farW = BS * 1.7, depth = BS * 1.8;
    const g = ctx.createLinearGradient(0, farKerbY - depth, 0, farKerbY);
    g.addColorStop(0, Art.TL('#37343e'));
    g.addColorStop(1, Art.TL('#242229'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - nearW / 2, farKerbY);
    ctx.lineTo(cx - farW / 2, farKerbY - depth);
    ctx.lineTo(cx + farW / 2, farKerbY - depth);
    ctx.lineTo(cx + nearW / 2, farKerbY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,226,232,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - nearW / 2, farKerbY);
    ctx.lineTo(cx - farW / 2, farKerbY - depth);
    ctx.moveTo(cx + nearW / 2, farKerbY);
    ctx.lineTo(cx + farW / 2, farKerbY - depth);
    ctx.stroke();
    const backY = farKerbY - depth + BS * 0.1;
    const g54 = this.drawGableUnit(ctx, cx - BS * 0.78, backY, GABLE_W * 0.5, 754);
    this.drawMailbox(ctx, g54.x0 - BS * 0.15, backY, 54, BS * 0.42);
    const g52 = this.drawGableUnit(ctx, cx + BS * 0.92, backY, GABLE_W * 0.5, 752);
    this.drawMailbox(ctx, g52.x0 + g52.bw + BS * 0.15, backY, 52, BS * 0.42);
  };
  // a black mailbox on a post with the house number in white
  R.drawMailbox = function (ctx, cx, baseY, num, postH) {
    ctx.strokeStyle = Art.TL('#3a3a3e');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx, baseY - postH);
    ctx.stroke();
    const boxW = BS * 0.56, boxH = BS * 0.32, boxY = baseY - postH - boxH * 0.4;
    ctx.fillStyle = '#15130f';
    Art.rr(ctx, cx - boxW / 2, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - boxW / 2, boxY, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.font = Math.round(BS * 0.22) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), cx, boxY + boxH / 2 + 1);
  };
  // the near-side kerb: just a mailbox and a little foreground clutter, in front of the road (Stratusvägen)
  // (uncached — see drawNearHouse below, the cached wrapper every caller actually uses)
  R.paintNearHouse = function (ctx, cx, nearKerbY, num, t) {
    const rnd = U.rng(num * 131 + 5);
    this.drawMailbox(ctx, cx, nearKerbY + 30, num, BS * 1.05);
    // a small pumpkin or a leaf pile at the foot of about a third of the posts
    if (rnd() < 0.3) {
      const pb = BS * 0.34;
      if (VD.Stratus && VD.Stratus.pumpkin) VD.Stratus.pumpkin(ctx, cx + BS * 0.5, nearKerbY + 30 - pb * 0.35, pb / BS, t, Art.dark() > 0.22);
      else {
        ctx.fillStyle = '#e8731f';
        ctx.beginPath();
        ctx.ellipse(cx + BS * 0.5, nearKerbY + 30 - pb * 0.35, pb * 0.5, pb * 0.42, 0, 0, TAU);
        ctx.fill();
      }
    } else if (rnd() < 0.6) {
      ctx.fillStyle = 'rgba(200,120,40,0.5)';
      for (let i = 0; i < 4; i++) {
        const lx = cx - BS * 0.4 + i * 7, ly = nearKerbY + 34 + (i % 2) * 4;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 3.4, 2.2, i, 0, TAU);
        ctx.fill();
      }
    }
  };
  // cached: see the R.getSprite comment above
  R.drawNearHouse = function (ctx, cx, num, t) {
    const nearKerbY = this.roadNearKerbY();
    const w = BS * 2.4, h = BS * 2.3, localBaseY = h - 20;
    const key = 'nearhouse#' + num;
    const cv = this.getSprite(key, w, h, (cctx) => this.paintNearHouse(cctx, w / 2, localBaseY, num, t));
    ctx.drawImage(cv, cx - w / 2, nearKerbY - localBaseY);
  };
  R.drawHouses = function (ctx, camX, t) {
    const props = this.streetProps;
    if (props) {
      const farKerbY = this.roadFarKerbY();
      for (const p of props) {
        const x = sx(p.x, camX);
        const margin = p.t === 'house' ? 170 : p.t === 'culdesac' ? 150 : 90;
        if (x < -margin || x > W + margin) continue;
        if (p.t === 'house') this.drawTerraceHouse(ctx, x, farKerbY, p.num, t, p.attachLeft, p.attachRight);
        else if (p.t === 'terrace') this.drawGableUnit(ctx, x, farKerbY, p.w || GABLE_W, p.seed);
        else if (p.t === 'culdesac') this.drawCuldesac(ctx, x, farKerbY, t);
        else this.drawFillerItem(ctx, x, farKerbY, p.kind, p.seed, t);
      }
    }
    const houses = this.lvl.houses;
    if (!houses || !houses.length) return;
    for (const h of houses) {
      if (h.row === 'far') continue; // drawn above, from this.streetProps
      const x = sx(h.x, camX);
      if (x < -160 || x > W + 160) continue;
      this.drawNearHouse(ctx, x, h.num, t);
    }
  };
  // the four neighbours (js/stratus.js, if it has loaded — feature-detected so this level still works
  // before/without that file), standing in the far row where Builder.person() placed them
  R.personThrowK = function (p, px) {
    const handY = p.handY != null ? p.handY : p.footY;
    let best = 0;
    for (const o of this.lvl.objs) {
      const mv = o.mv;
      if (!mv || mv.type !== 'throw' || mv.hx == null || mv.hx !== p.x || mv.hy !== handY) continue;
      // throwK peaks at the moment the object leaves the hand (x = o.x - mv.trigger), not when it lands
      const releaseX = o.x - mv.trigger, d = px - releaseX, winL = 3, winR = 4.2;
      let k = 0;
      if (d < 0 && d > -winL) k = 1 + d / winL;
      else if (d >= 0 && d < winR) k = 1 - d / winR;
      if (k > best) best = k;
    }
    return best;
  };
  R.drawPeople = function (ctx, camX, t, px) {
    const VDS = VD.Stratus;
    if (!VDS || !this.lvl.people.length) return;
    const farKerbY = this.roadFarKerbY();
    for (const p of this.lvl.people) {
      const fn = VDS[p.id];
      if (!fn) continue;
      const x = sx(p.x, camX);
      if (x < -110 || x > W + 110) continue;
      const state = { throwK: this.personThrowK(p, px) };
      if (p.id === 'nr66') state.doorK = U.clamp((px - (p.x - 10)) / 16, 0, 1);
      fn(ctx, x, farKerbY, 0.85, t, state);
    }
  };
  // the rocket skateboard, parked and unlit, standing on the road a couple of blocks before the ride zone
  // so the player visibly runs up and hops on it (see Builder.board(); the actual ride is drawn in drawPlayer)
  R.drawParkedBoards = function (ctx, camX, t) {
    const boards = this.lvl.boards;
    if (!boards || !boards.length) return;
    const VDS = VD.Stratus;
    for (const z of boards) {
      const x = sx(z.x0 - 4, camX);
      if (x < -60 || x > W + 60) continue;
      if (VDS && VDS.skateboard) VDS.skateboard(ctx, x, GY, 1, t, { on: false });
      else {
        ctx.fillStyle = '#7a4a28';
        Art.rr(ctx, x - 34, GY - 10, 68, 10, 4);
        ctx.fill();
      }
    }
  };
  // speed lines streaking past in the ×1.5 zone at the end of the street (see Builder.speed())
  R.drawSpeedFX = function (ctx, camX, t, px) {
    const speeds = this.lvl.speeds;
    if (!speeds || !speeds.length) return;
    let mult = 1;
    for (const z of speeds) if (px >= z.x0 && px <= z.x1) { mult = z.mult; break; }
    if (mult <= 1.01) return;
    const rnd = U.rng(Math.floor(t * 13));
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const yy = 90 + rnd() * (GY - 120), len = 46 + rnd() * 100;
      const xx = rnd() * (W + 260) - 140;
      ctx.lineWidth = 1.5 + rnd() * 1.5;
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx - len, yy);
      ctx.stroke();
    }
  };

  // ------------------------------------------------------------------ Stratusvägen: the camera swing
  // A short cinematic flourish inside an lvl.swings zone (see Builder.swing()): the even-numbered row was
  // behind Vippe before it, the odd-numbered row (nr 15 among them) is behind him after — so the camera
  // swings 180° around him mid-run to sell "we're filming from the other side now". A tiny flat-shaded 3D
  // scene (painter's algorithm, no per-face gradients, ~100 faces) stands in for the street during the
  // turn; the ordinary flat 2D layers cross-fade out over the first ~12% of the zone and back in over the
  // last ~12%, so both ends are seamless with the regular side-view rendering. Gameplay/physics never read
  // any of this — it's pure presentation over an already-flat, obstacle-free zone.
  function swingEnvelope(p) {
    const FADE = 0.12;
    if (p < FADE) return 1 - U.smooth(p / FADE);
    if (p > 1 - FADE) return U.smooth((p - (1 - FADE)) / FADE);
    return 0;
  }
  // Vippe stays in the foreground throughout: the camera is a chase-cam a fixed distance behind/above him
  // (not a pure "always centred" orbit), pitched down a little so the road runs from under his feet into
  // the distance, the same way the ordinary side view has him low-centre on the road at y ≈ GY.
  const SW_R = 11, SW_CAMH = 2.4, SW_PITCH = 0.2, SW_FOCAL = 300, SW_CY = 0.78;
  function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function v3cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function v3norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  // the camera's basis at yaw `theta` (0 = the ordinary side view, π/2 = looking straight down the street
  // from behind Vippe, π = the ordinary side view from the far side) — shared by the scene and the player.
  // Orbits Vippe at a fixed radius (so his size stays put) but AIMS along a fixed downward pitch rather
  // than straight at him, which is what keeps him low in frame instead of dead-centre.
  function swingCam(theta) {
    const pos = [-SW_R * Math.sin(theta), SW_CAMH, -SW_R * Math.cos(theta)];
    const fh = [Math.sin(theta), 0, Math.cos(theta)]; // horizontal aim, camera → the street's centreline
    const cp = Math.cos(SW_PITCH), sp = Math.sin(SW_PITCH);
    const fwd = v3norm([fh[0] * cp, -sp, fh[2] * cp]);
    let right = v3norm(v3cross(fwd, [0, 1, 0]));
    if (!isFinite(right[0]) || (Math.abs(right[0]) < 1e-6 && Math.abs(right[2]) < 1e-6)) right = [1, 0, 0];
    const up = v3cross(right, fwd);
    return { pos, fwd, right, up, fh };
  }
  function swingProject(cam, p) {
    const rx = p[0] - cam.pos[0], ry = p[1] - cam.pos[1], rz = p[2] - cam.pos[2];
    const cxv = rx * cam.right[0] + ry * cam.right[1] + rz * cam.right[2];
    const cyv = rx * cam.up[0] + ry * cam.up[1] + rz * cam.up[2];
    const czv = rx * cam.fwd[0] + ry * cam.fwd[1] + rz * cam.fwd[2];
    if (czv < 0.2) return null; // behind the camera plane — cull
    const f = SW_FOCAL / Math.max(czv, 3.5); // clamp how large anything can loom up close (houses near the orbit path)
    return [W / 2 + cxv * f, H * SW_CY - cyv * f, czv];
  }
  // the screen Y of the horizon (where the flat ground vanishes) at the camera's current pitch/height — a
  // point at the camera's own height, far away along the (un-pitched) horizontal aim, projects there
  // regardless of distance. Used to guarantee the ground fill below always meets the sky exactly.
  function swingHorizonY(cam) {
    const far = [cam.pos[0] + cam.fh[0] * 1000, cam.pos[1], cam.pos[2] + cam.fh[2] * 1000];
    const q = swingProject(cam, far);
    return q ? q[1] : H * 0.55;
  }
  // the scene's static geometry, in local (along-street S, up Y, lateral Z) space, built once (see below):
  // a handful of narrow gable houses either side of the road, set back behind a sidewalk/garden strip like
  // the real street, a few lamps and a couple of parked cars. Faces only — no back walls (never seen).
  // wallDetail/frame flags add a couple of cheap post-fill strokes (board lines, window frames) without
  // costing extra sorted faces. mailboxes/pumpkins (the nearest 2 houses of each row) are billboarded
  // separately, after the main pass, straight from SWING_PROPS.
  const SWING_PROPS = [];
  function buildSwingModel() {
    const faces = [];
    SWING_PROPS.length = 0;
    function house(s, sgn, seed, num) {
      const hw = 1.9, wallH = 3.1, roofH = 2.0, d0 = 6.5, d1 = 11.5;
      const zf = sgn * d0, zb = sgn * d1;
      const wall = HOUSE_WOOD[seed % HOUSE_WOOD.length];
      const roof = '#24252c';
      faces.push({ p: [[s - hw, 0, zf], [s + hw, 0, zf], [s + hw, wallH, zf], [s - hw, wallH, zf]], c: wall, wallDetail: true });
      faces.push({ p: [[s - hw, wallH, zf], [s + hw, wallH, zf], [s, wallH + roofH, zf]], c: roof });
      faces.push({ p: [[s - 0.4, 1.15, zf], [s + 0.4, 1.15, zf], [s + 0.4, 1.95, zf], [s - 0.4, 1.95, zf]], glowC: seed % 2 ? '#ffd27a' : 'rgba(143,176,200,0.9)', frame: true });
      faces.push({ p: [[s - 0.28, 0, zf], [s + 0.28, 0, zf], [s + 0.28, 1.0, zf], [s - 0.28, 1.0, zf]], c: '#2a2622' }); // door
      faces.push({ p: [[s - hw, 0, zf], [s - hw, 0, zb], [s - hw, wallH, zb], [s - hw, wallH, zf]], c: wall, wallDetail: true });
      faces.push({ p: [[s + hw, 0, zf], [s + hw, 0, zb], [s + hw, wallH, zb], [s + hw, wallH, zf]], c: wall, wallDetail: true });
      faces.push({ p: [[s, wallH + roofH, zf], [s, wallH + roofH, zb], [s - hw, wallH, zb], [s - hw, wallH, zf]], c: roof });
      faces.push({ p: [[s, wallH + roofH, zf], [s, wallH + roofH, zb], [s + hw, wallH, zb], [s + hw, wallH, zf]], c: roof });
      if (num != null) SWING_PROPS.push({ pos: [s - hw - 0.5, 0, zf - sgn * 0.3], num, pumpkin: seed % 2 === 0 });
    }
    // the camera's own S-coordinate stays in [-SW_R, 0] for the whole 0→π sweep (only its Z crosses from
    // - to + — see swingCam), so every house needs real clearance from that whole range, not just from
    // wherever the camera happens to sit at the one instant being screenshotted
    const sArr = [-22, -16, -10, 10, 16, 22];
    const leftNums = [64, 62, 66, null, null, null], rightNums = [null, null, null, 21, 19, 15];
    for (let i = 0; i < sArr.length; i++) {
      house(sArr[i], -1, i * 3 + 1, leftNums[i]); // even row (66…48), behind Vippe before the swing
      house(sArr[i] + 4, 1, i * 5 + 2, rightNums[i]); // odd row (23…1), behind him after
    }
    function lamp(s, sgn) {
      const x = sgn * 5.6;
      faces.push({ p: [[s - 0.06, 0, x], [s + 0.06, 0, x], [s + 0.06, 2.6, x], [s - 0.06, 2.6, x]], c: '#2a2a30' });
      faces.push({ pt: [s, 2.7, x], r: 0.5, glowC: 'rgba(255,214,130,0.5)' });
    }
    for (const s of [-26, -12, 12]) { lamp(s, -1); lamp(s + 6, 1); }
    function car(s, sgn, cc) {
      const x = sgn * 4.4, w = 1.8, h = 0.85, d = 0.9;
      faces.push({ p: [[s - w / 2, 0, x - d / 2], [s + w / 2, 0, x - d / 2], [s + w / 2, h, x - d / 2], [s - w / 2, h, x - d / 2]], c: cc });
      faces.push({ p: [[s - w / 2, h, x - d / 2], [s + w / 2, h, x - d / 2], [s + w / 2, h, x + d / 2], [s - w / 2, h, x + d / 2]], c: cc });
      faces.push({ p: [[s - w / 2, 0, x + d / 2], [s + w / 2, 0, x + d / 2], [s + w / 2, h, x + d / 2], [s - w / 2, h, x + d / 2]], c: cc });
    }
    car(-19, -1, '#8a1a24');
    car(19, 1, '#1c3a6e');
    // the ground, in short segments along the street — a single quad spanning the whole ±40 range would
    // often have one end behind the camera and one ahead once the orbit turns to look down the street, and
    // the simple all-or-nothing culling below drops a whole face if any one of its corners is behind the
    // camera plane; segmenting keeps each dropped piece tiny. A flat fill behind all of this (see
    // drawSwingScene) is the real guarantee against any sky showing through a gap.
    const bands = [
      [-11.5, -5.2, '#3a3840'], // far sidewalk/garden strip
      [-5.2, 5.2, '#26242c'], // road
      [5.2, 11.5, '#3a3840'], // near sidewalk/garden strip
    ];
    for (const [z0, z1, c] of bands) for (let s = -40; s < 40; s += 8) faces.push({ p: [[s, 0, z0], [s + 8, 0, z0], [s + 8, 0, z1], [s, 0, z1]], c });
    return faces;
  }
  let SWING_MODEL = null; // built lazily on first use (HOUSE_WOOD isn't defined yet at this point in the file)
  R.drawSwingScene = function (ctx, theta, sky) {
    if (!SWING_MODEL) SWING_MODEL = buildSwingModel();
    const cam = swingCam(theta);
    // sky backdrop, reusing the level's own dusk gradient at the player's current x
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // ground fill down to the bottom of the screen — a flat pavement/grass dusk tone behind everything
    // else, so there is never a gap of sky showing through below the horizon at any θ
    const horizonY = swingHorizonY(cam);
    ctx.fillStyle = Art.TL('#2c2a32');
    ctx.fillRect(0, Math.max(0, horizonY), W, H - Math.max(0, horizonY));
    // a moon that drifts across and brightens as the camera turns, cheap (no per-frame allocation)
    if (sky.dark > 0.28) {
      const moonX = W * 0.18 + (theta / Math.PI) * W * 0.64, moonY = 90;
      const halo = ctx.createRadialGradient(moonX, moonY, 6, moonX, moonY, 70);
      halo.addColorStop(0, 'rgba(255,246,218,0.3)');
      halo.addColorStop(1, 'rgba(255,246,218,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(moonX - 70, moonY - 70, 140, 140);
      ctx.fillStyle = '#fff6da';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 20, 0, TAU);
      ctx.fill();
    }
    const drawList = [];
    for (const f of SWING_MODEL) {
      if (f.pt) {
        const q = swingProject(cam, f.pt);
        // same near-camera clamp as swingProject's own x/y (q[2] is the raw, unclamped depth) — otherwise a
        // lamp passing close to the orbiting camera briefly blows up into a screen-filling glow circle
        if (q) drawList.push({ z: q[2], glow: true, x: q[0], y: q[1], r: Math.min(60, Math.max(1, (f.r * SW_FOCAL) / Math.max(q[2], 3.5))), c: f.glowC });
        continue;
      }
      const pts = [];
      let z = 0, ok = true;
      for (const p of f.p) {
        const q = swingProject(cam, p);
        if (!q) { ok = false; break; }
        pts.push(q);
        z += q[2];
      }
      if (!ok) continue;
      // regular surfaces (f.c) darken with the dusk like everything else; glow surfaces (f.glowC — lit
      // windows, lamp light) are self-illuminated and stay at their own colour, same convention as the
      // rest of the street art
      drawList.push({ z: z / f.p.length, pts, c: f.c ? Art.TL(f.c) : f.glowC, wallDetail: f.wallDetail, frame: f.frame });
    }
    drawList.sort((a, b) => b.z - a.z); // painter's algorithm: farthest first
    for (const d of drawList) {
      if (d.glow) {
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = d.c;
      ctx.beginPath();
      ctx.moveTo(d.pts[0][0], d.pts[0][1]);
      for (let i = 1; i < d.pts.length; i++) ctx.lineTo(d.pts[i][0], d.pts[i][1]);
      ctx.closePath();
      ctx.fill();
      // cheap post-fill detail, reusing the face's own already-projected corners — a couple of vertical
      // board-line strokes on a wall (points are [bottomNear, bottomFar, topFar, topNear]), or a plain
      // white frame around a window — instead of adding more sorted faces
      if (d.wallDetail) {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const k of [0.33, 0.66]) {
          const bx = d.pts[0][0] + (d.pts[1][0] - d.pts[0][0]) * k, by = d.pts[0][1] + (d.pts[1][1] - d.pts[0][1]) * k;
          const tx = d.pts[3][0] + (d.pts[2][0] - d.pts[3][0]) * k, ty = d.pts[3][1] + (d.pts[2][1] - d.pts[3][1]) * k;
          ctx.moveTo(bx, by);
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      } else if (d.frame) {
        ctx.strokeStyle = 'rgba(242,240,232,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(d.pts[0][0], d.pts[0][1]);
        for (let i = 1; i < d.pts.length; i++) ctx.lineTo(d.pts[i][0], d.pts[i][1]);
        ctx.closePath();
        ctx.stroke();
      }
    }
    // mailbox posts with the house number, and a pumpkin on a step, on the nearest couple of houses of
    // each row — simple billboards at their projected foot position, not worth sorting in with the rest
    for (const p of SWING_PROPS) {
      const qTop = swingProject(cam, [p.pos[0], 0.85, p.pos[2]]);
      const qBot = swingProject(cam, p.pos);
      if (!qTop || !qBot) continue;
      const sc = U.clamp(SW_R / qBot[2], 0.25, 1.6);
      ctx.strokeStyle = Art.TL('#3a3a3e');
      ctx.lineWidth = Math.max(1, 3 * sc);
      ctx.beginPath();
      ctx.moveTo(qBot[0], qBot[1]);
      ctx.lineTo(qTop[0], qTop[1]);
      ctx.stroke();
      const boxW = 16 * sc, boxH = 10 * sc;
      ctx.fillStyle = '#15130f';
      ctx.fillRect(qTop[0] - boxW / 2, qTop[1] - boxH * 0.6, boxW, boxH);
      ctx.fillStyle = '#fff';
      ctx.font = Math.max(6, Math.round(9 * sc)) + 'px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.num), qTop[0], qTop[1] - boxH * 0.1);
      if (p.pumpkin) {
        const qp = swingProject(cam, [p.pos[0] + 0.6, 0, p.pos[2] + 0.3]);
        if (qp) {
          const pr = Math.max(2, 9 * sc);
          ctx.fillStyle = '#e8731f';
          ctx.beginPath();
          ctx.ellipse(qp[0], qp[1] - pr * 0.5, pr, pr * 0.82, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  };
  // Vippe himself, projected through the same chase camera — always drawn at full opacity (only the world
  // around him cross-fades) so he never looks translucent mid-run, with a small ground shadow under his
  // feet. Cube mode only (the swing zone is flat, obstacle-free ground — see Builder.swing()), so no
  // ship/ball branches are needed here.
  R.drawSwingPlayer = function (ctx, G, t, theta) {
    const s = G.s, v = G.vis;
    if (G.state === 'dead') { this.drawPlayer(ctx, 0, G, t); return; } // shouldn't happen (no hazards here), but safe
    const cam = swingCam(theta);
    const q = swingProject(cam, [0, 0.5, 0]);
    if (!q) return;
    const scale = SW_R / q[2]; // ~1.0 near the orbit radius, matching the ordinary cube's on-screen size
    const qFoot = swingProject(cam, [0, 0, 0]);
    if (qFoot) {
      ctx.fillStyle = 'rgba(6,5,8,0.4)';
      ctx.beginPath();
      ctx.ellipse(qFoot[0], qFoot[1] + 3 * scale, 22 * scale, 7 * scale, 0, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(q[0], q[1]);
    ctx.scale(scale, scale);
    ctx.rotate(v.rot);
    const expr = G.state === 'won' || G.state === 'winning' ? 'happy' : v.oT > 0 ? 'o' : 'grin';
    Art.cube(ctx, BS, expr, G.skin, 1);
    ctx.restore();
  };

  // ------------------------------------------------------------------ gameplay objects
  const WATER_STYLE = { peat: 'bog', sewer: 'sludge' };
  // laneFilter is only used on Stratusvägen (this.theme.lanes): 1 draws only far-lane (lane === 1) objects,
  // 0 draws everything else (laneless objects, lane 0, and the "always" stuff — water/checkpoints/finish
  // glow), undefined (every other level) draws everything in one pass exactly as before. See the comment
  // in drawScene on why the far/near objects are split around the player for correct depth.
  R.drawObjects = function (ctx, camX, t, G, L = 0, laneFilter) {
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
    if (laneFilter !== 1) {
      // water, the live rail, and Stratusvägen's speed bumps first (they sit in/on the ground)
      for (const o of vis) {
        if (o.t !== 'haz') continue;
        if (o.kind === 'water') {
          const x0 = sx(o.x, camX), x1 = sx(o.x + o.w, camX), ys = sy(0.22);
          const wf = AH && AH.water && AH.water[o.style];
          if (wf) wf(ctx, x0, x1, ys, H, t);
          else Art.water(ctx, x0, x1, ys, H, t, o.style || WATER_STYLE[this.theme.ground[this.areaIn(L, o.x).id]]);
        } else if (o.kind === 'rail') Art.rail(ctx, sx(o.x, camX), sx(o.x + o.w, camX), GY, t, o.style || this.theme.ground[this.areaIn(L, o.x).id]);
        else if (o.kind === 'bump') this.drawBump(ctx, camX, o);
      }
      // checkpoints
      for (const cp of lvl.checkpoints) {
        if (cp.index === 0 || (cp.layer || 0) !== L || cp.x < camX - 2 || cp.x > camX + 30) continue;
        const active = G.state !== 'menu' && G.cpIndex >= cp.index;
        Art.checkpoint(ctx, sx(cp.x, camX), GY, BS, active, t);
      }
    }
    for (const o of vis) {
      if (laneFilter === 1 && o.lane !== 1) continue;
      if (laneFilter === 0 && o.lane === 1) continue;
      let x = sx(o.x, camX), y = sy(o.y + o.h), w = o.w * BS, h = o.h * BS;
      if (o.lane === 1) {
        // Stratusvägen's far lane: shift up and shrink a little around its own centre, so it reads as
        // further away. Purely a screen trick — physics.js never moves the object's real y.
        const ccx = x + w / 2, ccy = y + h / 2 - LANE_DY * BS;
        w *= LANE_SCALE;
        h *= LANE_SCALE;
        x = ccx - w / 2;
        y = ccy - h / 2;
      }
      switch (o.t) {
        case 'coin': {
          if (G.got && G.got.has(o.id)) break; // already collected
          let ccx = x + w / 2, ccy = y + h / 2;
          if (o.mv) {
            const mv = VD.Physics.moveOf(o, px, lvl);
            ccx += mv.dx * BS;
            ccy -= mv.dy * BS; // world y is up, screen y is down
          }
          Art.coin(ctx, ccx, ccy, o.lane === 1 ? BS * LANE_SCALE : BS, o.style, t, o.id);
          break;
        }
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
          else if (o.kind === 'shark') Art.sharkHead(ctx, x, y, w, h, o.dir, t, o.id, glow(o.x));
          else if (o.kind === 'eel') Art.eel(ctx, x, y, w, h, t, o.id, glow(o.x));
          else if (o.kind === 'lob') {
            // a hazard thrown from a fixed thrower (Builder.lob()): zucchini or dumbbell, flying in from
            // mv.hx/mv.hy and landing at (o.x, o.y). A shadow on the ground shows where it'll land.
            const laneDy = o.lane === 1 ? LANE_DY : 0; // same depth trick as the shared x/y/w/h above
            const mv = VD.Physics.moveOf(o, px, lvl);
            const lcx = sx(o.x + o.w / 2 + mv.dx, camX), lcy = sy(o.y + o.h / 2 + mv.dy + laneDy);
            const shadowX = sx(o.x + o.w / 2, camX);
            Art.lob(ctx, lcx, lcy, shadowX, sy(o.y + laneDy), o.lane === 1 ? BS * LANE_SCALE : BS, mv.k, o.style, t, o.id);
          } else if (o.kind === 'nun') {
            const mv = VD.Physics.moveOf(o, px, lvl);
            const ncx = sx(o.x + o.w / 2 + mv.dx, camX), ncy = sy(o.y + o.h / 2 + mv.dy);
            if (AH && AH.hazard && AH.hazard.nun) AH.hazard.nun(ctx, ncx, ncy, BS, t, o.id, glow(o.x), o.style);
            else {
              ctx.fillStyle = '#3a0810';
              Art.rr(ctx, ncx - w / 2, ncy - h / 2, w, h, 6);
              ctx.fill();
            }
            if (inDark(o.x)) this._eyeSpots.push({ x: ncx, y: ncy - h * 0.28, size: BS * 0.4, seed: o.id, color: '#f4f8ff' });
          } else if (o.kind === 'jack') {
            const mv = VD.Physics.moveOf(o, px, lvl);
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
            const mv = VD.Physics.moveOf(o, px, lvl);
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
            const mv = VD.Physics.moveOf(o, px, lvl);
            const bcx = sx(o.x + o.w / 2 + mv.dx, camX), bcy = sy(o.y + 1.1 + mv.dy);
            if (AH && AH.hazard && AH.hazard.balloon) AH.hazard.balloon(ctx, bcx, bcy, BS, t, o.id, glow(o.x));
            else {
              ctx.fillStyle = '#c0081a';
              ctx.beginPath();
              ctx.arc(bcx, bcy, BS * 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (o.kind === 'pawn') {
            // a pawn thrown by the level 4 "Schackmatt" king boss (see Builder.pawn(), physics.js moveOf)
            const mv = VD.Physics.moveOf(o, px, lvl);
            const pcx = sx(o.x + o.w / 2 + mv.dx, camX), pcy = sy(o.y + o.h / 2 + mv.dy);
            const landX = o.x - o.mv.trigger + o.mv.fall;
            const dust = mv.k >= 0.999 ? U.clamp(1 - (px - landX) / 3, 0, 1) : 0;
            Art.pawnThrown(ctx, pcx, pcy, BS, mv.k, t, o.id, glow(o.x), dust);
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
    if (laneFilter !== 1 && fx > -40 && fx < W + 40 && lvl.layerAt(lvl.finishX) === L) {
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
    const laneP = s.laneP || 0;
    const cx = sx(s.x + 0.5, camX), cy = sy(s.y + ph / 2 + laneP * LANE_DY);
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
    // Stratusvägen: inside a board zone (see Builder.board()), Vippe rides the rocket skateboard — draw it
    // under his feet, at the same lane depth he's currently at
    if (this.theme.lanes && this.lvl.boards.some((z) => s.x >= z.x0 && s.x <= z.x1)) {
      const VDS = VD.Stratus;
      const footY = sy(s.y + laneP * LANE_DY);
      const boardScale = 1 - (1 - LANE_SCALE) * laneP;
      if (VDS && VDS.skateboard) VDS.skateboard(ctx, cx, footY, boardScale, t, { on: true });
    }
    ctx.save();
    ctx.translate(cx, cy);
    if (laneP) {
      const sc = 1 - (1 - LANE_SCALE) * laneP;
      ctx.scale(sc, sc);
    }
    const expr = G.state === 'won' || G.state === 'winning' ? 'happy' : v.oT > 0 ? 'o' : 'grin';
    if (s.mode === 'cube' || s.mode === 'lane') {
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
          const mv = VD.Physics.moveOf(o, s.x, this.lvl);
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
