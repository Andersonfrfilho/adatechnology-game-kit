// The worker of the room's coordinator (CLAUDE.md §14): every kind the room's modules hand to workers. build.mjs bundles it to text and the
// pages make their workers from it (`sourceSpawn`): a page of one file has no worker file beside it.
import { crowdPhysicsKind } from '@adatechnology/game-crowd'
import { installWorkerHost } from '@adatechnology/game-workers'

installWorkerHost(/** @type {import('@adatechnology/game-workers').WorkerScopeLike} */ (/** @type {unknown} */ (self)), [crowdPhysicsKind])
