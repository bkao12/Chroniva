import React,{useState,useEffect,useRef,useMemo,useCallback,useContext} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import * as Accordion from '@radix-ui/react-accordion';
import {loadAtlas} from './atlas-content.js';

const atlas=await loadAtlas();
const nodeMap=new Map();
function indexNodes(list){for(const n of list)if(n.kind!=='rich'){nodeMap.set(n.id,n);indexNodes(n.children||[])}}
indexNodes(atlas.roots);
const STORAGE='evolutionary-atlas-timeline-view-v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{}
const validFamily=value=>atlas.families.includes(value)?value:'';
let searchPromise;
function prepareSearch(){
 return searchPromise??=import('./search.js').then(({createSearch})=>createSearch(atlas.search)).catch(error=>{searchPromise=null;throw error});
}
function collect(list,focus,output=[]){for(const n of list){if(n.kind==='rich'||(n.kind==='set'&&focus&&n.family!==focus))continue;output.push(n.id);collect(n.children||[],focus,output)}return output}
function clearMarks(){document.querySelectorAll('mark[data-search-mark]').forEach(m=>{const p=m.parentNode;m.replaceWith(document.createTextNode(m.textContent));p?.normalize()})}
function highlight(root,query){
 clearMarks();if(!query)return null;
 const terms=[...new Set([query,...query.split(/\s+/)])].filter(x=>x.length>1).sort((a,b)=>b.length-a.length);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('.rich,.bp-title-html')&&!n.parentElement.closest('button:not(.node-trigger),script,style')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
 const texts=[];while(walker.nextNode())texts.push(walker.currentNode);
 let first=null,count=0;
 for(const n of texts){if(count>120)break;const source=n.nodeValue;const low=source.toLowerCase();let chosen=null;
  for(const t of terms){const at=low.indexOf(t.toLowerCase());if(at>=0){chosen={at,len:t.length};break}}
  if(!chosen)continue;const frag=document.createDocumentFragment();frag.append(source.slice(0,chosen.at));
  const mark=document.createElement('mark');mark.dataset.searchMark='true';mark.textContent=source.slice(chosen.at,chosen.at+chosen.len);frag.append(mark,source.slice(chosen.at+chosen.len));n.replaceWith(frag);first??=mark;count++;
 }
 return first;
}
function snippet(record,q){const s=record.body||record.title;const at=s.toLowerCase().indexOf(q.toLowerCase());const token=q.split(/\s+/).find(t=>t.length>2&&s.toLowerCase().includes(t.toLowerCase()));const index=at>=0?at:token?s.toLowerCase().indexOf(token.toLowerCase()):0;const start=Math.max(0,index-65);return(start?'…':'')+s.slice(start,start+240)+(s.length>start+240?'…':'')}
function Chevron(){return <svg className="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>}
const Rich=React.memo(function Rich({html:content}){return <div className="rich" dangerouslySetInnerHTML={{__html:content}}/>});

const TimelineContext=React.createContext(null);
function Branches({items,depth=0}){
  const {open,focus,changeLevel}=useContext(TimelineContext);
  const shown=items.filter(n=>n.kind!=='set'||!focus||n.family===focus);
  const structural=shown.filter(n=>n.kind!=='rich');
  return <Accordion.Root type="multiple" value={structural.filter(n=>open.has(n.id)).map(n=>n.id)} onValueChange={values=>changeLevel(structural,values)} className={depth===0?'timeline':'branch-list'}>
   {shown.map((n,i)=>n.kind==='rich'?(focus&&!n.context?null:<Rich key={'rich-'+i} html={n.html}/>):<Node key={n.id} n={n} depth={depth}/>)}
  </Accordion.Root>;
 }
function Node({n,depth}){
  const {focus,active,bulk}=useContext(TimelineContext);
  const Heading=depth===0?'h2':depth===1?'h3':'h4';
  const canBulk=['period','set'].includes(n.kind);
  const hasMatches=n.kind==='period'&&n.children.some(c=>c.kind==='set'&&c.family===focus);
  return <Accordion.Item value={n.id} id={n.id} className={`node node-${n.kind} ${depth===0?'root-node':''} ${active===n.id?'active-destination':''}`} data-node-kind={n.kind} data-family={n.family||undefined}>
   <div className="node-row">
    <Accordion.Header asChild><Heading className="node-heading"><Accordion.Trigger className="node-trigger">
     <Chevron/><span className="title-stack">{n.titleHtml?<span className="bp-title-html" dangerouslySetInnerHTML={{__html:n.titleHtml}}/>:<span className="node-title">{n.title}</span>}
     {n.age&&<span className="period-age">{n.age}</span>}
     {n.kind==='chapter'&&<span className="chapter-caption">Reference chapter</span>}
     </span>
    </Accordion.Trigger></Heading></Accordion.Header>
    {canBulk&&<div className="range-controls" aria-label={'Bulk controls for '+n.title}>
     <button type="button" onClick={()=>bulk(n,true)} aria-label={'Expand all within '+n.title} title="Open everything within this range">Expand all</button>
     <button type="button" onClick={()=>bulk(n,false)} aria-label={'Collapse all within '+n.title} title="Close everything within this range">Collapse all</button>
    </div>}
   </div>
   <Accordion.Content className="node-content">
    {n.bodyHtml?<Rich html={n.bodyHtml}/>:<>
     <Branches items={n.children} depth={depth+1}/>
     {focus&&n.kind==='period'&&!hasMatches&&<p className="empty-set">“{focus}” is not listed under this period in the Atlas.</p>}
    </>}
   </Accordion.Content>
  </Accordion.Item>;
 }

function App(){
 const [open,setOpen]=useState(()=>new Set((saved.open||[]).filter(k=>nodeMap.has(k))));
 const [focus,setFocus]=useState(()=>validFamily(saved.focus));
 const [selection,setSelection]=useState(()=>validFamily(saved.selection)||validFamily(saved.focus));
 const [query,setQuery]=useState(''),[results,setResults]=useState([]),[limit,setLimit]=useState(60),[searchInfo,setSearchInfo]=useState('');
 const [searching,setSearching]=useState(false),[searchedQuery,setSearchedQuery]=useState('');
 const [notice,setNotice]=useState(''),[pending,setPending]=useState(null),[active,setActive]=useState('');
 const [currentSection,setCurrentSection]=useState('');
 const header=useRef(),dialog=useRef(),searchInput=useRef(),focusRef=useRef(focus),openRef=useRef(open),searchRequest=useRef(0);
 focusRef.current=focus;openRef.current=open;
 useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({open:[...open],focus,selection}))}catch{}},[open,focus,selection]);
 useEffect(()=>{const ro=new ResizeObserver(()=>document.documentElement.style.setProperty('--toolbar-height',(header.current.getBoundingClientRect().height+18)+'px'));ro.observe(header.current);return()=>ro.disconnect()},[]);
 useEffect(()=>{
  let frame=0;
  function update(){
   frame=0;
   const roots=[...document.querySelectorAll('.root-node')];if(!roots.length)return;
   const readingLine=header.current.getBoundingClientRect().bottom+24;
   let current=roots[0];
   for(const root of roots){if(root.getBoundingClientRect().top<=readingLine)current=root;else break}
   if(window.scrollY+window.innerHeight>=document.documentElement.scrollHeight-2)current=roots.at(-1);
   setCurrentSection(previous=>previous===current.id?previous:current.id);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update)}
  // Resizing also covers content expanding/collapsing without a scroll event.
  const observer=new ResizeObserver(schedule);
  observer.observe(document.body);observer.observe(header.current);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  schedule();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule)};
 },[]);
 const changeLevel=useCallback((children,values)=>{setOpen(previous=>{const next=new Set(previous);const wanted=new Set(values);for(const n of children){if(n.kind==='rich')continue;if(wanted.has(n.id))next.add(n.id);else next.delete(n.id)}return next})},[]);
 function bulk(node,expand){
  const list=node?[node]:atlas.roots;const affected=collect(list,focus);
  setOpen(previous=>{const next=new Set(previous);for(const id of affected)expand?next.add(id):next.delete(id);return next});
  setPending(null);setActive('');clearMarks();
  setNotice(`${expand?'Expanded':'Collapsed'} ${node?node.title:focus?'visible content':'the full Atlas'}.`);
 }
 function crossPeriod(expand){
  if(!selection)return;
  const matches=[...nodeMap.values()].filter(n=>n.kind==='set'&&n.family===selection);
  setOpen(previous=>{const next=new Set(previous);
   for(const n of matches){next.add(n.path[0]);for(const id of collect([n],'')){const child=nodeMap.get(id);if(expand&&child.kind!=='bp')next.add(id);else next.delete(id)}}
   return next;
  });
  setFocus(selection);setPending(null);setActive('');clearMarks();
  setNotice(`${expand?'Opened to BP names':'Collapsed'} “${selection}” across ${matches.length} periods. All period headings and other chapters remain available.`);
 }
 const reveal=useCallback((id,{q='',sourceRecord=null,push=true}={})=>{
  const meta=atlas.targets[id];if(!meta){setNotice('That destination is not present in this version of the Atlas.');return}
  const owner=nodeMap.get(meta.path[0]);
  if(focusRef.current&&((meta.family&&meta.family!==focusRef.current)||meta.hiddenInFocus||owner?.kind==='chapter'))setFocus('');
  setOpen(previous=>new Set([...previous,...meta.path]));
  setPending({id,q,sourceRecord,stamp:performance.now()});setActive(id);
  if(push&&decodeURIComponent(location.hash.slice(1))!==id)history.pushState(null,'','#'+encodeURIComponent(id));
 },[]);
 useEffect(()=>{
  if(!pending)return;let cancelled=false,frame,tries=0;
  function settle(){if(cancelled)return;
   const el=document.getElementById(pending.id);
   if(!el||!el.getClientRects().length){if(tries++<90)frame=requestAnimationFrame(settle);else{setNotice('The destination could not be displayed.');setPending(null)}return}
   let scope=el;
   if(pending.sourceRecord){const hit=[...el.querySelectorAll('[data-source-record]')].find(e=>e.dataset.sourceRecord===pending.sourceRecord);if(hit)scope=hit}
   const marked=highlight(scope,pending.q);
   const scrollTarget=marked||scope;
   scrollTarget.scrollIntoView({block:'start',behavior:'instant'});
   const trigger=el.querySelector(':scope > .node-row .node-trigger');
   const focusTarget=trigger||el;if(!focusTarget.hasAttribute('tabindex')&&!['BUTTON','A','INPUT','SELECT'].includes(focusTarget.tagName))focusTarget.setAttribute('tabindex','-1');
   focusTarget.focus({preventScroll:true});setNotice(pending.q?`Showing a match for “${pending.q}”.`:'Destination opened.');setPending(null);
  }
  frame=requestAnimationFrame(()=>requestAnimationFrame(settle));return()=>{cancelled=true;cancelAnimationFrame(frame)};
 },[pending,open,focus]);
 useEffect(()=>{
  const go=()=>{try{const id=decodeURIComponent(location.hash.slice(1));if(id)reveal(id,{push:false})}catch{}};
  go();window.addEventListener('hashchange',go);window.addEventListener('popstate',go);
  const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchInput.current?.focus()}};
  window.addEventListener('keydown',key);
  return()=>{window.removeEventListener('hashchange',go);window.removeEventListener('popstate',go);window.removeEventListener('keydown',key)};
 },[reveal]);
 function handleLinks(event){
  const link=event.target.closest('a[href^="#"]');
  if(link){event.preventDefault();reveal(decodeURIComponent(link.getAttribute('href').slice(1)));return}
  const lens=event.target.closest('.lens-jump');if(lens){const match=[...nodeMap.values()].find(n=>n.kind==='bp'&&n.lens===lens.dataset.lens);if(match)reveal(match.id)}
 }
 async function runSearch(value=query){
  const q=value.trim();if(!q)return;
  const request=++searchRequest.current;
  setSearching(true);setSearchInfo('Preparing search…');setResults([]);setSearchedQuery(q);
  if(!dialog.current.open)dialog.current.showModal();
  // Let the preparation notice paint before building the index on first use.
  await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  try{
   const search=await prepareSearch();
   if(request!==searchRequest.current)return;
   const found=search(q);setResults(found.results);setLimit(60);setSearchInfo(found.info);
  }catch(error){
   if(request===searchRequest.current)setSearchInfo('Search could not initialize. Try again or use the reading view.');
  }finally{if(request===searchRequest.current)setSearching(false)}
 }
 function chooseResult(r){dialog.current.close();reveal(r.target,{q:searchedQuery,sourceRecord:r.sourceRecord})}
 return <TimelineContext.Provider value={{open,focus,changeLevel,active,bulk}}><div className="atlas-app" onClick={handleLinks}>
  <header className="app-header" ref={header}>
   <div className="brand-row"><div><h1>Evolutionary Learning Atlas</h1><p>Interactive timeline</p></div><a className="original-link" href="./read.html">Reading view</a></div>
   <div className="navigation-row">
    <form className="search-form" onSubmit={e=>{e.preventDefault();runSearch()}}><label className="sr-only" htmlFor="atlas-search">Search the entire Atlas</label><input id="atlas-search" ref={searchInput} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search every BP, drug, pathogen or concept…"/><button type="submit" className="primary">Find</button></form>
    <select aria-label="Jump to period or chapter" title="Shows the section currently in view; select another section to jump there" value={currentSection} onChange={e=>{if(e.target.value)reveal(e.target.value)}}><option value="">Jump to period or chapter</option>{atlas.roots.map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select>
    <div className="global-controls"><button onClick={()=>bulk(null,true)}>{focus?'Expand visible':'Expand all'}</button><button onClick={()=>bulk(null,false)}>{focus?'Collapse visible':'Collapse all'}</button></div>
   </div>
   <div className="focus-row"><label htmlFor="family-select">Functional set across periods</label><select id="family-select" value={selection} onChange={e=>setSelection(e.target.value)}><option value="">Choose a functional set…</option>{atlas.families.map(f=><option key={f}>{f}</option>)}</select>
    <div className="focus-controls"><button disabled={!selection} onClick={()=>crossPeriod(true)} title="Focus this set across periods; open subsets and show BP names">Expand across</button><button disabled={!selection} onClick={()=>crossPeriod(false)} title="Keep focus; collapse this set across periods">Collapse across</button><button disabled={!focus} onClick={()=>{setFocus('');setNotice('Showing the full Atlas.')}}>Show full Atlas</button></div>
   </div>
   {focus&&<p className="focus-status">Focused on <strong>{focus}</strong> · other functional sets are hidden; every period and reference chapter remains available.</p>}
  </header>
  <main className="app-main">
   <div className="reading-intro"><p>{atlas.roots.filter(n=>n.kind==='period').length} periods · {[...nodeMap.values()].filter(n=>n.kind==='bp').length} chronological BPs <span>· Periods are evenly spaced; ages are approximate.</span></p><p>Click a heading to open or close it. BP names retain their role colors and exam-priority underlines.</p></div>
   <p className="live-notice" role="status" aria-live="polite">{notice||'Your opened branches are remembered in this browser.'}</p>
   <Branches items={atlas.roots}/>
   <footer className="app-footer">Your view is saved on this device. <a href="./read.html">Reading view</a> <a href={atlas.sourceUrl} target="_blank" rel="noreferrer">Original Atlas ↗</a></footer>
  </main>
  <dialog ref={dialog} className="search-dialog" aria-labelledby="search-title" onClose={()=>searchInput.current?.focus()}>
   <div className="dialog-heading"><h2 id="search-title">Search the full Atlas</h2><button onClick={()=>dialog.current.close()} aria-label="Close search results">Close</button></div>
   <form onSubmit={e=>{e.preventDefault();runSearch()}} className="dialog-search"><input aria-label="Search query" type="search" value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" className="primary">Find</button></form>
   <p className="results-caption" role="status" aria-live="polite">{searchInfo}{!searching&&<> · {results.length} {results.length===1?'item':'items'}</>}{focus?' · Includes content outside the focused set':''}</p>
   <div className="search-results" aria-busy={searching}>{results.slice(0,limit).map(r=><button className="search-result" key={r.id} onClick={()=>chooseResult(r)}><strong>{r.title}</strong><span className="result-path">{r.pathLabel}</span><span>{snippet(r,searchedQuery)}</span></button>)}{!searching&&!results.length&&<p>No matching items. Try a shorter name, abbreviation or spelling.</p>}</div>
   {results.length>limit&&<button className="more-results" onClick={()=>setLimit(l=>l+60)}>Show more results ({results.length-limit} remaining)</button>}
  </dialog>
 </div></TimelineContext.Provider>;
}
export function mountTimeline(fallback,onError){
 const mount=document.createElement('div');mount.id='root';
 let root,failed=false;
 const restore=()=>{
  failed=true;
  if(mount.isConnected){mount.replaceWith(fallback);document.documentElement.removeAttribute('data-interactive')}
  // React may call the error handler while committing; unmount after that finishes.
  if(root)setTimeout(()=>root.unmount(),0);
 };
 root=createRoot(mount,{onUncaughtError:error=>{restore();onError(error)}});
 // Mount off-screen, then swap once ready, so two copies of the IDs never coexist.
 flushSync(()=>root.render(<App/>));
 if(failed||!mount.querySelector('.timeline')){restore();throw Error('The timeline could not initialize.')}
 fallback.replaceWith(mount);document.documentElement.dataset.interactive='true';
 return restore;
}
