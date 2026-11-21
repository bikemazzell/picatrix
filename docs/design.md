# Lunar calendar web app: design

Date: 2026-11-20. Status: draft for the user's approval.
Research: `research/NOTES.md`, `research/lunarium-site/`, `research/screenshots/`.

## Intent

iLuna was a phone app by Alexander Kolesnikov (lunarium.co.uk). It showed the Moon's phase, sign, void-of-course periods, lunar mansion, and Mercury retrograde cycle for any date, each with a short meaning. The App Store and Google Play pages are gone (HTTP 404, checked 2026-11-20). The user still uses it on an old iPhone and wants it back for everyone.

This project recreates the functions of iLuna as a free, open-source web app on GitHub. The name is "Picatrix Lunar Almanac". Description texts are original prose adapted (paraphrased, not quoted) from Picatrix, the medieval Ghāyat al-Ḥakīm, using the translations held in `reference/Picatrix/` (primarily Attrell and Porreca 2020). Every text cites the book and chapter it was adapted from.

## Goals

- Show for any moment: Moon phase, Moon sign, void-of-course status, lunar mansion, and Mercury retrograde state.
- Three views: Now, Day, Month, with free movement to the previous and next item, day, or month.
- A description for every item, from content files that the user edits.
- Correct times for any IANA time zone, for example America/New_York. Default is the device time zone.
- Runs on a phone browser, installs to the home screen, works offline after the first visit.
- No server, no account, no tracking.

## Non-goals

- A copy of the iLuna look, layout, fonts, or texts.
- Verbatim quotation of the copyrighted Picatrix translations in shipped content. Content files hold original paraphrase, cited by book and chapter.
- Native iOS or Android apps.
- Push notifications. A web page on iOS can send them only through a server. A calendar feed replaces them (see Later).

## Anti-goals

- Times that disagree with professional software by more than one minute. The app is used to plan around void-of-course periods, so a wrong time makes it useless.
- Any network call after load, including analytics, fonts, or CDNs.

## Constraints

- Shell zsh, Linux. Every dependency passes the telemetry check in the user's global instructions before it enters the project.
- License: open source. MIT unless a dependency forces otherwise.
- Date range: 1900 to 2100.

## Calculation rules

All positions are geocentric and tropical. Only the time zone affects the output. Latitude and longitude do not.

- Phase. Four events: New Moon (Moon minus Sun longitude = 0°), First Quarter (90°), Full Moon (180°), Last Quarter (270°). "Waxing" from New Moon to Full Moon, "Waning" from Full Moon to New Moon. The glyph shows the illuminated fraction and which side is lit.
- Sign. The twelve 30° signs from 0° Aries. An ingress is the moment the Moon's longitude crosses a multiple of 30°.
- Mansion. 28 equal parts of 12°51'26" from 0° Aries. Mansion 1 starts with Aries. The Month view shows the mansion in effect at 23:59 local time.
- Void of course. From the Moon's last exact major aspect to a planet while in its current sign, until the Moon's next sign ingress. Aspects: conjunction, sextile, square, trine, opposition. The planet set is not stated in the sources. Start with Sun to Saturn plus Uranus, Neptune and Pluto, then fix the set by the Lunarium tables (see Accuracy tests). The app records the last aspect and planet with each period.
- Mercury. Three states and none:
  - "approaching" (pre-shadow): from the moment Mercury first reaches the longitude where it will later station direct, until it stations retrograde.
  - "retrograde": from station retrograde to station direct.
  - "leaving" (post-shadow): from station direct until Mercury returns to the longitude of the station retrograde.
  The "next" date is the start of the next pre-shadow. UNVERIFIED that iLuna defined "next" this way. The test against the screenshot (next 2027-01-25) settles it.

## Accuracy tests

The tests check two separate things: the position math and the void-of-course definition.

