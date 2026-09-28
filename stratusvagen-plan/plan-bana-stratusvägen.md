# Plan: bana "Stratusvägens alla helgon"

Anteckningar, information och beslut för en ny bana i VippeDash. Uppdateras löpande.

## Beslut hittills

| Beslut | Innehåll |
|---|---|
| Namn | **Stratusvägens alla helgon** |
| Plats | Stratusvägen, verklig gata (se karta och foton nedan) |
| Tid och stämning | Halloweenkväll, **skymning** |
| Svårighet | Den i grunden **lättaste banan hittills** när det gäller hopp (lättare än 1 · Hem till Storvreta) |
| Husnummer | **Alla hus** visar sina nummer, i rätt ordning från 66 ner till 1, på en brevlåda eller på fasaden |
| Musik | En lekfull uptempoversion av **When the Saints Go Marching In**, en melodi som alla känner igen. Se avsnittet om musiken nedan. |
| Plats i listan | **Först**, som bana 1. Övriga banor flyttas ett steg: Hem till Storvreta blir 2, Tunnelbanan 3 och så vidare till Mardrömmen som 7. |
| Längd | Ca **2 minuter**, lika långt som 1 · Hem till Storvreta. Med 156 BPM och 4 block per taktslag blir det ungefär 1 250 block. |
| Checkpoints | Bara **1 checkpoint**, halvvägs (efter ca 1 minut) |
| Start och mål | Start vid **nr 66**, mål vid **nr 1** |
| Viktiga hus | **66, 62, 50 och 15** ska gå att känna igen i spelet, och vid vart och ett ska **något särskilt hända** |
| Perspektiv och två filer | Delar av banan jobbar **mer med perspektiv** än tidigare banor. Stratusvägen är **tvåfilig**, och ett hinder kan undvikas genom att **byta fil i djupled** i stället för att hoppa. Det sker i ett nytt **filläge** där knappen byter fil i stället för att hoppa. Se avsnittet om de två filerna nedan. |
| Kameraåkning | I **första kurvan efter 50** åker kameran över till **andra sidan gatan**, helst i "3D". Nr 15 ligger på motsatt sida mot 66, 62 och 50. Vippe springer fortfarande från vänster till höger efteråt. Se avsnittet om kameraåkningen nedan. |

## Material i mappen `stratusvagen-plan/`

- `karta-stratusvagen.png`: skärmbild från Google Maps. Stratusvägen går som en **hästsko** som är öppen mot söder: ett östra och ett västra ben som möts i en böj i norr, med Fjädermolnsvägen i söder. Från det östra benet går en kort återvändsgata österut (nr 52 och 54).
- `karta-husnummer-1.png` … `-5.png`: inzoomade kartbilder med husnumren.
- `foton/`: 40 foton tagna 2026-09-28 kl. 10:27–10:32, i ordning **från start (66) till mål (1)**. Filnamnen är tidsstämplar, så sorterade i bokstavsordning ligger de i gångordning.
- `Photos-1-001.zip`: originalzipen med samma foton (kan tas bort när vi vet att `foton/` räcker).

> Obs: fotona (ca 177 MB), zipen och kartbilden ligger i `.gitignore` och committas inte. Bara den här planen följer med i repot.

## Vägen, foto för foto

Numreringen nedan (1–40) är fotots plats i gångordning.

