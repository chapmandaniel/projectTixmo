#!/usr/bin/env python3
"""Labs demo only (T124): generate original poster art and brand files for the fictional
"Northlight Live" promoter. Pure code-drawn SVG (no photos, no third-party artwork).
Writes to tdash/public/demo-assets/. Deterministic: re-running produces identical files.
Usage: python3 scripts/generate-demo-assets.py
"""
import math, os, random
from xml.sax.saxutils import escape

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'demo-assets')
FONT = "Inter, Helvetica, Arial, sans-serif"

# key, title lines, venue, tagline, (bg, c1, c2, accent), motif
EVENTS = [
    ('harbour', ['HARBOUR', 'LIGHTS', 'FESTIVAL'], 'HARBOURFRONT COMMONS', 'TWO STAGES · TWELVE ACTS · LANTERN WALK', ('#2b1055', '#ff3366', '#ff8a3d', '#ffd166'), 'sun'),
    ('aurora', ['AURORA', 'AFTER DARK'], 'THE LANTERN ROOM', 'LATE-NIGHT ELECTRONIC · LIGHT INSTALLATION · 19+', ('#061a2b', '#22d3ee', '#a855f7', '#4ade80'), 'aurora'),
    ('fog', ['FOG CITY', 'STROBE'], 'FOUNDRY HALL', 'INDIE-DANCE DOUBLE BILL · SUPPORT: LANTERN STATIC', ('#14141f', '#94a3b8', '#e2e8f0', '#f472b6'), 'stripes'),
    ('quiet', ['QUIET', 'HARBOUR', 'ACOUSTIC'], 'CHAPEL STREET STUDIO', 'SONGWRITERS IN THE ROUND · SEATED', ('#1f2a24', '#86efac', '#fef3c7', '#fbbf24'), 'rings'),
    ('static', ['NORTHERN', 'STATIC', 'LIVE'], 'FOUNDRY HALL', 'THE HOMECOMING SHOW · ALL AGES', ('#1a0b0b', '#ef4444', '#f97316', '#fde047'), 'grid'),
    ('kitchen', ['KITCHEN', 'PARTY', 'SOCIAL'], 'THE BATTERY CLUB', 'FIDDLES · ACCORDIONS · SING-ALONGS', ('#2a1608', '#f59e0b', '#ef4444', '#fef3c7'), 'dots'),
    ('comedy', ['LATE SHOW', 'COMEDY CLUB'], 'GOWER STREET THEATRE', 'FIVE COMICS · ONE MIC · NO HECKLERS', ('#1c1917', '#facc15', '#fb7185', '#ffffff'), 'spot'),
    ('saltwater', ['SALTWATER', 'SESSIONS'], 'CHAPEL STREET STUDIO', 'MARA VALE · INTIMATE LIVE SET', ('#082f49', '#38bdf8', '#2dd4bf', '#f0f9ff'), 'waves'),
    ('jazz', ['ICEBERG ALLEY', 'JAZZ BRUNCH'], 'THE BATTERY CLUB', 'SUNDAY TRIO · BRUNCH SERVED 11-2', ('#0c1d3a', '#7dd3fc', '#e0f2fe', '#fbbf24'), 'iceberg'),
    ('nye', ["NEW YEAR'S", 'EVE AT', 'HARBOURFRONT'], 'HARBOURFRONT COMMONS', 'COUNTDOWN · FIREWORKS · THREE ROOMS', ('#0f0a1e', '#fbbf24', '#f472b6', '#ffffff'), 'burst'),
    ('blues', ['BATTERY ROAD', 'BLUES NIGHT'], 'THE BATTERY CLUB', 'HOUSE BAND + GUESTS · DOORS 8PM', ('#0b1437', '#3b82f6', '#60a5fa', '#fde68a'), 'rings'),
    ('signalsunset', ['SIGNAL HILL', 'SUNSET', 'SESSIONS'], 'SIGNAL HILL AMPHITHEATRE', 'OPEN AIR · GOLDEN HOUR · ALL AGES', ('#3b0d2c', '#fb923c', '#f43f5e', '#fde68a'), 'ridges'),
    ('masquerade', ['HALLOWEEN', 'MASQUERADE'], 'FOUNDRY HALL', 'MASKS REQUIRED · COSTUME CONTEST · 19+', ('#120a1a', '#a855f7', '#f97316', '#e9d5ff'), 'moon'),
    ('indie', ['DUCKWORTH', 'INDIE', 'WEEKENDER'], 'FOUNDRY HALL', 'TWO NIGHTS · TEN BANDS · ONE STREET', ('#1e1b4b', '#f472b6', '#facc15', '#ffffff'), 'stripes'),
    ('choir', ['EMBER CHOIR', 'WINTER SONGS'], 'GOWER STREET THEATRE', 'A CANDLELIT EVENING OF CHORAL MUSIC', ('#1c0f08', '#fb923c', '#fde68a', '#ffffff'), 'flame'),
    ('gala', ['WINTER', 'LANTERNS', 'GALA'], 'HARBOURFRONT COMMONS', 'BLACK TIE · IN SUPPORT OF THE HARBOURFRONT ARTS TRUST', ('#0b1120', '#e2e8f0', '#fbbf24', '#ffffff'), 'lanterns'),
    ('filmscore', ['TIDEWATER', 'FILM SCORE', 'LIVE'], 'GOWER STREET THEATRE', 'FULL ORCHESTRA · SCREEN · SCORE', ('#111827', '#14b8a6', '#f59e0b', '#ffffff'), 'grid'),
    ('spring', ['SPRING TIDE', 'SESSIONS'], 'THE LANTERN ROOM', 'MONTHLY EMERGING-ARTIST SERIES', ('#052e16', '#4ade80', '#a3e635', '#ecfccb'), 'waves'),
    ('solstice', ['SOLSTICE', 'BLOCK PARTY'], 'HARBOURFRONT COMMONS', 'LONGEST DAY · STREET FOOD · THREE STAGES', ('#3f1d0b', '#facc15', '#fb923c', '#fff7ed'), 'sun'),
]

