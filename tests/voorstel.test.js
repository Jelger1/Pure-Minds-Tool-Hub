/* Tests voor js/presentation/voorstel.js (met generator.js): het formulier, de slides van het voorstel, prijzen en bijwerken zonder jouw aanpassingen te raken */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../js/presentation/voorstel.js');
const D = require('../js/presentation/deck.js');

// De echte templates (layouts en normalizeTable), geladen zoals de browser ze laadt
const S = (() => {
  const sandbox = { window: { PMGenerator: require('../js/presentation/generator.js') } };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ['js/shared/canvas-kit.js', 'js/presentation/templates.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.window.PMSlides;
})();
// Objecten uit de sandbox hebben een ander prototype: via JSON vergelijkbaar maken
const plainJson = (v) => JSON.parse(JSON.stringify(v));
const LAYOUTS = new Set(S.LAYOUTS.map((l) => l.id));

// Een voorstel met de standaardonderdelen en eventueel eigen velden
const input = (extra = {}) => ({ ...P.defaults('september 2026'), ...extra });
const roles = (list) => list.map((s) => s.role);
const spec = (inp, role) => P.specFor(inp, role);
const all = (extra = {}) => ({ ...P.OPTIONAL, gewenst: true, sea: true, ga4: true, gbp: true, meetbaar: true, ...extra });
const rows = (...pairs) => pairs.map(([label, amount]) => ({ label, amount }));

// Een lege slide zoals newSlide() in js/presentation/app.js hem maakt
let seq = 0;
const make = (s) => ({
  id: `s${++seq}`, layout: s.layout, label: '', title: '', subtitle: '', body: '', meta: '', quote: '', author: '', value: '',
  style: 'quote', imageSide: 'left', crop: { zoom: 1, fx: 0.5, fy: 0.5 }, table: { header: true, firstCol: true, cells: [['']] },
  titleSize: 'normaal', photoKey: '', role: '', gen: {}, photoFit: 'cover', vpc: P.emptyVpc(),
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
    else if (k === 'gen') base.gen = P.normalizeGen(s.gen);
    else if (k === 'vpc') base.vpc = P.normalizeVpc(s.vpc);
    else if (typeof s[k] === typeof base[k]) base[k] = s[k];
  }
  if (!['cover', 'logo'].includes(base.photoFit)) base.photoFit = 'cover';
  return base;
}

test('standaardvoorstel en een kapot opgeslagen voorstel', () => {
  const d = P.defaults('september 2026');
  assert.equal(d.datum, 'september 2026');
  assert.equal(d.klant, '');
  assert.equal(d.traject, 'Positionering en merkverhaal');
  assert.equal(d.websiteSoort, 'nieuw');
  assert.equal(d.totaal, false, 'totaal per groep staat standaard uit');
  assert.deepEqual(d.eenmalig, []);
  assert.deepEqual(d.maandelijks, []);
  assert.deepEqual(d.parts, { gewenst: false, vpc: true, website: true, sea: false, ga4: false, gbp: false, uitvoering: true, meetbaar: false });
  assert.deepEqual(d.parts, P.OPTIONAL);
  assert.deepEqual(d.hidden, []);
  // Het canvas en het klantlogo staan op de slides, niet in het formulier
  assert.ok(!('vpc' in d), 'geen canvas in het formulier');
  assert.ok(!('logoKey' in d), 'geen logoKey: de titelslide wordt geparkeerd');
  assert.equal(P.defaults().datum, '', 'zonder datum geen datum');

  for (const raw of [null, undefined, [], 'tekst', 42]) {
    assert.deepEqual(P.normalizeInput(raw, 'mei 2026'), P.defaults('mei 2026'), `normalizeInput(${JSON.stringify(raw)})`);
  }
  const n = P.normalizeInput({
    klant: 5, parts: 'x', hidden: ['nope', 'cover', 'vpc', 'sea', 'cover'], websiteSoort: 'anders', totaal: 'ja',
    vpc: { taken: 3, pijnen: 'Traag', klanttype: 'Inkoper', extra: 'x' }, eenmalig: 12, maandelijks: { label: 'x' }, logoKey: 'foto:abc', onbekend: 1,
  }, 'mei 2026');
  assert.equal(n.klant, '');
  assert.deepEqual(n.parts, P.OPTIONAL);
  assert.deepEqual(n.hidden, ['cover'], 'alleen vaste onderdelen, één keer');
  assert.equal(n.websiteSoort, 'nieuw');
  assert.equal(n.totaal, false);
  assert.deepEqual(n.eenmalig, []);
  assert.deepEqual(n.maandelijks, []);
  assert.ok(!('onbekend' in n));
  assert.ok(!('vpc' in n) && !('logoKey' in n), 'canvas en logo uit een oud concept vallen weg');
  assert.deepEqual(Object.keys(n), Object.keys(P.defaults()));
  assert.equal(P.normalizeInput({ totaal: true }).totaal, true);
  assert.equal(P.normalizeInput({ parts: { sea: true } }).parts.sea, true);
  // Lange tekst wordt afgekapt
  const long = P.normalizeInput({ klant: 'x'.repeat(500), situatie: 'y'.repeat(9000) }, 'mei 2026');
  assert.equal(long.klant.length, 200);
  assert.equal(long.situatie.length, 4000);
  // Nooit een fout, ook niet bij rare invoer
  assert.doesNotThrow(() => P.build({ parts: null, hidden: 'x', vpc: [], eenmalig: 12, maandelijks: [null, 5, 'x', { label: 1 }] }));
  assert.doesNotThrow(() => P.build(null));
});

test('de datum: alleen de standaard als er nog geen datum was', () => {
  assert.equal(P.normalizeInput({}, 'mei 2026').datum, 'mei 2026', 'geen datum: die van vandaag');
  assert.equal(P.normalizeInput({ datum: '' }, 'mei 2026').datum, '', 'bewust leeg gemaakt blijft leeg');
  assert.equal(P.normalizeInput({ datum: 'januari 2027' }, 'mei 2026').datum, 'januari 2027');
  assert.equal(P.normalizeInput({ datum: null }, 'mei 2026').datum, '', 'wel een sleutel, geen tekst: leeg');
  // Ongedaan maken gaat via normalizeInput: een lege datum komt niet terug
  const inp = input({ datum: '' });
  assert.equal(P.normalizeInput(JSON.parse(JSON.stringify(inp)), 'oktober 2026').datum, '');
  assert.equal(P.specFor(inp, 'cover').meta, 'Pure Minds Marketing Group');
});

test('de vakken van het canvas: klantsegment en klanttype, dan zes vakken', () => {
  assert.deepEqual(P.VPC_KEYS, ['segment', 'klanttype', 'taken', 'pijnen', 'voordelen', 'producten', 'verzachters', 'verschaffers']);
  assert.deepEqual(Object.keys(P.emptyVpc()), P.VPC_KEYS);
  assert.deepEqual(Object.keys(P.VPC_INFO), P.VPC_KEYS.slice(2), 'uitleg per vak');
  const v = P.normalizeVpc({ taken: 3, pijnen: 'Traag', klanttype: 'k'.repeat(300), voordelen: 'v'.repeat(5000), extra: 'x' });
  assert.deepEqual(Object.keys(v), P.VPC_KEYS);
  assert.equal(v.taken, '');
  assert.equal(v.pijnen, 'Traag');
  assert.equal(v.klanttype.length, 200, 'klanttype is één regel');
  assert.equal(v.voordelen.length, 4000);
  assert.deepEqual(P.normalizeVpc(null), P.emptyVpc());
});

test('velden lezen en schrijven: alleen de paden van het formulier', () => {
  const inp = P.defaults();
  assert.equal(P.set(inp, 'klant', 'Eurosit'), true);
  assert.equal(P.get(inp, 'klant'), 'Eurosit');
  // Het canvas vul je op de slide (bij Inhoud), niet in het formulier
  for (const k of P.VPC_KEYS) {
    assert.equal(P.set(inp, `vpc.${k}`, 'x'), false, `vpc.${k}`);
    assert.equal(P.get(inp, `vpc.${k}`), '');
  }
  assert.ok(!('vpc' in inp));
  assert.equal(P.set(inp, 'logoKey', 'foto:1'), false, 'geen logoKey meer');
  assert.equal(P.get(inp, 'totaal'), false, 'standaard uit');
  assert.equal(P.set(inp, 'totaal', true), true);
  assert.equal(P.get(inp, 'totaal'), true);
  assert.equal(P.set(inp, 'totaal', 'off'), true);
  assert.equal(P.get(inp, 'totaal'), false);
  assert.equal(P.set(inp, 'websiteSoort', 'optimaliseren'), true);
  assert.equal(P.set(inp, 'websiteSoort', 'iets'), false);
  assert.equal(P.get(inp, 'websiteSoort'), 'optimaliseren');
  assert.equal(P.set(inp, 'parts', {}), false);
  assert.equal(P.set(inp, 'vpc.extra', 'x'), false);
  assert.equal(P.set(inp, '__proto__', 'x'), false);
  assert.equal(P.get(inp, 'onbekend'), '');
  assert.equal(P.set(null, 'klant', 'x'), false);
  P.set(inp, 'namen', 'n'.repeat(300));
  assert.equal(inp.namen.length, 200);
});

test('prijsregels lezen en schrijven: een lijst, of tekst zoals vroeger', () => {
  const inp = P.defaults();
  // Een lijst regels, zoals de offerteregels van de Document Maker
  assert.equal(P.set(inp, 'eenmalig', rows(['Positionering', '1500'], ['', ''], ['GA4-audit*', 550])), true);
  assert.deepEqual(P.get(inp, 'eenmalig'), rows(['Positionering', '1500'], ['', ''], ['GA4-audit*', '550']), 'een lege regel mag blijven staan; een getal wordt tekst');
  // get geeft een kopie
  const got = P.get(inp, 'eenmalig');
  got[0].label = 'Anders';
  got.push({ label: 'Extra', amount: '1' });
  assert.equal(inp.eenmalig[0].label, 'Positionering');
  assert.equal(inp.eenmalig.length, 3);
  // Tekst (plakken of een oud concept): via parsePrices
  assert.equal(P.set(inp, 'maandelijks', 'Online marketing support: 1200\n\nTotaal: 1200'), true);
  assert.deepEqual(inp.maandelijks, rows(['Online marketing support', '1200'], ['Totaal', '1200']));
  assert.equal(P.set(inp, 'maandelijks', null), true);
  assert.deepEqual(inp.maandelijks, [], 'leeg maken');
  assert.equal(P.set(inp, 'maandelijks', { label: 'x' }), false, 'geen lijst en geen tekst');
  assert.equal(P.set(inp, 'maandelijks', 5), false);
  // Hoogstens 12 regels per groep, 160 tekens per veld; alleen label en bedrag
  P.set(inp, 'eenmalig', Array.from({ length: 20 }, (_, i) => ({ label: `Post ${i}`, amount: String(i), extra: 'x' })));
  assert.equal(inp.eenmalig.length, 12);
  assert.deepEqual(Object.keys(inp.eenmalig[0]), ['label', 'amount']);
  P.set(inp, 'eenmalig', [{ label: 'x'.repeat(300), amount: '9'.repeat(300) }, null, 'tekst', { label: {}, amount: [] }]);
  assert.deepEqual(inp.eenmalig.map((r) => [r.label.length, r.amount.length]), [[160, 160], [0, 0]]);
  // Een oud concept met prijzen als tekst laadt als regels
  const old = P.normalizeInput({ eenmalig: 'Positionering en uitwerking merkverhaal: 1500\nGA4-audit*: 550', maandelijks: '' });
  assert.deepEqual(old.eenmalig, rows(['Positionering en uitwerking merkverhaal', '1500'], ['GA4-audit*', '550']));
  assert.deepEqual(old.maandelijks, []);
  assert.equal(P.normalizeInput({ eenmalig: Array.from({ length: 30 }, (_, i) => `P${i}: ${i}`).join('\n') }).eenmalig.length, 12);
  // Heen en terug via JSON (opslaan, ongedaan maken) verandert niets
  const full = input({ eenmalig: rows(['A', '100'], ['', '']), maandelijks: rows(['B', 'N.T.B.']), totaal: true });
  assert.deepEqual(P.normalizeInput(JSON.parse(JSON.stringify(full)), 'x'), full);
});

test('het standaardvoorstel: elf slides in de vaste volgorde', () => {
  const specs = P.build(input());
  assert.deepEqual(roles(specs), ['cover', 'belofte', 'situatie', 'aanpak', 'interview', 'verdieping', 'vpc', 'website', 'uitvoering', 'investering', 'slogan']);
  for (const s of specs) {
    assert.ok(LAYOUTS.has(s.layout), `layout ${s.layout} bestaat in templates.js`);
    for (const key of Object.keys(s)) assert.ok(key === 'role' || P.OWNED.includes(key), `${s.role}.${key}`);
  }
  const cover = specs[0];
  assert.equal(cover.layout, 'title');
  assert.equal(cover.photoFit, 'logo');
  assert.equal(cover.meta, 'Pure Minds Marketing Group · september 2026');
  assert.equal(cover.subtitle, 'Positionering en merkverhaal');
  assert.equal(P.specFor(input({ datum: '' }), 'cover').meta, 'Pure Minds Marketing Group');
  const everything = P.build(input({ parts: all() }));
  assert.deepEqual(roles(everything), P.ROLES, 'alles aan: alle vijftien, SEA is geen slide');
  for (const s of everything) assert.ok(LAYOUTS.has(s.layout), `layout ${s.layout}`);
  assert.equal(P.specFor(input(), 'ga4'), null, 'uit: geen spec');
  // De tabel van de investering is al zoals normalizeTable hem bewaart
  const inv = P.specFor(input({ eenmalig: rows(['A', '100'], ['B', '200']), totaal: true }), 'investering');
  assert.deepEqual(plainJson(S.normalizeTable(inv.table)), inv.table);
  // Het canvas: alleen de layout; de vakken zijn van de slide, ook als een oud concept ze nog in het formulier had
  assert.deepEqual(P.specFor(input(), 'vpc'), { role: 'vpc', layout: 'vpc', label: 'waardepropositie', title: '' });
  assert.deepEqual(P.specFor({ ...input(), vpc: { taken: 'Oud' } }, 'vpc'), P.specFor(input(), 'vpc'));
  assert.ok(!P.OWNED.includes('vpc'), 'het voorstel vult de vakken nooit');
});

test('vaste teksten staan er letterlijk in', () => {
  const inp = input({ klant: 'Speedstar' });
  const belofte = spec(inp, 'belofte');
  assert.equal(belofte.layout, 'kolommen');
  assert.ok(belofte.body.includes(P.TEXT.visie));
  assert.ok(belofte.body.includes(P.TEXT.missie));
  assert.deepEqual(P.parseColumns(belofte.body).map((c) => c.head), ['Onze visie', 'Mission statement']);
  const interview = spec(inp, 'interview');
  assert.equal(interview.layout, 'vragen');
  assert.deepEqual(interview.body.split('\n'), P.TEXT.catalogus.slice());
  assert.equal(interview.body.split('\n').length, 6);
  assert.ok(interview.subtitle.endsWith(`\n**${P.TEXT.catalogusLead}**`), 'de inleiding van de catalogus staat vet');
  assert.ok(interview.subtitle.startsWith(P.TEXT.interviewZonder('Speedstar')));
  // Eurosit E6: ook de twee zinnen over het verhaal en de strategie
  assert.equal(P.TEXT.interviewZonder('Eurosit'), 'Om een duidelijk beeld te hebben van het merkverhaal en de kernwaarden van Eurosit willen we een positioneringsinterview houden. Tijdens dit interview gaan we samen op zoek naar de kern van het bedrijf. Daarmee creëren we een verhaal waarmee je je doelgroepen kunt bereiken en raken. Vanuit dit fundament bepalen we verder de strategie. Bovendien dient het als basis voor de te ontwikkelen creatieve concepten: de ‘storytelling’ en je boodschap die je gebruikt op je online kanalen en website.');
  assert.ok(spec({ ...inp, namen: 'Joyce en Mitch' }, 'interview').subtitle.startsWith('We starten met een diepgaand interview met Joyce en Mitch.'));
  const verdieping = spec(inp, 'verdieping');
  assert.equal(verdieping.body, `${P.TEXT.vervolgvragen.join('\n')}\n\n${P.TEXT.icp}`);
  assert.equal(P.parseQuestions(verdieping.body).items.length, 6);
  const slogan = spec(inp, 'slogan');
  assert.equal(slogan.layout, 'quote');
  assert.equal(slogan.style, 'quote');
  assert.ok(slogan.quote.includes('PEACE OF MIND'));
  assert.ok(!slogan.quote.includes('PIECE'));
  assert.ok(Object.isFrozen(P.TEXT) && Object.isFrozen(P.TEXT.catalogus), 'de teksten liggen vast');
  // Het canvas is een interne tool: geen bronvermelding
  assert.ok(!('vpcCredit' in P.TEXT));
  assert.ok(!/strategyzer/i.test(JSON.stringify(P.build(input({ parts: all() })))), 'nergens Strategyzer');
  // De website in twee soorten, met de zin over de huidige site ervoor
  const nieuw = spec({ ...inp, websiteNu: 'De huidige website is verouderd.' }, 'website');
  assert.equal(nieuw.title, 'Nieuwe website');
  assert.equal(nieuw.body, `De huidige website is verouderd. ${P.TEXT.websiteNieuw}`);
  assert.ok(P.TEXT.websiteNieuw.includes('Daarnaast richten we de website dan zo in, dat er voldoende mogelijkheden zijn voor conversies.'));
  // Zonder punt krijgt de zin er een; met punt geen tweede
  const zonder = spec({ ...inp, websiteNu: 'De huidige website is verouderd' }, 'website');
  assert.ok(zonder.body.startsWith('De huidige website is verouderd. De nieuwe website'));
  assert.equal(zonder.body, nieuw.body);
  assert.ok(!nieuw.body.includes('..'));
  assert.equal(spec({ ...inp, websiteNu: '  Klopt dit?  ' }, 'website').body, `Klopt dit? ${P.TEXT.websiteNieuw}`);
  assert.equal(spec({ ...inp, websiteNu: '   ' }, 'website').body, P.TEXT.websiteNieuw, 'leeg: alleen de vaste tekst');
  const opt = spec({ ...inp, websiteSoort: 'optimaliseren' }, 'website');
  assert.equal(opt.title, 'Website-optimalisaties');
  assert.equal(opt.body, P.TEXT.websiteOpt('Speedstar'));
  assert.equal(spec({ ...inp, websiteSoort: 'optimaliseren', websiteNu: 'Snel is hij niet' }, 'website').body, `Snel is hij niet.\n\n${P.TEXT.websiteOpt('Speedstar')}`);
  assert.equal(spec({ ...inp, websiteSoort: 'optimaliseren', websiteNu: 'Zo is het.' }, 'website').body, `Zo is het.\n\n${P.TEXT.websiteOpt('Speedstar')}`);
  // Uitvoering zoals Speedstar S10: de contentkalender en de KPI's als opsomming
  const uit = spec(inp, 'uitvoering').body;
  assert.ok(uit.includes('invullen en onderhouden van een contentkalender, met vaste rubrieken en frequentie (aantal per week/maand in overleg)\n'));
  assert.ok(uit.includes('(in samenwerking met Speedstar)'));
  assert.ok(uit.endsWith('We gebruiken hiervoor een breed KPI-framework, afhankelijk van de doelstellingen, zoals:\n- Naamsbekendheid\n- Bereik\n- Conversies\n- enz.'));
  assert.ok(!uit.includes('LinkedIn'), 'het kanaal van één klant hoort er niet in');
});

test('de taalfouten uit de voorstellen zijn verbeterd', () => {
  const uit = P.TEXT.uitvoering('Speedstar');
  assert.ok(uit.includes('zowel korte- als langetermijndoelen te realiseren'));
  assert.ok(P.TEXT.ga4.includes('Onjuiste data leidt tot verkeerde budgetkeuzes.'));
  assert.ok(P.TEXT.ga4.includes('Op basis van de GA4-audit, waarin we ook de privacyregels en technische knelpunten meenemen, ontvang je een helder adviesrapport'));
  assert.ok(P.TEXT.gbp.includes('**De vuistregel:** hoe completer je profiel, hoe relevanter je wordt voor Google en je potentiële klant.'));
  assert.ok(P.TEXT.meetbaar.includes('Dit is een noodzakelijke stap om online marketing goed uit te kunnen voeren.'));
  const json = JSON.stringify(P.build(input({ klant: 'Eurosit', parts: all() })));
  for (const fout of ['budget keuzes', 'GA4 audit', 'des te', 'lange termijn', 'zoals bijvoorbeeld', 'goed online marketing']) assert.ok(!json.includes(fout), fout);
  // Een apostrof als in USP’s, nergens een rechte
  assert.ok(!/[a-z]'s\b/i.test(json), 'risico’s met een krulapostrof');
  assert.ok(P.VPC_INFO.pijnen.uitleg.includes('risico’s'));
});

test('de klantnaam komt overal, en een lege naam is een invulplek', () => {
  const specs = P.build(input({ klant: 'Eurosit', parts: all() }));
  assert.ok(!JSON.stringify(specs).includes('[klantnaam]'));
  assert.equal(specs[0].title, 'Voorstel **Eurosit**');
  assert.equal(spec(input({ klant: 'Eurosit' }), 'situatie').title, 'Huidige situatie **Eurosit**');
  assert.ok(spec(input({ klant: 'Eurosit' }), 'uitvoering').body.includes('in samenwerking met Eurosit'));
  assert.equal(spec(input({ klant: '  Eurosit  ' }), 'cover').title, 'Voorstel **Eurosit**', 'spaties eromheen tellen niet');

  const empty = P.build(input());
  assert.deepEqual(D.placeholders(empty[0].title), ['[klantnaam]']);
  const list = D.exampleIssues({ slides: deck(input()) });
  assert.ok(list.some((x) => x.index === 0 && x.key === 'title' && x.found === '[klantnaam]'));
  assert.ok(list.some((x) => x.key === 'body' && x.found.includes('[beschrijf de huidige situatie]')));
  assert.ok(list.some((x) => x.key === 'table' && x.found.includes('[omschrijving]')), 'lege investering');
  assert.ok(!list.some((x) => x.kind === 'leeg'), 'geen lege slides, ook het canvas niet');
});

test('fases nummeren zichzelf; modules krijgen geen nummer', () => {
  const label = (inp, role) => spec(inp, role).label;
  const std = input();
  assert.equal(label(std, 'interview'), 'fase 1');
  assert.equal(label(std, 'verdieping'), 'fase 2');
  assert.equal(label(std, 'website'), 'fase 3');
  assert.equal(label(std, 'uitvoering'), 'fase 4');
  const noSite = input({ parts: all({ website: false, gewenst: false }) });
  assert.equal(label(noSite, 'interview'), 'fase 1');
  assert.equal(label(noSite, 'verdieping'), 'fase 2');
  assert.equal(label(noSite, 'uitvoering'), 'fase 3');
  for (const role of ['vpc', 'ga4', 'gbp', 'meetbaar']) assert.ok(!/\d/.test(label(noSite, role)), `${role} zonder nummer`);
  assert.equal(spec(noSite, 'verdieping').title, 'Positioneringsdocument en merkverhaal', 'titel zonder "Fase 2 -"');
  // Een vaste fase weggehaald: de rest schuift op
  const inp = input();
  P.markRemoved(inp, 'interview');
  assert.equal(label(inp, 'verdieping'), 'fase 1');
});

test('"Wat wij gaan doen" volgt de onderdelen; eigen punten gaan voor', () => {
  assert.deepEqual(P.services(input()), [
    'Vooronderzoek in interviewvorm voor merkverhaal en positionering',
    'Positioneringsdocument, merkverhaal en tone of voice',
    'Nieuwe website',
    'Contentplanning en uitvoering',
  ]);
  assert.deepEqual(P.services(input({ websiteSoort: 'optimaliseren', parts: all({ uitvoering: false }) })).slice(2), [
    'Website-optimalisaties op basis van de positionering',
    'SEA-opzet en maandelijkse optimalisaties en monitoring',
    'GA4-audit',
    'Google Bedrijfsprofiel opzetten en optimaliseren',
    'Meetbaar maken van de resultaten',
  ]);
  // SEA staat direct na de website, ook zonder website
  assert.deepEqual(P.services(input({ parts: { ...P.OPTIONAL, sea: true } })).slice(2, 4), ['Nieuwe website', 'SEA-opzet en maandelijkse optimalisaties en monitoring']);
  assert.equal(P.services(input({ parts: { ...P.OPTIONAL, sea: true, website: false } }))[2], 'SEA-opzet en maandelijkse optimalisaties en monitoring');
  const auto = spec(input({ klant: 'Speedstar' }), 'aanpak');
  assert.equal(auto.title, 'Voorstel marketingaanpak **Speedstar**');
  assert.equal(auto.body, `**Voorgestelde marketingaanpak:**\n${P.TEXT.aanpak('Speedstar')}\n\n**Wat wij gaan doen:**\n${P.services(input()).map((i) => `- ${i}`).join('\n')}`);
  assert.ok(spec(input({ parts: { ...P.OPTIONAL, sea: true } }), 'aanpak').body.endsWith('\n- SEA-opzet en maandelijkse optimalisaties en monitoring\n- Contentplanning en uitvoering'));
  // De inleiding over het gesprek staat vet, zoals in Speedstar S4
  const own = spec(input({ klant: 'Speedstar', gesprek: 'januari', diensten: 'Logo-onderzoek\n\n- LinkedIn-campagne\n' }), 'aanpak');
  assert.ok(own.body.startsWith('**Naar aanleiding van het gesprek in januari, hierbij een samenvatting van hetgeen besproken is:**\n\n**Voorgestelde marketingaanpak:**'));
  assert.ok(own.body.endsWith('**Wat wij gaan doen:**\n- Logo-onderzoek\n- LinkedIn-campagne'));
});

test('SEA is een schakelaar, geen slide', () => {
  assert.deepEqual(P.PARTS, ['gewenst', 'vpc', 'website', 'sea', 'ga4', 'gbp', 'uitvoering', 'meetbaar']);
  assert.deepEqual(P.PARTS, Object.keys(P.OPTIONAL), 'elke schakelaar heeft een standaardstand');
  assert.ok(Object.isFrozen(P.PARTS));
  assert.equal(P.OPTIONAL.sea, false);
  assert.ok(!P.ROLES.includes('sea'));
  assert.ok(!P.FIXED.includes('sea'));
  assert.equal(P.ROLES.length, 15);
  for (const r of [...P.ROLES, ...P.PARTS]) assert.equal(typeof P.ROLE_NAMES[r], 'string', `naam voor ${r}`);
  const inp = input();
  assert.equal(P.isOn(inp, 'sea'), false);
  assert.equal(P.setOn(inp, 'sea', true), true);
  assert.equal(P.isOn(inp, 'sea'), true);
  assert.deepEqual(roles(P.build(inp)), roles(P.build(input())), 'dezelfde slides');
  const r = P.sync(deck(input()), P.build(inp), make);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.removed, []);
  assert.equal(P.markRemoved(inp, 'sea'), true);
  assert.equal(P.isOn(inp, 'sea'), false);
  assert.deepEqual(inp.hidden, []);
});

test('prijzen: bedragen, prijsregels en de investeringstabel', () => {
  assert.equal(P.formatPrice('1500'), '€ 1.500,-');
  assert.equal(P.formatPrice('1200'), '€ 1.200,-');
  assert.equal(P.formatPrice('€ 1.250,50'), '€ 1.250,50');
  assert.equal(P.formatPrice('1250,5'), '€ 1.250,50');
  assert.equal(P.formatPrice('1.500'), '€ 1.500,-');
  // De schrijfwijze uit de voorstellen zelf: ",-" is een heel bedrag (parseAmount las 1,5)
  assert.equal(P.formatPrice('€ 1.500,-'), '€ 1.500,-', 'heen en terug');
  assert.equal(P.formatPrice('2000,-'), '€ 2.000,-');
  assert.equal(P.formatPrice('€ 550,-'), '€ 550,-');
  assert.equal(P.formatPrice('€ 1.200,–'), '€ 1.200,-', 'met een gedachtestreepje');
  assert.equal(P.formatPrice('1.500,--'), '€ 1.500,-');
  assert.equal(P.formatPrice('1234567'), '€ 1.234.567,-');
  assert.equal(P.formatPrice('N.T.B.'), 'N.T.B.');
  assert.equal(P.formatPrice('€ 49 p/m'), '€ 49 p/m');
  assert.equal(P.formatPrice(' 500-750 '), '500-750', 'een bereik blijft staan');
  assert.equal(P.formatPrice('500–750'), '500–750', 'ook met een gedachtestreepje');
  assert.equal(P.formatPrice(''), '');
  assert.equal(P.formatPrice(null), '');

  assert.deepEqual(P.parsePrices('GA4-audit*: 550\n\nWorkshop\tsessie\t1.200\nAdvies: 10:00: 90\nLosse regel\n**Fase 3 & 4**: N.T.B.\nTotaal: 2000'), [
    { label: 'GA4-audit*', amount: '550', bold: false },
    { label: 'Workshop sessie', amount: '1.200', bold: false },
    { label: 'Advies: 10:00', amount: '90', bold: false },
    { label: 'Losse regel', amount: '', bold: false },
    { label: '**Fase 3 & 4**', amount: 'N.T.B.', bold: true },
    { label: 'Totaal', amount: '2000', bold: true },
  ]);
  assert.deepEqual(P.parsePrices('Positionering\t1500\t\r\n'), [{ label: 'Positionering', amount: '1500', bold: false }], 'plakken uit Excel');
  assert.deepEqual(P.parsePrices(null), []);

  const table = (extra) => P.priceTable(input(extra));
  // Geen kopregel; de groepen zijn de koppen. Totaal staat standaard uit (Eurosit E13 heeft er geen)
  const eurosit = rows(['Positionering & Uitwerking merkverhaal/tone of voice', '€ 1.500,-'], ['GA4 audit*', '€ 550,-'], ['Opzet SEA', '€ 2000,-']);
  assert.deepEqual(table({ eenmalig: eurosit, maandelijks: rows(['Maandelijks Online Marketing Support', '€ 1200,-']) }), {
    header: false,
    firstCol: false,
    cells: [
      ['**Eenmalig**', ''],
      ['Positionering & Uitwerking merkverhaal/tone of voice', '€ 1.500,-'],
      ['GA4 audit*', '€ 550,-'],
      ['Opzet SEA', '€ 2.000,-'],
      ['**Maandelijks**', ''],
      ['Maandelijks Online Marketing Support', '€ 1.200,-'],
    ],
  });
  // Totaal per groep aan: optellen, ook met ,- erachter
  assert.deepEqual(table({ eenmalig: rows(['Positionering', '1.500,-'], ['GA4-audit*', '550']), totaal: true }).cells, [
    ['**Eenmalig**', ''],
    ['Positionering', '€ 1.500,-'],
    ['GA4-audit*', '€ 550,-'],
    ['**Totaal eenmalig**', '**€ 2.050,-**'],
  ]);
  // Eén bedrag plus tekst: geen totaal; een eigen Totaal-regel: vet en geen tweede totaal
  assert.equal(table({ eenmalig: rows(['A', '100'], ['B', 'N.T.B.']), totaal: true }).cells.length, 3);
  assert.deepEqual(table({ eenmalig: rows(['A', '100'], ['B', '200'], ['Totaal', '300']), totaal: true }).cells.slice(1), [['A', '€ 100,-'], ['B', '€ 200,-'], ['**Totaal**', '**€ 300,-**']]);
  assert.deepEqual(table({ eenmalig: rows(['A', '100'], ['B', '200'], ['**Totaal**', '300']), totaal: true }).cells.length, 4, 'ook **Totaal** telt als eigen totaal');
  assert.equal(table({ eenmalig: rows(['A', '100'], ['B', '200']) }).cells.length, 3, 'totaal uit');
  assert.deepEqual(table({ eenmalig: rows(['A', '0,50'], ['B', '1.250,25']), totaal: true }).cells[3], ['**Totaal eenmalig**', '**€ 1.250,75**'], 'optellen in centen');
  // Een omschrijving tussen ** is een vette rij (Speedstar S12: Fase 3 & 4, N.T.B.); los ** in de tekst niet
  const speedstar = table({ eenmalig: rows(['Interview Joyce & Mitch', ''], ['Uitwerking merkverhaal/tone of voice', ''], ['Totaal', '€ 1.500,-'], ['**Fase 3 & 4**', 'N.T.B.']) });
  assert.deepEqual(speedstar.cells, [
    ['**Eenmalig**', ''],
    ['Interview Joyce & Mitch', ''],
    ['Uitwerking merkverhaal/tone of voice', ''],
    ['**Totaal**', '**€ 1.500,-**'],
    ['**Fase 3 & 4**', '**N.T.B.**'],
  ]);
  assert.deepEqual(table({ eenmalig: rows(['Workshop **inclusief** lunch', '800']) }).cells[1], ['Workshop **inclusief** lunch', '€ 800,-']);
  // Lege regels tellen niet mee; een regel met alleen een omschrijving of bedrag wel
  assert.deepEqual(table({ eenmalig: rows(['', ''], ['A', ''], ['  ', ' '], ['', '100']) }).cells, [['**Eenmalig**', ''], ['A', ''], ['', '€ 100,-']]);
  assert.deepEqual(table({ maandelijks: rows(['', '']) }).cells, [['**Eenmalig**', ''], ['[omschrijving]', '[bedrag]']], 'alleen lege regels: invulplekken');
  // Leeg: invulplekken die de controle vóór het downloaden meldt
  assert.deepEqual(table({}), { header: false, firstCol: false, cells: [['**Eenmalig**', ''], ['[omschrijving]', '[bedrag]']] });
  // Prijzen als tekst (een oud concept) werken nog
  assert.deepEqual(P.priceTable({ eenmalig: 'Positionering: 1500\nGA4-audit*: 550', totaal: true }).cells.slice(1), [['Positionering', '€ 1.500,-'], ['GA4-audit*', '€ 550,-'], ['**Totaal eenmalig**', '**€ 2.050,-**']]);
  // Altijd rechthoekig, twee kolommen, hoogstens 14 rijen
  const many = (n, p) => Array.from({ length: n }, (_, i) => ({ label: `${p} ${i}`, amount: String(i + 1) }));
  const big = table({ eenmalig: many(12, 'Post'), maandelijks: [{ label: 'x'.repeat(300), amount: '5' }, ...many(3, 'Maand')], totaal: true });
  for (const t of [big, table({}), table({ eenmalig: rows(['Los', ''], ['A', '1']) })]) {
    assert.ok(t.cells.length <= 14);
    for (const row of t.cells) {
      assert.equal(row.length, 2);
      for (const c of row) assert.ok(typeof c === 'string' && c.length <= 160);
    }
  }
  assert.equal(big.cells.length, 14);
  // De tabel staat op de slide Investering, met de voetnoot eronder
  const inv = spec(input({ voetnoot: 'Alle bedragen zijn exclusief btw.' }), 'investering');
  assert.equal(inv.layout, 'table');
  assert.equal(inv.subtitle, 'Alle bedragen zijn exclusief btw.');
});

test('wat niet in de tabel past, telt priceOverflow', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({ label: `Post ${i}`, amount: '100' }));
  assert.equal(P.priceOverflow(input()), 0, 'leeg');
  assert.equal(P.priceOverflow(input({ eenmalig: many(12) })), 0, '1 + 12 rijen');
  assert.equal(P.priceOverflow(input({ eenmalig: many(12), totaal: true })), 0, '1 + 12 + totaal = 14');
  assert.equal(P.priceOverflow(input({ eenmalig: many(12), maandelijks: many(1) })), 1, '13 + 2 rijen: 1 valt weg');
  assert.equal(P.priceOverflow(input({ eenmalig: many(12), maandelijks: many(12), totaal: true })), 14, 'twee volle groepen met totaal: 28 rijen');
  assert.equal(P.priceOverflow(input({ eenmalig: [...many(12), { label: '', amount: '' }] })), 0, 'lege regels tellen niet');
  assert.equal(P.priceOverflow(null), 0);
  // De tabel zelf blijft bij 14 rijen
  assert.equal(P.priceTable(input({ eenmalig: many(12), maandelijks: many(12) })).cells.length, 14);
});

