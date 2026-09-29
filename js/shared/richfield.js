/* =============================================================================
   richfield.js — tekstvelden die nadruk en invulplekken laten zien zoals ze zijn
   -----------------------------------------------------------------------------
   In de makers staat nadruk als **woord** en een invulplek als {klant} in de
   tekst. Een richfield toont dat zoals het bedoeld is: nadruk in cyaan (of
   vet), een invulplek als een vast blokje. Onder de motorkap blijft het
   gewone <textarea> of <input> de bron: het richfield schrijft er exact
   dezelfde markup in terug en stuurt een 'input'-event, dus templates,
   concepten en exports veranderen niet.

     <textarea id="kop" data-rich="nadruk" maxlength="200"></textarea>
     <textarea id="zin" data-rich="nadruk" data-chips="{klant} {diensten}"></textarea>
     <textarea id="tekst" data-rich="vet"></textarea>          (** = vet, zoals in een carousel)

     PM.richfield.init(root)        elk [data-rich] in root verbeteren
     PM.richfield(bron, opties)     één veld; opties: { mode, chips, multiline }
     PM.richfield.of(el)            het richfield van een bron of editor, of null
     rf.toggleEmphasis(), rf.insert('{klant}'), rf.emphasisAt(), rf.refresh()

   Wat het veld zelf regelt: plakken als platte tekst, Enter alleen in een
   veld met meer regels, maxlength, typen met IME (niet ingrijpen tijdens het
   samenstellen), ongedaan maken binnen het veld (Ctrl + Z, typen = één stap)
   en toegankelijkheid (role="textbox", aria-multiline, het label).
   bron.value lezen en zetten werkt gewoon; bron.focus() zet de focus in het
   richfield. Lukt verbeteren niet, dan blijft het gewone tekstveld staan.
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Markup <-> stukken (zonder DOM, getest in tests/richfield.test.js)

     Stukken: { t: 'text', s } | { t: 'chip', token } | { t: 'em', kids, closed }
     Nadruk volgt precies runsFrom() in canvas-kit.js: elke ** wisselt aan/uit.
     closed: false = een ** zonder partner aan het eind; ook die komt exact terug.
     ------------------------------------------------------------------------- */

  const tokenLabel = (token) => token.slice(1, -1).toLowerCase();

  // Tekst met invulplekken ({klant}) als losse chips; alleen de tokens die het veld kent
  function splitChips(text, chips) {
    const out = [];
    if (!text) return out;
    const known = (chips || []).map((c) => c.toLowerCase());
    let last = 0;
    const re = /\{[^{}\n]+\}/g;
    let m;
    while ((m = re.exec(text))) {
      if (!known.includes(m[0].toLowerCase())) continue;
      if (m.index > last) out.push({ t: 'text', s: text.slice(last, m.index) });
      out.push({ t: 'chip', token: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: 'text', s: text.slice(last) });
    return out;
  }

  function parse(markup, chips = []) {
    const parts = String(markup == null ? '' : markup).split('**');
    const out = [];
    parts.forEach((part, i) => {
      if (i % 2 === 1) out.push({ t: 'em', kids: splitChips(part, chips), closed: i < parts.length - 1 });
      else out.push(...splitChips(part, chips));
    });
    return out;
  }

  function serialise(segs) {
    return segs.map((g) => {
      if (g.t === 'text') return g.s;
      if (g.t === 'chip') return g.token;
      return `**${serialise(g.kids)}${g.closed === false ? '' : '**'}`;
    }).join('');
  }

  /**
   * Bladeren: tekst en chips in volgorde, met hun plek in de markup.
   * start/end = markup-offsets van de zichtbare tekst (of het token).
   */
  function leaves(segs) {
    const out = [];
    let m = 0;
    const walk = (list, em) => {
      for (const g of list) {
        if (g.t === 'text') {
          out.push({ kind: 'text', s: g.s, em, start: m, end: m + g.s.length, node: g.node });
          m += g.s.length;
        } else if (g.t === 'chip') {
          out.push({ kind: 'chip', token: g.token, em, start: m, end: m + g.token.length, node: g.node });
          m += g.token.length;
        } else {
          m += 2;
          if (!g.kids.length) out.push({ kind: 'text', s: '', em: true, start: m, end: m, node: null, empty: g.node });
          walk(g.kids, true);
          if (g.closed !== false) m += 2;
        }
      }
    };
    walk(segs, false);
    return out;
  }

  /**
   * Waar komt markup-offset m terecht? { leaf, offset } voor tekst, { leaf, side }
   * voor een chip. Een offset binnen ** (of binnen een token) schuift naar de
   * dichtstbijzijnde plek waar de cursor echt kan staan.
   */
  function locate(list, m) {
    // Eerst tekst waar m echt in valt (bij een grens: het eerste blad)
    for (let i = 0; i < list.length; i++) {
      const lf = list[i];
      if (lf.kind === 'text' && m >= lf.start && m <= lf.end) return { leaf: i, offset: m - lf.start };
    }
    // Anders de dichtstbijzijnde plek: rand van een tekst, of voor of na een chip
    let best = null;
    let dist = Infinity;
    list.forEach((lf, i) => {
      const spots = lf.kind === 'text'
        ? [[lf.start, { leaf: i, offset: 0 }], [lf.end, { leaf: i, offset: lf.end - lf.start }]]
        : [[lf.start, { leaf: i, side: 'before' }], [lf.end, { leaf: i, side: 'after' }]];
      for (const [pos, at] of spots) {
        const d = Math.abs(pos - m);
        if (d < dist) {
          dist = d;
          best = at;
        }
      }
    });
    return best;
  }

  // Vorm van de stukken, zonder DOM-verwijzingen en met samengevoegde tekst (om te vergelijken)
  function shape(segs) {
    const out = [];
    for (const g of segs) {
      const prev = out[out.length - 1];
      if (g.t === 'text') {
        if (!g.s) continue;
        if (prev && prev.t === 'text') prev.s += g.s;
        else out.push({ t: 'text', s: g.s });
      } else if (g.t === 'chip') out.push({ t: 'chip', token: g.token });
      else out.push({ t: 'em', kids: shape(g.kids), closed: g.closed !== false });
    }
    return out;
  }

  // Zichtbare tekst (wat een schermlezer of de rondleiding telt)
  const plainText = (segs) => segs.map((g) => (g.t === 'text' ? g.s : g.t === 'chip' ? tokenLabel(g.token) : plainText(g.kids))).join('');

  /* ---------------------------------------------------------------------------
     Browser
     ------------------------------------------------------------------------- */

  const registry = new WeakMap();
  let uid = 0;

  function supported() {
    const doc = global.document;
    return !!(doc && doc.createElement('div').isContentEditable !== undefined && global.getSelection && typeof doc.execCommand === 'function');
  }

  function richfield(source, options = {}) {
    if (!source || registry.has(source)) return registry.get(source) || null;
    if (!supported()) return null;
    try {
      return enhance(source, options);
    } catch (err) {
      if (global.console) console.error('PM.richfield: het gewone tekstveld blijft staan.', err);
      source.hidden = false;
      return null;
    }
  }

  function enhance(source, options) {
    const doc = global.document;
    const mode = options.mode || source.dataset.rich || 'nadruk';
    const chips = options.chips || (source.dataset.chips || '').split(/\s+/).filter(Boolean);
    const multiline = options.multiline != null ? options.multiline : source.tagName === 'TEXTAREA' && source.dataset.single == null;
    const max = source.maxLength > 0 ? source.maxLength : 0;
    const proto = Object.getPrototypeOf(source);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    const nativeValue = () => desc.get.call(source);

    // De editor: zelfde plek, zelfde label, zelfde werkbalk
    const editor = doc.createElement('div');
    editor.className = `rf rf--${mode}${multiline ? '' : ' rf--single'}${source.classList.contains('input') ? ' input' : ''}`;
    editor.contentEditable = 'true';
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', String(multiline));
    editor.spellcheck = true;
    editor.id = `${source.id || `rf-${++uid}`}-rich`;
    if (source.rows > 1) editor.style.setProperty('--rows', String(source.rows));
    if (source.placeholder) editor.dataset.placeholder = source.placeholder;
    const label = source.id && doc.querySelector(`label[for="${source.id}"]`);
    if (label) {
      if (!label.id) label.id = `${source.id}-label`;
      editor.setAttribute('aria-labelledby', label.id);
      label.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input')) return;
        e.preventDefault();
        editor.focus();
      });
    } else if (source.getAttribute('aria-label')) {
      editor.setAttribute('aria-label', source.getAttribute('aria-label'));
    }
    if (source.getAttribute('aria-describedby')) editor.setAttribute('aria-describedby', source.getAttribute('aria-describedby'));
    // Werkbalk-attributen verhuizen naar de editor: daar staat de focus
    for (const attr of Array.from(source.attributes)) {
      if (attr.name.startsWith('data-toolbar')) {
        editor.setAttribute(attr.name, attr.value);
        source.removeAttribute(attr.name);
      }
    }
    source.after(editor);
    source.hidden = true;
    source.classList.add('rf-source');

    let lastValue = nativeValue();
    let composing = false;
    let internal = false;
    let pending = null;   // stand vlak voor een wijziging door de browser (voor maxlength en ongedaan maken)
    const undo = { past: [], future: [], at: 0, kind: '' };

    /* --- Tekenen --- */

    function build(parent, segs) {
      for (const g of segs) {
        if (g.t === 'text') parent.appendChild(doc.createTextNode(g.s));
        else if (g.t === 'chip') {
          const chip = doc.createElement('span');
          chip.className = 'rf-chip';
          chip.contentEditable = 'false';
          chip.dataset.token = g.token;
          chip.textContent = tokenLabel(g.token);
          parent.appendChild(chip);
        } else {
          const em = doc.createElement('span');
          em.className = 'rf-em';
          if (g.closed === false) em.dataset.open = '';
          build(em, g.kids);
          parent.appendChild(em);
        }
      }
    }

    function render(value) {
      editor.textContent = '';
      build(editor, parse(value, chips));
      // Een laatste lege regel is alleen zichtbaar met een <br> erachter
      if (multiline && /\n$/.test(value)) {
        const br = doc.createElement('br');
        br.dataset.end = '';
        editor.appendChild(br);
      }
      syncEmpty(value);
    }

    const syncEmpty = (value) => editor.classList.toggle('is-empty', !value);

    // DOM -> stukken, met een verwijzing naar de knopen (voor de cursor)
    function read() {
      let dirty = false;
      const walk = (el, inEm) => {
        const out = [];
        el.childNodes.forEach((n, i) => {
          if (n.nodeType === 3) {
            out.push({ t: 'text', s: n.data, node: n });
          } else if (n.nodeType === 1) {
            if (n.classList.contains('rf-chip')) out.push({ t: 'chip', token: n.dataset.token, node: n });
            else if (n.classList.contains('rf-em') && !inEm) out.push({ t: 'em', kids: walk(n, true), closed: !n.hasAttribute('data-open'), node: n });
            else if (n.tagName === 'BR') {
              if (!n.hasAttribute('data-end') || i !== el.childNodes.length - 1 || el !== editor) {
                dirty = true;
                out.push({ t: 'text', s: '\n' });
              }
            } else {
              // Iets dat de browser zelf maakte (div, span met stijl, b): alleen de tekst telt
              dirty = true;
              if (/^(DIV|P)$/.test(n.tagName) && out.length) out.push({ t: 'text', s: '\n' });
              out.push(...walk(n, inEm));
            }
          }
        });
        return out;
      };
      const segs = walk(editor, false);
      return { segs, value: serialise(segs), dirty };
    }

    /* --- Cursor: DOM <-> markup-offsets --- */

    // Markup-offset van een DOM-positie: dezelfde wandeling als read() en serialise()
    function offsetAt(container, offset) {
      let m = 0;
      let found = null;
      const walk = (el, inEm) => {
        const kids = el.childNodes;
        for (let i = 0; i <= kids.length; i++) {
          if (el === container && i === offset) {
            found = m;
            return true;
          }
          if (i === kids.length) break;
          const n = kids[i];
          if (n.nodeType === 3) {
            if (n === container) {
              found = m + Math.min(offset, n.data.length);
              return true;
            }
            m += n.data.length;
          } else if (n.nodeType === 1) {
            if (n.classList.contains('rf-chip')) {
              m += n.dataset.token.length;
              if (n === container || n.contains(container)) {
                found = m;
                return true;
              }
            } else if (n.classList.contains('rf-em') && !inEm) {
              m += 2;
              if (walk(n, true)) return true;
              if (!n.hasAttribute('data-open')) m += 2;
            } else if (n.tagName === 'BR') {
              if (!(n.hasAttribute('data-end') && i === kids.length - 1 && el === editor)) m += 1;
            } else {
              if (/^(DIV|P)$/.test(n.tagName) && i > 0) m += 1;
              if (walk(n, inEm)) return true;
            }
          }
        }
        return false;
      };
      walk(editor, false);
      return found == null ? m : found;
    }

    function getSel() {
      const sel = global.getSelection();
      if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return null;
      const r = sel.getRangeAt(0);
      const a = offsetAt(r.startContainer, r.startOffset);
      const b = offsetAt(r.endContainer, r.endOffset);
      return { start: Math.min(a, b), end: Math.max(a, b) };
    }

    function point(list, m) {
      const at = locate(list, m);
      if (!at) return { node: editor, offset: 0 };
      const lf = list[at.leaf];
      if (lf.kind === 'text') {
        if (lf.node) return { node: lf.node, offset: at.offset };
        if (lf.empty) return { node: lf.empty, offset: 0 };
        return { node: editor, offset: 0 };
      }
      const parent = lf.node.parentNode;
      const idx = Array.prototype.indexOf.call(parent.childNodes, lf.node);
      return { node: parent, offset: at.side === 'before' ? idx : idx + 1 };
    }

    function setSel(start, end = start) {
      const list = leaves(read().segs);
      const a = point(list, start);
      const b = point(list, end);
      const sel = global.getSelection();
      const range = doc.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    /* --- Wijzigingen doorgeven aan de bron --- */

    function commit(value) {
      lastValue = value;
      internal = true;
      desc.set.call(source, value);
      internal = false;
      syncEmpty(value);
      source.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function remember(value, sel, kind) {
      const now = Date.now();
      const merge = kind === 'typen' && undo.kind === 'typen' && now - undo.at < 700 && undo.past.length;
      if (!merge) {
        undo.past.push({ value, sel });
        if (undo.past.length > 100) undo.past.shift();
      }
      undo.future = [];
      undo.at = now;
      undo.kind = kind;
    }

    // Een wijziging die we zelf maken (nadruk, chip, plakken, Enter): nieuwe markup + cursor
    function apply(next, selStart, selEnd = selStart, kind = 'bewerking') {
      const before = lastValue;
      if (max && next.length > max && next.length > before.length) return false;
      remember(before, getSel(), kind);
      render(next);
      setSel(selStart, selEnd);
      if (next !== before) commit(next);
      return true;
    }

    function restoreFrom(from, to) {
      const entry = from.pop();
      if (!entry) return;
      to.push({ value: lastValue, sel: getSel() });
      render(entry.value);
      if (entry.sel) setSel(entry.sel.start, entry.sel.end);
      else setSel(entry.value.length);
      undo.kind = '';
      commit(entry.value);
    }

    // Een veld dat de tool of het ongedaan maken van de tool zet
    function refresh() {
      const value = nativeValue();
      if (value === lastValue && read().value === value) return;
      const hadFocus = doc.activeElement === editor;
      const sel = hadFocus ? getSel() : null;
      lastValue = value;
      render(value);
      undo.past = [];
      undo.future = [];
      if (sel) setSel(Math.min(sel.start, value.length), Math.min(sel.end, value.length));
    }

    /* --- Invoer --- */

    editor.addEventListener('compositionstart', () => { composing = true; });
    editor.addEventListener('compositionend', () => {
      composing = false;
      handleInput();
    });

    editor.addEventListener('beforeinput', (e) => {
      const type = e.inputType || '';
      if (type === 'historyUndo' || type === 'historyRedo') {
        e.preventDefault();
        restoreFrom(type === 'historyUndo' ? undo.past : undo.future, type === 'historyUndo' ? undo.future : undo.past);
        return;
      }
      // Opmaak van de browser (vet, cursief, kleur): hier geldt alleen de huisstijl
      if (/^format/.test(type)) {
        e.preventDefault();
        return;
      }
      if (type === 'insertParagraph' || type === 'insertLineBreak') {
        e.preventDefault();
        if (multiline && !composing) insertText('\n');
        return;
      }
      if (type === 'insertFromPaste' || type === 'insertFromDrop') {
        if (e.dataTransfer) {
          e.preventDefault();
          insertText(e.dataTransfer.getData('text/plain'));
        }
        return;
      }
      if (!composing && !pending) pending = { value: lastValue, sel: getSel(), kind: /^insertText|^insertCompositionText/.test(type) ? 'typen' : 'wissen' };
    });

    // Oudere browsers zonder dataTransfer in beforeinput: plakken apart afvangen
    editor.addEventListener('paste', (e) => {
      if (e.defaultPrevented || !e.clipboardData) return;
      e.preventDefault();
      insertText(e.clipboardData.getData('text/plain'));
    });
    editor.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.types.includes('text/plain')) return;
      e.preventDefault();
    });

    function insertText(raw) {
      let text = String(raw || '').replace(/\r\n?/g, '\n');
      if (!multiline) text = text.replace(/\s*\n\s*/g, ' ');
      const sel = getSel() || { start: lastValue.length, end: lastValue.length };
      // Geen ** half weghalen: een selectie over een grens van nadruk wordt eerst door de browser gewist
      if (sel.start !== sel.end) {
        doc.execCommand('delete');   // geeft zelf een input-event: handleInput legt het vast
        handleInput();
        return insertText(text);
      }
      if (max) text = text.slice(0, Math.max(0, max - lastValue.length));
      if (!text) return;
      const next = lastValue.slice(0, sel.start) + text + lastValue.slice(sel.start);
      apply(next, sel.start + text.length, sel.start + text.length, text === '\n' ? 'bewerking' : 'plakken');
    }

    function handleInput() {
      if (composing) return;
      const before = pending;
      pending = null;
      const now = read();
      if (now.value === lastValue) {
        if (now.dirty) render(now.value);
        return;
      }
      // Langer dan maxlength: terug naar hoe het was, net als een gewoon tekstveld
      if (max && now.value.length > max && now.value.length > lastValue.length) {
        const back = before || { value: lastValue, sel: null };
        render(back.value);
        if (back.sel) setSel(back.sel.start, back.sel.end);
        return;
      }
      remember(before ? before.value : lastValue, before ? before.sel : null, before ? before.kind : 'typen');
      if (now.dirty) {
        const sel = getSel();
        render(now.value);
        if (sel) setSel(sel.start, sel.end);
      }
      commit(now.value);
    }
    editor.addEventListener('input', (e) => {
      if (e.isComposing) return;
      handleInput();
    });

    editor.addEventListener('keydown', (e) => {
      const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
      const key = String(e.key || '').toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) restoreFrom(undo.future, undo.past);
        else restoreFrom(undo.past, undo.future);
      } else if (mod && key === 'y' && e.ctrlKey) {
        e.preventDefault();
        restoreFrom(undo.future, undo.past);
      } else if (e.key === 'Enter' && !e.isComposing && !multiline) {
        e.preventDefault();
      }
    });

    // Getypte ** of een half weggehaalde nadruk: bij het verlaten netjes tekenen
    editor.addEventListener('blur', () => {
      const now = read();
      if (now.dirty || JSON.stringify(shape(now.segs)) !== JSON.stringify(shape(parse(now.value, chips)))) render(now.value);
    });

    /* --- De bron blijft het echte veld --- */

    Object.defineProperty(source, 'value', {
      configurable: true,
      get: nativeValue,
      set(v) {
        desc.set.call(source, v);
        if (!internal) refresh();
      },
    });
    source.focus = (opts) => editor.focus(opts);

    const api = {
      source,
      editor,
      mode,
      get value() { return lastValue; },
      focus: (opts) => editor.focus(opts),
      refresh,
      // Nadruk aan/uit met dezelfde logica als core.js (hele woorden, of weghalen)
      toggleEmphasis() {
        const sel = getSel() || { start: lastValue.length, end: lastValue.length };
        const proxy = markupProxy(lastValue, sel);
        global.PM.toggleEmphasis(proxy);
        if (proxy.value !== lastValue) apply(proxy.value, proxy.selectionStart, proxy.selectionEnd);
        else editor.focus();
      },
      insert(token) {
        editor.focus();
        let sel = getSel() || { start: lastValue.length, end: lastValue.length };
        if (sel.start !== sel.end) {
          doc.execCommand('delete');
          handleInput();
          sel = getSel() || { start: lastValue.length, end: lastValue.length };
        }
        const proxy = markupProxy(lastValue, sel);
        global.PM.insertAtCaret(proxy, token);
        apply(proxy.value, proxy.selectionStart);
      },
      emphasisAt() {
        const sel = getSel();
        if (!sel) return false;
        const list = leaves(read().segs);
        const at = locate(list, sel.start);
        return !!(at && list[at.leaf] && list[at.leaf].em);
      },
      selection: getSel,
      select: setSel,
    };

    // Een nep-tekstveld met markup en selectie, voor toggleEmphasis en insertAtCaret uit core.js
    function markupProxy(value, sel) {
      return {
        value,
        selectionStart: sel.start,
        selectionEnd: sel.end,
        focus() { editor.focus(); },
        setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; },
        dispatchEvent() { return true; },
      };
    }

    render(lastValue);
    registry.set(source, api);
    registry.set(editor, api);
    return api;
  }

  function init(root) {
    const scope = root || global.document;
    return Array.from(scope.querySelectorAll('[data-rich]')).map((el) => richfield(el)).filter(Boolean);
  }

  const pure = { parse, serialise, leaves, locate, plainText, splitChips, shape };

  if (typeof module !== 'undefined' && module.exports) module.exports = pure;
  if (global && global.document) {
    const PM = global.PM = global.PM || {};
    PM.richfield = Object.assign(richfield, pure, {
      init,
      of: (el) => (el && registry.get(el)) || null,
      supported,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
