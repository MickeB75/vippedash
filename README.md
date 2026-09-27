# VippeDash

A Geometry Dash–style runner starring **Vippe**. There are six levels: **1 · Hem till Storvreta** (easy, about 2 minutes) runs through **Uppland → Uppsala → Storvreta**, **2 · Tunnelbanan** (medium, about 1:29) runs through the Stockholm subway and down into the sewers, **3 · Vilda skogen** (hard, about 1:37) runs through the wild forest, **4 · Schackmatt** (very hard, about 1:38) plays on a giant chessboard with **Brädet › Springarna › Tornet › Kungens tron**, **5 · Djupet** (very hard, about 1:38) dives through **Korallrevet › Manetsvärmen › Valens buk › Ytan**, and **6 · Mardrömmen** (nightmare, about 1:48, age 16+) runs from a graveyard at midnight through a convent, the catacombs and a haunted circus, with jump scares and strobe lights. If you crash, you restart from the last checkpoint. Finishing a level wins coins, and the coins buy new skins in the shop.

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
| Pick a level in the menu | click it, or **1** / **2** / **3** / **4** / **5** |
| Open the shop | **Shop** button or **S** |
| Switch between Vippe and Affelito in the shop | click the tab, or **←** / **→** |

## Play on Android

There are two ways, and neither needs web hosting or Android Studio. On a phone, **PLAY** switches to fullscreen and landscape. If you turn the phone upright, the game pauses and shows a "Vänd mobilen!" hint. The back button or back swipe pauses the run, and a second back goes to the main menu.

### A. E-mail yourself one file (quick)

```bash
python tools/build_single.py
```

