/* =============================================================================
   presentation/templates.js — dertien slide-layouts in de Pure Minds huisstijl
   (zeven, vier voor het voorstel en de positionering, twee alleen voor de
   positionering)
   -----------------------------------------------------------------------------
   Slides zijn 1920 × 1080 (16:9) en worden getekend met dezelfde bouwstenen
   als de Insta-posts (js/shared/canvas-kit.js). Vaste regels voor elke slide:

     - inkt-achtergrond met cyaan gloed en zeshoekpatroon, cyaan balk bovenaan
     - label linksboven met zeshoek-bullet
     - voetregel linksonder (pureminds.nl), slidenummer naast het logo
     - optioneel de Emerce 100-badge (deck.badge): klein en wit, links van
       het slidenummer, zoals het keurmerk op het briefpapier
     - wit zeshoek-logo rechtsonder, op elke slide op exact dezelfde plek

   Layouts: title, section, bullets, split, quote (citaat of kerncijfer),
   table (tabel met kopregel; korps en kolombreedtes schalen mee), closing.
   Voor het voorstel en de positionering (types): tekst (titel + alinea's),
   kolommen (twee of drie blokken naast elkaar), vragen (genummerd in cyaan
   zeshoeken) en vpc (waardepropositie: waardemap en klantprofiel; style 'vol'
   is de dichte variant van de positionering, met meer tekst per vak).
   Alleen voor de positionering: bmc (business model canvas: zeven blokken in
   vijf kolommen) en toelichting (titel met tekst die over twee kolommen loopt).
   De titelslide kan een klantlogo tonen: env.fit === 'logo' zet het beeld in
   zijn geheel op een witte zeshoek (helemaal in beeld), in plaats van de
   zeshoek te vullen.
   Alleen tekenwerk dat PMPdfCanvas kent (paden, arc, rechthoeken, tekst).

   Elke layout bestaat uit twee delen: plan() rekent uit waar de tekst komt en
   hoe groot die wordt (past hij niet, dan krimpt hij), en de tekenfunctie zet
   dat plan op het canvas. De PowerPoint-export (js/presentation/pptx.js)
   gebruikt hetzelfde plan en dezelfde vormmaten (GEOM), zodat een slide in
   PowerPoint er net zo uitziet als in de preview.

   renderSlide() geeft ook terug wat waar staat (regions: rechthoeken in
   ontwerp-px, voor klikken in de preview) en welke tekst niet paste
   (overflowKeys, het grootste blok eerst; bij een canvas van de positionering
   daarna de blokken of vakken die niet passen, als 'bmc:proposities'). Grootte van de titel:
   slide.titleSize = 'klein' | 'normaal' | 'groot' (typeschaal uit PM.brand),
   als factor binnen het passend maken; normaal tekent precies als voorheen.
   ============================================================================= */
