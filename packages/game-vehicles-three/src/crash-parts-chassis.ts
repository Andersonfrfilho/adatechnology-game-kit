import type { BodyId, PhysicsWorld, ShapeDesc } from '@adatechnology/game-physics'

import { holdWithin } from './crash-parts-clamp'
import type { VehicleColliders, VehicleHull } from './colliders'

/** How far (m) a hull of a part that is touching something may go out past the hull it had (`KIT_WORLD.penetrationSlop`: what a resting body sinks anyway). */
export const HULL_SLOP = 0.002

/** One child of the chassis compound: the hull it holds now, and the one the drawing wants when the two are not the same yet (held back while the part touches something). */
interface Child {
  readonly handle: number
  readonly key: string
  readonly partId: string
  readonly partIndex: number
  applied: Float32Array
  wanted: VehicleHull
  isHeld: boolean
}

export interface ChassisSettle {
  /** Hulls the engine was given again. */
  readonly remade: number
  /** Hulls that were left out or held back this time. */
  readonly held: number
  /** Hulls the drawing has that the compound has no child for (a compound cannot gain a child). */
  readonly unplaced: number
}

export interface ChassisHulls {
  /** The compound of the car's hulls, each child tagged with its part's number. */
  shape(): ShapeDesc
  /** Takes the part's children out of the compound; the points they held (frame), for the body the part becomes. */
  release(world: PhysicsWorld, chassis: BodyId, partId: string): Float32Array[]
  /** The hulls the drawing has now, in the compound: those that changed are given to the engine, held to the old ones where `isTouching` says the part touches something. */
  settle(world: PhysicsWorld, chassis: BodyId, isTouching: (points: Float32Array) => boolean): ChassisSettle
  /** Children still in the compound. */
  count(): number
  /** Whether some hull is held back, or the drawing's division is not back yet: the next settle has work. */
  hasWork(): boolean
}

const convexOf = (points: Float32Array): ShapeDesc => ({ kind: 'convex', points })

export const createChassisHulls = (colliders: VehicleColliders, partIndexOf: ReadonlyMap<string, number>): ChassisHulls => {
  let children: Child[] = []

  const shape = (): ShapeDesc => {
    const hulls = colliders.hulls()
    if (hulls.length === 0) throw new Error('crash parts: the car has no hulls yet (its plan is still in the worker: wait for `isHullPending()`)')
    children = hulls.map((hull, handle) => ({ handle, key: hull.key, partId: hull.id, partIndex: partIndexOf.get(hull.id) ?? -1, applied: hull.points, wanted: hull, isHeld: false }))
    return { kind: 'compound', mutable: true, children: children.map((child) => ({ shape: convexOf(child.applied), position: [0, 0, 0], tag: child.partIndex })) }
  }

  const release: ChassisHulls['release'] = (world, chassis, partId) => {
    const mine = children.filter((child) => child.partId === partId)
    for (const child of mine) world.setChildShape(chassis, child.handle, null)
    children = children.filter((child) => child.partId !== partId)
    return mine.map((child) => child.applied)
  }

  const settle: ChassisHulls['settle'] = (world, chassis, isTouching) => {
    const now = new Map(colliders.hulls().map((hull) => [hull.key, hull]))
    let remade = 0
    let held = 0
    const next: Child[] = []
    for (const child of children) {
      const hull = now.get(child.key)
      now.delete(child.key)
      if (!hull) {
        world.setChildShape(chassis, child.handle, null)
        continue
      }
      next.push(child)
      if (hull === child.wanted && !child.isHeld) continue
      const points = isTouching(child.applied) ? holdWithin(child.applied, hull.points, HULL_SLOP) : hull.points
      child.wanted = hull
      child.isHeld = points !== hull.points
      if (child.isHeld) held++
      if (points === child.applied) continue
      world.setChildShape(chassis, child.handle, convexOf(points))
      child.applied = points
      remade++
    }
    children = next
    return { remade, held, unplaced: now.size }
  }

  return { shape, release, settle, count: () => children.length, hasWork: () => colliders.isHullPending() || children.some((child) => child.isHeld) }
}
