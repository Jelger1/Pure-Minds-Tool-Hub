/* Tests voor de Icon Finder: js/icons/hex.js (zeshoek en uitgesneden icoon),
   de gegenereerde icon-data.js en icon-fill-data.js, en de mappen in
   assets/icons (Vol en Zeshoek) */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HEX = require('../js/icons/hex.js');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
// Met LF als regeleinde, ook als git op Windows CRLF heeft uitgecheckt
const lf = (file) => read(file).replace(/\r\n/g, '\n');
const bestaat = (file) => fs.existsSync(path.join(root, file));
const padVan = (file) => read(file).match(/\sd="([^"]*)"/)[1];

// icon-data.js en icon-fill-data.js zetten window.PM_ICON_DATA en PM_ICON_FILL; hier in een eigen sandbox
const sandbox = { window: {} };
vm.runInNewContext(read('js/icons/icon-data.js'), sandbox);
vm.runInNewContext(read('js/icons/icon-fill-data.js'), sandbox);
const DATA = sandbox.window.PM_ICON_DATA;
const FILL = sandbox.window.PM_ICON_FILL;
const sleutel = (ic) => `${DATA.categories[ic[1]]}/${ic[0]}`;
const LIJN = DATA.icons.filter((ic) => ic[3] === 1);   // naam-line.svg: hebben een volle stijl
const EEN_STIJL = DATA.icons.filter((ic) => ic.length === 3);

const ARROW = 'M13 16.172L18.364 10.808L19.778 12.222L12 20L4.222 12.222L5.636 10.808L11 16.172V4H13V16.172Z';
const MAPPEN = ['Cyaan zeshoek - wit icoon', 'Donkere zeshoek - wit icoon', 'Magenta zeshoek - wit icoon', 'Witte zeshoek - doorzichtig icoon'];
const WIT = MAPPEN[3];

test('uitgesneden icoon: één samengesteld pad, wit, evenodd, zonder icoonkleur', () => {
  const svg = HEX.svg(ARROW, { shape: 'hex', fill: '#ffffff', color: '#303030', knockout: true });
  const paden = svg.match(/<path\b[^>]*>/g);
  assert.equal(paden.length, 1, 'zeshoek en icoon in één pad');
  assert.match(paden[0], /^<path fill="#ffffff" fill-rule="evenodd" d="/);
  // Het pad is de zeshoek met het geplaatste icoon als extra deelpad (het gat)
  const zonder = HEX.svg(ARROW, { shape: 'hex', fill: '#ffffff' });
  const zeshoek = zonder.match(/<path fill="#ffffff" d="([^"]*)"/)[1];
  assert.equal(paden[0].match(/ d="([^"]*)"/)[1], zeshoek + HEX.place(ARROW).d);
  assert.ok(!svg.includes('#303030'), 'geen icoonkleur');
  assert.ok(!/<mask|<clipPath|<defs|stroke/.test(svg), 'geen masker, geen rand');
});

test('presets: de vier mappen, effen, wit is uitgesneden', () => {
  assert.deepEqual(Object.keys(HEX.presets), ['cyaan', 'donker', 'magenta', 'wit']);
  assert.deepEqual(HEX.presets.cyaan, { fill: '#1ab9e2', color: '#ffffff' });
  assert.deepEqual(HEX.presets.donker, { fill: '#303030', color: '#ffffff' });
  assert.deepEqual(HEX.presets.magenta, { fill: '#b61b50', color: '#ffffff' });
  assert.deepEqual(HEX.presets.wit, { fill: '#ffffff', knockout: true });
  assert.ok(Object.isFrozen(HEX.presets.wit));
});

