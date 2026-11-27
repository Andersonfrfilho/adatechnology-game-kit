import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsWorld, RayHit } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import type { TestableModule } from '@adatechnology/game-contracts'

import type { ScenarioContext, TestRoom } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

/**
 * Spec 008, TS.9l: what stops the room's own walk against what the physics world has a body for. Where the room stops the player and the world has no body, only the veto of
 * `player-body.ts` keeps the engine player out. A blocker a module adds comes with its body (`addBlocker(blocked, solids)`): the body stops the player, and shots, debris, vehicles and blasts
 * meet it too (nothing solid without a body). The points left are the contact of the capsule with a box (the veto stops a body 0.3 m from a face, the capsule touches it there) and the corners
 * the veto's square rounds off; none is beyond the veto's own reach (`REACH`), so no obstacle is held by the veto alone.
 */

const SOLID_LAYERS = ['static', 'debris', 'prop', 'vehicle'] as const
/** Inside the arena: its edge (the limit of the world, `outside`) is the rule of the room, held by the veto alone and with no body (a wall nobody sees would send debris and cars back). */
const GRID = { from: -13, to: 13, step: 0.5 }
/** The probes where the room stops the player and the capsule of the world touches no body (spec 008, TS.9l): all are contact or corner points of the three drawn boxes; may go down, never up. */
const CONTACT_PROBES_MAX = 6
/** The probes where the room stops the player and there is no body within the veto's own reach (a square of half side 0.3, its corner at 0.3 times the root of two): none. */
const BODILESS_PROBES_MAX = 0
const PLAYER_RADIUS = 0.3
/** What closes the arena beside the target wall (x past 5 either way, z -12.1 to -10.8): invisible by design, so with no body (it is the arena's limit, like its edge); through a breach the player goes behind the wall. */
const closesArena = (x: number, z: number): boolean => Math.abs(x) >= 5 - PLAYER_RADIUS && z <= -10.8 + PLAYER_RADIUS && z >= -12.1 - PLAYER_RADIUS
const REACH = PLAYER_RADIUS * Math.SQRT2 + 0.01

const SCENE: ReadonlyArray<readonly [string, readonly [number, number, number]]> = [
  ['steel_sheet', [-3.3, 0, -3.3]],
  ['brick_column', [4, 0, -4]],
  ['wooden_crate', [-6, 0, 2]],
  ['concrete_block', [6, 0, 3]],
  ['shelf', [0, 0, -8]],
]

const WALL_BODY = [{ center: [7.5, 1, 0], half: [0.5, 1, 1] }] as const

/** A module's blocker: a box at x 7 to 8, z -1 to 1 (a house's wall, in the modules), with its body in the world or, `bodiless`, with the veto alone (a host that gives none); `none` adds no blocker. */
const wallModule = (kind: 'bodied' | 'bodiless' | 'none' = 'bodied'): TestableModule<ScenarioContext> => ({
  id: 'wall_probe',
  name: 'Wall probe',
  group: 'Probe',
  items: () => [],
  area: () => ({ placements: [], view: { eye: [0, 2, 4], target: [0, 0, 0] } }),
  attach(host) {
    if (kind === 'none') return () => undefined
    return host.addBlocker?.((x, z, radius) => x > 7 - radius && x < 8 + radius && z > -1 - radius && z < 1 + radius, kind === 'bodied' ? () => WALL_BODY : undefined) ?? (() => undefined)
  },
})

