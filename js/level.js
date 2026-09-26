// VippeDash — level builder + the Uppland → Uppsala → Storvreta level
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
    constructor(b) {
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

  function buildLevel() {
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

    return new Level(b);
  }

  VD.buildLevel = buildLevel;
  VD.Level = Level;
})();
