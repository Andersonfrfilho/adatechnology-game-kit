import { afterEach, describe, expect, it } from 'vitest'

import type { BodyDesc, Quat, ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ReadyShapes } from '../src/ready-shapes'
import { ground } from './scenes'

const alive: JoltWorld[] = []
// the wasm heap holds about six worlds: each test lets its worlds go
afterEach(() => {
  for (const world of alive.splice(0)) world.dispose()
})
const makeWorld = async (): Promise<JoltWorld> => {
  const world = (await createJoltEngine()).createWorld({ fixedStep: 1 / 120 }) as JoltWorld
  alive.push(world)
  return world
}

/** A fixed sequence of numbers in [0, 1): the scene is the same on every run. */
const sequence = (seed: number): (() => number) => {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const turn = (angle: number, axis: Vec3): Quat => {
  const s = Math.sin(angle / 2)
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
}

/** The pieces of a broken house as the destruction glue makes them: compounds of tagged part boxes about their centre of mass, some turned, one a lone box, one a tapered can. */
const pieces = (count: number): { descs: BodyDesc[]; children: ShapeDesc[] } => {
  const next = sequence(11)
  const children: ShapeDesc[] = []
  const descs: BodyDesc[] = []
  for (let i = 0; i < count; i++) {
    const parts = 1 + (i % 5)
    const shape: ShapeDesc = {
      kind: 'compound',
      children: Array.from({ length: parts }, (_, k) => {
        const box: ShapeDesc = { kind: 'box', half: [0.04 + next() * 0.3, 0.02 + next() * 0.1, 0.04 + next() * 0.25] }
        children.push(box)
        const position: Vec3 = [next() * 0.6 - 0.2, next() * 0.3, next() * 0.4 - 0.1]
        return { shape: box, position, ...(k % 2 === 1 ? { rotation: turn(next(), [0, 1, 0]) } : {}), tag: k }
      }),
    }
    descs.push({
      shape: shape,
      motion: 'dynamic',
      mass: 5 + next() * 40,
      centreAtOrigin: true,
      continuous: true,
      position: [(i % 6) * 1.4 - 3.5, 0.6 + Math.floor(i / 6) * 0.9, 0],
      rotation: turn(next() * 3, [0.6, 0.8, 0]),
      angularVelocity: [next() * 4 - 2, next() * 4 - 2, next() * 4 - 2],
      linearDamping: 0,
      angularDamping: 0,
      user: i,
    })
  }
  // a can: an untagged convex child (the tapered round piece)
  const can: ShapeDesc = { kind: 'convex', points: [-0.1, -0.2, -0.1, 0.1, -0.2, -0.1, -0.1, -0.2, 0.1, 0.1, -0.2, 0.1, -0.06, 0.2, -0.06, 0.06, 0.2, -0.06, -0.06, 0.2, 0.06, 0.06, 0.2, 0.06] }
  children.push(can)
  descs.push({ shape: { kind: 'compound', children: [{ shape: can, position: [0, 0, 0] }] }, motion: 'dynamic', mass: 2, centreAtOrigin: true, position: [0, 6, 1], user: count, inertia: [0.01, 0.005, 0.01] })
  return { descs, children }
}

/** FNV-1a over the saved state: the world to the bit. */
const hashOf = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193)
  return (hash >>> 0).toString(16)
}

/** The pieces made in one batch, 2 s of fall and tumble, and what the world holds then (with every body's pose to compare by eye when it fails). */
const run = async (prebuild: boolean): Promise<{ hash: string; poses: number[]; world: JoltWorld }> => {
  const world = await makeWorld()
  ground(world)
  const { descs, children } = pieces(30)
  if (prebuild) expect(world.prebuildShapes('house', children)).toBe(children.length)
  const ids = world.createBodies(descs)
  if (prebuild) {
    // every child took a shape made ahead: none was built when the bodies were made, and none is left held
    expect(world.ready.taken).toBe(children.length)
    expect(world.ready.builtAtAssembly).toBe(0)
    expect(world.ready.size).toBe(0)
  } else expect(world.ready.builtAtAssembly).toBe(children.length)
  for (let i = 0; i < 240; i++) world.stepFixed(world.fixedStep)
  const pose = new Float64Array(7)
  const poses: number[] = []
  for (const id of ids) {
    world.readPose(id, pose, 0)
    poses.push(...pose)
  }
  return { hash: hashOf(world.saveState()), poses, world }
}

