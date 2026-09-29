// VippeDash — anonymous usage logging and the top lists, container-bound Apps Script for the stats Google Sheet.
// Setup: sheets.new, Tillägg → Apps Script, paste this whole file over Code.gs, save.
// Deploy: Distribuera → Ny distribution → Webbapp, Kör som: Jag, Åtkomst: Alla.
// Copy the /exec URL into ENDPOINT at the top of js/stats.js, commit and push.
// See README.md → Statistics for the full walkthrough and how to read the sheet.

// Levels in column order. A level id seen in incoming data but missing here just gets
// appended as an extra column (named after its id), so a future level 7 shows up on its own.
const LEVELS = [['stratus', 'Stratusvägen'], ['home', 'Hem'], ['metro', 'Tunnelbanan'], ['forest', 'Skogen'], ['chess', 'Schackmatt'], ['ocean', 'Djupet'], ['nightmare', 'Mardrömmen']];

const LOG_SHEET = 'Logg';
const DAILY_SHEET = 'Per dag';
const LOG_HEADER = ['tid', 'datum', 'besökare', 'händelse', 'bana', 'plattform', 'version'];

const SPELARE_SHEET = 'Spelare';
const TOPPLISTA_SHEET = 'Topplista';
const SPELARE_HEADER = ['id', 'namn', 'nyckel', 'plattform', 'skapad', 'ändrad', 'dold'];
const TOPPLISTA_HEADER = ['bana', 'id', 'krascher', 'tid', 'datum', 'version', 'plattform', 'dold'];

const VALID_EVENTS = ['open', 'start', 'win'];
const VALID_PLATFORMS = ['pages', 'app', 'fil', 'lan', 'test'];
const ID_RE = /^[0-9a-f]{8,32}$/;
const LEVEL_RE = /^[a-z0-9_-]{0,20}$/;
const NAME_CHARS_RE = /^[A-Za-z0-9åäöÅÄÖéÉüÜ_ -]+$/;

// Leetspeak substitutions applied before checking a name against the banned-word lists,
// so e.g. "4ss" is caught the same as "ass".
const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };

// Words that are unambiguous even as a substring of a longer name (checked with indexOf).
// Owner: add more here freely — one lowercase entry per line, no leetspeak needed (that's
// normalized away before the check).
const BANNED_ANYWHERE = [
  'fuck', 'shit', 'bitch', 'whore', 'pussy', 'penis', 'vagina',
  'nigger', 'nigga', 'faggot', 'cunt', 'rapist', 'hitler', 'nazist',
  'neger', 'blatte', 'fitta', 'jävla', 'jävel', 'helvete', 'satan',
  'pedofil', 'incest', 'knulla', 'runka', 'dildo', 'porr', 'rasist',
  'zigenare', 'idiot', 'retard', 'wanker', 'asshole', 'motherfucker', 'bastard',
];

// Short/ambiguous words that would false-positive as substrings of real names (e.g. 'ass'
// would block 'Lasse', 'fan' would block 'Stefan', 'hora' would block 'Thora') — these only
// match when they equal the *entire* filter key.
const BANNED_EXACT = [
  'ass', 'sex', 'cum', 'tit', 'tits', 'clit', 'anal', 'dick', 'cock',
  'slut', 'fan', 'hora', 'kuk', 'ho',
];

// Receives events from the game. Stats batches ({id, ev}) are sent with fetch mode 'no-cors', so
// that response is never read — always 'ok', even when the payload is rejected. Leaderboard
// posts ({id, lb:'name'|'score'}) are read by the game and get a JSON answer.
function doPost(e) {
  const data = parsePostData_(e);

  if (data && (data.lb === 'name' || data.lb === 'score')) {
    try {
      const out = data.lb === 'name' ? handleNamePost(data) : handleScorePost(data);
      return jsonOutput_(out);
    } catch (err) {
      return jsonOutput_({ ok: false, err: 'server' });
    }
  }

  try {
    handleStatsEvents_(data);
  } catch (err) {
    // Never let a bad payload surface an error to the (unread) response.
  }
  return ContentService.createTextOutput('ok');
}

// Parses the POST body once, applying the existing size cap. Any missing/oversized/invalid
// body yields null so callers can fall back safely without throwing.
function parsePostData_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') return null;
  const body = e.postData.contents;
  if (body.length > 20000) return null;
  try {
    const data = JSON.parse(body);
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    return null;
  }
}

