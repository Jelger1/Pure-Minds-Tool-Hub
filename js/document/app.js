/* =============================================================================
   document/app.js — Document Maker
   -----------------------------------------------------------------------------
   Maakt A4-documenten (brief, offerte, memo, notitie) op het briefpapier van
   Pure Minds. De preview is echte HTML op pagina's van 794 × 1123 px:

     1. buildBlocks()  zet de invoer om in blokken (titel, gegevens, alinea's,
                       lijsten, offertetabel, ondertekening)
     2. paginate()     giet de blokken in pagina's; alinea's, lijsten en de
                       tabel lopen door naar de volgende pagina, koppen gaan
                       mee met de tekst eronder
     3. exportPdf()    bouwt elke pagina opnieuw op als vector-PDF met echte,
                       bewerkbare tekst (js/document/pdf.js), precies zoals de
                       preview. "Afdrukken" kan ook, via de printer.
   ============================================================================= */
(function () {
  'use strict';

  const PM = window.PM;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const KEY = 'pm-document-v1';
  const SENDER_KEY = 'pm-document-sender-v1';
  const SIG_KEY = 'document:signature';
  const PAGE_W = 794;

  const TYPE_LABEL = { brief: 'brief', offerte: 'offerte', memo: 'memo', notitie: 'notitie' };

  // Zeshoeken als SVG (inline of als <img> met een SVG-data-URL), niet met
  // clip-path of ::before: zo neemt de PDF-export ze over als vector.
  const HEX_PATH = 'M43.3 0 86.6 25v50L43.3 100 0 75V25z';
  const HEX = `<svg viewBox="0 0 86.6 100" width="11" height="12.7" aria-hidden="true"><path d="${HEX_PATH}" fill="#1ab9e2"/></svg>`;
  const BULLET = `<img class="a4-bullet" alt="" src="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 86.6 100' width='70' height='81'><path d='${HEX_PATH}' fill='#1ab9e2'/></svg>`)}">`;

  /* ---------------------------------------------------------------------------
     Toestand
     ------------------------------------------------------------------------- */

  function isoDate(d) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

  const DEFAULT_BODY = [
    '<p>Bedankt voor het prettige gesprek van afgelopen week. In dit document zetten we op een rij wat we voor jullie gaan doen en wat je van ons mag verwachten.</p>',
    '<h2>Onze aanpak</h2>',
    '<ul><li>We starten met een analyse van de huidige campagnes en de landingspagina\'s.</li><li>Daarna maken we een plan met <strong>concrete doelen per kanaal</strong>.</li><li>Elke maand bespreken we de resultaten en stellen we bij.</li></ul>',
    '<p>Heb je vragen of wil je iets aanpassen? Laat het ons weten, dan passen we het voorstel aan.</p>',
  ].join('');

  function defaults() {
    const now = new Date();
    return {
      type: 'brief',
      label: '',
      title: 'Voorstel voor de samenwerking',
      date: isoDate(now),
      recipient: 'Naam contactpersoon\nBedrijfsnaam\nStraat 1\n1234 AB Plaats',
      reference: '',
      salutation: 'Beste [naam],',
      quoteNumber: `${now.getFullYear()}-001`,
      validUntil: isoDate(addDays(now, 30)),
      memoTo: 'Het team',
      memoFrom: '',
      memoCc: '',
      body: DEFAULT_BODY,
      items: [
        { desc: 'Strategiesessie en analyse', qty: 1, price: 950 },
        { desc: 'Campagnebeheer (per maand)', qty: 3, price: 650 },
      ],
      vat: '21',
      acceptBlock: true,
      showSignature: true,
      closing: 'Met vriendelijke groet,',
      signName: '',
      signRole: '',
    };
  }

  const SENDER_DEFAULTS = {
    company: 'Pure Minds marketing group',
    street: '',
    city: '',
    phone: '',
    email: '',
    web: 'pureminds.nl',
    kvk: '',
    vat: '',
    iban: '',
  };

  function loadState() {
    const base = defaults();
    const saved = PM.store.get(KEY, {});
    for (const k of Object.keys(base)) {
      if (!(k in saved)) continue;
      if (Array.isArray(base[k])) base[k] = Array.isArray(saved[k]) ? saved[k] : base[k];
      else if (typeof saved[k] === typeof base[k]) base[k] = saved[k];
    }
    if (!TYPE_LABEL[base.type]) base.type = 'brief';
    base.items = base.items
      .filter((it) => it && typeof it === 'object')
      .map((it) => ({ desc: String(it.desc || ''), qty: Number(it.qty) || 0, price: Number(it.price) || 0 }));
    base.body = sanitize(base.body);
    return base;
  }

  /* ---------------------------------------------------------------------------
     Opmaak van de teksteditor opschonen
     ------------------------------------------------------------------------- */

  const ALLOWED = {
    P: 'p', DIV: 'p', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h3', H5: 'h3', H6: 'h3',
    UL: 'ul', OL: 'ol', LI: 'li', BLOCKQUOTE: 'blockquote',
    STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', U: 'u', BR: 'br',
  };
  const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK', 'TITLE', 'HEAD', 'SVG', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'NOSCRIPT']);
  const BLOCKS = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'blockquote']);
  const INLINE_PARENTS = new Set(['p', 'h2', 'h3', 'li', 'strong', 'em', 'u', 'blockquote']);

  /**
   * Laat alleen alinea's, koppen, lijsten, citaten, vet, cursief, onderstreept
   * en regeleindes over, zonder attributen. Losse tekst bovenaan komt in een <p>.
   */
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
    const out = document.createElement('div');

    function walk(src, dst) {
      for (const node of Array.from(src.childNodes)) {
        if (node.nodeType === 3) {
          dst.appendChild(document.createTextNode(node.nodeValue.replace(/\u00a0/g, ' ')));
        } else if (node.nodeType === 1) {
          if (DROP.has(node.tagName)) continue;
          let tag = ALLOWED[node.tagName];
          const parentTag = dst === out ? null : dst.tagName.toLowerCase();
          // Een blok binnen een alinea of lijstitem (zoals een <div> uit Word) wordt uitgepakt
          if (tag && BLOCKS.has(tag) && parentTag && INLINE_PARENTS.has(parentTag) && tag !== 'ul' && tag !== 'ol') tag = null;
          if (tag === 'li' && parentTag !== 'ul' && parentTag !== 'ol') tag = 'p';
          if (tag) {
            const el = document.createElement(tag);
            walk(node, el);
            dst.appendChild(el);
          } else {
            walk(node, dst);
          }
        }
      }
    }
    walk(doc.body, out);

    // Losse tekst en inline-elementen bovenaan groeperen in alinea's
    const clean = document.createElement('div');
    let para = null;
    for (const node of Array.from(out.childNodes)) {
      const isBlock = node.nodeType === 1 && BLOCKS.has(node.tagName.toLowerCase());
      if (isBlock) {
        para = null;
        clean.appendChild(node);
      } else {
        if (node.nodeType === 3 && !node.nodeValue.trim() && !para) continue;
        if (!para) {
          para = document.createElement('p');
          clean.appendChild(para);
        }
        para.appendChild(node);
      }
    }
    // Lege blokken weg (een alinea met alleen <br> blijft: dat is een witregel)
    for (const el of Array.from(clean.querySelectorAll('p, h2, h3, li, blockquote, ul, ol, strong, em, u'))) {
      if (!el.textContent.trim() && !el.querySelector('br')) el.remove();
    }
    return clean.innerHTML;
  }

  let state = loadState();
  // Gestart vanaf het dashboard (?type=offerte): meteen het goede soort document.
  // Pas opgeslagen bij de eerste wijziging, zodat alleen kijken niets verandert.
  const start = PM.startParams();
  if (TYPE_LABEL[start.type]) state.type = start.type;
  let sender = { ...SENDER_DEFAULTS, ...PM.store.get(SENDER_KEY, {}) };
  let signature = null;  // { url, name }

  const save = PM.debounce(() => {
    PM.store.set(KEY, state);
    PM.store.set(SENDER_KEY, sender);
  }, 300);

  /* ---------------------------------------------------------------------------
     Elementen
     ------------------------------------------------------------------------- */

  const el = {
    editor: $('#editor'),
    rte: $('#rte'),
    rteBar: $('#rteBar'),
    sheets: $('#sheets'),
    sheetsWrap: $('#sheetsWrap'),
    stage: $('#stage'),
    typePill: $('#typePill'),
    pagePill: $('#pagePill'),
    itemRows: $('#itemRows'),
    itemsTotal: $('#itemsTotal'),
    signFields: $('#signFields'),
    sigInput: $('#sigInput'),
    sigName: $('#sigName'),
    sigThumb: $('#sigThumb'),
    sigBtn: $('#sigBtn'),
    docNote: $('#docNote'),
    senderNudge: $('#senderNudge'),
    senderPanel: $('#senderPanel'),
    sigClear: $('#sigClear'),
    pdfBtn: $('#pdfBtn'),
    docxBtn: $('#docxBtn'),
    printBtn: $('#printBtn'),
    printRoot: $('#printRoot'),
    label: $('#dLabel'),
  };

  const esc = PM.esc;
  const money = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
  const number = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });

  function longDate(iso) {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const lines = (text) => String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);

  function titleHtml(title) {
    const t = String(title || '').trim();
    if (!t) return '';
    if (/[^.]\.$/.test(t)) return `${esc(t.slice(0, -1))}<span class="dot">.</span>`;
    if (/[!?…:]$/.test(t)) return esc(t);
    return `${esc(t)}<span class="dot">.</span>`;
  }

  function totals() {
    const rows = state.items.filter((it) => it.desc.trim() || it.price);
    const subtotal = rows.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const vatRate = Number(state.vat) || 0;
    const vat = Math.round(subtotal * vatRate) / 100;
    return { rows, subtotal, vatRate, vat, total: subtotal + vat };
  }

  /* ---------------------------------------------------------------------------
     1. Blokken
     ------------------------------------------------------------------------- */

  function node(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // kind: 'text' (op woorden te splitsen), 'list', 'table' of 'keep' (heel laten)
  const block = (elm, kind, opts = {}) => ({ el: elm, kind, keepNext: !!opts.keepNext });

  function spaced(b, px) {
    b.el.style.marginTop = `${px}px`;
    return b;
  }

  function buildBlocks() {
    const d = state;
    const out = [];
    const label = d.label.trim() || TYPE_LABEL[d.type];

    const titleBlock = () => block(node('div', 'a4-titleblock',
      `<div class="a4-label">${HEX}${esc(label)}</div>${d.title.trim() ? `<h1 class="a4-title">${titleHtml(d.title)}</h1>` : ''}`), 'keep', { keepNext: true });

    const dl = (pairs, cls = 'a4-dl', field = 'date') => `<dl class="${cls}" data-field="${field}">${pairs
      .filter(([, v]) => String(v || '').trim())
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;

    if (d.type === 'brief') {
      out.push(block(node('div', 'a4-meta',
        `<address class="a4-address" data-field="recipient">${lines(d.recipient).map(esc).join('\n')}</address>${dl([['Datum', longDate(d.date)], ['Kenmerk', d.reference]])}`), 'keep'));
      out.push(spaced(titleBlock(), 40));
      if (d.salutation.trim()) {
        const sal = node('p', null, esc(d.salutation.trim()));
        sal.dataset.field = 'salutation';
        out.push(spaced(block(sal, 'text'), 22));
      }
    } else if (d.type === 'offerte') {
      out.push(titleBlock());
      out.push(spaced(block(node('div', 'a4-meta',
        `<div><div class="a4-address__label">Offerte voor</div><address class="a4-address" data-field="recipient">${lines(d.recipient).map(esc).join('\n')}</address></div>${dl([['Offertenummer', d.quoteNumber], ['Datum', longDate(d.date)], ['Geldig tot', longDate(d.validUntil)]], 'a4-dl', 'quote')}`), 'keep'), 26));
    } else if (d.type === 'memo') {
      out.push(titleBlock());
      out.push(spaced(block(node('div', null, dl([['Aan', d.memoTo], ['Van', d.memoFrom], ['CC', d.memoCc], ['Datum', longDate(d.date)]], 'a4-dl a4-dl--memo', 'memo')), 'keep'), 18));
    } else {
      out.push(titleBlock());
      if (d.date) out.push(spaced(block(node('div', null, dl([['Datum', longDate(d.date)]])), 'keep'), 10));
    }

    // Lopende tekst uit de editor; opsommingen krijgen een zeshoek-bullet
    const holder = node('div', null, sanitize(d.body));
    for (const li of holder.querySelectorAll('ul > li')) li.insertAdjacentHTML('afterbegin', BULLET);
    let first = true;
    for (const child of Array.from(holder.children)) {
      child.dataset.field = 'body';
      const tag = child.tagName.toLowerCase();
      let b;
      if (tag === 'ul' || tag === 'ol') b = block(child, 'list');
      else if (tag === 'h2' || tag === 'h3') {
        child.dataset.keepNext = '1';
        b = block(child, 'keep', { keepNext: true });
      } else b = block(child, 'text');
      if (first) spaced(b, d.type === 'brief' ? 12 : 26);
      first = false;
      out.push(b);
    }

    if (d.type === 'offerte') {
      const t = totals();
      if (t.rows.length) {
        const rows = t.rows.map((it) => `<tr><td>${esc(it.desc)}</td><td class="num">${number.format(Number(it.qty) || 0)}</td><td class="num">${money.format(Number(it.price) || 0)}</td><td class="num">${money.format((Number(it.qty) || 0) * (Number(it.price) || 0))}</td></tr>`).join('');
        out.push(spaced(block(node('table', 'a4-table',
          `<thead><tr><th>Omschrijving</th><th class="num">Aantal</th><th class="num">Prijs</th><th class="num">Totaal</th></tr></thead><tbody>${rows}</tbody>`), 'table'), 26));
        out.push(block(node('div', 'a4-totals',
          `<dl><div><dt>Subtotaal</dt><dd>${money.format(t.subtotal)}</dd></div><div><dt>Btw ${t.vatRate}%</dt><dd>${money.format(t.vat)}</dd></div><div class="is-total"><dt>Totaal</dt><dd>${money.format(t.total)}</dd></div></dl>`), 'keep'));
      }
      if (d.acceptBlock) {
        out.push(spaced(block(node('div', 'a4-accept',
          '<div class="a4-accept__title">Voor akkoord</div><div class="a4-accept__field"><span>naam</span></div><div class="a4-accept__field"><span>datum</span></div><div class="a4-accept__field"><span>handtekening</span></div>'), 'keep'), 28));
      }
    }

    if (d.showSignature) {
      const role = [d.signRole.trim(), sender.company.trim()].filter(Boolean).join(' · ');
      out.push(spaced(block(node('div', 'a4-sign',
        `${d.closing.trim() ? `<p>${esc(d.closing.trim())}</p>` : ''}${signature ? `<img class="a4-sign__img" src="${esc(signature.url)}" alt="">` : '<div class="a4-sign__space"></div>'}${d.signName.trim() ? `<p class="a4-sign__name">${esc(d.signName.trim())}</p>` : ''}${role ? `<p class="a4-sign__role">${esc(role)}</p>` : ''}`), 'keep'), 28));
    }
    for (const b of out) {
      const c = b.el.classList;
      if (b.el.dataset.field) continue;
      if (c.contains('a4-titleblock')) b.el.dataset.field = 'title';
      else if (c.contains('a4-table') || c.contains('a4-totals')) b.el.dataset.field = 'items';
      else if (c.contains('a4-accept')) b.el.dataset.field = 'accept';
      else if (c.contains('a4-sign')) b.el.dataset.field = 'sign';
    }
    return out;
  }

  /* ---------------------------------------------------------------------------
     2. Pagina's
     ------------------------------------------------------------------------- */

  // Zeshoek-lijnpatroon rechtsboven, als SVG-afbeelding. Elke zeshoek krijgt
  // zijn eigen dekking, zodat het patroon vanuit de hoek vervaagt.
  const PATTERN_SVG = (() => {
    const r = 34;
    const w = Math.sqrt(3) * r;
    const reach = 380;
    const paths = [];
    for (let row = -1; row < 7; row++) {
      const y = row * 1.5 * r;
      const shift = row % 2 ? w / 2 : 0;
      for (let x = -w + shift; x < 360 + w; x += w) {
        const alpha = 0.42 * (1 - Math.hypot(360 - x, y) / reach);
        if (alpha < 0.03) continue;
        let d = '';
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 2;
          d += `${i ? 'L' : 'M'}${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`;
        }
        paths.push(`<path d="${d}Z" stroke-opacity="${alpha.toFixed(2)}"/>`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" width="360" height="240"><g fill="none" stroke="#90a4b4" stroke-width="1">${paths.join('')}</g></svg>`;
  })();
  const PATTERN = `<img class="a4__pattern" alt="" src="data:image/svg+xml,${encodeURIComponent(PATTERN_SVG)}">`;

  function senderHtml() {
    const s = sender;
    const rows = [s.street, s.city, s.phone && `T ${s.phone}`, s.email, s.web].filter((v) => String(v || '').trim()).map(esc);
    return `<address class="a4__sender" data-field="sender">${s.company.trim() ? `<b>${esc(s.company)}</b>` : ''}${rows.join('<br>')}</address>`;
  }

  function footerHtml() {
    const s = sender;
    const one = [s.company && `<b>${esc(s.company)}</b>`, esc(s.street), esc(s.city), esc(s.web)].filter(Boolean).join(' &middot; ');
    const two = [s.kvk && `KvK ${esc(s.kvk)}`, s.vat && `Btw ${esc(s.vat)}`, s.iban && `IBAN ${esc(s.iban)}`].filter(Boolean).join(' &middot; ');
    return `<div>${one}${two ? `<br>${two}` : ''}</div>`;
  }

  function makePage(first) {
    const page = node('article', `a4 ${first ? 'a4--first' : 'a4--next'}`);
    const running = state.title.trim() || TYPE_LABEL[state.type];
    // Het patroon alleen op de eerste pagina: op vervolgpagina's begint de tekst hoger
    page.innerHTML = `${first ? PATTERN : ''}<div class="a4__bar"></div>`
      + `<header class="a4__head"><img class="a4__logo" src="${esc(PM.brandSrc('logoBlack'))}" alt="Pure Minds">${first ? senderHtml() : `<span class="a4__running" data-field="title">${esc(running)}</span>`}</header>`
      + '<div class="a4__body"><div class="a4__flow"></div></div>'
      + `<footer class="a4__foot" data-field="sender">${footerHtml()}<span class="a4__pageno">${HEX}<span data-pageno></span></span></footer>`;
    el.sheets.appendChild(page);
    return { page, body: $('.a4__body', page), flow: $('.a4__flow', page) };
  }

  // Beginposities van woorden (na een spatie) binnen een element
  function wordBounds(elm) {
    const out = [];
    const walker = document.createTreeWalker(elm, NodeFilter.SHOW_TEXT);
    let seen = '';
    let n;
    while ((n = walker.nextNode())) {
      const re = /\s+/g;
      let m;
      while ((m = re.exec(n.nodeValue))) {
        const offset = m.index + m[0].length;
        if ((seen + n.nodeValue.slice(0, m.index)).trim() && offset < n.nodeValue.length) out.push({ node: n, offset });
      }
      seen += n.nodeValue;
    }
    return out;
  }

  function slice(elm, from, to) {
    const range = document.createRange();
    if (from) range.setStart(from.node, from.offset);
    else range.setStart(elm, 0);
    if (to) range.setEnd(to.node, to.offset);
    else range.setEnd(elm, elm.childNodes.length);
    const out = elm.cloneNode(false);
    out.appendChild(range.cloneContents());
    return out;
  }

  // Zoveel mogelijk woorden van `elm` in `container` zetten (binair zoeken)
  function splitText(elm, container, fits) {
    const bounds = wordBounds(elm);
    let lo = 1;
    let hi = bounds.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const part = slice(elm, null, bounds[mid - 1]);
      container.appendChild(part);
      const ok = fits();
      part.remove();
      if (ok) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (!best) return null;
    const head = slice(elm, null, bounds[best - 1]);
    container.appendChild(head);
    return slice(elm, bounds[best - 1], null);
  }

  // Probeert een deel van het blok op de pagina te zetten. Geeft terug wat overblijft.
  function trySplit(b, cur, fits) {
    if (b.kind === 'text') {
      const rest = splitText(b.el, cur.flow, fits);
      return rest ? { placed: true, rest: { ...b, el: rest } } : { placed: false };
    }

    if (b.kind === 'list') {
      const list = b.el;
      const head = list.cloneNode(false);
      cur.flow.appendChild(head);
      const start = Number(list.getAttribute('start')) || 1;
      let moved = 0;
      while (list.firstElementChild) {
        const li = list.firstElementChild;
        head.appendChild(li);
        if (fits()) {
          moved++;
          continue;
        }
        list.insertBefore(li, list.firstElementChild);
        break;
      }
      // Het eerste item dat niet past zo mogelijk op woorden splitsen
      let partial = false;
      if (list.firstElementChild) {
        const li = list.firstElementChild;
        const rest = splitText(li, head, fits);
        if (rest) {
          rest.classList.add('is-cont');
          list.replaceChild(rest, li);
          partial = true;
        }
      }
      if (!moved && !partial) {
        head.remove();
        return { placed: false };
      }
      if (list.tagName === 'OL') list.setAttribute('start', String(start + moved));
      return { placed: true, rest: list.firstElementChild ? { ...b, el: list } : null };
    }

    if (b.kind === 'table') {
      const table = b.el;
      const tbody = table.tBodies[0];
      const head = table.cloneNode(false);
      if (table.tHead) head.appendChild(table.tHead.cloneNode(true));
      const body = document.createElement('tbody');
      head.appendChild(body);
      cur.flow.appendChild(head);
      let moved = 0;
      while (tbody.rows.length) {
        const row = tbody.rows[0];
        body.appendChild(row);
        if (fits()) {
          moved++;
          continue;
        }
        tbody.insertBefore(row, tbody.firstChild);
        break;
      }
      if (!moved) {
        head.remove();
        return { placed: false };
      }
      return { placed: true, rest: tbody.rows.length ? { ...b, el: table } : null };
    }

    return { placed: false };
  }

  function paginate(blocks) {
    el.sheets.textContent = '';
    const pages = [makePage(true)];
    let cur = pages[0];
    let clipped = false;
    const next = () => {
      cur = makePage(false);
      pages.push(cur);
    };
    const fits = () => cur.flow.offsetHeight <= cur.body.clientHeight + 0.5;
    const blockOf = new Map(blocks.map((b) => [b.el, b]));
    const queue = blocks.slice();
    let guard = 0;

    while (queue.length && guard++ < 5000) {
      const b = queue.shift();
      cur.flow.appendChild(b.el);

      if (fits()) {
        // Een kop blijft niet onderaan een pagina hangen zonder tekst eronder
        if (b.keepNext && queue.length && cur.flow.children.length > 1 && cur.body.clientHeight - cur.flow.offsetHeight < 64) {
          b.el.remove();
          queue.unshift(b);
          next();
        }
        continue;
      }

      b.el.remove();
      const emptyPage = cur.flow.children.length === 0;
      const result = trySplit(b, cur, fits);
      if (result.placed) {
        if (result.rest) queue.unshift(result.rest);
        next();
      } else if (emptyPage) {
        // Past op geen enkele pagina: toch plaatsen (wordt afgekapt) en melden
        cur.flow.appendChild(b.el);
        clipped = true;
        if (queue.length) next();
      } else {
        queue.unshift(b);
        const last = cur.flow.lastElementChild;
        const lastBlock = last && blockOf.get(last);
        if (lastBlock && lastBlock.keepNext && cur.flow.children.length > 1) {
          last.remove();
          queue.unshift(lastBlock);
        }
        next();
      }
    }

    // Een lege laatste pagina (kan na een geforceerde sprong) weghalen
    const lastPage = pages[pages.length - 1];
    if (pages.length > 1 && !lastPage.flow.children.length) {
      lastPage.page.remove();
      pages.pop();
    }

    const total = pages.length;
    pages.forEach((p, i) => {
      const no = $('[data-pageno]', p.page);
      if (total > 1) no.textContent = `pagina ${i + 1} van ${total}`;
      else no.parentElement.hidden = true;
    });
    return { total, clipped };
  }

  /* ---------------------------------------------------------------------------
     Renderen
     ------------------------------------------------------------------------- */

  let lastResult = { total: 1, clipped: false };

  function render() {
    lastResult = paginate(buildBlocks());
    el.typePill.textContent = TYPE_LABEL[state.type];
    el.pagePill.textContent = `${lastResult.total} ${lastResult.total === 1 ? 'pagina' : "pagina's"} · A4`;
    if (lastResult.clipped) PM.toast('Een blok is groter dan een hele pagina en wordt afgekapt. Maak het korter.', true);
    noteNearlyEmptyPage();
    syncSenderNudge();
    scalePreview();
  }

  // Een laatste pagina met maar een paar regels kost een vel papier en oogt
  // slordig; zeg het op tijd, met wat je eraan kunt doen
  function noteNearlyEmptyPage() {
    const pages = $$('.a4', el.sheets);
    const last = pages[pages.length - 1];
    let msg = '';
    if (pages.length > 1 && last) {
      const fill = $('.a4__flow', last).offsetHeight / $('.a4__body', last).clientHeight;
      if (fill < 0.2) {
        const fewer = pages.length - 1;
        const tip = state.type === 'offerte' && state.acceptBlock ? ', of zet het blok "voor akkoord" uit' : '';
        msg = `Pagina ${pages.length} bevat maar een paar regels. Kort de tekst iets in${tip}, dan past alles op ${fewer} ${fewer === 1 ? 'pagina' : "pagina's"}.`;
      }
    }
    el.docNote.hidden = !msg;
    el.docNote.textContent = msg;
  }
  const renderSoon = PM.debounce(render, 120);

  function scalePreview() {
    const style = getComputedStyle(el.stage);
    const avail = el.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const k = Math.min(1, Math.max(0.2, avail / PAGE_W));
    el.sheets.style.transform = `scale(${k})`;
    el.sheetsWrap.style.width = `${PAGE_W * k}px`;
    el.sheetsWrap.style.height = `${el.sheets.offsetHeight * k}px`;
  }
  if ('ResizeObserver' in window) new ResizeObserver(() => scalePreview()).observe(el.stage);
  else window.addEventListener('resize', scalePreview);

  function changed() {
    save();
    renderSoon();
  }

  /* ---------------------------------------------------------------------------
     Klik in de preview op een onderdeel en je staat in het juiste veld
     ------------------------------------------------------------------------- */

  function openSender() {
    el.senderPanel.open = true;
    const empty = $$('[data-sender]', el.senderPanel).find((i) => !i.value.trim());
    return empty || $('#sCompany');
  }

  const FIELD_TARGETS = {
    title: () => $('#dTitle'),
    recipient: () => $('#dRecipient'),
    date: () => $('#dDate'),
    quote: () => $('#dQuoteNo'),
    memo: () => $('#dMemoTo'),
    salutation: () => $('#dSalutation'),
    body: () => el.rte,
    items: () => $('[data-item-field="desc"]', el.itemRows) || $('#addItem'),
    accept: () => $('[data-bind="acceptBlock"]'),
    sign: () => (state.showSignature ? $('#dClosing') : $('[data-bind="showSignature"]')),
    sender: openSender,
  };

  function focusField(key) {
    const target = FIELD_TARGETS[key] && FIELD_TARGETS[key]();
    if (!target) return;
    const box = target.closest('.rte-wrap, .items, .switch, .field') || target;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    target.focus({ preventScroll: true });
    box.classList.remove('is-flash');
    void box.offsetWidth;  // animatie opnieuw starten
    box.classList.add('is-flash');
  }

  el.sheets.addEventListener('click', (e) => {
    const hit = e.target.closest('[data-field]');
    if (hit) focusField(hit.dataset.field);
  });

  /* --- Eenmalig: bedrijfsgegevens voor de voet van het briefpapier --- */

  const NUDGE_KEY = 'pm-document-sender-nudge';
  function syncSenderNudge() {
    const missing = !String(sender.street || '').trim() && !String(sender.kvk || '').trim() && !String(sender.email || '').trim();
    el.senderNudge.hidden = !missing || PM.store.get(NUDGE_KEY, false) === true;
  }
  $('#senderNudgeBtn').addEventListener('click', () => {
    const target = openSender();
    target.scrollIntoView({ block: 'center' });
    target.focus({ preventScroll: true });
  });
  $('#senderNudgeLater').addEventListener('click', () => {
    PM.store.set(NUDGE_KEY, true);
    el.senderNudge.hidden = true;
  });

  /* ---------------------------------------------------------------------------
     Velden
     ------------------------------------------------------------------------- */

  function syncVisibility() {
    for (const n of $$('[data-for]', el.editor)) n.hidden = !n.dataset.for.split(/\s+/).includes(state.type);
    for (const n of $$('[data-type-text]', el.editor)) {
      const map = Object.fromEntries(n.dataset.typeText.split('|').map((p) => p.split(':')));
      if (map[state.type]) n.textContent = map[state.type];
    }
    el.label.placeholder = TYPE_LABEL[state.type];
    el.signFields.hidden = !state.showSignature;
    // Stappen doornummeren, alleen de zichtbare
    $$('fieldset.block:not([hidden]) [data-step]', el.editor).forEach((badge, i) => {
      badge.textContent = String(i + 1);
    });
  }

  function syncInputs() {
    for (const input of $$('[data-bind]', el.editor)) {
      const value = state[input.dataset.bind];
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value == null ? '' : String(value);
    }
    for (const input of $$('[data-sender]', el.editor)) input.value = sender[input.dataset.sender] || '';
    $$('input[name="type"]').forEach((r) => { r.checked = r.value === state.type; });
    el.rte.innerHTML = state.body;
    renderItems();
    syncVisibility();
  }

  el.editor.addEventListener('submit', (e) => e.preventDefault());

  el.editor.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.bind) {
      state[t.dataset.bind] = t.type === 'checkbox' ? t.checked : t.value;
      if (t.type === 'checkbox') syncVisibility();
      changed();
    } else if (t.dataset.sender) {
      sender[t.dataset.sender] = t.value;
      syncSenderNudge();
      changed();
    } else if (t.dataset.itemField) {
      const item = state.items[Number(t.dataset.itemIndex)];
      if (!item) return;
      item[t.dataset.itemField] = t.dataset.itemField === 'desc' ? t.value : Number(t.value.replace(',', '.')) || 0;
      updateItemsTotal();
      changed();
    }
  });

  el.editor.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'type' && t.checked) {
      state.type = t.value;
      syncVisibility();
      changed();
    } else if (t.dataset.bind && (t.type === 'checkbox' || t.tagName === 'SELECT')) {
      state[t.dataset.bind] = t.type === 'checkbox' ? t.checked : t.value;
      syncVisibility();
      if (t.dataset.bind === 'vat') updateItemsTotal();
      changed();
    }
  });

  /* --- Offerteregels --- */

  function renderItems() {
    el.itemRows.innerHTML = state.items.map((it, i) => `
      <div class="item" role="row">
        <input class="input" role="cell" aria-label="Omschrijving regel ${i + 1}" data-item-index="${i}" data-item-field="desc" value="${esc(it.desc)}" maxlength="120" placeholder="Omschrijving">
        <input class="input" role="cell" aria-label="Aantal regel ${i + 1}" type="number" inputmode="decimal" step="any" min="0" data-item-index="${i}" data-item-field="qty" value="${esc(it.qty)}">
        <input class="input" role="cell" aria-label="Prijs regel ${i + 1}" type="number" inputmode="decimal" step="0.01" min="0" data-item-index="${i}" data-item-field="price" value="${esc(it.price)}">
        <button type="button" class="iconbtn" data-item-remove="${i}" aria-label="Regel ${i + 1} verwijderen">&times;</button>
      </div>`).join('');
    updateItemsTotal();
  }

  function updateItemsTotal() {
    const t = totals();
    el.itemsTotal.innerHTML = `subtotaal ${money.format(t.subtotal)} &middot; totaal incl. btw <b>${money.format(t.total)}</b>`;
  }

  $('#addItem').addEventListener('click', () => {
    state.items.push({ desc: '', qty: 1, price: 0 });
    renderItems();
    changed();
    const inputs = $$('[data-item-field="desc"]', el.itemRows);
    inputs[inputs.length - 1].focus();
  });

  // Bedragen zoals mensen ze typen of plakken: "€ 1.250,50", "1250.5", "950"
  function parseAmount(v) {
    let t = String(v || '').replace(/[€\s]/g, '');
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');   // 1.250,50
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');     // 1.250 (duizendtallen)
    else t = t.replace(/,/g, '');                                            // 1,250.00 of 1250.5
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }

  // Plakken uit Excel of Google Sheets in een omschrijving: omschrijving, (aantal,) prijs
  el.itemRows.addEventListener('paste', (e) => {
    const input = e.target;
    const text = e.clipboardData && e.clipboardData.getData('text/plain');
    if (!input.dataset || input.dataset.itemField !== 'desc' || !text || !/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return;
    e.preventDefault();
    const start = Number(input.dataset.itemIndex);
    const rows = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((l) => l.split('\t').map((c) => c.trim()));
    rows.forEach((cols, i) => {
      const item = state.items[start + i] || (state.items[start + i] = { desc: '', qty: 1, price: 0 });
      item.desc = cols[0] || '';
      if (cols.length >= 3) {
        item.qty = parseAmount(cols[1]) || 1;
        item.price = parseAmount(cols[2]);
      } else if (cols.length === 2) {
        item.qty = 1;
        item.price = parseAmount(cols[1]);
      }
    });
    renderItems();
    changed();
    PM.toast(`${rows.length} ${rows.length === 1 ? 'regel' : 'regels'} geplakt.`);
  });

  // Enter: naar hetzelfde veld een regel lager, en aan het eind een nieuwe regel
  el.itemRows.addEventListener('keydown', (e) => {
    const input = e.target;
    if (e.key !== 'Enter' || !input.dataset || !input.dataset.itemField) return;
    e.preventDefault();
    const i = Number(input.dataset.itemIndex);
    if (i === state.items.length - 1) {
      state.items.push({ desc: '', qty: 1, price: 0 });
      renderItems();
      changed();
      $$('[data-item-field="desc"]', el.itemRows)[i + 1].focus();
    } else {
      $(`[data-item-index="${i + 1}"][data-item-field="${input.dataset.itemField}"]`, el.itemRows).focus();
    }
  });

  el.itemRows.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-item-remove]');
    if (!btn) return;
    state.items.splice(Number(btn.dataset.itemRemove), 1);
    renderItems();
    changed();
  });

  /* --- Teksteditor --- */

  try {
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch (err) {
    /* oudere browsers: dan <div>, die sanitize() omzet naar <p> */
  }

  const saveBody = PM.debounce(() => {
    state.body = sanitize(el.rte.innerHTML);
    changed();
  }, 150);
  el.rte.addEventListener('input', saveBody);

  el.rte.addEventListener('focus', () => {
    if (!el.rte.innerHTML.trim()) el.rte.innerHTML = '<p><br></p>';
  });

  // Plakken: alleen toegestane opmaak blijft over
  el.rte.addEventListener('paste', (e) => {
    const data = e.clipboardData;
    if (!data) return;
    e.preventDefault();
    const html = data.getData('text/html');
    let insert;
    if (html) {
      insert = sanitize(html);
    } else {
      const text = data.getData('text/plain');
      insert = text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    }
    document.execCommand('insertHTML', false, insert);
  });

  // Knoppen houden de selectie vast (mousedown) en voeren dan het commando uit
  el.rteBar.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });
  el.rteBar.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    el.rte.focus();
    if (btn.dataset.block) {
      const currentBlock = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
      const target = currentBlock === btn.dataset.block && btn.dataset.block !== 'p' ? 'p' : btn.dataset.block;
      document.execCommand('formatBlock', false, `<${target}>`);
    } else {
      document.execCommand(btn.dataset.cmd, false, null);
    }
    updateToolbar();
    saveBody();
  });

  function updateToolbar() {
    const sel = document.getSelection();
    if (!sel || !sel.anchorNode || !el.rte.contains(sel.anchorNode)) return;
    let blockValue = '';
    try {
      blockValue = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch (err) {
      /* niets */
    }
    for (const btn of $$('button', el.rteBar)) {
      let active = false;
      try {
        if (btn.dataset.cmd && btn.dataset.cmd !== 'removeFormat') active = document.queryCommandState(btn.dataset.cmd);
      } catch (err) {
        active = false;
      }
      if (btn.dataset.block) active = blockValue === btn.dataset.block && btn.dataset.block !== 'p';
      btn.classList.toggle('is-active', !!active);
    }
  }
  document.addEventListener('selectionchange', updateToolbar);

  /* --- Handtekening --- */

  async function setSignature(file, persist = true) {
    try {
      const { img, url } = await PM.readImage(file);
      if (signature) URL.revokeObjectURL(signature.url);
      signature = { url, name: file.name || 'handtekening', width: img.naturalWidth };
      el.sigName.textContent = signature.name;
      el.sigThumb.style.backgroundImage = `url("${url}")`;
      el.sigBtn.classList.add('has-file');
      el.sigClear.hidden = false;
      if (persist) PM.idb.set(SIG_KEY, file);
      render();
    } catch (err) {
      PM.toast(err.message, true);
    }
  }

  el.sigBtn.addEventListener('click', () => el.sigInput.click());
  PM.bindDrop(el.sigBtn, (file) => setSignature(file));
  el.sigInput.addEventListener('change', () => {
    const file = el.sigInput.files[0];
    el.sigInput.value = '';
    if (file) setSignature(file);
  });
  el.sigClear.addEventListener('click', () => {
    if (signature) URL.revokeObjectURL(signature.url);
    signature = null;
    el.sigName.textContent = 'handtekening kiezen';
    el.sigThumb.style.backgroundImage = '';
    el.sigBtn.classList.remove('has-file');
    el.sigClear.hidden = true;
    PM.idb.del(SIG_KEY);
    render();
  });

  /* ---------------------------------------------------------------------------
     3. Export
     ------------------------------------------------------------------------- */

  function imagesReady(root) {
    return Promise.all($$('img', root).map((img) => (img.complete ? Promise.resolve() : new Promise((r) => {
      img.onload = r;
      img.onerror = r;
    }))));
  }

  function fileName(ext = 'pdf') {
    return `pureminds-${state.type}-${PM.slug(state.title) || 'document'}.${ext}`;
  }

  // Bewerkbare vector-PDF: de pagina's worden ongeschaald gekloond (de preview
  // is verkleind) en door js/document/pdf.js opnieuw opgebouwd in jsPDF
  async function exportPdf(progress) {
    await PM.fontsReady;
    render();
    const host = node('div', 'a4-export');
    document.body.appendChild(host);
    try {
      const pages = $$('.a4', el.sheets).map((page) => host.appendChild(page.cloneNode(true)));
      await imagesReady(host);
      const blob = await window.PMDocPdf.exportPages(pages, {
        title: state.title.trim() || TYPE_LABEL[state.type],
        subject: TYPE_LABEL[state.type],
        author: sender.company || 'Pure Minds',
      }, (i, total) => progress(`pagina ${i + 1} van ${total}…`));
      const name = fileName();
      PM.saveBlob(blob, name);
      PM.toast(`Gedownload: ${name}`);
      return 'pdf gedownload';
    } finally {
      host.remove();
    }
  }

  const downloadPdf = () => PM.run(el.pdfBtn, 'pdf maken…', exportPdf);
  el.pdfBtn.addEventListener('click', downloadPdf);

  // Word: alles wat js/document/docx.js nodig heeft, al opgemaakt (datums,
  // bedragen) en met de tekst als opgeschoonde HTML
  function docxModel() {
    const d = state;
    const t = totals();
    const q = (v) => Number(v) || 0;
    return {
      type: d.type,
      typeLabel: TYPE_LABEL[d.type],
      label: d.label.trim() || TYPE_LABEL[d.type],
      title: d.title.trim(),
      date: longDate(d.date),
      recipient: lines(d.recipient),
      reference: d.reference.trim(),
      salutation: d.salutation.trim(),
      quoteNumber: d.quoteNumber.trim(),
      validUntil: longDate(d.validUntil),
      memoTo: d.memoTo.trim(),
      memoFrom: d.memoFrom.trim(),
      memoCc: d.memoCc.trim(),
      bodyHtml: sanitize(d.body),
      items: d.type === 'offerte' && t.rows.length ? {
        rows: t.rows.map((it) => ({ desc: it.desc, qty: number.format(q(it.qty)), price: money.format(q(it.price)), total: money.format(q(it.qty) * q(it.price)) })),
        subtotal: money.format(t.subtotal), vatRate: t.vatRate, vat: money.format(t.vat), total: money.format(t.total),
      } : null,
      acceptBlock: d.type === 'offerte' && d.acceptBlock,
      sign: d.showSignature ? {
        closing: d.closing.trim(),
        name: d.signName.trim(),
        role: [d.signRole.trim(), sender.company.trim()].filter(Boolean).join(' · '),
        image: signature ? signature.url : null,
      } : null,
      sender: { ...sender },
      running: d.title.trim() || TYPE_LABEL[d.type],
      pattern: PATTERN_SVG,
      logo: PM.brandSvg('logoBlack'),
      hexPath: HEX_PATH,
    };
  }

  async function exportDocx() {
    await PM.fontsReady;
    const blob = await window.PMDocDocx.build(docxModel());
    const name = fileName('docx');
    PM.saveBlob(blob, name);
    PM.toast(`Gedownload: ${name}`);
    return 'word gedownload';
  }
  el.docxBtn.addEventListener('click', () => PM.run(el.docxBtn, 'word maken…', exportDocx));

  // Afdrukken: kopie van de pagina's in #printRoot; de print-CSS toont alleen die
  function preparePrint() {
    el.printRoot.innerHTML = '';
    for (const page of $$('.a4', el.sheets)) el.printRoot.appendChild(page.cloneNode(true));
  }
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', () => { el.printRoot.innerHTML = ''; });
  el.printBtn.addEventListener('click', () => {
    render();
    preparePrint();
    window.print();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      downloadPdf();
    }
  });

  // Nieuw document: meteen beginnen, met "ongedaan maken" in de melding in
  // plaats van een vraag vooraf (je briefpapier en naam blijven staan)
  $('#resetBtn').addEventListener('click', () => {
    const before = JSON.parse(JSON.stringify(state));
    const keep = { type: state.type, signName: state.signName, signRole: state.signRole };
    state = {
      ...defaults(), ...keep, title: '', recipient: '', reference: '', salutation: '', memoTo: '', memoFrom: '', memoCc: '',
      body: '', items: [{ desc: '', qty: 1, price: 0 }],
    };
    syncInputs();
    save();
    render();
    PM.toast('Nieuw, leeg document gestart.', false, {
      label: 'ongedaan maken',
      run: () => {
        state = before;
        syncInputs();
        save();
        render();
      },
    });
  });

  /* ---------------------------------------------------------------------------
     Start
     ------------------------------------------------------------------------- */

  PM.preventStrayDrops();
  syncInputs();
  syncSenderNudge();
  render();
  PM.fontsReady.then(render);
  // Handtekening uit een vorige sessie terugzetten
  PM.idb.get(SIG_KEY).then((file) => {
    if (file instanceof Blob) setSignature(file, false);
  });
})();
