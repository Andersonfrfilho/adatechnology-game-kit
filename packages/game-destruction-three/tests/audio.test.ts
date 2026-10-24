import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAudioEngine } from '@adatechnology/game-audio'
import type { AudioEngine, LoopRecipe } from '@adatechnology/game-audio'
import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { BURN_LOOP, DESTRUCTION_SOUND_BANK, DESTRUCTION_SOUND_KEYS, SCENE_SOUNDS, createDestructionSound } from '../src'

// The sounds of materials breaking against the team code: the art scene's `sfx.*` and the game's `boom`, run on a fake AudioContext under the same seed.
const golden = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/golden/fixtures/audio')
type Fixture = { readonly seed: number; readonly cases: readonly { readonly id: string; readonly trace: AudioTrace }[] }
const load = (name: string): Fixture => JSON.parse(readFileSync(resolve(golden, name), 'utf8')) as Fixture
const art = load('art-scene-audio.json')
const game = load('game-audio.json')
const expected = (fixture: Fixture, id: string): AudioTrace => fixture.cases.find((entry) => entry.id === id)!.trace

const chainLoop = (id: string, bank: NonNullable<LoopRecipe['filters']>['bank'], modulators?: LoopRecipe['modulators']): LoopRecipe => ({
  id,
  bus: 'weather',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank },
  ...(modulators ? { modulators } : {}),
  sources: ['cena:L1314-L1315'],
})
const RAIN = chainLoop('rain', [{ type: 'highpass', frequency: { set: 600 } }, { type: 'lowpass', frequency: { set: 6000 } }])
const WIND = chainLoop('wind', [{ type: 'lowpass', frequency: { set: 320 } }], [{ target: 'gain', rate: 0.07, depth: 0.035 }])

// the art scene after `initAudio` (chain, rain, wind and the fire loop at 0), with the listener at the player's place, camTheta 0.6
function artScene(play: (engine: AudioEngine) => void) {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ seed: art.seed, mix: 'art_scene', createContext: () => recorder.context, banks: [DESTRUCTION_SOUND_BANK, { id: 'weather', loops: [RAIN, WIND] }] })
  engine.setListener({ position: [0, 0, 0], yaw: 0.6 })
  engine.unlock()
  engine.loop('rain', { volume: 0.06 })
  engine.loop('wind', { volume: 0.05 })
  engine.loop('burn_loop', { volume: 0 })
  recorder.clearEntries()
  play(engine)
  return recorder.trace()
}

const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [3, 2],
  [12, -9],
  [40, 25],
]

describe('the art scene sounds of materials', () => {
  const sounds: ReadonlyArray<readonly [string, string, Record<string, number> | undefined]> = [
    ['crack', 'crack', undefined],
    ['burst', 'burst', undefined],
    ['glass', 'glass_shatter', undefined],
    ['wood', 'wood_hit', undefined],
    ['thunk', 'thunk', undefined],
    ['ping', 'ping', undefined],
    ['clang', 'clang', undefined],
    ['chip', 'chip', undefined],
    ['crumble', 'crumble', undefined],
    ['thud', 'thud', { scale: 1.5 }],
    ['hiss', 'hiss', { seconds: 0.8 }],
    ['boom', 'boom', undefined],
  ]
  for (const [team, id, params] of sounds) {
    for (const [x, z] of POSITIONS) {
      it(`${id} at ${x},${z} leaves the trace of sfx.${team}`, () => {
        const trace = artScene((engine) => void engine.play(id, { position: [x, 0, z], ...(params ? { params } : {}) }))
        expect(diffAudioTrace(expected(art, `${team}@${x},${z}`), trace)).toEqual([])
      })
    }
  }

  it('boom_big adds the long second rumble', () => {
    const trace = artScene((engine) => void engine.play('boom_big', { position: [3, 0, 2] }))
    expect(diffAudioTrace(expected(art, 'boom.big@3,2'), trace)).toEqual([])
  })

  it('has a recipe for every one of them, with the line of the team code in its sources', () => {
    for (const recipe of SCENE_SOUNDS) expect(recipe.sources[0]).toMatch(/^cena:L13\d\d /)
  })
})

