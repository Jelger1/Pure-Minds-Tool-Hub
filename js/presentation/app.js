/* =============================================================================
   presentation/app.js — Presentation Maker
   -----------------------------------------------------------------------------
   Houdt de presentatie bij (slides met layout, tekst en uitsnede), koppelt die
   aan de velden en laat js/presentation/templates.js de preview, de
   miniaturen en de export tekenen. Tekst staat in localStorage, foto's per
   slide in IndexedDB, zodat alles een herlaadbeurt overleeft.
   ============================================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const S = window.PMSlides;
  const KEY = 'pm-presentation-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const PHOTO_LAYOUTS = new Set(['title', 'split', 'closing']);
  const MAX_SLIDES = 40;

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
      slides: [
        newSlide('title', { label: 'pure minds', title: 'Groeien met **online marketing**', subtitle: 'Strategie en plan voor het komende jaar', meta: `Pure Minds · ${date}` }),
        newSlide('section', { label: 'hoofdstuk', title: 'Waar staan we nu', subtitle: 'Een eerlijke blik op de huidige resultaten' }),
        newSlide('bullets', { label: 'analyse', title: 'Wat we zien in de data', body: 'Het meeste verkeer komt via betaalde zoekcampagnes\nDe landingspagina\'s converteren onder het gemiddelde\nMobiel groeit het hardst, maar converteert het slechtst\nRemarketing wordt nog niet ingezet' }),
        newSlide('split', { label: 'aanpak', title: 'Van klik naar klant', body: 'We brengen advertentie en landingspagina samen in één verhaal.\n- heldere belofte boven de vouw\n- één duidelijke actie per pagina\n- testen, meten en bijsturen' }),
        newSlide('table', { label: 'cijfers', title: 'Resultaten per kanaal', subtitle: 'Periode: [maand of kwartaal invullen]' }),
        newSlide('quote', { label: 'resultaat', style: 'stat', value: '+184%', subtitle: 'meer aanvragen binnen drie maanden', author: 'Bron: [bron invullen]', quote: 'Eindelijk zien we precies waar ons **budget** naartoe gaat.' }),
        newSlide('closing', { label: 'contact', title: 'Bedankt', subtitle: 'Vragen? We denken graag met je mee.', body: '[naam] · [functie]\n[e-mailadres]\npureminds.nl' }),
      ],
    };
  }

  function load() {
    const state = defaults();
    const saved = PM.store.get(KEY, null);
    if (saved && typeof saved === 'object') {
      for (const k of ['dot', 'showNumbers', 'exportWidth', 'active']) {
        if (typeof saved[k] === typeof state[k]) state[k] = saved[k];
      }
      if (Array.isArray(saved.slides) && saved.slides.length) {
        const ids = new Set(S.LAYOUTS.map((l) => l.id));
        state.slides = saved.slides
          .filter((s) => s && typeof s === 'object')
          .map((s) => {
            const base = newSlide(ids.has(s.layout) ? s.layout : 'bullets');
            for (const k of Object.keys(base)) {
              if (k === 'crop') base.crop = { ...base.crop, ...(s.crop && typeof s.crop === 'object' ? s.crop : {}) };
              else if (k === 'table') base.table = S.normalizeTable(s.table);
              else if (typeof s[k] === typeof base[k]) base[k] = s[k];
            }
            return base;
          })
          .slice(0, MAX_SLIDES);
      }
    }
    if (!state.slides.length) state.slides = defaults().slides;
    state.active = Math.min(Math.max(0, state.active | 0), state.slides.length - 1);
    if (![1920, 3840].includes(state.exportWidth)) state.exportWidth = 1920;
    return state;
  }

  let state = load();
  const save = PM.debounce(() => PM.store.set(KEY, state), 300);
  const current = () => state.slides[state.active];

  /* ---------------------------------------------------------------------------
     Elementen
     ------------------------------------------------------------------------- */

  const el = {
    editor: $('#editor'),
    canvas: $('#slideCanvas'),
    stage: $('#stage'),
    strip: $('#slideStrip'),
    layoutGrid: $('#layoutGrid'),
    slideNo: $('#slideNo'),
    slidePill: $('#slidePill'),
    dimPill: $('#dimPill'),
    warning: $('#warning'),
    photoDrop: $('#photoDrop'),
    photoInput: $('#photoInput'),
    photoCard: $('#photoCard'),
    photoThumb: $('#photoThumb'),
    photoName: $('#photoName'),
    photoSize: $('#photoSize'),
    showNumbers: $('#showNumbers'),
    dot: $('#dotToggle'),
    pdfBtn: $('#pdfBtn'),
    pptxBtn: $('#pptxBtn'),
    pngBtn: $('#pngBtn'),
    pngAllBtn: $('#pngAllBtn'),
    previewPhotoBtn: $('#previewPhotoBtn'),
    cropControls: $('#cropControls'),
    cropHint: $('#cropHint'),
    layoutToggle: $('#layoutToggle'),
    slideAdd: $('#slideAdd'),
    tableGrid: $('#tableGrid'),
    tableHeader: $('#tableHeader'),
    tableFirstCol: $('#tableFirstCol'),
  };

  // Logo en foto's per slide-id: { img, url, name, size }
  const env = { logo: null, images: {} };

  function sectionNumber(index) {
    let n = 0;
    for (let i = 0; i <= index; i++) if (state.slides[i].layout === 'section') n++;
    return Math.max(1, n);
  }

  function slideEnv(index, slide = state.slides[index]) {
    const image = env.images[slide.id];
    return { logo: env.logo, photo: image ? image.img : null, crop: slide.crop, sectionNumber: sectionNumber(index) };
  }

  /* ---------------------------------------------------------------------------
     Renderen
     ------------------------------------------------------------------------- */

  let lastInfo = {};
  let frame = 0;

  function render() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      lastInfo = S.renderSlide(el.canvas, state, state.active, slideEnv(state.active));
      el.canvas.classList.toggle('can-pan', !!lastInfo.photo);
      el.slidePill.textContent = `slide ${state.active + 1} van ${state.slides.length}`;
      el.dimPill.textContent = state.exportWidth === 3840 ? '3840 × 2160 px' : '1920 × 1080 px';
      updateWarning();
      syncPhotoPrompt();
      mini.update();
    });
    renderThumbsSoon();
  }

  const renderThumbsSoon = PM.debounce(() => {
    renderStrip();
    if (!el.layoutGrid.hidden) renderLayoutTiles();
  }, 160);

  function renderStrip() {
    const items = $$('.strip__item', el.strip);
    state.slides.forEach((slide, i) => {
      let btn = items[i];
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'strip__item';
        btn.draggable = true;
        btn.innerHTML = '<canvas></canvas><span class="strip__no"></span>';
        btn.addEventListener('click', () => selectSlide(Number(btn.dataset.index)));
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/x-pm-slide', btn.dataset.index);
          e.dataTransfer.effectAllowed = 'move';
          btn.classList.add('is-dragging');
        });
        btn.addEventListener('dragend', () => {
          btn.classList.remove('is-dragging');
          $$('.is-drop', el.strip).forEach((n) => n.classList.remove('is-drop'));
        });
        btn.addEventListener('dragover', (e) => {
          if (!e.dataTransfer.types.includes('text/x-pm-slide')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          $$('.is-drop', el.strip).forEach((n) => n !== btn && n.classList.remove('is-drop'));
          btn.classList.add('is-drop');
        });
        btn.addEventListener('drop', (e) => {
          const from = e.dataTransfer.getData('text/x-pm-slide');
          if (from === '') return;
          e.preventDefault();
          moveSlideTo(Number(from), Number(btn.dataset.index));
        });
        el.strip.appendChild(btn);
      }
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', `Slide ${i + 1}: ${layoutOf(slide).name}`);
      btn.setAttribute('aria-current', String(i === state.active));
      btn.lastChild.textContent = String(i + 1);
      S.renderSlide(btn.firstChild, state, i, slideEnv(i), { scale: 240 / S.W });
    });
    items.slice(state.slides.length).forEach((b) => b.remove());
  }

  const layoutOf = (slide) => S.LAYOUTS.find((l) => l.id === slide.layout) || S.LAYOUTS[0];

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

  function updateWarning() {
    const msgs = [];
    const s = current();
    if (lastInfo.overflow && s.layout === 'table') msgs.push('De tabel past niet op de slide, ook niet op de kleinste letter. Haal rijen weg, maak teksten korter of verdeel de tabel over twee slides.');
    else if (lastInfo.overflow) msgs.push('De tekst is te lang voor deze slide en is maximaal verkleind. Kort hem in of verdeel hem over twee slides.');
    el.warning.hidden = !msgs.length;
    el.warning.textContent = msgs.join(' ');
  }

  // Een foto hoort bij titelslide, beeld + tekst en afsluiter; bij beeld + tekst
  // is de lege fotoplek zelf klikbaar, zoals een placeholder in Canva
  function syncPhotoPrompt() {
    const s = current();
    const canHave = PHOTO_LAYOUTS.has(s.layout) && !env.images[s.id];
    const placeholder = s.layout === 'split' && !env.images[s.id];
    el.previewPhotoBtn.hidden = !canHave;
    el.canvas.classList.toggle('needs-photo', placeholder);
    el.canvas.title = placeholder ? 'Klik om een foto te kiezen, of sleep er een hierheen' : '';
    el.canvas.tabIndex = placeholder || lastInfo.photo ? 0 : -1;
  }

  /* ---------------------------------------------------------------------------
     Velden
     ------------------------------------------------------------------------- */

  function buildLayoutTiles() {
    el.layoutGrid.innerHTML = S.LAYOUTS.map((l) => `
      <label class="layout-tile">
        <input type="radio" name="layout" value="${l.id}">
        <canvas data-layout="${l.id}" width="272" height="153" aria-hidden="true"></canvas>
        <b>${PM.esc(l.name)}</b><i>${PM.esc(l.sub)}</i>
      </label>`).join('');
  }

  function syncVisibility() {
    const s = current();
    const keys = [s.layout, `${s.layout}.${s.style}`];
    for (const n of $$('[data-for]', el.editor)) {
      n.hidden = !n.dataset.for.split(/\s+/).some((k) => keys.includes(k));
    }
    for (const n of $$('[data-layout-text]', el.editor)) {
      const map = Object.fromEntries(n.dataset.layoutText.split('|').map((p) => p.split(':')));
      if (map[s.layout] != null) n.textContent = map[s.layout];
    }
    // Nadruk in de tekst: vet bij opsomming en beeld + tekst, cyaan bij de afsluiter
    const bodyEmph = $('#bodyEmph');
    const cyanBody = s.layout === 'closing';
    bodyEmph.textContent = cyanBody ? 'cyaan' : 'vet';
    bodyEmph.classList.toggle('emph-btn--bold', !cyanBody);
    // Stappen doornummeren: alleen de zichtbare
    $$('fieldset.block:not([hidden]) [data-step]', el.editor).forEach((badge, i) => {
      badge.textContent = String(i + 1);
    });
  }

  function syncInputs() {
    const s = current();
    for (const input of $$('[data-bind]', el.editor)) {
      const value = s[input.dataset.bind];
      if (input.type === 'radio') input.checked = input.value === value;
      else input.value = value == null ? '' : String(value);
    }
    $$('input[name="layout"]', el.layoutGrid).forEach((r) => { r.checked = r.value === s.layout; });
    el.showNumbers.checked = state.showNumbers !== false;
    el.dot.checked = state.dot !== false;
    $$('input[name="res"]').forEach((r) => { r.checked = Number(r.value) === state.exportWidth; });
    el.slideNo.textContent = `slide ${state.active + 1}`;
    $('#layoutNowName').textContent = layoutOf(current()).name;
    $('#layoutNowSub').textContent = layoutOf(current()).sub;
    syncPhoto();
    syncCrop();
    syncSlideBar();
    renderTableEditor();
    syncVisibility();
  }

  /* ---------------------------------------------------------------------------
     Tabel bewerken: een raster van invoervelden. Het raster wordt alleen
     opnieuw opgebouwd bij rijen/kolommen toevoegen of weghalen, niet bij
     typen, zodat de cursor blijft staan.
     ------------------------------------------------------------------------- */

  const LIM = S.TABLE_LIMITS;
  const tbl = () => current().table;

  function renderTableEditor(focus) {
    const t = tbl();
    const nR = t.cells.length;
    const nC = t.cells[0].length;
    el.tableHeader.checked = t.header;
    el.tableFirstCol.checked = t.firstCol;
    el.tableGrid.style.setProperty('--cols', nC);
    const colBtns = Array.from({ length: nC }, (_, c) => `<button type="button" class="tbl__del" data-del-col="${c}" aria-label="Kolom ${c + 1} verwijderen" title="Kolom verwijderen"${nC === 1 ? ' disabled' : ''}>&times;</button>`).join('');
    const rows = t.cells.map((row, r) => {
      const head = t.header && r === 0;
      const inputs = row.map((v, c) => `<input class="input tbl__cell${head ? ' is-head' : ''}" data-cell="${r},${c}" value="${PM.esc(v)}" maxlength="160" aria-label="${head ? 'Kop' : `Rij ${t.header ? r : r + 1}`}, kolom ${c + 1}" spellcheck="true">`).join('');
      return `${inputs}<button type="button" class="tbl__del" data-del-row="${r}" aria-label="Rij ${r + 1} verwijderen" title="Rij verwijderen"${nR === 1 ? ' disabled' : ''}>&times;</button>`;
    }).join('');
    el.tableGrid.innerHTML = `${colBtns}<span></span>${rows}`;
    $('#addRow').disabled = nR >= LIM.rows;
    $('#addCol').disabled = nC >= LIM.cols;
    if (focus) {
      const input = $(`[data-cell="${focus[0]},${focus[1]}"]`, el.tableGrid);
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function tableChanged(focus) {
    renderTableEditor(focus);
    changed();
  }

  function addRow(at = tbl().cells.length) {
    const t = tbl();
    if (t.cells.length >= LIM.rows) {
      PM.toast(`Maximaal ${LIM.rows} rijen: meer is op een slide niet te lezen. Verdeel de tabel over twee slides.`, true);
      return false;
    }
    t.cells.splice(at, 0, Array(t.cells[0].length).fill(''));
    return true;
  }

  function addCol() {
    const t = tbl();
    if (t.cells[0].length >= LIM.cols) {
      PM.toast(`Maximaal ${LIM.cols} kolommen: meer is op een slide niet te lezen.`, true);
      return false;
    }
    t.cells.forEach((row) => row.push(''));
    return true;
  }

  $('#addRow').addEventListener('click', () => {
    if (addRow()) tableChanged([tbl().cells.length - 1, 0]);
  });
  $('#addCol').addEventListener('click', () => {
    if (addCol()) tableChanged([0, tbl().cells[0].length - 1]);
  });

  el.tableGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const t = tbl();
    if (btn.dataset.delRow != null && t.cells.length > 1) {
      t.cells.splice(Number(btn.dataset.delRow), 1);
      tableChanged();
    } else if (btn.dataset.delCol != null && t.cells[0].length > 1) {
      const c = Number(btn.dataset.delCol);
      t.cells.forEach((row) => row.splice(c, 1));
      tableChanged();
    }
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
    PM.toast(cut ? `Geplakt, maar alleen de eerste ${LIM.rows} rijen en ${LIM.cols} kolommen passen.` : `${data.length} ${data.length === 1 ? 'rij' : 'rijen'} geplakt.`, cut);
  });

  function syncCrop() {
    const c = current().crop;
    $('#cropZoom').value = String(Math.round(c.zoom * 100));
    $('#cropZoomVal').textContent = `${Math.round(c.zoom * 100)}%`;
  }

  function syncPhoto() {
    const image = env.images[current().id];
    el.photoCard.hidden = !image;
    el.photoDrop.hidden = !!image;
    el.cropControls.hidden = !image;
    el.cropHint.hidden = !image;
    if (image) {
      el.photoThumb.style.backgroundImage = `url("${image.url}")`;
      el.photoName.textContent = image.name;
      el.photoSize.textContent = `${image.img.naturalWidth} × ${image.img.naturalHeight} px${image.size ? ` · ${PM.formatSize(image.size)}` : ''}`;
    }
  }

  function syncSlideBar() {
    el.slideAdd.disabled = state.slides.length >= MAX_SLIDES;
    $('#slideLeft').disabled = state.active === 0;
    $('#slideRight').disabled = state.active === state.slides.length - 1;
    $('#slideDel').disabled = state.slides.length === 1;
    $('#slideDup').disabled = state.slides.length >= MAX_SLIDES;
  }

  // Layoutkeuze in- en uitklappen
  function setLayoutOpen(open) {
    el.layoutGrid.hidden = !open;
    el.layoutToggle.setAttribute('aria-expanded', String(open));
    el.layoutToggle.textContent = open ? 'klaar' : 'andere layout';
    if (open) renderLayoutTiles();
  }
  el.layoutToggle.addEventListener('click', () => setLayoutOpen(el.layoutGrid.hidden));

  function changed() {
    save();
    render();
  }

  el.editor.addEventListener('submit', (e) => e.preventDefault());

  el.editor.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.bind) {
      if (t.type === 'radio' && !t.checked) return;
      current()[t.dataset.bind] = t.value;
      if (t.type === 'radio') syncVisibility();
      changed();
    } else if (t.dataset.crop) {
      current().crop[t.dataset.crop] = Number(t.value) / 100;
      syncCrop();
      changed();
    } else if (t.dataset.cell) {
      const [r, c] = t.dataset.cell.split(',').map(Number);
      const row = tbl().cells[r];
      if (row) row[c] = t.value;
      changed();
    }
  });

  el.editor.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'layout' && t.checked) {
      current().layout = t.value;
      syncInputs();
      changed();
    } else if (t.dataset.bind && t.type === 'radio' && t.checked) {
      current()[t.dataset.bind] = t.value;
      syncVisibility();
      changed();
    } else if (t === el.showNumbers) {
      state.showNumbers = t.checked;
      changed();
    } else if (t === el.dot) {
      state.dot = t.checked;
      changed();
    } else if (t === el.tableHeader || t === el.tableFirstCol) {
      tbl()[t === el.tableHeader ? 'header' : 'firstCol'] = t.checked;
      tableChanged();
    }
  });

  $$('input[name="res"]').forEach((r) => r.addEventListener('change', () => {
    if (!r.checked) return;
    state.exportWidth = Number(r.value) === 3840 ? 3840 : 1920;
    changed();
  }));

  // Knoppen "cyaan" en "vet" (gedeeld, zie PM.textTools)
  PM.textTools(el.editor);

  /* ---------------------------------------------------------------------------
     Slides beheren
     ------------------------------------------------------------------------- */

  function selectSlide(i) {
    state.active = Math.min(Math.max(0, i), state.slides.length - 1);
    syncInputs();
    changed();
  }

  // Een nieuwe slide: kies meteen de layout (de keuze staat open)
  function addSlide() {
    if (state.slides.length >= MAX_SLIDES) return;
    const layout = ['title', 'closing'].includes(current().layout) ? 'bullets' : current().layout;
    state.slides.splice(state.active + 1, 0, newSlide(layout, { label: current().label }));
    selectSlide(state.active + 1);
    setLayoutOpen(true);
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.layoutGrid.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' });
  }

  el.slideAdd.addEventListener('click', addSlide);

  function moveSlideTo(from, to) {
    if (from === to || from < 0 || to < 0 || from >= state.slides.length || to >= state.slides.length) return;
    const [slide] = state.slides.splice(from, 1);
    state.slides.splice(to, 0, slide);
    selectSlide(to);
  }

  function moveSlide(delta) {
    const to = state.active + delta;
    if (to < 0 || to >= state.slides.length) return;
    const [slide] = state.slides.splice(state.active, 1);
    state.slides.splice(to, 0, slide);
    selectSlide(to);
  }

  $('#slideLeft').addEventListener('click', () => moveSlide(-1));
  $('#slideRight').addEventListener('click', () => moveSlide(1));

  $('#slideDup').addEventListener('click', async () => {
    if (state.slides.length >= MAX_SLIDES) return;
    const src = current();
    const copy = { ...JSON.parse(JSON.stringify(src)), id: PM.uid() };
    state.slides.splice(state.active + 1, 0, copy);
    const blob = await PM.idb.get(`slide:${src.id}`);
    if (blob instanceof Blob) await setImage(copy.id, blob, { name: env.images[src.id] && env.images[src.id].name });
    selectSlide(state.active + 1);
  });

  // Verwijderen gaat meteen, met "ongedaan maken" in de melding: de slide en
  // zijn foto blijven nog even bewaard
  $('#slideDel').addEventListener('click', () => {
    if (state.slides.length === 1) return;
    const index = state.active;
    const [removed] = state.slides.splice(index, 1);
    const image = env.images[removed.id];
    delete env.images[removed.id];
    PM.idb.del(`slide:${removed.id}`);
    selectSlide(Math.min(index, state.slides.length - 1));
    let undone = false;
    PM.toast(`Slide ${index + 1} verwijderd.`, false, {
      label: 'ongedaan maken',
      run: async () => {
        undone = true;
        state.slides.splice(index, 0, removed);
        if (image) {
          env.images[removed.id] = image;
          const blob = await fetch(image.url).then((r) => r.blob()).catch(() => null);
          if (blob) PM.idb.set(`slide:${removed.id}`, blob);
        }
        selectSlide(index);
      },
    });
    setTimeout(() => { if (!undone && image) URL.revokeObjectURL(image.url); }, 10000);
  });

  /* ---------------------------------------------------------------------------
     Foto's
     ------------------------------------------------------------------------- */

  async function setImage(id, file, { persist = true, name } = {}) {
    const { img, url } = await PM.readImage(file);
    if (env.images[id]) URL.revokeObjectURL(env.images[id].url);
    env.images[id] = { img, url, name: name || file.name || 'afbeelding', size: file.size };
    if (persist) await PM.idb.set(`slide:${id}`, file);
  }

  function dropImage(id) {
    if (env.images[id]) URL.revokeObjectURL(env.images[id].url);
    delete env.images[id];
    PM.idb.del(`slide:${id}`);
  }

  async function setPhoto(file) {
    const s = current();
    if (!PHOTO_LAYOUTS.has(s.layout)) {
      PM.toast('Deze layout heeft geen foto. Kies titelslide, beeld + tekst of afsluiter.', true);
      return;
    }
    try {
      await setImage(s.id, file);
      s.crop = { zoom: 1, fx: 0.5, fy: 0.5 };
      if (Math.min(env.images[s.id].img.naturalWidth, env.images[s.id].img.naturalHeight) < 900) {
        PM.toast('Let op: deze foto is klein en kan onscherp worden op een groot scherm.');
      }
      syncInputs();
      changed();
    } catch (err) {
      PM.toast(err.message, true);
    }
  }

  el.photoDrop.addEventListener('click', () => el.photoInput.click());
  el.photoDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.photoInput.click();
    }
  });
  $('#photoReplace').addEventListener('click', () => el.photoInput.click());
  el.previewPhotoBtn.addEventListener('click', () => el.photoInput.click());
  el.canvas.addEventListener('click', () => {
    if (current().layout === 'split' && !env.images[current().id]) el.photoInput.click();
  });
  $('#cropReset').addEventListener('click', () => {
    current().crop = { zoom: 1, fx: 0.5, fy: 0.5 };
    syncCrop();
    changed();
  });
  // Met het toetsenbord: Enter kiest een foto, pijltjes verschuiven hem
  el.canvas.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && current().layout === 'split' && !env.images[current().id]) {
      e.preventDefault();
      el.photoInput.click();
      return;
    }
    const dir = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!dir || !lastInfo.photo) return;
    e.preventDefault();
    const c = current().crop;
    const step = e.shiftKey ? 0.1 : 0.02;
    c.fx = Math.min(1, Math.max(0, c.fx + dir[0] * step));
    c.fy = Math.min(1, Math.max(0, c.fy + dir[1] * step));
    changed();
  });
  $('#photoClear').addEventListener('click', () => {
    dropImage(current().id);
    syncInputs();
    render();
  });
  el.photoInput.addEventListener('change', () => {
    const file = el.photoInput.files[0];
    el.photoInput.value = '';
    if (file) setPhoto(file);
  });
  PM.bindDrop(el.photoDrop, setPhoto);
  PM.bindDrop(el.stage, setPhoto);
  PM.preventStrayDrops();

  document.addEventListener('paste', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const item = Array.from(e.clipboardData ? e.clipboardData.items : []).find((i) => i.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    setPhoto(item.getAsFile());
  });

  // Uitsnede verschuiven door in de preview te slepen
  let pan = null;
  el.canvas.addEventListener('pointerdown', (e) => {
    if (!lastInfo.photo) return;
    const c = current().crop;
    pan = { x: e.clientX, y: e.clientY, fx: c.fx, fy: c.fy };
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
    syncCrop();
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

  /* ---------------------------------------------------------------------------
     Export
     ------------------------------------------------------------------------- */

  const deckName = () => PM.slug(state.slides[0].title || state.slides[0].label) || 'presentatie';
  const slideFile = (i) => `pureminds-presentatie-${deckName()}-slide-${String(i + 1).padStart(2, '0')}.png`;

  async function slideBlob(i) {
    await PM.fontsReady;
    const canvas = document.createElement('canvas');
    S.renderSlide(canvas, state, i, slideEnv(i), { scale: state.exportWidth / S.W });
    return PM.canvasToBlob(canvas, 'image/png');
  }

  el.pngBtn.addEventListener('click', () => PM.run(el.pngBtn, 'bezig…', async () => {
    const name = slideFile(state.active);
    PM.saveBlob(await slideBlob(state.active), name);
    PM.toast(`Gedownload: ${name}`);
    return 'gedownload';
  }));

  // Alle slides in één zip: geen reeks losse downloads die de browser blokkeert
  el.pngAllBtn.addEventListener('click', () => PM.run(el.pngAllBtn, 'bezig…', async (progress) => {
    const JSZip = await PM.libs.jszip();
    const zip = new JSZip();
    for (let i = 0; i < state.slides.length; i++) {
      progress(`slide ${i + 1} van ${state.slides.length}…`);
      zip.file(slideFile(i), await slideBlob(i));
    }
    progress('inpakken…');
    const name = `pureminds-presentatie-${deckName()}-slides.zip`;
    PM.saveBlob(await zip.generateAsync({ type: 'blob' }), name);
    PM.toast(`${state.slides.length} slides gedownload in ${name}`);
    return `${state.slides.length} slides`;
  }));

  // PDF: één 16:9-pagina per slide (960 × 540 pt, zoals PowerPoint), als vector
  // met echte tekst. Dezelfde renderfunctie als de preview tekent via
  // PMPdfCanvas rechtstreeks in de PDF; alleen foto's zijn afbeeldingen.
  async function exportPdf(progress) {
    const JsPDF = await PM.libs.svg2pdf();
    await PM.fontsReady;
    const pdf = new JsPDF({ unit: 'pt', format: [960, 540], orientation: 'landscape', compress: true, putOnlyUsedFonts: true });
    await PM.pdfFonts(pdf);
    const vectors = new Map([[env.logo, PM.brandSvg('logoWhiteSvg')]]);
    for (let i = 0; i < state.slides.length; i++) {
      progress(`slide ${i + 1} van ${state.slides.length}…`);
      await PM.wait(0);  // knoptekst laten verversen
      if (i > 0) pdf.addPage([960, 540], 'landscape');
      const ctx = new window.PMPdfCanvas(pdf, { width: S.W, height: S.H, pageWidth: 960, vectors });
      S.renderSlide(ctx.canvas, state, i, slideEnv(i));
      await ctx.flush();
    }
    const title = String(state.slides[0].title || 'Presentatie').replace(/\*\*/g, '');
    pdf.setProperties({ title, author: 'Pure Minds', creator: 'Pure Minds Generator Hub' });
    const name = `pureminds-presentatie-${deckName()}.pdf`;
    PM.saveBlob(pdf.output('blob'), name);
    PM.toast(`PDF met ${state.slides.length} slides gedownload: ${name}`);
    return 'pdf gedownload';
  }
  const downloadPdf = () => PM.run(el.pdfBtn, 'pdf maken…', exportPdf);
  el.pdfBtn.addEventListener('click', downloadPdf);

  // PowerPoint: dezelfde slides als bewerkbare tekstvakken, vormen en foto's
  // (js/presentation/pptx.js). Opent ook in Google Presentaties en Keynote.
  async function exportPptx(progress) {
    const blob = await window.PMSlidesPptx.exportDeck(state, slideEnv, env.images, (i, total) => progress(`slide ${i + 1} van ${total}…`));
    const name = `pureminds-presentatie-${deckName()}.pptx`;
    PM.saveBlob(blob, name);
    PM.toast(`PowerPoint met ${state.slides.length} slides gedownload: ${name}`);
    return 'powerpoint gedownload';
  }
  el.pptxBtn.addEventListener('click', () => PM.run(el.pptxBtn, 'powerpoint maken…', exportPptx));

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadPdf();
      return;
    }
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') selectSlide(state.active + 1);
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') selectSlide(state.active - 1);
  });

  // Nieuwe presentatie: meteen, met "ongedaan maken" in de melding in plaats van
  // een vraag vooraf; de slides en hun foto's blijven nog even bewaard
  $('#resetBtn').addEventListener('click', () => {
    const before = state;
    const images = { ...env.images };
    for (const s of before.slides) {
      delete env.images[s.id];
      PM.idb.del(`slide:${s.id}`);
    }
    state = defaults();
    syncInputs();
    changed();
    let undone = false;
    PM.toast('Nieuwe presentatie gestart met de voorbeeldslides.', false, {
      label: 'ongedaan maken',
      run: async () => {
        undone = true;
        for (const s of state.slides) dropImage(s.id);
        state = before;
        Object.assign(env.images, images);
        syncInputs();
        changed();
        for (const [id, image] of Object.entries(images)) {
          const blob = await fetch(image.url).then((r) => r.blob()).catch(() => null);
          if (blob) PM.idb.set(`slide:${id}`, blob);
        }
      },
    });
    setTimeout(() => {
      if (!undone) Object.values(images).forEach((image) => URL.revokeObjectURL(image.url));
    }, 10000);
  });

  /* ---------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------- */

  // Mobiel: kleine live preview zolang de grote uit beeld is (gedeeld, zie PM.miniPreview)
  const mini = PM.miniPreview(el.stage, el.canvas);

  env.logo = PM.brandImage('logoWhite', render);
  buildLayoutTiles();
  syncInputs();
  render();
  PM.fontsReady.then(render);

  // Foto's uit een vorige sessie terugzetten
  Promise.all(state.slides.map((s) => PM.idb.get(`slide:${s.id}`).then((blob) => (
    blob instanceof Blob ? setImage(s.id, blob, { persist: false, name: blob.name }).catch(() => null) : null
  )))).then(() => {
    syncPhoto();
    render();
  });
})();
