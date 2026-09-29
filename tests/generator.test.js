/* Tests voor js/presentation/generator.js: van recept naar api, groepen, velden die de generator alleen laat beginnen, en de canvassen */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/presentation/generator.js');
const D = require('../js/presentation/deck.js');

// Een klein recept: een titelslide, een kop en een toelichting in de groep "extra",
// en een slot met een eigen schakelaar (een onderdeel dat ook een slide is)
const UITLEG = '[schrijf hier de uitleg van het blok]';
const recipe = () => ({
  id: 'proef',
  ROLES: Object.freeze(['cover', 'kop', 'uitleg', 'slot']),
  OPTIONAL: Object.freeze({ extra: true, slot: false }),
  PARTS: Object.freeze(['extra', 'slot']),
  GROUP_OF: Object.freeze({ kop: 'extra', uitleg: 'extra' }),
  CONTENT: Object.freeze({ uitleg: Object.freeze(['body']) }),
  LINKS: Object.freeze({ uitleg: Object.freeze({ role: 'kop', key: 'x' }) }),
  ROLE_NAMES: Object.freeze({ cover: 'Titelslide', kop: 'Kop', uitleg: 'Uitleg', slot: 'Slot', extra: 'Extra' }),
  TEXT: Object.freeze({ uitleg: UITLEG }),
  FEEDS: Object.freeze({ naam: 'cover' }),
  FIELD_OF: Object.freeze({ cover: { title: 'naam' }, kop: {} }),
  defaults: (datum) => ({ naam: '', datum: String(datum).slice(0, 20) }),
  normalizeFields(raw, out) {
    if (typeof raw.naam === 'string') out.naam = raw.naam.slice(0, 50);
    if ('datum' in raw) out.datum = typeof raw.datum === 'string' ? raw.datum.slice(0, 20) : '';
  },
  get: (inp, path) => (path === 'naam' || path === 'datum' ? String(inp[path] || '') : ''),
  set(inp, path, value) {
    if (path !== 'naam' && path !== 'datum') return false;
    inp[path] = String(value == null ? '' : value);
    return true;
  },
  context: (inp, api) => ({ K: G.oneLine(inp.naam) || '[klantnaam]', isOn: api.isOn }),
  BUILD: {
    cover: (inp, c) => ({ layout: 'title', label: 'proef', title: `Proef **${c.K}**`, meta: inp.datum }),
    kop: (inp, c) => ({ layout: 'section', label: 'kop', title: 'Kop', subtitle: `**${c.K}**` }),
    uitleg: () => ({ layout: 'toelichting', label: 'uitleg', title: 'Uitleg', body: UITLEG }),
    slot: (inp, c) => ({ layout: 'closing', label: 'slot', title: c.isOn('kop') ? 'Slot met kop' : 'Slot' }),
  },
  checklist(inp, slides, kit) {
    kit.item('naam', 'Naam ingevuld', !!kit.oneLine(inp.naam), { section: 'proef', field: '#naam' });
    if (kit.isOn('uitleg')) {
      const s = kit.slideOf('uitleg');
      kit.item('uitleg', 'Uitleg geschreven', s && kit.written(s.body), { role: 'uitleg', section: 'inhoud' }, { hint: 'vervang de tekst tussen blokhaken', optional: false });
    }
  },
  exports: (api) => ({ aantal: (input) => api.build(input).length }),
});
const A = G.create(recipe());
const roles = (list) => list.map((s) => s.role);

// Een lege slide zoals newSlide() in js/presentation/app.js hem maakt
let seq = 0;
const make = (s) => ({
  id: `s${++seq}`, layout: s.layout, label: '', title: '', subtitle: '', body: '', meta: '', quote: '', author: '', value: '',
  style: 'quote', imageSide: 'left', crop: { zoom: 1, fx: 0.5, fy: 0.5 }, table: { header: true, firstCol: true, cells: [['']] },
  titleSize: 'normaal', photoKey: '', role: '', gen: {}, photoFit: 'cover', vpc: G.emptyVpc(), bmc: G.emptyBmc(),
});
const deck = (inp) => A.sync([], A.build(inp), make).slides;
const byRole = (slides, role) => slides.find((s) => s.role === role);

