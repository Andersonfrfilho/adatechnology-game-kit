import { createEventRecorder, createGoldenRecord } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { cutFunction, evaluateSlice } from '@adatechnology/golden-tool/cut-source'

import { SOURCE_PATHS } from '../paths'
import { readSource } from '../read-source'

type Gait = { readonly walkCad: (speed: number) => number; readonly walkGait: (speed: number, height?: number) => number }

const SPEEDS = Array.from({ length: 25 }, (_, step) => step * 0.25)
const HEIGHTS = [0.9, 1, 1.1, 1.42]

/** G-gait (the pure part): the game's `walkCad` and `walkGait` for speeds 0..6 m/s and four heights (0.9 .. the brute's 1.42). */
export const recordWalkGaitGolden = (): GoldenRecord => {
  const code = [cutFunction(readSource(SOURCE_PATHS.game), 'walkCad'), cutFunction(readSource(SOURCE_PATHS.game), 'walkGait')].join('\n')
  const { walkCad, walkGait } = evaluateSlice<Gait>(code, ['walkCad', 'walkGait'])
  const recorder = createEventRecorder()
  for (const height of HEIGHTS) {
    for (const speed of SPEEDS) recorder.record('walk', { speed, height, cadence: walkCad(speed), amplitude: walkGait(speed, height) })
  }
  return createGoldenRecord({ name: 'game-walk-gait', seed: 1, events: recorder.events() })
}
