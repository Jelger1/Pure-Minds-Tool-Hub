/* =============================================================================
   document/model.js — rekenwerk van de Document Maker, zonder DOM
   -----------------------------------------------------------------------------
   Alles wat geen pagina nodig heeft, zodat het getest kan worden
   (tests/document.test.js):

     EXAMPLE             de voorbeeldinhoud van een nieuw document
     parseAmount(tekst)  "€ 1.250,50" -> 1250.5, zoals een Nederlander typt
     formatAmount(n)     1250.5 -> "1.250,50" (aantal zonder decimalen)
     totals(regels, btw) subtotaal, btw en totaal van de offerteregels
     senderMissing(b)    ontbreken adres, KvK en e-mail nog in het briefpapier?
     exampleIssues(d)    welke velden hebben nog voorbeeldtekst of [invulplekken]?

   In de browser: window.PMDocModel. In Node: require('js/document/model.js').
   ============================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Voorbeeldinhoud: een nieuw document laat zien hoe het eruitziet
     ------------------------------------------------------------------------- */

  const EXAMPLE = Object.freeze({
    recipient: 'Naam contactpersoon\nBedrijfsnaam\nStraat 1\n1234 AB Plaats',
    salutation: 'Beste [naam],',
    body: [
      '<p>Bedankt voor het prettige gesprek van afgelopen week. In dit document zetten we op een rij wat we voor jullie gaan doen en wat je van ons mag verwachten.</p>',
      '<h2>Onze aanpak</h2>',
      '<ul><li>We starten met een analyse van de huidige campagnes en de landingspagina\'s.</li><li>Daarna maken we een plan met <strong>concrete doelen per kanaal</strong>.</li><li>Elke maand bespreken we de resultaten en stellen we bij.</li></ul>',
      '<p>Heb je vragen of wil je iets aanpassen? Laat het ons weten, dan passen we het voorstel aan.</p>',
    ].join(''),
    items: Object.freeze([
      Object.freeze({ desc: 'Strategiesessie en analyse', qty: 1, price: 950 }),
      Object.freeze({ desc: 'Campagnebeheer (per maand)', qty: 3, price: 650 }),
    ]),
  });

  /* ---------------------------------------------------------------------------
     Bedragen
     ------------------------------------------------------------------------- */

  // Bedragen zoals mensen ze typen of plakken: "€ 1.250,50", "1250.5", "950"
  function parseAmount(v) {
    let t = String(v || '').replace(/[€\s]/g, '');
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');   // 1.250,50
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');     // 1.250 (duizendtallen)
    else t = t.replace(/,/g, '');                                            // 1,250.00 of 1250.5
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }

  // Aantal of prijs in het veld, in het Nederlands: "1.250" of "1.250,50"
  function formatAmount(n, field) {
    const v = Number(n) || 0;
    const decimals = field === 'price' && v % 1 ? 2 : 0;
    return new Intl.NumberFormat('nl-NL', { minimumFractionDigits: decimals, maximumFractionDigits: 2 }).format(v);
  }

  // Lege regels tellen niet mee; btw in hele centen
  function totals(items, vat) {
    const rows = (items || []).filter((it) => String(it.desc || '').trim() || it.price);
    const subtotal = rows.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    const vatRate = Number(vat) || 0;
    const vatAmount = Math.round(subtotal * vatRate) / 100;
    return { rows, subtotal, vatRate, vat: vatAmount, total: subtotal + vatAmount };
  }

  /* ---------------------------------------------------------------------------
     Briefpapier: zonder adres, KvK en e-mail is de voet bijna leeg
     ------------------------------------------------------------------------- */

  const blank = (v) => !String(v == null ? '' : v).trim();
  const senderMissing = (s) => !s || (blank(s.street) && blank(s.kvk) && blank(s.email));

  /* ---------------------------------------------------------------------------
     Voorbeeldtekst: vóór een download zeggen waar die nog staat
     ------------------------------------------------------------------------- */

  // Een invulplek zoals [naam] of [bedrijf]: een woord tussen blokhaken
  const PLACEHOLDER = /\[[^[\]\n]{0,40}?[a-zà-ÿ][^[\]\n]{0,40}?\]/i;

  // Tekst uit de opgeschoonde HTML van de editor: blokken worden spaties
  function htmlText(html) {
    return String(html || '')
      .replace(/<\/?(p|h[1-6]|li|ul|ol|blockquote|div)\b[^>]*>|<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Zinnen uit de voorbeeldtekst die je niet toevallig zelf zo schrijft (korte koppen tellen niet)
  const EXAMPLE_SENTENCES = htmlText(EXAMPLE.body.replace(/<h2>[^<]*<\/h2>/g, ''))
    .split(/(?<=[.?!])\s+/)
    .filter((s) => s.length >= 40);
  const EXAMPLE_LINES = EXAMPLE.recipient.split('\n');

  const short = (text, max = 44) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
  };

  /**
   * Velden die nog voorbeeldtekst of een [invulplek] bevatten, in de volgorde
   * van het paneel: [{ key, label, found, match }]. found is kort genoeg om te
   * tonen, match is de hele gevonden tekst (om hem in het veld te selecteren).
   * Alleen velden die bij het soort document horen (en de ondertekening als
   * die aan staat).
   */
  function exampleIssues(d) {
    if (!d || typeof d !== 'object') return [];
    const type = d.type;
    const out = [];
    const add = (key, label, found) => out.push({ key, label, found: short(found), match: String(found) });
    const placeholder = (v) => {
      const m = PLACEHOLDER.exec(String(v || ''));
      return m ? m[0] : null;
    };
    const text = (key, label, value) => {
      const p = placeholder(value);
      if (p) add(key, label, p);
    };

    text('title', 'titel', d.title);
    if (type === 'brief' || type === 'offerte') {
      const label = type === 'offerte' ? 'klant' : 'adres';
      const lines = String(d.recipient || '').split('\n').map((l) => l.trim());
      const example = lines.find((l) => EXAMPLE_LINES.includes(l));
      if (example) add('recipient', label, example);
      else text('recipient', label, d.recipient);
    }
    if (type === 'brief') {
      text('reference', 'kenmerk', d.reference);
      text('salutation', 'aanhef', d.salutation);
    }
    if (type === 'offerte') text('quoteNumber', 'offertenummer', d.quoteNumber);
    if (type === 'memo') {
      text('memoTo', 'aan', d.memoTo);
      text('memoFrom', 'van', d.memoFrom);
      text('memoCc', 'cc', d.memoCc);
    }
    text('label', 'label', d.label);

    const body = htmlText(d.body);
    const sentence = EXAMPLE_SENTENCES.find((s) => body.includes(s));
    if (sentence) add('body', 'tekst', sentence);
    else text('body', 'tekst', body);

    if (type === 'offerte') {
      const items = Array.isArray(d.items) ? d.items : [];
      const same = items.find((it) => EXAMPLE.items.some((ex) => ex.desc === String(it.desc || '').trim() && ex.qty === Number(it.qty) && ex.price === Number(it.price)));
      const marked = items.find((it) => placeholder(it.desc));
      if (same) add('items', 'offerteregels', same.desc);
      else if (marked) add('items', 'offerteregels', placeholder(marked.desc));
    }

    if (d.showSignature) {
      text('closing', 'slotgroet', d.closing);
      text('signName', 'naam', d.signName);
      text('signRole', 'functie', d.signRole);
    }
    return out;
  }

  // "aanhef, adres en tekst"
  function listNames(names) {
    const list = (names || []).filter(Boolean);
    if (list.length < 2) return list.join('');
    return `${list.slice(0, -1).join(', ')} en ${list[list.length - 1]}`;
  }

  const api = { EXAMPLE, parseAmount, formatAmount, totals, senderMissing, htmlText, exampleIssues, listNames, PLACEHOLDER };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global && global.document) global.PMDocModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
