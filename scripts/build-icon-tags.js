/* =============================================================================
   build-icon-tags.js — genereert js/icons/icon-tags.js (zoekwoorden per icoon)
   -----------------------------------------------------------------------------
   De Icon Finder (tools/icons.html) zoekt in de Engelse namen van Remix Icon.
   Onze gebruikers typen vooral Nederlands ("prullenbak", "tandwiel"), dus
   krijgt elk icoon extra zoekwoorden:

     1. Nederlands voor de naam, uit scripts/icon-words/nl.json:
        eerst vaste combinaties (delete-bin -> prullenbak ...), dan de losse
        woorden (arrow -> pijl, right -> rechts). In "namen" staat een
        vertaling voor een hele naam (merken met gewone woorden erin).
     2. De Engelse tags van Remix Icon, uit scripts/icon-words/remix-tags.json.
        Bron: https://raw.githubusercontent.com/Remix-Design/RemixIcon/master/tags.json
        (Apache-2.0), eenmalig opgehaald op 2026-09-28; Chinese tags en
        iconen die niet in assets/icons staan zijn eruit gehaald.
     3. Nederlands voor die tags. Eerst "tagwoorden": de betekenis die een
        woord als tag heeft (tag "watch" op de oog-iconen = kijken). Woorden
        met meer betekenissen staan in "nietInTags" en worden in tags niet
        vertaald (tag "pen" op de usb-stick is geen pen).

   Uitvoer per icoon: 'nederlandse naam  extra woorden'. De dubbele spatie
   scheidt de twee delen: js/icons/search.js laat de Nederlandse naam even
   zwaar tellen als de Engelse naam, de extra woorden minder. Woorden achter
   een '|' in nl.json komen bij de extra woorden. Woorden die al in de naam
   staan, worden niet herhaald.

   Pas je nl.json aan of komen er iconen bij, draai dan:  npm run icons
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const iconDir = path.join(root, 'assets', 'icons');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, 'icon-words', file), 'utf8'));

const nl = readJson('nl.json');
const remixTags = readJson('remix-tags.json');

const woorden = nl.woorden || {};
const tagwoorden = nl.tagwoorden || {};
const combinaties = nl.combinaties || {};
const namen = nl.namen || {};
const nietInTags = new Set(nl.nietInTags || []);
const overgeslagen = new Set(nl.overgeslagen || []);

// Vulwoorden uit vertalingen als "mes en vork" en "tegen de klok in"
const STOPWORDS = new Set(['de', 'het', 'een', 'en', 'van', 'met', 'naar', 'in', 'op', 'te', 'of', 'is',
  'voor', 'the', 'a', 'an', 'and', 'to', 'for', 'with', 'on']);

// --- Iconen: dezelfde groepering als icon-data.js (zonder -line/-fill) ------

const names = new Set();
for (const entry of fs.readdirSync(iconDir, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'Zeshoek') continue;
  for (const file of fs.readdirSync(path.join(iconDir, entry.name))) {
    if (file.endsWith('.svg')) names.add(file.slice(0, -4).replace(/-(line|fill)$/, ''));
  }
}
const iconNames = [...names].sort();

// --- Hulpfuncties -------------------------------------------------------------

// Vergelijkingsvorm: kleine letters, zonder accenten en leestekens (kopiëren = kopieren)
const key = (word) => word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Tekst uit nl.json -> [sterke woorden, zwakke woorden] (zwak = achter de '|')
function parseValue(value) {
  const [strong, weak = ''] = String(value).split('|');
  const list = (text) => text.toLowerCase().split(/\s+/).filter(Boolean);
  return [list(strong), list(weak)];
}

/**
 * Woordenreeks (Engels) -> Nederlandse woorden. Eerst de langste combinatie
 * vanaf elke positie, anders het losse woord. forTags (een Remix-tag):
 *   - tagwoorden gaan voor: daar staat de betekenis die het woord als tag
 *     heeft (tag "watch" op de oog-iconen = kijken, niet horloge);
 *   - woorden uit nietInTags (meer betekenissen, geen tagwoord) blijven weg;
 *   - anders alleen de hoofdvertaling uit woorden (tag "building" -> gebouw,
 *     niet ook kantoor): tags zijn bijzaak, zo blijft de ruis klein.
 */
