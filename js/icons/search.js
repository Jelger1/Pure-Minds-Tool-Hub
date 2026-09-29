/* =============================================================================
   search.js — zoeken in de iconen van de Icon Finder (window.PMIconSearch)
   -----------------------------------------------------------------------------
   Gebruik:
     const engine = PMIconSearch.create({ icons, categories, categoryLabels, tags });
     engine.search('pijl rechts')  -> { ids: [indexen in icons, beste eerst], fuzzy }
     engine.words(index)           -> { naam, nl, extra, categorie }: de doorzoekbare
                                      woorden van één icoon (om te debuggen)

   Elk icoon heeft vier soorten woorden:
     naam       de Engelse naam, in woorden (delete-bin -> delete, bin)
     nl         de Nederlandse naam uit PM_ICON_TAGS: het deel vóór de dubbele
                spatie (prullenbak vuilnisbak verwijderen ...)
     extra      de rest van PM_ICON_TAGS: Engelse Remix-tags en afgeleide woorden
     categorie  het Nederlandse label én de Engelse mapnaam (Pijlen, Arrows)

   Zoekvraag: kleine letters, zonder accenten (kopiëren = kopieren); '-', '_',
   '/', '&' en "'" scheiden woorden, "e-mail" zoekt ook als "email". Vulwoorden
   (de, het, naar, icoon ...) tellen niet; kleine woorden als in, op, uit en
   aan tellen alleen mee als ze passen ("geluid uit", "let op").

   Een zoekwoord past op een woord als het gelijk is of het begin ervan is
   ("pij" -> pijl). Alle zoekwoorden moeten passen (EN). Punten per zoekwoord,
   het beste woord telt:
     naam of nl, gelijk        100
     extra, gelijk             50
     categorie, gelijk         30
     naam of nl, begin         20-35  (hoe vollediger, hoe hoger)
     extra, begin              10-18
     categorie, begin          5-8
   De Nederlandse naam telt dus even zwaar als de Engelse: "map" vindt zowel
   map (kaart) als folder. Een heel woord gaat altijd voor een begin: "weer"
   vindt eerst de weericonen, pas daarna "weergave".

   Volgorde van de resultaten, telkens bij gelijke stand de volgende regel:
     1. de hele naam is precies de zoekvraag (home -> home)
     2. meeste punten
     3. het eerste zoekwoord past op het eerste woord van de naam (of van nl)
     4. kortere naam eerst, zonder volgnummer (mail-2 telt als mail)
     5. zonder volgnummer vóór mail-2, mail-2 vóór mail-3
     6. treffers in de naam vóór treffers alleen in tags
     7. volgorde van de data (categorie, dan naam)

   Vangnetten:
     meervoud en verkleinwoord  per zoekwoord dat niet heel in een naam of tag
                                staat, of bij minder dan 5 iconen: pijlen -> pijl,
                                huisje -> huis. Deze treffers komen na de hele
                                woorden (45 punten of minder).
   Levert de zoekvraag zo niets op, dan (fuzzy: true):
     tikfouten                  voor zoekwoorden die nergens op passen: 1 fout
                                bij woorden van 4-6 letters, 2 bij langere; de
                                eerste letter moet kloppen
     gedeeltelijk               bij twee of meer zoekwoorden: iconen waarop
                                minstens de helft past ("prullenbak groot");
                                meer passende woorden eerst, zeldzame woorden
                                tellen zwaarder
   Een los getypte samenstelling telt ook aaneen als dat woord bestaat:
   "video bellen" vindt videobellen, "prullen bak" vindt prullenbak. En een
   onbekende samenstelling wordt gesplitst als beide delen bestaan:
   "klantgesprek" zoekt op klant en gesprek (beide passen: 60%, één: 35%).
   ============================================================================= */
