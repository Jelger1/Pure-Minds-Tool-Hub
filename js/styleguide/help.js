/* =============================================================================
   styleguide/help.js — uitleg, rondleiding en sneltoetsen van de Brand Styleguide
   -----------------------------------------------------------------------------
   Alleen tekst, geen gedrag. Alles hangt onder window.PM_HELP.styleguide:

     sections  de hoofdstukken in de zijbalk, van boven naar beneden: id, label
               (één woord onder het icoon), title (kop van het paneel) en icon
               (Remix-icoon uit assets/icons, de -line-variant). Gelijk aan de
               hoofdstukken in js/styleguide/content.js.
     help      de uitleg achter een [?]; de sleutel is data-help="<sleutel>" in
               tools/styleguide.html.
     tour      de rondleiding; target is data-tour="<target>" in de HTML,
               section opent eerst dat paneel. doe: 'click' of 'input' op het
               doel, of signal 'kopieer' (een kleurwaarde gekopieerd).
     keys      het venster met sneltoetsen. Ctrl is op een Mac de Cmd-toets.

   Schrijfwijze: je-vorm, korte zinnen, knoppen in kleine letters zoals in de
   tool, uitleg hoogstens 40 woorden, een stap hoogstens 35, een titel hoogstens 5.
   ============================================================================= */
