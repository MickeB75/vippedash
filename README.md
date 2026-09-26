# VippeDash

A Geometry Dash–style runner starring **Vippe** (Vincent). There are two levels: **1 · Hem till Storvreta** (easy, about 2 minutes) runs through **Uppland → Uppsala → Storvreta**, and **2 · Vilda skogen** (medium, about 1:37) runs through the wild forest. If you crash, you restart from the last checkpoint. Finishing a level wins coins, and the coins buy new skins in the shop.

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
| Pick a level in the menu | click it, or **1** / **2** |
| Open the shop | **Shop** button or **S** |

## Coins and the shop

You win coins every time you finish a level:

| | Level 1 (easy) | Level 2 (medium) |
| --- | --- | --- |
| Level cleared | 50 | 100 |
| Crash bonus (0 crashes; 10% less per crash, gone at 10 crashes) | up to 50 | up to 100 |
| First time you beat the level | 50 | 100 |

So a harder level and fewer crashes give more coins. The coin total is shown at the top right of the menu.

The shop has 13 skins. Red jersey, black hoodie and blue & black are free. The others cost coins:

| Skin | Coins | | Skin | Coins |
| --- | --- | --- | --- | --- |
| Forest camo (bandana) | 150 | | Student (student cap) | 450 |
| Sweden (bobble hat) | 200 | | Viking (horned helmet) | 600 |
| Fox (fox ears) | 300 | | Galaxy (orbiting stars) | 800 |
| Tiger (ears and whiskers) | 350 | | Rainbow (propeller cap) | 1000 |
| Moose (antlers) | 400 | | King Vippe (gold crown) | 1500 |

Coins, skins and progress are saved in the browser (`localStorage`), so they stay on that device and browser.

## Level 1: Hem till Storvreta (≈ 2:00, 16 checkpoints)

| Section | Where | What happens |
| --- | --- | --- |
| **Uppland** | red cottages, rapeseed fields, runestones, maypole | Spikes, hay bales and stepping stones over a brook. A moose crossing, with a pad to jump over the moose. |
| **Gamla Uppsala** | the three royal mounds | An orb staircase up over a long row of spikes. |
| **Uppsala** | castle hill, pastel houses, bikes, Studenternas | Run across the rooftops, then climb brick stairs. |
| **Fyrisån** | sunset over the river, the cathedral | **Flying-bike mode**: hold to fly and weave between bridge pillars. |
| **Mot Storvreta** | dusk, railway, the regional train racing you | Traffic cones and barriers. |
| **Innebandyhallen** | the floorball hall with a crowd cheering "HEJA VIPPE!" | **Floorball mode**: tap to flip gravity. |
| **Storvreta** | night, home | The final jumps to the **MÅL** (finish) line and home. |

The sun sets as you go: it's noon in Uppland, sunset over Fyrisån and night in Storvreta.

## Level 2: Vilda skogen (≈ 1:37, 9 checkpoints)

Shorter than level 1 but harder, with fewer checkpoints. New things: triple spikes, hedgehogs (they're spikes), crows you must not hit, an orb chain, a tighter bike ride and faster gravity flips.

| Section | Where | What happens |
| --- | --- | --- |
| **Skogsbrynet** | the forest edge: pines, a hunting stand, squirrels, a hare, a moose | Hedgehogs, logs, a stump staircase over thorns and a moose crossing. Low-flying crows: stay on the ground under them. |
| **Granskogen** | deep spruce forest, an owl, a fox, a squirrel running up a pine | Branch hopping over a floor of thorns, an orb chain, and a timber pile with a crow above it (jump early). |
| **Myren** | the misty bog: cranes, frogs on lily pads, dead trees | **Flying-bike mode** under the spruce boughs, weaving between dead trees and crows. |
| **Björngrottan** | the bear cave: a sleeping bear, bats, glowing crystals | **Floorball mode** with a lower roof and a spike group every 5 blocks. |
| **Bäckravinen** | the brook ravine: deer, a woodpecker | Stones across the brook, a fox in the path, branches over the rapids. |
| **Gläntan** | the sunny clearing: a tent and a campfire | A last moose, an orb chain and the finish. |

Level 2 has its own folk-style soundtrack in D minor that ends in a major key when you reach the clearing.

## How it's built

Everything is vanilla JavaScript with Canvas 2D and WebAudio. There are **no image or audio files**: Vippe, the scenery and the soundtrack are all drawn and synthesised in code. The music is generated live at 156 BPM, which is exactly 4 blocks per beat, so obstacles land on the beat. When you respawn, the music restarts from the checkpoint.

```
index.html        page + menus (level select, shop, level-complete screen)
css/style.css     menu styling
js/util.js        colour/random helpers
js/physics.js     deterministic fixed-step physics (240 Hz): cube, ship, ball, pads, orbs, portals
js/level.js       level builder, both level layouts, their themes and the level list
js/solver.js      search bot that proves the levels are beatable
js/audio.js       procedural chiptune (one song per level) + sound effects
js/art.js         all drawing: Vippe and his skins, obstacles, animals, landmarks
js/render.js      parallax scene, camera, HUD
js/game.js        game loop, input, checkpoints, menus, coins and the shop
tools/verify.html level verifier
```

### Editing a level

Each level is a build function in `js/level.js` (`buildHome()` and `buildForest()`), listed in `LEVELS` together with its theme (sky colours, ground, music) and coin reward. Units are blocks, and the player moves 10.4 blocks/s. For example:

```js
b.spike(26);                 // spike on the ground at x = 26
b.spikes(50, 2);             // two spikes in a row
b.spike(24, 0, 'hedgehog');  // a hedgehog is a spike with a different look
b.block(80, 0, 3, 1, 'stone'); // solid block: x, y, width, height, style
b.bird(147, 1.35);           // a crow hovering at x, y (a hazard)
b.pad(128);                  // yellow jump pad
b.orb(154, 2);               // yellow orb (tap in mid-air)
b.portal(712, 'ship', { ceil: 10 });
b.checkpoint(96);
```

After changing a level, open `tools/verify.html` through the local server. It runs the search bot from every checkpoint to the next one using the real game physics, and reports any segment that can't be beaten. Add `?level=forest` to check one level only, and `windows` (for example `?level=forest&windows`) to also measure how much timing slack each jump has. Level 1 aims for 100 ms or more. Level 2 is harder: its triple spikes have about 80 ms, and everything else has more.

### Debug mode

Open `index.html#debug`. This shows hitboxes and FPS and adds these keys:

| Key | Effect |
| --- | --- |
| `1`–`9` / `Shift`+digit | Warp to that checkpoint |
| `[` / `]` | Previous / next checkpoint |
| `G` | God mode |
| `B` | The bot plays for you |
| `C` | +500 coins (also works in the menu), for testing the shop |

## Notes

- The `Vincent/` photos were only used as reference for the character design. They are not used in the game and are git-ignored so they stay private.
- `.venv/` holds Python and Pillow, used once to convert the HEIC photos. The game doesn't need it, it is git-ignored, and it can be deleted.
