// @ts-check
// The explosion's whole frame, as the room-explosion gate reads it (spec 017, trava 1): pure functions, no browser.
// The physics column of the ruler (p99/max per cell) never saw frame 0 as a whole: the f0 could double without blocking. Here, per kind, two numbers
// from the stage pass (`ROOM_EXPLOSION_FRAME_PARTS=1`, so the render time is in the rows): `f0Ms` and `afterMs`, compared with the base report.

/** The explosive every saved base is measured with; a report without the field was measured with it. */
export const DEFAULT_EXPLOSIVE = 'c4'

/** How many of the worst f0 (one per stage round) `f0Ms` averages. */
export const WORST_F0_COUNT = 3
/** How many frames after the strike's frame `afterMs` looks at (its worst one). */
export const AFTER_FRAMES = 7
/** How much worse than the base the f0 or the frames after it may read before it blocks, and the floor under which a difference is the noise between sessions (the same code read +-2 ms between sessions, evidence 017 rounds 3 to 5). */
export const FRAME_REGRESSION = { tolerance: 0.15, floorMs: 3 }

/**
 * @typedef {{ variant: string, throttle: number, kind: string, round: number, frame: number, updateMs: number, extras?: Record<string, number> }} FrameRow
 * @typedef {{ variant: string, throttle: number, kind: string, f0Ms: number, afterMs: number }} FrameMetric
 * @typedef {{ budgetMode?: string, explosive?: string, frameMetrics?: FrameMetric[] }} SavedReport
 */

const round2 = (/** @type {number} */ value) => Math.round(value * 100) / 100
const mean = (/** @type {number[]} */ values) => values.reduce((total, value) => total + value, 0) / values.length
const wholeFrameMs = (/** @type {FrameRow} */ row) => row.updateMs + (row.extras?.renderCpu ?? 0)
/** The key of a cell of the report. @param {{ variant: string, throttle: number, kind: string }} entry */
export const frameKey = (entry) => `${entry.variant}|${entry.throttle}|${entry.kind}`

/**
 * @typedef {{ key: string, status: 'missing-hit-frame' | 'missing-after-frames' | 'too-few-rounds' }} FrameProblem
 * @typedef {{ metrics: FrameMetric[], problems: FrameProblem[] }} FrameMeasure
 */

/**
 * @typedef {{ isOk: false, status: 'missing-hit-frame' | 'missing-after-frames' }} RoundMissing
 * @typedef {{ isOk: true, hit: FrameRow, f0: number, after: number }} RoundRead
 */

/** The rows of one round, or why they cannot give a number: frame 0 (with the render time) and each of frames 1..AFTER_FRAMES (with it) must be there. @param {FrameRow[]} frames @returns {RoundRead | RoundMissing} */
const roundOf = (frames) => {
  const timed = frames.filter((row) => row.extras?.renderCpu !== undefined)
  const hit = timed.find((row) => row.frame === 0)
  if (!hit) return { isOk: false, status: 'missing-hit-frame' }
  const after = timed.filter((row) => row.frame >= 1 && row.frame <= AFTER_FRAMES).map(wholeFrameMs)
  if (after.length < AFTER_FRAMES) return { isOk: false, status: 'missing-after-frames' }
  return { isOk: true, hit, f0: wholeFrameMs(hit), after: Math.max(...after) }
}

/** @param {RoundRead | RoundMissing} entry @returns {entry is RoundRead} */
const isRead = (entry) => entry.isOk

/** One group's metric, or its problem: a round that cannot be read stops it, so a hole in the data is never averaged over. @param {string} key @param {FrameRow[][]} rounds @returns {{ metric: FrameMetric } | { problem: FrameProblem }} */
const metricOf = (key, rounds) => {
  const read = rounds.map(roundOf)
  const missing = read.find((entry) => !entry.isOk)
  if (missing && !missing.isOk) return { problem: { key, status: missing.status } }
  const worst = read.filter(isRead).sort((left, right) => right.f0 - left.f0).slice(0, WORST_F0_COUNT)
  const first = worst[0]
  if (worst.length < WORST_F0_COUNT || !first) return { problem: { key, status: 'too-few-rounds' } }
  const { variant, throttle, kind } = first.hit
  return { metric: { variant, throttle, kind, f0Ms: round2(mean(worst.map((entry) => entry.f0))), afterMs: round2(mean(worst.map((entry) => entry.after))) } }
}

/**
 * `f0Ms` (mean of the worst three f0, update + renderCpu) and `afterMs` (mean, over those same rounds, of the worst of the seven frames after the strike) per variant, throttle and kind.
 * A group that cannot give both numbers honestly gives a problem instead (`missing-hit-frame`, `missing-after-frames`, `too-few-rounds`), never a number: a 0 in the base would block everything after it.
 * A run where no row has the render time (no frame parts) gives nothing at all.
 * @param {FrameRow[]} rows every frame of the stage pass @returns {FrameMeasure}
 */
