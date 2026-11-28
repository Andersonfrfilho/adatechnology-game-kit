import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, PartSpec } from '../src'

/** The cage of a small concrete pole: 10 mm bars, 10 cm apart, and the concrete coming off in blocks of one bay. */
const caged = (part: PartSpec): PartSpec => ({
  ...part,
  reinforcement: { material: 'steel', spacing: 0.1, diameter: 0.01 },
  units: { size: [0.1, 0.1, 0.26], bond: 'stack', mortar: 'concrete' },
  structure: { role: 'column' },
})

/** A service pole as the furniture room gives it: a concrete foot set in the ground, the shaft cast on it (the bars hold them), a wooden cross arm bolted on top. */
const pole = (): DestructibleSpec => ({
  name: 'service_entrance',
  fixed: true,
  parts: [
    caged({ id: 'foot', material: 'concrete', shape: { kind: 'box', size: [0.3, 0.25, 0.3] }, position: [0, 0.125, 0], mass: 40, anchored: true }),
    caged({ id: 'shaft', material: 'concrete', shape: { kind: 'box', size: [0.26, 3.4, 0.26] }, position: [0, 1.95, 0], mass: 180 }),
    caged({ id: 'top', material: 'concrete', shape: { kind: 'box', size: [0.22, 2.8, 0.22] }, position: [0, 5.05, 0], mass: 90 }),
    { id: 'arm', material: 'wood_soft', shape: { kind: 'box', size: [0.56, 0.09, 0.09] }, position: [0, 6.2, 0], mass: 6 },
  ],
  joints: [
    { a: 'foot', b: 'shaft', kind: 'rebar' },
    { a: 'shaft', b: 'top', kind: 'rebar' },
    { a: 'top', b: 'arm', kind: 'bolt' },
  ],
})

const setup = () => {
  const world = createDestruction({ seed: 3 })
  world.add(pole(), { id: 'pole' })
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  // a 7.62 x 39 round: about 2 kJ at the muzzle
  const rifle = (y: number) => world.shoot([0.03, y, 6], [0, 0, -1], 2000, 7.62, 'test')
  const settle = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) world.update(1 / 60)
  }
  return { world, events, rifle, settle }
}

describe('a concrete pole set in the ground', () => {
  it('stands as laid: its foot holds it to the world and nothing breaks under its own weight', () => {
    const { world, events, settle } = setup()
    settle(5)
    expect(world.anchoredParts('pole')).toEqual(['foot'])
    expect(world.fixedInPlace('pole')).toBe(true)
    expect(events.filter((e) => e.type === 'detach' || e.type === 'collapse')).toEqual([])
    expect(world.state('pole')!.groups).toHaveLength(1)
  })

  it('rifle rounds chip the concrete where they land and the bars show there; the pole still stands', () => {
    const { world, events, rifle, settle } = setup()
    for (let i = 0; i < 12; i++) {
      rifle(1.5)
      settle(0.1)
    }
    const chips = events.filter((e): e is Extract<DestructionEvent, { type: 'chip' }> => e.type === 'chip' && e.part === 'shaft')
    expect(chips.length).toBeGreaterThan(0)
    // where the concrete came off, it came off near the hits, not all over the shaft
    for (const chip of chips) expect(Math.abs(chip.center[1] - 1.5)).toBeLessThan(0.4)
    expect(events.some((e) => e.type === 'expose' && e.part === 'shaft')).toBe(true)
    expect(events.filter((e) => e.type === 'collapse')).toEqual([])
    expect(world.anchoredParts('pole')).toEqual(['foot'])
  })

  it('a foot that is lost no longer holds it: what was set in the ground is not anchored any more', () => {
    const world = createDestruction({ seed: 3 })
    world.add({ parts: [
      { id: 'post', material: 'wood_soft', shape: { kind: 'box', size: [0.08, 1.2, 0.08] }, position: [0, 0.6, 0], anchored: true },
      { id: 'sign', material: 'wood_soft', shape: { kind: 'box', size: [0.5, 0.3, 0.02] }, position: [0, 1.35, 0] },
    ], joints: [{ a: 'post', b: 'sign', kind: 'nail' }] }, { id: 'sign_post' })
    expect(world.anchoredParts('sign_post')).toEqual(['post'])
    // anchored but not said to be fixed where it is laid: a host may still let what is left of it go
    expect(world.fixedInPlace('sign_post')).toBe(false)
    for (let i = 0; i < 60 && world.part('sign_post', 'post')!.status !== 'broken'; i++) world.hitPart('sign_post', 'post', { type: 'blunt', point: [0, 0.6, 0.04], direction: [0, 0, -1], energy: 4000, radius: 0.1, source: 'test' })
    expect(world.part('sign_post', 'post')!.status).toBe('broken')
    expect(world.anchoredParts('sign_post')).toEqual([])
    expect(world.anchoredParts('nothing')).toEqual([])
    expect(world.fixedInPlace('nothing')).toBe(false)
  })
})
