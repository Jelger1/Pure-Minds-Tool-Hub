/* Tests voor js/document/model.js: bedragen, totalen, briefpapier en de controle op voorbeeldtekst */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../js/document/model.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// Een nieuw document zoals defaults() in js/document/app.js het maakt
function fresh(type = 'brief', extra = {}) {
  return {
    type, label: '', title: 'Voorstel voor de samenwerking', recipient: M.EXAMPLE.recipient, reference: '',
    salutation: M.EXAMPLE.salutation, quoteNumber: '2026-001', memoTo: 'Het team', memoFrom: '', memoCc: '',
    body: M.EXAMPLE.body, items: M.EXAMPLE.items.map((it) => ({ ...it })), showSignature: true,
    closing: 'Met vriendelijke groet,', signName: '', signRole: '', ...extra,
  };
}

// Een echt ingevuld document
function real(type = 'brief', extra = {}) {
  return fresh(type, {
    title: 'Voorstel campagnes 2027', recipient: 'Anna de Vries\nStudio Noord\nKanaalweg 8\n3526 KL Utrecht',
    salutation: 'Beste Anna,', body: '<p>Fijn dat we elkaar spraken over de campagnes van volgend jaar.</p>',
    items: [{ desc: 'Campagnebeheer', qty: 6, price: 700 }], signName: 'Jelger', signRole: 'Accountmanager', ...extra,
  });
}

const keys = (issues) => issues.map((i) => i.key);

test('parseAmount: bedragen zoals een Nederlander ze typt of plakt', () => {
  assert.equal(M.parseAmount('1.250,50'), 1250.5);
  assert.equal(M.parseAmount('€ 1.250,50'), 1250.5);
  assert.equal(M.parseAmount('1250,5'), 1250.5);
  assert.equal(M.parseAmount('1.250'), 1250, 'punt als duizendtal');
  assert.equal(M.parseAmount('1,250.00'), 1250, 'Engelse notatie');
  assert.equal(M.parseAmount('1250.5'), 1250.5);
  assert.equal(M.parseAmount('950'), 950);
  assert.equal(M.parseAmount(''), 0);
  assert.equal(M.parseAmount('abc'), 0);
  assert.equal(M.parseAmount(null), 0);
});

test('formatAmount: prijs met twee decimalen als dat nodig is, aantal zonder', () => {
  assert.equal(M.formatAmount(1250.5, 'price'), '1.250,50');
  assert.equal(M.formatAmount(950, 'price'), '950');
  assert.equal(M.formatAmount(3, 'qty'), '3');
  assert.equal(M.formatAmount(1.5, 'qty'), '1,5');
  assert.equal(M.parseAmount(M.formatAmount(1234567.89, 'price')), 1234567.89, 'heen en terug');
});

test('totals: lege regels tellen niet, btw in hele centen', () => {
  const t = M.totals([{ desc: 'A', qty: 1, price: 950 }, { desc: 'B', qty: 3, price: 650 }, { desc: '', qty: 1, price: 0 }], '21');
  assert.equal(t.rows.length, 2);
  assert.equal(t.subtotal, 2900);
  assert.equal(t.vatRate, 21);
  assert.equal(t.vat, 609);
  assert.equal(t.total, 3509);
  assert.equal(M.totals([{ desc: 'x', qty: 1, price: 10.05 }], '21').vat, 2.11);
  assert.equal(M.totals([{ desc: 'x', qty: 2, price: 100 }], '0').total, 200);
});

test('senderMissing: stipje bij Briefpapier zolang adres, KvK en e-mail leeg zijn', () => {
  assert.equal(M.senderMissing({ company: 'Pure Minds', street: '', kvk: '', email: '' }), true);
  assert.equal(M.senderMissing({ street: '  ', kvk: '', email: '' }), true);
  assert.equal(M.senderMissing({ street: '', kvk: '12345678', email: '' }), false);
  assert.equal(M.senderMissing({ street: '', kvk: '', email: 'hallo@pureminds.nl' }), false);
  assert.equal(M.senderMissing(null), true);
});

test('exampleIssues: een nieuw document meldt adres, aanhef en tekst', () => {
  const issues = M.exampleIssues(fresh('brief'));
  assert.deepEqual(keys(issues), ['recipient', 'salutation', 'body']);
  assert.deepEqual(issues.map((i) => i.label), ['adres', 'aanhef', 'tekst']);
  assert.equal(issues[0].found, 'Naam contactpersoon');
  assert.equal(issues[1].found, '[naam]');
  assert.match(issues[2].found, /^Bedankt voor het prettige gesprek/);
  assert.ok(issues[2].found.length <= 44);
});

