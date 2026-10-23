import { describe, expect, it } from 'vitest'
import { buildFrame, createDestruction, sizeStructure } from '../src'
import type { DestructibleSpec, DestructionEvent, DestructionWorld } from '../src'

const strike = (w: DestructionWorld, id: string, spec: DestructibleSpec, part: string) => {
  const [x, y, z] = spec.parts.find((p) => p.id === part)!.position
  return w.hit(id, { type: 'blunt', point: [x + 0.15, y, z], direction: [-1, 0, 0], energy: 3e6, radius: 0.05 })
}
const collapsedBy = (w: DestructionWorld, first: DestructionEvent[][], seconds = 40): string[] => {
  const out = new Set<string>()
  for (const es of first) for (const e of es) if (e.type === 'collapse') e.parts.forEach((p) => out.add(p))
  for (let t = 0; t < seconds; t += 0.1) for (const e of w.update(0.1)) if (e.type === 'collapse') e.parts.forEach((p) => out.add(p))
  return [...out]
}

/** Losing one ground column of a frame: how many parts fall. */
const lossOfOne = (spec: DestructibleSpec) => {
  let worst = 0
  for (const c of spec.parts.filter((p) => /^column_0_/.test(p.id))) {
    const w = createDestruction()
    const id = w.add(spec)
    const hit = strike(w, id, spec, c.id)
    const fallen = collapsedBy(w, [hit.events])
    // the frame itself (columns, beams, slabs, roof) never comes down; at most the door jamb that rested on the lost column does
    expect(fallen.filter((f) => /^(column|beam|slab|roof|foundation)/.test(f)), `${spec.name} ${c.id}`).toEqual([])
    worst = Math.max(worst, fallen.length)
  }
  return worst
}

describe('losing one ground column of a sized frame', () => {
  const opts = [
    { floors: 2, columnsX: 4, columnsZ: 3, walls: true },
    { floors: 2, columnsX: 4, columnsZ: 3, walls: false },
    { floors: 3, columnsX: 3, columnsZ: 3, walls: true, roof: false },
  ]
  it('with redundancy 0.97 the frame stands (at most the door jamb on that column falls)', () => {
    for (const o of opts) expect(lossOfOne(sizeStructure(buildFrame(o), { safety: 0.65, redundancy: 0.97 }))).toBeLessThanOrEqual(2)
  })
  it('without redundancy at most the bays the column carried fall, never the building', () => {
    for (const o of opts) {
      const spec = sizeStructure(buildFrame(o), { safety: 0.65 })
      expect(lossOfOne(spec)).toBeLessThanOrEqual(Math.ceil(spec.parts.length * 0.1))
    }
  })
})

describe('structural parts that were never supported', () => {
  /** Four columns under a slab; an attic beam sits on a partition wall, and partitions do not bear: the attic has no support path from the start. */
  const house = (): DestructibleSpec => {
    const parts: DestructibleSpec['parts'] = []
    const joints: NonNullable<DestructibleSpec['joints']> = []
    const at: Array<[number, number]> = [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]
    at.forEach(([x, z], i) => {
      parts.push({ id: `f${i}`, material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [x, -0.15, z], structure: { role: 'foundation' } })
      parts.push({ id: `c${i}`, material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [x, 1.5, z], structure: { role: 'column' } })
      joints.push({ a: `c${i}`, b: `f${i}`, kind: 'rebar', bears: 'a_on_b' }, { a: 'slab', b: `c${i}`, kind: 'rebar', bears: 'a_on_b' })
    })
    parts.push({ id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4.2, 0.2, 4.2] }, position: [0, 3.1, 0], structure: { role: 'slab' } })
    parts.push({ id: 'pw', material: 'brick', shape: { kind: 'box', size: [2, 1, 0.2] }, position: [0, 3.7, 0], structure: { role: 'partition' } })
    parts.push({ id: 'attic', material: 'wood_soft', shape: { kind: 'box', size: [2, 0.2, 0.4] }, position: [0, 4.3, 0], structure: { role: 'beam' } })
    joints.push({ a: 'pw', b: 'slab', kind: 'mortar', bears: 'a_on_b' }, { a: 'attic', b: 'pw', kind: 'nail', bears: 'a_on_b' })
    return { parts, joints }
  }

  it('do not collapse when an unrelated column is lost (they never lost a support)', () => {
    const spec = house()
    const w = createDestruction()
    const id = w.add(spec)
    expect(w.state(id)!.groups.length).toBe(1)
    const hit = strike(w, id, spec, 'c0')
    expect(w.part(id, 'c0')!.status).toBe('broken')
    expect(collapsedBy(w, [hit.events])).toEqual([])
    expect(w.part(id, 'attic')!.status).not.toBe('collapsed')
    expect(w.part(id, 'slab')!.status).not.toBe('collapsed')
  })

  it('fall with what holds them up when that does collapse', () => {
    const spec = house()
    const w = createDestruction()
    const id = w.add(spec)
    const events: DestructionEvent[][] = []
    for (const c of ['c0', 'c1', 'c2', 'c3']) events.push(strike(w, id, spec, c).events)
    const fallen = collapsedBy(w, events)
    expect(fallen).toEqual(expect.arrayContaining(['slab', 'pw', 'attic']))
  })
})
