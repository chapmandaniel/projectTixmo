#!/usr/bin/env python3
"""Headless crawl of Labs dash. Reads demo login from file, never prints it.
usage: crawl.py OUTDIR [routes...]"""
import sys, json, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright
import os
LOGIN = Path(os.environ.get('LOGIN_FILE', '/workspace/projectTixmo/secrets-local/labs-demo-owner.login')).read_text().splitlines()
EMAIL, PW = LOGIN[0].strip(), LOGIN[1].strip()
BASE = 'https://labs.tixmo.co'
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
ROUTES = sys.argv[2:] or ['dashboard','events','todo','team','assets','approvals','analytics','analytics/classic','settings','staff-actions','social','social/overview','orders','venues','scanners','security','notifications']
def scrub(s): return s.replace(PW, '***')
res = {}
import urllib.request
def _event_ids():
    B = 'https://labs-api.tixmo.co/api/v1'
    r = urllib.request.urlopen(urllib.request.Request(B + '/auth/login', data=json.dumps({'email': EMAIL, 'password': PW}).encode(), headers={'Content-Type': 'application/json'}))
    tok = json.load(r)['data']['accessToken']
    j = json.load(urllib.request.urlopen(urllib.request.Request(B + '/events?limit=100', headers={'Authorization': 'Bearer ' + tok})))
    d = j.get('data', j); evs = d.get('events', d) if isinstance(d, dict) else d
    return {e['name']: e['id'] for e in evs}
try:
    _ids = _event_ids()
except Exception as ex:
    _ids = {}; print('event id lookup failed', ex)
