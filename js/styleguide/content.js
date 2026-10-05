/* =============================================================================
   styleguide/content.js — alle teksten van het brandbook, los van de opmaak
   -----------------------------------------------------------------------------
   Missie, visie en kernwaarden staan er letterlijk in zoals in brandbook v2.0,
   alleen opgeschoond (enkele spaties, "technologiegedreven" aan elkaar).
   "on-aangetapt" blijft zoals het is: zo staat het ook in de voorstellen.
   De rest (tone of voice, regels voor logo, zeshoek, kleur, beeld en iconen)
   vult dat brandbook aan. Geen versie of datum: het brandbook is altijd de
   huidige huisstijl. De pagina's (js/styleguide/pages.js) tekenen deze teksten;
   zoeken (js/styleguide/model.js) doorzoekt ze. Nadruk: **woord** wordt cyaan
   (op donker) of vet.

     chapters   de hoofdstukken, in de volgorde van de rail
     pages      de pagina's: id, hoofdstuk, titel en zoekwoorden
     iconPaths  Remix-iconen (24-raster, uit assets/icons) die de pagina's tekenen
     photos     de voorbeeldfoto's (assets/styleguide/photos) met hun fotograaf

   Geen DOM: dit bestand laadt ook in Node (voor de tests).
   ============================================================================= */
