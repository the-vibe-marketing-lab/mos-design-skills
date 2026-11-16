import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const packageRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'mos-design-port-'));
const site=path.join(workspace,'cedar-studio-site');
const brand=path.join(workspace,'cedar-studio-brain','business','brand');
const other=path.join(workspace,'unrelated-shop','business','brand');
fs.mkdirSync(site,{recursive:true});
fs.mkdirSync(brand,{recursive:true});
fs.mkdirSync(other,{recursive:true});
const brandText=`---\ncanonical: true\nstatus: active\n---\n# Cedar Studio\n\nPrimary: #087F8C\nSecondary: #20232A\nAccent: #EE964B\nHeading font: Inter\nBody font: Source Sans 3\n`;
fs.writeFileSync(path.join(brand,'brand.md'),brandText);
fs.writeFileSync(path.join(other,'brand.md'),brandText.replace('Cedar Studio','Unrelated Shop'));
try {
  const run=spawnSync('bun',[path.join(packageRoot,'mos-atomic-design-system','scripts','discover-brand.ts'),'--target',site,'--json'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr || run.stdout);
  const result=JSON.parse(run.stdout);
  assert.equal(result.best.repoName,'cedar-studio-brain');
  assert(result.otherBrands.some(x=>x.repoName==='unrelated-shop'));
  assert(result.candidates.every(x=>x.repoName!=='unrelated-shop'));
  console.log('Portable discovery finds the matching sibling brain and excludes another business without a Desktop assumption.');
} finally {
  const resolved=path.resolve(workspace);
  assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith('mos-design-port-'));
  fs.rmSync(resolved,{recursive:true,force:true});
}
