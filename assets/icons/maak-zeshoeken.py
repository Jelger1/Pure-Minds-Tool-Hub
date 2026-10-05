"""
Zet alle Remix-iconen in deze map om naar Pure Minds-zeshoekiconen (punt boven).

De lijnstijl (naam-line.svg in de categoriemappen); iconen in één stijl (zonder
-line, zoals bold.svg) doen gewoon mee. De witte zeshoek met uitgesneden icoon
gebruikt alleen de volle stijl (naam-fill.svg uit Vol/<categorie>/), nooit de
lijnstijl: het wit slokt dunne uitgesneden lijnen op, een vol silhouet is
rustiger en sneller herkenbaar. Een icoon zonder volle stijl (de iconen in één
stijl) wordt uitgesneden zoals het is.
Er komen vier varianten, elk in een eigen map onder Zeshoek/, met dezelfde
categorieën en bestandsnamen als het origineel (in de witte map naam-fill.svg):
- Cyaan zeshoek - wit icoon:         effen Pure Cyaan (#1ab9e2), wit icoon (de huisvariant)
- Donkere zeshoek - wit icoon:       antraciet (#303030), wit icoon
- Magenta zeshoek - wit icoon:       magenta (#b61b50), wit icoon
- Witte zeshoek - doorzichtig icoon: witte zeshoek waar het icoon (volle stijl) uit
                                     gesneden is; de achtergrond schijnt erdoorheen
Alle varianten zijn effen: geen verloop en geen rand.
Daarnaast komen de iconen los (zonder zeshoek) in de huiskleuren in Los/<kleur>/,
en een overzicht.html om alles te bekijken en te doorzoeken.

Keuzes:
- De coördinaten worden direct in het pad omgerekend (geen transform), zodat de
  bestanden overal hetzelfde tonen: browser, Figma, Illustrator, PowerPoint.
- Alle iconen krijgen dezelfde schaal, gecentreerd op het midden van het
  24-raster. Zo blijft de optische balans van Remix intact (een play-knop staat
  bewust iets rechts, signaalbalkjes staan bewust onderin).
- Alleen iconen die te dicht bij de schuine randen komen, worden iets kleiner
  gemaakt, zodat niets tegen de rand aan plakt.
- Het uitgesneden icoon is één samengesteld pad (zeshoek + icoon, fill-rule
  evenodd), geen masker: zo blijft het gat een gat in Illustrator, Figma, Canva
  en PowerPoint. Dat klopt alleen als evenodd hetzelfde icoon geeft als de
  gewone vulling (nonzero). Bij een icoon met overlappende delen (zoals een
  dubbel getekend balkje) zou de overlap dan wegvallen; voor die iconen staat
  in uitsnijpaden.json een pad zonder overlap (dezelfde vorm, samengevoegd).
  Met skia-pathops geïnstalleerd (pip install skia-pathops) controleert dit
  script elk icoon en werkt het uitsnijpaden.json zelf bij; zonder gebruikt
  het de lijst zoals hij er staat.
- De witte variant is bedoeld voor een gekleurde of donkere achtergrond; op
  wit valt hij weg. Een variant kan nog wel een verloop of een rand krijgen
  (zie VARIANTEN); een rand is dan een tweede vlak in plaats van een stroke,
  omdat een stroke aan de buitenkant door de viewBox wordt afgesneden.

Opnieuw draaien:  python maak-zeshoeken.py
Daarna voor de Icon Finder (leest ook uitsnijpaden.json):  npm run icons
"""
import json
import math
import os
import re

# --- Instellingen ------------------------------------------------------------

BRON = os.path.dirname(os.path.abspath(__file__))
DOEL = os.path.join(BRON, 'Zeshoek')
DOEL_LOS = os.path.join(BRON, 'Los')
BRON_VOL = os.path.join(BRON, 'Vol')       # de volle stijl, alleen voor het uitsparen
GEEN_CATEGORIE = ('Zeshoek', 'Los', 'Vol')

