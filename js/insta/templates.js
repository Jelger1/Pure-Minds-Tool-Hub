/* =============================================================================
   templates.js — de vijf Pure Minds post-templates, getekend op HTML5 Canvas
   -----------------------------------------------------------------------------
   Alles wordt getekend in een vast ontwerpraster van 1080 px breed. Exporteren
   op een andere breedte (1200 voor LinkedIn, 2160 voor hoge resolutie) schaalt
   alleen de context, dus maatvoering en verhoudingen blijven exact gelijk.

   Vaste regels voor álle templates (zie GRID en frame()):
     - marge van 88 px rondom
     - cyaan balk van 12 px bovenaan, zoals op elk artboard in het brandbook
     - label linksboven: zeshoek-bullet + Pure Minds Sans Bold in hoofdletters
     - logo rechtsonder in een inkt-zeshoek, in elk template op dezelfde plek
     - bij de carousel de swipe-indicator linksonder, verticaal gecentreerd
       op het logo; de posts hebben verder geen voetregel
     - optioneel de Emerce 100-badge op die plek: klein, wit, verticaal
       gecentreerd op het logo (in de carousel alleen op de laatste slide)
     - koppen Pure Minds Sans ExtraBold met -2% tracking, tekst Pure Minds Sans Regular
     - de zeshoek-duo (foto of vlak + verschoven cyaan lijn) als vormelement

   renderPost() geeft ook terug wat waar staat (regions: rechthoeken in
   ontwerp-px, voor klikken in de preview) en welke tekst niet paste
   (overflowKeys). Grootte van de kop: data.titleSize = 'klein' | 'normaal' |
   'groot' (typeschaal uit PM.brand); normaal tekent precies als voorheen.

   De tekenbouwstenen (kleuren, zeshoek, tekstopmaak, foto, label, logo)
   staan in js/shared/canvas-kit.js en worden gedeeld met de Presentation Maker.
   ============================================================================= */
