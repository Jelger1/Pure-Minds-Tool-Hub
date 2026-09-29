"""
Zet alle Remix-iconen in deze map om naar Pure Minds-zeshoekiconen (punt boven).

Er komen drie varianten, elk in een eigen map onder Zeshoek/, met dezelfde
categorieën en bestandsnamen als het origineel:
- Blauw:  effen Pure Cyaan (#1ab9e2), wit icoon
- Donker: antraciet zeshoek, wit icoon
- Wit:    effen witte zeshoek, donker icoon
Alle varianten zijn effen: geen verloop en geen rand.
Daarnaast komt er een overzicht.html om alles te bekijken en te doorzoeken.

Keuzes:
- De coördinaten worden direct in het pad omgerekend (geen transform), zodat de
  bestanden overal hetzelfde tonen: browser, Figma, Illustrator, PowerPoint.
- Alle iconen krijgen dezelfde schaal, gecentreerd op het midden van het
  24-raster. Zo blijft de optische balans van Remix intact (een play-knop staat
  bewust iets rechts, signaalbalkjes staan bewust onderin).
- Alleen iconen die te dicht bij de schuine randen komen, worden iets kleiner
  gemaakt, zodat niets tegen de rand aan plakt.
- De witte variant is bedoeld voor een gekleurde of donkere achtergrond; op
  wit valt hij weg. Een variant kan nog wel een verloop of een rand krijgen
  (zie VARIANTEN); een rand is dan een tweede vlak in plaats van een stroke,
  omdat een stroke aan de buitenkant door de viewBox wordt afgesneden.

Opnieuw draaien:  python maak-zeshoeken.py
"""
import json
import math
import os
import re

# --- Instellingen ------------------------------------------------------------

BRON = os.path.dirname(os.path.abspath(__file__))
DOEL = os.path.join(BRON, 'Zeshoek')

HOOGTE = 64.0          # hoogte van de zeshoek (viewBox); breedte volgt uit de vorm
AFRONDING = 0.12       # hoekradius als deel van de straal; 0 geeft scherpe punten
ICOONBREEDTE = 0.54    # het 20-eenheden-werkvlak van Remix t.o.v. de zeshoekbreedte
MAX_VULLING = 0.78     # verste punt van een icoon, als deel van de afstand tot de rand

# Per variant: vlak is één kleur of (boven, onder) voor een verloop;
# rand is optioneel en heeft een dikte in viewBox-eenheden.
VARIANTEN = {
    'Blauw': {'vlak': '#1ab9e2', 'icoon': '#ffffff'},
    'Donker': {'vlak': '#303030', 'icoon': '#ffffff'},
    'Wit': {'vlak': '#ffffff', 'icoon': '#303030'},
}

# --- Padbewerking -------------------------------------------------------------

# Remix gebruikt alleen absolute M, L, H, V, C en Z; relatieve commando's komen niet voor.
TOKEN = re.compile(r'([MLHVCZ])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)')
AANTAL = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'C': 6, 'Z': 0}
WORTEL3_2 = math.sqrt(3) / 2


def segmenten(d):
    """Splitst een pad in losse (commando, getallen)-stappen, ook bij herhaalde getallen."""
    uit, cmd, buf = [], None, []

    def leeg():
        if cmd is None or cmd == 'Z':
            return
        n, c = AANTAL[cmd], cmd
        for i in range(0, len(buf), n):
            uit.append((c, buf[i:i + n]))
            if c == 'M':
                c = 'L'  # extra coördinaten na M zijn lijnstukken

    for letter, getal in TOKEN.findall(d):
        if letter:
            leeg()
            cmd, buf = letter, []
            if letter == 'Z':
                uit.append(('Z', []))
        elif getal:
            buf.append(float(getal))
    leeg()
    if any(c not in 'MLHVCZ' for c in re.findall(r'[A-Za-z]', d)):
        raise ValueError('onbekend padcommando')
    return uit