# Losse iconen (zonder zeshoek) in de huiskleuren, dezelfde als 'los' in de Icon Finder
LOSSE_KLEUREN = {
    'Cyaan icoon': '#1ab9e2',
    'Inkt icoon': '#303030',
    'Magenta icoon': '#b61b50',
    'Blauw icoon': '#1b71a8',
    'Wit icoon': '#ffffff',
}
UITSNIJPADEN = os.path.join(BRON, 'uitsnijpaden.json')

HOOGTE = 64.0          # hoogte van de zeshoek (viewBox); breedte volgt uit de vorm
AFRONDING = 0.12       # hoekradius als deel van de straal; 0 geeft scherpe punten
ICOONBREEDTE = 0.54    # het 20-eenheden-werkvlak van Remix t.o.v. de zeshoekbreedte
MAX_VULLING = 0.78     # verste punt van een icoon, als deel van de afstand tot de rand

# Per variant (de naam is de map): vlak is één kleur of (boven, onder) voor een
# verloop; icoon is de kleur van het icoon, of uitsparen: het icoon wordt uit de
# zeshoek gesneden. rand is optioneel en heeft een dikte in viewBox-eenheden.
VARIANTEN = {
    'Cyaan zeshoek - wit icoon': {'vlak': '#1ab9e2', 'icoon': '#ffffff'},
    'Donkere zeshoek - wit icoon': {'vlak': '#303030', 'icoon': '#ffffff'},
    'Magenta zeshoek - wit icoon': {'vlak': '#b61b50', 'icoon': '#ffffff'},
    'Witte zeshoek - doorzichtig icoon': {'vlak': '#ffffff', 'uitsparen': True},
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


def vlakken(variant, vorm, naam, gat=''):
    """De achtergrondlagen van een variant: defs (voor een verloop) en paden.
    gat is het geplaatste icoon als het uit de zeshoek gesneden wordt: dan komt
    het in elk vlak als extra deelpad, met fill-rule evenodd."""
    mx, my, R, r = vorm['mx'], vorm['my'], vorm['R'], vorm['r']
    vlak, defs, lagen = variant['vlak'], '', []
    regel = ' fill-rule="evenodd"' if gat else ''

    if 'rand' in variant:
        # Binnenste zeshoek evenwijdig ingezet, zodat de rand overal even dik is.
        kleur, dikte = variant['rand']
        lagen.append(f'<path fill="{kleur}"{regel} d="{zeshoekpad(mx, my, R, r)}{gat}"/>')
        R, r = R - dikte / WORTEL3_2, max(r - dikte, 0)

    if isinstance(vlak, tuple):
        # Unieke id per bestand, zodat meerdere iconen op één pagina elkaar niet storen.
        gid = 'pm-' + re.sub(r'[^a-z0-9-]', '', naam.lower())
        defs = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
                f'<stop offset="0" stop-color="{vlak[0]}"/><stop offset="1" stop-color="{vlak[1]}"/>'
                f'</linearGradient></defs>')
        vlak = f'url(#{gid})'
    lagen.append(f'<path fill="{vlak}"{regel} d="{zeshoekpad(mx, my, R, r)}{gat}"/>')
    return defs, ''.join(lagen)


def maak_svg(variant, naam, icoon, vorm):
    """Eén zeshoek-SVG. Bij uitsparen is icoon het pad dat uit de zeshoek gaat."""
    b, h = getal(vorm['breedte']), getal(HOOGTE)
    if variant.get('uitsparen'):
        defs, lagen = vlakken(variant, vorm, naam, icoon)
    else:
        defs, lagen = vlakken(variant, vorm, naam)
        lagen += f'<path fill="{variant["icoon"]}" d="{icoon}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {b} {h}" width="{b}" height="{h}">'
            f'{defs}{lagen}</svg>\n')

# --- Uitsparen: iconen met overlappende delen ---------------------------------


def lees_uitsnijpaden():
    """{'Categorie/naam.svg': pad zonder overlap} uit uitsnijpaden.json."""
    if not os.path.exists(UITSNIJPADEN):
        return {}
    with open(UITSNIJPADEN, encoding='utf-8') as f:
        return {k: v for k, v in json.load(f).items() if not k.startswith('_')}


