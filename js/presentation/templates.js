/* =============================================================================
   presentation/templates.js — zes slide-layouts in de Pure Minds huisstijl
   -----------------------------------------------------------------------------
   Slides zijn 1920 × 1080 (16:9) en worden getekend met dezelfde bouwstenen
   als de Insta-posts (js/shared/canvas-kit.js). Vaste regels voor elke slide:

     - inkt-achtergrond met cyaan gloed en zeshoekpatroon, cyaan balk bovenaan
     - label linksboven met zeshoek-bullet
     - voetregel linksonder (pureminds.nl), slidenummer naast het logo
     - wit zeshoek-logo rechtsonder, op elke slide op exact dezelfde plek

   Layouts: title, section, bullets, split, quote (citaat of kerncijfer),
   table (tabel met kopregel; korps en kolombreedtes schalen mee), closing.

   Elke layout bestaat uit twee delen: plan() rekent uit waar de tekst komt en
   hoe groot die wordt (past hij niet, dan krimpt hij), en de tekenfunctie zet
   dat plan op het canvas. De PowerPoint-export (js/presentation/pptx.js)
   gebruikt hetzelfde plan en dezelfde vormmaten (GEOM), zodat een slide in
   PowerPoint er net zo uitziet als in de preview.
   ============================================================================= */
