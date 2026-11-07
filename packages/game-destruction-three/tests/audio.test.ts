import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAudioEngine } from '@adatechnology/game-audio'
import type { AudioEngine, LoopRecipe } from '@adatechnology/game-audio'
import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { EXPLOSIONS } from '@adatechnology/game-vfx'

import { BLAST_KINDS, BLAST_KIND_OF, BLAST_SOUNDS, BLAST_SOUND_OF, BURN_LOOP, DESTRUCTION_SOUND_BANK, DESTRUCTION_SOUND_KEYS, FIRE_FADE_SECONDS, SCENE_SOUNDS, createDestructionSound } from '../src'

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
    // a rule that names another package's sound (a vehicle door) falls back to one of this bank
    for (const style of ['art_scene', 'game'] as const) for (const [key, rule] of Object.entries(DESTRUCTION_SOUND_KEYS[style])) expect(engine.registry.sound(rule.fallback ?? rule.sound), `${style} ${key}`).toBeDefined()
    for (const key of KEYS) expect(DESTRUCTION_SOUND_KEYS.art_scene[key], key).toBeDefined()
  })

  it("plays a vehicle leaf's own sound when the engine knows it, else the fallback of this bank", () => {
    const { engine, sound } = engineWith()
    const played: string[] = []
    const play = engine.play.bind(engine)
    engine.play = ((id: string, ...rest: unknown[]) => (played.push(id), (play as (...a: unknown[]) => unknown)(id, ...rest))) as never
    sound.onSound('vehicle_door_shut', [0, 0, 1], 0.6)
    engine.register({ id: 'car', sounds: [{ id: 'car_door_close', bus: 'world', layers: [], sources: ['test'] }] })
    sound.onSound('vehicle_door_shut', [0, 0, 1], 0.6)
    expect(played).toEqual(['shut_metal', 'car_door_close'])
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

  it('gives a round its own sound per material, and the blow when a host drops it', () => {
    expect(DESTRUCTION_SOUND_KEYS.art_scene.shot_metal?.sound).toBe('metal_ping')
    expect(DESTRUCTION_SOUND_KEYS.art_scene.shot_glass?.sound).not.toBe(DESTRUCTION_SOUND_KEYS.art_scene.impact_glass?.sound)
    const { recorder, sound } = engineWith()
    sound.onSound('shot_wood', [0, 0, 1], 1)
    expect(starts(recorder)).toBeGreaterThan(0)
    const silenced = engineWith({ keys: { shot_metal: null } })
    silenced.sound.onSound('shot_metal', [0, 0, 1], 1)
    expect(starts(silenced.recorder)).toBe(0)
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
    expect(levels).toEqual([0.08, 0.16])
    sound.onSound('burn_end', [0, 0, 0], 0.5)
    expect(engine.stats().loops).toBe(1)
    sound.onSound('burn_end', [1, 0, 0], 0.5)
    expect(sound.burning()).toBe(0)
    // the roar fades out for a moment, then the loop is stopped
    expect(engine.stats().loops).toBe(1)
    sound.update(FIRE_FADE_SECONDS / 2)
    expect(engine.stats().loops).toBe(1)
    sound.update(FIRE_FADE_SECONDS)
    expect(engine.stats().loops).toBe(0)
    sound.onSound('burn_end', [1, 0, 0], 0.5)
    expect(sound.burning()).toBe(0)
  })

  it('silences the loop at once when the last fire ends, and stops every loop on reset and on dispose', () => {
    const { recorder, engine, sound } = engineWith()
    sound.onSound('burn_loop', [0, 0, 0], 0.5)
    recorder.clearEntries()
    sound.onSound('burn_end', [0, 0, 0], 0.5)
    const levels = recorder.trace().entries.filter((entry) => entry.op === 'param' && entry.method === 'setTargetAtTime').map((entry) => entry.args![0])
    expect(levels).toEqual([0])
    sound.update(FIRE_FADE_SECONDS * 2)
    expect(engine.stats().loops).toBe(0)
    sound.onSound('burn_loop', [0, 0, 0], 0.5)
    sound.onSound('burn_loop', [0, 0, -6], 0.5, { fuel: 'gas' })
    expect(engine.stats().loops).toBe(2)
    sound.reset()
    expect(sound.burning()).toBe(0)
    sound.update(FIRE_FADE_SECONDS * 2)
    expect(engine.stats().loops).toBe(0)
    sound.onSound('burn_loop', [0, 0, 0], 0.5)
    sound.onSound('burn_loop', [0, 0, -6], 0.5, { fuel: 'gas' })
    sound.reset()
    sound.dispose()
    expect(engine.stats().loops).toBe(0)
  })

  it('can leave the fire loop out', () => {
    const { engine, sound } = engineWith({ burnLoop: false })
    sound.onSound('burn_loop', [0, 0, 0], 0.5)
    expect(engine.stats().loops).toBe(0)
  })
})

