import { readFileSync } from 'node:fs'

import { hashText } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createWorkshopBehaviors } from '../src/effects/behaviors'
import { WORKSHOP_EFFECTS } from '../src/effects/catalog'
import type { CueRequest } from '../src/effects/types'
import { createWorkshopReplay } from './workshop-replay'
import type { WorkshopInstant } from './workshop-replay'

// The Workshop's rain, fog and headlights (`chuva` in its three options, `neblina`, `farol`): the page recorded with `vfx-workshop.js --param mode=weather`,
// the recipes replayed in Node. On top of what every Workshop run checks (the spawns and the random draws behind each, the live counts every frame, the
// pools at 0.1, 0.5, 1, 2 s and the end) the instants hold the hash of the rain streaks and the light the storm's flash moves.
const golden = JSON.parse(readFileSync(new URL('./fixtures/team-golden/vfx-workshop-weather.json', import.meta.url), 'utf8')) as GoldenRecord

type EventData = { id: string; option: number; seconds?: number; list?: string[]; count?: number; counts?: string } & Partial<WorkshopInstant>
const eventsOf = (type: string, id: string, option: number): EventData[] =>
  golden.events.filter((event) => event.type === type && (event.data as EventData).id === id && (event.data as EventData).option === option).map((event) => event.data as EventData)
const runs = golden.events.filter((event) => event.type === 'frames').map((event) => event.data as EventData)

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0
const HEMI = 0.6
const FLASH_LIGHT = 3.2

function firstMismatch(expected: readonly string[], actual: readonly string[]): string {
  const index = expected.findIndex((entry, at) => entry !== actual[at])
  if (index < 0) return actual.length === expected.length ? '' : `length ${actual.length} instead of ${expected.length}`
  return `entry ${index}\n  expected ${expected[index]}\n  actual   ${actual[index]}`
}

describe('the Workshop weather, effect by effect and option by option, against the recording of the page', () => {
  let hemi = HEMI
  const onCue = (cue: CueRequest): void => {
    if (cue.cue === 'lightning') hemi = HEMI + (cue.args as { intensity: number }).intensity * FLASH_LIGHT
  }
  const replay = createWorkshopReplay(
    WORKSHOP_EFFECTS,
    { behaviors: createWorkshopBehaviors(), onCue },
    {
      onStart: () => void (hemi = HEMI),
      fields: (engine) => ({
        rain: engine.rain.on ? hashText(`${engine.rain.count}:${hashText(Array.from({ length: engine.rain.count * 6 }, (_, index) => round4(engine.rain.positions[index]!)).join(','))}`) : 'off',
        drops: engine.rain.count,
        hemi: round4(hemi),
      }),
    },
  )

  it('records the three effects, five runs', () => {
    expect(runs.map((run) => `${run.id}/${run.option}`)).toEqual(['chuva/0', 'chuva/1', 'chuva/2', 'neblina/0', 'farol/0'])
  })

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

      it('holds the same pools, decals, screen, rain streaks and light at 0.1, 0.5, 1, 2 s and at the end', () => {
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
