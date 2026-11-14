import { describe, expect, it } from 'vitest'

import { EnergyRuler, energyHeightOf, islandsOf } from './energy-ruler'
import type { EnergySample } from './energy-ruler'

const GRAVITY = 9.81

// a piece of mass `mass` at (x, y, 0), `energyHeight` given directly so every expected number below is computed by hand
const sample = (id: string, patch: Partial<EnergySample> & { x?: number; y?: number } = {}): EnergySample => {
  const { x = 0, y = 1, ...rest } = patch
  return { id, mass: 1, centre: [x, y, 0], radius: 0.1, energyHeight: y, velocityY: 0, speed: 0, spin: 0, sleeping: false, ...rest }
}

describe('energyHeightOf', () => {
  it('is the height plus v^2 / 2g for a body that does not spin', () => {
    const height = energyHeightOf({ centreY: 2, velocity: [3, 4, 0], bodyAngularVelocity: [0, 0, 0], halfExtents: [1, 1, 1] })
    expect(height).toBeCloseTo(2 + 25 / (2 * GRAVITY), 12)
  })

  it('adds the box inertia for the spin: w = 3 about x on a 2x2x2 box is (1+1)*9/3 / 2g', () => {
    const height = energyHeightOf({ centreY: 0, velocity: [0, 0, 0], bodyAngularVelocity: [3, 0, 0], halfExtents: [1, 1, 1] })
    expect(height).toBeCloseTo(6 / (2 * GRAVITY), 12)
  })
})

describe('islandsOf', () => {
  it('joins pieces whose spheres touch before or after the update, and leaves distant ones apart', () => {
    const before = [sample('a', { x: 0 }), sample('b', { x: 0.15 }), sample('c', { x: 5 }), sample('d', { x: 9 })]
    const after = [sample('a', { x: 0 }), sample('b', { x: 0.15 }), sample('c', { x: 5 }), sample('d', { x: 5.15 })]
    const islands = islandsOf(before, after)
    expect(islands[0]).toBe(islands[1])
    expect(islands[2]).toBe(islands[3])
    expect(islands[0]).not.toBe(islands[2])
  })
})

describe('C1 per island', () => {
  it('flags an island whose summed energy rises past m * 1 mm and not one whose energy falls', () => {
    const ruler = new EnergyRuler()
    // island 1 (x 0): +0.01 m on a 1 kg piece and -0.01 on its neighbour of 1 kg: a transfer, sum 0, passes. island 2 (x 5): 2 kg rising 0.01 m = +0.02, allowance 2 * 0.001
    const before = [sample('a', { x: 0, y: 1 }), sample('b', { x: 0.15, y: 1 }), sample('c', { x: 5, y: 1, mass: 2 })]
    const after = [sample('a', { x: 0, y: 1.01 }), sample('b', { x: 0.15, y: 0.99 }), sample('c', { x: 5, y: 1.01, mass: 2 })]
    ruler.step(before, after, 1 / 60)
    const result = ruler.result()
    expect(result.c1Violations).toBe(1)
    expect(result.c1Excess).toBeCloseTo(0.02 - 0.002, 12)
  })

  it('does not flag a falling island: the worst excess is negative', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('a', { y: 1 })], [sample('a', { y: 0.9 })], 1 / 60)
    const result = ruler.result()
    expect(result.c1Violations).toBe(0)
    expect(result.c1Excess).toBeCloseTo(-0.1 - 0.001, 12)
  })

  it('leaves an update with outside energy alone', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('a', { y: 1 })], [sample('a', { y: 2 })], 1 / 60, 'energy')
    expect(ruler.result().c1Violations).toBe(0)
  })
})

