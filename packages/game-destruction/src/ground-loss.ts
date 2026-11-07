import type { GroundLoss, GroundLossOptions } from './types'

export const GROUND_LOSS_DEFAULTS: Required<GroundLossOptions> = {
  footingDepth: 0.5,
  spread: 1,
  voidDepth: 0.05,
  maxSettlement: 0.05,
  crackDistortion: 1 / 300,
  damageDistortion: 1 / 150,
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

/** The longest run of `true` in `flags`: first index and one past the last, or null. */
export const longestRun = (flags: readonly boolean[]): { start: number; end: number } | null => {
  let best: { start: number; end: number } | null = null
  let start = -1
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) {
      if (start < 0) start = i
      continue
    }
    if (start >= 0 && (!best || i - start > best.end - best.start)) best = { start, end: i }
    start = -1
  }
  return best
}

/** Largest angular distortion of a settlement profile (metres, one value every `step` metres): the change over `DISTORTION_BASE` metres, and where it is. */
export const distortionOf = (drops: readonly number[], step: number): { value: number; at: number } => {
  const span = Math.max(1, Math.round(DISTORTION_BASE / step))
  let value = 0
  let at = 0
  for (let i = 0; i < drops.length; i++) {
    const j = Math.min(drops.length - 1, i + span)
    if (j === i) continue
    const beta = Math.abs(drops[j]! - drops[i]!) / Math.max((j - i) * step, DISTORTION_BASE)
    if (beta > value) {
      value = beta
      at = (i + j) / 2
    }
  }
  return { value, at }
}
