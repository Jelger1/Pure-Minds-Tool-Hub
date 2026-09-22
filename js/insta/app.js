/* =============================================================================
   app.js — Pure Minds Post Maker
   -----------------------------------------------------------------------------
   Houdt de toestand bij (template, teksten per template, formaat, uitsnede),
   koppelt die aan de invoervelden, en laat templates.js de preview, de
   miniaturen en de export tekenen. Teksten en instellingen staan in
   localStorage, de foto en het klantlogo in IndexedDB: alles overleeft een
   herlaadbeurt.
   ============================================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const T = window.PMTemplates;
  const STORAGE_KEY = 'pm-postmaker-v1';
  const PHOTO_KEY = 'insta:photo';
  const LOGO_KEY = 'insta:clientLogo';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const wait = PM.wait;

  const TEMPLATE_NAMES = Object.fromEntries(T.TEMPLATE_META.map((t) => [t.id, t.name]));
  const DESTS = { 1080: 'Instagram', 1200: 'LinkedIn', 2160: 'extra scherp' };

  function defaults() {
    return {
      template: 'overlay',
      format: 'square',
      dot: true,
      crop: { zoom: 1, fx: 0.5, fy: 0.5 },
      exportType: 'png',
      exportWidth: 1080,
      data: {
        photo: { style: 'full', label: '' },
        overlay: {
          label: '',
          title: 'Onze nieuwe **Google Ads-audit** is live',
          subtitle: 'In twee weken weet je precies waar je advertentiebudget weglekt.',
          strength: 80,
          position: 'bottom',
          decor: true,
        },
        blog: {
          label: 'pure blog',
          title: '5 signalen dat je landingspagina conversies laat liggen',
          topic: 'conversie-optimalisatie',
          cta: 'Lees onze nieuwe blog over {onderwerp} op de website.',
          button: 'lees de blog',
        },
        case: {
          label: 'pure case',
          client: 'Studio Noord',
          services: ['Google Ads', 'een nieuwe landingspagina', ''],
          sentence: 'Voor {klant} hebben wij {diensten} gedaan.',
          resultValue: '+184%',
          resultLabel: 'meer aanvragen binnen drie maanden',
          photoBg: false,
        },
        carousel: {
          label: 'pure kennis',
          active: 0,
          slides: [
            { title: 'Zo schrijf je een advertentie die wél klikt', body: 'Vijf lessen uit honderden Google Ads-accounts. Swipe mee.', last: false },
            { title: 'Begin met het zoekwoord', body: 'Laat het **zoekwoord** terugkomen in je eerste kop.\n- herkenbaar voor de zoeker\n- hogere kwaliteitsscore\n- lagere klikprijs', last: false },
            { title: 'Hulp nodig bij je campagnes?', body: 'Plan een gratis adviesgesprek via **pureminds.nl**.', last: true },
          ],
        },
      },
    };
  }

  /* ---------------------------------------------------------------------------
     Toestand en opslag
     ------------------------------------------------------------------------- */

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  // Opgeslagen waarden over de standaard heen leggen, zodat nieuwe velden
  // uit een latere versie altijd een waarde hebben
  function merge(base, saved) {
    if (!isObj(saved)) return base;
    for (const key of Object.keys(base)) {
      if (!(key in saved)) continue;
      if (isObj(base[key])) base[key] = merge(base[key], saved[key]);
      else if (Array.isArray(base[key])) base[key] = Array.isArray(saved[key]) ? saved[key] : base[key];
      else if (typeof saved[key] === typeof base[key]) base[key] = saved[key];
    }
    return base;
  }

  function load() {
    const state = defaults();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) merge(state, JSON.parse(raw));
    } catch (err) {
      /* geen opslag beschikbaar (privévenster): gewoon met de standaard verder */
    }
    const c = state.data.carousel;
    c.slides = c.slides.filter(isObj).map((s) => ({ title: String(s.title || ''), body: String(s.body || ''), last: false }));
    if (!c.slides.length) c.slides = defaults().data.carousel.slides;
    c.active = Math.min(Math.max(0, c.active | 0), c.slides.length - 1);
    // Oude standaardlabels uit een eerdere versie bijwerken
    if (state.data.blog.label === 'nieuwe blog') state.data.blog.label = 'pure blog';
    if (state.data.case.label === 'case') state.data.case.label = 'pure case';
    if (state.data.overlay.label === 'aankondiging') state.data.overlay.label = '';
    if (!T.TEMPLATE_META.some((t) => t.id === state.template)) state.template = 'overlay';
    if (!T.FORMATS[state.format]) state.format = 'square';
    if (!DESTS[state.exportWidth]) state.exportWidth = 1080;
    return state;
  }

  let state = load();
  // Gestart vanaf het dashboard (?template=carousel&format=portrait): meteen het
  // goede template en formaat. Pas opgeslagen bij de eerste wijziging.
  const start = PM.startParams();
  if (T.TEMPLATE_META.some((t) => t.id === start.template)) state.template = start.template;
  if (T.FORMATS[start.format]) state.format = start.format;
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (err) {
        /* opslag vol of geblokkeerd: niet erg, alleen niet onthouden */
      }
    }, 300);
  }

  const env = { logo: null, photo: null, clientLogo: null };
  const current = () => state.data[state.template];
  const carousel = () => state.data.carousel;
  const isCarousel = () => state.template === 'carousel';

  // De laatste slide toont pureminds.nl in plaats van de swipe-aanwijzing; dat
  // volgt uit de volgorde, dus het kan niet meer vergeten of verkeerd staan
  function syncLast() {
    const slides = carousel().slides;
    slides.forEach((s, i) => { s.last = i === slides.length - 1; });
  }
  syncLast();

  // Templates waarin de foto het beeld draagt; bij de case alleen als achtergrond
  const needsPhoto = () => ['photo', 'overlay', 'blog'].includes(state.template)
    || (state.template === 'case' && !!state.data.case.photoBg);

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] == null ? (o[k] = {}) : o[k]), obj);
    target[last] = value;
  }

  /* ---------------------------------------------------------------------------
     Elementen
     ------------------------------------------------------------------------- */

  const el = {
    editor: $('#editor'),
    canvas: $('#postCanvas'),
    stage: $('#stage'),
    tplPill: $('#tplPill'),
    dimPill: $('#dimPill'),
    warning: $('#warning'),
    toast: $('#toast'),
    strip: $('#slideStrip'),
    slideNav: $('#slideNav'),
    slideNo: $('#slideNo'),
    sTitle: $('#sTitle'),
    sBody: $('#sBody'),
    dot: $('#dotToggle'),
    photoDrop: $('#photoDrop'),
    photoInput: $('#photoInput'),
    photoCard: $('#photoCard'),
    photoThumb: $('#photoThumb'),
    photoName: $('#photoName'),
    photoSize: $('#photoSize'),
    previewPhotoBtn: $('#previewPhotoBtn'),
    cropControls: $('#cropControls'),
    cropHint: $('#cropHint'),
    clientLogoBtn: $('#clientLogoBtn'),
    clientLogoInput: $('#clientLogoInput'),
    clientLogoThumb: $('#clientLogoThumb'),
    clientLogoName: $('#clientLogoName'),
    clientLogoClear: $('#clientLogoClear'),
    downloadBtn: $('#downloadBtn'),
    slideBtn: $('#slideBtn'),
    copyBtn: $('#copyBtn'),
    exportNote: $('#exportNote'),
  };

  /* ---------------------------------------------------------------------------
     Renderen
     ------------------------------------------------------------------------- */

  let lastInfo = {};
  let frameRequest = 0;
  let thumbTimer = 0;

  const renderEnv = (extra = {}) => ({ ...env, crop: state.crop, ...extra });

  function render() {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      lastInfo = T.renderPost(el.canvas, state, renderEnv());
      const fmt = T.FORMATS[state.format];
      el.canvas.style.setProperty('--ar', String(fmt.w / fmt.h));
      $$('[data-for-format]').forEach((n) => { n.hidden = n.dataset.forFormat !== state.format; });
      el.canvas.classList.toggle('can-pan', !!lastInfo.photo);
      const w = Number(state.exportWidth) || 1080;
      el.dimPill.textContent = `${w} × ${Math.round((fmt.h * w) / fmt.w)} px`;
      el.tplPill.textContent = isCarousel()
        ? `${TEMPLATE_NAMES.carousel} · slide ${carousel().active + 1}/${carousel().slides.length}`
        : TEMPLATE_NAMES[state.template];
      syncPhotoPrompt();
      updateWarning();
      mini.update();
    });
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(renderThumbs, 160);
  }

  // Miniaturen tonen elk template met jouw inhoud, in het gekozen formaat
  // (een story staat rechtop in het vakje, niet als vierkant)
  const thumbBuffer = document.createElement('canvas');
  function renderThumbs() {
    const fmt = T.FORMATS[state.format];
    const scale = Math.min(240 / fmt.w, 240 / fmt.h);
    for (const canvas of $$('[data-thumb]')) {
      T.renderPost(thumbBuffer, { ...state, template: canvas.dataset.thumb }, renderEnv(), { scale });
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#edf3f7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(thumbBuffer, (canvas.width - thumbBuffer.width) / 2, (canvas.height - thumbBuffer.height) / 2);
    }
    if (isCarousel()) renderStrip();
  }

  // Mobiel: kleine live preview zolang de grote uit beeld is (gedeeld, zie PM.miniPreview)
  const mini = PM.miniPreview(el.stage, el.canvas);

  function renderStrip() {
    const slides = carousel().slides;
    const fmt = T.FORMATS[state.format];
    const items = $$('.strip__item', el.strip);
    slides.forEach((_, i) => {
      let btn = items[i];
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'strip__item';
        btn.appendChild(document.createElement('canvas'));
        btn.addEventListener('click', () => selectSlide(Number(btn.dataset.index)));
        el.strip.appendChild(btn);
      }
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', `Slide ${i + 1}`);
      btn.setAttribute('aria-current', String(i === carousel().active));
      T.renderPost(btn.firstChild, { ...state, template: 'carousel' }, renderEnv({ slideIndex: i }), { scale: 144 / fmt.w });
    });
    items.slice(slides.length).forEach((b) => b.remove());
  }

  // Alleen echte problemen als waarschuwing; een lege fotoplek is geen fout
  function updateWarning() {
    const overflow = lastInfo.overflow;
    el.warning.hidden = !overflow;
    el.warning.textContent = overflow ? 'De tekst is te lang voor dit vak en is zo klein mogelijk gemaakt. Kort hem in voor een rustiger ontwerp.' : '';
  }

  // Lege fotoplek: de preview zelf is de uploadknop, zoals een placeholder in Canva
  function syncPhotoPrompt() {
    const empty = needsPhoto() && !env.photo;
    el.previewPhotoBtn.hidden = !empty;
    el.canvas.classList.toggle('needs-photo', empty);
    el.canvas.title = empty ? 'Klik om een foto te kiezen, of sleep er een hierheen' : '';
    el.canvas.tabIndex = empty || lastInfo.photo ? 0 : -1;
    el.canvas.setAttribute('aria-label', empty
      ? 'Preview van de post. Druk op Enter om een foto te kiezen.'
      : lastInfo.photo ? 'Preview van de post. Verschuif de foto met de pijltjestoetsen.' : 'Preview van de post');
  }

  /* ---------------------------------------------------------------------------
     Velden <-> toestand
     ------------------------------------------------------------------------- */

  function syncVisibility() {
    for (const node of $$('[data-for]')) {
      node.hidden = !node.dataset.for.split(/\s+/).includes(state.template);
    }
    $('.preview').dataset.template = state.template;
    // Stappen doornummeren: alleen de zichtbare
    $$('fieldset.block:not([hidden]) [data-step]', el.editor).forEach((badge, i) => {
      badge.textContent = String(i + 1);
    });
    syncExport();
  }

  function syncInputs() {
    const data = current();
    for (const input of $$('[data-bind]', el.editor)) {
      const value = getPath(data, input.dataset.bind);
      if (input.type === 'checkbox') input.checked = !!value;
      else if (input.type === 'radio') input.checked = input.value === value;
      else input.value = value == null ? '' : String(value);
    }
    $$('input[name="template"]').forEach((r) => { r.checked = r.value === state.template; });
    $$('input[name="format"]').forEach((r) => { r.checked = r.value === state.format; });
    $$('input[name="exportType"]').forEach((r) => { r.checked = r.value === state.exportType; });
    $$('input[name="dest"]').forEach((r) => { r.checked = Number(r.value) === Number(state.exportWidth); });
    el.dot.checked = state.dot !== false;
    syncCrop();
    syncSlides();
  }

  function syncCrop() {
    $('#cropZoom').value = String(Math.round(state.crop.zoom * 100));
    syncOutputs();
  }

  function syncOutputs() {
    $('#cropZoomVal').textContent = `${Math.round(state.crop.zoom * 100)}%`;
    $('#oStrengthVal').textContent = `${state.data.overlay.strength}%`;
  }

  el.editor.addEventListener('submit', (e) => e.preventDefault());

  el.editor.addEventListener('input', (e) => {
    const input = e.target;
    if (input.dataset.bind) {
      let value = input.value;
      if (input.type === 'checkbox') value = input.checked;
      else if (input.type === 'range') value = Number(value);
      else if (input.type === 'radio' && !input.checked) return;
      setPath(current(), input.dataset.bind, value);
      syncOutputs();
      changed();
    } else if (input.dataset.crop) {
      state.crop[input.dataset.crop] = Number(input.value) / 100;
      syncOutputs();
      changed();
    }
  });

  // Radio's en checkboxes vuren 'change'; niet alle browsers ook 'input'
  el.editor.addEventListener('change', (e) => {
    const input = e.target;
    if (input.name === 'template' && input.checked) {
      state.template = input.value;
      syncVisibility();
      syncInputs();
      changed();
    } else if (input.name === 'format' && input.checked) {
      state.format = input.value;
      changed();
    } else if (input === el.dot) {
      state.dot = input.checked;
      changed();
    } else if (input.dataset.bind && (input.type === 'checkbox' || input.type === 'radio')) {
      if (input.type === 'radio' && input.checked) setPath(current(), input.dataset.bind, input.value);
      if (input.type === 'checkbox') setPath(current(), input.dataset.bind, input.checked);
      changed();
    }
  });

  function changed() {
    save();
    render();
  }

  // Knoppen "cyaan", "vet" en "+ klant" (gedeeld, zie PM.textTools)
  PM.textTools(el.editor);

  /* ---------------------------------------------------------------------------
     Carousel-slides
     ------------------------------------------------------------------------- */

  function syncSlides() {
    const c = carousel();
    const slide = c.slides[c.active];
    el.slideNav.textContent = '';
    c.slides.forEach((s, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `slide-tab${s.last ? ' is-last' : ''}`;
      tab.textContent = String(i + 1).padStart(2, '0');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(i === c.active));
      tab.setAttribute('aria-label', `Slide ${i + 1}${s.last ? ' (laatste slide)' : ''}`);
      tab.addEventListener('click', () => selectSlide(i));
      el.slideNav.appendChild(tab);
    });
    if (c.slides.length < 20) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'slide-tab slide-tab--add';
      add.textContent = '+';
      add.title = 'Slide toevoegen';
      add.setAttribute('aria-label', 'Slide toevoegen');
      add.addEventListener('click', addSlide);
      el.slideNav.appendChild(add);
    }
    el.slideNo.textContent = `slide ${c.active + 1} van ${c.slides.length}`;
    el.sTitle.value = slide.title;
    el.sBody.value = slide.body;
    $('#slideLeft').disabled = c.active === 0;
    $('#slideRight').disabled = c.active === c.slides.length - 1;
    $('#slideDel').disabled = c.slides.length === 1;
  }

  // Na elke wijziging in de volgorde: laatste slide opnieuw bepalen
  function slidesChanged() {
    syncLast();
    syncSlides();
    changed();
  }

  function selectSlide(i) {
    const c = carousel();
    c.active = Math.min(Math.max(0, i), c.slides.length - 1);
    syncSlides();
    changed();
  }

  function addSlide() {
    const c = carousel();
    c.slides.splice(c.active + 1, 0, { title: '', body: '', last: false });
    c.active += 1;
    slidesChanged();
    el.sTitle.focus();
  }

  el.sTitle.addEventListener('input', (e) => {
    e.stopPropagation();
    carousel().slides[carousel().active].title = el.sTitle.value;
    changed();
  });
  el.sBody.addEventListener('input', (e) => {
    e.stopPropagation();
    carousel().slides[carousel().active].body = el.sBody.value;
    changed();
  });

  function moveSlide(delta) {
    const c = carousel();
    const to = c.active + delta;
    if (to < 0 || to >= c.slides.length) return;
    const [slide] = c.slides.splice(c.active, 1);
    c.slides.splice(to, 0, slide);
    c.active = to;
    slidesChanged();
  }
  $('#slideLeft').addEventListener('click', () => moveSlide(-1));
  $('#slideRight').addEventListener('click', () => moveSlide(1));
  $('#slideDup').addEventListener('click', () => {
    const c = carousel();
    if (c.slides.length >= 20) return;
    c.slides.splice(c.active + 1, 0, { ...c.slides[c.active] });
    c.active += 1;
    slidesChanged();
  });
  $('#slideDel').addEventListener('click', () => {
    const c = carousel();
    if (c.slides.length === 1) return;
    c.slides.splice(c.active, 1);
    c.active = Math.min(c.active, c.slides.length - 1);
    slidesChanged();
  });

  /* ---------------------------------------------------------------------------
     Foto en klantlogo: bewaard in IndexedDB, dus ook na herladen terug
     ------------------------------------------------------------------------- */

  // De bestanden zelf, zodat "ongedaan maken" na alles wissen ze terug kan zetten
  const files = { photo: null, logo: null };

  async function setPhoto(file, { restore = false } = {}) {
    try {
      const { img, url } = await PM.readImage(file);
      if (env.photoUrl) URL.revokeObjectURL(env.photoUrl);
      files.photo = file;
      env.photo = img;
      env.photoUrl = url;
      el.photoThumb.style.backgroundImage = `url("${url}")`;
      el.photoName.textContent = file.name || 'foto';
      el.photoSize.textContent = `${img.naturalWidth} × ${img.naturalHeight} px${file.size ? ` · ${PM.formatSize(file.size)}` : ''}`;
      el.photoCard.hidden = false;
      el.photoDrop.hidden = true;
      el.cropControls.hidden = false;
      el.cropHint.hidden = false;
      if (!restore) {
        state.crop = { zoom: 1, fx: 0.5, fy: 0.5 };
        PM.idb.set(PHOTO_KEY, file);
        if (Math.min(img.naturalWidth, img.naturalHeight) < 1080) toast('Let op: deze foto is kleiner dan 1080 px en kan onscherp worden.');
        if (isCarousel()) toast('Foto bewaard. De carousel gebruikt geen foto; kies een ander template om hem te zien.');
      }
      syncCrop();
      changed();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function clearPhoto() {
    if (env.photoUrl) URL.revokeObjectURL(env.photoUrl);
    files.photo = null;
    env.photo = null;
    env.photoUrl = null;
    el.photoCard.hidden = true;
    el.photoDrop.hidden = false;
    el.cropControls.hidden = true;
    el.cropHint.hidden = true;
    el.photoInput.value = '';
    PM.idb.del(PHOTO_KEY);
    render();
  }

  const pickPhoto = () => el.photoInput.click();
  el.photoDrop.addEventListener('click', pickPhoto);
  el.photoDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickPhoto();
    }
  });
  el.previewPhotoBtn.addEventListener('click', pickPhoto);
  $('#photoReplace').addEventListener('click', pickPhoto);
  $('#photoClear').addEventListener('click', clearPhoto);
  el.photoInput.addEventListener('change', () => {
    if (el.photoInput.files[0]) setPhoto(el.photoInput.files[0]);
    el.photoInput.value = '';
  });

  $('#cropReset').addEventListener('click', () => {
    state.crop = { zoom: 1, fx: 0.5, fy: 0.5 };
    syncCrop();
    changed();
  });

  async function setClientLogo(file, { restore = false } = {}) {
    try {
      const { img, url } = await PM.readImage(file);
      if (env.clientLogoUrl) URL.revokeObjectURL(env.clientLogoUrl);
      files.logo = file;
      env.clientLogo = img;
      env.clientLogoUrl = url;
      el.clientLogoThumb.style.backgroundImage = `url("${url}")`;
      el.clientLogoBtn.classList.add('has-file');
      el.clientLogoName.textContent = file.name || 'klantlogo';
      el.clientLogoClear.hidden = false;
      if (!restore) PM.idb.set(LOGO_KEY, file);
      render();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function clearClientLogo() {
    if (env.clientLogoUrl) URL.revokeObjectURL(env.clientLogoUrl);
    files.logo = null;
    env.clientLogo = null;
    env.clientLogoUrl = null;
    el.clientLogoThumb.style.backgroundImage = '';
    el.clientLogoBtn.classList.remove('has-file');
    el.clientLogoName.textContent = 'logo kiezen';
    el.clientLogoClear.hidden = true;
    PM.idb.del(LOGO_KEY);
    render();
  }

  el.clientLogoBtn.addEventListener('click', () => el.clientLogoInput.click());
  el.clientLogoInput.addEventListener('change', () => {
    const file = el.clientLogoInput.files[0];
    el.clientLogoInput.value = '';
    if (file) setClientLogo(file);
  });
  el.clientLogoClear.addEventListener('click', clearClientLogo);

  // Slepen: foto op de uploadzone of de preview, logo op de logoknop
  PM.bindDrop(el.photoDrop, setPhoto);
  PM.bindDrop(el.stage, setPhoto);
  PM.bindDrop(el.clientLogoBtn, setClientLogo);
  PM.preventStrayDrops();

  // Plakken vanaf het klembord (niet als je in een tekstveld plakt)
  document.addEventListener('paste', (e) => {
    const item = Array.from(e.clipboardData ? e.clipboardData.items : []).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    setPhoto(item.getAsFile());
  });

  // Lege fotoplek: klikken op de preview kiest een foto
  el.canvas.addEventListener('click', () => {
    if (needsPhoto() && !env.photo) pickPhoto();
  });

  // Uitsnede verschuiven door in de preview te slepen
  let pan = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    if (!lastInfo.photo) return;
    pan = { x: e.clientX, y: e.clientY, fx: state.crop.fx, fy: state.crop.fy };
    el.canvas.setPointerCapture(e.pointerId);
    el.canvas.classList.add('is-panning');
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (!pan || !lastInfo.photo) return;
    const k = el.canvas.width / el.canvas.getBoundingClientRect().width;
    const { overflowX, overflowY } = lastInfo.photo;
    if (overflowX > 0.5) state.crop.fx = Math.min(1, Math.max(0, pan.fx - ((e.clientX - pan.x) * k) / overflowX));
    if (overflowY > 0.5) state.crop.fy = Math.min(1, Math.max(0, pan.fy - ((e.clientY - pan.y) * k) / overflowY));
    render();
  });
  const endPan = () => {
    if (!pan) return;
    pan = null;
    el.canvas.classList.remove('is-panning');
    save();
  };
  el.canvas.addEventListener('pointerup', endPan);
  el.canvas.addEventListener('pointercancel', endPan);

  // Met het toetsenbord: Enter kiest een foto, pijltjes verschuiven hem
  el.canvas.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && needsPhoto() && !env.photo) {
      e.preventDefault();
      pickPhoto();
      return;
    }
    const dir = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!dir || !lastInfo.photo) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.02;
    state.crop.fx = Math.min(1, Math.max(0, state.crop.fx + dir[0] * step));
    state.crop.fy = Math.min(1, Math.max(0, state.crop.fy + dir[1] * step));
    changed();
  });

  /* ---------------------------------------------------------------------------
     Export: kies waarvoor, dan één duidelijke hoofdactie met feedback op de knop
     ------------------------------------------------------------------------- */

  // LinkedIn toont een carousel als document, Instagram als losse afbeeldingen
  const carouselAsPdf = () => isCarousel() && Number(state.exportWidth) === 1200;

  function syncExport() {
    const label = $('[data-label]', el.downloadBtn);
    const dest = DESTS[state.exportWidth] || 'Instagram';
    if (!isCarousel()) {
      label.textContent = 'download post';
      el.exportNote.innerHTML = `${state.exportType.toUpperCase()} voor ${PM.esc(dest)}<span class="for-mouse"> &middot; <kbd>Ctrl</kbd> + <kbd>S</kbd> downloadt direct</span>`;
    } else if (carouselAsPdf()) {
      label.textContent = 'download pdf voor LinkedIn';
      el.exportNote.textContent = 'LinkedIn toont een carousel als document: maak een bericht, kies "document toevoegen" en upload deze PDF.';
    } else {
      label.textContent = 'download alle slides';
      el.exportNote.textContent = 'Je krijgt één zip met alle slides op volgorde. Upload ze samen als één carousel-bericht.';
    }
  }

  $$('input[name="exportType"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.exportType = r.value;
    syncExport();
    save();
  }));
  $$('input[name="dest"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.exportWidth = Number(r.value);
    syncExport();
    changed();
  }));

  const slug = PM.slug;

  function fileName(slideIndex, w, h) {
    const d = current();
    let subject = d.title || d.client || d.label;
    if (isCarousel()) subject = carousel().slides[0].title;
    const parts = ['pureminds', state.template, slug(subject)];
    if (slideIndex != null) parts.push(`slide-${String(slideIndex + 1).padStart(2, '0')}`);
    parts.push(`${w}x${h}`);
    return `${parts.filter(Boolean).join('-')}.${state.exportType === 'jpg' ? 'jpg' : 'png'}`;
  }

  async function makeBlob(slideIndex, type) {
    await fontsReady;
    const scale = (Number(state.exportWidth) || 1080) / 1080;
    const canvas = document.createElement('canvas');
    T.renderPost(canvas, state, renderEnv(slideIndex != null ? { slideIndex } : {}), { scale });
    const mime = (type || state.exportType) === 'jpg' ? 'image/jpeg' : 'image/png';
    let blob;
    try {
      blob = await PM.canvasToBlob(canvas, mime, 0.92);
    } catch (err) {
      throw err.name === 'SecurityError' ? PM.fileProtocolError() : err;
    }
    return { blob, name: fileName(slideIndex, canvas.width, canvas.height) };
  }

  const saveFile = ({ blob, name }) => PM.saveBlob(blob, name);

  const run = PM.run;
  // Na een export de (mogelijk intussen gewijzigde) knoptekst herstellen
  document.querySelector('.export').addEventListener('pm:run-end', () => syncExport());

  function downloadSingle(button, index) {
    return run(button, 'bezig…', async () => {
      const file = await makeBlob(index);
      saveFile(file);
      toast(`Gedownload: ${file.name}`);
      return 'gedownload';
    });
  }

  // Alle slides in één zip: geen reeks losse downloads die de browser blokkeert
  function downloadZip() {
    return run(el.downloadBtn, 'slides maken…', async (progress) => {
      const JSZip = await PM.libs.jszip();
      const zip = new JSZip();
      const slides = carousel().slides;
      for (let i = 0; i < slides.length; i++) {
        progress(`slide ${i + 1} van ${slides.length}…`);
        const file = await makeBlob(i);
        zip.file(file.name, file.blob);
      }
      progress('inpakken…');
      const blob = await zip.generateAsync({ type: 'blob' });
      const name = `pureminds-carousel-${slug(slides[0].title) || 'slides'}.zip`;
      saveFile({ blob, name });
      toast(`${slides.length} slides gedownload in ${name}`);
      return `${slides.length} slides gedownload`;
    });
  }

  // LinkedIn-carousel als PDF: één pagina per slide, vector met echte tekst
  function downloadPdf() {
    return run(el.downloadBtn, 'pdf maken…', async (progress) => {
      const JsPDF = await PM.libs.svg2pdf();
      await fontsReady;
      const fmt = T.FORMATS[state.format];
      const pw = fmt.w * 0.75;  // px -> pt
      const ph = fmt.h * 0.75;
      const orientation = pw > ph ? 'landscape' : 'portrait';
      const pdf = new JsPDF({ unit: 'pt', format: [pw, ph], orientation, compress: true, putOnlyUsedFonts: true });
      await PM.pdfFonts(pdf);
      const vectors = new Map([[env.logo, PM.brandSvg('logoWhiteSvg')]]);
      const slides = carousel().slides;
      for (let i = 0; i < slides.length; i++) {
        progress(`slide ${i + 1} van ${slides.length}…`);
        await wait(0);
        if (i > 0) pdf.addPage([pw, ph], orientation);
        const ctx = new window.PMPdfCanvas(pdf, { width: fmt.w, height: fmt.h, pageWidth: pw, vectors });
        T.renderPost(ctx.canvas, { ...state, template: 'carousel' }, renderEnv({ slideIndex: i }));
        await ctx.flush();
      }
      const title = String(slides[0].title || 'carousel').replace(/\*\*/g, '');
      pdf.setProperties({ title, author: 'Pure Minds', creator: 'Pure Minds Generator Hub' });
      const name = `pureminds-carousel-${slug(title) || 'slides'}.pdf`;
      saveFile({ blob: pdf.output('blob'), name });
      toast(`PDF met ${slides.length} slides gedownload: ${name}`);
      return 'pdf gedownload';
    });
  }

  function primaryAction() {
    if (!isCarousel()) return downloadSingle(el.downloadBtn, null);
    return carouselAsPdf() ? downloadPdf() : downloadZip();
  }

  el.downloadBtn.addEventListener('click', primaryAction);
  el.slideBtn.addEventListener('click', () => downloadSingle(el.slideBtn, carousel().active));

  el.copyBtn.addEventListener('click', () => run(el.copyBtn, 'kopiëren…', async () => {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('Kopiëren naar het klembord werkt niet in deze browser. Gebruik download.');
    }
    const index = isCarousel() ? carousel().active : null;
    // Klembord accepteert alleen PNG
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': makeBlob(index, 'png').then((f) => f.blob) })]);
    return 'gekopieerd';
  }));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      primaryAction();
    }
  });

  /* ---------------------------------------------------------------------------
     Overig
     ------------------------------------------------------------------------- */

  const toast = PM.toast;

  // Alles wissen gaat meteen, met "ongedaan maken" in de melding in plaats van
  // een vraag vooraf: teksten, foto en klantlogo blijven zolang in het geheugen
  $('#resetBtn').addEventListener('click', () => {
    const before = JSON.parse(JSON.stringify(state));
    const kept = { ...files };
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      /* niets */
    }
    state = defaults();
    syncLast();
    clearPhoto();
    clearClientLogo();
    syncVisibility();
    syncInputs();
    render();
    toast('Alles gewist; je begint opnieuw met de voorbeelden.', false, {
      label: 'ongedaan maken',
      run: async () => {
        state = before;
        syncVisibility();
        syncInputs();
        save();
        render();
        if (kept.photo) {
          PM.idb.set(PHOTO_KEY, kept.photo);
          await setPhoto(kept.photo, { restore: true });
        }
        if (kept.logo) {
          PM.idb.set(LOGO_KEY, kept.logo);
          await setClientLogo(kept.logo, { restore: true });
        }
      },
    });
  });

  // Logo: het bestand via een server; bij file:// de ingebedde kopie, anders
  // blokkeert de browser de export (zie scripts/build-brand-data.js)
  env.logo = PM.brandImage('logoWhite', render);

  // Canvas kent alleen fonts die al geladen zijn: eerst laden, dan opnieuw tekenen
  const fontsReady = PM.fontsReady;
  fontsReady.then(render);

  syncVisibility();
  syncInputs();
  render();

  // Foto en klantlogo uit een vorige sessie terugzetten
  PM.idb.get(PHOTO_KEY).then((blob) => { if (blob instanceof Blob) setPhoto(blob, { restore: true }); });
  PM.idb.get(LOGO_KEY).then((blob) => { if (blob instanceof Blob) setClientLogo(blob, { restore: true }); });
})();
