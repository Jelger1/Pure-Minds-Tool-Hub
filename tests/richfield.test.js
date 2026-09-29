/* Tests voor js/shared/richfield.js: markup -> stukken -> markup moet exact gelijk blijven */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, serialise, leaves, locate, plainText, splitChips, shape } = require('../js/shared/richfield.js');

// canvas-kit.js tekent de posts; zijn runsFrom() bepaalt wat nadruk is
global.window = global;
require('../js/shared/canvas-kit.js');
const { runsFrom } = global.PMCanvas;

const CHIPS = ['{klant}', '{diensten}', '{onderwerp}'];
const round = (s) => serialise(parse(s, CHIPS));

test('parse + serialise geeft exact dezelfde markup terug', () => {
  const cases = [
    '', 'a', 'Onze nieuwe **Google Ads-audit** is live',
    '**a**', '**a****b**', '**a** **b**', 'a**b**c',
    'a ** b', '**open zonder einde', '****', '***', '*', '**', 'x***y**', '*****',
    '{klant}', '**{klant}**', '{klant}{diensten}', ' {klant} ', 'Voor {klant} hebben wij {diensten} gedaan.',
    '{onbekend}', '{Klant}', '{klant', 'klant}', '{{klant}}', '{kl ant}',
    'één **café** 😀 ✓ — “quotes”', '**😀**', 'a\n**b\nc**\n', 'regel\r\nnog een', '\n\n', 'tab\there',
    '- punt één\n- **punt** twee', 'Lees onze blog over {onderwerp} op de website.',
  ];
  for (const s of cases) assert.equal(round(s), s, JSON.stringify(s));
});

test('willekeurige markup komt altijd exact terug (1000 gevallen)', () => {
  const alphabet = ['a', 'b', ' ', '*', '**', '{klant}', '{diensten}', '{x}', '{', '}', '\n', 'é', '😀', '.'];
  let seed = 42;
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  for (let i = 0; i < 1000; i++) {
    let s = '';
    const len = rnd(14);
    for (let j = 0; j < len; j++) s += alphabet[rnd(alphabet.length)];
    assert.equal(round(s), s, JSON.stringify(s));
  }
});

test('nadruk in het veld is precies de nadruk die het canvas tekent', () => {
  // Leaves -> runs zoals runsFrom ze maakt (een chip is voor het canvas gewone tekst)
  const runs = (s) => {
    const out = [];
    for (const lf of leaves(parse(s, CHIPS))) {
      const text = lf.kind === 'chip' ? lf.token : lf.s;
      if (!text) continue;
      const prev = out[out.length - 1];
      if (prev && prev.em === lf.em) prev.text += text;
      else out.push({ text, em: lf.em });
    }
    return out;
  };
  const cases = ['Onze **Google Ads** audit', '**a****b**', 'a ** b', '**open', 'x***y**', 'Voor {klant} hebben **wij** {diensten}', 'één **café** 😀'];
  for (const s of cases) {
    // runsFrom voegt aangrenzende stukken met dezelfde nadruk niet samen; wij wel, dus vergelijk per teken
    const flat = (rs) => rs.flatMap((r) => Array.from(r.text).map((ch) => `${r.em ? 'E' : 'P'}${ch}`)).join('');
    assert.equal(flat(runs(s)), flat(runsFrom(s)), s);
  }
});

test('stukken: tekst, chips en nadruk, met een open ** aan het eind', () => {
  assert.deepEqual(parse('Voor **{klant}** nu', CHIPS), [
    { t: 'text', s: 'Voor ' },
    { t: 'em', kids: [{ t: 'chip', token: '{klant}' }], closed: true },
    { t: 'text', s: ' nu' },
  ]);
  assert.deepEqual(parse('a **b', CHIPS), [{ t: 'text', s: 'a ' }, { t: 'em', kids: [{ t: 'text', s: 'b' }], closed: false }]);
  assert.deepEqual(parse('****', CHIPS), [{ t: 'em', kids: [], closed: true }]);
});

test('chips: alleen de tokens die het veld kent, hoofdletters maken niet uit', () => {
  assert.deepEqual(splitChips('{Klant} en {x}', CHIPS), [{ t: 'chip', token: '{Klant}' }, { t: 'text', s: ' en {x}' }]);
  assert.deepEqual(splitChips('{klant}', []), [{ t: 'text', s: '{klant}' }]);
  assert.deepEqual(splitChips('', CHIPS), []);
  assert.equal(plainText(parse('Voor {klant} **nu**', CHIPS)), 'Voor klant nu');
});

test('leaves: markup-offsets van tekst en chips, rond de sterretjes', () => {
  const list = leaves(parse('ab**cd**{klant}e', CHIPS));
  assert.deepEqual(list.map((l) => [l.kind, l.em, l.start, l.end]), [
    ['text', false, 0, 2],
    ['text', true, 4, 6],
    ['chip', false, 8, 15],
    ['text', false, 15, 16],
  ]);
  const empty = leaves(parse('****', CHIPS));
  assert.deepEqual(empty.map((l) => [l.kind, l.em, l.start, l.end]), [['text', true, 2, 2]]);
});

test('locate: de cursor staat nooit tussen de sterretjes of in een chip', () => {
  const list = leaves(parse('ab**cd**{klant}e', CHIPS));
  assert.deepEqual(locate(list, 1), { leaf: 0, offset: 1 });
  assert.deepEqual(locate(list, 2), { leaf: 0, offset: 2 }, 'eind van de gewone tekst');
  assert.deepEqual(locate(list, 3), { leaf: 0, offset: 2 }, 'midden in ** -> de dichtstbijzijnde plek');
  assert.deepEqual(locate(list, 4), { leaf: 1, offset: 0 }, 'begin van de nadruk');
  assert.deepEqual(locate(list, 6), { leaf: 1, offset: 2 });
  assert.deepEqual(locate(list, 7), { leaf: 1, offset: 2 });
  assert.deepEqual(locate(list, 10), { leaf: 2, side: 'before' }, 'in het token: ervoor');
  assert.deepEqual(locate(list, 15), { leaf: 3, offset: 0 });
  assert.deepEqual(locate(leaves(parse('{klant}', CHIPS)), 7), { leaf: 0, side: 'after' });
  assert.equal(locate([], 3), null);
});

test('shape: aangrenzende tekst samen, lege tekst weg (om de DOM met de markup te vergelijken)', () => {
  const segs = [{ t: 'text', s: 'a' }, { t: 'text', s: '' }, { t: 'text', s: 'b' }, { t: 'em', kids: [{ t: 'text', s: 'c', node: {} }] }];
  assert.deepEqual(shape(segs), [{ t: 'text', s: 'ab' }, { t: 'em', kids: [{ t: 'text', s: 'c' }], closed: true }]);
  assert.deepEqual(shape(parse('ab**c**', CHIPS)), shape(segs));
});