test('de api van een recept: constanten, en wat alleen dat recept heeft', () => {
  assert.equal(A.id, 'proef');
  assert.deepEqual(A.FIXED, ['cover', 'kop', 'uitleg'], 'slot heeft een schakelaar');
  assert.ok(Object.isFrozen(A.FIXED));
  assert.deepEqual(A.OWNED, G.OWNED);
  assert.ok(Object.isFrozen(G.OWNED));
  assert.deepEqual(G.OWNED, ['layout', 'label', 'title', 'subtitle', 'body', 'meta', 'quote', 'author', 'style', 'table', 'photoFit']);
  assert.equal(A.VPC_INFO, G.VPC_INFO);
  assert.equal(A.BMC_INFO, G.BMC_INFO);
  assert.equal(A.parseColumns, G.parseColumns);
  assert.equal(typeof A.aantal, 'function', 'exports komt in de api');
  assert.equal(A.aantal({}), 3, 'exports krijgt de api mee');
  // Zonder groepen, CONTENT en LINKS: lege objecten
  const bare = G.create({ ...recipe(), GROUP_OF: undefined, CONTENT: undefined, LINKS: undefined, exports: undefined });
  assert.deepEqual([bare.GROUP_OF, bare.CONTENT, bare.LINKS], [{}, {}, {}]);
  assert.ok(!('aantal' in bare));
  // exports mag niets van de api overschrijven; elke rol heeft een BUILD
  assert.throws(() => G.create({ ...recipe(), exports: () => ({ build: () => [] }) }), /build/);
  assert.throws(() => G.create({ ...recipe(), BUILD: { cover: () => ({}) } }), /BUILD/);
});

test('formulier: standaard, normaliseren, lezen en schrijven gaan via het recept', () => {
  const d = A.defaults('mei 2026');
  assert.deepEqual(d, { naam: '', datum: 'mei 2026', parts: { extra: true, slot: false }, hidden: [] });
  assert.deepEqual(Object.keys(d), ['naam', 'datum', 'parts', 'hidden'], 'eigen velden eerst, dan parts en hidden');
  assert.notEqual(A.defaults().parts, A.OPTIONAL, 'een eigen kopie');
  for (const raw of [null, undefined, [], 'tekst', 42]) assert.deepEqual(A.normalizeInput(raw, 'mei'), A.defaults('mei'));
  const n = A.normalizeInput({
    naam: 'Eurosit', onbekend: 1,
    parts: { extra: 'nee', slot: true, cover: false, nieuw: true },
    hidden: ['slot', 'kop', 'nope', 'kop', 'cover'],
  }, 'mei');
  assert.deepEqual(n.parts, { extra: true, slot: true }, 'alleen booleans, alleen schakelaars');
  assert.deepEqual(n.hidden, ['cover', 'kop'], 'alleen vaste slides, één keer, in de vaste volgorde');
  assert.ok(!('onbekend' in n));
  assert.deepEqual(Object.keys(n), Object.keys(A.defaults()));
  assert.deepEqual(A.normalizeInput({ hidden: 'kop' }).hidden, [], 'hidden moet een lijst zijn');
  assert.deepEqual(A.normalizeInput({ parts: ['extra'] }).parts, A.OPTIONAL);
  // Het recept bepaalt de eigen velden, ook de datumregel
  assert.equal(A.normalizeInput({}, 'mei').datum, 'mei');
  assert.equal(A.normalizeInput({ datum: '' }, 'mei').datum, '');
  // Lezen en schrijven: eerst de objectcontrole, dan het recept
  const inp = A.defaults();
  assert.equal(A.set(inp, 'naam', 'Eurosit'), true);
  assert.equal(A.get(inp, 'naam'), 'Eurosit');
  assert.equal(A.get(null, 'naam'), '');
  assert.equal(A.set(inp, 'parts', {}), false);
  assert.equal(A.set(null, 'naam', 'x'), false);
  assert.equal(A.set(inp, 5, 'x'), false);
  assert.doesNotThrow(() => A.build({ parts: null, hidden: 'x' }));
});

