/* =============================================================================
   help.js — kleine [?]-knoppen met uitleg naast lastige instellingen
   -----------------------------------------------------------------------------
   Markup: <button type="button" class="help" data-help="formaat"></button>
   De tekst komt uit window.PM_HELP.<tool>.help.formaat = { title, text }.

   Een "toggletip": klikken of tikken opent en sluit; met een muis opent hij
   ook na een korte pauze boven de knop of bij focus met het toetsenbord.
   Esc en klikken ernaast sluiten, er staat er altijd maar één open. Na een
   klik gaat de tekst naar een live region (PM.announce), zodat een
   schermlezer hem voorleest.
   Met data-help-mode="inline" komt de uitleg in de pagina onder het veld
   (handig op een telefoon bij een langere uitleg).

     PM.help.init(root, tool)   labels zetten ("Uitleg: Formaat"); de shell doet dit al
     PM.help.open(knop), PM.help.close()
     PM.help.text(sleutel)      { title, text } of null
     PM.help.render(tekst)      veilige HTML: **vet** en regels (ook voor de rondleiding)
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Zonder DOM (getest in tests/help.test.js)
     ------------------------------------------------------------------------- */

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Tekst uit het contract, of null als hij ontbreekt of leeg is
  function helpText(all, tool, key) {
    const entry = all && all[tool] && all[tool].help && all[tool].help[key];
    if (!entry || typeof entry !== 'object') return null;
    const title = String(entry.title || '').trim();
    const text = String(entry.text || '').trim();
    return title || text ? { title, text } : null;
  }

  const plain = (text) => String(text || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  // Alinea's (lege regel), regeleinden en **vet**; al het andere wordt ge-escaped
  function render(text) {
    return String(text || '').trim().split(/\n{2,}/).map((para) => `<p>${esc(para)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br>')}</p>`).join('');
  }

  /* ---------------------------------------------------------------------------
     Browser
     ------------------------------------------------------------------------- */

  const OPEN_DELAY = 350;
  const CLOSE_DELAY = 200;
  let tool = null;
  let tip = null;
  let tipBody = null;
  let current = null;       // de knop waarvan de uitleg open is
  let pinned = false;       // geopend met een klik: blijft staan tot Esc of ernaast klikken
  let openTimer = 0;
  let closeTimer = 0;
  let bound = false;
  let uid = 0;

  const doc = () => global.document;
  const data = () => global.PM_HELP || {};
  const finePointer = () => global.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function ensureTip() {
    if (tip) return;
    tip = doc().createElement('div');
    tip.className = 'helptip';
    tip.id = 'pm-helptip';
    tip.hidden = true;
    tip.setAttribute('data-toolbar-keep', '');
    tipBody = doc().createElement('div');
    tipBody.className = 'helptip__body';
    tip.appendChild(tipBody);
    doc().body.appendChild(tip);
    tip.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    tip.addEventListener('mouseleave', () => { if (!pinned) scheduleClose(); });
  }

  function detectTool() {
    const app = doc().querySelector('[data-app]');
    return (app && app.dataset.app) || Object.keys(data())[0] || null;
  }

  function label(btn) {
    const info = helpText(data(), tool, btn.dataset.help);
    if (!info) {
      btn.hidden = true;   // geen lege uitleg tonen
      if (global.console) console.warn(`PM.help: geen tekst voor "${btn.dataset.help}" in PM_HELP.${tool}.help`);
      return null;
    }
    btn.hidden = false;
    if (!btn.getAttribute('type')) btn.type = 'button';
    btn.setAttribute('aria-label', `Uitleg: ${info.title || btn.dataset.help}`);
    btn.setAttribute('aria-expanded', btn.classList.contains('is-open') ? 'true' : 'false');
    if (btn.dataset.helpMode !== 'inline') btn.setAttribute('aria-controls', 'pm-helptip');
    return info;
  }

  function init(root, toolId) {
    tool = toolId || tool || detectTool();
    const scope = root || doc();
    ensureTip();   // bestaat meteen, zodat aria-controls="pm-helptip" klopt
    scope.querySelectorAll('.help[data-help]').forEach(label);
    if (!bound) bind();
  }

  function position() {
    if (!current || !tip || tip.hidden) return;
    const rect = current.getBoundingClientRect();
    const view = { width: global.innerWidth, height: global.innerHeight };
    const place = (global.PM && global.PM.place) || null;
    const size = { width: tip.offsetWidth, height: tip.offsetHeight };
    const spot = place
      ? place(rect, size, view, { side: 'bottom', align: 'start', gap: 6 })
      : { top: rect.bottom + 6, left: rect.left, side: 'bottom' };
    tip.style.top = `${spot.top}px`;
    tip.style.left = `${spot.left}px`;
    tip.dataset.side = spot.side;
  }

  // Inline-variant: de uitleg als alinea onder de regel met het label
  function inlineBox(btn) {
    if (btn._helpBox) return btn._helpBox;
    const box = doc().createElement('div');
    box.className = 'help-inline';
    box.id = `pm-help-inline-${++uid}`;
    box.hidden = true;
    const row = btn.closest('.field__head, .label, .field-label, .switch, legend, summary') || btn.parentElement;
    row.insertAdjacentElement('afterend', box);
    btn.setAttribute('aria-controls', box.id);
    btn._helpBox = box;
    return box;
  }

  function open(btn, { pin = false } = {}) {
    if (!btn) return;
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    const info = label(btn);
    if (!info) return;
    if (current && current !== btn) close();
    pinned = pinned && current === btn ? true : pin;

    if (btn.dataset.helpMode === 'inline') {
      const box = inlineBox(btn);
      box.innerHTML = `${info.title ? `<b class="help-inline__title">${esc(info.title)}</b>` : ''}${render(info.text)}`;
      box.hidden = false;
      current = btn;
      pinned = true;
    } else {
      ensureTip();
      const fresh = current !== btn || tip.hidden;
      current = btn;
      tip.hidden = false;
      if (fresh) {
        tip.classList.remove('is-visible');
        tipBody.innerHTML = `${info.title ? `<b class="helptip__title">${esc(info.title)}</b>` : ''}${render(info.text)}`;
        position();
        global.requestAnimationFrame(() => tip && tip.classList.add('is-visible'));
      }
    }
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    // Geopend met klik, tik of Enter: de uitleg voorlezen (gedeelde live region, zie shell.js)
    if (pin && global.PM && global.PM.announce) global.PM.announce(`${info.title ? `${info.title}. ` : ''}${plain(info.text)}`);
  }

  function close() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    if (!current) return;
    const btn = current;
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    if (btn._helpBox) btn._helpBox.hidden = true;
    if (tip) {
      tip.hidden = true;
      tip.classList.remove('is-visible');
      tipBody.textContent = '';
    }
    current = null;
    pinned = false;
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, CLOSE_DELAY);
  }

  const helpBtn = (t) => (t && t.closest ? t.closest('.help[data-help]') : null);

  function bind() {
    bound = true;
    const d = doc();

    d.addEventListener('click', (e) => {
      const btn = helpBtn(e.target);
      if (!btn) return;
      e.preventDefault();   // een [?] in een <label> mag de schakelaar niet omzetten
      if (current === btn && pinned) close();
      else open(btn, { pin: true });
    });

    // Muis: na een korte pauze open, en weer dicht als je weggaat
    d.addEventListener('mouseover', (e) => {
      const btn = helpBtn(e.target);
      if (!btn || !finePointer() || btn.dataset.helpMode === 'inline') return;
      clearTimeout(closeTimer);
      if (current === btn) return;
      clearTimeout(openTimer);
      openTimer = setTimeout(() => { if (!pinned) open(btn); }, OPEN_DELAY);
    });
    d.addEventListener('mouseout', (e) => {
      const btn = helpBtn(e.target);
      if (!btn) return;
      clearTimeout(openTimer);
      if (current === btn && !pinned && !(tip && tip.contains(e.relatedTarget))) scheduleClose();
    });

    // Toetsenbord: bij focus (alleen als de focus zichtbaar is) na een pauze open
    d.addEventListener('focusin', (e) => {
      const btn = helpBtn(e.target);
      if (!btn || btn.dataset.helpMode === 'inline') return;
      let visible = true;
      try {
        visible = btn.matches(':focus-visible');
      } catch (err) {
        /* oudere browser: gewoon tonen */
      }
      if (!visible || !finePointer()) return;
      clearTimeout(openTimer);
      openTimer = setTimeout(() => { if (d.activeElement === btn && current !== btn) open(btn); }, OPEN_DELAY);
    });
    d.addEventListener('focusout', (e) => {
      const btn = helpBtn(e.target);
      if (!btn) return;
      clearTimeout(openTimer);
      if (current === btn && !pinned) close();
    });

    d.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !current || e.defaultPrevented) return;
      const btn = current;
      const inside = btn === d.activeElement || (tip && tip.contains(d.activeElement)) || (btn._helpBox && btn._helpBox.contains(d.activeElement));
      if (!inside && !pinned && btn.dataset.helpMode === 'inline') return;
      e.preventDefault();
      close();
      if (inside) btn.focus();
    });

    d.addEventListener('pointerdown', (e) => {
      if (!current) return;
      if (helpBtn(e.target) === current || (tip && tip.contains(e.target)) || (current._helpBox && current._helpBox.contains(e.target))) return;
      if (current.dataset.helpMode === 'inline') return;   // inline blijft staan tot je de knop weer indrukt
      close();
    });

    global.addEventListener('resize', position);
    global.addEventListener('scroll', () => {
      if (!current || !tip || tip.hidden) return;
      // Knop uit beeld gescrold (paneel): dan dicht, anders mee verplaatsen
      const r = current.getBoundingClientRect();
      if (r.bottom < 0 || r.top > global.innerHeight) close();
      else position();
    }, true);
  }

  const help = { helpText, render, plain, esc };

  if (typeof module !== 'undefined' && module.exports) module.exports = help;
  if (global && global.document) {
    const PM = global.PM = global.PM || {};
    PM.help = {
      ...help,
      init,
      open,
      close,
      text: (key) => helpText(data(), tool || detectTool(), key),
      get current() { return current; },
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