test('welk veld welke slide voedt, en andersom', () => {
  assert.deepEqual(P.FEEDS, {
    klant: 'cover', datum: 'cover', traject: 'cover',
    gesprek: 'aanpak', diensten: 'aanpak',
    situatie: 'situatie', gewenst: 'gewenst', namen: 'interview',
    websiteSoort: 'website', websiteNu: 'website',
    eenmalig: 'investering', maandelijks: 'investering', totaal: 'investering', voetnoot: 'investering',
  });
  assert.ok(Object.isFrozen(P.FEEDS));
  assert.ok(!Object.values(P.FEEDS).includes('vpc'), 'het canvas vul je bij Inhoud');
  for (const [field, role] of Object.entries(P.FEEDS)) {
    assert.ok(P.ROLES.includes(role), `${field} voedt ${role}`);
    assert.equal(P.set(P.defaults(), field, field === 'websiteSoort' ? 'nieuw' : ''), true, `${field} is een veld van het formulier`);
  }
  // Van een veld op de slide naar het veld in het formulier
  const cases = [
    ['cover', 'title', 'klant'], ['cover', 'meta', 'datum'], ['cover', 'subtitle', 'traject'],
    ['situatie', 'body', 'situatie'], ['gewenst', 'body', 'gewenst'],
    ['aanpak', 'title', 'klant'], ['aanpak', 'body', 'diensten'],
    ['interview', 'subtitle', 'namen'], ['website', 'body', 'websiteNu'],
    ['investering', 'table', 'eenmalig'], ['investering', 'subtitle', 'voetnoot'],
    ['situatie', 'title', 'klant'], ['gewenst', 'title', 'klant'],
  ];
  for (const [role, key, field] of cases) assert.equal(P.fieldFor(role, key), field, `${role}.${key}`);
  // De vaste tekst van Uitvoering pas je bij Inhoud aan
  for (const [role, key] of [['uitvoering', 'body'], ['vpc', 'vpc'], ['vpc', 'label'], ['belofte', 'body'], ['cover', 'label'], ['slogan', 'quote'], ['', 'title'], ['onbekend', 'title'], [null, 'title'], ['cover', null], ['cover', 'hasOwnProperty']]) {
    assert.equal(P.fieldFor(role, key), null, `${role}.${key}`);
  }
  // [klantnaam] vul je bij de klantnaam in, waar hij ook staat
  assert.equal(P.fieldFor('interview', 'subtitle', '[klantnaam]'), 'klant');
  assert.equal(P.fieldFor('website', 'body', '[klantnaam]'), 'klant');
  assert.equal(P.fieldFor('uitvoering', 'body', '[klantnaam]'), 'klant');
  assert.equal(P.fieldFor('situatie', 'body', '[beschrijf de huidige situatie]'), 'situatie');
  assert.equal(P.fieldFor('belofte', 'body', '[klantnaam]'), null, 'geen slide van het formulier');
  assert.equal(P.fieldFor('vpc', 'vpc', '[klantnaam]'), null, 'het canvas: bij Inhoud');
  // Elke invulplek in een leeg voorstel met alles aan wijst naar een veld van het formulier
  for (const soort of ['nieuw', 'optimaliseren']) {
    const slides = deck(input({ parts: all(), websiteSoort: soort }));
    const list = D.exampleIssues({ slides });
    assert.ok(list.length > 5);
    for (const x of list) {
      const field = P.fieldFor(slides[x.index].role, x.key, x.found);
      assert.ok(field && field in P.FEEDS, `${slides[x.index].role}.${x.key} (${x.found})`);
    }
  }
  // Een invulplek die je zelf in een vak van het canvas typt: die los je op de slide op
  const slides = deck(input());
  byRole(slides, 'vpc').vpc.taken = '[taak]';
  const hit = D.exampleIssues({ slides }).find((x) => slides[x.index].role === 'vpc');
  assert.equal(hit.key, 'vpc');
  assert.equal(P.fieldFor('vpc', hit.key, hit.found), null);
});

