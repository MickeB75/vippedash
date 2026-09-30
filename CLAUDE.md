# VippeDash – arbetsregler för Claude

## Roller: Opus leder, subagenter utför

- **Opus är projektledare och godkännare.** Opus tar emot uppgiften från användaren, bryter ner den, fördelar arbetet och granskar resultatet. Inget räknas som klart, och inget committas, förrän Opus har granskat och godkänt det.
- **Huvudsessionen är alltid Opus 5.5 med effort high** (satt i `.claude/settings.json`).
- **Opus delegerar utförandet till subagenter** via Agent-verktyget med en av projektets agenttyper i `.claude/agents/`. Modell och effort ligger i agentdefinitionen, så ange `subagent_type` och ingen `model`:
  - **`haiku-hjalp`** (Haiku 4.5, effort low): snabba, avgränsade och mekaniska uppgifter, till exempel söka i koden, läsa och sammanfatta filer, enkla textändringar, namnbyten och README-uppdateringar.
  - **`sonnet-utvecklare`** (Sonnet 5.5, effort medium): riktigt utvecklingsarbete, till exempel grafik, musik, skins, verktyg, felsökning och ändringar som spänner över flera filer.
  - **`banbyggare`** (Sonnet 5.5, effort high): banlayout, svårighet och ny hinderfysik, där timingen ska träffa ett mål.
- När skillsen säger "Sonnet-agent" menas `sonnet-utvecklare`, eller `banbyggare` för bandesign. "Haiku-agent" betyder `haiku-hjalp`.
- **Opus gör själv** det som kräver överblick och omdöme: planering, arkitekturbeslut, svåra buggar, slutgranskning och kontakten med användaren. Uppgifter som går fortare att göra än att beskriva för en subagent kan Opus göra direkt.

## Så delegerar Opus

- Varje subagent får en självständig uppgift med allt sammanhang den behöver: vilka filer det gäller, vad målet är, vilka regler som gäller och vad den ska rapportera tillbaka. Subagenten ser inte konversationen.
- Oberoende deluppgifter kan köras parallellt, men två subagenter får inte ändra samma fil samtidigt.
- Subagenten redovisar vad den har ändrat (filer och en kort sammanfattning) och committar inte själv.

## Verktyg

- De vanligaste jobben har egna kommandon med checklistor i `.claude/skills/`: `/ny-bana`, `/fixa-bana`, `/ny-skin`, `/ny-karaktar` och `/mobil`. Följ dem när uppgiften passar.
- Subagenter kontrollerar sitt eget arbete utan webbläsare: `python tools/verify.py [bana] [--windows]` (går banan att klara, hur snäva är hoppen), `python tools/shot.py "<sida>"` (PNG som kan läsas med Read), `tools/map.html` (banans karta), `tools/skins.html?t=0` (alla skins, byte-identisk bild för samma kod) och debug-URL:er som `index.html?debug&level=forest&cp=5&freeze`. Detaljerna står i README.
- Ge subagenten de verktygskommandon som behövs i uppdraget och be den visa bilder eller utdata som bevis i rapporten.
- Previewn startas med `preview_start` (konfigurationerna i `.claude/launch.json`), aldrig med Bash. Om port 8765 är upptagen av användarens egen server, använd `vippedash-alt` (8766) i stället för att stänga den.

## Godkännande

- Opus läser igenom ändringarna (till exempel med `git diff`) innan de godkänns.
- Ändringar som syns i spelet verifieras i webbläsarens preview innan de godkänns.
- Håller resultatet inte måttet skickar Opus tillbaka det till samma subagent med konkret feedback, eller rättar det själv.
- Först när Opus har godkänt rapporteras resultatet till användaren och committas (om användaren har bett om en commit).
