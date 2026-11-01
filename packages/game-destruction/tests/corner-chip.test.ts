import { describe, expect, it } from 'vitest'

import { createDestruction } from '../src'
import type { DestructionEvent, PartSpec } from '../src'

/** A plastered brick wall as the houses' assembly gives it, two metres long and 2.4 high, its end at x = 1 and its top at y = 2.4. */
const wall: PartSpec = {
  id: 'wall', material: 'brick', shape: { kind: 'box', size: [2, 2.4, 0.13] }, position: [0, 1.2, 0], thickness: 0.13, mass: 900,
  units: { size: [0.23, 0.075, 0.11], bond: 'running', mortar: 'plaster' }, breach: { area: 0.25 }, layers: [{ material: 'plaster', thickness: 0.02, faces: 'both' }],
}
const END = 1
const TOP = 2.4
/** The course from y = 1.2 to 1.275 lays its units from x = -1 every 23 cm: the last one is cut to the wall, [0.84, 1]. */
const Y = 1.2375
const LAST = 0.84
type Chip = Extract<DestructionEvent, { type: 'chip' }>

const setup = () => {
  const world = createDestruction({ seed: 1 })
  world.add({ parts: [wall] }, { id: 'w' })
  const chips: Chip[] = []
  world.on('chip', (e) => chips.push(e as Chip))
  const rifle = (x: number, y = Y) => world.shoot([x, y, 5], [0, 0, -1], 2100, 7.62, 'test')
  const pistol = (x: number, y = Y) => world.shoot([x, y, 5], [0, 0, -1], 500, 9, 'test')
  return { chips, rifle, pistol }
}

const box = (c: Chip) => ({ x0: c.center[0] - c.size[0] / 2, x1: c.center[0] + c.size[0] / 2, y0: c.center[1] - c.size[1] / 2, y1: c.center[1] + c.size[1] / 2 })
/** The piece taken where a round landed at (x, y) (a unit next to it may only crater). */
const at = (chips: Chip[], x: number, y = Y) => chips.find((c) => { const b = box(c); return b.x0 < x && b.x1 > x && b.y0 < y && b.y1 > y })

describe('a shot near the end of a wall of units', () => {
  it('a rifle round 10 cm from the end tears the corner off out to the end, and takes the unit', () => {
    const { chips, rifle } = setup()
    for (let i = 0; i < 3 && !at(chips, END - 0.1); i++) rifle(END - 0.1)
    const piece = at(chips, END - 0.1)
    expect(piece).toBeDefined()
    // out to the end of the wall, not a crater 8 cm across inside the unit; that takes most of its face, so the whole unit comes out
    expect(box(piece!).x1).toBeCloseTo(END, 6)
    expect(box(piece!).x0).toBeCloseTo(LAST, 6)
  })

  it('a 9 mm round there, with a quarter of the energy, only breaks a crater', () => {
    const { chips, pistol } = setup()
    for (let i = 0; i < 8 && !at(chips, END - 0.1); i++) pistol(END - 0.1)
    const piece = at(chips, END - 0.1)
    expect(piece).toBeDefined()
    expect(box(piece!).x1).toBeLessThan(END - 0.02)
  })

  it('the edge a torn corner leaves tears off in turn', () => {
    const { chips, rifle } = setup()
    for (let i = 0; i < 3 && !at(chips, END - 0.1); i++) rifle(END - 0.1)
    expect(box(at(chips, END - 0.1)!).x0).toBeCloseTo(LAST, 6)
    // the new end of the course is the side of the unit next to it: a round 10 cm from it tears that corner off out to it
    for (let i = 0; i < 3 && !at(chips, LAST - 0.1); i++) rifle(LAST - 0.1)
    const next = at(chips, LAST - 0.1)
    expect(next).toBeDefined()
    expect(box(next!).x1).toBeCloseTo(LAST, 6)
  })

  it('nothing a shot at the top corner takes is outside the wall', () => {
    const { chips, rifle } = setup()
    for (let i = 0; i < 4; i++) rifle(END - 0.02, TOP - 0.02)
    expect(chips.length).toBeGreaterThanOrEqual(1)
    for (const c of chips) {
      const b = box(c)
      expect(b.x1).toBeLessThanOrEqual(END + 1e-9)
      expect(b.y1).toBeLessThanOrEqual(TOP + 1e-9)
    }
  })

  it('in the middle of the wall a round still breaks a crater a few centimetres across', () => {
    const { chips, rifle } = setup()
    for (let i = 0; i < 3 && chips.length === 0; i++) rifle(0.05)
    expect(chips.length).toBeGreaterThanOrEqual(1)
    expect(chips[0]!.size[0]).toBeLessThan(0.15)
  })
})
