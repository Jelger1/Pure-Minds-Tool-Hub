/* =============================================================================
   presentation/pptx.js — de presentatie als bewerkbaar PowerPoint-bestand
   -----------------------------------------------------------------------------
   Gebruikt hetzelfde plan als de preview (js/presentation/templates.js): elke
   slide wordt opgebouwd uit tekstvakken, vormen en foto's op precies de plek
   van het canvas, in dezelfde korpsgrootte. In PowerPoint blijft alles
   bewerkbaar:

     tekst      echte tekstvakken; wordt de tekst langer, dan krimpt hij zoals
                in de tool ("tekst verkleinen bij overloop")
     foto's     als vulling van de zeshoek of als bijgesneden afbeelding, met
                dezelfde uitsnede als in de preview
     master     achtergrond, cyaan balk, logo en voetregel staan op de
                Pure Minds-master: een nieuwe slide in PowerPoint krijgt ze
                vanzelf en ze staan niet per ongeluk in de weg
     nummer     het slidenummer is een echt veld en telt mee als je slides
                toevoegt of verschuift

   Lettertype: Open Sans (op de computer geïnstalleerd, of anders vervangt
   PowerPoint het). Google Slides heeft Open Sans standaard.
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;
  const S = global.PMSlides;
  const K = global.PMCanvas;
  const { COLORS, CAP, DESC, SQRT3, runsFrom, parseBody } = K;
  const { W, H, GRID, GEOM } = S;
  const { TEXT, SOFT, LABEL_PAL } = S.palettes;

  const LINE = 1.362;   // regelhoogte van Open Sans bij regelafstand 100% (em)
  const ASC = 1.0688;   // ascender van Open Sans (em): PowerPoint zet de basislijn zo ver onder de bovenkant van de regel
  const WHITE = '#ffffff';
  // Zeshoek als opsommingsteken: een tekstteken (geen plaatje), zodat het ook
  // in Google Slides en Keynote een opsomming blijft
  const BULLET = { char: '⬢', font: 'Segoe UI Symbol', color: COLORS.cyan, size: 0.75 };

  /* ---------------------------------------------------------------------------
     Tekst: van canvas-maten naar PowerPoint-maten
     ------------------------------------------------------------------------- */

  // Op het canvas staat de kap-hoogte van de eerste regel precies op de
  // bovenkant van het blok; in PowerPoint zit daar de ascender boven. Deze
  // afstand schuift het tekstvak omhoog, zodat de letters op dezelfde plek komen.
  const capOffset = (st) => ((st.lh / LINE) * ASC - CAP) * st.size;
  // Ruimte onder de laatste basislijn van een alinea in PowerPoint
  const descent = (st) => (st.lh / LINE) * (LINE - ASC) * st.size;

  // Alinea-afstand zodat de volgende alinea op dezelfde hoogte begint als op het canvas
  function spaceBefore(prev, st, gap) {
    if (!prev) return 0;
    return Math.max(0, gap - capOffset(st) - (DESC * prev.size - descent(prev)));
  }

  function toRuns(runs, st, colors) {
    return runs.map((r) => ({
      text: r.text,
      size: st.size,
      weight: r.em ? st.emWeight : st.weight,
      track: st.track,
      color: r.accent ? COLORS.cyan : r.em ? colors.em : colors.color,
    }));
  }

  // De tekstblokken van een slide (titel, ondertitel, punten) als alinea's van één tekstvak
  function stackParagraphs(stack) {
    const paragraphs = [];
    let prev = null;
    for (const b of stack.blocks) {
      if (b.empty) continue;
      const st = b.block.st;
      const colors = b.colors || TEXT;
      if (b.body != null) {
        parseBody(b.body).forEach((line, i) => {
          const gap = i === 0 ? b.gap : st.size * 0.5 * (1 + line.blank);
          paragraphs.push({
            runs: toRuns(runsFrom(line.text), st, colors),
            lh: st.lh,
            spcBef: spaceBefore(prev, st, gap),
            bullet: line.bullet ? BULLET : null,
            indent: line.bullet ? st.size * 1.15 : 0,
          });
          prev = st;
        });
      } else {
        paragraphs.push({ runs: toRuns(b.runs, st, colors), lh: st.lh, spcBef: spaceBefore(prev, st, b.gap) });
        prev = st;
      }
    }
    return paragraphs;
  }

  // Het tekstvak van een slide: gecentreerd in het tekstgebied of bovenaan, zoals het plan
  function stackBox(fr, p) {
    const paragraphs = stackParagraphs(p.stack);
    const first = p.stack.blocks.find((b) => !b.empty);
    if (!first || !paragraphs.length) return null;
    const st = first.block.st;
    const w = p.maxW + 2;  // vrijwel exact de canvasbreedte, zodat de regelval gelijk blijft
    if (p.center) {
      return { kind: 'text', x: p.x, y: fr.contentTop, w, h: fr.contentBottom - fr.contentTop, anchor: 'ctr', autofit: 'shrink', paragraphs, name: 'Tekst' };
    }
    const y = p.top + first.gap - capOffset(st);
    return { kind: 'text', x: p.x, y, w, h: p.maxH - (y - p.top), anchor: 't', autofit: 'shrink', paragraphs, name: 'Tekst' };
  }

  // Tekstvak van één regel, met de basislijn op `baseline`
  function line(x, baseline, w, runs, opts = {}) {
    const list = Array.isArray(runs) ? runs : [runs];
    const size = list[0].size;
    return {
      kind: 'text', x, y: baseline - ASC * size, w, h: LINE * size,
      anchor: 't', wrap: false, autofit: 'none', name: opts.name,
      paragraphs: [{ runs: list, lh: LINE, align: opts.align }],
    };
  }

  const hex = (cx, cy, r, fill, stroke, name, text) => ({ kind: 'hex', cx, cy, r, fill, line: stroke, name, text });

  // De tabel uit het plan als echte PowerPoint-tabel. PowerPoint rekent een
  // regel als korps × regelafstand; het canvas van kap-hoogte tot onderkant.
  // Het verschil gaat van de marges af, zodat de rijen even hoog blijven.
  function tableObject(T) {
    return {
      kind: 'table', name: 'Tabel', x: T.x, y: T.y, colW: T.widths, firstRow: T.header,
      rows: T.rows.map((row) => ({
        h: row.h,
        cells: row.cells.map((cell) => {
          const st = cell.st;
          const extra = ((st.lh - CAP - DESC) * st.size) / 2;
          const padY = Math.max(0, (row.h - Math.max(cell.block.lines.length, 1) * st.lh * st.size) / 2);
          return {
            paragraphs: [{ runs: toRuns(cell.runs, st, cell.colors), lh: st.lh, align: cell.align === 'right' ? 'r' : 'l', endSize: st.size }],
            fill: row.fill ? { color: row.fill } : null,
            lineB: { color: row.rule, width: row.ruleW },
            mar: { l: T.padX, r: T.padX, t: Math.min(padY, T.padY - extra), b: Math.min(padY, T.padY - extra) },
            anchor: 'ctr',
          };
        }),
      })),
    };
  }

  /* ---------------------------------------------------------------------------
     Vaste onderdelen: balk, logo, voetregel, label, slidenummer
     ------------------------------------------------------------------------- */

  const bar = () => ({ kind: 'rect', x: 0, y: 0, w: W, h: GRID.bar, fill: { color: COLORS.cyan }, name: 'Balk' });
  const logo = (fr, image) => ({ kind: 'pic', ...fr.logo, image, name: 'Logo' });

  function domain(fr) {
    const size = fr.footerSize;
    const run = (text, color) => ({ text, size, weight: 700, track: 0.02, color });
    return line(fr.m, fr.footerY + (size * CAP) / 2, 400, [run('pureminds', WHITE), run('.', COLORS.cyan), run('nl', WHITE)], { name: 'pureminds.nl' });
  }

  function label(fr, text, maxW = fr.contentW) {
    const value = String(text || '').trim();
    if (!value) return [];
    const size = fr.labelSize;
    const cap = size * CAP;
    const r = size / 2;
    const tx = fr.m + r * SQRT3 + (size * 2) / 3;
    return [
      hex(fr.m + (r * SQRT3) / 2, fr.labelTop + cap / 2, r, { color: LABEL_PAL.bullet }, null, 'Label-zeshoek'),
      line(tx, fr.labelTop + cap, Math.max(200, maxW - (tx - fr.m)), { text: value, size, weight: 700, track: 0.12, caps: true, color: LABEL_PAL.label }, { name: 'Label' }),
    ];
  }

  function slideNumber(fr) {
    const size = GRID.footerSize;
    const w = 400;
    return {
      kind: 'sldnum', x: fr.logo.x - 44 - w, y: fr.footerY + (size * CAP) / 2 - ASC * size, w, h: LINE * size,
      align: 'r', run: { size, weight: 700, track: 0.04, color: SOFT },
    };
  }

  /* ---------------------------------------------------------------------------
     Afbeeldingen
     ------------------------------------------------------------------------- */

  function dataUrlBytes(url) {
    return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  }

  // Uitsnede van een foto in een vak (object-fit: cover met zoom en focus),
  // als fracties van het bronbeeld die wegvallen (links, boven, rechts, onder)
  function coverCrop(img, box, crop) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const zoom = K.clamp(Number(crop && crop.zoom) || 1, 1, 4);
    const fx = K.clamp(crop && crop.fx != null ? crop.fx : 0.5, 0, 1);
    const fy = K.clamp(crop && crop.fy != null ? crop.fy : 0.5, 0, 1);
    const scale = Math.max(box.w / iw, box.h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const ox = (dw - box.w) * fx;
    const oy = (dh - box.h) * fy;
    return { l: ox / dw, t: oy / dh, r: 1 - (ox + box.w) / dw, b: 1 - (oy + box.h) / dh };
  }

  // Foto als JPEG (of PNG bij transparantie), niet groter dan nodig voor een scherm
  async function photoImage(deck, image) {
    const img = image.img;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const s = Math.min(1, 2400 / Math.max(nw, nh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(nw * s));
    c.height = Math.max(1, Math.round(nh * s));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const png = /\.(png|webp|gif|svg)$/i.test(image.name || '');
    let blob;
    try {
      blob = await PM.canvasToBlob(c, png ? 'image/png' : 'image/jpeg', 0.9);
    } catch (err) {
      throw err.name === 'SecurityError' ? PM.fileProtocolError() : err;
    }
    return deck.image(blob, png ? 'png' : 'jpeg', image.url || image.name);
  }

  /* ---------------------------------------------------------------------------
     Layouts
     ------------------------------------------------------------------------- */

  function heroObjects(env, photo) {
    const { r, cx, cy, echo } = GEOM.hero;
    if (photo != null) {
      const box = { x: cx - (r * SQRT3) / 2, y: cy - r, w: r * SQRT3, h: r * 2 };
      return [
        hex(cx - r * 0.17, cy + r * 0.15, r, null, { color: COLORS.cyan, width: echo }, 'Zeshoek-lijn'),
        hex(cx, cy, r, { image: photo, crop: coverCrop(env.photo, box, env.crop) }, null, 'Foto'),
      ];
    }
    return GEOM.heroShapes.map((sh) => hex(sh.cx, sh.cy, sh.r, sh.fill ? { color: sh.fill } : null, sh.stroke ? { color: sh.stroke, width: sh.lw } : null, 'Zeshoek'));
  }

  function slideObjects(fr, s, env, p, photo, logoImage) {
    const objects = [];

    if (p.layout === 'title' || p.layout === 'closing') {
      objects.push(...heroObjects(env, photo), ...label(fr, s.label, p.labelW), stackBox(fr, p));
    } else if (p.layout === 'section') {
      const { cx, cy, r } = p.hex;
      const num = String(env.sectionNumber || 1).padStart(2, '0');
      objects.push(
        hex(cx - r * 0.17, cy + r * 0.15, r, null, { color: COLORS.cyan, width: GEOM.section.echo }, 'Zeshoek-lijn'),
        hex(cx, cy, r, { color: COLORS.cyan }, null, 'Sectienummer', {
          anchor: 'ctr', wrap: false, autofit: 'none',
          paragraphs: [{ runs: [{ text: num, size: GEOM.section.numberSize, weight: 800, track: -0.02, color: COLORS.ink }], lh: LINE, align: 'ctr' }],
        }),
        ...label(fr, s.label), stackBox(fr, p),
      );
    } else if (p.layout === 'bullets') {
      objects.push(...label(fr, s.label), stackBox(fr, p));
    } else if (p.layout === 'split') {
      const half = W / 2;
      const box = p.photoBox;
      if (photo != null) objects.push({ kind: 'pic', ...box, image: photo, crop: coverCrop(env.photo, box, env.crop), name: 'Foto' });
      else objects.push({ kind: 'rect', ...box, fill: { color: '#3a4652' }, name: 'Plek voor de foto' });
      if (!p.left && photo != null) {
        // Rustig verloop onder het logo, dat op de foto staat
        const { fade } = GEOM.split;
        objects.push({
          kind: 'rect', x: half, y: H - fade, w: half, h: fade, name: 'Verloop',
          fill: { gradient: { angle: 90, stops: [{ pos: 0, color: COLORS.navy, alpha: 0 }, { pos: 100, color: COLORS.navy, alpha: 0.6 }] } },
        });
      }
      objects.push({ kind: 'rect', x: half - GEOM.split.divider / 2, y: 0, w: GEOM.split.divider, h: H, fill: { color: COLORS.cyan }, name: 'Scheidingslijn' });
      objects.push(...label(p.textFrame, s.label, p.maxW), stackBox(fr, p));
      // Boven op de foto: de balk, en wat de foto van de master bedekt
      objects.push(bar());
      if (p.left) objects.push(domain(p.textFrame));
      else objects.push(logo(fr, logoImage));
    } else if (p.layout === 'table') {
      objects.push(...label(fr, s.label), stackBox(fr, p), tableObject(p.table));
      if (p.note) objects.push(stackBox(fr, { stack: p.note.stack, x: p.x, top: p.note.top, maxW: p.maxW, maxH: 140, center: false }));
    } else if (p.layout === 'quote' && p.value) {
      const bg = GEOM.stat.bg;
      objects.push(
        hex(bg.cx, bg.cy, bg.r, null, { color: bg.stroke, width: bg.lw }, 'Achtergrondzeshoek'),
        line(fr.m, p.value.baseline, fr.contentW, { text: p.value.text, size: p.value.size, weight: 800, track: -0.03, color: COLORS.cyan }, { name: 'Kerncijfer' }),
        ...label(fr, s.label), stackBox(fr, p),
      );
    } else if (p.layout === 'quote') {
      const { cx, cy, r } = p.hex;
      objects.push(
        hex(cx, cy, r, { color: COLORS.cyan }, null, 'Citaatteken'),
        line(cx - 200, cy + GEOM.quote.markDy, 400, { text: GEOM.quote.mark, size: GEOM.quote.markSize, weight: 800, color: COLORS.ink }, { align: 'ctr', name: 'Aanhalingsteken' }),
        ...label(fr, s.label), stackBox(fr, p),
      );
    }
    return objects;
  }

  /* ---------------------------------------------------------------------------
     Publieke functie
     ------------------------------------------------------------------------- */

  /**
   * Bouwt de presentatie als .pptx.
   *   state     { slides, dot, showNumbers }
   *   slideEnv  (index) => { logo, photo, crop, sectionNumber }
   *   images    per slide-id { img, name, url }
   * Geeft een Blob terug.
   */
  async function exportDeck(state, slideEnv, images, onProgress) {
    await PM.fontsReady;
    const fr = S.frame();
    const ctx = document.createElement('canvas').getContext('2d');  // alleen om tekst te meten
    const title = String(state.slides[0].title || 'Presentatie').replace(/\*\*/g, '');
    const deck = new global.PMPptxWriter({ width: W, height: H, title, author: 'Pure Minds' });

    // Achtergrond (inkt, gloed en zeshoekpatroon) als afbeelding op de master
    const bgCanvas = document.createElement('canvas');
    K.paintBackground(K.prepare(bgCanvas, W, H, 1), fr);
    const background = deck.image(await PM.canvasToBlob(bgCanvas, 'image/jpeg', 0.92), 'jpeg', 'background');
    const logoImage = deck.image(dataUrlBytes(global.PM_BRAND.logoWhite), 'png', 'logo');

    const number = state.showNumbers !== false ? slideNumber(fr) : null;
    deck.master({ background, objects: [bar(), logo(fr, logoImage), domain(fr), number] });
    deck.layout([number]);

    const photos = new Map();
    for (let i = 0; i < state.slides.length; i++) {
      if (onProgress) onProgress(i, state.slides.length);
      await new Promise((r) => setTimeout(r, 0));  // knoptekst laten verversen
      const s = state.slides[i];
      const env = slideEnv(i);
      const image = env.photo && images[s.id];
      let photo = null;
      if (image) {
        if (!photos.has(s.id)) photos.set(s.id, await photoImage(deck, image));
        photo = photos.get(s.id);
      }
      const p = S.plan(ctx, fr, s, env, state);
      deck.slide([...slideObjects(fr, s, env, p, photo, logoImage), number]);
    }
    return deck.build();
  }

  global.PMSlidesPptx = { exportDeck };
})(window);