function handleStatsEvents_(data) {
  if (!data || typeof data.id !== 'string' || !ID_RE.test(data.id)) return;
  if (!Array.isArray(data.ev)) return;

  const id = data.id;
  const now = Date.now();
  const minT = now - 60 * 24 * 60 * 60 * 1000;
  const maxT = now + 24 * 60 * 60 * 1000;
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  const rows = [];
  const events = data.ev.slice(0, 200);
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    if (VALID_EVENTS.indexOf(ev.e) === -1) continue;
    if (typeof ev.l !== 'string' || !LEVEL_RE.test(ev.l)) continue;
    if (VALID_PLATFORMS.indexOf(ev.p) === -1) continue;

    let v = typeof ev.v === 'string' ? ev.v : '';
    if (v.length > 60) v = v.substring(0, 60);

    let t = typeof ev.t === 'number' && isFinite(ev.t) ? ev.t : now;
    if (t < minT || t > maxT) t = now;

    const tidDate = new Date(t);
    const datum = Utilities.formatDate(tidDate, tz, 'yyyy-MM-dd');
    rows.push([tidDate, datum, id, ev.e, ev.l, ev.p, v]);
  }

  if (rows.length === 0) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getOrCreateLogSheet();
    const startRow = sheet.getLastRow() + 1;
    // a new sheet has 1000 rows and getRange can't reach past the last one: add rows as needed
    const missing = startRow + rows.length - 1 - sheet.getMaxRows();
    if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(missing, 1000));
    // plain text for datum..version, or Sheets turns '2026-09-27' into a date and an all-digit id into a number
    sheet.getRange(startRow, 2, rows.length, LOG_HEADER.length - 1).setNumberFormat('@');
    sheet.getRange(startRow, 1, rows.length, LOG_HEADER.length).setValues(rows);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET);
    sheet.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]);
    sheet.getRange(1, 1, 1, LOG_HEADER.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Rebuilds the "Per dag" sheet from scratch out of "Logg". Idempotent, so it's safe to run
// every time the sheet is opened — late-arriving offline events just widen the table.
function updateDaily() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(LOG_SHEET);

  const header = ['datum', 'besökare', 'nya', 'spelare'];
  const levelNames = {};
  LEVELS.forEach(function (pair) { levelNames[pair[0]] = pair[1]; });
  const levelIds = LEVELS.map(function (pair) { return pair[0]; });

  // datum -> { visitors: {id: true}, players: {id: true}, started: {lvl: runs}, won: {lvl: wins} }
  const byDate = {};
  const firstSeen = {}; // id -> earliest datum
  const tz = ss.getSpreadsheetTimeZone();

  if (log && log.getLastRow() > 1) {
    const values = log.getRange(2, 1, log.getLastRow() - 1, LOG_HEADER.length).getValues();
    for (const row of values) {
      // rows written before the text format was set may have come back as a Date / number
      const datum = row[1] instanceof Date ? Utilities.formatDate(row[1], tz, 'yyyy-MM-dd') : String(row[1]);
      const id = String(row[2]), handelse = row[3], lvl = String(row[4]), plattform = row[5];
      if (plattform === 'test') continue;
      if (lvl && levelIds.indexOf(lvl) === -1) levelIds.push(lvl);
      if (!firstSeen[id] || datum < firstSeen[id]) firstSeen[id] = datum;
      const day = byDate[datum] || (byDate[datum] = { visitors: {}, players: {}, started: {}, won: {} });
      day.visitors[id] = true;
      if (handelse === 'start') {
        day.players[id] = true;
        if (lvl) day.started[lvl] = (day.started[lvl] || 0) + 1;
      }
      if (handelse === 'win' && lvl) day.won[lvl] = (day.won[lvl] || 0) + 1;
    }
  }

  levelIds.forEach(function (l) {
    header.push('startade ' + (levelNames[l] || l));
  });
  levelIds.forEach(function (l) {
    header.push('klarade ' + (levelNames[l] || l));
  });

  const dates = Object.keys(byDate).sort();
  const rows = dates.map(function (datum) {
    const day = byDate[datum];
    const nya = Object.keys(day.visitors).filter(function (id) { return firstSeen[id] === datum; }).length;
    const row = [
      datum,
      Object.keys(day.visitors).length,
      nya,
      Object.keys(day.players).length,
    ];
    levelIds.forEach(function (l) { row.push(day.started[l] || 0); });
    levelIds.forEach(function (l) { row.push(day.won[l] || 0); });
    return row;
  });

  let sheet = ss.getSheetByName(DAILY_SHEET);
  if (!sheet) sheet = ss.insertSheet(DAILY_SHEET);
  sheet.clear();
  // Keep the "datum" column as text so CSV export stays yyyy-MM-dd (not reformatted by locale).
  sheet.getRange(1, 1, 1, 1).setNumberFormat('@');
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, 1).setNumberFormat('@');
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
}

