import { describe, expect, it } from 'vitest'

import { createDestruction, quatFromEuler } from '../src'
import type { DestructibleImpl, DestructibleSpec, DestructionWorld, ObjectState, PartSpec, Quat, Vec3 } from '../src'

/** mulberry32: the same scene and the same queries on every run. */
const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (random: () => number, low: number, high: number): number => low + (high - low) * random()

/** A wall of bricks along x (a structure of many parts, as a house's). */
const wall = (bricks: number): DestructibleSpec => ({
  parts: Array.from({ length: bricks }, (_, index): PartSpec => ({ id: `b${index}`, material: 'concrete', shape: { kind: 'box', size: [0.5, 0.25, 0.2] }, position: [(index % 8) * 0.5, 0.125 + Math.floor(index / 8) * 0.25, 0] })),
  joints: [],
})

const PIECE_SHAPES: ReadonlyArray<PartSpec['shape']> = [
  { kind: 'box', size: [0.3, 0.2, 0.25] },
  { kind: 'sphere', radius: 0.12 },
  { kind: 'cylinder', radius: 0.08, height: 0.3 },
]

/** A hosted body (a vehicle stand-in): a few boxes, one of which the host poses. */
const hostedBody = (id: string): DestructibleImpl => {
  const spec: DestructibleSpec = {
    name: id,
    parts: [
      { id: 'cabin', material: 'steel', shape: { kind: 'box', size: [1.8, 1.2, 4] }, position: [0, 0.9, 0] },
      { id: 'door', material: 'steel', shape: { kind: 'box', size: [0.1, 0.9, 1.1] }, position: [0.95, 0.8, 0.3] },
      { id: 'wheel', material: 'rubber', shape: { kind: 'cylinder', radius: 0.35, height: 0.25 }, position: [-0.9, 0.35, 1.3], rotation: [0, 0, Math.PI / 2] },
    ],
  }
  const state = (): ObjectState => ({ id, position: [0, 0, 0], rotation: [0, 0, 0, 1], parts: [], joints: [], groups: [], destroyed: false })
  return { id, describe: () => spec, hit: () => [], update: () => [], state, reset: () => undefined, serialize: () => ({}), load: () => undefined }
}

const yaw = (radians: number): Quat => quatFromEuler(0, radians, 0)

/** Walls, loose pieces and two hosted bodies scattered over an 18 m square, the same for one seed. */
const buildScene = (seed: number, broadPhase: boolean): { world: DestructionWorld; pieces: string[] } => {
  const random = seeded(seed)
  const world = createDestruction({ seed: 3, broadPhase })
  for (let index = 0; index < 12; index++) {
    world.add(wall(16 + Math.floor(random() * 24)), { id: `wall${index}`, position: [between(random, -9, 9), 0, between(random, -9, 9)], rotation: yaw(between(random, 0, Math.PI)) })
  }
  const pieces: string[] = []
  for (let index = 0; index < 80; index++) {
    const shape = PIECE_SHAPES[index % PIECE_SHAPES.length]!
    const rotation = quatFromEuler(between(random, -1, 1), between(random, -3, 3), between(random, -1, 1))
    const id = world.add({ parts: [{ id: 'body', material: 'wood_soft', shape, position: [0, 0, 0] }], joints: [] }, { id: `piece${index}`, position: [between(random, -9, 9), between(random, 0, 2), between(random, -9, 9)], rotation })
    pieces.push(id)
  }
  world.register(hostedBody('car0'), { position: [between(random, -10, 10), 0, between(random, -10, 10)], rotation: yaw(between(random, 0, Math.PI)) })
  world.register(hostedBody('car1'), { position: [between(random, -10, 10), 0, between(random, -10, 10)], rotation: yaw(between(random, 0, Math.PI)) })
  world.setPartPose('car1', 'door', [1.5, 0.8, 0.9], [0, 1.1, 0])
  return { world, pieces }
}

interface Query {
  readonly box: { readonly min: Vec3; readonly max: Vec3 }
  readonly direction: Vec3
  readonly distance: number
  readonly options: { readonly ignore?: string; readonly spacing?: number }
}

const randomQueries = (seed: number, count: number, pieces: readonly string[]): Query[] => {
  const random = seeded(seed)
  return Array.from({ length: count }, (): Query => {
    const centre: Vec3 = [between(random, -10, 10), between(random, 0, 2.5), between(random, -10, 10)]
    const half = between(random, 0.03, 0.4)
    const direction: Vec3 = [between(random, -1, 1), between(random, -0.6, 0.6), between(random, -1, 1)]
    const ignore = random() < 0.5 ? pieces[Math.floor(random() * pieces.length)] : undefined
    return {
      box: { min: [centre[0] - half, centre[1] - half, centre[2] - half], max: [centre[0] + half, centre[1] + half, centre[2] + half] },
      direction,
      distance: between(random, 0.05, 8),
      options: { ...(ignore === undefined ? {} : { ignore }), spacing: between(random, 0.05, 0.3) },
    }
  })
}

