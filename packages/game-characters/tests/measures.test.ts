import { describe, expect, it } from 'vitest'

import { ANTHROPOMETRY_RATIOS, ANTHROPOMETRY_SOURCE, InvalidHeightError, bodyMeasures } from '../src/index'

describe('bodyMeasures (Spec 012 R4 / T2.1)', () => {
  it('exposes anthropometric ratios from data with cited source', () => {
    expect(ANTHROPOMETRY_SOURCE).toContain('ISO 7250-1')
    expect(ANTHROPOMETRY_RATIOS.seatedHeightRatio).toBe(0.52)
    expect(ANTHROPOMETRY_RATIOS.seatedEyeHeightRatio).toBe(0.455)
    expect(ANTHROPOMETRY_RATIOS.shoulderWidthRatio).toBe(0.26)
    expect(ANTHROPOMETRY_RATIOS.thighLengthRatio).toBe(0.34)
    expect(ANTHROPOMETRY_RATIOS.shinLengthRatio).toBe(0.285)
  })

  it('derives BodyMeasures in metres for 1.55 m, 1.80 m and 2.05 m bodies', () => {
    const m180 = bodyMeasures({ heightMetres: 1.8 })
    expect(m180.heightMetres).toBe(1.8)
    expect(m180.build).toBe(1)
    expect(m180.seatedHeightMetres).toBeCloseTo(0.936, 4)
    expect(m180.seatedEyeHeightMetres).toBeCloseTo(0.819, 4)
    expect(m180.shoulderWidthMetres).toBeCloseTo(0.468, 4)
    expect(m180.thighLengthMetres).toBeCloseTo(0.612, 4)
    expect(m180.shinLengthMetres).toBeCloseTo(0.513, 4)

    const m155 = bodyMeasures({ heightMetres: 1.55 })
    const m205 = bodyMeasures({ heightMetres: 2.05 })
    expect(m155.seatedHeightMetres).toBeCloseTo(0.806, 4)
    expect(m205.seatedHeightMetres).toBeCloseTo(1.066, 4)
    expect(m155.seatedEyeHeightMetres).toBeLessThan(m180.seatedEyeHeightMetres)
    expect(m205.seatedEyeHeightMetres).toBeGreaterThan(m180.seatedEyeHeightMetres)
  })

  it('scales shoulder width by lateral build without altering vertical measures', () => {
    const slim = bodyMeasures({ heightMetres: 1.8, build: 0.9 })
    const broad = bodyMeasures({ heightMetres: 1.8, build: 1.2 })
    expect(slim.seatedHeightMetres).toBe(broad.seatedHeightMetres)
    expect(slim.thighLengthMetres).toBe(broad.thighLengthMetres)
    expect(broad.shoulderWidthMetres).toBeCloseTo(1.8 * 0.26 * 1.2, 4)
    expect(slim.shoulderWidthMetres).toBeLessThan(broad.shoulderWidthMetres)
  })

  it('throws InvalidHeightError for out-of-range heights and RangeError for non-positive build', () => {
    expect(() => bodyMeasures({ heightMetres: 0.2 })).toThrow(InvalidHeightError)
    expect(() => bodyMeasures({ heightMetres: 4.0 })).toThrow(InvalidHeightError)
    expect(() => bodyMeasures({ heightMetres: 1.8, build: 0 })).toThrow(RangeError)
    expect(() => bodyMeasures({ heightMetres: 1.8, build: -1 })).toThrow(RangeError)
  })
})
