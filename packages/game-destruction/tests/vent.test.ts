import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'

// A valve, not a bullet: `vent` opens a through opening in a container part and `seal` closes it. The leak is the same one a hole makes, so a flame lights it
// and a lit leak of a part that explodes primes its chain.
const cylinder = (chain = true): DestructibleSpec => ({
  parts: [
    {
      id: 'tank', material: 'steel', shape: { kind: 'cylinder', radius: 0.17, height: 0.49 }, position: [0, 0.245, 0], thickness: 0.002, fill: 0.03,
      contains: { fluid: 'gas', liters: 24, pressurized: true },
      explodes: { energy: 200000, radius: 14, ...(chain ? { chain: { shot: 1.4, fire: 1.4, explosion: 0.4 } } : {}) },
    },
  ],
})

describe('vent and seal', () => {
  it('opens a leak without a hole event and drains the container at the rate of the opening', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(cylinder())
    const events: string[] = []
    w.on('*', (e) => events.push(e.type))
    expect(w.vent(id, 'tank', { point: [0, 0.46, 0], normal: [0, 1, 0] })).toBe(true)
    expect(events).toEqual(['leak'])
    expect(w.part(id, 'tank')?.holes).toEqual([expect.objectContaining({ through: true, vent: true, diameter: 0.008 })])
    for (let i = 0; i < 10; i++) w.update(0.1)
    const liters = w.part(id, 'tank')?.liters ?? 24
    expect(liters).toBeLessThan(24)
    expect(liters).toBeCloseTo(24 - 0.5 * (0.008 / 0.009), 1)
    // opening it again is the same opening
    expect(w.vent(id, 'tank')).toBe(true)
    expect(w.part(id, 'tank')?.holes).toHaveLength(1)
  })

  it('stops the leak when it is sealed, and refuses a part that holds nothing', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(cylinder())
    w.vent(id, 'tank')
    expect(w.seal(id, 'tank')).toBe(1)
    const before = w.part(id, 'tank')?.liters
    for (let i = 0; i < 10; i++) w.update(0.1)
    expect(w.part(id, 'tank')?.liters).toBe(before)
    w.setLiters(id, 'tank', 0)
    expect(w.vent(id, 'tank')).toBe(false)
  })

  it('does not go off by itself: the gas goes until a flame lights it', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(cylinder())
    w.vent(id, 'tank', { point: [0, 0.46, 0] })
    const events: string[] = []
    w.on('*', (e) => events.push(e.type))
    for (let i = 0; i < 40; i++) w.update(0.1)
    expect(events).not.toContain('explode')
    expect(events).not.toContain('primed')
  })

  it('a flame held at the leak lights it, which primes the chain of fire and then the blast', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(cylinder())
    w.vent(id, 'tank', { point: [0, 0.46, 0] })
    const events: Array<{ type: string; time: number; trigger?: string }> = []
    w.on('*', (e) => events.push({ type: e.type, time: e.time, ...('trigger' in e ? { trigger: e.trigger } : {}) }))
    w.hit(id, { type: 'heat', point: [0, 0.5, 0], temperature: 1100, radius: 0.15, duration: 0.5 })
    for (let i = 0; i < 20; i++) w.update(0.1)
    const primed = events.find((e) => e.type === 'primed')
    const exploded = events.find((e) => e.type === 'explode')
    expect(primed?.trigger).toBe('fire')
    expect(exploded).toBeDefined()
    expect((exploded?.time ?? 0) - (primed?.time ?? 0)).toBeCloseTo(1.4, 1)
  })

  it('a cool source does not light it', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(cylinder())
    w.vent(id, 'tank', { point: [0, 0.46, 0] })
    w.hit(id, { type: 'heat', point: [0, 0.5, 0], temperature: 200, radius: 0.15, duration: 0.5 })
    const events: string[] = []
    w.on('*', (e) => events.push(e.type))
    for (let i = 0; i < 30; i++) w.update(0.1)
    expect(events).not.toContain('primed')
  })

  it('burns as a jet when the part does not explode', () => {
    const w = createDestruction({ seed: 1 })
    const spec = cylinder()
    delete (spec.parts[0] as { explodes?: unknown }).explodes
    const id = w.add(spec)
    w.vent(id, 'tank', { point: [0, 0.46, 0] })
    w.hit(id, { type: 'heat', point: [0, 0.5, 0], temperature: 1100, radius: 0.15, duration: 0.5 })
    const events: string[] = []
    w.on('*', (e) => events.push(e.type))
    for (let i = 0; i < 5; i++) w.update(0.1)
    expect(events).toContain('ignite')
  })
})
