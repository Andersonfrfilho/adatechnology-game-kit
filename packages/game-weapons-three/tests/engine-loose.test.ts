import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { Material, PhysicsWorld } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { LOOSE_ROLLING_RESISTANCE, casingCollider, dropLoose, explosiveCollider, spawnLoose, syncLoose } from '../src/engine-loose'
import type { LooseBody, LooseCollider } from '../src/engine-loose'
import { createParticles } from '../src/fx/particles'
import { buildExplosiveModel } from '../src/models/explosives'

/** `scene` makes the floor and nothing else: the bodies a world holds when no loose piece is left. */
const FLOOR_BODIES = 1

/** The owner's limit for a drawn grenade (2026-11-27, honest physics): the engine has no turn cap, so a rolling grenade runs up to 3 m/s and a smooth ball's 5 s does not apply. No artificial damping. */
const GRENADE_REST_LIMIT_S = 7
const GRENADE_REACH_LIMIT_M = 8
/** Distribution rule (owner, 2026-11-27): 95% of 100 seeded throws within both limits, and a hard ceiling for the grenade that never stops. */
const GRENADE_QUANTILE = 0.95
const GRENADE_THROWS = 100
const GRENADE_FIRST_SEED = 400
const GRENADE_REST_CEILING_S = 8
const GRENADE_REACH_CEILING_M = 10.5

const H = KIT_WORLD.fixedStep ?? 1 / 120
const STEPS_PER_SECOND = Math.round(1 / H)

/** The ground the destruction world lays under the loose pieces (`engine-pieces.ts` GROUND): a dead floor with the kit's rolling resistance. */
const KIT_GROUND = { frictionStatic: 0.7, frictionDynamic: 0.6, restitution: 0, rolling: LOOSE_ROLLING_RESISTANCE } as const

/** Deterministic [0, 1) stream (mulberry32): a seed is a throw anyone can repeat. */
const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

const scene = async (withWall = false, ground: Material = KIT_GROUND) => {
  const engine = await createJoltEngine()
  const world: PhysicsWorld = engine.createWorld(KIT_WORLD)
  world.createBody({ shape: { kind: 'box', half: [60, 0.5, 60] }, motion: 'static', position: [0, -0.5, 0], material: ground, user: -1 })
  if (withWall) world.createBody({ shape: { kind: 'box', half: [0.1, 1, 3] }, motion: 'static', position: [8, 1, 0], material: { ...KIT_GROUND, restitution: 0.4 }, user: -2 })
  return { world, loop: createPhysicsLoop(world) }
}

const launch = (position: [number, number, number], velocity: [number, number, number], spin: [number, number, number] = [0, 0, 0]) => ({
  position: new THREE.Vector3(...position),
  rotation: new THREE.Quaternion(),
  velocity: new THREE.Vector3(...velocity),
  spin: new THREE.Vector3(...spin),
})

const report = (label: string, data: Record<string, unknown>): void => {
  console.info(`[T4.3] ${label} ${JSON.stringify(data)}`)
}

