import type { HullPlan, HullPlanResult } from '@adatechnology/game-vehicles'

import type { VehicleHull } from './colliders'

/** A hull and the drawn vertices (x y z triples) it was made from. */
export interface SharedHull {
  readonly hull: VehicleHull
  readonly drawn: ArrayLike<number>
}

/** The hulls of an intact model, made once: what every car of it is given instead of making them. */
export interface SharedHulls {
  /** The pieces (names and vertex counts) and the hull ceiling it was made for: a car whose pieces differ makes its own. */
  readonly signature: string
  readonly plan: HullPlan
  readonly pieces: ReadonlyMap<string, readonly SharedHull[]>
  /** The solid parts' hulls (one each, whole), filled in by the first car that made them. */
  readonly solids: Map<string, { readonly signature: string; readonly hulls: VehicleHull[] }>
}

/** A division on its way (in a worker): the cars of the same model wait for it instead of sending another. */
export interface HullPlanFlight {
  readonly signature: string
  readonly promise: Promise<HullPlanResult>
}

export interface HullPlanCacheStats {
  readonly models: number
  /** Divisions made (here or in a worker). */
  readonly planned: number
  /** Cars given the hulls of a model that was already made. */
  readonly reused: number
}

/**
 * The hulls of the intact models, by model (the vehicle key, its seed key and its build state, and the ceiling): the division of a car is the same for every car of the model, so it is
 * made once. `dispose` lets everything go (design 10.4: the memory is the engine's shapes and these, nothing is kept after).
 */
export interface HullPlanCache {
  get(key: string): SharedHulls | undefined
  set(key: string, shared: SharedHulls): void
  flight(key: string): HullPlanFlight | undefined
  setFlight(key: string, flight: HullPlanFlight): void
  clearFlight(key: string): void
  noteReused(): void
  noteDivided(): void
  stats(): HullPlanCacheStats
  dispose(): void
}

export const createHullPlanCache = (): HullPlanCache => {
  const shared = new Map<string, SharedHulls>()
  const flights = new Map<string, HullPlanFlight>()
  let planned = 0, reused = 0
  let isDisposed = false
  return {
    get: (key) => shared.get(key),
    set: (key, value) => {
      if (!isDisposed && !shared.has(key)) shared.set(key, value)
    },
    flight: (key) => flights.get(key),
    setFlight: (key, flight) => void (isDisposed || flights.set(key, flight)),
    clearFlight: (key) => void flights.delete(key),
    noteReused: () => void reused++,
    noteDivided: () => void planned++,
    stats: () => ({ models: shared.size, planned, reused }),
    dispose: () => {
      isDisposed = true
      shared.clear()
      flights.clear()
      planned = 0
      reused = 0
    },
  }
}