def controleer_uitsparen(bronnen):
    """Zoekt met skia-pathops de iconen waarbij evenodd een andere vorm geeft dan
    nonzero, en geeft voor elk een samengevoegd pad zonder overlap (24-raster).
    None als skia-pathops niet geïnstalleerd is."""
    try:
        import pathops
    except ImportError:
        return None

    def vorm_van(d, regel):
        p, x, y = pathops.Path(fillType=regel), 0.0, 0.0
        for c, a in segmenten(d):
            if c == 'M':
                p.moveTo(*a)
                x, y = a
            elif c == 'L':
                p.lineTo(*a)
                x, y = a
            elif c == 'H':
                x = a[0]
                p.lineTo(x, y)
            elif c == 'V':
                y = a[0]
                p.lineTo(x, y)
            elif c == 'C':
                p.cubicTo(*a)
                x, y = a[4], a[5]
            else:
                p.close()
        return p

    def verschil(a, b):
        # Oppervlak (in 24-rastereenheden²) dat in de ene vorm zit en niet in de andere
        return abs(pathops.op(a, b, pathops.PathOp.XOR).area)

    def als_pad(p):
        delen = []
        for soort, pts in p.segments:
            if soort == 'moveTo':
                delen.append(f'M{getal(pts[0][0])} {getal(pts[0][1])}')
            elif soort == 'lineTo':
                delen.append(f'L{getal(pts[0][0])} {getal(pts[0][1])}')
            elif soort == 'curveTo':
                delen.append('C' + ' '.join(f'{getal(x)} {getal(y)}' for x, y in pts))
            elif soort == 'closePath':
                delen.append('Z')
            elif soort != 'endPath':
                raise ValueError(f'onverwacht segment {soort}')
        return ''.join(delen)

    nonzero, evenodd = pathops.FillType.WINDING, pathops.FillType.EVEN_ODD
    uit = {}
    for sleutel, d in bronnen.items():
        echt = vorm_van(d, nonzero)
        if verschil(echt, vorm_van(d, evenodd)) < 1e-3:
            continue
        pad = als_pad(pathops.simplify(echt, fix_winding=True))
        # Het nieuwe pad: evenodd gelijk aan nonzero, en (op het afronden op 3 decimalen
        # na, zo'n 0,01) dezelfde vorm als het originele icoon
        if (verschil(vorm_van(pad, nonzero), vorm_van(pad, evenodd)) >= 1e-3
                or verschil(echt, vorm_van(pad, evenodd)) >= 0.05):
            raise ValueError(f'{sleutel}: samengevoegd pad wijkt af')
        uit[sleutel] = pad
    return uit


def schrijf_uitsnijpaden(paden):
    inhoud = {'_uitleg': 'Gemaakt door maak-zeshoeken.py: paden zonder overlap voor iconen waarbij '
                         'fill-rule evenodd een andere vorm geeft dan de gewone vulling. Alleen gebruikt '
                         'voor de witte zeshoek met uitgesneden icoon (hier en in de Icon Finder), dus '
                         'voor de volle stijl (Vol/<categorie>/naam-fill.svg) en de iconen in één stijl.'}
    inhoud.update(sorted(paden.items()))
    with open(UITSNIJPADEN, 'w', encoding='utf-8', newline='\n') as uit:
        json.dump(inhoud, uit, ensure_ascii=False, indent=2)
        uit.write('\n')

# --- Uitvoeren ----------------------------------------------------------------


def lees_svg(pad):
    """Het ene pad uit een Remix-SVG, of None als het er niet precies één op een 24-raster is."""
    bron = open(pad, encoding='utf-8').read()
    paden = re.findall(r'\sd="([^"]*)"', bron)
    return paden[0] if len(paden) == 1 and 'viewBox="0 0 24 24"' in bron else None


