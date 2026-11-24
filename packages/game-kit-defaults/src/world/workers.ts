import type { WorkerCoordinator } from '@adatechnology/game-contracts'
import { createCoordinatorGroundPort } from '@adatechnology/game-destruction-three'
import type { GroundWorkerPort } from '@adatechnology/game-destruction-three'

import { createKitWorkers } from '../workers'

export type KitWorldWorkers = {
  /** The coordinator the world's modules take, or null with `workers: 0`. */
  readonly coordinator: WorkerCoordinator | null
  /** The ground tiles in workers: the port of the coordinator, only when it has real workers. */
  readonly groundPort: GroundWorkerPort | null
  /** Terminates the coordinator the host made; one the game handed in is not touched. */
  dispose(): void
}

/** A coordinator of the kit's kinds by default (the automatic count by the cores), the game's own, or none. */
export function createWorkers({ workers: option, isGroundWorkerAllowed }: { readonly workers: WorkerCoordinator | 0 | undefined; readonly isGroundWorkerAllowed: boolean }): KitWorldWorkers {
  const coordinator = option === 0 ? null : (option ?? createKitWorkers())
  const isOwned = option === undefined
  const hasWorkers = coordinator !== null && coordinator.stats().workers > 0
  return {
    coordinator,
    groundPort: coordinator !== null && hasWorkers && isGroundWorkerAllowed ? createCoordinatorGroundPort(coordinator) : null,
    dispose: () => {
      if (isOwned) coordinator?.dispose()
    },
  }
}