(window.PM_HELP = window.PM_HELP || {}).styleguide = {

  sections: [
    { id: 'merk', label: 'Merk', title: 'Merk en tone of voice', icon: 'compass-3-line' },
    { id: 'logo', label: 'Logo', title: 'Logo en zeshoek', icon: 'hexagon-line' },
    { id: 'kleur', label: 'Kleur', title: 'Kleur en 60/30/10', icon: 'palette-line' },
    { id: 'type', label: 'Type', title: 'Typografie', icon: 'font-size' },
    { id: 'beeld', label: 'Beeld', title: 'Beeldtaal', icon: 'image-line' },
    { id: 'iconen', label: 'Iconen', title: 'Iconen', icon: 'shapes-line' },
    { id: 'gebruik', label: 'Gebruik', title: 'Toepassingen', icon: 'layout-masonry-line' },
  ],

  help: {
    'exporteer': {
      title: 'Het brandbook als PDF',
      text: 'Eén bewerkbare PDF van alle pagina’s: echte tekst in Pure Minds Sans, vormen en logo als vector, in vijf lagen. Opent los in Canva (zet Pure Minds Sans in de Brand Kit) en in Illustrator.',
    },
    'teksten': {
      title: 'Teksten kopiëren',
      text: 'Kopieer de naam, slogan, missie en visie precies zoals ze in het brandbook staan. Zo staat er nergens een eigen versie.',
    },
    'je-of-u': {
      title: 'Je of u?',
      text: 'Altijd je en jij, ook in offertes. U alleen als de klant daar zelf om vraagt, zoals bij de overheid of in de zorg.',
    },
    'clear-space': {
      title: 'Clear space',
      text: 'Rond het logo blijft aan alle kanten een kwart van de logobreedte vrij: geen tekst, rand of vorm. Zet hem aan om de zone op elke pagina te zien.',
    },
    'minimum': {
      title: 'Minimum formaat',
      text: 'Het logo is minstens 80 px breed op een scherm en 20 mm in print. Kleiner leest "marketing group" niet meer. Voor een favicon gebruik je favicon.png.',
    },
    'logo-bestanden': {
      title: 'Welk bestand?',
      text: 'SVG voor digitaal en print: scherp op elke maat. PNG (2000 px, doorzichtig) alleen als het programma geen SVG kent. Het logo-pakket heeft beide varianten in beide formaten.',
    },
    'kleurwaarden': {
      title: 'HEX, RGB of CMYK',
      text: 'HEX voor web en Canva, RGB voor schermen en PowerPoint, CMYK voor drukwerk. Klik een waarde om hem te kopiëren. Laat CMYK bij belangrijk drukwerk door de drukker controleren.',
    },
    'contrast': {
      title: 'Contrast',
      text: 'Gewone tekst heeft minstens 4,5 : 1 nodig, grote tekst (vanaf 24 px, of 19 px vet) 3 : 1. Zo blijft hij leesbaar voor iedereen, ook op een slecht scherm.',
    },
    'ratio': {
      title: 'De 60/30/10-regel',
      text: '60% wit en neutraal (inclusief Inkt), 30% cyaan, 10% magenta en accenten. Zo blijft magenta de kleur die opvalt: de hoofdactie.',
    },
    'kleurbestanden': {
      title: 'Kleuren voor Adobe',
      text: 'Het ASE-bestand opent in Illustrator, InDesign en Photoshop als stalen: één map RGB voor scherm, één map CMYK voor print. De JSON is voor developers.',
    },
    'typeschaal': {
      title: 'De typeschaal',
      text: 'Maten in px op een scherm van 1440 breed. Kopieer de CSS van een stijl, of alleen het lettertype met Open Sans als vangnet.',
    },
    'fotocheck': {
      title: 'Past deze foto?',
      text: 'Loop een foto langs deze punten voordat je hem gebruikt. Alles aangevinkt? Dan past hij bij de beeldtaal van Pure Minds.',
    },
    'icoonvarianten': {
      title: 'Vier zeshoeken',
      text: 'Cyaan is de huisvariant. Donker en magenta hebben een wit icoon; magenta alleen bij de hoofdactie. Wit met een uitgesneden icoon zet je op een donkere ondergrond.',
    },
    'emerce': {
      title: 'Emerce 100-badge',
      text: 'Een keurmerk, geen tweede logo: klein, buiten de clear space van het logo, wit op donker en zwart op licht. De makers zetten hem op de goede plek.',
    },
  },

  tour: [
    {
      id: 'welkom',
      title: 'Het brandbook, digitaal',
      text: 'Hier staat de hele huisstijl van Pure Minds. Wat je op de pagina’s ziet, exporteer je ook. En alles wat je nodig hebt, kopieer of download je met één klik.',
    },
    {
      id: 'hoofdstukken', target: 'hoofdstukken',
      title: 'Kies een hoofdstuk',
      text: 'Elk hoofdstuk springt naar zijn pagina’s en opent zijn gereedschap: kleuren kopiëren, logo’s downloaden, contrast checken.',
      doe: { event: 'click', hint: 'Klik op een hoofdstuk' },
    },
    {
      id: 'kopieer', section: 'kleur', target: 'kleurwaarden',
      title: 'Kopieer een kleur',
      text: 'Klik op een HEX-, RGB- of CMYK-waarde: hij staat meteen op je klembord, klaar om te plakken in Canva, PowerPoint of Illustrator.',
      doe: { signal: 'kopieer', hint: 'Klik op een kleurwaarde' },
    },
    {
      id: 'clearspace', section: 'logo', target: 'clearspace',
      title: 'Toon de clear space',
      text: 'Zet de clear space aan: om elk logo in het brandbook verschijnt de vrije zone van een kwart logobreedte.',
      doe: { event: 'change', hint: 'Zet de clear space aan' },
    },
    {
      id: 'zoeken', target: 'zoeken',
      title: 'Zoek in het brandbook',
      text: 'Typ bijvoorbeeld magenta, clear space of je of u. Een resultaat brengt je naar de juiste pagina.',
      doe: { event: 'input', min: 3, hint: 'Typ een zoekwoord' },
    },
    {
      id: 'export', target: 'export',
      title: 'Exporteer het brandbook',
      text: 'exporteer brandbook maakt één bewerkbare PDF voor Canva en Illustrator. Het pijltje heeft een PDF per hoofdstuk, het logo-pakket en de kleuren voor Adobe.',
    },
    {
      id: 'klaar',
      title: 'Je kent de weg',
      text: 'De rondleiding en de sneltoetsen vind je terug in het hulpmenu rechtsboven. Tip: druk op / om meteen te zoeken.',
    },
  ],

  keys: [
    ['/', 'zoeken in het brandbook'],
    ['Esc', 'zoekveld leegmaken of paneel sluiten'],
    ['Page Up / Page Down', 'vorige of volgende pagina'],
    ['Home / End', 'eerste of laatste pagina'],
    ['Ctrl + S', 'het brandbook exporteren als pdf'],
    ['?', 'dit overzicht'],
  ],
};
