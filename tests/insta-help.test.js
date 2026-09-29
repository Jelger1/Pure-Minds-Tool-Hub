/* Tests voor js/insta/help.js: elke [?] en elke stap past bij de HTML en de schrijfwijze */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const words = (t) => String(t).trim().split(/\s+/).length;

test('uitleg en rondleiding (js/insta/help.js) passen bij de HTML', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read('js/insta/help.js'), sandbox);
  const H = sandbox.window.PM_HELP.insta;
  const html = read('tools/insta.html');
  // Elke [?] heeft een tekst, en elke tekst heeft een [?]
  const used = new Set(Array.from(html.matchAll(/data-help="([^"]+)"/g), (m) => m[1]));
  for (const key of used) assert.ok(H.help[key], `tekst voor data-help="${key}"`);
  for (const key of Object.keys(H.help)) assert.ok(used.has(key), `[?] voor "${key}" in de HTML`);
  // Onderdelen = de rail; doelen van de rondleiding bestaan ('kop' zet app.js zelf op het kopveld)
  assert.deepEqual(Array.from(H.sections, (s) => s.id), Array.from(html.matchAll(/class="rail__item" data-section="([^"]+)"/g), (m) => m[1]));
  const targets = new Set([...Array.from(html.matchAll(/data-tour="([^"]+)"/g), (m) => m[1]), 'kop']);
  for (const step of H.tour) if (step.target) assert.ok(targets.has(step.target), `data-tour="${step.target}"`);
  // Schrijfwijze uit de kop van help.js: uitleg hoogstens 40 woorden, een stap 35, een titel 5
  for (const [key, h] of Object.entries(H.help)) assert.ok(words(h.text) <= 40, `uitleg "${key}" is ${words(h.text)} woorden`);
  for (const step of H.tour) {
    assert.ok(words(step.text) <= 35, `stap "${step.id}" is ${words(step.text)} woorden`);
    assert.ok(words(step.title) <= 5, `titel van stap "${step.id}"`);
  }
});

test('de PDF wordt overal als bestand voor Canva uitgelegd', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read('js/insta/help.js'), sandbox);
  const H = sandbox.window.PM_HELP.insta;
  assert.match(H.help.bestandstype.text, /Canva/);
  assert.doesNotMatch(H.help.bestandstype.text, /Figma/);
  assert.match(read('tools/insta.html'), /id="ex-pdf"[^>]*><label for="ex-pdf" title="[^"]*Canva/);
});
