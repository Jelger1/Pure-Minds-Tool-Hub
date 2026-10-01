/* =============================================================================
   canvas-kit.js — gedeelde tekenbouwstenen voor alle Pure Minds canvas-tools
   -----------------------------------------------------------------------------
   Gebruikt door de Insta Post Maker (js/insta/templates.js) en de Presentation
   Maker (js/presentation/templates.js). Alles wat het merk bepaalt zit hier op
   één plek: kleuren, Pure Minds Sans, de puntige zeshoek (net als het logo), het
   zeshoekpatroon, tekstopmaak met **nadruk** en de cyaan punt, foto's in een
   vak of zeshoek, het label met zeshoek-bullet, de voetregel en het logo.

   Een template geeft een raster (fr) mee met o.a. m (marge), w, h,
   labelTop, labelSize, footerY, footerSize, contentW en logo {x, y, w, h};
   posts ook badge {x, y, w, h} voor het keurmerk linksonder.
   ============================================================================= */
(function (global) {
  'use strict';

  const COLORS = {
    cyan: '#1ab9e2',     // Pure Cyaan: accenten, vlakken, lijnen
    tint: '#e8f7fc',
    soft: '#f2fbfe',
    blue: '#1b71a8',
    deep: '#005aaf',
    magenta: '#b61b50',  // Pure Magenta: alleen de hoofdactie
    green: '#009670',
    ink: '#303030',      // Inkt: tekst en donkere vlakken
    muted: '#5c6670',
    line: '#e1e7ec',
    canvas: '#edf3f7',
    hexline: '#90a4b4',  // lijnkleur van het zeshoekpatroon
    navy: '#10283c',     // donkere ondertoon voor verlopen over foto's
  };

  const FONT_FAMILY = '"Pure Minds Sans", "Open Sans", Arial, sans-serif';
  const CAP = 0.714;   // cap-hoogte van Pure Minds Sans als fractie van de korpsgrootte
  const DESC = 0.24;   // ruimte onder de laatste basislijn
  const SQRT3 = Math.sqrt(3);

  // Wordt gezet zodra een tekst niet in zijn vak past; prepare() zet hem terug
  const flags = { overflow: false };

  /* ---------------------------------------------------------------------------
     Basis: kleur, font, zeshoek
     ------------------------------------------------------------------------- */

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function setFont(ctx, weight, size, track = 0) {
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(size * track).toFixed(2)}px`;
  }

  // Puntige zeshoek (punt boven), net als het logo; r = straal tot de hoekpunten
  function addHex(ctx, cx, cy, r) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function hexPath(ctx, cx, cy, r) {
    ctx.beginPath();
    addHex(ctx, cx, cy, r);
  }

  /**
   * Lijnpatroon van zeshoeken, zoals op de cover van het brandbook en de
   * achtergrond van de interne tools. Eén pad, één stroke: gedeelde randen
   * worden dus niet dubbel zo donker. Het verloop laat het patroon vervagen.
   */
  function hexPattern(ctx, fr, o) {
    const r = o.r || 90;
    const colW = SQRT3 * r;
    const rowH = 1.5 * r;
    ctx.save();
    ctx.beginPath();
    for (let row = -1; row * rowH < fr.h + r; row++) {
      const y = row * rowH;
      const shift = row % 2 !== 0 ? colW / 2 : 0;
      for (let x = -colW + shift; x < fr.w + colW; x += colW) addHex(ctx, x, y, r);
    }
    const g = ctx.createLinearGradient(o.x0, o.y0, o.x1, o.y1);
    g.addColorStop(0, rgba(o.color, o.alpha));
    g.addColorStop(1, rgba(o.color, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = o.lineWidth || 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Inkt met een zachte cyaan gloed rechtsboven en het zeshoekpatroon
  function paintBackground(ctx, fr) {
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, fr.w, fr.h);
    const glow = ctx.createRadialGradient(fr.w, 0, 0, fr.w, 0, fr.w * 0.9);
    glow.addColorStop(0, 'rgba(26,185,226,.16)');
    glow.addColorStop(1, 'rgba(26,185,226,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, fr.w, fr.h);
    hexPattern(ctx, fr, { color: '#ffffff', alpha: 0.08, x0: 0, y0: 0, x1: 0, y1: fr.h * 0.8 });
  }

  /* ---------------------------------------------------------------------------
     Tekst: **nadruk**, automatische regelval en passend maken
     ------------------------------------------------------------------------- */

  /**
   * Zet tekst om in runs. `**woord**` wordt nadruk. Met dot: true krijgt de kop
   * de cyaan punt uit het merk ("Pure Minds."), tenzij hij al eindigt op ! of ?.
   */
  function runsFrom(text, { dot = false } = {}) {
    const src = String(text || '').replace(/\r/g, '').trim();
    const runs = [];
    let em = false;
    src.split('**').forEach((part, i) => {
      if (i > 0) em = !em;
      if (part) runs.push({ text: part, em });
    });
    if (dot && runs.length) {
      const last = runs[runs.length - 1];
      const t = last.text.replace(/\s+$/, '');
      if (/[^.]\.$|^\.$/.test(t)) {
        last.text = t.slice(0, -1);
        runs.push({ text: '.', accent: true });
      } else if (!/[.!?…:;,]$/.test(t)) {
        last.text = t;
        runs.push({ text: '.', accent: true });
      }
    }
    return runs.filter((r) => r.text);
  }

  function layoutText(ctx, runs, maxW, st) {
    const lineH = st.size * st.lh;
    if (!runs.length) return { lines: [], st, lineH, height: 0, maxW };

    // Woorden opbouwen; runs zonder spatie ertussen blijven aan elkaar vast
    const words = [];
    let cur = null;
    const flush = () => {
      if (cur) words.push(cur);
      cur = null;
    };
    for (const run of runs) {
      for (const tok of run.text.split(/(\n|[ \t]+)/)) {
        if (!tok) continue;
        if (tok === '\n') {
          flush();
          words.push(null);
        } else if (/^[ \t]+$/.test(tok)) {
          flush();
        } else {
          (cur || (cur = [])).push({ text: tok, em: !!run.em, accent: !!run.accent });
        }
      }
    }
    flush();

    const measure = (seg) => {
      setFont(ctx, seg.em ? st.emWeight : st.weight, st.size, st.track);
      return ctx.measureText(seg.text).width;
    };
    setFont(ctx, st.weight, st.size, st.track);
    const space = ctx.measureText(' ').width;

    const lines = [];
    let broken = false;
    let line = { segs: [], w: 0 };
    const newLine = () => {
      lines.push(line);
      line = { segs: [], w: 0 };
    };

    for (const word of words) {
      if (word === null) {
        newLine();
        continue;
      }
      const segs = word.map((s) => ({ ...s, w: measure(s) }));
      const ww = segs.reduce((sum, s) => sum + s.w, 0);
      if (line.segs.length && line.w + space + ww > maxW) newLine();
      if (ww > maxW) {
        // Eén woord breder dan de kolom (bijv. een URL): op tekens afbreken
        broken = true;
        if (line.segs.length) {
          line.segs.push({ space: true, w: space });
          line.w += space;
        }
        for (const s of segs) {
          for (const ch of Array.from(s.text)) {
            const c = { ...s, text: ch };
            c.w = measure(c);
            if (line.segs.length && line.w + c.w > maxW) newLine();
            line.segs.push(c);
            line.w += c.w;
          }
        }
        continue;
      }
      if (line.segs.length) {
        line.segs.push({ space: true, w: space });
        line.w += space;
      }
      line.segs.push(...segs);
      line.w += ww;
    }
    lines.push(line);

    return {
      lines,
      st,
      lineH,
      broken,
      height: st.size * CAP + (lines.length - 1) * lineH + st.size * DESC,
      maxW,
    };
  }

  // Grootste korpsgrootte waarbij de tekst binnen maxW × maxH past, zonder
  // woorden middenin af te breken zolang een kleinere maat dat kan voorkomen
  function fitText(ctx, runs, maxW, maxH, st, { min, maxLines = Infinity } = {}) {
    let block = null;
    let fallback = null;
    for (let size = st.size; size >= min; size -= 2) {
      block = layoutText(ctx, runs, maxW, { ...st, size });
      if (block.height <= maxH && block.lines.length <= maxLines) {
        if (!block.broken) return block;
        if (!fallback) fallback = block;
      }
    }
    if (fallback) return fallback;
    if (block && block.lines.length) flags.overflow = true;
    return block || layoutText(ctx, runs, maxW, st);
  }

  function drawText(ctx, block, x, top, { color, em, accent = COLORS.cyan, align = 'left' }) {
    if (!block || !block.lines.length) return;
    const { st, lineH } = block;
    const cap = st.size * CAP;

    block.lines.forEach((line, i) => {
      const base = top + cap + i * lineH;
      const x0 = align === 'center' ? x + (block.maxW - line.w) / 2 : align === 'right' ? x + block.maxW - line.w : x;

      let lx = x0;
      for (const s of line.segs) {
        if (!s.space) {
          setFont(ctx, s.em ? st.emWeight : st.weight, st.size, st.track);
          ctx.fillStyle = s.accent ? accent : s.em ? em : color;
          ctx.fillText(s.text, lx, base);
        }
        lx += s.w;
      }
    });
  }

  /**
   * Regels van lopende tekst: een regel die met "- " begint is een
   * opsommingspunt; `blank` telt de lege regels ervoor (extra lucht).
   * Ook de PowerPoint-export gebruikt dit, zodat de alinea's daar gelijk zijn.
   */
  function parseBody(text) {
    const out = [];
    let blank = 0;
    String(text || '').replace(/\r/g, '').trim().split('\n').forEach((raw) => {
      if (!raw.trim()) {
        blank++;
        return;
      }
      const bullet = /^\s*[-•]\s+/.test(raw);
      out.push({ bullet, text: bullet ? raw.replace(/^\s*[-•]\s+/, '') : raw.trim(), blank });
      blank = 0;
    });
    return out;
  }

  /**
   * Lopende tekst in alinea's. Een regel die met "- " begint wordt een
   * opsommingspunt met een cyaan zeshoekje; een lege regel geeft extra lucht.
   */
  function layoutBody(ctx, text, maxW, st) {
    // st.indent: inspringing van de punten als factor van het korps (standaard 1,15);
    // een groter teken dan het zeshoekje (zoals een icoon) heeft meer ruimte nodig
    const indent = st.size * (st.indent != null ? st.indent : 1.15);
    // st.itemGap: ruimte tussen de punten als factor van het korps (standaard 0.5)
    const gap = st.size * (st.itemGap != null ? st.itemGap : 0.5);
    const items = [];
    let height = 0;
    for (const line of parseBody(text)) {
      const block = layoutText(ctx, runsFrom(line.text), maxW - (line.bullet ? indent : 0), st);
      const y = items.length ? height + gap + line.blank * st.size * 0.5 : 0;
      items.push({ block, bullet: line.bullet, y, text: line.text });
      height = y + block.height;
    }
    return { items, height, st, indent };
  }

  function drawBody(ctx, body, x, top, colors) {
    const { st } = body;
    for (const item of body.items) {
      // st.bullet(ctx, item, x, y, st): een eigen teken in plaats van het zeshoekje
      if (item.bullet && st.bullet) st.bullet(ctx, item, x, top + item.y, st);
      else if (item.bullet) {
        const cap = st.size * CAP;
        hexPath(ctx, x + st.size * 0.3, top + item.y + cap / 2, st.size * 0.22);
        ctx.fillStyle = COLORS.cyan;
        ctx.fill();
      }
      drawText(ctx, item.block, x + (item.bullet ? body.indent : 0), top + item.y, colors);
    }
  }

  /* ---------------------------------------------------------------------------
     Iconen uit het icon pack (Remix, 24 × 24), als pad: alleen absolute M, L, C
     en Z, zodat ze zonder translate of scale te tekenen zijn en de PDF-export
     ze als vectors overneemt. Omgezet uit assets/icons (de -line-varianten).
     ------------------------------------------------------------------------- */

  const ICON_SRC = {
    mail: 'M3 3L21 3C21.55 3 22 3.45 22 4L22 20C22 20.55 21.55 21 21 21L3 21C2.45 21 2 20.55 2 20L2 4C2 3.45 2.45 3 3 3ZM20 7.24L12.07 14.34L4 7.22L4 19L20 19L20 7.24ZM4.51 5L12.06 11.66L19.5 5L4.51 5Z',
    phone: 'M9.37 10.68C10.3 12.33 11.67 13.7 13.32 14.63L14.2 13.4C14.5 12.98 15.05 12.86 15.5 13.1C16.9 13.87 18.46 14.34 20.08 14.46C20.6 14.5 21 14.94 21 15.46L21 19.92C21 20.44 20.61 20.87 20.1 20.92C19.57 20.97 19.04 21 18.5 21C9.94 21 3 14.06 3 5.5C3 4.96 3.03 4.43 3.08 3.9C3.13 3.39 3.56 3 4.08 3L8.54 3C9.06 3 9.5 3.4 9.54 3.92C9.66 5.54 10.13 7.1 10.9 8.5C11.14 8.95 11.02 9.5 10.6 9.8L9.37 10.68ZM6.84 10.03L8.74 8.67C8.21 7.51 7.84 6.27 7.65 5L5.01 5C5 5.17 5 5.33 5 5.5C5 12.96 11.04 19 18.5 19C18.67 19 18.83 19 19 18.99L19 16.35C17.73 16.16 16.49 15.79 15.33 15.26L13.97 17.16C13.43 16.94 12.9 16.69 12.39 16.41L12.33 16.37C10.37 15.26 8.74 13.63 7.63 11.67L7.59 11.61C7.31 11.1 7.06 10.57 6.84 10.03Z',
    web: 'M12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22ZM9.71 19.67C8.75 17.63 8.16 15.37 8.03 13L4.06 13C4.46 16.18 6.72 18.77 9.71 19.67ZM10.03 13C10.18 15.44 10.88 17.73 12 19.75C13.12 17.73 13.82 15.44 13.97 13L10.03 13ZM19.94 13L15.97 13C15.84 15.37 15.25 17.63 14.29 19.67C17.28 18.77 19.54 16.18 19.94 13ZM4.06 11L8.03 11C8.16 8.63 8.75 6.37 9.71 4.33C6.72 5.23 4.46 7.82 4.06 11ZM10.03 11L13.97 11C13.82 8.56 13.12 6.27 12 4.25C10.88 6.27 10.18 8.56 10.03 11ZM14.29 4.33C15.25 6.37 15.84 8.63 15.97 11L19.94 11C19.54 7.82 17.28 5.23 14.29 4.33Z',
    user: 'M4 22C4 17.58 7.58 14 12 14C16.42 14 20 17.58 20 22L18 22C18 18.69 15.31 16 12 16C8.69 16 6 18.69 6 22L4 22ZM12 13C8.69 13 6 10.32 6 7C6 3.69 8.69 1 12 1C15.32 1 18 3.69 18 7C18 10.32 15.32 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z',
  };

  // Per icoon de opdrachten: [['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Z']]
  const ICONS = {};
  Object.keys(ICON_SRC).forEach((name) => {
    ICONS[name] = Array.from(ICON_SRC[name].matchAll(/([MLCZ])([^MLCZ]*)/g), (m) => [m[1], ...m[2].trim().split(/\s+/).filter(Boolean).map(Number)]);
  });

  // Icoon met zijn vak van 24 × 24 op (x, y), size breed en hoog, gevuld in één kleur
  function drawIcon(ctx, name, x, y, size, color) {
    const cmds = ICONS[name];
    if (!cmds) return;
    const k = size / 24;
    const X = (v) => x + v * k;
    const Y = (v) => y + v * k;
    ctx.beginPath();
    for (const c of cmds) {
      if (c[0] === 'M') ctx.moveTo(X(c[1]), Y(c[2]));
      else if (c[0] === 'L') ctx.lineTo(X(c[1]), Y(c[2]));
      else if (c[0] === 'C') ctx.bezierCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]), X(c[5]), Y(c[6]));
      else ctx.closePath();
    }
    ctx.fillStyle = color;
    ctx.fill();
  }

  function ellipsize(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  /* ---------------------------------------------------------------------------
     Vaste onderdelen: label, voetregel, logo, badge, pijl, cta-blok
     Maten komen uit het raster (fr.labelSize, fr.footerSize), zodat posts en
     slides dezelfde verhoudingen houden.
     ------------------------------------------------------------------------- */

  function drawLabel(ctx, fr, text, pal, maxW = fr.contentW) {
    const value = String(text || '').trim();
    if (!value) return;
    const size = fr.labelSize || 24;
    const cap = size * CAP;
    const r = size / 2;
    hexPath(ctx, fr.m + r * SQRT3 / 2, fr.labelTop + cap / 2, r);
    ctx.fillStyle = pal.bullet;
    ctx.fill();
    const tx = fr.m + r * SQRT3 + (size * 2) / 3;
    setFont(ctx, 700, size, 0.12);
    ctx.fillStyle = pal.label;
    ctx.fillText(ellipsize(ctx, value.toUpperCase(), maxW - (tx - fr.m)), tx, fr.labelTop + cap);
  }

  // "pureminds.nl" met de cyaan punt uit het merk
  function drawDomain(ctx, fr, color) {
    const size = fr.footerSize || 24;
    setFont(ctx, 700, size, 0.02);
    const y = fr.footerY + (size * CAP) / 2;
    let x = fr.m;
    [['pureminds', color], ['.', COLORS.cyan], ['nl', color]].forEach(([part, fill]) => {
      ctx.fillStyle = fill;
      ctx.fillText(part, x, y);
      x += ctx.measureText(part).width;
    });
  }

  // Het witte logo zonder vlak erachter: de achtergrond blijft erdoorheen zichtbaar
  function drawLogo(ctx, fr, img) {
    if (!img || !img.complete || !img.naturalWidth) return;
    const L = fr.logo;
    ctx.drawImage(img, L.x, L.y, L.w, L.h);
  }

  // Keurmerk (de Emerce 100-badge) op fr.badge. Het is een SVG: de browser
  // tekent hem op de doelmaat, dus ook op 2160 px scherp; in een PDF via vectors
  function drawBadge(ctx, fr, img) {
    if (!img || !img.complete || !img.naturalWidth || !fr.badge) return;
    const B = fr.badge;
    ctx.drawImage(img, B.x, B.y, B.w, B.h);
  }

  function drawArrow(ctx, x, y, len, color, lw, head = 13) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'butt';  // brandbook: rechte uiteinden
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len - lw * 0.7, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + len - head, y - head);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x + len - head, y + head);
    ctx.stroke();
    ctx.restore();
  }

  // Cta-blok: magenta, rechte hoeken, kleine letters, tekst in het midden.
  // Bewust zonder pijl: het is een oproep, geen knop om op te klikken
  function planCta(ctx, label, s = 1) {
    const size = 28 * s;
    const padX = 34 * s;
    const h = 78 * s;
    const text = String(label || '').trim() || 'lees meer';
    setFont(ctx, 700, size, 0.01);
    const tw = ctx.measureText(text).width;
    const w = padX + tw + padX;
    return {
      w,
      h,
      draw(x, y) {
        ctx.fillStyle = COLORS.magenta;
        ctx.fillRect(x, y, w, h);
        setFont(ctx, 700, size, 0.01);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x + padX, y + h / 2 + (size * CAP) / 2);
      },
    };
  }

  /* ---------------------------------------------------------------------------
     Foto's
     ------------------------------------------------------------------------- */

  /**
   * Tekent een foto passend in een vak (object-fit: cover), met zoom en
   * uitsnede. Geeft terug hoeveel beeld er buiten het vak valt; de app
   * gebruikt dat om de foto in de preview te verslepen.
   */
  function drawPhoto(ctx, img, box, crop) {
    ctx.save();
    ctx.beginPath();
    if (box.hex) addHex(ctx, box.hex.cx, box.hex.cy, box.hex.r);
    else ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    let info = null;
    const iw = img && (img.naturalWidth || img.width);
    const ih = img && (img.naturalHeight || img.height);
    if (iw && ih) {
      const zoom = clamp(Number(crop && crop.zoom) || 1, 1, 4);
      const fx = clamp(crop && crop.fx != null ? crop.fx : 0.5, 0, 1);
      const fy = clamp(crop && crop.fy != null ? crop.fy : 0.5, 0, 1);
      const scale = Math.max(box.w / iw, box.h / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const overflowX = dw - box.w;
      const overflowY = dh - box.h;
      ctx.drawImage(img, box.x - overflowX * fx, box.y - overflowY * fy, dw, dh);
      info = { overflowX, overflowY };
    } else {
      // Lege staat: merkvlak met patroon en een aanwijzing
      ctx.fillStyle = '#3a4652';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      hexPattern(ctx, { w: box.x + box.w, h: box.y + box.h }, {
        r: 48, color: '#ffffff', alpha: 0.1,
        x0: 0, y0: box.y, x1: 0, y1: box.y + box.h * 1.2,
      });
      setFont(ctx, 700, box.hintSize || 26, 0.02);
      const hint = 'sleep hier je foto';
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      const tw = ctx.measureText(hint).width;
      // Op een volledig beeld staat de aanwijzing hoog, zodat hij niet door de tekst loopt
      const hy = box.hex ? box.y + box.h / 2 : box.y + box.h * 0.3;
      ctx.fillText(hint, box.x + (box.w - tw) / 2, hy + (box.hintSize || 26) * 0.35);
    }
    ctx.restore();
    return info;
  }

  function drawContain(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width || 300;
    const ih = img.naturalHeight || img.height || 150;
    const s = Math.min(w / iw, h / ih);
    ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
  }

  /**
   * Zeshoek-duo: een verschoven cyaan lijn-zeshoek achter een gevulde zeshoek.
   * Dit vormelement komt in elk template met een zeshoek op dezelfde manier
   * terug (zelfde verschuiving en lijndikte, relatief aan de grootte).
   */
  function hexEcho(ctx, cx, cy, r, lw = 6) {
    hexPath(ctx, cx - r * 0.17, cy + r * 0.15, r);
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  // Canvas klaarzetten op de gevraagde schaal (1 = ontwerpraster)
  function prepare(canvas, w, h, scale = 1) {
    const pw = Math.round(w * scale);
    const ph = Math.round(h * scale);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    flags.overflow = false;
    return ctx;
  }

  // Cyaan balk bovenaan en letterspatiëring terug op nul: altijd als laatste
  function finish(ctx, w, bar) {
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(0, 0, w, bar);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  global.PMCanvas = {
    COLORS, FONT_FAMILY, CAP, DESC, SQRT3, flags,
    clamp, rgba, setFont, addHex, hexPath, hexPattern, paintBackground,
    runsFrom, layoutText, fitText, drawText, parseBody, layoutBody, drawBody, ellipsize,
    ICONS, drawIcon, drawLabel, drawDomain, drawLogo, drawBadge, drawArrow, planCta,
    drawPhoto, drawContain, hexEcho, prepare, finish,
  };
})(window);
