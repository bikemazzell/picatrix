# Picatrix Lunar Almanac

An offline lunar almanac. For any date it shows the Moon's phase, zodiacal sign, void-of-course periods, the 28 lunar mansions, and Mercury retrograde stations, each with lore adapted from the Picatrix, the 11th-century Arabic astrological treatise.

The app is a progressive web app: install it from the browser, and after the first load it works fully offline. All computation happens in the browser with [astronomy-engine](https://github.com/cosinekitty/astronomy); no network requests leave the page after the first visit.

## Run

```
npm install
npm run dev
```

`npm run build` produces the production build in `dist/`; `npm run preview` serves it.

## Test

```
make quality
```

runs typecheck, lint, the test suite, the build, and a check that the service worker precaches `index.html` and every hashed chunk.

The reference check compares app output against Skyfield-computed fixtures. The default quality run covers years 1950, 2000, 2026, and 2050. To set it up, create the venv and fetch the ephemeris:

```
python3 -m venv tools/reference/.venv
tools/reference/.venv/bin/pip install -r tools/reference/requirements.txt
```

Place `de440s.bsp` in `tools/reference/` (see `tools/reference/generate.py`), then regenerate fixtures with that script. With all fixture years present, run the full comparison:

```
npm run test:reference
```

## Texts

The mansion, sign, phase, void-of-course, and Mercury texts in `content/` are original paraphrases adapted from the Attrell and Porreca (2020) English translation of the Picatrix, cited by book and chapter. They condense and rephrase the source; they are not quotations.

Where an idea is post-Picatrix in origin, the text says so rather than attributing it to the treatise.

## reference/

The `reference/` directory holds copyrighted PDFs used during development. It is git-ignored and never distributed with this repository.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `make quality` and publishes `dist/` to GitHub Pages.