describe('blasts and fire', () => {
  function engineWith(options?: Parameters<typeof createDestructionSound>[1]) {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 3, mix: 'art_scene', createContext: () => recorder.context })
    const sound = createDestructionSound(engine, options)
    return { recorder, engine, sound }
  }

  it('has a recipe for every blast family, and every named explosion of the effects catalogue belongs to one', () => {
    const { engine } = engineWith()
    for (const kind of BLAST_KINDS) expect(engine.registry.sound(BLAST_SOUND_OF[kind]), kind).toBeDefined()
    for (const id of ['explosion_far', 'explosion_indoor_tail', 'fire_ignite', 'gas_leak', 'fire_extinguish', 'fire_crackle', 'fire_pop']) expect(engine.registry.sound(id), id).toBeDefined()
    for (const effect of Object.keys(EXPLOSIONS)) expect(BLAST_KIND_OF[effect], effect).toBeDefined()
  })

  it('plays the family of the explosion: a grenade, a propane cylinder, a car, a molotov and C4 each sound their own', () => {
    const { sound } = engineWith()
    const at: [number, number, number] = [0, 0, -6]
    expect(sound.blastSound(at, 1, { effect: 'm67', radius: 15 })).toBe('explosion_grenade')
    expect(sound.blastSound(at, 1, { effect: 'propane_p13', radius: 14 })).toBe('explosion_fuel')
    expect(sound.blastSound(at, 1, { effect: 'car_fuel_tank', radius: 7 })).toBe('explosion_car')
    expect(sound.blastSound(at, 1, { effect: 'molotov', radius: 4 })).toBe('molotov_break_ignite')
    expect(sound.blastSound(at, 1, { effect: 'c4', radius: 18 })).toBe('explosion_big')
    expect(sound.blastSound(at, 0.6, { radius: 2 })).toBe('explosion_grenade')
    expect(sound.blastSound(at, 1, { radius: 20 })).toBe('explosion_big')
  })

  it('plays the far rumble past the far distance, never for a molotov', () => {
    const { sound } = engineWith()
    expect(sound.blastSound([0, 0, -59], 1, { effect: 'm67' })).toBe('explosion_grenade')
    expect(sound.blastSound([0, 0, -120], 1, { effect: 'm67' })).toBe('explosion_far')
    expect(sound.blastSound([0, 0, -120], 1, { effect: 'molotov' })).toBe('molotov_break_ignite')
    expect(engineWith({ blastFarDistance: 200 }).sound.blastSound([0, 0, -120], 1, { effect: 'm67' })).toBe('explosion_grenade')
  })

  it('each fuel burns with its own loop: wood, a gas jet, a fuel pool and rubber; a loop stops when its fuel is out', () => {
    const { engine, sound } = engineWith()
    const loops: string[] = []
    const loop0 = engine.loop.bind(engine)
    engine.loop = (id, o) => {
      loops.push(id)
      return loop0(id, o)
    }
    sound.onSound('burn_loop', [3, 1, 0], 0.5, { material: 'wood_hard' })
    sound.onSound('burn_loop', [0, 0, -6], 0.5, { fuel: 'gas' })
    sound.onSound('burn_loop', [0, 0, -4], 0.5, { fuel: 'liquid' })
    sound.onSound('burn_loop', [2, 0.4, -4], 0.5, { material: 'rubber' })
    expect(loops).toEqual(['fire_loop', 'fire_loop_gas', 'fire_loop_liquid', 'fire_loop_plastic'])
    expect(sound.burningBy()).toEqual({ wood: 1, gas: 1, liquid: 1, plastic: 1 })
    for (const id of loops) expect(engine.registry.loop(id), id).toBeDefined()
    // the vessel bursts: only the gas jet goes out, even though the pool is nearer the point
    sound.onSound('burn_end', [0, 0, -4.5], 0.5, { fuel: 'gas' })
    expect(sound.burningBy()).toEqual({ wood: 1, liquid: 1, plastic: 1 })
    sound.update(FIRE_FADE_SECONDS * 2)
    expect(engine.stats().loops).toBe(3)
    sound.reset()
    expect(sound.burning()).toBe(0)
    sound.update(FIRE_FADE_SECONDS * 2)
    expect(engine.stats().loops).toBe(0)
  })

  it('a gas jet and a fuel pool roar without crackles; wood crackles', () => {
    const crackles = (fuel: 'gas' | 'liquid' | 'wood'): number => {
      const { engine, sound } = engineWith()
      const played: string[] = []
      const play0 = engine.play.bind(engine)
      engine.play = (id, o) => {
        played.push(id)
        return play0(id, o)
      }
      sound.onSound('burn_loop', [0, 0, -6], 0.5, { fuel })
      for (let i = 0; i < 300; i++) sound.update(1 / 60)
      return played.filter((id) => id === 'fire_crackle' || id === 'fire_pop').length
    }
    expect(crackles('gas')).toBe(0)
    expect(crackles('liquid')).toBe(0)
    expect(crackles('wood')).toBeGreaterThan(5)
  })

  it('adds the indoor tail to a confined blast', () => {
    const open = engineWith()
    open.sound.onSound('explode', [0, 0, -6], 1, { effect: 'm67', confinement: 1 })
    const inside = engineWith()
    inside.sound.onSound('explode', [0, 0, -6], 1, { effect: 'm67', confinement: 2 })
    const starts = (r: ReturnType<typeof createAudioRecorder>): number => r.trace().entries.filter((e) => e.op === 'start').length
    expect(starts(inside.recorder)).toBeGreaterThan(starts(open.recorder))
  })

  it('keeps the explode rule of a host that chose one', () => {
    const { engine, sound } = engineWith({ keys: { explode: { sound: 'boom' } } })
    const played: string[] = []
    const play = engine.play.bind(engine)
    engine.play = (id, o) => (played.push(id), play(id, o))
    sound.onSound('explode', [0, 0, -6], 1, { effect: 'propane_p13' })
    expect(played).toEqual(['boom'])
  })

  it('a venting vessel leaks gas for as long as it has left', () => {
    const { engine, sound } = engineWith()
    const played: { id: string; seconds?: number }[] = []
    const play = engine.play.bind(engine)
    engine.play = (id, o) => (played.push({ id, ...(o?.params?.seconds === undefined ? {} : { seconds: o.params.seconds }) }), play(id, o))
    sound.onSound('primed', [0, 0, -6], 0.7, { seconds: 3.5 })
    expect(played).toEqual([{ id: 'gas_leak', seconds: 3.5 }])
  })

  it('many parts catching at once are a couple of ignitions, not one per part', () => {
    const { engine, sound } = engineWith()
    let started = 0
    const play = engine.play.bind(engine)
    engine.play = (id, o) => {
      const voice = play(id, o)
      if (voice && id === 'fire_ignite') started++
      return voice
    }
    for (let i = 0; i < 40; i++) sound.onSound('ignite', [i * 0.1, 0, -4], 0.7)
    expect(started).toBeLessThanOrEqual(2)
  })

  it('crackles over the fire while something burns, more with more fire, none once it is out', () => {
    const count = (fires: number): number => {
      const { engine, sound } = engineWith()
      let crackles = 0
      const play = engine.play.bind(engine)
      engine.play = (id, o) => ((id === 'fire_crackle' || id === 'fire_pop') && crackles++, play(id, o))
      for (let i = 0; i < fires; i++) sound.onSound('burn_loop', [i, 0, -4], 0.5)
      for (let i = 0; i < 600; i++) sound.update(1 / 60)
      return crackles
    }
    const small = count(1)
    const large = count(30)
    expect(small).toBeGreaterThan(5)
    expect(large).toBeGreaterThan(small * 2)
    const { engine, sound } = engineWith()
    sound.onSound('burn_loop', [0, 0, -4], 0.5)
    sound.onSound('burn_end', [0, 0, -4], 0.5)
    let after = 0
    const play = engine.play.bind(engine)
    engine.play = (id, o) => (after++, play(id, o))
    for (let i = 0; i < 120; i++) sound.update(1 / 60)
    expect(after).toBe(0)
  })

  it('puts the loudest moment of a blast in its first milliseconds', () => {
    for (const recipe of BLAST_SOUNDS.filter((r) => r.id !== 'explosion_far' && r.id !== 'explosion_indoor_tail')) {
      const first = recipe.layers[0]
      expect(first?.at ?? 0, recipe.id).toBe(0)
    }
  })
})
