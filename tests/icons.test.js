/* Tests voor de Icon Finder: js/icons/hex.js (zeshoek en uitgesneden icoon),
   de gegenereerde icon-data.js en de mappen in assets/icons/Zeshoek */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const HEX = require('../js/icons/hex.js');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// icon-data.js zet window.PM_ICON_DATA; hier in een eigen sandbox
const sandbox = { window: {} };
vm.runInNewContext(read('js/icons/icon-data.js'), sandbox);
const DATA = sandbox.window.PM_ICON_DATA;

const ARROW = 'M13 16.172L18.364 10.808L19.778 12.222L12 20L4.222 12.222L5.636 10.808L11 16.172V4H13V16.172Z';
const MAPPEN = ['Cyaan zeshoek - wit icoon', 'Donkere zeshoek - wit icoon', 'Magenta zeshoek - wit icoon', 'Witte zeshoek - doorzichtig icoon'];

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

test('icon-data.js: alleen de lijnstijl, geen volle paden meer', () => {
  assert.equal(DATA.icons.length, 1690);
  for (const ic of DATA.icons) {
    assert.ok(ic.length === 3 || (ic.length === 4 && ic[3] === 1), ic[0]);
    assert.match(ic[2], /^M[\d.]/, ic[0]);
  }
  // De paar iconen met overlap hebben een eigen uitsnijpad, en dat icoon bestaat
  assert.ok(Object.keys(DATA.knockout).length >= 1);
  for (const [sleutel, d] of Object.entries(DATA.knockout)) {
    const [cat, naam] = sleutel.split('/');
    assert.ok(DATA.icons.some((ic) => ic[0] === naam && DATA.categories[ic[1]] === cat), sleutel);
    assert.doesNotThrow(() => HEX.place(d), sleutel);
  }
});

test('bronmappen: geen -fill.svg meer, wel elke -line', () => {
  for (const cat of DATA.categories) {
    const bestanden = fs.readdirSync(path.join(root, 'assets/icons', cat));
    assert.ok(!bestanden.some((f) => f.endsWith('-fill.svg')), cat);
  }
  assert.ok(fs.existsSync(path.join(root, 'assets/icons/LICENSE')));
});

test('Zeshoek: vier mappen met alle iconen, gelijk aan PMHex.svg()', () => {
  const mappen = fs.readdirSync(path.join(root, 'assets/icons/Zeshoek'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepEqual(mappen, MAPPEN);
  const uitsnij = JSON.parse(read('assets/icons/uitsnijpaden.json'));
  const presets = [HEX.presets.cyaan, HEX.presets.donker, HEX.presets.magenta, HEX.presets.wit];
  // Een gewoon icoon en de iconen met een eigen uitsnijpad: byte voor byte gelijk
  const proef = [['Arrows', 'arrow-down-line.svg'], ...Object.keys(uitsnij).filter((k) => !k.startsWith('_')).map((k) => k.split('/'))];
  for (const [cat, bestand] of proef) {
    const bron = read(`assets/icons/${cat}/${bestand}`).match(/\sd="([^"]*)"/)[1];
    MAPPEN.forEach((map, n) => {
      const p = presets[n];
      const d = p.knockout ? uitsnij[`${cat}/${bestand}`] || bron : bron;
      assert.equal(read(`assets/icons/Zeshoek/${map}/${cat}/${bestand}`), HEX.svg(d, { shape: 'hex', ...p }) + '\n', `${map}/${cat}/${bestand}`);
    });
  }
  for (const map of MAPPEN) {
    let n = 0;
    for (const cat of DATA.categories) n += fs.readdirSync(path.join(root, 'assets/icons/Zeshoek', map, cat)).length;
    assert.equal(n, DATA.icons.length, map);
  }
});

test('Zeshoek: alleen effen huiskleuren, geen verloop, geen #1b71a8', () => {
  for (const map of MAPPEN) {
    const svg = read(`assets/icons/Zeshoek/${map}/Arrows/arrow-down-line.svg`);
    assert.ok(!/Gradient|stroke|#1b71a8/i.test(svg), map);
    for (const kleur of svg.match(/#[0-9a-f]{6}/gi)) assert.ok(['#1ab9e2', '#303030', '#b61b50', '#ffffff'].includes(kleur), `${map}: ${kleur}`);
  }
  assert.ok(!/#1b71a8/i.test(read('assets/icons/Zeshoek/overzicht.html')));
});