(function (global) {
  'use strict';

  // Scores (zie boven)
  const EXACT = 100;
  const EXTRA_EXACT = 50;
  const CAT_EXACT = 30;
  const PREFIX_MIN = 20;
  const PREFIX_SPAN = 15;
  const EXTRA_PREFIX_MIN = 10;
  const EXTRA_PREFIX_SPAN = 8;
  const CAT_PREFIX_MIN = 5;
  const CAT_PREFIX_SPAN = 3;
  const STEM_FACTOR = 0.45;   // treffer via meervoud of verkleinwoord: onder elke directe treffer (extra, gelijk = 50)
  const STEM_MIN = 5;         // minder directe treffers dan dit: ook het grondwoord proberen
  const MAX_FUZZY_TERMS = 4;  // tikfouten zoeken voor hooguit zoveel zoekwoorden (houdt lange onzin snel)
  const SPLIT_BOTH = 0.6;     // samenstelling, beide delen passen (klant + gesprek)
  const SPLIT_ONE = 0.35;     // samenstelling, één deel past

  // Soort woord, per treffer opgeslagen als icoon * 8 + soort
  const NAME_FIRST = 0;
  const NAME = 1;
  const NL_FIRST = 2;
  const NL = 3;
  const EXTRA = 4;
  const CATEGORY = 5;

  // Vulwoorden die niets zeggen over het icoon ("pijl naar rechts", "icoon voor instellingen")
  const STOPWORDS = new Set(['de', 'het', 'een', 'en', 'van', 'voor', 'met', 'naar', 'te', 'is', 'the', 'a', 'an',
    'and', 'of', 'for', 'with', 'to', 'icoon', 'iconen', 'icon', 'icons', 'pictogram', 'symbool', 'symbol']);
  // Kleine woorden die soms iets zeggen ("geluid uit", "zoom in", "let op"): tellen mee als
  // ze passen, maar een icoon valt niet af als ze niet passen
  const SOFTWORDS = new Set(['in', 'op', 'uit', 'aan', 'af', 'on', 'off']);

  // Tekens die mensen typen in plaats van een woord
  const SYMBOLS = { '€': ' euro ', '$': ' dollar ', '£': ' pound ', '%': ' procent ', '#': ' hashtag ', '@': ' apenstaartje ' };

  /* ---------------------------------------------------------------------------
     Normaliseren
     ------------------------------------------------------------------------- */

  // Kleine letters, zonder accenten (financiën -> financien)
  function fold(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Een stuk tekst zonder spaties -> losse woorden; '-', '_', '/', '&', "'" en de rest scheiden
  const splitParts = (chunk) => chunk.split(/[^a-z0-9]+/).filter(Boolean);

  // Woorden om te indexeren uit vrije tekst: "e-mail" -> mail, email; "foto's" -> foto, fotos
  function indexWords(text) {
    const out = [];
    for (const chunk of fold(text).split(/\s+/)) {
      const parts = splitParts(chunk);
      for (const part of parts) if (part.length > 1 || /\d/.test(part)) out.push(part);
      if (parts.length > 1) out.push(parts.join(''));
    }
    return out;
  }

  /* ---------------------------------------------------------------------------
     Nederlands: meervoud en verkleinwoord terug naar het grondwoord
     ------------------------------------------------------------------------- */

  const VOWELS = 'aeiou';

  // "mapp" -> "map", "sterr" -> "ster"
  function undouble(w) {
    const n = w.length;
    return n > 2 && w[n - 1] === w[n - 2] && !VOWELS.includes(w[n - 1]) ? w.slice(0, -1) : w;
  }

  // Kandidaten voor het grondwoord; alleen bestaande woorden tellen straks mee
  function stems(word) {
    const out = new Set();
    const add = (w) => { if (w.length >= 2 && w !== word) out.add(w); };
    const base = (w) => {
      add(w);
      add(undouble(w));                                            // mappen -> map
      const n = w.length;
      if (n > 3 && w[n - 1] === w[n - 2] && VOWELS.includes(w[n - 1])) add(w.slice(0, -1));   // autootje -> auto
      if (n > 1 && !VOWELS.includes(w[n - 1]) && VOWELS.includes(w[n - 2]) && !VOWELS.includes(w[n - 3] || 'a')) {
        add(w.slice(0, -1) + w[n - 2] + w[n - 1]);                 // bomen -> boom, kaarten -> (kaart)
      }
      if (w.endsWith('v')) add(w.slice(0, -1) + 'f');              // brieven -> brief
      if (w.endsWith('z')) add(w.slice(0, -1) + 's');              // huizen -> huis
    };
    // Verkleinwoorden: kaartjes, huisje, pijltje, bolletje, autootje
    for (const suffix of ['etjes', 'etje', 'tjes', 'tje', 'pjes', 'pje', 'jes', 'je']) {
      if (word.length > suffix.length + 1 && word.endsWith(suffix)) base(word.slice(0, -suffix.length));
    }
    // Meervouden: pijlen, grafieken, kinderen, bacterien, telefoons, sleutels
    if (word.endsWith('eren') && word.length > 6) base(word.slice(0, -4));
    if (word.endsWith('en') && word.length > 4) { base(word.slice(0, -2)); add(word.slice(0, -1)); }
    // Zelfstandig naamwoord op -ing naar het werkwoord: levering -> leveren. Niet naar de kale stam:
    // bij Engelse leenwoorden gaat dat mis (branding -> brand = vuur, training -> train)
    if (word.endsWith('ing') && word.length > 5) add(word.slice(0, -3) + 'en');
    if (word.endsWith('s') && word.length > 3) base(word.slice(0, -1));
    return [...out];
  }

  /* ---------------------------------------------------------------------------
     Tikfouten: Damerau-Levenshtein (verwisseling van twee letters telt als één)
     ------------------------------------------------------------------------- */

  // Afstand tussen a en b, of tot het begin van b als prefix = true; max + 1 als het meer is
  function distance(a, b, max, prefix) {
    const m = a.length;
    const n = prefix ? Math.min(b.length, m + max) : b.length;
    if (!prefix && Math.abs(m - n) > max) return max + 1;
    let prev2 = null;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = new Array(n + 1);
      cur[0] = i;
      let rowMin = cur[0];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
        cur[j] = d;
        if (d < rowMin) rowMin = d;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    if (!prefix) return prev[n];
    let best = max + 1;
    for (let j = Math.max(0, m - max); j <= n; j++) if (prev[j] < best) best = prev[j];
    return best;
  }

  const maxTypos = (word) => (word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0);

  /* ---------------------------------------------------------------------------
     Samenstellingen: klantgesprek -> klant + gesprek
     ------------------------------------------------------------------------- */

  // Mogelijke vormen van het eerste deel: tussen-s en tussen-en weg, of een werkwoordstam
  // (tijdsregistratie -> tijd, klantenbestand -> klant, zoekresultaten -> zoeken, laadtijd -> laden)
  function firstParts(left) {
    const out = [left];
    if (left.length > 3 && left.endsWith('s')) out.push(left.slice(0, -1));
    if (left.length > 4 && left.endsWith('en')) out.push(left.slice(0, -2));
    out.push(left + 'en');
    const open = left.replace(/([aeou])\1([^aeiou])$/, '$1$2');
    if (open !== left) out.push(open + 'en');
    return out;
  }

  // Alle splitsingen in twee delen van minstens 3 letters
  function compoundSplits(word) {
    const out = [];
    for (let i = 3; i <= word.length - 3; i++) out.push([word.slice(0, i), word.slice(i)]);
    return out;
  }

  /* ---------------------------------------------------------------------------
     Index opbouwen
     ------------------------------------------------------------------------- */

  function create(options) {
    const opts = options || {};
    const icons = opts.icons || [];
    const categories = opts.categories || [];
    const labels = opts.categoryLabels || {};
    const tags = opts.tags || {};
    const count = icons.length;

    const vocab = new Map();    // woord -> id
    const words = [];           // id -> woord
    const postings = [];        // id -> [icoon * 8 + soort]

    function post(word, icon, kind) {
      let id = vocab.get(word);
      if (id === undefined) {
        id = words.length;
        vocab.set(word, id);
        words.push(word);
        postings.push([]);
      }
      postings[id].push(icon * 8 + kind);
    }

    // Categoriewoorden één keer per categorie
    const categoryWords = categories.map((cat) => [...new Set(indexWords(cat + ' ' + (labels[cat] || '')))]);

    const joined = new Array(count);      // naam zonder streepjes, voor "de hele naam"
    const stemLength = new Uint16Array(count);
    const variant = new Uint16Array(count);
    const perIcon = new Array(count);     // voor words()

    for (let i = 0; i < count; i++) {
      const name = String(icons[i][0]);
      const nameWords = fold(name).split(/[^a-z0-9]+/).filter(Boolean);
      const nameSet = new Set(nameWords);
      joined[i] = nameWords.join('');
      const numbered = name.match(/^(.*)-(\d+)$/);
      stemLength[i] = numbered ? numbered[1].length : name.length;
      variant[i] = numbered ? Number(numbered[2]) + 1 : 0;

      const seen = new Set();
      nameWords.forEach((w, pos) => {
        if (seen.has(w)) return;
        seen.add(w);
        post(w, i, pos === 0 ? NAME_FIRST : NAME);
      });

      // Tags: vóór de dubbele spatie de Nederlandse naam, daarna de extra woorden
      const raw = typeof tags[name] === 'string' ? tags[name] : '';
      const cut = raw.search(/\s{2,}/);
      const nl = indexWords(cut === -1 ? raw : raw.slice(0, cut));
      const extra = cut === -1 ? [] : indexWords(raw.slice(cut));
      const nlWords = [];
      nl.forEach((w, pos) => {
        if (seen.has(w)) return;
        seen.add(w);
        nlWords.push(w);
        post(w, i, pos === 0 ? NL_FIRST : NL);
      });
      const extraWords = [];
      for (const w of extra) {
        if (seen.has(w)) continue;
        seen.add(w);
        extraWords.push(w);
        post(w, i, EXTRA);
      }
      const catWords = (categoryWords[icons[i][1]] || []).filter((w) => !seen.has(w) && !nameSet.has(w));
      for (const w of catWords) post(w, i, CATEGORY);
      perIcon[i] = { name: nameWords, nl: nlWords, extra: extraWords, category: catWords };
    }

    // Gesorteerde woordenlijst voor het zoeken op begin van een woord
    const sorted = words.map((w, id) => id).sort((a, b) => (words[a] < words[b] ? -1 : words[a] > words[b] ? 1 : 0));
    const sortedWords = sorted.map((id) => words[id]);
    const packed = postings.map((list) => Int32Array.from(list));

    /* -------------------------------------------------------------------------
       Eén zoekwoord scoren
       ----------------------------------------------------------------------- */

    // Punten voor een treffer: soort woord, heel woord of alleen het begin, en hoe volledig (ratio)
    function points(kind, exact, ratio) {
      if (kind <= NL) return exact ? EXACT : PREFIX_MIN + PREFIX_SPAN * ratio;
      if (kind === EXTRA) return exact ? EXTRA_EXACT : EXTRA_PREFIX_MIN + EXTRA_PREFIX_SPAN * ratio;
      return exact ? CAT_EXACT : CAT_PREFIX_MIN + CAT_PREFIX_SPAN * ratio;
    }

    // Loop over alle woorden die met q beginnen (inclusief q zelf)
    function eachPrefix(q, fn) {
      let lo = 0;
      let hi = sortedWords.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sortedWords[mid] < q) lo = mid + 1; else hi = mid;
      }
      for (let k = lo; k < sortedWords.length && sortedWords[k].startsWith(q); k++) fn(sorted[k]);
    }

    /**
     * Scoor één woord: vult score (beste per icoon), en markeert treffers op het
     * eerste woord (first) en in de naam (inName). factor verlaagt vangnet-treffers.
     * Geeft true als het woord heel voorkomt in een naam of tags (niet alleen als begin).
     */
    function scoreWord(q, acc, factor, onlyExact) {
      let whole = false;
      const visit = (id) => {
        const w = words[id];
        const exact = w.length === q.length;
        if (onlyExact && !exact) return;
        const ratio = q.length / w.length;
        const list = packed[id];
        for (let k = 0; k < list.length; k++) {
          const icon = list[k] >> 3;
          const kind = list[k] & 7;
          const p = points(kind, exact, ratio) * factor;
          if (exact && kind !== CATEGORY) whole = true;
          if (p > acc.score[icon]) acc.score[icon] = p;
          if (kind === NAME_FIRST || kind === NL_FIRST) acc.first[icon] = 1;
          if (kind <= NAME) acc.inName[icon] = 1;
        }
      };
      if (onlyExact) {
        const id = vocab.get(q);
        if (id !== undefined) visit(id);
      } else {
        eachPrefix(q, visit);
      }
      return whole;
    }

    const newAcc = () => ({ score: new Float64Array(count), first: new Uint8Array(count), inName: new Uint8Array(count) });

    /**
     * Eén zoekwoord, met het vangnet voor meervoud en verkleinwoord: als het woord
     * nergens heel voorkomt, of bij minder dan STEM_MIN iconen ("mappen" staat
     * alleen bij folders). Treffers via het grondwoord komen altijd ná de directe;
     * hoe dichter het grondwoord bij het zoekwoord ligt, hoe hoger: kaartjes ->
     * kaartje vóór kaart.
     */
    function scoreTerm(q) {
      const acc = newAcc();
      const whole = scoreWord(q, acc, 1, false);
      if (q.length <= 3) return acc;
      let hits = 0;
      for (let i = 0; i < count && hits < STEM_MIN; i++) if (acc.score[i]) hits++;
      if (whole && hits >= STEM_MIN) return acc;
      for (const stem of stems(q)) scoreWord(stem, acc, STEM_FACTOR - 0.1 * (1 - stem.length / q.length), true);
      if (!whole && q.length >= 6) scoreCompound(q, acc);
      return acc;
    }

    // Een bestaand woord (heel, of via meervoud of verkleinwoord) als deel van een samenstelling
    function partAcc(forms) {
      let found = forms.filter((form) => vocab.has(form));
      if (!found.length) found = stems(forms[0]).filter((stem) => stem.length >= 3 && vocab.has(stem));
      if (!found.length) return null;
      const acc = newAcc();
      for (const form of found) scoreWord(form, acc, 1, true);
      return acc;
    }

    /**
     * Samenstelling die als geheel nergens voorkomt: klantgesprek -> klant + gesprek.
     * Beide delen moeten bestaande woorden zijn. Passen beide: SPLIT_BOTH van het
     * gemiddelde; past één deel: SPLIT_ONE. Altijd onder de hele woorden.
     */
    function scoreCompound(q, acc) {
      for (const [left, right] of compoundSplits(q)) {
        const rightAcc = partAcc([right]);
        if (!rightAcc) continue;
        const leftAcc = partAcc(firstParts(left));
        if (!leftAcc) continue;
        for (let i = 0; i < count; i++) {
          const l = leftAcc.score[i];
          const r = rightAcc.score[i];
          if (!l && !r) continue;
          const p = l && r ? SPLIT_BOTH * (l + r) / 2 : SPLIT_ONE * (l || r);
          if (p > acc.score[i]) {
            acc.score[i] = p;
            acc.first[i] = leftAcc.first[i];
            acc.inName[i] = leftAcc.inName[i] || rightAcc.inName[i];
          }
        }
      }
    }

    // Tikfouten: woorden binnen de toegestane afstand, per fout minder punten
    function scoreFuzzy(q) {
      const acc = scoreTerm(q);
      const max = maxTypos(q);
      if (!max) return acc;
      for (let id = 0; id < words.length; id++) {
        const w = words[id];
        if (w.length < 3 || w === q) continue;
        // Tikfouten in de eerste letter zijn zeldzaam: die moet kloppen (of met de tweede verwisseld zijn),
        // anders vindt "mailing" sailing en hailing
        if (w[0] !== q[0] && !(w[0] === q[1] && w[1] === q[0])) continue;
        let d = Math.abs(w.length - q.length) <= max ? distance(q, w, max, false) : max + 1;
        let factor = 0;
        if (d <= max) factor = d === 1 ? 0.7 : 0.5;
        else if (q.length >= 5 && w.length > q.length && w[0] === q[0]) {
          d = distance(q, w, max, true);                        // "prulenb" -> prullenbak
          if (d <= max) factor = d === 1 ? 0.6 : 0.4;
        }
        if (!factor) continue;
        const list = packed[id];
        for (let k = 0; k < list.length; k++) {
          const icon = list[k] >> 3;
          const kind = list[k] & 7;
          const p = points(kind, true, 1) * factor;
          if (p > acc.score[icon]) acc.score[icon] = p;
          if (kind === NAME_FIRST || kind === NL_FIRST) acc.first[icon] = 1;
          if (kind <= NAME) acc.inName[icon] = 1;
        }
      }
      return acc;
    }

    /* -------------------------------------------------------------------------
       Zoekvraag
       ----------------------------------------------------------------------- */

    // "pijl naar rechts" -> termen; "e-mail" -> term met varianten email en mail
    function parse(query) {
      let text = String(query == null ? '' : query);
      for (const [sym, word] of Object.entries(SYMBOLS)) text = text.split(sym).join(word);
      const chunks = fold(text).split(/\s+/).filter(Boolean);
      const all = [];
      for (const chunk of chunks) {
        if (chunk === '+') { all.push({ key: 'plus', variants: [['plus']] }); continue; }
        const parts = splitParts(chunk);
        if (!parts.length) continue;
        if (parts.length === 1) { all.push({ key: parts[0], variants: [parts] }); continue; }
        const long = parts.filter((p) => p.length > 1 || /\d/.test(p));
        all.push({ key: parts.join(''), variants: [[parts.join('')], long.length ? long : parts] });
      }
      let terms = all.filter((t) => !STOPWORDS.has(t.key));
      if (!terms.length) terms = all;
      // Los getypte samenstelling ("video bellen", "prullen bak"): bestaat het aaneengeschreven
      // woord, dan mag de term ook als één woord passen
      for (let i = 0; i + 1 < terms.length; i++) {
        const a = terms[i];
        const b = terms[i + 1];
        const simple = (t) => t.variants.length === 1 && t.variants[0].length === 1;
        if (!simple(a) || !simple(b) || !vocab.has(a.key + b.key)) continue;
        terms.splice(i, 2, { key: a.key + b.key, variants: [[a.key + b.key], [a.key, b.key]] });
      }
      for (const t of terms) t.soft = SOFTWORDS.has(t.key);
      if (terms.every((t) => t.soft)) for (const t of terms) t.soft = false;
      const fullName = chunks.map((c) => splitParts(c).join('')).join('');
      return { terms, fullName };
    }

    // Term -> scores per icoon: de beste variant, een variant met delen telt gemiddeld
    function scoreParsed(term, scorer) {
      const accs = term.variants.map((parts) => {
        if (parts.length === 1) return scorer(parts[0]);
        const sub = parts.map(scorer);
        const acc = newAcc();
        for (let i = 0; i < count; i++) {
          let sum = 0;
          let ok = true;
          for (const s of sub) { if (!s.score[i]) { ok = false; break; } sum += s.score[i]; }
          if (!ok) continue;
          acc.score[i] = sum / sub.length;
          acc.first[i] = sub[0].first[i];
          acc.inName[i] = sub.some((s) => s.inName[i]) ? 1 : 0;
        }
        return acc;
      });
      if (accs.length === 1) return accs[0];
      const best = newAcc();
      for (const acc of accs) {
        for (let i = 0; i < count; i++) {
          if (acc.score[i] > best.score[i]) {
            best.score[i] = acc.score[i];
            best.first[i] = acc.first[i];
            best.inName[i] = acc.inName[i];
          } else if (acc.score[i] && acc.score[i] === best.score[i]) {
            // Gelijke stand tussen varianten ("e-mail" = email of mail): de vlaggen van beide tellen
            best.first[i] |= acc.first[i];
            best.inName[i] |= acc.inName[i];
          }
        }
      }
      return best;
    }

    const hasHits = (acc) => acc.score.some((s) => s > 0);

    /**
     * Sorteer treffers. partial: eerst het aantal passende zoekwoorden (matched),
     * en de punten wegen naar zeldzaamheid van het zoekwoord (weighted).
     */
    function sortHits(hits, accs, fullName, total, nameHits, matched) {
      const first = accs[0].first;
      return hits.sort((a, b) =>
        (matched ? matched[b] - matched[a] : 0)
        || (joined[b] === fullName) - (joined[a] === fullName)
        || total[b] - total[a]
        || first[b] - first[a]
        || stemLength[a] - stemLength[b]
        || variant[a] - variant[b]
        || nameHits[b] - nameHits[a]
        || a - b);
    }

    // Alle termen moeten passen (behalve kleine woorden); dan sorteren volgens de regels bovenaan
    function rankAll(terms, accs, fullName) {
      const hits = [];
      const total = new Float64Array(count);
      const nameHits = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        let sum = 0;
        let ok = true;
        for (let t = 0; t < accs.length; t++) {
          const acc = accs[t];
          if (!acc.score[i]) {
            if (terms[t].soft) continue;
            ok = false;
            break;
          }
          sum += acc.score[i];
          nameHits[i] += acc.inName[i];
        }
        if (!ok) continue;
        total[i] = Math.round(sum * 100) / 100;
        hits.push(i);
      }
      return sortHits(hits, accs, fullName, total, nameHits, null);
    }

    /**
     * Gedeeltelijke treffers bij twee of meer zoekwoorden ("prullenbak groot"):
     * minstens de helft moet passen. Meer passende woorden gaat voor; daarna
     * tellen zeldzame woorden zwaarder dan woorden die bij veel iconen passen.
     */
    function rankPartial(terms, accs, fullName) {
      const hard = terms.filter((t) => !t.soft).length;
      if (hard < 2) return [];
      const need = Math.ceil(hard / 2);
      const weight = accs.map((acc) => {
        let n = 0;
        for (let i = 0; i < count; i++) if (acc.score[i]) n++;
        return n ? Math.log((count + 1) / n) : 0;
      });
      const hits = [];
      const total = new Float64Array(count);
      const nameHits = new Uint8Array(count);
      const matched = new Uint8Array(count);
      for (let i = 0; i < count; i++) {
        let sum = 0;
        for (let t = 0; t < accs.length; t++) {
          const s = accs[t].score[i];
          if (!s) continue;
          if (!terms[t].soft) matched[i]++;
          sum += s * weight[t];
          nameHits[i] += accs[t].inName[i];
        }
        if (matched[i] < need) continue;
        total[i] = Math.round(sum * 100) / 100;
        hits.push(i);
      }
      return sortHits(hits, accs, fullName, total, nameHits, matched);
    }

    const allIds = Array.from({ length: count }, (_, i) => i);

    function search(query) {
      const { terms, fullName } = parse(query);
      if (!terms.length) return { ids: allIds.slice(), fuzzy: false };
      const accs = terms.map((t) => scoreParsed(t, scoreTerm));
      const ids = rankAll(terms, accs, fullName);
      if (ids.length) return { ids, fuzzy: false };
      // Vangnet: tikfouten alleen voor zoekwoorden die nergens op passen, dan alle
      // woorden samen; lukt dat niet, dan gedeeltelijke treffers
      let budget = MAX_FUZZY_TERMS;
      const fixed = accs.map((acc, t) => (hasHits(acc) || budget-- <= 0 ? acc : scoreParsed(terms[t], scoreFuzzy)));
      let guesses = rankAll(terms, fixed, fullName);
      if (!guesses.length) guesses = rankPartial(terms, fixed, fullName);
      return { ids: guesses, fuzzy: guesses.length > 0 };
    }

    // De doorzoekbare woorden van één icoon (om te debuggen of te tonen)
    function iconWords(index) {
      const entry = perIcon[index];
      return entry ? { naam: entry.name.slice(), nl: entry.nl.slice(), extra: entry.extra.slice(), categorie: entry.category.slice() } : null;
    }

    return { search, words: iconWords };
  }

  const PMIconSearch = { create, normalize: fold };
  global.PMIconSearch = PMIconSearch;
  if (typeof module !== 'undefined' && module.exports) module.exports = PMIconSearch;
})(typeof window !== 'undefined' ? window : globalThis);
