/* =============================================================================
   presentation/positionering.js — de positionering (na het traject), zonder DOM
   -----------------------------------------------------------------------------
   Het recept van de positionering voor js/presentation/generator.js
   (tests/positionering.test.js): een titelslide met de vaste inleiding, de
   onderdelen, het business model canvas en de waardepropositie als
   overzicht, per blok een toelichting, en de afsluiter.

   Het formulier (Gegevens) heeft alleen de klantnaam, de datum en het aanbod.
   De blokken van beide canvassen en de toelichting schrijf je per slide, bij
   Inhoud. De toelichting begint met een vraag tussen blokhaken (CONTENT): die
   vervang je door je eigen tekst, en die tekst blijft altijd van jou.

   De opbouw is vast (fixed): alle 22 slides zitten er altijd in, in deze
   volgorde. Niets kan uit, anders klopt de positionering niet meer; een
   oude opgeslagen positionering met iets uit krijgt alles terug, met je tekst.

   In de browser: window.PMDecks.positionering. In Node: require('js/presentation/positionering.js').
   ============================================================================= */
(function (global) {
  'use strict';

  const G = global.PMGenerator || (typeof require === 'function' ? require('./generator.js') : null);
  // generator.js niet geladen: dan geen positionering (de app verbergt de tegel en bewaart een opgeslagen positionering)
  if (!G) return;

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const str = (v) => (typeof v === 'string' ? v : '');
  const { oneLine } = G;

  /* ---------------------------------------------------------------------------
     De slides: vaste volgorde, zoals de positioneringen van EEZZ en Eurosit
     ------------------------------------------------------------------------- */

  // De toelichting: per blok van het canvas een slide [rol, titel, label, canvas, blok of vak]
  const UITLEG = Object.freeze([
    ['bmcPartners', 'Key Partners', 'business model canvas', 'bmc', 'partners'],
    ['bmcActiviteiten', 'Kernactiviteiten', 'business model canvas', 'bmc', 'activiteiten'],
    ['bmcResources', 'Key Resources', 'business model canvas', 'bmc', 'resources'],
    ['bmcProposities', 'Waardeproposities', 'business model canvas', 'bmc', 'proposities'],
    ['bmcRelaties', 'Klantrelaties', 'business model canvas', 'bmc', 'relaties'],
    ['bmcKanalen', 'Kanalen', 'business model canvas', 'bmc', 'kanalen'],
    ['bmcSegmenten', 'Klantsegmenten', 'business model canvas', 'bmc', 'segmenten'],
    ['vpcVerschaffers', 'Voordeelverschaffers', 'waardemap', 'vpc', 'verschaffers'],
    ['vpcProducten', 'Producten & Diensten', 'waardemap', 'vpc', 'producten'],
    ['vpcVerzachters', 'Pijnverzachters', 'waardemap', 'vpc', 'verzachters'],
    ['vpcVoordelen', 'Voordelen', 'klantprofiel', 'vpc', 'voordelen'],
    ['vpcPijnen', 'Pijnpunten', 'klantprofiel', 'vpc', 'pijnen'],
    ['vpcTaken', 'Klanttaken', 'klantprofiel', 'vpc', 'taken'],
  ].map((row) => Object.freeze(row)));
  const UITLEG_BMC = UITLEG.filter((u) => u[3] === 'bmc').map((u) => u[0]);
  const UITLEG_VPC = UITLEG.filter((u) => u[3] === 'vpc').map((u) => u[0]);

  // De vaste volgorde (altijd allemaal); ook de plek waar een oude, geparkeerde slide terugkomt
  const ROLES = Object.freeze([
    'cover', 'agenda',
    'sectieBmc', 'bmc', 'sectieVpc', 'vpc',
    'sectieBmcUitleg', ...UITLEG_BMC,
    'sectieVpcUitleg', ...UITLEG_VPC,
    'afsluiter',
  ]);
  // De tekst van een toelichting laat de generator alleen beginnen: daarna is hij van jou
  const CONTENT = Object.freeze(Object.fromEntries(UITLEG.map(([role]) => [role, Object.freeze(['body'])])));
  // Van de toelichting naar zijn blok op het canvas ("naar het canvas")
  const LINKS = Object.freeze(Object.fromEntries(UITLEG.map(([role, , , canvas, key]) => [role, Object.freeze({ role: canvas, key })])));
  const ROLE_NAMES = Object.freeze({
    cover: 'Titelslide', agenda: 'Onderdelen',
    sectieBmc: 'Sectie Business Model Canvas', bmc: 'Business Model Canvas',
    sectieVpc: 'Sectie Waarde Propositie Canvas', vpc: 'Waarde Propositie Canvas',
    sectieBmcUitleg: 'Sectie toelichting BMC', sectieVpcUitleg: 'Sectie toelichting VPC',
    afsluiter: 'Afsluiter',
    ...Object.fromEntries(UITLEG.map(([role, title]) => [role, title])),
  });
  // De namen van de vakken in deze presentatie: Producten & Diensten zoals op de toelichting
  const VPC_NAMES = Object.freeze(Object.fromEntries(Object.keys(G.VPC_INFO).map((k) => {
    const u = UITLEG.find((row) => row[3] === 'vpc' && row[4] === k);
    return [k, u ? u[1] : G.VPC_INFO[k].name];
  })));

  /* ---------------------------------------------------------------------------
     Vaste teksten, letterlijk uit de positioneringen (EEZZ en Eurosit)
     ------------------------------------------------------------------------- */

  // Het einde van een zin: één punt, ook na een naam die er al op eindigt (Groep B.V.)
  const zin = (k) => (/[.!?]$/.test(k) ? k : `${k}.`);

  const TEXT = Object.freeze({
    intro: (k) => `Om een duidelijk beeld te hebben van het merkverhaal en de kernwaarden van ${k} hebben we een positioneringsinterview gehouden. Tijdens dit interview zijn we samen op zoek gegaan naar de kern van het bedrijf. Daarmee zijn we aan de slag gegaan en creëren we een verhaal waarmee je je doelgroepen kunt bereiken en raken. Vanuit dit fundament bepaal je verder de strategie. Bovendien dient het als basis voor de te ontwikkelen creatieve concepten: de ‘storytelling’ en je boodschap die je gebruikt op je online kanalen.`,
    // In de referenties "Aan de rechterzijde": in de layout Genummerd staan de onderdelen eronder
    agendaIntro: 'Hieronder zijn de verschillende onderdelen van deze positionering neergezet.',
    // De onderdelen, altijd alle drie (één regel per punt)
    agenda: Object.freeze([
      'Overzicht Business Model Canvas',
      'Overzicht Waarde Propositie Canvas',
      'Uitwerking Business Model Canvas & Waarde Propositie Canvas',
    ]),
    // Een witregel tussen de twee alinea's, zoals in de referentie (gemeten: past ook met een
    // klantnaam van 40 tekens). Eindigt de naam op een punt (Groep B.V.), dan geen tweede punt
    afsluiter: (k, aanbod) => `Deze positionering biedt een helder en onderbouwd inzicht in de positie van ${k} in de markt. Door het in kaart brengen van klantbehoeften, pijnpunten, voordelen en de huidige dienstverlening ontstaat een duidelijk beeld van waar de grootste kansen en knelpunten liggen voor ${zin(k)}\n\nDe positionering laat zien hoe de ${aanbod === 'producten' ? 'producten & diensten' : 'diensten'} van ${k} aansluiten op de behoeften van hun klanten, waar de onderscheidende kracht ligt en welke strategische richtingen het meest kansrijk zijn om de waardepropositie verder te versterken en uiteindelijk de marketingdoelstellingen te realiseren met de juiste boodschap en doelgroep.`,
    contact: 'www.pureminds.nl\n045 - 3690530\ninfo@pureminds.nl',
    // De eerste tekst van elke toelichting: één vraag tussen blokhaken (een invulplek)
    uitleg: Object.freeze({
      bmcPartners: '[Wie zijn de belangrijkste partners en leveranciers, en wat leveren ze?]',
      bmcActiviteiten: '[Wat zijn de belangrijkste activiteiten om de waarde te leveren?]',
      bmcResources: '[Welke middelen zijn nodig: team, kennis, techniek, netwerk, data?]',
      bmcProposities: '[Welke waarde levert het bedrijf, en wat maakt het onderscheidend?]',
      bmcRelaties: '[Hoe onderhoudt het bedrijf de relatie met elke klantgroep?]',
      bmcKanalen: '[Via welke kanalen bereikt en bedient het bedrijf zijn klanten?]',
      bmcSegmenten: '[Voor wie creëert het bedrijf waarde: B2B, B2C, regio, persona?]',
      vpcVerschaffers: '[Hoe levert het bedrijf de voordelen die klanten verwachten of verrassen?]',
      vpcProducten: '[Welke producten en diensten biedt het bedrijf aan, en voor wie?]',
      vpcVerzachters: '[Hoe neemt het bedrijf de grootste frustraties en onzekerheden weg?]',
      vpcVoordelen: '[Welke voordelen zoekt de klant: vereist, verwacht, gewenst, onverwacht?]',
      vpcPijnen: '[Welke frustraties, risico’s en hindernissen ervaart de klant?]',
      vpcTaken: '[Wat probeert de klant te bereiken: functioneel, emotioneel en sociaal?]',
    }),
  });

  /* ---------------------------------------------------------------------------
     Het formulier (state.form bij een positionering)
     ------------------------------------------------------------------------- */

  const MAX_LINE = 200;   // invoerveld
  const LINE_FIELDS = ['klant', 'datum'];
  const AANBOD = ['diensten', 'producten'];   // "diensten" of "producten & diensten" in de afsluiter
  const PATHS = new Set([...LINE_FIELDS, 'aanbod']);

  // De eigen velden; een vaste opbouw heeft geen parts en hidden
  function defaults(datum = '') {
    return { klant: '', datum: str(datum).slice(0, MAX_LINE), aanbod: 'diensten' };
  }

  function normalizeFields(raw, out) {
    if (typeof raw.klant === 'string') out.klant = raw.klant.slice(0, MAX_LINE);
    // De standaarddatum alleen als er nog geen datum was: een bewust leeg gemaakte blijft leeg
    if (has(raw, 'datum')) out.datum = str(raw.datum).slice(0, MAX_LINE);
    if (AANBOD.includes(raw.aanbod)) out.aanbod = raw.aanbod;
  }

  function get(inp, path) {
    if (path === 'aanbod') return AANBOD.includes(inp.aanbod) ? inp.aanbod : 'diensten';
    if (!PATHS.has(path)) return '';
    return str(inp[path]);
  }

  // Geeft false bij een onbekend pad of een aanbod dat niet bestaat
  function set(input, path, value) {
    if (!PATHS.has(path)) return false;
    const v = value == null ? '' : String(value);
    if (path === 'aanbod') {
      if (!AANBOD.includes(v)) return false;
      input.aanbod = v;
      return true;
    }
    input[path] = v.slice(0, MAX_LINE);
    return true;
  }

  // Welke slide een veld van het formulier voedt: de preview springt ernaartoe
  const FEEDS = Object.freeze({ klant: 'cover', datum: 'cover', aanbod: 'afsluiter' });

  // Andersom: welk veld van het formulier een veld van de slide vult. De lange
  // inleiding en de afsluiter pas je aan bij Inhoud ([klantnaam] wel bij de
  // klantnaam); de canvassen en de toelichting staan er niet in: die zijn van de slide
  const FIELD_OF = Object.freeze({
    cover: { title: 'klant', meta: 'datum' },
    agenda: {},
    sectieBmc: { subtitle: 'klant' },
    sectieVpc: { subtitle: 'klant' },
    sectieBmcUitleg: { subtitle: 'klant' },
    sectieVpcUitleg: { subtitle: 'klant' },
    afsluiter: {},
  });

  /* ---------------------------------------------------------------------------
     Van formulier naar slides
     ------------------------------------------------------------------------- */

  const context = (inp) => ({ K: oneLine(inp.klant) || '[klantnaam]' });

  const section = (label, title, sub) => ({ layout: 'section', label, title, subtitle: sub });

  const BUILD = {
    cover: (inp, c) => {
      const datum = oneLine(inp.datum);
      return {
        layout: 'title', label: 'pure minds marketing group', title: `Positionering **${c.K}**`, subtitle: TEXT.intro(c.K),
        meta: datum ? `Pure Minds Marketing Group · ${datum}` : 'Pure Minds Marketing Group', photoFit: 'cover',
      };
    },
    agenda: (inp, c) => ({ layout: 'vragen', label: 'inhoud', title: 'Positionering', subtitle: TEXT.agendaIntro, body: TEXT.agenda.join('\n') }),
    sectieBmc: (inp, c) => section('business model canvas', 'Business Model Canvas', `**${c.K}**`),
    // Alleen de layout: de blokken vul je op de slide zelf in (een nieuwe begint leeg)
    bmc: () => ({ layout: 'bmc', label: 'business model canvas', title: '' }),
    sectieVpc: (inp, c) => section('waarde propositie canvas', 'Waarde Propositie Canvas', `**${c.K}**`),
    // De volle variant van de waardepropositie: in een positionering staat er veel meer in
    vpc: () => ({ layout: 'vpc', label: 'waarde propositie canvas', title: '', style: 'vol' }),
    sectieBmcUitleg: (inp, c) => section('toelichting', 'Business Model Canvas', `Toelichting\n**${c.K}**`),
    sectieVpcUitleg: (inp, c) => section('toelichting', 'Waarde Propositie Canvas', `Toelichting\n**${c.K}**`),
    afsluiter: (inp, c) => ({
      layout: 'closing', label: 'pure minds marketing group', title: 'Van gesprek naar positionering',
      subtitle: TEXT.afsluiter(c.K, inp.aanbod), body: TEXT.contact, photoFit: 'cover',
    }),
  };
  for (const [role, title, label] of UITLEG) {
    BUILD[role] = () => ({ layout: 'toelichting', label, title, body: TEXT.uitleg[role] });
  }

  /* ---------------------------------------------------------------------------
     Klaar om te versturen? De punten van de positionering (de generator zet de
     invulplekken en "Alle tekst past" erachter)
     ------------------------------------------------------------------------- */

  const VAKKEN = Object.keys(G.VPC_INFO);
  const UITLEG_ROLES = UITLEG.map((u) => u[0]);

  // Alle slides zitten er altijd in (een vaste opbouw)
  function checklist(inp, slides, { slideOf, written, item }) {
    item('klant', 'Klantnaam ingevuld', !!oneLine(inp.klant), { section: 'gegevens', field: '#psKlant' });
    const cover = slideOf('cover');
    item('foto', 'Foto op de titelslide', !!(cover && str(cover.photoKey)), { section: 'gegevens', field: '#psFotoBtn' }, { optional: true });
    // Een canvas zolang de slide het canvas toont (een andere layout gekozen: dan niet); af als elk vak iets heeft
    const canvas = (role, keys, name, what) => {
      const s = slideOf(role);
      if (s && s.layout !== role) return;
      const box = s && isObj(s[role]) ? s[role] : {};
      const n = keys.filter((k) => written(box[k])).length;
      const all = n === keys.length;
      item(role, all ? `${name} ingevuld` : `${name}: ${n} van ${keys.length} ${what} ingevuld`, all, { role, section: 'inhoud' }, { hint: 'in trefwoorden, bij Inhoud' });
    };
    canvas('bmc', G.BMC_KEYS, 'Business Model Canvas', 'blokken');
    canvas('vpc', VAKKEN, 'Waarde Propositie Canvas', 'vakken');
    // De toelichting: elke slide met eigen tekst in plaats van de vraag
    const open = UITLEG_ROLES.filter((role) => {
      const s = slideOf(role);
      return !(s && CONTENT[role].every((k) => written(s[k])));
    });
    const n = UITLEG_ROLES.length - open.length;
    item('toelichting', open.length ? `Toelichting: ${n} van ${UITLEG_ROLES.length} slides geschreven` : 'Toelichting geschreven', !open.length,
      { role: open[0] || UITLEG_ROLES[0], section: 'inhoud', field: '#sBody' }, { hint: 'vervang de tekst tussen blokhaken' });
  }

  const recipe = {
    id: 'positionering', fixed: true, ROLES, CONTENT, LINKS, ROLE_NAMES, TEXT, FEEDS, FIELD_OF, BUILD,
    defaults, normalizeFields, get, set, context, checklist,
    exports: () => ({ VPC_NAMES }),
  };

  const api = G.create(recipe);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) (global.PMDecks = global.PMDecks || {}).positionering = api;
})(typeof window !== 'undefined' ? window : globalThis);
