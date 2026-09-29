/* =============================================================================
   presentation/help.js — uitleg, rondleiding en sneltoetsen van de
   Presentation Maker
   -----------------------------------------------------------------------------
   Alleen tekst, geen gedrag. Alles hangt onder window.PM_HELP.presentation:

     sections  de knoppen in de zijbalk, van boven naar beneden: id, label
               (één woord onder het icoon, hoogstens ~10 tekens), title (kop
               van het paneel) en icon (Remix-icoon uit
               assets/icons/<categorie>/<naam>.svg, altijd de -line-variant).
               De strook met slides staat onder de preview, niet in de zijbalk.
     help      de uitleg achter een [?]. De sleutel is gelijk aan
               data-help="<sleutel>" in tools/presentation.html; zonder dat
               attribuut verschijnt de uitleg nergens.
     tour      de rondleiding. target is gelijk aan data-tour="<target>" in
               tools/presentation.html; section opent eerst dat paneel. doe
               laat een stap wachten tot je het echt doet:
                 event 'input' (min = aantal getypte tekens), 'change' of
                 'click' op het doel, of signal '<naam>' dat de tool zelf
                 geeft: 'nadruk', 'foto' en 'download'.
               hint staat bij de stap zolang hij wacht. Is het doel niet
               zichtbaar (geen foto bij een opsomming), dan slaat de
               rondleiding de stap over.
     keys      het venster met sneltoetsen: [toets, wat hij doet]. Ctrl is op
               een Mac de Cmd-toets.

   Aanpassen: verander de tekst tussen de aanhalingstekens en herlaad de tool.
   Een nieuwe [?] of stap werkt pas als het data-attribuut ook in de HTML staat.
   Schrijfwijze: je-vorm, korte zinnen, knoppen in kleine letters zoals in de
   tool (cyaan, + slide), uitleg hoogstens 40 woorden, een stap hoogstens 35,
   een titel hoogstens 5.
   ============================================================================= */
