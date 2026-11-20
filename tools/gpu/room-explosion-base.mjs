// @ts-check
// The base of the room-explosion gate only gets better (spec 017 review): a night that passes keeps, per compared metric, the smaller of the base and the night.
// Copying the whole report over the base let a drift of 2.9 ms a night (65, 68, 71...) pass forever, since each night was compared only with the one before.

/**
 * @typedef {{ variant: string, throttle: number, kind: string, p99: number, max: number }} BaseCell
 * @typedef {{ variant: string, throttle: number, kind: string, f0Ms: number, afterMs: number }} BaseMetric
 * @typedef {{ budgetMode?: string, cells?: BaseCell[], frameMetrics?: BaseMetric[] }} BaseReport
 */

const keyOf = (/** @type {{ variant: string, throttle: number, kind: string }} */ entry) => `${entry.variant}|${entry.throttle}|${entry.kind}`
/** The smaller of two readings; a reading that is 0 or missing is not a reading. @param {number} was @param {number} now */
const better = (was, now) => (now > 0 && (was > 0 ? now < was : true) ? now : was)

/**
 * Merges by key: the numbers named in `fields` take `min(base, now)`, a new key enters, a key only the base has stays.
 * @template {{ variant: string, throttle: number, kind: string }} TEntry
 * @param {TEntry[]} base @param {TEntry[]} now @param {(keyof TEntry & string)[]} fields @returns {TEntry[]}
 */
const mergeEntries = (base, now, fields) => {
  const merged = new Map(base.map((entry) => [keyOf(entry), entry]))
  for (const entry of now) {
    const was = merged.get(keyOf(entry))
    if (!was) { if (fields.some((field) => Number(entry[field]) > 0)) merged.set(keyOf(entry), entry); continue }
    merged.set(keyOf(entry), { ...entry, ...Object.fromEntries(fields.map((field) => [field, better(Number(was[field]), Number(entry[field]))])) })
  }
  return [...merged.values()]
}

/**
 * The base to save after a night that passed. Without a base, or with one measured in another mode, the night is the base; otherwise nothing rises.
 * @template {BaseReport} TReport
 * @param {BaseReport | undefined} base @param {TReport} report @returns {TReport}
 */
export const mergeBase = (base, report) => {
  if (!base || base.budgetMode !== report.budgetMode) return report
  return {
    ...report,
    cells: mergeEntries(base.cells ?? [], report.cells ?? [], ['p99', 'max']),
    frameMetrics: mergeEntries(base.frameMetrics ?? [], report.frameMetrics ?? [], ['f0Ms', 'afterMs']),
  }
}
