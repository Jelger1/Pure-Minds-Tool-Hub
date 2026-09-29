/* Tests voor js/shared/history.js: stappen, samenvoegen, grens en sneltoetsen */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistory, shortcutAction, isTextEntry } = require('../js/shared/history.js');

// Een tool met een toestand en een klok die we zelf verzetten
function setup(opts = {}) {
  const tool = { state: { title: '', size: 'normaal' }, restored: 0 };
  let t = 0;
  const h = createHistory({
    snapshot: () => tool.state,
    restore: (s) => {
      tool.state = s;
      tool.restored++;
      if (opts.commitOnRestore) h.commit('veld');   // zoals een input-event tijdens het terugzetten
    },
    now: () => t,
    ...opts,
  });
  const change = (patch, key, dt = 100) => {
    t += dt;
    tool.state = { ...tool.state, ...patch };
    return h.commit(key);
  };
  return { h, tool, change };
}

test('ongedaan maken en opnieuw zetten de toestand terug', () => {
  const { h, tool, change } = setup();
  assert.equal(h.canUndo, false);
  change({ title: 'a' }, 'kop', 1000);
  change({ size: 'groot' }, 'grootte', 1000);
  assert.equal(h.undo(), true);
  assert.deepEqual(tool.state, { title: 'a', size: 'normaal' });
  assert.equal(h.undo(), true);
  assert.deepEqual(tool.state, { title: '', size: 'normaal' });
  assert.equal(h.undo(), false, 'niets meer terug');
  assert.equal(h.redo(), true);
  assert.equal(h.redo(), true);
  assert.deepEqual(tool.state, { title: 'a', size: 'groot' });
  assert.equal(h.redo(), false);
});

test('typen in één veld is één stap (binnen 700 ms)', () => {
  const { h, tool, change } = setup();
  for (const title of ['O', 'On', 'Onz', 'Onze']) change({ title }, 'kop', 150);
  assert.deepEqual(h.size, { undo: 1, redo: 0 });
  h.undo();
  assert.equal(tool.state.title, '');
});

test('een pauze of een ander veld begint een nieuwe stap', () => {
  const { h, tool, change } = setup();
  change({ title: 'a' }, 'kop', 100);
  change({ title: 'ab' }, 'kop', 800);   // langer dan 700 ms stil
  change({ size: 'groot' }, 'grootte', 100);
  change({ title: 'abc' }, 'kop', 100);  // ander veld ertussen
  assert.equal(h.size.undo, 4);
  h.undo();
  assert.equal(tool.state.title, 'ab');
});

test('een commit zonder sleutel wordt nooit samengevoegd', () => {
  const { h, change } = setup();
  change({ title: 'a' }, null, 10);
  change({ title: 'b' }, null, 10);
  assert.equal(h.size.undo, 2);
});

test('seal() maakt van de volgende commit een nieuwe stap', () => {
  const { h, change } = setup();
  change({ title: 'a' }, 'kop', 10);
  h.seal();
  change({ title: 'ab' }, 'kop', 10);
  assert.equal(h.size.undo, 2);
});

test('een nieuwe wijziging na ongedaan maken wist opnieuw', () => {
  const { h, tool, change } = setup();
  change({ title: 'a' }, 'kop', 1000);
  change({ title: 'b' }, 'kop', 1000);
  h.undo();
  assert.equal(h.canRedo, true);
  change({ size: 'klein' }, 'grootte', 1000);
  assert.equal(h.canRedo, false);
  assert.equal(h.redo(), false);
  assert.deepEqual(tool.state, { title: 'a', size: 'klein' });
});

test('na ongedaan maken voegt dezelfde sleutel niet samen met de oude stap', () => {
  const { h, tool, change } = setup();
  change({ title: 'a' }, 'kop', 1000);
  change({ title: 'ab' }, 'kop', 1000);
  h.undo();
  change({ title: 'ax' }, 'kop', 10);
  h.undo();
  assert.equal(tool.state.title, 'a', 'de stap na ongedaan maken is apart');
});

test('de grens houdt alleen de nieuwste stappen', () => {
  const { h, tool, change } = setup({ limit: 3 });
  for (let i = 1; i <= 5; i++) change({ title: `v${i}` }, null, 1000);
  assert.equal(h.size.undo, 3);
  while (h.undo());
  assert.equal(tool.state.title, 'v2', 'oudste bewaarde toestand');
});

test('standaardgrens is 100 stappen', () => {
  const { h, change } = setup();
  for (let i = 0; i < 130; i++) change({ title: String(i) }, null, 1000);
  assert.equal(h.size.undo, 100);
});

test('geen wijziging, geen stap', () => {
  const { h, change } = setup();
  assert.equal(change({}, 'kop'), false);
  assert.equal(h.canUndo, false);
});

test('commits tijdens restore() tellen niet', () => {
  const { h, change } = setup({ commitOnRestore: true });
  change({ title: 'a' }, 'kop', 1000);
  change({ title: 'b' }, 'kop', 1000);
  h.undo();
  assert.equal(h.canRedo, true, 'redo blijft bestaan');
  assert.deepEqual(h.size, { undo: 1, redo: 1 });
});

test('clear() begint opnieuw vanaf de huidige toestand', () => {
  const { h, tool, change } = setup();
  change({ title: 'a' }, 'kop', 1000);
  h.clear();
  assert.equal(h.canUndo, false);
  change({ title: 'b' }, 'kop', 1000);
  h.undo();
  assert.equal(tool.state.title, 'a');
});

test('onChange meldt elke verandering en kan worden afgemeld', () => {
  const { h, change } = setup();
  const seen = [];
  const off = h.onChange((info) => seen.push(`${info.source}:${info.canUndo}:${info.canRedo}`));
  change({ title: 'a' }, 'kop', 1000);
  h.undo();
  h.redo();
  off();
  change({ title: 'b' }, 'kop', 1000);
  assert.deepEqual(seen, ['commit:true:false', 'undo:false:true', 'redo:true:false']);
});

test('snapshot en restore zijn verplicht', () => {
  assert.throws(() => createHistory({}), /snapshot/);
});

test('sneltoetsen: Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z en Ctrl + Y', () => {
  assert.equal(shortcutAction({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(shortcutAction({ key: 'z', metaKey: true }), 'undo');
  assert.equal(shortcutAction({ key: 'Z', ctrlKey: true, shiftKey: true }), 'redo');
  assert.equal(shortcutAction({ key: 'Z', metaKey: true, shiftKey: true }), 'redo');
  assert.equal(shortcutAction({ key: 'y', ctrlKey: true }), 'redo');
  assert.equal(shortcutAction({ key: 'y', metaKey: true }), null, 'Cmd + Y is op een Mac iets anders');
  assert.equal(shortcutAction({ key: 'z' }), null);
  assert.equal(shortcutAction({ key: 'z', ctrlKey: true, altKey: true }), null);
  assert.equal(shortcutAction({ key: 's', ctrlKey: true }), null);
  assert.equal(shortcutAction(null), null);
});

test('in een tekstveld doet de browser zelf ongedaan maken', () => {
  assert.equal(isTextEntry({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'email' }), true);
  assert.equal(isTextEntry({ tagName: 'INPUT' }), true, 'zonder type = tekst');
  assert.equal(isTextEntry({ tagName: 'SELECT' }), true);
  assert.equal(isTextEntry({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'range' }), false);
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'radio' }), false);
  assert.equal(isTextEntry({ tagName: 'BUTTON' }), false);
  assert.equal(isTextEntry(null), false);
});
