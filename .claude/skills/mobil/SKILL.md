---
name: mobil
description: Bygger och skickar en ny version av VippeDash till mobilen (byggkoll, verifiering, och antingen en fil att mejla/skicka eller USB-installation/uppdatering). Använd när användaren skriver t.ex. "bygg till mobilen", "skicka nya versionen till telefonen", "gör en mobil-build" eller "uppdatera appen på telefonen".
---

Uppdrag: $ARGUMENTS

Det här hantverket har inget att designa — det är ett fast flöde. Opus kör det mesta själv (det går
fortare än att beskriva för en subagent); en subagent behövs bara om något faktiskt måste fixas.

## 1. Bygg och verifiera

Kör alltid detta steg, aldrig hoppa över verifieringen:

```
python tools/release.py --no-serve
```

Detta gör i ordning: filkoll (att `sw.js`s `FILES` matchar allt spelet laddar), `python tools/verify.py`
(alla banor beatable), stämplar en version (`YYYY-MM-DD HH:MM · <commit>`, `*` om arbetsträdet är smutsigt)
och bygger `dist/VippeDash.html`.

**Om något steg misslyckas: stoppa här och rapportera.** Skicka aldrig en bana som inte går att klara.
- Filkoll-fel (fil laddas av spelet men saknas i `sw.js` FILES, eller listad men finns inte på disk): fixa
  `sw.js` FILES direkt själv (litet, mekaniskt) eller delegera till en **Haiku**-agent om flera filer
  saknas.
- Verifieringsfel: det är en trasig bana — det hör hemma i `fixa-bana`-hantverket, inte här. Rapportera
  vilken bana/checkpoint som floppade och föreslå att köra `/fixa-bana` på den.

Om build lyckas: notera versionen som skrevs ut. Slutar den på `*` finns osparade ändringar: erbjud att
committa först (committa bara om användaren säger ja), annars fortsätt och nämn det i rapporten.

## 2. Leverera till telefonen

Två vägar, oberoende av varandra — gör det som passar uppdraget (fråga bara om båda kan vara rimliga och
uppdraget inte säger något):

### A. Snabbast: skicka filen direkt

`dist/VippeDash.html` (hela spelet i en fil, offline, öppnas i Chrome på telefonen) kan skickas direkt till
användaren med **SendUserFile**-verktyget — det är det snabbaste sättet om användaren följer konversationen
på telefonen, eftersom filen då dyker upp där direkt utan mejl. Nämn annars alternativet att mejla filen
till sig själv (README, "A. E-mail yourself one file"). Påminn: filen ska öppnas med **Chrome**, inte den
inbyggda HTML-visaren (JavaScript är avstängt där).

### B. Bäst: installera/uppdatera som app över USB

Starta previewn med `preview_start` (namnet `vippedash-release`, som redan kör `release.py --no-verify`
på port 8765) — **starta aldrig servrar med Bash**. Port 8765 måste vara ledig: stoppa `vippedash`-previewn
med `preview_stop` om `preview_list` visar den. Kan servern ändå inte starta för att porten är upptagen
kör användaren troligen en egen server (t.ex. `python -m http.server 8765` i en terminal): be användaren
stänga den i stället för att själv avsluta processer du inte startat. Utan ledig 8765 får telefonen den
gamla servern, som visar versionen `v dev`.

Ge användaren de korta USB-stegen (peka på README, avsnitt "B. Install it as an app over USB", steg 2–3
räcker vid en uppdatering om appen redan är installerad):
1. Koppla telefonen med USB, öppna `chrome://inspect/#devices` i Chrome på datorn, tillåt USB-felsökning.
2. **Port forwarding** → lägg till `8765` → `localhost:8765`, kryssa i **Enable port forwarding**.
3. Öppna appen på telefonen (eller `http://localhost:8765` i Chrome och **Installera app** första gången)
   medan kabeln fortfarande sitter i.
4. Stäng appen och öppna den igen — den nya versionen laddas då.

Påminn: versionen som visas i menyns nedre högra hörn är beviset på att telefonen fick den nya buildet —
be användaren jämföra den mot vad `release.py` skrev ut. En version som slutar på `*` betyder osparade
ändringar (inget fel, bara värt att veta).

## 3. Rapport till användaren

Sammanfatta: versionssträngen, om filkoll/verifiering gick igenom rent, storleken på `dist/VippeDash.html`,
och vilken leveransväg som användes (skickad fil och/eller USB-server startad). Om servern (väg B) startades
är den kvar igång — säg det, så användaren vet att stoppa den (`preview_stop`) när den är klar.

## 4. Commit

Bara om användaren uttryckligen bett om det i uppdraget — annars rör inget i git. Denna repo har ingen
remote: föreslå aldrig push eller en pull request.
