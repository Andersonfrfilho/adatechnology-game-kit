import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionWorld, JointSpec, PartSpec } from '../src'

const ground: PartSpec = { id: 'ground', material: 'concrete', shape: { kind: 'box', size: [20, 0.5, 20] }, position: [0, -0.25, 0], structure: { role: 'foundation' }, anchored: true }

/** A tent: a canvas over two poles standing on the ground, guyed to four stakes by ropes (`tie`). */
const tent = (): DestructibleSpec => {
  const parts: PartSpec[] = [
    ground,
    { id: 'canvas', material: 'fabric', shape: { kind: 'box', size: [2.4, 1, 1.2] }, position: [0, 0.5, 0], structure: { role: 'roof', capacity: 5000 }, mass: 20 },
    { id: 'pole_0', material: 'wood_hard', shape: { kind: 'box', size: [0.04, 0.96, 0.04] }, position: [-1, 0.48, 0], structure: { role: 'column', capacity: 5000 }, hp: 5 },
    { id: 'pole_1', material: 'wood_hard', shape: { kind: 'box', size: [0.04, 0.96, 0.04] }, position: [1, 0.48, 0], structure: { role: 'column', capacity: 5000 }, hp: 5 },
  ]
  const joints: JointSpec[] = [
    { a: 'pole_0', b: 'ground', kind: 'resting', bears: 'a_on_b' },
    { a: 'pole_1', b: 'ground', kind: 'resting', bears: 'a_on_b' },
    { a: 'canvas', b: 'pole_0', kind: 'resting', bears: 'a_on_b' },
    { a: 'canvas', b: 'pole_1', kind: 'resting', bears: 'a_on_b' },
  ]
  ;[[-1.8, -0.9], [1.8, -0.9], [-1.8, 0.9], [1.8, 0.9]].forEach(([x, z], i) => {
    parts.push({ id: `stake_${i}`, material: 'wood_soft', shape: { kind: 'box', size: [0.04, 0.2, 0.04] }, position: [x, 0.1, z], structure: { role: 'column', capacity: 5000 } })
    joints.push({ a: `stake_${i}`, b: 'ground', kind: 'nail', bears: 'a_on_b' })
    joints.push({ a: 'canvas', b: `stake_${i}`, kind: 'tie', bears: 'a_on_b' })
  })
  return { parts, joints }
}

const cut = (w: DestructionWorld, id: string, spec: DestructibleSpec, part: string): DestructionEvent[] => {
  const [x, y, z] = spec.parts.find((p) => p.id === part)!.position
  return w.hit(id, { type: 'blunt', point: [x + 0.02, y, z], direction: [-1, 0, 0], energy: 5000, radius: 0.05 }).events
}
const run = (w: DestructionWorld, seconds: number) => {
  const ev: DestructionEvent[] = []
  for (let t = 0; t < seconds; t += 0.25) ev.push(...w.update(0.25))
  return ev
}
const fallen = (ev: DestructionEvent[]) => ev.flatMap((e) => (e.type === 'collapse' ? e.parts : []))

