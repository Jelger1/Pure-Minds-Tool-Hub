/* =============================================================================
   styleguide/photos.js — de voorbeeldfoto's van het brandbook
   -----------------------------------------------------------------------------
   Echte foto's (Unsplash-licentie) voor de pagina's Logo, De zeshoek, Beeldtaal
   en Toepassingen. De lijst met fotografen staat in content.js (photos), waar
   en hoe elke foto staat in mockups.js (SLOTS). Via http(s) laden de bestanden
   uit assets/styleguide/photos, met de ingebedde kopie als terugval bij een fout.
   Vanaf schijf (file://) direct de ingebedde kopie uit
   js/styleguide/photo-data.js (npm run photos): een foto die van schijf komt,
   maakt een canvas "besmet", en dan blokkeert de browser de PDF-export.

     PMStyleguidePhotos.load()      belofte: { id: Image }. Faalt nooit: een foto
                                    die niet laadt, ontbreekt (dan staat er het
                                    lege fotovlak)
     PMStyleguidePhotos.crop(img, boxW, boxH, { cx, cy, zoom })
                                    { zoom, fx, fy }: de uitsnede zoals canvas-kit
                                    drawPhoto hem kent, met het brandpunt (cx, cy,
                                    0..1 van de foto) zo dicht mogelijk in het midden
     PMStyleguidePhotos.frame(img, w, h, opts)
                                    één canvas van w × h ontwerp-px (keer scale), in
                                    hele pixels en zonder doorzichtige randen (in de
                                    PDF dus een JPEG). De foto vult het vlak; het
                                    verloop van Inkt en de derdelijnen zitten erin
                                    gebakken. opts:
                                      cx, cy, zoom  brandpunt (zie crop), of fx, fy
                                      scale         pixels per ontwerp-px (2)
                                      side          { to, a, hold }: Inkt van links,
                                                    dekking a tot hold, 0 bij to
                                                    (delen van de breedte)
                                      shade         [[plek, dekking], …]: Inkt van
                                                    boven naar onder (0..1 van de hoogte)
                                      grid          de derdelijnen, wit op 40%
                                      hex           uitgesneden als zeshoek (punt boven),
                                                    met doorzichtige hoeken (een PNG)
   Verlopen en een uitsnede mogen hier: dit is één afbeelding, geen vector.
   ============================================================================= */
(function (global) {
  'use strict';

  const PM = global.PM;
  const INK = '48,48,48';   // Inkt (#303030)

  const list = () => (global.PM_BRAND_CONTENT && global.PM_BRAND_CONTENT.photos) || [];
  const fromDisk = () => global.location && global.location.protocol === 'file:';

  // Een gewone <script> mag ook vanaf schijf; via HTTP alleen laden bij een ontbrekende foto.
  function embedded() {
    if (global.PM_STYLEGUIDE_PHOTOS) return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = PM.url('js/styleguide/photo-data.js');
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  // Eén foto, gedecodeerd (zo tekent hij meteen); null als hij niet laadt. Vanaf schijf
  // alleen de ingebedde kopie: het bestand zelf zou de export blokkeren
  function one(src) {
    if (!src) return Promise.resolve(null);
    const img = new Image();
    img.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = src;
    const done = loaded.then(() => img.decode ? img.decode() : undefined);
    return done.then(() => (img.naturalWidth ? img : null), () => null);
  }

  let loading = null;
  function load() {
    if (!loading) {
      const photos = list();
      loading = (fromDisk() ? embedded() : Promise.resolve())
        .then(() => Promise.all(photos.map((p) => one(fromDisk()
          ? (global.PM_STYLEGUIDE_PHOTOS || {})[p.id]
          : PM.url(p.file)))))
        .then(async (imgs) => {
          if (!fromDisk() && imgs.some((img) => !img)) {
            await embedded();
            return Promise.all(imgs.map((img, i) => img || one((global.PM_STYLEGUIDE_PHOTOS || {})[photos[i].id])));
          }
          return imgs;
        })
        .then((imgs) => {
          const out = {};
          photos.forEach((p, i) => { if (imgs[i]) out[p.id] = imgs[i]; });
          return out;
        })
        .catch((err) => {
          console.warn('Foto’s voor het brandbook niet geladen:', err);
          return {};
        });
    }
    return loading;
  }

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  // Brandpunt in het midden van een vak van boxW × boxH, binnen de foto: de verschuiving als
  // deel van wat er overblijft (fx 0 = links, 1 = rechts), net als canvas-kit drawPhoto
  function crop(img, boxW, boxH, { cx = 0.5, cy = 0.5, zoom = 1 } = {}) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const s = Math.max(boxW / iw, boxH / ih) * zoom;
    const vx = boxW / (iw * s);   // zichtbaar deel van de breedte
    const vy = boxH / (ih * s);
    const f = (c, v) => (v >= 1 ? 0.5 : clamp((c - v / 2) / (1 - v), 0, 1));
    return { zoom, fx: f(cx, vx), fy: f(cy, vy) };
  }

  const ink = (a) => `rgba(${INK},${a})`;

  function frame(img, w, h, opts = {}) {
    const scale = opts.scale || 2;
    const c = document.createElement('canvas');
    // Alles in hele pixels: zo dekt de foto het canvas tot op de rand (geen doorzichtige
    // rand, dus een JPEG in de PDF)
    const W = Math.max(1, Math.round(w * scale));
    const H = Math.max(1, Math.round(h * scale));
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (opts.hex) {
      ctx.beginPath();
      global.PMCanvas.addHex(ctx, W / 2, H / 2, H / 2);
      ctx.clip();
    }
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const place = opts.cx != null || opts.cy != null
      ? crop(img, W, H, { cx: opts.cx, cy: opts.cy, zoom: opts.zoom || 1 })
      : { zoom: opts.zoom || 1, fx: opts.fx != null ? opts.fx : 0.5, fy: opts.fy != null ? opts.fy : 0.5 };
    const s = Math.max(W / iw, H / ih) * place.zoom;
    const dw = iw * s;
    const dh = ih * s;
    ctx.drawImage(img, (W - dw) * place.fx, (H - dh) * place.fy, dw, dh);
    if (opts.side) {
      // Inkt vanaf de linkerkant: de rustige kant van de foto donkerder, voor een witte kop
      const { to, a, hold = 0 } = opts.side;
      const g = ctx.createLinearGradient(0, 0, W * to, 0);
      g.addColorStop(0, ink(a));
      if (hold > 0 && hold < to) g.addColorStop(hold / to, ink(a));
      g.addColorStop(1, ink(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W * to, H);
    }
    if (opts.shade) {
      // Inkt van boven naar onder: het donkere deel onder de tekst ("onderste 40–60%")
      const g = ctx.createLinearGradient(0, 0, 0, H);
      opts.shade.forEach(([at, a]) => g.addColorStop(at, ink(a)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (opts.grid) {
      // De derdelijnen, als hulp bij de compositie
      const lw = 1.5 * scale;
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      [1, 2].forEach((k) => {
        ctx.fillRect(Math.round((W * k) / 3 - lw / 2), 0, lw, H);
        ctx.fillRect(0, Math.round((H * k) / 3 - lw / 2), W, lw);
      });
    }
    return c;
  }

  global.PMStyleguidePhotos = { load, crop, frame };
})(window);
