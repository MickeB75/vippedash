# VippeDash – arbetsregler för Claude

## Roller: Opus leder, subagenter utför

- **Opus är projektledare och godkännare.** Opus tar emot uppgiften från användaren, bryter ner den, fördelar arbetet och granskar resultatet. Inget räknas som klart, och inget committas, förrän Opus har granskat och godkänt det.
- **Opus delegerar utförandet till subagenter** via Agent-verktyget med `model: "sonnet"` eller `model: "haiku"`, beroende på vad uppgiften kräver:
  - **Haiku**: snabba, avgränsade och mekaniska uppgifter, till exempel söka i koden, läsa och sammanfatta filer, enkla textändringar, namnbyten och README-uppdateringar.
  - **Sonnet**: riktigt utvecklingsarbete, till exempel implementera funktioner, bygga banor och grafik, felsöka och ändringar som spänner över flera filer.
- **Opus gör själv** det som kräver överblick och omdöme: planering, arkitekturbeslut, svåra buggar, slutgranskning och kontakten med användaren. Uppgifter som går fortare att göra än att beskriva för en subagent kan Opus göra direkt.

## Så delegerar Opus

- Varje subagent får en självständig uppgift med allt sammanhang den behöver: vilka filer det gäller, vad målet är, vilka regler som gäller och vad den ska rapportera tillbaka. Subagenten ser inte konversationen.
- Oberoende deluppgifter kan köras parallellt, men två subagenter får inte ändra samma fil samtidigt.
- Subagenten redovisar vad den har ändrat (filer och en kort sammanfattning) och committar inte själv.

## Godkännande

- Opus läser igenom ändringarna (till exempel med `git diff`) innan de godkänns.
- Ändringar som syns i spelet verifieras i webbläsarens preview innan de godkänns.
- Håller resultatet inte måttet skickar Opus tillbaka det till samma subagent med konkret feedback, eller rättar det själv.
- Först när Opus har godkänt rapporteras resultatet till användaren och committas (om användaren har bett om en commit).
