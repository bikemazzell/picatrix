import { existsSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { VOID_PLANETS } from '../../src/astro'
import { runFit } from '../../tools/lunarium/fit'

const TABLES = existsSync('local/lunarium')
if (!TABLES) console.log('Lunarium tables not present, run tools/lunarium/fetch.ts')

const FLOOR = 1.0

describe.skipIf(!TABLES)('void-of-course fit against Lunarium', () => {
  test(
    'the pinned VOID_PLANETS stays at or above the measured floor',
    () => {
      const fit = runFit(VOID_PLANETS)
      expect(
        fit.rate,
        `rate ${fit.rate} (matched ${fit.matched} of ${fit.reference}) is below the floor ${FLOOR}`,
      ).toBeGreaterThanOrEqual(FLOOR)
      expect(
        fit.misses,
        `${fit.misses.length} unmatched or mismatched periods: ${JSON.stringify(fit.misses)}`,
      ).toHaveLength(0)
    },
    120_000,
  )
})
