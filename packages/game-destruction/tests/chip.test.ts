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

/** A bond beam of the houses: concrete with a cage of four bars and its concrete as 0.1 m blocks (`MEMBER_CAGE` of game-floorplan-structure). */
const beam: PartSpec = {
  id: 'beam', material: 'concrete', shape: { kind: 'box', size: [4, 0.2, 0.15] }, position: [0, 2.9, 0], mass: 276,
  reinforcement: { material: 'steel', spacing: 0.1, diameter: 0.008 }, units: { size: [0.1, 0.1, 0.15], bond: 'stack', mortar: 'concrete' },
}

const beamWorld = () => {
  const world = createDestruction({ seed: 3 })
  world.add({ parts: [beam] }, { id: 'b' })
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  const fire = (energy: number, caliber: number, n: number) => {
    for (let i = 0; i < n; i++) world.shoot([0.05, 2.95, 5], [0, 0, -1], energy, caliber, 'test')
  }
  const of = <T extends DestructionEvent['type']>(type: T) => events.filter((e) => e.type === type) as Array<Extract<DestructionEvent, { type: T }>>
  return { world, fire, of }
}

describe('concrete under fire: a material answers each kind of blow its own way', () => {
  it('9 mm rounds only crater it: dust and chips, no block comes out', () => {
    const b = beamWorld()
    b.fire(500, 9, 10)
    expect(b.of('spall').length).toBe(10)
    expect(b.of('spall').every((e) => e.layer === -1)).toBe(true)
    expect(b.of('chip')).toHaveLength(0)
    expect(b.of('expose')).toHaveLength(0)
  })

  it('a 7.62 round knocks the block it hits out and the bars inside it show', () => {
    const b = beamWorld()
    b.fire(3300, 7.62, 1)
    expect(b.of('chip').length).toBeGreaterThanOrEqual(1)
    const bars = b.of('expose').at(-1)!.bars
    expect(bars.length).toBeGreaterThan(0)
    // the bars that show are the ones inside the block that came out: no longer than it
    for (const [a, c] of bars) expect(Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2])).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(b.world.part('b', 'beam')!.status).not.toBe('broken')
  })

  it('5.56 rounds take three or so to the block; a fist takes nothing, however many', () => {
    const b = beamWorld()
    b.fire(1750, 5.56, 2)
    expect(b.of('chip')).toHaveLength(0)
    b.fire(1750, 5.56, 2)
    expect(b.of('chip').length).toBeGreaterThanOrEqual(1)
    const p = beamWorld()
    for (let i = 0; i < 40; i++) p.world.hit('b', { type: 'blunt', point: [0.05, 2.95, 0.075], direction: [0, 0, -1], energy: 25, radius: 0.05 })
    expect(p.of('chip')).toHaveLength(0)
  })

  it('with its section shot away at one place the beam carries what its cage does', () => {
    const b = beamWorld()
    for (const y of [2.85, 2.95]) for (let i = 0; i < 2; i++) b.world.shoot([0.05, y, 5], [0, 0, -1], 3300, 7.62, 'test')
    const st = b.world.part('b', 'beam')!
    expect(st.chipped!.length).toBeGreaterThanOrEqual(2)
    const rows = new Set(st.chipped!.filter((c) => Math.abs(c.center[0] - 0.05) < 0.05).map((c) => Math.round(c.center[1] * 100)))
    expect(rows.size).toBe(2)
  })
})

describe('a row of shots along a wall', () => {
  /** A free-standing brick wall ten metres long with a concrete bond beam on top, on a slab of ground (the wall of the test room). */
  const longWall = () => {
    const world = createDestruction()
    world.add({
      parts: [
        { id: 'wall', material: 'brick', shape: { kind: 'box', size: [10.15, 2.8, 0.13] }, position: [0, 1.4, 0], structure: { role: 'wall' } },
        { id: 'beam', material: 'concrete', shape: { kind: 'box', size: [10.15, 0.2, 0.15] }, position: [0, 2.9, 0], structure: { role: 'beam' } },
        { id: 'ground', material: 'concrete', shape: { kind: 'box', size: [16, 0.5, 6] }, position: [0, -0.25, 0], anchored: true, tags: ['terrain'] },
      ],
      joints: [
        { a: 'wall', b: 'ground', kind: 'mortar', strength: 400, bears: 'a_on_b' },
        { a: 'beam', b: 'wall', kind: 'mortar', strength: 400, bears: 'a_on_b' },
      ],
    } as any, { id: 'W', position: [0, 0, -11] })
    return world
  }
  const row = (world: ReturnType<typeof createDestruction>, y: number, shots: number) => {
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    for (let k = 0; k < shots; k++) {
      const x = -2.4 + (k % 24) * 0.2
      const d = [0, y - 1.6, -4], len = Math.hypot(d[0], d[1], d[2])
      world.shoot([x, 1.6, -7], [d[0] / len, d[1] / len, d[2] / len], 2102.5, 7.9, 'player', { penetration: { steel: 6.5, concrete: 110, brick: 220, wood: 300 } })
      for (let t = 0; t < 7; t++) world.update(0.1)
    }
    return events
  }

  it('leaves the wall standing after two passes of 7.62 across its middle', () => {
    const world = longWall()
    const events = row(world, 1.3, 48)
    expect(events.filter((e) => e.type === 'detach' || e.type === 'collapse')).toEqual([])
    expect(world.part('W', 'wall')!.status).not.toBe('collapsed')
  })

  it('does not shake the bond beam off the wall with a row of 7.62 along it', () => {
    const world = longWall()
    const events = row(world, 2.9, 48)
    expect(events.filter((e) => e.type === 'detach' || e.type === 'collapse')).toEqual([])
    expect(world.part('W', 'beam')!.status).not.toBe('collapsed')
  })
})