test('groepen: een slide in een groep zit er alleen in als zijn onderdeel aan staat', () => {
  const inp = A.defaults();
  assert.deepEqual(roles(A.build(inp)), ['cover', 'kop', 'uitleg'], 'slot staat standaard uit');
  assert.equal(A.isOn(inp, 'extra'), true);
  A.setOn(inp, 'extra', false);
  assert.equal(A.isOn(inp, 'kop'), false, 'niet verborgen, maar de groep staat uit');
  assert.equal(A.isOn(inp, 'uitleg'), false);
  assert.deepEqual(roles(A.build(inp)), ['cover']);
  assert.deepEqual(inp.hidden, [], 'een schakelaar raakt hidden niet');
  // Een slide uit de groep verwijderd, dan de groep uit: niet in "zet terug" zolang de groep uit staat
  A.setOn(inp, 'extra', true);
  A.markRemoved(inp, 'kop');
  assert.deepEqual(inp.hidden, ['kop']);
  assert.deepEqual(A.hiddenRoles(inp), ['kop']);
  assert.deepEqual(roles(A.build(inp)), ['cover', 'uitleg']);
  A.setOn(inp, 'extra', false);
  assert.deepEqual(A.hiddenRoles(inp), [], 'de groep staat uit: niets terug te zetten');
  // Weer aan: de verwijderde slide blijft weg, de rest komt terug
  A.setOn(inp, 'extra', true);
  assert.deepEqual(roles(A.build(inp)), ['cover', 'uitleg']);
  assert.deepEqual(A.hiddenRoles(inp), ['kop']);
  // Een vaste slide buiten een groep; een onderdeel dat ook een slide is
  A.markRemoved(inp, 'cover');
  assert.deepEqual(A.hiddenRoles(inp), ['cover', 'kop'], 'in de vaste volgorde');
  assert.equal(A.setOn(inp, 'slot', true), true);
  assert.equal(A.isOn(inp, 'slot'), true);
  assert.equal(A.markRemoved(inp, 'slot'), true);
  assert.equal(inp.parts.slot, false, 'een slide met een schakelaar gaat uit, niet in hidden');
  assert.equal(A.markRemoved(inp, 'onbekend'), false);
  assert.equal(A.isOn(inp, 'onbekend'), false);
  assert.deepEqual(A.hiddenRoles(null), []);
  // context krijgt isOn mee, op het genormaliseerde formulier
  assert.equal(A.specFor({ parts: { slot: true } }, 'slot').title, 'Slot met kop');
  assert.equal(A.specFor({ parts: { slot: true }, hidden: ['kop'] }, 'slot').title, 'Slot');
});

test('fieldFor volgt FIELD_OF van het recept; [klantnaam] vul je bij de klantnaam in', () => {
  assert.equal(A.fieldFor('cover', 'title'), 'naam');
  assert.equal(A.fieldFor('cover', 'label'), null);
  assert.equal(A.fieldFor('kop', 'subtitle'), null);
  assert.equal(A.fieldFor('kop', 'subtitle', '[klantnaam]'), 'klant');
  assert.equal(A.fieldFor('uitleg', 'body', '[klantnaam]'), null, 'niet in FIELD_OF: bij Inhoud');
  for (const [role, key] of [[null, 'title'], ['', 'title'], ['cover', null], ['cover', 'hasOwnProperty']]) assert.equal(A.fieldFor(role, key), null);
});

