import { describe, expect, it } from 'vitest'
import { createDestruction, sizeStructure } from '../src'
import type { DestructibleSpec, JointSpec, PartSpec } from '../src'

/** Four columns under a slab, no capacities given (the material's own capacity is far too high or too low to mean anything). */
const slab4 = (): DestructibleSpec => {
  const pos: Array<[number, number]> = [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]
  const parts: PartSpec[] = []
  const joints: JointSpec[] = []
  pos.forEach(([x, z], i) => {
    parts.push({ id: `f${i}`, material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [x, -0.15, z], structure: { role: 'foundation' } })
    parts.push({ id: `c${i}`, material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [x, 1.5, z], structure: { role: 'column' } })
    joints.push({ a: `c${i}`, b: `f${i}`, kind: 'rebar', bears: 'a_on_b' })
    joints.push({ a: 'slab', b: `c${i}`, kind: 'rebar', bears: 'a_on_b' })
  })
  // reinforced at the minimum ratio of NBR 6118 (0.15%): sizeStructure adds the steel the slab needs in bending
  parts.push({ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4.2, 0.2, 4.2] }, position: [0, 3.1, 0], structure: { role: 'slab', rebar: { ratio: 0.0015 } } })
  parts.push({ id: 'window', material: 'glass', shape: { kind: 'box', size: [1, 1, 0.01] }, position: [0, 1.5, 2.1] })
  return { name: 'slab4', parts, joints }
}

const strike = (w: ReturnType<typeof createDestruction>, id: string, spec: DestructibleSpec, part: string) => {
  const [x, y, z] = spec.parts.find((p) => p.id === part)!.position
  return w.hit(id, { type: 'blunt', point: [x + 0.15, y, z], direction: [-1, 0, 0], energy: 3e6, radius: 0.05 })
}
const run = (w: ReturnType<typeof createDestruction>, s: number) => {
  const ev = []
  for (let t = 0; t < s; t += 0.1) ev.push(...w.update(0.1))
  return ev
}

describe('sizeStructure', () => {
  it('sets the at-rest stress of every structural part to the safety factor and leaves the rest alone', () => {
    const spec = slab4()
    const copy = structuredClone(spec)
    const sized = sizeStructure(spec)
    expect(spec).toEqual(copy)
    const w = createDestruction()
    const id = w.add(sized)
    for (const p of w.state(id)!.parts) {
      if (p.id === 'window') expect(p.stress).toBeUndefined()
      else expect(p.stress!).toBeCloseTo(0.65, 6)
    }
    expect(sized.parts.find((p) => p.id === 'window')!.structure).toBeUndefined()
    expect(sizeStructure(spec, { safety: 0.5 }).parts.find((p) => p.id === 'c0')!.structure!.capacity).toBeCloseTo(
      sized.parts.find((p) => p.id === 'c0')!.structure!.capacity! * 0.65 / 0.5, 6)
  })

  it('with defaults a slab survives losing any one column', () => {
    const spec = sizeStructure(slab4(), { redundancy: 0.97 })
    for (let k = 0; k < 4; k++) {
      const w = createDestruction()
      const id = w.add(spec)
      strike(w, id, spec, `c${k}`)
      expect(w.part(id, `c${k}`)!.status).toBe('broken')
      for (const p of w.state(id)!.parts) if (p.id !== `c${k}`) expect(p.stress ?? 0).toBeLessThanOrEqual(0.97 + 1e-9)
      const ev = run(w, 30)
      expect(ev.some((e) => e.type === 'collapse')).toBe(false)
      expect(w.part(id, 'slab')!.status).not.toBe('broken')
    }
  })

  it('rest stress is 0.65 and losing two adjacent columns collapses the slab', () => {
    const spec = sizeStructure(slab4(), { redundancy: 0.97 })
    const w = createDestruction()
    const id = w.add(spec)
    expect(w.part(id, 'c0')!.stress!).toBeCloseTo(0.65, 2)
    strike(w, id, spec, 'c0')
    strike(w, id, spec, 'c1')
    expect(w.part(id, 'c2')!.stress!).toBeGreaterThan(1)
    const ev = run(w, 60)
    const c = ev.find((e) => e.type === 'collapse')
    expect(c && c.type === 'collapse' && c.parts).toContain('slab')
  })

  it('redundancy only ever raises capacities', () => {
    const a = sizeStructure(slab4())
    const b = sizeStructure(slab4(), { redundancy: 0.97 })
    for (const p of a.parts) if (p.structure) expect(b.parts.find((q) => q.id === p.id)!.structure!.capacity!).toBeGreaterThanOrEqual(p.structure.capacity!)
  })

  it('raises capacities when safety alone would not survive losing a column', () => {
    const plain = sizeStructure(slab4(), { safety: 0.85 })
    const redundant = sizeStructure(slab4(), { safety: 0.85, redundancy: 0.97 })
    const cap = (s: DestructibleSpec) => s.parts.find((p) => p.id === 'c1')!.structure!.capacity!
    expect(cap(redundant)).toBeGreaterThan(cap(plain) * 1.05)
    const spec = redundant
    const w = createDestruction()
    const id = w.add(spec)
    expect(w.part(id, 'c1')!.stress!).toBeLessThan(0.85)
    strike(w, id, spec, 'c0')
    expect(w.part(id, 'c1')!.stress!).toBeLessThanOrEqual(0.97 + 1e-9)
  })
})
