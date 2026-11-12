import * as GameVegetationMain from '@adatechnology/game-vegetation'
import * as GameVegetationAdapter from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import * as THREE_NS from 'three'
import { createVegetationTestModule } from '../src'
import { createNursery } from '../src/test-area/nursery'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
export type Root = { traverse(f: (o: unknown) => void): void }
export type Case = [string, () => Root]
export const cases: Case[] = []
{
  const THREE = THREE_NS
  const module = createVegetationTestModule({ GameVegetationSpecies, locale: 'en' })
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