const arenaOf = (physics: ReturnType<typeof createPhysicsLoop> | PhysicsWorld, kind: 'bodied' | 'bodiless' | 'none' = 'bodied'): TestRoom => {
  const room = makeRoom({ catalog: demoItems('en'), physics })
  room.loadModule(wallModule(kind))
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

const hasBody = (world: PhysicsWorld, x: number, z: number, radius = PLAYER_RADIUS): boolean =>
  world.overlapShape({ kind: 'capsule', halfHeight: 0.6, radius }, [x, 0.93 + 0.03, z], [0, 0, 0, 1], [], { layers: SOLID_LAYERS }) > 0

describe('what stops the player: the room on its own against the bodies of the world (spec 008, TS.9l)', () => {
  it('lists the points only the veto holds and fails when the list grows', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world))
    // a room on a world it steps itself has no walker: its walk is the room's own colliders, the walk the engine player is compared against
    const seamWorld = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const byItself = arenaOf(seamWorld)
    try {
      const held = probes().filter(([x, z]) => stopsByItself(byItself, x, z))
      const touching = held.filter(([x, z]) => !hasBody(world, x, z) && !closesArena(x, z))
      const bodiless = touching.filter(([x, z]) => !hasBody(world, x, z, REACH))
      expect(bodiless.length, `points held only by the veto: ${bodiless.map(([x, z]) => `${x},${z}`).join(' ')}`).toBeLessThanOrEqual(BODILESS_PROBES_MAX)
      expect(touching.length, `points the capsule only touches: ${touching.map(([x, z]) => `${x},${z}`).join(' ')}`).toBeLessThanOrEqual(CONTACT_PROBES_MAX)
    } finally {
      engine.dispose()
      byItself.dispose()
      seamWorld.dispose()
      world.dispose()
    }
  })

  it('a blocker with no body (a host that gives none) is still held by the veto: the engine player stops where the room would have stopped it', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world), 'bodiless')
    try {
      expect(hasBody(world, 7.5, 0)).toBe(false)
      expect(walkEastInto(engine)).toBeLessThanOrEqual(7 - 0.3 + 0.05)
    } finally {
      engine.dispose()
      world.dispose()
    }
  })

  it('a blocker with its body is a body of the world: a ray hits it, debris rests on its top, the engine player stops at the body', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world))
    try {
      expect(hasBody(world, 7.5, 0)).toBe(true)
      const hits: RayHit[] = []
      expect(world.sphereCastAll([5, 1, 0], [1, 0, 0], 6, 0.01, hits, { layers: ['static'] })).toBeGreaterThan(0)
      expect(hits[0]?.distance).toBeCloseTo(2, 1)
      const crate = world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 5, position: [7.5, 4, 0], layer: 'debris', user: 900_001 })
      for (let frame = 0; frame < 180; frame++) engine.update(1 / 60, { live: true })
      const pose = new Float64Array(7)
      world.readPose(crate, pose, 0)
      expect(pose[1]).toBeCloseTo(2.2, 1)
      expect(walkEastInto(engine)).toBeLessThanOrEqual(7 - 0.3 + 0.05)
    } finally {
      engine.dispose()
      world.dispose()
    }
  })

  it('the post of the tap is a body of the world: a ray along the floor of the room hits it', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world))
    try {
      const hits: RayHit[] = []
      expect(world.sphereCastAll([4.65, 1, 1.5], [0, 0, -1], 3, 0.01, hits, { layers: ['static'] })).toBeGreaterThan(0)
      expect(hits[0]?.distance).toBeCloseTo(1.46, 1)
    } finally {
      engine.dispose()
      world.dispose()
    }
  })

  it('a vehicle body stops the engine player (the walker sweeps ignore a car, its capsule does not): the player stops at its side and walks on once it is gone', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world), 'none')
    try {
      const car = world.createBody({ shape: { kind: 'box', half: [0.5, 0.8, 1] }, motion: 'dynamic', mass: 1500, position: [7.5, 0.8, 0], layer: 'vehicle', user: 900_002 })
      for (let frame = 0; frame < 10; frame++) engine.update(1 / 60, { live: true })
      expect(walkEastInto(engine)).toBeLessThanOrEqual(7 - 0.3 + 0.05)
      world.removeBody(car)
      engine.look([5, 1.7, 0], [10, 1.7, 0])
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
      for (let frame = 0; frame < 120; frame++) engine.update(1 / 60, { live: true })
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
      expect(engine.playerPosition[0]).toBeGreaterThan(8)
    } finally {
      engine.dispose()
      world.dispose()
    }
  })

  it('the body goes with the blocker: the module taken away, it leaves the world', { timeout: 120000 }, async () => {
    const world = (await createJoltEngine()).createWorld({ ...KIT_WORLD })
    const engine = arenaOf(createPhysicsLoop(world))
    try {
      expect(hasBody(world, 7.5, 0)).toBe(true)
      engine.loadModule(wallModule('none'))
      for (let frame = 0; frame < 5; frame++) engine.update(1 / 60, { live: true })
      expect(hasBody(world, 7.5, 0)).toBe(false)
    } finally {
      engine.dispose()
      world.dispose()
    }
  })
})

/** The engine player walks east for two seconds from x = 5 and says where the feet stand. */
const walkEastInto = (engine: TestRoom): number => {
  engine.look([5, 1.7, 0], [10, 1.7, 0])
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }))
  for (let frame = 0; frame < 120; frame++) engine.update(1 / 60, { live: true })
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }))
  expect(engine.playerPosition[0]).toBeGreaterThan(6)
  return engine.playerPosition[0]
}
