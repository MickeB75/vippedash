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
  // price 0 = owned from the start; the rest are bought in the shop with coins
  Art.SKINS = {
    red: { name: 'Red jersey', main: '#d3122f', dark: '#6e0716', trim: '#ffffff', price: 0 },
    black: { name: 'Black hoodie', main: '#2a2a31', dark: '#0b0b0f', trim: '#dcdcdc', frame: '#e8e8e8', price: 0 },
    sirius: { name: 'Blue & black', main: '#1d5fc4', dark: '#0a1633', trim: '#101010', pattern: 'stripes', price: 0 },
    camo: { name: 'Forest camo', main: '#5d7a3a', dark: '#223018', trim: '#d8c48a', pattern: 'camo', hat: 'bandana', price: 150 },
    sweden: { name: 'Sweden', main: '#006aa7', dark: '#00365a', trim: '#fecc00', pattern: 'flag', hat: 'beanie', price: 200 },
    fox: { name: 'Fox', main: '#e8731f', dark: '#6e2e06', trim: '#ffffff', pattern: 'fox', hat: 'ears', price: 300 },
    tiger: { name: 'Tiger', main: '#f59a23', dark: '#4a2200', trim: '#1a1a1a', pattern: 'tiger', hat: 'tiger', price: 350 },
    moose: { name: 'Moose', main: '#6b4424', dark: '#2a180a', trim: '#e3cfa4', hat: 'antlers', price: 400 },
    student: { name: 'Student', main: '#23325a', dark: '#0a1024', trim: '#ffffff', hat: 'student', price: 450 },
    viking: { name: 'Viking', main: '#9a3a22', dark: '#3a1208', trim: '#e0b84a', pattern: 'viking', hat: 'viking', price: 600 },
    galaxy: { name: 'Galaxy', main: '#2d1b66', dark: '#0a0622', trim: '#c8b8ff', frame: '#b69cff', pattern: 'stars', hat: 'orbit', price: 800 },
    rainbow: { name: 'Rainbow', main: '#ff4d4d', dark: '#402060', trim: '#ffffff', pattern: 'rainbow', hat: 'propeller', price: 1000 },
    gold: { name: 'King Vippe', main: '#f2c230', dark: '#7a5200', trim: '#fff6c8', pattern: 'gold', hat: 'crown', price: 1500 },
    // ---- Affelito (char: 'alfred'): the trucker cap is his thing, so most of his skins come with one ----
    afTee: { char: 'alfred', name: 'Black tee', main: '#1c1c22', dark: '#050507', trim: '#ffffff', pattern: 'sleeves', hat: 'cap', cap: { front: '#c9a46b', mesh: '#1f2b47', brim: '#b58f58', badge: 'patch' }, price: 0 },
    afHoodie: { char: 'alfred', name: 'Grey hoodie', main: '#d6d6d1', dark: '#6f6f6a', trim: '#f4f4f0', frame: '#8a8a86', pattern: 'hoodie', hat: 'cap', cap: { front: '#22304f', mesh: '#22304f', brim: '#22304f', badge: 'star' }, price: 0 },
    afFleece: { char: 'alfred', name: 'Blue fleece', main: '#1ea2d8', dark: '#0b4f73', trim: '#e23a3a', pattern: 'fleece', hat: 'cap', cap: { front: '#f4f4f4', mesh: '#1b1b20', brim: '#1b1b20', badge: 'bolt' }, price: 0 },
    afCamo: { char: 'alfred', name: 'Pixel camo', main: '#5a7a3c', dark: '#1f2a17', trim: '#c9ccd2', pattern: 'pixel', hat: 'patchwork', price: 150 },
    afCowboy: { char: 'alfred', name: 'Cowboy', main: '#c07a36', dark: '#4a2a10', trim: '#f2e3c2', pattern: 'sheriff', hat: 'cowboy', price: 200 },
    afNinja: { char: 'alfred', name: 'Ninja', main: '#26262e', dark: '#0a0a0e', trim: '#d3122f', frame: '#d3122f', pattern: 'ninja', hat: 'headband', price: 300 },
    afPirate: { char: 'alfred', name: 'Pirate', main: '#c62a2a', dark: '#4a0c0c', trim: '#f2d27a', pattern: 'sailor', hat: 'tricorn', price: 350 },
    afModo: { char: 'alfred', name: 'MODO Affelito', main: '#c8102e', dark: '#4f070c', trim: '#ffffff', pattern: 'modo', hat: 'cap', cap: { front: '#ffffff', mesh: '#d3202c', brim: '#d3202c', badge: 'modo' }, price: 400 },
    afGoalie: { char: 'alfred', name: 'Goalie', main: '#2a2d34', dark: '#0c0d10', trim: '#ff8a1f', pattern: 'goalie', hat: 'goalie', price: 450 },
    afRobot: { char: 'alfred', name: 'Robot', main: '#9aa6b2', dark: '#3a434d', trim: '#5cf0ff', frame: '#c9d2da', pattern: 'robot', hat: 'robot', noHair: true, price: 600 },
    afAstro: { char: 'alfred', name: 'Astronaut', main: '#eef1f5', dark: '#5b6675', trim: '#ff7a1f', pattern: 'astro', hat: 'bubble', price: 800 },
    afDragon: { char: 'alfred', name: 'Dragon', main: '#2fa05a', dark: '#0f3d22', trim: '#ffd34d', pattern: 'scales', hat: 'dragon', noHair: true, price: 1000 },
    afFire: { char: 'alfred', name: 'Fire', main: '#b3200f', dark: '#3a0603', trim: '#ffd23a', frame: '#ff8a1f', pattern: 'fire', hat: 'flames', noHair: true, price: 1500 },
    afDiamond: { char: 'alfred', name: 'Diamond', main: '#7fdcff', dark: '#1a4f7a', trim: '#ffffff', frame: '#bff2ff', pattern: 'diamond', hat: 'cap', cap: { front: '#eafcff', mesh: '#8fe3ff', brim: '#bff2ff', badge: 'gem' }, price: 2000 },
  };
  // =====================================================================
  // CHARACTERS — everything that differs between playable characters lives here.
  // Art.cube()/eyes()/mouth() read these fields instead of testing for a specific
  // character id, so adding a new character means adding one entry below (plus its
  // own hook functions if it needs new hair/ears) and tagging its skins with
  // `char: '<id>'` in Art.SKINS — nothing else in the drawing code changes.
  //
  // A skin without `char` belongs to 'vippe'; an unknown/missing `char` on a skin
  // also falls back to 'vippe' (same fallback as Art.charOf). The shop tab and its
  // label are built automatically from Art.CHARS by js/game.js.
  //
  // Fields on an entry:
  //   name       shown on the shop tab (js/game.js)
  //   hair       hair colour, used by js/game.js for the shop-purchase confetti
  //   first      id of the skin shown on the tab icon and worn by default for this
  //              character — it MUST be a free skin (price 0)
  //   skin       face/neck tone
  //   face       the face rounded-rect, in units of the cube size s: { x, y, w, h, r }
  //   iris       iris (pupil) colour
  //   irisRing   colour the iris outline is stroked with; leave it out (or null) to
  //              leave the eye socket's own outline colour showing through instead
  //   brow       eyebrow colour
  //   arch       how curved the eyebrows are (bigger = more arched)
  //   grinTilt   radians the 'grin'/'happy' mouth is rotated by (0 = straight)
  // Optional draw hooks, each `(ctx, s) => void`, for layers drawn at fixed points
  // in Art.cube's stack (all may be omitted):
  //   behindFace draws before the face, e.g. ears sticking out past its edges
  //   fringe     hair drawn after the face/cheeks but before the eyes, e.g. a
  //              fringe overlapping the forehead
  //   topHair    hair drawn on top, after the mouth, e.g. curls framing the face
  // `fringe` and `topHair` are both skipped when the skin sets `noHair: true`;
  // `behindFace` is not, since ears or a taller forehead don't count as hair.
  // =====================================================================
  Art.CHARS = {
    vippe: {
      name: 'Vippe', hair: '#6b4526', first: 'red',
      skin: '#f2c6a0', face: { x: -0.36, y: -0.3, w: 0.72, h: 0.68, r: 0.16 },
      iris: '#6d9fc4', irisRing: null, brow: '#4a2c18', arch: 0.06, grinTilt: 0,
      topHair: hair,
    },
    alfred: {
      name: 'Affelito', hair: '#8a5a2e', first: 'afTee',
      skin: '#f4caa6', face: { x: -0.36, y: -0.38, w: 0.72, h: 0.76, r: 0.16 },
      iris: '#8fa674', irisRing: '#566b42', brow: '#5e3f22', arch: 0.03, grinTilt: -0.13,
      behindFace: alfEars, fringe: alfHair,
    },
  };
  Art.charOf = (skinId) => (Art.SKINS[skinId] && Art.SKINS[skinId].char) || 'vippe';
  const CAMO = [
    [-0.42, -0.3, 0.2, 0.13, 0], [0.38, -0.36, 0.18, 0.12, 1], [-0.44, 0.18, 0.16, 0.2, 2], [0.42, 0.12, 0.17, 0.21, 0],
    [-0.1, 0.46, 0.24, 0.1, 1], [0.26, 0.44, 0.14, 0.09, 2], [-0.36, 0.44, 0.1, 0.08, 0], [0.46, -0.05, 0.08, 0.1, 2],
  ];
  // [x, y, w, h, colour] blocks for Affelito's pixel camo
  const PIXEL = [
    [-0.5, -0.5, 0.14, 0.12, 0], [-0.5, -0.22, 0.1, 0.16, 1], [-0.46, 0.02, 0.12, 0.1, 3], [-0.5, 0.2, 0.14, 0.12, 2],
    [0.36, -0.46, 0.14, 0.1, 1], [0.4, -0.2, 0.1, 0.14, 3], [0.36, 0.04, 0.14, 0.12, 2], [0.4, 0.26, 0.1, 0.12, 0],
    [-0.36, 0.38, 0.16, 0.12, 0], [-0.12, 0.4, 0.12, 0.1, 2], [0.06, 0.38, 0.14, 0.12, 4], [0.24, 0.4, 0.12, 0.1, 3],
    [-0.5, 0.38, 0.1, 0.12, 4], [0.44, -0.04, 0.06, 0.06, 0], [-0.4, -0.34, 0.06, 0.08, 2],
  ];
  const RAINBOW = ['#ff4d4d', '#ff9a2e', '#ffe23a', '#4fd65a', '#3aa8ff', '#8a5cff'];
  // body pattern, drawn clipped to the rounded cube
  function bodyPattern(ctx, s, k) {
    const h = s / 2;
    const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
    switch (k.pattern) {
      case 'stripes':
        ctx.fillStyle = k.dark;
        for (let i = -2; i <= 2; i++) ctx.fillRect(i * s * 0.24 - s * 0.055, -h, s * 0.11, s);
        break;
      case 'camo':
        for (const [x, y, rx, ry, c] of CAMO) {
          ctx.fillStyle = ['#3b5226', '#8c8f52', '#2a2a1c'][c];
          ctx.beginPath();
          ctx.ellipse(x * s, y * s, rx * s, ry * s, x * 3, 0, TAU);
          ctx.fill();
        }
        break;
      case 'flag':
        ctx.fillStyle = k.trim;
        ctx.fillRect(-h, -s * 0.07, s, s * 0.16);
        ctx.fillRect(-s * 0.2, -h, s * 0.16, s);
        break;
      case 'fox':
        ctx.fillStyle = '#fff6ea';
        ctx.beginPath();
        ctx.ellipse(0, h, s * 0.42, s * 0.26, 0, 0, TAU);
        ctx.fill();
        break;
      case 'tiger':
        ctx.strokeStyle = k.dark;
        ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.07;
        for (const y of [-0.34, -0.08, 0.18, 0.42]) {
          for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(sd * h, y * s);
            ctx.quadraticCurveTo(sd * s * 0.36, (y + 0.03) * s, sd * s * 0.3, (y + 0.1) * s);
            ctx.stroke();
          }
        }
        break;
      case 'viking':
        // fur collar
        ctx.fillStyle = '#c9a877';
        for (let i = -4; i <= 4; i++) {
          circle(ctx, i * s * 0.12, h - s * 0.02, s * 0.1);
          ctx.fill();
        }
        break;
      case 'stars': {
        const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, 0, -s * 0.3, -s * 0.3, s * 0.8);
        g.addColorStop(0, '#7b3fb8');
        g.addColorStop(1, 'rgba(45,27,102,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-h, -h, s, s);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 14; i++) {
          const x = (U.hash(i * 3.1) - 0.5) * s, y = (U.hash(i * 7.7) - 0.5) * s;
          const r = s * (0.012 + 0.02 * U.hash(i * 1.9)) * (0.7 + 0.3 * Math.sin(now * 3 + i));
          circle(ctx, x, y, r);
          ctx.fill();
        }
        break;
      }
      case 'rainbow': {
        const bw = s / 6, off = ((now * s * 0.6) % s) - s;
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = RAINBOW[i % 6];
          ctx.fillRect(-h, -h + off + i * bw, s, bw + 0.5);
        }
        break;
      }
      case 'gold': {
        const g = ctx.createLinearGradient(-h, -h, h, h);
        g.addColorStop(0, '#fff0a0');
        g.addColorStop(0.5, '#f2c230');
        g.addColorStop(1, '#b8860b');
        ctx.fillStyle = g;
        ctx.fillRect(-h, -h, s, s);
        const p = ((now * 0.7) % 2) - 0.5;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo((p - 0.5) * s * 2, h);
        ctx.lineTo((p - 0.35) * s * 2, h);
        ctx.lineTo((p + 0.15) * s * 2, -h);
        ctx.lineTo(p * s * 2, -h);
        ctx.fill();
        break;
      }
      // ---- Affelito ---- (his face covers x ±0.36, y -0.38..0.38, so patterns show at the sides and the hem)
      case 'sleeves':
        // three white stripes down each side, like his football shirt
        ctx.fillStyle = k.trim;
        for (const sd of [-1, 1]) for (const x of [0.385, 0.425, 0.465]) ctx.fillRect(sd * x * s - s * 0.012, -h, s * 0.024, s);
        break;
      case 'hoodie':
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = s * 0.03;
        ctx.beginPath();
        ctx.moveTo(-h, 0.38 * s);
        ctx.quadraticCurveTo(0, 0.32 * s, h, 0.38 * s); // kangaroo pocket
        for (const sd of [-1, 1]) {
          ctx.moveTo(sd * 0.43 * s, -h);
          ctx.lineTo(sd * 0.43 * s, h);
        }
        ctx.stroke();
        break;
      case 'fleece':
        // curved seams down the sides
        ctx.strokeStyle = k.dark;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = s * 0.022;
        ctx.setLineDash([s * 0.03, s * 0.025]);
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sd * 0.47 * s, -h);
          ctx.quadraticCurveTo(sd * 0.36 * s, 0, sd * 0.46 * s, h);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        break;
      case 'pixel':
        // blocky camo, like his old rain jacket
        for (const [x, y, w, hh, c] of PIXEL) {
          ctx.fillStyle = ['#2f4a22', '#8fa36a', '#c9ccd2', '#1c2414', '#6f8750'][c];
          ctx.fillRect(x * s, y * s, w * s, hh * s);
        }
        break;
      case 'sheriff':
        // leather vest and a sheriff's star
        ctx.fillStyle = '#7a4a1f';
        ctx.fillRect(-h, -h, s * 0.13, s);
        ctx.fillRect(h - s * 0.13, -h, s * 0.13, s);
        ctx.fillStyle = '#f2e3c2';
        for (let y = -0.4; y < 0.5; y += 0.12) ctx.fillRect(h - s * 0.13, y * s, s * 0.03, s * 0.05);
        ctx.fillStyle = '#f2c230';
        star5(ctx, -0.43 * s, 0.14 * s, s * 0.075);
        ctx.fill();
        ctx.lineWidth = s * 0.015;
        ctx.strokeStyle = '#7a5200';
        ctx.stroke();
        break;
      case 'ninja':
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = s * 0.06;
        ctx.beginPath();
        ctx.moveTo(-h, -h);
        ctx.lineTo(h, h);
        ctx.moveTo(h, -h);
        ctx.lineTo(-h, h);
        ctx.stroke();
        ctx.fillStyle = k.trim; // belt
        ctx.fillRect(-h, 0.37 * s, s, 0.08 * s);
        break;
      case 'sailor':
        ctx.fillStyle = '#f6efe2';
        for (let y = -0.46; y < 0.5; y += 0.16) ctx.fillRect(-h, y * s, s, 0.07 * s);
        break;
      case 'modo':
        // hockey jersey: white-green-white bands at the hem and on the shoulders
        for (const y0 of [0.27, -0.47]) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-h, y0 * s, s, 0.14 * s);
          ctx.fillStyle = '#0a7a3b';
          ctx.fillRect(-h, (y0 + 0.035) * s, s, 0.07 * s);
        }
        break;
      case 'goalie':
        for (const y0 of [-0.3, 0.2]) {
          ctx.fillStyle = k.trim;
          ctx.fillRect(-h, y0 * s, s, 0.1 * s);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-h, (y0 + 0.1) * s, s, 0.03 * s);
        }
        break;
      case 'robot': {
        const g = ctx.createLinearGradient(-h, -h, h, h);
        g.addColorStop(0, '#dfe6ec');
        g.addColorStop(0.5, '#9aa6b2');
        g.addColorStop(1, '#5f6b77');
        ctx.fillStyle = g;
        ctx.fillRect(-h, -h, s, s);
        ctx.strokeStyle = 'rgba(40,48,56,0.45)';
        ctx.lineWidth = s * 0.02;
        ctx.strokeRect(-0.44 * s, -0.44 * s, 0.88 * s, 0.88 * s);
        ctx.fillStyle = '#4a545e';
        for (const [x, y] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]]) {
          circle(ctx, x * s, y * s, s * 0.025);
          ctx.fill();
        }
        // blinking status lights on the side
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = Math.sin(now * 5 + i * 2.1) > 0 ? ['#5cf0ff', '#7dff9a', '#ffd634'][i] : '#2a3440';
          circle(ctx, 0.43 * s, (0.02 + i * 0.1) * s, s * 0.025);
          ctx.fill();
        }
        break;
      }
      case 'astro':
        ctx.fillStyle = '#d5dbe3';
        ctx.fillRect(-h, 0.3 * s, s, 0.2 * s);
        ctx.fillStyle = k.trim;
        ctx.fillRect(-h, 0.24 * s, s, 0.05 * s);
        // a Swedish flag patch on one arm and buttons on the other
        ctx.fillStyle = '#006aa7';
        ctx.fillRect(-0.48 * s, -0.12 * s, 0.1 * s, 0.07 * s);
        ctx.fillStyle = '#fecc00';
        ctx.fillRect(-0.48 * s, -0.095 * s, 0.1 * s, 0.018 * s);
        ctx.fillRect(-0.455 * s, -0.12 * s, 0.018 * s, 0.07 * s);
        ['#ff4d4d', '#3aa8ff', '#7dff9a'].forEach((c, i) => {
          ctx.fillStyle = c;
          circle(ctx, 0.43 * s, (-0.1 + i * 0.09) * s, s * 0.022);
          ctx.fill();
        });
        break;
      case 'scales':
        ctx.strokeStyle = k.dark;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = s * 0.02;
        for (let r = 0; r < 9; r++) {
          const y = -h + r * s * 0.11;
          for (let x = -h + (r % 2) * s * 0.07; x < h + s * 0.1; x += s * 0.14) {
            ctx.beginPath();
            ctx.arc(x, y, s * 0.07, 0.1, Math.PI - 0.1);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = k.trim; // belly
        ctx.beginPath();
        ctx.ellipse(0, h, s * 0.36, s * 0.14, 0, 0, TAU);
        ctx.fill();
        break;
      case 'fire': {
        // flames licking up the sides from the hem
        for (const [c, hk] of [['#ff5a1f', 1], ['#ffb52e', 0.62], ['#fff3a0', 0.3]]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.moveTo(-h, h);
          for (let i = 0; i < 6; i++) {
            const x0 = -h + (i * s) / 6, xm = x0 + s / 12;
            const tip = h - (0.45 + 0.35 * U.hash(i * 3.7) + 0.12 * Math.sin(now * 10 + i * 1.7)) * s * hk;
            ctx.quadraticCurveTo(x0, h - s * 0.12 * hk, xm + Math.sin(now * 6 + i) * s * 0.03, tip);
            ctx.quadraticCurveTo(x0 + s / 6, h - s * 0.12 * hk, x0 + s / 6, h);
          }
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'diamond': {
        // cut facets, a sweeping shine and a few twinkles
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const x = -h + c * s * 0.25, y = -h + r * s * 0.25, q = s * 0.25;
            ctx.fillStyle = ['#bff2ff', '#7fdcff', '#4fb8e8', '#e8fbff'][(r + c * 3) % 4];
            tri(ctx, x, y, x + q, y, x + q, y + q);
            ctx.fill();
            ctx.fillStyle = ['#4fb8e8', '#e8fbff', '#7fdcff', '#bff2ff'][(r * 3 + c) % 4];
            tri(ctx, x, y, x, y + q, x + q, y + q);
            ctx.fill();
          }
        }
        const p = ((now * 0.8) % 2) - 0.5;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo((p - 0.5) * s * 2, h);
        ctx.lineTo((p - 0.35) * s * 2, h);
        ctx.lineTo((p + 0.15) * s * 2, -h);
        ctx.lineTo(p * s * 2, -h);
        ctx.fill();
        break;
      }
      default:
        // subtle jersey pattern
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = s * 0.05;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.25 - h, h);
          ctx.lineTo(i * s * 0.25 + h, -h);
          ctx.stroke();
        }
    }
  }
  function star5(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    ctx.closePath();
  }
  // hats and ears sit on top of the curls
  function hat(ctx, s, k) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
    switch (k.hat) {
      case 'bandana': {
        // camo headband knotted at the side
        ctx.fillStyle = '#4e6b30';
        for (const [dx, dy] of [[0.5, -0.3], [0.5, -0.24]]) {
          ctx.beginPath();
          ctx.moveTo(dx * s, dy * s);
          ctx.lineTo((dx + 0.24) * s, (dy + 0.08 + Math.sin(now * 6 + dy * 20) * 0.03) * s);
          ctx.lineTo((dx + 0.2) * s, (dy + 0.16) * s);
          ctx.closePath();
          ctx.fill();
        }
        rr(ctx, -0.54 * s, -0.36 * s, 1.08 * s, 0.14 * s, 0.06 * s);
        ctx.fill();
        ctx.lineWidth = s * 0.025;
        ctx.strokeStyle = '#223018';
        ctx.stroke();
        for (const [dx, c] of [[-0.4, '#2a3a1a'], [-0.15, '#8c8f52'], [0.08, '#2a3a1a'], [0.32, '#8c8f52']]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(dx * s, -0.29 * s, 0.08 * s, 0.035 * s, 0.3, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'beanie': {
        // blue-and-yellow bobble hat
        ctx.fillStyle = '#fecc00';
        circle(ctx, 0, -1.0 * s, 0.13 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-0.48 * s, -0.6 * s);
        ctx.bezierCurveTo(-0.48 * s, -1.08 * s, 0.48 * s, -1.08 * s, 0.48 * s, -0.6 * s);
        ctx.closePath();
        ctx.fillStyle = '#006aa7';
        ctx.fill();
        ctx.fillStyle = '#fecc00';
        ctx.fillRect(-0.36 * s, -0.86 * s, 0.72 * s, 0.07 * s);
        rr(ctx, -0.52 * s, -0.66 * s, 1.04 * s, 0.14 * s, 0.05 * s);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = s * 0.02;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 0.11 * s, -0.64 * s);
          ctx.lineTo(i * 0.11 * s, -0.54 * s);
          ctx.stroke();
        }
        break;
      }
      case 'tiger':
        for (const sd of [-1, 1]) {
          ctx.fillStyle = k.main;
          circle(ctx, sd * 0.38 * s, -0.74 * s, 0.15 * s);
          ctx.fill();
          ctx.lineWidth = s * 0.035;
          ctx.strokeStyle = k.trim;
          ctx.stroke();
          ctx.fillStyle = '#3a1a00';
          circle(ctx, sd * 0.38 * s, -0.72 * s, 0.07 * s);
          ctx.fill();
          // whiskers
          ctx.strokeStyle = '#3a2418';
          ctx.lineWidth = s * 0.018;
          for (const a of [-0.2, 0, 0.2]) {
            ctx.beginPath();
            ctx.moveTo(sd * 0.22 * s, 0.1 * s);
            ctx.lineTo(sd * 0.4 * s, (0.1 + a * 0.4) * s);
            ctx.stroke();
          }
        }
        break;
      case 'orbit':
        // little stars circling the curls
        for (let i = 0; i < 3; i++) {
          const a = now * 1.6 + (i * TAU) / 3;
          const x = Math.cos(a) * 0.52 * s, y = -0.8 * s + Math.sin(a) * 0.14 * s;
          ctx.fillStyle = ['#ffffff', '#ffe46b', '#c8b8ff'][i];
          star5(ctx, x, y, s * (0.09 + 0.02 * Math.sin(now * 5 + i)));
          ctx.fill();
        }
        break;
      case 'propeller': {
        // rainbow propeller cap
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = RAINBOW[i];
          ctx.beginPath();
          ctx.moveTo(0, -0.64 * s);
          ctx.arc(0, -0.64 * s, 0.38 * s, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#2a2a33';
        ctx.fillRect(-0.44 * s, -0.66 * s, 0.88 * s, 0.07 * s);
        ctx.fillRect(-0.02 * s, -1.14 * s, 0.04 * s, 0.14 * s);
        const c = Math.cos(now * 18);
        ctx.fillStyle = '#ffd634';
        ctx.beginPath();
        ctx.ellipse(0, -1.14 * s, Math.abs(c) * 0.3 * s + 0.02 * s, 0.05 * s, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#d3122f';
        circle(ctx, 0, -1.14 * s, 0.04 * s);
        ctx.fill();
        break;
      }
      case 'ears':
        for (const sd of [-1, 1]) {
          const x = sd * 0.4 * s;
          ctx.fillStyle = k.main;
          tri(ctx, x - 0.14 * s, -0.52 * s, x + sd * 0.1 * s, -1.0 * s, x + 0.14 * s, -0.52 * s);
          ctx.fill();
          ctx.lineWidth = s * 0.035;
          ctx.strokeStyle = k.dark;
          ctx.stroke();
          ctx.fillStyle = '#3a1a08';
          tri(ctx, x - 0.07 * s, -0.58 * s, x + sd * 0.07 * s, -0.86 * s, x + 0.07 * s, -0.58 * s);
          ctx.fill();
        }
        break;
      case 'antlers':
        for (const sd of [-1, 1]) {
          const bx = sd * 0.3 * s, by = -0.62 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx + sd * 0.2 * s, by - 0.02 * s, bx + sd * 0.34 * s, by - 0.12 * s);
          for (let i = 0; i < 4; i++) {
            const px = bx + sd * (0.4 - i * 0.1) * s;
            ctx.lineTo(px + sd * 0.06 * s, by - (0.36 + (i % 2) * 0.06) * s);
            ctx.lineTo(px - sd * 0.03 * s, by - 0.22 * s);
          }
          ctx.quadraticCurveTo(bx + sd * 0.04 * s, by - 0.12 * s, bx - sd * 0.04 * s, by - 0.02 * s);
          ctx.closePath();
          ctx.fillStyle = '#e3cfa4';
          ctx.fill();
          ctx.lineWidth = s * 0.03;
          ctx.strokeStyle = '#6b5230';
          ctx.stroke();
        }
        break;
      case 'student':
        ctx.fillStyle = '#ffffff';
        rr(ctx, -0.42 * s, -1.0 * s, 0.84 * s, 0.36 * s, 0.14 * s);
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#9aa0a8';
        ctx.stroke();
        ctx.fillStyle = '#141414';
        rr(ctx, -0.44 * s, -0.7 * s, 0.88 * s, 0.13 * s, 0.04 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0.06 * s, -0.57 * s, 0.34 * s, 0.06 * s, 0, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#e2b400';
        circle(ctx, 0, -0.64 * s, 0.045 * s);
        ctx.fill();
        break;
      case 'viking':
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sd * 0.36 * s, -0.66 * s);
          ctx.quadraticCurveTo(sd * 0.76 * s, -0.72 * s, sd * 0.74 * s, -1.08 * s);
          ctx.quadraticCurveTo(sd * 0.6 * s, -0.86 * s, sd * 0.34 * s, -0.84 * s);
          ctx.closePath();
          ctx.fillStyle = '#f3ead6';
          ctx.fill();
          ctx.lineWidth = s * 0.03;
          ctx.strokeStyle = '#7d6a4a';
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-0.46 * s, -0.56 * s);
        ctx.bezierCurveTo(-0.46 * s, -1.08 * s, 0.46 * s, -1.08 * s, 0.46 * s, -0.56 * s);
        ctx.closePath();
        ctx.fillStyle = '#9aa3ad';
        ctx.fill();
        ctx.lineWidth = s * 0.035;
        ctx.strokeStyle = '#3e454d';
        ctx.stroke();
        ctx.fillStyle = '#c9ced4';
        ctx.fillRect(-0.04 * s, -0.95 * s, 0.08 * s, 0.39 * s);
        ctx.fillStyle = '#6d757e';
        ctx.fillRect(-0.46 * s, -0.64 * s, 0.92 * s, 0.08 * s);
        break;
      case 'crown': {
        const P = [[-0.36, -0.56], [-0.38, -0.92], [-0.22, -0.74], [-0.11, -1.0], [0, -0.76], [0.11, -1.0], [0.22, -0.74], [0.38, -0.92], [0.36, -0.56]];
        ctx.beginPath();
        P.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -s, 0, -0.56 * s);
        g.addColorStop(0, '#fff3a0');
        g.addColorStop(1, '#e0a810');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#7a5200';
        ctx.stroke();
        for (const [x, y] of [P[1], P[3], P[5], P[7]]) {
          ctx.fillStyle = '#fff3a0';
          circle(ctx, x * s, y * s, 0.045 * s);
          ctx.fill();
        }
        [['#d3122f', -0.2], ['#1d5fc4', 0], ['#2ea84a', 0.2]].forEach(([c, x]) => {
          ctx.fillStyle = c;
          circle(ctx, x * s, -0.64 * s, 0.045 * s);
          ctx.fill();
        });
        break;
      }
      // ---- Affelito ----
      case 'cap':
        truckerCap(ctx, s, k.cap, now);
        break;
      case 'patchwork': {
        // dark beanie covered in colourful patches
        ctx.beginPath();
        ctx.moveTo(-0.54 * s, -0.42 * s);
        ctx.bezierCurveTo(-0.56 * s, -1.14 * s, 0.56 * s, -1.14 * s, 0.54 * s, -0.42 * s);
        ctx.closePath();
        ctx.fillStyle = '#34363d';
        ctx.fill();
        ctx.save();
        ctx.clip();
        for (const [x, y, c, r] of PATCHES) {
          ctx.save();
          ctx.translate(x * s, y * s);
          ctx.rotate(r);
          ctx.fillStyle = c;
          ctx.fillRect(-0.065 * s, -0.05 * s, 0.13 * s, 0.1 * s);
          ctx.restore();
        }
        ctx.restore();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#15161a';
        ctx.stroke();
        rr(ctx, -0.56 * s, -0.52 * s, 1.12 * s, 0.15 * s, 0.05 * s);
        ctx.fillStyle = '#2a2c32';
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'cowboy': {
        ctx.beginPath();
        ctx.moveTo(-0.34 * s, -0.48 * s);
        ctx.lineTo(-0.38 * s, -0.98 * s);
        ctx.quadraticCurveTo(-0.2 * s, -1.08 * s, 0, -0.94 * s);
        ctx.quadraticCurveTo(0.2 * s, -1.08 * s, 0.38 * s, -0.98 * s);
        ctx.lineTo(0.34 * s, -0.48 * s);
        ctx.closePath();
        ctx.fillStyle = '#8a5626';
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#3e2410';
        ctx.stroke();
        ctx.fillStyle = '#3e2410';
        ctx.fillRect(-0.36 * s, -0.66 * s, 0.72 * s, 0.09 * s);
        ctx.fillStyle = '#e6c35a';
        circle(ctx, 0.2 * s, -0.615 * s, 0.035 * s);
        ctx.fill();
        // wide brim curling up at both sides
        ctx.beginPath();
        ctx.moveTo(-0.84 * s, -0.82 * s);
        ctx.quadraticCurveTo(-0.7 * s, -0.5 * s, 0, -0.52 * s);
        ctx.quadraticCurveTo(0.7 * s, -0.5 * s, 0.84 * s, -0.82 * s);
        ctx.quadraticCurveTo(0.74 * s, -0.38 * s, 0, -0.38 * s);
        ctx.quadraticCurveTo(-0.74 * s, -0.38 * s, -0.84 * s, -0.82 * s);
        ctx.closePath();
        ctx.fillStyle = '#9a6330';
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'headband': {
        // red ninja headband, its two tails flapping behind
        ctx.fillStyle = k.trim;
        for (const [dy, ph] of [[-0.42, 0], [-0.36, 1.7]]) {
          const w = Math.sin(now * 9 + ph) * 0.05;
          ctx.beginPath();
          ctx.moveTo(-0.5 * s, (dy - 0.035) * s);
          ctx.quadraticCurveTo(-0.7 * s, (dy + w) * s, -0.88 * s, (dy + 0.06 + w * 1.6) * s);
          ctx.lineTo(-0.85 * s, (dy + 0.14 + w * 1.6) * s);
          ctx.quadraticCurveTo(-0.68 * s, (dy + 0.08 + w) * s, -0.5 * s, (dy + 0.035) * s);
          ctx.closePath();
          ctx.fill();
        }
        rr(ctx, -0.56 * s, -0.47 * s, 1.12 * s, 0.14 * s, 0.05 * s);
        ctx.fill();
        ctx.lineWidth = s * 0.025;
        ctx.strokeStyle = '#6e0716';
        ctx.stroke();
        rr(ctx, -0.17 * s, -0.48 * s, 0.34 * s, 0.16 * s, 0.03 * s);
        const g = ctx.createLinearGradient(0, -0.48 * s, 0, -0.32 * s);
        g.addColorStop(0, '#eef2f6');
        g.addColorStop(1, '#8e98a4');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#4a525c';
        ctx.stroke();
        // throwing star engraved on the plate
        ctx.fillStyle = '#4a525c';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = now * 0.5 + (i * Math.PI) / 4, r = (i % 2 ? 0.02 : 0.06) * s;
          ctx.lineTo(Math.cos(a) * r, -0.4 * s + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'tricorn': {
        // eye patch first, so the hat sits over its strap
        ctx.strokeStyle = '#111';
        ctx.lineWidth = s * 0.03;
        ctx.beginPath();
        ctx.moveTo(-0.38 * s, -0.36 * s);
        ctx.lineTo(0.38 * s, 0.1 * s);
        ctx.stroke();
        ctx.fillStyle = '#141414';
        ctx.beginPath();
        ctx.ellipse(0.17 * s, -0.035 * s, 0.12 * s, 0.11 * s, 0.2, 0, TAU);
        ctx.fill();
        // three-cornered hat with a skull and gold edging
        ctx.beginPath();
        ctx.moveTo(-0.74 * s, -0.6 * s);
        ctx.quadraticCurveTo(-0.5 * s, -1.18 * s, 0, -1.02 * s);
        ctx.quadraticCurveTo(0.5 * s, -1.18 * s, 0.74 * s, -0.6 * s);
        ctx.quadraticCurveTo(0.3 * s, -0.66 * s, 0, -0.42 * s);
        ctx.quadraticCurveTo(-0.3 * s, -0.66 * s, -0.74 * s, -0.6 * s);
        ctx.closePath();
        ctx.fillStyle = '#1c1c22';
        ctx.fill();
        ctx.strokeStyle = k.trim;
        ctx.lineWidth = s * 0.035;
        ctx.stroke();
        ctx.strokeStyle = '#f4f1e8';
        ctx.lineWidth = s * 0.035;
        ctx.beginPath();
        ctx.moveTo(-0.14 * s, -0.86 * s);
        ctx.lineTo(0.14 * s, -0.64 * s);
        ctx.moveTo(0.14 * s, -0.86 * s);
        ctx.lineTo(-0.14 * s, -0.64 * s);
        ctx.stroke();
        ctx.fillStyle = '#f4f1e8';
        circle(ctx, 0, -0.8 * s, 0.085 * s);
        ctx.fill();
        ctx.fillRect(-0.05 * s, -0.76 * s, 0.1 * s, 0.07 * s);
        ctx.fillStyle = '#1c1c22';
        circle(ctx, -0.032 * s, -0.8 * s, 0.022 * s);
        ctx.fill();
        circle(ctx, 0.032 * s, -0.8 * s, 0.022 * s);
        ctx.fill();
        break;
      }
      case 'goalie': {
        // white hockey helmet with a cat-eye cage (the openings leave his eyes free)
        ctx.beginPath();
        ctx.moveTo(-0.56 * s, -0.06 * s);
        ctx.lineTo(-0.56 * s, -0.5 * s);
        ctx.bezierCurveTo(-0.56 * s, -1.1 * s, 0.56 * s, -1.1 * s, 0.56 * s, -0.5 * s);
        ctx.lineTo(0.56 * s, -0.06 * s);
        ctx.lineTo(0.42 * s, -0.06 * s);
        ctx.lineTo(0.42 * s, -0.34 * s);
        ctx.quadraticCurveTo(0, -0.46 * s, -0.42 * s, -0.34 * s);
        ctx.lineTo(-0.42 * s, -0.06 * s);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -s, 0, 0);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#c9ced6');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#2a2e36';
        ctx.stroke();
        // air vents, a strap clip on each side and an orange rim
        ctx.fillStyle = '#2a2e36';
        for (const [x, y, w] of [[-0.3, -0.72, 0.12], [-0.06, -0.8, 0.12], [0.18, -0.72, 0.12], [-0.18, -0.6, 0.1], [0.08, -0.6, 0.1]]) {
          rr(ctx, x * s, y * s, w * s, 0.045 * s, 0.02 * s);
          ctx.fill();
        }
        for (const sd of [-1, 1]) {
          circle(ctx, sd * 0.49 * s, -0.2 * s, 0.035 * s);
          ctx.fill();
        }
        ctx.strokeStyle = k.trim;
        ctx.lineWidth = s * 0.035;
        ctx.beginPath();
        ctx.moveTo(-0.42 * s, -0.34 * s);
        ctx.quadraticCurveTo(0, -0.46 * s, 0.42 * s, -0.34 * s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(40,44,52,0.9)';
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        for (const x of [-0.3, -0.06, 0.06, 0.3]) {
          ctx.moveTo(x * s, -0.36 * s);
          ctx.lineTo(x * s * 0.8, 0.46 * s);
        }
        for (const y of [0.1, 0.26, 0.4]) {
          ctx.moveTo(-0.4 * s, y * s);
          ctx.lineTo(0.4 * s, y * s);
        }
        ctx.stroke();
        ctx.lineWidth = s * 0.04;
        rr(ctx, -0.42 * s, -0.36 * s, 0.84 * s, 0.84 * s, 0.22 * s);
        ctx.stroke();
        break;
      }
      case 'robot': {
        // metal dome with rivets, a glowing visor line and a blinking antenna
        ctx.strokeStyle = '#5a636e';
        ctx.lineWidth = s * 0.035;
        ctx.beginPath();
        ctx.moveTo(0, -0.9 * s);
        ctx.lineTo(0, -1.12 * s);
        ctx.stroke();
        const on = Math.sin(now * 6) > 0;
        if (on) {
          ctx.fillStyle = 'rgba(255,80,80,0.35)';
          circle(ctx, 0, -1.16 * s, 0.1 * s);
          ctx.fill();
        }
        ctx.fillStyle = on ? '#ff4040' : '#801818';
        circle(ctx, 0, -1.16 * s, 0.055 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-0.54 * s, -0.34 * s);
        ctx.bezierCurveTo(-0.56 * s, -1.08 * s, 0.56 * s, -1.08 * s, 0.54 * s, -0.34 * s);
        ctx.closePath();
        const g = ctx.createLinearGradient(-0.5 * s, -s, 0.5 * s, -0.3 * s);
        g.addColorStop(0, '#eef3f7');
        g.addColorStop(1, '#7f8b98');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#3a434d';
        ctx.stroke();
        ctx.fillStyle = '#4a545e';
        ctx.fillRect(-0.55 * s, -0.46 * s, 1.1 * s, 0.1 * s);
        ctx.fillStyle = '#c9d2da';
        for (const x of [-0.42, -0.21, 0, 0.21, 0.42]) {
          circle(ctx, x * s, -0.41 * s, 0.025 * s);
          ctx.fill();
        }
        ctx.fillStyle = k.trim;
        rr(ctx, -0.3 * s, -0.74 * s, 0.6 * s, 0.07 * s, 0.035 * s);
        ctx.fill();
        // ear bolts
        for (const sd of [-1, 1]) {
          rr(ctx, sd * 0.47 * s - 0.07 * s, -0.16 * s, 0.14 * s, 0.26 * s, 0.05 * s);
          ctx.fillStyle = '#8793a0';
          ctx.fill();
          ctx.lineWidth = s * 0.025;
          ctx.strokeStyle = '#3a434d';
          ctx.stroke();
          ctx.fillStyle = k.trim;
          circle(ctx, sd * 0.47 * s, -0.03 * s, 0.03 * s);
          ctx.fill();
        }
        break;
      }
      case 'bubble': {
        // glass space helmet over the whole head
        const cy = -0.12 * s, r = 0.76 * s;
        ctx.fillStyle = 'rgba(170,215,255,0.16)';
        circle(ctx, 0, cy, r);
        ctx.fill();
        ctx.lineWidth = s * 0.05;
        ctx.strokeStyle = 'rgba(235,245,255,0.9)';
        ctx.stroke();
        ctx.lineWidth = s * 0.02;
        ctx.strokeStyle = 'rgba(120,140,170,0.7)';
        circle(ctx, 0, cy, r + s * 0.03);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = s * 0.06;
        ctx.beginPath();
        ctx.arc(0, cy, r * 0.8, Math.PI * 1.1, Math.PI * 1.38);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        circle(ctx, 0.46 * s, -0.6 * s, 0.045 * s);
        ctx.fill();
        break;
      }
      case 'dragon': {
        // green dragon hood with ivory horns and a spiky crest
        for (const sd of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(sd * 0.22 * s, -0.78 * s);
          ctx.quadraticCurveTo(sd * 0.5 * s, -0.86 * s, sd * 0.56 * s, -1.14 * s);
          ctx.quadraticCurveTo(sd * 0.36 * s, -0.94 * s, sd * 0.4 * s, -0.66 * s);
          ctx.closePath();
          ctx.fillStyle = '#f3e6c4';
          ctx.fill();
          ctx.lineWidth = s * 0.025;
          ctx.strokeStyle = '#8a7a50';
          ctx.stroke();
        }
        ctx.fillStyle = k.trim;
        ctx.strokeStyle = k.dark;
        for (const [x, y, hh] of [[-0.14, -0.84, 0.16], [0, -0.88, 0.2], [0.14, -0.84, 0.16]]) {
          tri(ctx, (x - 0.06) * s, (y + 0.04) * s, x * s, (y - hh) * s, (x + 0.06) * s, (y + 0.04) * s);
          ctx.fill();
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-0.56 * s, -0.28 * s);
        ctx.bezierCurveTo(-0.58 * s, -1.08 * s, 0.58 * s, -1.08 * s, 0.56 * s, -0.28 * s);
        ctx.lineTo(0.42 * s, -0.28 * s);
        ctx.quadraticCurveTo(0, -0.48 * s, -0.42 * s, -0.28 * s);
        ctx.closePath();
        ctx.fillStyle = k.main;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = k.dark;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = s * 0.02;
        for (let r = 0; r < 6; r++) {
          for (let x = -0.56 + (r % 2) * 0.07; x < 0.6; x += 0.14) {
            ctx.beginPath();
            ctx.arc(x * s, (-0.94 + r * 0.11) * s, s * 0.07, 0.1, Math.PI - 0.1);
            ctx.stroke();
          }
        }
        ctx.restore();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = k.dark;
        ctx.stroke();
        break;
      }
      case 'flames':
        flameHair(ctx, s, now);
        break;
    }
  }
  const PATCHES = [
    [-0.4, -0.62, '#f2f2f2', 0.2], [-0.2, -0.78, '#e0873a', -0.3], [0.04, -0.66, '#9aa7b5', 0.1], [0.26, -0.8, '#d9443a', 0.4],
    [0.42, -0.6, '#e8d9b0', -0.2], [-0.06, -0.9, '#4fb3a9', 0.3], [0.18, -0.58, '#f2f2f2', -0.4], [-0.28, -0.52, '#c96b3a', 0.5],
    [-0.44, -0.8, '#6a8fb5', -0.1], [0.44, -0.84, '#f2f2f2', 0.2], [0.1, -1.0, '#e0873a', 0],
  ];
  // Affelito's trucker cap, seen from the front: mesh back, foam front panel with a badge, curved peak.
  // c = { front, mesh, brim, badge: 'patch' | 'star' | 'bolt' | 'modo' | 'gem' }
  function truckerCap(ctx, s, c, now) {
    const crown = (x0, x1, top) => {
      ctx.beginPath();
      ctx.moveTo(x0 * s, -0.5 * s);
      ctx.bezierCurveTo(x0 * s, top * s, x1 * s, top * s, x1 * s, -0.5 * s);
      ctx.closePath();
    };
    crown(-0.53, 0.53, -1.12);
    ctx.fillStyle = c.mesh;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    for (let x = -1.1; x < 0.6; x += 0.07) {
      ctx.moveTo(x * s, -0.5 * s);
      ctx.lineTo((x + 0.5) * s, -s);
      ctx.moveTo((x + 0.5) * s, -0.5 * s);
      ctx.lineTo(x * s, -s);
    }
    ctx.stroke();
    ctx.restore();
    crown(-0.53, 0.53, -1.12);
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    crown(-0.34, 0.34, -1.1);
    ctx.fillStyle = c.front;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.mesh;
    circle(ctx, 0, -0.95 * s, 0.045 * s);
    ctx.fill();
    // badge on the front panel
    const by = -0.7 * s;
    switch (c.badge) {
      case 'patch':
        ctx.fillStyle = '#2f8a4a';
        circle(ctx, 0, by, 0.12 * s);
        ctx.fill();
        ctx.lineWidth = s * 0.03;
        ctx.strokeStyle = '#f2f0e6';
        ctx.stroke();
        ctx.fillStyle = '#f2c230';
        star5(ctx, 0, by, 0.06 * s);
        ctx.fill();
        break;
      case 'star':
        ctx.fillStyle = '#ffffff';
        star5(ctx, 0, by, 0.12 * s);
        ctx.fill();
        break;
      case 'bolt':
        ctx.fillStyle = '#1ea2d8';
        ctx.beginPath();
        ctx.moveTo(0.04 * s, by - 0.14 * s);
        ctx.lineTo(-0.09 * s, by + 0.02 * s);
        ctx.lineTo(0, by + 0.02 * s);
        ctx.lineTo(-0.04 * s, by + 0.14 * s);
        ctx.lineTo(0.09 * s, by - 0.03 * s);
        ctx.lineTo(0, by - 0.03 * s);
        ctx.closePath();
        ctx.fill();
        break;
      case 'modo': {
        // red "MoDo" lettering with a dark outline, and a small black HOCKEY bar underneath
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = Math.round(0.23 * s) + 'px "Lilita One", "Arial Black", sans-serif';
        ctx.lineWidth = s * 0.035;
        ctx.strokeStyle = '#2a0a0a';
        ctx.strokeText('MoDo', 0, by - 0.03 * s);
        ctx.fillStyle = '#d3202c';
        ctx.fillText('MoDo', 0, by - 0.03 * s);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-0.2 * s, by + 0.08 * s, 0.4 * s, 0.07 * s);
        if (s >= 64) {
          ctx.font = Math.round(0.065 * s) + 'px "Arial Black", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('HOCKEY', 0, by + 0.117 * s);
        }
        break;
      }
      case 'gem': {
        ctx.beginPath();
        ctx.moveTo(-0.13 * s, by - 0.05 * s);
        ctx.lineTo(-0.07 * s, by - 0.12 * s);
        ctx.lineTo(0.07 * s, by - 0.12 * s);
        ctx.lineTo(0.13 * s, by - 0.05 * s);
        ctx.lineTo(0, by + 0.14 * s);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, by - 0.12 * s, 0, by + 0.14 * s);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(1, '#3aa8ff');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = s * 0.02;
        ctx.strokeStyle = '#1a4f7a';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-0.13 * s, by - 0.05 * s);
        ctx.lineTo(0.13 * s, by - 0.05 * s);
        ctx.moveTo(-0.04 * s, by - 0.05 * s);
        ctx.lineTo(0, by + 0.14 * s);
        ctx.lineTo(0.04 * s, by - 0.05 * s);
        ctx.stroke();
        break;
      }
    }
    // the peak
    ctx.beginPath();
    ctx.moveTo(-0.6 * s, -0.5 * s);
    ctx.quadraticCurveTo(0, -0.6 * s, 0.6 * s, -0.5 * s);
    ctx.quadraticCurveTo(0, -0.22 * s, -0.6 * s, -0.5 * s);
    ctx.closePath();
    ctx.fillStyle = c.brim;
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(-0.46 * s, -0.49 * s);
    ctx.quadraticCurveTo(0, -0.33 * s, 0.46 * s, -0.49 * s);
    ctx.stroke();
    if (c.badge === 'gem') {
      // bling: sparkles twinkling around the cap
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const tw = Math.max(0, Math.sin(now * 4 + i * 1.7));
        if (!tw) continue;
        const x = [-0.44, 0.3, 0.52, -0.2][i] * s, y = [-0.86, -1.0, -0.6, -0.5][i] * s, r = 0.07 * s * tw;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r * 0.25, y - r * 0.25);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x + r * 0.25, y + r * 0.25);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r * 0.25, y + r * 0.25);
        ctx.lineTo(x - r, y);
        ctx.lineTo(x - r * 0.25, y - r * 0.25);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  // flickering flames instead of hair (Fire skin)
  function flameHair(ctx, s, now) {
    for (const [c, hk, hw] of [['#e0321a', 1, 0.6], ['#ff8a1f', 0.74, 0.46], ['#ffd23a', 0.48, 0.3]]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      // an arched hairline with little flame licks hanging onto the forehead
      ctx.moveTo(-hw * s, -0.1 * s);
      const n = 5, step = (2 * hw) / n;
      for (let i = 0; i < n; i++) {
        const x0 = -hw + i * step, v = -0.5 - 0.06 * hk + 0.12 * Math.abs(x0 / hw);
        const tip = -0.52 - (0.26 + 0.2 * U.hash(i * 2.3 + hw) + 0.07 * Math.sin(now * 11 + i * 1.9)) * hk * (1 - 0.35 * Math.abs((x0 + step / 2) / hw));
        const lean = 0.04 * Math.sin(now * 7 + i);
        ctx.lineTo(x0 * s, v * s);
        ctx.quadraticCurveTo((x0 + step * 0.1) * s, (tip + 0.16) * s, (x0 + step / 2 + lean) * s, tip * s);
        ctx.quadraticCurveTo((x0 + step * 0.9) * s, (tip + 0.16) * s, (x0 + step) * s, v * s);
      }
      ctx.lineTo(hw * s, -0.1 * s);
      for (let i = 0; i <= 6; i++) {
        const x = hw * (1 - i / 3), lick = i % 2 ? 0.07 + 0.03 * Math.sin(now * 13 + i) : 0;
        ctx.lineTo(x * s, (-0.3 + 0.18 * Math.abs(x / hw) + lick * hk) * s);
      }
      ctx.closePath();
      if (hk === 1) {
        ctx.shadowColor = '#ff6a1f';
        ctx.shadowBlur = s * 0.25;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  // Affelito's hair: straight, light brown, swept over to one side, with locks over the ears
  const FRINGE = [[0.32, -0.28], [0.22, -0.22], [0.18, -0.29], [0.07, -0.21], [0.03, -0.29], [-0.1, -0.2], [-0.13, -0.29], [-0.27, -0.17], [-0.28, -0.27], [-0.4, -0.1]];
  function alfHair(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(-0.42 * s, -0.04 * s);
    ctx.lineTo(-0.55 * s, -0.16 * s);
    ctx.lineTo(-0.52 * s, -0.28 * s);
    ctx.lineTo(-0.58 * s, -0.36 * s);
    ctx.bezierCurveTo(-0.62 * s, -0.92 * s, 0.6 * s, -0.92 * s, 0.58 * s, -0.36 * s);
    ctx.lineTo(0.53 * s, -0.27 * s);
    ctx.lineTo(0.57 * s, -0.15 * s);
    ctx.lineTo(0.44 * s, -0.06 * s);
    ctx.lineTo(0.38 * s, -0.2 * s);
    for (const [x, y] of FRINGE) ctx.lineTo(x * s, y * s);
    ctx.closePath();
    ctx.fillStyle = '#8a5a2e';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = s * 0.035;
    ctx.strokeStyle = '#3b2412';
    ctx.stroke();
    // strands following the sweep
    ctx.lineCap = 'round';
    for (const [c, strands] of [
      ['#6a4222', [[0.34, -0.7, 0.06, -0.5, -0.2, -0.28], [0.5, -0.5, 0.3, -0.4, 0.12, -0.3]]],
      ['#b8864f', [[0.12, -0.74, -0.14, -0.6, -0.4, -0.3], [0.44, -0.62, 0.16, -0.48, -0.04, -0.3], [-0.2, -0.7, -0.4, -0.56, -0.5, -0.3]]],
    ]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      for (const [x0, y0, cx, cy, x1, y1] of strands) {
        ctx.moveTo(x0 * s, y0 * s);
        ctx.quadraticCurveTo(cx * s, cy * s, x1 * s, y1 * s);
      }
      ctx.stroke();
    }
  }
  function alfEars(ctx, s) {
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#f0c29e';
      ctx.beginPath();
      ctx.ellipse(sd * 0.37 * s, 0.03 * s, 0.075 * s, 0.1 * s, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = s * 0.025;
      ctx.strokeStyle = '#b87f58';
      ctx.stroke();
      const a0 = sd > 0 ? -1.2 : Math.PI - 1.2; // the fold faces outwards
      ctx.beginPath();
      ctx.arc(sd * 0.38 * s, 0.03 * s, 0.035 * s, a0, a0 + 2.4);
      ctx.stroke();
    }
  }
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
  // eye/iris/brow colours and brow arch come from the character (ch, an Art.CHARS entry)
  function eyes(ctx, s, expr, look, ch) {
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
      ctx.fillStyle = ch.iris;
      circle(ctx, ix, iy, 0.068 * s);
      ctx.fill();
      ctx.fillStyle = '#3d6f95';
      if (ch.irisRing) ctx.strokeStyle = ch.irisRing;
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
    ctx.strokeStyle = ch.brow;
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    const lift = expr === 'o' || expr === 'tongue' ? -0.04 : 0, arch = ch.arch;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 0.25 * s, (-0.19 + lift) * s);
      ctx.quadraticCurveTo(sx * 0.17 * s, (-0.19 - arch + lift) * s, sx * 0.08 * s, (-0.2 + lift) * s);
      ctx.stroke();
    }
  }
  // tilt = the character's grinTilt (radians); 0 draws the mouth straight
  function mouth(ctx, s, expr, tilt) {
    if (tilt && (expr === 'grin' || expr === 'happy')) {
      // e.g. Affelito's grin is a bit lopsided, like a smirk
      ctx.save();
      ctx.translate(0, 0.24 * s);
      ctx.rotate(tilt);
      ctx.translate(0, -0.24 * s);
      mouth(ctx, s, expr, 0);
      ctx.restore();
    } else if (expr === 'grin' || expr === 'happy') {
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
    const ch = Art.CHARS[k.char] || Art.CHARS.vippe;
    ctx.lineJoin = 'round';
    rr(ctx, -h, -h, s, s, s * 0.16);
    ctx.fillStyle = k.main;
    ctx.fill();
    ctx.save();
    ctx.clip();
    bodyPattern(ctx, s, k);
    ctx.restore();
    rr(ctx, -h, -h, s, s, s * 0.16);
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = k.dark;
    ctx.stroke();
    collar(ctx, s, k);
    // face (a layer can be drawn behind it first, e.g. Affelito's ears; the rect and
    // skin tone come from the character, so his taller forehead under the fringe is
    // just a taller `face` rather than a special case here)
    if (ch.behindFace) ch.behindFace(ctx, s);
    const f = ch.face;
    rr(ctx, f.x * s, f.y * s, f.w * s, f.h * s, f.r * s);
    ctx.fillStyle = ch.skin;
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#b87f58';
    ctx.stroke();
    ctx.fillStyle = 'rgba(236,120,110,0.28)';
    circle(ctx, -0.25 * s, 0.1 * s, 0.07 * s);
    ctx.fill();
    circle(ctx, 0.25 * s, 0.1 * s, 0.07 * s);
    ctx.fill();
    if (ch.fringe && !k.noHair) ch.fringe(ctx, s);
    eyes(ctx, s, expr, look, ch);
    // nose
    ctx.strokeStyle = '#c98c66';
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    ctx.moveTo(0.02 * s, 0.0);
    ctx.quadraticCurveTo(0.07 * s, 0.08 * s, 0.0, 0.09 * s);
    ctx.stroke();
    mouth(ctx, s, expr, ch.grinTilt);
    if (ch.topHair && !k.noHair) ch.topHair(ctx, s);
    if (k.hat) hat(ctx, s, k);
  };
  function collar(ctx, s, k) {
    ctx.strokeStyle = k.trim;
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (k.pattern === 'hoodie') {
      // hoodie drawstrings
      for (const sd of [-1, 1]) {
        ctx.moveTo(sd * 0.1 * s, 0.36 * s);
        ctx.lineTo(sd * 0.12 * s, 0.47 * s);
      }
      ctx.strokeStyle = '#f4f4f0';
      ctx.lineWidth = s * 0.03;
    } else if (k.pattern === 'fleece') {
      // zip up the middle
      ctx.moveTo(0, 0.36 * s);
      ctx.lineTo(0, 0.5 * s);
      ctx.strokeStyle = '#0b3a55';
      ctx.lineWidth = s * 0.03;
    } else {
      ctx.moveTo(-0.2 * s, 0.4 * s);
      ctx.lineTo(0, 0.47 * s);
      ctx.lineTo(0.2 * s, 0.4 * s);
    }
    ctx.stroke();
    if (k.pattern === 'modo') {
      ctx.strokeStyle = '#0a7a3b';
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.moveTo(-0.16 * s, 0.37 * s);
      ctx.lineTo(0, 0.43 * s);
      ctx.lineTo(0.16 * s, 0.37 * s);
      ctx.stroke();
    }
  }

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
    ctx.strokeStyle = k.frame || k.main;
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
  // glow = outline colour for the area (from the level theme) so hazards always read against the scenery
  Art.spike = function (ctx, x, y, w, h, down, style, glow, t, seed = 0) {
    ctx.lineJoin = 'round';
    if (style === 'hedgehog') return hedgehog(ctx, x, y, w, h, glow, t);
    if (style === 'cave') return caveSpike(ctx, x, y, w, h, down, glow);
    if (style === 'rat') return rat(ctx, x, y, w, h, glow, t, seed);
    if (style === 'slime') return slimeSpike(ctx, x, y, w, h, down, glow, t, seed);
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
    ctx.strokeStyle = glow || '#ffffff';
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

  Art.half = function (ctx, x, y, w, h, style, glow) {
    // small thorny spike (rendered as a little rock shard)
    ctx.fillStyle = '#151519';
    tri(ctx, x + w * 0.15, y + h, x + w / 2, y + h * 0.1, x + w * 0.85, y + h);
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  // igelkott: a spiky hedgehog is a spike (same hitbox), facing the player
  function hedgehog(ctx, x, y, w, h, glow, t) {
    const cx = x + w * 0.52, b = y + h;
    const breathe = 1 + Math.sin(t * 3) * 0.03; // (never seed this with the screen x: it changes every frame)
    const rx = w * 0.44, ry = h * 0.62 * breathe;
    // quills
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const r = i % 2 ? 1 : 1.32;
      const px = cx + Math.cos(a) * rx * r, py = b + Math.sin(a) * ry * r;
      if (i === 0) ctx.moveTo(px, b);
      ctx.lineTo(px, Math.min(b, py));
    }
    ctx.closePath();
    ctx.fillStyle = TL('#5a4230');
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(235,215,185,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 1; i < 12; i += 2) {
      const a = Math.PI + (i / 12) * Math.PI;
      ctx.moveTo(cx + Math.cos(a) * rx * 0.45, b + Math.sin(a) * ry * 0.45);
      ctx.lineTo(cx + Math.cos(a) * rx * 1.05, b + Math.sin(a) * ry * 1.05);
    }
    ctx.stroke();
    // little face poking out towards Vippe
    ctx.fillStyle = TL('#c89a6a');
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, b - h * 0.02);
    ctx.quadraticCurveTo(x + w * 0.2, b - h * 0.4, x + w * 0.02, b - h * 0.14);
    ctx.quadraticCurveTo(x + w * 0.08, b, x + w * 0.3, b - h * 0.02);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, x + w * 0.04, b - h * 0.13, 2.6);
    ctx.fill();
    circle(ctx, x + w * 0.17, b - h * 0.24, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    circle(ctx, x + w * 0.165, b - h * 0.25, 0.8);
    ctx.fill();
  }

  // stalagmites (up) and stalactites (down) in the bear cave
  function caveSpike(ctx, x, y, w, h, down, glow) {
    const g = ctx.createLinearGradient(0, down ? y : y + h, 0, down ? y + h : y);
    g.addColorStop(0, '#6a6070');
    g.addColorStop(1, '#2a2530');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (down) {
      ctx.moveTo(x + 1, y);
      ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.4, x + w * 0.5, y + h - 1);
      ctx.quadraticCurveTo(x + w * 0.7, y + h * 0.4, x + w - 1, y);
    } else {
      ctx.moveTo(x + 1, y + h);
      ctx.quadraticCurveTo(x + w * 0.3, y + h * 0.6, x + w * 0.5, y + 1);
      ctx.quadraticCurveTo(x + w * 0.7, y + h * 0.6, x + w - 1, y + h);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = glow || '#8ff3ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + w * 0.4, down ? y + 4 : y + h * 0.45, 3, h * 0.4);
  }

  // hovering birds are hazards; wings flap, the hitbox stays put. Gråkråka (hooded crow) in the forest,
  // pigeons in the subway and gulls down by the water share the same shape in different colours.
  const BIRDS = {
    crow: { far: '#0e0e13', dark: '#1b1b22', body: '#9a9fa6', beak: '#2a2a33' },
    pigeon: { far: '#5f6779', dark: '#7a8296', head: '#6a7286', body: '#a7aec0', beak: '#3a3a40', neck: '#4f9f8a' },
    gull: { far: '#8f9ba8', dark: '#aeb8c4', head: '#ffffff', body: '#ffffff', beak: '#f2c230', tips: '#1b1b22' },
  };
  Art.bird = function (ctx, cx, cy, s, t, seed, glow, style) {
    const C = BIRDS[style] || BIRDS.crow;
    const flap = Math.sin(t * 11 + seed * 1.7);
    cy += Math.sin(t * 3 + seed) * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const black = TL(C.dark), grey = TL(C.body), line = glow || '#fff';
    const wing = (k) => {
      // shoulder -> wing tip (up or down with the flap) -> back to the body
      const tipX = cx + s * (0.3 + k * 0.06), tipY = cy - s * (0.12 + 0.5 * flap);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.12, cy - s * 0.06);
      ctx.quadraticCurveTo(cx - s * 0.02, tipY - s * 0.02, tipX, tipY);
      ctx.lineTo(tipX + s * 0.06, tipY + s * 0.08);
      ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.02, cx + s * 0.16, cy + s * 0.04);
      ctx.closePath();
    };
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = line;
    // far wing
    wing(1);
    ctx.fillStyle = TL(C.far);
    ctx.fill();
    ctx.stroke();
    // tail
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.24, cy - s * 0.04);
    ctx.lineTo(cx + s * 0.56, cy - s * 0.12);
    ctx.lineTo(cx + s * 0.58, cy + s * 0.1);
    ctx.lineTo(cx + s * 0.24, cy + s * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // grey body
    ctx.fillStyle = grey;
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.02, cy + s * 0.03, s * 0.32, s * 0.2, -0.06, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // the head facing Vippe, with an angry brow
    if (C.neck) {
      ctx.fillStyle = TL(C.neck);
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.2, cy + s * 0.02, s * 0.12, s * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = TL(C.head || C.dark);
    circle(ctx, cx - s * 0.28, cy - s * 0.1, s * 0.17);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TL(C.beak);
    tri(ctx, cx - s * 0.4, cy - s * 0.15, cx - s * 0.66, cy - s * 0.06, cx - s * 0.4, cy - s * 0.02);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    circle(ctx, cx - s * 0.32, cy - s * 0.13, s * 0.055);
    ctx.fill();
    ctx.fillStyle = '#000';
    circle(ctx, cx - s * 0.335, cy - s * 0.125, s * 0.03);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy - s * 0.23);
    ctx.lineTo(cx - s * 0.25, cy - s * 0.18);
    ctx.stroke();
    // near wing
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = line;
    wing(0);
    ctx.fillStyle = black;
    ctx.fill();
    if (C.tips) {
      // gulls have black wing tips
      ctx.save();
      ctx.clip();
      ctx.fillStyle = TL(C.tips);
      circle(ctx, cx + s * 0.34, cy - s * (0.12 + 0.5 * flap), s * 0.14);
      ctx.fill();
      ctx.restore();
      wing(0);
    }
    ctx.stroke();
    if (C.neck) {
      // pigeons have two dark bars on the wing
      ctx.strokeStyle = TL('#3c4252');
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const k of [0.35, 0.6]) {
        ctx.moveTo(cx - s * 0.02 + k * s * 0.18, cy - s * 0.04 - k * s * (0.1 + 0.5 * flap));
        ctx.lineTo(cx + s * 0.1 + k * s * 0.18, cy - s * 0.02 - k * s * (0.1 + 0.5 * flap));
      }
      ctx.stroke();
    }
  };

  Art.water = function (ctx, x0, x1, ySurf, yBot, t, style) {
    if (style === 'bog') return bogWater(ctx, x0, x1, ySurf, yBot, t);
    if (style === 'sludge') return sludge(ctx, x0, x1, ySurf, yBot, t);
    const g = ctx.createLinearGradient(0, ySurf, 0, yBot);
    g.addColorStop(0, TL('#3f93d6'));
    g.addColorStop(1, TL('#0f355c'));
    ctx.fillStyle = g;
    // waves and glints are placed relative to x0 (the water's left edge on screen) so they scroll with the world
    const wave = (x) => ySurf + Math.sin((x - x0) * 0.05 + t * 3) * 3;
    ctx.beginPath();
    ctx.moveTo(x0, yBot);
    for (let x = x0; x <= x1 + 8; x += 8) ctx.lineTo(Math.min(x, x1), wave(x));
    ctx.lineTo(x1, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      if (x === x0) ctx.moveTo(x, wave(x));
      else ctx.lineTo(x, wave(x));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let x = x0 + 20, k = 0; x < x1 - 20; x += 70, k++) {
      const yy = ySurf + 18 + Math.sin(k * 21) * 10;
      const dx = Math.sin(t * 1.5 + k) * 6;
      ctx.beginPath();
      ctx.moveTo(x + dx, yy);
      ctx.lineTo(x + dx + 22, yy);
      ctx.stroke();
    }
  };

  // dark bog water with lily pads and the odd frog
  function bogWater(ctx, x0, x1, ySurf, yBot, t) {
    const g = ctx.createLinearGradient(0, ySurf, 0, yBot);
    g.addColorStop(0, TL('#4d6a52'));
    g.addColorStop(1, TL('#16241c'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, yBot);
    for (let x = x0; x <= x1 + 8; x += 8) ctx.lineTo(Math.min(x, x1), ySurf + Math.sin((x - x0) * 0.04 + t * 2) * 2);
    ctx.lineTo(x1, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,210,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      const yy = ySurf + Math.sin((x - x0) * 0.04 + t * 2) * 2;
      if (x === x0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    // lily pads are placed relative to x0 (the water's left edge on screen) so they scroll with the world
    const step = 150;
    const k0 = Math.max(0, Math.floor((-80 - x0) / step)), k1 = Math.min(Math.floor((x1 - x0) / step), Math.ceil((1360 - x0) / step));
    for (let k = k0; k <= k1; k++) {
      const px = x0 + k * step + ((k * 53) % 70), py = ySurf + 6 + ((k * 29) % 3) * 4;
      if (px < x0 + 14 || px > x1 - 14) continue;
      ctx.fillStyle = TL('#4f8f3a');
      ctx.beginPath();
      ctx.ellipse(px, py, 20, 6, 0, 0.35, TAU - 0.05);
      ctx.lineTo(px, py);
      ctx.fill();
      if (k % 5 === 2) {
        ctx.fillStyle = '#ffffff';
        circle(ctx, px + 6, py - 3, 5);
        ctx.fill();
        ctx.fillStyle = '#ffe070';
        circle(ctx, px + 6, py - 3, 2);
        ctx.fill();
      }
      if (k % 7 === 3) frog(ctx, px - 2, py - 1, t + k);
    }
  }
  function frog(ctx, x, y, t) {
    const puff = Math.max(0, Math.sin(t * 2.2)) * 3;
    ctx.fillStyle = TL('#5fae3a');
    ctx.beginPath();
    ctx.ellipse(x, y - 7, 11, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = TL('#f2e8a8');
    ctx.beginPath();
    ctx.ellipse(x - 7, y - 3, 4 + puff, 3 + puff * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = TL('#5fae3a');
    for (const ex of [-7, 1]) {
      circle(ctx, x + ex, y - 14, 4);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    for (const ex of [-7, 1]) {
      circle(ctx, x + ex - 1, y - 15, 1.8);
      ctx.fill();
    }
  }

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
  // a thick plume of chimney smoke: puffs rise, drift off with the wind, swell and fade away
  const SMOKE_PUFFS = 20;
  const smokePuffs = [];
  function chimneySmoke(ctx, cx, cy, t) {
    smokePuffs.length = 0;
    for (let i = 0; i < SMOKE_PUFFS; i++) smokePuffs.push({ i, u: (t * 0.22 + i / SMOKE_PUFFS) % 1 });
    smokePuffs.sort((a, b) => b.u - a.u); // oldest (highest) puffs first, so new ones billow in front
    const body = T('#cfcfd6'), light = T('#f4f4f6'), ga = ctx.globalAlpha;
    for (const { i, u } of smokePuffs) {
      const px = cx + u * u * 110 + Math.sin(t * 1.3 + i * 1.9) * 9 * u;
      const py = cy - 4 - u * 220 + u * u * 50;
      const r = 14 + u * 44;
      const a = Math.min(1, 0.4 + u * 12) * (1 - u) * 0.85;
      ctx.globalAlpha = ga * a;
      ctx.fillStyle = body;
      circle(ctx, px, py, r);
      ctx.fill();
      ctx.globalAlpha = ga * a * 0.8;
      ctx.fillStyle = light;
      circle(ctx, px - r * 0.25, py - r * 0.3, r * 0.6);
      ctx.fill();
    }
    ctx.globalAlpha = ga;
  }

  // floorball goal seen from the front: a red tube frame with the white net stretched back to the
  // (smaller, further away) rear frame on the floor. flip = hanging from the roof in the gravity-flip part.
  function floorballGoal(ctx, x, y, w, h, flip) {
    ctx.save();
    if (flip) {
      ctx.translate(0, 2 * y + h);
      ctx.scale(1, -1);
    }
    const ft = Math.max(6, w * 0.075); // tube thickness
    const fx0 = x + 1, fx1 = x + w - 1, fy0 = y + 1, fy1 = y + h; // outside of the front frame
    const ix0 = fx0 + ft, ix1 = fx1 - ft, iy0 = fy0 + ft; // the goal mouth
    const bx0 = x + w * 0.24, bx1 = x + w * 0.76, bt = y + h * 0.42, bb = y + h * 0.9; // rear frame
    const quad = (a, b, c, d, e, f, g, k, fill) => {
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(c, d);
      ctx.lineTo(e, f);
      ctx.lineTo(g, k);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    // shadow inside the goal, then the net: roof, sides, back and floor, each lit a little differently
    ctx.fillStyle = 'rgba(16,22,36,0.6)';
    ctx.fillRect(ix0, iy0, ix1 - ix0, fy1 - iy0);
    quad(ix0, iy0, ix1, iy0, bx1, bt, bx0, bt, 'rgba(236,241,247,0.55)');
    quad(ix0, iy0, bx0, bt, bx0, bb, ix0, fy1, 'rgba(236,241,247,0.36)');
    quad(ix1, iy0, bx1, bt, bx1, bb, ix1, fy1, 'rgba(236,241,247,0.3)');
    quad(bx0, bt, bx1, bt, bx1, bb, bx0, bb, 'rgba(236,241,247,0.22)');
    quad(ix0, fy1, bx0, bb, bx1, bb, ix1, fy1, 'rgba(236,241,247,0.14)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix0, iy0, ix1 - ix0, fy1 - iy0);
    ctx.clip();
    // diamond mesh
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const span = fy1 - iy0;
    for (let k = ix0 - span; k < ix1 + span; k += 9) {
      ctx.moveTo(k, iy0);
      ctx.lineTo(k + span, fy1);
      ctx.moveTo(k, iy0);
      ctx.lineTo(k - span, fy1);
    }
    ctx.stroke();
    // seams where the net panels meet
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ix0, iy0);
    ctx.lineTo(bx0, bt);
    ctx.lineTo(bx1, bt);
    ctx.lineTo(ix1, iy0);
    ctx.moveTo(bx0, bt);
    ctx.lineTo(bx0, bb);
    ctx.moveTo(bx1, bt);
    ctx.lineTo(bx1, bb);
    ctx.stroke();
    // the rear frame lies on the floor
    ctx.strokeStyle = '#a5211a';
    ctx.lineWidth = ft * 0.55;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ix0 - ft / 2, fy1 - ft * 0.3);
    ctx.lineTo(bx0, bb);
    ctx.lineTo(bx1, bb);
    ctx.lineTo(ix1 + ft / 2, fy1 - ft * 0.3);
    ctx.stroke();
    ctx.lineJoin = 'miter';
    // a floorball that went in
    if (!flip) {
      const br = Math.max(5, w * 0.065), bxc = x + w * 0.6, byc = fy1 - br - (fy1 - bb) * 0.35;
      ctx.fillStyle = '#f7f7f2';
      circle(ctx, bxc, byc, br);
      ctx.fill();
      ctx.fillStyle = 'rgba(40,50,70,0.3)';
      for (const [hx, hy] of [[-0.35, -0.3], [0.3, -0.35], [0, 0.05], [-0.45, 0.35], [0.4, 0.3]]) {
        circle(ctx, bxc + hx * br, byc + hy * br, br * 0.2);
        ctx.fill();
      }
    }
    ctx.restore();
    // front frame: two posts and the crossbar, round red tubes
    const tubeV = ctx.createLinearGradient(fx0, 0, fx0 + ft, 0);
    const tubeV2 = ctx.createLinearGradient(fx1 - ft, 0, fx1, 0);
    const tubeH = ctx.createLinearGradient(0, fy0, 0, fy0 + ft);
    for (const g of [tubeV, tubeV2, tubeH]) {
      g.addColorStop(0, '#8e160f');
      g.addColorStop(0.35, '#ff5a48');
      g.addColorStop(0.6, '#e02a1f');
      g.addColorStop(1, '#7a0f09');
    }
    ctx.fillStyle = tubeV;
    ctx.fillRect(fx0, fy0, ft, fy1 - fy0);
    ctx.fillStyle = tubeV2;
    ctx.fillRect(fx1 - ft, fy0, ft, fy1 - fy0);
    ctx.fillStyle = tubeH;
    rr(ctx, fx0, fy0, fx1 - fx0, ft, ft * 0.45);
    ctx.fill();
    ctx.strokeStyle = '#4a0906';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(fx0, fy1);
    ctx.lineTo(fx0, fy0 + ft * 0.45);
    ctx.arcTo(fx0, fy0, fx0 + ft, fy0, ft * 0.45);
    ctx.lineTo(fx1 - ft * 0.45, fy0);
    ctx.arcTo(fx1, fy0, fx1, fy0 + ft, ft * 0.45);
    ctx.lineTo(fx1, fy1);
    ctx.moveTo(ix0, fy1);
    ctx.lineTo(ix0, iy0);
    ctx.lineTo(ix1, iy0);
    ctx.lineTo(ix1, fy1);
    ctx.stroke();
    ctx.restore();
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
        for (let xx = x + 6, k = 0; xx < x + w - 4; xx += 9, k++) {
          ctx.moveTo(xx, y + 12);
          ctx.lineTo(xx + 3, y + 16 + ((k * 5) % 3));
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
          chimneySmoke(ctx, x + w / 2, y, t);
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
        // windows (at night some are lit and some are dark)
        let n = seed * 31;
        for (let wx = x + 22; wx < x + w - 30; wx += 56) {
          for (let wy = y + 36; wy < y + h - 50; wy += 56) {
            ctx.fillStyle = lit() && U.hash(n++) > 0.4 ? '#ffd782' : TL('#9fc2dc');
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
      case 'goalTop':
        floorballGoal(ctx, x, y, w, h, st === 'goalTop');
        break;
      // ---- forest (level 2) ----
      case 'rock': {
        rr(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(18, h * 0.4));
        const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
        g.addColorStop(0, TL('#b1afa4'));
        g.addColorStop(1, TL('#5f5d57'));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.save();
        ctx.clip();
        for (let i = 0; i < (w * h) / 90; i++) {
          ctx.fillStyle = i % 3 ? TL('#55534c') : TL('#d4d1c6');
          ctx.fillRect(x + rnd() * w, y + rnd() * h, 2, 2);
        }
        ctx.fillStyle = TL('#4e7f2c');
        for (let xx = x - 4; xx < x + w + 4; xx += 9) {
          circle(ctx, xx, y + 3 + rnd() * 3, 6 + rnd() * 3);
          ctx.fill();
        }
        ctx.fillStyle = TL('#7cb04a');
        for (let xx = x + 3; xx < x + w; xx += 13) {
          circle(ctx, xx, y + 2 + rnd() * 2, 3 + rnd() * 2);
          ctx.fill();
        }
        ctx.restore();
        rr(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(18, h * 0.4));
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#2b2a26');
        ctx.stroke();
        break;
      }
      case 'stump': {
        const top = Math.min(16, h * 0.32);
        rr(ctx, x + 2, y + top / 2, w - 4, h - top / 2, 5);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, TL('#7a5434'));
        g.addColorStop(1, TL('#3e2a18'));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#24170c');
        ctx.stroke();
        ctx.strokeStyle = 'rgba(20,12,4,0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let xx = x + 9; xx < x + w - 6; xx += 10) {
          ctx.moveTo(xx, y + top);
          ctx.lineTo(xx + (rnd() - 0.5) * 4, y + h - 4);
        }
        ctx.stroke();
        // flared roots
        ctx.fillStyle = TL('#4a321c');
        tri(ctx, x - 5, y + h, x + 4, y + h - 16, x + 10, y + h);
        ctx.fill();
        tri(ctx, x + w + 5, y + h, x + w - 4, y + h - 16, x + w - 10, y + h);
        ctx.fill();
        // cut face with year rings
        ctx.fillStyle = TL('#dcb47c');
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + top / 2, w / 2 - 2, top / 2, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = TL('#8a5e37');
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.ellipse(x + w / 2, y + top / 2, (w / 2 - 2) * (1 - k * 0.22), (top / 2) * (1 - k * 0.22), 0, 0, TAU);
          ctx.stroke();
        }
        break;
      }
      case 'timber': {
        // a stacked timber pile seen from the end
        ctx.fillStyle = TL('#35231a');
        rr(ctx, x + 1, y + 1, w - 2, h - 2, 6);
        ctx.fill();
        const d = bs / 2, rows = Math.max(1, Math.round(h / d)), cols = Math.max(1, Math.round(w / d));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = x + (c + 0.5) * (w / cols), cy = y + h - (r + 0.5) * (h / rows), rad = Math.min(w / cols, h / rows) / 2 - 1;
            ctx.fillStyle = TL(rnd() < 0.5 ? '#d2a066' : '#c38f55');
            circle(ctx, cx, cy, rad);
            ctx.fill();
            ctx.strokeStyle = TL('#6e4524');
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.lineWidth = 1;
            circle(ctx, cx, cy, rad * 0.5);
            ctx.stroke();
          }
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#1e130b');
        rr(ctx, x + 1, y + 1, w - 2, h - 2, 6);
        ctx.stroke();
        break;
      }
      case 'branch': {
        rr(ctx, x + 1, y + 1, w - 2, h - 2, Math.min(10, h / 2));
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, TL('#8a6040'));
        g.addColorStop(1, TL('#4a3020'));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#23160c');
        ctx.stroke();
        ctx.strokeStyle = 'rgba(30,18,8,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let xx = x + 12; xx < x + w - 20; xx += 22) {
          ctx.moveTo(xx, y + h * 0.5);
          ctx.lineTo(xx + 14, y + h * 0.5 + (rnd() - 0.5) * 4);
        }
        ctx.stroke();
        // needle tufts hanging underneath
        ctx.fillStyle = TL('#2c5a30');
        for (let xx = x + 8; xx < x + w - 4; xx += 16) {
          ctx.beginPath();
          ctx.moveTo(xx - 8, y + h - 2);
          ctx.lineTo(xx, y + h + 9 + rnd() * 5);
          ctx.lineTo(xx + 8, y + h - 2);
          ctx.fill();
        }
        break;
      }
      case 'fox':
        Art.fox(ctx, x, y, w, h, TL, t);
        break;
      case 'deadtree': {
        // torraka: a dead grey trunk standing in the bog, snapped off at the top
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, TL('#a7a197'));
        g.addColorStop(1, TL('#625d55'));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + h);
        ctx.lineTo(x + 2, y + 8);
        ctx.lineTo(x + w * 0.3, y);
        ctx.lineTo(x + w * 0.45, y + 10);
        ctx.lineTo(x + w * 0.7, y + 1);
        ctx.lineTo(x + w - 2, y + 12);
        ctx.lineTo(x + w - 2, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = TL('#2e2b27');
        ctx.stroke();
        ctx.strokeStyle = 'rgba(40,36,30,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let xx = x + 8; xx < x + w - 6; xx += 9) {
          ctx.moveTo(xx, y + 16);
          ctx.lineTo(xx + (rnd() - 0.5) * 5, y + h);
        }
        ctx.stroke();
        // bracket fungi
        for (let yy = y + 30; yy < y + h - 20; yy += 46) {
          ctx.fillStyle = TL('#c9a46a');
          ctx.beginPath();
          ctx.ellipse(x + w - 2, yy, 12, 6, 0, Math.PI * 0.5, Math.PI * 1.5, true);
          ctx.fill();
          ctx.strokeStyle = TL('#6b5230');
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
      }
      case 'boughs': {
        // a clump of dense spruce boughs hanging from the canopy: rows of drooping needle tufts
        const shape = () => {
          ctx.beginPath();
          ctx.moveTo(x + 2, y - 4);
          for (let yy = y + 10; yy < y + h - 12; yy += 12) ctx.lineTo(x + ((yy - y) % 24 ? 2 : 6), yy);
          ctx.lineTo(x + 2, y + h - 12);
          const n = Math.max(2, Math.round((w - 4) / 12));
          for (let i = 0; i < n; i++) {
            const x0 = x + 2 + (i * (w - 4)) / n, x1 = x + 2 + ((i + 1) * (w - 4)) / n;
            ctx.lineTo((x0 + x1) / 2, y + h);
            ctx.lineTo(x1, y + h - 12);
          }
          for (let yy = y + h - 24; yy > y; yy -= 12) ctx.lineTo(x + w - ((yy - y) % 24 ? 2 : 6), yy);
          ctx.lineTo(x + w - 2, y - 4);
          ctx.closePath();
        };
        shape();
        ctx.fillStyle = TL('#1a3a22');
        ctx.fill();
        ctx.save();
        ctx.clip();
        for (let yy = y, r = 0; yy < y + h; yy += 13, r++) {
          for (let xx = x + (r % 2 ? 0 : 7); xx < x + w + 8; xx += 14) {
            ctx.fillStyle = TL((r + Math.round(xx / 14)) % 3 ? '#23502e' : '#2f6a3a');
            ctx.beginPath();
            ctx.moveTo(xx - 9, yy);
            ctx.quadraticCurveTo(xx, yy + 4, xx + 9, yy);
            ctx.lineTo(xx + 1, yy + 17);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.restore();
        shape();
        ctx.strokeStyle = TL('#9fe09a');
        ctx.lineWidth = 2.5;
        ctx.stroke();
        break;
      }
      case 'cave': {
        bevel(ctx, x, y, w, h, '#5d5468', '#2b2733', '#a9f5ff', 7);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let i = 0; i < (w * h) / 200; i++) ctx.fillRect(x + 6 + rnd() * (w - 12), y + 6 + rnd() * (h - 12), 4, 3);
        // glowing crystals
        for (let xx = x + 10; xx < x + w - 10; xx += 26 + rnd() * 20) {
          const ch = 8 + rnd() * 8;
          ctx.fillStyle = rnd() < 0.5 ? '#7ff5e0' : '#c89bff';
          tri(ctx, xx - 4, y + 4, xx, y + 4 - ch, xx + 4, y + 4);
          ctx.fill();
        }
        break;
      }
      default: {
        if (METRO_BLOCKS[st]) return METRO_BLOCKS[st](ctx, x, y, w, h, bs, seed, t);
        bevel(ctx, x, y, w, h, '#30303a', '#16161c', '#ffffff', 4);
      }
    }
  };

  // räv: a fox standing in the path, facing Vippe (solid block; you can land on its back)
  Art.fox = function (ctx, x, y, w, h, C, t) {
    C = C || T;
    const fur = C('#e8731f'), dark = C('#2a1408'), white = C('#fff4e6');
    const wag = Math.sin((t || 0) * 5) * 0.06;
    // tail
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.78, y + h * 0.42);
    ctx.quadraticCurveTo(x + w * (1.02 + wag), y + h * 0.5, x + w * (0.98 + wag), y + h * 0.08);
    ctx.quadraticCurveTo(x + w * 0.9, y + h * 0.3, x + w * 0.74, y + h * 0.32);
    ctx.fill();
    ctx.fillStyle = white;
    circle(ctx, x + w * (0.98 + wag), y + h * 0.12, h * 0.08);
    ctx.fill();
    // legs
    ctx.fillStyle = dark;
    for (const lx of [0.3, 0.4, 0.66, 0.76]) rr(ctx, x + w * lx - 4, y + h * 0.5, 8, h * 0.5, 3), ctx.fill();
    // body
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.54, y + h * 0.42, w * 0.3, h * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.32, y + h * 0.5, w * 0.08, h * 0.12, 0, 0, TAU);
    ctx.fill();
    // head
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.34, y + h * 0.18);
    ctx.lineTo(x + w * 0.3, y + h * 0.0);
    ctx.lineTo(x + w * 0.24, y + h * 0.14);
    ctx.lineTo(x + w * 0.16, y + h * 0.0);
    ctx.lineTo(x + w * 0.14, y + h * 0.18);
    ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.24, x + w * 0.0, y + h * 0.32);
    ctx.quadraticCurveTo(x + w * 0.14, y + h * 0.42, x + w * 0.36, y + h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.02, y + h * 0.33);
    ctx.quadraticCurveTo(x + w * 0.16, y + h * 0.42, x + w * 0.3, y + h * 0.36);
    ctx.lineTo(x + w * 0.2, y + h * 0.29);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    circle(ctx, x + w * 0.01, y + h * 0.31, 3);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, x + w * 0.16, y + h * 0.21, 2.6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    circle(ctx, x + w * 0.155, y + h * 0.2, 1);
    ctx.fill();
    ctx.fillStyle = dark;
    tri(ctx, x + w * 0.28, y + h * 0.04, x + w * 0.3, y + h * 0.0, x + w * 0.31, y + h * 0.1);
    ctx.fill();
  };

  Art.moose = function (ctx, x, y, w, h, C, calf) {
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
    if (calf) return;
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
  // birches stand perfectly still (a swaying crown over a fixed trunk reads as shaking)
  function birchTree(ctx, x, base, h) {
    ctx.fillStyle = T('#f2f0ea');
    ctx.fillRect(x - 5, base - h, 10, h);
    ctx.fillStyle = T('#222');
    for (let yy = base - h + 12; yy < base - 6; yy += 17) ctx.fillRect(x - 5 + ((yy * 7) % 5), yy, 6, 3);
    ctx.fillStyle = T('#7fbf4c');
    for (const [dx, dy, r] of [[0, -h - 10, 34], [-26, -h + 18, 26], [26, -h + 16, 26], [-8, -h + 40, 22], [14, -h + 36, 22]]) {
      circle(ctx, x + dx, base + dy, r);
      ctx.fill();
    }
    ctx.fillStyle = T('#a4d86a');
    circle(ctx, x - 10, base - h - 18, 14);
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
  near.birch = (ctx, x, base) => birchTree(ctx, x, base, 150);
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
    for (let i = 0, wx = x + 40; wx < x + w * 0.6; wx += 90, i++) {
      ctx.fillStyle = lit() && i % 3 !== 1 ? '#ffe3a0' : T('#9fc2dc');
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
  // seed must stay the same for a given window (never use its screen position, or the lights blink as you run)
  function windowRect(ctx, x, y, w, h, seed) {
    const on = lit() && U.hash(seed) > 0.4;
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
    windowRect(ctx, x - 55, base - h + 18, 22, 26, d.X * 2);
    windowRect(ctx, x + 32, base - h + 18, 22, 26, d.X * 2 + 1);
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
    let cx = x - 300, n = (d.seed || 1) * 1000;
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
        for (let wx = cx + 10; wx < cx + w - 18; wx += 22) windowRect(ctx, wx, wy, 12, 18, n++);
      cx += w + 2;
    }
  };
  mid.castle = function (ctx, x, base, d) {
    // Uppsala castle: long pink building with round, copper-domed towers, standing on the flat top of its hill
    const hb = base - 70;
    ctx.fillStyle = T('#5f8f45');
    ctx.beginPath();
    ctx.moveTo(x - 480, base);
    ctx.bezierCurveTo(x - 420, base - 6, x - 400, hb, x - 336, hb);
    ctx.lineTo(x + 306, hb);
    ctx.bezierCurveTo(x + 370, hb, x + 390, base - 6, x + 460, base);
    ctx.closePath();
    ctx.fill();
    // sunlit edge of the hill
    ctx.strokeStyle = T('#86b862');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 452, base - 3);
    ctx.bezierCurveTo(x - 412, base - 12, x - 396, hb + 2, x - 336, hb + 2);
    ctx.stroke();
    ctx.fillStyle = T('#e8a397');
    ctx.fillRect(x - 250, hb - 120, 480, 124);
    ctx.fillStyle = T('#6b4a44');
    ctx.fillRect(x - 256, hb - 132, 492, 14);
    let n = d.X * 100;
    for (let wy = hb - 105; wy < hb - 20; wy += 34)
      for (let wx = x - 225; wx < x + 215; wx += 30) windowRect(ctx, wx, wy, 14, 20, n++);
    // towers
    for (const [tx, tw, th] of [[x - 260, 110, 180], [x + 250, 84, 160]]) {
      ctx.fillStyle = T('#e19b8f');
      ctx.fillRect(tx - tw / 2, hb - th, tw, th + 4);
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
      for (let wy = hb - th + 26; wy < hb - 20; wy += 36) windowRect(ctx, tx - 8, wy, 16, 22, n++);
    }
    // grass along the foot of the walls so the castle sits in its hill
    ctx.fillStyle = T('#6f9f52');
    ctx.fillRect(x - 336, hb + 1, 642, 5);
    ctx.fillStyle = T('#4f7a38');
    for (let gx = x - 330, k = 0; gx < x + 300; gx += 7, k++) ctx.fillRect(gx, hb - 2 - ((k * 13) & 3), 3, 5);
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
      ctx.fillRect(tx - 7, base - 145, 14, 145);
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
    [x - 50, x - 15, x + 20].forEach((wx, i) => windowRect(ctx, wx, base - 70, 18, 24, d.X * 3 + i));
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
    for (let i = 0; i < 10; i++) windowRect(ctx, x - 200 + i * 40, base - 100, 26, 30, d.X + i);
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
      windowRect(ctx, hx - w / 2 + 16, base - h + 18, 22, 24, d.X * 6 + i * 2);
      windowRect(ctx, hx + w / 2 - 38, base - h + 18, 22, 24, d.X * 6 + i * 2 + 1);
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
  mid.birches = function (ctx, x, base) {
    for (let i = 0; i < 4; i++) birchTree(ctx, x - 150 + i * 95, base, 110 + ((i * 29) % 40));
  };
  mid.moose = function (ctx, x, base) {
    Art.moose(ctx, x - 36, base - 56, 72, 56, T);
  };

  // =====================================================================
  // THE WILD FOREST (level 2) — trees, animals and the bear cave
  // =====================================================================
  function spruceTree(ctx, x, base, h, col, hi) {
    ctx.fillStyle = T('#3a2a1c');
    ctx.fillRect(x - 3, base - h * 0.12, 6, h * 0.12);
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers;
      const w = h * (0.27 - f * 0.19), yb = base - h * 0.08 - f * h * 0.8;
      ctx.fillStyle = T(i % 2 ? col || '#1f4a2c' : hi || '#275a34');
      ctx.beginPath();
      ctx.moveTo(x - w, yb);
      ctx.quadraticCurveTo(x - w * 0.3, yb - h * 0.07, x, yb - h * 0.24);
      ctx.quadraticCurveTo(x + w * 0.3, yb - h * 0.07, x + w, yb);
      ctx.lineTo(x + w * 0.4, yb - h * 0.03);
      ctx.lineTo(x, yb + h * 0.015);
      ctx.lineTo(x - w * 0.4, yb - h * 0.03);
      ctx.closePath();
      ctx.fill();
    }
  }
  Art.spruceTree = spruceTree;
  function deadSnag(ctx, x, base, h) {
    ctx.fillStyle = T('#8d877d');
    ctx.beginPath();
    ctx.moveTo(x - 7, base);
    ctx.lineTo(x - 4, base - h);
    ctx.lineTo(x + 1, base - h - 8);
    ctx.lineTo(x + 4, base - h + 4);
    ctx.lineTo(x + 7, base);
    ctx.fill();
    ctx.strokeStyle = T('#8d877d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const yy = base - h * (0.35 + i * 0.15), sd = i % 2 ? 1 : -1;
      ctx.moveTo(x, yy);
      ctx.lineTo(x + sd * h * 0.16, yy - h * 0.08);
    }
    ctx.stroke();
  }
  Art.deadSnag = deadSnag;

  // big spruce in the near layer: the trunk runs off the top of the screen so it feels like you're inside the forest
  near.spruce = function (ctx, x, base, d, t) {
    ctx.fillStyle = T('#3b2a1d');
    ctx.beginPath();
    ctx.moveTo(x - 13, base);
    ctx.lineTo(x - 5, -20);
    ctx.lineTo(x + 5, -20);
    ctx.lineTo(x + 13, base);
    ctx.fill();
    ctx.fillStyle = T('#2c1f14');
    tri(ctx, x - 24, base, x - 8, base - 26, x - 4, base);
    ctx.fill();
    tri(ctx, x + 22, base, x + 7, base - 22, x + 3, base);
    ctx.fill();
    ctx.strokeStyle = T('#5d4c3c');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const yy = base - 70 - i * 30, sd = i % 2 ? 1 : -1;
      ctx.moveTo(x, yy);
      ctx.lineTo(x + sd * (20 + i * 4), yy - 10);
    }
    ctx.stroke();
    const sway = Math.sin(t * 0.9 + d.x) * 2;
    for (let yy = base - 205, i = 0; yy > -30; yy -= 30, i++) {
      const w = Math.max(28, 78 - i * 5), sx = sway * (i / 8);
      ctx.fillStyle = T(i % 2 ? '#1c4127' : '#245233');
      ctx.beginPath();
      ctx.moveTo(x - w + sx, yy + 14);
      ctx.quadraticCurveTo(x - w * 0.45 + sx, yy - 4, x + sx, yy - 30);
      ctx.quadraticCurveTo(x + w * 0.45 + sx, yy - 4, x + w + sx, yy + 14);
      for (let k = 6; k >= 0; k--) ctx.lineTo(x + sx - w + (k / 6) * 2 * w, yy + 14 - (k % 2) * 7);
      ctx.closePath();
      ctx.fill();
    }
  };
  // tall Swedish pine: grey bark low down, glowing orange bark higher up, crown above the screen
  near.pinetree = function (ctx, x, base, d, t) {
    const g = ctx.createLinearGradient(0, base, 0, 0);
    g.addColorStop(0, T('#4a3a2c'));
    g.addColorStop(0.4, T('#7a5236'));
    g.addColorStop(0.65, T('#c2723a'));
    g.addColorStop(1, T('#dc8e48'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 11, base);
    ctx.lineTo(x - 6, -10);
    ctx.lineTo(x + 6, -10);
    ctx.lineTo(x + 11, base);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,20,12,0.35)';
    for (let yy = base - 12; yy > base - 190; yy -= 15) ctx.fillRect(x - 8 + ((yy * 7) & 7), yy, 8, 2);
    ctx.strokeStyle = T('#8a5a34');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 70);
    ctx.lineTo(x + 44, 40);
    ctx.moveTo(x, 104);
    ctx.lineTo(x - 40, 78);
    ctx.stroke();
    const sway = Math.sin(t * 0.8 + d.x) * 3;
    for (const [dx, yy, rx, ry] of [[48, 34, 46, 18], [-42, 72, 44, 17], [4, 8, 60, 22], [30, 96, 30, 12]]) {
      ctx.fillStyle = T('#2b5a32');
      ctx.beginPath();
      ctx.ellipse(x + dx + sway, yy, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = T('#3d7440');
      ctx.beginPath();
      ctx.ellipse(x + dx + sway - rx * 0.2, yy - ry * 0.3, rx * 0.6, ry * 0.55, 0, 0, TAU);
      ctx.fill();
    }
  };
  near.fern = function (ctx, x, base, d, t) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = (i - 3) * 0.42, len = 46 + ((i * 13) % 14);
      const sway = Math.sin(t * 1.6 + i + d.x) * 2;
      const p0 = [x, base], p1 = [x + Math.sin(a) * len * 0.6, base - len * 0.95], p2 = [x + Math.sin(a) * len * 1.2 + sway, base - len * 0.45];
      const at = (u) => [
        (1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
        (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1],
      ];
      ctx.strokeStyle = T(i % 2 ? '#4f8a2e' : '#5f9e38');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 2; k < 10; k++) {
        const u = k / 10, [px, py] = at(u), [qx, qy] = at(u + 0.02);
        const nx = -(qy - py), ny = qx - px, nl = Math.hypot(nx, ny) || 1, l = 9 * (1 - u * 0.7);
        ctx.moveTo(px - (nx / nl) * l, py - (ny / nl) * l);
        ctx.lineTo(px + (nx / nl) * l, py + (ny / nl) * l);
      }
      ctx.stroke();
    }
  };
  near.shrooms = function (ctx, x, base) {
    // flugsvamp (fly agaric) + a couple of brown ones
    for (const [dx, h, r, red] of [[0, 30, 16, 1], [24, 20, 11, 1], [-18, 14, 9, 0], [40, 10, 7, 0]]) {
      ctx.fillStyle = T('#f4efe2');
      rr(ctx, x + dx - r * 0.28, base - h, r * 0.56, h, 3);
      ctx.fill();
      ctx.fillStyle = T(red ? '#d3261e' : '#8a5a34');
      ctx.beginPath();
      ctx.ellipse(x + dx, base - h, r, r * 0.72, 0, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
      if (red) {
        ctx.fillStyle = T('#ffffff');
        for (const [ox, oy] of [[-0.5, -0.3], [0, -0.55], [0.45, -0.28], [-0.15, -0.15], [0.2, -0.05]]) {
          circle(ctx, x + dx + ox * r, base - h + oy * r, r * 0.11);
          ctx.fill();
        }
      }
    }
  };
  near.berries = function (ctx, x, base) {
    // blåbärsris
    ctx.fillStyle = T('#3f6f2c');
    for (const [dx, dy, r] of [[-22, -12, 14], [0, -18, 17], [22, -12, 14], [10, -6, 12], [-10, -6, 12]]) {
      circle(ctx, x + dx, base + dy, r);
      ctx.fill();
    }
    ctx.fillStyle = T('#2f3f8a');
    for (let i = 0; i < 9; i++) {
      circle(ctx, x - 24 + ((i * 17) % 48), base - 8 - ((i * 11) % 22), 3);
      ctx.fill();
    }
  };
  near.boulder = function (ctx, x, base, d) {
    const w = d.w || 130, h = d.h || 84;
    ctx.save();
    ctx.translate(x - w / 2, base - h);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(-6, h * 0.4, w * 0.1, 0, w * 0.45, 0);
    ctx.bezierCurveTo(w * 0.85, 0, w + 4, h * 0.35, w, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, T('#a9a79c'));
    g.addColorStop(1, T('#5b5a53'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = T('#4e7f2c');
    for (let i = 0; i < 9; i++) {
      circle(ctx, w * 0.15 + i * w * 0.09, h * 0.08 + Math.abs(i - 4) * 4, 12);
      ctx.fill();
    }
    ctx.fillStyle = U.rgba('#c7c878', 0.6);
    for (const [lx, ly] of [[0.3, 0.55], [0.7, 0.45], [0.55, 0.75]]) {
      circle(ctx, w * lx, h * ly, 6);
      ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = T('#34322d');
    ctx.stroke();
    ctx.restore();
  };
  near.anthill = function (ctx, x, base, d, t) {
    // myrstack with busy ants
    ctx.fillStyle = T('#7a5a3a');
    ctx.beginPath();
    ctx.moveTo(x - 60, base);
    ctx.quadraticCurveTo(x - 40, base - 70, x, base - 72);
    ctx.quadraticCurveTo(x + 40, base - 70, x + 60, base);
    ctx.fill();
    ctx.fillStyle = T('#9a7550');
    for (let i = 0; i < 40; i++) ctx.fillRect(x - 45 + ((i * 37) % 90), base - 8 - ((i * 23) % 56) * (1 - Math.abs(((i * 37) % 90) - 45) / 70), 3, 1.5);
    ctx.fillStyle = '#111';
    for (let i = 0; i < 10; i++) {
      const u = (t * (0.08 + (i % 3) * 0.03) + i * 0.13) % 1;
      const ax = x - 55 + u * 110, ay = base - Math.sin(u * Math.PI) * 66 * (0.6 + ((i * 7) % 4) * 0.1);
      ctx.fillRect(ax, ay, 3, 2);
    }
  };
  near.trailsign = function (ctx, x, base, d, t, bs, font) {
    ctx.fillStyle = T('#6b4a2e');
    ctx.fillRect(x - 4, base - 110, 8, 110);
    ctx.fillStyle = T('#f07a1a');
    ctx.fillRect(x - 4, base - 110, 8, 14);
    if (!d.text) return;
    ctx.font = '20px ' + font;
    const tw = ctx.measureText(d.text).width + 26;
    ctx.fillStyle = T('#8a6040');
    ctx.beginPath();
    ctx.moveTo(x - tw / 2, base - 92);
    ctx.lineTo(x + tw / 2, base - 92);
    ctx.lineTo(x + tw / 2 + 14, base - 76);
    ctx.lineTo(x + tw / 2, base - 60);
    ctx.lineTo(x - tw / 2, base - 60);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#3a2616');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = T('#fff3d6');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.text, x + 4, base - 75);
  };

  // ---------- animals ----------
  // ekorre: red squirrel sitting up with a pine cone, bushy tail twitching. (x, y) = feet
  Art.squirrel = function (ctx, x, y, s, t, seed) {
    const tw = Math.sin(t * 7 + seed) * 0.12 * (Math.sin(t * 0.9 + seed) > 0 ? 1 : 0.2);
    const nib = Math.max(0, Math.sin(t * 10 + seed)) * 1.5 * s;
    const fur = T('#b8532a'), dk = T('#6e2c12'), cream = T('#f3dcb8');
    ctx.save();
    ctx.translate(x + 8 * s, y - 10 * s);
    ctx.rotate(tw);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(-2 * s, 6 * s);
    ctx.bezierCurveTo(16 * s, 10 * s, 18 * s, -14 * s, 8 * s, -24 * s);
    ctx.bezierCurveTo(2 * s, -32 * s, -8 * s, -26 * s, -4 * s, -20 * s);
    ctx.bezierCurveTo(4 * s, -18 * s, 8 * s, -8 * s, -2 * s, 0);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x, y - 11 * s, 8 * s, 11 * s, 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.ellipse(x - 3 * s, y - 10 * s, 4 * s, 8 * s, 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x + 2 * s, y - 1.5 * s, 7 * s, 2.5 * s, 0, 0, TAU);
    ctx.fill();
    // head
    const hy = y - 24 * s + nib * 0.3;
    circle(ctx, x - 3 * s, hy, 6.5 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 8 * s, hy + 1.5 * s, 4 * s, 3 * s, 0, 0, TAU);
    ctx.fill();
    for (const ex of [-4, 1]) {
      tri(ctx, x + (ex - 2) * s, hy - 4 * s, x + ex * s, hy - 13 * s, x + (ex + 2.5) * s, hy - 4 * s);
      ctx.fill();
    }
    ctx.fillStyle = dk;
    for (const ex of [-4, 1]) {
      circle(ctx, x + ex * s, hy - 12.5 * s, 1.4 * s);
      ctx.fill();
    }
    ctx.fillStyle = '#111';
    circle(ctx, x - 5.5 * s, hy - 1 * s, 1.5 * s);
    ctx.fill();
    circle(ctx, x - 11.6 * s, hy + 1.2 * s, 1.1 * s);
    ctx.fill();
    // pine cone in the paws
    ctx.fillStyle = T('#7a4a24');
    ctx.beginPath();
    ctx.ellipse(x - 9 * s, y - 15 * s + nib, 2.8 * s, 4.2 * s, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = fur;
    circle(ctx, x - 7 * s, y - 14 * s + nib, 2 * s);
    ctx.fill();
  };
  near.squirrel = function (ctx, x, base, d, t) {
    let y = base;
    if (d.stump) {
      const sw = 44, sh = 32;
      ctx.fillStyle = T('#5a3c22');
      rr(ctx, x - sw / 2, base - sh, sw, sh, 4);
      ctx.fill();
      ctx.fillStyle = T('#d8b07a');
      ctx.beginPath();
      ctx.ellipse(x, base - sh, sw / 2, 6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = T('#8a5e37');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, base - sh, sw / 4, 3, 0, 0, TAU);
      ctx.stroke();
      y = base - sh;
    }
    Art.squirrel(ctx, x, y, d.s || 1.1, t, d.x);
  };
  // a squirrel scampering up and down a pine trunk
  near.squirreltree = function (ctx, x, base, d, t) {
    near.pinetree(ctx, x, base, d, t);
    const ph = (t * 0.35 + d.x * 0.1) % 2, u = ph < 1 ? U.smooth(ph) : 1 - U.smooth(ph - 1);
    const y = base - 60 - u * 170;
    // belly against the bark: head up on the way up, flipped head-first on the way down
    ctx.save();
    ctx.translate(x + 16, y);
    if (ph >= 1) ctx.scale(1, -1);
    Art.squirrel(ctx, 0, 14, 0.9, t * 2, d.x);
    ctx.restore();
  };
  // räv sitting at the side of the path, watching Vippe go by
  near.foxsit = function (ctx, x, base, d, t) {
    const fur = T('#e0701c'), dark = T('#2a1408'), white = T('#fff4e6');
    const sw = Math.sin(t * 2 + d.x) * 4;
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(x + 8, base - 6);
    ctx.quadraticCurveTo(x + 44 + sw, base - 4, x + 40 + sw, base - 24);
    ctx.quadraticCurveTo(x + 30, base - 12, x + 6, base - 14);
    ctx.fill();
    ctx.fillStyle = white;
    circle(ctx, x + 41 + sw, base - 22, 5);
    ctx.fill();
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x + 4, base - 22, 14, 22, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.ellipse(x - 4, base - 26, 6, 14, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x - 8, base - 10, 5, 10);
    ctx.fillRect(x + 1, base - 10, 5, 10);
    // head
    const hy = base - 50, tilt = Math.sin(t * 0.7 + d.x) * 0.08;
    ctx.save();
    ctx.translate(x - 2, hy);
    ctx.rotate(tilt);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(8, -6);
    ctx.lineTo(10, -22);
    ctx.lineTo(2, -10);
    ctx.lineTo(-6, -22);
    ctx.lineTo(-8, -6);
    ctx.quadraticCurveTo(-16, -2, -24, 4);
    ctx.quadraticCurveTo(-10, 12, 10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.moveTo(-22, 5);
    ctx.quadraticCurveTo(-8, 13, 8, 7);
    ctx.lineTo(-4, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    circle(ctx, -24, 3.5, 3);
    ctx.fill();
    tri(ctx, 7, -12, 10, -22, 9, -10);
    ctx.fill();
    tri(ctx, -5, -12, -6, -22, -2, -11);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, -8, -4, 2.3);
    ctx.fill();
    ctx.restore();
  };
  // hare that sits, twitches its nose and hops now and then
  near.hare = function (ctx, x, base, d, t) {
    const ph = (t * 0.45 + d.x * 0.37) % 1;
    const hop = ph > 0.8 ? Math.sin(((ph - 0.8) / 0.2) * Math.PI) * 16 : 0;
    const y = base - hop;
    const fur = T('#8a7a64'), dk = T('#4e4436'), light = T('#e6dccb');
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 14, 18, 13, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 16, y - 4, 12, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = light;
    circle(ctx, x + 26, y - 18, 5);
    ctx.fill();
    ctx.fillStyle = fur;
    circle(ctx, x - 8, y - 26, 9);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 14, y - 22, 6, 5, 0, 0, TAU);
    ctx.fill();
    const ear = Math.sin(t * 3 + d.x) * 0.08;
    for (const [ex, a] of [[-6, -0.25 + ear], [-1, 0.1 - ear]]) {
      ctx.save();
      ctx.translate(x + ex, y - 32);
      ctx.rotate(a);
      ctx.fillStyle = fur;
      ctx.beginPath();
      ctx.ellipse(0, -12, 3.6, 13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dk;
      ctx.beginPath();
      ctx.ellipse(0, -22, 2.4, 3.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#111';
    circle(ctx, x - 10, y - 28, 1.8);
    ctx.fill();
    circle(ctx, x - 19, y - 22, 1.4);
    ctx.fill();
  };
  // berguv on a dead snag; blinks every few seconds
  near.owl = function (ctx, x, base, d, t, bs) {
    ctx.fillStyle = T('#8d877d');
    ctx.beginPath();
    ctx.moveTo(x - 12, base);
    ctx.lineTo(x - 8, base - 250);
    ctx.lineTo(x - 2, base - 262);
    ctx.lineTo(x + 3, base - 246);
    ctx.lineTo(x + 8, base - 256);
    ctx.lineTo(x + 12, base);
    ctx.fill();
    ctx.fillStyle = T('#2a2622');
    ctx.beginPath();
    ctx.ellipse(x, base - 120, 5, 9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = T('#8d877d');
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, base - 170);
    ctx.lineTo(x + 40, base - 186);
    ctx.stroke();
    const ox = x + 30, oy = base - 190;
    const body = T('#8a6a48'), dk = T('#4e3a26');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(ox, oy - 20, 16, 22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = T('#c9a878');
    ctx.beginPath();
    ctx.ellipse(ox, oy - 14, 9, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = dk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(ox - 4, oy - 22 + i * 6);
      ctx.lineTo(ox - 1, oy - 20 + i * 6);
      ctx.moveTo(ox + 4, oy - 22 + i * 6);
      ctx.lineTo(ox + 1, oy - 20 + i * 6);
    }
    ctx.stroke();
    ctx.fillStyle = body;
    circle(ctx, ox, oy - 44, 14);
    ctx.fill();
    tri(ctx, ox - 13, oy - 50, ox - 12, oy - 64, ox - 5, oy - 54);
    ctx.fill();
    tri(ctx, ox + 13, oy - 50, ox + 12, oy - 64, ox + 5, oy - 54);
    ctx.fill();
    const blink = (t + d.x) % 4 < 0.15;
    for (const ex of [-6, 6]) {
      ctx.fillStyle = '#f29a1c';
      circle(ctx, ox + ex, oy - 45, 5.5);
      ctx.fill();
      if (blink) {
        ctx.fillStyle = body;
        circle(ctx, ox + ex, oy - 45, 5.8);
        ctx.fill();
        ctx.strokeStyle = dk;
        ctx.beginPath();
        ctx.moveTo(ox + ex - 5, oy - 45);
        ctx.lineTo(ox + ex + 5, oy - 45);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#111';
        circle(ctx, ox + ex - 0.5, oy - 45, 2.6);
        ctx.fill();
      }
    }
    ctx.fillStyle = T('#3a2a18');
    tri(ctx, ox - 2.5, oy - 40, ox, oy - 34, ox + 2.5, oy - 40);
    ctx.fill();
    ctx.fillStyle = T('#e2b400');
    ctx.fillRect(ox - 7, oy + 1, 5, 3);
    ctx.fillRect(ox + 2, oy + 1, 5, 3);
  };
  // större hackspett drumming on a pine
  near.woodpecker = function (ctx, x, base, d, t) {
    near.pinetree(ctx, x, base, d, t);
    const peck = Math.max(0, Math.sin(t * 22)) * ((t % 2.4) < 1 ? 1 : 0);
    const wx = x - 12, wy = base - 200;
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(wx - 4, wy, 7, 14, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.ellipse(wx - 6, wy - 2, 3, 7, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.ellipse(wx - 1, wy + 13, 4, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    tri(ctx, wx, wy + 10, wx + 6, wy + 26, wx + 4, wy + 10);
    ctx.fill();
    const hx = wx - 7 - peck * 4, hy = wy - 16;
    ctx.fillStyle = '#f2f2f2';
    circle(ctx, hx, hy, 6);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(hx - 2, hy - 7, 5, 6);
    ctx.fillStyle = '#d62828';
    ctx.fillRect(hx + 1, hy - 5, 4, 4);
    ctx.fillStyle = '#555';
    tri(ctx, hx - 5, hy - 2, hx - 14, hy, hx - 5, hy + 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, hx - 1, hy - 1, 1.3);
    ctx.fill();
    if (peck > 0.8) {
      ctx.fillStyle = T('#d88a45');
      ctx.fillRect(hx - 16 - Math.random() * 6, hy + Math.random() * 8, 3, 2);
    }
  };
  near.moose = function (ctx, x, base, d, t) {
    const w = d.calf ? 90 : 170, h = d.calf ? 84 : 158;
    ctx.save();
    const nod = Math.sin(t * 0.8 + d.x) * 0.02;
    ctx.translate(x, base);
    ctx.rotate(nod);
    Art.moose(ctx, -w / 2, -h, w, h, T, d.calf);
    ctx.restore();
  };
  // rådjur
  near.deer = function (ctx, x, base, d, t) {
    const fur = T('#a0643a'), dk = T('#3a2414');
    const graze = d.graze ? 1 : 0;
    ctx.fillStyle = dk;
    for (const lx of [-20, -13, 14, 21]) ctx.fillRect(x + lx - 2, base - 40, 4, 40);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x, base - 46, 28, 13, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = T('#f4efe2');
    circle(ctx, x + 26, base - 48, 7);
    ctx.fill();
    ctx.fillStyle = fur;
    ctx.save();
    ctx.translate(x - 20, base - 52);
    ctx.rotate(graze ? 1.1 + Math.sin(t * 2 + d.x) * 0.08 : -0.35 + Math.sin(t * 0.8 + d.x) * 0.05);
    ctx.fillRect(-5, -30, 10, 32);
    ctx.beginPath();
    ctx.ellipse(-6, -32, 11, 7, -0.2, 0, TAU);
    ctx.fill();
    tri(ctx, -2, -37, 2, -48, 6, -36);
    ctx.fill();
    ctx.strokeStyle = T('#d9c39a');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -38);
    ctx.lineTo(-6, -52);
    ctx.moveTo(-5, -46);
    ctx.lineTo(-10, -50);
    ctx.stroke();
    ctx.fillStyle = '#111';
    circle(ctx, -15, -31, 2);
    ctx.fill();
    circle(ctx, -8, -34, 1.8);
    ctx.fill();
    ctx.restore();
  };
  // trana standing in the bog
  near.crane = function (ctx, x, base, d, t) {
    const grey = T('#9aa0a6'), dk = T('#2a2d30');
    ctx.strokeStyle = dk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 4, base - 60);
    ctx.lineTo(x - 6, base);
    ctx.moveTo(x + 4, base - 60);
    ctx.lineTo(x + 7, base);
    ctx.stroke();
    ctx.fillStyle = grey;
    ctx.beginPath();
    ctx.ellipse(x + 2, base - 70, 22, 13, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = T('#6a6e73');
    ctx.beginPath();
    ctx.moveTo(x + 14, base - 78);
    ctx.quadraticCurveTo(x + 36, base - 72, x + 30, base - 56);
    ctx.quadraticCurveTo(x + 22, base - 62, x + 12, base - 62);
    ctx.fill();
    const bob = Math.sin(t * 1.3 + d.x) * 3;
    ctx.strokeStyle = grey;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, base - 74);
    ctx.quadraticCurveTo(x - 22, base - 96, x - 18 + bob, base - 116);
    ctx.stroke();
    ctx.strokeStyle = dk;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 20, base - 96);
    ctx.quadraticCurveTo(x - 20, base - 108, x - 18 + bob, base - 116);
    ctx.stroke();
    ctx.fillStyle = dk;
    circle(ctx, x - 18 + bob, base - 118, 5.5);
    ctx.fill();
    ctx.fillStyle = '#d62828';
    circle(ctx, x - 17 + bob, base - 122, 2.6);
    ctx.fill();
    ctx.fillStyle = T('#f2f2f2');
    ctx.fillRect(x - 17 + bob, base - 118, 5, 6);
    ctx.fillStyle = T('#4a4a44');
    tri(ctx, x - 22 + bob, base - 120, x - 38 + bob, base - 116, x - 22 + bob, base - 115);
    ctx.fill();
  };
  near.reeds = function (ctx, x, base, d, t) {
    // tuvull: cotton grass tufts
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const lx = x - 26 + i * 6.5, h = 30 + ((i * 17) % 22), sway = Math.sin(t * 1.8 + i + d.x) * 3;
      ctx.strokeStyle = T(i % 3 ? '#7c8a3a' : '#9aa24a');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, base);
      ctx.quadraticCurveTo(lx, base - h * 0.6, lx + sway, base - h);
      ctx.stroke();
      if (i % 2) {
        ctx.fillStyle = T('#f6f4ec');
        circle(ctx, lx + sway, base - h - 4, 5);
        ctx.fill();
      }
    }
  };
  near.camp = function (ctx, x, base, d, t) {
    // tent + campfire in the glade
    ctx.fillStyle = T('#e07a1f');
    tri(ctx, x - 90, base, x - 40, base - 90, x + 10, base);
    ctx.fill();
    ctx.fillStyle = T('#a8520f');
    tri(ctx, x - 58, base, x - 40, base - 60, x - 22, base);
    ctx.fill();
    ctx.strokeStyle = T('#5a3a1c');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 40, base - 90);
    ctx.lineTo(x - 40, base - 100);
    ctx.stroke();
    const fx = x + 60;
    ctx.fillStyle = T('#7a6a5a');
    for (let i = 0; i < 6; i++) {
      circle(ctx, fx - 22 + i * 9, base - 4, 6);
      ctx.fill();
    }
    ctx.strokeStyle = T('#5a3a1c');
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(fx - 16, base - 4);
    ctx.lineTo(fx + 16, base - 14);
    ctx.moveTo(fx + 16, base - 4);
    ctx.lineTo(fx - 16, base - 14);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const fl = 0.8 + 0.2 * Math.sin(t * 12 + i * 2);
      ctx.fillStyle = ['#ff5a1f', '#ffb02e', '#fff3b0'][i];
      const hh = (40 - i * 11) * fl, ww = 14 - i * 4;
      ctx.beginPath();
      ctx.moveTo(fx - ww, base - 10);
      ctx.quadraticCurveTo(fx - ww, base - 10 - hh * 0.6, fx + Math.sin(t * 7) * 3, base - 10 - hh);
      ctx.quadraticCurveTo(fx + ww, base - 10 - hh * 0.6, fx + ww, base - 10);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(fx, base - 20, 4, fx, base - 20, 90);
    g.addColorStop(0, 'rgba(255,190,90,0.35)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    circle(ctx, fx, base - 20, 90);
    ctx.fill();
  };
  // a rocky hill with the bear cave's mouth in it (d.mouth = blocks from the left edge; default: right-hand end)
  near.cavehill = function (ctx, x, base, d, t, bs) {
    const w = (d.w || 16) * bs, h = d.h || 400;
    const mx = x + (d.mouth == null ? w / bs - 5.2 : d.mouth) * bs, mw = 5 * bs, mh = 250;
    ctx.fillStyle = T('#6b6572');
    ctx.beginPath();
    ctx.moveTo(x - 40, base);
    ctx.bezierCurveTo(x - 10, base - h * 0.5, x + w * 0.15, base - h, x + w * 0.4, base - h);
    ctx.bezierCurveTo(x + w * 0.7, base - h, x + w + 10, base - h * 0.85, x + w + 30, base - h * 0.55);
    ctx.lineTo(x + w + 30, base);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = T('#57515e');
    ctx.lineWidth = 6;
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 40, base - i * 58);
      ctx.bezierCurveTo(x + w * 0.3, base - i * 58 - 20, x + w * 0.6, base - i * 58 + 18, x + w + 40, base - i * 58 - 6);
      ctx.stroke();
    }
    ctx.fillStyle = T('#4e7f2c');
    ctx.beginPath();
    ctx.moveTo(x - 40, base - h * 0.5);
    ctx.bezierCurveTo(x + w * 0.15, base - h - 10, x + w * 0.7, base - h - 16, x + w + 40, base - h * 0.55);
    ctx.lineTo(x + w + 40, base - h * 0.55 + 22);
    ctx.bezierCurveTo(x + w * 0.7, base - h + 12, x + w * 0.15, base - h + 18, x - 40, base - h * 0.5 + 24);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 5; i++) spruceTree(ctx, x + w * (0.12 + i * 0.19), base - h + 8 + Math.abs(i - 2) * 22, 150 + ((i * 37) % 50), '#1c4127', '#245233');
    // the mouth
    const g = ctx.createLinearGradient(0, base - mh, 0, base);
    g.addColorStop(0, '#0d0b12');
    g.addColorStop(1, '#1c1822');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(mx, base);
    ctx.bezierCurveTo(mx - 6, base - mh * 0.9, mx + mw + 6, base - mh * 0.9, mx + mw, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = T('#403a48');
    ctx.lineWidth = 8;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const sx = mx + 22 + i * (mw - 44) / 5, sl = 16 + ((i * 13) % 18);
      ctx.fillStyle = T('#403a48');
      tri(ctx, sx - 7, base - mh * 0.68 - Math.abs(i - 2.5) * 10, sx, base - mh * 0.68 - Math.abs(i - 2.5) * 10 + sl, sx + 7, base - mh * 0.68 - Math.abs(i - 2.5) * 10);
      ctx.fill();
    }
  };
  // ---- inside the bear cave (drawn over the cave background) ----
  // the sleeping bear, curled up on a rock ledge at the back of the cave (the renderer dims it into the background)
  near.bear = function (ctx, x, base, d, t, bs, font) {
    const ly = base - 150; // top of the ledge
    ctx.fillStyle = '#3a3444';
    ctx.beginPath();
    ctx.moveTo(x - 200, base);
    ctx.lineTo(x - 180, ly + 8);
    ctx.quadraticCurveTo(x, ly - 6, x + 170, ly + 6);
    ctx.lineTo(x + 190, base);
    ctx.fill();
    ctx.fillStyle = '#4a4356';
    ctx.fillRect(x - 178, ly, 346, 7);
    const br = 1 + Math.sin(t * 1.4) * 0.03;
    const fur = '#6b4527', dk = '#3e2614', muzzle = '#a07650';
    // body: a big furry hump, breathing
    ctx.save();
    ctx.translate(x + 30, ly + 2);
    ctx.scale(1, br);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.bezierCurveTo(-100, -70, 40, -92, 110, -40);
    ctx.quadraticCurveTo(128, -18, 118, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dk;
    ctx.beginPath();
    ctx.ellipse(70, -12, 30, 12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // head resting on the front paws
    const hx = x - 88, hy = ly - 30;
    ctx.fillStyle = fur;
    for (const ex of [-26, 20]) {
      circle(ctx, hx + ex, hy - 26, 12);
      ctx.fill();
    }
    ctx.fillStyle = dk;
    for (const ex of [-26, 20]) {
      circle(ctx, hx + ex, hy - 26, 6);
      ctx.fill();
    }
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 40, 32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = muzzle;
    ctx.beginPath();
    ctx.ellipse(hx - 22, hy + 10, 20, 14, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a120c';
    ctx.beginPath();
    ctx.ellipse(hx - 36, hy + 4, 7, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1a120c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const ex of [-14, 12]) {
      ctx.beginPath();
      ctx.arc(hx + ex, hy - 8, 6, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = fur;
    for (const px of [-40, 0]) {
      ctx.beginPath();
      ctx.ellipse(hx + px, ly - 4, 20, 9, 0, 0, TAU);
      ctx.fill();
    }
    // Zzz
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.4 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(u * Math.PI);
      ctx.fillStyle = '#d8f4ff';
      ctx.font = Math.round(18 + u * 20) + 'px ' + font;
      ctx.fillText('Z', hx + 20 + u * 60 + Math.sin(u * 6) * 8, hy - 34 - u * 70);
    }
    ctx.globalAlpha = 1;
  };
  near.glowshrooms = function (ctx, x, base, d, t) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 2 + d.x);
    const g = ctx.createRadialGradient(x, base - 16, 2, x, base - 16, 70);
    g.addColorStop(0, 'rgba(120,255,230,' + 0.35 * pulse + ')');
    g.addColorStop(1, 'rgba(120,255,230,0)');
    ctx.fillStyle = g;
    circle(ctx, x, base - 16, 70);
    ctx.fill();
    for (const [dx, h, r] of [[0, 24, 11], [16, 15, 8], [-14, 12, 7], [26, 8, 5]]) {
      ctx.fillStyle = '#cfeee8';
      ctx.fillRect(x + dx - 2, base - h, 4, h);
      ctx.fillStyle = '#6ff0d8';
      ctx.beginPath();
      ctx.ellipse(x + dx, base - h, r, r * 0.6, 0, Math.PI, TAU);
      ctx.closePath();
      ctx.fill();
    }
  };
  near.crystals = function (ctx, x, base, d, t) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 1.5 + d.x * 0.3);
    const g = ctx.createRadialGradient(x, base - 24, 2, x, base - 24, 80);
    g.addColorStop(0, 'rgba(200,150,255,' + 0.4 * pulse + ')');
    g.addColorStop(1, 'rgba(200,150,255,0)');
    ctx.fillStyle = g;
    circle(ctx, x, base - 24, 80);
    ctx.fill();
    for (const [dx, h, a] of [[0, 56, 0], [-16, 38, -0.35], [16, 42, 0.3], [30, 24, 0.5], [-28, 22, -0.6]]) {
      ctx.save();
      ctx.translate(x + dx, base);
      ctx.rotate(a);
      ctx.fillStyle = '#b58cff';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-7, -h * 0.75);
      ctx.lineTo(0, -h);
      ctx.lineTo(7, -h * 0.75);
      ctx.lineTo(7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-4, -h * 0.72, 3, h * 0.6);
      ctx.restore();
    }
  };

  // ---------- forest mid-layer landmarks ----------
  mid.spruces = function (ctx, x, base) {
    for (let i = 0; i < 8; i++) spruceTree(ctx, x - 230 + i * 64 + (i % 2) * 12, base, 150 + ((i * 41) % 80));
  };
  mid.tarn = function (ctx, x, base, d, t) {
    // skogstjärn: small forest lake with reeds
    const g = ctx.createLinearGradient(0, base - 30, 0, base);
    g.addColorStop(0, T('#7fb0cf'));
    g.addColorStop(1, T('#3d6f8e'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, base - 8, 220, 24, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 5; i++) ctx.fillRect(x - 150 + i * 70 + Math.sin(t + i) * 6, base - 12 + (i % 2) * 6, 34, 2);
    for (let i = 0; i < 4; i++) spruceTree(ctx, x - 250 + i * 150 + (i % 2) * 40, base - 26, 120 + ((i * 29) % 40));
  };
  mid.cranes = function (ctx, x, base, d, t) {
    for (const [dx, sc] of [[-80, 0.55], [0, 0.6], [70, 0.5]]) {
      ctx.save();
      ctx.translate(x + dx, base);
      ctx.scale(sc, sc);
      near.crane(ctx, 0, 0, { x: dx }, t);
      ctx.restore();
    }
  };
  mid.deadtrees = function (ctx, x, base) {
    for (let i = 0; i < 4; i++) deadSnag(ctx, x - 150 + i * 95 + (i % 2) * 20, base, 90 + ((i * 31) % 50));
  };
  mid.deer = function (ctx, x, base, d, t) {
    for (const [dx, sc, graze] of [[-40, 0.8, 0], [40, 0.7, 1]]) {
      ctx.save();
      ctx.translate(x + dx, base);
      ctx.scale(sc, sc);
      near.deer(ctx, 0, 0, { x: dx, graze }, t);
      ctx.restore();
    }
  };
  mid.moosecalf = function (ctx, x, base) {
    Art.moose(ctx, x - 70, base - 96, 104, 96, T);
    Art.moose(ctx, x + 36, base - 52, 58, 52, T, true);
  };
  mid.foxrun = function (ctx, x, base, d, t) {
    ctx.save();
    ctx.translate(x, base - 30);
    Art.fox(ctx, -30, 0, 60, 30, T, t);
    ctx.restore();
  };
  mid.rockhill = function (ctx, x, base) {
    ctx.fillStyle = T('#77717e');
    ctx.beginPath();
    ctx.moveTo(x - 380, base);
    ctx.bezierCurveTo(x - 300, base - 150, x - 120, base - 210, x, base - 200);
    ctx.bezierCurveTo(x + 150, base - 190, x + 280, base - 120, x + 380, base);
    ctx.fill();
    ctx.fillStyle = T('#8a8490');
    ctx.beginPath();
    ctx.moveTo(x - 200, base - 150);
    ctx.lineTo(x - 140, base - 120);
    ctx.lineTo(x - 60, base - 150);
    ctx.lineTo(x - 120, base - 180);
    ctx.fill();
    for (let i = 0; i < 7; i++) spruceTree(ctx, x - 260 + i * 85, base - 150 - Math.sin((i / 6) * Math.PI) * 50 + 10, 110 + ((i * 23) % 40));
  };
  mid.firetower = function (ctx, x, base) {
    // brandtorn: tall timber lookout tower
    ctx.strokeStyle = T('#6b4a2e');
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 34, base);
    ctx.lineTo(x - 16, base - 230);
    ctx.moveTo(x + 34, base);
    ctx.lineTo(x + 16, base - 230);
    for (let i = 0; i < 5; i++) {
      const y0 = base - i * 46, y1 = base - (i + 1) * 46, w0 = 34 - i * 3.6, w1 = 34 - (i + 1) * 3.6;
      ctx.moveTo(x - w0, y0);
      ctx.lineTo(x + w1, y1);
      ctx.moveTo(x + w0, y0);
      ctx.lineTo(x - w1, y1);
    }
    ctx.stroke();
    ctx.fillStyle = T('#8a2a1c');
    ctx.fillRect(x - 26, base - 262, 52, 34);
    ctx.fillStyle = lit() ? '#ffd27a' : T('#9ab9cf');
    ctx.fillRect(x - 20, base - 256, 40, 12);
    ctx.fillStyle = T('#3a3d45');
    tri(ctx, x - 32, base - 262, x, base - 292, x + 32, base - 262);
    ctx.fill();
  };
  mid.jakttorn = function (ctx, x, base) {
    // hunting stand at the edge of the forest
    ctx.strokeStyle = T('#7a5a3a');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 16, base);
    ctx.lineTo(x - 12, base - 110);
    ctx.moveTo(x + 16, base);
    ctx.lineTo(x + 12, base - 110);
    for (let yy = base - 12; yy > base - 110; yy -= 14) {
      ctx.moveTo(x - 15, yy);
      ctx.lineTo(x + 15, yy);
    }
    ctx.stroke();
    ctx.fillStyle = T('#6b4a2e');
    ctx.fillRect(x - 20, base - 140, 40, 32);
    ctx.fillStyle = T('#1c1c1c');
    ctx.fillRect(x - 14, base - 134, 28, 10);
    ctx.fillStyle = T('#3a3d45');
    ctx.fillRect(x - 24, base - 146, 48, 8);
  };
  // =====================================================================
  // LEVEL 3 — the subway and the sewers
  // =====================================================================
  // ---------- hazards ----------
  // råtta: a sewer rat is a spike (same hitbox), sniffing towards Vippe with its tail curled up behind it
  function rat(ctx, x, y, w, h, glow, t, seed) {
    const b = y + h, sn = Math.sin(t * 11 + seed * 2.1) * 0.5 + 0.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = TL('#d98f9c');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.84, b - h * 0.1);
    ctx.bezierCurveTo(x + w * 1.1, b - h * 0.04, x + w * 1.2, b - h * 0.3, x + w * (1.08 + 0.04 * Math.sin(t * 3 + seed)), b - h * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.92, b);
    ctx.bezierCurveTo(x + w * 1.0, b - h * 0.52, x + w * 0.62, b - h * 0.66, x + w * 0.4, b - h * 0.48);
    ctx.quadraticCurveTo(x + w * 0.22, b - h * 0.38, x + w * (0.05 - sn * 0.03), b - h * 0.2);
    ctx.quadraticCurveTo(x + w * 0.16, b - h * 0.04, x + w * 0.3, b);
    ctx.closePath();
    ctx.fillStyle = TL('#6f635a');
    ctx.fill();
    ctx.strokeStyle = glow || '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = TL('#a8998c');
    ctx.beginPath();
    ctx.ellipse(x + w * 0.54, b - h * 0.12, w * 0.2, h * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = TL('#e7a3ae');
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, b - h * 0.52, w * 0.08, h * 0.1, -0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = TL('#4a3f38');
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ff3b30';
    circle(ctx, x + w * 0.25, b - h * 0.34, 2.6);
    ctx.fill();
    ctx.fillStyle = '#ffd0d6';
    circle(ctx, x + w * (0.05 - sn * 0.03), b - h * 0.2, 2.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const k of [-1, 1]) {
      ctx.moveTo(x + w * 0.12, b - h * 0.22);
      ctx.lineTo(x - w * 0.1, b - h * (0.24 + k * 0.08 + sn * 0.03));
    }
    ctx.stroke();
    ctx.fillStyle = TL('#e7a3ae');
    ctx.fillRect(x + w * 0.32, b - 3, 6, 3);
    ctx.fillRect(x + w * 0.7, b - 3, 6, 3);
  }

  // green sewer slime: goo heaped up on the floor of the pipe, or dripping from its roof
  function slimeSpike(ctx, x, y, w, h, down, glow, t, seed) {
    const wob = Math.sin(t * 3 + seed) * w * 0.04, cx = x + w / 2;
    const base = down ? y : y + h, tip = down ? y + h - 1 : y + 1, dir = down ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + 1, base);
    ctx.bezierCurveTo(x + w * 0.3, base + dir * h * 0.12, cx - w * 0.14 + wob, base + dir * h * 0.6, cx + wob, tip);
    ctx.bezierCurveTo(cx + w * 0.14 + wob, base + dir * h * 0.6, x + w * 0.7, base + dir * h * 0.12, x + w - 1, base);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, base, 0, tip);
    g.addColorStop(0, TL('#3f7a12'));
    g.addColorStop(1, TL('#a6e83c'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = glow || '#c8ff7a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.1 + wob * 0.5, base + dir * h * 0.4, w * 0.04, h * 0.12, 0.2, 0, TAU);
    ctx.fill();
    if (down) {
      // a drop gathering at the tip and falling off
      const u = (t * 0.9 + seed * 0.31) % 1;
      ctx.fillStyle = 'rgba(166,232,60,' + (1 - u) + ')';
      circle(ctx, cx + wob, tip + 2 + u * u * 40, 3 + (1 - u) * 1.5);
      ctx.fill();
    } else {
      ctx.fillStyle = TL('#8fd12e');
      circle(ctx, x + w * 0.22, base - 3, 3);
      ctx.fill();
      circle(ctx, x + w * 0.8, base - 2, 2.2);
      ctx.fill();
    }
  }

  // the sewer's dirty water: brown-green sludge with scum, bubbles, rubbish and the odd crocodile watching
  function sludge(ctx, x0, x1, ySurf, yBot, t) {
    const g = ctx.createLinearGradient(0, ySurf, 0, yBot);
    g.addColorStop(0, TL('#58652a'));
    g.addColorStop(0.18, TL('#39431c'));
    g.addColorStop(1, TL('#0c0f08'));
    ctx.fillStyle = g;
    const wave = (x) => ySurf + Math.sin((x - x0) * 0.035 + t * 1.6) * 2;
    ctx.beginPath();
    ctx.moveTo(x0, yBot);
    for (let x = x0; x <= x1 + 8; x += 8) ctx.lineTo(Math.min(x, x1), wave(Math.min(x, x1)));
    ctx.lineTo(x1, yBot);
    ctx.closePath();
    ctx.fill();
    // slow reflections drifting on the murk
    ctx.fillStyle = 'rgba(190,215,120,0.16)';
    for (let x = x0 + 20, k = 0; x < x1 - 40; x += 64, k++) {
      const yy = ySurf + 16 + ((k * 37) % 5) * 12, dx = Math.sin(t * 0.9 + k * 1.7) * 10;
      ctx.fillRect(x + dx, yy, 26 + (k % 3) * 8, 2);
    }
    ctx.strokeStyle = 'rgba(10,14,6,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      if (x === x0) ctx.moveTo(x, wave(x) + 3);
      else ctx.lineTo(x, wave(x) + 3);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(185,215,85,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 8) {
      if (x === x0) ctx.moveTo(x, wave(x));
      else ctx.lineTo(x, wave(x));
    }
    ctx.stroke();
    // scum floating on top
    ctx.fillStyle = 'rgba(140,170,50,0.35)';
    for (let x = x0 + 30, k = 0; x < x1 - 30; x += 90, k++) {
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(t * 0.5 + k) * 8, ySurf + 6 + (k % 3) * 3, 20 + ((k * 7) % 14), 3, 0, 0, TAU);
      ctx.fill();
    }
    // bubbles popping
    ctx.lineWidth = 1.5;
    for (let k = 0; k < (x1 - x0) / 40; k++) {
      const u = (t * 0.7 + U.hash(k * 3.7)) % 1;
      const bx = x0 + 12 + U.hash(k * 1.3) * Math.max(0, x1 - x0 - 24);
      ctx.strokeStyle = 'rgba(205,225,120,' + (1 - u) * 0.8 + ')';
      circle(ctx, bx, ySurf + 2 - u * 4, 2 + u * 5);
      ctx.stroke();
    }
    // rubbish drifting by, and in the wide pools a crocodile lying low (placed relative to x0 so they scroll with the world)
    const step = 170;
    const k0 = Math.max(0, Math.floor((-80 - x0) / step)), k1 = Math.min(Math.floor((x1 - x0) / step), Math.ceil((1360 - x0) / step));
    for (let k = k0; k <= k1; k++) {
      const px = x0 + 40 + k * step + ((k * 53) % 60), py = ySurf + 3 + Math.sin(t * 2 + k) * 1.5;
      if (px < x0 + 18 || px > x1 - 22) continue;
      const kind = k % 4;
      if (kind === 1) duck(ctx, px, py, t + k);
      else if (kind === 3) tinCan(ctx, px, py, k);
      else if (kind === 2 && x1 - x0 > 280) lurker(ctx, px, py + 2, t + k);
    }
  }
  function duck(ctx, x, y, t) {
    const tilt = Math.sin(t * 2.3) * 0.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = '#ffd21c';
    ctx.beginPath();
    ctx.ellipse(0, -5, 12, 7, 0, 0, TAU);
    ctx.fill();
    circle(ctx, -7, -14, 6.5);
    ctx.fill();
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.ellipse(-14, -13, 4, 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    circle(ctx, -9, -16, 1.4);
    ctx.fill();
    ctx.restore();
  }
  function tinCan(ctx, x, y, k) {
    ctx.save();
    ctx.translate(x, y - 3);
    ctx.rotate(0.3 + (k % 3) * 0.4);
    ctx.fillStyle = TL('#b8bec6');
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = TL(k % 2 ? '#d6453a' : '#2f6fcf');
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  // a crocodile lying low in the sludge: just its eyes, its nostrils and the ridge of its back
  function lurker(ctx, x, y, t) {
    const blink = (t * 0.45) % 1 < 0.05;
    ctx.fillStyle = TL('#3d6a2b');
    ctx.beginPath();
    ctx.ellipse(x + 16, y, 34, 4, 0, Math.PI, TAU);
    ctx.fill();
    for (let k = 0; k < 5; k++) tri(ctx, x + 14 + k * 9, y - 2, x + 18 + k * 9, y - 7, x + 22 + k * 9, y - 2), ctx.fill();
    for (const dx of [-8, 6]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y - 4, 7, 7, 0, Math.PI, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x - 34, y - 2, 6, 4, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a2a12';
    circle(ctx, x - 36, y - 4, 1.3);
    ctx.fill();
    circle(ctx, x - 32, y - 4, 1.3);
    ctx.fill();
    if (!blink) {
      for (const dx of [-8, 6]) {
        ctx.fillStyle = '#f0d83a';
        ctx.beginPath();
        ctx.ellipse(x + dx, y - 6, 4, 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(x + dx - 0.8, y - 9, 1.6, 6);
      }
    }
  }

  // the live third rail, showing through a gap in the platform or the track bed: a crackling blue danger strip
  Art.rail = function (ctx, x0, x1, gy, t) {
    ctx.fillStyle = '#07080a';
    ctx.fillRect(x0 + 2, gy - 1, x1 - x0 - 4, 170);
    // an electric haze over it, flickering
    const fl = 0.8 + 0.2 * Math.sin(t * 23) * Math.sin(t * 7.3);
    const gl = ctx.createLinearGradient(0, gy - 44, 0, gy + 30);
    gl.addColorStop(0, 'rgba(90,190,255,0)');
    gl.addColorStop(0.65, 'rgba(90,190,255,' + 0.5 * fl + ')');
    gl.addColorStop(1, 'rgba(90,190,255,0.15)');
    ctx.fillStyle = gl;
    ctx.fillRect(x0 + 2, gy - 44, x1 - x0 - 4, 74);
    // the rail on its insulators
    ctx.fillStyle = '#e8e2d0';
    for (let x = x0 + 14; x < x1 - 10; x += 34) ctx.fillRect(x, gy + 22, 8, 14);
    ctx.fillStyle = '#7d858e';
    ctx.fillRect(x0 + 2, gy + 10, x1 - x0 - 4, 12);
    ctx.fillStyle = '#bfefff';
    ctx.fillRect(x0 + 2, gy + 10, x1 - x0 - 4, 3);
    // sparks crackling up from it
    const f = Math.floor(t * 16);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const n = Math.max(2, Math.round((x1 - x0) / 34));
    for (let k = 0; k < n; k++) {
      if (U.hash(f * 7.3 + k * 13.1) < 0.3) continue;
      let xx = x0 + 10 + U.hash(f * 3.1 + k * 5.7) * (x1 - x0 - 20), yy = gy + 10;
      const pts = [[xx, yy]], hgt = 4 + Math.floor(U.hash(f * 1.9 + k) * 3);
      for (let j = 0; j < hgt; j++) {
        yy -= 9;
        xx += (U.hash(f + k * 3.3 + j * 1.7) - 0.5) * 18;
        pts.push([xx, yy]);
      }
      for (const lw of [7, 2.5]) {
        ctx.strokeStyle = lw > 3 ? 'rgba(110,200,255,0.5)' : '#f4fcff';
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
    }
    // yellow and black warning stripes along both edges
    for (const ex of [x0, x1 - 7]) {
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k % 2 ? '#111' : '#f2c230';
        ctx.fillRect(ex, gy + k * 7, 7, 7);
      }
    }
  };

  // the tunnel floor caves in: a ragged hole through the track bed, with cracks running up to it
  Art.hole = function (ctx, x0, x1, gy, yb, t) {
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    const r = U.rng(77);
    for (let k = 0; k < 6; k++) {
      let x = x0 - 6, y = gy + 3 + r() * 34;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const len = 60 + r() * 260;
      while (x > x0 - len) {
        x -= 12 + r() * 20;
        y = U.clamp(y + (r() - 0.5) * 16, gy + 2, gy + 70);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, gy, 0, yb);
    g.addColorStop(0, '#040405');
    g.addColorStop(0.7, '#090d07');
    g.addColorStop(1, '#1b2812');
    ctx.fillStyle = g;
    const q = U.rng(91);
    ctx.beginPath();
    ctx.moveTo(x0 - 12, gy - 2);
    for (let y = gy + 10; y < yb; y += 16) ctx.lineTo(x0 + (q() - 0.3) * 16 + (y - gy) * 0.06, y);
    ctx.lineTo(x0 + 12, yb + 2);
    ctx.lineTo(x1 - 12, yb + 2);
    for (let y = yb - 10; y > gy; y -= 16) ctx.lineTo(x1 + (q() - 0.7) * 16 - (y - gy) * 0.06, y);
    ctx.lineTo(x1 + 12, gy - 2);
    ctx.closePath();
    ctx.fill();
    // the snapped rails drooping into the hole
    ctx.lineCap = 'round';
    for (const [ax, ay, bx, by, cx, cy] of [[x0 - 30, gy + 3, x0 + 14, gy + 4, x0 + 40, gy + 74], [x1 + 30, gy + 3, x1 - 10, gy + 4, x1 - 34, gy + 58]]) {
      ctx.strokeStyle = '#4c5157';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(bx, by, cx, cy);
      ctx.stroke();
      ctx.strokeStyle = '#c9ced4';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // broken concrete at the lips
    ctx.fillStyle = '#5d5750';
    for (const [px, s] of [[x0 - 4, 1], [x0 + 6, 0.7], [x1 - 2, 1], [x1 + 8, 0.6]]) {
      tri(ctx, px - 10 * s, gy - 1, px + 8 * s, gy - 1, px, gy + 16 * s);
      ctx.fill();
    }
    // pebbles trickling down
    ctx.fillStyle = '#6b625a';
    for (let k = 0; k < 7; k++) {
      const u = (t * 0.8 + k * 0.17) % 1;
      ctx.fillRect(x0 + 18 + U.hash(k) * (x1 - x0 - 36), gy + u * (yb - gy), 4, 4);
    }
  };

  // ...and where it comes out through the brick roof of the sewer: a ragged gap with dusty light falling in
  Art.holeRoof = function (ctx, x0, x1, gy, t) {
    const lg = ctx.createLinearGradient(0, 0, 0, gy);
    lg.addColorStop(0, 'rgba(255,236,190,0.3)');
    lg.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x0 + 6, 0);
    ctx.lineTo(x1 - 6, 0);
    ctx.lineTo(x1 + 80, gy);
    ctx.lineTo(x0 - 80, gy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#040504';
    const r = U.rng(123);
    ctx.beginPath();
    ctx.moveTo(x0 - 18, -2);
    for (let x = x0 - 18; x <= x1 + 18; x += 12) ctx.lineTo(x, 30 + r() * 24 - Math.abs((x - (x0 + x1) / 2) / (x1 - x0)) * 30);
    ctx.lineTo(x1 + 18, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a4430';
    for (let k = 0; k < 6; k++) {
      ctx.save();
      ctx.translate(x0 - 20 + U.hash(k * 2.7) * (x1 - x0 + 40), 34 + U.hash(k * 4.1) * 22);
      ctx.rotate(U.hash(k) * 1.4 - 0.7);
      ctx.fillRect(-9, -4, 18, 8);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,240,210,0.6)';
    for (let k = 0; k < 16; k++) {
      const u = (t * 0.15 + U.hash(k * 2.1)) % 1;
      ctx.fillRect(x0 - 40 + U.hash(k * 5.3) * (x1 - x0 + 80) + Math.sin(t + k) * 6, 50 + u * (gy - 70), 2, 2);
    }
  };

  // ---------- the crocodiles ----------
  const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  // a crocodile's head in profile, facing left, with the jaw hinge at (0, 0); open = 0 (shut) .. 1 (wide open)
  function crocHeadShape(ctx, L, open, glow) {
    const skin = TL('#4c7f35'), dark = TL('#2f5a22'), belly = TL('#cfcf90'), line = glow || '#fff';
    const lower = -open * 0.14, upper = open * 0.55;
    ctx.lineJoin = 'round';
    if (open > 0.05) {
      const lt = rot(-L * 0.9, -0.02 * L, lower), ut = rot(-L * 0.9, -0.02 * L, upper);
      ctx.fillStyle = '#8a2333';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(lt[0], lt[1]);
      ctx.lineTo(ut[0], ut[1]);
      ctx.closePath();
      ctx.fill();
    }
    // lower jaw
    ctx.save();
    ctx.rotate(lower);
    ctx.beginPath();
    ctx.moveTo(6, -0.02 * L);
    ctx.lineTo(-0.9 * L, -0.03 * L);
    ctx.quadraticCurveTo(-1.02 * L, 0, -0.95 * L, 0.08 * L);
    ctx.lineTo(0.02 * L, 0.15 * L);
    ctx.closePath();
    ctx.fillStyle = belly;
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let u = 0.14; u < 0.86; u += 0.12) {
      tri(ctx, -u * L - 3, -0.03 * L, -u * L, -0.03 * L - 7, -u * L + 3, -0.03 * L);
      ctx.fill();
    }
    ctx.restore();
    // upper jaw and skull
    ctx.save();
    ctx.rotate(upper);
    ctx.fillStyle = '#ffffff';
    for (let u = 0.2; u < 0.86; u += 0.12) {
      tri(ctx, -u * L - 3, -0.02 * L, -u * L, -0.02 * L + 7, -u * L + 3, -0.02 * L);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0.1 * L, 0.03 * L);
    ctx.lineTo(-0.9 * L, -0.02 * L);
    ctx.quadraticCurveTo(-1.04 * L, -0.03 * L, -1.0 * L, -0.11 * L);
    ctx.quadraticCurveTo(-0.96 * L, -0.18 * L, -0.86 * L, -0.15 * L);
    ctx.lineTo(-0.42 * L, -0.17 * L);
    ctx.quadraticCurveTo(-0.32 * L, -0.36 * L, -0.16 * L, -0.34 * L);
    ctx.quadraticCurveTo(0.04 * L, -0.33 * L, 0.12 * L, -0.18 * L);
    ctx.closePath();
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = dark;
    for (let u = 0.5; u < 0.84; u += 0.08) {
      circle(ctx, -u * L, -0.12 * L, 1.8);
      ctx.fill();
    }
    ctx.fillStyle = '#1a2a12';
    circle(ctx, -0.93 * L, -0.14 * L, 2);
    ctx.fill();
    const ex = -0.2 * L, ey = -0.29 * L;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(ex, ey - 0.01 * L, 0.12 * L, 0.1 * L, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f0d83a';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.085 * L, 0.065 * L, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.fillRect(ex - 1.1, ey - 0.05 * L, 2.2, 0.1 * L);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - 0.11 * L, ey - 0.1 * L);
    ctx.lineTo(ex + 0.07 * L, ey - 0.05 * L);
    ctx.stroke();
    ctx.restore();
  }
  // opens slowly... then SNAP!
  function snap(t, seed, speed) {
    const p = (t * speed + seed * 0.37) % 1;
    return p < 0.7 ? U.smooth(p / 0.7) : Math.max(0, 1 - (p - 0.7) / 0.06);
  }
  // the head of a crocodile lying in the water (a hazard): dir 'left' faces Vippe, 'right' faces away
  Art.crocHead = function (ctx, x, y, w, h, dir, t, seed, glow) {
    const b = y + h;
    ctx.save();
    if (dir === 'right') {
      ctx.translate(2 * x + w, 0);
      ctx.scale(-1, 1);
    }
    ctx.translate(x + w * 0.95, b - h * 0.36);
    crocHeadShape(ctx, w * 1.02, snap(t, seed, 0.85), glow);
    ctx.restore();
    const u = (t * 0.9 + seed) % 1;
    ctx.strokeStyle = 'rgba(175,205,75,' + (1 - u) * 0.7 + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w * (dir === 'right' ? 0.8 : 0.2), b - 10, 10 + u * 16, 2 + u * 2, 0, 0, TAU);
    ctx.stroke();
  };
  // a crocodile head sticking straight up out of the sludge, jaws snapping at the air
  Art.snapper = function (ctx, x, y, w, h, t, seed, glow) {
    const b = y + h;
    ctx.save();
    ctx.translate(x + w * 0.36, b - 6 + Math.sin(t * 2 + seed) * 2);
    ctx.rotate(Math.PI / 2 - 0.12);
    crocHeadShape(ctx, h * 0.82, 0.3 + snap(t, seed, 1.1) * 0.7, glow);
    ctx.restore();
    const u = (t * 1.2 + seed) % 1;
    ctx.strokeStyle = 'rgba(175,205,75,' + (1 - u) * 0.8 + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, b - 10, 14 + u * 14, 3 + u * 2, 0, 0, TAU);
    ctx.stroke();
  };
  // the crocodile's back: a platform to land on. A knobbly ridge, stubby legs paddling, a long tail
  function crocBody(ctx, x, y, w, h, flip, t, seed) {
    const b = y + h;
    ctx.save();
    if (flip) {
      ctx.translate(2 * x + w, 0);
      ctx.scale(-1, 1);
    }
    // (drawn with the neck at the left, x, and the tail sticking out past the right end)
    const skin = TL('#4f8a36'), dark = TL('#2c5520'), light = TL('#78b04e'), line = TL('#17300f');
    const tipX = x + w + 44, pad = Math.sin(t * 6 + seed) * 3;
    const leg = (lx, k) => {
      // a bent leg with a clawed foot, paddling at the waterline
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(lx, y + h * 0.55, 11, 7, 0.5 * k, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(lx - 6, y + h * 0.6);
      ctx.lineTo(lx - 10 + pad * k, b - 9);
      ctx.lineTo(lx + 2 + pad * k, b - 9);
      ctx.lineTo(lx + 6, y + h * 0.6);
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const c of [-6, -1, 4]) {
        ctx.moveTo(lx - 4 + pad * k + c, b - 10);
        ctx.lineTo(lx - 6 + pad * k + c, b - 5);
      }
      ctx.stroke();
    };
    leg(x + w - 30, -1);
    // body and tail
    ctx.beginPath();
    ctx.moveTo(x - 6, b - 4);
    ctx.lineTo(x - 6, y + 8);
    ctx.quadraticCurveTo(x - 4, y - 2, x + 10, y - 2);
    ctx.lineTo(x + w - 16, y - 2);
    ctx.quadraticCurveTo(x + w + 14, y, tipX, b - h * 0.5);
    ctx.quadraticCurveTo(x + w + 8, b - h * 0.2, x + w - 24, b - 6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, b);
    g.addColorStop(0, skin);
    g.addColorStop(0.7, TL('#3e7029'));
    g.addColorStop(1, TL('#c9c98a'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.stroke();
    // a row of pale scales along its flank
    ctx.fillStyle = light;
    for (let px = x + 10; px < x + w - 12; px += 15) {
      ctx.beginPath();
      ctx.ellipse(px, y + h * 0.45, 5, 3.5, 0, 0, TAU);
      ctx.fill();
    }
    // the knobbly ridge along its back (what you land on), carrying on down the tail
    for (let px = x + 4, k = 0; px < tipX - 8; px += 10, k++) {
      const top = px < x + w - 16 ? y - 2 : y - 2 + ((px - (x + w - 16)) / (tipX - x - w + 16)) * (b - h * 0.5 - y);
      const r = px < x + w - 16 ? 5.5 : 4;
      ctx.fillStyle = k % 2 ? dark : TL('#3b6d29');
      ctx.beginPath();
      ctx.arc(px, top + 1, r, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    leg(x + 26, 1);
    ctx.restore();
    // lying in the sludge: the water laps over its belly
    ctx.fillStyle = 'rgba(60,70,28,0.65)';
    ctx.fillRect(x - 50, b - 11, w + 100, 11);
    ctx.strokeStyle = 'rgba(185,215,85,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let xx = x - 50; xx <= x + w + 50; xx += 8) {
      const yy = b - 11 + Math.sin(xx * 0.1 + t * 2) * 1.5;
      if (xx === x - 50) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }

  // ---------- solid blocks (and the thorny signals) ----------
  // a Stockholm metro train, parked: silver cars with a blue stripe. You run along the roof.
  function train(ctx, x, y, w, h, bs, seed, t) {
    const b = y + h, cars = Math.max(1, Math.round(w / (bs * 7))), cw = w / cars;
    const rnd = U.rng(seed * 131 + 5);
    for (let c = 0; c < cars; c++) {
      const first = c === 0, last = c === cars - 1;
      const x0 = x + c * cw + (first ? 0 : 3), x1 = x + (c + 1) * cw - (last ? 0 : 3), wid = x1 - x0;
      // underframe and bogies
      ctx.fillStyle = TL('#23262b');
      ctx.fillRect(x0 + 8, b - 22, wid - 16, 14);
      for (const bx of [x0 + wid * 0.17, x0 + wid * 0.83]) {
        ctx.fillStyle = TL('#2e3238');
        ctx.fillRect(bx - 26, b - 16, 52, 6);
        for (const dx of [-15, 15]) {
          ctx.fillStyle = TL('#15171a');
          circle(ctx, bx + dx, b - 9, 9);
          ctx.fill();
          ctx.fillStyle = TL('#5c636b');
          circle(ctx, bx + dx, b - 9, 3.5);
          ctx.fill();
        }
      }
      // the body, with a rounded nose at the front
      const top = y + 5, bot = b - 20, rl = first ? 30 : 6, rgt = last ? 18 : 6;
      ctx.beginPath();
      ctx.moveTo(x0 + rl, top);
      ctx.lineTo(x1 - rgt, top);
      ctx.quadraticCurveTo(x1, top, x1, top + rgt);
      ctx.lineTo(x1, bot);
      ctx.lineTo(x0 + 2, bot);
      ctx.lineTo(x0, top + rl + 20);
      ctx.quadraticCurveTo(x0, top, x0 + rl, top);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, TL('#e6eaee'));
      g.addColorStop(0.55, TL('#c4cad1'));
      g.addColorStop(1, TL('#8f97a1'));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = TL('#2a2f35');
      ctx.stroke();
      // the roof you run on
      ctx.fillStyle = TL('#7a818a');
      rr(ctx, x0 + (first ? 16 : 2), y, wid - (first ? 16 : 2) - (last ? 8 : 2), 8, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x0 + (first ? 20 : 4), y + 1, wid - (first ? 24 : 8), 2);
      // the blue stripe
      ctx.fillStyle = TL('#1f5fb4');
      ctx.fillRect(x0 + 1, bot - 26, wid - 2, 11);
      // doors, and windows full of passengers between them
      const nd = Math.max(2, Math.round(wid / 120)), dw = wid / nd;
      for (let d = 0; d < nd; d++) {
        const dx = x0 + (d + 0.5) * dw;
        ctx.fillStyle = TL('#b3bac2');
        ctx.fillRect(dx - 20, top + 12, 40, bot - top - 14);
        ctx.fillStyle = '#ffeec4';
        ctx.fillRect(dx - 16, top + 18, 13, 30);
        ctx.fillRect(dx + 3, top + 18, 13, 30);
        ctx.strokeStyle = TL('#4a5058');
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 20, top + 12, 40, bot - top - 14);
        ctx.beginPath();
        ctx.moveTo(dx, top + 12);
        ctx.lineTo(dx, bot - 2);
        ctx.stroke();
      }
      for (let d = 0; d <= nd; d++) {
        let wx0 = x0 + (d - 0.5) * dw + 26, wx1 = x0 + (d + 0.5) * dw - 26;
        wx0 = Math.max(wx0, x0 + (first ? 40 : 10));
        wx1 = Math.min(wx1, x1 - (last ? 12 : 10));
        if (wx1 - wx0 < 22) continue;
        ctx.fillStyle = '#ffeebd';
        rr(ctx, wx0, top + 16, wx1 - wx0, 34, 5);
        ctx.fill();
        // passengers
        for (let px = wx0 + 10; px < wx1 - 8; px += 18) {
          if (rnd() < 0.45) continue;
          ctx.fillStyle = ['#6b4a2e', '#2b2b30', '#c9a06a', '#8a3a2a', '#3a4a6a'][Math.floor(rnd() * 5)];
          circle(ctx, px, top + 34, 6);
          ctx.fill();
          ctx.fillRect(px - 7, top + 40, 14, 10);
        }
        ctx.strokeStyle = TL('#3a4048');
        ctx.lineWidth = 2;
        rr(ctx, wx0, top + 16, wx1 - wx0, 34, 5);
        ctx.stroke();
      }
      if (first) {
        // the cab: windscreen, a destination sign and the headlights
        ctx.fillStyle = TL('#1a2a3d');
        ctx.beginPath();
        ctx.moveTo(x0 + 4, top + 26);
        ctx.quadraticCurveTo(x0 + 6, top + 10, x0 + 26, top + 9);
        ctx.lineTo(x0 + 34, top + 9);
        ctx.lineTo(x0 + 34, top + 50);
        ctx.lineTo(x0 + 3, top + 50);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x0 + 10, top + 14, 4, 30);
        ctx.fillStyle = '#101010';
        ctx.fillRect(x0 + 38, top + 9, 44, 12);
        ctx.fillStyle = '#ffb020';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('13 STORVRETA', x0 + 39, top + 15.5, 42);
        const hg = ctx.createRadialGradient(x0 + 8, bot - 12, 1, x0 + 8, bot - 12, 26);
        hg.addColorStop(0, 'rgba(255,250,210,0.9)');
        hg.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(x0 - 20, bot - 38, 50, 52);
        ctx.fillStyle = '#fffbe0';
        circle(ctx, x0 + 8, bot - 12, 4);
        ctx.fill();
      }
      if (last) {
        ctx.fillStyle = '#ff3b30';
        circle(ctx, x1 - 7, bot - 12, 4);
        ctx.fill();
      }
    }
  }
  // an air-conditioning box on a train roof
  function vent(ctx, x, y, w, h) {
    rr(ctx, x + 2, y + 1, w - 4, h, 4);
    ctx.fillStyle = TL('#9aa1aa');
    ctx.fill();
    ctx.strokeStyle = TL('#343940');
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = TL('#5d646d');
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let xx = x + 9; xx < x + w - 6; xx += 7) {
      ctx.moveTo(xx, y + 6);
      ctx.lineTo(xx, y + h - 3);
    }
    ctx.stroke();
  }
  // an SL ticket gate: a steel cabinet with its glass flap sticking out and a blue card reader
  function gate(ctx, x, y, w, h, seed, t) {
    const b = y + h;
    ctx.fillStyle = 'rgba(190,225,255,0.45)';
    rr(ctx, x + w - 4, y + h * 0.2, w * 0.6, h * 0.4, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    bevel(ctx, x + 2, y, w - 4, h, TL('#d5dade'), TL('#7f878f'), TL('#2c3137'), 6);
    ctx.fillStyle = TL('#3a4048');
    ctx.fillRect(x + 5, y + 3, w - 10, 5);
    ctx.fillStyle = '#3aa0ff';
    rr(ctx, x + w * 0.18, y + 13, w * 0.3, 8, 3);
    ctx.fill();
    ctx.fillStyle = Math.floor(t * 2 + seed) % 2 ? '#44e06a' : '#1f6e33';
    tri(ctx, x + w * 0.6, y + 11, x + w * 0.8, y + 17, x + w * 0.6, y + 23);
    ctx.fill();
    ctx.fillStyle = TL('#1f5fb4');
    ctx.fillRect(x + 5, b - 14, w - 10, 5);
  }
  // somebody's suitcases, piled one on top of the other
  function luggage(ctx, x, y, w, h, bs, seed) {
    const n = Math.max(1, Math.round(h / bs)), ch = h / n;
    const cols = ['#d6453a', '#2f6fcf', '#f2b632', '#3aa66a', '#8a4fc2'];
    for (let i = 0; i < n; i++) {
      const cy = y + h - (i + 1) * ch, c = cols[(seed + i * 3) % cols.length];
      ctx.strokeStyle = TL('#2a2a2a');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.35, cy + 8);
      ctx.lineTo(x + w * 0.35, cy + 3);
      ctx.lineTo(x + w * 0.65, cy + 3);
      ctx.lineTo(x + w * 0.65, cy + 8);
      ctx.stroke();
      rr(ctx, x + 3, cy + 7, w - 6, ch - 9, 6);
      ctx.fillStyle = TL(c);
      ctx.fill();
      ctx.strokeStyle = TL('#2a1c12');
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const k of [0.3, 0.5, 0.7]) {
        ctx.moveTo(x + w * k, cy + 11);
        ctx.lineTo(x + w * k, cy + ch - 6);
      }
      ctx.stroke();
      ctx.save();
      ctx.translate(x + w * 0.66, cy + ch * 0.55);
      ctx.rotate(-0.3 + i * 0.4);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ffe14a';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.restore();
    }
    ctx.fillStyle = TL('#1b1b1b');
    circle(ctx, x + 10, y + h - 2, 3);
    ctx.fill();
    circle(ctx, x + w - 10, y + h - 2, 3);
    ctx.fill();
  }
  // a big rusty sewer pipe lying along the walkway (two, stacked, if it's two blocks tall)
  function sewerPipe(ctx, x, y, w, h, bs, seed) {
    const n = Math.max(1, Math.round(h / bs)), ph = h / n;
    const rnd = U.rng(seed * 53 + 9);
    for (let i = n - 1; i >= 0; i--) {
      const py = y + i * ph;
      const g = ctx.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, TL('#8a7a62'));
      g.addColorStop(0.35, TL('#a38c6c'));
      g.addColorStop(1, TL('#43382b'));
      rr(ctx, x + 1, py + 2, w - 2, ph - 3, ph * 0.42);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = TL('#231c14');
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(140,60,20,0.35)';
      for (let k = 0; k < w / 30; k++) ctx.fillRect(x + 10 + rnd() * (w - 30), py + ph * 0.4, 6 + rnd() * 10, ph * 0.5);
      for (const fx of [x + 5, x + w - 13, x + w / 2 - 4]) {
        rr(ctx, fx, py, 8, ph, 3);
        ctx.fillStyle = TL('#6e5c46');
        ctx.fill();
        ctx.strokeStyle = TL('#231c14');
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = TL('#5f7d34');
      rr(ctx, x + w * 0.15, py + 1, w * 0.5, 5, 2);
      ctx.fill();
    }
  }
  // an old oil drum floating on its side in the sludge
  function barrel(ctx, x, y, w, h, seed, t) {
    const b = y + h;
    const g = ctx.createLinearGradient(0, y, 0, b);
    g.addColorStop(0, TL('#4f86c0'));
    g.addColorStop(0.45, TL('#2f5f96'));
    g.addColorStop(1, TL('#1a3558'));
    rr(ctx, x + 2, y + 2, w - 4, h - 3, h * 0.42);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = TL('#0f1c2e');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,70,30,0.55)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.7, y + h * 0.6, 12, 6, 0.3, 0, TAU);
    ctx.ellipse(x + w * 0.3, y + h * 0.35, 7, 4, -0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = TL('#16304f');
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const k of [0.36, 0.66]) {
      ctx.moveTo(x + w * k, y + 4);
      ctx.quadraticCurveTo(x + w * k + 5, y + h / 2, x + w * k, b - 3);
    }
    ctx.stroke();
    ctx.fillStyle = TL('#6a9ad0');
    ctx.beginPath();
    ctx.ellipse(x + 10, y + h / 2, 7, h / 2 - 4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = TL('#0f1c2e');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f2c230';
    rr(ctx, x + w * 0.44, y + h * 0.28, w * 0.14, h * 0.36, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(78,78,32,0.6)';
    ctx.fillRect(x - 4, b - 11, w + 8, 11);
    ctx.strokeStyle = 'rgba(175,205,75,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let xx = x - 4; xx <= x + w + 4; xx += 8) {
      const yy = b - 11 + Math.sin(xx * 0.12 + t * 2.2) * 1.5;
      if (xx === x - 4) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  // an iron grating across the pipe, slime oozing off it
  function grating(ctx, x, y, w, h, seed, t) {
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 5);
    ctx.fillStyle = TL('#24272b');
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = TL('#5d646c');
    for (let xx = x + 8; xx < x + w - 4; xx += 13) ctx.fillRect(xx, y, 5, h);
    for (const k of [0.33, 0.66]) ctx.fillRect(x, y + h * k - 3, w, 6);
    ctx.fillStyle = 'rgba(150,70,30,0.45)';
    ctx.fillRect(x + w * 0.2, y + h * 0.4, 10, h * 0.5);
    ctx.restore();
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 5);
    ctx.strokeStyle = TL('#9aa1a8');
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#7ea52c';
    for (let xx = x + 10; xx < x + w - 6; xx += 22) {
      const len = 6 + ((xx * 7) % 9);
      ctx.beginPath();
      ctx.moveTo(xx - 6, y + h);
      ctx.quadraticCurveTo(xx, y + h + len * 2, xx + 6, y + h);
      ctx.fill();
    }
  }
  // a concrete beam across the tunnel roof, hazard-striped along its bottom edge
  function beam(ctx, x, y, w, h) {
    bevel(ctx, x, y, w, h, TL('#6b7078'), TL('#3c4046'), TL('#16181b'), 4);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + h - 15, w - 6, 12);
    ctx.clip();
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(x, y + h - 15, w, 12);
    ctx.fillStyle = '#111';
    for (let xx = x - 20; xx < x + w + 20; xx += 16) {
      ctx.beginPath();
      ctx.moveTo(xx, y + h - 3);
      ctx.lineTo(xx + 8, y + h - 3);
      ctx.lineTo(xx + 20, y + h - 15);
      ctx.lineTo(xx + 12, y + h - 15);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = TL('#23262b');
    for (let xx = x + 10; xx < x + w - 6; xx += 24) {
      circle(ctx, xx, y + 10, 3);
      ctx.fill();
    }
  }
  // signal lamps: one of red / amber / green is lit, and they change as you watch
  function lamps(ctx, cx, y0, y1, r, t, seed) {
    const cols = ['#ff3b30', '#ffb020', '#3cff78'];
    const lit = Math.floor(t * 1.2 + seed) % 3, n = 3, sp = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const ly = y0 + sp * (i + 0.5);
      if (i === lit) {
        const g = ctx.createRadialGradient(cx, ly, 1, cx, ly, r * 3);
        g.addColorStop(0, U.rgba(cols[i], 0.7));
        g.addColorStop(1, U.rgba(cols[i], 0));
        ctx.fillStyle = g;
        circle(ctx, cx, ly, r * 3);
        ctx.fill();
      }
      ctx.fillStyle = i === lit ? cols[i] : U.rgba(cols[i], 0.22);
      circle(ctx, cx, ly, r);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, ly, r + 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  }
  // a signal box hanging from the tunnel roof (thorny: touching it crashes the bike)
  function signalBox(ctx, x, y, w, h, t, seed) {
    const bx = x + 8, bw = w - 16, by = y + Math.min(h * 0.3, 46), bh = y + h - by;
    ctx.fillStyle = TL('#2f3238');
    ctx.fillRect(bx + bw * 0.25 - 3, y - 6, 6, by - y + 8);
    ctx.fillRect(bx + bw * 0.75 - 3, y - 6, 6, by - y + 8);
    rr(ctx, bx, by, bw, bh, 9);
    ctx.fillStyle = TL('#17191d');
    ctx.fill();
    lamps(ctx, bx + bw / 2, by + 6, by + bh - 16, Math.min(12, bw * 0.2), t, seed);
    ctx.save();
    rr(ctx, bx, by, bw, bh, 9);
    ctx.clip();
    for (let xx = bx - 10, k = 0; xx < bx + bw + 10; xx += 10, k++) {
      ctx.fillStyle = k % 2 ? '#111' : '#f2c230';
      ctx.fillRect(xx, by + bh - 10, 10, 10);
    }
    ctx.restore();
    rr(ctx, bx, by, bw, bh, 9);
    ctx.strokeStyle = '#ffcf70';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // a signal on a post sticking up from the track bed (thorny too)
  function signalPost(ctx, x, y, w, h, t, seed) {
    const b = y + h, cx = x + w / 2, hh = Math.min(96, h * 0.45);
    ctx.fillStyle = TL('#4a4e56');
    ctx.fillRect(cx - 6, y + hh, 12, h - hh);
    for (let yy = b - 36, k = 0; yy < b; yy += 9, k++) {
      ctx.fillStyle = k % 2 ? '#111' : '#f2c230';
      ctx.fillRect(cx - 6, yy, 12, 9);
    }
    ctx.strokeStyle = '#ffcf70';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 6, y + hh, 12, h - hh);
    rr(ctx, x + 5, y, w - 10, hh, 9);
    ctx.fillStyle = TL('#17191d');
    ctx.fill();
    lamps(ctx, cx, y + 4, y + hh - 4, Math.min(10, (w - 10) * 0.28), t, seed + 1);
    rr(ctx, x + 5, y, w - 10, hh, 9);
    ctx.strokeStyle = '#ffcf70';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const METRO_BLOCKS = {
    train: (ctx, x, y, w, h, bs, seed, t) => train(ctx, x, y, w, h, bs, seed, t),
    vent: (ctx, x, y, w, h) => vent(ctx, x, y, w, h),
    gate: (ctx, x, y, w, h, bs, seed, t) => gate(ctx, x, y, w, h, seed, t),
    luggage: (ctx, x, y, w, h, bs, seed) => luggage(ctx, x, y, w, h, bs, seed),
    pipe: (ctx, x, y, w, h, bs, seed) => sewerPipe(ctx, x, y, w, h, bs, seed),
    barrel: (ctx, x, y, w, h, bs, seed, t) => barrel(ctx, x, y, w, h, seed, t),
    grate: (ctx, x, y, w, h, bs, seed, t) => grating(ctx, x, y, w, h, seed, t),
    beam: (ctx, x, y, w, h) => beam(ctx, x, y, w, h),
    signal: (ctx, x, y, w, h, bs, seed, t) => signalBox(ctx, x, y, w, h, t, seed),
    signalpost: (ctx, x, y, w, h, bs, seed, t) => signalPost(ctx, x, y, w, h, t, seed),
    crocL: (ctx, x, y, w, h, bs, seed, t) => crocBody(ctx, x, y, w, h, false, t, seed),
    crocR: (ctx, x, y, w, h, bs, seed, t) => crocBody(ctx, x, y, w, h, true, t, seed),
  };

  // ---------- scenery: Sergels torg ----------
  function tLogo(ctx, x, y, r) {
    ctx.fillStyle = '#ffffff';
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.fillStyle = '#1f5fb4';
    circle(ctx, x, y, r * 0.86);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - r * 0.52, y - r * 0.5, r * 1.04, r * 0.24);
    ctx.fillRect(x - r * 0.13, y - r * 0.5, r * 0.26, r * 1.1);
  }
  // the blue T of the Stockholm subway, up on its pole
  near.tsign = function (ctx, x, base) {
    ctx.fillStyle = T('#3a3f47');
    ctx.fillRect(x - 4, base - 190, 8, 190);
    tLogo(ctx, x, base - 212, 30);
  };
  // the subway entrance: a stone pavilion with the escalators going down (Vippe runs in through the opening)
  near.tbana = function (ctx, x, base, d, t, bs, font) {
    const w = 16 * bs, h = 400;
    ctx.fillStyle = T('#8d9299');
    ctx.fillRect(x, base - h, w, h);
    ctx.fillStyle = T('#7b8088');
    for (let yy = base - h + 100; yy < base; yy += 40) ctx.fillRect(x, yy, w, 3);
    ctx.fillStyle = T('#15335c');
    ctx.fillRect(x, base - h, w, 78);
    tLogo(ctx, x + 64, base - h + 39, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '44px ' + font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('TUNNELBANA', x + 110, base - h + 41);
    // the ticket hall windows
    for (let wx = x + 8.4 * bs; wx < x + w - 60; wx += 112) {
      ctx.fillStyle = T('#a9c3dc');
      ctx.fillRect(wx, base - 290, 84, 210);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(wx + 8, base - 284, 10, 196);
      ctx.strokeStyle = T('#3a3f47');
      ctx.lineWidth = 5;
      ctx.strokeRect(wx, base - 290, 84, 210);
    }
    // the way in: escalators going down into the light
    const ox = x + 1.4 * bs, ow = 6.2 * bs, oh = 240;
    const g = ctx.createLinearGradient(0, base - oh, 0, base);
    g.addColorStop(0, '#19202e');
    g.addColorStop(1, '#4a5d7e');
    ctx.fillStyle = g;
    ctx.fillRect(ox, base - oh, ow, oh);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const u = ((k / 14 + t * 0.12) % 1);
      const sxp = ox + u * ow, syp = base - oh * 0.72 + u * oh * 0.72;
      ctx.moveTo(sxp, syp);
      ctx.lineTo(sxp + 18, syp);
    }
    ctx.moveTo(ox, base - oh * 0.8);
    ctx.lineTo(ox + ow, base - oh * 0.08);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,220,0.6)';
    for (let k = 0; k < 4; k++) ctx.fillRect(ox + 30 + k * 70, base - oh + 10, 40, 5);
    // the glass canopy over the doorway
    ctx.fillStyle = 'rgba(200,228,255,0.55)';
    ctx.fillRect(ox - 24, base - oh - 18, ow + 48, 16);
    ctx.strokeStyle = T('#3a3f47');
    ctx.lineWidth = 4;
    ctx.strokeRect(ox - 24, base - oh - 18, ow + 48, 16);
    ctx.strokeRect(ox, base - oh, ow, oh);
  };
  near.bollard = function (ctx, x, base) {
    ctx.fillStyle = T('#26292e');
    rr(ctx, x - 12, base - 42, 24, 42, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, base - 42, 16, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x - 8, base - 38, 4, 34);
  };

  // ---------- scenery: T-Centralen and the tunnel (drawn over the subway background) ----------
  // the station name on the wall, SL-style: white letters on dark blue
  near.stationsign = function (ctx, x, base, d, t, bs, font) {
    ctx.font = '34px ' + font;
    const tw = ctx.measureText(d.text).width + 86, y = base - 300;
    ctx.fillStyle = '#10305e';
    rr(ctx, x - tw / 2, y, tw, 58, 6);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    tLogo(ctx, x - tw / 2 + 32, y + 29, 18);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.text, x + 22, y + 31);
  };
  // the next-train display hanging over the platform
  near.display = function (ctx, x, base, d, t, bs, font) {
    const y = base - 350;
    ctx.fillStyle = '#54627a';
    ctx.fillRect(x - 110, 0, 4, y);
    ctx.fillRect(x + 106, 0, 4, y);
    ctx.fillStyle = '#0b0c10';
    rr(ctx, x - 160, y, 320, 78, 6);
    ctx.fill();
    ctx.strokeStyle = '#50607a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = '22px ' + font;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffb020';
    ctx.textAlign = 'left';
    ctx.fillText('13 Storvreta', x - 146, y + 22);
    ctx.fillText('14 Mörby c.', x - 146, y + 54);
    ctx.textAlign = 'right';
    ctx.fillText(Math.floor(t * 0.8) % 2 ? 'Nu' : '1 min', x + 146, y + 22);
    ctx.fillText('7 min', x + 146, y + 54);
  };
  // the station clock
  near.clock = function (ctx, x, base, d, t) {
    const y = base - 380;
    ctx.fillStyle = '#54627a';
    ctx.fillRect(x - 3, 0, 6, y - 30);
    ctx.fillStyle = '#ffffff';
    circle(ctx, x, y, 32);
    ctx.fill();
    ctx.strokeStyle = '#1b1b22';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.moveTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
      ctx.lineTo(x + Math.cos(a) * 27, y + Math.sin(a) * 27);
    }
    ctx.stroke();
    const hand = (a, len, lw, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len);
      ctx.stroke();
    };
    hand(4.1 + t * 0.002, 14, 4, '#1b1b22');
    hand(1.2 + t * 0.02, 22, 3, '#1b1b22');
    hand(Math.floor(t) * (TAU / 60), 24, 1.5, '#d42020');
  };
  // an advert on the platform wall
  near.poster = function (ctx, x, base, d, t, bs, font) {
    const pw = 150, ph = 204, y = base - 262;
    ctx.fillStyle = '#2a2f36';
    rr(ctx, x - pw / 2 - 9, y - 9, pw + 18, ph + 18, 5);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - pw / 2, y, pw, ph);
    ctx.clip();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (d.seed === 1) {
      // a film poster starring Vippe himself
      const g = ctx.createLinearGradient(0, y, 0, y + ph);
      g.addColorStop(0, '#ff8a3a');
      g.addColorStop(1, '#c2185b');
      ctx.fillStyle = g;
      ctx.fillRect(x - pw / 2, y, pw, ph);
      ctx.save();
      ctx.translate(x, y + 92);
      Art.cube(ctx, 64, 'grin', 'red', 0);
      ctx.restore();
      ctx.fillStyle = '#ffe14a';
      ctx.font = '26px ' + font;
      ctx.fillText('VIPPE DASH', x, y + 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px ' + font;
      ctx.fillText('NU PÅ BIO!', x, y + ph - 26);
    } else {
      // fika: an ad for cinnamon buns
      ctx.fillStyle = '#f7e6c4';
      ctx.fillRect(x - pw / 2, y, pw, ph);
      for (const [bx, by, br] of [[x - 30, y + 110, 30], [x + 34, y + 124, 24], [x + 4, y + 158, 20]]) {
        ctx.fillStyle = '#c98a45';
        circle(ctx, bx, by, br);
        ctx.fill();
        ctx.strokeStyle = '#7a4a1e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let a = 0; a < 12; a += 0.3) ctx.lineTo(bx + Math.cos(a) * a * br * 0.075, by + Math.sin(a) * a * br * 0.075);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 5; k++) ctx.fillRect(bx - br * 0.6 + k * br * 0.3, by - br * 0.4 + ((k * 7) % 5), 3, 3);
      }
      ctx.fillStyle = '#7a4a1e';
      ctx.font = '34px ' + font;
      ctx.fillText('FIKA?', x, y + 42);
    }
    ctx.restore();
  };
  // a running-man sign (exit / emergency exit)
  function exitSign(ctx, x, y, text, font, hang, t) {
    ctx.font = '24px ' + font;
    const tw = ctx.measureText(text).width + 70;
    if (hang) {
      ctx.fillStyle = '#54627a';
      ctx.fillRect(x - tw / 2 + 20, 0, 4, y);
      ctx.fillRect(x + tw / 2 - 24, 0, 4, y);
    }
    const g = ctx.createRadialGradient(x, y + 24, 4, x, y + 24, tw * 0.7);
    g.addColorStop(0, 'rgba(60,255,120,' + (0.18 + 0.05 * Math.sin(t * 3)) + ')');
    g.addColorStop(1, 'rgba(60,255,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - tw, y - 40, tw * 2, 130);
    ctx.fillStyle = '#138a3e';
    rr(ctx, x - tw / 2, y, tw, 48, 6);
    ctx.fill();
    ctx.strokeStyle = '#e8fff0';
    ctx.lineWidth = 2;
    ctx.stroke();
    // the running man
    const mx = x - tw / 2 + 24, my = y + 24;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    circle(ctx, mx + 3, my - 13, 3.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mx + 1, my - 8);
    ctx.lineTo(mx - 2, my + 3);
    ctx.lineTo(mx - 8, my + 12);
    ctx.moveTo(mx - 2, my + 3);
    ctx.lineTo(mx + 5, my + 6);
    ctx.lineTo(mx + 4, my + 13);
    ctx.moveTo(mx - 7, my - 3);
    ctx.lineTo(mx + 1, my - 6);
    ctx.lineTo(mx + 8, my - 1);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x - tw / 2 + 42, y + 26);
  }
  near.exit = function (ctx, x, base, d, t, bs, font) {
    exitSign(ctx, x, base - 380, 'UTGÅNG →', font, true, t);
  };
  near.nodutgang = function (ctx, x, base, d, t, bs, font) {
    exitSign(ctx, x, base - 250, 'NÖDUTGÅNG', font, false, t);
  };
  // warning on the tunnel wall: danger, live rail
  near.voltage = function (ctx, x, base, d, t, bs, font) {
    const y = base - 230;
    ctx.fillStyle = '#f2c230';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    tri(ctx, x - 40, y + 70, x, y, x + 40, y + 70);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 18);
    ctx.lineTo(x - 10, y + 44);
    ctx.lineTo(x + 1, y + 44);
    ctx.lineTo(x - 6, y + 62);
    ctx.lineTo(x + 12, y + 36);
    ctx.lineTo(x + 1, y + 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(ctx, x - 58, y + 80, 116, 32, 4);
    ctx.fill();
    ctx.fillStyle = '#d42020';
    ctx.font = '20px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIVSFARA!', x, y + 97);
  };
  // a signal lamp on the tunnel wall
  near.signallamp = function (ctx, x, base, d, t) {
    const y = base - 210;
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(x - 3, y + 60, 6, 150);
    rr(ctx, x - 16, y, 32, 64, 8);
    ctx.fillStyle = '#111317';
    ctx.fill();
    const green = Math.floor(t / 3) % 2 === 0;
    for (const [ly, col, on] of [[y + 18, '#ff3b30', !green], [y + 46, '#3cff78', green]]) {
      if (on) {
        const g = ctx.createRadialGradient(x, ly, 1, x, ly, 40);
        g.addColorStop(0, U.rgba(col, 0.6));
        g.addColorStop(1, U.rgba(col, 0));
        ctx.fillStyle = g;
        circle(ctx, x, ly, 40);
        ctx.fill();
      }
      ctx.fillStyle = on ? col : U.rgba(col, 0.2);
      circle(ctx, x, ly, 9);
      ctx.fill();
    }
  };
  // RASRISK: the tunnel is about to cave in
  near.rasrisk = function (ctx, x, base, d, t, bs, font) {
    const y = base - 250;
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(x - 3, y + 60, 6, 190);
    ctx.save();
    ctx.translate(x, y + 30);
    ctx.rotate(-0.12 + Math.sin(t * 7) * 0.02);
    ctx.fillStyle = '#f2c230';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    rr(ctx, -80, -30, 160, 60, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = '30px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RASRISK!', 0, 2);
    ctx.restore();
    // cracks up the tunnel wall
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    const r = U.rng(5);
    for (let k = 0; k < 3; k++) {
      let cx = x + 100 + k * 90, cy = base;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      while (cy > base - 240) {
        cy -= 14 + r() * 20;
        cx += (r() - 0.5) * 26;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  };
  // the end of the line: a buffer stop with a red lamp (past the hole, on the floor above the sewer)
  near.bufferstop = function (ctx, x, base) {
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(x - 4, base - 70, 90, 70);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 14, base - 104, 30, 70);
    ctx.clip();
    for (let yy = base - 110, k = 0; yy < base - 30; yy += 14, k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : '#d42020';
      ctx.fillRect(x - 14, yy, 30, 14);
    }
    ctx.restore();
    ctx.fillStyle = '#ff3b30';
    circle(ctx, x + 1, base - 118, 8);
    ctx.fill();
    const g = ctx.createRadialGradient(x + 1, base - 118, 2, x + 1, base - 118, 60);
    g.addColorStop(0, 'rgba(255,59,48,0.5)');
    g.addColorStop(1, 'rgba(255,59,48,0)');
    ctx.fillStyle = g;
    circle(ctx, x + 1, base - 118, 60);
    ctx.fill();
  };

  // ---------- scenery: the sewer ----------
  // rubble from the roof, piled up where Vippe lands
  near.rubble = function (ctx, x, base, d, t, bs) {
    const r = U.rng(31);
    for (let k = 0; k < 14; k++) {
      const px = x + r() * bs * 4.5, s = 8 + r() * 16, py = base - r() * 14 - s * 0.3;
      ctx.fillStyle = k % 3 ? '#5d5750' : '#7a5a40';
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(r() * 3);
      ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
      ctx.restore();
    }
  };
  // an iron ladder up the wall to a manhole, a little daylight showing round the lid
  near.ladder = function (ctx, x, base) {
    ctx.fillStyle = 'rgba(255,240,200,0.12)';
    ctx.beginPath();
    ctx.moveTo(x - 30, 60);
    ctx.lineTo(x + 30, 60);
    ctx.lineTo(x + 70, base);
    ctx.lineTo(x - 70, base);
    ctx.fill();
    ctx.fillStyle = '#2a2d26';
    ctx.fillRect(x - 36, 44, 72, 18);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(x - 32, 44, 64, 3);
    ctx.strokeStyle = '#6b5a44';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 18, 62);
    ctx.lineTo(x - 18, base - 20);
    ctx.moveTo(x + 18, 62);
    ctx.lineTo(x + 18, base - 20);
    for (let yy = 90; yy < base - 20; yy += 32) {
      ctx.moveTo(x - 18, yy);
      ctx.lineTo(x + 18, yy);
    }
    ctx.stroke();
  };
  // a pipe in the wall, pouring sludge down into the channel
  near.outfall = function (ctx, x, base, d, t) {
    const y = base - 230;
    ctx.fillStyle = '#1b1e17';
    circle(ctx, x, y, 34);
    ctx.fill();
    ctx.strokeStyle = '#5a4a36';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.fillStyle = '#080a07';
    circle(ctx, x, y, 26);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y + 10, 0, base);
    g.addColorStop(0, 'rgba(140,150,60,0.9)');
    g.addColorStop(1, 'rgba(110,120,50,0.4)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 18, y + 12);
    ctx.quadraticCurveTo(x + 6, y + 30, x + 10, base);
    ctx.lineTo(x + 30, base);
    ctx.quadraticCurveTo(x + 22, y + 34, x + 16, y + 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,220,120,0.7)';
    for (let k = 0; k < 5; k++) {
      const u = (t * 1.3 + k * 0.2) % 1;
      ctx.fillRect(x + 14 + Math.sin(k) * 4, y + 20 + u * (base - y - 30), 3, 8);
    }
    for (let k = 0; k < 3; k++) {
      const u = (t * 2 + k * 0.33) % 1;
      ctx.strokeStyle = 'rgba(175,205,75,' + (1 - u) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + 20, base - 4, 8 + u * 22, 2 + u * 3, 0, Math.PI, TAU);
      ctx.stroke();
    }
  };
  // a street grating in the roof, with daylight falling through it
  near.grate = function (ctx, x, base, d, t) {
    const g = ctx.createLinearGradient(0, 60, 0, base);
    g.addColorStop(0, 'rgba(255,244,210,0.3)');
    g.addColorStop(1, 'rgba(255,244,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 40, 60);
    ctx.lineTo(x + 40, 60);
    ctx.lineTo(x + 160, base);
    ctx.lineTo(x + 20, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1b1e17';
    ctx.fillRect(x - 46, 46, 92, 16);
    ctx.fillStyle = '#ffeab8';
    for (let k = 0; k < 6; k++) ctx.fillRect(x - 40 + k * 14, 48, 8, 12);
    ctx.fillStyle = 'rgba(255,245,215,0.7)';
    for (let k = 0; k < 10; k++) {
      const u = (t * 0.12 + U.hash(k * 3.3 + d.x)) % 1;
      ctx.fillRect(x - 30 + u * 150 + U.hash(k) * 40, 70 + u * (base - 90), 2, 2);
    }
  };
  // the way out: the sewer's outlet through the stone quay wall, seen from outside (d.mouth: see cavehill)
  near.culvert = function (ctx, x, base, d, t, bs) {
    const w = (d.w || 14) * bs, h = 340;
    const mx = x + (d.mouth == null ? w / bs - 5.4 : d.mouth) * bs, mw = 5.4 * bs, mh = 250;
    ctx.fillStyle = T('#7d776c');
    ctx.fillRect(x - 40, base - h, w + 40, h);
    ctx.strokeStyle = T('#5f5a51');
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let r = 0, yy = base - h + 38; yy < base; yy += 38, r++) {
      ctx.moveTo(x - 40, yy);
      ctx.lineTo(x + w, yy);
      for (let xx = x - 40 + (r % 2) * 40; xx < x + w; xx += 80) {
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, yy - 38);
      }
    }
    ctx.stroke();
    // railing on top
    ctx.strokeStyle = T('#2a2d33');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 40, base - h - 40);
    ctx.lineTo(x + w, base - h - 40);
    for (let xx = x - 30; xx < x + w; xx += 44) {
      ctx.moveTo(xx, base - h);
      ctx.lineTo(xx, base - h - 40);
    }
    ctx.stroke();
    // the round outlet, its old grating bent open
    ctx.fillStyle = T('#6a5040');
    archFill(ctx, mx - 16, base, mw + 32, mh + 16);
    const g = ctx.createLinearGradient(0, base - mh, 0, base);
    g.addColorStop(0, '#0b0d09');
    g.addColorStop(1, '#232a1a');
    ctx.fillStyle = g;
    archFill(ctx, mx, base, mw, mh);
    ctx.strokeStyle = T('#2a2d33');
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const bx = mx + 20 + k * 14;
      ctx.moveTo(bx, base - mh + 40 + k * 8);
      ctx.quadraticCurveTo(bx - 20, base - mh * 0.5, bx - 40 + k * 4, base - 30);
    }
    ctx.stroke();
    // sludge trickling out onto the quay
    ctx.fillStyle = 'rgba(120,130,55,0.75)';
    ctx.fillRect(mx, base - 8, mw + 60, 8);
  };
  function archFill(ctx, x, base, w, h) {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - h + w / 2);
    ctx.arc(x + w / 2, base - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, base);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- mid-layer landmarks: Stockholm ----------
  // Sergels torg: the tall glass obelisk in its fountain, Kulturhuset's glass front behind it
  mid.obelisk = function (ctx, x, base, d, t) {
    ctx.fillStyle = T('#8d949c');
    ctx.fillRect(x + 20, base - 130, 330, 130);
    ctx.fillStyle = T('#b9cfe0');
    for (let yy = base - 122; yy < base - 10; yy += 28) ctx.fillRect(x + 26, yy, 318, 18);
    ctx.fillStyle = T('#6f7a86');
    ctx.beginPath();
    ctx.ellipse(x - 20, base - 4, 110, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = T('#7fb0cf');
    ctx.beginPath();
    ctx.ellipse(x - 20, base - 6, 96, 9, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createLinearGradient(x - 40, 0, x, 0);
    g.addColorStop(0, T('#d6f0ff'));
    g.addColorStop(1, T('#7fb4d8'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 38, base - 8);
    ctx.lineTo(x - 30, base - 300);
    ctx.lineTo(x - 10, base - 300);
    ctx.lineTo(x - 2, base - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let yy = base - 290; yy < base - 20; yy += 22) ctx.fillRect(x - 32 + (yy % 3), yy, 26, 2);
  };
  // Stadshuset, the city hall, across the water: red brick and a tall tower with three gold crowns
  mid.stadshuset = function (ctx, x, base, d, t) {
    const brick = T('#9c4a32'), dark = T('#7a3524'), copper = T('#5f9e84'), gold = T('#f2c230');
    ctx.fillStyle = brick;
    ctx.fillRect(x - 250, base - 118, 400, 118);
    ctx.fillStyle = copper;
    ctx.fillRect(x - 256, base - 128, 412, 12);
    ctx.fillStyle = dark;
    for (let wx = x - 236; wx < x + 140; wx += 26) ctx.fillRect(wx, base - 96, 10, 20);
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      ctx.arc(x - 220 + k * 50, base - 26, 16, Math.PI, 0);
      ctx.lineTo(x - 204 + k * 50, base);
      ctx.lineTo(x - 236 + k * 50, base);
      ctx.fill();
    }
    // the tower
    const tx = x + 96;
    ctx.fillStyle = brick;
    ctx.fillRect(tx - 30, base - 330, 60, 330);
    ctx.fillStyle = dark;
    for (let yy = base - 310; yy < base - 140; yy += 36) ctx.fillRect(tx - 6, yy, 12, 22);
    ctx.fillStyle = T('#e9dfc8');
    ctx.fillRect(tx - 34, base - 336, 68, 8);
    ctx.fillStyle = copper;
    ctx.beginPath();
    ctx.moveTo(tx - 22, base - 336);
    ctx.lineTo(tx - 16, base - 380);
    ctx.lineTo(tx + 16, base - 380);
    ctx.lineTo(tx + 22, base - 336);
    ctx.fill();
    ctx.fillRect(tx - 4, base - 404, 8, 26);
    // the three crowns
    ctx.fillStyle = gold;
    for (const [cx, cy] of [[tx - 10, base - 404], [tx + 10, base - 404], [tx, base - 420]]) {
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy + 5);
      ctx.lineTo(cx - 7, cy - 4);
      ctx.lineTo(cx - 3.5, cy);
      ctx.lineTo(cx, cy - 6);
      ctx.lineTo(cx + 3.5, cy);
      ctx.lineTo(cx + 7, cy - 4);
      ctx.lineTo(cx + 7, cy + 5);
      ctx.closePath();
      ctx.fill();
    }
    if (Art.dark() > 0.1) {
      ctx.fillStyle = 'rgba(255,214,130,0.8)';
      for (let wx = x - 236; wx < x + 140; wx += 52) ctx.fillRect(wx, base - 96, 10, 20);
    }
  };
})();
