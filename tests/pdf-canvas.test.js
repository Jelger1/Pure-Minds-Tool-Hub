/* Tests voor js/shared/pdf-canvas.js: welke losse PDF-objecten een tekening oplevert (zonder browser) */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// De snedekeuze en de kleurnotatie komen uit core.js zelf, zodat deze tests meelopen met een wijziging daar
const core = fs.readFileSync(path.join(__dirname, '..', 'js', 'shared', 'core.js'), 'utf8');
function fromCore(name) {
  const src = new RegExp(`function ${name}\\([\\s\\S]*?\\n {2}\\}\\r?\\n`).exec(core);
  assert.ok(src, `${name} staat in core.js`);
  // eslint-disable-next-line no-new-func
  return new Function(`${src[0]}\nreturn ${name};`)();
}
globalThis.PM = { pdfFontStyle: fromCore('pdfFontStyle'), pdfColor: fromCore('pdfColor'), fileProtocolError: () => new Error('x') };

const {
  PMPdfCanvas, Path, Gradient, parseColor, absoluteStart, bbox, inside, intersect, clipContains, makeClip, roundOut, hash,
} = require('../js/shared/pdf-canvas.js');

/* --- nep-omgeving --- */

// Meten zonder browser: elk teken is een halve korpsgrootte breed, plus de letterspatiëring
function fakeMeasure() {
  return {
    font: '10px sans-serif',
    letterSpacing: '0px',
    measureText(text) {
      const size = Number((/([\d.]+)px/.exec(this.font) || [0, 10])[1]);
      const ls = parseFloat(this.letterSpacing) || 0;
      return { width: Array.from(String(text)).length * (size * 0.5 + ls) };
    },
  };
}

// jsPDF dat alleen onthoudt wat er gevraagd wordt; Open Sans kent alles onder U+2000
function fakePdf() {
  const calls = [];
  const pdf = { calls };
  const names = ['moveTo', 'lineTo', 'curveTo', 'close', 'fill', 'fillEvenOdd', 'stroke', 'setFillColor', 'setDrawColor',
    'setLineWidth', 'setLineCap', 'setLineJoin', 'setLineMiterLimit', 'setFont', 'setFontSize', 'setCharSpace',
    'setTextColor', 'text', 'saveGraphicsState', 'restoreGraphicsState', 'setGState', 'addImage'];
  for (const name of names) pdf[name] = (...args) => { calls.push([name, ...args]); };
  pdf.GState = class GState {
    constructor(o) { Object.assign(this, o); }
  };
  pdf.internal = { getFont: () => ({ metadata: { characterToGlyph: (c) => (c < 0x2000 ? 1 : 0) } }) };
  return pdf;
}

// Een post van 1080 × 1350 op een pagina van 810 pt breed: k = 0,75
function make(opts = {}) {
  const pdf = fakePdf();
  const ctx = new PMPdfCanvas(pdf, { width: 1080, height: 1350, pageWidth: 810, measure: fakeMeasure(), ...opts });
  return { pdf, ctx };
}

