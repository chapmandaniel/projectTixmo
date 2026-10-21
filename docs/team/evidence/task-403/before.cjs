'use strict';
const fs=require('node:fs');
const cp=require('node:child_process');
const Module=require('node:module');
const path=require('node:path');
const previous=cp.execFileSync('git',['show','5a64d9739f148d966534ba802ddd162fc17e053d:docs/team/evidence/task-379/network-guard.cjs'],{encoding:'utf8'});
const fixture=path.resolve('docs/team/evidence/task-401/native-http-regression.cjs');
const body=fs.readFileSync(fixture,'utf8').replace("require('../task-379/network-guard.cjs');",'new Function("require", '+JSON.stringify(previous)+')(require);');
const m=new Module(fixture,module); m.filename=fixture; m.paths=Module._nodeModulePaths(path.dirname(fixture)); m._compile(body,fixture);
