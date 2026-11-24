import { describe, expect, it } from 'vitest'

import { createWorld } from '@adatechnology/game-interactables'

import { setLotGrid } from '../src/game/assemble/houses'

describe('an outage of one lot (`Houses.setLotGrid`)', () => {
  const placed = ['street_north_1', 'street_north_2'].map((id) => ({ lot: { id }, house: { interactives: { world: createWorld() } } }))
  const grid = (index: number): boolean => placed[index]!.house.interactives.world.power.grid

  it('cuts the grid of that lot\'s house, leaves the neighbour on, and restores it', () => {
    expect(setLotGrid({ list: placed, lot: 'street_north_1', on: false })).toBe(true)
    expect([grid(0), grid(1)]).toEqual([false, true])
    expect(setLotGrid({ list: placed, lot: 'street_north_1', on: true })).toBe(true)
    expect([grid(0), grid(1)]).toEqual([true, true])
  })

  it('does nothing for a lot with no house or no interactables', () => {
    expect(setLotGrid({ list: placed, lot: 'nowhere', on: false })).toBe(false)
    expect(setLotGrid({ list: [{ lot: { id: 'bare' }, house: { interactives: null } }], lot: 'bare', on: false })).toBe(false)
    expect([grid(0), grid(1)]).toEqual([true, true])
  })
})
