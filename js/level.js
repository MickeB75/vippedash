// VippeDash — level builder + the levels (1: Uppland → Uppsala → Storvreta, 2: the subway, 3: the wild forest)
// Units are blocks. 10.4 blocks/s at 156 BPM => 1 beat = 4 blocks, 1 bar = 16 blocks.
(function () {
  const VD = (window.VD = window.VD || {});

  class Builder {
    constructor() {
      this.objs = [];
      this.checkpoints = [];
      this.decos = [];
      this.landmarks = [];
      this.corridors = [];
      this.areas = [];
      this.texts = [];
      this.drops = [];
      this.nextId = 1;
      this.finishX = 0;
      // level 6: screen effects (always present, empty by default) and jump-scare markers
      this.fx = { dark: [], strobe: [], mirror: [], lightning: [] };
      this.scares = [];
      // level 4 "Schackmatt": the king boss span, null unless the level calls king()
      this.boss = null;
    }
    add(o) {
      o.id = this.nextId++;
      this.objs.push(o);
      return o;
    }
    // ---- gameplay ----
    block(x, y, w = 1, h = 1, style = 'stone') {
      return this.add({ t: 'solid', x, y, w, h, style });
    }
    // drawn like a block, but it's jagged (a snapped-off dead tree, a clump of spruce boughs), so it
    // kills on touch instead of letting you slide along it; the hitbox leaves out the jagged edge
    thorny(x, y, w, h, style) {
      const top = y === 0; // things standing on the ground are jagged on top, things hanging down at the bottom
      return this.add({ t: 'haz', kind: 'thorny', x, y, w, h, style, hx0: x + 0.1, hx1: x + w - 0.1, hy0: top ? y : y + 0.15, hy1: top ? y + h - 0.15 : y + h, dmg: 12 });
    }
    spike(x, y = 0, style) {
      return this.add({ t: 'haz', kind: 'spike', x, y, w: 1, h: 1, style, hx0: x + 0.35, hx1: x + 0.65, hy0: y + 0.05, hy1: y + 0.6, dmg: style === 'skeleton' ? 14 : 10 });
    }
    spikes(x, n, y = 0, style) {
      for (let i = 0; i < n; i++) this.spike(x + i, y, style);
    }
    // spike hanging down from `top`
    spikeDown(x, top, style) {
      return this.add({ t: 'haz', kind: 'spikeDown', x, y: top - 1, w: 1, h: 1, style, hx0: x + 0.35, hx1: x + 0.65, hy0: top - 0.6, hy1: top - 0.05, dmg: style === 'skeleton' ? 14 : 10 });
    }
    spikesDown(x, n, top, style) {
      for (let i = 0; i < n; i++) this.spikeDown(x + i, top, style);
    }
    half(x, y = 0, style) {
      return this.add({ t: 'haz', kind: 'half', x, y, w: 1, h: 0.5, style, hx0: x + 0.38, hx1: x + 0.62, hy0: y, hy1: y + 0.32, dmg: 10 });
    }
    water(x, w, style) {
      return this.add({ t: 'haz', kind: 'water', x, y: 0, w, h: 0.3, style, hx0: x + 0.1, hx1: x + w - 0.1, hy0: -1, hy1: 0.28, dmg: 10 });
    }
    // a crow (or a pigeon, a gull) hovering at (x, y); its hitbox is smaller than the drawing
    bird(x, y, style) {
      return this.add({ t: 'haz', kind: 'bird', x, y, w: 1, h: 1, style, hx0: x + 0.2, hx1: x + 0.8, hy0: y + 0.25, hy1: y + 0.7, dmg: 12 });
    }
    // ---- level 2: the subway and the sewers ----
    // a stretch of live third rail: touch it and you're out (like water). `style` re-skins it visually
    // (e.g. 'eel' for a bioluminescent eel embedded in the ocean floor) without changing the hitbox.
    rail(x, w, style) {
      return this.add({ t: 'haz', kind: 'rail', x, y: 0, w, h: 0.3, style, hx0: x + 0.1, hx1: x + w - 0.1, hy0: -1, hy1: 0.28, dmg: 10 });
    }
    // a parked metro train: too tall to jump onto from the ground, so use a pad or a step
    train(x, w) {
      return this.block(x, 0, w, 2.5, 'train');
    }
    // a crocodile lying in the sewer water. Its back is a platform, its snapping jaws are not.
    // dir 'left': the jaws face you (jump over them onto its back); 'right': land on the tail, jump off before the jaws
    croc(x, w, dir = 'left') {
      const left = dir === 'left', hx = left ? x : x + w - CROC_HEAD;
      this.block(left ? x + CROC_HEAD - 0.1 : x, 0, w - CROC_HEAD + 0.1, CROC_BACK, left ? 'crocL' : 'crocR');
      return this.add({ t: 'haz', kind: 'croc', dir, x: hx, y: 0, w: CROC_HEAD, h: 1.2, hx0: hx + (left ? 0.1 : 0.25), hx1: hx + CROC_HEAD - (left ? 0.25 : 0.1), hy0: 0, hy1: 0.95 });
    }
    // a crocodile head sticking straight up out of the water with its jaws wide open
    snapper(x) {
      return this.add({ t: 'haz', kind: 'snapper', x, y: 0, w: 1, h: 1.6, hx0: x + 0.25, hx1: x + 0.75, hy0: 0, hy1: 1.25 });
    }
    // a hole in the floor. Fall into it and you come out of the roof of the layer below, which is `shift`
    // blocks further down (15 = exactly one screen, so the two layers sit right on top of each other)
    hole(x, w, shift = 15) {
      this.drops.push({ x0: x, x1: x + w, shift, depth: 1.5 });
    }
    // ---- level 5 "Djupet" (the ocean): a shark lying on the sea floor and an eel darting from a hole ----
    // a shark lying in the current. Its back is a platform, its jaws are not — same idea as croc(), a
    // separate style so art.js can draw a shark instead of a crocodile. dir 'left': jaws face you (jump
    // over them onto its back); 'right': land on the tail, jump off before the jaws.
    shark(x, w, dir = 'left') {
      const left = dir === 'left', hx = left ? x : x + w - SHARK_HEAD;
      this.block(left ? x + SHARK_HEAD - 0.1 : x, 0, w - SHARK_HEAD + 0.1, SHARK_BACK, left ? 'sharkL' : 'sharkR');
      return this.add({ t: 'haz', kind: 'shark', dir, x: hx, y: 0, w: SHARK_HEAD, h: 1.3, hx0: hx + (left ? 0.1 : 0.3), hx1: hx + SHARK_HEAD - (left ? 0.3 : 0.1), hy0: 0, hy1: 1.05, dmg: 12 });
    }
    // an eel darting straight up out of a hole in the sea floor, jaws snapping — same idea as snapper()
    eel(x) {
      return this.add({ t: 'haz', kind: 'eel', x, y: 0, w: 1, h: 1.8, hx0: x + 0.3, hx1: x + 0.7, hy0: 0, hy1: 1.4, dmg: 10 });
    }
    pad(x, y = 0, color = 'yellow') {
      return this.add({ t: 'pad', x: x + 0.1, y, w: 0.8, h: 0.25, color });
    }
    orb(x, y, color = 'yellow') {
      return this.add({ t: 'orb', x: x - 0.1, y: y - 0.1, w: 1.2, h: 1.2, cx: x + 0.5, cy: y + 0.5, color });
    }
    portal(x, mode, opts = {}) {
      return this.add({ t: 'portal', x, y: opts.y == null ? 0 : opts.y, w: 1, h: 3, mode, ceil: opts.ceil == null ? null : opts.ceil, grav: opts.grav || null });
    }
    checkpoint(x, mode = 'cube', y = 0, ceil = null) {
      this.checkpoints.push({ x, mode, y, ceil, index: this.checkpoints.length });
    }
    corridor(x0, x1, ceil, style) {
      this.corridors.push({ x0, x1, ceil, style });
    }
    finish(x) {
      this.finishX = x;
    }
    // ---- level 4 "Schackmatt": the king boss, standing KING_AHEAD blocks ahead of the player while
    // x is inside [x0, x1], and the pawns he throws ----
    // records the boss span; he slides in at x0 and topples over at x1 (the finish)
    king(x0, x1) {
      this.boss = { kind: 'king', x0, x1 };
    }
    // a pawn thrown by the king, landing at (x, y) — y > 0 lands it on top of a platform. mv.type
    // 'throw' (see moveOf in physics.js): the flight lasts from x = o.x - trigger to x = o.x - trigger +
    // fall, always finishing (p reaches 1) well before the player is within 4 blocks of the landing spot,
    // since trigger - fall >= 4 is required below. While flying, the pawn's world x is a lerp from the
    // king's hand (always KING_AHEAD blocks ahead of the player) to the landing x, so it's always ahead
    // of its own landing column until it actually lands there — it can never be touched mid-flight, and
    // the object's static x (used to bucket it into a column, see Level below) stays a valid stand-in for
    // where its hitbox actually is once the player is close enough to reach it.
    pawn(x, y = 0, { trigger = 14, fall = 8, arc = 3 } = {}) {
      if (trigger - fall < 4) throw new Error('pawn(): trigger - fall must be >= 4');
      return this.add({
        t: 'haz', kind: 'pawn', x, y, w: 1, h: 1.3,
        hx0: x + 0.25, hx1: x + 0.75, hy0: y, hy1: y + 1.0, dmg: 10,
        mv: { type: 'throw', trigger, fall, arc, ahead: KING_AHEAD, handY: KING_HAND_Y },
      });
    }
    // ---- level 6: the nightmare (bloody nuns, clowns, moving hazards) ----
    // a nun bobbing up and down in place (mv.type 'bob'); her phase at any x is fixed since x is locked
    // to the level clock, so where she is when you arrive is a level-design choice, not a player one
    nun(x, y, { bob = 0.8, beats = 4, phase = 0 } = {}) {
      return this.add({ t: 'haz', kind: 'nun', x, y, w: 1, h: 1.4, hx0: x + 0.2, hx1: x + 0.8, hy0: y + 0.1, hy1: y + 1.25, dmg: 14, mv: { type: 'bob', amp: bob, beats, phase } });
    }
    // a nun who falls (or, with a negative dist, rises) into place as you approach, starting `trigger`
    // blocks before her x and taking `fall` blocks of travel to finish
    nunDrop(x, y, { trigger = 8, dist = 3, fall = 4 } = {}) {
      return this.add({ t: 'haz', kind: 'nun', x, y, w: 1, h: 1.4, hx0: x + 0.2, hx1: x + 0.8, hy0: y + 0.1, hy1: y + 1.25, dmg: 14, style: 'drop', mv: { type: 'drop', trigger, dist, fall } });
    }
    // a jack-in-the-box: a solid box with a clown head that pops up on a beat (mv.type 'pop'). At rest
    // the head hides inside the box, so standing on the closed box is safe.
    jack(x, { beats = 2, phase = 0, rise = 1.5 } = {}) {
      this.block(x, 0, 1, 1, 'jackbox');
      return this.add({ t: 'haz', kind: 'jack', x, y: 0, w: 1, h: 1, hx0: x + 0.2, hx1: x + 0.8, hy0: 0.15, hy1: 0.9, dmg: 14, mv: { type: 'pop', beats, phase, rise } });
    }
    // an axe pendulum swinging from a pivot at (x+0.5, top) (mv.type 'swing')
    pendulum(x, top, { len = 4, amp = 0.9, beats = 4, phase = 0 } = {}) {
      const half = len * Math.sin(amp) + 0.6; // how far sideways the swing reaches, so the column index covers it
      return this.add({
        t: 'haz', kind: 'pendulum',
        x: x + 0.5 - half, w: half * 2, y: top - len - 0.35, h: len + 0.7,
        hx0: x + 0.05, hx1: x + 0.95, hy0: top - len - 0.35, hy1: top - len + 0.35,
        dmg: 14, mv: { type: 'swing', px: x + 0.5, py: top, len, amp, beats, phase },
      });
    }
    // a clown balloon bobbing at head height (mv.type 'bob')
    balloon(x, y, { bob = 0.6, beats = 4, phase = 0 } = {}) {
      return this.add({ t: 'haz', kind: 'balloon', x, y, w: 1, h: 1.6, hx0: x + 0.2, hx1: x + 0.8, hy0: y + 0.55, hy1: y + 1.5, dmg: 12, mv: { type: 'bob', amp: bob, beats, phase } });
    }
    // ---- level 6: screen effects and jump scares ----
    dark(x0, x1, { r = 7 } = {}) {
      this.fx.dark.push({ x0, x1, r });
    }
    strobe(x0, x1) {
      this.fx.strobe.push({ x0, x1 });
    }
    mirror(x0, x1) {
      this.fx.mirror.push({ x0, x1 });
    }
    lightning(x0, x1) {
      this.fx.lightning.push({ x0, x1 });
    }
    scare(x, kind) {
      this.scares.push({ x, kind });
    }
    // ---- scenery ----
    area(id, x0, name, sub) {
      this.areas.push({ id, x0, name, sub });
    }
    deco(type, x, opts = {}) {
      this.decos.push(Object.assign({ type, x }, opts));
    }
    landmark(type, x, opts = {}) {
      this.landmarks.push(Object.assign({ type, X: x }, opts));
    }
    text(x, y, text, size = 0.5) {
      this.texts.push({ x, y, text, size });
    }
  }

  const CROC_HEAD = 1.4, CROC_BACK = 0.75;
  const SHARK_HEAD = 1.5, SHARK_BACK = 0.85;
  // level 4 "Schackmatt": how far ahead of the player the king stands (the visible screen is W/BS = 1280/48
  // = 26.67 blocks wide and the player sits PX = 8 blocks in from the left edge, so 15 blocks ahead puts him
  // comfortably in view near the right side of the screen), and the height of his throwing hand
  const KING_AHEAD = 15, KING_HAND_Y = 3.2;

  class Level {
    constructor(b, def) {
      this.def = def;
      this.id = def.id;
      this.theme = def.theme;
      this.objs = b.objs;
      this.checkpoints = b.checkpoints;
      this.decos = b.decos.sort((a, c) => a.x - c.x);
      this.landmarks = b.landmarks;
      this.corridors = b.corridors;
      this.texts = b.texts;
      this.fx = b.fx || { dark: [], strobe: [], mirror: [], lightning: [] };
      this.scares = (b.scares || []).slice().sort((a, c) => a.x - c.x);
      this.finishX = b.finishX;
      this.length = b.finishX + 40;
      this.boss = b.boss || null;
      this.areas = b.areas.sort((a, c) => a.x0 - c.x0);
      for (let i = 0; i < this.areas.length; i++) {
        this.areas[i].index = i;
        this.areas[i].x1 = i + 1 < this.areas.length ? this.areas[i + 1].x0 : this.length + 60;
      }
      // holes in the floor split the level into layers: everything past a hole is on the layer below it
      this.drops = b.drops.sort((a, c) => a.x0 - c.x0);
      this.drops.forEach((d, i) => (d.layer = i));
      for (const list of [this.objs, this.checkpoints, this.decos, this.texts]) for (const o of list) if (o.layer == null) o.layer = this.layerAt(o.x);
      for (const list of [this.corridors, this.areas]) for (const o of list) o.layer = this.layerAt(o.x0);
      this.margin = 0;
      this.cols = [];
      for (const o of this.objs) {
        const c0 = Math.max(0, Math.floor(o.x)), c1 = Math.floor(o.x + o.w - 1e-6);
        for (let c = c0; c <= c1; c++) (this.cols[c] || (this.cols[c] = [])).push(o);
      }
      this._stamp = 0;
      this._out = [];
      this._vis = [];
    }
    _collect(c0, c1, out) {
      const stamp = ++this._stamp;
      out.length = 0;
      if (c0 < 0) c0 = 0;
      const cols = this.cols;
      if (c1 > cols.length - 1) c1 = cols.length - 1;
      for (let c = c0; c <= c1; c++) {
        const col = cols[c];
        if (!col) continue;
        for (let i = 0; i < col.length; i++) {
          const o = col[i];
          if (o._s !== stamp) {
            o._s = stamp;
            out.push(o);
          }
        }
      }
      return out;
    }
    // objects that might touch a player standing at x (player box is x..x+1, orbs reach 0.6 further)
    query(x) {
      const c = Math.floor(x);
      return this._collect(c - 1, c + 2, this._out);
    }
    visible(x0, x1) {
      return this._collect(Math.floor(x0) - 1, Math.floor(x1) + 1, this._vis);
    }
    layerAt(x) {
      let n = 0;
      for (const d of this.drops) if (x >= d.x0) n++;
      return n;
    }
    // how far below the top floor the floor of `layer` is (in blocks)
    depthOf(layer) {
      let y = 0;
      for (let i = 0; i < layer && i < this.drops.length; i++) y += this.drops[i].shift;
      return y;
    }
    areaAt(x) {
      const a = this.areas;
      for (let i = a.length - 1; i >= 0; i--) if (x >= a[i].x0) return a[i];
      return a[0];
    }
    checkpointAt(x) {
      let best = 0;
      for (let i = 0; i < this.checkpoints.length; i++) if (this.checkpoints[i].x <= x) best = i;
      return best;
    }
    // level 6: 0..1 strength of a screen effect (fx.dark/strobe/mirror/lightning) at x — 1 inside any
    // zone, ramping linearly over `fade` blocks at both edges, 0 outside
    zone(name, x, fade = 4) {
      const list = this.fx[name];
      if (!list || !list.length) return 0;
      let best = 0;
      for (const z of list) {
        let v;
        if (x < z.x0 - fade || x > z.x1 + fade) v = 0;
        else if (x < z.x0) v = fade > 0 ? (x - (z.x0 - fade)) / fade : 1;
        else if (x > z.x1) v = fade > 0 ? (z.x1 + fade - x) / fade : 1;
        else v = 1;
        if (v > best) best = v;
      }
      return best < 0 ? 0 : best > 1 ? 1 : best;
    }
  }

  // ======================================================================
  // LEVEL 1 — Hem till Storvreta
  // ======================================================================
  function buildHome() {
    const b = new Builder();

    // ============ AREAS ============
    b.area('uppland', -60, 'UPPLAND', 'Fields, runestones & red cottages');
    b.area('gamla', 384, 'GAMLA UPPSALA', 'Climb the royal mounds');
    b.area('uppsala', 512, 'UPPSALA', 'Castle hill & the rooftops');
    b.area('fyris', 704, 'FYRISÅN', 'Hold to fly over the river!');
    b.area('road', 864, 'MOT STORVRETA', 'North along the railway');
    b.area('hall', 1026, 'INNEBANDYHALLEN', 'Tap to flip — floorball time!');
    b.area('home', 1152, 'STORVRETA', 'Almost home…');

    // ============ UPPLAND (0 – 384) ============
    b.checkpoint(0);
    b.text(12, 4.6, 'Tap, click or SPACE to jump', 0.55);
    b.text(12, 3.9, 'Hold to keep jumping', 0.4);
    b.spike(26);
    b.spike(38);
    b.spikes(50, 2);
    b.block(62, 0, 3, 1, 'bale');
    b.spike(71);
    b.block(80, 0, 3, 1, 'stone');
    b.block(83, 0, 3, 2, 'stone');
    b.block(86, 0, 3, 3, 'stone');

    b.checkpoint(96);
    b.spike(106);
    b.spike(110);
    b.block(119, 0, 2, 1, 'bale');
    b.spikes(121, 2);
    b.pad(128);
    b.block(132, 0, 1, 3, 'rune');
    b.spikes(142, 2);
    b.text(150, 5.2, 'Tap on the yellow rings in mid-air!', 0.45);
    b.spikes(152, 5);
    b.orb(154, 2);
    b.half(166);
    b.half(167);
    b.half(168);
    b.block(176, 0, 2, 1, 'bale');
    b.spikes(178, 2);
    b.block(180, 0, 2, 1, 'bale');

    b.checkpoint(192);
    // stepping stones over a brook
    b.block(200, 0, 3, 1, 'stone');
    b.water(203, 3);
    b.block(206, 0, 3, 1, 'stone');
    b.water(209, 3);
    b.block(212, 0, 3, 1, 'stone');
    b.water(215, 3);
    b.block(218, 0, 3, 2, 'stone');
    b.spike(229);
    // moose crossing!
    b.pad(240);
    b.block(244, 0, 3, 2.5, 'moose');
    b.spikes(256, 2);
    b.block(264, 0, 1, 1, 'bale');
    b.block(265, 0, 1, 2, 'bale');
    b.spike(271);
    b.spikes(278, 2);

    b.checkpoint(288);
    // forest trail
    b.block(298, 0, 4, 1, 'log');
    b.spikes(302, 2);
    b.block(304, 0, 4, 1, 'log');
    b.spike(314);
    b.pad(322);
    b.block(325, 3, 7, 1, 'log');
    b.spike(329, 4);
    b.spikes(340, 2);
    // midsummer meadow: rising bale towers
    b.block(350, 0, 1, 1, 'bale');
    b.block(354, 0, 1, 2, 'bale');
    b.block(358, 0, 1, 3, 'bale');
    b.spike(367);
    b.spikes(374, 2);

    // ============ GAMLA UPPSALA (384 – 512) ============
    b.checkpoint(384);
    b.block(396, 0, 4, 1, 'turf');
    b.block(400, 0, 4, 2, 'turf');
    b.block(404, 0, 4, 1, 'turf');
    b.spikes(412, 2);
    // orb staircase up the royal mound
    b.spikes(420, 16);
    b.orb(422, 2);
    b.orb(426, 3);
    b.orb(430, 4);
    b.orb(434, 5);

    b.checkpoint(448);
    b.block(458, 0, 8, 1, 'turf');
    b.block(461, 1, 3, 1, 'turf');
    b.spikes(470, 2);
    b.block(476, 0, 2, 1, 'turf');
    b.spike(478);
    b.block(479, 0, 3, 2, 'turf');
    b.spikes(488, 2);
    b.pad(496);
    b.spikes(498, 3);
    b.block(506, 0, 1, 1, 'turf');

    // ============ UPPSALA (512 – 704) ============
    b.checkpoint(512);
    b.spikes(522, 2, 0);
    b.block(530, 0, 2, 2, 'brick');
    b.spikes(532, 2);
    b.block(534, 0, 2, 2, 'brick');
    // over the rooftops
    b.pad(545);
    b.block(548, 0, 12, 4, 'house');
    b.block(552, 4, 1, 1, 'chimney');
    b.spike(557, 4);
    b.spikes(570, 2);
    b.block(578, 0, 3, 1, 'brick');
    b.block(581, 0, 3, 2, 'brick');
    b.block(584, 0, 3, 3, 'brick');
    b.spikes(587, 3);
    b.spikes(598, 5);
    b.orb(600, 2);

    b.checkpoint(608);
    b.spike(618);
    b.spike(622);
    b.spike(626);
    b.block(634, 0, 1, 1, 'brick');
    b.block(638, 0, 1, 2, 'brick');
    b.block(642, 0, 1, 3, 'brick');
    b.pad(652);
    b.spikes(654, 3);
    b.spikes(664, 6);
    b.orb(666, 2);
    b.spikes(680, 2);
    b.half(688);
    b.half(689);

    // ============ FYRISÅN — ship (704 – 864) ============
    b.checkpoint(704);
    b.text(708, 5.2, 'HOLD to fly up, release to glide down', 0.45);
    b.portal(712, 'ship', { ceil: 10 });
    b.corridor(712, 853, 10, 'fyris');
    b.water(720, 128);
    b.block(726, 0, 2, 4, 'pillar');
    b.spikes(726, 2, 4);
    b.block(738, 6, 2, 4, 'brick');
    b.spikesDown(738, 2, 6);
    b.block(750, 4, 8, 1, 'bridge');
    b.block(764, 0, 12, 3, 'quay');
    b.block(764, 7, 12, 3, 'brick');
    b.spike(769, 3);
    b.spikeDown(772, 7);

    b.checkpoint(784, 'ship', 4.65, 10);
    b.block(794, 0, 2, 5, 'pillar');
    b.block(803, 5.2, 2, 4.8, 'brick');
    b.block(812, 0, 2, 5, 'pillar');
    b.block(821, 5.2, 2, 4.8, 'brick');
    b.block(832, 0, 6, 3, 'quay');
    b.block(832, 6.5, 6, 3.5, 'brick');
    b.portal(852, 'cube', { y: 3.5 });

    // ============ MOT STORVRETA (864 – 1024) ============
    b.checkpoint(864);
    b.spike(876, 0, 'cone');
    b.spikes(884, 2, 0, 'cone');
    b.block(894, 0, 3, 1, 'barrier');
    b.spike(897, 0, 'cone');
    b.block(898, 0, 3, 1, 'barrier');
    b.spikes(908, 2, 0, 'cone');
    b.pad(916);
    b.block(920, 0, 2, 3, 'barrier');
    b.spikes(930, 5, 0, 'cone');
    b.orb(932, 2);

    b.checkpoint(944);
    b.block(954, 0, 4, 1, 'barrier');
    b.block(958, 0, 4, 2, 'barrier');
    b.spikes(962, 2, 0, 'cone');
    b.spike(972, 0, 'cone');
    b.spike(976, 0, 'cone');
    b.spikes(982, 2, 0, 'cone');
    b.block(992, 0, 2, 1, 'barrier');
    b.block(996, 0, 2, 2, 'barrier');
    b.spike(1004, 0, 'cone');
    b.spike(1012, 0, 'cone');

    // ============ INNEBANDYHALLEN — ball (1024 – 1152) ============
    b.checkpoint(1024);
    b.text(1038, 4.2, 'TAP to flip gravity!', 0.5);
    b.portal(1032, 'ball', { ceil: 7 });
    b.corridor(1032, 1145, 7, 'hall');
    b.spikes(1044, 3, 0, 'hall');
    b.spikesDown(1054, 3, 7, 'hall');
    b.spikes(1064, 3, 0, 'hall');
    b.spikesDown(1073, 3, 7, 'hall');
    b.block(1080, 0, 2, 2, 'goal');

    b.checkpoint(1088, 'ball', 0, 7);
    b.spikes(1098, 2, 0, 'hall');
    b.spikesDown(1105, 2, 7, 'hall');
    b.spikes(1112, 2, 0, 'hall');
    b.spikesDown(1119, 2, 7, 'hall');
    b.block(1126, 0, 3, 3, 'goal');
    b.block(1133, 4, 3, 3, 'goalTop');
    b.portal(1144, 'cube', { y: 2 });

    // ============ STORVRETA (1152 – finish) ============
    b.checkpoint(1152);
    b.spike(1164);
    b.spikes(1172, 2);
    b.pad(1180);
    b.block(1184, 0, 2, 3, 'stone');
    b.spikes(1190, 5);
    b.orb(1192, 2);

    b.checkpoint(1200);
    b.spike(1210);
    b.spike(1214);
    b.spikes(1220, 2);
    b.spike(1228);
    b.finish(1240);

    // ============ NEAR SCENERY (world-anchored) ============
    b.deco('sign_region', 4, { text: 'UPPLAND' });
    b.deco('fence', 14, { len: 10 });
    b.deco('lupins', 32);
    b.deco('mailbox', 44);
    b.deco('lupins', 58);
    b.deco('flagpole', 88);
    b.deco('fence', 98, { len: 7 });
    b.deco('runestone', 116);
    b.deco('lupins', 138);
    b.deco('fence', 184, { len: 6 });
    b.deco('birch', 196);
    b.deco('lupins', 224);
    b.deco('sign_moose', 234);
    b.deco('birch', 252);
    b.deco('fence', 282, { len: 8 });
    b.deco('pine', 292);
    b.deco('pine', 311);
    b.deco('lupins', 336);
    b.deco('maypole', 345);
    b.deco('lupins', 364);
    b.deco('runestone', 380);
    b.deco('sign_place', 388, { text: 'Gamla Uppsala' });
    b.deco('runestone', 416);
    b.deco('birch', 446);
    b.deco('runestone', 485);
    b.deco('lupins', 492);
    b.deco('sign_place', 514, { text: 'Uppsala' });
    b.deco('bike', 526);
    b.deco('lamp', 540);
    b.deco('bike', 566, { color: '#2a7bd1' });
    b.deco('lamp', 574);
    b.deco('bench', 594);
    b.deco('lamp', 606);
    b.deco('bike', 614, { color: '#e2b400' });
    b.deco('student', 630);
    b.deco('lamp', 640);
    b.deco('bike', 660);
    b.deco('lamp', 674);
    b.deco('bike', 694, { color: '#2a7bd1' });
    b.deco('lamp', 706);
    b.deco('sign_dist', 868, { text: 'Storvreta', dist: '9' });
    b.deco('lamp', 890);
    b.deco('lamp', 926);
    b.deco('crossing', 948);
    b.deco('lamp', 968);
    b.deco('sign_dist', 986, { text: 'Storvreta', dist: '2' });
    b.deco('lamp', 1000);
    b.deco('sign_place', 1003, { text: 'Storvreta' });
    b.deco('hall_front', 1011);
    b.deco('lamp', 1158);
    b.deco('flagpole', 1168);
    b.deco('lamp', 1188);
    b.deco('lamp', 1218);
    b.deco('finish', 1240);

    // ============ MID-LAYER LANDMARKS (X = world x where it is centred on screen) ============
    b.landmark('cottage', 6, { color: '#9e2a22' });
    b.landmark('pines', 40);
    b.landmark('barn', 70);
    b.landmark('birches', 108);
    b.landmark('moose', 128);
    b.landmark('church', 150);
    b.landmark('cottage', 200, { color: '#a3322a' });
    b.landmark('pines', 232);
    b.landmark('cottage', 300, { color: '#962720' });
    b.landmark('birches', 330);
    b.landmark('barn', 362);
    b.landmark('mounds', 438);
    b.landmark('oldchurch', 494);
    b.landmark('cityrow', 530, { seed: 3 });
    b.landmark('castle', 590);
    b.landmark('cityrow', 648, { seed: 9 });
    b.landmark('stadium', 688);
    b.landmark('cityrow', 730, { seed: 12 });
    b.landmark('cathedral', 772);
    b.landmark('cityrow', 822, { seed: 21 });
    b.landmark('willows', 846);
    b.landmark('farm', 884);
    b.landmark('pines', 918);
    b.landmark('farm', 962, { color: '#e2c35a' });
    b.landmark('birches', 994);
    b.landmark('hall', 1016);
    b.landmark('villas', 1170, { seed: 4 });
    b.landmark('pines', 1196);
    b.landmark('villas', 1222, { seed: 8 });
    b.landmark('home', 1248);

    return b;
  }

  // ======================================================================
  // LEVEL 3 — Vilda skogen (the wild forest). The hardest of the first three: triple spikes, birds, orb chains,
  // a tighter bike ride over the bog and a quicker ball section in the bear cave.
  // ======================================================================
  function buildForest() {
    const b = new Builder();

    // ============ AREAS (each starts on a 4-bar phrase of the music) ============
    b.area('edge', -60, 'SKOGSBRYNET', 'Into the wild forest');
    b.area('spruce', 208, 'GRANSKOGEN', 'Squirrels, logs & crows');
    b.area('bog', 384, 'MYREN', 'Fly low over the bog!');
    b.area('cave', 576, 'BJÖRNGROTTAN', "Shh… don't wake the bear!");
    b.area('ravine', 704, 'BÄCKRAVINEN', 'Leap across the brook');
    b.area('glade', 880, 'GLÄNTAN', 'The sunny clearing');

    // ============ SKOGSBRYNET (0 – 208) ============
    b.checkpoint(0);
    b.text(12, 4.6, 'Level 3 · Vilda skogen', 0.55);
    b.text(12, 3.9, 'Hedgehogs are spiky too!', 0.4);
    b.spike(24, 0, 'hedgehog');
    b.spike(32, 0, 'hedgehog');
    b.spikes(40, 2, 0, 'hedgehog');
    b.block(48, 0, 3, 1, 'log');
    b.spikes(51, 3);
    b.block(54, 0, 3, 1, 'log');
    // three hedgehogs on the beat: jump, land, jump
    b.spike(64, 0, 'hedgehog');
    b.spike(69, 0, 'hedgehog');
    b.spike(74, 0, 'hedgehog');
    // stump staircase over the thorns
    b.block(84, 0, 2, 1, 'stump');
    b.spikes(86, 2);
    b.block(88, 0, 2, 2, 'stump');
    b.spikes(90, 2);
    b.block(92, 0, 2, 3, 'stump');
    b.spikes(94, 4);
    b.spikes(106, 3);
    // moose crossing
    b.pad(114);
    b.block(118, 0, 3, 2.5, 'moose');
    b.spikes(121, 3);

    b.checkpoint(128);
    b.spike(140, 0, 'hedgehog');
    b.text(149, 5.6, 'Stay low under the birds!', 0.45);
    b.bird(147, 1.35);
    b.bird(148.5, 1.55);
    b.bird(150, 1.35);
    b.spike(158, 0, 'hedgehog');
    // stepping stones across the forest pool; only a short gap after the tall stone, so the drop off
    // it works whether you jump straight away, a little later or just run off the edge
    b.block(168, 0, 3, 1, 'rock');
    b.water(171, 4);
    b.block(175, 0, 3, 1, 'rock');
    b.water(178, 3);
    b.block(181, 0, 3, 2, 'rock');
    b.water(184, 2);
    b.block(186, 0, 3, 1, 'rock');
    b.spikes(196, 2);

    // ============ GRANSKOGEN (208 – 384) ============
    // woodpile with a spike on it: jump up, then over the spike and down (no thorns right behind it)
    b.block(206, 0, 5, 1, 'timber');
    b.spike(209, 1);
    b.spikes(222, 2);
    b.spike(232, 0, 'hedgehog');
    b.bird(236, 1.4);
    b.bird(237.5, 1.4);
    b.spike(244, 0, 'hedgehog');

    b.checkpoint(256);
    b.spikes(266, 3);
    // branch hopping over a floor of thorns
    b.pad(279);
    b.spikes(282, 18);
    b.block(284, 2, 3, 0.5, 'branch');
    b.block(290, 3, 3, 0.5, 'branch');
    b.block(296, 2, 3, 0.5, 'branch');
    // orb chain
    b.text(314, 5.8, 'Orb chain!', 0.45);
    b.spikes(310, 13);
    b.orb(311, 2);
    b.orb(316, 2);
    b.orb(321, 2);
    // timber pile with a spike on it and a crow above: jump early!
    b.block(332, 0, 9, 1, 'timber');
    b.spike(338, 1);
    b.bird(340, 3.3);
    b.spikes(341, 2);
    b.spikes(352, 2);
    b.block(361, 0, 2, 1, 'stump');
    b.block(365, 0, 2, 2, 'stump');
    b.spikes(367, 3);
    b.spike(377, 0, 'hedgehog');

    // ============ MYREN — ship over the bog (384 – 576) ============
    b.checkpoint(384);
    b.text(390, 5.4, 'HOLD to fly — dodge the crows!', 0.45);
    b.portal(396, 'ship', { ceil: 9 });
    b.corridor(396, 560, 9, 'boughs');
    b.water(402, 156);
    // the dead trees and the boughs are thorny: touching them crashes the bike
    b.thorny(410, 0, 2, 3, 'deadtree');
    b.thorny(420, 5, 2, 4, 'boughs');
    b.bird(428, 3.2);
    b.thorny(434, 0, 2, 4, 'deadtree');
    b.bird(441, 6.4);
    b.bird(442, 2.2);
    b.thorny(448, 5.5, 3, 3.5, 'boughs');
    b.thorny(456, 0, 2, 3.5, 'deadtree');
    b.bird(463, 6.2);
    b.thorny(468, 0, 3, 2.5, 'deadtree');
    b.thorny(468, 6, 3, 3, 'boughs');

    b.checkpoint(480, 'ship', 4.15, 9);
    b.thorny(490, 0, 2, 4, 'deadtree');
    b.thorny(490, 7.2, 2, 1.8, 'boughs');
    b.thorny(499, 0, 2, 1.8, 'deadtree');
    b.thorny(499, 5, 2, 4, 'boughs');
    b.thorny(508, 0, 2, 4.4, 'deadtree');
    b.thorny(508, 7.6, 2, 1.4, 'boughs');
    b.bird(516, 2.4);
    b.bird(516, 6.2);
    b.thorny(524, 0, 6, 2, 'deadtree');
    b.thorny(524, 5.5, 6, 3.5, 'boughs');
    b.bird(535, 4.2);
    b.thorny(542, 0, 2, 3.8, 'deadtree');
    b.thorny(548, 5.2, 2, 3.8, 'boughs');
    b.portal(560, 'cube', { y: 3 });

    // ============ BJÖRNGROTTAN — ball (576 – 704) ============
    b.checkpoint(576);
    b.text(592, 4.3, 'TAP to flip — quietly!', 0.45);
    b.portal(584, 'ball', { ceil: 6 });
    b.corridor(584, 697, 6, 'cave');
    b.spikes(598, 3, 0, 'cave');
    b.spikesDown(605, 3, 6, 'cave');
    b.spikes(612, 3, 0, 'cave');
    b.spikesDown(619, 3, 6, 'cave');
    b.block(627, 0, 3, 2, 'cave');
    // faster flips: a spike group every 5 blocks
    b.spikesDown(634, 3, 6, 'cave');
    b.spikes(639, 2, 0, 'cave');
    b.spikesDown(644, 2, 6, 'cave');
    b.spikes(649, 2, 0, 'cave');
    b.spikesDown(654, 2, 6, 'cave');
    b.block(660, 4, 3, 2, 'cave');
    b.spikes(666, 3, 0, 'cave');
    b.spikesDown(672, 3, 6, 'cave');
    b.spikes(678, 3, 0, 'cave');
    b.spikesDown(684, 3, 6, 'cave');
    b.portal(696, 'cube', { y: 2 });

    // ============ BÄCKRAVINEN (704 – 880) ============
    b.checkpoint(704);
    b.spikes(716, 3);
    // across the brook: stones, a fox and an orb
    b.block(724, 0, 2, 1, 'rock');
    b.water(726, 4);
    b.block(730, 0, 2, 2, 'rock');
    b.water(732, 7);
    b.orb(735, 3.4);
    b.block(739, 0, 3, 1, 'rock');
    b.water(742, 4);
    b.block(746, 0, 3, 1, 'rock');
    b.spikes(754, 2, 0, 'hedgehog');
    b.block(760, 0, 2, 1.3, 'fox');
    b.spikes(762, 2);
    b.spikes(772, 2);
    // branches over the rapids
    b.water(780, 13);
    b.block(782, 1.5, 3, 0.5, 'branch');
    b.block(788, 2.5, 3, 0.5, 'branch');
    b.spike(796, 0, 'hedgehog');
    b.spike(800, 0, 'hedgehog');
    b.spike(804, 0, 'hedgehog');

    b.checkpoint(816);
    b.spikes(826, 2);
    b.block(834, 0, 3, 1, 'rock');
    b.block(837, 0, 3, 2, 'rock');
    b.spikes(840, 5);
    b.orb(842, 3.2);
    b.block(845, 0, 3, 2, 'rock');
    b.spike(846, 2);
    b.spikes(848, 4);
    b.spikes(860, 3);
    b.bird(867, 1.4);
    b.bird(868.5, 1.4);
    b.spike(875, 0, 'hedgehog');

    // ============ GLÄNTAN (880 – finish) ============
    b.checkpoint(880);
    b.spikes(890, 2);
    b.pad(898);
    b.block(902, 0, 3, 2.5, 'moose');
    b.spikes(905, 3);
    b.spike(914, 0, 'hedgehog');
    b.spike(918, 0, 'hedgehog');
    b.spikes(926, 3);
    b.block(936, 0, 2, 1.3, 'fox');
    b.spikes(946, 2);
    b.spikes(952, 13);
    b.orb(954, 2);
    b.orb(959, 2.6);
    b.orb(964, 2);
    b.spike(976, 0, 'hedgehog');
    b.spikes(984, 2);
    b.finish(1008);

    // ============ NEAR SCENERY ============
    const forest = (x0, x1, seed) => {
      // alternate big spruces and tall pines, with ground plants in between
      const r = VD.U.rng(seed);
      for (let x = x0; x < x1; x += 7 + Math.floor(r() * 6)) {
        const k = r();
        b.deco(k < 0.45 ? 'spruce' : k < 0.85 ? 'pinetree' : 'birch', x);
        const g = r();
        if (g < 0.8) b.deco(g < 0.3 ? 'fern' : g < 0.5 ? 'berries' : g < 0.65 ? 'shrooms' : 'fern', x + 3 + Math.floor(r() * 2));
      }
    };
    b.deco('trailsign', 4, { text: 'Vilda skogen' });
    forest(10, 44, 11);
    // (big animals stand in the gaps between obstacles so they never look like something to jump over)
    b.deco('squirrel', 46, { stump: true });
    b.deco('hare', 60);
    forest(62, 100, 12);
    b.deco('anthill', 101);
    b.deco('moose', 134);
    forest(140, 166, 13);
    b.deco('reeds', 171);
    b.deco('crane', 178);
    b.deco('reeds', 184);
    b.deco('woodpecker', 192);
    b.deco('squirrel', 200, { stump: true });
    forest(206, 240, 14);
    b.deco('squirreltree', 241);
    b.deco('moose', 250, { calf: true });
    b.deco('foxsit', 261);
    forest(266, 276, 15);
    b.deco('owl', 278);
    forest(286, 330, 16);
    b.deco('squirrel', 348, { stump: true });
    forest(352, 372, 17);
    b.deco('trailsign', 381, { text: 'Myren' });
    b.deco('reeds', 388);
    for (let x = 398; x < 556; x += 13) b.deco('reeds', x + (x % 3));
    for (const x of [408, 446, 482, 520, 546]) b.deco('crane', x);
    b.deco('cavehill', 552, { w: 50, span: 50, mouth: 20.5 });
    // inside the bear cave
    b.deco('glowshrooms', 590, { inside: true });
    b.deco('crystals', 604, { inside: true });
    b.deco('bear', 636, { inside: true });
    b.deco('glowshrooms', 662, { inside: true });
    b.deco('crystals', 679, { inside: true });
    b.deco('cavehill', 689, { w: 14, span: 14 });
    b.deco('foxsit', 712);
    forest(716, 720, 18);
    b.deco('reeds', 727);
    b.deco('reeds', 741);
    b.deco('deer', 751, { graze: true });
    forest(756, 790, 19);
    b.deco('woodpecker', 792);
    b.deco('hare', 809);
    forest(812, 836, 20);
    b.deco('owl', 838);
    forest(846, 874, 21);
    b.deco('trailsign', 878, { text: 'Gläntan' });
    b.deco('lupins', 881);
    b.deco('birch', 886);
    b.deco('hare', 910.5);
    b.deco('birch', 922);
    b.deco('lupins', 930.5);
    b.deco('deer', 942);
    b.deco('birch', 958);
    b.deco('squirrel', 970, { stump: true });
    b.deco('lupins', 988);
    b.deco('camp', 996);
    b.deco('finish', 1008);

    // ============ MID-LAYER LANDMARKS ============
    b.landmark('jakttorn', 22);
    b.landmark('spruces', 64);
    b.landmark('moosecalf', 104);
    b.landmark('tarn', 168);
    b.landmark('spruces', 216);
    b.landmark('foxrun', 262);
    b.landmark('spruces', 300);
    b.landmark('deer', 352);
    b.landmark('deadtrees', 404);
    b.landmark('cranes', 446);
    b.landmark('deadtrees', 492);
    b.landmark('cranes', 526);
    b.landmark('rockhill', 566);
    b.landmark('rockhill', 716);
    b.landmark('spruces', 764);
    b.landmark('deer', 806);
    b.landmark('spruces', 850);
    b.landmark('firetower', 902);
    b.landmark('cottage', 940, { color: '#a3322a' });
    b.landmark('moosecalf', 978);
    b.landmark('birches', 1010);

    return b;
  }

  // ======================================================================
  // LEVEL 4 — Schackmatt (the chess level). Harder than the forest, a little easier than Djupet: a giant
  // marble chessboard under a twilight sky. Pawn spikes and halves give way to rising/falling pedestal
  // staircases (b.block heights 1-4) and a pad up onto a tall rook; SPRINGARNA is all "knight's L-jumps" —
  // pads onto high platforms, short drops to low ones, orbs at three different heights over long spike
  // rows; TORNET is a ship flight up inside a rook tower with winding floor/ceiling gaps (b.thorny 'spire'
  // / 'banner'); LÖPARENS DIAGONAL is a ball section threading floor/ceiling spikes in the bishop's
  // diagonal pattern; DAMENS SAL mixes every tool at once (the queen moves anywhere); KUNGENS TRON is a
  // boss fight against the king himself, who throws pawns (b.king()/b.pawn(), see physics.js moveOf
  // 'throw') that land on the ground and on platforms of different heights.
  // ======================================================================
  function buildChess() {
    const b = new Builder();

    // ============ AREAS ============
    b.area('board', -60, 'BRÄDET', 'Onto the giant chessboard');
    b.area('knights', 208, 'SPRINGARNA', "The knights' L-jumps");
    b.area('tower', 384, 'TORNET', 'Up inside the rook tower');
    b.area('diagonal', 576, 'LÖPARENS DIAGONAL', 'Tap to flip — the bishop strikes!');
    b.area('queen', 704, 'DAMENS SAL', 'The queen moves anywhere');
    b.area('throne', 880, 'KUNGENS TRON', 'The king awakens!');

    // ============ BRÄDET (0 – 208) ============
    b.checkpoint(0);
    b.text(12, 4.6, 'Level 4 · Schackmatt', 0.55);
    b.text(12, 3.9, 'Pawns are spikes too!', 0.4);
    b.spike(22, 0, 'pawnspike');
    b.spike(32, 0, 'pawnspike');
    b.spikes(42, 2, 0, 'pawnspike');
    b.half(52);
    b.half(56);
    b.spikes(64, 2, 0, 'pawnspike');
    b.block(72, 0, 3, 1, 'marble');
    b.spikes(76, 2, 0, 'pawnspike');
    // a rising staircase of pedestals: 1 -> 2 -> 3 (each jump is only a 1-block net rise, taken from
    // the top of the previous step, never a fresh jump from the ground — a standing jump only reaches
    // about 2.2 blocks up)
    b.block(82, 0, 2, 1, 'marble');
    b.block(86, 0, 2, 2, 'marble');
    b.block(90, 0, 2, 3, 'marble');
    // ...then falling: 3 -> 2 -> 1 (stepping down is never a height problem, only stepping up is)
    b.block(94, 0, 2, 2, 'ebony');
    b.block(98, 0, 2, 1, 'ebony');
    b.spikes(102, 2, 0, 'pawnspike');
    // a spike standing on top of a height-2 pedestal, reached directly (height 2 is within jump range)
    b.block(110, 0, 3, 2, 'ebony');
    b.spike(111, 2, 'pawnspike');

    b.checkpoint(120);
    b.spikes(128, 2, 0, 'pawnspike');
    // a pad up onto a tall rook
    b.pad(136);
    b.block(140, 0, 3, 3, 'rook');
    b.spikes(146, 2, 0, 'pawnspike');
    b.block(154, 0, 2, 1, 'marble');
    b.block(158, 0, 2, 1, 'ebony');
    b.spikes(164, 2, 0, 'pawnspike');
    b.half(172);
    b.half(176);
    b.spikes(182, 3, 0, 'pawnspike');
    b.block(190, 0, 2, 2, 'marble');
    b.spike(191, 2, 'pawnspike');
    b.spikes(198, 2, 0, 'pawnspike');
    b.spike(206, 0, 'pawnspike');

    // ============ SPRINGARNA (208 – 384) ============
    b.checkpoint(208);
    b.text(212, 5.4, "The knights' L-jumps", 0.45);
    b.spikes(216, 2, 0, 'pawnspike');
    // an L-jump: a pad launches you up high, then you drop down to a low landing
    b.pad(224);
    b.block(228, 0, 2, 4, 'marble');
    b.block(236, 0, 2, 1, 'ebony');
    b.spikes(242, 2, 0, 'pawnspike');
    b.pad(250);
    b.block(254, 0, 2, 3, 'ebony');
    b.block(261, 0, 2, 1, 'marble');
    b.spikes(268, 3, 0, 'pawnspike');
    // a long spike row with a rising chain of orbs at four different heights
    b.text(278, 5.8, 'Orbs at every height!', 0.45);
    b.spikes(276, 14, 0, 'pawnspike');
    b.orb(278, 2);
    b.orb(282, 3.2);
    b.orb(286, 4.4);
    b.orb(289, 5.6);

    b.checkpoint(296);
    b.block(304, 0, 2, 1, 'marble');
    b.spikes(312, 2, 0, 'pawnspike');
    b.pad(314);
    b.block(318, 0, 2, 4, 'ebony');
    b.block(325, 0, 2, 1, 'marble');
    b.spikes(332, 3, 0, 'pawnspike');
    // a platform bridge over a long row of spikes — a pad launches you up onto it (height 2.5 is just
    // out of standing-jump range); plenty of flat ground before the pad so you land on it, not fly over it
    b.pad(339);
    b.spikes(342, 10, 0, 'pawnspike');
    b.block(344, 2.5, 6, 0.5, 'bridge');
    b.block(354, 0, 2, 1, 'ebony');
    b.spikes(362, 2, 0, 'pawnspike');
    b.pad(370);
    b.block(374, 0, 2, 3, 'marble');
    b.spikes(382, 2, 0, 'pawnspike');

    // ============ TORNET — ship, up inside a rook tower (384 – 576) ============
    b.checkpoint(384);
    b.text(388, 5.4, 'HOLD to fly — up the rook tower!', 0.45);
    b.portal(392, 'ship', { ceil: 9 });
    b.corridor(392, 566, 9, 'rooktower');
    b.water(398, 160, 'current'); // a dark, swirling pit down the middle of the tower shaft
    b.thorny(404, 0, 1, 2, 'spire');
    b.thorny(408, 7, 1, 2, 'banner');
    b.thorny(416, 0, 1, 2.5, 'spire');
    b.thorny(420, 6.5, 1, 2.5, 'banner');
    b.thorny(430, 0, 1, 3, 'spire');
    b.thorny(434, 6, 1, 3, 'banner');
    b.thorny(442, 0, 1, 2, 'spire');
    b.thorny(446, 7, 1, 2, 'banner');
    b.thorny(454, 0, 1, 2.5, 'spire');
    b.thorny(458, 6.5, 1, 2.5, 'banner');
    b.thorny(468, 0, 1, 3, 'spire');
    b.thorny(472, 6, 1, 3, 'banner');

    b.checkpoint(480, 'ship', 4.15, 9);
    b.thorny(488, 0, 1, 2, 'spire');
    b.thorny(492, 7, 1, 2, 'banner');
    b.thorny(500, 0, 1, 2.5, 'spire');
    b.thorny(504, 6.5, 1, 2.5, 'banner');
    b.thorny(512, 0, 1, 3, 'spire');
    b.thorny(516, 6, 1, 3, 'banner');
    b.thorny(524, 0, 1, 1.5, 'spire');
    b.thorny(528, 5, 1, 4, 'banner');
    b.thorny(536, 0, 1, 4, 'spire');
    b.thorny(540, 8, 1, 1, 'banner');
    b.thorny(548, 0, 1, 2.5, 'spire');
    b.thorny(552, 6.5, 1, 2.5, 'banner');
    b.portal(566, 'cube', { y: 3 });

    // ============ LÖPARENS DIAGONAL — ball, the bishop's diagonal (576 – 704) ============
    b.checkpoint(576);
    b.text(580, 4.3, "TAP to flip — the bishop's diagonal!", 0.45);
    b.spikes(579, 3, 0, 'pawnspike'); // a tight cube-mode triple right at the checkpoint, before the portal
    b.portal(584, 'ball', { ceil: 6 });
    b.corridor(584, 700, 6, 'cathedral');
    b.spikes(596, 3, 0, 'diagonal');
    b.spikesDown(603, 3, 6, 'diagonal');
    b.spikes(610, 3, 0, 'diagonal');
    b.spikesDown(617, 2, 6, 'diagonal');
    b.block(621, 0, 3, 2, 'ebony');
    b.spikesDown(627, 3, 6, 'diagonal');
    b.spikes(632, 2, 0, 'diagonal');
    b.spikesDown(637, 2, 6, 'diagonal');
    b.orb(644, 3.2);
    b.spikes(646, 2, 0, 'diagonal');
    b.block(656, 4, 3, 2, 'marble');
    b.spikesDown(663, 2, 6, 'diagonal');
    b.spikes(668, 3, 0, 'diagonal');
    b.spikesDown(675, 3, 6, 'diagonal');
    b.spikes(682, 2, 0, 'diagonal');
    b.orb(688, 3.5);
    b.spikesDown(690, 3, 6, 'diagonal');
    b.spikes(696, 3, 0, 'diagonal');
    b.portal(700, 'cube', { y: 2 });

    // ============ DAMENS SAL (704 – 880), the hardest stretch — everything mixed at once ============
    b.checkpoint(704);
    b.spikes(714, 3, 0, 'pawnspike');
    // a mini rising staircase up to a spike-topped height-3 landing (a wide landing, so there's room
    // to time the jump over the spike before running off the end)
    b.block(720, 0, 2, 1, 'marble');
    b.block(724, 0, 2, 2, 'ebony');
    b.block(728, 0, 4, 3, 'marble');
    b.spike(731, 3, 'pawnspike');
    b.pad(736);
    b.block(740, 0, 2, 4, 'marble');
    // a height-drop onto a spike-edged landing: land short of the first spike or in the gap between
    // the two, well clear of both platform edges
    b.block(750, 0, 7, 2, 'ebony');
    b.spike(752, 2, 'pawnspike');
    b.spike(755, 2, 'pawnspike');
    b.spikes(763, 3, 0, 'pawnspike');
    b.orb(769, 2);
    b.block(773, 0, 2, 1, 'marble');
    b.block(777, 0, 2, 2, 'ebony');
    b.block(781, 0, 2, 3, 'marble');
    b.spikes(789, 2, 0, 'pawnspike');
    b.pad(792);
    b.block(796, 0, 2, 3, 'ebony');

    b.checkpoint(800);
    b.spikes(808, 3, 0, 'pawnspike');
    b.orb(816, 3.5);
    b.block(820, 0, 2, 1, 'marble');
    b.pad(824);
    b.block(828, 0, 2, 4, 'marble');
    b.block(836, 0, 3, 1, 'ebony');
    b.spikes(842, 3, 0, 'pawnspike');
    b.block(850, 0, 2, 2, 'marble');
    b.spike(851, 2, 'pawnspike');
    b.pad(858);
    b.block(862, 0, 2, 3, 'ebony');
    b.spikes(870, 3, 0, 'pawnspike');
    b.spike(878, 0, 'pawnspike');

    // ============ KUNGENS TRON (880 – finish), the boss: the king throws pawns ============
    b.checkpoint(880);
    b.text(884, 5.4, 'The king awakens!', 0.45);
    b.king(880, 1024);
    b.pawn(890, 0);
    b.pawn(898, 0);
    b.block(906, 0, 3, 2, 'marble');
    b.pawn(908, 2);
    b.pawn(916, 0);
    b.pawn(924, 0);
    b.pad(928);
    b.block(932, 0, 3, 3, 'ebony');
    b.pawn(934, 3);
    b.pad(944);
    b.block(948, 0, 2, 4, 'marble');
    b.pawn(958, 0);
    b.pawn(966, 0);
    b.block(972, 0, 3, 1, 'ebony');
    b.pawn(974, 1);
    b.pawn(982, 0);
    b.spike(990, 0, 'pawnspike');
    b.pawn(998, 0);
    b.block(1006, 0, 3, 2, 'marble');
    b.pawn(1008, 2);
    b.pawn(1016, 0);
    b.text(1000, 5.8, 'Schack matt!', 0.5);
    b.finish(1024);

    // ============ NEAR SCENERY ============
    b.deco('trailsign', 4, { text: 'Schackmatt' });
    b.deco('flagpole', 30);
    b.deco('flagpole', 96);
    b.deco('flagpole', 160);
    b.deco('trailsign', 212, { text: 'Springarna' });
    b.deco('flagpole', 260);
    b.deco('flagpole', 330);
    b.deco('candles', 410, { inside: true });
    b.deco('candles', 450, { inside: true });
    b.deco('candles', 494, { inside: true });
    b.deco('candles', 532, { inside: true });
    b.deco('trailsign', 580, { text: 'Löparens diagonal' });
    b.deco('trailsign', 708, { text: 'Damens sal' });
    b.deco('flagpole', 760);
    b.deco('flagpole', 830);
    b.deco('trailsign', 884, { text: 'Kungens tron' });
    b.deco('flagpole', 946);
    b.deco('flagpole', 1000);
    b.deco('finish', 1024);

    // ============ MID-LAYER LANDMARKS (X = world x where it is centred on screen) ============
    b.landmark('rookpiece', 40);
    b.landmark('knightpiece', 250);
    b.landmark('rookpiece', 372);
    b.landmark('bishoppiece', 592);
    b.landmark('queenpiece', 740);
    b.landmark('bishoppiece', 826);

    return b;
  }

  // ======================================================================
  // LEVEL 5 — Djupet (the deep). Harder than the forest, easier than the nightmare: no health bar, no
  // age gate, no jump scares. Genuinely different tools than the forest ever touches: b.half() for low
  // fast hops, b.shark()/b.eel() (new, croc()/snapper() reinterpreted), b.rail() reskinned as a live eel
  // in a floor gap, and a real b.hole() layer-drop partway through the wreck that puts the rest of the
  // level (jellyfish swarm onward) on a deeper floor — the forest never changes floors. A coral reef ->
  // a sunken wreck that caves in -> a jellyfish swarm by ship -> straight through a whale's mouth by
  // ball, irregular rhythm and orb-assisted flips -> the darkest, longest, tightest unbroken stretch in
  // the deep trench -> up into the sunlit shallows.
  // ======================================================================
  function buildOcean() {
    const b = new Builder();

    // ============ AREAS (same six boundaries as Vilda skogen so the length matches; content is new) ============
    b.area('reef', -60, 'KORALLREVET', 'Into the warm shallows');
    b.area('wreck', 208, 'VRAKET', 'Down into the sunken wreck');
    b.area('swarm', 384, 'MANETSVÄRMEN', 'Hold to swim — weave through the jellyfish!');
    b.area('whale', 576, 'VALENS BUK', 'Tap to flip — swum right into a whale!');
    b.area('deep', 704, 'DJUPHAVET', 'Into the darkest trench');
    b.area('surface', 880, 'YTAN', 'Swim for the light!');

    // ============ KORALLREVET (0 – 208) ============
    b.checkpoint(0);
    b.text(12, 4.6, 'Level 5 · Djupet', 0.55);
    b.text(12, 3.9, 'Sea urchins are spiky too!', 0.4);
    b.spike(22, 0, 'urchin');
    b.half(27); // a low, fast hop — the forest never uses this
    b.half(31);
    b.spikes(36, 2, 0, 'urchin');
    b.block(44, 0, 2, 1, 'coral');
    b.spikes(46, 2); // an adjacent double right off the coral's edge
    b.block(52, 0, 2, 1, 'coral');
    b.half(56);
    b.spike(60, 0, 'urchin');
    b.spikes(64, 3, 0, 'urchin');
    b.pad(77);
    // a reef shark lying in the current: its back is a platform, its jaws are not
    b.shark(80, 5, 'left');
    b.spikes(88, 2, 0, 'urchin');
    // a RISING staircase of coral pillars over the current — not a flat stepping-stone hop
    b.block(94, 0, 2, 1, 'coral');
    b.water(96, 3, 'current');
    b.block(99, 0, 2, 2, 'coral');
    b.water(101, 3, 'current');
    b.block(104, 0, 2, 3, 'coral');
    b.water(106, 2, 'current');
    b.block(108, 0, 2, 4, 'coral');
    b.spikes(112, 2);

    b.checkpoint(120);
    b.text(129, 5.6, 'Stay low under the jellyfish!', 0.45);
    b.bird(127, 1.35, 'jellyfish');
    b.bird(128.5, 1.55, 'jellyfish');
    b.bird(130, 1.35, 'jellyfish');
    b.spike(136, 0, 'urchin');
    b.half(142);
    b.half(146);
    b.spikes(150, 3, 0, 'urchin');
    b.block(160, 0, 3, 1, 'coral');
    b.spikes(163, 3);
    b.shark(172, 5, 'right');
    b.spikes(180, 2, 0, 'urchin');
    b.half(186);
    b.half(190);
    b.spikes(194, 3, 0, 'urchin');
    b.spikes(202, 2);

    // ============ VRAKET (208 – 384) — ends with the floor caving in ============
    b.checkpoint(208);
    b.spikes(212, 2, 0, 'urchin');
    // the hull deck is too tall to jump onto without the pad
    b.pad(218);
    b.block(222, 0, 4, 3.2, 'hull');
    b.spikes(228, 2);
    // a bioluminescent eel embedded in a gap in the deck — rail()'s mechanic, restyled
    b.rail(233, 3, 'eel');
    b.spikes(239, 2, 0, 'urchin');
    b.block(245, 0, 3, 1, 'hull');
    b.spikes(249, 3);
    // a RISING bubble chain up through a cargo shaft — vertical, not the forest's flat arc
    b.text(260, 5.8, 'Bubble shaft — ride it up!', 0.45);
    b.spikes(258, 14);
    b.orb(260, 2);
    b.orb(264, 3.2);
    b.orb(268, 4.4);
    b.orb(271, 5.6);
    b.block(275, 0, 3, 2, 'hull');

    b.checkpoint(284);
    b.shark(288, 5, 'left');
    b.spikes(296, 2, 0, 'urchin');
    b.rail(301, 3, 'eel');
    b.pad(307);
    b.block(311, 0, 3, 4, 'hull');
    b.spikes(317, 3);
    b.half(324);
    b.half(328);
    b.spikes(332, 2, 0, 'urchin');
    b.shark(338, 5, 'right');
    b.spikes(346, 3);
    b.text(352, 5.4, 'The sea floor is giving way…', 0.45);
    b.spike(356, 0, 'urchin');
    // the wreck's hold gives way beneath you — everything from here on is one floor deeper
    b.hole(364, 8, 16);

    // ============ MANETSVÄRMEN — ship, on the deeper floor (384 – 576) ============
    // small, frequent jellyfish/coral clusters instead of a few big ones — a denser weave
    b.checkpoint(384);
    b.spikes(386, 2, 0, 'urchin');
    b.portal(392, 'ship', { ceil: 9 });
    b.corridor(392, 566, 9, 'jelly');
    b.text(396, 5.4, 'HOLD to swim — dodge the jellyfish!', 0.45);
    b.water(398, 160, 'current');
    b.thorny(404, 0, 1, 2, 'coralspike');
    b.thorny(408, 7, 1, 2, 'jellytentacle');
    b.bird(412, 4, 'jellyfish');
    b.thorny(416, 0, 1, 2.5, 'coralspike');
    b.thorny(420, 6.5, 1, 2.5, 'jellytentacle');
    b.bird(425, 2.5, 'anglerfish'); // an anglerfish this early breaks the jellyfish pattern on purpose
    b.thorny(430, 0, 1, 3, 'coralspike');
    b.thorny(434, 6, 1, 3, 'jellytentacle');
    b.bird(438, 4.5, 'jellyfish');
    b.thorny(442, 0, 1, 2, 'coralspike');
    b.thorny(446, 7, 1, 2, 'jellytentacle');
    b.bird(450, 3, 'jellyfish');
    b.thorny(454, 0, 1, 2.5, 'coralspike');
    b.thorny(458, 6.5, 1, 2.5, 'jellytentacle');
    b.bird(462, 4, 'jellyfish');

    b.checkpoint(468, 'ship', 4.15, 9);
    b.thorny(474, 0, 1, 3, 'coralspike');
    b.thorny(478, 6, 1, 3, 'jellytentacle');
    b.bird(482, 2.5, 'jellyfish');
    b.thorny(486, 0, 1, 2, 'coralspike');
    b.thorny(490, 7, 1, 2, 'jellytentacle');
    b.bird(494, 4, 'anglerfish');
    b.thorny(498, 0, 1, 2.5, 'coralspike');
    b.thorny(502, 6.5, 1, 2.5, 'jellytentacle');
    b.bird(506, 3, 'jellyfish');
    b.thorny(510, 0, 1, 3, 'coralspike');
    b.thorny(514, 6, 1, 3, 'jellytentacle');
    b.thorny(519, 0, 1, 2, 'coralspike');
    b.thorny(523, 7, 1, 2, 'jellytentacle');
    b.bird(528, 4.5, 'jellyfish');
    b.thorny(533, 0, 1, 2.5, 'coralspike');
    b.thorny(537, 6.5, 1, 2.5, 'jellytentacle');
    b.thorny(543, 0, 1, 3, 'coralspike');
    b.thorny(547, 6, 1, 3, 'jellytentacle');
    b.thorny(553, 0, 1, 2, 'coralspike');
    b.thorny(557, 7, 1, 2, 'jellytentacle');
    b.portal(566, 'cube', { y: 3 });

    // ============ VALENS BUK — ball, straight through the whale's mouth (576 – 704) ============
    b.checkpoint(576);
    // the jaws: a row of teeth you hop over just before the whale swallows you whole
    b.spikes(582, 3, 0, 'tooth');
    b.portal(590, 'ball', { ceil: 6 });
    b.corridor(590, 696, 6, 'rib');
    b.text(596, 4.3, 'TAP to flip — through the whale!', 0.45);
    // an IRREGULAR gut-like rhythm, not the bear cave's steady "every 5 blocks": short groups, a tight
    // triple, orb-assisted flips through the wider gaps — the bear cave never uses orbs at all
    b.spikes(598, 2, 0, 'rib');
    b.spikesDown(603, 2, 6, 'rib');
    b.spikes(608, 1, 0, 'rib');
    b.spikesDown(611, 3, 6, 'rib');
    b.block(617, 0, 3, 2, 'rib');
    b.spikes(623, 3, 0, 'rib');
    b.spikesDown(628, 2, 6, 'rib');
    b.orb(633, 3.2);
    b.spikesDown(635, 3, 6, 'rib');
    b.spikes(641, 2, 0, 'rib');
    b.block(647, 4, 3, 2, 'rib');
    b.spikesDown(653, 2, 6, 'rib');
    b.spikes(656, 3, 0, 'rib');
    b.spikesDown(662, 2, 6, 'rib');
    b.orb(667, 3.5);
    b.spikes(669, 3, 0, 'rib');
    b.spikesDown(675, 2, 6, 'rib');
    b.spikes(679, 2, 0, 'rib');
    b.spikesDown(684, 3, 6, 'rib');
    b.spikes(690, 3, 0, 'rib');
    b.portal(696, 'cube', { y: 2 });

    // ============ DJUPHAVET (704 – 880), no checkpoint before the surface — the hardest, tightest, ============
    // ============ longest unbroken stretch in the level ============
    b.checkpoint(704);
    b.text(708, 5.4, 'Into the dark deep…', 0.45);
    b.spikes(714, 3, 0, 'urchin');
    b.eel(721); // an eel darting out of a hole in the floor — new, the forest never has this
    b.spikes(726, 2, 0, 'urchin');
    b.block(732, 0, 2, 1, 'kelp');
    b.water(734, 4, 'current');
    b.block(738, 0, 3, 2, 'kelp');
    b.spikes(746, 3, 0, 'urchin'); // a tight triple
    b.shark(754, 5, 'left');
    b.spikes(762, 3);
    b.eel(770);
    b.spikes(776, 3, 0, 'urchin');
    b.orb(778, 3.4);
    b.spikes(784, 2);
    b.block(790, 0, 3, 2, 'glowstone');
    b.spike(791, 2);
    b.spikes(797, 3, 0, 'urchin');
    b.eel(805);
    b.spikes(810, 2);
    b.shark(816, 5, 'right');
    b.spikes(826, 3, 0, 'urchin'); // another tight triple, with clearance off the shark's tail
    b.block(833, 0, 3, 2, 'glowstone');
    b.spikes(838, 3);
    b.eel(846);
    b.spikes(851, 3, 0, 'urchin');
    b.water(856, 13, 'current');
    b.block(858, 1.5, 3, 0.5, 'kelp');
    b.block(864, 2.5, 3, 0.5, 'kelp');
    b.spikes(873, 3);

    // ============ YTAN (880 – finish) ============
    b.checkpoint(880);
    b.spikes(884, 2, 0, 'urchin');
    b.pad(890);
    b.block(894, 0, 3, 2.5, 'dolphin');
    b.spikes(898, 3);
    b.spike(906, 0, 'urchin');
    b.spikes(910, 2, 0, 'urchin');
    b.half(916);
    b.half(920);
    b.spikes(924, 3);
    b.block(932, 0, 2, 1.3, 'coral');
    b.spikes(938, 2);
    // a RISING bubble chain to finish — vertical, not the forest's flat arc: you're swimming for the surface
    b.text(946, 5.8, 'Rise to the light!', 0.45);
    b.spikes(944, 16);
    b.orb(946, 2);
    b.orb(950, 3.2);
    b.orb(954, 4.4);
    b.orb(958, 5.6);
    b.orb(962, 6.4);
    b.spike(968, 0, 'urchin');
    b.spikes(974, 2, 0, 'urchin');
    b.pad(980);
    b.block(984, 0, 3, 2, 'coral');
    b.spikes(989, 3);
    b.orb(994, 2.5);
    b.spikes(998, 2, 0, 'urchin');
    b.spikes(1004, 3);
    b.finish(1024);

    // ============ NEAR SCENERY ============
    const reefLife = (x0, x1, seed) => {
      // alternate coral clumps and swaying kelp, with small ground life in between
      const r = VD.U.rng(seed);
      for (let x = x0; x < x1; x += 6 + Math.floor(r() * 6)) {
        const k = r();
        b.deco(k < 0.45 ? 'coral' : k < 0.8 ? 'kelp' : 'seaweed', x);
        const g = r();
        if (g < 0.7) b.deco(g < 0.35 ? 'starfish' : 'bubbles', x + 2 + Math.floor(r() * 2));
      }
    };
    b.deco('trailsign', 4, { text: 'Djupet' });
    reefLife(10, 44, 111);
    b.deco('fishschool', 46);
    reefLife(62, 100, 112);
    b.deco('starfish', 101);
    b.deco('fishschool', 134);
    reefLife(140, 166, 113);
    b.deco('bubbles', 171);
    b.deco('fishschool', 178);
    b.deco('bubbles', 184);
    reefLife(206, 240, 114);
    b.deco('octopus', 241);
    b.deco('fishschool', 250);
    reefLife(266, 276, 115);
    b.deco('porthole', 278);
    reefLife(286, 330, 116);
    b.deco('octopus', 348);
    reefLife(352, 372, 117);
    b.deco('trailsign', 381, { text: 'Manetsvärmen' });
    b.deco('bubbles', 388);
    for (let x = 398; x < 556; x += 13) b.deco('bubbles', x + (x % 3));
    for (const x of [408, 446, 482, 520, 546]) b.deco('fishschool', x);
    b.deco('bioglow', 552, { inside: true });
    // inside the whale
    b.deco('bioglow', 610, { inside: true });
    b.deco('bioglow', 648, { inside: true });
    b.deco('bioglow', 686, { inside: true });
    b.deco('bubbles', 712);
    reefLife(716, 720, 118);
    b.deco('bubbles', 727);
    b.deco('bioglow', 741);
    b.deco('fishschool', 751);
    reefLife(756, 790, 119);
    b.deco('bioglow', 792);
    b.deco('starfish', 809);
    reefLife(812, 836, 120);
    b.deco('bioglow', 838);
    reefLife(846, 874, 121);
    b.deco('trailsign', 878, { text: 'Ytan' });
    b.deco('seaweed', 881);
    b.deco('kelp', 886);
    b.deco('fishschool', 910.5);
    b.deco('kelp', 922);
    b.deco('starfish', 930.5);
    b.deco('fishschool', 942);
    b.deco('kelp', 958);
    b.deco('coral', 970);
    b.deco('seaweed', 988);
    b.deco('bubbles', 996);
    b.deco('finish', 1024);

    // ============ MID-LAYER LANDMARKS ============
    b.landmark('reeftower', 22);
    b.landmark('kelpforest', 64);
    b.landmark('reeftower', 104);
    b.landmark('kelpforest', 168);
    b.landmark('reeftower', 216);
    b.landmark('shipwreck', 262);
    b.landmark('reeftower', 300);
    b.landmark('kelpforest', 352);
    b.landmark('kelpforest', 404);
    b.landmark('kelpforest', 446);
    // the whale looms well before its mouth, out in the current
    b.landmark('whale', 492);
    b.landmark('kelpforest', 526);
    b.landmark('kelpforest', 566);
    b.landmark('kelpforest', 716);
    b.landmark('reeftower', 764);
    b.landmark('kelpforest', 806);
    b.landmark('reeftower', 850);
    b.landmark('reeftower', 902);
    b.landmark('kelpforest', 940);
    b.landmark('reeftower', 978);
    b.landmark('kelpforest', 1010);

    return b;
  }

  // ======================================================================
  // LEVEL 2 — Tunnelbanan (the Stockholm subway). The step up after level 1: surf the
  // parked trains over the live rail, fly through the tunnel, and halfway through the floor caves in and
  // you drop into the sewers, where crocodiles lurk in the dirty water.
  // ======================================================================
  function buildMetro() {
    const b = new Builder();

    // ============ AREAS (each starts on a bar of the music) ============
    b.area('street', -60, 'SERGELS TORG', 'Down into the subway!');
    b.area('station', 48, 'T-CENTRALEN', 'Mind the gap!');
    b.area('tracks', 208, 'SPÅREN', 'Surf the trains!');
    b.area('tunnel', 352, 'TUNNELN', 'Fly through the dark');
    b.area('sewer', 464, 'KLOAKERNA', 'Crocodiles in the sewer?!');
    b.area('pipe', 656, 'AVLOPPSRÖRET', 'Tap to flip — mind the slime!');
    b.area('outlet', 768, 'UTLOPPET', 'Follow the light…');
    b.area('harbor', 864, 'RIDDARFJÄRDEN', 'Out into the sunshine!');

    // ============ SERGELS TORG (0 – 48) ============
    b.checkpoint(0);
    b.text(12, 4.6, 'Level 2 · Tunnelbanan', 0.55);
    b.text(12, 3.9, 'Jump up onto the trains!', 0.4);
    b.spike(24, 0, 'cone');
    b.spikes(30, 2, 0, 'cone');
    b.block(38, 0, 2, 1, 'barrier');
    b.spike(40, 0, 'cone');
    b.block(41, 0, 2, 1, 'barrier');

    // ============ T-CENTRALEN (48 – 208) ============
    // the ticket gates: hop from gate to gate, the rats scurry about underneath
    b.block(58, 0, 1, 1, 'gate');
    b.spike(60.2, 0, 'rat');
    b.block(62.5, 0, 1, 1, 'gate');
    b.spike(64.7, 0, 'rat');
    b.block(67, 0, 1, 1, 'gate');
    b.spikes(69, 2, 0, 'rat');
    // somebody's luggage, piled up higher and higher
    b.block(78, 0, 1, 1, 'luggage');
    b.block(82, 0, 1, 2, 'luggage');
    b.block(86, 0, 1, 3, 'luggage');
    b.spikes(89, 2, 0, 'rat');
    // pigeons at head height: stay on the ground under them
    b.text(99, 5.4, 'Stay low under the pigeons!', 0.45);
    b.bird(97, 1.35, 'pigeon');
    b.bird(98.5, 1.55, 'pigeon');
    b.bird(100, 1.35, 'pigeon');
    b.spike(108, 0, 'rat');

    b.checkpoint(112);
    // the first train: a pad up onto the roof, over the air vent, and off the far end over the rats
    b.pad(120);
    b.train(123, 14);
    b.block(129, 2.5, 2, 0.5, 'vent');
    b.spikes(138, 2, 0, 'rat');
    b.spikes(148, 2, 0, 'rat');
    b.spike(154, 0, 'rat');
    b.spikes(159, 2, 0, 'rat');
    // mind the gap: the live rail shows through a gap in the platform
    b.text(170, 5.2, 'Mind the gap!', 0.45);
    b.rail(168, 2.5);
    b.spike(176, 0, 'rat');
    // a barrier to step up from, then the second train
    b.block(184, 0, 2, 1, 'barrier');
    b.train(188, 12);
    b.spikes(201, 2, 0, 'rat');

    // ============ SPÅREN (208 – 352) ============
    b.checkpoint(208);
    b.block(216, 0, 1, 1, 'barrier');
    b.rail(222, 2.9);
    // two trains in a row: jump the gap between them (the live rail is right underneath)
    b.pad(230);
    b.train(233, 12);
    b.rail(245, 3);
    b.train(248, 12);
    b.block(254, 2.5, 1, 0.5, 'vent');
    b.spikes(261, 2, 0, 'rat');
    b.spikes(272, 2, 0, 'rat');
    b.spikes(280, 3, 0, 'rat');
    // barriers over the live rail: hop from barrier to barrier
    b.block(296, 0, 2, 1, 'barrier');
    b.rail(298, 3);
    b.block(301, 0, 2, 1, 'barrier');
    b.rail(303, 3);
    b.block(306, 0, 2, 1, 'barrier');
    b.rail(308, 3);
    // a gap too wide to jump: tap the orb in mid-air
    b.block(316, 0, 2, 1, 'barrier');
    b.train(320, 10);
    b.rail(330, 6);
    b.orb(332.5, 4);
    b.train(336, 10);
    b.spikes(347, 2, 0, 'rat');

    // ============ TUNNELN — ship (352 – 464) ============
    b.checkpoint(352);
    b.text(356, 5.4, 'HOLD to fly through the tunnel!', 0.45);
    b.portal(360, 'ship', { ceil: 9 });
    b.corridor(360, 432, 9, 'tunnel');
    b.rail(364, 68); // the whole tunnel floor is live
    b.train(368, 16);
    b.thorny(374, 5.4, 2, 3.6, 'signal');
    b.block(390, 4.2, 2, 4.8, 'beam');
    b.thorny(398, 0, 1, 5, 'signalpost');
    b.train(405, 16);
    b.thorny(409, 6, 2, 3, 'signal');
    b.thorny(416, 5, 2, 4, 'signal');
    b.thorny(425, 0, 1, 4.2, 'signalpost');
    b.portal(432, 'cube', { y: 4 });
    // the end of the line... and the floor is caving in
    b.text(444, 5.4, 'Uh-oh… the floor is cracking!', 0.45);
    b.spike(443, 0, 'rat');
    b.hole(454, 7);

    // ============ KLOAKERNA (454 / 464 – 656), one layer down ============
    b.checkpoint(472);
    b.spike(480, 0, 'rat');
    // the first crocodile faces you: jump over its jaws onto its back
    b.text(492, 5.4, 'Land on their backs — not their jaws!', 0.45);
    b.water(488, 8);
    b.croc(488, 6);
    // this one faces away: land on its tail and jump off before you reach the jaws
    b.water(504, 7);
    b.croc(505, 6, 'right');
    b.block(520, 0, 3, 1, 'pipe');
    b.spikes(523, 2, 0, 'rat');
    b.block(525, 0, 3, 1, 'pipe');
    // crocodiles popping up out of the sludge
    b.water(536, 2.8);
    b.snapper(536.9);
    b.water(544, 2.8);
    b.snapper(544.9);
    b.spike(556, 0, 'rat');

    b.checkpoint(568);
    // floating barrels and a crocodile: stepping stones across the channel
    b.water(576, 16);
    b.block(579, 0, 2, 1, 'barrel');
    b.croc(582.5, 5);
    b.block(589.5, 0, 2, 1, 'barrel');
    b.spike(598, 0, 'rat');
    // two crocodiles in a row
    b.water(606, 15);
    b.croc(606, 6);
    b.croc(614, 6);
    b.spikes(626, 2, 0, 'rat');
    // an orb over the wide channel
    b.water(634, 7);
    b.orb(636, 2);
    b.snapper(638);
    b.spike(648, 0, 'rat');

    // ============ AVLOPPSRÖRET — ball (656 – 768) ============
    b.checkpoint(656);
    b.text(668, 4.3, 'TAP to flip — mind the slime!', 0.45);
    b.portal(664, 'ball', { ceil: 6 });
    b.corridor(664, 761, 6, 'pipe');
    b.spikes(676, 3, 0, 'slime');
    b.spikesDown(683, 3, 6, 'slime');
    b.spikes(690, 3, 0, 'slime');
    b.block(697, 4, 3, 2, 'grate');
    b.spikes(701, 2, 0, 'slime');
    b.spikesDown(706, 2, 6, 'slime');
    b.spikes(711, 2, 0, 'slime');
    b.spikesDown(716, 2, 6, 'slime');
    b.block(722, 0, 3, 2, 'grate');
    b.spikesDown(726, 3, 6, 'slime');
    b.spikes(731, 3, 0, 'slime');
    b.spikesDown(736, 2, 6, 'slime');
    b.spikes(740, 2, 0, 'slime');
    b.spikesDown(744, 2, 6, 'slime');
    b.spikes(749, 3, 0, 'slime');
    b.portal(760, 'cube', { y: 2 });

    // ============ UTLOPPET (768 – 864) ============
    b.checkpoint(768);
    b.spike(778, 0, 'rat');
    b.water(786, 7);
    b.croc(787, 6, 'right');
    b.block(800, 0, 3, 1, 'pipe');
    b.block(803, 0, 3, 2, 'pipe');
    b.spikes(806, 3, 0, 'rat');
    // two snapping heads: tap the orb between them
    b.water(816, 6);
    b.snapper(817);
    b.orb(818, 2);
    b.snapper(820);
    b.water(828, 14);
    b.croc(828, 6);
    b.block(836.5, 0, 2, 1, 'barrel');
    b.spike(846, 0, 'rat');
    b.spike(851, 0, 'rat');

    // ============ RIDDARFJÄRDEN (864 – finish) ============
    b.spikes(874, 2, 0, 'cone');
    b.bird(883, 1.35, 'gull');
    b.bird(884.5, 1.55, 'gull');
    b.spike(892, 0, 'cone');
    b.block(900, 0, 2, 1, 'barrier');
    b.spike(902, 0, 'cone');
    b.block(903, 0, 2, 1, 'barrier');
    b.spikes(914, 2, 0, 'cone');
    b.finish(928);

    // ============ SCENERY ============
    b.deco('tsign', 6);
    b.deco('lamp', 16);
    b.deco('bike', 20, { color: '#2a7bd1' });
    b.deco('bench', 34);
    b.deco('tbana', 46);
    // T-Centralen: blue cave walls, signs, clocks and the next-train display
    b.deco('stationsign', 56, { inside: true, text: 'T-CENTRALEN' });
    b.deco('display', 74, { inside: true });
    b.deco('stationsign', 104, { inside: true, text: 'T-CENTRALEN' });
    b.deco('clock', 116, { inside: true });
    b.deco('poster', 142, { inside: true, seed: 1 });
    b.deco('stationsign', 162, { inside: true, text: 'T-CENTRALEN' });
    b.deco('poster', 180, { inside: true, seed: 2 });
    b.deco('exit', 196, { inside: true });
    // out along the tracks and into the tunnel
    b.deco('voltage', 224, { inside: true });
    b.deco('signallamp', 266, { inside: true });
    b.deco('nodutgang', 282, { inside: true });
    b.deco('voltage', 300, { inside: true });
    b.deco('signallamp', 314, { inside: true });
    b.deco('nodutgang', 350, { inside: true });
    b.deco('rasrisk', 438, { inside: true });
    b.deco('bufferstop', 470, { inside: true, layer: 0 });
    // the sewer, one layer down (the hole in the floor starts at 454)
    b.deco('rubble', 456, { inside: true });
    b.deco('ladder', 478, { inside: true });
    b.deco('outfall', 500, { inside: true });
    b.deco('grate', 530, { inside: true });
    b.deco('ladder', 560, { inside: true });
    b.deco('outfall', 596, { inside: true });
    b.deco('grate', 628, { inside: true });
    b.deco('outfall', 652, { inside: true });
    b.deco('grate', 776, { inside: true });
    b.deco('outfall', 812, { inside: true });
    b.deco('ladder', 822, { inside: true });
    b.deco('grate', 846, { inside: true });
    b.deco('culvert', 848, { w: 14, span: 14 });
    // Riddarfjärden in the evening sun
    b.deco('lamp', 870);
    b.deco('bollard', 880);
    b.deco('bollard', 896);
    b.deco('lamp', 908);
    b.deco('bench', 920);
    b.deco('finish', 928);

    // ============ MID-LAYER LANDMARKS ============
    b.landmark('cityrow', 10, { seed: 31 });
    b.landmark('obelisk', 36);
    b.landmark('cityrow', 880, { seed: 17 });
    b.landmark('stadshuset', 916);
    b.landmark('cityrow', 960, { seed: 23 });

    return b;
  }

  // ======================================================================
  // LEVEL 6 — Mardrömmen (the nightmare). Age-rated 16+: a health bar, bloody nuns, creepy clowns,
  // jump scares and strobe lights. Graveyard -> convent -> upside-down chapel -> catacombs by ship ->
  // fairground -> mirror hall -> ghost train by ball -> the bell tower.
  // ======================================================================
  function buildNightmare() {
    const b = new Builder();

    // ============ AREAS ============
    b.area('graveyard', -60, 'KYRKOGÅRDEN', 'Midnight. The bell is tolling…');
    b.area('convent', 128, 'KLOSTRET', 'The bloody nuns are awake');
    b.area('chapel', 320, 'KAPELLET', 'Upside down in the lightning');
    b.area('catacomb', 448, 'KATAKOMBERNA', 'Only your lantern shines');
    b.area('circus', 640, 'CIRKUSEN', 'The clowns want to play');
    b.area('mirrors', 832, 'SPEGELSALEN', 'Which way is forward?');
    b.area('ghosttrain', 928, 'SPÖKTÅGET', 'Hold on tight!');
    b.area('tower', 1056, 'KLOCKTORNET', 'Ring the bell and get out!');

    // ============ KYRKOGÅRDEN (0 – 128) ============
    b.checkpoint(0);
    b.text(12, 4.6, 'Level 6 · Mardrömmen', 0.55);
    b.text(12, 3.9, '⚠ Flashing lights: turn them off in the pause menu (Esc)', 0.4);
    b.lightning(40, 128);
    b.spike(20, 0, 'fence');
    b.spike(28, 0, 'fence');
    b.spikes(36, 2, 0, 'fence');
    b.spikes(44, 3, 0, 'hand'); // hands clawing out of the graves
    b.bird(54, 1.35, 'raven');
    b.bird(56, 1.35, 'raven'); // a pair, at head height — stay low
    b.spikes(64, 3, 0, 'fence');
    // a small tomb staircase, with fence spikes between the steps
    b.block(72, 0, 2, 1, 'tomb');
    b.spikes(74, 2, 0, 'fence');
    b.block(76, 0, 2, 2, 'tomb');
    b.spikes(78, 2, 0, 'fence');
    b.block(80, 0, 2, 3, 'tomb');
    b.spikes(88, 2, 0, 'hand');
    b.spike(96, 0, 'fence');
    b.spikes(104, 2, 0, 'fence');
    b.scare(118, 'nun'); // she's waiting at the convent gate — next real obstacle is well past x=124

    // ============ KLOSTRET (128 – 320) ============
    b.checkpoint(128);
    b.lightning(200, 320);
    b.block(132, 0, 3, 1, 'pew');
    b.thorny(140, 0, 1, 1.5, 'candles');
    b.water(148, 3, 'blood');
    b.nun(156, 1.2, { bob: 1.0, beats: 4, phase: 0.5 }); // up when you arrive — run under, and learn to read her
    b.block(164, 0, 3, 1, 'pew');
    b.nun(172, 1.2, { bob: 1.0, beats: 4, phase: 0 }); // down — jump!
    b.thorny(180, 0, 1, 1.5, 'candles');
    b.water(188, 3, 'blood');
    b.nunDrop(196, 5, { trigger: 8, dist: 5, fall: 4 }); // drops from the rafters right in front of you
    b.block(204, 0, 3, 1, 'pew');
    b.thorny(212, 0, 1, 1.5, 'candles');
    b.water(220, 3, 'blood');

    b.checkpoint(224);
    b.nun(228, 1.2, { bob: 1.0, beats: 4, phase: 0 }); // up
    b.nun(236, 1.2, { bob: 1.0, beats: 4, phase: 0 }); // down
    b.block(244, 0, 3, 1, 'pew');
    b.thorny(252, 0, 1, 1.5, 'candles');
    b.nun(260, 1.2, { bob: 1.0, beats: 4, phase: 0.5 }); // down
    b.thorny(268, 0, 1, 1.5, 'candles');
    b.water(272, 3, 'blood');
    b.block(276, 0, 3, 1, 'pew');
    b.nun(284, 1.2, { bob: 1.0, beats: 4, phase: 0.5 }); // up
    b.nun(292, 1.2, { bob: 1.0, beats: 4, phase: 0.5 }); // down
    b.scare(300, 'window'); // lightning through the stained glass — a small scare
    b.thorny(308, 0, 1, 1.5, 'candles');
    b.water(316, 3, 'blood');

    // ============ KAPELLET (320 – 448), cube upside down, ceiling 7 ============
    b.checkpoint(320); // normal gravity, before the portal
    b.text(322, 4.6, 'UPSIDE DOWN!', 0.5);
    b.portal(328, 'cube', { grav: 1, ceil: 7, y: 4 });
    b.corridor(328, 440, 7, 'vault');
    b.strobe(332, 440);
    b.block(336, 6, 4, 1, 'crypt');
    b.spikesDown(344, 2, 7, 'fence');
    b.thorny(352, 5.5, 1, 1.5, 'chandelier');
    b.block(360, 6, 3, 1, 'crypt');
    b.nunDrop(368, 2, { trigger: 8, dist: -4, fall: 4 }); // rises from below, toward the ceiling
    b.spikesDown(376, 3, 7, 'fence'); // a tight triple
    b.thorny(384, 5.5, 1, 1.5, 'chandelier');
    b.block(388, 6, 3, 1, 'crypt');
    b.nun(396, 5, { bob: 0.8, beats: 4, phase: 0.125 }); // up here means toward the ceiling — danger
    b.spikesDown(404, 2, 7, 'fence');
    b.block(412, 6, 3, 1, 'crypt');
    b.thorny(420, 5.5, 1, 1.5, 'chandelier');
    b.portal(436, 'cube', { y: 4 }); // gravity back to normal — you drop to the floor
    b.spike(443, 0);
    b.spike(447, 0);

    // ============ KATAKOMBERNA (448 – 640), ship, ceiling 9, dark ============
    b.checkpoint(448);
    b.text(450, 5.4, 'HOLD to fly — only your lantern shines', 0.45);
    b.dark(452, 636, { r: 7 });
    b.portal(456, 'ship', { ceil: 9 });
    b.corridor(456, 632, 9, 'bones');
    b.thorny(460, 0, 2, 3, 'bonespikes');
    b.thorny(460, 6, 2, 3, 'bonespikes');
    b.bird(468, 4.5, 'bat');
    b.spikes(472, 2, 0, 'bone');
    b.pendulum(476, 9, { len: 4, amp: 0.8, beats: 4, phase: 0 });
    b.thorny(484, 0, 2, 4, 'bonespikes');
    b.thorny(484, 7, 2, 2, 'bonespikes');
    b.bird(492, 4, 'bat');
    b.pendulum(500, 9, { len: 4.5, amp: 0.7, beats: 4, phase: 0.25 });
    b.thorny(508, 0, 2, 3, 'bonespikes');
    b.thorny(508, 6.5, 2, 2.5, 'bonespikes');
    b.bird(516, 3.5, 'bat');
    b.scare(520, 'skull'); // the lantern goes out, then a skull — next obstacle is 8+ blocks later
    b.thorny(528, 0, 2, 3, 'bonespikes');
    b.thorny(528, 6.5, 2, 2.5, 'bonespikes');
    b.pendulum(536, 9, { len: 4, amp: 0.85, beats: 4, phase: 0.5 });

    b.checkpoint(544, 'ship', 4, 9);
    b.thorny(552, 0, 2, 3, 'bonespikes');
    b.thorny(552, 6.5, 2, 2.5, 'bonespikes');
    b.bird(560, 4, 'bat');
    b.pendulum(568, 9, { len: 4, amp: 0.8, beats: 4, phase: 0.75 });
    b.spikes(576, 2, 0, 'bone');
    b.thorny(580, 0, 2, 4, 'bonespikes');
    b.thorny(580, 7, 2, 2, 'bonespikes');
    b.bird(588, 3.5, 'bat');
    b.bird(590, 5, 'bat');
    b.pendulum(596, 9, { len: 5, amp: 0.75, beats: 4, phase: 0 });
    b.thorny(604, 0, 2, 3, 'bonespikes');
    b.thorny(604, 6.5, 2, 2.5, 'bonespikes');
    b.bird(612, 4.5, 'bat');
    b.thorny(616, 0, 2, 4, 'bonespikes');
    b.thorny(616, 7, 2, 2, 'bonespikes');
    b.pendulum(624, 9, { len: 4, amp: 0.7, beats: 4, phase: 0.25 });
    b.portal(632, 'cube', { y: 4 });

    // ============ CIRKUSEN (640 – 832) ============
    b.checkpoint(640);
    b.jack(648, { beats: 2, phase: 0.85, rise: 0.8 }); // closed when you arrive — land on it
    b.jack(652, { beats: 2, phase: 0.8, rise: 0.8 }); // open — jump clear over the head
    b.jack(656, { beats: 2, phase: 0.85, rise: 0.8 }); // closed
    b.balloon(664, 1.4, { bob: 0.6, beats: 4, phase: 0 });
    b.balloon(667, 1.6, { bob: 0.6, beats: 4, phase: 0.3 });
    b.block(676, 0, 3, 1, 'crate');
    b.block(684, 0, 2, 2, 'podium');
    b.pad(690);
    b.block(694, 0, 3, 2, 'podium'); // the pad lands you on this podium
    b.scare(700, 'clown'); // next obstacle is 6+ blocks later
    b.spikes(708, 3); // a tight triple
    b.spikes(714, 6);
    b.orb(716, 2);
    b.orb(720, 2); // an orb chain over the spike row
    b.block(728, 0, 3, 1, 'crate');

    b.checkpoint(736);
    b.jack(740, { beats: 2, phase: 0.8, rise: 0.8 }); // open
    b.block(748, 0, 2, 1, 'podium');
    b.block(752, 0, 2, 2, 'podium');
    b.balloon(760, 1.5, { bob: 0.6, beats: 4, phase: 0.25 });
    b.spikes(768, 2);
    b.block(776, 0, 3, 1, 'crate');
    b.jack(784, { beats: 2, phase: 0.85, rise: 0.8 }); // closed
    b.spikes(792, 3); // another tight triple
    b.balloon(800, 1.4, { bob: 0.6, beats: 4, phase: 0.5 });
    b.balloon(803, 1.6, { bob: 0.6, beats: 4, phase: 0.7 });
    b.block(808, 0, 2, 1, 'podium');
    b.block(812, 0, 2, 2, 'podium');
    b.spikes(820, 2);
    b.block(828, 0, 3, 1, 'crate');

    // ============ SPEGELSALEN (832 – 928) ============
    b.checkpoint(832);
    b.mirror(838, 922); // the flip animation ramps 2.6 blocks outside the zone, so it is done well before the checkpoints at 832 and 928
    b.block(840, 0, 2, 1, 'mirror');
    b.spike(846, 0, 'shard');
    b.block(852, 0, 2, 1, 'mirror');
    b.block(855, 0, 2, 2, 'mirror');
    b.spike(862, 0, 'shard');
    b.spike(866, 0, 'shard');
    b.nun(872, 1.2, { bob: 1.0, beats: 4, phase: 0.25 }); // down — moderate, the screen is flipped
    b.scare(880, 'mirror'); // next obstacle is 6+ blocks later
    b.spikes(888, 2, 0, 'shard');
    b.block(896, 0, 2, 1, 'mirror');
    b.spike(906, 0, 'shard');
    b.block(912, 0, 2, 1, 'mirror');
    b.block(915, 0, 2, 2, 'mirror');
    b.spikes(920, 2, 0, 'shard');

    // ============ SPÖKTÅGET (928 – 1056), ball, ceiling 6 ============
    b.checkpoint(928);
    b.text(930, 4.3, 'TAP to flip — hold on tight!', 0.45);
    b.portal(936, 'ball', { ceil: 6 });
    b.corridor(936, 1040, 6, 'ghosttrain');
    b.strobe(944, 1036);
    b.spikes(948, 3, 0, 'skeleton');
    b.spikesDown(955, 3, 6, 'skeleton');
    b.spikes(962, 3, 0, 'skeleton');
    b.spikesDown(969, 3, 6, 'skeleton');
    b.block(977, 0, 3, 2, 'cart');
    b.spikesDown(986, 2, 6, 'skeleton');
    b.spikes(991, 2, 0, 'skeleton');
    b.spikesDown(996, 2, 6, 'skeleton');
    b.scare(1000, 'duo'); // next obstacle is 6+ blocks later
    // faster flips: a spike group every 5 blocks, like the bear cave in level 3
    b.spikes(1006, 2, 0, 'skeleton');
    b.spikesDown(1011, 2, 6, 'skeleton');
    b.spikes(1016, 2, 0, 'skeleton');
    b.spikesDown(1021, 2, 6, 'skeleton');
    b.block(1026, 4, 3, 2, 'cart');
    b.spikesDown(1032, 3, 6, 'skeleton');
    b.portal(1040, 'cube', { y: 2 });
    b.spike(1044, 0);
    b.spikes(1048, 2, 0);
    b.spike(1052, 0);

    // ============ KLOCKTORNET (1056 – 1120), no checkpoint — a plain run of single, double and triple spikes ============
    b.spikes(1060, 3, 0, 'fence');
    b.spikes(1068, 2, 0, 'fence');
    b.spike(1075, 0, 'fence');
    b.spikes(1082, 3, 0, 'fence');
    b.spikes(1090, 2, 0, 'fence');
    b.spike(1097, 0, 'fence');
    b.spikes(1104, 3, 0, 'fence');
    b.spikes(1112, 2, 0, 'fence');
    b.finish(1120);
    b.scare(1126, 'final');

    // ============ NEAR SCENERY ============
    b.deco('cross', 5);
    b.deco('tombstone', 16);
    b.deco('opengrave', 24);
    b.deco('gnarltree', 32);
    b.deco('gaslamp', 48);
    b.deco('tombstone', 58);
    b.deco('opengrave', 68);
    b.deco('cross', 84);
    b.deco('gnarltree', 100);
    b.deco('gaslamp', 110);
    b.deco('convgate', 126);
    b.deco('stainedglass', 130, { inside: true });
    b.deco('nunstatue', 146);
    b.deco('candles', 168, { inside: true });
    b.deco('stainedglass', 190, { inside: true });
    b.deco('nunstatue', 210);
    b.deco('candles', 232, { inside: true });
    b.deco('stainedglass', 250, { inside: true });
    b.deco('nunstatue', 270);
    b.deco('candles', 290, { inside: true });
    b.deco('stainedglass', 310, { inside: true });
    b.deco('organ', 324, { inside: true });
    b.deco('stainedglass', 350, { inside: true });
    b.deco('stainedglass', 400, { inside: true });
    b.deco('organ', 430, { inside: true });
    b.deco('bonepile', 464, { inside: true });
    b.deco('skullniche', 488, { inside: true });
    b.deco('bonepile', 512, { inside: true });
    b.deco('skullniche', 540, { inside: true });
    b.deco('bonepile', 568, { inside: true });
    b.deco('skullniche', 592, { inside: true });
    b.deco('bonepile', 616, { inside: true });
    b.deco('tent', 644);
    b.deco('ticketbooth', 660);
    b.deco('popcorn', 680);
    b.deco('clownboard', 700);
    b.deco('tent', 720);
    b.deco('popcorn', 748);
    b.deco('ticketbooth', 768);
    b.deco('clownboard', 790);
    b.deco('tent', 806);
    b.deco('popcorn', 824);
    b.deco('mirrorframe', 838);
    b.deco('mirrorframe', 860);
    b.deco('mirrorframe', 884);
    b.deco('mirrorframe', 908);
    b.deco('terror', 924); // the ghost train's entrance, seen from outside
    b.deco('hangskeleton', 940, { inside: true });
    b.deco('monsterpaint', 960, { inside: true });
    b.deco('hangskeleton', 985, { inside: true });
    b.deco('monsterpaint', 1010, { inside: true });
    b.deco('hangskeleton', 1030, { inside: true });
    b.deco('bellrope', 1062);
    b.deco('cross', 1090);
    b.deco('finish', 1120);

    // ============ MID-LAYER LANDMARKS (outdoor areas only) ============
    b.landmark('ruinchurch', 46);
    b.landmark('convent', 100);
    b.landmark('bigtop', 680);
    b.landmark('ferris', 740);
    b.landmark('carousel', 800);
    b.landmark('belltower', 1110);

    return b;
  }

  // ======================================================================
  // THEMES — everything the renderer and the music need to know per level
  // ======================================================================
  const HOME_THEME = {
    // time of day follows the journey: noon in Uppland -> sunset over Fyrisån -> night in Storvreta
    sky: [
      { x: -100, top: '#3d9be9', bot: '#c4e8ff', far: '#8cb3b0', dark: 0, sun: 0.1 },
      { x: 360, top: '#4b98e0', bot: '#fde6b4', far: '#98ad9f', dark: 0.03, sun: 0.28 },
      { x: 520, top: '#e0885a', bot: '#ffd59a', far: '#b3948a', dark: 0.1, sun: 0.55 },
      { x: 720, top: '#a9477a', bot: '#ff9e6a', far: '#8e6888', dark: 0.24, sun: 0.82 },
      { x: 880, top: '#373a7a', bot: '#dd7a78', far: '#58517f', dark: 0.42, sun: 0.99 },
      { x: 1040, top: '#141a45', bot: '#40397a', far: '#2d2f5c', dark: 0.6, sun: 1.2 },
      { x: 1320, top: '#070b24', bot: '#22265c', far: '#1c2046', dark: 0.68, sun: 1.3 },
    ],
    field: { uppland: 'meadow', gamla: 'golden', uppsala: 'park', fyris: 'river', road: 'farm', hall: 'farm', home: 'lawn' },
    ground: { uppland: 'grass', gamla: 'golden', uppsala: 'cobble', fyris: 'quay', road: 'asphalt', hall: 'hall', home: 'grass' },
    glow: { uppland: '#ffffff', gamla: '#fff2c4', uppsala: '#ffe0c0', fyris: '#ffd0e8', road: '#ffffff', hall: '#8ff3ff', home: '#c9d8ff' },
    far: { uppsala: 'city', fyris: 'city', road: 'pine', home: 'pine', default: 'mixed' },
    farExtra: [{ x: 640, t: 'spires' }], // twin spires of the cathedral, visible from far away
    midFill: { hall: null, uppsala: null, fyris: null, uppland: 'mixed', gamla: 'mixed', default: 'pine' },
    midStep: [4, 6],
    indoor: { hall: 'hall' },
    train: [850, 1030], // the regional train racing along the railway towards Storvreta
    song: 'home',
  };
  const FOREST_THEME = {
    // a whole day in the woods: fresh morning, misty bog, golden afternoon in the clearing
    sky: [
      { x: -100, top: '#5aa7d6', bot: '#f3efc8', far: '#557f60', dark: 0, sun: 0.15 },
      { x: 200, top: '#4b95c8', bot: '#dcefd0', far: '#44705a', dark: 0.05, sun: 0.2 },
      { x: 380, top: '#8aa6b8', bot: '#dfe6dc', far: '#6f857c', dark: 0.1, sun: 0.3 },
      { x: 560, top: '#7d93aa', bot: '#e4d8c4', far: '#65786e', dark: 0.14, sun: 0.4 },
      { x: 720, top: '#4a92d0', bot: '#fbe7b8', far: '#4c7454', dark: 0.05, sun: 0.48 },
      { x: 900, top: '#5b86c8', bot: '#ffcf96', far: '#6a7a52', dark: 0.1, sun: 0.66 },
      { x: 1100, top: '#6a6fb2', bot: '#ffb488', far: '#5a5e58', dark: 0.2, sun: 0.82 },
    ],
    field: { edge: 'forest', spruce: 'forest', bog: 'bog', cave: 'forest', ravine: 'forest', glade: 'glade' },
    ground: { edge: 'forest', spruce: 'forest', bog: 'peat', cave: 'cave', ravine: 'forest', glade: 'grass' },
    glow: { edge: '#fff4d6', spruce: '#e6ffd8', bog: '#eaf2ff', cave: '#8ff3ff', ravine: '#ffffff', glade: '#fff2c4' },
    far: { bog: 'sparse', default: 'forest' },
    farExtra: [],
    midFill: { cave: null, bog: 'dead', glade: 'mixed', edge: 'mixed', default: 'spruce' },
    midStep: [2.5, 3.5],
    indoor: { cave: 'cave' },
    canopy: ['spruce', 'ravine'], // branches hanging over the top of the screen
    beams: ['edge', 'spruce', 'ravine'], // sunbeams slanting through the trees
    mist: ['bog'],
    flocks: true, // flocks of birds crossing the sky
    song: 'forest',
  };
  const CHESS_THEME = {
    // a giant chessboard under a sky that deepens from a pale lilac morning to a royal purple/gold dusk
    // by the time you reach the king
    sky: [
      { x: -100, top: '#cdb8e0', bot: '#f5e6d0', far: '#8a7a9e', dark: 0, sun: 0.15 },
      { x: 200, top: '#a893c9', bot: '#e8c9a0', far: '#6a5a82', dark: 0.05, sun: 0.3 },
      { x: 400, top: '#7a5ea3', bot: '#d99a6a', far: '#4a3a68', dark: 0.15, sun: 0.45 },
      { x: 576, top: '#5a3f8a', bot: '#c07a5a', far: '#382a56', dark: 0.28, sun: 0.58 },
      { x: 704, top: '#3f2a72', bot: '#9a5a6a', far: '#281c48', dark: 0.42, sun: 0.72 },
      { x: 880, top: '#2a1a5e', bot: '#7a3a5a', far: '#1c1440', dark: 0.55, sun: 0.88 },
      { x: 1200, top: '#1a0f4a', bot: '#4a2a52', far: '#120c30', dark: 0.65, sun: 1.0 },
    ],
    field: { default: 'checker' },
    // ground is looked up directly by area id (no 'default' fallback), so every area needs its own entry
    ground: { board: 'board', knights: 'board', tower: 'flagstone', diagonal: 'flagstone', queen: 'board', throne: 'board' },
    glow: { board: '#e8c85a', knights: '#c9a8ff', tower: '#ffcf6a', diagonal: '#e0a8ff', queen: '#ff9ad6', throne: '#ffd700' },
    far: { default: 'castle' },
    farExtra: [],
    midFill: { default: null }, // no procedural filler — just the explicit giant chess-piece landmarks
    midStep: [4, 6],
    indoor: { tower: 'rooktower', diagonal: 'cathedral' },
    beams: ['board'], // morning sunbeams over the board
    mist: ['throne'], // twilight haze around the king
    song: 'chess',
  };
  const OCEAN_THEME = {
    // a dive down and back up: bright turquoise shallows -> dimmer wreck & current -> near-black in the
    // whale and the trench -> back up into golden-turquoise light at the surface
    sky: [
      { x: -100, top: '#0e6f8a', bot: '#4fd0d6', far: '#0a4a5c', dark: 0.05, sun: 0.2 },
      { x: 200, top: '#0a5878', bot: '#3aa8ba', far: '#0a4050', dark: 0.15, sun: 0.32 },
      { x: 380, top: '#083a56', bot: '#256f8a', far: '#082e40', dark: 0.32, sun: 0.44 },
      { x: 560, top: '#041c30', bot: '#123c52', far: '#041824', dark: 0.5, sun: 0.58 },
      { x: 620, top: '#020814', bot: '#0a1c2c', far: '#020810', dark: 0.72, sun: 0.7 },
      { x: 720, top: '#020610', bot: '#081824', far: '#020610', dark: 0.78, sun: 0.75 },
      { x: 860, top: '#04283c', bot: '#0e4a5e', far: '#03202e', dark: 0.5, sun: 0.6 },
      { x: 960, top: '#0d6a82', bot: '#5adcd0', far: '#0a4a54', dark: 0.18, sun: 0.34 },
      { x: 1100, top: '#12a0b0', bot: '#8ff0d8', far: '#0e6a70', dark: 0.04, sun: 0.16 },
    ],
    field: { reef: 'lagoon', wreck: 'wrecked', swarm: 'openwater', whale: 'trench', deep: 'trench', surface: 'shore' },
    ground: { reef: 'seabed', wreck: 'seabed', swarm: 'seabed', whale: 'ribcage', deep: 'seabed', surface: 'shallows' },
    glow: { reef: '#bdfff2', wreck: '#8fe0ea', swarm: '#7fd8ff', whale: '#ff9ab0', deep: '#6fe0ff', surface: '#fff6c4' },
    far: { default: 'reef' },
    farExtra: [],
    midFill: { whale: null, default: 'kelp' },
    midStep: [3, 5],
    indoor: { whale: 'whale' },
    beams: ['reef'], // sunbeams slanting down through the shallows
    mist: ['deep'], // murky haze in the trench
    fish: true, // schools of fish drifting across the background, instead of bird flocks
    song: 'ocean',
  };
  const METRO_THEME = {
    // you only see the sky at the start (Sergels torg in the afternoon) and at the end (Riddarfjärden at sunset)
    sky: [
      { x: -100, top: '#3f93dc', bot: '#d6ebff', far: '#8a9aa8', dark: 0, sun: 0.3 },
      { x: 60, top: '#4a95d8', bot: '#e2eaf0', far: '#8e9aa4', dark: 0, sun: 0.35 },
      { x: 820, top: '#6a64b0', bot: '#ffc07a', far: '#7c6f86', dark: 0.06, sun: 0.74 },
      { x: 900, top: '#5a58a6', bot: '#ffa874', far: '#6c6080', dark: 0.12, sun: 0.82 },
      { x: 1040, top: '#34397e', bot: '#ff8c6a', far: '#544a6c', dark: 0.24, sun: 0.94 },
    ],
    field: { street: 'plaza', station: 'plaza', tracks: 'plaza', tunnel: 'plaza', default: 'river' },
    ground: { street: 'plattan', station: 'platform', tracks: 'track', tunnel: 'track', sewer: 'sewer', pipe: 'pipe', outlet: 'sewer', harbor: 'quay' },
    glow: { street: '#ffffff', station: '#0f2a52', tracks: '#ffe680', tunnel: '#ffcf70', sewer: '#c8ff7a', pipe: '#c8ff7a', outlet: '#c8ff7a', harbor: '#fff2c4' },
    far: { default: 'city' },
    farExtra: [],
    midFill: { default: null },
    midStep: [4, 6],
    indoor: { station: 'metro', tracks: 'metro', tunnel: 'metro', sewer: 'sewer', pipe: 'sewer', outlet: 'sewer' },
    song: 'metro',
  };
  const NIGHTMARE_THEME = {
    // a moonless midnight the whole way through — always mostly dark, with a blood-red glow low on the horizon
    sky: [
      { x: -100, top: '#0b0512', bot: '#3a0e18', far: '#1a0f1e', dark: 0.62, sun: 1.2 },
      { x: 250, top: '#0a0410', bot: '#340c16', far: '#180d1c', dark: 0.65, sun: 1.2 },
      { x: 500, top: '#0d0616', bot: '#3e0f1a', far: '#1c1020', dark: 0.66, sun: 1.2 },
      { x: 750, top: '#100718', bot: '#4a1220', far: '#201224', dark: 0.64, sun: 1.2 },
      { x: 1000, top: '#0a0410', bot: '#360d18', far: '#180d1e', dark: 0.68, sun: 1.2 },
      { x: 1200, top: '#070310', bot: '#2c0a14', far: '#140c1a', dark: 0.7, sun: 1.2 },
    ],
    moon: '#b3121e', // a blood moon
    field: { graveyard: 'graves', circus: 'fairground', tower: 'graves', default: 'graves' },
    ground: { graveyard: 'grave', convent: 'flagstone', chapel: 'flagstone', catacomb: 'bones', circus: 'sawdust',
              mirrors: 'mirrorfloor', ghosttrain: 'ghostrail', tower: 'grave' },
    glow: { graveyard: '#b8c4ff', convent: '#ffcf8a', chapel: '#e8f0ff', catacomb: '#ffb347', circus: '#ff5fd2',
            mirrors: '#9ff3ff', ghosttrain: '#7dff9a', tower: '#b8c4ff' },
    far: { default: 'sparse' },
    farExtra: [],
    midFill: { default: null },
    midStep: [4, 6],
    indoor: { convent: 'convent', chapel: 'chapel', catacomb: 'catacomb', mirrors: 'mirrors', ghosttrain: 'ghosttrain' },
    mist: ['graveyard', 'tower'],
    tilt: ['convent', 'circus'], // a slight camera tilt on the heavy downbeats
    song: 'nightmare',
  };

  // ======================================================================
  // LEVEL LIST — difficulty sets the coin reward (see game.js)
  // ======================================================================
  const LEVELS = [
    {
      id: 'home', num: 1, name: 'Hem till Storvreta', route: 'Uppland › Uppsala › Storvreta',
      difficulty: 1, diffName: 'Easy', reward: 50,
      winTitle: 'Välkommen hem, Vippe!', winSub: 'From the fields of Uppland, over the rooftops of Uppsala, all the way home to Storvreta.',
      build: buildHome, theme: HOME_THEME,
    },
    {
      id: 'metro', num: 2, name: 'Tunnelbanan', route: 'T-Centralen › Tunneln › Kloakerna',
      difficulty: 2, diffName: 'Medium', reward: 100,
      winTitle: 'Ur kloaken!', winSub: 'Over the trains, through the tunnel, down the hole, past the crocodiles and out into the sunshine.',
      build: buildMetro, theme: METRO_THEME,
    },
    {
      id: 'forest', num: 3, name: 'Vilda skogen', route: 'Skogsbrynet › Myren › Björngrottan › Gläntan',
      difficulty: 3, diffName: 'Hard', reward: 150,
      winTitle: 'Skogens hjälte!', winSub: 'Past the hedgehogs, over the bog, through the bear cave and out into the sunny clearing.',
      build: buildForest, theme: FOREST_THEME,
    },
    {
      id: 'chess', num: 4, name: 'Schackmatt', route: 'Brädet › Springarna › Tornet › Kungens tron',
      difficulty: 4, diffName: 'Very Hard', reward: 175,
      winTitle: 'Schack matt!',
      winSub: "Over the pawns, past the knights, up the rook tower, down the bishop's diagonal and all the way to a toppled king.",
      build: buildChess, theme: CHESS_THEME,
    },
    {
      id: 'ocean', num: 5, name: 'Djupet', route: 'Korallrevet › Manetsvärmen › Valens buk › Ytan',
      difficulty: 4, diffName: 'Very Hard', reward: 200,
      winTitle: 'Djupets mästare!',
      winSub: 'Past the urchins, through the wreck, over the current, straight through a whale and up into the light.',
      build: buildOcean, theme: OCEAN_THEME,
    },
    {
      id: 'nightmare', num: 6, name: 'Mardrömmen', route: 'Kyrkogården › Klostret › Katakomberna › Cirkusen',
      difficulty: 5, diffName: 'Nightmare', reward: 250, health: 135, age: 16, strobe: true,
      winTitle: 'Du överlevde natten!',
      winSub: 'Past the graves, the bloody nuns, the catacombs and the clowns, and out before the bell struck one.',
      build: buildNightmare, theme: NIGHTMARE_THEME,
    },
  ];

  VD.LEVELS = LEVELS;
  VD.levelDef = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
  VD.buildLevel = function (id) {
    const def = VD.levelDef(id);
    return new Level(def.build(), def);
  };
  VD.Level = Level;
  // level 4 "Schackmatt": exported so render.js can draw the king and his pawns at the same distances
  // the physics (Builder.pawn(), physics.js moveOf's 'throw' case) use
  VD.KING_AHEAD = KING_AHEAD;
  VD.KING_HAND_Y = KING_HAND_Y;
})();