(function (global) {
  'use strict';

  const C = {
    company: 'Pure Minds Marketing Group',
    short: 'Pure Minds',
    domain: 'pureminds.nl',
    slogan: 'Het performance marketing bureau voor bedrijven die vooruit willen.',
    contact: { web: 'www.pureminds.nl', phone: '045 - 3690530', email: 'info@pureminds.nl' },

    /* --- Merk --- */

    intro: 'Waar wij in geloven en elke dag opnieuw aan werken, is verankerd in onze missie en visie.',
    vision: 'Wij zijn ervan overtuigd dat in de essentie van elke onderneming nog verborgen groeikansen liggen. Met de juiste ondersteuning kunnen deze kansen worden benut, wat leidt tot authentieke groei en duurzame welvaart op eigen kracht.',
    mission: 'Wij helpen ondernemers bij het vinden en benutten van on-aangetapt groeipotentieel.',

    values: [
      { id: 'authentiek', name: 'Authentiek', text: 'Streven naar eerlijke, oprechte relaties met klanten en partners.', sound: 'Eerlijk over wat werkt en wat niet; geen beloftes die we niet waarmaken.' },
      { id: 'verbonden', name: 'Verbonden', text: 'Het belang van menselijke interactie benadrukken in een technologiegedreven wereld.', sound: 'Persoonlijk, met “je” en “we”; we praten mét de klant, niet over hem.' },
      { id: 'duurzaam', name: 'Duurzaam', text: 'Waarde hechten aan een bestendig samenwerkingsverband met alle stakeholders, onder het oogmerk van maatschappelijk verantwoord ondernemen.', sound: 'Nuchter en op lange termijn; liever één goed resultaat dan drie hypes.' },
      { id: 'inventief', name: 'Inventief', text: 'Opvolgen van de technologische vooruitgang om deze creatief te implementeren in de diensten voor onze klanten.', sound: 'Concreet over nieuwe techniek; we leggen uit wat het oplevert, zonder jargon.' },
    ],

    tone: {
      intro: 'Pure Minds schrijft professioneel en toegankelijk: zoals een ervaren adviseur die met je aan tafel zit. Helder en direct, altijd onderbouwd. We overtuigen met resultaat en uitleg, niet met superlatieven.',
      // pos: waar Pure Minds staat tussen links (0) en rechts (1)
      scales: [
        { left: 'Formeel', right: 'informeel', pos: 0.56, where: 'Zakelijk en toegankelijk', practice: 'Je/jij, maar zakelijk: geen spreektaal of grapjes. U als de klant dat vraagt (bijvoorbeeld overheid, zorg).' },
        { left: 'Nuchter', right: 'enthousiast', pos: 0.36, where: 'Nuchter met energie', practice: 'Enthousiasme blijkt uit concrete resultaten (“+184% aanvragen in drie maanden”), niet uit uitroeptekens.' },
        { left: 'Overtuigend', right: 'informerend', pos: 0.4, where: 'Overtuigend door uit te leggen', practice: 'Altijd in de vaste volgorde: eerst wat het oplevert, dan het probleem van de klant, dan hoe we het gedaan hebben.' },
        { left: 'Technisch', right: 'toegankelijk', pos: 0.8, where: 'Toegankelijk', practice: 'Vaktermen alleen als de lezer ze kent; anders één zin uitleg (“GA4, de meetomgeving van Google”).' },
      ],
      // De vaste volgorde van een verhaal: resultaat, probleem, aanpak (onder de schalen)
      order: {
        title: 'Vaste volgorde',
        steps: [
          { title: 'Wat het oplevert', text: 'Begin met het resultaat: “+184% aanvragen in drie maanden.”' },
          { title: 'Het probleem van de klant', text: 'Dan wat er speelde: “Bezoekers vonden de offerteknop niet.”' },
          { title: 'Hoe we het gedaan hebben', text: 'Dan pas de aanpak: “De knop staat nu op elke pagina bovenaan.”' },
        ],
      },
      rules: [
        'Korte zinnen, actieve vorm. Eén gedachte per zin.',
        'Koppen met een hoofdletter en vaak een cyaan punt erachter (“Onze belofte.”). Knoppen en labels in kleine letters (“lees meer”, “plan een gesprek”).',
        'De naam voluit: Pure Minds Marketing Group (met hoofdletters). In lopende tekst mag Pure Minds. Het webadres altijd klein: pureminds.nl.',
        'Getallen als cijfers bij resultaten (3 maanden, 60%), bedragen als € 1.500,-.',
        'Geen emoji in documenten en presentaties; op social spaarzaam (geen overkill, nooit in de kop).',
      ],
      examples: [
        { wel: 'We hebben je Google Ads-account doorgelopen. Drie dingen kosten je nu klikken die niets opleveren.', niet: 'Wij hebben uw account aan een uitgebreide, state-of-the-art analyse onderworpen!' },
        { wel: '+184% aanvragen in drie maanden. Bezoekers vonden de offerteknop niet; die staat nu op elke pagina bovenaan.', niet: 'Wij gaan uw online aanwezigheid naar een next level tillen.' },
        { wel: 'Hulp nodig bij je campagnes? Plan een gratis adviesgesprek via pureminds.nl.', niet: 'Neem NU contact op voor de beste marketing van Nederland!!!' },
      ],
    },

    /* --- Logo en zeshoek --- */

    logo: {
      intro: 'Het primaire logo is de zeshoek met “pure minds.” en “marketing group”, als lijnvorm. Er zijn twee kleurvarianten: wit op donker en zwart (Inkt) op licht.',
      variants: [
        { id: 'wit', name: 'Wit', color: '#FFFFFF', bg: '#303030', text: 'Primair: wit logo op Inkt of een donkere foto.' },
        { id: 'inkt', name: 'Inkt', color: '#303030', bg: '#FFFFFF', text: 'Op lichte ondergrond: het logo in Inkt.' },
      ],
      clearSpace: 'Rond het logo blijft aan alle kanten een vrije ruimte van X = ¼ van de logobreedte. In die zone staat niets: geen tekst, geen rand van de pagina, geen andere vorm. Bij een logo van 116 px breed (zoals op de slides) is X dus 29 px.',
      minimum: [
        { medium: 'Digitaal (web, social, slides)', min: '80 px', why: 'Daaronder is “marketing group” niet meer leesbaar.' },
        { medium: 'Print', min: '20 mm', why: 'Idem; de fijne letters lopen anders dicht in de druk.' },
        { medium: 'Favicon en app-icoon', min: '16–64 px', why: 'Uitzondering: alleen het bestaande favicon, nooit een verkleind logo.' },
      ],
      donts: [
        { id: 'achtergrond', title: 'Geen achtergrond achter het logo', text: 'Zet het logo direct op de foto of het vlak, zonder eigen kader of vlak erachter.' },
        { id: 'vervormen', title: 'Logo niet vervormen', text: 'Altijd in de eigen verhouding schalen; niet uitrekken, kantelen of spiegelen.' },
        { id: 'eroverheen', title: 'Niets over het logo heen', text: 'Ook geen zeshoekjes, badges of tekst in de clear space.' },
        { id: 'kleur', title: 'Geen andere kleur', text: 'Alleen wit of Inkt, ook niet in cyaan.' },
        { id: 'kader', title: 'Geen kader om het logo', text: 'Ook niet op een drukke foto.' },
        { id: 'kantelen', title: 'Niet kantelen', text: 'Het logo staat altijd recht.' },
      ],
      added: [
        { title: 'Kleur', text: 'Alleen wit of Inkt. Geen cyaan, magenta, verloop of schaduw op het logo.' },
        { title: 'Contrast', text: 'Op een foto alleen waar het rustig is; leg zo nodig een donker verloop onder de rand van de foto, nooit een kader om het logo.' },
        { title: 'Plek', text: 'In documenten linksboven, zoals op het briefpapier; op posts en slides altijd rechtsonder op dezelfde plek. Eén logo per pagina, post of slide.' },
        { title: 'Bestanden', text: 'Gebruik altijd de originele logobestanden (SVG voor digitaal en print, PNG alleen als het programma geen SVG kent). Nooit overtrekken of een screenshot gebruiken.' },
      ],
    },

    hexagon: {
      intro: 'De zeshoek komt uit het logo en is het herkenbaarste element na het logo zelf. Zo gebruik je hem goed:',
      rules: [
        { ok: true, text: 'Punt boven, zoals in het logo. Nooit plat liggend.' },
        { ok: true, text: 'Effen cyaan, donker of magenta met een wit lijnicoon, of wit met een uitgesneden icoon, dan alleen in de volle stijl.' },
        { ok: false, text: 'Geen verloop en geen blauw (#1B71A8) als vlak.' },
        { ok: false, text: 'Geen rand om een witte zeshoek; zet hem op een donkere of gekleurde ondergrond.' },
      ],
      uses: [
        { id: 'bullet', title: 'Opsommingsteken', text: 'Een klein cyaan zeshoekje vóór een label of bullet (zoals in al onze templates).' },
        { id: 'frame', title: 'Fotokader', text: 'Een foto in een zeshoek, eventueel met een tweede, iets verschoven cyaan lijn-zeshoek erachter (de “echo”).' },
        { id: 'holder', title: 'Icoonhouder', text: 'Vier vaste varianten (cyaan, donker, magenta en wit), met afgeronde hoeken van 12% van de straal.' },
        { id: 'pattern', title: 'Patroon', text: 'Een fijn lijnpatroon van zeshoeken op de achtergrond, wit op 4–7% dekking. Nooit als drukke tegelvloer.' },
      ],
    },

    /* --- Kleur --- */

    colors: {
      intro: 'Drie primaire kleuren en vier accenten, met vaste rollen. Effen, altijd: geen verlopen in vormen of zeshoeken.',
      secondaryRule: 'Alleen voor grafieken, datavisualisatie en het onderscheiden van categorieën. Nooit als achtergrond van een hele pagina en nooit voor het logo of een zeshoek.',
      ratio: '60% wit en neutraal (inclusief Inkt), 30% Pure Cyaan en 10% magenta en accenten. Een lichte en een donkere compositie passen dezelfde verhouding toe.',
      ratioParts: { neutral: 'Wit en neutraal', neutralDark: 'Inkt en neutraal', cyaan: 'Pure Cyaan', accent: 'Magenta en accenten' },
      // [tekstkleur, achtergrond, naam]: de combinaties in de contrasttabel; de waarden rekent model.js uit
      contrast: [
        ['wit', 'inkt', 'Wit op Inkt'],
        ['cyaan', 'inkt', 'Pure Cyaan op Inkt'],
        ['inkt', 'cyaan', 'Inkt op Pure Cyaan'],
        ['wit', 'magenta', 'Wit op Pure Magenta'],
        ['wit', 'blauw', 'Wit op Blauw'],
        ['wit', 'cyaan', 'Wit op Pure Cyaan'],
        ['cyaan', 'wit', 'Pure Cyaan op wit'],
        ['wit', 'oranje', 'Wit op Oranje'],
      ],
      // Waarom deze regels, voor wie geen ontwerper is (pagina en paneel). Vaste spatie rond de dubbele punt
      why: [
        { id: 'ratio', title: 'Waarom 60/30/10', text: 'Eén kleur die de toon zet geeft rust, en overal dezelfde verhouding maakt ons herkenbaar. Magenta valt op omdat hij schaars is: daarom alleen voor de hoofdactie.' },
        { id: 'contrast', title: 'Waarom contrast', text: 'Zo kan iedereen de tekst lezen, ook op een slecht scherm of in de zon. De norm voor toegankelijkheid (WCAG) vraagt 4,5 : 1 voor gewone tekst en 3 : 1 voor grote tekst.' },
      ],
      contrastNote: 'Let op: Pure Cyaan werkt als tekstkleur alleen op donker. Op wit is cyaan voor vlakken, lijnen en markeringen, niet voor tekst. Een cyaan knop krijgt tekst in Inkt; witte tekst op cyaan alleen in grote, korte koppen op beeld, waar de foto eronder donker is.',
    },

    /* --- Typografie --- */

    type: {
      intro: 'Eén lettertype voor alles: Pure Minds Sans, in print, online en in presentaties.',
      usage: {
        h1: 'Grote titels, één per pagina',
        h2: 'Subtitels en secties',
        h3: 'Tussenkoppen',
        body: 'Lopende tekst, regelhoogte ±1,7',
        small: 'Hints, bronnen, metadata; kleur #5C6670',
        label: 'Overline, hoofdletters',
      },
      notes: [
        'Gewichten in gebruik: Regular 400, Bold 700 en ExtraBold 800 (plus cursief).',
        'Nadruk in een kop: één of twee woorden in Pure Cyaan (op donker) of een cyaan punt achter de kop. Nooit onderstrepen.',
        'Fallback: Open Sans (zelfde vormen) als Pure Minds Sans ergens niet geïnstalleerd is, bijvoorbeeld in Google Slides.',
      ],
      // Uitleg bij een maat als "ExtraBold 800 · 52/58 · −2%", voor wie in Canva werkt (pagina en
      // paneel). Het voorbeeld zelf rekent model.js uit (typeSpec), zodat het nooit afwijkt
      legend: {
        title: 'Zo lees je de maten',
        parts: [
          { key: '800', title: 'Letterdikte', text: 'De dikte van de letter (font weight): 400 is Regular, 700 Bold, 800 ExtraBold. In Canva kies je die stijl bij het lettertype.' },
          { key: '52/58', title: 'Grootte en regelafstand', text: 'Lettergrootte 52, regelafstand 58. In Canva: grootte 52 en regelafstand 1,1 (58 gedeeld door 52).' },
          { key: '−2%', title: 'Letterafstand', text: 'De ruimte tussen de letters (tracking): −2% is iets dichter op elkaar. In Canva en Illustrator: −20.' },
        ],
      },
      alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lower: 'abcdefghijklmnopqrstuvwxyz',
      digits: '0123456789 € % & @ ? ! ( ) . , : ;',
    },

    /* --- Beeld --- */

    imagery: {
      intro: 'Afgeleid van de social posts: standaard foto, foto met tekst, blog-, case- en carouselpost. De rode draad: echt werk, echte mensen, rustig beeld met ruimte voor tekst.',
      sections: [
        { id: 'onderwerp', title: 'Wat we fotograferen', items: [
          'Werk in uitvoering: handen op een laptop, een scherm met data, een whiteboard, een overleg aan tafel.',
          'Mensen van de klant en van Pure Minds, in hun eigen omgeving (showroom, werkplaats, kantoor).',
          'Resultaat: het product of het project van de klant, zoals het er echt uitziet.',
          'Detail boven overzicht: dichtbij, met één duidelijk onderwerp.',
        ] },
        { id: 'sfeer', title: 'Sfeer en techniek', items: [
          'Licht: natuurlijk en warm, liefst daglicht van opzij. Geen flits, geen harde studiobelichting.',
          'Diepte: kleine scherptediepte, zodat de achtergrond zacht wordt en tekst er goed op leest.',
          'Compositie: onderwerp uit het midden; laat een rustige kant vrij voor de kop.',
          'Kleur: natuurgetrouw, licht warm. Cyaan komt uit de vormgeving (balk, zeshoek, accentwoord), niet uit een filter.',
        ] },
        { id: 'tekst', title: 'Tekst op beeld', items: [
          'Leg onder de tekst een donker verloop van Inkt (onderste 40–60% van de foto). Witte kop, accentwoorden in cyaan.',
          'Foto’s in een zeshoekkader alleen als ondersteunend beeld (cover, case); de hoofdfoto vult het vlak.',
          'Resultaten als groot cijfer in cyaan (“+184%”) met één regel uitleg.',
        ] },
        { id: 'vermijden', title: 'Vermijden', items: [
          'Stockclichés: handdrukken, mensen die naar een leeg scherm wijzen, pijlen die omhoog gaan, gloeiende hersenen.',
          'AI-beelden van mensen of producten die niet bestaan.',
          'Zware filters, vignettering, zwart-wit als effect.',
          'Logo’s van andere merken groot in beeld, tenzij het om de klant gaat (zoals Google bij een Ads-post).',
        ] },
      ],
      // De drie voorbeelden op de pagina, elk op een echte foto (js/styleguide/mockups.js); de
      // tekst erop is echte tekst. photoNote: waar de foto's vandaan komen
      photoNote: 'Voorbeeldfoto’s via Unsplash; de fotografen staan in het colofon. In je eigen ontwerp: echte foto’s van de klant of van Pure Minds.',
      frames: [
        { id: 'compositie', title: 'Onderwerp uit het midden', text: 'Een rustige kant voor de kop.' },
        { id: 'tekst', title: 'Tekst op beeld', text: 'Witte kop op het donkere deel.' },
        { id: 'cijfer', title: 'Resultaat als cijfer', text: 'Groot in cyaan, één regel uitleg.' },
      ],
      checks: [
        'Echt werk of echte mensen, geen stockfoto',
        'Natuurlijk licht, geen flits',
        'Eén duidelijk onderwerp, dichtbij',
        'Een rustige kant vrij voor de kop',
        'Natuurgetrouwe kleur, geen zwaar filter',
        'Geen andere merken groot in beeld',
      ],
    },

    /* --- Iconen --- */

    icons: {
      intro: 'Iconen komen uit één set: Remix Icon. Altijd de lijnstijl (Line), los of in de zeshoek, in een effen huiskleur. Uitgesneden in een witte zeshoek gebruik je alleen de volle stijl (Solid/Fill).',
      rules: [
        'Standaard de lijnstijl (Line) van Remix Icon, uit één set. Geen iconen van andere sets ernaast.',
        'Uitgesneden in een witte zeshoek: alleen de volle stijl (Solid/Fill) van hetzelfde icoon, nooit de lijnstijl.',
        'In de zeshoek: cyaan (de huisvariant), donker of magenta met een wit lijnicoon, of wit op een donkere ondergrond.',
        'Los: in Inkt, cyaan, blauw, magenta of wit.',
        'Punt boven en afgeronde hoeken van 12% van de straal, net als de icoonhouders in onze templates.',
        'Magenta alleen bij de hoofdactie, zoals een knop of cta.',
        'Niet kleiner dan 24 px: op die maat zijn de lijnen getekend.',
      ],
      // Mappen in assets/icons/Zeshoek, met de preset uit js/icons/hex.js
      variants: [
        { preset: 'cyaan', name: 'Cyaan zeshoek', sub: 'wit lijnicoon · de huisvariant', folder: 'Cyaan zeshoek - wit icoon' },
        { preset: 'donker', name: 'Donkere zeshoek', sub: 'wit lijnicoon', folder: 'Donkere zeshoek - wit icoon' },
        { preset: 'magenta', name: 'Magenta zeshoek', sub: 'wit lijnicoon · hoofdactie', folder: 'Magenta zeshoek - wit icoon' },
        { preset: 'wit', name: 'Witte zeshoek', sub: 'uitgesneden, volle stijl · op donker', folder: 'Witte zeshoek - doorzichtig icoon' },
      ],
      loose: ['inkt', 'cyaan', 'blauw', 'magenta', 'wit'],
      sample: ['line-chart', 'megaphone', 'lightbulb', 'team', 'search', 'mail'],
      // De pagina in twee groepen: alles in de lijnstijl, en apart de witte zeshoek uitgesneden (vol)
      groups: {
        line: { title: 'Lijnstijl (Line)', sub: 'cyaan, donker en magenta zeshoek, en los' },
        fill: { title: 'Volle stijl (Fill)', sub: 'alleen uitgesneden in de witte zeshoek' },
      },
      // Wel en niet bij de lijnstijl: hetzelfde icoon in de cyane zeshoek en los, in lijn en vol
      lineCheck: { icon: 'team', title: 'Wel en niet', sub: 'lijn wel, vol niet' },
      // Wel en niet bij de witte zeshoek: hetzelfde icoon uitgesneden in de volle stijl en in de lijnstijl
      knockout: { icon: 'team', title: 'Wel en niet', sub: 'vol wel, lijn niet', wel: 'Volle stijl (Fill): rustig en snel herkenbaar.', niet: 'Lijnstijl (Line): het wit slokt de dunne lijnen op.' },
      // Waarom uitgesneden alleen vol: kort, voor wie geen ontwerper is
      why: {
        title: 'Waarom uitgesneden vol',
        items: [
          { title: 'Optische uitloop', text: 'het wit slokt dunne lijnen op.' },
          { title: 'Rust', text: 'minder kleine randjes.' },
          { title: 'Herkenbaarheid', text: 'meer massa, sneller gezien.' },
        ],
      },
    },

    /* --- Gebruik --- */

    usage: {
      intro: 'Zo ziet de huisstijl eruit in de praktijk. Begin altijd vanuit een bestaand template, niet met een leeg bestand.',
      makers: [
        { id: 'insta', name: 'Social posts', tool: 'Insta Post Maker', format: '4:5', text: 'Vijf templates: standaard foto, foto met tekst, blog, case en carousel. Cyaan balk, label met zeshoek, logo rechtsonder.', formats: ['standaard foto', 'foto met tekst', 'blog', 'case', 'carousel'] },
        { id: 'document', name: 'Documenten', tool: 'Document Maker', format: 'A4', text: 'Brief, offerte, memo en notitie op het A4-briefpapier: cyaan balk, het logo in Inkt linksboven, de afzender rechts en de bedrijfsgegevens in de voetregel.' },
        { id: 'presentation', name: 'Presentaties', tool: 'Presentation Maker', format: '16:9', text: 'Slides, voorstellen en positioneringen in 16:9. Het logo staat op elke slide rechtsonder, op dezelfde plek.' },
      ],
      badge: {
        title: 'Emerce 100-badge',
        intro: 'Pure Minds staat in de Emerce 100, de lijst met de beste e-businessbedrijven van Nederland. De badge is een keurmerk, geen tweede logo.',
        rules: [
          'Wit op donker, zwart op licht; nooit in een andere kleur.',
          'Klein en ondergeschikt aan het logo: in de voetregel van slides en briefpapier, linksonder op posts.',
          'Alleen de officiële bestanden van Emerce, in hun eigen verhouding.',
          'Buiten de clear space van het logo, en één badge per ontwerp.',
        ],
      },
      // De brief zoals de Document Maker hem begint (js/document/model.js EXAMPLE en de standaardtitel
      // in js/document/app.js); de datum als invulplek. tests/styleguide.test.js houdt hem gelijk
      letter: {
        label: 'brief',
        title: 'Voorstel voor de samenwerking',
        date: '[datum]',
        recipient: ['Naam contactpersoon', 'Bedrijfsnaam', 'Straat 1', '1234 AB Plaats'],
        salutation: 'Beste [naam],',
        intro: 'Bedankt voor het prettige gesprek van afgelopen week. In dit document zetten we op een rij wat we voor jullie gaan doen en wat je van ons mag verwachten.',
        heading: 'Onze aanpak',
        bullets: [
          'We starten met een analyse van de huidige campagnes en de landingspagina\'s.',
          'Daarna maken we een plan met **concrete doelen per kanaal**.',
          'Elke maand bespreken we de resultaten en stellen we bij.',
        ],
        outro: 'Heb je vragen of wil je iets aanpassen? Laat het ons weten, dan passen we het voorstel aan.',
        closing: 'Met vriendelijke groet,',
        signature: 'Pure Minds Marketing Group',
      },
      // De voorbeeldteksten van de Insta Post Maker (js/insta/app.js, defaults), letterlijk; de
      // carousel staat op slide 2. Niet in de zoekindex: het zijn voorbeelden, geen regels
      demo: {
        posts: {
          photo: { style: 'full', label: '' },
          overlay: {
            label: '',
            title: 'Onze nieuwe **Google Ads-audit** is live',
            subtitle: 'In twee weken weet je precies waar je advertentiebudget weglekt.',
            strength: 80,
            position: 'bottom',
            decor: true,
            titleSize: 'normaal',
          },
          blog: {
            label: 'pure blog',
            title: '5 signalen dat je landingspagina conversies laat liggen',
            topic: 'conversie-optimalisatie',
            cta: 'Lees onze nieuwe blog over {onderwerp} op de website.',
            button: 'lees de blog',
            titleSize: 'normaal',
          },
          case: {
            label: 'pure case',
            client: 'Studio Noord',
            services: ['Google Ads', 'een nieuwe landingspagina', ''],
            sentence: 'Voor {klant} hebben wij {diensten} gedaan.',
            resultValue: '+184%',
            resultLabel: 'meer aanvragen binnen drie maanden',
            photoBg: false,
            titleSize: 'normaal',
          },
          carousel: {
            label: 'pure kennis',
            active: 1,
            titleSize: 'normaal',
            slides: [
              { title: 'Zo schrijf je een advertentie die wél klikt', body: 'Vijf lessen uit honderden Google Ads-accounts. Swipe mee.', last: false },
              { title: 'Begin met het zoekwoord', body: 'Laat het **zoekwoord** terugkomen in je eerste kop.\n- herkenbaar voor de zoeker\n- hogere kwaliteitsscore\n- lagere klikprijs', last: false },
              { title: 'Hulp nodig bij je campagnes?', body: 'Plan een gratis adviesgesprek via **pureminds.nl**.', last: true },
            ],
          },
        },
      },
    },

    // Het colofon: tijdloos, zonder versie of datum. {fotografen} vult model.js in (photoCredits)
    colophon: {
      about: 'Dit brandbook beschrijft de huisstijl van Pure Minds Marketing Group: wie we zijn, hoe we klinken en hoe we eruitzien. Gebruik het bij alles wat we maken, van een social post tot een voorstel.',
      sources: 'Lettertype: Pure Minds Sans. Iconen: Remix Icon (Remix Icon License v1.0).',
      photos: 'Foto’s: {fotografen}, via Unsplash (Unsplash-licentie).',
      rights: '© Pure Minds Marketing Group. Alle rechten voorbehouden.',
    },
  };

  /* ---------------------------------------------------------------------------
     Hoofdstukken en pagina's. De rail volgt chapters; elke pagina hoort bij één
     hoofdstuk. words: extra zoekwoorden (synoniemen die niet in de tekst staan)
     ------------------------------------------------------------------------- */

  const chapters = [
    { id: 'merk', label: 'Merk', title: 'Merk en tone of voice' },
    { id: 'logo', label: 'Logo', title: 'Logo en zeshoek' },
    { id: 'kleur', label: 'Kleur', title: 'Kleur en 60/30/10' },
    { id: 'type', label: 'Type', title: 'Typografie' },
    { id: 'beeld', label: 'Beeld', title: 'Beeldtaal' },
    { id: 'iconen', label: 'Iconen', title: 'Iconen' },
    { id: 'gebruik', label: 'Gebruik', title: 'Toepassingen' },
  ];

  const pages = [
    { id: 'cover', chapter: 'merk', title: 'Brandbook', words: 'omslag voorkant titel' },
    { id: 'inhoud', chapter: 'merk', title: 'Inhoud', words: 'inhoudsopgave hoofdstukken overzicht' },
    { id: 'missie-visie', chapter: 'merk', title: 'Missie en visie', words: 'missie visie slogan belofte waarom' },
    { id: 'kernwaarden', chapter: 'merk', title: 'Kernwaarden', words: 'waarden authentiek verbonden duurzaam inventief' },
    { id: 'tone-of-voice', chapter: 'merk', title: 'Tone of voice', words: 'toon schrijven je of u jij formeel informeel stem' },
    { id: 'schrijven', chapter: 'merk', title: 'Schrijfregels', words: 'schrijven wel niet voorbeelden emoji hoofdletters getallen bedragen slogan je of u' },
    { id: 'logo', chapter: 'logo', title: 'Het logo', words: 'logo varianten wit zwart inkt primair beeldmerk' },
    { id: 'clear-space', chapter: 'logo', title: 'Clear space en minimum', words: 'clear space veiligheidsmarge vrije ruimte minimum formaat kleinste maat favicon' },
    { id: 'logo-gebruik', chapter: 'logo', title: 'Logo: wel en niet', words: 'dos donts fout vervormen achtergrond kader plek bestanden' },
    { id: 'zeshoek', chapter: 'logo', title: 'De zeshoek', words: 'zeshoek hexagon vorm patroon fotokader echo bullet icoonhouder' },
    { id: 'kleuren', chapter: 'kleur', title: 'Kleuren', words: 'kleur kleuren hex rgb cmyk kleurcode cyaan magenta inkt blauw groen oranje palet' },
    { id: 'kleur-toepassen', chapter: 'kleur', title: '60/30/10 en contrast', words: 'verhouding 60 30 10 contrast leesbaarheid wcag toegankelijkheid' },
    { id: 'typografie', chapter: 'type', title: 'Typografie', words: 'lettertype font pure minds sans open sans gewichten koppen typeschaal' },
    { id: 'beeldtaal', chapter: 'beeld', title: 'Beeldtaal en fotografie', words: 'foto fotografie beeld licht compositie stock filter' },
    { id: 'iconen', chapter: 'iconen', title: 'Iconen', words: 'iconen icoon icon finder remix zeshoek lijnstijl volle stijl line fill uitgesneden' },
    { id: 'toepassingen', chapter: 'gebruik', title: 'Toepassingen', words: 'social posts presentaties slides templates voorbeelden insta post maker presentation maker' },
    { id: 'documenten', chapter: 'gebruik', title: 'Documenten en keurmerk', words: 'documenten brief briefpapier offerte memo notitie document maker emerce badge keurmerk' },
    { id: 'colofon', chapter: 'gebruik', title: 'Colofon', words: 'contact colofon telefoon e-mail website bronnen fotografen unsplash rechten' },
  ];

  /* ---------------------------------------------------------------------------
     Iconen voor de pagina's (24-raster, alleen absolute M, L, H, V, C en Z): d is
     de lijnstijl uit assets/icons (file), fill de volle stijl uit assets/icons/Vol
     (fillFile), alleen voor een uitgesneden icoon in de witte zeshoek. Bij check en
     close zijn beide stijlen gelijk. tests/styleguide.test.js controleert dat ze
     gelijk zijn aan de bestanden.
     ------------------------------------------------------------------------- */

  const iconPaths = {
    'line-chart': {
      file: 'Business/line-chart-line.svg', d: 'M5 3V19H21V21H3V3H5ZM20.2929 6.29289L21.7071 7.70711L16 13.4142L13 10.415L8.70711 14.7071L7.29289 13.2929L13 7.58579L16 10.585L20.2929 6.29289Z',
      fillFile: 'Vol/Business/line-chart-fill.svg', fill: 'M5 3V19H21V21H3V3H5ZM19.9393 5.93934L22.0607 8.06066L16 14.1213L13 11.121L9.06066 15.0607L6.93934 12.9393L13 6.87868L16 9.879L19.9393 5.93934Z',
    },
    megaphone: {
      file: 'Business/megaphone-line.svg', d: 'M9 17C9 17 16 18 19 21H20C20.5523 21 21 20.5523 21 20V13.937C21.8626 13.715 22.5 12.9319 22.5 12C22.5 11.0681 21.8626 10.285 21 10.063V4C21 3.44772 20.5523 3 20 3H19C16 6 9 7 9 7H5C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H6L7 22H9V17ZM11 8.6612C11.6833 8.5146 12.5275 8.31193 13.4393 8.04373C15.1175 7.55014 17.25 6.77262 19 5.57458V18.4254C17.25 17.2274 15.1175 16.4499 13.4393 15.9563C12.5275 15.6881 11.6833 15.4854 11 15.3388V8.6612ZM5 9H9V15H5V9Z',
      fillFile: 'Vol/Business/megaphone-fill.svg', fill: 'M21 10.063V4C21 3.44772 20.5523 3 20 3H19C17.0214 4.97864 13.3027 6.08728 11 6.61281V17.3872C13.3027 17.9127 17.0214 19.0214 19 21H20C20.5523 21 21 20.5523 21 20V13.937C21.8626 13.715 22.5 12.9319 22.5 12 22.5 11.0681 21.8626 10.285 21 10.063ZM5 7C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H6L7 22H9V7H5Z',
    },
    lightbulb: {
      file: 'Others/lightbulb-line.svg', d: 'M9.97308 18H11V13H13V18H14.0269C14.1589 16.7984 14.7721 15.8065 15.7676 14.7226C15.8797 14.6006 16.5988 13.8564 16.6841 13.7501C17.5318 12.6931 18 11.385 18 10C18 6.68629 15.3137 4 12 4C8.68629 4 6 6.68629 6 10C6 11.3843 6.46774 12.6917 7.31462 13.7484C7.40004 13.855 8.12081 14.6012 8.23154 14.7218C9.22766 15.8064 9.84103 16.7984 9.97308 18ZM10 20V21H14V20H10ZM5.75395 14.9992C4.65645 13.6297 4 11.8915 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 11.8925 19.3428 13.6315 18.2443 15.0014C17.624 15.7748 16 17 16 18.5V21C16 22.1046 15.1046 23 14 23H10C8.89543 23 8 22.1046 8 21V18.5C8 17 6.37458 15.7736 5.75395 14.9992Z',
      fillFile: 'Vol/Others/lightbulb-fill.svg', fill: 'M11 18H7.94101C7.64391 16.7274 6.30412 15.6857 5.75395 14.9992C4.65645 13.6297 4 11.8915 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 11.8925 19.3428 13.6315 18.2443 15.0014C17.6944 15.687 16.3558 16.7276 16.059 18H13V13H11V18ZM16 20V21C16 22.1046 15.1046 23 14 23H10C8.89543 23 8 22.1046 8 21V20H16Z',
    },
    team: {
      file: 'User & Faces/team-line.svg', d: 'M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5.5 14C5.77885 14 6.05009 14.0326 6.3101 14.0942C6.14202 14.594 6.03873 15.122 6.00896 15.6693L6 16L6.0007 16.0856C5.88757 16.0456 5.76821 16.0187 5.64446 16.0069L5.5 16C4.7203 16 4.07955 16.5949 4.00687 17.3555L4 17.5V22H2V17.5C2 15.567 3.567 14 5.5 14ZM18.5 14C20.433 14 22 15.567 22 17.5V22H20V17.5C20 16.7203 19.4051 16.0796 18.6445 16.0069L18.5 16C18.3248 16 18.1566 16.03 18.0003 16.0852L18 16C18 15.3343 17.8916 14.694 17.6915 14.0956C17.9499 14.0326 18.2211 14 18.5 14ZM5.5 8C6.88071 8 8 9.11929 8 10.5C8 11.8807 6.88071 13 5.5 13C4.11929 13 3 11.8807 3 10.5C3 9.11929 4.11929 8 5.5 8ZM18.5 8C19.8807 8 21 9.11929 21 10.5C21 11.8807 19.8807 13 18.5 13C17.1193 13 16 11.8807 16 10.5C16 9.11929 17.1193 8 18.5 8ZM5.5 10C5.22386 10 5 10.2239 5 10.5C5 10.7761 5.22386 11 5.5 11C5.77614 11 6 10.7761 6 10.5C6 10.2239 5.77614 10 5.5 10ZM18.5 10C18.2239 10 18 10.2239 18 10.5C18 10.7761 18.2239 11 18.5 11C18.7761 11 19 10.7761 19 10.5C19 10.2239 18.7761 10 18.5 10ZM12 2C14.2091 2 16 3.79086 16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2ZM12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z',
      fillFile: 'Vol/User & Faces/team-fill.svg', fill: 'M12 10C14.2091 10 16 8.20914 16 6 16 3.79086 14.2091 2 12 2 9.79086 2 8 3.79086 8 6 8 8.20914 9.79086 10 12 10ZM5.5 13C6.88071 13 8 11.8807 8 10.5 8 9.11929 6.88071 8 5.5 8 4.11929 8 3 9.11929 3 10.5 3 11.8807 4.11929 13 5.5 13ZM21 10.5C21 11.8807 19.8807 13 18.5 13 17.1193 13 16 11.8807 16 10.5 16 9.11929 17.1193 8 18.5 8 19.8807 8 21 9.11929 21 10.5ZM12 11C14.7614 11 17 13.2386 17 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5 15.9999C5 15.307 5.10067 14.6376 5.28818 14.0056L5.11864 14.0204C3.36503 14.2104 2 15.6958 2 17.4999V21.9999H5V15.9999ZM22 21.9999V17.4999C22 15.6378 20.5459 14.1153 18.7118 14.0056 18.8993 14.6376 19 15.307 19 15.9999V21.9999H22Z',
    },
    search: {
      file: 'System/search-line.svg', d: 'M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z',
      fillFile: 'Vol/System/search-fill.svg', fill: 'M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168Z',
    },
    mail: {
      file: 'Business/mail-line.svg', d: 'M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM20 7.23792L12.0718 14.338L4 7.21594V19H20V7.23792ZM4.51146 5L12.0619 11.662L19.501 5H4.51146Z',
      fillFile: 'Vol/Business/mail-fill.svg', fill: 'M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM12.0606 11.6829L5.64722 6.2377L4.35278 7.7623L12.0731 14.3171L19.6544 7.75616L18.3456 6.24384L12.0606 11.6829Z',
    },
    phone: {
      file: 'Device/phone-line.svg', d: 'M9.36556 10.6821C10.302 12.3288 11.6712 13.698 13.3179 14.6344L14.2024 13.3961C14.4965 12.9845 15.0516 12.8573 15.4956 13.0998C16.9024 13.8683 18.4571 14.3353 20.0789 14.4637C20.599 14.5049 21 14.9389 21 15.4606V19.9234C21 20.4361 20.6122 20.8657 20.1022 20.9181C19.5723 20.9726 19.0377 21 18.5 21C9.93959 21 3 14.0604 3 5.5C3 4.96227 3.02742 4.42771 3.08189 3.89776C3.1343 3.38775 3.56394 3 4.07665 3H8.53942C9.0611 3 9.49513 3.40104 9.5363 3.92109C9.66467 5.54288 10.1317 7.09764 10.9002 8.50444C11.1427 8.9484 11.0155 9.50354 10.6039 9.79757L9.36556 10.6821ZM6.84425 10.0252L8.7442 8.66809C8.20547 7.50514 7.83628 6.27183 7.64727 5H5.00907C5.00303 5.16632 5 5.333 5 5.5C5 12.9558 11.0442 19 18.5 19C18.667 19 18.8337 18.997 19 18.9909V16.3527C17.7282 16.1637 16.4949 15.7945 15.3319 15.2558L13.9748 17.1558C13.4258 16.9425 12.8956 16.6915 12.3874 16.4061L12.3293 16.373C10.3697 15.2587 8.74134 13.6303 7.627 11.6707L7.59394 11.6126C7.30849 11.1044 7.05754 10.5742 6.84425 10.0252Z',
      fillFile: 'Vol/Device/phone-fill.svg', fill: 'M21 16.42V19.9561C21 20.4811 20.5941 20.9167 20.0705 20.9537C19.6331 20.9846 19.2763 21 19 21C10.1634 21 3 13.8366 3 5C3 4.72371 3.01545 4.36687 3.04635 3.9295C3.08337 3.40588 3.51894 3 4.04386 3H7.5801C7.83678 3 8.05176 3.19442 8.07753 3.4498C8.10067 3.67907 8.12218 3.86314 8.14207 4.00202C8.34435 5.41472 8.75753 6.75936 9.3487 8.00303C9.44359 8.20265 9.38171 8.44159 9.20185 8.57006L7.04355 10.1118C8.35752 13.1811 10.8189 15.6425 13.8882 16.9565L15.4271 14.8019C15.5572 14.6199 15.799 14.5573 16.001 14.6532C17.2446 15.2439 18.5891 15.6566 20.0016 15.8584C20.1396 15.8782 20.3225 15.8995 20.5502 15.9225C20.8056 15.9483 21 16.1633 21 16.42Z',
    },
    global: {
      file: 'Business/global-line.svg', d: 'M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM9.71002 19.6674C8.74743 17.6259 8.15732 15.3742 8.02731 13H4.06189C4.458 16.1765 6.71639 18.7747 9.71002 19.6674ZM10.0307 13C10.1811 15.4388 10.8778 17.7297 12 19.752C13.1222 17.7297 13.8189 15.4388 13.9693 13H10.0307ZM19.9381 13H15.9727C15.8427 15.3742 15.2526 17.6259 14.29 19.6674C17.2836 18.7747 19.542 16.1765 19.9381 13ZM4.06189 11H8.02731C8.15732 8.62577 8.74743 6.37407 9.71002 4.33256C6.71639 5.22533 4.458 7.8235 4.06189 11ZM10.0307 11H13.9693C13.8189 8.56122 13.1222 6.27025 12 4.24799C10.8778 6.27025 10.1811 8.56122 10.0307 11ZM14.29 4.33256C15.2526 6.37407 15.8427 8.62577 15.9727 11H19.9381C19.542 7.8235 17.2836 5.22533 14.29 4.33256Z',
      fillFile: 'Vol/Business/global-fill.svg', fill: 'M2.04932 12.9999H7.52725C7.70624 16.2688 8.7574 19.3053 10.452 21.8809C5.98761 21.1871 2.5001 17.5402 2.04932 12.9999ZM2.04932 10.9999C2.5001 6.45968 5.98761 2.81276 10.452 2.11902C8.7574 4.69456 7.70624 7.73111 7.52725 10.9999H2.04932ZM21.9506 10.9999H16.4726C16.2936 7.73111 15.2425 4.69456 13.5479 2.11902C18.0123 2.81276 21.4998 6.45968 21.9506 10.9999ZM21.9506 12.9999C21.4998 17.5402 18.0123 21.1871 13.5479 21.8809C15.2425 19.3053 16.2936 16.2688 16.4726 12.9999H21.9506ZM9.53068 12.9999H14.4692C14.2976 15.7828 13.4146 18.3732 11.9999 20.5915C10.5852 18.3732 9.70229 15.7828 9.53068 12.9999ZM9.53068 10.9999C9.70229 8.21709 10.5852 5.62672 11.9999 3.40841C13.4146 5.62672 14.2976 8.21709 14.4692 10.9999H9.53068Z',
    },
    image: {
      file: 'Media/image-line.svg', d: 'M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z',
      fillFile: 'Vol/Media/image-fill.svg', fill: 'M20 5H4V19L13.2923 9.70649C13.6828 9.31595 14.3159 9.31591 14.7065 9.70641L20 15.0104V5ZM2 3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918C2.44405 21 2 20.5551 2 20.0066V3.9934ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z',
    },
    check: {
      file: 'System/check-line.svg', d: 'M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z',
      fillFile: 'Vol/System/check-fill.svg', fill: 'M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z',
    },
    close: {
      file: 'System/close-line.svg', d: 'M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z',
      fillFile: 'Vol/System/close-fill.svg', fill: 'M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z',
    },
  };

  /* ---------------------------------------------------------------------------
     Voorbeeldfoto's (Unsplash-licentie): het bestand, de fotograaf (in het
     colofon) en de pagina op Unsplash. Waar elke foto staat en hoe hij is
     uitgesneden, staat in js/styleguide/mockups.js (SLOTS). Vervangen: zie
     assets/styleguide/photos/LEESMIJ.txt
     ------------------------------------------------------------------------- */

  const photos = [
    { id: 'laptop-raam', file: 'assets/styleguide/photos/laptop-raam.jpg', by: 'Anastasiia Nelen', url: 'https://unsplash.com/photos/Ki_pIEtS6pk' },
    { id: 'team-overleg', file: 'assets/styleguide/photos/team-overleg.jpg', by: 'Andreea Avramescu', url: 'https://unsplash.com/photos/wR56AUlEsE4' },
    { id: 'analytics-scherm', file: 'assets/styleguide/photos/analytics-scherm.jpg', by: 'Campaign Creators', url: 'https://unsplash.com/photos/pypeCEaJeZY' },
    { id: 'werkplek-bureau', file: 'assets/styleguide/photos/werkplek-bureau.jpg', by: 'Andrew Neel', url: 'https://unsplash.com/photos/cckf4TsHAuw' },
    { id: 'vakman-werkplaats', file: 'assets/styleguide/photos/vakman-werkplaats.jpg', by: 'Ali Mkumbwa', url: 'https://unsplash.com/photos/PxlKOcj0a3Q' },
    { id: 'bloemist', file: 'assets/styleguide/photos/bloemist.jpg', by: 'Waldemar Brandt', url: 'https://unsplash.com/photos/q3RGXuBc_SU' },
  ];

  const CONTENT = { ...C, chapters, pages, iconPaths, photos };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT;
  if (global && global.document) global.PM_BRAND_CONTENT = CONTENT;
})(typeof window !== 'undefined' ? window : globalThis);