| Foto | Fil | Vad som syns | Del av banan |
|---|---|---|---|
| 1–2 | 102725, 102746 | Infarten från den större vägen. Skylt "P", parkeringsförbud, **15 km/h**. Parkering till höger. | Start |
| 3–4 | 102803, 102812 | Rak gata med radhus på båda sidor | Start |
| 5–6 | 102815, 102823 | **Nr 66**: svart SUV på uppfarten, plankskärm, brevlåda med "66" | Hus 66 |
| 7 | 102826 | Rak gata med **farthinder** (svarta gummiskenor) tvärs över vägen | Första raksträckan |
| 8–10 | 102834–102845 | **Nr 62**: radhus med plankförråd, odlingslådor, brevlåda med "62" | Hus 62 |
| 11–17 | 102849–102918 | Förbi 60–56 och korsningen med återvändsgatan (52, 54). Vita hus i bakgrunden, parkeringsplatser, en innebandymålbur på en uppfart | Slutet av östra benet |
| 18 | 102934 | **Nr 50**: svart VW på uppfarten, brevlåda med "50", litet träd. 50 och 48 står i nordöstra hörnet. | Hus 50 |
| 19–23 | 102936–102953 | Kurvan i nordöstra hörnet, farthinder, parkerade bilar, gatlyktor | Första kurvan efter 50: **kameraåkningen**, ungefär **halvvägs** |
| 24–26 | 103003–103024 | Hästskons topp västerut, med ett **flerbostadshus** i bakgrunden. Brevlåda med "36" (foto 26) | Toppen |
| 27 | 103032 | Farthinder, släpvagn och bilar vid en garagelänga | Toppen |
| 28 | 103038 | **Nr 15**: grå bil på uppfarten, trädäck med brevlåda med "15", gungor i bakgrunden. Sista huset på toppens innersida. | Hus 15 |
| 29–30 | 103042, 103046 | Kurvan i nordvästra hörnet, förbi en trädgård med rabatter och fågelholk | Andra kurvan |
| 31–38 | 103100–103156 | Västra benet söderut: lång raksträcka med radhus, parkerade bilar, **släpvagn**, farthinder (foto 36) | Upploppet |
| 39–40 | 103207, 103220 | Gatan mynnar ut mot Fjädermolnsvägen, med vita hus och flerbostadshus | Mål (nr 1) |

## Miljö att ta med i grafiken

Det som gör Stratusvägen igenkännbar:

- **Radhus med grå, obehandlad träpanel och branta sadeltak** som står i rad med gaveln mot gatan (sågtandssilhuett). Vita fönster, små balkonger med räcken.
- **Plankskärmar och plankförråd** framför varje hus.
- **Svarta brevlådor på stolpe** med husnumret. Det är det naturliga sättet att visa numren i spelet.
- **Farthinder** i form av svarta gummiskenor med gula reflexer. Det är perfekta låga, lätta hinder.
- **Parkerade bilar** på uppfarterna och en **släpvagn**. De kan fungera som plattformar att hoppa upp på.
- Gatlyktor, unga träd i höstfärger, grusrabatter, en innebandymålbur, gungor.
- Vita villor och ett flerbostadshus i bakgrunden.

Halloweenkväll i skymningen:

- Himmel i orange, lila och mörkblått. Gatlyktorna och fönstren tänds.
- Pumpor och lyktgubbar vid dörrarna, spindelnät på plankskärmarna, fladdermöss.
- Barn utklädda för bus eller godis. Godis kan vara mynten.
- Mysigt och lite läskigt, men **inte skräck**. Det är den lättaste banan, så stämningen ska passa alla (till skillnad från 6 · Mardrömmen, 16+).

Namnet är en ordlek. Halloween (31 oktober) och Alla helgons dag är olika dagar, men "alla helgon" låter som en kväll när hela gatan är ute.

## De fyra viktiga husen

Varje hus ska gå att känna igen (brevlåda med rätt nummer och husets egna detaljer från fotot), och något särskilt ska hända vid huset. Beslutade händelser är markerade med **Beslut**, resten är förslag.

| Hus | Läge i banan | Detaljer från foto | Förslag på händelse |
|---|---|---|---|
| **66** | Start | Svart SUV, plankskärm, rabatt (foto 5–6) | **Beslut:** dörren öppnas och en glad kvinna med långt svart hår kastar godis (mynt). Spelaren hoppar eller byter fil för att fånga godiset. Se "Nr 66: godiskastet" nedan. |
| **62** | Tidigt, östra benet | Plankförråd, odlingslådor (foto 8–10) | **Beslut:** en lite yngre, **arg** kvinna med långt blont hår kastar **zucchini** som spelaren måste undvika. Se "Nr 62: zucchinikastet" nedan. |
| **50** | Nordöstra hörnet, strax före halvvägs | Svart VW, litet träd (foto 18) | **Beslut:** en man passar och skjuter **fotbollar** till spelaren. Bollarna fångas för **extra mynt**. Sista huset innan kameraåkningen. Se "Nr 50: fotbollarna" nedan. |
| **15** | Toppen, sista huset på innersidan före nordvästra hörnet, **på andra sidan gatan** | Grå bil, trädäck, gungor (foto 28) | **Beslut:** en **arg** man, betydligt kortare än mannen i 50, kastar **hantlar** på spelaren. Hantlarna måste undvikas. Se "Nr 15: hantlarna" nedan. |

