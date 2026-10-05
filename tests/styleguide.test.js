/* Tests voor de Brand Styleguide: tokens gelijk aan de huisstijl, teksten uit brandbook v2.0,
   uitleg en rail bij de HTML, de pagina's, het rekenwerk (model.js), de SVG-paden, de export,
   de voorbeeldfoto's en de voorbeelden uit de makers (gelijk aan die makers) */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const T = require('../js/styleguide/brand-tokens.js');
const C = require('../js/styleguide/content.js');
const M = require('../js/styleguide/model.js');
const P = require('../js/styleguide/svg-path.js');
const brand = require('../js/shared/brand.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const words = (t) => String(t).trim().split(/\s+/).length;

/* ---------------------------------------------------------------------------
   Tokens: geen tweede waarheid naast global.css en brand.js
   ------------------------------------------------------------------------- */

test('kleuren zijn gelijk aan de CSS-variabelen in global.css en aan PM.brand', () => {
  const css = read('css/global.css');
  const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
  const vars = Object.fromEntries(Array.from(root.matchAll(/--pm-([\w-]+):\s*(#[0-9a-f]{6})/gi), (m) => [m[1], m[2].toLowerCase()]));
  const withCss = T.allColors().filter((c) => c.css);
  assert.ok(withCss.length >= 7, 'de merkkleuren hebben een CSS-variabele');
  for (const c of withCss) {
    assert.equal(c.hex.toLowerCase(), vars[c.css], `--pm-${c.css} = ${c.name}`);
    assert.equal(c.hex.toLowerCase(), brand.COLORS[c.css], `PM.brand.COLORS.${c.css} = ${c.name}`);
  }
  // Oranje staat (nog) niet in global.css, wel als waarschuwingskleur in .notice-warn
  assert.match(css, /#e0951f/i);
  assert.equal(T.color('oranje').hex, '#E0951F');
});

test('RGB en CMYK horen bij de HEX-waarde (CMYK rekenkundig, zoals v2.0)', () => {
  for (const c of T.allColors()) {
    assert.deepEqual(M.rgbOf(c.hex), c.rgb, `${c.name}: RGB`);
    assert.deepEqual(M.cmykOf(c.rgb), c.cmyk, `${c.name}: CMYK`);
  }
  assert.deepEqual(T.color('cyaan').cmyk, [88, 18, 0, 11], 'zoals in brandbook v2.0');
});

test('gewichten: Regular 400, Bold 700 en ExtraBold 800, gelijk aan de @font-face-regels', () => {
  const css = read('css/global.css');
  const faces = Array.from(css.matchAll(/@font-face\s*\{([^}]+)\}/g), (m) => m[1]).filter((f) => /Pure Minds Sans/.test(f) && !/italic/.test(f));
  const weights = faces.map((f) => Number(/font-weight:\s*(\d+)/.exec(f)[1])).sort((a, b) => a - b);
  assert.deepEqual(T.font.weights.map((w) => w.weight), [400, 700, 800]);
  assert.deepEqual(weights, [400, 700, 800], 'de @font-face-regels in global.css');
  for (const w of T.font.weights) assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'fonts', `PureMindsSans-${w.name}.ttf`)), `${w.name}.ttf`);
  assert.equal(T.font.stack, brand.FONT, 'zelfde fallback als PM.brand');
});

test('logo: verhouding uit de viewBox, clear space een kwart, minimum 80 px en 20 mm', () => {
  const svg = read('assets/brand/logo/PureMinds-zeshoek-logo-wit.svg');
  const [, , w, h] = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
  assert.equal(T.logo.aspect, w / h);
  assert.equal(T.logo.clearSpace, 0.25);
  assert.equal(T.logo.minDigitalPx, 80);
  assert.equal(T.logo.minPrintMm, 20);
  // Het logo in de voet van het brandbook is zelf groot genoeg voor print
  assert.ok((T.page.logoW / T.page.w) * T.page.mmW >= T.logo.minPrintMm);
  assert.deepEqual([T.ratio.neutral, T.ratio.cyaan, T.ratio.accent], [60, 30, 10]);
});

/* ---------------------------------------------------------------------------
   Teksten: missie, visie en waarden letterlijk uit v2.0, met de correcties
   ------------------------------------------------------------------------- */

test('missie, visie en kernwaarden staan er letterlijk in (opgeschoond)', () => {
  assert.equal(C.mission, 'Wij helpen ondernemers bij het vinden en benutten van on-aangetapt groeipotentieel.');
  assert.equal(C.vision, 'Wij zijn ervan overtuigd dat in de essentie van elke onderneming nog verborgen groeikansen liggen. Met de juiste ondersteuning kunnen deze kansen worden benut, wat leidt tot authentieke groei en duurzame welvaart op eigen kracht.');
  assert.deepEqual(C.values.map((v) => [v.name, v.text]), [
    ['Authentiek', 'Streven naar eerlijke, oprechte relaties met klanten en partners.'],
    ['Verbonden', 'Het belang van menselijke interactie benadrukken in een technologiegedreven wereld.'],
    ['Duurzaam', 'Waarde hechten aan een bestendig samenwerkingsverband met alle stakeholders, onder het oogmerk van maatschappelijk verantwoord ondernemen.'],
    ['Inventief', 'Opvolgen van de technologische vooruitgang om deze creatief te implementeren in de diensten voor onze klanten.'],
  ]);
  assert.equal(C.company, 'Pure Minds Marketing Group');
  assert.equal(C.slogan, 'Het performance marketing bureau voor bedrijven die vooruit willen.');   // gelijk aan de website
});

test('de correcties op v2.0 zijn doorgevoerd, en on-aangetapt blijft', () => {
  const all = JSON.stringify(C);
  assert.ok(!/technologiege-dreven/.test(all), 'technologiegedreven aan elkaar');
  assert.ok(!/ACHTEGROND/i.test(all), 'achtergrond goed gespeld');
  assert.ok(!/on aangetapt|onaangetapt/.test(all), 'on-aangetapt, zoals in de voorstellen');
  assert.ok(!/Google Fonts/.test(all), 'Pure Minds Sans staat niet op Google Fonts');
  assert.ok(!/ {2}/.test(all), 'geen dubbele spaties');
  assert.ok(!/Light|SemiBold|Medium/.test(C.type.notes.join(' ')), 'alleen Regular, Bold en ExtraBold bij de gewichten in gebruik');
  assert.match(C.logo.donts[0].title, /^Geen achtergrond achter het logo$/);
});

test('huisstijlregels: wel/niet-voorbeelden, contrasttabel en effen zeshoeken', () => {
  assert.equal(C.tone.examples.length, 3);
  assert.equal(C.tone.rules.length, 6);
  assert.equal(C.tone.scales.length, 4);
  C.tone.scales.forEach((s) => assert.ok(s.pos > 0 && s.pos < 1, s.left));
  assert.match(C.hexagon.rules.map((r) => r.text).join(' '), /Geen verloop en geen blauw \(#1B71A8\) als vlak/);
  assert.match(C.hexagon.rules.map((r) => r.text).join(' '), /Geen rand om een witte zeshoek/);
  assert.match(C.tone.rules.join(' '), /Knoppen en labels in kleine letters/);
  for (const [fg, bg] of C.colors.contrast) assert.ok(T.color(fg) && T.color(bg), `${fg} op ${bg}`);
});

/* ---------------------------------------------------------------------------
   Uitleg, rondleiding en rail bij de HTML
   ------------------------------------------------------------------------- */

function helpData() {
  const sandbox = { window: {} };
  vm.runInNewContext(read('js/styleguide/help.js'), sandbox);
  return sandbox.window.PM_HELP.styleguide;
}

test('uitleg en rondleiding (js/styleguide/help.js) passen bij de HTML', () => {
  const H = helpData();
  const html = read('tools/styleguide.html');
  const used = new Set(Array.from(html.matchAll(/data-help="([^"]+)"/g), (m) => m[1]));
  for (const key of used) assert.ok(H.help[key], `tekst voor data-help="${key}"`);
  for (const key of Object.keys(H.help)) assert.ok(used.has(key), `[?] voor "${key}" in de HTML`);
  const rail = Array.from(html.matchAll(/class="rail__item" data-section="([^"]+)"/g), (m) => m[1]);
  assert.deepEqual(Array.from(H.sections, (s) => s.id), rail, 'onderdelen = de rail');
  assert.deepEqual(C.chapters.map((c) => c.id), rail, 'hoofdstukken = de rail');
  const panels = Array.from(html.matchAll(/<section class="panel" data-section="([^"]+)"/g), (m) => m[1]);
  assert.deepEqual(panels, rail, 'een paneel per hoofdstuk, in dezelfde volgorde');
  H.sections.forEach((s, i) => assert.equal(s.label, C.chapters[i].label, `label ${s.id}`));
  for (const step of H.tour) {
    if (step.target) assert.match(html, new RegExp(`data-tour="${step.target}"`), `data-tour="${step.target}"`);
    if (step.section) assert.ok(H.sections.some((s) => s.id === step.section), `onderdeel ${step.section}`);
  }
  for (const [key, h] of Object.entries(H.help)) assert.ok(words(h.text) <= 40, `uitleg "${key}" is ${words(h.text)} woorden`);
  for (const step of H.tour) {
    assert.ok(words(step.text) <= 35, `stap "${step.id}" is ${words(step.text)} woorden`);
    assert.ok(words(step.title) <= 5, `titel van stap "${step.id}"`);
  }
  for (const s of H.sections) assert.ok(s.label.length <= 12, `label ${s.label}`);
});

test('de iconen van de rail zijn de Remix-iconen uit help.js', () => {
  const H = helpData();
  const html = read('tools/styleguide.html');
  const files = {};
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.isDirectory() && !['Zeshoek', 'Los'].includes(f.name)) walk(path.join(dir, f.name));
      else if (f.name.endsWith('.svg')) files[f.name.replace(/\.svg$/, '')] = path.join(dir, f.name);
    }
  })(path.join(__dirname, '..', 'assets', 'icons'));
  for (const s of H.sections) {
    assert.ok(files[s.icon], `assets/icons: ${s.icon}`);
    const d = /\sd="([^"]+)"/.exec(fs.readFileSync(files[s.icon], 'utf8'))[1];
    const button = new RegExp(`data-section="${s.id}"><svg[^>]*><path d="([^"]+)"`).exec(html);
    assert.ok(button, `rail-knop ${s.id}`);
    assert.equal(button[1], d, `icoon van ${s.id}`);
  }
});

