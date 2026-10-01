/* Tests voor de Brand Styleguide: tokens gelijk aan de huisstijl, teksten uit brandbook v2.0,
   uitleg en rail bij de HTML, de pagina's, het rekenwerk (model.js), de SVG-paden en de export */
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

test('gewichten zijn de @font-face-regels van Pure Minds Sans, zonder Medium 500', () => {
  const css = read('css/global.css');
  const faces = Array.from(css.matchAll(/@font-face\s*\{([^}]+)\}/g), (m) => m[1]).filter((f) => /Pure Minds Sans/.test(f) && !/italic/.test(f));
  const weights = faces.map((f) => Number(/font-weight:\s*(\d+)/.exec(f)[1])).sort((a, b) => a - b);
  assert.deepEqual(T.font.weights.map((w) => w.weight), weights);
  assert.ok(!weights.includes(500), 'geen Medium 500');
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
  assert.equal(C.slogan, 'We mind your business, for your peace of mind.');
});

test('de correcties op v2.0 zijn doorgevoerd, en on-aangetapt blijft', () => {
  const all = JSON.stringify(C);
  assert.ok(!/technologiege-dreven/.test(all), 'technologiegedreven aan elkaar');
  assert.ok(!/ACHTEGROND/i.test(all), 'achtergrond goed gespeld');
  assert.ok(!/on aangetapt|onaangetapt/.test(all), 'on-aangetapt, zoals in de voorstellen');
  assert.ok(!/Google Fonts/.test(all), 'Pure Minds Sans staat niet op Google Fonts');
  assert.ok(!/ {2}/.test(all), 'geen dubbele spaties');
  assert.ok(!/Medium 500/.test(C.type.notes.join(' ')), 'Medium 500 staat niet bij de gewichten in gebruik');
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
});

/* ---------------------------------------------------------------------------
   De pagina's
   ------------------------------------------------------------------------- */

