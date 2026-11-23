import Fuse from 'fuse.js';

export const normalize=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[–—−]/g,'-').toLowerCase().replace(/\s+/g,' ').trim();

// Called on the first search, after the readable page and timeline are available.
export function createSearch(source){
 const records=source.map(r=>({...r,normalizedTitle:normalize(r.title),normalizedBody:normalize(r.body)}));
 const fuse=new Fuse(records,{keys:[{name:'normalizedTitle',weight:0.55},{name:'normalizedBody',weight:0.45}],ignoreLocation:true,threshold:0.24,minMatchCharLength:2,includeScore:true});
 return value=>{
  const q=normalize(value);
  const exact=records.filter(r=>r.normalizedTitle.includes(q)||r.normalizedBody.includes(q));
  let found=exact,info='Full-text matches';
  if(!exact.length){found=fuse.search(q).map(r=>r.item);info='Similar matches — no exact text match'}
  const seen=new Set();
  found=found.filter(r=>{const key=r.target+'|'+r.sourceRecord+'|'+r.title+'|'+r.body.slice(0,60);if(seen.has(key))return false;seen.add(key);return true});
  found.sort((a,b)=>Number(b.normalizedTitle.includes(q))-Number(a.normalizedTitle.includes(q)));
  return {results:found,info};
 };
}