## Husnummer

**Beslut:** Alla hus visar sina nummer, inte bara de fyra viktiga. Numren räknas ner från 66 vid start till 1 vid mål, så man ser hur långt det är kvar.

- Det naturliga stället är de **svarta brevlådorna på stolpe** vid varje uppfart, som på fotona. Numret kan också sitta på fasaden eller plankskärmen.
- I skymningen behöver numren synas. De kan till exempel lysas upp av gatlyktan eller av en lyktgubbe vid brevlådan.
- De fyra viktiga husen (66, 62, 50, 15) får samma sorts nummer men med något extra, så att de sticker ut.

**Numren längs vägen** (från kartbilderna `karta-husnummer-*.png`):
- **Jämna nummer** ligger på hästskons **yttersida**. **Udda nummer** ligger på **innersidan**.
- 66, 62 och 50 är jämna och står på yttersidan. 15 är udda och står på innersidan. Därför behövs kameraåkningen.

| Del av vägen | Yttersidan, jämna (syns **före** kameraåkningen) | Innersidan, udda (syns **efter** kameraåkningen) |
|---|---|---|
| Östra benet, norrut från start | **66**, 64, **62**, 60, 58, 56 | 33, 31, 29, 27, 25 |
| Återvändsgatan österut | 54, 52 (vid sidan av banan) | – |
| Nordöstra hörnet | **50**, 48 | – |
| **Kameraåkningen** i kurvan efter 50 | | |
| Toppen, västerut | 40, 38, 36, 34, 30, 28, 26 | 23, 21, 19, 17, **15** |
| Nordvästra hörnet | 24 | – |
| Västra benet, söderut mot mål | 22, 20, 18, (16), 14, 12, 10, 8, 6, 4, 2 | 13, 11, 9, 7, 5, 3, **1** |

Så här passar det ihop med kameran:
- **Före kameraåkningen** syns yttersidan bakom Vippe: 66 → 48, i fallande ordning.
- **Efter kameraåkningen** syns innersidan: 23 → 1, i fallande ordning. Mål vid nr 1 ligger alltså på den sida som syns.
- Husen på den andra sidan (udda före åkningen, jämna efter) kan visas på brevlådor vid trottoaren i förgrunden, i fillägets perspektiv.
- **Obs:** udda 33–25 ligger på östra benet, före åkningen, men på innersidan. De syns alltså bara i förgrunden, inte i husraden bakom Vippe.

Detaljer från `karta-husnummer-5.png`:
- På toppens yttersida står 40 lite indraget, sedan 38, 36 och 34 i en länga och 30 och 28 i en annan. 26 och 24 står vid nordvästra hörnet.
- Mellan 18 och 14 på västra benet står ett hus utan nummer på kartan. Det är troligen **16**.
- **Beslut:** 32 och 42–46 är villor som inte syns från gatan. De **tas inte med** i banan. Efter 34 kommer alltså 30, och efter 48 kommer 40.

## Kameraåkningen i kurvan efter 50

**Beslut:** I första kurvan efter nr 50 (foto 19–23) gör vi en kameraåkning så att vi "filmar" från andra sidan gatan. Anledningen är att nr 15 ligger på motsatt sida gatan jämfört med 66, 62 och 50. Om det går ska åkningen se ut som 3D.

Så här står kameran:
- Före kurvan står kameran på hästskons innersida och ser yttersidans rad (66 → 48) bakom Vippe.
- Efter kurvan står kameran på yttersidan och ser innersidans rad (23 → 1, bland annat 15) bakom Vippe.

