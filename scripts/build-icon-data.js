/* =============================================================================
   build-icon-data.js — genereert js/icons/icon-data.js voor de Icon Finder
   -----------------------------------------------------------------------------
   Leest alle Remix-iconen in assets/icons/<Categorie>/*.svg en zet ze in één
   bestand: per icoon de naam, de categorie en het pad (de "d") van de
   lijn- en de vlakvariant. Zo laadt de Icon Finder alles in één keer, ook als
   de tool direct vanaf schijf (file://) wordt geopend.

   - naam-line.svg en naam-fill.svg worden één icoon; een icoon zonder
     -line/-fill (zoals bold.svg) heeft één pad.
   - Elk bestand moet precies één pad op een 24-raster zijn, met alleen de
     absolute commando's M, L, H, V, C en Z (zoals Remix ze schrijft). Wat
     daar niet aan voldoet, wordt gemeld en overgeslagen.
   - Getallen worden afgerond op 3 decimalen (hoogstens 0,0005 op het
     24-raster: op 1000 px nog 0,02 pixel), zonder nullen aan het eind.
     De 0 vóór de punt blijft staan ('0.5', niet '.5'): het pad komt letterlijk
     in de losse SVG-download, en zo leest elk programma het.
   - De map Zeshoek (oude uitvoer van maak-zeshoeken.py) en alles wat met
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

  const d = paden[0].slice(4, -1);
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
  .filter((e) => e.isDirectory() && e.name !== 'Zeshoek' && zichtbaar(e.name))
  .map((e) => e.name)
  .sort(opCodepunt);

const iconen = [];      // [naam, categorie-index, pad] of [naam, categorie-index, lijn, vlak]
const overgeslagen = [];
const dubbel = [];
let bestanden = 0;

for (const categorie of categorieen) {
  const map = path.join(bron, categorie);
  const namen = fs.readdirSync(map, { withFileTypes: true })
    .filter((e) => e.isFile() && zichtbaar(e.name) && e.name.toLowerCase().endsWith('.svg'))
    .map((e) => e.name)
    .sort(opCodepunt);

  const perNaam = new Map();   // naam -> { line, fill, los }
  for (const bestand of namen) {
    const { d, fout } = leesPad(fs.readFileSync(path.join(map, bestand), 'utf8'));
    if (fout) {
      overgeslagen.push(`${categorie}/${bestand}: ${fout}`);
      continue;
    }
    bestanden++;
    const basis = bestand.slice(0, -4);
    const stijl = /-(line|fill)$/.exec(basis);
    const naam = stijl ? basis.slice(0, -5) : basis;
    const icoon = perNaam.get(naam) || {};
    icoon[stijl ? stijl[1] : 'los'] = d;
    perNaam.set(naam, icoon);
  }

  const index = categorieen.indexOf(categorie);
  for (const naam of [...perNaam.keys()].sort(opCodepunt)) {
    const { line, fill, los } = perNaam.get(naam);
    // Een los icoon naast een lijn/vlak-paar met dezelfde naam: allebei houden
    if (los !== undefined) iconen.push([naam, index, los]);
    if (line !== undefined || fill !== undefined) iconen.push([naam, index, line || '', fill || '']);
    if (los !== undefined && (line !== undefined || fill !== undefined)) dubbel.push(`${categorie}/${naam}`);
  }
}

/* ---------------------------------------------------------------------------
   Schrijven
   ------------------------------------------------------------------------- */

// Tekst tussen enkele aanhalingstekens, veilig voor elke bestandsnaam
const str = (s) => "'" + s.replace(/[\\'\u0000-\u001f\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) + "'";

const js = `/* Gegenereerd door scripts/build-icon-data.js. Niet met de hand wijzigen:
   voeg iconen toe in assets/icons/<categorie>/ en draai \`npm run icons\`.
   Per icoon: [naam, categorie-index, pad van naam-line.svg, pad van naam-fill.svg]
   ('' als die stijl ontbreekt), of [naam, categorie-index, pad] zonder stijlen.
   Paden op het 24-raster van Remix, alleen absolute M, L, H, V, C en Z. */
window.PM_ICON_DATA = {
  categories: [${categorieen.map(str).join(', ')}],
  icons: [
${iconen.map((icoon) => `    [${icoon.map((v) => (typeof v === 'number' ? v : str(v))).join(', ')}],`).join('\n')}
  ],
};
`;

fs.mkdirSync(path.dirname(doel), { recursive: true });
fs.writeFileSync(doel, js);

const grootte = (n) => `${Math.round(n / 1024)} KB (${n} bytes)`;
const ruw = Buffer.byteLength(js);
const gzip = zlib.gzipSync(Buffer.from(js)).length;   // zoals een webserver hem meestal verstuurt
console.log(`icon-data.js geschreven: ${iconen.length} iconen uit ${bestanden} bestanden, ${categorieen.length} categorieën`);
console.log(`${grootte(ruw)}, gzip ${grootte(gzip)}`);
for (const d of dubbel) console.log(`Let op: ${d} bestaat zowel los als met -line/-fill`);
for (const o of overgeslagen) console.log('Overgeslagen:', o);
