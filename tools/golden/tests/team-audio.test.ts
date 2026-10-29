import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { diffAudioTrace } from '../src'
import type { AudioTrace } from '../src'
import { ART_SCENE_AUDIO_CASES, GAME_AUDIO_CASES, cutTeamAudio, recordTeamAudioFixture, serializeTeamAudioFixture } from '../src/team-audio'
import type { TeamAudioFixture, TeamAudioProfile } from '../src/team-audio'

// The art scene fills a 2.2 s stereo impulse response per case: seconds alone, tens of them when the whole workspace tests in parallel.
const RECORD_TIMEOUT_MS = 120_000

const here = dirname(fileURLToPath(import.meta.url))
const spec = resolve(here, '../../../specs/001-migracao-entregas-dos-times')

const PROFILES: ReadonlyArray<{ readonly profile: TeamAudioProfile; readonly source: string; readonly fixture: string }> = [
  { profile: 'game', source: resolve(spec, 'artefatos/2UG1Mhe9LqJkQKKVsJkTWR/jogo.js'), fixture: resolve(here, '../fixtures/audio/game-audio.json') },
  { profile: 'art_scene', source: resolve(spec, 'sources/arte__cena-de-arte.js'), fixture: resolve(here, '../fixtures/audio/art-scene-audio.json') },
]

const params = (trace: AudioTrace, node: string, param: string): ReadonlyArray<readonly [string | undefined, ...unknown[]]> =>
  trace.entries.filter((entry) => entry.op === 'param' && entry.node === node && entry.param === param).map((entry) => [entry.method, ...(entry.args ?? [])])

describe.each(PROFILES)('team audio fixture: $profile', ({ profile, source, fixture: fixturePath }) => {
  const sourceText = readFileSync(source, 'utf8')
  const recorded = JSON.parse(readFileSync(fixturePath, 'utf8')) as TeamAudioFixture

  it('was recorded from the source as it is now', () => {
    const cuts = cutTeamAudio(profile, sourceText)
    expect(Object.keys(recorded.cuts)).toEqual(Object.keys(cuts))
  })

  it('is reproduced by running the cuts again, byte for byte', () => {
    const fresh = recordTeamAudioFixture(profile, sourceText, recorded.seed)
    expect(diffAudioTrace(recorded.cases[0]!.trace, fresh.cases[0]!.trace)).toEqual([])
    expect(serializeTeamAudioFixture(fresh)).toBe(readFileSync(fixturePath, 'utf8'))
  }, RECORD_TIMEOUT_MS)

  it('has every case of the list', () => {
    const expected = profile === 'game' ? GAME_AUDIO_CASES : ART_SCENE_AUDIO_CASES
    expect(recorded.cases.map((entry) => entry.id)).toEqual(expected.map((entry) => entry.id))
  })
})

const nodeOf = (trace: AudioTrace, kind: string, index = 0): string => trace.entries.filter((entry) => entry.op === 'create' && entry.kind === kind)[index]!.node!

describe('team audio contents', () => {
  const game = JSON.parse(readFileSync(PROFILES[0]!.fixture, 'utf8')) as TeamAudioFixture
  const art = JSON.parse(readFileSync(PROFILES[1]!.fixture, 'utf8')) as TeamAudioFixture
  const find = (fixture: TeamAudioFixture, id: string): AudioTrace => fixture.cases.find((entry) => entry.id === id)!.trace

  it('game: master 0.5, the class table and the distance curve of the page', () => {
    expect(params(find(game, 'sfx.pistola@0'), 'gain#1', 'gain')).toEqual([['value', 0.5]])
    expect(params(find(game, 'sfx.pistola@0'), 'gain#2', 'gain')).toEqual([['setValueAtTime', 0.9, 0], ['exponentialRampToValueAtTime', 0.001, 0.18]])
    const muffled = find(game, 'sfx.pistola@60')
    expect(params(muffled, 'biquadFilter#5', 'frequency')).toEqual([['value', 1800 / 1.6]])
    expect(params(muffled, 'gain#2', 'gain')[0]![1]).toBeCloseTo(0.9 / (1 + 3600 * 0.004), 9)
  })

  it('game: silent below the audibility threshold, and loops below 0.002 create nothing', () => {
    expect(find(game, 'sfx.explosao@160').entries.every((entry) => entry.node === undefined || entry.node === 'gain#1')).toBe(true)
    expect(find(game, 'loop.motor@0.001').entries).toHaveLength(find(game, 'init').entries.length)
    expect(find(game, 'loop.motor@0.035').entries.length).toBeGreaterThan(find(game, 'init').entries.length)
  })

  it('game: grito draws its duration and LFO rate from the seeded random, voz the pitch', () => {
    const scream = find(game, 'grito@0')
    expect(scream.entries.filter((entry) => entry.op === 'create' && entry.kind === 'biquadFilter')).toHaveLength(3)
    expect(find(game, 'voz.gemido@0').entries.some((entry) => entry.op === 'set' && entry.prop === 'type' && entry.value === 'sawtooth')).toBe(true)
  })

  it('art scene: compressor -12 dB ratio 5, master 0.85, wet 0.4, reverb of 2.2 s in two channels, noise of 2 s', () => {
    const chain = find(art, 'chain')
    expect(params(chain, 'dynamicsCompressor#1', 'threshold')).toEqual([['value', -12]])
    expect(params(chain, 'dynamicsCompressor#1', 'ratio')).toEqual([['value', 5]])
    expect(params(chain, 'gain#2', 'gain')).toEqual([['value', 0.85]])
    expect(chain.buffers.map((buffer) => [buffer.channels, buffer.length])).toEqual([[2, 105600], [1, 96000]])
  })

  it('art scene: distance and pan of the listener change with the position', () => {
    const gainAt = (id: string): number => {
      const trace = find(art, id)
      const panner = trace.entries.find((entry) => entry.op === 'connect' && entry.to === nodeOf(trace, 'stereoPanner'))!.from!
      return params(trace, panner, 'gain')[0]![1] as number
    }
    const panAt = (id: string): number => params(find(art, id), nodeOf(find(art, id), 'stereoPanner'), 'pan')[0]![1] as number
    expect(gainAt('glass@3,2')).toBeCloseTo(0.9 / (1 + 13 * 0.008), 9)
    expect(gainAt('glass@3,2')).toBeGreaterThan(gainAt('glass@40,25'))
    expect(panAt('glass@3,2')).not.toBe(panAt('glass@12,-9'))
    expect(Math.abs(panAt('glass@40,25'))).toBeLessThanOrEqual(0.85)
  })
})
