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

describe('energyHeightOf with the engine\'s own inertia tensor', () => {
  it('uses the tensor given: w = 3 about x with Ixx = 12 kg m^2 on a 2 kg body is 12 * 9 / 2 / 2g, not the box\'s', () => {
    const height = energyHeightOf({ centreY: 0, velocity: [0, 0, 0], bodyAngularVelocity: [3, 0, 0], halfExtents: [1, 1, 1], mass: 2, inertia: [12, 12, 12, 0, 0, 0] })
    expect(height).toBeCloseTo(54 / (2 * GRAVITY), 12)
  })

  it('counts the products of inertia: w = (1, 1, 0) with Ixx = Iyy = 2 and Ixy = -1 on a 1 kg body is (2 + 2 - 2) / 2g', () => {
    const height = energyHeightOf({ centreY: 0, velocity: [0, 0, 0], bodyAngularVelocity: [1, 1, 0], halfExtents: [1, 1, 1], mass: 1, inertia: [2, 2, 2, -1, 0, 0] })
    expect(height).toBeCloseTo(2 / (2 * GRAVITY), 12)
  })

  it('left out, it is the box\'s: the same 2 kg body without a tensor', () => {
    const height = energyHeightOf({ centreY: 0, velocity: [0, 0, 0], bodyAngularVelocity: [3, 0, 0], halfExtents: [1, 1, 1], mass: 2 })
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

describe('islandsOf with the engine\'s contact graph (T3.8b)', () => {
  it('joins by a chain of contacts, not by bounding spheres: near pieces that never touched are apart, and ids the engine gave that are no piece (the ground, a fixed wall) join nothing', () => {
    const near = [sample('a', { x: 0, radius: 5 }), sample('b', { x: 1, radius: 5 }), sample('c', { x: 2, radius: 5 }), sample('d', { x: 3, radius: 5 })]
    const islands = islandsOf(near, near, [['a', 'b'], ['b', 'c'], ['wall', 'd'], ['wall', 'a']])
    expect(islands[0]).toBe(islands[1])
    expect(islands[1]).toBe(islands[2])
    expect(islands[3]).not.toBe(islands[0])
  })

  it('a contact that was added and gone inside the update still joins its two pieces: the pair is in the graph', () => {
    const pieces = [sample('a', { x: 0 }), sample('b', { x: 40 })]
    const islands = islandsOf(pieces, pieces, [['a', 'b']])
    expect(islands[0]).toBe(islands[1])
  })

  it('with no graph the old rule stands: spheres that overlap are one island', () => {
    const pieces = [sample('a', { x: 0, radius: 5 }), sample('b', { x: 1, radius: 5 })]
    const islands = islandsOf(pieces, pieces)
    expect(islands[0]).toBe(islands[1])
  })
})

describe('a transfer between two touching pieces is not a launch (T3.8b)', () => {
  // an 18 kg piece at rest is hit by a 36 kg piece: it gains 4.3 m of energy height, the 36 kg piece pays 2.15 m (18 * 4.3 = 36 * 2.15); a 50 kg pile, near by, creeps up 1 cm
  const step = (touching: readonly (readonly [string, string])[] | undefined): ReturnType<EnergyRuler['result']> => {
    const before = [sample('small', { mass: 18, x: 0, radius: 6 }), sample('big', { mass: 36, x: 1, radius: 6, energyHeight: 6, speed: 7.5, y: 1 }), sample('pile', { mass: 50, x: 2, radius: 6, speed: 0.01 })]
    const after = [sample('small', { mass: 18, x: 0, radius: 6, energyHeight: 1 + 4.3, speed: 8.3 }), sample('big', { mass: 36, x: 1, radius: 6, energyHeight: 6 - 2.15, speed: 5 }), sample('pile', { mass: 50, x: 2, radius: 6, energyHeight: 1.01 })]
    const ruler = new EnergyRuler()
    ruler.step(before, after, 0.05, 'none', { touching })
    return ruler.result()
  }

  it('with the contact graph the pair is its own island, the sum is 0, and nothing is a launch', () => {
    const result = step([['small', 'big']])
    expect(result.c2PiecesOver).toBe(0)
    expect(result.c1Violations).toBe(1)
    expect(result.c1Excess).toBeCloseTo(50 * 0.01 - 50 * 0.001, 9)
  })

  it('with bounding spheres everything is one island, the pile\'s centimetre breaks C1, and the transfer is counted as a launch of the 18 kg piece', () => {
    const result = step(undefined)
    expect(result.c2PiecesOver).toBe(1)
  })
})

describe('energy the host gave a piece from outside is taken out of its island, not the whole update (T3.8b)', () => {
  const pieces = (gain: number): [EnergySample[], EnergySample[]] => [
    [sample('a', { mass: 18, x: 0 }), sample('b', { mass: 2, x: 0.1 }), sample('far', { mass: 5, x: 50, sleeping: true })],
    [sample('a', { mass: 18, x: 0, energyHeight: 1 + 4 }), sample('b', { mass: 2, x: 0.1 }), sample('far', { mass: 5, x: 50, energyHeight: 1 + gain })],
  ]

  it('a gain of exactly what was given is no violation and no launch', () => {
    const [before, after] = pieces(0)
    const ruler = new EnergyRuler()
    ruler.step(before, after, 0.05, 'none', { touching: [['a', 'b']], given: new Map([['a', 4]]) })
    const result = ruler.result()
    expect(result.c1Violations).toBe(0)
    expect(result.c2PiecesOverUnconditioned).toBe(0)
    expect(result.c3Lift).toBe(0)
  })

  it('what the engine made on top of what was given still counts: 4 m of 4.1 given leaves 0.1 m on 18 kg', () => {
    const [before, after] = pieces(0)
    const ruler = new EnergyRuler()
    ruler.step(before, after, 0.05, 'none', { touching: [['a', 'b']], given: new Map([['a', 3.9]]) })
    const result = ruler.result()
    expect(result.c1Violations).toBe(1)
    expect(result.c1Excess).toBeCloseTo(18 * 0.1 - 20 * 0.001, 9)
    expect(result.c2PiecesOver).toBe(1)
  })

  it('the same gain with nothing given is a violation and a launch', () => {
    const [before, after] = pieces(0)
    const ruler = new EnergyRuler()
    ruler.step(before, after, 0.05, 'none', { touching: [['a', 'b']] })
    const result = ruler.result()
    expect(result.c1Violations).toBe(1)
    expect(result.c2PiecesOver).toBe(1)
  })

  it('a piece in another island that gains on its own is still counted in the same update', () => {
    const [before, after] = pieces(0.2)
    const ruler = new EnergyRuler()
    ruler.step(before, after, 0.05, 'none', { touching: [['a', 'b']], given: new Map([['a', 4]]) })
    const result = ruler.result()
    expect(result.c1Violations).toBe(1)
    expect(result.c2PiecesOver).toBe(1)
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

// the three rules the owner approved on 2026-11-15 (T3.8w). `legacy*` are the formulas the ruler used before, written out so each test shows the old ruler counted the case
describe('R1: C3 counts a rise only when the piece\'s energy also rose', () => {
  const legacyRise = (from: EnergySample, to: EnergySample, dt: number): number => Math.max(0, to.centre[1] - from.centre[1] - Math.max(0, from.velocityY) * dt)

  it('a 1 t pole turning flat climbs a ledge 5 cm while losing 85 kg m: the old rule counted 0.05 m, the new one 0', () => {
    // energy height 0.065 + 0.2 before, 0.115 + 0.05 after (it lost m * 0.085 m = 85 kg m); vy -0.04 before, +0.85 after
    const from = sample('pole', { mass: 1000, y: 0.065, energyHeight: 0.265, velocityY: -0.04, speed: 0.06, spin: 0.74 })
    const to = sample('pole', { mass: 1000, y: 0.115, energyHeight: 0.165, velocityY: 0.85, speed: 0.85, spin: 0.15 })
    expect(legacyRise(from, to, 0.05)).toBeCloseTo(0.05, 12)
    const ruler = new EnergyRuler()
    ruler.step([from], [to], 0.05)
    expect(ruler.result().c3Lift).toBe(0)
  })

  it('a real launch still fails: the same 5 cm rise with the energy height going up 0.2 m counts in full', () => {
    const from = sample('rock', { mass: 10, y: 0.065, energyHeight: 0.065 })
    const to = sample('rock', { mass: 10, y: 0.115, energyHeight: 0.265, velocityY: 2, speed: 2 })
    const ruler = new EnergyRuler()
    ruler.step([from], [to], 0.05)
    expect(ruler.result().c3Lift).toBeCloseTo(0.05, 12)
  })

  it('the rise is kept out only in the update where the spin paid for it: a later update that gains counts', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('a', { y: 1, energyHeight: 1.3, spin: 0.74 })], [sample('a', { y: 1.04, energyHeight: 1.1, spin: 0.15 })], 0.05)
    ruler.step([sample('a', { y: 1.04, energyHeight: 1.1, spin: 0.15 })], [sample('a', { y: 1.06, energyHeight: 1.12, spin: 0.15 })], 0.05)
    expect(ruler.result().c3Lift).toBeCloseTo(0.02, 12)
  })
})

describe('audit of #311: the three rules no longer let a real gain pass', () => {
  it('R3: a 1 t pole at rest lifted 2 cm by the position solver on waking is a C1 gain, with or without a first contact', () => {
    const still = (y: number): EnergySample => sample('pole', { mass: 1000, y, energyHeight: y })
    const ruler = new EnergyRuler()
    ruler.step([still(0.1)], [still(0.12)], 0.05, 'none', { firstContact: new Set(['pole']) })
    expect(ruler.result().c1Violations).toBe(1)
    expect(ruler.result().c1Excess).toBeGreaterThan(15)
  })

  it('R2: a rise of 0.5 m with a declared 1e-6 is still a rise of 0.5 m, not zero', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('pole', { mass: 1000, y: 1, energyHeight: 1 })], [sample('pole', { mass: 1000, y: 1.5, energyHeight: 1.5 })], 0.05, 'none', { given: new Map([['pole', 1e-6]]) })
    expect(ruler.result().c3Lift).toBeCloseTo(0.5, 5)
  })

  it('R1: a piece that lands at 3 m/s and is lifted 5 cm by the contact, losing energy and no spin, counts 5 cm', () => {
    const ruler = new EnergyRuler()
    ruler.step([sample('box', { mass: 5, y: 0.2, energyHeight: 0.66, velocityY: -3, speed: 3 })], [sample('box', { mass: 5, y: 0.25, energyHeight: 0.3, velocityY: 0.5, speed: 0.5 })], 0.05)
    expect(ruler.result().c3Lift).toBeCloseTo(0.05, 12)
  })
})

describe('R2: energy the kit declares is out of C3 as it is out of C1 and C2 (D6)', () => {
  it('a delayed blast shove that lifts a 0.6 kg pipe 2.5 cm is not C3; the engine\'s own rise in a later update still is', () => {
    const ruler = new EnergyRuler()
    // the shove: energy height +0.4 m, declared; the centre rises 0.025 (the pipe's own speed was 0)
    ruler.step([sample('pipe', { mass: 0.6, y: 1.35, energyHeight: 1.35 })], [sample('pipe', { mass: 0.6, y: 1.375, energyHeight: 1.75, velocityY: 3, speed: 3 })], 0.05, 'none', { given: new Map([['pipe', 0.4]]) })
    expect(ruler.result().c3Lift).toBe(0)
    ruler.step([sample('pipe', { mass: 0.6, y: 1.375, energyHeight: 1.75 })], [sample('pipe', { mass: 0.6, y: 1.395, energyHeight: 1.77 })], 0.05)
    expect(ruler.result().c3Lift).toBeCloseTo(0.02, 12)
  })
})

describe('R3: the continuous-collision pull-back at a first contact is not a C1 gain', () => {
  // a 1 t pole falling at ~6.3 m/s, 6 fixed steps of 1/120 s in a 0.05 s update. Free fall for 0.05 s: vy -6.14 -> -6.6305 and the centre moves 0.3193 m; with the pull-back it moves 0.3068 m, 12.5 mm less, and the speed is the free fall's
  const fall = (y: number, vy: number): EnergySample => sample('pole', { mass: 1000, y, velocityY: vy, speed: Math.abs(vy), energyHeight: energyHeightOf({ centreY: y, velocity: [0, vy, 0], bodyAngularVelocity: [0, 0, 0], halfExtents: [1, 1, 1] }) })
  const free = fall(0.7943, -6.14)
  const pulledBack = fall(0.7943 - 0.3068, -6.6305)
  const contact = { firstContact: new Set(['pole']) }

  it('the old ruler counted the 12.5 kg m the pole did not gain; at a first contact the new one counts none', () => {
    const old = new EnergyRuler()
    old.step([free], [pulledBack], 0.05)
    expect(old.result().c1Excess).toBeGreaterThan(10)
    expect(old.result().c1Violations).toBe(1)
    const ruler = new EnergyRuler()
    ruler.step([free], [pulledBack], 0.05, 'none', contact)
    expect(ruler.result().c1Violations).toBe(0)
    expect(ruler.result().c1Excess).toBeLessThanOrEqual(0)
  })

  it('narrow: the same numbers without a first contact in the update are still a violation', () => {
    const ruler = new EnergyRuler()
    ruler.step([free], [pulledBack], 0.05, 'none', { firstContact: new Set(['somebody else']) })
    expect(ruler.result().c1Violations).toBe(1)
  })

  it('narrow: only the pull-back counts out. A pole that also speeds up to 8 m/s at its first contact fails C1 with the 1 t m it gained, and a rock that gains height still fails C3', () => {
    const launched = fall(0.7943 - 0.3068, -8)
    const ruler = new EnergyRuler()
    ruler.step([free], [launched], 0.05, 'none', contact)
    const result = ruler.result()
    expect(result.c1Violations).toBe(1)
    expect(result.c1Excess).toBeGreaterThan(900)
    const lift = new EnergyRuler()
    lift.step([sample('rock', { mass: 10, y: 0.065, energyHeight: 0.065 })], [sample('rock', { mass: 10, y: 0.115, energyHeight: 0.265, velocityY: 2, speed: 2 })], 0.05, 'none', { firstContact: new Set(['rock']) })
    expect(lift.result().c3Lift).toBeCloseTo(0.05, 12)
  })
})
