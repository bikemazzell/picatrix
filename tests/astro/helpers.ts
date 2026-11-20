import { expect } from 'vitest'

export const SEC = 1000

export function expectWithin(actual: Date, iso: string, tolSeconds: number) {
  expect(
    Math.abs(actual.getTime() - Date.parse(iso)),
    `${actual.toISOString()} vs ${iso}`,
  ).toBeLessThanOrEqual(tolSeconds * SEC)
}