// Adds a menu so the owner can refresh "Per dag" by hand, and refreshes it on every open.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('VippeDash')
    .addItem('Uppdatera Per dag', 'updateDaily')
    .addToUi();
  try {
    updateDaily();
  } catch (err) {
    // Don't let a stale/broken Logg sheet block the menu from showing up.
  }
}

// So the owner can open the web app URL in a browser and confirm the deployment works, and
// (with ?lb=1) so the game can fetch a level's leaderboard. Must never expose any player id.
function doGet(e) {
  if (e && e.parameter && e.parameter.lb) {
    try {
      return jsonOutput_(handleLbGet(e));
    } catch (err) {
      return jsonOutput_({ ok: false, err: 'server' });
    }
  }
  return ContentService.createTextOutput('VippeDash-statistik: igång');
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------------------
// Leaderboards: player names ("Spelare") and per-level best results ("Topplista").
// ---------------------------------------------------------------------------------------

function handleLbGet(e) {
  const id = typeof e.parameter.id === 'string' && ID_RE.test(e.parameter.id) ? e.parameter.id : null;
  const includeTest = e.parameter.test === '1';
  return buildLbResponse(id, includeTest);
}

// POST {id, lb:'name', name, p, v}
function handleNamePost(data) {
  const id = typeof data.id === 'string' ? data.id : '';
  const p = data.p;
  if (!ID_RE.test(id) || VALID_PLATFORMS.indexOf(p) === -1) return { ok: false, err: 'invalid' };

  const raw = typeof data.name === 'string' ? data.name : '';
  const name = normalizeName_(raw);

  if (name.length < 2) return { ok: false, err: 'short' };
  if (name.length > 12) return { ok: false, err: 'invalid' };
  if (!NAME_CHARS_RE.test(name)) return { ok: false, err: 'invalid' };

  if (isBannedName_(makeFilterKey_(name))) return { ok: false, err: 'bad' };

  if (!checkRate_('nattempt:' + id, 30, 3600)) return { ok: false, err: 'rate' };

  const isTest = p === 'test';
  const nyckel = makeNyckel_(name);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSpelareSheet_(ss);
    const lastRow = sheet.getLastRow();
    const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, SPELARE_HEADER.length).getValues() : [];

    let ownRow = -1;
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === id) { ownRow = i; break; }
    }

    for (let j = 0; j < values.length; j++) {
      if (j === ownRow) continue;
      if (String(values[j][2]) !== nyckel) continue;
      const otherIsTest = values[j][3] === 'test';
      // real names are unique among non-test rows only; test names are unique among all rows
      // (so a test registration can never steal a real name, and a real one is never blocked
      // by a test row with the same name).
      if (isTest || !otherIsTest) return { ok: false, err: 'taken' };
    }

    if (!checkRate_('nchange:' + id, 5, 86400)) return { ok: false, err: 'rate' };

    const now = new Date();
    // text format first, then the values: otherwise Sheets turns an all-digit id or a name
    // like "007" into a number before the format applies, and the id never matches again
    if (ownRow === -1) {
      const newRow = appendRowNum_(sheet);
      sheet.getRange(newRow, 1, 1, 4).setNumberFormat('@');
      sheet.getRange(newRow, 7, 1, 1).setNumberFormat('@');
      sheet.getRange(newRow, 1, 1, SPELARE_HEADER.length).setValues([[id, name, nyckel, p, now, now, '']]);
    } else {
      const rowNum = ownRow + 2;
      sheet.getRange(rowNum, 2, 1, 3).setNumberFormat('@');
      sheet.getRange(rowNum, 2, 1, 3).setValues([[name, nyckel, p]]);
      sheet.getRange(rowNum, 6, 1, 1).setValues([[now]]);
    }
  } finally {
    lock.releaseLock();
  }

  invalidateBoardCache();
  return { ok: true, name: name };
}

