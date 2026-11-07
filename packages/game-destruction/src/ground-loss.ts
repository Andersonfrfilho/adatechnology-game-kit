import type { GroundLoss, GroundLossOptions, PartSettlement, Vec3 } from './types'

export const GROUND_LOSS_DEFAULTS: Required<GroundLossOptions> = {
  footingDepth: 0.5,
  spread: 1,
  voidDepth: 0.05,
  maxSettlement: 0.05,
  crackDistortion: 1 / 300,
  damageDistortion: 1 / 150,
  bearingCrackDistortion: 1 / 500,
  bearingDamageDistortion: 1 / 300,
  distortionDamage: 0.3,
  bridgeSpanDepth: 10,
  beamRebarRatio: 0.004,
}

/** Metres between two points of a footing over which the distortion of what stands on it is measured: a crack opens across about a metre of wall. */
export const DISTORTION_BASE = 1
/** Metres between the points a footprint is measured at, and the most points along one side. */
export const FOOTPRINT_STEP = 0.1
export const FOOTPRINT_MAX_SAMPLES = 40

export const resolveGroundLoss = (options: GroundLossOptions = {}): Required<GroundLossOptions> => ({
  ...GROUND_LOSS_DEFAULTS,
  ...Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)),
})

/** Depth of the bowl of `loss` at `r` metres from its centre: a paraboloid, as the terrain digs it. */
export const bowlDepth = (loss: GroundLoss, r: number): number => (r >= loss.radius ? 0 : loss.depth * (1 - (r / loss.radius) ** 2))

/**
 * Metres of the bearing zone under a point of a footing `embed` metres deep that the bowl of `loss` cuts away, the point being `r` metres from the bowl's
 * centre. The zone widens `spread` metres per metre down, so a bowl beside the footing undercuts it as soon as its wall reaches under that slope; the
 * deepest cut is looked for along the line to the centre, where the bowl is `D (1 - t² / R²)` deep and the zone `embed + (r - t) / spread`.
 */
export const undercutAt = (loss: GroundLoss, r: number, embed: number, spread: number): number => {
  if (loss.depth <= embed || loss.radius <= 0) return 0
  const reach = Math.min(r, loss.radius)
  const cut = (t: number): number => bowlDepth(loss, t) - Math.max(0, r - t) / spread - embed
  const steepest = (loss.radius * loss.radius) / (2 * loss.depth * spread)
  return Math.max(0, cut(reach), cut(Math.min(reach, steepest)), cut(0))
}

/**
 * A settlement profile less its chord (the straight line between its two ends): what is left is how the panel bent, the deflection ratio of Burland &
 * Wroth (1974). A panel that only turned as a whole (rigid tilt) does not crack.
 */
export const relativeToChord = (drops: readonly number[]): number[] => {
  const n = drops.length
  if (n < 2) return drops.map(() => 0)
  const first = drops[0]!
  const last = drops[n - 1]!
  return drops.map((v, k) => v - (first + ((last - first) * k) / (n - 1)))
}

/**
 * Largest angular distortion of a settlement profile (metres, one value every `step` metres): the change over `DISTORTION_BASE` metres, where it is, and
 * which way the profile goes down there (+1 toward the higher indices).
 */
export const distortionOf = (drops: readonly number[], step: number): { value: number; at: number; down: number } => {
  const span = Math.max(1, Math.round(DISTORTION_BASE / step))
  let value = 0
  let at = 0
  let down = 1
  for (let i = 0; i < drops.length; i++) {
    const j = Math.min(drops.length - 1, i + span)
    if (j === i) continue
    const change = drops[j]! - drops[i]!
    const beta = Math.abs(change) / Math.max((j - i) * step, DISTORTION_BASE)
    if (beta > value) {
      value = beta
      at = (i + j) / 2
      down = change >= 0 ? 1 : -1
    }
  }
  return { value, at, down }
}

/**
 * A stiff member does not follow the ground point by point: it spreads a local slump over about its characteristic length on the soil
 * (`(4 E I / k b)^(1/4)`, near a metre for a 15 x 30 cm ground beam on a medium soil). The profile averaged over `window` metres around each slice.
 */
export const smoothProfile = (drops: readonly number[], step: number, window: number): number[] => {
  const half = Math.max(0, Math.round(window / step / 2))
  return drops.map((_, k) => {
    let sum = 0
    let count = 0
    for (let i = Math.max(0, k - half); i <= Math.min(drops.length - 1, k + half); i++) {
      sum += drops[i]!
      count++
    }
    return sum / count
  })
}

/** Metres a ground beam spreads a slump of the soil under it over (see `smoothProfile`). */
export const BEAM_SPREAD = 1

/** Most points a settlement profile keeps along a part: one every 0.4 m of a 10 m beam is fine enough to draw it. */
export const SETTLEMENT_POINTS = 24

/** A settlement profile (metres, one value every `step` metres from 0) as at most `SETTLEMENT_POINTS` evenly spaced drops from end to end of the part. */
export const settlementProfile = (drops: readonly number[], step: number): number[] => {
  const n = drops.length
  if (n === 0) return [0, 0]
  const length = n * step
  const count = Math.max(2, Math.min(SETTLEMENT_POINTS, n + 1))
  const out: number[] = []
  for (let k = 0; k < count; k++) {
    // the drop of the slice under this point, between the centres of the slices around it
    const at = clampNumber((k / (count - 1)) * length / step - 0.5, 0, n - 1)
    const i = Math.floor(at)
    const j = Math.min(n - 1, i + 1)
    out.push(drops[i]! + (drops[j]! - drops[i]!) * (at - i))
  }
  return out
}

const clampNumber = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))

/** The drop of a settlement at a point (object-local): along the line `from`-`to`, between its points, held at the ends past them. */
export const settlementAt = (settlement: PartSettlement, point: Vec3): number => {
  const d: Vec3 = [settlement.to[0] - settlement.from[0], settlement.to[1] - settlement.from[1], settlement.to[2] - settlement.from[2]]
  const length2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
  const t = length2 > 0 ? clampNumber(((point[0] - settlement.from[0]) * d[0] + (point[1] - settlement.from[1]) * d[1] + (point[2] - settlement.from[2]) * d[2]) / length2, 0, 1) : 0
  const drops = settlement.drop
  if (drops.length === 0) return 0
  const at = t * (drops.length - 1)
  const i = Math.floor(at)
  const j = Math.min(drops.length - 1, i + 1)
  return drops[i]! + (drops[j]! - drops[i]!) * (at - i)
}

/** What a part shows after another settlement: on the same line the deeper drop at each point; on another line the one that went down more on average. */
export const mergeSettlement = (old: PartSettlement | undefined, next: PartSettlement): PartSettlement => {
  if (!old) return next
  const same = old.from.every((v, k) => Math.abs(v - next.from[k]!) < 1e-6) && old.to.every((v, k) => Math.abs(v - next.to[k]!) < 1e-6)
  if (same && old.drop.length === next.drop.length) return { from: old.from, to: old.to, drop: old.drop.map((v, k) => Math.max(v, next.drop[k]!)) }
  const mean = (line: PartSettlement): number => line.drop.reduce((sum, v) => sum + v, 0) / Math.max(1, line.drop.length)
  return mean(old) >= mean(next) ? old : next
}
