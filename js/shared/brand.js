/* =============================================================================
   brand.js — de huisstijl als gegevens, plus controles met een duidelijke uitleg
   -----------------------------------------------------------------------------
   Eén bron voor JavaScript: kleuren, typeschaal, marges, de veilige zone van
   een story en de exportmaten. De waarden zijn gelijk aan css/global.css,
   js/shared/canvas-kit.js en de templates; tests/brand.test.js bewaakt dat.

     PM.brand.COLORS             merkkleuren (gelijk aan de CSS-variabelen)
     PM.brand.SIZES              typeschaal voor de knop "grootte": klein, normaal, groot
     PM.brand.sizeFor(px, stap)  korpsgrootte voor een stap uit de schaal
     PM.brand.exportSize(f, w)   { w, h } van een post op een exportbreedte
     PM.brand.photoCheck(...)    is de foto groot genoeg voor deze export?
     PM.brand.textFit(...)       uitleg als een tekst kleiner is gemaakt om te passen
     PM.brand.safeZone(f, w)     de balken van Instagram in een story

   Geen DOM: dit bestand laadt ook in Node (voor de tests).
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Kleuren: css/global.css (:root) en canvas-kit.js (COLORS)
     ------------------------------------------------------------------------- */

  const COLORS = Object.freeze({
    cyan: '#1ab9e2',          // Pure Cyaan: accenten, focus, actieve staat
    tint: '#e8f7fc',
    soft: '#f2fbfe',
    blue: '#1b71a8',
    deep: '#005aaf',
    magenta: '#b61b50',       // Pure Magenta: alleen de hoofdactie
    magentaDark: '#9c1644',
    green: '#009670',
    ink: '#303030',           // Inkt: tekst en donkere vlakken
    muted: '#5c6670',
    line: '#e1e7ec',
    border: '#d5dee5',
    canvas: '#edf3f7',
    zebra: '#f7fafc',
    track: '#eef2f5',
    hexline: '#90a4b4',       // lijnen van het zeshoekpatroon
    navy: '#10283c',          // donkere ondertoon voor verlopen over foto's
  });

  const FONT = '"Pure Minds Sans", "Open Sans", Arial, sans-serif';

  /* ---------------------------------------------------------------------------
     Typeschaal: geen vrije puntgroottes, alleen stappen die bij het merk passen
     ------------------------------------------------------------------------- */

  const SIZES = Object.freeze([
    Object.freeze({ id: 'klein', label: 'klein', factor: 0.85 }),
    Object.freeze({ id: 'normaal', label: 'normaal', factor: 1 }),
    Object.freeze({ id: 'groot', label: 'groot', factor: 1.15 }),
  ]);

  const sizeStep = (id) => SIZES.find((s) => s.id === id) || SIZES[1];

  // Korpsgrootte voor een stap, op even pixels (fitText in canvas-kit verkleint in stappen van 2)
  function sizeFor(base, id) {
    return Math.round((Number(base) * sizeStep(id).factor) / 2) * 2;
  }

  // Typografie per soort ontwerp (ontwerp-px), zoals in de templates
  const TYPE = Object.freeze({
    post: Object.freeze({
      title: Object.freeze({ size: 80, min: 44, weight: 800 }),
      body: Object.freeze({ size: 34, min: 24, weight: 400 }),
      label: Object.freeze({ size: 24, weight: 700 }),
    }),
    slide: Object.freeze({
      label: Object.freeze({ size: 30, weight: 700 }),
      footer: Object.freeze({ size: 26, weight: 700 }),
    }),
  });

  /* ---------------------------------------------------------------------------
     Raster en formaten
     ------------------------------------------------------------------------- */

  const POST = Object.freeze({
    width: 1080,              // ontwerpraster; exporteren schaalt alleen
    margin: 88,
    bar: 12,
    storySafe: 250,           // boven en onder in een story zit de Instagram-interface
    formats: Object.freeze({
      portrait: Object.freeze({ w: 1080, h: 1350, ratio: '4:5', label: 'portret' }),
      story: Object.freeze({ w: 1080, h: 1920, ratio: '9:16', label: 'story' }),
    }),
  });

  const SLIDE = Object.freeze({ w: 1920, h: 1080, margin: 128, vmargin: 104, bar: 16 });

  const A4 = Object.freeze({ w: 794, h: 1123, mmW: 210, mmH: 297 });  // 96 dpi, zoals de preview

  // Exportbreedtes met de naam die de gebruiker ziet
  const EXPORT = Object.freeze({
    post: Object.freeze([
      Object.freeze({ id: 'instagram', width: 1080, label: 'Instagram' }),
      Object.freeze({ id: 'linkedin', width: 1200, label: 'LinkedIn' }),
      Object.freeze({ id: 'scherp', width: 2160, label: 'extra scherp' }),
    ]),
    slide: Object.freeze([
      Object.freeze({ id: 'hd', width: 1920, label: 'Full HD' }),
      Object.freeze({ id: '4k', width: 3840, label: '4K' }),
    ]),
  });

  function exportSize(format, width = POST.width) {
    const f = POST.formats[format] || POST.formats.portrait;
    const w = Number(width) || POST.width;
    return { w, h: Math.round((f.h * w) / f.w) };
  }

  /* ---------------------------------------------------------------------------
     Controles. Altijd { ok, level, message }: level is 'ok', 'let-op' of een
     eigen woord voor het probleem; message is een zin voor de gebruiker (leeg
     als alles goed is).
     ------------------------------------------------------------------------- */

  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /**
   * Is een foto groot genoeg? De foto vult het vak (zoals object-fit: cover),
   * eventueel ingezoomd; exportScale = exportbreedte / ontwerpbreedte
   * (1200 / 1080 voor LinkedIn). Tot 1,25× vergroten zie je niet, tot 2× wordt
   * het zacht, daarboven onscherp.
   */
  function photoCheck(imgW, imgH, boxW, boxH, exportScale = 1, { zoom = 1 } = {}) {
    const iw = Number(imgW);
    const ih = Number(imgH);
    const bw = Number(boxW);
    const bh = Number(boxH);
    if (!(iw > 0 && ih > 0 && bw > 0 && bh > 0)) return { ok: true, level: 'ok', message: '', factor: 0, need: null };
    const scale = (Number(exportScale) > 0 ? Number(exportScale) : 1) * Math.max(1, Number(zoom) || 1);
    const factor = Math.max(bw / iw, bh / ih) * scale;
    // De foto op de maat waarop hij in de export komt: zo groot moet het origineel minstens zijn
    const need = { w: Math.ceil(iw * factor), h: Math.ceil(ih * factor) };
    const have = `${fmt(iw)} × ${fmt(ih)} px`;
    const want = `${fmt(need.w)} × ${fmt(need.h)} px`;
    if (factor <= 1.25) return { ok: true, level: 'ok', message: '', factor, need };
    if (factor <= 2) {
      return {
        ok: false, level: 'let-op', factor, need,
        message: `Deze foto (${have}) wordt ${factor.toFixed(1).replace('.', ',')}× vergroot en kan iets zacht worden. Scherp is vanaf ${want}.`,
      };
    }
    return {
      ok: false, level: 'te-klein', factor, need,
      message: `Deze foto (${have}) is te klein voor deze export en wordt onscherp. Kies een foto van minstens ${want}${zoom > 1 ? ', of zoom minder in' : ''}.`,
    };
  }

  /**
   * Uitleg bij het passend maken van tekst (fitText in canvas-kit.js).
   * size = gebruikte korpsgrootte, base = de bedoelde, overflow = past zelfs
   * op de kleinste maat niet. name = hoe het veld heet ("de kop").
   */
  function textFit({ size, base, overflow = false, name = 'de tekst' } = {}) {
    const Name = name.charAt(0).toUpperCase() + name.slice(1);
    if (overflow) {
      return { ok: false, level: 'te-lang', message: `${Name} is te lang voor dit vak en is zo klein mogelijk gemaakt. Kort hem in voor een rustiger ontwerp.` };
    }
    const s = Number(size);
    const b = Number(base);
    if (s > 0 && b > 0 && s < b * 0.8) {
      return { ok: true, level: 'let-op', message: `${Name} is kleiner gemaakt om te passen (${Math.round(s)} in plaats van ${Math.round(b)} px). Korter oogt rustiger.` };
    }
    return { ok: true, level: 'ok', message: '' };
  }

  /**
   * Veilige zone van een story: boven en onder dekt Instagram het beeld af met
   * naam, knoppen en de reactiebalk. Maten in px op de gevraagde breedte.
   */
  function safeZone(format, width = POST.width) {
    const f = POST.formats[format] || POST.formats.portrait;
    const k = (Number(width) || POST.width) / f.w;
    const size = { w: Math.round(f.w * k), h: Math.round(f.h * k) };
    if (format !== 'story') return { active: false, top: 0, bottom: 0, ...size, message: '' };
    const band = Math.round(POST.storySafe * k);
    return {
      active: true, top: band, bottom: band, ...size,
      rects: [{ x: 0, y: 0, w: size.w, h: band }, { x: 0, y: size.h - band, w: size.w, h: band }],
      message: `Story: label en logo blijven buiten de balken van Instagram (${band} px boven en onder).`,
    };
  }

  const brand = {
    COLORS, FONT, SIZES, TYPE, POST, SLIDE, A4, EXPORT,
    sizeStep, sizeFor, exportSize, photoCheck, textFit, safeZone,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = brand;
  if (global && global.document) (global.PM = global.PM || {}).brand = brand;
})(typeof window !== 'undefined' ? window : globalThis);