describe("the game's explosion thump", () => {
  for (const distance of [0, 20, 60, 200]) {
    it(`explosion_boom at ${distance} m leaves the trace of boom(${distance})`, () => {
      const recorder = createAudioRecorder()
      const engine = createAudioEngine({ seed: game.seed, mix: 'game', createContext: () => recorder.context, banks: [DESTRUCTION_SOUND_BANK] })
      engine.unlock()
      engine.play('explosion_boom', { distance })
      expect(diffAudioTrace(expected(game, `boom@${distance}`), recorder.trace())).toEqual([])
    })
  }
})

describe('the fire loop', () => {
  it('is the art scene loop: a 1800 Hz bandpass, Q 0.6, gain at 0', () => {
    const trace = artScene(() => undefined)
    expect(trace.entries).toEqual([])
    expect(BURN_LOOP.filters?.bank[0]).toMatchObject({ type: 'bandpass', q: 0.6, frequency: { set: 1800 } })
  })
})

describe('the keys of the renderer', () => {
  const KEYS = ['impact_metal', 'impact_wood', 'impact_glass', 'impact_masonry', 'impact_soft', 'shatter_glass', 'crumble', 'splinter', 'ricochet', 'unscrew', 'detach', 'ignite', 'extinguish', 'melt_sizzle', 'explode']

  function engineWith(options?: Parameters<typeof createDestructionSound>[1]) {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 3, mix: 'art_scene', createContext: () => recorder.context })
    const sound = createDestructionSound(engine, options)
    return { recorder, engine, sound }
  }
  const starts = (recorder: ReturnType<typeof createAudioRecorder>): number => recorder.trace().entries.filter((entry) => entry.op === 'start').length

  it('answers every key the renderer sends, in both styles, with a recipe that exists', () => {
    const { engine } = engineWith()
    for (const style of ['art_scene', 'game'] as const) for (const [key, rule] of Object.entries(DESTRUCTION_SOUND_KEYS[style])) expect(engine.registry.sound(rule.sound), `${style} ${key}`).toBeDefined()
    for (const key of KEYS) expect(DESTRUCTION_SOUND_KEYS.art_scene[key], key).toBeDefined()
  })

  it('plays a key at its point, louder for a big blast and quieter far away', () => {
    const { recorder, sound } = engineWith()
    sound.onSound('impact_metal', [2, 0, 1], 1)
    const near = starts(recorder)
    expect(near).toBeGreaterThan(0)
    sound.onSound('explode', [0, 0, 5], 1)
    expect(starts(recorder)).toBeGreaterThan(near + 10)
    const before = starts(recorder)
    sound.onSound('no_such_key', [0, 0, 0], 1)
    expect(starts(recorder)).toBe(before)
  })

  it('plays the game classes in the game style and the art scene for what the game lacks', () => {
    const { sound } = engineWith({ style: 'game' })
    expect(sound.rule('impact_wood')?.sound).toBe('sfx_wood')
    expect(sound.rule('ricochet')?.sound).toBe('ping')
  })

  it('takes a replaced or silenced key', () => {
    const { recorder, sound } = engineWith({ keys: { impact_metal: null, detach: { sound: 'clang', volumeScale: 0.5 } } })
    sound.onSound('impact_metal', [0, 0, 1], 1)
    expect(starts(recorder)).toBe(0)
    sound.onSound('detach', [0, 0, 1], 1)
    expect(starts(recorder)).toBeGreaterThan(0)
  })

  it('raises one fire loop while parts burn and drops it when the last one is out', () => {
    const { recorder, engine, sound } = engineWith()
    sound.onSound('burn_loop', [0, 0, 0], 0.5)
    sound.onSound('burn_loop', [1, 0, 0], 0.5)
    expect(sound.burning()).toBe(2)
    expect(engine.stats().loops).toBe(1)
    const levels = recorder.trace().entries.filter((entry) => entry.op === 'param' && entry.method === 'setTargetAtTime').map((entry) => entry.args![0])
    expect(levels).toEqual([0.05, 0.1])
    sound.onSound('burn_end', [0, 0, 0], 0.5)
    expect(engine.stats().loops).toBe(1)
    sound.onSound('burn_end', [1, 0, 0], 0.5)
    expect(sound.burning()).toBe(0)
    expect(engine.stats().loops).toBe(0)
    sound.onSound('burn_end', [1, 0, 0], 0.5)
    expect(sound.burning()).toBe(0)
  })

  it('can leave the fire loop out', () => {
    const { engine, sound } = engineWith({ burnLoop: false })
    sound.onSound('burn_loop', [0, 0, 0], 0.5)
    expect(engine.stats().loops).toBe(0)
  })
})
