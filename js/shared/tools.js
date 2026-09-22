/* =============================================================================
   tools.js — register van alle tools in de Pure Minds Generator Hub
   -----------------------------------------------------------------------------
   Eén plek voor de hub (snelle starts, recente concepten en kaarten op
   index.html) én de toolwisselaar in de kop van elke tool. Een nieuwe tool
   toevoegen:

     1. Maak tools/<id>.html (kopieer de kop van een bestaande tool).
     2. Voeg hieronder een regel toe.

   Een tool die buiten de hub draait (een web-app elders, of een tool die je
   downloadt en op je eigen computer start) heeft geen pagina in tools/: zet
   dan kind op 'web' of 'lokaal' en href op de link of de download.

   Velden:
     id           korte naam, ook gebruikt als data-toolnav="<id>" in de kop
     name         naam op de kaart en in de kop
     short        korte naam voor de toolwisselaar
     href         pad vanaf de root van de site
     group        blok op het dashboard: een id uit PM_GROUPS (standaard 'design')
     kind         leeg = een pagina in deze hub; 'web' = web-app elders, opent in een
                  nieuw tabblad; 'lokaal' = downloaden en op je eigen computer starten
     guide        bij 'lokaal': id van de <dialog> met de uitleg in index.html
     category     soort: een sleutel uit PM_CATEGORIES (kopje boven de snelle starts)
     description  één korte zin op de kaart: wat maak je ermee
     exports      hoe je het meeneemt (PNG, PDF, Word ...); bij tools van buiten
                  de hub: wat je eruit krijgt
     cta          tekst op de knop van de kaart, begint met een werkwoord
     art          illustratie op de kaart: 'post' | 'doc' | 'slides' | 'consent' |
                  'ads' | 'seo' | 'hex'
     tone         'light' = de output is wit (briefpapier); anders donker zoals posts en slides
     status       'live' | 'nieuw' | 'binnenkort' (binnenkort = niet klikbaar)
     newUntil     tot deze datum (JJJJ-MM-DD) staat er "nieuw" op de kaart
     starts       snelle starts op het dashboard: [{ label, sub, ratio, stack, params }]
                  ratio = verhouding van het formaat ('1 / 1', '210 / 297' ...),
                  stack = meerdere pagina's (carousel), params gaan als
                  ?sleutel=waarde mee; de tool leest ze met PM.startParams()
     draft        het concept in deze browser: { key, summary(opgeslagen) }
                  summary geeft { title, sub, ratio } voor "Verder werken"
   ============================================================================= */
// Blokken op het dashboard, in deze volgorde. De technische tools krijgen
// een eigen, donker vlak: ze openen buiten de hub en werken anders.
window.PM_GROUPS = [
  { id: 'design', name: 'Design & content', short: 'design', lead: 'posts, documenten en presentaties, direct in de huisstijl' },
  { id: 'techniek', name: 'Techniek & analyse', short: 'techniek', tone: 'dark', lead: 'checks en analyses voor websites, ads en SEO. Ze openen buiten de hub: in een nieuw tabblad of op je eigen computer.' },
];

window.PM_CATEGORIES = {
  social: 'social media',
  documenten: 'documenten',
  presentaties: 'presentaties',
};

