import { describe, expect, it } from 'vitest'

import { createItems, rollExplicitPool } from '../src'
import type { FindsQuery, PoolEntry } from '../src'
import { scripted } from './fixtures'

const { rules } = createItems()

const pool: PoolEntry[] = [
  { item: 'water', weight: 3, qty: [1, 3], isSupply: true },
  { item: 'milk', weight: 2, qty: [1, 2], isSupply: true },
  { item: 'eggs', weight: 2, qty: [1, 1] },
  { item: 'steak', weight: 1.5, qty: [1, 2], isSupply: true },
  { item: 'cola', weight: 1, qty: [2, 4] },
]

const query = (random: () => number, extra: Partial<FindsQuery> = {}): FindsQuery => ({ place: 'house', container: 'fridge', state: 'normal', rng: random, ...extra })
const roll = (state: 'normal' | 'fortified' | 'abandoned', draws: number[], extra: Partial<FindsQuery> = {}) => {
  const script = scripted(...draws)
  return { picks: rollExplicitPool(pool, state, query(script.random, extra), rules), draws: script.draws }
}
const ids = (picks: { itemId: string }[]): string[] => picks.map((pick) => pick.itemId)

describe('rollExplicitPool: the order of the draws of sorteiaConteudo', () => {
  it('normal: one draw for the count, one per pool entry for the order, one per kept entry for the quantity', () => {
    // footprint 0.5: round(1.5 + 1.5 + 0 x 1.5) = 3 entries
    const { picks, draws } = roll('normal', [0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(draws()).toBe(1 + 5 + 3)
    expect(ids(picks)).toEqual(['water', 'milk', 'eggs'])
  })

  it('orders by weight without replacement: a draw near 1 always takes the last one left', () => {
    const { picks } = roll('normal', [0, 0.99, 0.99, 0.99, 0.99, 0.99, 0, 0, 0])
    expect(ids(picks)).toEqual(['cola', 'steak', 'eggs'])
  })

  it('takes the quantity as low + floor(draw x (high - low + 1))', () => {
    const { picks } = roll('normal', [0, 0, 0, 0, 0, 0, 0.99, 0.99, 0.99])
    expect(picks.map((pick) => pick.count)).toEqual([3, 2, 1])
  })

  it('sizes the count by the footprint, between 2 and 5', () => {
    expect(roll('normal', [0, ...Array(5).fill(0), 0, 0], { footprint: 0 }).picks).toHaveLength(2)
    expect(roll('normal', [0.99, ...Array(5).fill(0), 0, 0, 0, 0, 0], { footprint: 2 }).picks).toHaveLength(5)
  })

  it('fortified: two more entries (up to the pool), supplies weigh 2.5 times and give one more', () => {
    const { picks, draws } = roll('fortified', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(draws()).toBe(1 + 5 + 5)
    expect(picks).toHaveLength(5)
    expect(picks.map((pick) => pick.count)).toEqual([2, 2, 1, 2, 2])
  })

  it('fortified: the weight of a supply is multiplied, which changes the order for the same draws', () => {
    const normal = roll('normal', [0, 0.45, 0.45, 0.45, 0.45, 0.45, 0, 0, 0]).picks
    const fortified = roll('fortified', [0, 0.45, 0.45, 0.45, 0.45, 0.45, 0, 0, 0, 0, 0]).picks
    expect(ids(normal)).not.toEqual(ids(fortified).slice(0, 3))
  })

  it('abandoned: one more draw for empty (40%), otherwise one entry', () => {
    const kept = roll('abandoned', [0, 0.4, 0, 0, 0, 0, 0, 0])
    expect(kept.draws()).toBe(1 + 1 + 5 + 1)
    expect(ids(kept.picks)).toEqual(['water'])
  })

  it('abandoned and empty: one last draw decides the junk (50%)', () => {
    const junk = roll('abandoned', [0, 0.39, 0, 0, 0, 0, 0, 0.49])
    expect(junk.draws()).toBe(1 + 1 + 5 + 1)
    expect(junk.picks).toEqual([{ itemId: 'food_packaging', count: 1 }])
    expect(roll('abandoned', [0, 0.39, 0, 0, 0, 0, 0, 0.5]).picks).toEqual([])
  })

  it('abandoned: a fridge or a freezer also holds spoiled food, with no draw', () => {
    const fridge = roll('abandoned', [0, 0.4, 0, 0, 0, 0, 0, 0], { key: 'geladeira' })
    expect(ids(fridge.picks)).toEqual(['water', 'leftover_meal'])
    expect(fridge.draws()).toBe(8)
  })

  it('names the pool by the key when it differs from the container', () => {
    expect(ids(roll('abandoned', [0, 0.4, 0, 0, 0, 0, 0, 0], { container: 'fridge' }).picks)).toEqual(['water'])
  })
})