describe('the M67 as drawn, in the engine (spec 008 T4.3, gate 0 B2)', () => {
  it('has a collider of the three parts the gallery draws, rolling at C_rr 0.015', () => {
    const collider = explosiveCollider(THREE, 'm67')
    expect(collider?.rolling).toMatchObject({ coefficient: LOOSE_ROLLING_RESISTANCE, radius: 0.032 })
    expect(LOOSE_ROLLING_RESISTANCE).toBe(0.015)
    expect(collider?.shape.kind).toBe('compound')
    if (collider?.shape.kind !== 'compound') throw new Error('not a compound')
    expect(collider.shape.children.map((child) => child.shape.kind)).toEqual(['sphere', 'cylinder', 'box'])
    expect(explosiveCollider(THREE, 'c4')).toBeUndefined()
  })

  it('is the drawn model: the body, the fuze and the spoon (tilt sign included) sit where the model draws them', () => {
    const model = buildExplosiveModel(THREE, 'm67')
    const collider = explosiveCollider(THREE, 'm67')
    if (!model || collider?.shape.kind !== 'compound') throw new Error('no model')
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    const centre = box.getCenter(new THREE.Vector3())
    const [sphere, fuze, spoon] = collider.shape.children
    if (!sphere || !fuze || !spoon) throw new Error('missing part')
    expect(sphere.position[1]).toBeCloseTo(0.032 - centre.y, 6)
    // the collider's lowest point is the model's lowest point (the underside of the body)
    expect(sphere.position[1] - 0.032).toBeCloseTo(box.min.y - centre.y, 6)

    const drawn = (type: string): THREE.Mesh => {
      let found: THREE.Mesh | undefined
      model.traverse((node) => {
        if (!found && node instanceof THREE.Mesh && node.geometry.type === type) found = node
      })
      if (!found) throw new Error(`no ${type} in the model`)
      return found
    }
    const place = (mesh: THREE.Mesh) => ({ at: mesh.getWorldPosition(new THREE.Vector3()).sub(centre), turn: mesh.getWorldQuaternion(new THREE.Quaternion()) })
    const drawnFuze = place(drawn('CylinderGeometry'))
    expect(fuze.position[0]).toBeCloseTo(drawnFuze.at.x, 6)
    expect(fuze.position[1]).toBeCloseTo(drawnFuze.at.y, 6)
    expect(fuze.position[2]).toBeCloseTo(drawnFuze.at.z, 6)
    const drawnSpoon = place(drawn('BoxGeometry'))
    expect(spoon.position[0]).toBeCloseTo(drawnSpoon.at.x, 6)
    expect(spoon.position[1]).toBeCloseTo(drawnSpoon.at.y, 6)
    expect(spoon.position[2]).toBeCloseTo(drawnSpoon.at.z, 6)
    const [qx, qy, qz, qw] = spoon.rotation ?? [0, 0, 0, 1]
    expect(qz * drawnSpoon.turn.z).toBeGreaterThan(0)
    expect(Math.abs(qz)).toBeCloseTo(Math.abs(drawnSpoon.turn.z), 6)
    expect(qx).toBeCloseTo(drawnSpoon.turn.x, 6)
    expect(qy).toBeCloseTo(drawnSpoon.turn.y, 6)
    expect(qw).toBeCloseTo(drawnSpoon.turn.w, 6)
  })

  const throwGrenade = async (wall: boolean, speed = 11, rise = 4, spin = 0, seed?: number) => {
    const { world, loop } = await scene(wall)
    const collider = explosiveCollider(THREE, 'm67') as LooseCollider
    const start: [number, number, number] = wall ? [0, 1.6, 0] : [0, 1.5, 5]
    const launched = launch(start, wall ? [9, 4, 0.5] : [0, rise, speed], wall ? [0, 0, -8] : [spin, 0, 0])
    if (seed !== undefined) {
      const next = seeded(seed)
      launched.rotation.set(next() - 0.5, next() - 0.5, next() - 0.5, next() - 0.5).normalize()
      launched.velocity.set((next() - 0.5) * 2, 3 + next() * 2, 10 + next() * 2)
      launched.spin.set((next() - 0.5) * 12, (next() - 0.5) * 12, (next() - 0.5) * 12)
    }
    const body = spawnLoose(world, collider, launched)
    const object = new THREE.Object3D()
    let landing: THREE.Vector3 | undefined
    let restAt = -1
    let lowest = Infinity
    for (let i = 0; i < 12 * STEPS_PER_SECOND && restAt < 0; i++) {
      loop.stepFixed(1)
      syncLoose(world, body, object)
      lowest = Math.min(lowest, object.position.y)
      if (!landing && world.touching(body.id)) landing = object.position.clone()
      if (world.isSleeping(body.id)) restAt = (i + 1) * H
    }
    const end = object.position.clone()
    world.dispose()
    const fromThrow = Math.hypot(end.x - start[0], end.z - start[2])
    const fromLanding = landing ? Math.hypot(end.x - landing.x, end.z - landing.z) : -1
    return { restAtS: Math.round(restAt * 100) / 100, fromThrowM: Math.round(fromThrow * 100) / 100, fromLandingM: Math.round(fromLanding * 100) / 100, lowest }
  }

  it('thrown onto the open floor comes to rest within 7 s and 8 m of where it lands', { timeout: 120000 }, async () => {
    const open = await throwGrenade(false)
    report('grenade open floor', open)
    expect(open.restAtS).toBeGreaterThan(0)
    expect(open.restAtS).toBeLessThanOrEqual(GRENADE_REST_LIMIT_S)
    expect(open.fromLandingM).toBeLessThanOrEqual(GRENADE_REACH_LIMIT_M)
    expect(open.lowest).toBeGreaterThan(0)
  })

  it('18 throws (10 / 11 / 12 m/s, rising 3 / 4 / 5 m/s, spin 0 / 6 rad/s) all rest within 7 s and 8 m: the one of the gate is not luck', { timeout: 120000 }, async () => {
    const rests: number[] = []
    const reaches: number[] = []
    for (const speed of [10, 11, 12]) for (const rise of [3, 4, 5]) for (const spin of [0, 6]) {
      const result = await throwGrenade(false, speed, rise, spin)
      rests.push(result.restAtS)
      reaches.push(result.fromLandingM)
    }
    report('grenade sweep', { restMax: Math.max(...rests), restMin: Math.min(...rests), fromLandingMax: Math.max(...reaches) })
    for (const rest of rests) {
      expect(rest).toBeGreaterThan(0)
      expect(rest).toBeLessThanOrEqual(GRENADE_REST_LIMIT_S)
    }
    expect(Math.max(...reaches)).toBeLessThanOrEqual(GRENADE_REACH_LIMIT_M)
  })

  it('100 seeded throws (seeds 400 to 499, random pose and spin): 95% rest within 7 s and 8 m, none past 8 s or 10.5 m, with no turn cap and no damping', { timeout: 600000 }, async () => {
    const rows: { seed: number; restAtS: number; fromLandingM: number }[] = []
    for (let seed = GRENADE_FIRST_SEED; seed < GRENADE_FIRST_SEED + GRENADE_THROWS; seed++) {
      const result = await throwGrenade(false, 11, 4, 0, seed)
      rows.push({ seed, restAtS: result.restAtS, fromLandingM: result.fromLandingM })
      expect(result.lowest).toBeGreaterThan(0)
    }
    // a throw that never slept in the 12 s window reads -1: it counts as past every limit
    const restOf = (row: { restAtS: number }): number => (row.restAtS > 0 ? row.restAtS : Infinity)
    const withinBoth = rows.filter((row) => restOf(row) <= GRENADE_REST_LIMIT_S && row.fromLandingM <= GRENADE_REACH_LIMIT_M).length
    const rests = rows.map(restOf).sort((a, b) => a - b)
    const reaches = rows.map((row) => row.fromLandingM).sort((a, b) => a - b)
    const quantile95 = (sorted: number[]): number => sorted[Math.ceil(0.95 * sorted.length) - 1] as number
    report('grenade seeds 400-499', {
      withinBoth, rest95: quantile95(rests), restMax: rests[rests.length - 1], reach95: quantile95(reaches), reachMax: reaches[reaches.length - 1],
      pastRest: rows.filter((row) => restOf(row) > GRENADE_REST_LIMIT_S).map((row) => row.seed),
      pastReach: rows.filter((row) => row.fromLandingM > GRENADE_REACH_LIMIT_M).map((row) => row.seed),
      rows,
    })
    expect(withinBoth).toBeGreaterThanOrEqual(Math.ceil(GRENADE_QUANTILE * GRENADE_THROWS))
    expect(rests[rests.length - 1]).toBeLessThanOrEqual(GRENADE_REST_CEILING_S)
    expect(reaches[reaches.length - 1]).toBeLessThanOrEqual(GRENADE_REACH_CEILING_M)
  })

  it('thrown against a wall 8 m off comes to rest within 7 s and 8 m of the throw', { timeout: 120000 }, async () => {
    const wall = await throwGrenade(true)
    report('grenade wall', wall)
    expect(wall.restAtS).toBeGreaterThan(0)
    expect(wall.restAtS).toBeLessThanOrEqual(GRENADE_REST_LIMIT_S)
    expect(wall.fromThrowM).toBeLessThanOrEqual(GRENADE_REACH_LIMIT_M)
    expect(wall.lowest).toBeGreaterThan(0)
  })
})