test('icon-data.js: de lijnstijl (en iconen in één stijl), geen volle paden', () => {
  assert.equal(DATA.icons.length, 1690);
  assert.equal(LIJN.length, 1539);
  assert.equal(EEN_STIJL.length, 151);
  assert.ok(!DATA.categories.includes('Vol'), 'Vol is geen categorie');
  for (const ic of DATA.icons) {
    assert.ok(ic.length === 3 || (ic.length === 4 && ic[3] === 1), ic[0]);
    assert.match(ic[2], /^M[\d.]/, ic[0]);
  }
  // knockout: alleen voor een icoon zonder volle stijl met overlap (nu geen)
  for (const [k, d] of Object.entries(DATA.knockout)) {
    const ic = DATA.icons.find((x) => sleutel(x) === k);
    assert.ok(ic && !FILL[k], k);
    assert.doesNotThrow(() => HEX.place(d), k);
  }
});

test('icon-fill-data.js: de volle stijl voor elk lijnicoon, niet voor iconen in één stijl', () => {
  assert.equal(Object.keys(FILL).length, LIJN.length);
  for (const ic of LIJN) assert.ok(FILL[sleutel(ic)], `${sleutel(ic)} heeft geen volle stijl`);
  for (const ic of EEN_STIJL) assert.ok(!(sleutel(ic) in FILL), sleutel(ic));
  for (const [k, d] of Object.entries(FILL)) {
    assert.match(d, /^M[\d.]/, k);
    assert.ok(!/[^MLHVCZ\d.\s-]/.test(d), `${k}: alleen M, L, H, V, C en Z`);
    assert.doesNotThrow(() => HEX.place(d), k);
  }
  // Volgorde gelijk aan icon-data.js: dezelfde iconen geven hetzelfde bestand
  // (als tekst: lijsten uit de sandbox hebben een ander Array-prototype, deepEqual faalt daarop)
  assert.equal(Object.keys(FILL).join('|'), LIJN.map(sleutel).join('|'));
  // Overlap: het samengevoegde pad uit uitsnijpaden.json, niet het origineel
  const uitsnij = JSON.parse(read('assets/icons/uitsnijpaden.json'));
  for (const [bestand, d] of Object.entries(uitsnij)) {
    if (bestand.endsWith('-fill.svg')) assert.equal(FILL[bestand.replace(/-fill\.svg$/, '')], d, bestand);
  }
});

test('Icon Finder: de volle stijl laadt pas als iemand de witte zeshoek kiest', () => {
  const html = read('tools/icons.html');
  assert.ok(!html.includes('icon-fill-data.js'), 'niet in de gewone lading');
  assert.match(read('js/icons/app.js'), /PM\.url\('js\/icons\/icon-fill-data\.js'\)/);
});

test('Icon Finder: de witte zeshoek alleen in de volle stijl, nooit een uitgesneden lijnicoon', () => {
  const app = read('js/icons/app.js');
  // Laadt de volle stijl niet, dan terug naar cyaan in plaats van de lijnstijl uitsnijden
  const withFill = app.slice(app.indexOf('function withFill('), app.indexOf('async function ensureFill('));
  assert.match(withFill, /state\.hexColor = 'cyaan'/);
  assert.ok(!/lijnstijl met een melding/.test(app));
  // Downloaden en kopiëren wachten op de volle stijl en stoppen als die er niet is
  assert.equal((app.match(/if \(!\(await ensureFill\(\)\)\) return;/g) || []).length, 2);
  // De uitleg zegt kort waarom (in de tool en bij het icoon)
  assert.match(read('tools/icons.html'), /id="fillNote"[^>]*>.*alleen de <b>volle stijl \(Fill\)<\/b>: het wit slokt dunne lijnen op/);
  assert.match(app, /Uitgesneden alleen vol: het wit slokt dunne lijnen op/);
});

test('bronmappen: lijnstijl in de categorieën, de volle stijl in Vol/', () => {
  for (const cat of DATA.categories) {
    const bestanden = fs.readdirSync(path.join(root, 'assets/icons', cat));
    assert.ok(!bestanden.some((f) => f.endsWith('-fill.svg')), cat);
  }
  let n = 0;
  for (const cat of fs.readdirSync(path.join(root, 'assets/icons/Vol'))) {
    assert.ok(DATA.categories.includes(cat), `Vol/${cat}`);
    for (const f of fs.readdirSync(path.join(root, 'assets/icons/Vol', cat))) {
      assert.match(f, /-fill\.svg$/, `Vol/${cat}/${f}`);
      assert.ok(bestaat(`assets/icons/${cat}/${f.replace(/-fill\.svg$/, '-line.svg')}`), `Vol/${cat}/${f} zonder lijnicoon`);
      n++;
    }
  }
  assert.equal(n, LIJN.length);
  assert.ok(bestaat('assets/icons/LICENSE'));
});

