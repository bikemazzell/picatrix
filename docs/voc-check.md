# Void-of-course planet set check

How the void-of-course periods produced by `src/astro` were checked against
Lunarium's published tables, and which planet set was chosen.

## Method

- Reference: the lunarium.co.uk void-of-course calendars for 2025, 2026, and
  2027, downloaded by `tools/lunarium/fetch.ts` into `local/lunarium/<year>.json`
  as UTC ISO periods. The tables are not in the repository.
- Generated: `voidPeriods()` from `src/astro` over the same range.
- A period is counted for a year only when its start and its end both lie
  inside that year's comparison window: the intersection of the calendar year
  and the table's range, padded by 120 s at the table edges because the
  printed edges are floored minutes.
- Matching: sort both sides by start, then pair one-to-one with a two-pointer
  walk. A pair counts only when the start and the end both differ by at most
  the tolerance. A reference period left unpaired counts as a miss, and so
  does an unpaired generated period.
- Rate = matched periods divided by reference periods.
- Tolerance: 120 s (ruling of 2026-11-20). Lunarium's tables display floored
  minutes, and measured against the DE440 fixtures its engine runs up to
  ~80 s ahead of DE440 while ours runs ~5 s early (mean -4.6 to -6.8 s over
  2,799 aspect events and 481 ingresses), so an exact instant legitimately
  differs from the displayed minute by up to ~90 s. 120 s covers that sum with
  margin, still requires one-to-one structural agreement, and still separates
  the candidate sets, as the ceilings below show.

## Results

Reference periods: 481 (2025: 161, 2026: 160, 2027: 160).

| Planet set | Matched | Unmatched ref / gen | Rate | Rate at 60 s | Ceiling |
| --- | --- | --- | --- | --- | --- |
| Sun..Saturn (6) | 383 | 98 / 96 | 79.63% | 60.08% | 79.6% |
| + Uranus (7) | 433 | 48 / 46 | 90.02% | 67.57% | 90.0% |
| + Uranus + Neptune (8) | 481 | 0 / 0 | 100.00% | 72.14% | 100% |
| all nine (9) | 481 | 0 / 0 | 100.00% | 72.14% | 100% |

The 60 s column shows what the originally planned tighter window does: it
turns display truncation into misses. The ceiling is the rate when timing is
ignored entirely (600 s pairing); it is the structural limit of a set.

Chosen set: all nine planets through Pluto, unchanged in `src/astro/void.ts`
(user decision, 2026-11-20). Measured at 120 s: 481 of 481 matched, zero
unmatched on either side. On this data the eight-planet set is
indistinguishable: Pluto is never the deciding last aspect in 2025 to 2027,
so dropping it would not change a single period in these years. Keeping it
was the user's choice.

## Mismatch causes

- Nine planets at 120 s: no mismatches.
- Six and seven planets fail structurally at any tolerance (ceilings 79.6%
  and 90.0%). About 20% of Lunarium's voids end on an aspect to Uranus or
  Neptune (roughly 10% each). Without those planets the generated void starts
  at an earlier classical aspect, displacing the period by minutes to hours,
  and the pairing reports misses on both sides.
- At 60 s, every miss of the eight- and nine-planet sets is a timing
  artifact: starts 61 to 90 s late, or ends 60 to 71 s apart, from minute
  flooring plus the ~15 s engine difference. No period is missing or extra on
  either side.

## Floor test

`tests/astro/voc-lunarium.test.ts` re-runs the fit for the pinned
`VOID_PLANETS` and asserts the rate stays at or above the measured floor of
1.0 (481 of 481, never below the 99% gate). It skips when `local/lunarium` is
absent and prints that `tools/lunarium/fetch.ts` must be run first, because
the tables are not in the repository.