Position math (decides approach 1 against approach 2):
- The reference is the JPL DE440 ephemeris, read through Skyfield (MIT license, Python). A development script computes reference times for sign ingresses, mansion starts, phase events, Mercury stations, and every exact Moon aspect. The script writes them to a JSON fixture, which the repository holds. (Builder's call: JPL data is public domain, so the fixture is safe to publish.)
- Years checked: 1950 to 2050 in full, plus sample years out to 1900 and 2100.
- Pass: every Moon event (phase, sign ingress, mansion start, exact aspect, void period edge) within one minute of the reference from 1950 to 2050. Mercury stations within ten minutes: the planet is nearly stationary there, so a small model difference moves the zero of its speed by minutes. Outside 1950 to 2050 the app still works but makes no one-minute promise, because the future difference between atomic time and Earth's rotation is not known to the minute.
- If approach 1 fails this test, the project switches to approach 2 before it builds any screens.

Void-of-course definition (decides the planet set, never the engine):
- The reference is Lunarium's tables at `https://lunarium.co.uk/calendars/void-of-course/<year>/` for 2025 to 2027, in London time. These are only for local checks. They stay git-ignored and are not published. (Builder's call: the tables are someone else's compilation.)
- The builder tries candidate planet sets and picks the one with the most matches. Pass: at least 99% of periods match within one minute, and each mismatch has a written cause. The 99% line is a gate: below it on every candidate set, the builder stops and shows the causes to the user before any screen work, rather than shipping a silently different definition.
- The user's screenshots give extra checks, in America/New_York time:
  - Aries ingress 2026-11-20 12:51 AM, mansion 2 at 11:46 PM.
  - Void of course 2026-11-22 2:38 to 5:09 AM, after a trine to Mars. Mansion 4 at 7:24 PM.
  - Full Moon 2026-11-24 9:53 AM.
  - Mercury leaves the shadow 2026-11-30. Next: 2027-01-25.

## Approaches

1. Compute in the browser with Astronomy Engine (MIT, pure JavaScript, no dependencies). The library states about one arcminute of accuracy. The app is static files and covers any year. Risk: a time can be off by a minute or two.
2. Compute event tables ahead of time with Skyfield and JPL DE440, or Swiss Ephemeris, and ship them as JSON. Minute-exact, but needs a separate build step and a fixed year range. Skyfield avoids the AGPL code of Swiss Ephemeris.
3. Swiss Ephemeris compiled to WebAssembly in the browser. Exact and any date, but a download of several megabytes and the most setup. Dropped.

Chosen: approach 1, with approach 2 as the fallback. The user confirmed approach 1 on 2026-11-20 because it runs fully offline. The first build step measures approach 1 against the JPL reference (see Accuracy tests). The engine sits behind one module interface, so the switch does not touch the views.

## Architecture

- TypeScript, built with Vite. UI with Preact (about 4 KB). Tests with Vitest. Hosted on GitHub Pages.
- `src/astro/`: pure functions. Input: a UTC time range. Output: lists of events (phase events, ingresses, mansion starts, void periods with last aspect, Mercury stations and shadow limits). No knowledge of time zones or the UI.
- `src/calendar/`: turns events into what a view needs for a local day or month in a given time zone.
- `src/views/`: Now, Day, Month, Settings, About. Description sheet as an overlay.
- `content/`: one Markdown file per item. Items: 12 signs, 4 phase events, waxing, waning, a general void-of-course text, one last-aspect text per aspect and planet, 28 mansions, and the Mercury states. Front matter holds the title and the Picatrix source (book and chapter). Mansion files have the body sections `## Essence`, `## Good For`, `## Not Good For`, `## Talisman`. The texts are adapted paraphrases of Picatrix: mansions from Book I chapter 4 (works of the Moon in the mansions) and Book IV chapter 9 (talisman images), Moon doctrine and phases from Book II chapter 3, signs from Book IV chapter 2, void-of-course last-aspect texts composed from the aspect and planet doctrines. Mansion names use the Greer and Warnock spellings (the set iLuna used).
- Settings in `localStorage`: time zone, 12 or 24 hour clock, text size, which features show, light or dark theme.
- A service worker caches the app for offline use. A web app manifest allows install.

## Views (functions only, the layout is open)

- Now: one card per enabled feature. Each card shows the current state and its end time, or the time of the next event. The void card shows the coming period, or that the Moon is void now with its last aspect. Step to the previous or next event per card. A "back to now" control.
- Day: a date header, then each feature's state for that local day with change times ("Pisces until 00:51, Aries after"). Step to the previous or next day. A date picker.
- Month: a grid of days. Each day shows the mansion at 23:59, phase events, sign ingresses, and Mercury retrograde days. A strip shows the element color of the sign and the void-of-course time. Tap a day to open Day.
- Description: tap any item to read its text.
- Settings and About.

## Later (not in the first release)

- Calendar feed: a static `.ics` file per year with void-of-course periods and other events, built from the same engine and served from GitHub Pages. Calendar apps subscribe to it and send their own alerts.
- Lunar days (need location for moonrise), planetary hours, other languages.

## Left to the builder

Layout, colors, fonts, glyph drawing, folder names under `src/`, and the exact step and swipe gestures.

## Open items for the user

None open. Decided: the app's name is "Picatrix Lunar Almanac"; the texts are paraphrases adapted from Picatrix; the repository is created with `gh` and pushed at the end.
