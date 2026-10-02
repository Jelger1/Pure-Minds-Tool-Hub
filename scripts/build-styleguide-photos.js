/* =============================================================================
   build-styleguide-photos.js — genereert js/styleguide/photo-data.js
   -----------------------------------------------------------------------------
   De voorbeeldfoto's van het brandbook (assets/styleguide/photos, de lijst in
   js/styleguide/content.js) als data-URL. Opent iemand de Brand Styleguide
   direct vanaf schijf (file://), dan blokkeert de browser een export met een
   foto van schijf; met deze kopie niet. Via een server of GitHub Pages laadt de
   styleguide gewoon de bestanden. Los van brand-data.js, dat elke tool laadt:
   deze foto's zijn alleen voor de styleguide.

   Vervang je een foto, draai dan:  npm run photos
   ============================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const C = require('../js/styleguide/content.js');

const lines = C.photos.map((p) => {
  const bytes = fs.readFileSync(path.join(root, p.file));
  // Alleen JPEG: de PDF neemt de foto's dan als JPEG over
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`${p.file} is geen JPEG`);
  return `  '${p.id}': 'data:image/jpeg;base64,${bytes.toString('base64')}',`;
});

const out = `/* Gegenereerd door scripts/build-styleguide-photos.js. Niet met de hand wijzigen: vervang de foto in assets/styleguide/photos/ en draai \`npm run photos\`.
   Alleen voor file:// (de styleguide vanaf schijf): js/styleguide/photos.js laadt dit bestand dan, omdat een foto van schijf de PDF-export blokkeert. */
window.PM_STYLEGUIDE_PHOTOS = {
${lines.join('\n')}
};
`;
fs.writeFileSync(path.join(root, 'js', 'styleguide', 'photo-data.js'), out);
console.log(`photo-data.js geschreven: ${C.photos.length} foto's (${(out.length / 1048576).toFixed(2)} MB)`);
