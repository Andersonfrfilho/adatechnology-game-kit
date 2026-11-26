import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { BodyId, Vec3 } from '@adatechnology/game-physics'
import { KIT_WORLD } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'

import { createCrashParts, createHullPlanCache, createVehicleColliders, holdWithin } from '../src'
import type { BodyMass, CrashParts, VehicleColliders } from '../src'
import { build } from './vehicle-colliders-support'

const MODEL = 'family_hatch'
const MAX_HULLS = 256
const STEP = KIT_WORLD.fixedStep ?? 1 / 120

interface Scene {
  readonly world: JoltWorld
  readonly vehicle: ReturnType<typeof build>['vehicle']
  readonly frame: THREE.Object3D
  readonly colliders: VehicleColliders
  /** The hulls the car was made with (before its frame was put on the ground). */
  readonly initial: readonly object[]
  readonly parts: CrashParts
  readonly chassis: BodyId
  readonly totalMass: number
  readonly dispose: () => void
}

const sceneOf = async (id = MODEL, options: { readonly cache?: ReturnType<typeof createHullPlanCache>; readonly at?: Vec3 } = {}): Promise<Scene> => {
  const world = (await createJoltEngine()).createWorld(KIT_WORLD) as JoltWorld
  world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const { vehicle, frame, dispose } = build(id)
  const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls: MAX_HULLS, ...(options.cache ? { planCache: options.cache } : {}) })
  colliders.pieces()
  const initial = colliders.hulls()
  const totalMass = vehicle.model.parts.reduce((sum, part) => sum + part.mass, 0)
  const parts = createCrashParts({ THREE, world, vehicle, frame, colliders, mass: { mass: totalMass, centre: [0, 0.5, 0], inertia: [totalMass * 0.4, totalMass * 0.8, totalMass * 0.9] } })
  const at = options.at ?? [0, 0.02, 0]
  const chassis = world.createBody({ shape: parts.shape(), motion: 'dynamic', mass: totalMass, inertia: [totalMass * 0.4, totalMass * 0.8, totalMass * 0.9], position: at, layer: 'vehicle', user: 1 })
  parts.bind(chassis)
  frame.position.set(...at)
  frame.updateMatrixWorld(true)
  return { world, vehicle, frame, colliders, initial, parts, chassis, totalMass, dispose: () => { parts.dispose(); world.dispose(); dispose() } }
}

/** One fixed step, the drawing's frame onto the chassis, then the parts' turn (their holders sit under that frame). */
const advance = (scene: Scene, steps: number): void => {
  const pose = new Float64Array(7)
  for (let i = 0; i < steps; i++) {
    scene.world.step(STEP)
    scene.world.readPose(scene.chassis, pose, 0)
    scene.frame.position.set(pose[0]!, pose[1]!, pose[2]!)
    scene.frame.quaternion.set(pose[3]!, pose[4]!, pose[5]!, pose[6]!)
    scene.frame.updateMatrixWorld(true)
    scene.parts.step()
  }
}

const unbolt = (scene: Scene, partId: string): void => {
  const joint = scene.vehicle.model.joints.find((candidate) => candidate.a === partId)!
  expect(scene.vehicle.disassemble!(joint.id, joint.tools[0]!, joint.seconds)).toBe(1)
}

const doorOf = (scene: Scene): string => scene.vehicle.model.parts.find((part) => part.role === 'door' && part.visual)!.id

describe('T6.9: parts come off as bodies (design 11)', () => {
  it('the part that comes off takes its mass and its hulls, and the chassis loses them (the sum is the kit\'s)', async () => {
    const scene = await sceneOf()
    const { world, parts, chassis, vehicle } = scene
    const door = vehicle.model.parts.find((part) => part.id === doorOf(scene))!
    const before = parts.mass()
    const childrenBefore = parts.stats().children
    expect(world.massOf(chassis)).toBeCloseTo(scene.totalMass, 3)
    unbolt(scene, door.id)
    const bodies = parts.partBodies()
    const body = bodies.get(door.id)!
    expect(body).toBeDefined()
    // what the drawing shows with the door goes with it (its glass, its handle): each is a body, each took its own mass
    const went = [...bodies.keys()].map((id) => vehicle.model.parts.find((part) => part.id === id)!)
    expect(parts.stats().released).toBe(went.length)
    expect(parts.stats().children).toBeLessThan(childrenBefore)
    const leftOf = (mass: number): number => went.reduce((sum, part) => sum - part.mass, mass)
    for (const part of went) expect(world.massOf(bodies.get(part.id)!)).toBeCloseTo(part.mass, 6)
    expect(parts.mass().mass).toBeCloseTo(leftOf(before.mass), 6)
    expect(world.massOf(chassis)).toBeCloseTo(leftOf(scene.totalMass), 3)
    // the whole is what it was: mass, first moment and moments about the first centre are the rest's and the parts' together
    const first = { mass: scene.totalMass, centre: [0, 0.5, 0] as Vec3, inertia: [scene.totalMass * 0.4, scene.totalMass * 0.8, scene.totalMass * 0.9] as Vec3 }
    const rest = parts.mass()
    const own = [...parts.partNumbers().values()]
    for (let k = 0; k < 3; k++) {
      expect(rest.mass * rest.centre[k]! + own.reduce((sum, part) => sum + part.mass * part.centre[k]!, 0)).toBeCloseTo(first.mass * first.centre[k]!, 6)
      const about = (mass: BodyMass): number => {
        const d = [0, 1, 2].map((j) => mass.centre[j]! - first.centre[j]!)
        return mass.inertia[k]! + mass.mass * (d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2 - d[k]! ** 2)
      }
      expect(about(rest) + own.reduce((sum, part) => sum + about(part), 0)).toBeCloseTo(first.inertia[k]!, 4)
    }
    expect(rest.inertia.every((moment) => moment > 0)).toBe(true)
    scene.dispose()
  }, 120000)
})

