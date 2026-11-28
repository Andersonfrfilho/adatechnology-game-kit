/**
 * Fits a bullet mark to the panel it lies on: the mark is a flat disc on the plane of the hit, so near an edge (a door's, a wheel arch) or on a strongly
 * curved panel its rim would hang in the air past the panel or sink into it. The mark shrinks until every point of its rim lies on the drawn skin.
 */
import type { SurfaceRay, SurfaceRayHit } from '@adatechnology/game-contracts'
import type { Vector3 } from '../three-types'
import type { BulletHoleShape } from '../hole-shape'

type Vec3 = [number, number, number]

/**
 * A mark's rim is tested this far off the panel, metres. The mark lies on the panel (lifted 1 mm, `HOLE_LIFT` of the visuals) when, under each point of its
 * rim, the panel falls away from the plane of the hit by at most `MARK_FALL` (a convex panel; more and the rim hangs in the air) and rises over it by at most
 * `MARK_RISE` (a facet or a crease beside it; more and the rim sinks into the skin).
 */
const MARK_PROBE = 0.02
const MARK_FALL = 0.002
const MARK_RISE = 0.0015
const MARK_RIM_SAMPLES = 12
/** A mark whose rim hangs off the panel shrinks by this much a try, at most `MARK_FIT_TRIES` times. */
const MARK_SHRINK = 0.7
const MARK_FIT_TRIES = 7

export interface MarkFitDeps {
  /** A new vector (the host's three.js `Vector3`). */
  readonly vector: (x: number, y: number, z: number) => Vector3
  /** The impl's own drawn-surface ray (world space). */
  readonly surfaceRay: (ray: SurfaceRay) => SurfaceRayHit | null
  /** `c.vehicle` coordinates to world. */
  readonly toWorld: (v: Vector3) => Vec3
  readonly dirToWorld: (v: Vector3) => Vec3
}

export interface MarkPlacement {
  /** The hit, `c.vehicle` coordinates. */
  readonly point: Vector3
  /** The panel's normal at the hit, `c.vehicle` coordinates. */
  readonly normal: Vector3
  /** The round's path, `c.vehicle` coordinates. */
  readonly along: Vector3
}

/** The fitter of one vehicle: `fit` answers the mark shrunk until its rim lies on the panel. */
export function createMarkFitter(deps: MarkFitDeps): (shape: BulletHoleShape, at: MarkPlacement) => BulletHoleShape {
  /** The axes of a mark on the panel: `u` along the round's path over the panel (the long axis of a gouge), `w` across it. */
  const axesOf = (n: Vector3, along: Vector3): { u: Vector3; w: Vector3 } => {
    const u = along.clone().addScaledVector(n, -along.dot(n))
    if (u.lengthSq() < 1e-8) u.crossVectors(n, Math.abs(n.y) < 0.9 ? deps.vector(0, 1, 0) : deps.vector(1, 0, 0))
    u.normalize()
    return { u, w: deps.vector(0, 0, 0).crossVectors(n, u).normalize() }
  }
  const rimOnSurface = (at: MarkPlacement, axes: { u: Vector3; w: Vector3 }, half: { along: number; across: number }): boolean => {
    const inward = deps.dirToWorld(at.normal.clone().negate())
    for (let k = 0; k < MARK_RIM_SAMPLES; k++) {
      const a = (k / MARK_RIM_SAMPLES) * Math.PI * 2
      const q = at.point.clone().addScaledVector(axes.u, Math.cos(a) * half.along).addScaledVector(axes.w, Math.sin(a) * half.across).addScaledVector(at.normal, MARK_PROBE)
      const hit = deps.surfaceRay({ origin: deps.toWorld(q), direction: inward, maxDistance: MARK_PROBE * 2 })
      const fall = hit ? hit.distance - MARK_PROBE : Infinity
      if (fall > MARK_FALL || fall < -MARK_RISE) return false
    }
    return true
  }
  return (shape, at) => {
    const placed = { ...at, normal: at.normal.clone().normalize() }
    const axes = axesOf(placed.normal, at.along)
    let scale = 1
    for (let tries = 0; tries < MARK_FIT_TRIES; tries++) {
      const across = (shape.markDiameter / 2) * scale
      if (rimOnSurface(placed, axes, { along: across * shape.elongation, across })) break
      scale *= MARK_SHRINK
    }
    if (scale === 1) return shape
    const markDiameter = shape.markDiameter * scale
    return { ...shape, markDiameter, boreDiameter: Math.min(shape.boreDiameter, markDiameter * 0.8) }
  }
}
