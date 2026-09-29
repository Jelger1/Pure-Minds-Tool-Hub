/* Tests voor het rekenwerk in js/shared/toolbar.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCommands, parseInserts, parseAligns, parseBlocks, normBlock, emphasisAt, COMMANDS } = require('../js/shared/toolbar.js');

test('parseCommands: kleine letters, dubbele eruit, volgorde blijft', () => {
  assert.deepEqual(parseCommands('nadruk Grootte  nadruk uitlijnen'), ['nadruk', 'grootte', 'uitlijnen']);
  assert.deepEqual(parseCommands(''), []);
  assert.deepEqual(parseCommands(undefined), []);
});

test('elke ingebouwde opdracht werkt in een gewoon veld, in contenteditable, of allebei', () => {
  for (const [name, def] of Object.entries(COMMANDS)) assert.ok(def.plain || def.rich, name);
  assert.ok(COMMANDS.vet.plain && COMMANDS.vet.rich, 'vet werkt in allebei');
  assert.ok(COMMANDS.nadruk.plain && !COMMANDS.nadruk.rich, 'nadruk alleen met **markup**');
  assert.ok(!COMMANDS.cursief.plain, 'cursief alleen in contenteditable');
});

test('parseInserts: alleen {invulplekken}, met een label', () => {
  assert.deepEqual(parseInserts('{klant} {diensten} los'), [
    { token: '{klant}', label: '+ klant' },
    { token: '{diensten}', label: '+ diensten' },
  ]);
  assert.deepEqual(parseInserts(''), []);
});

test('parseAligns: alleen wat de tool toestaat, standaard links en midden', () => {
  assert.deepEqual(parseAligns(''), ['links', 'midden']);
  assert.deepEqual(parseAligns('midden links'), ['links', 'midden'], 'vaste volgorde');
  assert.deepEqual(parseAligns('rechts uitvullen'), ['rechts']);
  assert.deepEqual(parseAligns('uitvullen'), ['links', 'midden'], 'niets geldigs: de standaard');
});

test('parseBlocks: standaard alle vier de stijlen, of een deel', () => {
  assert.deepEqual(parseBlocks('').map((b) => b.id), ['p', 'h2', 'h3', 'blockquote']);
  assert.deepEqual(parseBlocks('p h2').map((b) => b.label), ['alinea', 'kop']);
});

test('normBlock: formatBlock van elke browser naar een stijl', () => {
  assert.equal(normBlock('h2'), 'h2');
  assert.equal(normBlock('<H3>'), 'h3');
  assert.equal(normBlock('blockquote'), 'blockquote');
  assert.equal(normBlock('div'), 'p');
  assert.equal(normBlock(''), 'p');
  assert.equal(normBlock(null), 'p');
});

test('emphasisAt: cursor of selectie binnen **nadruk**', () => {
  const v = 'Onze **Google Ads** audit';
  const at = (word) => v.indexOf(word);
  assert.equal(emphasisAt(v, at('Google') + 2), true, 'cursor in het woord');
  assert.equal(emphasisAt(v, at('Google'), at('Ads') + 3), true, 'selectie binnen de nadruk');
  assert.equal(emphasisAt(v, at('**'), at('audit') - 1), true, 'selectie met de sterretjes erbij');
  assert.equal(emphasisAt(v, at('Onze')), false);
  assert.equal(emphasisAt(v, at('audit') + 1), false);
  assert.equal(emphasisAt(v, at('Onze'), at('Ads')), false, 'selectie half erbuiten');
});

test('emphasisAt: meerdere stukken nadruk, en geen nadruk over twee stukken heen', () => {
  const v = '**een** en **twee**';
  assert.equal(emphasisAt(v, 3), true);
  assert.equal(emphasisAt(v, v.indexOf('twee') + 1), true);
  assert.equal(emphasisAt(v, v.indexOf(' en ') + 2), false);
  assert.equal(emphasisAt(v, 2, v.indexOf('twee') + 2), false);
  assert.equal(emphasisAt('', 0), false);
});
