import { describe, expect, it } from 'vitest'

import { createRng, planSound } from '../src'
import type { SoundRecipe } from '../src'

const scream: SoundRecipe = {
  id: 'scream_test',
  bus: 'voices',
  order: 'scream',
  duration: [1, 1.4],
  layers: [
    {
      source: { kind: 'noise', offset: 'random' },
      filters: { mode: 'parallel', bank: [{ type: 'bandpass', q: 6, frequency: { from: 805, to: 560, curve: 'linear', over: 'duration' }, level: 1 }] },
      modulators: [{ target: 'gain', wave: 'square', rate: [31, 40], depth: 0.35 }],
      envelope: [
        [0, 0, 'set'],
        [0.06, 0.9, 'linear'],
        ['0.6d', 0.9, 'set'],
        ['1d', 0.001, 'exp', 'fixed'],
      ],
    },
  ],
  falloff: { model: 'inverse_square', k: 0.006, minGain: 0.02 },
  sources: ['test'],
}

describe('planSound', () => {
  it('draws the duration, then the layer fields in order, and the noise offset last', () => {
    const random = createRng(9)
    const expected = createRng(9)
    const duration = 1 + expected() * 0.4
    const rate = 31 + expected() * 9
    const offset = expected()
    const plan = planSound(scream, { random, distance: 10 })
    const layer = plan?.layers[0]
    expect(layer?.duration).toBeCloseTo(duration, 12)
    expect(layer?.modulators[0]?.rate).toBeCloseTo(rate, 12)
    expect(layer?.source).toEqual({ kind: 'noise', offset, loop: false })
  })

  it('scales the envelope by the level except fixed points, and resolves duration times', () => {
    const plan = planSound(scream, { random: createRng(1), distance: 10 })
    const level = 1 / (1 + 100 * 0.006)
    const layer = plan?.layers[0]
    expect(plan?.level).toBeCloseTo(level, 12)
    expect(layer?.envelope[1]?.value).toBeCloseTo(0.9 * level, 12)
    expect(layer?.envelope[2]?.time).toBeCloseTo((layer?.duration ?? 0) * 0.6, 12)
    expect(layer?.envelope[3]?.value).toBe(0.001)
    expect(layer?.filters?.bank[0]?.frequency).toEqual({ from: 805, to: 560, curve: 'linear', at: layer?.duration })
  })

  it('is null below minGain and draws nothing', () => {
    const random = createRng(3)
    expect(planSound(scream, { random, distance: 100 })).toBeNull()
    expect(random()).toBe(createRng(3)())
  })

  it('keeps a silent plan when the recipe asks for it', () => {
    const plan = planSound({ ...scream, keepSilent: true }, { distance: 100 })
    expect(plan).toMatchObject({ silent: true, layers: [] })
  })

  it('draws vars first, in order, and lets params given by the caller win without drawing', () => {
    const recipe: SoundRecipe = {
      id: 'groan_test',
      bus: 'voices',
      order: 'groan',
      vars: { base: [95, 135], dur: [0.9, 1.5] },
      duration: { param: 'dur' },
      layers: [
        {
          source: { kind: 'osc', wave: 'sawtooth', frequency: { from: { param: 'base' }, to: { param: 'base', scale: 0.7 }, curve: 'linear', over: 'duration' } },
          filters: { mode: 'serial', bank: [{ type: 'bandpass', q: 3, frequency: { set: { param: 'base', scale: 3 } } }] },
          envelope: [[0, 0, 'set']],
        },
      ],
      sources: ['test'],
    }
    const expected = createRng(5)
    const base = 95 + expected() * 40
    const dur = 0.9 + expected() * 0.6
    const plan = planSound(recipe, { random: createRng(5) })
    expect(plan?.layers[0]?.duration).toBeCloseTo(dur, 12)
    expect(plan?.layers[0]?.filters?.bank[0]?.frequency.value).toBeCloseTo(base * 3, 10)
    const given = planSound(recipe, { random: createRng(5), params: { base: 100 } })
    expect(given?.layers[0]?.source).toMatchObject({ frequency: { from: 100, to: 70 } })
    expect(given?.layers[0]?.duration).toBeCloseTo(0.9 + createRng(5)() * 0.6, 12)
  })

  it('muffles lowpass cutoffs with the game curve and the occlusion', () => {
    const burst: SoundRecipe = {
      id: 'burst_test',
      bus: 'weapons',
      order: 'burst',
      duration: 0.18,
      layers: [{ source: { kind: 'noise', offset: 'random' }, filters: { mode: 'serial', bank: [{ type: 'lowpass', frequency: { set: 1800 } }] }, envelope: [[0, 0.9, 'set']] }],
      falloff: { model: 'inverse_square', k: 0.004, cutoffK: 0.01, minGain: 0.01 },
      sources: ['test'],
    }
    expect(planSound(burst, { distance: 60 })?.layers[0]?.filters?.bank[0]?.frequency.value).toBeCloseTo(1800 / 1.6, 9)
    const occluded = planSound(burst, { distance: 0, occlusion: 1 })
    expect(occluded?.layers[0]?.filters?.bank[0]?.frequency.value).toBeCloseTo(1800 * 0.4, 9)
    expect(occluded?.level).toBeCloseTo(0.5, 12)
  })

  it('expands repeats and pans from the listener', () => {
    const calls: SoundRecipe = {
      id: 'calls_test',
      bus: 'world',
      duration: 0.12,
      pan: true,
      layers: [{ repeat: { count: 2, spacing: 0.22 }, source: { kind: 'osc', wave: 'square', frequency: { from: 520, to: 312, curve: 'exp', over: 'duration' } }, envelope: [[0, 1, 'set']] }],
      falloff: { model: 'linear', range: 70, scale: 0.25, minGain: 0.005 },
      sources: ['test'],
    }
    const plan = planSound(calls, { position: [10, 0, 0], listener: { position: [0, 0, 0], yaw: 0 } })
    expect(plan?.layers.map((layer) => layer.at)).toEqual([0, 0.22])
    expect(plan?.pan).toBeCloseTo(0.85, 12)
    expect(plan?.level).toBeCloseTo((1 - 10 / 70) * 0.25, 12)
    expect(plan?.length).toBeCloseTo(0.22 + 0.12 + 0.05, 12)
  })

  it('throws on a param nobody gave', () => {
    const recipe: SoundRecipe = { ...scream, duration: { param: 'missing' } }
    expect(() => planSound(recipe)).toThrow(/missing/)
  })
})
