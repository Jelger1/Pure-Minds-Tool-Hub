/* =============================================================================
   presentation/app.js — Presentation Maker
   -----------------------------------------------------------------------------
   Houdt de presentatie bij (slides met layout, tekst, uitsnede en foto),
   koppelt die aan de velden en laat js/presentation/templates.js de slide,
   de miniaturen en de export tekenen. Tekst staat in localStorage, foto's in
   IndexedDB, zodat alles een herlaadbeurt overleeft.

   De editor is de gedeelde indeling (js/shared/shell.js): rail met vier
   onderdelen (layout, inhoud, foto, presentatie), één paneel, de slide op het
   podium en daaronder de strook met slides. Tekstvelden tonen nadruk zoals
   hij is (richfield.js), met de werkbalk (toolbar.js) boven de slide. Klik op
   de slide op een tekst, een cel of de foto en je staat in het goede veld.

   Ongedaan maken: PM.history over de hele presentatie (slides, volgorde,
   layouts, tekst, tabel, uitsnede, foto's). Elke foto staat in IndexedDB onder
   een eigen sleutel (slide.photoKey); een oude foto blijft bewaard zolang hij
   in de geschiedenis kan terugkomen en wordt pas bij de volgende keer laden
   opgeruimd. Vóór elke download controleert de tool op voorbeeldtekst,
   [invulplekken] en tekst die niet past (js/presentation/deck.js).
   ============================================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const S = window.PMSlides;
  const D = window.PMDeck;
  const KEY = 'pm-presentation-v1';
  const FILES_KEY = 'pm-presentation-files-v1';   // alle fotosleutels in IndexedDB (om op te ruimen)
  const TOUR_KEY = 'pm-tour-presentation-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const toast = PM.toast;
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  const PHOTO_LAYOUTS = new Set(['title', 'split', 'closing']);
  const MAX_SLIDES = 40;
  const SIZES = ['klein', 'normaal', 'groot'];
  const legacyKey = (id) => `slide:${id}`;   // foto's van vóór de sleutels per foto

  // Hoe je een layout noemt in een zin ("Een opsomming heeft geen foto")
  const NOUN = { section: 'Een sectieslide', bullets: 'Een opsomming', quote: 'Een citaat of kerncijfer', table: 'Een tabel' };

  /* ---------------------------------------------------------------------------
     Toestand
     ------------------------------------------------------------------------- */

  function newSlide(layout, fields = {}) {
    return {
      id: PM.uid(),
      layout,
      label: '',
      title: '',
      subtitle: '',
      body: '',
      meta: '',
      quote: '',
      author: '',
      value: '',
      style: 'quote',
      imageSide: 'left',
      crop: { zoom: 1, fx: 0.5, fy: 0.5 },
      table: S.defaultTable(),
      titleSize: 'normaal',   // klein, normaal of groot (typeschaal van het merk)
      photoKey: '',           // sleutel van de foto in IndexedDB
      ...fields,
    };
  }

  function defaults() {
    const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    return {
      dot: true,
      showNumbers: true,
      exportWidth: 1920,
      active: 0,
      slides: D.example(date).map(({ layout, ...fields }) => newSlide(layout, fields)),
    };
  }

  const LAYOUT_IDS = new Set(S.LAYOUTS.map((l) => l.id));

  function normalizeSlide(s) {
    const base = newSlide(LAYOUT_IDS.has(s.layout) ? s.layout : 'bullets');
    for (const k of Object.keys(base)) {
      if (k === 'crop') base.crop = { ...base.crop, ...(isObj(s.crop) ? s.crop : {}) };
      else if (k === 'table') base.table = S.normalizeTable(s.table);
      else if (typeof s[k] === typeof base[k]) base[k] = s[k];
    }
    // Opgeslagen vóór de sleutels per foto: de foto staat onder slide:<id>
    if (!('photoKey' in s)) base.photoKey = legacyKey(base.id);
    if (!SIZES.includes(base.titleSize)) base.titleSize = 'normaal';
    return base;
  }

  // Een toestand gezond maken (na laden of ongedaan maken)
  function normalize(saved) {
    const state = { dot: true, showNumbers: true, exportWidth: 1920, active: 0, slides: [] };
    if (isObj(saved)) {
      for (const k of ['dot', 'showNumbers', 'exportWidth', 'active']) {
        if (typeof saved[k] === typeof state[k]) state[k] = saved[k];
      }
      if (Array.isArray(saved.slides)) state.slides = saved.slides.filter(isObj).map(normalizeSlide).slice(0, MAX_SLIDES);
    }
    if (!state.slides.length) state.slides = defaults().slides;
    state.active = Math.min(Math.max(0, state.active | 0), state.slides.length - 1);
    if (![1920, 3840].includes(state.exportWidth)) state.exportWidth = 1920;
    return state;
  }

  let state = normalize(PM.store.get(KEY, null));
  // Gestart vanaf het dashboard: dan bij de rondleiding alleen een melding
  const quickStart = Object.keys(PM.startParams()).length > 0;
  // De rondleiding begint bij de titel van slide 1
  const tourStatus = (PM.store.get(TOUR_KEY, null) || {}).status;
  if (!tourStatus || tourStatus === 'nieuw' || tourStatus === 'bezig') state.active = 0;

  const save = PM.debounce(() => PM.store.set(KEY, state), 300);
  const current = () => state.slides[state.active];
  const layoutOf = (slide) => S.LAYOUTS.find((l) => l.id === slide.layout) || S.LAYOUTS[0];

  /* ---------------------------------------------------------------------------
     Elementen
     ------------------------------------------------------------------------- */

  const el = {
    app: $('.app'),
    editor: $('#editor'),
    stage: $('#stage'),
    canvas: $('#slideCanvas'),
    strip: $('#slideStrip'),
    layoutGrid: $('#layoutGrid'),
    layoutFor: $('#layoutFor'),
    inhoudSlide: $('#inhoudSlide'),
    inhoudLayout: $('#inhoudLayout'),
    slidePill: $('#slidePill'),
    dimPill: $('#dimPill'),
    docTitle: $('#docTitle'),
    docSub: $('#docSub'),
    warning: $('#warning'),
    warningText: $('#warningText'),
    warningBtn: $('#warningBtn'),
    photoStageNote: $('#photoStageNote'),
    photoStageText: $('#photoStageText'),
    photoDrop: $('#photoDrop'),
    photoInput: $('#photoInput'),
    photoCard: $('#photoCard'),
    photoThumb: $('#photoThumb'),
    photoName: $('#photoName'),
    photoSize: $('#photoSize'),
    photoNote: $('#photoNote'),
    previewPhotoBtn: $('#previewPhotoBtn'),
    cropControls: $('#cropControls'),
    cropHint: $('#cropHint'),
    showNumbers: $('#showNumbers'),
    dot: $('#dotToggle'),
    tableGrid: $('#tableGrid'),
    tableHeader: $('#tableHeader'),
    tableFirstCol: $('#tableFirstCol'),
    slideAdd: $('#slideAdd'),
    slideCount: $('#slideCount'),
    slideMenuBtn: $('#slideMenuBtn'),
    slideMenuNo: $('#slideMenuNo'),
    downloadBtn: $('#downloadBtn'),
    pdfBtn: $('#pdfBtn'),
    pptxBtn: $('#pptxBtn'),
    pngBtn: $('#pngBtn'),
    pngAllBtn: $('#pngAllBtn'),
    pdfSum: $('#pdfSum'),
    pngSum: $('#pngSum'),
    zipSum: $('#zipSum'),
    dlPhotoNote: $('#dlPhotoNote'),
    dropHint: $('#dropHint b'),
    check: $('#checkDialog'),
  };

  // Logo, en de foto's per sleutel: { file, img, url }
  const env = { logo: null };
  const files = new Map();

  const photoOf = (slide) => (slide && slide.photoKey && files.get(slide.photoKey)) || null;

  function sectionNumber(index) {
    let n = 0;
    for (let i = 0; i <= index; i++) if (state.slides[i].layout === 'section') n++;
    return Math.max(1, n);
  }

  function slideEnv(index, slide = state.slides[index]) {
    const photo = photoOf(slide);
    return { logo: env.logo, photo: photo ? photo.img : null, crop: slide.crop, sectionNumber: sectionNumber(index) };
  }

  /* ---------------------------------------------------------------------------
     Editor: indeling, tekstvelden, werkbalk, ongedaan maken
     ------------------------------------------------------------------------- */

  PM.richfield.init(el.editor);
  const shell = PM.shell(el.app, { tool: 'presentation', open: 'inhoud', quickStart });

  // De werkbalk: nadruk of vet, en de grootte van de titel (typeschaal van het merk, per slide)
  const toolbar = PM.toolbar($('#tbar'), {
    value: (field, cmd) => (cmd === 'grootte' ? current().titleSize || 'normaal' : null),
    apply(field, cmd, value) {
      if (cmd !== 'grootte' || !SIZES.includes(value)) return;
      current().titleSize = value;
      changed('grootte');
    },
  });

  // Alles behalve de gekozen slide en de resolutie: dat zijn geen wijzigingen aan de presentatie
  const history = PM.history({
    snapshot: () => ({ ...state, exportWidth: undefined, active: undefined }),
    restore(saved) {
      const prev = state;
      state = normalize({ ...saved, exportWidth: prev.exportWidth, active: prev.active });
      // Laat zien wat er terugkwam: de slide die veranderde
      state.active = D.changedSlide(prev.slides, state.slides, prev.active);
      const inStrip = !!document.activeElement.closest('.strip__item');
      syncAll();
      if (inStrip) focusActiveThumb();
      applyPhotos();
      save();
      render();
    },
  });
  history.bind({ undo: $('#undoBtn'), redo: $('#redoBtn') });

  // Elke wijziging: een stap in de geschiedenis, opslaan en opnieuw tekenen
  function changed(key) {
    history.commit(key);
    save();
    render();
  }

  /* ---------------------------------------------------------------------------
     Renderen
     ------------------------------------------------------------------------- */

  let lastInfo = {};
  let frameRequest = 0;

  function render() {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      lastInfo = S.renderSlide(el.canvas, state, state.active, slideEnv(state.active));
      el.canvas.classList.toggle('can-pan', !!lastInfo.photo);
      syncPhotoPrompt();
      syncRegions();
      syncWarning();
      syncPhotoCheck();
      syncDocName();
      syncExport();
    });
    renderThumbsSoon();
  }

  const renderThumbsSoon = PM.debounce(() => {
    drawStrip();
    if (shell.current === 'layout') renderLayoutTiles();
  }, 160);

  // Miniaturen van de layouts tonen de huidige slide in elke layout
  function renderLayoutTiles() {
    const slide = current();
    for (const canvas of $$('canvas', el.layoutGrid)) {
      const variant = { ...slide, layout: canvas.dataset.layout };
      const slides = state.slides.slice();
      slides[state.active] = variant;
      S.renderSlide(canvas, { ...state, slides }, state.active, slideEnv(state.active, variant), { scale: 272 / S.W });
    }
  }
  shell.onChange(({ id }) => { if (id === 'layout') renderLayoutTiles(); });

  // Naam van de presentatie in de appbalk: dezelfde samenvatting als "Verder werken" op het dashboard
  const draft = (window.PM_TOOLS || []).find((t) => t.id === 'presentation');
  function syncDocName() {
    const sum = draft && draft.draft ? draft.draft.summary(state) : {};
    const title = String(sum.title || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    el.docTitle.textContent = title || 'Nieuwe presentatie';
    el.docTitle.title = title;
    el.docSub.textContent = [sum.sub, '16:9'].filter(Boolean).join(' · ');
  }

  /* ---------------------------------------------------------------------------
     Slides: de strook onder de slide en de acties voor de gekozen slide
     ------------------------------------------------------------------------- */

  function slideName(i) {
    const slide = state.slides[i];
    const title = String(slide.title || slide.quote || slide.value || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    return `Slide ${i + 1} van ${state.slides.length}: ${layoutOf(slide).name}${title ? `, ${title.slice(0, 60)}` : ''}`;
  }

  // Aantal miniaturen, nummers en de gekozen slide: meteen (tekenen volgt even later)
  function syncStrip() {
    const items = $$('.strip__item', el.strip);
    state.slides.forEach((slide, i) => {
      let item = items[i];
      if (!item) {
        item = document.createElement('div');
        item.className = 'strip__item';
        item.setAttribute('role', 'option');
        item.draggable = true;
        item.innerHTML = '<canvas width="240" height="135" aria-hidden="true"></canvas><span class="strip__no" aria-hidden="true"></span>';
        el.strip.appendChild(item);
      }
      const on = i === state.active;
      item.dataset.index = String(i);
      item.tabIndex = on ? 0 : -1;
      item.setAttribute('aria-selected', String(on));
      item.setAttribute('aria-label', slideName(i));
      item.querySelector('.strip__no').textContent = String(i + 1);
    });
    items.slice(state.slides.length).forEach((b) => b.remove());
    syncSlideBar();
    keepActiveInView();
    syncCues();
  }

  function drawStrip() {
    $$('.strip__item', el.strip).forEach((item, i) => {
      if (state.slides[i]) S.renderSlide(item.querySelector('canvas'), state, i, slideEnv(i), { scale: 240 / S.W });
    });
  }

  function syncSlideBar() {
    const n = state.slides.length;
    const i = state.active;
    el.slideCount.textContent = `slide ${i + 1} van ${n}`;
    el.slideMenuNo.textContent = `${i + 1} / ${n}`;
    el.slideMenuBtn.setAttribute('aria-label', `Acties voor slide ${i + 1} van ${n}`);
    el.slidePill.textContent = `slide ${i + 1} van ${n} · ${layoutOf(current()).name}`;
    el.inhoudSlide.textContent = `slide ${i + 1}`;
    el.inhoudLayout.textContent = layoutOf(current()).name;
    el.layoutFor.textContent = `Kies een layout voor slide ${i + 1}`;
    const full = n >= MAX_SLIDES;
    el.slideAdd.disabled = full;
    el.slideAdd.title = full ? `Hoogstens ${MAX_SLIDES} slides` : 'Nieuwe slide na deze';
    const set = (sel, off) => $$(sel).forEach((b) => { b.disabled = off; });
    set('#slideDup, [data-action="slide-dupliceer"]', full);
    set('#slideLeft, [data-action="slide-voren"]', i === 0);
    set('#slideRight, [data-action="slide-achteren"]', i === n - 1);
    set('#slideDel, [data-action="slide-verwijder"]', n === 1);
    set('[data-browse="-1"]', i === 0);
    set('[data-browse="1"]', i === n - 1);
  }

  // De gekozen miniatuur in beeld houden (alleen de strook scrolt, nooit de pagina)
  function keepActiveInView() {
    const item = el.strip.children[state.active];
    if (!item) return;
    const pad = 48;
    const left = item.offsetLeft;   // de strook is position: relative
    if (left - pad < el.strip.scrollLeft) el.strip.scrollLeft = Math.max(0, left - pad);
    else if (left + item.offsetWidth + pad > el.strip.scrollLeft + el.strip.clientWidth) el.strip.scrollLeft = left + item.offsetWidth + pad - el.strip.clientWidth;
  }

  // Past de strook niet, dan een verloop met een pijl aan de kant waar nog slides staan
  const cues = { prev: $('.slidebar__cue--prev'), next: $('.slidebar__cue--next') };
  function syncCues() {
    const s = el.strip;
    const more = s.scrollWidth > s.clientWidth + 2;
    cues.prev.hidden = !more || s.scrollLeft <= 2;
    cues.next.hidden = !more || s.scrollLeft + s.clientWidth >= s.scrollWidth - 2;
  }
  el.strip.addEventListener('scroll', syncCues, { passive: true });
  window.addEventListener('resize', PM.debounce(syncCues, 100));
  cues.prev.addEventListener('click', () => el.strip.scrollBy({ left: -el.strip.clientWidth * 0.8 }));
  cues.next.addEventListener('click', () => el.strip.scrollBy({ left: el.strip.clientWidth * 0.8 }));

  function focusActiveThumb() {
    const item = el.strip.children[state.active];
    if (item) item.focus({ preventScroll: true });
  }

  function selectSlide(i, { focus = false } = {}) {
    const next = Math.min(Math.max(0, i), state.slides.length - 1);
    if (next !== state.active) {
      state.active = next;
      syncAll();
      save();
      render();
    }
    if (focus) focusActiveThumb();
  }

  // Klikken kiest, slepen verandert de volgorde
  el.strip.addEventListener('click', (e) => {
    const item = e.target.closest('.strip__item');
    if (item) selectSlide(Number(item.dataset.index));
  });
  el.strip.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.strip__item');
    if (!item) return;
    e.dataTransfer.setData('text/x-pm-slide', item.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    item.classList.add('is-dragging');
  });
  el.strip.addEventListener('dragend', () => {
    $$('.is-dragging, .is-drop', el.strip).forEach((n) => n.classList.remove('is-dragging', 'is-drop'));
  });
  el.strip.addEventListener('dragover', (e) => {
    const item = e.target.closest('.strip__item');
    if (!item || !e.dataTransfer.types.includes('text/x-pm-slide')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    $$('.is-drop', el.strip).forEach((n) => n !== item && n.classList.remove('is-drop'));
    item.classList.add('is-drop');
  });
  el.strip.addEventListener('drop', (e) => {
    const item = e.target.closest('.strip__item');
    const from = e.dataTransfer.getData('text/x-pm-slide');
    if (!item || from === '') return;
    e.preventDefault();
    moveSlideTo(Number(from), Number(item.dataset.index));
  });

  // Toetsenbord in de strook: pijltjes, Home en End kiezen, Delete verwijdert, Enter bewerkt
  el.strip.addEventListener('keydown', (e) => {
    if (!e.target.closest('.strip__item') || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = state.slides.length;
    const to = { ArrowRight: state.active + 1, ArrowDown: state.active + 1, ArrowLeft: state.active - 1, ArrowUp: state.active - 1, Home: 0, End: n - 1 }[e.key];
    if (to != null) {
      e.preventDefault();
      selectSlide(to, { focus: true });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSlide();
      focusActiveThumb();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      shell.open('inhoud', { focus: true });
    }
  });

  function moveSlideTo(from, to) {
    if (from === to || from < 0 || to < 0 || from >= state.slides.length || to >= state.slides.length) return;
    state.slides = D.move(state.slides, from, to);
    state.active = to;
    syncAll();
    changed(null);
    PM.announce(`Slide staat nu op plek ${to + 1}.`);
  }

  function moveSlide(delta, button) {
    moveSlideTo(state.active, state.active + delta);
    // Aan het begin of eind gaat de knop uit: de focus naar de andere richting
    if (button && button.disabled) {
      const other = button.id === 'slideLeft' ? $('#slideRight') : $('#slideLeft');
      if (!other.disabled) other.focus();
    }
  }

  // Een nieuwe slide na deze; meteen de layout kiezen
  function addSlide({ byKeyboard = false } = {}) {
    if (state.slides.length >= MAX_SLIDES) {
      toast(`Hoogstens ${MAX_SLIDES} slides: verdeel je verhaal over twee presentaties.`);
      return;
    }
    const layout = ['title', 'closing'].includes(current().layout) ? 'bullets' : current().layout;
    state.slides.splice(state.active + 1, 0, newSlide(layout, { label: current().label }));
    state.active += 1;
    syncAll();
    changed(null);
    shell.open('layout', { focus: byKeyboard ? '#layoutGrid input:checked' : false });
    PM.announce(`Slide ${state.active + 1} toegevoegd. Kies een layout.`);
  }

  function duplicateSlide() {
    if (state.slides.length >= MAX_SLIDES) return;
    const src = current();
    // De foto hoeft niet mee te verhuizen: beide slides wijzen naar hetzelfde bestand
    const copy = { ...JSON.parse(JSON.stringify(src)), id: PM.uid() };
    state.slides.splice(state.active + 1, 0, copy);
    state.active += 1;
    syncAll();
    changed(null);
    toast(`Slide ${state.active} gedupliceerd: je staat nu op de kopie, slide ${state.active + 1}.`);
  }

  // Verwijderen gaat meteen, met "ongedaan maken" in de melding (en Ctrl + Z)
  function deleteSlide() {
    if (state.slides.length === 1) {
      toast('Een presentatie heeft minstens één slide.');
      return;
    }
    const index = state.active;
    state.slides.splice(index, 1);
    state.active = Math.min(index, state.slides.length - 1);
    syncAll();
    changed(null);
    toast(`Slide ${index + 1} verwijderd.`, false, { label: 'ongedaan maken', run: () => history.undo() });
  }

  el.slideAdd.addEventListener('click', (e) => addSlide({ byKeyboard: e.detail === 0 }));
  $('#slideDup').addEventListener('click', duplicateSlide);
  $('#slideLeft').addEventListener('click', (e) => moveSlide(-1, e.currentTarget));
  $('#slideRight').addEventListener('click', (e) => moveSlide(1, e.currentTarget));
  $('#slideDel').addEventListener('click', deleteSlide);
  shell.onAction('slide-dupliceer', duplicateSlide);
  shell.onAction('slide-voren', () => moveSlide(-1));
  shell.onAction('slide-achteren', () => moveSlide(1));
  shell.onAction('slide-verwijder', deleteSlide);

  /* ---------------------------------------------------------------------------
     Klikken op de slide: elk deel hoort bij een veld
     ------------------------------------------------------------------------- */

  const FIELD = { title: '#sTitle', subtitle: '#sSubtitle', meta: '#sMeta', body: '#sBody', quote: '#sQuote', author: '#sAuthor', value: '#sValue', label: '#sLabel' };

  function regionTarget(key) {
    if (key.startsWith('cell:')) return { label: 'tabel', section: 'inhoud', field: `[data-cell="${key.slice(5)}"]` };
    if (key === 'photo') return { label: photoOf(current()) ? 'foto · sleep om te verschuiven' : 'foto toevoegen', section: 'foto', photo: true };
    if (!FIELD[key]) return null;
    return { label: D.nameOf(current(), key).label, section: 'inhoud', field: FIELD[key] };
  }

  function syncRegions() {
    const regions = (lastInfo.regions || []).map((r) => {
      const target = regionTarget(r.key);
      return target && { ...r, ...target };
    }).filter(Boolean);
    shell.setRegions(el.canvas, regions, pickRegion);
  }

  function pickRegion(r) {
    if (r.photo) {
      if (!photoOf(current())) {
        pickPhoto();
        return;
      }
      // Foto aanklikken: het paneel met de uitsnede open, de focus blijft op de slide (pijltjes)
      shell.open('foto');
      flash(el.cropControls);
      return;
    }
    shell.reveal(r.section, r.field);
  }

  function flash(node) {
    if (!node) return;
    node.classList.remove('is-flash');
    void node.offsetWidth;
    node.classList.add('is-flash');
  }

  /* ---------------------------------------------------------------------------
     Meldingen onder de slide: tekst te lang (welk veld), foto te klein
     ------------------------------------------------------------------------- */

  const PLURAL = new Set(['de punten', 'de contactgegevens']);
  let warningKey = null;

  function overflowText(slide, key) {
    if (key === 'table') return 'De tabel past niet op de slide, ook niet op de kleinste letter. Haal rijen weg, maak teksten korter of verdeel de tabel over twee slides.';
    const { name } = D.nameOf(slide, key);
    const Name = name.charAt(0).toUpperCase() + name.slice(1);
    return PLURAL.has(name)
      ? `${Name} zijn te lang voor deze slide en zo klein mogelijk gemaakt. Maak ze korter of verdeel ze over twee slides.`
      : `${Name} is te lang voor deze slide en is zo klein mogelijk gemaakt. Maak de tekst korter of verdeel hem over twee slides.`;
  }

  function syncWarning() {
    const keys = lastInfo.overflowKeys || [];
    warningKey = keys[0] || (lastInfo.overflow ? 'title' : null);
    el.warning.hidden = !warningKey;
    if (!warningKey) return;
    el.warningText.textContent = overflowText(current(), warningKey);
    el.warningBtn.textContent = `naar ${D.nameOf(current(), warningKey).name}`;
  }
  el.warningBtn.addEventListener('click', () => {
    if (warningKey === 'table') shell.reveal('inhoud', '[data-cell="0,0"]');
    else if (FIELD[warningKey]) shell.reveal('inhoud', FIELD[warningKey]);
  });

  // Het vak van de foto op de slide (ontwerp-px): zeshoek of halve slide
  function photoBox(slide) {
    if (slide.layout === 'split') return { w: S.W / 2, h: S.H };
    const { r } = S.GEOM.hero;
    return { w: r * Math.sqrt(3), h: r * 2 };
  }

  // Is de foto groot genoeg voor de gekozen resolutie?
  function photoCheck(index, width = state.exportWidth) {
    const slide = state.slides[index];
    const photo = photoOf(slide);
    if (!photo || !PHOTO_LAYOUTS.has(slide.layout)) return { level: 'ok', message: '' };
    const box = photoBox(slide);
    return PM.brand.photoCheck(photo.img.naturalWidth, photo.img.naturalHeight, box.w, box.h, width / S.W, { zoom: slide.crop.zoom });
  }

  function syncPhotoCheck() {
    const res = photoCheck(state.active);
    const warn = res.level !== 'ok';
    const text = warn && state.exportWidth === 3840 ? `In 4K: ${res.message.charAt(0).toLowerCase()}${res.message.slice(1)}` : res.message;
    for (const node of [el.photoNote, el.photoStageNote]) {
      node.hidden = !warn;
      node.classList.toggle('notice-error', res.level === 'te-klein');
      node.classList.toggle('notice-warn', res.level !== 'te-klein');
    }
    el.photoNote.textContent = text;
    el.photoStageText.textContent = text;
  }
  $('#photoStageBtn').addEventListener('click', () => {
    shell.open('foto');
    if (el.photoCard.hidden) el.photoDrop.focus();
    else $('#photoReplace').focus();
  });

  // Lege fotoplek: de slide zelf is de uploadknop, zoals een placeholder in Canva
  function syncPhotoPrompt() {
    const s = current();
    const empty = PHOTO_LAYOUTS.has(s.layout) && !photoOf(s);
    el.previewPhotoBtn.hidden = !empty;
    el.canvas.classList.toggle('needs-photo', empty);
    el.canvas.tabIndex = empty || lastInfo.photo ? 0 : -1;
    el.canvas.setAttribute('aria-label', empty
      ? `Slide ${state.active + 1}. Druk op Enter om een foto te kiezen.`
      : lastInfo.photo ? `Slide ${state.active + 1}. Verschuif de foto met de pijltjestoetsen.` : `Slide ${state.active + 1}`);
  }

  /* ---------------------------------------------------------------------------
     Velden <-> toestand
     ------------------------------------------------------------------------- */

  function buildLayoutTiles() {
    el.layoutGrid.innerHTML = S.LAYOUTS.map((l) => `
      <label class="layout-tile">
        <input type="radio" name="layout" value="${l.id}">
        <canvas data-layout="${l.id}" width="272" height="153" aria-hidden="true"></canvas>
        <b>${PM.esc(l.name)}</b><i>${PM.esc(l.sub)}</i>
      </label>`).join('');
  }

  // Een veld dat per layout anders heet of anders nadruk geeft (cyaan of vet)
  function setField(sel, mode, label) {
    const source = $(sel);
    const rf = PM.richfield.of(source);
    const target = rf ? rf.editor : source;
    const before = `${target.dataset.toolbar}|${target.dataset.toolbarLabel}`;
    target.dataset.toolbar = mode;
    target.dataset.toolbarLabel = label;
    if (rf) {
      rf.editor.classList.toggle('rf--vet', mode === 'vet');
      rf.editor.classList.toggle('rf--nadruk', mode === 'nadruk');
    }
    if (toolbar.field === target && before !== `${mode}|${label}`) {
      toolbar.detach();
      toolbar.attach(target);
    }
  }

  function syncVisibility() {
    const s = current();
    const keys = [s.layout, `${s.layout}.${s.style}`];
    for (const n of $$('[data-for]', el.app)) {
      n.hidden = !n.dataset.for.split(/\s+/).some((k) => keys.includes(k));
    }
    for (const n of $$('[data-layout-text]', el.app)) {
      const map = Object.fromEntries(n.dataset.layoutText.split('|').map((p) => [p.slice(0, p.indexOf(':')), p.slice(p.indexOf(':') + 1)]));
      const text = map[keys[1]] != null ? map[keys[1]] : map[s.layout];
      if (text != null) n.textContent = text;
    }
    // Nadruk: in titel en citaat altijd cyaan; in de tekst van een afsluiter en bij een kerncijfer ook,
    // verder betekent ** vet (wit en vet op de slide)
    setField('#sSubtitle', s.layout === 'quote' ? 'nadruk' : 'vet', D.nameOf(s, 'subtitle').label);
    setField('#sBody', s.layout === 'closing' ? 'nadruk' : 'vet', D.nameOf(s, 'body').label);
    setField('#sAuthor', 'vet', D.nameOf(s, 'author').label);
    // De rondleiding wijst de hoofdtekst van deze slide aan: de titel, of het citaat
    $$('[data-tour="titel"]').forEach((n) => n.removeAttribute('data-tour'));
    $(keys[1] === 'quote.quote' ? '#sQuote' : '#sTitle').closest('.field').dataset.tour = 'titel';
    // Een onderdeel dat bij deze layout niet bestaat: uit, met de reden erbij
    if (PHOTO_LAYOUTS.has(s.layout)) shell.enable('foto');
    else shell.disable('foto', `${NOUN[s.layout] || 'Deze layout'} heeft geen foto. Kies onder Layout een titelslide, beeld + tekst of afsluiter.`);
    el.dropHint.textContent = PHOTO_LAYOUTS.has(s.layout)
      ? 'laat los om de foto op deze slide te zetten'
      : `${NOUN[s.layout] || 'Deze layout'} heeft geen foto. Laat los, dan kun je beeld + tekst kiezen.`;
  }

  function syncInputs() {
    const s = current();
    for (const input of $$('[data-bind]', el.editor)) {
      const value = s[input.dataset.bind];
      if (input.type === 'radio') input.checked = input.value === value;
      else {
        const text = value == null ? '' : String(value);
        if (input.value !== text) input.value = text;
      }
    }
    $$('input[name="layout"]', el.layoutGrid).forEach((r) => { r.checked = r.value === s.layout; });
    el.showNumbers.checked = state.showNumbers !== false;
    el.dot.checked = state.dot !== false;
    $$('input[name="res"]').forEach((r) => { r.checked = Number(r.value) === state.exportWidth; });
    syncCrop();
    syncPhotoUI();
    renderTableEditor();
    toolbar.refresh();
  }

  function syncAll() {
    syncVisibility();
    syncInputs();
    syncStrip();
  }

  function syncCrop() {
    const c = current().crop;
    $('#cropZoom').value = String(Math.round(c.zoom * 100));
    $('#cropZoomVal').textContent = `${Math.round(c.zoom * 100)}%`;
  }

  function setLayout(id) {
    const s = current();
    if (!LAYOUT_IDS.has(id) || s.layout === id) return;
    s.layout = id;
    syncAll();
    changed(null);
    if (shell.current === 'layout') renderLayoutTiles();
  }

  el.editor.addEventListener('submit', (e) => e.preventDefault());

  el.editor.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.bind) {
      if (t.type === 'radio') return;   // via 'change'
      current()[t.dataset.bind] = t.value;
      changed(`${current().id}.${t.dataset.bind}`);
    } else if (t.dataset.crop) {
      current().crop[t.dataset.crop] = Number(t.value) / 100;
      syncCrop();
      changed('zoom');
    } else if (t.dataset.cell) {
      const [r, c] = t.dataset.cell.split(',').map(Number);
      const row = tbl().cells[r];
      if (row) row[c] = t.value;
      changed(`${current().id}.cel.${r},${c}`);
    }
  });

  el.editor.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'layout' && t.checked) {
      setLayout(t.value);
    } else if (t.dataset.bind && t.type === 'radio' && t.checked) {
      current()[t.dataset.bind] = t.value;
      syncVisibility();
      changed(null);
    } else if (t === el.showNumbers) {
      state.showNumbers = t.checked;
      changed(null);
    } else if (t === el.dot) {
      state.dot = t.checked;
      changed(null);
    } else if (t === el.tableHeader || t === el.tableFirstCol) {
      tbl()[t === el.tableHeader ? 'header' : 'firstCol'] = t.checked;
      tableChanged();
    }
  });

  // "andere layout" en bladeren (smal scherm, blad open) in het paneel Inhoud
  el.editor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    const browse = e.target.closest('[data-browse]');
    if (btn) shell.open(btn.dataset.open, { focus: e.detail === 0 ? '#layoutGrid input:checked' : false });
    else if (browse) selectSlide(state.active + Number(browse.dataset.browse));
  });

  /* ---------------------------------------------------------------------------
     Tabel bewerken: een raster van invoervelden. Het raster wordt alleen
     opnieuw opgebouwd bij rijen/kolommen toevoegen of weghalen, niet bij
     typen, zodat de cursor blijft staan. De ×-knoppen zijn voor de muis; met
     het toetsenbord gaat Tab van cel naar cel en werken "− rij" en "− kolom"
     op de cel waar je stond.
     ------------------------------------------------------------------------- */

  const LIM = S.TABLE_LIMITS;
  const tbl = () => current().table;
  let lastCell = [0, 0];

  function renderTableEditor(focus) {
    const t = tbl();
    const nR = t.cells.length;
    const nC = t.cells[0].length;
    el.tableHeader.checked = t.header;
    el.tableFirstCol.checked = t.firstCol;
    el.tableGrid.style.setProperty('--cols', nC);
    const colBtns = Array.from({ length: nC }, (_, c) => `<button type="button" class="tbl__del" data-del-col="${c}" tabindex="-1" aria-label="Kolom ${c + 1} verwijderen" title="Kolom ${c + 1} verwijderen"${nC === 1 ? ' disabled' : ''}>&times;</button>`).join('');
    const rows = t.cells.map((row, r) => {
      const head = t.header && r === 0;
      const inputs = row.map((v, c) => `<input class="input tbl__cell${head ? ' is-head' : ''}" data-cell="${r},${c}" value="${PM.esc(v)}" maxlength="160" aria-label="${head ? 'Kop' : `Rij ${t.header ? r : r + 1}`}, kolom ${c + 1}" spellcheck="true">`).join('');
      return `${inputs}<button type="button" class="tbl__del" data-del-row="${r}" tabindex="-1" aria-label="Rij ${r + 1} verwijderen" title="Rij ${r + 1} verwijderen"${nR === 1 ? ' disabled' : ''}>&times;</button>`;
    }).join('');
    el.tableGrid.innerHTML = `${colBtns}<span></span>${rows}`;
    lastCell = [Math.min(lastCell[0], nR - 1), Math.min(lastCell[1], nC - 1)];
    $('#addRow').disabled = nR >= LIM.rows;
    $('#addCol').disabled = nC >= LIM.cols;
    syncDelButtons();
    if (focus) {
      const input = $(`[data-cell="${focus[0]},${focus[1]}"]`, el.tableGrid);
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function syncDelButtons() {
    const t = tbl();
    const [r, c] = lastCell;
    const delRow = $('#delRow');
    const delCol = $('#delCol');
    delRow.disabled = t.cells.length === 1;
    delCol.disabled = t.cells[0].length === 1;
    delRow.setAttribute('aria-label', `Rij ${r + 1} verwijderen`);
    delRow.title = `Rij ${r + 1} verwijderen (de rij van de cel waar je stond)`;
    delCol.setAttribute('aria-label', `Kolom ${c + 1} verwijderen`);
    delCol.title = `Kolom ${c + 1} verwijderen (de kolom van de cel waar je stond)`;
  }

  el.tableGrid.addEventListener('focusin', (e) => {
    const cell = e.target.dataset && e.target.dataset.cell;
    if (!cell) return;
    lastCell = cell.split(',').map(Number);
    syncDelButtons();
  });

  function tableChanged(focus) {
    renderTableEditor(focus);
    changed(null);
  }

  function addRow(at = tbl().cells.length) {
    const t = tbl();
    if (t.cells.length >= LIM.rows) {
      toast(`Maximaal ${LIM.rows} rijen: meer is op een slide niet te lezen. Verdeel de tabel over twee slides.`, true);
      return false;
    }
    t.cells.splice(at, 0, Array(t.cells[0].length).fill(''));
    return true;
  }

  function addCol() {
    const t = tbl();
    if (t.cells[0].length >= LIM.cols) {
      toast(`Maximaal ${LIM.cols} kolommen: meer is op een slide niet te lezen.`, true);
      return false;
    }
    t.cells.forEach((row) => row.push(''));
    return true;
  }

  // Weghalen gaat meteen, met "ongedaan maken" in de melding
  function delRow(r) {
    const t = tbl();
    if (t.cells.length === 1) return;
    t.cells.splice(r, 1);
    tableChanged();
    toast(`Rij ${r + 1} verwijderd.`, false, { label: 'ongedaan maken', run: () => history.undo() });
  }

  function delCol(c) {
    const t = tbl();
    if (t.cells[0].length === 1) return;
    t.cells.forEach((row) => row.splice(c, 1));
    tableChanged();
    toast(`Kolom ${c + 1} verwijderd.`, false, { label: 'ongedaan maken', run: () => history.undo() });
  }

  $('#addRow').addEventListener('click', () => {
    if (addRow()) tableChanged([tbl().cells.length - 1, 0]);
  });
  $('#addCol').addEventListener('click', () => {
    if (addCol()) tableChanged([0, tbl().cells[0].length - 1]);
  });
  $('#delRow').addEventListener('click', () => delRow(lastCell[0]));
  $('#delCol').addEventListener('click', () => delCol(lastCell[1]));

  el.tableGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.delRow != null) delRow(Number(btn.dataset.delRow));
    else if (btn.dataset.delCol != null) delCol(Number(btn.dataset.delCol));
  });

  // Enter: naar de cel eronder (en aan het eind een nieuwe rij), zoals in een spreadsheet
  el.tableGrid.addEventListener('keydown', (e) => {
    const cell = e.target.dataset && e.target.dataset.cell;
    if (!cell || e.key !== 'Enter') return;
    e.preventDefault();
    const [r, c] = cell.split(',').map(Number);
    if (r + 1 < tbl().cells.length) {
      renderTableEditor([r + 1, c]);
    } else if (addRow()) {
      tableChanged([r + 1, c]);
    }
  });

  // Plakken uit Excel, Google Sheets of Numbers: tabs en regels vullen de cellen vanaf hier
  el.tableGrid.addEventListener('paste', (e) => {
    const cell = e.target.dataset && e.target.dataset.cell;
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!cell || !text || !/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
    e.preventDefault();
    const [r0, c0] = cell.split(',').map(Number);
    const data = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((line) => line.split('\t').map((v) => v.trim()));
    const t = tbl();
    let cut = false;
    data.forEach((row, i) => {
      const r = r0 + i;
      if (r >= LIM.rows) {
        cut = true;
        return;
      }
      while (t.cells.length <= r) addRow();
      row.forEach((v, j) => {
        const c = c0 + j;
        if (c >= LIM.cols) {
          cut = true;
          return;
        }
        while (t.cells[0].length <= c) addCol();
        t.cells[r][c] = v.slice(0, 160);
      });
    });
    tableChanged([r0, c0]);
    toast(cut ? `Geplakt, maar alleen de eerste ${LIM.rows} rijen en ${LIM.cols} kolommen passen.` : `${data.length} ${data.length === 1 ? 'rij' : 'rijen'} geplakt.`, cut);
  });

  /* ---------------------------------------------------------------------------
     Foto's: per slide een sleutel in IndexedDB
     ------------------------------------------------------------------------- */

  function trackFile(key) {
    const list = PM.store.get(FILES_KEY, []);
    if (!list.includes(key)) PM.store.set(FILES_KEY, [...list, key]);
  }

  // Bij het laden: alleen bewaren wat de presentatie nu gebruikt (de geschiedenis is dan leeg)
  function cleanupFiles() {
    const keep = Array.from(new Set(state.slides.map((s) => s.photoKey).filter(Boolean)));
    PM.store.get(FILES_KEY, []).filter((k) => !keep.includes(k)).forEach((k) => PM.idb.del(k));
    PM.store.set(FILES_KEY, keep);
  }

  async function loadFile(key) {
    if (!key) return null;
    if (files.has(key)) return files.get(key);
    const blob = await PM.idb.get(key);
    if (!(blob instanceof Blob)) return null;
    try {
      const { img, url } = await PM.readImage(blob);
      const entry = { file: blob, img, url };
      files.set(key, entry);
      return entry;
    } catch (err) {
      return null;
    }
  }

  // Foto's uit de toestand laden (na laden, ongedaan maken of een nieuwe foto)
  async function applyPhotos() {
    await Promise.all(Array.from(new Set(state.slides.map((s) => s.photoKey))).map(loadFile));
    syncPhotoUI();
    render();
  }

  function syncPhotoUI() {
    const entry = photoOf(current());
    el.photoCard.hidden = !entry;
    el.photoDrop.hidden = !!entry;
    el.cropControls.hidden = !entry;
    el.cropHint.hidden = !entry;
    if (!entry) return;
    el.photoThumb.style.backgroundImage = `url("${entry.url}")`;
    el.photoName.textContent = entry.file.name || 'foto';
    el.photoSize.textContent = `${entry.img.naturalWidth} × ${entry.img.naturalHeight} px${entry.file.size ? ` · ${PM.formatSize(entry.file.size)}` : ''}`;
  }

  async function addFile(file) {
    try {
      const { img, url } = await PM.readImage(file);
      const key = `slide:${PM.uid()}${PM.uid()}`;
      files.set(key, { file, img, url });
      PM.idb.set(key, file);
      trackFile(key);
      return key;
    } catch (err) {
      toast(err.message, true);
      return null;
    }
  }

  async function setPhoto(file) {
    const s = current();
    // Geen fotoplek in deze layout: uitleggen, en de layout die het wel kan in één klik
    if (!PHOTO_LAYOUTS.has(s.layout)) {
      toast(`${NOUN[s.layout] || 'Deze layout'} heeft geen plek voor een foto. Met beeld + tekst staat hij naast je tekst.`, false, {
        label: 'gebruik beeld + tekst',
        run: () => {
          setLayout('split');
          setPhoto(file);
        },
      });
      return;
    }
    const key = await addFile(file);
    if (!key) return;
    s.photoKey = key;
    s.crop = { zoom: 1, fx: 0.5, fy: 0.5 };
    syncCrop();
    syncPhotoUI();
    changed('foto');
    if (PM.tour) PM.tour.signal('foto');
  }

  function clearPhoto() {
    current().photoKey = '';
    syncPhotoUI();
    changed('foto');
    toast('Foto verwijderd.', false, { label: 'ongedaan maken', run: () => history.undo() });
  }

  const pickPhoto = () => el.photoInput.click();
  el.photoDrop.addEventListener('click', pickPhoto);
  el.photoDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickPhoto();
    }
  });
  $('#photoReplace').addEventListener('click', pickPhoto);
  $('#photoClear').addEventListener('click', clearPhoto);
  el.previewPhotoBtn.addEventListener('click', pickPhoto);
  el.photoInput.addEventListener('change', () => {
    const file = el.photoInput.files[0];
    el.photoInput.value = '';
    if (file) setPhoto(file);
  });
  $('#cropReset').addEventListener('click', () => {
    current().crop = { zoom: 1, fx: 0.5, fy: 0.5 };
    syncCrop();
    changed(null);
  });

  // Slepen: foto overal op het podium of op de uploadzone
  PM.bindDrop(el.photoDrop, setPhoto);
  PM.bindDrop(el.stage, setPhoto, el.stage);
  PM.preventStrayDrops();

  // Plakken vanaf het klembord (alleen een afbeelding; tekst plakt gewoon in het veld)
  document.addEventListener('paste', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const item = Array.from(e.clipboardData ? e.clipboardData.items : []).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    setPhoto(item.getAsFile());
  });

  // Uitsnede verschuiven door op de slide te slepen (een klik zonder slepen opent het veld)
  let pan = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    if (!lastInfo.photo) return;
    const c = current().crop;
    pan = { x: e.clientX, y: e.clientY, fx: c.fx, fy: c.fy, moved: false };
    el.canvas.setPointerCapture(e.pointerId);
    el.canvas.classList.add('is-panning');
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (!pan || !lastInfo.photo) return;
    const k = el.canvas.width / el.canvas.getBoundingClientRect().width;
    const { overflowX, overflowY } = lastInfo.photo;
    const c = current().crop;
    if (overflowX > 0.5) c.fx = Math.min(1, Math.max(0, pan.fx - ((e.clientX - pan.x) * k) / overflowX));
    if (overflowY > 0.5) c.fy = Math.min(1, Math.max(0, pan.fy - ((e.clientY - pan.y) * k) / overflowY));
    pan.moved = pan.moved || c.fx !== pan.fx || c.fy !== pan.fy;
    render();
  });
  const endPan = () => {
    if (!pan) return;
    const moved = pan.moved;
    pan = null;
    el.canvas.classList.remove('is-panning');
    if (moved) {
      history.seal();
      changed(null);
    }
  };
  el.canvas.addEventListener('pointerup', endPan);
  el.canvas.addEventListener('pointercancel', endPan);

  // Met het toetsenbord: Enter kiest een foto, pijltjes verschuiven hem
  el.canvas.addEventListener('keydown', (e) => {
    const s = current();
    if ((e.key === 'Enter' || e.key === ' ') && PHOTO_LAYOUTS.has(s.layout) && !photoOf(s)) {
      e.preventDefault();
      pickPhoto();
      return;
    }
    const dir = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!dir || !lastInfo.photo) return;
    e.preventDefault();
    const c = s.crop;
    const step = e.shiftKey ? 0.1 : 0.02;
    c.fx = Math.min(1, Math.max(0, c.fx + dir[0] * step));
    c.fy = Math.min(1, Math.max(0, c.fy + dir[1] * step));
    changed('verschuiven');
  });

  /* ---------------------------------------------------------------------------
     Export: "download pdf" rechtsboven; het pijltje toont PowerPoint en afbeeldingen
     ------------------------------------------------------------------------- */

  const deckName = () => PM.slug(state.slides[0].title || state.slides[0].label) || 'presentatie';
  const slideFile = (i) => `pureminds-presentatie-${deckName()}-slide-${String(i + 1).padStart(2, '0')}.png`;
  const sizeText = () => `${state.exportWidth} × ${state.exportWidth * 9 / 16} px`;

  // Precies wat je krijgt, per knop in één regel
  function syncExport() {
    const n = state.slides.length;
    el.dimPill.textContent = sizeText();
    el.pdfSum.textContent = `${n} ${n === 1 ? 'pagina' : "pagina's"}, om te presenteren of te versturen`;
    el.pngSum.textContent = `1 PNG · ${sizeText()}`;
    el.zipSum.textContent = `zip met ${n} PNG's · ${sizeText()}`;
    el.downloadBtn.title = `Download ${n === 1 ? 'de slide' : `alle ${n} slides`} als pdf (Ctrl + S)`;
    // Foto's die voor deze resolutie te klein zijn, rustig gemeld bij de afbeeldingen
    const small = state.slides.map((_, i) => i).filter((i) => photoCheck(i).level !== 'ok');
    el.dlPhotoNote.hidden = !small.length;
    if (small.length) {
      const list = small.map((i) => i + 1);
      const which = list.length === 1 ? `slide ${list[0]}` : `slide ${list.slice(0, -1).join(', ')} en ${list[list.length - 1]}`;
      el.dlPhotoNote.textContent = `De foto op ${which} is kleiner dan ${state.exportWidth === 3840 ? '4K' : 'Full HD'} nodig heeft en kan zacht worden.${state.exportWidth === 3840 ? ' Full HD is scherp genoeg voor de meeste schermen.' : ''}`;
    }
  }

  $$('input[name="res"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.exportWidth = Number(r.value) === 3840 ? 3840 : 1920;
    save();
    render();
  }));

  async function slideBlob(i) {
    await PM.fontsReady;
    const canvas = document.createElement('canvas');
    S.renderSlide(canvas, state, i, slideEnv(i), { scale: state.exportWidth / S.W });
    return PM.canvasToBlob(canvas, 'image/png');
  }

  async function exportPng() {
    const name = slideFile(state.active);
    PM.saveBlob(await slideBlob(state.active), name);
    toast(`Gedownload: ${name}`);
    return 'gedownload';
  }

  // Alle slides in één zip: geen reeks losse downloads die de browser blokkeert
  async function exportZip(progress) {
    const JSZip = await PM.libs.jszip();
    const zip = new JSZip();
    for (let i = 0; i < state.slides.length; i++) {
      progress(`slide ${i + 1} van ${state.slides.length}…`);
      zip.file(slideFile(i), await slideBlob(i));
    }
    progress('inpakken…');
    const name = `pureminds-presentatie-${deckName()}-slides.zip`;
    PM.saveBlob(await zip.generateAsync({ type: 'blob' }), name);
    toast(`${state.slides.length} slides gedownload in ${name}`);
    return `${state.slides.length} slides`;
  }

  // PDF: één 16:9-pagina per slide (960 × 540 pt, zoals PowerPoint), als vector
  // met echte tekst. Dezelfde renderfunctie als de preview tekent via
  // PMPdfCanvas rechtstreeks in de PDF; alleen foto's zijn afbeeldingen.
  async function exportPdf(progress) {
    const { blob } = await window.PMPdfCanvas.build({
      width: S.W,
      height: S.H,
      pageWidth: 960,
      count: state.slides.length,
      draw: (canvas, i) => S.renderSlide(canvas, state, i, slideEnv(i)),
      vectors: new Map([[env.logo, PM.brandSvg('logoWhiteSvg')]]),
      title: String(state.slides[0].title || 'Presentatie').replace(/\*\*/g, ''),
      subject: 'Pure Minds presentatie',
      progress,
    });
    const name = `pureminds-presentatie-${deckName()}.pdf`;
    PM.saveBlob(blob, name);
    toast(`PDF met ${state.slides.length} slides gedownload: ${name}`);
    return 'pdf gedownload';
  }

  // PowerPoint: dezelfde slides als bewerkbare tekstvakken, vormen en foto's
  // (js/presentation/pptx.js). Opent ook in Google Presentaties en Keynote.
  async function exportPptx(progress) {
    const images = {};
    for (const s of state.slides) {
      const photo = photoOf(s);
      if (photo) images[s.id] = { img: photo.img, url: photo.url, name: photo.file.name || 'afbeelding' };
    }
    const blob = await window.PMSlidesPptx.exportDeck(state, slideEnv, images, (i, total) => progress(`slide ${i + 1} van ${total}…`));
    const name = `pureminds-presentatie-${deckName()}.pptx`;
    PM.saveBlob(blob, name);
    toast(`PowerPoint met ${state.slides.length} slides gedownload: ${name}`);
    return 'powerpoint gedownload';
  }

  const EXPORTS = {
    pdf: { busy: 'pdf maken…', task: exportPdf },
    pptx: { busy: 'powerpoint maken…', task: exportPptx },
    png: { busy: 'bezig…', task: exportPng },
    zip: { busy: 'slides maken…', task: exportZip },
  };

  // De voortgang staat op de knop waar je klikte; is die weg (popover dicht), dan op "download pdf"
  function runExport(kind, button) {
    const btn = button && button.getClientRects().length ? button : el.downloadBtn;
    const { busy, task } = EXPORTS[kind];
    return PM.run(btn, busy, async (progress) => {
      const done = await task(progress);
      if (PM.tour) PM.tour.signal('download');
      return done;
    });
  }

  function download(kind, button) {
    if (button && button.disabled) return;
    beforeDownload(() => runExport(kind, button));
  }

  el.downloadBtn.addEventListener('click', () => download('pdf', el.downloadBtn));
  // Opties geopend met het toetsenbord: begin bij de eerste keuze, pdf
  $('.split__more').addEventListener('click', (e) => {
    if (e.detail === 0 && !$('#dlPop').hidden) el.pdfBtn.focus();
  });
  el.pdfBtn.addEventListener('click', () => download('pdf', el.pdfBtn));
  el.pptxBtn.addEventListener('click', () => download('pptx', el.pptxBtn));
  el.pngBtn.addEventListener('click', () => download('png', el.pngBtn));
  el.pngAllBtn.addEventListener('click', () => download('zip', el.pngAllBtn));

  /* ---------------------------------------------------------------------------
     Nog even checken: voorbeeldtekst, [invulplekken] en tekst die niet past
     ------------------------------------------------------------------------- */

  let checkedSig = null;   // "toch downloaden" voor precies deze inhoud: dan niet opnieuw vragen
  let checkGo = null;
  const measure = document.createElement('canvas');

  function checkIssues() {
    const list = D.exampleIssues(state, {
      exampleTable: S.defaultTable().cells,
      hasPhoto: (i) => PHOTO_LAYOUTS.has(state.slides[i].layout) && !!photoOf(state.slides[i]),
    });
    // Tekst die ook op de kleinste letter niet past (op een klein canvas, alleen om te meten)
    state.slides.forEach((slide, i) => {
      const info = S.renderSlide(measure, state, i, slideEnv(i), { scale: 0.05 });
      const key = (info.overflowKeys || [])[0] || (info.overflow ? 'title' : null);
      if (key) out(i, key);
      function out(index, k) {
        const f = D.nameOf(slide, k);
        list.push({ index, key: k, label: f.label, name: f.name, kind: 'te-lang', found: '' });
      }
    });
    return list.sort((a, b) => a.index - b.index);
  }

  // Eén regel per veld: "Titel: nog de voorbeeldtekst “…”"
  function checkRow(x) {
    const Label = x.label.charAt(0).toUpperCase() + x.label.slice(1);
    if (x.kind === 'leeg' && x.key !== 'value') return 'Deze slide is nog leeg.';
    const what = {
      voorbeeld: () => (x.key === 'table' ? 'nog de voorbeeldcijfers' : `nog de voorbeeldtekst “${x.found}”`),
      invulplek: () => `nog invullen: ${x.found}`,
      leeg: () => 'nog leeg, op de slide staat nu 0%',
      'te-lang': () => 'te lang, past ook op de kleinste letter niet',
    }[x.kind]();
    return `<b>${PM.esc(Label)}</b>: ${PM.esc(what)}`;
  }

  function beforeDownload(run) {
    const list = checkIssues();
    const sig = JSON.stringify(list);
    if (!list.length || sig === checkedSig) {
      run();
      return;
    }
    const slides = Array.from(new Set(list.map((x) => x.index)));
    const n = slides.length;
    const kinds = { voorbeeld: 'voorbeeldtekst', invulplek: 'iets om in te vullen', leeg: 'een lege plek', 'te-lang': 'tekst die niet past' };
    const found = Object.keys(kinds).filter((k) => list.some((x) => x.kind === k)).map((k) => kinds[k]);
    $('#checkLead').textContent = `Op ${n} ${n === 1 ? 'slide' : 'slides'} staat nog ${listNames(found)}. Zo komt het ook in je download.`;
    $('#checkList').innerHTML = slides.map((index) => {
      const rows = list.filter((x) => x.index === index);
      const slide = state.slides[index];
      return `<li class="check__item">
        <span class="check__slide"><b>Slide ${index + 1}</b> ${PM.esc(layoutOf(slide).name)}</span>
        <ul class="check__rows">${rows.map((x) => `<li>${checkRow(x)}</li>`).join('')}</ul>
        <button type="button" class="btn btn-quiet btn-xs check__goto" data-goto="${index}" data-key="${PM.esc(rows[0].key)}">naar slide ${index + 1}</button>
      </li>`;
    }).join('');
    checkGo = () => {
      checkedSig = sig;
      run();
    };
    shell.closePopover();
    if (typeof el.check.showModal === 'function') el.check.showModal();
    else el.check.setAttribute('open', '');
    $('#checkTitle').focus();
  }

  // "a, b en c"
  function listNames(names) {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`;
  }

  function closeCheck() {
    if (el.check.open) el.check.close();
  }

  // Naar het veld dat nog aandacht nodig heeft
  function gotoField(index, key) {
    closeCheck();
    selectSlide(index);
    let sel = FIELD[key];
    if (key === 'table') {
      const cells = tbl().cells;
      let at = '0,0';
      cells.some((row, r) => row.some((v, c) => {
        if (D.placeholders(v).length) at = `${r},${c}`;
        return D.placeholders(v).length > 0;
      }));
      sel = `[data-cell="${at}"]`;
    }
    requestAnimationFrame(() => shell.reveal('inhoud', sel || '#sTitle'));
  }

  el.check.addEventListener('click', (e) => {
    const go = e.target.closest('[data-check-go]');
    const to = e.target.closest('[data-goto]');
    // Klik op de achtergrond (buiten het vak) sluit ook
    const r = el.check.getBoundingClientRect();
    const outside = e.target === el.check && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
    if (e.target.closest('[data-check-close]') || outside) closeCheck();
    else if (to) gotoField(Number(to.dataset.goto), to.dataset.key);
    else if (go) {
      closeCheck();
      const fn = checkGo;
      checkGo = null;
      if (fn) fn();
    }
  });
  // Esc sluit alleen de controle (niet ook de rondleiding)
  el.check.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    closeCheck();
  });

  /* ---------------------------------------------------------------------------
     Toetsen en overig
     ------------------------------------------------------------------------- */

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!el.check.open) download('pdf', el.downloadBtn);
      return;
    }
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') selectSlide(state.active + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') selectSlide(state.active - 1);
  });

  // Nieuwe presentatie: meteen, met "ongedaan maken" in de melding in plaats van
  // een vraag vooraf. De foto's blijven tot de volgende keer laden bewaard
  $('#resetBtn').addEventListener('click', () => {
    const keep = state.exportWidth;
    state = defaults();
    state.exportWidth = keep;
    syncAll();
    changed(null);
    toast('Nieuwe presentatie gestart met de voorbeeldslides.', false, { label: 'ongedaan maken', run: () => history.undo() });
  });

  // Rondleiding: de stap "titel" gaat over slide 1
  document.addEventListener('pm:tour', (e) => {
    const d = e.detail || {};
    if (d.tool === 'presentation' && d.step === 'welkom' && state.active !== 0) selectSlide(0);
  });

  /* ---------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------- */

  // Logo: het bestand via een server; bij file:// de ingebedde kopie,
  // anders blokkeert de browser de export (zie scripts/build-brand-data.js)
  env.logo = PM.brandImage('logoWhite', render);
  buildLayoutTiles();
  syncAll();
  history.clear();
  render();
  PM.fontsReady.then(() => {
    render();
    drawStrip();
  });

  // Foto's uit een vorige sessie terugzetten, dan oude bestanden opruimen
  state.slides.forEach((s) => { if (s.photoKey) trackFile(s.photoKey); });
  applyPhotos().then(cleanupFiles);
})();
