import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'

import { AUDIO_TRACE_CASES, playWeaponAudioScenario } from './support/audio-trace-scenario'

// What `createWeaponAudio` does to an AudioContext, recorded before it moved onto game-audio (spec 001, T6.0b). The migration (T6.1e) must give
// this file back byte for byte; only T6.1e2 (the Cena reload clicks) may regenerate it, on purpose, with UPDATE_GOLDEN=1.
const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/audio-trace.json')

type Fixture = { readonly description: string; readonly cases: ReadonlyArray<{ readonly id: string; readonly seed: number; readonly currentTime: number; readonly trace: AudioTrace }> }

const DESCRIPTION = 'createWeaponAudio trace (nodes, parameters, connections, buffer checksums) against a fake AudioContext, one case per line'

const serialize = (fixture: Fixture): string => {
  const lines = fixture.cases.map((entry) => `    ${JSON.stringify(entry)}`)
  return `{"description":${JSON.stringify(fixture.description)},"cases":[\n${lines.join(',\n')}\n  ]}\n`
}

const record = (): Fixture => ({
  description: DESCRIPTION,
  cases: AUDIO_TRACE_CASES.map((testCase) => ({ id: testCase.id, seed: testCase.seed, currentTime: testCase.currentTime, trace: playWeaponAudioScenario(testCase) })),
})

describe('createWeaponAudio trace fixture', () => {
  if (process.env.UPDATE_GOLDEN === '1') {
    it('regenerates the fixture', () => {
      mkdirSync(dirname(FIXTURE), { recursive: true })
      writeFileSync(FIXTURE, serialize(record()))
      expect(existsSync(FIXTURE)).toBe(true)
    })
    return
  }

  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture

  it('has one case per scenario and every case plays sound', () => {
    expect(fixture.cases.map((entry) => entry.id)).toEqual(AUDIO_TRACE_CASES.map((testCase) => testCase.id))
    for (const entry of fixture.cases) expect(entry.trace.entries.filter((item) => item.op === 'start').length).toBeGreaterThan(100)
  })

  for (const testCase of AUDIO_TRACE_CASES) {
    it(`reproduces the recorded trace: ${testCase.id}`, () => {
      const expected = fixture.cases.find((entry) => entry.id === testCase.id)
      expect(expected).toBeDefined()
      expect(diffAudioTrace(expected!.trace, playWeaponAudioScenario(testCase))).toEqual([])
    })
  }

  it('is byte-identical to a fresh recording', () => {
    expect(serialize(record())).toBe(readFileSync(FIXTURE, 'utf8'))
  })
})
