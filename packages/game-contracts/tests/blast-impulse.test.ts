import { describe, expect, it } from 'vitest'
import { bodyImpulse, blastBodySpeed, knockOf, sideOnImpulse, sideOnOverpressure, KNOCK_DOWN_SPEED } from '../src'

const feet = (x: number) => [x, 0, 0] as [number, number, number]
const at = (tnt: number, lethalRadius: number, radius: number) => ({ point: [0, 0.1, 0] as [number, number, number], energy: 0, radius, tnt, lethalRadius })

describe('the blast wave on a body', () => {
  it('reads the side-on impulse of Kinney and Graham: about 40 Pa·s per kg^(1/3) at a scaled distance of 5', () => {
    // 1 kg of TNT at 5 m
    expect(sideOnImpulse(1, 5)).toBeGreaterThan(35)
    expect(sideOnImpulse(1, 5)).toBeLessThan(45)
    expect(bodyImpulse(1, 5)).toBeGreaterThan(sideOnImpulse(1, 5) * 2)
    expect(sideOnImpulse(0, 5)).toBe(0)
  })

  it('a hand grenade at 3 m barely moves a person: what floors them is the lethal zone (fragments), where they stand', () => {
    expect(blastBodySpeed(0.24, 3, 70)).toBeLessThan(0.6)
    const k = knockOf(at(0.24, 5, 15), feet(3), 70)!
    expect(k.down).toBe(true)
    expect(k.wounded).toBe(true)
    expect(Math.hypot(k.velocity[0], k.velocity[2])).toBeLessThan(0.6)
    expect(k.stunSeconds).toBeGreaterThan(1)
  })

  it('out of the lethal zone a grenade stuns, and far away does nothing', () => {
    const mid = knockOf(at(0.24, 5, 15), feet(8), 70)!
    expect(mid.down).toBe(false)
    expect(mid.wounded).toBeUndefined()
    expect(knockOf(at(0.24, 5, 15), feet(14.5), 70)).toBeUndefined()
  })

  it('behind cover the fragments stop: no wounds, and the wave is cut too', () => {
    expect(knockOf({ ...at(0.24, 5, 15), reach: 0.2 }, feet(3), 70)).toBeUndefined()
  })

  it('a big charge close throws: a C4 block at 1 m knocks down and pushes, a fuel station tank throws from 6 m', () => {
    expect(blastBodySpeed(0.76, 1, 70)).toBeGreaterThan(KNOCK_DOWN_SPEED)
    expect(blastBodySpeed(20, 6, 70)).toBeGreaterThan(4)
    expect(blastBodySpeed(0.76, 4, 70)).toBeLessThan(1.5)
  })

  it('a blast with no charge takes one from its energy at the arsenal scale', () => {
    const fromEnergy = knockOf({ point: [0, 0.1, 0], energy: 200000, radius: 15 }, feet(3), 70)
    const fromTnt = knockOf(at(0.24, 0, 15), feet(3), 70)
    expect(fromEnergy?.velocity[0]).toBeCloseTo(fromTnt!.velocity[0], 6)
  })
})

describe('sideOnOverpressure', () => {
  it('reads the Kinney and Graham fit: about 45 to 55 kPa at 4 m from a kilogram of TNT, falling with distance, and the same at the same scaled distance', () => {
    expect(sideOnOverpressure(1, 4) / 1000).toBeGreaterThan(40)
    expect(sideOnOverpressure(1, 4) / 1000).toBeLessThan(60)
    expect(sideOnOverpressure(1, 2)).toBeGreaterThan(sideOnOverpressure(1, 4))
    expect(sideOnOverpressure(8, 8)).toBeCloseTo(sideOnOverpressure(1, 4), 6)
    expect(sideOnOverpressure(0, 4)).toBe(0)
  })
})
