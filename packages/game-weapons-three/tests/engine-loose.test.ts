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

const H = KIT_WORLD.fixedStep ?? 1 / 120
const STEPS_PER_SECOND = Math.round(1 / H)

/** The ground the destruction world lays under the loose pieces (`engine-pieces.ts` GROUND): a dead floor with the kit's rolling resistance. */
const KIT_GROUND = { frictionStatic: 0.7, frictionDynamic: 0.6, restitution: 0, rolling: LOOSE_ROLLING_RESISTANCE } as const

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

  it('has the same centre as the drawn model: the sphere sits where the model draws it', () => {
    const model = buildExplosiveModel(THREE, 'm67')
    const collider = explosiveCollider(THREE, 'm67')
    if (!model || collider?.shape.kind !== 'compound') throw new Error('no model')
    const box = new THREE.Box3().setFromObject(model)
    const centre = box.getCenter(new THREE.Vector3())
    const sphere = collider.shape.children[0]
    expect(sphere?.position[1]).toBeCloseTo(0.032 - centre.y, 6)
    // the collider's lowest point is the model's lowest point (the underside of the body)
    expect((sphere?.position[1] ?? 0) - 0.032).toBeCloseTo(box.min.y - centre.y, 6)
  })

  const throwGrenade = async (wall: boolean, speed = 11, rise = 4, spin = 0) => {
    const { world, loop } = await scene(wall)
    const collider = explosiveCollider(THREE, 'm67') as LooseCollider
    const start: [number, number, number] = wall ? [0, 1.6, 0] : [0, 1.5, 5]
    const body = spawnLoose(world, collider, launch(start, wall ? [9, 4, 0.5] : [0, rise, speed], wall ? [0, 0, -8] : [spin, 0, 0]))
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

  it('thrown onto the open floor comes to rest within 5 s and 8 m of where it lands', { timeout: 120000 }, async () => {
    const open = await throwGrenade(false)
    report('grenade open floor', open)
    expect(open.restAtS).toBeGreaterThan(0)
    expect(open.restAtS).toBeLessThanOrEqual(5)
    expect(open.fromLandingM).toBeLessThanOrEqual(8)
    expect(open.lowest).toBeGreaterThan(0)
  })

  it('18 throws (10 / 11 / 12 m/s, rising 3 / 4 / 5 m/s, spin 0 / 6 rad/s) all rest within 5 s and 8 m: the one of the gate is not luck', { timeout: 120000 }, async () => {
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
      expect(rest).toBeLessThanOrEqual(5)
    }
    expect(Math.max(...reaches)).toBeLessThanOrEqual(8)
  })

  it('thrown against a wall 8 m off comes to rest within 5 s and 8 m of the throw', { timeout: 120000 }, async () => {
    const wall = await throwGrenade(true)
    report('grenade wall', wall)
    expect(wall.restAtS).toBeGreaterThan(0)
    expect(wall.restAtS).toBeLessThanOrEqual(5)
    expect(wall.fromThrowM).toBeLessThanOrEqual(8)
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