// Puntige zeshoek, precies zoals addHex in canvas-kit.js
function addHex(ctx, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexSubs(cx, cy, r) {
  const p = new Path();
  addHex(p, cx, cy, r);
  return p.subs;
}

const near = (a, b, eps = 1e-6, msg = '') => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≈ ${b}`);
const nearRect = (r, e, eps = 1e-6) => {
  assert.ok(r, 'rechthoek bestaat');
  for (const k of ['x', 'y', 'w', 'h']) near(r[k], e[k], eps, k);
};
const names = (calls) => calls.map((c) => c[0]);
const img = (w, h, src = 'foto.jpg') => ({ naturalWidth: w, naturalHeight: h, src });

/* ---------------------------------------------------------------------------
   Paden
   ------------------------------------------------------------------------- */

test('Path: lineTo na closePath begint een nieuw subpad op het beginpunt', () => {
  const p = new Path();
  p.moveTo(10, 10);
  p.lineTo(50, 10);
  p.lineTo(50, 50);
  p.closePath();
  p.lineTo(90, 90);
  assert.equal(p.subs.length, 2);
  assert.equal(p.subs[0].closed, true);
  assert.deepEqual(p.subs[1].segs, [['M', 10, 10], ['L', 90, 90]]);
  assert.equal(p.subs[1].closed, false);
});

test('Path: lineTo zonder beginpunt is een moveTo, net als in canvas', () => {
  const p = new Path();
  p.lineTo(5, 7);
  p.lineTo(9, 7);
  assert.deepEqual(p.subs, [{ segs: [['M', 5, 7], ['L', 9, 7]], closed: false }]);
});

test('Path: quadraticCurveTo wordt een kubische bezier (C) met controlepunten op 2/3', () => {
  const p = new Path();
  p.moveTo(0, 0);
  p.quadraticCurveTo(30, 60, 60, 0);
  const [op, x1, y1, x2, y2, x, y] = p.subs[0].segs[1];
  assert.equal(op, 'C');
  [x1, y1, x2, y2, x, y].forEach((v, i) => near(v, [20, 40, 40, 40, 60, 0][i]));
  assert.deepEqual(p.last, [60, 0]);
});

test('Path: arc wordt C-segmenten op de cirkel, een per kwart', () => {
  const circle = new Path();
  circle.arc(50, 50, 10, 0, Math.PI * 2);
  const segs = circle.subs[0].segs;
  assert.deepEqual(names(segs), ['M', 'C', 'C', 'C', 'C']);
  near(segs[0][1], 60);
  near(segs[0][2], 50);
  let [px, py] = [segs[0][1], segs[0][2]];
  for (const [, x1, y1, x2, y2, x, y] of segs.slice(1)) {
    near(Math.hypot(x - 50, y - 50), 10, 1e-9, 'eindpunt');
    // Midden van de bezier: hoogstens 0,1% van de straal naast de cirkel
    const mx = (px + 3 * x1 + 3 * x2 + x) / 8;
    const my = (py + 3 * y1 + 3 * y2 + y) / 8;
    near(Math.hypot(mx - 50, my - 50), 10, 0.01, 'midden');
    [px, py] = [x, y];
  }
  near(px, 60);
  near(py, 50);

  // Halve boog: twee segmenten; tegen de klok in van 0 naar ½π: driekwart cirkel
  const half = new Path();
  half.arc(0, 0, 10, 0, Math.PI);
  assert.equal(half.subs[0].segs.length, 3);
  const ccw = new Path();
  ccw.arc(50, 50, 10, 0, Math.PI / 2, true);
  const ccwSegs = ccw.subs[0].segs;
  assert.equal(ccwSegs.length, 4);
  const end = ccwSegs[ccwSegs.length - 1];
  near(end[5], 50);
  near(end[6], 60);
});

test('Path: arc na een open subpad trekt eerst een lijn naar het begin van de boog', () => {
  const p = new Path();
  p.moveTo(0, 0);
  p.arc(50, 50, 10, 0, Math.PI);
  assert.equal(p.subs.length, 1);
  assert.deepEqual(names(p.subs[0].segs), ['M', 'L', 'C', 'C']);
  assert.deepEqual(p.subs[0].segs[1].slice(1).map((v) => Math.round(v * 1e6) / 1e6), [60, 50]);
});

// Canvas (gecontroleerd in Chrome met isPointInStroke): na closePath trekt arc
// een lijn vanaf het beginpunt van het gesloten subpad
test('Path: arc na closePath begint op het beginpunt van het gesloten subpad, net als canvas', () => {
  const p = new Path();
  p.moveTo(10, 10);
  p.lineTo(60, 10);
  p.closePath();
  p.arc(200, 100, 20, 0, Math.PI);
  assert.deepEqual(p.subs[1].segs.slice(0, 2).map((s) => s.map((v) => (typeof v === 'number' ? Math.round(v) : v))), [['M', 10, 10], ['L', 220, 100]]);
});

test('Path: rect is een gesloten subpad met .rect; daarna begint lineTo op de hoek', () => {
  const p = new Path();
  p.rect(10, 20, 30, 40);
  assert.equal(p.subs.length, 1);
  assert.equal(p.subs[0].closed, true);
  assert.deepEqual(p.subs[0].rect, { x: 10, y: 20, w: 30, h: 40 });
  assert.deepEqual(names(p.subs[0].segs), ['M', 'L', 'L', 'L']);
  p.lineTo(100, 100);
  assert.deepEqual(p.subs[1].segs, [['M', 10, 20], ['L', 100, 100]]);
  assert.equal(p.subs[1].rect, undefined);
});

/* ---------------------------------------------------------------------------
   Kleuren en kleine hulpjes
   ------------------------------------------------------------------------- */

test('parseColor: hex met 3, 4, 6 en 8 tekens', () => {
  assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 });
  assert.deepEqual(parseColor('#1AB9E2'), { r: 26, g: 185, b: 226, a: 1 });
  assert.deepEqual(parseColor('#1ab9e280'), { r: 26, g: 185, b: 226, a: 128 / 255 });
  assert.deepEqual(parseColor('#abcd'), { r: 170, g: 187, b: 204, a: 0xdd / 255 });
});

test('parseColor: rgb en rgba, met komma of spatie, getallen en procenten', () => {
  assert.deepEqual(parseColor('rgb(26, 185, 226)'), { r: 26, g: 185, b: 226, a: 1 });
  assert.deepEqual(parseColor('rgba(26,185,226,.16)'), { r: 26, g: 185, b: 226, a: 0.16 });
  assert.deepEqual(parseColor('RGBA(255,255,255,0.55)'), { r: 255, g: 255, b: 255, a: 0.55 });
  assert.deepEqual(parseColor('rgb(26 185 226 / 50%)'), { r: 26, g: 185, b: 226, a: 0.5 });
  assert.deepEqual(parseColor('rgb(100% 0% 50%)'), { r: 255, g: 0, b: 127.5, a: 1 });
});

test('parseColor: transparant en leeg geven null', () => {
  for (const v of ['transparent', 'none', '', null, undefined]) assert.equal(parseColor(v), null, String(v));
  // Zonder browser kan een kleurnaam niet genormaliseerd worden
  assert.equal(parseColor('red'), null);
  assert.deepEqual(parseColor('rgba(0,0,0,0)'), { r: 0, g: 0, b: 0, a: 0 });
});

test('absoluteStart: een pad dat met een relatieve m begint, begint absoluut', () => {
  assert.equal(absoluteStart('m10 20l5 5z'), 'M10 20l5 5z');
  // Na "m" zijn volgende paren impliciet relatieve lijnen
  assert.equal(absoluteStart('m10 20 30 40'), 'M10 20 l 30 40');
  assert.equal(absoluteStart('m10-20h5'), 'M10 -20h5');
  assert.equal(absoluteStart(' m.5.5 1 1'), 'M.5 .5 l 1 1');
  assert.equal(absoluteStart('M1 2L3 4'), 'M1 2L3 4', 'al absoluut');
  assert.equal(absoluteStart(''), '');
});

test('bbox, inside en clipContains met een zeshoek', () => {
  const hex = hexSubs(500, 500, 100);
  const half = 50 * Math.sqrt(3);
  nearRect(bbox(hex), { x: 500 - half, y: 400, w: 2 * half, h: 200 });
  nearRect(bbox(hex, 5), { x: 495 - half, y: 395, w: 2 * half + 10, h: 210 });
  assert.equal(bbox([]), null);

  assert.equal(inside(hex, 500, 500), true, 'midden');
  assert.equal(inside(hex, 500, 590), true, 'vlak bij de onderpunt');
  assert.equal(inside(hex, 420, 405), false, 'hoek van de omsluiting');
  assert.equal(inside(hex, 700, 500), false, 'ernaast');

  const clip = makeClip(hex, 'nonzero');
  assert.equal(clip.rect, null, 'een zeshoek is geen rechthoek');
  nearRect(clip.box, bbox(hex));
  assert.equal(clipContains(clip, { x: 450, y: 450, w: 100, h: 100 }), true);
  assert.equal(clipContains(clip, bbox(hex)), false, 'de hoeken van de omsluiting vallen erbuiten');
  assert.equal(clipContains(clip, { x: 480, y: 380, w: 40, h: 40 }), false, 'steekt boven uit');

  const p = new Path();
  p.rect(100, 100, 200, 100);
  const rectClip = makeClip(p.subs, 'nonzero');
  assert.deepEqual(rectClip.rect, { x: 100, y: 100, w: 200, h: 100 });
  assert.equal(clipContains(rectClip, { x: 100, y: 100, w: 200, h: 100 }), true);
  assert.equal(clipContains(rectClip, { x: 99, y: 100, w: 200, h: 100 }), false);
  p.rect(0, 0, 10, 10);
  assert.equal(makeClip(p.subs, 'nonzero').rect, null, 'twee rechthoeken zijn geen rechthoekige uitsnede');
});

test('intersect, roundOut en hash', () => {
  assert.deepEqual(intersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), { x: 5, y: 5, w: 5, h: 5 });
  assert.equal(intersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), null, 'alleen de rand');
  assert.equal(intersect(null, { x: 0, y: 0, w: 1, h: 1 }), null);
  assert.deepEqual(roundOut({ x: 10.2, y: 5.9995, w: 10, h: 3 }), { x: 10, y: 6, w: 11, h: 3 });
  assert.deepEqual(roundOut({ x: 0, y: 0, w: 1080, h: 1350 }), { x: 0, y: 0, w: 1080, h: 1350 });
  assert.equal(hash('verloop'), hash('verloop'));
  assert.notEqual(hash('verloop'), hash('verlooq'));
  assert.match(hash('x'.repeat(5000)), /^[0-9a-z]+$/);
});

/* ---------------------------------------------------------------------------
   Tekst: wat er als tekstobject wordt vastgelegd
   ------------------------------------------------------------------------- */

test('fillText: woorden in dezelfde stijl met een spatie ertussen worden één run, met de spatie', () => {
  const { ctx } = make();
  ctx.font = '400 40px "PM Open Sans"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Hallo', 100, 200);      // 5 × 20 = 100 breed, eindigt op 200
  ctx.fillText('wereld', 220, 200);     // spatie van 20
  assert.equal(ctx.items.length, 1);
  const [item] = ctx.items;
  assert.equal(item.kind, 'text');
  assert.equal(item.runs.length, 1);
  assert.equal(item.runs[0].text, 'Hallo wereld');
  assert.equal(item.runs[0].x, 100);
  assert.equal(item.runs[0].end, 340);
  assert.equal(item.runs[0].font.style, 'normal');
  assert.equal(item.runs[0].font.size, 40);
  assert.deepEqual(item.runs[0].color, { r: 255, g: 255, b: 255, a: 1 });
});

test('fillText: aansluitende stukken in dezelfde stijl worden één woord, zonder spatie', () => {
  const { ctx } = make();
  ctx.font = '700 40px x';
  ctx.fillText('Pure', 100, 200);
  ctx.fillText('Minds', 180, 200);
  assert.equal(ctx.items.length, 1);
  assert.deepEqual(ctx.items[0].runs.map((r) => r.text), ['PureMinds']);
});

test('fillText: een andere stijl na een spatie: de vorige run krijgt de spatie, de nieuwe begint apart', () => {
  const { ctx } = make();
  ctx.font = '400 40px x';
  ctx.fillText('Dit', 100, 200);         // eindigt op 160
  ctx.font = '800 40px x';
  ctx.fillText('vet', 180, 200);
  assert.equal(ctx.items.length, 1, 'één regel, één tekstobject');
  const { runs } = ctx.items[0];
  assert.deepEqual(runs.map((r) => r.text), ['Dit ', 'vet']);
  assert.deepEqual(runs.map((r) => r.font.style), ['normal', 'extrabold']);
  assert.equal(runs[1].x, 180, 'de nieuwe run staat waar de preview hem tekent');
  // En weer terug naar normaal, met een spatie
  ctx.font = '400 40px x';
  ctx.fillText('niet', 260, 200);
  assert.deepEqual(ctx.items[0].runs.map((r) => r.text), ['Dit ', 'vet ', 'niet']);
});

test('fillText: aansluitende stukken in een andere kleur (pureminds.nl) blijven losse runs zonder spatie', () => {
  const { ctx } = make();
  ctx.font = '700 24px x';
  let x = 60;
  for (const [part, color] of [['pureminds', '#ffffff'], ['.', '#1ab9e2'], ['nl', '#ffffff']]) {
    ctx.fillStyle = color;
    ctx.fillText(part, x, 1300);
    x += ctx.measureText(part).width;
  }
  assert.equal(ctx.items.length, 1);
  assert.deepEqual(ctx.items[0].runs.map((r) => r.text), ['pureminds', '.', 'nl']);
  assert.deepEqual(ctx.items[0].runs.map((r) => r.color.b), [255, 226, 255]);
});

test('fillText: een andere basislijn of een groot gat geeft een nieuw tekstobject', () => {
  const { ctx } = make();
  ctx.font = '400 40px x';
  ctx.fillText('regel een', 100, 200);
  ctx.fillText('regel twee', 100, 260);
  assert.equal(ctx.items.length, 2);
  assert.deepEqual(ctx.items.map((i) => i.y), [200, 260]);
  // Teller links en "swipe" rechts op dezelfde basislijn
  ctx.fillText('1/5', 60, 1300);
  ctx.fillText('swipe', 900, 1300);
  assert.equal(ctx.items.length, 4);
});

test('fillText: gecentreerd en rechts uitgelijnd verschuift x met de gemeten breedte', () => {
  const { ctx } = make();
  ctx.font = '400 40px x';
  ctx.textAlign = 'center';
  ctx.fillText('abcd', 500, 100);        // 80 breed
  ctx.textAlign = 'right';
  ctx.fillText('abcd', 500, 300);
  ctx.textAlign = 'left';
  ctx.fillText('abcd', 500, 500);
  assert.deepEqual(ctx.items.map((i) => [i.runs[0].x, i.runs[0].end]), [[460, 540], [420, 500], [500, 580]]);
});

test('fillText: gewicht en letterspatiëring volgen de font-instelling', () => {
  const { ctx } = make();
  const cases = [['300 40px x', 'normal'], ['400 40px x', 'normal'], ['600 40px x', 'semibold'], ['bold 40px x', 'bold'],
    ['800 40px x', 'extrabold'], ['40px x', 'normal'], ['italic 400 40px x', 'italic'], ['italic 700 40px x', 'bolditalic']];
  for (const [font, style] of cases) {
    ctx.font = font;
    assert.equal(ctx.fontInfo().style, style, font);
  }
  ctx.font = '700 25.5px x';
  ctx.letterSpacing = '3.06px';
  const f = ctx.fontInfo();
  assert.equal(f.size, 25.5);
  assert.equal(f.spacing, 3.06);
  assert.equal(ctx.measureText('ab').width, 2 * (12.75 + 3.06));
});

// In CSS mag het gewicht ook na de stijl staan ("bold italic 40px")
test('fillText: gewicht voor "italic" in de font-string wordt herkend', () => {
  const { ctx } = make();
  ctx.font = 'bold italic 40px x';
  assert.equal(ctx.fontInfo().style, 'bolditalic');
  ctx.font = '600 italic 40px x';
  assert.equal(ctx.fontInfo().style, 'bolditalic');
});

test('fillText: leeg of doorzichtig levert niets op; een verloop als vulling geeft de kleur op dat punt', () => {
  const { ctx } = make();
  ctx.font = '400 40px x';
  ctx.fillText('', 10, 10);
  ctx.fillStyle = 'transparent';
  ctx.fillText('weg', 10, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.001)';
  ctx.fillText('weg', 10, 10);
  assert.equal(ctx.items.length, 0);
  const g = ctx.createLinearGradient(0, 0, 0, 100);
  g.addColorStop(0, '#000000');
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fillText('verloop', 10, 50);
  assert.equal(ctx.items.length, 1);
  near(ctx.items[0].runs[0].color.r, 127.5);
});

test('fillText: een zacht afbreekstreepje tekent canvas niet, de PDF dus ook niet', () => {
  const { ctx } = make();
  ctx.font = '400 40px x';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('conversie­optimalisatie', 100, 200);
  assert.equal(ctx.items[0].runs[0].text, 'conversieoptimalisatie');
});

test('fillText: een emoji van meer tekens (1️⃣, ©️) blijft heel en wordt één afbeelding', () => {
  const { ctx } = make();
  ctx.font = '400 40px x';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Stap 1️⃣ klaar ©️', 100, 200);
  assert.deepEqual(ctx.items.map((i) => i.kind), ['text', 'raster', 'text', 'raster']);
  assert.equal(ctx.items[0].runs[0].text, 'Stap ', 'de 1 van de keycap staat niet los in de tekst');
  assert.ok(ctx.items[1].key.includes('1️⃣'));
  assert.equal(ctx.items[2].runs[0].text, ' klaar ');
});

test('fillText: een teken zonder glyph (emoji) wordt een afbeelding; de tekst erna blijft tekst', () => {
  const { ctx } = make();
  ctx.font = '700 40px x';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Top 👍 idee', 100, 200);
  assert.deepEqual(ctx.items.map((i) => i.kind), ['text', 'raster', 'text']);
  const [before, glyph, after] = ctx.items;
  assert.equal(before.runs[0].text, 'Top ');
  assert.equal(before.runs[0].x, 100);
  assert.equal(after.runs[0].text, ' idee', 'de tekst na de emoji gaat niet verloren');
  assert.equal(after.runs[0].x, 200, 'op de plek die de preview meet (5 tekens × 20)');
  assert.equal(after.runs[0].font.style, 'bold');
  // De emoji zelf: een klein vlak rond het teken, zonder uitsnede
  nearRect(glyph.box, { x: 180 - 16, y: 200 - 52, w: 20 + 32, h: 72 });
  assert.deepEqual(glyph.clips, []);
  assert.equal(typeof glyph.paint, 'function');
  assert.match(glyph.key, /glyph/);
  // Een teken boven U+2000 dat wel in het font zit: gewoon tekst (hier: font zonder metadata)
  const { pdf, ctx: plain } = make();
  pdf.internal.getFont = () => undefined;
  plain.font = '400 40px x';
  plain.fillText('Top 👍 idee', 100, 200);
  assert.deepEqual(plain.items.map((i) => i.kind), ['text']);
  assert.equal(plain.items[0].runs[0].text, 'Top 👍 idee');
});

/* ---------------------------------------------------------------------------
   Vlakken, lijnen en uitsnedes
   ------------------------------------------------------------------------- */

test('fillRect die een zeshoek-uitsnede helemaal bedekt, wordt de zeshoek zelf (vector)', () => {
  for (const [x, y, w, h] of [[0, 0, 1080, 1350], [500 - 50 * Math.sqrt(3), 400, 100 * Math.sqrt(3), 200]]) {
    const { ctx } = make();
    ctx.save();
    ctx.beginPath();
    addHex(ctx, 500, 500, 100);
    ctx.clip();
    ctx.fillStyle = '#3a4652';
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    assert.equal(ctx.items.length, 1);
    const [item] = ctx.items;
    assert.equal(item.kind, 'vector');
    assert.deepEqual(item.subs, hexSubs(500, 500, 100));
    assert.equal(item.rule, 'nonzero');
    assert.deepEqual(item.color, { r: 58, g: 70, b: 82, a: 1 });
  }
});

test('een vlak helemaal binnen de uitsnede blijft ongewijzigd', () => {
  const { ctx } = make();
  ctx.beginPath();
  addHex(ctx, 500, 500, 100);
  ctx.clip();
  ctx.fillStyle = '#1ab9e2';
  ctx.fillRect(480, 480, 40, 40);
  ctx.beginPath();
  addHex(ctx, 500, 500, 20);
  ctx.fill();
  assert.deepEqual(ctx.items.map((i) => i.kind), ['vector', 'vector']);
  assert.deepEqual(ctx.items[0].subs[0].rect, { x: 480, y: 480, w: 40, h: 40 });
  assert.deepEqual(ctx.items[1].subs, hexSubs(500, 500, 20));
});

test('een rechthoek die half buiten een rechthoekige uitsnede valt, wordt de doorsnede', () => {
  const { ctx } = make();
  ctx.save();
  ctx.beginPath();
  ctx.rect(100, 100, 200, 200);
  ctx.clip();
  ctx.fillStyle = '#e6007e';
  ctx.fillRect(0, 150, 1080, 50);
  ctx.fillRect(500, 500, 10, 10);       // helemaal erbuiten: niets
  ctx.restore();
  ctx.fillRect(0, 0, 1080, 12);         // na restore: geen uitsnede meer
  assert.equal(ctx.items.length, 2);
  assert.equal(ctx.items[0].kind, 'vector');
  assert.equal(ctx.items[0].subs.length, 1);
  assert.deepEqual(ctx.items[0].subs[0].rect, { x: 100, y: 150, w: 200, h: 50 });
  assert.deepEqual(ctx.items[1].subs[0].rect, { x: 0, y: 0, w: 1080, h: 12 });
  assert.deepEqual(ctx.items[1].clips, []);
});

// Canvas tekent een rechthoek met negatieve breedte gewoon (gecontroleerd in Chrome,
// ook onder een uitsnede die hem half snijdt)
test('fillRect met negatieve breedte onder een rechthoekige uitsnede blijft zichtbaar', () => {
  const { ctx } = make();
  ctx.beginPath();
  ctx.rect(100, 200, 300, 100);
  ctx.clip();
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(300, 210, -250, 50);     // loopt van x = 50 tot 300
  assert.equal(ctx.items.length, 1);
  nearRect(bbox(ctx.items[0].subs), { x: 100, y: 210, w: 200, h: 50 });
});

test('een vorm die half buiten een uitsnede valt en geen rechthoek is, wordt pixels met die uitsnede', () => {
  const { ctx } = make();
  ctx.beginPath();
  ctx.rect(0, 0, 500, 1350);
  ctx.clip();
  ctx.beginPath();
  addHex(ctx, 500, 500, 100);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  assert.equal(ctx.items.length, 1);
  const [item] = ctx.items;
  assert.equal(item.kind, 'raster');
  assert.equal(item.scale, 2);
  assert.equal(item.clips.length, 1);
  nearRect(item.box, bbox(hexSubs(500, 500, 100)));
});

test('kleuren met alfa blijven vector en houden hun alfa, ook met globalAlpha', () => {
  const { ctx } = make();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(0, 0, 100, 100);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = 'rgba(0,0,255,.5)';
  ctx.fillRect(0, 0, 100, 100);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 100, 100);         // onzichtbaar: niets
  assert.deepEqual(ctx.items.map((i) => i.kind), ['vector', 'vector', 'vector']);
  assert.deepEqual(ctx.items.map((i) => i.color.a), [0.08, 0.5, 0.25]);
});

test('save en restore zetten stijl en uitsnedes terug', () => {
  const { ctx } = make();
  ctx.fillStyle = '#111111';
  ctx.save();
  ctx.fillStyle = '#222222';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.rect(0, 0, 10, 10);
  ctx.clip();
  assert.equal(ctx.clips.length, 1);
  ctx.restore();
  assert.equal(ctx.fillStyle, '#111111');
  assert.equal(ctx.globalAlpha, 1);
  assert.deepEqual(ctx.clips, []);
  ctx.restore();                         // te vaak: geen fout
  assert.equal(ctx.canvas.getContext('2d'), ctx);
  assert.deepEqual([ctx.canvas.width, ctx.canvas.height], [1080, 1350]);
});

/* ---------------------------------------------------------------------------
   Verlopen
   ------------------------------------------------------------------------- */

test('verloop over een rechthoek: één afbeelding op halve resolutie', () => {
  const { ctx } = make();
  const g = ctx.createLinearGradient(0, 1000, 0, 1350);
  g.addColorStop(0, 'rgba(20,34,51,0)');
  g.addColorStop(1, 'rgba(20,34,51,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 1000, 1080, 1350);    // loopt voorbij de pagina, zoals in de templates
  const glow = ctx.createRadialGradient(1080, 0, 0, 1080, 0, 972);
  glow.addColorStop(0, 'rgba(26,185,226,.16)');
  glow.addColorStop(1, 'rgba(26,185,226,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1350);
  assert.deepEqual(ctx.items.map((i) => [i.kind, i.scale]), [['raster', 0.5], ['raster', 0.5]]);
  nearRect(ctx.items[0].box, { x: 0, y: 1000, w: 1080, h: 1350 });
  assert.equal(ctx.rasterBox(ctx.items[0]).h, 350, 'op de pagina bijgesneden');
});

test('verloop als lijn (zeshoekpatroon) of over een vorm: afbeelding op rasterScale', () => {
  const { ctx } = make({ rasterScale: 3 });
  ctx.beginPath();
  addHex(ctx, 100, 100, 90);
  addHex(ctx, 256, 100, 90);
  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = g;
  ctx.fill();
  assert.deepEqual(ctx.items.map((i) => [i.kind, i.scale]), [['raster', 3], ['raster', 3]]);
  // Het vlak beslaat de vorm; de lijn krijgt ruimte voor de dikte en de hoeken (miter 10)
  const shape = bbox([...hexSubs(100, 100, 90), ...hexSubs(256, 100, 90)]);
  const pad = (1.5 / 2) * 10;
  nearRect(ctx.items[1].box, shape);
  nearRect(ctx.items[0].box, { x: shape.x - pad, y: shape.y - pad, w: shape.w + 2 * pad, h: shape.h + 2 * pad });
});

test('verloop met standaard rasterScale: lijn op 2, rechthoek op 0,5', () => {
  const { ctx } = make();
  const g = ctx.createLinearGradient(0, 0, 0, 100);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#000000');
  ctx.strokeStyle = g;
  ctx.strokeRect(10, 10, 100, 100);
  ctx.fillStyle = g;
  ctx.fillRect(10, 10, 100, 100);
  assert.deepEqual(ctx.items.map((i) => [i.kind, i.scale]), [['raster', 2], ['raster', 0.5]]);
});

test('hetzelfde verloop op twee slides geeft dezelfde sleutel; een ander verloop niet', () => {
  const draw = (alpha) => {
    const { ctx } = make();
    const g = ctx.createLinearGradient(0, 0, 0, 1350);
    g.addColorStop(0, `rgba(20,34,51,${alpha})`);
    g.addColorStop(1, 'rgba(20,34,51,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1080, 1350);
    return ctx.items[0].key;
  };
  assert.equal(draw(0.5), draw(0.5));
  assert.notEqual(draw(0.5), draw(0.6));
});

test('Gradient.colorAt: lineair en radiaal, begrensd op de eerste en laatste stop', () => {
  const lin = new Gradient('linear', [0, 0, 100, 0]);
  lin.addColorStop(1, '#ffffff');
  lin.addColorStop(0, '#000000');       // volgorde maakt niet uit
  near(lin.colorAt(50, 7).r, 127.5);
  assert.deepEqual(lin.colorAt(-20, 0), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(lin.colorAt(500, 0), { r: 255, g: 255, b: 255, a: 1 });
  const rad = new Gradient('radial', [0, 0, 0, 0, 0, 100]);
  rad.addColorStop(0, 'rgba(26,185,226,1)');
  rad.addColorStop(1, 'rgba(26,185,226,0)');
  near(rad.colorAt(30, 40).a, 0.5);
  assert.equal(new Gradient('linear', [0, 0, 1, 0]).colorAt(0, 0), null, 'zonder stops');
});

/* ---------------------------------------------------------------------------
   Afbeeldingen
   ------------------------------------------------------------------------- */

test('drawImage onder een rechthoekige uitsnede: alleen het zichtbare deel, met de bijbehorende bronuitsnede', () => {
  const { ctx } = make();
  ctx.save();
  ctx.beginPath();
  ctx.rect(100, 100, 200, 100);
  ctx.clip();
  ctx.drawImage(img(400, 200), 0, 0, 800, 400);  // twee keer vergroot
  ctx.restore();
  assert.equal(ctx.items.length, 1);
  const [item] = ctx.items;
  assert.equal(item.kind, 'image');
  assert.deepEqual(item.dest, { x: 100, y: 100, w: 200, h: 100 });
  assert.deepEqual(item.src, { x: 50, y: 50, w: 100, h: 50 });
  assert.equal(item.alpha, 1);
});

test('drawImage: foto over de hele post (cover) wordt bijgesneden tot de pagina', () => {
  const { ctx } = make();
  ctx.beginPath();
  ctx.rect(0, 0, 1080, 1350);
  ctx.clip();
  // Zoals drawPhoto: 2000 × 1000 in 1080 × 1350, midden van de foto
  ctx.drawImage(img(2000, 1000), -810, 0, 2700, 1350);
  const [item] = ctx.items;
  assert.equal(item.kind, 'image');
  nearRect(item.dest, { x: 0, y: 0, w: 1080, h: 1350 });
  nearRect(item.src, { x: 600, y: 0, w: 800, h: 1000 });
});

test('drawImage met bronrechthoek (9 argumenten) en globalAlpha', () => {
  const { ctx } = make();
  ctx.beginPath();
  ctx.rect(0, 0, 200, 400);
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.drawImage(img(1000, 1000), 100, 0, 200, 200, 0, 0, 400, 400);
  const [item] = ctx.items;
  assert.equal(item.kind, 'image');
  assert.deepEqual(item.dest, { x: 0, y: 0, w: 200, h: 400 });
  assert.deepEqual(item.src, { x: 100, y: 0, w: 100, h: 200 });
  assert.equal(item.alpha, 0.4);
});

test('drawImage met een negatieve breedte: canvas normaliseert (zonder spiegelen), de PDF ook', () => {
  const { ctx } = make();
  ctx.drawImage(img(400, 200), 300, 100, -100, 50);
  assert.equal(ctx.items.length, 1);
  assert.equal(ctx.items[0].kind, 'image');
  nearRect(ctx.items[0].dest, { x: 200, y: 100, w: 100, h: 50 });
  nearRect(ctx.items[0].src, { x: 0, y: 0, w: 400, h: 200 });
});

test('drawImage onder een zeshoek-uitsnede: een PNG met de uitsnede (raster)', () => {
  const { ctx } = make();
  ctx.save();
  ctx.beginPath();
  addHex(ctx, 500, 500, 100);
  ctx.clip();
  const box = bbox(hexSubs(500, 500, 100));
  ctx.drawImage(img(3000, 2000), box.x - 50, box.y, 300, 200);
  ctx.restore();
  assert.equal(ctx.items.length, 1);
  const [item] = ctx.items;
  assert.equal(item.kind, 'raster');
  assert.equal(item.clips.length, 1);
  assert.equal(item.clips[0].rect, null);
  nearRect(item.box, { x: box.x - 50, y: 400, w: 300, h: 200 });
  assert.equal(item.scale, 1.5, 'een foto in een zeshoek hoogstens 1,5 px per ontwerp-px (een PNG is groot)');
  assert.match(item.key, /foto\.jpg/);
  // Een kleine foto: niet scherper dan de bron, maar minstens 1 px per ontwerp-px
  const { ctx: small } = make();
  small.beginPath();
  addHex(small, 500, 500, 100);
  small.clip();
  small.drawImage(img(150, 100), box.x - 50, box.y, 300, 200);
  assert.equal(small.items[0].scale, 1);
});

test('drawImage: een SVG-logo dat helemaal zichtbaar is, blijft vector; onzichtbaar of leeg: niets', () => {
  const logo = img(200, 80, 'logo.svg');
  const { ctx } = make({ vectors: new Map([[logo, '<svg/>']]) });
  ctx.drawImage(logo, 60, 1250, 200, 80);
  ctx.drawImage(logo, 2000, 0, 200, 80);   // naast de pagina
  ctx.drawImage(img(0, 0), 0, 0, 10, 10);  // nog niet geladen
  ctx.drawImage(logo, 0, 0, 0, 80);        // geen breedte
  assert.deepEqual(ctx.items.map((i) => i.kind), ['svg']);
  assert.deepEqual(ctx.items[0].dest, { x: 60, y: 1250, w: 200, h: 80 });
  assert.equal(ctx.items[0].markup, '<svg/>');
  // Deels buiten de pagina: geen vector meer, maar het zichtbare deel als afbeelding
  const { ctx: cut } = make({ vectors: new Map([[logo, '<svg/>']]) });
  cut.drawImage(logo, 980, 0, 200, 80);
  assert.equal(cut.items[0].kind, 'image');
  assert.deepEqual(cut.items[0].dest, { x: 980, y: 0, w: 100, h: 80 });
  assert.deepEqual(cut.items[0].src, { x: 0, y: 0, w: 100, h: 80 });
});

/* ---------------------------------------------------------------------------
   Wegschrijven (alleen tekst en vectoren: daarvoor is geen browser nodig)
   ------------------------------------------------------------------------- */

test('flush: tekst en vectoren in tekenvolgorde, op schaal k, met alfa in een eigen GState', async () => {
  const { pdf, ctx } = make();
  ctx.fillStyle = '#1ab9e2';
  ctx.fillRect(0, 0, 1080, 12);
  ctx.font = '800 72px "PM Open Sans"';
  ctx.letterSpacing = '2px';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Titel', 60, 300);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  addHex(ctx, 540, 675, 100);
  ctx.fill('evenodd');
  ctx.strokeStyle = '#1ab9e2';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'bevel';
  ctx.stroke();

  const stats = await ctx.flush();
  assert.deepEqual(stats, { text: 1, vector: 3, raster: 0, image: 0, svg: 0 });
  assert.deepEqual(ctx.items, [], 'na flush is de lijst leeg');

  const hexCalls = ['moveTo', 'lineTo', 'lineTo', 'lineTo', 'lineTo', 'lineTo', 'close'];
  assert.deepEqual(names(pdf.calls), [
    'setFillColor', 'moveTo', 'lineTo', 'lineTo', 'lineTo', 'close', 'fill',
    'setFont', 'setFontSize', 'setCharSpace', 'setTextColor', 'text', 'setCharSpace',
    'saveGraphicsState', 'setGState', 'setFillColor', ...hexCalls, 'fillEvenOdd', 'restoreGraphicsState',
    'setDrawColor', 'setLineWidth', 'setLineCap', 'setLineJoin', 'setLineMiterLimit', ...hexCalls, 'stroke',
  ]);
  const call = (name, n = 0) => pdf.calls.filter((c) => c[0] === name)[n].slice(1);
  // De balk bovenaan: 1080 × 12 ontwerp-px = 810 × 9 pt
  // Kleur als tekst met 4 decimalen, anders rondt jsPDF merkcyaan af naar #1abae3
  assert.deepEqual(pdf.calls.slice(0, 7).map((c) => c.slice(1)), [['0.1029', '0.7265', '0.8873'], [0, 0], [810, 0], [810, 9], [0, 9], [], []]);
  // Tekst: echte tekst op x·k, y·k in de juiste snede, grootte en spatiëring op schaal
  assert.deepEqual(call('setFont'), ['OpenSans', 'extrabold']);
  assert.deepEqual(call('setFontSize'), [54]);
  assert.deepEqual(call('setCharSpace'), [1.5]);
  assert.deepEqual(call('setCharSpace', 1), [0], 'daarna weer terug op 0');
  assert.deepEqual(call('setTextColor'), ['1.0000', '1.0000', '1.0000']);
  assert.deepEqual(call('text'), ['Titel', 45, 225]);
  // Halfdoorzichtig vlak: GState met de alfa, en de kleur zonder alfa
  const gs = call('setGState')[0];
  assert.ok(gs instanceof pdf.GState);
  assert.deepEqual({ ...gs }, { opacity: 0.5, 'stroke-opacity': 0.5 });
  assert.deepEqual(call('setFillColor', 1), ['1.0000', '1.0000', '1.0000']);
  // Lijn: dikte op schaal, ronde kap = 1, afgeschuinde hoek = 2
  assert.deepEqual(call('setLineWidth'), [4.5]);
  assert.deepEqual(call('setLineCap'), [1]);
  assert.deepEqual(call('setLineJoin'), [2]);
  assert.deepEqual(call('setLineMiterLimit'), [10]);
  const [x, y] = call('moveTo', 2);
  near(x, 540 * 0.75);
  near(y, 575 * 0.75);
});

test('flush: bezierkrommen worden curveTo op schaal; halfdoorzichtige tekst in een GState', async () => {
  const { pdf, ctx } = make();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(100, 0, 200, 100, 200, 200);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.font = '400 40px x';
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillText('sleep hier je foto', 100, 400);
  const stats = await ctx.flush();
  assert.equal(stats.vector, 1);
  assert.equal(stats.text, 1);
  assert.deepEqual(pdf.calls.find((c) => c[0] === 'curveTo').slice(1), [75, 0, 150, 75, 150, 150]);
  const i = names(pdf.calls).indexOf('text');
  assert.deepEqual(names(pdf.calls.slice(i - 6, i + 3)), ['saveGraphicsState', 'setGState', 'setFont', 'setFontSize', 'setCharSpace', 'setTextColor', 'text', 'setCharSpace', 'restoreGraphicsState']);
  assert.equal(pdf.calls[i - 5][1].opacity, 0.55);
});

test('flush: een regel met twee stijlen wordt twee tekstobjecten, elk op zijn eigen x', async () => {
  const { pdf, ctx } = make();
  ctx.font = '400 40px x';
  ctx.fillText('Dit', 100, 200);
  ctx.font = '800 40px x';
  ctx.fillText('vet', 180, 200);
  const stats = await ctx.flush();
  assert.equal(stats.text, 2);
  assert.deepEqual(pdf.calls.filter((c) => c[0] === 'text').map((c) => c.slice(1)), [['Dit ', 75, 150], ['vet', 135, 150]]);
  assert.deepEqual(pdf.calls.filter((c) => c[0] === 'setFont').map((c) => c[2]), ['normal', 'extrabold']);
});
