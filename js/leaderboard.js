// VippeDash — player names + per-level top-10 leaderboards.
// Talks to the same Google Apps Script endpoint as js/stats.js (see README → Statistics), reusing its
// visitor id and on/off logic. Three test modes, chosen from the URL like the other debug flags:
//   ?lbmock  — an in-memory fake server (no network at all), seeded with a dozen fake players
//   ?lbtest  — the real server, but marked p:'test' so it doesn't pollute real leaderboard rows
//   (none)   — 'live' when stats logging is on, otherwise 'off' (localhost, ?debug, headless tools...)
// Mock/test board data lives under its own localStorage prefix so it never mixes with real local data.
(function () {
  const VD = window.VD, G = VD.Game, Stats = VD.Stats;
  if (!G) return; // loads after game.js; nothing to hook if that somehow isn't true

  const params = location.hash + location.search;
  const MODE = /lbmock/.test(params) ? 'mock' : /lbtest/.test(params) ? 'test' : Stats && !Stats.off() ? 'live' : 'off';
  const MOCK_OFFLINE = MODE === 'mock' && /lbmock=offline/.test(params);
  // debug-only screenshot helper: index.html?debug&lbmock&lbname=Micke shows the chip/menu already named,
  // without having to drive the name dialog by hand. Never touches real (non-mock/test) local data.
  const debugName = /debug/.test(params) ? /[?&#]lbname=([^&]+)/.exec(params) : null;
  // debug-only: skip straight past the "first ever win" name prompt (as if it had already been shown),
  // for screenshotting the ordinary win-screen states.
  const debugAsked = /debug/.test(params) && /[?&#]lbasked\b/.test(params);

  // board data (name/queue/cache) is namespaced per mode so ?lbmock / ?lbtest never touch real saves
  const PREFIX = MODE === 'mock' ? 'vippedash.lbmock.' : MODE === 'test' ? 'vippedash.lbtest.' : 'vippedash.';
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
      } catch (e) {
        /* storage unavailable: ignore */
      }
    },
  };
  const $ = (id) => document.getElementById(id);

  function getName() { return store.get('name', null); }
  function setName(v) { store.set('name', v); }

  function myId() { return Stats ? Stats.id() : 'anon'; }
  // live sends the real platform; test/mock are always tagged 'test' so the sheet can tell them apart
  function platformFor() { return MODE === 'live' ? (Stats ? Stats.platform() : 'lan') : 'test'; }

  // a run only counts for the *live* leaderboard if it's a genuine, uncheated run; test/mock accept
  // anything (including bot/debug/god runs) so they're actually usable for testing.
  function eligible() {
    if (MODE === 'off') return false;
    if (MODE === 'live') return !G.debug && !G.bot && !G.god;
    return true;
  }

  // ------------------------------------------------------------------ name validation (shared client/mock)
  const NAME_RE = /^[a-zA-Z0-9åäöÅÄÖéÉüÜ _-]+$/;
  function normalizeName(raw) {
    return (raw || '').trim().replace(/\s+/g, ' ');
  }
  function validateName(name) {
    if (name.length < 2) return 'short';
    if (!NAME_RE.test(name) || name.length > 12) return 'invalid';
    return null;
  }
  const MSG = {
    taken: 'That name is taken – try another',
    bad: 'Pick a different name',
    short: 'Too short',
    invalid: 'Only letters, numbers, space, - and _',
    rate: 'Too many tries – wait a bit',
  };

  // ------------------------------------------------------------------ real server calls (live + test)
  function apiGet() {
    const url = Stats.endpoint + '?lb=1&id=' + encodeURIComponent(myId()) + (MODE === 'test' ? '&test=1' : '');
    return fetch(url, { method: 'GET', mode: 'cors' }).then((r) => r.json());
  }
  function apiPost(body) {
    return fetch(Stats.endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  // ------------------------------------------------------------------ mock server (?lbmock)
  // In-memory only: resets on reload. Seeded with a dozen fake players so the board looks alive;
  // 'nightmare' is left empty on purpose to show the empty state.
  const Mock = (function () {
    const SEED = {
      home: [['Affe', 0, 1046], ['Lisa', 0, 1078], ['Olle', 1, 1090], ['Kim', 1, 1115], ['Saga', 2, 1140], ['Nils', 2, 1163], ['Ebba', 3, 1195], ['Theo', 3, 1220], ['Maja', 4, 1255]],
      metro: [['Affe', 0, 742], ['Lisa', 0, 758], ['Olle', 0, 771], ['Kim', 1, 780], ['Saga', 1, 795], ['Nils', 1, 812], ['Ebba', 2, 830], ['Theo', 2, 845], ['Maja', 3, 860], ['Leo', 3, 878], ['Alva', 4, 900], ['Viggo', 5, 930]],
      forest: [['Lisa', 0, 812], ['Kim', 0, 825], ['Saga', 1, 840], ['Nils', 1, 858], ['Ebba', 2, 880], ['Theo', 3, 905], ['Maja', 4, 930]],
      chess: [['Affe', 1, 845], ['Olle', 1, 860], ['Saga', 2, 880], ['Theo', 3, 905], ['Leo', 4, 930], ['Alva', 5, 960]],
      ocean: [['Kim', 1, 850], ['Nils', 2, 875], ['Ebba', 2, 890], ['Maja', 3, 915], ['Viggo', 4, 945]],
      nightmare: [],
    };
    // scores never store the name inline — it's looked up live via `names[id]`, so registering a name
    // after a score was submitted still makes that earlier score show up (matches the real server, which
    // joins on id rather than freezing the name at submit time).
    const names = {}, taken = {}, scores = {};
    for (const levelId of Object.keys(SEED)) {
      scores[levelId] = SEED[levelId].map(([name, c, t]) => {
        const id = 'seed:' + name;
        names[id] = name;
        taken[name.toLowerCase()] = id;
        return { id, c, t };
      });
    }

    function offline() { return MOCK_OFFLINE; }
    function delayed(fn) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (offline()) reject(new Error('mock offline'));
          else resolve(fn());
        }, 400);
      });
    }
    function rankOf(levelId) {
      return (scores[levelId] || []).slice().sort((a, b) => a.c - b.c || a.t - b.t);
    }
    function get(id) {
      const levels = {}, mine = {};
      for (const levelId of Object.keys(scores)) {
        // like the server: only players with a name are ranked; without one, r is null
        const all = rankOf(levelId), ranked = all.filter((e) => names[e.id]);
        levels[levelId] = ranked
          .slice(0, 10)
          .map((e) => (e.id === id ? { n: names[e.id], c: e.c, t: e.t, me: true } : { n: names[e.id], c: e.c, t: e.t }));
        const own = all.find((e) => e.id === id), idx = ranked.findIndex((e) => e.id === id);
        if (own) mine[levelId] = { r: idx >= 0 ? idx + 1 : null, c: own.c, t: own.t };
      }
      return { ok: true, name: names[id] || null, hidden: false, levels, mine };
    }
    function postName(id, name) {
      const err = validateName(name);
      if (err) return { ok: false, err: err };
      if (/bajs/i.test(name)) return { ok: false, err: 'bad' };
      const lower = name.toLowerCase(), owner = taken[lower];
      if (owner && owner !== id) return { ok: false, err: 'taken' };
      const prev = names[id];
      if (prev) delete taken[prev.toLowerCase()];
      names[id] = name;
      taken[lower] = id;
      return { ok: true, name: name };
    }
    function postScore(id, levelId, c, t) {
      if (!scores[levelId]) scores[levelId] = [];
      const arr = scores[levelId], i = arr.findIndex((e) => e.id === id);
      if (i >= 0) {
        if (c < arr[i].c || (c === arr[i].c && t < arr[i].t)) arr[i] = { id, c, t };
      } else {
        arr.push({ id, c, t });
      }
      return get(id);
    }
    return {
      get: (id) => delayed(() => get(id)),
      postName: (id, name) => delayed(() => postName(id, name)),
      postScore: (id, levelId, c, t) => delayed(() => postScore(id, levelId, c, t)),
    };
  })();

  // ------------------------------------------------------------------ network helpers shared by both modes
  function fetchBoard() {
    const p = MODE === 'mock' ? Mock.get(myId()) : MODE === 'test' || MODE === 'live' ? apiGet() : Promise.reject(new Error('off'));
    return p.then(
      (res) => {
        lastFetchFailed = false;
        if (res && res.ok) {
          cache = { at: Date.now(), data: res };
          store.set('lbCache', cache);
          adoptServerName(res);
        }
        afterRefresh();
        return res;
      },
      () => {
        lastFetchFailed = true;
        afterRefresh();
      }
    );
  }
  function registerName(name) {
    if (MODE === 'off') return Promise.resolve({ offline: true }); // 'off' means no network at all, ever
    const id = myId();
    const p = MODE === 'mock' ? Mock.postName(id, name) : apiPost({ id: id, lb: 'name', name: name, p: platformFor(), v: VD.VERSION });
    return p.then((r) => r, () => ({ offline: true }));
  }
  function sendScore(levelId, c, t) {
    if (MODE === 'off') return Promise.resolve({ offline: true });
    const id = myId();
    const p = MODE === 'mock' ? Mock.postScore(id, levelId, c, t) : apiPost({ id: id, lb: 'score', l: levelId, c: c, t: t, p: platformFor(), v: VD.VERSION });
    return p.then((r) => r, () => ({ offline: true }));
  }
  function adoptServerName(res) {
    if (!res || typeof res.name === 'undefined') return;
    const nm = getName();
    if (nm && nm.status === 'pending') return; // a rename is still waiting to be sent: don't undo it
    if (res.name != null) {
      if (!nm || nm.name !== res.name || nm.status !== 'ok') setName({ name: res.name, status: 'ok' });
    } else if (nm && nm.status === 'ok' && !res.hidden) {
      // we think we're registered, the server disagrees (e.g. cleared on the server side): try again
      setName({ name: nm.name, status: 'pending' });
    }
  }
  // after a name is (re)registered, the board cache's rows for it are stale until the next GET —
  // refresh it so "switch to the list with the player highlighted" (per the win-screen spec) actually
  // shows the row instead of waiting for the next menu visit.
  function refreshAfterNameChange(levelId) {
    renderWin(levelId);
    if (MODE !== 'off') fetchBoard().then(() => { if (G.state === 'won' && G.levelDef.id === levelId) renderWin(levelId); });
  }
  function afterRefresh() {
    refreshChip();
    if (boardOpen) renderBoard();
    if (G.state === 'menu' && G.refreshMenu) G.refreshMenu();
  }

  // ------------------------------------------------------------------ boot: flush pending state, then GET
  function flushPendingName() {
    const nm = getName();
    if (!nm || nm.status !== 'pending') return Promise.resolve();
    return registerName(nm.name).then((res) => {
      if (res.offline) return;
      if (res.ok) setName({ name: res.name, status: 'ok' });
      else if (res.err === 'taken') setName({ name: nm.name, status: 'taken' });
      // other errors (bad/invalid/short/rate): leave it pending, try again next time
    });
  }
  function flushQueue() {
    const q = store.get('lbQueue', {});
    const ids = Object.keys(q);
    let chain = Promise.resolve();
    ids.forEach((levelId) => {
      const entry = q[levelId];
      chain = chain.then(() =>
        sendScore(levelId, entry.c, entry.t).then((res) => {
          if (res.offline) return;
          const q2 = store.get('lbQueue', {});
          if (q2[levelId] && q2[levelId].c === entry.c && q2[levelId].t === entry.t) {
            delete q2[levelId];
            store.set('lbQueue', q2);
          }
          if (res.ok) {
            cache = { at: Date.now(), data: res };
            store.set('lbCache', cache);
            adoptServerName(res);
          }
        })
      );
    });
    return chain;
  }
  function flushAll() {
    if (MODE === 'off') return;
    flushPendingName().then(flushQueue).then(fetchBoard).catch(() => {});
  }

  let cache = store.get('lbCache', null);
  let lastFetchFailed = false;
  let boardOpen = false, nameDlgOpen = false;
  let curBoardLevel = null, tabsBuilt = false;
  let lastWin = null; // { levelId, c, t, newBest, send: 'sending'|'done'|'offline', resp }
  let winPromptShown = false; // true while the first-ever-win name prompt is up, so async updates don't clobber it

  // ------------------------------------------------------------------ formatting helpers
  function fmtTime(t) {
    const m = Math.floor(t / 600), rest = t - m * 600, s = Math.floor(rest / 10), d = rest % 10;
    return m + ':' + ('0' + s).slice(-2) + '.' + d;
  }
  function fmtCrashes(c) { return c + (c === 1 ? ' crash' : ' crashes'); }
  const DIFF_COLOR = { 1: '#3f8cff', 2: '#2ea84a', 3: '#d2412f', 4: '#a8241c', 5: '#7a0010' }; // matches .lnum in style.css

  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  // one leaderboard row: rank, name, crashes, time — always textContent, never innerHTML with server strings
  function buildRow(rank, name, c, t, isMe) {
    const row = document.createElement('div');
    row.className = 'brow' + (isMe ? ' me' : '');
    const rankEl = document.createElement('span');
    rankEl.className = 'brank';
    rankEl.textContent = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : String(rank);
    const nameEl = document.createElement('span');
    nameEl.className = 'bname';
    nameEl.textContent = name;
    const cEl = document.createElement('span');
    cEl.className = 'bcrash';
    cEl.textContent = fmtCrashes(c);
    const tEl = document.createElement('span');
    tEl.className = 'btime';
    tEl.textContent = fmtTime(t);
    row.append(rankEl, nameEl, cEl, tEl);
    return row;
  }

  // ------------------------------------------------------------------ board overlay (menu → Top 10)
  function buildTabs() {
    const box = $('boardTabs');
    box.innerHTML = '';
    for (const L of VD.LEVELS) {
      const b = document.createElement('button');
      b.className = 'boardtab';
      b.dataset.id = L.id;
      b.title = L.name;
      const badge = document.createElement('span');
      badge.className = 'lnum';
      badge.style.background = DIFF_COLOR[L.difficulty] || DIFF_COLOR[1];
      badge.textContent = L.num;
      b.appendChild(badge);
      b.onclick = () => selectBoardLevel(L.id);
      box.appendChild(b);
    }
    tabsBuilt = true;
  }
  function selectBoardLevel(id) {
    curBoardLevel = id;
    for (const b of document.querySelectorAll('.boardtab')) b.classList.toggle('on', b.dataset.id === id);
    renderBoard();
  }
  function renderBoard() {
    const levelId = curBoardLevel;
    const def = VD.levelDef(levelId);
    $('boardSub').textContent = def.name + ' · ' + '★'.repeat(def.difficulty) + ' ' + def.diffName;
    const list = $('boardList');
    list.innerHTML = '';
    const data = cache && cache.data;
    const rows = (data && data.levels && data.levels[levelId]) || [];
    const mine = data && data.mine && data.mine[levelId];
    const myName = data && data.name;
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'boardempty';
      p.textContent = 'No one has cleared this level yet – be the first!';
      list.appendChild(p);
    } else {
      rows.forEach((row, i) => list.appendChild(buildRow(i + 1, row.n, row.c, row.t, !!row.me)));
      if (mine && mine.r > 10) {
        list.appendChild(Object.assign(document.createElement('div'), { className: 'bsep' }));
        list.appendChild(buildRow(mine.r, myName || '', mine.c, mine.t, true));
      }
    }
    if (mine && !myName) {
      const row = document.createElement('div');
      row.className = 'brow me noname';
      const nameEl = document.createElement('span');
      nameEl.className = 'bname';
      nameEl.textContent = '(you)';
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = '✏️ Choose a name to show up';
      btn.onclick = () => openName();
      row.append(nameEl, btn);
      list.appendChild(row);
    }
    const status = $('boardStatus');
    if (MODE === 'off') status.textContent = 'Top lists are offline here';
    else if (lastFetchFailed) status.textContent = cache ? 'Offline – showing saved list' : 'Offline';
    else if (!cache) status.textContent = 'Loading…';
    else {
      const d = new Date(cache.at);
      status.textContent = 'Updated ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
  }
  function openBoard(levelId) {
    if (!tabsBuilt) buildTabs();
    curBoardLevel = levelId || curBoardLevel || (G.levelDef && G.levelDef.id) || VD.LEVELS[0].id;
    boardOpen = true;
    show('board', true);
    if (VD.guardBack) VD.guardBack();
    selectBoardLevel(curBoardLevel);
    if (MODE !== 'off') fetchBoard();
  }

  // ------------------------------------------------------------------ name dialog
  function openName() {
    nameDlgOpen = true;
    const nm = getName();
    $('nameInput').value = (nm && nm.name) || '';
    $('nameError').textContent = '';
    $('nameStatus').textContent = '';
    show('nameDlg', true);
    if (VD.guardBack) VD.guardBack();
    setTimeout(() => { $('nameInput').focus(); $('nameInput').select(); }, 0);
  }
  function saveName() {
    const norm = normalizeName($('nameInput').value);
    const err = validateName(norm);
    if (err) { $('nameError').textContent = MSG[err]; return; }
    $('nameError').textContent = '';
    $('nameStatus').textContent = 'Checking…';
    $('nameSave').disabled = true;
    registerName(norm).then((res) => {
      $('nameSave').disabled = false;
      $('nameStatus').textContent = '';
      if (res.offline) {
        setName({ name: norm, status: 'pending' });
        refreshChip();
        close();
        return;
      }
      if (res.ok) {
        setName({ name: res.name, status: 'ok' });
        refreshChip();
        close();
        if (boardOpen) renderBoard();
        if (G.state === 'won') refreshAfterNameChange(G.levelDef.id);
      } else {
        $('nameError').textContent = MSG[res.err] || MSG.bad;
      }
    });
  }
  function nameStatus() {
    const nm = getName();
    return nm ? nm.status : null;
  }

  function close() {
    if (nameDlgOpen) { nameDlgOpen = false; show('nameDlg', false); return; }
    if (boardOpen) { boardOpen = false; show('board', false); }
  }
  function isOpen() { return boardOpen || nameDlgOpen; }
  function key(e) {
    if (!isOpen()) return false;
    if (nameDlgOpen) {
      if (e.code === 'Escape') { e.preventDefault(); close(); }
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); saveName(); }
      return true;
    }
    if (e.code === 'Escape' || e.code === 'Backspace') close();
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const ids = VD.LEVELS.map((L) => L.id), i = ids.indexOf(curBoardLevel);
      selectBoardLevel(ids[(i + (e.code === 'ArrowLeft' ? ids.length - 1 : 1)) % ids.length]);
    }
    return true;
  }

  function refreshChip() {
    const chip = $('nameChip');
    if (!chip) return;
    const nm = getName();
    if (!nm || !nm.name) chip.textContent = '👤 Choose a name';
    else if (nm.status === 'taken') chip.textContent = '👤 ' + nm.name + ' ✏️ ⚠ Name taken';
    else if (nm.status === 'pending') chip.textContent = '👤 ' + nm.name + ' ✏️ ⏳';
    else chip.textContent = '👤 ' + nm.name + ' ✏️';
  }

  // ------------------------------------------------------------------ win screen right column
  function onWin(levelId, c, t, newBest) {
    lastWin = { levelId: levelId, c: c, t: t, newBest: newBest, send: 'idle', resp: null };
    if (!eligible()) return;
    const q = store.get('lbQueue', {});
    const cur = q[levelId];
    if (!cur || c < cur.c || (c === cur.c && t < cur.t)) {
      q[levelId] = { c: c, t: t };
      store.set('lbQueue', q);
    }
    lastWin.send = 'sending';
    sendScore(levelId, c, t).then((res) => {
      if (!(lastWin && lastWin.levelId === levelId && lastWin.c === c && lastWin.t === t)) return; // a newer win superseded this one
      lastWin.send = res.offline ? 'offline' : 'done';
      lastWin.resp = res;
      if (!res.offline) {
        const q2 = store.get('lbQueue', {});
        if (q2[levelId] && q2[levelId].c === c && q2[levelId].t === t) { delete q2[levelId]; store.set('lbQueue', q2); }
        if (res.ok) { cache = { at: Date.now(), data: res }; store.set('lbCache', cache); adoptServerName(res); refreshChip(); }
      }
      // don't clobber the first-ever-win name prompt if it's still up when the response comes back
      if (G.state === 'won' && G.levelDef.id === levelId && !winPromptShown) renderWin(levelId);
    });
  }

  function renderWin(levelId) {
    const el = $('winBoard');
    el.innerHTML = '';
    const def = VD.levelDef(levelId);
    const title = document.createElement('div');
    title.className = 'wbtitle';
    title.textContent = '🏆 Top 10 · ' + def.name;
    el.appendChild(title);

    if (MODE === 'off') {
      winPromptShown = false;
      const p = document.createElement('p');
      p.className = 'wbstatus';
      const br = G.progress[levelId] && G.progress[levelId].bestRun;
      p.textContent = br ? 'Your best: ' + fmtCrashes(br.c) + ' · ' + fmtTime(br.t) : 'Top lists are offline here';
      el.appendChild(p);
      return;
    }

    const nm = getName();
    const askedBefore = store.get('lbAsked', false);
    if (!askedBefore) store.set('lbAsked', true);
    const isThisWin = lastWin && lastWin.levelId === levelId;
    if (!askedBefore && !(nm && nm.name) && isThisWin) {
      winPromptShown = true;
      renderFirstNamePrompt(el, levelId);
      return;
    }
    winPromptShown = false;

    el.appendChild(renderStatusLine(levelId));
    el.appendChild(renderCompactList(levelId));
    if (!(nm && nm.name)) {
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = '✏️ Choose a name to join';
      btn.onclick = () => openName();
      el.appendChild(btn);
    }
  }

  function renderStatusLine(levelId) {
    const p = document.createElement('p');
    p.className = 'wbstatus';
    const lw = lastWin && lastWin.levelId === levelId ? lastWin : null;
    if (lw && lw.send === 'sending') {
      const spin = document.createElement('span');
      spin.className = 'spinner';
      p.appendChild(spin);
      p.appendChild(document.createTextNode('Sending your time…'));
    } else if (lw && lw.send === 'offline') {
      p.textContent = 'Saved – sent when you’re online';
    } else if (lw && lw.send === 'done') {
      let mine = lw.resp && lw.resp.mine && lw.resp.mine[levelId];
      // a name chosen after the score was sent: the rank only exists in the newer board fetch
      const fresh = cache && cache.data && cache.data.mine && cache.data.mine[levelId];
      if (fresh && fresh.r && !(mine && mine.r)) mine = fresh;
      if (lw.newBest && mine && mine.r) p.textContent = '⭐ New best! You’re #' + mine.r;
      else if (mine && !lw.newBest) p.textContent = 'Your best: ' + fmtCrashes(mine.c) + ' · ' + fmtTime(mine.t) + (mine.r ? ' (#' + mine.r + ')' : '');
      else p.textContent = lw.newBest ? '⭐ New best!' : '';
    } else {
      const br = G.progress[levelId] && G.progress[levelId].bestRun;
      p.textContent = br ? 'Your best: ' + fmtCrashes(br.c) + ' · ' + fmtTime(br.t) : '';
    }
    return p;
  }
  function renderCompactList(levelId) {
    const wrap = document.createElement('div');
    wrap.className = 'wblist';
    const data = cache && cache.data;
    const rows = (data && data.levels && data.levels[levelId]) || [];
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'boardempty';
      p.textContent = 'No one has cleared this level yet!';
      wrap.appendChild(p);
    } else {
      rows.forEach((row, i) => wrap.appendChild(buildRow(i + 1, row.n, row.c, row.t, !!row.me)));
    }
    return wrap;
  }
  function renderFirstNamePrompt(el, levelId) {
    const p = document.createElement('p');
    p.className = 'wbprompt';
    p.textContent = 'Get on the top list!';
    el.appendChild(p);
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.className = 'nameinput';
    input.autocomplete = 'off';
    input.autocapitalize = 'words';
    input.enterKeyHint = 'done';
    el.appendChild(input);
    const err = document.createElement('p');
    err.className = 'nameerror';
    el.appendChild(err);
    const row = document.createElement('div');
    row.className = 'namebtns';
    const save = document.createElement('button');
    save.className = 'btn big small';
    save.textContent = '✓ Save';
    const skip = document.createElement('a');
    skip.href = '#';
    skip.className = 'skiplink';
    skip.textContent = 'Skip';
    row.append(save, skip);
    el.appendChild(row);
    // focus it for keyboard players, but never on a phone: that would pop up the keyboard unasked
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => input.focus(), 0);
    input.addEventListener('focus', () => document.documentElement.classList.add('typing'));
    input.addEventListener('blur', () => document.documentElement.classList.remove('typing'));
    function doSave() {
      const norm = normalizeName(input.value);
      const localErr = validateName(norm);
      if (localErr) { err.textContent = MSG[localErr]; return; }
      err.textContent = '';
      save.disabled = true;
      registerName(norm).then((res) => {
        save.disabled = false;
        if (res.offline) {
          setName({ name: norm, status: 'pending' });
          refreshChip();
          renderWin(levelId);
          return;
        }
        if (res.ok) {
          setName({ name: res.name, status: 'ok' });
          refreshChip();
          refreshAfterNameChange(levelId);
        } else {
          err.textContent = MSG[res.err] || MSG.bad;
        }
      });
    }
    save.onclick = doSave;
    input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); doSave(); }
      else if (e.code === 'Escape') { e.preventDefault(); input.blur(); renderWin(levelId); } // same as Skip
    });
    skip.onclick = (e) => { e.preventDefault(); renderWin(levelId); };
  }

  // ------------------------------------------------------------------ wiring
  function bindUI() {
    $('nameChip').onclick = () => openName();
    $('boardBtn').onclick = () => openBoard(G.levelDef.id);
    $('boardBack').onclick = () => close();
    $('boardName').onclick = () => openName();
    $('nameSave').onclick = () => saveName();
    $('nameCancel').onclick = () => close();
    // while the name field is focused, hide the mobile "turn your phone" hint (see style.css)
    $('nameInput').addEventListener('focus', () => document.documentElement.classList.add('typing'));
    $('nameInput').addEventListener('blur', () => document.documentElement.classList.remove('typing'));
    refreshChip();
  }
  if (debugName) setName({ name: decodeURIComponent(debugName[1]), status: 'ok' });
  if (debugAsked) store.set('lbAsked', true);
  bindUI();

  const init = G.init;
  G.init = function () {
    const r = init.apply(this, arguments);
    flushAll();
    return r;
  };
  addEventListener('online', flushAll);

  VD.Board = {
    isOpen: isOpen,
    key: key,
    close: close,
    openBoard: openBoard,
    openName: openName,
    onWin: onWin,
    renderWin: renderWin,
    rankOf: function (levelId) {
      const m = cache && cache.data && cache.data.mine && cache.data.mine[levelId];
      return m ? m.r : null;
    },
    refreshChip: refreshChip,
    nameStatus: nameStatus,
  };
})();