export const frameMetricsOf = (rows) => {
  if (!rows.some((entry) => entry.extras?.renderCpu !== undefined)) return { metrics: [], problems: [] }
  /** @type {Map<string, Map<number, FrameRow[]>>} */
  const groups = new Map()
  for (const row of rows) {
    const rounds = groups.get(frameKey(row)) ?? new Map()
    rounds.set(row.round, [...(rounds.get(row.round) ?? []), row])
    groups.set(frameKey(row), rounds)
  }
  const results = [...groups.entries()].map(([key, rounds]) => metricOf(key, [...rounds.values()]))
  return { metrics: results.flatMap((entry) => ('metric' in entry ? [entry.metric] : [])), problems: results.flatMap((entry) => ('problem' in entry ? [entry.problem] : [])) }
}

/** Whether a value is worse than the base by more than the tolerance and the floor (`rule` only for tests). @param {number} now @param {number} was @param {{ tolerance: number, floorMs: number }} [rule] */
export const isFrameWorse = (now, was, rule = FRAME_REGRESSION) => now > was * (1 + rule.tolerance) + 1e-9 && now - was > rule.floorMs + 1e-9

/**
 * Whether a saved base can be compared with a run: only if it was measured in the same frame budget mode (a quota number is not a deadline number) and with the same explosive.
 * A missing mode counts as different; a missing explosive counts as c4. A run with another explosive than c4 is never comparable.
 * @param {SavedReport | undefined} base @param {string} mode @param {string} [explosive]
 */
export const isBaseComparable = (base, mode, explosive = DEFAULT_EXPLOSIVE) =>
  base !== undefined && base.budgetMode === mode && explosive === DEFAULT_EXPLOSIVE && (base.explosive ?? DEFAULT_EXPLOSIVE) === explosive

/** @typedef {'compared' | 'no-frame-parts' | 'unmeasurable' | 'no-blocking-level' | 'no-base' | 'other-mode' | 'other-explosive' | 'base-without-metrics'} GateStatus */

/**
 * The gate of the explosion frame: the metrics that got worse than the base, or why nothing was compared. Only the metrics of the blocking level (default variant, a gated throttle) count;
 * the kinds that are in one side and not in the other are listed in `skipped`.
 * @param {{ measure: FrameMeasure, base: SavedReport | undefined, mode: string, variant: string, gated: Set<number>, explosive?: string }} params
 * @returns {{ status: GateStatus, compared: boolean, reason: string, regressions: { key: string, field: 'f0Ms' | 'afterMs', now: number, was: number }[], problems: FrameProblem[], skipped: string[] }}
 */
export const frameGate = ({ measure, base, mode, variant, gated, explosive = DEFAULT_EXPLOSIVE }) => {
  const blocking = measure.metrics.filter((entry) => entry.variant === variant && gated.has(entry.throttle))
  const none = (/** @type {GateStatus} */ status, /** @type {string} */ reason) => ({ status, compared: false, reason, regressions: [], problems: measure.problems, skipped: /** @type {string[]} */ ([]) })
  if (measure.metrics.length === 0 && measure.problems.length === 0) return none('no-frame-parts', 'the run has no frame parts (ROOM_EXPLOSION_FRAME_PARTS=1 and a stage pass are needed)')
  if (measure.metrics.length === 0) return none('unmeasurable', `no kind gave a number: ${measure.problems.map((entry) => `${entry.key} ${entry.status}`).join(', ')}`)
  if (blocking.length === 0) return none('no-blocking-level', `there are metrics but none at the blocking level (${variant}, ${[...gated].map((level) => `${level}x`).join(', ')}): check ROOM_EXPLOSION_STAGE_THROTTLES`)
  if (explosive !== DEFAULT_EXPLOSIVE) return none('other-explosive', `this run detonated ${explosive}, the base is c4: a run with another explosive is never compared`)
  if (!base) return none('no-base', 'no base report')
  if (!isBaseComparable(base, mode, explosive)) {
    if (base.budgetMode !== mode) return none('other-mode', `the base was measured in ${base.budgetMode ?? 'no mode'}, this run in ${mode}`)
    return none('other-explosive', `the base was measured with ${base.explosive}, this run with ${explosive}`)
  }
  if (!base.frameMetrics || base.frameMetrics.length === 0) return none('base-without-metrics', 'the base has no frameMetrics')
  const was = new Map(base.frameMetrics.map((entry) => [frameKey(entry), entry]))
  const regressions = blocking.flatMap((entry) => {
    const before = was.get(frameKey(entry))
    if (!before) return []
    return /** @type {const} */ (['f0Ms', 'afterMs']).filter((field) => isFrameWorse(entry[field], before[field])).map((field) => ({ key: frameKey(entry), field, now: entry[field], was: before[field] }))
  })
  const nowKeys = new Set(blocking.map(frameKey))
  const atLevel = base.frameMetrics.filter((entry) => entry.variant === variant && gated.has(entry.throttle))
  const skipped = [...atLevel.filter((entry) => !nowKeys.has(frameKey(entry))).map((entry) => `${frameKey(entry)} (in the base, not in this run)`), ...blocking.filter((entry) => !was.has(frameKey(entry))).map((entry) => `${frameKey(entry)} (in this run, not in the base)`)]
  return { status: 'compared', compared: true, reason: 'compared with the base', regressions, problems: measure.problems, skipped }
}