window.PM_TOOLS = [
  {
    id: 'insta',
    name: 'Insta Post Maker',
    short: 'posts',
    href: 'tools/insta.html',
    category: 'social',
    description: 'Posts voor Instagram en LinkedIn in vijf templates, van losse foto tot swipe-carousel.',
    exports: ['PNG', 'JPG', 'PDF'],
    cta: 'maak een post',
    art: 'post',
    status: 'live',
    starts: [
      { label: 'Instagram-post', sub: '1:1 · feed', ratio: '1 / 1', params: { template: 'overlay', format: 'square' } },
      { label: 'Story', sub: '9:16 · story, reel', ratio: '9 / 16', params: { template: 'overlay', format: 'story' } },
      { label: 'Carousel', sub: '4:5 · LinkedIn', ratio: '4 / 5', stack: true, params: { template: 'carousel', format: 'portrait' } },
    ],
    draft: {
      key: 'pm-postmaker-v1',
      summary(s) {
        const names = { photo: 'foto', overlay: 'foto met tekst', blog: 'blogpost', case: 'casepost', carousel: 'carousel' };
        const formats = { square: ['1:1', '1 / 1'], portrait: ['4:5', '4 / 5'], story: ['9:16', '9 / 16'] };
        const d = (s.data && s.data[s.template]) || {};
        const title = s.template === 'carousel' ? d.slides && d.slides[0] && d.slides[0].title : d.title || d.client || d.label;
        const f = formats[s.format] || formats.square;
        return { title, sub: [names[s.template], f[0]].filter(Boolean).join(' · '), ratio: f[1] };
      },
    },
  },
  {
    id: 'document',
    name: 'Document Maker',
    short: 'documenten',
    href: 'tools/document.html',
    category: 'documenten',
    description: 'Brief, offerte, memo of notitie op het A4-briefpapier van Pure Minds.',
    exports: ['PDF', 'Word', 'Google Docs', 'afdrukken'],
    cta: 'maak een document',
    art: 'doc',
    tone: 'light',
    status: 'nieuw',
    newUntil: '2026-11-01',
    starts: [
      { label: 'Brief', sub: 'A4 · briefpapier', ratio: '210 / 297', params: { type: 'brief' } },
      { label: 'Offerte', sub: 'A4 · met prijzen', ratio: '210 / 297', params: { type: 'offerte' } },
    ],
    draft: {
      key: 'pm-document-v1',
      summary: (s) => ({ title: s.title, sub: s.type, ratio: '210 / 297' }),
    },
  },
  {
    id: 'presentation',
    name: 'Presentation Maker',
    short: 'presentaties',
    href: 'tools/presentation.html',
    category: 'presentaties',
    description: 'Slides in zeven layouts, van titel en tabel tot kerncijfer en afsluiter.',
    exports: ['PDF', 'PowerPoint', 'Google Slides', 'PNG'],
    cta: 'maak een presentatie',
    art: 'slides',
    status: 'nieuw',
    newUntil: '2026-11-01',
    starts: [
      { label: 'Presentatie', sub: '16:9 · slides', ratio: '16 / 9', stack: true },
    ],
    draft: {
      key: 'pm-presentation-v1',
      summary: (s) => {
        const n = Array.isArray(s.slides) ? s.slides.length : 0;
        return { title: n ? s.slides[0].title || s.slides[0].label : '', sub: n === 1 ? '1 slide' : `${n} slides`, ratio: '16 / 9' };
      },
    },
  },
  {
    id: 'consent-check',
    name: 'Consent Check',
    group: 'techniek',
    kind: 'lokaal',
    href: 'https://github.com/Jelger1/consent-check/archive/refs/heads/main.zip',
    guide: 'guide-consent',
    description: 'Meet per website welke cookies en trackers er vóór en ná het cookie-akkoord laden.',
    exports: ['8 bevindingen', 'PDF', 'JSON'],
    cta: 'download',                  // zo heet de knop ook in de uitleg: "Klik op de 'Download' knop"
    art: 'consent',
    status: 'nieuw',
    newUntil: '2026-12-01',
  },
  {
    id: 'ads-optimizer',
    name: 'Landingpage & Ads Optimizer',
    group: 'techniek',
    kind: 'web',
    href: 'https://landingpage-ads-optimizer-qr13.vercel.app/',
    description: 'Checkt of je Google Ads-advertentie en je landingspagina op elkaar aansluiten, met een CRO-briefing in twee minuten.',
    exports: ['CRO-briefing', 'PDF', 'Word', 'Google Docs'],
    cta: 'check je campagne',
    art: 'ads',
    status: 'nieuw',
    newUntil: '2026-12-01',
  },
  {
    id: 'seo-gap',
    name: 'SEO Content Gap Analyzer',
    group: 'techniek',
    kind: 'web',
    href: 'https://seo-content-gap-analyzer-1yxm.vercel.app/',
    description: 'Zet je pagina naast de Google-top 10 en laat zien welke koppen, termen en vragen jij nog mist.',
    exports: ['contentbriefing', 'markdown'],
    cta: 'analyseer je pagina',
    art: 'seo',
    status: 'nieuw',
    newUntil: '2026-12-01',
  },
];
