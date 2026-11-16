import { describe, expect, it } from 'vitest'
import type * as THREE_NS from 'three'

import type { TestableItem } from '@adatechnology/game-contracts'
import { buildFromSpec } from '../src/build-from-spec'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/** A 0.6 x 0.4 x 0.3 m cabinet that the catalogue lets fall (movable). */
const cabinet: TestableItem = {
  id: 'cabinet',
  name: 'Cabinet',
  build: (T: unknown) => buildFromSpec(T as typeof THREE_NS, { name: 'Cabinet', parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [0.6, 0.4, 0.3] }, position: [0, 0.2, 0] }] }),
  movable: true,
}

const roomWith = (fixed: boolean) => {
  const room = makeRoom({ catalog: demoItems('en', []) })
  room.loadModule({ id: 'wall_test', name: 'Wall test', group: 'Wall test', items: () => [cabinet], area: () => ({ placements: [{ item: 'cabinet', position: [0, 1.4, -4], ...(fixed ? { fixed: true } : {}) }] }) })
  const [so] = room.openArea('wall_test')
  if (!so) throw new Error('the area laid nothing')
  for (let i = 0; i < 90; i++) room.update(1 / 30)
  return { room, so }
}

describe('AreaPlacement.fixed', () => {
  it('holds a piece the catalogue lets fall where the area hangs it', () => {
    const { so } = roomWith(true)
    expect(so.movable).toBe(false)
    expect(so.root.position.y).toBeCloseTo(1.4, 3)
  })

  it('without it the same piece falls to the floor', () => {
    const { so } = roomWith(false)
    expect(so.movable).toBe(true)
    expect(so.root.position.y).toBeLessThan(0.05)
  })
})