test('bijwerken: het formulier werkt de slides bij, jouw aanpassingen blijven', () => {
  // Vanaf niets: alle slides, met onderdeel en wat de generator schreef
  const inp = input();
  const first = P.sync([], P.build(inp), make);
  assert.deepEqual(roles(first.slides), roles(P.build(inp)));
  assert.deepEqual(first.added, roles(P.build(inp)));
  assert.deepEqual(first.removed, []);
  for (const s of first.slides) {
    assert.ok(s.id && s.role, s.role);
    assert.equal(s.gen.layout, s.layout);
    assert.deepEqual(P.touched(s), [], `${s.role} is nog van het voorstel`);
  }
  const inv = byRole(first.slides, 'investering');
  assert.deepEqual(JSON.parse(inv.gen.table), inv.table, 'tabel als JSON');
  const canvas = byRole(first.slides, 'vpc');
  assert.ok(!('vpc' in canvas.gen), 'de vakken houdt het voorstel niet bij');
  assert.deepEqual(canvas.vpc, P.emptyVpc(), 'een nieuw canvas begint leeg (make)');
  // Herladen en ongedaan maken gaan via JSON: daarna nog steeds van het voorstel
  for (const s of JSON.parse(JSON.stringify(first.slides))) assert.deepEqual(P.touched(s), [], `${s.role} na herladen`);
  assert.deepEqual(P.normalizeInput(JSON.parse(JSON.stringify(inp)), 'x'), inp);

  // Klantnaam typen: titels en tekst volgen
  inp.klant = 'Eurosit';
  let slides = P.sync(first.slides, P.build(inp), make).slides;
  assert.equal(byRole(slides, 'cover').title, 'Voorstel **Eurosit**');
  assert.equal(byRole(slides, 'situatie').title, 'Huidige situatie **Eurosit**');
  assert.deepEqual(slides.map((s) => s.id), first.slides.map((s) => s.id), 'dezelfde slides, zelfde volgorde');
  assert.notEqual(first.slides[0].title, slides[0].title, 'de oude lijst blijft zoals hij was');

  // Zelf de titel aangepast: die blijft; de tekst volgt nog wel
  const sit = byRole(slides, 'situatie');
  sit.title = 'Waar Eurosit nu staat';
  assert.deepEqual(P.touched(sit), ['title']);
  inp.klant = 'Eurosit BV';
  inp.situatie = 'Sterk merk, **weinig bereik**.';
  slides = P.sync(slides, P.build(inp), make).slides;
  assert.equal(byRole(slides, 'situatie').title, 'Waar Eurosit nu staat');
  assert.equal(byRole(slides, 'situatie').body, 'Sterk merk, **weinig bereik**.');
  assert.deepEqual(P.touched(byRole(slides, 'situatie')), ['title'], 'blijft aangepast');
  assert.equal(byRole(slides, 'aanpak').title, 'Voorstel marketingaanpak **Eurosit BV**');

  // De vakken van het canvas typ je op de slide: de slide blijft van het voorstel en de vakken blijven staan
  byRole(slides, 'vpc').vpc = { ...P.emptyVpc(), segment: 'Horeca', taken: 'Inrichten' };
  assert.deepEqual(P.touched(byRole(slides, 'vpc')), []);
  slides = P.sync(slides, P.build(inp), make).slides;
  assert.equal(byRole(slides, 'vpc').vpc.taken, 'Inrichten');

  // Prijzen typen: de tabel volgt
  P.set(inp, 'eenmalig', rows(['Positionering', '1500']));
  slides = P.sync(slides, P.build(inp), make).slides;
  assert.deepEqual(byRole(slides, 'investering').table.cells[1], ['Positionering', '€ 1.500,-']);
  // Een cel in de tabel veranderd: de tabel is van jou
  byRole(slides, 'investering').table.cells[1][0] = 'Eigen';
  assert.deepEqual(P.touched(byRole(slides, 'investering')), ['table']);
  P.set(inp, 'eenmalig', rows(['A', '100']));
  slides = P.sync(slides, P.build(inp), make).slides;
  assert.equal(byRole(slides, 'investering').table.cells[1][0], 'Eigen');

  // Een eigen slide in het midden blijft op zijn plek
  const own = { ...make({ layout: 'bullets' }), title: 'Eigen slide' };
  slides.splice(3, 0, own);
  slides = P.sync(slides, P.build(inp), make).slides;
  assert.equal(slides[3], own, 'onaangeroerd');
  assert.equal(slides.length, 12);

  // GA4 aan: direct na de website; weer uit: weg (geparkeerd)
  P.setOn(inp, 'ga4', true);
  let r = P.sync(slides, P.build(inp), make);
  assert.deepEqual(r.added, ['ga4']);
  assert.deepEqual(r.parked, {});
  assert.equal(r.slides.findIndex((s) => s.role === 'ga4'), r.slides.findIndex((s) => s.role === 'website') + 1);
  P.setOn(inp, 'ga4', false);
  r = P.sync(r.slides, P.build(inp), make);
  assert.deepEqual(r.removed, ['ga4']);
  assert.ok(!byRole(r.slides, 'ga4'));
  assert.deepEqual(Object.keys(r.parked), ['ga4']);
  slides = r.slides;

  // Jouw volgorde blijft, ook als je slides van het voorstel verplaatst
  const moved = D.move(slides, slides.findIndex((s) => s.role === 'slogan'), 1);
  slides = P.sync(moved, P.build(inp), make).slides;
  assert.deepEqual(roles(slides), roles(moved));
  // Een nieuw onderdeel zonder buur ervóór: vóór het eerste erna (hier de belofte, na de verplaatste slogan)
  const noCover = P.sync(slides.filter((s) => s.role !== 'cover'), P.build(inp), make).slides;
  assert.deepEqual(roles(noCover).slice(0, 3), ['slogan', 'cover', 'belofte']);

  // Twee slides met hetzelfde onderdeel: de tweede wordt een gewone slide
  const dup = { ...byRole(slides, 'belofte'), id: 'kopie', title: 'Kopie' };
  const onbekend = { ...make({ layout: 'bullets' }), role: 'bestaatniet', gen: { title: '' } };
  r = P.sync([...slides, dup, onbekend], P.build(inp), make);
  const copy = r.slides.find((s) => s.id === 'kopie');
  assert.equal(copy.role, '');
  assert.deepEqual(copy.gen, {});
  assert.equal(copy.title, 'Kopie');
  assert.equal(r.slides.find((s) => s.id === onbekend.id).role, '', 'onbekend onderdeel: gewone slide');
  assert.equal(r.slides.filter((s) => s.role === 'belofte').length, 1);

  // Terugzetten: de slide volgt het voorstel weer helemaal
  const back = P.resetSlide(byRole(slides, 'situatie'), P.specFor(inp, 'situatie'));
  assert.equal(back.title, 'Huidige situatie **Eurosit BV**');
  assert.deepEqual(P.touched(back), []);
  assert.equal(back.id, byRole(slides, 'situatie').id);
  const table = P.resetSlide(byRole(slides, 'investering'), P.specFor(inp, 'investering'));
  assert.deepEqual(table.table.cells, [['**Eenmalig**', ''], ['A', '€ 100,-']]);
  assert.deepEqual(P.touched(table), []);
  // Van layout gewisseld: ook die blijft staan
  const lay = { ...byRole(slides, 'uitvoering'), layout: 'split' };
  assert.deepEqual(P.touched(lay), ['layout']);
  assert.equal(P.sync([lay], [P.specFor(inp, lay.role)], make).slides[0].layout, 'split');
  // Bewerken op de slide raakt de spec niet
  const s1 = P.specFor(inp, 'investering');
  const made = P.sync([], [s1], make).slides[0];
  made.table.cells[0][0] = 'x';
  assert.equal(s1.table.cells[0][0], '**Eenmalig**');

  // Rare invoer geeft geen fout
  assert.deepEqual(P.sync(null, null, null), { slides: [], added: [], removed: [], parked: {} });
  assert.doesNotThrow(() => P.sync([null, 5, { role: 7 }], P.build(inp), null, 'x'));
  assert.deepEqual(P.touched(null), []);
  assert.deepEqual(P.normalizeGen({ title: 'a', body: 5, onbekend: 'x', vpc: '{}' }), { title: 'a' });
  assert.deepEqual(P.normalizeGen(null), {});
  assert.deepEqual(P.normalizeVpc({ taken: 'a', pijnen: null, x: 'y' }), { ...P.emptyVpc(), taken: 'a' });
});

