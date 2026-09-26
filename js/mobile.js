// VippeDash — phone extras: fullscreen + landscape on PLAY, "turn your phone" pause, back button, sound after an app switch.
// Hooks into VD.Game from the outside so game.js stays the same on desktop.
(function () {
  const VD = window.VD, G = VD.Game, AU = VD.Audio;
  const touch = matchMedia('(pointer: coarse)').matches;
  const installed = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

  // Android may suspend the AudioContext while you're in another app: wake it up when you resume
  const resume = G.resume;
  G.resume = function () {
    AU.init();
    return resume.apply(this, arguments);
  };

  if (!touch) return;

  const help = document.querySelector('#menu .help');
  if (help) help.innerHTML = 'Jump / fly / flip: <b>tap</b> or <b>hold</b> &nbsp;·&nbsp; Pause: <b>⏸</b> top right';

  // G.start always runs from a tap or key press, which is what fullscreen and the orientation lock need
  const start = G.start;
  G.start = function () {
    goFullscreen();
    guardBack();
    pauseOnRespawn = false;
    return start.apply(this, arguments);
  };
  function goFullscreen() {
    const el = document.documentElement;
    if (installed || document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  }

  // turned to portrait mid-run: pause (css/style.css shows the #rotate hint)
  const portrait = matchMedia('(orientation: portrait)');
  const onTurn = () => {
    if (portrait.matches && G.state === 'play') G.pause();
  };
  if (portrait.addEventListener) portrait.addEventListener('change', onTurn);
  else portrait.addListener(onTurn);

  // Android back button / back swipe: pause first, then main menu, instead of closing the app mid-run.
  // Mid-crash there's nothing to pause yet, so it pauses as soon as you respawn.
  let guarded = false, pauseOnRespawn = false;
  const respawn = G.respawn;
  G.respawn = function () {
    const r = respawn.apply(this, arguments);
    if (pauseOnRespawn) {
      pauseOnRespawn = false;
      G.pause();
    }
    return r;
  };
  function guardBack() {
    if (guarded) return;
    history.pushState({ vippedash: 1 }, '');
    guarded = true;
  }
  document.getElementById('shopBtn').addEventListener('click', guardBack);
  addEventListener('popstate', () => {
    guarded = false;
    if (G.shopOpen) document.getElementById('shopBack').click();
    else if (G.state === 'play' || G.state === 'dead') {
      if (G.state === 'dead') pauseOnRespawn = true;
      else G.pause();
      guardBack();
    } else if (G.state === 'paused' || G.state === 'winning' || G.state === 'won') G.toMenu();
  });
})();
