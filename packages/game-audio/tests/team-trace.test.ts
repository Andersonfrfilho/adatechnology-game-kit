import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { GAME_SFX_BANK, GAME_SFX_CLASSES, LIBRARY_BANK, createAudioEngine } from '../src'
import type { AudioEngine } from '../src'
import { ANIMAL_IDS, GAME_LOOP_IDS, TEAM_ART_SCENE_BANK, TEAM_GAME_BANK } from './support/team-game-recipes'

// "Igual ao original" (spec 001, S3): the team routines were run on a fake AudioContext under a seeded Math.random and their log is the fixture;
// the engine runs the same call on the same fake with the same seed and must leave the same log (generated parameters, not audio).
const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/golden/fixtures/audio')
type Fixture = { readonly seed: number; readonly cases: readonly { readonly id: string; readonly trace: AudioTrace }[] }
const load = (name: string): Fixture => JSON.parse(readFileSync(resolve(fixtures, name), 'utf8')) as Fixture
const game = load('game-audio.json')
const artScene = load('art-scene-audio.json')
const expectedOf = (fixture: Fixture, id: string): AudioTrace => {
  const found = fixture.cases.find((entry) => entry.id === id)
  if (!found) throw new Error(`no fixture case ${id}`)
  return found.trace
}

function rig(mix: 'game' | 'art_scene', seed: number) {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ seed, mix, banks: [GAME_SFX_BANK, LIBRARY_BANK, TEAM_GAME_BANK, TEAM_ART_SCENE_BANK], createContext: () => recorder.context })
  return { recorder, engine }
}
const expectSame = (expected: AudioTrace, actual: AudioTrace): void => expect(diffAudioTrace(expected, actual)).toEqual([])

describe('the game routines (jogo.js)', () => {
  const run = (id: string, play: (engine: AudioEngine) => void): void => {
    const { recorder, engine } = rig('game', game.seed)
    engine.unlock()
    play(engine)
    expectSame(expectedOf(game, id), recorder.trace())
  }

  it('audioInit: the master at 0.5 into the output', () => run('init', () => undefined))

  const classIds = Object.fromEntries(GAME_SFX_CLASSES.map((row) => [row.team, `sfx_${row.id}`]))
  for (const testCase of game.cases.filter((entry) => entry.id.startsWith('sfx.'))) {
    const [, name, distance] = /^sfx\.([^.@]+)(?:\.half_volume)?@(\d+)$/.exec(testCase.id) ?? []
    const id = classIds[name as string] ?? 'sfx_unknown'
    const volume = testCase.id.includes('half_volume') ? 0.5 : 1
    it(testCase.id, () => run(testCase.id, (engine) => void engine.play(id, { distance: Number(distance), volume })))
  }

  for (const testCase of game.cases.filter((entry) => entry.id.startsWith('loop.'))) {
    const [, name, level] = /^loop\.(\w+)@([\d.]+)$/.exec(testCase.id) as RegExpExecArray
    it(testCase.id, () =>
      run(testCase.id, (engine) => {
        const handle = engine.loop(GAME_LOOP_IDS[name as string] as string)
        const frequency = name === 'motor' ? 120 : 0
        handle.set({ volume: Number(level), frequency })
        handle.set({ volume: Number(level) * 1.5, frequency: frequency * 1.2 })
      }),
    )
  }

  for (const testCase of game.cases.filter((entry) => /^(grito|voz|bichoSom|boom)/.test(entry.id))) {
    const [, kind, variant, distance] = /^(\w+)(?:\.(\w+))?@(\d+)$/.exec(testCase.id) as RegExpExecArray
    const sound =
      kind === 'grito' ? 'scream_hoarse' : kind === 'boom' ? 'explosion_boom' : kind === 'bichoSom' ? ANIMAL_IDS[variant as string] : variant === 'gemido' ? 'groan' : variant === 'corredor' ? 'runner_groan' : 'scream_hoarse'
    it(testCase.id, () => run(testCase.id, (engine) => void (sound && engine.play(sound, { distance: Number(distance) }))))
  }

  it('chiado and buzina', () => {
    run('chiado', (engine) => void engine.play('radio_static'))
    run('buzina', (engine) => void engine.play('horn'))
  })

  it("voz('grito') hands over to grito at once: its own grito arms are dead code and are not ported", () => {
    const viaVoz = expectedOf(game, 'voz.grito@0').entries
    const direct = expectedOf(game, 'grito@0').entries
    expect(viaVoz).toEqual(direct)
  })
})

describe('the art scene (arte__cena-de-arte.js)', () => {
  // initAudio opens the rain (0.06 while it rains), wind and fire (silent) loops right after the chain.
  const openLoops = (engine: AudioEngine): void => {
    for (const [id, volume] of [['rain_loop', 0.06], ['wind_loop', 0.05], ['fire_loop', 0]] as const) engine.loop(id, { volume })
  }
  it('initAudio: compressor, master, seeded reverb impulse, wet bus, noise and the rain, wind and fire loops', () => {
    const { recorder, engine } = rig('art_scene', artScene.seed)
    engine.unlock()
    openLoops(engine)
    expectSame(expectedOf(artScene, 'chain'), recorder.trace())
  })

  it('siren: swept sine through the reverb send', () => {
    const { recorder, engine } = rig('art_scene', artScene.seed)
    engine.unlock()
    openLoops(engine)
    recorder.clearEntries()
    engine.play('siren')
    expectSame(expectedOf(artScene, 'siren'), recorder.trace())
  })
})
