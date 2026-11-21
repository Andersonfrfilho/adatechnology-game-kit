// @ts-check
// The base of the room-explosion gate only gets better (spec 017 review): a night that passes keeps, per compared metric, the smaller of the base and the night.
// Copying the whole report over the base let a drift of 2.9 ms a night (65, 68, 71...) pass forever, since each night was compared only with the one before.

/**
 * @typedef {{ variant: string, throttle: number, kind: string, p99: number, max: number }} BaseCell
 * @typedef {{ variant: string, throttle: number, kind: string, f0Ms: number, afterMs: number }} BaseMetric
 * @typedef {{ budgetMode?: string, explosive?: string, cells?: BaseCell[], frameMetrics?: BaseMetric[], pageSha256?: string, pageBuild?: { commit: string, dirty: boolean, builtAt: string } | null }} BaseReport
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { DEFAULT_EXPLOSIVE } from './room-explosion-frame.mjs'

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
 * The base to save after a night that passed. Without a base, or with one measured in another mode or with another explosive, the night is the base; otherwise nothing rises.
 * A report with an explosive other than c4 is never the base nor merged into it: the base stays as it was (undefined when there was none).
 * @template {BaseReport} TReport
 * @param {BaseReport | undefined} base @param {TReport} report @returns {TReport | undefined}
 */
export const mergeBase = (base, report) => {
  if ((report.explosive ?? DEFAULT_EXPLOSIVE) !== DEFAULT_EXPLOSIVE) return /** @type {TReport | undefined} */ (base)
  if (!base || base.budgetMode !== report.budgetMode || (base.explosive ?? DEFAULT_EXPLOSIVE) !== DEFAULT_EXPLOSIVE) return report
  // the merged numbers come from several nights and commits, so no single stamp or hash describes them
  const { pageSha256: _lastNightPage, pageBuild: _lastNightBuild, ...reportWithoutPage } = report
  return /** @type {TReport} */ ({
    ...reportWithoutPage,
    cells: mergeEntries(base.cells ?? [], report.cells ?? [], ['p99', 'max']),
    frameMetrics: mergeEntries(base.frameMetrics ?? [], report.frameMetrics ?? [], ['f0Ms', 'afterMs']),
  })
}

/**
 * The saved-page variables of an environment; an empty variable is an unset one.
 * @param {Record<string, string | undefined>} env @returns {{ page: string | undefined, otherPage: string | undefined }}
 */
export const savedPagesOf = (env) => ({ page: env.ROOM_EXPLOSION_PAGE || undefined, otherPage: env.ROOM_EXPLOSION_OTHER_PAGE || undefined })

/**
 * The nightly's base comes from the commit's own build: a saved page would put another build's numbers in it.
 * @param {Record<string, string | undefined>} env
 */
export const assertNightlyBuildsItsOwnPage = (env) => {
  const { page, otherPage } = savedPagesOf(env)
  if (page === undefined && otherPage === undefined) return
  throw new Error('nightly: ROOM_EXPLOSION_PAGE and ROOM_EXPLOSION_OTHER_PAGE are set: the nightly measures the build of its own commit, never a saved page (unset them)')
}

/**
 * The base only takes a report of a clean build of the commit being saved: a stale, dirty or unstamped page would put other code's numbers in it.
 * @param {BaseReport} report @param {string} head
 */
export const assertReportIsOfHead = (report, head) => {
  const build = report.pageBuild
  if (!build) throw new Error('base: the report has no pageBuild (the page carried no build stamp): refusing to save it as the base')
  if (build.dirty) throw new Error(`base: the report's page was built from a dirty tree (commit ${build.commit.slice(0, 12)}): refusing to save it as the base`)
  if (build.commit !== head) throw new Error(`base: the report's page was built at ${build.commit.slice(0, 12)} but HEAD is ${head.slice(0, 12)}: refusing to save it as the base`)
}

/**
 * Saves the base after a night that passed: `mergeBase` of the file's base and the night's report, which must be of a clean build of `head`. Writes nothing when `mergeBase` gives nothing (a non-c4 report and no base).
 * @param {string} reportFile @param {string} baseFile @param {string} head
 */
export const saveBase = (reportFile, baseFile, head) => {
  const report = JSON.parse(readFileSync(reportFile, 'utf8'))
  assertReportIsOfHead(report, head)
  const base = existsSync(baseFile) ? JSON.parse(readFileSync(baseFile, 'utf8')) : undefined
  const merged = mergeBase(base, report)
  if (merged) writeFileSync(baseFile, JSON.stringify(merged, null, 1))
}
