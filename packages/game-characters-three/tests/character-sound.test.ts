import { createAudioEngine, createAudioSink } from '@adatechnology/game-audio'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { UNDEAD_TYPES } from '@adatechnology/game-characters-undead'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { BODY_SOUNDS, UNDEAD_VOICES, createCharacterSound } from '../src'

const body = (change: string, part?: string): DestructionEvent => ({ type: 'body', object: 'z1', time: 0, change, ...(part ? { part } : {}) }) as DestructionEvent

function rig(options?: Parameters<typeof createCharacterSound>[1]) {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ seed: 5, mix: 'art_scene', createContext: () => recorder.context })
  engine.setListener({ position: [0, 0, 0], yaw: 0 })
  engine.unlock()
  const asked: { sound: string; position?: readonly number[]; volume?: number }[] = []
  const sink = createAudioSink(engine)
  const spy = { play: (request: Parameters<typeof sink.play>[0]) => (asked.push({ sound: request.sound, ...(request.position ? { position: request.position } : {}), ...(request.volume === undefined ? {} : { volume: request.volume }) }), sink.play(request)), register: sink.register }
  const sound = createCharacterSound(spy, options)
  const starts = (): number => recorder.trace().entries.filter((entry) => entry.op === 'start').length
  return { engine, sound, asked, starts }
}

describe('the voices of the 13 types', () => {
  it('has one for every type of the Bestiario, and none for a type that does not exist', () => {
    expect(Object.keys(UNDEAD_VOICES).sort()).toEqual(UNDEAD_TYPES.map((type) => type.id).sort())
  })

  it("follows the art scene's class rule: the brute has its own groan, a chase speed above 3.4 is a runner's, the rest are walkers'", () => {
    for (const type of UNDEAD_TYPES) {
      const expected = type.id === 'brute' ? 'groan_brute' : type.speed.chase > 3.4 ? 'groan_runner' : 'groan_walker'
      expect(UNDEAD_VOICES[type.id]?.groan, type.id).toBe(expected)
    }
  })

  it("follows the game's rule: only the runner category has the corredor groan", () => {
    for (const type of UNDEAD_TYPES) expect(UNDEAD_VOICES[type.id]?.gameGroan, type.id).toBe(type.id === 'runner' ? 'runner_groan' : 'groan')
  })

  it('gives the types of the pages their own sounds and marks the rest', () => {
    const origin = (id: string) => UNDEAD_VOICES[id]?.origin
    for (const id of ['walker', 'runner', 'brute', 'screamer', 'leaper']) expect(origin(id), id).toBe('team')
    for (const id of ['sniffer', 'devourer']) expect(origin(id), id).toBe('extra')
    for (const id of ['crawler', 'bloater', 'stalker', 'blind', 'charred', 'drowned']) expect(origin(id), id).toBe('rule')
  })

  it("winds the screamer up for the type's own windUpSeconds before the call", () => {
    const screamer = UNDEAD_TYPES.find((type) => type.id === 'screamer')!
    const { sound } = rig()
    const steps = sound.stepsOf('screamer', 'special')
    expect(steps.map((step) => step.sound)).toEqual(['inhale', 'scream'])
    expect(steps[1]?.delay).toBe(screamer.abilities.windUpSeconds)
  })

  it('plays every type at every moment without a sound it cannot find', () => {
    const { engine, sound, asked } = rig()
    for (const id of Object.keys(UNDEAD_VOICES)) for (const moment of ['idle', 'alert', 'special'] as const) sound.voice(id, moment, [3, 0, 2])
    sound.update(5)
    for (const call of asked) expect(engine.registry.sound(call.sound), call.sound).toBeDefined()
    expect(asked.length).toBeGreaterThan(13)
  })
})

