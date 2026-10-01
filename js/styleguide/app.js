/* =============================================================================
   styleguide/app.js — de Brand Styleguide: podium, hoofdstukken, gereedschap
   -----------------------------------------------------------------------------
   Het podium toont de brandbook-pagina's onder elkaar, getekend door
   js/styleguide/pages.js (dezelfde functies als de PDF). Een hoofdstuk kiezen
   in de rail scrolt naar zijn eerste pagina en opent zijn paneel; blader je
   zelf naar een ander hoofdstuk (scrollen, miniaturen, Page Up/Down), dan volgt
   het paneel (alleen op een breed scherm, en alleen als er een paneel open staat).

   Panelen: teksten en kleurwaarden kopiëren, logo's downloaden, de clear space
   tonen, contrast checken, de 60/30/10-regel, de typeschaal als CSS, een
   fotocheck, de icoonvarianten en de Emerce-badge. Zoeken (appbalk) doorzoekt
   alle teksten (js/styleguide/model.js) en springt naar de pagina.

   Opslag in PM.store 'pm-styleguide-v1': variant, clear space, compositie,
   contrastkleuren, logobreedte en de fotocheck.
   ============================================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const S = window.PMStyleguide;
  const M = window.PMStyleguideModel;
  const T = window.PM_BRAND_TOKENS;
  const C = window.PM_BRAND_CONTENT;
  const X = window.PMStyleguideExport;
  const SVG = window.PMSvgPath;

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = PM.esc;
  const toast = (msg, err) => PM.toast(msg, err);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------------
     Staat
     ------------------------------------------------------------------------- */

  const KEY = 'pm-styleguide-v1';
  const COLOR_IDS = T.allColors().map((c) => c.id);
  function load() {
    const s = PM.store.get(KEY, {}) || {};
    const pick = (v, list, def) => (list.includes(v) ? v : def);
    return {
      variant: pick(s.variant, ['wit', 'inkt'], 'wit'),
      overlay: s.overlay === true,
      ratio: pick(s.ratio, ['licht', 'donker'], 'licht'),
      fg: pick(s.fg, COLOR_IDS, 'wit'),
      bg: pick(s.bg, COLOR_IDS, 'inkt'),
      logoW: Number.isFinite(Number(s.logoW)) && Number(s.logoW) > 0 ? Math.round(Number(s.logoW)) : 116,
      checks: Array.isArray(s.checks) ? [...new Set(s.checks.filter((n) => Number.isInteger(n) && n >= 0 && n < C.imagery.checks.length))] : [],
      page: Number.isInteger(s.page) ? Math.max(0, Math.min(S.pages.length - 1, s.page)) : 0,
    };
  }
  const state = load();
  const save = PM.debounce(() => PM.store.set(KEY, state), 250);

  // Logo en badge één keer als paden (ingebedde kopie: werkt ook vanaf schijf)
  const env = {
    logo: SVG.parseSvg(PM.brandSvg('logoWhiteSvg')),
    badgeWhite: SVG.parseSvg(PM.brandSvg('badgeWhite')),
    badgeBlack: SVG.parseSvg(PM.brandSvg('badgeBlack')),
  };

  const chapterOf = (i) => S.pages[i].chapter;
  const firstOf = (chapter) => S.pages.find((p) => p.chapter === chapter).index;
  const chapterName = (id) => (C.chapters.find((c) => c.id === id) || {}).label || '';

  const el = {
    app: $('[data-app="styleguide"]'),
    pages: $('#pages'),
    strip: $('#strip'),
    pagePill: $('#pagePill'),
    chapterPill: $('#chapterPill'),
    exportBtn: $('#exportBtn'),
    query: $('#sgQuery'),
    results: $('#sgResults'),
    search: $('#search'),
    find: $('#find'),               // veld plus de zoekknop voor een telefoon
    searchOpen: $('#searchOpen'),
  };

  /* ---------------------------------------------------------------------------
     De indeling (PM.shell). Opent het hoofdstuk van de laatst bekeken pagina
     ------------------------------------------------------------------------- */

  const params = PM.startParams();
  const shell = PM.shell(el.app, { tool: 'styleguide', open: chapterOf(state.page) });

  /* ---------------------------------------------------------------------------
     Podium: de pagina's, pas getekend als ze in beeld komen
     ------------------------------------------------------------------------- */

  const figs = S.pages.map((p) => {
    const fig = document.createElement('figure');
    fig.className = `sg-page${p.dark ? ' is-dark' : ''}`;
    fig.id = `pagina-${p.id}`;
    fig.dataset.index = p.index;
    fig.innerHTML = `<canvas role="img" aria-label="Pagina ${p.index + 1}: ${esc(p.title)}"></canvas>`;
    el.pages.appendChild(fig);
    return fig;
  });
  const drawn = new Map();   // index -> breedte in px waarop hij getekend is

  function renderPage(i) {
    const fig = figs[i];
    const w = Math.round(fig.clientWidth * Math.min(2, window.devicePixelRatio || 1));
    if (!w) return;
    const key = `${w}|${state.overlay}`;
    if (drawn.get(i) === key) return;
    S.render($('canvas', fig), i, { ...env, overlay: state.overlay }, w / S.W);
    drawn.set(i, key);
  }

  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const i = Number(e.target.dataset.index);
      if (e.isIntersecting) visible.add(i);
      else visible.delete(i);
    });
    visible.forEach(renderPage);
  }, { root: el.pages, rootMargin: '600px 0px' });

  function redrawVisible() {
    drawn.clear();
    visible.forEach(renderPage);
  }

  /* --- Miniaturen --- */

  const thumbs = S.pages.map((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'strip__item sg-thumb';
    b.setAttribute('role', 'option');
    b.dataset.index = p.index;
    b.title = `${p.index + 1}. ${p.title}`;
    b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="strip__no">${p.index + 1}</span><span class="sr-only">Pagina ${p.index + 1}: ${esc(p.title)}</span>`;
    el.strip.appendChild(b);
    return b;
  });
  function renderThumbs() {
    const w = Math.round(112 * Math.min(2, window.devicePixelRatio || 1));
    thumbs.forEach((b, i) => S.render($('canvas', b), i, env, w / S.W));
  }

  /* --- Welke pagina is in beeld --- */

  let current = -1;
  let jump = null;          // een sprong die nog onderweg is: { top, until }
  let following = false;    // het paneel volgt de pagina: dan niet naar het begin van dat hoofdstuk springen

  // Het paneel volgt het hoofdstuk dat in beeld komt: alleen op een breed scherm en als er een
  // paneel open staat (force: ook als er geen open staat, zoals na een zoekresultaat)
  function follow(chapter, { force = false } = {}) {
    if (shell.isNarrow || shell.current === chapter || (!shell.current && !force)) return;
    following = true;
    shell.open(chapter);
    following = false;
  }

  function setCurrent(i, { fromScroll = false } = {}) {
    if (i === current) return;
    const prevChapter = current >= 0 ? chapterOf(current) : null;
    current = i;
    state.page = i;
    save();
    const ch = chapterOf(i);
    el.pagePill.textContent = `pagina ${i + 1} van ${S.pages.length}`;
    el.chapterPill.textContent = chapterName(ch);
    $('#pdfChapterSum').textContent = `${chapterName(ch)}: ${S.pages.filter((p) => p.chapter === ch).length === 1 ? '1 pagina' : `${S.pages.filter((p) => p.chapter === ch).length} pagina's`}`;
    // Eén miniatuur in de tabvolgorde (de gekozen), de pijltjes doen de rest
    thumbs.forEach((b, k) => {
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    const t = thumbs[i];
    const s = el.strip;
    if (t.offsetLeft < s.scrollLeft + 8 || t.offsetLeft + t.offsetWidth > s.scrollLeft + s.clientWidth - 8) {
      s.scrollTo({ left: t.offsetLeft - s.clientWidth / 2 + t.offsetWidth / 2, behavior: reduced() ? 'auto' : 'smooth' });
    }
    $$('.rail__item').forEach((r) => r.classList.toggle('is-here', r.dataset.section === ch));
    $$('.sg-pagelist a').forEach((a) => a.toggleAttribute('aria-current', Number(a.dataset.index) === i));
    // Zelf gescrold naar een ander hoofdstuk: het paneel volgt (goTo laat het paneel zelf volgen)
    if (fromScroll && prevChapter !== ch) follow(ch);
  }

  // De pagina in beeld: de laatste waarvan de bovenkant boven 40% van het podium staat (op een
  // hoog scherm, met meer pagina's tegelijk in beeld: boven een halve pagina). Helemaal
  // onderaan altijd de laatste: op een hoog scherm komt die anders nooit zo ver
  function pageInView() {
    const box = el.pages;
    if (box.scrollTop > 0 && box.scrollTop + box.clientHeight >= box.scrollHeight - 2) return figs.length - 1;
    const mid = box.scrollTop + Math.min(box.clientHeight * 0.4, figs[0].offsetHeight * 0.5);
    let best = 0;
    figs.forEach((f, i) => { if (f.offsetTop <= mid) best = i; });
    return best;
  }

  // Tijdens een sprong blijft de gekozen pagina de huidige, ook als hij niet helemaal bovenaan
  // kan komen (de laatste pagina's); de sprong is klaar als hij er is, of als je zelf scrolt
  let ticking = false;
  el.pages.addEventListener('scroll', () => {
    if (jump) {
      if (Math.abs(el.pages.scrollTop - jump.top) < 2 || Date.now() > jump.until) jump = null;
      return;
    }
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!jump) setCurrent(pageInView(), { fromScroll: true });
    });
  }, { passive: true });
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((type) => el.pages.addEventListener(type, () => { jump = null; }, { passive: true }));

  // Naar pagina i: miniatuur, paginalijst, zoeken, sneltoetsen. Het paneel volgt, net als bij scrollen
  function goTo(i, { flash = false, smooth = true } = {}) {
    const fig = figs[Math.max(0, Math.min(figs.length - 1, i))];
    const box = el.pages;
    const top = Math.max(0, Math.min(fig.offsetTop - 16, box.scrollHeight - box.clientHeight));
    jump = Math.abs(box.scrollTop - top) < 2 ? null : { top, until: Date.now() + 2500 };
    box.scrollTo({ top, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
    setCurrent(Number(fig.dataset.index));
    follow(chapterOf(Number(fig.dataset.index)));
    if (flash) {
      fig.classList.remove('is-flash');
      void fig.offsetWidth;
      fig.classList.add('is-flash');
    }
  }

  el.strip.addEventListener('click', (e) => {
    const b = e.target.closest('.sg-thumb');
    if (b) goTo(Number(b.dataset.index));
  });
  // Pijltjes, Home en End in de strook, zoals in de Presentation Maker
  el.strip.addEventListener('keydown', (e) => {
    if (!e.target.closest('.sg-thumb') || e.altKey || e.ctrlKey || e.metaKey) return;
    const last = S.pages.length - 1;
    const to = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: last }[e.key];
    if (to == null) return;
    e.preventDefault();
    goTo(Math.max(0, Math.min(last, to)));
    thumbs[current].focus({ preventScroll: true });
  });

  // Een hoofdstuk kiezen in de rail: naar zijn eerste pagina (tenzij die al in beeld is)
  shell.onChange(({ id, open }) => {
    if (!open || !id || following) return;
    if (current >= 0 && chapterOf(current) === id) return;
    goTo(firstOf(id));
  });

  // Paginalijst onderaan elk paneel
  $$('.sg-pagelist').forEach((nav) => {
    const list = S.pages.filter((p) => p.chapter === nav.dataset.pages);
    nav.innerHTML = `<span class="sg-pagelist__label">In dit hoofdstuk</span>${list.map((p) => `<a href="#pagina-${p.id}" data-index="${p.index}"><span>${String(p.index + 1).padStart(2, '0')}</span>${esc(p.title)}</a>`).join('')}`;
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-index]');
      if (!a) return;
      e.preventDefault();
      goTo(Number(a.dataset.index), { flash: true });
      if (shell.isNarrow) shell.close({ focusRail: false });
    });
  });

  /* ---------------------------------------------------------------------------
     Kopiëren
     ------------------------------------------------------------------------- */

  async function writeText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      /* geen toegang tot het klembord: dan de oude manier */
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('Kopiëren lukte niet in deze browser. Selecteer de tekst en kopieer hem zelf.');
  }

  async function copy(text, what, btn) {
    try {
      await writeText(text);
      toast(`${what} gekopieerd: ${text.length > 60 ? `${text.slice(0, 57)}…` : text}`);
      if (btn) {
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 1400);
      }
      if (PM.tour) PM.tour.signal('kopieer');
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ---------------------------------------------------------------------------
     Merk
     ------------------------------------------------------------------------- */

  const TEXTS = [
    ['Bedrijfsnaam', C.company],
    ['Slogan', C.slogan],
    ['Missie', C.mission],
    ['Visie', C.vision],
  ];
  $('#brandTexts').innerHTML = TEXTS.map(([name, text], i) => `
    <div class="sg-text">
      <div class="sg-text__head"><span class="sg-text__name">${esc(name)}</span><button type="button" class="btn btn-quiet btn-xs" data-copy-text="${i}" aria-label="kopieer ${esc(name.toLowerCase())}">kopieer</button></div>
      <p class="sg-text__body">${esc(text)}</p>
    </div>`).join('');
  $('#brandTexts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy-text]');
    if (b) copy(TEXTS[Number(b.dataset.copyText)][1], TEXTS[Number(b.dataset.copyText)][0], b);
  });
  $('#brandValues').innerHTML = C.values.map((v, i) => `<li><span class="sg-hexno" aria-hidden="true">${i + 1}</span><b>${esc(v.name)}</b><i>${esc(v.sound)}</i></li>`).join('');

  /* ---------------------------------------------------------------------------
     Logo
     ------------------------------------------------------------------------- */

  const logoCanvas = $('#logoCanvas');
  function renderLogoPreview() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round((logoCanvas.clientWidth || 300) * dpr);
    const h = Math.round(w * 0.56);
    logoCanvas.width = w;
    logoCanvas.height = h;
    const ctx = logoCanvas.getContext('2d');
    const dark = state.variant === 'wit';
    ctx.fillStyle = dark ? T.color('inkt').hex : S.CANVAS;
    ctx.fillRect(0, 0, w, h);
    const lh = h * 0.62;
    const lw = lh * T.logo.aspect;
    SVG.draw(ctx, env.logo, { x: (w - lw) / 2, y: (h - lh) / 2, w: lw, h: lh }, { color: dark ? '#FFFFFF' : T.color('inkt').hex });
  }
  $$('input[name="logoVariant"]').forEach((r) => {
    r.checked = r.value === state.variant;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.variant = r.value;
      save();
      renderLogoPreview();
    });
  });

  $$('[data-logo-format]').forEach((b) => b.addEventListener('click', () => {
    PM.run(b, 'bezig…', async () => {
      const f = await X.logoFile(env, state.variant, b.dataset.logoFormat);
      PM.saveBlob(f.blob, f.name);
      toast(`Gedownload: ${f.name}`);
      return 'gedownload';
    });
  }));

  // Clear space om elk logo op de pagina's (alleen op het scherm, niet in de export)
  const clearToggle = $('#clearToggle');
  clearToggle.checked = state.overlay;
  clearToggle.addEventListener('change', () => {
    state.overlay = clearToggle.checked;
    save();
    redrawVisible();
    PM.announce(state.overlay ? 'Clear space aan: om elk logo staat de vrije zone.' : 'Clear space uit.');
  });

  // Rekenhulp: hoeveel ruimte bij deze breedte, en is hij groot genoeg?
  const calcW = $('#calcW');
  calcW.value = state.logoW;
  function calc() {
    const w = Math.round(Number(calcW.value));
    const out = $('#calcOut');
    if (!(w > 0)) {
      out.textContent = 'Vul de breedte van het logo in.';
      out.className = 'sg-calc__out';
      return;
    }
    state.logoW = w;
    save();
    const x = Math.round(w * T.logo.clearSpace * 10) / 10;
    const ok = w >= T.logo.minDigitalPx;
    out.innerHTML = `Clear space: <b>${String(x).replace('.', ',')} px</b> aan elke kant, ${w + 2 * Math.round(x)} &times; ${Math.round(w / T.logo.aspect + 2 * x)} px in totaal. ${ok ? 'Groot genoeg voor een scherm.' : `<span class="sg-warn">Te klein: minimaal ${T.logo.minDigitalPx} px.</span>`}`;
    out.className = `sg-calc__out${ok ? '' : ' is-warn'}`;
  }
  calcW.addEventListener('input', calc);

  /* ---------------------------------------------------------------------------
     Kleur
     ------------------------------------------------------------------------- */

  const groups = [['Primair', T.colors.primary], ['Secundair', T.colors.secondary], ['Neutraal', T.colors.neutral]];
  $('#swatches').innerHTML = groups.map(([name, list]) => `
    <div class="sg-swatchgroup">
      <span class="sg-swatchgroup__name">${name}</span>
      ${list.map((c) => `
        <div class="sg-swatch">
          <span class="sg-swatch__chip${c.id === 'wit' ? ' is-white' : ''}" style="background:${c.hex}" aria-hidden="true"></span>
          <div class="sg-swatch__info">
            <b>${esc(c.name)}</b><i>${esc(c.role)}</i>
            <div class="sg-swatch__vals">
              ${['hex', 'rgb', 'cmyk'].map((k) => `<button type="button" class="sg-val" data-color="${c.id}" data-kind="${k}" aria-label="${k.toUpperCase()} ${esc(M.copyValue(c, k))} van ${esc(c.name)} kopiëren"><span>${k.toUpperCase()}</span>${esc(M.copyValue(c, k))}</button>`).join('')}
            </div>
          </div>
        </div>`).join('')}
    </div>`).join('');
  $('#swatches').addEventListener('click', (e) => {
    const b = e.target.closest('.sg-val');
    if (!b) return;
    const c = T.color(b.dataset.color);
    copy(M.copyValue(c, b.dataset.kind), `${b.dataset.kind.toUpperCase()} van ${c.name}`, b);
  });

  // Contrast tussen twee merkkleuren
  const fg = $('#contrastFg');
  const bg = $('#contrastBg');
  const options = T.allColors().map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  fg.innerHTML = options;
  bg.innerHTML = options;
  fg.value = state.fg;
  bg.value = state.bg;
  function advice(f, b, n) {
    if (f === b) return 'Kies twee verschillende kleuren.';
    if (f === 'cyaan' && (b === 'wit' || b === 'grijs')) return 'Cyaan op licht is voor vlakken, lijnen en markeringen, niet voor tekst.';
    if (f === 'wit' && b === 'cyaan') return 'Een cyaan knop krijgt tekst in Inkt. Wit op cyaan alleen in grote, korte koppen op een donkere foto.';
    if (n >= 4.5) return 'Goed leesbaar, ook voor lopende tekst.';
    if (n >= 3) return 'Alleen voor grote tekst: koppen vanaf 24 px, of 19 px vet.';
    return 'Niet voor tekst: te weinig contrast.';
  }
  function renderContrast() {
    const a = T.color(fg.value);
    const b = T.color(bg.value);
    const n = M.contrast(a.hex, b.hex);
    const v = M.verdict(n);
    const yes = (ok) => `<span class="sg-verdict ${ok ? 'is-ok' : 'is-no'}">${ok ? 'ja' : 'nee'}</span>`;
    $('#contrastOut').innerHTML = `
      <div class="sg-contrast__sample${b.id === 'wit' ? ' is-white' : ''}" style="background:${b.hex};color:${a.hex}"><b>Aa</b> Pure Minds</div>
      <div class="sg-contrast__info">
        <span class="sg-contrast__ratio">${M.ratioText(n)}</span>
        <span>tekst ${yes(v.text)} &nbsp; grote tekst ${yes(v.large)}</span>
      </div>
      <p class="sg-contrast__advice">${esc(advice(a.id, b.id, n))}</p>`;
    state.fg = a.id;
    state.bg = b.id;
    save();
  }
  fg.addEventListener('change', renderContrast);
  bg.addEventListener('change', renderContrast);

  // 60/30/10: dezelfde balk en compositie als op de pagina, op een eigen canvas. Op een licht
  // vlak, net als op de pagina: zo valt het witte deel niet weg en krijgt wit geen rand
  const ratioCanvas = $('#ratioCanvas');
  function renderRatio() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = ratioCanvas.clientWidth || 300;
    const w = 600;   // ontwerpmaat van het paneelcanvas
    const h = 420;
    const pad = 20;
    const scale = (cssW * dpr) / w;
    ratioCanvas.width = Math.round(w * scale);
    ratioCanvas.height = Math.round(h * scale);
    const ctx = ratioCanvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = S.CANVAS;
    ctx.fillRect(0, 0, w, h);
    S.ratio(ctx, pad, pad, w - 2 * pad, state.ratio, 60);
    S.composition(ctx, pad, pad + 84, w - 2 * pad, h - 3 * pad - 64, state.ratio);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    $('#ratioLegend').innerHTML = S.ratioParts(state.ratio).map((p) => `<li><span class="sg-legend__chip${p.hex.toUpperCase() === '#FFFFFF' ? ' is-white' : ''}" style="background:${p.hex}"></span><b>${p.p}%</b> ${esc(p.name)}</li>`).join('');
  }
  $$('input[name="ratioMode"]').forEach((r) => {
    r.checked = r.value === state.ratio;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      state.ratio = r.value;
      save();
      renderRatio();
    });
  });

  /* ---------------------------------------------------------------------------
     Type
     ------------------------------------------------------------------------- */

  $('#fontStack').textContent = `font-family: ${T.font.stack};`;
  const cssOf = (t) => [
    `font: ${t.weight} ${t.size}px/${t.line}px ${T.font.stack};`,
    t.track ? `letter-spacing: ${t.track}em;` : '',
    t.upper ? 'text-transform: uppercase;' : '',
    t.color ? `color: ${t.color};` : '',
  ].filter(Boolean).join(' ');
  $('#typeScale').innerHTML = T.type.map((t, i) => {
    const wName = T.font.weights.find((f) => f.weight === t.weight).name;
    return `<li class="sg-scale__row">
      <span class="sg-scale__sample" style="font-weight:${t.weight};font-size:${Math.min(t.size, 40)}px;line-height:1.15;letter-spacing:${t.track}em;${t.upper ? 'text-transform:uppercase;' : ''}${t.color ? `color:${t.color};` : ''}">${esc(t.name)}</span>
      <span class="sg-scale__spec">${wName} ${t.weight} · ${t.size}/${t.line}${t.track ? ` · ${t.track > 0 ? '+' : '−'}${Math.abs(t.track * 100)}%` : ''}</span>
      <span class="sg-scale__use">${esc(C.type.usage[t.id])}${t.size > 40 ? ' · hier verkleind' : ''}</span>
      <button type="button" class="btn btn-quiet btn-xs" data-copy-css="${i}" aria-label="kopieer css van ${esc(t.name)}">kopieer css</button>
    </li>`;
  }).join('');
  $('#typeScale').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy-css]');
    if (b) copy(cssOf(T.type[Number(b.dataset.copyCss)]), `CSS van ${T.type[Number(b.dataset.copyCss)].name}`, b);
  });
  $('[data-copy-font]').addEventListener('click', (e) => copy(`font-family: ${T.font.stack};`, 'Lettertype', e.currentTarget));

  /* ---------------------------------------------------------------------------
     Beeld: de fotocheck
     ------------------------------------------------------------------------- */

  const checks = C.imagery.checks;
  $('#photoChecks').innerHTML = checks.map((c, i) => `
    <label class="sg-check"><input type="checkbox" value="${i}"${state.checks.includes(i) ? ' checked' : ''}><span class="sg-check__box" aria-hidden="true"></span><span>${esc(c)}</span></label>`).join('');
  function renderChecks() {
    const n = state.checks.length;
    const sum = $('#photoSum');
    sum.textContent = n === checks.length ? `${n} van ${n}: deze foto past bij de beeldtaal.` : `${n} van ${checks.length} aangevinkt`;
    sum.classList.toggle('is-ok', n === checks.length);
  }
  $('#photoChecks').addEventListener('change', (e) => {
    const i = Number(e.target.value);
    state.checks = e.target.checked ? [...new Set([...state.checks, i])] : state.checks.filter((k) => k !== i);
    save();
    renderChecks();
  });
  $('#photoReset').addEventListener('click', () => {
    state.checks = [];
    $$('#photoChecks input').forEach((c) => { c.checked = false; });
    save();
    renderChecks();
  });

  /* ---------------------------------------------------------------------------
     Iconen: de vier zeshoeken met een voorbeeld, zoals in de Icon Finder
     ------------------------------------------------------------------------- */

  const sample = C.iconPaths.lightbulb.d;
  $('#iconVariants').innerHTML = C.icons.variants.map((v) => `
    <li class="sg-variant${v.preset === 'wit' ? ' is-dark' : ''}">
      <span class="sg-variant__art" aria-hidden="true">${window.PMHex.svg(sample, { shape: 'hex', ...window.PMHex.presets[v.preset], height: 40 })}</span>
      <span class="sg-variant__txt"><b>${esc(v.name)}</b><i>${esc(v.sub)}</i></span>
    </li>`).join('');

  /* ---------------------------------------------------------------------------
     Gebruik: de badge downloaden
     ------------------------------------------------------------------------- */

  $$('[data-badge]').forEach((b) => b.addEventListener('click', () => {
    const f = X.badge(b.dataset.badge);
    PM.saveBlob(f.blob, f.name);
    toast(`Gedownload: ${f.name}`);
  }));

  /* ---------------------------------------------------------------------------
     Exporteren: de knop maakt de hele PDF; het menu de rest
     ------------------------------------------------------------------------- */

  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const EXPORTS = {
    pdf: {
      busy: 'pdf maken…',
      async task(progress) {
        const r = await X.pdf(null, env, progress);
        toast(r.parts > 1
          ? `Gedownload: ${r.name}, ${r.parts} PDF's (samen ${fmt(r.elements)} elementen, te veel voor één import in Canva)`
          : `Gedownload: ${r.name} (${S.pages.length} pagina's, ${fmt(r.elements)} elementen)`);
        return 'pdf gedownload';
      },
    },
    'pdf-hoofdstuk': {
      busy: 'pdf maken…',
      async task(progress) {
        const ch = chapterOf(Math.max(0, current));
        const r = await X.pdf(ch, env, progress);
        toast(`Gedownload: ${r.name} (${chapterName(ch)})`);
        return 'pdf gedownload';
      },
    },
    'logo-pakket': {
      busy: 'logo-pakket…',
      async task(progress) {
        const name = await X.logoPackage(env, progress);
        toast(`Gedownload: ${name} (SVG en PNG, wit en Inkt)`);
        return 'gedownload';
      },
    },
    ase: {
      busy: 'bezig…',
      async task() {
        const f = X.colors('ase');
        PM.saveBlob(f.blob, f.name);
        toast(`Gedownload: ${f.name}. Open hem via het stalenpaneel in Illustrator of InDesign.`);
        return 'gedownload';
      },
    },
    json: {
      busy: 'bezig…',
      async task() {
        const f = X.colors('json');
        PM.saveBlob(f.blob, f.name);
        toast(`Gedownload: ${f.name}`);
        return 'gedownload';
      },
    },
  };

  function runExport(kind, button) {
    const btn = button && button.getClientRects().length && !button.closest('.menu__list') ? button : el.exportBtn;
    const { busy, task } = EXPORTS[kind];
    return PM.run(btn, busy, async (progress) => {
      await PM.fontsReady;
      const done = await task(progress);
      if (PM.tour) PM.tour.signal('export');
      return done;
    });
  }

  el.exportBtn.addEventListener('click', () => runExport('pdf', el.exportBtn));
  Object.keys(EXPORTS).forEach((kind) => shell.onAction(kind, () => runExport(kind)));
  $$('[data-local-action]').forEach((b) => b.addEventListener('click', () => runExport(b.dataset.localAction, b)));
  $$('[data-colors]').forEach((b) => b.addEventListener('click', () => runExport(b.dataset.colors, b)));
  $('#pdfAllSum').textContent = `alle ${S.pages.length} pagina's, bewerkbaar`;
  $('#docSub').textContent = `${S.pages.length} pagina's · A4 liggend`;

  /* ---------------------------------------------------------------------------
     Zoeken
     ------------------------------------------------------------------------- */

  const index = M.searchIndex(C, T);
  let hits = [];
  let active = -1;

  function showResults(open) {
    el.results.hidden = !open;
    el.query.setAttribute('aria-expanded', String(open));
    if (!open) el.query.removeAttribute('aria-activedescendant');
  }

  function renderResults() {
    const q = el.query.value.trim();
    hits = M.search(index, q).slice(0, 8);
    active = hits.length ? 0 : -1;
    if (q.length < 2) {
      showResults(false);
      return;
    }
    el.results.innerHTML = hits.length
      ? hits.map((h, i) => `
        <button type="button" class="sg-result" role="option" id="sg-hit-${i}" data-index="${h.index}" aria-selected="${i === active}">
          <span class="sg-result__head"><b>${esc(h.title)}</b><span>${esc(chapterName(h.chapter))} · pagina ${h.index + 1}</span></span>
          ${h.snippet ? `<span class="sg-result__snip">${esc(h.snippet)}</span>` : ''}
        </button>`).join('')
      : `<p class="sg-results__none">Niets gevonden voor “${esc(q)}”. Probeer bijvoorbeeld logo, cyaan of foto.</p>`;
    activeDescendant();
    showResults(true);
  }

  // Het gekozen resultaat voor schermlezers; zonder resultaat geen verwijzing
  function activeDescendant() {
    if (active >= 0) el.query.setAttribute('aria-activedescendant', `sg-hit-${active}`);
    else el.query.removeAttribute('aria-activedescendant');
  }

  function markActive() {
    $$('.sg-result', el.results).forEach((b, i) => b.setAttribute('aria-selected', String(i === active)));
    activeDescendant();
    const b = $(`#sg-hit-${active}`);
    if (b) b.scrollIntoView({ block: 'nearest' });
  }

  function choose(i) {
    const h = hits[i];
    if (!h) return;
    showResults(false);
    closeSearch();
    goTo(h.index, { flash: true });
    follow(h.chapter, { force: true });
    PM.announce(`Pagina ${h.index + 1}: ${h.title}`);
  }

  el.query.addEventListener('input', renderResults);
  el.query.addEventListener('focus', () => { if (el.query.value.trim().length >= 2) renderResults(); });
  el.query.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!hits.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      markActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(Math.max(0, active));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (el.query.value) {
        el.query.value = '';
        showResults(false);
      } else closeSearch();
    } else if (e.key === 'Tab') {
      showResults(false);   // met Tab verder: de lijst gaat dicht, zoals bij een keuzelijst
    }
  });
  el.results.addEventListener('mousedown', (e) => e.preventDefault());   // de focus blijft in het zoekveld
  el.results.addEventListener('click', (e) => {
    const b = e.target.closest('.sg-result');
    if (b) choose($$('.sg-result', el.results).indexOf(b));
  });
  document.addEventListener('pointerdown', (e) => {
    if (!el.search.contains(e.target)) showResults(false);
  });

  // Telefoon: zoeken staat achter een knop en legt zich open over de hele appbalk
  const fieldHidden = () => !el.query.offsetParent;
  function openSearch() {
    el.find.classList.add('is-open');
    el.searchOpen.setAttribute('aria-expanded', 'true');
    el.query.focus();
  }
  function closeSearch() {
    if (!el.find.classList.contains('is-open')) return;
    el.find.classList.remove('is-open');
    el.searchOpen.setAttribute('aria-expanded', 'false');
    showResults(false);
  }
  el.searchOpen.addEventListener('click', openSearch);
  $('#searchClose').addEventListener('click', () => {
    el.query.value = '';
    closeSearch();
    el.searchOpen.focus();
  });
  // De rondleiding gaat verder: de zoeklijst (en op een telefoon het open zoekveld) dicht,
  // anders ligt hij over de knop die de volgende stap aanwijst
  document.addEventListener('pm:tour', (e) => {
    if (e.detail && e.detail.tool === 'styleguide' && e.detail.step === 'zoeken') return;
    showResults(false);
    closeSearch();
  });

  /* ---------------------------------------------------------------------------
     Sneltoetsen
     ------------------------------------------------------------------------- */

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      runExport('pdf', el.exportBtn);
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (e.key === '/') {
      e.preventDefault();
      if (fieldHidden()) openSearch();
      else el.query.focus();
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      goTo(current + (e.key === 'PageDown' ? 1 : -1));
    } else if ((e.key === 'Home' || e.key === 'End') && (t === el.pages || t === document.body)) {
      e.preventDefault();
      goTo(e.key === 'Home' ? 0 : S.pages.length - 1);
    }
  });

  /* ---------------------------------------------------------------------------
     Start: eerst de fonts (canvas kent alleen fonts die al geladen zijn)
     ------------------------------------------------------------------------- */

  calc();
  renderContrast();
  renderChecks();

  const resize = PM.debounce(() => {
    redrawVisible();
    renderLogoPreview();
    renderRatio();
  }, 150);

  PM.fontsReady.then(() => {
    figs.forEach((f) => io.observe(f));
    renderThumbs();
    renderLogoPreview();
    renderRatio();
    goTo(state.page, { smooth: false });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(el.pages);
    else window.addEventListener('resize', resize);
    // Een panel dat net zichtbaar werd (op een telefoon pas bij openen): de canvassen daarin opnieuw
    shell.onChange(() => requestAnimationFrame(() => {
      renderLogoPreview();
      renderRatio();
    }));
    // Vanaf het dashboard: ?q=magenta zoekt meteen
    if (params.q) {
      if (fieldHidden()) openSearch();
      el.query.value = params.q;
      renderResults();
      el.query.focus();
    }
  });

  // Voor de controle in de browser: een pagina op schaal als PNG
  window.PMStyleguideApp = {
    pagePng(i, scale = 1, overlay = false) {
      const c = document.createElement('canvas');
      S.render(c, i, { ...env, overlay }, scale);
      return c.toDataURL('image/png');
    },
    goTo,
    get current() { return current; },
  };
})();