test('herladen en ongedaan maken (normalizeSlide van de app) maken niets "aangepast"', () => {
  // Een ingevuld voorstel met alles aan, prijzen en een canvas
  const inp = input({
    klant: 'Eurosit', gesprek: 'januari', situatie: 'Sterk merk.', gewenst: 'Bekend merk.', namen: 'Joyce en Mitch',
    eenmalig: rows(['Positionering', '1.500,-'], ['GA4 audit*', '550'], ['**Fase 3 & 4**', 'N.T.B.']), maandelijks: rows(['Support', '1200']), totaal: true,
    voetnoot: '* Indien Eurosit klant wordt na de audit ontvangt het €250,- terug',
    parts: all(),
  });
  const slides = deck(inp);
  byRole(slides, 'vpc').vpc = { ...P.emptyVpc(), segment: 'Horeca', klanttype: 'Inkoper', taken: 'Inrichten\nBestellen', pijnen: 'Levertijd' };
  // Zoals na herladen: via JSON, en elke slide door normalizeSlide (tabel via de echte normalizeTable)
  let loaded = slides.map(normalizeSlide);
  for (const s of loaded) assert.deepEqual(P.touched(s), [], `${s.role} na herladen`);
  // En nog eens bijwerken daarna: niets verandert, niets wordt van jou
  const again = P.sync(loaded, P.build(inp), make).slides;
  assert.deepEqual(again, loaded);
  loaded = again.map(normalizeSlide).map(normalizeSlide);
  for (const s of loaded) assert.deepEqual(P.touched(s), [], `${s.role} na twee keer`);

  // Een tabel die normalizeTable anders opschrijft maar gelijk maakt: nog steeds van het voorstel
  const inv = byRole(slides, 'investering');
  const messy = {
    ...inv,
    table: { cells: [...inv.table.cells.map((row, i) => (i === 0 ? [row[0]] : row)), ...Array.from({ length: 10 }, () => ['weg', 'weg'])], firstCol: false, header: false, extra: 1 },
  };
  assert.deepEqual(plainJson(S.normalizeTable(messy.table)).cells.slice(0, inv.table.cells.length), inv.table.cells);
  const long = byRole(deck(input({ eenmalig: Array.from({ length: 12 }, (_, i) => ({ label: `P${i}`, amount: '1' })), maandelijks: rows(['M', '2']), totaal: true })), 'investering');
  const longMessy = { ...long, table: { ...long.table, cells: [...long.table.cells, ['vijftiende', 'rij']] } };
  assert.deepEqual(P.touched(longMessy), [], 'een rij voorbij de 14 valt ook bij normalizeTable weg');
  assert.deepEqual(P.touched({ ...long, table: { ...long.table, cells: long.table.cells.map((r) => r.concat('')) } }), ['table'], 'een extra kolom is wel een wijziging');
  // Een echte wijziging blijft een wijziging, ook na herladen
  const edited = normalizeSlide({ ...inv, table: { ...inv.table, cells: inv.table.cells.map((r, i) => (i === 1 ? ['Eigen', r[1]] : r)) } });
  assert.deepEqual(P.touched(edited), ['table']);
  // De vakken van het canvas zijn van de slide: nooit "aangepast", en ze blijven na herladen
  const vpc = normalizeSlide({ ...byRole(slides, 'vpc'), vpc: { ...byRole(slides, 'vpc').vpc, klanttype: 'Directeur' } });
  assert.deepEqual(P.touched(vpc), []);
  assert.equal(vpc.vpc.klanttype, 'Directeur');

  // Een concept van vóór deze versie: tabel-JSON in een andere sleutelvolgorde; het canvas
  // kwam uit het formulier (gen.vpc): de vakken blijven op de slide staan en zijn nu van jou
  const oldVpc = { segment: 'Horeca', taken: 'Inrichten', pijnen: '', voordelen: '', producten: '', verzachters: '', verschaffers: '' };
  const legacy = [
    { ...inv, gen: { ...inv.gen, table: JSON.stringify({ header: inv.table.header, firstCol: inv.table.firstCol, cells: inv.table.cells }) } },
    { ...byRole(slides, 'vpc'), vpc: oldVpc, gen: { ...byRole(slides, 'vpc').gen, vpc: JSON.stringify(oldVpc) } },
  ].map(normalizeSlide);
  for (const s of legacy) assert.deepEqual(P.touched(s), [], `${s.role} uit een oud concept`);
  assert.ok(!('vpc' in legacy[1].gen));
  const kept = P.sync([legacy[1]], [P.specFor({ ...inp, vpc: P.emptyVpc() }, 'vpc')], make).slides[0];
  assert.deepEqual(kept.vpc, { ...P.emptyVpc(), segment: 'Horeca', taken: 'Inrichten' }, 'bijwerken leegt het canvas niet');
  // Een onleesbare onthouden tabel: dan blijft jouw tabel staan
  const broken = { ...inv, gen: { ...inv.gen, table: '{kapot' } };
  assert.deepEqual(P.touched(broken), ['table']);
  assert.equal(P.sync([broken], [P.specFor(input(), 'investering')], make).slides[0].table, broken.table);
});