test('de iconen op de pagina’s zijn gelijk aan assets/icons', () => {
  for (const [name, icon] of Object.entries(C.iconPaths)) {
    const svg = read(`assets/icons/${icon.file}`);
    assert.equal(/\sd="([^"]+)"/.exec(svg)[1], icon.d, name);
  }
  for (const n of C.icons.sample) assert.ok(C.iconPaths[n], `voorbeeldicoon ${n}`);
  assert.ok(C.iconPaths[C.icons.knockout.icon], 'het icoon van wel en niet');
});

test('uitgesneden in de witte zeshoek alleen vol, met kort waarom', () => {
  // De regel, en de drie redenen: optische uitloop, rust, herkenbaarheid (kort)
  assert.ok(C.icons.rules.some((r) => /^Uitgesneden in een witte zeshoek: alleen de volle stijl .*nooit de lijnstijl/.test(r)));
  assert.match(C.icons.intro, /alleen de volle stijl/);
  assert.deepEqual(C.icons.why.items.map((it) => it.title), ['Optische uitloop', 'Rust', 'Herkenbaarheid']);
  for (const it of C.icons.why.items) assert.ok(it.text.split(/\s+/).length <= 8, `${it.title}: kort houden`);
  // Wel is vol, niet is lijn
  assert.match(C.icons.knockout.wel, /^Volle stijl \(Fill\)/);
  assert.match(C.icons.knockout.niet, /^Lijnstijl \(Line\)/);
  // Ook in het paneel en in de uitleg achter de [?]
  const html = read('tools/styleguide.html');
  assert.match(html, /id="iconWhy"/);
  assert.match(html, /Uitgesneden in een witte zeshoek \(cutout\) gebruik je alleen de volle stijl/);
  assert.match(helpData().help.icoonvarianten.text, /alleen in de volle stijl \(Fill\)/);
});