Förslag på hur åkningen går till (ca 3 sekunder, t.ex. 8 taktslag = 32 block):
1. **Från sidan in bakom Vippe:** kameran svänger runt så att vi ser gatan i perspektiv. Vägen löper mot en flyktpunkt, husraderna står på båda sidor och Vippe syns bakifrån springande in i bilden.
2. **Mitt i åkningen:** vi ser båda husraderna samtidigt, med tända lyktgubbar och fönster. Det är ett bra ställe för några godismynt som Vippe samlar automatiskt.
3. **Ut på andra sidan:** kameran fortsätter svänga tills vi står på andra sidan gatan. Nu syns raden med de udda numren i bakgrunden.
- **Inga hinder under åkningen.** Vippe springer själv, så det blir en paus och en belöning, inte en svårighet.

Tekniska anteckningar:
- Spelet ritas med Canvas 2D. Det finns redan en platt spegelvändning (`mirror`-zonen i `js/render.js`, används i Mardrömmen), men den vänder bilden som ett kort och är inte 3D.
- En "3D"-åkning kan göras som en egen perspektivscen som bara ritas under övergången. Vägen blir en trapets mot flyktpunkten. Husfasaderna ritas som snedställda ytor, antingen skivvis eller med `setTransform`. Det liknar det perspektivrutnät som redan finns i schackbanan.
- **Beslut:** Vippe springer **från vänster till höger** hela banan. Bilden spegelvänds aldrig, vi byter bara vilken husrad som syns bakom.

**Går vänster till höger ihop med att 66, 62 och 50 ligger på "fel" sida?** Ja. Så här ser det ut i verkligheten:
- **Efter kameraåkningen stämmer det exakt.** Står man på yttersidan och tittar på innersidans hus, springer Vippe från vänster till höger både längs toppen (västerut) och längs västra benet (söderut).
- **Före kameraåkningen är det spegelvänt.** Står man på innersidan och tittar på 66–48 på östra benet, skulle Vippe egentligen springa från höger till vänster.

Varför spegelvändningen inte märks:
- Husnumren räknas ändå ner i springriktningen (66, 64, 62 …), precis som när man går där.
- Varje fasad ritas **precis som på fotot**, inte spegelvänd. Fotot visar huset rakt framifrån, och det är samma vy som kameran har.
- Det enda som skiljer är att husen står i omvänd ordning i förhållande till hur fasaderna är vända. Det syns bara om man jämför med kartan uppifrån.
- **Tips:** låt hus som hör ihop parvis (gemensam plankskärm eller carport) ritas som två separata hus, så att ingenting ser konstigt ut i omvänd ordning.

Kameraåkningen blir alltså platsen där bilden "blir rätt". Det passar bra ihop med att kameran byter sida.
- **Checkpointen** läggs direkt **efter** åkningen. Då behöver man inte se den igen efter varje krasch, och den hamnar ändå ungefär halvvägs.

## Två filer: undvika hinder i djupled

**Beslut:** Delar av banan visar gatan lite mer i perspektiv, som om kameran står snett ovanför. Gatan har **två filer**: en **nära** fil (lägre och större i bilden) och en **bortre** fil (högre upp och lite mindre). Vissa hinder undviker man genom att byta fil i stället för att hoppa.

Hur det ser ut:
- Vägbanan ritas som ett band med djup och en streckad mittlinje. Husraden står längst bak och trottoaren längst fram.
- Vippe blir lite mindre i den bortre filen och lite större i den nära. Bytet är en kort, mjuk glidning snett över vägen.
- Hinder som bara står i **en fil**, som man byter fil för att undvika:
  - en parkerad bil eller släpvagnen,
  - ett gäng utklädda barn som går bus eller godis,
  - en stor pumpa eller ett sopkärl med spindelnät,
  - en vattenpöl som lyser orange av gatlyktan.
- Hinder över **båda filerna**, som man fortfarande hoppar över: farthindren (de svarta gummiskenorna tvärs över vägen, se foto 7, 21, 27 och 36).
- Godismynt kan ligga i den fil man inte behöver vara i, som en liten lockelse.

Styrning:
- Spelet styrs i dag med **en knapp**: mellanslag, pil upp, W, Enter eller tryck på skärmen. Varje läge ger knappen en egen betydelse: i cykelläget håller man för att flyga, och i innebandyläget vänder ett tryck gravitationen.
- **Beslut:** ett nytt **filläge** där ett tryck byter fil, precis som ett tryck vänder mellan golv och tak i innebandyläget. Då är spelet fortfarande en knapp och fungerar lika bra på mobilen.
  - I filläget hoppar man inte. Farthinder över båda filerna ligger därför bara på sträckorna med vanligt spring.
  - Vi växlar mellan vanligt spring (hoppa) och filläge (byta fil), med tydliga övergångar.