test('verwijderen: een onderdeel gaat uit, een vaste slide komt in hidden', () => {
  const inp = input();
  assert.equal(P.isOn(inp, 'website'), true);
  P.markRemoved(inp, 'website');
  assert.equal(inp.parts.website, false);
  assert.equal(P.isOn(inp, 'website'), false);
  assert.ok(!inp.hidden.includes('website'));
  P.markRemoved(inp, 'belofte');
  P.markRemoved(inp, 'belofte');
  assert.deepEqual(inp.hidden, ['belofte']);
  assert.equal(P.isOn(inp, 'belofte'), false);
  assert.ok(!roles(P.build(inp)).includes('belofte'));
  assert.ok(!roles(P.build(inp)).includes('website'));
  // De slide verdwijnt bij de volgende wijziging en komt niet vanzelf terug
  const r = P.sync(deck(input()), P.build(inp), make);
  assert.deepEqual(r.removed.sort(), ['belofte', 'website']);
  // Zet terug
  P.setOn(inp, 'belofte', true);
  assert.deepEqual(inp.hidden, []);
  assert.ok(roles(P.build(inp)).includes('belofte'));
  assert.equal(P.markRemoved(inp, 'onbekend'), false);
  assert.equal(P.isOn(inp, 'onbekend'), false);
});

