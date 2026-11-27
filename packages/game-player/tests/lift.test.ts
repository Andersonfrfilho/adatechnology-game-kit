import { describe, expect, it } from 'vitest'
import { LIFT_DEFAULTS, liftCheckFor } from '../src'

describe('lifting a thing with the hands', () => {
  it('a sofa (45 kg, 2 x 0.9 x 0.85 m) does not go up: held that far from the body it is more than the back lifts', () => {
    const check = liftCheckFor({ massKg: 45, size: [2, 0.85, 0.9] })
    expect(check.verdict).toBe('too_bulky')
    expect(check.liftableKg).toBeLessThan(45)
  })

  it('a gas bottle, a nightstand, a TV and a chair go up', () => {
    expect(liftCheckFor({ massKg: 16, size: [0.36, 0.58, 0.36] }).verdict).toBe('ok')
    expect(liftCheckFor({ massKg: 12, size: [0.45, 0.55, 0.4] }).verdict).toBe('ok')
    expect(liftCheckFor({ massKg: 12, size: [1, 0.68, 0.22] }).verdict).toBe('ok')
    expect(liftCheckFor({ massKg: 5, size: [0.45, 0.9, 0.45] }).verdict).toBe('ok')
  })

  it('the same mass goes up small and does not big: the size is what changes', () => {
    expect(liftCheckFor({ massKg: 40, size: [0.3, 0.3, 0.3] }).verdict).toBe('ok')
    expect(liftCheckFor({ massKg: 40, size: [2, 0.9, 0.9] }).verdict).toBe('too_bulky')
  })

  it('heavier than the strength is too heavy whatever its size; a thing wider than the arms is too bulky however light', () => {
    expect(liftCheckFor({ massKg: LIFT_DEFAULTS.maxKg + 1, size: [0.2, 0.2, 0.2] }).verdict).toBe('too_heavy')
    expect(liftCheckFor({ massKg: 8, size: [2.05, 1.6, 0.2] }).verdict).toBe('too_bulky')
  })

  it('a long light plank goes up: only the middle side has to fit between the arms', () => {
    expect(liftCheckFor({ massKg: 6, size: [2.4, 0.2, 0.03] }).verdict).toBe('ok')
  })

  it('the strength is the host\'s: a weaker person lifts less', () => {
    expect(liftCheckFor({ massKg: 20, size: [0.5, 0.5, 0.5] }, { maxKg: 30 }).verdict).toBe('too_bulky')
    expect(liftCheckFor({ massKg: 20, size: [0.5, 0.5, 0.5] }).verdict).toBe('ok')
  })
})