describe('casings in the engine (spec 008 T4.3, gate 0 B2)', () => {
  it('200 9 mm casings: 95% asleep 5 s after the last, none under the floor', { timeout: 120000 }, async () => {
    const { world, loop } = await scene()
    const collider = casingCollider(0.00495, 0.019)
    const bodies: LooseBody[] = []
    const object = new THREE.Object3D()
    for (let i = 0; i < 200; i++) {
      const launching = launch([10, 1.4, (i % 20) * 0.02], [4 + (i % 7) * 0.3, 2 + (i % 5) * 0.2, (i % 3) - 1], [20, 5, 0])
      bodies.push(spawnLoose(world, collider, launching))
      loop.stepFixed(2)
    }
    for (let i = 0; i < 5 * STEPS_PER_SECOND; i++) loop.stepFixed(1)
    let under = 0
    let asleep = 0
    for (const body of bodies) {
      syncLoose(world, body, object)
      if (object.position.y < 0) under++
      if (world.isSleeping(body.id)) asleep++
    }
    report('200 casings', { under, asleep })
    expect(under).toBe(0)
    expect(asleep).toBeGreaterThanOrEqual(190)
    for (const body of bodies) dropLoose(world, body)
    world.dispose()
  })
})

describe('a frame of a loose body makes nothing to collect (spec 008 review, §15)', () => {
  it('the reading of two frames, of two bodies, is the one scratch object, and still tells each frame\'s own bounce and sleep', { timeout: 60000 }, async () => {
    const { world, loop } = await scene(false, { ...KIT_GROUND, restitution: 0.6 })
    const collider = casingCollider(0.00495, 0.019)
    const first = spawnLoose(world, collider, launch([0, 1, 0], [0, 0, 0]))
    const second = spawnLoose(world, collider, launch([2, 1, 0], [0, 0, 0]))
    const object = new THREE.Object3D()
    const readings = new Set<object>()
    let bounced = false
    let asleep = false
    for (let i = 0; i < 6 * STEPS_PER_SECOND; i++) {
      loop.stepFixed(1)
      const reading = syncLoose(world, first, object)
      readings.add(reading)
      bounced ||= reading.bounceSpeed !== undefined
      asleep = reading.asleep
      readings.add(syncLoose(world, second, object))
    }
    expect(readings.size).toBe(1)
    expect(bounced).toBe(true)
    expect(asleep).toBe(true)
    world.dispose()
  })
})

