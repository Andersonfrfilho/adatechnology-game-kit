import { describe, expect, it } from 'vitest'

import { blastShove, DEFAULT_BLAST_SHOVE } from '../src'

const BLAST = { point: [0, 0, 0] as [number, number, number], energy: 200_000, radius: 14 }
const dist = (x: number): number => Math.hypot(x, 0.2)
const at = (x: number, mass: number, options = {}) => blastShove(BLAST, { position: [x, 0.2, 0], mass }, options)

describe('blastShove', () => {
  it('pushes away from the centre and falls off with (1 - d/r)^2', () => {
    const near = at(2, 1)
    const far = at(8, 1)
    expect(near?.direction[0]).toBeGreaterThan(0.9)
    expect(near?.direction[1]).toBeGreaterThan(0)
    expect(near?.falloff).toBeCloseTo((1 - dist(2) / 14) ** 2, 6)
    expect(far?.speed).toBeLessThan(near?.speed ?? 0)
    expect(far?.falloff).toBeCloseTo((1 - dist(8) / 14) ** 2, 6)
  })

  it('throws a light body faster than a heavy one, up to the maximum speed', () => {
    expect(at(3, 1)?.speed).toBeCloseTo(DEFAULT_BLAST_SHOVE.maxSpeed * (1 - dist(3) / 14) ** 2, 1)
    expect(at(3, 80)?.speed).toBeLessThan(at(3, 5)?.speed ?? 0)
  })

  it('leaves what is outside the radius, or too slow to matter, where it is', () => {
    expect(at(15, 1)).toBeUndefined()
    expect(at(13.5, 1)).toBeUndefined()
    expect(blastShove({ ...BLAST, energy: 100 }, { position: [4, 0, 0], mass: 80 })).toBeUndefined()
  })

  it('takes every number from the options and the shelter from reach', () => {
    expect(at(3, 1, { maxSpeed: 5 })?.speed).toBeCloseTo(5 * (1 - dist(3) / 14) ** 2, 6)
    expect(at(3, 1, { falloffPower: 1 })?.falloff).toBeCloseTo(1 - dist(3) / 14, 6)
    expect(at(3, 1, { lift: 0 })?.direction[1]).toBeCloseTo(0.2 / Math.hypot(3, 0.2), 6)
    expect(blastShove({ ...BLAST, reach: 0.25 }, { position: [3, 0.2, 0], mass: 80 })?.speed).toBeLessThan(at(3, 80)?.speed ?? 0)
  })

  it('pushes up when the body is at the centre', () => {
    expect(blastShove(BLAST, { position: [0, 0, 0], mass: 5 })?.direction).toEqual([0, 1, 0])
  })
})
