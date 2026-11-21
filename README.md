# Picatrix Lunar Almanac

**Try it here: [bikemazzell.github.io/picatrix](https://bikemazzell.github.io/picatrix/)**

A lunar almanac in your browser. It recreates the spirit of the old iLuna app: open it and see what the Moon is doing right now, then browse any date between 1900 and 2100 in any time zone. Alongside the astronomy, every item carries lore from the *Picatrix*, the 11th-century Arabic treatise on astral magic.

## What it shows

- **Moon phase** - waxing or waning, the exact quarter events, and how full it is right now
- **Zodiacal sign** - which sign the Moon occupies and when it changes
- **Void of course** - periods when the Moon makes no aspect before leaving her sign, a classic electional no-go window
- **The 28 lunar mansions** - the Moon's position in the traditional mansion cycle, the feature iLuna was known for
- **Mercury retrograde** - the full shadow cycle: pre-shadow, station, retrograde, and exit

Each card, row, and calendar cell opens a description grounded in the *Picatrix*: what the mansion is good for and not good for, its talisman lore, what the treatise says about the Moon in each sign, and how it grades the aspects.

## Using it

Three views: **Now** (cards for the current moment, with previous and next stepping), **Day** (every event of a local day), and **Month** (a calendar grid with a per-day strip showing sign elements and void windows).

Settings offer a time zone picker, 12/24-hour clock, text size, dark theme, and toggles for each feature. Only the time zone setting matters for the sky itself: the app never asks for or uses your location.

It is an installable progressive web app. On a phone, choose "Add to Home Screen" from the browser menu. After the first load it runs fully offline, on a plane or anywhere else.

## The texts

The lore in `content/` is original paraphrase, adapted from the Attrell and Porreca (2020) English translation of the *Picatrix* and cited by book and chapter. It condenses and rephrases; it is not quotation. Where an idea is younger than the treatise (the void-of-course label itself, or the outer planets), the text says so instead of putting words in Picatrix's mouth.

The app's inspiration is iLuna by Alexander Kolesnikov, which is no longer available. None of its code or text is used here.

## For the technically curious

There is no server and no star database. After the first load the app makes zero network requests: every position, ingress, aspect, and station is computed in your browser by [astronomy-engine](https://github.com/cosinekitty/astronomy), a compact MIT-licensed implementation of standard analytical theories (VSOP87 for the planets, a truncated lunar theory for the Moon), reduced to apparent geocentric positions in the ecliptic of date.

Mansions are computed the traditional way: 28 equal slices of 360 degrees, mansion 1 starting at 0 Aries. Void of course uses the five classical aspects (conjunction, sextile, square, trine, opposition) against all nine planets beyond the Moon.

Accuracy is not taken on faith. During development, the app's output was compared event-by-event against reference fixtures generated from JPL's DE440s numerical ephemeris (via Skyfield), the gold standard for planetary positions:

- Moon phases, sign and mansion ingresses, and aspects agree with DE440s to within **47 seconds** over 1950-2050 (the design promise is one minute)
- Mercury stations agree within **10 minutes**, which matters near a station where Mercury's motion is nearly flat
- Void-of-course periods match the published Lunarium tables for 2025-2027 exactly, 481 of 481 periods

## Hacking on it

```
npm install
npm run dev
```

`make quality` runs typecheck, lint, the full test suite (171 tests), the production build, and a service-worker precache check.

The DE440s comparison can be re-run locally. Create the venv and fetch the ephemeris:

```
python3 -m venv tools/reference/.venv
tools/reference/.venv/bin/pip install -r tools/reference/requirements.txt
```

Place `de440s.bsp` in `tools/reference/` (see `tools/reference/generate.py`), regenerate the fixtures, then run `npm run test:reference` for all 105 fixture years.

## reference/

The `reference/` directory holds copyrighted PDF editions used during development. It is git-ignored and never distributed with this repository.
