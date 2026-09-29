/* =============================================================================
   app.js — Icon Finder
   -----------------------------------------------------------------------------
   Zoeken en bladeren door de Remix-iconen (js/icons/icon-data.js). Het zoeken
   zelf doet PMIconSearch (search.js), met Nederlandse en Engelse woorden; de
   zeshoek komt van PMHex (hex.js), precies zoals maak-zeshoeken.py hem maakt.
   Stijl, vorm en kleur gelden voor het hele raster: wat je ziet, download je.

   Toestand:
     - zoekterm, categorie en gekozen icoon staan in het adres
       (?q=mail&cat=Arrows&icoon=mail): verversen of een gedeelde link laat
       hetzelfde zien;
     - stijl, vorm, kleur, bestandstype, formaat, achtergrond van de preview en
       de laatst gebruikte iconen staan in localStorage (pm-icons-v1).

   Intern is een icoon altijd zijn plek in PM_ICON_DATA.icons: een naam kan in
   twee categorieën voorkomen. Naar buiten (adres, "laatst gebruikt") gaat de
   naam, bij zo'n dubbele naam met de categorie ervoor: Editor/ai-generate-2.

   Snelheid: een tegel wordt één keer per stijl en vorm gebouwd en daarna
   hergebruikt. Kleuren zijn CSS-variabelen op #app (--ico, --hex-fill), dus een
   andere kleur tekent niets opnieuw. Categorieblokken buiten beeld slaat de browser over
   (content-visibility in css/icons.css).
   ============================================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const DATA = window.PM_ICON_DATA;
  const HEX = window.PMHex;
  const STORAGE_KEY = 'pm-icons-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const toast = PM.toast;

  // Nederlandse namen van de mappen in assets/icons; search.js zoekt er ook op
  const CATEGORY_LABELS = {
    'Arrows': 'Pijlen', 'Buildings': 'Gebouwen', 'Business': 'Zakelijk', 'Communication': 'Communicatie',
    'Design': 'Design', 'Development': 'Development', 'Device': 'Apparaten', 'Document': 'Documenten',
    'Editor': 'Tekstopmaak', 'Finance': 'Financiën', 'Food': 'Eten & drinken', 'Game & Sports': 'Spel & sport',
    'Health & Medical': 'Gezondheid', 'Logos': "Logo's & merken", 'Map': 'Kaart & reizen', 'Media': 'Media',
    'Others': 'Overig', 'System': 'Systeem', 'User & Faces': 'Mensen', 'Weather': 'Weer',
  };

  const results = document.getElementById('results');
  if (!DATA || !Array.isArray(DATA.icons) || !HEX) {
    results.innerHTML = '<p class="notice notice-error">De iconen konden niet worden geladen. Ververs de pagina; lukt het dan nog niet, laat het even weten.</p>';
    console.error('Icon Finder: PM_ICON_DATA of PMHex ontbreekt.');
    return;
  }

  const ICONS = DATA.icons;
  const CATS = DATA.categories;
  const INK = '#303030';
  const WHITE = '#ffffff';

  // Kleur van een los icoon
  const LOOSE_COLORS = [
    { id: 'inkt', name: 'Inkt', color: INK },
    { id: 'cyaan', name: 'Cyaan', color: '#1ab9e2' },
    { id: 'blauw', name: 'Blauw', color: '#1b71a8' },
    { id: 'magenta', name: 'Magenta', color: '#b61b50' },
    { id: 'wit', name: 'Wit', color: WHITE },
    { id: 'eigen', name: 'Eigen kleur' },
  ];
  // In de zeshoek: altijd effen, zonder rand. Cyaan met wit icoon is de huisvariant
  // (PMHex.presets.blauw, de map Zeshoek/Blauw); donker en wit zijn de andere twee
  // van maak-zeshoeken.py. Daarbij cyaan met een inkt icoon en magenta.
  // label = de naam naast de stalen, als die anders is dan de id.
  const HEX_COLORS = [
    { id: 'cyaan', name: 'Cyaan, wit icoon', fill: '#1ab9e2', color: WHITE },
    { id: 'cyaan-inkt', name: 'Cyaan, inkt icoon', label: 'cyaan · inkt', fill: '#1ab9e2', color: INK },
    { id: 'donker', name: 'Donker', fill: INK, color: WHITE },
    { id: 'magenta', name: 'Magenta', fill: '#b61b50', color: WHITE },
    { id: 'wit', name: 'Wit', fill: WHITE, color: INK },
    { id: 'eigen', name: 'Eigen kleur' },
  ];

  const SIZES = [128, 256, 512, 1024, 2048];
  const STAGES = ['licht', 'donker', 'geblokt'];
  const SUGGESTIONS = ['pijl', 'grafiek', 'mail', 'gebruiker', 'vinkje', 'huis'];
  const RECENT_MAX = 12;
  const NO_IMAGE_COPY = 'Deze browser kan geen afbeelding kopiëren. Download de PNG, of kies SVG en kopieer de code.';

  const TAGS = window.PM_ICON_TAGS || {};
  const fmt = (n) => n.toLocaleString('nl-NL');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const catLabel = (c) => CATEGORY_LABELS[CATS[c]] || CATS[c];
  const readable = (i) => ICONS[i][0].replace(/-/g, ' ');

  // Categorieën op hun Nederlandse naam, "Overig" als laatste
  const CAT_ORDER = CATS.map((_, c) => c).sort((a, b) => {
    if (CATS[a] === 'Others') return 1;
    if (CATS[b] === 'Others') return -1;
    return catLabel(a).localeCompare(catLabel(b), 'nl');
  });

  /* ---------------------------------------------------------------------------
     Namen en sleutels
     ------------------------------------------------------------------------- */

  const byName = new Map();
  ICONS.forEach((ic, i) => {
    if (!byName.has(ic[0])) byName.set(ic[0], []);
    byName.get(ic[0]).push(i);
  });

  const keyOf = (i) => (byName.get(ICONS[i][0]).length > 1 ? `${CATS[ICONS[i][1]]}/${ICONS[i][0]}` : ICONS[i][0]);

  // Sleutel uit het adres of de opslag terug naar een icoon; -1 als hij niet (meer) bestaat
  function indexOf(key) {
    if (typeof key !== 'string' || !key) return -1;
    const slash = key.lastIndexOf('/');
    const cat = slash > 0 ? CATS.indexOf(key.slice(0, slash)) : -1;
    const find = (name) => {
      const list = byName.get(name);
      if (!list) return -1;
      return list.find((i) => ICONS[i][1] === cat) ?? list[0];
    };
    const name = key.slice(slash + 1).trim().toLowerCase();
    let i = find(name);
    const style = name.match(/^(.+)-(line|fill)$/);   // ook "home-line" uit een bestandsnaam
    if (i < 0 && style) i = find(style[1]);
    return i;
  }

  // Het pad in de gekozen stijl; heeft een icoon die stijl niet, dan de andere
  function variant(i) {
    const ic = ICONS[i];
    if (ic.length < 4) return { d: ic[2], suffix: '', style: null, both: false };
    let style = state.style;
    if (!ic[style === 'line' ? 2 : 3]) style = style === 'line' ? 'fill' : 'line';
    return { d: style === 'line' ? ic[2] : ic[3], suffix: `-${style}`, style, both: !!(ic[2] && ic[3]) };
  }

  function placed(d) {
    try {
      return HEX.place(d).d;
    } catch (err) {
      console.error('Icon Finder: pad past niet in de zeshoek', err);
      return '';
    }
  }

  /* ---------------------------------------------------------------------------
     Toestand
     ------------------------------------------------------------------------- */

  const saved = PM.store.get(STORAGE_KEY, {}) || {};
  const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  const pick = (list, v, fallback) => (list.includes(v) ? v : fallback);
  // Opslag van vóór v2: de zeshoek "blauw" (wit icoon) is nu cyaan, de oude "cyaan" (inkt icoon) cyaan-inkt
  const HEX_RENAMED = { blauw: 'cyaan', cyaan: 'cyaan-inkt' };

  const state = {
    style: pick(['line', 'fill'], saved.style, 'line'),
    shape: pick(['none', 'hex'], saved.shape, 'none'),
    looseColor: pick(LOOSE_COLORS.map((c) => c.id), saved.looseColor, 'inkt'),
    looseCustom: isColor(saved.looseCustom) ? saved.looseCustom.toLowerCase() : '#009670',
    hexColor: pick(HEX_COLORS.map((c) => c.id), saved.v >= 2 ? saved.hexColor : HEX_RENAMED[saved.hexColor] || saved.hexColor, 'cyaan'),
    hexCustom: isColor(saved.hexCustom) ? saved.hexCustom.toLowerCase() : '#009670',
    format: pick(['svg', 'png'], saved.format, 'svg'),
    size: pick(SIZES, saved.size, 512),
    stage: pick(STAGES, saved.stage, 'licht'),
    recent: Array.isArray(saved.recent) ? saved.recent.filter((k) => typeof k === 'string').slice(0, RECENT_MAX) : [],
    // Niet bewaard, maar in het adres:
    query: '',
    cat: -1,
    selected: -1,
  };
  let stageAuto = false;   // preview vanzelf donker gezet voor een wit icoon

  const params = new URLSearchParams(location.search);
  state.query = (params.get('q') || '').trim().slice(0, 80);
  state.cat = CATS.indexOf(params.get('cat') || '');
  state.selected = indexOf(params.get('icoon'));
  const openedWithIcon = state.selected >= 0;

  const save = PM.debounce(() => {
    const { style, shape, looseColor, looseCustom, hexColor, hexCustom, format, size, recent } = state;
    const stage = stageAuto ? 'licht' : state.stage;
    PM.store.set(STORAGE_KEY, { v: 2, style, shape, looseColor, looseCustom, hexColor, hexCustom, format, size, stage, recent });
  }, 250);

  // Zoekterm, categorie en keuze in het adres; niet bij elke toets (Safari begrenst replaceState)
  const syncUrl = PM.debounce(() => {
    const p = new URLSearchParams();
    if (state.query) p.set('q', state.query);
    if (state.cat >= 0) p.set('cat', CATS[state.cat]);
    if (state.selected >= 0) p.set('icoon', keyOf(state.selected));
    const qs = p.toString();
    const next = location.pathname + (qs ? `?${qs}` : '') + location.hash;
    if (next === location.pathname + location.search + location.hash) return;
    try {
      history.replaceState(history.state, '', next);
    } catch (err) {
      /* te veel wijzigingen achter elkaar: dan staat alleen het adres even achter */
    }
  }, 400);

  /* ---------------------------------------------------------------------------
     Elementen
     ------------------------------------------------------------------------- */

  const el = {
    app: $('#app'),
    bar: $('#bar'),
    head: $('.browse__head'),
    search: $('#search'),
    q: $('#q'),
    qClear: $('#qClear'),
    styleToggle: $('#styleToggle'),
    styleArt: $('#styleArt'),
    styleSummary: $('#styleSummary'),
    swatches: $('#swatches'),
    colorName: $('#colorName'),
    colorPick: $('#colorPick'),
    colorPickTxt: $('#colorPickTxt'),
    customColor: $('#customColor'),
    chipsWrap: $('#chipsWrap'),
    chips: $('#chips'),
    chipsPrev: $('#chipsPrev'),
    chipsNext: $('#chipsNext'),
    resultsWrap: $('#resultsWrap'),
    count: $('#count'),
    countLive: $('#countLive'),
    gridTip: $('#gridTip'),
    results,
    aside: $('#aside'),
    detail: $('#detail'),
    detailEmpty: $('#detailEmpty'),
    detailMain: $('#detailMain'),
    emptyArt: $('#emptyArt'),
    dCat: $('#dCat'),
    dStage: $('#dStage'),
    dArt: $('#dArt'),
    dArtM: $('#dArtM'),
    dArtS: $('#dArtS'),
    dName: $('#dName'),
    dFile: $('#dFile'),
    dCopyName: $('#dCopyName'),
    dWords: $('#dWords'),
    dStyleWrap: $('#dStyleWrap'),
    dSingle: $('#dSingle'),
    dDims: $('#dDims'),
    sizeRow: $('#sizeRow'),
    dUse: $('#dUse'),
    dNote: $('#dNote'),
    dlBtn: $('#downloadBtn'),
    copyBtn: $('#copyBtn'),
    sheet: $('#sheet'),
    sheetPanel: $('#sheetPanel'),
    sheetClose: $('#sheetClose'),
    toast: $('#toast'),
    defHex: $('#pmi-hex'),
  };
  const narrowMq = window.matchMedia('(max-width: 1023px)');
  const fineMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  /* ---------------------------------------------------------------------------
     Kleur: wat je ziet en wat je downloadt
     ------------------------------------------------------------------------- */

  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const contrast = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  // Wit of inkt op een eigen zeshoekkleur: wat het beste leesbaar is
  const textOn = (fill) => (contrast(fill, WHITE) >= contrast(fill, INK) ? WHITE : INK);

  // Te licht voor een wit vlak (wit icoon, witte zeshoek): dan een donkere achtergrond
  const tooLight = (color) => contrast(color, WHITE) < 1.6;

  /**
   * De huidige keuze als { shape, fill, color, slug, dark }. fill is altijd één
   * kleur (geen verloop, geen rand); slug komt in de bestandsnaam.
   */
  function looks() {
    if (state.shape === 'hex') {
      const c = HEX_COLORS.find((x) => x.id === state.hexColor) || HEX_COLORS[0];
      const own = c.id === 'eigen';
      const fill = own ? state.hexCustom : c.fill;
      const slug = own ? `zeshoek-eigen-${fill.slice(1)}` : `zeshoek-${c.id}`;
      return { shape: 'hex', fill, color: own ? textOn(fill) : c.color, slug, dark: tooLight(fill) };
    }
    const c = LOOSE_COLORS.find((x) => x.id === state.looseColor) || LOOSE_COLORS[0];
    const color = c.id === 'eigen' ? state.looseCustom : c.color;
    const slug = c.id === 'inkt' ? '' : c.id === 'eigen' ? `eigen-${color.slice(1)}` : c.id;
    return { shape: 'none', fill: null, color, slug, dark: tooLight(color) };
  }

  function svgOpts(L, id, height) {
    const opts = L.shape === 'hex'
      ? { shape: 'hex', fill: L.fill, color: L.color, id }
      : { shape: 'none', color: L.color };
    if (height) opts.height = height;
    return opts;
  }

  // De tegels volgen de kleur via CSS-variabelen: niets opnieuw tekenen
  function applyLooks() {
    const L = looks();
    el.app.style.setProperty('--ico', L.color);
    if (L.fill) el.app.style.setProperty('--hex-fill', L.fill);
    el.resultsWrap.classList.toggle('is-dark', L.dark);
    el.styleArt.classList.toggle('is-dark', L.dark);
    // Een wit icoon of een witte zeshoek is onzichtbaar op de lichte preview: dan vanzelf donker, en weer terug
    if (L.dark && state.stage === 'licht') {
      state.stage = 'donker';
      stageAuto = true;
    } else if (!L.dark && stageAuto) {
      state.stage = 'licht';
      stageAuto = false;
    }
  }

  // De zeshoek zelf is voor elk icoon gelijk: één keer in <defs>, de tegels verwijzen ernaar
  const HEX_GEO = (() => {
    const svg = HEX.svg(ICONS[0][2] || ICONS[0][3], { shape: 'hex', fill: INK });
    const viewBox = (svg.match(/viewBox="([^"]+)"/) || [])[1] || `0 0 ${HEX.num(HEX.WIDTH)} ${HEX.HEIGHT}`;
    return { viewBox, body: (svg.match(/ d="([^"]*)"/) || [])[1] || '' };
  })();
  el.defHex.setAttribute('d', HEX_GEO.body);

  // Klein icoon in de kleur en vorm van nu (tegel, stijlknop); kleur via CSS
  function artSvg(i, cls = '') {
    const v = variant(i);
    if (state.shape === 'hex') {
      return `<svg class="${cls} is-hex" viewBox="${HEX_GEO.viewBox}" aria-hidden="true" focusable="false">` +
        `<use class="ti-hex" href="#pmi-hex"/><path class="ti-ico" d="${placed(v.d)}"/></svg>`;
    }
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="ti-ico" d="${v.d}"/></svg>`;
  }

  /* ---------------------------------------------------------------------------
     Zoeken
     ------------------------------------------------------------------------- */

  // Reserve als search.js ontbreekt of faalt: alle woorden moeten in naam of categorie staan
  function simpleEngine() {
    const all = ICONS.map((_, i) => i);
    const hay = ICONS.map((ic) => `${ic[0].replace(/-/g, ' ')} ${CATS[ic[1]]} ${catLabel(ic[1])}`.toLowerCase());
    return {
      search(q) {
        const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) return { ids: all, fuzzy: false };
        return { ids: all.filter((i) => words.every((w) => hay[i].includes(w))), fuzzy: false };
      },
    };
  }

  let engine;
  try {
    engine = window.PMIconSearch.create({
      icons: ICONS,
      categories: CATS,
      categoryLabels: CATEGORY_LABELS,
      tags: window.PM_ICON_TAGS || {},
    });
  } catch (err) {
    console.error('Icon Finder: PMIconSearch niet beschikbaar, zoeken alleen op naam.', err);
    engine = simpleEngine();
  }

  function search(q) {
    try {
      const r = engine.search(q);
      return { ids: Array.isArray(r && r.ids) ? r.ids : [], fuzzy: !!(r && r.fuzzy) };
    } catch (err) {
      console.error('Icon Finder: zoeken mislukt, zoeken alleen op naam.', err);
      engine = simpleEngine();
      return engine.search(q);
    }
  }

  let found = { ids: [], fuzzy: false };

  function runSearch({ scroll = true } = {}) {
    const q = el.q.value.trim().replace(/\s+/g, ' ');
    const changed = q !== state.query;
    state.query = q;
    found = search(q);
    syncClear();
    updateChips();
    render();
    if (changed && scroll) scrollToResults();
    if (changed) announce();
    syncUrl();
  }

  let searchFrame = 0;
  el.q.addEventListener('input', () => {
    syncClear();
    cancelAnimationFrame(searchFrame);
    searchFrame = requestAnimationFrame(() => runSearch());
  });

  function setQuery(q) {
    el.q.value = q;
    cancelAnimationFrame(searchFrame);
    runSearch();
  }

  function syncClear() {
    const has = !!el.q.value;
    el.qClear.hidden = !has;
    el.search.classList.toggle('has-value', has);
  }

  el.qClear.addEventListener('click', () => {
    setQuery('');
    el.q.focus();
  });

  el.q.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (el.q.value) {
        e.preventDefault();
        setQuery('');
      }
    } else if (e.key === 'ArrowDown' || (e.key === 'Enter' && !narrowMq.matches)) {
      // Door naar de iconen; Enter kiest meteen het eerste resultaat
      const first = nav.length ? nav[0][0] : null;
      if (!first) return;
      e.preventDefault();
      cancelAnimationFrame(searchFrame);
      if (el.q.value.trim() !== state.query) runSearch();
      const target = e.key === 'Enter' ? nav[0][0] : roving || nav[0][0];
      focusTile(target, { select: e.key === 'Enter' || !narrowMq.matches });
    } else if (e.key === 'Enter') {
      el.q.blur();   // mobiel: toetsenbord weg, resultaten in beeld
    }
  });

  // Plaatshouder die past: lang als er ruimte is, anders korter
  const PLACEHOLDERS = [
    [560, 'zoek in het Nederlands of Engels, bijv. prullenbak, pijl of grafiek'],
    [400, 'zoek in het Nederlands of Engels, bijv. prullenbak'],
    [290, 'zoek een icoon, bijv. prullenbak'],
    [0, 'zoek een icoon'],
  ];
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const w = el.q.clientWidth;
      el.q.placeholder = PLACEHOLDERS.find(([min]) => w >= min)[1];
    }).observe(el.q);
  }

  /* ---------------------------------------------------------------------------
     Categorieën
     ------------------------------------------------------------------------- */

  function buildChips() {
    const chip = (c, label) => `<label class="chip"><input type="radio" name="cat" value="${c}">` +
      `<span class="chip__txt">${PM.esc(label)}</span><span class="chip__n">0</span></label>`;
    el.chips.innerHTML = chip(-1, 'alles') + CAT_ORDER.map((c) => chip(c, catLabel(c))).join('');
  }
  buildChips();
  // Op categorie-index: chipInputs[0] is "alles", chipInputs[c + 1] categorie c
  const chipInputs = $$('input', el.chips).sort((a, b) => Number(a.value) - Number(b.value));

  // Aantallen per categorie voor de zoekterm; lege categorieën gedimd en achteraan,
  // zodat de categorieën met treffers vooraan in beeld staan
  function updateChips() {
    const counts = new Array(CATS.length).fill(0);
    for (const i of found.ids) counts[ICONS[i][1]]++;
    for (const input of chipInputs) {
      const c = Number(input.value);
      const n = c < 0 ? found.ids.length : counts[c];
      input.parentNode.lastChild.textContent = fmt(n);
      input.disabled = c >= 0 && n === 0 && c !== state.cat;
      input.checked = c === state.cat;
    }
    const live = (c) => counts[c] > 0 || c === state.cat;
    const hits = CAT_ORDER.filter(live);
    if (state.query) hits.sort((a, b) => counts[b] - counts[a]);   // stabiel: bij gelijk aantal op naam
    const order = [-1, ...hits, ...CAT_ORDER.filter((c) => !live(c))];
    const labels = order.map((c) => chipInputs[c + 1].parentNode);
    if (labels.some((label, k) => el.chips.children[k] !== label)) {
      el.chips.append(...labels);
      el.chips.scrollLeft = 0;
      syncChipScroll();
    }
  }

  function setCat(c, { scroll = true } = {}) {
    state.cat = c;
    updateChips();
    render();
    if (scroll) scrollToResults();
    announce();
    syncUrl();
    revealChip();
  }

  el.chips.addEventListener('change', (e) => {
    if (e.target.name === 'cat' && e.target.checked) setCat(Number(e.target.value));
  });

  // De gekozen categorie in de scrollende rij in beeld (zonder de pagina te verschuiven)
  function revealChip() {
    const input = chipInputs.find((i) => i.checked);
    if (!input) return;
    const chip = input.parentNode;
    const row = el.chips;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft + 40 || left + chip.offsetWidth > row.scrollLeft + row.clientWidth - 40) {
      row.scrollTo({ left: Math.max(0, left - 48), behavior: 'auto' });
    }
  }

  function syncChipScroll() {
    const row = el.chips;
    const start = row.scrollLeft > 4;
    const end = row.scrollLeft + row.clientWidth < row.scrollWidth - 4;
    el.chipsWrap.classList.toggle('can-prev', start);
    el.chipsWrap.classList.toggle('can-next', end);
  }
  el.chips.addEventListener('scroll', syncChipScroll, { passive: true });
  window.addEventListener('resize', syncChipScroll);
  el.chipsPrev.addEventListener('click', () => el.chips.scrollBy({ left: -el.chips.clientWidth * 0.7, behavior: smooth() }));
  el.chipsNext.addEventListener('click', () => el.chips.scrollBy({ left: el.chips.clientWidth * 0.7, behavior: smooth() }));

  /* ---------------------------------------------------------------------------
     Raster
     ------------------------------------------------------------------------- */

  const tileCache = new Map();   // icoon -> tegel, voor de huidige stijl en vorm
  let tileKey = '';
  let nav = [];                  // tegels per blok, in schermvolgorde (pijltjestoetsen)
  let roving = null;             // de ene tegel die Tab bereikt
  let tileH = 108;               // hoogte van een tegel, gemeten na de eerste keer tekenen

  function tileHtml(i) {
    const name = PM.esc(readable(i));
    const title = name.length > 22 ? ` title="${name}"` : '';
    return `<button type="button" class="tile" data-i="${i}" tabindex="-1" aria-pressed="${i === state.selected}"${title}>` +
      `${artSvg(i, 'tile__svg')}<span class="tile__name">${name}</span></button>`;
  }

  function tilesFor(ids) {
    const key = `${state.style}|${state.shape}`;
    if (key !== tileKey) {
      tileCache.clear();
      tileKey = key;
      roving = null;
    }
    const missing = ids.filter((i) => !tileCache.has(i));
    if (missing.length) {
      const tpl = document.createElement('template');
      tpl.innerHTML = missing.map(tileHtml).join('');
      Array.from(tpl.content.children).forEach((node, k) => tileCache.set(missing[k], node));
    }
    return ids.map((i) => tileCache.get(i));
  }

  function visibleIds() {
    return state.cat < 0 ? found.ids : found.ids.filter((i) => ICONS[i][1] === state.cat);
  }

  const recentIds = () => [...new Set(state.recent.map(indexOf).filter((i) => i >= 0))];

  function columns() {
    const grid = el.results.querySelector('.grid');
    if (grid) return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
    const cs = getComputedStyle(el.results);
    const w = el.results.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Math.max(1, Math.floor((w + 4) / 96));
  }

  // Kopie voor "laatst gebruikt": die iconen staan ook in hun eigen categorie
  const copyTile = (t) => {
    const copy = t.cloneNode(true);
    copy.tabIndex = -1;
    return copy;
  };

  // Blok met kop en een leeg raster; de tegels komen met fillStep()
  function buildShell(s, n, cols) {
    const sec = document.createElement('div');
    sec.className = s.flat ? 'sect sect--flat' : s.recent ? 'sect sect--recent' : 'sect';
    if (s.title) {
      const id = `sect-${n}`;
      sec.setAttribute('role', 'group');
      sec.setAttribute('aria-labelledby', id);
      sec.innerHTML = `<div class="sect__head"><h3 class="sect__title" id="${id}">${PM.esc(s.title)}` +
        ` <span class="sect__count">${fmt(s.ids.length)}</span></h3>` +
        `${s.recent ? '<button type="button" class="sect__clear" data-clear-recent>wissen</button>' : ''}</div>`;
      // Geschatte hoogte zolang het blok buiten beeld niet getekend wordt
      sec.style.containIntrinsicSize = `auto ${Math.round(44 + Math.ceil(s.ids.length / cols) * (tileH + 4))}px`;
    }
    const grid = document.createElement('div');
    grid.className = 'grid';
    sec.append(grid);
    Object.assign(s, { el: sec, grid, tiles: [], done: !s.ids.length });
    return sec;
  }

  /* De tegels van de blokken in beeld komen meteen, de rest in stukjes van
     hoogstens 8 ms per frame: typen en wisselen van stijl blijven vlot, ook als
     1.690 zeshoeken voor het eerst worden uitgerekend. */
  let pending = [];
  let fillFrame = 0;

  function fillStep(s, max) {
    let tiles = tilesFor(s.ids.slice(s.tiles.length, s.tiles.length + max));
    if (s.recent) tiles = tiles.map(copyTile);
    s.grid.append(...tiles);
    s.tiles.push(...tiles);
    s.done = s.tiles.length >= s.ids.length;
  }

  function fillLoop() {
    const t0 = performance.now();
    while (pending.length && performance.now() - t0 < 8) {
      fillStep(pending[0], 48);
      if (pending[0].done) pending.shift();
    }
    fillFrame = pending.length ? requestAnimationFrame(fillLoop) : 0;
    if (!pending.length) filled();
  }

  // Alles meteen af, voor de pijltjestoetsen
  function flushFill() {
    if (!pending.length) return;
    cancelAnimationFrame(fillFrame);
    fillFrame = 0;
    for (const s of pending) if (!s.done) fillStep(s, Infinity);
    pending = [];
    filled();
  }

  // Klaar: Tab gaat naar het gekozen icoon, ook als dat pas later getekend werd
  function filled() {
    if (state.selected < 0 || el.results.contains(document.activeElement)) return;
    if (roving && Number(roving.dataset.i) === state.selected) return;
    const tile = el.results.querySelector(`.sect:not(.sect--recent) .tile[data-i="${state.selected}"]`);
    if (tile) setRoving(tile);
  }

  function render() {
    const ids = visibleIds();
    const sections = [];
    if (!state.query) {
      const recent = state.cat < 0 ? recentIds() : [];
      if (recent.length) sections.push({ recent: true, title: 'Laatst gebruikt', ids: recent });
      const buckets = CATS.map(() => []);
      for (const i of ids) buckets[ICONS[i][1]].push(i);
      for (const c of CAT_ORDER) if (buckets[c].length) sections.push({ title: catLabel(c), ids: buckets[c] });
    } else if (ids.length) {
      sections.push({ flat: true, ids });
    }

    const focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.tile') : null;
    const cols = columns();
    cancelAnimationFrame(fillFrame);
    pending = [];
    const frag = document.createDocumentFragment();
    if (state.query && found.fuzzy && ids.length) {
      const p = document.createElement('p');
      p.className = 'notice';
      p.innerHTML = `Geen exacte treffers voor &lsquo;<b>${PM.esc(state.query)}</b>&rsquo;. Deze komen het dichtst in de buurt:`;
      frag.append(p);
    }
    sections.forEach((s, n) => frag.append(buildShell(s, n, cols)));
    if (!sections.length) frag.append(emptyState());
    el.results.replaceChildren(frag);
    nav = sections.map((s) => s.tiles);

    // Nu: wat in beeld staat, en het blok met het gekozen of gefocuste icoon
    const keep = new Set([state.selected, focused ? Number(focused.dataset.i) : -1]);
    const rects = sections.map((s) => s.el.getBoundingClientRect());
    const bottom = window.innerHeight + 600;
    sections.forEach((s, n) => {
      if (s.flat) fillStep(s, cols * 12);
      else if ((rects[n].bottom > -200 && rects[n].top < bottom) || s.ids.some((i) => keep.has(i))) fillStep(s, Infinity);
      if (!s.done) pending.push(s);
    });
    if (pending.length) fillFrame = requestAnimationFrame(fillLoop);

    renderCount(ids.length);
    syncRoving(focused);
    const first = nav.length && nav[0][0];
    if (first && first.offsetHeight) tileH = first.offsetHeight;
  }

  // Niets gevonden: in een andere categorie wel? Anders suggesties
  function emptyState() {
    const box = document.createElement('div');
    box.className = 'empty';
    const q = PM.esc(state.query);
    const elsewhere = state.cat >= 0 ? found.ids.length : 0;
    if (elsewhere) {
      box.innerHTML = `<p class="empty__title">Geen iconen voor &lsquo;${q}&rsquo; in ${PM.esc(catLabel(state.cat))}.</p>` +
        `<p class="empty__text">In de andere categorieën staan er ${fmt(elsewhere)}.</p>` +
        `<div class="empty__chips"><button type="button" class="suggest" data-all-cats>zoek in alle categorieën</button></div>`;
      return box;
    }
    const sample = indexOf('search-eye') >= 0 ? indexOf('search-eye') : indexOf('search');
    const art = sample >= 0 ? HEX.svg(ICONS[sample][2] || ICONS[sample][3], { shape: 'hex', fill: '#e8f7fc', color: '#1b71a8', id: 'pmi-empty' }) : '';
    box.innerHTML = `<div class="empty__art" aria-hidden="true">${art}</div>` +
      `<p class="empty__title">Niets gevonden voor &lsquo;${q}&rsquo;.</p>` +
      '<p class="empty__text">Probeer een ander woord, of het Engelse woord ervoor. Of begin met een van deze:</p>' +
      `<div class="empty__chips">${SUGGESTIONS.map((w) => `<button type="button" class="suggest" data-suggest="${w}">${w}</button>`).join('')}</div>`;
    return box;
  }

  function countText(n) {
    let t = `${fmt(n)} ${n === 1 ? 'icoon' : 'iconen'}`;
    if (state.query) t += ` voor ‘${state.query}’`;
    if (state.cat >= 0) t += ` in ${catLabel(state.cat)}`;
    return t;
  }

  function renderCount(n) {
    const parts = [`<b>${fmt(n)} ${n === 1 ? 'icoon' : 'iconen'}</b>`];
    if (state.query) parts.push(`voor &lsquo;${PM.esc(state.query)}&rsquo;`);
    if (state.cat >= 0) parts.push(`in ${PM.esc(catLabel(state.cat))}`);
    el.count.innerHTML = parts.join(' ');
    el.gridTip.hidden = n === 0;
  }

  // Voor schermlezers: pas als het typen even stilstaat
  const announce = PM.debounce(() => {
    el.countLive.textContent = countText(visibleIds().length);
  }, 900);

  // Na een nieuwe zoekterm of categorie: terug naar het begin van de resultaten
  function scrollToResults() {
    const barBottom = el.bar.getBoundingClientRect().bottom;
    const top = el.resultsWrap.getBoundingClientRect().top;
    if (top < barBottom - 1) window.scrollBy(0, top - barBottom);
  }

  /* ---------------------------------------------------------------------------
     Kiezen en bladeren met het toetsenbord
     ------------------------------------------------------------------------- */

  function setRoving(tile) {
    if (roving && roving !== tile) roving.tabIndex = -1;
    roving = tile || null;
    if (roving) roving.tabIndex = 0;
  }

  function syncRoving(focused) {
    let target = null;
    if (focused && focused.isConnected) target = focused;
    if (!target && state.selected >= 0) target = el.results.querySelector(`.tile[data-i="${state.selected}"]`);
    if (!target && nav.length) target = nav[0][0];
    setRoving(target);
    // Een tegel die het focus had, is net verplaatst: focus terugzetten
    if (focused && target === focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
  }

  function markPressed(i, on) {
    if (i < 0) return;
    const cached = tileCache.get(i);
    if (cached) cached.setAttribute('aria-pressed', String(on));
    for (const t of el.results.querySelectorAll(`.tile[data-i="${i}"]`)) t.setAttribute('aria-pressed', String(on));
  }

  function select(i, { open = false } = {}) {
    if (i !== state.selected) {
      markPressed(state.selected, false);
      state.selected = i;
      markPressed(i, true);
      renderDetail();
      syncUrl();
    }
    if (open && i >= 0) openSheet();
  }

  function focusTile(tile, { select: pickIt = !narrowMq.matches } = {}) {
    if (!tile) return;
    setRoving(tile);
    tile.focus({ preventScroll: true });
    tile.scrollIntoView({ block: 'nearest' });
    if (pickIt) select(Number(tile.dataset.i));
  }

  function locate(tile) {
    for (let s = 0; s < nav.length; s++) {
      const k = nav[s].indexOf(tile);
      if (k >= 0) return [s, k];
    }
    return null;
  }

  // Volgende tegel voor een pijltjestoets; omhoog en omlaag blijven in dezelfde kolom
  function neighbour(tile, key) {
    const pos = locate(tile);
    if (!pos) return null;
    const [s, k] = pos;
    const list = nav[s];
    const cols = Math.max(1, getComputedStyle(tile.parentNode).gridTemplateColumns.split(' ').filter(Boolean).length);
    const col = k % cols;
    const last = (arr) => arr[arr.length - 1];
    switch (key) {
      case 'ArrowRight':
        return list[k + 1] || (nav[s + 1] ? nav[s + 1][0] : null);
      case 'ArrowLeft':
        return list[k - 1] || (nav[s - 1] ? last(nav[s - 1]) : null);
      case 'ArrowDown': {
        if (k + cols < list.length) return list[k + cols];
        if (Math.floor(k / cols) < Math.floor((list.length - 1) / cols)) return last(list);
        const next = nav[s + 1];
        return next ? next[Math.min(col, next.length - 1)] : null;
      }
      case 'ArrowUp': {
        if (k - cols >= 0) return list[k - cols];
        const prev = nav[s - 1];
        if (!prev) return null;
        const start = Math.floor((prev.length - 1) / cols) * cols;
        return prev[Math.min(start + col, prev.length - 1)];
      }
      case 'Home':
        return nav[0][0];
      case 'End':
        return last(last(nav));
      case 'PageDown':
      case 'PageUp': {
        const rows = Math.max(1, Math.floor((window.innerHeight - el.bar.offsetHeight) / tileH) - 1);
        let t = tile;
        for (let r = 0; r < rows; r++) t = neighbour(t, key === 'PageDown' ? 'ArrowDown' : 'ArrowUp') || t;
        return t;
      }
      default:
        return null;
    }
  }
  const NAV_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']);

  el.results.addEventListener('keydown', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const mod = e.ctrlKey || e.metaKey;
    if (NAV_KEYS.has(e.key) && !mod && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      flushFill();
      const next = neighbour(tile, e.key);
      if (next && next !== tile) focusTile(next);
      return;
    }
    if (mod && e.key.toLowerCase() === 'c' && !String(window.getSelection())) {
      e.preventDefault();
      select(Number(tile.dataset.i));
      copy();
      return;
    }
    // Typen in het raster gaat verder in het zoekveld
    if (e.key.length === 1 && e.key !== '/' && !mod && !e.altKey && /\S/.test(e.key)) {
      e.preventDefault();
      el.q.focus();
      el.q.value += e.key;
      el.q.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  el.results.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-clear-recent]')) {
      clearRecent();
      return;
    }
    const sug = t.closest('[data-suggest]');
    if (sug) {
      setQuery(sug.dataset.suggest);
      el.q.focus();
      return;
    }
    if (t.closest('[data-all-cats]')) {
      setCat(-1);
      return;
    }
    const tile = t.closest('.tile');
    if (!tile) return;
    setRoving(tile);
    select(Number(tile.dataset.i), { open: narrowMq.matches });
    // Enter of spatie op een tegel: door naar de downloadknop (Esc brengt je terug)
    if (e.detail === 0 && !narrowMq.matches) el.dlBtn.focus();
  });

  // Dubbelklik: meteen downloaden met de instellingen van nu
  el.results.addEventListener('dblclick', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile || narrowMq.matches) return;
    select(Number(tile.dataset.i));
    download();
  });

  /* ---------------------------------------------------------------------------
     Laatst gebruikt
     ------------------------------------------------------------------------- */

  function remember(i) {
    const key = keyOf(i);
    state.recent = [key, ...state.recent.filter((k) => k !== key && indexOf(k) !== i)].slice(0, RECENT_MAX);
    save();
    refreshRecent();
  }

  // Alleen de rij "laatst gebruikt" vernieuwen, niet het hele raster
  function refreshRecent() {
    if (state.query || state.cat >= 0) return;
    const old = el.results.querySelector('.sect--recent');
    const focusedI = old && old.contains(document.activeElement) ? document.activeElement.dataset.i : null;
    const ids = recentIds();
    if (!ids.length) {
      if (old) {
        old.remove();
        nav.shift();
      }
      return;
    }
    const s = { recent: true, title: 'Laatst gebruikt', ids };
    const sec = buildShell(s, 'recent', columns());
    fillStep(s, Infinity);
    const tiles = s.tiles;
    if (old) {
      if (old.contains(roving)) setRoving(null);
      old.replaceWith(sec);
      nav[0] = tiles;
    } else {
      el.results.prepend(sec);
      nav.unshift(tiles);
    }
    if (focusedI != null) {
      const again = tiles.find((t) => t.dataset.i === focusedI);
      if (again) {
        setRoving(again);
        again.focus({ preventScroll: true });
      }
    }
    if (!roving) syncRoving(null);
  }

  function clearRecent() {
    const before = state.recent;
    state.recent = [];
    save();
    refreshRecent();
    toast('Laatst gebruikt is leeg.', false, {
      label: 'ongedaan maken',
      run: () => {
        state.recent = before;
        save();
        refreshRecent();
      },
    });
  }

  /* ---------------------------------------------------------------------------
     Stijl, vorm en kleur
     ------------------------------------------------------------------------- */

  function buildSwatches() {
    const hex = state.shape === 'hex';
    const current = hex ? state.hexColor : state.looseColor;
    el.swatches.innerHTML = (hex ? HEX_COLORS : LOOSE_COLORS).map((c) => {
      let sw;
      let edge = '';
      let dot = '';
      if (c.id === 'eigen') {
        // Kleur en plusje volgen in syncColorName(): omtrek zolang hij niet gekozen is
        dot = '<svg class="swatch__plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
        return `<label class="swatch swatch--own" title="${c.name}">` +
          `<input type="radio" name="color" value="eigen" aria-label="${c.name}"${c.id === current ? ' checked' : ''}>` +
          `<span class="swatch__hex" aria-hidden="true">${dot}</span></label>`;
      }
      sw = hex ? c.fill : c.color;
      if (hex) dot = `<span class="swatch__ico" style="--sw-ico: ${c.color}"></span>`;
      if (tooLight(sw)) edge = '--sw-edge: var(--pm-muted);';   // wit: met een rand, anders zie je hem niet
      const checked = c.id === current ? ' checked' : '';
      return `<label class="swatch" title="${c.name}" style="--sw: ${sw}; ${edge}">` +
        `<input type="radio" name="color" value="${c.id}" aria-label="${c.name}"${checked}>` +
        `<span class="swatch__hex" aria-hidden="true">${dot}</span></label>`;
    }).join('');
    syncColorName();
  }

  const colorId = () => (state.shape === 'hex' ? state.hexColor : state.looseColor);
  // Naam van de gekozen kleur zoals hij naast de stalen staat ("cyaan · inkt")
  const colorLabel = () => {
    const c = (state.shape === 'hex' ? HEX_COLORS : LOOSE_COLORS).find((x) => x.id === colorId());
    return c ? c.label || c.id : colorId();
  };

  /* De gekozen kleur als tekst naast de stalen ("blauw"). Bij "eigen" is die tekst
     de knop naar de kleurkiezer ("eigen · #1a2b3c"), en de staal zelf wordt effen
     in die kleur met een plusje; niet gekozen is hij een omtrek met een plusje. */
  function syncColorName() {
    const own = colorId() === 'eigen';
    const value = state.shape === 'hex' ? state.hexCustom : state.looseCustom;
    el.colorName.hidden = own;
    el.colorName.textContent = own ? '' : colorLabel();
    el.colorPick.hidden = !own;
    el.colorPickTxt.textContent = `eigen · ${value}`;
    el.customColor.value = value;
    el.customColor.setAttribute('aria-label', `Eigen kleur wijzigen, nu ${value}`);
    const sw = el.swatches.querySelector('.swatch--own');
    if (sw) {
      sw.style.setProperty('--sw', own ? value : WHITE);
      sw.style.setProperty('--sw-edge', !own ? 'var(--pm-ink)' : tooLight(value) ? 'var(--pm-muted)' : value);
      sw.style.setProperty('--sw-ico', own ? textOn(value) : INK);
    }
  }

  function syncStyleControls() {
    $$('input[name="style"]').forEach((r) => { r.checked = r.value === state.style; });
    $$('input[name="shape"]').forEach((r) => { r.checked = r.value === state.shape; });
    const shapeName = state.shape === 'hex' ? 'zeshoek' : 'los';
    el.styleSummary.textContent = `${state.style === 'line' ? 'lijn' : 'vol'} · ${shapeName} · ${colorLabel().replace(' · ', '/')}`;
    const sample = indexOf('palette') >= 0 ? indexOf('palette') : 0;
    el.styleArt.innerHTML = artSvg(sample);
  }

  // Na elke wijziging van stijl, vorm of kleur
  function looksChanged({ tiles = false } = {}) {
    applyLooks();
    if (tiles) render();
    syncStyleControls();
    renderDetail();
    save();
  }

  $$('input[name="style"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.style = r.value;
    looksChanged({ tiles: true });
  }));

  $$('input[name="shape"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.shape = r.value;
    buildSwatches();
    looksChanged({ tiles: true });
  }));

  let lastPointer = 0;
  el.swatches.addEventListener('pointerdown', () => { lastPointer = performance.now(); });
  el.swatches.addEventListener('change', (e) => {
    const input = e.target;
    if (input.name !== 'color' || !input.checked) return;
    if (state.shape === 'hex') state.hexColor = input.value;
    else state.looseColor = input.value;
    syncColorName();
    looksChanged();
    // Met de muis op "eigen kleur": meteen de kleurkiezer open
    if (input.value === 'eigen' && performance.now() - lastPointer < 1500) {
      try {
        el.customColor.showPicker();
      } catch (err) {
        /* niet overal: dan via "eigen · #…" naast de stalen */
      }
    }
  });

  let colorFrame = 0;
  el.customColor.addEventListener('input', () => {
    const value = el.customColor.value.toLowerCase();
    if (state.shape === 'hex') {
      state.hexCustom = value;
      state.hexColor = 'eigen';
    } else {
      state.looseCustom = value;
      state.looseColor = 'eigen';
    }
    syncColorName();
    cancelAnimationFrame(colorFrame);
    colorFrame = requestAnimationFrame(() => looksChanged());
  });

  // Mobiel: stijl, vorm en kleur achter de knop "stijl"
  el.styleToggle.addEventListener('click', () => {
    const open = el.styleToggle.getAttribute('aria-expanded') !== 'true';
    el.styleToggle.setAttribute('aria-expanded', String(open));
    el.bar.classList.toggle('is-styles-open', open);
  });

  /* ---------------------------------------------------------------------------
     Detail en export
     ------------------------------------------------------------------------- */

  function renderDetail() {
    const i = state.selected;
    el.detailEmpty.hidden = i >= 0;
    el.detailMain.hidden = i < 0;
    if (i < 0) return;
    const v = variant(i);
    const L = looks();
    el.dArt.innerHTML = HEX.svg(v.d, svgOpts(L, 'pmi-preview'));
    el.dArtM.innerHTML = HEX.svg(v.d, svgOpts(L, 'pmi-preview-m'));
    el.dArtS.innerHTML = HEX.svg(v.d, svgOpts(L, 'pmi-preview-s'));
    el.dArt.classList.toggle('is-loose', L.shape !== 'hex');
    el.dName.innerHTML = `${PM.esc(cap(readable(i)))}<span class="dot">.</span>`;
    el.dFile.textContent = ICONS[i][0] + v.suffix;
    el.dCat.textContent = catLabel(ICONS[i][1]);
    el.dCat.dataset.cat = String(ICONS[i][1]);
    // De Nederlandse woorden waarop je hem vindt (het deel vóór de dubbele spatie in PM_ICON_TAGS)
    const nl = typeof TAGS[ICONS[i][0]] === 'string' ? TAGS[ICONS[i][0]].split('  ')[0] : '';
    const words = [...new Set(nl.split(/\s+/).filter(Boolean))].slice(0, 5);
    el.dWords.hidden = !words.length;
    el.dWords.innerHTML = words.length ? `In het Nederlands: ${words.map((w) => `<b>${PM.esc(w)}</b>`).join(', ')}` : '';
    el.dStyleWrap.hidden = !v.both;
    el.dSingle.hidden = v.both;
    $$('input[name="dstyle"]').forEach((r) => { r.checked = r.value === v.style; });
    syncStage();
    syncExport();
  }

  function syncStage() {
    el.dStage.classList.remove(...STAGES.map((s) => `stage--${s}`));
    el.dStage.classList.add(`stage--${state.stage}`);
    $$('input[name="stage"]').forEach((r) => { r.checked = r.value === state.stage; });
  }

  // Maat van de PNG: een zeshoek is smaller dan hij hoog is (512 hoog = 452 breed)
  function outSize(L = looks(), h = state.size) {
    return { w: L.shape === 'hex' ? Math.round((h * HEX.WIDTH) / HEX.HEIGHT) : h, h };
  }

  function syncExport() {
    const png = state.format === 'png';
    $$('input[name="format"]').forEach((r) => { r.checked = r.value === state.format; });
    $$('input[name="size"]').forEach((r) => { r.checked = Number(r.value) === state.size; });
    el.sizeRow.hidden = !png;
    const { w, h } = outSize();
    el.dDims.textContent = png ? `${w} × ${h} px` : 'vector';
    $('[data-label]', el.dlBtn).textContent = `download ${state.format}`;
    el.dUse.innerHTML = png
      ? '<b>PNG</b> voor PowerPoint, Google Slides, Canva en Word, met een transparante achtergrond.'
      : '<b>SVG</b> blijft scherp op elk formaat: voor Figma, Illustrator en het web.';
    el.copyBtn.title = png ? 'Kopieer de afbeelding, om direct te plakken' : 'Kopieer de SVG-code, om in Figma of je code te plakken';
    el.dNote.innerHTML = (png ? 'Kopieer plakt de afbeelding direct in je slide of document.' : 'Kopieer geeft de SVG-code: in Figma plak je hem als vector.') +
      '<span class="for-mouse"> <kbd>Ctrl</kbd> + <kbd>S</kbd> downloadt direct.</span>';
  }

  $$('input[name="dstyle"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.style = r.value;
    looksChanged({ tiles: true });
  }));
  $$('input[name="stage"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.stage = r.value;
    stageAuto = false;
    syncStage();
    save();
  }));
  $$('input[name="format"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.format = r.value;
    syncExport();
    save();
  }));
  $$('input[name="size"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.size = Number(r.value);
    syncExport();
    save();
  }));

  // Categorie van het gekozen icoon: toon ze allemaal
  el.dCat.addEventListener('click', () => {
    const c = Number(el.dCat.dataset.cat);
    if (el.sheet.open) el.sheet.close();
    el.q.value = '';
    state.query = '';
    found = search('');
    syncClear();
    setCat(c);
  });

  /* ---------------------------------------------------------------------------
     Bestanden: SVG en PNG
     ------------------------------------------------------------------------- */

  // home-line.svg, home-line-cyaan.svg, home-fill-zeshoek-donker-512px.png, home-line-eigen-1a2b3c.svg
  function fileBase(i, L = looks()) {
    return [ICONS[i][0] + variant(i).suffix, L.slug].filter(Boolean).join('-');
  }

  function makeSvg(i) {
    const L = looks();
    const base = fileBase(i, L);
    const text = HEX.svg(variant(i).d, svgOpts(L, HEX.gradientId(base)));
    return { text, name: `${base}.svg`, blob: new Blob([text], { type: 'image/svg+xml' }) };
  }

  /**
   * PNG zonder kwaliteitsverlies: de SVG krijgt zelf al de exportmaat (height),
   * wordt als afbeelding geladen en op een canvas van precies die maat getekend.
   * Nooit klein tekenen en opschalen. Achtergrond transparant.
   */
  async function makePng(i, size = state.size) {
    const L = looks();
    const base = fileBase(i, L);
    const text = HEX.svg(variant(i).d, svgOpts(L, HEX.gradientId(base), size));
    const { w, h } = outSize(L, size);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(src);
    }
    const blob = await PM.canvasToBlob(canvas, 'image/png');
    return { blob, name: `${base}-${size}px.png` };
  }

  const makeFile = (i) => (state.format === 'png' ? makePng(i) : Promise.resolve(makeSvg(i)));

  async function saveFile(i) {
    const file = await makeFile(i);
    PM.saveBlob(file.blob, file.name);
    remember(i);
    toast(`Gedownload: ${file.name}`);
  }

  // Hoofdactie; loopt de knop nog (of staat hij op "✓ gedownload"), dan zonder knopfeedback
  function download() {
    const i = state.selected;
    if (i < 0) {
      toast('Kies eerst een icoon.');
      return;
    }
    if (el.dlBtn.disabled) {
      saveFile(i).catch((err) => toast(err.message || 'Downloaden lukte niet.', true));
      return;
    }
    PM.run(el.dlBtn, 'bezig…', async () => {
      await saveFile(i);
      return 'gedownload';
    });
  }

  async function writeText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      /* geen toegang tot het klembord: dan de oude manier */
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('Kopiëren lukte niet in deze browser. Gebruik download.');
  }

  async function copyImage(i) {
    if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === 'undefined') throw new Error(NO_IMAGE_COPY);
    // Het item meteen maken (nog binnen de klik), de PNG volgt: Safari wil dat zo
    const blob = makePng(i).then((f) => f.blob);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (err) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await blob })]);
      } catch (err2) {
        console.error(err2);
        throw new Error(NO_IMAGE_COPY);
      }
    }
  }

  function copy() {
    const i = state.selected;
    if (i < 0) {
      toast('Kies eerst een icoon.');
      return;
    }
    PM.run(el.copyBtn, 'kopiëren…', async () => {
      if (state.format === 'png') {
        await copyImage(i);
        toast('Afbeelding gekopieerd. Plak hem in PowerPoint, Google Slides, Canva of Word.');
      } else {
        await writeText(makeSvg(i).text);
        toast('SVG-code gekopieerd. Plak hem in Figma, Illustrator of je code.');
      }
      remember(i);
      return 'gekopieerd';
    });
  }

  el.dlBtn.addEventListener('click', download);
  el.copyBtn.addEventListener('click', copy);
  // Na een export de knopteksten van nu terugzetten
  el.detail.addEventListener('pm:run-end', syncExport);

  el.dCopyName.addEventListener('click', async () => {
    try {
      await writeText(el.dFile.textContent);
      el.dCopyName.classList.add('is-copied');
      setTimeout(() => el.dCopyName.classList.remove('is-copied'), 1600);
      toast(`Naam gekopieerd: ${el.dFile.textContent}`);
    } catch (err) {
      toast(err.message, true);
    }
  });

  // Esc in de detailkaart: terug naar het raster
  el.detail.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !narrowMq.matches && roving) {
      e.preventDefault();
      roving.focus();
    }
  });

  /* ---------------------------------------------------------------------------
     Mobiel: het gekozen icoon in een paneel van onderen
     ------------------------------------------------------------------------- */

  let keepOnClose = false;

  function placeDetail() {
    if (narrowMq.matches) {
      if (el.detail.parentNode !== el.sheetPanel) el.sheetPanel.append(el.detail);
      return;
    }
    if (el.sheet.open) {
      keepOnClose = true;
      el.sheet.close();
    }
    if (el.detail.parentNode !== el.aside) el.aside.append(el.detail);
  }

  function openSheet() {
    if (!narrowMq.matches) return;
    placeDetail();
    if (!el.sheet.open) {
      el.sheet.showModal();
      // Meldingen moeten boven het paneel komen: een modaal <dialog> ligt boven alles
      el.sheet.append(el.toast);
      el.sheetClose.focus({ preventScroll: true });
    }
    el.sheet.scrollTop = 0;
  }

  // Dicht is op mobiel ook "niets gekozen", zodat verversen het paneel niet opnieuw opent
  el.sheet.addEventListener('close', () => {
    document.body.append(el.toast);
    if (keepOnClose) {
      keepOnClose = false;
      return;
    }
    select(-1);
  });
  el.sheet.addEventListener('click', (e) => {
    if (e.target === el.sheet) el.sheet.close();
  });
  el.sheetClose.addEventListener('click', () => el.sheet.close());
  narrowMq.addEventListener('change', placeDetail);

  /* ---------------------------------------------------------------------------
     Sneltoetsen en de zoekbalk die blijft staan
     ------------------------------------------------------------------------- */

  const typing = (t) => !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' ||
    (t.tagName === 'INPUT' && !['radio', 'checkbox', 'button', 'color', 'range'].includes(t.type)));

  function focusSearch() {
    if (el.sheet.open) el.sheet.close();
    el.q.focus();
    el.q.select();
  }

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && !e.altKey && key === 'k') {
      e.preventDefault();
      focusSearch();
    } else if (mod && !e.altKey && key === 's') {
      e.preventDefault();
      download();
    } else if (e.key === '/' && !mod && !e.altKey && !typing(e.target)) {
      e.preventDefault();
      focusSearch();
    }
  });

  // Hoogte van de zoekbalk (tegels scrollen er niet onder), en een schaduw zodra hij vastzit
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => el.app.style.setProperty('--bar-h', `${el.bar.offsetHeight}px`)).observe(el.bar);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      el.bar.classList.toggle('is-stuck', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }).observe(el.head);
  }

  /* ---------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------- */

  // Voorbeeld in de lege detailkaart
  const sampleIcon = indexOf('search') >= 0 ? indexOf('search') : 0;
  el.emptyArt.innerHTML = HEX.svg(ICONS[sampleIcon][2] || ICONS[sampleIcon][3], { shape: 'hex', fill: HEX_COLORS[0].fill, color: WHITE, id: 'pmi-sample' });

  el.q.value = state.query;
  buildSwatches();
  applyLooks();
  syncStyleControls();
  found = search(state.query);
  syncClear();
  updateChips();
  render();
  placeDetail();
  renderDetail();
  syncChipScroll();
  revealChip();
  performance.mark('pm-icons-ready');   // meetpunt: klaar om te zoeken

  // Desktop: meteen typen. Niet op een touchscreen, daar zou het toetsenbord openspringen.
  if (fineMq.matches && !narrowMq.matches) el.q.focus({ preventScroll: true });

  // Uit een gedeelde link: het gekozen icoon in beeld, op mobiel meteen open
  if (openedWithIcon) {
    const tile = el.results.querySelector(`.sect:not(.sect--recent) .tile[data-i="${state.selected}"]`) ||
      el.results.querySelector(`.tile[data-i="${state.selected}"]`);
    if (tile) {
      setRoving(tile);
      requestAnimationFrame(() => tile.scrollIntoView({ block: 'center' }));
    }
    if (narrowMq.matches) openSheet();
  }
})();
