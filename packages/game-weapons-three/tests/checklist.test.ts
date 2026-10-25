import { describe, expect, it } from 'vitest'
import { checkWeapons } from './support/weapon-checks'

describe('the animation checklist of every weapon with a model', () => {
  const rows = checkWeapons()
  for (const key of ['support', 'trigger', 'tactical', 'empty', 'time', 'contact', 'sound'] as const) {
    it(`${key}: no weapon fails`, () => {
      const failed = rows.filter((row) => row[key].ok === false).map((row) => `${row.id}: ${row[key].note}`)
      expect(failed).toEqual([])
    })
  }
})
