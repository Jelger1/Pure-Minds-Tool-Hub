/* =============================================================================
   build-icon-data.js — genereert js/icons/icon-data.js en icon-fill-data.js
   -----------------------------------------------------------------------------
   Leest alle Remix-iconen in assets/icons/<Categorie>/*.svg en zet ze in één
   bestand: per icoon de naam, de categorie en het pad (de "d"). Zo laadt de
   Icon Finder alles in één keer, ook als de tool direct vanaf schijf
   (file://) wordt geopend.

   - De lijnstijl: naam-line.svg wordt icoon "naam"; een icoon in één stijl
     (zoals bold.svg) doet ook mee. Een naam-fill.svg in een categoriemap
     wordt overgeslagen (en gemeld): de volle stijl hoort in Vol/.
   - De volle stijl, assets/icons/Vol/<Categorie>/naam-fill.svg, gaat naar een
     eigen bestand, js/icons/icon-fill-data.js: alleen de witte zeshoek met
     uitgesneden icoon gebruikt hem, en de Icon Finder laadt hem pas als
     iemand die kiest. Elke naam-fill.svg moet een naam-line.svg in dezelfde
     categorie hebben.
   - Uit assets/icons/uitsnijpaden.json (van maak-zeshoeken.py) komen paden
     zonder overlap voor de witte zeshoek met uitgesneden icoon, voor de paar
     iconen waarbij fill-rule evenodd anders uitpakt dan de gewone vulling:
     naam-fill.svg vervangt het pad in icon-fill-data.js, een icoon zonder
     volle stijl komt in knockout in icon-data.js.
   - Elk bestand moet precies één pad op een 24-raster zijn, met alleen de
     absolute commando's M, L, H, V, C en Z (zoals Remix ze schrijft). Wat
     daar niet aan voldoet, wordt gemeld en overgeslagen.
   - Getallen worden afgerond op 3 decimalen (hoogstens 0,0005 op het
     24-raster: op 1000 px nog 0,02 pixel), zonder nullen aan het eind.
     De 0 vóór de punt blijft staan ('0.5', niet '.5'): het pad komt letterlijk
     in de losse SVG-download, en zo leest elk programma het.
   - De map Zeshoek (uitvoer van maak-zeshoeken.py) en alles wat met
     . of _ begint, worden overgeslagen.

   De volgorde is vast (op codepunt, zoals sorted() in Python), dus dezelfde
   iconen geven altijd precies hetzelfde bestand, op Windows en Linux.

   Nieuwe iconen toegevoegd:  npm run icons
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const bron = path.join(root, 'assets', 'icons');
const doel = path.join(root, 'js', 'icons', 'icon-data.js');
const doelVol = path.join(root, 'js', 'icons', 'icon-fill-data.js');
const volBron = path.join(bron, 'Vol');
const uitsnijBron = path.join(bron, 'uitsnijpaden.json');
const GEEN_CATEGORIE = ['Zeshoek', 'Los', 'Vol'];   // uitvoer van maak-zeshoeken.py, en de volle stijl

const AANTAL = { M: 2, L: 2, H: 1, V: 1, C: 6, Z: 0 };

// Zoals sorted() in Python: op codepunt, los van taal- en systeeminstellingen
function opCodepunt(a, b) {
  const x = Array.from(a, (c) => c.codePointAt(0));
  const y = Array.from(b, (c) => c.codePointAt(0));
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

const zichtbaar = (naam) => !naam.startsWith('.') && !naam.startsWith('_');

// Afronden op 3 decimalen: '3.44772' -> '3.448', '20.0000' -> '20', '-0.0001' -> '0'
function rond(v) {
  return String(Math.round(v * 1000) / 1000 + 0);   // + 0 maakt van -0 een 0
}

/* ---------------------------------------------------------------------------
   Eén SVG-bestand lezen en controleren; geeft het afgeronde pad of een fout
   ------------------------------------------------------------------------- */