test('bijwerken en parkeren: de groep uit en weer aan brengt dezelfde slides terug', () => {
  const inp = { ...A.defaults(), naam: 'Eurosit' };
  let slides = deck(inp);
  assert.deepEqual(roles(slides), ['cover', 'kop', 'uitleg']);
  for (const s of slides) assert.deepEqual(A.touched(s), [], s.role);
  const ids = Object.fromEntries(slides.map((s) => [s.role, s.id]));
  byRole(slides, 'kop').title = 'Eigen kop';
  byRole(slides, 'uitleg').body = 'Mijn uitleg.';
  // Een eigen slide tussendoor blijft staan
  const own = { ...make({ layout: 'bullets' }), title: 'Eigen slide' };
  slides.splice(1, 0, own);

  A.setOn(inp, 'extra', false);
  let r = A.sync(slides, A.build(inp), make, {});
  assert.deepEqual(r.removed, ['kop', 'uitleg']);
  assert.deepEqual(Object.keys(r.parked), ['kop', 'uitleg']);
  assert.deepEqual(roles(r.slides), ['cover', '']);
  inp.naam = 'Eurosit BV';
  r = A.sync(JSON.parse(JSON.stringify(r.slides)), A.build(inp), make, JSON.parse(JSON.stringify(r.parked)));
  assert.deepEqual(r.added, []);

  A.setOn(inp, 'extra', true);
  const back = A.sync(r.slides, A.build(inp), make, r.parked);
  assert.deepEqual(back.added, ['kop', 'uitleg']);
  assert.deepEqual(back.parked, {});
  assert.deepEqual(roles(back.slides), ['cover', 'kop', 'uitleg', ''], 'direct na het dichtstbijzijnde onderdeel ervóór');
  assert.equal(byRole(back.slides, 'kop').id, ids.kop, 'dezelfde slide');
  assert.equal(byRole(back.slides, 'kop').title, 'Eigen kop');
  assert.equal(byRole(back.slides, 'kop').subtitle, '**Eurosit BV**', 'niet aangepast: volgt het formulier');
  assert.equal(byRole(back.slides, 'uitleg').body, 'Mijn uitleg.');
  assert.equal(byRole(back.slides, 'cover').title, 'Proef **Eurosit BV**');

  // Een tweede slide met hetzelfde onderdeel of een onbekend onderdeel wordt een gewone slide
  const dup = { ...byRole(back.slides, 'kop'), id: 'kopie' };
  const odd = { ...make({ layout: 'bullets' }), role: 'bestaatniet', gen: { title: '' } };
  const r2 = A.sync([...back.slides, dup, odd], A.build(inp), make);
  assert.equal(r2.slides.find((s) => s.id === 'kopie').role, '');
  assert.deepEqual(r2.slides.find((s) => s.id === 'kopie').gen, {});
  assert.equal(r2.slides.find((s) => s.id === odd.id).role, '');
  // Parked: alleen bekende rollen met een slide; een id dat al bestaat krijgt een nieuw
  const taken = A.sync([{ ...make({ layout: 'bullets' }), id: 'dubbel' }], [A.specFor(inp, 'kop')], make, { kop: { ...make({ layout: 'section' }), id: 'dubbel', role: 'kop' }, onbekend: {}, cover: 5 });
  assert.deepEqual(taken.slides.map((s) => s.id).filter((id) => id === 'dubbel'), ['dubbel']);
  assert.deepEqual(taken.parked, {});
  assert.deepEqual(A.sync(null, null, null), { slides: [], added: [], removed: [], parked: {} });
});

test('CONTENT: de toelichting begint met een invulplek en is daarna van jou', () => {
  const inp = A.defaults();
  let slides = deck(inp);
  const u = byRole(slides, 'uitleg');
  assert.equal(u.body, UITLEG);
  assert.equal(u.gen.body, UITLEG, 'de generator onthoudt wat hij zette');
  // Zolang je niets schreef, volgt het veld de generator; je eigen tekst telt niet als "aangepast"
  u.body = 'Onze partners leveren **snel**.';
  assert.deepEqual(A.touched(u), []);
  u.title = 'Eigen titel';
  assert.deepEqual(A.touched(u), ['title'], 'de andere velden wel');
  inp.naam = 'Eurosit';
  slides = A.sync(slides, A.build(inp), make).slides;
  assert.equal(byRole(slides, 'uitleg').body, 'Onze partners leveren **snel**.', 'bijwerken laat je tekst staan');
  // Terugzetten: de titel volgt weer, je tekst blijft, met wat de generator ooit zette
  const back = A.resetSlide(byRole(slides, 'uitleg'), A.specFor(inp, 'uitleg'));
  assert.equal(back.title, 'Uitleg');
  assert.equal(back.body, 'Onze partners leveren **snel**.', 'terugzetten wist een toelichting nooit');
  assert.equal(back.gen.body, UITLEG);
  assert.deepEqual(A.touched(back), []);
  // Leeg gemaakt (ook alleen spaties of nadruktekens): de invulplek komt terug, bij bijwerken en bij terugzetten
  for (const empty of ['', '   \n ', '****']) {
    const s = { ...back, body: empty };
    assert.equal(byRole(A.sync([s], A.build(inp), make).slides, 'uitleg').body, UITLEG, JSON.stringify(empty));
    assert.equal(A.resetSlide(s, A.specFor(inp, 'uitleg')).body, UITLEG);
  }
  // Een toelichting zonder onthouden tekst (oud concept) is ook van jou
  const oud = { ...back, body: 'Eigen tekst.', gen: { title: 'Uitleg' } };
  assert.equal(byRole(A.sync([oud], A.build(inp), make).slides, 'uitleg').body, 'Eigen tekst.');
  assert.equal(A.resetSlide(oud, A.specFor(inp, 'uitleg')).body, 'Eigen tekst.');
  assert.ok(!('body' in A.resetSlide(oud, A.specFor(inp, 'uitleg')).gen));
  // Een ander veld dan CONTENT gaat bij terugzetten wel terug
  const kop = { ...byRole(slides, 'kop'), subtitle: 'Eigen' };
  assert.deepEqual(A.touched(kop), ['subtitle']);
  assert.equal(A.resetSlide(kop, A.specFor(inp, 'kop')).subtitle, '**Eurosit**');
  // Herladen en ongedaan maken (JSON) maken niets "aangepast"
  for (const s of JSON.parse(JSON.stringify(deck(inp)))) assert.deepEqual(A.touched(s), [], s.role);
});

