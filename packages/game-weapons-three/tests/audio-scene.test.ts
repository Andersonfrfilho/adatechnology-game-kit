import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createAudioEngine } from '@adatechnology/game-audio'
import type { LoopRecipe } from '@adatechnology/game-audio'
import { createAudioRecorder, diffAudioTrace } from '@adatechnology/golden-tool'
import type { AudioTrace } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { createWeaponAudio, MECHANICAL_SOUNDS } from '../src'
import type { MechanicalSoundId } from '../src'

// T6.1e2: the reload sounds of the weapons are the Cena de Arte ones (cena L1335-L1344), checked against the trace of the team code itself.
const fixture = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/golden/fixtures/audio/art-scene-audio.json')
type Fixture = { readonly seed: number; readonly cases: readonly { readonly id: string; readonly trace: AudioTrace }[] }
const art = JSON.parse(readFileSync(fixture, 'utf8')) as Fixture

// the three loops `initAudio` opens before any sound; they only matter here because they number the nodes
const loop = (id: string, filters: LoopRecipe['filters'], modulators?: LoopRecipe['modulators']): LoopRecipe => ({
  id,
  bus: 'weather',
  order: 'chain_loop',
  source: { kind: 'noise', loop: true },
  filters,
  ...(modulators ? { modulators } : {}),
  sources: ['cena:L1314-L1316'],
})
const LOOPS = [
  { recipe: loop('rain', { mode: 'serial', bank: [{ type: 'highpass', frequency: { set: 600 } }, { type: 'lowpass', frequency: { set: 6000 } }] }), volume: 0.06 },
  { recipe: loop('wind', { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 320 } }] }, [{ target: 'gain', rate: 0.07, depth: 0.035 }]), volume: 0.05 },
  { recipe: loop('fire', { mode: 'serial', bank: [{ type: 'bandpass', frequency: { set: 1800 }, q: 0.6 }] }), volume: 0 },
]

const sceneSteps = (id: MechanicalSoundId) => MECHANICAL_SOUNDS[id].filter((step) => step.layer.startsWith('scene_'))

function artScene(play: (audio: ReturnType<typeof createWeaponAudio>) => void, mechanical: Parameters<typeof createWeaponAudio>[1]) {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ seed: art.seed, mix: 'art_scene', createContext: () => recorder.context, banks: [{ id: 'loops', loops: LOOPS.map((entry) => entry.recipe) }] })
  engine.unlock()
  for (const entry of LOOPS) engine.loop(entry.recipe.id, { volume: entry.volume })
  recorder.clearEntries()
  play(createWeaponAudio(0.6, { engine, ...mechanical }))
  return recorder.trace()
}

describe('the reload sounds of the Cena de Arte', () => {
  const cases: ReadonlyArray<readonly [string, MechanicalSoundId]> = [
    ['empty', 'dry_fire'],
    ['magOut', 'magazine_out'],
    ['magIn', 'magazine_in'],
    ['bolt', 'charge'],
    ['shell', 'round_in'],
  ]
  for (const [team, id] of cases) {
    it(`${team} (${id}) leaves the trace of the team code`, () => {
      const expected = art.cases.find((entry) => entry.id === team)!.trace
      // only the art scene layers: the game classes (`vazio`, `recarga`) played with them are the other team's and have their own fixture
      const trace = artScene((audio) => audio.mechanical(id), { mechanical: { [id]: sceneSteps(id) } })
      expect(diffAudioTrace(expected, trace)).toEqual([])
    })
  }

  it('keeps the game classes with the Cena clicks, and the SDK metal where the teams delivered nothing', () => {
    expect(MECHANICAL_SOUNDS.dry_fire.map((step) => step.layer)).toEqual(['class', 'scene_tone', 'scene_noise'])
    expect(MECHANICAL_SOUNDS.magazine_out.some((step) => step.layer === 'class')).toBe(true)
    expect(MECHANICAL_SOUNDS.misfire.some((step) => step.layer === 'metal')).toBe(true)
    expect(MECHANICAL_SOUNDS.safety_on.every((step) => step.layer === 'metal')).toBe(true)
  })

  it('casing: one ring from 4200 to 5700 Hz sliding to 3800, 0.25 to 0.45 s late, 0.06 s long', () => {
    const trace = artScene((audio) => audio.clink(), {})
    const frequency = trace.entries.filter((entry) => entry.op === 'param' && entry.param === 'frequency' && entry.method === 'setValueAtTime')
    expect(frequency).toHaveLength(1)
    const [hz, at] = frequency[0]!.args as [number, number]
    expect(hz).toBeGreaterThanOrEqual(4200)
    expect(hz).toBeLessThan(5700)
    expect(at).toBeGreaterThanOrEqual(0.25)
    expect(at).toBeLessThan(0.45)
    expect(trace.entries.find((entry) => entry.op === 'param' && entry.method === 'exponentialRampToValueAtTime' && entry.param === 'frequency')!.args).toEqual([3800, at + 0.062])
  })
})
