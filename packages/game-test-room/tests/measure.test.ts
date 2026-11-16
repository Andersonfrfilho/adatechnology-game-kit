import { describe, expect, it } from 'vitest'
import type * as THREE_NS from 'three'

import type { TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/** A 0.6 x 0.3 x 0.2 m crate: what an area packs by its footprint. */
const crate: TestRoomItem = {
  id: 'crate',
  name: 'Crate',
  group: 'Items',
  build: (T: typeof THREE_NS) => buildFromSpec(T, { name: 'Crate', parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [0.6, 0.3, 0.2] }, position: [0, 0.15, 0] }] }),
  movable: true,
}

describe('room.measure', () => {
  it('gives the width, depth and height of an item of the catalogue, at rotation 0, without putting it in the room', () => {
    const room = makeRoom({ catalog: demoItems('en', [crate]) })
    const size = room.measure('crate')
    expect(size?.w).toBeCloseTo(0.6, 3)
    expect(size?.h).toBeCloseTo(0.3, 3)
    expect(size?.d).toBeCloseTo(0.2, 3)
    expect(room.spawned().some((so) => so.itemId === 'crate')).toBe(false)
  })

  it('answers null for an id the catalogue does not have', () => {
    const room = makeRoom({ catalog: demoItems('en', [crate]) })
    expect(room.measure('not_in_the_catalogue')).toBeNull()
  })
})
