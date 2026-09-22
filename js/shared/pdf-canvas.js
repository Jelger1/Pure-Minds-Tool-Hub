/* =============================================================================
   pdf-canvas.js — een "canvas" dat tekent in een PDF (vector, bewerkbaar)
   -----------------------------------------------------------------------------
   De posts en slides worden getekend met canvas-opdrachten (canvas-kit.js).
   PMPdfCanvas biedt precies die opdrachten aan, maar zet ze om naar jsPDF:

     fillText            echte tekst in ingesloten Open Sans (woorden op één
                         regel worden samengevoegd, zodat je per regel bewerkt)
     paden, fillRect     vectorvormen; clip() werkt ook (foto in een zeshoek)
     verlopen            vector-benadering: verloop per vorm, of in smalle
                         banen/ringen (PDF kent geen transparante verlopen)
     drawImage           foto's als afbeelding; het logo als vector (SVG)

   Gebruik:
     const ctx = new PMPdfCanvas(pdf, { width: 1920, pageWidth: 960, vectors });
     render(ctx.canvas, ...);   // dezelfde renderfunctie als voor de preview
     await ctx.flush();         // schrijft alles in volgorde naar de PDF

   vectors: Map van Image -> SVG-tekst, voor afbeeldingen die als vector moeten.
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;

  function parseColor(value) {
    if (!value || value === 'transparent') return null;
    let m = /^#([0-9a-f]{3,8})$/i.exec(value);
    if (m) {
      let hex = m[1];
      if (hex.length <= 4) hex = hex.split('').map((c) => c + c).join('');
      const n = parseInt(hex.slice(0, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
    }
    m = /rgba?\(([^)]+)\)/.exec(value);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  /* ---------------------------------------------------------------------------
     Verlopen: onthouden en per punt uitrekenen
     ------------------------------------------------------------------------- */

  class Gradient {
    constructor(type, args) {
      this.type = type;
      this.args = args;
      this.stops = [];
    }

    addColorStop(offset, color) {
      this.stops.push({ o: offset, c: parseColor(color) || { r: 0, g: 0, b: 0, a: 0 } });
      this.stops.sort((a, b) => a.o - b.o);
    }

    // Positie 0..1 van een punt op het verloop
    t(x, y) {
      if (this.type === 'linear') {
        const [x0, y0, x1, y1] = this.args;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = dx * dx + dy * dy || 1;
        return Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / len));
      }
      const [, , r0, x1, y1, r1] = this.args;
      const d = Math.hypot(x - x1, y - y1);
      return Math.min(1, Math.max(0, (d - r0) / ((r1 - r0) || 1)));
    }

    colorAt(t) {
      const s = this.stops;
      if (!s.length) return null;
      if (t <= s[0].o) return s[0].c;
      for (let i = 1; i < s.length; i++) {
        if (t <= s[i].o) {
          const a = s[i - 1];
          const b = s[i];
          const f = (t - a.o) / ((b.o - a.o) || 1);
          const mix = (p, q) => p + (q - p) * f;
          return { r: mix(a.c.r, b.c.r), g: mix(a.c.g, b.c.g), b: mix(a.c.b, b.c.b), a: mix(a.c.a, b.c.a) };
        }
      }
      return s[s.length - 1].c;
    }
  }

  /* ---------------------------------------------------------------------------
     Het canvas
     ------------------------------------------------------------------------- */

  class PMPdfCanvas {
    constructor(pdf, { width, height, pageWidth, vectors, rasterScale = 2 }) {
      this.pdf = pdf;
      this.k = pageWidth / width;           // ontwerp-px -> pt
      this.vectors = vectors || new Map();
      this.rasterScale = rasterScale;        // pixels per ontwerp-px voor foto's
      this.ops = [];
      this.stack = [];
      this.path = [];
      this.imageCache = new Map();
      // Eigenschappen zoals op een echte 2D-context
      this.fillStyle = '#000000';
      this.strokeStyle = '#000000';
      this.lineWidth = 1;
      this.lineCap = 'butt';
      this.lineJoin = 'miter';
      this.font = '400 16px sans-serif';
      this.letterSpacing = '0px';
      this.textBaseline = 'alphabetic';
      this.textAlign = 'left';
      this.imageSmoothingEnabled = true;
      this.imageSmoothingQuality = 'high';
      const self = this;
      this.canvas = { width, height, getContext: () => self };
    }

    /* --- toestand --- */

    save() {
      this.stack.push({
        fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth,
        lineCap: this.lineCap, lineJoin: this.lineJoin, font: this.font, letterSpacing: this.letterSpacing,
      });
      this.ops.push(() => this.pdf.saveGraphicsState());
    }

    restore() {
      const s = this.stack.pop();
      if (s) Object.assign(this, s);
      this.ops.push(() => this.pdf.restoreGraphicsState());
    }

    setTransform() { /* alles gaat via this.k */ }
    clearRect() { /* een PDF-pagina is al leeg */ }
    createLinearGradient(x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1]); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1]); }

    /* --- lettertype en tekst --- */

    fontInfo() {
      const m = /(\d+)\s+([\d.]+)px/.exec(this.font);
      const weight = m ? Number(m[1]) : 400;
      const size = m ? Number(m[2]) : 16;
      return { style: PM.pdfFontStyle(weight, false), size, spacing: parseFloat(this.letterSpacing) || 0 };
    }

    applyFont(f) {
      this.pdf.setFont('OpenSans', f.style);
      this.pdf.setFontSize(f.size * this.k);
      this.pdf.setCharSpace(f.spacing * this.k);
    }

    // Breedte zoals de PDF hem tekent: glyphs plus letterafstand na elk teken.
    // getTextWidth rekent de actieve letterafstand zelf al mee, dus die staat
    // tijdens het meten op 0 en komt er één keer bij.
    measureText(text) {
      const f = this.fontInfo();
      this.applyFont({ ...f, spacing: 0 });
      const width = this.pdf.getTextWidth(text) / this.k + f.spacing * Array.from(text).length;
      return { width };
    }

    fillText(text, x, y) {
      if (!text) return;
      const f = this.fontInfo();
      const color = this.styleColor(this.fillStyle, x, y);
      if (!color || color.a <= 0) return;
      const width = this.measureText(text).width;
      // Woord direct na het vorige op dezelfde regel, zelfde stijl: samenvoegen
      const last = this.ops[this.ops.length - 1];
      if (last && last.text && last.y === y && last.font.style === f.style && last.font.size === f.size
        && last.font.spacing === f.spacing && sameColor(last.color, color)) {
        const gap = x - last.end;
        const space = this.measureText(' ').width;
        if (Math.abs(gap) < 0.6) {
          last.text.value += text;
          last.end = x + width;
          return;
        }
        if (Math.abs(gap - space) < Math.max(1.2, space * 0.35)) {
          last.text.value += ` ${text}`;
          last.end = x + width;
          return;
        }
      }
      const op = () => this.withAlpha(color.a, () => {
        this.applyFont(f);
        this.pdf.setTextColor(color.r, color.g, color.b);
        this.pdf.text(op.text.value, x * this.k, y * this.k);
        this.pdf.setCharSpace(0);
      });
      Object.assign(op, { text: { value: text }, y, end: x + width, font: f, color });
      this.ops.push(op);
    }

    /* --- paden --- */

    beginPath() { this.path = []; }
    moveTo(x, y) { this.path.push({ pts: [[x, y]], closed: false }); }
    lineTo(x, y) {
      if (!this.path.length) this.moveTo(x, y);
      else this.path[this.path.length - 1].pts.push([x, y]);
    }
    closePath() { if (this.path.length) this.path[this.path.length - 1].closed = true; }
    rect(x, y, w, h) { this.path.push({ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true, rect: [x, y, w, h] }); }

    emit(subpaths) {
      const { pdf, k } = this;
      for (const sp of subpaths) {
        sp.pts.forEach(([x, y], i) => (i ? pdf.lineTo(x * k, y * k) : pdf.moveTo(x * k, y * k)));
        if (sp.closed) pdf.close();
      }
    }

    fill() { this.paint('fill', this.path.slice()); }
    stroke() { this.paint('stroke', this.path.slice()); }

    fillRect(x, y, w, h) {
      this.paint('fill', [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true, rect: [x, y, w, h] }]);
    }

    clip() {
      const subpaths = this.path.slice();
      this.ops.push(() => {
        this.emit(subpaths);
        this.pdf.clip();
        this.pdf.discardPath();
      });
    }

    paint(mode, subpaths) {
      if (!subpaths.length) return;
      const style = mode === 'fill' ? this.fillStyle : this.strokeStyle;
      const lineWidth = this.lineWidth;
      const cap = this.lineCap;
      const join = this.lineJoin;
      const draw = (sps, color) => {
        if (!color || color.a <= 0.002) return;
        this.ops.push(() => this.withAlpha(color.a, () => {
          if (mode === 'fill') {
            this.pdf.setFillColor(color.r, color.g, color.b);
            this.emit(sps);
            this.pdf.fill();
          } else {
            this.pdf.setDrawColor(color.r, color.g, color.b);
            this.pdf.setLineWidth(lineWidth * this.k);
            this.pdf.setLineCap(cap === 'round' ? 1 : cap === 'square' ? 2 : 0);
            this.pdf.setLineJoin(join === 'round' ? 1 : join === 'bevel' ? 2 : 0);
            this.emit(sps);
            this.pdf.stroke();
          }
        }));
      };

      if (!(style instanceof Gradient)) {
        draw(subpaths, parseColor(style));
        return;
      }
      // Verloop over één rechthoek: in smalle banen (lineair) of ringen (radiaal)
      if (mode === 'fill' && subpaths.length === 1 && subpaths[0].rect) {
        this.gradientRect(subpaths[0].rect, style);
        return;
      }
      // Anders (zeshoekpatroon): elke vorm krijgt de kleur van het verloop op zijn midden
      for (const sp of subpaths) {
        const cx = sp.pts.reduce((s, p) => s + p[0], 0) / sp.pts.length;
        const cy = sp.pts.reduce((s, p) => s + p[1], 0) / sp.pts.length;
        draw([sp], style.colorAt(style.t(cx, cy)));
      }
    }

    gradientRect([x, y, w, h], g) {
      const bands = 64;
      const box = { pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true };
      this.ops.push(() => {
        this.pdf.saveGraphicsState();
        this.emit([box]);
        this.pdf.clip();
        this.pdf.discardPath();
      });
      if (g.type === 'linear') {
        const [x0, y0, x1, y1] = g.args;
        const vertical = Math.abs(x1 - x0) < Math.abs(y1 - y0);
        const from = vertical ? Math.min(y0, y1) : Math.min(x0, x1);
        const to = vertical ? Math.max(y0, y1) : Math.max(x0, x1);
        // Buiten het verloop: effen kleur van het begin- of eindpunt
        const segs = [];
        if (vertical) {
          if (from > y) segs.push([y, from]);
          for (let i = 0; i < bands; i++) segs.push([from + ((to - from) * i) / bands, from + ((to - from) * (i + 1)) / bands]);
          if (to < y + h) segs.push([to, y + h]);
        } else {
          if (from > x) segs.push([x, from]);
          for (let i = 0; i < bands; i++) segs.push([from + ((to - from) * i) / bands, from + ((to - from) * (i + 1)) / bands]);
          if (to < x + w) segs.push([to, x + w]);
        }
        for (const [a, b] of segs) {
          const mid = (a + b) / 2;
          const color = vertical ? g.colorAt(g.t(x, mid)) : g.colorAt(g.t(mid, y));
          const pts = vertical ? [[x, a], [x + w, a], [x + w, b + 0.3], [x, b + 0.3]] : [[a, y], [b + 0.3, y], [b + 0.3, y + h], [a, y + h]];
          this.pushFill([{ pts, closed: true }], color);
        }
      } else {
        // Radiaal: ringen van buiten naar binnen (even-oneven, dus zonder overlap)
        const [, , r0, cx, cy, r1] = g.args;
        const ringPts = (r) => Array.from({ length: 72 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 72;
          return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
        });
        for (let i = bands - 1; i >= 0; i--) {
          const ra = r0 + ((r1 - r0) * i) / bands;
          const rb = r0 + ((r1 - r0) * (i + 1)) / bands;
          const color = g.colorAt((i + 0.5) / bands);
          if (!color || color.a <= 0.002) continue;
          const outer = { pts: ringPts(rb + 0.3), closed: true };
          const inner = ra > 0 ? [{ pts: ringPts(ra).reverse(), closed: true }] : [];
          this.pushFill([outer, ...inner], color, true);
        }
      }
      this.ops.push(() => this.pdf.restoreGraphicsState());
    }

    pushFill(subpaths, color, evenOdd = false) {
      if (!color || color.a <= 0.002) return;
      this.ops.push(() => this.withAlpha(color.a, () => {
        this.pdf.setFillColor(color.r, color.g, color.b);
        this.emit(subpaths);
        if (evenOdd) this.pdf.fillEvenOdd();
        else this.pdf.fill();
      }));
    }

    /* --- afbeeldingen --- */

    drawImage(img, dx, dy, dw, dh) {
      const w = dw != null ? dw : img.naturalWidth || img.width;
      const h = dh != null ? dh : img.naturalHeight || img.height;
      const svg = this.vectors.get(img);
      if (svg) {
        this.ops.push(() => drawSvg(this.pdf, svg, dx * this.k, dy * this.k, w * this.k, h * this.k));
        return;
      }
      const data = this.rasterize(img, w, h);
      if (!data) return;
      this.ops.push(() => this.pdf.addImage(data.url, data.type, dx * this.k, dy * this.k, w * this.k, h * this.k, data.alias, 'FAST'));
    }

    // Foto als JPEG (of PNG bij transparantie), niet groter dan nodig
    rasterize(img, w, h) {
      const nw = img.naturalWidth || img.width;
      const nh = img.naturalHeight || img.height;
      if (!nw || !nh) return null;
      const scale = Math.min(1, (w * this.rasterScale) / nw, 3200 / Math.max(nw, nh));
      const cw = Math.max(1, Math.round(nw * scale));
      const ch = Math.max(1, Math.round(nh * scale));
      const key = `${img.src || ''}|${cw}x${ch}`;
      if (this.imageCache.has(key)) return this.imageCache.get(key);
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      const cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, cw, ch);
      const transparent = /\.png|\.svg|image\/png|image\/svg/i.test(img.src || '');
      let url;
      try {
        url = transparent ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
      } catch (err) {
        throw err.name === 'SecurityError' ? PM.fileProtocolError() : err;
      }
      const data = { url, type: transparent ? 'PNG' : 'JPEG', alias: `img${this.imageCache.size}-${key.length}` };
      this.imageCache.set(key, data);
      return data;
    }

    /* --- doorzichtigheid en wegschrijven --- */

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

    styleColor(style, x, y) {
      return style instanceof Gradient ? style.colorAt(style.t(x, y)) : parseColor(style);
    }

    async flush() {
      for (const op of this.ops) await op();
      this.ops = [];
    }
  }

  function sameColor(a, b) {
    return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
  }

  // SVG-tekst als vector in de PDF (svg2pdf.js)
  async function drawSvg(pdf, markup, x, y, w, h) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden';
    holder.innerHTML = markup;
    document.body.appendChild(holder);
    try {
      const svg = holder.querySelector('svg');
      if (svg) await pdf.svg(svg, { x, y, width: w, height: h });
    } finally {
      holder.remove();
    }
  }

  global.PMPdfCanvas = PMPdfCanvas;
  global.PMPdfSvg = drawSvg;
})(window);
