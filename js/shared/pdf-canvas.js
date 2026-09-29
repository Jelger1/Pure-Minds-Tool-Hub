/* =============================================================================
   pdf-canvas.js — een "canvas" dat tekent in een PDF met losse, bewerkbare lagen
   -----------------------------------------------------------------------------
   De posts en slides worden getekend met canvas-opdrachten (canvas-kit.js).
   PMPdfCanvas biedt precies die opdrachten aan en maakt er losse PDF-objecten
   van, zo dat Canva (en Illustrator of Acrobat) elk onderdeel apart houdt:

     tekst      echte tekst in Open Sans, per regel en stijl één object, met de
                spaties erin. Meten doet de browser, net als in de preview: de
                regelval, lettergrootte en positie zijn dus exact gelijk
     vormen     vlakken en lijnen in een effen kleur als vector
     verlopen   elk verloop is één transparante afbeelding (PNG), getekend door
                de browser zelf: pixel voor pixel de preview, en in Canva één
                laag in plaats van honderden smalle banen
     foto's     vooraf uitgesneden tot wat je ziet; in een zeshoek als PNG met
                transparantie (Canva negeert uitknippaden in een PDF)
     logo's     SVG als vector; alle vormen van één kleur worden één pad, zodat
                het logo in Canva één element is (alleen als de browser
                bevestigt dat het er dan precies hetzelfde uitziet). Een SVG die
                svg2pdf niet aankan, gaat als afbeelding mee
     emoji      tekens die Open Sans niet heeft, als kleine afbeelding (jsPDF
                zou de rest van de tekst anders weglaten)
     kleuren    met vier decimalen (PM.pdfColor): merkcyaan blijft #1ab9e2

   Waarom zo: Canva slaat bij een PDF-import alles wat het niet als losse vorm
   herkent plat tot één afbeelding (en verloor daarbij tekst), telt maximaal
   1.400 elementen per bestand en herkent het lettergewicht aan de fontnaam
   (zie PM.pdfFonts in core.js).

   Gebruik, een hele PDF (Insta Post Maker, Presentation Maker):
     const { blob, elements } = await PMPdfCanvas.build({ width, height, pageWidth,
       count, draw: (canvas, i) => render(canvas, i), vectors, title, subject, progress });
   of per pagina in een eigen jsPDF-document:
     const ctx = new PMPdfCanvas(pdf, { width: 1080, height: 1350, pageWidth: 810, vectors });
     render(ctx.canvas, ...);   // dezelfde renderfunctie als voor de preview
     await ctx.flush();         // schrijft alles in volgorde naar de huidige pagina

   vectors: Map van Image -> SVG-tekst, voor afbeeldingen die vector blijven.
   rasterScale: pixels per ontwerp-px voor verlopen en foto's (standaard 2).
   jpegQuality: kwaliteit van foto's (standaard 0,9). Een afbeelding met
   img.dataset.pdfType = 'PNG' (een logo met doorzichtige achtergrond) gaat
   als PNG, net als elke afbeelding waarin transparantie zit.
   Niet ondersteund (niet nodig voor de templates): transformaties en andere
   tekstbasislijnen dan 'alphabetic'.
   ============================================================================= */
