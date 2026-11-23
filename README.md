# Chroniva

An interactive Evolutionary Learning Atlas with an expandable chronological hierarchy, universal search, linked BP navigation, remembered open branches, and dark mode.

The existing BP colors, exam-priority underlines, hyperlinks, period context, functional sets, and clinical notes are preserved. This repository is an independent copy; editing it does not update either GPT Site.

## Files

- `docs/`: the complete, already-built website, ready for GitHub Pages.
- `src/`: the interactive interface and styles.
- `content/atlas.html`: this version's editable Atlas content.
- `scripts/extract.py`: derives the hierarchy and search index and checks content preservation.
- `docs/THIRD_PARTY_LICENSES.txt`: licenses for the bundled interface libraries.

## Publish later

GitHub Pages has not been enabled as part of this upload.

When ready, open this repository's **Settings → Pages**, choose **Deploy from a branch**, then select **main** and **/docs** and save. GitHub Pages availability depends on your repository visibility and GitHub plan; make the repository public at that time if your plan requires it.

The expected Pages address after publication is `https://bkao12.github.io/Chroniva/`. All website assets use relative paths so the repository prefix is supported.

## Update content or interface

The prebuilt `docs/` website can be published without installing build tools. To rebuild after edits, use Node.js 24+ and Python 3:

```sh
npm ci
python3 -m pip install -r requirements.txt
npm run build
```

Edit `content/atlas.html` for Atlas content, or `src/` for interface changes. The build regenerates `docs/`; commit the changed source and generated website together. Set `ATLAS_PYTHON` if the Python executable has a different name or location.

Keep BP and section IDs stable when revising entries so incoming links and remembered branches continue to work.
