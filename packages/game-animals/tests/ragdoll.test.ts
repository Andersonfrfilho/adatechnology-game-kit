import { describe, expect, it } from 'vitest'

import { anatomyOf, chainOfAnimal, corpseBodyKitOfAnimal, ragdollOfAnimal } from '../src'
import type { QuadrupedSpec } from '../src'

const dog: QuadrupedSpec = {
  kind: 'quadruped',
  L: 0.62,
  R: 0.12,
  sx: 0.95,
  sy: 1.05,
  span: 0.72,
  prof: [0.45, 0.85, 0.95, 0.9, 0.88, 1, 1.05, 0.9, 0.55],
  c: { main: 0xb07a3e, belly: 0xd8b07a, dark: 0x2a1c12, nose: 0x161010 },
  leg: { fu: 0.21, fl: 0.22, hu: 0.22, hl: 0.24, r: 0.04 },
  neck: { len: 0.12, r: 0.07, r2: 0.06, ang: 0.95 },
  head: { r: 0.085, s: [1, 0.95, 1.08], sl: 0.11, sr1: 0.05, sr2: 0.04, down: 0.15, sy: -0.15 },
  ears: { t: 'cone', s: 0.06, tilt: 0.35, fwd: 0.3 },
  tail: { n: 3, len: 0.26, r: 0.02, ang: 2.1, curl: -0.25 },
}

const totalMass = (parts: readonly { body: { mass?: number } }[]): number => parts.reduce((sum, part) => sum + (part.body.mass ?? 0), 0)

describe('ragdollOfAnimal (R0)', () => {
  const { parts } = ragdollOfAnimal({ body: dog, user: 3 })

  it('has trunk, neck, head and two bones for each of the four legs, parents first, every part but the trunk on a joint', () => {
    expect(parts).toHaveLength(11)
    parts.forEach((part, index) => {
      expect(part.parent).toBeLessThan(index)
      expect(part.joint !== undefined).toBe(index > 0)
    })
  })

  it('weighs what a dog weighs (kg) and tags each body with `user * 32 + index`', () => {
    expect(totalMass(parts)).toBeGreaterThan(8)
    expect(totalMass(parts)).toBeLessThan(40)
    expect(parts.map((part) => part.body.user)).toEqual(parts.map((_, index) => 3 * 32 + index))
  })

  it('stands on the ground at `at` and moves with it', () => {
    const moved = ragdollOfAnimal({ body: dog, at: [5, 2, -1] }).parts
    parts.forEach((part, index) => {
      const target = moved[index]?.body.position
      expect(target?.[0]).toBeCloseTo(part.body.position[0] + 5)
      expect(target?.[1]).toBeCloseTo(part.body.position[1] + 2)
      expect(target?.[2]).toBeCloseTo(part.body.position[2] - 1)
    })
  })

  it('bends the front and hind legs the way the page draws them: hinges with the foot going backward (+)', () => {
    const hinges = parts.flatMap((part) => (part.joint?.kind === 'hinge' ? [part.joint] : []))
    expect(hinges).toHaveLength(4)
    for (const hinge of hinges) {
      expect(hinge.max).toBeGreaterThan(1.5)
      expect(hinge.min).toBeLessThanOrEqual(0)
    }
  })
})

describe('chainOfAnimal (R1)', () => {
  const chain = chainOfAnimal({ body: dog }).parts
  const full = ragdollOfAnimal({ body: dog }).parts

  it('has the trunk, the head and the legs on two joints, and the same total mass as the ragdoll', () => {
    expect(chain).toHaveLength(3)
    expect(chain.filter((part) => part.joint).length).toBe(2)
    expect(totalMass(chain)).toBeCloseTo(totalMass(full), 6)
  })
})

describe('anatomyOf', () => {
  it('puts the feet on the ground and the head in front of and above the shoulders', () => {
    const anatomy = anatomyOf(dog)
    for (const leg of anatomy.legs) expect(Math.abs(leg.lower.end[1])).toBeLessThan(0.01)
    expect(anatomy.head.end[2]).toBeGreaterThan(anatomy.trunk.end[2])
    expect(anatomy.neck.end[1]).toBeGreaterThan(anatomy.trunk.start[1])
  })
})

describe('corpseBodyKitOfAnimal', () => {
  const kit = corpseBodyKitOfAnimal({ body: dog })

  it('ties the rungs: the anchors name parts of the ragdoll, the capsule weighs the chain and covers the body from the tail to the head', () => {
    expect(kit.ragdoll.parts).toHaveLength(11)
    for (const index of [kit.anchors.torso, kit.anchors.head, ...kit.anchors.legs]) expect(kit.ragdoll.parts[index]).toBeDefined()
    expect(kit.capsule.mass).toBeCloseTo(totalMass(kit.chain.parts), 6)
    const anatomy = anatomyOf(dog)
    expect(kit.capsule.shape.kind).toBe('capsule')
    if (kit.capsule.shape.kind === 'capsule') expect(kit.capsule.shape.halfHeight * 2 + kit.capsule.shape.radius * 2).toBeGreaterThanOrEqual(anatomy.head.end[2] - anatomy.trunk.start[2] - 1e-9)
  })
})
