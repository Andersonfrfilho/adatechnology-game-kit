import { describe, expect, it } from 'vitest'

import { isPhysicsLoop } from '@adatechnology/game-physics'

import { RoomPhysicsRequiredError, createRoomPhysics, createTestRoom } from '../src'
import { stubRenderer } from './helpers'
import * as THREE from 'three'

describe('the physics the room needs', () => {
  it('a room made without `physics` throws a typed error that says how to make the loop', () => {
    const options = { THREE, container: document.createElement('div'), catalog: [], renderer: stubRenderer(), ui: false }
    expect(() => createTestRoom(options as unknown as Parameters<typeof createTestRoom>[0])).toThrow(RoomPhysicsRequiredError)
    expect(() => createTestRoom(options as unknown as Parameters<typeof createTestRoom>[0])).toThrow(/createRoomPhysics/)
  })

  it('createRoomPhysics makes a loop a room steps on', async () => {
    const loop = await createRoomPhysics()
    expect(isPhysicsLoop(loop)).toBe(true)
    const room = createTestRoom({ THREE, container: document.createElement('div'), catalog: [], renderer: stubRenderer(), ui: false, physics: loop })
    room.update(1 / 60)
    room.dispose()
    ;(loop.world as unknown as { dispose(): void }).dispose()
  })
})