describe('C2 with the condition of C1', () => {
  it('counts a gain above the last rest as a launch only if the island also broke C1', () => {
    const ruler = new EnergyRuler()
    const resting = sample('a', { y: 1, energyHeight: 1 })
    // two pieces in one island: a gains 0.1 and b loses 0.1 (paid for): C1 sum 0, no violation
    ruler.step([resting, sample('b', { x: 0.15, y: 1 })], [sample('a', { y: 1.1, energyHeight: 1.1, speed: 1 }), sample('b', { x: 0.15, y: 0.9 })], 1 / 60)
    expect(ruler.result().c2GainUnconditioned).toBeCloseTo(0.1, 12)
    expect(ruler.result().c2Gain).toBe(0)
    // the next update the island is not paid for: a gains 0.05 more, b the same
    ruler.step([sample('a', { y: 1.1, energyHeight: 1.1, speed: 1 }), sample('b', { x: 0.15, y: 0.9, speed: 1 })], [sample('a', { y: 1.15, energyHeight: 1.15, speed: 1 }), sample('b', { x: 0.15, y: 0.95, speed: 1 })], 1 / 60)
    expect(ruler.result().c2GainUnconditioned).toBeCloseTo(0.15, 12)
    expect(ruler.result().c2Gain).toBeCloseTo(0.15, 12)
  })

  it('does not count the gain an outside input gave, and measures only what comes after it', () => {
    const ruler = new EnergyRuler()
    const resting = sample('a', { y: 1, energyHeight: 1 })
    // a blast lifts a from 1 to 3 (outside energy: absorbed)
    ruler.step([resting], [sample('a', { y: 3, energyHeight: 3, speed: 9 })], 1 / 60, 'energy')
    expect(ruler.result().c2GainUnconditioned).toBe(0)
    // then it gains 0.02 on its own and the island breaks C1 by 0.02 - 0.001: that gain counts, the 2 m the blast gave does not
    ruler.step([sample('a', { y: 3, energyHeight: 3, speed: 9 })], [sample('a', { y: 3.02, energyHeight: 3.02, speed: 9 })], 1 / 60)
    expect(ruler.result().c2GainUnconditioned).toBeCloseTo(0.02, 12)
    expect(ruler.result().c2Gain).toBeCloseTo(0.02, 12)
  })

  it('starts a new episode from the energy of the piece at rest', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('a', { y: 1 })], [sample('a', { y: 1.2, energyHeight: 1.2, speed: 2 })], 1 / 60)
    // back at rest 0.5 lower: the new base is 0.5, so 0.01 above it is a 0.01 gain, not -0.69 and not 0.2
    ruler.step([sample('a', { y: 0.5, energyHeight: 0.5 })], [sample('a', { y: 0.51, energyHeight: 0.51, speed: 0.2 })], 1 / 60)
    expect(ruler.result().c2GainUnconditioned).toBeCloseTo(0.2, 12)
    expect(ruler.result().c2Gain).toBeCloseTo(0.2, 12)
  })
})

describe('C3 and C3b', () => {
  it('sums the centre rise beyond the upward speed of the piece, per piece, and skips outside energy', () => {
    const ruler = new EnergyRuler()
    // rises 0.03 with vy 0.6 over 0.05 s: 0.03 free, so a rise of 0 from its own speed
    ruler.step([sample('a', { y: 1, velocityY: 0.6 })], [sample('a', { y: 1.03 })], 0.05)
    expect(ruler.result().c3Lift).toBeCloseTo(0, 12)
    // rises 0.02 from rest: 0.02 of lift, twice: 0.04 in total
    ruler.step([sample('a', { y: 1.03 })], [sample('a', { y: 1.05 })], 0.05)
    ruler.step([sample('a', { y: 1.05 })], [sample('a', { y: 1.07 })], 0.05)
    expect(ruler.result().c3Lift).toBeCloseTo(0.04, 12)
    ruler.step([sample('a', { y: 1.07 })], [sample('a', { y: 4 })], 0.05, 'energy')
    expect(ruler.result().c3Lift).toBeCloseTo(0.04, 12)
  })

  it('reports the deepest a centre was under the ground, and the net count', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('a')], [sample('a', { y: 0.2, groundY: 0 })], 1 / 60)
    ruler.step([sample('a')], [sample('a', { y: -0.03, groundY: 0 })], 1 / 60)
    ruler.recordFellThrough(1)
    const result = ruler.result()
    expect(result.deepest).toBeCloseTo(0.03, 12)
    expect(result.fellThrough).toBe(1)
  })
})

describe('C4 from the last outside input', () => {
  it('counts the time from the last input until everything slept, and restarts if it wakes again', () => {
    const ruler = new EnergyRuler()
    const awake = [sample('a')]
    const asleep = [sample('a', { sleeping: true })]
    ruler.step(awake, awake, 1, 'energy')
    ruler.step(awake, awake, 1)
    ruler.step(awake, asleep, 1)
    expect(ruler.result().c4AsleepAfter).toBe(2)
    ruler.step(asleep, asleep, 1, 'wake')
    expect(ruler.result().c4AsleepAfter).toBe(-1)
    ruler.step(asleep, asleep, 1)
    expect(ruler.result().c4AsleepAfter).toBe(1)
  })

  it('is -1 while something is awake', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('a'), sample('b')], [sample('a', { sleeping: true }), sample('b')], 1)
    expect(ruler.result().c4AsleepAfter).toBe(-1)
  })
})

describe('pieces over the C2 limit', () => {
  it('counts per piece, with and without the C1 condition', () => {
    const ruler = new EnergyRuler()
    // a gains 0.05 alone (island broke C1 by 0.049: a launch); b, far away, gains 0.04 paid for by c, its neighbour (sum 0: not a launch)
    const before = [sample('a', { x: 0 }), sample('b', { x: 5 }), sample('c', { x: 5.15, y: 1.04 })]
    const after = [sample('a', { x: 0, y: 1.05, energyHeight: 1.05, speed: 1 }), sample('b', { x: 5, y: 1.04, energyHeight: 1.04, speed: 1 }), sample('c', { x: 5.15, y: 1, energyHeight: 1, speed: 1 })]
    ruler.step(before, after, 1 / 60)
    const result = ruler.result()
    expect(result.c2PiecesOverUnconditioned).toBe(2)
    expect(result.c2PiecesOver).toBe(1)
  })
})
