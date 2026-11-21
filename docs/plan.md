# Lunar Calendar Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, offline web app that shows the Moon's phase, sign, void-of-course periods, lunar mansion and Mercury retrograde state for any date and time zone, with Now, Day and Month views and a description for every item, where every description is original prose adapted from Picatrix (Ghāyat al-Ḥakīm) and cited by book and chapter.

**Architecture:** Pure astronomy functions in `src/astro/` (Astronomy Engine, UTC in, event lists out). A calendar layer in `src/calendar/` turns events into local-day and local-month summaries for an IANA time zone, with `Intl` only. Preact views in `src/views/` render those summaries. Description texts are Markdown files in `content/`. A Python script with Skyfield and JPL DE440s produces reference times that gate the engine's accuracy.

**Tech Stack:** TypeScript, Vite, Preact, Vitest, @testing-library/preact, jsdom, ESLint with typescript-eslint, vite-plugin-pwa, Astronomy Engine 2.1.19 (MIT). Reference tooling: Python 3.12 venv with Skyfield and `de440s.bsp`.

**Spec:** `docs/design.md`. Research: `research/NOTES.md`.

## Global Constraints

- Every dependency (npm or pip) passes the telemetry gate before it enters the project: scan for analytics or crash SDKs, hard-coded collector URLs, socket imports, opt-out variables. On any hit, stop and tell the user with a message that starts "TELEMETRY ALERT:".
- No network call after load: no CDN, no web fonts from a remote host, no analytics.
- License MIT.
- Supported date range 1900-01-01 to 2100-12-31. One-minute accuracy for Moon events (phase, sign, mansion, aspect, void edges) and ten-minute accuracy for Mercury stations, promised for 1950 to 2050.
- All positions geocentric, apparent, tropical, ecliptic of date.
- Mansion width 360/28 degrees, mansion 1 starts at 0° Aries.
- Void-of-course aspects: 0, 60, 90, 120, 180 degrees.
- Python tools run in a dedicated venv at `tools/reference/.venv`. Never install into the shared conda env.
- `research/` is git-ignored (it holds Lunarium pages and the user's screenshots). `reference/` is git-ignored (it holds copyrighted Picatrix translation PDFs). `local/` is git-ignored (Lunarium tables).
- Documents go directly in `docs/`. No nested folders under `docs/`.
- `make quality` (typecheck, lint, tests, build) passes with zero failures before each commit.
- No code comments unless the code is obscure. No emojis.

## Review Focus

1. Days with a DST change (America/New_York 2026-03-08 has 23 hours, 2026-11-01 has 25 hours). The Day view lists every event of that local day once, and the Month strip still spans the full day.
2. Time zones far from UTC or with half-hour offsets (Pacific/Auckland, Asia/Kolkata). An event belongs to the local date of its local time, not its UTC date.
3. A void period that starts on one day or month and ends on the next. Both days show it, with "until" on the second day and "from" on the first.
4. A sign in which the Moon makes no aspect at all. The void period then starts at the previous ingress and covers the whole sign.
5. `localStorage` that throws (private mode). The app still renders with default settings.

Each item has a test in the task that owns the code (Tasks 5, 6, 10).

---

### Task 1: Project scaffold and quality gate

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `Makefile`, `.gitignore`, `LICENSE`, `index.html`, `src/main.tsx`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `make quality` runs `tsc --noEmit`, `eslint .`, `vitest run`, `vite build`. `npm test` runs `vitest run`.

- [x] **Step 1:** `git init` in `/home/v/Documents/Dev/picatrix`. Write `.gitignore` with `node_modules/`, `dist/`, `reference/`, `research/`, `reviews/`, `local/`, `tools/reference/.venv/`, `tools/reference/*.bsp`. Make sure that `git status` does not list `reference/`, `research/` or `reviews/`.
- [x] **Step 2:** Check the latest stable versions of vite, preact, @preact/preset-vite, typescript, vitest, jsdom, @testing-library/preact, eslint, typescript-eslint, vite-plugin-pwa with `npm view <pkg> version`. Run the telemetry gate on each, plus `astronomy-engine@2.1.19`: after `npm install --ignore-scripts`, run `grep -rniE 'telemetry|analytics|sentry|posthog|segment\.io|mixpanel|amplitude|https?://[a-z0-9.-]+/(collect|track|v1/events)' node_modules/<pkg>` for each direct dependency and read every hit. Record the result in the commit message.
- [x] **Step 3:** Write `tests/smoke.test.ts` that imports `astronomy-engine` and asserts `typeof Astronomy.MoonPhase === 'function'`. Run `npm test`. Expected: PASS.
- [x] **Step 4:** Write the `Makefile` target `quality`. Run `make quality`. Expected: zero errors and a `dist/` folder.
- [x] **Step 5:** Commit: `chore: scaffold Vite, Preact, Vitest, ESLint, quality gate`.

### Task 2: Reference generator (Skyfield, JPL DE440s)

**Files:**
- Create: `tools/reference/requirements.txt`, `tools/reference/generate.py`, `tests/fixtures/reference/<year>.json` (generated)

**Interfaces:**
- Produces: one JSON file per year, an object `{ "coverage": { "start": iso, "end": iso, "kinds": [...] }, "events": [[kind, code, unixSeconds], ...] }`. The coverage block separates "this kind was not computed for this year" from "zero events", which matters when aspect years are thinned.
  - `kind` is one of `"phase"` (code 0 to 3 = New, First Quarter, Full, Last Quarter), `"sign"` (code 0 to 11 = sign entered), `"mansion"` (code 1 to 28 = mansion entered), `"aspect"` (code `"<planet>-<angle>"`, for example `"Mars-120"`, the Moon's exact aspect, angle in {0, 60, 90, 120, 180}), `"mercury"` (code `"R"` station retrograde, `"D"` station direct).
  - Moon aspects cover Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto. An aspect of angle A is the moment the Moon-minus-planet longitude difference equals A or 360-A.

- [x] **Step 1:** Create the venv with `python3 -m venv tools/reference/.venv`. Check the latest `skyfield` version with `tools/reference/.venv/bin/pip index versions skyfield`, pin it in `requirements.txt`, and run the telemetry gate on it and its dependencies (`jplephem`, `sgp4`, `numpy`, `certifi`) before `pip install`. Download `de440s.bsp` (covers 1849 to 2150) to `tools/reference/`.
- [x] **Step 2:** Write `generate.py` with `main(start_year: int, end_year: int, out_dir: Path)` and a `--selfcheck` mode. Use apparent geocentric positions in the true ecliptic of date (`earth.at(t).observe(body).apparent().frame_latlon(ecliptic_frame)`), and `skyfield.searchlib.find_discrete` with a step of 0.25 days for Moon events and 1 day for Mercury stations. Each discrete predicate is a named pure function of the position (which sign, which mansion, which aspect sector); predicates that consume a longitude difference unwrap the 360-to-0 wrap first, and a predicate may not change value between samples unless the underlying angle crossed a boundary (a 359.9 to 0.1 jump is no change of sign). Times out in UTC seconds, rounded to the second.
- [x] **Step 3:** Run `python generate.py --selfcheck`: over a 2-day window in 2026 it re-scans every kind by brute force at 1-minute steps and exits nonzero if any event is missing or extra compared with `find_discrete`. Then run `python generate.py 2026 2026`. Check by hand in `2026.json`: a `["sign", 0, ...]` row at 2026-11-20 05:51 UTC (±1 min), `["mansion", 2, ...]` at 2026-11-21 04:46 UTC, `["sign", 1, ...]` at 2026-11-22 10:09 UTC, `["aspect", "Mars-120", ...]` at 2026-11-22 07:38 UTC, `["phase", 2, ...]` at 2026-11-24 14:53 UTC. These come from the user's screenshots and the Lunarium table.
- [x] **Step 4:** Generate 1950 to 2050 in full, plus 1900, 1925, 2075 and 2100. Report the total fixture size. If it exceeds 15 MB, keep 1950 to 2050 in full only for sign, mansion, phase and Mercury, and keep aspects for every fifth year. Say which one in the commit message.
- [x] **Step 5:** Commit: `test: add JPL DE440 reference event fixtures`.

### Task 3: Astronomy engine and the accuracy gate

**Files:**
- Create: `src/astro/types.ts`, `src/astro/longitude.ts`, `src/astro/search.ts`, `src/astro/events.ts`, `src/astro/index.ts`
- Test: `tests/astro/search.test.ts`, `tests/astro/events.test.ts`, `tests/astro/reference.test.ts`

**Interfaces:**
- Produces (from `src/astro/index.ts`):
  - `type Planet = 'Sun'|'Mercury'|'Venus'|'Mars'|'Jupiter'|'Saturn'|'Uranus'|'Neptune'|'Pluto'`
  - `type AspectAngle = 0|60|90|120|180`
  - `interface PhaseEvent { quarter: 0|1|2|3; time: Date }`
  - `interface SignIngress { sign: number; time: Date }` (sign 0 to 11, 0 = Aries)
  - `interface MansionIngress { mansion: number; time: Date }` (1 to 28)
  - `interface MoonAspect { planet: Planet; angle: AspectAngle; time: Date }`
  - `moonLongitude(t: Date): number`, `planetLongitude(p: Planet, t: Date): number` (degrees, 0 to 360)
  - `phaseEvents(start: Date, end: Date): PhaseEvent[]`
  - `signIngresses(start: Date, end: Date): SignIngress[]`
  - `mansionIngresses(start: Date, end: Date): MansionIngress[]`
  - `moonAspects(start: Date, end: Date, planets: readonly Planet[]): MoonAspect[]`
  - `illumination(t: Date): { fraction: number; waxing: boolean }`
  All lists sorted by time, events inside `[start, end)`.

- [x] **Step 1:** Write `tests/astro/search.test.ts` with synthetic functions: a difference that crosses the 360-to-0 wrap and still hits its target; a root exactly on a sample point; a root exactly at `start` (kept) and at `end` (dropped, the interval is half-open); two crossings inside one sampling interval (the smaller step must find both). Write `tests/astro/events.test.ts` with the fixture values (UTC): `signIngresses` over 2026-11-19..2026-11-23 returns Aries at 2026-11-20T05:52:14 and Taurus at 2026-11-22T10:09:42; `mansionIngresses` contains mansion 2 at 2026-11-21T04:46:54 and mansion 4 at 2026-11-23T00:25:14; `phaseEvents` contains quarter 2 at 2026-11-24T14:53:34; `moonAspects(..., ['Mars'])` contains angle 120 at 2026-11-22T07:38:36. These are the DE440 fixture times; the iLuna screenshot model runs about a minute early at the Aries ingress. Each check allows ±60 s.
- [x] **Step 2:** Run `npx vitest run tests/astro/events.test.ts`. Expected: FAIL, module not found.
- [x] **Step 3:** Implement. Longitudes: `Astronomy.EclipticGeoMoon(t).lon` for the Moon. For planets, `Astronomy.Ecliptic(Astronomy.GeoVector(body, t, true)).elon` (true ecliptic of date, with aberration). `search.ts` holds `findAngleCrossings(fn: (t: Date) => number, target: number, start: Date, end: Date, stepHours: number): Date[]`. Angular differences are signed and normalized to (-180, 180], so the 360-to-0 wrap needs no special case and each aspect is a single target (0 and 360 are the same angle; crossings are deduplicated). It samples the normalized difference minus target at each step, and on a sign change it refines with `Astronomy.Search` to 1 second. Roots equal to `start` count; roots equal to `end` do not: the interval is [start, end). Phases use the same apparent-longitude crossing search on the Moon-Sun elongation (Astronomy Engine's `SearchMoonQuarter` disables aberration, which costs about a minute of accuracy near 1950 and 2050). Signs use target k·30, mansions k·360/28, aspects the five targets on the absolute Moon-minus-planet difference. Step 6 hours for ingresses and mansions, 3 hours for aspects.
- [x] **Step 4:** Run the test. Expected: PASS.
- [x] **Step 5:** Write `tests/astro/reference.test.ts`. For each fixture year it computes the same events and asserts: the same count per kind, and every time within 60 s of the reference (1950 to 2050) or 300 s (other years). Kinds checked here: phase, sign, mansion, aspect. Mercury stations are not implemented yet; Task 4 adds them to this test. On failure it prints the year, kind, code, and error in seconds. Add `npm run test:reference` that runs it with `REFERENCE_YEARS=all`. By default (`make quality`) it runs years 1950, 2000, 2026, 2050 only.
- [x] **Step 6:** Run `npm run test:reference`. Report the largest error per kind to the user.
  - If every event in 1950 to 2050 is within 60 s: continue.
  - If not: STOP. Do not build screens. Tell the user the numbers. The design then switches to approach 2 (precomputed tables), which needs a new plan for this engine module.
- [x] **Step 7:** Commit: `feat(astro): Moon events with Astronomy Engine, checked against DE440`.

### Task 4: Void of course and Mercury cycle

**Files:**
- Create: `src/astro/void.ts`, `src/astro/mercury.ts`. Modify: `src/astro/index.ts`, `src/astro/types.ts`
- Test: `tests/astro/void.test.ts`, `tests/astro/mercury.test.ts`

**Interfaces:**
- Consumes: Task 3 functions.
- Produces:
  - `const VOID_PLANETS: readonly Planet[]` (initially all nine. Task 5 may change it)
  - `interface VoidPeriod { start: Date; end: Date; sign: number; lastAspect: MoonAspect | null }` (`sign` is the sign the Moon is leaving; `lastAspect` null when the Moon made no aspect in that sign)
  - `voidPeriods(start: Date, end: Date, planets?: readonly Planet[]): VoidPeriod[]` returns every period that overlaps `[start, end)`, unclipped.
  - `interface MercuryCycle { preShadowStart: Date; stationRetro: Date; stationDirect: Date; postShadowEnd: Date }`
  - `mercuryCycles(start: Date, end: Date): MercuryCycle[]` returns every cycle that overlaps `[start, end)`.
  - `type MercuryState = 'approaching'|'retrograde'|'leaving'|'none'`
  - `mercuryStateAt(t: Date): { state: MercuryState; until: Date | null; next: Date }` (`until` ends the current state, `next` is the next `preShadowStart` after `t`)

- [x] **Step 1:** Write `tests/astro/void.test.ts`: the period that ends 2026-11-22T10:09:42Z starts at 07:38:36Z with `lastAspect` `{planet: 'Mars', angle: 120}`. The period that ends 2026-11-20T05:52:14Z starts at 01:46:10Z with `lastAspect` `{planet: 'Sun', angle: 120}`. Add Review Focus 4: find a sign with no aspect by scanning 1950 to 2050 with `planets = ['Saturn']`, and assert that its period starts at the previous ingress with `lastAspect === null`. Also: a query range wholly inside one void period returns that period unclipped; a period crossing a month boundary is returned by queries on both months; a period starting exactly at the query `start` is returned.
- [x] **Step 2:** Write `tests/astro/mercury.test.ts`: `mercuryStateAt(2026-11-20T15:28Z)` returns `state 'leaving'`, `until` on local date 2026-11-30 in America/New_York, and `next` on 2027-01-25. If `next` does not match, try "next = next station retrograde" and report which definition matches. Do not adjust the test to the code. Also: `mercuryCycles` for 2026 has the November cycle with `stationRetro` before `stationDirect` and the four bounds in order, and at least one other cycle in the year, proving both station directions are found.
- [x] **Step 3:** Run both. Expected: FAIL.
- [x] **Step 4:** Implement. Void: collect the sign ingresses from the last ingress at or before `start` to the first ingress at or after `end`, searching backward and forward until found rather than assuming a fixed margin. For each ingress I with previous ingress P, take the last Moon aspect in [P, I). The period runs from that aspect, or from P when there is none, to I. Keep the periods that overlap [start, end), unclipped. Mercury: stations are the zeros of Mercury's apparent longitude speed. The speed function uses the central difference of unwrapped longitude (deltas beyond 180 in either direction are corrected by 360), so it is continuous through the wrap. `Astronomy.Search` finds only ascending crossings, so search both the speed function and its negation: the descending crossing of speed is the ascending crossing of its negation. Pre-shadow start: the last time before the station retrograde that Mercury's longitude equals the longitude at the station direct. Post-shadow end: the first time after the station direct that it equals the longitude at the station retrograde.
- [x] **Step 5:** Run both. Expected: PASS. Extend `tests/astro/reference.test.ts` to check Mercury stations within 10 minutes: near a station Mercury's speed is close to zero, so the small model difference between Astronomy Engine and DE440 moves the station by minutes rather than seconds. The one-minute promise in the design covers Moon events only, and the design says so.
- [x] **Step 6:** Commit: `feat(astro): void-of-course periods and Mercury shadow cycle`.

### Task 5: Time zone helpers and the Lunarium planet-set check

**Files:**
- Create: `src/calendar/tz.ts`, `tools/lunarium/fetch.ts`, `tools/lunarium/fit.ts`, `docs/voc-check.md`
- Test: `tests/calendar/tz.test.ts`, `tests/astro/voc-lunarium.test.ts`

**Interfaces:**
- Produces (`src/calendar/tz.ts`):
  - `interface LocalDate { y: number; m: number; d: number }` (m 1 to 12)
  - `interface LocalTime extends LocalDate { h: number; min: number; weekday: number }` (weekday 1 = Monday to 7)
  - `toLocal(t: Date, tz: string): LocalTime`
  - `dayBounds(date: LocalDate, tz: string): { start: Date; end: Date }` (local midnight to next local midnight)
  - `fromLocal(date: LocalDate, h: number, min: number, tz: string): Date`
  - `addDays(date: LocalDate, n: number): LocalDate`
  - `isValidTimeZone(tz: string): boolean`

- [x] **Step 1:** Write `tests/calendar/tz.test.ts`: `dayBounds({2026,3,8}, 'America/New_York')` spans 23 hours; `{2026,11,1}` spans 25 hours; `toLocal(2026-11-20T05:51Z, 'America/New_York')` gives 2026-11-20 00:51; `toLocal(2026-11-20T11:00Z, 'Pacific/Auckland')` gives 2026-11-21; `dayBounds` for Asia/Kolkata starts at 18:30Z of the previous UTC day. These cover Review Focus 1 and 2.
- [x] **Step 2:** Run it. Expected: FAIL. Implement with `Intl.DateTimeFormat(..., { timeZone, hourCycle: 'h23' }).formatToParts`. `fromLocal` guesses the offset, then corrects once, with a fixed policy for clock changes: a local time that occurs twice (fall-back) maps to the earlier occurrence; a local time that never occurs (spring-forward gap) follows the standard single-gap convention (java.time): shift the wall time forward by the gap length and read it with the pre-gap offset, so 02:30 on a 1-hour gap day in New York is 07:30Z, which is 03:30 after the jump. `dayBounds` on a day whose local midnight is skipped returns the jump instant as the day's start. Add tests: `fromLocal({2026,11,1}, 1, 30, 'America/New_York')` is 05:30Z (earlier occurrence); `fromLocal({2026,3,8}, 2, 30, 'America/New_York')` is 07:30Z (nonexistent time, single-gap shifted); a `dayBounds` case for a zone that skips midnight, pinned after checking `Intl` for the exact date (America/Havana 2026-03-08, day starts at the jump instant 05:00Z). Run it again. Expected: PASS.
- [x] **Step 3:** Write `tools/lunarium/fetch.ts` (run with `npx tsx`, add `tsx` as a dev dependency after the telemetry gate). It downloads `https://lunarium.co.uk/calendars/void-of-course/<year>/` for 2025, 2026, 2027 into `local/lunarium/<year>.html`, parses each "Begins / Ends" pair as Europe/London local time with `fromLocal`, and writes `local/lunarium/<year>.json` as `[{start, end}]` in ISO UTC. Expected: 2026 contains `{start: 2026-11-22T07:38Z, end: 2026-11-22T10:09Z}`.
- [x] **Step 4:** Write `tools/lunarium/fit.ts`. Candidates, explicit arrays: `[Sun, Mercury, Venus, Mars, Jupiter, Saturn]`, that set plus Uranus, plus Uranus and Neptune, and all nine through Pluto. The Moon is never a candidate: it is the body whose aspects are searched. A generated period matches a reference period by one-to-one pairing (sort both sides by time, greedily pair the nearest within 120 s on both start and end — user decision 2026-11-20; at 60 s Lunarium's floored-minute display plus its ~80 s-fast engine cap every set below 91%, and the 120 s gate still separates the sets via the 79.6% and 90.0% ceilings); a reference period left unpaired counts as a miss, and so does an unpaired generated period. A period belongs to the year that contains its start and end. Print a table: matched, unmatched on each side, and the rate.
- [x] **Step 5:** Set `VOID_PLANETS` to the best set. Write `docs/voc-check.md`: the match rate per set, the chosen set, and one line per mismatch with its cause (for example "aspect to Pluto at 23:59 counted by us, not by Lunarium"). Pass: 99% or more. Below 99% on every candidate set: STOP and show the user the causes before any screen work. The test in Step 6 encodes the chosen set's measured rate as a floor, so a later change that lowers it fails. Chosen set: all nine planets, rate 1.0 (user decision 2026-11-20; Uranus and Neptune are structurally required above 90%, and Pluto never changes a match in 2025-2027).
- [x] **Step 6:** Write `tests/astro/voc-lunarium.test.ts`. It re-runs the fit for the pinned `VOID_PLANETS` and asserts the rate stays at or above the floor recorded in the test (the measured value from Step 5, never below 99%) and that the miss list is empty, so a lost table row or a spurious generated period also fails. It uses `describe.skipIf(!existsSync('local/lunarium'))` and prints "Lunarium tables not present, run tools/lunarium/fetch.ts" when it skips, because the tables are not in the public repository.
- [x] **Step 7:** Commit: `feat: time zone helpers; fit void-of-course planet set`.

### Task 6: Day, Now and Month summaries

**Files:**
- Create: `src/calendar/day.ts`, `src/calendar/now.ts`, `src/calendar/month.ts`, `src/calendar/cache.ts`, `src/calendar/types.ts`
- Test: `tests/calendar/day.test.ts`, `tests/calendar/now.test.ts`, `tests/calendar/month.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 4, 5.
- Produces:
  - `type Feature = 'phase'|'sign'|'void'|'mansion'|'mercury'`
  - `type Element = 'fire'|'earth'|'air'|'water'` and `elementOf(sign: number): Element`
  - `interface Span<T> { value: T; from: Date | null; until: Date | null }` (`null` means the span runs past the day's edge)
  - `interface DaySummary { date: LocalDate; phase: { waxing: boolean; event: PhaseEvent | null }; signs: Span<number>[]; voids: VoidPeriod[]; mansions: Span<number>[]; mercury: { state: MercuryState; until: Date | null; next: Date; transitions: { time: Date; to: MercuryState }[] } }` (`transitions` lists every Mercury state change inside the local day, so a day with a station shows it)
  - `daySummary(date: LocalDate, tz: string): DaySummary`
  - `interface NowCard<T> { current: T; since: Date | null; until: Date | null }`
  - `nowSummary(t: Date): { phase: NowCard<{ waxing: boolean; nextEvent: PhaseEvent; illumination: number }>; sign: NowCard<number>; void: { active: VoidPeriod | null; next: VoidPeriod }; mansion: NowCard<number>; mercury: { state: MercuryState; until: Date | null; next: Date } }`
  - `stepEvent(feature: Feature, t: Date, dir: 1 | -1): Date` returns the time of the next or previous change for that feature. The Now view moves its cursor to that time. "Previous" means the boundary that starts the previous distinct state, not the boundary that started the current one: from mid-Aries the answer is the moment Pisces began, because stepping to the Aries ingress would still show Aries. For event features (phase quarters) it is the previous or next event. For void, from an inactive moment it is the end of the last period that ended before `t`, and the start of the next period after `t`. For Mercury `none` it is the end of the last completed cycle, and the next `preShadowStart`.
  - `interface MonthCell { date: LocalDate; inMonth: boolean; mansion: number; phaseEvent: PhaseEvent | null; ingress: SignIngress | null; mercuryRetro: boolean; strip: { from: number; to: number; element: Element; void: boolean }[] }` (`from` and `to` are fractions of the day, 0 to 1; `mercuryRetro` is true when Mercury is retrograde at any instant of the day: retrograde at the day's start, or a station into retrograde during the day)
  - `monthGrid(y: number, m: number, tz: string): MonthCell[]` returns 42 cells, Monday first.
  - `cache.ts`: `eventsFor(start: Date, end: Date)` returns all event lists together with the covered range they were computed for, memoized by UTC month, with 3 days of padding. Mercury cycles are searched 60 days beyond the requested range on both sides so a cycle in progress at either edge is complete; completeness relies on the mercury search's own padding, and nothing widens or clips at the cache level. Requests outside 1900 to 2100 return empty lists, and the views treat that as "no data", not as an error.

- [x] **Step 1:** Write `tests/calendar/day.test.ts` with the screenshots (America/New_York): 2026-11-20 has `signs` Pisces until 00:52 then Aries from 00:52, `mansions` 28 until 00:52, 1 from 00:52, then 2 from 23:46, one void period ending 00:52, `mercury.state 'leaving'`. 2026-11-22: void 02:38 to 05:09, mansions 3 until 19:25 then 4. Review Focus 3: a void period that crosses local midnight appears on both days. Review Focus 1: 2026-11-01 lists each event once. A day with a Mercury station (find one in the 2026 fixtures) lists the transition time in `mercury.transitions`, and the `mercuryRetro` rule from Task 6's MonthCell definition holds on both days the station spans.
- [x] **Step 2:** Write `tests/calendar/month.test.ts`: `monthGrid(2026, 11, 'America/New_York')` has 42 cells. The first cell is 2026-10-26. The cell for Nov 19 has mansion 28 and Nov 20 has mansion 2. Nov 9 has `phaseEvent.quarter === 0`. Nov 24 has quarter 2. Nov 1 to 12 have `mercuryRetro` true (screenshot). Every in-month strip covers 0 to 1 with no gaps.
- [x] **Step 3:** Write `tests/calendar/now.test.ts`: at 2026-11-20T15:28Z the sign card is Aries until 2026-11-22T10:09Z, the void card has `active null` and `next.start` 2026-11-22T07:38Z, the mansion card is 1 until 2026-11-21T04:46Z, the phase card is waxing with next event quarter 2. `stepEvent('sign', t, 1)` returns 2026-11-22T10:09Z; `stepEvent('sign', t, -1)` returns the moment Pisces began, not the Aries ingress. From exactly 2026-11-20T05:52:14Z, `stepEvent('sign', t, -1)` still returns the Pisces ingress and `stepEvent('sign', t, 1)` returns the Taurus ingress.
- [x] **Step 4:** Run all three. Expected: FAIL. Implement. The mansion "at 23:59" in a cell is the mansion in effect at `dayBounds(...).end` minus 1 minute.
- [x] **Step 5:** Run them. Expected: PASS. Add a timing check: `monthGrid` for a new month takes under 200 ms on this machine (`performance.now()` around the call, printed, asserted < 2000 ms to allow for CI and loaded machines; the plan's original 500 ms ceiling flaked 2-in-8 full-suite runs under parallel load with fresh measurements of 189-288 ms).
- [x] **Step 6:** Commit: `feat(calendar): day, now and month summaries per time zone`.

### Task 7: Content files, Picatrix texts and loader

**Files:**
- Create: `src/content/ids.ts`, `src/content/load.ts`, `src/content/names.ts`, `content/**/*.md` (curated), `tools/content/extract.sh`, `tools/content/gen-void.ts`
- Test: `tests/content/content.test.ts`

**Interfaces:**
- Produces:
  - Content ids: `sign/<aries..pisces>`, `phase/<new|first-quarter|full|last-quarter|waxing|waning>`, `void/general`, `void/<angle>-<planet>` (for example `void/120-mars`, one per angle in {0, 60, 90, 120, 180} and planet in `VOID_PLANETS`), `mansion/<01..28>`, `mercury/<approaching|retrograde|leaving|none>`.
  - `allContentIds(): string[]`
  - `interface ContentEntry { id: string; title: string; source: string; body: string; sections?: { essence: string; goodFor: string; notGoodFor: string; talisman: string } }`
  - `getContent(id: string): ContentEntry` (throws on an unknown id)
  - `SIGN_NAMES`, `MANSION_NAMES`, `PLANET_NAMES`, `ASPECT_NAMES` in `names.ts`
- Mansion names, in order: Al-Sharatain, Al-Butain, Al-Thurayya, Al-Dabaran, Al-Haqa, Al-Hana, Al-Dhira, Al-Nathrah, Al-Tarf, Al-Jabhah, Al-Zubrah, Al-Sarfah, Al-Awwa, Al-Simak, Al-Ghafr, Al-Zubana, Al-Iklil, Al-Qalb, Al-Shaulah, Al-Na'am, Al-Baldah, Sa'd al-Dhabih, Sa'd Bula, Sa'd al-Su'ud, Sa'd al-Akhbiyah, Al Fargh al-Awwal, Al Fargh al-Thani, Batn al-Hut.
- File format: front matter of exactly two lines, `title: <value>` and `source: <value>`, split on the first colon; values are single-line and unquoted, and a value containing a colon keeps it. The parser rejects a file whose front matter misses either key or adds a third. Body syntax is a fixed subset: blank-line-separated paragraphs, `- ` bullet lists, and `## ` section headings; nothing else needs rendering. `source:` cites the Picatrix book and chapter adapted, in the form `Picatrix (adapted), <book and chapter>`; more than one chapter may be cited. Mansion files have the body sections `## Essence`, `## Good For`, `## Not Good For`, `## Talisman`.
- Text policy: every body is original paraphrase adapted from the Attrell and Porreca 2020 translation (the only reference PDF with a text layer). No verbatim runs longer than a short phrase; medieval terminology (suffumigation, talisman, mansion names) may be kept. Where the app's idea is younger than Picatrix (the void-of-course label, the outer planets), the text says so in its first sentence and presents the reading as this almanac's extension of Picatrix's doctrine, never as Picatrix's own words.

- [x] **Step 1:** Write `tools/content/extract.sh`: `pdftotext reference/Picatrix/Picatrix_A_Medieval_Treatise_on_Astral_Magic_2020.pdf local/picatrix/attrell.txt`. Run it. Verify the four source chapters are present and note their line ranges for curation: Book I ch. 4 (mansions and their works), Book II ch. 3 (doctrine of the Moon: quarters, waxing and waning, aspects), Book IV ch. 2 (the Moon in each sign), Book IV ch. 9 (mansion talisman images).
- [x] **Step 2:** Write `tests/content/content.test.ts`: every id from `allContentIds()` has a file, and every file under `content/` belongs to an id. Every mansion entry has all four sections and a non-empty `source`. Every non-mansion entry has non-empty body and source. `getContent('mansion/01').title === 'Al-Sharatain'`; `getContent('mansion/28').title === 'Batn al-Hut'`; `getContent('sign/pisces').title === 'Pisces'`; `getContent('nope')` throws. A file whose front matter misses a key or adds a third makes `getContent` throw. No file contains "Text to come" or "placeholder". Every mansion source cites Book I chapter 4 and Book IV chapter 9.
- [x] **Step 3:** Run it. Expected: FAIL (no files). Curate the content files by hand from the extracted text: 12 signs, 6 phase texts, `void/general`, 28 mansions, 4 Mercury texts. Paraphrase, do not quote. Then write `tools/content/gen-void.ts` (run with `npx tsx`) that composes the `void/<angle>-<planet>` files from the curated aspect paragraphs (5) and planet paragraphs (as many as `VOID_PLANETS` holds) held in that script. It imports `VOID_PLANETS` from `src/astro/` as the single source of truth, so the generated set can never drift from the fitted set. Each generated file starts with an HTML comment `<!-- generated by tools/content/gen-void.ts; edit the generator, not this file -->`. Run it, run it again, and check that nothing changed, so regeneration is idempotent.
- [x] **Step 4:** Implement `load.ts` with `import.meta.glob('/content/**/*.md', { query: '?raw', import: 'default', eager: true })` and a 20-line front-matter parser (no dependency). Run the test. Expected: PASS.
- [x] **Step 5:** Commit: `feat(content): Picatrix paraphrase texts, ids, loader`.

### Task 8: Settings store and app shell

**Files:**
- Create: `src/settings.ts`, `src/app.tsx`, `src/views/Nav.tsx`, `src/views/Sheet.tsx`, `src/views/glyphs.tsx`, `src/styles.css`. Modify: `src/main.tsx`
- Test: `tests/settings.test.ts`, `tests/views/sheet.test.tsx`

**Interfaces:**
- Produces:
  - `interface Settings { timeZone: string | null; clock: '12h' | '24h'; textScale: number; features: Record<Feature, boolean>; theme: 'system' | 'light' | 'dark' }` (`timeZone null` means the device time zone)
  - `loadSettings(): Settings`, `saveSettings(s: Settings): void`, `effectiveTimeZone(s: Settings): string`
  - `useSettings(): [Settings, (s: Settings) => void]` (Preact hook)
  - `<Sheet contentId={string} onClose={() => void} />` shows `getContent(contentId)`
  - Glyph components: `<MoonGlyph fraction waxing />`, `<SignGlyph sign />`, `<PlanetGlyph planet />`, `<AspectGlyph angle />`, `<MansionBadge n />`, as inline SVG or Unicode with a bundled font. No remote font.
  - Routes by hash: `#/now`, `#/day/YYYY-MM-DD`, `#/month/YYYY-MM`, `#/settings`, `#/about`.

- [x] **Step 1:** Write `tests/settings.test.ts`: defaults when storage is empty. A round trip. Review Focus 5: with `localStorage.getItem` stubbed to throw, `loadSettings()` returns defaults and `saveSettings` does not throw. An invalid stored time zone falls back to `null`.
- [x] **Step 2:** Write `tests/views/sheet.test.tsx`: rendering `<Sheet contentId="mansion/28" />` shows "Batn al-Hut" and the four section headings (Essence, Good For, Not Good For, Talisman). Pressing Escape calls `onClose`.
- [x] **Step 3:** Run both. Expected: FAIL. Implement. Default `clock` comes from `Intl.DateTimeFormat().resolvedOptions().hourCycle`.
- [x] **Step 4:** Run both. Expected: PASS. Run `npm run dev` and open the page at 400 px width. Expected: the nav bar with Now, Day, Month, Settings, About, and an empty view.
- [x] **Step 5:** Commit: `feat(ui): settings store, routing shell, description sheet, glyphs`.

### Task 9: Now view

**Files:**
- Create: `src/views/Now.tsx`, `src/format.ts`
- Test: `tests/views/now.test.tsx`, `tests/format.test.ts`

**Interfaces:**
- Consumes: `nowSummary`, `stepEvent`, `useSettings`, `<Sheet>`, glyphs.
- Produces: `formatTime(t: Date, tz: string, clock: '12h'|'24h'): string`, `formatDateTime(t, tz, clock): string` (for example "2026-11-22, 5:09 AM" or "2026-11-22, 05:09").

- [x] **Step 1:** Write `tests/format.test.ts`: `formatDateTime(2026-11-22T10:09Z, 'America/New_York', '12h') === '2026-11-22, 5:09 AM'` and with `'24h'`, `'2026-11-22, 05:09'`.
- [x] **Step 2:** Write `tests/views/now.test.tsx` with a fixed clock at 2026-11-20T15:28Z and time zone America/New_York: the page shows "Waxing", "Aries" with "until 2026-11-22, 5:09 AM", a void card in the "later" state with from 2:38 AM and to 5:09 AM, "Al-Sharatain" until 2026-11-20, 11:46 PM, and a Mercury card "leaving". A click on the sign card's next control moves that card to Taurus. A "Now" control resets it. A click on a card body opens the sheet with `sign/aries`. With `features.mansion = false` the mansion card is absent.
- [x] **Step 3:** Run both. Expected: FAIL. Implement. The cards refresh each minute with `setInterval` while the page is visible. Previous and next are buttons (swipe is optional on top).
- [x] **Step 4:** Run both. Expected: PASS.
- [x] **Step 5:** Commit: `feat(ui): Now view`.

### Task 10: Day view

**Files:**
- Create: `src/views/Day.tsx`
- Test: `tests/views/day.test.tsx`

- [x] **Step 1:** Write the test for `#/day/2026-11-20` in America/New_York: sections Phase "Waxing all day", Sign "Pisces until 12:52 AM" and "Aries after 12:52 AM", Void "Until 12:52 AM", Mansion with three rows (Batn al-Hut, Al-Sharatain, Al-Butain), Mercury "leaving" until 2026-11-30. For `#/day/2026-11-22`: Void "2:38 AM – 5:09 AM". Previous and next day buttons change the route. A date input changes the route. Rows open the sheet. Dates before 1900-01-01 or after 2100-12-31 show a message instead of data.
- [x] **Step 2:** Run it. Expected: FAIL. Implement.
- [x] **Step 3:** Run it. Expected: PASS.
- [x] **Step 4:** Commit: `feat(ui): Day view`.

### Task 11: Month view

**Files:**
- Create: `src/views/Month.tsx`
- Test: `tests/views/month.test.tsx`

- [x] **Step 1:** Write the test for `#/month/2026-11` in America/New_York: 42 cells. The cell for Nov 20 shows "2" and is marked as today with a fixed clock on that date. Nov 24 has a full Moon glyph. Nov 20 has an Aries glyph. Nov 1 to 12 have a Mercury mark. A click on Nov 22 goes to `#/day/2026-11-22`. Previous and next month controls change the route. The strip colors come from CSS variables `--fire`, `--earth`, `--air`, `--water`, `--void`.
- [x] **Step 2:** Run it. Expected: FAIL. Implement.
- [x] **Step 3:** Run it. Expected: PASS. Open the dev server at 400 px wide and at desktop width. Expected: the grid fits without sideways scrolling.
- [x] **Step 4:** Commit: `feat(ui): Month view`.

### Task 12: Settings and About views

**Files:**
- Create: `src/views/SettingsView.tsx`, `src/views/About.tsx`
- Test: `tests/views/settings-view.test.tsx`

- [x] **Step 1:** Write the test: the time zone picker lists `Intl.supportedValuesOf('timeZone')` with a search box and a "Use device time zone" choice. Choosing Asia/Kolkata saves it and the Day view then uses it. The clock toggle, the text size control (sets `--text-scale` on the root), the five feature switches, and the theme choice each save. About shows the version, the MIT license, the date range, a note that only the time zone matters, the element color key, a credit to iLuna by Alexander Kolesnikov as the inspiration, and a note that texts are paraphrases adapted from Picatrix (Ghāyat al-Ḥakīm), translated by Dan Attrell and David Porreca (Penn State Press, 2019).
- [x] **Step 2:** Run it. Expected: FAIL. Implement.
- [x] **Step 3:** Run it. Expected: PASS.
- [x] **Step 4:** Commit: `feat(ui): Settings and About views`.

### Task 13: Offline install and deployment

**Files:**
- Modify: `vite.config.ts`, `index.html`. Create: `public/icons/*`, `.github/workflows/deploy.yml`, `README.md`, `tools/check-precache.ts`

- [x] **Step 1:** Configure `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a precache of all built assets and `content/` texts, and a manifest (name "Picatrix Lunar Almanac"; `display: standalone`. Icons 192 and 512 px). Set `base` to the GitHub Pages path.
- [x] **Step 2:** Add `tools/check-precache.ts` (run with `npx tsx` after `vite build`, wired into the Makefile `quality` target after the build): it reads the precache list from `dist/sw.js` and exits nonzero unless it contains the built `index.html` and every hashed chunk. The content texts are inlined into the build through `import.meta.glob`, so the chunks cover them; the check proves the sheet still opens offline. Run `make quality`, then `npx vite preview`. In a browser, load the page once, switch the network off in developer tools, and reload. Expected: the app loads and the Day view works. In the Network tab, make sure that no request goes to a host other than the page's own.
- [x] **Step 3:** Write `.github/workflows/deploy.yml`: on push to `main`, run `npm ci`, `make quality`, and deploy `dist/` with `actions/deploy-pages`. Write a short `README.md`: what the app does, how to run it, how to run the reference check, how the texts are adapted from Picatrix, and that `reference/` holds copyrighted PDFs that are not distributed with the repository.
- [x] **Step 4:** Commit: `feat: offline install and GitHub Pages deployment`. Then create the repository and push: `gh repo create picatrix --public --source . --remote origin --push` (the user chose gh creation; the repo is public per the design's "free, open-source" intent).

---

## Self-review notes

- Spec coverage: phase, sign, mansion, void, Mercury (Tasks 3, 4). Accuracy gate (Tasks 2, 3). Planet-set check (Task 5). Time zones (Task 5). Now, Day, Month, Description, Settings, About (Tasks 8 to 12). Picatrix content (Task 7). Offline and install (Task 13). The calendar feed and lunar days are "Later" in the spec and have no task.
- Decided by the user (2026-11-20): the app name is "Picatrix Lunar Almanac"; the texts are adapted paraphrases of every feature's lore from the Attrell and Porreca 2020 translation; the repository is created with `gh` (public) and pushed at the end.
- Decided by the user during Task 5 (2026-11-20): the Lunarium fit pairs within 120 s and keeps all nine planets as the void set (measured rate 1.0). The spring-forward gap policy follows the single-gap convention: shift the wall time by the gap and read with the pre-gap offset (02:30 New York = 07:30Z = 03:30 EDT).
- Reviewed by codex (2026-11-20, `reviews/plan-codex-20261120.md`, git-ignored): verdict REJECT with 3 blockers and 10 importants, all folded in. The reference test now covers only kinds that exist at its task (Mercury joins in Task 4). The accuracy promise is split: one minute for Moon events, ten minutes for Mercury stations, stated in the design with the reason. The 99% void fit is now a blocking gate with a recorded floor. The void query scans from the ingress before `start` to the ingress after `end`. The crossing search normalizes angles to (-180, 180], treats 0 and 360 as one target, and owns endpoints. Mercury stations search both crossing directions of unwrapped longitude speed. The reference generator gained a self-check mode and a coverage header. `fromLocal` has an explicit clock-change policy. `stepEvent` returns the previous distinct state, not the current state's start. Day summaries list Mercury transitions. `gen-void.ts` imports the fitted planet set as its single source of truth. The quality gate checks the service worker precache after build.
