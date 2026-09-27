---
name: ny-bana
description: Skapar en helt ny bana i VippeDash, med tema, hinder, sektioner, musik och mynt. Använd när användaren skriver t.ex. "gör en ny bana", "bana 4", "en bana i rymden/vintern/på ett slott", "lägg till en ny nivå" eller liknande.
---

Uppdrag: $ARGUMENTS

En bana är ett stort jobb: layout, tema, konst, musik, meny och README hänger ihop. Opus planerar och
godkänner, Sonnet bygger.

## 1. Opus planerar (innan någon subagent startas)

Läs `js/level.js` (särskilt `buildForest()` som mall — kortare och nyare än `buildHome()`), `README.md`
("Editing a level" + banornas tabeller) och de tre `THEME`-objekten i `js/level.js`.

Bestäm (fråga användaren bara om uppdraget är genuint tvetydigt, annars sunt förnuft):
- **Tema och plats** (t.ex. rymden, vintern, ett slott) och **svårighetsgrad** 1 (Easy), 2 (Medium) eller 3
  (Hard) — se difficulty-tabellen nedan.
- **Bantid**: bana 1 ≈ 2:00, bana 2 ≈ 1:29, bana 3 ≈ 1:37, bana 4 ≈ 1:48. Längden styr inte svårigheten;
  sikta på 1:30–2:00 om användaren inte ber om något annat.
- **Antal checkpoints**: färre per minut = svårare (bana 1 har 16 på 2:00, bana 2 har 8 på 1:29,
  bana 3 har 9 på 1:37).
- **Lägesbyten**: bana 1 har ship + ball, bana 2 och 3 har samma. Nya lägen kräver ingen ny kod — bara
  `b.portal(x, 'ship'|'ball'|'cube', {ceil, y})`.
- **Svårighetsmål** (från README): easy ≥ 100 ms överallt, medium ~80 ms i de svåraste partierna
  (strömskenan, krokodilhuvudena i Tunnelbanan), hard ~80 ms men fler sådana partier (trippelspikarna i skogen).

Skriv en **sektionsplan** innan du delegerar: en lista av sektioner med x-intervall (i block, hastighet
10.4 block/s), vad som händer i varje (hinder, landmärken, lägesbyte), var checkpoints ligger och vilken
timing-marginal du siktar på. Det här är arbetsordern subagenten får — utan den blir resultatet planlöst.

Bestäm banans `id` (kort engelskt/svenskt ord, gemener, t.ex. `'winter'`), `num` (nästa lediga, troligen 4),
`difficulty`/`diffName`/`reward` (50/100/150 följer difficulty — högre för en fjärde bana om den ska vara
svårast) och namn på svenska + `route`-sträng (sektionsnamnen med `›` emellan, se `LEVELS` i `js/level.js`).

## 2. Delegera till subagenter (Sonnet — det här är riktig speldesign)

Kör helst i **två omgångar**, inte parallellt, eftersom nästan allt arbete rör samma två filer
(`js/level.js` och `js/render.js`) och två agenter inte får ändra samma fil samtidigt.

**Omgång 1 — en Sonnet-agent bygger banan och temat.** Ge den sektionsplanen ordagrant, samt:
- Filer den får ändra: `js/level.js` (ny `build<Namn>()`-funktion + nytt `THEME`-objekt + ny post i
  `LEVELS`), `js/render.js` (nya `ground`/`field`/`indoor`/`far`-stilar om temat kräver dem — sök var
  befintliga stilar som `'peat'`, `'cave'` och `'metro'` hanteras och följ samma mönster), `js/art.js`
  (nya dekor-/landmärkestyper och hinderstilar om temat kräver dem — sök `deco(`/`landmark(` i den nya
  banan mot switch-satserna i art.js), `js/audio.js` (ny sång: kopiera mönstret för `forest`/`metro`:
  ackordföljder i `PROG`, en post i `SONGS` med `sections` per bar, och koppling via temats `song`-nyckel).
  Rör inte `js/game.js`, `css/style.css` eller README — det tar Opus/andra agenter senare.
- Regler: bygg med `Builder`-metoderna i `js/level.js` (`b.spike`, `b.block`, `b.thorny`, `b.pad`, `b.orb`,
  `b.portal`, `b.checkpoint`, `b.hole`, `b.train`/`b.croc`/`b.rail`/`b.snapper` om läge 3-liknande hinder
  behövs, `b.deco`, `b.landmark`, `b.area`, `b.finish`). Följ enhetssystemet (block, 10.4 block/s, 156 BPM
  = 4 block/slag — lägg hinder på slaget).
- Den ska **inte** committa och ska rapportera exakt vilka filer och funktioner den lade till.

**Efter omgång 1** (när du granskat diffen): menyn, sifferknapparna och "Next level" i `js/game.js` läser
redan `VD.LEVELS`, så `game.js` behöver inga ändringar. Kontrollera själv (litet) att `LEVELS`-posten har
`winTitle`/`winSub` som de tre befintliga, och om banan fått en ny `difficulty`: `.lvl.d2`/`.lvl.d3` i
`css/style.css` sätter cirkelns färg, så en ny svårighetsgrad behöver en egen `.lvl.d<N>`-regel (annars
ärver den bana 1:s blå). Behövs fler justeringar skickar du tillbaka dem till omgång 1:s agent.

En **Haiku**-agent, parallellt med granskningen (annan fil, ingen konflikt), uppdaterar `README.md`: nytt
banavsnitt i tabellform (som bana 1–3), lägg till i introraden, mynttabellen och "Editing a level" om nya
byggarmetoder tillkom.

## 3. Verifiering (Opus kör själv innan godkännande)

1. `python tools/verify.py <id> --windows` — 0 fel, och titta på "tightest press"-raderna mot svårighetsmålet.
2. `python tools/verify.py` (alla banor) — säkerställ att inget annat gick sönder.
3. Karta: `python tools/shot.py "tools/map.html?level=<id>&windows"` (dela upp i `from`/`to`-intervall om
   banan är lång) — läs PNG:erna, kolla att bothanen (den turkosa linjen) inte är röd någonstans.
4. Skärmdumpar av varje sektion: `python tools/shot.py "index.html?debug&level=<id>&cp=<n>&freeze"` för
   varje checkpoint — kolla att konsten faktiskt ser ut som temat (inte bara placeholder-fyrkanter).
5. Meny-skärmdump: `python tools/shot.py "index.html" --realtime 1500` — kolla att 4 rader får plats i
   panelen utan att klippas eller se trängda ut.
6. En snabb genomspelning i webbläsarpreviewen (`preview_start` med `vippedash`, INTE Bash) med
   `?debug&level=<id>&bot` för att se bottens väg, och en manuell koll av känslan.
7. `sw.js` FILES: om nya filer laddas (osannolikt för en bana, men om ny konst kräver en ny fil) — annars
   inget att göra här.

Håller något inte måttet: skicka tillbaka till samma subagent med konkret feedback (x-koordinat, vad som
är fel) eller fixa själv om det är litet.

## 4. Rapport till användaren

Sammanfatta: banans namn/tema/svårighet, sektionerna, verify.py-resultat (inkl. tightaste ms), vilka filer
som ändrades. Bifoga gärna en kart-skärmdump.

## 5. Commit

Bara om användaren bett om det i uppdraget. Denna repo har ingen remote — föreslå aldrig push eller PR.
