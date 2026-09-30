---
name: ny-bana
description: Skapar en helt ny bana i VippeDash, med tema, hinder, sektioner, musik och mynt. Använd när användaren skriver t.ex. "gör en ny bana", "bana 4", "en bana i rymden/vintern/på ett slott", "lägg till en ny nivå" eller liknande.
---

Uppdrag: $ARGUMENTS

En bana består av layout, konst, musik, meny och README. Opus planerar, skriver ett kontrakt och godkänner.
Fyra subagenter bygger **parallellt**, var och en i sina egna filer. Målet är att banan är klar på ungefär en timme,
med felen fångade i första varvet i stället för i extra omgångar.

## 1. Opus planerar (~10 min, inga subagenter än)

Läs `js/level.js` (den senaste banan som liknar uppdraget som mall, samt `LEVELS` och ett par `THEME`-objekt),
README ("Editing a level" och banornas tabeller) och `python tools/verify.py --windows` för jämförelsesiffror.

Bestäm (fråga användaren bara om uppdraget är genuint tvetydigt, annars sunt förnuft):
- **Tema, plats och svårighet.** Placering i listan (`num`), `difficulty`/`diffName`/`reward` (jämför med `LEVELS`).
- **Bantid** 1:30–2:00 om inget annat sägs. Längden styr inte svårigheten.
- **Checkpoints:** färre per minut = svårare (se befintliga banor i verify-utdata).
- **Svårighetsmål i ms:** easy ≥ 100 ms överallt, medium ~83 ms i de svåraste partierna, hard och very hard ~83 ms
  på fler ställen och högst något enstaka på 67 ms. Jämför med grannbanorna i listan.
- **Vad som är nytt:** minst en mekanik eller ett hindermönster som de andra banorna inte har. En bana som bara är
  en omskinnad kopia av en annan blir underkänd av användaren (Djupet fick byggas om av den anledningen).

Skriv **sektionsplanen**: sektioner med x-intervall (block, 10.4 block/s), innehåll (hinder, landmärken,
lägesbyten), checkpoints och ms-mål per sektion.

## 2. Konceptkoll med användaren (ett meddelande)

Visa sektionstabellen och en rad om "det nya i banan". Fråga om det ska köras. Det kostar en minut och sparar en
ombyggnad. Har användaren redan sagt "kör direkt", "hoppa över" eller liknande: gå vidare utan att fråga.

## 3. Kontraktet (Opus skriver, alla agenter får det ordagrant)

Kontraktet låser allt som agenterna delar, så att de kan arbeta samtidigt:
- Banans `id`, `num`, namn, `route` och `LEVELS`-fälten (`winTitle`, `winSub` med flera, som de befintliga).
- Temaobjektet i sin helhet: `ground`/`field`/`indoor`/`far` **för varje area-id** (lint kräver det), himmel,
  `beams`/`mist` och `song`-namnet.
- **Nya stilnamn** med en rad beskrivning var: hinderstilar, blockstilar, deco- och landmärkestyper,
  ground/field/indoor/far-stilar. Återanvänd befintliga stilar där det går. Varje ny stil kostar konsttid.
- **Nya hinder med fysik** (som `b.pawn` eller `b.shark`): byggmetodens signatur, objektets fält och hitbox,
  och hur render ska rita det (vilken Art-funktion och vilka parametrar).
- Låtens sektioner per takt (en sektion per area, 4 block/slag, 156 BPM om inget annat).

## 4. Fyra agenter parallellt

Starta alla fyra i samma meddelande med `run_in_background`. Ingen fil ändras av två agenter.

| Agent | Typ | Filer | Uppgift |
|---|---|---|---|
| **A, layout** | `banbyggare` | `js/level.js`, `js/physics.js` (bara nya hinder) | `build<Namn>()`, temat och `LEVELS`-posten enligt kontraktet. Nya byggmetoder och fysik. Justera mot målen med `python tools/verify.py <id> --target <ms>` tills sektionerna träffar. Kör `python tools/verify.py --compare <bas>` så att de andra banorna är orörda (Opus sparar basen med `--save` innan start och skickar sökvägen). |
| **B, konst** | `sonnet-utvecklare` | `js/art.js`, `js/render.js` | Rita alla nya stilar från kontraktet. Kontrollera med kontaktarket (`python tools/shot.py "tools/sheet.html?level=<id>"`) och `python tools/lint.py <id>` när A:s bana finns. Innan dess: testa stilarna med en egen tillfällig sida eller `tools/skins.html`-mönstret. |
| **C, musik** | `sonnet-utvecklare` | `js/audio.js` | Ny sång enligt kontraktet: ackord i `PROG`, en post i `SONGS` med `sections` per takt, och melodier som passar temat. |
| **D, README** | `haiku-hjalp` | `README.md` | Nytt banavsnitt (tabell som de andra banorna), introraden, mynttabellen och "Editing a level" om nya byggmetoder tillkommer. Skrivs från planen. Siffrorna (tid, ms) fylls i av Opus i slutet. |

Regler till alla: kontraktets namn gäller exakt. Committa inte. Rapportera ändrade filer och bevis (verktygsutdata,
bildsökvägar). A och B kan behöva varandra i slutet: B ser inte banan förrän A lagt in den, och A:s nya hinder syns
inte förrän B ritat dem. Det är väntat. Stilar som saknas ritas som standard (eller inte alls) under tiden, och
`lint.py` pekar ut dem.

## 5. Opus godkännandelista (~10 min)

Kör i den här ordningen. Stoppa vid första felet och skicka tillbaka till rätt agent med konkret feedback
(x-koordinat, stilnamn, vad som är fel):

1. `git diff --stat` och läs diffen.
2. `python tools/lint.py <id>` — 0 fel (tema, okända stilar, LEVELS-fält, CSS-klass, låt, renderingsrök).
3. `python tools/verify.py <id> --target <ms>` — alla segment klaras och träffar målen.
4. `python tools/verify.py --compare <bas>` — inga andra banor ändrade.
5. `python tools/shot.py "tools/sheet.html?level=<id>"` — läs arket. Ser alla sektioner ut som temat, inte som
   placeholderfyrkanter? Detaljer vid behov: `python tools/shot.py --cps <id>`.
6. Meny: `python tools/shot.py "index.html" --realtime 1500` — banan syns rätt i listan.
7. Previewn (`preview_start` med `vippedash`, aldrig Bash): `?debug&level=<id>&bot` en gång genom banan, och
   titta efter konsolfel.
8. Fyll i siffrorna i README (eller låt D göra det) och läs README-diffen.

## 6. Rapport och commit

Sammanfatta för användaren: namn, tema, svårighet, sektionerna, ms-siffror jämfört med grannbanorna, ändrade
filer, och bifoga kontaktarket. Committa bara om användaren bett om det. Pusha bara när användaren ber om det
(origin är MickeB75/vippedash, GitHub Pages från main).
