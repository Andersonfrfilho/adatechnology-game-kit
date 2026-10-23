import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionWorld, JointSpec, PartSpec } from '../src'

const lose = (w: DestructionWorld, id: string, spec: DestructibleSpec) => {
  for (const c of ['c0', 'c1']) {
    const [x, y, z] = spec.parts.find((p) => p.id === c)!.position
    w.hit(id, { type: 'blunt', point: [x + 0.15, y, z], direction: [-1, 0, 0], energy: 3e6, radius: 0.05 })
  }
}

/** Four columns under a slab. Each column's capacity is set so that, with the two columns on the -x side gone, the other two stand at `stress`. */
const slab = (stress: number): DestructibleSpec => {
  const pos: Array<[number, number]> = [[-1.8, -1.8], [-1.8, 1.8], [1.8, -1.8], [1.8, 1.8]]
  const make = (capacity: number): DestructibleSpec => {
    const parts: PartSpec[] = []
    const joints: JointSpec[] = []
    pos.forEach(([x, z], i) => {
      parts.push({ id: `f${i}`, material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [x, -0.15, z], structure: { role: 'foundation' } })
      parts.push({ id: `c${i}`, material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [x, 1.5, z], structure: { role: 'column', capacity } })
      joints.push({ a: `c${i}`, b: `f${i}`, kind: 'rebar', bears: 'a_on_b' }, { a: 'slab', b: `c${i}`, kind: 'rebar', bears: 'a_on_b' })
    })
    parts.push({ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4.2, 0.2, 4.2] }, position: [0, 3.1, 0], structure: { role: 'slab' } })
    return { parts, joints }
  }
  const w = createDestruction()
  const probe = make(1e9)
  const id = w.add(probe)
  lose(w, id, probe)
  return make(w.part(id, 'c2')!.load! / stress)

}

/** Seconds from losing the two -x columns until the slab's `collapse` event (null if none within `limit`). */
const secondsToCollapse = (stress: number, limit = 60): number | null => {
  const w = createDestruction()
  const spec = slab(stress)
  const id = w.add(spec)
  lose(w, id, spec)
  expect(w.part(id, 'c2')!.stress!).toBeCloseTo(stress, 2)
  const dt = 1 / 60
  for (let t = 0; t < limit; t += dt) {
    const ev: DestructionEvent[] = w.update(dt)
    if (ev.some((e) => e.type === 'collapse' && e.parts.includes('slab'))) return t
  }
  return null
}

describe('overload collapses on a game-feel timescale', () => {
  it('stress 1.5 or more collapses in well under 5 s, stress far above 2 in 1-3 s', () => {
    const t15 = secondsToCollapse(1.5)!
    const t2 = secondsToCollapse(2)!
    const t4 = secondsToCollapse(4)!
    const t8 = secondsToCollapse(8)!
    expect(t15).toBeLessThan(3)
    expect(t2).toBeLessThan(3)
    for (const t of [t4, t8]) {
      expect(t).toBeGreaterThanOrEqual(1)
      expect(t).toBeLessThanOrEqual(3)
    }
    expect(t15).toBeGreaterThanOrEqual(t2 - 0.05)
  })

  it('stress just above 1 creeps for several seconds but does not hang for minutes', () => {
    const t102 = secondsToCollapse(1.02)!
    const t11 = secondsToCollapse(1.1)!
    expect(t102).toBeGreaterThan(4)
    expect(t102).toBeLessThan(12)
    expect(t11).toBeGreaterThan(2)
    expect(t11).toBeLessThan(t102)
  })

  it('is deterministic and stress at or below 1 never collapses', () => {
    expect(secondsToCollapse(1.3)).toBe(secondsToCollapse(1.3))
    expect(secondsToCollapse(0.99, 30)).toBeNull()
  })
})
