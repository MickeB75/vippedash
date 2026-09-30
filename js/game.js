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
    G.progress = loadProgress(); // before owns(): level-unlocked skins need it
    refundRemovedSkins();
    if (!Art.SKINS[G.skin] || !owns(G.skin)) G.skin = 'red';
    AU.muted = store.get('muted', false);
    G.strobeOn = store.get('strobe', true);
    G.debug = /debug/.test(location.hash + location.search);
    G.state = 'menu';
    G.ev = [];
    selectLevel(store.get('level', VD.LEVELS[0].id));
    bindInput();
    bindUI();
    refreshMenu();
    if (G.debug) applyDebugStart();
    revealSelectedLevel();
    addEventListener('resize', revealSelectedLevel);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(revealSelectedLevel); // card heights depend on the font
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
    G.hpMax = G.levelDef.health || 0; // 0 means no health bar; refilled to full on G.start()
  }
  // { levelId: { best: %, wins, fewest: crashes } }. Older saves only had one level's best/wins.
  function loadProgress() {
    let p = store.get('progress', null);
    if (!p) {
      p = {};
      const best = store.get('best', 0), wins = store.get('wins', 0);
      if (best || wins) p.home = { best, wins };
    }
    for (const L of VD.LEVELS) p[L.id] = Object.assign({ best: 0, wins: 0, fewest: null, bestRun: null }, p[L.id]);
    return p;
  }
  function saveProgress() {
    store.set('progress', G.progress);
  }
  // skins with `unlock: '<levelId>'` can't be bought: they're yours once you've beaten that level
  function owns(id) {
    const k = Art.SKINS[id];
    if (k.unlock) return G.progress[k.unlock].wins > 0;
    return k.price === 0 || G.owned.indexOf(id) >= 0;
  }
  // skins taken out of the shop give their coins back to anyone who had bought them
  const REMOVED_SKINS = { afCamo: 150 };
  function refundRemovedSkins() {
    const gone = G.owned.filter((id) => REMOVED_SKINS[id]);
    if (!gone.length) return;
    for (const id of gone) addCoins(REMOVED_SKINS[id]);
    G.owned = G.owned.filter((id) => !REMOVED_SKINS[id]);
    store.set('owned', G.owned);
  }
  function addCoins(n) {
    G.coins = Math.max(0, G.coins + n);
    store.set('coins', G.coins);
  }
  // Coins for finishing a level: the level's reward, a crash bonus (the same amount again, minus 10% per crash),
  // the reward once more the first time you beat it, and 1 coin per candy/football picked up along the way
  // (Stratusvägen; every other level has no coin pickups, so `pickups` is 0 and the reward is unchanged).
  // Harder levels have a bigger reward.
  function levelReward(def, crashes, firstWin, pickups = 0) {
    const base = def.reward;
    const bonus = Math.max(0, Math.round(def.reward * (1 - crashes / 10)));
    const first = firstWin ? def.reward : 0;
    return { base, bonus, first, pickups, total: base + bonus + first + pickups };
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
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        // typing in a text field (the name dialog): let it type normally, only forward Escape/Enter
        if ((e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter') && VD.Board) VD.Board.key(e);
        return;
      }
      if (VD.Board && VD.Board.isOpen()) return void VD.Board.key(e);
      if (G.freeze) G.freeze = false; // any key unfreezes a ?freeze debug start
      if (JUMP.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (G.state === 'play') G.pause();
        else if (G.state === 'paused') G.resume();
        else if (G.state === 'gameover') G.toMenu();
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
        const pick = n && menuLevels()[(+n[1] + 9) % 10]; // 1..9 = levels 1..9, 0 = level 10
        if (pick) return pickLevel(pick.id);
        if (e.code === 'KeyS') return openShop();
        if (e.code === 'KeyT' && VD.Board) return VD.Board.openBoard(G.levelDef.id);
        if (G.debug && e.code === 'KeyC') {
          addCoins(500);
          return refreshMenu();
        }
      }
      if (JUMP.has(e.code)) {
        if (G.state === 'menu') return G.shopOpen ? undefined : G.start();
        if (G.state === 'won') return $('next').classList.contains('hidden') ? G.start() : G.nextLevel();
        if (G.state === 'paused') return G.resume();
        if (G.state === 'gameover') return G.start();
        keysDown.add(e.code);
        updateHeld();
        G.tapQueued = true;
        return;
      }
      if (G.debug) debugKey(e);
    });
    addEventListener('keyup', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let text fields keep their normal keyup behaviour
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
      if (G.freeze) G.freeze = false; // any click/tap unfreezes a ?freeze debug start
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
    // losing focus pauses the run, except a ?freeze debug start: nothing moves, and the pause menu would hide it
    addEventListener('blur', () => {
      releaseAll();
      if (G.state === 'play' && !G.freeze) G.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.state === 'play' && !G.freeze) G.pause();
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
    else if (e.code === 'KeyH') {
      G.hp = G.hpMax;
      updateLowHp();
    } else if (e.code === 'KeyB') {
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

  // ------------------------------------------------------------------ debug URL params (debug mode only)
  // index.html?debug&level=forest&cp=5   or the same after the hash: index.html#debug&level=forest&cp=5
  // level, cp, x, skin, bot, god, freeze, mute, shop — lets a URL drop straight into a spot for screenshots.
  // fakelevels=N (menu only) pads the level list with copies of the real levels up to N cards, to test the menu layout;
  // menulevel=<id> selects that level in the menu without starting it (level= starts a run).
  function debugParams() {
    const out = {};
    const merge = (str) => {
      if (!str) return;
      for (const [k, v] of new URLSearchParams(str)) if (!(k in out)) out[k] = v;
    };
    merge(location.search);
    merge(location.hash.replace(/^#/, ''));
    return out;
  }
  // spawn at the last checkpoint at or before x, solve a path past x, then replay it with the real
  // physics and stop as soon as x is reached, so the player's mode/gravity/layer are all consistent.
  function fastForwardTo(x) {
    const lvl = G.lvl;
    const from = Ph.clone(G.s);
    const res = VD.Solver.solve(lvl, Ph.clone(from), x, { k: 4, maxNodes: 3000000 });
    if (!res.ok) {
      console.warn('VippeDash debug: no solver path to x=' + x + ' (' + res.reason + '); staying at the checkpoint');
      return;
    }
    const s = Ph.clone(from);
    let reached = false;
    for (let d = 0; d < res.path.length && !reached; d++) {
      for (let k = 0; k < res.K; k++) {
        Ph.step(s, res.path[d], lvl, null);
        if (s.dead) {
          console.warn('VippeDash debug: replay crashed before reaching x=' + x + '; staying at the checkpoint');
          return;
        }
        if (s.x >= x) {
          reached = true;
          break;
        }
      }
    }
    G.s = s;
    G.cpIndex = lvl.checkpointAt(s.x); // so a crash after the x-start respawns at the normal last checkpoint
    G.vis = { rot: 0, wheel: 0, oT: 0 };
    G.camV = G.camVT = lvl.depthOf(s.layer);
    G.camX = s.x - R.PX;
    AU.startMusic(Ph.timeAt(lvl, s.x));
  }
  function applyDebugStart() {
    const q = debugParams();
    let startCp = null;
    if ('level' in q) {
      if (VD.LEVELS.some((L) => L.id === q.level)) {
        if (q.level !== G.levelDef.id) selectLevel(q.level);
      } else {
        console.warn('VippeDash debug: unknown level "' + q.level + '"');
      }
    }
    if ('menulevel' in q && VD.LEVELS.some((L) => L.id === q.menulevel) && q.menulevel !== G.levelDef.id) selectLevel(q.menulevel);
    if ('cp' in q) {
      const n = +q.cp;
      if (Number.isInteger(n) && n >= 0 && n < G.lvl.checkpoints.length) startCp = n;
      else console.warn('VippeDash debug: cp out of range: ' + q.cp);
    }
    if ('level' in q || 'cp' in q || 'x' in q) {
      if ('x' in q) {
        const x = +q.x;
        if (Number.isFinite(x)) {
          G.start(G.lvl.checkpointAt(x));
          fastForwardTo(x);
        } else {
          console.warn('VippeDash debug: bad x value "' + q.x + '"');
          G.start(startCp || 0);
        }
      } else {
        G.start(startCp || 0);
      }
    }
    if ('hp' in q) {
      // sets the starting health after the start above; handy for testing game over
      const n = +q.hp;
      if (Number.isFinite(n)) {
        G.hp = G.hpMax ? U.clamp(n, 0, G.hpMax) : n;
        updateLowHp();
      } else {
        console.warn('VippeDash debug: bad hp value "' + q.hp + '"');
      }
    }
    if ('skin' in q) {
      // session-only: bypasses ownership and isn't saved, so coins/owned skins are untouched
      if (Art.SKINS[q.skin]) G.skin = q.skin;
      else console.warn('VippeDash debug: unknown skin "' + q.skin + '"');
    }
    if ('bot' in q) {
      G.bot = true;
      if (G.s) computeBot(G.s);
    }
    if ('god' in q) G.god = true;
    if ('mute' in q) {
      AU.setMuted(true); // session only: never persisted to the saved mute setting
      updateMuteIcon();
    }
    if ('freeze' in q) G.freeze = true; // must come last: freezes the state the params above just set up
    refreshMenu();
    // shop: open the shop on the tab of the skin being worn (with skin=, that skin's character); menu only
    if ('shop' in q && G.state === 'menu') openShop();
    // leaderboard: jump straight to the board (on a given level) or the name dialog, for screenshots
    if ('board' in q && VD.Board) {
      if (VD.LEVELS.some((L) => L.id === q.board)) VD.Board.openBoard(q.board);
      else console.warn('VippeDash debug: unknown level "' + q.board + '" for board=');
    }
    if ('namedlg' in q && VD.Board) VD.Board.openName();
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
    $('goRestart').onclick = () => G.start();
    $('goMenu').onclick = () => G.toMenu();
    $('strobeBtn').onclick = () => {
      G.strobeOn = !G.strobeOn;
      store.set('strobe', G.strobeOn);
      updateStrobeBtn();
    };
    $('shopBtn').onclick = () => openShop();
    $('shopBack').onclick = () => closeShop();
    $('mute').onclick = (e) => {
      e.stopPropagation();
      toggleMute();
    };
    // level cards. The list scrolls (css/style.css) and gets tighter cards when they don't all fit (fitLevelList).
    const box = $('levels');
    const list = menuLevels();
    for (const L of list) {
      const b = document.createElement('button');
      b.className = 'lvl d' + L.difficulty;
      b.dataset.id = L.id;
      if (L.fake) b.dataset.fake = '1';
      const r = levelReward(L, 0, false), lo = levelReward(L, 10, false);
      const badges = (L.age ? '<span class="age">16+</span>' : '') +
        (L.strobe ? '<span class="flashico" title="Flashing lights">⚡</span>' : '');
      b.innerHTML =
        '<span class="lnum">' + L.num + '</span>' +
        '<span class="linfo"><b>' + L.name + badges + '</b><small>' + L.route + '</small>' +
        '<span class="lmeta"><span class="diff d' + L.difficulty + '">' + '★'.repeat(L.difficulty) + ' ' + L.diffName + '</span>' +
        '<span class="lcoins"><i class="coin"></i>' + lo.total + '–' + r.total + '</span></span></span>' +
        '<span class="lprog"><b></b><span class="lsub"><small></small><span class="lrank"></span></span></span>';
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
    revealSelectedLevel();
  }
  // the levels shown in the menu: VD.LEVELS, plus (debug ?fakelevels=N only) copies of them up to N cards
  function menuLevels() {
    if (G.menuList) return G.menuList;
    let list = VD.LEVELS;
    const n = G.debug ? parseInt(debugParams().fakelevels, 10) : 0;
    if (n > list.length) {
      list = list.slice();
      for (let i = list.length; i < n; i++) {
        list.push(Object.assign({}, VD.LEVELS[i % VD.LEVELS.length], { num: i + 1, fake: true }));
      }
    }
    return (G.menuList = list);
  }
  // tighter cards (.tight) only when the normal ones don't fit the panel; beyond that the list just scrolls
  function fitLevelList() {
    const box = $('levels');
    if ($('menu').classList.contains('hidden')) return;
    box.classList.remove('tight');
    if (box.scrollHeight > box.clientHeight + 1) box.classList.add('tight');
  }
  // scroll the level list so the selected card is fully in view (the list scrolls inside the menu panel)
  function revealSelectedLevel() {
    fitLevelList();
    const box = $('levels'), on = box.querySelector('.lvl.on');
    if (!on || !box.clientHeight) return;
    const top = on.offsetTop, bottom = top + on.offsetHeight;
    const pad = on.offsetHeight * 0.3; // leave a little of the neighbours visible
    if (top - pad < box.scrollTop) box.scrollTop = Math.max(0, top - pad);
    else if (bottom + pad > box.scrollTop + box.clientHeight) box.scrollTop = bottom + pad - box.clientHeight;
  }
  function refreshMenu() {
    for (const b of document.querySelectorAll('.lvl')) {
      const p = G.progress[b.dataset.id];
      b.classList.toggle('on', b.dataset.id === G.levelDef.id && !b.dataset.fake);
      const big = b.querySelector('.lprog b'), small = b.querySelector('.lprog small'), rank = b.querySelector('.lrank');
      big.className = p.wins ? 'done' : '';
      big.textContent = p.wins ? '✔ ' + p.wins : p.best + '%';
      small.textContent = p.wins ? (p.wins === 1 ? 'win' : 'wins') : 'best';
      if (rank) {
        const r = VD.Board ? VD.Board.rankOf(b.dataset.id) : null;
        rank.textContent = r && r <= 10 ? '🏆 #' + r : '';
      }
    }
    $('coinsMenu').textContent = G.coins;
    $('skinName').textContent = skinLabel(G.skin);
    if (VD.Board) VD.Board.refreshChip();
  }
  G.refreshMenu = refreshMenu; // so leaderboard.js can ask the menu to redraw after a GET updates ranks
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
    revealSelectedLevel();
  }
  function shopClick(id, card) {
    AU.init();
    const k = Art.SKINS[id];
    if (owns(id)) {
      G.skin = id;
      store.set('skin', id);
      AU.sfx('click');
    } else if (!k.unlock && G.coins >= k.price) {
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
      const state = id === G.skin ? 'wearing' : mine ? 'owned' : !k.unlock && G.coins >= k.price ? 'buy' : 'locked';
      b.classList.remove('wearing', 'owned', 'buy', 'locked');
      b.classList.add(state);
      const btn = b.querySelector('.cbtn');
      const lvl = k.unlock && VD.levelDef(k.unlock);
      if (state === 'wearing') btn.textContent = '✓ Wearing';
      else if (state === 'owned') btn.textContent = 'Wear';
      else if (lvl) btn.textContent = '🔒 Level ' + lvl.num; // the full "Beat level 6 Mardrömmen" is too long for the button
      else btn.innerHTML = '<i class="coin"></i>' + k.price;
      b.title = state !== 'locked' ? k.name : lvl ? 'Beat level ' + lvl.num + ' ' + lvl.name + ' to unlock' : 'You need ' + (k.price - G.coins) + ' more coins';
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
  function updateLowHp() {
    G.lowHp = G.hpMax > 0 && G.hp > 0 && G.hp < 30;
  }
  function updateStrobeBtn() {
    const btn = $('strobeBtn');
    btn.classList.toggle('hidden', !G.levelDef.strobe);
    btn.innerHTML = '⚡&nbsp; Strobe: ' + (G.strobeOn ? 'On' : 'Off');
  }

  // ------------------------------------------------------------------ states
  // cpIndex: which checkpoint to start at (default 0). Used by debug URL params (?cp=, ?x=) to start elsewhere.
  G.start = function (cpIndex) {
    AU.init();
    G.shopOpen = false;
    show('menu', false);
    show('shop', false);
    show('pause', false);
    show('win', false);
    show('gameover', false);
    G.cpIndex = cpIndex || 0;
    G.attempts = 0;
    G.deaths = 0;
    G.runTime = 0;
    G.seen = {};
    G.areaIdx = -1;
    G.particles = [];
    G.banner = null;
    G.hpMax = G.levelDef.health || 0;
    G.hp = G.hpMax; // full health at the start of a run; never refilled on respawn
    G.hurt = null;
    G.scare = null;
    G.scared = {}; // which lvl.scares indices have fired this run
    G.hbT = 0;
    G.got = new Set(); // ids of coins (candy/footballs) collected this run
    G.runCoins = 0;
    updateLowHp();
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
    // candy/footballs collected past this checkpoint don't survive the respawn; ones before it do
    if (G.got) {
      let n = 0;
      for (const o of G.lvl.objs) {
        if (o.t === 'coin' && G.got.has(o.id)) {
          if (o.x >= cp.x) G.got.delete(o.id);
          else n++;
        }
      }
      G.runCoins = n;
    }
    AU.startMusic(Ph.timeAt(G.lvl, cp.x));
    if (G.bot) computeBot(G.s);
  };

  G.pause = function () {
    if (G.state !== 'play') return;
    G.state = 'paused';
    AU.stopMusic(0.05);
    releaseAll();
    updateStrobeBtn();
    show('pause', true);
  };
  G.resume = function () {
    if (G.state !== 'paused') return;
    show('pause', false);
    G.state = 'play';
    G.acc = 0;
    G.last = performance.now();
    G.ignoreHeld = G.held;
    AU.startMusic(Ph.timeAt(G.lvl, G.s.x));
  };
  G.toMenu = function () {
    AU.stopMusic(0.1);
    show('pause', false);
    show('win', false);
    show('gameover', false);
    show('menu', true);
    G.state = 'menu';
    G.camX = -4;
    G.camV = G.camVT = 0;
    G.s = null;
    refreshMenu();
    revealSelectedLevel();
    // a name that came back "taken" (e.g. after a queued registration was flushed) needs fixing
    if (VD.Board && VD.Board.nameStatus && VD.Board.nameStatus() === 'taken') VD.Board.openName();
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
    const s = G.s, ph = Ph.boxH(s);
    const cx = s.x + 0.5, cy = s.y + ph / 2;
    const health = G.hpMax > 0;
    if (health) {
      AU.sfx('hurt');
      const dmg = s.dmg || 12;
      G.hp = Math.max(0, G.hp - dmg);
      G.hurt = { n: dmg, t: 0, x: cx, y: cy };
      updateLowHp();
    } else {
      AU.sfx('death');
    }
    const k = Art.SKINS[G.skin];
    const cols = health
      ? ['#c0081a', '#7a0010', '#c0081a', '#7a0010', '#c0081a', '#f2c6a0', Art.CHARS[Art.charOf(G.skin)].hair]
      : [k.main, '#f2c6a0', Art.CHARS[Art.charOf(G.skin)].hair, '#ffffff', '#ffd634'];
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

  function gameOver() {
    G.state = 'gameover';
    AU.stopMusic(0.1);
    AU.sfx('gameover');
    $('goSub').textContent = 'Your health ran out after ' + G.deaths + (G.deaths === 1 ? ' crash' : ' crashes');
    show('gameover', true);
  }

  function win() {
    G.state = 'winning';
    G.winAge = 0;
    G.fwT = 0;
    AU.sfx(G.hpMax > 0 ? 'bell' : 'win');
    const p = G.progress[G.levelDef.id];
    G.reward = levelReward(G.levelDef, G.deaths, p.wins === 0, G.runCoins || 0);
    G.coinsBefore = G.coins;
    addCoins(G.reward.total);
    p.best = 100;
    p.wins++;
    if (p.fewest == null || G.deaths < p.fewest) p.fewest = G.deaths;
    G.finalTime = G.runTime; // needed below (and by showWin/countUp) before addCoins used to be the last writer
    const t = Math.round(G.finalTime * 10); // tenths of a second, what the leaderboard stores
    const cheat = G.debug || G.bot || G.god;
    const newBest = !p.bestRun || G.deaths < p.bestRun.c || (G.deaths === p.bestRun.c && t < p.bestRun.t);
    if (!cheat) p.bestRun = { c: G.deaths, t: t }; // never pollute the local best with a debug/bot/god run
    saveProgress();
    G.flash = 0.5;
    if (VD.Stats) VD.Stats.log('win', G.levelDef.id);
    if (VD.Board) VD.Board.onWin(G.levelDef.id, G.deaths, t, newBest);
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
      (r.pickups ? line('Candy & footballs', r.pickups) : '') +
      (r.first ? line('First time beating this level!', r.first) : '') +
      (r.first ? unlockedLine(def.id) : '') +
      '<div class="rtotal"><i class="coin"></i><b id="rewardTotal">+0</b><span id="rewardNow"></span></div>';
    const hasNext = VD.LEVELS.indexOf(def) + 1 < VD.LEVELS.length;
    $('next').classList.toggle('hidden', !hasNext);
    $('again').classList.toggle('big', !hasNext);
    show('win', true);
    if (VD.Board) VD.Board.renderWin(def.id);
    // count the coins up
    G.countUp = { shown: 0, t: 0 };
  }
  // "🔓 Unlocked: Scary Vippe & Scary Affelito" under the reward, for the skins this level unlocks
  function unlockedLine(levelId) {
    const names = Object.keys(Art.SKINS).filter((id) => Art.SKINS[id].unlock === levelId).map((id) => Art.SKINS[id].name);
    return names.length ? '<div class="rline unlocked"><span>🔓 Unlocked: ' + names.join(' & ') + '</span></div>' : '';
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
    const wasGrounded = s.grounded, prevMode = s.mode, prevX = s.x;
    Ph.step(s, held, G.lvl, G.ev);
    if (s.dead && G.god) s.dead = false;
    for (const e of G.ev) onEvent(e);
    if (s.mode !== prevMode) G.vis.rot = 0;
    visuals(s, wasGrounded);
    followDown(s);
    collectCoins(s);
    checkScares(prevX, s.x);
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

  // Stratusvägen: candy and footballs (t: 'coin' — see Builder.coin()). Physics never touches them, so
  // this runs the overlap test itself, the same way as a hazard: the player box vs. the coin's centre
  // (its `mv` offset applied first, for a thrown coin — see Builder.lob()'s comment), gated by lane too.
  function collectCoins(s) {
    if (!G.got) return; // menu attract mode has no run in progress
    const ph = Ph.boxH(s);
    for (const o of G.lvl.query(s.x)) {
      if (o.t !== 'coin' || G.got.has(o.id)) continue;
      if (o.lane != null && Math.abs(s.laneP - o.lane) >= 0.5) continue;
      let cx = o.x + 0.5, cy = o.y + 0.5;
      if (o.mv) {
        const mv = Ph.moveOf(o, s.x, G.lvl);
        cx += mv.dx;
        cy += mv.dy;
      }
      if (s.x < cx + 0.55 && s.x + 1 > cx - 0.55 && s.y < cy + 0.55 && s.y + ph > cy - 0.55) {
        G.got.add(o.id);
        G.runCoins++;
        AU.sfx('coin');
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          particle({ x: cx, y: cy, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5 + 1, life: 0.4, size: 4, color: o.style === 'football' ? '#f2f2f2' : '#ffd634', grav: 6, round: true });
        }
      }
    }
  }

  function onEvent(e) {
    const s = G.s, ph = Ph.boxH(s);
    if (e === 'pad' || e === 'orb') {
      AU.sfx(e);
      G.vis.oT = 0.45;
      particle({ x: s.x + 0.5, y: s.y + ph / 2, life: 0.35, size: 50, color: '#ffd634', ring: true });
    } else if (e === 'lane') {
      AU.sfx('click');
      for (let i = 0; i < 4; i++) particle({ x: s.x + 0.5, y: s.y + 0.05, vx: (Math.random() - 0.5) * 2, vy: 0.5 + Math.random(), life: 0.25, size: 4, color: 'rgba(255,255,255,0.6)' });
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

  // jump scares (level 4): each one fires once per run, the moment the player's x crosses it
  function checkScares(prevX, x) {
    if (G.state === 'menu') return; // never in the menu
    const scares = (G.lvl && G.lvl.scares) || [];
    for (let i = 0; i < scares.length; i++) {
      const sc = scares[i];
      if (!G.scared[i] && prevX < sc.x && sc.x <= x) {
        G.scared[i] = true;
        triggerScare(sc);
      }
    }
  }
  function triggerScare(sc) {
    G.scare = { kind: sc.kind, t: 0 };
    G.vis.oT = 0.6; // Vippe's shocked 'o' face
    G.shake = sc.kind === 'window' ? 0.1 : 0.4;
    switch (sc.kind) {
      case 'nun':
      case 'final':
        AU.sfx('scare_nun');
        break;
      case 'window':
        AU.sfx('thunder');
        break;
      case 'skull':
        break; // delayed: played once G.scare.t passes 0.4, see the main loop
      case 'clown':
      case 'mirror':
        AU.sfx('scare_clown');
        break;
      case 'duo':
        AU.sfx('scare_nun');
        AU.sfx('scare_clown');
        break;
    }
  }

  function visuals(s, wasGrounded) {
    const v = G.vis, dt = P.DT;
    if (v.oT > 0) v.oT -= dt;
    // Stratusvägen: riding the rocket skateboard (see Builder.board(), render.js drawPlayer) — no cube
    // spin, just a gentle tilt with the jump instead
    const lvl = G.lvl;
    const onBoard = lvl && lvl.boards && lvl.boards.some((z) => s.x >= z.x0 && s.x <= z.x1);
    if (s.mode === 'cube' || s.mode === 'lane') {
      if (onBoard) {
        const target = U.clamp(-s.vy * 0.22, -0.3, 0.3);
        v.rot += (target - v.rot) * 0.25;
      } else if (!s.grounded) v.rot += 7.1 * dt;
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
    if (p.layer == null) p.layer = G.s ? G.s.layer : 0; // which floor it's drawn on (level 2 has two)
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
    const cols = G.hpMax > 0
      ? ['#c0081a', '#7a0010', '#ffffff', '#6a1a8a'] // horror win: blood red, white, purple
      : ['#ffd634', '#ff5fd2', '#5cff7a', '#6bc6ff', '#ffffff', '#fecc00', '#006aa7'];
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

    if (G.state === 'play' && G.lowHp) {
      G.hbT = (G.hbT || 0) + dt;
      if (G.hbT >= 0.8) {
        G.hbT -= 0.8;
        AU.sfx('heartbeat');
      }
    } else {
      G.hbT = 0;
    }

    if (G.state === 'play' && !G.freeze) {
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
      if (G.deadAge >= 0.9) {
        if (G.hpMax && G.hp <= 0) gameOver();
        else G.respawn();
      }
    } else if (G.state === 'winning' || G.state === 'won') {
      G.winAge += dt;
      const prevX = G.s.x;
      G.s.x += Ph.speedAt(G.lvl, G.s.x) * dt;
      checkScares(prevX, G.s.x); // the 'final' scare sits just after the finish line
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
    if (G.hurt) G.hurt.t += dt;
    if (G.scare) {
      const prevT = G.scare.t;
      G.scare.t += dt;
      if (G.scare.kind === 'skull' && prevT <= 0.4 && G.scare.t > 0.4) AU.sfx('scare_skull');
      if (G.scare.t > 1.2) G.scare = null;
    }
    G.flash = Math.max(0, G.flash - dt * 2.5);
    G.shake = Math.max(0, G.shake - dt);
    updateParticles(dt);
    if (G.s && (G.state === 'play' || G.state === 'winning' || G.state === 'won')) AU.update(Ph.timeAt(G.lvl, G.s.x));
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
