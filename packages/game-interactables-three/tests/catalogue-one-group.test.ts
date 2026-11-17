import { createDestruction } from '@adatechnology/game-destruction'
import { specFromObject3D } from '@adatechnology/game-destruction-three'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { cases } from './catalog-cases'

// what is attached in the real world is attached in the destruction world: every piece of the catalogue (household and props3d, as bound) is one group when added
describe('the catalogue in the destruction world', () => {
  it.each(cases)('%s: is one group when added', (id, build) => {
    const { spec } = specFromObject3D(THREE, build(), { name: id })
    // a run drawn as wires only (conduit_run) has nothing the world keeps
    if (spec.parts.length === 0) return
    const world = createDestruction({ seed: 1 })
    const objectId = world.add(spec, { id: 'piece' })
    expect(world.state(objectId)!.groups.slice(1), 'loose groups at load').toEqual([])
  })
})
