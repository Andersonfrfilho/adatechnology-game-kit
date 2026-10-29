import { describe, expect, it } from 'vitest'
import { checkHit, useToHit } from '../src'
import type { Use } from '../src'

const o: [number, number, number] = [0, 1, 0]
const d: [number, number, number] = [0, 0, -1]
const at: [number, number, number] = [1, 2, 3]

describe('useToHit', () => {
  it('maps a blunt and a slash melee swing', () => {
    for (const damage of ['blunt', 'slash'] as const) {
      const h = useToHit({ kind: 'melee', damage, energy: 80, radius: 0.1, reach: 1.5, origin: o, direction: d }, at)
      expect(h).toEqual({ type: damage, point: at, direction: d, energy: 80, radius: 0.1 })
      expect(checkHit(h!)).toEqual([])
    }
  })
  it('maps flame to fire and heat to heat, capping the contact radius', () => {
    const f = useToHit({ kind: 'flame', temperature: 900, radius: 0.6, range: 4, cone: true, duration: 0.1, origin: o, direction: d }, at)
    expect(f).toEqual({ type: 'fire', point: at, direction: d, temperature: 900, radius: 0.3, duration: 0.1 })
    const h = useToHit({ kind: 'heat', temperature: 1500, radius: 0.05, range: 0.1, duration: 0.2, origin: o, direction: d }, at)
    expect(h).toEqual({ type: 'heat', point: at, direction: d, temperature: 1500, radius: 0.05, duration: 0.2 })
    expect(checkHit(f!)).toEqual([])
    expect(checkHit(h!)).toEqual([])
  })
  it('maps a grenade to a blast and a molotov to its fire patch', () => {
    const g: Use = { kind: 'throw', energy: 5000, radius: 6, fuse: 3, velocity: d, origin: o }
    expect(useToHit(g, at)).toEqual({ type: 'explosive', point: at, energy: 5000, radius: 6 })
    const m: Use = { kind: 'throw', energy: 0, radius: 1, fuse: 0, velocity: d, origin: o, fire: { temperature: 800, radius: 2, seconds: 8 } }
    expect(useToHit(m, at)).toEqual({ type: 'fire', point: at, temperature: 800, radius: 2, duration: 8 })
    expect(useToHit({ kind: 'throw', energy: 0, radius: 1, fuse: 1, velocity: d, origin: o }, at)).toBeNull()
  })
  it('returns null for tool, extinguish and hand', () => {
    expect(useToHit({ kind: 'tool', tool: 'screwdriver', reach: 2, duration: 0.1, origin: o, direction: d }, at)).toBeNull()
    expect(useToHit({ kind: 'extinguish', range: 5, coolC: 50, duration: 0.1, origin: o, direction: d }, at)).toBeNull()
    expect(useToHit({ kind: 'hand', reach: 2, origin: o, direction: d }, at)).toBeNull()
  })
  it('copies the point and ignores the normal', () => {
    const h = useToHit({ kind: 'melee', damage: 'blunt', energy: 1, radius: 1, reach: 1, origin: o, direction: d }, at, [0, 1, 0])!
    expect(h.point).not.toBe(at)
  })
})