test('geparkeerd: uitzetten en weer aanzetten verliest niets', () => {
  const inp = input({ klant: 'Eurosit', situatie: 'Sterk merk.' });
  let slides = deck(inp);
  // Eigen werk op drie slides: het klantlogo, een eigen titel en de vakken van het canvas
  byRole(slides, 'cover').photoKey = 'foto:logo';
  byRole(slides, 'cover').crop = { zoom: 1.4, fx: 0.3, fy: 0.5 };
  byRole(slides, 'situatie').title = 'Waar Eurosit nu staat';
  byRole(slides, 'vpc').vpc = { ...P.emptyVpc(), segment: 'Horeca', taken: 'Inrichten' };
  const ids = Object.fromEntries(slides.map((s) => [s.role, s.id]));
  const order = roles(slides);

  // Uit: de slides gaan naar parked, precies zoals ze waren
  P.markRemoved(inp, 'cover');
  P.markRemoved(inp, 'situatie');
  P.markRemoved(inp, 'vpc');
  const before = { ga4: { ...make({ layout: 'tekst' }), role: 'ga4' } };
  const frozen = JSON.stringify(before);
  let r = P.sync(slides, P.build(inp), make, before);
  assert.equal(JSON.stringify(before), frozen, 'parked zelf blijft zoals hij was');
  assert.notEqual(r.parked, before, 'een nieuw object');
  assert.deepEqual(r.removed, ['cover', 'situatie', 'vpc']);
  assert.deepEqual(Object.keys(r.parked).sort(), ['cover', 'ga4', 'situatie', 'vpc'], 'ga4 blijft geparkeerd zolang hij uit staat');
  assert.equal(r.parked.cover, byRole(slides, 'cover'), 'de slide zelf, onaangeroerd');
  assert.ok(!r.slides.some((s) => ['cover', 'situatie', 'vpc'].includes(s.role)));

  // Intussen verandert het formulier; na opslaan en herladen (JSON, normalizeSlide) staat alles nog klaar
  inp.klant = 'Eurosit BV';
  inp.situatie = 'Sterk merk, weinig bereik.';
  const parked = Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(r.parked))).map(([k, s]) => [k, normalizeSlide(s)]));
  slides = r.slides.map(normalizeSlide);
  r = P.sync(slides, P.build(inp), make, parked);
  assert.deepEqual(r.added, [], 'nog uit: niets terug');
  assert.deepEqual(Object.keys(r.parked).sort(), ['cover', 'ga4', 'situatie', 'vpc']);

  // Weer aan: precies die slides komen terug, op hun plek, en volgen het formulier waar je niets aanpaste
  P.setOn(inp, 'cover', true);
  P.setOn(inp, 'situatie', true);
  P.setOn(inp, 'vpc', true);
  const back = P.sync(r.slides, P.build(inp), make, r.parked);
  assert.deepEqual(back.added, ['cover', 'situatie', 'vpc']);
  assert.deepEqual(Object.keys(back.parked), ['ga4'], 'wat terugkwam, is niet meer geparkeerd');
  assert.deepEqual(roles(back.slides), order, 'op dezelfde plek als eerst');
  const cover = byRole(back.slides, 'cover');
  assert.equal(cover.id, ids.cover, 'dezelfde slide');
  assert.equal(cover.photoKey, 'foto:logo', 'het klantlogo is er weer');
  assert.deepEqual(cover.crop, { zoom: 1.4, fx: 0.3, fy: 0.5 });
  assert.equal(cover.title, 'Voorstel **Eurosit BV**', 'niet aangepast: volgt de nieuwe klantnaam');
  const sit = byRole(back.slides, 'situatie');
  assert.equal(sit.id, ids.situatie);
  assert.equal(sit.title, 'Waar Eurosit nu staat', 'je eigen titel blijft');
  assert.equal(sit.body, 'Sterk merk, weinig bereik.', 'de tekst volgt het formulier');
  assert.deepEqual(P.touched(sit), ['title']);
  const vpc = byRole(back.slides, 'vpc');
  assert.equal(vpc.id, ids.vpc);
  assert.deepEqual(vpc.vpc, { ...P.emptyVpc(), segment: 'Horeca', taken: 'Inrichten' }, 'de vakken zijn er weer');
  for (const s of back.slides) assert.equal(back.slides.filter((x) => x.id === s.id).length, 1, 'elk id één keer');

  // Een nieuwere slide vervangt een oudere in parked
  P.markRemoved(inp, 'situatie');
  const again = P.sync(back.slides, P.build(inp), make, { situatie: { ...sit, id: 'oud', title: 'Oud' } });
  assert.equal(again.parked.situatie.id, ids.situatie);
  assert.equal(again.parked.situatie.title, 'Waar Eurosit nu staat');

  // Staat de slide er al, dan is een geparkeerde kopie oud: de slide in de presentatie wint
  const stale = P.sync(back.slides, P.build({ ...inp, hidden: [] }), make, { situatie: { ...sit, id: 'oud', title: 'Oud' } });
  assert.deepEqual(stale.parked, {});
  assert.equal(byRole(stale.slides, 'situatie').id, ids.situatie);
  assert.equal(stale.slides.filter((s) => s.role === 'situatie').length, 1);

  // Alleen bekende onderdelen met een slide; de rest valt weg, en zonder slide maakt make een verse
  const odd = P.sync([], P.build(input()), make, { onbekend: { title: 'x' }, cover: 5, situatie: null, sea: { title: 'x' } });
  assert.deepEqual(odd.parked, {});
  assert.equal(byRole(odd.slides, 'cover').photoKey, '');
  assert.deepEqual(P.sync([], [], make, ['cover']).parked, {});

  // Een geparkeerde slide met een id dat al bestaat (zou niet moeten): hij komt terug met een nieuw id
  const taken = P.sync([{ ...make({ layout: 'bullets' }), id: 'dubbel' }], [P.specFor(input(), 'belofte')], make, { belofte: { ...make({ layout: 'kolommen' }), id: 'dubbel', role: 'belofte', title: 'Eigen' } });
  assert.deepEqual(taken.slides.map((s) => s.id).filter((id) => id === 'dubbel'), ['dubbel']);
  assert.equal(taken.slides.length, 2);
});