// POST {id, lb:'score', l, c, t, p, v}
function handleScorePost(data) {
  const id = typeof data.id === 'string' ? data.id : '';
  const l = typeof data.l === 'string' ? data.l : '';
  const p = data.p;
  const c = data.c;
  const t = data.t;

  const validLevel = l.length > 0 && LEVEL_RE.test(l);
  const validC = typeof c === 'number' && isFinite(c) && Math.floor(c) === c && c >= 0 && c <= 999;
  const validT = typeof t === 'number' && isFinite(t) && Math.floor(t) === t && t >= 50 && t <= 36000;

  if (!ID_RE.test(id) || !validLevel || VALID_PLATFORMS.indexOf(p) === -1 || !validC || !validT) {
    return { ok: false, err: 'invalid' };
  }

  let v = typeof data.v === 'string' ? data.v : '';
  if (v.length > 60) v = v.substring(0, 60);

  if (!checkRate_('srate:' + id, 20, 600)) return { ok: false, err: 'rate' };

  const isTest = p === 'test';

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateTopplistaSheet_(ss);
    const lastRow = sheet.getLastRow();
    const values = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, TOPPLISTA_HEADER.length).getValues() : [];

    let matchRow = -1;
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]) === l && String(values[i][1]) === id) { matchRow = i; break; }
    }

    const now = new Date();
    // text format before the values (see handleNamePost)
    if (matchRow === -1) {
      const newRow = appendRowNum_(sheet);
      sheet.getRange(newRow, 1, 1, 2).setNumberFormat('@');
      sheet.getRange(newRow, 6, 1, 3).setNumberFormat('@');
      sheet.getRange(newRow, 1, 1, TOPPLISTA_HEADER.length).setValues([[l, id, c, t, now, v, p, '']]);
    } else {
      const existing = values[matchRow];
      if (isBetterResult_(c, t, Number(existing[2]), Number(existing[3]))) {
        const rowNum = matchRow + 2;
        sheet.getRange(rowNum, 6, 1, 2).setNumberFormat('@');
        sheet.getRange(rowNum, 3, 1, 5).setValues([[c, t, now, v, p]]);
      }
    }
  } finally {
    lock.releaseLock();
  }

  invalidateBoardCache();
  return buildLbResponse(id, isTest);
}

// Row number for a new row at the bottom, adding rows first if the sheet is full
// (getRange can't reach past the last row).
function appendRowNum_(sheet) {
  const row = sheet.getLastRow() + 1;
  if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
  return row;
}

function isBetterResult_(newC, newT, oldC, oldT) {
  if (newC !== oldC) return newC < oldC;
  return newT < oldT;
}

function normalizeName_(raw) {
  return raw.trim().replace(/\s+/g, ' ');
}

// Uniqueness key: lowercased, spaces/-/_ removed. No leetspeak mapping — "Kai" and "K4i"
// are different names, they just can't both slip past the word filter.
function makeNyckel_(name) {
  return name.toLowerCase().replace(/[\s_-]/g, '');
}

// Word-filter key: lowercased, leetspeak mapped to letters, spaces/-/_ removed.
function makeFilterKey_(name) {
  const lower = name.toLowerCase();
  let mapped = '';
  for (let i = 0; i < lower.length; i++) {
    const ch = lower.charAt(i);
    mapped += LEET_MAP.hasOwnProperty(ch) ? LEET_MAP[ch] : ch;
  }
  return mapped.replace(/[\s_-]/g, '');
}

function isBannedName_(key) {
  if (BANNED_EXACT.indexOf(key) !== -1) return true;
  for (let i = 0; i < BANNED_ANYWHERE.length; i++) {
    if (key.indexOf(BANNED_ANYWHERE[i]) !== -1) return true;
  }
  return false;
}

// Fixed-window rate limiter on the script cache: at most `max` hits per `windowSeconds`,
// keyed by `key` plus the current window bucket. Simple rather than a perfectly rolling
// window, which is more than good enough for abuse prevention here.
function checkRate_(key, max, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const cacheKey = key + ':' + bucket;
  const current = Number(cache.get(cacheKey) || 0);
  if (current >= max) return false;
  cache.put(cacheKey, String(current + 1), windowSeconds);
  return true;
}