(window.PM_HELP = window.PM_HELP || {}).presentation = {

  sections: [
    { id: 'layout', label: 'Layout', title: 'Layout van deze slide', icon: 'layout-masonry-line' },
    { id: 'inhoud', label: 'Inhoud', title: 'Inhoud van deze slide', icon: 'input-method-line' },
    { id: 'foto', label: 'Foto', title: 'Foto op deze slide', icon: 'image-line' },
    { id: 'presentatie', label: 'Presentatie', title: 'Hele presentatie', icon: 'slideshow-line' },
  ],

  help: {
    // Layout
    'layout': {
      title: 'Layout',
      text: 'Elke layout is een vaste opbouw in de huisstijl, van titelslide tot tabel. De miniaturen tonen je eigen tekst in elke layout. Wissel gerust: je tekst en foto blijven bewaard.',
    },

    // Inhoud
    'citaat-of-cijfer': {
      title: 'Citaat of kerncijfer',
      text: 'Citaat: een uitspraak groot naast een cyaan zeshoek met aanhalingsteken, met naam en functie eronder. Kerncijfer: één getal heel groot in cyaan, zoals +184%, met een toelichting en een bron.',
    },
    'kerncijfer': {
      title: 'Kerncijfer',
      text: 'Hoogstens 12 tekens. Het cijfer wordt zo groot als de slide toelaat en krimpt alleen als het niet past. Kort werkt het sterkst: +184%, 3x of € 2,4 mln.',
    },
    'nadruk': {
      title: 'Nadruk',
      text: 'Selecteer woorden en klik boven de slide op cyaan (of Ctrl + B): in titels en citaten krijgen ze de accentkleur. In de andere velden heet de knop vet. In het veld zie je nadruk als markering.',
    },
    'opsomming': {
      title: 'Punten',
      text: 'Bij Opsomming en de afsluiter wordt elke regel een punt met een cyaan zeshoekje. Bij Beeld + tekst alleen een regel die begint met een streepje en een spatie (- ); een lege regel geeft daar extra ruimte.',
    },
    'label': {
      title: 'Label',
      text: 'Een kort woord linksboven, in hoofdletters met een cyaan zeshoekje, zoals ANALYSE. Een nieuwe slide neemt het label van de vorige over, zodat een hoofdstuk herkenbaar blijft. Leeg laten mag.',
    },
    'tabel': {
      title: 'Tabel',
      text: 'Tot 14 rijen en 8 kolommen. Kolommen met alleen getallen of bedragen lijnen vanzelf rechts uit, en **woord** wordt cyaan. Hoe meer inhoud, hoe kleiner de letter; een lange titel mag daarvoor iets krimpen.',
    },
    'plakken-uit-excel': {
      title: 'Plakken uit Excel',
      text: 'Kopieer cellen in Excel, Google Sheets of Numbers en plak ze in een cel. De tabel vult zich vanaf die cel en groeit mee, tot 14 rijen en 8 kolommen. Wat niet past, valt weg.',
    },
    'kopregel': {
      title: 'Kopregel',
      text: 'De eerste rij wordt de kop van de tabel: vet, op een donker vlak met een cyaan lijn eronder. Zet hem uit als je tabel geen kolomnamen heeft.',
    },
    'eerste-kolom-vet': {
      title: 'Eerste kolom vet',
      text: 'De eerste kolom wordt halfvet en wit, als label per rij, zoals de kanalen in een overzicht per kanaal. Handig als elke rij over iets anders gaat.',
    },

    // Foto
    'foto-in-zeshoek': {
      title: 'Foto in een zeshoek',
      text: 'Op de titelslide en de afsluiter staat je foto rechts in een grote zeshoek. Zonder foto staat daar een compositie van cyaan zeshoeken, dus een foto is optioneel.',
    },
    'foto-kant': {
      title: 'Foto staat',
      text: 'Bij Beeld + tekst vult de foto de linker- of rechterhelft, van boven tot onder, met een cyaan streep in het midden. Rechts krijgt hij onderin een donker verloop, zodat het logo leesbaar blijft.',
    },
    'uitsnede': {
      title: 'Inzoomen en verschuiven',
      text: 'Zoom in tot 300% en sleep de foto op de slide op zijn plek. Of klik op de foto en gebruik de pijltjestoetsen, met Shift in grotere stappen. Elke slide onthoudt zijn eigen uitsnede.',
    },

    // Hele presentatie
    'slidenummers': {
      title: 'Slidenummers',
      text: 'Zet “03 / 07” naast het logo op elke slide. In PowerPoint wordt het een echt slidenummer (“3”), dat vanzelf meetelt als je daar slides verschuift of toevoegt.',
    },
    'cyaan-punt': {
      title: 'Cyaan punt',
      text: 'Zet een cyaan punt achter elke titel, net als in het logo van Pure Minds. Eindigt een titel al op een punt, dan wordt die cyaan; na ?, ! of : komt er geen punt.',
    },

    // Strook met slides onder de slide
    'slides': {
      title: 'Slides',
      text: 'Klik op een slide om hem te bewerken. Naar voren en naar achteren verplaatsen de gekozen slide; slepen kan ook. ← en → bladeren alleen. Hoogstens 40 slides; verwijderen maak je ongedaan in de melding of met Ctrl + Z.',
    },

    // Download
    'download-pdf': {
      title: 'PDF',
      text: 'Eén pagina per slide in 16:9, even groot als in PowerPoint. Tekst en vormen zijn vector, dus scherp op elk scherm. Het beste bestand om te presenteren of te versturen.',
    },
    'powerpoint': {
      title: 'PowerPoint',
      text: 'Om verder te bewerken in PowerPoint of Google Presentaties, met echte tekstvakken. Mist je computer Open Sans, dan kiest PowerPoint een ander lettertype. Voor Google: upload in Drive en kies Bestand → Opslaan als Google Presentaties.',
    },
    'als-afbeelding': {
      title: 'Als afbeelding',
      text: 'Een PNG van deze slide, of een zip met alle slides, voor een mail, LinkedIn of een scherm. Full HD is 1920 × 1080 px; 4K is 3840 × 2160 px, voor grote schermen.',
    },
  },

  tour: [
    {
      id: 'welkom',
      title: 'Maak je eerste presentatie',
      text: 'Je begint niet bij nul: de voorbeeldslides laten zien wat kan. In een paar stappen maak je er je eigen presentatie van. Lettertype, kleuren en logo regelt de tool.',
    },
    {
      id: 'titel', section: 'inhoud', target: 'titel',
      title: 'Typ je titel',
      text: 'Vervang de voorbeeldtitel door die van jou. Hoe langer de titel, hoe kleiner de letter: de huisstijl past hem vanzelf op de slide.',
      doe: { event: 'input', min: 3, hint: 'Typ je titel' },
    },
    {
      id: 'nadruk', section: 'inhoud', target: 'titel',
      title: 'Laat een woord opvallen',
      text: 'Selecteer een of twee woorden in je titel en klik op cyaan. Ze krijgen de accentkleur van Pure Minds, zodat de kern van je verhaal eruit springt.',
      doe: { signal: 'nadruk', hint: 'Selecteer een woord en klik op cyaan' },
    },
    {
      id: 'foto', section: 'foto', target: 'foto',
      title: 'Voeg een foto toe',
      text: 'Sleep een foto op de slide, of klik hier om er een te kiezen. Hij valt vanzelf in de vorm van de layout. Geen foto bij de hand? Sla deze stap over.',
      doe: { signal: 'foto', hint: 'Kies of sleep een foto' },
    },
    {
      id: 'nieuwe-slide', target: 'slide-toevoegen',
      title: 'Voeg een slide toe',
      text: 'Klik op + slide. De nieuwe slide komt na de slide die je nu ziet, en je kiest meteen een layout.',
      doe: { event: 'click', hint: 'Klik op + slide' },
    },
    {
      id: 'layout', section: 'layout', target: 'layout',
      title: 'Kies een layout',
      text: 'Kies hoe je nieuwe slide eruitziet: een opsomming, beeld + tekst, een tabel of een citaat. De miniaturen tonen je eigen tekst in elke layout.',
      doe: { event: 'click', hint: 'Klik op een layout' },
    },
    {
      id: 'slides', target: 'slides',
      title: 'Blader door je slides',
      text: 'Hier staan al je slides. Klik op een slide om hem te bewerken. Verplaatsen doe je met naar voren en naar achteren bij de gekozen slide, of door te slepen.',
      doe: { event: 'click', hint: 'Klik op een andere slide' },
    },
    {
      id: 'download', target: 'download',
      title: 'Download je presentatie',
      text: 'Klik op download pdf. Staat er nog voorbeeldtekst in, dan zie je eerst waar. Het pijltje ernaast heeft PowerPoint (ook voor Google Presentaties) en afbeeldingen.',
      doe: { signal: 'download', hint: 'Klik op download pdf' },
    },
    {
      id: 'klaar',
      title: 'Je presentatie is klaar',
      text: 'Deze rondleiding en de sneltoetsen vind je altijd terug in het ?-menu rechtsboven. Tip: plak een tabel uit Excel of Google Sheets rechtstreeks in de layout Tabel.',
    },
  ],

  keys: [
    ['← →', 'vorige of volgende slide (buiten een tekstveld)'],
    ['Page Up / Page Down', 'vorige of volgende slide'],
    ['Home / End', 'in de strook: eerste of laatste slide'],
    ['Delete', 'in de strook: de gekozen slide verwijderen'],
    ['Enter', 'in de strook: de gekozen slide bewerken'],
    ['Ctrl + B', 'in een tekstveld: cyaan of vet'],
    ['Ctrl + S', 'pdf downloaden'],
    ['Ctrl + V', 'foto plakken op deze slide'],
    ['← ↑ → ↓', 'foto verschuiven (klik eerst op de foto in de preview)'],
    ['Shift + ← ↑ → ↓', 'foto in grotere stappen verschuiven'],
    ['Tab', 'in de tabel: naar de volgende cel'],
    ['Enter', 'in de tabel: naar de cel eronder, of een nieuwe rij'],
    ['Ctrl + Z', 'ongedaan maken'],
    ['Ctrl + Shift + Z', 'opnieuw'],
    ['Alt + F10', 'naar de werkbalk'],
    ['?', 'sneltoetsen tonen'],
  ],
};
