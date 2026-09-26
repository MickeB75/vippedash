# VippeDash

A Geometry Dash–style runner starring **Vippe** (Vincent). This is the phase 1 proof of concept: one level of about 2 minutes that runs through **Uppland → Uppsala → Storvreta**. If you crash, you restart from the last checkpoint.

## Play

**Option 1:** double-click `index.html`. It runs from disk with no build step and no install.

**Option 2:** run a local server. This is handy on a phone on the same Wi-Fi.

```bash
python -m http.server 8765
```

Then open <http://localhost:8765>.

| Action | Keys |
| --- | --- |
| Jump (cube), fly up (bike), flip gravity (floorball) | **Space**, **↑**, **W**, **click** or **tap** |
| Hold to keep jumping or keep flying | hold any of the above |
| Pause | **Esc** / **P** / ⏸ button |
| Mute | **M** / 🔊 button |

The menu has three outfits: red jersey, black hoodie, and blue & black.

## The level (≈ 2:00, 16 checkpoints)

| Section | Where | What happens |
| --- | --- | --- |
| **Uppland** | red cottages, rapeseed fields, runestones, maypole | Spikes, hay bales and stepping stones over a brook. A moose crossing, with a pad to jump over the moose. |
| **Gamla Uppsala** | the three royal mounds | An orb staircase up over a long row of spikes. |
| **Uppsala** | castle hill, pastel houses, bikes, Studenternas | Run across the rooftops, then climb brick stairs. |
| **Fyrisån** | sunset over the river, the cathedral | **Flying-bike mode**: hold to fly and weave between bridge pillars. |
| **Mot Storvreta** | dusk, railway, the regional train racing you | Traffic cones and barriers. |
| **Innebandyhallen** | the floorball hall with a crowd cheering "HEJA VIPPE!" | **Floorball mode**: tap to flip gravity. |
| **Storvreta** | night, home | The final jumps to the **MÅL** (finish) line and home. |

The sun sets as you go: it's noon in Uppland, sunset over Fyrisån and night in Storvreta. The music is generated live at 156 BPM, which is exactly 4 blocks per beat, so obstacles land on the beat. When you respawn, the music restarts from the checkpoint.

## How it's built

Everything is vanilla JavaScript with Canvas 2D and WebAudio. There are **no image or audio files**: Vippe, the scenery and the soundtrack are all drawn and synthesised in code.

```
index.html        page + menus
css/style.css     menu styling
js/util.js        colour/random helpers
js/physics.js     deterministic fixed-step physics (240 Hz): cube, ship, ball, pads, orbs, portals
js/level.js       level builder + the whole level layout (edit here to change the level)
js/solver.js      search bot that proves the level is beatable
js/audio.js       procedural chiptune + sound effects
js/art.js         all drawing: Vippe, obstacles, landmarks
js/render.js      parallax scene, camera, HUD
js/game.js        game loop, input, checkpoints, menus
tools/verify.html level verifier
```

### Editing the level

The layout lives in `buildLevel()` in `js/level.js`. Units are blocks, and the player moves 10.4 blocks/s. For example:

```js
b.spike(26);                 // spike on the ground at x = 26
b.spikes(50, 2);             // two spikes in a row
b.block(80, 0, 3, 1, 'stone'); // solid block: x, y, width, height, style
b.pad(128);                  // yellow jump pad
b.orb(154, 2);               // yellow orb (tap in mid-air)
b.portal(712, 'ship', { ceil: 10 });
b.checkpoint(96);
```

After changing the level, open `tools/verify.html` through the local server. It runs the search bot from every checkpoint to the next one using the real game physics, and reports any segment that can't be beaten. Add `?windows` to the URL to also measure how much timing slack each jump has; aim for 100 ms or more.

### Debug mode

Open `index.html#debug`. This shows hitboxes and FPS and adds these keys:

| Key | Effect |
| --- | --- |
| `1`–`9` / `Shift`+digit | Warp to that checkpoint |
| `[` / `]` | Previous / next checkpoint |
| `G` | God mode |
| `B` | The bot plays for you |

## Notes

- The `Vincent/` photos were only used as reference for the character design. They are not used in the game and are git-ignored so they stay private.
- `.venv/` holds Python and Pillow, used once to convert the HEIC photos. The game doesn't need it, it is git-ignored, and it can be deleted.
