/* =============================================================================
   styleguide/svg-path.js — een SVG (logo, badge, icoon) als canvas-paden
   -----------------------------------------------------------------------------
   De brandbook-pagina's tekenen het logo, de Emerce-badge en de iconen niet als
   afbeelding maar als paden: op het scherm scherp op elke maat, en in de PDF
   (PMPdfCanvas) echte vectoren zonder uitknippad. Daarom zetten we elke vorm
   om naar alleen absolute M, L, C en Z (bogen worden bezierkrommen), en tekenen
   we zonder translate of scale: de punten zelf worden omgerekend.

     PMSvgPath.parsePath(d)          [{ segs: [['M',x,y],['L',x,y],['C',…]], closed }]
     PMSvgPath.parseSvg(markup)      { viewBox: [x, y, w, h], shapes: [{ fill, rule, subs }] }
     PMSvgPath.draw(ctx, svg, box, opts)
                                     tekent de vormen in box { x, y, w, h } (passend, gecentreerd).
                                     opts.color: één kleur voor alles (het logo in wit of Inkt);
                                     opts.fit 'stretch' rekt uit (alleen voor het voorbeeld
                                     "niet vervormen"); opts.rotate draait om het midden (radialen).
                                     Vormen van één kleur na elkaar worden één pad: in Canva één element.
     PMSvgPath.toSvg(svg, color)     het SVG-bestand opnieuw, in één kleur (logo-pakket)

   Ondersteund: path (alle commando's), rect zonder afgeronde hoeken, polygon,
   polyline, circle en ellipse, met fill als attribuut, in style of via een
   klasse in <style>. Een transform op een vorm of groep wordt niet omgerekend:
   dan een fout, zodat we het merken (logo en badge hebben er geen).
   Geen DOM: dit bestand laadt ook in Node (voor de tests).
   ============================================================================= */
