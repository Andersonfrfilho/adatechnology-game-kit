import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent, DestructionOptions, PartSpec } from '../src'

/** A plastered brick wall as the houses' assembly gives it: units of 23 x 7.5 cm, a breach, the plaster coat. */
const wall: PartSpec = {
  id: 'wall', material: 'brick', shape: { kind: 'box', size: [4, 2.4, 0.13] }, position: [0, 1.2, 0], thickness: 0.13, mass: 1800,
  units: { size: [0.23, 0.075, 0.11], bond: 'running', mortar: 'plaster' }, breach: { area: 0.25 }, layers: [{ material: 'plaster', thickness: 0.02, faces: 'both' }],
}

const setup = (options: DestructionOptions = {}) => {
  const world = createDestruction({ seed: 1, ...options })
  world.add({ parts: [wall] }, { id: 'w' })
  const chips: Array<Extract<DestructionEvent, { type: 'chip' }>> = []
  world.on('chip', (e) => chips.push(e as Extract<DestructionEvent, { type: 'chip' }>))
  // a 9 mm round: about 500 J, it stops in the brick
  const pistol = (y = 1.2) => world.shoot([0.05, y, 5], [0, 0, -1], 500, 9, 'test')
  return { world, chips, pistol }
}

describe('chipping a wall of units', () => {
  it('a few pistol rounds on the same brick knock it out; the wall stays', () => {
    const { world, chips, pistol } = setup()
    pistol()
    expect(chips).toHaveLength(0)
    for (let i = 0; i < 4; i++) pistol()
    expect(chips.length).toBeGreaterThanOrEqual(1)
    const chip = chips[0]!
    expect(chip.part).toBe('wall')
    expect(chip.fragments).toHaveLength(1)
    expect(chip.size[0]).toBeCloseTo(0.23, 2)
    const part = world.part('w', 'wall')!
    expect(part.status).not.toBe('broken')
    expect(part.chipped?.length).toBe(chips.length)
    expect(part.mass).toBeLessThan(1800)
  })

  it('a round through the gap passes', () => {
    const { pistol, chips } = setup()
    for (let i = 0; i < 5; i++) pistol()
    expect(chips.length).toBeGreaterThanOrEqual(1)
    const after = pistol()
    expect(after.every((r) => r.part === undefined || r.penetrated)).toBe(true)
  })

  it('rounds spread over the wall wear many bricks and knock out none', () => {
    const { chips, world } = setup()
    for (let i = 0; i < 10; i++) world.shoot([-1.5 + i * 0.3, 0.3 + (i % 5) * 0.4, 5], [0, 0, -1], 500, 9, 'test')
    expect(chips).toHaveLength(0)
  })

  it('chipEnergy 0 turns it off; the state saves and loads', () => {
    const off = setup({ breach: { chipEnergy: 0 } })
    for (let i = 0; i < 8; i++) off.pistol()
    expect(off.chips).toHaveLength(0)
    const on = setup()
    for (let i = 0; i < 5; i++) on.pistol()
    const saved = on.world.serialize()
    const again = createDestruction({ seed: 1 })
    again.load(saved)
    expect(again.part('w', 'wall')!.chipped).toEqual(on.world.part('w', 'wall')!.chipped)
  })

  it('world.reset puts the bricks back', () => {
    const { world, pistol } = setup()
    for (let i = 0; i < 5; i++) pistol()
    world.reset('w')
    expect(world.part('w', 'wall')!.chipped ?? []).toHaveLength(0)
  })
})
