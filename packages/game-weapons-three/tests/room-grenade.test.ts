import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { kitOriginOf } from '@adatechnology/game-contracts'
import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId, Layer, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import { createArsenal } from '@adatechnology/game-weapons'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'

import { projectileModel } from '../src/projectile-model'

/** The owner's rule for the drawn grenade (2026-11-26): 95% of 100 seeded throws rest within 6.5 s and 8 m, none past 8 s or 10 m; no damping. */
const REST_LIMIT_S = 6.5
const REACH_LIMIT_M = 8
const REST_CEILING_S = 8
const REACH_CEILING_M = 10
const QUANTILE = 0.95
const THROWS = 100
const FIRST_SEED = 400
const STEP = 1 / 60
/** Every layer but the fixed ground (tiles come and go with the bodies the ground follows): what a thrown piece or a casing is made of. */
const MOVING_LAYERS: readonly Layer[] = ['debris', 'prop', 'character', 'agent', 'vehicle', 'corpse']
/** A fuse the throw never reaches: the test reads the rest of the grenade, the fuse is not the subject. */
const LONG_FUSE = 120
/** The speed of the calibration throws of the owner's rule (10 to 12 m/s), and the pitch that rises about 4 m/s at it. */
const THROW_SPEED = 11

const stubRenderer = (): THREE.WebGLRenderer =>
  ({ domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined }) as unknown as THREE.WebGLRenderer

const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const roomOf = async () => {
  const engine = await createJoltEngine()
  const world: PhysicsWorld = engine.createWorld({ ...KIT_WORLD })
  const arsenal = createArsenal({ patch: { explosives: { m67: { fuse: LONG_FUSE } }, weapons: { frag_grenade: { action: { throwSpeed: THROW_SPEED } } } }, rules: { explosives: { placeFuseFrom: LONG_FUSE * 2 } }, seed: 1 })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const room = createTestRoom({
    THREE,
    container,
    locale: 'en',
    catalog: [],
    renderer: stubRenderer(),
    ui: false,
    arsenal,
    physics: createPhysicsLoop(world),
    projectileModel: (query) => projectileModel(THREE, query),
  })
  return { room, world }
}

const movingBodies = (world: PhysicsWorld): number => {
  const found: BodyId[] = []
  return world.overlapShape({ kind: 'box', half: [500, 200, 500] }, [0, 0, 0], [0, 0, 0, 1], found, { layers: MOVING_LAYERS })
}

const grenadeIn = (room: TestRoom): THREE.Object3D | undefined => {
  let found: THREE.Object3D | undefined
  room.scene.traverse((object) => {
    if (!found && kitOriginOf(object)?.kind === 'explosive') found = object
  })
  return found
}

const throwAt = (room: TestRoom, seed: number): THREE.Object3D => {
  const next = seeded(seed)
  room.look([0, 1.5, 5], [(next() - 0.5) * 2, 1.5 + 3 + next() * 3, 5 - 10 - next() * 2])
  for (let frame = 0; frame < 120 && !grenadeIn(room); frame++) {
    if (frame % 20 === 0) room.use()
    room.update(STEP)
  }
  const grenade = grenadeIn(room)
  if (!grenade) throw new Error('no grenade in the scene')
  return grenade
}

/** Frames until the pose is the very same, bit for bit, for a second: what an asleep body does. */
const REST_FRAMES = 60

const flyToRest = (room: TestRoom, grenade: THREE.Object3D): { restS: number; reachM: number } => {
  let landing: THREE.Vector3 | undefined
  let frozen = 0
  const last = new THREE.Vector3().copy(grenade.position)
  for (let frame = 1; frame <= 12 / STEP; frame++) {
    room.update(STEP)
    if (!landing && grenade.position.y < 0.1) landing = grenade.position.clone()
    frozen = grenade.position.equals(last) ? frozen + 1 : 0
    last.copy(grenade.position)
    if (frozen >= REST_FRAMES) return { restS: (frame - REST_FRAMES) * STEP, reachM: landing ? Math.hypot(grenade.position.x - landing.x, grenade.position.z - landing.z) : Infinity }
  }
  return { restS: Infinity, reachM: Infinity }
}

describe('the grenade of the room in the engine (spec 008, TS.5)', () => {
  it('100 seeded throws of the room: 95% rest within 6.5 s and 8 m, none past 8 s or 10 m, with no damping', { timeout: 900000 }, async () => {
    const { room, world } = await roomOf()
    room.setTool('frag_grenade')
    for (let frame = 0; frame < 30; frame++) room.update(STEP)
    const baseline = movingBodies(world)
    const results: { restS: number; reachM: number }[] = []
    for (let seed = FIRST_SEED; seed < FIRST_SEED + THROWS; seed++) {
      const grenade = throwAt(room, seed)
      expect(movingBodies(world)).toBe(baseline + 1)
      results.push(flyToRest(room, grenade))
      room.clear()
      expect(movingBodies(world)).toBe(baseline)
      room.setTool('frag_grenade')
      for (let frame = 0; frame < 40; frame++) room.update(STEP)
    }
    const within = results.filter((result) => result.restS <= REST_LIMIT_S && result.reachM <= REACH_LIMIT_M).length
    const restMax = Math.max(...results.map((result) => result.restS))
    const reachMax = Math.max(...results.map((result) => result.reachM))
    console.info(`[TS.5] grenade of the room ${JSON.stringify({ within, restMax, reachMax, restQ95: [...results].map((r) => r.restS).sort((a, b) => a - b)[94], reachQ95: [...results].map((r) => r.reachM).sort((a, b) => a - b)[94] })}`)
    expect(within / THROWS).toBeGreaterThanOrEqual(QUANTILE)
    expect(restMax).toBeLessThanOrEqual(REST_CEILING_S)
    expect(reachMax).toBeLessThanOrEqual(REACH_CEILING_M)
    room.dispose()
    expect(movingBodies(world)).toBe(0)
    world.dispose()
  })
})