def bronbestanden():
    """{'Categorie/naam.svg': pad} van alle iconen in lijnstijl (en die in één stijl)."""
    bronnen, fouten = {}, []
    for categorie in sorted(os.listdir(BRON)):
        map_ = os.path.join(BRON, categorie)
        if categorie in GEEN_CATEGORIE or not os.path.isdir(map_) or categorie.startswith(('.', '_')):
            continue
        # De volle stijl staat in Vol/, niet in de categoriemappen
        for f in sorted(f for f in os.listdir(map_) if f.lower().endswith('.svg') and not f.endswith('-fill.svg')):
            d = lees_svg(os.path.join(map_, f))
            if d is None:
                fouten.append(f'{categorie}/{f}: verwacht één pad op een 24-raster')
                continue
            bronnen[f'{categorie}/{f}'] = d
    return bronnen, fouten


def uitsnedes(bronnen):
    """Per icoon wat uit de witte zeshoek gesneden wordt: {'Categorie/naam-line.svg':
    ('Categorie/naam-fill.svg', pad)} uit Vol/, en anders het icoon zelf (één stijl)."""
    uit = {sleutel: (sleutel, d) for sleutel, d in bronnen.items()}
    fouten = []
    if not os.path.isdir(BRON_VOL):
        return uit, ['map Vol ontbreekt: de witte zeshoek krijgt de lijnstijl']
    for categorie in sorted(os.listdir(BRON_VOL)):
        map_ = os.path.join(BRON_VOL, categorie)
        if not os.path.isdir(map_) or categorie.startswith(('.', '_')):
            continue
        for f in sorted(f for f in os.listdir(map_) if f.lower().endswith('.svg')):
            lijn = f'{categorie}/{f[:-9]}-line.svg'
            d = lees_svg(os.path.join(map_, f)) if f.endswith('-fill.svg') else None
            if d is None or lijn not in bronnen:
                fouten.append(f'Vol/{categorie}/{f}: ' + ('verwacht naam-fill.svg met één pad op een 24-raster'
                                                          if d is None else f'geen {lijn}'))
                continue
            uit[lijn] = (f'{categorie}/{f}', d)
    return uit, fouten


def ruim_op(map_, geschreven):
    """Verwijdert .svg-bestanden die dit script niet (meer) maakt, zoals naam-line.svg in
    de witte map van vóór de volle stijl. Geeft het aantal terug."""
    weg = 0
    for wortel, _, bestanden in os.walk(map_):
        for b in bestanden:
            pad = os.path.normcase(os.path.abspath(os.path.join(wortel, b)))
            if b.lower().endswith('.svg') and pad not in geschreven:
                os.remove(pad)
                weg += 1
    return weg