describe('ties only hold what hangs from them', () => {
  it('a tent stands on its poles, and the guy ropes to the stakes carry no load', () => {
    const w = createDestruction()
    const id = w.add(tent())
    expect(fallen(run(w, 20))).toEqual([])
    expect(w.part(id, 'canvas')!.status).toBe('intact')
    for (let i = 0; i < 4; i++) expect(w.part(id, `stake_${i}`)!.load).toBeCloseTo(w.part(id, `stake_${i}`)!.mass, 6)
    expect(w.part(id, 'pole_0')!.load!).toBeGreaterThan(w.part(id, 'canvas')!.mass / 2 - 1e-6)
  })

  it('cutting both poles brings the canvas down even though the ropes and stakes are still there', () => {
    const spec = tent()
    const w = createDestruction()
    const id = w.add(spec)
    const ev = [...cut(w, id, spec, 'pole_0'), ...cut(w, id, spec, 'pole_1'), ...run(w, 20)]
    expect(w.part(id, 'pole_0')!.status).toBe('broken')
    expect(w.part(id, 'pole_1')!.status).toBe('broken')
    expect(fallen(ev)).toContain('canvas')
    expect(w.part(id, 'canvas')!.status).toBe('collapsed')
    for (let i = 0; i < 4; i++) expect(w.part(id, `stake_${i}`)!.status).not.toBe('collapsed')
  })

  it('cutting one pole leaves the canvas up on the other', () => {
    const spec = tent()
    const w = createDestruction()
    const id = w.add(spec)
    const ev = [...cut(w, id, spec, 'pole_0'), ...run(w, 20)]
    expect(fallen(ev)).toEqual([])
    expect(w.part(id, 'canvas')!.status).not.toBe('collapsed')
  })

  it('a lamp hanging from a ceiling by a tie still hangs, and its weight goes into the ceiling', () => {
    const spec: DestructibleSpec = {
      parts: [
        ground,
        { id: 'wall_0', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [-1, 1.5, 0], structure: { role: 'column', capacity: 1e6 } },
        { id: 'wall_1', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [1, 1.5, 0], structure: { role: 'column', capacity: 1e6 } },
        { id: 'ceiling', material: 'concrete', shape: { kind: 'box', size: [2.6, 0.2, 1] }, position: [0, 3.1, 0], structure: { role: 'slab', capacity: 1e6 } },
        { id: 'lamp', material: 'steel', shape: { kind: 'box', size: [0.3, 0.2, 0.3] }, position: [0, 2.2, 0], structure: { role: 'beam', capacity: 1e6 }, mass: 40 },
      ],
      joints: [
        { a: 'wall_0', b: 'ground', kind: 'rebar', bears: 'a_on_b' },
        { a: 'wall_1', b: 'ground', kind: 'rebar', bears: 'a_on_b' },
        { a: 'ceiling', b: 'wall_0', kind: 'rebar', bears: 'a_on_b' },
        { a: 'ceiling', b: 'wall_1', kind: 'rebar', bears: 'a_on_b' },
        { a: 'lamp', b: 'ceiling', kind: 'tie', bears: 'a_on_b' },
      ],
    }
    const w = createDestruction()
    const id = w.add(spec)
    const bare = createDestruction()
    const bid = bare.add({ ...spec, parts: spec.parts.filter((p) => p.id !== 'lamp'), joints: spec.joints!.filter((j) => j.a !== 'lamp') })
    expect(fallen(run(w, 20))).toEqual([])
    expect(w.part(id, 'lamp')!.status).toBe('intact')
    expect(w.part(id, 'ceiling')!.load!).toBeCloseTo(bare.part(bid, 'ceiling')!.load! + 40, 6)
    // lose the ceiling: the lamp goes with it
    const ev = [...cut(w, id, spec, 'wall_0'), ...cut(w, id, spec, 'wall_1'), ...run(w, 20)]
    expect(fallen(ev)).toEqual(expect.arrayContaining(['ceiling', 'lamp']))
  })

  it('a hinge or a clip still holds from the side', () => {
    for (const kind of ['hinge', 'clip'] as const) {
      const spec: DestructibleSpec = {
        parts: [
          ground,
          { id: 'post', material: 'steel', shape: { kind: 'box', size: [0.1, 2, 0.1] }, position: [0, 1, 0], structure: { role: 'column', capacity: 1e6 } },
          { id: 'gate', material: 'wood_hard', shape: { kind: 'box', size: [1, 1, 0.05] }, position: [0.6, 1, 0], structure: { role: 'beam', capacity: 1e6 } },
        ],
        joints: [
          { a: 'post', b: 'ground', kind: 'rebar', bears: 'a_on_b' },
          { a: 'gate', b: 'post', kind, bears: 'a_on_b' },
        ],
      }
      const w = createDestruction()
      const id = w.add(spec)
      expect(fallen(run(w, 10)), kind).toEqual([])
      expect(w.part(id, 'post')!.load!, kind).toBeGreaterThan(w.part(id, 'post')!.mass)
    }
  })
})
