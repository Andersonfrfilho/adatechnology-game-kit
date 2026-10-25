import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAudioEngine } from '@adatechnology/game-audio'
import type { AudioEngine, LoopRecipe } from '@adatechnology/game-audio'
import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { CHARACTER_SOUND_BANK, CHARACTER_SOUNDS } from '../src'

// The sounds of the bodies against the team code: the game's grito and voz, the art scene's voice, groan, scream, inhale, leap, grab, bite, hurt, flesh,
// sever and gore, run on a fake AudioContext under the same seed.
const golden = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/golden/fixtures/audio')
type Fixture = { readonly seed: number; readonly cases: readonly { readonly id: string; readonly trace: AudioTrace }[] }
const load = (name: string): Fixture => JSON.parse(readFileSync(resolve(golden, name), 'utf8')) as Fixture
const art = load('art-scene-audio.json')
const game = load('game-audio.json')
const expected = (fixture: Fixture, id: string): AudioTrace => {
  const found = fixture.cases.find((entry) => entry.id === id)
  if (!found) throw new Error(`no fixture case ${id}`)
  return found.trace
}

// the loops `initAudio` opens after the chain (rain, wind and the fire at 0): the fixture's node numbers count them, so the engine opens them too
const chainLoop = (id: string, bank: NonNullable<LoopRecipe['filters']>['bank'], modulators?: LoopRecipe['modulators']): LoopRecipe => ({
  id,
  bus: 'weather',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters: { mode: 'serial', bank },
  ...(modulators ? { modulators } : {}),
  sources: ['cena:L1314-L1316'],
})
const LOOPS: LoopRecipe[] = [
  chainLoop('rain', [{ type: 'highpass', frequency: { set: 600 } }, { type: 'lowpass', frequency: { set: 6000 } }]),
  chainLoop('wind', [{ type: 'lowpass', frequency: { set: 320 } }], [{ target: 'gain', rate: 0.07, depth: 0.035 }]),
  chainLoop('fire', [{ type: 'bandpass', frequency: { set: 1800 }, q: 0.6 }]),
]

// the art scene after `initAudio`, listener at the origin looking along camTheta 0.6
function artScene(play: (engine: AudioEngine) => void): AudioTrace {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ seed: art.seed, mix: 'art_scene', groups: NO_LIMIT, createContext: () => recorder.context, banks: [CHARACTER_SOUND_BANK, { id: 'chain_loops', loops: LOOPS }] })
  engine.setListener({ position: [0, 0, 0], yaw: 0.6 })
  engine.unlock()
  engine.loop('rain', { volume: 0.06 })
  engine.loop('wind', { volume: 0.05 })
  engine.loop('fire', { volume: 0 })
  recorder.clearEntries()
  play(engine)
  return recorder.trace()
}

// the traces are of one routine called directly (the page's callers decide the 40 m and the five at once): the limiter has its own tests below
const NO_LIMIT = { undead_voice: {} }

const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [3, 2],
  [12, -9],
  [40, 25],
]

describe("the game's voices", () => {
  const run = (id: string, sound: string, distance: number): void => {
    const recorder = createAudioRecorder()
    const engine = createAudioEngine({ seed: game.seed, mix: 'game', groups: NO_LIMIT, createContext: () => recorder.context, banks: [CHARACTER_SOUND_BANK] })
    engine.unlock()
    engine.play(sound, { distance })
    expect(diffAudioTrace(expected(game, id), recorder.trace())).toEqual([])
  }
  for (const distance of [0, 10, 30, 60, 100]) it(`scream_hoarse at ${distance} m leaves the trace of grito(${distance})`, () => run(`grito@${distance}`, 'scream_hoarse', distance))
  for (const distance of [0, 15, 40, 80]) it(`groan at ${distance} m leaves the trace of voz('gemido')`, () => run(`voz.gemido@${distance}`, 'groan', distance))
  for (const distance of [0, 15, 40]) it(`runner_groan at ${distance} m leaves the trace of voz('corredor')`, () => run(`voz.corredor@${distance}`, 'runner_groan', distance))
  it("voz('grito') hands over to grito at once: the scream is the same trace", () => {
    expect(expected(game, 'voz.grito@0').entries).toEqual(expected(game, 'grito@0').entries)
    run('voz.grito@30', 'scream_hoarse', 30)
  })
})

describe('the art scene voices', () => {
  const groans: ReadonlyArray<readonly [string, string]> = [
    ['walker', 'groan_walker'],
    ['runner', 'groan_runner'],
    ['brute', 'groan_brute'],
  ]
  for (const [team, id] of groans) {
    for (const [x, z] of POSITIONS) {
      it(`${id} at ${x},${z} leaves the trace of sfx.groan (${team})`, () => {
        const trace = artScene((engine) => void engine.play(id, { position: [x, 0, z] }))
        expect(diffAudioTrace(expected(art, `groan.${team}@${x},${z}`), trace)).toEqual([])
      })
    }
  }
  for (const name of ['scream', 'inhale', 'leap']) {
    for (const [x, z] of POSITIONS) {
      it(`${name} at ${x},${z} leaves the trace of sfx.${name}`, () => {
        const trace = artScene((engine) => void engine.play(name, { position: [x, 0, z] }))
        expect(diffAudioTrace(expected(art, `${name}@${x},${z}`), trace)).toEqual([])
      })
    }
  }
})

describe('what the player hears and what a wound sounds like', () => {
  for (const name of ['grab', 'bite', 'hurt']) {
    it(`${name} at the listener leaves the trace of sfx.${name}`, () => {
      expect(diffAudioTrace(expected(art, name), artScene((engine) => void engine.play(name)))).toEqual([])
    })
  }
  for (const [name, id] of [['flesh', 'flesh'], ['sever', 'sever'], ['gore', 'gore']] as const) {
    for (const [x, z] of POSITIONS) {
      it(`${id} at ${x},${z} leaves the trace of sfx.${name}`, () => {
        const trace = artScene((engine) => void engine.play(id, { position: [x, 0, z] }))
        expect(diffAudioTrace(expected(art, `${name}@${x},${z}`), trace)).toEqual([])
      })
    }
  }
  it('flesh_head leaves the trace of sfx.flesh(x, z, true)', () => {
    expect(diffAudioTrace(expected(art, 'flesh.head@3,2'), artScene((engine) => void engine.play('flesh_head', { position: [3, 0, 2] })))).toEqual([])
  })
})

describe('the bank', () => {
  it('keeps the line of the team code in the sources of every recipe', () => {
    for (const recipe of CHARACTER_SOUNDS) expect(recipe.sources[0], recipe.id).toMatch(/^(jogo:L\d+|cena:L13\d\d )/)
  })
  it('puts the groans in the undead voice group and leaves the screams out of it', () => {
    const groups = Object.fromEntries(CHARACTER_SOUNDS.map((recipe) => [recipe.id, recipe.group]))
    for (const id of ['groan', 'runner_groan', 'groan_walker', 'groan_runner', 'groan_brute']) expect(groups[id], id).toBe('undead_voice')
    for (const id of ['scream_hoarse', 'scream', 'leap', 'inhale']) expect(groups[id], id).toBeUndefined()
  })
})
