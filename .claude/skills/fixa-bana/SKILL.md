---
name: fixa-bana
description: Uppdaterar eller felsöker en befintlig bana i VippeDash — ett för svårt hopp, en glitch, ett visuellt fel eller en ny sektion i en bana som redan finns. Använd när användaren skriver t.ex. "bana 2 är för svår vid ...", "det där hoppet känns omöjligt", "fixa glitchen i skogen", "det ser fel ut vid tunneln" eller "lägg till en sektion i bana 3".
---

Uppdrag: $ARGUMENTS

Mönstret här är alltid: hitta stället, ta "före"-bevis, fixa, ta "efter"-bevis, jämför, verifiera att
inget annat i banan gick sönder.

## 1. Opus lokaliserar och beslutar (innan delegering)

Ta reda på **exakt var** i banan problemet är. Användaren säger ofta ett ungefärligt ställe ("vid
trippel-spikarna", "efter cykel-delen") — hitta x-koordinaten i banans `build<Namn>()` i `js/level.js`
genom att läsa koden, inte gissa.

Ta fram **"före"-bevis** själv (eller låt en Haiku-agent göra det mekaniskt, se nedan) innan du delegerar
fixen, så du har ett facit att jämföra mot:
- `python tools/verify.py <level-id> --target <ms> --save <scratch>/fore.json` — notera trycken (ms, x) nära
  problemet. Filen används som facit i steg 3.
- `python tools/shot.py "tools/map.html?level=<id>&from=<x-30>&to=<x+30>&windows"` — läs PNG:en.
- Om det är ett visuellt fel: `python tools/shot.py "index.html?debug&level=<id>&cp=<n>&freeze"` (välj
  `cp` = checkpointen strax före x; game.js's `applyDebugStart` kör `x=` genom bottens lösning så du kan
  även fastforwarda: `&x=<blocks>` istället för `&cp=`).

Bestäm scope: en timing-fix rör bara siffror i `js/level.js` (flytta ett hinder, ändra en `y`, lägga till
någon meters marginal). En visuell bugg rör `js/art.js` (ritkod) eller `js/render.js` (tema/scen). En ny
sektion är en mindre version av ny-bana-flödet: lägg till en sektionsplan-bit själv innan delegering.

## 2. Delegera

Välj agenttyp efter storlek (små fixar ska gå snabbt):
- `haiku-hjalp`: en ren sifferändring där du redan vet exakt vad som ska ändras (flytta ett hinder 2 block).
- `banbyggare`: ett hopp eller en sektion som ska träffa ett ms-mål, eller ny sektion.
- `sonnet-utvecklare`: ett visuellt fel i `js/art.js`/`js/render.js`.

En självständig uppgift till agenten:
- Exakt vad som är fel (beskrivning + x-koordinat + checkpoint-index) och vad "bra" ska betyda (t.ex.
  "minst 90 ms marginal" eller "spiken ska synas ovanför busken, inte bakom den").
- Vilka filer den får ändra — normalt bara `js/level.js` för ett hopp/en glitch, eller `js/art.js` +
  `js/render.js` för ett visuellt fel. Säg uttryckligen att den INTE ska röra andra sektioner eller andra
  banor.
- Be den kontrollera sitt eget arbete: `python tools/verify.py <id> --target <ms>` för timing,
  `python tools/lint.py <id>` för tema/stilar/krascher, och en efter-skärmdump med `tools/shot.py`
  (den kan läsa PNG:er med Read-verktyget).
- Den ska rapportera vilka rader/funktioner den ändrade och inte committa.

Om det bara är en README-textbit som behöver justeras (t.ex. sektionens beskrivning ändras för att en
mekanik lades till), kan en **Haiku**-agent göra det parallellt (annan fil: `README.md`).

## 3. Verifiering (Opus, innan godkännande)

1. `python tools/verify.py <id> --compare <scratch>/fore.json` — visar exakt vilka segment som ändrats.
   Bara segmentet med problemet ska skilja sig, och det ska träffa målet (se README "Editing a level").
2. `python tools/lint.py <id>`. Bara om en delad hjälpfunktion i art.js/render.js/physics.js ändrades:
   kör även `python tools/verify.py` och `python tools/lint.py` på alla banor.
3. Karta igen på samma `from`/`to`-intervall som "före", jämför PNG mot PNG.
4. Om visuellt: samma `cp`/`x`+`freeze`-skärmdump som "före", jämfört sida vid sida.
5. En snabb koll i webbläsarpreviewen (`preview_start` med config `vippedash`, aldrig Bash) —
   `index.html?debug&level=<id>&cp=<n>` och testa hoppet/utseendet själv, eller `&bot` för att se botens
   väg leva.

Håller det inte måttet: skicka tillbaka till samma subagent med den nya mätningen som konkret feedback.

## 4. Rapport och commit

Rapportera vad som var fel, vad som ändrades (fil + rad/funktion) och de nya verify.py-siffrorna jämfört
med de gamla. Committa bara om användaren bad om det. Pusha bara när användaren ber om det (origin är MickeB75/vippedash).
