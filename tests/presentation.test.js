/* Tests voor js/presentation/deck.js: velden per layout, de controle op voorbeeldtekst en ongedaan maken */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const D = require('../js/presentation/deck.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// De voorbeeldtabel, zoals defaultTable() in js/presentation/templates.js
const TABLE = [
  ['Kanaal', 'Budget', 'Klikken', 'Kosten per klik'],
  ['Google Ads', '€ 4.500', '12.400', '€ 0,36'],
  ['Meta', '€ 2.000', '8.150', '€ 0,25'],
  ['LinkedIn', '€ 1.500', '1.320', '€ 1,14'],
];

// Een nieuwe presentatie zoals defaults() in js/presentation/app.js hem maakt
function fresh() {
  return {
    dot: true,
    slides: D.example('28 september 2026').map((s, i) => ({
      id: `s${i + 1}`, label: '', title: '', subtitle: '', body: '', meta: '', quote: '', author: '', value: '',
      style: 'quote', imageSide: 'left', table: { header: true, firstCol: true, cells: TABLE.map((r) => r.slice()) }, ...s,
    })),
  };
}

const issues = (deck, opts = {}) => D.exampleIssues(deck, { exampleTable: TABLE, ...opts });
const at = (list, index) => list.filter((x) => x.index === index).map((x) => `${x.key}:${x.kind}`);

test('velden per layout: alleen wat de slide toont, met de naam uit de editor', () => {
  assert.deepEqual(D.fields({ layout: 'bullets' }).map((f) => f.key), ['title', 'body', 'label']);
  assert.deepEqual(D.fields({ layout: 'quote', style: 'quote' }).map((f) => f.key), ['quote', 'author', 'label']);
  assert.deepEqual(D.fields({ layout: 'quote', style: 'stat' }).map((f) => f.key), ['value', 'subtitle', 'author', 'label']);
  assert.equal(D.nameOf({ layout: 'bullets' }, 'body').name, 'de punten');
  assert.equal(D.nameOf({ layout: 'closing' }, 'body').label, 'contactgegevens');
  assert.equal(D.nameOf({ layout: 'quote', style: 'stat' }, 'author').label, 'bron');
  assert.equal(D.nameOf({ layout: 'table' }, 'subtitle').name, 'de toelichting onder de tabel');
  assert.deepEqual(D.fields({ layout: 'onbekend' }).map((f) => f.key), ['title', 'body', 'label'], 'onbekend = opsomming');
});

test('velden per layout zijn gelijk aan data-for in de HTML', () => {
  const html = read('tools/presentation.html');
  const inputs = { title: 'sTitle', subtitle: 'sSubtitle', meta: 'sMeta', quote: 'sQuote', author: 'sAuthor', value: 'sValue', body: 'sBody' };
  for (const [key, id] of Object.entries(inputs)) {
    const re = new RegExp(`<div class="field[^"]*"[^>]*data-for="([^"]+)"[^>]*>(?:(?!<div class="field)[\\s\\S])*?id="${id}"`);
    const m = html.match(re);
    assert.ok(m, `veld #${id} heeft een data-for`);
    const shown = m[1].split(/\s+/);
    for (const [variant, keys] of Object.entries(D.FIELDS)) {
      const layout = variant.split('.')[0];
      const on = shown.includes(variant) || shown.includes(layout);
      assert.equal(on, keys.includes(key), `#${id} bij ${variant}`);
    }
  }
});

test('invulplekken: tekst tussen blokhaken met een letter erin', () => {
  assert.deepEqual(D.placeholders('Bron: [bron invullen]'), ['[bron invullen]']);
  assert.deepEqual(D.placeholders('[naam] · [functie]\n[e-mailadres]'), ['[naam]', '[functie]', '[e-mailadres]']);
  assert.deepEqual(D.placeholders('zie noot [1] en [2023]'), []);
  assert.deepEqual(D.placeholders(''), []);
});

test('een nieuwe presentatie: voorbeeldtekst en invulplekken per slide', () => {
  const list = issues(fresh());
  assert.deepEqual(at(list, 0), ['title:voorbeeld', 'subtitle:voorbeeld'], 'label en datum mogen blijven');
  assert.deepEqual(at(list, 1), ['title:voorbeeld', 'subtitle:voorbeeld']);
  assert.deepEqual(at(list, 2), ['title:voorbeeld', 'body:voorbeeld']);
  assert.deepEqual(at(list, 3), ['title:voorbeeld', 'body:voorbeeld']);
  assert.deepEqual(at(list, 4), ['title:voorbeeld', 'table:voorbeeld', 'subtitle:invulplek']);
  assert.deepEqual(at(list, 5), ['value:voorbeeld', 'subtitle:voorbeeld', 'author:invulplek'], 'het citaat is verborgen bij een kerncijfer');
  assert.deepEqual(at(list, 6), ['body:invulplek'], '"Bedankt" en de vraag eronder mogen blijven');
  const author = list.find((x) => x.index === 5 && x.key === 'author');
  assert.equal(author.found, '[bron invullen]');
  assert.equal(author.label, 'bron');
  assert.equal(list.find((x) => x.index === 6).found, '[naam], [functie], [e-mailadres]');
});

test('een ingevulde presentatie is in orde', () => {
  const deck = fresh();
  const s = deck.slides;
  s[0].title = 'Groeiplan **2027**'; s[0].subtitle = 'Voor Studio Noord';
  s[1].title = 'Waar staan we'; s[1].subtitle = '';
  s[2].title = 'Wat we zien'; s[2].body = 'Veel verkeer via Google\nLage conversie op mobiel';
  s[3].title = 'Onze aanpak'; s[3].body = 'Eerst meten.\n- dan testen';
  s[4].title = 'Cijfers Q3'; s[4].subtitle = 'Periode: juli tot september'; s[4].table.cells[1][1] = '€ 5.000';
  s[5].value = '+62%'; s[5].subtitle = 'meer leads'; s[5].author = 'Bron: Google Analytics';
  s[6].body = 'Jan Jansen · directeur\nnaam@voorbeeld.nl\npureminds.nl';
  assert.deepEqual(issues(deck), []);
});

test('één voorbeeldregel in de tekst is genoeg om te melden', () => {
  const deck = fresh();
  deck.slides[2].body = 'Mijn eigen punt\nRemarketing wordt nog niet ingezet';
  const hit = issues(deck).find((x) => x.index === 2 && x.key === 'body');
  assert.equal(hit.kind, 'voorbeeld');
  assert.equal(hit.found, 'Remarketing wordt nog niet ingezet');
  // Nadruk of hoofdletters maken het geen eigen tekst
  deck.slides[1].title = 'waar staan **we** nu';
  assert.ok(issues(deck).some((x) => x.index === 1 && x.key === 'title' && x.kind === 'voorbeeld'));
});

test('lege slides en een kerncijfer zonder cijfer', () => {
  const deck = { slides: [
    { id: 'a', layout: 'bullets', label: 'analyse', title: '', body: '' },
    { id: 'b', layout: 'split', title: '', body: '' },
    { id: 'c', layout: 'quote', style: 'stat', value: '', subtitle: 'meer leads' },
    { id: 'd', layout: 'table', title: '', subtitle: '', table: { cells: [['', ''], ['', '']] } },
  ] };
  const list = issues(deck, { hasPhoto: (i) => i === 1 });
  assert.deepEqual(at(list, 0), ['title:leeg'], 'een label alleen is nog geen inhoud');
  assert.deepEqual(at(list, 1), [], 'beeld + tekst met alleen een foto is in orde');
  assert.deepEqual(at(list, 2), ['value:leeg']);
  assert.deepEqual(at(list, 3), ['title:leeg']);
});

test('invulplekken in de tabel', () => {
  const deck = fresh();
  deck.slides[4].table.cells[2][1] = '[bedrag]';
  const hit = issues(deck).find((x) => x.index === 4 && x.key === 'table');
  assert.equal(hit.kind, 'invulplek');
  assert.equal(hit.found, '[bedrag]');
});

test('ongedaan maken: de slide die veranderde komt in beeld', () => {
  const A = { id: 'a', title: 'A' };
  const B = { id: 'b', title: 'B' };
  const C = { id: 'c', title: 'C' };
  // Typen op de slide die je ziet: daar blijven, ook op een nieuwe plek
  assert.equal(D.changedSlide([A, B, C], [A, { ...B, title: 'b' }, C], 1), 1);
  // Een verwijderde slide komt terug: naar die slide
  assert.equal(D.changedSlide([A, C], [A, B, C], 1), 1);
  // Opnieuw verwijderen: de slide die op zijn plek komt
  assert.equal(D.changedSlide([A, B, C], [A, C], 1), 1);
  assert.equal(D.changedSlide([A, B, C], [A, B], 2), 1, 'laatste slide weg');
  // Een verplaatsing terugdraaien: dezelfde slide volgen
  assert.equal(D.changedSlide([B, A, C], [A, B, C], 0), 1);
  // Een andere slide veranderde: daarheen
  assert.equal(D.changedSlide([A, B, C], [{ ...A, title: 'x' }, B, C], 2), 0);
  // Alleen iets van de hele presentatie (cyaan punt): blijven waar je was
  assert.equal(D.changedSlide([A, B, C], [A, B, C], 2), 2);
  assert.equal(D.changedSlide([], [], 3), 0);
});

test('verplaatsen geeft een nieuwe lijst en negeert onmogelijke plekken', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(D.move(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(D.move(list, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(D.move(list, 1, 9), list);
  assert.deepEqual(list, ['a', 'b', 'c', 'd'], 'origineel blijft staan');
});

test('uitleg en rondleiding (js/presentation/help.js) passen bij de HTML', () => {
  const vm = require('vm');
  const sandbox = { window: {} };
  vm.runInNewContext(read('js/presentation/help.js'), sandbox);
  const H = sandbox.window.PM_HELP.presentation;
  const html = read('tools/presentation.html');
  const words = (t) => String(t).trim().split(/\s+/).length;
  // Elke [?] heeft een tekst, en elke tekst heeft een [?]
  const used = new Set(Array.from(html.matchAll(/data-help="([^"]+)"/g), (m) => m[1]));
  for (const key of used) assert.ok(H.help[key], `tekst voor data-help="${key}"`);
  for (const key of Object.keys(H.help)) assert.ok(used.has(key), `[?] voor "${key}" in de HTML`);
  // Onderdelen = de rail; doelen van de rondleiding bestaan
  assert.deepEqual(Array.from(H.sections, (s) => s.id), Array.from(html.matchAll(/class="rail__item" data-section="([^"]+)"/g), (m) => m[1]));
  for (const step of H.tour) {
    if (step.target) assert.match(html, new RegExp(`data-tour="${step.target}"`), `data-tour="${step.target}"`);
    if (step.section) assert.ok(H.sections.some((s) => s.id === step.section), `onderdeel ${step.section}`);
  }
  // Schrijfwijze uit de kop van help.js: uitleg hoogstens 40 woorden, een stap 35, een titel 5
  for (const [key, h] of Object.entries(H.help)) assert.ok(words(h.text) <= 40, `uitleg "${key}" is ${words(h.text)} woorden`);
  for (const step of H.tour) {
    assert.ok(words(step.text) <= 35, `stap "${step.id}" is ${words(step.text)} woorden`);
    assert.ok(words(step.title) <= 5, `titel van stap "${step.id}"`);
  }
  for (const s of H.sections) assert.ok(s.label.length <= 12, `label ${s.label}`);
});

test('de voorbeeldslides gebruiken alle zeven layouts', () => {
  const layouts = D.example().map((s) => s.layout);
  assert.deepEqual(layouts.slice().sort(), ['bullets', 'closing', 'quote', 'section', 'split', 'table', 'title']);
  assert.match(D.example('1 mei 2026')[0].meta, /1 mei 2026$/);
});