test('Zeshoek: vier mappen met alle iconen, gelijk aan PMHex.svg(); wit in de volle stijl', () => {
  const mappen = fs.readdirSync(path.join(root, 'assets/icons/Zeshoek'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepEqual(mappen, MAPPEN);
  const uitsnij = JSON.parse(read('assets/icons/uitsnijpaden.json'));
  const kleuren = [HEX.presets.cyaan, HEX.presets.donker, HEX.presets.magenta];
  // Een gewoon icoon, een icoon in één stijl en elk icoon met een eigen uitsnijpad: byte voor byte gelijk
  const proef = ['Arrows/arrow-down', 'User & Faces/team', 'Editor/bold',
    ...Object.keys(uitsnij).filter((k) => !k.startsWith('_')).map((k) => k.replace(/(-line|-fill)?\.svg$/, ''))];
  for (const k of proef) {
    const [cat, naam] = k.split('/');
    const lijn = bestaat(`assets/icons/${cat}/${naam}-line.svg`) ? `${naam}-line.svg` : `${naam}.svg`;
    const vol = bestaat(`assets/icons/Vol/${cat}/${naam}-fill.svg`) ? `${naam}-fill.svg` : null;
    const bron = padVan(`assets/icons/${cat}/${lijn}`);
    kleuren.forEach((p, n) => {
      assert.equal(lf(`assets/icons/Zeshoek/${MAPPEN[n]}/${cat}/${lijn}`), HEX.svg(bron, { shape: 'hex', ...p }) + '\n', `${MAPPEN[n]}/${cat}/${lijn}`);
    });
    const wit = vol || lijn;
    const d = uitsnij[`${cat}/${wit}`] || (vol ? padVan(`assets/icons/Vol/${cat}/${vol}`) : bron);
    assert.equal(lf(`assets/icons/Zeshoek/${WIT}/${cat}/${wit}`), HEX.svg(d, { shape: 'hex', ...HEX.presets.wit }) + '\n', `${WIT}/${cat}/${wit}`);
  }
  // Elke map alle iconen; de witte map heet naar de volle stijl (naam-fill.svg), geen lijnstijl meer
  for (const map of MAPPEN) {
    let n = 0;
    for (const cat of DATA.categories) n += fs.readdirSync(path.join(root, 'assets/icons/Zeshoek', map, cat)).length;
    assert.equal(n, DATA.icons.length, map);
  }
  const witte = DATA.categories.flatMap((cat) => fs.readdirSync(path.join(root, 'assets/icons/Zeshoek', WIT, cat)));
  assert.equal(witte.filter((f) => f.endsWith('-fill.svg')).length, LIJN.length);
  assert.equal(witte.filter((f) => f.endsWith('-line.svg')).length, 0);
});

test('Zeshoek: alleen effen huiskleuren, geen verloop, geen #1b71a8', () => {
  for (const map of MAPPEN) {
    const svg = read(`assets/icons/Zeshoek/${map}/Arrows/${map === WIT ? 'arrow-down-fill.svg' : 'arrow-down-line.svg'}`);
    assert.ok(!/Gradient|stroke|#1b71a8/i.test(svg), map);
    for (const kleur of svg.match(/#[0-9a-f]{6}/gi)) assert.ok(['#1ab9e2', '#303030', '#b61b50', '#ffffff'].includes(kleur), `${map}: ${kleur}`);
  }
  const overzicht = read('assets/icons/Zeshoek/overzicht.html');
  assert.ok(!/#1b71a8/i.test(overzicht));
  assert.ok(!/__[A-Z_]+__/.test(overzicht), 'alle plekken in het sjabloon ingevuld');
});
