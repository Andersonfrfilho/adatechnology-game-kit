import { describe, expect, it } from 'vitest'

import { GAIT_PHASES, birdSize, createAnimals, lineUpLength, quadrupedLayout, visualStateOf } from '../src'
import type { AnimalSpecies, QuadrupedSpec } from '../src'

const dog: QuadrupedSpec = {
  kind: 'quadruped',
  L: 0.62,
  R: 0.12,
  sx: 0.95,
  sy: 1.05,
  span: 0.72,
  prof: [0.45, 0.85, 0.95, 0.9, 0.88, 1, 1.05, 0.9, 0.55],
  c: { main: 0xb07a3e, belly: 0xd8b07a, dark: 0x2a1c12, nose: 0x161010 },
  leg: { fu: 0.21, fl: 0.22, hu: 0.22, hl: 0.24, r: 0.04 },
  neck: { len: 0.12, r: 0.07, r2: 0.06, ang: 0.95 },
  head: { r: 0.085, s: [1, 0.95, 1.08], sl: 0.11, sr1: 0.05, sr2: 0.04, down: 0.15, sy: -0.15 },
  ears: { t: 'cone', s: 0.06, tilt: 0.35, fwd: 0.3 },
  tail: { n: 3, len: 0.26, r: 0.02, ang: 2.1, curl: -0.25 },
}

const pack = (id: string, order: number): AnimalSpecies => ({
  id,
  order,
  name: { en: id, 'pt-BR': id },
  scientificName: id,
  group: 'domestic',
  phase: 'mvp',
  outcome: 'turns',
  body: dog,
  walkHz: 1,
  runHz: 2,
})

describe('layout', () => {
  it('stands a dog on legs of 0.21 + 0.22 (front) and 0.22 + 0.24 (hind) the way the page does', () => {
    const layout = quadrupedLayout(dog)
    expect(layout.frontHipHeight).toBeCloseTo(0.4576, 3)
    expect(layout.hindHipHeight).toBeCloseTo(0.4688, 3)
    expect(layout.bodyHeight).toBeCloseTo(0.4632, 3)
    expect(layout.span).toBeCloseTo(0.4464, 4)
    expect(layout.size).toBeCloseTo(0.62, 4)
  })

  it('raises a body with `up` and gives a hoof its own foot height', () => {
    const cow = quadrupedLayout({ ...dog, R: 0.37, up: 0.15, leg: { ...dog.leg, r: 0.075, hoof: 1 } })
    expect(cow.footHeight).toBeCloseTo(0.0825, 4)
    expect(cow.bodyHeight).toBeGreaterThan(0.4632)
  })

  it('sizes birds and spaces the line-up', () => {
    expect(birdSize({ kind: 'bird', r: 0.12, tars: 0.1, shank: 0.09 } as never)).toBeCloseTo(0.421, 4)
    expect(lineUpLength(dog)).toBeCloseTo(0.806, 3)
    expect(lineUpLength({ kind: 'snake' })).toBe(0.9)
  })
})

describe('gaits', () => {
  it('has the three phase tables of the page', () => {
    const expectPhases = (actual: readonly number[], expected: readonly number[]): void => expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 6))
    expectPhases(GAIT_PHASES.walk, [Math.PI / 2, (3 * Math.PI) / 2, 0, Math.PI])
    expectPhases(GAIT_PHASES.trot, [0, Math.PI, Math.PI, 0])
    expect(GAIT_PHASES.gallop[0]).toBeCloseTo(Math.PI * 0.92, 6)
    expect(GAIT_PHASES.gallop[3]).toBeCloseTo(Math.PI * 0.28, 6)
  })
})

describe('visual state', () => {
  it('shows infected for a species that turns, dead for one that dies, nothing for an immune one', () => {
    expect(visualStateOf('turns', true)).toBe('infected')
    expect(visualStateOf('dies', true)).toBe('dead')
    expect(visualStateOf('immune', true)).toBe('alive')
    expect(visualStateOf('turns', false)).toBe('alive')
  })

  it('shows the dead look for any species when forced', () => {
    for (const outcome of ['turns', 'dies', 'immune'] as const) expect(visualStateOf(outcome, false, true)).toBe('dead')
  })
})

describe('registry', () => {
  it('merges packs by id, patches, removes and keeps the production order', () => {
    const kit = createAnimals({
      packs: [{ id: 'one', species: [pack('b', 1), pack('a', 0)] }, { id: 'two', species: [pack('b', 2), pack('c', 3)] }],
      patch: { a: { walkHz: 9 }, missing: { walkHz: 1 } },
      remove: ['c'],
    })
    expect(kit.species.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(kit.get('a')?.walkHz).toBe(9)
    expect(kit.get('b')?.order).toBe(2)
    expect(kit.get('missing')).toBeUndefined()
  })

  it('lets a game replace a gait table', () => {
    expect(createAnimals({ gaits: { walk: [0, 0, 0, 0] } }).gait('walk')).toEqual([0, 0, 0, 0])
    expect(createAnimals().gait('trot')).toEqual(GAIT_PHASES.trot)
  })
})
