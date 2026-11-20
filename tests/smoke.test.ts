import { expect, test } from 'vitest'
import * as Astronomy from 'astronomy-engine'

test('astronomy-engine exposes MoonPhase', () => {
  expect(typeof Astronomy.MoonPhase).toBe('function')
})
