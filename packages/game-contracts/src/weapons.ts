import type { Hit, Vec3 } from './destruction'

/**
 * A ballistic shot (one per pellet) as a weapon module produces it. Plain data: any damage model can consume it (`shotToHit` makes the `Hit`).
 */
export interface Shot {
  origin: Vec3
  /** Unit vector. */
  direction: Vec3
  /** Muzzle energy in joules. */
  energy: number
  /** Bullet diameter in millimetres. */
  caliber: number
  /** snake_case calibre id, e.g. `9x19`. */
  caliberId: string
  /** Muzzle speed in m/s. */
  speed: number
  /** Energy at a distance in metres, with the calibre's drag. */
  energyAt(distance: number): number
  pellet: number
  /** snake_case weapon id. */
  weapon: string
  source?: string
}

/** One use of a non-firearm (melee swing, flame tick, heat tick, throw, tool tick, extinguisher tick). */
export type Use =
  | { kind: 'melee'; damage: 'blunt' | 'slash'; energy: number; radius: number; reach: number; origin: Vec3; direction: Vec3 }
  | { kind: 'flame'; temperature: number; radius: number; range: number; cone: boolean; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'heat'; temperature: number; radius: number; range: number; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'throw'; energy: number; radius: number; fuse: number; velocity: Vec3; origin: Vec3; fire?: { temperature: number; radius: number; seconds: number } }
  | { kind: 'tool'; tool: string; reach: number; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'extinguish'; range: number; coolC: number; duration: number; origin: Vec3; direction: Vec3 }
  | { kind: 'hand'; reach: number; origin: Vec3; direction: Vec3 }

/**
 * The `Hit` a ballistic shot makes at `point` (world space): the energy is what is left of the shot at that distance from its origin
 * (`shot.energyAt`), the direction and calibre come from the shot. `normal` (the surface normal at the point, when the caller knows it) does not
 * change the hit; it is accepted so that callers can pass what their raycast returned and so that a stricter implementation could use it.
 */
export const shotToHit = (shot: Shot, point: Vec3, normal?: Vec3): Hit => {
  void normal
  const dx = point[0] - shot.origin[0]
  const dy = point[1] - shot.origin[1]
  const dz = point[2] - shot.origin[2]
  const distance = Math.hypot(dx, dy, dz)
  return {
    type: 'ballistic',
    point: [point[0], point[1], point[2]],
    direction: [shot.direction[0], shot.direction[1], shot.direction[2]],
    energy: shot.energyAt(distance),
    caliber: shot.caliber,
    source: shot.source ?? shot.weapon,
  }
}

/**
 * The `Hit` a non-firearm `Use` makes at `point` (world space), or `null` for uses that do not damage by themselves.
 *
 * - `melee` -> `blunt` / `slash` with the swing's `energy`, contact `radius` and `direction`;
 * - `flame` -> `fire` and `heat` -> `heat`, with `temperature`, `duration` and a contact radius of at most 0.3 m (one ray of the cone);
 * - `throw` -> the blast (`explosive`, `energy`, `radius`, centred on `point`, the place it detonates). A thrown item with no blast energy but
 *   a `fire` patch (a molotov) gives that patch as a `fire` hit (`temperature`, `radius`, `seconds` as `duration`). No energy and no fire -> `null`;
 * - `tool`, `extinguish` and `hand` -> `null` (tools work on joints, the extinguisher cools, the hand only grabs).
 *
 * `normal` does not change the hit (same as `shotToHit`).
 */
export const useToHit = (use: Use, point: Vec3, normal?: Vec3): Hit | null => {
  void normal
  const p: Vec3 = [point[0], point[1], point[2]]
  switch (use.kind) {
    case 'melee':
      return { type: use.damage, point: p, direction: [use.direction[0], use.direction[1], use.direction[2]], energy: use.energy, radius: use.radius }
    case 'flame':
    case 'heat':
      return {
        type: use.kind === 'flame' ? 'fire' : 'heat',
        point: p,
        direction: [use.direction[0], use.direction[1], use.direction[2]],
        temperature: use.temperature,
        radius: Math.min(use.radius, 0.3),
        duration: use.duration,
      }
    case 'throw':
      if (use.energy > 0) return { type: 'explosive', point: p, energy: use.energy, radius: use.radius }
      if (use.fire) return { type: 'fire', point: p, temperature: use.fire.temperature, radius: use.fire.radius, duration: use.fire.seconds }
      return null
    default:
      return null
  }
}