function leesPad(tekst) {
  if (!tekst.includes('viewBox="0 0 24 24"')) return { fout: 'geen viewBox="0 0 24 24"' };
  const paden = tekst.match(/\sd="[^"]*"/g) || [];
  const elementen = tekst.match(/<(path|circle|ellipse|line|polyline|polygon|rect|use|image|text)\b/g) || [];
  if (paden.length !== 1 || elementen.length !== 1 || elementen[0] !== '<path') {
    return { fout: 'verwacht precies één pad' };
  }
  if (/\s(transform|fill-rule|clip-rule|stroke[a-z-]*)=/.test(tekst)) {
    return { fout: 'transform, fill-rule of stroke wordt niet ondersteund' };
  }

  return normaliseer(paden[0].slice(4, -1));
}

// Pad controleren en afronden; geeft { d } of { fout }
function normaliseer(d) {
  // Het hele pad moet uit commando's, getallen en scheidingstekens bestaan
  const tokens = d.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?|[^\s,]/g) || [];
  const stukken = [];
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      if (!(t in AANTAL)) return { fout: `commando ${t} wordt niet ondersteund (alleen absolute M, L, H, V, C, Z)` };
      stukken.push([t, []]);
    } else if (/[eE]/.test(t) || !/\d/.test(t)) {
      return { fout: `onverwacht teken of getal '${t}' in het pad` };
    } else if (!stukken.length) {
      return { fout: 'pad begint niet met een commando' };
    } else {
      stukken[stukken.length - 1][1].push(Number(t));
    }
  }
  if (!stukken.length || stukken[0][0] !== 'M') return { fout: 'pad begint niet met M' };

  // Eén commando per stap, afgerond; herhaalde getallen na M zijn lijnstukken
  let uit = '';
  for (const [cmd, getallen] of stukken) {
    const n = AANTAL[cmd];
    if (cmd === 'Z') {
      if (getallen.length) return { fout: 'getallen na Z' };
      uit += 'Z';
      continue;
    }
    if (!getallen.length || getallen.length % n) return { fout: `verkeerd aantal getallen na ${cmd}` };
    for (let i = 0; i < getallen.length; i += n) {
      uit += (cmd === 'M' && i > 0 ? 'L' : cmd) + getallen.slice(i, i + n).map(rond).join(' ');
    }
  }
  return { d: uit };
}

/* ---------------------------------------------------------------------------
   Alle categorieën en iconen
   ------------------------------------------------------------------------- */

const categorieen = fs.readdirSync(bron, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !GEEN_CATEGORIE.includes(e.name) && zichtbaar(e.name))
  .map((e) => e.name)
  .sort(opCodepunt);

const iconen = [];      // [naam, categorie-index, pad] of [naam, categorie-index, pad, 1] (uit naam-line.svg)
const overgeslagen = [];
const dubbel = [];
let bestanden = 0;
let vol = 0;

for (const categorie of categorieen) {
  const map = path.join(bron, categorie);
  const namen = fs.readdirSync(map, { withFileTypes: true })
    .filter((e) => e.isFile() && zichtbaar(e.name) && e.name.toLowerCase().endsWith('.svg'))
    .map((e) => e.name)
    .sort(opCodepunt);

  const perNaam = new Map();   // naam -> { line, los }
  for (const bestand of namen) {
    if (bestand.endsWith('-fill.svg')) {   // volle stijl: hoort in Vol/
      vol++;
      continue;
    }
    const { d, fout } = leesPad(fs.readFileSync(path.join(map, bestand), 'utf8'));
    if (fout) {
      overgeslagen.push(`${categorie}/${bestand}: ${fout}`);
      continue;
    }
    bestanden++;
    const basis = bestand.slice(0, -4);
    const lijn = basis.endsWith('-line');
    const naam = lijn ? basis.slice(0, -5) : basis;
    const icoon = perNaam.get(naam) || {};
    icoon[lijn ? 'line' : 'los'] = d;
    perNaam.set(naam, icoon);
  }

  const index = categorieen.indexOf(categorie);
  for (const naam of [...perNaam.keys()].sort(opCodepunt)) {
    const { line, los } = perNaam.get(naam);
    // Een los icoon naast een -line met dezelfde naam: allebei houden
    if (los !== undefined) iconen.push([naam, index, los]);
    if (line !== undefined) iconen.push([naam, index, line, 1]);
    if (los !== undefined && line !== undefined) dubbel.push(`${categorie}/${naam}`);
  }
}