- Bortvalt: både hoppa och byta fil samtidigt (svep eller pilar). Det hade varit svårare, brutit mot enknappsstyrningen och krockat med att pil upp och W redan betyder hopp.

Var i banan (förslag):
- **Starten vid 66:** hinderfri övning där man fångar godis, först med hopp och sedan med ett kort filbyte (se "Nr 66: godiskastet").
- **Första raksträckan fram till 62:** bara vanliga, lätta hopp, så att man kommer in i banan.
- **Mellan 62 och kurvan:** filläge på den raka delen, som introduktion med få och tydliga hinder.
- **Kameraåkningen efter 50** passar ihop med perspektivet, eftersom den ändå visar gatan i djup mitt i åkningen.
- **Toppen efter checkpointen:** filläge igen, till exempel förbi garagelängan och släpvagnen (foto 27), sedan vanligt spring förbi 15.
- **Upploppet (foto 31–38):** en blandning, avslutat med vanligt spring in i mål.

Tekniska anteckningar:
- Det här är ett **nytt läge** i motorn. Fysik och kollision behöver hålla reda på vilken fil Vippe är i, och hinder behöver en fil (nära, bortre eller båda).
- `tools/verify.py` (sökboten) och `tools/map.html` behöver förstå filerna. Annars kan vi inte kontrollera att banan går att klara.
- Filbytet ska vara förlåtande: ett tryck ska räcka, bytet ska gå snabbt och hindren ska synas i god tid (lättaste banan).

## Banan först i listan

Att lägga banan först påverkar mer än listan (från `LEVELS` i `js/level.js`):
- Banan läggs först i `LEVELS`, och alla andras `num` räknas upp ett steg.
- `VD.levelDef` faller tillbaka på `LEVELS[0]`, så en okänd bana ger den nya banan. Siffertangenterna i menyn följer ordningen (1 = den nya banan).
- Förslag på id: `stratus`. Id:t styr topplistan och statistiken, så de andra banornas id ändras inte och deras topplistor finns kvar.
- Svårighetsgrad: lägre än Hem till Storvreta (`difficulty: 1`, "Easy"). Till exempel `difficulty: 0` med namnet "Very Easy", om menyn klarar det.
- README: banlistan och rubrikerna "Level 1…6" behöver numreras om.

## Musik: When the Saints Go Marching In

**Beslut:** Banans musik är en lekfull uptempoversion av **When the Saints Go Marching In**.

- **Rättigheter:** det är en traditionell amerikansk spiritual och är fri att använda (public domain). Det gäller melodin; vi gör vårt eget arrangemang i spelets synth.
- **Namnet passar:** "saints" betyder helgon, så "Stratusvägens alla helgon" och "When the Saints" hör ihop.
- **Tempo:** alla banor går i 156 BPM (4 block per taktslag). Melodin går bra i det tempot om den spelas i fjärdedelar, och den blir då pigg och glad.
- **Format:** melodierna skrivs i `js/audio.js` som strängar med 8 åttondelar per takt och fraser om 4 takter (`MEL`), och varje bana har en låt i `SONGS`. Saints behöver en egen uppsättning fraser: vers, refräng och varianter.

Arrangemangsidéer för halloween:
- Den vanliga versionen i dur, med en studsande "oompa"-bas som en marschorkester.
- **Läskiga instrument:** en kyrkorgel eller en tjutande, theremin-lik stämma, och en xylofon som låter som skramlande skelett.
- En refräng i **moll** som en läskig variant, till exempel under kameraåkningen eller i filläget.
- Stort avslut i dur när man kommer i mål vid nr 1.

## Nr 66: godiskastet

**Beslut:** När Vippe kommer fram till nr 66 öppnas dörren. En **glad kvinna med långt svart hår** står i dörröppningen och kastar godis ut på gatan. Godiset är mynt, och spelaren fångar det genom att **hoppa** eller **byta fil**.

