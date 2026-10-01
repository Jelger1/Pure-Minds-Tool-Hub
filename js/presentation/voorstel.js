/* =============================================================================
   presentation/voorstel.js — het voorstel (na het eerste gesprek), zonder DOM
   -----------------------------------------------------------------------------
   Het recept van het voorstel voor js/presentation/generator.js: welke
   slides, in welke volgorde, met welke vaste teksten, en wat het formulier
   Voorstel en Prijzen erop zet (tests/voorstel.test.js). De generator maakt
   er de api van (build, sync, checklist en de rest); dit bestand voegt toe:

     PHASES                      fases krijgen een nummer in het label
     services(input)             "Wat wij gaan doen" volgens de onderdelen
     parsePrices, formatPrice    prijsregels ("GA4-audit: 550") en bedragen
     priceTable, priceOverflow   de investering, en hoeveel regels er niet in passen

   De vakken van de waardepropositie zijn van de slide zelf: je vult ze in
   bij Inhoud, niet in het formulier.

   In de browser: window.PMDecks.voorstel. In Node: require('js/presentation/voorstel.js').
   ============================================================================= */
(function (global) {
  'use strict';

  const G = global.PMGenerator || (typeof require === 'function' ? require('./generator.js') : null);
  // generator.js niet geladen: dan geen voorstel (de app verbergt de tegel en bewaart een opgeslagen voorstel)
  if (!G) return;

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const str = (v) => (typeof v === 'string' ? v : '');
  const text = (v) => String(v == null ? '' : v);
  const lines = (v) => text(v).split(/\r\n|\r|\n/);
  const { oneLine } = G;

  /* ---------------------------------------------------------------------------
     Onderdelen van het voorstel
     ------------------------------------------------------------------------- */

  // De vaste volgorde; ook de plek waar een onderdeel terugkomt
  const ROLES = Object.freeze(['cover', 'belofte', 'situatie', 'gewenst', 'aanpak', 'interview', 'verdieping', 'vpc', 'website', 'ga4', 'gbp', 'uitvoering', 'meetbaar', 'investering', 'slogan']);
  // Aan of uit met een schakelaar (standaardstand); de rest zit er altijd in.
  // sea is geen slide: alleen een regel bij "Wat wij gaan doen"
  const OPTIONAL = Object.freeze({ gewenst: false, vpc: true, website: true, sea: false, ga4: false, gbp: false, uitvoering: true, meetbaar: false });
  // De schakelaars in de volgorde van het formulier
  const PARTS = Object.freeze(['gewenst', 'vpc', 'website', 'sea', 'ga4', 'gbp', 'uitvoering', 'meetbaar']);
  // Fases krijgen een nummer in het label, in deze volgorde; modules niet
  const PHASES = Object.freeze(['interview', 'verdieping', 'website', 'uitvoering']);
  const ROLE_NAMES = Object.freeze({
    cover: 'Titelslide', belofte: 'Onze belofte', situatie: 'Huidige situatie', gewenst: 'Gewenste situatie',
    aanpak: 'Marketingaanpak', interview: 'Interview', verdieping: 'Positioneringsdocument', vpc: 'Waardepropositie',
    website: 'Website', ga4: 'GA4-audit', gbp: 'Google Bedrijfsprofiel', uitvoering: 'Uitvoering',
    meetbaar: 'Meetbaar maken', investering: 'Investering', slogan: 'Slogan',
    sea: 'SEA',   // geen slide, wel een schakelaar (voor meldingen)
  });

  /* ---------------------------------------------------------------------------
     Vaste teksten, letterlijk uit de voorstellen (Speedstar en Eurosit), met
     de taalfouten verbeterd
     ------------------------------------------------------------------------- */

  const TEXT = Object.freeze({
    belofteIntro: 'Waar wij in geloven en elke dag opnieuw aan werken is verankerd in:',
    visie: 'Wij zijn ervan overtuigd dat in de essentie van elke onderneming nog verborgen groeikansen liggen. Met de juiste ondersteuning kunnen deze kansen worden benut, wat leidt tot authentieke groei en duurzame welvaart op eigen kracht.',
    missie: 'Wij helpen ondernemers bij het vinden en benutten van on-aangetapt groeipotentieel.',
    aanpakIntro: (maand) => `Naar aanleiding van het gesprek in ${maand}, hierbij een samenvatting van hetgeen besproken is:`,
    aanpak: (k) => `De voorgestelde marketingaanpak voor ${k} is opgezet als een aanpak met als doel om tot een helder merkverhaal, doelgerichte communicatie en een effectief marketingplan te komen.`,
    interviewMet: (namen, k) => `We starten met een diepgaand interview met ${namen}. Het doel is om inzicht te krijgen in de missie, visie, USP’s, positionering en doelgroepen van ${k}.`,
    interviewZonder: (k) => `Om een duidelijk beeld te hebben van het merkverhaal en de kernwaarden van ${k} willen we een positioneringsinterview houden. Tijdens dit interview gaan we samen op zoek naar de kern van het bedrijf. Daarmee creëren we een verhaal waarmee je je doelgroepen kunt bereiken en raken. Vanuit dit fundament bepalen we verder de strategie. Bovendien dient het als basis voor de te ontwikkelen creatieve concepten: de ‘storytelling’ en je boodschap die je gebruikt op je online kanalen en website.`,
    catalogusLead: 'De vragencatalogus die wordt behandeld in het interview bestaat uit:',
    // " - " scheidt kop en vraag in de layout Genummerd
    catalogus: Object.freeze([
      'Research - Company | Customers | Competitors',
      'Retarget / Positioning - Segmenten',
      'Alternatieven - Marktgeoriënteerde vragen',
      'Eigenschappen - Productgeoriënteerde vragen',
      'Categorie - De juiste omschrijving bepalen',
      'Redefine - Waardepropositie',
    ]),
    vervolgIntro: 'Vervolgvragen die we meenemen om de positionering / het merkverhaal te verdiepen:',
    vervolgvragen: Object.freeze([
      'Pijn - Welke concrete pijn ervaart de klant?',
      'Verlangen - Wat wil de klant wél bereiken?',
      'Trend - Wat gebeurt er in de markt/context dat relevant is?',
      'Alternatief - Wat doet de klant nu als alternatief?',
      'Frustraties alternatief - Wat werkt niet of is onbevredigend aan het alternatief?',
      'Trigger - Wat zet de klant aan tot actie?',
    ]),
    icp: 'Op basis hiervan formuleren we een ideaal klantprofiel (ICP) en leggen we de juiste tone of voice en kernboodschap vast.',
    websiteNieuw: 'De nieuwe website wordt fris en modern en krijgt een krachtige look and feel. Daarnaast richten we de website dan zo in, dat er voldoende mogelijkheden zijn voor conversies.\n\nWanneer de basis (de website) staat, kunnen we de online middelenmix inzetten. Het doel is hier om de doelgroep op verschillende momenten in de klantreis te bereiken. Het aanschaffen van een product of dienst gaat vaak niet over één nacht ijs.',
    websiteOpt: (k) => `Op basis van de gekozen positionering vertalen we de USP’s en waardepropositie van ${k} naar de website. De onderscheidende kracht van ${k} moet op de belangrijkste pagina’s duidelijker naar voren komen, zodat bezoekers direct begrijpen waarom zij voor ${k} moeten kiezen.\n\nDaarnaast brengen we verbeterpunten op het gebied van CRO en UX in kaart. Hierbij kijken we onder andere naar de structuur, navigatie, informatievoorziening, contactmomenten en de route naar een offerteaanvraag.\n\nDe bevindingen verwerken we in een concreet adviesplan met praktische aanbevelingen voor de optimalisatie van de website.`,
    ga4: 'Google Analytics 4 is van grote waarde voor bedrijven om maximaal resultaat en juiste data uit de online strategie te kunnen halen. Maar als je metingen niet goed staan ingesteld, stuur je mogelijk op onvolledige of foutieve data.\n\nOnjuiste data leidt tot verkeerde budgetkeuzes. Een fout in je tracking is vaak het verschil tussen winst en onnodig verlies. Met onze audit controleren we de inrichting en statistieken van je GA4-account.\n\nOp basis van de GA4-audit, waarin we ook de privacyregels en technische knelpunten meenemen, ontvang je een helder adviesrapport met concrete verbeterpunten. Quick fixes worden hierbij direct uitgevoerd.\n\nDe audit vormt daarmee de basis voor een correct meetplan voor de online marketingstrategie.',
    // Speedstar S8 en S9 samengevoegd tot één slide: de signalen als opsomming,
    // de alinea's over content en reviews ingekort tot de laatste twee punten
    gbp: 'Wil je je bedrijf beter zichtbaar maken in Google, dan is het aanmaken van een Google Bedrijfsprofiel een goed begin. Nadat je je Google Bedrijfsprofiel hebt aangemaakt, is het van belang om het **verder te gaan optimaliseren.**\n\n**De vuistregel:** hoe completer je profiel, hoe relevanter je wordt voor Google en je potentiële klant.\n\nSignalen met een directe impact op je ranking:\n- Categoriekeuze, adres en bedrijfsnaam\n- Websitelink, attributen, services en producten\n- Content op je website die klopt met je profiel\n- Reviews: actief verzamelen, op de juiste manier vragen en op elke review reageren',
    uitvoering: (k) => `Na goedkeuring van het voorgestelde plan start de uitvoeringsfase. Pure Minds kan hierin een actieve rol spelen door:\n- Het creëren van visuele content passend bij de merkidentiteit\n- Het (in samenwerking met ${k}) invullen en onderhouden van een contentkalender, met vaste rubrieken en frequentie (aantal per week/maand in overleg)\n- Ondersteuning bij campagnes\n- Inzet van social media, zowel organisch als paid\n\nDeze fase wordt afgestemd op de gekozen strategie, doelen en beschikbare interne capaciteit bij ${k}. We werken hierin nauw samen om zowel korte- als langetermijndoelen te realiseren.\n\nWe gebruiken hiervoor een breed KPI-framework, afhankelijk van de doelstellingen, zoals:\n- Naamsbekendheid\n- Bereik\n- Conversies\n- enz.`,
    meetbaar: 'Wanneer de website af is en de campagnes zijn opgezet en draaien, is het noodzakelijk om te weten wat welk kanaal oplevert. Hiervoor moeten er tools ingesteld worden om websitebezoekers op de website te kunnen monitoren. Welke stappen doorlopen ze, welke conversies?\n\nMet deze input optimaliseren wij de campagnes en bekijken we hoe we het budget zo effectief mogelijk kunnen inzetten. Dit is een noodzakelijke stap om online marketing goed uit te kunnen voeren.\n- Inzicht in het gedrag van bezoekers op de website\n- Meetbaar maken van resultaat\n- Optimaliseren van campagnes',
    slogan: 'WE MIND YOUR BUSINESS,\nFOR YOUR **PEACE OF MIND.**',
  });

  /* ---------------------------------------------------------------------------
     Het formulier (state.form bij een voorstel)
     ------------------------------------------------------------------------- */

  const MAX_LINE = 200;    // invoerveld
  const MAX_AREA = 4000;   // tekstvak
  const MAX_PRICES = 12;   // prijsregels per groep
  const MAX_CELL = 160;    // zoals normalizeTable een cel afkapt; ook de grens van een prijsregel
  const LINE_FIELDS = ['klant', 'datum', 'gesprek', 'traject', 'namen', 'voetnoot'];
  const AREA_FIELDS = ['situatie', 'gewenst', 'diensten', 'websiteNu'];
  const PRICE_FIELDS = ['eenmalig', 'maandelijks'];
  const SOORTEN = ['nieuw', 'optimaliseren'];
  // Paden die het formulier mag gebruiken
  const PATHS = new Set([...LINE_FIELDS, ...AREA_FIELDS, ...PRICE_FIELDS, 'websiteSoort', 'totaal']);

  // Een bedrag kan ook als getal binnenkomen (plakken, oude opslag)
  const cellText = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

  // Prijsregels als [{ label, amount }], zoals de offerteregels van de Document
  // Maker. Een oude tekst ("GA4-audit: 550", één per regel) wordt eerst gelezen.
  // Lege regels blijven staan (je typt ze nog in); de tabel slaat ze over
  function normalizePrices(v) {
    const list = typeof v === 'string' ? parsePrices(v) : Array.isArray(v) ? v : [];
    return list.filter(isObj).slice(0, MAX_PRICES).map((r) => ({
      label: cellText(r.label).slice(0, MAX_CELL),
      amount: cellText(r.amount).slice(0, MAX_CELL),
    }));
  }

  // De eigen velden; de generator zet parts en hidden erachter
  function defaults(datum = '') {
    return {
      klant: '', datum: str(datum).slice(0, MAX_LINE), traject: 'Positionering en merkverhaal', gesprek: '',
      situatie: '', gewenst: '', diensten: '', namen: '', websiteSoort: 'nieuw', websiteNu: '',
      eenmalig: [], maandelijks: [], totaal: false, voetnoot: '',
    };
  }

  // Na laden of ongedaan maken: onbekende sleutels vallen weg, de rest krijgt het goede type.
  // Een oud concept had het canvas (vpc) en het klantlogo (logoKey) in het formulier:
  // die staan nu op de slides zelf, dus die sleutels vallen ook weg
  function normalizeFields(raw, out) {
    for (const k of LINE_FIELDS) if (typeof raw[k] === 'string') out[k] = raw[k].slice(0, MAX_LINE);
    // De standaarddatum alleen als er nog geen datum was: een bewust leeg gemaakte blijft leeg
    if (has(raw, 'datum')) out.datum = str(raw.datum).slice(0, MAX_LINE);
    for (const k of AREA_FIELDS) if (typeof raw[k] === 'string') out[k] = raw[k].slice(0, MAX_AREA);
    for (const k of PRICE_FIELDS) out[k] = normalizePrices(raw[k]);
    if (SOORTEN.includes(raw.websiteSoort)) out.websiteSoort = raw.websiteSoort;
    if (typeof raw.totaal === 'boolean') out.totaal = raw.totaal;
  }

  // Een vinkje kan ook als tekst binnenkomen
  const toBool = (v) => (typeof v === 'string' ? !['', '0', 'false', 'off'].includes(v.trim().toLowerCase()) : !!v);

  function get(inp, path) {
    if (path === 'totaal') return inp.totaal === true;
    if (path === 'websiteSoort') return SOORTEN.includes(inp.websiteSoort) ? inp.websiteSoort : 'nieuw';
    // Een kopie: de app mag hem aanpassen en met set() terugzetten
    if (PRICE_FIELDS.includes(path)) return normalizePrices(inp[path]);
    if (!PATHS.has(path)) return '';
    return str(inp[path]);
  }

  // Geeft false bij een onbekend pad of een waarde die niet mag
  function set(input, path, value) {
    if (!PATHS.has(path)) return false;
    if (path === 'totaal') {
      input.totaal = toBool(value);
      return true;
    }
    // Prijzen: een lijst regels, of tekst als "GA4-audit: 550" (plakken, oude opslag)
    if (PRICE_FIELDS.includes(path)) {
      if (value != null && typeof value !== 'string' && !Array.isArray(value)) return false;
      input[path] = normalizePrices(value == null ? [] : value);
      return true;
    }
    const v = value == null ? '' : String(value);
    if (path === 'websiteSoort') {
      if (!SOORTEN.includes(v)) return false;
      input.websiteSoort = v;
      return true;
    }
    input[path] = v.slice(0, LINE_FIELDS.includes(path) ? MAX_LINE : MAX_AREA);
    return true;
  }

  /* ---------------------------------------------------------------------------
     Van formulier naar slides
     ------------------------------------------------------------------------- */

  function servicesOf(inp, isOn) {
    const list = [
      'Vooronderzoek in interviewvorm voor merkverhaal en positionering',
      'Positioneringsdocument, merkverhaal en tone of voice',
    ];
    if (isOn('website')) list.push(inp.websiteSoort === 'optimaliseren' ? 'Website-optimalisaties op basis van de positionering' : 'Nieuwe website');
    if (isOn('sea')) list.push('SEA-opzet en maandelijkse optimalisaties en monitoring');
    if (isOn('ga4')) list.push('GA4-audit');
    if (isOn('gbp')) list.push('Google Bedrijfsprofiel opzetten en optimaliseren');
    if (isOn('uitvoering')) list.push('Contentplanning en uitvoering');
    if (isOn('meetbaar')) list.push('Meetbaar maken van de resultaten');
    return list;
  }

  // Eigen punten, zonder een streepje dat je er zelf voor typte
  const ownServices = (v) => lines(v).map((l) => l.trim().replace(/^[-–•*]\s+/, '').trim()).filter(Boolean);

  // Klantnaam K, het fasenummer en welke onderdelen aan staan
  function context(inp, api) {
    const phases = PHASES.filter((r) => api.isOn(r));
    return {
      K: oneLine(inp.klant) || '[klantnaam]',
      fase: (role) => `fase ${phases.indexOf(role) + 1}`,
      isOn: api.isOn,
    };
  }

  // Per onderdeel de layout en de velden
  const BUILD = {
    cover: (inp, c) => {
      const datum = oneLine(inp.datum);
      return { layout: 'title', label: 'voorstel', title: `Voorstel **${c.K}**`, subtitle: inp.traject.trim(), meta: datum ? `Pure Minds Marketing Group · ${datum}` : 'Pure Minds Marketing Group', photoFit: 'logo' };
    },
    belofte: () => ({
      layout: 'kolommen', label: 'pure minds marketing group', title: 'Onze belofte', subtitle: TEXT.belofteIntro,
      body: `Onze visie\n${TEXT.visie}\n\nMission statement\n${TEXT.missie}`,
    }),
    situatie: (inp, c) => ({ layout: 'tekst', label: 'uitgangspunt', title: `Huidige situatie **${c.K}**`, body: inp.situatie.trim() || '[beschrijf de huidige situatie]' }),
    gewenst: (inp, c) => ({ layout: 'tekst', label: 'uitgangspunt', title: `Gewenste situatie **${c.K}**`, body: inp.gewenst.trim() || '[beschrijf de gewenste situatie]' }),
    aanpak: (inp, c) => {
      const gesprek = oneLine(inp.gesprek);
      const own = ownServices(inp.diensten);
      const items = own.length ? own : servicesOf(inp, c.isOn);
      // De inleiding over het gesprek staat vet, zoals in de voorstellen
      const body = (gesprek ? `**${TEXT.aanpakIntro(gesprek)}**\n\n` : '')
        + `**Voorgestelde marketingaanpak:**\n${TEXT.aanpak(c.K)}`
        + '\n\n**Wat wij gaan doen:**\n'
        + items.map((i) => `- ${i}`).join('\n');
      return { layout: 'tekst', label: 'voorstel', title: `Voorstel marketingaanpak **${c.K}**`, body };
    },
    interview: (inp, c) => {
      const namen = oneLine(inp.namen);
      return {
        layout: 'vragen', label: c.fase('interview'), title: 'Interview & analyse',
        subtitle: `${namen ? TEXT.interviewMet(namen, c.K) : TEXT.interviewZonder(c.K)}\n**${TEXT.catalogusLead}**`,
        body: TEXT.catalogus.join('\n'),
      };
    },
    verdieping: (inp, c) => ({
      layout: 'vragen', label: c.fase('verdieping'), title: 'Positioneringsdocument en merkverhaal',
      subtitle: TEXT.vervolgIntro, body: `${TEXT.vervolgvragen.join('\n')}\n\n${TEXT.icp}`,
    }),
    // Alleen de layout: de vakken vul je op de slide zelf in (een nieuwe begint leeg)
    vpc: () => ({ layout: 'vpc', label: 'waardepropositie', title: '' }),
    website: (inp, c) => {
      const nu = inp.websiteNu.trim();
      // Een eigen zin zonder punt krijgt er een, anders lopen twee zinnen in elkaar
      const lead = nu && !/[.!?…:]$/.test(nu) ? `${nu}.` : nu;
      return inp.websiteSoort === 'optimaliseren'
        ? { layout: 'tekst', label: c.fase('website'), title: 'Website-optimalisaties', body: (lead ? `${lead}\n\n` : '') + TEXT.websiteOpt(c.K) }
        : { layout: 'tekst', label: c.fase('website'), title: 'Nieuwe website', body: (lead ? `${lead} ` : '') + TEXT.websiteNieuw };
    },
    ga4: () => ({ layout: 'tekst', label: 'meten', title: 'GA4-audit', body: TEXT.ga4 }),
    gbp: () => ({ layout: 'tekst', label: 'lokaal gevonden worden', title: 'Google Bedrijfsprofiel', body: TEXT.gbp }),
    uitvoering: (inp, c) => ({ layout: 'tekst', label: c.fase('uitvoering'), title: 'Uitvoering', body: TEXT.uitvoering(c.K) }),
    meetbaar: () => ({ layout: 'tekst', label: 'meten', title: 'Meetbaar maken van onze inspanningen', body: TEXT.meetbaar }),
    investering: (inp) => ({ layout: 'table', label: 'voorstel', title: 'Investering', table: priceTableOf(inp), subtitle: inp.voetnoot.trim() }),
    slogan: () => ({ layout: 'quote', label: 'pure minds marketing group', style: 'quote', quote: TEXT.slogan, author: '' }),
  };

  // Welke slide een veld van het formulier voedt: de preview springt ernaartoe
  const FEEDS = Object.freeze({
    klant: 'cover', datum: 'cover', traject: 'cover',
    gesprek: 'aanpak', diensten: 'aanpak',
    situatie: 'situatie', gewenst: 'gewenst', namen: 'interview',
    websiteSoort: 'website', websiteNu: 'website',
    eenmalig: 'investering', maandelijks: 'investering', totaal: 'investering', voetnoot: 'investering',
  });

  // Andersom: welk veld van het formulier een veld van de slide vult. Een
  // invulplek los je daar op; typ je hem op de slide weg, dan is het veld van jou.
  // Het canvas staat er niet in: dat vul je bij Inhoud
  const FIELD_OF = Object.freeze({
    cover: { title: 'klant', meta: 'datum', subtitle: 'traject' },
    situatie: { title: 'klant', body: 'situatie' },
    gewenst: { title: 'klant', body: 'gewenst' },
    aanpak: { title: 'klant', body: 'diensten' },
    interview: { subtitle: 'namen' },
    website: { body: 'websiteNu' },
    uitvoering: {},   // vaste tekst: aanpassen doe je bij Inhoud; [klantnaam] wel bij de klantnaam
    investering: { table: 'eenmalig', subtitle: 'voetnoot' },
  });

  /* ---------------------------------------------------------------------------
     Prijzen: een regel "GA4-audit" met 550 wordt in de tabel € 550,-
     ------------------------------------------------------------------------- */

  // Een regel "Totaal …" is vet en de tool telt die groep dan niet zelf op
  const isTotal = (label) => /^totaal/i.test(text(label).replace(/\*\*/g, '').trim());
  // Vet: een Totaal-regel, of een omschrijving helemaal tussen ** (bijv. **Fase 3 & 4** met N.T.B.)
  function isBoldLabel(label) {
    const t = text(label).trim();
    return isTotal(t) || (t.length > 4 && t.startsWith('**') && t.endsWith('**') && !t.slice(2, -2).includes('**'));
  }

  // Tekst naar prijsregels (plakken, of een voorstel van vóór de regels): één post
  // per regel; scheiding is de laatste TAB (uit Excel), anders de laatste dubbele punt
  function parsePrices(value) {
    const out = [];
    for (const raw of lines(value)) {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) continue;
      const tab = line.lastIndexOf('\t');
      const at = tab >= 0 ? tab : line.lastIndexOf(':');
      const label = (at >= 0 ? line.slice(0, at) : line).replace(/\t/g, ' ').trim();
      const amount = at >= 0 ? line.slice(at + 1).trim() : '';
      out.push({ label, amount, bold: isBoldLabel(label) });
    }
    return out;
  }

  // Een bedrag in centen, gelezen zoals parseAmount in js/document/model.js; geen bedrag: null.
  // Eerst de afsluitende ,- (of ,– en ,--) eraf: parseAmount leest "1.500,-" anders als 1,5
  function centsOf(value) {
    const raw = text(value).trim();
    if (!/\d/.test(raw) || !/^[€\s\d.,\-–]+$/.test(raw)) return null;
    let t = raw.replace(/[€\s]/g, '').replace(/,[-–]+$/, '');   // 1.500,- is een heel bedrag
    if (/\d[-–]/.test(t)) return null;                            // 500-750 is een bereik
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');   // 1.250,50
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');     // 1.250 (duizendtallen)
    else t = t.replace(/,/g, '');                                            // 1,250.00 of 1250.5
    const n = parseFloat(t);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  // Duizendtallen met een regex en niet met Intl, zodat Node en elke browser hetzelfde geven
  function euro(cents) {
    const abs = Math.abs(cents);
    const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const rest = abs % 100;
    return `€ ${cents < 0 ? '-' : ''}${whole},${rest ? String(rest).padStart(2, '0') : '-'}`;
  }

  // "1500" wordt "€ 1.500,-", "1250,5" wordt "€ 1.250,50"; tekst als "N.T.B." blijft staan
  function formatPrice(value) {
    const cents = centsOf(value);
    return cents == null ? text(value).trim() : euro(cents);
  }

  const MAX_ROWS = 14;    // TABLE_LIMITS.rows in templates.js
  const GROUPS = [['eenmalig', 'Eenmalig'], ['maandelijks', 'Maandelijks']];
  const bold = (t) => (t ? `**${t.replace(/\*\*/g, '')}**` : '');
  const cell = (t) => t.slice(0, MAX_CELL - 4);   // ruimte voor ** eromheen

  // Alle rijen van de investering, ook wat niet meer in de tabel past
  function priceRows(inp) {
    const cells = [];
    for (const [key, name] of GROUPS) {
      // Een regel zonder omschrijving én zonder bedrag telt niet mee (nog leeg)
      const list = normalizePrices(inp[key]).filter((p) => p.label.trim() || p.amount.trim());
      if (!list.length) continue;
      cells.push([`**${name}**`, '']);
      let sum = 0;
      let count = 0;
      let manual = false;
      for (const p of list) {
        const label = cell(p.label.trim());
        const price = cell(formatPrice(p.amount));
        const total = isTotal(p.label);
        if (total) manual = true;
        cells.push(isBoldLabel(p.label) ? [bold(label), bold(price)] : [label, price]);
        const cents = total ? null : centsOf(p.amount);
        if (cents != null) {
          sum += cents;
          count++;
        }
      }
      // Alleen als Totaal per groep aan staat; zelf een Totaal-regel getypt: dan telt de tool niet op
      if (inp.totaal && count >= 2 && !manual) cells.push([`**Totaal ${name.toLowerCase()}**`, `**${euro(sum)}**`]);
    }
    return cells;
  }

  // Geen kopregel: de groepen Eenmalig en Maandelijks zijn de koppen, zoals in de voorstellen
  function priceTableOf(inp) {
    const cells = priceRows(inp);
    if (!cells.length) cells.push(['**Eenmalig**', ''], ['[omschrijving]', '[bedrag]']);
    return { header: false, firstCol: false, cells: cells.slice(0, MAX_ROWS) };
  }

  /* ---------------------------------------------------------------------------
     Klaar om te versturen? De punten van het voorstel (de generator zet de
     invulplekken en "Alle tekst past" erachter)
     ------------------------------------------------------------------------- */

  // De zes vakken van het canvas (klantsegment en klanttype zijn regels, geen vakken)
  const VAKKEN = Object.keys(G.VPC_INFO);

  function checklist(inp, slides, { isOn, slideOf, written, item }) {
    item('klant', 'Klantnaam ingevuld', !!oneLine(inp.klant), { section: 'voorstel', field: '#pKlant' });
    if (isOn('situatie')) {
      // Ook goed: zelf op de slide geschreven
      const s = slideOf('situatie');
      item('situatie', 'Huidige situatie beschreven', !!inp.situatie.trim() || (s && written(s.body)), { section: 'voorstel', field: '#pSituatie' });
    }
    if (isOn('investering')) {
      // Een bedrag in de prijsregels, of in de tabel op de slide zelf
      const s = slideOf('investering');
      const cells = s && isObj(s.table) && Array.isArray(s.table.cells) ? s.table.cells.filter(Array.isArray) : [];
      const done = PRICE_FIELDS.some((k) => inp[k].some((r) => r.amount.trim())) || cells.some((row) => row.slice(1).some(written));
      item('prijzen', 'Prijzen ingevuld', done, { section: 'prijzen' });
    }
    if (isOn('cover')) {
      const s = slideOf('cover');
      item('logo', 'Klantlogo op de titelslide', !!(s && str(s.photoKey)), { section: 'voorstel', field: '#pLogoBtn' }, { optional: true });
    }
    const vpc = slideOf('vpc');
    // Alleen zolang de slide het canvas toont (een andere layout gekozen: dan niet)
    if (isOn('vpc') && (!vpc || vpc.layout === 'vpc')) {
      const done = !!vpc && isObj(vpc.vpc) && VAKKEN.some((k) => str(vpc.vpc[k]).trim());
      item('canvas', 'Waardepropositie ingevuld', done, { role: 'vpc', section: 'inhoud' }, { hint: 'of zet hem uit bij Onderdelen' });
    }
  }

  const recipe = {
    id: 'voorstel', ROLES, OPTIONAL, PARTS, ROLE_NAMES, TEXT, FEEDS, FIELD_OF, BUILD,
    defaults, normalizeFields, get, set, context, checklist,
    // services en de prijzen lezen het formulier zoals de api het normaliseert
    exports: (api) => ({
      PHASES,
      services: (input) => {
        const inp = api.normalizeInput(input);
        return servicesOf(inp, (r) => api.isOn(inp, r));
      },
      parsePrices,
      formatPrice,
      priceTable: (input) => priceTableOf(api.normalizeInput(input)),
      // Hoeveel rijen er niet meer in de tabel passen (0: alles past); de app waarschuwt dan
      priceOverflow: (input) => Math.max(0, priceRows(api.normalizeInput(input)).length - MAX_ROWS),
    }),
  };

  const api = G.create(recipe);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) (global.PMDecks = global.PMDecks || {}).voorstel = api;
})(typeof window !== 'undefined' ? window : globalThis);
