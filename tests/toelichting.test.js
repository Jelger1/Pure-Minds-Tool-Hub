/* Tests voor de nieuwe layouts van de positionering in js/presentation/templates.js: toelichting (tekst over twee kolommen), het business model canvas en de volle waardepropositie */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const G = require('../js/presentation/generator.js');

// canvas-kit en templates zoals de browser ze laadt
const W = (() => {
  const sandbox = { window: { PMGenerator: G } };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ['js/shared/canvas-kit.js', 'js/presentation/templates.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.window;
})();
const S = W.PMSlides;
const K = W.PMCanvas;
const plainJson = (v) => JSON.parse(JSON.stringify(v));

// Meten zonder browser: elk teken 0,55 × het korps breed, zodat de regelval vastligt
function fakeCtx() {
  let size = 10;
  return {
    set font(v) { size = parseFloat(/([\d.]+)px/.exec(v)[1]); },
    get font() { return `${size}px`; },
    measureText: (t) => ({ width: Array.from(String(t)).length * size * 0.55 }),
  };
}
// Het plan van één slide; over: of er iets niet paste
function planOf(slide) {
  K.flags.overflow = false;
  const deck = { slides: [slide], dot: true, showNumbers: false, badge: false };
  const p = S.plan(fakeCtx(), S.frame(), slide, {}, deck);
  return { p, over: K.flags.overflow };
}
const lines = (n, words = 6) => Array.from({ length: n }, (_, i) => `Regel ${i + 1} met ${'nog wat woorden '.repeat(words).trim()}`);
const points = (n, words = 2) => Array.from({ length: n }, (_, i) => `- Punt ${i + 1} ${'met woorden '.repeat(words).trim()}`).join('\n');
// De woorden van een tekst, zonder opmaak (vet, punten)
const words = (t) => String(t).replace(/\*\*/g, '').replace(/^\s*[-•]\s+/gm, '').split(/\s+/).filter(Boolean);
const lineText = (l) => l.segs.filter((s) => !s.space).map((s) => s.text).join(' ');

/* --- flowColumns: tekst over twee kolommen --- */

// Korps 10, regels 14 uit elkaar: een kolom van 136 px heeft plaats voor precies tien regels
const size = 10;
const lineH = 14;
const hOf = (n) => size * K.CAP + (n - 1) * lineH + size * K.DESC;
const item = (n, gapBefore = 0) => ({ n, h: hOf(n), gapBefore });
const flow = (items, heads = []) => plainJson(S.flowColumns(items, { colH: 136, size, lineH, heads }));
const pieces = (col) => col.map((pc) => [pc.item, pc.from, pc.to]);

test('flowColumns: eerst de linkerkolom vol, een item dat past komt er heel in', () => {
  const r = flow([item(3), item(3, 5), item(2, 5)]);
  assert.equal(r.fits, true);
  assert.deepEqual(pieces(r.columns[0]), [[0, 0, 3], [1, 0, 3], [2, 0, 2]]);
  assert.deepEqual(r.columns[1], []);
  // Bovenaan een kolom geen ruimte ervoor
  assert.equal(r.columns[0][0].y, 0);
  assert.ok(Math.abs(r.columns[0][1].y - (hOf(3) + 5)) < 1e-9);
});

test('flowColumns: splitsen op een regel als er links en rechts minstens twee regels komen', () => {
  // Na zes regels is er links nog plaats voor drie: drie blijven, vijf gaan naar rechts
  const r = flow([item(6), item(8, 5)]);
  assert.equal(r.fits, true);
  assert.deepEqual(pieces(r.columns[0]), [[0, 0, 6], [1, 0, 3]]);
  assert.deepEqual(pieces(r.columns[1]), [[1, 3, 8]]);
  assert.equal(r.columns[1][0].y, 0, 'het vervolg begint bovenaan de rechterkolom');
  // Eén regel links (na acht regels): het hele item naar rechts
  assert.deepEqual(pieces(flow([item(8), item(4, 5)]).columns[1]), [[1, 0, 4]]);
  // Er zouden maar drie regels van vier links passen, één naar rechts: ook heel naar rechts
  assert.deepEqual(pieces(flow([item(6), item(4, 5)]).columns[1]), [[1, 0, 4]]);
  // Hoger dan een hele kolom: altijd splitsen waar de kolom vol is
  const tall = flow([item(15)]);
  assert.deepEqual(pieces(tall.columns[0]), [[0, 0, 10]]);
  assert.deepEqual(pieces(tall.columns[1]), [[0, 10, 15]]);
});

test('flowColumns: een kopje onderaan links gaat mee naar rechts als zijn tekst daar begint', () => {
  const r = flow([item(8), item(1, 5), item(4, 3)], [false, true, false]);
  assert.equal(r.fits, true);
  assert.deepEqual(pieces(r.columns[0]), [[0, 0, 8]]);
  assert.deepEqual(pieces(r.columns[1]), [[1, 0, 1], [2, 0, 4]]);
  assert.equal(r.columns[1][0].y, 0);
  assert.ok(Math.abs(r.columns[1][1].y - (hOf(1) + 3)) < 1e-9, 'daaronder met de gewone ruimte');
  // Zonder kopje blijft het laatste stuk gewoon links staan
  assert.deepEqual(pieces(flow([item(8), item(1, 5), item(4, 3)]).columns[0]), [[0, 0, 8], [1, 0, 1]]);
});

test('flowColumns: past het ook rechts niet, dan fits false (de rest staat toch rechts)', () => {
  const r = flow([item(10), item(10, 5), item(10, 5)]);
  assert.equal(r.fits, false);
  assert.deepEqual(pieces(r.columns[0]), [[0, 0, 10]]);
  assert.deepEqual(pieces(r.columns[1]), [[1, 0, 10], [2, 0, 10]]);
});

/* --- layout toelichting --- */

test('toelichting: titel over de volle breedte, de tekst in twee kolommen, elke regel precies één keer', () => {
  const body = [...lines(14, 8), '', '**Een kopje**', points(12, 6)].join('\n');
  const { p, over } = planOf({ layout: 'toelichting', label: 'business model canvas', title: 'Klantrelaties', body });
  const fr = S.frame();
  const G2 = S.GEOM.toelichting;
  assert.equal(over, false);
  assert.equal(p.layout, 'toelichting');
  assert.equal(p.bottom, Math.round(fr.logo.y - G2.bottom));
  assert.deepEqual(plainJson(p.columns.map((c) => [c.x, c.w])), [[128, 784], [1008, 784]]);
  assert.equal(p.columns[0].top, p.columns[1].top);
  assert.ok(p.columns[0].top > fr.contentTop, 'onder de titel');
  assert.ok(p.columns.every((c) => c.pieces.length), 'beide kolommen gevuld');
  // Binnen de kolom, tot de onderkant
  for (const c of p.columns) for (const pc of c.pieces) assert.ok(c.top + pc.y + pc.h <= p.bottom + 1e-6);
  // Alle woorden, in volgorde
  const got = p.columns.flatMap((c) => c.pieces.flatMap((pc) => pc.lines.map(lineText))).join(' ');
  assert.deepEqual(words(got), words(body));
  // Een punt krijgt zijn zeshoekje alleen op het eerste stuk
  const all = p.columns.flatMap((c) => c.pieces);
  assert.equal(all.filter((pc) => pc.mark).length, 12);
  assert.ok(all.every((pc) => !pc.mark || pc.bullet));
  assert.equal(p.body.indent, p.body.st.size * 1.15);
  assert.equal(p.body.lineH, p.body.st.size * G2.lh);
});

test('toelichting: een korte tekst blijft op het grootste korps in de linkerkolom; te veel tekst meldt het', () => {
  const kort = planOf({ layout: 'toelichting', label: '', title: 'Kanalen', body: 'Een korte alinea.' });
  assert.equal(kort.p.body.st.size, S.GEOM.toelichting.text);
  assert.equal(kort.p.columns[1].pieces.length, 0);
  const veel = planOf({ layout: 'toelichting', label: '', title: 'Kanalen', body: lines(200, 12).join('\n') });
  assert.equal(veel.over, true);
  assert.equal(veel.p.body.st.size, S.GEOM.toelichting.textMin);
});

/* --- layout bmc --- */

const BMC_KEYS = ['partners', 'activiteiten', 'resources', 'proposities', 'relaties', 'kanalen', 'segmenten'];

test('bmc: vijf kolommen tussen label en ondermarge (geen logo), kolom 4 verdeeld, de blokken in de volgorde van BMC_KEYS', () => {
  const bmc = { ...G.emptyBmc(), partners: points(4), resources: points(3), relaties: points(3), kanalen: points(6) };
  const { p } = planOf({ layout: 'bmc', label: 'business model canvas', title: '', bmc });
  const fr = S.frame();
  const B = S.GEOM.bmc;
  const top = Math.round(fr.labelTop + fr.labelSize * K.CAP + B.top);
  const bottom = Math.round(fr.h - fr.v - B.bottom);
  assert.equal(p.layout, 'bmc');
  assert.equal(p.panels.length, 6);
  assert.deepEqual(plainJson(p.panels.map((q) => Math.round(q.x))), [128, 464, 800, 1136, 1136, 1472]);
  assert.ok(p.panels.every((q) => q.w === 320));
  // Onder het label (minstens 24 px); zonder voetregel tot de ondermarge, ver onder
  // de oude onderkant (boven het logo) en nooit in de marge
  assert.ok(top >= fr.labelTop + fr.labelSize * K.CAP + 24 && top <= 170, `bovenkant ${top}`);
  assert.ok(bottom > fr.logo.y && bottom <= fr.h - fr.v, `onderkant ${bottom}`);
  for (const i of [0, 1, 2, 5]) assert.deepEqual([p.panels[i].y, p.panels[i].h], [top, bottom - top]);
  // Kolom 4: Klantrelaties boven, Kanalen onder, samen met de ruimte ertussen even hoog
  const [p3, p4] = [p.panels[3], p.panels[4]];
  assert.equal(p3.y, top);
  assert.equal(p4.y, top + p3.h + B.gap);
  assert.equal(p4.y + p4.h, bottom);
  const room = bottom - top - B.gap;
  assert.ok(p3.h >= room * B.splitMin - 0.5 && p3.h <= room * B.splitMax + 0.5);
  assert.ok(p4.h > p3.h, 'Kanalen heeft meer tekst, dus meer ruimte');
  assert.deepEqual(plainJson(p.blocks.map((b) => b.key)), BMC_KEYS);
  // Key Resources onder een lijn in kolom 1; de tekst binnen zijn vlak
  assert.equal(p.rules.length, 1);
  const [partners, , resources] = p.blocks;
  assert.ok(p.rules[0].y > partners.top + partners.stack.height && p.rules[0].y < resources.top);
  assert.equal(partners.y + partners.h, p.rules[0].y);
  for (const b of p.blocks) {
    const q = p.panels[{ partners: 0, resources: 0, activiteiten: 1, proposities: 2, relaties: 3, kanalen: 4, segmenten: 5 }[b.key]];
    assert.ok(b.x >= q.x && b.x + b.w <= q.x + q.w, `${b.key}: binnen de breedte`);
    assert.ok(b.top >= q.y + B.bar && b.top + b.stack.height <= q.y + q.h, `${b.key}: binnen de hoogte`);
  }
});

test('bmc: kolom 4 naar inhoud, maar nooit minder dan 35% of meer dan 65%', () => {
  const B = S.GEOM.bmc;
  const room = (p) => p.panels[3].h + p.panels[4].h;
  const leeg = planOf({ layout: 'bmc', label: '', title: '', bmc: { ...G.emptyBmc(), kanalen: points(14) } }).p;
  assert.equal(leeg.panels[3].h, Math.round(room(leeg) * B.splitMin));
  const vol = planOf({ layout: 'bmc', label: '', title: '', bmc: { ...G.emptyBmc(), relaties: points(14) } }).p;
  assert.equal(vol.panels[3].h, Math.round(room(vol) * B.splitMax));
});

test('bmc: een leeg blok toont zijn uitleg, een gevuld blok de tekst op hetzelfde korps; te vol meldt het', () => {
  const { p } = planOf({ layout: 'bmc', label: '', title: '', bmc: { ...G.emptyBmc(), proposities: '**Kop**\n- Een\n- Twee' } });
  const block = (key) => p.blocks.find((b) => b.key === key).stack.blocks;
  assert.equal(block('proposities')[1].body, '**Kop**\n- Een\n- Twee');
  assert.deepEqual(words(block('partners')[1].runs.map((r) => r.text).join('')), words(G.BMC_INFO.partners.uitleg));
  assert.equal(block('partners')[0].runs.map((r) => r.text).join(''), 'Key Partners');
  // Alleen ** telt als leeg
  const sterren = planOf({ layout: 'bmc', label: '', title: '', bmc: { ...G.emptyBmc(), kanalen: '** **' } }).p;
  assert.equal(sterren.blocks.find((b) => b.key === 'kanalen').stack.blocks[1].body, undefined);
  const te = planOf({ layout: 'bmc', label: '', title: '', bmc: { ...G.emptyBmc(), proposities: points(80, 4) } });
  assert.equal(te.over, true);
  assert.equal(te.p.blocks[3].stack.blocks[1].block.st.size, S.GEOM.bmc.itemMin);
});

/* --- vpc: kopjes in een vak, en de volle variant van de positionering --- */

test('zoneLines: elke regel een punt, behalve kopjes (hele regel vet); één lege regel vóór een kopje', () => {
  assert.equal(S.zoneLines('**Verwachte voordelen**\nGoed\n\n\n**Gewenste voordelen:**\n- Snel\n• Mooi\n  - Genest'),
    '**Verwachte voordelen**\n- Goed\n\n**Gewenste voordelen:**\n- Snel\n• Mooi\n- Genest');
  // Een vet label met uitleg is een gewoon punt; lege regels elders verdwijnen, zoals voorheen
  assert.equal(S.zoneLines('\n**Prijs:** scherp\n\nService'), '- **Prijs:** scherp\n- Service');
  assert.equal(S.zoneLines(''), '');
});

test('LAYOUTS: zeven voor elke presentatie, vier erbij voor voorstel en positionering, twee alleen voor de positionering', () => {
  const ids = (type) => plainJson(S.LAYOUTS.filter((l) => !l.types || l.types.includes(type)).map((l) => l.id));
  assert.deepEqual(ids('regulier'), ['title', 'section', 'bullets', 'split', 'quote', 'table', 'closing']);
  assert.deepEqual(ids('voorstel'), [...ids('regulier'), 'tekst', 'kolommen', 'vragen', 'vpc']);
  assert.deepEqual(ids('positionering'), [...ids('voorstel'), 'bmc', 'toelichting']);
  assert.ok(S.LAYOUTS.every((l) => !('group' in l)));
  assert.deepEqual(plainJson(S.LAYOUTS.find((l) => l.id === 'bmc')), { id: 'bmc', name: 'Business Model Canvas', sub: 'zeven blokken', types: ['positionering'] });
  assert.deepEqual(plainJson(S.LAYOUTS.find((l) => l.id === 'toelichting')), { id: 'toelichting', name: 'Toelichting', sub: 'tekst in twee kolommen', types: ['positionering'] });
});

test('layoutBody: itemGap zet de ruimte tussen de punten, zonder blijft het een half korps', () => {
  const st = { size: 20, weight: 400, emWeight: 700, track: 0, lh: 1.3 };
  const gapOf = (b) => b.items[1].y - b.items[0].block.height;
  assert.equal(gapOf(K.layoutBody(fakeCtx(), '- Een\n- Twee', 500, st)), 10);
  assert.equal(gapOf(K.layoutBody(fakeCtx(), '- Een\n- Twee', 500, { ...st, itemGap: 0.2 })), 4);
});

// Een volle waardepropositie zoals in de referenties: kopjes met punten, lange zinnen
const VOL = {
  verschaffers: '**Prijs:** scherp voor een goede kwaliteit\n**Kennis:** advies vanuit jarenlange ervaring\n**Ontzorging:** van keuze tot plaatsing\n**Inrichting:** advies op ruimte en looproutes\n**Begeleiding:** de klant wordt actief meegenomen\n**Service:** problemen worden snel opgelost',
  producten: 'Meubilair voor horeca\nBinnen- en terrasmeubilair\nPersoonlijk advies\nComplete projectinrichting\nMaatwerk en interieurbouw\nLevering, montage en service',
  verzachters: 'Helpt bepalen waar je moet beginnen\nMinder keuzestress met gericht advies\nMaakt budget vroeg inzichtelijk\nDenkt mee over de indeling\nNeemt levering en montage uit handen\nLost problemen snel en persoonlijk op',
  taken: 'Een nieuwe zaak inrichten\nEen bestaande zaak vernieuwen of verbeteren\nGeschikt meubilair selecteren\nDe indeling bepalen\nDe gewenste uitstraling realiseren\nKeuzes maken binnen het budget\nZitcapaciteit en bedrijfsvoering optimaliseren',
  voordelen: '**Verwachte voordelen**\nGoede prijs-kwaliteitverhouding\nDeskundig en persoonlijk advies\nBetrouwbare leverancier\nPassende oplossing binnen budget\n\n**Gewenste voordelen**\nZo min mogelijk zelf regelen\nPraktische en mooie inrichting\nEén partij voor alles\nZekerheid bij de materiaalkeuze\n\n**Onverwachte voordelen**\nMeer kennis dan verwacht\nKwaliteit beter dan verwacht\nSterke service bij problemen\nVolledig gemonteerde levering',
  pijnen: 'Niet weten waar te beginnen\nMoeite met de juiste keuzes\nOnzekerheid over budget en kosten\nTwijfel over kwaliteit\nEen verkeerde indeling hindert\nVeel zelf moeten regelen\nPersoneelstekort vraagt om een andere inrichting\nGedoe als producten niet voldoen',
};

// Afstand van een rechthoek tot een lijnstuk (0 als ze elkaar raken)
function rectSegDist(r, l) {
  const inside = (x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
  const edges = [[0, 1], [1, 3], [3, 2], [2, 0]].map(([a, b]) => [...corners[a], ...corners[b]]);
  // Snijdt het lijnstuk de rechthoek? Dan ligt een punt ervan erin (fijn genoeg bemonsterd)
  for (let i = 0; i <= 200; i++) if (inside(l.x1 + (l.x2 - l.x1) * (i / 200), l.y1 + (l.y2 - l.y1) * (i / 200))) return 0;
  return Math.min(
    ...corners.map(([x, y]) => segDist(x, y, l.x1, l.y1, l.x2, l.y2)),
    ...edges.flatMap(([ax, ay, bx, by]) => [segDist(l.x1, l.y1, ax, ay, bx, by), segDist(l.x2, l.y2, ax, ay, bx, by)]),
  );
}

test('volle waardepropositie: de tekst loopt door het hele vak, zonder lijnen, rand of zeshoek te raken', () => {
  const { p, over } = planOf({ layout: 'vpc', label: 'waarde propositie canvas', title: '', style: 'vol', vpc: { ...G.emptyVpc(), ...VOL } });
  const V = S.GEOM.vpc.vol;
  const { square: sq, circle: ci } = p;
  assert.equal(over, false);
  assert.ok(p.zones.length > 6, 'minstens één vak loopt door in meer stroken');
  const hubs = [[sq.x + sq.s / 2, sq.y + sq.s / 2], [ci.cx, ci.cy]];
  for (const z of p.zones) {
    // De tekst zoals hij getekend wordt: van z.top, zo hoog als de stapel, binnen de breedte
    const r = { x: z.x, y: z.top, w: z.w, h: z.stack.height };
    const name = `${z.key} (${Math.round(r.x)}, ${Math.round(r.y)})`;
    for (const l of p.inner) assert.ok(rectSegDist(r, l) >= 8 - 1e-6, `${name}: van de binnenlijnen`);
    for (const [hx, hy] of hubs) {
      const dx = Math.max(r.x - hx, 0, hx - (r.x + r.w));
      const dy = Math.max(r.y - hy, 0, hy - (r.y + r.h));
      assert.ok(Math.hypot(dx, dy) >= S.GEOM.vpc.hubR + 8 - 1e-6, `${name}: van de zeshoek`);
    }
    const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
    if (['verschaffers', 'verzachters', 'producten'].includes(z.key)) {
      assert.ok(corners.every(([x, y]) => x >= sq.x + 8 && x <= sq.x + sq.s - 8 && y >= sq.y + 8 && y <= sq.y + sq.s - 8), `${name}: in het vierkant`);
    } else {
      assert.ok(corners.every(([x, y]) => Math.hypot(x - ci.cx, y - ci.cy) <= ci.r - 8 + 1e-6), `${name}: in de cirkel`);
    }
    // In zijn eigen vak
    const mx = r.x + r.w / 2;
    const my = r.y + r.h / 2;
    const side = {
      verschaffers: my < sq.y + sq.s / 2, verzachters: my > sq.y + sq.s / 2, producten: mx < sq.x + sq.s / 2,
      taken: mx - ci.cx > Math.abs(my - ci.cy), voordelen: my < ci.cy, pijnen: my > ci.cy,
    }[z.key];
    assert.ok(side, `${name}: in het goede vak`);
    assert.ok(z.w >= V.minW || z.stack.blocks.length, `${name}: breed genoeg`);
  }
  // Per vak: alle woorden, in volgorde, de kop alleen in de eerste strook; de stroken onder elkaar
  for (const [key, text] of Object.entries(VOL)) {
    const zs = p.zones.filter((z) => z.key === key);
    const got = zs.flatMap((z) => z.stack.blocks.map((b) => (b.body != null ? b.body : b.runs.map((x) => x.text).join(''))));
    const head = zs[0].stack.blocks[0].runs.map((x) => x.text).join('');
    assert.deepEqual(words(got.join('\n')), words(`${head}\n${text}`), `${key}: alle woorden in volgorde`);
    assert.ok(zs.slice(1).every((z) => z.stack.blocks.every((b) => b.body != null)), `${key}: de kop alleen bovenaan`);
    zs.slice(1).forEach((z, i) => assert.ok(z.top >= zs[i].top + zs[i].stack.height, `${key}: stroken onder elkaar`));
  }
  // Eén schaal: overal hetzelfde korps
  const sizes = new Set(p.zones.flatMap((z) => z.stack.blocks.filter((b) => b.body != null).map((b) => b.block.st.size)));
  assert.equal(sizes.size, 1);
  assert.ok([...sizes][0] >= V.itemMin);
});

test('volle waardepropositie: weinig tekst staat in dezelfde vakken als in het voorstel; het voorstel verandert niet', () => {
  const vpc = { ...G.emptyVpc(), taken: 'Bellen\nMailen', pijnen: 'Wachten', voordelen: '**Snel**\nMinder werk' };
  const vol = planOf({ layout: 'vpc', label: '', title: '', style: 'vol', vpc }).p;
  const gewoon = planOf({ layout: 'vpc', label: '', title: '', vpc }).p;
  assert.equal(vol.zones.length, 6);
  assert.deepEqual(plainJson(vol.zones.map((z) => [z.key, z.x, z.y, z.w, z.h])), plainJson(gewoon.zones.map((z) => [z.key, z.x, z.y, z.w, z.h])));
  // In de positionering heet het vak zoals zijn toelichting-slide, in het voorstel zoals VPC_INFO
  const head = (p, key) => p.zones.find((z) => z.key === key).stack.blocks[0].runs.map((x) => x.text).join('');
  assert.equal(head(gewoon, 'producten'), G.VPC_INFO.producten.name);
  // Het voorstel: een kopje zonder punt, de rest met; het korps niet kleiner dan voorheen (18/16)
  const body = gewoon.zones.find((z) => z.key === 'voordelen').stack.blocks[1];
  assert.equal(body.body, '**Snel**\n- Minder werk');
  assert.ok(body.block.st.size >= 16);
});

test('volle waardepropositie: te veel tekst meldt het, en de tekst blijft zichtbaar in het vak', () => {
  const vpc = { ...G.emptyVpc(), ...VOL, voordelen: `${VOL.voordelen}\n\n${VOL.voordelen}\n\n${VOL.voordelen}` };
  const { p, over } = planOf({ layout: 'vpc', label: '', title: '', style: 'vol', vpc });
  assert.equal(over, true);
  const zs = p.zones.filter((z) => z.key === 'voordelen');
  const got = zs.flatMap((z) => z.stack.blocks.map((b) => (b.body != null ? b.body : b.runs.map((x) => x.text).join(''))));
  assert.equal(words(got.join('\n')).length, words(`Voordelen\n${vpc.voordelen}`).length, 'niets weggelaten');
});

/* --- welk blok of vak niet past: daar brengt de melding je heen --- */

// renderSlide zonder browser: een canvas waarvan elke tekenopdracht niets doet, en dat meet als fakeCtx
function fakeCanvas() {
  const noop = () => ({ addColorStop() {} });
  const ctx = new Proxy(fakeCtx(), { get: (t, k) => (k in t ? t[k] : noop) });
  return { width: 0, height: 0, getContext: () => ctx };
}
const overflowKeys = (slide) => plainJson(S.renderSlide(fakeCanvas(), { slides: [slide], dot: true, showNumbers: false, badge: false }, 0, {}).overflowKeys);

test('te vol canvas: eerst het canvas (de melding), dan het blok of vak dat niet past', () => {
  const bmc = (extra) => overflowKeys({ layout: 'bmc', label: '', title: '', bmc: { ...G.emptyBmc(), partners: points(3), ...extra } });
  // Niet het eerste blok met tekst (Key Partners), maar het blok dat te lang is
  assert.deepEqual(bmc({ proposities: points(80, 4) }), ['bmc', 'bmc:proposities']);
  // Kolom 1 (Key Partners en Key Resources samen): het langste van de twee; kolom 4: het paneel dat niet past
  assert.deepEqual(bmc({ resources: points(60, 4) }), ['bmc', 'bmc:resources']);
  assert.deepEqual(bmc({ relaties: points(40, 3), kanalen: points(2) }), ['bmc', 'bmc:relaties']);
  // Het meest te lange blok eerst
  assert.deepEqual(bmc({ activiteiten: points(40, 4), segmenten: points(80, 4) }).slice(0, 2), ['bmc', 'bmc:segmenten']);
  assert.deepEqual(bmc({}), []);
  // De volle waardepropositie: het vak; de gewone (het voorstel) meldt alleen het canvas, zoals altijd
  const vpc = { ...G.emptyVpc(), taken: 'Bellen', voordelen: points(60, 4) };
  assert.deepEqual(overflowKeys({ layout: 'vpc', label: '', title: '', style: 'vol', vpc }), ['vpc', 'vpc:voordelen']);
  assert.deepEqual(overflowKeys({ layout: 'vpc', label: '', title: '', vpc }), ['vpc']);
});

test('LAYOUTS: de waardepropositie heet in de positionering zoals het canvas', () => {
  const vpc = S.LAYOUTS.find((l) => l.id === 'vpc');
  assert.equal(vpc.name, 'Waardepropositie');
  assert.deepEqual(plainJson(vpc.names), { positionering: 'Waarde Propositie Canvas' });
});

/* --- bmc en vpc zonder voetregel: meer ruimte voor de tekst --- */

// Een canvas dat de tekst en de beelden onthoudt (de rest doet niets, meten zoals fakeCtx)
function recordingCanvas() {
  const noop = () => ({ addColorStop() {} });
  const log = { text: [], images: [] };
  const base = fakeCtx();
  base.fillText = (t) => log.text.push(String(t));
  base.drawImage = (img) => log.images.push(img.name);
  const ctx = new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop) });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, log };
}
const img = (name) => ({ name, complete: true, naturalWidth: 100, naturalHeight: 100 });
const canvasSlides = () => [
  { layout: 'bmc', label: 'business model canvas', title: '', bmc: { ...G.emptyBmc(), partners: points(4) } },
  { layout: 'vpc', label: 'waardepropositie', title: '', vpc: { ...G.emptyVpc(), taken: points(3) } },
  { layout: 'vpc', label: 'waarde propositie canvas', title: '', style: 'vol', vpc: { ...G.emptyVpc(), taken: points(3) } },
];

