import type { Vec3 } from './destruction'

/**
 * The numbers of the shove a blast gives to a body that moves (a loose item, a piece of furniture, a person): all of them a game value, with a default that reads well in a room,
 * not a physical table. A host reads them once and lends them to the modules that move their own bodies (`ModuleHost.blastShove`).
 */
export interface BlastShoveOptions {
  /**
   * The share of the blast energy that reaches a body as motion: the speed at the centre is `sqrt(2 * energy * coupling / mass)`, before the falloff (default 0.02).
   */
  readonly coupling?: number
  /** Fastest a body is thrown, in m/s, at the centre of the blast (default 20). */
  readonly maxSpeed?: number
  /** How much of the push goes up: the direction is `(away, lift)` normalised from the horizontal outward direction (default 0.3). */
  readonly lift?: number
  /** Below this speed (m/s) nothing moves: a heavy thing far from a small blast stays where it is (default 0.3). */
  readonly minSpeed?: number
  /** Exponent of the falloff `(1 - distance / radius) ^ power`, the same as the damage of the destruction world (default 2). */
  readonly falloffPower?: number
}

/** The defaults of `BlastShoveOptions`. */
export const DEFAULT_BLAST_SHOVE: Readonly<Required<BlastShoveOptions>> = { coupling: 0.02, maxSpeed: 20, lift: 0.3, minSpeed: 0.3, falloffPower: 2 }

/** A blast as the shove reads it: where, how much energy (J) and how far it reaches (m). `reach` (0..1) is the share that got through what stood in the way. */
export interface BlastSource {
  readonly point: Vec3
  readonly energy: number
  readonly radius: number
  readonly reach?: number
}

/** What a blast does to one body: how fast it leaves (m/s), the unit direction it leaves in, and how far from the centre it was. */
export interface BlastShove {
  readonly speed: number
  readonly direction: Vec3
  readonly distance: number
  /** The falloff applied, 0..1. */
  readonly falloff: number
}

/**
 * The shove a blast gives to a body of `mass` kg whose centre is at `position`: away from the centre, lifted a little, with the speed
 * `min(maxSpeed, sqrt(2 * energy * reach * coupling / mass)) * (1 - distance / radius) ^ 2`. Undefined when the body is outside the radius or the speed is under `minSpeed`.
 * The same rule moves the loose items and furniture of the test room and the people of the characters module, so a game that tunes the options tunes all of them.
 */
export function blastShove(blast: BlastSource, target: { readonly position: Vec3; readonly mass: number }, options: BlastShoveOptions = {}): BlastShove | undefined {
  const o = { ...DEFAULT_BLAST_SHOVE, ...options }
  const dx = target.position[0] - blast.point[0]
  const dy = target.position[1] - blast.point[1]
  const dz = target.position[2] - blast.point[2]
  const distance = Math.hypot(dx, dy, dz)
  if (!(blast.radius > 0) || distance > blast.radius) return undefined
  const falloff = (1 - distance / blast.radius) ** o.falloffPower
  const mass = Math.max(target.mass, 0.05)
  const speed = Math.min(o.maxSpeed, Math.sqrt((2 * blast.energy * (blast.reach ?? 1) * o.coupling) / mass)) * falloff
  if (!(speed >= o.minSpeed)) return undefined
  // straight above or below the centre there is no "away": the push goes up
  const direction: Vec3 = distance > 1e-4 ? [dx / distance, dy / distance + o.lift, dz / distance] : [0, 1, 0]
  const length = Math.hypot(direction[0], direction[1], direction[2])
  return { speed, direction: [direction[0] / length, direction[1] / length, direction[2] / length], distance, falloff }
}