test('klaar om te versturen: de checklist', () => {
  const ids = (list) => list.map((x) => x.id);
  const byId = (list, id) => list.find((x) => x.id === id);
  // Een nieuw voorstel: bijna alles staat nog open
  const inp = input();
  let slides = deck(inp);
  let list = P.checklist(inp, slides, { placeholders: 5, overflow: 0 });
  assert.deepEqual(ids(list), ['klant', 'situatie', 'prijzen', 'logo', 'canvas', 'invulplekken', 'past']);
  assert.deepEqual(list.map((x) => x.label), [
    'Klantnaam ingevuld', 'Huidige situatie beschreven', 'Prijzen ingevuld', 'Klantlogo op de titelslide',
    'Waardepropositie ingevuld', '5 invulplekken over, zoals [klantnaam]', 'Alle tekst past',
  ]);
  assert.deepEqual(list.map((x) => x.done), [false, false, false, false, false, false, true]);
  assert.deepEqual(list.map((x) => x.optional), [false, false, false, true, false, false, false], 'alleen het logo is optioneel');
  assert.deepEqual(list.map((x) => x.go), [
    { section: 'voorstel', field: '#pKlant' },
    { section: 'voorstel', field: '#pSituatie' },
    { section: 'prijzen' },
    { section: 'voorstel', field: '#pLogoBtn' },
    { role: 'vpc', section: 'inhoud' },
    { issue: 'first' },
    { issue: 'overflow' },
  ]);
  assert.equal(byId(list, 'canvas').hint, 'of zet hem uit bij Onderdelen');
  for (const x of list) {
    assert.deepEqual(Object.keys(x), ['id', 'label', 'done', 'optional', 'hint', 'go']);
    if (x.id !== 'canvas') assert.equal(x.hint, '', x.id);
  }
  assert.equal(P.checklist(inp, slides, { placeholders: 1, overflow: 2 }).find((x) => x.id === 'invulplekken').label, '1 invulplek over, zoals [klantnaam]');
  assert.equal(byId(P.checklist(inp, slides, { placeholders: 1, overflow: 2 }), 'past').done, false);

  // Alles ingevuld: alles af, zonder hints
  const full = input({ klant: 'Eurosit', situatie: 'Sterk merk.', eenmalig: rows(['Positionering', '1500']) });
  slides = deck(full);
  byRole(slides, 'cover').photoKey = 'foto:logo';
  byRole(slides, 'vpc').vpc = { ...P.emptyVpc(), taken: 'Inrichten' };
  list = P.checklist(full, slides, { placeholders: 0, overflow: 0 });
  assert.deepEqual(list.map((x) => x.done), [true, true, true, true, true, true, true]);
  assert.ok(list.every((x) => x.hint === ''));
  assert.equal(byId(list, 'invulplekken').label, 'Geen invulplekken meer');
  assert.equal(byId(list, 'klant').label, 'Klantnaam ingevuld');

  // Het canvas: minstens één van de zes vakken; klantsegment en klanttype alleen tellen niet
  byRole(slides, 'vpc').vpc = { ...P.emptyVpc(), segment: 'Horeca', klanttype: 'Inkoper', pijnen: '  ' };
  assert.equal(byId(P.checklist(full, slides, {}), 'canvas').done, false);
  // Prijzen: een regel met een bedrag (ook N.T.B.); alleen een omschrijving is nog niet genoeg
  const priced = (eenmalig, maandelijks = []) => {
    const p = input({ eenmalig, maandelijks });
    return byId(P.checklist(p, deck(p), {}), 'prijzen').done;
  };
  assert.equal(priced(rows(['Positionering', ''])), false);
  assert.equal(priced(rows(['Fase 3 & 4', 'N.T.B.'])), true);
  assert.equal(priced([], rows(['', '1200'])), true, 'ook maandelijks');
  assert.equal(priced(rows(['', '  '])), false);

  // Zelf op de slide geschreven telt ook: de situatie in de tekst, een bedrag in de tabel
  const own = input();
  slides = deck(own);
  byRole(slides, 'situatie').body = 'Eigen tekst op de slide.';
  byRole(slides, 'investering').table = { header: false, firstCol: false, cells: [['**Eenmalig**', ''], ['Positionering', '€ 1.500,-']] };
  list = P.checklist(own, slides, {});
  assert.equal(byId(list, 'situatie').done, true);
  assert.equal(byId(list, 'prijzen').done, true);
  byRole(slides, 'situatie').body = '[beschrijf de huidige situatie]';
  assert.equal(byId(P.checklist(own, slides, {}), 'situatie').done, false, 'een invulplek is nog niet beschreven');

  // Wat uit staat, staat niet in de lijst
  const off = input({ parts: { ...P.OPTIONAL, vpc: false }, hidden: ['situatie', 'investering', 'cover'] });
  assert.deepEqual(ids(P.checklist(off, deck(off), {})), ['klant', 'invulplekken', 'past']);
  // Het canvas-onderdeel met een andere layout gekozen: geen canvas op de slide, dus niet in de lijst
  slides = deck(inp);
  byRole(slides, 'vpc').layout = 'tekst';
  assert.ok(!ids(P.checklist(inp, slides, {})).includes('canvas'));

  // Zonder tellingen: niets te melden; rare invoer geeft geen fout
  assert.deepEqual(P.checklist(inp, deck(inp)).slice(-2).map((x) => x.done), [true, true]);
  assert.deepEqual(P.checklist(inp, deck(inp), { placeholders: NaN, overflow: -3 }).slice(-2).map((x) => x.done), [true, true]);
  assert.doesNotThrow(() => P.checklist(null, null, null));
  assert.deepEqual(ids(P.checklist(null, [null, 5, 'x'], 'x')), ['klant', 'situatie', 'prijzen', 'logo', 'canvas', 'invulplekken', 'past']);
  assert.equal(byId(P.checklist(inp, [], { placeholders: 2 }), 'invulplekken').label, '2 invulplekken over', 'zonder slides geen voorbeeld');
});

