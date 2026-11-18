import type { AnyWorkerKind } from '@adatechnology/game-contracts'
import { crowdPhysicsKind } from '@adatechnology/game-crowd'
import { groundTilesKind } from '@adatechnology/game-destruction-three/worker-kinds'
import { shapesGenerateKind } from '@adatechnology/game-shapes/worker-kinds'

/**
 * Every kind of the kit a game hands to workers (CLAUDE.md §14): the file each worker loads installs them, with the game's own after them.
 * `dist/kit-worker.js` (a module) and `dist/kit-worker.global.js` (a classic script, for a Blob of a one-file page) are that file with the
 * kit's kinds alone.
 */
export const KIT_WORKER_KINDS: readonly AnyWorkerKind[] = Object.freeze([crowdPhysicsKind as AnyWorkerKind, groundTilesKind as AnyWorkerKind, shapesGenerateKind as AnyWorkerKind])
