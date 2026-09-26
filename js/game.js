// VippeDash — game loop, input, checkpoints, menus, coins + shop
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
    R.init($('game'));
    G.coins = store.get('coins', 0);
    G.owned = store.get('owned', []);
    G.skin = store.get('skin', 'red');
    if (!Art.SKINS[G.skin] || !owns(G.skin)) G.skin = 'red';
    G.progress = loadProgress();
    AU.muted = store.get('muted', false);
    G.debug = /debug/.test(location.hash + location.search);
    G.state = 'menu';
    G.ev = [];
    selectLevel(store.get('level', VD.LEVELS[0].id));
    bindInput();
    bindUI();
    refreshMenu();
    G.last = performance.now();
    requestAnimationFrame(loop);
  };

  // ------------------------------------------------------------------ levels, progress, coins
  function selectLevel(id) {
    G.levelDef = VD.levelDef(id);
    G.lvl = VD.buildLevel(G.levelDef.id);
    R.build(G.lvl);
    AU.setSong(G.lvl.theme.song);
    store.set('level', G.levelDef.id);
    G.camX = -4;
    G.camV = G.camVT = 0;
  }
  // { levelId: { best: %, wins, fewest: crashes } }. Older saves only had one level's best/wins.
  function loadProgress() {
    let p = store.get('progress', null);
    if (!p) {
      p = {};
      const best = store.get('best', 0), wins = store.get('wins', 0);
      if (best || wins) p.home = { best, wins };
    }
    for (const L of VD.LEVELS) p[L.id] = Object.assign({ best: 0, wins: 0, fewest: null }, p[L.id]);
    return p;
  }
  function saveProgress() {
    store.set('progress', G.progress);
  }
  function owns(id) {
    return Art.SKINS[id].price === 0 || G.owned.indexOf(id) >= 0;
  }
  function addCoins(n) {
    G.coins = Math.max(0, G.coins + n);
    store.set('coins', G.coins);
  }
  // Coins for finishing a level: the level's reward, a crash bonus (the same amount again, minus 10% per crash)
  // and the reward once more the first time you beat it. Harder levels have a bigger reward.
  function levelReward(def, crashes, firstWin) {
    const base = def.reward;
    const bonus = Math.max(0, Math.round(def.reward * (1 - crashes / 10)));
    const first = firstWin ? def.reward : 0;
    return { base, bonus, first, total: base + bonus + first };
  }
  G.levelReward = levelReward;

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
        else if (G.shopOpen) closeShop();
        return;
      }
      if (e.code === 'KeyM') return toggleMute();
      if (G.state === 'menu') {
        if (G.shopOpen) {
          if (e.code === 'Escape' || e.code === 'Backspace') closeShop();
          else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
            const ids = Object.keys(Art.CHARS);
            setShopTab(ids[(ids.indexOf(G.shopTab) + (e.code === 'ArrowLeft' ? ids.length - 1 : 1)) % ids.length]);
          }
          return;
        }
        const n = /^Digit(\d)$/.exec(e.code);
        if (n && VD.LEVELS[+n[1] - 1]) return pickLevel(VD.LEVELS[+n[1] - 1].id);
        if (e.code === 'KeyS') return openShop();
        if (G.debug && e.code === 'KeyC') {
          addCoins(500);
          return refreshMenu();
        }
      }
      if (JUMP.has(e.code)) {
        if (G.state === 'menu') return G.shopOpen ? undefined : G.start();
        if (G.state === 'won') return $('next').classList.contains('hidden') ? G.start() : G.nextLevel();
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
    else if (e.code === 'KeyC') addCoins(500);
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
    $('next').onclick = () => G.nextLevel();
    $('again').onclick = () => G.start();
    $('winMenu').onclick = () => G.toMenu();
    $('shopBtn').onclick = () => openShop();
    $('shopBack').onclick = () => closeShop();
    $('mute').onclick = (e) => {
      e.stopPropagation();
      toggleMute();
    };
    // level cards
    const box = $('levels');
    for (const L of VD.LEVELS) {
      const b = document.createElement('button');
      b.className = 'lvl d' + L.difficulty;
      b.dataset.id = L.id;
      const r = levelReward(L, 0, false), lo = levelReward(L, 10, false);
      b.innerHTML =
        '<span class="lnum">' + L.num + '</span>' +
        '<span class="linfo"><b>' + L.name + '</b><small>' + L.route + '</small>' +
        '<span class="lmeta"><span class="diff d' + L.difficulty + '">' + '★'.repeat(L.difficulty) + ' ' + L.diffName + '</span>' +
        '<span class="lcoins"><i class="coin"></i>' + lo.total + '–' + r.total + '</span></span></span>' +
        '<span class="lprog"><b></b><small></small></span>';
      b.onclick = () => pickLevel(L.id);
      box.appendChild(b);
    }
    // shop: one tab per character, each showing that character's skins
    const tabs = $('shopTabs');
    for (const c of Object.keys(Art.CHARS)) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.dataset.char = c;
      b.innerHTML = '<canvas width="44" height="52"></canvas><span class="tname">' + Art.CHARS[c].name + '<small></small></span>';
      b.onclick = () => {
        AU.init();
        setShopTab(c);
      };
      tabs.appendChild(b);
    }
    const grid = $('shopGrid');
    for (const id of Object.keys(Art.SKINS)) {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.skin = id;
      b.dataset.char = Art.charOf(id);
      b.innerHTML = '<canvas width="100" height="110"></canvas><span class="cname">' + Art.SKINS[id].name + '</span><span class="cbtn"></span>';
      b.onclick = () => shopClick(id, b);
      grid.appendChild(b);
    }
    updateMuteIcon();
  }
  function pickLevel(id) {
    AU.init();
    AU.sfx('click');
    if (id !== G.levelDef.id) selectLevel(id);
    refreshMenu();
  }
  function refreshMenu() {
    for (const b of document.querySelectorAll('.lvl')) {
      const p = G.progress[b.dataset.id];
      b.classList.toggle('on', b.dataset.id === G.levelDef.id);
      const big = b.querySelector('.lprog b'), small = b.querySelector('.lprog small');
      big.className = p.wins ? 'done' : '';
      big.textContent = p.wins ? '✔ ' + p.wins : p.best + '%';
      small.textContent = p.wins ? (p.wins === 1 ? 'win' : 'wins') : 'best';
    }
    $('coinsMenu').textContent = G.coins;
    $('skinName').textContent = skinLabel(G.skin);
  }
  // "Affelito · Black tee", but just "King Vippe" when the skin name already says who it is
  function skinLabel(id) {
    const name = Art.SKINS[id].name, who = Art.CHARS[Art.charOf(id)].name;
    return name.indexOf(who) >= 0 ? name : who + ' · ' + name;
  }

  // ------------------------------------------------------------------ shop
  function openShop() {
    AU.init();
    AU.sfx('click');
    G.shopOpen = true;
    G.shopTab = Art.charOf(G.skin);
    show('menu', false);
    show('shop', true);
    refreshShop();
  }
  function setShopTab(c) {
    if (c === G.shopTab) return;
    AU.sfx('click');
    G.shopTab = c;
    refreshShop();
  }
  function closeShop() {
    G.shopOpen = false;
    show('shop', false);
    show('menu', true);
    refreshMenu();
  }
  function shopClick(id, card) {
    AU.init();
    const k = Art.SKINS[id];
    if (owns(id)) {
      G.skin = id;
      store.set('skin', id);
      AU.sfx('click');
    } else if (G.coins >= k.price) {
      addCoins(-k.price);
      G.owned.push(id);
      store.set('owned', G.owned);
      G.skin = id;
      store.set('skin', id);
      AU.sfx('buy');
      bump(card, 'bought');
      bump($('coinsShop').parentElement, 'pop');
    } else {
      AU.sfx('nope');
      bump(card, 'shake');
    }
    refreshShop();
  }
  function bump(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  function refreshShop() {
    $('coinsShop').textContent = G.coins;
    for (const b of document.querySelectorAll('.tab')) {
      const c = b.dataset.char, ids = Object.keys(Art.SKINS).filter((id) => Art.charOf(id) === c);
      b.classList.toggle('on', c === G.shopTab);
      b.querySelector('small').textContent = ids.filter(owns).length + ' / ' + ids.length + ' owned';
    }
    for (const b of document.querySelectorAll('.card')) {
      const id = b.dataset.skin, k = Art.SKINS[id], mine = owns(id);
      b.classList.toggle('hidden', b.dataset.char !== G.shopTab);
      const state = id === G.skin ? 'wearing' : mine ? 'owned' : G.coins >= k.price ? 'buy' : 'locked';
      b.classList.remove('wearing', 'owned', 'buy', 'locked');
      b.classList.add(state);
      const btn = b.querySelector('.cbtn');
      if (state === 'wearing') btn.textContent = '✓ Wearing';
      else if (state === 'owned') btn.textContent = 'Wear';
      else btn.innerHTML = '<i class="coin"></i>' + k.price;
      b.title = state === 'locked' ? 'You need ' + (k.price - G.coins) + ' more coins' : k.name;
    }
  }
  // skin previews are redrawn every frame while the shop is open, so rainbow / gold / galaxy shimmer
  function drawShop() {
    Art.setDark(0);
    for (const b of document.querySelectorAll('.tab')) {
      const c = b.querySelector('canvas'), x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, c.width, c.height);
      x.translate(22, 34);
      Art.cube(x, 28, 'grin', Art.CHARS[b.dataset.char].first, 0);
    }
    for (const b of document.querySelectorAll('.card')) {
      if (b.dataset.char !== G.shopTab) continue;
      const c = b.querySelector('canvas'), x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, c.width, c.height);
      const on = b.dataset.skin === G.skin;
      const hop = on ? Math.abs(Math.sin(G.clock * 5)) * 6 : 0;
      x.translate(50, 68 - hop);
      Art.cube(x, 56, 'grin', b.dataset.skin, 0);
    }
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
    G.shopOpen = false;
    show('menu', false);
    show('shop', false);
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
    G.attemptText = { x: cp.x, n: G.attempts, layer: cp.layer };
    G.camV = G.camVT = G.lvl.depthOf(G.s.layer);
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
    G.camV = G.camVT = 0;
    G.s = null;
    refreshMenu();
  };
  G.nextLevel = function () {
    const i = VD.LEVELS.indexOf(G.levelDef);
    if (i + 1 >= VD.LEVELS.length) return G.start();
    selectLevel(VD.LEVELS[i + 1].id);
    G.start();
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
    const cols = [k.main, '#f2c6a0', Art.CHARS[Art.charOf(G.skin)].hair, '#ffffff', '#ffd634'];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 10;
      particle({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, size: 6 + Math.random() * 10, color: cols[i % cols.length], grav: 12 });
    }
    particle({ x: cx, y: cy, life: 0.45, size: 90, color: '#ffffff', ring: true });
    const pct = Math.floor(U.clamp(s.x / G.lvl.finishX, 0, 1) * 100);
    const p = G.progress[G.levelDef.id];
    if (pct > p.best) {
      p.best = pct;
      saveProgress();
    }
  }

  function win() {
    G.state = 'winning';
    G.winAge = 0;
    G.fwT = 0;
    AU.sfx('win');
    const p = G.progress[G.levelDef.id];
    G.reward = levelReward(G.levelDef, G.deaths, p.wins === 0);
    G.coinsBefore = G.coins;
    addCoins(G.reward.total);
    p.best = 100;
    p.wins++;
    if (p.fewest == null || G.deaths < p.fewest) p.fewest = G.deaths;
    saveProgress();
    G.finalTime = G.runTime;
    G.flash = 0.5;
  }

  function showWin() {
    G.state = 'won';
    const def = G.levelDef, r = G.reward;
    const m = Math.floor(G.finalTime / 60), sec = Math.floor(G.finalTime % 60);
    $('winTitle').textContent = def.winTitle;
    $('winSub').textContent = def.winSub;
    $('stats').innerHTML =
      '<div><b>' + G.attempts + '</b><span>attempts</span></div>' +
      '<div><b>' + G.deaths + '</b><span>' + (G.deaths === 1 ? 'crash' : 'crashes') + '</span></div>' +
      '<div><b>' + m + ':' + ('0' + sec).slice(-2) + '</b><span>time</span></div>';
    const line = (label, n) => '<div class="rline' + (n ? '' : ' none') + '"><span>' + label + '</span><b>+' + n + '</b></div>';
    $('reward').innerHTML =
      line('Level ' + def.num + ' cleared (' + def.diffName + ')', r.base) +
      line(G.deaths === 0 ? 'No crashes — perfect run!' : 'Crash bonus (' + G.deaths + (G.deaths === 1 ? ' crash' : ' crashes') + ')', r.bonus) +
      (r.first ? line('First time beating this level!', r.first) : '') +
      '<div class="rtotal"><i class="coin"></i><b id="rewardTotal">+0</b><span id="rewardNow"></span></div>';
    const hasNext = VD.LEVELS.indexOf(def) + 1 < VD.LEVELS.length;
    $('next').classList.toggle('hidden', !hasNext);
    $('again').classList.toggle('big', !hasNext);
    show('win', true);
    // count the coins up
    G.countUp = { shown: 0, t: 0 };
  }
  function updateCountUp(dt) {
    const c = G.countUp;
    if (!c || !G.reward) return;
    const total = G.reward.total;
    c.t += dt;
    const target = Math.min(total, Math.round(total * U.smooth(Math.min(1, c.t / 1.2))));
    if (target !== c.shown) {
      if (Math.floor(target / 10) !== Math.floor(c.shown / 10)) AU.sfx('coin');
      c.shown = target;
      $('rewardTotal').textContent = '+' + target;
      $('rewardNow').textContent = 'you have ' + (G.coinsBefore + target);
    }
    if (c.shown >= total) G.countUp = null;
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
    followDown(s);
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

  // G.camV = how far (in blocks) the camera looks below the top floor. When you fall through a hole you come
  // out of the roof of the layer below: the camera dives after you and settles once you're near its floor.
  function followDown(s) {
    const lv = G.lvl;
    if (!lv.drops.length) return;
    const floor = lv.depthOf(s.layer);
    const want = floor - Math.max(0, s.y - 3);
    if (s.layer > 0 && want > G.camVT) G.camVT = want;
    G.camV += (G.camVT - G.camV) * 0.06;
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
    } else if (e === 'drop') {
      // the floor gives way: rubble tumbles down the hole with you
      AU.sfx('drop');
      G.shake = 0.35;
      for (let i = 0; i < 22; i++) {
        particle({ x: s.x - 1 + Math.random() * 4, y: s.y + 0.5 + Math.random() * 2, vx: (Math.random() - 0.3) * 4, vy: -2 - Math.random() * 5, life: 0.8 + Math.random() * 0.5, size: 5 + Math.random() * 9, color: i % 3 ? '#6b625a' : '#9a9088', grav: 30 });
      }
    } else if (e === 'flip') {
      for (let i = 0; i < 5; i++) particle({ x: s.x + 0.5, y: s.gdir > 0 ? s.y : s.y + 1, vx: -3 - Math.random() * 3, vy: (Math.random() - 0.5) * 3, life: 0.3, size: 5, color: '#ffffff' });
    }
  }

  function onCheckpoint(cp) {
    AU.sfx('checkpoint');
    for (let i = 0; i < 18; i++) {
      particle({ x: cp.x + 0.5, y: 2.3, vx: (Math.random() - 0.5) * 8, vy: 3 + Math.random() * 6, life: 0.9, size: 7, color: i % 2 ? '#006aa7' : '#fecc00', grav: 14, layer: cp.layer });
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
    if (p.layer == null) p.layer = G.s ? G.s.layer : 0; // which floor it's drawn on (level 3 has two)
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
      if (G.state === 'won') updateCountUp(dt);
    } else if (G.state === 'menu') {
      G.camX += dt * 5;
      if (G.camX > G.lvl.finishX - 20) G.camX = -4;
      // the attract-mode camera drops through the hole too
      const want = G.lvl.depthOf(G.lvl.layerAt(G.camX + R.PX + 2));
      G.camV = want < G.camV ? want : G.camV + (want - G.camV) * (1 - Math.exp(-dt * 4));
      if (G.shopOpen) drawShop();
      else drawHero();
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
    Art.cube(x, 96, faces[Math.floor(t / 1.54) % faces.length], G.skin, 0);
  }

  addEventListener('load', () => {
    const go = () => G.init();
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load('32px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]).then(go, go);
    } else go();
  });
})();
