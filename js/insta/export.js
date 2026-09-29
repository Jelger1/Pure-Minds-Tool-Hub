/* =============================================================================
   export.js — wat je krijgt als je een post downloadt
   -----------------------------------------------------------------------------
   Eén plek voor de keuze tussen PNG, JPG, zip en PDF, de zin in de
   download-opties ("zip met 3 PNG's · 1080 × 1350 px") en de uitleg eronder,
   zodat de knop en de uitleg nooit uit elkaar lopen. Zonder DOM, getest in
   tests/insta-export.test.js.

     PMInstaExport.plan({ carousel, slides, fmt, width, type, only })
       -> { kind: 'png' | 'jpg' | 'zip' | 'pdf', type, pages, linkedin, summary, note }
     PMInstaExport.pdfPage(fmt)   paginamaat in pt (1 ontwerp-px = 0,75 pt)
     PMInstaExport.DESTS          de kanalen onder "Voor", per exportbreedte
   ============================================================================= */
(function (global) {
  'use strict';

  const TYPES = ['png', 'jpg', 'pdf'];
  const DESTS = { 1080: 'Instagram', 1200: 'LinkedIn', 2160: 'extra scherp' };
  const NOTES = {
    linkedin: 'LinkedIn toont een carousel als document: maak een bericht, kies "document toevoegen" en upload deze PDF.',
    pdf: "In Canva: sleep de PDF op de startpagina of klik op Uploaden. Tekst, vormen en logo blijven los te bewerken; foto's en verlopen worden afbeeldingen. Werkt ook in Illustrator en Acrobat.",
    zip: 'Eén zip met alle slides op volgorde. Upload ze samen als één carousel-bericht.',
  };
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // Dezelfde paginamaat als de LinkedIn-PDF van een carousel altijd al had;
  // Canva rekent hem terug naar 1080 px breed
  function pdfPage(fmt) {
    return { w: fmt.w * 0.75, h: fmt.h * 0.75 };
  }

  /**
   * carousel: is het een carousel; slides: aantal slides; fmt: { w, h } van het
   * formaat; width: exportbreedte (1080, 1200, 2160); type: 'png' | 'jpg' | 'pdf';
   * only: index van één slide ("alleen deze slide"), anders null.
   */
  function plan({ carousel = false, slides = 1, fmt, width = 1080, type = 'png', only = null } = {}) {
    const t = TYPES.includes(type) ? type : 'png';
    const w = Number(width) || 1080;
    const size = `${w} × ${Math.round((fmt.h * w) / fmt.w)} px`;
    const one = only != null;
    // LinkedIn toont een carousel als document: dan altijd één PDF met alle slides
    if (carousel && !one && w === 1200) {
      return { kind: 'pdf', type: 'pdf', pages: slides, linkedin: true, summary: `1 PDF voor LinkedIn met ${count(slides, 'pagina', "pagina's")}`, note: NOTES.linkedin };
    }
    if (t === 'pdf') {
      const pages = carousel && !one ? slides : 1;
      const what = one ? ` · slide ${only + 1}` : pages > 1 ? ` met ${count(pages, 'pagina', "pagina's")}` : '';
      return { kind: 'pdf', type: 'pdf', pages, linkedin: false, summary: `1 PDF${what} · bewerkbaar in Canva`, note: NOTES.pdf };
    }
    const up = t.toUpperCase();
    if (carousel && !one) return { kind: 'zip', type: t, pages: slides, linkedin: false, summary: `zip met ${slides} ${up}'s · ${size}`, note: NOTES.zip };
    const note = w === 2160 ? `${up} op dubbele maat, voor een groot scherm of drukwerk.` : `${DESTS[w] || 'Instagram'}: ${up} op de maat van het kanaal.`;
    return { kind: t, type: t, pages: 1, linkedin: false, summary: `1 ${up}${one ? ` · slide ${only + 1}` : ''} · ${size}`, note };
  }

  const api = { plan, pdfPage, TYPES, DESTS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) global.PMInstaExport = api;
})(typeof window !== 'undefined' ? window : globalThis);
