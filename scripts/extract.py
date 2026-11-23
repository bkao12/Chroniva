from pathlib import Path
from copy import deepcopy
from collections import Counter
from lxml import html,etree
import json,hashlib,re

ROOT=Path(__file__).resolve().parent.parent/'.generated'
ROOT.mkdir(exist_ok=True);(ROOT/'public').mkdir(exist_ok=True)
SOURCE=Path(__file__).resolve().parent.parent/'content/atlas.html'
doc=html.parse(str(SOURCE));main=doc.xpath('//main')[0]
legacy_index=json.loads(doc.getroot().get_element_by_id('index').text)
nodes={};targets={};search=[];serial=0
def txt(e):return ''.join(e.itertext())
def markup(e):return html.tostring(e,encoding='unicode',with_tail=False)
def inner(e):return (e.text or '')+''.join(html.tostring(c,encoding='unicode') for c in e)
def cls(e,c):return c in e.get('class','').split()
def add_target(id,path,family=None,hidden=False):
 if id in targets:assert targets[id]['path']==path,(id,targets[id],path)
 targets[id]=dict(path=path,family=family,hiddenInFocus=hidden)
def record(title,body,target,path,source_record=None):
 global serial
 if not body.strip() and not title.strip():return
 serial+=1;search.append(dict(id='search-'+str(serial),title=title,body=body,target=target,
   pathLabel=' › '.join(nodes[k]['title'] for k in path),sourceRecord=source_record))
def scan(fragment,path,family=None,hidden=False,index=True):
 root=html.fragment_fromstring('<div>'+fragment+'</div>')
 for e in root.xpath('.//*[@id]'):add_target(e.get('id'),path,family,hidden)
 if index:
  blocks=root.xpath('.//p|.//h3|.//h4|.//summary')
  if not blocks:blocks=[root]
  for e in blocks:
   # Nested note paragraphs are individual search items; preserve their anchors.
   nearest=next((a for a in [e]+list(e.iterancestors()) if a.get('id')),None)
   dest=nearest.get('id') if nearest is not None else path[-1]
   known=next((legacy_index[a.get('id')] for a in [e]+list(e.iterancestors()) if a.get('id') in legacy_index),None)
   label=known or (txt(e).split(':',1)[0][:95] if ':' in txt(e)[:150] else nodes[path[-1]]['title'])
   record(label,txt(e),dest,path,e.get('data-source-record'))
def make_node(key,kind,title,path,family=None,title_html=None,**extra):
 n=dict(id=key,kind=kind,title=title,titleHtml=title_html or '',path=path+[key],family=family,children=[],**extra)
 nodes[key]=n;add_target(key,n['path'],family)
 record(title,'',key,n['path']);return n
def rich(e,path,family=None,hidden=False):
 s=markup(e);scan(s,path,family,hidden)
 return dict(kind='rich',html=s,context=cls(e,'period-context'))
def parse_bp(e,path,family):
 key=e.get('id');line=e.xpath('./p[@class="bp-line"]')[0];term=line.xpath('./span[@class="bp-term"]')[0]
 n=make_node(key,'bp',txt(term),path,family,title_html=markup(term),lens=e.get('data-personal-lens'))
 copy=deepcopy(e);copy.attrib.pop('id',None)
 heading=copy.xpath('./p[@class="bp-line"]')[0];t=heading.xpath('./span[@class="bp-term"]')[0]
 tail=t.tail or '';previous=t.getprevious();heading.remove(t)
 if previous is not None:previous.tail=(previous.tail or '')+tail
 else:heading.text=(heading.text or '')+tail
 copy.tag='div';copy.set('class','source-bp-body')
 n['bodyHtml']=markup(copy)
 scan(n['bodyHtml'],n['path'],family,index=False)
 record(n['title'],txt(e),key,n['path'])
 return n
def parse_aspect(e,path,family,index):
 h=e.find('h4');key=e.get('id') or 'tl-aspect-'+path[-1]+'-'+str(index)
 n=make_node(key,'aspect',txt(h),path,family)
 for child in e:
  if child is h:continue
  n['children'].append(parse_bp(child,n['path'],family) if child.tag=='article' and cls(child,'bp') else rich(child,n['path'],family))
 return n
def parse_set(e,path):
 h=e.find('h3');family=e.get('data-functional-set');n=make_node(e.get('id'),'set',family,path,family)
 for i,child in enumerate(e):
  if child is h:continue
  n['children'].append(parse_aspect(child,n['path'],family,i) if cls(child,'functional-aspect') else rich(child,n['path'],family))
 return n

roots=[];preface=''.join(markup(e) for e in main if e.tag!='section')
for e in main.xpath('./section'):
 h=e.find('h2');key=e.get('id');is_period=key.startswith('section-') and 1<=int(key.split('-')[1])<=23
 age=''
 if is_period:
  contexts=e.xpath('./div[@class="period-context"]/p')
  if contexts:age=txt(contexts[0]).split(':',1)[1].strip()
 n=make_node(key,'period' if is_period else 'chapter',txt(h),[],age=age)
 if not is_period:
  n['bodyHtml']=(preface if key=='section-0' else '')+''.join(markup(c) for c in e if c is not h)
  scan(n['bodyHtml'],n['path'])
 else:
  for child in e:
   if child is h:continue
   n['children'].append(parse_set(child,n['path']) if cls(child,'functional-set') else rich(child,n['path'],hidden=not cls(child,'period-context')))
 roots.append(n)

# Remove duplicate title-only search records where a rich, complete BP record exists.
search=[r for r in search if r['body'] or nodes.get(r['target'],{}).get('kind')!='bp']
families=sorted({n['family'] for n in nodes.values() if n['kind']=='set'})
data=dict(roots=roots,targets=targets,search=search,families=families,
 sourceUrl='https://evolutionary-learning-atlas.diligentcliff2.chatgpt.site',
 sourceHash=hashlib.sha256(SOURCE.read_bytes()).hexdigest())
fragments=[]
for n in nodes.values():
 if n.get('titleHtml'):fragments.append(n['titleHtml'])
 if n.get('bodyHtml'):fragments.append(n['bodyHtml'])
 for c in n['children']:
  if c['kind']=='rich':fragments.append(c['html'])
reconstituted=html.fragment_fromstring('<div>'+''.join(fragments)+'</div>')
def signatures(tree,xpath,fn):return Counter(fn(e) for e in tree.xpath(xpath))
for xp,fn in [('.//a',lambda e:(e.get('href'),txt(e))),('.//u',txt),('.//*[@data-source-record]',lambda e:e.get('data-source-record'))]:
 assert signatures(main,xp,fn)==signatures(reconstituted,xp,fn),xp
original_ids={e.get('id') for e in main.xpath('.//*[@id]')}
assert original_ids<=set(targets),original_ids-set(targets)
for a in main.xpath('.//a[starts-with(@href,"#")]'):assert a.get('href')[1:] in targets
assert any(n['kind']=='bp' for n in nodes.values())
(ROOT/'public/atlas.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
(ROOT/'public/legacy.css').write_text(doc.xpath('//head/style')[0].text)
audit=dict(nodes=Counter(n['kind'] for n in nodes.values()),targets=len(targets),searchItems=len(search),
 sourceIds=len(original_ids),links=len(main.xpath('.//a')),underlines=len(main.xpath('.//u')),
 sourceRecords=len(main.xpath('.//*[@data-source-record]')),sourceHash=data['sourceHash'],preservation='passed')
(ROOT/'preservation-audit.json').write_text(json.dumps(audit,indent=2));print(json.dumps(audit,indent=2))
