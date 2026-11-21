import type { RayHit, Vec3 } from '@adatechnology/game-contracts'
import type { OcclusionHit, OcclusionQuery } from '@adatechnology/game-audio'
import type { RaycastOptions } from '@adatechnology/game-destruction'

export type OcclusionWorld = {
  raycast(origin: Vec3, direction: Vec3, maxDistance?: number, options?: RaycastOptions): RayHit | null
  part(objectId: string, partId: string): { readonly material: string } | null
}

export type WorldOcclusionOptions = {
  /** Most things counted on one path. Default 6. */
  readonly maxHits?: number
  /** Metres stepped past a hit before looking for the next: small enough not to skip a thin layer behind it (4 mm glass). Default 0.001. */
  readonly step?: number
  /**
   * Objects with a smaller bounding radius (metres) are not looked at. Default `OCCLUDER_MIN_RADIUS`. Loose pieces (what `splitGroup` cut off) are never
   * looked at: debris on the floor or in the air does not stand between a sound and the ear long enough to matter. A fallen chunk still part of its object counts.
   */
  readonly minObjectRadius?: number
}

/**
 * 0.25 m: an object under half a metre across is smaller than the 0.69 m wavelength of the 500 Hz band the loss table is measured in, so sound bends
 * around it and the shadow fills in a few of its own widths behind it; a can, a brick that came off or a shard takes nothing audible off a voice.
 */
export const OCCLUDER_MIN_RADIUS = 0.25

const along = (origin: Vec3, direction: Vec3, distance: number): Vec3 => [origin[0] + direction[0] * distance, origin[1] + direction[1] * distance, origin[2] + direction[2] * distance]

function hitsAlong(world: OcclusionWorld, origin: Vec3, direction: Vec3, length: number, maxHits: number, step: number, skip: RaycastOptions): RayHit[] {
  const found: RayHit[] = []
  const rayFrom = (travelled: number, ignoreParts?: readonly { readonly object: string; readonly part: string }[]): RayHit | null =>
    world.raycast(along(origin, direction, travelled), direction, length - travelled, ignoreParts ? { ...skip, ignoreParts } : skip)
  let travelled = 0
  while (found.length < maxHits && travelled < length) {
    const hit = rayFrom(travelled)
    if (!hit) break
    const last = found.at(-1)
    // standing just inside a part that answers with a hit of its own (an impl's surface), not a second layer
    const isSameLayer = last !== undefined && last.object === hit.object && last.part === hit.part
    if (!isSameLayer) {
      found.push({ ...hit, distance: travelled + hit.distance })
      travelled += hit.distance + step
      continue
    }
    if (hit.distance > step) {
      travelled += hit.distance + step
      continue
    }
    // Inside the last counted part: the next thing past it, found with that part ignored. Only that one part is ever ignored, so a part that overlaps it
    // is never lost for good.
    const past = rayFrom(travelled, [last])
    if (!past) break
    const entry = travelled + past.distance
    // Past answers at its entry from a point inside the part we are in: the walk of one millimetre never saw it, since that part answered first.
    const probe = past.distance <= step ? hit : rayFrom(entry - step)
    const isBuried = probe !== null && probe.object === last.object && probe.part === last.part && probe.distance <= step
    if (!isBuried) {
      found.push({ ...past, distance: entry })
      travelled = entry + step
    }
    // half a step past the entry face: on the face itself the buried part and the one we are in both answer 0, and which one wins is a tie
    else if (past.distance > step) travelled = entry + step / 2
    // The millimetre walk still happens here, and only here: through an overlap of two parts that both answer from inside (an impl on an impl), where
    // the part we are in can end while the buried one goes on and must then be counted. An ordinary part answers only at its entry, so it is jumped to.
    else travelled += step
  }
  return found
}

/**
 * An occlusion query over a destruction world: the parts the segment crosses, each with its material and the thickness it measures from the way in
 * (a ray from the source) and the way out (a ray from the listener). A part already broken or holed is not hit by the world's ray, so it lets sound by.
 * Only what stands occludes: the rays leave out loose pieces and objects under `minObjectRadius` before reading their shapes (a blast leaves hundreds).
 */
export function createWorldOcclusion(world: OcclusionWorld, options: WorldOcclusionOptions = {}): OcclusionQuery {
  const maxHits = options.maxHits ?? 6
  const step = options.step ?? 0.001
  if (!(step > 0) || !Number.isFinite(step)) throw new RangeError(`world occlusion: step must be a positive length, got ${step}`)
  const skip: RaycastOptions = { skipLoose: true, minObjectRadius: options.minObjectRadius ?? OCCLUDER_MIN_RADIUS }
  return (from, to) => {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const dz = to[2] - from[2]
    const length = Math.hypot(dx, dy, dz)
    if (length < 1e-6) return []
    const forward: Vec3 = [dx / length, dy / length, dz / length]
    const back: Vec3 = [-forward[0], -forward[1], -forward[2]]
    const entries = hitsAlong(world, from, forward, length, maxHits, step, skip)
    const exits = [...hitsAlong(world, to, back, length, maxHits, step, skip)].reverse()
    return entries.map((entry, index): OcclusionHit => {
      const material = world.part(entry.object, entry.part)?.material
      const exit = exits[index]
      const paired = exits.length === entries.length && exit && exit.object === entry.object && exit.part === entry.part
      const thickness = paired ? Math.hypot(exit.point[0] - entry.point[0], exit.point[1] - entry.point[1], exit.point[2] - entry.point[2]) : undefined
      return { ...(material ? { material } : {}), ...(thickness === undefined ? {} : { thickness }) }
    })
  }
}
