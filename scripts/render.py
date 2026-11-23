"""Build readable HTML from the same source used by the interactive timeline."""
from pathlib import Path
from copy import deepcopy
from html import escape
from lxml import html
import json
import sys

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'docs'
model = json.loads((REPO / '.generated/public/atlas.json').read_text())
revision = model['sourceHash']
assets = json.loads(sys.argv[1])
source = html.parse(str(REPO / 'content/atlas.html'))
main = deepcopy(source.xpath('//main')[0])
main.set('class', 'atlas-reading rich')

# Keep names and reference text visible without requiring any controls.
for element in main.xpath('.//button'):
    element.tag = 'span'
    element.attrib.pop('type', None)
for element in main.xpath('.//details'):
    element.tag = 'section'
    element.attrib.pop('open', None)
    for summary in element.xpath('./summary'):
        summary.tag = 'h3'

# The interactive model also has stable IDs for previously unnamed subsets.
for period in model['roots']:
    if period['kind'] != 'period':
        continue
    for group in period['children']:
        if group['kind'] != 'set':
            continue
        original = main.get_element_by_id(group['id'])
        aspects = original.xpath('./div[contains(concat(" ",normalize-space(@class)," ")," functional-aspect ")]')
        versions = [node for node in group['children'] if node['kind'] == 'aspect']
        assert len(aspects) == len(versions)
        for aspect, node in zip(aspects, versions):
            assert ''.join(aspect.find('h4').itertext()) == node['title']
            aspect.set('id', node['id'])

def markup(element):
    return html.tostring(element, encoding='unicode', with_tail=False)

def shell(title, body, prefix='./', interactive=False):
    styles = ''.join(f'<link rel="stylesheet" href="{prefix}{assets[key]}">' for key in ('content', 'styles', 'dark', 'reading'))
    script = f'<script type="module" src="./app.js?v={assets["build"]}"></script>' if interactive else ''
    data = f' data-atlas-content="./{assets["data"]}"' if interactive else ''
    return (f'<!doctype html><html lang="en" data-atlas-revision="{revision}"{data}><head>'
            '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="color-scheme" content="dark"><meta name="theme-color" content="#10151c">'
            '<meta name="description" content="The complete Evolutionary Learning Atlas: biological processes, evolutionary context and clinical learning notes, available directly in HTML.">'
            f'<title>{escape(title)}</title>{styles}</head><body>{body}{script}</body></html>')

def header(title, links, enhanced=False):
    status = '<p data-enhancement-status>Complete reading view. Interactive controls activate when ready.</p>' if enhanced else ''
    return (f'<header class="reading-header"><h1>{escape(title)}</h1>'
            f'<nav aria-label="Atlas views">{links}</nav>{status}</header>')

def index(chapters=False):
    links = []
    for root in model['roots']:
        href = './read/' + root['id'] + '.html' if chapters else '#' + root['id']
        links.append(f'<li><a href="{href}">{escape(root["title"])}</a></li>')
    label = 'Read a period or chapter' if chapters else 'Periods and chapters'
    return f'<nav class="chapter-index" aria-label="{label}"><h2>{label}</h2><ol>{"".join(links)}</ol></nav>'

complete = markup(main)
fallback = header('Evolutionary Learning Atlas', '<a href="./read.html">Reading view and chapter pages</a>', True) + index() + complete
(OUT / 'index.html').write_text(shell('Evolutionary Learning Atlas — Interactive Timeline', '<div id="root">' + fallback + '</div>', interactive=True))
reading = header('Evolutionary Learning Atlas — Reading view', '<a href="./">Interactive timeline</a>') + index(True) + complete
(OUT / 'read.html').write_text(shell('Evolutionary Learning Atlas — Reading view', reading))

reading_dir = OUT / 'read'
reading_dir.mkdir(exist_ok=True)
preface = [deepcopy(element) for element in main if element.tag != 'section']
for i, root in enumerate(model['roots']):
    chapter_main = html.Element('main', {'class': 'atlas-reading rich'})
    if i == 0:
        chapter_main.extend(deepcopy(preface))
    chapter_main.append(deepcopy(main.get_element_by_id(root['id'])))
    for link in chapter_main.xpath('.//a[starts-with(@href,"#")]'):
        target = link.get('href')[1:]
        owner = model['targets'][target]['path'][0]
        if owner != root['id']:
            link.set('href', owner + '.html#' + target)
    navigation = [f'<a href="../read.html">Full reading view and chapter index</a>', f'<a href="../#{root["id"]}">Interactive timeline</a>']
    if i:
        previous = model['roots'][i-1]
        navigation.append(f'<a rel="prev" href="{previous["id"]}.html">Previous: {escape(previous["title"])}</a>')
    if i+1 < len(model['roots']):
        following = model['roots'][i+1]
        navigation.append(f'<a rel="next" href="{following["id"]}.html">Next: {escape(following["title"])}</a>')
    page = header(root['title'], ' '.join(navigation)) + markup(chapter_main)
    (reading_dir / (root['id'] + '.html')).write_text(shell(root['title'] + ' — Evolutionary Learning Atlas', page, '../'))

print(f'Generated full HTML homepage, reading view and {len(model["roots"])} chapter pages.')
