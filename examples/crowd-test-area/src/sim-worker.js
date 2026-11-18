// The room's simulation thread (spec 009, T22): the horde steps here and the page draws its snapshots. build.mjs bundles it to text
// (`__KIT_SIM_SOURCE__`) and the page makes the thread from it with `sourceSpawn`.
import { hordeSimModule } from '@adatechnology/game-crowd'
import { installSimThread } from '@adatechnology/game-workers'

installSimThread(/** @type {import('@adatechnology/game-workers').WorkerScopeLike} */ (/** @type {unknown} */ (self)), [hordeSimModule])
