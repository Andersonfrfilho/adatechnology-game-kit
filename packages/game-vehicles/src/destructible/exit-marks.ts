/**
 * What a round that went through a vehicle's skin leaves behind it: the exit on the inside of the sheet (the torn petals bent out the way the round went), then the
 * hole through what stands behind the sheet on its path (a door's inner card, the trim), with its own exit on the cabin side. Seen from inside, or with the door open,
 * the hit is the same hit. What lies further on (a seat) takes the round from the world as a part of its own.
 */
import type { Vector3 } from '../three-types'
import type { PartDef } from './model'
import type { MarkLook } from './hole-mark'

type Vec3 = [number, number, number]

/** The exit sits this far inside the sheet, metres: behind its own face, in front of nothing else. */
const BEHIND_SHEET = 0.0015
/** What stands behind the sheet on the round's path, as far as this, metres (a door's card stands 7 to 16 cm in). */
const BEHIND_REACH = 0.3
/** The exit on the card's far face sits this far off it, towards the cabin, metres. */
const CARD_LIFT = 0.0015
/** The exit of a round tears wider than its entry. */
const EXIT_SPREAD = 2.8
const CARD_SPREAD = 1.6

export interface ExitMarkDeps {
  readonly vector: (x: number, y: number, z: number) => Vector3
  readonly visuals: () => {
    holeDecal(point: Vec3, normal: Vec3, look: MarkLook, part?: PartDef, along?: Vec3): void
    surfaceBehind(point: Vec3, dir: Vec3, reach: number): { point: Vec3; normal: Vec3; far: Vec3 } | null
  } | null
}

export interface ExitAt {
  /** The entry, the panel's normal there (out of the panel) and the round's path, `c.vehicle` coordinates. */
  readonly point: Vector3
  readonly normal: Vector3
  readonly dir: Vector3
  /** The bore of the entry, metres, and the part the round went through. */
  readonly bore: number
  readonly part: PartDef
}

/** The marker of one vehicle: `mark(exit)` draws the exit on the inside of the sheet and the hole through what stands behind it. */
export function createExitMarker(deps: ExitMarkDeps): (at: ExitAt) => void {
  return (at) => {
    const visuals = deps.visuals()
    if (!visuals) return
    const along: Vec3 = [at.dir.x, at.dir.y, at.dir.z]
    const inside = at.normal.clone().negate()
    const behind = at.point.clone().addScaledVector(inside, BEHIND_SHEET)
    visuals.holeDecal([behind.x, behind.y, behind.z], [inside.x, inside.y, inside.z], { style: 'exit', markDiameter: at.bore * EXIT_SPREAD, elongation: 1 }, at.part, along)
    // what stands behind the sheet: the round goes on through it (a door's card) and out of its far face; it belongs to the part the round is in
    const from = at.point.clone().addScaledVector(at.dir, BEHIND_SHEET * 2)
    const next = visuals.surfaceBehind([from.x, from.y, from.z], along, BEHIND_REACH)
    if (!next) return
    visuals.holeDecal(next.point, next.normal, { style: 'round', markDiameter: at.bore * CARD_SPREAD, elongation: 1 }, at.part, along)
    // out of the panel's far face (the card seen from the cabin), a hair off it towards the cabin
    const out = deps.vector(...next.far).addScaledVector(at.dir, CARD_LIFT)
    visuals.holeDecal([out.x, out.y, out.z], along, { style: 'exit', markDiameter: at.bore * EXIT_SPREAD, elongation: 1 }, at.part, along)
  }
}
