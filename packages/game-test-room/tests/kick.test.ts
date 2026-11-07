import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { demoItems } from './fixtures/demo-items'
import { buildFromSpec } from '../src/build-from-spec'
import { makeRoom } from './helpers'

/** A 350 ml steel can, 6.6 cm across and 11.5 cm tall, 0.4 kg full. */
const sodaCan = (): DestructibleSpec => ({
  name: 'soda can',
  parts: [{ id: 'can', material: 'steel', shape: { kind: 'cylinder', radius: 0.033, height: 0.115 }, position: [0, 0.0575, 0], mass: 0.4 }],
  joints: [],
  tags: ['item'],
})

const run = (room: ReturnType<typeof makeRoom>, seconds: number, each?: () => void): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    room.update(1 / 60)
    each?.()
  }
}

/** A room with a can lying on its side across the player's way, 2 m ahead (its axis along x, so it rolls along z). */
const canAhead = () => {
  const room = makeRoom({ catalog: demoItems('en', [{ id: 'soda_can', name: 'soda can', group: 'items', build: () => buildFromSpec(THREE, sodaCan()), spec: sodaCan }]) })
  const can = room.spawn('soda_can', [0, 0, -1], 0)
  can.root.rotation.z = Math.PI / 2
  can.root.position.y = 0.034
  can.root.updateMatrixWorld(true)
  room.look([0, 1.6, 1], [0, 0, -2])
  return { room, can }
}

describe('the player kicks what lies at the feet', () => {
  it('walking into a can kicks it rolling ahead at about 1.5 times the walk, and the walk goes on through where it was', () => {
    const { room, can } = canAhead()
    const piece = room.renderer.piece(can.objectId)
    expect(piece).not.toBeNull()
    // 1.5 m/s toward -z, through where the can lies
    room.walk([0, 0, -2], 2)
    let fastest = 0
    run(room, 2.2, () => {
      fastest = Math.max(fastest, Math.hypot(piece?.velocity[0] ?? 0, piece?.velocity[2] ?? 0))
      // never under the floor: its centre stays a radius up
      expect(new THREE.Vector3(0, 0.0575, 0).applyMatrix4(can.root.matrixWorld).y).toBeGreaterThan(0.027)
    })
    expect(room.log.entries({ type: 'kick' }).length).toBeGreaterThan(0)
    // (1 + 0.5) x 1.5 m/s x 75 / 75.4: about 2.2 m/s off the foot
    expect(fastest).toBeGreaterThan(1.9)
    expect(fastest).toBeLessThan(2.6)
    // it went ahead of the player, rolling: v = w r about its axis
    expect(can.root.position.z).toBeLessThan(room.camera.position.z - 0.3)
    expect(Math.abs(piece?.angularVelocity[0] ?? 0) * 0.033).toBeCloseTo(Math.abs(piece?.velocity[2] ?? 0), 1)
    // the can did not stop the player: the walk reached its end
    expect(room.camera.position.z).toBeLessThan(-1.8)
  })

  it('a heavy thing is not kicked: the walk leans on it as before', () => {
    const room = makeRoom()
    room.spawn('chair', [0, 0, -2], 0)
    room.look([0, 1.6, 1], [0, 1, -2])
    room.walk([0, 0, -2], 2)
    run(room, 2.5)
    expect(room.log.entries({ type: 'kick' })).toHaveLength(0)
    expect(room.log.entries({ type: 'bump' }).length).toBeGreaterThan(0)
  })
})
