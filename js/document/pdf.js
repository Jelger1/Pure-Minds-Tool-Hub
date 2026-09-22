/* =============================================================================
   document/pdf.js — A4-pagina's uit de preview als bewerkbare vector-PDF
   -----------------------------------------------------------------------------
   Geen screenshot: elke pagina wordt opnieuw opgebouwd in jsPDF, op precies
   de plek waar de browser alles in de preview heeft gezet.

     tekst            echte tekst in ingesloten Open Sans, per regel; te
                      selecteren en aan te passen in Acrobat of Illustrator
     vlakken, lijnen  vectorrechthoeken (achtergronden en randen uit de CSS)
     logo, zeshoeken  SVG, omgezet naar vectoren met svg2pdf.js
     handtekening     de enige pixelafbeelding (het is een scan of foto)

   Dezelfde lettertypebestanden in preview en PDF: posities en breedtes kloppen.
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;
  const PAGE_W = 794;               // A4 op 96 dpi
  const K = 595.28 / PAGE_W;        // px -> pt

  /* ---------------------------------------------------------------------------
     Hulpjes
     ------------------------------------------------------------------------- */

  // Afstand van bovenkant tekstvak tot basislijn, gemeten in de browser zelf
  let ascentRatio = null;
  function ascent(size) {
    if (ascentRatio == null) {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;left:-9999px;top:0;font:400 100px "PM Open Sans";line-height:normal;white-space:nowrap';
      probe.innerHTML = '<span>Hxg</span><i style="display:inline-block;width:1px;height:0;vertical-align:baseline"></i>';
      document.body.appendChild(probe);
      const text = probe.firstChild.getBoundingClientRect();
      const mark = probe.lastChild.getBoundingClientRect();
      ascentRatio = (mark.top - text.top) / 100;
      probe.remove();
    }
    return ascentRatio * size;
  }

  function parseColor(value) {
    const m = /rgba?\(([^)]+)\)/.exec(value || '');
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    return a > 0 ? { r: p[0], g: p[1], b: p[2], a } : null;
  }

  function withAlpha(pdf, a, draw) {
    if (a >= 1) {
      draw();
      return;
    }
    pdf.saveGraphicsState();
    pdf.setGState(new pdf.GState({ opacity: a, 'stroke-opacity': a }));
    draw();
    pdf.restoreGraphicsState();
  }

  function fillRect(pdf, color, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    withAlpha(pdf, color.a, () => {
      pdf.setFillColor(color.r, color.g, color.b);
      pdf.rect(x * K, y * K, w * K, h * K, 'F');
    });
  }

  /* ---------------------------------------------------------------------------
     Vlakken en randen
     ------------------------------------------------------------------------- */

  function drawBox(pdf, cs, r, o) {
    const x = r.left - o.x;
    const y = r.top - o.y;
    const bg = parseColor(cs.backgroundColor);
    // Een halve pixel overlap, anders geven aangrenzende vlakken (tabelcellen) witte naden
    if (bg) fillRect(pdf, bg, x, y, r.width + 0.5, r.height + 0.5);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const w = parseFloat(cs[`border${side}Width`]);
      if (!w || cs[`border${side}Style`] === 'none') continue;
      const c = parseColor(cs[`border${side}Color`]);
      if (!c) continue;
      if (side === 'Top') fillRect(pdf, c, x, y, r.width, w);
      if (side === 'Bottom') fillRect(pdf, c, x, y + r.height - w, r.width, w);
      if (side === 'Left') fillRect(pdf, c, x, y, w, r.height);
      if (side === 'Right') fillRect(pdf, c, x + r.width - w, y, w, r.height);
    }
  }

  /* ---------------------------------------------------------------------------
     Tekst
     ------------------------------------------------------------------------- */

  function setFont(pdf, cs, size) {
    const italic = cs.fontStyle === 'italic' || cs.fontStyle === 'oblique';
    pdf.setFont('OpenSans', PM.pdfFontStyle(cs.fontWeight, italic));
    pdf.setFontSize(size * K);
  }

  // Onderstreping loopt door naar kinderen (bijv. <u><strong>…</strong></u>)
  function underlineOf(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/underline/.test(cs.textDecorationLine)) return cs;
      if (cs.display !== 'inline') break;
    }
    return null;
  }

  // Woorden van een tekstknoop groeperen per regel, met de posities uit de browser
  function lineBoxes(node, size) {
    const raw = node.nodeValue;
    const lines = [];
    const range = document.createRange();
    const add = (rect, start, end) => {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.top - rect.top) < size * 0.4) {
        last.end = end;
        last.left = Math.min(last.left, rect.left);
        last.right = Math.max(last.right, rect.right);
      } else {
        lines.push({ top: rect.top, left: rect.left, right: rect.right, start, end });
      }
    };
    const re = /\S+/g;
    let m;
    while ((m = re.exec(raw))) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      if (rects.length === 1) {
        add(rects[0], m.index, m.index + m[0].length);
        continue;
      }
      // Eén woord over meerdere regels (heel lang woord): per teken
      for (let i = 0; i < m[0].length; i++) {
        range.setStart(node, m.index + i);
        range.setEnd(node, m.index + i + 1);
        const rect = range.getClientRects()[0];
        if (rect && rect.width > 0) add(rect, m.index + i, m.index + i + 1);
      }
    }
    return lines;
  }

  function drawText(pdf, node, o) {
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    const el = node.parentElement;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const color = parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
    const spacing = parseFloat(cs.letterSpacing) || 0;
    const upper = cs.textTransform === 'uppercase';
    const align = cs.textAlign;
    const underline = underlineOf(el);

    setFont(pdf, cs, size);
    pdf.setTextColor(color.r, color.g, color.b);
    pdf.setCharSpace(spacing * K);

    for (const line of lineBoxes(node, size)) {
      let text = raw.slice(line.start, line.end).replace(/\s+/g, ' ');
      if (upper) text = text.toUpperCase();
      const base = line.top - o.y + ascent(size);
      if (align === 'right' || align === 'end') pdf.text(text, (line.right - o.x) * K, base * K, { align: 'right' });
      else if (align === 'center') pdf.text(text, ((line.left + line.right) / 2 - o.x) * K, base * K, { align: 'center' });
      else pdf.text(text, (line.left - o.x) * K, base * K);

      if (underline) {
        const thick = parseFloat(underline.textDecorationThickness) || size / 14;
        const offset = parseFloat(underline.textUnderlineOffset) || 0;
        const c = parseColor(underline.textDecorationColor) || color;
        fillRect(pdf, c, line.left - o.x, base + size * 0.075 + offset, line.right - line.left, thick);
      }
    }
    pdf.setCharSpace(0);
  }

  // Nummers van een genummerde lijst (::marker zit niet in de DOM)
  function drawMarker(pdf, li, o) {
    const list = li.parentElement;
    const items = Array.from(list.children).filter((n) => n.tagName === 'LI');
    const number = (Number(list.getAttribute('start')) || 1) + items.indexOf(li);
    const range = document.createRange();
    range.selectNodeContents(li);
    const first = Array.from(range.getClientRects()).find((r) => r.width > 0 && r.height > 0);
    if (!first) return;
    const mcs = getComputedStyle(li, '::marker');
    const size = parseFloat(mcs.fontSize) || parseFloat(getComputedStyle(li).fontSize);
    const color = parseColor(mcs.color) || { r: 0, g: 0, b: 0, a: 1 };
    setFont(pdf, mcs, size);
    pdf.setTextColor(color.r, color.g, color.b);
    // De browser zet "1. " (met spatie) tegen de linkerrand van het item
    const width = pdf.getTextWidth(`${number}. `) / K;
    const x = li.getBoundingClientRect().left - width - o.x;
    pdf.text(`${number}.`, x * K, (first.top - o.y + ascent(size)) * K);
  }

  /* ---------------------------------------------------------------------------
     SVG en afbeeldingen
     ------------------------------------------------------------------------- */

  async function svgFromSrc(src) {
    if (src.startsWith('data:image/svg+xml')) {
      const comma = src.indexOf(',');
      const data = src.slice(comma + 1);
      if (/;base64/i.test(src.slice(0, comma))) {
        const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      }
      return decodeURIComponent(data);
    }
    if (/\.svg(?:[?#]|$)/i.test(src)) {
      const res = await fetch(src);
      if (res.ok) return res.text();
    }
    return null;
  }

  async function drawSvg(pdf, markup, x, y, w, h) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden';
    holder.innerHTML = markup;
    document.body.appendChild(holder);
    try {
      const svg = holder.querySelector('svg');
      if (svg) await pdf.svg(svg, { x: x * K, y: y * K, width: w * K, height: h * K });
    } finally {
      holder.remove();
    }
  }

  async function drawImg(pdf, img, r, o) {
    const x = r.left - o.x;
    const y = r.top - o.y;
    const markup = await svgFromSrc(img.currentSrc || img.src).catch(() => null);
    if (markup) {
      await drawSvg(pdf, markup, x, y, r.width, r.height);
      return;
    }
    // Pixelafbeelding (handtekening): object-fit contain, links uitgelijnd
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return;
    const scale = Math.min(r.width / nw, r.height / nh);
    const dw = nw * scale;
    const dh = nh * scale;
    const canvas = document.createElement('canvas');
    const px = Math.min(1, 1600 / Math.max(nw, nh));
    canvas.width = Math.round(nw * px);
    canvas.height = Math.round(nh * px);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let data;
    try {
      data = canvas.toDataURL('image/png');
    } catch (err) {
      throw err.name === 'SecurityError' ? PM.fileProtocolError() : err;
    }
    pdf.addImage(data, 'PNG', x * K, (y + (r.height - dh) / 2) * K, dw * K, dh * K, undefined, 'FAST');
  }

  /* ---------------------------------------------------------------------------
     Pagina doorlopen in tekenvolgorde
     ------------------------------------------------------------------------- */

  async function drawNode(pdf, node, o) {
    if (node.nodeType === 3) {
      drawText(pdf, node, o);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();

    if (el instanceof SVGElement) {
      if (el.tagName.toLowerCase() === 'svg' && r.width && r.height) {
        await drawSvg(pdf, new XMLSerializer().serializeToString(el), r.left - o.x, r.top - o.y, r.width, r.height);
      }
      return;
    }
    drawBox(pdf, cs, r, o);
    if (el.tagName === 'IMG') {
      if (r.width && r.height) await drawImg(pdf, el, r, o);
      return;
    }
    if (el.tagName === 'LI' && el.parentElement && el.parentElement.tagName === 'OL' && !el.classList.contains('is-cont')) {
      drawMarker(pdf, el, o);
    }
    for (const child of Array.from(el.childNodes)) await drawNode(pdf, child, o);
  }

  /**
   * Maakt een PDF van A4-pagina's (elementen van 794 × 1123 px, ongeschaald
   * in de DOM). meta: { title, subject, author }. Geeft een Blob terug.
   */
  async function exportPages(pages, meta = {}, onProgress) {
    const JsPDF = await PM.libs.svg2pdf();
    await PM.fontsReady;
    const pdf = new JsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true, putOnlyUsedFonts: true });
    await PM.pdfFonts(pdf);
    for (let i = 0; i < pages.length; i++) {
      if (onProgress) onProgress(i, pages.length);
      if (i > 0) pdf.addPage('a4', 'portrait');
      const origin = pages[i].getBoundingClientRect();
      await drawNode(pdf, pages[i], { x: origin.left, y: origin.top });
    }
    pdf.setProperties({
      title: meta.title || 'Document',
      subject: meta.subject || '',
      author: meta.author || 'Pure Minds',
      creator: 'Pure Minds Generator Hub',
    });
    pdf.setLanguage('nl-NL');
    return pdf.output('blob');
  }

  global.PMDocPdf = { exportPages };
})(window);
