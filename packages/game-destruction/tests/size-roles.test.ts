import { describe, expect, it } from 'vitest'
import { createDestruction, sizeStructure } from '../src'
import type { DestructibleSpec, JointSpec, PartSpec } from '../src'

/** A slab on one column and three bearing walls, with a roof. */
const mixed = (): DestructibleSpec => {
  const parts: PartSpec[] = [
    { id: 'f0', material: 'concrete', shape: { kind: 'box', size: [0.8, 0.3, 0.8] }, position: [-1.5, -0.15, -1.5], structure: { role: 'foundation' } },
    { id: 'f1', material: 'concrete', shape: { kind: 'box', size: [4, 0.3, 0.5] }, position: [0, -0.15, 1.5], structure: { role: 'foundation' } },
    { id: 'c0', material: 'concrete', shape: { kind: 'box', size: [0.3, 3, 0.3] }, position: [-1.5, 1.5, -1.5], structure: { role: 'column' } },
    { id: 'wall_a', material: 'brick', shape: { kind: 'box', size: [1.1, 3, 0.2] }, position: [-0.6, 1.5, 1.5], structure: { role: 'wall' } },
    { id: 'wall_b', material: 'brick', shape: { kind: 'box', size: [1.1, 3, 0.2] }, position: [0.6, 1.5, 1.5], structure: { role: 'wall' } },
    { id: 'wall_c', material: 'brick', shape: { kind: 'box', size: [1.1, 3, 0.2] }, position: [1.8, 1.5, 1.5], structure: { role: 'wall' } },
    // reinforced at the minimum ratio of NBR 6118: sizeStructure adds the steel it needs in bending
    { id: 'slab', material: 'concrete', shape: { kind: 'box', size: [4, 0.2, 4] }, position: [0, 3.1, 0], structure: { role: 'slab', rebar: { ratio: 0.0015 } } },
    { id: 'roof', material: 'wood_soft', shape: { kind: 'box', size: [4.2, 0.1, 4.2] }, position: [0, 3.25, 0], structure: { role: 'roof' } },
  ]
  const joints: JointSpec[] = [
    { a: 'c0', b: 'f0', kind: 'rebar', bears: 'a_on_b' },
    ...['wall_a', 'wall_b', 'wall_c'].map((id) => ({ a: id, b: 'f1', kind: 'mortar' as const, bears: 'a_on_b' as const })),
    ...['c0', 'wall_a', 'wall_b', 'wall_c'].map((id) => ({ a: 'slab', b: id, kind: 'mortar' as const, bears: 'a_on_b' as const })),
    { a: 'roof', b: 'slab', kind: 'screw', bears: 'a_on_b' },
  ]
  return { parts, joints }
}

const stressAfterLosing = (spec: DestructibleSpec, lost: string): Map<string, number> => {
  const reduced: DestructibleSpec = { ...spec, parts: spec.parts.filter((p) => p.id !== lost), joints: spec.joints!.filter((j) => j.a !== lost && j.b !== lost) }
  const world = createDestruction()
  const id = world.add(reduced)
  return new Map(world.state(id)!.parts.map((p) => [p.id, p.stress ?? 0]))
}

describe('sizeStructure roles', () => {
  it('safetyByRole sets the at-rest stress of those roles and leaves the others at safety', () => {
    const sized = sizeStructure(mixed(), { safety: 0.65, safetyByRole: { slab: 0.45, roof: 0.45 } })
    const world = createDestruction()
    const id = world.add(sized)
    const stress = (part: string) => world.part(id, part)!.stress!
    expect(stress('slab')).toBeCloseTo(0.45, 6)
    expect(stress('roof')).toBeCloseTo(0.45, 6)
    expect(stress('c0')).toBeCloseTo(0.65, 6)
    expect(stress('wall_a')).toBeCloseTo(0.65, 6)
  })

  it('the redundancy check removes columns only by default, so losing a bearing wall overloads the rest', () => {
    const sized = sizeStructure(mixed(), { safety: 0.85, redundancy: 0.97 })
    expect(Math.max(...stressAfterLosing(sized, 'wall_a').values())).toBeGreaterThan(0.97 + 1e-6)
    expect(Math.max(...stressAfterLosing(sized, 'c0').values())).toBeLessThanOrEqual(0.97 + 1e-9)
  })

  it('redundancyRoles adds walls: the structure then stands with any one column or bearing wall gone', () => {
    const sized = sizeStructure(mixed(), { safety: 0.85, redundancy: 0.97, redundancyRoles: ['column', 'wall'] })
    for (const lost of ['c0', 'wall_a', 'wall_b', 'wall_c']) expect(Math.max(...stressAfterLosing(sized, lost).values())).toBeLessThanOrEqual(0.97 + 1e-9)
  })

  it('does not change the default sizing', () => {
    const a = sizeStructure(mixed(), { redundancy: 0.97 })
    const b = sizeStructure(mixed(), { redundancy: 0.97, redundancyRoles: ['column'] })
    expect(a).toEqual(b)
  })
})
