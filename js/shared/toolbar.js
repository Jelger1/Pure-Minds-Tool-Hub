/* =============================================================================
   toolbar.js — een tekstwerkbalk zoals in Word, boven het ontwerp
   -----------------------------------------------------------------------------
   De werkbalk verschijnt zodra je in een tekstveld staat dat meedoet, en toont
   alleen wat bij dat veld mag. Een veld doet mee met data-toolbar:

     <textarea id="kop" data-toolbar="nadruk grootte uitlijnen"
               data-toolbar-align="links midden"></textarea>
     <div contenteditable="true" data-toolbar="stijl vet cursief opsomming"></div>

   Opdrachten
     nadruk        **woord** in cyaan (PM.toggleEmphasis uit core.js, of het richfield)
     vet           gewone velden: **woord** (carousel); contenteditable: vet
     cursief, onderstreept, opsomming, nummering, wissen   (contenteditable)
     stijl         alinea, kop, tussenkop, citaat (contenteditable; data-toolbar-blocks)
     invoegen      invulplekken: data-toolbar-insert="{klant} {diensten}"
     grootte       typeschaal uit PM.brand (klein, normaal, groot; data-toolbar-sizes)
     uitlijnen     alleen wat de tool toestaat (data-toolbar-align, standaard links midden)

   Grootte en uitlijning horen bij de tool: de werkbalk zet data-size of
   data-align op het veld en stuurt een 'pm:format'-event { cmd, value }.
   Of geef options.value(veld, cmd) en options.apply(veld, cmd, waarde).
   Na elke opdracht: een 'pm:toolbar'-event { cmd, value } op het veld en
   PM.tour.signal('<opdracht>') en PM.tour.signal('opmaak') voor de rondleiding.
   options.field: een vast veld (zoals de tekst van een document); dan blijft
   de werkbalk staan, ook als je ergens anders klikt, net als in Word.

     const tb = PM.toolbar(el, { value, apply, commands, field })
     tb.attach(veld), tb.detach(), tb.refresh(), tb.field

   Toetsen: Ctrl + B, I, U (waar het mag), Alt + F10 naar de werkbalk, Esc terug
   naar het veld, pijltjes binnen de werkbalk. Onder de 1024 px staat de
   werkbalk bovenin het blad (.panels), boven de velden; options.sheet: false
   houdt hem op zijn plek.
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Zonder DOM (getest in tests/toolbar.test.js)
     ------------------------------------------------------------------------- */

  const ALIGNS = ['links', 'midden', 'rechts'];
  const BLOCKS = [
    { id: 'p', label: 'alinea' },
    { id: 'h2', label: 'kop' },
    { id: 'h3', label: 'tussenkop' },
    { id: 'blockquote', label: 'citaat' },
  ];

  const words = (value) => String(value || '').trim().split(/\s+/).filter(Boolean);

  // "nadruk grootte nadruk" -> ['nadruk', 'grootte']
  function parseCommands(value) {
    return Array.from(new Set(words(value).map((w) => w.toLowerCase())));
  }

  // "{klant} {diensten}" -> [{ token: '{klant}', label: '+ klant' }, …]
  function parseInserts(value) {
    return words(value).filter((t) => /^\{[^{}]+\}$/.test(t)).map((token) => ({ token, label: `+ ${token.slice(1, -1)}` }));
  }

  function parseAligns(value) {
    const list = words(value).map((w) => w.toLowerCase()).filter((w) => ALIGNS.includes(w));
    return list.length ? ALIGNS.filter((a) => list.includes(a)) : ['links', 'midden'];
  }

  function parseBlocks(value) {
    const list = words(value).map((w) => w.toLowerCase());
    return list.length ? BLOCKS.filter((b) => list.includes(b.id)) : BLOCKS.slice();
  }

  // formatBlock geeft per browser 'h2', '<h2>', 'div' of ''; alles wat geen stijl is wordt een alinea
  function normBlock(value) {
    const v = String(value || '').toLowerCase().replace(/[<>]/g, '');
    return BLOCKS.some((b) => b.id === v) ? v : 'p';
  }

  /**
   * Staat de cursor of selectie binnen **nadruk**? Ook als de selectie de
   * sterretjes zelf omvat ("**woord**" helemaal geselecteerd).
   */
  function emphasisAt(value, start, end = start) {
    const re = /\*\*([^*\n]+?)\*\*/g;
    let m;
    while ((m = re.exec(String(value || '')))) {
      const open = m.index;
      const close = open + m[0].length;
      if (start >= open + 2 && end <= close - 2) return true;
      if (start === open && end === close) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------------------
     Iconen (Remix, assets/icons/Editor)
     ------------------------------------------------------------------------- */

  const PATHS = {
    bold: 'M8 11H12.5C13.8807 11 15 9.88071 15 8.5C15 7.11929 13.8807 6 12.5 6H8V11ZM18 15.5C18 17.9853 15.9853 20 13.5 20H6V4H12.5C14.9853 4 17 6.01472 17 8.5C17 9.70431 16.5269 10.7981 15.7564 11.6058C17.0979 12.3847 18 13.837 18 15.5ZM8 13V18H13.5C14.8807 18 16 16.8807 16 15.5C16 14.1193 14.8807 13 13.5 13H8Z',
    italic: 'M15 20H7V18H9.92661L12.0425 6H9V4H17V6H14.0734L11.9575 18H15V20Z',
    underline: 'M8 3V12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12V3H18V12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12V3H8ZM4 20H20V22H4V20Z',
    links: 'M3 4H21V6H3V4ZM3 19H17V21H3V19ZM3 14H21V16H3V14ZM3 9H17V11H3V9Z',
    midden: 'M3 4H21V6H3V4ZM5 19H19V21H5V19ZM3 14H21V16H3V14ZM5 9H19V11H5V9Z',
    rechts: 'M3 4H21V6H3V4ZM7 19H21V21H7V19ZM3 14H21V16H3V14ZM7 9H21V11H7V9Z',
    listUl: 'M8 4H21V6H8V4ZM4.5 6.5C3.67157 6.5 3 5.82843 3 5C3 4.17157 3.67157 3.5 4.5 3.5C5.32843 3.5 6 4.17157 6 5C6 5.82843 5.32843 6.5 4.5 6.5ZM4.5 13.5C3.67157 13.5 3 12.8284 3 12C3 11.1716 3.67157 10.5 4.5 10.5C5.32843 10.5 6 11.1716 6 12C6 12.8284 5.32843 13.5 4.5 13.5ZM4.5 20.4C3.67157 20.4 3 19.7284 3 18.9C3 18.0716 3.67157 17.4 4.5 17.4C5.32843 17.4 6 18.0716 6 18.9C6 19.7284 5.32843 20.4 4.5 20.4ZM8 11H21V13H8V11ZM8 18H21V20H8V18Z',
    listOl: 'M8 4H21V6H8V4ZM5 3V6H6V7H3V6H4V4H3V3H5ZM3 14V11.5H5V11H3V10H6V12.5H4V13H6V14H3ZM5 19.5H3V18.5H5V18H3V17H6V21H3V20H5V19.5ZM8 11H21V13H8V11ZM8 18H21V20H8V18Z',
    clear: 'M12.6512 14.0654L11.6047 20H9.57389L10.9247 12.339L3.51465 4.92892L4.92886 3.51471L20.4852 19.0711L19.071 20.4853L12.6512 14.0654ZM11.7727 7.53009L12.0425 5.99999H10.2426L8.24257 3.99999H19.9999V5.99999H14.0733L13.4991 9.25652L11.7727 7.53009Z',
    size: 'M10 6V21H8V6H2V4H16V6H10ZM18 14V21H16V14H13V12H21V14H18Z',
  };
  const icon = (name) => `<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`;

  // Wat elke opdracht is. plain: in een gewoon tekstveld; rich: in contenteditable (execCommand)
  const COMMANDS = {
    nadruk: { group: 'teken', plain: 'emph', text: 'cyaan', hex: true, aria: 'Nadruk in cyaan', tip: 'Nadruk in cyaan', key: 'b' },
    vet: { group: 'teken', plain: 'emph', rich: 'bold', icon: 'bold', aria: 'Vet', tip: 'Vet', key: 'b' },
    cursief: { group: 'teken', rich: 'italic', icon: 'italic', aria: 'Cursief', tip: 'Cursief', key: 'i' },
    onderstreept: { group: 'teken', rich: 'underline', icon: 'underline', aria: 'Onderstrepen', tip: 'Onderstrepen', key: 'u' },
    stijl: { group: 'blok', rich: 'formatBlock', select: true, aria: 'Stijl van de alinea' },
    opsomming: { group: 'lijst', rich: 'insertUnorderedList', icon: 'listUl', aria: 'Opsomming', tip: 'Opsomming' },
    nummering: { group: 'lijst', rich: 'insertOrderedList', icon: 'listOl', aria: 'Genummerde lijst', tip: 'Genummerde lijst' },
    invoegen: { group: 'invoeg', plain: 'insert' },
    grootte: { group: 'maat', plain: 'tool', rich: 'tool', select: true, aria: 'Tekstgrootte' },
    uitlijnen: { group: 'uitlijn', plain: 'tool', rich: 'tool' },
    wissen: { group: 'wis', rich: 'removeFormat', icon: 'clear', aria: 'Opmaak wissen', tip: 'Opmaak wissen' },
  };

  /* ---------------------------------------------------------------------------
     Browser
     ------------------------------------------------------------------------- */

  let uid = 0;

  // Het richfield van een veld (js/shared/richfield.js), of null
  const richOf = (f) => (global.PM && global.PM.richfield && global.PM.richfield.of(f)) || null;

  /**
   * Nadruk en invulplekken op de **markup** van een veld: in een gewoon
   * tekstveld met PM.toggleEmphasis en PM.insertAtCaret uit core.js (dezelfde
   * logica als de oude knoppen), in een richfield doet het veld het zelf.
   */
  function markupAction(field, action, value) {
    const rf = richOf(field);
    if (rf) return action === 'emph' ? rf.toggleEmphasis() : rf.insert(value);
    return action === 'emph' ? global.PM.toggleEmphasis(field) : global.PM.insertAtCaret(field, value);
  }

  function execRich(cmd, value = null) {
    try {
      return global.document.execCommand(cmd, false, value);
    } catch (err) {
      return false;
    }
  }
  function queryRich(cmd) {
    try {
      return global.document.queryCommandState(cmd);
    } catch (err) {
      return false;
    }
  }

  function toolbar(el, options = {}) {
    const doc = global.document;
    const PM = global.PM || {};
    const isMac = /Mac|iPhone|iPad/.test((global.navigator && (global.navigator.platform || global.navigator.userAgent)) || '');
    const mod = isMac ? '⌘' : 'Ctrl + ';
    const custom = options.commands || {};
    let field = null;
    let savedRange = null;
    const home = typeof options.field === 'string' ? doc.querySelector(options.field) : options.field || null;
    let items = [];
    let rov = 0;

    el.classList.add('tbar');
    el.setAttribute('role', 'toolbar');
    el.hidden = true;

    // Smal scherm: de werkbalk bovenin het blad, vlak boven de velden, zodat het
    // ontwerp boven het blad zo groot mogelijk blijft (options.sheet: false = niet)
    const narrow = global.matchMedia('(max-width: 1023px)');
    const slot = el.parentNode;
    const app = el.closest('.app');
    const sheet = options.sheet === false ? null : options.sheet || (app && app.querySelector('.panels'));
    function dock() {
      if (!sheet || !slot) return;
      const inSheet = narrow.matches;
      if (inSheet && el.parentNode !== sheet) sheet.prepend(el);
      else if (!inSheet && el.parentNode !== slot) slot.appendChild(el);
      el.classList.toggle('tbar--sheet', inSheet);
    }
    narrow.addEventListener('change', dock);
    dock();
    if (home) global.setTimeout(() => { if (!field) attach(home); }, 0);

    // Echte opmaak (execCommand) alleen in contenteditable zonder richfield; een richfield werkt met **markup**
    const isRich = (f) => !!(f && f.isContentEditable) && !richOf(f);
    const def = (cmd) => custom[cmd] || COMMANDS[cmd];
    const supports = (cmd, f) => {
      const d = def(cmd);
      if (!d) return false;
      if (custom[cmd]) return isRich(f) ? d.rich !== false : d.plain !== false;
      return isRich(f) ? !!d.rich : !!d.plain;
    };
    const commandsOf = (f) => parseCommands(f.dataset.toolbar).filter((c) => supports(c, f));
    const has = (cmd) => !!field && commandsOf(field).includes(cmd);

    function fieldLabel(f) {
      if (f.dataset.toolbarLabel) return f.dataset.toolbarLabel;
      const rf = richOf(f);
      const src = rf ? rf.source : f;
      const lab = src.id && doc.querySelector(`label[for="${src.id}"]`);
      if (lab) {
        // Alleen de eigen tekst van het label, niet de hint in <i>
        const own = Array.from(lab.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
        if (own) return own;
      }
      return f.getAttribute('aria-label') || 'tekst';
    }

    /* --- Tekenen --- */

    function button({ cmd, value = '', html, aria, tip, key, pressed = true }) {
      const keys = key ? ` · ${mod}${key.toUpperCase()}` : '';
      return `<button type="button" class="tbar__btn${html && !/^<svg/.test(html) ? ' tbar__btn--text' : ''}" data-cmd="${cmd}"${value ? ` data-value="${esc(value)}"` : ''}`
        + ` aria-label="${esc(aria)}"${pressed ? ' aria-pressed="false"' : ''}${key ? ` aria-keyshortcuts="${isMac ? 'Meta' : 'Control'}+${key.toUpperCase()}"` : ''}`
        + `${tip ? ` data-tip="${esc(tip + keys)}"` : ''} tabindex="-1">${html}</button>`;
    }

    function controls(cmd, f) {
      const d = def(cmd);
      if (custom[cmd]) {
        return button({ cmd, html: d.icon || esc(d.label || cmd), aria: d.aria || d.label || cmd, tip: d.tip || d.aria, key: d.key, pressed: !!d.active });
      }
      switch (cmd) {
        case 'nadruk':
          return button({ cmd, html: '<span class="tbar__hex" aria-hidden="true"></span>cyaan', aria: d.aria, tip: d.tip, key: 'b' });
        case 'invoegen':
          return parseInserts(f.dataset.toolbarInsert).map((ins) => button({ cmd, value: ins.token, html: esc(ins.label), aria: `${ins.label.slice(2)} invoegen`, tip: `Zet ${ins.token} op de plek van de cursor`, pressed: false })).join('');
        case 'uitlijnen':
          return parseAligns(f.dataset.toolbarAlign).map((a) => button({ cmd, value: a, html: icon(a), aria: `Uitlijnen: ${a}`, tip: `Uitlijnen: ${a}` })).join('');
        case 'grootte': {
          const sizes = (PM.brand && PM.brand.SIZES) || [{ id: 'klein', label: 'klein' }, { id: 'normaal', label: 'normaal' }, { id: 'groot', label: 'groot' }];
          const allowed = parseCommands(f.dataset.toolbarSizes);
          const list = allowed.length ? sizes.filter((s) => allowed.includes(s.id)) : sizes;
          return `<span class="tbar__field" data-tip="Tekstgrootte, in de maten van de huisstijl">${icon('size')}<select class="tbar__select" data-cmd="grootte" aria-label="${d.aria}" tabindex="-1">${list.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select></span>`;
        }
        case 'stijl':
          return `<span class="tbar__field" data-tip="Stijl van de alinea"><select class="tbar__select tbar__select--wide" data-cmd="stijl" aria-label="${d.aria}" tabindex="-1">${parseBlocks(f.dataset.toolbarBlocks).map((b) => `<option value="${b.id}">${b.label}</option>`).join('')}</select></span>`;
        default:
          return button({ cmd, html: icon(d.icon), aria: d.aria, tip: d.tip, key: d.key, pressed: cmd !== 'wissen' });
      }
    }

    function render(f) {
      const name = fieldLabel(f);
      let group = null;
      const parts = [`<span class="tbar__label" aria-hidden="true">${esc(name)}</span>`];
      for (const cmd of commandsOf(f)) {
        const g = def(cmd).group || cmd;
        if (group && g !== group) parts.push('<span class="tbar__sep" aria-hidden="true"></span>');
        parts.push(controls(cmd, f));
        group = g;
      }
      el.innerHTML = parts.join('');
      el.setAttribute('aria-label', `Opmaak van ${name.toLowerCase()}`);
      if (!f.id) f.id = `pm-tb-veld-${++uid}`;
      el.setAttribute('aria-controls', f.id);
      items = Array.from(el.querySelectorAll('.tbar__btn, .tbar__select'));
      rov = 0;
      syncRoving();
    }

    function syncRoving() {
      items.forEach((item, i) => { item.tabIndex = i === rov ? 0 : -1; });
    }

    /* --- Staat van de knoppen --- */

    function currentValue(cmd) {
      const v = options.value ? options.value(field, cmd) : null;
      if (v != null) return v;
      if (cmd === 'grootte') return field.dataset.size || 'normaal';
      if (cmd === 'uitlijnen') return field.dataset.align || parseAligns(field.dataset.toolbarAlign)[0];
      return null;
    }

    function refresh() {
      if (!field) return;
      const rich = isRich(field);
      for (const item of items) {
        const cmd = item.dataset.cmd;
        const d = def(cmd);
        let on = null;
        if (custom[cmd]) on = d.active ? !!d.active(field) : null;
        else if (cmd === 'grootte' || cmd === 'stijl') {
          item.value = cmd === 'stijl' ? (rich ? blockNow() : 'p') : currentValue(cmd);
          continue;
        } else if (cmd === 'uitlijnen') on = currentValue(cmd) === item.dataset.value;
        else if (cmd === 'invoegen' || cmd === 'wissen') continue;
        else if (rich) on = d.rich ? queryRich(d.rich) : false;
        else if (d.plain === 'emph') on = richOf(field) ? richOf(field).emphasisAt() : emphasisAt(field.value, field.selectionStart, field.selectionEnd);
        if (on != null) item.setAttribute('aria-pressed', String(!!on));
      }
    }

    function blockNow() {
      try {
        return normBlock(doc.queryCommandValue('formatBlock'));
      } catch (err) {
        return 'p';
      }
    }

    /* --- Uitvoeren --- */

    function restoreSelection() {
      if (!field) return;
      field.focus({ preventScroll: true });
      if (isRich(field) && savedRange) {
        const sel = doc.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }

    function run(cmd, value) {
      if (!field || !has(cmd)) return;
      const d = def(cmd);
      const f = field;
      if (custom[cmd]) {
        d.run(f, api, value);
      } else if (d.plain === 'tool' || d.rich === 'tool') {
        if (options.apply) options.apply(f, cmd, value);
        else {
          if (cmd === 'grootte') f.dataset.size = value;
          if (cmd === 'uitlijnen') f.dataset.align = value;
        }
        f.dispatchEvent(new CustomEvent('pm:format', { bubbles: true, detail: { cmd, value } }));
      } else if (isRich(f)) {
        restoreSelection();
        if (cmd === 'stijl') {
          // In een lijst: eerst uit de lijst halen (zoals Word), anders komt de kop in de lijst te staan
          const sel = doc.getSelection();
          const node = sel && sel.anchorNode;
          const li = node && (node.nodeType === 1 ? node : node.parentElement).closest('li');
          if (li && f.contains(li)) execRich(li.parentElement.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
          execRich('formatBlock', `<${normBlock(value)}>`);
          // Chrome zet bij het omzetten inline stijlen (font-size) neer: die horen niet bij de huisstijl
          const now = sel && sel.anchorNode;
          const block = now && (now.nodeType === 1 ? now : now.parentElement).closest('p, h2, h3, blockquote');
          if (block && f.contains(block)) block.querySelectorAll('[style]').forEach((n) => n.removeAttribute('style'));
        } else execRich(d.rich);
      } else {
        markupAction(f, d.plain, value);
      }
      refresh();
      f.dispatchEvent(new CustomEvent('pm:toolbar', { bubbles: true, detail: { cmd, value } }));
      // Rondleiding: een doe-stap kan wachten op deze opdracht ('nadruk') of op opmaak in het algemeen
      if (PM.tour && PM.tour.isActive && !PM.tour.signal(cmd)) PM.tour.signal('opmaak');
    }

    function focusToolbar() {
      if (el.hidden || !items.length) return;
      syncRoving();
      items[rov].focus();
    }

    // Terug naar het veld, met de selectie waar hij was
    function backToField() {
      if (!field) return;
      restoreSelection();
    }

    /* --- Koppelen aan het actieve veld --- */

    function attach(f) {
      if (!f || !f.dataset || f.dataset.toolbar == null) return;
      if (f !== field) {
        field = f;
        savedRange = null;
        render(f);
      }
      el.hidden = false;
      el.classList.add('is-active');
      refresh();
      syncLift();
    }

    // Zonder actief veld: terug naar het vaste veld (options.field), of weg
    function detach() {
      if (home && home.isConnected) {
        if (field !== home) attach(home);
        return;
      }
      field = null;
      savedRange = null;
      el.hidden = true;
      el.classList.remove('is-active');
      syncLift();
    }

    // Tijdens de rondleiding boven de dimlaag, als het veld het uitgelichte deel is;
    // staat het veld niet meer in beeld (ander paneel), dan verdwijnt de werkbalk
    function syncLift() {
      if (field && field !== home && !field.getClientRects().length) {
        detach();
        return;
      }
      const lift = !!field && doc.documentElement.classList.contains('is-touring') && !!field.closest('.is-tour-target');
      el.classList.toggle('is-lifted', lift);
    }
    doc.addEventListener('pm:tour', syncLift);

    const fieldOf = (t) => (t && t.closest ? t.closest('[data-toolbar]') : null);
    const keeps = (t) => !!(t && t.closest && (el.contains(t) || t.closest('[data-toolbar-keep], .help, .helptip, .tour, .tour-pane')));

    /*
     * Weghalen pas als een tik of klik is aangekomen. Op mobiel staat de werkbalk
     * bovenin het blad: verdwijnt hij tijdens de tik (bij focus of pointerdown),
     * dan schuift alles eronder omhoog en landt de tik op iets anders. Dus: een
     * tik die buiten het veld begint wordt onthouden en de werkbalk gaat pas weg
     * nadat de klik is afgehandeld. Scrollen (pointercancel) laat hem staan; met
     * het toetsenbord (Tab) gaat hij meteen weg, daar is geen vinger.
     */
    let gesture = null;
    const settle = () => {
      const a = doc.activeElement;
      if (field && !(fieldOf(a) || keeps(a))) detach();
    };
    const endGesture = (after) => {
      if (!gesture) return;
      clearTimeout(gesture.timer);
      gesture = null;
      if (after) global.setTimeout(settle, 0);   // na alle klik-handlers
    };

    doc.addEventListener('pointerdown', (e) => {
      endGesture(false);
      if (!field) return;
      const t = e.target;
      if (field.contains(t) || fieldOf(t) || keeps(t)) return;
      gesture = { timer: 0 };
    });
    // Geen klik gekomen (lang ingedrukt, weggeschoven): kort na het loslaten toch opruimen
    doc.addEventListener('pointerup', () => {
      if (gesture) gesture.timer = global.setTimeout(() => endGesture(true), 400);
    });
    doc.addEventListener('pointercancel', () => endGesture(false));
    doc.addEventListener('click', () => endGesture(true), true);

    doc.addEventListener('focusin', (e) => {
      const f = fieldOf(e.target);
      if (f && f !== el) attach(f);
      else if (!keeps(e.target) && !gesture) detach();
    });

    // Knoppen houden de selectie in het veld vast; een keuzelijst moet wel focus krijgen
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tbar__btn')) e.preventDefault();
    });
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.tbar__btn');
      if (!btn) return;
      rov = Math.max(0, items.indexOf(btn));
      syncRoving();
      // Tekstopmaak zet de focus terug in het veld (zoals Word); grootte en uitlijnen laten hem hier
      run(btn.dataset.cmd, btn.dataset.value || '');
    });
    el.addEventListener('change', (e) => {
      const sel = e.target.closest('.tbar__select');
      if (!sel) return;
      rov = Math.max(0, items.indexOf(sel));
      run(sel.dataset.cmd, sel.value);
      if (sel.dataset.cmd === 'stijl') backToField();
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        backToField();
        return;
      }
      const i = items.indexOf(doc.activeElement);
      if (i < 0) return;
      const onSelect = items[i].tagName === 'SELECT';
      if (onSelect && !/^Arrow(Left|Right)$/.test(e.key)) return;   // pijl omhoog/omlaag kiest een optie
      const next = (PM.rovingIndex || ((c, n, k) => (k === 'ArrowRight' ? (c + 1) % n : k === 'ArrowLeft' ? (c - 1 + n) % n : -1)))(i, items.length, e.key === 'ArrowUp' || e.key === 'ArrowDown' ? '' : e.key);
      if (next < 0) return;
      e.preventDefault();
      rov = next;
      syncRoving();
      items[next].focus();
    });

    // Sneltoetsen in het veld
    doc.addEventListener('keydown', (e) => {
      if (!field || e.defaultPrevented) return;
      const inField = e.target === field || (isRich(field) && field.contains(e.target));
      if (!inField) return;
      if (e.altKey && e.key === 'F10') {
        e.preventDefault();
        focusToolbar();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = String(e.key || '').toLowerCase();
      if (!['b', 'i', 'u'].includes(key)) return;
      const cmd = key === 'b' ? (has('vet') ? 'vet' : has('nadruk') ? 'nadruk' : null) : key === 'i' ? (has('cursief') ? 'cursief' : null) : has('onderstreept') ? 'onderstreept' : null;
      // In contenteditable ook blokkeren als het hier niet mag: de huisstijl bepaalt de opmaak
      if (cmd || isRich(field)) e.preventDefault();
      if (cmd) run(cmd);
    });

    // Staat bijwerken bij elke verplaatsing van de cursor
    doc.addEventListener('selectionchange', () => {
      if (!field) return;
      if (isRich(field)) {
        const sel = doc.getSelection();
        if (sel && sel.rangeCount && field.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
        else return;
      } else if (doc.activeElement !== field) return;
      refresh();
    });
    doc.addEventListener('input', (e) => { if (field && fieldOf(e.target) === field) refresh(); });

    const api = {
      el,
      attach,
      detach,
      refresh,
      run,
      focus: focusToolbar,
      get field() { return field; },
    };
    return api;
  }

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const pure = { parseCommands, parseInserts, parseAligns, parseBlocks, normBlock, emphasisAt, COMMANDS, BLOCKS, ALIGNS };

  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (global && global.document) {
    const PM = global.PM = global.PM || {};
    PM.toolbar = Object.assign(toolbar, pure);
  }
})(typeof window !== 'undefined' ? window : globalThis);
