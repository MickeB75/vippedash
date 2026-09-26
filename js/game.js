// VippeDash — game loop, input, checkpoints, menus
(function () {
  const VD = (window.VD = window.VD || {});
  const P = VD.PHYS, Ph = VD.Physics, R = VD.Render, AU = VD.Audio, Art = VD.Art, U = VD.U;
  const G = (VD.Game = { particles: [], clock: 0, flash: 0, shake: 0, held: false, tickN: 0 });

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('vippedash.' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('vippedash.' + k, JSON.stringify(v));
      } catch (e) {
        /* storage unavailable: ignore */
      }
    },
  };

  const $ = (id) => document.getElementById(id);

  G.init = function () {
    G.lvl = VD.buildLevel();
    R.init($('game'));
    R.build(G.lvl);
    G.skin = store.get('skin', 'red');
    if (!Art.SKINS[G.skin]) G.skin = 'red';
    G.best = store.get('best', 0);
    G.wins = store.get('wins', 0);
    AU.muted = store.get('muted', false);
    G.debug = /debug/.test(location.hash + location.search);
    G.state = 'menu';
    G.camX = -4;
    G.ev = [];
    bindInput();
    bindUI();
    refreshMenu();
    G.last = performance.now();
    requestAnimationFrame(loop);
  };

  // ------------------------------------------------------------------ input
  const JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter', 'NumpadEnter']);
  const keysDown = new Set();
  const pointers = new Set();
  function updateHeld() {
    G.held = keysDown.size > 0 || pointers.size > 0;
  }
  function releaseAll() {
    keysDown.clear();
    pointers.clear();
    updateHeld();
  }

  function bindInput() {
    addEventListener('keydown', (e) => {
      if (JUMP.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (G.state === 'play') G.pause();
        else if (G.state === 'paused') G.resume();
        return;
      }
      if (e.code === 'KeyM') return toggleMute();
      if (JUMP.has(e.code)) {
        if (G.state === 'menu') return G.start();
        if (G.state === 'won') return G.start();
        if (G.state === 'paused') return G.resume();
        keysDown.add(e.code);
        updateHeld();
        G.tapQueued = true;
        return;
      }
      if (G.debug) debugKey(e);
    });
    addEventListener('keyup', (e) => {
      if (JUMP.has(e.code)) e.preventDefault(); // Space must never "click" a focused button
      keysDown.delete(e.code);
      updateHeld();
    });
    // buttons give focus back to the game so Space/Enter keep meaning "jump"
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b) b.blur();
    });
    const cv = $('game');
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const lx = ((e.clientX - r.left) / r.width) * R.W, ly = ((e.clientY - r.top) / r.height) * R.H;
      if (lx > R.W - 70 && ly < 66 && G.state === 'play') return G.pause();
      if (G.state !== 'play' && G.state !== 'dead') return;
      pointers.add(e.pointerId);
      updateHeld();
      G.tapQueued = true;
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      updateHeld();
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    addEventListener('blur', () => {
      releaseAll();
      if (G.state === 'play') G.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.state === 'play') G.pause();
    });
  }

  function debugKey(e) {
    const cps = G.lvl.checkpoints;
    if (G.state !== 'play' && G.state !== 'dead') return;
    if (/^Digit\d$/.test(e.code)) {
      const n = +e.code.slice(5);
      warp(e.shiftKey ? n + 10 : n);
    } else if (e.code === 'BracketRight') warp(Math.min(cps.length - 1, G.cpIndex + 1));
    else if (e.code === 'BracketLeft') warp(Math.max(0, G.cpIndex - 1));
    else if (e.code === 'KeyG') G.god = !G.god;
    else if (e.code === 'KeyB') {
      G.bot = !G.bot;
      if (G.bot) computeBot(G.s);
    }
  }
  function warp(i) {
    if (i < 0 || i >= G.lvl.checkpoints.length) return;
    G.cpIndex = i;
    G.respawn();
  }
  function computeBot(fromState) {
    const res = VD.Solver.solve(G.lvl, Ph.clone(fromState), G.lvl.finishX + 1, { k: 4, maxNodes: 3000000 });
    G.botPath = res.ok ? res.path : null;
    G.botTick = 0;
  }

  // ------------------------------------------------------------------ UI
  function bindUI() {
    $('play').onclick = () => G.start();
    $('resume').onclick = () => G.resume();
    $('restart').onclick = () => G.start();
    $('menuBtn').onclick = () => G.toMenu();
    $('again').onclick = () => G.start();
    $('winMenu').onclick = () => G.toMenu();
    $('mute').onclick = (e) => {
      e.stopPropagation();
      toggleMute();
    };
    const box = $('skins');
    for (const id of Object.keys(Art.SKINS)) {
      const b = document.createElement('button');
      b.className = 'skin';
      b.dataset.skin = id;
      b.title = Art.SKINS[id].name;
      const c = document.createElement('canvas');
      c.width = c.height = 72;
      const x = c.getContext('2d');
      x.translate(36, 40);
      Art.setDark(0);
      Art.cube(x, 44, 'grin', id, 0);
      b.appendChild(c);
      const l = document.createElement('span');
      l.textContent = Art.SKINS[id].name;
      b.appendChild(l);
      b.onclick = () => {
        G.skin = id;
        store.set('skin', id);
        AU.init();
        AU.sfx('click');
        refreshMenu();
      };
      box.appendChild(b);
    }
    updateMuteIcon();
  }
  function refreshMenu() {
    for (const b of document.querySelectorAll('.skin')) b.classList.toggle('on', b.dataset.skin === G.skin);
    $('best').textContent = G.wins > 0 ? 'Completed ' + G.wins + (G.wins === 1 ? ' time' : ' times') + ' · best 100%' : G.best > 0 ? 'Best: ' + G.best + '%' : '';
  }
  function show(id, on) {
    $(id).classList.toggle('hidden', !on);
  }
  function toggleMute() {
    AU.setMuted(!AU.muted);
    store.set('muted', AU.muted);
    updateMuteIcon();
  }
  function updateMuteIcon() {
    $('mute').textContent = AU.muted ? '🔇' : '🔊';
  }

  // ------------------------------------------------------------------ states
  G.start = function () {
    AU.init();
    show('menu', false);
    show('pause', false);
    show('win', false);
    G.cpIndex = 0;
    G.attempts = 0;
    G.deaths = 0;
    G.runTime = 0;
    G.seen = {};
    G.areaIdx = -1;
    G.particles = [];
    G.banner = null;
    releaseAll();
    G.respawn();
  };

  G.respawn = function () {
    const cp = G.lvl.checkpoints[G.cpIndex];
    G.s = Ph.spawn(cp);
    G.attempts++;
    G.attemptText = { x: cp.x, n: G.attempts };
    G.vis = { rot: 0, wheel: 0, oT: 0 };
    G.state = 'play';
    G.acc = 0;
    G.tickN = 0;
    G.ignoreHeld = G.held;
    G.tapQueued = false;
    G.camX = G.s.x - R.PX;
    G.flash = 0.25;
    AU.startMusic(cp.x / P.SPEED);
    if (G.bot) computeBot(G.s);
  };

  G.pause = function () {
    if (G.state !== 'play') return;
    G.state = 'paused';
    AU.stopMusic(0.05);
    releaseAll();
    show('pause', true);
  };
  G.resume = function () {
    if (G.state !== 'paused') return;
    show('pause', false);
    G.state = 'play';
    G.acc = 0;
    G.last = performance.now();
    G.ignoreHeld = G.held;
    AU.startMusic(G.s.x / P.SPEED);
  };
  G.toMenu = function () {
    AU.stopMusic(0.1);
    show('pause', false);
    show('win', false);
    show('menu', true);
    G.state = 'menu';
    G.camX = -4;
    G.s = null;
    refreshMenu();
  };

  function die() {
    G.state = 'dead';
    G.deadAge = 0;
    G.deaths++;
    G.shake = 0.3;
    AU.stopMusic(0.08);
    AU.sfx('death');
    const s = G.s, ph = Ph.boxH(s);
    const cx = s.x + 0.5, cy = s.y + ph / 2;
    const k = Art.SKINS[G.skin];
    const cols = [k.main, '#f2c6a0', '#6b4526', '#ffffff', '#ffd634'];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 10;
      particle({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, size: 6 + Math.random() * 10, color: cols[i % cols.length], grav: 12 });
    }
    particle({ x: cx, y: cy, life: 0.45, size: 90, color: '#ffffff', ring: true });
    const pct = Math.floor(U.clamp(s.x / G.lvl.finishX, 0, 1) * 100);
    if (pct > G.best) {
      G.best = pct;
      store.set('best', pct);
    }
  }

  function win() {
    G.state = 'winning';
    G.winAge = 0;
    G.fwT = 0;
    AU.sfx('win');
    G.best = 100;
    G.wins++;
    store.set('best', 100);
    store.set('wins', G.wins);
    G.finalTime = G.runTime;
    G.flash = 0.5;
  }

  function showWin() {
    G.state = 'won';
    const m = Math.floor(G.finalTime / 60), sec = Math.floor(G.finalTime % 60);
    $('stats').innerHTML =
      '<div><b>' + G.attempts + '</b><span>attempts</span></div>' +
      '<div><b>' + G.deaths + '</b><span>crashes</span></div>' +
      '<div><b>' + m + ':' + ('0' + sec).slice(-2) + '</b><span>time</span></div>';
    show('win', true);
  }

  // ------------------------------------------------------------------ simulation
  function tick() {
    const s = G.s;
    if (G.ignoreHeld && !G.held) G.ignoreHeld = false;
    let held = (G.held && !G.ignoreHeld) || G.tapQueued;
    G.tapQueued = false;
    if (G.bot && G.botPath) held = !!G.botPath[Math.floor(G.botTick++ / 4)];
    G.ev.length = 0;
    const wasGrounded = s.grounded, prevMode = s.mode;
    Ph.step(s, held, G.lvl, G.ev);
    if (s.dead && G.god) s.dead = false;
    for (const e of G.ev) onEvent(e);
    if (s.mode !== prevMode) G.vis.rot = 0;
    visuals(s, wasGrounded);
    if (s.dead) return die();
    const cps = G.lvl.checkpoints;
    while (G.cpIndex + 1 < cps.length && s.x >= cps[G.cpIndex + 1].x) {
      G.cpIndex++;
      onCheckpoint(cps[G.cpIndex]);
    }
    const a = G.lvl.areaAt(s.x);
    if (a.index !== G.areaIdx) {
      G.areaIdx = a.index;
      if (!G.seen[a.index]) {
        G.seen[a.index] = true;
        G.banner = { name: a.name, sub: a.sub, t: 0 };
      }
    }
    G.camX = s.x - R.PX;
    if (s.x >= G.lvl.finishX) win();
  }

  function onEvent(e) {
    const s = G.s, ph = Ph.boxH(s);
    if (e === 'pad' || e === 'orb') {
      AU.sfx(e);
      G.vis.oT = 0.45;
      particle({ x: s.x + 0.5, y: s.y + ph / 2, life: 0.35, size: 50, color: '#ffd634', ring: true });
    } else if (e === 'portal') {
      AU.sfx('portal');
      G.flash = 0.35;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        particle({ x: s.x + 0.5, y: s.y + ph / 2, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 0.5, size: 6, color: s.mode === 'ship' ? '#ff4fd8' : s.mode === 'ball' ? '#ff8a1f' : '#3cff78' });
      }
    } else if (e === 'flip') {
      for (let i = 0; i < 5; i++) particle({ x: s.x + 0.5, y: s.gdir > 0 ? s.y : s.y + 1, vx: -3 - Math.random() * 3, vy: (Math.random() - 0.5) * 3, life: 0.3, size: 5, color: '#ffffff' });
    }
  }

  function onCheckpoint(cp) {
    AU.sfx('checkpoint');
    for (let i = 0; i < 18; i++) {
      particle({ x: cp.x + 0.5, y: 2.3, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 6, life: 0.9, size: 7, color: i % 2 ? '#006aa7' : '#fecc00', grav: 14 });
    }
  }

  function visuals(s, wasGrounded) {
    const v = G.vis, dt = P.DT;
    if (v.oT > 0) v.oT -= dt;
    if (s.mode === 'cube') {
      if (!s.grounded) v.rot += 7.1 * dt;
      else {
        const q = Math.PI / 2, target = Math.round(v.rot / q) * q;
        v.rot += (target - v.rot) * 0.35;
      }
      if (s.grounded && !wasGrounded) for (let i = 0; i < 5; i++) particle({ x: s.x + Math.random(), y: s.y, vx: -2 - Math.random() * 3, vy: 1 + Math.random() * 2, life: 0.3, size: 5, color: 'rgba(255,255,255,0.8)' });
      if (s.grounded && G.tickN % 8 === 0) particle({ x: s.x, y: s.y + 0.08, vx: -2, vy: 0.6 + Math.random(), life: 0.35, size: 5, color: 'rgba(255,255,255,0.7)' });
    } else if (s.mode === 'ship') {
      const a = -Math.atan2(s.vy, P.SPEED) * 0.85;
      v.rot += (a - v.rot) * 0.15;
      v.wheel += dt * 16;
      if (G.tickN % 3 === 0) particle({ x: s.x - 0.15, y: s.y + 0.2, vx: -4 - Math.random() * 2, vy: (Math.random() - 0.5) * 1.5, life: 0.35, size: 6, color: Math.random() < 0.5 ? '#ffb02e' : '#ff6a2e', round: true });
    } else {
      v.rot += ((s.gdir < 0 ? 1 : -1) * P.SPEED * dt) / 0.5;
      if (s.grounded && G.tickN % 8 === 0) particle({ x: s.x + 0.2, y: s.gdir < 0 ? s.y + 0.05 : s.y + 0.95, vx: -2, vy: 0, life: 0.3, size: 5, color: 'rgba(255,255,255,0.7)' });
    }
  }

  function particle(p) {
    p.vx = p.vx || 0;
    p.vy = p.vy || 0;
    p.max = p.life;
    if (G.particles.length < 400) G.particles.push(p);
  }
  function updateParticles(dt) {
    const ps = G.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.grav) p.vy -= p.grav * dt;
      p.life -= dt;
      if (p.life <= 0) ps.splice(i, 1);
    }
  }
  function firework() {
    const x = G.camX + 12 + Math.random() * 12, y = 5 + Math.random() * 4.5;
    const cols = ['#ffd634', '#ff5fd2', '#5cff7a', '#6bc6ff', '#ffffff', '#fecc00', '#006aa7'];
    const c = cols[Math.floor(Math.random() * cols.length)];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2, sp = 4 + Math.random() * 2;
      particle({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9 + Math.random() * 0.4, size: 4, color: c, grav: 4, round: true });
    }
    AU.sfx('firework');
  }

  // ------------------------------------------------------------------ main loop
  function loop(now) {
    let dt = (now - G.last) / 1000;
    G.last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    G.clock += dt;
    G.fps = G.fps ? G.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05 : 60;

    if (G.state === 'play') {
      G.acc += dt;
      G.runTime += dt;
      let n = 0;
      while (G.acc >= P.DT && n < 30) {
        G.acc -= P.DT;
        n++;
        G.tickN++;
        tick();
        if (G.state !== 'play') {
          G.acc = 0;
          break;
        }
      }
      if (G.acc > 0.05) G.acc = 0.05;
    } else if (G.state === 'dead') {
      G.deadAge += dt;
      if (G.deadAge >= 0.9) G.respawn();
    } else if (G.state === 'winning' || G.state === 'won') {
      G.winAge += dt;
      G.s.x += P.SPEED * dt;
      G.vis.rot += 7 * dt;
      G.fwT -= dt;
      if (G.fwT <= 0) {
        firework();
        G.fwT = 0.35 + Math.random() * 0.4;
      }
      if (G.state === 'winning' && G.winAge > 2.4) showWin();
    } else if (G.state === 'menu') {
      G.camX += dt * 5;
      if (G.camX > G.lvl.finishX - 20) G.camX = -4;
      drawHero();
    }
    if (G.banner) G.banner.t += dt;
    G.flash = Math.max(0, G.flash - dt * 2.5);
    G.shake = Math.max(0, G.shake - dt);
    updateParticles(dt);
    if (G.s && (G.state === 'play' || G.state === 'winning' || G.state === 'won')) AU.update(G.s.x / P.SPEED);
    R.draw(G, dt);
    requestAnimationFrame(loop);
  }

  function drawHero() {
    const c = $('hero');
    if (!c || c.offsetParent === null) return;
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const t = G.clock;
    const ph = (t * 1.3) % 1;
    const hop = Math.sin(ph * Math.PI) * 38;
    x.fillStyle = 'rgba(0,0,0,0.25)';
    x.beginPath();
    x.ellipse(c.width / 2, c.height - 22, 50 - hop * 0.5, 9, 0, 0, Math.PI * 2);
    x.fill();
    x.translate(c.width / 2, c.height - 78 - hop);
    x.rotate(U.smooth(ph) * Math.PI * 2);
    Art.setDark(0);
    const faces = ['grin', 'o', 'grin', 'tongue'];
    Art.cube(x, 100, faces[Math.floor(t / 1.54) % faces.length], G.skin, 0);
  }

  addEventListener('load', () => {
    const go = () => G.init();
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load('32px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
    } else go();
  });
})();
