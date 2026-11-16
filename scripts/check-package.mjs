import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'mos-atomic-design-system');
const errors = [];
const files = [];
function walk(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    if (item.isDirectory()) walk(path.join(dir,item.name));
    else files.push(path.join(dir,item.name));
  }
}
walk(skill);
for (const file of files) {
  const text = fs.readFileSync(file,'utf8');
  if (/C:[/\\]Users[/\\]richa|\/mnt\/c\/Users|~\/Desktop|source-material\//.test(text)) errors.push(`${path.relative(root,file)}: private workspace dependency`);
  // Asset templates intentionally link to files generated in the target system.
  if (!file.endsWith('.md') || path.relative(skill,file).startsWith(`assets${path.sep}`)) continue;
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const link=match[1];
    if (/^(?:https?:|#|mailto:)/.test(link) || link.includes('<')) continue;
    const target=path.resolve(path.dirname(file),link.split('#')[0]);
    if (!fs.existsSync(target)) errors.push(`${path.relative(root,file)}: missing linked file ${link}`);
  }
}
const entry=fs.readFileSync(path.join(skill,'SKILL.md'),'utf8');
if(!/^name: mos-atomic-design-system$/m.test(entry))errors.push('Skill identity mismatch');
for(const script of ['discover-brand.ts','init-system.ts','verify-stage.ts','build-index.ts','export-tokens.ts','export-figma.ts','test-verify.ts']) {
  if(!fs.existsSync(path.join(skill,'scripts',script)))errors.push(`Missing helper ${script}`);
}
console.log(JSON.stringify({files:files.length,errors,passed:errors.length===0},null,2));
if(errors.length)process.exitCode=1;