test('tekst van Genummerd en Kolommen', () => {
  assert.deepEqual(P.parseQuestions('Pijn - Welke concrete pijn ervaart de klant?'), {
    items: [{ head: 'Pijn', text: 'Welke concrete pijn ervaart de klant?' }],
    outro: '',
  });
  const q = P.parseQuestions('\n**Research** – Company | Customers\nRetarget / Positioning - Segmenten\nAlleen een kop\n- Met streepje - vraag?\n\nSlotzin één.\n\nSlotzin twee.');
  assert.deepEqual(q.items, [
    { head: 'Research', text: 'Company | Customers' },
    { head: 'Retarget / Positioning', text: 'Segmenten' },
    { head: 'Alleen een kop', text: '' },
    { head: 'Met streepje', text: 'vraag?' },
  ]);
  assert.equal(q.outro, 'Slotzin één.\n\nSlotzin twee.');
  // Een getypt streepje of nummer vooraan valt weg: de layout nummert zelf
  assert.deepEqual(P.parseQuestions('- Pijn - Welke pijn?\n– Trend\n• Trigger - Wat?\n3. Alternatief - Wat nu?\n  -   Verlangen - Wat wel?').items.map((i) => i.head), ['Pijn', 'Trend', 'Trigger', 'Alternatief', 'Verlangen']);
  assert.deepEqual(P.parseQuestions('-Geen spatie - vraag').items[0].head, '-Geen spatie', 'alleen een streepje met een spatie erna');
  assert.deepEqual(P.parseQuestions('Trend - Wat gebeurt er in de markt/context?').items[0].head, 'Trend', 'een schuine streep is geen scheiding');
  assert.deepEqual(P.parseQuestions(''), { items: [], outro: '' });
  assert.deepEqual(P.parseQuestions(null), { items: [], outro: '' });

  assert.deepEqual(P.parseColumns('Onze visie\nTekst één\n\n\nMission statement\nTekst twee\n- punt\n\n**Derde**\n'), [
    { head: 'Onze visie', text: 'Tekst één' },
    { head: 'Mission statement', text: 'Tekst twee\n- punt' },
    { head: 'Derde', text: '' },
  ]);
  assert.deepEqual(P.parseColumns('Kop\r\nTekst'), [{ head: 'Kop', text: 'Tekst' }]);
  assert.deepEqual(P.parseColumns(''), []);
  assert.deepEqual(P.parseColumns(undefined), []);
});