test('bmc en vpc: de vormen lopen onder de oude onderkant door, tot de ondermarge, binnen de zijmarges', () => {
  const fr = S.frame();
  const [bmc, vpc, vol] = canvasSlides().map((s) => planOf(s).p);
  const bottom = Math.max(...bmc.panels.map((q) => q.y + q.h));
  assert.ok(bottom > fr.contentBottom + 100, `bmc tot ${bottom}`);
  assert.ok(bottom <= fr.h - fr.v);
  for (const p of [vpc, vol]) {
    const { square: sq, circle: ci } = p;
    assert.ok(sq.y + sq.s > fr.contentBottom + 100 && ci.cy + ci.r > fr.contentBottom + 100, 'vierkant en cirkel lager dan voorheen');
    assert.ok(sq.y + sq.s <= fr.h - fr.v && ci.cy + ci.r <= fr.h - fr.v, 'niet in de ondermarge');
    assert.ok(sq.x >= fr.m && ci.cx + ci.r <= fr.w - fr.m, 'binnen de zijmarges');
    assert.ok(sq.y - S.GEOM.vpc.captionGap - S.GEOM.vpc.captionSize > fr.labelTop + fr.labelSize, 'onderschrift onder het label');
    assert.ok(ci.cx - ci.r > sq.x + sq.s, 'cirkel naast het vierkant');
  }
});

