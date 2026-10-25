import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAudioEngine, createAudioSink } from '@adatechnology/game-audio'
import { SPECIES } from '@adatechnology/game-animals-species'
import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { ANIMAL_CALLS, ANIMAL_SOUND_BANK, ANIMAL_SOUNDS, createAnimalSound } from '../src'

const golden = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/golden/fixtures/audio')
type Fixture = { readonly seed: number; readonly cases: readonly { readonly id: string; readonly trace: AudioTrace }[] }
const game = JSON.parse(readFileSync(resolve(golden, 'game-audio.json'), 'utf8')) as Fixture
const expected = (id: string): AudioTrace => game.cases.find((entry) => entry.id === id)!.trace

const IDS: Readonly<Record<string, string>> = { latido: 'dog_bark', queroquero: 'lapwing_call', cacarejo: 'hen_cluck', mugido: 'cow_moo' }

describe("the game's animal calls against bichoSom", () => {
  for (const [team, id] of Object.entries(IDS)) {
    for (const distance of [0, 30, 60, 69]) {
      it(`${id} at ${distance} m leaves the trace of bichoSom('${team}', ${distance})`, () => {
        const recorder = createAudioRecorder()
        const engine = createAudioEngine({ seed: game.seed, mix: 'game', createContext: () => recorder.context, banks: [ANIMAL_SOUND_BANK] })
        engine.unlock()
        engine.play(id, { distance })
        expect(diffAudioTrace(expected(`bichoSom.${team}@${distance}`), recorder.trace())).toEqual([])
      })
    }
  }

  it('keeps the line of the team code in the sources of every recipe', () => {
    for (const recipe of ANIMAL_SOUNDS) expect(recipe.sources[0], recipe.id).toMatch(/^jogo:L66625/)
  })
})

describe('createAnimalSound', () => {
  function rig() {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: 4, mix: 'game', createContext: () => recorder.context })
    engine.setListener({ position: [0, 0, 0], yaw: 0 })
    engine.unlock()
    const sink = createAudioSink(engine)
    const asked: string[] = []
    const sound = createAnimalSound({ play: (request) => (asked.push(request.sound), sink.play(request)), register: sink.register })
    const starts = (): number => recorder.trace().entries.filter((entry) => entry.op === 'start').length
    return { engine, sound, asked, starts }
  }

  it('has a call for the four species the page gives one, and none for the others', () => {
    expect(Object.keys(ANIMAL_CALLS).sort()).toEqual(['chicken', 'cow', 'dog', 'southern_lapwing'])
    const ids = SPECIES.map((species) => species.id)
    for (const id of Object.keys(ANIMAL_CALLS)) expect(ids, id).toContain(id)
  })

  it("matches the species' noise range of the data", () => {
    for (const species of SPECIES) {
      const call = ANIMAL_CALLS[species.id]
      if (call) expect(call.noiseMetres, species.id).toBe(species.soundRangeMetres)
    }
  })

  it('plays the call where the animal is, registered in the engine, and is silent beyond 70 m', () => {
    const { engine, sound, asked, starts } = rig()
    expect(sound.call('cow', [20, 0, 0])).toBe(true)
    expect(asked).toEqual(['cow_moo'])
    expect(engine.registry.sound('cow_moo')).toBeDefined()
    expect(starts()).toBeGreaterThan(0)
    const before = starts()
    sound.call('dog', [90, 0, 0])
    expect(starts()).toBe(before)
  })

  it('makes an animal wait out the cooldown of the page, and lets another animal of the species call', () => {
    const { sound, asked } = rig()
    expect(sound.call('chicken', [5, 0, 0], { key: 'hen_1' })).toBe(true)
    expect(sound.call('chicken', [5, 0, 0], { key: 'hen_1' })).toBe(false)
    expect(sound.call('chicken', [6, 0, 0], { key: 'hen_2' })).toBe(true)
    sound.update(5.9)
    expect(sound.call('chicken', [5, 0, 0], { key: 'hen_1' })).toBe(false)
    sound.update(0.2)
    expect(sound.call('chicken', [5, 0, 0], { key: 'hen_1' })).toBe(true)
    expect(asked).toEqual(['hen_cluck', 'hen_cluck', 'hen_cluck'])
  })

  it('stays silent for a species the page gives no call, takes a replaced call and a silenced one', () => {
    const { asked } = rig()
    const sink = { play: (request: { sound: string }) => void asked.push(request.sound) }
    const sound = createAnimalSound(sink, { calls: { horse: { sound: 'cow_moo', cooldown: 10, noiseMetres: 50 }, dog: null } })
    expect(sound.call('pig', [1, 0, 0])).toBe(false)
    expect(sound.call('dog', [1, 0, 0])).toBe(false)
    expect(sound.call('horse', [1, 0, 0])).toBe(true)
    expect(asked).toEqual(['cow_moo'])
  })
})
