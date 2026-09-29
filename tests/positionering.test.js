/* Tests voor js/presentation/positionering.js: de opbouw van de positionering, de vaste teksten, de schakelaars, de toelichting en de checklist */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../js/presentation/generator.js');
const P = require('../js/presentation/positionering.js');
const D = require('../js/presentation/deck.js');

// De echte templates (normalizeTable), geladen zoals de browser ze laadt
const S = (() => {
  const sandbox = { window: { PMGenerator: G } };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ['js/shared/canvas-kit.js', 'js/presentation/templates.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.window.PMSlides;
})();
const plainJson = (v) => JSON.parse(JSON.stringify(v));
// De layouts van templates.js, plus bmc en toelichting (die tekent templates.js zodra ze er zijn)
const LAYOUTS = new Set([...S.LAYOUTS.map((l) => l.id), 'bmc', 'toelichting']);

const input = (extra = {}) => ({ ...P.defaults('oktober 2026'), ...extra });
const roles = (list) => list.map((s) => s.role);
const spec = (inp, role) => P.specFor(inp, role);
const UITLEG_BMC = ['bmcPartners', 'bmcActiviteiten', 'bmcResources', 'bmcProposities', 'bmcRelaties', 'bmcKanalen', 'bmcSegmenten'];
const UITLEG_VPC = ['vpcVerschaffers', 'vpcProducten', 'vpcVerzachters', 'vpcVoordelen', 'vpcPijnen', 'vpcTaken'];
const UITLEG = [...UITLEG_BMC, ...UITLEG_VPC];

// Een lege slide zoals newSlide() in js/presentation/app.js hem maakt
let seq = 0;
const make = (s) => ({
  id: `s${++seq}`, layout: s.layout, label: '', title: '', subtitle: '', body: '', meta: '', quote: '', author: '', value: '',
  style: 'quote', imageSide: 'left', crop: { zoom: 1, fx: 0.5, fy: 0.5 }, table: { header: true, firstCol: true, cells: [['']] },
  titleSize: 'normaal', photoKey: '', role: '', gen: {}, photoFit: 'cover', vpc: G.emptyVpc(), bmc: G.emptyBmc(),
});
const deck = (inp) => P.sync([], P.build(inp), make).slides;
const byRole = (slides, role) => slides.find((s) => s.role === role);

// Zoals normalizeSlide() in js/presentation/app.js, na herladen en bij elk ongedaan maken
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function normalizeSlide(raw) {
  const s = JSON.parse(JSON.stringify(raw));
  const base = make({ layout: LAYOUTS.has(s.layout) ? s.layout : 'bullets' });
  for (const k of Object.keys(base)) {
    if (k === 'crop') base.crop = { ...base.crop, ...(isObj(s.crop) ? s.crop : {}) };
    else if (k === 'table') base.table = plainJson(S.normalizeTable(s.table));
    else if (k === 'gen') base.gen = G.normalizeGen(s.gen);
    else if (k === 'vpc') base.vpc = G.normalizeVpc(s.vpc);
    else if (k === 'bmc') base.bmc = G.normalizeBmc(s.bmc);
    else if (typeof s[k] === typeof base[k]) base[k] = s[k];
  }
  if (!['cover', 'logo'].includes(base.photoFit)) base.photoFit = 'cover';
  return base;
}

// Zoals checkCounts() in de app: alle invulplekken in de velden die de layout toont
const values = (s, key) => (key === 'vpc' || key === 'bmc' ? Object.values(s[key] || {}) : [s[key]]);
const counted = (slides) => slides.reduce((n, s) => n + D.fields(s).reduce((m, f) => m + values(s, f.key).reduce((k, v) => k + D.placeholders(String(v == null ? '' : v)).length, 0), 0), 0);

test('een nieuwe positionering: klant, datum, aanbod en vier onderdelen aan', () => {
  const d = P.defaults('oktober 2026');
  assert.deepEqual(d, {
    klant: '', datum: 'oktober 2026', aanbod: 'diensten',
    parts: { bmcOverzicht: true, vpcOverzicht: true, bmcUitleg: true, vpcUitleg: true }, hidden: [],
  });
  assert.equal(P.id, 'positionering');
  assert.deepEqual(P.PARTS, ['bmcOverzicht', 'vpcOverzicht', 'bmcUitleg', 'vpcUitleg']);
  assert.deepEqual(P.PARTS, Object.keys(P.OPTIONAL), 'elke schakelaar heeft een standaardstand');
  assert.ok(Object.isFrozen(P.PARTS) && Object.isFrozen(P.OPTIONAL) && Object.isFrozen(P.ROLES));
  assert.deepEqual(P.FIXED, P.ROLES, 'geen schakelaar is een slide: elke slide is vast');
  assert.equal(P.defaults().datum, '');
  for (const raw of [null, undefined, [], 'tekst', 42]) assert.deepEqual(P.normalizeInput(raw, 'mei 2026'), P.defaults('mei 2026'));
  // De datum: alleen de standaard als er nog geen datum was
  assert.equal(P.normalizeInput({}, 'mei 2026').datum, 'mei 2026');
  assert.equal(P.normalizeInput({ datum: '' }, 'mei 2026').datum, '', 'bewust leeg gemaakt blijft leeg');
  assert.equal(P.normalizeInput({ datum: null }, 'mei 2026').datum, '');
  assert.equal(P.normalizeInput({ datum: 'januari 2027' }, 'mei 2026').datum, 'januari 2027');
  // Rare invoer; onbekende velden (ook die van het voorstel) vallen weg
  const n = P.normalizeInput({ klant: 5, aanbod: 'alles', traject: 'x', eenmalig: [], parts: { bmcUitleg: false, vpc: false }, hidden: ['bmcKanalen', 'nope', 'cover'] }, 'mei');
  assert.equal(n.klant, '');
  assert.equal(n.aanbod, 'diensten');
  assert.deepEqual(n.parts, { ...P.OPTIONAL, bmcUitleg: false });
  assert.deepEqual(n.hidden, ['cover', 'bmcKanalen'], 'in de vaste volgorde');
  assert.deepEqual(Object.keys(n), Object.keys(P.defaults()));
  assert.equal(P.normalizeInput({ aanbod: 'producten' }).aanbod, 'producten');
  assert.equal(P.normalizeInput({ klant: 'x'.repeat(500) }).klant.length, 200);
  const full = input({ klant: 'Eurosit', aanbod: 'producten', parts: { ...P.OPTIONAL, vpcUitleg: false }, hidden: ['agenda'] });
  assert.deepEqual(P.normalizeInput(JSON.parse(JSON.stringify(full)), 'x'), full, 'heen en terug via JSON');
  assert.doesNotThrow(() => P.build({ parts: null, hidden: 'x', aanbod: 5 }));
  assert.doesNotThrow(() => P.build(null));
});

test('velden lezen en schrijven: klant, datum en aanbod', () => {
  const inp = P.defaults();
  assert.equal(P.set(inp, 'klant', 'EEZZ'), true);
  assert.equal(P.get(inp, 'klant'), 'EEZZ');
  assert.equal(P.set(inp, 'datum', 'd'.repeat(300)), true);
  assert.equal(inp.datum.length, 200);
  assert.equal(P.get(inp, 'aanbod'), 'diensten');
  assert.equal(P.set(inp, 'aanbod', 'producten'), true);
  assert.equal(P.get(inp, 'aanbod'), 'producten');
  assert.equal(P.set(inp, 'aanbod', 'alles'), false, 'een aanbod dat niet bestaat');
  assert.equal(P.get(inp, 'aanbod'), 'producten');
  assert.equal(P.get({ aanbod: 'x' }, 'aanbod'), 'diensten');
  for (const p of ['traject', 'eenmalig', 'parts', 'hidden', 'bmc.partners', 'vpc.taken', '__proto__', 'onbekend']) {
    assert.equal(P.set(inp, p, 'x'), false, p);
    assert.equal(P.get(inp, p), '', p);
  }
  assert.equal(P.set(null, 'klant', 'x'), false);
  assert.equal(P.set(inp, 'klant', null), true);
  assert.equal(inp.klant, '');
});

test('de opbouw: 22 slides in de vaste volgorde, met layout, label en titel', () => {
  const specs = P.build(input({ klant: 'Eurosit' }));
  const K = '**Eurosit**';
  const expected = [
    ['cover', 'title', 'pure minds', `Positionering ${K}`],
    ['agenda', 'vragen', 'inhoud', 'Positionering'],
    ['sectieBmc', 'section', 'business model canvas', 'Business Model Canvas'],
    ['bmc', 'bmc', 'business model canvas', ''],
    ['sectieVpc', 'section', 'waarde propositie canvas', 'Waarde Propositie Canvas'],
    ['vpc', 'vpc', 'waarde propositie canvas', ''],
    ['sectieBmcUitleg', 'section', 'toelichting', 'Business Model Canvas'],
    ['bmcPartners', 'toelichting', 'business model canvas', 'Key Partners'],
    ['bmcActiviteiten', 'toelichting', 'business model canvas', 'Kernactiviteiten'],
    ['bmcResources', 'toelichting', 'business model canvas', 'Key Resources'],
    ['bmcProposities', 'toelichting', 'business model canvas', 'Waardeproposities'],
    ['bmcRelaties', 'toelichting', 'business model canvas', 'Klantrelaties'],
    ['bmcKanalen', 'toelichting', 'business model canvas', 'Kanalen'],
    ['bmcSegmenten', 'toelichting', 'business model canvas', 'Klantsegmenten'],
    ['sectieVpcUitleg', 'section', 'toelichting', 'Waarde Propositie Canvas'],
    ['vpcVerschaffers', 'toelichting', 'waardemap', 'Voordeelverschaffers'],
    ['vpcProducten', 'toelichting', 'waardemap', 'Producten & Diensten'],
    ['vpcVerzachters', 'toelichting', 'waardemap', 'Pijnverzachters'],
    ['vpcVoordelen', 'toelichting', 'klantprofiel', 'Voordelen'],
    ['vpcPijnen', 'toelichting', 'klantprofiel', 'Pijnpunten'],
    ['vpcTaken', 'toelichting', 'klantprofiel', 'Klanttaken'],
    ['afsluiter', 'closing', 'pure minds', 'Van gesprek naar positionering'],
  ];
  assert.deepEqual(specs.map((s) => [s.role, s.layout, s.label, s.title]), expected);
  assert.deepEqual(roles(specs), P.ROLES);
  for (const s of specs) {
    assert.ok(LAYOUTS.has(s.layout), `layout ${s.layout}`);
    for (const key of Object.keys(s)) assert.ok(key === 'role' || G.OWNED.includes(key), `${s.role}.${key}`);
    // Een sectie noemt de klant, bij de toelichting op een tweede regel
    if (s.layout === 'section') assert.equal(s.subtitle, s.label === 'toelichting' ? `Toelichting\n${K}` : K, s.role);
  }
  // De canvassen: alleen de layout; de blokken en vakken zijn van de slide
  assert.deepEqual(spec(input(), 'bmc'), { role: 'bmc', layout: 'bmc', label: 'business model canvas', title: '' });
  // De waardepropositie in de volle variant (het voorstel heeft de gewone)
  assert.deepEqual(spec(input(), 'vpc'), { role: 'vpc', layout: 'vpc', label: 'waarde propositie canvas', title: '', style: 'vol' });
  // Titelslide: foto in de zeshoek, Pure Minds en de datum onderaan
  const cover = specs[0];
  assert.equal(cover.photoFit, 'cover');
  assert.equal(cover.meta, 'Pure Minds · oktober 2026');
  assert.equal(spec(input({ datum: '  ' }), 'cover').meta, 'Pure Minds');
  assert.equal(spec(input({ klant: '  **EEZZ** ' }), 'cover').title, 'Positionering **EEZZ**', 'één regel, zonder eigen nadruk');
  const last = specs[specs.length - 1];
  assert.equal(last.photoFit, 'cover');
  // Namen voor meldingen: elke slide en elke schakelaar; de toelichting heet naar zijn titel
  for (const r of [...P.ROLES, ...P.PARTS]) assert.equal(typeof P.ROLE_NAMES[r], 'string', r);
  for (const s of specs.filter((x) => x.layout === 'toelichting')) assert.equal(P.ROLE_NAMES[s.role], s.title);
  assert.equal(P.ROLE_NAMES.bmcUitleg, 'Toelichting Business Model Canvas');
  // Eén schrijfwijze in dit deck: Producten & Diensten, ook als naam van het vak
  assert.equal(P.VPC_NAMES.producten, 'Producten & Diensten');
  assert.deepEqual(Object.keys(P.VPC_NAMES), Object.keys(G.VPC_INFO));
  for (const k of Object.keys(G.VPC_INFO)) if (k !== 'producten') assert.equal(P.VPC_NAMES[k], G.VPC_INFO[k].name);
  // De namen op de toelichting zijn die van de blokken van het canvas
  for (const role of UITLEG_BMC) assert.equal(spec(input(), role).title, G.BMC_INFO[P.LINKS[role].key].name);
  for (const role of UITLEG_VPC) assert.equal(spec(input(), role).title, P.VPC_NAMES[P.LINKS[role].key]);
});

test('vaste teksten staan er letterlijk in', () => {
  const inp = input({ klant: 'Eurosit' });
  assert.equal(spec(inp, 'cover').subtitle, 'Om een duidelijk beeld te hebben van het merkverhaal en kernwaarden van Eurosit hebben we een positioneringsinterview gehouden. Tijdens dit interview zijn we samen op zoek gegaan naar de kern van het bedrijf. Daarmee zijn we aan de slag gegaan en creëren we een verhaal waarmee je je doelgroepen kunt bereiken en raken. Vanuit dit fundament bepaal je verder de strategie, bovendien dient het als basis voor de te ontwikkelen creatieve concepten: de ‘storytelling’ en je boodschap die je gebruikt op je online kanalen.');
  assert.equal(spec(inp, 'agenda').subtitle, 'Hieronder zijn de verschillende onderdelen van deze positionering neergezet.');
  const slot = (aanbod) => spec({ ...inp, aanbod }, 'afsluiter');
  assert.equal(slot('diensten').subtitle, 'Deze positionering biedt een helder en onderbouwd inzicht in de positie van Eurosit in de markt. Door het in kaart brengen van klantbehoeften, pijnpunten, voordelen en de huidige dienstverlening ontstaat een duidelijk beeld van waar de grootste kansen en knelpunten liggen voor Eurosit.\n\nDe positionering laat zien hoe de diensten van Eurosit aansluiten op de behoeften van hun klanten, waar de onderscheidende kracht ligt en welke strategische richtingen het meest kansrijk zijn om de waardepropositie verder te versterken en uiteindelijke marketingdoelstellingen te realiseren met de juiste boodschap en doelgroep.');
  assert.equal(slot('producten').subtitle, slot('diensten').subtitle.replace('hoe de diensten van', 'hoe de producten & diensten van'));
  assert.equal(slot('diensten').subtitle.split('\n\n').length, 2, 'twee alinea’s met een witregel, zoals in de referentie');
  // Een naam die al op een punt eindigt (Groep B.V.): geen tweede punt aan het eind van de zin
  const bv = spec(input({ klant: 'Kantoor Groep B.V.' }), 'afsluiter').subtitle;
  assert.ok(bv.includes('knelpunten liggen voor Kantoor Groep B.V.\n\n'), bv);
  assert.ok(!bv.includes('..'));
  assert.ok(spec(input(), 'afsluiter').subtitle.includes('liggen voor [klantnaam].\n\n'), 'zonder naam de invulplek, met een punt');
  assert.equal(slot('diensten').body, 'www.pureminds.nl\n045 - 3690530\ninfo@pureminds.nl');
  assert.ok(Object.isFrozen(P.TEXT) && Object.isFrozen(P.TEXT.uitleg) && Object.isFrozen(P.TEXT.agenda));
  // Geen slordigheden uit de referenties, geen bronvermelding, een krulapostrof
  const json = JSON.stringify(P.build(input({ klant: 'Eurosit' })));
  for (const fout of ['Overzicht Waarde Propositie Canvas Overzicht', '2.Servicegericht', 'Group', 'group', 'Info@', 'Aan de rechterzijde', 'canvas overzicht', 'Canvas overzicht']) assert.ok(!json.includes(fout), fout);
  assert.ok(!/strategyzer/i.test(json));
  assert.ok(!/[a-z]'s\b/i.test(json), 'risico’s met een krulapostrof');
});

test('de onderdelen op de agenda volgen de schakelaars', () => {
  const agenda = (parts) => spec(input({ parts: { ...P.OPTIONAL, ...parts } }), 'agenda').body;
  assert.equal(agenda({}), 'Overzicht Business Model Canvas\nOverzicht Waarde Propositie Canvas\nUitwerking Business Model Canvas & Waarde Propositie Canvas');
  assert.equal(agenda({ vpcUitleg: false }), 'Overzicht Business Model Canvas\nOverzicht Waarde Propositie Canvas\nUitwerking Business Model Canvas');
  assert.equal(agenda({ bmcUitleg: false }), 'Overzicht Business Model Canvas\nOverzicht Waarde Propositie Canvas\nUitwerking Waarde Propositie Canvas');
  assert.equal(agenda({ bmcOverzicht: false, vpcUitleg: false }), 'Overzicht Waarde Propositie Canvas\nUitwerking Business Model Canvas');
  assert.equal(agenda({ bmcOverzicht: false, vpcOverzicht: false, bmcUitleg: false, vpcUitleg: false }), '');
  // De layout Genummerd leest elke regel als één punt, zonder vraag
  const q = G.parseQuestions(agenda({}));
  assert.deepEqual(q.items.map((i) => i.text), ['', '', '']);
  assert.equal(q.outro, '');
});

test('een lege klantnaam is een invulplek die je bij de klantnaam oplost', () => {
  const specs = P.build(input());
  assert.deepEqual(D.placeholders(specs[0].title), ['[klantnaam]']);
  for (const s of specs.filter((x) => x.layout === 'section')) assert.ok(s.subtitle.endsWith('**[klantnaam]**'), s.role);
  assert.ok(!JSON.stringify(P.build(input({ klant: 'EEZZ' }))).includes('[klantnaam]'));
  const slides = deck(input());
  const list = D.exampleIssues({ slides });
  for (const x of list) {
    const role = slides[x.index].role;
    const field = P.fieldFor(role, x.key, x.found);
    if (UITLEG.includes(role)) {
      // De toelichting: een invulplek op de slide zelf, bij Inhoud
      assert.equal(x.key, 'body', role);
      assert.equal(x.kind, 'invulplek', role);
      assert.equal(x.found, P.TEXT.uitleg[role]);
      assert.equal(field, null, role);
    } else assert.equal(field, 'klant', `${role}.${x.key} (${x.found})`);
  }
  assert.deepEqual(list.filter((x) => UITLEG.includes(slides[x.index].role)).map((x) => slides[x.index].role), UITLEG, 'elke toelichting');
  assert.ok(!list.some((x) => x.kind === 'leeg'), 'geen lege slides, ook de canvassen niet');
  // Van een veld op de slide naar het formulier
  assert.equal(P.fieldFor('cover', 'title'), 'klant');
  assert.equal(P.fieldFor('cover', 'meta'), 'datum');
  assert.equal(P.fieldFor('cover', 'subtitle'), null, 'de inleiding pas je aan bij Inhoud');
  for (const r of ['sectieBmc', 'sectieVpc', 'sectieBmcUitleg', 'sectieVpcUitleg']) assert.equal(P.fieldFor(r, 'subtitle'), 'klant');
  assert.equal(P.fieldFor('afsluiter', 'subtitle'), null);
  assert.equal(P.fieldFor('afsluiter', 'subtitle', '[klantnaam]'), 'klant');
  for (const r of ['bmc', 'vpc', ...UITLEG]) assert.equal(P.fieldFor(r, 'body', '[klantnaam]'), null, `${r}: bij Inhoud`);
  // Welk veld welke slide voedt
  assert.deepEqual(P.FEEDS, { klant: 'cover', datum: 'cover', aanbod: 'afsluiter' });
  assert.ok(Object.isFrozen(P.FEEDS));
  for (const [field, role] of Object.entries(P.FEEDS)) {
    assert.ok(P.ROLES.includes(role));
    assert.equal(P.set(P.defaults(), field, field === 'aanbod' ? 'diensten' : ''), true, field);
  }
});

test('de toelichting: een vraag tussen blokhaken, daarna jouw tekst', () => {
  assert.deepEqual(Object.keys(P.TEXT.uitleg), UITLEG);
  for (const role of UITLEG) {
    const t = P.TEXT.uitleg[role];
    assert.deepEqual(D.placeholders(t), [t], `${role}: precies één invulplek`);
    assert.ok(t.length - 2 <= 75, `${role}: hoogstens 75 tekens`);
    assert.ok(!/[[\]]/.test(t.slice(1, -1)), role);
    assert.equal(G.written(t), false);
  }
  assert.deepEqual(Object.keys(P.CONTENT), UITLEG);
  for (const role of UITLEG) assert.deepEqual(P.CONTENT[role], ['body']);
  // Van toelichting naar het blok of vak op het canvas
  assert.deepEqual(UITLEG_BMC.map((r) => P.LINKS[r]), G.BMC_KEYS.map((key) => ({ role: 'bmc', key })));
  assert.deepEqual(UITLEG_VPC.map((r) => P.LINKS[r].key), ['verschaffers', 'producten', 'verzachters', 'voordelen', 'pijnen', 'taken']);
  for (const r of UITLEG_VPC) assert.equal(P.LINKS[r].role, 'vpc');

  const inp = input({ klant: 'Eurosit' });
  let slides = deck(inp);
  const part = byRole(slides, 'bmcPartners');
  part.body = '**Leveranciers**\n- Producenten in China';
  assert.deepEqual(P.touched(part), [], 'je toelichting schrijven is geen "zelf aangepast"');
  inp.klant = 'EEZZ';
  slides = P.sync(slides, P.build(inp), make).slides;
  assert.equal(byRole(slides, 'bmcPartners').body, '**Leveranciers**\n- Producenten in China');
  const back = P.resetSlide({ ...byRole(slides, 'bmcPartners'), title: 'Partners' }, P.specFor(inp, 'bmcPartners'));
  assert.equal(back.title, 'Key Partners');
  assert.equal(back.body, '**Leveranciers**\n- Producenten in China', 'terugzetten wist je toelichting niet');
  // Leeg gemaakt: de vraag komt terug
  slides = P.sync(slides.map((s) => (s.role === 'bmcPartners' ? { ...s, body: '  ' } : s)), P.build(inp), make).slides;
  assert.equal(byRole(slides, 'bmcPartners').body, P.TEXT.uitleg.bmcPartners);
});

test('schakelaars: elk onderdeel haalt precies zijn slides weg en brengt dezelfde terug', () => {
  const groups = {
    bmcOverzicht: ['sectieBmc', 'bmc'],
    vpcOverzicht: ['sectieVpc', 'vpc'],
    bmcUitleg: ['sectieBmcUitleg', ...UITLEG_BMC],
    vpcUitleg: ['sectieVpcUitleg', ...UITLEG_VPC],
  };
  assert.deepEqual(Object.keys(groups), P.PARTS);
  for (const [part, members] of Object.entries(groups)) {
    for (const r of members) assert.equal(P.GROUP_OF[r], part, r);
  }
  assert.deepEqual(Object.keys(P.GROUP_OF).sort(), Object.values(groups).flat().sort(), 'titelslide, agenda en afsluiter horen bij geen groep');
  for (const [part, members] of Object.entries(groups)) {
    const inp = input({ klant: 'Eurosit' });
    const slides = deck(inp);
    // Eigen werk op de slides van de groep
    for (const s of slides) {
      if (s.role === 'bmc') s.bmc = { ...G.emptyBmc(), partners: '- China' };
      if (s.role === 'vpc') s.vpc = { ...G.emptyVpc(), taken: '- Inrichten' };
      if (UITLEG.includes(s.role)) s.body = `Eigen tekst bij ${s.role}.`;
    }
    const ids = Object.fromEntries(slides.map((s) => [s.role, s.id]));
    P.setOn(inp, part, false);
    const off = P.sync(slides, P.build(inp), make, {});
    assert.deepEqual(off.removed, members, part);
    assert.deepEqual(roles(off.slides), P.ROLES.filter((r) => !members.includes(r)));
    assert.deepEqual(inp.hidden, [], 'een schakelaar raakt hidden niet');
    assert.deepEqual(P.hiddenRoles(inp), []);
    // Na opslaan en herladen: weer aan brengt precies die slides terug, op hun plek, met je werk
    const parked = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(off.parked))).map(([k, s]) => [k, normalizeSlide(s)]));
    P.setOn(inp, part, true);
    const on = P.sync(off.slides.map(normalizeSlide), P.build(inp), make, parked);
    assert.deepEqual(on.added, members);
    assert.deepEqual(on.parked, {});
    assert.deepEqual(roles(on.slides), P.ROLES);
    for (const r of members) assert.equal(byRole(on.slides, r).id, ids[r], `${part}: dezelfde slide ${r}`);
    if (part === 'bmcOverzicht') assert.equal(byRole(on.slides, 'bmc').bmc.partners, '- China');
    if (part === 'vpcOverzicht') assert.equal(byRole(on.slides, 'vpc').vpc.taken, '- Inrichten');
    for (const r of members.filter((x) => UITLEG.includes(x))) assert.equal(byRole(on.slides, r).body, `Eigen tekst bij ${r}.`);
  }
  // Alles uit: titelslide, agenda en afsluiter blijven
  assert.deepEqual(roles(P.build(input({ parts: { bmcOverzicht: false, vpcOverzicht: false, bmcUitleg: false, vpcUitleg: false } }))), ['cover', 'agenda', 'afsluiter']);
});