const releaseAll = (scene: Scene): void => {
  for (const joint of scene.vehicle.model.joints) if (joint.tools.length > 0) scene.vehicle.disassemble!(joint.id, joint.tools[0]!, joint.seconds)
}

describe('T6.9: what the part does once it is a body', () => {
  it('the drawing follows the body, falls and rests; nothing is flung', async () => {
    const scene = await sceneOf()
    const { vehicle, parts, world } = scene
    const door = doorOf(scene)
    const mesh = vehicle.objectsOf(door)[0]!
    unbolt(scene, door)
    const holder = mesh.parent!
    expect((vehicle.vehicle as unknown as { flying?: unknown[] }).flying ?? []).toHaveLength(0)
    const id = parts.partBodies().get(door)!
    const pose = new Float64Array(7)
    const where = new THREE.Vector3()
    holder.getWorldPosition(where)
    const startedAt = where.y
    advance(scene, 30)
    world.readPose(id, pose, 0)
    holder.updateWorldMatrix(true, false)
    holder.getWorldPosition(where)
    // the drawn holder sits where its body is, and it has begun to fall
    expect(where.distanceTo(new THREE.Vector3(pose[0], pose[1], pose[2]))).toBeLessThan(1e-4)
    expect(where.y).toBeLessThan(startedAt - 0.01)
    advance(scene, 600)
    expect([...parts.partBodies().values()].every((body) => world.isSleeping(body))).toBe(true)
    scene.dispose()
  }, 120000)

  it('nothing is born inside the ground: every part of a car sunk 4 cm is out of it when its body is made', async () => {
    const scene = await sceneOf(MODEL, { at: [0, -0.04, 0] })
    const { world, parts } = scene
    releaseAll(scene)
    const out = new Float64Array(3)
    expect(parts.partBodies().size).toBeGreaterThan(5)
    for (const body of parts.partBodies().values()) expect(world.penetration(body, out)).toBeLessThanOrEqual(0.003)
    expect(parts.stats().pushedOut).toBeGreaterThan(0)
    scene.dispose()
  }, 120000)
})

describe('design 10.5: a hull touching something moves in, and out only by the slop', () => {
  const box = (half: number): Float32Array => Float32Array.from([-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].flatMap((z) => [x * half, y * half, z * half]))))
  it('points past the old hull are brought back to the slop; points inside are left', () => {
    const old = box(1)
    const grown = box(1.01)
    const held = holdWithin(old, grown, 0.002)
    for (const value of held) expect(Math.abs(value)).toBeLessThanOrEqual(1.002 + 1e-5)
    const shrunk = box(0.9)
    expect(holdWithin(old, shrunk, 0.002)).toBe(shrunk)
    const mixed = Float32Array.from([...box(0.9).slice(0, 12), ...box(1.1).slice(12)])
    const heldMixed = holdWithin(old, mixed, 0.002)
    for (let i = 0; i < 12; i++) expect(heldMixed[i]).toBe(mixed[i])
    for (const value of heldMixed) expect(Math.abs(value)).toBeLessThanOrEqual(1.002 + 1e-5)
  })
  it('a hull that is not a solid is not held', () => {
    const flat = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0])
    const next = Float32Array.from([0, 0, 0.5, 1, 0, 0.5, 0, 1, 0.5, 1, 1, 0.5])
    expect(holdWithin(flat, next, 0.002)).toBe(next)
  })
})

