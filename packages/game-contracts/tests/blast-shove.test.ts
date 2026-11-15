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

  it('a light thing behind cover is not thrown at the speed of one in the open, even when the open one is at the cap', () => {
    const open = at(3, 0.5)
    const covered = blastShove({ ...BLAST, reach: 0.19 }, { position: [3, 0.2, 0], mass: 0.5 })
    expect(open?.speed).toBeCloseTo(DEFAULT_BLAST_SHOVE.maxSpeed * (1 - dist(3) / 14) ** 2, 6)
    expect(covered?.speed).toBeCloseTo((open?.speed ?? 0) * Math.sqrt(0.19), 6)
  })

  it('pushes up when the body is at the centre', () => {
    expect(blastShove(BLAST, { position: [0, 0, 0], mass: 5 })?.direction).toEqual([0, 1, 0])
  })
})

describe('blastShove of a target that shows an area to the wave', () => {
  const grenade = { point: [0, 0, 0] as [number, number, number], energy: 200_000, radius: 14, tnt: 0.24 }
  const shovel = (area: number, mass = 2) => blastShove(grenade, { position: [0.8, 0, 0], mass, area })

  it('is pushed by the impulse of the wave (Kinney-Graham, reflected) over its area, divided by its mass: single digits for a 2 kg shovel at 0.8 m, not the cap', () => {
    const broadside = shovel(0.08)!
    // 67 Pa s side-on impulse at Z = 1.29 m/kg^(1/3), reflected 3.5 times, over 0.08 m2, per 2 kg
    expect(broadside.speed).toBeGreaterThan(8)
    expect(broadside.speed).toBeLessThan(11)
    expect(shovel(0.015)!.speed).toBeLessThan(2)
  })

  it('goes with the area and against the mass, and is capped by `maxSpeed` but does not depend on the coupling', () => {
    expect(shovel(0.16)!.speed).toBeCloseTo(2 * shovel(0.08)!.speed, 6)
    expect(shovel(0.08, 4)!.speed).toBeCloseTo(shovel(0.08)!.speed / 2, 6)
    expect(blastShove(grenade, { position: [0.8, 0, 0], mass: 2, area: 0.08 }, { coupling: 0.5 })!.speed).toBeCloseTo(shovel(0.08)!.speed, 6)
    expect(blastShove(grenade, { position: [0.8, 0, 0], mass: 2, area: 0.08 }, { maxSpeed: 3 })!.speed).toBe(3)
  })
})
