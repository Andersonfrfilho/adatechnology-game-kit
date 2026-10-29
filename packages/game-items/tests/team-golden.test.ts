import { readFileSync } from 'node:fs'

import { createSeededRandom } from '@adatechnology/golden-tool'
import { createArsenal } from '@adatechnology/game-weapons'
import { describe, expect, it } from 'vitest'

import { createItems, itemsFromArsenal, rollByCategory, rollExplicitPool } from '../src'
import type { ArsenalItemRecord, ContainerDef, FindState, ItemDef, ItemsCatalog, PoolEntry, UseEffectDef } from '../src'

// G-b and G-c: the fixtures hold what the team's own `rollItems` (game) and `sorteiaConteudo` (3D house viewer) answered, cut out of the delivered sources and run
// with a seeded random stream (`scripts/record-team-golden.mjs`, recorded once). The ports must answer the same, with the same number of draws.
const readGoods = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../../game-items-goods/src/data/${name}.json`, import.meta.url), 'utf8')) as T
const readFixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/team-golden/${name}.json`, import.meta.url), 'utf8')) as T

type RollCase = { container: string; place: string; seed: number; ids: string[]; draws: number }
type RollFixture = { placeIds: Record<string, string>; cases: RollCase[] }
type PoolCase = { key: string; state: string; seed: number; footprint: number; picks: { type: string; count: number }[]; draws: number[] }
type HouseEntry = PoolEntry & { type: string }

const provenance = readGoods<Record<string, { ite?: string; game?: string[] }>>('provenance')
const ammoBoxes = readGoods<(ArsenalItemRecord & { id: string; teamId: string })[]>('ammo-boxes')
const containerRows = readGoods<(ContainerDef & { gameKey?: string })[]>('containers')
const housePools = readGoods<{ pools: Record<string, HouseEntry[]>; aliasOf: Record<string, string> }>('house-pools')

const goodsItems = readGoods<ItemDef[]>('items')
const arsenalPack = itemsFromArsenal(createArsenal(), { records: ammoBoxes })
const ammoIds = new Set(ammoBoxes.map((box) => box.id))
const teamIdOf = new Map<string, string>()
for (const item of goodsItems) {
  const gameId = provenance[item.id]?.game?.[0]
  if (gameId) teamIdOf.set(gameId, item.id)
}
for (const box of ammoBoxes) teamIdOf.set(box.teamId, box.id)

/** The game's pool is its 146 `ITENS` plus the ammunition boxes of its `EXTRA`: what the catalog adds on its own (the other team items, household items, created items, the other calibres) stays out. */
const catalog: ItemsCatalog = createItems({
  packs: [
    { id: 'goods', items: goodsItems, categories: readGoods('categories'), places: readGoods('places'), containers: containerRows, useEffects: readGoods<UseEffectDef[]>('use-effects'), pools: housePools.pools, poolAliases: housePools.aliasOf },
    arsenalPack,
  ],
  include: (item) => Boolean(provenance[item.id]?.game) || ammoIds.has(item.id),
})

const countingRandom = (random: () => number): { next: () => number; count: () => number } => {
  let count = 0
  return { next: () => ((count += 1), random()), count: () => count }
}

describe('G-b: rollItems of the game against rollByCategory', () => {
  const fixture = readFixture<RollFixture>('roll-items')
  const containerOf = new Map(containerRows.flatMap((row) => (row.gameKey ? [[row.gameKey, row.id] as const] : [])))

  it('covers 10 containers x 24 places x 10 seeds', () => {
    expect(fixture.cases).toHaveLength(2400)
    expect(fixture.cases.filter((entry) => entry.ids.length > 0).length).toBeGreaterThan(1500)
    const drawn = new Set(fixture.cases.flatMap((entry) => entry.ids))
    expect(drawn.size).toBeGreaterThan(100)
    expect([...drawn].some((id) => id.startsWith('mun_'))).toBe(true)
  })

  it('draws the same items in the same order, with the same number of draws, in every case', () => {
    const mismatches: string[] = []
    for (const entry of fixture.cases) {
      const random = countingRandom(createSeededRandom(entry.seed))
      const ids = rollByCategory(catalog, { place: fixture.placeIds[entry.place] as string, container: containerOf.get(entry.container) as string, state: 'normal', rng: random.next })
      const expected = entry.ids.map((id) => teamIdOf.get(id) ?? `?${id}`)
      if (JSON.stringify(ids) !== JSON.stringify(expected) || random.count() !== entry.draws) {
        mismatches.push(`${entry.container}/${entry.place}/${entry.seed}: expected ${expected.join(',')} (${entry.draws} draws), got ${ids.join(',')} (${random.count()})`)
      }
    }
    expect(mismatches.slice(0, 10), `${mismatches.length} of ${fixture.cases.length} differ`).toEqual([])
  })
})

describe('G-c: sorteiaConteudo of the 3D house viewer against rollExplicitPool', () => {
  const fixture = readFixture<{ cases: PoolCase[] }>('house-contents')
  const { rules } = catalog
  const STATE: Record<string, FindState> = { normal: 'normal', protegida: 'fortified', abandonada: 'abandoned' }
  const poolOf = (key: string): HouseEntry[] => housePools.pools[housePools.aliasOf[key] ?? key] as HouseEntry[]
  const typeOf = (itemId: string, entry?: PoolEntry): string =>
    entry ? (entry as HouseEntry).type : itemId === rules.finds.pool.junkItem ? 'lixo_diverso' : itemId === rules.finds.pool.spoiledFoodItem ? 'comida_estragada' : itemId

  it('covers every container key in the 3 states with seeds 1 to 25', () => {
    expect(fixture.cases).toHaveLength(25 * 3 * 25)
    expect(new Set(fixture.cases.map((entry) => entry.state))).toEqual(new Set(['normal', 'protegida', 'abandonada']))
  })

  it('picks the same entries, with the same quantities and the same draws, in every case', () => {
    const mismatches: string[] = []
    for (const entry of fixture.cases) {
      let used = 0
      const random = (): number => entry.draws[used++] ?? Number.NaN
      const picks = rollExplicitPool(poolOf(entry.key), STATE[entry.state] as FindState, { place: 'house', container: entry.key, state: STATE[entry.state] as string, rng: random, key: entry.key, footprint: entry.footprint }, rules)
      const got = picks.map((pick) => ({ type: typeOf(pick.itemId, pick.entry), count: pick.count }))
      if (JSON.stringify(got) !== JSON.stringify(entry.picks) || used !== entry.draws.length) {
        mismatches.push(`${entry.key}/${entry.state}/${entry.seed}: expected ${JSON.stringify(entry.picks)} (${entry.draws.length} draws), got ${JSON.stringify(got)} (${used})`)
      }
    }
    expect(mismatches.slice(0, 5), `${mismatches.length} of ${fixture.cases.length} differ`).toEqual([])
  })
})
