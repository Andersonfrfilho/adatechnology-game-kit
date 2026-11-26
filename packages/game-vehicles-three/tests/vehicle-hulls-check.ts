import * as THREE from 'three'

import { createVehicleColliders } from '../src'
import type { VehicleHull } from '../src'
import { build } from './vehicle-colliders-support'
import { RAY_DIRECTIONS, compareBalls, depthMap, drawnTriangles, frameFor, hullTriangles } from './vehicle-hulls-support'

/** K2: the extreme of a part's hulls along each of the 26 directions is the extreme of its drawn vertices within this (m). */
export const ENCOSTO = 0.001
/** K5: share of the balls on the drawn shell a model may have no hull behind. */
export const MAX_BEHIND_SHARE = 0.01

/** Where a direction comes from: the ball comes down onto the vehicle (`above`), up from under it (`below`), or level. */
export type Side = 'above' | 'below' | 'side'
const sideOf = (direction: readonly [number, number, number]): Side => (direction[1] < -1e-9 ? 'above' : direction[1] > 1e-9 ? 'below' : 'side')

export interface HullReport {
  readonly id: string
  readonly hulls: number
  readonly maxPoints: number
  /** K3 */
  readonly floating: number
  /** K3, by where the ball comes from. */
  readonly floatingBySide: Readonly<Record<Side, number>>
  /** K4, by where the ball comes from. */
  readonly ahead: Readonly<Record<Side, number>>
  readonly aheadByPart: Readonly<Record<string, number>>
  readonly floatingByPart: Readonly<Record<string, number>>
  readonly drawnBalls: number
  /** K5 */
  readonly behind: number
  /** K2: the hulls (named by key and direction) whose extreme is not the drawn one. */
  readonly extremeFailures: string[]
  /** K6: parts that should be one whole hull and are not, and wheel parts that have a hull. */
  readonly solidFailures: string[]
  /** What the hulls cost on top of the pieces (`createVehicleColliders` made them first), ms. */
  readonly hullMs: number
}

const maxAlong = (points: ArrayLike<number>, d: readonly [number, number, number]): number => {
  let best = -Infinity
  for (let i = 0; i < points.length; i += 3) best = Math.max(best, points[i]! * d[0] + points[i + 1]! * d[1] + points[i + 2]! * d[2])
  return best
}

/** K2 on one hull: its extreme along each direction against the drawn vertices it was made from; a hull padded for a flat piece may stand `padding` more (the padding is not a drawn vertex). */
export const extremeFailuresOf = (hull: VehicleHull, drawn: ArrayLike<number>, padding: number): string[] => {
  const failures: string[] = []
  for (const d of RAY_DIRECTIONS) {
    const diff = maxAlong(hull.points, d) - maxAlong(drawn, d)
    if (Math.abs(diff) > ENCOSTO + padding) failures.push(`${hull.key} [${d.map((v) => v.toFixed(2)).join(',')}]: ${(diff * 1000).toFixed(2)} mm`)
  }
  return failures
}

/** Whether every point of the hull is a drawn vertex. */
export const isOnlyDrawn = (hull: VehicleHull, drawn: ArrayLike<number>): boolean => {
  const seen = new Set<string>()
  for (let i = 0; i < drawn.length; i += 3) seen.add(`${Math.fround(drawn[i]!)},${Math.fround(drawn[i + 1]!)},${Math.fround(drawn[i + 2]!)}`)
  for (let i = 0; i < hull.points.length; i += 3) if (!seen.has(`${hull.points[i]},${hull.points[i + 1]},${hull.points[i + 2]}`)) return false
  return true
}