def punten(d, stappen=24):
    """Punten langs het pad, met bochten bemonsterd, om de omvang te meten."""
    pts, x, y, sx, sy = [], 0.0, 0.0, 0.0, 0.0
    for c, a in segmenten(d):
        if c == 'M':
            x, y = a
            sx, sy = a
        elif c == 'L':
            x, y = a
        elif c == 'H':
            x = a[0]
        elif c == 'V':
            y = a[0]
        elif c == 'C':
            x1, y1, x2, y2, x3, y3 = a
            for i in range(1, stappen + 1):
                t = i / stappen
                u = 1 - t
                pts.append((u**3 * x + 3*u*u*t * x1 + 3*u*t*t * x2 + t**3 * x3,
                            u**3 * y + 3*u*u*t * y1 + 3*u*t*t * y2 + t**3 * y3))
            x, y = x3, y3
        elif c == 'Z':
            x, y = sx, sy
        pts.append((x, y))
    return pts


def zeshoekafstand(x, y):
    """Afstand tot het midden gemeten in de vorm van een zeshoek met punt boven."""
    x, y = abs(x), abs(y)
    return max(x, 0.5 * x + WORTEL3_2 * y)


def getal(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


def verschuif(d, s, tx, ty):
    """Schaalt en verplaatst een pad door de coördinaten zelf om te rekenen."""
    uit = []
    for c, a in segmenten(d):
        if c in 'ML':
            uit.append(f'{c}{getal(a[0]*s + tx)} {getal(a[1]*s + ty)}')
        elif c == 'H':
            uit.append(f'H{getal(a[0]*s + tx)}')
        elif c == 'V':
            uit.append(f'V{getal(a[0]*s + ty)}')
        elif c == 'C':
            uit.append('C' + ' '.join(getal(v*s + (tx if i % 2 == 0 else ty)) for i, v in enumerate(a)))
        else:
            uit.append('Z')
    return ''.join(uit)

# --- Zeshoek ------------------------------------------------------------------


def zeshoekpad(mx, my, R, r):
    """Zeshoek met punt boven, straal R en hoekradius r, rond (mx, my)."""
    hoeken = [(mx + R * math.cos(math.radians(-90 + 60 * i)),
               my + R * math.sin(math.radians(-90 + 60 * i))) for i in range(6)]
    if r <= 0:
        return 'M' + 'L'.join(f'{getal(x)} {getal(y)}' for x, y in hoeken) + 'Z'

    raak = r / math.sqrt(3)  # afstand van hoekpunt tot begin van de boog (hoek 120°)

    def richting(a, b):
        lengte = math.dist(a, b)
        return (a[0] + (b[0] - a[0]) * raak / lengte, a[1] + (b[1] - a[1]) * raak / lengte)

    voor = [richting(hoeken[i], hoeken[i - 1]) for i in range(6)]
    na = [richting(hoeken[i], hoeken[(i + 1) % 6]) for i in range(6)]
    delen = [f'M{getal(na[0][0])} {getal(na[0][1])}']
    for i in [1, 2, 3, 4, 5, 0]:
        delen.append(f'L{getal(voor[i][0])} {getal(voor[i][1])}')
        delen.append(f'A{getal(r)} {getal(r)} 0 0 1 {getal(na[i][0])} {getal(na[i][1])}')
    return ''.join(delen) + 'Z'


def zeshoek():
    """Maat en middelpunt van de zeshoek, precies passend in de viewBox."""
    # Een afgeronde punt ligt iets binnen de scherpe punt; de straal wordt daarop
    # vergroot zodat de vorm de viewBox van boven tot onder vult.
    R = (HOOGTE / 2) / (1 - (2 / math.sqrt(3) - 1) * AFRONDING)
    B = math.sqrt(3) * R
    return {'breedte': B, 'mx': B / 2, 'my': HOOGTE / 2, 'R': R, 'r': AFRONDING * R,
            'binnenstraal': B / 2}


def plaats_icoon(d, vorm):
    """Rekent het icoon om naar de zeshoek; geeft ook terug of het verkleind is."""
    s = ICOONBREEDTE * vorm['breedte'] / 20
    grens = MAX_VULLING * vorm['binnenstraal']
    verst = max(zeshoekafstand(x - 12, y - 12) for x, y in punten(d))
    verkleind = verst * s > grens
    if verkleind:
        s = grens / verst
    return verschuif(d, s, vorm['mx'] - 12 * s, vorm['my'] - 12 * s), verkleind


def vlakken(variant, vorm, naam):
    """De achtergrondlagen van een variant: defs (voor een verloop) en paden."""
    mx, my, R, r = vorm['mx'], vorm['my'], vorm['R'], vorm['r']
    vlak, defs, lagen = variant['vlak'], '', []

    if 'rand' in variant:
        # Binnenste zeshoek evenwijdig ingezet, zodat de rand overal even dik is.
        kleur, dikte = variant['rand']
        lagen.append(f'<path fill="{kleur}" d="{zeshoekpad(mx, my, R, r)}"/>')
        R, r = R - dikte / WORTEL3_2, max(r - dikte, 0)

    if isinstance(vlak, tuple):
        # Unieke id per bestand, zodat meerdere iconen op één pagina elkaar niet storen.
        gid = 'pm-' + re.sub(r'[^a-z0-9-]', '', naam.lower())
        defs = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
                f'<stop offset="0" stop-color="{vlak[0]}"/><stop offset="1" stop-color="{vlak[1]}"/>'
                f'</linearGradient></defs>')
        vlak = f'url(#{gid})'
    lagen.append(f'<path fill="{vlak}" d="{zeshoekpad(mx, my, R, r)}"/>')
    return defs, ''.join(lagen)