test('de volle stijl (Fill) op de pagina’s is gelijk aan assets/icons/Vol', () => {
  for (const [name, icon] of Object.entries(C.iconPaths)) {
    assert.match(icon.fillFile, /^Vol\/[^/]+\/[\w-]+-fill\.svg$/, name);
    assert.equal(icon.fillFile.replace(/^Vol\//, '').replace(/-fill\.svg$/, ''), icon.file.replace(/-line\.svg$/, ''), `${name}: hetzelfde icoon`);
    const svg = read(`assets/icons/${icon.fillFile}`);
    assert.equal(/\sd="([^"]+)"/.exec(svg)[1], icon.fill, name);
  }
});

test('uitgesneden in de witte zeshoek: de pagina’s tekenen hetzelfde als de map van de Icon Finder', () => {
  const Hex = require('../js/icons/hex.js');
  for (const [name, icon] of Object.entries(C.iconPaths)) {
    const [, cat, file] = /^Vol\/(.+)\/([^/]+)$/.exec(icon.fillFile);
    const want = read(`assets/icons/Zeshoek/Witte zeshoek - doorzichtig icoon/${cat}/${file}`).replace(/\r\n/g, '\n');
    assert.equal(`${Hex.svg(icon.fill, { shape: 'hex', ...Hex.presets.wit })}\n`, want, name);
  }
});

/* ---------------------------------------------------------------------------
   De pagina's
   ------------------------------------------------------------------------- */

test('pagina’s: elk hoofdstuk heeft er minstens één, in de volgorde van de rail', () => {
  const ids = C.pages.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'unieke id’s');
  assert.ok(C.pages.length >= 12 && C.pages.length <= 18, `${C.pages.length} pagina's`);
  assert.equal(C.pages.length, 18);
  assert.deepEqual(ids.slice(-3), ['toepassingen', 'documenten', 'colofon'], 'documenten tussen toepassingen en het colofon');
  const order = C.chapters.map((c) => c.id);
  let last = 0;
  for (const p of C.pages) {
    const at = order.indexOf(p.chapter);
    assert.ok(at >= last, `${p.id} staat in de volgorde van de hoofdstukken`);
    last = at;
  }
  for (const c of C.chapters) assert.ok(C.pages.some((p) => p.chapter === c.id), `hoofdstuk ${c.id}`);
  assert.equal(C.pages[0].id, 'cover');
  assert.equal(C.pages[C.pages.length - 1].id, 'colofon');
});

