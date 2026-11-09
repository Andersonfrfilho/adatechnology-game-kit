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
  let travelled = 0
  while (found.length < maxHits && travelled < length) {
    const start = along(origin, direction, travelled)
    const hit = world.raycast(start, direction, length - travelled, skip)
    if (!hit) break
    const last = found.at(-1)
    // standing just inside a part that answers with a hit of its own (an impl's surface), not a second layer
    if (!(last && last.object === hit.object && last.part === hit.part)) found.push({ ...hit, distance: travelled + hit.distance })
    travelled += hit.distance + step
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
