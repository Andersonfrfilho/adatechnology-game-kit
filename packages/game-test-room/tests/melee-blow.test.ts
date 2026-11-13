import { describe, expect, it } from 'vitest'
import type * as THREE_NS from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

type Vec = [number, number, number]

const SHOVEL_SPEC = (): DestructibleSpec => ({
  name: 'Shovel',
  parts: [
    { id: 'handle', material: 'wood_hard', shape: { kind: 'box', size: [0.9, 0.035, 0.035] }, position: [-0.101, 0.053, 0], mass: 0.9, tags: ['handle'] },
    { id: 'blade', material: 'steel', shape: { kind: 'box', size: [0.301, 0.012, 0.22] }, position: [0.4005, 0.006, 0], mass: 1.1, thickness: 0.002, tags: ['blade'] },
  ],
})
const plainShovel: TestRoomItem = { id: 'item_shovel', name: 'Shovel', group: 'Items', build: (T: typeof THREE_NS) => buildFromSpec(T, SHOVEL_SPEC()), spec: SHOVEL_SPEC, movable: true }

/** A shovel lying 0.9 m ahead of a standing player (its blade under the eye's aim), the sledgehammer in hand, aimed at the blade. */
function swingAtBlade(): { room: ReturnType<typeof makeRoom>; objectId: string; root: THREE_NS.Object3D; swing: () => void; seconds: (s: number) => void } {
  const room = makeRoom({ catalog: demoItems('en', [plainShovel]) })
  room.terrain.setLayout({ surface: 'dirt' })
  const spawned = room.spawn('item_shovel', [-0.5, 0, -0.8], 0)
  const objectId = spawned.objectId
  room.update(0.4)
  room.setTool('sledgehammer')
  const eye: Vec = [0, 1.7, 0]
  const seconds = (s: number): void => {
    for (let i = 0; i < Math.round(s * 60); i++) {
      room.look(eye, [0, 0.03, -0.8])
      room.update(1 / 60)
    }
  }
  seconds(1)
  return { room, objectId, root: spawned.root, swing: () => room.use(), seconds }
}

describe('a sledgehammer blow onto a shovel lying on the floor', () => {
  it('bends the blade for good: the blow of the room reaches the bend model like any other blunt hit', () => {
    const { room, objectId, swing, seconds } = swingAtBlade()
    swing()
    seconds(1.5)
    expect(room.log.entries({ type: 'melee' }).length).toBeGreaterThan(0)
    expect(room.world.part(objectId, 'blade')?.bend ?? 0).toBeGreaterThan(0.02)
  })

  it('presses the shovel into the floor: it does not leave it, at most it slides a little', () => {
    const { root, swing, seconds } = swingAtBlade()
    const before = root.position.clone()
    let highest = 0
    swing()
    for (let i = 0; i < 90; i++) {
      seconds(1 / 60)
      highest = Math.max(highest, root.position.y - before.y)
    }
    expect(highest).toBeLessThan(0.05)
    expect(root.position.distanceTo(before)).toBeLessThan(1)
  })
})
