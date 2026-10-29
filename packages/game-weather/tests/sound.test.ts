import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { GAME_SFX_BANK, createAudioEngine, planSound } from '@adatechnology/game-audio'
import type { LoopRecipe } from '@adatechnology/game-audio'
import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { RAIN_HISS_GAME, RAIN_LOOP, THUNDER, WEATHER_BANK, WIND_LOOP, rainVolume, strikePosition, thunderDelay, windVolume } from '../src'

// The loops are the teams' (cena L1314-L1315, jogo L62116): the same calls on the same fake context leave the log of the team code.
const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/golden/fixtures/audio')
type Fixture = { readonly seed: number; readonly cases: readonly { readonly id: string; readonly trace: AudioTrace }[] }
const load = (name: string): Fixture => JSON.parse(readFileSync(resolve(fixtures, name), 'utf8')) as Fixture
const expectedOf = (fixture: Fixture, id: string): AudioTrace => fixture.cases.find((entry) => entry.id === id)!.trace

// cena L1316: the fire loop belongs to destruction-three; here it only lets the whole chain be compared
const FIRE_LOOP: LoopRecipe = {
  id: 'fire_loop',
  bus: 'world',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: 1800 }, q: 0.6 }] },
  sources: ['cena:L1316'],
}

describe('the loops equal the teams', () => {
  it('art scene: initAudio opens the rain (0.06), wind (0.05) and fire (0) loops', () => {
    const fixture = load('art-scene-audio.json')
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: fixture.seed, mix: 'art_scene', banks: [WEATHER_BANK, { id: 'fire', loops: [FIRE_LOOP] }], createContext: () => recorder.context })
    engine.unlock()
    for (const [id, volume] of [['rain_loop', 0.06], ['wind_loop', 0.05], ['fire_loop', 0]] as const) engine.loop(id, { volume })
    expect(diffAudioTrace(expectedOf(fixture, 'chain'), recorder.trace())).toEqual([])
  })

  const game = load('game-audio.json')
  for (const level of ['0.001', '0.035', '0.3']) {
    it(`game: chuva at ${level}`, () => {
      const recorder = createAudioRecorder()
      const engine = createAudioEngine({ seed: game.seed, mix: 'game', banks: [GAME_SFX_BANK, WEATHER_BANK], createContext: () => recorder.context })
      engine.unlock()
      const handle = engine.loop('rain_hiss_game')
      handle.set({ volume: Number(level), frequency: 0 })
      handle.set({ volume: Number(level) * 1.5, frequency: 0 })
      expect(diffAudioTrace(expectedOf(game, `loop.chuva@${level}`), recorder.trace())).toEqual([])
    })
  }

  it('names the lines the numbers come from', () => {
    expect(RAIN_LOOP.sources).toEqual(['cena:L1314'])
    expect(WIND_LOOP.sources).toEqual(['cena:L1315'])
    expect(RAIN_HISS_GAME.sources).toEqual(['jogo:L62116 chuva'])
  })
})

describe('the levels', () => {
  it('rain: 0.035 in a light rain (the game) to 0.06 in a heavy one (the art scene), nothing when dry', () => {
    expect(rainVolume(0)).toBe(0)
    expect(rainVolume(2.5)).toBeCloseTo(0.035, 12)
    expect(rainVolume(1)).toBeCloseTo(0.035, 12)
    expect(rainVolume(8.75)).toBeCloseTo(0.0475, 12)
    expect(rainVolume(15)).toBeCloseTo(0.06, 12)
    expect(rainVolume(60)).toBeCloseTo(0.06, 12)
    expect(rainVolume(60, { heavy: 0.1 })).toBeCloseTo(0.1, 12)
  })

  it('wind: 0.05 in the art scene breeze, in proportion to the speed, capped', () => {
    expect(windVolume(0)).toBe(0)
    expect(windVolume(3.8)).toBeCloseTo(0.05, 12)
    expect(windVolume(7.6)).toBeCloseTo(0.1, 12)
    expect(windVolume(50)).toBeCloseTo(0.12, 12)
    expect(windVolume(50, { max: 0.2 })).toBeCloseTo(0.2, 12)
  })

  it('places a strike by its bearing, clockwise from north (-z)', () => {
    const near = (a: readonly number[], b: readonly number[]): void => a.forEach((value, index) => expect(value).toBeCloseTo(b[index]!, 9))
    near(strikePosition({ distance: 100, bearing: 0 }), [0, 0, -100])
    near(strikePosition({ distance: 100, bearing: 90 }), [100, 0, 0])
    near(strikePosition({ distance: 100, bearing: 180 }, [10, 1, 10]), [10, 1, 110])
  })
})

describe('the thunder', () => {
  it('is the game boom (70 to 28 Hz over 1.2 s) with a low rumble, and carries to the farthest strike', () => {
    const plan = planSound(THUNDER, { distance: 200 })!
    expect(plan.layers).toHaveLength(2)
    const thump = plan.layers[0]!
    expect(thump.source).toMatchObject({ kind: 'osc', wave: 'sine' })
    const heard = (distance: number): boolean => planSound(THUNDER, { distance }) !== null
    expect(heard(200)).toBe(true)
    expect(heard(4000)).toBe(true)
    expect(THUNDER.sources.join(' ')).toContain('L68278')
  })

  it('arrives after distance / 343 seconds', () => {
    expect(thunderDelay(343)).toBeCloseTo(1, 12)
  })
})
