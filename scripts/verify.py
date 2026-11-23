"""Regression checks for HTML availability, content preservation and local links."""
from pathlib import Path
from collections import Counter
from urllib.parse import urlsplit, unquote
from lxml import html
import hashlib
import json

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / 'docs'
source = html.parse(str(REPO / 'content/atlas.html')).xpath('//main')[0]
model = json.loads((REPO / '.generated/public/atlas.json').read_text())
pages = {path.relative_to(OUT).as_posix(): html.parse(str(path)) for path in OUT.rglob('*.html')}
page_ids = {name: {e.get('id') for e in page.xpath('//*[@id]')} for name, page in pages.items()}
bp_count = len(source.xpath('.//article[contains(concat(" ",@class," ")," bp ")]'))

def text(element):
    return ''.join(element.itertext())

def signatures(root, xpath, key):
    return Counter(key(e) for e in root.xpath(xpath))

def verify_content(original, rendered, remapped=False):
    assert text(original) == text(rendered), 'Atlas text or sequence changed'
    assert signatures(original, './/u', text) == signatures(rendered, './/u', text), 'Underlines changed'
    assert signatures(original, './/strong', text) == signatures(rendered, './/strong', text), 'Bold terms changed'
    assert signatures(original, './/*[@style]', lambda e: (e.get('style'), text(e))) == signatures(rendered, './/*[@style]', lambda e: (e.get('style'), text(e))), 'Inline formatting changed'
    assert signatures(original, './/*[@data-source-record]', lambda e: (e.get('data-source-record'), text(e))) == signatures(rendered, './/*[@data-source-record]', lambda e: (e.get('data-source-record'), text(e))), 'Learning records changed'
    def link(e):
        href = e.get('href')
        if remapped and not urlsplit(href).scheme and '#' in href:
            href = '#' + href.split('#', 1)[1]
        return href, text(e)
    assert signatures(original, './/a', link) == signatures(rendered, './/a', link), 'Content hyperlinks changed'
    before = {e.get('id') for e in original.xpath('descendant-or-self::*[@id]')}
    after = {e.get('id') for e in rendered.xpath('descendant-or-self::*[@id]')}
    assert before <= after, 'Stable IDs lost'

for name in ('index.html', 'read.html'):
    page = pages[name]
    rendered = page.xpath('//main')[0]
    verify_content(source, rendered)
    assert set(model['targets']) <= {e.get('id') for e in page.xpath('//*[@id]')}, 'An interactive deep-link target is missing from HTML'
    assert not page.xpath('//noscript|//*[@hidden]|//details[not(@open)]'), 'Static content requires interaction'
    assert len(rendered.xpath('.//article[contains(concat(" ",@class," ")," bp ")]')) == bp_count

original_sections = source.xpath('./section')
assert [s.get('id') for s in original_sections] == [n['id'] for n in model['roots']]
assert len(pages) == len(original_sections) + 2, 'Unexpected or missing reading page'
for section in original_sections:
    page = pages['read/' + section.get('id') + '.html']
    rendered = page.xpath('//main/section')[0]
    verify_content(section, rendered, remapped=True)

for name, page in pages.items():
    ids = [e.get('id') for e in page.xpath('//*[@id]')]
    assert len(ids) == len(set(ids)), f'Duplicate ID in {name}'
    if name != 'index.html':
        assert not page.xpath('//script|//form|//input|//button|//details'), f'Controls or scripts in reading page: {name}'
    for element in page.xpath('//a[@href]|//link[@href]|//script[@src]'):
        url = element.get('href') or element.get('src')
        parts = urlsplit(url)
        if parts.scheme or parts.netloc:
            continue
        assert not parts.path.startswith('/'), f'Root-relative path breaks /Chroniva/: {url}'
        target = (OUT / name).parent / unquote(parts.path) if parts.path else OUT / name
        if target.is_dir():
            target /= 'index.html'
        target = target.resolve()
        assert target.is_relative_to(OUT.resolve()) and target.is_file(), (name, url, 'Missing local file')
        if parts.fragment:
            assert unquote(parts.fragment) in page_ids[target.relative_to(OUT).as_posix()], (name, url, 'Broken anchor')

entry = pages['index.html'].getroot()
data_path = entry.get('data-atlas-content').removeprefix('./')
payload = (OUT / data_path).read_bytes()
assert hashlib.sha256(payload).hexdigest()[:16] in data_path, 'Content asset name does not match bytes'
assert json.loads(payload)['revision'] == model['sourceHash'] == entry.get('data-atlas-revision')
assert (OUT / '.nojekyll').is_file()
audit = dict(htmlPages=len(pages), chapterPages=len(original_sections), bpArticles=bp_count,
             links=len(source.xpath('.//a')), underlines=len(source.xpath('.//u')),
             learningRecords=len(source.xpath('.//*[@data-source-record]')),
             stableTargets=len(model['targets']), sourceHash=model['sourceHash'], preservation='passed')
(REPO / '.generated/html-audit.json').write_text(json.dumps(audit, indent=2))
print(json.dumps(audit, indent=2))
