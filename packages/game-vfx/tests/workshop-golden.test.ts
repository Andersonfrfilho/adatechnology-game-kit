import { readFileSync } from 'node:fs'

import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createWorkshopBehaviors } from '../src/effects/behaviors'
import { WORKSHOP_EFFECTS } from '../src/effects/catalog'
import { createWorkshopReplay } from './workshop-replay'
import type { WorkshopInstant } from './workshop-replay'

const golden = JSON.parse(readFileSync(new URL('./fixtures/team-golden/vfx-workshop.json', import.meta.url), 'utf8')) as GoldenRecord

type EventData = { id: string; option: number; seconds?: number; list?: string[]; count?: number; counts?: string } & Partial<WorkshopInstant>
const eventsOf = (type: string, id: string, option: number): EventData[] =>
  golden.events.filter((event) => event.type === type && (event.data as EventData).id === id && (event.data as EventData).option === option).map((event) => event.data as EventData)

const implemented = new Set(Object.values(WORKSHOP_EFFECTS).map((effect) => effect.pageId))
const runs = golden.events.filter((event) => event.type === 'frames').map((event) => event.data as EventData).filter((run) => implemented.has(run.id))

function firstMismatch(expected: readonly string[], actual: readonly string[]): string {
  const index = expected.findIndex((entry, at) => entry !== actual[at])
  if (index < 0) return actual.length === expected.length ? '' : `length ${actual.length} instead of ${expected.length}`
  return `entry ${index}\n  expected ${expected[index]}\n  actual   ${actual[index]}`
}

describe('the VFX Workshop, effect by effect and option by option, against the recording of the page', () => {
  const replay = createWorkshopReplay(WORKSHOP_EFFECTS, { behaviors: createWorkshopBehaviors() })

  for (const { id, option } of runs) {
    describe(`${id} / option ${option}`, () => {
      const result = replay.run(id, option)

      it('spawns the same things in the same order, drawing the same random numbers', () => {
        const expected = eventsOf('spawns', id, option)[0]!
        expect(result.spawns.length).toBe(expected.count)
        expect(firstMismatch(expected.list!, result.spawns)).toBe('')
      })

      it('has the same number of everything alive at every frame', () => {
        expect(result.frames).toBe(eventsOf('frames', id, option)[0]!.counts)
      })

      it('holds the same pools, decals and screen at 0.1, 0.5, 1, 2 s and at the end', () => {
        const expectedInstants = eventsOf('instant', id, option)
        expect([...result.instants.keys()].sort()).toEqual(expectedInstants.map((instant) => instant.seconds).sort())
        for (const expected of expectedInstants) {
          const { id: _id, option: _option, seconds, ...state } = expected
          expect(result.instants.get(seconds!), `${seconds} s`).toEqual(state)
        }
      })
    })
  }
})
