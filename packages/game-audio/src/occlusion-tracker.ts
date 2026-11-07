import type { Vec3 } from '@adatechnology/game-contracts'

import { OCCLUSION_DEFAULTS, occlusionState, totalLossDb } from './occlusion'
import type { OcclusionSetup, OcclusionState } from './occlusion'

/** `immediate`: the first state of a voice that waited for the budget, to be applied at once, not glided to. */
export type OcclusionChange = { readonly id: number; readonly state: OcclusionState; readonly immediate: boolean }

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
   * Queries now and returns the state the voice starts with, unless this update window has spent its `budget` already: then the voice is pending
   * (returns `undefined`) and the next `update` measures it first.
   */
  add(voice: OcclusionAdd): OcclusionState | undefined
  remove(id: number): void
  has(id: number): boolean
  state(id: number): OcclusionState | undefined
  /** Measures the pending voices, then re-queries the ones that are due, the stalest first, at most `budget` queries in all; returns the ones whose state moved. */
  update(listener: Vec3, now: number): readonly OcclusionChange[]
  readonly size: number
}

type Entry = { readonly source: Vec3; readonly level: number; state: OcclusionState | undefined; checkedAt: number; checkedFrom: Vec3; served: number }

const MOVED = 0.05
const CHANGED_DB = 0.5

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const copy = (point: Vec3): Vec3 => [point[0], point[1], point[2]]

export function createOcclusionTracker(setup: OcclusionSetup): OcclusionTracker {
  const entries = new Map<number, Entry>()
  let served = 0
  let spent = 0
  const interval = setup.interval ?? OCCLUSION_DEFAULTS.interval
  const budget = Math.max(1, setup.budget ?? OCCLUSION_DEFAULTS.budget)
  const audibleLevel = setup.audibleLevel ?? OCCLUSION_DEFAULTS.audibleLevel
  const measure = (source: Vec3, listener: Vec3): OcclusionState => occlusionState(totalLossDb(setup.query(source, listener), setup), setup)

  return {
    add({ id, source, level, listener, now }) {
      const from = copy(source)
      const at = copy(listener)
      if (spent >= budget) {
        entries.set(id, { source: from, level, state: undefined, checkedAt: now, checkedFrom: at, served: served++ })
        return undefined
      }
      spent++
      const state = measure(from, at)
      entries.set(id, { source: from, level, state, checkedAt: now, checkedFrom: at, served: served++ })
      return state
    },
    remove: (id) => void entries.delete(id),
    has: (id) => entries.has(id),
    state: (id) => entries.get(id)?.state,
    update(listener, now) {
      spent = 0
      const at = copy(listener)
      const changes: OcclusionChange[] = []
      let queries = 0
      for (const [id, voice] of entries) {
        if (voice.state || queries >= budget) continue
        queries++
        voice.state = measure(voice.source, at)
        voice.checkedAt = now
        voice.checkedFrom = at
        voice.served = served++
        changes.push({ id, state: voice.state, immediate: true })
      }
      const due: [number, Entry][] = []
      for (const entry of entries) {
        const [, voice] = entry
        if (!voice.state || now - voice.checkedAt < interval || voice.level < audibleLevel) continue
        due.push(entry)
      }
      due.sort((a, b) => a[1].checkedAt - b[1].checkedAt || a[1].served - b[1].served)
      for (const [id, voice] of due) {
        if (distance(voice.checkedFrom, at) < MOVED) {
          voice.checkedAt = now
          continue
        }
        if (queries >= budget) break
        queries++
        const state = measure(voice.source, at)
        voice.checkedAt = now
        voice.checkedFrom = at
        voice.served = served++
        if (!voice.state || Math.abs(state.lossDb - voice.state.lossDb) < CHANGED_DB) continue
        voice.state = state
        changes.push({ id, state, immediate: false })
      }
      return changes
    },
    get size() {
      return entries.size
    },
  }
}
