import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { assertMatchesGolden, createEventRecorder, createGoldenRecord } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'

import { createTimeline } from '../src'

// 72 game hours of each climate for seeds 1, 7 and 42: the changes of state, every lightning strike (time, distance, bearing) and a sample every
// 10 game minutes. Checked on Node 22 and 24; regenerate on purpose with UPDATE_GOLDEN=1.
const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const SEEDS = [1, 7, 42] as const
const CLIMATE_IDS = ['temperate', 'tropical'] as const
const HOURS = 72

const fixturePath = (climate: string, seed: number): string => resolve(FIXTURES, `timeline-${climate}-seed${seed}.json`)

function recordTimeline(climate: string, seed: number): GoldenRecord {
  const timeline = createTimeline({ seed, climate, hours: HOURS })
  const recorder = createEventRecorder()
  for (const entry of timeline.transitions) recorder.record('transition', { ...entry })
  for (const strike of timeline.strikes) recorder.record('strike', { ...strike })
  for (const sample of timeline.samples) recorder.record('sample', { ...sample })
  return createGoldenRecord({ name: `weather-${climate}`, seed, events: recorder.events() })
}

const serialize = (record: GoldenRecord): string => {
  const { events, ...header } = record
  return `${JSON.stringify(header).slice(0, -1)},"events":[\n${events.map((event) => `  ${JSON.stringify(event)}`).join(',\n')}\n]}\n`
}

describe('weather timeline goldens', () => {
  if (process.env.UPDATE_GOLDEN === '1') {
    it('regenerates the fixtures', () => {
      mkdirSync(FIXTURES, { recursive: true })
      for (const climate of CLIMATE_IDS) for (const seed of SEEDS) writeFileSync(fixturePath(climate, seed), serialize(recordTimeline(climate, seed)))
      expect(existsSync(fixturePath('temperate', 1))).toBe(true)
    })
    return
  }

  for (const climate of CLIMATE_IDS) {
    for (const seed of SEEDS) {
      it(`${climate}, seed ${seed}: the same 72 hours, byte for byte`, () => {
        const expected = JSON.parse(readFileSync(fixturePath(climate, seed), 'utf8')) as GoldenRecord
        const actual = recordTimeline(climate, seed)
        assertMatchesGolden(expected, actual)
        expect(serialize(actual)).toBe(readFileSync(fixturePath(climate, seed), 'utf8'))
      })
    }
  }

  it('covers the whole span, starts clear and has weather to look at', () => {
    let strikes = 0
    let wetSamples = 0
    for (const climate of CLIMATE_IDS) {
      for (const seed of SEEDS) {
        const record = JSON.parse(readFileSync(fixturePath(climate, seed), 'utf8')) as GoldenRecord
        const samples = record.events.filter((event) => event.type === 'sample')
        expect(samples).toHaveLength(HOURS * 6 + 1)
        expect(samples[0]!.data).toMatchObject({ at: 0, state: 'clear' })
        expect(samples[samples.length - 1]!.data).toMatchObject({ at: HOURS * 3600 })
        expect(record.events.filter((event) => event.type === 'transition').length).toBeGreaterThan(8)
        strikes += record.events.filter((event) => event.type === 'strike').length
        wetSamples += samples.filter((event) => (event.data!.wetness as number) > 0).length
      }
    }
    expect(strikes).toBeGreaterThan(0)
    expect(wetSamples).toBeGreaterThan(0)
  })
})
