import { describe, expect, it } from 'vitest'
import type { WorldEvent } from '../src'
import { cabinet, loot, items, origin, run, world } from './fixtures'

describe('containers', () => {
  it('uses explicit contents and pads to the slot count', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.contents('c', 'main')).toEqual([{ type: 'can', qty: 2 }, null])
  })

  it('is not accessible until the access part is open', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.accessible('c', 'main')).toBe(false)
    expect(w.take('c', 'main', 0)).toBeNull()
    w.setPart('c', 'door', 1)
    run(w, 0.05)
    expect(w.accessible('c', 'main')).toBe(false)
    run(w, 1)
    expect(w.accessible('c', 'main')).toBe(true)
  })

  it('open shelves are always accessible; non pickable items stay', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.accessible('c', 'shelf')).toBe(true)
    expect(w.take('c', 'shelf', 0)).toBeNull()
    expect(w.contents('c', 'shelf')[0]?.type).toBe('statue')
  })

  it('take returns the stack, empties the slot and emits pickup', () => {
    const { w, events } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'door', 1, true)
    const got = w.take('c', 'main', 0, 'bob')
    expect(got).toEqual({ type: 'can', qty: 2 })
    expect(w.contents('c', 'main')[0]).toBeNull()
    expect(w.take('c', 'main', 0)).toBeNull()
    const pick = events.find((e): e is Extract<WorldEvent, { type: 'pickup' }> => e.type === 'pickup')
    expect(pick?.actor).toBe('bob')
    expect(pick?.slot).toBe(0)
  })

  it('put merges stacks, fills free slots and respects size', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    w.setPart('c', 'door', 1, true)
    expect(w.put('c', 'main', { type: 'can', qty: 3 })).toBe(0)
    expect(w.contents('c', 'main')[0]?.qty).toBe(5)
    expect(w.put('c', 'main', { type: 'can', qty: 3 })).toBe(1)
    expect(w.put('c', 'main', { type: 'big', qty: 1 })).toBeNull()
    expect(w.put('c', 'main', { type: 'can', qty: 1 })).toBe(0)
  })

  it('put into a closed container fails', () => {
    const { w } = world()
    w.add('c', cabinet, origin)
    expect(w.put('c', 'main', { type: 'can', qty: 1 })).toBeNull()
  })

  it('loot is deterministic per seed + object + container, and differs by seed', () => {
    const a = world({ seed: 5 })
    const b = world({ seed: 5 })
    const c = world({ seed: 6 })
    for (const x of [a, b, c]) x.w.add('c', cabinet, origin)
    expect(a.w.contents('c', 'inner')).toEqual(b.w.contents('c', 'inner'))
    // an item bigger than the slot never lands there
    expect(a.w.contents('c', 'inner').every((s) => s === null || s.type === 'can' || s.type === 'big')).toBe(true)
    let differs = false
    for (let seed = 0; seed < 20; seed++) {
      const x = world({ seed })
      const y = world({ seed: seed + 100 })
      x.w.add('c', cabinet, origin)
      y.w.add('c', cabinet, origin)
      if (JSON.stringify(x.w.contents('c', 'inner')) !== JSON.stringify(y.w.contents('c', 'inner'))) differs = true
    }
    expect(differs).toBe(true)
    void items
    void loot
  })

  it('a different object id gives different loot streams', () => {
    const { w } = world()
    const spec = { ...cabinet, containers: [{ ...cabinet.containers![1], slots: Array.from({ length: 10 }, () => ({ pos: [0, 0, 0] as [number, number, number], max: [0.3, 0.3, 0.3] as [number, number, number] })) }] }
    w.add('a', spec, origin)
    w.add('b', spec, origin)
    expect(w.contents('a', 'inner')).not.toEqual(w.contents('b', 'inner'))
  })

  it('slotPosition follows the drawer', () => {
    const { w } = world()
    w.add('c', cabinet, { x: 1, y: 0, z: 2, ry: 0 })
    const closed = w.slotPosition('c', 'inner', 0)
    w.setPart('c', 'door', 1, true)
    w.setPart('c', 'drawer', 1, true)
    const open = w.slotPosition('c', 'inner', 0)
    expect(open[2] - closed[2]).toBeCloseTo(0.4)
    expect(open[0]).toBeCloseTo(closed[0])
  })

  it('slotPosition rotates with the object', () => {
    const { w } = world()
    w.add('c', cabinet, { x: 0, y: 0, z: 0, ry: Math.PI / 2 })
    w.setPart('c', 'door', 1, true)
    w.setPart('c', 'drawer', 1, true)
    const p = w.slotPosition('c', 'inner', 0)
    expect(p[0]).toBeCloseTo(0.7)
    expect(p[2]).toBeCloseTo(0, 5)
  })
})