ROUTES_EXTRA = []
for _n in ('Harbour Lights Festival', 'Kitchen Party Social'):
    if _n in _ids and os.environ.get('NO_EVENTS') != '1':
        ROUTES_EXTRA += [f'events/{_ids[_n]}' + s for s in ('', '/orders', '/attendees', '/tickets')]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for vp, (w, h) in {'desktop': (1440, 900), 'mobile': (375, 812)}.items():
        ctx = b.new_context(viewport={'width': w, 'height': h})
        pg = ctx.new_page()
        cur = {'c': [], 'f': []}
        pg.on('console', lambda m: cur['c'].append(f'{m.type}: {scrub(m.text)[:300]}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: cur['c'].append(f'pageerror: {scrub(str(e))[:300]}'))
        pg.on('response', lambda r: cur['f'].append(f'{r.status} {r.request.method} {r.url[:160]}') if r.status >= 400 else None)
        pg.goto(BASE + '/dashboard', wait_until='networkidle')
        pg.fill('input[type=email]', EMAIL); pg.fill('input[type=password]', PW)
        pg.click('button[type=submit]'); pg.wait_for_selector('header', timeout=30000); pg.wait_for_load_state('networkidle')
        for r in list(ROUTES) + ['__extra__']:
          for r in ([r] if r != '__extra__' else list(ROUTES_EXTRA)):
            cur['c'].clear(); cur['f'].clear()
            pg.goto(f'{BASE}/{r}', wait_until='networkidle'); time.sleep(3.5)
            name = re.sub(r'[^a-z0-9]+', '-', r)
            pg.screenshot(path=str(OUT / f'{vp}-{name}.png'), full_page=(vp == 'desktop' or r == 'security'))
            if r == 'security':
                hero = pg.query_selector('[data-testid="security-home-hero"]')
                if hero:
                    hero.scroll_into_view_if_needed()
                    time.sleep(0.3)
                    hero.screenshot(path=str(OUT / f'{vp}-security-hero.png'))
                moose = pg.query_selector('[data-testid="moose-chat"]')
                if moose:
                    moose.scroll_into_view_if_needed()
                    time.sleep(0.3)
                    moose.screenshot(path=str(OUT / f'{vp}-security-moose.png'))
                    chips = [
                        'Is my account safe right now?',
                        'What attacks did we stop this week?',
                        'Who on my team needs to fix their password or 2FA?',
                        'What protects my event pages?',
                    ]
                    for i, label in enumerate(chips, 1):
                        btn = pg.query_selector(f'[data-testid="moose-suggestions"] button:has-text("{label}")')
                        if btn:
                            btn.click()
                            pg.wait_for_timeout(1200)
                            moose.screenshot(path=str(OUT / f'{vp}-security-moose-q{i}.png'))
                    box = pg.query_selector('input[aria-label="Ask Moose about these numbers"]')
                    if box:
                        box.click()
                        box.fill('')
                        box.type('Are there any breached accounts?', delay=25)
                        box.press('Enter')
                        pg.wait_for_timeout(1500)
                        moose.screenshot(path=str(OUT / f'{vp}-security-moose-free-text.png'))
                    if hero:
                        hero.scroll_into_view_if_needed()
                        time.sleep(0.3)
                        hero.screenshot(path=str(OUT / f'{vp}-security-hero-after.png'))
                    msgs = pg.inner_text('[data-testid="moose-messages"]') if pg.query_selector('[data-testid="moose-messages"]') else ''
                    res[f'{vp}:security-moose'] = {'replies': msgs[:4000]}
                for key, sel in [
                    ('team-health', '[data-testid="team-account-health"]'),
                    ('team-health-summary', '[data-testid="team-health-summary"]'),
                    ('protection-layers', '[data-testid="protection-layers"]'),
                    ('suspected-attacks', '[data-testid="suspected-attacks"]'),
                ]:
                    el = pg.query_selector(sel)
                    if el:
                        el.scroll_into_view_if_needed()
                        time.sleep(0.3)
                        el.screenshot(path=str(OUT / f'{vp}-security-{key}.png'))
            if r == 'analytics':
                hero = pg.query_selector('[data-testid="analytics-home-hero"]')
                if hero:
                    hero.scroll_into_view_if_needed()
                    time.sleep(0.3)
                    hero.screenshot(path=str(OUT / f'{vp}-analytics-hero.png'))
                stats = pg.query_selector('[data-testid="analytics-hero-stats"]')
                if stats:
                    stats.scroll_into_view_if_needed()
                    time.sleep(0.3)
                    stats.screenshot(path=str(OUT / f'{vp}-analytics-stats.png'))
                moose = pg.query_selector('[data-testid="moose-chat"]')
                if moose:
                    moose.scroll_into_view_if_needed()
                    time.sleep(0.3)
                    moose.screenshot(path=str(OUT / f'{vp}-analytics-moose.png'))
                    chips = [
                        'Which event is selling fastest?',
                        'How did last weekend compare?',
                        'Where are my buyers coming from?',
                        'What should I promote next?',
                    ]
                    for i, label in enumerate(chips, 1):
                        btn = pg.query_selector(f'[data-testid="moose-suggestions"] button:has-text("{label}")')
                        if btn:
                            btn.click()
                            pg.wait_for_timeout(1200)
                            moose.screenshot(path=str(OUT / f'{vp}-analytics-moose-q{i}.png'))
                    box = pg.query_selector('input[aria-label="Ask Moose about these numbers"]')
                    if box:
                        box.click()
                        box.fill('')
                        box.type('How many visitors do we have?', delay=25)
                        box.press('Enter')
                        pg.wait_for_timeout(1500)
                        moose.screenshot(path=str(OUT / f'{vp}-analytics-moose-free-text.png'))
                    if hero:
                        hero.scroll_into_view_if_needed()
                        time.sleep(0.3)
                        hero.screenshot(path=str(OUT / f'{vp}-analytics-hero-after.png'))
                    # capture conversation text for the report
                    msgs = pg.inner_text('[data-testid="moose-messages"]') if pg.query_selector('[data-testid="moose-messages"]') else ''
                    res[f'{vp}:moose'] = {'replies': msgs[:4000]}
            txt = pg.inner_text('main') if pg.query_selector('main') else pg.inner_text('body')
            nav = [a.inner_text().strip() for a in pg.query_selector_all('header nav a')]
            res[f'{vp}:{r}'] = {'url': pg.url, 'console': list(cur['c']), 'failed': list(cur['f']), 'text': txt[:1500], 'nav': nav}
            if r == 'events' and vp == 'desktop':
                links = pg.eval_on_selector_all('a[href^="/events/"]', 'els => els.map(e => e.getAttribute("href"))')
                res['eventLinks'] = links[:20]
        if vp == 'mobile':
            pg.goto(BASE + '/dashboard', wait_until='networkidle'); time.sleep(1)
            btn = pg.query_selector('button[aria-controls="dashboard-mobile-nav"]')
            if btn:
                btn.click(); time.sleep(0.8)
                pg.screenshot(path=str(OUT / 'mobile-menu.png'))
                res['mobileMenu'] = [a.inner_text().strip() for a in pg.query_selector_all('#dashboard-mobile-nav a')]
        ctx.close()
        if vp == 'desktop':
            time.sleep(90)
    b.close()
(OUT / 'crawl.json').write_text(json.dumps(res, indent=1))
for k, v in res.items():
    if isinstance(v, dict) and 'url' in v:
        print(f"== {k} -> {v['url'].replace(BASE,'')} console={len(v['console'])} failed={len(v['failed'])}")
        for x in v['console'][:4] + v['failed'][:6]: print('   ', x)
        print('   TEXT:', v['text'][:300].replace('\n', ' | '))
    else:
        print(k, v)