def main():
    vorm = zeshoek()
    bronnen, fouten = bronbestanden()
    snij, fouten_vol = uitsnedes(bronnen)
    fouten += fouten_vol

    # Controle op overlap: alleen de paden die echt uitgesneden worden (de volle stijl)
    uitsnij = controleer_uitsparen(dict(snij.values()))
    if uitsnij is None:
        uitsnij = lees_uitsnijpaden()
        print(f'skia-pathops niet geïnstalleerd: uitsnijpaden.json niet gecontroleerd ({len(uitsnij)} paden gebruikt)')
    else:
        schrijf_uitsnijpaden(uitsnij)
        print(f'{len(uitsnij)} iconen met overlap, voor het uitsparen samengevoegd in uitsnijpaden.json: '
              f'{", ".join(uitsnij) or "geen"}')

    overzicht, verkleind, zonder_vol, geschreven = {}, [], [], set()

    def schrijf(pad, tekst):
        os.makedirs(os.path.dirname(pad), exist_ok=True)
        with open(pad, 'w', encoding='utf-8', newline='\n') as uit:
            uit.write(tekst)
        geschreven.add(os.path.normcase(os.path.abspath(pad)))

    for sleutel, d in bronnen.items():
        categorie, f = sleutel.split('/')
        snijsleutel, snijpad = snij[sleutel]
        try:
            icoon, kleiner = plaats_icoon(d, vorm)
            gat = plaats_icoon(uitsnij.get(snijsleutel, snijpad), vorm)[0]
        except ValueError as e:
            fouten.append(f'{sleutel}: {e}')
            continue
        for v, variant in VARIANTEN.items():
            # De witte zeshoek heet naar wat er uitgesneden is: naam-fill.svg (of bold.svg)
            naam = snijsleutel.split('/')[1] if variant.get('uitsparen') else f
            schrijf(os.path.join(DOEL, v, categorie, naam),
                    maak_svg(variant, naam[:-4], gat if variant.get('uitsparen') else icoon, vorm))
        # Los, zonder zeshoek: het bronpad ongewijzigd, alleen met de kleur ingevuld
        for kleurmap, kleur in LOSSE_KLEUREN.items():
            schrijf(os.path.join(DOEL_LOS, kleurmap, categorie, f),
                    f'<svg viewBox="0 0 24 24" fill="{kleur}" xmlns="http://www.w3.org/2000/svg"><path d="{d}"/></svg>\n')
        overzicht.setdefault(categorie, []).append(f[:-4])
        if f.endswith('-line.svg') and snijsleutel == sleutel:
            zonder_vol.append(sleutel[:-4])
        if kleiner:
            verkleind.append(sleutel)

    weg = ruim_op(DOEL, geschreven) + ruim_op(DOEL_LOS, geschreven)
    schrijf_overzicht(overzicht, vorm, zonder_vol)
    totaal = sum(len(v) for v in overzicht.values())
    print(f'{totaal} iconen x {len(VARIANTEN)} varianten gemaakt in {DOEL}:')
    for v in VARIANTEN:
        print(f'  {v}')
    print(f'en los in {len(LOSSE_KLEUREN)} kleuren in {DOEL_LOS}: {", ".join(LOSSE_KLEUREN)}')
    vol = sum(1 for k, (s, _) in snij.items() if s != k)
    print(f'witte zeshoek: {vol} iconen in de volle stijl, {totaal - vol} zonder volle stijl (zoals ze zijn)')
    if zonder_vol:
        print(f'Let op, lijnicoon zonder volle stijl in Vol/: {", ".join(zonder_vol)}')
    print(f'{len(verkleind)} iconen iets verkleind om binnen de schuine randen te blijven')
    if weg:
        print(f'{weg} oude bestanden verwijderd die het script niet meer maakt')
    for fout in fouten:
        print('Overgeslagen:', fout)