describe('T6.9: the level-2 damage comes from the engine\'s contact rows, by the tag of the hull', () => {
  it('a car into a wall: the rows name the front parts, they are dented, the hulls are made again at rest', async () => {
    const scene = await sceneOf(MODEL, { at: [0, 0.02, -8] })
    const { world, parts, chassis, vehicle } = scene
    world.createBody({ shape: { kind: 'box', half: [6, 2, 0.5] }, motion: 'static', position: [0, 2, 4], user: -1 })
    world.setVelocity(chassis, [0, 0, 15], [0, 0, 0])
    advance(scene, 1200)
    const crashed = parts.stats().settles
    advance(scene, 600)
    const stats = parts.stats()
    expect(stats.settles - crashed).toBeLessThanOrEqual(Math.ceil(600 / 30))
    expect(stats.blows).toBeGreaterThan(0)
    expect(stats.events).toBeGreaterThan(0)
    const front = [...stats.hitParts].map((id) => vehicle.model.parts.find((part) => part.id === id)!.role)
    expect(front.some((role) => role === 'bumper' || role === 'hood' || role === 'fender' || role === 'light')).toBe(true)
    expect(stats.settles).toBeGreaterThan(0)
    expect(stats.remade).toBeGreaterThan(0)
    expect(stats.unplaced).toBe(0)
    console.log(JSON.stringify({ name: 'crash-parts-wall', blows: stats.blows, events: stats.events, hitParts: [...stats.hitParts], settles: stats.settles, remade: stats.remade, held: stats.held }))
    scene.dispose()
  }, 240000)
})

describe('T6.9: the hulls come from the cache of the model, and a damaged car comes out of it', () => {
  it('two cars of a model are given the cache\'s hulls; the one that crashes makes its own, and the next car still gets the shared ones', async () => {
    const cache = createHullPlanCache()
    const same = (a: readonly object[], b: readonly object[]): boolean => a.length === b.length && a.every((hull, index) => hull === b[index])
    const first = await sceneOf(MODEL, { cache })
    const second = await sceneOf(MODEL, { cache })
    const shared = second.initial
    expect(same(first.initial, shared)).toBe(true)
    expect(cache.stats()).toMatchObject({ models: 1, planned: 1, reused: 1 })
    first.world.createBody({ shape: { kind: 'box', half: [6, 2, 0.5] }, motion: 'static', position: [0, 2, 4], user: -1 })
    first.world.setVelocity(first.chassis, [0, 0, 15], [0, 0, 0])
    first.frame.position.set(0, 0.02, -8)
    first.world.setPose(first.chassis, [0, 0.02, -8], [0, 0, 0, 1], true)
    advance(first, 1200)
    expect(first.parts.stats().remade).toBeGreaterThan(0)
    expect(first.colliders.hulls().filter((hull, index) => hull !== shared[index]).length).toBeGreaterThan(0)
    const third = await sceneOf(MODEL, { cache })
    expect(same(third.initial, shared)).toBe(true)
    expect(cache.stats()).toMatchObject({ models: 1, planned: 1, reused: 2 })
    for (const scene of [first, second, third]) scene.dispose()
  }, 240000)
})

describe('T6.9: heap in cycle (CLAUDE.md 8)', () => {
  /** A car made, every part let go, thrown away: how many parts went, and the heap before the car and after it (two steps later, when the broadphase lets go of what the removals left). */
  const cycle = (world: JoltWorld): { released: number; before: number; after: number } => {
    const { vehicle, frame, dispose } = build(MODEL)
    const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls: MAX_HULLS })
    colliders.pieces()
    colliders.hulls()
    const total = vehicle.model.parts.reduce((sum, part) => sum + part.mass, 0)
    const numbers = { mass: total, centre: [0, 0.5, 0] as Vec3, inertia: [total * 0.4, total * 0.8, total * 0.9] as Vec3 }
    const childrenBefore = colliders.hulls().length
    const before = world.memoryInUse()
    const parts = createCrashParts({ THREE, world, vehicle, frame, colliders, mass: numbers })
    const chassis = world.createBody({ shape: parts.shape(), motion: 'dynamic', mass: total, inertia: numbers.inertia, position: [0, 0.02, 0], layer: 'vehicle', user: 1 })
    parts.bind(chassis)
    releaseAll({ vehicle } as Scene)
    for (let i = 0; i < 120; i++) {
      world.step(STEP)
      parts.step()
    }
    const released = parts.stats().released
    expect(released).toBeGreaterThan(10)
    expect(parts.stats().children).toBeLessThan(childrenBefore)
    world.removeBody(chassis)
    parts.dispose()
    world.step(STEP)
    world.step(STEP)
    const after = world.memoryInUse()
    dispose()
    return { released, before, after }
  }

  it('a car that loses every part and is taken away hands the heap back, but for the 8 bytes a `SetShape` of jolt-physics 1.1.1 leaves', async () => {
    const world = (await createJoltEngine()).createWorld(KIT_WORLD) as JoltWorld
    world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
    // the first car is the warm-up pass (buffers the engine makes once)
    cycle(world)
    const { released, before, after } = cycle(world)
    // the heap comes back to the byte; what may stay is 8 bytes for each `SetShape` of the centre of mass (the bind and each part that left)
    expect((after - before) % 8).toBe(0)
    expect(after - before).toBeLessThanOrEqual(8 * (released + 1))
    console.log(JSON.stringify({ name: 'crash-parts-heap', released, residueBytes: after - before }))
    world.dispose()
  }, 120000)
})