Kvinnans utseende (referensbilder i `ref-66/`, privata och i `.gitignore`):
- Långt, mörkt nästan svart hår, i bilderna uppsatt i en hästsvans. I spelet kan det hänga löst och långt.
- Ljus hy och blågrå ögon.
- Beige, stickad tröja och ett tunt halsband med en liten berlock.
- **Glad**, med ett stort leende. Referensbilderna har neutral min, så leendet läggs till.
- Ritas i samma stil som ansiktena på Vippe och Affelito (se hur `/ny-karaktar` ritar efter referensfoton), fast som en figur vid sidan av banan och inte en spelbar karaktär.

Så här kan det gå till:
- Kvinnan syns i dörren mellan plankskärmen och den svarta SUV:n, med ljus inifrån hallen bakom sig i skymningen. Hon vinkar och kastar med ena armen.
- Godiset flyger i bågar ut över gatan i takt med musiken. En del hamnar **högt** och fångas med ett hopp. En del landar i den **bortre filen** och fångas med ett filbyte.
- Inga hinder här. Det gör inget att missa godis, man får bara färre mynt. Det är alltså en ofarlig start där man övar på båda sätten att röra sig.

**Beslut:** starten blir en hinderfri övningssträcka i tre steg:
1. Vanligt spring, där godis i luften fångas med hopp.
2. En kort stund filläge, där godis i bortre filen fångas med filbyte.
3. Vanligt spring vidare mot 62.

Övrigt:
- Kvinnan är en ny figur som ska ritas i kod, precis som allt annat i spelet. Hon behöver en enkel animation: dörren öppnas, hon vinkar och kastar.

## Nr 62: zucchinikastet

**Beslut:** Vid nr 62 står en **lite yngre kvinna med långt blont hår**. Hon är **arg** och kastar **zucchini** ut på gatan. Zucchinin är hinder som spelaren måste undvika, till skillnad från godiset vid 66.

Kvinnans utseende (referensbild i `ref-62/`, privat och i `.gitignore`; hon är **tredje från vänster**, i klänning):
- Lite yngre än kvinnan i 66. Ljusblont hår, i bilden uppsatt i en knut. I spelet hänger det långt och löst.
- Glasögon med runda, mörka bågar. Ljus hy.
- **Grön- och vitmönstrad klänning med stora blad**, som passar bra ihop med odlingslådorna och zucchinin. En mörkblå midjeväska över axeln och ett mörkt armbandsur.
- **Arg** min: rynkad panna, sänkta ögonbryn och en sur mun. Hon ler i referensbilden, så ilskan läggs till. Arg på ett komiskt sätt, inte läskigt, eftersom det är den lättaste banan.

Så här kan det gå till (förslag):
- Hon står vid **odlingslådorna** framför huset (foto 8–10), där zucchinin rimligen kommer ifrån, och kastar med en arg gest.
- Varje zucchini flyger i en tydlig båge i takt med musiken. En **skugga på marken** visar var den landar, så man hinner reagera.
- Enligt planen går man över från vanligt spring till filläge vid 62. Zucchinin kan därför undvikas på båda sätten:
  - **Före 62, vanligt spring:** zucchinin landar och rullar längs gatan och hoppas över, som ett lågt hinder.
  - **Efter 62, filläge:** zucchinin landar i en fil och man byter till den andra. Det blir en naturlig introduktion till fillägets hinder.
- Kontrasten mot 66 är poängen: där **fångar** man det som kastas, här **undviker** man det. Zucchinin ska se tydligt annorlunda ut än godiset (stor, grön, avlång) så att man inte blandar ihop dem.

## Nr 50: fotbollarna

**Beslut:** Vid nr 50 står en man som **passar och skjuter fotbollar** till spelaren. Bollarna är **bra**: man vill fånga dem, och varje boll ger **extra mynt**, mer än en godisbit.

Mannens utseende (referensbild i `ref-50/`, privat och i `.gitignore`; han är **mannen i svart** i mitten):
- Kort, bakåtstruket askblont hår och lite skäggstubb. Ljus hy.
- **Glad**, med ett brett leende.
- Svart kortärmad skjorta, en mörk väska över axeln, jeansshorts och ett guldfärgat armbandsur.
- I spelet kan han ha en fotboll vid foten och sparka med en tydlig rörelse.