/** The hulls of the model made whole and measured against what is drawn: K2 to K6 of the design (10.3). */
export const checkHulls = (id: string, padding: number, maxHulls = Infinity): HullReport => {
  const { vehicle, frame, dispose } = build(id)
  try {
    const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls })
    colliders.pieces()
    const started = performance.now()
    const hulls: VehicleHull[] = colliders.hulls()
    const hullMs = performance.now() - started
    const partNumbers = new Map(vehicle.model.parts.map((part, index) => [part.id, index]))
    const roleOf = new Map(vehicle.model.parts.map((part) => [part.id, part.role]))
    const root = vehicle.vehicle.vehicle as THREE.Object3D
    const wheels = new Set(vehicle.model.parts.filter((part) => WHEEL_ROLES.has(part.role)).flatMap((part) => vehicle.objectsOf(part.id)))
    const drawn = drawnTriangles(root, frame, wheels)
    const solid = hullTriangles(hulls, partNumbers)
    const ahead: Record<Side, number> = { above: 0, below: 0, side: 0 }
    const floatingBySide: Record<Side, number> = { above: 0, below: 0, side: 0 }
    const aheadByPart: Record<string, number> = {}
    const floatingByPart: Record<string, number> = {}
    const partNames = vehicle.model.parts.map((part) => part.id)
    let floating = 0, behind = 0, drawnBalls = 0
    for (const direction of RAY_DIRECTIONS) {
      const rayFrame = frameFor(direction, [drawn, solid.triangles])
      const counts = compareBalls(depthMap(drawn, rayFrame), depthMap(solid.triangles, rayFrame, solid.owners))
      drawnBalls += counts.drawn
      floating += counts.floating
      floatingBySide[sideOf(direction)] += counts.floating
      behind += counts.behind
      ahead[sideOf(direction)] += counts.ahead
      for (const [owner, n] of counts.floatingByOwner) floatingByPart[partNames[owner] ?? '?'] = (floatingByPart[partNames[owner] ?? '?'] ?? 0) + n
      for (const [owner, n] of counts.aheadByOwner) aheadByPart[partNames[owner] ?? '?'] = (aheadByPart[partNames[owner] ?? '?'] ?? 0) + n
    }
    const extremeFailures: string[] = []
    const solidFailures: string[] = []
    const byPart = new Map<string, VehicleHull[]>()
    for (const hull of hulls) {
      const list = byPart.get(hull.id)
      if (list) list.push(hull)
      else byPart.set(hull.id, [hull])
      const source = colliders.drawnPointsOf(hull)
      const isPadded = !isOnlyDrawn(hull, source)
      extremeFailures.push(...extremeFailuresOf(hull, source, isPadded ? padding : 0))
    }
    for (const [part, list] of byPart) {
      const role = roleOf.get(part) ?? ''
      if (WHEEL_ROLES.has(role)) solidFailures.push(`${part} (${role}) has ${list.length} hulls: the wheel is the constraint's`)
      if (SOLID_ONE.has(role) && list.length !== 1) solidFailures.push(`${part} (${role}) has ${list.length} hulls, not one`)
      if (SOLID_ONE.has(role) && list.length === 1 && !isOnlyDrawn(list[0]!, colliders.drawnPointsOf(list[0]!))) solidFailures.push(`${part} (${role}): the hull has a point that is not a drawn vertex`)
    }
    return {
      id, hulls: hulls.length, maxPoints: Math.max(0, ...hulls.map((hull) => hull.points.length / 3)), floating, floatingBySide, ahead, aheadByPart, floatingByPart, drawnBalls, behind, extremeFailures, solidFailures, hullMs,
    }
  } finally {
    dispose()
  }
}

/** The wheel and what hangs on it are the vehicle constraint's: no hull, and not measured against the hulls. */
export const WHEEL_ROLES: ReadonlySet<string> = new Set(['rim', 'tyre', 'brakes', 'shocks'])

/** Roles that are one whole hull (design 10.1): the solid blocks without the wheel. */
export const SOLID_ONE: ReadonlySet<string> = new Set(['light', 'mirror', 'engine', 'radiator', 'fuel_tank', 'oil_pan', 'battery', 'alternator', 'gearbox', 'steering', 'hitch'])