(function (global) {
  'use strict';

  const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
  const CMD = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
  const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

  const numbers = (s) => (String(s).match(NUM) || []).map(Number);

  // De vlaggen van een boog mogen zonder scheiding ("a1 1 0 01.5.5"): lees ze per teken
  function arcArgs(s) {
    const out = [];
    let rest = String(s);
    while (rest.trim()) {
      const slot = out.length % 7;
      if (slot === 3 || slot === 4) {
        const m = /^[\s,]*([01])/.exec(rest);
        if (!m) break;
        out.push(Number(m[1]));
        rest = rest.slice(m[0].length);
      } else {
        const m = new RegExp(`^[\\s,]*(${NUM.source})`).exec(rest);
        if (!m) break;
        out.push(Number(m[1]));
        rest = rest.slice(m[0].length);
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------------------
     Bogen: van eindpunten (SVG) naar middelpunt, in stukken van hoogstens 90°
     (SVG 1.1, bijlage F.6.5)
     ------------------------------------------------------------------------- */

  function arcToBeziers(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2) {
    if (x1 === x2 && y1 === y2) return [];
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (!rx || !ry) return [[x1, y1, x2, y2, x2, y2]];   // een rechte lijn
    const phi = (phiDeg * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const xp = cos * dx + sin * dy;
    const yp = -sin * dx + cos * dy;
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lambda > 1) {
      rx *= Math.sqrt(lambda);
      ry *= Math.sqrt(lambda);
    }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    let coef = Math.sqrt(Math.max(0, num / den));
    if (large === sweep) coef = -coef;
    const cxp = (coef * rx * yp) / ry;
    const cyp = (-coef * ry * xp) / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const angle = (ux, uy, vx, vy) => {
      const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      return a;
    };
    const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI;
    if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
    const step = dt / n;
    const k = (4 / 3) * Math.tan(step / 4);
    const point = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
    const deriv = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
    const out = [];
    let t = t1;
    for (let i = 0; i < n; i++) {
      const a = point(t);
      const da = deriv(t);
      const b = i === n - 1 ? [x2, y2] : point(t + step);
      const db = deriv(t + step);
      out.push([a[0] + k * da[0], a[1] + k * da[1], b[0] - k * db[0], b[1] - k * db[1], b[0], b[1]]);
      t += step;
    }
    return out;
  }

  /* ---------------------------------------------------------------------------
     Paden
     ------------------------------------------------------------------------- */

  function parsePath(d) {
    const subs = [];
    let sub = null;
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    let lastCtrl = null;   // [x, y] van het laatste controlepunt, voor S en T
    let lastCmd = '';

    const start = (px, py) => {
      sub = { segs: [['M', px, py]], closed: false };
      subs.push(sub);
      sx = px;
      sy = py;
    };
    const ensure = () => {
      if (!sub || sub.closed) start(x, y);
    };
    const line = (px, py) => {
      ensure();
      sub.segs.push(['L', px, py]);
      x = px;
      y = py;
    };
    const curve = (x1, y1, x2, y2, px, py) => {
      ensure();
      sub.segs.push(['C', x1, y1, x2, y2, px, py]);
      x = px;
      y = py;
    };

    CMD.lastIndex = 0;
    let m;
    while ((m = CMD.exec(String(d || ''))) !== null) {
      const letter = m[1];
      const C = letter.toUpperCase();
      const rel = letter !== C;
      const args = C === 'A' ? arcArgs(m[2]) : numbers(m[2]);
      if (C === 'Z') {
        if (sub) {
          sub.closed = true;
          x = sx;
          y = sy;
        }
        lastCtrl = null;
        lastCmd = 'Z';
        continue;
      }
      const n = ARGS[C];
      if (!args.length || args.length % n) throw new Error(`onvolledig padcommando ${letter}`);
      for (let i = 0; i < args.length; i += n) {
        const a = args.slice(i, i + n);
        const ox = rel ? x : 0;
        const oy = rel ? y : 0;
        // Na M zijn extra coördinaten lijnstukken
        const cmd = C === 'M' && i > 0 ? 'L' : C;
        if (cmd === 'M') {
          x = a[0] + ox;
          y = a[1] + oy;
          start(x, y);
          lastCtrl = null;
        } else if (cmd === 'L') {
          line(a[0] + ox, a[1] + oy);
          lastCtrl = null;
        } else if (cmd === 'H') {
          line(a[0] + (rel ? x : 0), y);
          lastCtrl = null;
        } else if (cmd === 'V') {
          line(x, a[0] + (rel ? y : 0));
          lastCtrl = null;
        } else if (cmd === 'C') {
          const c2 = [a[2] + ox, a[3] + oy];
          curve(a[0] + ox, a[1] + oy, c2[0], c2[1], a[4] + ox, a[5] + oy);
          lastCtrl = c2;
        } else if (cmd === 'S') {
          const c1 = lastCtrl && /[CS]/.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y];
          const c2 = [a[0] + ox, a[1] + oy];
          curve(c1[0], c1[1], c2[0], c2[1], a[2] + ox, a[3] + oy);
          lastCtrl = c2;
        } else if (cmd === 'Q' || cmd === 'T') {
          const q = cmd === 'Q'
            ? [a[0] + ox, a[1] + oy]
            : (lastCtrl && /[QT]/.test(lastCmd) ? [2 * x - lastCtrl[0], 2 * y - lastCtrl[1]] : [x, y]);
          const end = cmd === 'Q' ? [a[2] + ox, a[3] + oy] : [a[0] + ox, a[1] + oy];
          curve(x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y), end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1]), end[0], end[1]);
          lastCtrl = q;
        } else if (cmd === 'A') {
          const ex = a[5] + ox;
          const ey = a[6] + oy;
          for (const c of arcToBeziers(x, y, a[0], a[1], a[2], a[3], a[4], ex, ey)) curve(...c);
          x = ex;
          y = ey;
          lastCtrl = null;
        }
        lastCmd = cmd;
      }
    }
    return subs.filter((s) => s.segs.length > 1 || s.closed);
  }

  /* ---------------------------------------------------------------------------
     SVG-bestand: vormen, kleuren en de viewBox
     ------------------------------------------------------------------------- */

  function attrs(src) {
    const out = {};
    const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(src)) !== null) out[m[1]] = m[3] != null ? m[3] : m[4];
    return out;
  }

  function styleValue(style, name) {
    const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`).exec(style || '');
    return m ? m[1].trim() : null;
  }

  // Klassen uit <style>: alleen fill en fill-rule, meer gebruiken de logo's niet
  function classRules(markup) {
    const rules = {};
    const styles = markup.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    for (const block of styles) {
      const css = block.replace(/<\/?style[^>]*>/gi, '');
      const re = /([^{}]+)\{([^}]*)\}/g;
      let m;
      while ((m = re.exec(css)) !== null) {
        const decl = m[2];
        for (const sel of m[1].split(',')) {
          const name = sel.trim();
          if (!/^\.[\w-]+$/.test(name)) continue;
          rules[name.slice(1)] = { fill: styleValue(decl, 'fill'), rule: styleValue(decl, 'fill-rule') };
        }
      }
    }
    return rules;
  }

  function shapePath(tag, a) {
    const n = (k) => parseFloat(a[k]) || 0;
    if (tag === 'path') return a.d || '';
    if (tag === 'rect') {
      if (n('rx') || n('ry')) throw new Error('afgeronde rect');
      const [x, y, w, h] = [n('x'), n('y'), n('width'), n('height')];
      return w > 0 && h > 0 ? `M${x} ${y}H${x + w}V${y + h}H${x}Z` : '';
    }
    if (tag === 'polygon' || tag === 'polyline') {
      const p = numbers(a.points);
      if (p.length < 4) return '';
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return tag === 'polygon' ? `${d}Z` : d;
    }
    const cx = n('cx');
    const cy = n('cy');
    const rx = tag === 'circle' ? n('r') : n('rx');
    const ry = tag === 'circle' ? n('r') : n('ry');
    if (!(rx > 0 && ry > 0)) return '';
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }

  function parseSvg(markup) {
    const src = String(markup || '').replace(/<!--[\s\S]*?-->/g, '');
    const open = /<svg\b([^>]*)>/i.exec(src);
    if (!open) throw new Error('geen svg');
    const root = attrs(open[1]);
    let viewBox = numbers(root.viewBox);
    if (viewBox.length !== 4) viewBox = [0, 0, parseFloat(root.width) || 24, parseFloat(root.height) || 24];
    const classes = classRules(src);
    const body = src.replace(/<defs[\s\S]*?<\/defs>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const shapes = [];
    const re = /<(path|rect|polygon|polyline|circle|ellipse|g)\b([^>]*?)\/?>/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      const tag = m[1].toLowerCase();
      const a = attrs(m[2]);
      if (a.transform) throw new Error('transform wordt niet ondersteund');
      if (tag === 'g') continue;
      const cls = (a.class || '').split(/\s+/).map((c) => classes[c]).find(Boolean) || {};
      const fill = styleValue(a.style, 'fill') || a.fill || cls.fill || '#000000';
      if (fill === 'none') continue;
      const rule = styleValue(a.style, 'fill-rule') || a['fill-rule'] || cls.rule || 'nonzero';
      const subs = parsePath(shapePath(tag, a));
      if (subs.length) shapes.push({ fill: normalizeHex(fill), rule: rule === 'evenodd' ? 'evenodd' : 'nonzero', subs });
    }
    return { viewBox, shapes };
  }

  // #fff -> #ffffff, zodat vormen van dezelfde kleur samen één pad worden
  function normalizeHex(c) {
    const v = String(c).trim().toLowerCase();
    const m = /^#([0-9a-f]{3})$/.exec(v);
    return m ? `#${m[1].split('').map((h) => h + h).join('')}` : v;
  }

  /* ---------------------------------------------------------------------------
     Tekenen: punten omrekenen naar box, zonder transformatie op de context
     ------------------------------------------------------------------------- */

  function mapper(svg, box, opts = {}) {
    const [vx, vy, vw, vh] = svg.viewBox;
    let sx = box.w / vw;
    let sy = box.h / vh;
    let ox = box.x;
    let oy = box.y;
    if (opts.fit !== 'stretch') {
      const s = Math.min(sx, sy);
      ox += (box.w - vw * s) / 2;
      oy += (box.h - vh * s) / 2;
      sx = s;
      sy = s;
    }
    const rot = opts.rotate || 0;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return (px, py) => {
      const x = ox + (px - vx) * sx;
      const y = oy + (py - vy) * sy;
      if (!rot) return [x, y];
      return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
    };
  }

  function trace(ctx, subs, map) {
    for (const sub of subs) {
      for (const seg of sub.segs) {
        if (seg[0] === 'M') ctx.moveTo(...map(seg[1], seg[2]));
        else if (seg[0] === 'L') ctx.lineTo(...map(seg[1], seg[2]));
        else ctx.bezierCurveTo(...map(seg[1], seg[2]), ...map(seg[3], seg[4]), ...map(seg[5], seg[6]));
      }
      if (sub.closed) ctx.closePath();
    }
  }

  // Vormen met dezelfde kleur en regel achter elkaar: één pad, één element
  function groups(svg, color) {
    const out = [];
    for (const shape of svg.shapes) {
      const fill = color || shape.fill;
      const last = out[out.length - 1];
      if (last && last.fill === fill && last.rule === shape.rule) last.subs.push(...shape.subs);
      else out.push({ fill, rule: shape.rule, subs: shape.subs.slice() });
    }
    return out;
  }

  function draw(ctx, svg, box, opts = {}) {
    if (!svg) return;
    const map = mapper(svg, box, opts);
    for (const g of groups(svg, opts.color)) {
      ctx.beginPath();
      trace(ctx, g.subs, map);
      ctx.fillStyle = g.fill;
      if (g.rule === 'evenodd') ctx.fill('evenodd');
      else ctx.fill();
    }
  }

  // Het pad als SVG-tekst (absolute M, L, C, Z), met hoogstens 3 decimalen
  const num = (v) => {
    const s = (Math.round(v * 1000) / 1000).toString();
    return s === '-0' ? '0' : s;
  };
  function pathData(subs) {
    return subs.map((sub) => sub.segs.map(([op, ...a]) => op + a.map(num).join(' ')).join('') + (sub.closed ? 'Z' : '')).join('');
  }

  // Een nette SVG in één kleur, met dezelfde viewBox (voor het logo-pakket)
  function toSvg(svg, color, { title } = {}) {
    const [x, y, w, h] = svg.viewBox;
    const paths = groups(svg, color).map((g) => `  <path fill="${g.fill}"${g.rule === 'evenodd' ? ' fill-rule="evenodd"' : ''} d="${pathData(g.subs)}"/>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}">\n${title ? `  <title>${title}</title>\n` : ''}${paths}\n</svg>\n`;
  }

  const PMSvgPath = { parsePath, parseSvg, arcToBeziers, draw, toSvg, pathData, normalizeHex };

  if (typeof module !== 'undefined' && module.exports) module.exports = PMSvgPath;
  if (global && global.document) global.PMSvgPath = PMSvgPath;
})(typeof window !== 'undefined' ? window : globalThis);
