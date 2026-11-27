import { describe, expect, it } from 'vitest'

import type { Vec3 } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import type { TestRoom } from '../src'
import { makeRoom } from './helpers'

/** Spec 008, TS.9i: the blast's knock on the player when the body is a walker in the Jolt world (the `own` twin is in blast-knock-player.test.ts). */

const sceneOf = async (): Promise<{ room: TestRoom; dispose: () => void }> => {
  const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
  const room = makeRoom({ physics: createPhysicsLoop(world) })
  return {
    room,
    dispose: () => {
      room.dispose()
      world.dispose()
    },
  }
}

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) room.update(1 / 60, { live: true })
}

const charge = (room: TestRoom, at: Vec3, tnt: number): void => {
  room.world.add(
    { parts: [{ id: 'charge', material: 'steel', shape: { kind: 'box', size: [0.2, 0.2, 0.2] }, position: [0, 0.1, 0], explodes: { energy: tnt * 830_000, radius: 15, lethalRadius: 0, tnt } }] },
    { id: 'probe_charge', position: at },
  )
  room.world.hitPart('probe_charge', 'charge', { type: 'blunt', point: [at[0], at[1] + 0.1, at[2]], direction: [0, -1, 0], energy: 1e9, radius: 0.2 })
}

describe('a blast on the player walking in the engine (spec 008, TS.9i)', () => {
  it('a body thrown into a wall slams into it and does not go through', { timeout: 60000 }, async () => {
    const { room, dispose } = await sceneOf()
    try {
      room.look([0, 1.7, -2], [0, 1.7, -6])
      room.spawn('steel_sheet', [0, 0, -3.3], 0)
      run(room, 0.5)
      charge(room, [0, 0, -0.8], 5)
      run(room, 3)
      expect(room.log.entries().find((e) => e.type === 'player_knocked_down')).toBeDefined()
      const slam = room.log.entries().find((e) => e.type === 'player_slammed' && e.data?.against === 'obstacle')
      expect(slam).toBeDefined()
      expect(Number(slam?.data?.speed)).toBeGreaterThan(1.5)
      expect(room.playerPosition[2]).toBeGreaterThan(-3.3)
    } finally {
      dispose()
    }
  })

  it('a body thrown into the air that comes down on the floor falls on it: the ground slam, then it gets up', { timeout: 60000 }, async () => {
    const { room, dispose } = await sceneOf()
    try {
      room.look([0, 1.7, 0], [0, 1.7, -6])
      run(room, 0.3)
      charge(room, [0, 0, 1.2], 5)
      run(room, 4)
      expect(room.log.entries().find((e) => e.type === 'player_knocked_down')).toBeDefined()
      const fell = room.log.entries().find((e) => e.type === 'player_slammed' && e.data?.against === 'ground')
      expect(fell).toBeDefined()
      expect(Number(fell?.data?.speed)).toBeGreaterThan(0.75)
      run(room, 12)
      expect(room.playerKnock).toBeNull()
    } finally {
      dispose()
    }
  })
})
