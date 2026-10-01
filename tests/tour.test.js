/* Tests voor de stappenlogica van js/shared/tour.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSteps, readStatus, autoStart, findIndex, progress, doeDone, describe, startIndex, storeKey } = require('../js/shared/tour.js');

const STEPS = normalizeSteps([
  { id: 'welkom', title: 'Welkom' },
  { id: 'template', section: 'template', target: 'template', title: 'Template', doe: { event: 'change' } },
  { id: 'kop', section: 'tekst', target: 'kop', title: 'Kop', doe: { event: 'input', min: 3 } },
  { id: 'foto', target: 'foto', title: 'Foto' },
  { id: 'klaar', title: 'Klaar' },
]);

test('normalizeSteps: alleen stappen met titel of tekst, elke stap een id', () => {
  const steps = normalizeSteps([{ title: 'a' }, null, 'x', { text: 'b', target: 5 }, {}]);
  assert.deepEqual(steps.map((s) => s.id), ['stap-1', 'stap-4']);
  assert.equal(steps[1].target, '5');
  assert.equal(steps[0].target, null);
  assert.deepEqual(normalizeSteps(undefined), []);
});

test('storeKey: per tool', () => {
  assert.equal(storeKey('insta'), 'pm-tour-insta-v1');
});

test('readStatus: altijd een geldige stand', () => {
  assert.deepEqual(readStatus(null, 5), { status: 'nieuw', step: 0 });
  assert.deepEqual(readStatus({ status: 'bezig', step: 3 }, 5), { status: 'bezig', step: 3 });
  assert.deepEqual(readStatus({ status: 'raar', step: 99 }, 5), { status: 'nieuw', step: 4 });
  assert.deepEqual(readStatus({ status: 'done', step: -2 }, 5), { status: 'done', step: 0 });
  assert.deepEqual(readStatus({ status: 'skipped', step: '2.7' }, 5), { status: 'skipped', step: 2 });
  assert.deepEqual(readStatus({ status: 'bezig', step: 'x' }, 0), { status: 'bezig', step: 0 });
});

test('autoStart: eerste keer starten, onderbroken hervatten, gestopt of klaar niet', () => {
  assert.equal(autoStart({ status: 'nieuw' }), 'start');
  assert.equal(autoStart(undefined), 'start');
  assert.equal(autoStart({ status: 'nieuw' }, { quickStart: true }), 'hint', 'snelle start: alleen een melding');
  assert.equal(autoStart({ status: 'bezig', step: 2 }), 'resume');
  assert.equal(autoStart({ status: 'bezig', step: 2 }, { quickStart: true }), 'resume');
  assert.equal(autoStart({ status: 'done' }), null);
  assert.equal(autoStart({ status: 'skipped' }), null);
});

test('findIndex: slaat stappen over die er nu niet zijn, in beide richtingen', () => {
  const noFoto = (s) => s.id !== 'foto';
  assert.equal(findIndex(STEPS, 3, 1, noFoto), 4);
  assert.equal(findIndex(STEPS, 3, -1, noFoto), 2);
  assert.equal(findIndex(STEPS, 5, 1), -1, 'voorbij het einde');
  assert.equal(findIndex(STEPS, -1, -1), -1, 'voor het begin');
  assert.equal(findIndex(STEPS, 0, 1, () => false), -1);
});

test('progress: telt alleen stappen die er zijn', () => {
  assert.equal(progress(STEPS, 0).label, '1 van 5');
  assert.equal(progress(STEPS, 2).label, '3 van 5');
  const p = progress(STEPS, 4, (s) => s.id !== 'foto');
  assert.deepEqual([p.pos, p.total, p.label], [4, 4, '4 van 4']);
});

test('doeDone: typen telt pas bij een echte wijziging van genoeg tekens', () => {
  const doe = { event: 'input', min: 3 };
  assert.equal(doeDone(doe, { type: 'input', value: 'Onze kop' }, { initial: 'Onze kop' }), false, 'nog de voorbeeldtekst');
  assert.equal(doeDone(doe, { type: 'input', value: 'On' }, { initial: '' }), false, 'te kort');
  assert.equal(doeDone(doe, { type: 'input', value: '**ab**' }, { initial: '' }), false, 'sterretjes tellen niet');
  assert.equal(doeDone(doe, { type: 'input', value: 'Ons' }, { initial: '' }), true);
  assert.equal(doeDone(doe, { type: 'input', value: 'Onze kop!' }, { initial: 'Onze kop' }), true);
  assert.equal(doeDone(doe, { type: 'change', value: 'Ons' }), false, 'ander event');
});

test('doeDone: match, change, click en signal', () => {
  assert.equal(doeDone({ event: 'input', match: '\\*\\*.+\\*\\*' }, { type: 'input', value: 'een **woord**' }), true);
  assert.equal(doeDone({ event: 'input', match: '\\*\\*.+\\*\\*' }, { type: 'input', value: 'een woord' }), false);
  assert.equal(doeDone({ event: 'input', match: '(' }, { type: 'input', value: 'x' }), true, 'kapotte regex blokkeert niet');
  assert.equal(doeDone({ event: 'change' }, { type: 'change', value: 'carousel' }), true);
  assert.equal(doeDone({ event: 'change', match: '^story$' }, { type: 'change', value: 'portrait' }), false);
  assert.equal(doeDone({ event: 'click' }, { type: 'click' }), true);
  assert.equal(doeDone({ signal: 'foto' }, { type: 'signal', name: 'foto' }), true);
  assert.equal(doeDone({ signal: 'foto' }, { type: 'signal', name: 'ander' }), false);
  assert.equal(doeDone({ signal: 'foto' }, { type: 'click' }), false, 'een signal-stap wacht op het signal');
  assert.equal(doeDone({}, { type: 'input', value: 'abc' }), true, 'standaard is typen');
  assert.equal(doeDone(null, { type: 'click' }), false);
});

test('describe en startIndex: menutekst en waar een handmatige start begint', () => {
  assert.equal(describe(null, 5), 'rondleiding starten');
  assert.equal(describe({ status: 'done' }, 5), 'rondleiding opnieuw');
  assert.equal(describe({ status: 'skipped', step: 2 }, 5), 'rondleiding verder (stap 3 van 5)');
  assert.equal(describe({ status: 'skipped', step: 0 }, 5), 'rondleiding starten');
  assert.equal(describe({ status: 'skipped', step: 4 }, 5), 'rondleiding starten', 'bij de laatste stap opnieuw');
  assert.equal(startIndex({ status: 'skipped', step: 2 }, 5), 2);
  assert.equal(startIndex({ status: 'done', step: 2 }, 5), 0);
  assert.equal(startIndex(null, 5), 0);
});
