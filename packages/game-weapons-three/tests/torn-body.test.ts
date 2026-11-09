import { describe, expect, it } from 'vitest'
import { boxesCentre, tornBodyShift } from '../src/test-area/torn-body'
import type { DrawnBox, PartPlace } from '../src/test-area/torn-body'

/** A box of `size` m with its middle at (x, y, z). */
const box = (x: number, y: number, z: number, size = 0.1): DrawnBox => [x - size / 2, y - size / 2, z - size / 2, x + size / 2, y + size / 2, z + size / 2]
const place = (mass: number, ...boxes: DrawnBox[]): PartPlace => ({ mass, boxes })

/** A camp table: an 8 kg top over four 1 kg legs, its middle at the origin. */
const table = (): Map<string, PartPlace> =>
  new Map([
    ['top', place(8, box(0, 0.7, 0, 0.8))],
    ['leg_1', place(1, box(-0.35, 0.35, -0.35))],
    ['leg_2', place(1, box(0.35, 0.35, -0.35))],
    ['leg_3', place(1, box(-0.35, 0.35, 0.35))],
    ['leg_4', place(1, box(0.35, 0.35, 0.35))],
  ])

describe('boxesCentre', () => {
  it('is the middle of the box that holds every drawn box, and nothing when none is drawn', () => {
    const centre = boxesCentre([box(0, 0, 0), box(1, 2, 3)])!
    ;[0.5, 1, 1.5].forEach((value, axis) => expect(centre[axis]).toBeCloseTo(value, 9))
    expect(boxesCentre([])).toBeUndefined()
  })
})

describe('tornBodyShift', () => {
  it('a torn table whose root (a leg) barely moved while the top and the other legs flew is measured by where its mass went', () => {
    const before = table()
    const after = new Map([
      // the piece that kept the table's id: one leg, nudged 2 cm
      ['leg_1', place(1, box(-0.33, 0.35, -0.35))],
      ['top', place(8, box(1, 0.3, 0, 0.8))],
      ['leg_2', place(1, box(1.6, 0.05, -0.35))],
      ['leg_3', place(1, box(0.9, 0.05, 0.6))],
      ['leg_4', place(1, box(1.5, 0.05, 0.5))],
    ])
    const shift = tornBodyShift(before, after)!
    expect(shift).toBeGreaterThan(0.15)
    // the mass-weighted middle went about a metre along x
    expect(shift).toBeCloseTo((8 * 1 + 0.02 + 1.25 + 1.25 + 1.15) / 12, 2)
  })

  it('a body that moved whole is measured by how far it went, on the ground plane', () => {
    const before = table()
    const after = new Map([...before].map(([key, part]) => [key, place(part.mass, ...part.boxes.map((b): DrawnBox => [b[0] + 0.12, b[1] - 0.3, b[2] + 0.16, b[3] + 0.12, b[4] - 0.3, b[5] + 0.16]))]))
    expect(tornBodyShift(before, after)).toBeCloseTo(0.2, 6)
  })

  it('a body that did not move is measured as not moved, and a part no longer drawn counts in neither reading', () => {
    const before = table()
    const after = new Map(before)
    after.set('top', place(8))
    expect(tornBodyShift(before, after)).toBeCloseTo(0, 9)
    expect(tornBodyShift(before, new Map())).toBeUndefined()
  })
})
