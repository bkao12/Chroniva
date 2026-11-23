import {build} from 'esbuild';
import {mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
process.chdir(fileURLToPath(new URL('.',import.meta.url)));
const python=process.env.ATLAS_PYTHON||'python3';
execFileSync(python,['scripts/extract.py'],{stdio:'inherit'});
await mkdir('docs',{recursive:true});
// docs/ contains build output only. Remove obsolete hashed assets on every build.
for(const file of await readdir('docs')){
 if(/^(atlas-content(?:\.|$)|content\.|styles\.|dark\.|reading\.)/.test(file)||['read','chunks','app.js.LEGAL.txt'].includes(file))await rm(`docs/${file}`,{recursive:true,force:true});
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex').slice(0,16);
const timeline=JSON.parse(await readFile('.generated/public/atlas.json','utf8'));
const data=JSON.stringify({schema:1,revision:timeline.sourceHash,timeline});
const assets={data:`atlas-content.${hash(data)}.json`};
await writeFile(`docs/${assets.data}`,data);
await rm('docs/atlas.json',{force:true});await rm('docs/legacy.css',{force:true});
for(const [key,path] of Object.entries({content:'.generated/public/legacy.css',styles:'src/styles.css',dark:'src/dark.css',reading:'src/reading.css'})){
 const bytes=await readFile(path);assets[key]=`${key}.${hash(bytes)}.css`;
 await writeFile(`docs/${assets[key]}`,bytes);
}
await build({entryPoints:{app:'src/bootstrap.js'},bundle:true,splitting:true,minify:true,format:'esm',target:['es2022'],outdir:'docs',chunkNames:'chunks/[name]-[hash]',legalComments:'linked'});
// App imports carry content-hashed chunk names; this key also refreshes the entry.
assets.build=hash(await readFile('docs/app.js'));
execFileSync(python,['scripts/render.py',JSON.stringify(assets)],{stdio:'inherit'});
const licenses=(await readdir('node_modules',{recursive:true})).filter(path=>/(^|\/)(LICENSE|LICENCE|NOTICE)(\.[^/]*)?$/i.test(path));
const notices=await Promise.all(licenses.sort().map(async path=>`${path}\n\n${await readFile(`node_modules/${path}`,'utf8')}`));
await writeFile('docs/THIRD_PARTY_LICENSES.txt',notices.join('\n\n----------------------------------------\n\n'));
await writeFile('docs/.nojekyll','');
execFileSync(python,['scripts/verify.py'],{stdio:'inherit'});
