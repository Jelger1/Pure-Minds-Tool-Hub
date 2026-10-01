# Overdracht: Brand Styleguide afmaken (branch `brand-styleguide`)

Deze map (`wip/`) is werkmateriaal voor de cloud-agent. Haal hem weg in de laatste commit, vóór de pull request klaar is: hij hoort niet in `main`.

## Wat de tool is

Een vijfde maker in de Pure Minds Tool Hub: de **Brand Styleguide** (`tools/styleguide.html`, `js/styleguide/*`, `css/styleguide.css`). Het brandbook (huisstijl) digitaal en interactief, met een export naar een bewerkbare vector-PDF voor Canva en Illustrator.

- **Het contract**: `wip/bouwplan-styleguide.html`. Dit is het goedgekeurde bouwplan (een HTML-pagina; de inhoud is de spec): interface, alle brandbook-teksten, exportstrategie en tests.
- **Bron**: `assets/PureMinds-Brandbook-v2.0.pdf`, de huidige 8 pagina's.

## Besluiten van de gebruiker (vast)

- **Lettertype**: Pure Minds Sans (`assets/fonts/`), als eigen webfont. In PDF's per gewicht een eigen PostScript-naam (`PureMindsSans-*`).
- **Logo**:
  - clear space = ¼ van de logobreedte;
  - minimum = 80 px digitaal, 20 mm in print.
- **Medium 500** vervalt: er is geen fontbestand voor.
- **Lagen**: een PDF met lagen (Optional Content Groups) en losse objecten is genoeg. Geen aparte SVG-export voor Illustrator.
- **Export**: wel een logo-pakket (zip met SVG en PNG van het witte en het inktkleurige logo) en kleurbestanden (ASE en JSON).
- **Bedrijfsnaam**: altijd "Pure Minds Marketing Group" met hoofdletters.
- **Missie**: houdt "on-aangetapt". Niet "verbeteren".
- **Slogan**: "We mind your business, for your peace of mind."
- **Kleuren en vormen**:
  - alleen effen huiskleuren (cyaan #1ab9e2, inkt #303030, magenta #b61b50, wit);
  - geen verloop op zeshoeken;
  - geen rand om witte vormen;
  - nooit #1b71a8 als vlak van een zeshoek;
  - magenta alleen voor de hoofdactie.
- **Schrijfwijze**:
  - knoppen en labels in kleine letters;
  - koppen met een hoofdletter en een cyaan punt.
- **Stack**: vanilla HTML, CSS en JS. Geen framework, geen buildstap, geen npm-dependencies. Tests met `node --test tests/*.test.js`.

## Stand bij de overdracht (1 oktober, 17:10)

Gebouwd door een lokale agent die tijdens de controle is gestopt omdat de laptop dicht ging:

- **Alle bestanden** staan er, zo'n 4.000 regels:
  - `tools/styleguide.html`;
  - `js/styleguide/` met brand-tokens, content, model, pages, app, export, help en svg-path;
  - `css/styleguide.css`;
  - `tests/styleguide.test.js`.
- **Hub**:
  - een regel in `js/shared/tools.js` (id `styleguide`);
  - een noscript-link in `index.html`;
  - een README-sectie.
- **Gedeelde code**, alleen aanvullingen:
  - `js/shared/core.js`: pdf-lib in `LIBS`, met vaste versie en SRI;
  - `js/shared/pdf-canvas.js`: markeringen voor lagen;
  - `scripts/build-brand-data.js` en `js/shared/pdf-fonts.js`: Light-snede als laatste toegevoegd, zodat de andere PDF's gelijk blijven.
- **Tests**: alle 277 groen (26 nieuw voor de styleguide).
- **Pagina laadt** zonder console-fouten:
  - 17 pagina's A4 liggend;
  - rail Merk, Logo, Kleur, Type, Beeld, Iconen, Gebruik;
  - paneel met kopieerknoppen;
  - rondleiding van 7 stappen;
  - zoekveld;
  - splitknop "exporteer brandbook".
- **Al gecontroleerd**: de PDF's van de Presentation Maker en de Insta Post Maker zijn byte-gelijk aan vóór de wijziging, op datum en ID na.
- **Nog niet gecontroleerd**: dezelfde vergelijking voor de Document Maker.

## Wat er nog moet gebeuren

1. **Doorlopen tegen het bouwplan.** Ontbrekende onderdelen afmaken. Lever geen half werk op: liever één onderdeel minder, goed afgemaakt, en dat melden.
2. **Controleren in een echte browser** (headless Chromium; zie `wip/harness/README.md`, met `CHROME=/pad/naar/chromium`, `CHROME_NO_SANDBOX=1` in een container en `--root` op de repo):
   - Geen console-fouten op `tools/styleguide.html`.
   - Schermen op 1600×1000, 1024×768 en 390×844. Op een telefoon wordt de rail een tabbalk en het paneel een blad van onderen, zoals in de andere makers.
   - Elke pagina op het podium bekijken (sheet.py maakt een contactsheet), en elke functie in het paneel proberen:
     - kopiëren;
     - logo-downloads;
     - clear-space-overlay;
     - contrastchecker;
     - 60/30/10;
     - zoeken.
   - De rondleiding stap voor stap. Elk doel moet bestaan.
3. **De exports**, via de knoppen (downloads via CDP `Browser.setDownloadBehavior`):
   - PDF compleet en PDF per hoofdstuk. Controleer met Python en PyMuPDF (`pip install pymupdf`):
     - het aantal pagina's;
     - alleen fonts met de naam `PureMindsSans-*`;
     - de tekst is uit te lezen en gelijk aan de content;
     - geen plaatjes waar vectoren horen (logo en iconen zijn paden);
     - geen clip-paden rond vectoren;
     - geen verlopen;
     - kleuren exact gelijk aan de tokens;
     - minder dan 1.400 elementen per bestand (de Canva-limiet);
     - lagen aanwezig (`doc.get_ocgs()` / `get_layers()`).
   - Render de PDF-pagina's naar PNG en vergelijk ze met het podium.
   - Logo-pakket (zip) en de kleurbestanden ASE en JSON: geldig en volledig.
   - De andere makers zijn ongewijzigd:
     - de volledige testsuite is groen;
     - Insta, Document, Presentatie, Icon Finder en de hub laden zonder fouten;
     - de PDF van de Document Maker is gelijk aan die van `main` (dat stond nog open).
4. **Netjes afronden**:
   - README bijgewerkt;
   - hulpteksten van hoogstens 40 woorden;
   - tourstappen van hoogstens 35 woorden en titels van hoogstens 5 woorden;
   - Nederlandse UI-tekst, kort en direct, in de stijl van de andere makers.
5. **De map `wip/` verwijderen.** Commit met co-auteursregel, push de branch en open een pull request naar `main` met een duidelijke samenvatting. In die samenvatting staat wat er is gebouwd, wat er gecontroleerd is (met uitkomsten), en wat de gebruiker zelf nog moet doen: één keer de PDF in Canva slepen en één keer openen in Illustrator. **Niet zelf mergen**: de gebruiker keurt goed.