test('één slide verwijderen: alleen die slide, en hij staat in "zet terug"', () => {
  const inp = input();
  const slides = deck(inp);
  assert.equal(P.markRemoved(inp, 'bmcKanalen'), true);
  assert.deepEqual(inp.hidden, ['bmcKanalen']);
  assert.deepEqual(inp.parts, P.OPTIONAL, 'de schakelaar blijft aan');
  const r = P.sync(slides, P.build(inp), make, {});
  assert.deepEqual(r.removed, ['bmcKanalen']);
  assert.deepEqual(roles(r.slides), P.ROLES.filter((x) => x !== 'bmcKanalen'));
  assert.deepEqual(P.hiddenRoles(inp), ['bmcKanalen']);
  // De groep uit: dan niets terug te zetten; weer aan: de slide blijft weg tot "zet terug"
  P.setOn(inp, 'bmcUitleg', false);
  assert.deepEqual(P.hiddenRoles(inp), []);
  P.setOn(inp, 'bmcUitleg', true);
  assert.ok(!roles(P.build(inp)).includes('bmcKanalen'));
  assert.deepEqual(P.hiddenRoles(inp), ['bmcKanalen']);
  const back = P.sync(r.slides, P.build({ ...inp, hidden: [] }), make, r.parked);
  assert.deepEqual(back.added, ['bmcKanalen']);
  assert.deepEqual(roles(back.slides), P.ROLES, 'op zijn plek');
  // Een vaste slide buiten een groep kan ook weg
  P.markRemoved(inp, 'agenda');
  assert.deepEqual(P.hiddenRoles(inp), ['agenda', 'bmcKanalen']);
});

