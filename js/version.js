// VippeDash — build version, shown faintly in the main menu so you can tell which build is running.
// tools/release.py and tools/build_single.py stamp a build date + short git commit into the built/served
// copy; in the repo it stays 'dev'. Keep the literal below on its own line so those tools can find it.
(window.VD = window.VD || {}).VERSION = 'dev';

(function () {
  // scripts run at the end of <body>, so the menu markup already exists by the time this runs
  const el = document.getElementById('version');
  if (el) el.textContent = 'v ' + window.VD.VERSION;
})();
