import { describe, expect, it } from 'vitest'

import type { RayHit, ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { ground } from './scenes'

const hull = (half: Vec3, at: Vec3): ShapeDesc => ({
  kind: 'convex',
  points: Float32Array.from([-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].flatMap((z) => [at[0] + x * half[0], at[1] + y * half[1], at[2] + z * half[2]])))),
})

describe('a mutable compound whose centre of mass was moved still has children to change (vehicle parts coming off, T6.9)', () => {
  it('takes a child out and replaces another after `setMassProperties` moved the centre', async () => {
    const world = (await createJoltEngine()).createWorld() as JoltWorld
    ground(world, 20)
    const car = world.createBody({
      shape: { kind: 'compound', mutable: true, children: [0, 1, 2].map((i) => ({ shape: hull([0.3, 0.2, 0.4], [i - 1, 0, 0]), position: [0, 0, 0] as Vec3, tag: i })) },
      motion: 'dynamic', mass: 900, inertia: [200, 300, 250], position: [0, 1, 0], user: 1,
    })
    world.setMassProperties(car, { mass: 900, inertia: [200, 300, 250], centreOfMass: [0.2, 0.25, 0] })
    world.setChildShape(car, 2, null)
    world.setChildShape(car, 0, hull([0.3, 0.1, 0.4], [-1, 0, 0]))
    world.setMassProperties(car, { mass: 700, inertia: [150, 250, 200], centreOfMass: [-0.2, 0.2, 0] })
    world.setChildShape(car, 1, null)
    for (let i = 0; i < 60; i++) world.step(1 / 60)
    expect(world.massOf(car)).toBeCloseTo(700, 3)
    const pose = new Float64Array(7)
    world.readPose(car, pose, 0)
    expect(Number.isFinite(pose[1])).toBe(true)
    expect(pose[1]).toBeLessThan(1)
    world.dispose()
  })
})

describe('a child set again without a pose, or copied from a shared compound, stays where it was (its centre of mass is not its origin)', () => {
  const THICKNESS: Vec3 = [0.3, 0.2, 0.4]
  const children = (): { shape: ShapeDesc; position: Vec3; tag: number }[] => [-2, 2].map((x, tag) => ({ shape: hull(THICKNESS, [x, 0, 0]), position: [0, 0, 0] as Vec3, tag }))
  /** The tags a ray going down through x finds in the body whose compound sits at height 5. */
  const tagsAt = (world: JoltWorld, x: number): number[] => {
    const out: RayHit[] = []
    world.rayAll([x, 10, 0], [0, -1, 0], 10, out)
    return out.map((hit) => hit.tag)
  }

  it('setChildShape with no pose leaves the child in its place', async () => {
    const world = (await createJoltEngine()).createWorld() as JoltWorld
    const car = world.createBody({ shape: { kind: 'compound', mutable: true, children: children() }, motion: 'dynamic', mass: 900, inertia: [200, 300, 250], position: [0, 5, 0], user: 1, sleeping: true })
    expect(tagsAt(world, 2)).toContain(1)
    world.setChildShape(car, 1, hull(THICKNESS, [2, 0, 0]))
    expect(tagsAt(world, 2)).toContain(1)
    expect(tagsAt(world, 4)).toEqual([])
    expect(tagsAt(world, -2)).toContain(0)
    world.dispose()
  })

  it('the first copy of a shared compound keeps every child in its place', async () => {
    const world = (await createJoltEngine()).createWorld() as JoltWorld
    const shared = world.createSharedShape({ kind: 'compound', children: children() })
    const car = world.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 900, position: [0, 5, 0], user: 1, sleeping: true })
    world.setChildShape(car, 0, hull(THICKNESS, [-2, 0, 0]))
    expect(tagsAt(world, -2)).toContain(0)
    expect(tagsAt(world, 2)).toContain(1)
    expect(tagsAt(world, 4)).toEqual([])
    expect(tagsAt(world, -4)).toEqual([])
    world.dispose()
  })
})
