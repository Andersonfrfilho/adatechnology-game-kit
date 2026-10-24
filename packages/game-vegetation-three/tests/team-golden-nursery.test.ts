import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as GameVegetationMain from '@adatechnology/game-vegetation'
import * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import * as THREE from 'three'

import { HOUSE, scatterLot } from '../src'
import { createNursery } from '../src/test-area/nursery'

/**
 * G-nursery: `buildLotVeg` of the Viveiro page (vegetacao__viveiro.js 77934-77992) is cut from the page and run with the SDK; the nursery of the module must plant the same lot for the same
 * seed: the same placements, the same triangles, plants and colliders, the same species.
 */
const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../../../specs/001-migracao-entregas-dos-times/sources/vegetacao__viveiro.js'), 'utf8')
const from = source.indexOf('const EX_HOUSE = ')
const to = source.indexOf('function ensureLot() {', from)
const code = source.slice(from, to)
const sdk = { ...GameVegetationMain, ...GameVegetationAdapter } as never as typeof GameVegetationMain & typeof GameVegetationAdapter

type PageLot = { data: { triangleCount: number; plantCount: number; colliders: { x: number; z: number; r: number; h: number }[]; lodCounts: number[] } | null; used: Set<string>; count: number }
const runPage = (seed: number, settings: { quality: 'high' | 'game'; lod: 0 | 1 | 2; cond: string; season: string }): { lot: PageLot; all: unknown[] } => {
  const lot = { obj: null, cols: { visible: false, add() {} }, dyn: { remove() {}, add() {} }, data: null, used: null, count: 0, buildMs: 0 } as unknown as PageLot & Record<string, unknown>
  const st = { lotSeed: seed, lotQ: settings.quality, lod: settings.lod, cond: settings.cond, season: settings.season, lotCol: false }
  // the page adds each scatter run to `all`; capture the placements through a wrapping GV.scatter
  const captured: unknown[] = []
  const GV = {
    ...sdk,
    scatter: (...args: Parameters<typeof sdk.scatter>) => {
      const out = sdk.scatter(...args)
      captured.push(...out)
      return out
    },
    createLotObject: () => ({ traverse() {} }),
  }
  const factory = new Function('GV', 'GVS', 'THREE', 'lot', 'st', 'spec', 'mats', 'HOUSE', 'disposeTree', 'clearGroup', 'performance', `${code}\nreturn buildLotVeg`)
  const buildLotVeg = factory(
    GV,
    GameVegetationSpecies,
    { Mesh: class { position = { set() {} } }, CylinderGeometry: class {}, MeshBasicMaterial: class {} },
    lot,
    st,
    (id: string) => GameVegetationSpecies.toSpec(id),
    {},
    HOUSE,
    () => undefined,
    () => undefined,
    { now: () => 0 },
  ) as () => void
  buildLotVeg()
  return { lot, all: captured }
}

describe('team golden: the lot of the Viveiro page against the nursery', () => {
  const seeds = [1, 2, 3, 7, 12, 42, 99, 1234]
  it.each(seeds)('seed %i: same placements, triangles, plants and colliders', (seed) => {
    const page = runPage(seed, { quality: 'high', lod: 0, cond: 'healthy', season: 'spring' })
    const mine = scatterLot(sdk as never, GameVegetationSpecies as never, seed)
    expect(JSON.parse(JSON.stringify(mine.placements))).toEqual(JSON.parse(JSON.stringify(page.all)))
    expect([...mine.used]).toEqual([...(page.lot.used as Set<string>)])
    const nursery = createNursery(sdk as never, GameVegetationSpecies as never, THREE, sdk.createVegetationMaterials(THREE as never) as never, new THREE.Group(), [0, 0])
    const stats = nursery.plant({ seed, quality: 'high', lod: 0, condition: 'healthy', season: 'spring' })
    const data = page.lot.data!
    expect(stats.triangles).toBe(data.triangleCount)
    expect(stats.plants).toBe(data.plantCount)
    expect(stats.colliders).toBe(data.colliders.length)
    expect(stats.lod).toEqual(data.lodCounts)
    expect(stats.plants).toBeGreaterThan(20)
  })

  it('also agrees in game quality at LOD 1 with dry plants in autumn', () => {
    const page = runPage(5, { quality: 'game', lod: 1, cond: 'dry', season: 'autumn' })
    const nursery = createNursery(sdk as never, GameVegetationSpecies as never, THREE, sdk.createVegetationMaterials(THREE as never) as never, new THREE.Group(), [0, 0])
    const stats = nursery.plant({ seed: 5, quality: 'game', lod: 1, condition: 'dry', season: 'autumn' })
    expect(stats.triangles).toBe(page.lot.data!.triangleCount)
    expect(stats.plants).toBe(page.lot.data!.plantCount)
  })
})