(function (global) {
  'use strict';

  const {
    COLORS, CAP, DESC: K_DESC, SQRT3, flags,
    rgba, setFont, hexPath, paintBackground,
    runsFrom, layoutText, drawText, layoutBody, drawBody,
    drawLabel, drawDomain, drawLogo, drawPhoto, hexEcho, prepare, finish,
  } = global.PMCanvas;

  const W = 1920;
  const H = 1080;

  const GRID = {
    m: 128,        // horizontale marge
    v: 104,        // verticale marge
    bar: 16,
    labelSize: 30,
    footerSize: 26,
    labelGap: 72,
    footerGap: 48,
    logoW: 116,
    logoH: 116 * 1109 / 962,
  };

  const LAYOUTS = [
    { id: 'title', name: 'Titelslide', sub: 'opening met foto' },
    { id: 'section', name: 'Sectie', sub: 'nieuw hoofdstuk' },
    { id: 'bullets', name: 'Opsomming', sub: 'titel + punten' },
    { id: 'split', name: 'Beeld + tekst', sub: 'foto naast tekst' },
    { id: 'quote', name: 'Citaat of cijfer', sub: 'uitspraak of kerncijfer' },
    { id: 'table', name: 'Tabel', sub: 'rijen en kolommen' },
    { id: 'closing', name: 'Afsluiter', sub: 'bedankt + contact' },
  ];

  /* ---------------------------------------------------------------------------
     Tabel: model en stijl
     ------------------------------------------------------------------------- */

  const TABLE_LIMITS = { rows: 14, cols: 8 };

  function defaultTable() {
    return {
      header: true,
      firstCol: true,
      cells: [
        ['Kanaal', 'Budget', 'Klikken', 'Kosten per klik'],
        ['Google Ads', '€ 4.500', '12.400', '€ 0,36'],
        ['Meta', '€ 2.000', '8.150', '€ 0,25'],
        ['LinkedIn', '€ 1.500', '1.320', '€ 1,14'],
      ],
    };
  }

  // Maakt een opgeslagen of geplakte tabel veilig: rechthoekig, binnen de grenzen, alleen tekst
  function normalizeTable(t) {
    const src = t && typeof t === 'object' && Array.isArray(t.cells) ? t : defaultTable();
    let cells = src.cells.filter(Array.isArray).slice(0, TABLE_LIMITS.rows)
      .map((row) => row.slice(0, TABLE_LIMITS.cols).map((v) => String(v == null ? '' : v).slice(0, 160)));
    const cols = Math.max(1, ...cells.map((r) => r.length));
    if (!cells.length) cells = [['']];
    cells = cells.map((r) => r.concat(Array(cols - r.length).fill('')));
    return { header: src.header !== false, firstCol: src.firstCol !== false, cells };
  }

  // Vaste kleuren (niet doorzichtig), zodat PowerPoint en Google Slides ze exact overnemen
  const TABLE_STYLE = {
    size: 34, min: 16, lh: 1.3,
    padX: 0.7, padY: 0.5, headSize: 0.82,
    headFill: '#2c4b54',     // inkt met 20% cyaan
    zebra: '#393939',        // inkt met een vleugje wit
    rule: '#4d4d4d', ruleW: 2,
    headRule: COLORS.cyan, headRuleW: 4,
    text: '#e6e6e6', strong: '#ffffff',
  };

  // Een kolom met alleen getallen, bedragen of percentages wordt rechts uitgelijnd
  const isNumeric = (v) => {
    const s = String(v || '').replace(/\*\*/g, '').trim();
    return /\d/.test(s) && /^[\s\d.,+\-−–%€$£x×/:()]+$/.test(s);
  };

  function tableLayout(ctx, t, size, maxW, force) {
    const S = TABLE_STYLE;
    const nC = t.cells[0].length;
    const padX = Math.round(size * S.padX);
    const padY = Math.round(size * S.padY);
    const body = t.cells.slice(t.header ? 1 : 0);
    const numeric = Array.from({ length: nC }, (_, c) => {
      const vals = body.map((r) => r[c]).filter((v) => String(v).trim());
      return vals.length > 0 && vals.every(isNumeric);
    });

    const style = (r, c) => {
      if (t.header && r === 0) return { st: { size: Math.round(size * S.headSize), weight: 700, emWeight: 800, track: 0, lh: S.lh }, colors: { color: S.strong, em: COLORS.cyan } };
      const label = t.firstCol && c === 0 && nC > 1;
      return { st: { size, weight: label ? 600 : 400, emWeight: 700, track: 0, lh: S.lh }, colors: { color: label ? S.strong : S.text, em: COLORS.cyan } };
    };

    // Natuurlijke breedte (alles op één regel) en minimale breedte (langste woord) per kolom
    const nat = Array(nC).fill(0);
    const min = Array(nC).fill(0);
    t.cells.forEach((row, r) => row.forEach((v, c) => {
      const { st } = style(r, c);
      const runs = runsFrom(v);
      const one = layoutText(ctx, runs, 1e6, st);
      nat[c] = Math.max(nat[c], one.lines.length ? Math.max(...one.lines.map((l) => l.w)) : 0);
      setFont(ctx, st.emWeight, st.size, st.track);
      for (const word of String(v).replace(/\*\*/g, '').split(/\s+/)) {
        if (word) min[c] = Math.max(min[c], ctx.measureText(word).width);
      }
    }));
    for (let c = 0; c < nC; c++) {
      nat[c] += 2 * padX + 2;
      min[c] += 2 * padX + 2;
    }

    const sumN = nat.reduce((a, b) => a + b, 0);
    const sumM = min.reduce((a, b) => a + b, 0);
    let widths;
    if (sumN <= maxW) widths = nat.map((n) => n + ((maxW - sumN) * n) / sumN);           // ruimte over: naar verhouding verdelen
    else if (sumM <= maxW) {
      const f = (maxW - sumM) / (sumN - sumM);                                           // te breed: lange teksten lopen door
      widths = nat.map((n, c) => min[c] + (n - min[c]) * f);
    } else if (force) widths = Array(nC).fill(maxW / nC);
    else return null;

    let y = 0;
    let bodyIndex = 0;
    const rows = t.cells.map((row, r) => {
      const head = t.header && r === 0;
      const cells = row.map((v, c) => {
        const { st, colors } = style(r, c);
        const runs = runsFrom(v);
        const block = layoutText(ctx, runs, widths[c] - 2 * padX, st);
        return { runs, st, colors, block, align: numeric[c] ? 'right' : 'left' };
      });
      const textH = Math.max(...cells.map((cell) => (cell.block.lines.length ? cell.block.height : cell.st.size * (CAP + K_DESC))));
      const h = Math.round(textH + 2 * padY);
      const fill = head ? TABLE_STYLE.headFill : bodyIndex % 2 ? TABLE_STYLE.zebra : null;
      if (!head) bodyIndex++;
      const out = { y, h, head, cells, fill, rule: head ? S.headRule : S.rule, ruleW: head ? S.headRuleW : S.ruleW };
      y += h;
      return out;
    });
    return { size, padX, padY, widths, rows, w: maxW, h: y, header: t.header };
  }

  // Grootste korps waarbij de tabel in het vak past; kleiner dan het minimum kan niet
  function fitTable(ctx, table, maxW, maxH) {
    const t = normalizeTable(table);
    let last = null;
    for (let size = TABLE_STYLE.size; size >= TABLE_STYLE.min; size -= 2) {
      const res = tableLayout(ctx, t, size, maxW, false);
      if (res) {
        last = res;
        if (res.h <= maxH) return res;
      }
    }
    flags.overflow = true;
    return last || tableLayout(ctx, t, TABLE_STYLE.min, maxW, true);
  }

  function drawTable(ctx, T) {
    for (const row of T.rows) {
      const y = T.y + row.y;
      if (row.fill) {
        ctx.fillStyle = row.fill;
        ctx.fillRect(T.x, y, T.w, row.h);
      }
      ctx.fillStyle = row.rule;
      ctx.fillRect(T.x, y + row.h - row.ruleW, T.w, row.ruleW);
      let x = T.x;
      row.cells.forEach((cell, c) => {
        const top = y + (row.h - cell.block.height) / 2;
        drawText(ctx, cell.block, x + T.padX, top, { ...cell.colors, align: cell.align });
        x += T.widths[c];
      });
    }
  }

  const TEXT = { color: '#ffffff', em: COLORS.cyan };
  const BODY = { color: 'rgba(255,255,255,.88)', em: '#ffffff' };
  const SOFT = 'rgba(255,255,255,.72)';
  const META = { color: COLORS.cyan, em: '#ffffff' };
  const LABEL_PAL = { bullet: COLORS.cyan, label: '#ffffff' };

  // Vaste maten van de vormen per layout (in ontwerp-px)
  const GEOM = {
    hero: { r: 350, cx: W + 40 - (350 * SQRT3) / 2, cy: 430, echo: 10 },
    // Compositie zoals de vormtaal-pagina van het brandbook, als er geen foto is
    heroShapes: (() => {
      const cx = W + 40 - (350 * SQRT3) / 2;
      const cy = 430;
      return [
        { cx: cx - 40, cy, r: 300, stroke: COLORS.cyan, lw: 12 },
        { cx: cx - 40 - 300 * 0.866, cy: cy + 300 * 0.75, r: 86, fill: COLORS.cyan },
        { cx: cx + 170, cy: cy - 290, r: 58, stroke: 'rgba(255,255,255,.35)', lw: 6 },
      ];
    })(),
    section: { r: 150, echo: 8, numberSize: 120, gap: 110 },
    split: { pad: 104, divider: 12, fade: 380 },
    stat: { bg: { cx: W - 300, cy: H / 2, r: 470, lw: 3, stroke: 'rgba(255,255,255,.07)' }, size: 300, min: 120, gap: 60 },
    quote: { r: 92, gap: 80, mark: '“', markSize: 190, markDy: 118 },
  };

  function frame() {
    const { m, v } = GRID;
    const logo = { x: W - m - GRID.logoW, y: H - v - GRID.logoH, w: GRID.logoW, h: GRID.logoH };
    return {
      w: W, h: H, m, v, logo,
      labelTop: v,
      labelSize: GRID.labelSize,
      footerSize: GRID.footerSize,
      contentTop: v + GRID.labelSize * CAP + GRID.labelGap,
      contentBottom: logo.y - GRID.footerGap,
      contentW: W - 2 * m,
      footerY: logo.y + logo.h / 2,
    };
  }

  /**
   * Een stapel tekstblokken (titel, ondertitel, tekst) samen passend maken:
   * alles krimpt in dezelfde verhouding tot het in maxH past.
   * item: { runs | body, st, min, gap }
   */
  function fitStack(ctx, items, maxW, maxH) {
    let result = null;
    for (let k = 1; k >= 0.5; k -= 0.04) {
      let height = 0;
      const blocks = [];
      for (const it of items) {
        const size = Math.max(it.min || 20, Math.round(it.st.size * k));
        const st = { ...it.st, size };
        const b = it.body != null ? layoutBody(ctx, it.body, maxW, st) : layoutText(ctx, it.runs, maxW, st);
        const empty = it.body != null ? !b.items.length : !b.lines.length;
        const gap = empty || !blocks.length ? 0 : Math.round((it.gap || 0) * k);
        blocks.push({ ...it, block: b, empty, gap });
        height += empty ? 0 : gap + b.height;
      }
      result = { blocks, height };
      if (height <= maxH) return result;
    }
    flags.overflow = true;
    return result;
  }

  function drawStack(ctx, stack, x, top) {
    let y = top;
    for (const b of stack.blocks) {
      if (b.empty) continue;
      y += b.gap;
      if (b.body != null) drawBody(ctx, b.block, x, y, b.colors || BODY);
      else drawText(ctx, b.block, x, y, b.colors || TEXT);
      y += b.block.height;
    }
  }

  const TITLE = (size) => ({ size, weight: 800, emWeight: 800, track: -0.02, lh: 1.08 });
  const PARA = (size, weight = 400) => ({ size, weight, emWeight: 700, track: 0, lh: 1.45 });

  // Elke niet-lege regel wordt een opsommingspunt
  const asBullets = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => (/^[-•]\s/.test(l) ? l : `- ${l}`)).join('\n');

  // Grootste korps waarbij het kerncijfer in maxW past
  function fitValueSize(ctx, value, maxW) {
    let size = GEOM.stat.size;
    setFont(ctx, 800, size, -0.03);
    while (size > GEOM.stat.min && ctx.measureText(value).width > maxW) {
      size -= 8;
      setFont(ctx, 800, size, -0.03);
    }
    return size;
  }

  /* ---------------------------------------------------------------------------
     Tekstblokken per layout
     ------------------------------------------------------------------------- */

  const STACK = {
    title: (s, deck) => [
      { runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(124), min: 60 },
      { runs: runsFrom(s.subtitle), st: PARA(44), min: 26, gap: 40, colors: BODY },
      { runs: runsFrom(s.meta), st: PARA(30, 700), min: 20, gap: 56, colors: META },
    ],
    section: (s, deck) => [
      { runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(112), min: 56 },
      { runs: runsFrom(s.subtitle), st: PARA(44), min: 26, gap: 36, colors: BODY },
    ],
    bullets: (s, deck) => [
      { runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(88), min: 48 },
      { body: asBullets(s.body), st: PARA(42), min: 22, gap: 56, colors: BODY },
    ],
    split: (s, deck) => [
      { runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(80), min: 44 },
      { body: s.body, st: PARA(36), min: 20, gap: 44, colors: BODY },
    ],
    stat: (s) => [
      { runs: runsFrom(s.subtitle), st: PARA(50, 600), min: 28, colors: TEXT },
      { runs: runsFrom(s.author), st: PARA(28, 700), min: 18, gap: 28, colors: { color: SOFT, em: '#ffffff' } },
    ],
    quote: (s) => [
      { runs: runsFrom(s.quote), st: { ...TITLE(68), weight: 700, emWeight: 800, lh: 1.25 }, min: 36 },
      { runs: runsFrom(s.author), st: PARA(32, 700), min: 20, gap: 48, colors: META },
    ],
    table: (s, deck) => [
      { runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(80), min: 44 },
    ],
    note: (s) => [
      { runs: runsFrom(s.subtitle), st: PARA(26), min: 18, colors: { color: SOFT, em: '#ffffff' } },
    ],
    closing: (s, deck) => [
      { runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(124), min: 60 },
      { runs: runsFrom(s.subtitle), st: PARA(44), min: 24, gap: 36, colors: BODY },
      { body: asBullets(s.body), st: PARA(34, 600), min: 20, gap: 60, colors: TEXT },
    ],
  };

  // Linkerrand van het beeld rechts (foto in zeshoek, of de zeshoekcompositie)
  function heroLeft(env) {
    const { r, cx } = GEOM.hero;
    if (env.photo) return cx - r * 0.17 - (r * SQRT3) / 2;
    const s = GEOM.heroShapes[1];
    return s.cx - s.r;
  }

  /**
   * Plan van een slide: waar de tekst staat en hoe groot die wordt.
   *   { layout, x, top, maxW, maxH, center, stack, ...layoutspecifiek }
   * `top` is de bovenkant van de tekst op het canvas; bij center: true is dat
   * het midden van het tekstgebied minus de halve hoogte.
   */
  function plan(ctx, fr, s, env, deck) {
    const layout = STACK[s.layout] && RENDER[s.layout] ? s.layout : 'bullets';
    const area = fr.contentBottom - fr.contentTop;
    const centered = (stack) => fr.contentTop + (area - stack.height) / 2;

    if (layout === 'title' || layout === 'closing') {
      const maxW = Math.min(1100, heroLeft(env) - fr.m - 80);
      const stack = fitStack(ctx, STACK[layout](s, deck), maxW, area);
      return { layout, stack, x: fr.m, top: centered(stack), maxW, maxH: area, center: true, labelW: maxW };
    }
    if (layout === 'section') {
      const { r } = GEOM.section;
      const x = fr.m + r * SQRT3 + GEOM.section.gap;
      const stack = fitStack(ctx, STACK.section(s, deck), W - fr.m - x, area);
      const cy = (fr.contentTop + fr.contentBottom) / 2;
      return { layout, stack, x, top: cy - stack.height / 2, maxW: W - fr.m - x, maxH: area, center: true, hex: { cx: fr.m + (r * SQRT3) / 2, cy, r } };
    }
    if (layout === 'bullets') {
      const maxW = Math.round(fr.contentW * 0.86);
      const stack = fitStack(ctx, STACK.bullets(s, deck), maxW, area);
      return { layout, stack, x: fr.m, top: fr.contentTop, maxW, maxH: area, center: false };
    }
    if (layout === 'split') {
      const left = s.imageSide !== 'right';
      const half = W / 2;
      const { pad } = GEOM.split;
      const x = left ? half + pad : fr.m;
      const maxW = left ? W - fr.m - x : half - pad - fr.m;
      const stack = fitStack(ctx, STACK.split(s, deck), maxW, area);
      const photoBox = { x: left ? 0 : half, y: 0, w: half, h: H };
      return { layout, stack, x, top: fr.contentTop, maxW, maxH: area, center: false, left, photoBox, textFrame: { ...fr, m: x, contentW: maxW } };
    }
    if (layout === 'table') {
      // Titel bovenaan, de tabel eronder over de volle breedte, een toelichting direct onder de tabel
      // Een grote tabel mag de titel iets kleiner maken, als de tabel daardoor beter leesbaar wordt
      const maxW = fr.contentW;
      const note = fitStack(ctx, STACK.note(s), maxW, 110);
      const noteGap = note.height ? 32 : 0;
      const before = flags.overflow;
      let best = null;
      for (const size of [80, 64, 52]) {
        flags.overflow = false;
        const items = STACK.table(s, deck).map((it) => ({ ...it, st: TITLE(size), min: Math.min(it.min, size) }));
        const stack = fitStack(ctx, items, maxW, area * 0.34);
        const tableTop = fr.contentTop + stack.height + (stack.height ? 56 : 0);
        const T = fitTable(ctx, s.table, maxW, fr.contentBottom - tableTop - note.height - noteGap);
        const fits = !flags.overflow;
        if (!best || T.size > best.T.size + 3) best = { stack, tableTop, T, fits };
        if (T.size >= 26 && fits) break;
      }
      flags.overflow = before || !best.fits;
      const { stack, tableTop, T } = best;
      const titleH = stack.height;
      Object.assign(T, { x: fr.m, y: tableTop });
      return {
        layout, stack, x: fr.m, top: fr.contentTop, maxW, maxH: titleH + 30, center: false,
        table: T, note: note.height ? { stack: note, top: tableTop + T.h + noteGap } : null,
      };
    }
    if (layout === 'quote' && s.style === 'stat') {
      const value = String(s.value || '').trim() || '0%';
      const size = fitValueSize(ctx, value, fr.contentW * 0.9);
      const maxH = area - size * CAP - GEOM.stat.gap;
      const stack = fitStack(ctx, STACK.stat(s), fr.contentW * 0.8, maxH);
      const total = size * CAP + GEOM.stat.gap + stack.height;
      const top = fr.contentTop + (area - total) / 2;
      return { layout, stack, x: fr.m, top: top + size * CAP + GEOM.stat.gap, maxW: fr.contentW * 0.8, maxH, center: false, value: { text: value, size, baseline: top + size * CAP } };
    }
    if (layout === 'quote') {
      const { r } = GEOM.quote;
      const x = fr.m + r * SQRT3 + GEOM.quote.gap;
      const stack = fitStack(ctx, STACK.quote(s), W - fr.m - x, area);
      const top = centered(stack);
      return { layout, stack, x, top, maxW: W - fr.m - x, maxH: area, center: true, hex: { cx: fr.m + (r * SQRT3) / 2, cy: top + r, r } };
    }
    return null;
  }

  /* ---------------------------------------------------------------------------
     Zeshoek met foto rechts, of een zeshoekcompositie als er geen foto is
     ------------------------------------------------------------------------- */

  function heroVisual(ctx, env) {
    const { r, cx, cy, echo } = GEOM.hero;
    if (env.photo) {
      // Onderkant (met de verschoven lijn) blijft boven de voetregel
      hexEcho(ctx, cx, cy, r, echo);
      return drawPhoto(ctx, env.photo, { x: cx - (r * SQRT3) / 2, y: cy - r, w: r * SQRT3, h: r * 2, hex: { cx, cy, r }, hintSize: 40 }, env.crop);
    }
    for (const sh of GEOM.heroShapes) {
      hexPath(ctx, sh.cx, sh.cy, sh.r);
      if (sh.fill) {
        ctx.fillStyle = sh.fill;
        ctx.fill();
      } else {
        ctx.strokeStyle = sh.stroke;
        ctx.lineWidth = sh.lw;
        ctx.stroke();
      }
    }
    return null;
  }

  /* ---------------------------------------------------------------------------
     Layouts
     ------------------------------------------------------------------------- */

  function title(ctx, fr, s, env, deck, p) {
    const photo = heroVisual(ctx, env);
    drawLabel(ctx, fr, s.label, LABEL_PAL, p.labelW);
    drawStack(ctx, p.stack, p.x, p.top);
    return { photo };
  }

  function section(ctx, fr, s, env, deck, p) {
    const { cx, cy, r } = p.hex;
    hexEcho(ctx, cx, cy, r, GEOM.section.echo);
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    const num = String(env.sectionNumber || 1).padStart(2, '0');
    const size = GEOM.section.numberSize;
    setFont(ctx, 800, size, -0.02);
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(num, cx - ctx.measureText(num).width / 2, cy + (size * CAP) / 2);

    drawLabel(ctx, fr, s.label, LABEL_PAL);
    drawStack(ctx, p.stack, p.x, p.top);
    return {};
  }

  function bullets(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    drawStack(ctx, p.stack, p.x, p.top);
    return {};
  }

  function split(ctx, fr, s, env, deck, p) {
    const half = W / 2;
    const photo = drawPhoto(ctx, env.photo, { ...p.photoBox, hintSize: 40 }, env.crop);
    if (!p.left && env.photo) {
      // Rustig verloop onder het logo, dat op de foto staat
      const { fade } = GEOM.split;
      const g = ctx.createLinearGradient(0, H - fade, 0, H);
      g.addColorStop(0, rgba(COLORS.navy, 0));
      g.addColorStop(1, rgba(COLORS.navy, 0.6));
      ctx.fillStyle = g;
      ctx.fillRect(half, H - fade, half, fade);
    }
    const { divider } = GEOM.split;
    ctx.fillStyle = COLORS.cyan;
    ctx.fillRect(half - divider / 2, 0, divider, H);

    // Tekst in de andere helft: eigen raster met dezelfde marges
    drawLabel(ctx, p.textFrame, s.label, LABEL_PAL, p.maxW);
    drawStack(ctx, p.stack, p.x, p.top);
    return { photo, footerFrame: p.textFrame };
  }

  function quote(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);

    if (p.value) {
      // Grote, vage zeshoek rechts als achtergrondvorm
      const bg = GEOM.stat.bg;
      hexPath(ctx, bg.cx, bg.cy, bg.r);
      ctx.strokeStyle = bg.stroke;
      ctx.lineWidth = bg.lw;
      ctx.stroke();
      setFont(ctx, 800, p.value.size, -0.03);
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText(p.value.text, fr.m, p.value.baseline);
      drawStack(ctx, p.stack, p.x, p.top);
      return {};
    }

    // Citaat: aanhalingsteken in een cyaan zeshoek, uitspraak ernaast
    const { cx, cy, r } = p.hex;
    hexPath(ctx, cx, cy, r);
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    setFont(ctx, 800, GEOM.quote.markSize, 0);
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(GEOM.quote.mark, cx - ctx.measureText(GEOM.quote.mark).width / 2, cy + GEOM.quote.markDy);
    drawStack(ctx, p.stack, p.x, p.top);
    return {};
  }

  function table(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    drawStack(ctx, p.stack, p.x, p.top);
    drawTable(ctx, p.table);
    if (p.note) drawStack(ctx, p.note.stack, p.x, p.note.top);
    return {};
  }

  const closing = title;

  const RENDER = { title, section, bullets, split, quote, table, closing };

  /* ---------------------------------------------------------------------------
     Publieke functie
     ------------------------------------------------------------------------- */

  /**
   * Tekent slide `index` van `deck` op `canvas`.
   *   deck:  { slides: [...], dot, showNumbers }
   *   env:   { logo, photo, crop, sectionNumber }
   *   opts:  { scale } — 1 = 1920 × 1080
   */
  function renderSlide(canvas, deck, index, env, opts = {}) {
    const fr = frame();
    const ctx = prepare(canvas, W, H, opts.scale || 1);
    const slide = deck.slides[index] || {};
    const p = plan(ctx, fr, slide, env || {}, deck);

    paintBackground(ctx, fr);
    ctx.save();
    const info = RENDER[p.layout](ctx, fr, slide, env || {}, deck, p) || {};
    ctx.restore();

    // Voetregel en slidenummer, dan het logo en de cyaan balk
    drawDomain(ctx, info.footerFrame || fr, '#ffffff');
    if (deck.showNumbers !== false) {
      const label = `${String(index + 1).padStart(2, '0')} / ${String(deck.slides.length).padStart(2, '0')}`;
      setFont(ctx, 700, GRID.footerSize, 0.04);
      ctx.fillStyle = SOFT;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, fr.logo.x - 44 - tw, fr.footerY + (GRID.footerSize * CAP) / 2);
    }
    drawLogo(ctx, fr, env && env.logo);
    finish(ctx, W, GRID.bar);
    return { photo: info.photo || null, overflow: flags.overflow, width: W, height: H };
  }

  global.PMSlides = {
    renderSlide, plan, frame, LAYOUTS, GRID, GEOM, W, H,
    defaultTable, normalizeTable, TABLE_LIMITS, TABLE_STYLE,
    palettes: { TEXT, BODY, SOFT, META, LABEL_PAL },
  };
})(window);
