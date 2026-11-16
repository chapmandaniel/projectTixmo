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
            pg.goto(f'{BASE}/{r}', wait_until='networkidle'); time.sleep(2.5)
            name = re.sub(r'[^a-z0-9]+', '-', r)
            pg.screenshot(path=str(OUT / f'{vp}-{name}.png'), full_page=(vp == 'desktop'))
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
    b.close()
(OUT / 'crawl.json').write_text(json.dumps(res, indent=1))
for k, v in res.items():
    if isinstance(v, dict):
        print(f"== {k} -> {v['url'].replace(BASE,'')} console={len(v['console'])} failed={len(v['failed'])}")
        for x in v['console'][:4] + v['failed'][:6]: print('   ', x)
        print('   TEXT:', v['text'][:300].replace('\n', ' | '))
    else: print(k, v)