test('klaar om te versturen: de checklist van de positionering', () => {
  const ids = (list) => list.map((x) => x.id);
  const byId = (list, id) => list.find((x) => x.id === id);
  const check = (inp, slides) => P.checklist(inp, slides, { placeholders: counted(slides), overflow: 0 });

  // Nieuw: bijna alles staat open
  const inp = input();
  let slides = deck(inp);
  let list = check(inp, slides);
  assert.deepEqual(ids(list), ['klant', 'foto', 'bmc', 'vpc', 'toelichting', 'invulplekken', 'past']);
  assert.deepEqual(list.map((x) => x.label), [
    'Klantnaam ingevuld', 'Foto op de titelslide', 'Business Model Canvas: 0 van 7 blokken ingevuld',
    'Waarde Propositie Canvas: 0 van 6 vakken ingevuld', 'Toelichting: 0 van 13 slides geschreven',
    // [klantnaam] op de titelslide, in de inleiding, op vier secties en drie keer in de afsluiter;
    // de vragen van de toelichting tellen hierboven al
    '9 invulplekken over, zoals [klantnaam]', 'Alle tekst past',
  ]);
  assert.equal(counted(slides), 22, 'de app telt ook de 13 vragen');
  assert.deepEqual(list.map((x) => x.done), [false, false, false, false, false, false, true]);
  assert.deepEqual(list.map((x) => x.optional), [false, true, false, false, false, false, false], 'alleen de foto is optioneel');
  assert.deepEqual(list.map((x) => x.go), [
    { section: 'gegevens', field: '#psKlant' },
    { section: 'gegevens', field: '#psFotoBtn' },
    { role: 'bmc', section: 'inhoud' },
    { role: 'vpc', section: 'inhoud' },
    { role: 'bmcPartners', section: 'inhoud', field: '#sBody' },
    { issue: 'first' },
    { issue: 'overflow' },
  ]);
  assert.deepEqual(list.map((x) => x.hint), ['', '', 'in trefwoorden, bij Inhoud', 'in trefwoorden, bij Inhoud', 'vervang de tekst tussen blokhaken', '', '']);

  // Klantnaam ingevuld: geen invulplekken meer buiten de toelichting
  inp.klant = 'Eurosit';
  slides = P.sync(slides, P.build(inp), make).slides;
  list = check(inp, slides);
  assert.deepEqual(list.map((x) => x.done), [true, false, false, false, false, true, true]);
  assert.equal(byId(list, 'invulplekken').label, 'Geen invulplekken meer');

  // Vijf van de zeven blokken; drie toelichtingen geschreven (de eerste open is Key Resources)
  const bmc = byRole(slides, 'bmc');
  bmc.bmc = { ...G.emptyBmc(), partners: '- China', activiteiten: '**Meubelhandel**', proposities: 'Advies', kanalen: 'Showroom', segmenten: '[segment]', relaties: '  ' };
  bmc.bmc.resources = 'Team';
  for (const r of ['bmcPartners', 'bmcActiviteiten', 'bmcProposities']) byRole(slides, r).body = 'Eigen tekst.';
  list = check(inp, slides);
  assert.equal(byId(list, 'bmc').label, 'Business Model Canvas: 5 van 7 blokken ingevuld', 'een invulplek of alleen spaties telt niet');
  assert.equal(byId(list, 'bmc').done, false);
  assert.equal(byId(list, 'toelichting').label, 'Toelichting: 3 van 13 slides geschreven');
  assert.deepEqual(byId(list, 'toelichting').go, { role: 'bmcResources', section: 'inhoud', field: '#sBody' });
  assert.equal(byId(list, 'invulplekken').label, '1 invulplek over, zoals [segment]', 'een invulplek in een blok telt wel');

  // Alles geschreven
  bmc.bmc = Object.fromEntries(G.BMC_KEYS.map((k) => [k, `- ${k}`]));
  byRole(slides, 'vpc').vpc = { ...G.emptyVpc(), ...Object.fromEntries(Object.keys(G.VPC_INFO).map((k) => [k, `- ${k}`])) };
  for (const r of UITLEG) byRole(slides, r).body = `Over ${r}.`;
  byRole(slides, 'cover').photoKey = 'foto:1';
  list = check(inp, slides);
  assert.deepEqual(list.map((x) => x.done), [true, true, true, true, true, true, true]);
  assert.deepEqual(list.map((x) => x.label).slice(2, 5), ['Business Model Canvas ingevuld', 'Waarde Propositie Canvas ingevuld', 'Toelichting geschreven']);
  assert.ok(list.every((x) => x.hint === ''));
  assert.deepEqual(byId(list, 'toelichting').go, { role: 'bmcPartners', section: 'inhoud', field: '#sBody' });

  // Onderdelen uit, een verwijderde titelslide, een canvas met een andere layout: niet in de lijst
  const off = input({ parts: { ...P.OPTIONAL, bmcOverzicht: false, bmcUitleg: false }, hidden: ['cover'] });
  const offSlides = deck(off);
  assert.deepEqual(ids(check(off, offSlides)), ['klant', 'vpc', 'toelichting', 'invulplekken', 'past']);
  assert.equal(byId(check(off, offSlides), 'toelichting').label, 'Toelichting: 0 van 6 slides geschreven');
  byRole(offSlides, 'vpc').layout = 'tekst';
  assert.ok(!ids(check(off, offSlides)).includes('vpc'));
  const none = input({ parts: { bmcOverzicht: false, vpcOverzicht: false, bmcUitleg: false, vpcUitleg: false } });
  assert.deepEqual(ids(P.checklist(none, deck(none), {})), ['klant', 'foto', 'invulplekken', 'past']);
  // Zonder slides (nog niet gemaakt): de canvassen en de toelichting staan open
  assert.deepEqual(ids(P.checklist(input(), [], {})), ['klant', 'foto', 'bmc', 'vpc', 'toelichting', 'invulplekken', 'past']);
  assert.doesNotThrow(() => P.checklist(null, [null, 5, 'x'], 'x'));
});

