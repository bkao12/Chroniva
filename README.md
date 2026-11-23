# Chroniva

An HTML-first Evolutionary Learning Atlas with an expandable chronological hierarchy, universal search, linked BP navigation, remembered open branches, and dark mode.

The existing BP colors, exam-priority underlines, hyperlinks, period context, functional sets, and clinical notes are preserved. This repository is an independent copy; editing it does not update either GPT Site.

## Files

- `docs/index.html`: the complete Atlas in the initial HTML response; JavaScript enhances it into the interactive timeline.
- `docs/read.html`: the complete, expanded reading view, with no JavaScript.
- `docs/read/*.html`: one JavaScript-free reading page per period or reference chapter, linked from the reading view.
- `src/`: the interactive interface and styles.
- `content/atlas.html`: this version's editable Atlas content.
- `scripts/extract.py`: derives the hierarchy and search index and checks content preservation.
- `scripts/render.py`: generates all reading layouts from that same source, including cross-chapter links.
- `scripts/verify.py`: checks text, inline formatting, bold terms, underlines, learning records, IDs and local hyperlinks in the generated HTML.
- `docs/THIRD_PARTY_LICENSES.txt`: licenses for the bundled interface libraries.

## Read or publish with GitHub Pages

The generated website is in `docs/`, including `.nojekyll`. With **Settings → Pages → Deploy from a branch → main → /docs**, its addresses are:

- Interactive timeline: `https://bkao12.github.io/Chroniva/`
- Full reading view: `https://bkao12.github.io/Chroniva/read.html`
- A chapter, for example LUCA: `https://bkao12.github.io/Chroniva/read/section-2.html`

If the existing Pages configuration instead publishes the **repository root**, add `/docs` after `/Chroniva` in these addresses (for example, `https://bkao12.github.io/Chroniva/docs/read.html`). This update leaves Pages settings and repository visibility unchanged. Relative links and assets support both layouts and custom domains.

The homepage already contains every BP and its clinical notes before any scripts run. If JavaScript or interactive data loading fails, it remains an expanded reading layout. Once the interface is ready, it replaces that layout atomically, with no duplicate IDs. First-time visitors then get the usual collapsed timeline; remembered branches and deep links still work.

Search loads and prepares its index on first use, after the Atlas is displayed. Content and styles use hashed filenames, and the application entry uses a build revision, so unchanged files can be cached and new builds request new versions. There is no timestamp-based cache bypass or runtime backend.

For automated readers, use `read.html` or a linked chapter page: their complete contents are available in HTML, they never switch to collapsed controls, and they require no application scripts or repository-file retrieval. Reader access to a particular hosting address still needs a live check; local HTML verification alone does not establish that a remote reader can retrieve it.

## Update content or interface

The prebuilt `docs/` website can be published without installing build tools. To rebuild after edits, use Node.js 24+ and Python 3 (a virtual environment is suitable):

```sh
npm ci
python3 -m pip install -r requirements.txt
npm run build
```

Edit `content/atlas.html` for Atlas content, or `src/` for interface changes. The build regenerates `docs/`, removes obsolete generated assets and runs the content/link checks; commit the changed source and generated website together. The homepage, full reading view and chapter pages all update from this one source at build time. Set `ATLAS_PYTHON` if the Python executable has a different name or location.

Keep BP and section IDs stable when revising entries so incoming links and remembered branches continue to work.