(function (global) {
  'use strict';

  const {
    COLORS, CAP, DESC, SQRT3, flags,
    clamp, rgba, setFont, hexPath, hexPattern, paintBackground,
    runsFrom, layoutText, fitText, drawText, layoutBody, drawBody, ellipsize,
    drawLabel, drawLogo, drawBadge, drawArrow, planCta,
    drawPhoto, drawContain, hexEcho, prepare, finish,
  } = global.PMCanvas;

  const FORMATS = {
    portrait: { w: 1080, h: 1350, ratio: '4:5', label: 'portret' },
    story: { w: 1080, h: 1920, ratio: '9:16', label: 'story' },
  };

  const GRID = {
    margin: 88,
    bar: 12,
    logoW: 112,
    logoH: 112 * 1109 / 962,  // verhouding van PureMinds-zeshoek-logo.png
    badgeH: 112 * 1109 / 962 * 0.45,  // Emerce 100-badge: 45% van de logohoogte
    badgeRatio: 353.3 / 130.6,        // verhouding van e100-2026-liggend-wit.svg
    labelSize: 24,
    labelTrack: 0.12,
    labelGap: 72,             // van label tot inhoud
    footerGap: 56,            // van inhoud tot logo-rij
    footerSize: 24,
    storySafe: 250,           // boven en onder in een story zit de Instagram-interface
  };

  // Typografische stijlen, gedeeld door alle templates
  const TYPE = {
    title: { size: 80, weight: 800, emWeight: 800, track: -0.02, lh: 1.1 },
    body: { size: 34, weight: 400, emWeight: 700, track: 0, lh: 1.45 },
  };
  const TITLE_MIN = 44;
  const BODY_MIN = 24;

  /* ---------------------------------------------------------------------------
     Wat er getekend is: regio's (klikken in de preview) en teksten die niet
     pasten. Alleen meten, niets extra tekenen: de pixels blijven gelijk.
     ------------------------------------------------------------------------- */

  let regions = [];
  let over = [];

  const region = (key, x, y, w, h) => {
    if (w > 0 && h > 0) regions.push({ key, rect: { x, y, w, h } });
  };

  // fitText, maar met onthouden welke tekst niet paste
  function fit(key, ...args) {
    const before = flags.overflow;
    flags.overflow = false;
    const block = fitText(...args);
    if (flags.overflow) over.push(key);
    flags.overflow = before || flags.overflow;
    return block;
  }

  // Rechthoek om een tekstblok van fitText/layoutText, getekend vanaf (x, top)
  function textRegion(key, block, x, top, align = 'left') {
    if (!block || !block.lines.length) return;
    const w = Math.max(...block.lines.map((l) => l.w));
    const dx = align === 'center' ? (block.maxW - w) / 2 : 0;
    region(key, x + dx, top, w, block.height);
  }

  // Het label linksboven; direct na drawLabel, want dan staat het lettertype nog goed
  function labelRegion(ctx, fr, text, maxW = fr.contentW) {
    const value = String(text || '').trim();
    if (!value) return;
    const size = fr.labelSize;
    const tx = fr.m + (size / 2) * SQRT3 + (size * 2) / 3;
    const shown = ellipsize(ctx, value.toUpperCase(), maxW - (tx - fr.m));
    region('label', fr.m, fr.labelTop, tx - fr.m + ctx.measureText(shown).width, size * CAP);
  }

  // Korpsgrootte van de kop in de gekozen stap van de typeschaal
  function titleSize(base, d) {
    const brand = global.PM && global.PM.brand;
    return brand && d && d.titleSize ? brand.sizeFor(base, d.titleSize) : base;
  }

  // Alle posts zijn donker: inkt of foto, met witte tekst en cyaan nadruk
  const PAL = {
    text: '#ffffff', body: 'rgba(255,255,255,.88)', soft: 'rgba(255,255,255,.72)',
    label: '#ffffff', bullet: COLORS.cyan, em: COLORS.cyan,
    pattern: '#ffffff', patternAlpha: 0.08, dot: 'rgba(255,255,255,.45)',
  };

  const TEMPLATE_META = [
    { id: 'photo', name: 'Standaard foto', sub: 'strak en simpel' },
    { id: 'overlay', name: 'Foto met tekst', sub: 'tekst op beeld' },
    { id: 'blog', name: 'Pure blog post', sub: 'nieuwe blog + cta' },
    { id: 'case', name: 'Pure case post', sub: 'klant en resultaat' },
    { id: 'carousel', name: 'Info carousel', sub: 'swipepost in slides' },
  ];

  /* ---------------------------------------------------------------------------
     Raster
     ------------------------------------------------------------------------- */

  function frame(format) {
    const f = FORMATS[format] || FORMATS.portrait;
    const m = GRID.margin;
    const story = f.h / f.w > 1.5;
    const v = story ? GRID.storySafe : m;  // verticale marge
    const logo = { x: f.w - m - GRID.logoW, y: f.h - v - GRID.logoH, w: GRID.logoW, h: GRID.logoH };
    // Badge linksonder, even ver van de rand als het logo rechts
    const badge = { x: m, y: logo.y + (logo.h - GRID.badgeH) / 2, w: GRID.badgeH * GRID.badgeRatio, h: GRID.badgeH };
    return {
      w: f.w,
      h: f.h,
      m,
      v,
      logo,
      badge,
      story,
      portrait: f.h > f.w,
      labelTop: v,
      labelSize: GRID.labelSize,
      footerSize: GRID.footerSize,
      contentTop: v + GRID.labelSize * CAP + GRID.labelGap,
      contentBottom: logo.y - GRID.footerGap,
      contentW: f.w - 2 * m,
      footerY: logo.y + logo.h / 2,
    };
  }

  /* ---------------------------------------------------------------------------
     Swipe-indicator (alleen de carousel)
     ------------------------------------------------------------------------- */

  // Voortgang als zeshoekjes + "swipe" + pijl, op de plek van de voetregel
  function drawSwipe(ctx, fr, index, total, pal) {
    const y = fr.footerY;
    let x = fr.m;
    if (total > 1 && total <= 10) {
      const r = 11;
      for (let i = 0; i < total; i++) {
        const active = i === index;
        hexPath(ctx, x + (r * SQRT3) / 2, y, active ? r + 2 : r);
        if (active) {
          ctx.fillStyle = COLORS.cyan;
          ctx.fill();
        } else {
          ctx.strokeStyle = pal.dot;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        x += r * SQRT3 + 10;
      }
      x += 18;
    } else if (total > 10) {
      setFont(ctx, 800, GRID.footerSize, 0.02);
      const counter = `${String(index + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText(counter, x, y + (GRID.footerSize * CAP) / 2);
      x += ctx.measureText(counter).width + 18;
    }
    setFont(ctx, 700, GRID.footerSize, 0.02);
    ctx.fillStyle = pal.text;
    ctx.fillText('swipe', x, y + (GRID.footerSize * CAP) / 2);
    x += ctx.measureText('swipe').width + 16;
    drawArrow(ctx, x, y, 48, COLORS.cyan, 4);
  }

  // Halve cyaan zeshoek aan de rechterrand: "hier gaat het verder"
  function drawEdgeCue(ctx, fr) {
    const r = 72;
    const visible = 60;
    const cx = fr.w - visible + (r * SQRT3) / 2;
    const cy = fr.h / 2;
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    const ax = fr.w - visible / 2 + 2;
    ctx.save();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(ax - 8, cy - 15);
    ctx.lineTo(ax + 7, cy);
    ctx.lineTo(ax - 8, cy + 15);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------------------------
     Templates
     ------------------------------------------------------------------------- */

  // 1. Standaard foto: volledig beeld, of de foto in een grote zeshoek
  function tplPhoto(ctx, fr, d, env) {
    if (d.style === 'hex') {
      paintBackground(ctx, fr);
      const top = fr.labelTop + GRID.labelSize * CAP + 44;
      const bottom = fr.logo.y - 30;
      const r = Math.min((bottom - top) / 2, fr.contentW / SQRT3);
      const cx = fr.w / 2 + r * 0.08;
      const cy = (top + bottom) / 2 - r * 0.07;
      hexEcho(ctx, cx, cy, r);
      const photo = drawPhoto(ctx, env.photo, { x: cx - (r * SQRT3) / 2, y: cy - r, w: r * SQRT3, h: r * 2, hex: { cx, cy, r } }, env.crop);
      region('photo', cx - (r * SQRT3) / 2, cy - r, r * SQRT3, r * 2);
      drawLabel(ctx, fr, d.label, PAL);
      labelRegion(ctx, fr, d.label);
      return { photo };
    }

    const photo = drawPhoto(ctx, env.photo, { x: 0, y: 0, w: fr.w, h: fr.h }, env.crop);
    region('photo', 0, 0, fr.w, fr.h);
    if (env.photo) {
      // Rustige verlopen onder het label en het logo, zodat die leesbaar blijven
      const bottom = ctx.createLinearGradient(0, fr.logo.y - 220, 0, fr.h);
      bottom.addColorStop(0, rgba(COLORS.navy, 0));
      bottom.addColorStop(1, rgba(COLORS.navy, 0.62));
      ctx.fillStyle = bottom;
      ctx.fillRect(0, fr.logo.y - 220, fr.w, fr.h);
      if (String(d.label || '').trim()) {
        const topGrad = ctx.createLinearGradient(0, 0, 0, fr.labelTop + 190);
        topGrad.addColorStop(0, rgba(COLORS.navy, 0.55));
        topGrad.addColorStop(1, rgba(COLORS.navy, 0));
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, fr.w, fr.labelTop + 190);
      }
    }
    drawLabel(ctx, fr, d.label, PAL);
    labelRegion(ctx, fr, d.label);
    return { photo };
  }

  // 2. Foto met tekst-overlay: aankondiging in wit op een merkverloop
  function tplOverlay(ctx, fr, d, env) {
    const photo = drawPhoto(ctx, env.photo, { x: 0, y: 0, w: fr.w, h: fr.h }, env.crop);
    region('photo', 0, 0, fr.w, fr.h);
    const k = clamp((d.strength != null ? Number(d.strength) : 80) / 100, 0, 1);
    const middle = d.position === 'middle';

    const g = ctx.createLinearGradient(0, 0, 0, fr.h);
    if (middle) {
      g.addColorStop(0, rgba(COLORS.navy, 0.55 * k));
      g.addColorStop(0.5, rgba(COLORS.navy, 0.62 * k));
      g.addColorStop(1, rgba(COLORS.navy, 0.8 * k));
    } else {
      g.addColorStop(0, rgba(COLORS.navy, 0.5 * k));
      g.addColorStop(0.24, rgba(COLORS.navy, 0.06 * k));
      g.addColorStop(0.45, rgba(COLORS.navy, 0.22 * k));
      g.addColorStop(0.75, rgba(COLORS.navy, 0.82 * k));
      g.addColorStop(1, rgba(COLORS.navy, 0.94 * k));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, fr.w, fr.h);
    hexPattern(ctx, fr, { color: '#ffffff', alpha: 0.1, x0: 0, y0: fr.h, x1: 0, y1: fr.h * 0.4 });

    if (d.decor !== false) {
      hexPath(ctx, fr.w - 64, fr.labelTop + 96, 232);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 10;
      ctx.stroke();
      const dx = fr.w - 64 - 232 * (SQRT3 / 2);
      region('decor', dx, fr.labelTop + 96 - 232, fr.w - dx, 464);
    }

    drawLabel(ctx, fr, d.label, PAL, fr.contentW - 220);
    labelRegion(ctx, fr, d.label, fr.contentW - 220);

    const maxW = fr.contentW - 40;
    const areaH = fr.contentBottom - fr.contentTop;
    const sub = fit('subtitle', ctx, runsFrom(d.subtitle), maxW, 190, TYPE.body, { min: 26, maxLines: 4 });
    const gap = sub.lines.length ? 34 : 0;
    const title = fit('title', ctx, runsFrom(d.title, { dot: d.dot }), maxW, areaH - sub.height - gap, { ...TYPE.title, size: titleSize(TYPE.title.size, d) }, { min: TITLE_MIN });
    const total = title.height + gap + sub.height;
    const top = middle ? fr.contentTop + (areaH - total) / 2 : fr.contentBottom - total;

    drawText(ctx, title, fr.m, top, { color: '#ffffff', em: COLORS.cyan });
    drawText(ctx, sub, fr.m, top + title.height + gap, { color: 'rgba(255,255,255,.9)', em: '#ffffff' });
    textRegion('title', title, fr.m, top);
    textRegion('subtitle', sub, fr.m, top + title.height + gap);
    return { photo };
  }

  // 3. Pure blog post: titel links, foto in een zeshoek rechtsboven, cta onderin
  function tplBlog(ctx, fr, d, env) {
    const pal = PAL;
    paintBackground(ctx, fr);

    const r = fr.story ? 300 : fr.portrait ? 272 : 230;
    const cx = fr.w + 34 - (r * SQRT3) / 2;
    const cy = fr.labelTop - 44 + r;
    hexEcho(ctx, cx, cy, r);
    const photo = drawPhoto(ctx, env.photo, { x: cx - (r * SQRT3) / 2, y: cy - r, w: r * SQRT3, h: r * 2, hex: { cx, cy, r } }, env.crop);
    region('photo', cx - (r * SQRT3) / 2, cy - r, Math.min(r * SQRT3, fr.w - (cx - (r * SQRT3) / 2)), r * 2);

    const hexLeft = cx - r * 0.17 - (r * SQRT3) / 2;
    const colW = hexLeft - fr.m - 44;
    drawLabel(ctx, fr, d.label, pal, colW);
    labelRegion(ctx, fr, d.label, colW);

    // Onderin: zin met het onderwerp + magenta cta-blok (geen knop: zonder pijl)
    const block = planCta(ctx, d.button);
    const topic = String(d.topic || '').trim();
    const ctaText = String(d.cta || '').replace(/\{onderwerp\}/gi, topic ? `**${topic}**` : '…');
    const cta = fit('cta', ctx, runsFrom(ctaText), fr.contentW, 150, { ...TYPE.body, size: 32 }, { min: BODY_MIN, maxLines: 3 });
    const blockY = fr.contentBottom - block.h;
    const ctaTop = cta.lines.length ? blockY - 34 - cta.height : blockY;

    // Titel bovenin de linkerkolom, naast de zeshoek
    const titleMaxH = Math.max(80, ctaTop - 52 - fr.contentTop);
    const title = fit('title', ctx, runsFrom(d.title, { dot: d.dot }), colW, titleMaxH, { ...TYPE.title, size: titleSize(72, d) }, { min: 40 });
    drawText(ctx, title, fr.m, fr.contentTop, { color: pal.text, em: pal.em });

    drawText(ctx, cta, fr.m, ctaTop, { color: pal.body, em: pal.text });
    block.draw(fr.m, blockY);
    textRegion('title', title, fr.m, fr.contentTop);
    textRegion('cta', cta, fr.m, ctaTop);
    region('button', fr.m, blockY, block.w, block.h);
    return { photo };
  }

  // Resultaat-tegel voor de case, in de stijl van .score-tile uit de tools
  function planResult(ctx, fr, d, pal) {
    const value = String(d.resultValue || '').trim();
    const label = String(d.resultLabel || '').trim();
    if (!value && !label) return null;

    const pad = 36;
    const bar = 10;
    const x = fr.m;
    const w = fr.contentW;
    const valueSize = 100;
    const headSize = 20;
    setFont(ctx, 800, valueSize, -0.02);
    const valueW = value ? ctx.measureText(value).width : 0;
    const descX = x + bar + pad + (value ? valueW + 36 : 0);
    const descW = x + w - pad - descX;
    const desc = fit('result', ctx, runsFrom(label), descW, 150, { ...TYPE.body, size: 32, lh: 1.35 }, { min: BODY_MIN, maxLines: 3 });
    const valueH = value ? valueSize * CAP : 0;
    const descH = desc.lines.length ? desc.height - desc.st.size * DESC : 0;
    const rowH = Math.max(valueH, descH);
    const h = pad + headSize * CAP + 26 + rowH + pad;

    return {
      h,
      draw(y) {
        ctx.fillStyle = 'rgba(255,255,255,.07)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = COLORS.cyan;
        ctx.fillRect(x, y, bar, h);

        setFont(ctx, 700, headSize, 0.12);
        ctx.fillStyle = pal.soft;
        ctx.fillText('RESULTAAT', x + bar + pad, y + pad + headSize * CAP);

        const rowTop = y + pad + headSize * CAP + 26;
        if (value) {
          setFont(ctx, 800, valueSize, -0.02);
          ctx.fillStyle = COLORS.cyan;
          ctx.fillText(value, x + bar + pad, rowTop + (rowH + valueH) / 2);
        }
        if (desc.lines.length) {
          drawText(ctx, desc, descX, rowTop + (rowH - descH) / 2, { color: pal.body, em: pal.text });
        }
      },
    };
  }

  // 4. Pure case post: klantlogo in een zeshoek, aanpak als kop, resultaat onderin
  function tplCase(ctx, fr, d, env) {
    const usePhoto = !!(d.photoBg && env.photo);
    const pal = PAL;
    let photo = null;
    region(usePhoto ? 'photo' : 'background', 0, 0, fr.w, fr.h);
    if (usePhoto) {
      photo = drawPhoto(ctx, env.photo, { x: 0, y: 0, w: fr.w, h: fr.h }, env.crop);
      ctx.fillStyle = rgba(COLORS.ink, 0.86);
      ctx.fillRect(0, 0, fr.w, fr.h);
      hexPattern(ctx, fr, { color: '#ffffff', alpha: 0.08, x0: 0, y0: 0, x1: 0, y1: fr.h * 0.8 });
    } else {
      paintBackground(ctx, fr);
    }

    // Klant in een witte zeshoek rechtsboven
    const r = fr.story ? 140 : fr.portrait ? 134 : 120;
    const hx = fr.w - fr.m - (r * SQRT3) / 2;
    const hy = fr.labelTop + r;
    hexEcho(ctx, hx, hy, r);
    hexPath(ctx, hx, hy, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const client = String(d.client || '').trim();
    region(env.clientLogo ? 'logo' : 'client', hx - (r * SQRT3) / 2, hy - r, r * SQRT3, r * 2);
    if (env.clientLogo) {
      drawContain(ctx, env.clientLogo, hx - r * 0.6, hy - r * 0.42, r * 1.2, r * 0.84);
    } else {
      const name = fit('client', ctx, runsFrom(client || 'klantlogo'), r * 1.25, r * 0.9, { size: 32, weight: 800, emWeight: 800, track: -0.01, lh: 1.1 }, { min: 18 });
      drawText(ctx, name, hx - r * 0.625, hy - (name.height - name.st.size * DESC) / 2, { color: COLORS.ink, em: COLORS.ink, align: 'center' });
    }

    const hexLeft = hx - r * 0.17 - (r * SQRT3) / 2;
    const colW = hexLeft - fr.m - 40;
    drawLabel(ctx, fr, d.label, pal, colW);
    labelRegion(ctx, fr, d.label, colW);

    // "Voor {klant} hebben wij {diensten} gedaan." — diensten krijgen nadruk
    const services = (d.services || []).map((s) => String(s || '').trim()).filter(Boolean).map((s) => `**${s}**`);
    const joined = services.length <= 1
      ? services[0] || '…'
      : `${services.slice(0, -1).join(', ')} en ${services[services.length - 1]}`;
    const sentence = String(d.sentence || 'Voor {klant} hebben wij {diensten} gedaan.')
      .replace(/\{klant\}/gi, client || 'deze klant')
      .replace(/\{diensten\}/gi, joined);

    const result = planResult(ctx, fr, d, pal);
    const resultY = result ? fr.contentBottom - result.h : fr.contentBottom;
    const titleMaxH = Math.max(80, resultY - 52 - fr.contentTop);
    const title = fit('title', ctx, runsFrom(sentence, { dot: d.dot }), colW, titleMaxH, { ...TYPE.title, size: titleSize(68, d) }, { min: 38 });
    drawText(ctx, title, fr.m, fr.contentTop, { color: pal.text, em: pal.em });
    textRegion('title', title, fr.m, fr.contentTop);

    if (result) {
      result.draw(resultY);
      region('result', fr.m, resultY, fr.contentW, result.h);
    }
    return { photo };
  }

  // 5. Informatieve carousel: nummer in zeshoek, titel + tekst, swipe-indicator
  function tplCarousel(ctx, fr, d, env) {
    const pal = PAL;
    paintBackground(ctx, fr);

    const slides = Array.isArray(d.slides) && d.slides.length ? d.slides : [{ title: '', body: '' }];
    const index = clamp(env.slideIndex != null ? env.slideIndex : d.active || 0, 0, slides.length - 1);
    const slide = slides[index] || {};
    const last = !!slide.last;

    drawLabel(ctx, fr, d.label, pal);
    labelRegion(ctx, fr, d.label);

    // Slidenummer in een cyaan zeshoek, zoals de kernwaarden in het brandbook
    const r = 46;
    const bx = fr.m + (r * SQRT3) / 2;
    const by = fr.contentTop + r;
    hexPath(ctx, bx, by, r);
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    setFont(ctx, 800, 32, 0);
    const num = String(index + 1).padStart(2, '0');
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(num, bx - ctx.measureText(num).width / 2, by + (32 * CAP) / 2);
    region('slide', bx - (r * SQRT3) / 2, by - r, r * SQRT3, r * 2);

    const top = by + r + 48;
    const areaH = fr.contentBottom - top;
    const maxW = fr.contentW - 16;
    const titleRuns = runsFrom(slide.title, { dot: d.dot });

    // Titel en tekst samen verkleinen tot ze passen, in dezelfde verhouding
    let title;
    let body;
    let gap;
    for (let k = 1; k >= 0.5; k -= 0.04) {
      title = layoutText(ctx, titleRuns, maxW, { ...TYPE.title, size: Math.round(titleSize(72, d) * k) });
      body = layoutBody(ctx, slide.body, maxW, { ...TYPE.body, size: Math.max(22, Math.round(36 * k)) });
      gap = title.lines.length && body.items.length ? Math.round(36 * k) : 0;
      if (title.height + gap + body.height <= areaH) break;
      if (k - 0.04 < 0.5) {
        flags.overflow = true;
        over.push('body');
      }
    }

    drawText(ctx, title, fr.m, top, { color: pal.text, em: pal.em });
    drawBody(ctx, body, fr.m, top + title.height + gap, { color: pal.body, em: pal.text });
    textRegion('title', title, fr.m, top);
    region('body', fr.m, top + title.height + gap, maxW, body.height);

    // De laatste slide nodigt niet uit om door te swipen
    if (!last) {
      drawSwipe(ctx, fr, index, slides.length, pal);
      drawEdgeCue(ctx, fr);
    }
    // Badge alleen op de laatste slide: daar is linksonder vrij en staat de
    // afsluiter; op elke slide zou het een watermerk worden
    return { photo: null, slideIndex: index, last, badge: last };
  }

  const TEMPLATES = {
    photo: tplPhoto,
    overlay: tplOverlay,
    blog: tplBlog,
    case: tplCase,
    carousel: tplCarousel,
  };

  /* ---------------------------------------------------------------------------
     Publieke functie
     ------------------------------------------------------------------------- */

  /**
   * Tekent de post op `canvas`.
   *   state: { template, format, dot, badge, data: { [template]: {...} } }
   *   env:   { photo, clientLogo, logo, badge, crop, slideIndex }
   *   opts:  { scale } — 1 = 1080 px breed
   */
  function renderPost(canvas, state, env, opts = {}) {
    const fr = frame(state.format);
    const ctx = prepare(canvas, fr.w, fr.h, opts.scale || 1);
    regions = [];
    over = [];
    const id = TEMPLATES[state.template] ? state.template : 'photo';
    const data = { ...(state.data && state.data[id]), dot: state.dot !== false };

    ctx.save();
    const info = TEMPLATES[id](ctx, fr, data, env || {}) || {};
    ctx.restore();

    // Vaste elementen als laatste, zodat niets ze kan bedekken
    drawLogo(ctx, fr, env && env.logo);
    // Emerce 100-badge: alleen als hij aan staat en het template hem niet weglaat
    if (state.badge && info.badge !== false) drawBadge(ctx, fr, env && env.badge);
    finish(ctx, fr.w, GRID.bar);

    return { ...info, overflow: flags.overflow, overflowKeys: over.slice(), regions: regions.slice(), width: fr.w, height: fr.h, frame: fr };
  }

  global.PMTemplates = { renderPost, frame, FORMATS, TEMPLATE_META, COLORS, GRID };
})(window);