(function (global) {
  'use strict';

  const FAMILY = 'OpenSans';   // de familie die PM.pdfFonts registreert

  const DEFAULTS = {
    fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    miterLimit: 10, font: '10px sans-serif', letterSpacing: '0px', textAlign: 'start',
    textBaseline: 'alphabetic', globalAlpha: 1, imageSmoothingEnabled: true, imageSmoothingQuality: 'high',
  };
  const STATE = Object.keys(DEFAULTS);
  const SMOOTH_SCALE = 0.5;    // pixels per ontwerp-px voor een verloop over een rechthoek
  const MASK_SCALE = 1.5;      // hoogstens, voor een foto in een zeshoek (een PNG is groot)
  const SVG_TIMEOUT = 3000;    // ms voor de proef met svg2pdf (normaal ~100 ms)
  const INVISIBLE = /[\u00AD\u200B\u2060\uFEFF]/g;
  const EMOJI_PART = /[\uFE0F\u20E3\u200D]|[\u{1F3FB}-\u{1F3FF}]/u;

  let segmenter = null;
  function graphemes(text) {
    if (typeof Intl === 'undefined' || !Intl.Segmenter) return Array.from(text);
    segmenter = segmenter || new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }

  // Kleur voor jsPDF als tekst met 4 decimalen (PM.pdfColor): merkcyaan blijft #1ab9e2
  const channels = (c) => global.PM.pdfColor(c);

  /* ---------------------------------------------------------------------------
     Kleine hulpjes
     ------------------------------------------------------------------------- */

  const scratch = () => document.createElement('canvas').getContext('2d');
  let colorCtx = null;

  // CSS-kleur naar { r, g, b, a }. Hex en rgb(a) zelf; andere notaties (namen,
  // hsl) normaliseert de browser
  function parseColor(value) {
    if (!value || value === 'transparent' || value === 'none') return null;
    let v = String(value).trim();
    if (!/^#|^rgba?\(/i.test(v) && global.document) {
      colorCtx = colorCtx || scratch();
      colorCtx.fillStyle = '#000000';
      colorCtx.fillStyle = v;
      v = colorCtx.fillStyle;
    }
    let m = /^#([0-9a-f]{3,8})$/i.exec(v);
    if (m) {
      let hex = m[1];
      if (hex.length <= 4) hex = hex.split('').map((c) => c + c).join('');
      const n = parseInt(hex.slice(0, 6), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1 };
    }
    m = /rgba?\(([^)]+)\)/i.exec(v);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean)
      .map((s, i) => (/%$/.test(s) ? (parseFloat(s) / 100) * (i < 3 ? 255 : 1) : Number(s)));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  const sameColor = (a, b) => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

  // Korte, stabiele sleutel voor de cache (FNV-1a)
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return `${(h >>> 0).toString(36)}${str.length.toString(36)}`;
  }

  /* --- rechthoeken { x, y, w, h } in ontwerp-px --- */

  function intersect(a, b) {
    if (!a || !b) return null;
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x;
    const h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0.01 && h > 0.01 ? { x, y, w, h } : null;
  }

  const containsRect = (outer, inner) => inner.x >= outer.x - 0.01 && inner.y >= outer.y - 0.01
    && inner.x + inner.w <= outer.x + outer.w + 0.01 && inner.y + inner.h <= outer.y + outer.h + 0.01;

  // Naar hele pixels naar buiten afronden, zodat een afbeelding op het raster valt
  function roundOut(r) {
    const x = Math.floor(r.x + 0.001);
    const y = Math.floor(r.y + 0.001);
    return { x, y, w: Math.ceil(r.x + r.w - 0.001) - x, h: Math.ceil(r.y + r.h - 0.001) - y };
  }

  /* ---------------------------------------------------------------------------
     Paden: subpaden met segmenten M, L en C (bogen worden bezierkrommen)
     ------------------------------------------------------------------------- */

  class Path {
    constructor() {
      this.subs = [];
      this.last = null;
    }

    start(x, y) {
      this.subs.push({ segs: [['M', x, y]], closed: false });
      this.last = [x, y];
    }

    // Canvas: na closePath begint een nieuw subpad op het beginpunt
    open() {
      const sub = this.subs[this.subs.length - 1];
      if (!sub) return false;
      if (sub.closed) this.start(sub.segs[0][1], sub.segs[0][2]);
      return true;
    }

    moveTo(x, y) { this.start(x, y); }

    lineTo(x, y) {
      if (!this.open()) return this.start(x, y);
      this.subs[this.subs.length - 1].segs.push(['L', x, y]);
      this.last = [x, y];
    }

    bezierCurveTo(x1, y1, x2, y2, x, y) {
      if (!this.open()) this.start(x1, y1);
      this.subs[this.subs.length - 1].segs.push(['C', x1, y1, x2, y2, x, y]);
      this.last = [x, y];
    }

    quadraticCurveTo(cx, cy, x, y) {
      if (!this.open()) this.start(cx, cy);
      const [x0, y0] = this.last;
      this.bezierCurveTo(x0 + (2 / 3) * (cx - x0), y0 + (2 / 3) * (cy - y0), x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y), x, y);
    }

    arc(cx, cy, r, a0, a1, ccw = false) {
      const TAU = Math.PI * 2;
      let sweep = a1 - a0;
      if (!ccw && sweep < 0) sweep = (sweep % TAU) + TAU;
      if (ccw && sweep > 0) sweep = (sweep % TAU) - TAU;
      if (Math.abs(a1 - a0) >= TAU) sweep = ccw ? -TAU : TAU;
      const sx = cx + r * Math.cos(a0);
      const sy = cy + r * Math.sin(a0);
      // Canvas: een lijn vanaf het huidige punt (ook na closePath of rect)
      this.lineTo(sx, sy);
      const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
      const step = sweep / n;
      const t = (4 / 3) * Math.tan(step / 4);
      let a = a0;
      for (let i = 0; i < n; i++) {
        const b = a + step;
        const [c0, s0, c1, s1] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)];
        this.bezierCurveTo(cx + r * (c0 - t * s0), cy + r * (s0 + t * c0), cx + r * (c1 + t * s1), cy + r * (s1 - t * c1), cx + r * c1, cy + r * s1);
        a = b;
      }
    }

    closePath() {
      const sub = this.subs[this.subs.length - 1];
      if (!sub) return;
      sub.closed = true;
      this.last = [sub.segs[0][1], sub.segs[0][2]];
    }

    rect(x, y, w, h) {
      this.subs.push(rectSub(x, y, w, h));
      this.last = [x, y];
    }
  }

  // .rect altijd met positieve maten (canvas tekent ook fillRect met een negatieve breedte)
  function rectSub(x, y, w, h) {
    const rect = { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h) };
    return { segs: [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h]], closed: true, rect };
  }

  // Alle punten van een pad (inclusief controlepunten: een veilige omsluiting)
  function points(subs) {
    const pts = [];
    for (const sub of subs) {
      for (const seg of sub.segs) {
        for (let i = 1; i < seg.length; i += 2) pts.push([seg[i], seg[i + 1]]);
      }
    }
    return pts;
  }

  function bbox(subs, pad = 0) {
    const pts = points(subs);
    if (!pts.length) return null;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }

  // Hetzelfde pad naar een echte 2D-context
  function traceCanvas(ctx, subs) {
    for (const sub of subs) {
      for (const [op, ...a] of sub.segs) {
        if (op === 'M') ctx.moveTo(a[0], a[1]);
        else if (op === 'L') ctx.lineTo(a[0], a[1]);
        else ctx.bezierCurveTo(a[0], a[1], a[2], a[3], a[4], a[5]);
      }
      if (sub.closed) ctx.closePath();
    }
  }

  // Punt in een pad (even-oneven over de hoekpunten; exact voor de zeshoeken)
  function inside(subs, x, y) {
    let odd = false;
    for (const sub of subs) {
      const pts = points([sub]);
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
      }
    }
    return odd;
  }

  // Een veelhoek is convex als alle bochten dezelfde kant op gaan
  function convex(pts) {
    let sign = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      const [cx, cy] = pts[(i + 2) % pts.length];
      const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
      if (Math.abs(cross) < 1e-9) continue;
      if (!sign) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
    return true;
  }

  // Valt rechthoek r helemaal binnen de uitsnede? De hoekentoets klopt alleen
  // voor één gesloten, convexe vorm (zoals de zeshoek); anders: nee, voor de zekerheid
  function clipContains(clip, r) {
    if (clip.rect) return containsRect(clip.rect, r);
    if (!clip.convex || !containsRect(clip.box, r)) return false;
    return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].every(([x, y]) => inside(clip.subs, x, y));
  }

  function makeClip(subs, rule) {
    const only = subs.length === 1 ? subs[0] : null;
    const polygon = only && only.closed && only.segs.every((seg) => seg[0] !== 'C');
    return {
      subs, rule, box: bbox(subs),
      rect: only && only.rect ? only.rect : null,
      convex: !!polygon && convex(points(subs)),
    };
  }

  /* ---------------------------------------------------------------------------
     Verlopen: onthouden, en later door de browser laten tekenen
     ------------------------------------------------------------------------- */

  class Gradient {
    constructor(type, args) {
      this.type = type;
      this.args = args;
      this.stops = [];
    }

    addColorStop(offset, color) {
      this.stops.push([offset, color]);
    }

    toCanvas(ctx) {
      const g = this.type === 'linear' ? ctx.createLinearGradient(...this.args) : ctx.createRadialGradient(...this.args);
      this.stops.forEach(([o, c]) => g.addColorStop(o, c));
      return g;
    }

    // Kleur op één punt, voor tekst met een verloop (komt in de templates niet voor)
    colorAt(x, y) {
      let t;
      if (this.type === 'linear') {
        const [x0, y0, x1, y1] = this.args;
        const dx = x1 - x0;
        const dy = y1 - y0;
        t = ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1);
      } else {
        const [, , r0, x1, y1, r1] = this.args;
        t = (Math.hypot(x - x1, y - y1) - r0) / ((r1 - r0) || 1);
      }
      const stops = this.stops.map(([o, c]) => [o, parseColor(c) || { r: 0, g: 0, b: 0, a: 0 }]).sort((a, b) => a[0] - b[0]);
      if (!stops.length) return null;
      t = Math.min(1, Math.max(0, t));
      if (t <= stops[0][0]) return stops[0][1];
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const [o0, a] = stops[i - 1];
          const [o1, b] = stops[i];
          const f = (t - o0) / ((o1 - o0) || 1);
          const mix = (p, q) => p + (q - p) * f;
          return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b), a: mix(a.a, b.a) };
        }
      }
      return stops[stops.length - 1][1];
    }

    key() {
      return JSON.stringify([this.type, this.args, this.stops]);
    }
  }

  /* ---------------------------------------------------------------------------
     SVG: alle effen vormen van één kleur samenvoegen tot één pad
     ------------------------------------------------------------------------- */

  const NUM = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[-+]?\\d+)?';
  const SHAPES = ['path', 'rect', 'polygon', 'polyline', 'circle', 'ellipse'];
  const SKIP = ['defs', 'style', 'title', 'desc', 'metadata'];

  // Een pad dat met een relatieve "m" begint, is los niet meer relatief aan zijn voorganger
  function absoluteStart(d) {
    const m = new RegExp(`^\\s*m\\s*(${NUM})[\\s,]*(${NUM})`).exec(d);
    if (!m) return d;
    const rest = d.slice(m[0].length);
    return `M${m[1]} ${m[2]}${new RegExp(`^[\\s,]*${NUM}`).test(rest) ? ` l${rest}` : rest}`;
  }

  function pathData(el) {
    const n = (name) => {
      const v = el.getAttribute(name);
      if (v && /%/.test(v)) throw new Error('percentage');
      return parseFloat(v) || 0;
    };
    switch (el.localName) {
      case 'path':
        return absoluteStart(el.getAttribute('d') || '');
      case 'rect': {
        if (n('rx') || n('ry')) throw new Error('rounded rect');
        const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
        return w > 0 && h > 0 ? `M${x} ${y}h${w}v${h}h${-w}Z` : '';
      }
      case 'polygon':
      case 'polyline': {
        const p = (el.getAttribute('points') || '').match(new RegExp(NUM, 'gi')) || [];
        if (p.length < 4) return '';
        let d = `M${p[0]} ${p[1]}`;
        for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
        return `${d}Z`;
      }
      default: {
        const [cx, cy] = [n('cx'), n('cy')];
        const rx = el.localName === 'circle' ? n('r') : n('rx');
        const ry = el.localName === 'circle' ? n('r') : n('ry');
        if (!(rx > 0 && ry > 0)) return '';
        return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
      }
    }
  }

  /**
   * Geeft een SVG terug waarin opeenvolgende vormen met dezelfde vulling één
   * pad zijn. Alles wat niet eenvoudig is (lijnen, verlopen, maskers,
   * transformaties, tekst, afbeeldingen) laat de SVG ongemoeid.
   */
  function simplifySvg(markup) {
    const holder = document.createElement('div');
    // Zwart als tekstkleur, zoals een SVG als afbeelding: dan klopt currentColor
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;overflow:hidden;color:#000';
    holder.innerHTML = markup;
    document.body.appendChild(holder);
    try {
      const svg = holder.querySelector('svg');
      if (!svg) return markup;
      const hidden = (el) => {
        for (let n = el; n && n !== svg; n = n.parentElement) if (getComputedStyle(n).display === 'none') return true;
        return false;
      };
      const groups = [];
      for (const el of svg.querySelectorAll('*')) {
        const tag = el.localName;
        if (SKIP.includes(tag) || el.closest('defs')) continue;
        if (tag === 'g') {
          const cs = getComputedStyle(el);
          if (el.getAttribute('transform') || cs.opacity !== '1' || cs.clipPath !== 'none' || cs.mask !== 'none' || cs.filter !== 'none') return markup;
          continue;
        }
        if (!SHAPES.includes(tag)) return markup;
        const cs = getComputedStyle(el);
        if (hidden(el) || cs.visibility === 'hidden') continue;
        if (el.getAttribute('transform') || cs.opacity !== '1' || cs.clipPath !== 'none' || cs.mask !== 'none' || cs.filter !== 'none') return markup;
        if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) return markup;
        if (cs.fill === 'none') continue;
        if (!/^rgba?\(/.test(cs.fill)) return markup;   // verloop of patroon
        const d = pathData(el);
        if (!d) continue;
        const style = `${cs.fill}|${cs.fillRule}|${cs.fillOpacity}`;
        const last = groups[groups.length - 1];
        if (last && last.style === style) last.d.push(d);
        else groups.push({ style, fill: cs.fill, rule: cs.fillRule, opacity: cs.fillOpacity, d: [d] });
      }
      if (!groups.length) return markup;
      const out = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      for (const a of ['viewBox', 'width', 'height', 'preserveAspectRatio']) {
        if (svg.hasAttribute(a)) out.setAttribute(a, svg.getAttribute(a));
      }
      for (const g of groups) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', g.d.join(' '));
        p.setAttribute('fill', g.fill);
        if (g.rule !== 'nonzero') p.setAttribute('fill-rule', g.rule);
        if (g.opacity !== '1') p.setAttribute('fill-opacity', g.opacity);
        out.appendChild(p);
      }
      return new XMLSerializer().serializeToString(out);
    } catch (err) {
      return markup;
    } finally {
      holder.remove();
    }
  }

  // Valt alles binnen de viewBox? Dan knipt die niets af
  function fitsViewBox(svg) {
    try {
      const vb = svg.viewBox && svg.viewBox.baseVal;
      const par = svg.preserveAspectRatio && svg.preserveAspectRatio.baseVal;
      if (!vb || !(vb.width > 0 && vb.height > 0)) return false;
      if (par && par.meetOrSlice === 2) return false;   // 'slice' knipt echt af
      // getBBox telt lijndikte, markers en filters niet mee, ook niet als ze uit CSS komen
      for (const el of svg.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if ((cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) || cs.filter !== 'none'
          || cs.markerStart !== 'none' || cs.markerMid !== 'none' || cs.markerEnd !== 'none') return false;
      }
      const b = svg.getBBox();
      const e = 0.5;
      return b.x >= vb.x - e && b.y >= vb.y - e && b.x + b.width <= vb.x + vb.width + e && b.y + b.height <= vb.y + vb.height + e;
    } catch (err) {
      return false;
    }
  }

  // SVG-tekst als vector in de PDF (svg2pdf.js). svg2pdf knipt elk logo af op
  // zijn viewBox (een uitknippad); als dat niets afknipt, laten we het weg.
  // svg2pdf geeft kleuren als getallen door, die jsPDF op 2 decimalen afrondt:
  // zolang hij tekent, gaan ze als tekst met 4 decimalen (de kleur van een klantlogo klopt)
  async function drawSvg(pdf, markup, x, y, w, h) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;overflow:hidden;color:#000';
    holder.innerHTML = markup;
    document.body.appendChild(holder);
    const own = ['setFillColor', 'setDrawColor', 'setTextColor'].filter((m) => Object.prototype.hasOwnProperty.call(pdf, m));
    const originals = own.map((m) => [m, pdf[m]]);
    for (const [m, orig] of originals) {
      pdf[m] = function exactColor(a, b, c, d) {
        return typeof a === 'number' && typeof b === 'number' && typeof c === 'number' && d === undefined
          ? orig.apply(this, channels({ r: a, g: b, b: c }))
          : orig.apply(this, arguments);
      };
    }
    try {
      const svg = holder.querySelector('svg');
      if (!svg) return;
      if (fitsViewBox(svg)) svg.style.setProperty('overflow', 'visible');   // inline gaat voor op een <style> in de SVG
      await pdf.svg(svg, { x, y, width: w, height: h });
    } finally {
      for (const [m, orig] of originals) pdf[m] = orig;
      holder.remove();
    }
  }

  // Een SVG-tekst als afbeelding, zoals de preview hem ziet
  function svgImage(markup) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => resolve({ img, done: () => URL.revokeObjectURL(url) });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('svg'));
      };
      img.src = url;
    });
  }

  // Zien twee SVG's er hetzelfde uit? Samengevoegde vormen kunnen gaten slaan
  // waar ze overlappen; dan houden we het origineel
  async function sameLook(a, b) {
    let ia;
    let ib;
    try {
      [ia, ib] = await Promise.all([svgImage(a), svgImage(b)]);
      const w0 = ia.img.naturalWidth || 300;
      const h0 = ia.img.naturalHeight || 150;
      const s = 400 / Math.max(w0, h0);
      const w = Math.max(1, Math.round(w0 * s));
      const h = Math.max(1, Math.round(h0 * s));
      const px = (img) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        return pixels(c);
      };
      const pa = px(ia.img);
      const pb = px(ib.img);
      const off = new Uint8Array(w * h);
      for (let i = 0, j = 0; i < pa.length; i += 4, j++) {
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]), Math.abs(pa[i + 3] - pb[i + 3]));
        off[j] = d > 96 ? 1 : 0;
      }
      // Alleen vlakken tellen (een pixel én zijn vier buren wijken af): randen die
      // net anders worden afgevlakt zijn dunne lijnen en vallen zo weg, gaten niet
      let bad = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const j = y * w + x;
          if (off[j] && off[j - 1] && off[j + 1] && off[j - w] && off[j + w]) bad++;
        }
      }
      return bad <= w * h * 0.0005;
    } catch (err) {
      return false;
    } finally {
      if (ia) ia.done();
      if (ib) ib.done();
    }
  }

  // Na ms een fout: svg2pdf blijft hangen op een afbeelding die niet laadt
  function timeout(promise, ms) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })])
      .finally(() => clearTimeout(timer));
  }

  /* ---------------------------------------------------------------------------
     Afbeeldingen: klaargemaakt per sessie, en per PDF maar één keer ingesloten
     (een verloop dat op elke slide van een carousel terugkomt)
     ------------------------------------------------------------------------- */

  // Een SVG-bestand als foto (PM.readImage zet dit): overal scherp, dus niet
  // begrensd door zijn eigen (kleine) maat
  const isVector = (img) => !!(img.dataset && img.dataset.pdfType === 'SVG');

  // Bron van een afbeelding voor de cachesleutel; een canvas of bitmap heeft geen src
  const ids = new WeakMap();
  let lastId = 0;
  function sourceKey(img) {
    if (img.currentSrc || img.src) return img.currentSrc || img.src;
    if (!ids.has(img)) ids.set(img, `bron-${++lastId}`);
    return ids.get(img);
  }

  // Klaargemaakte afbeeldingen en SVG's, voor deze sessie: de gloed en het
  // patroon van een post worden zo één keer getekend, niet bij elke export.
  // jsPDF zet een afbeelding met dezelfde alias maar één keer in een PDF.
  function memo(limit) {
    const map = new Map();
    return {
      has: (k) => map.has(k),
      get: (k) => map.get(k),
      set(k, v) {
        map.delete(k);
        map.set(k, v);
        if (map.size > limit) map.delete(map.keys().next().value);
      },
    };
  }
  const IMAGES = memo(40);
  const SVGS = memo(20);

  const securityError = (err) => (err && err.name === 'SecurityError' && global.PM ? global.PM.fileProtocolError() : err);

  function toDataUrl(canvas, type, quality) {
    try {
      return canvas.toDataURL(type, quality);
    } catch (err) {
      throw securityError(err);
    }
  }

  function pixels(canvas) {
    try {
      return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (err) {
      throw securityError(err);
    }
  }

  // Omsluitende rechthoek (in apparaat-pixels) van alles wat niet doorzichtig is
  function opaqueBounds(canvas) {
    const { width: w, height: h } = canvas;
    const data = pixels(canvas);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (data[row + x * 4 + 3]) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  function hasTransparency(canvas) {
    const data = pixels(canvas);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  }

  function crop(canvas, b) {
    if (b.x0 === 0 && b.y0 === 0 && b.x1 === canvas.width && b.y1 === canvas.height) return canvas;
    const c = document.createElement('canvas');
    c.width = b.x1 - b.x0;
    c.height = b.y1 - b.y0;
    c.getContext('2d').drawImage(canvas, -b.x0, -b.y0);
    return c;
  }

  /* ---------------------------------------------------------------------------
     Het canvas
     ------------------------------------------------------------------------- */

  class PMPdfCanvas {
    constructor(pdf, { width, height, pageWidth, vectors, rasterScale = 2, jpegQuality = 0.9, measure }) {
      this.pdf = pdf;
      this.page = { x: 0, y: 0, w: width, h: height || width };
      this.k = pageWidth / width;             // ontwerp-px -> pt
      this.vectors = vectors || new Map();
      this.rasterScale = rasterScale;
      this.jpegQuality = jpegQuality;
      this.items = [];
      this.stack = [];
      this.clips = [];
      this.path = new Path();
      this.stats = { text: 0, vector: 0, raster: 0, image: 0, svg: 0 };
      // Meten met een echte 2D-context: dezelfde maten als de preview
      this.m = measure || scratch();
      this.hasLetterSpacing = 'letterSpacing' in this.m;
      Object.assign(this, DEFAULTS);
      const self = this;
      this.canvas = { width, height: this.page.h, getContext: () => self };
    }

    /* --- toestand --- */

    save() {
      const s = { clips: this.clips };
      STATE.forEach((k) => { s[k] = this[k]; });
      this.stack.push(s);
    }

    restore() {
      const s = this.stack.pop();
      if (s) Object.assign(this, s);
    }

    setTransform() { /* alles gaat via this.k */ }
    resetTransform() { /* idem */ }
    clearRect() { /* een PDF-pagina is al leeg */ }
    createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1]); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1]); }

    /* --- paden --- */

    beginPath() { this.path = new Path(); }
    moveTo(x, y) { this.path.moveTo(x, y); }
    lineTo(x, y) { this.path.lineTo(x, y); }
    bezierCurveTo(...a) { this.path.bezierCurveTo(...a); }
    quadraticCurveTo(...a) { this.path.quadraticCurveTo(...a); }
    arc(...a) { this.path.arc(...a); }
    closePath() { this.path.closePath(); }
    rect(x, y, w, h) { this.path.rect(x, y, w, h); }

    // Een kopie van het pad: wie daarna doortekent, verandert wat al getekend is niet
    snap() { return this.path.subs.map((sub) => ({ ...sub, segs: sub.segs.slice() })); }

    fill(rule) { this.paint('fill', this.snap(), rule === 'evenodd' ? 'evenodd' : 'nonzero'); }
    stroke() { this.paint('stroke', this.snap(), 'nonzero'); }
    fillRect(x, y, w, h) { this.paint('fill', [rectSub(x, y, w, h)], 'nonzero'); }
    strokeRect(x, y, w, h) { this.paint('stroke', [rectSub(x, y, w, h)], 'nonzero'); }
    clip(rule) { this.clips = [...this.clips, makeClip(this.snap(), rule === 'evenodd' ? 'evenodd' : 'nonzero')]; }

    /* --- lettertype en tekst --- */

    // CSS-font ("italic 700 40px ...") in stijl, gewicht en grootte; de volgorde vóór de maat is vrij
    fontInfo() {
      const size = /([\d.]+)px/.exec(this.font);
      const before = size ? this.font.slice(0, size.index) : '';
      const w = (/\b(bold(?:er)?|lighter|[1-9]00)\b/i.exec(before) || [, '400'])[1].toLowerCase();
      const weight = w === 'bold' || w === 'bolder' ? 700 : w === 'lighter' ? 400 : Number(w);
      const italic = /\b(italic|oblique)\b/i.test(before);
      const spacing = this.hasLetterSpacing ? parseFloat(this.letterSpacing) || 0 : 0;
      return { style: global.PM.pdfFontStyle(weight, italic), size: size ? Number(size[1]) : 10, spacing, css: this.font, ls: this.letterSpacing };
    }

    measureWith(font, ls, text) {
      this.m.font = font;
      if (this.hasLetterSpacing) this.m.letterSpacing = ls;
      return this.m.measureText(text);
    }

    measureText(text) {
      return this.measureWith(this.font, this.letterSpacing, String(text));
    }

    // Kan Open Sans dit teken? (anders zou jsPDF de rest van de tekst weglaten)
    glyphs(style) {
      const entry = this.pdf.internal.getFont(FAMILY, style, { noFallback: true });
      return entry && entry.metadata && entry.metadata.characterToGlyph ? entry.metadata : null;
    }

    fillText(value, x, y) {
      // Zachte afbreekstreepjes en andere onzichtbare tekens tekent canvas niet (breedte 0)
      const text = String(value).replace(INVISIBLE, '');
      if (!text) return;
      const color = this.solid(this.fillStyle, x, y);
      if (!color) return;
      const f = this.fontInfo();
      const width = this.measureText(text).width;
      if (this.textAlign === 'center') x -= width / 2;
      else if (this.textAlign === 'right' || this.textAlign === 'end') x -= width;

      // Tekst opknippen in stukken die Open Sans heeft en stukken die niet (emoji).
      // Per grafeem: 1️⃣ is een 1 met twee tekens erachter en moet heel blijven
      const meta = this.glyphs(f.style);
      const chars = graphemes(text);
      const known = (g) => !meta || (!EMOJI_PART.test(g)
        && Array.from(g).every((ch) => ch.length === 1 && meta.characterToGlyph(ch.charCodeAt(0)) > 0));
      if (chars.every(known)) {
        this.addRun({ text, x, y, end: x + width, font: f, color });
        return;
      }
      let i = 0;
      while (i < chars.length) {
        const ok = known(chars[i]);
        let j = i;
        while (j < chars.length && known(chars[j]) === ok) j++;
        const part = chars.slice(i, j).join('');
        const before = chars.slice(0, i).join('');
        const px = x + (before ? this.measureWith(f.css, f.ls, before).width : 0);
        const pw = this.measureWith(f.css, f.ls, part).width;
        if (ok) this.addRun({ text: part, x: px, y, end: px + pw, font: f, color });
        else this.addGlyphImage(part, px, y, pw, f, color);
        i = j;
      }
    }

    // Opeenvolgende woorden op één basislijn worden één tekstobject per stijl
    addRun(run) {
      const last = this.items[this.items.length - 1];
      if (last && last.kind === 'text' && last.y === run.y) {
        const prev = last.runs[last.runs.length - 1];
        const gap = run.x - prev.end;
        const space = this.measureWith(prev.font.css, prev.font.ls, ' ').width;
        const touching = Math.abs(gap) < 0.6;
        const spaced = Math.abs(gap - space) < Math.max(1.2, space * 0.35);
        if (touching || spaced) {
          const same = prev.font.css === run.font.css && prev.font.ls === run.font.ls && sameColor(prev.color, run.color);
          // De spatie hoort in de tekst: Canva leest woorden, geen gaten
          if (spaced) prev.text += ' ';
          if (same) {
            prev.text += run.text;
            prev.end = run.end;
          } else {
            last.runs.push(run);
          }
          return;
        }
      }
      this.items.push({ kind: 'text', y: run.y, runs: [run] });
    }

    // Een teken dat Open Sans niet heeft, zoals de browser het tekent (met zijn reservefont)
    addGlyphImage(text, x, y, w, f, color) {
      const pad = f.size * 0.4;
      const css = `rgba(${color.r},${color.g},${color.b},${color.a})`;
      this.items.push({
        kind: 'raster',
        box: { x: x - pad, y: y - f.size * 1.3, w: w + pad * 2, h: f.size * 1.8 },
        clips: [],
        key: JSON.stringify(['glyph', text, x, y, f.css, f.ls, css]),
        paint: (ctx) => {
          ctx.font = f.css;
          if ('letterSpacing' in ctx) ctx.letterSpacing = f.ls;
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = css;
          ctx.fillText(text, x, y);
        },
      });
    }

    /* --- vlakken en lijnen --- */

    solid(style, x, y) {
      const c = style instanceof Gradient ? style.colorAt(x, y) : parseColor(style);
      if (!c) return null;
      const a = c.a * (this.globalAlpha == null ? 1 : this.globalAlpha);
      return a > 0.002 ? { ...c, a } : null;
    }

    paint(mode, subs, rule) {
      if (!subs.length) return;
      const style = mode === 'fill' ? this.fillStyle : this.strokeStyle;
      const item = {
        mode, subs, rule, clips: this.clips, alpha: this.globalAlpha,
        lineWidth: this.lineWidth, cap: this.lineCap, join: this.lineJoin, miter: this.miterLimit,
      };
      const pad = mode === 'stroke' ? (this.lineWidth / 2) * (this.lineJoin === 'miter' ? this.miterLimit : 1) : 0;
      if (style instanceof Gradient) {
        this.pushRaster(item, bbox(subs, pad), style);
        return;
      }
      const color = this.solid(style);
      if (!color) return;
      item.color = color;
      // Uitsnedes: een vector binnen de uitsnede blijft zoals hij is; een vlak
      // dat de uitsnede helemaal bedekt, wordt de vorm van de uitsnede
      let box = bbox(subs, pad);
      for (const clip of this.clips) {
        if (!box || clipContains(clip, box)) continue;
        const only = item.subs.length === 1 ? item.subs[0] : null;
        if (mode === 'fill' && only && only.rect && containsRect(only.rect, clip.box)) {
          item.subs = clip.subs;
          item.rule = clip.rule;
          box = clip.box;
          continue;
        }
        if (mode === 'fill' && only && only.rect && clip.rect) {
          const r = intersect(only.rect, clip.rect);
          if (!r) return;
          item.subs = [rectSub(r.x, r.y, r.w, r.h)];
          box = r;
          continue;
        }
        this.pushRaster(item, bbox(subs, pad), style);
        return;
      }
      this.items.push({ kind: 'vector', ...item });
    }

    // Wat als pixels in de PDF komt: door de browser getekend, met zijn uitsnedes.
    // Een verloop over een rechthoek heeft geen randen die scherp moeten blijven:
    // op halve resolutie is het na het vergroten gelijk (en 16 keer kleiner)
    pushRaster(item, box, style) {
      if (!box) return;
      const isGradient = style instanceof Gradient;
      const smooth = isGradient && item.mode === 'fill' && item.subs.length === 1 && !!item.subs[0].rect
        && item.clips.every((c) => c.rect);
      this.items.push({
        kind: 'raster',
        box,
        scale: smooth ? SMOOTH_SCALE : this.rasterScale,
        clips: item.clips,
        key: JSON.stringify([item.mode, item.subs, item.rule, item.lineWidth, item.cap, item.join, item.miter, item.alpha,
          isGradient ? style.key() : style, item.clips.map((c) => [c.subs, c.rule])]),
        paint: (ctx) => {
          ctx.globalAlpha = item.alpha == null ? 1 : item.alpha;
          ctx.beginPath();
          traceCanvas(ctx, item.subs);
          const paint = isGradient ? style.toCanvas(ctx) : style;
          if (item.mode === 'fill') {
            ctx.fillStyle = paint;
            ctx.fill(item.rule);
          } else {
            ctx.strokeStyle = paint;
            ctx.lineWidth = item.lineWidth;
            ctx.lineCap = item.cap;
            ctx.lineJoin = item.join;
            ctx.miterLimit = item.miter;
            ctx.stroke();
          }
        },
      });
    }

    /* --- afbeeldingen --- */

    drawImage(img, ...a) {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!nw || !nh) return;
      let src = { x: 0, y: 0, w: nw, h: nh };
      let dest;
      if (a.length >= 8) {
        src = { x: a[0], y: a[1], w: a[2], h: a[3] };
        dest = { x: a[4], y: a[5], w: a[6], h: a[7] };
      } else {
        dest = { x: a[0], y: a[1], w: a[2] != null ? a[2] : nw, h: a[3] != null ? a[3] : nh };
      }
      // Negatieve breedte of hoogte: canvas normaliseert, zonder te spiegelen
      const norm = (r) => ({ x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) });
      src = norm(src);
      dest = norm(dest);
      if (!(dest.w > 0 && dest.h > 0 && src.w > 0 && src.h > 0)) return;
      const svg = this.vectors.get(img);
      const clips = this.clips;
      const alpha = this.globalAlpha == null ? 1 : this.globalAlpha;
      // Wat je ziet: bestemming binnen de pagina en de rechthoekige uitsnedes
      let vis = intersect(dest, this.page);
      let masked = false;
      for (const clip of clips) {
        if (clip.rect) vis = intersect(vis, clip.rect);
        else if (vis && !clipContains(clip, vis)) masked = true;
      }
      if (!vis) return;
      if (svg && !masked && containsRect(vis, dest)) {
        this.items.push({ kind: 'svg', markup: svg, img, src, dest, alpha });
        return;
      }
      if (masked) {
        // Niet-rechthoekige uitsnede (foto in een zeshoek): als PNG met transparantie
        this.items.push({
          kind: 'raster',
          box: vis,
          clips,
          // Niet scherper dan de foto (een SVG is overal scherp)
          scale: isVector(img) ? this.rasterScale : Math.max(1, Math.min(MASK_SCALE, src.w / dest.w)),
          key: JSON.stringify(['img', sourceKey(img), src, dest, alpha, clips.map((c) => [c.subs, c.rule])]),
          paint: (ctx) => {
            ctx.globalAlpha = alpha;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, src.x, src.y, src.w, src.h, dest.x, dest.y, dest.w, dest.h);
          },
        });
        return;
      }
      // Rechthoekig: het zichtbare deel van de bron, op zijn plek
      const sx = src.w / dest.w;
      const sy = src.h / dest.h;
      const cropSrc = { x: src.x + (vis.x - dest.x) * sx, y: src.y + (vis.y - dest.y) * sy, w: vis.w * sx, h: vis.h * sy };
      this.items.push({ kind: 'image', img, src: cropSrc, dest: vis, alpha });
    }

    /* --- wegschrijven --- */

    withAlpha(a, draw) {
      if (a >= 0.999) {
        draw();
        return;
      }
      this.pdf.saveGraphicsState();
      this.pdf.setGState(new this.pdf.GState({ opacity: a, 'stroke-opacity': a }));
      draw();
      this.pdf.restoreGraphicsState();
    }

    tracePdf(subs) {
      const { pdf, k } = this;
      for (const sub of subs) {
        for (const [op, ...a] of sub.segs) {
          if (op === 'M') pdf.moveTo(a[0] * k, a[1] * k);
          else if (op === 'L') pdf.lineTo(a[0] * k, a[1] * k);
          else pdf.curveTo(a[0] * k, a[1] * k, a[2] * k, a[3] * k, a[4] * k, a[5] * k);
        }
        if (sub.closed) pdf.close();
      }
    }

    writeText(item) {
      const { pdf, k } = this;
      for (const r of item.runs) {
        this.withAlpha(r.color.a, () => {
          pdf.setFont(FAMILY, r.font.style);
          pdf.setFontSize(r.font.size * k);
          pdf.setCharSpace(r.font.spacing * k);
          pdf.setTextColor(...channels(r.color));
          pdf.text(r.text, r.x * k, item.y * k);
          pdf.setCharSpace(0);
        });
        this.stats.text++;
      }
    }

    writeVector(item) {
      const { pdf, k } = this;
      const c = item.color;
      this.withAlpha(c.a, () => {
        if (item.mode === 'fill') {
          pdf.setFillColor(...channels(c));
          this.tracePdf(item.subs);
          if (item.rule === 'evenodd') pdf.fillEvenOdd();
          else pdf.fill();
        } else {
          pdf.setDrawColor(...channels(c));
          pdf.setLineWidth(item.lineWidth * k);
          pdf.setLineCap(item.cap === 'round' ? 1 : item.cap === 'square' ? 2 : 0);
          pdf.setLineJoin(item.join === 'round' ? 1 : item.join === 'bevel' ? 2 : 0);
          pdf.setLineMiterLimit(item.miter);
          this.tracePdf(item.subs);
          pdf.stroke();
        }
      });
      this.stats.vector++;
    }

    // Uitsnede-omsluiting en pagina: het vlak dat de afbeelding beslaat
    rasterBox(item) {
      let box = intersect(item.box, this.page);
      for (const clip of item.clips) box = intersect(box, clip.box);
      return box ? roundOut(box) : null;
    }

    writeRaster(item) {
      const box = this.rasterBox(item);
      if (!box) return;
      const scale = item.scale || this.rasterScale;
      const key = `r${hash(`${item.key}|${box.x},${box.y},${box.w},${box.h}|${scale}`)}`;
      let r = IMAGES.get(key);
      if (r === undefined) {
        r = null;
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(box.w * scale));
        c.height = Math.max(1, Math.ceil(box.h * scale));
        const ctx = c.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, -box.x * scale, -box.y * scale);
        for (const clip of item.clips) {
          ctx.beginPath();
          traceCanvas(ctx, clip.subs);
          ctx.clip(clip.rule);
        }
        item.paint(ctx);
        const b = opaqueBounds(c);
        if (b) {
          r = {
            url: toDataUrl(crop(c, b), 'image/png'),
            type: 'PNG',
            alias: `pm-${key}`,
            x: box.x + b.x0 / scale,
            y: box.y + b.y0 / scale,
            w: (b.x1 - b.x0) / scale,
            h: (b.y1 - b.y0) / scale,
          };
        }
        IMAGES.set(key, r);
      }
      if (!r) return;
      this.pdf.addImage(r.url, r.type, r.x * this.k, r.y * this.k, r.w * this.k, r.h * this.k, r.alias, 'FAST');
      this.stats.raster++;
    }

    writeImage(item) {
      const { img, src, dest } = item;
      // Niet scherper dan de bron (een SVG is overal scherp), niet groter dan nodig
      const perPx = isVector(img) ? this.rasterScale : Math.min(this.rasterScale, Math.max(src.w / dest.w, src.h / dest.h));
      const limit = 4000 / Math.max(dest.w * perPx, dest.h * perPx);
      const f = perPx * Math.min(1, limit);
      const w = Math.max(1, Math.round(dest.w * f));
      const h = Math.max(1, Math.round(dest.h * f));
      const key = `i${hash(`${sourceKey(img)}|${src.x},${src.y},${src.w},${src.h}|${w}x${h}`)}`;
      let r = IMAGES.get(key);
      if (r === undefined) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, w, h);
        const hinted = isVector(img) || (img.dataset && img.dataset.pdfType === 'PNG') || /\.png|\.svg|image\/png|image\/svg/i.test(img.src || '');
        const png = hinted || hasTransparency(c);
        r = png
          ? { url: toDataUrl(c, 'image/png'), type: 'PNG', alias: `pm-${key}` }
          : { url: toDataUrl(c, 'image/jpeg', this.jpegQuality), type: 'JPEG', alias: `pm-${key}` };
        IMAGES.set(key, r);
      }
      const { k } = this;
      this.withAlpha(item.alpha, () => this.pdf.addImage(r.url, r.type, dest.x * k, dest.y * k, dest.w * k, dest.h * k, r.alias, 'FAST'));
      this.stats.image++;
    }

    // Vereenvoudigd en eerst op proef getekend in een los document: een SVG die
    // svg2pdf niet aankan (kapotte verwijzing, externe afbeelding) laat anders de
    // hele PDF mislukken. Die gaat dan als afbeelding mee, zoals de preview hem toont
    async usableSvg(markup) {
      let simple = simplifySvg(markup);
      if (simple !== markup && !(await sameLook(markup, simple))) simple = markup;
      const JsPDF = global.jspdf && global.jspdf.jsPDF;
      if (!JsPDF) return simple;
      try {
        await timeout(drawSvg(new JsPDF({ unit: 'pt' }), simple, 0, 0, 100, 100), SVG_TIMEOUT);
        return simple;
      } catch (err) {
        console.warn('SVG gaat als afbeelding in de PDF:', err);
        return null;
      }
    }

    async writeSvg(item) {
      if (!SVGS.has(item.markup)) SVGS.set(item.markup, await this.usableSvg(item.markup));
      const markup = SVGS.get(item.markup);
      if (!markup) {
        this.writeImage(item);
        return;
      }
      const { dest } = item;
      const { k } = this;
      // svg2pdf zoekt zijn standaardfont in de actieve snede; die moet bestaan
      if (this.glyphs('normal')) this.pdf.setFont(FAMILY, 'normal');
      if (item.alpha >= 0.999) {
        await drawSvg(this.pdf, markup, dest.x * k, dest.y * k, dest.w * k, dest.h * k);
      } else {
        this.pdf.saveGraphicsState();
        this.pdf.setGState(new this.pdf.GState({ opacity: item.alpha, 'stroke-opacity': item.alpha }));
        await drawSvg(this.pdf, markup, dest.x * k, dest.y * k, dest.w * k, dest.h * k);
        this.pdf.restoreGraphicsState();
      }
      this.stats.svg++;
    }

    // Alles in tekenvolgorde naar de huidige pagina; geeft de telling per soort terug
    async flush() {
      for (const item of this.items) {
        if (item.kind === 'text') this.writeText(item);
        else if (item.kind === 'vector') this.writeVector(item);
        else if (item.kind === 'raster') this.writeRaster(item);
        else if (item.kind === 'image') this.writeImage(item);
        else if (item.kind === 'svg') await this.writeSvg(item);
      }
      this.items = [];
      return { ...this.stats };
    }
  }

  /**
   * Een hele PDF uit een renderfunctie: één pagina per tekening, in losse
   * lagen. Gedeeld door de Insta Post Maker en de Presentation Maker.
   *   width, height: ontwerpmaat in px; pageWidth: paginabreedte in pt
   *   count: aantal pagina's; draw(canvas, i): tekent pagina i
   *   -> { blob, elements }: elements telt wat Canva als onderdeel ziet
   */
  PMPdfCanvas.build = async function build({
    width, height, pageWidth, count, draw, vectors, title, subject, progress = () => {}, jpegQuality = 0.92,
  }) {
    const PM = global.PM;
    const size = [pageWidth, (height * pageWidth) / width];
    const orientation = size[0] > size[1] ? 'landscape' : 'portrait';
    const pdf = await PM.pdfDocument({ format: size, orientation });
    let elements = 0;
    for (let i = 0; i < count; i++) {
      progress(count > 1 ? `slide ${i + 1} van ${count}…` : 'pdf maken…');
      await PM.wait(0);   // knoptekst laten verversen
      if (i > 0) pdf.addPage(size, orientation);
      const ctx = new PMPdfCanvas(pdf, { width, height, pageWidth, vectors, jpegQuality });
      draw(ctx.canvas, i);
      const n = await ctx.flush();
      elements += n.text + n.vector + n.raster + n.image + n.svg;
    }
    return { blob: PM.pdfFinish(pdf, { title, subject }), elements };
  };

  // Canva importeert hoogstens zoveel elementen en afbeeldingen per PDF
  PMPdfCanvas.CANVA_LIMIT = 1400;
  PMPdfCanvas.simplifySvg = simplifySvg;

  // In Node (tests/pdf-canvas.test.js) de onderdelen zonder DOM
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PMPdfCanvas, Path, Gradient, parseColor, absoluteStart, bbox, inside, intersect, clipContains, makeClip, roundOut, hash, graphemes, channels };
  }
  if (global.document) {
    global.PMPdfCanvas = PMPdfCanvas;
    global.PMPdfSvg = drawSvg;
  }
})(typeof window !== 'undefined' ? window : globalThis);
