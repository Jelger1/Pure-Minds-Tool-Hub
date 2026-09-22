# Pure Minds Generator Hub

Interne tools van Pure Minds op één plek: social posts, documenten op
briefpapier en presentaties, allemaal in de huisstijl en direct te downloaden.
Daarnaast drie technische tools voor websites, ads en SEO; zie
[Techniek & analyse](#techniek--analyse).
Plain HTML, CSS en JavaScript: geen framework, geen buildstap.

**Live:** https://jelger1.github.io/Pure-Minds-Tool-Hub/

| Tool | Wat | Export |
|---|---|---|
| [Insta Post Maker](tools/insta.html) | Instagram- en LinkedIn-posts in vijf templates | PNG, JPG, bewerkbare PDF (carousel voor LinkedIn) |
| [Document Maker](tools/document.html) | Brief, offerte, memo of notitie op A4-briefpapier | bewerkbare PDF, Word (.docx, ook voor Google Docs), afdrukken |
| [Presentation Maker](tools/presentation.html) | 16:9-slides in zeven layouts, waaronder een tabel | bewerkbare PDF, PowerPoint (.pptx, ook voor Google Slides), PNG (Full HD of 4K) |

Alle PDF's zijn **vector**: echte tekst in ingesloten Open Sans (te selecteren
en aan te passen in Acrobat of Illustrator), vormen en het logo als vector.
Alleen foto's en een geüploade handtekening zijn afbeeldingen.

