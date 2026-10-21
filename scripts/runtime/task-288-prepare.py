#!/usr/bin/env python3
"""Replay pinned official packages; extract only, never install or run maintainer scripts."""
import hashlib,json,os,pathlib,subprocess,urllib.request
os.umask(0o077)
r=pathlib.Path('/home/daniel/projects/projectTixmo/runtime/task-288')
(r/'packages').mkdir(parents=True,exist_ok=True);(r/'root').mkdir(exist_ok=True)
assert r.stat().st_mode & 0o077 == 0,'Runtime must be private'
manifest=json.loads((pathlib.Path(__file__).resolve().parents[2]/'docs/evidence/task-288/packages.json').read_text())
for entry in manifest:
    url=entry['url']; name=entry['file']
    assert pathlib.Path(name).name==name
    assert url.startswith(('https://ca.archive.ubuntu.com/ubuntu/','https://security.ubuntu.com/ubuntu/'))
    p=r/'packages'/name
    data=p.read_bytes() if p.exists() else urllib.request.urlopen(url,timeout=25).read()
    assert hashlib.sha256(data).hexdigest()==entry['sha256']
    algorithm,expected=entry['apt_digest'].split(':')
    assert hashlib.new(algorithm.lower(),data).hexdigest()==expected
    p.write_bytes(data)
    fields=subprocess.check_output(['dpkg-deb','-f',str(p),'Package','Version','Architecture','Depends'],text=True)
    assert fields==entry['metadata']
    subprocess.run(['dpkg-deb','-x',str(p),str(r/'root')],check=True)
(r/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Verified and extracted',len(manifest),'pinned official Ubuntu packages to',r)

(r/'cache').mkdir(exist_ok=True)
(r/'fonts.conf').write_text(f'''<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
<dir>{r}/root/usr/share/fonts/truetype/dejavu</dir>
<cachedir>{r}/cache/fontconfig</cachedir>
<alias><family>sans-serif</family><prefer><family>DejaVu Sans</family></prefer></alias>
<alias><family>serif</family><prefer><family>DejaVu Serif</family></prefer></alias>
<alias><family>monospace</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>
</fontconfig>
''')
