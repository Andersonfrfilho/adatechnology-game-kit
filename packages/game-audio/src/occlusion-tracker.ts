import type { Vec3 } from '@adatechnology/game-contracts'

import { OCCLUSION_DEFAULTS, occlusionState, totalLossDb } from './occlusion'
import type { OcclusionSetup, OcclusionState } from './occlusion'

export type OcclusionChange = { readonly id: number; readonly state: OcclusionState }

export type OcclusionAdd = {
  readonly id: number
  readonly source: Vec3
  /** The voice's level before the wall (what the plan decided). */
  readonly level: number
  readonly listener: Vec3
  readonly now: number
}

export type OcclusionTracker = {
  /**
   * Queries now and returns the state the voice starts with. Once this update window has spent its `budget`, or when the running cost of a query does not
   * fit in what is left of its `budgetMs`, the voice starts with a guess instead (the state of the nearest measured voice within `NEIGHBOUR_RADIUS`, else the last result for that source position, else unoccluded)
   * without querying, and the next `update`s measure it first and glide to the answer.
   */
  add(voice: OcclusionAdd): OcclusionState
  remove(id: number): void
  has(id: number): boolean
  state(id: number): OcclusionState | undefined
  /**
   * Opens a new window, measures the pending voices (oldest first), then re-queries the ones that are due, the stalest first, at most `budget` queries in
   * all and while `budgetMs` lasts (the first query always runs); returns the ones whose state moved. A pending voice takes its measure exactly.
   */
  update(listener: Vec3, now: number): readonly OcclusionChange[]
  readonly size: number
}

type Entry = { readonly source: Vec3; readonly level: number; state: OcclusionState; pending: boolean; checkedAt: number; checkedFrom: Vec3; served: number }

/** Metres within which a measured voice stands in for a new one the budget had no room to measure. */
export const NEIGHBOUR_RADIUS = 2
const REMEMBERED = 64
/** Weight of the newest query in the running estimate of a query's cost: half, so one slow query (a vehicle on the path) is felt at once and a run of cheap ones brings it back down within a few. */
const COST_WEIGHT = 0.5
const MOVED = 0.05
const CHANGED_DB = 0.5

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const copy = (point: Vec3): Vec3 => [point[0], point[1], point[2]]
const keyOf = (point: Vec3): string => point.map((value) => Math.round(value * 4)).join(',')

export function createOcclusionTracker(setup: OcclusionSetup): OcclusionTracker {
  const entries = new Map<number, Entry>()
  let served = 0
  let spent = 0
  let spentMs = 0
  // the running cost of one query (ms); undefined until the first one, so the first query of the session runs
  let costMs: number | undefined
  const remembered = new Map<string, OcclusionState>()
  const interval = setup.interval ?? OCCLUSION_DEFAULTS.interval
  const budget = Math.max(1, setup.budget ?? OCCLUSION_DEFAULTS.budget)
  const audibleLevel = setup.audibleLevel ?? OCCLUSION_DEFAULTS.audibleLevel
  const budgetMs = setup.budgetMs ?? OCCLUSION_DEFAULTS.budgetMs
  const clock = setup.clock ?? (() => performance.now())
  const measure = (source: Vec3, listener: Vec3): OcclusionState => {
    const started = clock()
    const state = occlusionState(totalLossDb(setup.query(source, listener), setup), setup)
    const cost = clock() - started
    spentMs += cost
    costMs = costMs === undefined ? cost : costMs + (cost - costMs) * COST_WEIGHT
    const key = keyOf(source)
    remembered.delete(key)
    remembered.set(key, state)
    if (remembered.size > REMEMBERED) remembered.delete(remembered.keys().next().value as string)
    return state
  }
  const guess = (source: Vec3): OcclusionState => {
    let nearest: Entry | undefined
    let nearestDistance = NEIGHBOUR_RADIUS
    for (const voice of entries.values()) {
      if (voice.pending) continue
      const apart = distance(voice.source, source)
      if (apart <= nearestDistance) [nearest, nearestDistance] = [voice, apart]
    }
    return nearest?.state ?? remembered.get(keyOf(source)) ?? occlusionState(0, setup)
  }

  return {
    add({ id, source, level, listener, now }) {
      const from = copy(source)
      const at = copy(listener)
      // a query is made here only when what one has been costing fits in what is left of the frame: an expensive one waits for `update`
      if (spent >= budget || spentMs >= budgetMs || spentMs + (costMs ?? 0) > budgetMs) {
        const provisional = guess(from)
        entries.set(id, { source: from, level, state: provisional, pending: true, checkedAt: now, checkedFrom: at, served: served++ })
        return provisional
      }
      spent++
      const state = measure(from, at)
      entries.set(id, { source: from, level, state, pending: false, checkedAt: now, checkedFrom: at, served: served++ })
      return state
    },
    remove: (id) => void entries.delete(id),
    has: (id) => entries.has(id),
    state: (id) => entries.get(id)?.state,
    update(listener, now) {
      spent = 0
      spentMs = 0
      const at = copy(listener)
      const changes: OcclusionChange[] = []
      let queries = 0
      const canQuery = (): boolean => queries < budget && (queries === 0 || spentMs < budgetMs)
      for (const [id, voice] of entries) {
        if (!voice.pending) continue
        if (!canQuery()) break
        queries++
        const state = measure(voice.source, at)
        voice.pending = false
        voice.checkedAt = now
        voice.checkedFrom = at
        voice.served = served++
        // the exact measure, not the guess within `CHANGED_DB`: a voice measured late ends where one measured on `add` would be
        if (state.lossDb === voice.state.lossDb) continue
        voice.state = state
        changes.push({ id, state })
      }
      const due: [number, Entry][] = []
      for (const entry of entries) {
        const [, voice] = entry
        if (voice.pending || now - voice.checkedAt < interval || voice.level < audibleLevel) continue
        due.push(entry)
      }
      due.sort((a, b) => a[1].checkedAt - b[1].checkedAt || a[1].served - b[1].served)
      for (const [id, voice] of due) {
        if (distance(voice.checkedFrom, at) < MOVED) {
          voice.checkedAt = now
          continue
        }
        if (!canQuery()) break
        queries++
        const state = measure(voice.source, at)
        voice.checkedAt = now
        voice.checkedFrom = at
        voice.served = served++
        if (Math.abs(state.lossDb - voice.state.lossDb) < CHANGED_DB) continue
        voice.state = state
        changes.push({ id, state })
      }
      return changes
    },
    get size() {
      return entries.size
    },
  }
}
