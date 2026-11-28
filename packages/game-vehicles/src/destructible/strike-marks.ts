/**
 * A hand-held blow on a vehicle's skin leaves its mark where it landed: a dent pressed into the sheet (a fist, a boot, a hammer), a crease along a club's barrel,
 * the paint crazed over a hard dent, and a blade's scratch, cut or gash along its swing. The size comes from the blow (`strikeMarkShape`); a heavy blow (a crash, a
 * blast) is the kit's own impact and leaves none of these, and so does any blow the host does not mark as struck by hand (`Hit.handHeld`): a crash's
 * contacts crumple the body by their own rules.
 */
import type { Hit, SurfaceRay, SurfaceRayHit } from '@adatechnology/game-contracts'
import type { Vector3 } from '../three-types'
import { strikeMarkShape } from '../strike-shape'
import type { StrikeMarkShape } from '../strike-shape'
import type { PartDef } from './model'
import type { MarkLook } from './hole-mark'
import type { DentSpec } from './dent-at'

type Vec3 = [number, number, number]

/** A blow this strong or stronger is the kit's own impact (a crash, a ram), not a hand-held blow. */
export const HAND_BLOW_LIMIT = 4000
/** The surface is looked for from this far before the hit, along the blow, metres. */
const LOOK_BACK = 0.08
/** A scratch's mark is drawn this many times wider than the line, for its soft edges. */
const SCRATCH_SPREAD = 3

export interface StrikeMarkVisuals {
  holeDecal(point: Vec3, normal: Vec3, look: MarkLook, part?: PartDef, along?: Vec3): void
  pressDent(spec: DentSpec): boolean
}

export interface StrikeMarkDeps {
  readonly vector: (x: number, y: number, z: number) => Vector3
  readonly surfaceRay: (ray: SurfaceRay) => SurfaceRayHit | null
  readonly partOf: (id: string) => PartDef | undefined
  /** World to `c.vehicle` coordinates, a point and a direction. */
  readonly toLocal: (w: Vec3) => Vector3
  readonly dirToLocal: (d: Vec3) => Vector3
  readonly visuals: () => StrikeMarkVisuals | null
}

/** The long axis of the mark on the panel: the swing over it, or level along the panel when the blow has no swing. */
function axisOn(normal: Vector3, sweep: Vector3 | null, vector: StrikeMarkDeps['vector']): Vector3 {
  const along = sweep ? sweep.clone().addScaledVector(normal, -sweep.dot(normal)) : vector(0, 0, 0)
  if (along.lengthSq() < 1e-6) along.crossVectors(normal, vector(0, 1, 0))
  if (along.lengthSq() < 1e-6) along.set(1, 0, 0)
  return along.normalize()
}

/** The paint and blade marks of a blow (the dent itself is pressed into the sheet). */
function marksOf(shape: StrikeMarkShape): MarkLook | null {
  if (shape.kind === 'scratch' || shape.kind === 'cut' || shape.kind === 'gash') {
    const across = shape.width * SCRATCH_SPREAD
    return { style: shape.kind, markDiameter: across, elongation: Math.max(1, shape.length / across) }
  }
  return shape.paintCracks ? { style: 'crazed', markDiameter: shape.width * 0.9, elongation: Math.max(1, shape.length / shape.width) } : null
}

/** The marker of one vehicle: `mark(hit)` leaves the blow's mark on the part it met. */
export function createStrikeMarker(deps: StrikeMarkDeps): (hit: Hit) => void {
  return (hit) => {
    const visuals = deps.visuals()
    if (!visuals || !hit.handHeld || (hit.type !== 'blunt' && hit.type !== 'slash') || (hit.energy ?? 0) >= HAND_BLOW_LIMIT || !hit.direction) return
    const dir = deps.vector(...hit.direction).normalize()
    const start = deps.vector(...hit.point).addScaledVector(dir, -LOOK_BACK)
    const surface = deps.surfaceRay({ origin: [start.x, start.y, start.z], direction: [dir.x, dir.y, dir.z], maxDistance: LOOK_BACK * 2.5 })
    const part = surface ? deps.partOf(surface.part) : undefined
    if (!surface || !part) return
    const shape = strikeMarkShape({ type: hit.type, energy: hit.energy ?? 0, radius: hit.radius ?? 0.05, ...(hit.contactLength !== undefined ? { contactLength: hit.contactLength } : {}), material: part.material })
    if (!shape) return
    const point = deps.vector(...surface.point)
    const normal = deps.vector(...surface.normal).normalize()
    const axis = axisOn(normal, hit.sweep ? deps.vector(...hit.sweep).normalize() : null, deps.vector)
    if (shape.depth > 0) visuals.pressDent({ point, normal, axis, length: shape.length, width: shape.width, depth: shape.depth })
    const look = marksOf(shape)
    if (!look) return
    const at = deps.toLocal(surface.point)
    const n = deps.dirToLocal(surface.normal).normalize()
    const along = deps.dirToLocal([axis.x, axis.y, axis.z])
    visuals.holeDecal([at.x, at.y, at.z], [n.x, n.y, n.z], look, part, [along.x, along.y, along.z])
  }
}
