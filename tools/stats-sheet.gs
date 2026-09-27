// VippeDash — anonymous usage logging, container-bound Apps Script for the stats Google Sheet.
// Setup: sheets.new, Tillägg → Apps Script, paste this whole file over Code.gs, save.
// Deploy: Distribuera → Ny distribution → Webbapp, Kör som: Jag, Åtkomst: Alla.
// Copy the /exec URL into ENDPOINT at the top of js/stats.js, commit and push.
// See README.md → Statistics for the full walkthrough and how to read the sheet.

// Levels in column order. A level id seen in incoming data but missing here just gets
// appended as an extra column (named after its id), so a future level 5 shows up on its own.
const LEVELS = [['home', 'Hem'], ['metro', 'Tunnelbanan'], ['forest', 'Skogen'], ['nightmare', 'Mardrömmen']];

const LOG_SHEET = 'Logg';
const DAILY_SHEET = 'Per dag';
const LOG_HEADER = ['tid', 'datum', 'besökare', 'händelse', 'bana', 'plattform', 'version'];

const VALID_EVENTS = ['open', 'start', 'win'];
const VALID_PLATFORMS = ['pages', 'app', 'fil', 'lan', 'test'];
const ID_RE = /^[0-9a-f]{8,32}$/;
const LEVEL_RE = /^[a-z0-9_-]{0,20}$/;

// Receives events from the game (fetch mode 'no-cors', so the response body is never read
// by the caller — always return 'ok', even when the payload is rejected).
function doPost(e) {
  try {
    handlePost(e);
  } catch (err) {
    // Never let a bad payload surface an error to the (unread) response.
  }
  return ContentService.createTextOutput('ok');
}

function handlePost(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') return;
  const body = e.postData.contents;
  if (body.length > 20000) return;

  let data;
  try {
    data = JSON.parse(body);
  } catch (err) {
    return;
  }
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

// So the owner can open the web app URL in a browser and confirm the deployment works.
// Must never expose any logged data.
function doGet() {
  return ContentService.createTextOutput('VippeDash-statistik: igång');
}
