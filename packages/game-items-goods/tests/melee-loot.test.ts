import { describe, expect, it } from 'vitest'
import { createGoodsFindsProvider, createGoodsItems, GOODS_HOUSE_POOLS, GOODS_ITEMS } from '../src'
import housePoolsFile from '../src/data/house-pools.json'

type Entry = { readonly item: string | null; readonly weight: number; readonly isTakeable?: boolean }
const pools = GOODS_HOUSE_POOLS.pools as unknown as Readonly<Record<string, readonly Entry[]>>
const poolsWith = (item: string): string[] => Object.entries(pools).flatMap(([key, entries]) => (entries.some((entry) => entry.item === item) ? [key] : [])).sort()
const weightIn = (key: string, item: string): number => pools[key]?.find((entry) => entry.item === item)?.weight ?? 0

describe('the melee weapons in the house loot', () => {
  it('puts the KA-BAR (uncommon) in the dressers, nightstands (drawers) and the garage bench and shelf', () => {
    expect(poolsWith('kabar')).toEqual(['bancada', 'comoda', 'criado', 'estante_ferr'])
  })

  it('puts the katana (rare) in the wardrobe, and the brass knuckles (rare) in the drawers and the wardrobe', () => {
    expect(poolsWith('katana')).toEqual(['guarda'])
    expect(poolsWith('brass_knuckles')).toEqual(['comoda', 'criado', 'guarda'])
  })

  it('weighs an entry by the rarity of the item: 0.06 uncommon and 0.03 rare, small against the 2 of a common entry', () => {
    expect(weightIn('comoda', 'kabar')).toBe(0.06)
    expect(weightIn('guarda', 'katana')).toBe(0.03)
    expect(weightIn('comoda', 'brass_knuckles')).toBe(0.03)
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

  it('keeps them rare: in pools of six entries or more, so the cut of the roll cannot hand them out every time', () => {
    for (const id of ['kabar', 'katana', 'brass_knuckles']) for (const key of poolsWith(id)) expect(pools[key]?.length, `${key}/${id}`).toBeGreaterThanOrEqual(6)
  })

  it('turns them up in a few containers in a hundred, not in most (a normal-sized piece, 5000 seeds)', () => {
    const provider = createGoodsFindsProvider(createGoodsItems())
    const mulberry = (start: number) => {
      let seed = start
      return (): number => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    const share = (key: string, id: string): number => {
      let hits = 0
      for (let seed = 1; seed <= 5000; seed++) if ((provider.findsFor({ place: 'house', container: key, key, state: 'normal', rng: mulberry(seed), day: 0, footprint: 0.5 }) ?? []).some((stack) => stack.itemId === id)) hits++
      return hits / 5000
    }
    expect(share('guarda', 'katana')).toBeLessThan(0.03)
    expect(share('guarda', 'katana')).toBeGreaterThan(0.002)
    expect(share('comoda', 'brass_knuckles')).toBeLessThan(0.04)
    expect(share('comoda', 'kabar')).toBeLessThan(0.1)
    expect(share('comoda', 'kabar')).toBeGreaterThan(share('comoda', 'brass_knuckles'))
  })
})