def maak_svg(variant, naam, icoon, vorm):
    b, h = getal(vorm['breedte']), getal(HOOGTE)
    defs, lagen = vlakken(variant, vorm, naam)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {b} {h}" width="{b}" height="{h}">'
            f'{defs}{lagen}<path fill="{variant["icoon"]}" d="{icoon}"/></svg>\n')

# --- Uitvoeren ----------------------------------------------------------------


def main():
    vorm = zeshoek()
    overzicht, verkleind, fouten = {}, [], []
    for categorie in sorted(os.listdir(BRON)):
        map_ = os.path.join(BRON, categorie)
        if categorie == 'Zeshoek' or not os.path.isdir(map_) or categorie.startswith(('.', '_')):
            continue
        bestanden = sorted(f for f in os.listdir(map_) if f.lower().endswith('.svg'))
        if not bestanden:
            continue
        for v in VARIANTEN:
            os.makedirs(os.path.join(DOEL, v, categorie), exist_ok=True)
        overzicht[categorie] = []
        for f in bestanden:
            bron = open(os.path.join(map_, f), encoding='utf-8').read()
            paden = re.findall(r'\sd="([^"]*)"', bron)
            if len(paden) != 1 or 'viewBox="0 0 24 24"' not in bron:
                fouten.append(f'{categorie}/{f}: verwacht één pad op een 24-raster')
                continue
            try:
                icoon, kleiner = plaats_icoon(paden[0], vorm)
            except ValueError as e:
                fouten.append(f'{categorie}/{f}: {e}')
                continue
            for v, variant in VARIANTEN.items():
                with open(os.path.join(DOEL, v, categorie, f), 'w', encoding='utf-8', newline='\n') as uit:
                    uit.write(maak_svg(variant, f[:-4], icoon, vorm))
            overzicht[categorie].append(f[:-4])
            if kleiner:
                verkleind.append(f'{categorie}/{f}')

    schrijf_overzicht(overzicht, vorm)
    totaal = sum(len(v) for v in overzicht.values())
    print(f'{totaal} iconen x {len(VARIANTEN)} varianten ({", ".join(VARIANTEN)}) gemaakt in {DOEL}')
    print(f'{len(verkleind)} iconen iets verkleind om binnen de schuine randen te blijven')
    for fout in fouten:
        print('Overgeslagen:', fout)


