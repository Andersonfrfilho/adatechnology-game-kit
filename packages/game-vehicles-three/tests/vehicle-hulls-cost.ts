import * as THREE from 'three'

import type { WorkerCoordinator } from '@adatechnology/game-contracts'

import { createHullPlanCache, createVehicleColliders } from '../src'
import { hullPlanKind } from '../src/worker-kinds'
import { build } from './vehicle-colliders-support'

export interface BirthCost {
  readonly id: string
  readonly hulls: number
  /** The longest call of `hulls()` of the first car while its plan is made and sent to the worker, ms: what is left in a frame. */
  readonly firstMs: number
  /** The call of `hulls()` that installs the plan that came back, ms. */
  readonly installMs: number
  /** Until the plan is back and installed (the worker's time and the wait), ms. */
  readonly planMs: number
  /** The call of `hulls()` of the second car of the model, ms. */
  readonly secondMs: number
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** What it costs a car to be born with hulls (design 10.4b): the first car of the model with the plan in a worker, then the second car, with a cache between them. */
export const birthCostOf = async (id: string, workers: WorkerCoordinator, maxHulls: number): Promise<BirthCost> => {
  await workers.warm([hullPlanKind])
  const cache = createHullPlanCache()
  const first = build(id)
  const second = build(id)
  try {
    const firstColliders = createVehicleColliders(THREE, first.vehicle, first.frame, { hulls: true, maxHulls, workers, planCache: cache })
    const secondColliders = createVehicleColliders(THREE, second.vehicle, second.frame, { hulls: true, maxHulls, workers, planCache: cache })
    firstColliders.pieces()
    secondColliders.pieces()
    const sent = performance.now()
    let firstMs = 0, installMs = 0
    do {
      const started = performance.now()
      const made = firstColliders.hulls()
      const took = performance.now() - started
      if (made.length > 0) installMs = took
      else firstMs = Math.max(firstMs, took)
      if (made.length === 0) await sleep(1)
    } while (firstColliders.isHullPending() || installMs === 0)
    const planMs = performance.now() - sent
    const started = performance.now()
    const given = secondColliders.hulls()
    const secondMs = performance.now() - started
    return { id, hulls: given.length, firstMs, installMs, planMs, secondMs }
  } finally {
    first.dispose()
    second.dispose()
    cache.dispose()
  }
}
