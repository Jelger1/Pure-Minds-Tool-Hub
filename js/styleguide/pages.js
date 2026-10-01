/* =============================================================================
   styleguide/pages.js — de pagina's van het brandbook als tekenfuncties
   -----------------------------------------------------------------------------
   Elke pagina is A4 liggend: 1684 × 1191 ontwerp-px (144 dpi). Dezelfde
   tekenfunctie tekent het podium (een echt canvas) en de PDF (PMPdfCanvas,
   js/styleguide/export.js), zodat wat je ziet is wat je exporteert.

   Alleen tekenwerk dat PMPdfCanvas als losse, bewerkbare vector kent:
   rechthoeken, paden (moveTo, lineTo, bezierCurveTo, closePath), fill, stroke
   en tekst met de alfabetische basislijn. Geen translate, rotate, scale,
   clip, ellipse, roundRect, setLineDash, verlopen of doorzichtigheid: een
   lijnpatroon op 6% wit is gewoon een effen, iets lichtere kleur. Logo,
   badge en iconen zijn paden (js/styleguide/svg-path.js), geen afbeeldingen.

   Lagen: elk blok zit in een laag (Achtergrond, Vormen, Tekst, Logo, Beeld).
   Op het scherm doet dat niets; in de PDF worden het lagen (OCG).

     PMStyleguide.W, H, LAYERS
     PMStyleguide.pages              [{ id, chapter, title, dark, index }]
     PMStyleguide.draw(ctx, i, env)  pagina i tekenen
     PMStyleguide.render(canvas, i, env, scale)   op een canvas, op schaal
     PMStyleguide.ratio(ctx, x, y, w, mode)       de 60/30/10-balk (ook het paneel)
     PMStyleguide.composition(ctx, x, y, w, h, mode)  een lichte of donkere compositie
     PMStyleguide.overlay(ctx, boxes)             clear space om elk logo (alleen podium)

   env: { logo, badgeWhite, badgeBlack (geparste SVG's), boxes: [] (vult zich met
   de plek van elk logo, voor de clear-space-laag) }
   ============================================================================= */