test('checklist: eerst het recept, dan de invulplekken en of alles past', () => {
  const ids = (list) => list.map((x) => x.id);
  const inp = A.defaults();
  let slides = deck(inp);
  // De app telt alle invulplekken (zoals checkCounts): [klantnaam] twee keer, en de toelichting
  const values = (s, key) => (key === 'vpc' || key === 'bmc' ? Object.values(s[key] || {}) : [s[key]]);
  const counted = (list) => list.reduce((n, s) => n + D.fields(s).reduce((m, f) => m + values(s, f.key).reduce((k, v) => k + D.placeholders(String(v == null ? '' : v)).length, 0), 0), 0);
  assert.equal(counted(slides), 3);
  let list = A.checklist(inp, slides, { placeholders: counted(slides), overflow: 0 });
  assert.deepEqual(ids(list), ['naam', 'uitleg', 'invulplekken', 'past']);
  for (const x of list) assert.deepEqual(Object.keys(x), ['id', 'label', 'done', 'optional', 'hint', 'go']);
  // De invulplek van de toelichting telt al bij "Uitleg geschreven": niet nog eens, en niet als voorbeeld
  assert.equal(list[2].label, '2 invulplekken over, zoals [klantnaam]');
  assert.equal(list[1].hint, 'vervang de tekst tussen blokhaken');
  inp.naam = 'Eurosit';
  slides = A.sync(slides, A.build(inp), make).slides;
  list = A.checklist(inp, slides, { placeholders: counted(slides), overflow: 0 });
  assert.equal(list[2].label, 'Geen invulplekken meer', 'alleen de toelichting over: die staat hierboven');
  assert.equal(list[2].done, true);
  assert.equal(list[1].done, false);
  // Een lange invulplek als voorbeeld wordt ingekort
  byRole(slides, 'kop').subtitle = '[schrijf hier een heel lange ondertitel voor de kop]';
  list = A.checklist(inp, slides, { placeholders: counted(slides) });
  assert.equal(list[2].label, '1 invulplek over, zoals [schrijf hier een heel lange on…');
  // Een invulplek in de toelichting die niet als tekst op de slide staat, telt de app niet: hier ook niet
  const vpc = { ...byRole(slides, 'uitleg'), layout: 'vpc' };
  const other = slides.map((s) => (s.role === 'uitleg' ? vpc : s));
  assert.equal(A.checklist(inp, other, { placeholders: counted(other) })[2].label, '1 invulplek over, zoals [schrijf hier een heel lange on…');
  // Tellingen die niet kloppen: nooit onder nul
  assert.equal(A.checklist(inp, slides, { placeholders: 0 })[2].done, true);
  assert.deepEqual(A.checklist(inp, slides).slice(-2).map((x) => x.done), [true, true]);
  assert.equal(A.checklist(inp, slides, { overflow: 2 })[3].done, false);
  // Het recept krijgt het genormaliseerde formulier; rare invoer geeft geen fout
  assert.deepEqual(ids(A.checklist(null, [null, 5], 'x')), ['naam', 'uitleg', 'invulplekken', 'past']);
  assert.deepEqual(ids(A.checklist({ parts: { extra: false } }, [])), ['naam', 'invulplekken', 'past']);
});