describe('shapes made ahead (spec 008 B6): the compound of a piece assembled from child shapes built in idle time', () => {
  it('the bodies are the very same as building the shapes at the split: every pose and the whole saved state, to the bit', async () => {
    const plain = await run(false)
    const ahead = await run(true)
    expect(ahead.poses).toEqual(plain.poses)
    expect(ahead.hash).toBe(plain.hash)
  })

  it('a tagged child made ahead answers rays and contacts with its own tag, as one built in the compound does', async () => {
    const tagsAlong = async (prebuild: boolean): Promise<number[]> => {
      const world = await makeWorld()
      const boxes: ShapeDesc[] = [0, 1, 2, 3].map((k) => ({ kind: 'box', half: [0.25, 0.1 + k * 0.05, 0.25] }))
      if (prebuild) world.prebuildShapes('wall', boxes)
      world.createBody({ shape: { kind: 'compound', children: boxes.map((shape, k) => ({ shape, position: [k * 0.5, 0, 0], tag: 10 + k })) }, motion: 'static', position: [0, 0, 0], user: 3 })
      return [0, 0.5, 1, 1.5].map((x) => world.rayFirst([x, 2, 0], [0, -1, 0], 4)?.tag ?? NaN)
    }
    expect(await tagsAlong(false)).toEqual([10, 11, 12, 13])
    expect(await tagsAlong(true)).toEqual([10, 11, 12, 13])
  })

  it('a shape made ahead has the compound for its only holder, and goes with the body: nothing is left on the heap', async () => {
    const world = await makeWorld()
    const before = world.memoryInUse()
    const boxes: ShapeDesc[] = [0, 1, 2].map((k) => ({ kind: 'box', half: [0.2, 0.05 * (k + 1), 0.1] }))
    world.prebuildShapes('door', boxes)
    expect(world.memoryInUse()).toBeGreaterThan(before)
    const id = world.createBody({ shape: { kind: 'compound', children: boxes.map((shape, k) => ({ shape, position: [k * 0.3, 0.4 * k, 0], tag: k })) }, motion: 'dynamic', mass: 4, centreAtOrigin: true, position: [0, 3, 0], user: 0 })
    expect(world.ready.taken).toBe(3)
    // offset shape (the kit's centre of mass) over the compound over the three boxes: one reference each, the body's chain
    const outer = world.entry(id).body.GetShape()
    const compound = world.J.castObject(outer, world.J.DecoratedShape).GetInnerShape()
    expect(compound.GetRefCount()).toBe(1)
    const subs = world.J.castObject(compound, world.J.CompoundShape)
    expect(subs.GetNumSubShapes()).toBe(3)
    for (let k = 0; k < 3; k++) expect(subs.GetSubShape(k).mShape.GetRefCount()).toBe(1)
    world.removeBody(id)
    expect(world.memoryInUse()).toBe(before)
  })

  it('what no compound took goes when its owner is released, and with the world; the same numbers of another owner stay', async () => {
    const world = await makeWorld()
    const before = world.memoryInUse()
    const brick: ShapeDesc = { kind: 'box', half: [0.095, 0.0275, 0.045] }
    const can: ShapeDesc = { kind: 'convex', points: [0, 0, 0, 0.1, 0, 0, 0, 0.1, 0, 0, 0, 0.1, 0.1, 0.1, 0.1] }
    expect(world.prebuildShapes('house', [brick, brick, brick, can, { kind: 'trimesh', vertices: [0, 0, 0, 1, 0, 0, 0, 0, 1], indices: [0, 1, 2] }])).toBe(4)
    expect(world.prebuildShapes('shed', [brick])).toBe(1)
    const withBoth = world.memoryInUse()
    world.releaseShapes('house')
    expect(world.ready.size).toBe(1)
    world.releaseShapes('house')
    expect(world.ready.size).toBe(1)
    // the shed's brick is still there to take
    world.createBody({ shape: { kind: 'compound', children: [{ shape: brick, position: [0, 0, 0], tag: 0 }, { shape: brick, position: [0.2, 0, 0], tag: 1 }] }, motion: 'static', position: [0, 0, 0], user: 0 })
    expect(world.ready.taken).toBe(1)
    expect(world.ready.builtAtAssembly).toBe(1)
    expect(world.ready.size).toBe(0)
    expect(world.memoryInUse()).toBeLessThan(withBoth)
    world.prebuildShapes('shed', [brick, can])
    world.dispose()
    // a fresh world after the one disposed: its whole heap back (the world's own share is the same each time)
    const again = await makeWorld()
    expect(again.memoryInUse()).toBe(before)
  })

  it('holds at most its bound: past it nothing more is made', async () => {
    const world = await makeWorld()
    const ready = new ReadyShapes(2)
    const box: ShapeDesc = { kind: 'box', half: [0.1, 0.1, 0.1] }
    expect(ready.add('a', [box, box, box], (shape) => world.makeShape(shape))).toBe(2)
    expect(ready.size).toBe(2)
    ready.dispose()
    expect(ready.size).toBe(0)
  })

  it('a near match is no match: one bit off builds the shape', async () => {
    const world = await makeWorld()
    world.prebuildShapes('a', [{ kind: 'box', half: [0.1, 0.1, 0.1] }])
    world.createBody({ shape: { kind: 'compound', children: [{ shape: { kind: 'box', half: [0.1, 0.1, 0.1 + 2 ** -55] }, position: [0, 0, 0] }] }, motion: 'static', position: [0, 0, 0], user: 0 })
    expect(world.ready.taken).toBe(0)
    expect(world.ready.size).toBe(1)
  })

  it('a centred compound is the same body it was before shapes could be made ahead (state hash recorded on the code before the change)', async () => {
    expect((await run(false)).hash).toBe(GOLDEN)
  })
})

const GOLDEN = '9c614671'
