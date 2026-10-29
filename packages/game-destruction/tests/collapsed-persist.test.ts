import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec, DestructionWorld, Hit, PartStatus } from '../src'

/** Two concrete columns (weak: one blow removes them) under a slab with a brick wall and a wooden shelf on top. */
const spec = (): DestructibleSpec => ({
  parts: [
    { id: 'f0', material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [-1, -0.15, 0], structure: { role: 'foundation' } },
    { id: 'f1', material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [1, -0.15, 0], structure: { role: 'foundation' } },
    { id: 'c0', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [-1, 1.5, 0], structure: { role: 'column', capacity: 4000 }, hp: 5 },
    { id: 'c1', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [1, 1.5, 0], structure: { role: 'column', capacity: 4000 }, hp: 5 },
    { id: 'slab', material: 'concrete', shape: { kind: 'box', size: [3, 0.2, 2] }, position: [0, 3.1, 0], structure: { role: 'slab' } },
    { id: 'wall', material: 'brick', shape: { kind: 'box', size: [1, 2, 0.2] }, position: [0, 4.2, 0], structure: { role: 'wall' } },
    { id: 'shelf', material: 'wood_soft', shape: { kind: 'box', size: [0.6, 0.04, 0.3] }, position: [0, 5.22, 0], tags: ['prop'] },
  ],
  joints: [
    { a: 'c0', b: 'f0', kind: 'rebar', bears: 'a_on_b' },
    { a: 'c1', b: 'f1', kind: 'rebar', bears: 'a_on_b' },
    { a: 'slab', b: 'c0', kind: 'rebar', bears: 'a_on_b' },
    { a: 'slab', b: 'c1', kind: 'rebar', bears: 'a_on_b' },
    { a: 'wall', b: 'slab', kind: 'mortar', bears: 'a_on_b' },
    { a: 'shelf', b: 'wall', kind: 'nail', bears: false },
  ],
})

const hitCol = (w: DestructionWorld, id: string, part: string) => {
  const p = spec().parts.find((x) => x.id === part)!
  return w.hit(id, { type: 'blunt', point: [p.position[0] + 0.15, p.position[1], p.position[2]], direction: [-1, 0, 0], energy: 5000, radius: 0.05 })
}
const collapse = () => {
  const w = createDestruction()
  const id = w.add(spec())
  hitCol(w, id, 'c0')
  hitCol(w, id, 'c1')
  for (let i = 0; i < 40; i++) w.update(0.25)
  return { w, id }
}
const status = (w: DestructionWorld, id: string, part: string): PartStatus | undefined => w.part(id, part)?.status
const NOT_BACK: PartStatus[] = ['intact', 'damaged']

describe('the collapsed status', () => {
  it('is set on every part of the group that fell', () => {
    const { w, id } = collapse()
    for (const p of ['slab', 'wall', 'shelf']) expect(status(w, id, p)).toBe('collapsed')
  })

  it('is never replaced by intact or damaged, whatever hits the part afterwards', () => {
    const { w, id } = collapse()
    const hits: Hit[] = [
      { type: 'blunt', point: [0, 3.1, 0], direction: [0, -1, 0], energy: 40, radius: 0.1, source: 'fall' },
      { type: 'slash', point: [0, 4.2, 0.1], direction: [0, 0, -1], energy: 30 },
      { type: 'ballistic', point: [0, 4.2, 0.1], direction: [0, 0, -1], energy: 400, caliber: 9 },
      { type: 'explosive', point: [0, 3, 0], energy: 800, radius: 2 },
      { type: 'fire', point: [0, 5.22, 0], temperature: 700, radius: 0.3, duration: 0.5 },
      { type: 'heat', point: [0, 3.1, 0], temperature: 300, radius: 0.3, duration: 1 },
    ]
    for (const h of hits) {
      w.hit(id, h)
      for (let i = 0; i < 8; i++) w.update(0.25)
      for (const p of ['slab', 'wall', 'shelf']) expect(NOT_BACK, `${p} after ${h.type}`).not.toContain(status(w, id, p))
    }
    w.extinguish(id)
    for (let i = 0; i < 200; i++) w.update(0.25)
    for (const p of ['slab', 'wall', 'shelf']) expect(NOT_BACK).not.toContain(status(w, id, p))
  })

  it('survives splitting the fallen group into a piece of its own, and a save and load of the new piece', () => {
    const { w, id } = collapse()
    const g = w.state(id)!.groups.findIndex((x) => x.includes('slab'))
    const piece = w.splitGroup(id, g)
    for (const p of ['slab', 'wall', 'shelf']) expect(status(w, piece, p)).toBe('collapsed')
    w.hit(piece, { type: 'blunt', point: [0, 3, 0], direction: [0, -1, 0], energy: 40, radius: 0.1, source: 'fall' })
    for (let i = 0; i < 40; i++) w.update(0.25)
    const w2 = createDestruction()
    w2.load(JSON.parse(JSON.stringify(w.serialize())))
    for (const p of ['slab', 'wall', 'shelf']) {
      expect(NOT_BACK).not.toContain(status(w, piece, p))
      expect(status(w2, piece, p)).toBe(status(w, piece, p))
    }
  })

  it('can still end as broken once the part is really destroyed', () => {
    const { w, id } = collapse()
    w.hit(id, { type: 'blunt', point: [0, 3.1, 0], direction: [0, -1, 0], energy: 5e7, radius: 0.5 })
    expect(['broken', 'collapsed']).toContain(status(w, id, 'slab'))
    expect([...w.state(id)!.parts].some((p) => p.status === 'broken' && ['slab', 'wall', 'shelf'].includes(p.id))).toBe(true)
  })
})
