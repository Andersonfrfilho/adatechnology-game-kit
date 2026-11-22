// @ts-check
// The base of the room-explosion gate only gets better (spec 017 review): a night that passes keeps, per compared metric, the smaller of the base and the night.
// Copying the whole report over the base let a drift of 2.9 ms a night (65, 68, 71...) pass forever, since each night was compared only with the one before.

/**
 * @typedef {{ variant: string, throttle: number, kind: string, p99: number, max: number }} BaseCell
 * @typedef {{ variant: string, throttle: number, kind: string, f0Ms: number, afterMs: number }} BaseMetric
 * @typedef {{ budgetMode?: string, explosive?: string, cells?: BaseCell[], frameMetrics?: BaseMetric[], pageSha256?: string, pageBuild?: { commit: string, dirty: boolean, builtAt: string } | null, machine?: { gpu?: { renderer?: string, vendor?: string, tier?: string, driver?: { module?: string | null, userspace?: string | null, mismatch?: boolean | 'unknown' } } } }} BaseReport
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import { assertReportHasHealthyGpu, gpuMismatchReasons } from './gpu-info.mjs'
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

/** Why a night is not merged into the base (another GPU or driver, or a base that does not record its GPU), or undefined. @param {BaseReport} base @param {BaseReport} report @returns {string | undefined} */
export const skipReasonOf = (base, report) => gpuMismatchReasons(base.machine?.gpu, report.machine?.gpu).join('; ') || undefined

/** @param {{ renderer?: string, driver?: { module?: string | null } } | undefined} gpu */
const gpuLabelOf = (gpu) => (gpu?.renderer ? `${gpu.renderer} / driver ${gpu.driver?.module ?? '?'}` : 'sem placa registrada')

/** The (base GPU/driver, current GPU/driver) pair of a skipped base: the notification is sent once per pair. @param {BaseReport} base @param {BaseReport} report @returns {string} */
export const gpuPairKeyOf = (base, report) => `${gpuLabelOf(base.machine?.gpu)} => ${gpuLabelOf(report.machine?.gpu)}`

/** The hand procedure in one line, for the nightly's summary and notification (steps in docs/desempenho-explosoes.md, "Gravar a base à mão"). */
export const REBASE_COMMAND = 'pnpm build && flock ~/.cache/adatechnology-game-kit/perf-measure.lock env ROOM_EXPLOSION_FRAME_PARTS=1 ROOM_EXPLOSION_OUT=/tmp/room-explosion-novo.json node tools/gpu/perf-gate.mjs room-explosion  # confira o relatório e: cp /tmp/room-explosion-novo.json ~/.cache/adatechnology-game-kit/room-explosion-base.json'

/**
 * What the nightly says when the base was skipped: the summary line (every night) and the notification (once per pair of GPU/driver, remembered in `notified`).
 * @param {{ skipped: string, pair: string, notified: readonly string[] }} params
 * @returns {{ line: string, notification: { title: string, body: string } | undefined, notified: string[] }}
 */
export const baseSkipReportOf = ({ skipped, pair, notified }) => {
  const message = `base NÃO comparada nem gravada (${skipped}). Regrave à mão, passos em docs/desempenho-explosoes.md "Gravar a base à mão": ${REBASE_COMMAND}`
  const isNew = !notified.includes(pair)
  return {
    line: `- room-explosion-base: ${message}`,
    notification: isNew ? { title: 'game-kit: room-explosion base de outra placa/driver', body: message } : undefined,
    notified: isNew ? [...notified, pair] : [...notified],
  }
}

/**
 * The base to save after a night that passed. Without a base, or with one measured in another mode or with another explosive, the night is the base; otherwise nothing rises.
 * A report with an explosive other than c4 is never the base nor merged into it: the base stays as it was (undefined when there was none). The same for a report
 * measured on another GPU or with another driver module than the base's: its numbers are not comparable, so the base stays as it was until it is replaced by hand.
 * @template {BaseReport} TReport
 * @param {BaseReport | undefined} base @param {TReport} report @returns {TReport | undefined}
 */
export const mergeBase = (base, report) => {
  if ((report.explosive ?? DEFAULT_EXPLOSIVE) !== DEFAULT_EXPLOSIVE) return /** @type {TReport | undefined} */ (base)
  if (base && skipReasonOf(base, report)) return /** @type {TReport} */ (base)
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
 * @param {string} reportFile @param {string} baseFile @param {string} head @returns {{ skipped?: string, pair?: string }}
 */
export const saveBase = (reportFile, baseFile, head) => {
  const report = JSON.parse(readFileSync(reportFile, 'utf8'))
  assertReportIsOfHead(report, head)
  assertReportHasHealthyGpu(report)
  const base = existsSync(baseFile) ? JSON.parse(readFileSync(baseFile, 'utf8')) : undefined
  const merged = mergeBase(base, report)
  if (merged) writeFileSync(baseFile, JSON.stringify(merged, null, 1))
  const skipped = base && (report.explosive ?? DEFAULT_EXPLOSIVE) === DEFAULT_EXPLOSIVE ? skipReasonOf(base, report) : undefined
  return skipped && base ? { skipped, pair: gpuPairKeyOf(base, report) } : {}
}

/**
 * `saveBase` that reports a refusal (or any failure) instead of throwing, for a caller that must record it and go on; `skipped` says why the base was left as it was.
 * @param {string} reportFile @param {string} baseFile @param {string} head @returns {{ ok: true, skipped?: string, pair?: string } | { ok: false, reason: string }}
 */
export const trySaveBase = (reportFile, baseFile, head) => {
  try {
    return { ok: true, ...saveBase(reportFile, baseFile, head) }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