test('pages.js tekent elke pagina uit content.js, met alleen tekenwerk dat de PDF kent', () => {
  const js = read('js/styleguide/pages.js');
  const block = js.slice(js.indexOf('const DRAW = {'), js.indexOf('};', js.indexOf('const DRAW = {')));
  const keys = Array.from(block.matchAll(/^\s*'?([\w-]+)'?: \{ fn:/gm), (m) => m[1]);
  assert.deepEqual(keys, C.pages.map((p) => p.id));
  // Geen transformaties, uitknippaden, verlopen of stippellijnen in de pagina's (wel in de clear-space-laag)
  // Zonder commentaar: de kop van pages.js noemt juist wat er niet in mag
  const pageCode = js.slice(0, js.indexOf('function overlay(')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const op of ['translate(', 'rotate(', '.scale(', '.clip(', 'createLinearGradient', 'createRadialGradient', 'setLineDash', 'ellipse(', 'roundRect(', 'globalAlpha', 'strokeText']) {
    assert.ok(!pageCode.includes(op), `geen ${op} in de pagina's`);
  }
  // Beelden alleen via raster(): een foto of een echt ontwerp, het verloop zit erin gebakken
  assert.equal((pageCode.match(/drawImage\(/g) || []).length, 1, 'drawImage alleen in raster()');
  assert.ok(pageCode.includes("if (img) layer(ctx, 'Beeld', () => ctx.drawImage(img, x, y, w, h));"), 'raster() tekent in de laag Beeld');
  // Geen blauw (#1B71A8) als vlak van een zeshoek: blauw alleen bij de kleurstalen (via de tokens)
  assert.ok(!/#1B71A8/i.test(pageCode), 'blauw staat niet los in pages.js');
});

/* ---------------------------------------------------------------------------
   Rekenwerk (model.js)
   ------------------------------------------------------------------------- */

test('contrast: de tabel op de pagina 60/30/10 en contrast', () => {
  const expected = {
    'Wit op Inkt': '13,2 : 1', 'Pure Cyaan op Inkt': '5,7 : 1', 'Inkt op Pure Cyaan': '5,7 : 1', 'Wit op Pure Magenta': '6,4 : 1',
    'Wit op Blauw': '5,3 : 1', 'Wit op Pure Cyaan': '2,3 : 1', 'Pure Cyaan op wit': '2,3 : 1', 'Wit op Oranje': '2,5 : 1',
  };
  for (const [fg, bg, name] of C.colors.contrast) {
    const n = M.contrast(T.color(fg).hex, T.color(bg).hex);
    assert.equal(M.ratioText(n), expected[name], name);
  }
  assert.deepEqual(M.verdict(M.contrast('#FFFFFF', '#1AB9E2')), { text: false, large: false });
  assert.deepEqual(M.verdict(M.contrast('#FFFFFF', '#B61B50')), { text: true, large: true });
  assert.equal(M.contrast('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(M.readable('#1AB9E2'), '#303030', 'een cyaan knop krijgt tekst in Inkt');
  assert.equal(M.readable('#B61B50'), '#FFFFFF');
});

test('kopiëren: HEX in hoofdletters, RGB en CMYK als getallen', () => {
  const c = T.color('cyaan');
  assert.equal(M.copyValue(c, 'hex'), '#1AB9E2');
  assert.equal(M.copyValue(c, 'rgb'), '26, 185, 226');
  assert.equal(M.copyValue(c, 'cmyk'), '88, 18, 0, 11');
});

test('de maat van een stijl, en hoe je hem in Canva invult', () => {
  const [h1, , , body, , labelStyle] = T.type;
  assert.equal(M.typeSpec(h1).text, 'ExtraBold 800 · 52/58 · −2%');
  assert.deepEqual(M.typeSpec(h1, T), { weight: 'ExtraBold 800', size: '52/58', track: '−2%', text: 'ExtraBold 800 · 52/58 · −2%' });
  assert.equal(M.typeSpec(body).text, 'Regular 400 · 18/31', 'zonder letterafstand geen derde deel');
  assert.equal(M.typeSpec(labelStyle).track, '+10%');
  // Canva: regelafstand als factor (58 / 52), letterafstand in duizendsten (−0,02 = −20)
  assert.deepEqual([M.canvaSpec(h1).lineHeight, M.canvaSpec(h1).letterSpacing], ['1,1', '−20']);
  assert.equal(M.canvaSpec(h1).text, 'Canva: grootte 52 · regelafstand 1,1 · letterafstand −20');
  assert.deepEqual([M.canvaSpec(body).lineHeight, M.canvaSpec(body).letterSpacing], ['1,7', '']);
  assert.equal(M.canvaSpec(body).text, 'Canva: grootte 18 · regelafstand 1,7');
  assert.equal(M.canvaSpec(labelStyle).letterSpacing, '+100');
  // De uitleg legt precies de delen van het voorbeeld uit, in dezelfde volgorde
  const spec = M.typeSpec(T.type[0]).text;
  let at = -1;
  for (const p of C.type.legend.parts) {
    const i = spec.indexOf(p.key);
    assert.ok(i > at, `"${p.key}" staat in "${spec}"`);
    at = i;
  }
  // De fotografen voor het colofon
  assert.equal(M.photoCredits(C.photos), 'Anastasiia Nelen, Andreea Avramescu, Campaign Creators, Andrew Neel, Ali Mkumbwa en Waldemar Brandt');
  assert.equal(M.photoCredits([{ by: 'A' }, { by: 'B' }, { by: 'A' }]), 'A en B', 'elke naam één keer');
  assert.equal(M.photoCredits([{ by: 'A' }]), 'A');
  assert.equal(M.photoLine(C), 'Foto’s: Anastasiia Nelen, Andreea Avramescu, Campaign Creators, Andrew Neel, Ali Mkumbwa en Waldemar Brandt, via Unsplash (Unsplash-licentie).');
});

test('zoeken: de juiste pagina eerst, korte woorden alleen als heel woord', () => {
  const index = M.searchIndex(C, T);
  const first = (q) => (M.search(index, q)[0] || {}).id;
  assert.equal(first('magenta'), 'kleuren');
  assert.equal(first('clear space'), 'clear-space');
  assert.equal(first('je of u'), 'tone-of-voice');
  assert.equal(first('#1ab9e2'), 'kleuren');
  assert.equal(first('emoji'), 'schrijven');
  assert.equal(first('Emerce'), 'documenten');
  assert.equal(first('Insta Post Maker'), 'toepassingen');
  assert.equal(first('telefoon'), 'colofon');
  assert.equal(first('regelafstand'), 'typografie');
  assert.equal(first('WCAG'), 'kleur-toepassen');
  assert.equal(first('volle stijl'), 'iconen');
  assert.equal(first('lettertype'), 'typografie');
  assert.equal(first('60/30/10'), 'kleur-toepassen');
  assert.deepEqual(M.search(index, 'x'), [], 'te kort');
  assert.deepEqual(M.search(index, 'qqqzzz'), []);
  assert.ok(!M.search(index, 'u').length, '"u" alleen is te kort');
  const hit = M.search(index, 'je of u')[0];
  assert.match(hit.snippet, /je\/jij/, 'fragment met de treffer');
  // Elke pagina heeft tekst om te doorzoeken
  for (const p of index) assert.ok(p.texts.length > 0, p.id);
});

test('ASE: Adobe Swatch Exchange 1.0 met twee mappen (RGB en CMYK)', () => {
  const bytes = M.aseBytes(M.aseGroups(T));
  const dv = new DataView(bytes.buffer);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'ASEF');
  assert.equal(dv.getUint16(4), 1);
  assert.equal(dv.getUint16(6), 0);
  const n = T.allColors().length;
  assert.equal(dv.getUint32(8), 2 * (n + 2), 'per map een begin, de kleuren en een eind');
  // Eerste blok: begin van een map
  assert.equal(dv.getUint16(12), 0xc001);
  // Alle blokken lopen precies tot het einde van het bestand
  let at = 12;
  const seen = [];
  while (at < bytes.length) {
    const type = dv.getUint16(at);
    const len = dv.getUint32(at + 2);
    if (type === 0x0001) {
      const nameLen = dv.getUint16(at + 6);
      const name = Array.from({ length: nameLen - 1 }, (_, i) => String.fromCharCode(dv.getUint16(at + 8 + i * 2))).join('');
      const model = String.fromCharCode(...bytes.slice(at + 8 + nameLen * 2, at + 12 + nameLen * 2));
      const v = dv.getFloat32(at + 12 + nameLen * 2);
      seen.push([name, model, v]);
    }
    at += 6 + len;
  }
  assert.equal(at, bytes.length);
  assert.equal(seen.length, 2 * n);
  assert.deepEqual(seen[0].slice(0, 2), ['Pure Cyaan', 'RGB ']);
  assert.ok(Math.abs(seen[0][2] - 26 / 255) < 1e-6);
  assert.equal(seen[n][1], 'CMYK');
  assert.ok(Math.abs(seen[n][2] - 0.88) < 1e-6);
});

test('JSON: kleuren met rol en CSS-variabele, de verhouding en het lettertype', () => {
  const j = M.colorJson(T, C);
  assert.equal(j.colors.length, T.allColors().length);
  const cyaan = j.colors.find((c) => c.id === 'cyaan');
  assert.deepEqual(cyaan, { id: 'cyaan', name: 'Pure Cyaan', group: 'primair', hex: '#1AB9E2', rgb: [26, 185, 226], cmyk: [88, 18, 0, 11], role: 'Accenten, vlakken, lijnen en markeringen', cssVar: '--pm-cyan' });
  assert.equal(j.ratio['pure cyaan'], 30);
  assert.deepEqual(j.font.weights, [400, 700, 800]);
  assert.ok(!('version' in j), 'tijdloos: geen versienummer');
  JSON.parse(JSON.stringify(j));
});

test('PDF-delen: onder de limiet één deel, anders hele hoofdstukken', () => {
  assert.deepEqual(M.splitParts([10, 20, 30], ['a', 'a', 'b'], 100), [[0, 1, 2]]);
  assert.deepEqual(M.splitParts([300, 300, 500, 400, 200], ['a', 'a', 'b', 'c', 'c'], 1000), [[0, 1], [2], [3, 4]]);
  assert.deepEqual(M.splitParts([700, 600], ['a', 'a'], 1000), [[0, 1]], 'een hoofdstuk wordt nooit gesplitst');
  assert.equal(M.fileName(null), 'brandbook-pure-minds-marketing-group.pdf');
  assert.equal(M.fileName('logo'), 'brandbook-logo.pdf');
  assert.equal(M.fileName(null, 2), 'brandbook-pure-minds-marketing-group-deel-2.pdf');
});

/* ---------------------------------------------------------------------------
   SVG-paden (logo, badge, iconen)
   ------------------------------------------------------------------------- */

test('het logo wordt paden met alleen M, L, C en Z, in één kleur', () => {
  const svg = P.parseSvg(read('assets/brand/logo/PureMinds-zeshoek-logo-wit.svg'));
  assert.deepEqual(svg.viewBox, [0, 0, 2229.16, 2568.97]);
  assert.equal(svg.shapes.length, 26, '22 paden, 2 rechthoeken en 2 veelhoeken');
  assert.deepEqual([...new Set(svg.shapes.map((s) => s.fill))], ['#ffffff']);
  for (const s of svg.shapes) for (const sub of s.subs) for (const seg of sub.segs) assert.ok(['M', 'L', 'C'].includes(seg[0]));
  // Het buitenste punt van de zeshoek: absoluut, ook na relatieve commando's
  const xs = svg.shapes.flatMap((s) => s.subs.flatMap((sub) => sub.segs.map((g) => g[g.length - 2])));
  assert.ok(Math.abs(Math.max(...xs) - 2229.16) < 0.01 && Math.min(...xs) >= 0);
  // Zwart en wit zijn hetzelfde logo
  const black = P.parseSvg(read('assets/brand/logo/PureMinds-zeshoek-logo-zwart.svg'));
  assert.deepEqual(black.shapes.map((s) => s.subs), svg.shapes.map((s) => s.subs));
});

test('padcommando’s: relatief, H/V, S, Q, bogen en impliciete herhaling', () => {
  assert.deepEqual(P.parsePath('M10 10l5 5h5v-5z')[0], { segs: [['M', 10, 10], ['L', 15, 15], ['L', 20, 15], ['L', 20, 10]], closed: true });
  assert.deepEqual(P.parsePath('M0 0 10 0 10 10')[0].segs, [['M', 0, 0], ['L', 10, 0], ['L', 10, 10]], 'extra punten na M zijn lijnen');
  const s = P.parsePath('M0 0C0 10 10 10 10 0S20 -10 20 0')[0].segs;
  assert.deepEqual(s[2].slice(1, 3), [10, -10], 'S spiegelt het vorige controlepunt');
  const q = P.parsePath('M0 0Q10 10 20 0')[0].segs[1];
  assert.deepEqual(q.map((v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)), ['C', 6.667, 6.667, 13.333, 6.667, 20, 0]);
  // Halve cirkel met boog-vlaggen zonder spaties: eindigt precies op het eindpunt
  const a = P.parsePath('M10 10a5 5 0 1010 0')[0].segs;
  assert.deepEqual(a[a.length - 1].slice(5), [20, 10]);
  const mid = a[1].slice(5);
  assert.ok(Math.abs(mid[0] - 15) < 1e-9 && Math.abs(mid[1] - 15) < 1e-9, 'sweep 0: via onder');
  assert.throws(() => P.parseSvg('<svg viewBox="0 0 10 10"><g transform="scale(2)"><path d="M0 0h1v1z"/></g></svg>'), /transform/);
});

test('de zeshoek van de Icon Finder: afgeronde hoeken als bogen, de uitgesneden variant evenodd', () => {
  const Hex = require('../js/icons/hex.js');
  const d = C.iconPaths.lightbulb.d;
  const knock = P.parseSvg(Hex.svg(d, { shape: 'hex', ...Hex.presets.wit }));
  assert.equal(knock.shapes.length, 1);
  assert.equal(knock.shapes[0].rule, 'evenodd');
  const cyaan = P.parseSvg(Hex.svg(d, { shape: 'hex', ...Hex.presets.cyaan }));
  assert.deepEqual(cyaan.shapes.map((s) => s.fill), ['#1ab9e2', '#ffffff']);
  // De afgeronde zeshoek: zes rechte stukken en zes bogen
  assert.equal(cyaan.shapes[0].subs[0].segs.filter((g) => g[0] === 'C').length, 6);
});

test('de Emerce-badge wordt ook paden; toSvg geeft een nette SVG in één kleur', () => {
  const svg = P.parseSvg(read('assets/brand/emerce/e100-2026-liggend-wit.svg'));
  assert.ok(svg.shapes.length > 30);
  const out = P.toSvg(svg, '#303030');
  assert.match(out, /^<\?xml/);
  assert.ok(!/fill="#ffffff"/.test(out));
  assert.equal(P.parseSvg(out).shapes.length, 1, 'alles van één kleur is één pad');
});

/* ---------------------------------------------------------------------------
   Export: lagen in PMPdfCanvas, pdf-lib in core.js, dezelfde snedes als de andere makers
   ------------------------------------------------------------------------- */

test('PMPdfCanvas: lagen als gemarkeerde inhoud, en alleen als je erom vraagt', async () => {
  const core = read('js/shared/core.js');
  const fromCore = (name) => new Function(`${new RegExp(`function ${name}\\([\\s\\S]*?\\n {2}\\}\\r?\\n`).exec(core)[0]}\nreturn ${name};`)();
  globalThis.PM = { pdfFontStyle: fromCore('pdfFontStyle'), pdfColor: fromCore('pdfColor'), fileProtocolError: () => new Error('x') };
  const { PMPdfCanvas } = require('../js/shared/pdf-canvas.js');
  const fake = () => {
    const calls = [];
    const pdf = { calls };
    for (const n of ['moveTo', 'lineTo', 'curveTo', 'close', 'fill', 'fillEvenOdd', 'stroke', 'setFillColor', 'setDrawColor', 'setLineWidth', 'setLineCap', 'setLineJoin', 'setLineMiterLimit', 'setFont', 'setFontSize', 'setCharSpace', 'setTextColor', 'text']) pdf[n] = (...a) => calls.push([n, ...a]);
    pdf.internal = { getFont: () => ({ metadata: { characterToGlyph: () => 1 } }), write: (s) => calls.push(['write', s]) };
    return pdf;
  };
  const measure = { font: '', letterSpacing: '0px', measureText: (t) => ({ width: t.length * 10 }) };

  // Zonder lagen: geen enkele write (de andere makers blijven gelijk)
  let pdf = fake();
  let ctx = new PMPdfCanvas(pdf, { width: 100, height: 100, pageWidth: 100, measure });
  ctx.fillStyle = '#1ab9e2';
  ctx.fillRect(0, 0, 10, 10);
  await ctx.flush();
  assert.ok(!pdf.calls.some((c) => c[0] === 'write'));

  // Met lagen: BDC/EMC om elk blok, een nieuwe laag sluit de vorige, open aan het eind wordt dicht.
  // De snede volgt PM.pdfFontStyle, zoals in de andere makers (geen eigen keuze van de styleguide)
  pdf = fake();
  ctx = new PMPdfCanvas(pdf, { width: 100, height: 100, pageWidth: 100, measure });
  ctx.beginLayer('Achtergrond');
  ctx.fillRect(0, 0, 100, 100);
  ctx.endLayer();
  ctx.beginLayer('Vormen');
  ctx.fillRect(0, 0, 10, 10);
  ctx.beginLayer('Tekst');
  ctx.font = '400 20px x';
  ctx.fillText('Regular', 10, 50);
  await ctx.flush();
  const seq = pdf.calls.filter((c) => ['write', 'fill', 'text', 'setFont'].includes(c[0])).map((c) => (c[0] === 'write' ? c[1] : c[0] === 'setFont' ? `font:${c[2]}` : c[0]));
  assert.deepEqual(seq, ['/OC /Achtergrond BDC', 'fill', 'EMC', '/OC /Vormen BDC', 'fill', 'EMC', '/OC /Tekst BDC', 'font:normal', 'text', 'EMC']);
  ctx.endLayer();   // niets open: geen losse EMC
  await ctx.flush();
  assert.equal(pdf.calls.filter((c) => c[1] === 'EMC').length, 3);
});

/* ---------------------------------------------------------------------------
   De PDF zonder browser: elke pagina door PMPdfCanvas met een nep-jsPDF.
   Alleen PureMindsSans-*, geen uitknippaden of verlopen (die worden in
   PMPdfCanvas een afbeelding), alleen huiskleuren en de vaste neutralen, alles
   in een laag, en onder de 1.400 elementen van Canva. Zonder env.raster (de
   foto's en echte posts en slides, alleen in de browser) staat er het lege
   fotovlak; met een nep-raster wordt elk beeld één afbeelding in de laag Beeld.
   Meten gebeurt hier met een vaste tekenbreedte: de regelval wijkt iets af van
   de browser, de telling dus ook (in de browser: zo'n 1.150).
   ------------------------------------------------------------------------- */

function pagesInNode() {
  const sandbox = { console };
  sandbox.window = sandbox;
  Object.assign(sandbox, { PM_BRAND_TOKENS: T, PM_BRAND_CONTENT: C, PMStyleguideModel: M, PMSvgPath: P, PMHex: require('../js/icons/hex.js') });
  vm.createContext(sandbox);
  vm.runInContext(read('js/shared/canvas-kit.js'), sandbox);
  vm.runInContext(read('js/styleguide/pages.js'), sandbox);
  return sandbox.PMStyleguide;
}

async function pdfInNode(extra = {}) {
  const core = read('js/shared/core.js');
  const fromCore = (name) => new Function(`${new RegExp(`function ${name}\\([\\s\\S]*?\\n {2}\\}\\r?\\n`).exec(core)[0]}\nreturn ${name};`)();
  globalThis.PM = { pdfFontStyle: fromCore('pdfFontStyle'), pdfColor: fromCore('pdfColor'), fileProtocolError: () => new Error('x') };
  const { PMPdfCanvas } = require('../js/shared/pdf-canvas.js');
  const S = pagesInNode();
  const env = {
    logo: P.parseSvg(read('assets/brand/logo/PureMinds-zeshoek-logo-wit.svg')),
    badgeWhite: P.parseSvg(read('assets/brand/emerce/e100-2026-liggend-wit.svg')),
    badgeBlack: P.parseSvg(read('assets/brand/emerce/e100-2026-liggend-zwart.svg')),
    ...extra,
  };
  const measure = {
    font: '10px sans-serif',
    letterSpacing: '0px',
    measureText(t) {
      const size = Number((/([\d.]+)px/.exec(this.font) || [0, 10])[1]);
      return { width: Array.from(String(t)).length * (size * 0.55 + (parseFloat(this.letterSpacing) || 0)) };
    },
  };
  const pages = [];
  for (let i = 0; i < S.pages.length; i++) {
    const calls = [];
    const pdf = { calls };
    for (const n of ['moveTo', 'lineTo', 'curveTo', 'close', 'fill', 'fillEvenOdd', 'stroke', 'setFillColor', 'setDrawColor', 'setLineWidth', 'setLineCap', 'setLineJoin', 'setLineMiterLimit', 'setFont', 'setFontSize', 'setCharSpace', 'setTextColor', 'text', 'addImage', 'saveGraphicsState', 'restoreGraphicsState', 'setGState']) {
      pdf[n] = (...a) => calls.push([n, ...a]);
    }
    pdf.internal = { getFont: () => ({ metadata: { characterToGlyph: () => 1 } }), write: (s) => calls.push(['write', s]) };
    const ctx = new PMPdfCanvas(pdf, { width: S.W, height: S.H, pageWidth: 841.89, measure });
    // Zonder DOM: een afbeelding alleen vastleggen (in de browser wordt het een JPEG)
    ctx.writeImage = (item) => {
      calls.push(['addImage', item.img.id, item.dest]);
      ctx.stats.image++;
    };
    S.draw(ctx, i, env);
    pages.push({ id: S.pages[i].id, stats: await ctx.flush(), calls });
  }
  return { S, env, pages, limit: PMPdfCanvas.CANVA_LIMIT };
}

test('de PDF: alleen Pure Minds Sans, vectoren in huiskleuren, alles in een laag, onder de 1.400 elementen', async () => {
  const { S, env, pages, limit } = await pdfInNode();
  assert.equal(pages.length, C.pages.length);
  // Snedes: elke stijl is een bestand PureMindsSans-*.ttf (in de PDF de PostScript-naam)
  const files = Object.fromEntries(Array.from(read('scripts/build-brand-data.js').matchAll(/^ {2}(\w+): '(PureMindsSans-[\w]+)\.ttf',$/gm), (m) => [m[1], m[2]]));
  const used = new Set();
  // Kleuren: de huiskleuren, de neutralen van pages.js en de kleuren van de officiële badges
  const hexOf = (rgb) => `#${rgb.map((v) => Math.floor(Number(v) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  const allowed = new Set([...T.allColors().map((c) => c.hex), ...S.NEUTRALS, ...[env.badgeWhite, env.badgeBlack].flatMap((b) => b.shapes.map((s) => s.fill))].map((c) => c.toUpperCase()));
  const seen = new Set();
  let total = 0;
  for (const p of pages) {
    const { text, vector, raster, image, svg } = p.stats;
    assert.equal(raster + image + svg, 0, `${p.id}: zonder beelden geen afbeeldingen (ook geen verloop of uitsnede)`);
    total += text + vector;
    let open = null;
    for (const [op, ...a] of p.calls) {
      if (op === 'write') {
        const m = /^\/OC \/(\w+) BDC$/.exec(a[0]);
        if (m) {
          assert.equal(open, null, `${p.id}: lagen niet genest`);
          assert.ok(S.LAYERS.includes(m[1]), `${p.id}: laag ${m[1]}`);
          open = m[1];
        } else {
          assert.equal(a[0], 'EMC');
          assert.notEqual(open, null, `${p.id}: EMC zonder laag`);
          open = null;
        }
      }
      if (['fill', 'fillEvenOdd', 'stroke', 'text'].includes(op)) assert.ok(open, `${p.id}: ${op} buiten een laag`);
      if (op === 'setFont') {
        assert.equal(a[0], 'PureMindsSans');
        assert.ok(files[a[1]], `${p.id}: snede ${a[1]}`);
        used.add(files[a[1]]);
      }
      if (['setFillColor', 'setDrawColor', 'setTextColor'].includes(op)) {
        // Vier decimalen: afkappen en afronden geven allebei de oorspronkelijke waarde (exact, ook in Canva)
        const rounded = `#${a.map((v) => Math.round(Number(v) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
        assert.equal(hexOf(a), rounded, `${p.id}: kleur ${a.join(' ')} exact`);
        assert.ok(allowed.has(rounded), `${p.id}: kleur ${rounded} hoort niet bij de huisstijl`);
        seen.add(rounded);
      }
    }
    assert.equal(open, null, `${p.id}: laatste laag dicht`);
  }
  assert.ok([...used].every((f) => f.startsWith('PureMindsSans-')));
  for (const n of ['Regular', 'Bold', 'ExtraBold']) assert.ok(used.has(`PureMindsSans-${n}`), [...used].join());
  for (const n of ['Light', 'SemiBold', 'Medium']) assert.ok(![...used].some((f) => f.startsWith(`PureMindsSans-${n}`)), `geen ${n}: ${[...used].join()}`);
  for (const c of T.colors.primary) assert.ok(seen.has(c.hex), `${c.name} staat in de PDF`);
  assert.ok(total < limit, `${total} elementen (Canva: ${limit})`);
  assert.ok(total > 800, `${total} elementen: de pagina's zijn getekend`);
});

test('de PDF: de teksten uit content.js staan er als echte tekst in', async () => {
  const { pages } = await pdfInNode();
  // \s telt ook de vaste spatie mee (€ 1.500,- blijft in de PDF op één regel)
  const norm = (t) => String(t).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  // Stukken op dezelfde basislijn horen bij elkaar (PMPdfCanvas zet de spatie er zelf in), een nieuwe regel krijgt een spatie
  const all = norm(pages.map((p) => p.calls.filter((c) => c[0] === 'text')
    .map((c, i, list) => (i && list[i - 1][3] === c[3] ? '' : ' ') + c[1]).join('')).join(' '));
  const want = [
    C.company, C.slogan, C.mission, C.vision, C.tone.intro, C.colors.intro, C.colors.secondaryRule, C.colors.ratio, C.colors.contrastNote,
    C.logo.intro, C.logo.clearSpace, C.hexagon.intro, C.type.intro, C.imagery.intro, C.icons.intro, C.usage.intro, C.usage.badge.intro,
    ...C.values.flatMap((v) => [v.name, v.text, v.sound]), ...C.tone.rules, ...C.tone.examples.flatMap((e) => [e.wel, e.niet]),
    ...C.tone.scales.flatMap((s) => [s.where, s.practice]), ...C.logo.donts.flatMap((d) => [d.title, d.text]), ...C.logo.added.map((a) => a.text),
    ...C.logo.minimum.map((m) => m.why), ...C.hexagon.rules.map((r) => r.text), ...C.hexagon.uses.map((u) => u.text), ...C.type.notes,
    ...C.imagery.sections.flatMap((s) => s.items), ...C.icons.rules, ...C.usage.makers.map((m) => m.text), ...C.usage.badge.rules,
    C.colophon.signoff, C.colophon.about, C.colophon.sources, C.colophon.rights, M.photoLine(C), ...Object.values(C.contact),
    ...C.colors.why.map((w) => w.text), ...C.type.legend.parts.map((x) => x.text), C.icons.knockout.wel, C.icons.knockout.niet,
    C.imagery.photoNote, C.usage.letter.title, C.usage.letter.salutation,
    ...T.allColors().filter((c) => !['wit', 'grijs'].includes(c.id)).map((c) => c.hex),
  ];
  const missing = want.map(norm).filter((s) => !all.includes(s));
  assert.deepEqual(missing, []);
  // De maat van Heading 1 staat op de pagina als dezelfde tekst als in de uitleg
  assert.ok(all.includes(M.typeSpec(T.type[0]).text), 'de maat uit model.js typeSpec');
});

test('beelden: foto’s en echte ontwerpen alleen op hun eigen pagina’s, elk één afbeelding in de laag Beeld', async () => {
  const asked = [];
  const raster = (id, w, h) => {
    asked.push(id);
    return { id, width: Math.round(2 * w), height: Math.round(2 * h) };
  };
  const { pages, limit } = await pdfInNode({ raster });
  const want = {
    'logo-gebruik': ['logo-kader'],
    zeshoek: ['zeshoek-foto'],
    beeldtaal: ['beeld-compositie', 'beeld-tekst', 'beeld-cijfer'],
    toepassingen: ['post-photo', 'post-overlay', 'post-blog', 'post-case', 'post-carousel', 'slide-title', 'slide-split'],
  };
  let total = 0;
  for (const p of pages) {
    const { text, vector, raster: r, image, svg } = p.stats;
    total += text + vector + r + image + svg;
    assert.equal(r + svg, 0, `${p.id}: geen verloop of uitsnede als afbeelding`);
    let open = null;
    const ids = [];
    for (const [op, ...a] of p.calls) {
      if (op === 'write') {
        const m = /^\/OC \/(\w+) BDC$/.exec(a[0]);
        open = m ? m[1] : null;
      }
      if (op === 'addImage') {
        assert.equal(open, 'Beeld', `${p.id}: ${a[0]} in de laag Beeld`);
        const d = a[1];
        assert.ok(d.x >= 0 && d.y >= 0 && d.x + d.w <= 1684 && d.y + d.h <= 1191, `${p.id}: ${a[0]} binnen de pagina`);
        ids.push(a[0]);
      }
    }
    assert.deepEqual(ids, want[p.id] || [], `${p.id}: beelden`);
    assert.equal(image, ids.length, `${p.id}: elk beeld één afbeelding`);
  }
  assert.deepEqual(asked, Object.values(want).flat(), 'pages.js vraagt precies deze beelden, in deze volgorde');
  assert.ok(total < limit, `${total} elementen met beelden (Canva: ${limit})`);
});

test('tijdloos: geen versie, datum of "vervangt" in het brandbook', async () => {
  assert.ok(!('version' in T), 'geen versie in de tokens');
  assert.ok(!('version' in C) && !('date' in C), 'geen versie of datum in content.js');
  const all = JSON.stringify({ ...C, iconPaths: 0, photos: 0 });
  assert.ok(!/\b2\.[01]\b|oktober|Vervangt|Versie|Nieuw in/.test(all), 'geen versienummers of datum in de teksten');
  assert.ok(!/Brandbook \d/.test(read('tools/styleguide.html')), 'appbalk zonder versie');
  assert.ok(!/\bversi(e|on)\b|\.version\b|C\.date\b/i.test(read('js/styleguide/export.js')), 'export: geen versie in de metadata of het LEESMIJ');
  const { pages } = await pdfInNode();
  const words = pages.flatMap((p) => p.calls.filter((c) => c[0] === 'text').map((c) => c[1])).join(' ');
  assert.ok(!/Brandbook \d|Versie|oktober|Vervangt/.test(words), 'geen versie in de PDF');
});

test('foto’s: JPEG-bestanden in assets/styleguide/photos, en photo-data.js is bijgewerkt', () => {
  const ids = C.photos.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'unieke id’s');
  for (const p of C.photos) {
    assert.match(p.file, /^assets\/styleguide\/photos\/[a-z-]+\.jpg$/, p.id);
    const bytes = fs.readFileSync(path.join(__dirname, '..', p.file));
    assert.ok(bytes[0] === 0xff && bytes[1] === 0xd8, `${p.file} is een JPEG`);
    assert.ok(bytes.length < 300 * 1024, `${p.file}: ${Math.round(bytes.length / 1024)} KB`);
    assert.ok(p.by && /^https:\/\/unsplash\.com\/photos\/[\w-]+$/.test(p.url), `${p.id}: fotograaf en bron`);
  }
  // De kopie voor file:// (npm run photos): dezelfde foto's, byte voor byte
  const sandbox = { window: {} };
  vm.runInNewContext(read('js/styleguide/photo-data.js'), sandbox);
  const data = sandbox.window.PM_STYLEGUIDE_PHOTOS;
  assert.deepEqual(Object.keys(data), ids);
  for (const p of C.photos) {
    assert.ok(data[p.id] === `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, '..', p.file)).toString('base64')}`, `${p.id}: bijgewerkt (npm run photos)`);
  }
  // Elke foto wordt gebruikt, en elke foto in mockups.js bestaat
  const slots = read('js/styleguide/mockups.js');
  const used = new Set(Array.from(slots.matchAll(/photo: '([\w-]+)'/g), (m) => m[1]));
  assert.deepEqual([...used].sort(), [...ids].sort());
});

