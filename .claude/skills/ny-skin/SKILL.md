---
name: ny-skin
description: Lägger till en ny skin (kostym) till en befintlig karaktär (Vippe eller Affelito) i VippeDash, med pris, ritkod och shop-integration. Använd när användaren skriver t.ex. "ny skin till Vippe", "Affelito, polis, 500 mynt", "lägg till en pirat-skin" eller liknande.
---

Uppdrag: $ARGUMENTS

En skin är i grunden en post i `Art.SKINS` (`js/art.js`) plus, om den behöver ett nytt utseende (mönster,
hatt, keps-badge), lite ny ritkod i samma fil. Det mesta är mekaniskt nog för en enda Sonnet-agent.

## 1. Opus beslutar (fråga bara om uppdraget är tvetydigt)

Läs kommentarblocket direkt ovanför `Art.CHARS` i `js/art.js` (rad ~90–121) och hela `Art.SKINS`-objektet
(rad ~59–88) innan du planerar — det dokumenterar exakt vilka fält en skin kan ha.

Bestäm:
- **Vilken karaktär** ('vippe' eller 'alfred') — om uppdraget bara säger ett namn som "polis" utan
  karaktär, välj den som saknar en liknande skin, annars fråga.
- **`char`-fältet**: utelämna det för Vippe-skins, sätt `char: 'alfred'` för Affelito.
- **Utseende**: vilket `pattern` (kropp) och `hat` (huvudbonad) den ska ha. Återanvänd ett befintligt
  `pattern`/`hat`-namn om det redan passar (t.ex. `hat: 'cap'` med en ny `cap: {front, mesh, brim, badge}`
  för en ny Affelito-keps-skin), annars planera ett nytt `case` i `bodyPattern()`/`hat()`/`truckerCap()`
  (badge) i `js/art.js` — sök `function bodyPattern(`, `function hat(`, `function truckerCap(`.
- **Pris**: följ den befintliga prisstegen (se README:s skin-tabeller): 0 (3 första), 150, 200, 300, 350,
  400, 450, 600, 800, 1000, 1500, (Affelito även 2000). Sätt priset där det nya utseendets komplexitet
  passar in — enklare mönster lägre, animerade/lysande högre.
- **Shop-ordning**: skins listas i shop-rutnätet i den ordning de står i `Art.SKINS` — lägg den nya posten
  där den hör hemma i prisstegen (inte bara sist).
- **Namn**: kort svenskt/engelskt skin-namn som i övriga listan (`name: '...'`).

## 2. Delegera (Sonnet — ritkod är utvecklingsarbete, inte mekaniskt)

En agent, en fil (`js/art.js`), självständig uppgift:
- Lägg till posten i `Art.SKINS` med exakt de fält du bestämt (name, main, dark, trim, ev. frame, pattern,
  hat, ev. cap-objekt, ev. `noHair: true` om huvudbonaden ersätter allt hår, price).
- Om ett nytt `pattern`/`hat`/badge-utseende behövs: implementera det som ett nytt `case` i
  `bodyPattern(ctx, s, k)`, `hat(ctx, s, k)` respektive `truckerCap()`s badge-switch — följ stilen på
  befintliga cases (rita i enheter av `s`, kolla `k.dark`/`k.trim`/`k.main` för färger, `now` finns för
  animation via `performance.now()/1000`).
- Rör inga andra skins, ingen annan fil.
- Ska själv verifiera sitt arbete innan den rapporterar (se steg 3 nedan — den kan köra `tools/shot.py`
  och läsa PNG:er med Read-verktyget själv).
- Rapportera: skinnets id, vilka rader som lades till/ändrades, och om ett nytt `pattern`/`hat`/badge-case
  skapades.

## 3. Verifiering (Opus kör dessa, eller kräver att subagenten redan gjort dem)

1. Galleri, fryst tid för pixelstabil bild: `python tools/shot.py "tools/skins.html?skin=<id>&t=0&scale=2"`
   — kolla ansikte, kropp och hatt i alla lägen (cube/ship/ball/ball flipped) och uttryck. Kör även med
   `bg=light` (`&bg=light`) för att se att kepsen/hatten syns mot en ljus himmel också.
2. Shop-kortet, i rörelse (animerade mönster som rainbow/galaxy/gold behöver realtid, annars fryses de på
   en enda frame): `python tools/shot.py "index.html?debug&shop&skin=<id>" --realtime 2500`. Kolla att
   kortet ser rätt ut och att priset stämmer.
3. In-game, i alla tre lägen, med `x=` (boten spelar fram dit, så läget blir rätt). På bana 1 (`home`) är
   man kub i början, på flygcykeln från x 784 och innebandyboll från x 1088:
   `python tools/shot.py "index.html?debug&level=home&x=<40|800|1100>&skin=<id>&freeze"` (en bild per
   läge). Andra banors lägesbyten hittar du med `b.portal(`/`b.checkpoint(` i `js/level.js` eller kartan.
4. `python tools/verify.py` (alla banor) — en ny skin rör aldrig hitboxar eller fysik, men kör ändå som
   sanity-check att inget annat gick sönder om samma commit rörde flera filer.
5. Webbläsarpreview (`preview_start` med `vippedash`, aldrig Bash): öppna shopen manuellt och bekräfta
   köp-/bär-flödet ser rimligt ut.

En **Haiku**-agent kan parallellt (annan fil, ingen konflikt) uppdatera skin-tabellen i `README.md`
(räkna om antalet skins för karaktären och lägg till raden med namn + pris).

## 4. Rapport och commit

Rapportera: skin-id, namn, pris, karaktär, nytt `pattern`/`hat` (om något), skärmdumparna du tog. Committa
bara om användaren bad om det — ingen remote, aldrig push/PR.