// Het lijnicoon (naam-line.svg) bij een sleutel 'Categorie/naam'
const lijnicoon = (sleutel) => {
  const [categorie, naam] = sleutel.split('/');
  return iconen.find((ic) => ic[3] === 1 && ic[0] === naam && categorieen[ic[1]] === categorie);
};

// De volle stijl, per 'Categorie/naam': alleen voor de witte zeshoek met uitgesneden icoon
const volPaden = new Map();
if (fs.existsSync(volBron)) {
  const mappen = fs.readdirSync(volBron, { withFileTypes: true })
    .filter((e) => e.isDirectory() && zichtbaar(e.name)).map((e) => e.name).sort(opCodepunt);
  for (const categorie of mappen) {
    const namen = fs.readdirSync(path.join(volBron, categorie), { withFileTypes: true })
      .filter((e) => e.isFile() && zichtbaar(e.name) && e.name.toLowerCase().endsWith('.svg'))
      .map((e) => e.name).sort(opCodepunt);
    for (const bestand of namen) {
      const sleutel = `${categorie}/${bestand.replace(/-fill\.svg$/, '')}`;
      let fout = !bestand.endsWith('-fill.svg') ? 'alleen naam-fill.svg hoort in Vol/'
        : !lijnicoon(sleutel) ? `geen ${sleutel}-line.svg` : '';
      let d;
      if (!fout) ({ d, fout } = leesPad(fs.readFileSync(path.join(volBron, categorie, bestand), 'utf8')));
      if (fout) overgeslagen.push(`Vol/${categorie}/${bestand}: ${fout}`);
      else volPaden.set(sleutel, d);
    }
  }
}

// Paden zonder overlap om uit te sparen (uitsnijpaden.json): bij de volle stijl vervangen ze
// het pad in icon-fill-data.js, voor een icoon zonder volle stijl komen ze in knockout
const uitsnij = {};
if (fs.existsSync(uitsnijBron)) {
  for (const [bestand, pad] of Object.entries(JSON.parse(fs.readFileSync(uitsnijBron, 'utf8')))) {
    if (bestand.startsWith('_')) continue;   // _uitleg
    const sleutel = bestand.replace(/(-line|-fill)?\.svg$/, '');
    const [categorie, naam] = sleutel.split('/');
    const { d, fout } = normaliseer(pad);
    const vol = bestand.endsWith('-fill.svg');
    const bestaat = vol ? volPaden.has(sleutel)
      : iconen.some((ic) => ic[0] === naam && categorieen[ic[1]] === categorie) && !volPaden.has(sleutel);
    if (fout || !bestaat) overgeslagen.push(`uitsnijpaden.json, ${bestand}: ${fout || (vol ? 'geen volle stijl in Vol/' : 'icoon bestaat niet of heeft een volle stijl')}`);
    else if (vol) volPaden.set(sleutel, d);
    else uitsnij[sleutel] = d;
  }
}

// In de volgorde van icon-data.js; een lijnicoon zonder volle stijl wordt gemeld
const volle = [];
const zonderVol = [];
for (const ic of iconen) {
  if (ic[3] !== 1) continue;
  const sleutel = `${categorieen[ic[1]]}/${ic[0]}`;
  if (volPaden.has(sleutel)) volle.push([sleutel, volPaden.get(sleutel)]);
  else zonderVol.push(sleutel);
}

