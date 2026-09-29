/* =============================================================================
   presentation/generator.js — gegenereerde presentaties, zonder DOM
   -----------------------------------------------------------------------------
   Het deel dat het voorstel (voorstel.js) en de positionering
   (positionering.js) delen. Een recept zegt welke slides er zijn, in welke
   volgorde, en wat de generator erop zet; create(recept) maakt daar de api
   van die de app gebruikt (tests/generator.test.js):

     defaults(datum)             een leeg formulier; de datum geeft de app mee
     normalizeInput(raw, datum)  een opgeslagen formulier gezond maken
     get(input, pad), set(...)   velden van het formulier (alleen bekende paden)
     isOn, setOn, markRemoved    welke slides erin zitten (PARTS: de schakelaars)
     hiddenRoles(input)          vaste slides die je verwijderde ("zet terug")
     build(input)                de slides als specs: [{ role, layout, ...velden }]
     specFor(input, role)        de spec van één slide, of null
     FEEDS, fieldFor(role, key)  welk veld welke slide voedt, en andersom
     sync(slides, specs, make, parked)   de specs in de presentatie verwerken
     touched(slide)              de velden die je zelf aanpaste
     resetSlide(slide, spec)     de slide volgt het formulier weer helemaal
     checklist(input, slides, counts)    "Klaar om te versturen?": wat nog ontbreekt

   Daarnaast, voor beide soorten en voor templates.js: de vakken van de
   waardepropositie (slide.vpc), de blokken van het business model canvas
   (slide.bmc), en de tekst van Kolommen en Genummerd.

   Wie is de baas over een veld? Elke gegenereerde slide onthoudt in
   gen[veld] wat de generator er het laatst in zette (tekst zoals hij is,
   de tabel als JSON). Staat daar nog precies dat, dan werkt het formulier
   het veld bij; heb je het zelf veranderd, dan blijft het staan. De tabel
   wordt vóór het vergelijken genormaliseerd zoals de app hem bewaart
   (normalizeTable), met vaste sleutelvolgorde: herladen of ongedaan maken
   maakt een slide dus niet "aangepast". De vakken en blokken van een canvas
   zijn altijd van de slide zelf: je vult ze in bij Inhoud.

   Een recept kan velden alleen laten beginnen (CONTENT, de toelichting van
   de positionering): de generator zet er een [invulplek] in, en zodra je er
   iets schreef is het veld van jou. Dat telt niet als "zelf aangepast" en
   terugzetten wist het niet; maak je het leeg, dan komt de invulplek terug.

   Een onderdeel dat uitgaat, wordt geparkeerd (parked): zet je het weer
   aan, dan komt precies die slide terug, met foto en eigen aanpassingen.

   In de browser: window.PMGenerator. In Node: require('js/presentation/generator.js').
   ============================================================================= */
