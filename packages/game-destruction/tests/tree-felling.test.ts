import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'

/** Blows (or shots) until a 1 m cylinder of green wood is broken. */
const until = (diameter: number, hit: (d: number) => Parameters<ReturnType<typeof createDestruction>['hitPart']>[2], max = 400): number => {
  const w = createDestruction()
  const id = w.add({ parts: [{ id: 't', material: 'green_wood', shape: { kind: 'cylinder', radius: diameter / 2, height: 1 }, position: [0, 0.5, 0] }] }, { id: 'x' })
  let n = 0
  for (; n < max && w.part(id, 't')!.status !== 'broken'; n++) w.hitPart(id, 't', hit(diameter))
  return n
}
const axe = (d: number) => ({ type: 'slash' as const, point: [d / 2, 0.5, 0] as [number, number, number], direction: [-1, 0, 0] as [number, number, number], energy: 250, radius: 0.05 })
const machete = (d: number) => ({ ...axe(d), energy: 140 })
const bullet = (d: number) => ({ type: 'ballistic' as const, point: [d / 2, 0.5, 0] as [number, number, number], direction: [-1, 0, 0] as [number, number, number], energy: 500, caliber: 9 })

describe('felling trees', () => {
  it('an axe fells a 15 cm trunk in 8-15 blows and a 30 cm trunk in 25-40', () => {
    const a = until(0.15, axe)
    const b = until(0.3, axe)
    expect(a).toBeGreaterThanOrEqual(8)
    expect(a).toBeLessThanOrEqual(15)
    expect(b).toBeGreaterThanOrEqual(25)
    expect(b).toBeLessThanOrEqual(40)
  })

  it('a machete cuts a 3 cm branch in 1-3 blows', () => {
    const n = until(0.03, machete)
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(3)
  })

  it('a whole magazine of 9 mm does not fell a 30 cm trunk (or a 15 cm one)', () => {
    expect(until(0.3, bullet, 30)).toBe(30)
    expect(until(0.15, bullet, 30)).toBe(30)
  })
})
