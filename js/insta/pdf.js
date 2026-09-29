/* =============================================================================
   pdf.js — de PDF van een post of carousel, bewerkbaar in Canva
   -----------------------------------------------------------------------------
   Dezelfde renderfunctie als de preview tekent via PMPdfCanvas in de PDF
   (js/shared/pdf-canvas.js). Elk onderdeel blijft een los object: tekst als
   tekst in Open Sans, vormen en het logo als vector, verlopen en foto's als
   losse afbeeldingen. Zo importeert Canva de post laag voor laag en ziet hij
   er in de PDF precies zo uit als in de preview.

     PMInstaPdf.build({ pages, title, clientLogoSvg, progress }) -> Promise<{ blob, elements }>
       pages: [{ state, env }], één pagina per post of slide; env zoals de
       preview hem krijgt (logo, badge, photo, clientLogo, crop, slideIndex)
       clientLogoSvg: SVG-tekst van het klantlogo (blijft vector), of null
       elements: wat Canva als onderdeel telt (hoogstens PMPdfCanvas.CANVA_LIMIT)
     PMInstaPdf.svgText(file) -> Promise<string|null>
       een SVG-bestand als veilige SVG-tekst (zonder scripts of event-attributen)
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;
  const T = global.PMTemplates;
  const Export = global.PMInstaExport;

  async function svgText(file) {
    if (!file || !/svg/i.test(file.type || '')) return null;
    try {
      const svg = new DOMParser().parseFromString(await file.text(), 'image/svg+xml').documentElement;
      if (svg.nodeName.toLowerCase() !== 'svg') return null;
      svg.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
      // Een SVG als <img> laadt geen externe bestanden; in de PDF dus ook niet
      // (svg2pdf leest href én xlink:href, en blijft hangen op een bestand dat niet laadt)
      svg.querySelectorAll('image').forEach((n) => {
        const hrefs = [n.getAttribute('href'), n.getAttributeNS('http://www.w3.org/1999/xlink', 'href')].filter((h) => h != null);
        if (!hrefs.length || hrefs.some((h) => !/^\s*data:/i.test(h))) n.remove();
      });
      for (const n of [svg, ...svg.querySelectorAll('*')]) {
        for (const a of Array.from(n.attributes)) {
          if (/^on/i.test(a.name) || (/href$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
        }
      }
      return new XMLSerializer().serializeToString(svg);
    } catch (err) {
      return null;
    }
  }

  async function build({ pages, title = 'Pure Minds post', clientLogoSvg = null, progress = () => {} }) {
    if (!pages || !pages.length) throw new Error('Er is niets om te exporteren.');
    const fmt = T.FORMATS[pages[0].state.format] || T.FORMATS.square;

    // Logo en Emerce-badge als vector; een klantlogo in SVG ook
    const vectors = new Map();
    for (const { env } of pages) {
      if (env.logo) vectors.set(env.logo, PM.brandSvg('logoWhiteSvg'));
      if (env.badge) vectors.set(env.badge, PM.brandSvg('badgeWhite'));
      if (env.clientLogo && clientLogoSvg) vectors.set(env.clientLogo, clientLogoSvg);
    }

    return global.PMPdfCanvas.build({
      width: fmt.w,
      height: fmt.h,
      pageWidth: Export.pdfPage(fmt).w,   // 0,75 pt per ontwerp-px: in Canva weer 1080 px breed
      count: pages.length,
      draw: (canvas, i) => T.renderPost(canvas, pages[i].state, pages[i].env),
      vectors,
      title,
      subject: 'Pure Minds post',
      progress,
    });
  }

  global.PMInstaPdf = { build, svgText };
})(window);
