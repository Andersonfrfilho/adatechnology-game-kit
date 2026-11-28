import type { WorkshopEngine } from '../../workshop/engine'
import type { Vec3Tuple } from '../../workshop/types'
import { plusScaled } from '../vector-math'

/** What a round striking a vehicle's skin throws, by the bore it made (metres across). */
export interface BodyworkImpact {
  /** The round's path, world, unit. */
  readonly direction: Vec3Tuple
  /** Diameter of the round's mark, metres: the bigger the round, the more sparks, flakes and slivers, and the bigger they are. */
  readonly bore: number
  /** Colour of the paint (flakes), 0xRRGGBB. */
  readonly paint: number
  /** The sheet under the paint (slivers), 0xRRGGBB. */
  readonly metal: number
}

/** A 9 mm hole: the size the counts below are written for. */
const PISTOL_BORE = 0.009
const BARE_STEEL = 0xb3b8bc
/** A car's silver-grey, for a host that does not say the paint. */
const DEFAULT_PAINT = 0x8b939a
const DEFAULT_DIRECTION: Vec3Tuple = [0, 0, -1]
const MAX_SCALE = 3
const MIN_SCALE = 0.6

/** Which way a round off a panel goes on: its path mirrored about the panel's normal (the normal itself when the round came square on or is unknown). */
export function reflected(direction: Vec3Tuple, normal: Vec3Tuple): Vec3Tuple {
  const along = direction[0] * normal[0] + direction[1] * normal[1] + direction[2] * normal[2]
  const out: Vec3Tuple = [direction[0] - 2 * along * normal[0], direction[1] - 2 * along * normal[1], direction[2] - 2 * along * normal[2]]
  const length = Math.hypot(out[0], out[1], out[2])
  if (length < 1e-6 || Math.abs(along) > 0.98) return normal
  return [out[0] / length, out[1] / length, out[2] / length]
}

const numberOr = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

/** The hit from the effect's values (any of them may be missing: a host that only knows the point and the normal still gets a 9 mm hit straight in). */
export function bodyworkHitOf(values: { readonly direction: unknown; readonly bore: unknown; readonly paint: unknown; readonly metal: unknown }): BodyworkImpact {
  const raw = Array.isArray(values.direction) ? values.direction : []
  const direction: Vec3Tuple = raw.length === 3 && raw.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) ? [raw[0], raw[1], raw[2]] : DEFAULT_DIRECTION
  return { direction, bore: numberOr(values.bore, PISTOL_BORE), paint: numberOr(values.paint, DEFAULT_PAINT), metal: numberOr(values.metal, BARE_STEEL) }
}

/** How much a round of this bore throws, against a 9 mm one. */
export function bodyworkScale(bore: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, bore / PISTOL_BORE))
}

/**
 * A round into a car's skin, the way a big action film shows it: a short spray of sparks off the reflected path, a flash at the hit, flakes of paint and
 * slivers of the sheet flying off the hit point (the same debris pieces a shot wall throws, `debrisPiece`), and a pinch of paint dust. No mark of its own:
 * the vehicle draws its hole on the panel, where it goes with the door.
 */
export function bodyworkImpact(engine: WorkshopEngine, point: Vec3Tuple, normal: Vec3Tuple, hit: BodyworkImpact): void {
  const scale = bodyworkScale(hit.bore)
  const off = reflected(hit.direction, normal)
  if (engine.quality < 2) {
    engine.burst('streak', Math.round(14 * scale), { p: point, dir: off, cone: 0.75, sp: [4, 12], life: [0.08, 0.3], len: 0.03, c0: 0xfff4d0, c1: 0xff6a18, g: 9.8, gnd: 2 })
    engine.burst('add', 2, { p: plusScaled(point, normal, 0.01), size: [0.06 * scale, 0.12 * scale], life: 0.05, c0: 0xffe6b0, fi: 0 })
    engine.flash([plusScaled(point, normal, 0.15), 0xffbe70, 1.6 * scale, 0.05, 4])
  }
  const flakes = engine.scaled(Math.round(5 * scale))
  for (let index = 0; index < flakes; index++) {
    engine.debrisPiece({ p: point, dir: normal, cone: 0.9, sp: [1.2, 3.5], size: [0.008 * scale, 0.0012, 0.006 * scale], k: [0.5, 1.4], c: hit.paint, life: 6, bounce: 0.2 })
  }
  const slivers = engine.scaled(Math.round(2 * scale))
  for (let index = 0; index < slivers; index++) {
    engine.debrisPiece({ p: point, dir: off, cone: 0.6, sp: [2.5, 6], size: [0.0025, 0.0015, 0.01 * scale], k: [0.6, 1.3], c: hit.metal, life: 6, bounce: 0.35 })
  }
  engine.burst('normal', Math.round(6 * scale), { p: point, dir: normal, cone: 0.7, sp: [0.4, 1.4], drag: 2.5, life: [0.4, 0.9], size: [0.03, 0.07], grow: 3, c0: hit.paint, a: 0.45, g: -0.05 })
}
