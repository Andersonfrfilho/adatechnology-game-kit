import { describe, expect, it } from 'vitest'

import { AGE_PRESETS, drawHeightMetres, getAgePreset } from '../src/index'

describe('age height ranges in metres (Spec 012 T2.2)', () => {
  it('declares heightMetres ranges for every age group', () => {
    expect(AGE_PRESETS).toHaveLength(4)
    expect(getAgePreset('child')?.heightMetres).toEqual([0.94, 1.26])
    expect(getAgePreset('young')?.heightMetres).toEqual([1.75, 1.8])
    expect(getAgePreset('adult')?.heightMetres).toEqual([1.75, 1.93])
    expect(getAgePreset('elder')?.heightMetres).toEqual([1.62, 1.8])
  })

  it('drawHeightMetres is deterministic by seed and stays inside the age range', () => {
    for (const preset of AGE_PRESETS) {
      const [min, max] = preset.heightMetres
      const a = drawHeightMetres(preset.id, 42)
      const b = drawHeightMetres(preset.id, 42)
      expect(a).toBe(b)
      expect(a).toBeGreaterThanOrEqual(min)
      expect(a).toBeLessThanOrEqual(max)
      for (let seed = 1; seed <= 25; seed++) {
        const drawn = drawHeightMetres(preset.id, seed)
        expect(drawn).toBeGreaterThanOrEqual(min)
        expect(drawn).toBeLessThanOrEqual(max)
      }
    }
  })
})
