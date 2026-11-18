import type { WorkerCoordinator } from '@adatechnology/game-contracts'
import { browserSpawn, canSpawnBrowserWorkers, createWorkerCoordinator } from '@adatechnology/game-workers'
import type { CoordinatorOptions, Spawn, WorkerPlan } from '@adatechnology/game-workers'

export interface KitWorkersOptions extends Omit<CoordinatorOptions, 'spawn'> {
  /**
   * How a worker is made. Default: module workers of this package's `kit-worker.js` where the runtime has `Worker`, none elsewhere. A
   * one-file page passes `sourceSpawn(text of kit-worker.global.js)`; Node passes `nodeSpawn(url)`; `null` runs every job on the main thread.
   */
  readonly spawn?: Spawn | null
}

/**
 * The kit's worker coordinator, on by default (owner, 2026-11-18): the automatic number of workers by the machine's cores, the kit's kinds
 * with their own schedules. A game configures it by hand through the same options (`workers`, `lanes`, `kinds`, `reserveCores`), passes
 * its own coordinator to the modules instead, or turns it off with `workers: 0`. The modules take it through their options
 * (`crowdPhysics.workers`, `createCoordinatorGroundPort(workers)`).
 */
export function createKitWorkers(options: KitWorkersOptions = {}): WorkerCoordinator & { readonly plan: WorkerPlan } {
  const { spawn, ...rest } = options
  const made = spawn === null ? undefined : (spawn ?? (canSpawnBrowserWorkers() ? browserSpawn(new URL('./kit-worker.js', import.meta.url), { name: 'kit-worker' }) : undefined))
  return createWorkerCoordinator({ ...rest, ...(made ? { spawn: made } : { workers: 0 }) })
}
