/* =============================================================================
   styleguide/model.js — rekenwerk van de Brand Styleguide, zonder DOM
   -----------------------------------------------------------------------------
     contrast(a, b)          contrastverhouding volgens WCAG 2.1 (hex-kleuren)
     ratioText(n)            "5,7 : 1"
     verdict(n)              { text, large }: haalt hij 4,5 (tekst) en 3 (grote tekst)?
     readable(hex)           wit of Inkt als tekstkleur: wat het meeste contrast geeft
     copyValue(kleur, soort) wat "kopieer" op het klembord zet (HEX, RGB of CMYK)
     cmykOf(rgb)             de rekenkundige omzetting van RGB naar CMYK
     searchIndex(content)    zoekindex: per pagina de teksten die erop staan
     search(index, vraag)    pagina's die passen, de beste eerst, met een fragment
     aseBytes(groepen)       kleurstalen als Adobe Swatch Exchange (Illustrator, InDesign)
     colorJson(tokens, …)    de kleuren en regels als JSON (voor developers)
     splitParts(aantallen, hoofdstukken, limiet)
                             pagina's verdelen over PDF's die elk onder de limiet
                             van Canva blijven (1.400 elementen), per heel hoofdstuk
     fileName(hoofdstuk)     brandbook-pure-minds-marketing-group.pdf, brandbook-logo.pdf
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Kleur
     ------------------------------------------------------------------------- */

  function rgbOf(hex) {
    const v = String(hex).replace('#', '');
    const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function luminance(hex) {
    const lin = rgbOf(hex).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Eén decimaal, afgerond (13,198 wordt 13,2). Of hij de norm haalt, telt de exacte waarde
  const ratioText = (n) => `${(Math.round(n * 10) / 10).toFixed(1).replace('.', ',')} : 1`;
  const verdict = (n) => ({ text: n >= 4.5, large: n >= 3 });
  const readable = (hex) => (contrast(hex, '#FFFFFF') >= contrast(hex, '#303030') ? '#FFFFFF' : '#303030');

  function cmykOf([r, g, b]) {
    const [rr, gg, bb] = [r / 255, g / 255, b / 255];
    const k = 1 - Math.max(rr, gg, bb);
    if (k >= 1) return [0, 0, 0, 100];
    const f = (c) => Math.round(((1 - c - k) / (1 - k)) * 100);
    return [f(rr), f(gg), f(bb), Math.round(k * 100)];
  }

  // Wat de knop op het klembord zet: plakklaar voor CSS, Figma of Adobe
  function copyValue(c, kind) {
    if (kind === 'rgb') return c.rgb.join(', ');
    if (kind === 'cmyk') return c.cmyk.join(', ');
    return c.hex.toUpperCase();
  }

  /* ---------------------------------------------------------------------------
     Zoeken
     ------------------------------------------------------------------------- */

  const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\*\*/g, '');

  // Alle tekst in een stuk content (strings, arrays en objecten), plat
  function strings(value, out = []) {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
    return out;
  }

  // Welke content op welke pagina staat (zelfde indeling als pages.js)
  function pageTexts(C, id) {
    const map = {
      cover: [C.company, C.slogan, C.version],
      inhoud: C.chapters.map((c) => c.title),
      'missie-visie': [C.intro, C.mission, C.vision, C.slogan],
      kernwaarden: C.values,
      'tone-of-voice': [C.tone.intro, C.tone.scales],
      schrijven: [C.tone.rules, C.tone.examples],
      logo: [C.logo.intro, C.logo.variants.map((v) => v.text)],
      'clear-space': [C.logo.clearSpace, C.logo.minimum],
      'logo-gebruik': [C.logo.donts, C.logo.added],
      zeshoek: [C.hexagon],
      kleuren: [C.colors.intro, C.colors.secondaryRule],
      'kleur-toepassen': [C.colors.ratio, C.colors.contrast.map((r) => r[2]), C.colors.contrastNote],
      typografie: [C.type.intro, Object.values(C.type.usage), C.type.notes],
      beeldtaal: [C.imagery.intro, C.imagery.sections, C.imagery.frames],
      iconen: [C.icons.intro, C.icons.rules, C.icons.variants.map((v) => `${v.name} ${v.sub}`)],
      toepassingen: [C.usage],
      colofon: [C.colophon, C.domain],
    };
    return strings(map[id] || []);
  }

  function searchIndex(C, tokens) {
    const colorWords = tokens ? tokens.allColors().map((c) => `${c.name} ${c.hex} ${c.rgb.join(' ')}`) : [];
    return C.pages.map((p, index) => {
      const texts = pageTexts(C, p.id);
      if (p.id === 'kleuren') texts.push(...colorWords);
      const chapter = C.chapters.find((c) => c.id === p.chapter);
      return {
        index, id: p.id, chapter: p.chapter, title: p.title,
        head: fold(`${p.title} ${chapter ? chapter.label : ''} ${p.words || ''}`),
        texts, body: texts.map(fold),
      };
    });
  }

  // Het stuk tekst rond de eerste treffer, op woordgrenzen
  function snippet(text, at, len) {
    const plain = String(text).replace(/\*\*/g, '');
    if (plain.length <= 90) return plain;
    let a = Math.max(0, at - 30);
    let b = Math.min(plain.length, at + len + 60);
    if (a > 0) a = plain.indexOf(' ', a) + 1 || a;
    if (b < plain.length) b = plain.lastIndexOf(' ', b) > at ? plain.lastIndexOf(' ', b) : b;
    return `${a > 0 ? '…' : ''}${plain.slice(a, b).trim()}${b < plain.length ? '…' : ''}`;
  }

  /**
   * Pagina's die bij de vraag passen. Elk woord moet ergens op de pagina
   * staan; titel en zoekwoorden tellen zwaarder dan lopende tekst, de hele
   * vraag als zin het zwaarst. -> [{ index, id, title, chapter, snippet, score }]
   */
  function search(index, query) {
    const q = fold(query).replace(/[^\p{L}\p{N}#%/ -]+/gu, ' ').trim();
    if (q.length < 2) return [];
    const words = q.split(/\s+/).filter(Boolean);
    // Korte woorden ("u", "je") alleen als heel woord: anders past "u" overal
    // at(t): waar het woord in t staat, of -1
    const tests = words.map((w) => {
      if (w.length > 2) return (t) => t.indexOf(w);
      const safe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${safe}(?=$|[^\\p{L}\\p{N}])`, 'u');
      return (t) => {
        const m = re.exec(t);
        return m ? m.index + m[1].length : -1;
      };
    });
    const has = (at) => (t) => at(t) >= 0;
    const out = [];
    for (const p of index) {
      let score = 0;
      let ok = true;
      for (const at of tests) {
        const inHead = has(at)(p.head);
        const inBody = p.body.some(has(at));
        if (!inHead && !inBody) {
          ok = false;
          break;
        }
        score += (inHead ? 3 : 0) + (inBody ? 1 : 0);
      }
      if (!ok) continue;
      if (words.length > 1 && (p.head.includes(q) || p.body.some((t) => t.includes(q)))) score += 4;
      if (fold(p.title).startsWith(q)) score += 2;
      // Fragment: de tekst met de hele vraag, anders die met de meeste woorden van de vraag
      let hit = p.body.findIndex((t) => t.includes(q));
      let pos = hit >= 0 ? p.body[hit].indexOf(q) : -1;
      let len = q.length;
      if (hit < 0) {
        let best = 0;
        p.body.forEach((t, i) => {
          const n = tests.filter((at) => at(t) >= 0).length;
          if (n > best) {
            best = n;
            hit = i;
          }
        });
        if (hit >= 0) {
          const k = tests.findIndex((at) => at(p.body[hit]) >= 0);
          pos = tests[k](p.body[hit]);
          len = words[k].length;
        }
      }
      // Alleen in de titel of zoekwoorden gevonden: de eerste tekst van de pagina
      const text = hit >= 0 ? snippet(p.texts[hit], pos, len) : snippet(p.texts[0] || '', 0, 0);
      out.push({ index: p.index, id: p.id, title: p.title, chapter: p.chapter, score, snippet: text });
    }
    return out.sort((a, b) => b.score - a.score || a.index - b.index);
  }

  /* ---------------------------------------------------------------------------
     Kleurbestanden
     ------------------------------------------------------------------------- */

  /**
   * Adobe Swatch Exchange (.ase), versie 1.0. groups: [{ name, colors: [{ name,
   * model: 'RGB' | 'CMYK', values: [0..1] }] }]. Elke groep is een map in het
   * stalenpaneel; kleuren zijn "global", zodat aanpassen overal doorwerkt.
   */
  function aseBytes(groups) {
    const chunks = [];
    let blocks = 0;
    const u16 = (v) => [(v >> 8) & 255, v & 255];
    const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    const f32 = (v) => {
      const b = new DataView(new ArrayBuffer(4));
      b.setFloat32(0, v, false);
      return [b.getUint8(0), b.getUint8(1), b.getUint8(2), b.getUint8(3)];
    };
    const name = (s) => {
      const units = [];
      for (const ch of String(s)) {
        const code = ch.charCodeAt(0);
        units.push(...u16(code));
      }
      units.push(0, 0);
      return [...u16(String(s).length + 1), ...units];
    };
    const block = (type, body) => {
      chunks.push(...u16(type), ...u32(body.length), ...body);
      blocks++;
    };
    for (const g of groups) {
      block(0xc001, name(g.name));
      for (const c of g.colors) {
        const model = c.model === 'CMYK' ? 'CMYK' : 'RGB ';
        const body = [...name(c.name), ...Array.from(model, (ch) => ch.charCodeAt(0))];
        c.values.forEach((v) => body.push(...f32(v)));
        body.push(...u16(0));   // 0 = global
        block(0x0001, body);
      }
      block(0xc002, []);
    }
    return new Uint8Array([...Array.from('ASEF', (ch) => ch.charCodeAt(0)), ...u16(1), ...u16(0), ...u32(blocks), ...chunks]);
  }

  // De twee mappen voor Adobe: RGB voor scherm, CMYK voor drukwerk
  function aseGroups(tokens) {
    const list = tokens.allColors();
    return [
      { name: 'Pure Minds (RGB, scherm)', colors: list.map((c) => ({ name: c.name, model: 'RGB', values: c.rgb.map((v) => v / 255) })) },
      { name: 'Pure Minds (CMYK, print)', colors: list.map((c) => ({ name: `${c.name} CMYK`, model: 'CMYK', values: c.cmyk.map((v) => v / 100) })) },
    ];
  }

  function colorJson(tokens, content) {
    const one = (c, group) => ({ id: c.id, name: c.name, group, hex: c.hex.toUpperCase(), rgb: c.rgb, cmyk: c.cmyk, role: c.role, cssVar: c.css ? `--pm-${c.css === 'ink' ? 'ink' : c.css}` : null });
    return {
      name: `${tokens.company} kleuren`,
      version: tokens.version,
      source: 'Brand Styleguide, Pure Minds Generator Hub',
      colors: [
        ...tokens.colors.primary.map((c) => one(c, 'primair')),
        ...tokens.colors.secondary.map((c) => one(c, 'secundair')),
        ...tokens.colors.neutral.map((c) => one(c, 'neutraal')),
      ],
      ratio: { 'wit en neutraal': tokens.ratio.neutral, 'pure cyaan': tokens.ratio.cyaan, 'magenta en accenten': tokens.ratio.accent },
      rules: [content.colors.secondaryRule, content.colors.contrastNote, 'Effen kleuren: geen verlopen in vormen of zeshoeken.'],
      font: { family: tokens.font.family, stack: tokens.font.stack, weights: tokens.font.weights.map((w) => w.weight) },
    };
  }

  /* ---------------------------------------------------------------------------
     PDF's: verdelen en namen
     ------------------------------------------------------------------------- */

  /**
   * counts: elementen per pagina; chapterOf: hoofdstuk per pagina (zelfde lengte).
   * Past alles onder de limiet, dan één deel. Anders hele hoofdstukken bij
   * elkaar tot de limiet bereikt is. -> [[paginanummers], …]
   */
  function splitParts(counts, chapterOf, limit) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (total <= limit) return [counts.map((_, i) => i)];
    const chunks = [];
    counts.forEach((n, i) => {
      const last = chunks[chunks.length - 1];
      if (last && last.chapter === chapterOf[i]) {
        last.pages.push(i);
        last.n += n;
      } else chunks.push({ chapter: chapterOf[i], pages: [i], n });
    });
    const parts = [];
    let cur = null;
    for (const c of chunks) {
      if (!cur || cur.n + c.n > limit) {
        cur = { pages: [], n: 0 };
        parts.push(cur);
      }
      cur.pages.push(...c.pages);
      cur.n += c.n;
    }
    return parts.map((p) => p.pages);
  }

  const fileName = (chapterId, part) => {
    const base = chapterId ? `brandbook-${chapterId}` : 'brandbook-pure-minds-marketing-group';
    return `${base}${part ? `-deel-${part}` : ''}.pdf`;
  };

  const model = {
    rgbOf, luminance, contrast, ratioText, verdict, readable, cmykOf, copyValue,
    fold, pageTexts, searchIndex, search, aseBytes, aseGroups, colorJson, splitParts, fileName,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (global && global.document) global.PMStyleguideModel = model;
})(typeof window !== 'undefined' ? window : globalThis);
