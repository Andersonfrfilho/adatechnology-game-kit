import { readFileSync } from 'node:fs'
import { hashText, installPortableMath } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { Vector } from './film-vector'
import { WORKSHOP_OPTIONS, createWorkshopReplay } from './film-workshop-replay'
import type { WorkshopTrace } from './film-workshop-replay'

// Math.pow changed its last bit between Node 22 and 24; the goldens must not depend on the Node that runs them.
installPortableMath()

const read = (name: string): GoldenRecord => JSON.parse(readFileSync(new URL(`./fixtures/team-golden/${name}`, import.meta.url), 'utf8')) as GoldenRecord
const golden = read('vfx-workshop-fluids.json')
const traces = read('vfx-workshop-fluids-trace.json').events.map((event) => event.data as { option: number; sources: string; draws: string })
const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0
const hashArray = (array: Float32Array): string => hashText(Array.from(array, round4).join(','))

type Instant = { id: string; option: number; seconds: number; h: string; dry: string; wet: number; launches: number }
const recorded = golden.events.map((event) => event.data as unknown as Instant)
const traceOf = (option: number): WorkshopTrace => {
  const trace = traces.find((entry) => entry.option === option)!
  return {
    sources: trace.sources === '' ? [] : trace.sources.split(' ').map((triple) => new Vector(...(triple.split(',').map(Number) as [number, number, number]))),
    draws: trace.draws.split(' ').map(Number),
  }
}

describe('the Workshop film (fluidos) against the recording of the page: 4 fluids', () => {
  // One film for the four runs, as in the page: the drop ring and the step clock carry over.
  const replay = createWorkshopReplay([0.5, 1, 2, 5, 10])
  for (const [option, { liquid }] of WORKSHOP_OPTIONS.entries()) {
    it(`option ${option} · ${liquid}`, () => {
      const trace = traceOf(option)
      const seen: Instant[] = []
      const { draws } = replay.runOption(option, trace, (seconds, launches) => {
        const { field } = replay.film
        seen.push({ id: 'fluidos', option, seconds, h: hashArray(field.thickness), dry: hashArray(field.dryness), wet: replay.film.wetCells(), launches })
      })
      expect(draws).toEqual(trace.draws)
      expect(seen).toEqual(recorded.filter((entry) => entry.option === option))
    })
  }
})