test('het business model canvas: zeven blokken, in de volgorde van het canvas', () => {
  assert.deepEqual(G.BMC_KEYS, ['partners', 'activiteiten', 'resources', 'proposities', 'relaties', 'kanalen', 'segmenten']);
  assert.ok(Object.isFrozen(G.BMC_KEYS) && Object.isFrozen(G.BMC_INFO) && Object.isFrozen(G.BMC_INFO.partners));
  assert.deepEqual(Object.keys(G.BMC_INFO), G.BMC_KEYS);
  assert.deepEqual(G.BMC_KEYS.map((k) => G.BMC_INFO[k].name), ['Key Partners', 'Kernactiviteiten', 'Key Resources', 'Waardeproposities', 'Klantrelaties', 'Kanalen', 'Klantsegmenten']);
  for (const k of G.BMC_KEYS) assert.match(G.BMC_INFO[k].uitleg, /^[A-Z].+[.?]$/, `uitleg bij ${k}`);
  assert.deepEqual(G.emptyBmc(), Object.fromEntries(G.BMC_KEYS.map((k) => [k, ''])));
  const b = G.normalizeBmc({ partners: 'p'.repeat(5000), kanalen: 5, segmenten: 'B2B', extra: 'x' });
  assert.deepEqual(Object.keys(b), G.BMC_KEYS);
  assert.equal(b.partners.length, 4000);
  assert.equal(b.kanalen, '');
  assert.equal(b.segmenten, 'B2B');
  assert.ok(!('extra' in b));
  for (const raw of [null, undefined, 'x', []]) assert.deepEqual(G.normalizeBmc(raw), G.emptyBmc());
  // De waardepropositie blijft zoals hij was
  assert.deepEqual(G.VPC_KEYS, ['segment', 'klanttype', 'taken', 'pijnen', 'voordelen', 'producten', 'verzachters', 'verschaffers']);
  assert.equal(G.normalizeVpc({ klanttype: 'k'.repeat(300) }).klanttype.length, 200);
});

test('invulplekken, tekst en de tekst van Kolommen en Genummerd', () => {
  assert.equal(G.BLANK.source, D.PLACEHOLDER.source, 'dezelfde invulplek als deck.js');
  assert.equal(G.BLANK.flags, 'i', 'niet globaal');
  assert.equal(G.written('Tekst'), true);
  assert.equal(G.written(' ** ** '), false);
  assert.equal(G.written('Tekst met [invulplek]'), false);
  assert.equal(G.written(null), false);
  assert.equal(G.oneLine('  **Euro**sit\n BV '), 'Eurosit BV');
  assert.equal(G.oneLine(5), '');
  assert.deepEqual(G.parseColumns('Onze visie\nTekst\n\n**Missie**\nMeer'), [{ head: 'Onze visie', text: 'Tekst' }, { head: 'Missie', text: 'Meer' }]);
  assert.deepEqual(G.parseQuestions('1. Pijn - Welke pijn?\nTrend\n\nSlot.'), { items: [{ head: 'Pijn', text: 'Welke pijn?' }, { head: 'Trend', text: '' }], outro: 'Slot.' });
  assert.deepEqual(G.parseQuestions(null), { items: [], outro: '' });
  // Wat gen onthoudt: tekst zoals hij is, een tabel als JSON met vaste sleutelvolgorde
  assert.equal(G.ser('title', 'x'), 'x');
  assert.equal(G.ser('title', null), '');
  assert.equal(G.ser('table', { cells: [['a']], header: false }), G.ser('table', { header: false, firstCol: true, cells: [['a']] }));
  assert.equal(G.stable({ b: 1, a: [2] }), '{"a":[2],"b":1}');
  assert.deepEqual(G.tableOf(null), { header: true, firstCol: true, cells: [['']] });
  assert.deepEqual(G.normalizeGen({ title: 'a', body: 5, vpc: '{}', bmc: '{}' }), { title: 'a' });
});
