/* =============================================================================
   document/docx.js — het document als bewerkbaar Word-bestand (.docx)
   -----------------------------------------------------------------------------
   Bouwt het briefpapier van de Document Maker na met echte Word-opmaak, met
   de bibliotheek docx (pas geladen bij de eerste export):

     kop       logo en afzender op de eerste pagina, klein logo met de titel
               op vervolgpagina's; de cyaan balk en het zeshoekpatroon als
               zwevende afbeeldingen achter de tekst
     tekst     alinea's, koppen, opsommingen met cyaan zeshoek, genummerde
               lijsten, citaten, vet, cursief en (cyaan) onderstreept
     offerte   de tabel, de totalen en het blok "voor akkoord" als Word-tabellen
     voet      bedrijfsgegevens en "pagina X van Y" als echte velden
     letters   Open Sans wordt ingesloten, zodat het document ook goed oogt op
               een computer zonder dat lettertype

   Maten komen uit css/document.css (px op 794 px paginabreedte): 1 px = 15 twips
   = 0,75 pt. Regelafstanden zijn omgerekend naar Words "meervoud", zodat ze
   met Open Sans dezelfde regelhoogte geven als in de preview.

   Het model komt uit js/document/app.js (docxModel): alle teksten al
   opgemaakt (datums, bedragen), de tekst als opgeschoonde HTML.
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;

  const PAGE_W = 794;        // A4 op 96 dpi
  const CONTENT_W = 650;     // 794 - 2 × 72
  const LINE = 1.362;        // regelhoogte van Open Sans bij "enkel" (em)

  const INK = '303030';
  const MUTED = '5C6670';
  const CYAN = '1AB9E2';
  const BLUE = '1B71A8';
  const TINT = 'E8F7FC';
  const ZEBRA = 'F7FAFC';
  const LINE_C = 'E1E7EC';
  const BORDER_C = 'D5DEE5';

  const tw = (px) => Math.round(px * 15);              // px -> twips
  const hp = (px) => Math.round(px * 1.5);             // px -> halve punten
  const emu = (px) => Math.round(px * 9525);           // px -> EMU
  const lineOf = (lh) => Math.round((lh / LINE) * 240); // CSS line-height -> Word "meervoud" (240 = enkel)

  /* ---------------------------------------------------------------------------
     Hulpjes
     ------------------------------------------------------------------------- */

  const meter = document.createElement('canvas').getContext('2d');
  function textWidth(text, px, weight = 400, spacing = 0) {
    meter.font = `${weight} ${px}px "PM Open Sans", "Open Sans", Arial, sans-serif`;
    if ('letterSpacing' in meter) meter.letterSpacing = `${(px * spacing).toFixed(2)}px`;
    return meter.measureText(text).width;
  }

  const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
  const svgBytes = (svg) => new TextEncoder().encode(svg);

  // SVG als PNG (voor Word-versies en Google Docs die geen SVG tonen)
  async function svgToPng(svg, w, h, scale = 3) {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return bytesOf(await PM.canvasToBlob(c, 'image/png'));
  }

  async function imageToPng(url, maxSide = 1600) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let blob;
    try {
      blob = await PM.canvasToBlob(c, 'image/png');
    } catch (err) {
      throw err.name === 'SecurityError' ? PM.fileProtocolError() : err;
    }
    return { data: await bytesOf(blob), width: img.naturalWidth, height: img.naturalHeight };
  }

  function pngRect(color) {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8, 8);
    return PM.canvasToBlob(c, 'image/png').then(bytesOf);
  }

  /* ---------------------------------------------------------------------------
     Opbouw
     ------------------------------------------------------------------------- */

  async function build(model) {
    const D = await PM.libs.docx();
    const {
      Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, Table, TableRow, TableCell,
      WidthType, BorderStyle, AlignmentType, VerticalAlign, ShadingType, LevelFormat, PageNumber,
      UnderlineType, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
      TableLayoutType, HeightRule, LineRuleType,
    } = D;

    /* --- tekst --- */

    // o: { size (px), weight, italic, underline, color, caps, spacing (em), break }
    function run(text, o = {}) {
      const w = o.weight || 400;
      const font = w >= 800 ? 'Open Sans ExtraBold' : w >= 600 && w < 700 ? 'Open Sans SemiBold' : 'Open Sans';
      const size = o.size || 13.5;
      return new TextRun({
        text,
        font,
        bold: w >= 700 && w < 800,
        italics: !!o.italic,
        size: hp(size),
        color: o.color || INK,
        allCaps: !!o.caps,
        characterSpacing: o.spacing ? Math.round(o.spacing * size * 0.75 * 20) : undefined,
        underline: o.underline ? { type: UnderlineType.THICK, color: CYAN } : undefined,
        break: o.break,
      });
    }

    // Kleine label boven een titel of adres: 9,5/10,5 px, kapitalen, gespatieerd
    const smallCaps = (text, o = {}) => run(text, { size: 9.5, weight: 700, caps: true, spacing: 0.12, color: MUTED, ...o });

    function para(children, o = {}) {
      return new Paragraph({
        children,
        alignment: o.align,
        keepNext: o.keepNext,
        keepLines: o.keepLines,
        indent: o.indent,
        border: o.border,
        numbering: o.numbering,
        spacing: { before: tw(o.before || 0), after: tw(o.after || 0), line: lineOf(o.lh || 1.65), lineRule: LineRuleType.AUTO },
      });
    }

    // Onzichtbaar regeltje na een tabel aan het eind van kop of voet (Word wil daar een alinea)
    const tinyPara = () => new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT } });

    /* --- tabellen --- */

    const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
    const line = (px, color) => ({ style: BorderStyle.SINGLE, size: Math.max(2, Math.round(px * 6)), color });

    // o: { width, pt, pb, pl, pr (px), bt, bb, bl, br (randen), fill, valign, span, vmerge }
    function cell(children, o = {}) {
      return new TableCell({
        children: children.length ? children : [tinyPara()],
        width: o.width != null ? { size: tw(o.width), type: WidthType.DXA } : undefined,
        margins: { top: tw(o.pt || 0), bottom: tw(o.pb || 0), left: tw(o.pl || 0), right: tw(o.pr || 0) },
        borders: { top: o.bt || NONE, bottom: o.bb || NONE, left: o.bl || NONE, right: o.br || NONE },
        shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
        verticalAlign: o.valign,
        columnSpan: o.span,
        verticalMerge: o.vmerge,
      });
    }

    function table(rows, widths, o = {}) {
      return new Table({
        rows,
        width: { size: tw(widths.reduce((a, b) => a + b, 0)), type: WidthType.DXA },
        columnWidths: widths.map(tw),
        layout: TableLayoutType.FIXED,
        borders: NO_BORDERS,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },  // geen standaard celmarges van Word
        alignment: o.align,
        indent: o.indent != null ? { size: tw(o.indent), type: WidthType.DXA } : undefined,
      });
    }

    const row = (cells, o = {}) => new TableRow({ children: cells, height: o.height ? { value: tw(o.height), rule: HeightRule.EXACT } : undefined, cantSplit: o.cantSplit });

    /* --- afbeeldingen --- */

    const logoH = 64;
    const logoW = Math.round(logoH * 2229.16 / 2568.97 * 100) / 100;
    const logoSvg = svgBytes(model.logo);
    const logoPng = await svgToPng(model.logo, logoW, logoH, 4);
    const hexSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 86.6 100"><path d="${model.hexPath}" fill="#${CYAN}"/></svg>`;
    const hexPng = await svgToPng(hexSvg, 11, 12.7, 8);
    const patternPng = await svgToPng(model.pattern, 360, 240, 2);
    const barPng = await pngRect(`#${CYAN}`);

    const svgImage = (svg, png, width, height, extra = {}) => new ImageRun({ type: 'svg', data: svgBytes(svg), fallback: { type: 'png', data: png }, transformation: { width, height }, ...extra });
    const logoImage = (h) => new ImageRun({ type: 'svg', data: logoSvg, fallback: { type: 'png', data: logoPng }, transformation: { width: Math.round(h * 2229.16 / 2568.97 * 100) / 100, height: h } });
    const hexImage = (w = 11, h = 12.7) => svgImage(hexSvg, hexPng, w, h);

    const floating = (x, y, zIndex = 0) => ({
      floating: {
        horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: emu(x) },
        verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: emu(y) },
        behindDocument: true, allowOverlap: true, lockAnchor: true, layoutInCell: false, zIndex,
        wrap: { type: TextWrappingType.NONE },
      },
    });
    // Cyaan balk over de hele breedte bovenaan, en het patroon rechtsboven (alleen eerste pagina)
    const barImage = () => new ImageRun({ type: 'png', data: barPng, transformation: { width: PAGE_W, height: 8 }, ...floating(0, 0, 1) });
    const patternImage = () => new ImageRun({ type: 'svg', data: svgBytes(model.pattern), fallback: { type: 'png', data: patternPng }, transformation: { width: 360, height: 240 }, ...floating(PAGE_W - 360, 0, 0) });

    /* --- kop en voet --- */

    const s = model.sender;
    const has = (v) => String(v || '').trim();

    function senderParas() {
      const rows = [s.street, s.city, s.phone && `T ${s.phone}`, s.email, s.web].filter(has);
      const children = [];
      if (has(s.company)) children.push(run(s.company.trim(), { size: 11, weight: 700 }));
      rows.forEach((r, i) => children.push(run(r, { size: 10.5, color: MUTED, break: i || has(s.company) ? 1 : undefined })));
      return [para(children, { align: AlignmentType.RIGHT, lh: 1.6 })];
    }

    // Zwevende afbeeldingen (balk, patroon) horen in een gewone alinea: in een
    // tabelcel zou Word ze ten opzichte van die cel plaatsen
    const anchors = (images) => new Paragraph({ children: images, spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT } });

    // Eerste pagina: logo links, afzender rechts; de kop is precies zo hoog dat de tekst op 168 px begint
    function firstHeader() {
      const t = table([row([
        cell([para([logoImage(logoH)], { lh: 1 })], { width: CONTENT_W / 2, valign: VerticalAlign.TOP }),
        cell(senderParas(), { width: CONTENT_W / 2, valign: VerticalAlign.TOP }),
      ], { height: 117 })], [CONTENT_W / 2, CONTENT_W / 2]);
      return new Header({ children: [anchors([barImage(), patternImage()]), t, tinyPara()] });
    }

    // Vervolgpagina's: klein logo en de titel van het document
    function nextHeader() {
      const t = table([row([
        cell([para([logoImage(40)], { lh: 1 })], { width: CONTENT_W * 0.4, valign: VerticalAlign.CENTER }),
        cell([para([run(model.running, { size: 10.5, weight: 600, color: MUTED })], { align: AlignmentType.RIGHT, lh: 1.6 })], { width: CONTENT_W * 0.6, valign: VerticalAlign.CENTER }),
      ], { height: 40 })], [CONTENT_W * 0.4, CONTENT_W * 0.6]);
      return new Header({ children: [anchors([barImage()]), t, tinyPara()] });
    }

    function footer() {
      const one = [];
      if (has(s.company)) one.push(run(s.company.trim(), { size: 9.5, weight: 700 }));
      [s.street, s.city, s.web].filter(has).forEach((v) => {
        if (one.length) one.push(run(' · ', { size: 9.5, color: MUTED }));
        one.push(run(v.trim(), { size: 9.5, color: MUTED }));
      });
      const two = [s.kvk && `KvK ${s.kvk}`, s.vat && `Btw ${s.vat}`, s.iban && `IBAN ${s.iban}`].filter(Boolean);
      const left = one.slice();
      two.forEach((v, i) => {
        if (i) left.push(run(' · ', { size: 9.5, color: MUTED }));
        left.push(run(v, { size: 9.5, color: MUTED, break: !i && one.length ? 1 : undefined }));
      });
      const pageNo = [hexImage(9, 10.4), new TextRun({ children: [' pagina ', PageNumber.CURRENT, ' van ', PageNumber.TOTAL_PAGES], font: 'Open Sans', bold: true, size: hp(9.5), color: INK })];
      const t = table([row([
        cell([para(left.length ? left : [run('', { size: 9.5 })], { lh: 1.6 })], { width: CONTENT_W - 150, pt: 12, bt: line(1, LINE_C), valign: VerticalAlign.BOTTOM }),
        cell([para(pageNo, { align: AlignmentType.RIGHT, lh: 1.6 })], { width: 150, pt: 12, bt: line(1, LINE_C), valign: VerticalAlign.BOTTOM }),
      ])], [CONTENT_W - 150, 150]);
      return new Footer({ children: [t, tinyPara()] });
    }

    /* --- inhoud --- */

    const body = [];
    const numbering = [];
    let listInstance = 0;

    function titleRuns(title) {
      const t = String(title || '').trim();
      const dot = run('.', { size: 28, weight: 800, color: CYAN, spacing: -0.02 });
      const text = (v) => run(v, { size: 28, weight: 800, spacing: -0.02 });
      if (/[^.]\.$/.test(t)) return [text(t.slice(0, -1)), dot];
      if (/[!?…:]$/.test(t)) return [text(t)];
      return [text(t), dot];
    }

    // Label met zeshoek en de titel
    function titleBlock(before) {
      body.push(para([hexImage(), run(` ${model.label}`, { size: 10.5, weight: 700, caps: true, spacing: 0.12, color: BLUE })], { before, lh: 1.65, keepNext: true }));
      if (model.title) body.push(para(titleRuns(model.title), { before: 6, after: 4, lh: 1.15, keepNext: true }));
    }

    const addressParas = (lines, before = 0) => [para(lines.map((l, i) => run(l, { size: 13, break: i ? 1 : undefined })), { lh: 1.55, before })];

    // Gegevens als regels "NAAM  waarde": de naam klein in kapitalen, de waarde
    // achter een tabstop. Eén alinea per regel; geen samengevoegde cellen, zodat
    // het ook in Google Docs goed overkomt.
    function dlWidths(pairs, ddPx = 12) {
      const dt = Math.max(0, ...pairs.map(([k]) => textWidth(k.toUpperCase(), 9.5, 700, 0.12))) + 10;
      const dd = Math.max(0, ...pairs.map(([, v]) => textWidth(v, ddPx, 600))) + 10;
      return { dt: Math.ceil(dt), dd: Math.ceil(dd) };
    }
    const tab = () => (D.Tab ? new TextRun({ children: [new D.Tab()] }) : new TextRun({ text: '\t' }));
    function dlParas(pairs, tabAt, ddPx = 12) {
      return pairs.map(([k, v], i) => new Paragraph({
        children: [smallCaps(k), tab(), run(v, { size: ddPx, weight: 600 })],
        tabStops: [{ type: D.TabStopType.LEFT, position: tw(tabAt) }],
        spacing: { before: tw(i ? 2 : 0), after: 0, line: lineOf(1.65), lineRule: LineRuleType.AUTO },
      }));
    }

    // Adres links en gegevens rechts (brief en offerte)
    function metaBlock(leftParas, pairs, before) {
      const rows = pairs.filter(([, v]) => has(v));
      const { dt, dd } = dlWidths(rows);
      const right = dt + 18 + dd;
      const t = table([row([
        cell(leftParas, { width: CONTENT_W - right, valign: VerticalAlign.TOP }),
        cell(rows.length ? dlParas(rows, dt + 18) : [], { width: right, valign: VerticalAlign.TOP }),
      ])], [CONTENT_W - right, right]);
      if (before) body.push(spacer(before));
      body.push(t);
    }

    // Witruimte vóór een tabel (een tabel heeft zelf geen 'margin-top')
    const spacer = (px) => new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: tw(px), lineRule: LineRuleType.EXACT } });

    const m = model;
    if (m.type === 'brief') {
      metaBlock(addressParas(m.recipient), [['Datum', m.date], ['Kenmerk', m.reference]], 0);
      titleBlock(40);
      if (m.salutation) body.push(para([run(m.salutation)], { before: 22 }));
    } else if (m.type === 'offerte') {
      titleBlock(0);
      metaBlock([para([smallCaps('Offerte voor')], { lh: 1.65 }), ...addressParas(m.recipient)], [['Offertenummer', m.quoteNumber], ['Datum', m.date], ['Geldig tot', m.validUntil]], 26);
    } else if (m.type === 'memo') {
      titleBlock(0);
      const rows = [['Aan', m.memoTo], ['Van', m.memoFrom], ['CC', m.memoCc], ['Datum', m.date]].filter(([, v]) => has(v));
      body.push(spacer(18));
      body.push(table(rows.map(([k, v], i) => {
        const first = i === 0;
        const last = i === rows.length - 1;
        const o = { pt: first ? 14 : 0, pb: last ? 14 : 0, bt: first ? line(2, INK) : NONE, bb: last ? line(1, LINE_C) : NONE };
        return row([
          cell([para([smallCaps(k)], { before: first ? 0 : 6, lh: 1.65 })], { width: 72, valign: VerticalAlign.CENTER, ...o }),
          cell([para([run(v, { size: 13, weight: 600 })], { before: first ? 0 : 6, lh: 1.65 })], { width: CONTENT_W - 72, ...o }),
        ]);
      }), [72, CONTENT_W - 72]));
    } else {
      titleBlock(0);
      if (has(m.date)) {
        // Zoals in de preview: de twee kolommen delen de vrije ruimte, dus de datum staat rond het midden
        const { dt, dd } = dlWidths([['Datum', m.date]]);
        const free = Math.max(0, CONTENT_W - dt - 18 - dd);
        const [p] = dlParas([['Datum', m.date]], dt + 18 + free / 2);
        body.push(spacer(10), p);
      }
    }

    /* --- lopende tekst uit de editor --- */

    numbering.push(
      { reference: 'pm-bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '⬢', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: tw(22), hanging: tw(22) } }, run: { color: CYAN, font: 'Segoe UI Symbol', size: 14 } } }] },
      { reference: 'pm-numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: tw(22), hanging: tw(22) } }, run: { color: BLUE, bold: true, font: 'Open Sans', size: hp(13.5) } } }] },
    );

    // Inline-opmaak: tekst, vet, cursief, onderstreept en regeleindes
    function inlineRuns(node, st, base) {
      const out = [];
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const text = child.nodeValue.replace(/\s+/g, ' ');
          if (text) out.push(run(text, { ...base, weight: st.bold ? 700 : base.weight, italic: st.italic, underline: st.underline }));
        } else if (child.nodeType === 1) {
          const tag = child.tagName.toLowerCase();
          if (tag === 'br') out.push(new TextRun({ break: 1 }));
          else out.push(...inlineRuns(child, { bold: st.bold || tag === 'strong', italic: st.italic || tag === 'em', underline: st.underline || tag === 'u' }, base));
        }
      }
      return out;
    }

    const holder = document.createElement('div');
    holder.innerHTML = m.bodyHtml;
    let first = true;
    for (const el of Array.from(holder.children)) {
      const tag = el.tagName.toLowerCase();
      const gap = first ? (m.type === 'brief' ? 12 : 26) : 12;
      const st = { bold: false, italic: false, underline: false };
      if (tag === 'h2') {
        body.push(para(inlineRuns(el, st, { size: 17, weight: 700, spacing: -0.01 }), { before: 22, lh: 1.35, keepNext: true }));
      } else if (tag === 'h3') {
        body.push(para(inlineRuns(el, st, { size: 14, weight: 700 }), { before: 18, lh: 1.4, keepNext: true }));
      } else if (tag === 'blockquote') {
        body.push(para(inlineRuns(el, st, { size: 15, weight: 600 }), { before: gap, lh: 1.55, indent: { left: tw(16) }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: CYAN, space: 12 } } }));
      } else if (tag === 'ul' || tag === 'ol') {
        listInstance++;
        Array.from(el.children).filter((li) => li.tagName === 'LI').forEach((li, i) => {
          body.push(para(inlineRuns(li, st, {}), { before: i ? 4 : gap, numbering: { reference: tag === 'ul' ? 'pm-bullets' : 'pm-numbers', level: 0, instance: listInstance } }));
        });
      } else {
        const runs = inlineRuns(el, st, {});
        body.push(para(runs.length ? runs : [run('')], { before: gap }));
      }
      first = false;
    }

    /* --- offerte: regels, totalen, akkoord --- */

    if (m.items) {
      const widths = [CONTENT_W - 280, 70, 100, 110];
      const th = (text, right, width) => cell([para([run(text, { size: 9.5, weight: 700, caps: true, spacing: 0.1 })], { align: right ? AlignmentType.RIGHT : undefined, lh: 1.5 })], { width, pt: 8, pb: 8, pl: 10, pr: 10, fill: TINT, bb: line(2, CYAN), valign: VerticalAlign.BOTTOM });
      const td = (text, right, width, zebra) => cell([para([run(text, { size: 12.5 })], { align: right ? AlignmentType.RIGHT : undefined, lh: 1.5 })], { width, pt: 8, pb: 8, pl: 10, pr: 10, fill: zebra ? ZEBRA : undefined, bb: line(1, LINE_C), valign: VerticalAlign.TOP });
      const rows = [row([th('Omschrijving', false, widths[0]), th('Aantal', true, widths[1]), th('Prijs', true, widths[2]), th('Totaal', true, widths[3])], { cantSplit: true })];
      m.items.rows.forEach((it, i) => rows.push(row([td(it.desc, false, widths[0], i % 2), td(it.qty, true, widths[1], i % 2), td(it.price, true, widths[2], i % 2), td(it.total, true, widths[3], i % 2)], { cantSplit: true })));
      body.push(spacer(26), table(rows, widths));

      const tot = (k, v, total) => row([
        cell([para([run(k, { size: total ? 15 : 12.5, weight: total ? 800 : 400, color: total ? INK : MUTED })], { lh: 1.65, before: total ? 4 : 0 })], { width: 150, pt: total ? 8 : 4, pb: 4, pl: 10, bt: total ? line(3, CYAN) : NONE }),
        cell([para([run(v, { size: total ? 15 : 12.5, weight: total ? 800 : 600 })], { align: AlignmentType.RIGHT, lh: 1.65, before: total ? 4 : 0 })], { width: 150, pt: total ? 8 : 4, pb: 4, pr: 10, bt: total ? line(3, CYAN) : NONE }),
      ]);
      body.push(spacer(12), table([tot('Subtotaal', m.items.subtotal), tot(`Btw ${m.items.vatRate}%`, m.items.vat), tot('Totaal', m.items.total, true)], [150, 150], { align: AlignmentType.RIGHT }));
    }

    if (m.acceptBlock) {
      // Kader met cyaan linkerrand: titel, dan drie lijnen met eronder "naam", "datum", "handtekening"
      const field = (CONTENT_W - 32 - 2 * 24) / 3;
      const widths = [16 + field, 24, field, 24, field + 16];
      const top = line(1, LINE_C);
      const bottom = line(1, LINE_C);
      const leftEdge = line(4, CYAN);
      const rightEdge = line(1, LINE_C);
      const lab = (text) => para([run(text, { size: 10, color: MUTED })], { lh: 1.65 });
      const blank = () => new Paragraph({ children: [new TextRun({ text: '', size: 2 })], spacing: { before: 0, after: 0, line: tw(16), lineRule: LineRuleType.EXACT } });
      const rows = [
        row([cell([para([smallCaps('Voor akkoord')], { lh: 1.65 })], { span: 5, pt: 14, pb: 24, pl: 16, pr: 16, bt: top, bl: leftEdge, br: rightEdge })]),
        row([
          cell([blank()], { width: widths[0], pl: 16, pt: 34, bb: line(1, INK), bl: leftEdge }),
          cell([blank()], { width: widths[1] }),
          cell([blank()], { width: widths[2], pt: 34, bb: line(1, INK) }),
          cell([blank()], { width: widths[3] }),
          cell([blank()], { width: widths[4], pr: 16, pt: 34, bb: line(1, INK), br: rightEdge }),
        ]),
        row([
          cell([lab('naam')], { width: widths[0], pl: 16, bb: bottom, bl: leftEdge }),
          cell([blank()], { width: widths[1], bb: bottom }),
          cell([lab('datum')], { width: widths[2], bb: bottom }),
          cell([blank()], { width: widths[3], bb: bottom }),
          cell([lab('handtekening')], { width: widths[4], pr: 16, bb: bottom, br: rightEdge }),
        ], { cantSplit: true }),
      ];
      body.push(spacer(28), table(rows, widths));
    }

    /* --- ondertekening --- */

    if (m.sign) {
      const g = m.sign;
      const children = [];
      if (g.closing) body.push(para([run(g.closing)], { before: 28, keepNext: true }));
      if (g.image) {
        const png = await imageToPng(g.image);
        let h = 60;
        let w = (h * png.width) / png.height;
        if (w > 220) {
          w = 220;
          h = (w * png.height) / png.width;
        }
        body.push(para([new ImageRun({ type: 'png', data: png.data, transformation: { width: Math.round(w), height: Math.round(h) } })], { before: g.closing ? 8 : 28, after: 4, lh: 1, keepNext: true }));
      } else {
        body.push(spacer(g.closing ? 44 + 12 : 44 + 28));
      }
      if (g.name) children.push(para([run(g.name, { weight: 700 })], { keepNext: true }));
      if (g.role) children.push(para([run(g.role, { size: 12, color: MUTED })]));
      body.push(...children);
    }

    /* --- document --- */

    const fonts = await PM.fontFiles();
    const doc = new Document({
      creator: s.company || 'Pure Minds',
      title: m.title || m.typeLabel,
      subject: m.typeLabel,
      description: 'Gemaakt met de Pure Minds Generator Hub',
      styles: {
        default: {
          document: { run: { font: 'Open Sans', size: hp(13.5), color: INK, language: { value: 'nl-NL' } }, paragraph: { spacing: { line: lineOf(1.65), lineRule: LineRuleType.AUTO } } },
        },
      },
      numbering: { config: numbering },
      fonts: [
        { name: 'Open Sans', data: fonts.normal.data },
        { name: 'Open Sans SemiBold', data: fonts.semibold.data },
        { name: 'Open Sans ExtraBold', data: fonts.extrabold.data },
      ],
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: tw(112), right: tw(72), bottom: tw(112), left: tw(72), header: tw(48), footer: tw(40) },
          },
          titlePage: true,
        },
        headers: { first: firstHeader(), default: nextHeader() },
        footers: { first: footer(), default: footer() },
        children: body,
      }],
    });

    return Packer.toBlob(doc);
  }

  global.PMDocDocx = { build };
})(window);
