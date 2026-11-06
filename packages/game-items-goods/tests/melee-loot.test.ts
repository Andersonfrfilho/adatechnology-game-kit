import { describe, expect, it } from 'vitest'
import { GOODS_HOUSE_POOLS, GOODS_ITEMS } from '../src'
import housePoolsFile from '../src/data/house-pools.json'

type Entry = { readonly item: string | null; readonly weight: number; readonly isTakeable?: boolean }
const pools = GOODS_HOUSE_POOLS.pools as unknown as Readonly<Record<string, readonly Entry[]>>
const poolsWith = (item: string): string[] => Object.entries(pools).flatMap(([key, entries]) => (entries.some((entry) => entry.item === item) ? [key] : [])).sort()
const weightIn = (key: string, item: string): number => pools[key]?.find((entry) => entry.item === item)?.weight ?? 0

describe('the melee weapons in the house loot', () => {
  it('puts the KA-BAR (uncommon) in the drawers and the garage', () => {
    expect(poolsWith('kabar')).toEqual(['bancada', 'comoda', 'criado', 'estante_ferr', 'gaveteiro'])
  })

  it('puts the katana (rare) in the display cabinet and the wardrobe, and the brass knuckles (rare) in the drawers and the wardrobe', () => {
    expect(poolsWith('katana')).toEqual(['cristaleira', 'guarda'])
    expect(poolsWith('brass_knuckles')).toEqual(['comoda', 'criado', 'guarda'])
  })

  it('weighs an entry by the rarity of the item: 2 x its share of the rarity table (28 uncommon, 9 rare, of 60 common)', () => {
    expect(weightIn('comoda', 'kabar')).toBeCloseTo((2 * 28) / 60, 1)
    expect(weightIn('guarda', 'katana')).toBeCloseTo((2 * 9) / 60, 1)
    expect(weightIn('comoda', 'brass_knuckles')).toBeCloseTo((2 * 9) / 60, 1)
    expect(weightIn('comoda', 'kabar')).toBeGreaterThan(weightIn('comoda', 'brass_knuckles'))
  })

  it('makes each of them the same object as its weapon, drawn by the model of the same id, and takeable', () => {
    for (const id of ['kabar', 'katana', 'brass_knuckles']) {
      const item = GOODS_ITEMS.find((candidate) => candidate.id === id)
      expect(item, id).toMatchObject({ category: 'melee', weapon: id, model: id })
      for (const key of poolsWith(id)) expect((housePoolsFile.pools as unknown as Record<string, readonly (Entry & { type: string })[]>)[key]?.find((entry) => entry.item === id)?.isTakeable, `${key}/${id}`).toBe(true)
    }
    expect(GOODS_ITEMS.find((item) => item.id === 'kabar')?.rarity).toBe('uncommon')
    expect(GOODS_ITEMS.find((item) => item.id === 'katana')?.rarity).toBe('rare')
    expect(GOODS_ITEMS.find((item) => item.id === 'brass_knuckles')?.rarity).toBe('rare')
  })
})