/* ---------------------------------------------------------------------------
   Schrijven
   ------------------------------------------------------------------------- */

// Tekst tussen enkele aanhalingstekens, veilig voor elke bestandsnaam
const str = (s) => "'" + s.replace(/[\\'\u0000-\u001f\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + "'";
// Regels 'sleutel': 'pad', elk met een komma en een regeleinde; niets bij een lege lijst
const regels = (paren, inspring) => paren.map(([k, d]) => `${inspring}${str(k)}: ${str(d)},\n`).join('');

const js = `/* Gegenereerd door scripts/build-icon-data.js. Niet met de hand wijzigen:
   voeg iconen toe in assets/icons/<categorie>/ en draai \`npm run icons\`.
   Per icoon: [naam, categorie-index, pad van naam-line.svg, 1], of
   [naam, categorie-index, pad] voor een icoon in één stijl (naam.svg).
   knockout: per 'Categorie/naam' een pad zonder overlap, voor een icoon zonder
   volle stijl in de witte zeshoek (uit assets/icons/uitsnijpaden.json). De
   volle stijl zelf staat in icon-fill-data.js.
   Paden op het 24-raster van Remix, alleen absolute M, L, H, V, C en Z. */
window.PM_ICON_DATA = {
  categories: [${categorieen.map(str).join(', ')}],
  icons: [
${iconen.map((icoon) => `    [${icoon.map((v) => (typeof v === 'number' ? v : str(v))).join(', ')}],`).join('\n')}
  ],
  knockout: {
${regels(Object.entries(uitsnij), '    ')}  },
};
`;

const volJs = `/* Gegenereerd door scripts/build-icon-data.js. Niet met de hand wijzigen:
   zet de volle stijl in assets/icons/Vol/<categorie>/ en draai \`npm run icons\`.
   Alleen voor de witte zeshoek met uitgesneden icoon; js/icons/app.js laadt dit
   bestand pas als iemand die kiest. Per 'Categorie/naam' (zoals in PM_ICON_DATA)
   het pad van naam-fill.svg, bij overlap samengevoegd (uitsnijpaden.json). Geen
   sleutel: het icoon heeft geen volle stijl en wordt uitgesneden zoals het is.
   Paden op het 24-raster van Remix, alleen absolute M, L, H, V, C en Z. */
window.PM_ICON_FILL = {
${regels(volle, '  ')}};
`;

fs.mkdirSync(path.dirname(doel), { recursive: true });
fs.writeFileSync(doel, js);
fs.writeFileSync(doelVol, volJs);

const grootte = (n) => `${Math.round(n / 1024)} KB (${n} bytes)`;
const meet = (tekst) => `${grootte(Buffer.byteLength(tekst))}, gzip ${grootte(zlib.gzipSync(Buffer.from(tekst)).length)}`;   // gzip: zoals een webserver hem meestal verstuurt
console.log(`icon-data.js geschreven: ${iconen.length} iconen uit ${bestanden} bestanden, ${categorieen.length} categorieën, ` +
  `${Object.keys(uitsnij).length} uitsnijpaden`);
console.log(meet(js));
console.log(`icon-fill-data.js geschreven: ${volle.length} iconen in de volle stijl (alleen voor de witte zeshoek), ${meet(volJs)}`);
if (zonderVol.length) console.log(`Let op: ${zonderVol.length} lijniconen zonder volle stijl in Vol/ (worden in lijnstijl uitgesneden): ${zonderVol.join(', ')}`);
if (vol) console.log(`${vol} bestanden in de volle stijl (-fill) in een categoriemap overgeslagen: die horen in Vol/`);
for (const d of dubbel) console.log(`Let op: ${d} bestaat zowel los als met -line`);
for (const o of overgeslagen) console.log('Overgeslagen:', o);
