import { BODY_FOLEY_IDS, SURFACE_IDS, footstepSoundId } from '@adatechnology/game-contracts'
import { createAudioRecorder } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { BODY_FOLEY_BANK, BODY_FOLEY_TAKES, createAudioEngine, createRng, createSetPicker, planSound, retunePlan } from '../src'
import type { SoundPlan, SoundSet } from '../src'

const engineWith = () => {
  const recorder = createAudioRecorder()
  const engine = createAudioEngine({ banks: [BODY_FOLEY_BANK], createContext: () => recorder.context })
  const played: string[] = []
  return { engine, played }
}

const peakOf = (plan: SoundPlan): number => plan.layers.reduce((sum, layer) => sum + layer.level * Math.max(...layer.envelope.map((point) => point.value)), 0)

describe('body foley bank', () => {
  it('answers every body sound of the contract with a set of four takes, each one a recipe that plans', () => {
    const sets = new Map((BODY_FOLEY_BANK.sets ?? []).map((set) => [set.id, set]))
    const recipes = new Map((BODY_FOLEY_BANK.sounds ?? []).map((sound) => [sound.id, sound]))
    for (const id of BODY_FOLEY_IDS) {
      const set = sets.get(id)
      expect(set, id).toBeDefined()
      expect(set!.variants).toHaveLength(BODY_FOLEY_TAKES)
      for (const variant of set!.variants) {
        const recipe = recipes.get(variant)
        expect(recipe, variant).toBeDefined()
        const plan = planSound(recipe!, { random: createRng(3) })
        expect(plan?.layers.length, variant).toBeGreaterThan(0)
        // C4: every body sound is placed left or right of the listener
        expect(recipe!.pan, variant).toBe(true)
      }
    }
  })

  it('makes the takes of a footstep really different, not the same numbers redrawn', () => {
    const set = (BODY_FOLEY_BANK.sets ?? []).find((s) => s.id === 'footstep_gravel_walk')!
    const plans = set.variants.map((id) => planSound((BODY_FOLEY_BANK.sounds ?? []).find((s) => s.id === id)!, { random: createRng(1) })!)
    const lengths = new Set(plans.map((plan) => plan.length.toFixed(4)))
    expect(lengths.size).toBe(BODY_FOLEY_TAKES)
  })

  it('a run is louder and shorter than a walk on the same surface (C7: the layer changes, not only the volume)', () => {
    const plan = (id: string) => planSound((BODY_FOLEY_BANK.sounds ?? []).find((s) => s.id === `${id}_01`)!, { random: createRng(1) })!
    for (const surface of SURFACE_IDS) {
      const walk = plan(footstepSoundId(surface, 'walk'))
      const run = plan(footstepSoundId(surface, 'run'))
      expect(peakOf(run), surface).toBeGreaterThan(peakOf(walk))
      // heel and toe closer together
      expect(run.layers[2]!.at, surface).toBeLessThan(walk.layers[2]!.at)
    }
  })

  it('a heavy landing is heavier than a light one, and a blow on a body louder than a footstep (C6)', () => {
    const plan = (id: string) => planSound((BODY_FOLEY_BANK.sounds ?? []).find((s) => s.id === `${id}_01`)!, { random: createRng(1) })!
    expect(peakOf(plan('land_concrete_heavy'))).toBeGreaterThan(peakOf(plan('land_concrete_light')))
    expect(peakOf(plan('punch_hit_body'))).toBeGreaterThan(peakOf(plan('footstep_concrete_walk')))
    expect(peakOf(plan('blunt_hit'))).toBeGreaterThan(peakOf(plan('punch_hit_body')))
  })

  it('fades a footstep with distance and dulls it (C3)', () => {
    const recipe = (BODY_FOLEY_BANK.sounds ?? []).find((s) => s.id === 'footstep_concrete_walk_01')!
    const near = planSound(recipe, { random: createRng(1), distance: 1 })!
    const far = planSound(recipe, { random: createRng(1), distance: 20 })!
    expect(far.level).toBeLessThan(near.level / 5)
    const cutoff = (plan: SoundPlan) => plan.layers[1]!.filters!.bank[0]!.frequency.value!
    expect(cutoff(far)).toBeLessThan(cutoff(near))
  })
})

describe('sound sets', () => {
  const set: SoundSet = { id: 'x', variants: ['a', 'b', 'c', 'd'], rate: [0.96, 1.04] }

  it('never picks the same take twice in a row and uses all of them (C5)', () => {
    const picker = createSetPicker()
    const random = createRng(7)
    let last = ''
    const seen = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const { id, rate } = picker.pick(set, random)
      expect(id).not.toBe(last)
      expect(rate).toBeGreaterThanOrEqual(0.96)
      expect(rate).toBeLessThanOrEqual(1.04)
      last = id
      seen.add(id)
    }
    expect(seen.size).toBe(4)
  })

  it('in ten plays of one action, at least four takes sound', () => {
    const picker = createSetPicker()
    const random = createRng(11)
    const ids = Array.from({ length: 10 }, () => picker.pick(set, random).id)
    expect(new Set(ids).size).toBeGreaterThanOrEqual(4)
  })

  it('the engine plays a set id through one of its takes', () => {
    const { engine } = engineWith()
    const handles = Array.from({ length: 6 }, () => engine.play('footstep_wood_run', { position: [1, 0, 0] }))
    const ids = handles.map((handle) => handle?.plan.id)
    for (const id of ids) expect(id).toMatch(/^footstep_wood_run_0[1-4]$/)
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1])
    // plan() is pure and resolves the set too
    expect(engine.plan('footstep_wood_run')?.id).toMatch(/^footstep_wood_run_0[1-4]$/)
  })
})

describe('retunePlan', () => {
  it('plays a plan faster and higher, as a tape', () => {
    const recipe = (BODY_FOLEY_BANK.sounds ?? []).find((s) => s.id === 'footstep_metal_walk_01')!
    const plan = planSound(recipe, { random: createRng(2) })!
    const fast = retunePlan(plan, 1.05)
    expect(fast.length).toBeCloseTo(plan.length / 1.05, 6)
    const tone = (p: SoundPlan) => p.layers.find((layer) => layer.source.kind === 'osc')!
    const from = (p: SoundPlan) => (tone(p).source as { frequency: { from?: number } }).frequency.from!
    expect(from(fast)).toBeCloseTo(from(plan) * 1.05, 6)
    expect(retunePlan(plan, 1)).toBe(plan)
  })
})