(function (global) {
  'use strict';

  const {
    COLORS, CAP, DESC: K_DESC, SQRT3, flags,
    rgba, setFont, hexPath, paintBackground,
    runsFrom, layoutText, drawText, parseBody, layoutBody, drawBody, ellipsize,
    drawLabel, drawDomain, drawLogo, drawBadge, drawPhoto, drawContain, hexEcho, prepare, finish,
  } = global.PMCanvas;

  // Parsers en namen van het voorstel en de positionering (js/presentation/generator.js).
  // Pas opvragen bij het tekenen van zo'n layout: de gewone presentatie mag er niet
  // van afhangen, ook niet als dat bestand later of niet laadt
  const gen = () => global.PMGenerator || null;

  const W = 1920;
  const H = 1080;

  /* ---------------------------------------------------------------------------
     Wat er getekend is: regio's (klikken in de preview) en teksten die niet
     pasten. Alleen meten, niets extra tekenen: de pixels blijven gelijk.
     ------------------------------------------------------------------------- */

  let regions = [];
  let over = [];

  const region = (key, x, y, w, h) => {
    if (w > 0 && h > 0) regions.push({ key, rect: { x, y, w, h } });
  };

  // Rechthoek om een blok uit fitStack (tekst of lopende tekst), getekend vanaf (x, top)
  function blockRegion(b, x, top) {
    const lineW = (block) => Math.max(0, ...block.lines.map((l) => l.w));
    const w = b.body != null
      ? Math.max(0, ...b.block.items.map((it) => (it.bullet ? b.block.indent : 0) + lineW(it.block)))
      : lineW(b.block);
    region(b.key, x, top, w, b.block.height);
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

  // Een stapel die niet paste: de velden erin, het grootste blok eerst (dat is meestal de oorzaak)
  function noteOver(stack) {
    if (!stack || !stack.over) return;
    stack.blocks.filter((b) => !b.empty && b.key).sort((a, b) => b.block.height - a.block.height)
      .forEach((b) => { if (!over.includes(b.key)) over.push(b.key); });
  }

  // Korpsgrootte van de titel in de gekozen stap van de typeschaal; normaal = de basismaat
  function titleSize(base, s) {
    const brand = global.PM && global.PM.brand;
    return brand && s && s.titleSize && s.titleSize !== 'normaal' ? brand.sizeFor(base, s.titleSize) : base;
  }

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
    // Alleen in de soorten van types (de app filtert erop): het voorstel en de positionering.
    // names: een andere naam in een soort (de positionering noemt de canvassen bij hun naam)
    { id: 'tekst', name: 'Tekst', sub: 'titel + alinea’s', types: ['voorstel', 'positionering'] },
    { id: 'kolommen', name: 'Kolommen', sub: 'twee of drie blokken', types: ['voorstel', 'positionering'] },
    { id: 'vragen', name: 'Genummerd', sub: 'vragen of stappen', types: ['voorstel', 'positionering'] },
    { id: 'vpc', name: 'Waardepropositie', sub: 'klantprofiel + waardemap', types: ['voorstel', 'positionering'], names: { positionering: 'Waarde Propositie Canvas' } },
    { id: 'bmc', name: 'Business Model Canvas', sub: 'zeven blokken', types: ['positionering'] },
    { id: 'toelichting', name: 'Toelichting', sub: 'tekst in twee kolommen', types: ['positionering'] },
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
    padYTight: 0.3,          // compacte rijen: alleen als de tabel anders te klein wordt
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

  // Woorden die in een prijskolom horen (N.T.B., n.v.t., p.m., gratis ...): tellen niet mee,
  // zodat die kolom rechts blijft. Alleen zulke woorden: links, zoals gewone tekst
  const NEUTRAL = /^(n\.?\s?t\.?\s?b\.?|n\.?v\.?t\.?|p\.?m\.?|op aanvraag|gratis|in overleg|[-–—])$/i;

  // padYf: lucht boven en onder de tekst als factor van het korps (compacte rijen: padYTight)
  function tableLayout(ctx, t, size, maxW, force, padYf = TABLE_STYLE.padY) {
    const S = TABLE_STYLE;
    const nC = t.cells[0].length;
    const padX = Math.round(size * S.padX);
    const padY = Math.round(size * padYf);
    const body = t.cells.slice(t.header ? 1 : 0);
    const numeric = Array.from({ length: nC }, (_, c) => {
      const vals = body.map((r) => r[c]).filter((v) => {
        const text = String(v).replace(/\*\*/g, '').trim();
        return text && !NEUTRAL.test(text);
      });
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
  function fitTable(ctx, table, maxW, maxH, padYf) {
    const t = normalizeTable(table);
    let last = null;
    for (let size = TABLE_STYLE.size; size >= TABLE_STYLE.min; size -= 2) {
      const res = tableLayout(ctx, t, size, maxW, false, padYf);
      if (res) {
        last = res;
        if (res.h <= maxH) return res;
      }
    }
    flags.overflow = true;
    const res = last || tableLayout(ctx, t, TABLE_STYLE.min, maxW, true, padYf);
    res.over = true;
    return res;
  }

  function drawTable(ctx, T) {
    T.rows.forEach((row, r) => {
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
        region(`cell:${r},${c}`, x, y, T.widths[c], row.h);
        x += T.widths[c];
      });
    });
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
    // Klantlogo op een eigen witte zeshoek: helemaal in beeld (rechterrand op de
    // marge, gelijk met het logo rechtsonder) en iets kleiner dan de foto-zeshoek,
    // zodat het logo ruim binnen de randen blijft. Het logo past heel in `box`
    // (contain); w en h zijn dat vak als factor van r, met aan elke kant zo'n
    // 75 px wit tot de rand (ook een breed logo met een kader). pptx.js tekent hetzelfde
    heroLogo: (() => {
      const r = 320;
      const cx = W - GRID.m - (r * SQRT3) / 2;
      const cy = 430;
      const w = 1.26;
      const h = 0.96;
      return { cx, cy, r, echo: 9, w, h, box: { x: cx - (w * r) / 2, y: cy - (h * r) / 2, w: w * r, h: h * r } };
    })(),
    kolommen: { gap: 96, head: 32, headGap: 40, text: 34, top: 72 },
    vragen: { r: 30, numberSize: 30, textGap: 28, colGap: 96, rowGap: 32, top: 48, outroGap: 48, text: 32, outro: 30 },
    vpc: {
      // Zo groot als tussen label en voetregel past; onderkant boven pureminds.nl en de badge
      S: 664, gap: 150, top: 190, captionSize: 24, captionGap: 14, outline: 5, inner: 3,
      innerStroke: 'rgba(255,255,255,.35)', hubR: 40, arrow: { lw: 4, head: 16 },
      head: 26, item: 22, uitleg: 20, headMin: 18, itemMin: 16, lh: 1.3,
      // Tekstvakken: [x1, y1, x2, y2] als fractie van de zijde (vierkant, vanaf linksboven)
      // of van de straal (cirkel, vanaf het middelpunt); ze blijven binnen de driehoeken en de wig.
      // In de cirkel ook vol minstens 8 px van de lijnen, de rand en de zeshoek in het midden
      zones: [
        { key: 'verschaffers', shape: 'square', box: [0.48, 0.05, 0.95, 0.43] },
        { key: 'verzachters', shape: 'square', box: [0.48, 0.57, 0.95, 0.95] },
        { key: 'producten', shape: 'square', box: [0.04, 0.33, 0.31, 0.67] },
        { key: 'taken', shape: 'circle', box: [0.34, -0.29, 0.92, 0.29] },
        { key: 'voordelen', shape: 'circle', box: [-0.68, -0.68, 0.10, -0.145] },
        { key: 'pijnen', shape: 'circle', box: [-0.68, 0.145, 0.10, 0.68] },
      ],
      // style 'vol' (positionering): dezelfde vormen, maar veel meer tekst per vak. Kleiner
      // korps (kop 15, punten 13 px op zijn kleinst) en punten dichter op elkaar. Past een
      // vak niet in zijn box hierboven, dan loopt de tekst door het hele vak, de driehoek of
      // de wig (zie volRegion): pad px van de binnenlijnen, edge van de rand, hub van het
      // midden van de zeshoek; een strook smaller dan minW blijft leeg, en de tekst kan
      // om de step px beginnen (de middelste plek die past)
      vol: {
        head: 26, item: 22, uitleg: 20, headMin: 15, itemMin: 13, lh: 1.25, itemGap: 0.2, headGap: 12, minScale: 0.56,
        pad: 12, edge: 16, hub: 54, minW: 150, step: 8,
      },
    },
    // Business model canvas: vijf kolommen tussen het label en het logo. Kolom 1 is één
    // paneel met Key Partners en daaronder (na een lijn) Key Resources; kolom 4 heeft
    // Klantrelaties en Kanalen, verdeeld naar hun inhoud (tussen splitMin en splitMax).
    // Vlakke panelen met een cyaan balk bovenaan, geen rand. Zo hoog en breed dat een vol
    // canvas als dat van Eurosit op 14 px past met twee regels over (kolom 4: samen)
    bmc: {
      top: 30, bottom: 28, gap: 16, splitMin: 0.35, splitMax: 0.65,
      pad: 16, padTop: 14, padBottom: 10, bar: 4,
      fill: TABLE_STYLE.zebra, ruleColor: TABLE_STYLE.rule, ruleW: 2, ruleAbove: 24, ruleBelow: 14,
      head: 24, headMin: 16, headGap: 10, item: 20, itemMin: 14, uitleg: 18, lh: 1.25, itemGap: 0.2,
    },
    // Toelichting: titel over de volle breedte, de tekst loopt over twee kolommen
    toelichting: { title: 60, titleMin: 40, text: 30, textMin: 16, lh: 1.4, colGap: 96, titleGap: 40, bottom: 32 },
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
      result = stackAt(ctx, items, maxW, k);
      if (result.height <= maxH) return result;
    }
    flags.overflow = true;
    result.over = true;
    return result;
  }

  // Eén stap van fitStack: de stapel op schaal k. Layouts die meerdere
  // stapels samen laten krimpen (kolommen, vragen, vpc) gebruiken dit direct
  function stackAt(ctx, items, maxW, k) {
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
    return { blocks, height };
  }

  // Een woord dat op tekens is afgebroken (te smal vak): liever een maatje kleiner
  const isBroken = (stack) => stack.blocks.some((b) => (b.body != null ? b.block.items.some((it) => it.block.broken) : b.block.broken));

  // mark: false als de layout zelf een groter vak als regio geeft (kolom, rij, vak)
  function drawStack(ctx, stack, x, top, mark = true) {
    let y = top;
    for (const b of stack.blocks) {
      if (b.empty) continue;
      y += b.gap;
      if (b.body != null) drawBody(ctx, b.block, x, y, b.colors || BODY);
      else drawText(ctx, b.block, x, y, b.colors || TEXT);
      if (b.key && mark) blockRegion(b, x, y);
      y += b.block.height;
    }
  }

  const TITLE = (size) => ({ size, weight: 800, emWeight: 800, track: -0.02, lh: 1.08 });
  const PARA = (size, weight = 400) => ({ size, weight, emWeight: 700, track: 0, lh: 1.45 });

  // Elke niet-lege regel wordt een opsommingspunt
  const asBullets = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => (/^[-•]\s/.test(l) ? l : `- ${l}`)).join('\n');

  // Een kopje in een vak: een regel die helemaal vet is (**Verwachte voordelen**)
  const ZONE_HEAD = /^\*\*[^*]+\*\*:?$/;

  // De regels van een vak van de waardepropositie: zoals asBullets, maar een kopje
  // blijft een kopje (geen punt) en houdt één lege regel erboven, zodat de groepjes
  // lucht krijgen. Ingesprongen punten worden gewone punten
  function zoneLines(text) {
    const out = [];
    let blank = false;
    for (const raw of String(text || '').split('\n')) {
      const l = raw.trim();
      if (!l) {
        blank = out.length > 0;
        continue;
      }
      const head = ZONE_HEAD.test(l);
      if (head && blank) out.push('');
      out.push(head || /^[-•]\s/.test(l) ? l : `- ${l}`);
      blank = false;
    }
    return out.join('\n');
  }

  // Blokken en vragen uit de tekst: de regels staan in generator.js. Ontbreekt
  // dat bestand (los geladen), dan dezelfde regels hier, zodat de slide blijft tekenen
  const paragraphsOf = (body) => String(body || '').replace(/\r/g, '').trim().split(/\n[ \t]*\n/).map((b) => b.trim()).filter(Boolean);

  function parseColumns(body) {
    const P = gen();
    if (P && P.parseColumns) return P.parseColumns(body);
    return paragraphsOf(body).map((b) => {
      const [head, ...rest] = b.split('\n');
      return { head: head.trim(), text: rest.join('\n').trim() };
    });
  }

  function parseQuestions(body) {
    const P = gen();
    if (P && P.parseQuestions) return P.parseQuestions(body);
    const [first = '', ...rest] = paragraphsOf(body);
    const items = first.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = /\s[-–]\s/.exec(l);
      return { head: (m ? l.slice(0, m.index) : l).replace(/\*\*/g, '').trim(), text: m ? l.slice(m.index + m[0].length).trim() : '' };
    });
    return { items, outro: rest.join('\n\n') };
  }

  // Koppen en uitleg van de zes vakken van de waardepropositie
  const VPC_NAMES = { taken: 'Klanttaken', pijnen: 'Pijnpunten', voordelen: 'Voordelen', producten: 'Producten & diensten', verzachters: 'Pijnverzachters', verschaffers: 'Voordeelverschaffers' };
  const vpcInfo = (key) => {
    const P = gen();
    const info = (P && P.VPC_INFO && P.VPC_INFO[key]) || {};
    return { name: info.name || VPC_NAMES[key], uitleg: info.uitleg || '' };
  };
  // In de positionering heten de vakken zoals zijn toelichting-slides (Producten & Diensten)
  const volName = (key) => {
    const P = global.PMDecks && global.PMDecks.positionering;
    return (P && P.VPC_NAMES && P.VPC_NAMES[key]) || vpcInfo(key).name;
  };

  // Namen en uitleg van de zeven blokken van het business model canvas, in de volgorde van het canvas
  const BMC_NAMES = {
    partners: 'Key Partners', activiteiten: 'Kernactiviteiten', resources: 'Key Resources', proposities: 'Waardeproposities',
    relaties: 'Klantrelaties', kanalen: 'Kanalen', segmenten: 'Klantsegmenten',
  };
  const BMC_KEYS = Object.keys(BMC_NAMES);
  const bmcInfo = (key) => {
    const P = gen();
    const info = (P && P.BMC_INFO && P.BMC_INFO[key]) || {};
    return { name: info.name || BMC_NAMES[key], uitleg: info.uitleg || '' };
  };

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

  // key = het veld van de slide (regio's in de preview, melding bij te lange tekst)
  const STACK = {
    title: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(124, s)), min: 60 },
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(44), min: 26, gap: 40, colors: BODY },
      { key: 'meta', runs: runsFrom(s.meta), st: PARA(30, 700), min: 20, gap: 56, colors: META },
    ],
    section: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(112, s)), min: 56 },
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(44), min: 26, gap: 36, colors: BODY },
    ],
    bullets: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(88, s)), min: 48 },
      { key: 'body', body: asBullets(s.body), st: PARA(42), min: 22, gap: 56, colors: BODY },
    ],
    split: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(80, s)), min: 44 },
      { key: 'body', body: s.body, st: PARA(36), min: 20, gap: 44, colors: BODY },
    ],
    stat: (s) => [
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(50, 600), min: 28, colors: TEXT },
      { key: 'author', runs: runsFrom(s.author), st: PARA(28, 700), min: 18, gap: 28, colors: { color: SOFT, em: '#ffffff' } },
    ],
    quote: (s) => [
      { key: 'quote', runs: runsFrom(s.quote), st: { ...TITLE(titleSize(68, s)), weight: 700, emWeight: 800, lh: 1.25 }, min: 36 },
      { key: 'author', runs: runsFrom(s.author), st: PARA(32, 700), min: 20, gap: 48, colors: META },
    ],
    table: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(80), min: 44 },
    ],
    // Toelichting onder de tabel: 26 px, of kleiner als de tabel kleiner is (nooit groter dan de tabel)
    note: (s, size = 26) => [
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(size), min: Math.min(18, size), colors: { color: SOFT, em: '#ffffff' } },
    ],
    closing: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(124, s)), min: 60 },
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(44), min: 24, gap: 36, colors: BODY },
      { key: 'body', body: asBullets(s.body), st: PARA(34, 600), min: 20, gap: 60, colors: TEXT },
    ],
    // Lopende tekst zoals bij Beeld + tekst: "- " wordt een opsomming, een lege regel geeft lucht
    tekst: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(80, s)), min: 44 },
      { key: 'body', body: s.body, st: PARA(36), min: 20, gap: 48, colors: BODY },
    ],
    // Titel en inleiding boven de kolommen; de kolommen zelf krimpen samen (plan)
    kolommen: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(80, s)), min: 44 },
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(36), min: 22, gap: 32, colors: BODY },
    ],
    vragen: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(72, s)), min: 44 },
      { key: 'subtitle', runs: runsFrom(s.subtitle), st: PARA(32), min: 20, gap: 28, colors: BODY },
    ],
    // Geen titel: het diagram krijgt de hele hoogte. Per vak een kop met de
    // punten, of de uitleg als het vak nog leeg is. style 'vol': kleiner en dichter
    vpc: (s) => {
      const v = s.vpc && typeof s.vpc === 'object' ? s.vpc : {};
      const vol = s.style === 'vol';
      const G = vol ? GEOM.vpc.vol : GEOM.vpc;
      return GEOM.vpc.zones.map((z) => {
        const key = `vpc:${z.key}`;
        const { name, uitleg } = vpcInfo(z.key);
        const text = zoneLines(v[z.key]);
        // Nooit kleiner dan 18 px (kop) en 16 px (punten, uitleg): ook vol blijft het leesbaar.
        // Trefwoorden staan wat dichter op elkaar dan lopende tekst, zodat het korps groter blijft.
        // style 'vol' heeft veel meer tekst per vak: daar 15 en 13 px, zoals in de referentie
        return [
          { key, runs: runsFrom(vol ? volName(z.key) : name), st: { size: G.head, weight: 700, emWeight: 700, track: 0, lh: 1.2 }, min: G.headMin, colors: { color: '#ffffff', em: '#ffffff' } },
          text
            ? { key, body: text, st: vol ? { ...PARA(G.item), lh: G.lh, itemGap: G.itemGap } : { ...PARA(G.item), lh: G.lh }, min: G.itemMin, gap: vol ? G.headGap : 12, colors: BODY }
            : { key, runs: runsFrom(uitleg), st: { ...PARA(G.uitleg), lh: G.lh }, min: G.itemMin, gap: 10, colors: { color: SOFT, em: '#ffffff' } },
        ];
      });
    },
    // Business model canvas: per blok de naam met de trefwoorden eronder, of de uitleg
    // als het blok nog leeg is. De tekst zoals bij Tekst: een regel **vet** wordt een
    // kopje, "- " een punt, een lege regel geeft lucht
    bmc: (s) => {
      const b = s.bmc && typeof s.bmc === 'object' ? s.bmc : {};
      const G = GEOM.bmc;
      return BMC_KEYS.map((k) => {
        const key = `bmc:${k}`;
        const { name, uitleg } = bmcInfo(k);
        const text = String(b[k] == null ? '' : b[k]);
        return [
          { key, runs: runsFrom(name), st: { size: G.head, weight: 700, emWeight: 700, track: 0, lh: 1.2 }, min: G.headMin, colors: { color: '#ffffff', em: '#ffffff' } },
          text.replace(/\*\*/g, '').trim()
            ? { key, body: text, st: { ...PARA(G.item), lh: G.lh, itemGap: G.itemGap }, min: G.itemMin, gap: G.headGap, colors: BODY }
            : { key, runs: runsFrom(uitleg), st: { ...PARA(G.uitleg), lh: G.lh }, min: G.itemMin, gap: G.headGap, colors: { color: SOFT, em: '#ffffff' } },
        ];
      });
    },
    // Toelichting: alleen de titel; de tekst loopt over twee kolommen (planToelichting)
    toelichting: (s, deck) => [
      { key: 'title', runs: runsFrom(s.title, { dot: deck.dot }), st: TITLE(titleSize(GEOM.toelichting.title, s)), min: GEOM.toelichting.titleMin },
    ],
  };

  // Linkerrand van het beeld rechts (foto in zeshoek, logo op zijn zeshoek, of de zeshoekcompositie)
  function heroLeft(env) {
    const { r, cx } = env.photo && env.fit === 'logo' ? GEOM.heroLogo : GEOM.hero;
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
    over = [];
    const layout = STACK[s.layout] && RENDER[s.layout] ? s.layout : 'bullets';
    const area = fr.contentBottom - fr.contentTop;
    const centered = (stack) => fr.contentTop + (area - stack.height) / 2;

    if (layout === 'title' || layout === 'closing') {
      const maxW = Math.min(1100, heroLeft(env) - fr.m - 80);
      const stack = fitStack(ctx, STACK[layout](s, deck), maxW, area);
      noteOver(stack);
      return { layout, stack, x: fr.m, top: centered(stack), maxW, maxH: area, center: true, labelW: maxW };
    }
    if (layout === 'section') {
      const { r } = GEOM.section;
      const x = fr.m + r * SQRT3 + GEOM.section.gap;
      const stack = fitStack(ctx, STACK.section(s, deck), W - fr.m - x, area);
      noteOver(stack);
      const cy = (fr.contentTop + fr.contentBottom) / 2;
      return { layout, stack, x, top: cy - stack.height / 2, maxW: W - fr.m - x, maxH: area, center: true, hex: { cx: fr.m + (r * SQRT3) / 2, cy, r } };
    }
    if (layout === 'bullets' || layout === 'tekst') {
      const maxW = Math.round(fr.contentW * 0.86);
      const stack = fitStack(ctx, STACK[layout](s, deck), maxW, area);
      noteOver(stack);
      return { layout, stack, x: fr.m, top: fr.contentTop, maxW, maxH: area, center: false };
    }
    if (layout === 'split') {
      const left = s.imageSide !== 'right';
      const half = W / 2;
      const { pad } = GEOM.split;
      const x = left ? half + pad : fr.m;
      const maxW = left ? W - fr.m - x : half - pad - fr.m;
      const stack = fitStack(ctx, STACK.split(s, deck), maxW, area);
      noteOver(stack);
      const photoBox = { x: left ? 0 : half, y: 0, w: half, h: H };
      return { layout, stack, x, top: fr.contentTop, maxW, maxH: area, center: false, left, photoBox, textFrame: { ...fr, m: x, contentW: maxW } };
    }
    if (layout === 'table') {
      // Titel bovenaan, de tabel eronder over de volle breedte, een toelichting direct onder de tabel
      // Een grote tabel mag de titel iets kleiner maken, als de tabel daardoor beter leesbaar wordt
      const maxW = fr.contentW;
      const before = flags.overflow;
      // De toelichting eerst op 26 px; na de tabel op diens korps, als die kleiner is
      const noteAt = (size) => {
        const stack = fitStack(ctx, STACK.note(s, size), maxW, 110);
        return { stack, gap: stack.height ? Math.round((32 * size) / 26) : 0 };
      };
      let note = noteAt(26);
      const room = (top) => fr.contentBottom - top - note.stack.height - note.gap;
      let best = null;
      for (const base of [80, 64, 52]) {
        flags.overflow = false;
        const size = titleSize(base, s);
        const items = STACK.table(s, deck).map((it) => ({ ...it, st: TITLE(size), min: Math.min(it.min, size) }));
        const stack = fitStack(ctx, items, maxW, area * 0.34);
        const tableTop = fr.contentTop + stack.height + (stack.height ? 56 : 0);
        const T = fitTable(ctx, s.table, maxW, room(tableTop));
        const fits = !flags.overflow;
        // Een kleinere titel als de tabel daarmee groter wordt; onder 24 px telt elke stap
        if (!best || T.size > best.T.size + 3 || (best.T.size < 24 && T.size > best.T.size)) best = { stack, tableTop, T };
        if (T.size >= 26 && fits) break;
      }
      const { stack, tableTop } = best;
      // Onder 24 px: compactere rijen (minder lucht boven en onder de tekst), als dat een groter korps geeft
      const tighter = (T) => {
        if (T.size >= 24) return T;
        const C = fitTable(ctx, s.table, maxW, room(tableTop), TABLE_STYLE.padYTight);
        return C.size > T.size || (T.over && !C.over) ? C : T;
      };
      let T = tighter(best.T);
      // Een kleinere toelichting laat ruimte over: die gaat naar de tabel (die dus niet kleiner wordt)
      if (note.stack.height && T.size < 26) {
        note = noteAt(T.size);
        const again = tighter(fitTable(ctx, s.table, maxW, room(tableTop)));
        if (again.size > T.size || (T.over && !again.over)) T = again;
      }
      flags.overflow = before || !!stack.over || !!T.over || !!note.stack.over;
      if (T.over) over.push('table');
      noteOver(stack);
      noteOver(note.stack);
      const titleH = stack.height;
      Object.assign(T, { x: fr.m, y: tableTop });
      return {
        layout, stack, x: fr.m, top: fr.contentTop, maxW, maxH: titleH + 30, center: false,
        table: T, note: note.stack.height ? { stack: note.stack, top: tableTop + T.h + note.gap } : null,
      };
    }
    if (layout === 'quote' && s.style === 'stat') {
      const value = String(s.value || '').trim() || '0%';
      const size = fitValueSize(ctx, value, fr.contentW * 0.9);
      const maxH = area - size * CAP - GEOM.stat.gap;
      const stack = fitStack(ctx, STACK.stat(s), fr.contentW * 0.8, maxH);
      noteOver(stack);
      const total = size * CAP + GEOM.stat.gap + stack.height;
      const top = fr.contentTop + (area - total) / 2;
      return { layout, stack, x: fr.m, top: top + size * CAP + GEOM.stat.gap, maxW: fr.contentW * 0.8, maxH, center: false, value: { text: value, size, baseline: top + size * CAP } };
    }
    if (layout === 'quote') {
      const { r } = GEOM.quote;
      const x = fr.m + r * SQRT3 + GEOM.quote.gap;
      const stack = fitStack(ctx, STACK.quote(s), W - fr.m - x, area);
      noteOver(stack);
      const top = centered(stack);
      return { layout, stack, x, top, maxW: W - fr.m - x, maxH: area, center: true, hex: { cx: fr.m + (r * SQRT3) / 2, cy: top + r, r } };
    }
    if (layout === 'kolommen') return planColumns(ctx, fr, s, deck, area);
    if (layout === 'vragen') return planQuestions(ctx, fr, s, deck, area);
    if (layout === 'vpc') return planVpc(ctx, fr, s);
    if (layout === 'bmc') return remembered(ctx, `bmc|${gen() ? 1 : 0}|${JSON.stringify(s.bmc || null)}`, () => planBmc(ctx, fr, s));
    if (layout === 'toelichting') {
      return remembered(ctx, `toelichting|${JSON.stringify([s.title, s.body, s.titleSize, !!(deck && deck.dot)])}`, () => planToelichting(ctx, fr, s, deck, area));
    }
    return null;
  }

  // Schalen 1 tot en met `min` in stappen van .04 (zoals fitStack), zonder afrondingsdrift
  const scales = (min) => Array.from({ length: Math.floor((1 - min) / 0.04 + 1e-9) + 1 }, (_, i) => 1 - i * 0.04);

  /**
   * Kolommen: titel en inleiding bovenaan, daaronder twee of drie blokken naast
   * elkaar (kop als cyaan label, tekst eronder). Alle kolommen krijgen dezelfde
   * schaal, zodat koppen en tekst gelijk blijven. Plan-extra's (ook voor pptx.js):
   * columns [{ x, w, headTop, headSize, head, stack, top, maxH }].
   */
  function planColumns(ctx, fr, s, deck, area) {
    const G = GEOM.kolommen;
    const maxW = Math.round(fr.contentW * 0.86);
    const head = fitStack(ctx, STACK.kolommen(s, deck), maxW, area * 0.45);
    noteOver(head);
    const blocks = parseColumns(s.body);
    const list = blocks.slice(0, 3);
    const n = list.length;
    const colW = n ? (fr.contentW - (n - 1) * G.gap) / n : 0;
    const headTop = fr.contentTop + head.height + (head.height ? G.top : 0);
    const room = fr.contentBottom - headTop;

    let columns = [];
    let fits = false;
    for (const k of scales(0.5)) {
      const headSize = Math.max(22, Math.round(G.head * k));
      const headGap = Math.round(G.headGap * k);
      const top = headTop + headSize * CAP + headGap;
      columns = list.map((b, i) => ({
        x: fr.m + i * (colW + G.gap),
        w: colW,
        headTop,
        headSize,
        head: String(b.head || '').replace(/\*\*/g, ''),   // de kop is al vet en cyaan
        stack: stackAt(ctx, [{ key: 'body', body: b.text, st: PARA(G.text), min: 22, colors: BODY }], colW, k),
        top,
        maxH: fr.contentBottom - top,
      }));
      fits = columns.every((c) => c.top - headTop + c.stack.height <= room);
      if (fits) break;
    }
    if (!fits || blocks.length > 3) {
      flags.overflow = true;
      if (!over.includes('body')) over.push('body');
    }
    return { layout: 'kolommen', stack: head, x: fr.m, top: fr.contentTop, maxW, maxH: area * 0.45, center: false, columns };
  }

  // Een "weeskind": de laatste regel van een blok is één los woord ("| Competitors"
  // telt als één woord) of een heel kort eindje (minder dan 30% van de breedte)
  function hasOrphan(stack, maxW) {
    const b = stack.blocks[0];
    if (!b || b.empty || b.block.broken) return false;
    const lines = b.block.lines;
    if (lines.length < 2) return false;
    const last = lines[lines.length - 1];
    const words = [''];
    for (const sg of last.segs) {
      if (sg.space) words.push('');
      else words[words.length - 1] += sg.text;
    }
    return words.filter((wd) => /[\p{L}\p{N}]/u.test(wd)).length < 2 || last.w < maxW * 0.3;
  }

  /**
   * Genummerd: titel en inleiding over de volle breedte, daaronder de punten met
   * hun nummer in een cyaan zeshoek (vanaf vier punten in twee kolommen, eerst de
   * linker vol) en eventueel een slotzin. Plan-extra's (ook voor pptx.js):
   * items [{ n, hex: { cx, cy, r }, numberSize, x, top, w, stack, row }], outro { stack, top } | null.
   * item.w is de breedte waarop de tekst is gezet (soms iets smaller dan de kolom, zie hieronder).
   */
  function planQuestions(ctx, fr, s, deck, area) {
    const G = GEOM.vragen;
    // Volle breedte: een lange titel ("Positioneringsdocument en merkverhaal") blijft op één regel
    const maxW = fr.contentW;
    const head = fitStack(ctx, STACK.vragen(s, deck), maxW, area * 0.45);
    noteOver(head);
    const q = parseQuestions(s.body);
    const list = q.items.slice(0, 8);
    const outroText = String(q.outro || '').trim();
    const cols = list.length > 3 ? 2 : 1;
    const perCol = Math.ceil(list.length / cols);
    const colW = cols === 2 ? (fr.contentW - G.colGap) / 2 : Math.round(fr.contentW * 0.86);
    const gridTop = fr.contentTop + head.height + (head.height ? G.top : 0);
    const room = fr.contentBottom - gridTop;

    let res = null;
    for (const k of scales(0.6)) {
      const r = Math.max(22, G.r * k);
      const numberSize = Math.round(G.numberSize * k);
      const tx = r * SQRT3 + G.textGap * k;
      const w = colW - tx;
      const items = list.map((it, i) => {
        // Kop en tekst met een gedachtestreepje ertussen, zoals in de voorstellen (Pijn – Welke …)
        const runs = runsFrom(it.text ? `**${it.head}** – ${it.text}` : `**${it.head}**`);
        const at = (width) => stackAt(ctx, [{ key: 'body', runs, st: PARA(G.text), min: 20, colors: BODY }], width, k);
        let stack = at(w);
        let iw = w;
        // Eén woord of een kort eindje alleen op de laatste regel: iets smaller zetten,
        // zodat er meer doorloopt (zelfde aantal regels, dus de rij wordt niet hoger)
        if (hasOrphan(stack, w)) {
          const n = stack.blocks[0].block.lines.length;
          for (let f = 0.96; f >= 0.6; f -= 0.04) {
            const alt = at(Math.floor(w * f));
            if (alt.blocks[0].block.lines.length !== n) break;
            if (!hasOrphan(alt, w)) {
              stack = alt;
              iw = Math.floor(w * f);
              break;
            }
          }
        }
        const first = stack.blocks[0].block.st.size;
        // De eerste regel staat op de hoogte van het midden van de zeshoek
        const dy = Math.max(0, r - (first * CAP) / 2);
        return { n: i + 1, col: Math.floor(i / perCol), row: i % perCol, r, numberSize, tx, w: iw, stack, dy, h: Math.max(2 * r, dy + stack.height) };
      });
      // Loopt een punt over meer regels, dan krijgen alle rijen dezelfde hoogte: een rustig ritme
      const wraps = items.some((it) => it.stack.blocks[0].block.lines.length > 1);
      const even = wraps ? Math.max(...items.map((it) => it.h)) : 0;
      let y = gridTop;
      for (let row = 0; row < perCol; row++) {
        const inRow = items.filter((it) => it.row === row);
        const h = wraps ? even : Math.max(...inRow.map((it) => it.h));
        inRow.forEach((it) => { it.rowTop = y; it.rowH = h; });
        y += h + (row < perCol - 1 ? G.rowGap * k : 0);
      }
      const gridH = y - gridTop;
      const outro = outroText
        ? stackAt(ctx, [{ key: 'body', body: outroText, st: PARA(G.outro), min: 18, colors: BODY }], maxW, k)
        : null;
      const outroTop = gridTop + (list.length ? gridH + G.outroGap * k : 0);
      res = { items, outro, outroTop, height: outroTop - gridTop + (outro ? outro.height : 0) };
      if (res.height <= room) break;
    }
    if (res.height > room || q.items.length > 8) {
      flags.overflow = true;
      if (!over.includes('body')) over.push('body');
    }
    const items = res.items.map((it) => {
      const colX = fr.m + it.col * (colW + G.colGap);
      return {
        n: it.n,
        hex: { cx: colX + (it.r * SQRT3) / 2, cy: it.rowTop + it.r, r: it.r },
        numberSize: it.numberSize,
        x: colX + it.tx,
        top: it.rowTop + it.dy,
        w: it.w,
        stack: it.stack,
        row: { x: colX, y: it.rowTop, w: colW, h: it.rowH },
      };
    });
    return {
      layout: 'vragen', stack: head, x: fr.m, top: fr.contentTop, maxW, maxH: area * 0.45, center: false,
      items, outro: res.outro ? { stack: res.outro, top: res.outroTop } : null,
    };
  }

  /**
   * Waardepropositie: de waardemap (vierkant) links en het klantprofiel
   * (cirkel) rechts, met de "fit" ertussen: twee pijlen die elkaar in het
   * midden raken (►◄). Alle zes vakken krijgen dezelfde schaal. Het canvas is
   * een interne tool: geen bronvermelding. Plan-extra's (ook voor pptx.js):
   * square { x, y, s }, circle { cx, cy, r }, zones [{ key, x, y, w, h, stack, top }]
   * (style 'vol': soms meer tekstvakken met dezelfde key, als de tekst doorloopt),
   * segment { runs, hits, baseline, right, w } | null ("Klantsegment: … · Klanttype: …",
   * rechts uitgelijnd; hits [{ key: 'segment' | 'klanttype', dx, w }] voor de regio's),
   * captions [{ text, x, baseline }], inner (lijnen) en
   * arrow { x1, x2, y, mid }: van de rand van het vierkant (x1) en van de cirkel (x2)
   * naar het midden; beide punten liggen op mid.
   */
  function planVpc(ctx, fr, s) {
    const G = GEOM.vpc;
    const x0 = Math.round((W - (2 * G.S + G.gap)) / 2);
    const square = { x: x0, y: G.top, s: G.S };
    const circle = { cx: x0 + G.S + G.gap + G.S / 2, cy: G.top + G.S / 2, r: G.S / 2 };
    const boxes = G.zones.map((z) => {
      const [x1, y1, x2, y2] = z.box;
      if (z.shape === 'square') return { key: z.key, x: square.x + x1 * G.S, y: square.y + y1 * G.S, w: (x2 - x1) * G.S, h: (y2 - y1) * G.S };
      return { key: z.key, x: circle.cx + x1 * circle.r, y: circle.cy + y1 * circle.r, w: (x2 - x1) * circle.r, h: (y2 - y1) * circle.r };
    });

    // Eén schaal voor alle vakken; een op tekens afgebroken woord telt als niet passend.
    // style 'vol': past een vak niet in zijn box, dan loopt de tekst door het hele vak
    const items = STACK.vpc(s);
    let zones;
    if (s.style === 'vol') {
      zones = volZones(measuring(ctx), items, boxes, G.zones.map((z) => volRegion(z.key, square, circle)));
    } else {
      let chosen = null;
      let fallback = null;
      let last = null;
      for (const k of scales(0.6)) {
        last = boxes.map((b, i) => stackAt(ctx, items[i], b.w, k));
        const fits = last.every((st, i) => st.height <= boxes[i].h);
        if (fits && !last.some(isBroken)) {
          chosen = last;
          break;
        }
        if (fits && !fallback) fallback = last;
      }
      const stacks = chosen || fallback || last;
      if (!chosen && !fallback) {
        flags.overflow = true;
        over.push('vpc');
      }
      zones = boxes.map((b, i) => ({ ...b, stack: stacks[i], top: b.y + (b.h - stacks[i].height) / 2 }));
    }

    // Klantsegment en klanttype rechts op de hoogte van het label (alleen wat is ingevuld)
    const v = s.vpc && typeof s.vpc === 'object' ? s.vpc : {};
    const clean = (t) => String(t || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    const parts = [['Klantsegment: ', clean(v.segment), 'segment'], ['Klanttype: ', clean(v.klanttype), 'klanttype']].filter(([, val]) => val);
    let segment = null;
    if (parts.length) {
      const size = 26;
      const sep = ' · ';
      const lead = { size, weight: 700, track: 0, color: COLORS.cyan };
      const text = { size, weight: 600, track: 0, color: '#ffffff' };
      const width = (st, t) => {
        setFont(ctx, st.weight, size, 0);
        return ctx.measureText(t).width;
      };
      // Alle ruimte rechts van het label (minstens 40% van de breedte). Te lang: de
      // langste waarde wordt ingekort, de ander houdt zoveel mogelijk
      const label = String(s.label || '').trim().toUpperCase();
      setFont(ctx, 700, fr.labelSize, 0.12);
      const labelEnd = label ? (fr.labelSize / 2) * SQRT3 + (fr.labelSize * 2) / 3 + ctx.measureText(label).width + 64 : 0;
      const room = Math.max(fr.contentW * 0.4, fr.contentW - labelEnd)
        - parts.reduce((sum, [l]) => sum + width(lead, l), 0) - (parts.length > 1 ? width(text, sep) : 0);
      const full = parts.map(([, val]) => width(text, val));
      const half = room / 2;
      const caps = parts.length === 1 ? [room]
        : full[0] <= half ? [full[0], room - full[0]]
          : full[1] <= half ? [room - full[1], full[1]] : [half, half];
      // hits: per deel waar het staat (vanaf het begin van de regel), zodat een klik
      // op "Klanttype: …" naar het veld klanttype gaat
      const runs = [];
      const hits = [];
      let at = 0;
      parts.forEach(([l, val, key], i) => {
        if (i) {
          runs.push({ ...text, text: sep, color: SOFT });
          at += width(text, sep);
        }
        setFont(ctx, text.weight, size, 0);
        const shown = ellipsize(ctx, val, caps[i]);
        runs.push({ ...lead, text: l }, { ...text, text: shown });
        const w = width(lead, l) + width(text, shown);
        hits.push({ key, dx: at, w });
        at += w;
      });
      segment = { runs, hits, baseline: fr.labelTop + fr.labelSize * CAP, right: W - fr.m, w: at };
    }

    const r45 = circle.r * Math.SQRT1_2;
    const c = { x: square.x + G.S / 2, y: square.y + G.S / 2 };
    const inner = [
      { x1: square.x, y1: square.y, x2: c.x, y2: c.y },
      { x1: square.x, y1: square.y + G.S, x2: c.x, y2: c.y },
      { x1: c.x, y1: c.y, x2: square.x + G.S, y2: c.y },
      { x1: circle.cx, y1: circle.cy, x2: circle.cx + r45, y2: circle.cy - r45 },
      { x1: circle.cx, y1: circle.cy, x2: circle.cx + r45, y2: circle.cy + r45 },
      { x1: circle.cx, y1: circle.cy, x2: circle.cx - circle.r, y2: circle.cy },
    ];
    const captionBase = square.y - G.captionGap;
    return {
      layout: 'vpc', stack: { blocks: [], height: 0 }, x: fr.m, top: fr.contentTop, maxW: fr.contentW, maxH: 0, center: false,
      labelW: segment ? fr.contentW - segment.w - 48 : fr.contentW,
      square, circle, zones, segment,
      captions: [
        { text: 'WAARDEMAP', x: square.x, baseline: captionBase },
        { text: 'KLANTPROFIEL', x: circle.cx - circle.r, baseline: captionBase },
      ],
      inner,
      // De middenlijnen lopen door tot in het gat; de punten raken elkaar precies in het midden
      arrow: { x1: square.x + G.S, x2: circle.cx - circle.r, y: circle.cy, mid: (square.x + G.S + circle.cx - circle.r) / 2 },
    };
  }

  /**
   * De vakken van de volle waardepropositie (style 'vol'), allemaal op dezelfde schaal.
   * items: STACK.vpc per vak, boxes: het vak zoals in het voorstel, regs: per vak de
   * ruimte van volRegion. Eerst per vak de grootste schaal die past (halveren: kleiner
   * past vrijwel altijd ook), dan vanaf de kleinste daarvan de eerste waarop alles past.
   * Geeft de tekstvakken [{ key, x, y, w, h, stack, top }]: per vak één, of meer als de
   * tekst doorloopt (elk wordt ook een tekstvak in PowerPoint).
   */
  function volZones(ctx, items, boxes, regs) {
    const ks = scales(GEOM.vpc.vol.minScale);
    // Per vak en schaal onthouden, ook tussen twee keer tekenen: bij elke toets wordt het
    // hele deck opnieuw gepland. De sleutel is de tekst, de plek en het proefwoord
    const probe = fontProbe(ctx.real);
    if (ZONE_MEMO.size > 400) ZONE_MEMO.clear();
    const zone = (i, k, mode) => {
      const id = `${mode}|${k}|${probe}|${regs[i].key}|${boxes[i].x},${boxes[i].y}|${JSON.stringify(items[i])}`;
      if (!ZONE_MEMO.has(id)) ZONE_MEMO.set(id, zoneAt(ctx, items[i], boxes[i], regs[i], k, mode));
      return ZONE_MEMO.get(id);
    };
    const test = (i, j) => zone(i, ks[j], 'test');
    const ok = (i, j) => test(i, j).fits && !test(i, j).broken;
    const first = items.map((it, i) => {
      let lo = 0;
      let hi = ks.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ok(i, mid)) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    });
    let pick = -1;
    let fallback = -1;
    for (let j = Math.max(...first); j < ks.length && pick < 0; j++) {
      if (items.every((it, i) => ok(i, j))) pick = j;
      else if (fallback < 0 && items.every((it, i) => test(i, j).fits)) fallback = j;
    }
    // Nergens zonder afgebroken woord: de eerste schaal waarop alles past
    for (let j = 0; j < ks.length && pick < 0 && fallback < 0; j++) {
      if (items.every((it, i) => test(i, j).fits)) fallback = j;
    }
    const j = pick >= 0 ? pick : fallback;
    if (j < 0) {
      flags.overflow = true;
      // Eerst het canvas (de melding), dan de vakken die op de kleinste schaal niet passen
      over.push('vpc', ...items.map((it, i) => i).filter((i) => !test(i, ks.length - 1).fits).map((i) => `vpc:${regs[i].key}`));
    }
    const k = ks[j < 0 ? ks.length - 1 : j];
    return items.flatMap((it, i) => zone(i, k, j < 0 ? 'force' : 'final').boxes);
  }

  /**
   * style 'vol': de ruimte van een vak van de waardepropositie (ontwerp-px). at(y) geeft
   * op hoogte y het stuk [links, rechts] dat vrij is van de binnenlijnen (pad), de rand
   * (edge) en de zeshoek in het midden (hub, gemeten vanaf zijn middelpunt); top en
   * bottom begrenzen het vak, mid is de hoogte van de zeshoek. Elke grens is recht, een
   * cirkelboog of die zeshoek, dus over een strook [y1, y2] is het krapst bij y1, y2 of mid.
   */
  function volRegion(key, sq, ci) {
    const V = GEOM.vpc.vol;
    const dd = V.pad * Math.SQRT2;   // horizontaal tot een lijn onder 45°
    const hubW = (dy) => (Math.abs(dy) < V.hub ? Math.sqrt(V.hub * V.hub - dy * dy) : null);
    // Rechts van de zeshoek (de linkergrens schuift op) of links ervan (de rechtergrens)
    const rightOf = (cx, dy, L) => {
      const h = hubW(dy);
      return h == null ? L : Math.max(L, cx + h);
    };
    const leftOf = (cx, dy, R) => {
      const h = hubW(dy);
      return h == null ? R : Math.min(R, cx - h);
    };
    const c = { x: sq.x + sq.s / 2, y: sq.y + sq.s / 2 };
    const r = ci.r - V.edge;
    const half = (dy) => Math.sqrt(Math.max(0, r * r - dy * dy));
    const edgeR = sq.x + sq.s - V.edge;
    const shapes = {
      // Boven in het vierkant: rechts van de diagonaal vanuit de hoek linksboven
      verschaffers: [sq.y + V.edge, c.y - V.pad, c.y, (y) => [rightOf(c.x, y - c.y, sq.x + (y - sq.y) + dd), edgeR]],
      // Onder in het vierkant: rechts van de diagonaal vanuit de hoek linksonder
      verzachters: [c.y + V.pad, sq.y + sq.s - V.edge, c.y, (y) => [rightOf(c.x, y - c.y, sq.x + (sq.y + sq.s - y) + dd), edgeR]],
      // De driehoek links, tussen de rand en beide diagonalen
      producten: [sq.y + V.edge, sq.y + sq.s - V.edge, c.y, (y) => [sq.x + V.edge, leftOf(c.x, y - c.y, sq.x + Math.min(y - sq.y, sq.y + sq.s - y) - dd)]],
      // De wig rechts, tussen de twee lijnen onder 45°
      taken: [ci.cy - r, ci.cy + r, ci.cy, (y) => [rightOf(ci.cx, y - ci.cy, ci.cx + Math.abs(y - ci.cy) + dd), ci.cx + half(y - ci.cy)]],
      // Boven de lijn naar links, tot de lijn schuin rechtsboven
      voordelen: [ci.cy - r, ci.cy - V.pad, ci.cy, (y) => [ci.cx - half(y - ci.cy), leftOf(ci.cx, y - ci.cy, Math.min(ci.cx - (y - ci.cy) - dd, ci.cx + half(y - ci.cy)))]],
      // Onder de lijn naar links, tot de lijn schuin rechtsonder
      pijnen: [ci.cy + V.pad, ci.cy + r, ci.cy, (y) => [ci.cx - half(y - ci.cy), leftOf(ci.cx, y - ci.cy, Math.min(ci.cx + (y - ci.cy) - dd, ci.cx + half(y - ci.cy)))]],
    };
    const [top, bottom, mid, at] = shapes[key];
    return { key, top, bottom, mid, at };
  }

  // Uitkomsten van zoneAt (zie volZones)
  const ZONE_MEMO = new Map();

  // Een gemeten proefwoord: onthouden maten gelden alleen zolang dit gelijk blijft (laadt
  // het lettertype pas later, dan telt de oude meting niet meer)
  function fontProbe(ctx) {
    setFont(ctx, 700, 20, 0);
    return ctx.measureText('Klanttaken 0123').width;
  }

  // Het plan van een business model canvas of toelichting onthouden: bij elke toets wordt het
  // hele deck opnieuw gepland, en deze twee zoeken hun korps in veel stappen. Dezelfde inhoud
  // en hetzelfde proefwoord geven hetzelfde plan; de melding dat iets niet past komt mee
  const PLAN_MEMO = new Map();
  function remembered(ctx, key, make) {
    const id = `${fontProbe(ctx)}|${key}`;
    let hit = PLAN_MEMO.get(id);
    if (!hit) {
      const was = flags.overflow;
      const from = over.length;
      flags.overflow = false;
      const plan = make();
      hit = { plan, overflow: flags.overflow, keys: over.slice(from) };
      flags.overflow = was || hit.overflow;
      if (PLAN_MEMO.size > 200) PLAN_MEMO.clear();
      PLAN_MEMO.set(id, hit);
    } else {
      if (hit.overflow) flags.overflow = true;
      over.push(...hit.keys);
    }
    return hit.plan;
  }

  // Een meet-context met geheugen: de stroken van de volle waardepropositie zetten
  // dezelfde woorden op veel breedtes. Dezelfde maten als ctx, maar elk woord één keer
  function measuring(ctx) {
    const memo = new Map();
    const m = {
      font: '',
      measureText(text) {
        const id = `${m.font}|${m.letterSpacing}|${text}`;
        let hit = memo.get(id);
        if (!hit) {
          ctx.font = m.font;
          if ('letterSpacing' in ctx) ctx.letterSpacing = m.letterSpacing;
          hit = { width: ctx.measureText(text).width };
          memo.set(id, hit);
        }
        return hit;
      },
    };
    if ('letterSpacing' in ctx) m.letterSpacing = '0px';
    m.real = ctx;
    return m;
  }

  /**
   * Eén vak van de volle waardepropositie op schaal k. Past alles in de box van het
   * voorstel, dan staat het daar in het midden, net als daar. Anders loopt de tekst door
   * het hele vak (reg, zie volRegion), van boven naar beneden in stroken, elk zo breed als
   * op die hoogte past. De stroken sluiten met de gewone ruimte tussen de punten op elkaar
   * aan, zodat de tekst gewoon doorloopt; een regel (de kop, een punt of een kopje) breekt
   * nooit halverwege. Zo rustig mogelijk:
   *   1. liefst elk groepje (de kop of een kopje met zijn punten) als één blok, links
   *      recht onder elkaar: dan springt hooguit een heel groepje in, zoals in de referentie;
   *   2. anders volgt elke strook de vorm aan beide kanten;
   *   en telkens eerst met zo min mogelijk stroken (een nieuwe strook moet een hele regel
   *   schelen), dan met elke strook die ook maar iets lager uitkomt.
   * Van alle beginhoogtes waarop het past, de middelste. mode: 'test' (alleen { fits,
   * broken }), 'final' of 'force' (past het niet, dan toch: de rest loopt onder het vak
   * door; de melding zegt het). Geeft { fits, broken, boxes }.
   */
  function zoneAt(ctx, it, box, reg, k, mode) {
    const [head, rest] = it;
    const whole = stackAt(ctx, it, box.w, k);
    const inBox = { fits: whole.height <= box.h, broken: isBroken(whole), boxes: [{ ...box, stack: whole, top: box.y + (box.h - whole.height) / 2 }] };
    // De uitleg van een leeg vak loopt niet door
    if ((inBox.fits && !inBox.broken) || rest.body == null) return inBox;

    const V = GEOM.vpc.vol;
    const EPS = 1e-6;
    // De regels van het vak zoals layoutBody ze zet (0 is de kop); hoogtes en ruimtes zoals stackAt
    const units = parseBody(rest.body);
    const n = units.length + 1;
    const sized = (x) => ({ ...x.st, size: Math.max(x.min || 20, Math.round(x.st.size * k)) });
    const headSt = sized(head);
    const st = sized(rest);
    const indent = st.size * 1.15;
    const headGap = Math.round((rest.gap || 0) * k);
    const itemGap = st.size * (st.itemGap != null ? st.itemGap : 0.5);
    const gapBefore = (j) => (j === 1 ? headGap : itemGap + units[j - 1].blank * st.size * 0.5);
    const cache = new Map();
    const block = (j, w) => {
      const id = j * 100000 + w;
      let b = cache.get(id);
      if (!b) {
        const u = units[j - 1];
        b = j === 0 ? layoutText(ctx, head.runs, w, headSt) : layoutText(ctx, runsFrom(u.text), w - (u.bullet ? indent : 0), st);
        cache.set(id, b);
      }
      return b;
    };
    const height = (a, b, w) => {
      let h = 0;
      for (let j = a; j < b; j++) h += (j > a ? gapBefore(j) : 0) + block(j, w).height;
      return h;
    };

    // De grenzen [links, rechts] over de strook [y1, y2]; span: null als hij smaller is dan minW
    const edges = (y1, y2) => {
      let L = -Infinity;
      let R = Infinity;
      for (const y of reg.mid > y1 && reg.mid < y2 ? [y1, y2, reg.mid] : [y1, y2]) {
        const [l, r] = reg.at(y);
        L = Math.max(L, l);
        R = Math.min(R, r);
      }
      return [L, R];
    };
    const span = (y1, y2) => {
      const e = edges(y1, y2);
      return e[1] - e[0] >= V.minW ? e : null;
    };
    // Waar de tekst kan beginnen en ophouden: de eerste en de laatste hoogte met een hele regel
    const one = block(0, 10000).height;
    let yTop = reg.top;
    while (yTop + one < reg.bottom && !span(yTop, yTop + one)) yTop += 2;
    let yEnd = reg.bottom;
    while (yEnd - one > yTop && !span(yEnd - one, yEnd)) yEnd -= 2;
    if (yEnd - one <= yTop) return inBox;
    // Onder yEnd gelden de grenzen van de laatste regel (alleen als het toch niet past)
    const edgesTo = (y1, y2) => edges(Math.min(y1, yEnd - one), Math.min(y2, yEnd));

    // Een strook vanaf y voor de regels a tot b: links op X, of op de eigen linkergrens als
    // X null is; de tekst op de breedte tot de rechtergrens, de strook zo hoog als de tekst
    // dan wordt (smaller maakt hem hoger, dus een paar keer). Geeft { x, w, h } of null
    const fit = (y, a, b, X) => {
      let [L, R] = edgesTo(y, y + one);
      let w = Math.floor(R - (X == null ? L : X));
      for (let t = 0; t < 8 && w >= V.minW; t++) {
        const h = height(a, b, w);
        [L, R] = edgesTo(y, y + h);
        const x = X == null ? L : X;
        if (R - x >= w) return { x, w, h };
        w = Math.floor(R - x);
      }
      return null;
    };
    // Een groepje (de regels a tot b) in stroken. align: als één blok, links allemaal op
    // dezelfde plek X (de krapste linkergrens over het hele blok: een smaller blok wordt
    // hoger, dus een paar keer) en rechts volgt elke strook de vorm; anders volgt elke
    // strook de vorm aan beide kanten. Een regel gaat mee in de strook erboven, tenzij een
    // nieuwe strook minstens gain px lager uitkomt
    const blockAt = (y0, a, b, gain, align) => {
      let X = align ? edgesTo(y0, y0 + one)[0] : null;
      for (let t = 0; t < 10; t++) {
        const bands = [];
        let y = y0;
        for (let u = a; u < b;) {
          let cur = fit(y, u, u + 1, X);
          if (!cur) return null;
          let v = u + 1;
          while (v < b) {
            const more = fit(y, u, v + 1, X);
            if (!more) break;
            const next = fit(y + cur.h + gapBefore(v), v, v + 1, X);
            if (next && cur.h + gapBefore(v) + next.h < more.h - gain) break;
            cur = more;
            v++;
          }
          bands.push({ a: u, b: v, y, x: cur.x, w: cur.w, h: cur.h });
          y += cur.h;
          if (v < b) y += gapBefore(v);
          u = v;
        }
        const left = X == null ? -Infinity : Math.max(...bands.map((bd) => edgesTo(bd.y, bd.y + bd.h)[0]));
        if (left <= X + EPS || X == null) return { bands, end: y };
        X = left;
      }
      return null;
    };
    // Groepjes: de kop met de regels tot het eerste kopje, dan elk kopje met zijn punten
    const groups = [];
    for (let j = 2, from = 0; j <= n; j++) {
      if (j === n || (!units[j - 1].bullet && ZONE_HEAD.test(units[j - 1].text))) {
        groups.push([from, j]);
        from = j;
      }
    }
    const flowFrom = (y0, [align, gain], force) => {
      const bands = [];
      let y = y0;
      for (const [a, b] of groups) {
        const blk = blockAt(y, a, b, gain, align);
        if (!blk) return null;
        bands.push(...blk.bands);
        y = blk.end;
        // Voorbij de onderkant: hoeft niet verder
        if (!force && y > yEnd + EPS) return null;
        if (b < n) y += gapBefore(b);
      }
      return { bands, end: y };
    };

    // Beginhoogtes: om de step px, tot waar de tekst op zijn breedst nog net zou passen
    let wMax = 0;
    for (let y = yTop; y <= yEnd - one; y += V.step) {
      const e = edges(y, y + one);
      wMax = Math.max(wMax, e[1] - e[0]);
    }
    const hMin = height(0, n, Math.floor(wMax));
    const starts = [];
    for (let y = yTop; y <= yEnd - hMin + EPS; y += V.step) starts.push(y);

    const brokenIn = (f) => f.bands.some((bd) => {
      for (let j = bd.a; j < bd.b; j++) if (block(j, bd.w).broken) return true;
      return false;
    });
    // Zo rustig mogelijk (zie boven); van alle beginhoogtes waarop het past de middelste
    const lineH = st.size * st.lh;
    let flow = null;
    let spare = null;   // past wel, maar met een op tekens afgebroken woord
    for (const how of [[true, lineH], [true, 0.5], [false, lineH], [false, 0.5]]) {
      let best = -Infinity;
      for (const y0 of starts) {
        const f = flowFrom(y0, how, false);
        if (!f) continue;
        if (brokenIn(f)) {
          spare = spare || f;
          continue;
        }
        const room = Math.min(y0 - yTop, yEnd - f.end);
        if (room > best) {
          best = room;
          flow = f;
        }
        if (mode === 'test') break;
      }
      if (flow) break;
    }
    flow = flow || spare;
    const fits = !!flow;
    if (!fits) {
      // Past alleen in de box met een afgebroken woord: dan liever zo
      if (inBox.fits || mode !== 'force') return inBox;
      flow = flowFrom(yTop, [false, 0.5], true);
      if (!flow) return inBox;
    }
    const broken = brokenIn(flow);
    if (fits && broken && inBox.fits) return inBox;
    if (mode === 'test') return { fits, broken };

    // Per strook een stapel: de kop (alleen in de eerste) en zijn regels, met de lege regels ertussen
    const lineOf = (u, i) => `${i && u.blank ? '\n'.repeat(u.blank) : ''}${u.bullet ? '- ' : ''}${u.text}`;
    const boxes = flow.bands.map((bd) => {
      const list = bd.a === 0 ? [head] : [];
      const from = Math.max(bd.a, 1);
      if (bd.b > from) list.push({ ...rest, body: units.slice(from - 1, bd.b - 1).map(lineOf).join('\n') });
      const stack = stackAt(ctx, list, bd.w, k);
      return { key: box.key, x: bd.x, y: bd.y, w: bd.w, h: stack.height, stack, top: bd.y };
    });
    return { fits, broken, boxes };
  }

  /**
   * Business model canvas: vijf kolommen met zeven blokken (zie GEOM.bmc), alle blokken
   * op dezelfde schaal. Plan-extra's (ook voor pptx.js): panels [{ x, y, w, h }] × 6
   * (kolom 1, 2, 3, 4 boven, 4 onder, 5), rules [{ x, y, w, h }] (de lijn tussen Key
   * Partners en Key Resources) en blocks [{ key, x, w, y, h, top, stack }] in de volgorde
   * van BMC_KEYS: x en w de tekstkolom, y en h het klikvlak, top de bovenkant van de tekst.
   */
  function planBmc(ctx, fr, s) {
    const G = GEOM.bmc;
    const gridTop = Math.round(fr.labelTop + fr.labelSize * CAP + G.top);
    const gridBottom = Math.round(fr.logo.y - G.bottom);
    const Hg = gridBottom - gridTop;
    const colW = (fr.contentW - 4 * G.gap) / 5;
    const colX = (i) => fr.m + i * (colW + G.gap);
    const textW = colW - 2 * G.pad;
    const chrome = G.bar + G.padTop + G.padBottom;   // ruimte in een paneel naast de tekst
    const room4 = Hg - G.gap;                         // kolom 4: beide panelen samen
    const items = STACK.bmc(s);
    const at = (key) => BMC_KEYS.indexOf(key);
    // Past het ook op de kleinste schaal niet: welke blokken te lang zijn, het meest te lange
    // eerst (de melding brengt je daarheen). Key Partners en Key Resources delen kolom 1: het
    // langste van de twee
    const tooLong = ({ k, stacks, h3 }) => {
      const h = (key) => stacks[at(key)].height;
      const rule = Math.round(G.ruleAbove * k) + G.ruleW + Math.round(G.ruleBelow * k);
      return [
        [h('partners') >= h('resources') ? 'partners' : 'resources', h('partners') + rule + h('resources') - (Hg - chrome)],
        ...['activiteiten', 'proposities', 'segmenten'].map((key) => [key, h(key) - (Hg - chrome)]),
        ['relaties', h('relaties') + chrome - h3],
        ['kanalen', h('kanalen') + chrome - (room4 - h3)],
      ].filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]).map(([key]) => key);
    };

    let chosen = null;
    let fallback = null;
    let last = null;
    for (const k of scales(0.6)) {
      const stacks = items.map((it) => stackAt(ctx, it, textW, k));
      const h = (key) => stacks[at(key)].height;
      const rule = Math.round(G.ruleAbove * k) + G.ruleW + Math.round(G.ruleBelow * k);
      // Kolom 4 naar inhoud: elk paneel een deel dat past bij wat erin staat
      const need3 = h('relaties') + chrome;
      const need4 = h('kanalen') + chrome;
      const h3 = Math.round(room4 * Math.min(G.splitMax, Math.max(G.splitMin, need3 / (need3 + need4))));
      const fits = h('partners') + rule + h('resources') <= Hg - chrome
        && ['activiteiten', 'proposities', 'segmenten'].every((key) => h(key) <= Hg - chrome)
        && need3 <= h3 && need4 <= room4 - h3;
      last = { k, stacks, h3 };
      if (fits && !stacks.some(isBroken)) {
        chosen = last;
        break;
      }
      if (fits && !fallback) fallback = last;
    }
    const { k, stacks, h3 } = chosen || fallback || last;
    if (!chosen && !fallback) {
      flags.overflow = true;
      // Eerst het canvas (de melding), dan de blokken die niet passen (net als de klikvlakken)
      over.push('bmc', ...tooLong(last).map((key) => `bmc:${key}`));
    }

    const panels = [
      { x: colX(0), y: gridTop, w: colW, h: Hg },
      { x: colX(1), y: gridTop, w: colW, h: Hg },
      { x: colX(2), y: gridTop, w: colW, h: Hg },
      { x: colX(3), y: gridTop, w: colW, h: h3 },
      { x: colX(3), y: gridTop + h3 + G.gap, w: colW, h: room4 - h3 },
      { x: colX(4), y: gridTop, w: colW, h: Hg },
    ];
    const PANEL = { partners: 0, resources: 0, activiteiten: 1, proposities: 2, relaties: 3, kanalen: 4, segmenten: 5 };
    // Key Resources staat direct onder Key Partners, na een lijn over de tekstbreedte
    const P0 = panels[0];
    const partnersTop = P0.y + G.bar + G.padTop;
    const ruleY = partnersTop + stacks[at('partners')].height + Math.round(G.ruleAbove * k);
    const rules = [{ x: P0.x + G.pad, y: ruleY, w: textW, h: G.ruleW }];
    const blocks = BMC_KEYS.map((key, i) => {
      const P = panels[PANEL[key]];
      const x = P.x + G.pad;
      if (key === 'partners') return { key, x, w: textW, y: P.y, h: ruleY - P.y, top: partnersTop, stack: stacks[i] };
      if (key === 'resources') return { key, x, w: textW, y: ruleY, h: P.y + P.h - ruleY, top: ruleY + G.ruleW + Math.round(G.ruleBelow * k), stack: stacks[i] };
      return { key, x, w: textW, y: P.y, h: P.h, top: P.y + G.bar + G.padTop, stack: stacks[i] };
    });
    return {
      layout: 'bmc', stack: { blocks: [], height: 0 }, x: fr.m, top: gridTop, maxW: fr.contentW, maxH: 0, center: false,
      panels, rules, blocks,
    };
  }

  /**
   * Lopende tekst over twee kolommen (Toelichting): eerst de linker vol, dan de rechter.
   * items [{ n: regels, h, gapBefore }] in volgorde; heads[i]: item i is een kopje.
   *   1. bovenaan een kolom geen ruimte ervoor;
   *   2. een item dat past, komt er heel in;
   *   3. links breekt een item op een regel als er links én rechts minstens twee regels
   *      komen, anders gaat het heel naar rechts; een item hoger dan een hele kolom
   *      breekt altijd waar de kolom vol is;
   *   4. een kopje onderaan links gaat mee naar rechts als zijn tekst daar begint;
   *   5. past het rechts niet, dan is fits false (de rest staat dan toch rechts).
   * Geeft { fits, columns: [[{ item, from, to, y }], [...]] }: per stuk de regels
   * from tot to van dat item, y de bovenkant (kap-hoogte) in de kolom.
   */
  function flowColumns(items, { colH, size, lineH, heads = [] }) {
    const EPS = 1e-6;
    const hOf = (n) => (n > 0 ? size * CAP + (n - 1) * lineH + size * K_DESC : 0);
    // Hoeveel regels er in `space` px passen
    const linesIn = (space) => (space + EPS < hOf(1) ? 0 : Math.floor((space - hOf(1)) / lineH + EPS) + 1);
    const columns = [[], []];
    let c = 0;
    let y = 0;
    let fits = true;
    const put = (item, from, to, at) => {
      columns[c].push({ item, from, to, y: at });
      y = at + hOf(to - from);
      if (y > colH + EPS) fits = false;
    };
    const toRight = (keepHead) => {
      c = 1;
      y = 0;
      const left = columns[0];
      const lastPiece = left[left.length - 1];
      if (keepHead && left.length > 1 && heads[lastPiece.item] && lastPiece.from === 0) {
        left.pop();
        put(lastPiece.item, lastPiece.from, lastPiece.to, 0);
      }
    };
    items.forEach((it, i) => {
      const gap = () => (columns[c].length ? it.gapBefore : 0);
      if (y + gap() + it.h <= colH + EPS || c === 1) {
        put(i, 0, it.n, y + gap());
        return;
      }
      const m = linesIn(colH - y - gap());
      if (it.h > colH + EPS ? m >= 1 : m >= 2 && it.n - m >= 2) {
        put(i, 0, m, y + gap());
        toRight(false);
        put(i, m, it.n, 0);
        return;
      }
      toRight(true);
      put(i, 0, it.n, y + gap());
    });
    return { fits, columns };
  }

  /**
   * Toelichting: titel over de volle breedte, de tekst (zoals bij Tekst: alinea's,
   * **vet**, punten) loopt over twee kolommen; alles krimpt samen tot het past.
   * Plan-extra's (ook voor pptx.js): bottom, body { st, lineH, indent } en
   * columns [{ x, top, w, pieces: [{ bullet, mark, y, h, lines }] }]: per stuk de
   * regels (van layoutText) die in die kolom staan; mark: hier begint een punt (zeshoekje).
   */
  function planToelichting(ctx, fr, s, deck, area) {
    const G = GEOM.toelichting;
    const bottom = Math.round(fr.logo.y - G.bottom);
    const colW = (fr.contentW - G.colGap) / 2;
    const src = parseBody(s.body);
    const heads = src.map((l) => !l.bullet && /^\*\*[^*]+\*\*[:.]?$/.test(l.text.trim()));
    const title = STACK.toelichting(s, deck);

    let chosen = null;
    let fallback = null;
    let last = null;
    for (const k of scales(0.5)) {
      const head = stackAt(ctx, title, fr.contentW, k);
      const bodyTop = fr.contentTop + head.height + (head.height ? Math.round(G.titleGap * k) : 0);
      const st = { ...PARA(Math.max(G.textMin, Math.round(G.text * k))), lh: G.lh };
      const body = layoutBody(ctx, s.body, colW, st);
      const list = body.items.map((it, i) => ({
        n: it.block.lines.length,
        h: it.block.height,
        gapBefore: i ? it.y - (body.items[i - 1].y + body.items[i - 1].block.height) : 0,
      }));
      const flow = flowColumns(list, { colH: bottom - bodyTop, size: st.size, lineH: st.size * st.lh, heads });
      const broken = isBroken(head) || body.items.some((it) => it.block.broken);
      last = { head, bodyTop, st, body, flow };
      if (flow.fits && !broken) {
        chosen = last;
        break;
      }
      if (flow.fits && !fallback) fallback = last;
    }
    const { head, bodyTop, st, body, flow } = chosen || fallback || last;
    if (!chosen && !fallback) {
      flags.overflow = true;
      // Een titel die zelf al bijna de helft van de slide vult, is de oorzaak
      if (head.height > area * 0.45) over.push('title');
      over.push('body');
    }
    const lineH = st.size * st.lh;
    const columns = flow.columns.map((col, c) => ({
      x: fr.m + c * (colW + G.colGap),
      top: bodyTop,
      w: colW,
      pieces: col.filter((pc) => pc.to > pc.from).map((pc) => {
        const it = body.items[pc.item];
        const n = pc.to - pc.from;
        return {
          bullet: it.bullet, mark: it.bullet && pc.from === 0, y: pc.y,
          h: st.size * CAP + (n - 1) * lineH + st.size * K_DESC, lines: it.block.lines.slice(pc.from, pc.to),
        };
      }),
    }));
    return {
      layout: 'toelichting', stack: head, x: fr.m, top: fr.contentTop, maxW: fr.contentW, maxH: head.height + 30, center: false, bottom,
      body: { st, lineH, indent: st.size * 1.15 },
      columns,
    };
  }

  /* ---------------------------------------------------------------------------
     Zeshoek met foto rechts, of een zeshoekcompositie als er geen foto is
     ------------------------------------------------------------------------- */

  function heroVisual(ctx, env) {
    if (env.photo && env.fit === 'logo') {
      // Klantlogo: in zijn geheel op een eigen witte zeshoek die helemaal in beeld
      // staat (merkregel: wit vlak zonder rand), met het zeshoek-duo erachter. Niet te verschuiven
      const L = GEOM.heroLogo;
      region('photo', L.cx - (L.r * SQRT3) / 2, L.cy - L.r, L.r * SQRT3, L.r * 2);
      hexEcho(ctx, L.cx, L.cy, L.r, L.echo);
      hexPath(ctx, L.cx, L.cy, L.r);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      drawContain(ctx, env.photo, L.box.x, L.box.y, L.box.w, L.box.h);
      return null;
    }
    const { r, cx, cy, echo } = GEOM.hero;
    region('photo', cx - (r * SQRT3) / 2, cy - r, Math.min(r * SQRT3, W - (cx - (r * SQRT3) / 2)), r * 2);
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
    labelRegion(ctx, fr, s.label, p.labelW);
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
    labelRegion(ctx, fr, s.label);
    drawStack(ctx, p.stack, p.x, p.top);
    return {};
  }

  function bullets(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    labelRegion(ctx, fr, s.label);
    drawStack(ctx, p.stack, p.x, p.top);
    return {};
  }

  function split(ctx, fr, s, env, deck, p) {
    const half = W / 2;
    const photo = drawPhoto(ctx, env.photo, { ...p.photoBox, hintSize: 40 }, env.crop);
    region('photo', p.photoBox.x, p.photoBox.y, p.photoBox.w, p.photoBox.h);
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
    labelRegion(ctx, p.textFrame, s.label, p.maxW);
    drawStack(ctx, p.stack, p.x, p.top);
    return { photo, footerFrame: p.textFrame };
  }

  function quote(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    labelRegion(ctx, fr, s.label);

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
      region('value', fr.m, p.value.baseline - p.value.size * CAP, ctx.measureText(p.value.text).width, p.value.size * CAP);
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
    labelRegion(ctx, fr, s.label);
    drawStack(ctx, p.stack, p.x, p.top);
    drawTable(ctx, p.table);
    if (p.note) drawStack(ctx, p.note.stack, p.x, p.note.top);
    return {};
  }

  const closing = title;
  const tekst = bullets;

  function kolommen(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    labelRegion(ctx, fr, s.label);
    drawStack(ctx, p.stack, p.x, p.top);
    // Kop per kolom zoals het label, maar helemaal cyaan
    const pal = { bullet: COLORS.cyan, label: COLORS.cyan };
    for (const c of p.columns) {
      drawLabel(ctx, { m: c.x, labelTop: c.headTop, labelSize: c.headSize }, c.head, pal, c.w);
      drawStack(ctx, c.stack, c.x, c.top, false);
      region('body', c.x, c.headTop, c.w, c.top - c.headTop + c.stack.height);
    }
    return {};
  }

  function vragen(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    labelRegion(ctx, fr, s.label);
    drawStack(ctx, p.stack, p.x, p.top);
    for (const it of p.items) {
      // Nummer in een cyaan zeshoek, gecentreerd zoals bij de sectie
      const { cx, cy, r } = it.hex;
      hexPath(ctx, cx, cy, r);
      ctx.fillStyle = COLORS.cyan;
      ctx.fill();
      const num = String(it.n);
      setFont(ctx, 800, it.numberSize, 0);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(num, cx - ctx.measureText(num).width / 2, cy + (it.numberSize * CAP) / 2);
      drawStack(ctx, it.stack, it.x, it.top, false);
      region('body', it.row.x, it.row.y, it.row.w, it.row.h);
    }
    if (p.outro) {
      drawStack(ctx, p.outro.stack, p.x, p.outro.top, false);
      region('body', p.x, p.outro.top, p.maxW, p.outro.stack.height);
    }
    return {};
  }

  // Een driehoekige pijlpunt met de punt op (x, y), naar links (dir -1) of rechts (dir 1)
  function arrowHead(ctx, x, y, dir, size) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dir * size * 1.2, y - size * 0.7);
    ctx.lineTo(x - dir * size * 1.2, y + size * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  function vpc(ctx, fr, s, env, deck, p) {
    const G = GEOM.vpc;
    const { square: sq, circle: ci } = p;
    drawLabel(ctx, fr, s.label, LABEL_PAL, p.labelW);
    labelRegion(ctx, fr, s.label, p.labelW);

    if (p.segment) {
      let x = p.segment.right - p.segment.w;
      const x0 = x;
      for (const run of p.segment.runs) {
        setFont(ctx, run.weight, run.size, 0);
        ctx.fillStyle = run.color;
        ctx.fillText(run.text, x, p.segment.baseline);
        x += ctx.measureText(run.text).width;
      }
      const size = p.segment.runs[0].size;
      for (const h of p.segment.hits) region(`vpc:${h.key}`, x0 + h.dx, p.segment.baseline - size * CAP, h.w, size * CAP);
    }

    setFont(ctx, 700, G.captionSize, 0.12);
    ctx.fillStyle = SOFT;
    for (const c of p.captions) ctx.fillText(c.text, c.x, c.baseline);

    // Binnenlijnen eerst, dan de randen eroverheen
    ctx.strokeStyle = G.innerStroke;
    ctx.lineWidth = G.inner;
    ctx.beginPath();
    for (const l of p.inner) {
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = G.outline;
    ctx.strokeRect(sq.x, sq.y, sq.s, sq.s);
    ctx.beginPath();
    ctx.arc(ci.cx, ci.cy, ci.r, 0, Math.PI * 2);
    ctx.stroke();

    // De "fit": vanuit beide vormen een pijl naar het midden, de punten raken elkaar (►◄)
    const A = p.arrow;
    const head = G.arrow.head;
    ctx.lineWidth = G.arrow.lw;
    ctx.beginPath();
    ctx.moveTo(A.x1, A.y);
    ctx.lineTo(A.mid - head, A.y);
    ctx.moveTo(A.x2, A.y);
    ctx.lineTo(A.mid + head, A.y);
    ctx.stroke();
    ctx.fillStyle = COLORS.cyan;
    arrowHead(ctx, A.mid, A.y, 1, head);
    arrowHead(ctx, A.mid, A.y, -1, head);

    // Cyaan zeshoek in het midden van beide vormen, zonder rand
    for (const [cx, cy] of [[sq.x + sq.s / 2, sq.y + sq.s / 2], [ci.cx, ci.cy]]) {
      hexPath(ctx, cx, cy, G.hubR);
      ctx.fill();
    }

    for (const z of p.zones) {
      drawStack(ctx, z.stack, z.x, z.top, false);
      region(`vpc:${z.key}`, z.x, z.y, z.w, z.h);
    }
    return {};
  }

  // Panelen (vlak, dan de cyaan balk), de lijn in kolom 1, dan de tekst per blok
  function bmc(ctx, fr, s, env, deck, p) {
    const G = GEOM.bmc;
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    labelRegion(ctx, fr, s.label);
    for (const P of p.panels) {
      ctx.fillStyle = G.fill;
      ctx.fillRect(P.x, P.y, P.w, P.h);
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(P.x, P.y, P.w, G.bar);
    }
    ctx.fillStyle = G.ruleColor;
    for (const r of p.rules) ctx.fillRect(r.x, r.y, r.w, r.h);
    for (const b of p.blocks) drawStack(ctx, b.stack, b.x, b.top, false);
    // Klikvlak: het hele paneel (in kolom 1 boven of onder de lijn)
    for (const b of p.blocks) region(`bmc:${b.key}`, b.x - G.pad, b.y, b.w + 2 * G.pad, b.h);
    return {};
  }

  // Titel, dan per kolom de stukken tekst (een punt met zijn zeshoekje, zoals drawBody)
  function toelichting(ctx, fr, s, env, deck, p) {
    drawLabel(ctx, fr, s.label, LABEL_PAL);
    labelRegion(ctx, fr, s.label);
    drawStack(ctx, p.stack, p.x, p.top);
    const { st, lineH, indent } = p.body;
    const cap = st.size * CAP;
    let bottom = 0;
    for (const col of p.columns) {
      for (const pc of col.pieces) {
        const top = col.top + pc.y;
        if (pc.mark) {
          hexPath(ctx, col.x + st.size * 0.3, top + cap / 2, st.size * 0.22);
          ctx.fillStyle = COLORS.cyan;
          ctx.fill();
        }
        drawText(ctx, { lines: pc.lines, st, lineH, maxW: col.w }, col.x + (pc.bullet ? indent : 0), top, BODY);
        bottom = Math.max(bottom, pc.y + pc.h);
      }
    }
    region('body', fr.m, p.columns[0].top, fr.contentW, Math.max(bottom, st.size));
    return {};
  }

  const RENDER = { title, section, bullets, split, quote, table, closing, tekst, kolommen, vragen, vpc, bmc, toelichting };

  /* ---------------------------------------------------------------------------
     Publieke functie
     ------------------------------------------------------------------------- */

  // Slidenummer rechts in de voetregel, bijv. "03 / 12"
  const numberText = (deck, index) => `${String(index + 1).padStart(2, '0')} / ${String(deck.slides.length).padStart(2, '0')}`;

  // Emerce 100-badge: 44 px hoog, verhouding van e100-2026-liggend-wit.svg
  const BADGE = { h: 44, ratio: 353.3 / 130.6, gap: 36 };
  let measureCtx = null;  // alleen als badgeBox zonder ctx wordt aangeroepen

  /**
   * Plek van de Emerce 100-badge op slide `index` (ontwerp-px), of null als hij
   * uit staat. In de voetregel, verticaal op het midden van de voettekst; de
   * rechterrand 36 px links van het slidenummer, of 44 px van het logo als de
   * nummers uit staan. Het nummer wordt gemeten, dus `ctx` is nodig (pptx.js
   * gebruikt dezelfde functie, zodat de badge daar op exact dezelfde plek staat).
   */
  function badgeBox(ctx, fr, deck, index) {
    if (!deck || !deck.badge) return null;
    const f = fr || frame();
    let right = f.logo.x - 44;
    if (deck.showNumbers !== false && Array.isArray(deck.slides)) {
      const c = ctx || (measureCtx = measureCtx || global.document.createElement('canvas').getContext('2d'));
      setFont(c, 700, GRID.footerSize, 0.04);
      right -= c.measureText(numberText(deck, index)).width + BADGE.gap;
    }
    const w = BADGE.h * BADGE.ratio;
    return { x: right - w, y: f.footerY - BADGE.h / 2, w, h: BADGE.h };
  }

  /**
   * Tekent slide `index` van `deck` op `canvas`.
   *   deck:  { slides: [...], dot, showNumbers, badge } — badge: Emerce 100-badge op elke slide
   *   env:   { logo, badge, photo, crop, sectionNumber, fit } — badge: het witte keurmerk (beeld);
   *          fit 'logo': foto als logo op een witte zeshoek
   *   opts:  { scale } — 1 = 1920 × 1080
   * Geeft { photo, overflow, overflowKeys, regions, width, height }.
   */
  function renderSlide(canvas, deck, index, env, opts = {}) {
    const fr = frame();
    const ctx = prepare(canvas, W, H, opts.scale || 1);
    const slide = deck.slides[index] || {};
    regions = [];
    const p = plan(ctx, fr, slide, env || {}, deck);
    const overflowKeys = over.slice();

    paintBackground(ctx, fr);
    ctx.save();
    const info = RENDER[p.layout](ctx, fr, slide, env || {}, deck, p) || {};
    ctx.restore();

    // Voetregel en slidenummer, de badge, dan het logo en de cyaan balk
    drawDomain(ctx, info.footerFrame || fr, '#ffffff');
    if (deck.showNumbers !== false) {
      const label = numberText(deck, index);
      setFont(ctx, 700, GRID.footerSize, 0.04);
      ctx.fillStyle = SOFT;
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, fr.logo.x - 44 - tw, fr.footerY + (GRID.footerSize * CAP) / 2);
    }
    // Uit (of het beeld nog niet geladen): niets extra's, dezelfde pixels als zonder badge
    if (deck.badge && env && env.badge) drawBadge(ctx, { badge: badgeBox(ctx, fr, deck, index) }, env.badge);
    drawLogo(ctx, fr, env && env.logo);
    finish(ctx, W, GRID.bar);
    return { photo: info.photo || null, overflow: flags.overflow, overflowKeys, regions: regions.slice(), width: W, height: H };
  }

  global.PMSlides = {
    renderSlide, plan, frame, badgeBox, titleSize, flowColumns, zoneLines, LAYOUTS, GRID, GEOM, W, H,
    defaultTable, normalizeTable, TABLE_LIMITS, TABLE_STYLE,
    palettes: { TEXT, BODY, SOFT, META, LABEL_PAL },
  };
})(window);
