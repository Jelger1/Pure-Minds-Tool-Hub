/* =============================================================================
   build-brand-data.js — genereert js/shared/brand-data.js en pdf-fonts.js
   -----------------------------------------------------------------------------
   brand-data.js  De logo's die in exports terechtkomen, als data-URL. Opent
                  iemand een tool direct vanaf schijf (file://), dan blokkeert
                  de browser een export met lokale afbeeldingen; met deze kopie
                  niet. Via een server of GitHub Pages gebruiken de tools
                  gewoon de bestanden in assets/brand/.
   pdf-fonts.js   Open Sans als base64, voor de bewerkbare PDF's (jsPDF moet
                  de lettertypen zelf insluiten) en om in te sluiten in de
                  Word-bestanden. Wordt pas bij de eerste export geladen, en
                  werkt zo ook vanaf schijf en offline.

   Vervang je een logo of lettertype, draai dan:  npm run brand
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read64 = (file) => fs.readFileSync(path.join(root, file)).toString('base64');

// --- Logo's -----------------------------------------------------------------

const logos = {
  // Wit zeshoek-logo: posts en slides (altijd op een donkere achtergrond)
  logoWhite: ['assets/brand/logo/PureMinds-zeshoek-logo.png', 'image/png'],
  // Wit zeshoek-logo als vector: in de bewerkbare PDF's van posts en slides
  logoWhiteSvg: ['assets/brand/logo/PureMinds-zeshoek-logo-wit.svg', 'image/svg+xml'],
  // Zwart zeshoek-logo (vector): briefpapier van de Document Maker
  logoBlack: ['assets/brand/logo/PureMinds-zeshoek-logo-zwart.svg', 'image/svg+xml'],
};

const brand = `/* Gegenereerd door scripts/build-brand-data.js. Niet met de hand wijzigen:
   vervang het logo in assets/brand/ en draai \`npm run brand\`. */
window.PM_BRAND = {
${Object.entries(logos).map(([key, [file, mime]]) => `  ${key}: 'data:${mime};base64,${read64(file)}',`).join('\n')}
};
`;
fs.writeFileSync(path.join(root, 'js', 'shared', 'brand-data.js'), brand);
console.log(`brand-data.js geschreven (${Math.round(brand.length / 1024)} KB)`);

// --- Lettertypen voor PDF ---------------------------------------------------

// Stijlnaam in jsPDF -> bestand. De namen gebruikt js/shared/core.js (PM.pdfFontStyle).
const fonts = {
  normal: 'OpenSans-Regular.ttf',
  semibold: 'OpenSans-SemiBold.ttf',
  bold: 'OpenSans-Bold.ttf',
  extrabold: 'OpenSans-ExtraBold.ttf',
  italic: 'OpenSans-Italic.ttf',
  bolditalic: 'OpenSans-BoldItalic.ttf',
};

const pdfFonts = `/* Gegenereerd door scripts/build-brand-data.js. Niet met de hand wijzigen:
   vervang de lettertypen in assets/brand/fonts/ en draai \`npm run brand\`. */
window.PM_PDF_FONTS = {
${Object.entries(fonts).map(([style, file]) => `  ${style}: { file: '${file}', data: '${read64(`assets/brand/fonts/${file}`)}' },`).join('\n')}
};
`;
fs.writeFileSync(path.join(root, 'js', 'shared', 'pdf-fonts.js'), pdfFonts);
console.log(`pdf-fonts.js geschreven (${Math.round(pdfFonts.length / 1024)} KB)`);
