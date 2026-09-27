// VippeDash — anonymous usage logging: counts page opens, level starts and level wins.
// Batches land in localStorage and are POSTed to a small Google Apps Script endpoint (see README → Statistics);
// with ENDPOINT empty, logging is entirely off. No personal data: just a random per-device id so repeat visits
// from the same phone/browser aren't double-counted. Wraps G.start from the outside, like mobile.js does.
(function () {
  const VD = window.VD, G = VD.Game;
  if (!G) return; // stats.js loads after game.js; nothing to hook if that somehow isn't true

  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbysvGw5wne0Dt36ajzKQzcCrys4f2r10g8nnZflivLDl8W2Wzqk33EQr5a-1onkNQ9Qqg/exec'; // Google Apps Script web app URL (ends in /exec) — see README → Statistics. Empty = logging off.

  const params = location.hash + location.search;
  const debugMode = /debug/.test(params);
  const dryRun = /statstest/.test(params); // ?statstest: log to the console + VD.Stats.sent instead of sending

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

  // 12 lowercase hex chars, not crypto.randomUUID (missing on file:// and plain-http LAN pages).
  function randomId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }
  function visitorId() {
    let id = store.get('statsId', null);
    if (!id) {
      id = randomId();
      store.set('statsId', id);
    }
    return id;
  }

  // 'fil' opened from disk, 'app' installed PWA (incl. over USB port forwarding, still standalone),
  // 'pages' the GitHub Pages site, 'lan' any other http(s) host (e.g. plain phone-on-Wi-Fi testing),
  // or '' for a plain localhost dev tab — that one's not a real visit, so logging is off for it.
  function platform() {
    if (location.protocol === 'file:') return 'fil';
    if (matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches) return 'app';
    const host = location.hostname;
    if (/github\.io$/.test(host)) return 'pages';
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') return '';
    return 'lan';
  }

  function isOff() {
    if (dryRun) return false; // ?statstest overrides every off-condition below
    return (
      !ENDPOINT ||
      debugMode ||
      navigator.webdriver ||
      /HeadlessChrome/.test(navigator.userAgent) ||
      platform() === ''
    );
  }

  let inFlight = false, pendingMore = false;

  function send(batch) {
    if (dryRun) {
      try {
        for (let i = 0; i < batch.length; i++) console.log('[stats]', batch[i]);
        VD.Stats.sent.push.apply(VD.Stats.sent, batch);
      } catch (e) {
        /* ignore: dry-run logging must never break the game */
      }
      return Promise.resolve();
    }
    try {
      const body = JSON.stringify({ id: visitorId(), ev: batch });
      return fetch(ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function flush() {
    if (isOff()) return;
    if (inFlight) {
      pendingMore = true;
      return;
    }
    const q = store.get('statsQueue', []);
    if (!q.length) return;
    const batch = q.slice();
    inFlight = true;
    send(batch).then(
      () => {
        inFlight = false;
        // remove exactly the sent events from the front; more may have been queued meanwhile
        const cur = store.get('statsQueue', []);
        store.set('statsQueue', cur.slice(batch.length));
        if (pendingMore) {
          pendingMore = false;
          flush();
        }
      },
      () => {
        // offline (or a bad endpoint): keep them queued, they go out with the next flush
        inFlight = false;
        if (pendingMore) {
          pendingMore = false;
          flush();
        }
      }
    );
  }
  addEventListener('online', flush);

  function log(e, l) {
    try {
      if (isOff()) return;
      const p = platform();
      const payload = { t: Date.now(), e: e, l: l || '', p: dryRun ? p || 'test' : p, v: VD.VERSION };
      if (dryRun) {
        send([payload]);
        return;
      }
      const q = store.get('statsQueue', []);
      q.push(payload);
      while (q.length > 300) q.shift(); // cap the queue, drop the oldest
      store.set('statsQueue', q);
      flush();
    } catch (err) {
      /* logging must never throw into the game */
    }
  }

  // endpoint/id/platform/off are exposed so js/leaderboard.js can reuse the same visitor id and
  // on/off logic instead of duplicating it. No behaviour change here otherwise.
  VD.Stats = { log: log, endpoint: ENDPOINT, id: visitorId, platform: platform, off: isOff };
  if (dryRun) VD.Stats.sent = [];

  // G.start always runs when a level begins (menu PLAY, restart, next level, debug warp...).
  // Read G.levelDef.id after the real start has run: nextLevel() calls selectLevel() before G.start().
  const start = G.start;
  G.start = function () {
    const r = start.apply(this, arguments);
    log('start', G.levelDef.id);
    return r;
  };

  log('open'); // once per page load
})();