describe('sweepBox broad phase', () => {
  it('finds exactly the hit the brute force finds, over many random sweeps among walls, pieces and hosted bodies', () => {
    for (const seed of [7, 21, 99]) {
      const broad = buildScene(seed, true)
      const brute = buildScene(seed, false)
      let hits = 0
      let saved = 0
      for (const query of randomQueries(seed * 31, 500, broad.pieces)) {
        const expected = brute.world.sweepBox(query.box, query.direction, query.distance, query.options)
        const found = broad.world.sweepBox(query.box, query.direction, query.distance, query.options)
        expect(found).toEqual(expected)
        if (expected) hits++
        saved += brute.world.sweepProbe().objectVisits - broad.world.sweepProbe().objectVisits
        expect(broad.world.sweepProbe().shapeTests).toBeLessThanOrEqual(brute.world.sweepProbe().shapeTests)
      }
      // the scene is dense enough that the comparison means something, and the broad phase does cut the work
      expect(hits).toBeGreaterThan(100)
      expect(saved).toBeGreaterThan(0)
    }
  })

  it('never tries the shapes of an object or a hosted body whose bounds the sweep does not reach', () => {
    const scene = (broadPhase: boolean): DestructionWorld => {
      const world = createDestruction({ broadPhase })
      world.add(wall(40), { id: 'near', position: [-1, 0, -3], rotation: [0, 0, 0, 1] })
      world.add(wall(40), { id: 'far', position: [20, 0, 20], rotation: [0, 0, 0, 1] })
      world.register(hostedBody('car'), { position: [-20, 0, 15], rotation: [0, 0, 0, 1] })
      return world
    }
    const box = { min: [-0.2, 0.3, -0.2] as Vec3, max: [0.2, 0.7, 0.2] as Vec3 }
    const broad = scene(true)
    const brute = scene(false)
    expect(broad.sweepBox(box, [0, 0, -1], 5)?.object).toBe('near')
    expect(brute.sweepBox(box, [0, 0, -1], 5)?.object).toBe('near')
    expect(broad.sweepProbe().shapeTested).toEqual(['near'])
    // without the broad phase every ray tries every part of the hosted body: the probe sees it
    expect(brute.sweepProbe().shapeTested).toContain('car')
    expect(broad.sweepProbe().objectVisits).toBeLessThan(brute.sweepProbe().objectVisits)
    expect(broad.sweepProbe().partVisits).toBeLessThan(brute.sweepProbe().partVisits)
  })

  it('follows an object that moves, and a part posed elsewhere: the cached bounds never keep the old place', () => {
    const world = createDestruction()
    world.add(wall(8), { id: 'wall', position: [-1, 0, -3], rotation: [0, 0, 0, 1] })
    world.add(wall(8), { id: 'mover', position: [-1, 0, -6], rotation: [0, 0, 0, 1] })
    const box = { min: [-0.2, 0.05, -0.2] as Vec3, max: [0.2, 0.2, 0.2] as Vec3 }
    expect(world.sweepBox(box, [0, 0, -1], 8)?.object).toBe('wall')
    world.setTransform('wall', [30, 0, 30], [0, 0, 0, 1])
    expect(world.sweepBox(box, [0, 0, -1], 8)?.object).toBe('mover')
    world.setTransform('mover', [30, 0, -30], [0, 0, 0, 1])
    expect(world.sweepBox(box, [0, 0, -1], 8)).toBeNull()
    world.setTransform('wall', [-1, 0, -2], [0, 0, 0, 1])
    const back = world.sweepBox(box, [0, 0, -1], 8)
    expect(back?.object).toBe('wall')
    expect(back?.distance).toBeCloseTo(1.7, 2)
    // a brick posed into the way (the object's sphere grows to take it in)
    world.setPartPose('mover', 'b0', [-30, 0.125, 29], [0, 0, 0])
    const posed = world.sweepBox(box, [0, 0, -1], 8)
    expect(posed?.object).toBe('mover')
    expect(posed?.part).toBe('b0')
  })

  it('skips the surface of a hosted body a ray misses the box of, and finds the same surface hit as the brute force', () => {
    /** A vehicle stand-in: its boxes only say where to look; the drawn surface (`surfaceRay`) is a sphere inside the cabin, and each call is counted. */
    const vehicleLike = (): DestructibleImpl & { surfaceCalls: number; shapeReads: number } => {
      const body = hostedBody('sedan')
      const counted = {
        ...body,
        surfaceCalls: 0,
        shapeReads: 0,
        describe: () => spec,
        surfaceRay: (ray: { origin: Vec3; direction: Vec3; maxDistance: number }) => {
          counted.surfaceCalls++
          const centre: Vec3 = [4, 0.9, 4]
          const offset: Vec3 = [ray.origin[0] - centre[0], ray.origin[1] - centre[1], ray.origin[2] - centre[2]]
          const b = offset[0] * ray.direction[0] + offset[1] * ray.direction[1] + offset[2] * ray.direction[2]
          const c = offset[0] ** 2 + offset[1] ** 2 + offset[2] ** 2 - 0.6 * 0.6
          const disc = b * b - c
          if (disc < 0) return null
          const t = -b - Math.sqrt(disc)
          if (t < 0 || t > ray.maxDistance) return null
          const point: Vec3 = [ray.origin[0] + ray.direction[0] * t, ray.origin[1] + ray.direction[1] * t, ray.origin[2] + ray.direction[2] * t]
          const length = Math.hypot(point[0] - centre[0], point[1] - centre[1], point[2] - centre[2])
          return { part: 'cabin', point, normal: [(point[0] - centre[0]) / length, (point[1] - centre[1]) / length, (point[2] - centre[2]) / length] as Vec3, distance: t, pathLen: 0.02 }
        },
      }
      // the parts count how often their shape is read: a ray tried against a part box reads it
      const spec: DestructibleSpec = {
        ...body.describe(),
        parts: body.describe().parts.map((part) => {
          const copy = { ...part }
          Object.defineProperty(copy, 'shape', { get: () => { counted.shapeReads++; return part.shape }, enumerable: true })
          return copy
        }),
      }
      return counted
    }
    const scene = (broadPhase: boolean): { world: DestructionWorld; sedan: ReturnType<typeof vehicleLike> } => {
      const world = createDestruction({ broadPhase })
      world.add(wall(24), { id: 'wall', position: [-2, 0, -3], rotation: [0, 0, 0, 1] })
      const sedan = vehicleLike()
      world.register(sedan, { position: [4, 0, 4], rotation: [0, 0, 0, 1] })
      world.setPartPose('sedan', 'door', [1.6, 0.8, 0.9], [0, 1.2, 0])
      // a body with no surface of its own answers by its boxes: a box the broad phase cut short would show in the hit
      world.register(hostedBody('van'), { position: [-1, 0, 6], rotation: yaw(0.7) })
      return { world, sedan }
    }
    const broad = scene(true)
    const brute = scene(false)
    const random = seeded(5)
    let surfaceHits = 0
    let boxHits = 0
    for (let index = 0; index < 1200; index++) {
      const origin: Vec3 = [between(random, -6, 10), between(random, 0, 3), between(random, -6, 10)]
      // two rays in three aim at the car or the van, so their hits are many
      const at: Vec3 = index % 3 === 0 ? [4, 0, 4] : [-1, 0, 6]
      const target: Vec3 = [at[0] + between(random, -2.5, 2.5), between(random, 0, 1.8), at[2] + between(random, -2.5, 2.5)]
      const direction: Vec3 = index % 3 !== 2 ? [target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]] : [between(random, -1, 1), between(random, -0.5, 0.5), between(random, -1, 1)]
      const maxDistance = random() < 0.2 ? Infinity : between(random, 0.5, 12)
      const expected = brute.world.raycast(origin, direction, maxDistance)
      expect(broad.world.raycast(origin, direction, maxDistance)).toEqual(expected)
      if (expected?.object === 'sedan') surfaceHits++
      if (expected?.object === 'van') boxHits++
    }
    expect(surfaceHits).toBeGreaterThan(20)
    expect(boxHits).toBeGreaterThan(40)
    // the surface is asked exactly as often as before: only rays that reach a part box ever got there
    expect(broad.sedan.surfaceCalls).toBe(brute.sedan.surfaceCalls)
    // a ray that misses the body's box neither asks its surface nor tries its parts
    const calls = broad.sedan.surfaceCalls
    const reads = broad.sedan.shapeReads
    for (let index = 0; index < 50; index++) expect(broad.world.raycast([-6, 1, -6 + index * 0.01], [-1, 0, 0], 20)).toBeNull()
    expect(broad.sedan.surfaceCalls).toBe(calls)
    expect(broad.sedan.shapeReads).toBe(reads)
    const bruteReads = brute.sedan.shapeReads
    for (let index = 0; index < 50; index++) brute.world.raycast([-6, 1, -6 + index * 0.01], [-1, 0, 0], 20)
    expect(brute.sedan.shapeReads - bruteReads).toBeGreaterThanOrEqual(50 * 3)
    // the box follows the body: moved into the way, the same miss now meets it
    broad.world.setTransform('sedan', [-12, 0, -6], [0, 0, 0, 1])
    brute.world.setTransform('sedan', [-12, 0, -6], [0, 0, 0, 1])
    const moved = broad.world.raycast([-6, 1, -6], [-1, 0, 0], 20)
    expect(moved).toEqual(brute.world.raycast([-6, 1, -6], [-1, 0, 0], 20))
    expect(broad.sedan.surfaceCalls).toBeGreaterThan(calls)
  })
})