def schrijf_overzicht(overzicht, vorm):
    sjabloon = (OVERZICHT
                .replace('__DATA__', json.dumps(overzicht, ensure_ascii=False))
                .replace('__VARIANTEN__', json.dumps(list(VARIANTEN), ensure_ascii=False))
                .replace('__RATIO__', getal(vorm['breedte'] / HOOGTE)))
    with open(os.path.join(DOEL, 'overzicht.html'), 'w', encoding='utf-8', newline='\n') as uit:
        uit.write(sjabloon)


OVERZICHT = '''<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zeshoekiconen</title>
<style>
  :root { --ink: #303030; --grijs: #767676; --lijn: #e2e2e2; --vlak: #f4f6fa; --cyaan: #1ab9e2; --blauw: #1b71a8; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; font: 14px/1.5 "Open Sans", Arial, sans-serif; color: var(--ink); background: #fff; }
  header { position: sticky; top: 0; z-index: 1; background: #fff; border-bottom: 1px solid var(--lijn); padding: 16px 24px; display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; }
  h1 { margin: 0; font-size: 20px; }
  h1::after { content: "."; color: var(--cyaan); }
  input { flex: 1 1 240px; max-width: 420px; padding: 9px 12px; border: 1px solid var(--lijn); font: inherit; }
  input:focus { outline: 2px solid var(--cyaan); outline-offset: -1px; }
  .keuze { display: flex; border: 1px solid var(--lijn); }
  .keuze button { padding: 7px 14px; font-size: 13px; }
  .keuze button[aria-pressed="true"] { background: var(--ink); color: #fff; }
  .achtergrond { display: flex; gap: 6px; align-items: center; color: var(--grijs); font-size: 13px; }
  .achtergrond button { width: 22px; height: 22px; border: 1px solid var(--lijn); border-radius: 50%; }
  .achtergrond button[aria-pressed="true"] { outline: 2px solid var(--cyaan); outline-offset: 1px; }
  #telling { color: var(--grijs); }
  main { padding: 8px 24px 48px; transition: background .2s; }
  main.donker { color: #fff; }
  main.donker small, main.donker h2 span { color: rgba(255,255,255,.7); }
  h2 { font-size: 15px; margin: 28px 0 12px; }
  h2 span { color: var(--grijs); font-weight: normal; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
  button { all: unset; cursor: pointer; }
  .icoon { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px 10px; border-radius: 8px; text-align: center; }
  .icoon:hover, .icoon:focus-visible { background: rgba(0,0,0,.05); }
  main.donker .icoon:hover, main.donker .icoon:focus-visible { background: rgba(255,255,255,.12); }
  .icoon img { height: 56px; aspect-ratio: __RATIO__; }
  .icoon small { font-size: 11px; color: var(--grijs); overflow-wrap: anywhere; line-height: 1.3; }
  #melding { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; padding: 8px 14px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; }
  #melding.aan { opacity: 1; }
</style>
</head>
<body>
<header>
  <h1>Zeshoekiconen</h1>
  <div class="keuze" id="varianten"></div>
  <input id="zoek" type="search" placeholder="Zoek een icoon, bijvoorbeeld mail of chart" autofocus>
  <div class="achtergrond" id="achtergronden">Achtergrond</div>
  <span id="telling"></span>
</header>
<main id="lijst"></main>
<div id="melding"></div>
<script>
  // Kies een variant en achtergrond; klik op een icoon om het pad naar het bestand te kopiëren.
  const data = __DATA__;
  const varianten = __VARIANTEN__;
  const achtergronden = [['#ffffff', false], ['#f4f6fa', false], ['#1b71a8', true], ['#303030', true]];
  const lijst = document.getElementById('lijst');
  const telling = document.getElementById('telling');
  const melding = document.getElementById('melding');
  const secties = [];
  let variant = varianten.includes(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : varianten[0];

  function src(categorie, naam) {
    return [variant, categorie, naam + '.svg'].map(encodeURIComponent).join('/');
  }

  for (const [categorie, namen] of Object.entries(data)) {
    const sectie = document.createElement('section');
    const kop = document.createElement('h2');
    const raster = document.createElement('div');
    raster.className = 'raster';
    const knoppen = namen.map((naam) => {
      const knop = document.createElement('button');
      knop.className = 'icoon';
      knop.title = categorie + '/' + naam + '.svg';
      knop.innerHTML = '<img loading="lazy" alt=""><small></small>';
      knop.querySelector('small').textContent = naam;
      knop.addEventListener('click', () => kopieer('Zeshoek/' + variant + '/' + categorie + '/' + naam + '.svg'));
      raster.append(knop);
      return { knop, naam, img: knop.querySelector('img') };
    });
    sectie.append(kop, raster);
    lijst.append(sectie);
    secties.push({ sectie, kop, categorie, knoppen });
  }

  const variantKnoppen = varianten.map((v) => {
    const knop = document.createElement('button');
    knop.textContent = v;
    knop.addEventListener('click', () => kiesVariant(v));
    document.getElementById('varianten').append(knop);
    return knop;
  });

  const achtergrondKnoppen = achtergronden.map(([kleur, donker]) => {
    const knop = document.createElement('button');
    knop.style.background = kleur;
    knop.title = 'Achtergrond ' + kleur;
    knop.addEventListener('click', () => kiesAchtergrond(kleur, donker, knop));
    document.getElementById('achtergronden').append(knop);
    return knop;
  });

  function kiesVariant(v) {
    variant = v;
    // Onthoud de keuze in de adresbalk; sommige browsers staan dat bij lokale bestanden niet toe.
    try { history.replaceState(null, '', '#' + encodeURIComponent(v)); } catch (e) { /* geen probleem */ }
    variantKnoppen.forEach((k) => k.setAttribute('aria-pressed', k.textContent === v));
    for (const s of secties) for (const k of s.knoppen) k.img.src = src(s.categorie, k.naam);
  }

  function kiesAchtergrond(kleur, donker, knop) {
    lijst.style.background = kleur;
    lijst.classList.toggle('donker', donker);
    achtergrondKnoppen.forEach((k) => k.setAttribute('aria-pressed', k === knop));
  }

  function filter() {
    const woorden = document.getElementById('zoek').value.toLowerCase().split(/\\s+/).filter(Boolean);
    let totaal = 0;
    for (const s of secties) {
      let zichtbaar = 0;
      for (const { knop, naam } of s.knoppen) {
        const tekst = (s.categorie + ' ' + naam).toLowerCase();
        const toon = woorden.every((w) => tekst.includes(w));
        knop.hidden = !toon;
        if (toon) zichtbaar++;
      }
      s.sectie.hidden = zichtbaar === 0;
      s.kop.innerHTML = '';
      s.kop.append(s.categorie + ' ');
      const aantal = document.createElement('span');
      aantal.textContent = zichtbaar;
      s.kop.append(aantal);
      totaal += zichtbaar;
    }
    telling.textContent = totaal + ' iconen';
  }

  function kopieer(pad) {
    navigator.clipboard?.writeText(pad).then(() => toon('Gekopieerd: ' + pad), () => toon(pad));
  }

  let timer;
  function toon(tekst) {
    melding.textContent = tekst;
    melding.classList.add('aan');
    clearTimeout(timer);
    timer = setTimeout(() => melding.classList.remove('aan'), 1600);
  }

  document.getElementById('zoek').addEventListener('input', filter);
  kiesVariant(variant);
  kiesAchtergrond(...achtergronden[0], achtergrondKnoppen[0]);
  filter();
</script>
</body>
</html>
'''

if __name__ == '__main__':
    main()
