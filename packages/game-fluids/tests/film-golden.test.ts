import { readFileSync } from 'node:fs'
import { hashText, installPortableMath } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { FLUID_KEYS, SCENE_KEYS, createStandardReplay } from './film-standard-replay'

// Math.pow changed its last bit between Node 22 and 24; the goldens must not depend on the Node that runs them.
installPortableMath()

const golden = JSON.parse(readFileSync(new URL('./fixtures/team-golden/fluid-standard.json', import.meta.url), 'utf8')) as GoldenRecord
const INSTANT_FRAMES = [30, 60, 120, 300, 600]
const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0
const hashArray = (array: Float32Array): string => hashText(Array.from(array, round4).join(','))

type Instant = { scene: string; fluid: string; seconds: number; h: string; dry: string; wet: number; launches: number }
const recorded = golden.events.map((event) => event.data as unknown as Instant)

describe('the Fluid Standard film against the recording of the page: 5 scenes x 5 fluids', () => {
  // One film for the whole run, as in the page: the drop ring and the step clock carry over from one scene to the next.
  const replay = createStandardReplay()
  for (const scene of SCENE_KEYS) {
    for (const fluid of FLUID_KEYS) {
      it(`${scene} · ${fluid}`, () => {
        replay.runScene(scene, fluid)
        let frame = 0
        for (const target of INSTANT_FRAMES) {
          replay.stepFrames(target - frame)
          frame = target
          const seconds = round4(target / 60)
          const expected = recorded.find((entry) => entry.scene === scene && entry.fluid === fluid && entry.seconds === seconds)!
          const { field } = replay.film
          expect({ seconds, h: hashArray(field.thickness), dry: hashArray(field.dryness), wet: replay.film.wetCells(), launches: replay.launchesSinceScene() }).toEqual({ seconds, h: expected.h, dry: expected.dry, wet: expected.wet, launches: expected.launches })
        }
      })
    }
  }
})