Word- en PowerPoint-bestanden zijn **echt bewerkbaar** in dezelfde huisstijl:
het briefpapier als Word-opmaak (kop, voet, koppen, zeshoek-bullets, tabellen),
de slides als tekstvakken, vormen en foto's op een Pure Minds-master. Zie
[Word, PowerPoint en Google](#word-powerpoint-en-google).

## Starten

```bash
npm start            # http://localhost:3000
```

GitHub Pages serveert de map zoals hij is. Een tool direct vanaf schijf
openen werkt ook: de logo's en lettertypen die in exports komen, staan dan als
ingebedde kopie in `js/shared/brand-data.js` en `js/shared/pdf-fonts.js`,
zodat de browser de export niet blokkeert.

## Structuur

```
index.html                    de hub: begin direct, verder werken, alle tools per blok,
                              en de uitleg bij de Consent Check (<dialog>)
tools/
  insta.html                  Insta Post Maker
  document.html               Document Maker
  presentation.html           Presentation Maker
css/
  global.css                  gedeeld designsysteem (kleuren, Open Sans, kaarten,
                              knoppen, velden, kop met toolwisselaar)
  hub.css                     dashboard
  insta.css                   Insta Post Maker
  document.css                Document Maker + het A4-briefpapier
  presentation.css            Presentation Maker
js/
  shared/tools.js             register van alle tools (hub + toolwisselaar)
  shared/core.js              gedeelde hulpfuncties (window.PM)
  shared/canvas-kit.js        tekenbouwstenen voor posts en slides (window.PMCanvas)
  shared/pdf-canvas.js        canvas dat in een PDF tekent: posts en slides als vector
  shared/pptx-writer.js       schrijft een .pptx (Office Open XML) zonder bibliotheek
  shared/brand-data.js        ingebedde logo's (gegenereerd: npm run brand)
  shared/pdf-fonts.js         Open Sans voor PDF en Word (gegenereerd, pas geladen bij export)
  hub.js                      dashboard: snelle starts, concepten, toolkaarten per blok
                              met filter, en de uitleg bij lokale tools
  insta/templates.js, app.js
  document/app.js             editor, blokken en paginering
  document/pdf.js             A4-pagina's uit de preview als vector-PDF
  document/docx.js            het document als Word-bestand
  presentation/templates.js   zeven layouts: plan (maten, regelval) en tekenen
  presentation/pptx.js        de slides als PowerPoint-bestand
  presentation/app.js
assets/brand/                 Open Sans, logo's, favicon, brandbook
scripts/build-brand-data.js   maakt brand-data.js en pdf-fonts.js
server/server.js              kleine statische server (npm start, Render)
```

## Een tool toevoegen

1. Maak `tools/<naam>.html`. Kopieer de `<head>`, de cyaan balk en de
   `<header>` van een bestaande tool, en zet `data-toolnav="<naam>"` op de
   `<nav>`. Laad `../css/global.css` en je eigen `../css/<naam>.css`.
2. Laad onderaan `../js/shared/tools.js` en `../js/shared/core.js`; voor
   canvas-output ook `../js/shared/canvas-kit.js`.
3. Zet de tool in `js/shared/tools.js`. De hub en de toolwisselaar in elke
   kop pakken hem dan vanzelf op. Met `status: 'binnenkort'` staat hij als
   niet-klikbare kaart in de hub.
4. Optioneel: `starts` geeft tegels onder *Begin direct* (de tool leest de
   meegegeven instellingen met `PM.startParams()`), en `draft` laat het
   concept van de tool zien onder *Verder werken*.
5. Draait de tool buiten de hub (een web-app elders, of een download)? Geef
   hem dan `kind: 'web'` of `kind: 'lokaal'`, `href` naar de app of de
   download, en `group: 'techniek'`. Hij staat dan alleen op het dashboard,
   niet in de toolwisselaar van de andere tools. Een lokale tool krijgt met
   `guide` de id van een `<dialog class="guide">` in `index.html` met de
   uitleg; tabjes, kopiëren en de downloadknop regelt `js/hub.js`. Een nieuw
   blok is een regel in `PM_GROUPS` (`tone: 'dark'` geeft het donkere vlak).

## Gedeelde huisstijl

Alle kleuren komen uit het brandbook (`assets/brand/PureMinds-Brandbook-v1.svg`):
Pure Cyaan `#1AB9E2` voor accenten, Pure Magenta `#B61B50` alleen voor de
hoofdactie, Inkt `#303030` voor tekst en donkere vlakken. Typografie is
Open Sans (lokaal in `assets/brand/fonts/`). Knoppen hebben rechte hoeken en
kleine letters; koppen krijgen de cyaan punt uit "Pure Minds.".

Posts en slides delen `js/shared/canvas-kit.js`, en dus hetzelfde:
zeshoek (puntig, zoals het logo), zeshoekpatroon, label met zeshoek-bullet,
`**nadruk**` in cyaan, voetregel `pureminds.nl` en het witte logo rechtsonder.

## Gedeelde interactie

De tools voelen hetzelfde aan, omdat ze dezelfde bouwstenen uit
`js/shared/core.js` en `css/global.css` gebruiken:

- **Downloadknoppen** (`PM.run`): de knop zelf toont wat er gebeurt ("slide 3
  van 8…"), daarna kort "✓ gedownload". Ondertussen kun je niet dubbelklikken.
- **Ongedaan maken** (`PM.toast` met `{ label, run }`): verwijderen en
  opnieuw beginnen gebeurt direct, de melding biedt 8 seconden
  *ongedaan maken* in plaats van een "weet je het zeker?"-vraag.
- **Nadruk** (`PM.textTools`): knoppen *cyaan* en *vet* naast een veld zetten
  de selectie, of het woord onder de cursor, tussen `**...**`. Halve woorden
  worden aangevuld tot hele.
- **Mini-preview** (`PM.miniPreview`): op mobiel zweeft een kleine live
  versie in beeld zodra de echte preview uit beeld is; tikken brengt je terug.
- **Per apparaat:** tips over slepen en sneltoetsen hebben de klasse
  `for-mouse`, de tik-variant `for-touch`; op een touchscreen verschijnt
  alleen wat daar werkt. De preview blokkeert het scrollen op mobiel alleen
  als er een foto te verschuiven is.

## Insta Post Maker

Vijf templates: standaard foto, foto met tekst, Pure Blog, Pure Case en een
informatieve carousel met swipe-indicator (de laatste slide krijgt vanzelf
pureminds.nl). Formaten 1:1, 4:5 en 9:16 (story), gekozen direct onder het
template; de miniaturen tonen het gekozen formaat. Alle posts zijn donker.

- **Volgorde:** template en formaat, foto, tekst (belangrijkste veld eerst,
  het label als laatste), details.
- **Foto:** klik op de lege fotoplek in de preview, sleep of plak. Zoomen,
  centreren, en verschuiven door te slepen of met de pijltjestoetsen. Foto en
  klantlogo worden bewaard (IndexedDB), ook na herladen.
- **Tekst:** selecteer woorden en klik op *cyaan* (of *vet* in een carousel)
  in plaats van `**...**` te typen; *+ klant*, *+ diensten* en *+ onderwerp*
  zetten de invulplek op de cursor.
- **Export:** kies *voor* Instagram (1080 px), LinkedIn (1200 px) of extra
  scherp (2160 px), en PNG of JPG. Eén hoofdknop: een post als afbeelding,
  een carousel voor Instagram als zip met alle slides, voor LinkedIn als PDF.
  De knop toont de voortgang en daarna "✓ gedownload".
- **Mobiel:** staat de preview uit beeld, dan zweeft rechtsboven een kleine
  live versie; tikken brengt je terug naar de preview en de downloadknop.

| Formaat | 1080 px (Instagram) | 1200 px (LinkedIn) | 2160 px |
|---|---|---|---|
| 1:1 | 1080 × 1080 | 1200 × 1200 | 2160 × 2160 |
| 4:5 | 1080 × 1350 | 1200 × 1500 | 2160 × 2700 |
| 9:16 (story) | 1080 × 1920 | 1200 × 2133 | 2160 × 3840 |

## Document Maker

- **Soorten:** brief (adres, kenmerk, aanhef), offerte (klant, nummer, geldig
  tot, offerteregels met btw en een "voor akkoord"-blok), memo (aan, van, cc)
  en notitie.
- **Volgorde:** eerst het onderwerp, dan aan wie (adres, kenmerk of
  offertegegevens) en de aanhef; datum en label staan als laatste.
- **Klik in de preview:** een klik op de titel, het adres, de aanhef, de
  tekst, de offerteregels, het akkoordblok, de handtekening of de voet
  springt naar het veld dat erbij hoort.
- **Tekst:** editor met koppen, lijsten, vet, cursief, onderstreept en citaat.
  Plakken uit Word of Google Docs mag; alleen die opmaak blijft over.
- **Offerteregels:** plakken uit Excel of Google Sheets vult de regels
  (omschrijving, aantal, prijs, of omschrijving en prijs). Bedragen als
  "€ 1.250,50" worden goed gelezen. Enter springt naar de volgende regel of
  maakt een nieuwe.
- **Briefpapier:** bedrijfsgegevens vul je één keer in onder *Briefpapier*;
  lege velden worden weggelaten. Zolang adres, KvK en e-mail leeg zijn, vraagt
  een melding bovenaan erom (*later* verbergt hem).
- **Pagina's:** tekst loopt vanzelf door naar een volgende pagina. Alinea's
  en lijsten worden op woorden gesplitst, de offertetabel op regels, en een
  kop gaat mee met de tekst eronder. Staan er op de laatste pagina maar een
  paar regels, dan zegt de tool hoe het op een pagina minder past.
- **Handtekening:** een tegel met voorbeeld; klik of sleep een afbeelding.
- **Nieuw document** begint direct opnieuw, met *ongedaan maken* in de melding.
- **Logo:** het zwarte zeshoek-logo (vector), net als op de posts en slides.
- **PDF:** `js/document/pdf.js` bouwt elke pagina opnieuw op in jsPDF, op de
  posities die de browser in de preview heeft berekend: tekst per regel als
  echte tekst, vlakken en lijnen als vector, logo en zeshoeken via svg2pdf.
  Dezelfde lettertypebestanden in preview en PDF, dus alles staat op zijn plek.
- **Word:** `js/document/docx.js` bouwt het briefpapier na als Word-opmaak
  (bibliotheek docx): kop met logo en afzender, vervolgkop met de titel, voet
  met "pagina X van Y" als veld, koppen, zeshoek-bullets, genummerde lijsten,
  citaten, de offertetabel en het akkoordblok als tabellen, en de
  handtekening als afbeelding. Open Sans (regular, semibold, extrabold) zit
  in het bestand, zodat het ook klopt zonder dat lettertype.

## Presentation Maker

- **Layouts:** titelslide, sectie (automatisch genummerd), opsomming,
  beeld + tekst (foto links of rechts), citaat of kerncijfer, tabel, afsluiter.
  De keuze staat ingeklapt (de huidige layout met *andere layout*) en gaat
  vanzelf open bij *+ slide*.
- **Slides:** de strook onder de preview. Klik om te kiezen, sleep om de
  volgorde te veranderen; eronder *+ slide*, `←` `→` (verplaatsen),
  *dupliceer* en *verwijder*. Verwijderen kan ongedaan worden gemaakt, foto
  inbegrepen.
- **Tekst:** knoppen *cyaan* (titel, citaat) en *vet* of *cyaan* (tekst)
  zetten de nadruk; het label staat als laatste en is optioneel.
- **Tabel:** tot 14 rijen en 8 kolommen, te bewerken in een raster (Tab en
  Enter springen door de cellen, plakken uit Excel of Google Sheets vult de
  tabel vanaf de gekozen cel). Kopregel en vette eerste kolom zijn aan/uit te
  zetten, `**woord**` wordt cyaan. Kolommen met alleen getallen of bedragen
  lijnen rechts uit. Korps en kolombreedtes schalen mee met de hoeveelheid
  inhoud (een lange titel mag daarvoor iets kleiner). In PowerPoint en Google
  Slides is het een echte tabel met vaste kleuren, dus rijen toevoegen en
  tekst aanpassen kan daar gewoon.
- **Foto's:** in de titelslide en afsluiter in een zeshoek. Heeft een layout
  nog geen foto, dan staat *foto toevoegen* boven de preview; bij beeld + tekst
  is de lege fotoplek zelf klikbaar. Zoomen en centreren in het formulier,
  verschuiven door in de preview te slepen of met de pijltjestoetsen. Foto's
  worden per slide in de browser bewaard (IndexedDB).
- **Export:** PDF met één pagina per slide (960 × 540 pt, zoals PowerPoint),
  als vector met echte tekst, als hoofdactie; daarnaast PowerPoint, en *als
  afbeelding* deze slide of alle slides (zip) in Full HD of 4K. `←` en `→`
  bladeren, `Ctrl` + `S` downloadt de PDF.
- **PowerPoint:** `js/presentation/pptx.js` zet elke slide om in tekstvakken,
  vormen en foto's op precies de plek van de preview, met dezelfde
  korpsgrootte en regelval (het "plan" uit `templates.js`). Tekstvakken
  krimpen bij te veel tekst, net als in de tool. Foto's zijn de vulling van
  een zeshoek of een bijgesneden afbeelding met dezelfde uitsnede. De
  achtergrond, cyaan balk, logo en voetregel staan op een Pure Minds-master:
  een nieuwe slide in PowerPoint krijgt ze vanzelf. Het slidenummer is een
  veld en telt mee bij verschuiven of toevoegen.

## Techniek & analyse

Drie tools die buiten de hub draaien, in een eigen donker blok op het
dashboard. Boven *Alle tools* staat een filter: alles, alleen design &
content, of alleen techniek & analyse. De keuze staat in het adres, dus
`index.html#techniek` opent meteen de technische tools (handig als
bladwijzer).

| Tool | Wat | Draait |
|---|---|---|
| [Consent Check](https://github.com/Jelger1/consent-check) | Meet per website welke cookies en trackers er vóór en ná het cookie-akkoord laden | lokaal: downloaden (zip) en starten op je eigen Mac of Windows-pc |
| [Landingpage & Ads Optimizer](https://landingpage-ads-optimizer-qr13.vercel.app/) | Checkt of Google Ads-advertentie en landingspagina op elkaar aansluiten, met een CRO-briefing | web-app, opent in een nieuw tabblad |
| [SEO Content Gap Analyzer](https://seo-content-gap-analyzer-1yxm.vercel.app/) | Zet een pagina naast de Google-top 10: ontbrekende koppen, termen en vragen | web-app, opent in een nieuw tabblad |

- **Kaarten:** een lichte "blauwdruk"-omslag met een lijntekening (de makers
  hebben een donkere omslag), en rechtsboven waar de tool draait: *web-app*
  of *lokaal*. Een web-app opent in een nieuw tabblad; de pijl op de knop
  wijst daarom schuin omhoog.
- **Consent Check:** twee knoppen op de kaart, *download* (de zip van GitHub)
  en *hoe werkt dit?*. Na het downloaden wijst een melding de weg naar de
  uitleg.
- **Uitleg** (`<dialog id="guide-consent">` in `index.html`): een paneel van
  rechts met een tabje voor Mac en voor Windows; het tabje van je eigen
  computer staat al open. De Mac-tekst is letterlijk die van de maker van de
  tool. Windows gebruikt de Opdrachtprompt en `start.cmd` uit de repo: via
  de Opdrachtprompt geeft Windows geen melding over een bestand van internet
  (dubbelklikken kan dat wel), en in PowerShell zou je `.\start.cmd` moeten
  typen. Opdrachten zijn te kopiëren, stap 1 heeft zelf een downloadknop, en
  *Lukt het niet?* vangt de vier meest voorkomende problemen op.

## Bewerkbare PDF's

Posts en slides worden getekend met canvas-opdrachten. Voor de PDF krijgt
dezelfde renderfunctie `PMPdfCanvas` (`js/shared/pdf-canvas.js`) in plaats van
een echt canvas: tekst wordt echte tekst (woorden op een regel samengevoegd),
paden worden vectorvormen, het logo komt als SVG, alleen foto's blijven
afbeeldingen. Transparante verlopen (de gloed, de donkere verlopen over
foto's) worden benaderd met smalle banen of ringen, omdat PDF die niet kent.

## Word, PowerPoint en Google

- **Word en PowerPoint** openen de .docx en .pptx direct. Op een computer
  zonder Open Sans vervangt PowerPoint het lettertype; installeer dan de
  bestanden uit `assets/brand/fonts/` (Word heeft ze al in het bestand).
- **Google Docs en Google Slides:** upload het Word- of PowerPoint-bestand in
  Google Drive, open het, en kies *Bestand → Opslaan als Google Documenten*
  (of *Google Presentaties*). Google heeft Open Sans standaard, dus de
  opmaak blijft staan. Een knop die het bestand rechtstreeks in Drive zet is
  mogelijk, maar vraagt een OAuth-koppeling met de Google Workspace.
- **Wat anders is dan de PDF:** het slidenummer in PowerPoint toont "3" in
  plaats van "03 / 06" (PowerPoint kent geen veld voor het totaal), en Word
  toont ook op een document van één pagina "pagina 1 van 1".
- **Zeshoek-bullets** zijn het teken ⬢ in Segoe UI Symbol (Windows), zodat
  een opsomming een opsomming blijft; op andere systemen kiest het programma
  een vergelijkbaar lettertype.
- De .pptx wordt zonder bibliotheek geschreven (`js/shared/pptx-writer.js`):
  master met achtergrond, tekstvakken met alinea-opmaak, zeshoeken als eigen
  vorm (ook met foto-vulling), verlopen, en het slidenummer als veld.

## Export-bibliotheken

jsPDF 4.2.1, svg2pdf.js 2.8.1, docx 9.7.1 (Word) en JSZip 3.10.1
(PowerPoint) komen van jsDelivr, met een vaste versie en SRI-hash
(`js/shared/core.js`). Ze worden pas geladen bij de eerste export, dus
bewerken werkt ook zonder internet.

## Opslag

Teksten en instellingen staan in `localStorage`, afbeeldingen (handtekening,
slidefoto's) in IndexedDB, allebei alleen in de eigen browser. Foto's en het
klantlogo van de Insta Post Maker worden ook bewaard.

Vervang je een logo in `assets/brand/`, draai dan `npm run brand`.