test('exampleIssues: offerte meldt ook de voorbeeldregels en noemt het adres "klant"', () => {
  const issues = M.exampleIssues(fresh('offerte'));
  assert.deepEqual(keys(issues), ['recipient', 'body', 'items']);
  assert.equal(issues[0].label, 'klant');
  assert.equal(issues[2].found, 'Strategiesessie en analyse');
});

test('exampleIssues: een ingevuld document is schoon', () => {
  for (const type of ['brief', 'offerte', 'memo', 'notitie']) assert.deepEqual(M.exampleIssues(real(type)), [], type);
});

test('exampleIssues: één overgebleven adresregel of voorbeeldzin is genoeg', () => {
  assert.deepEqual(keys(M.exampleIssues(real('brief', { recipient: 'Anna de Vries\nStraat 1\n3526 KL Utrecht' }))), ['recipient']);
  const body = `<p>Eigen tekst.</p>${M.EXAMPLE.body.slice(M.EXAMPLE.body.indexOf('<p>Heb je'))}`;
  assert.deepEqual(keys(M.exampleIssues(real('brief', { body }))), ['body']);
  // Een korte voorbeeldkop ("Onze aanpak") schrijf je ook zelf: die telt niet
  assert.deepEqual(M.exampleIssues(real('brief', { body: '<h2>Onze aanpak</h2><p>Eigen tekst.</p>' })), []);
});

test('exampleIssues: [invulplekken] in elk veld dat bij het soort hoort', () => {
  const issues = M.exampleIssues(real('brief', { title: 'Offerte voor [klant]', reference: '[nummer]', body: '<p>Hallo [voornaam], leuk.</p>', signRole: '[functie]' }));
  assert.deepEqual(keys(issues), ['title', 'reference', 'body', 'signRole']);
  assert.equal(issues[2].found, '[voornaam]');
  // Memo-velden alleen bij een memo; een kenmerk niet bij een offerte
  assert.deepEqual(keys(M.exampleIssues(real('memo', { memoTo: '[team]', reference: '[x]' }))), ['memoTo']);
  assert.deepEqual(keys(M.exampleIssues(real('offerte', { items: [{ desc: 'Uren [aantal]', qty: 1, price: 1 }] }))), ['items']);
});

test('exampleIssues: geen valse meldingen', () => {
  // Blokhaken zonder woord, een uitgezette ondertekening, voorbeeldregel met een andere prijs
  assert.deepEqual(M.exampleIssues(real('brief', { body: '<p>Zie bijlage [1] en [2].</p>' })), []);
  assert.deepEqual(M.exampleIssues(real('brief', { showSignature: false, signName: '[naam]' })), []);
  assert.deepEqual(M.exampleIssues(real('offerte', { items: [{ desc: 'Strategiesessie en analyse', qty: 1, price: 1200 }] })), []);
  assert.deepEqual(M.exampleIssues(null), []);
});

test('listNames: "aanhef, adres en tekst"', () => {
  assert.equal(M.listNames(['aanhef']), 'aanhef');
  assert.equal(M.listNames(['aanhef', 'adres']), 'aanhef en adres');
  assert.equal(M.listNames(['titel', 'aanhef', 'adres']), 'titel, aanhef en adres');
  assert.equal(M.listNames([]), '');
});

test('htmlText: tekst uit de editor, met spaties tussen blokken', () => {
  assert.equal(M.htmlText('<p>Een</p><ul><li>twee &amp; <strong>drie</strong></li></ul><p>vier&nbsp;vijf</p>'), 'Een twee & drie vier vijf');
});

test('help.js: elke [?] en elk rondleidingsdoel in de HTML heeft een tekst, en andersom', () => {
  const html = read('tools/document.html');
  const js = read('js/document/help.js');
  const sandbox = {};
  new Function('window', js)(sandbox);
  const data = sandbox.PM_HELP.document;
  const helpKeys = Array.from(html.matchAll(/data-help="([^"]+)"/g), (m) => m[1]);
  for (const key of helpKeys) assert.ok(data.help[key], `PM_HELP.document.help.${key}`);
  for (const key of Object.keys(data.help)) assert.ok(helpKeys.includes(key), `data-help="${key}" in tools/document.html`);
  const tourTargets = new Set(Array.from(html.matchAll(/data-tour="([^"]+)"/g), (m) => m[1]));
  for (const step of data.tour) if (step.target) assert.ok(tourTargets.has(step.target), `data-tour="${step.target}"`);
  const railIds = Array.from(html.matchAll(/class="rail__item" data-section="([^"]+)"/g), (m) => m[1]);
  assert.deepEqual(railIds, data.sections.map((s) => s.id), 'rail in de volgorde van sections');
});
