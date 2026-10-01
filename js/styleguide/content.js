/* =============================================================================
   styleguide/content.js — alle teksten van het brandbook, los van de opmaak
   -----------------------------------------------------------------------------
   Missie, visie en kernwaarden staan er letterlijk in zoals in brandbook v2.0,
   alleen opgeschoond (enkele spaties, "technologiegedreven" aan elkaar).
   "on-aangetapt" blijft zoals het is: zo staat het ook in de voorstellen.
   De rest (tone of voice, regels voor logo, zeshoek, kleur, beeld en iconen)
   is nieuw in 2.1. De pagina's (js/styleguide/pages.js) tekenen deze teksten;
   zoeken (js/styleguide/model.js) doorzoekt ze. Nadruk: **woord** wordt cyaan
   (op donker) of vet.

     chapters   de hoofdstukken, in de volgorde van de rail
     pages      de pagina's: id, hoofdstuk, titel en zoekwoorden
     iconPaths  Remix-iconen (24-raster, uit assets/icons) die de pagina's tekenen

   Geen DOM: dit bestand laadt ook in Node (voor de tests).
   ============================================================================= */
(function (global) {
  'use strict';

  const C = {
    company: 'Pure Minds Marketing Group',
    short: 'Pure Minds',
    domain: 'pureminds.nl',
    slogan: 'We mind your business, for your peace of mind.',
    version: 'Brandbook 2.1',
    date: 'oktober 2026',

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
      intro: 'Pure Minds schrijft informeel-professioneel: zoals een ervaren collega die naast je zit. Warm en direct, maar altijd onderbouwd. We overtuigen met resultaat en uitleg, niet met superlatieven.',
      // pos: waar Pure Minds staat tussen links (0) en rechts (1)
      scales: [
        { left: 'Formeel', right: 'informeel', pos: 0.72, where: 'Informeel, nooit amicaal', practice: 'Altijd je/jij, ook in offertes. U alleen als de klant daar zelf om vraagt (bijvoorbeeld overheid, zorg).' },
        { left: 'Nuchter', right: 'enthousiast', pos: 0.36, where: 'Nuchter met energie', practice: 'Enthousiasme blijkt uit concrete resultaten (“+184% aanvragen in drie maanden”), niet uit uitroeptekens.' },
        { left: 'Overtuigend', right: 'informerend', pos: 0.4, where: 'Overtuigend door uit te leggen', practice: 'Eerst het probleem van de klant, dan wat we doen, dan wat het oplevert.' },
        { left: 'Technisch', right: 'toegankelijk', pos: 0.8, where: 'Toegankelijk', practice: 'Vaktermen alleen als de lezer ze kent; anders één zin uitleg (“GA4, de meetomgeving van Google”).' },
      ],
      rules: [
        'Korte zinnen, actieve vorm. Eén gedachte per zin.',
        'Koppen met een hoofdletter en vaak een cyaan punt erachter (“Onze belofte.”). Knoppen en labels in kleine letters (“analyseer pagina”, “download pdf”).',
        'De naam voluit: Pure Minds Marketing Group (met hoofdletters). In lopende tekst mag Pure Minds. Het webadres altijd klein: pureminds.nl.',
        'Getallen als cijfers bij resultaten (3 maanden, 60%), bedragen als € 1.500,-.',
        'De slogan blijft Engels en ongewijzigd: We mind your business, for your peace of mind.',
        'Geen emoji in documenten en presentaties; op social spaarzaam (hooguit één, nooit in de kop).',
      ],
      examples: [
        { wel: 'We hebben je Google Ads-account doorgelopen. Drie dingen kosten je nu klikken die niets opleveren.', niet: 'Wij hebben uw account aan een uitgebreide, state-of-the-art analyse onderworpen!' },
        { wel: 'Je website staat goed, maar bezoekers vinden de offerteknop niet. Dat lossen we op in fase 1.', niet: 'Wij gaan uw online aanwezigheid naar een next level tillen.' },
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
        { medium: 'Favicon en app-icoon', min: '16–64 px', why: 'Uitzondering: alleen het bestaande favicon (assets/brand/favicon.png), nooit een verkleind logo.' },
      ],
      donts: [
        { id: 'achtergrond', title: 'Geen achtergrond achter het logo', text: 'Zet het logo direct op de foto of het vlak, zonder eigen kader of vlak erachter.' },
        { id: 'vervormen', title: 'Logo niet vervormen', text: 'Altijd in de eigen verhouding schalen; niet uitrekken, kantelen of spiegelen.' },
        { id: 'eroverheen', title: 'Niets over het logo heen', text: 'Ook geen zeshoekjes, badges of tekst in de clear space.' },
      ],
      added: [
        { title: 'Kleur', text: 'Alleen wit of Inkt. Geen cyaan, magenta, verloop of schaduw op het logo.' },
        { title: 'Contrast', text: 'Op een foto alleen waar het rustig is; leg zo nodig een donker verloop onder de rand van de foto, nooit een kader om het logo.' },
        { title: 'Plek', text: 'In documenten rechtsboven of rechtsonder, op slides altijd rechtsonder op dezelfde plek. Eén logo per pagina of slide.' },
        { title: 'Bestanden', text: 'Gebruik altijd de originelen uit de styleguide (SVG voor digitaal en print, PNG alleen als het programma geen SVG kent). Nooit overtrekken of een screenshot gebruiken.' },
      ],
    },

    hexagon: {
      intro: 'De zeshoek komt uit het logo en is het herkenbaarste element na het logo zelf. Zo gebruik je hem goed:',
      rules: [
        { ok: true, text: 'Punt boven, zoals in het logo. Nooit plat liggend.' },
        { ok: true, text: 'Effen cyaan, donker of magenta met een wit icoon, of wit met een uitgesneden icoon.' },
        { ok: false, text: 'Geen verloop en geen blauw (#1B71A8) als vlak.' },
        { ok: false, text: 'Geen rand om een witte zeshoek; zet hem op een donkere of gekleurde ondergrond.' },
      ],
      uses: [
        { id: 'bullet', title: 'Opsommingsteken', text: 'Een klein cyaan zeshoekje vóór een label of bullet (zoals in alle makers).' },
        { id: 'frame', title: 'Fotokader', text: 'Een foto in een zeshoek, eventueel met een tweede, iets verschoven cyaan lijn-zeshoek erachter (de “echo”).' },
        { id: 'holder', title: 'Icoonhouder', text: 'De varianten uit de Icon Finder (assets/icons/Zeshoek/), met afgeronde hoeken van 12% van de straal.' },
        { id: 'pattern', title: 'Patroon', text: 'Een fijn lijnpatroon van zeshoeken op de achtergrond, wit op 4–7% dekking. Nooit als drukke tegelvloer.' },
      ],
    },

    /* --- Kleur --- */

    colors: {
      intro: 'Drie primaire kleuren en vier accenten, met vaste rollen. Effen, altijd: geen verlopen in vormen of zeshoeken.',
      secondaryRule: 'Alleen voor grafieken, datavisualisatie en het onderscheiden van categorieën. Nooit als achtergrond van een hele pagina en nooit voor het logo of een zeshoek.',
      ratio: '60% wit en neutraal (inclusief Inkt), 30% Pure Cyaan en 10% magenta en accenten. Een lichte en een donkere compositie passen dezelfde verhouding toe.',
      ratioParts: { neutral: 'Wit en neutraal', neutralDark: 'Inkt en neutraal', cyaan: 'Pure Cyaan', accent: 'Magenta en accenten' },
      // [tekstkleur, achtergrond, naam] uit de tabel in het bouwplan; de waarden rekent model.js uit
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
      contrastNote: 'Let op: Pure Cyaan werkt als tekstkleur alleen op donker. Op wit is cyaan voor vlakken, lijnen en markeringen, niet voor tekst. Een cyaan knop krijgt tekst in Inkt; witte tekst op cyaan alleen in grote, korte koppen op beeld, waar de foto eronder donker is.',
    },

    /* --- Typografie --- */

    type: {
      intro: 'Eén lettertype voor alles: Pure Minds Sans. De tools laden het als eigen webfont en sluiten het in elke export in.',
      usage: {
        h1: 'Grote titels, één per pagina',
        h2: 'Subtitels en secties',
        h3: 'Tussenkoppen',
        body: 'Lopende tekst, regelhoogte ±1,7',
        small: 'Hints, bronnen, metadata; kleur #5C6670',
        label: 'Overline, hoofdletters',
      },
      notes: [
        'Gewichten in gebruik: Light 300, Regular 400, SemiBold 600, Bold 700, ExtraBold 800 (plus cursief).',
        'Nadruk in een kop: één of twee woorden in Pure Cyaan (op donker) of een cyaan punt achter de kop. Nooit onderstrepen.',
        'Fallback: Open Sans (zelfde vormen) als Pure Minds Sans ergens niet geïnstalleerd is, bijvoorbeeld in Google Slides.',
      ],
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
      // De kaders op de pagina: geen foto's, alleen de opbouw
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
      intro: 'Iconen komen uit de Icon Finder in de Generator Hub: 1.690 lijniconen van Remix Icon, te zoeken in het Nederlands en Engels. Los of in de zeshoek, altijd in een effen huiskleur.',
      rules: [
        'Alleen de lijnstijl, uit één set. Geen iconen van andere sets ernaast.',
        'In de zeshoek: cyaan (de huisvariant), donker of magenta met een wit icoon, of wit met een uitgesneden icoon op een donkere ondergrond.',
        'Los: in Inkt, cyaan, blauw, magenta of wit.',
        'Punt boven en afgeronde hoeken van 12% van de straal, net als de icoonhouders in de makers.',
        'Magenta alleen bij de hoofdactie, zoals een knop of cta.',
        'Niet kleiner dan 24 px: op die maat zijn de lijnen getekend.',
      ],
      // Mappen in assets/icons/Zeshoek, met de preset uit js/icons/hex.js
      variants: [
        { preset: 'cyaan', name: 'Cyaan zeshoek', sub: 'wit icoon · de huisvariant', folder: 'Cyaan zeshoek - wit icoon' },
        { preset: 'donker', name: 'Donkere zeshoek', sub: 'wit icoon', folder: 'Donkere zeshoek - wit icoon' },
        { preset: 'magenta', name: 'Magenta zeshoek', sub: 'wit icoon · hoofdactie', folder: 'Magenta zeshoek - wit icoon' },
        { preset: 'wit', name: 'Witte zeshoek', sub: 'uitgesneden icoon · op donker', folder: 'Witte zeshoek - doorzichtig icoon' },
      ],
      loose: ['inkt', 'cyaan', 'blauw', 'magenta', 'wit'],
      sample: ['line-chart', 'megaphone', 'lightbulb', 'team', 'search', 'mail'],
    },

    /* --- Gebruik --- */

    usage: {
      intro: 'De makers in de Generator Hub passen deze regels vanzelf toe. Begin daar, niet met een leeg bestand.',
      makers: [
        { id: 'insta', name: 'Social posts', tool: 'Insta Post Maker', text: 'Vijf templates: standaard foto, foto met tekst, blog, case en carousel. Cyaan balk, label met zeshoek, logo rechtsonder.', formats: ['standaard foto', 'foto met tekst', 'blog', 'case', 'carousel'] },
        { id: 'document', name: 'Documenten', tool: 'Document Maker', text: 'Brief, offerte, memo en notitie op het A4-briefpapier, met het logo in Inkt rechtsboven.' },
        { id: 'presentation', name: 'Presentaties', tool: 'Presentation Maker', text: 'Slides, voorstellen en positioneringen in 16:9. Het logo staat op elke slide rechtsonder, op dezelfde plek.' },
      ],
      badge: {
        title: 'Emerce 100-badge',
        intro: 'Pure Minds staat in de Emerce 100: de beste e-businessbedrijven van 2026. De badge is een keurmerk, geen tweede logo.',
        rules: [
          'Wit op donker, zwart op licht; nooit in een andere kleur.',
          'Klein en ondergeschikt aan het logo: in de voetregel van slides en briefpapier, linksonder op posts.',
          'Alleen de officiële bestanden (assets/brand/emerce), in hun eigen verhouding.',
          'Buiten de clear space van het logo, en één badge per ontwerp.',
        ],
      },
    },

    colophon: {
      lines: [
        'Brandbook 2.1, oktober 2026. Vervangt brandbook 2.0.',
        'Gemaakt in de Brand Styleguide van de Pure Minds Generator Hub. Deze PDF opent bewerkbaar in Canva en Illustrator.',
        'Lettertype: Pure Minds Sans. Iconen: Remix Icon (Remix Icon License v1.0).',
      ],
      news: [
        'Tone of voice en schrijfregels',
        'Clear space en minimum formaat van het logo',
        'Regels voor de zeshoek en de iconen',
        'Contrast en de 60/30/10-regel',
        'Beeldtaal en fotografie',
        'Medium 500 geschrapt: dat gewicht heeft geen fontbestand',
      ],
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
    { id: 'iconen', chapter: 'iconen', title: 'Iconen', words: 'iconen icoon icon finder remix zeshoek' },
    { id: 'toepassingen', chapter: 'gebruik', title: 'Toepassingen', words: 'social posts documenten presentaties slides emerce badge keurmerk templates' },
    { id: 'colofon', chapter: 'gebruik', title: 'Colofon', words: 'contact colofon versie nieuw' },
  ];

  /* ---------------------------------------------------------------------------
     Iconen voor de pagina's: de -line-varianten uit assets/icons (24-raster,
     alleen absolute M, L, H, V, C en Z). tests/styleguide.test.js controleert
     dat ze gelijk zijn aan de bestanden.
     ------------------------------------------------------------------------- */

  const iconPaths = {
    'line-chart': { file: 'Business/line-chart-line.svg', d: 'M5 3V19H21V21H3V3H5ZM20.2929 6.29289L21.7071 7.70711L16 13.4142L13 10.415L8.70711 14.7071L7.29289 13.2929L13 7.58579L16 10.585L20.2929 6.29289Z' },
    megaphone: { file: 'Business/megaphone-line.svg', d: 'M9 17C9 17 16 18 19 21H20C20.5523 21 21 20.5523 21 20V13.937C21.8626 13.715 22.5 12.9319 22.5 12C22.5 11.0681 21.8626 10.285 21 10.063V4C21 3.44772 20.5523 3 20 3H19C16 6 9 7 9 7H5C3.89543 7 3 7.89543 3 9V15C3 16.1046 3.89543 17 5 17H6L7 22H9V17ZM11 8.6612C11.6833 8.5146 12.5275 8.31193 13.4393 8.04373C15.1175 7.55014 17.25 6.77262 19 5.57458V18.4254C17.25 17.2274 15.1175 16.4499 13.4393 15.9563C12.5275 15.6881 11.6833 15.4854 11 15.3388V8.6612ZM5 9H9V15H5V9Z' },
    lightbulb: { file: 'Others/lightbulb-line.svg', d: 'M9.97308 18H11V13H13V18H14.0269C14.1589 16.7984 14.7721 15.8065 15.7676 14.7226C15.8797 14.6006 16.5988 13.8564 16.6841 13.7501C17.5318 12.6931 18 11.385 18 10C18 6.68629 15.3137 4 12 4C8.68629 4 6 6.68629 6 10C6 11.3843 6.46774 12.6917 7.31462 13.7484C7.40004 13.855 8.12081 14.6012 8.23154 14.7218C9.22766 15.8064 9.84103 16.7984 9.97308 18ZM10 20V21H14V20H10ZM5.75395 14.9992C4.65645 13.6297 4 11.8915 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10C20 11.8925 19.3428 13.6315 18.2443 15.0014C17.624 15.7748 16 17 16 18.5V21C16 22.1046 15.1046 23 14 23H10C8.89543 23 8 22.1046 8 21V18.5C8 17 6.37458 15.7736 5.75395 14.9992Z' },
    team: { file: 'User & Faces/team-line.svg', d: 'M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5.5 14C5.77885 14 6.05009 14.0326 6.3101 14.0942C6.14202 14.594 6.03873 15.122 6.00896 15.6693L6 16L6.0007 16.0856C5.88757 16.0456 5.76821 16.0187 5.64446 16.0069L5.5 16C4.7203 16 4.07955 16.5949 4.00687 17.3555L4 17.5V22H2V17.5C2 15.567 3.567 14 5.5 14ZM18.5 14C20.433 14 22 15.567 22 17.5V22H20V17.5C20 16.7203 19.4051 16.0796 18.6445 16.0069L18.5 16C18.3248 16 18.1566 16.03 18.0003 16.0852L18 16C18 15.3343 17.8916 14.694 17.6915 14.0956C17.9499 14.0326 18.2211 14 18.5 14ZM5.5 8C6.88071 8 8 9.11929 8 10.5C8 11.8807 6.88071 13 5.5 13C4.11929 13 3 11.8807 3 10.5C3 9.11929 4.11929 8 5.5 8ZM18.5 8C19.8807 8 21 9.11929 21 10.5C21 11.8807 19.8807 13 18.5 13C17.1193 13 16 11.8807 16 10.5C16 9.11929 17.1193 8 18.5 8ZM5.5 10C5.22386 10 5 10.2239 5 10.5C5 10.7761 5.22386 11 5.5 11C5.77614 11 6 10.7761 6 10.5C6 10.2239 5.77614 10 5.5 10ZM18.5 10C18.2239 10 18 10.2239 18 10.5C18 10.7761 18.2239 11 18.5 11C18.7761 11 19 10.7761 19 10.5C19 10.2239 18.7761 10 18.5 10ZM12 2C14.2091 2 16 3.79086 16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2ZM12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z' },
    search: { file: 'System/search-line.svg', d: 'M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z' },
    mail: { file: 'Business/mail-line.svg', d: 'M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM20 7.23792L12.0718 14.338L4 7.21594V19H20V7.23792ZM4.51146 5L12.0619 11.662L19.501 5H4.51146Z' },
    image: { file: 'Media/image-line.svg', d: 'M2.9918 21C2.44405 21 2 20.5551 2 20.0066V3.9934C2 3.44476 2.45531 3 2.9918 3H21.0082C21.556 3 22 3.44495 22 3.9934V20.0066C22 20.5552 21.5447 21 21.0082 21H2.9918ZM20 15V5H4V19L14 9L20 15ZM20 17.8284L14 11.8284L6.82843 19H20V17.8284ZM8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11Z' },
    check: { file: 'System/check-line.svg', d: 'M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z' },
    close: { file: 'System/close-line.svg', d: 'M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z' },
  };

  const CONTENT = { ...C, chapters, pages, iconPaths };

  if (typeof module !== 'undefined' && module.exports) module.exports = CONTENT;
  if (global && global.document) global.PM_BRAND_CONTENT = CONTENT;
})(typeof window !== 'undefined' ? window : globalThis);
