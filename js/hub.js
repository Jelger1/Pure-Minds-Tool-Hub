/* =============================================================================
   hub.js — bouwt de hub op index.html vanuit js/shared/tools.js: de snelle
   starts ("Begin direct"), de concepten ("Verder werken"), de toolkaarten per
   blok (design, techniek) met een filter, en de uitleg bij lokale tools
   ============================================================================= */
(function () {
  'use strict';

  const { esc, url, store, recentTools, toast } = window.PM;
  const tools = (Array.isArray(window.PM_TOOLS) ? window.PM_TOOLS : []).filter((t) => t && t.id);
  const categories = window.PM_CATEGORIES || {};
  const groups = Array.isArray(window.PM_GROUPS) && window.PM_GROUPS.length ? window.PM_GROUPS : [{ id: 'design', name: 'Tools' }];
  const live = (t) => t.status !== 'binnenkort';
  const groupOf = (t) => (groups.some((g) => g.id === t.group) ? t.group : groups[0].id);

  const $ = (id) => document.getElementById(id);
  const DAY = 864e5;

  // Kleine illustraties in de huisstijl: de makers in HTML/CSS, de technische
  // tools als lijntekening op een licht "blauwdruk"-vlak (zie css/hub.css)
  const ART = {
    post: `<span class="art art--post"><span class="art__post"><i class="art__bar"></i><i class="art__label"></i><i class="art__line art__line--w80"></i><i class="art__line art__line--w55"></i><i class="art__logo"></i></span></span>`,
    doc: `<span class="art art--doc"><span class="art__sheet"><i class="art__bar"></i><i class="art__brand"></i><i class="art__title"></i><i class="art__line"></i><i class="art__line"></i><i class="art__line art__line--w70"></i><i class="art__line"></i><i class="art__line art__line--w55"></i></span></span>`,
    slides: `<span class="art art--slides"><span class="art__slide art__slide--back"></span><span class="art__slide"><i class="art__bar"></i><i class="art__hex"></i><i class="art__title"></i><i class="art__line art__line--w55"></i></span></span>`,
    hex: `<span class="art art--hex"><i class="art__big-hex"></i></span>`,
    // Browservenster met cookiebanner, en de zeshoek met een vinkje
    consent: `<span class="art art--line"><svg viewBox="0 0 160 100"><rect x="10" y="12" width="112" height="76" fill="#fff" stroke="#303030" stroke-width="2.5"/><path d="M10 24h112" stroke="#303030" stroke-width="2.5"/><circle cx="17" cy="18" r="1.7" fill="#303030"/><circle cx="23" cy="18" r="1.7" fill="#303030"/><circle cx="29" cy="18" r="1.7" fill="#303030"/><rect x="20" y="32" width="44" height="5" fill="#303030"/><rect x="20" y="42" width="66" height="3" fill="#d5dee5"/><rect x="20" y="48" width="54" height="3" fill="#d5dee5"/><rect x="16" y="60" width="100" height="22" fill="#303030"/><rect x="22" y="66" width="42" height="3" fill="#fff" fill-opacity=".85"/><rect x="22" y="72" width="30" height="3" fill="#fff" fill-opacity=".45"/><rect x="84" y="65" width="26" height="12" fill="#1ab9e2"/><path class="art__pop" d="M136 26l18.2 10.5v21L136 68l-18.2-10.5v-21z" fill="#1ab9e2"/><path class="art__pop" d="m128 47 6 6 11-12" fill="none" stroke="#303030" stroke-width="3.2"/></svg></span>`,
    // Advertentie en landingspagina met dezelfde (cyaan) boodschap, verbonden
    ads: `<span class="art art--line"><svg viewBox="0 0 160 100"><rect x="6" y="28" width="56" height="44" fill="#fff" stroke="#303030" stroke-width="2.5"/><rect x="12" y="34" width="13" height="7" fill="#303030"/><rect x="12" y="46" width="42" height="5" fill="#1ab9e2"/><rect x="12" y="55" width="36" height="3" fill="#d5dee5"/><rect x="12" y="61" width="28" height="3" fill="#d5dee5"/><path d="M62 50h30" stroke="#303030" stroke-width="2.5" stroke-dasharray="4 3"/><rect x="92" y="10" width="62" height="80" fill="#fff" stroke="#303030" stroke-width="2.5"/><path d="M92 21h62" stroke="#303030" stroke-width="2.5"/><circle cx="98" cy="15.5" r="1.6" fill="#303030"/><circle cx="104" cy="15.5" r="1.6" fill="#303030"/><rect x="100" y="29" width="46" height="5" fill="#1ab9e2"/><rect x="100" y="39" width="38" height="3" fill="#d5dee5"/><rect x="100" y="45" width="42" height="3" fill="#d5dee5"/><rect x="100" y="55" width="46" height="18" fill="#e8f7fc"/><rect x="100" y="78" width="24" height="7" fill="#303030"/><path class="art__pop" d="M77 38l10.4 6v12L77 62l-10.4-6V44z" fill="#1ab9e2"/><path class="art__pop" d="m72 50 3.5 3.5 6.5-7" fill="none" stroke="#303030" stroke-width="2.5"/></svg></span>`,
    // Staafjes per onderwerp: top 10 (inkt) naast jouw pagina (cyaan), met één gat
    seo: `<span class="art art--line"><svg viewBox="0 0 160 100"><path d="M8 86h144" stroke="#303030" stroke-width="2.5"/><rect x="14" y="36" width="12" height="50" fill="#303030"/><rect x="28" y="44" width="12" height="42" fill="#1ab9e2"/><rect x="50" y="26" width="12" height="60" fill="#303030"/><rect x="64" y="32" width="12" height="54" fill="#1ab9e2"/><rect x="86" y="40" width="12" height="46" fill="#303030"/><rect x="101.25" y="49.25" width="9.5" height="35.5" fill="none" stroke="#1ab9e2" stroke-width="2.5" stroke-dasharray="3.5 3"/><rect x="122" y="46" width="12" height="40" fill="#303030"/><rect x="136" y="64" width="12" height="22" fill="#1ab9e2"/><g class="art__pop"><circle cx="112" cy="28" r="12" fill="#fff" fill-opacity=".75" stroke="#303030" stroke-width="3"/><path d="m121 37 8 8" stroke="#303030" stroke-width="4"/></g></svg></span>`,
  };

  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  const EXTERNAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7m-9 0h9v9"/></svg>';
  const DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';
  const COMPUTER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18v11H3zm5 15h8m-4-4v4"/></svg>';

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
    const withStarts = tools.filter((t) => live(t) && Array.isArray(t.starts) && t.starts.length);
    if (!withStarts.length) return;
    $('startList').innerHTML = withStarts.map((tool) => `
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
     Alle tools: per blok een rij gelijke kaarten. Bij tools in de hub en
     web-apps zit de link op de naam en rekt hij uit over de hele kaart (zie
     .tool-card__link::after); een lokale tool heeft twee knoppen: downloaden
     en de uitleg.
     ------------------------------------------------------------------------- */

  const isNew = (t) => t.status === 'nieuw' && (!t.newUntil || Date.now() < Date.parse(t.newUntil));

  // Waar de tool draait, rechtsboven op de omslag: vooraf weten wat een klik doet
  function kindBadge(tool) {
    if (tool.kind === 'web') return `<span class="tool-card__kind">${EXTERNAL}web-app</span>`;
    if (tool.kind === 'lokaal') return `<span class="tool-card__kind">${COMPUTER}lokaal</span>`;
    return '';
  }

  function card(tool) {
    const soon = !live(tool);
    const name = `${esc(tool.name)}<span class="dot">.</span>`;
    const status = soon
      ? '<span class="tool-card__status tool-card__status--soon">binnenkort</span>'
      : isNew(tool) ? '<span class="tool-card__status"><i class="hex" aria-hidden="true"></i>nieuw</span>' : '';
    const exports = (tool.exports || []).map((e) => `<li class="pill">${esc(e)}</li>`).join('');

    let title = name;
    let foot = `<div class="tool-card__foot" aria-hidden="true"><span class="tool-card__cta">in ontwikkeling</span></div>`;
    if (!soon && tool.kind === 'lokaal') {
      foot = `
        <div class="tool-card__foot tool-card__foot--split">
          <a class="tool-card__cta" href="${esc(tool.href)}" data-download="${esc(tool.id)}" aria-label="Download ${esc(tool.name)} (zip)">${esc(tool.cta || 'download')}${DOWNLOAD}</a>
          ${tool.guide ? `<button type="button" class="btn btn-outline tool-card__help" data-guide="${esc(tool.guide)}" aria-haspopup="dialog">hoe werkt dit?</button>` : ''}
        </div>`;
    } else if (!soon && tool.kind === 'web') {
      title = `<a class="tool-card__link" href="${esc(tool.href)}" target="_blank" rel="noopener">${name}<span class="sr-only"> (opent in een nieuw tabblad)</span></a>`;
      foot = `<div class="tool-card__foot" aria-hidden="true"><span class="tool-card__cta">${esc(tool.cta || 'open de tool')}${EXTERNAL}</span></div>`;
    } else if (!soon) {
      title = `<a class="tool-card__link" href="${esc(url(tool.href))}">${name}</a>`;
      foot = `<div class="tool-card__foot" aria-hidden="true"><span class="tool-card__cta">${esc(tool.cta || 'open tool')}${ARROW}</span></div>`;
    }

    const badges = status + kindBadge(tool);
    const cls = ['tool-card', soon && 'is-soon', tool.kind && 'tool-card--ext'].filter(Boolean).join(' ');
    // Een overgang naar de tool kan alleen binnen de hub
    const transition = tool.kind ? '' : ` style="view-transition-name: tool-${esc(tool.id)}"`;
    return `
      <article class="${cls}"${transition}>
        <div class="tool-card__cover" aria-hidden="true">${ART[tool.art] || ART.hex}</div>
        <div class="tool-card__body">
          <h4 class="tool-card__name">${title}</h4>
          ${badges ? `<div class="tool-card__badges">${badges}</div>` : ''}
          <p class="tool-card__desc">${esc(tool.description)}</p>
          ${exports ? `<ul class="tool-card__exports" aria-label="${tool.kind ? 'Je krijgt' : 'Downloaden als'}">${exports}</ul>` : ''}
        </div>
        ${foot}
      </article>`;
  }

  function renderTools() {
    const blocks = groups
      .map((g) => ({ ...g, list: tools.filter((t) => groupOf(t) === g.id) }))
      .filter((g) => g.list.length);
    $('toolGroups').innerHTML = blocks.map((g) => `
      <section class="tool-group${g.tone === 'dark' ? ' tool-group--dark' : ''}" id="${esc(g.id)}" data-group="${esc(g.id)}" aria-labelledby="group-${esc(g.id)}">
        <div class="tool-group__head">
          <h3 class="tool-group__title" id="group-${esc(g.id)}">${esc(g.name)}<span class="dot">.</span></h3>
          ${g.lead ? `<p class="tool-group__lead">${esc(g.lead)}</p>` : ''}
        </div>
        <div class="tool-grid">${g.list.map(card).join('')}</div>
      </section>`).join('');

    // Filter: alleen zinvol als er meer dan één blok is
    if (blocks.length < 2) return;
    const options = [{ id: '', name: 'alles', n: tools.length }, ...blocks.map((g) => ({ id: g.id, name: g.name.toLowerCase(), short: g.short, n: g.list.length }))];
    $('toolFilter').innerHTML = options.map((o, i) => `
      <input type="radio" name="toolGroup" id="toolGroup-${esc(o.id || 'alles')}" value="${esc(o.id)}"${i === 0 ? ' checked' : ''}>
      <label for="toolGroup-${esc(o.id || 'alles')}">${o.short ? `<span class="seg__long">${esc(o.name)}</span><span class="seg__short">${esc(o.short)}</span>` : esc(o.name)} <span class="seg__count">${o.n}</span></label>`).join('');
    $('toolFilter').hidden = false;
  }

  // Eén blok tonen, of alles. De keuze staat in het adres (#techniek), zodat
  // je hem als bladwijzer bewaart of doorstuurt.
  function showGroup(id, { scroll = false } = {}) {
    const value = groups.some((g) => g.id === id) ? id : '';
    document.querySelectorAll('.tool-group').forEach((section) => {
      section.hidden = Boolean(value) && section.dataset.group !== value;
    });
    const radio = document.querySelector(`input[name="toolGroup"][value="${value}"]`);
    if (radio) radio.checked = true;
    if (scroll && value) $(value).scrollIntoView({ block: 'start' });
  }

  /* ---------------------------------------------------------------------------
     Uitleg bij een lokale tool: een paneel van rechts met een tabje per
     systeem. Het tabje van je eigen computer staat al open.
     ------------------------------------------------------------------------- */

  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  const myOs = /win/i.test(platform) ? 'windows' : 'mac';

  function selectTab(tab, focus = false) {
    const tabs = [...tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = $(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  }

  function initTabs(root) {
    for (const list of root.querySelectorAll('[role="tablist"]')) {
      const tabs = [...list.querySelectorAll('[role="tab"]')];
      selectTab(tabs.find((t) => t.dataset.os === myOs) || tabs[0]);
      list.addEventListener('click', (e) => {
        const tab = e.target.closest('[role="tab"]');
        if (tab) selectTab(tab, true);
      });
      // Pijltjes wisselen van tabje, zoals in elke tabbalk
      list.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(document.activeElement);
        const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (i < 0 || next === undefined) return;
        e.preventDefault();
        selectTab(tabs[(next + tabs.length) % tabs.length], true);
      });
    }
  }

  // returnTo: waar de focus heen gaat na sluiten. Zelf bijhouden, want Safari
  // geeft een aangeklikte knop geen focus en de browser weet het dan niet.
  function openGuide(id, returnTo) {
    const dialog = $(id);
    if (!dialog || typeof dialog.showModal !== 'function') return;
    dialog._returnTo = returnTo;
    if (!dialog.open) dialog.showModal();
    const tab = dialog.querySelector('[role="tab"][aria-selected="true"]');
    if (tab) tab.focus();
  }

  // Knopfeedback op de plek van de klik: even "✓ ..." en dan terug
  function flash(button, text, ms = 2200) {
    const label = button.querySelector('[data-label]') || button;
    if (!button.dataset.idle) button.dataset.idle = label.textContent;
    label.textContent = text;
    button.classList.add('is-done');
    clearTimeout(button._flash);
    button._flash = setTimeout(() => {
      label.textContent = button.dataset.idle;
      button.classList.remove('is-done');
    }, ms);
  }

  function initGuides() {
    for (const dialog of document.querySelectorAll('dialog.guide')) {
      initTabs(dialog);
      // Downloadknoppen in de uitleg: dezelfde link als op de kaart (één bron: tools.js)
      for (const link of dialog.querySelectorAll('[data-download]')) {
        const tool = tools.find((t) => t.id === link.dataset.download);
        if (tool) link.href = tool.href;
        link.addEventListener('click', () => flash(link, 'download gestart'));
      }
      // Sluiten met het kruisje of met een klik naast het paneel (Esc doet de browser)
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
      });
      dialog.addEventListener('close', () => {
        if (dialog._returnTo && dialog._returnTo.isConnected) dialog._returnTo.focus();
      });
    }

    // Opdrachten kopiëren; lukt dat niet, dan staat de tekst geselecteerd
    document.addEventListener('click', async (e) => {
      const button = e.target.closest('[data-copy]');
      if (!button) return;
      const done = button.parentElement.nextElementSibling;
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.classList.add('is-copied');
        if (done && done.matches('.cmd__done')) done.textContent = 'gekopieerd';
      } catch (err) {
        const range = document.createRange();
        range.selectNodeContents(button.previousElementSibling);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        if (done && done.matches('.cmd__done')) done.textContent = 'geselecteerd: kopieer met Ctrl + C';
      }
      clearTimeout(button._copied);
      button._copied = setTimeout(() => {
        button.classList.remove('is-copied');
        if (done && done.matches('.cmd__done')) done.textContent = '';
      }, 2200);
    });
  }

  $('toolGroups').addEventListener('click', (e) => {
    const help = e.target.closest('[data-guide]');
    if (help) {
      openGuide(help.dataset.guide, help);
      return;
    }
    // Download vanaf de kaart: de volgende stap staat in de uitleg
    const download = e.target.closest('[data-download]');
    const tool = download && tools.find((t) => t.id === download.dataset.download);
    if (tool && tool.guide) {
      const help = document.querySelector(`[data-guide="${tool.guide}"]`);
      toast('Download gestart. Eerste keer? Lees hoe je hem start.', false, { label: 'hoe werkt dit?', run: () => openGuide(tool.guide, help) });
    }
  });

  $('toolFilter').addEventListener('change', (e) => {
    showGroup(e.target.value);
    history.replaceState(null, '', e.target.value ? `#${e.target.value}` : location.pathname + location.search);
  });
  window.addEventListener('hashchange', () => showGroup(location.hash.slice(1), { scroll: true }));

  renderTools();
  renderStarts();
  renderRecent();
  initGuides();
  showGroup(location.hash.slice(1), { scroll: true });
})();
