'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup() {
  const core = fs.readFileSync(path.join(__dirname, '../js/shared/core.js'), 'utf8');
  const timers = new Map();
  const pageEvents = new Map();
  const documentEvents = new Map();
  let next = 0;
  const document = {
    visibilityState: 'visible',
    addEventListener: (name, fn) => documentEvents.set(name, fn),
  };
  const debounce = vm.runInNewContext(`${core.slice(core.indexOf('  const debounce ='), core.indexOf('  const uid ='))}\ndebounce;`, {
    setTimeout: (fn) => { timers.set(++next, fn); return next; },
    clearTimeout: (id) => timers.delete(id),
    global: { addEventListener: (name, fn) => pageEvents.set(name, fn) },
    document,
  });
  return {
    debounce,
    tick() { for (const fn of [...timers.values()]) fn(); },
    pagehide() { pageEvents.get('pagehide')?.(); },
    visibility(value) { document.visibilityState = value; documentEvents.get('visibilitychange')?.(); },
  };
}

test('autosave bewaart de laatste wijziging bij herladen vóór de timer afloopt', () => {
  const env = setup();
  const saved = [];
  const save = env.debounce((value) => saved.push(value), 300, { flushOnHide: true });
  save('eerste titel');
  save('laatste titel');
  assert.deepEqual(saved, []);
  env.pagehide();
  assert.deepEqual(saved, ['laatste titel']);
  env.tick();
  env.pagehide();
  assert.deepEqual(saved, ['laatste titel'], 'dezelfde wijziging wordt niet opnieuw geschreven');
});

test('autosave bewaart bij verbergen van het tabblad en blijft daarna werken', () => {
  const env = setup();
  const saved = [];
  const save = env.debounce((value) => saved.push(value), 300, { flushOnHide: true });
  save('foto gekozen');
  env.visibility('visible');
  assert.deepEqual(saved, []);
  env.visibility('hidden');
  env.pagehide();
  assert.deepEqual(saved, ['foto gekozen']);
  env.visibility('visible');
  save('foto vervangen');
  env.tick();
  assert.deepEqual(saved, ['foto gekozen', 'foto vervangen']);
});

test('alleen kijken zonder wijziging schrijft geen concept bij verlaten', () => {
  const env = setup();
  let writes = 0;
  const save = env.debounce(() => writes++, 300, { flushOnHide: true });
  env.visibility('hidden');
  env.pagehide();
  assert.equal(writes, 0);
  save();
  env.pagehide();
  assert.equal(writes, 1, 'opslaan zonder argumenten werkt ook');
});

test('gewone debounce voor renderen of zoeken blijft vertraagd bij pagehide', () => {
  const env = setup();
  const values = [];
  const render = env.debounce((value) => values.push(value), 120);
  render('oud');
  render('nieuw');
  env.pagehide();
  env.visibility('hidden');
  assert.deepEqual(values, []);
  env.tick();
  assert.deepEqual(values, ['nieuw']);
});
