// A worker_threads worker of the coordinator hosting shapes.generate, from the built package (the test job builds it first), with the
// test's custom generator registered globally, as a game's worker file registers its own.
import { installWorkerHost } from '@adatechnology/game-workers'
import { nodeWorkerScope } from '@adatechnology/game-workers/node'

import { registerGenerator } from '../../dist/index.js'
import { shapesGenerateKind } from '../../dist/worker-kinds.js'
import { rocks } from './rocks.mjs'

registerGenerator('test.rocks', rocks)
installWorkerHost(nodeWorkerScope(), [shapesGenerateKind])