test('herladen en ongedaan maken (normalizeSlide van de app) maken niets "aangepast"', () => {
  const inp = input({ klant: 'Eurosit', aanbod: 'producten' });
  const slides = deck(inp);
  byRole(slides, 'bmc').bmc = { ...G.emptyBmc(), partners: '**Leveranciers**\n- China', extra: 'weg' };
  byRole(slides, 'vpc').vpc = { ...G.emptyVpc(), taken: '- Inrichten' };
  byRole(slides, 'bmcRelaties').body = 'Persoonlijk en adviserend.';
  let loaded = slides.map(normalizeSlide);
  for (const s of loaded) assert.deepEqual(P.touched(s), [], `${s.role} na herladen`);
  assert.deepEqual(byRole(loaded, 'bmc').bmc, { ...G.emptyBmc(), partners: '**Leveranciers**\n- China' });
  assert.equal(byRole(loaded, 'vpc').style, 'vol');
  const again = P.sync(loaded, P.build(inp), make).slides;
  assert.deepEqual(again, loaded, 'nog eens bijwerken verandert niets');
  loaded = again.map(normalizeSlide).map(normalizeSlide);
  for (const s of loaded) assert.deepEqual(P.touched(s), [], `${s.role} na twee keer`);
  // Een echte wijziging blijft een wijziging
  assert.deepEqual(P.touched(normalizeSlide({ ...byRole(slides, 'sectieBmc'), subtitle: 'Eigen' })), ['subtitle']);
});