test('bmc en vpc: geen pureminds.nl, slidenummer, badge of logo; andere slides houden ze', () => {
  const slides = [...canvasSlides(), { layout: 'bullets', label: 'aanpak', title: 'Zo werken we', body: '- Eén' }];
  const deck = { slides, dot: true, showNumbers: true, badge: true };
  const env = { logo: img('logo'), badge: img('badge') };
  const fr = S.frame();
  slides.forEach((s, i) => {
    const { canvas, log } = recordingCanvas();
    S.renderSlide(canvas, deck, i, env);
    const footer = log.text.includes('pureminds') || log.text.some((t) => / \/ 04$/.test(t));
    if (s.layout === 'bullets') {
      assert.ok(footer, 'gewone slide: voetregel en nummer');
      assert.deepEqual(plainJson(log.images), ['badge', 'logo']);
      assert.ok(S.badgeBox(fakeCtx(), fr, deck, i));
    } else {
      assert.ok(!footer, `${s.layout}${s.style ? ` ${s.style}` : ''}: geen voetregel of nummer`);
      assert.deepEqual(plainJson(log.images), [], 'geen badge en geen logo');
      assert.equal(S.badgeBox(fakeCtx(), fr, deck, i), null);
      assert.ok(S.bare(s));
    }
  });
});