def fit(lines, width, maxfs):
    longest = max(len(l) for l in lines)
    return min(maxfs, int(width / (0.74 * longest)))

def motif(kind, W, H, c1, c2, accent, rnd):
    s = []
    if kind == 'sun':
        cx, cy, r = W * 0.68, H * 0.3, W * 0.24
        s.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.0f}" fill="url(#g)"/>')
        for i in range(7):
            y = cy - r * 0.2 + i * r * 0.18
            s.append(f'<rect x="{cx - r:.0f}" y="{y:.0f}" width="{2 * r:.0f}" height="{4 + i * 2}" fill="#000" opacity=".28"/>')
        for i in range(4):
            y = H * (0.74 + i * 0.06)
            s.append(f'<path d="M0 {y:.0f} Q {W*.25:.0f} {y-40:.0f} {W*.5:.0f} {y:.0f} T {W} {y:.0f} V {H} H 0 Z" fill="{c1}" opacity="{0.18 + i * 0.12:.2f}"/>')
    elif kind == 'aurora':
        for i in range(5):
            y0 = H * (0.12 + i * 0.07)
            col = [c1, c2, accent][i % 3]
            s.append(f'<path d="M-50 {y0+120:.0f} C {W*.3:.0f} {y0-80:.0f}, {W*.6:.0f} {y0+260:.0f}, {W+50} {y0:.0f}" fill="none" stroke="{col}" stroke-width="{60 - i * 8}" stroke-linecap="round" opacity="{0.55 - i * 0.07:.2f}" filter="url(#b)"/>')
        for _ in range(70):
            s.append(f'<circle cx="{rnd.random()*W:.0f}" cy="{rnd.random()*H*0.5:.0f}" r="{rnd.random()*2+0.5:.1f}" fill="#fff" opacity="{rnd.random()*0.7+0.2:.2f}"/>')
        s.append(f'<path d="M0 {H*.72:.0f} L {W*.18:.0f} {H*.64:.0f} L {W*.34:.0f} {H*.7:.0f} L {W*.55:.0f} {H*.6:.0f} L {W*.78:.0f} {H*.69:.0f} L {W} {H*.62:.0f} V {H} H 0 Z" fill="#000" opacity=".55"/>')
    elif kind == 'stripes':
        for i in range(-6, 22):
            x = i * W * 0.08
            col = c1 if i % 3 else c2
            s.append(f'<path d="M{x:.0f} 0 L {x + W*0.04:.0f} 0 L {x - W*0.5:.0f} {H*.62:.0f} L {x - W*0.54:.0f} {H*.62:.0f} Z" fill="{col}" opacity=".22"/>')
        s.append(f'<circle cx="{W*.72:.0f}" cy="{H*.28:.0f}" r="{W*.16:.0f}" fill="{accent}" opacity=".85"/>')
    elif kind == 'rings':
        cx, cy = W * 0.62, H * 0.32
        for i in range(10):
            s.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{W*0.05 + i*W*0.035:.0f}" fill="none" stroke="{[c1, c2, accent][i % 3]}" stroke-width="{3 + (i % 3) * 3}" opacity="{0.9 - i*0.07:.2f}"/>')
    elif kind == 'grid':
        hy = H * 0.5
        for i in range(-12, 13):
            s.append(f'<line x1="{W/2:.0f}" y1="{hy:.0f}" x2="{W/2 + i*W*0.12:.0f}" y2="{H}" stroke="{c1}" stroke-width="2" opacity=".5"/>')
        for i in range(1, 12):
            y = hy + (H - hy) * (i / 12) ** 1.8
            s.append(f'<line x1="0" y1="{y:.0f}" x2="{W}" y2="{y:.0f}" stroke="{c1}" stroke-width="2" opacity=".45"/>')
        s.append(f'<circle cx="{W/2:.0f}" cy="{hy:.0f}" r="{W*.22:.0f}" fill="url(#g)"/>')
        s.append(f'<rect x="0" y="{hy:.0f}" width="{W}" height="{H-hy:.0f}" fill="#000" opacity=".35"/>')
    elif kind == 'dots':
        step = W / 18
        for gx in range(19):
            for gy in range(int(H * 0.62 / step)):
                d = math.hypot(gx * step - W * 0.65, gy * step - H * 0.25)
                r = max(0.0, step * 0.45 * (1 - d / (W * 0.7)))
                if r > 0.8:
                    s.append(f'<circle cx="{gx*step:.0f}" cy="{gy*step:.0f}" r="{r:.1f}" fill="{c1 if (gx+gy)%2 else c2}"/>')
    elif kind == 'spot':
        s.append(f'<path d="M{W*.5:.0f} 0 L {W*.15:.0f} {H*.68:.0f} L {W*.85:.0f} {H*.68:.0f} Z" fill="{c1}" opacity=".25"/>')
        s.append(f'<ellipse cx="{W*.5:.0f}" cy="{H*.68:.0f}" rx="{W*.35:.0f}" ry="{H*.04:.0f}" fill="{c1}" opacity=".5"/>')
        s.append(f'<rect x="{W*.49:.0f}" y="{H*.38:.0f}" width="{W*.02:.0f}" height="{H*.3:.0f}" fill="{accent}"/>')
        s.append(f'<rect x="{W*.47:.0f}" y="{H*.33:.0f}" width="{W*.06:.0f}" height="{H*.06:.0f}" rx="{W*.03:.0f}" fill="{c2}"/>')
    elif kind == 'waves':
        for i in range(9):
            y = H * (0.18 + i * 0.06)
            s.append(f'<path d="M0 {y:.0f} Q {W*.125:.0f} {y-30:.0f} {W*.25:.0f} {y:.0f} T {W*.5:.0f} {y:.0f} T {W*.75:.0f} {y:.0f} T {W} {y:.0f}" fill="none" stroke="{[c1, c2][i % 2]}" stroke-width="{6 + i}" opacity="{0.35 + i*0.06:.2f}"/>')
    elif kind == 'iceberg':
        for _ in range(60):
            s.append(f'<circle cx="{rnd.random()*W:.0f}" cy="{rnd.random()*H*0.4:.0f}" r="{rnd.random()*2+0.5:.1f}" fill="#fff" opacity="{rnd.random()*0.6+0.2:.2f}"/>')
        s.append(f'<path d="M{W*.25:.0f} {H*.55:.0f} L {W*.45:.0f} {H*.2:.0f} L {W*.58:.0f} {H*.33:.0f} L {W*.72:.0f} {H*.26:.0f} L {W*.86:.0f} {H*.55:.0f} Z" fill="{c2}"/>')
        s.append(f'<path d="M{W*.45:.0f} {H*.2:.0f} L {W*.52:.0f} {H*.55:.0f} L {W*.25:.0f} {H*.55:.0f} Z" fill="{c1}" opacity=".6"/>')
        s.append(f'<rect x="0" y="{H*.55:.0f}" width="{W}" height="{H*.45:.0f}" fill="{c1}" opacity=".18"/>')
        s.append(f'<path d="M{W*.3:.0f} {H*.55:.0f} L {W*.55:.0f} {H*.7:.0f} L {W*.8:.0f} {H*.55:.0f} Z" fill="{c1}" opacity=".25"/>')
    elif kind == 'burst':
        cx, cy = W * 0.6, H * 0.28
        for i in range(36):
            a = i * math.pi * 2 / 36
            r1, r2 = W * 0.04, W * (0.2 + (i % 3) * 0.06)
            s.append(f'<line x1="{cx + r1*math.cos(a):.0f}" y1="{cy + r1*math.sin(a):.0f}" x2="{cx + r2*math.cos(a):.0f}" y2="{cy + r2*math.sin(a):.0f}" stroke="{[c1, c2, accent][i % 3]}" stroke-width="4" stroke-linecap="round"/>')
        for _ in range(40):
            a = rnd.random() * math.pi * 2; d = W * (0.28 + rnd.random() * 0.1)
            s.append(f'<circle cx="{cx + d*math.cos(a):.0f}" cy="{cy + d*math.sin(a):.0f}" r="3" fill="{c1}" opacity=".8"/>')
    elif kind == 'ridges':
        s.append(f'<circle cx="{W*.5:.0f}" cy="{H*.42:.0f}" r="{W*.2:.0f}" fill="url(#g)"/>')
        for i in range(4):
            base = H * (0.45 + i * 0.07)
            pts = ' '.join(f'L {x*W/8:.0f} {base - rnd.random()*H*0.08:.0f}' for x in range(9))
            s.append(f'<path d="M0 {H} {pts} L {W} {H} Z" fill="#000" opacity="{0.3 + i*0.15:.2f}"/>')
    elif kind == 'moon':
        s.append(f'<circle cx="{W*.66:.0f}" cy="{H*.28:.0f}" r="{W*.2:.0f}" fill="{accent}"/>')
        s.append(f'<circle cx="{W*.74:.0f}" cy="{H*.24:.0f}" r="{W*.19:.0f}" fill="url(#bgfill)"/>')
        mx, my = W * 0.38, H * 0.42
        s.append(f'<path d="M{mx - W*.2:.0f} {my:.0f} Q {mx:.0f} {my - H*.08:.0f} {mx + W*.2:.0f} {my:.0f} Q {mx + W*.16:.0f} {my + H*.07:.0f} {mx + W*.04:.0f} {my + H*.04:.0f} L {mx:.0f} {my + H*.02:.0f} L {mx - W*.04:.0f} {my + H*.04:.0f} Q {mx - W*.16:.0f} {my + H*.07:.0f} {mx - W*.2:.0f} {my:.0f} Z" fill="url(#g)"/>')
        s.append(f'<ellipse cx="{mx - W*.09:.0f}" cy="{my + H*.01:.0f}" rx="{W*.045:.0f}" ry="{H*.015:.0f}" fill="#000"/><ellipse cx="{mx + W*.09:.0f}" cy="{my + H*.01:.0f}" rx="{W*.045:.0f}" ry="{H*.015:.0f}" fill="#000"/>')
    elif kind == 'flame':
        for i in range(5):
            x = W * (0.3 + i * 0.12); h = H * (0.18 + (i % 2) * 0.06)
            s.append(f'<rect x="{x - W*.02:.0f}" y="{H*.6 - h*0.2:.0f}" width="{W*.04:.0f}" height="{h:.0f}" rx="6" fill="{accent}" opacity=".9"/>')
            s.append(f'<path d="M{x:.0f} {H*.6 - h*0.2 - H*.09:.0f} Q {x + W*.035:.0f} {H*.6 - h*0.2 - H*.03:.0f} {x:.0f} {H*.6 - h*0.2 - 4:.0f} Q {x - W*.035:.0f} {H*.6 - h*0.2 - H*.03:.0f} {x:.0f} {H*.6 - h*0.2 - H*.09:.0f} Z" fill="url(#g)"/>')
            s.append(f'<circle cx="{x:.0f}" cy="{H*.6 - h*0.2 - H*.04:.0f}" r="{W*.09:.0f}" fill="{c1}" opacity=".12"/>')
    elif kind == 'lanterns':
        s.append(f'<path d="M0 {H*.08:.0f} Q {W*.5:.0f} {H*.2:.0f} {W} {H*.08:.0f}" fill="none" stroke="{c1}" stroke-width="2" opacity=".6"/>')
        for i in range(7):
            t = (i + 0.5) / 7; x = W * t; y = H * 0.08 + (H * 0.12) * (1 - (2 * t - 1) ** 2)
            ly = y + H * (0.06 + (i % 3) * 0.05)
            s.append(f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x:.0f}" y2="{ly:.0f}" stroke="{c1}" stroke-width="2" opacity=".6"/>')
            s.append(f'<circle cx="{x:.0f}" cy="{ly + W*.04:.0f}" r="{W*.1:.0f}" fill="{c2}" opacity=".12"/>')
            s.append(f'<rect x="{x - W*.035:.0f}" y="{ly:.0f}" width="{W*.07:.0f}" height="{W*.09:.0f}" rx="{W*.03:.0f}" fill="url(#g)"/>')
    return '\n'.join(s)

def canvas(key, W, H, title, venue, tag, pal, kind, layout):
    bg, c1, c2, accent = pal
    rnd = random.Random(f'{key}-{W}x{H}')
    defs = (f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'
            f'<radialGradient id="r" cx=".7" cy=".2" r=".9"><stop offset="0" stop-color="{c1}" stop-opacity=".45"/><stop offset="1" stop-color="{bg}" stop-opacity="0"/></radialGradient>'
            f'<linearGradient id="bgfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg}"/><stop offset="1" stop-color="{bg}"/></linearGradient>'
            f'<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></linearGradient>'
            f'<filter id="b"><feGaussianBlur stdDeviation="14"/></filter></defs>')
    body = [f'<rect width="{W}" height="{H}" fill="{bg}"/>', f'<rect width="{W}" height="{H}" fill="url(#r)"/>', motif(kind, W, H, c1, c2, accent, rnd),
            f'<rect width="{W}" height="{H}" fill="url(#shade)"/>']
    m = W * 0.08
    if layout == 'banner':
        fs = fit([' '.join(title)], W * 0.55, 110)
        body.append(f'<text x="{m:.0f}" y="{H*.5:.0f}" font-size="{fs}" font-weight="800" fill="#fff" letter-spacing="2">{escape(" ".join(title))}</text>')
        body.append(f'<text x="{m:.0f}" y="{H*.5 + fs*0.9:.0f}" font-size="{int(fs*0.32)}" fill="#fff" opacity=".85" letter-spacing="4">{escape(venue)} · TICKETS AT NORTHLIGHT.EXAMPLE.COM</text>')
    else:
        fs = fit(title, W - 2 * m, 120 if layout != 'story' else 150)
        top = H * (0.56 if layout == 'poster' else 0.6 if layout == 'story' else 0.5)
        for i, line in enumerate(title):
            body.append(f'<text x="{m:.0f}" y="{top + i*fs*1.02:.0f}" font-size="{fs}" font-weight="800" fill="#fff" letter-spacing="2">{escape(line)}</text>')
        y = top + len(title) * fs * 1.02 + fs * 0.35
        body.append(f'<rect x="{m:.0f}" y="{y:.0f}" width="{W*0.12:.0f}" height="6" fill="{accent}"/>')
        tfs = fit([tag], W - 2 * m, int(W * 0.026))
        body.append(f'<text x="{m:.0f}" y="{y + W*0.07:.0f}" font-size="{int(W*0.034)}" fill="#fff" letter-spacing="4">{escape(venue)}</text>')
        body.append(f'<text x="{m:.0f}" y="{y + W*0.07 + W*0.05:.0f}" font-size="{tfs}" fill="#fff" opacity=".75" letter-spacing="3">{escape(tag)}</text>')
        if layout == 'story':
            body.append(f'<rect x="{m:.0f}" y="{H - W*0.24:.0f}" width="{W - 2*m:.0f}" height="{W*0.12:.0f}" rx="{W*0.06:.0f}" fill="#fff"/>')
            body.append(f'<text x="{W/2:.0f}" y="{H - W*0.16:.0f}" text-anchor="middle" font-size="{int(W*0.045)}" font-weight="700" fill="{bg}" letter-spacing="3">GET TICKETS</text>')
    body.append(f'<text x="{W - m:.0f}" y="{m*0.9:.0f}" text-anchor="end" font-size="{int(W*0.022) if layout != "banner" else 22}" font-weight="700" fill="#fff" opacity=".8" letter-spacing="5">NORTHLIGHT LIVE</text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">{defs}\n' + '\n'.join(body) + '</svg>\n'

def brand_files():
    files = {}
    pink, orange, night = '#ff3366', '#ff8a3d', '#151521'
    g = f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{pink}"/><stop offset="1" stop-color="{orange}"/></linearGradient></defs>'
    def mark(cx, cy, r, sw):
        k = r * 0.55
        star = f'M{cx} {cy - k:.0f} L {cx + k*0.22:.0f} {cy - k*0.22:.0f} L {cx + k:.0f} {cy} L {cx + k*0.22:.0f} {cy + k*0.22:.0f} L {cx} {cy + k:.0f} L {cx - k*0.22:.0f} {cy + k*0.22:.0f} L {cx - k:.0f} {cy} L {cx - k*0.22:.0f} {cy - k*0.22:.0f} Z'
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="url(#g)" stroke-width="{sw}"/><path d="{star}" fill="url(#g)"/>'
    files['northlight-logo.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" font-family="{FONT}">{g}<rect width="800" height="800" rx="160" fill="{night}"/>{mark(400, 340, 170, 36)}<text x="400" y="660" text-anchor="middle" font-size="74" font-weight="800" fill="#fff" letter-spacing="6">NORTHLIGHT</text></svg>\n'
    files['northlight-logo-light.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" font-family="{FONT}">{g}<rect width="800" height="800" rx="160" fill="#fff"/>{mark(400, 340, 170, 36)}<text x="400" y="660" text-anchor="middle" font-size="74" font-weight="800" fill="{night}" letter-spacing="6">NORTHLIGHT</text></svg>\n'
    files['northlight-mark-mono.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="#fff"/><circle cx="300" cy="330" r="150" fill="none" stroke="#111" stroke-width="32"/><path d="M300 135 L 327 294 L 300 330 L 273 294 Z" fill="#111"/></svg>\n'
    files['northlight-wordmark.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="360" viewBox="0 0 1560 360" font-family="{FONT}">{g}<rect width="1560" height="360" fill="{night}"/>{mark(180, 190, 90, 20)}<text x="320" y="225" font-size="110" font-weight="800" fill="#fff" letter-spacing="8">NORTHLIGHT</text><text x="1170" y="225" font-size="110" font-weight="300" fill="url(#g)" letter-spacing="10">LIVE</text></svg>\n'
    sw = [('Harbour Night', night), ('Signal Pink', pink), ('Ember Orange', orange), ('Lantern Gold', '#ffd166'), ('Aurora Teal', '#22d3ee'), ('Fog Grey', '#94a3b8')]
    cells = ''.join(f'<rect x="{60 + i*235}" y="80" width="205" height="320" rx="16" fill="{c}" stroke="#2b2b40"/><text x="{60 + i*235}" y="450" font-size="26" fill="#fff">{n}</text><text x="{60 + i*235}" y="490" font-family="monospace" font-size="22" fill="#a1a5b7">{c.upper()}</text>' for i, (n, c) in enumerate(sw))
    files['brand-palette.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="600" viewBox="0 0 1500 600" font-family="{FONT}"><rect width="1500" height="600" fill="#1e1e2d"/>{cells}<text x="60" y="560" font-size="22" fill="#a1a5b7" letter-spacing="4">NORTHLIGHT LIVE · BRAND PALETTE 2026</text></svg>\n'
    files['brand-typography.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="900" viewBox="0 0 1500 900" font-family="{FONT}">{g}<rect width="1500" height="900" fill="#f8fafc"/><text x="80" y="140" font-size="28" fill="#64748b" letter-spacing="6">TYPOGRAPHY</text><text x="80" y="330" font-size="190" font-weight="800" fill="{night}">Aa</text><text x="420" y="250" font-size="54" font-weight="800" fill="{night}">Display / 800 / +2 tracking</text><text x="420" y="330" font-size="40" font-weight="400" fill="#334155">Body / 400 / 1.5 line height</text><rect x="80" y="420" width="1340" height="4" fill="url(#g)"/><text x="80" y="540" font-size="64" font-weight="800" fill="{night}" letter-spacing="2">HARBOUR LIGHTS FESTIVAL</text><text x="80" y="620" font-size="34" fill="#334155">Two stages on the waterfront: twelve acts, food trucks and a lantern walk.</text><text x="80" y="700" font-size="26" fill="#64748b" letter-spacing="5">VENUE · DATE · TICKETS AT NORTHLIGHT.EXAMPLE.COM</text><text x="80" y="830" font-size="22" fill="#94a3b8">Headlines: uppercase, tracked. Never set body copy in all caps.</text></svg>\n'
    files['social-template-square.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="{FONT}">{g}<rect width="1080" height="1080" fill="{night}"/><rect x="60" y="60" width="960" height="720" rx="24" fill="#1e1e2d" stroke="#2b2b40" stroke-dasharray="14 10"/><text x="540" y="430" text-anchor="middle" font-size="36" fill="#64748b" letter-spacing="6">ARTWORK AREA 960 × 720</text><text x="60" y="880" font-size="72" font-weight="800" fill="#fff">EVENT TITLE</text><text x="60" y="950" font-size="30" fill="#a1a5b7" letter-spacing="4">VENUE · DATE</text><rect x="760" y="900" width="260" height="80" rx="40" fill="url(#g)"/><text x="890" y="952" text-anchor="middle" font-size="28" font-weight="700" fill="#fff">TICKETS</text></svg>\n'
    files['ticket-design-template.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560" font-family="{FONT}">{g}<rect width="1400" height="560" rx="32" fill="#fff"/><rect width="1000" height="560" rx="32" fill="{night}"/><rect x="0" y="0" width="16" height="560" fill="url(#g)"/><text x="80" y="140" font-size="26" fill="#a1a5b7" letter-spacing="6">NORTHLIGHT LIVE PRESENTS</text><text x="80" y="250" font-size="84" font-weight="800" fill="#fff">EVENT NAME</text><text x="80" y="330" font-size="32" fill="#e2e8f0">Venue · Date · Doors 7:00 PM</text><text x="80" y="460" font-size="28" fill="#a1a5b7">GENERAL ADMISSION · ADMIT ONE</text><line x1="1000" y1="40" x2="1000" y2="520" stroke="#cbd5e1" stroke-width="4" stroke-dasharray="12 12"/>' + ''.join(f'<rect x="{1080 + (i % 8) * 30}" y="{150 + (i // 8) * 30}" width="24" height="24" fill="{night if (i * 7) % 3 else "#fff"}"/>' for i in range(64)) + f'<text x="1200" y="470" text-anchor="middle" font-family="monospace" font-size="24" fill="{night}">NL-000000</text></svg>\n'
    files['sponsor-wall.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" font-family="{FONT}">{g}<rect width="1600" height="900" fill="#0f172a"/><text x="800" y="120" text-anchor="middle" font-size="44" font-weight="800" fill="#fff" letter-spacing="8">THANK YOU TO OUR PARTNERS</text>' + ''.join(f'<rect x="{120 + (i % 4) * 350}" y="{200 + (i // 4) * 300}" width="310" height="240" rx="20" fill="#1e293b"/><text x="{275 + (i % 4) * 350}" y="{330 + (i // 4) * 300}" text-anchor="middle" font-size="30" font-weight="700" fill="#e2e8f0">{n}</text>' for i, n in enumerate(['Harbourfront CU', 'Tidewater Brewing', 'Gower Street Café', 'Signal Radio 99.1', 'Lantern Hotels', 'Duckworth Books', 'Iceberg Water Co.', 'Battery Print'])) + '</svg>\n'
    files['merch-tee-mockup.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" font-family="{FONT}">{g}<rect width="1000" height="1000" fill="#e2e8f0"/><path d="M300 180 L 400 140 Q 500 200 600 140 L 700 180 L 840 320 L 740 400 L 700 360 L 700 860 L 300 860 L 300 360 L 260 400 L 160 320 Z" fill="{night}"/>{mark(500, 470, 90, 18)}<text x="500" y="660" text-anchor="middle" font-size="40" font-weight="800" fill="#fff" letter-spacing="6">NORTHLIGHT</text><text x="500" y="940" text-anchor="middle" font-size="24" fill="#475569" letter-spacing="4">CREW TEE 2026 · MOCKUP</text></svg>\n'
    files['email-header.svg'] = f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400" font-family="{FONT}">{g}<rect width="1200" height="400" fill="{night}"/><rect width="1200" height="400" fill="url(#g)" opacity=".18"/>{mark(160, 210, 70, 16)}<text x="280" y="190" font-size="54" font-weight="800" fill="#fff" letter-spacing="3">THIS WEEK AT NORTHLIGHT</text><text x="280" y="250" font-size="28" fill="#e2e8f0">New shows, presales and what is selling fast.</text></svg>\n'
    return files

def main():
    os.makedirs(OUT, exist_ok=True)
    count = 0
    for key, title, venue, tag, pal, kind in EVENTS:
        for suffix, W, H, layout in (('poster', 900, 1200, 'poster'), ('story', 1080, 1920, 'story'), ('square', 1080, 1080, 'square'), ('banner', 1600, 600, 'banner')):
            with open(os.path.join(OUT, f'{key}-{suffix}.svg'), 'w') as f:
                f.write(canvas(key, W, H, title, venue, tag, pal, kind, layout)); count += 1
    for name, svg in brand_files().items():
        with open(os.path.join(OUT, name), 'w') as f:
            f.write(svg); count += 1
    # Lineup card for Harbour Lights.
    acts = ['LANTERN STATIC', 'THE GREY SOUNDS', 'MARA VALE', 'PORTSIDE', 'NORTH SHORE YOUTH CHOIR', 'KELP &amp; COMPANY', 'TIDEWATER', 'THE BATTERY BOYS']
    lines = ''.join(f'<text x="80" y="{360 + i*86}" font-size="{60 if i < 3 else 44}" font-weight="{800 if i < 3 else 600}" fill="#fff">{a}</text>' for i, a in enumerate(acts))
    with open(os.path.join(OUT, 'harbour-lineup.svg'), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="{FONT}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3366"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs><rect width="1080" height="1080" fill="#2b1055"/><rect width="1080" height="12" fill="url(#g)"/><text x="80" y="200" font-size="96" font-weight="800" fill="url(#g)">LINEUP</text><text x="80" y="260" font-size="30" fill="#fff" opacity=".7" letter-spacing="5">HARBOUR LIGHTS FESTIVAL</text>{lines}<text x="80" y="1030" font-size="26" fill="#fff" opacity=".6" letter-spacing="4">HARBOURFRONT COMMONS · NORTHLIGHT LIVE</text></svg>\n'); count += 1
    print(f'wrote {count} files to {os.path.normpath(OUT)}')

if __name__ == '__main__':
    main()
