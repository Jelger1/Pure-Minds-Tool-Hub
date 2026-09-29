/* Tests voor js/shared/help.js: teksten uit het contract en veilige opmaak */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { helpText, render, plain } = require('../js/shared/help.js');

const PM_HELP = {
  insta: {
    help: {
      formaat: { title: ' Formaat ', text: 'Bepaalt de **vorm** van je post.' },
      leeg: { title: '', text: '' },
      kapot: 'geen object',
    },
  },
};

test('helpText: titel en tekst uit PM_HELP.<tool>.help, zonder witruimte', () => {
  assert.deepEqual(helpText(PM_HELP, 'insta', 'formaat'), { title: 'Formaat', text: 'Bepaalt de **vorm** van je post.' });
});

test('helpText: ontbrekend of leeg geeft null', () => {
  assert.equal(helpText(PM_HELP, 'insta', 'bestaat-niet'), null);
  assert.equal(helpText(PM_HELP, 'insta', 'leeg'), null);
  assert.equal(helpText(PM_HELP, 'insta', 'kapot'), null);
  assert.equal(helpText(PM_HELP, 'document', 'formaat'), null);
  assert.equal(helpText(undefined, 'insta', 'formaat'), null);
});

test('render: **vet**, alinea\'s en regeleinden', () => {
  assert.equal(render('Een **woord** hier.'), '<p>Een <b>woord</b> hier.</p>');
  assert.equal(render('Eerste.\n\nTweede\nregel.'), '<p>Eerste.</p><p>Tweede<br>regel.</p>');
  assert.equal(render(''), '<p></p>');
});

test('render: HTML uit de tekst wordt nooit uitgevoerd', () => {
  const html = render('<img src=x onerror="alert(1)"> & "quotes"');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &quot;quotes&quot;/);
});

test('plain: tekst voor de schermlezer, zonder sterretjes en extra witruimte', () => {
  assert.equal(plain('Een **woord**\n\nhier.'), 'Een woord hier.');
});
