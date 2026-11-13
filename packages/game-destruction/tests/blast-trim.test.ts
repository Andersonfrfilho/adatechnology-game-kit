import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'

/** A P13 cylinder going off: 200 kJ, felt 14 m out. */
const P13_ENERGY = 200000
const P13_RADIUS = 14

/** A food tin as an item gives it: a thin steel shell with its two lids welded on, nothing of it carries anything (`structure.role` none). */
const tin = (): DestructibleSpec => ({
  name: 'tin',
  parts: [
    { id: 'shell', material: 'steel', shape: { kind: 'cylinder', radius: 0.037, height: 0.1 }, position: [0, 0.055, 0], thickness: 0.0002, mass: 0.4 },
    { id: 'lid_top', material: 'steel', shape: { kind: 'cylinder', radius: 0.037, height: 0.002 }, position: [0, 0.106, 0], thickness: 0.0002, mass: 0.02 },
    { id: 'lid_bottom', material: 'steel', shape: { kind: 'cylinder', radius: 0.037, height: 0.002 }, position: [0, 0.004, 0], thickness: 0.0002, mass: 0.02 },
  ],
  joints: [
    { id: 'weld_top', a: 'lid_top', b: 'shell', kind: 'weld' },
    { id: 'weld_bottom', a: 'lid_bottom', b: 'shell', kind: 'weld' },
  ],
})

/** A 10 m wall with a baseboard glued at each end: the baseboards are trim fixed on a part that carries. */
const wallWithBaseboards = (): DestructibleSpec => ({
  name: 'wall',
  parts: [
    { id: 'wall', material: 'brick', shape: { kind: 'box', size: [10, 2.4, 0.13] }, position: [0, 1.2, 0], thickness: 0.13, anchored: true, structure: { role: 'wall' } },
    { id: 'baseboard_near', material: 'wood_soft', shape: { kind: 'box', size: [1, 0.08, 0.015] }, position: [-4.5, 0.04, 0.073], thickness: 0.015 },
    { id: 'baseboard_far', material: 'wood_soft', shape: { kind: 'box', size: [1, 0.08, 0.015] }, position: [4.5, 0.04, 0.073], thickness: 0.015 },
  ],
  joints: [
    { id: 'glue_near', a: 'baseboard_near', b: 'wall', kind: 'glue' },
    { id: 'glue_far', a: 'baseboard_far', b: 'wall', kind: 'glue' },
  ],
})

describe('a blast on trim and on the seams of a loose thing', () => {
  // a P13 is 0.24 kg of TNT: at 2.5 m its wave is 100 kPa over a 70 cm2 tin, which pushes it (0.2 J), it does not tear it. The seams go within a metre, where the wave is a few MPa (about 20 J into the tin).
  it('a P13 going off 0.5 m from a tin still tears its welds: the seams of a loose thing are not trim fixed on a wall', () => {
    const world = createDestruction({ seed: 1 })
    const id = world.add(tin(), { id: 'tin', position: [0.5, 0, 0] })
    world.explode([0, 0.3, 0], P13_ENERGY, P13_RADIUS, 'test')
    const joints = world.state(id)!.joints
    expect(joints.filter((joint) => joint.open).map((joint) => joint.id).sort()).toEqual(['weld_bottom', 'weld_top'])
  })

  it('a blast at one end of a wall shakes loose the baseboard there, not the one at the other end', () => {
    const world = createDestruction({ seed: 1 })
    const id = world.add(wallWithBaseboards(), { id: 'wall' })
    world.explode([-4.5, 0.3, 0.6], 102400, 4, 'test')
    const joints = world.state(id)!.joints
    expect(joints.find((joint) => joint.id === 'glue_near')!.open).toBe(true)
    expect(joints.find((joint) => joint.id === 'glue_far')!.open).toBe(false)
  })
})
