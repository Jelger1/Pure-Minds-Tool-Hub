/* =============================================================================
   tour.js — de rondleiding: leren door te doen, in de huisstijl
   -----------------------------------------------------------------------------
   Bij het eerste bezoek start een korte rondleiding. Elke stap licht één
   onderdeel uit (de rest van de pagina wordt gedimd) met een kaartje ernaast.
   Een doe-stap wacht tot je het echt doet (typen, kiezen, klikken) en gaat
   dan vanzelf verder; "volgende" mag altijd.

   Stappen staan in window.PM_HELP.<tool>.tour:
     { id: 'welkom', title, text }                          geen target: kaart in het midden
     { id: 'kop', section: 'tekst', target: 'kop', title, text,
       doe: { event: 'input', min: 3, hint: 'Typ je kop' } }
   target = [data-tour="<target>"]; section = eerst dat paneel openen (PM.shell).
   doe: event 'input' | 'change' | 'click', min (tekens), match (regex) of
   signal (de tool roept PM.tour.signal('<naam>') aan). Optioneel per stap:
   placement ('right', 'bottom', …), pad (ruimte om het uitgelichte deel),
   button (tekst van de hoofdknop).

     PM.tour.start(tool)        starten (of verder waar je was)
     PM.tour.stop()             stoppen; de stand blijft bewaard
     PM.tour.signal(naam)       een doe-stap afronden vanuit de tool
     PM.tour.auto(tool, { quickStart })   eerste bezoek: vanzelf starten (de shell doet dit)
     PM.tour.isActive
   Stand per tool in PM.store 'pm-tour-<tool>-v1' = { status, step }.
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Zonder DOM (getest in tests/tour.test.js)
     ------------------------------------------------------------------------- */

  const STATUSES = ['nieuw', 'bezig', 'done', 'skipped'];
  const storeKey = (tool) => `pm-tour-${tool}-v1`;

  // Alleen stappen met een titel of tekst; elke stap krijgt een id
  function normalizeSteps(steps) {
    if (!Array.isArray(steps)) return [];
    // Het id volgt de plek in de data, ook als een stap ervoor ongeldig is
    return steps
      .map((s, i) => (s && typeof s === 'object' && (s.title || s.text) ? { ...s, id: s.id || `stap-${i + 1}`, target: s.target ? String(s.target) : null } : null))
      .filter(Boolean);
  }

  // Opgeslagen stand, altijd geldig: { status, step }
  function readStatus(raw, count) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const status = STATUSES.includes(s.status) ? s.status : 'nieuw';
    const max = Math.max(0, (count | 0) - 1);
    const step = Math.min(max, Math.max(0, Number.isFinite(Number(s.step)) ? Math.floor(Number(s.step)) : 0));
    return { status, step };
  }

  /**
   * Vanzelf starten? 'start' (eerste keer), 'resume' (vorige keer niet
   * afgemaakt en niet gestopt), 'hint' (eerste keer, maar via een snelle start
   * van het dashboard: dan alleen een melding met een knop) of null.
   */
  function autoStart(saved, { quickStart = false } = {}) {
    if (!saved || saved.status === 'nieuw') return quickStart ? 'hint' : 'start';
    if (saved.status === 'bezig') return 'resume';
    return null;
  }

  // Eerste beschikbare stap vanaf `from` in richting dir (1 of -1); -1 als er geen is
  function findIndex(steps, from, dir, available = () => true) {
    const d = dir < 0 ? -1 : 1;
    for (let i = from; i >= 0 && i < steps.length; i += d) {
      if (available(steps[i], i)) return i;
    }
    return -1;
  }

  // "2 van 6", alleen beschikbare stappen geteld
  function progress(steps, index, available = () => true) {
    let pos = 0;
    let total = 0;
    steps.forEach((s, i) => {
      if (!available(s, i)) return;
      total++;
      if (i <= index) pos++;
    });
    return { pos: Math.max(1, pos), total: Math.max(1, total), label: `${Math.max(1, pos)} van ${Math.max(1, total)}` };
  }

  /**
   * Is de doe-stap gedaan? ev = { type: 'input' | 'change' | 'click' | 'signal',
   * value, name }. Bij typen telt alleen een echte wijziging: de voorbeeldtekst
   * die er al stond is niet genoeg.
   */
  function doeDone(doe, ev, { initial = null } = {}) {
    if (!doe || !ev) return false;
    if (doe.signal) return ev.type === 'signal' && ev.name === doe.signal;
    if (ev.type !== (doe.event || 'input')) return false;
    if (ev.type === 'click') return true;
    const value = String(ev.value == null ? '' : ev.value);
    if (ev.type === 'input' && initial != null && value === String(initial)) return false;
    const clean = value.replace(/\*\*/g, '').trim();
    if (doe.min && clean.length < Number(doe.min)) return false;
    if (doe.match) {
      try {
        if (!new RegExp(doe.match, 'i').test(value)) return false;
      } catch (err) {
        return true;   // ongeldige regex in de data: de stap niet blokkeren
      }
    }
    return true;
  }

  // Tekst voor het hulpmenu
  function describe(saved, count) {
    const s = readStatus(saved, count);
    if (s.status === 'done') return 'rondleiding opnieuw';
    if ((s.status === 'skipped' || s.status === 'bezig') && s.step > 0 && s.step < count - 1) return `rondleiding verder (stap ${s.step + 1} van ${count})`;
    return 'rondleiding starten';
  }

  // Waar begint een handmatige start: verder waar je was, anders vooraan
  function startIndex(saved, count) {
    const s = readStatus(saved, count);
    return (s.status === 'skipped' || s.status === 'bezig') && s.step > 0 && s.step < count - 1 ? s.step : 0;
  }

  /* ---------------------------------------------------------------------------
     Browser
     ------------------------------------------------------------------------- */

  let active = null;   // { tool, steps, index, target, from, raf, lastKey, off: [] }
  let ui = null;       // { panes, ring, pop }

  const doc = () => global.document;
  const PMx = () => global.PM || {};
  const reduced = () => global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepsOf = (tool) => normalizeSteps(global.PM_HELP && global.PM_HELP[tool] && global.PM_HELP[tool].tour);
  const load = (tool, count) => readStatus(PMx().store ? PMx().store.get(storeKey(tool), null) : null, count);
  const save = (tool, value) => PMx().store && PMx().store.set(storeKey(tool), value);
  const shellApi = () => PMx().shell && PMx().shell.instance;
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const render = (t) => (PMx().help && PMx().help.render ? PMx().help.render(t) : `<p>${esc(t)}</p>`);
  const say = (t) => PMx().announce && PMx().announce(t);
  const emit = (tool, status) => doc().dispatchEvent(new CustomEvent('pm:tour', { detail: { tool, status, step: active ? active.steps[active.index].id : null } }));

  function findTarget(step) {
    return step.target ? doc().querySelector(`[data-tour="${step.target}"]`) : null;
  }

  // Bestaat het doel? Verborgen panelen tellen mee (die opent de rondleiding), een verborgen veld niet
  function exists(step) {
    // Een onderdeel dat nu niet bestaat (verborgen rail-knop, zoals prijzen buiten een offerte)
    if (step.section && shellApi() && shellApi().has && !shellApi().has(step.section)) return false;
    if (!step.target) return true;
    let el = findTarget(step);
    if (!el) return false;
    for (let n = el; n && n !== doc().body; n = n.parentElement) {
      if (n.hidden && !n.classList.contains('panel') && !n.classList.contains('panels')) return false;
    }
    return true;
  }

  const visible = (el) => !!el && el.getClientRects().length > 0;

  // Ouders die hun inhoud afsnijden (scrollend paneel, blad, podium)
  function scrollParents(el) {
    const list = [];
    for (let n = el.parentElement; n && n !== doc().body; n = n.parentElement) {
      const cs = global.getComputedStyle(n);
      if (/(auto|scroll|hidden|clip)/.test(`${cs.overflowX} ${cs.overflowY}`)) list.push(n);
    }
    return list;
  }

  function build() {
    if (ui) return;
    const d = doc();
    const panes = [0, 1, 2, 3].map(() => {
      const p = d.createElement('div');
      p.className = 'tour-pane';
      p.setAttribute('aria-hidden', 'true');
      p.addEventListener('click', nudge);
      d.body.appendChild(p);
      return p;
    });
    const ring = d.createElement('div');
    ring.className = 'tour-ring';
    ring.setAttribute('aria-hidden', 'true');
    d.body.appendChild(ring);
    const pop = d.createElement('div');
    pop.className = 'tour';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-labelledby', 'pm-tour-title');
    pop.setAttribute('aria-describedby', 'pm-tour-text');
    pop.tabIndex = -1;
    d.body.appendChild(pop);
    pop.addEventListener('click', onPopClick);
    pop.addEventListener('keydown', onPopKey);
    ui = { panes, ring, pop };
  }

  function teardown() {
    if (!ui) return;
    ui.panes.forEach((p) => p.remove());
    ui.ring.remove();
    ui.pop.remove();
    ui = null;
  }

  // Klik op de gedimde pagina: het kaartje even laten opvallen
  function nudge() {
    if (!ui) return;
    ui.pop.classList.remove('is-nudge');
    void ui.pop.offsetWidth;
    ui.pop.classList.add('is-nudge');
  }

  /* --- Een stap tonen --- */

  function go(from, dir) {
    if (!active) return;
    const { steps } = active;
    for (let i = from; i >= 0 && i < steps.length; i += dir < 0 ? -1 : 1) {
      const step = steps[i];
      if (!exists(step)) continue;
      if (step.section && shellApi()) shellApi().open(step.section);
      const target = findTarget(step);
      if (step.target && !visible(target)) continue;
      show(i, target);
      return;
    }
    if (dir > 0) finish('done');
  }

  function cleanupStep() {
    if (!active) return;
    active.off.forEach((fn) => fn());
    active.off = [];
    clearTimeout(active.doneTimer);
  }

  function show(index, target) {
    cleanupStep();
    const { steps, tool } = active;
    const step = steps[index];
    active.index = index;
    active.target = target;
    active.lastKey = '';
    save(tool, { status: 'bezig', step: index });

    const prev = findIndex(steps, index - 1, -1, exists);
    const next = findIndex(steps, index + 1, 1, exists);
    const first = prev < 0;
    const last = next < 0;
    // Stappen die al getoond zijn blijven meetellen, ook als hun doel nu weg is
    // (een foto kiezen verbergt de uploadplek): "5 van 8" wordt geen "5 van 7"
    active.seen.add(index);
    const prog = progress(steps, index, (s, i) => active.seen.has(i) || (i > index && exists(s)));
    const title = String(step.title || '');
    const dot = /[.!?]$/.test(title) ? '' : '<span class="dot">.</span>';
    const hexes = prog.total <= 10
      ? `<span class="tour__hexes" aria-hidden="true">${Array.from({ length: prog.total }, (_, i) => `<span class="tour__hex${i + 1 < prog.pos ? ' is-done' : i + 1 === prog.pos ? ' is-now' : ''}"></span>`).join('')}</span>`
      : '';
    const primary = step.button || (first && !target ? 'start de rondleiding' : last ? 'aan de slag' : 'volgende');
    const doe = step.doe && target ? step.doe : null;

    const pop = ui.pop;
    pop.className = `tour${target ? '' : ' is-center'}${first && !target ? ' is-welcome' : ''}${last && !target ? ' is-finish' : ''}`;
    pop.innerHTML = `
      <button type="button" class="tour__close" data-tour-act="later" aria-label="Rondleiding sluiten, later verder">${'<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 10.59 16.95 5.64l1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41z"/></svg>'}</button>
      ${target ? '' : '<span class="tour__art" aria-hidden="true"><span></span><span></span></span>'}
      <p class="tour__progress">${hexes}<span>stap ${prog.label}</span></p>
      <h2 class="tour__title" id="pm-tour-title">${esc(title)}${dot}</h2>
      <div class="tour__text" id="pm-tour-text">${render(step.text)}</div>
      ${doe && doe.hint ? `<p class="tour__doe"><span class="tour__pulse" aria-hidden="true"></span><span class="tour__doe-txt">${esc(doe.hint)}</span></p>` : ''}
      <div class="tour__foot">
        ${last ? '<span></span>' : `<button type="button" class="linkbtn tour__skip" data-tour-act="skip">${first ? 'later' : 'overslaan'}</button>`}
        <span class="tour__nav">
          ${first ? '' : '<button type="button" class="btn btn-quiet btn-sm" data-tour-act="prev">vorige</button>'}
          <button type="button" class="btn btn-outline btn-sm" data-tour-act="${last ? 'done' : 'next'}">${esc(primary)}</button>
        </span>
      </div>`;

    active.clippers = target ? scrollParents(target) : [];
    if (target) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      // Schermlezers: bij focus in het uitgelichte deel ook de uitleg van de stap
      const described = target.getAttribute('aria-describedby');
      target.setAttribute('aria-describedby', `${described ? `${described} ` : ''}pm-tour-text`);
      active.off.push(() => {
        if (described) target.setAttribute('aria-describedby', described);
        else target.removeAttribute('aria-describedby');
      });
      target.classList.add('is-tour-target');
      active.off.push(() => target.classList.remove('is-tour-target'));
    }
    if (doe) bindDoe(doe, target);

    layout();
    emit(tool, 'stap');
    // Focus op de hoofdknop: Enter gaat door, Tab gaat naar het uitgelichte deel
    const main = pop.querySelector('[data-tour-act="next"], [data-tour-act="done"]');
    (main || pop).focus({ preventScroll: true });
    say(`Stap ${prog.label}: ${title}`);
  }

  function bindDoe(doe, target) {
    if (doe.signal) return;   // via PM.tour.signal()
    const type = doe.event || 'input';
    const initial = new Map();
    const fields = target.matches('input, textarea, select, [contenteditable="true"]') ? [target] : Array.from(target.querySelectorAll('input, textarea, select, [contenteditable="true"]'));
    fields.forEach((f) => initial.set(f, f.isContentEditable ? f.textContent : f.value));
    const handler = (e) => {
      const f = e.target;
      const value = f && (f.isContentEditable ? f.textContent : f.value);
      if (doeDone(doe, { type: e.type, value }, { initial: initial.has(f) ? initial.get(f) : null })) complete();
    };
    target.addEventListener(type, handler);
    active.off.push(() => target.removeEventListener(type, handler));
  }

  function complete() {
    if (!active || active.completing) return;
    active.completing = true;
    const pop = ui.pop;
    pop.classList.add('is-done');
    const txt = pop.querySelector('.tour__doe-txt');
    const step = active.steps[active.index];
    if (txt) txt.textContent = (step.doe && step.doe.done) || 'goed zo';
    say('Gelukt.');
    const index = active.index;
    active.doneTimer = setTimeout(() => {
      if (!active || active.index !== index) return;
      active.completing = false;
      go(index + 1, 1);
    }, reduced() ? 700 : 950);
  }

  /* --- Plaatsen: dimmen rond het doel, kaartje ernaast --- */

  function layout() {
    if (!active || !ui) return;
    const vw = global.innerWidth;
    const vh = global.innerHeight;
    const { pop, panes, ring } = ui;
    const t = active.target;
    const step = active.steps[active.index];
    let r = null;
    if (t) {
      const b = t.getBoundingClientRect();
      const pad = step.pad != null ? Number(step.pad) : 6;
      // Alleen het zichtbare deel: een paneel of blad dat scrolt snijdt het doel af
      const clip = { top: 0, left: 0, right: vw, bottom: vh };
      active.clippers.forEach((c) => {
        const cb = c.getBoundingClientRect();
        clip.top = Math.max(clip.top, cb.top);
        clip.left = Math.max(clip.left, cb.left);
        clip.right = Math.min(clip.right, cb.right);
        clip.bottom = Math.min(clip.bottom, cb.bottom);
      });
      const top = Math.round(Math.max(clip.top, b.top - pad));
      const left = Math.round(Math.max(clip.left, b.left - pad));
      const right = Math.round(Math.min(clip.right, b.right + pad));
      const bottom = Math.round(Math.max(top, Math.min(clip.bottom, b.bottom + pad)));
      r = { top, left, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    }
    const box = (el, x, y, w, h) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${Math.max(0, w)}px`;
      el.style.height = `${Math.max(0, h)}px`;
    };
    if (!r) {
      box(panes[0], 0, 0, vw, vh);
      panes.slice(1).forEach((p) => box(p, 0, 0, 0, 0));
      ring.hidden = true;
    } else {
      box(panes[0], 0, 0, vw, r.top);
      box(panes[1], 0, r.bottom, vw, vh - r.bottom);
      box(panes[2], 0, r.top, r.left, r.height);
      box(panes[3], r.right, r.top, vw - r.right, r.height);
      ring.hidden = false;
      box(ring, r.left, r.top, r.width, r.height);
    }

    pop.style.top = '';
    pop.style.left = '';
    pop.style.bottom = '';
    pop.classList.remove('is-docked');
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    if (!r) {
      pop.style.left = `${Math.round((vw - pw) / 2)}px`;
      pop.style.top = `${Math.round(Math.max(12, (vh - ph) / 2))}px`;
    } else if (vw < 640) {
      // Telefoon: het kaartje over de volle breedte, aan de kant waar het doel niet is
      pop.classList.add('is-docked');
      if ((r.top + r.bottom) / 2 > vh / 2) pop.style.top = '12px';
      else pop.style.bottom = '12px';
    } else {
      // In een paneel: het kaartje onder het veld, zodat je het ontwerp ziet veranderen
      const inPanel = t.closest && t.closest('.panels');
      const side = step.placement || (inPanel ? 'bottom' : r.left < vw * 0.45 && r.right < vw * 0.7 ? 'right' : r.top < 140 ? 'bottom' : 'left');
      const place = PMx().place || ((a) => ({ top: a.bottom + 14, left: a.left }));
      const spot = place(r, { width: pw, height: ph }, { width: vw, height: vh }, { side, align: side === 'left' || side === 'right' ? 'start' : 'end', gap: 16, margin: 16 });
      pop.style.left = `${spot.left}px`;
      pop.style.top = `${spot.top}px`;
      pop.dataset.side = spot.side;
    }
  }

  // Volgt het doel als er iets verschuift (scrollen, paneel, lettertype, venster)
  function loop() {
    if (!active || !ui) return;
    const t = active.target;
    const b = t ? t.getBoundingClientRect() : null;
    const key = `${b ? `${b.top}|${b.left}|${b.width}|${b.height}` : '-'}|${global.innerWidth}x${global.innerHeight}|${ui.pop.offsetHeight}`;
    if (key !== active.lastKey) {
      active.lastKey = key;
      layout();
    }
    active.raf = global.requestAnimationFrame(loop);
  }

  /* --- Knoppen en toetsen --- */

  function onPopClick(e) {
    const btn = e.target.closest('[data-tour-act]');
    if (!btn || !active) return;
    const act = btn.dataset.tourAct;
    if (act === 'next') go(active.index + 1, 1);
    else if (act === 'prev') go(active.index - 1, -1);
    else if (act === 'done') finish('done');
    else if (act === 'skip') finish('skipped', { hint: true });
    else if (act === 'later') finish('skipped', { hint: true });
  }

  // Tab vanaf de hoofdknop gaat naar het uitgelichte deel: zo doe je de stap met het toetsenbord
  function onPopKey(e) {
    if (e.key !== 'Tab' || e.shiftKey || !active || !active.target) return;
    if (!doc().activeElement.matches('[data-tour-act="next"], [data-tour-act="done"]')) return;
    const t = active.target;
    // Eerst een invoerveld (niet de [?] in het label), dan iets anders dat focus kan krijgen
    const focusable = t.matches('input, textarea, select, button, [tabindex], [contenteditable="true"], a[href]')
      ? t : t.querySelector('input:not([type="hidden"]), textarea, select, [contenteditable="true"]')
        || t.querySelector('button:not(.help), [tabindex]:not([tabindex="-1"]), a[href]');
    if (!focusable) return;
    e.preventDefault();
    focusable.focus();
  }

  function onKey(e) {
    if (!active || e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    finish('skipped', { hint: true });
  }

  /* --- Starten en stoppen --- */

  function start(tool, { at = null, from = null } = {}) {
    const steps = stepsOf(tool);
    if (!steps.length) return false;
    if (active) finish(null);
    const saved = load(tool, steps.length);
    const index = at != null ? Math.min(Math.max(0, at | 0), steps.length - 1) : startIndex(saved, steps.length);
    const d = doc();
    active = { tool, steps, index, target: null, clippers: [], seen: new Set(), from: from || d.activeElement, raf: 0, lastKey: '', off: [], completing: false };
    build();
    d.addEventListener('keydown', onKey);
    d.documentElement.classList.add('is-touring');
    go(index, 1);
    if (!active) return false;
    active.raf = global.requestAnimationFrame(loop);
    emit(tool, 'bezig');
    return true;
  }

  function finish(status, { hint = false } = {}) {
    if (!active) return;
    const { tool, index, from, steps } = active;
    cleanupStep();
    global.cancelAnimationFrame(active.raf);
    doc().removeEventListener('keydown', onKey);
    doc().documentElement.classList.remove('is-touring');
    active = null;
    teardown();
    if (status) save(tool, { status, step: status === 'done' ? 0 : index });
    if (from && from.isConnected && typeof from.focus === 'function') from.focus({ preventScroll: true });
    if (status === 'done') say('Rondleiding klaar.');
    if (hint && PMx().toast) {
      const where = doc().querySelector('[data-help-menu]') ? ' Je vindt hem terug onder hulp (?) rechtsboven.' : '';
      PMx().toast(`Rondleiding gestopt bij stap ${index + 1} van ${steps.length}.${where}`);
    }
    emit(tool, status || 'gestopt');
  }

  function signal(name) {
    if (!active) return false;
    const step = active.steps[active.index];
    if (step.doe && doeDone(step.doe, { type: 'signal', name })) {
      complete();
      return true;
    }
    return false;
  }

  // Eerste bezoek: na een korte pauze vanzelf; via een snelle start alleen een melding
  function auto(tool, { quickStart = false, delay = 900 } = {}) {
    const steps = stepsOf(tool);
    if (!steps.length) return null;
    const saved = load(tool, steps.length);
    const what = autoStart(saved, { quickStart });
    if (!what) return null;
    setTimeout(() => {
      if (active || doc().querySelector('dialog[open]')) return;
      if (what === 'hint') {
        if (PMx().toast) PMx().toast('Nieuw hier? Een korte rondleiding laat zien hoe het werkt.', false, { label: 'rondleiding', run: () => start(tool, { at: 0 }) });
      } else start(tool, { at: what === 'resume' ? saved.step : 0 });
    }, delay);
    return what;
  }

  const pure = { normalizeSteps, readStatus, autoStart, findIndex, progress, doeDone, describe, startIndex, storeKey };

  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (global && global.document) {
    const PM = global.PM = global.PM || {};
    PM.tour = {
      ...pure,
      start,
      stop: () => finish(null),
      next: () => active && go(active.index + 1, 1),
      prev: () => active && go(active.index - 1, -1),
      signal,
      auto,
      describe: (tool) => describe(load(tool, stepsOf(tool).length), stepsOf(tool).length),
      pending: (tool) => stepsOf(tool).length > 0 && load(tool, stepsOf(tool).length).status === 'nieuw',
      reset: (tool) => PMx().store && PMx().store.remove(storeKey(tool)),
      get isActive() { return !!active; },
      get step() { return active ? active.steps[active.index] : null; },
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
