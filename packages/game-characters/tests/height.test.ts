import { describe, expect, it } from 'vitest'

import {
  BODY_TYPE_IDS,
  HEIGHTS_BY_TYPE_METRES,
  HEIGHT_RANGE_METRES,
  InvalidHeightError,
  REFERENCE_HEIGHT_METRES,
  assertHeight,
  defaultHeightMetres,
  heightFactor,
} from '../src/index'

describe('body height (Spec 012 T1.1)', () => {
  it('declares reference height, supported range and heightMetres per type in data', () => {
    expect(REFERENCE_HEIGHT_METRES).toBe(1.8)
    expect(HEIGHT_RANGE_METRES.min).toBeLessThanOrEqual(0.9)
    expect(HEIGHT_RANGE_METRES.max).toBeGreaterThanOrEqual(2.6)
    expect(BODY_TYPE_IDS).toContain('human')
    expect(BODY_TYPE_IDS).toContain('Lento')
    expect(BODY_TYPE_IDS).toContain('Brutamonte')
    expect(HEIGHTS_BY_TYPE_METRES.human).toBe(1.8)
    expect(HEIGHTS_BY_TYPE_METRES.Lento).toBe(1.8)
    expect(HEIGHTS_BY_TYPE_METRES.Corredor).toBe(1.75)
    expect(HEIGHTS_BY_TYPE_METRES.Brutamonte).toBe(2.56)
    expect(HEIGHTS_BY_TYPE_METRES.Inchado).toBe(1.85)
  })

  it('assertHeight accepts valid heights and throws InvalidHeightError outside range', () => {
    expect(assertHeight(1.8)).toBe(1.8)
    expect(assertHeight(HEIGHT_RANGE_METRES.min)).toBe(HEIGHT_RANGE_METRES.min)
    expect(assertHeight(HEIGHT_RANGE_METRES.max)).toBe(HEIGHT_RANGE_METRES.max)

    for (const invalid of [0, -1.5, 0.2, 4.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => assertHeight(invalid)).toThrow(InvalidHeightError)
      try {
        assertHeight(invalid)
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidHeightError)
        if (err instanceof InvalidHeightError) {
          expect(err.code).toBe('INVALID_HEIGHT')
          expect(err.minMetres).toBe(HEIGHT_RANGE_METRES.min)
          expect(err.maxMetres).toBe(HEIGHT_RANGE_METRES.max)
        }
      }
    }
  })

  it('heightFactor converts metres into a factor relative to reference or declared type height', () => {
    expect(heightFactor(1.8)).toBeCloseTo(1, 6)
    expect(heightFactor(1.44)).toBeCloseTo(0.8, 6)
    expect(heightFactor(2.16)).toBeCloseTo(1.2, 6)
    expect(heightFactor(2.56, 'Brutamonte')).toBeCloseTo(1, 6)
    expect(heightFactor(1.75, 'Corredor')).toBeCloseTo(1, 6)
    expect(defaultHeightMetres('Brutamonte')).toBe(2.56)
    expect(defaultHeightMetres('unknown_type')).toBe(REFERENCE_HEIGHT_METRES)
    expect(() => heightFactor(0.1)).toThrow(InvalidHeightError)
  })
})
