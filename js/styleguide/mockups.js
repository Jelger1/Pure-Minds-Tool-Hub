/* =============================================================================
   styleguide/mockups.js — de beelden op de pagina's: foto's en echte ontwerpen
   -----------------------------------------------------------------------------
   pages.js vraagt een beeld met env.raster(id, w, h): een canvas in precies die
   verhouding, of null zolang de foto's laden (dan tekent pages.js het lege
   fotovlak). Elk beeld is in de PDF één afbeelding in de laag Beeld.

     logo-kader, zeshoek-foto, beeld-*
               een foto, met het verloop van Inkt erin gebakken (PMStyleguidePhotos.frame)
     post-*    een echte post van de Insta Post Maker (PMTemplates.renderPost) met de
               voorbeeldteksten van die tool (content.js, usage.demo.posts)
     slide-*   een echte slide van de Presentation Maker (PMSlides.renderSlide) uit de
               voorbeeldpresentatie (PMDeck.example), zonder datum en slidenummers

     PMStyleguideMockups.ready()           belofte: { ok, missing: [foto-id's] }. Wacht
                                           eerst op de fonts (een post meet zijn tekst), dan
                                           op de foto's en het logo. Faalt nooit
     PMStyleguideMockups.raster(id, w, h)  canvas of null, bewaard per id en maat
     PMStyleguideMockups.SLOTS             per beeld: de foto, het brandpunt, het verloop,
                                           het template. Hier stel je een foto bij of
                                           vervang je hem door een andere

   Een ontwerp met een foto wordt nooit zonder zijn foto getekend: dan zou de
   aanwijzing "sleep hier je foto" van de maker in het brandbook staan. Ontbreekt
   de foto, dan geeft raster null en staat er het lege fotovlak.
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;
  const P = global.PMStyleguidePhotos;
  const C = global.PM_BRAND_CONTENT;

  // De vorm waarin een maker de foto zet (voor het brandpunt): breedte en hoogte
  const HEX = [Math.sqrt(3), 2];   // een zeshoek met de punt boven
  const POST = [1080, 1350];       // een hele post (4:5)
  const HALF = [960, 1080];        // de fotohelft van een split-slide

  /*
   * cx, cy: brandpunt in de foto (0..1), zo dicht mogelijk in het midden van het vlak.
   * side en shade: het verloop van Inkt onder de tekst (zie PMStyleguidePhotos.frame);
   * sterk genoeg dat witte tekst 4,5 : 1 haalt en het cyaan cijfer 3 : 1.
   */
  const SLOTS = {
    // Logo: wel en niet, "geen kader": een drukke foto, uitgesneden op het boeket
    'logo-kader': { photo: 'bloemist', cx: 0.46, cy: 0.6 },
    // De zeshoek, het fotokader: gezicht en handen van de vakman
    'zeshoek-foto': { photo: 'vakman-werkplaats', cx: 0.47, cy: 0.5, zoom: 1.15, hex: true },
    // Beeldtaal: de rustige kant (het raam) voor de kop; de derdelijnen erover
    'beeld-compositie': { photo: 'laptop-raam', cx: 0.55, cy: 0.55, side: { to: 0.72, a: 0.85, hold: 0.22 }, grid: true },
    // Beeldtaal: tekst op beeld, op het donkere onderste deel; de gezichten blijven vrij
    'beeld-tekst': { photo: 'team-overleg', cx: 0.47, cy: 0.42, shade: [[0, 0], [0.38, 0], [0.72, 0.78], [1, 0.92]] },
    // Beeldtaal: resultaat als cijfer, op de handen onder het scherm
    'beeld-cijfer': { photo: 'analytics-scherm', cx: 0.52, cy: 0.42, shade: [[0, 0], [0.4, 0], [0.7, 0.85], [1, 0.94]] },
    // Toepassingen: de vijf templates van de Insta Post Maker
    'post-photo': { template: 'photo', photo: 'bloemist', box: POST, cx: 0.5, cy: 0.41 },
    'post-overlay': { template: 'overlay', photo: 'team-overleg', box: POST, cx: 0.45, cy: 0.5 },
    'post-blog': { template: 'blog', photo: 'werkplek-bureau', box: HEX, cx: 0.48, cy: 0.6, zoom: 1.15 },
    'post-case': { template: 'case' },
    'post-carousel': { template: 'carousel' },
    // Toepassingen: twee slides van de Presentation Maker
    'slide-title': { layout: 'title', photo: 'vakman-werkplaats', box: HEX, cx: 0.47, cy: 0.45 },
    'slide-split': { layout: 'split', photo: 'analytics-scherm', box: HALF, cx: 0.52, cy: 0.4 },
  };

  let photos = null;   // { id: Image } zodra ready() klaar is
  let logo = null;     // het witte logo (Image) voor de posts en slides

  // Het logo als Image. PM.brandImage probeert bij een fout eerst de ingebedde kopie;
  // pas als die ook niet laadt: geen logo
  function brandImage(key) {
    return new Promise((resolve) => {
      const img = PM.brandImage(key, () => resolve(img));
      let tried = img.src;
      img.addEventListener('error', () => {
        if (img.src !== tried) tried = img.src;   // een nieuwe poging met de ingebedde kopie
        else resolve(null);
      });
    });
  }

  let loading = null;
  function ready() {
    if (!loading) {
      loading = Promise.resolve(PM.fontsReady)
        .catch(() => null)
        .then(() => Promise.all([P.load(), brandImage('logoWhite')]))
        .then(([p, l]) => {
          photos = p || {};
          logo = l;
          const missing = C.photos.map((x) => x.id).filter((id) => !photos[id]);
          if (!logo) missing.push('logo');
          return { ok: !missing.length, missing };
        })
        .catch((err) => {
          console.warn('Beelden voor het brandbook niet geladen:', err);
          photos = photos || {};
          return { ok: false, missing: C.photos.map((x) => x.id) };
        });
    }
    return loading;
  }

  // De voorbeeldslides: titel en split uit de voorbeeldpresentatie, zonder de datum achter de afzender
  function deck() {
    const example = global.PMDeck.example('');
    const pick = (layout) => ({ ...example.find((s) => s.layout === layout) });
    const title = pick('title');
    title.meta = String(title.meta || '').replace(/ · $/, '');
    return { slides: [title, pick('split')], dot: true, showNumbers: false, badge: false };
  }
  const SLIDE_INDEX = { title: 0, split: 1 };

  function build(slot, w, h) {
    const img = slot.photo ? photos[slot.photo] : null;
    if (slot.photo && !img) return null;
    const crop = img && slot.box ? P.crop(img, slot.box[0], slot.box[1], slot) : { zoom: 1, fx: 0.5, fy: 0.5 };
    if (slot.template) {
      if (!logo || !global.PMTemplates) return null;
      // Breedte een veelvoud van 4 (4:5): de post vult het canvas tot op de pixel, dus een JPEG
      const px = 4 * Math.round((2 * w) / 4);
      const c = document.createElement('canvas');
      const data = { [slot.template]: C.usage.demo.posts[slot.template] };
      global.PMTemplates.renderPost(c, { template: slot.template, format: 'portrait', dot: true, badge: false, data }, { photo: img, logo, crop }, { scale: px / 1080 });
      return c;
    }
    if (slot.layout) {
      if (!logo || !global.PMSlides || !global.PMDeck) return null;
      const px = 16 * Math.round((2 * w) / 16);   // 16:9 in hele pixels
      const c = document.createElement('canvas');
      global.PMSlides.renderSlide(c, deck(), SLIDE_INDEX[slot.layout], { logo, photo: img, crop }, { scale: px / 1920 });
      return c;
    }
    return P.frame(img, w, h, slot);
  }

  const cache = new Map();
  function raster(id, w, h) {
    if (!photos || !SLOTS[id]) return null;
    const key = `${id}|${Math.round(w)}x${Math.round(h)}`;
    if (!cache.has(key)) {
      let c = null;
      try {
        c = build(SLOTS[id], w, h);
      } catch (err) {
        console.warn(`Beeld ${id} niet getekend:`, err);
      }
      cache.set(key, c);
    }
    return cache.get(key);
  }

  global.PMStyleguideMockups = { ready, raster, SLOTS };
})(window);
