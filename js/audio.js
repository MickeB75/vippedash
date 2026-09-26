// VippeDash — procedural chiptune soundtrack + sound effects (WebAudio, no files needed)
// The song is locked to the level: 156 BPM, 1 bar = 16 blocks, so obstacles sit on the beat.
(function () {
  const VD = (window.VD = window.VD || {});
  const BPM = 156;
  const STEP = 60 / BPM / 4; // one 16th note
  const A = (VD.Audio = { muted: false, ctx: null, playing: false, STEP });

  // ---------- song data ----------
  const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function midi(name) {
    const m = /^([A-G]#?)(-?\d)$/.exec(name);
    return 12 * (+m[2] + 1) + NOTE[m[1]];
  }
  // melody strings: 8 eighth-notes per bar, bars separated by |. '-' = hold, '.' = rest
  function parseMelody(str) {
    const bars = str.split('|').map((b) => b.trim().split(/\s+/));
    const out = []; // per bar: array of {slot, midi, len}
    for (const bar of bars) {
      const notes = [];
      let cur = null;
      bar.forEach((tok, i) => {
        if (tok === '-') {
          if (cur) cur.len++;
        } else if (tok === '.') {
          cur = null;
        } else {
          cur = { slot: i, midi: midi(tok), len: 1 };
          notes.push(cur);
        }
      });
      out.push(notes);
    }
    return out;
  }
  const MEL = {
    A: parseMelody('E5 - D5 C5 - D5 E5 - | F5 - E5 C5 - A4 C5 - | G5 - E5 C5 - D5 E5 - | D5 - B4 G4 - A4 B4 -'),
    A2: parseMelody('E5 - D5 C5 - D5 E5 G5 | A5 - G5 F5 - E5 C5 - | E5 - G5 C6 - B5 G5 - | B5 - A5 G5 - D5 B4 -'),
    B: parseMelody('A4 - - B4 C5 - B4 A4 | B4 - - C5 D5 - C5 B4 | A4 - C5 - F5 - E5 D5 | E5 - - - G#4 - B4 -'),
    C: parseMelody('A5 - C6 - A5 F5 C5 - | B5 - D6 - B5 G5 D5 - | G5 - B5 - G5 E5 B4 - | A5 - C6 - E6 - - -'),
    D: parseMelody('A4 . E5 . A5 . G5 E5 | F5 . C5 . A4 . C5 F5 | E5 . C5 . G4 . C5 E5 | D5 . B4 . G4 A4 B4 D5'),
    E: parseMelody('A5 A5 . A5 G5 . E5 . | F5 F5 . F5 E5 . C5 . | G5 G5 . G5 F5 . D5 . | E5 - - - G#5 - B5 -'),
    // the forest song (level 2), D minor with a folk-tune feel
    F1: parseMelody('D5 - E5 F5 - E5 D5 - | C5 - D5 E5 - D5 C5 - | D5 - F5 A5 - G5 F5 - | E5 - C#5 A4 - - . .'),
    F2: parseMelody('A5 - F5 D5 A5 - F5 D5 | G5 - E5 C5 G5 - E5 C5 | F5 - D5 A#4 F5 - D5 A#4 | E5 - C#5 A4 E5 G5 F5 E5'),
    F3: parseMelody('D5 - - - F5 - E5 - | D5 - - - A#4 - - - | A4 - - - F5 - D5 - | C#5 - - - E5 - A4 -'),
    F4: parseMelody('D5 D5 . D5 F5 . D5 . | A#4 A#4 . A#4 D5 . A#4 . | G4 G4 . A#4 D5 . G5 . | A4 A4 . C#5 E5 . A5 .'),
    F5: parseMelody('A5 G5 F5 E5 D5 E5 F5 A5 | G5 F5 E5 D5 C5 D5 E5 G5 | F5 E5 D5 C5 A#4 C5 D5 F5 | E5 - A5 - C#6 - E6 -'),
    F6: parseMelody('A5 - G5 F5 - C5 F5 - | G5 - E5 C5 - G4 C5 - | F5 - A5 D6 - C6 A5 - | A#5 - A5 G5 - F5 D5 -'),
    // the subway song (level 3), E minor: city groove, train rhythm, a sneaky sewer tune, and G major in the sunshine
    M1: parseMelody('E5 - G5 E5 - B4 D5 E5 | C5 - E5 C5 - G4 B4 C5 | D5 - G5 D5 - B4 D5 G5 | F#5 - D5 A4 - D5 F#5 A5'),
    M2: parseMelody('B5 A5 G5 E5 . E5 G5 A5 | A5 F#5 D5 F#5 . D5 F#5 A5 | G5 E5 C5 E5 . C5 E5 G5 | F#5 - D#5 - B4 - D#5 F#5'),
    M3: parseMelody('E5 - - - G5 - - - | B5 - - - A5 - G5 - | C6 - - - B5 - G5 - | F#5 - - - D#5 - - -'),
    M5: parseMelody('E4 . G4 . B4 . A#4 B4 | A4 . C5 . E5 . D#5 E5 | E4 . G4 . B4 . G4 E4 | D#4 . F#4 . A4 . B4 .'),
    M6: parseMelody('A5 E5 C5 E5 A5 E5 C5 E5 | G5 E5 B4 E5 G5 E5 B4 E5 | G5 E5 C5 E5 G5 E5 C5 E5 | F#5 D#5 B4 D#5 F#5 D#5 B4 D#5'),
    M7: parseMelody('E5 - B4 E5 G5 - F#5 E5 | C5 - G4 C5 E5 - D5 C5 | D5 - B4 D5 G5 - A5 B5 | A5 - F#5 - D5 - F#5 A5'),
    M8: parseMelody('B5 - A5 G5 - D5 G5 - | A5 - F#5 D5 - A4 D5 - | G5 - E5 B4 - E5 G5 B5 | C6 - B5 A5 - G5 E5 -'),
  };
  // chords: [bass root midi, triad midis]
  const CH = {
    Am: [45, [57, 60, 64]], F: [41, [57, 60, 65]], C: [48, [55, 60, 64]], G: [43, [55, 59, 62]],
    E: [40, [56, 59, 64]], Em: [40, [55, 59, 64]], Dm: [38, [57, 62, 65]],
    Bb: [46, [58, 62, 65]], Gm: [43, [55, 58, 62]], A: [45, [57, 61, 64]],
    D: [38, [54, 57, 62]], B: [47, [54, 59, 63]],
  };
  const PROG = {
    main: ['Am', 'F', 'C', 'G'],
    viking: ['Am', 'G', 'F', 'E'],
    fyris: ['F', 'G', 'Em', 'Am'],
    hall: ['Am', 'F', 'G', 'E'],
    forest: ['Dm', 'C', 'Dm', 'A'],
    forest2: ['Dm', 'C', 'Bb', 'A'],
    bog: ['Dm', 'Gm', 'Dm', 'A'],
    cave: ['Dm', 'Bb', 'Gm', 'A'],
    glade: ['F', 'C', 'Dm', 'Bb'],
    metro: ['Em', 'C', 'G', 'D'],
    metro2: ['Em', 'D', 'C', 'B'],
    tunnel: ['Em', 'Em', 'C', 'B'],
    sewer: ['Em', 'Am', 'Em', 'B'],
    pipe: ['Am', 'Em', 'C', 'B'],
    harbor: ['G', 'D', 'Em', 'C'],
  };
  // each song: [fromBar, toBar, settings]. `phrase: 'section'` starts the 4-bar phrases at the section start.
  const SONGS = {
    home: {
      endChord: 'Am',
      sections: [
        [0, 4, { prog: 'main', drums: 'intro', bass: null, arp: 'up', lead: null, pad: true }],
        [4, 12, { prog: 'main', drums: 'main', bass: 'eighth', arp: 'up', lead: 'A' }],
        [12, 20, { prog: 'main', drums: 'main', bass: 'eighth', arp: 'up', lead: 'A2' }],
        [20, 24, { prog: 'main', drums: 'build', bass: 'eighth', arp: 'up', lead: 'A' }],
        [24, 32, { prog: 'viking', drums: 'half', bass: 'long', arp: 'wave', lead: 'B', pad: true }],
        [32, 44, { prog: 'main', drums: 'drop', bass: 'octave', arp: 'up', lead: 'A2' }],
        [44, 54, { prog: 'fyris', drums: 'main', bass: 'eighth', arp: 'fast', lead: 'C' }],
        [54, 64, { prog: 'main', drums: 'train', bass: 'eighth', arp: 'wave', lead: 'D' }],
        [64, 72, { prog: 'hall', drums: 'drop', bass: 'octave', arp: 'fast', lead: 'E' }],
        [72, 78, { prog: 'main', drums: 'drop', bass: 'octave', arp: 'up', lead: 'A2' }],
        [78, 80, { end: true }],
      ],
    },
    // areas of the forest level start at bars 13, 24, 36, 44 and 55; the finish is bar 63
    forest: {
      endChord: 'F',
      phrase: 'section',
      sections: [
        [0, 4, { prog: 'forest', drums: 'intro', bass: null, arp: 'up', lead: null, pad: true }],
        [4, 13, { prog: 'forest', drums: 'main', bass: 'eighth', arp: 'up', lead: 'F1', tone: 'flute' }],
        [13, 24, { prog: 'forest2', drums: 'drop', bass: 'octave', arp: 'wave', lead: 'F2' }],
        [24, 36, { prog: 'bog', drums: 'half', bass: 'long', arp: 'wave', lead: 'F3', pad: true, tone: 'flute' }],
        [36, 44, { prog: 'cave', drums: 'drop', bass: 'octave', arp: 'fast', lead: 'F4' }],
        [44, 55, { prog: 'forest2', drums: 'train', bass: 'eighth', arp: 'fast', lead: 'F5' }],
        [55, 63, { prog: 'glade', drums: 'drop', bass: 'octave', arp: 'up', lead: 'F6', tone: 'flute' }],
        [63, 65, { end: true }],
      ],
    },
    // level 3: the street 0, T-Centralen 3, the tracks 13, the tunnel 22, the floor caves in during bar 28,
    // the sewer 29, the pipe 41, the outlet 48, out in the sunshine 54; the finish is bar 58
    metro: {
      endChord: 'G',
      phrase: 'section',
      sections: [
        [0, 3, { prog: 'metro', drums: 'intro', bass: null, arp: 'up', lead: null, pad: true }],
        [3, 13, { prog: 'metro', drums: 'main', bass: 'eighth', arp: 'up', lead: 'M1' }],
        [13, 22, { prog: 'metro2', drums: 'train', bass: 'octave', arp: 'fast', lead: 'M2' }],
        [22, 28, { prog: 'tunnel', drums: 'half', bass: 'long', arp: 'wave', lead: 'M3', pad: true }],
        [28, 29, { prog: 'tunnel', drums: 'roll', bass: null, arp: null, lead: null }],
        [29, 41, { prog: 'sewer', drums: 'half', bass: 'long', arp: 'wave', lead: 'M5', pad: true, tone: 'pluck', drips: true }],
        [41, 48, { prog: 'pipe', drums: 'drop', bass: 'octave', arp: 'fast', lead: 'M6', drips: true }],
        [48, 54, { prog: 'metro', drums: 'train', bass: 'eighth', arp: 'up', lead: 'M7' }],
        [54, 58, { prog: 'harbor', drums: 'drop', bass: 'octave', arp: 'up', lead: 'M8', tone: 'flute' }],
        [58, 60, { end: true }],
      ],
    },
  };
  let SONG = SONGS.home;
  A.setSong = function (id) {
    SONG = SONGS[id] || SONGS.home;
  };
  function sectionAt(bar) {
    for (const s of SONG.sections) if (bar >= s[0] && bar < s[1]) return s;
    return null;
  }

  // ---------- engine ----------
  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    A.master = ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.75;
    A.master.connect(comp);
    A.sfxBus = ctx.createGain();
    A.sfxBus.gain.value = 0.9;
    A.sfxBus.connect(A.master);
    const len = ctx.sampleRate;
    A.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.master) A.master.gain.setTargetAtTime(m ? 0 : 0.75, A.ctx.currentTime, 0.02);
  };

  A.startMusic = function (levelTime) {
    if (!A.ctx) return;
    A.stopMusic(0.03);
    const g = A.ctx.createGain();
    g.gain.value = 0.55;
    g.connect(A.master);
    A.bus = g;
    A.anchorLevel = levelTime;
    A.anchorAudio = A.ctx.currentTime + 0.05;
    A.nextStep = Math.max(0, Math.ceil(levelTime / STEP - 1e-6));
    A.playing = true;
  };

  A.stopMusic = function (fade = 0.12) {
    A.playing = false;
    if (!A.bus || !A.ctx) return;
    const g = A.bus;
    A.bus = null;
    g.gain.cancelScheduledValues(A.ctx.currentTime);
    g.gain.setTargetAtTime(0, A.ctx.currentTime, fade / 3);
    setTimeout(() => g.disconnect(), fade * 1000 + 400);
  };

  // call every frame with the current level time (player x / speed)
  A.update = function (levelTime) {
    if (!A.playing || !A.ctx || !A.bus) return;
    const now = A.ctx.currentTime;
    const expected = A.anchorLevel + (now - A.anchorAudio);
    if (Math.abs(expected - levelTime) > 0.08) {
      A.anchorLevel = levelTime;
      A.anchorAudio = now;
      A.nextStep = Math.max(A.nextStep, Math.ceil(levelTime / STEP - 1e-6));
    }
    const horizon = now + 0.14;
    for (let guard = 0; guard < 64; guard++) {
      const t = A.anchorAudio + (A.nextStep * STEP - A.anchorLevel);
      if (t > horizon) break;
      if (t >= now - 0.02) playStep(A.nextStep, Math.max(t, now));
      A.nextStep++;
    }
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function voice(type, freq, t, dur, vol, opts = {}) {
    const ctx = A.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const a = opts.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.setTargetAtTime(0.0001, t + Math.max(a, dur * (opts.hold || 0.5)), (opts.release || dur * 0.35) + 0.001);
    let node = o;
    if (opts.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opts.lp, t);
      if (opts.lpEnd) f.frequency.exponentialRampToValueAtTime(opts.lpEnd, t + dur);
      f.Q.value = opts.q || 1;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts.dest || A.bus);
    o.start(t);
    o.stop(t + dur + 0.6);
  }

  function noise(t, dur, vol, type, freq, dest, q) {
    const ctx = A.ctx;
    const s = ctx.createBufferSource();
    s.buffer = A.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || A.bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  function kick(t, v = 1) {
    const ctx = A.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g);
    g.connect(A.bus);
    o.start(t);
    o.stop(t + 0.3);
  }
  const snare = (t, v = 1) => {
    noise(t, 0.16, 0.45 * v, 'bandpass', 1800, null, 0.7);
    voice('triangle', 190, t, 0.08, 0.25 * v, { slide: 120 });
  };
  const hat = (t, v = 1, open) => noise(t, open ? 0.18 : 0.04, 0.16 * v, 'highpass', 8000);
  const clap = (t, v = 1) => {
    for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.09, 0.3 * v, 'bandpass', 1400, null, 1.2);
  };
  const crash = (t) => noise(t, 1.2, 0.22, 'highpass', 5000);

  function playStep(step, t) {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const sec = sectionAt(bar);
    if (!sec) return;
    const cfg = sec[2];
    const barInSec = bar - sec[0];
    if (cfg.end) {
      if (bar === sec[0] && s16 === 0) {
        kick(t);
        crash(t);
        const [root, tri] = CH[SONG.endChord];
        voice('sawtooth', mtof(root), t, 2.4, 0.2, { lp: 900, hold: 0.8, release: 0.8 });
        tri.forEach((m) => voice('square', mtof(m + 12), t, 2.4, 0.05, { lp: 3000, hold: 0.8, release: 0.8 }));
        voice('sawtooth', mtof(tri[0] + 24), t, 2.4, 0.07, { lp: 4000, hold: 0.8, release: 0.8, detune: 6 });
      }
      return;
    }
    // position inside the 4-bar phrase
    const pb = SONG.phrase === 'section' ? barInSec : bar;
    const prog = PROG[cfg.prog];
    const chord = CH[prog[pb % 4]];
    const root = chord[0], tri = chord[1];

    if (barInSec === 0 && s16 === 0 && sec[0] > 0) crash(t);

    // ---- drums ----
    const d = cfg.drums;
    const beat = s16 % 4 === 0;
    if (d === 'intro') {
      if (s16 === 0) kick(t, 0.8);
      if (bar >= 2 && s16 % 4 === 2) hat(t, 0.8);
      if (bar === sec[1] - 1 && s16 >= 12) snare(t, 0.3 + (s16 - 12) * 0.15);
    } else if (d === 'main' || d === 'build' || d === 'drop' || d === 'train') {
      if (beat) kick(t);
      if (s16 === 4 || s16 === 12) snare(t);
      if (d === 'drop' && (s16 === 4 || s16 === 12)) clap(t);
      if (d === 'train') {
        if (s16 % 2 === 0 || s16 % 4 === 3) hat(t, s16 % 4 === 0 ? 1 : 0.55);
      } else if (d === 'drop') {
        hat(t, s16 % 2 ? 0.45 : 0.8, s16 % 4 === 2);
      } else if (s16 % 4 === 2) hat(t);
      if (d === 'build' && barInSec === 3 && s16 >= 8) snare(t, 0.3 + (s16 - 8) * 0.09);
      // fill on the last bar of each 4-bar phrase
      if (d !== 'build' && pb % 4 === 3 && (s16 === 14 || s16 === 15)) snare(t, 0.6);
    } else if (d === 'half') {
      if (s16 === 0 || s16 === 10) kick(t);
      if (s16 === 8) snare(t);
      if (s16 % 2 === 0) hat(t, 0.6);
    } else if (d === 'roll') {
      // a snare roll building up (the floor is caving in!)
      snare(t, 0.15 + s16 * 0.05);
      if (s16 % 4 === 0) kick(t, 0.6);
    }
    // water dripping in the sewer, with an echo
    if (cfg.drips && s16 % 2 === 1 && ((step * 2654435761) >>> 0) % 7 === 0) {
      const f = 1500 + ((step * 97) % 5) * 180;
      voice('sine', f, t, 0.09, 0.07, { slide: f * 0.45 });
      voice('sine', f, t + STEP * 3, 0.09, 0.025, { slide: f * 0.45 });
    }

    // ---- bass ----
    if (cfg.bass === 'eighth' && s16 % 2 === 0) {
      voice('sawtooth', mtof(root), t, STEP * 1.6, 0.22, { lp: 700, lpEnd: 300, q: 4 });
    } else if (cfg.bass === 'octave' && s16 % 2 === 0) {
      voice('sawtooth', mtof(root + (s16 % 4 === 2 ? 12 : 0)), t, STEP * 1.6, 0.24, { lp: 900, lpEnd: 300, q: 5 });
    } else if (cfg.bass === 'long' && (s16 === 0 || s16 === 8)) {
      voice('triangle', mtof(root), t, STEP * 7, 0.35, { hold: 0.7 });
    }

    // ---- arpeggio ----
    if (cfg.arp) {
      const tones = [tri[0], tri[1], tri[2], tri[0] + 12];
      let m = null;
      if (cfg.arp === 'up' && s16 % 2 === 0) m = tones[(s16 / 2) % 4] + 12;
      else if (cfg.arp === 'fast') m = tones[s16 % 4] + 12;
      else if (cfg.arp === 'wave' && s16 % 2 === 0) m = [tones[0], tones[1], tones[2], tones[3], tones[2], tones[1], tones[0], tones[1]][s16 / 2] + 12;
      if (m != null) voice('square', mtof(m), t, STEP * 0.9, cfg.arp === 'fast' ? 0.035 : 0.045, { lp: 2600 });
    }

    // ---- pad ----
    if (cfg.pad && s16 === 0) {
      tri.forEach((m, i) => voice('triangle', mtof(m), t, STEP * 15, 0.06, { attack: 0.25, hold: 0.8, detune: (i - 1) * 7 }));
    }

    // ---- lead ----
    if (cfg.lead && s16 % 2 === 0) {
      const mel = MEL[cfg.lead];
      const notes = mel[pb % mel.length];
      const slot = s16 / 2;
      for (const n of notes) {
        if (n.slot !== slot) continue;
        const dur = n.len * STEP * 2 * 0.95;
        if (cfg.tone === 'pluck') {
          // a dark, plucked sound for sneaking through the sewer
          voice('square', mtof(n.midi), t, Math.min(dur, STEP * 1.6), 0.06, { lp: 1800, lpEnd: 450, hold: 0.25 });
          voice('triangle', mtof(n.midi - 12), t, Math.min(dur, STEP * 1.6), 0.11, { hold: 0.3 });
        } else if (cfg.tone === 'flute') {
          // soft woody flute: triangle with a breathy attack and a quiet octave on top
          voice('triangle', mtof(n.midi), t, dur, 0.16, { attack: 0.02, hold: 0.75, detune: -3 });
          voice('sine', mtof(n.midi + 12), t, dur, 0.03, { attack: 0.03, hold: 0.6 });
          noise(t, 0.05, 0.03, 'bandpass', 2500, null, 2);
        } else {
          voice('sawtooth', mtof(n.midi), t, dur, 0.075, { lp: 3200, hold: 0.7, detune: -5 });
          voice('square', mtof(n.midi), t, dur, 0.045, { lp: 2400, hold: 0.7, detune: 5 });
        }
      }
    }
  }

  A._playStep = playStep; // exposed for tools/verify (offline render of the whole song)

  // ---------- sound effects ----------
  A.sfx = function (name) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime + 0.005;
    const dest = A.sfxBus;
    switch (name) {
      case 'death':
        noise(t, 0.45, 0.6, 'lowpass', 1400, dest);
        voice('square', 420, t, 0.35, 0.12, { slide: 60, dest, hold: 0.3 });
        break;
      case 'checkpoint':
        voice('triangle', mtof(84), t, 0.12, 0.2, { dest });
        voice('triangle', mtof(88), t + 0.09, 0.2, 0.2, { dest });
        voice('triangle', mtof(91), t + 0.18, 0.3, 0.16, { dest });
        break;
      case 'orb':
        voice('sine', 500, t, 0.14, 0.18, { slide: 1300, dest });
        break;
      case 'pad':
        voice('square', 300, t, 0.16, 0.08, { slide: 900, dest, lp: 2500 });
        break;
      case 'portal':
        [72, 76, 79, 84].forEach((m, i) => voice('triangle', mtof(m), t + i * 0.035, 0.3, 0.1, { dest }));
        break;
      case 'win':
        [69, 72, 76, 81, 84, 88].forEach((m, i) => voice('square', mtof(m), t + i * 0.09, 0.4, 0.07, { dest, lp: 4000 }));
        break;
      case 'click':
        voice('triangle', 880, t, 0.06, 0.12, { dest });
        break;
      case 'firework':
        noise(t, 0.6, 0.25, 'lowpass', 900, dest);
        break;
      case 'coin':
        voice('square', mtof(88), t, 0.07, 0.07, { dest, lp: 5000 });
        voice('square', mtof(95), t + 0.06, 0.18, 0.07, { dest, lp: 5000 });
        break;
      case 'buy':
        [76, 79, 84, 88, 91].forEach((m, i) => voice('square', mtof(m), t + i * 0.06, 0.2, 0.06, { dest, lp: 4500 }));
        voice('triangle', mtof(96), t + 0.3, 0.4, 0.1, { dest });
        break;
      case 'drop':
        // falling down the hole: a whistle sliding down, and the rumble of the floor giving way
        voice('sine', 1400, t, 0.7, 0.14, { slide: 170, dest, hold: 0.8 });
        noise(t, 0.9, 0.5, 'lowpass', 500, dest);
        voice('square', 90, t, 0.5, 0.1, { slide: 40, dest, lp: 400 });
        break;
      case 'nope':
        voice('square', 180, t, 0.12, 0.08, { dest, lp: 1200 });
        voice('square', 140, t + 0.12, 0.18, 0.08, { dest, lp: 1200 });
        break;
    }
  };
})();
