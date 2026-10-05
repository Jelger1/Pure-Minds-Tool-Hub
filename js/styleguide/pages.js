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

   Beelden alleen via raster(): een foto of een echte post of slide uit een maker
   (env.raster, js/styleguide/mockups.js), in de PDF één afbeelding in de laag
   Beeld. Het verloop van Inkt onder tekst op een foto zit in dat beeld gebakken;
   de tekst erop is echte tekst, erna getekend. Zolang een beeld er niet is (en in
   de tests zonder browser) staat er het lege fotovlak.

   Lagen: elk blok zit in een laag (Achtergrond, Vormen, Tekst, Logo, Beeld).
   Op het scherm doet dat niets; in de PDF worden het lagen (OCG).

   Kleuren: de huiskleuren uit brand-tokens.js, plus een vaste set neutrale
   grijzen voor lijnen en vlakjes (NEUTRALS). Een witte vorm krijgt nooit een
   rand: hij staat op Inkt, op een gekleurd of op een licht vlak (CANVAS).

     PMStyleguide.W, H, LAYERS, CANVAS, NEUTRALS
     PMStyleguide.pages              [{ id, chapter, title, dark, index }]
     PMStyleguide.draw(ctx, i, env)  pagina i tekenen
     PMStyleguide.render(canvas, i, env, scale)   op een canvas, op schaal
     PMStyleguide.ratio(ctx, x, y, w, mode)       de 60/30/10-balk (ook het paneel)
     PMStyleguide.composition(ctx, x, y, w, h, mode)  een lichte of donkere compositie
     PMStyleguide.overlay(ctx, boxes)             clear space om elk logo (alleen podium)

   env: { logo, badgeWhite, badgeBlack (geparste SVG's), raster(id, w, h) (een
   canvas van dat beeld, of null zolang het laadt), boxes: [] (vult zich met de
   plek van elk logo, voor de clear-space-laag) }
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
  // Niet-merkkleuren, alle effen grijs of blauwgrijs: lijnen, vlakjes en de lege fotovlakken.
  // De test (tests/styleguide.test.js) laat in de PDF alleen deze en de huiskleuren toe.
  // Lijnen en lichte vlakken zijn gelijk aan css/global.css
  const LINE = '#E1E7EC';          // lijn op wit (--pm-line)
  const CANVAS = '#EDF3F7';        // licht vlak (--pm-canvas): het logo op licht, het voorbeeld van 60/30/10
  const TINT = '#E8F7FC';          // cyaan tint (--pm-tint)
  const TRACK = '#C5CED6';         // schuifbalk, tekstbalkjes en fout-voorbeelden op licht
  const EDGE = '#8A949E';          // de rand om een witte zeshoek, alleen als fout-voorbeeld
  // Op Inkt: wit op 75% (tekst) en 6% (zeshoekpatroon), als effen kleur gemengd
  const DIM = '#CACACA';
  const PATTERN = '#3C3C3C';
  const TILE = '#3B3B3B';          // iets lichter vlak op Inkt (tegels)
  const RULE_DARK = '#4A4A4A';     // lijn op Inkt
  const BAR_DARK = '#6A6A6A';      // tekstbalkjes in de donkere compositie van 60/30/10
  // Het lege fotovlak, zolang een foto laadt (of als hij niet laadt)
  const PHOTO = '#3A4652';         // het lege fotovlak uit de makers (canvas-kit)
  const PHOTO_DARK = '#262D35';    // de donkere onderkant van een foto, onder tekst op beeld
  const PHOTO_LINE = '#4C5A67';    // hulplijnen op een foto
  const PHOTO_SUBJECT = '#6F7E8B'; // het onderwerp op een foto
  const PHOTO_ICON = '#7D8A96';    // het beeldicoon op een fotovlak
  const NEUTRALS = [LINE, CANVAS, TINT, TRACK, EDGE, DIM, PATTERN, TILE, RULE_DARK, BAR_DARK, PHOTO, PHOTO_DARK, PHOTO_LINE, PHOTO_SUBJECT, PHOTO_ICON];

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
  const keep = (str) => String(str).replace(/€ (?=\d)/g, '€\u00A0');

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

  // Iconen via de zeshoek van de Icon Finder (js/icons/hex.js), één keer omgezet per variant.
  // Uitgesneden in de witte zeshoek de volle stijl (Fill), net als in de Icon Finder; style
  // 'line' alleen voor het fout-voorbeeld. Bij check en close zijn beide stijlen gelijk
  const iconCache = new Map();
  function iconSvg(name, opts, style) {
    const icon = C.iconPaths[name];
    const fill = opts.shape === 'hex' && opts.knockout && style !== 'line' && icon.fill;
    const key = `${name}|${fill ? 'fill' : 'line'}|${JSON.stringify(opts)}`;
    if (!iconCache.has(key)) iconCache.set(key, SVG.parseSvg(global.PMHex.svg(fill || icon.d, opts)));
    return iconCache.get(key);
  }

  // Icoon in een afgeronde zeshoek, h hoog (de breedte volgt de vorm)
  function hexIcon(ctx, name, x, y, h, preset, style) {
    const opts = { shape: 'hex', ...global.PMHex.presets[preset] };
    const w = (h * global.PMHex.WIDTH) / global.PMHex.HEIGHT;
    layer(ctx, 'Beeld', () => SVG.draw(ctx, iconSvg(name, opts, style), { x, y, w, h }));
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
    looseIcon(ctx, 'image', corner === 'right' ? x + w - s - 16 : x + 14, corner === 'right' ? y + 16 : y + h - s - 14, s, PHOTO_ICON);
  }

  // Een foto of een echt ontwerp uit een maker (env.raster): in de PDF één afbeelding in de
  // laag Beeld. Zolang het beeld er niet is het lege fotovlak (fallback). De enige drawImage
  // in de pagina's; geeft terug of het beeld er stond
  function raster(ctx, env, id, x, y, w, h, fallback = () => photoFrame(ctx, x, y, w, h)) {
    const img = env && env.raster ? env.raster(id, w, h) : null;
    if (img) layer(ctx, 'Beeld', () => ctx.drawImage(img, x, y, w, h));
    else fallback();
    return !!img;
  }

  // Uitleg in een cyaan getint vlak met een cyaan balk links (zoals de Icon Finder op Iconen)
  function explainBox(ctx, x, y, w, h) {
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = TINT;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, y, 6, h);
    });
  }

  /* ---------------------------------------------------------------------------
     Pagina: achtergrond, kop, voet en logo
     ------------------------------------------------------------------------- */

  const pal = (dark) => (dark ? { text: WHITE, sub: DIM, label: WHITE } : { text: INK, sub: MUTED, label: INK });

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
  // Tekst en vlakken rechts onderaan blijven links van de clear space van dat logo
  const SAFE_RIGHT = LOGO_BOX.x - LOGO_W * T.logo.clearSpace;
  // Het uitlegvlak onderaan Kleur en Typografie: van de marge tot vóór de clear space. Op
  // Typografie iets hoger (zelfde onderkant): de uitleg per maat loopt daar over vier regels
  const EXPLAIN = { x: MX, y: 930, w: SAFE_RIGHT - 26 - MX, h: 146 };
  const LEGEND = { ...EXPLAIN, y: EXPLAIN.y + EXPLAIN.h - 170, h: 170 };
  const LEGEND_COL = 470;                       // waar de drie kolommen van de type-uitleg beginnen

  // Cyaan balk, voetregel en het logo rechtsonder (niet op een pagina die zelf een logo toont).
  // De voet is tijdloos: alleen het webadres en het paginanummer (de inhoud verwijst ernaar)
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
      // Bold cursief: zo zijn scherm en PDF gelijk (BoldItalic)
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
        text(ctx, v.sound, x, yy + 42, w, { size: 22, weight: 700, lh: 1.5, color: INK });
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
        rule(ctx, MX, y + 64, colA, TRACK, 3);
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
          h = text(ctx, str, 910, y, 670, { size: 22, lh: 1.45, color: ok ? INK : MUTED, weight: ok ? 700 : 400 });
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
      // De vrije zone in cyaan tint met een cyaan rand; het vak van het logo wit, zonder rand (de tint eromheen begrenst het)
      ctx.fillStyle = TINT;
      ctx.fillRect(zx, zy, zone.w, zone.h);
      ctx.fillStyle = WHITE;
      ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(zx, zy, zone.w, zone.h);
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
      label(ctx, 'Vuistregels', MX, top, { color: WHITE });
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
    // Elk voorbeeld tekent zijn fout zelf (op id); de teksten staan in content.js
    C.logo.donts.forEach((t, i) => {
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
        // Een drukke, echte foto: juist daar is een kader verleidelijk
        raster(ctx, env, 'logo-kader', x + 20, y + 20, tw - 40, th - 40, () => photoFrame(ctx, x + 20, y + 20, tw - 40, th - 40, { corner: 'left' }));
        layer(ctx, 'Vormen', () => {
          ctx.strokeStyle = WHITE;
          ctx.lineWidth = 3;
          ctx.strokeRect(lx - 14, ly - 14, lw + 28, lh + 28);
        });
        logo(ctx, env, lx, ly, lw, WHITE, { example: true });
      } else if (t.id === 'kantelen') {
        logo(ctx, env, lx, ly, lw, WHITE, { example: true, rotate: -0.26 });
      }
      // Het teken rechtsboven; op de foto de donkere variant (een uitgesneden kruis toont de foto)
      mark(ctx, false, x + tw - 50, y + 12, 38, t.id !== 'kader');
      layer(ctx, 'Tekst', () => {
        const h = text(ctx, t.title, x, y + th + 24, tw, { size: 19, weight: 700, lh: 1.25, color: WHITE });
        text(ctx, t.text, x, y + th + 24 + h + 12, tw, { size: 15, lh: 1.4, color: DIM });
      });
    });
  }

  function zeshoek(ctx, P, env) {
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
          ctx.fillStyle = TRACK;
          ctx.fill();
        }
        if (i === 2) {
          // Effen cyaan, zoals het hoort. Een verloop of een blauwe zeshoek tekenen we niet, ook niet als fout
          K.hexPath(ctx, ex + 50, rowTop + 50, 46);
          ctx.fillStyle = CYAN;
          ctx.fill();
        }
        if (i === 3) {
          // Fout: witte zeshoek met een rand op wit; goed: wit op Inkt
          K.hexPath(ctx, ex + 50, rowTop + 50, 40);
          ctx.fillStyle = WHITE;
          ctx.fill();
          ctx.strokeStyle = EDGE;
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
      if (i === 3) mark(ctx, false, ex + 76, rowTop + 64, 34);
      let h = 0;
      layer(ctx, 'Tekst', () => {
        h = text(ctx, r.text, tx, rowTop + 18, 460, { size: 20, weight: r.ok ? 700 : 400, lh: 1.45, color: INK });
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
        // De echo eerst, dan de foto in de zeshoek (in de PDF een PNG met doorzichtige hoeken)
        const r = 62;
        const cx = x + 80;
        const cy = vy + 70;
        layer(ctx, 'Vormen', () => K.hexEcho(ctx, cx, cy, r, 4));
        raster(ctx, env, 'zeshoek-foto', cx - (r * SQRT3) / 2, cy - r, r * SQRT3, 2 * r, () => {
          layer(ctx, 'Beeld', () => {
            K.hexPath(ctx, cx, cy, r);
            ctx.fillStyle = PHOTO;
            ctx.fill();
          });
          looseIcon(ctx, 'image', cx - 18, cy - 18, 36, PHOTO_ICON);
        });
      } else if (u.id === 'holder') {
        hexIcon(ctx, 'line-chart', x, vy, 128, 'cyaan');
      } else if (u.id === 'pattern') {
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = INK;
          ctx.fillRect(x, vy, gw, 140);
          pattern(ctx, x + 8, vy + 4, gw - 16, 132, { r: 22, whole: true, lw: 1.5, color: RULE_DARK });
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
          line(ctx, v, x + 76, y + sh + 40 + j * 32, { size: 20, weight: 700, color: INK });
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
          line(ctx, v, x + 62, y3 + 104 + j * 26, { size: 16, weight: 700, color: INK });
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

  // Zonder rand: het witte deel staat altijd op een licht vlak (de pagina en het paneel tekenen dat eronder)
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
    });
    cx = x;
    layer(ctx, 'Tekst', () => {
      parts.forEach((p) => {
        const pw = (w * p.p) / 100;
        // Het getal past altijd in zijn deel; in een smal deel (10% in het paneel) wordt het kleiner
        const label = `${p.p}%`;
        const pad = Math.min(14, pw * 0.12);
        let size = Math.round(h * 0.42);
        font(ctx, 800, size);
        const tw = ctx.measureText(label).width;
        if (tw > pw - 2 * pad) size = Math.max(9, Math.floor((size * (pw - 2 * pad)) / tw));
        line(ctx, label, cx + pad, y + h / 2 + (size * CAP) / 2, { size, weight: 800, color: M.readable(p.hex) });
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
        // Regular: de namen staan dicht op elkaar (Pure Cyaan en Magenta en accenten)
        line(ctx, p.name, last ? x + w : cx, y, { size: 15, weight: 400, color, align: last ? 'right' : 'left' });
        cx += (w * p.p) / 100;
      });
    });
  }

  // Een compositie in de verhouding: vlak, cyaan blok met zeshoek, magenta knop. Zonder rand, net als de balk
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
      ctx.fillStyle = dark ? BAR_DARK : TRACK;
      [0.36, 0.45, 0.54].forEach((f, i) => ctx.fillRect(x + w * 0.07, y + h * f, w * (i === 2 ? 0.3 : 0.46), h * 0.035));
      ctx.fillStyle = MAGENTA;
      ctx.fillRect(x + w * 0.07, y + h * 0.7, w * 0.22, h * 0.12);
      K.hexPath(ctx, x + w * 0.81, y + h * 0.35, h * 0.16);
      ctx.fillStyle = dark ? INK : WHITE;
      ctx.fill();
    });
  }

  function kleurToepassen(ctx, P) {
    const top = head(ctx, P, 'Kleur', '60/30/10 en contrast.') + 50;
    const lw = 700;
    let th = 0;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'De 60/30/10-regel', MX, top, { color: INK });
      th = text(ctx, C.colors.ratio, MX, top + 44, lw, { size: 20, lh: 1.5, color: INK });
    });
    // De voorbeelden op een licht vlak: zo blijven het witte deel en de lichte compositie
    // zichtbaar op de witte pagina, zonder rand om een witte vorm
    const pad = 28;
    const iw = lw - 2 * pad;
    const cw = (iw - 28) / 2;
    const ch = cw * 0.5625;
    const by = top + 44 + th + 28;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = CANVAS;
      ctx.fillRect(MX, by, lw, pad + 294 + ch + pad);
    });
    let y = by + pad + 14;
    ['licht', 'donker'].forEach((mode) => {
      layer(ctx, 'Tekst', () => line(ctx, mode === 'licht' ? 'Lichte compositie' : 'Donkere compositie', MX + pad, y, { size: 18, weight: 700, color: INK }));
      ratio(ctx, MX + pad, y + 16, iw, mode, 52);
      ratioNames(ctx, MX + pad, y + 96, iw, mode, MUTED);
      y += 140;
    });
    composition(ctx, MX + pad, y, cw, ch, 'licht');
    composition(ctx, MX + pad + cw + 28, y, cw, ch, 'donker');

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
      // Het staaltje in de achtergrondkleur; wit is de pagina zelf (geen rand om een witte vorm)
      layer(ctx, 'Vormen', () => {
        rule(ctx, x, ry, w, LINE, 1.5);
        if (bg === 'wit') return;
        ctx.fillStyle = hex(bg);
        ctx.fillRect(x, ry + 9, 60, 38);
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, 'Aa', x + 30, ry + 36, { size: 20, weight: 800, color: hex(fg), align: 'center' });
        line(ctx, name, cols[0] + 76, ry + 36, { size: 19, weight: 700, color: INK });
        line(ctx, M.ratioText(n), cols[1], ry + 36, { size: 19, weight: 700, color: INK });
        line(ctx, v.text ? 'ja' : 'nee', cols[2], ry + 36, { size: 19, weight: v.text ? 700 : 400, color: v.text ? INK : MUTED });
        line(ctx, v.large ? 'ja' : 'nee', cols[3], ry + 36, { size: 19, weight: v.large ? 700 : 400, color: v.large ? INK : MUTED });
      });
    });
    layer(ctx, 'Tekst', () => {
      text(ctx, C.colors.contrastNote, x, top + 90 + C.colors.contrast.length * rh + 30, w - 20, { size: 17, lh: 1.45, color: MUTED });
    });
    // Waarom: rust en herkenbaarheid, en leesbaar voor iedereen (WCAG). Rechts gelijk met de tabel
    explainBox(ctx, EXPLAIN.x, EXPLAIN.y, EXPLAIN.w, EXPLAIN.h);
    C.colors.why.forEach((part) => {
      const right = part.id === 'contrast';
      const cx = right ? x : EXPLAIN.x + 40;
      const cw = right ? EXPLAIN.x + EXPLAIN.w - 34 - x : lw - 70;
      layer(ctx, 'Tekst', () => {
        label(ctx, part.title, cx, EXPLAIN.y + 30, { color: INK, size: 15 });
        text(ctx, part.text, cx, EXPLAIN.y + 60, cw, { size: 17, lh: 1.45, color: INK });
      });
    });
  }

  function typografie(ctx, P) {
    const top = head(ctx, P, 'Type', 'Typografie.') + 36;
    const lw = 620;
    layer(ctx, 'Tekst', () => {
      line(ctx, 'Aa', MX - 8, top + 190, { size: 250, weight: 800, color: INK, track: -0.02 });
      line(ctx, T.font.family, MX, top + 262, { size: 36, weight: 700, color: INK });
      text(ctx, C.type.intro, MX, top + 292, lw, { size: 20, lh: 1.5, color: MUTED });
      line(ctx, C.type.alphabet, MX, top + 404, { size: 22, weight: 400, color: INK, track: 0.08 });
      line(ctx, C.type.lower, MX, top + 436, { size: 22, weight: 400, color: INK, track: 0.08 });
      line(ctx, C.type.digits, MX, top + 468, { size: 22, weight: 400, color: INK, track: 0.08 });
      label(ctx, 'Gewichten', MX, top + 514, { color: INK });
      const cw = lw / T.font.weights.length;
      T.font.weights.forEach((wt, i) => {
        const x = MX + i * cw;
        line(ctx, 'Aa', x, top + 598, { size: 50, weight: wt.weight, color: INK });
        line(ctx, wt.name, x, top + 630, { size: 16, weight: 700, color: INK });
        line(ctx, String(wt.weight), x, top + 652, { size: 16, color: MUTED });
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
      layer(ctx, 'Tekst', () => {
        line(ctx, name, x, y + 14 + t.size * CAP + (rowH - 14 - t.size * CAP) / 2 - 4, { size: t.size, weight: t.weight, color: t.color || INK, track: t.track });
        line(ctx, M.typeSpec(t, T).text, sx, y + rowH / 2 + 2, { size: 16, weight: 700, color: INK });
        line(ctx, C.type.usage[t.id], sx, y + rowH / 2 + 24, { size: 15, color: MUTED });
      });
      y += rowH;
    });
    layer(ctx, 'Tekst', () => bullets(ctx, C.type.notes, x, y + 34, w, { size: 18, lh: 1.42, color: INK, gap: 0.5 }));
    typeLegend(ctx, LEGEND.x, LEGEND.y, LEGEND.w, LEGEND.h);
  }

  // Zo lees je de maten: het voorbeeld (de maat van Heading 1) met een genummerde zeshoek boven
  // elk deel, en rechts per nummer de uitleg, ook voor Canva
  function typeLegend(ctx, x, y, w, h) {
    const L = C.type.legend;
    const spec = M.typeSpec(T.type[0], T);
    explainBox(ctx, x, y, w, h);
    const sx = x + 40;
    layer(ctx, 'Tekst', () => label(ctx, L.title, sx, y + 32, { color: INK, size: 15 }));
    const base = y + h - 46;
    const sep = ' · ';
    let px = sx;
    [spec.weight, spec.size, spec.track].forEach((part, i) => {
      font(ctx, 700, 24);
      const pw = ctx.measureText(part).width;
      // Bij "ExtraBold 800" staat het nummer boven het getal
      const key = L.parts[i].key;
      const kx = part.endsWith(key) ? px + pw - ctx.measureText(key).width / 2 : px + pw / 2;
      layer(ctx, 'Vormen', () => numberHex(ctx, kx, base - 44, 13, i + 1));
      layer(ctx, 'Tekst', () => {
        line(ctx, part, px, base, { size: 24, weight: 700, color: INK });
        if (i < 2) line(ctx, sep, px + pw, base, { size: 24, weight: 700, color: MUTED });
      });
      font(ctx, 700, 24);
      px += pw + ctx.measureText(sep).width;
    });
    // Rechts: drie kolommen, elk met zijn nummer, de naam en de uitleg
    const cx0 = x + LEGEND_COL;
    const gap = 30;
    const colW = (x + w - 34 - cx0 - 2 * gap) / 3;
    L.parts.forEach((part, i) => {
      const cx = cx0 + i * (colW + gap);
      layer(ctx, 'Vormen', () => numberHex(ctx, cx + 12, y + 38, 13, i + 1));
      layer(ctx, 'Tekst', () => {
        line(ctx, part.title, cx + 34, y + 45, { size: 18, weight: 700, color: INK });
        text(ctx, part.text, cx, y + 68, colW, { size: 15, lh: 1.4, color: INK });
      });
    });
  }

  // Drie voorbeelden op een echte foto. Het verloop van Inkt onder de tekst zit in de foto
  // gebakken (één beeld in de PDF); de tekst staat er als echte tekst op. Zonder foto (nog aan
  // het laden, of in de tests) de opbouw in vlakken, zoals voorheen
  function imageFrame(ctx, env, f, x, y, w, h) {
    const photo = raster(ctx, env, `beeld-${f.id}`, x, y, w, h);
    if (f.id === 'compositie') {
      if (!photo) {
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = PHOTO_LINE;
          [1, 2].forEach((k) => {
            ctx.fillRect(x + (w * k) / 3 - 1, y, 2, h);
            ctx.fillRect(x, y + (h * k) / 3 - 1, w, 2);
          });
          K.hexPath(ctx, x + (w * 2) / 3, y + h * 0.55, h * 0.22);
          ctx.fillStyle = PHOTO_SUBJECT;
          ctx.fill();
        });
      }
      // De rustige kant: hier komt de kop, met de cyaan balk ervoor
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = CYAN;
        ctx.fillRect(x + 28, y + h * 0.36, 6, 66);
      });
      layer(ctx, 'Tekst', () => {
        line(ctx, 'ruimte voor', x + 48, y + h * 0.36 + 25, { size: 24, weight: 800, color: WHITE });
        line(ctx, 'de kop', x + 48, y + h * 0.36 + 55, { size: 24, weight: 800, color: WHITE });
      });
    } else if (f.id === 'tekst') {
      if (!photo) {
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = PHOTO_DARK;
          ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
        });
      }
      // Onderaan, 26 px boven de rand van de foto
      layer(ctx, 'Tekst', () => {
        const str = 'Onze nieuwe **Ads-audit** is live';
        const st = { size: 28, weight: 800, emWeight: 800, lh: 1.12, track: -0.02, color: WHITE, em: CYAN, dot: true };
        const block = plan(ctx, str, w - 56, st);
        text(ctx, str, x + 28, y + h - 26 - block.height, w - 56, st);
      });
    } else {
      if (!photo) {
        layer(ctx, 'Vormen', () => {
          ctx.fillStyle = PHOTO_DARK;
          ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
        });
      }
      layer(ctx, 'Tekst', () => {
        const nw = line(ctx, '+184%', x + 28, y + h - 30, { size: 52, weight: 800, color: CYAN, track: -0.02 });
        text(ctx, 'meer aanvragen in drie maanden', x + 28 + nw + 20, y + h - 72, w - 76 - nw, { size: 17, lh: 1.3, color: WHITE });
      });
    }
  }

  function beeldtaal(ctx, P, env) {
    const top = head(ctx, P, 'Beeld', 'Beeldtaal en fotografie.') + 26;
    layer(ctx, 'Tekst', () => text(ctx, C.imagery.intro, MX, top, CW, { size: 20, lh: 1.45, color: DIM }));
    const gap = 36;
    const fw = (CW - 2 * gap) / 3;
    const fy = top + 90;
    const fh = 280;
    C.imagery.frames.forEach((f, i) => {
      const x = MX + i * (fw + gap);
      imageFrame(ctx, env, f, x, fy, fw, fh);
      layer(ctx, 'Tekst', () => {
        line(ctx, f.title, x, fy + fh + 30, { size: 18, weight: 700, color: WHITE });
        line(ctx, f.text, x + ctx.measureText(f.title).width + 12, fy + fh + 30, { size: 16, color: DIM });
      });
    });
    const sy = fy + fh + 76;
    const g2 = 32;
    const sw = (CW - 3 * g2) / 4;
    let bottom = sy;
    C.imagery.sections.forEach((s, i) => {
      const x = MX + i * (sw + g2);
      layer(ctx, 'Tekst', () => {
        line(ctx, s.title, x, sy + 15, { size: 20, weight: 700, color: CYAN });
        bottom = Math.max(bottom, sy + 44 + bullets(ctx, s.items, x, sy + 44, sw, { size: 17, lh: 1.4, color: WHITE, gap: 0.45 }));
      });
    });
    // Waar de voorbeeldfoto's vandaan komen: één regel eronder, links van het logo
    layer(ctx, 'Tekst', () => text(ctx, C.imagery.photoNote, MX, bottom + 30, SAFE_RIGHT - 20 - MX, { size: 15, lh: 1.4, color: DIM }));
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

    // Wel en niet: hetzelfde icoon uitgesneden in de volle stijl en in de lijnstijl. Elk op een
    // eigen vlak van Inkt met het teken rechtsboven, zoals de voorbeelden bij het logo
    const ko = C.icons.knockout;
    y += 108;
    const gapT = 20;
    const tw = (names.length * step + 22 - gapT) / 2;   // samen zo breed als de rij van de witte zeshoek
    const th = 104;
    const kh = 76;
    const kw = (kh * global.PMHex.WIDTH) / global.PMHex.HEIGHT;
    [[true, ko.wel], [false, ko.niet]].forEach(([ok, caption], k) => {
      const tx = ix - 20 + k * (tw + gapT);
      const ty = y - 14;
      layer(ctx, 'Vormen', () => {
        ctx.fillStyle = INK;
        ctx.fillRect(tx, ty, tw, th);
      });
      hexIcon(ctx, ko.icon, tx + (tw - kw) / 2, ty + (th - kh) / 2, kh, 'wit', ok ? 'fill' : 'line');
      mark(ctx, ok, tx + tw - 42, ty + 10, 32, true);
      // De stijl vet, de uitleg erachter: "Volle stijl (Fill): een rustig silhouet."
      layer(ctx, 'Tekst', () => text(ctx, caption.replace(/^([^:]+:)/, '**$1**'), tx, ty + th + 22, tw, { size: 15, lh: 1.4, color: INK }));
    });
    layer(ctx, 'Tekst', () => {
      line(ctx, ko.title, MX, y + 26, { size: 20, weight: 700, color: INK });
      line(ctx, ko.sub, MX, y + 52, { size: 15, color: MUTED });
    });

    const x = 1020;
    const w = W - MX - x;
    let rh = 0;
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Regels', x, top + 140, { color: INK });
      rh = bullets(ctx, C.icons.rules, x, top + 186, w, { size: 19, lh: 1.45, color: INK, gap: 0.6 });
    });
    // Waarom uitgesneden vol: drie korte redenen in een tint met een cyane balk
    const why = C.icons.why;
    const wy = top + 186 + rh + 32;
    const pad = 24;
    const body = K.layoutBody(ctx, why.items.map((it) => `- **${it.title}:** ${it.text}`).join('\n'), w - 2 * pad - 6, {
      size: 17, weight: 400, emWeight: 700, lh: 1.4, track: 0, itemGap: 0.3,
    });
    const wh = pad + 36 + body.height + pad - 8;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = TINT;
      ctx.fillRect(x, wy, w, wh);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, wy, 6, wh);
    });
    layer(ctx, 'Tekst', () => {
      label(ctx, why.title, x + pad + 6, wy + pad, { color: INK });
      K.drawBody(ctx, body, x + pad + 6, wy + pad + 36, { color: INK, em: INK });
    });
    // Waar je ze vindt: de Icon Finder in de Generator Hub
    const by = wy + wh + 18;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = TINT;
      ctx.fillRect(x, by, w, 96);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, by, 6, 96);
    });
    hexIcon(ctx, 'search', x + 30, by + 20, 56, 'cyaan');
    layer(ctx, 'Tekst', () => {
      line(ctx, 'Icon Finder', x + 108, by + 42, { size: 21, weight: 700, color: INK });
      line(ctx, 'Generator Hub · tools/icons.html', x + 108, by + 70, { size: 17, color: MUTED });
    });
  }

  // Naam van de toepassing met de maker erachter, op één regel
  function caption(ctx, m, x, base) {
    layer(ctx, 'Tekst', () => {
      const w = line(ctx, m.name, x, base, { size: 23, weight: 700, color: INK });
      line(ctx, m.tool, x + w + 16, base, { size: 15, weight: 700, color: MUTED, track: 0.04 });
    });
  }

  // Echte posts en slides, getekend door de makers zelf met hun voorbeeldteksten
  // (js/styleguide/mockups.js). Een lichte pagina: daarop vallen de donkere ontwerpen op
  function toepassingen(ctx, P, env) {
    const top = head(ctx, P, 'Gebruik', 'Toepassingen.') + 30;
    layer(ctx, 'Tekst', () => text(ctx, C.usage.intro, MX, top, 1100, { size: 21, lh: 1.5, color: MUTED }));
    const maker = (id) => C.usage.makers.find((m) => m.id === id);
    // Rij 1: de vijf templates van de Insta Post Maker (4:5)
    const gap = 34;
    const pw = (CW - 4 * gap) / 5;
    const ph = pw * 1.25;
    const py = top + 104;
    caption(ctx, maker('insta'), MX, py - 24);
    ['photo', 'overlay', 'blog', 'case', 'carousel'].forEach((id, i) => raster(ctx, env, `post-${id}`, MX + i * (pw + gap), py, pw, ph));
    layer(ctx, 'Tekst', () => text(ctx, maker('insta').text, MX, py + ph + 22, CW, { size: 17, lh: 1.45, color: MUTED }));
    // Rij 2: twee slides uit de Presentation Maker (16:9), de uitleg ernaast, links van het logo
    const sw = (CW - 2 * gap) / 3;
    const sh = (sw * 9) / 16;
    const sy = py + ph + 128;
    caption(ctx, maker('presentation'), MX, sy - 24);
    ['title', 'split'].forEach((id, i) => raster(ctx, env, `slide-${id}`, MX + i * (sw + gap), sy, sw, sh));
    const tx = MX + 2 * (sw + gap);
    layer(ctx, 'Tekst', () => text(ctx, maker('presentation').text, tx, sy, SAFE_RIGHT - 20 - tx, { size: 17, lh: 1.45, color: MUTED }));
  }

  /**
   * De brief uit de Document Maker als vector: de maten van het A4 in
   * css/document.css (794 × 1123 px, gemeten in de tool), geschaald naar hoogte h.
   * Logo in Inkt linksboven, de afzender rechts, de teksten uit content.js
   * (C.usage.letter). Het zeshoekpatroon rechtsboven in twee effen tinten (geen
   * doorzichtigheid), geometrisch afgesneden op de pagina: geen uitknippad.
   */
  function letter(ctx, env, x, y, h) {
    const L = C.usage.letter;
    const s = h / 1123;
    const X = (v) => x + v * s;
    const Y = (v) => y + v * s;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = WHITE;
      ctx.fillRect(x, y, 794 * s, h);
      ctx.fillStyle = CYAN;
      ctx.fillRect(x, y, 794 * s, 8 * s);
      // Het patroon vervaagt vanuit de hoek rechtsboven (PATTERN_SVG in js/document/app.js):
      // de sterke zeshoeken als lijn, de zwakke als vlak licht, de zwakste niet
      const r = 34;
      const cw = Math.sqrt(3) * r;
      const box = { x0: 434, y0: 8, x1: 794, y1: 240 };
      const strong = [];
      const light = [];
      for (let row = -1; row < 7; row++) {
        const cy = row * 1.5 * r;
        const shift = row % 2 ? cw / 2 : 0;
        for (let cx = -cw + shift; cx < 360 + cw; cx += cw) {
          const a = 0.42 * (1 - Math.hypot(360 - cx, cy) / 380);
          if (a < 0.06) continue;
          const pts = [];
          for (let k = 0; k < 6; k++) {
            const ang = (Math.PI / 3) * k - Math.PI / 2;
            pts.push([434 + cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
          }
          (a >= 0.2 ? strong : light).push(pts);
        }
      }
      [[light, CANVAS], [strong, LINE]].forEach(([list, color]) => {
        ctx.beginPath();
        for (const pts of list) {
          for (let k = 0; k < 6; k++) {
            const seg = clipSeg(pts[k], pts[(k + 1) % 6], box);
            if (!seg) continue;
            ctx.moveTo(X(seg[0][0]), Y(seg[0][1]));
            ctx.lineTo(X(seg[1][0]), Y(seg[1][1]));
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 1.2 * s);
        ctx.stroke();
      });
    });
    // Het logo in Inkt linksboven, 64 px hoog (zoals .a4__logo)
    logo(ctx, env, X(72), Y(48), 64 * T.logo.aspect * s, INK, { example: true });
    // Eén regel op een basislijn, of tekst met regelval vanaf een basislijn (maten in A4-px)
    const L1 = (str, ax, base, size, o = {}) => line(ctx, str, X(ax), Y(base), { size: size * s, weight: o.weight || 400, color: o.color || INK, track: o.track || 0, align: o.align || 'left' });
    const T1 = (str, ax, base, size, maxW, o = {}) => text(ctx, str, X(ax), Y(base) - size * s * CAP, maxW * s, {
      size: size * s, weight: o.weight || 400, emWeight: o.emWeight || 700, lh: o.lh || 1.65, track: o.track || 0, color: o.color || INK, dot: o.dot,
    });
    layer(ctx, 'Tekst', () => {
      // Afzender rechtsboven
      L1(C.company, 722, 61.1, 11, { weight: 700, align: 'right' });
      L1(C.domain, 722, 78.1, 10.5, { color: MUTED, align: 'right' });
      // Adres links, datum rechts
      L.recipient.forEach((t, i) => L1(t, 72, 183.1 + i * 20.15, 13));
      const dw = L1(L.date, 722, 182.6, 12, { weight: 700, align: 'right' }) / s;
      L1('DATUM', 722 - dw - 18, 181.6, 9.5, { weight: 700, color: MUTED, align: 'right', track: 0.12 });
      // Label en titel (het label in Blauw, zoals in de Document Maker)
      L1(L.label.toUpperCase(), 91, 301.3, 10.5, { weight: 700, color: hex('blauw'), track: 0.12 });
      T1(L.title, 72, 338.9, 28, 650, { weight: 800, emWeight: 800, track: -0.02, lh: 1.15, dot: true });
      // De brief
      L1(L.salutation, 72, 386.5, 13.5);
      T1(L.intro, 72, 420.7, 13.5, 650);
      L1(L.heading, 72, 489, 17, { weight: 700, track: -0.01 });
      L.bullets.forEach((t, i) => T1(t, 94, 510.2 + i * 26.3, 13.5, 628));
      L1(L.outro, 72, 585, 13.5);
      L1(L.closing, 72, 635.3, 13.5);
      L1(L.signature, 72, 699.7, 12, { color: MUTED });
      // Voetregel: de bedrijfsgegevens
      const fw = L1(C.company, 72, 1079.1, 9.5, { weight: 700 }) / s;
      L1(` · ${C.domain}`, 72 + fw, 1079.1, 9.5, { color: MUTED });
    });
    layer(ctx, 'Vormen', () => {
      // Zeshoekjes voor het label en de opsomming (cyaan, punt boven), en de lijn boven de voet
      K.hexPath(ctx, X(77.5), Y(297.25), 6.35 * s);
      ctx.fillStyle = CYAN;
      ctx.fill();
      ctx.beginPath();
      L.bullets.forEach((_, i) => K.addHex(ctx, X(79.5), Y(505.95 + i * 26.3), 4.05 * s));
      ctx.fill();
      rule(ctx, X(72), Y(1054.8), 650 * s, LINE, Math.max(1, s));
    });
  }

  // Een lijnstuk afsnijden op een rechthoek (Liang-Barsky): zo is er geen uitknippad nodig
  function clipSeg(a, b, r) {
    let t0 = 0;
    let t1 = 1;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - r.x0], [dx, r.x1 - a[0]], [-dy, a[1] - r.y0], [dy, r.y1 - a[1]]]) {
      if (p === 0) {
        if (q < 0) return null;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (t0 > t1) return null;
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
  }

  // De brief uit de Document Maker, en de Emerce 100-badge
  function documenten(ctx, P, env) {
    head(ctx, P, 'Gebruik', 'Documenten en keurmerk.');
    // Links: de brief op een licht vlak (een wit vlak krijgt geen rand)
    const bx = MX;
    const by = 236;
    const bw = 640;
    const bh = 836;
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = CANVAS;
      ctx.fillRect(bx, by, bw, bh);
    });
    const lh = bh - 72;
    letter(ctx, env, bx + (bw - (794 * lh) / 1123) / 2, by + 36, lh);
    // Rechts: wat de Document Maker doet, en de badge
    const x = 820;
    const w = W - MX - x;
    const doc = C.usage.makers.find((m) => m.id === 'document');
    let y = 262;
    caption(ctx, doc, x, y + 18);
    layer(ctx, 'Tekst', () => {
      y += 44 + text(ctx, doc.text, x, y + 44, w, { size: 20, lh: 1.5, color: INK });
    });
    y += 70;
    layer(ctx, 'Vormen', () => rule(ctx, x, y - 34, w));
    // De badge: wit op Inkt, zwart op de witte pagina
    layer(ctx, 'Vormen', () => {
      ctx.fillStyle = INK;
      ctx.fillRect(x, y, 300, 130);
    });
    if (env && env.badgeWhite) layer(ctx, 'Beeld', () => SVG.draw(ctx, env.badgeWhite, { x: x + 25, y: y + 22, w: 250, h: 86 }));
    if (env && env.badgeBlack) layer(ctx, 'Beeld', () => SVG.draw(ctx, env.badgeBlack, { x: x + 340, y: y + 22, w: 250, h: 86 }));
    y += 130 + 52;
    layer(ctx, 'Tekst', () => {
      line(ctx, C.usage.badge.title, x, y + 16, { size: 23, weight: 700, color: INK });
      const h = text(ctx, C.usage.badge.intro, x, y + 40, w, { size: 18, lh: 1.45, color: MUTED });
      bullets(ctx, C.usage.badge.rules, x, y + 40 + h + 22, SAFE_RIGHT - 20 - x, { size: 18, lh: 1.42, color: INK, gap: 0.45 });
    });
  }

  // Het colofon, tijdloos: logo, naam en slogan; daaronder contact, over dit brandbook en de
  // bronnen (met de fotografen). Geen versie of datum: de styleguide is altijd actueel
  function colofon(ctx, P, env) {
    const w = 210;
    const h = w / T.logo.aspect;
    const ly = 128;
    logo(ctx, env, (W - w) / 2, ly, w, WHITE);
    layer(ctx, 'Tekst', () => {
      text(ctx, C.company, MX, ly + h + 64, CW, { size: 48, weight: 800, track: -0.01, lh: 1.1, color: WHITE, dot: true, align: 'center' });
      line(ctx, C.slogan, W / 2, ly + h + 160, { size: 26, color: DIM, align: 'center', italic: true });
      line(ctx, C.colophon.signoff, W / 2, ly + h + 212, { size: 20, color: DIM, align: 'center' });
    });
    const y = 700;
    layer(ctx, 'Vormen', () => rule(ctx, MX, y - 40, CW, RULE_DARK, 2));
    const cols = [MX, 640, 1110];
    const K2 = C.colophon;
    // Contact: per regel het icoon in de cyane zeshoek (huisvariant), zoals op de afsluiter van de presentaties
    const contact = [['global', C.contact.web], ['phone', C.contact.phone], ['mail', C.contact.email]];
    contact.forEach(([icon], i) => hexIcon(ctx, icon, cols[0], y + 66 + i * 52 - 8 - 19, 38, 'cyaan'));
    layer(ctx, 'Tekst', () => {
      label(ctx, 'Contact', cols[0], y, { color: WHITE });
      contact.forEach(([, t], i) => line(ctx, t, cols[0] + 52, y + 66 + i * 52, { size: 24, weight: 700, color: WHITE }));
      label(ctx, 'Over dit brandbook', cols[1], y, { color: WHITE });
      const ah = text(ctx, K2.about, cols[1], y + 44, 430, { size: 17, lh: 1.5, color: DIM });
      text(ctx, K2.rights, cols[1], y + 44 + ah + 24, 430, { size: 15, lh: 1.45, color: DIM });
      label(ctx, 'Bronnen', cols[2], y, { color: WHITE });
      const sh = text(ctx, K2.sources, cols[2], y + 44, W - MX - cols[2], { size: 17, lh: 1.5, color: DIM });
      text(ctx, M.photoLine(C), cols[2], y + 44 + sh + 14, W - MX - cols[2], { size: 17, lh: 1.5, color: DIM });
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
    toepassingen: { fn: toepassingen },
    documenten: { fn: documenten },
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
    W, H, LAYERS, MM, CANVAS, NEUTRALS, pages: PAGES, chapters: C.chapters, draw, render, overlay, ratio, ratioParts, composition,
  };
})(window);
