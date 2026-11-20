// @ts-check
// The explosion's whole frame, as the room-explosion gate reads it (spec 017, trava 1): pure functions, no browser.
// The physics column of the ruler (p99/max per cell) never saw frame 0 as a whole: the f0 could double without blocking. Here, per kind, two numbers
// from the stage pass (`ROOM_EXPLOSION_FRAME_PARTS=1`, so the render time is in the rows): `f0Ms` and `afterMs`, compared with the base report.

/** How many of the worst f0 (one per stage round) `f0Ms` averages. */
export const WORST_F0_COUNT = 3
/** How many frames after the strike's frame `afterMs` looks at (its worst one). */
export const AFTER_FRAMES = 7
/** How much worse than the base the f0 or the frames after it may read before it blocks, and the floor under which a difference is the noise between sessions (the same code read +-2 ms between sessions, evidence 017 rounds 3 to 5). */
export const FRAME_REGRESSION = { tolerance: 0.15, floorMs: 3 }

/**
 * @typedef {{ variant: string, throttle: number, kind: string, round: number, frame: number, updateMs: number, extras?: Record<string, number> }} FrameRow
 * @typedef {{ variant: string, throttle: number, kind: string, f0Ms: number, afterMs: number }} FrameMetric
 * @typedef {{ budgetMode?: string, frameMetrics?: FrameMetric[] }} SavedReport
 */

const round2 = (/** @type {number} */ value) => Math.round(value * 100) / 100
const mean = (/** @type {number[]} */ values) => values.reduce((total, value) => total + value, 0) / values.length
const wholeFrameMs = (/** @type {FrameRow} */ row) => row.updateMs + (row.extras?.renderCpu ?? 0)
/** The key of a cell of the report. @param {{ variant: string, throttle: number, kind: string }} entry */
export const frameKey = (entry) => `${entry.variant}|${entry.throttle}|${entry.kind}`

/**
 * `f0Ms` (mean of the worst three f0, update + renderCpu) and `afterMs` (mean, over those same rounds, of the worst of the seven frames after the strike) per variant, throttle and kind.
 * Rows without the render time (no frame parts) are left out: without it the number would be another thing.
 * @param {FrameRow[]} rows every frame of the stage pass @returns {FrameMetric[]}
 */
export const frameMetricsOf = (rows) => {
  /** @type {Map<string, Map<number, FrameRow[]>>} */
  const groups = new Map()
  for (const row of rows.filter((entry) => entry.extras?.renderCpu !== undefined)) {
    const rounds = groups.get(frameKey(row)) ?? new Map()
    rounds.set(row.round, [...(rounds.get(row.round) ?? []), row])
    groups.set(frameKey(row), rounds)
  }
  return [...groups.values()].flatMap((rounds) => {
    const perRound = [...rounds.values()].flatMap((frames) => {
      const first = frames.find((row) => row.frame === 0)
      if (!first) return []
      const after = frames.filter((row) => row.frame >= 1 && row.frame <= AFTER_FRAMES).map(wholeFrameMs)
      return [{ first, f0: wholeFrameMs(first), after: after.length > 0 ? Math.max(...after) : 0 }]
    })
    const worst = perRound.sort((left, right) => right.f0 - left.f0).slice(0, WORST_F0_COUNT)
    if (worst.length === 0) return []
    const { variant, throttle, kind } = /** @type {NonNullable<typeof worst[0]>} */ (worst[0]).first
    return [{ variant, throttle, kind, f0Ms: round2(mean(worst.map((entry) => entry.f0))), afterMs: round2(mean(worst.map((entry) => entry.after))) }]
  })
}

/** Whether a value is worse than the base by more than the tolerance and the floor. @param {number} now @param {number} was */
export const isFrameWorse = (now, was) => now > was * (1 + FRAME_REGRESSION.tolerance) && now - was > FRAME_REGRESSION.floorMs

/**
 * Whether a saved base can be compared with a run: only if it was measured in the same frame budget mode (a quota number is not a deadline number). A missing mode counts as different.
 * @param {SavedReport | undefined} base @param {string} mode
 */
export const isBaseComparable = (base, mode) => base !== undefined && base.budgetMode === mode

/**
 * The gate of the explosion frame: the metrics that got worse than the base, or why nothing was compared.
 * @param {{ now: FrameMetric[], base: SavedReport | undefined, mode: string }} params `now` empty means the run had no frame parts
 * @returns {{ status: 'compared' | 'no-frame-parts' | 'no-base' | 'other-mode' | 'base-without-metrics', regressions: { key: string, field: 'f0Ms' | 'afterMs', now: number, was: number }[] }}
 */
export const frameGate = ({ now, base, mode }) => {
  if (now.length === 0) return { status: 'no-frame-parts', regressions: [] }
  if (!base) return { status: 'no-base', regressions: [] }
  if (!isBaseComparable(base, mode)) return { status: 'other-mode', regressions: [] }
  if (!base.frameMetrics || base.frameMetrics.length === 0) return { status: 'base-without-metrics', regressions: [] }
  const was = new Map(base.frameMetrics.map((entry) => [frameKey(entry), entry]))
  const regressions = now.flatMap((entry) => {
    const before = was.get(frameKey(entry))
    if (!before) return []
    return /** @type {const} */ (['f0Ms', 'afterMs']).filter((field) => isFrameWorse(entry[field], before[field])).map((field) => ({ key: frameKey(entry), field, now: entry[field], was: before[field] }))
  })
  return { status: 'compared', regressions }
}