This builds `dist/VippeDash.html`, the whole game in one file of about 450 KB with the code, CSS and font inside, so it plays offline. The build is stamped with the version (build date and short commit hash), which the main menu shows faintly in the bottom-right. E-mail it to yourself (or copy it to the phone's `Download` folder over USB).

On the phone, download the attachment and open it with **Chrome**. Don't open it with the built-in "HTML Viewer": JavaScript is turned off there, so the game won't start. You won't get an app icon, and coins and progress may not be saved between times when the game is opened from a file.

Run the build again whenever the game changes. Gmail won't send `.apk` files, but `.html` is fine.

### B. Install it as an app over USB (best)

This installs VippeDash as an app with its own icon. It runs in fullscreen landscape, works offline and saves coins and progress. You only need the cable to install or update it.

1. **On the phone:** go to Settings → About phone and tap **Build number** 7 times. Then go to Developer options and turn on **USB debugging**.
2. **On the PC:** use `python tools/release.py` to check, verify, build and serve in one command. Or use the plain `python -m http.server 8765 --bind 127.0.0.1`.
3. **Connect the phone** with a USB cable and open `chrome://inspect/#devices` in Chrome on the PC. Allow USB debugging on the phone when it asks. Click **Port forwarding…**, add port `8765` → `localhost:8765`, and tick **Enable port forwarding**.
4. **In Chrome on the phone**, open <http://localhost:8765> and choose **⋮ → Install app** (or **Add to home screen**). Start the app once while the cable is still connected, so everything gets saved on the phone.
5. **Unplug the cable.** The app now works on its own, even in airplane mode.

`release.py` stops before building if a file the game loads is missing from `sw.js` or a level can't be beaten. `--no-verify` skips the level check, `--no-serve` only builds, and `--port <n>` serves on another port. Ctrl+C stops the server.

To **update** the app, do steps 2–3 again and open the app while the cable is connected. It fetches the new files by itself. Close the app and open it again to play the new version.

The main menu shows a version stamp in the bottom-right corner, faintly. On the phone you can see which build you have. In the repo, `js/version.js` holds `'dev'`. When you build with `python tools/release.py` or `python tools/build_single.py`, they stamp the version as `v YYYY-MM-DD HH:MM · <short commit>` (plus ` *` if there are uncommitted changes), so the build date and commit are embedded in the built file.

This works because the app is a PWA: `manifest.json` names the app and its icons, and `sw.js` (a service worker) keeps a copy of every file on the phone. **When you add a file that the game loads, add it to `FILES` in `sw.js`**, or the installed app won't have it offline. `python tools/release.py` checks this for you.

The installed app, the e-mailed file and the browser each keep their own coins and progress.

## Statistics

VippeDash can log simple, anonymous usage so you can see how the game is actually being played. Each logged event records a date/time, which event it was (game opened, a level started, a level cleared), which level, which platform (GitHub Pages, installed app, opened from a file, LAN, or a test run) and the game's version, plus a random id stored in the browser so repeat visits from the same browser or install can be told apart. No names, no cookies and no IP addresses are logged — the logging endpoint (a Google Apps Script web app) never even sees the player's IP. Nothing is logged from a `localhost` browser tab (so normal development doesn't pollute the numbers), in `?debug` mode, or from the headless tools used to verify levels. If the game is offline when an event happens, it's queued and sent the next time it's online. Opening the game with `index.html?statstest` is a dry run: events are printed to the browser console instead of being sent anywhere.

### One-time setup

1. Go to [sheets.new](https://sheets.new) and name the new spreadsheet "VippeDash statistik".
2. Open **Tillägg → Apps Script**, replace the contents of `Code.gs` (`Kod.gs` in Swedish) with the contents of `tools/stats-sheet.gs`, and save.
3. Open **Distribuera → Ny distribution**, choose type **Webbapp**, set **Kör som: Jag** and **Vem har åtkomst: Alla**, then click **Distribuera**. Authorize the script when asked — Google shows an "unverified app" warning for your own script, which is expected; click **Avancerat → Gå till … (osäkert)** to continue.
4. Copy the web app URL (it ends in `/exec`) and paste it into `ENDPOINT` at the top of `js/stats.js`, then commit and push.
5. Open the web app URL in a browser. It should show "VippeDash-statistik: igång" — that confirms the deployment works.

### Reading the numbers

Open the sheet. The **Per dag** tab updates automatically whenever you open it (or run **VippeDash → Uppdatera Per dag** from the menu), and has one row per day:

- **besökare** – distinct visitors that day
- **nya** – visitors whose very first-ever event was that day
- **spelare** – distinct visitors who started at least one level that day
- **startade `<level>`** / **klarade `<level>`** – how many runs of that level were started (every PLAY, restart or "Play again"; respawning at a checkpoint doesn't count) and how many times it was cleared that day

To get a CSV, open the **Per dag** tab and use **Arkiv → Ladda ned → Kommaseparerade värden (.csv)**. The raw, one-row-per-event log is in the **Logg** tab.

### Updating the script later

Paste the new version of `tools/stats-sheet.gs` into the same Apps Script project, then **Distribuera → Hantera distributioner → ✏️ → Version: Ny version**, so the web app URL (and therefore `ENDPOINT` in `js/stats.js`) doesn't need to change.

The web app URL is public, since it's right there in the game's code, so in principle anyone could post fake rows to your sheet. The script validates everything it receives, which is good enough for a hobby game.

## Topplista

VippeDash keeps a **leaderboard** for every level. Players choose a name (the first time they win a level, or any time via the 👤 chip in the menu). Names are unique (case-insensitive), 2–12 characters long, and filtered against a word list in the Apps Script (`BANNED_ANYWHERE` and `BANNED_EXACT` at the top of `tools/stats-sheet.gs` — you can extend it).

Each level has a **top 10**: ranked by fewest crashes first, then shortest time. One row per player and level (their best run). The data lives in the same Google Sheet as the statistics, in tabs called **Spelare** (players) and **Topplista** (leaderboard), via the same Apps Script web app. After changing `tools/stats-sheet.gs`, paste it into the Apps Script editor again and redeploy with **Distribuera → Hantera distributioner → ✏️ → Ny version** to keep the same `/exec` URL.

### Moderation

Write anything in the **"dold"** (hidden) column of a row in **Topplista** to hide that result from the public lists. Do the same in **Spelare** to hide that player entirely (their name stays reserved so no one else can take it). Delete a row in **Spelare** to free up the name. Changes show within about 30 seconds (the server caches data briefly).

### How it works

The player identity is the same random per-device ID as the statistics, stored in `localStorage`. The name follows the browser or app, not the person: the GitHub Pages site, the installed app and a single emailed file each have their own unique ID.

Debug and testing URL parameters:
- `?lbmock` – fake in-memory server with no network, for UI work and screenshots
- `?lbmock=offline` – fake network failure, for testing offline behavior
- `?lbtest` – real server, but the rows are marked platform "test" and never show up in the public lists
- On `localhost` the leaderboard is off unless you use `?lbtest` or `?lbmock`; debug and bot runs are never submitted in normal play

## Coins and the shop

You win coins every time you finish a level:

| | Level 1 (easy) | Level 2 (medium) | Level 3 (hard) | Level 4 (very hard) | Level 5 (very hard) | Level 6 (nightmare) |
| --- | --- | --- | --- | --- | --- | --- |
| Level cleared | 50 | 100 | 150 | 175 | 200 | 250 |
| Crash bonus (0 crashes; 10% less per crash, gone at 10 crashes) | up to 50 | up to 100 | up to 150 | up to 175 | up to 200 | up to 250 |
| First time you beat the level | 50 | 100 | 150 | 175 | 200 | 250 |

So a harder level and fewer crashes give more coins. The coin total is shown at the top right of the menu.

The shop has two tabs, one per character. The shop opens on the tab of the character you are wearing.

**Vippe** (curly brown hair) has 13 skins. Red jersey, black hoodie and blue & black are free. The others cost coins:

| Skin | Coins | | Skin | Coins |
| --- | --- | --- | --- | --- |
| Forest camo (bandana) | 150 | | Student (student cap) | 450 |
| Sweden (bobble hat) | 200 | | Viking (horned helmet) | 600 |
| Fox (fox ears) | 300 | | Galaxy (orbiting stars) | 800 |
| Tiger (ears and whiskers) | 350 | | Rainbow (propeller cap) | 1000 |
| Moose (antlers) | 400 | | King Vippe (gold crown) | 1500 |

**Affelito** (straight light-brown hair swept to the side, hazel eyes, a lopsided grin and nearly always a trucker cap) has 14 skins. Black tee, grey hoodie and blue fleece are free. The others cost coins:

| Skin | Coins | | Skin | Coins |
| --- | --- | --- | --- | --- |
| Pixel camo (patchwork beanie) | 150 | | Robot (metal dome, blinking antenna) | 600 |
| Cowboy (cowboy hat, sheriff star) | 200 | | Astronaut (glass space helmet) | 800 |
| Ninja (headband) | 300 | | Dragon (hood with horns) | 1000 |
| Pirate (tricorn, eye patch) | 350 | | Fire (flames for hair) | 1500 |
| MODO Affelito (MoDo cap and jersey) | 400 | | Diamond (diamond cap) | 2000 |
| Goalie (hockey helmet and cage) | 450 | | | |

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

## Level 2: Tunnelbanan (≈ 1:29, 8 checkpoints)

Shorter than level 1 and a step up from it, with fewer checkpoints. It's like Subway Surfers: you jump up onto parked metro trains and run along their roofs. Halfway through, the tunnel floor caves in and you fall through a hole into the sewers, where crocodiles lie in the dirty water. The camera follows you down the hole, so you see the tunnel above and the sewer below.

| Section | Where | What happens |
| --- | --- | --- |
| **Sergels torg** | Stockholm: the black-and-white "Plattan", the glass obelisk, a T sign | Cones and barriers, then in through the subway entrance and down the escalators. |
| **T-Centralen** | the blue-line station: blue vines painted on the bedrock, a next-train display ("13 Storvreta, 1 min") | Hop across the ticket gates over the rats, climb a pile of suitcases, stay low under the pigeons, and take a jump pad up onto the roof of a train. Mind the gap: the live rail shows through the platform. |
| **Spåren** | the tracks, trains on them | Surf the trains: jump from roof to roof over the live rail (touching it crashes you), hop along barriers, and tap the orb over a gap that's too wide to jump. |
| **Tunneln** | the dark tunnel, a train rushing past on the other track | **Flying-bike mode** over the parked trains, between hanging signal boxes, a concrete beam and signal posts. The whole floor is live. Then the floor cracks... and caves in. |
| **Kloakerna** | the sewer: brick vaults, rusty pipes, dirty water, eyes watching from the side tunnels | Crocodiles: jump over the jaws of the ones facing you and land on their backs, and jump off the ones facing away before you reach their jaws. Crocodile heads snap up out of the sludge. Floating barrels. |
| **Avloppsröret** | inside the big sewer pipe | **Floorball mode** between blobs of green slime. |
| **Utloppet** | the last of the sewer | More crocodiles, two snapping heads with an orb between them, and out through the outlet... |
| **Riddarfjärden** | the waterfront at sunset: Gamla stan and Stadshuset with its three crowns | Gulls, cones and barriers, and the finish. |

Level 2 has its own soundtrack in E minor: a train rhythm on the tracks, a drum roll as the floor gives way, dripping water in the sewer, and G major when you come out into the sunshine.

## Level 3: Vilda skogen (≈ 1:37, 9 checkpoints)

A little longer than level 2 and harder: triple spikes, hedgehogs (they're spikes), crows you must not hit, orb chains, a tighter bike ride and faster gravity flips.

| Section | Where | What happens |
| --- | --- | --- |
| **Skogsbrynet** | the forest edge: pines, a hunting stand, squirrels, a hare, a moose | Hedgehogs, logs, a stump staircase over thorns, a moose crossing and stepping stones across a pool. Low-flying crows: stay on the ground under them. |
| **Granskogen** | deep spruce forest, an owl, a fox, a squirrel running up a pine | A woodpile with a spike on it, branch hopping over a floor of thorns, an orb chain, and a timber pile with a crow above it (jump early). |
| **Myren** | the misty bog: cranes, frogs on lily pads, dead trees | **Flying-bike mode** under the spruce boughs, weaving between dead trees and crows. The dead trees and the boughs are thorny: touching them crashes the bike. |
| **Björngrottan** | the bear cave: a sleeping bear, bats, glowing crystals | **Floorball mode** with a lower roof and a spike group every 5 blocks. |
| **Bäckravinen** | the brook ravine: deer, a woodpecker | Stones across the brook, a fox in the path, branches over the rapids. |
| **Gläntan** | the sunny clearing: a tent and a campfire | A last moose, an orb chain and the finish. |

Level 3 has its own folk-style soundtrack in D minor that ends in a major key when you reach the clearing.

## Level 4: Schackmatt (≈ 1:38, 10 checkpoints)

A grand marble chessboard under a twilight sky that deepens from pale lilac at the start to midnight purple at the king's throne. Six sections with rising difficulty: pawn spikes and marble pedestals, knight's L-jumps onto tall platforms, a flying-ship ride up a rook tower with winding spirals and banners, the bishop's diagonal in ball mode with interlocking spikes, everything mixed in the queen's hall, and a boss fight against the king himself who throws pawns that land on the ground and on platforms.

| Section | Where | What happens |
| --- | --- | --- |
| **Brädet** | the giant chessboard, morning light | Pawn spikes, rising and falling pedestal staircases (marble and ebony blocks), a pad up onto a tall rook tower. |
| **Springarna** | the knights' jumping grounds | Knights' L-jumps: pads launch you high onto tall platforms, then short drops to low landings. A long spike row with a rising chain of orbs at four different heights. |
| **Tornet** | inside a rook tower, flying | **Flying-ship mode** up inside a tall tower, weaving between spires and banners (thorny obstacles) with a dark current running down the middle. |
| **Löparens diagonal** | the bishop's diagonal pattern | **Ball mode**: threading through floor and ceiling spikes arranged diagonally, like a bishop's moves on a chessboard. |
| **Damens sal** | the queen's hall, hardest stretch | Everything mixed: pedestals, pads, platforms at different heights, spike-topped landings, orbs, a steep drop. The queen moves anywhere, and so do the obstacles. |
| **Kungens tron** | the king's throne, boss fight | The king stands on the board ahead of you, throwing pawns that land on ground level and on platform heights. Jump over the pawns and platforms, then reach the king to topple him — **Schack matt!** |

Level 4 has its own D-minor baroque soundtrack with a harpsichord lead and a march for the king's procession. The harmonic minor scale gives the board an ancient, formal tone that shifts toward the king's fanfare as you near the end.

## Level 5: Djupet (≈ 1:38, 10 checkpoints)

A little longer and harder than the chess level: a deep-sea dive with half-jumps, sharks, eels, a cave-in that shifts you to a deeper layer, flying-ship mode through jellyfish swarms, floorball mode inside a whale with an irregular rhythm, and the tightest stretch without a checkpoint.

| Section | Where | What happens |
| --- | --- | --- |
| **Korallrevet** | a warm, sunny coral reef | Sea urchins and low fast hops, a reef shark in the current (jump over its jaws, land on its back), and a rising staircase of coral pillars over a stream. |
| **Vraket** | a shipwreck on the seafloor | Deck planks too high to reach without a jump pad, a bioluminescent eel darting up from a floor gap, and a rising chain of bubbles through a cargo hold. At the end, the floor caves in—you fall to a deeper water layer. |
| **Manetsvärmen** | a swarm of jellyfish in deeper water | **Flying-bike mode**: weave through dense clusters of jellyfish and coral spikes, with a lone anglerfish breaking the pattern. |
| **Valens buk** | inside a whale, looking up at its teeth | Jump over a row of teeth as you swim in through the mouth, then tumble around inside. **Floorball mode** with an irregular rhythm and orb-assisted flips over wider gaps. |
| **Djuphavet** | the darkest, tightest, longest stretch | Eels darting up from holes in the sea floor, sharks to jump over, kelp platforms over a deep chasm. No checkpoint midway. |
| **Ytan** | swimming toward the light and surface | A final rising chain of bubbles straight to the goal. |

Level 5 has its own ambient soundtrack in A minor: flowing and ethereal in the reef and wreck, darker and sparser in the whale and deep sea, brightening toward major as you reach the surface.

## Level 6: Mardrömmen (≈ 1:48, 10 checkpoints, 16+)

A dark horror level with blood, jump scares, bloody nuns, creepy clowns and strobe lights, rated 16+ (the menu card shows a red 16+ badge and a ⚡ for flashing lights). It is hard in other ways than tight jumps too: darkness where only your lantern shines, strobe light where you only see the level in the flashes, moving hazards, running upside down on the ceiling, a mirrored screen, and jump scares that distract you. The last stretch, from the ghost train to the finish, has no checkpoint.

It is also the only level with a **health bar**. You start with 100 health, and each crash costs health and restarts you from the last checkpoint as usual. Health is not refilled at checkpoints. When it runs out, "DU DOG!" appears and you start the level over from the beginning with full health. You don't lose any coins.

| Section | Where | What happens |
| --- | --- | --- |
| **Kyrkogården** | graveyard at midnight, blood moon | Iron fences, hands clawing out of graves, tombstones, ravens, lightning, a jump scare at the convent gate. |
| **Klostret** | the convent | Pews, blood pools, candelabras and bloody nuns bobbing up and down in time with the music. |
| **Kapellet** | the chapel | Gravity flips and you run upside down on the ceiling, in the dark, lit only by strobe flashes (one per beat). |
| **Katakomberna** | the catacombs | Flying-bike mode in the dark with only your lantern; swinging pendulum axes, bone pillars, bats, a skull jump scare. |
| **Cirkusen** | the abandoned circus | Jack-in-the-box clowns popping up on the beat, clown balloons, crates and podiums. |
| **Spegelsalen** | the hall of mirrors | The whole screen is mirrored, so you run to the left. |
| **Spöktåget** | the ghost train | Floorball mode between skeletons popping out of the floor and ceiling, in strobe light. |
| **Klocktornet** | the bell tower | The last hard jumps; the bell tolls at the finish. |

### Health

Crashes cost health based on what you hit:

- **10 health:** iron fence spears, hands from graves, bone spikes, blood pools
- **12 health:** crashing into a block (tombstone, coffin, pew, crate), ravens and bats, candelabras and chandeliers, clown balloons
- **14 health:** bloody nuns, jack-in-the-box clowns, pendulum axes, ghost-train skeletons

So you can make 8–10 crashes before your health runs out. Below 30 health the bar blinks and you hear a heartbeat.

### Strobe and flashing lights

The strobe flashes are locked to the music at most once per beat (2.6 per second, under the 3-per-second limit in the WCAG accessibility guidelines). Turn the strobe off with the **⚡ Strobe: On/Off** button in the pause menu, which only shows on level 6. With the strobe off there is a steady dim light instead. The setting is saved.

Music: its own doom-metal soundtrack in C minor, in half-time so it feels like 78 BPM. It uses distorted guitar, organ, a choir, church bells, a detuned circus organ in the circus and a double-time climax in the ghost train. The melodies are original: the brief was "in the style of" the doom-metal song *Solitude* by Candlemass, and nothing is copied from it.

## How it's built

Everything is vanilla JavaScript with Canvas 2D and WebAudio. The game has **no image or audio files**: Vippe, the scenery and the soundtrack are all drawn and synthesised in code. The PNGs in `icons/` are only the app icon, drawn by `tools/icons.html`. The music is generated live at 156 BPM, which is exactly 4 blocks per beat, so obstacles land on the beat. When you respawn, the music restarts from the checkpoint.

```
index.html        page + menus (level select, shop, level-complete screen)
css/style.css     menu styling
js/util.js        colour/random helpers
js/physics.js     deterministic fixed-step physics (240 Hz): cube, ship, ball, pads, orbs, portals, holes
js/level.js       level builder, the level layouts, their themes and the level list
js/solver.js      search bot that proves the levels are beatable
js/audio.js       procedural chiptune (one song per level) + sound effects
js/art.js         all drawing: Vippe, Affelito and their skins, obstacles, animals, landmarks
js/horror.js      level 6 only: nuns, clowns, pendulums, jump-scare faces, graveyard/convent/circus scenery
js/render.js      parallax scene, camera (incl. following you down a hole), HUD
js/game.js        game loop, input, checkpoints, menus, coins and the shop
js/mobile.js      phone extras: fullscreen + landscape, portrait pause, back button
js/version.js     version string shown in the main menu (stamped by build tools)
fonts/            Lilita One (SIL Open Font License, see fonts/OFL.txt)
manifest.json     app name, icons and landscape/fullscreen for the installed app
sw.js             service worker: offline copy of every file for the installed app
icons/            app icons
tools/verify.html level verifier in the browser
tools/verify.py   level verifier from the command line (headless Chrome)
tools/map.html    draws a schematic map of a level's layout and rhythm
tools/skins.html  gallery of every skin in every mode, for checking designs
tools/horror.html gallery of all level 6 art: nuns, clowns, pendulums, jump scares; use ?t=<seconds> to freeze time
tools/shot.py     takes a PNG screenshot of any page with headless Chrome
tools/headless.py shared helper: runs pages in headless Chrome (finds Chrome or Edge automatically)
tools/icons.html  draws the app icons
tools/build_single.py builds dist/VippeDash.html, the one-file version (stamps version)
tools/release.py  one command to ship: check, verify, build and serve a new mobile build
.claude/skills/   Claude Code skills for common tasks (see "Working with Claude Code" below)
```

### Editing a level

Each level is a build function in `js/level.js` (`buildHome()`, `buildForest()` and `buildMetro()`), listed in `LEVELS` together with its theme (sky colours, ground, music) and coin reward. Units are blocks, and the player moves 10.4 blocks/s. For example:

```js
b.spike(26);                 // spike on the ground at x = 26
b.spikes(50, 2);             // two spikes in a row
b.spike(24, 0, 'hedgehog');  // a hedgehog is a spike with a different look
b.block(80, 0, 3, 1, 'stone'); // solid block: x, y, width, height, style
b.thorny(410, 0, 2, 3, 'deadtree'); // looks like a block, but crashes you on touch (no sliding along it)
b.bird(147, 1.35);           // a crow hovering at x, y (a hazard)
b.bird(97, 1.35, 'pigeon');  // ...or a pigeon, or a 'gull'
b.pad(128);                  // yellow jump pad
b.orb(154, 2);               // yellow orb (tap in mid-air)
b.portal(712, 'ship', { ceil: 10 });
b.checkpoint(96);
```

Level 2 adds:

```js
b.train(233, 12);            // a parked metro train, 2.5 blocks tall: too tall to jump onto, so use a pad or a step
b.rail(245, 3);              // live third rail (like water: touch it and you crash)
b.croc(488, 6);              // crocodile in the water: its back is a platform, its jaws (facing you) are a hazard
b.croc(505, 6, 'right');     // ...facing away: land on the tail, jump off before the jaws
b.snapper(537);              // a crocodile head snapping up out of the water
b.hole(454, 7);              // a hole in the floor: fall through it to the layer below
```

`b.hole()` splits the level into two floors, one above the other. Everything placed after the hole is on the lower floor. When you fall in, the physics moves you up by one screen (15 blocks) and onto the lower floor, so the fall looks continuous and the camera follows you down.

Level 4 (Schackmatt) adds:

```js
b.king(x0, x1);              // the king boss: stands KING_AHEAD blocks ahead as the player moves through [x0, x1]
b.pawn(x, y, { trigger, fall, arc }); // a pawn thrown by the king: lands at (x, y); y > 0 lands on a platform.
                             // trigger − fall must be ≥ 4 (the pawn lands before you reach it); the flight takes
                             // `fall` blocks of travel and arcs `arc` blocks high in a parabola, starting from the
                             // king's hand (always KING_AHEAD blocks ahead) to the landing position
```

Level 5 (Djupet) adds:

```js
b.half(27);                  // a low, fast hop (level 1 only until now)
b.shark(78, 5, 'left');      // a shark in the current: back is a platform, jaws (facing you) are a hazard
b.eel(721);                  // an eel darting up out of a hole in the sea floor
b.rail(233, 3, 'eel');       // rail()'s touch-and-die mechanic, reskinned as a glowing eel in a floor gap
b.hole(364, 8, 16);          // the floor caves in — the rest of the level plays out one layer deeper
```

Level 6 (Mardrömmen) adds:

```js
b.nun(x, y, { bob, beats, phase });      // a bloody nun bobbing up and down in time with the music
b.nunDrop(x, y, { trigger, dist, fall }); // a nun that drops (or rises, dist < 0) as you come near
b.jack(x, { beats, phase, rise });        // a jack-in-the-box: the box is a platform, the clown pops up on the beat
b.pendulum(x, top, { len, amp, beats, phase }); // a swinging axe
b.balloon(x, y, { bob, beats, phase });   // a clown balloon
b.water(x, w, 'blood');                   // a blood pool
b.portal(x, 'cube', { grav: 1, ceil: 7 }); // upside down: run on the ceiling
b.dark(x0, x1, { r: 7 });                 // darkness with a lantern around you
b.strobe(x0, x1);                         // strobe light, one flash per beat
b.mirror(x0, x1);                         // the screen is mirrored
b.lightning(x0, x1);                      // lightning now and then (with thunder in the music)
b.scare(x, 'nun');                        // a jump scare: nun, window, skull, clown, mirror, duo, final
```

Moving hazards are a function of the player's x (the level clock `x / 10.4`), so the physics, the bot and the drawing always agree. Every hazard has a `dmg` value used by the health bar. A `jack`'s `rise` must stay under about 1.3 so a jump can clear an open clown (the level uses 0.8).

After changing a level, verify it with the command line:

```bash
python tools/verify.py
```

This runs the search bot from every checkpoint to the next one using the real game physics. Add a level name to check one level only: `python tools/verify.py forest`. Options: `--windows` to measure timing slack (slower; `!` marks a jump with less than 90 ms, `!!` less than 50 ms), `--json` to print the raw report. Exit code 0 when every level is beatable.

Alternatively, open `tools/verify.html` through a local server. Add `?level=forest` to check one level only, and `windows` (for example `?level=forest&windows`) to also measure how much timing slack each jump has. Level 1 aims for 100 ms or more. Level 2's tightest jumps (the live rail on the tracks, the snapping crocodile heads) have about 80 ms. Level 3 is harder: its triple spikes have about 80 ms too, and it's longer. Level 4 (Schackmatt) sits between level 3 and Djupet: most of its tightest presses are around 83 ms, with one 67 ms section in the queen's hall. Level 5's tightest presses are about 67 ms, with more of them than level 4.

To see a level's layout and rhythm at a glance, open `tools/map.html?level=<id>` in a browser. It draws a schematic top-down/side map of the level's hitboxes, obstacles and checkpoints. Options: `from=<x>&to=<x>` (show part of the level), `cols=<n>` (blocks per row), `scale=<px>` (pixels per block, default 12), `bot` (draw the bot's path from every checkpoint, red where it fails), `windows` (also colour each jump by its timing slack). Example: `tools/map.html?level=forest&from=380&to=500&windows&scale=20`.

### Adding a skin or a character

Everything that differs between characters lives in `js/art.js` in the `Art.CHARS` data structure. Adding a new character means adding one entry to `Art.CHARS` (plus drawing hook functions if needed for custom hair/ears) and tagging its skins with `char: '<id>'` in `Art.SKINS`. The character's first skin must be free. The shop gets a tab for it automatically. See the comment above `Art.CHARS` in `js/art.js` for the full structure.

To check a new or modified skin with one screenshot, open `tools/skins.html` in a browser. It draws every skin of every character in every mode and size. Options: `char=<id>` (one character only), `skin=<id>,<id>` (select skins), `t=<seconds>` (freeze time so animated skins stand still), `scale=<n>` (multiply sizes), `bg=light` (light background for contrast checking). Without `t`, the page redraws every frame so animated skins can be watched live.

### Screenshots from the command line

```bash
python tools/shot.py "index.html?debug&level=forest&cp=5&freeze"
```

This saves a PNG of any page (here `shots/index.png`) with Chrome running without a window, straight from disk, so no server is needed. `-o file.png` picks the file and `--size 1280x720` the window size (`map.html` and `skins.html` set their own size). The page normally runs in fast-forwarded virtual time, which gives the same PNG every time for the same code. The shop redraws every card each frame, which is slow to fast-forward, so use `--realtime 2500` for it. The `shots/` folder is git-ignored. `tools/headless.py` is the shared helper: it finds Chrome or Edge by itself, or set the `CHROME` environment variable.

### Debug mode

Open `index.html#debug`. This shows hitboxes and FPS and adds these keys:

| Key | Effect |
| --- | --- |
| `1`–`9` / `Shift`+digit | Warp to that checkpoint |
| `[` / `]` | Previous / next checkpoint |
| `G` | God mode |
| `B` | The bot plays for you |
| `C` | +500 coins (also works in the menu), for testing the shop |
| `H` | Refill health to full (level 6 only) |

The hash (or query string) also accepts URL parameters to drop straight into a specific moment for screenshots or video:

| Parameter | Effect |
| --- | --- |
| `level=<id>` | Start that level directly, skipping the menu. Ids: `home`, `metro`, `forest`, `chess`, `ocean`, `nightmare` |
| `cp=<n>` | Start at checkpoint *n* (0 = the start) |
| `x=<blocks>` | Start at any x position. The bot plays from the checkpoint before it up to x, so the mode, gravity and floor are right |
| `skin=<id>` | Wear any skin for this session only (not saved; coins and owned skins untouched) |
| `hp=<n>` | Start with that much health on level 6 (e.g. to test game over); has no effect on other levels |
| `bot` | The bot plays |
| `god` | God mode |
| `mute` | Start muted (not saved) |
| `freeze` | Stop the game at the start position (for screenshots); any key, click or tap continues |
| `shop` | Open the shop (on the tab of the character you're wearing) |

Examples: `index.html?debug&level=metro&x=500&freeze` or `index.html#debug&level=forest&cp=5`. Parameters can go after `?` or `#`.

## Working with Claude Code

The project includes Claude Code skills in `.claude/skills/` for common development tasks:

- `/ny-bana` — start a new level
- `/fixa-bana` — fix or change a level
- `/ny-skin` — add a new skin
- `/ny-karaktar` — add a new character
- `/mobil` — prepare a new build for the phone

Each skill carries the checklist for that job. See `CLAUDE.md` in the project for the project rules that guide Claude's work.

## Notes

- The `ref-vippe/` and `ref-affelito/` photos were only used as reference for the character designs. They are not used in the game and are git-ignored so they stay private.
- `.venv/` holds Python and Pillow, used once to convert the HEIC photos. The game doesn't need it, it is git-ignored, and it can be deleted.
