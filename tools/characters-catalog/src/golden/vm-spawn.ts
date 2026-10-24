import { createEventRecorder, createGoldenRecord, createSeededRandom } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'

import { loadDecisions } from '../decisions'
import { evaluateGameSlice } from './game-context'

type TypedArray = { readonly [index: number]: number }
type SpawnContext = {
  readonly Z: { n: number } & Readonly<Record<string, TypedArray>>
  readonly CATS: readonly { readonly id: string; readonly peso: number }[]
  readonly zSpawn: (x: number, z: number, forcedType?: number) => number
}

const SEEDS = 50
const UNFORCED_SEEDS = 200

/** G-spawn: the game's `zSpawn` for 13 types x seeds 1..50 (each character draws from its own seeded stream), and the weighted type draw. */
export const recordSpawnGolden = (): GoldenRecord => {
  const decisions = loadDecisions()
  let stream = createSeededRandom(1)
  const context = evaluateGameSlice<SpawnContext>({
    functions: ['zSpawn', 'zSpecialSpawn'],
    exports: ['Z', 'CATS', 'zSpawn'],
    scope: { R: () => stream() },
  })
  const { Z, CATS, zSpawn } = context
  const recorder = createEventRecorder()
  const read = (field: string): number => Z[field]?.[0] ?? Number.NaN
  const describe = (seed: number, forcedType?: number) => {
    Z.n = 0
    stream = createSeededRandom(seed)
    zSpawn(0, 0, forcedType)
    const type = CATS[read('cat')]
    return {
      type: decisions.typeIds.value[type?.id ?? ''] ?? '',
      seed,
      height: read('h'),
      build: read('b'),
      chaseSpeed: read('sp'),
      wanderSpeed: read('wsp'),
      health: read('hp'),
      age: read('age'),
      outfit: read('roupa'),
      helmet: read('capacete'),
      crawls: read('crawl'),
      variant: read('vr'),
      state: read('st'),
      color: read('col'),
    }
  }
  CATS.forEach((_, forcedType) => {
    for (let seed = 1; seed <= SEEDS; seed++) recorder.record('spawn', describe(seed, forcedType))
  })
  for (let seed = 1; seed <= UNFORCED_SEEDS; seed++) recorder.record('draw', describe(seed))
  return createGoldenRecord({ name: 'game-spawn', seed: 1, events: recorder.events() })
}
