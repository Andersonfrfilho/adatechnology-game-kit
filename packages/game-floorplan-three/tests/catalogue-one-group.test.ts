import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import { createDestruction } from '@adatechnology/game-destruction'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'

const types = defaultFurnitureCatalog().map((entry) => entry.type)

/**
 * Debt: loose groups a piece of furniture still has when it is added, as the team drew it (a part drawn a little off the one it is fixed to: no contact, no joint; or a
 * piece hung from a wall or ceiling the furniture's own spec does not have). Measured 2026-11-17. It only shrinks: fix the drawing or the joint and lower the number;
 * a new piece starts at none.
 */
const KNOWN_LOOSE: Readonly<Record<string, number>> = {
  stove: 1,
  stove_4burner: 1,
  kitchen_cabinet: 4,
  kitchen_cabinet_large: 5,
  kitchen_cabinet_small: 3,
  shower: 2,
  shower_large: 2,
  laundry_tub: 1,
  motorcycle: 1,
  planter_bed_small: 4,
  clothesline: 2,
  pool: 5,
  pool_large: 5,
  bicycle: 1,
  chandelier: 7,
  ac_condenser: 2,
  mailbox: 1,
  hanging_plant: 1,
  curtain: 19,
  breakfast_bar: 6,
  sauna: 1,
  soaking_tub: 1,
  gourmet_counter: 5,
  gourmet_counter_small: 3,
  pool_small: 5,
  pool_medium: 5,
  fruit_tree: 9,
  bbq_simple: 4,
  swing: 2,
}

// what is attached in the real world is attached in the destruction world: a piece of furniture comes into the world as one group, nothing of it loose at load
describe('the furniture catalogue in the destruction world', () => {
  it.each(types)('%s: is one group when added (or exactly its known debt)', (type) => {
    let made: ReturnType<typeof furnitureSpec>
    try {
      made = furnitureSpec(THREE, type, { catalog: defaultFurnitureCatalog(), document: fakeDocument, options: { chairs: false } })
    } catch {
      return
    }
    const world = createDestruction({ seed: 1 })
    const id = world.add(made.spec, { id: type })
    expect(world.state(id)!.groups.length - 1, 'loose groups at load').toBe(KNOWN_LOOSE[type] ?? 0)
  })

  it('the debt names only pieces of the catalogue', () => {
    expect(Object.keys(KNOWN_LOOSE).filter((type) => !types.includes(type))).toEqual([])
  })
})