Så här kan det gå till (förslag):
- På en uppfart nära 50 står en liten målbur (en innebandymålbur syns på foto 15–16). Han kan stå vid den, eller använda den som mål.
- Han passar bollarna i takt med musiken. De studsar eller rullar mot Vippe, och Vippe fångar en boll genom att röra vid den.
- Hur man fångar beror på läget:
  - **I filläget** kommer bollarna i en fil, och man byter fil för att ta dem.
  - **I vanligt spring** studsar de högt, och man hoppar för att ta dem.
- Att missa en boll gör ingenting, man får bara färre mynt.
- Fotbollen ska se tydligt annorlunda ut än zucchinin vid 62: rund och svartvit mot avlång och grön. Man ska direkt se vad som ska fångas och vad som ska undvikas.
- Bollarna är det sista som händer på "första sidan". Sedan börjar kameraåkningen. En sista stor skottboll kan till exempel flyga in i bild och följa med kameran runt kurvan.

Sammanfattning av de tre första husen: **66** kastar godis (fånga), **62** kastar zucchini (undvik), **50** passar fotbollar (fånga, extra mynt).

## Nr 15: hantlarna

**Beslut:** Vid nr 15 står en man som är **arg** och **kastar hantlar** på spelaren. Hantlarna är hinder som måste undvikas.

Mannens utseende (referensbilder i `ref-15/`, privata och i `.gitignore`; han är mannen med den tatuerade armen, i röd t-shirt på bild 1 och 4):
- **Betydligt kortare än mannen i 50.** Det ska synas tydligt om man ser båda.
- Snaggat, nästan rakat hår som börjar tunnas, och grånande skäggstubb. Ljus hy.
- Glasögon med runda, mörka bågar (bild 2 och 4). Ibland en svart keps med NY-logga (bild 3 och 4). Välj det ena eller det andra, eller båda, så länge han blir lätt att känna igen.
- **Färgglad tatuering över hela högra armen.** Det är hans mest igenkännbara detalj.
- Röd t-shirt. Bild 2 visar också en grön träningsjacka med vita ränder.
- **Arg** min: rynkad panna och sammanbitna käkar. Arg på ett komiskt sätt, inte läskigt. Han ler på alla bilder, så ilskan läggs till.

Så här kan det gå till (förslag):
- Han står på uppfarten vid trädäcket och brevlådan (foto 28) och kastar hantlar med båda händerna. Det ser tungt ut, vilket är komiskt eftersom han är kort.
- Hantlarna flyger i höga bågar med en **skugga på marken** som visar var de landar. De landar med en tung duns och en liten skakning i bilden, och sedan ligger de kvar.
- Enligt planen är det vanligt spring vid 15, så en hantel på marken hoppas över som ett lågt hinder. Om filläget flyttas hit landar hantlarna i en fil i stället.
- Hantlarna ska se tydligt annorlunda ut än godiset och fotbollarna: grå eller svarta metallvikter med ett handtag.

Mönstret längs gatan blir **fånga, undvik, fånga, undvik**:

| Hus | Vem | Vad | Fånga eller undvika |
|---|---|---|---|
| 66 | Glad kvinna, långt svart hår | Godis | Fånga (mynt) |
| 62 | Arg, yngre kvinna, långt blont hår | Zucchini | Undvik |
| 50 | Glad man i svart | Fotbollar | Fånga (extra mynt) |
| 15 | Arg, kort man med tatuerad arm | Hantlar | Undvik |

## Svårighet och upplägg

- Hoppen ska vara de **lättaste i spelet**: gott om tid mellan hindren och inga snäva hopp. Kontrollera med `python tools/verify.py <bana> --windows` att inga hopp är markerade med `!` eller `!!`.
- Bara **en checkpoint halvvägs**, så varje halva ska vara lätt nog att klara utan fler.
- Hästskoformen kan synas i banan: rak sträcka, böj med kameraåkning och rak sträcka tillbaka. Checkpointen ligger direkt efter kameraåkningen.

## Öppna frågor


Inga öppna frågor just nu. Alla fyra husen, musiken, längden, platsen i listan och styrningen är bestämda.