test('de voorbeelden zijn gelijk aan de makers: posts uit de Insta Post Maker, de brief uit de Document Maker', () => {
  // Posts: elke tekst staat letterlijk in de standaardteksten van js/insta/app.js
  const insta = read('js/insta/app.js');
  const strings = [];
  (function walk(v) {
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(C.usage.demo.posts);
  for (const s of strings.filter(Boolean)) assert.ok(insta.includes(`'${s.replace(/\n/g, '\\n')}'`), `in js/insta/app.js: ${s}`);
  assert.deepEqual(Object.keys(C.usage.demo.posts), ['photo', 'overlay', 'blog', 'case', 'carousel']);
  assert.equal(C.usage.demo.posts.carousel.active, 1, 'de carousel op slide 2');
  // De brief: gelijk aan PMDocModel.EXAMPLE en de standaardtitel van de Document Maker
  const { EXAMPLE } = require('../js/document/model.js');
  const L = C.usage.letter;
  assert.deepEqual(L.recipient, EXAMPLE.recipient.split('\n'));
  assert.equal(L.salutation, EXAMPLE.salutation);
  const em = (html) => html.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  const body = /^<p>(.*?)<\/p><h2>(.*?)<\/h2><ul>(.*?)<\/ul><p>(.*?)<\/p>$/.exec(EXAMPLE.body);
  assert.ok(body, 'de opbouw van EXAMPLE.body');
  assert.equal(L.intro, body[1]);
  assert.equal(L.heading, body[2]);
  assert.deepEqual(L.bullets, Array.from(body[3].matchAll(/<li>(.*?)<\/li>/g), (m) => em(m[1])));
  assert.equal(L.outro, body[4]);
  const app = read('js/document/app.js');
  assert.ok(app.includes(`title: '${L.title}'`), 'de standaardtitel');
  assert.ok(app.includes(`closing: '${L.closing}'`), 'de groet');
  assert.ok(app.includes(`company: '${L.signature}'`), 'de afzender onder de groet');
  assert.equal(L.date, '[datum]', 'geen echte datum: tijdloos');
});

test('tools/styleguide.html laadt de makers en de beelden vóór de pagina’s', () => {
  const html = read('tools/styleguide.html');
  const order = Array.from(html.matchAll(/<script src="\.\.\/([^"]+)"><\/script>/g), (m) => m[1]);
  const at = (f) => {
    assert.ok(order.includes(f), f);
    return order.indexOf(f);
  };
  for (const f of ['js/insta/templates.js', 'js/presentation/deck.js', 'js/presentation/templates.js', 'js/styleguide/photos.js', 'js/styleguide/mockups.js']) {
    assert.ok(at(f) < at('js/styleguide/model.js') && at(f) < at('js/styleguide/pages.js') && at(f) < at('js/styleguide/app.js'), `${f} vóór model, pages en app`);
  }
  assert.ok(at('js/icons/hex.js') < at('js/insta/templates.js'));
  assert.ok(at('js/styleguide/svg-path.js') < at('js/styleguide/photos.js') && at('js/styleguide/photos.js') < at('js/styleguide/mockups.js'));
  assert.ok(at('js/styleguide/content.js') < at('js/styleguide/mockups.js'), 'mockups.js leest content.js bij het laden');
  // photo-data.js op aanvraag via photos.js (geen vaste <script>: 1,5 MB)
  assert.ok(!order.includes('js/styleguide/photo-data.js'));
});

test('de neutralen van de pagina’s zijn grijs of blauwgrijs, geen eigen accentkleur', () => {
  const { NEUTRALS } = pagesInNode();
  assert.ok(NEUTRALS.length >= 10);
  for (const c of NEUTRALS) {
    const [r, g, b] = M.rgbOf(c);
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 32, `${c} is neutraal`);
    assert.ok(!T.allColors().some((t) => t.hex === c.toUpperCase()), `${c} is geen huiskleur`);
  }
});

test('pdf-lib laadt zoals de andere bibliotheken: vaste versie en SRI-hash', () => {
  const core = read('js/shared/core.js');
  const m = /pdflib:\s*\{\s*src:\s*'([^']+)',\s*integrity:\s*'([^']+)'/.exec(core);
  assert.ok(m, 'LIBS.pdflib');
  assert.match(m[1], /^https:\/\/cdn\.jsdelivr\.net\/npm\/pdf-lib@\d+\.\d+\.\d+\/dist\/pdf-lib\.min\.js$/);
  assert.match(m[2], /^sha384-[A-Za-z0-9+/]{64}$/);
  assert.match(core, /pdflib: \(\) => loadLib\('pdflib'\)/);
});

test('de export van de styleguide kiest geen eigen snede: dezelfde als de andere makers', () => {
  const js = read('js/styleguide/export.js');
  assert.ok(!/fontStyle/.test(js), 'geen fontStyle');
  assert.ok(!/'light'/.test(js), 'geen Light-snede');
  assert.match(js, /new global\.PMPdfCanvas\(pdf, \{ width: S\.W, height: S\.H, pageWidth: PAGE_W \}\)/);
});

/* ---------------------------------------------------------------------------
   In de hub
   ------------------------------------------------------------------------- */

test('de Brand Styleguide staat in het register, op het dashboard en in de README', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read('js/shared/tools.js'), sandbox);
  const tool = sandbox.window.PM_TOOLS.find((t) => t.id === 'styleguide');
  assert.ok(tool);
  assert.equal(tool.name, 'Brand Styleguide');
  assert.equal(tool.href, 'tools/styleguide.html');
  assert.equal(tool.group, 'design');
  assert.equal(tool.status, 'nieuw');
  assert.match(tool.newUntil, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(tool.description && tool.exports.length && tool.cta);
  assert.ok(fs.existsSync(path.join(__dirname, '..', tool.href)));
  assert.match(read('tools/styleguide.html'), /data-toolnav="styleguide"/);
  assert.match(read('index.html'), /<noscript>[\s\S]*tools\/styleguide\.html[\s\S]*<\/noscript>/);
  assert.match(read('README.md'), /## Brand Styleguide/);
});
