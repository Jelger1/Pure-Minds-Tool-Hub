/* =============================================================================
   hub.js — bouwt de hub op index.html vanuit js/shared/tools.js: de snelle
   starts ("Begin direct"), de concepten ("Verder werken") en de toolkaarten
   ============================================================================= */
(function () {
  'use strict';

  const { esc, url, store, recentTools } = window.PM;
  const tools = (Array.isArray(window.PM_TOOLS) ? window.PM_TOOLS : []).filter((t) => t && t.id);
  const categories = window.PM_CATEGORIES || {};
  const live = (t) => t.status !== 'binnenkort';

  const $ = (id) => document.getElementById(id);
  const DAY = 864e5;

  // Kleine illustraties in de huisstijl, puur met HTML/CSS (zie css/hub.css)
  const ART = {
    post: `<span class="art art--post"><span class="art__post"><i class="art__bar"></i><i class="art__label"></i><i class="art__line art__line--w80"></i><i class="art__line art__line--w55"></i><i class="art__logo"></i></span></span>`,
    doc: `<span class="art art--doc"><span class="art__sheet"><i class="art__bar"></i><i class="art__brand"></i><i class="art__title"></i><i class="art__line"></i><i class="art__line"></i><i class="art__line art__line--w70"></i><i class="art__line"></i><i class="art__line art__line--w55"></i></span></span>`,
    slides: `<span class="art art--slides"><span class="art__slide art__slide--back"></span><span class="art__slide"><i class="art__bar"></i><i class="art__hex"></i><i class="art__title"></i><i class="art__line art__line--w55"></i></span></span>`,
    hex: `<span class="art art--hex"><i class="art__big-hex"></i></span>`,
  };

  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';

  // Formaat-icoon: een vlakje in de echte verhouding, passend in een vak van w × h rem
  function shape(ratio, w, h, cls = '') {
    const [a, b] = String(ratio || '1 / 1').split('/').map(Number);
    const ar = a > 0 && b > 0 ? a / b : 1;
    const width = Math.min(w, h * ar);
    return `<span class="shape ${cls}" style="width:${width.toFixed(2)}rem;height:${(width / ar).toFixed(2)}rem" aria-hidden="true"></span>`;
  }

  /* ---------------------------------------------------------------------------
     Begin direct: per soort de formaten. Eén klik en je zit in de tool met het
     goede template of soort document; de tool leest dat met PM.startParams().
     ------------------------------------------------------------------------- */

  function renderStarts() {
    const groups = tools.filter((t) => live(t) && Array.isArray(t.starts) && t.starts.length);
    if (!groups.length) return;
    $('startList').innerHTML = groups.map((tool) => `
      <div class="starts__group">
        <h3 class="starts__caption">${esc(categories[tool.category] || tool.short || tool.name)}</h3>
        <ul class="starts__list">${tool.starts.map((s) => {
          const query = new URLSearchParams(s.params || {}).toString();
          return `
          <li><a class="start" href="${esc(url(tool.href) + (query ? `?${query}` : ''))}">
            <span class="start__art">${shape(s.ratio, 4.5, 3, [s.stack && 'shape--stack', tool.tone === 'light' && 'shape--light'].filter(Boolean).join(' '))}</span>
            <span class="start__label">${esc(s.label)}</span>
            <span class="start__sub">${esc(s.sub || '')}</span>
          </a></li>`;
        }).join('')}</ul>
      </div>`).join('');
    $('starts').hidden = false;
  }

  /* ---------------------------------------------------------------------------
     Verder werken: het concept van elke tool die je hier gebruikt hebt, met
     titel, soort en tijd. Alleen tools waarvan echt iets bewaard is.
     ------------------------------------------------------------------------- */

  const relative = new Intl.RelativeTimeFormat('nl', { numeric: 'auto' });

  function when(time) {
    const midnight = (t) => new Date(t).setHours(0, 0, 0, 0);
    const days = Math.round((midnight(time) - midnight(Date.now())) / DAY);
    const clock = new Date(time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return days >= -1 ? `${relative.format(days, 'day')} om ${clock}` : relative.format(days, 'day');
  }

  function drafts() {
    const seen = recentTools();
    return tools
      .filter((t) => live(t) && t.draft && seen[t.id] && Date.now() - seen[t.id] < 30 * DAY)
      .map((tool) => {
        const saved = store.get(tool.draft.key);
        if (!saved || typeof saved !== 'object') return null;  // alleen geopend, niets gemaakt
        let info = {};
        try {
          info = tool.draft.summary(saved) || {};
        } catch (err) {
          info = {};
        }
        const title = String(info.title || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
        return { tool, at: seen[tool.id], title: title || 'Zonder titel', sub: info.sub || '', ratio: info.ratio };
      })
      .filter(Boolean)
      .sort((a, b) => b.at - a.at);
  }

  function renderRecent() {
    const list = drafts();
    if (!list.length) return;
    $('recentList').innerHTML = list.map((d) => `
      <li><a class="draft" href="${esc(url(d.tool.href))}">
        <span class="draft__art">${shape(d.ratio, 3.25, 2.5, d.tool.tone === 'light' ? 'shape--light' : '')}</span>
        <span class="draft__text">
          <span class="draft__title">${esc(d.title)}</span>
          <span class="draft__meta">${esc(d.tool.name)}${d.sub ? ` · ${esc(d.sub)}` : ''} · ${esc(when(d.at))}</span>
        </span>
        <span class="draft__cta" aria-hidden="true">verder${ARROW}</span>
      </a></li>`).join('');
    $('recent').hidden = false;
  }

  /* ---------------------------------------------------------------------------
     Alle tools: één rustige rij kaarten. De link zit op de naam en rekt uit
     over de hele kaart (zie .tool-card__link::after).
     ------------------------------------------------------------------------- */

  const isNew = (t) => t.status === 'nieuw' && (!t.newUntil || Date.now() < Date.parse(t.newUntil));

  function card(tool) {
    const soon = !live(tool);
    const name = `${esc(tool.name)}<span class="dot">.</span>`;
    const status = soon
      ? '<span class="tool-card__status tool-card__status--soon">binnenkort</span>'
      : isNew(tool) ? '<span class="tool-card__status"><i class="hex" aria-hidden="true"></i>nieuw</span>' : '';
    const exports = (tool.exports || []).map((e) => `<li class="pill">${esc(e)}</li>`).join('');
    return `
      <article class="tool-card${soon ? ' is-soon' : ''}" style="view-transition-name: tool-${esc(tool.id)}">
        <div class="tool-card__cover" aria-hidden="true">${ART[tool.art] || ART.hex}</div>
        <div class="tool-card__body">
          <h3 class="tool-card__name">${soon ? name : `<a class="tool-card__link" href="${esc(url(tool.href))}">${name}</a>`}</h3>
          ${status}
          <p class="tool-card__desc">${esc(tool.description)}</p>
          ${exports ? `<ul class="tool-card__exports" aria-label="Downloaden als">${exports}</ul>` : ''}
        </div>
        <div class="tool-card__foot" aria-hidden="true">
          <span class="tool-card__cta">${soon ? 'in ontwikkeling' : esc(tool.cta || 'open tool') + ARROW}</span>
        </div>
      </article>`;
  }

  $('toolGrid').innerHTML = tools.map(card).join('');
  renderStarts();
  renderRecent();
})();
