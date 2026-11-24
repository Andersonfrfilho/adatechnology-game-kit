import type { KitWorldDebrisOptions } from './destruction'
import type { KitWorldFrame } from './frame'
import type { KitWorldPhysics } from './physics'
import type { KitWorldInfo } from './types'
import type { KitWorldWorkers } from './workers'

/** What the host turned on and what it could not. */
export function createInfo({ physics, frame, debris, workers }: { readonly physics: KitWorldPhysics; readonly frame: KitWorldFrame; readonly debris: KitWorldDebrisOptions; readonly workers: KitWorldWorkers }): KitWorldInfo {
  const isGroundWorker = debris.groundWorker !== false && (debris.groundWorker !== undefined || workers.groundPort !== null)
  const off = debris.groundWorker === false ? 'turned off' : workers.coordinator === null ? 'no workers' : 'the coordinator has no real workers'
  return {
    physics: physics.info,
    blastPacing: frame.blastPacing !== undefined,
    blastDebris: debris.blast !== false,
    groundWorker: isGroundWorker,
    ...(isGroundWorker ? {} : { groundWorkerOff: off }),
    workers: workers.coordinator?.stats().workers ?? 0,
  }
}