describe('createCharacterSound', () => {
  it('registers the banks in the engine and plays a groan where the body is', () => {
    const { sound, asked, starts } = rig()
    expect(sound.voice('walker', 'idle', [3, 0, 2], 0.8)).toBe(1)
    expect(asked).toEqual([{ sound: 'groan_walker', position: [3, 0, 2], volume: 0.8 }])
    expect(starts()).toBeGreaterThan(0)
  })

  it('queues the second sound of a sequence and plays it when its time comes', () => {
    const { sound, asked } = rig()
    sound.voice('screamer', 'special', [2, 0, 0])
    expect(asked.map((call) => call.sound)).toEqual(['inhale'])
    expect(sound.pending()).toBe(1)
    sound.update(1)
    expect(asked).toHaveLength(1)
    sound.update(0.6)
    expect(asked.map((call) => call.sound)).toEqual(['inhale', 'scream'])
    expect(sound.pending()).toBe(0)
  })

  it('keeps the stalker silent while it plays dead and groans when it wakes', () => {
    const { sound, asked } = rig()
    expect(sound.voice('stalker', 'idle', [1, 0, 1])).toBe(0)
    expect(sound.voice('stalker', 'alert', [1, 0, 1])).toBe(1)
    expect(asked.map((call) => call.sound)).toEqual(['groan_runner'])
  })

  it('answers a body that notices the player with the corredor groan in the game style, and the screamer with the hoarse scream', () => {
    const { sound, asked } = rig({ style: 'game' })
    sound.voice('walker', 'idle', [3, 0, 2])
    sound.voice('walker', 'alert', [3, 0, 2])
    sound.voice('runner', 'idle', [3, 0, 2])
    sound.voice('screamer', 'special', [3, 0, 2])
    sound.voice('leaper', 'special', [3, 0, 2])
    expect(asked.map((call) => call.sound)).toEqual(['groan', 'runner_groan', 'runner_groan', 'scream_hoarse', 'leap'])
  })

  it('lets only five groans play at once and one every 0.25 s, nearer than 40 m (the undead voice group)', () => {
    const { engine, sound, starts } = rig()
    sound.voice('walker', 'idle', [60, 0, 0])
    expect(starts()).toBe(0)
    sound.voice('walker', 'idle', [10, 0, 0])
    const one = starts()
    expect(one).toBeGreaterThan(0)
    sound.voice('walker', 'idle', [10, 0, 0])
    expect(starts()).toBe(one)
    expect(engine.stats().dropped).toBeGreaterThanOrEqual(2)
  })

  it('reads the body events: a wound is flesh (brighter on the head), a cut is sever, a burst or a split is gore, the rest is silent', () => {
    const { sound, asked } = rig()
    expect(sound.body(body('wound', 'thighL'), [1, 1, 0])).toBe(true)
    expect(sound.body(body('wound', 'head'), [1, 1, 0])).toBe(true)
    expect(sound.body(body('wound', 'jaw'), [1, 1, 0])).toBe(true)
    expect(sound.body(body('severed', 'upperArmL'), [1, 1, 0])).toBe(true)
    expect(sound.body(body('destroyed', 'head'), [1, 1, 0])).toBe(true)
    expect(sound.body(body('split', 'torso'), [1, 1, 0])).toBe(true)
    expect(sound.body(body('limp', 'shinL'), [1, 1, 0])).toBe(false)
    expect(sound.body({ type: 'ignite', object: 'z1', time: 0, part: 'torso', point: [0, 0, 0] } as DestructionEvent, [0, 0, 0])).toBe(false)
    expect(asked.map((call) => call.sound)).toEqual(['flesh', 'flesh_head', 'flesh_head', 'sever', 'gore', 'gore'])
  })

  it("plays the game's flesh class in the game style and the art scene for what the game lacks", () => {
    const { sound, asked } = rig({ style: 'game' })
    sound.body(body('wound', 'torso'), [1, 1, 0])
    sound.body(body('severed', 'thighR'), [1, 1, 0])
    expect(asked.map((call) => call.sound)).toEqual(['sfx_flesh', 'sever'])
    expect(BODY_SOUNDS.game.severed).toBeUndefined()
  })

  it('plays what the player hears at the listener, takes a replaced voice and silences a body rule', () => {
    const { sound, asked } = rig({ voices: { walker: null, crawler: { origin: 'rule', groan: 'groan_brute', gameGroan: 'groan' } }, body: { wound: null } })
    sound.player('bite', 0.5)
    expect(asked).toEqual([{ sound: 'bite', volume: 0.5 }])
    expect(sound.voice('walker', 'idle', [3, 0, 2])).toBe(0)
    sound.voice('crawler', 'idle', [3, 0, 2])
    expect(sound.body(body('wound', 'torso'), [0, 1, 0])).toBe(false)
    expect(asked.at(-1)?.sound).toBe('groan_brute')
  })
})