(function (global) {
  'use strict';

  const K = global.PMCanvas;
  const T = global.PM_BRAND_TOKENS;
  const C = global.PM_BRAND_CONTENT;
  const SVG = global.PMSvgPath;
  const M = global.PMStyleguideModel;

  const W = T.page.w;
  const H = T.page.h;
  const MX = T.page.margin;
  const CW = W - 2 * MX;           // breedte van de inhoud
  const LOGO_W = T.page.logoW;
  const LOGO_H = LOGO_W / T.logo.aspect;
  const MM = W / T.page.mmW;       // ontwerp-px per mm
  const LAYERS = ['Achtergrond', 'Vormen', 'Tekst', 'Logo', 'Beeld'];

  const hex = (id) => T.color(id).hex;
  const INK = hex('inkt');
  const WHITE = hex('wit');
  const CYAN = hex('cyaan');
  const MAGENTA = hex('magenta');
  const MUTED = hex('grijs');
  // Niet-merkkleuren voor lijnen en vlakjes, gelijk aan css/global.css
  const LINE = '#E1E7EC';
  const CANVAS = '#EDF3F7';
  const TINT = '#E8F7FC';
  // Op Inkt: wit op 75% (tekst) en 6% (zeshoekpatroon), als effen kleur gemengd
  const DIM = '#CACACA';
  const PATTERN = '#3C3C3C';
  const TILE = '#3B3B3B';          // iets lichter vlak op Inkt (tegels)
  const PHOTO = '#3A4652';         // het lege fotovlak uit de makers (canvas-kit)

  const { CAP, SQRT3 } = K;

  /* ---------------------------------------------------------------------------
     Bouwstenen
     ------------------------------------------------------------------------- */

  // Een blok in een laag; op een gewoon canvas zijn beginLayer en endLayer er niet
  function layer(ctx, name, fn) {
    if (ctx.beginLayer) ctx.beginLayer(name);
    fn();
    if (ctx.endLayer) ctx.endLayer();
  }

  const font = (ctx, weight, size, track = 0) => K.setFont(ctx, weight, size, track);

  /**
   * Tekst in een kolom; **woord** wordt nadruk. st: size, weight, emWeight, lh,
   * track, color, em (kleur nadruk), dot (cyaan punt), align. Geeft de hoogte terug
   * (van de bovenkant van de hoofdletters tot onder de laatste regel).
   */
  // "€ 1.500,-" blijft op één regel: een vaste spatie na het euroteken
  const keep = (str) => String(str).replace(/€ (?=\d)/g, '€ ');

  function plan(ctx, str, maxW, st) {
    return K.layoutText(ctx, K.runsFrom(keep(str), { dot: !!st.dot }), maxW, {
      size: st.size, weight: st.weight || 400, emWeight: st.emWeight || 700, lh: st.lh || 1.45, track: st.track || 0,
    });
  }
  function text(ctx, str, x, top, maxW, st) {
    const block = plan(ctx, str, maxW, st);
    K.drawText(ctx, block, x, top, { color: st.color, em: st.em || st.color, accent: st.accent || CYAN, align: st.align || 'left' });
    return block.height;
  }

  // Eén regel, zonder afbreken; geeft de breedte terug
  function line(ctx, str, x, base, { size, weight = 400, color, track = 0, align = 'left', italic = false }) {
    font(ctx, weight, size, track);
    if (italic) ctx.font = `italic ${weight} ${size}px ${K.FONT_FAMILY}`;
    const w = ctx.measureText(str).width;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = color;
    ctx.fillText(str, x0, base);
    return w;
  }

  // Opsomming met cyaan zeshoekjes (canvas-kit); geeft de hoogte terug
  function bullets(ctx, items, x, top, maxW, st) {
    const body = K.layoutBody(ctx, items.map((t) => `- ${t}`).join('\n'), maxW, {
      size: st.size, weight: st.weight || 400, emWeight: 700, lh: st.lh || 1.45, track: 0, itemGap: st.gap != null ? st.gap : 0.55,
    });
    K.drawBody(ctx, body, x, top, { color: st.color, em: st.em || st.color });
    return body.height;
  }

  // Label: zeshoekje en kapitalen met spatiëring, zoals in de makers
  function label(ctx, str, x, top, { color, bullet = CYAN, size = 17 } = {}) {
    const cap = size * CAP;
    const r = size / 2;
    K.hexPath(ctx, x + (r * SQRT3) / 2, top + cap / 2, r);
    ctx.fillStyle = bullet;
    ctx.fill();
    line(ctx, String(str).toUpperCase(), x + r * SQRT3 + size * 0.6, top + cap, { size, weight: 700, color, track: 0.12 });
  }

  // Effen zeshoek (punt boven) met een getal erin: cyaan krijgt Inkt, donker krijgt wit
  function numberHex(ctx, cx, cy, r, n, fill = CYAN) {
    K.hexPath(ctx, cx, cy, r);
    ctx.fillStyle = fill;
    ctx.fill();
    const size = r * 0.95;
    line(ctx, String(n), cx, cy + (size * CAP) / 2, { size, weight: 800, color: M.readable(fill), align: 'center' });
  }

  function rule(ctx, x, y, w, color = LINE, lw = 2) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, lw);
  }

  // Lijnpatroon van zeshoeken in één pad (één element in Canva). Alleen zeshoeken die
  // helemaal binnen het vlak vallen, of (whole: false) alles wat het vlak raakt
  function pattern(ctx, x, y, w, h, { r = 56, color = PATTERN, lw = 1.5, whole = false } = {}) {
    const colW = SQRT3 * r;
    const rowH = 1.5 * r;
    ctx.beginPath();
    for (let row = -1; row * rowH < h + r; row++) {
      const cy = y + row * rowH;
      const shift = row % 2 !== 0 ? colW / 2 : 0;
      for (let cx = x - colW + shift; cx < x + w + colW; cx += colW) {
        const inside = cx - colW / 2 >= x && cx + colW / 2 <= x + w && cy - r >= y && cy + r <= y + h;
        if (whole && !inside) continue;
        K.addHex(ctx, cx, cy, r);
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'miter';
    ctx.stroke();
  }

  /* --- Logo, badge en iconen: paden --- */

  // Het logo op (x, y) met breedte w, in wit of Inkt. Onthoudt de plek voor de clear-space-laag
  function logo(ctx, env, x, y, w, color, opts = {}) {
    const h = w / T.logo.aspect;
    if (env && env.logo) {
      layer(ctx, 'Logo', () => SVG.draw(ctx, env.logo, { x, y, w: opts.stretch ? w * opts.stretch : w, h }, { color, fit: opts.stretch ? 'stretch' : 'contain', rotate: opts.rotate || 0 }));
    }
    if (env && env.boxes && !opts.example) env.boxes.push({ x, y, w, h });
    return h;
  }

  // Iconen via de zeshoek van de Icon Finder (js/icons/hex.js), één keer omgezet per variant
  const iconCache = new Map();
  function iconSvg(name, opts) {
    const key = `${name}|${JSON.stringify(opts)}`;
    if (!iconCache.has(key)) {
      const d = C.iconPaths[name].d;
      iconCache.set(key, SVG.parseSvg(global.PMHex.svg(d, opts)));
    }
    return iconCache.get(key);
  }

  // Icoon in een afgeronde zeshoek, h hoog (de breedte volgt de vorm)
  function hexIcon(ctx, name, x, y, h, preset) {
    const opts = { shape: 'hex', ...global.PMHex.presets[preset] };
    const w = (h * global.PMHex.WIDTH) / global.PMHex.HEIGHT;
    layer(ctx, 'Beeld', () => SVG.draw(ctx, iconSvg(name, opts), { x, y, w, h }));
    return w;
  }

  // Los icoon (24-raster) in een kleur
  function looseIcon(ctx, name, x, y, size, color) {
    layer(ctx, 'Beeld', () => SVG.draw(ctx, iconSvg(name, { color }), { x, y, w: size, h: size }));
  }

  // Wel of niet: een cyaan zeshoek met vinkje of een donkere met kruis (op donker: wit, uitgesneden)
  function mark(ctx, ok, x, y, h, onDark = false) {
    return hexIcon(ctx, ok ? 'check' : 'close', x, y, h, ok ? 'cyaan' : onDark ? 'wit' : 'donker');
  }

  // Een fotovlak zonder foto: het lege vlak uit de makers met een beeldicoon
  function photoFrame(ctx, x, y, w, h, { color = PHOTO, corner = 'right' } = {}) {
    layer(ctx, 'Beeld', () => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    });
    const s = Math.min(48, h * 0.22);
    looseIcon(ctx, 'image', corner === 'right' ? x + w - s - 16 : x + 14, corner === 'right' ? y + 16 : y + h - s - 14, s, '#7D8A96');
  }

  /* ---------------------------------------------------------------------------
     Pagina: achtergrond, kop, voet en logo
     ------------------------------------------------------------------------- */

  const pal = (dark) => (dark
    ? { bg: INK, text: WHITE, sub: DIM, em: CYAN, label: WHITE, line: '#4A4A4A' }
    : { bg: WHITE, text: INK, sub: MUTED, em: INK, label: INK, line: LINE });

  function background(ctx, P) {
    layer(ctx, 'Achtergrond', () => {
      ctx.fillStyle = P.dark ? INK : WHITE;
      ctx.fillRect(0, 0, W, H);
      if (P.pattern) pattern(ctx, 0, 0, W, H, { r: 64 });
    });
  }

  // Label en titel linksboven; geeft de y onder de titel terug
  function head(ctx, P, labelText, title, { size = 58, maxW = CW } = {}) {
    const c = pal(P.dark);
    let bottom = 0;
    layer(ctx, 'Tekst', () => {
      label(ctx, labelText, MX, 86, { color: c.label });
      bottom = 124 + text(ctx, title, MX, 124, maxW, { size, weight: 800, emWeight: 800, track: -0.02, lh: 1.1, color: c.text, em: CYAN, dot: true });
    });
    return bottom;
  }

  const FOOT = H - 64;                          // basislijn van de voetregel
  const LOGO_BOX = { x: W - MX - LOGO_W, y: H - 56 - LOGO_H, w: LOGO_W, h: LOGO_H };

  // Cyaan balk, voetregel en het logo rechtsonder (niet op een pagina die zelf een logo toont)
  function chrome(ctx, P, env) {
    const c = pal(P.dark);
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = CYAN;
      ctx.fillRect(0, 0, W, T.page.bar);
    });
    layer(ctx, 'Tekst', () => {
      let x = MX;
      [['pureminds', c.text], ['.', CYAN], ['nl', c.text]].forEach(([part, color]) => {
        x += line(ctx, part, x, FOOT, { size: 18, weight: 700, color, track: 0.02 });
      });
      const chapter = C.chapters.find((ch) => ch.id === P.chapter);
      line(ctx, `${C.version} · ${chapter ? chapter.label : ''}`, MX + 190, FOOT, { size: 16, weight: 600, color: c.sub, track: 0.02 });
      const no = String(P.index + 1).padStart(2, '0');
      line(ctx, no, P.logo ? W - MX : LOGO_BOX.x - LOGO_W * T.logo.clearSpace - 6, FOOT, { size: 16, weight: 700, color: c.sub, align: 'right', track: 0.04 });
    });
    if (!P.logo) logo(ctx, env, LOGO_BOX.x, LOGO_BOX.y, LOGO_W, P.dark ? WHITE : INK);
  }

  /* ---------------------------------------------------------------------------
     De pagina's
     ------------------------------------------------------------------------- */

  function cover(ctx, P, env) {
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Huisstijlhandboek', MX, 400, { color: CYAN });
      text(ctx, 'BRANDBOOK', MX - 6, 452, 1000, { size: 150, weight: 800, track: -0.01, lh: 1, color: WHITE });
      text(ctx, C.company, MX, 640, 1000, { size: 50, weight: 400, lh: 1.15, color: WHITE, dot: true });
      line(ctx, C.slogan, MX, 760, { size: 26, weight: 400, color: DIM, italic: true });
      line(ctx, `Versie ${T.version} · ${C.date}`, MX, 950, { size: 18, weight: 600, color: DIM, track: 0.04 });
    });
    const w = 340;
    logo(ctx, env, 1200, (H - w / T.logo.aspect) / 2, w, WHITE);
  }

  function inhoud(ctx, P) {
    const top = head(ctx, P, 'Inhoud', 'Wat er in dit brandbook staat.') + 40;
    layer(ctx, 'Tekst', () => {
      text(ctx, 'De huisstijl van Pure Minds Marketing Group: wie we zijn, hoe we klinken en hoe we eruitzien. In de Brand Styleguide kopieer je elke kleur en download je elk logo.', MX, top, 1150, { size: 23, lh: 1.5, color: MUTED });
    });
    const rows = C.chapters;
    const y0 = top + 120;
    const rowH = (945 - y0) / rows.length;
    rows.forEach((ch, i) => {
      const y = y0 + i * rowH;
      const list = PAGES.filter((p) => p.chapter === ch.id && p.id !== 'cover' && p.id !== 'inhoud');
      layer(ctx, 'Vormen', () => {
        if (i) rule(ctx, MX, y - 2, CW);
      });
      layer(ctx, 'Vormen', () => numberHex(ctx, MX + 26, y + rowH / 2, 26, i + 1));
      layer(ctx, 'Tekst', () => {
        line(ctx, ch.title, MX + 80, y + rowH / 2 + 11, { size: 30, weight: 700, color: INK });
        let x = 720;
        list.forEach((p) => {
          x += line(ctx, p.title, x, y + rowH / 2 + 8, { size: 21, color: INK }) + 10;
          x += line(ctx, String(p.index + 1).padStart(2, '0'), x, y + rowH / 2 + 8, { size: 21, weight: 700, color: MUTED }) + 40;
        });
      });
    });
  }

  function missieVisie(ctx, P) {
    const top = head(ctx, P, 'Merk', 'Waar wij in geloven en elke dag opnieuw aan werken, is verankerd in onze **missie en visie**.', { size: 50, maxW: 1240 }) + 90;
    // De missie met nadruk op wat we vinden; de tekst zelf is letterlijk C.mission
    const mission = C.mission.replace('on-aangetapt groeipotentieel', '**on-aangetapt groeipotentieel**');
    const mSt = { size: 42, weight: 700, emWeight: 700, lh: 1.25, color: WHITE, em: CYAN };
    const vSt = { size: 26, lh: 1.55, color: WHITE };
    const barH = 52 + Math.max(plan(ctx, mission, 660, mSt).height, plan(ctx, C.vision, 660, vSt).height) + 8;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = CYAN;
      ctx.fillRect(MX, top - 6, 6, barH);
      ctx.fillRect(880, top - 6, 6, barH);
    });
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Missie', MX + 40, top, { color: WHITE });
      text(ctx, mission, MX + 40, top + 52, 660, mSt);
      label(ctx, 'Visie', 920, top, { color: WHITE });
      text(ctx, C.vision, 920, top + 52, 660, vSt);
      const sy = Math.max(top + barH + 110, 820);
      label(ctx, 'Slogan', MX, sy, { color: WHITE });
      // Bold: de PDF kent geen SemiBold Italic (die wordt BoldItalic), zo zijn scherm en PDF gelijk
      line(ctx, C.slogan, MX, sy + 70, { size: 36, weight: 700, color: WHITE, italic: true });
    });
  }

  function kernwaarden(ctx, P) {
    const top = head(ctx, P, 'Merk', 'Vier kernwaarden.') + 24;
    layer(ctx, 'Tekst', () => {
      text(ctx, 'Waar we op sturen, en hoe je dat terugleest in wat we schrijven.', MX, top, 1200, { size: 23, color: MUTED });
    });
    const gap = 44;
    const w = (CW - 3 * gap) / 4;
    const y = top + 120;
    const tSt = { size: 22, lh: 1.55, color: INK };
    // "Zo klinkt het" staat in alle vier kolommen op dezelfde hoogte
    const yy = y + 172 + Math.max(...C.values.map((v) => plan(ctx, v.text, w, tSt).height)) + 70;
    C.values.forEach((v, i) => {
      const x = MX + i * (w + gap);
      layer(ctx, 'Vormen', () => {
        numberHex(ctx, x + 36, y + 36, 36, i + 1);
        rule(ctx, x, yy - 34, w);
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, v.name, x, y + 140, { size: 36, weight: 800, color: INK, track: -0.01 });
        text(ctx, v.text, x, y + 172, w, tSt);
        label(ctx, 'Zo klinkt het', x, yy, { color: MUTED, size: 15 });
        text(ctx, v.sound, x, yy + 42, w, { size: 22, weight: 600, lh: 1.5, color: INK });
      });
    });
  }

  function toneOfVoice(ctx, P) {
    const top = head(ctx, P, 'Merk', 'Tone of voice.') + 30;
    layer(ctx, 'Tekst', () => {
      text(ctx, C.tone.intro, MX, top, 1180, { size: 24, lh: 1.5, color: INK });
    });
    const y0 = top + 180;
    const rowH = (945 - y0) / C.tone.scales.length;
    const colA = 440;
    layer(ctx, 'Tekst', () => {
      [['Schaal', MX], ['Waar Pure Minds staat', 620], ['In de praktijk', 1000]].forEach(([t, x]) => line(ctx, t.toUpperCase(), x, y0 - 18, { size: 14, weight: 700, color: MUTED, track: 0.1 }));
    });
    C.tone.scales.forEach((s, i) => {
      const y = y0 + i * rowH;
      layer(ctx, 'Vormen', () => {
        rule(ctx, MX, y, CW);
        rule(ctx, MX, y + 64, colA, '#C5CED6', 3);
        K.hexPath(ctx, MX + colA * s.pos, y + 65.5, 14);
        ctx.fillStyle = CYAN;
        ctx.fill();
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, s.left, MX, y + 42, { size: 18, weight: 700, color: MUTED });
        line(ctx, s.right, MX + colA, y + 42, { size: 18, weight: 700, color: MUTED, align: 'right' });
        text(ctx, s.where, 620, y + 30, 330, { size: 25, weight: 700, lh: 1.25, color: INK });
        text(ctx, s.practice, 1000, y + 30, CW - (1000 - MX), { size: 20, lh: 1.5, color: INK });
      });
    });
  }

  function schrijven(ctx, P) {
    const top = head(ctx, P, 'Merk', 'Zo schrijven we.') + 50;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Schrijfregels', MX, top, { color: INK });
      bullets(ctx, C.tone.rules, MX, top + 52, 660, { size: 22, lh: 1.5, color: INK, gap: 1 });
      label(ctx, 'Wel en niet', 840, top, { color: INK });
    });
    let y = top + 56;
    C.tone.examples.forEach((ex, i) => {
      if (i) layer(ctx, 'Vormen', () => rule(ctx, 840, y - 30, 740));
      [[true, ex.wel], [false, ex.niet]].forEach(([ok, str]) => {
        mark(ctx, ok, 840, y - 8, 44);
        let h = 0;
        layer(ctx, 'Tekst', () => {
          h = text(ctx, str, 910, y, 670, { size: 22, lh: 1.45, color: ok ? INK : MUTED, weight: ok ? 600 : 400 });
        });
        y += Math.max(h, 36) + 26;
      });
      y += 40;
    });
  }

  function logoPage(ctx, P, env) {
    const top = head(ctx, P, 'Logo', 'Het logo.') + 30;
    layer(ctx, 'Tekst', () => text(ctx, C.logo.intro, MX, top, 1150, { size: 23, lh: 1.5, color: INK }));
    const y = top + 130;
    const ph = 470;
    const pw = (CW - 40) / 2;
    C.logo.variants.forEach((v, i) => {
      const x = MX + i * (pw + 40);
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = v.id === 'wit' ? INK : CANVAS;
        ctx.fillRect(x, y, pw, ph);
      });
      const lw = 230;
      logo(ctx, env, x + (pw - lw) / 2, y + (ph - lw / T.logo.aspect) / 2, lw, v.color);
      layer(ctx, 'Tekst', () => {
        label(ctx, v.id === 'wit' ? 'Primair · wit' : 'Op licht · Inkt', x, y + ph + 30, { color: INK });
        text(ctx, v.text, x, y + ph + 70, pw, { size: 21, color: INK });
      });
    });
  }

  function clearSpace(ctx, P, env) {
    const top = head(ctx, P, 'Logo', 'Clear space en minimum formaat.') + 50;
    // Het schema: het logo met zijn vrije zone van X = ¼ logobreedte
    const lw = 280;
    const lh = lw / T.logo.aspect;
    const X = lw * T.logo.clearSpace;
    const zone = { w: lw + 2 * X, h: lh + 2 * X };
    const zx = MX + (720 - zone.w) / 2;
    const zy = top + 10;
    const lx = zx + X;
    const ly = zy + X;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = TINT;
      ctx.fillRect(zx, zy, zone.w, zone.h);
      ctx.fillStyle = WHITE;
      ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(zx, zy, zone.w, zone.h);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(lx, ly, lw, lh);
      // X op elke kant: een cyaan zeshoekje in het midden van de vrije strook
      [[lx + lw / 2, zy + X / 2], [lx + lw / 2, ly + lh + X / 2], [zx + X / 2, ly + lh / 2], [lx + lw + X / 2, ly + lh / 2]].forEach(([cx, cy]) => {
        K.hexPath(ctx, cx, cy, 20);
        ctx.fillStyle = CYAN;
        ctx.fill();
      });
    });
    logo(ctx, env, lx, ly, lw, INK, { example: true });
    layer(ctx, 'Tekst', () => {
      [[lx + lw / 2, zy + X / 2], [lx + lw / 2, ly + lh + X / 2], [zx + X / 2, ly + lh / 2], [lx + lw + X / 2, ly + lh / 2]].forEach(([cx, cy]) => {
        line(ctx, 'X', cx, cy + 7, { size: 20, weight: 800, color: INK, align: 'center' });
      });
      line(ctx, 'X = ¼ × logobreedte', MX + 360, zy + zone.h + 56, { size: 24, weight: 700, color: INK, align: 'center' });
    });

    // Rechts: de regel, de minimale maten en 20 mm op ware grootte
    const x = 900;
    const w = W - MX - x;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Clear space', x, top, { color: INK });
      const h = text(ctx, C.logo.clearSpace, x, top + 44, w, { size: 20, lh: 1.5, color: INK });
      let y = top + 44 + h + 50;
      label(ctx, 'Minimum formaat', x, y, { color: INK });
      y += 44;
      C.logo.minimum.forEach((m, i) => {
        line(ctx, m.min, x, y + 30, { size: 30, weight: 800, color: INK });
        line(ctx, m.medium, x + 170, y + 14, { size: 18, weight: 700, color: INK });
        text(ctx, m.why, x + 170, y + 26, w - 170, { size: 16, lh: 1.4, color: MUTED });
        y += i === 2 ? 0 : 92;
      });
    });
    layer(ctx, 'Vormen', () => [1, 2].forEach((i) => rule(ctx, x, top + 44 + plan(ctx, C.logo.clearSpace, w, { size: 20, lh: 1.5 }).height + 50 + 44 + i * 92 - 16, w)));
    // 20 mm op ware grootte, onder het schema
    const real = 20 * MM;
    const ry = zy + zone.h + 100;
    logo(ctx, env, MX, ry, real, INK);
    layer(ctx, 'Tekst', () => {
      label(ctx, '20 mm op ware grootte', MX + real + 40, ry + 20, { color: INK, size: 15 });
      text(ctx, 'Zo klein mag het logo in print. Op een scherm is het minimum 80 px breed.', MX + real + 40, ry + 56, 460, { size: 18, lh: 1.45, color: MUTED });
    });
  }

  // De zes voorbeelden van wat niet mag, elk in een tegel op Inkt
  function logoGebruik(ctx, P, env) {
    const top = head(ctx, P, 'Logo', 'Zo gebruik je het logo.') + 50;
    const colW = 420;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Aangevuld in 2.1', MX, top, { color: WHITE });
      let y = top + 50;
      C.logo.added.forEach((a) => {
        line(ctx, a.title, MX, y + 18, { size: 21, weight: 700, color: CYAN });
        y += 36 + text(ctx, a.text, MX, y + 36, colW, { size: 18, lh: 1.45, color: DIM }) + 30;
      });
    });
    const gx = 600;
    const gap = 32;
    const tw = (W - MX - gx - 2 * gap) / 3;
    const th = 236;
    const tiles = [
      { id: 'achtergrond', title: C.logo.donts[0].title, text: C.logo.donts[0].text },
      { id: 'vervormen', title: C.logo.donts[1].title, text: C.logo.donts[1].text },
      { id: 'eroverheen', title: C.logo.donts[2].title, text: C.logo.donts[2].text },
      { id: 'kleur', title: 'Geen andere kleur', text: 'Alleen wit of Inkt, ook niet in cyaan.' },
      { id: 'kader', title: 'Geen kader om het logo', text: 'Ook niet op een drukke foto.' },
      { id: 'kantelen', title: 'Niet kantelen', text: 'Het logo staat altijd recht.' },
    ];
    tiles.forEach((t, i) => {
      const x = gx + (i % 3) * (tw + gap);
      const y = top + Math.floor(i / 3) * (th + 136);
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = TILE;
        ctx.fillRect(x, y, tw, th);
      });
      const lw = 120;
      const lh = lw / T.logo.aspect;
      const lx = x + (tw - lw) / 2;
      const ly = y + (th - lh) / 2;
      if (t.id === 'achtergrond') {
        layer(ctx, 'Vormen', () => {
          K.hexPath(ctx, lx + lw / 2, ly + lh / 2, lh * 0.62);
          ctx.fillStyle = CYAN;
          ctx.fill();
        });
        logo(ctx, env, lx, ly, lw, WHITE, { example: true });
      } else if (t.id === 'vervormen') {
        logo(ctx, env, lx - lw * 0.35, ly + lh * 0.1, lw, WHITE, { example: true, stretch: 1.7 });
      } else if (t.id === 'eroverheen') {
        logo(ctx, env, lx, ly, lw, WHITE, { example: true });
        layer(ctx, 'Vormen', () => {
          [[lx + lw * 0.88, ly + lh * 0.22, 22], [lx + lw * 0.08, ly + lh * 0.78, 18]].forEach(([cx, cy, r]) => {
            K.hexPath(ctx, cx, cy, r);
            ctx.fillStyle = CYAN;
            ctx.fill();
          });
        });
      } else if (t.id === 'kleur') {
        logo(ctx, env, lx, ly, lw, CYAN, { example: true });
      } else if (t.id === 'kader') {
        photoFrame(ctx, x + 20, y + 20, tw - 40, th - 40, { corner: 'left' });
        layer(ctx, 'Vormen', () => {
          ctx.strokeStyle = WHITE;
          ctx.lineWidth = 3;
          ctx.strokeRect(lx - 14, ly - 14, lw + 28, lh + 28);
        });
        logo(ctx, env, lx, ly, lw, WHITE, { example: true });
      } else if (t.id === 'kantelen') {
        logo(ctx, env, lx, ly, lw, WHITE, { example: true, rotate: -0.26 });
      }
      mark(ctx, false, x + tw - 50, y + 12, 38, true);
      layer(ctx, 'Tekst', () => {
        const h = text(ctx, t.title, x, y + th + 24, tw, { size: 19, weight: 700, lh: 1.25, color: WHITE });
        text(ctx, t.text, x, y + th + 24 + h + 12, tw, { size: 15, lh: 1.4, color: DIM });
      });
    });
  }

  function zeshoek(ctx, P) {
    const top = head(ctx, P, 'Logo', 'De zeshoek.') + 30;
    layer(ctx, 'Tekst', () => text(ctx, C.hexagon.intro, MX, top, 900, { size: 23, lh: 1.5, color: INK }));
    // Links: vier regels, elk met een voorbeeld
    const rows = C.hexagon.rules;
    let y = top + 110;
    const ex = MX;
    const tx = MX + 300;
    rows.forEach((r, i) => {
      const rowTop = y;
      layer(ctx, 'Vormen', () => {
        if (i) rule(ctx, MX, rowTop - 20, 760);
        if (i === 0) {
          K.hexPath(ctx, ex + 50, rowTop + 50, 46);
          ctx.fillStyle = CYAN;
          ctx.fill();
          // Plat liggend: de fout ernaast
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k;
            const px = ex + 190 + 46 * Math.cos(a);
            const py = rowTop + 50 + 46 * Math.sin(a);
            if (k) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = '#C5CED6';
          ctx.fill();
        }
        if (i === 3) {
          // Fout: witte zeshoek met een rand op wit; goed: wit op Inkt
          K.hexPath(ctx, ex + 50, rowTop + 50, 40);
          ctx.fillStyle = WHITE;
          ctx.fill();
          ctx.strokeStyle = '#8A949E';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = INK;
          ctx.fillRect(ex + 136, rowTop, 110, 100);
          K.hexPath(ctx, ex + 191, rowTop + 50, 40);
          ctx.fillStyle = WHITE;
          ctx.fill();
        }
      });
      if (i === 1) {
        ['cyaan', 'donker', 'magenta'].forEach((p, k) => hexIcon(ctx, 'lightbulb', ex + k * 64, rowTop + 18, 64, p));
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = INK;
          ctx.fillRect(ex + 186, rowTop + 6, 76, 88);
        });
        hexIcon(ctx, 'lightbulb', ex + 196, rowTop + 18, 64, 'wit');
      }
      if (i === 0) mark(ctx, false, ex + 222, rowTop + 64, 34);
      if (i === 2) mark(ctx, false, ex + 30, rowTop + 22, 56);
      if (i === 3) mark(ctx, false, ex + 76, rowTop + 64, 34);
      let h = 0;
      layer(ctx, 'Tekst', () => {
        h = text(ctx, r.text, tx, rowTop + 18, 460, { size: 20, weight: r.ok ? 600 : 400, lh: 1.45, color: INK });
      });
      y = rowTop + Math.max(100, h + 20) + 40;
    });

    // Rechts: vier toepassingen in een raster van twee bij twee
    const gx = 940;
    const gw = (W - MX - gx - 40) / 2;
    const gh = 300;
    C.hexagon.uses.forEach((u, i) => {
      const x = gx + (i % 2) * (gw + 40);
      const yy = top + 110 + Math.floor(i / 2) * (gh + 40);
      const vy = yy;
      if (u.id === 'bullet') {
        layer(ctx, 'Tekst', () => {
          bullets(ctx, ['Korte zinnen', 'Eén gedachte per zin', 'Knoppen in kleine letters'], x, vy + 6, gw, { size: 20, color: INK, gap: 0.5 });
        });
      } else if (u.id === 'frame') {
        const r = 62;
        const cx = x + 80;
        const cy = vy + 70;
        layer(ctx, 'Vormen', () => K.hexEcho(ctx, cx, cy, r, 4));
        layer(ctx, 'Beeld', () => {
          K.hexPath(ctx, cx, cy, r);
          ctx.fillStyle = PHOTO;
          ctx.fill();
        });
        looseIcon(ctx, 'image', cx - 18, cy - 18, 36, '#9AA6B1');
      } else if (u.id === 'holder') {
        hexIcon(ctx, 'line-chart', x, vy, 128, 'cyaan');
      } else if (u.id === 'pattern') {
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = INK;
          ctx.fillRect(x, vy, gw, 140);
          pattern(ctx, x + 8, vy + 4, gw - 16, 132, { r: 22, whole: true, lw: 1.5, color: '#4A4A4A' });
        });
      }
      layer(ctx, 'Tekst', () => {
        line(ctx, u.title, x, vy + 176, { size: 20, weight: 700, color: INK });
        text(ctx, u.text, x, vy + 196, gw, { size: 16, lh: 1.45, color: MUTED });
      });
    });
  }

  function kleuren(ctx, P) {
    const top = head(ctx, P, 'Kleur', 'Kleuren.') + 30;
    layer(ctx, 'Tekst', () => text(ctx, C.colors.intro, MX, top, 1200, { size: 22, lh: 1.5, color: INK }));
    const y = top + 90;
    const gap = 36;
    const w = (CW - 2 * gap) / 3;
    const sh = 200;
    T.colors.primary.forEach((c, i) => {
      const x = MX + i * (w + gap);
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = c.hex;
        ctx.fillRect(x, y, w, sh);
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, c.name, x + 24, y + sh - 26, { size: 26, weight: 700, color: M.readable(c.hex) });
        const vals = [['HEX', c.hex], ['RGB', c.rgb.join(', ')], ['CMYK', c.cmyk.join(', ')]];
        vals.forEach(([k, v], j) => {
          line(ctx, k, x, y + sh + 40 + j * 32, { size: 15, weight: 700, color: MUTED, track: 0.1 });
          line(ctx, v, x + 76, y + sh + 40 + j * 32, { size: 20, weight: 600, color: INK });
        });
        text(ctx, c.role, x, y + sh + 136, w, { size: 18, lh: 1.4, color: MUTED });
      });
    });
    const y2 = y + sh + 196;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Secundaire kleuren', MX, y2, { color: INK });
      text(ctx, C.colors.secondaryRule, MX + 330, y2 - 4, CW - 330, { size: 17, lh: 1.4, color: MUTED });
    });
    const g2 = 30;
    const w2 = (CW - 3 * g2) / 4;
    const y3 = y2 + 56;
    T.colors.secondary.forEach((c, i) => {
      const x = MX + i * (w2 + g2);
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = c.hex;
        ctx.fillRect(x, y3, w2, 74);
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, c.name, x + 18, y3 + 46, { size: 20, weight: 700, color: M.readable(c.hex) });
        [['HEX', c.hex], ['RGB', c.rgb.join(', ')], ['CMYK', c.cmyk.join(', ')]].forEach(([k, v], j) => {
          line(ctx, k, x, y3 + 104 + j * 26, { size: 13, weight: 700, color: MUTED, track: 0.1 });
          line(ctx, v, x + 62, y3 + 104 + j * 26, { size: 16, weight: 600, color: INK });
        });
      });
    });
  }

  // De 60/30/10-balk: wit of Inkt, cyaan en magenta in hun verhouding
  function ratioParts(mode) {
    const P = C.colors.ratioParts;
    return [
      { name: mode === 'donker' ? P.neutralDark : P.neutral, hex: mode === 'donker' ? INK : WHITE, p: T.ratio.neutral },
      { name: P.cyaan, hex: CYAN, p: T.ratio.cyaan },
      { name: P.accent, hex: MAGENTA, p: T.ratio.accent },
    ];
  }

  function ratio(ctx, x, y, w, mode, h = 56) {
    let cx = x;
    const parts = ratioParts(mode);
    layer(ctx, 'Vormen', () => {
      parts.forEach((p) => {
        const pw = (w * p.p) / 100;
        ctx.fillStyle = p.hex;
        ctx.fillRect(cx, y, pw, h);
        cx += pw;
      });
      ctx.strokeStyle = mode === 'donker' ? INK : '#C5CED6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    });
    cx = x;
    layer(ctx, 'Tekst', () => {
      parts.forEach((p) => {
        const pw = (w * p.p) / 100;
        line(ctx, `${p.p}%`, cx + 14, y + h / 2 + 8, { size: Math.round(h * 0.42), weight: 800, color: M.readable(p.hex) });
        cx += pw;
      });
    });
  }

  // De namen onder de balk, links uitgelijnd per deel (het laatste deel rechts)
  function ratioNames(ctx, x, y, w, mode, color) {
    let cx = x;
    const parts = ratioParts(mode);
    layer(ctx, 'Tekst', () => {
      parts.forEach((p, i) => {
        const last = i === parts.length - 1;
        line(ctx, p.name, last ? x + w : cx, y, { size: 15, weight: 600, color, align: last ? 'right' : 'left' });
        cx += (w * p.p) / 100;
      });
    });
  }

  // Een compositie in de verhouding: vlak, cyaan blok met zeshoeken, magenta knop
  function composition(ctx, x, y, w, h, mode) {
    const dark = mode === 'donker';
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = dark ? INK : WHITE;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, y, w, h * 0.04);
      ctx.fillRect(x + w * 0.62, y + h * 0.04, w * 0.38, h * 0.62);
      // tekstregels als balkjes
      ctx.fillStyle = dark ? WHITE : INK;
      ctx.fillRect(x + w * 0.07, y + h * 0.2, w * 0.42, h * 0.07);
      ctx.fillStyle = dark ? '#6A6A6A' : '#C5CED6';
      [0.36, 0.45, 0.54].forEach((f, i) => ctx.fillRect(x + w * 0.07, y + h * f, w * (i === 2 ? 0.3 : 0.46), h * 0.035));
      ctx.fillStyle = MAGENTA;
      ctx.fillRect(x + w * 0.07, y + h * 0.7, w * 0.22, h * 0.12);
      K.hexPath(ctx, x + w * 0.81, y + h * 0.35, h * 0.16);
      ctx.fillStyle = dark ? INK : WHITE;
      ctx.fill();
      if (!dark) {
        ctx.strokeStyle = '#C5CED6';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);
      }
    });
  }

  function kleurToepassen(ctx, P) {
    const top = head(ctx, P, 'Kleur', '60/30/10 en contrast.') + 50;
    const lw = 700;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'De 60/30/10-regel', MX, top, { color: INK });
      text(ctx, C.colors.ratio, MX, top + 44, lw, { size: 20, lh: 1.5, color: INK });
    });
    let y = top + 170;
    ['licht', 'donker'].forEach((mode) => {
      layer(ctx, 'Tekst', () => line(ctx, mode === 'licht' ? 'Lichte compositie' : 'Donkere compositie', MX, y, { size: 18, weight: 700, color: INK }));
      ratio(ctx, MX, y + 16, lw, mode, 52);
      ratioNames(ctx, MX, y + 96, lw, mode, MUTED);
      y += 140;
    });
    const cw = (lw - 30) / 2;
    composition(ctx, MX, y, cw, cw * 0.5625, 'licht');
    composition(ctx, MX + cw + 30, y, cw, cw * 0.5625, 'donker');

    // Rechts: de contrasttabel, uitgerekend met model.js
    const x = 900;
    const w = W - MX - x;
    const cols = [x, x + 330, x + 470, x + 580];
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Contrast (WCAG 2.1)', x, top, { color: INK });
      ['Combinatie', 'Contrast', 'Tekst', 'Groot'].forEach((h, i) => line(ctx, h, cols[i] + (i === 0 ? 76 : 0), top + 72, { size: 15, weight: 700, color: MUTED, track: 0.06 }));
    });
    const rh = 56;
    C.colors.contrast.forEach(([fg, bg, name], i) => {
      const ry = top + 90 + i * rh;
      const n = M.contrast(hex(fg), hex(bg));
      const v = M.verdict(n);
      layer(ctx, 'Vormen', () => {
        rule(ctx, x, ry, w, LINE, 1.5);
        ctx.fillStyle = hex(bg);
        ctx.fillRect(x, ry + 9, 60, 38);
        if (bg === 'wit') {
          ctx.strokeStyle = '#C5CED6';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x, ry + 9, 60, 38);
        }
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, 'Aa', x + 30, ry + 36, { size: 20, weight: 800, color: hex(fg), align: 'center' });
        line(ctx, name, cols[0] + 76, ry + 36, { size: 19, weight: 600, color: INK });
        line(ctx, M.ratioText(n), cols[1], ry + 36, { size: 19, weight: 700, color: INK });
        line(ctx, v.text ? 'ja' : 'nee', cols[2], ry + 36, { size: 19, weight: v.text ? 700 : 400, color: v.text ? INK : MUTED });
        line(ctx, v.large ? 'ja' : 'nee', cols[3], ry + 36, { size: 19, weight: v.large ? 700 : 400, color: v.large ? INK : MUTED });
      });
    });
    layer(ctx, 'Tekst', () => {
      text(ctx, C.colors.contrastNote, x, top + 90 + C.colors.contrast.length * rh + 30, w - 20, { size: 17, lh: 1.45, color: MUTED });
    });
  }

  function typografie(ctx, P) {
    const top = head(ctx, P, 'Type', 'Typografie.') + 50;
    const lw = 620;
    layer(ctx, 'Tekst', () => {
      line(ctx, 'Aa', MX - 8, top + 190, { size: 250, weight: 800, color: INK, track: -0.02 });
      line(ctx, T.font.family, MX, top + 262, { size: 36, weight: 700, color: INK });
      text(ctx, C.type.intro, MX, top + 292, lw, { size: 20, lh: 1.5, color: MUTED });
      line(ctx, C.type.alphabet, MX, top + 418, { size: 22, weight: 400, color: INK, track: 0.08 });
      line(ctx, C.type.lower, MX, top + 452, { size: 22, weight: 400, color: INK, track: 0.08 });
      line(ctx, C.type.digits, MX, top + 486, { size: 22, weight: 400, color: INK, track: 0.08 });
      label(ctx, 'Gewichten', MX, top + 540, { color: INK });
      const cw = lw / T.font.weights.length;
      T.font.weights.forEach((wt, i) => {
        const x = MX + i * cw;
        line(ctx, 'Aa', x, top + 630, { size: 50, weight: wt.weight, color: INK });
        line(ctx, wt.name, x, top + 664, { size: 16, weight: 700, color: INK });
        line(ctx, String(wt.weight), x, top + 688, { size: 16, color: MUTED });
      });
    });

    // Rechts: de typeschaal, elke stijl in zijn eigen maat
    const x = 800;
    const w = W - MX - x;
    const sx = x + 430;
    layer(ctx, 'Tekst', () => label(ctx, 'Hiërarchie', x, top, { color: INK }));
    let y = top + 44;
    T.type.forEach((t) => {
      const rowH = Math.max(66, t.line + 36);
      layer(ctx, 'Vormen', () => rule(ctx, x, y, w, LINE, 1.5));
      const name = t.upper ? t.name.toUpperCase() : t.name;
      const wName = T.font.weights.find((f) => f.weight === t.weight).name;
      layer(ctx, 'Tekst', () => {
        line(ctx, name, x, y + 14 + t.size * CAP + (rowH - 14 - t.size * CAP) / 2 - 4, { size: t.size, weight: t.weight, color: t.color || INK, track: t.track });
        line(ctx, `${wName} ${t.weight} · ${t.size}/${t.line}${t.track ? ` · ${t.track > 0 ? '+' : '−'}${Math.abs(t.track * 100)}%` : ''}`, sx, y + rowH / 2 + 2, { size: 16, weight: 700, color: INK });
        line(ctx, C.type.usage[t.id], sx, y + rowH / 2 + 24, { size: 15, color: MUTED });
      });
      y += rowH;
    });
    layer(ctx, 'Tekst', () => bullets(ctx, C.type.notes, x, y + 40, w, { size: 18, lh: 1.45, color: INK, gap: 0.7 }));
  }

  // Drie kaders die de opbouw van een foto laten zien, zonder foto
  function imageFrame(ctx, f, x, y, w, h) {
    photoFrame(ctx, x, y, w, h);
    if (f.id === 'compositie') {
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = '#4C5A67';
        [1, 2].forEach((k) => {
          ctx.fillRect(x + (w * k) / 3 - 1, y, 2, h);
          ctx.fillRect(x, y + (h * k) / 3 - 1, w, 2);
        });
        K.hexPath(ctx, x + (w * 2) / 3, y + h * 0.55, h * 0.22);
        ctx.fillStyle = '#6F7E8B';
        ctx.fill();
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, 'ruimte voor', x + 28, y + h * 0.42, { size: 22, weight: 800, color: WHITE });
        line(ctx, 'de kop', x + 28, y + h * 0.42 + 28, { size: 22, weight: 800, color: WHITE });
      });
    } else if (f.id === 'tekst') {
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = INK;
        ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
      });
      layer(ctx, 'Tekst', () => {
        text(ctx, 'Onze nieuwe **Ads-audit** is live.', x + 28, y + h * 0.62, w - 56, { size: 26, weight: 800, emWeight: 800, lh: 1.15, color: WHITE, em: CYAN });
      });
    } else {
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = INK;
        ctx.fillRect(x + 24, y + h - 92, w - 48, 68);
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, '+184%', x + 44, y + h - 40, { size: 38, weight: 800, color: CYAN });
        text(ctx, 'meer aanvragen in drie maanden', x + 220, y + h - 70, w - 270, { size: 15, lh: 1.3, color: WHITE });
      });
    }
  }

  function beeldtaal(ctx, P) {
    const top = head(ctx, P, 'Beeld', 'Beeldtaal en fotografie.') + 26;
    layer(ctx, 'Tekst', () => text(ctx, C.imagery.intro, MX, top, CW, { size: 20, lh: 1.45, color: DIM }));
    const gap = 36;
    const fw = (CW - 2 * gap) / 3;
    const fy = top + 90;
    const fh = 220;
    C.imagery.frames.forEach((f, i) => {
      const x = MX + i * (fw + gap);
      imageFrame(ctx, f, x, fy, fw, fh);
      layer(ctx, 'Tekst', () => {
        line(ctx, f.title, x, fy + fh + 30, { size: 18, weight: 700, color: WHITE });
        line(ctx, f.text, x + ctx.measureText(f.title).width + 12, fy + fh + 30, { size: 16, color: DIM });
      });
    });
    const sy = fy + fh + 84;
    const g2 = 32;
    const sw = (CW - 3 * g2) / 4;
    C.imagery.sections.forEach((s, i) => {
      const x = MX + i * (sw + g2);
      layer(ctx, 'Tekst', () => {
        line(ctx, s.title, x, sy + 15, { size: 20, weight: 700, color: CYAN });
        bullets(ctx, s.items, x, sy + 44, sw, { size: 17, lh: 1.42, color: WHITE, gap: 0.5 });
      });
    });
  }

  function iconen(ctx, P) {
    const top = head(ctx, P, 'Iconen', 'Iconen.') + 30;
    layer(ctx, 'Tekst', () => text(ctx, C.icons.intro, MX, top, 900, { size: 21, lh: 1.5, color: INK }));
    const names = C.icons.sample;
    let y = top + 140;
    const ix = MX + 280;
    const ih = 62;
    const step = 82;
    C.icons.variants.forEach((v) => {
      if (v.preset === 'wit') {
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = INK;
          ctx.fillRect(ix - 20, y - 14, names.length * step + 22, ih + 28);
        });
      }
      names.forEach((n, k) => hexIcon(ctx, n, ix + k * step, y, ih, v.preset));
      layer(ctx, 'Tekst', () => {
        line(ctx, v.name, MX, y + 26, { size: 20, weight: 700, color: INK });
        line(ctx, v.sub, MX, y + 52, { size: 15, color: MUTED });
      });
      y += 104;
    });
    // Los, in de vijf huiskleuren
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = INK;
      ctx.fillRect(ix + 4 * step - 14, y - 10, 70, 64);
    });
    C.icons.loose.forEach((id, k) => looseIcon(ctx, names[k], ix + k * step + 4, y, 44, hex(id)));
    layer(ctx, 'Tekst', () => {
      line(ctx, 'Los', MX, y + 22, { size: 20, weight: 700, color: INK });
      line(ctx, 'Inkt, cyaan, blauw, magenta, wit', MX, y + 48, { size: 15, color: MUTED });
    });

    const x = 1020;
    const w = W - MX - x;
    let rh = 0;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Regels', x, top + 140, { color: INK });
      rh = bullets(ctx, C.icons.rules, x, top + 186, w, { size: 19, lh: 1.45, color: INK, gap: 0.6 });
    });
    // Waar je ze vindt: de Icon Finder in de Generator Hub
    const by = top + 186 + rh + 50;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = TINT;
      ctx.fillRect(x, by, w, 104);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, by, 6, 104);
    });
    hexIcon(ctx, 'search', x + 30, by + 22, 60, 'cyaan');
    layer(ctx, 'Tekst', () => {
      line(ctx, 'Icon Finder', x + 112, by + 44, { size: 21, weight: 700, color: INK });
      line(ctx, 'Generator Hub · tools/icons.html', x + 112, by + 74, { size: 17, color: MUTED });
    });
  }

  // Een ontwerp in het klein: vlak, cyaan balk, tekstbalkjes en de plek van het logo
  function miniDesign(ctx, x, y, w, h, kind) {
    const dark = kind !== 'document';
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = dark ? '#262626' : WHITE;
      ctx.fillRect(x, y, w, h);
      if (kind === 'foto' || kind === 'tekst') {
        ctx.fillStyle = PHOTO;
        ctx.fillRect(x, y, w, kind === 'foto' ? h : h * 0.62);
      }
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, y, w, Math.max(3, h * 0.025));
      const u = w / 10;
      if (kind !== 'foto') {
        ctx.fillStyle = dark ? WHITE : INK;
        ctx.fillRect(x + u, y + h * (kind === 'tekst' ? 0.68 : 0.22), u * 6, h * 0.05);
        ctx.fillStyle = dark ? '#6A6A6A' : '#C5CED6';
        [0.33, 0.4, 0.47].forEach((f, i) => {
          if (kind === 'tekst') return;
          ctx.fillRect(x + u, y + h * f, u * (i === 2 ? 4 : 7), h * 0.022);
        });
      }
      if (kind === 'blog' || kind === 'carousel') {
        ctx.fillStyle = MAGENTA;
        ctx.fillRect(x + u, y + h * 0.6, u * 3, h * 0.06);
      }
      if (kind === 'case') {
        ctx.fillStyle = CYAN;
        ctx.fillRect(x + u, y + h * 0.6, u * 4, h * 0.08);
      }
      if (kind === 'slide') {
        ctx.fillStyle = '#6A6A6A';
        ctx.fillRect(x + u * 6, y + h * 0.22, u * 3, h * 0.5);
      }
      // De plek van het logo: een lijn-zeshoekje rechtsonder (rechtsboven op het briefpapier)
      const r = Math.min(w, h) * 0.06;
      const lx = x + w - r * 2.2;
      const ly = kind === 'document' ? y + r * 2.6 : y + h - r * 2.2;
      K.hexPath(ctx, lx, ly, r);
      ctx.strokeStyle = dark ? WHITE : INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  function toepassingen(ctx, P, env) {
    const top = head(ctx, P, 'Gebruik', 'Toepassingen.') + 30;
    layer(ctx, 'Tekst', () => text(ctx, C.usage.intro, MX, top, 1100, { size: 21, lh: 1.5, color: DIM }));
    const gap = 48;
    // Kolommen naar wat erin staat: vijf posts, één A4, één slide
    const cols = [640, 300, CW - 640 - 300 - 2 * gap];
    const y = top + 90;
    const vh = 190;
    let x = MX;
    C.usage.makers.forEach((m, i) => {
      const cw = cols[i];
      if (m.id === 'insta') {
        const fw = (cw - 4 * 14) / 5;
        ['foto', 'tekst', 'blog', 'case', 'carousel'].forEach((k, j) => miniDesign(ctx, x + j * (fw + 14), y + vh - fw * 1.25, fw, fw * 1.25, k));
      } else if (m.id === 'document') {
        miniDesign(ctx, x, y, vh / 1.414, vh, 'document');
      } else {
        miniDesign(ctx, x, y + vh - 180, 320, 180, 'slide');
      }
      layer(ctx, 'Tekst', () => {
        line(ctx, m.name, x, y + vh + 46, { size: 23, weight: 700, color: WHITE });
        line(ctx, m.tool, x, y + vh + 74, { size: 15, weight: 700, color: CYAN, track: 0.04 });
        text(ctx, m.text, x, y + vh + 94, cw, { size: 17, lh: 1.45, color: DIM });
      });
      x += cw + gap;
    });
    // De Emerce 100-badge: wit op donker, zwart op licht
    const by = y + vh + 250;
    layer(ctx, 'Vormen', () => {
      rule(ctx, MX, by - 34, 1290, '#4A4A4A', 2);
      ctx.fillStyle = WHITE;
      ctx.fillRect(MX + 300, by, 290, 150);
    });
    if (env && env.badgeWhite) layer(ctx, 'Beeld', () => SVG.draw(ctx, env.badgeWhite, { x: MX, y: by + 25, w: 260, h: 100 }));
    if (env && env.badgeBlack) layer(ctx, 'Beeld', () => SVG.draw(ctx, env.badgeBlack, { x: MX + 315, y: by + 25, w: 260, h: 100 }));
    layer(ctx, 'Tekst', () => {
      const bx = MX + 650;
      line(ctx, C.usage.badge.title, bx, by + 18, { size: 23, weight: 700, color: WHITE });
      const h = text(ctx, C.usage.badge.intro, bx, by + 40, 640, { size: 17, lh: 1.45, color: DIM });
      bullets(ctx, C.usage.badge.rules, bx, by + 40 + h + 22, 640, { size: 17, lh: 1.4, color: WHITE, gap: 0.4 });
    });
  }

  function colofon(ctx, P, env) {
    const w = 230;
    const h = w / T.logo.aspect;
    logo(ctx, env, (W - w) / 2, 150, w, WHITE);
    layer(ctx, 'Tekst', () => {
      text(ctx, C.company, MX, 150 + h + 70, CW, { size: 48, weight: 800, track: -0.01, lh: 1.1, color: WHITE, dot: true, align: 'center' });
      line(ctx, C.slogan, W / 2, 150 + h + 170, { size: 26, color: DIM, align: 'center', italic: true });
      let x = W / 2 - 92;
      [['pureminds', WHITE], ['.', CYAN], ['nl', WHITE]].forEach(([part, color]) => {
        x += line(ctx, part, x, 150 + h + 230, { size: 30, weight: 700, color, track: 0.02 });
      });
    });
    const y = 820;
    layer(ctx, 'Vormen', () => rule(ctx, MX, y - 30, CW, '#4A4A4A', 2));
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Colofon', MX, y, { color: WHITE });
      let yy = y + 40;
      C.colophon.lines.forEach((l) => {
        yy += text(ctx, l, MX, yy, 640, { size: 16, lh: 1.45, color: DIM }) + 10;
      });
      label(ctx, 'Nieuw in 2.1', 860, y, { color: WHITE });
      const half = Math.ceil(C.colophon.news.length / 2);
      bullets(ctx, C.colophon.news.slice(0, half), 860, y + 40, 330, { size: 16, lh: 1.4, color: WHITE, gap: 0.35 });
      bullets(ctx, C.colophon.news.slice(half), 1230, y + 40, 350, { size: 16, lh: 1.4, color: WHITE, gap: 0.35 });
    });
  }

  /* ---------------------------------------------------------------------------
     Register: volgorde en hoofdstuk uit content.js, het tekenwerk hier
     ------------------------------------------------------------------------- */

  const DRAW = {
    cover: { fn: cover, dark: true, pattern: true, logo: true },
    inhoud: { fn: inhoud },
    'missie-visie': { fn: missieVisie, dark: true, pattern: true },
    kernwaarden: { fn: kernwaarden },
    'tone-of-voice': { fn: toneOfVoice },
    schrijven: { fn: schrijven },
    logo: { fn: logoPage, logo: true },
    'clear-space': { fn: clearSpace, logo: true },
    'logo-gebruik': { fn: logoGebruik, dark: true, logo: true },
    zeshoek: { fn: zeshoek },
    kleuren: { fn: kleuren },
    'kleur-toepassen': { fn: kleurToepassen },
    typografie: { fn: typografie },
    beeldtaal: { fn: beeldtaal, dark: true },
    iconen: { fn: iconen },
    toepassingen: { fn: toepassingen, dark: true },
    colofon: { fn: colofon, dark: true, pattern: true, logo: true },
  };

  const PAGES = C.pages.map((p, index) => ({
    ...p, index, dark: !!(DRAW[p.id] && DRAW[p.id].dark), pattern: !!(DRAW[p.id] && DRAW[p.id].pattern), logo: !!(DRAW[p.id] && DRAW[p.id].logo),
  }));

  function draw(ctx, i, env = {}) {
    const P = PAGES[i];
    const spec = DRAW[P.id];
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    background(ctx, P);
    spec.fn(ctx, P, env);
    chrome(ctx, P, env);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Op het podium: het canvas op schaal (1 = 1684 px breed)
  function render(canvas, i, env = {}, scale = 1) {
    const ctx = K.prepare(canvas, W, H, scale);
    const boxes = [];
    draw(ctx, i, { ...env, boxes });
    if (env.overlay) overlay(ctx, boxes);
    return boxes;
  }

  // Clear space om elk logo: de vrije zone in doorzichtig cyaan, met een rand (alleen op het scherm)
  function overlay(ctx, boxes) {
    for (const b of boxes) {
      const X = b.w * T.logo.clearSpace;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x - X, b.y - X, b.w + 2 * X, b.h + 2 * X);
      ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(26, 185, 226, .28)';
      ctx.fill('evenodd');
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = Math.max(2, b.w / 80);
      ctx.strokeRect(b.x - X, b.y - X, b.w + 2 * X, b.h + 2 * X);
      const size = Math.max(14, X * 0.5);
      font(ctx, 800, size);
      ctx.fillStyle = CYAN;
      ctx.textAlign = 'center';
      ctx.fillText('X', b.x + b.w / 2, b.y - X / 2 + (size * CAP) / 2);
      ctx.restore();
    }
  }

  global.PMStyleguide = {
    W, H, LAYERS, MM, pages: PAGES, chapters: C.chapters, draw, render, overlay, ratio, ratioParts, composition,
  };
})(window);