(function (global) {
  'use strict';

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const str = (v) => (typeof v === 'string' ? v : '');
  const text = (v) => String(v == null ? '' : v);
  const lines = (v) => text(v).split(/\r\n|\r|\n/);

  const MAX_LINE = 200;    // invoerveld
  const MAX_AREA = 4000;   // tekstvak
  const MAX_ROWS = 14;     // TABLE_LIMITS.rows in templates.js
  const MAX_COLS = 8;      // TABLE_LIMITS.cols
  const MAX_CELL = 160;    // zoals normalizeTable een cel afkapt

  // Velden die een recept kan vullen. titleSize, photoKey, crop, imageSide en
  // de vakken en blokken van een canvas (vpc, bmc) nooit: die vul je op de slide zelf
  const OWNED = Object.freeze(['layout', 'label', 'title', 'subtitle', 'body', 'meta', 'quote', 'author', 'style', 'table', 'photoFit']);
  const OWNED_SET = new Set(OWNED);

  /* ---------------------------------------------------------------------------
     De canvassen: vakken en blokken staan op de slide (bij Inhoud)
     ------------------------------------------------------------------------- */

  // Het waardepropositie-canvas (slide.vpc, bij Inhoud): klantsegment en
  // klanttype (één regel) plus zes vakken
  const VPC_KEYS = Object.freeze(['segment', 'klanttype', 'taken', 'pijnen', 'voordelen', 'producten', 'verzachters', 'verschaffers']);
  const VPC_INFO = Object.freeze({
    taken: Object.freeze({ name: 'Klanttaken', uitleg: 'Wat probeert de klant gedaan te krijgen? Functioneel, sociaal en emotioneel.' }),
    pijnen: Object.freeze({ name: 'Pijnpunten', uitleg: 'Wat zit de klant dwars: ongewenste resultaten, hindernissen en risico’s.' }),
    voordelen: Object.freeze({ name: 'Voordelen', uitleg: 'Wat wil de klant bereiken: vereiste, verwachte, gewenste en onverwachte voordelen.' }),
    producten: Object.freeze({ name: 'Producten & diensten', uitleg: 'Wat bied je aan: fysiek, niet tastbaar, digitaal en financieel.' }),
    verzachters: Object.freeze({ name: 'Pijnverzachters', uitleg: 'Hoe neem je de pijn van de klant weg?' }),
    verschaffers: Object.freeze({ name: 'Voordeelverschaffers', uitleg: 'Hoe lever je de resultaten die de klant wil, of die hem verrassen?' }),
  });

  const vpcMax = (key) => (key === 'segment' || key === 'klanttype' ? MAX_LINE : MAX_AREA);

  function emptyVpc() {
    const out = {};
    for (const k of VPC_KEYS) out[k] = '';
    return out;
  }

  // Alleen de bekende tekstvelden, als tekst en niet te lang
  function normalizeVpc(v) {
    const src = isObj(v) ? v : {};
    const out = {};
    for (const k of VPC_KEYS) out[k] = str(src[k]).slice(0, vpcMax(k));
    return out;
  }

  // Het business model canvas (slide.bmc, bij Inhoud): zeven blokken, in de
  // volgorde van het canvas. De uitleg staat in een leeg blok en in het tekstvak
  const BMC_KEYS = Object.freeze(['partners', 'activiteiten', 'resources', 'proposities', 'relaties', 'kanalen', 'segmenten']);
  const BMC_INFO = Object.freeze({
    partners: Object.freeze({ name: 'Key Partners', uitleg: 'Wie helpen jullie de waarde te leveren? Leveranciers, partners, specialisten.' }),
    activiteiten: Object.freeze({ name: 'Kernactiviteiten', uitleg: 'Wat doen jullie om die waarde te leveren? De belangrijkste werkzaamheden.' }),
    resources: Object.freeze({ name: 'Key Resources', uitleg: 'Wat is daarvoor nodig? Team, kennis, middelen, data.' }),
    proposities: Object.freeze({ name: 'Waardeproposities', uitleg: 'Welke waarde leveren jullie? Aanbod, opgeloste problemen, onderscheid, resultaat.' }),
    relaties: Object.freeze({ name: 'Klantrelaties', uitleg: 'Hoe onderhouden jullie de band met elke klantgroep?' }),
    kanalen: Object.freeze({ name: 'Kanalen', uitleg: 'Hoe bereiken en bedienen jullie de klant? Online, showroom, beurzen.' }),
    segmenten: Object.freeze({ name: 'Klantsegmenten', uitleg: 'Voor wie creëren jullie waarde? B2B of B2C, beslissers, regio.' }),
  });

  function emptyBmc() {
    const out = {};
    for (const k of BMC_KEYS) out[k] = '';
    return out;
  }

  // Alleen de zeven blokken, als tekst en niet te lang
  function normalizeBmc(v) {
    const src = isObj(v) ? v : {};
    const out = {};
    for (const k of BMC_KEYS) out[k] = str(src[k]).slice(0, MAX_AREA);
    return out;
  }

  /* ---------------------------------------------------------------------------
     Tekst van de layouts Kolommen en Genummerd (templates.js en pptx.js lezen hem zo)
     ------------------------------------------------------------------------- */

  // Kolommen: blokken tussen lege regels; de eerste regel van een blok is de kop
  function parseColumns(body) {
    const blocks = [];
    let cur = [];
    for (const line of lines(body)) {
      if (line.trim()) cur.push(line.replace(/\s+$/, ''));
      else if (cur.length) {
        blocks.push(cur);
        cur = [];
      }
    }
    if (cur.length) blocks.push(cur);
    return blocks.map(([head, ...rest]) => ({ head: head.replace(/\*\*/g, '').trim(), text: rest.join('\n') }));
  }

  // Genummerd: de regels tot de eerste lege regel zijn de punten ("kop - vraag"), de rest is de slotzin
  function parseQuestions(body) {
    const all = lines(body);
    let i = 0;
    while (i < all.length && !all[i].trim()) i++;
    const items = [];
    for (; i < all.length && all[i].trim(); i++) {
      // Het nummer tekent de layout zelf: een getypt streepje of nummer valt weg
      const line = all[i].trim().replace(/^(?:[-–•*]|\d{1,2}[.)])\s+/, '');
      const m = /\s[-–]\s/.exec(line);
      items.push({
        head: (m ? line.slice(0, m.index) : line).replace(/\*\*/g, '').trim(),
        text: m ? line.slice(m.index + m[0].length).trim() : '',
      });
    }
    return { items, outro: all.slice(i).join('\n').trim() };
  }

  /* ---------------------------------------------------------------------------
     Formulier en presentatie samen: wie is de baas over een veld?
     ------------------------------------------------------------------------- */

  // Een tabel zoals normalizeTable in templates.js hem bewaart (de app doet dat
  // bij laden en ongedaan maken): rechthoekig, hoogstens 14 × 8, cellen als
  // tekst van hoogstens 160 tekens. Geen tabel: één lege cel (normalizeTable
  // geeft dan de voorbeeldtabel, maar een slide van de app heeft er altijd een)
  function tableOf(t) {
    const src = isObj(t) && Array.isArray(t.cells) ? t : { cells: [] };
    let cells = src.cells.filter(Array.isArray).slice(0, MAX_ROWS)
      .map((row) => row.slice(0, MAX_COLS).map((v) => text(v).slice(0, MAX_CELL)));
    const cols = Math.max(1, ...cells.map((r) => r.length));
    if (!cells.length) cells = [['']];
    cells = cells.map((r) => r.concat(Array(cols - r.length).fill('')));
    return { header: src.header !== false, firstCol: src.firstCol !== false, cells };
  }

  // JSON met gesorteerde sleutels: dezelfde inhoud geeft altijd dezelfde tekst
  function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
    return JSON.stringify(v === undefined ? null : v);
  }

  // Wat gen[veld] onthoudt: tekst zoals hij is, de tabel genormaliseerd als JSON
  function ser(key, v) {
    if (key === 'table') return stable(tableOf(v));
    if (typeof v === 'string') return v;
    if (v == null) return '';
    try {
      return String(v);
    } catch (e) {
      return '';
    }
  }

  // Een eigen kopie, zodat bewerken op de slide de spec niet raakt
  const copy = (key, v) => (key === 'table' ? tableOf(v) : v);

  // Een onthouden tabel opnieuw schrijven zoals ser() nu doet, zodat een
  // concept van vóór een wijziging (sleutelvolgorde) niet ineens "aangepast"
  // is. Onleesbare JSON blijft staan: dan blijft jouw waarde ook staan
  function reser(key, s) {
    try {
      return ser(key, JSON.parse(s));
    } catch (e) {
      return s;
    }
  }

  // Alleen velden die een recept vult; een oude gen.vpc (het canvas kwam
  // vroeger uit het formulier) valt dus weg en de vakken zijn van de slide
  function normalizeGen(g) {
    const out = {};
    if (!isObj(g)) return out;
    for (const k of OWNED) {
      if (typeof g[k] === 'string') out[k] = k === 'table' ? reser(k, g[k]) : g[k];
    }
    return out;
  }

  /* ---------------------------------------------------------------------------
     Klaar om te versturen? Wat je makkelijk over het hoofd ziet
     ------------------------------------------------------------------------- */

  // Een [invulplek], zoals PLACEHOLDER in deck.js (maar niet globaal: test() onthoudt dan niets)
  const BLANK = /\[[^[\]\n]{0,40}?[a-zà-ÿ][^[\]\n]{0,40}?\]/i;
  const BLANKS = new RegExp(BLANK.source, 'gi');
  // Er staat echt iets: tekst, en geen invulplek
  const written = (v) => {
    const t = str(v).replace(/\*\*/g, '').trim();
    return !!t && !BLANK.test(t);
  };
  // Leeg, ook als er alleen nadruktekens staan
  const blank = (v) => !text(v).replace(/\*\*/g, '').trim();
  // Eén regel, zonder nadruktekens (die horen niet in een naam of maand)
  const oneLine = (v) => str(v).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  // Een voorbeeld in het label van de checklist, kort gehouden; de invulplekken
  // van het voorstel ([beschrijf de gewenste situatie]) passen er nog heel in
  const EXAMPLE_MAX = 32;
  const clip = (t) => (t.length > EXAMPLE_MAX ? `${t.slice(0, EXAMPLE_MAX - 1).trimEnd()}…` : t);

  // De controle vóór het downloaden (deck.js); in de browser laadt die na dit bestand
  function deckApi() {
    if (global && global.PMDeck) return global.PMDeck;
    try {
      return typeof require === 'function' ? require('./deck.js') : null;
    } catch (e) {
      return null;
    }
  }

  // De eerste invulplek in de presentatie, als voorbeeld ("zoals [klantnaam]").
  // skip(slide, key): velden die niet meetellen
  function firstBlank(slides, skip) {
    const D = deckApi();
    if (!D || typeof D.exampleIssues !== 'function') return '';
    const hit = D.exampleIssues({ slides }).find((x) => x.kind === 'invulplek' && !skip(slides[x.index], x.key));
    return hit ? clip((str(hit.found).match(BLANK) || [''])[0]) : '';
  }

  /* ---------------------------------------------------------------------------
     Van recept naar api
     ------------------------------------------------------------------------- */

  const EMPTY = Object.freeze({});

  /**
   * Maakt de api van één soort gegenereerde presentatie. Het recept:
   *   id, ROLES (vaste volgorde), OPTIONAL ({ onderdeel: standaardstand }), PARTS
   *   (schakelaars in de volgorde van het formulier), GROUP_OF ({ rol: onderdeel },
   *   optioneel), CONTENT ({ rol: [velden die de generator alleen laat beginnen] },
   *   optioneel), LINKS (optioneel), ROLE_NAMES, TEXT, FEEDS, FIELD_OF,
   *   defaults(datum), normalizeFields(raw, out, datum), get, set, context(input, api),
   *   BUILD ({ rol: (input, c) => spec }), checklist(input, slides, kit) en
   *   exports(api) (extra's; mogen geen naam van de api overschrijven).
   * build, checklist en de rest krijgen altijd het genormaliseerde formulier.
   */
  function create(recipe) {
    if (!isObj(recipe)) throw new Error('PMGenerator.create: geen recept');
    const { ROLES, OPTIONAL, PARTS, ROLE_NAMES, TEXT, FEEDS, FIELD_OF, BUILD } = recipe;
    const GROUP_OF = recipe.GROUP_OF || EMPTY;
    const CONTENT = recipe.CONTENT || EMPTY;
    const LINKS = recipe.LINKS || EMPTY;
    for (const role of ROLES) {
      if (typeof BUILD[role] !== 'function') throw new Error(`${recipe.id}: geen BUILD voor ${role}`);
    }
    const FIXED = Object.freeze(ROLES.filter((r) => !has(OPTIONAL, r)));

    /* --- Het formulier ----------------------------------------------------- */

    function defaults(datum = '') {
      return { ...recipe.defaults(datum), parts: { ...OPTIONAL }, hidden: [] };
    }

    // Na laden of ongedaan maken: onbekende sleutels vallen weg, de rest krijgt het goede type
    function normalizeInput(raw, datum = '') {
      const out = defaults(datum);
      if (!isObj(raw)) return out;
      recipe.normalizeFields(raw, out, datum);
      if (isObj(raw.parts)) {
        for (const r of PARTS) if (typeof raw.parts[r] === 'boolean') out.parts[r] = raw.parts[r];
      }
      // Alleen vaste onderdelen kunnen weg zijn; de rest heeft een schakelaar
      if (Array.isArray(raw.hidden)) out.hidden = FIXED.filter((r) => raw.hidden.includes(r));
      return out;
    }

    const get = (input, path) => recipe.get(isObj(input) ? input : {}, path);

    // Geeft false bij een onbekend pad of een waarde die niet mag
    function set(input, path, value) {
      if (!isObj(input) || typeof path !== 'string') return false;
      return recipe.set(input, path, value) === true;
    }

    /* --- Onderdelen en slides aan of uit ----------------------------------- */

    const isFixed = (role) => FIXED.includes(role);
    const isOptional = (role) => typeof role === 'string' && has(OPTIONAL, role);

    // Een slide in een groep (GROUP_OF) zit er alleen in zolang zijn onderdeel aan staat
    function isOn(input, role) {
      const inp = isObj(input) ? input : {};
      if (typeof role === 'string' && has(GROUP_OF, role) && !isOn(inp, GROUP_OF[role])) return false;
      if (isFixed(role)) return !(Array.isArray(inp.hidden) && inp.hidden.includes(role));
      if (isOptional(role)) return isObj(inp.parts) ? !!inp.parts[role] : OPTIONAL[role];
      return false;
    }

    function setOn(input, role, on) {
      if (!isObj(input)) return false;
      if (isOptional(role)) {
        if (!isObj(input.parts)) input.parts = { ...OPTIONAL };
        input.parts[role] = !!on;
        return true;
      }
      if (isFixed(role)) {
        const hidden = Array.isArray(input.hidden) ? input.hidden.filter((r) => r !== role) : [];
        if (!on) hidden.push(role);
        input.hidden = hidden;
        return true;
      }
      return false;
    }

    // Een slide uit de presentatie verwijderd: bij de volgende wijziging niet terugzetten
    const markRemoved = (input, role) => setOn(input, role, false);

    // Vaste slides die je verwijderde, in de vaste volgorde; niet die van een onderdeel dat uit staat
    function hiddenRoles(input) {
      const inp = isObj(input) ? input : {};
      const hidden = Array.isArray(inp.hidden) ? inp.hidden : [];
      return ROLES.filter((r) => hidden.includes(r) && (!has(GROUP_OF, r) || isOn(inp, GROUP_OF[r])));
    }

    /* --- Van formulier naar slides ----------------------------------------- */

    // De slides in de vaste volgorde, alleen wat aan staat
    function build(input) {
      const inp = normalizeInput(input);
      const c = recipe.context(inp, { isOn: (r) => isOn(inp, r) });
      return ROLES.filter((r) => isOn(inp, r)).map((role) => ({ role, ...BUILD[role](inp, c) }));
    }

    const specFor = (input, role) => build(input).find((s) => s.role === role) || null;

    // found (optioneel): de gevonden invulplek; [klantnaam] vul je altijd bij de klantnaam in
    function fieldFor(role, key, found) {
      if (typeof role !== 'string' || !has(FIELD_OF, role)) return null;
      if (/\[klantnaam\]/i.test(text(found))) return 'klant';
      const map = FIELD_OF[role];
      return typeof key === 'string' && has(map, key) ? map[key] : null;
    }

    /* --- Bijwerken zonder jouw aanpassingen te raken ----------------------- */

    // De velden die de generator bij deze rol alleen laat beginnen
    const contentOf = (role) => (typeof role === 'string' && has(CONTENT, role) ? CONTENT[role] : []);
    // Zo'n veld is van jou zodra je er iets in schreef; leeg gemaakt telt als niet geschreven
    const wrote = (slide, gen, key) => !blank(slide[key]) && (!has(gen, key) || ser(key, slide[key]) !== gen[key]);

    // Verse waarden op een kopie van de slide; een veld dat je zelf aanpaste blijft (behalve bij force).
    // Wat je in een CONTENT-veld schreef, blijft altijd: ook terugzetten wist een toelichting niet
    function apply(slide, spec, force) {
      const out = { ...slide };
      const old = normalizeGen(slide.gen);
      const gen = force ? {} : old;
      const content = contentOf(spec.role);
      for (const key of Object.keys(spec)) {
        if (!OWNED_SET.has(key)) continue;
        if (content.includes(key)) {
          if (wrote(slide, old, key)) {
            if (has(old, key)) gen[key] = old[key];
            continue;
          }
        } else if (!force && has(gen, key) && ser(key, slide[key]) !== gen[key]) continue;
        out[key] = copy(key, spec[key]);
        gen[key] = ser(key, spec[key]);
      }
      out.role = spec.role;
      out.gen = gen;
      return out;
    }

    // CONTENT-velden tellen niet: die schrijf je juist zelf
    const touched = (slide) => {
      if (!isObj(slide)) return [];
      const gen = normalizeGen(slide.gen);
      const content = contentOf(slide.role);
      return OWNED.filter((k) => !content.includes(k) && has(gen, k) && ser(k, slide[k]) !== gen[k]);
    };

    const resetSlide = (slide, spec) => {
      const base = isObj(slide) ? slide : {};
      return isObj(spec) && ROLES.includes(spec.role) ? apply(base, spec, true) : { ...base };
    };

    // Een nieuw onderdeel: direct na het dichtstbijzijnde onderdeel ervóór, anders vóór het eerste erna, anders achteraan
    function insertAt(list, role) {
      const i = ROLES.indexOf(role);
      const find = (r) => list.findIndex((s) => s.role === r);
      for (let j = i - 1; j >= 0; j--) {
        const at = find(ROLES[j]);
        if (at >= 0) return at + 1;
      }
      for (let j = i + 1; j < ROLES.length; j++) {
        const at = find(ROLES[j]);
        if (at >= 0) return at;
      }
      return list.length;
    }

    /**
     * De specs in de presentatie verwerken. Een slide met een gewenst onderdeel
     * wordt bijgewerkt waar hij staat (jouw volgorde blijft); een tweede slide
     * met hetzelfde onderdeel of een onbekend onderdeel wordt een gewone slide.
     * Gewone slides (role '') blijven onaangeroerd op hun plek.
     *
     * parked ({ [onderdeel]: slide }, mag ontbreken): slides die uit de presentatie
     * gingen. Een onderdeel dat uit staat, gaat daarheen (en vervangt een oudere).
     * Staat het weer aan, dan komt precies die slide terug (foto, eigen vakken,
     * eigen aanpassingen) en werkt het formulier hem bij zoals elke andere.
     * Alleen zonder geparkeerde slide maakt make(spec) een lege (in de app:
     * s => newSlide(s.layout)). parked zelf blijft zoals hij was.
     *
     * Geeft { slides, added, removed, parked }: added zijn de onderdelen die
     * (terug)kwamen, removed die weggingen, parked het nieuwe object.
     */
    function sync(slides, specs, make, parked) {
      const wanted = new Map();
      for (const s of Array.isArray(specs) ? specs : []) {
        if (isObj(s) && ROLES.includes(s.role) && !wanted.has(s.role)) wanted.set(s.role, s);
      }
      // Een nieuw object met alleen bekende onderdelen
      const park = {};
      if (isObj(parked)) for (const r of ROLES) if (has(parked, r) && isObj(parked[r])) park[r] = parked[r];
      const out = [];
      const seen = new Set();
      const removed = [];
      for (const slide of Array.isArray(slides) ? slides : []) {
        if (!isObj(slide)) continue;
        const role = typeof slide.role === 'string' ? slide.role : '';
        if (!role) out.push(slide);
        else if (!ROLES.includes(role) || seen.has(role)) out.push({ ...slide, role: '', gen: {} });
        else {
          seen.add(role);
          if (wanted.has(role)) {
            out.push(apply(slide, wanted.get(role), false));
            delete park[role];   // de slide staat er al: een geparkeerde is oud
          } else {
            removed.push(role);
            park[role] = slide;
          }
        }
      }
      const added = [];
      const fresh = (spec) => {
        const base = typeof make === 'function' ? make(spec) : null;
        return { ...(isObj(base) ? base : {}), gen: {} };
      };
      for (const role of ROLES) {
        if (!wanted.has(role) || seen.has(role)) continue;
        const spec = wanted.get(role);
        let base = has(park, role) ? { ...park[role] } : null;
        delete park[role];
        // Zou niet moeten, maar twee slides met hetzelfde id breken selecteren en ongedaan maken
        if (base && base.id != null && out.some((s) => s.id === base.id)) base.id = fresh(spec).id;
        out.splice(insertAt(out, role), 0, apply(base || fresh(spec), spec, false));
        added.push(role);
      }
      return { slides: out, added, removed, parked: park };
    }

    /* --- Klaar om te versturen? -------------------------------------------- */

    // Een invulplek in een CONTENT-veld (de tekst tussen blokhaken van een toelichting)
    // telt het recept zelf al ("Toelichting: 0 van 13"): niet nog eens bij de invulplekken
    const isContent = (slide, key) => isObj(slide) && contentOf(slide.role).includes(key);

    // Hoeveel van de getelde invulplekken in CONTENT-velden staan. De app telt alleen de
    // velden die de layout toont (deck.js fields): hier dus ook
    function contentBlanks(slides) {
      const D = deckApi();
      let n = 0;
      for (const s of slides) {
        const keys = contentOf(s.role);
        if (!keys.length) continue;
        const shown = D && typeof D.fields === 'function' ? D.fields(s).map((f) => f.key) : keys;
        for (const k of keys) if (shown.includes(k)) n += (text(s[k]).match(BLANKS) || []).length;
      }
      return n;
    }

    /**
     * De lijst "Klaar om te versturen?": [{ id, label, done, optional, hint, go }].
     * Eerst de punten van het recept, dan altijd de invulplekken en of alles past.
     * counts = { placeholders, overflow }: de app telt ze met de controle vóór
     * het downloaden. go zegt waar je het oplost: { section, field }, { section },
     * { role, section, field? } of { issue: 'first' | 'overflow' }. hint alleen
     * als het nog niet klaar is. Onderdelen die uit staan, staan er niet in.
     */
    function checklist(input, slides, counts) {
      const inp = normalizeInput(input);
      const list = Array.isArray(slides) ? slides.filter(isObj) : [];
      const slideOf = (role) => list.find((s) => s.role === role) || null;
      const c = isObj(counts) ? counts : {};
      const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
      const out = [];
      const item = (id, label, done, go, extra = {}) => out.push({
        id, label, done: !!done, optional: !!extra.optional, hint: done ? '' : extra.hint || '', go,
      });

      recipe.checklist(inp, list, { isOn: (r) => isOn(inp, r), slideOf, written, oneLine, item });
      const blanks = Math.max(0, count(c.placeholders) - contentBlanks(list));
      const example = blanks ? firstBlank(list, isContent) : '';
      const blankLabel = blanks
        ? `${blanks} ${blanks === 1 ? 'invulplek' : 'invulplekken'} over${example ? `, zoals ${example}` : ''}`
        : 'Geen invulplekken meer';
      item('invulplekken', blankLabel, !blanks, { issue: 'first' });
      item('past', 'Alle tekst past', !count(c.overflow), { issue: 'overflow' });
      return out;
    }

    const api = {
      id: recipe.id, ROLES, OPTIONAL, PARTS, FIXED, GROUP_OF, CONTENT, LINKS, ROLE_NAMES, OWNED, TEXT, FEEDS,
      VPC_KEYS, VPC_INFO, BMC_KEYS, BMC_INFO,
      defaults, normalizeInput, get, set, isOn, setOn, markRemoved, hiddenRoles, build, specFor, fieldFor,
      sync, touched, resetSlide, checklist, emptyVpc, normalizeVpc, emptyBmc, normalizeBmc, normalizeGen,
      parseColumns, parseQuestions,
    };
    // Wat alleen dit recept heeft (bij het voorstel de prijzen); het krijgt de api zelf mee
    const extra = typeof recipe.exports === 'function' ? recipe.exports(api) : null;
    if (isObj(extra)) {
      for (const k of Object.keys(extra)) {
        if (has(api, k)) throw new Error(`${recipe.id}: exports.${k} bestaat al in de api`);
        api[k] = extra[k];
      }
    }
    return api;
  }

  const api = {
    create, OWNED,
    normalizeGen, ser, stable, tableOf,
    VPC_KEYS, VPC_INFO, emptyVpc, normalizeVpc,
    BMC_KEYS, BMC_INFO, emptyBmc, normalizeBmc,
    parseColumns, parseQuestions,
    BLANK, written, oneLine,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) global.PMGenerator = api;
})(typeof window !== 'undefined' ? window : globalThis);
