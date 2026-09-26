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
    // the nightmare song (level 4), C minor doom metal: original melodies, in the style of but not copied from any existing song
    N1: parseMelody('C5 . . D#5 . G5 . . | G#4 . . C5 . D#5 . . | F4 . . G#4 . C5 . . | F#4 . . A#4 . C#5 . -'),
    N2: parseMelody('C5 - D#5 - . C5 D#5 - | C#5 - . D#5 - C5 . - | G4 - A#4 - C5 - D#5 - | F#4 - . G4 - F5 - -'),
    N3: parseMelody('C5 D#5 G5 . C6 . G5 D#5 | B4 D5 F5 . B4 D5 F5 . | G#4 C5 D#5 . G#5 . D#5 C5 | F#4 A#4 C#5 . F#5 . C#5 A#4'),
    N4: parseMelody('C5 D#5 G5 C6 A#5 G5 D#5 C5 | F#5 A#5 C#6 A#5 F#5 D#5 F#5 A#5 | C#5 F5 G#5 F5 C#5 A#4 C#5 F5 | G#5 C6 D#6 C6 G#5 F5 G#5 C6'),
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
    // level 4 (doom metal, C minor): wide "5th under root" doom-chord voicings, root note kept low for the guitar/bass
    Cm: [36, [55, 60, 63]], Ab: [32, [51, 56, 60]], Fm: [41, [60, 65, 68]], Db: [37, [56, 61, 65]],
    Eb: [39, [58, 63, 67]], Gb: [42, [61, 66, 70]], Bdim: [35, [53, 59, 62]],
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
    // level 4: original doom-metal progressions in C minor, with Phrygian (Db) and tritone (Gb) colour
    dirge: ['Cm', 'Ab', 'Fm', 'Gb'],
    doom: ['Cm', 'Db', 'Cm', 'Gb'],
    doom2: ['Cm', 'Eb', 'Fm', 'Gb'],
    drone: ['Cm', 'Cm', 'Fm', 'Cm'],
    circus: ['Cm', 'Bdim', 'Ab', 'Gb'],
    mirror: ['Gb', 'Ab', 'Bdim', 'Cm'],
    climax: ['Cm', 'Gb', 'Db', 'Ab'],
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
    // level 4 "Mardrömmen": doom metal in C minor, half-time (kick/snare every 8 steps, 78 BPM feel).
    // areas: graveyard 0-8, convent 8-20, chapel 20-28, catacomb 28-40, circus 40-52, mirrors 52-58,
    // ghost train 58-66, tower 66-70, end 70-72.
    nightmare: {
      endChord: 'Cm',
      phrase: 'section',
      sections: [
        // graveyard: bell tolls, a lonely clean plucked arpeggio, wind; the first heavy doom chord at bar 4
        [0, 4, { prog: 'dirge', lead: 'N1', tone: 'clean', thunder: true, bell: [0] }],
        [4, 8, { prog: 'dirge', lead: 'N1', tone: 'clean', thunder: true, bell: [16, 48], guitar: 'doom' }],
        // convent: the main half-time riff, a mournful original lead, organ underneath; thunder joins partway in
        [8, 12, { prog: 'doom', guitar: 'doom', drums: 'doom', organ: true, lead: 'N2' }],
        [12, 20, { prog: 'doom', guitar: 'doom', drums: 'doom', organ: true, lead: 'N2', thunder: true }],
        // chapel: choir and organ over the riff, heavy snare on every beat (the strobe flashes every beat here)
        [20, 28, { prog: 'doom', guitar: 'doom', drums: 'strobe', organ: true, choir: true, lead: 'N2' }],
        // catacomb: sparse and slow -- a low drone, choir, heartbeat drums and drips
        [28, 40, { prog: 'drone', drums: 'sparse', drone: true, choir: true, drips: true }],
        // circus: a detuned calliope with a sinister original tune over the doom drums
        [40, 52, { prog: 'circus', drums: 'doom', lead: 'N3', tone: 'calliope' }],
        // mirrors: the calliope tune played as if backwards, over a chugging riff
        [52, 58, { prog: 'mirror', guitar: 'chug', drums: 'doom', lead: 'N3', tone: 'reverse' }],
        // ghost train: the climax -- double-time drums, tremolo guitar, a fast lead
        [58, 66, { prog: 'climax', guitar: 'tremolo', drums: 'doomfast', lead: 'N4' }],
        // tower: the main riff returns
        [66, 70, { prog: 'doom2', guitar: 'doom', drums: 'doom', organ: true, lead: 'N2' }],
        [70, 72, { end: true, endBell: true }],
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

  // soft-clip waveshaper curve for the doom guitar distortion bus (computed once, reused every level).
  // A moderate drive: tanh saturates fast, so too high an amount makes even a quiet chord come out
  // near full scale once several detuned oscillators sum into it.
  const DIST_CURVE = (() => {
    const n = 1024, curve = new Float32Array(n), amt = 3.2;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amt) / Math.tanh(amt);
    }
    return curve;
  })();

  // a decaying-noise impulse response for the reverb send
  function makeImpulse(ctx, seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
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
    // reverb send (level 4): a convolver with a generated ~2.2s decaying-noise tail, built once and reused
    // for the whole page. Its return goes straight to master (not the per-level music bus), so a tail
    // already ringing keeps playing smoothly through a crash/respawn instead of being cut off when
    // startMusic/stopMusic tear down and rebuild A.bus.
    A.reverb = ctx.createConvolver();
    A.reverb.buffer = makeImpulse(ctx, 2.2, 2.4);
    A.reverbIn = ctx.createGain(); // sounds send() into this
    A.reverbIn.gain.value = 1;
    A.reverbIn.connect(A.reverb);
    A.reverbOut = ctx.createGain(); // the wet return level
    A.reverbOut.gain.value = 0.55;
    A.reverb.connect(A.reverbOut);
    A.reverbOut.connect(A.master);
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
    // doom guitar distortion bus (level 4): soft-clip waveshaper, then a highpass/lowpass "cabinet".
    // Rebuilt fresh every startMusic and connected only to this bus, so it stops with the music
    // (a crash/respawn just drops the reference; nothing here schedules sources that outlive A.bus).
    const dist = A.ctx.createWaveShaper();
    dist.curve = DIST_CURVE;
    dist.oversample = '2x';
    const hp = A.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    const makeup = A.ctx.createGain(); // the waveshaper saturates fast, so tame its output level here
    makeup.gain.value = 0.45;
    dist.connect(hp);
    hp.connect(lp);
    lp.connect(makeup);
    makeup.connect(g);
    A.distBus = dist;
    A.anchorLevel = levelTime;
    A.anchorAudio = A.ctx.currentTime + 0.05;
    A.nextStep = Math.max(0, Math.ceil(levelTime / STEP - 1e-6));
    A.playing = true;
  };

  A.stopMusic = function (fade = 0.12) {
    A.playing = false;
    A.distBus = null; // the waveshaper/filter chain feeding the old bus is now unreachable and gets GC'd
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
  const ride = (t, v = 1) => noise(t, 0.35, 0.1 * v, 'highpass', 7000, null, 0.6);

  // ---- level 4: doom drums (bigger kick/snare with a reverb send) ----
  function bigKick(t, v = 1) {
    const ctx = A.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(115, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.22);
    g.gain.setValueAtTime(1.05 * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g);
    g.connect(A.bus);
    noise(t, 0.02, 0.4 * v, 'highpass', 2200); // click transient
    o.start(t);
    o.stop(t + 0.6);
    if (A.reverbIn) {
      const send = ctx.createGain();
      send.gain.value = 0.14 * v;
      g.connect(send);
      send.connect(A.reverbIn);
    }
  }
  const bigSnare = (t, v = 1) => {
    noise(t, 0.3, 0.5 * v, 'bandpass', 1500, null, 0.6);
    noise(t, 0.3, 0.22 * v, 'highpass', 4200);
    voice('triangle', 170, t, 0.16, 0.28 * v, { slide: 90, hold: 0.5 });
    if (A.reverbIn) noise(t, 0.4, 0.2 * v, 'bandpass', 1500, A.reverbIn, 0.6);
  };

  // church bell: inharmonic sine partials with a long exponential decay
  function churchBell(t, m, vol = 0.35, dest) {
    dest = dest || A.bus;
    const f0 = mtof(m);
    const ratios = [0.5, 1, 1.19, 1.5, 2, 2.74, 3.0, 4.1];
    const amps = [0.35, 1, 0.5, 0.4, 0.32, 0.22, 0.16, 0.1];
    const decays = [4.2, 4.5, 3.4, 3.0, 2.4, 1.5, 1.2, 0.8];
    ratios.forEach((r, i) => {
      voice('sine', f0 * r, t, decays[i], vol * amps[i] * 0.22, { dest, attack: 0.006, hold: 0.03, release: decays[i] * 0.4 });
    });
    if (A.reverbIn) voice('sine', f0, t, 3, vol * 0.12, { dest: A.reverbIn, attack: 0.01, hold: 0.05, release: 1.4 });
  }

  // thunder: lowpassed rumble with a crack at the start
  function thunderRumble(t, vol = 1, dest) {
    dest = dest || A.bus;
    noise(t, 1.6, 0.32 * vol, 'lowpass', 220, dest, 0.7);
    noise(t, 0.1, 0.35 * vol, 'highpass', 2600, dest, 1.4);
    voice('sine', 55, t, 1.1, 0.14 * vol, { dest, slide: 28, hold: 0.55 });
  }

  // doom guitar: a power chord (root, fifth, octave), 2 detuned saws per note into the distortion bus
  function guitarChord(t, rootMidi, dur, vol, opts = {}) {
    const tones = [rootMidi, rootMidi + 7, rootMidi + 12];
    const w = [1, 0.85, 0.6];
    tones.forEach((m, i) => {
      const f = mtof(m);
      const v = vol * w[i];
      voice('sawtooth', f, t, dur, v, { dest: A.distBus, attack: opts.attack, hold: opts.hold, release: opts.release, lp: opts.lp, q: opts.q, detune: -9 });
      voice('sawtooth', f, t, dur, v, { dest: A.distBus, attack: opts.attack, hold: opts.hold, release: opts.release, lp: opts.lp, q: opts.q, detune: 9 });
    });
  }

  // heavy bass following the guitar root, an octave (and a sub-octave) below it
  function doomBass(t, rootMidi, dur, vol, opts = {}) {
    const m = rootMidi - 12;
    voice('triangle', mtof(m), t, dur, vol, { dest: A.bus, attack: opts.attack || 0.004, hold: opts.hold || 0.7, release: opts.release, lp: 450 });
    voice('sine', mtof(m - 12), t, dur, vol * 0.55, { dest: A.bus, attack: opts.attack || 0.004, hold: opts.hold || 0.7, release: opts.release });
  }

  // church organ: additive sines with a slow attack, holding the chord
  function organChord(t, tri, dur) {
    tri.forEach((m) => {
      voice('sine', mtof(m), t, dur, 0.05, { dest: A.bus, attack: 0.4, hold: 0.85 });
      voice('sine', mtof(m + 12), t, dur, 0.02, { dest: A.bus, attack: 0.45, hold: 0.85 });
      voice('triangle', mtof(m - 12), t, dur, 0.025, { dest: A.bus, attack: 0.4, hold: 0.85 });
    });
  }

  // "aah" choir: saw into 2 bandpass formants, slow attack, a slight vibrato
  function choirNote(t, m, dur, vol) {
    const ctx = A.ctx;
    const f0 = mtof(m);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = f0 * 0.008;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 700; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = 1150; f2.Q.value = 6;
    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vol, t + 0.5);
    amp.gain.setTargetAtTime(0.0001, t + dur * 0.7, dur * 0.3 + 0.001);
    o.connect(f1); f1.connect(g1); g1.connect(amp);
    o.connect(f2); f2.connect(g2); g2.connect(amp);
    amp.connect(A.bus);
    if (A.reverbIn) {
      const send = ctx.createGain();
      send.gain.value = 0.3;
      amp.connect(send);
      send.connect(A.reverbIn);
    }
    o.start(t); o.stop(t + dur + 0.6);
    lfo.start(t); lfo.stop(t + dur + 0.6);
  }
  function choirChord(t, tri, dur) {
    tri.forEach((m) => choirNote(t, m, dur, 0.045));
  }

  // a low sustained drone for the catacomb
  function droneNote(t, rootMidi, dur) {
    voice('sine', mtof(rootMidi - 12), t, dur, 0.09, { dest: A.bus, attack: 0.6, hold: 0.9 });
    voice('sawtooth', mtof(rootMidi - 12), t, dur, 0.03, { dest: A.bus, attack: 0.6, hold: 0.9, lp: 500 });
  }

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
        if (cfg.endBell) churchBell(t + 0.12, 48, 0.4);
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
    } else if (d === 'doom') {
      // half-time doom: a big kick on the downbeat, a big snare on the "and" of 2, ride on quarters
      if (s16 === 0) bigKick(t, 1);
      if (s16 === 8) bigSnare(t, 1);
      if (bar % 2 === 0 && s16 === 0) crash(t);
      if (s16 % 4 === 0) ride(t, 0.5);
    } else if (d === 'doomfast') {
      // the ghost train: the same doom kit at double time
      if (s16 === 0 || s16 === 8) bigKick(t, 1);
      if (s16 === 4 || s16 === 12) bigSnare(t, 1);
      if (s16 === 0) crash(t);
      if (s16 % 2 === 0) ride(t, 0.4);
    } else if (d === 'sparse') {
      // a heartbeat "lub-dub" every 8 steps and nothing else
      if (s16 === 0) {
        bigKick(t, 0.55);
        bigKick(t + STEP * 0.55, 0.85);
      }
    } else if (d === 'strobe') {
      // the chapel: a heavy snare on every beat, in time with the strobe flash
      if (s16 % 4 === 0) {
        bigKick(t, s16 === 0 ? 1 : 0.7);
        bigSnare(t, 1);
      }
      if (bar % 2 === 0 && s16 === 0) crash(t);
      if (s16 % 4 === 0) ride(t, 0.45);
    }
    // water dripping in the sewer, with an echo
    if (cfg.drips && s16 % 2 === 1 && ((step * 2654435761) >>> 0) % 7 === 0) {
      const f = 1500 + ((step * 97) % 5) * 180;
      voice('sine', f, t, 0.09, 0.07, { slide: f * 0.45 });
      voice('sine', f, t + STEP * 3, 0.09, 0.025, { slide: f * 0.45 });
    }
    // thunder rumble in lightning zones, on the downbeat of odd bars (matching the visual flash at x%32==16)
    if (cfg.thunder && s16 === 0 && bar % 2 === 1) thunderRumble(t);
    // church bell tolls, at the given step offsets within this section (barInSec * 16 + s16)
    if (cfg.bell && cfg.bell.includes(barInSec * 16 + s16)) churchBell(t, 48, 0.4);

    // ---- bass ----
    if (cfg.bass === 'eighth' && s16 % 2 === 0) {
      voice('sawtooth', mtof(root), t, STEP * 1.6, 0.22, { lp: 700, lpEnd: 300, q: 4 });
    } else if (cfg.bass === 'octave' && s16 % 2 === 0) {
      voice('sawtooth', mtof(root + (s16 % 4 === 2 ? 12 : 0)), t, STEP * 1.6, 0.24, { lp: 900, lpEnd: 300, q: 5 });
    } else if (cfg.bass === 'long' && (s16 === 0 || s16 === 8)) {
      voice('triangle', mtof(root), t, STEP * 7, 0.35, { hold: 0.7 });
    }

    // ---- doom guitar + heavy bass ----
    if (cfg.guitar === 'doom' && (s16 === 0 || s16 === 8)) {
      // sustained power chords on the half-time downbeats, letting them ring
      guitarChord(t, root, STEP * 7.6, 0.07, { attack: 0.015, hold: 0.9, release: 1.3 });
      doomBass(t, root, STEP * 7.6, 0.22, { hold: 0.85 });
    } else if (cfg.guitar === 'chug' && s16 % 2 === 0) {
      // palm-muted 8ths, short and low-passed
      guitarChord(t, root, STEP * 0.8, 0.06, { attack: 0.002, hold: 0.35, release: 0.06, lp: 900 });
      doomBass(t, root, STEP * 0.8, 0.2, { hold: 0.4, release: 0.05 });
    } else if (cfg.guitar === 'tremolo') {
      // rapid 16ths
      guitarChord(t, root, STEP * 0.85, 0.045, { attack: 0.002, hold: 0.5, release: 0.08 });
      if (s16 % 2 === 0) doomBass(t, root, STEP * 1.7, 0.2, { hold: 0.5 });
    }

    // ---- church organ / choir / catacomb drone (level 4) ----
    if (cfg.organ && s16 === 0) organChord(t, tri, STEP * 15.5);
    if (cfg.choir && s16 === 0) choirChord(t, tri, STEP * 15.5);
    if (cfg.drone && s16 === 0) droneNote(t, root, STEP * 15.5);

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
        } else if (cfg.tone === 'clean') {
          // a lonely clean plucked guitar for the graveyard intro
          voice('triangle', mtof(n.midi), t, dur, 0.12, { attack: 0.003, hold: 0.3, release: dur * 0.5, lp: 2200, lpEnd: 900 });
          voice('sine', mtof(n.midi + 12), t, Math.min(dur, STEP * 1.2), 0.03, { attack: 0.002, hold: 0.4 });
          if (A.reverbIn) voice('triangle', mtof(n.midi), t, dur, 0.05, { dest: A.reverbIn, attack: 0.003, hold: 0.3 });
        } else if (cfg.tone === 'calliope') {
          // a detuned music-box calliope for the circus, wobbling a little out of tune
          const wobble = Math.sin(t * 7.3 + n.midi) * 12; // +-12 cents, deterministic so offline renders match
          voice('square', mtof(n.midi), t, dur, 0.085, { detune: wobble, lp: 3500, hold: 0.6 });
          voice('triangle', mtof(n.midi + 12), t, dur, 0.035, { detune: -wobble * 0.6, hold: 0.55 });
        } else if (cfg.tone === 'reverse') {
          // the mirror hall: a slow swell attack and an abrupt stop, so it sounds backwards
          const swell = Math.min(dur * 0.85, 0.4);
          voice('sawtooth', mtof(n.midi), t, dur, 0.09, { attack: swell, hold: 0.97, release: 0.03, lp: 2600 });
          voice('square', mtof(n.midi), t, dur, 0.04, { attack: swell, hold: 0.97, release: 0.03, lp: 2000 });
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
      // ---- level 4: horror sound effects ----
      case 'scare_nun': {
        // a dissonant shriek: a cluster of detuned saws sliding upward, plus a noise burst and reverb
        const base = 640;
        [-14, -5, 5, 16].forEach((cents) => {
          voice('sawtooth', base, t, 0.75, 0.085, { dest, slide: base * 3.4, detune: cents, attack: 0.008, hold: 0.55, release: 0.28 });
        });
        noise(t, 0.3, 0.32, 'highpass', 3200, dest, 1.1);
        if (A.reverbIn) noise(t, 0.6, 0.22, 'bandpass', 1800, A.reverbIn, 2);
        break;
      }
      case 'scare_clown': {
        // a distorted "HA-HA-HA" laugh (formant-filtered saw bursts with pitch wobble), then a stinger chord
        [0, 0.16, 0.32, 0.47].forEach((dt, i) => {
          const f = 250 + (i % 2) * 35;
          voice('sawtooth', f, t + dt, 0.13, 0.15, { dest, slide: f * 1.5, attack: 0.005, hold: 0.4, release: 0.08, lp: 1200 });
        });
        const st = t + 0.58;
        const [sr, stri] = CH.Bdim;
        voice('sawtooth', mtof(sr), st, 0.5, 0.13, { dest, lp: 1000, hold: 0.5 });
        stri.forEach((m) => voice('square', mtof(m), st, 0.5, 0.06, { dest, lp: 2200, hold: 0.5 }));
        break;
      }
      case 'scare_skull':
        // a low boom and a metallic screech
        voice('sine', 60, t, 0.6, 0.32, { dest, slide: 28, hold: 0.5 });
        noise(t, 0.5, 0.32, 'lowpass', 300, dest);
        noise(t + 0.05, 0.45, 0.16, 'bandpass', 3200, dest, 6);
        voice('sawtooth', 1900, t + 0.05, 0.35, 0.05, { dest, slide: 2600, lp: 4200 });
        break;
      case 'laugh':
        // a shorter, quieter clown laugh
        [0, 0.13, 0.26].forEach((dt) => {
          voice('sawtooth', 280, t + dt, 0.1, 0.07, { dest, slide: 380, hold: 0.4, release: 0.06, lp: 1100 });
        });
        break;
      case 'hurt':
        // a meaty thud with a wet squelch
        voice('sine', 110, t, 0.22, 0.35, { dest, slide: 45, hold: 0.4 });
        noise(t, 0.18, 0.3, 'lowpass', 700, dest);
        noise(t + 0.03, 0.2, 0.16, 'bandpass', 500, dest, 3);
        break;
      case 'heartbeat':
        // a low "lub-dub"
        voice('sine', 70, t, 0.14, 0.3, { dest, slide: 38, hold: 0.5 });
        voice('sine', 60, t + 0.22, 0.16, 0.26, { dest, slide: 32, hold: 0.5 });
        break;
      case 'gameover': {
        // a descending doom chord, a bell and a dark rumble
        const [gr, gtri] = CH.Cm;
        voice('sawtooth', mtof(gr - 12), t, 2.3, 0.18, { dest, lp: 700, hold: 0.85, release: 1 });
        gtri.forEach((m, i) => voice('square', mtof(m - 12), t + i * 0.12, 2.0 - i * 0.12, 0.05, { dest, lp: 1500, hold: 0.8 }));
        churchBell(t + 0.15, 48, 0.35, dest);
        noise(t, 2.4, 0.22, 'lowpass', 200, dest);
        break;
      }
      case 'thunder':
        thunderRumble(t, 1, dest);
        break;
      case 'bell':
        churchBell(t, 55, 0.4, dest);
        break;
    }
  };
})();
