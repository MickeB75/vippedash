// VippeDash — level builder + the levels (1: Uppland → Uppsala → Storvreta, 2: the wild forest)
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
      this.nextId = 1;
      this.finishX = 0;
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
    spike(x, y = 0, style) {
      return this.add({ t: 'haz', kind: 'spike', x, y, w: 1, h: 1, style, hx0: x + 0.35, hx1: x + 0.65, hy0: y + 0.05, hy1: y + 0.6 });
    }
    spikes(x, n, y = 0, style) {
      for (let i = 0; i < n; i++) this.spike(x + i, y, style);
    }
    // spike hanging down from `top`
    spikeDown(x, top, style) {
      return this.add({ t: 'haz', kind: 'spikeDown', x, y: top - 1, w: 1, h: 1, style, hx0: x + 0.35, hx1: x + 0.65, hy0: top - 0.6, hy1: top - 0.05 });
    }
    spikesDown(x, n, top, style) {
      for (let i = 0; i < n; i++) this.spikeDown(x + i, top, style);
    }
    half(x, y = 0, style) {
      return this.add({ t: 'haz', kind: 'half', x, y, w: 1, h: 0.5, style, hx0: x + 0.38, hx1: x + 0.62, hy0: y, hy1: y + 0.32 });
    }
    water(x, w) {
      return this.add({ t: 'haz', kind: 'water', x, y: 0, w, h: 0.3, hx0: x + 0.1, hx1: x + w - 0.1, hy0: -1, hy1: 0.28 });
    }
    // a crow hovering at (x, y); its hitbox is smaller than the drawing
    bird(x, y) {
      return this.add({ t: 'haz', kind: 'bird', x, y, w: 1, h: 1, hx0: x + 0.2, hx1: x + 0.8, hy0: y + 0.25, hy1: y + 0.7 });
    }
    pad(x, y = 0, color = 'yellow') {
      return this.add({ t: 'pad', x: x + 0.1, y, w: 0.8, h: 0.25, color });
    }
    orb(x, y, color = 'yellow') {
      return this.add({ t: 'orb', x: x - 0.1, y: y - 0.1, w: 1.2, h: 1.2, cx: x + 0.5, cy: y + 0.5, color });
    }
    portal(x, mode, opts = {}) {
      return this.add({ t: 'portal', x, y: opts.y == null ? 0 : opts.y, w: 1, h: 3, mode, ceil: opts.ceil == null ? null : opts.ceil });
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
      this.finishX = b.finishX;
      this.length = b.finishX + 40;
      this.areas = b.areas.sort((a, c) => a.x0 - c.x0);
      for (let i = 0; i < this.areas.length; i++) {
        this.areas[i].index = i;
        this.areas[i].x1 = i + 1 < this.areas.length ? this.areas[i + 1].x0 : this.length + 60;
      }
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
    b.deco('bales', 160);
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
    b.deco('runestone', 472);
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
  // LEVEL 2 — Vilda skogen (the wild forest). Harder: triple spikes, birds, orb chains,
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
    b.text(12, 4.6, 'Level 2 · Vilda skogen', 0.55);
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
    // stepping stones across the forest pool
    b.block(168, 0, 2, 1, 'rock');
    b.water(170, 4);
    b.block(174, 0, 2, 1, 'rock');
    b.water(176, 4);
    b.block(180, 0, 2, 2, 'rock');
    b.water(182, 4);
    b.block(186, 0, 2, 1, 'rock');
    b.spikes(196, 2);

    // ============ GRANSKOGEN (208 – 384) ============
    b.block(206, 0, 5, 1, 'timber');
    b.spike(209, 1);
    b.spikes(211, 2);
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
    b.block(410, 0, 2, 3, 'deadtree');
    b.block(420, 5, 2, 4, 'boughs');
    b.bird(428, 3.2);
    b.block(434, 0, 2, 4, 'deadtree');
    b.bird(441, 6.4);
    b.bird(442, 2.2);
    b.block(448, 5.5, 3, 3.5, 'boughs');
    b.block(456, 0, 2, 3.5, 'deadtree');
    b.bird(463, 6.2);
    b.block(468, 0, 3, 2.5, 'deadtree');
    b.block(468, 6, 3, 3, 'boughs');

    b.checkpoint(480, 'ship', 4.15, 9);
    b.block(490, 0, 2, 4, 'deadtree');
    b.block(490, 7.2, 2, 1.8, 'boughs');
    b.block(499, 0, 2, 1.8, 'deadtree');
    b.block(499, 5, 2, 4, 'boughs');
    b.block(508, 0, 2, 4.4, 'deadtree');
    b.block(508, 7.6, 2, 1.4, 'boughs');
    b.bird(516, 2.4);
    b.bird(516, 6.2);
    b.block(524, 0, 6, 2, 'deadtree');
    b.block(524, 5.5, 6, 3.5, 'boughs');
    b.bird(535, 4.2);
    b.block(542, 0, 2, 3.8, 'deadtree');
    b.block(548, 5.2, 2, 3.8, 'boughs');
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
      id: 'forest', num: 2, name: 'Vilda skogen', route: 'Skogsbrynet › Myren › Björngrottan › Gläntan',
      difficulty: 2, diffName: 'Medium', reward: 100,
      winTitle: 'Skogens hjälte!', winSub: 'Past the hedgehogs, over the bog, through the bear cave and out into the sunny clearing.',
      build: buildForest, theme: FOREST_THEME,
    },
  ];

  VD.LEVELS = LEVELS;
  VD.levelDef = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];
  VD.buildLevel = function (id) {
    const def = VD.levelDef(id);
    return new Level(def.build(), def);
  };
  VD.Level = Level;
})();