function translate(tokens, forTags) {
  const strong = [];
  const weak = [];
  const push = (value, main) => {
    const [s, w] = parseValue(value);
    if (main) { strong.push(...s.filter((word) => !STOPWORDS.has(word)).slice(0, 1)); return; }
    strong.push(...s);
    weak.push(...w);
  };
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  let i = 0;
  while (i < tokens.length) {
    let used = 0;
    for (let len = tokens.length - i; len >= 2; len--) {
      const combo = tokens.slice(i, i + len).join('-');
      if (has(combinaties, combo)) { push(combinaties[combo]); used = len; break; }
    }
    if (used) { i += used; continue; }
    const token = tokens[i];
    i++;
    if (/^\d+$/.test(token)) continue;
    if (forTags && has(tagwoorden, token)) push(tagwoorden[token]);
    else if (forTags && nietInTags.has(token)) continue;
    else if (has(woorden, token)) push(woorden[token], forTags);
  }
  return [strong, weak];
}

// Losse woorden van een Remix-tag ("coffee cup" -> coffee, cup; "24/7" -> 24, 7)
const tagTokens = (tag) => tag.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Woorden opschonen: geen dubbelingen, niets uit de naam, geen vulwoorden of losse letters
function clean(list, taken) {
  const out = [];
  for (const raw of list) {
    const word = raw.replace(/[^\p{L}\p{N}'-]+/gu, '').replace(/^[-']+|[-']+$/g, '');
    const k = key(word);
    if (!k || k.length < 2 || taken.has(k) || STOPWORDS.has(k)) continue;
    taken.add(k);
    out.push(word);
  }
  return out;
}

// --- Per icoon ------------------------------------------------------------------

const tags = {};
const usedTokens = new Set();

for (const name of iconNames) {
  const tokens = name.split('-');
  const taken = new Set(tokens.map(key));

  // 1. Nederlands voor de naam
  let strong;
  let weak;
  if (Object.prototype.hasOwnProperty.call(namen, name)) [strong, weak] = parseValue(namen[name]);
  else [strong, weak] = translate(tokens, false);
  tokens.forEach((t) => usedTokens.add(t));

  // 2 en 3. Remix-tags en hun Nederlands
  const english = [];
  const fromTags = [];
  for (const tag of String(remixTags[name] || '').split(',').filter(Boolean)) {
    const words = tagTokens(tag);
    english.push(...tag.toLowerCase().split(/[^\p{L}\p{N}'-]+/u));
    const [s, w] = translate(words, true);
    fromTags.push(...s, ...w);
  }

  const nlWords = clean(strong, taken);
  const extra = clean([...weak, ...fromTags, ...english], taken);
  const value = nlWords.join(' ') + (extra.length ? '  ' + extra.join(' ') : '');
  if (value) tags[name] = value;
}

// --- Controle: welke naamwoorden hebben geen vertaling? --------------------------

const covered = new Set([...Object.keys(woorden), ...overgeslagen]);
for (const combo of Object.keys(combinaties)) combo.split('-').forEach((t) => covered.add(t));
for (const name of Object.keys(namen)) name.split('-').forEach((t) => covered.add(t));
const missing = [...usedTokens].filter((t) => !covered.has(t) && !/^\d+$/.test(t)).sort();
if (missing.length) console.log(`Naamwoorden zonder vertaling (${missing.length}): ${missing.join(' ')}`);

// --- Schrijven ----------------------------------------------------------------------

const quote = (text) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const out = `/* Gegenereerd door scripts/build-icon-tags.js. Niet met de hand wijzigen:
   pas scripts/icon-words/nl.json aan en draai \`npm run icons\`.
   Per icoon: Nederlandse naam, dubbele spatie, extra zoekwoorden (Engels en Nederlands). */
window.PM_ICON_TAGS = {
${Object.keys(tags).map((name) => `  ${quote(name)}: ${quote(tags[name])},`).join('\n')}
};
`;
fs.mkdirSync(path.join(root, 'js', 'icons'), { recursive: true });
fs.writeFileSync(path.join(root, 'js', 'icons', 'icon-tags.js'), out);

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
console.log(`icon-tags.js geschreven: ${Object.keys(tags).length} iconen, ${kb(Buffer.byteLength(out))} (gzip ${kb(zlib.gzipSync(out).length)})`);
