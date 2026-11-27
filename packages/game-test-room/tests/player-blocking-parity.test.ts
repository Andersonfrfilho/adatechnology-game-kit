import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import type { TestableModule } from '@adatechnology/game-contracts'

import type { ScenarioContext, TestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/**
 * Spec 008, TS.9l: what stops the room's own walk against what the physics world has a body for. Where the room stops the player and the world has no body, only the veto of
 * `player-body.ts` keeps the engine player out: those points are the bridge, and the bridge must not grow (a new kind of blocker comes with its body, or with the owner's word).
 */

const SOLID_LAYERS = ['static', 'debris', 'prop', 'vehicle'] as const
const GRID = { from: -11, to: 11, step: 0.5 }
/** The probes where the room stops the player and the world has no body (spec 008, TS.9l): the number may go down, never up. */
const BODILESS_PROBES_MAX = 11

const SCENE: ReadonlyArray<readonly [string, readonly [number, number, number]]> = [
  ['steel_sheet', [-3.3, 0, -3.3]],
  ['brick_column', [4, 0, -4]],
  ['wooden_crate', [-6, 0, 2]],
  ['concrete_block', [6, 0, 3]],
  ['shelf', [0, 0, -8]],
]

/** A module's blocker with no body in the world: a box at x 7 to 8, z -1 to 1 (a house's wall, in the modules). */
const wallModule: TestableModule<ScenarioContext> = {
  id: 'wall_probe',
  name: 'Wall probe',
  group: 'Probe',
  items: () => [],
  area: () => ({ placements: [], view: { eye: [0, 2, 4], target: [0, 0, 0] } }),
  attach(host) {
    return host.addBlocker?.((x, z, radius) => x > 7 - radius && x < 8 + radius && z > -1 - radius && z < 1 + radius) ?? (() => undefined)
  },
}

const arenaOf = (physics: ReturnType<typeof createPhysicsLoop> | PhysicsWorld): TestRoom => {
  const room = makeRoom({ catalog: demoItems('en'), physics })
  room.loadModule(wallModule)
  for (const [id, at] of SCENE) room.spawn(id, [at[0], at[1], at[2]], 0)
  for (let frame = 0; frame < 30; frame++) room.update(1 / 60)
  return room
}

/** Whether the room's own walk stops a body that comes to (x, z) from 0.4 m to the west of it. */
const stopsByItself = (room: TestRoom, x: number, z: number): boolean => {
  room.look([x - 0.4, 1.7, z], [x, 1.7, z])
  const start = room.playerPosition
  room.walk([x, 0, z], 0)
  return Math.hypot(room.playerPosition[0] - x, room.playerPosition[2] - z) > 0.05 || Math.hypot(start[0] - x, start[2] - z) < 0.05
}

const probes = (): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let x = GRID.from; x <= GRID.to; x += GRID.step) for (let z = GRID.from; z <= GRID.to; z += GRID.step) out.push([x, z])
  return out
}

const hasBody = (world: PhysicsWorld, x: number, z: number): boolean =>
  world.overlapShape({ kind: 'capsule', halfHeight: 0.6, radius: 0.3 }, [x, 0.93 + 0.03, z], [0, 0, 0, 1], [], { layers: SOLID_LAYERS }) > 0

describe('what stops the player: the room on its own against the bodies of the world (spec 008, TS.9l)', () => {
  it('lists the points only the veto holds and fails when the list grows', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world))
    // a room on a world it steps itself has no walker: its walk is the room's own colliders, the walk the engine player is compared against
    const seamWorld = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const byItself = arenaOf(seamWorld)
    try {
      const bodiless = probes().filter(([x, z]) => stopsByItself(byItself, x, z) && !hasBody(world, x, z))
      expect(bodiless.length, `points held only by the veto: ${bodiless.map(([x, z]) => `${x},${z}`).join(' ')}`).toBeLessThanOrEqual(BODILESS_PROBES_MAX)
    } finally {
      engine.dispose()
      byItself.dispose()
      seamWorld.dispose()
      world.dispose()
    }
  })

  it('the engine player walking into a blocker with no body stops where the room would have stopped it', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world))
    try {
      expect(hasBody(world, 7.5, 0)).toBe(false)
      engine.look([5, 1.7, 0], [10, 1.7, 0])
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      for (let frame = 0; frame < 120; frame++) engine.update(1 / 60, { live: true })
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      expect(engine.playerPosition[0]).toBeGreaterThan(6)
      expect(engine.playerPosition[0]).toBeLessThanOrEqual(7 - 0.3 + 0.05)
    } finally {
      engine.dispose()
      world.dispose()
    }
  })
})