def schrijf_overzicht(overzicht, vorm, zonder_vol):
    # Per variant: [map, licht, uitsparen]; een lichte zeshoek (wit) toont het overzicht op een
    # donkere achtergrond; bij uitsparen heet het bestand naam-fill.svg (behalve zonder_vol)
    varianten = [[v, VARIANTEN[v]['vlak'] == '#ffffff', bool(VARIANTEN[v].get('uitsparen'))] for v in VARIANTEN]
    sjabloon = (OVERZICHT
                .replace('__DATA__', json.dumps(overzicht, ensure_ascii=False))
                .replace('__VARIANTEN__', json.dumps(varianten, ensure_ascii=False))
                .replace('__ZONDER_VOL__', json.dumps(zonder_vol, ensure_ascii=False))
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
  :root { --ink: #303030; --grijs: #767676; --lijn: #e2e2e2; --vlak: #f4f6fa; --cyaan: #1ab9e2; }
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
  #uitleg { flex-basis: 100%; margin: 0; color: var(--grijs); font-size: 13px; }
  #uitleg b { color: var(--ink); }
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
  <p id="uitleg" hidden>Uitgesneden in de witte zeshoek alleen de <b>volle stijl (Fill)</b>: het wit slokt dunne lijnen op, een vol silhouet is rustiger en sneller herkenbaar.</p>
</header>
<main id="lijst"></main>
<div id="melding"></div>
<script>
  // Kies een variant en achtergrond; klik op een icoon om het pad naar het bestand te kopiëren.
  // De witte zeshoek met uitgesneden icoon valt weg op wit: dan vanzelf een donkere achtergrond.
  const data = __DATA__;
  const varianten = __VARIANTEN__.map(([naam]) => naam);
  const licht = new Set(__VARIANTEN__.filter(([, l]) => l).map(([naam]) => naam));
  // De witte zeshoek is uitgesneden in de volle stijl: daar heet home-line home-fill
  const uitsparen = new Set(__VARIANTEN__.filter(([, , u]) => u).map(([naam]) => naam));
  const zonderVol = new Set(__ZONDER_VOL__);
  const bestand = (categorie, naam) => (uitsparen.has(variant) && naam.endsWith('-line') &&
    !zonderVol.has(categorie + '/' + naam) ? naam.slice(0, -5) + '-fill' : naam);
  const achtergronden = [['#ffffff', false], ['#f4f6fa', false], ['#1ab9e2', true], ['#b61b50', true], ['#303030', true]];
  let donkerNu = false;
  let vanzelf = false;   // achtergrond vanzelf donker gezet voor een lichte variant
  const lijst = document.getElementById('lijst');
  const telling = document.getElementById('telling');
  const melding = document.getElementById('melding');
  const secties = [];
  let variant = varianten.includes(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : varianten[0];

  function src(categorie, naam) {
    return [variant, categorie, bestand(categorie, naam) + '.svg'].map(encodeURIComponent).join('/');
  }

  for (const [categorie, namen] of Object.entries(data)) {
    const sectie = document.createElement('section');
    const kop = document.createElement('h2');
    const raster = document.createElement('div');
    raster.className = 'raster';
    const knoppen = namen.map((naam) => {
      const knop = document.createElement('button');
      knop.className = 'icoon';
      knop.innerHTML = '<img loading="lazy" alt=""><small></small>';
      knop.addEventListener('click', () => kopieer('Zeshoek/' + variant + '/' + categorie + '/' + bestand(categorie, naam) + '.svg'));
      raster.append(knop);
      return { knop, naam, img: knop.querySelector('img'), label: knop.querySelector('small') };
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
    knop.addEventListener('click', () => {
      vanzelf = false;
      kiesAchtergrond(kleur, donker, knop);
    });
    document.getElementById('achtergronden').append(knop);
    return knop;
  });

  function kiesVariant(v) {
    variant = v;
    // Onthoud de keuze in de adresbalk; sommige browsers staan dat bij lokale bestanden niet toe.
    try { history.replaceState(null, '', '#' + encodeURIComponent(v)); } catch (e) { /* geen probleem */ }
    variantKnoppen.forEach((k) => k.setAttribute('aria-pressed', k.textContent === v));
    document.getElementById('uitleg').hidden = !uitsparen.has(v);
    for (const s of secties) {
      for (const k of s.knoppen) {
        const naam = bestand(s.categorie, k.naam);
        k.img.src = src(s.categorie, k.naam);
        k.label.textContent = naam;
        k.knop.title = s.categorie + '/' + naam + '.svg';
      }
    }
    const laatste = achtergronden.length - 1;
    if (licht.has(v) && !donkerNu) {
      kiesAchtergrond(...achtergronden[laatste], achtergrondKnoppen[laatste]);
      vanzelf = true;
    } else if (!licht.has(v) && vanzelf) {
      kiesAchtergrond(...achtergronden[0], achtergrondKnoppen[0]);
      vanzelf = false;
    }
    filter();   // de bestandsnaam hangt van de variant af (home-fill in de witte zeshoek)
  }

  function kiesAchtergrond(kleur, donker, knop) {
    lijst.style.background = kleur;
    lijst.classList.toggle('donker', donker);
    donkerNu = donker;
    achtergrondKnoppen.forEach((k) => k.setAttribute('aria-pressed', k === knop));
  }

  function filter() {
    const woorden = document.getElementById('zoek').value.toLowerCase().split(/\\s+/).filter(Boolean);
    let totaal = 0;
    for (const s of secties) {
      let zichtbaar = 0;
      for (const { knop, naam } of s.knoppen) {
        // Op de icoonnaam en op de bestandsnaam die eronder staat (home-line of home-fill)
        const tekst = (s.categorie + ' ' + naam + ' ' + bestand(s.categorie, naam)).toLowerCase();
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
  kiesAchtergrond(...achtergronden[0], achtergrondKnoppen[0]);
  kiesVariant(variant);
</script>
</body>
</html>
'''

if __name__ == '__main__':
    main()
