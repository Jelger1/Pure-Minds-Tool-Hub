/* =============================================================================
   presentation/deck.js — de presentatie als gegevens, zonder DOM
   -----------------------------------------------------------------------------
   Alles wat geen pagina nodig heeft, zodat het getest kan worden
   (tests/presentation.test.js):

     example(datum)          de voorbeeldslides van een nieuwe presentatie
     fields(slide)           de velden die deze layout toont: [{ key, label, name }]
     exampleIssues(deck, o)  welke slides hebben nog voorbeeldtekst, een
                             [invulplek] of niets? [{ index, key, label, name, kind, found }]
     changedSlide(voor, na, actief)   welke slide je na ongedaan maken wilt zien
     move(lijst, van, naar)  een slide verplaatsen (nieuwe lijst)

   In de browser: window.PMDeck. In Node: require('js/presentation/deck.js').
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Voorbeeldinhoud: een nieuwe presentatie laat zien wat er kan
     ------------------------------------------------------------------------- */

  function example(date = '') {
    return [
      { layout: 'title', label: 'pure minds', title: 'Groeien met **online marketing**', subtitle: 'Strategie en plan voor het komende jaar', meta: `Pure Minds · ${date}` },
      { layout: 'section', label: 'hoofdstuk', title: 'Waar staan we nu', subtitle: 'Een eerlijke blik op de huidige resultaten' },
      { layout: 'bullets', label: 'analyse', title: 'Wat we zien in de data', body: 'Het meeste verkeer komt via betaalde zoekcampagnes\nDe landingspagina\'s converteren onder het gemiddelde\nMobiel groeit het hardst, maar converteert het slechtst\nRemarketing wordt nog niet ingezet' },
      { layout: 'split', label: 'aanpak', title: 'Van klik naar klant', body: 'We brengen advertentie en landingspagina samen in één verhaal.\n- heldere belofte boven de vouw\n- één duidelijke actie per pagina\n- testen, meten en bijsturen' },
      { layout: 'table', label: 'cijfers', title: 'Resultaten per kanaal', subtitle: 'Periode: [maand of kwartaal invullen]' },
      { layout: 'quote', label: 'resultaat', style: 'stat', value: '+184%', subtitle: 'meer aanvragen binnen drie maanden', author: 'Bron: [bron invullen]', quote: 'Eindelijk zien we precies waar ons **budget** naartoe gaat.' },
      { layout: 'closing', label: 'contact', title: 'Bedankt', subtitle: 'Vragen? We denken graag met je mee.', body: '[naam] · [functie]\n[e-mailadres]\npureminds.nl' },
    ];
  }

  /* ---------------------------------------------------------------------------
     Velden per layout: dezelfde als in tools/presentation.html (data-for)
     ------------------------------------------------------------------------- */

  const FIELDS = {
    title: ['title', 'subtitle', 'meta', 'label'],
    section: ['title', 'subtitle', 'label'],
    bullets: ['title', 'body', 'label'],
    split: ['title', 'body', 'label'],
    'quote.quote': ['quote', 'author', 'label'],
    'quote.stat': ['value', 'subtitle', 'author', 'label'],
    table: ['title', 'table', 'subtitle', 'label'],
    closing: ['title', 'subtitle', 'body', 'label'],
  };

  // Naam van een veld: [label, met lidwoord]
  const NAMES = {
    title: ['titel', 'de titel'],
    subtitle: ['ondertitel', 'de ondertitel'],
    meta: ['regel onderaan', 'de regel onderaan'],
    label: ['label', 'het label'],
    quote: ['citaat', 'het citaat'],
    author: ['naam en functie', 'naam en functie'],
    value: ['kerncijfer', 'het kerncijfer'],
    body: ['tekst', 'de tekst'],
    table: ['tabel', 'de tabel'],
  };
  const NAMES_BY = {
    'quote.stat': { subtitle: ['toelichting', 'de toelichting bij het cijfer'], author: ['bron', 'de bron'] },
    table: { subtitle: ['toelichting', 'de toelichting onder de tabel'] },
    bullets: { body: ['punten', 'de punten'] },
    closing: { body: ['contactgegevens', 'de contactgegevens'] },
  };

  const variant = (slide) => {
    const layout = slide && slide.layout;
    if (layout === 'quote') return slide.style === 'stat' ? 'quote.stat' : 'quote.quote';
    return FIELDS[layout] ? layout : 'bullets';
  };

  function nameOf(slide, key) {
    const v = variant(slide);
    const n = (NAMES_BY[v] && NAMES_BY[v][key]) || (NAMES_BY[slide && slide.layout] && NAMES_BY[slide.layout][key]) || NAMES[key] || [key, key];
    return { label: n[0], name: n[1] };
  }

  function fields(slide) {
    return FIELDS[variant(slide)].map((key) => ({ key, ...nameOf(slide, key) }));
  }

  /* ---------------------------------------------------------------------------
     Controle vóór het downloaden
     ------------------------------------------------------------------------- */

  // Een invulplek: [naam], [bron invullen]; minstens één letter, dus niet [1]
  const PLACEHOLDER = /\[[^[\]\n]{0,40}?[a-zà-ÿ][^[\]\n]{0,40}?\]/gi;

  const placeholders = (text) => String(text == null ? '' : text).match(PLACEHOLDER) || [];
  const plain = (text) => String(text == null ? '' : text).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const norm = (text) => plain(text).toLowerCase();
  const short = (text, max = 48) => {
    const t = plain(text);
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
  };

  // Voorbeeldteksten die je vergeet te vervangen. Labels, de regel onderaan en
  // de algemene afsluiter ("Bedankt") mag je gewoon laten staan.
  const KEEP = new Set(['label', 'meta']);
  const KEEP_TEXT = new Set(['bedankt', 'vragen? we denken graag met je mee.', 'pureminds.nl']);
  const EXAMPLE_TEXTS = (() => {
    const set = new Set();
    for (const s of example()) {
      for (const key of Object.keys(NAMES)) {
        if (KEEP.has(key) || typeof s[key] !== 'string') continue;
        const lines = key === 'body' ? s.body.split('\n') : [s[key]];
        for (const line of lines) {
          const t = norm(line);
          if (t && !KEEP_TEXT.has(t) && !placeholders(t).length) set.add(t);
        }
      }
    }
    return set;
  })();

  const sameCells = (a, b) => Array.isArray(a) && Array.isArray(b) && JSON.stringify(a.map((r) => r.map((c) => plain(c)))) === JSON.stringify(b.map((r) => r.map((c) => plain(c))));

  /**
   * Wat moet er nog aan vóór je downloadt? Per slide, alleen de velden die de
   * layout toont:
   *   kind 'invulplek'  er staat nog een [invulplek] in
   *   kind 'voorbeeld'  nog de voorbeeldtekst of de voorbeeldtabel
   *   kind 'leeg'       de slide is helemaal leeg, of het kerncijfer ontbreekt
   * opts: { exampleTable: cellen van de voorbeeldtabel, hasPhoto(index) }
   */
  function exampleIssues(deck, opts = {}) {
    const slides = deck && Array.isArray(deck.slides) ? deck.slides : [];
    const hasPhoto = typeof opts.hasPhoto === 'function' ? opts.hasPhoto : () => false;
    const out = [];
    slides.forEach((slide, index) => {
      if (!slide || typeof slide !== 'object') return;
      const list = fields(slide);
      const add = (f, kind, found) => out.push({ index, key: f.key, label: f.label, name: f.name, kind, found });
      let filled = false;
      for (const f of list) {
        if (f.key === 'table') {
          const cells = slide.table && Array.isArray(slide.table.cells) ? slide.table.cells : [];
          const flat = cells.flat().map((c) => String(c == null ? '' : c));
          if (flat.some((c) => c.trim())) filled = true;
          const ph = flat.flatMap(placeholders);
          if (ph.length) add(f, 'invulplek', ph.slice(0, 3).join(', '));
          else if (opts.exampleTable && sameCells(cells, opts.exampleTable)) add(f, 'voorbeeld', 'de voorbeeldcijfers');
          continue;
        }
        const value = String(slide[f.key] == null ? '' : slide[f.key]);
        if (plain(value) && f.key !== 'label') filled = true;
        const ph = placeholders(value);
        if (ph.length) {
          add(f, 'invulplek', ph.slice(0, 3).join(', '));
          continue;
        }
        if (KEEP.has(f.key)) continue;
        const lines = f.key === 'body' ? value.split('\n') : [value];
        const hit = lines.find((l) => EXAMPLE_TEXTS.has(norm(l)));
        if (hit) add(f, 'voorbeeld', short(hit));
      }
      // Een kerncijfer zonder cijfer toont "0%" op de slide
      if (variant(slide) === 'quote.stat' && !plain(slide.value)) {
        const f = list.find((x) => x.key === 'value');
        if (!out.some((o) => o.index === index && o.key === 'value')) add(f, 'leeg', 'op de slide staat nu 0%');
      } else if (!filled && !hasPhoto(index)) {
        add(list[0], 'leeg', 'nog niets ingevuld');
      }
    });
    return out;
  }

  /* ---------------------------------------------------------------------------
     Slides en ongedaan maken
     ------------------------------------------------------------------------- */

  /**
   * Welke slide wil je zien na ongedaan maken of opnieuw? prev en next zijn de
   * slides voor en na, active de slide die je zag. De slide die je ziet en die
   * veranderde; anders de slide die terugkwam of verdween; anders een andere
   * slide die veranderde; bij alleen een andere volgorde: dezelfde slide volgen.
   */
  function changedSlide(prev, next, active) {
    const before = Array.isArray(prev) ? prev : [];
    const after = Array.isArray(next) ? next : [];
    if (!after.length) return 0;
    const clampI = (i) => Math.min(Math.max(0, i | 0), after.length - 1);
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    const idOf = (s) => (s && s.id != null ? String(s.id) : '');
    const cur = before[active];
    const at = cur ? after.findIndex((s) => idOf(s) === idOf(cur)) : -1;
    if (at >= 0 && !same(cur, after[at])) return at;
    const ids = (list) => list.map(idOf).sort().join('|');
    if (ids(before) === ids(after)) {
      const i = after.findIndex((s) => !same(before.find((x) => idOf(x) === idOf(s)), s));
      if (i >= 0) return i;
      return at >= 0 ? at : clampI(active);
    }
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      if (idOf(before[i]) !== idOf(after[i])) return clampI(i);
    }
    return clampI(active);
  }

  // Nieuwe lijst met het element van `from` op plek `to`
  function move(list, from, to) {
    const out = Array.isArray(list) ? list.slice() : [];
    if (from === to || from < 0 || to < 0 || from >= out.length || to >= out.length) return out;
    const [item] = out.splice(from, 1);
    out.splice(to, 0, item);
    return out;
  }

  const api = { example, fields, nameOf, exampleIssues, placeholders, changedSlide, move, PLACEHOLDER, FIELDS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) global.PMDeck = api;
})(typeof window !== 'undefined' ? window : globalThis);
