import { describe, expect, it } from 'vitest'

import { setLotWater } from '../src/game/assemble/houses'

/** A house's water as `createWater` makes it: a tank the plumbing points draw from. */
function fakeWater(capacity: number, points: readonly string[]) {
  let level = capacity
  return {
    capacity,
    points: Object.fromEntries(points.map((id) => [id, {}])),
    level: () => level,
    consume(point: string, liters: number) {
      if (!points.includes(point)) return 0
      const taken = Math.min(liters, level)
      level -= taken
      return taken
    },
    fill(liters: number) {
      const added = Math.min(liters, capacity - level)
      level += added
      return added
    },
  }
}

describe('the water of one lot (`Houses.setLotWater`)', () => {
  const placed = ['street_north_1', 'street_north_2'].map((id) => ({ lot: { id }, house: { water: fakeWater(500, ['tap', 'shower']) } }))

  it('runs the tank of that house dry so its fixtures deliver nothing, leaves the neighbour full, and fills it again', () => {
    expect(setLotWater({ list: placed, lot: 'street_north_1', on: false })).toBe(true)
    expect(placed.map((entry) => entry.house.water.level())).toEqual([0, 500])
    expect(placed[0]!.house.water.consume('tap', 5)).toBe(0)
    expect(placed[1]!.house.water.consume('tap', 5)).toBe(5)
    expect(setLotWater({ list: placed, lot: 'street_north_1', on: true })).toBe(true)
    expect(placed[0]!.house.water.level()).toBe(500)
  })

  it('does nothing for a lot with no house or no plumbing point', () => {
    expect(setLotWater({ list: placed, lot: 'nowhere', on: false })).toBe(false)
    expect(setLotWater({ list: [{ lot: { id: 'bare' }, house: { water: fakeWater(0, []) } }], lot: 'bare', on: false })).toBe(false)
  })
})
