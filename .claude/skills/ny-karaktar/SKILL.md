---
name: ny-karaktar
description: Lägger till en helt ny spelbar karaktär i VippeDash (ansikte, hår, öron och en uppsättning egna skins). Använd när användaren skriver t.ex. "ny karaktär", "lägg till en tredje spelare", "gör en karaktär av mig/min kompis" eller ger referensfoton för en ny person att rita.
---

Uppdrag: $ARGUMENTS

Det här är det största av de fem hantverken: en ny post i `Art.CHARS` med egna ritfunktioner, en hel
uppsättning skins, en ny shop-flik och en README-uppdatering. Bygg på mönstret från `alfred` (näst nyaste
karaktären), inte `vippe` (den allra första, med fler specialfall).

## 1. Opus läser och planerar (innan någon subagent startas)

Läs **hela kommentarblocket direkt ovanför `Art.CHARS`** i `js/art.js` (rad ~90–121) — det dokumenterar
exakt varje fält och hook en karaktär kan/måste ha:
- Fält: `name`, `hair`, `first` (måste vara en gratis-skin), `skin`, `face` (`{x,y,w,h,r}` i enheter av
  kubstorleken), `iris`, `irisRing`, `brow`, `arch`, `grinTilt`.
- Hookar (alla valfria, signatur `(ctx, s) => void`): `behindFace` (öron etc., ritas innan ansiktet),
  `fringe` (lugg, efter ansikte/kinder men innan ögon), `topHair` (hår ovanpå, efter munnen). `fringe` och
  `topHair` hoppas över om skinnet har `noHair: true`; `behindFace` görs alltid.
- Skins taggas med `char: '<id>'` i `Art.SKINS`; shop-fliken och dess etikett byggs automatiskt av
  `js/game.js` från `Object.keys(Art.CHARS)` — ingen kod i game.js behöver ändras för fliken själv.

**Om användaren bifogar referensfoton** (som de git-ignorerade `Vincent/`/`Alfred/`-mapparna): de är
privata. Lägg **aldrig** in dem i git — lägg till mappnamnet i `.gitignore` (samma mönster som `Vincent/`
och `Alfred/`) om det inte redan finns, och nämn det i rapporten till användaren.

Bestäm (fråga bara om genuint oklart):
- **Karaktärens id** (kort, gemener, t.ex. förnamn), **namn** (visas på shop-fliken).
- **Utseende**: hårfärg/-stil, ögonfärg, ansiktsform — jämför mot `vippe`/`alfred` så den nya karaktären
  känns distinkt, inte en färgad kopia.
- **Skins**: 3 gratis (som Vippe/Affelito) + betalskins med samma prisstege som de befintliga karaktärerna
  (150, 200, 300, 350, 400/450, 600, 800, 1000, 1500[, 2000]). En av de tre gratis-skinsen blir `first`.

## 2. Delegera (Sonnet — ny ritkod, flera steg, kräver omdöme)

Kör i ordning, inte parallellt (allt rör `js/art.js`):

**Steg 1 — en Sonnet-agent** lägger till karaktären själv:
- Ny post i `Art.CHARS` med alla fält ovan.
- Nya hår-/öronfunktioner (som `alfHair`/`alfEars` i `js/art.js`) kopplade via `behindFace`/`fringe`/
  `topHair`.
- Minst 3 gratis-skins i `Art.SKINS`, taggade `char: '<id>'`, en av dem satt som `first`.
- Rör bara `js/art.js`. Ska inte committa. Rapportera vilka rader/funktioner som lades till.

**Steg 2 — en andra Sonnet-agent** (efter att du granskat steg 1) lägger till betalskins (samma fil,
därför sekventiellt): resten av skins-uppsättningen, prisstege och ev. nya `pattern`/`hat`-cases i
`bodyPattern()`/`hat()` i `js/art.js` för de nya skinsen (se `ny-skin`-hantverket för detaljer om det
mönstret).

**Parallellt med steg 2** (annan fil, ingen konflikt): en **Haiku**-agent lägger till karaktärsbeskrivning
och skin-tabell i `README.md` (samma format som Vippe/Affelito-avsnitten), och en **Sonnet**-agent
kontrollerar `css/style.css`: shop-flikraden (`.shoptabs`/`.tab`) är en flex-rad med fast bredd per flik —
med tre karaktärer kan den bli trång. Be den ta en shop-skärmdump (steg 3.2 nedan) och justera bara om
flikarna faktiskt klipps eller överlappar.

## 3. Verifiering (Opus kör dessa, eller kräver att subagenterna redan gjort dem)

1. **Hela galleriet för den nya karaktären**, fryst tid: `python tools/shot.py
   "tools/skins.html?char=<id>&t=0&scale=2"` — kolla varje skin i alla lägen och uttryck.
2. **Shop-fliken**: `python tools/shot.py "index.html?debug&shop&skin=<first-skin-id>" --realtime 2500` —
   kolla att den nya fliken syns, ser rätt ut och inte trycker undan de andra.
3. **Före/efter-koll att inget annat ändrades**: ta en referens-PNG av de befintliga karaktärerna INNAN du
   delegerar (`python tools/shot.py "tools/skins.html?char=vippe&t=0"` och samma för `alfred`), och en till
   efteråt — filerna ska vara byte-identiska (samma frysta tid → samma pixlar). Jämför t.ex. med
   `sha256sum` på båda PNG-filerna, eller bara ögna igenom dem sida vid sida.
4. `python tools/verify.py` — en ny karaktär rör aldrig fysik/hitboxar, men kör som sanity-check.
5. Webbläsarpreview (`preview_start` med `vippedash`, aldrig Bash): byt till den nya karaktären i shopen
   manuellt och bekräfta att `←`/`→` bläddrar till/från den nya fliken (game.js läser `Object.keys(Art.CHARS)`
   för `ArrowLeft`/`ArrowRight` automatiskt — inget att koda där, bara att bekräfta i preview).

## 4. Rapport och commit

Rapportera: karaktärens id/namn, antal skins och prisstege, filer som ändrades, resultatet av
byte-identisk-kollen på de gamla karaktärerna, och om referensfoton lades till i `.gitignore`. Committa
bara om användaren bad om det. Ingen remote finns — föreslå aldrig push eller PR, och committa aldrig
referensfoto-mappar.
