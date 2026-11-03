import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DamageType, DestructionEvent } from '../src'

/** Every event a hit emits says which kind of hit it came out of (`blow`): the sound of an impact is chosen by it. */
const blowsOf = (type: DamageType, material: string): Set<string | undefined> => {
  const world = createDestruction({ seed: 1 })
  const id = world.add({ parts: [{ id: 'p', material, shape: { kind: 'box', size: [0.05, 1, 1] }, position: [0, 0.5, 0] }] })
  const seen: DestructionEvent[] = []
  world.on('*', (e) => seen.push(e))
  world.hit(id, { type, point: [0.025, 0.5, 0], direction: [-1, 0, 0], energy: 800, caliber: 9, radius: 0.04 })
  return new Set(seen.filter((e) => e.type !== 'damage').map((e) => e.blow))
}

describe('DestructionEvent.blow', () => {
  it.each([
    ['ballistic', 'steel'],
    ['ballistic', 'concrete'],
    ['blunt', 'steel'],
    ['slash', 'wood_soft'],
  ] as const)('a %s hit on %s tags its events with the blow', (type, material) => {
    const blows = blowsOf(type, material)
    expect(blows.size).toBeGreaterThan(0)
    expect([...blows]).toEqual([type])
  })

})

describe('DestructionEvent.blow on a shot', () => {
  it('world.shoot tags what the round does as ballistic', () => {
    const world = createDestruction({ seed: 1 })
    world.add({ parts: [{ id: 'p', material: 'concrete', shape: { kind: 'box', size: [0.1, 1, 1] }, position: [0, 0.5, 0] }] })
    const seen: DestructionEvent[] = []
    world.on('*', (e) => seen.push(e))
    world.shoot([2, 0.5, 0], [-1, 0, 0], 600, 9, 'test')
    const blows = new Set(seen.filter((e) => e.type !== 'damage').map((e) => e.blow))
    expect(blows.size).toBeGreaterThan(0)
    expect([...blows]).toEqual(['ballistic'])
  })
})
