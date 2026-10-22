import subprocess, re, hashlib
p='tixmoapi2/tests/integration/order-double-cancel.race.test.ts'
b='dd15dc14369e54c67bd8f4d6a81e7ae0e7d4fb6c'; h='0dfb0badcd1cd6afc01c8047abc99622941af3d7'
o='e7654ccd7b3f207df2d83da43c57323304f3c3cb'; r='c9c9e7f354a72c49f6885e4df31b8713d34065fe'
def git(*a): return subprocess.check_output(['git',*a])
def source(s): return git('show',s+':'+p)
a,z=source(b),source(h)
assert a==source(o) and z==source(r)
assert git('diff','--name-only',b,h).decode().splitlines()==[p]
assert git('diff','--numstat',b,h).decode().split('\t')[:2]==['7','2']
assert git('diff',b,h,'--',p)==git('diff',o,r,'--',p)
# Each expect token through its enclosing statement terminator includes the full
# matcher and arguments, including multiline/nested expect.any callsites.
def assertions(s):
 return [s[m.start():s.index(b';',m.start())+1] for m in re.finditer(rb'\bexpect\(',s)]
x,y=assertions(a),assertions(z)
assert len(x)==17 and x==y
assert b'const result = await original(callback, options);\n      if (index >= 0) committed[index].resolve();' in z
assert b'await bounded(committed[winnerIndex].promise);' in z
print('PASS one file +7/-2; identical reviewed diff; old/new byte parity; all 17 full expect chains/arguments unchanged')
print('repaired SHA256',hashlib.sha256(z).hexdigest())
subprocess.run(['git','diff','--check',b,h],check=True)
