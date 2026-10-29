import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as GameVegetationMain from '@adatechnology/game-vegetation'
import * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import { exactSnapshot } from '@adatechnology/golden-tool'
import * as THREE_NS from 'three'
import { describe, expect, it } from 'vitest'

import { createVegetationTestModule } from '../src'
import { createNursery } from '../src/test-area/nursery'

/**
 * Every bit of the module's items (the 18 plants) and of the nursery (scenery, planted lot, colliders and walker, several
 * seeds and settings): recorded on the old path (three's own geometry constructors) before the move to game-shapes, so the move cannot change a
 * byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-vegetation.json')

type Root = { traverse(f: (o: unknown) => void): void }
type Case = [string, () => Root]
const cases: Case[] = []
{
  const THREE: any = THREE_NS
  const module = createVegetationTestModule({ locale: 'en' })
  for (const item of module.items('en')) cases.push([`item/${item.id}`, () => item.build(THREE) as Root])
  const settings = [
    { seed: 1, quality: 'high', lod: 0, condition: 'healthy', season: 'spring' },
    { seed: 7, quality: 'game', lod: 1, condition: 'dry', season: 'autumn' },
    { seed: 12, quality: 'high', lod: 0, condition: 'overgrown', season: 'summer' },
    { seed: 42, quality: 'high', lod: 2, condition: 'dead', season: 'winter' },
  ] as const
  for (const s of settings)
    cases.push([
      `nursery/${s.seed}-${s.quality}-${s.lod}-${s.condition}-${s.season}`,
      () => {
        const parent = new THREE.Group()
        const nursery = createNursery(defaultSdk(), GameVegetationSpecies as never, THREE, module.materials(THREE), parent, [3, -2])
        nursery.plant(s as never)
        nursery.showColliders(true)
        nursery.setWalker(true)
        nursery.step(0.5)
        return parent
      },
    ])
}

function defaultSdk(): never {
  return { ...GameVegetationMain, ...GameVegetationAdapter } as never
}

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the vegetation module and nursery, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 900000)
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    expect({ hash: snapshot.hash, objects: snapshot.nodes.length }).toEqual(recorded[id])
  })
})
