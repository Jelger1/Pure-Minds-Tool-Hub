/* =============================================================================
   styleguide/brand-tokens.js — de huisstijl als gegevens, voor de Brand Styleguide
   -----------------------------------------------------------------------------
   Eén bron voor het scherm, de brandbook-pagina's en de exports (PDF, kleuren
   als ASE en JSON). De kleuren zijn gelijk aan css/global.css en
   js/shared/brand.js; tests/styleguide.test.js bewaakt dat, net als de
   gewichten van Pure Minds Sans (de @font-face-regels in global.css).

     colors.primary     de drie hoofdkleuren met hun vaste rol
     colors.secondary   accenten, alleen voor grafieken en categorieën
     colors.neutral     wit en grijs (kleine tekst)
     ratio              de 60/30/10-verhouding
     logo               verhouding, clear space (deel van de logobreedte) en minimum
     type               de typeschaal (px op een scherm van 1440 breed)
     page               het A4-liggend raster van de brandbook-pagina's (ontwerp-px)

   CMYK is de rekenkundige omzetting van RGB, zoals in brandbook v2.0; voor
   drukwerk met een eigen profiel laat je de drukker de waarden controleren.
   Geen DOM: dit bestand laadt ook in Node (voor de tests).
   ============================================================================= */
(function (global) {
  'use strict';

  const TOKENS = {
    company: 'Pure Minds Marketing Group',
    domain: 'pureminds.nl',

    font: {
      family: 'Pure Minds Sans',
      postscript: 'PureMindsSans',
      stack: '"Pure Minds Sans", "Open Sans", Arial, sans-serif',
      fallback: 'Open Sans',
      // Alleen deze drie gewichten (plus cursief): de tools laden niet meer dan nodig
      weights: [
        { weight: 400, name: 'Regular' },
        { weight: 700, name: 'Bold' },
        { weight: 800, name: 'ExtraBold' },
      ],
    },

    colors: {
      primary: [
        { id: 'cyaan', name: 'Pure Cyaan', hex: '#1AB9E2', rgb: [26, 185, 226], cmyk: [88, 18, 0, 11], css: 'cyan', role: 'Accenten, vlakken, lijnen en markeringen' },
        { id: 'magenta', name: 'Pure Magenta', hex: '#B61B50', rgb: [182, 27, 80], cmyk: [0, 85, 56, 29], css: 'magenta', role: 'Uitsluitend de hoofdactie en nadruk' },
        { id: 'inkt', name: 'Inkt', hex: '#303030', rgb: [48, 48, 48], cmyk: [0, 0, 0, 81], css: 'ink', role: 'Lopende tekst, koppen en donkere vlakken' },
      ],
      secondary: [
        { id: 'blauw', name: 'Blauw', hex: '#1B71A8', rgb: [27, 113, 168], cmyk: [84, 33, 0, 34], css: 'blue', role: 'Grafieken en categorieën' },
        { id: 'diepblauw', name: 'Diep blauw', hex: '#005AAF', rgb: [0, 90, 175], cmyk: [100, 49, 0, 31], css: 'deep', role: 'Grafieken en categorieën' },
        { id: 'groen', name: 'Groen', hex: '#009670', rgb: [0, 150, 112], cmyk: [100, 0, 25, 41], css: 'green', role: 'Grafieken en categorieën' },
        { id: 'oranje', name: 'Oranje', hex: '#E0951F', rgb: [224, 149, 31], cmyk: [0, 33, 86, 12], css: null, role: 'Grafieken en categorieën' },
      ],
      neutral: [
        { id: 'wit', name: 'Wit', hex: '#FFFFFF', rgb: [255, 255, 255], cmyk: [0, 0, 0, 0], css: null, role: 'Achtergrond, en tekst op donker' },
        { id: 'grijs', name: 'Grijs', hex: '#5C6670', rgb: [92, 102, 112], cmyk: [18, 9, 0, 56], css: 'muted', role: 'Kleine tekst: hints, bronnen, metadata' },
      ],
    },

    // Brandbook v2.0: 60% wit en neutraal (inclusief Inkt), 30% Pure Cyaan, 10% magenta en accenten
    ratio: { neutral: 60, cyaan: 30, accent: 10 },

    logo: {
      aspect: 2229.16 / 2568.97,   // breedte / hoogte, uit de viewBox van het logo
      clearSpace: 0.25,            // X = ¼ van de logobreedte, aan alle kanten
      minDigitalPx: 80,
      minPrintMm: 20,
      hexRadius: 0.12,             // afronding van de icoonhouders, als deel van de straal
    },

    // Typeschaal, px op een scherm van 1440 breed. track = letterspatiëring als deel van het korps
    type: [
      { id: 'h1', name: 'Heading 1', weight: 800, size: 52, line: 58, track: -0.02 },
      { id: 'h2', name: 'Heading 2', weight: 700, size: 34, line: 42, track: 0 },
      { id: 'h3', name: 'Heading 3', weight: 700, size: 24, line: 32, track: 0 },
      { id: 'body', name: 'Body', weight: 400, size: 18, line: 31, track: 0 },
      { id: 'small', name: 'Small', weight: 400, size: 15, line: 24, track: 0, color: '#5C6670' },
      { id: 'label', name: 'Label', weight: 700, size: 13, line: 16, track: 0.1, upper: true },
    ],

    // A4 liggend (297 × 210 mm) in ontwerp-px: 1684 breed is 144 dpi. De PDF-export
    // zet hem op 841,89 × 595,28 pt. Het logo in de voet is 120 px breed (21 mm, boven
    // het minimum van 20 mm), met zijn clear space van 30 px eromheen
    page: { w: 1684, h: 1191, mmW: 297, mmH: 210, margin: 104, bar: 12, logoW: 120 },
  };

  // Alle kleuren in één lijst, in de volgorde van het brandbook
  TOKENS.allColors = () => [...TOKENS.colors.primary, ...TOKENS.colors.secondary, ...TOKENS.colors.neutral];
  TOKENS.color = (id) => TOKENS.allColors().find((c) => c.id === id) || null;

  if (typeof module !== 'undefined' && module.exports) module.exports = TOKENS;
  if (global && global.document) global.PM_BRAND_TOKENS = TOKENS;
})(typeof window !== 'undefined' ? window : globalThis);
