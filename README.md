# Pure Minds Generator Hub

Interne tools van Pure Minds op één plek: social posts, documenten op
briefpapier, presentaties en iconen, allemaal in de huisstijl en direct te
downloaden.
Daarnaast drie technische tools voor websites, ads en SEO; zie
[Techniek & analyse](#techniek--analyse).
Plain HTML, CSS en JavaScript: geen framework, geen buildstap.

**Live:** https://jelger1.github.io/Pure-Minds-Tool-Hub/

| Tool | Wat | Export |
|---|---|---|
| [Insta Post Maker](tools/insta.html) | Instagram- en LinkedIn-posts in vijf templates | PNG, JPG, PDF om verder te bewerken in Canva (elke post; een carousel als één PDF met een pagina per slide) |
| [Document Maker](tools/document.html) | Brief, offerte, memo of notitie op A4-briefpapier | bewerkbare PDF, Word (.docx, ook voor Google Docs), afdrukken |
| [Presentation Maker](tools/presentation.html) | 16:9-slides in zeven layouts, waaronder een tabel | bewerkbare PDF, PowerPoint (.pptx, ook voor Google Slides), PNG (Full HD of 4K) |
| [Icon Finder](tools/icons.html) | Ruim 3.200 iconen zoeken in het Nederlands of Engels, los of in de zeshoek, in de merkkleuren | SVG, PNG (128 tot 2048 px), kopiëren om te plakken |

Alle PDF's hebben **echte tekst** in ingesloten Open Sans, met per gewicht een
eigen fontnaam (te selecteren en aan te passen in Canva, Acrobat of
Illustrator), en vormen en het logo als vector. Foto's en een geüploade
handtekening zijn afbeeldingen; in posts en slides ook elk verloop (één
transparante PNG). De PDF's van posts en slides importeert Canva laag voor
laag, zie [Bewerkbare PDF's](#bewerkbare-pdfs).

Word- en PowerPoint-bestanden zijn **echt bewerkbaar** in dezelfde huisstijl:
het briefpapier als Word-opmaak (kop, voet, koppen, zeshoek-bullets, tabellen),
de slides als tekstvakken, vormen en foto's op een Pure Minds-master. Zie
[Word, PowerPoint en Google](#word-powerpoint-en-google).

## Starten

```bash
npm start            # http://localhost:3000
npm test             # unittests (node --test, zonder dependencies)
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
  icons.html                  Icon Finder
css/
  global.css                  gedeeld designsysteem (kleuren, Open Sans, kaarten,
                              knoppen, velden, kop met toolwisselaar)
  editor.css                  editor-bouwstenen: appbalk, rail, paneel, podium,
                              werkbalk, [?]-uitleg, rondleiding, sneltoetsen
  hub.css                     dashboard
  insta.css                   Insta Post Maker
  document.css                Document Maker + het A4-briefpapier
  presentation.css            Presentation Maker
  icons.css                   Icon Finder
js/
  shared/tools.js             register van alle tools (hub + toolwisselaar)
  shared/core.js              gedeelde hulpfuncties (window.PM)
  shared/brand.js             huisstijl als gegevens, plus controles (PM.brand)
  shared/history.js           ongedaan maken en opnieuw (PM.history)
  shared/shell.js             indeling zoals Canva: rail, één paneel, podium (PM.shell)
  shared/help.js              [?]-uitleg naast instellingen (PM.help)
  shared/toolbar.js           tekstwerkbalk zoals Word (PM.toolbar)
  shared/tour.js              rondleiding: leren door te doen (PM.tour)
  shared/richfield.js         tekstvelden met nadruk en invulplekken zoals ze zijn (PM.richfield)
  shared/canvas-kit.js        tekenbouwstenen voor posts en slides (window.PMCanvas)
  shared/pdf-canvas.js        canvas dat in een PDF tekent: posts en slides als losse lagen (Canva)
  shared/pptx-writer.js       schrijft een .pptx (Office Open XML) zonder bibliotheek
  shared/brand-data.js        ingebedde logo's (gegenereerd: npm run brand)
  shared/pdf-fonts.js         Open Sans voor PDF en Word (gegenereerd, pas geladen bij export)
  hub.js                      dashboard: snelle starts, concepten, toolkaarten per blok
                              met filter, en de uitleg bij lokale tools
  insta/templates.js, app.js
  insta/export.js             wat een download oplevert (PNG, JPG, zip of PDF), de zin en de uitleg erbij
  insta/pdf.js                de PDF van een post of carousel (PMInstaPdf.build)
  insta/help.js               [?]-uitleg, rondleiding en sneltoetsen (PM_HELP.insta)
  document/app.js             editor, blokken en paginering
  document/model.js           bedragen, totalen en de controle op voorbeeldtekst (zonder DOM)
  document/help.js            [?]-uitleg, rondleiding en sneltoetsen (PM_HELP.document)
  document/pdf.js             A4-pagina's uit de preview als vector-PDF
  document/docx.js            het document als Word-bestand
  presentation/templates.js   zeven layouts: plan (maten, regelval), tekenen, regio's
  presentation/deck.js        voorbeeldslides, velden per layout en de controle op voorbeeldtekst (zonder DOM)
  presentation/help.js        [?]-uitleg, rondleiding en sneltoetsen (PM_HELP.presentation)
  presentation/pptx.js        de slides als PowerPoint-bestand
  presentation/app.js         editor, strook met slides, foto's en export
  icons/icon-data.js          alle iconen als pad (gegenereerd: npm run icons)
  icons/icon-tags.js          Nederlandse en Engelse zoekwoorden per icoon (gegenereerd)
  icons/hex.js                de zeshoek om een icoon, gelijk aan maak-zeshoeken.py
  icons/search.js             zoeken met rangschikking, meervouden en typfouten
  icons/app.js                Icon Finder
assets/brand/                 Open Sans, logo's, favicon, brandbook
  emerce/                     Emerce 100-badge 2026, strak uitgesneden (posts, documenten)
assets/icons/                 Remix-iconen per categorie (bron voor de Icon Finder), met LICENSE
  maak-zeshoeken.py           maakt Zeshoek/<Blauw|Donker|Wit>/ en overzicht.html
scripts/build-brand-data.js   maakt brand-data.js en pdf-fonts.js
scripts/build-icon-data.js    maakt js/icons/icon-data.js uit assets/icons/
scripts/build-icon-tags.js    maakt js/icons/icon-tags.js uit scripts/icon-words/
scripts/icon-words/           nl.json (Nederlands woordenboek), remix-tags.json
server/server.js              kleine statische server (npm start, Render)
tests/                        unittests van de editor-bouwstenen, de Insta Post Maker, de Document Maker,
                              de Presentation Maker en de PDF-export (npm test)
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
   concept van de tool zien onder *Verder werken*. Heeft de tool een
   rondleiding (`js/<id>/help.js`), zet dan `tour: 'je eerste …'`.
   - De hub toont dan een knop onder *Nieuw hier?*. Die opent
     `tools/<id>.html#rondleiding`, en de rondleiding start direct.
   - Het blok verdwijnt als alle rondleidingen gedaan zijn.
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
`**nadruk**` in cyaan en het witte logo rechtsonder. De voetregel
`pureminds.nl` linksonder staat alleen op slides, niet op posts.

**Emerce 100-badge.** Pure Minds staat in de Emerce 100 van 2026 (beste
e-business bedrijven, gepubliceerd 21 april 2026). Op posts en documenten
kan de badge erbij, als klein keurmerk:

- **Aanzetten:** met het knopje *Emerce 100* (met het merkje erin) in de kop
  van de preview, direct naast wat het verandert. Het staat standaard uit en
  blijft aan tot je het weer uitzet. Na aanzetten zegt een melding waar de
  badge staat.
- **Bestanden:** de originelen van Emerce (`Badge-E100-2026-*.svg`, een
  A4-vel met de badge in het midden) staan niet in de repo. De tools gebruiken
  strak uitgesneden kopieën zonder `<style>` uit `assets/brand/emerce/`:

  | Bestand | Vorm | Kleur |
  |---|---|---|
  | `e100-2026-liggend-wit.svg` | liggend | wit, voor donkere posts |
  | `e100-2026-liggend-zwart.svg` | liggend | zwart, voor het briefpapier |
  | `e100-2026-staand-*.svg` | staand | voor gebruik buiten de tools |

  De liggende versies zitten ook in `brand-data.js`, voor export vanaf schijf.

## Gedeelde interactie

De makers (posts, documenten, presentaties) voelen hetzelfde aan, omdat ze
dezelfde bouwstenen gebruiken; hoe je ze inbouwt staat onder
[Editor-bouwstenen](#editor-bouwstenen).

- **Indeling** (`PM.shell`): een rail met grote knoppen, één paneel tegelijk
  en het ontwerp op het podium; op mobiel een tabbalk onderin en het paneel
  als blad. Klik in het ontwerp en je staat in het goede veld. Hoort een
  onderdeel niet bij je keuze, dan staat het uit met de reden erbij.
- **Tekst** (`PM.richfield`, `PM.toolbar`): nadruk en invulplekken staan in
  het veld zoals ze bedoeld zijn, niet als `**...**` of `{klant}`. De
  werkbalk boven het ontwerp (op mobiel bovenin het blad) toont alleen wat bij
  dat veld mag: cyaan of vet, invulplekken, de grootte uit de typeschaal, en in
  een document koppen en lijsten. Hij verdwijnt pas als je tik of klik is
  aangekomen, zodat er niets onder je vinger wegschuift.
- **Ongedaan maken** (`PM.history`): de knoppen in de appbalk en `Ctrl` + `Z`
  gelden voor het hele ontwerp; in een tekstveld maakt `Ctrl` + `Z` je typen
  ongedaan. Verwijderen en opnieuw beginnen gebeurt direct, met *ongedaan
  maken* in de melding (`PM.toast` met `{ label, run }`) in plaats van een
  "weet je het zeker?"-vraag.
- **Uitleg** (`PM.help`, `PM.tour`): kleine [?]-knoppen naast instellingen die
  uitleg nodig hebben, en bij het eerste bezoek een korte rondleiding waarin
  je het meteen zelf doet. Beide staan ook onder *hulp* in de appbalk, met de
  sneltoetsen.
- **Downloaden** (`PM.run`): één magenta knop rechtsboven. De knop zelf toont
  wat er gebeurt ("slide 3 van 8…"), daarna kort "✓ gedownload"; dubbelklikken
  kan niet. Het pijltje ernaast: waarvoor, welk bestand, en wat je precies
  krijgt.
- **Per apparaat:** tips over slepen en sneltoetsen hebben de klasse
  `for-mouse`, de tik-variant `for-touch`; op een touchscreen verschijnt
  alleen wat daar werkt. Knoppen zijn op een touchscreen minstens 44 px, en
  vanaf 320 px breed past alles zonder zijwaarts te scrollen.

`PM.textTools` (losse knoppen *cyaan* en *vet*) en `PM.miniPreview` (zwevende
preview) staan nog in `core.js`, maar de makers gebruiken ze niet meer: de
werkbalk en het altijd zichtbare ontwerp nemen hun rol over.

## Editor-bouwstenen

De makers (posts, documenten, presentaties) werken als Canva: links een rail
met grote knoppen, daarnaast één paneel tegelijk, en de rest van het scherm is
het ontwerp. Boven het ontwerp staat een tekstwerkbalk zoals in Word. Alles
is gewone HTML met `css/editor.css`; de scripts voegen het gedrag toe.

**Laden**, na `core.js` (dat `window.PM` aanmaakt):

```html
<script src="../js/shared/brand.js"></script>
<script src="../js/shared/history.js"></script>
<script src="../js/shared/shell.js"></script>
<script src="../js/shared/help.js"></script>
<script src="../js/shared/richfield.js"></script>
<script src="../js/shared/toolbar.js"></script>
<script src="../js/shared/tour.js"></script>
<script src="../js/<tool>/help.js"></script>   <!-- teksten: PM_HELP.<tool> -->
```

**Markup**

```html
<div class="app" data-app="insta">
  <header class="appbar">
    <div class="appbar__left">
      <input class="appbar__name" aria-label="Naam van je ontwerp">
      <span class="appbar__sep appbar__sep--name"></span>
      <button class="appbar__btn" id="undoBtn" aria-label="Ongedaan maken">svg</button>
      <button class="appbar__btn" id="redoBtn" aria-label="Opnieuw">svg</button>
    </div>
    <div class="appbar__right">
      <div class="menu">
        <button class="appbar__btn" data-help-menu aria-haspopup="menu" aria-controls="helpMenu">svg<span class="appbar__txt">hulp</span></button>
        <div class="menu__list" id="helpMenu" role="menu">
          <button class="menu__item" role="menuitem" data-action="tour">svg<span data-label>rondleiding starten</span></button>
          <button class="menu__item" role="menuitem" data-action="sneltoetsen">svg sneltoetsen</button>
        </div>
      </div>
      <div class="split" data-tour="download">
        <button class="btn btn-primary" id="downloadBtn">svg<span data-label>download</span></button>
        <button class="btn btn-primary split__more" aria-haspopup="dialog" aria-controls="dlPop" aria-label="Downloadopties">svg</button>
        <div class="popover" id="dlPop" role="dialog" aria-labelledby="…">exportinstellingen</div>
      </div>
    </div>
  </header>
  <nav class="rail" aria-label="Onderdelen">
    <button class="rail__item" data-section="tekst">svg<span>Tekst</span></button>
  </nav>
  <div class="panels">
    <section class="panel" data-section="tekst">
      <header class="panel__head"><h2 class="panel__title">Tekst<span class="dot">.</span></h2></header>
      <div class="panel__body">velden</div>
    </section>
  </div>
  <main class="stage">
    <div class="stage__head"><div class="stage__group">pills</div><div class="stage__group">Emerce 100</div></div>
    <div class="stage__tools"><div id="tbar"></div></div>
    <div class="stage__canvas"><div class="stage__fit"><canvas style="--ar: .8"></canvas></div></div>
    <div class="stage__foot">slidestrook (optioneel)</div>
  </main>
</div>
```

- Iconen staan als inline SVG in de HTML: het pad uit
  `assets/icons/<categorie>/<naam>.svg`, met `class="ri"` in een knop.
- Zonder `.panel__head` maakt de shell een kop uit `PM_HELP.<tool>.sections`;
  de sluitknop komt er vanzelf in.
- `--ar` (breedte / hoogte) op het canvas: het ontwerp past altijd in het
  podium (`.stage__fit` is een size container). Pagina's die scrollen (A4)
  staan in `.stage__scroll`.
- Onder de 1024 px staat het ontwerp bovenaan, is de rail een tabbalk onderin
  en is het paneel een blad (hoogstens 60% van het scherm). Dezelfde HTML.

**PM.shell** (`js/shared/shell.js`)

```js
const shell = PM.shell(document.querySelector('.app'), { tool: 'insta', open: 'tekst', quickStart: false });
shell.open('tekst', { focus: true });   // focus: true = de kop, of een selector of element
shell.close(); shell.toggle('tekst'); shell.current;
shell.reveal('tekst', '#kop');          // paneel open, veld in beeld, focus en kort oplichten
shell.setRegions(canvas, [{ key: 'kop', rect: { x, y, w, h }, label: 'kop', section: 'tekst', field: '#kop' }]);
shell.disable('foto', 'Een carousel heeft geen foto.'); shell.enable('foto');
shell.onChange(({ id, open, narrow }) => {});
shell.onAction('nieuw', () => {});
```

- De rail is een tablist: pijltjes verplaatsen, Enter of spatie opent; het
  actieve item nog eens klikken klapt het paneel in. Het laatste paneel staat
  per tool in `pm-shell-<tool>-v1`.
- Op mobiel sluit het blad met ×, Esc, tikken ernaast of dezelfde tab.
- Hoort een onderdeel niet bij de keuze (geen foto in een carousel), dan zet
  `disable()` de rail-knop uit mét de reden: grijs, de reden als tooltip,
  een melding bij klikken, en voor schermlezers in `aria-describedby`. Niet
  stil verbergen: dan zoekt iemand zich suf.
- Regio's zijn de klikbare delen van het ontwerp, in canvas-px: bij het
  aanwijzen een cyaan kader met naam, klikken springt naar het veld. De
  kleinste regio onder de muis wint; slepen (een foto verschuiven) telt niet
  als klik.
- `data-action="tour"` en `data-action="sneltoetsen"` in het menu zijn
  ingebouwd; de toets `?` opent de sneltoetsen uit `PM_HELP.<tool>.keys`.
  De shell start ook `PM.help` en de rondleiding.
- Voor de andere bouwstenen: `PM.place` (zwevend element naast een ander, klapt
  om aan de rand), `PM.announce` (tekst voor schermlezers) en `PM.rovingIndex`.

**PM.history** (`js/shared/history.js`)

```js
const history = PM.history({ snapshot: () => state, restore: (s) => { state = s; syncInputs(); render(); }, limit: 100 });
history.bind({ undo: undoBtn, redo: redoBtn });
history.commit('kop');   // na elke wijziging; dezelfde sleutel binnen 700 ms = één stap
```

`Ctrl` + `Z`, `Ctrl` + `Shift` + `Z` en `Ctrl` + `Y` (op een Mac `⌘`), maar niet
in een tekstveld: daar maakt de browser het typen zelf ongedaan. Verder
`undo()`, `redo()`, `canUndo`, `canRedo`, `seal()`, `clear()` en `onChange(cb)`.

**PM.help** (`js/shared/help.js`): `<button type="button" class="help" data-help="formaat"></button>`
naast een label geeft een kleine zeshoek met een `?`. Klikken of tikken opent
de uitleg uit `PM_HELP.<tool>.help.formaat`, met een muis ook na een korte
pauze; Esc of ernaast klikken sluit. Met `data-help-mode="inline"` staat de
uitleg onder het veld in plaats van in een ballon.

**PM.richfield** (`js/shared/richfield.js`): een `<textarea>` of `<input>` met
`data-rich="nadruk"` (of `"vet"`, zoals de tekst van een carousel) toont
`**nadruk**` als cyaan markeerstift (of vet) en `{klant}` uit
`data-chips="{klant} {diensten}"` als een vast blokje. Het veld zelf blijft de
bron: het richfield schrijft precies dezelfde markup terug en stuurt een
`input`-event, dus bestaande code, concepten en exports merken niets.

- `veld.value` lezen en zetten werkt zoals altijd (zetten tekent de editor
  opnieuw), `veld.focus()` zet de focus in de editor.
- Plakken wordt platte tekst; Enter alleen in een `<textarea>`; `maxlength`
  telt de markup, net als het oude veld; typen met IME wordt niet onderbroken.
- Ongedaan maken binnen het veld (`Ctrl` + `Z`, typen is één stap) regelt het
  veld zelf: de browser kan dat niet meer zodra een chip of nadruk opnieuw
  getekend is. `Ctrl` + `Z` buiten een veld is de hele post (`PM.history`).
- `role="textbox"`, `aria-multiline` en het label van het veld; lukt het niet
  (oude browser), dan blijft het gewone tekstveld staan.
- `PM.richfield.init(form)` verbetert alle `[data-rich]`; de werkbalk ziet het
  richfield vanzelf en past nadruk en invulplekken toe op de markup.

**PM.toolbar** (`js/shared/toolbar.js`): `PM.toolbar(document.getElementById('tbar'))`.
Een veld doet mee met `data-toolbar="…"`; alleen die knoppen verschijnen.

| Opdracht | Waar | Wat |
|---|---|---|
| `nadruk` | tekstveld | `**woord**` in cyaan (`Ctrl` + `B`) |
| `vet` | beide | tekstveld: `**woord**`; contenteditable: vet |
| `cursief`, `onderstreept`, `opsomming`, `nummering`, `wissen` | contenteditable | zoals in Word |
| `stijl` | contenteditable | alinea, kop, tussenkop, citaat (`data-toolbar-blocks`) |
| `invoegen` | tekstveld | invulplekken: `data-toolbar-insert="{klant} {diensten}"` |
| `grootte` | beide | klein, normaal, groot (`PM.brand.SIZES`) |
| `uitlijnen` | beide | alleen wat de tool toestaat: `data-toolbar-align="links midden"` |

Grootte en uitlijning horen bij de tool: de werkbalk zet `data-size` of
`data-align` op het veld en stuurt een `pm:format`-event `{ cmd, value }`.
`Alt` + `F10` gaat naar de werkbalk, Esc terug naar het veld. Op mobiel staat
de werkbalk bovenin het blad, zodat het ontwerp groot blijft. Na elke opdracht
geeft de werkbalk `PM.tour.signal('<opdracht>')` (en `'opmaak'`), dus een
doe-stap "maak een woord cyaan" werkt zonder extra code.

**PM.tour** (`js/shared/tour.js`): de rondleiding uit `PM_HELP.<tool>.tour`.
Een stap met `target` licht `[data-tour="<target>"]` uit (en opent eerst
`section`); zonder target is het een kaart in het midden. Een doe-stap
(`doe: { event: 'input', min: 3, hint: 'Typ je kop' }`, of `signal`) gaat
vanzelf verder als je het gedaan hebt; voor iets anders dan een DOM-event
roept de tool `PM.tour.signal('<naam>')` aan. Bij het eerste bezoek start hij
na een seconde; via een snelle start van het dashboard (`quickStart: true`)
alleen een melding met een knop. Esc of × stopt; het hulpmenu biedt daarna
"rondleiding verder (stap 3 van 6)". De stand staat in `pm-tour-<tool>-v1`.

**PM.brand** (`js/shared/brand.js`): kleuren, typeschaal, raster, formaten en
exportmaten als gegevens, gelijk aan `global.css`, `canvas-kit.js` en de
templates (de tests controleren dat). Controles met een zin voor de gebruiker:
`photoCheck(fotoB, fotoH, vakB, vakH, exportschaal, { zoom })` (let op vanaf
1,25× vergroten, te klein vanaf 2×), `textFit({ size, base, overflow, name })`
en `safeZone('story')`.

**Het contract** (`js/<tool>/help.js`):

```js
(window.PM_HELP = window.PM_HELP || {}).insta = {
  sections: [{ id: 'template', label: 'Template', title: 'Kies je template', icon: 'layout-masonry-line' }],
  help: { formaat: { title: 'Formaat', text: 'Korte uitleg; **vet** mag.' } },
  tour: [
    { id: 'welkom', title: '…', text: '…' },
    { id: 'kop', section: 'tekst', target: 'kop', title: '…', text: '…', doe: { event: 'input', min: 3, hint: 'Typ je kop' } },
  ],
  keys: [['Ctrl + Z', 'ongedaan maken'], ['Ctrl + Shift + Z of Ctrl + Y', 'opnieuw']],
};
```

## Insta Post Maker

Vijf templates: standaard foto, foto met tekst, Pure Blog, Pure Case en een
informatieve carousel met swipe-indicator (de laatste slide krijgt er vanzelf
geen). Formaten 1:1, 4:5 en 9:16 (story). Alle posts zijn donker. De editor
gebruikt de [editor-bouwstenen](#editor-bouwstenen).

- **Rail:** *Template* (template en formaat, en *alles wissen*), *Foto*,
  *Tekst* (belangrijkste veld eerst, het label als laatste) en *Details*.
  Bestaat een onderdeel niet bij het template, dan staat het uit met de reden:
  een carousel heeft geen foto, standaard foto heeft geen details.
- **Klik in de preview:** een cyaan kader toont wat je aanwijst (kop, label,
  foto, klantlogo, resultaat, magenta blok …); klikken opent het paneel en
  zet je in het veld. Slepen verschuift de foto, zoals voorheen.
- **Tekst:** nadruk staat in het veld als cyaan markeerstift (in de tekst van
  een carousel als vet), invulplekken als blokje. De werkbalk boven de post:
  *cyaan* (of *vet*), *+ klant* / *+ diensten* / *+ onderwerp*, en bij de kop
  de *grootte* uit de typeschaal (klein, normaal, groot; per template
  bewaard). Koppen staan altijd links, zoals de huisstijl. Het label heeft
  snelknoppen (pure kennis, pure blog, pure case, pure nieuws).
- **Te lange tekst:** de melding onder de post zegt welk veld het is, met een
  knop die je erheen brengt.
- **Foto:** klik op de lege fotoplek, sleep hem overal op het podium of plak
  hem. Is hij te klein voor de gekozen export, dan zegt een rustige melding
  bij de foto en onder de post hoe groot hij moet zijn. Bij Pure case staat
  *foto als donkere achtergrond* bovenaan en gaat hij vanzelf aan als je een
  foto kiest.
- **Story:** de schakelaar *veilige zone* in de kop van de preview toont de
  balken van Instagram over de preview, nooit in de download.
- **Download** rechtsboven downloadt meteen; het pijltje ernaast toont
  waarvoor (Instagram, LinkedIn, extra scherp), het bestand (PNG, JPG of PDF),
  *alleen deze slide*, *kopieer* (altijd PNG), en in één regel wat je krijgt
  ("zip met 3 PNG's · 1080 × 1350 px", "1 PDF met 5 pagina's · bewerkbaar in Canva",
  "1 PDF voor LinkedIn met 3 pagina's"). De keuze wordt onthouden; `Ctrl` + `S`
  werkt nog. Wat welke keuze oplevert staat op één plek: `js/insta/export.js`.
- **PDF (voor Canva):** voor elke post, net als in de andere makers. Bedoeld
  om verder te bewerken in Canva (ook Illustrator en Acrobat): sleep hem op de
  startpagina van Canva of klik op *Uploaden*. Elk onderdeel is een eigen laag:
  tekst is echte tekst in ingesloten Open Sans (per regel en stijl één
  tekstobject, met het juiste gewicht), effen vlakken en losse zeshoeken zijn
  vector, het logo, de Emerce 100-badge en een klantlogo in SVG ook (elk één
  vorm). Afbeeldingen zijn elk verloop en het zeshoekpatroon op de achtergrond
  (elk één transparante PNG), foto's (uitgesneden tot wat je ziet, hoogstens
  twee pixels per ontwerp-px), een foto in een zeshoek (PNG met doorzichtige
  hoeken, want Canva negeert uitknippaden) en een klantlogo dat geen SVG is.
  Heeft de PDF meer onderdelen dan Canva importeert (1.400), dan zegt de tool
  dat. Een post is één pagina, een carousel een pagina per slide (ook
  voor Instagram), *alleen deze slide* één pagina. Pagina: 0,75 pt per
  ontwerp-px (1:1 is 810 × 810 pt), net als de LinkedIn-PDF; in Canva is hij
  weer 1080 px breed. Bestand: `pureminds-<template>-<onderwerp>.pdf`.
- **Ongedaan maken** (appbalk, `Ctrl` + `Z`): de hele post, ook een foto
  vervangen of weghalen. Foto en klantlogo staan elk onder een eigen sleutel
  in IndexedDB (`photoKey`, `logoKey` in het concept); oude versies blijven
  tot de volgende keer laden bewaard, dan ruimt de tool ze op.
- **Rondleiding:** bij het eerste bezoek (niet via een snelle start van het
  dashboard; dan een melding met een knop). Stappen die bij het template niet
  bestaan worden overgeslagen.
- **Pure blog post:** onderin staat een magenta blok met de CTA ("lees de
  blog"), zonder pijl: het is een oproep, geen knop om op te klikken.
- **Emerce 100-badge:** de schakelaar staat altijd in de kop van de preview.
  Wit, klein linksonder.
  - Hij is 45% van de hoogte van het logo, staat even ver van de rand als het
    logo en is verticaal op het logo gecentreerd.
  - In een carousel staat hij alleen op de laatste slide: op de eerste staat
    linksonder de swipe-aanwijzing.
  - In PNG en JPG wordt hij op de exportmaat getekend, in de PDF als vector
    (één vorm). In de miniaturen van de templates staat hij niet.

| Formaat | 1080 px (Instagram) | 1200 px (LinkedIn) | 2160 px |
|---|---|---|---|
| 1:1 | 1080 × 1080 | 1200 × 1200 | 2160 × 2160 |
| 4:5 | 1080 × 1350 | 1200 × 1500 | 2160 × 2700 |
| 9:16 (story) | 1080 × 1920 | 1200 × 2133 | 2160 × 3840 |

## Document Maker

Brief, offerte, memo of notitie op het A4-briefpapier. De editor gebruikt de
[editor-bouwstenen](#editor-bouwstenen); de pagina's staan op het podium,
passend in de breedte (nooit groter dan echt), en meer pagina's scrollen.

- **Rail:** *Soort* (vier kaartjes met een mini-A4, en *nieuw document*),
  *Gegevens* (eerst het onderwerp, dan aan wie: adres, kenmerk of
  offertegegevens, en de aanhef; datum en label als laatste), *Tekst*,
  *Prijzen* (alleen bij een offerte; anders uit met de reden), *Afsluiting*
  (slotgroet, naam, functie, handtekening) en *Briefpapier*. Zolang adres,
  KvK en e-mail van het briefpapier leeg zijn, staat er een cyaan stipje bij
  *Briefpapier*.
- **Kop van de preview:** soort, aantal pagina's en de Emerce 100-schakelaar
  (altijd zichtbaar, ook op mobiel met het blad open).
- **Klik in de preview:** een cyaan kader met de naam toont wat je aanwijst
  (titel, adres, datum en kenmerk, aanhef, tekst, offerteregels, voor akkoord,
  ondertekening, briefpapier, Emerce 100); klikken opent het paneel en zet je
  in het veld. Klik je in de tekst, dan staat de cursor op precies die plek in
  de editor. Andersom schuiven de pagina's mee naar wat je invult of typt.
- **Tekst:** de werkbalk zoals in Word staat boven de pagina's (op mobiel
  bovenin het blad) zolang *Tekst* open is: *stijl* (alinea, kop, tussenkop,
  citaat), vet, cursief, onderstreept, opsomming, genummerde lijst en *opmaak
  wissen*. Geen lettergrootte of uitlijning: die komen uit de huisstijl.
  `Ctrl` + `B` / `I` / `U`, `Alt` + `F10` naar de werkbalk. Plakken uit Word of
  Google Docs mag; alleen die opmaak blijft over.
- **Offerteregels:** per regel de omschrijving, daaronder aantal, prijs per
  stuk (excl. btw) en het regeltotaal. Plakken uit Excel of Google Sheets vult
  de regels (omschrijving, aantal, prijs, of omschrijving en prijs). Bedragen
  als "€ 1.250,50" worden goed gelezen en na het typen netjes teruggezet.
  Enter springt naar de volgende regel of maakt een nieuwe. Btw, subtotaal en
  totaal staan eronder, net als op de pagina.
- **Download** rechtsboven maakt meteen de PDF; het pijltje ernaast toont PDF,
  Word (.docx, ook voor Google Docs) en afdrukken, elk met wat je krijgt.
  `Ctrl` + `S` is de PDF, `Ctrl` + `P` afdrukken.
- **Voorbeeldtekst:** een nieuw document heeft voorbeeldinhoud. Staat daar
  vóór een download nog iets van (een voorbeeldregel in het adres, een
  voorbeeldzin, een voorbeeldregel in de offerte) of een invulplek als
  `[naam]`, dan zegt de tool waar: "Nog voorbeeldtekst in: aanhef en adres",
  met *naar het veld* (de tekst staat dan geselecteerd, typen vervangt hem) en
  *toch downloaden*. Nooit stil tegenhouden; dezelfde voorbeeldtekst vraagt hij
  maar één keer. De controle staat in `js/document/model.js`.
- **Pagina's:** tekst loopt vanzelf door naar een volgende pagina. Alinea's
  en lijsten worden op woorden gesplitst, de offertetabel op regels, en een
  kop gaat mee met de tekst eronder. Staan er op de laatste pagina maar een
  paar regels, dan zegt een melding onder de pagina's hoe het op een pagina
  minder past, met *naar de tekst* en bij een offerte *voor akkoord
  uitzetten*. Marges en typeschaal van het briefpapier liggen vast.
- **Ongedaan maken** (appbalk, `Ctrl` + `Z`): het hele document, de tekst en
  de offerteregels inbegrepen, en ook het briefpapier en de badge: die zie je
  op de pagina veranderen, dus ze horen bij "wat ik net deed". Ze blijven wel
  apart bewaard (`pm-document-sender-v1`) en staan bij *nieuw document* nog.
  In de tekst zelf maakt `Ctrl` + `Z` je laatste typwerk ongedaan.
- **Handtekening:** een tegel met voorbeeld; klik of sleep een afbeelding. Hij
  staat in IndexedDB onder een eigen sleutel (`sigKey` in het concept), zodat
  ongedaan maken ook een vervangen handtekening terugzet; oude blijven tot de
  volgende keer laden bewaard, dan ruimt de tool ze op.
- **Nieuw document** begint direct opnieuw (briefpapier, naam, functie en
  handtekening blijven), met *ongedaan maken* in de melding.
- **Rondleiding:** bij het eerste bezoek (via een snelle start van het
  dashboard alleen een melding met een knop). De stap over prijzen doet
  alleen mee bij een offerte.
- **Logo:** het zwarte zeshoek-logo (vector), net als op de posts en slides.
- **Emerce 100-badge:** zwart, rechts in de voet vóór het paginanummer, op
  elke pagina.
  - Hij is ongeveer 7 mm hoog en loopt van de bovenkant van de eerste
    voetregel tot de grondlijn van de laatste. Voet en pagina-indeling
    veranderen er niet door.
  - De keuze hoort bij het briefpapier: hij geldt voor elk document en blijft
    staan bij *nieuw document*.
  - PDF: vector via svg2pdf. Word: SVG met een PNG-reserve voor Google Docs,
    in de voet van de eerste en de volgende pagina's.
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

16:9-slides in zeven layouts. De editor gebruikt de
[editor-bouwstenen](#editor-bouwstenen): de slide groot op het podium, de
strook met alle slides eronder.

- **Rail:** *Layout* (het raster met de zeven layouts staat altijd open, met
  je eigen slide in elke miniatuur en de huidige gemarkeerd), *Inhoud* (de
  velden van deze layout, het label als laatste), *Foto* (alleen bij
  titelslide, beeld + tekst en afsluiter; anders uit met de reden) en
  *Presentatie* (slidenummers, cyaan punt, *nieuwe presentatie*).
- **Layouts:** titelslide, sectie (automatisch genummerd), opsomming,
  beeld + tekst (foto links of rechts), citaat of kerncijfer, tabel,
  afsluiter. Wisselen houdt tekst en foto vast.
- **Klik op de slide:** een cyaan kader toont wat je aanwijst (titel,
  ondertitel, punten, citaat, kerncijfer, label, foto, een cel van de tabel);
  klikken opent het paneel en zet je in dat veld of die cel. Slepen verschuift
  de foto, de pijltjestoetsen ook.
- **Tekst:** nadruk staat in het veld als markering. De werkbalk boven de
  slide: *cyaan* in titel, citaat, de toelichting bij een kerncijfer en de
  contactgegevens; *vet* in de andere velden (wit en vet op de slide). Bij
  titel en citaat ook de *grootte* (klein, normaal, groot; per slide en binnen
  het passend maken, dus lange tekst krimpt nog steeds). Geen uitlijning:
  slides staan links.
- **Slides:** *+ slide* zet een nieuwe slide na deze en opent de layoutkeuze.
  Voor de gekozen slide: *dupliceer*, *naar voren*, *naar achteren* en
  *verwijder* (met *ongedaan maken* in de melding); bij weinig ruimte in het
  menu achter "3 / 8 ⋮". Klikken kiest, slepen verplaatst, `←` `→` bladeren
  alleen. In de strook: `Home`, `End`, `Delete` (verwijderen) en `Enter`
  (bewerken). Past de strook niet, dan wijst een verloop met pijl naar de rest.
- **Tabel:** een raster; Tab en Enter springen door de cellen (de ×-knoppen
  zitten niet in de Tab-volgorde, *− rij* en *− kolom* werken op de cel waar
  je stond). Plakken uit Excel of Google Sheets vult de tabel vanaf de gekozen
  cel, tot 14 rijen en 8 kolommen. Kopregel en vette eerste kolom aan of uit,
  `**woord**` wordt cyaan, kolommen met getallen lijnen rechts uit, korps en
  kolombreedtes schalen mee. In PowerPoint en Google Slides een echte tabel.
- **Foto's:** per slide. Klik op de lege plek op de slide, sleep hem op het
  podium of plak hem. Zoomen en *centreren* in het paneel. Een foto op een
  layout zonder fotoplek geeft uitleg en de knop *gebruik beeld + tekst*. Is
  hij te klein voor de gekozen resolutie (let op 4K), dan zegt een rustige
  melding bij de foto, onder de slide en in de download-opties hoe groot hij
  moet zijn.
- **Te lange tekst:** past tekst ook op de kleinste letter niet, dan noemt de
  melding onder de slide het veld, met een knop erheen.
- **Download** rechtsboven maakt meteen de PDF; het pijltje ernaast toont
  PDF, PowerPoint (.pptx, ook voor Google Slides) en *als afbeelding* (Full HD
  of 4K; deze slide of een zip met alle slides), elk met wat je krijgt ("zip
  met 8 PNG's · 3840 × 2160 px"). `Ctrl` + `S` is de PDF.
- **Nog even checken:** staat er vóór een download nog voorbeeldtekst (ook de
  voorbeeldtabel), een invulplek als `[bron invullen]`, een lege slide of
  tekst die niet past, dan toont de tool per slide wat er is, met *naar slide
  3* en *toch downloaden*. Dezelfde inhoud vraagt hij maar één keer; labels,
  de regel onderaan en "Bedankt" tellen niet als voorbeeld. De controle staat
  in `js/presentation/deck.js`.
- **Ongedaan maken** (appbalk, `Ctrl` + `Z`): de hele presentatie, van tekst,
  grootte en layout tot volgorde, verwijderen, tabel, uitsnede en foto's; je
  springt naar de slide die veranderde. Elke foto staat onder een eigen
  sleutel in IndexedDB (`photoKey` per slide; een ouder concept met
  `slide:<id>` werkt nog). Wat niet meer gebruikt wordt, ruimt de tool bij
  het volgende laden op.
- **Rondleiding:** negen stappen, van je titel tot de download. Stappen die
  bij slide 1 niet bestaan (een foto bij een citaat) worden overgeslagen.
- **Mobiel en tablet:** de slide boven, het blad eronder. De strook is één
  rij (*+ slide*, miniaturen, menu) en verdwijnt zolang het blad open is;
  bladeren kan dan met ‹ › bovenin *Inhoud*.
- **PDF:** één pagina per slide (960 × 540 pt, zoals PowerPoint), in losse
  lagen met echte tekst (zie [Bewerkbare PDF's](#bewerkbare-pdfs)).
- **PowerPoint:** `js/presentation/pptx.js` zet elke slide om in tekstvakken,
  vormen en foto's op precies de plek van de preview, met dezelfde
  korpsgrootte en regelval (het "plan" uit `templates.js`). Tekstvakken
  krimpen bij te veel tekst, net als in de tool. Foto's zijn de vulling van
  een zeshoek of een bijgesneden afbeelding met dezelfde uitsnede. De
  achtergrond, cyaan balk, logo en voetregel staan op een Pure Minds-master:
  een nieuwe slide in PowerPoint krijgt ze vanzelf. Het slidenummer is een
  veld en telt mee bij verschuiven of toevoegen.

## Icon Finder

Alle 3.229 iconen van [Remix Icon](https://remixicon.com/) (1.690 namen, de
meeste in een lijn- en een volle stijl) op één plek, te downloaden in de
huisstijl. De iconen vallen onder de Remix Icon License v1.0 (een kopie staat
in `assets/icons/LICENSE`): vrij te gebruiken in eigen werk, niet te verkopen
als los iconenpakket.

- **Zoeken in het Nederlands of Engels:** "prullenbak" vindt `delete-bin`,
  "tandwiel" vindt `settings`. Meervouden en verkleinwoorden werken ook
  ("pijlen", "huisje"). Staat er een typfout in, dan toont de tool wat erop
  lijkt ("prulenbak"). De beste treffer staat eerst: een exacte naam, dan
  namen die met het woord beginnen, dan kortere namen.
- **Stijl, vorm en kleur** gelden voor het hele raster, dus wat je ziet,
  download je:
  - stijl: *lijn* of *vol*
  - vorm: *los* of *zeshoek*
  - kleur, altijd effen: inkt, cyaan, blauw, magenta, wit of een eigen kleur
    (los); cyaan met een wit of een inkt icoon, donker, magenta, wit of een
    eigen kleur (zeshoek)

  Bij wit worden raster en preview vanzelf donker.
- **Categorieën:** de knoppen boven het raster tonen per categorie hoeveel
  iconen er bij de zoekterm horen.
- **Laatst gebruikt:** zonder zoekterm staan iconen die je al gedownload of
  gekopieerd hebt bovenaan.
- **Export:**
  - SVG: vector, voor Figma, Illustrator en het web.
  - PNG: 128, 256, 512, 1024 of 2048 px hoog, met een transparante
    achtergrond, voor PowerPoint, Google Slides, Canva en Word. De zeshoek is
    smaller dan hij hoog is, dus 512 px hoog wordt 452 × 512.
  - *Kopieer* zet de SVG-code (plakt als vector in Figma) of de PNG
    (plakt in een slide of document) op het klembord.
- **PNG-kwaliteit:** de SVG krijgt eerst zelf de maat van de export en wordt
  pas dan op een canvas van precies die maat getekend. Er wordt dus nooit een
  klein plaatje opgeschaald: ook 2048 px is haarscherp.
- **Bestandsnamen:** `home-line.svg` (los, inkt), `home-line-cyaan.svg`,
  `home-fill-zeshoek-blauw-512px.png`, `…-eigen-1a2b3c` voor een eigen kleur.
- **Sneltoetsen:**

  | Toets | Wat |
  |---|---|
  | `/` of `Ctrl` + `K` | naar het zoekveld |
  | `Esc` | zoekveld leegmaken |
  | pijltjes, `Home`, `End`, `PgUp`, `PgDn` | door het raster bladeren |
  | `Enter` | naar de downloadknop |
  | `Ctrl` + `S` | het gekozen icoon downloaden |
  | `Ctrl` + `C` (op een icoon) | het icoon kopiëren |

  Dubbelklikken op een icoon downloadt het direct.
- **Mobiel:** een gekozen icoon opent in een paneel van onderen, met dezelfde
  export.
- **Adres en opslag:** zoekterm, categorie en gekozen icoon staan in het adres
  (`?q=mail&cat=Arrows&icoon=mail`), dus een link doorsturen werkt. Stijl,
  vorm, kleur, formaat en de laatst gebruikte iconen staan in `localStorage`
  (`pm-icons-v1`).

### Iconen en zoekwoorden bijwerken

- **Nieuwe iconen:** zet de SVG's in `assets/icons/<categorie>/` (één pad op
  het 24-raster, zoals Remix) en draai `npm run icons`.
- **Zoekwoorden:** pas `scripts/icon-words/nl.json` aan (Engels woord of
  combinatie → Nederlandse zoekwoorden; woorden na een `|` tellen minder) en
  draai `npm run icons`.
- **De zeshoek:** `js/icons/hex.js` rekent in de browser precies na wat
  `assets/icons/maak-zeshoeken.py` doet. Een zeshoek-SVG uit de tool is dus
  gelijk aan het bestand dat het script in `assets/icons/Zeshoek/` zet, op
  afronding na (hoogstens 0,001 eenheid, onzichtbaar). Die map is uitvoer en
  staat niet in de repo. Verander je maten of varianten in
  het Python-script, doe dat dan ook in `hex.js`.

  De varianten zijn effen, zonder verloop of rand:

  | Variant | Zeshoek | Icoon |
  |---|---|---|
  | Blauw (Pure Cyaan) | `#1ab9e2` | wit |
  | Donker | `#303030` | wit |
  | Wit | `#ffffff` | inkt |

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
een echt canvas. Die onthoudt elke opdracht en schrijft bij `flush()` alles in
tekenvolgorde weg als losse PDF-objecten, zodat Canva elk onderdeel als eigen
laag importeert en de PDF er precies zo uitziet als de preview:

- **Tekst:** echte tekst, per regel en stijl één object, met de spaties erin.
  De browser meet, net als in de preview, dus regelval en posities zijn gelijk.
  Elk gewicht heeft een eigen fontnaam (`OpenSans-ExtraBold`, via
  `PM.pdfFonts` in `core.js`, dat ook `/StemV` per gewicht goed zet); met één
  naam voor alle gewichten maakte Canva alle tekst even dik en liet het koppen
  weg. Alle makers maken hun PDF met `PM.pdfDocument` en `PM.pdfFinish`.
- **Vormen:** effen vlakken en lijnen als vector. Een effen vlak dat een
  uitsnede vult, wordt de vorm van die uitsnede.
- **Verlopen:** elk verloop is één transparante PNG, getekend door de browser
  (over een rechthoek op halve resolutie; na vergroten is dat gelijk). PDF
  kent geen transparante verlopen, en de oude benadering met 64 banen of
  ringen maakte Canva samen met de rest tot één platte afbeelding.
- **Foto's:** uitgesneden tot wat je ziet (JPEG; PNG bij transparantie of
  als de bron een PNG of SVG is). In een zeshoek een PNG met doorzichtige
  hoeken, op hoogstens 1,5 px per ontwerp-px: Canva negeert uitknippaden.
- **Logo's:** SVG via svg2pdf.js; vormen van één kleur worden één pad, zodat
  het logo in Canva één element is (alleen als de browser bevestigt dat het er
  zo precies hetzelfde uitziet). Een SVG die svg2pdf niet aankan, gaat als
  afbeelding mee in plaats van de export te laten mislukken.
- **Tekens die Open Sans niet heeft** (emoji) worden een kleine PNG, anders
  kapt jsPDF de tekst af.

Een afbeelding die op meer pagina's terugkomt (een verloop in een carousel)
zit maar één keer in het bestand; het logo en de Emerce-badge zijn vector en
staan op elke pagina als vorm. Kleuren staan met vier decimalen in de PDF
(jsPDF rondt anders af, en wordt merkcyaan `#1ab9e2` in Canva `#1abae3`). Canva importeert hoogstens 1.400 elementen
per PDF; een post heeft er hoogstens zo'n 30, een slide met een grote tabel
zo'n 90. Controleren: `npm test` (tests/pdf-canvas.test.js) dekt de keuzes per
tekenopdracht zonder browser.

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
