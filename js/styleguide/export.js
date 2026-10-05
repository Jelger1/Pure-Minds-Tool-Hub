/* =============================================================================
   styleguide/export.js — het brandbook als bewerkbare PDF, het logo-pakket en
   de kleurbestanden
   -----------------------------------------------------------------------------
   PDF: dezelfde tekenfuncties als het podium (js/styleguide/pages.js) tekenen
   via PMPdfCanvas in jsPDF: echte tekst in Pure Minds Sans (elk gewicht een
   eigen PostScript-naam, PureMindsSans-*), vormen, logo en iconen als vector,
   exacte kleuren, geen uitknippaden of verlopen als vector. Foto's en de
   voorbeelden uit de makers gaan als afbeelding in de laag Beeld (JPEG), met
   het verloop erin gebakken; de tekst op een foto blijft echte tekst. Daarna zet
   pdf-lib de lagen erin: vijf optionele inhoudsgroepen (OCG: Achtergrond,
   Vormen, Tekst, Logo, Beeld) die de gemarkeerde blokken (/OC /Tekst BDC … EMC)
   uit PMPdfCanvas een naam geven, en de metadata (titel, onderwerp, auteur).
   De export wacht op de foto's (app.js); een foto die niet laadt, wordt het
   lege fotovlak.

   Canva importeert hoogstens 1.400 elementen per PDF. Past het hele brandbook
   daar niet onder, dan worden het delen van hele hoofdstukken (model.js
   splitParts), samen in een zip.

     PMStyleguideExport.pdf(scope, env, progress)   scope: null (alles) of een hoofdstuk-id
                                                    -> { name, elements, parts }
     PMStyleguideExport.logoFile(env, variant, format)   'wit' | 'inkt', 'svg' | 'png' -> { blob, name }
     PMStyleguideExport.logoPackage(env, progress)  zip met SVG en PNG van beide varianten
     PMStyleguideExport.colors(kind)                'ase' | 'json' -> { blob, name }
     PMStyleguideExport.badge(variant)              de Emerce 100-badge, wit of zwart (SVG)
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;
  const S = global.PMStyleguide;
  const M = global.PMStyleguideModel;
  const T = global.PM_BRAND_TOKENS;
  const C = global.PM_BRAND_CONTENT;
  const SVG = global.PMSvgPath;

  const PAGE_W = 841.89;   // A4 liggend in pt; de hoogte (595,28) volgt uit het formaat
  const AUTHOR = T.company;

  /* ---------------------------------------------------------------------------
     PDF
     ------------------------------------------------------------------------- */

  async function draw(indices, env, progress) {
    const pdf = await PM.pdfDocument({ format: 'a4', orientation: 'landscape' });
    const counts = [];
    for (let n = 0; n < indices.length; n++) {
      progress(indices.length > 1 ? `pagina ${n + 1} van ${indices.length}…` : 'pdf maken…');
      await PM.wait(0);   // knoptekst laten verversen
      if (n) pdf.addPage('a4', 'landscape');
      const ctx = new global.PMPdfCanvas(pdf, { width: S.W, height: S.H, pageWidth: PAGE_W });
      S.draw(ctx, indices[n], env);
      const st = await ctx.flush();
      counts.push(st.text + st.vector + st.raster + st.image + st.svg);
    }
    if (pdf.setLanguage) pdf.setLanguage('nl');
    return { bytes: pdf.output('arraybuffer'), counts };
  }

  // De lagen en de metadata, met pdf-lib. Eenvoudige structuur (geen objectstreams): beste import in Canva
  async function finish(bytes, { title, subject }) {
    const { PDFDocument, PDFName, PDFString } = await PM.libs.pdflib();
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const ctx = doc.context;
    const ocgs = S.LAYERS.map((name) => ctx.register(ctx.obj({ Type: 'OCG', Name: PDFString.of(name) })));
    doc.catalog.set(PDFName.of('OCProperties'), ctx.obj({
      OCGs: ocgs,
      D: { Name: PDFString.of('Brandbook'), Order: ocgs, ON: ocgs, OFF: [] },
    }));
    const props = {};
    S.LAYERS.forEach((name, i) => { props[name] = ocgs[i]; });
    // jsPDF deelt één Resources-woordenboek; per pagina zetten maakt het ook goed als dat ooit anders is
    for (const page of doc.getPages()) {
      const res = page.node.Resources();
      if (res) res.set(PDFName.of('Properties'), ctx.obj(props));
    }
    doc.setTitle(title, { showInWindowTitleBar: true });
    doc.setSubject(subject);
    doc.setAuthor(AUTHOR);
    doc.setCreator(AUTHOR);
    doc.setProducer(AUTHOR);
    doc.setKeywords(['brandbook', 'huisstijl', 'Pure Minds']);
    doc.setLanguage('nl-NL');
    const now = new Date();
    doc.setCreationDate(now);
    doc.setModificationDate(now);
    return doc.save({ useObjectStreams: false });
  }

  async function build(indices, env, progress, meta) {
    const { bytes, counts } = await draw(indices, env, progress);
    progress('lagen toevoegen…');
    const out = await finish(bytes, meta);
    return { blob: new Blob([out], { type: 'application/pdf' }), counts, elements: counts.reduce((a, b) => a + b, 0) };
  }

  async function pdf(scope, env, progress = () => {}) {
    const all = S.pages.filter((p) => !scope || p.chapter === scope).map((p) => p.index);
    const chapter = scope ? C.chapters.find((c) => c.id === scope) : null;
    const meta = {
      title: chapter ? `Brandbook ${T.company}: ${chapter.title}` : `Brandbook ${T.company}`,
      subject: `Huisstijl en richtlijnen van ${T.company}`,
    };
    const name = M.fileName(scope);
    const first = await build(all, env, progress, meta);
    const limit = global.PMPdfCanvas.CANVA_LIMIT;
    if (first.elements <= limit) {
      PM.saveBlob(first.blob, name);
      return { name, elements: first.elements, parts: 1, counts: first.counts };
    }
    // Te veel voor Canva: hele hoofdstukken bij elkaar, elk deel onder de limiet
    const parts = M.splitParts(first.counts, all.map((i) => S.pages[i].chapter), limit);
    const JSZip = await PM.libs.jszip();
    const zip = new JSZip();
    for (let k = 0; k < parts.length; k++) {
      const indices = parts[k].map((n) => all[n]);
      const part = await build(indices, env, (t) => progress(`deel ${k + 1}: ${t}`), { ...meta, title: `${meta.title} (deel ${k + 1})` });
      zip.file(M.fileName(scope, k + 1), part.blob);
    }
    const zipName = name.replace(/\.pdf$/, '-delen.zip');
    PM.saveBlob(await zip.generateAsync({ type: 'blob' }), zipName);
    return { name: zipName, elements: first.elements, parts: parts.length, counts: first.counts };
  }

  /* ---------------------------------------------------------------------------
     Logo: de originele bestanden, alleen de kleur van de Inkt-variant gelijk aan Inkt
     ------------------------------------------------------------------------- */

  const INK = T.color('inkt').hex;
  const LOGO_COLORS = { wit: '#FFFFFF', inkt: INK };
  const logoName = (variant, ext) => `pure-minds-logo-${variant}.${ext}`;

  function logoSvg(variant) {
    if (variant === 'wit') return PM.brandSvg('logoWhiteSvg');
    // Het zwarte origineel is #24282e; in de huisstijl is dat Inkt (#303030)
    return PM.brandSvg('logoBlack').replace(/#24282e/gi, INK.toLowerCase());
  }

  // PNG met een doorzichtige achtergrond, 2000 px breed: groot genoeg voor print op A4
  async function logoPng(env, variant, width = 2000) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round(width / T.logo.aspect);
    SVG.draw(c.getContext('2d'), env.logo, { x: 0, y: 0, w: c.width, h: c.height }, { color: LOGO_COLORS[variant] });
    return PM.canvasToBlob(c, 'image/png');
  }

  async function logoFile(env, variant, format) {
    if (format === 'png') return { blob: await logoPng(env, variant), name: logoName(variant, 'png') };
    return { blob: new Blob([logoSvg(variant)], { type: 'image/svg+xml' }), name: logoName(variant, 'svg') };
  }

  const README = [
    'Logo Pure Minds Marketing Group',
    '',
    'pure-minds-logo-wit.svg / .png   op Inkt of een donkere foto (primair)',
    'pure-minds-logo-inkt.svg / .png  op een lichte ondergrond (Inkt #303030)',
    '',
    'SVG voor digitaal en print; PNG (2000 px breed, doorzichtig) alleen als het programma geen SVG kent.',
    'Clear space: rondom een vrije ruimte van een kwart van de logobreedte.',
    'Minimaal 80 px breed op een scherm, 20 mm in print.',
    'Niet vervormen, kantelen of hertekenen; geen andere kleur, kader of vlak erachter.',
    '',
    `${C.company} · ${C.contact.web}`,
    '',
  ].join('\r\n');

  async function logoPackage(env, progress = () => {}) {
    const JSZip = await PM.libs.jszip();
    const zip = new JSZip();
    for (const variant of ['wit', 'inkt']) {
      progress(`logo ${variant}…`);
      zip.file(logoName(variant, 'svg'), logoSvg(variant));
      zip.file(logoName(variant, 'png'), await logoPng(env, variant));
    }
    zip.file('LEESMIJ.txt', README);
    progress('inpakken…');
    const name = 'pure-minds-logo-pakket.zip';
    PM.saveBlob(await zip.generateAsync({ type: 'blob' }), name);
    return name;
  }

  /* ---------------------------------------------------------------------------
     Kleuren en badge
     ------------------------------------------------------------------------- */

  function colors(kind) {
    if (kind === 'ase') {
      return { blob: new Blob([M.aseBytes(M.aseGroups(T))], { type: 'application/octet-stream' }), name: 'pure-minds-kleuren.ase' };
    }
    const json = `${JSON.stringify(M.colorJson(T, C), null, 2)}\n`;
    return { blob: new Blob([json], { type: 'application/json' }), name: 'pure-minds-kleuren.json' };
  }

  function badge(variant) {
    const svg = PM.brandSvg(variant === 'zwart' ? 'badgeBlack' : 'badgeWhite');
    return { blob: new Blob([svg], { type: 'image/svg+xml' }), name: `emerce-100-2026-${variant === 'zwart' ? 'zwart' : 'wit'}.svg` };
  }

  global.PMStyleguideExport = { pdf, logoFile, logoPackage, colors, badge };
})(window);
