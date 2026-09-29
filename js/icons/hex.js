/* =============================================================================
   hex.js — Remix-iconen in de Pure Minds-zeshoek (window.PMHex)
   -----------------------------------------------------------------------------
   Een exacte JavaScript-versie van de geometrie in assets/icons/maak-zeshoeken.py:
   dezelfde zeshoek (punt boven, afgeronde hoeken), dezelfde schaal en plaatsing
   van het icoon, dezelfde varianten en dezelfde notatie van getallen. Een
   zeshoek-SVG van PMHex.svg() is byte voor byte gelijk aan het bestand dat het
   Python-script schrijft (op de slotregel na). Verander je daar iets aan de
   maten, varianten of notatie, doe dat dan ook hier, en omgekeerd.

     PMHex.WIDTH, PMHex.HEIGHT   maat van de zeshoek in viewBox-eenheden
                                 (HEIGHT 64, WIDTH ≈ 56,474, niet afgerond)
     PMHex.presets               de drie huisstijlvarianten: blauw, donker, wit,
                                 elk een effen zeshoek met een effen icoon
     PMHex.svg(d, opts)          losse SVG: het kale icoon (24 × 24) of in de zeshoek
     PMHex.place(d)              { d, shrunk }: pad omgerekend naar de zeshoek;
                                 shrunk = iets verkleind voor de schuine randen.
                                 Gecachet per pad: opnieuw tekenen in een andere
                                 kleur rekent niets opnieuw uit.
     PMHex.gradientId(naam)      id van het verloop zoals het Python-script hem
                                 maakt: 'pm-' + bestandsnaam zonder vreemde tekens
     PMHex.parse(d)              [[commando, [getallen]], ...] (segmenten in Python)
     PMHex.num(v)                getal met hoogstens 3 decimalen (getal in Python)

   Opties van svg(d, opts):
     shape   'hex' of 'none' (standaard 'none')
     color   kleur van het icoon (standaard '#303030')
     fill    alleen zeshoek: kleur, of [boven, onder] voor een verticaal verloop
             (standaard '#ffffff')
     border  alleen zeshoek: [kleur, dikte in viewBox-eenheden], of niets
     id      id van het verloop (standaard 'pm-icoon'); maak hem uniek als er
             meerdere SVG's in dezelfde pagina staan
     height  hoogte in pixels voor width/height; de breedte volgt de verhouding.
             Standaard de viewBox (64 voor de zeshoek, 24 zonder). De viewBox
             zelf verandert nooit.

   De presets gebruiken alleen effen kleuren; geen enkele heeft nog een verloop
   of een rand. fill als [boven, onder], border en id blijven werken, net als
   in het Python-script, voor wie ze zelf meegeeft.

   Paden: alleen absolute M, L, H, V, C en Z, zoals Remix ze gebruikt.
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Instellingen (gelijk aan maak-zeshoeken.py)
     ------------------------------------------------------------------------- */

  const HOOGTE = 64;          // hoogte van de zeshoek (viewBox); breedte volgt uit de vorm
  const AFRONDING = 0.12;     // hoekradius als deel van de straal
  const ICOONBREEDTE = 0.54;  // het 20-eenheden-werkvlak van Remix t.o.v. de zeshoekbreedte
  const MAX_VULLING = 0.78;   // verste punt van een icoon, als deel van de afstand tot de rand

  // De varianten uit VARIANTEN in Python: effen zeshoek, geen verloop en geen rand
  const presets = bevries({
    blauw: { fill: '#1ab9e2', color: '#ffffff' },   // heet Blauw, is Pure Cyaan (zoals de map Zeshoek/Blauw)
    donker: { fill: '#303030', color: '#ffffff' },
    wit: { fill: '#ffffff', color: '#303030' },
  });

  /* ---------------------------------------------------------------------------
     Padbewerking
     ------------------------------------------------------------------------- */

  // Hetzelfde patroon als TOKEN in Python: een commando of een getal
  const TOKEN = /([MLHVCZ])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  const ONBEKEND = /(?![MLHVCZ])[A-Za-z]/;   // elke andere letter, ook een relatief commando
  const AANTAL = { M: 2, L: 2, H: 1, V: 1, C: 6, Z: 0 };
  const WORTEL3_2 = Math.sqrt(3) / 2;
  const GRADEN = Math.PI / 180;             // zoals math.radians()

  // Splitst een pad in losse [commando, getallen]-stappen, ook bij herhaalde getallen
  function segmenten(d) {
    if (ONBEKEND.test(d)) throw new Error('onbekend padcommando');
    const uit = [];
    let cmd = null;
    let buf = [];

    const leeg = () => {
      if (cmd === null || cmd === 'Z') return;
      const n = AANTAL[cmd];
      let c = cmd;
      for (let i = 0; i < buf.length; i += n) {
        // Python faalt hier later op (uitpakken van te weinig getallen); wij meteen
        if (i + n > buf.length) throw new Error('onvolledig padcommando');
        uit.push([c, buf.slice(i, i + n)]);
        if (c === 'M') c = 'L';   // extra coördinaten na M zijn lijnstukken
      }
    };

    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(d)) !== null) {
      if (m[1]) {
        leeg();
        cmd = m[1];
        buf = [];
        if (cmd === 'Z') uit.push(['Z', []]);
      } else {
        buf.push(Number(m[2]));
      }
    }
    leeg();
    return uit;
  }

  // Gewichten van een kubische bocht op 24 stappen, zoals punten() ze uitrekent.
  // u ** 3 (en niet u * u * u) omdat Python u**3 schrijft; dat scheelt soms 1 ulp.
  const STAPPEN = 24;
  const GEWICHTEN = [];
  for (let i = 1; i <= STAPPEN; i++) {
    const t = i / STAPPEN;
    const u = 1 - t;
    GEWICHTEN.push([u ** 3, 3 * u * u * t, 3 * u * t * t, t ** 3]);
  }

  // Afstand tot het midden gemeten in de vorm van een zeshoek met punt boven
  function zeshoekafstand(x, y) {
    x = Math.abs(x);
    y = Math.abs(y);
    return Math.max(x, 0.5 * x + WORTEL3_2 * y);
  }

  // Verste punt langs het pad (bochten bemonsterd), gemeten vanaf het midden van
  // het 24-raster. In Python: max(zeshoekafstand(x - 12, y - 12) for x, y in punten(d)).
  function verst(stappen) {
    let max = -Infinity;
    let x = 0, y = 0, sx = 0, sy = 0;
    const meet = (px, py) => {
      const a = zeshoekafstand(px - 12, py - 12);
      if (a > max) max = a;
    };
    for (const [c, a] of stappen) {
      if (c === 'M') {
        x = sx = a[0];
        y = sy = a[1];
      } else if (c === 'L') {
        x = a[0];
        y = a[1];
      } else if (c === 'H') {
        x = a[0];
      } else if (c === 'V') {
        y = a[0];
      } else if (c === 'C') {
        const [x1, y1, x2, y2, x3, y3] = a;
        for (const [w0, w1, w2, w3] of GEWICHTEN) {
          meet(w0 * x + w1 * x1 + w2 * x2 + w3 * x3, w0 * y + w1 * y1 + w2 * y2 + w3 * y3);
        }
        x = x3;
        y = y3;
      } else {
        x = sx;
        y = sy;
      }
      meet(x, y);
    }
    if (max === -Infinity) throw new Error('leeg pad');
    return max;
  }

  // Zoals getal() in Python: f'{v:.3f}' zonder nullen en punt aan het eind, '-0' wordt '0'.
  // Python rondt de exacte binaire waarde af, bij een exacte tie naar even; toFixed
  // kiest dan het grotere getal. Een exacte tie op 3 decimalen kan alleen bij een
  // oneven veelvoud van 1/16 (0,0625; 0,1875; ...), dus alleen daar rekenen we zelf.
  function getal(v) {
    const a = Math.abs(v);
    let s;
    if ((a * 16) % 2 === 1 && a < 1e9) {
      let n = Math.floor(a * 1000);   // exact: a * 1000 eindigt op ,5
      if (n % 2 === 1) n += 1;
      s = Math.floor(n / 1000) + '.' + String(n % 1000).padStart(3, '0');
    } else {
      s = a.toFixed(3);
    }
    if (v < 0) s = '-' + s;
    let eind = s.length;
    while (s.charCodeAt(eind - 1) === 48) eind--;        // '0'
    if (s.charCodeAt(eind - 1) === 46) eind--;           // '.'
    s = s.slice(0, eind);
    return s === '' || s === '-0' ? '0' : s;
  }

  // Schaalt en verplaatst een pad door de coördinaten zelf om te rekenen
  function verschuif(stappen, s, tx, ty) {
    let uit = '';
    for (const [c, a] of stappen) {
      if (c === 'M' || c === 'L') {
        uit += c + getal(a[0] * s + tx) + ' ' + getal(a[1] * s + ty);
      } else if (c === 'H') {
        uit += 'H' + getal(a[0] * s + tx);
      } else if (c === 'V') {
        uit += 'V' + getal(a[0] * s + ty);
      } else if (c === 'C') {
        uit += 'C' + getal(a[0] * s + tx) + ' ' + getal(a[1] * s + ty) + ' ' +
          getal(a[2] * s + tx) + ' ' + getal(a[3] * s + ty) + ' ' +
          getal(a[4] * s + tx) + ' ' + getal(a[5] * s + ty);
      } else {
        uit += 'Z';
      }
    }
    return uit;
  }

  /* ---------------------------------------------------------------------------
     Zeshoek
     ------------------------------------------------------------------------- */

  // Zeshoek met punt boven, straal R en hoekradius r, rond (mx, my)
  function zeshoekpad(mx, my, R, r) {
    const hoeken = [];
    for (let i = 0; i < 6; i++) {
      const hoek = (-90 + 60 * i) * GRADEN;
      hoeken.push([mx + R * Math.cos(hoek), my + R * Math.sin(hoek)]);
    }
    if (r <= 0) return 'M' + hoeken.map(([x, y]) => getal(x) + ' ' + getal(y)).join('L') + 'Z';

    const raak = r / Math.sqrt(3);   // afstand van hoekpunt tot begin van de boog (hoek 120°)
    const richting = (a, b) => {
      const lengte = Math.hypot(b[0] - a[0], b[1] - a[1]);   // math.dist
      return [a[0] + (b[0] - a[0]) * raak / lengte, a[1] + (b[1] - a[1]) * raak / lengte];
    };
    const voor = hoeken.map((h, i) => richting(h, hoeken[(i + 5) % 6]));
    const na = hoeken.map((h, i) => richting(h, hoeken[(i + 1) % 6]));
    let uit = 'M' + getal(na[0][0]) + ' ' + getal(na[0][1]);
    for (const i of [1, 2, 3, 4, 5, 0]) {
      uit += 'L' + getal(voor[i][0]) + ' ' + getal(voor[i][1]);
      uit += 'A' + getal(r) + ' ' + getal(r) + ' 0 0 1 ' + getal(na[i][0]) + ' ' + getal(na[i][1]);
    }
    return uit + 'Z';
  }

  // Maat en middelpunt van de zeshoek, precies passend in de viewBox. Een afgeronde
  // punt ligt iets binnen de scherpe punt; de straal wordt daarop vergroot.
  function zeshoek() {
    const R = (HOOGTE / 2) / (1 - (2 / Math.sqrt(3) - 1) * AFRONDING);
    const B = Math.sqrt(3) * R;
    return { breedte: B, mx: B / 2, my: HOOGTE / 2, R, r: AFRONDING * R, binnenstraal: B / 2 };
  }

  const VORM = zeshoek();
  const WIDTH = VORM.breedte;
  const HEIGHT = HOOGTE;

  // Rekent het icoon om naar de zeshoek (plaats_icoon in Python). Alle iconen krijgen
  // dezelfde schaal rond het midden van het 24-raster; alleen iconen die te dicht bij
  // de schuine randen komen, worden iets kleiner.
  const geplaatst = new Map();
  function place(d) {
    let uit = geplaatst.get(d);
    if (uit) return uit;
    const stappen = segmenten(d);
    let s = ICOONBREEDTE * VORM.breedte / 20;
    const grens = MAX_VULLING * VORM.binnenstraal;
    const ver = verst(stappen);
    const shrunk = ver * s > grens;
    if (shrunk) s = grens / ver;
    uit = { d: verschuif(stappen, s, VORM.mx - 12 * s, VORM.my - 12 * s), shrunk };
    geplaatst.set(d, uit);
    return uit;
  }

  // De zeshoekpaden per randdikte (vlakken in Python), één keer uitgerekend.
  // Met een rand: de buitenste zeshoek in de randkleur en een binnenste, evenwijdig
  // ingezet, zodat de rand overal even dik is (een stroke zou worden afgesneden).
  const achtergronden = new Map();
  function achtergrond(dikte) {
    let uit = achtergronden.get(dikte);
    if (uit) return uit;
    const { mx, my, R, r } = VORM;
    uit = dikte === null
      ? { rand: '', vlak: zeshoekpad(mx, my, R, r) }
      : { rand: zeshoekpad(mx, my, R, r), vlak: zeshoekpad(mx, my, R - dikte / WORTEL3_2, Math.max(r - dikte, 0)) };
    achtergronden.set(dikte, uit);
    return uit;
  }

  /* ---------------------------------------------------------------------------
     SVG (maak_svg in Python)
     ------------------------------------------------------------------------- */

  const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';
  const HEX_VIEWBOX = `viewBox="0 0 ${getal(WIDTH)} ${getal(HEIGHT)}"`;

  function svg(d, opts = {}) {
    const kleur = esc(opts.color || '#303030');
    const hoogte = opts.height > 0 ? opts.height : 0;

    if (opts.shape !== 'hex') {
      const h = hoogte ? getal(hoogte) : '24';
      return `<svg ${XMLNS} viewBox="0 0 24 24" width="${h}" height="${h}"><path fill="${kleur}" d="${esc(d)}"/></svg>`;
    }

    const icoon = place(d).d;
    const rand = Array.isArray(opts.border) ? opts.border : null;
    const bg = achtergrond(rand ? Number(rand[1]) : null);
    let defs = '';
    let vlak = opts.fill || '#ffffff';
    if (Array.isArray(vlak)) {
      const gid = esc(opts.id || 'pm-icoon');
      defs = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${esc(vlak[0])}"/><stop offset="1" stop-color="${esc(vlak[1])}"/>` +
        '</linearGradient></defs>';
      vlak = `url(#${gid})`;
    } else {
      vlak = esc(vlak);
    }
    const lagen = (rand ? `<path fill="${esc(rand[0])}" d="${bg.rand}"/>` : '') + `<path fill="${vlak}" d="${bg.vlak}"/>`;
    const b = getal(hoogte ? hoogte * WIDTH / HEIGHT : WIDTH);
    const h = getal(hoogte || HEIGHT);
    return `<svg ${XMLNS} ${HEX_VIEWBOX} width="${b}" height="${h}">${defs}${lagen}<path fill="${kleur}" d="${icoon}"/></svg>`;
  }

  // Zelfde id-regel als het Python-script: 'pm-' + naam in kleine letters, zonder vreemde tekens
  function gradientId(naam) {
    return 'pm-' + String(naam).toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  /* ---------------------------------------------------------------------------
     Hulpjes
     ------------------------------------------------------------------------- */

  // Attribuutwaarde veilig in de SVG; gewone kleuren en paden blijven ongewijzigd
  function esc(s) {
    s = String(s);
    return /[&<>"]/.test(s)
      ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      : s;
  }

  function bevries(o) {
    for (const v of Object.values(o)) if (v && typeof v === 'object') bevries(v);
    return Object.freeze(o);
  }

  const PMHex = { WIDTH, HEIGHT, presets, svg, place, gradientId, parse: segmenten, num: getal };
  global.PMHex = PMHex;
  if (typeof module !== 'undefined' && module.exports) module.exports = PMHex;
})(typeof window !== 'undefined' ? window : globalThis);