function getOrCreateSpelareSheet_(ss) {
  let sheet = ss.getSheetByName(SPELARE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SPELARE_SHEET);
    sheet.getRange(1, 1, 1, SPELARE_HEADER.length).setValues([SPELARE_HEADER]);
    sheet.getRange(1, 1, 1, SPELARE_HEADER.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateTopplistaSheet_(ss) {
  let sheet = ss.getSheetByName(TOPPLISTA_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(TOPPLISTA_SHEET);
    sheet.getRange(1, 1, 1, TOPPLISTA_HEADER.length).setValues([TOPPLISTA_HEADER]);
    sheet.getRange(1, 1, 1, TOPPLISTA_HEADER.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

const BOARD_CACHE_TTL = 30; // seconds
const BOARD_CACHE_MAX_CHARS = 90000; // skip caching a blob bigger than ~90 KB

// Returns { levels: {bana: [{id,n,c,t}, ...sorted]}, byId: {id: {bana: {c,t}}}, players: {id: {n,h}} }.
// This is an internal, server-side-only structure (it carries ids for joining) — responses
// built from it must never leak the `id`/`byId` fields back to a client.
function getBoard(includeTest) {
  const key = includeTest ? 'lb1:test' : 'lb1';
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // fall through and rebuild
    }
  }

  const board = buildBoard(includeTest);
  try {
    const json = JSON.stringify(board);
    if (json.length <= BOARD_CACHE_MAX_CHARS) cache.put(key, json, BOARD_CACHE_TTL);
  } catch (err) {
    // caching is best-effort only
  }
  return board;
}

function invalidateBoardCache() {
  const cache = CacheService.getScriptCache();
  cache.remove('lb1');
  cache.remove('lb1:test');
}

function buildBoard(includeTest) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawPlayers = readSpelareMap_(ss); // id -> {namn, dold}
  const players = {};
  Object.keys(rawPlayers).forEach(function (id) {
    players[id] = { n: rawPlayers[id].namn, h: !!rawPlayers[id].dold };
  });

  const levels = {};
  const byId = {};
  const sheet = ss.getSheetByName(TOPPLISTA_SHEET);
  if (sheet && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, TOPPLISTA_HEADER.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const bana = String(row[0]), id = String(row[1]);
      if (!bana || !id) continue;
      const c = Number(row[2]), t = Number(row[3]);
      const datum = row[4] instanceof Date ? row[4] : new Date(row[4]);
      const plattform = row[6], dold = row[7];

      byId[id] = byId[id] || {};
      byId[id][bana] = { c: c, t: t };

      if (dold) continue; // this score row itself is hidden
      if (plattform === 'test' && !includeTest) continue;
      const player = rawPlayers[id];
      if (!player || !player.namn || player.dold) continue;

      (levels[bana] || (levels[bana] = [])).push({ id: id, n: player.namn, c: c, t: t, d: datum.getTime() });
    }
  }

  Object.keys(levels).forEach(function (bana) {
    levels[bana].sort(function (a, b) {
      if (a.c !== b.c) return a.c - b.c;
      if (a.t !== b.t) return a.t - b.t;
      return a.d - b.d; // earlier datum wins a tie
    });
    levels[bana].forEach(function (row) { delete row.d; });
  });

  return { levels: levels, byId: byId, players: players };
}

function readSpelareMap_(ss) {
  const sheet = ss.getSheetByName(SPELARE_SHEET);
  const map = {};
  if (sheet && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, SPELARE_HEADER.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const id = String(values[i][0]);
      if (!id) continue;
      map[id] = { namn: String(values[i][1] || ''), dold: values[i][6] };
    }
  }
  return map;
}

// Builds the JSON payload for both `GET ?lb=1` and a successful score POST. Never includes
// any player id.
function buildLbResponse(id, includeTest) {
  const board = getBoard(includeTest);

  const levelsOut = {};
  Object.keys(board.levels).forEach(function (bana) {
    const rows = board.levels[bana];
    if (!rows || rows.length === 0) return;
    levelsOut[bana] = rows.slice(0, 10).map(function (row) {
      const out = { n: row.n, c: row.c, t: row.t };
      if (id && row.id === id) out.me = true;
      return out;
    });
  });

  const mine = {};
  const own = id ? board.byId[id] : null;
  if (own) {
    Object.keys(own).forEach(function (bana) {
      const rows = board.levels[bana] || [];
      let rank = null;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id === id) { rank = i + 1; break; }
      }
      mine[bana] = { r: rank, c: own[bana].c, t: own[bana].t };
    });
  }

  const player = id ? board.players[id] : null;
  const out = { ok: true, name: player ? player.n : null };
  if (player && player.h) out.hidden = true;
  out.levels = levelsOut;
  out.mine = mine;
  return out;
}