test('pagina’s: elk hoofdstuk heeft er minstens één, in de volgorde van de rail', () => {
  const ids = C.pages.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'unieke id’s');
  assert.ok(C.pages.length >= 12 && C.pages.length <= 18, `${C.pages.length} pagina's`);
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
  for (const op of ['translate(', 'rotate(', '.scale(', '.clip(', 'createLinearGradient', 'createRadialGradient', 'setLineDash', 'ellipse(', 'roundRect(', 'drawImage(', 'globalAlpha', 'strokeText']) {
    assert.ok(!pageCode.includes(op), `geen ${op} in de pagina's`);
  }
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

test('zoeken: de juiste pagina eerst, korte woorden alleen als heel woord', () => {
  const index = M.searchIndex(C, T);
  const first = (q) => (M.search(index, q)[0] || {}).id;
  assert.equal(first('magenta'), 'kleuren');
  assert.equal(first('clear space'), 'clear-space');
  assert.equal(first('je of u'), 'tone-of-voice');
  assert.equal(first('#1ab9e2'), 'kleuren');
  assert.equal(first('emoji'), 'schrijven');
  assert.equal(first('Emerce'), 'toepassingen');
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
  assert.deepEqual(j.font.weights, [300, 400, 600, 700, 800]);
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
   Export: lagen in PMPdfCanvas, pdf-lib in core.js, Light in de PDF-fonts
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

  // Met lagen: BDC/EMC om elk blok, een nieuwe laag sluit de vorige, open aan het eind wordt dicht
  pdf = fake();
  ctx = new PMPdfCanvas(pdf, { width: 100, height: 100, pageWidth: 100, measure, fontStyle: (w) => (w <= 300 ? 'light' : 'normal') });
  ctx.beginLayer('Achtergrond');
  ctx.fillRect(0, 0, 100, 100);
  ctx.endLayer();
  ctx.beginLayer('Vormen');
  ctx.fillRect(0, 0, 10, 10);
  ctx.beginLayer('Tekst');
  ctx.font = '300 20px x';
  ctx.fillText('Light', 10, 50);
  await ctx.flush();
  const seq = pdf.calls.filter((c) => ['write', 'fill', 'text', 'setFont'].includes(c[0])).map((c) => (c[0] === 'write' ? c[1] : c[0] === 'setFont' ? `font:${c[2]}` : c[0]));
  assert.deepEqual(seq, ['/OC /Achtergrond BDC', 'fill', 'EMC', '/OC /Vormen BDC', 'fill', 'EMC', '/OC /Tekst BDC', 'font:light', 'text', 'EMC']);
  ctx.endLayer();   // niets open: geen losse EMC
  await ctx.flush();
  assert.equal(pdf.calls.filter((c) => c[1] === 'EMC').length, 3);
});

/* ---------------------------------------------------------------------------
   De PDF zonder browser: elke pagina door PMPdfCanvas met een nep-jsPDF.
   Alleen PureMindsSans-*, geen afbeeldingen, uitknippaden of verlopen (die
   worden in PMPdfCanvas een afbeelding), alleen huiskleuren en de vaste
   neutralen, alles in een laag, en onder de 1.400 elementen van Canva.
   Meten gebeurt hier met een vaste tekenbreedte: de regelval wijkt iets af van
   de browser, de telling dus ook (in de browser: zo'n 1.100).
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

async function pdfInNode() {
  const core = read('js/shared/core.js');
  const fromCore = (name) => new Function(`${new RegExp(`function ${name}\\([\\s\\S]*?\\n {2}\\}\\r?\\n`).exec(core)[0]}\nreturn ${name};`)();
  globalThis.PM = { pdfFontStyle: fromCore('pdfFontStyle'), pdfColor: fromCore('pdfColor'), fileProtocolError: () => new Error('x') };
  const { PMPdfCanvas } = require('../js/shared/pdf-canvas.js');
  // De snedekeuze van de export zelf (Light krijgt een eigen snede)
  const fontStyle = new Function('PM', `return ${/const fontStyle = (\(weight, italic\) => [^;]+);/.exec(read('js/styleguide/export.js'))[1]};`)(globalThis.PM);
  const S = pagesInNode();
  const env = {
    logo: P.parseSvg(read('assets/brand/logo/PureMinds-zeshoek-logo-wit.svg')),
    badgeWhite: P.parseSvg(read('assets/brand/emerce/e100-2026-liggend-wit.svg')),
    badgeBlack: P.parseSvg(read('assets/brand/emerce/e100-2026-liggend-zwart.svg')),
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
    const ctx = new PMPdfCanvas(pdf, { width: S.W, height: S.H, pageWidth: 841.89, measure, fontStyle });
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
    assert.equal(raster + image + svg, 0, `${p.id}: geen afbeeldingen (ook geen verloop of uitsnede)`);
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
  assert.ok(used.has('PureMindsSans-Light') && used.has('PureMindsSans-ExtraBold'), [...used].join());
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
    ...C.colophon.lines, ...C.colophon.news, ...T.allColors().filter((c) => !['wit', 'grijs'].includes(c.id)).map((c) => c.hex),
  ];
  const missing = want.map(norm).filter((s) => !all.includes(s));
  assert.deepEqual(missing, []);
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

test('Pure Minds Sans Light zit in de PDF-fonts, als eigen snede (alleen de styleguide gebruikt hem)', () => {
  assert.match(read('scripts/build-brand-data.js'), /light: 'PureMindsSans-Light\.ttf'/);
  // Light staat bewust als laatste (zie build-brand-data.js), dus per regel zoeken in plaats van alleen het begin
  const lines = fs.readFileSync(path.join(__dirname, '..', 'js', 'shared', 'pdf-fonts.js'), 'utf8').split('\n');
  assert.ok(lines.some((l) => l.startsWith("  light: { file: 'PureMindsSans-Light.ttf'")), 'light in pdf-fonts.js');
  assert.match(read('js/styleguide/export.js'), /'light'/);
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