describe('the gallery particles with a physics world', () => {
  it('a casing spawned with a collider is moved by the engine, bounces, rests on the floor and leaves the world with the particle', { timeout: 60000 }, async () => {
    const { world, loop } = await scene(false, { ...KIT_GROUND, restitution: 0.6 })
    const particles = createParticles(THREE, new THREE.Scene(), () => 0, undefined, undefined, world)
    const bounces: number[] = []
    particles.onBounce = (_kind, hit) => bounces.push(hit?.speed ?? 0)
    const object = new THREE.Object3D()
    object.position.set(0, 1.2, 0)
    const radius = 0.00495
    particles.spawn(object, new THREE.Vector3(1.5, 1.4, 0), { kind: 'casing', life: 99, radius, spin: new THREE.Vector3(10, 20, 5), collider: casingCollider(radius, 0.019) })
    const positions: number[] = []
    for (let i = 0; i < 6 * STEPS_PER_SECOND; i++) {
      loop.stepFixed(1)
      if (i % 2 === 0) particles.update(2 * H)
      positions.push(object.position.x)
    }
    expect(object.position.x).toBeGreaterThan(0.5)
    expect(object.position.y).toBeGreaterThan(0)
    expect(object.position.y).toBeLessThan(0.02)
    expect(bounces.length).toBeGreaterThan(0)
    expect(Math.abs(positions[positions.length - 1]! - positions[positions.length - 60]!)).toBeLessThan(1e-3)
    particles.dispose()
    expect(world.bodyCount).toBe(FLOOR_BODIES)
    expect(particles.count('casing')).toBe(0)
    world.dispose()
  })

  const casingOptions = (radius: number, life: number) => ({ kind: 'casing' as const, life, radius, collider: casingCollider(radius, 0.019) })

  it('a casing whose life runs out leaves the world with the particle, resting or flying', { timeout: 60000 }, async () => {
    const { world, loop } = await scene()
    const particles = createParticles(THREE, new THREE.Scene(), () => 0, undefined, undefined, world)
    for (const x of [0, 1]) {
      const object = new THREE.Object3D()
      object.position.set(x, 1.2, 0)
      particles.spawn(object, new THREE.Vector3(1, 1, 0), casingOptions(0.00495, 3))
    }
    expect(world.bodyCount).toBe(FLOOR_BODIES + 2)
    for (let i = 0; i < 4 * STEPS_PER_SECOND; i++) {
      loop.stepFixed(1)
      if (i % 2 === 0) particles.update(2 * H)
    }
    expect(particles.count('casing')).toBe(0)
    expect(world.bodyCount).toBe(FLOOR_BODIES)
    world.dispose()
  })

  it('a casing pushed out by the host limit takes its body with it', { timeout: 60000 }, async () => {
    const { world } = await scene()
    const particles = createParticles(THREE, new THREE.Scene(), () => 0, () => 3, undefined, world)
    for (let i = 0; i < 10; i++) {
      const object = new THREE.Object3D()
      object.position.set(i * 0.1, 1.2, 0)
      particles.spawn(object, new THREE.Vector3(0, 0, 0), casingOptions(0.00495, 99))
      expect(world.bodyCount).toBeLessThanOrEqual(FLOOR_BODIES + 3)
    }
    expect(particles.count('casing')).toBe(3)
    expect(world.bodyCount).toBe(FLOOR_BODIES + 3)
    particles.dispose()
    expect(world.bodyCount).toBe(FLOOR_BODIES)
    world.dispose()
  })

  it('without a world the particle keeps the gallery bounce (no engine needed)', () => {
    const particles = createParticles(THREE, new THREE.Scene(), () => 0)
    const object = new THREE.Object3D()
    object.position.set(0, 1, 0)
    particles.spawn(object, new THREE.Vector3(1, 0, 0), { kind: 'casing', life: 99, radius: 0.005, collider: casingCollider(0.005, 0.02) })
    for (let i = 0; i < 240; i++) particles.update(1 / 60)
    expect(object.position.y).toBeCloseTo(0.005, 3)
  })
})
