/* Tests voor het rekenwerk in js/shared/shell.js (plaatsen, regio's, rail, sneltoetsen) */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { place, toCanvasPoint, hitRegion, rovingIndex, formatKeys, readSaved } = require('../js/shared/shell.js');

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const view = { width: 1000, height: 800 };
const size = { width: 200, height: 100 };

test('place: onder het anker als het past, links uitgelijnd', () => {
  assert.deepEqual(place(rect(100, 100, 40, 20), size, view), { top: 128, left: 100, side: 'bottom' });
});

test('place: klapt naar boven als er onder geen ruimte is', () => {
  const p = place(rect(100, 740, 40, 20), size, view);
  assert.equal(p.side, 'top');
  assert.equal(p.top, 740 - 8 - 100);
});

test('place: blijft binnen het scherm (marge 12 px)', () => {
  const p = place(rect(950, 100, 40, 20), size, view);
  assert.equal(p.left, 1000 - 12 - 200);
  const q = place(rect(-50, 100, 40, 20), size, view);
  assert.equal(q.left, 12);
});

test('place: rechts, links en midden uitlijnen', () => {
  const r = place(rect(100, 300, 100, 40), size, view, { side: 'right', align: 'center', gap: 10 });
  assert.deepEqual(r, { top: 270, left: 210, side: 'right' });
  const l = place(rect(900, 300, 50, 40), size, view, { side: 'right' });
  assert.equal(l.side, 'left', 'rechts past niet: links');
  const end = place(rect(500, 100, 100, 20), size, view, { align: 'end' });
  assert.equal(end.left, 400);
});

test('place: past nergens, dan de kant met de meeste ruimte', () => {
  const p = place(rect(10, 10, 980, 700), { width: 300, height: 300 }, view);
  assert.equal(p.side, 'bottom');   // eerste kant bij een gelijke stand
  assert.ok(p.top >= 12 && p.top <= 800 - 12 - 300);
});

test('toCanvasPoint: schermpixels naar canvaspixels', () => {
  const r = { left: 100, top: 50, width: 540, height: 540 };
  assert.deepEqual(toCanvasPoint(370, 320, r, 1080, 1080), { x: 540, y: 540 });
  assert.deepEqual(toCanvasPoint(100, 50, r, 1080, 1080), { x: 0, y: 0 });
});

test('hitRegion: de kleinste regio onder het punt wint', () => {
  const regions = [
    { key: 'foto', rect: { x: 0, y: 0, w: 1080, h: 1080 } },
    { key: 'kop', rect: { x: 88, y: 600, w: 900, h: 200 } },
    { key: 'label', rect: { x: 88, y: 88, w: 300, h: 40 } },
  ];
  assert.equal(hitRegion(regions, 500, 700).key, 'kop');
  assert.equal(hitRegion(regions, 100, 100).key, 'label');
  assert.equal(hitRegion(regions, 1000, 50).key, 'foto');
  assert.equal(hitRegion(regions, 2000, 50), null);
  assert.equal(hitRegion(regions, 88, 600).key, 'kop', 'de rand telt mee');
});

test('hitRegion: bij gelijke grootte de laatste, en lege invoer', () => {
  const regions = [{ key: 'a', rect: { x: 0, y: 0, w: 10, h: 10 } }, { key: 'b', rect: { x: 0, y: 0, w: 10, h: 10 } }];
  assert.equal(hitRegion(regions, 5, 5).key, 'b');
  assert.equal(hitRegion([], 5, 5), null);
  assert.equal(hitRegion(undefined, 5, 5), null);
  assert.equal(hitRegion([{ key: 'geen rect' }], 5, 5), null);
});

test('rovingIndex: pijltjes lopen rond, Home en End naar de randen', () => {
  assert.equal(rovingIndex(0, 4, 'ArrowDown'), 1);
  assert.equal(rovingIndex(3, 4, 'ArrowRight'), 0);
  assert.equal(rovingIndex(0, 4, 'ArrowUp'), 3);
  assert.equal(rovingIndex(2, 4, 'ArrowLeft'), 1);
  assert.equal(rovingIndex(2, 4, 'Home'), 0);
  assert.equal(rovingIndex(0, 4, 'End'), 3);
  assert.equal(rovingIndex(1, 4, 'Enter'), -1);
  assert.equal(rovingIndex(0, 0, 'ArrowDown'), -1);
});

test('formatKeys: combinaties en alternatieven, op een Mac met symbolen', () => {
  assert.deepEqual(formatKeys('Ctrl + Z'), [['Ctrl', 'Z']]);
  assert.deepEqual(formatKeys('Ctrl + Shift + Z of Ctrl + Y'), [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']]);
  assert.deepEqual(formatKeys('Ctrl + Shift + Z', true), [['⌘', '⇧', 'Z']]);
  assert.deepEqual(formatKeys('Alt + F10', true), [['⌥', 'F10']]);
  assert.deepEqual(formatKeys('?'), [['?']]);
  assert.deepEqual(formatKeys(''), []);
});

test('readSaved: alleen een paneel dat bestaat, ingeklapt alleen als dat zo bewaard is', () => {
  const ids = ['template', 'tekst', 'foto'];
  assert.deepEqual(readSaved({ panel: 'tekst', collapsed: true }, ids), { panel: 'tekst', collapsed: true });
  assert.deepEqual(readSaved({ panel: 'weg', collapsed: 'ja' }, ids), { panel: 'template', collapsed: false });
  assert.deepEqual(readSaved(null, ids), { panel: 'template', collapsed: false });
  assert.deepEqual(readSaved(null, []), { panel: null, collapsed: false });
});
