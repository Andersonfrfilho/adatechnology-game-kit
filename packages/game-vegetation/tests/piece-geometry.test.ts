import { describe, expect, it } from 'vitest'
import { buildLot, generate, type Placement } from '../src'
import { createPlantObject, createVegetationMaterials } from '../src/three'
import * as THREE from 'three'
import { SAMPLES } from './samples'

describe('wood piece geometry', () => {
  it('mango trunk radius and length follow the species, not the AABB', () => {
    const spec = SAMPLES.broadleaf_spreading_fruit as { height: number; trunkRadius?: number }
    const trunkRadius = spec.trunkRadius ?? spec.height * 0.04
    const plant = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 4 })
    const trunk = plant.pieces.find((p) => p.id === 'trunk')!
    expect(trunk.radius!).toBeGreaterThan(trunkRadius * 0.7)
    expect(trunk.radius!).toBeLessThan(trunkRadius * 1.3)
    const trunkH = spec.height * 0.93
    expect(trunk.length!).toBeGreaterThan(trunkH * 0.6)
    expect(trunk.length!).toBeLessThan(trunkH * 1.15)
    expect(Math.hypot(...trunk.axis!)).toBeCloseTo(1, 5)
    expect(trunk.axis![1]).toBeGreaterThan(0.8)
    expect(trunk.base!.every(Number.isFinite)).toBe(true)
    // the AABB overestimates the thickness of the real trunk
    expect(trunk.bounds.max[0] - trunk.bounds.min[0]).toBeGreaterThan(trunk.radius! * 2)
  })

  it('is deterministic and scales with the plant', () => {
    const a = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 4 })
    const b = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 4 })
    expect(a.pieces.map((p) => [p.radius, p.length, p.axis, p.base])).toEqual(b.pieces.map((p) => [p.radius, p.length, p.axis, p.base]))
    const big = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 4, scale: 2 })
    expect(big.pieces.find((p) => p.id === 'trunk')!.radius!).toBeCloseTo(a.pieces.find((p) => p.id === 'trunk')!.radius! * 2, 5)
  })

  it('every trunk / branch / stem / arm / pad has geometry, other kinds none', () => {
    for (const [key, spec] of Object.entries(SAMPLES)) {
      const plant = generate(spec, { seed: 2 })
      for (const pc of plant.pieces) {
        const wood = ['trunk', 'branch', 'stem', 'arm', 'pad'].includes(pc.kind)
        if (wood && ['broadleaf_spreading_fruit', 'palm_coconut', 'cactus_paddle', 'banana'].includes(key)) {
          expect(pc.radius, `${key}/${pc.id}`).toBeGreaterThan(0)
          expect(pc.length, `${key}/${pc.id}`).toBeGreaterThan(0)
          expect(pc.axis, `${key}/${pc.id}`).toBeDefined()
        }
        if (!wood) expect(pc.radius).toBeUndefined()
      }
    }
  })

  it('pads: radius is half the thickness, length the pad height', () => {
    const plant = generate(SAMPLES.cactus_paddle, { seed: 2 })
    const pad = plant.pieces.find((p) => p.kind === 'pad')!
    expect(pad.length!).toBeGreaterThan(pad.radius! * 2)
  })

  it('reaches the lot pieceTable and userData.destructionPart', () => {
    const placements: Placement[] = [{ species: 'mango', x: 0, z: 0, ry: 0, scale: 1, seed: 1 }]
    const lot = buildLot(placements, () => SAMPLES.broadleaf_spreading_fruit, { seed: 4, quality: 'high' })
    const trunk = lot.pieceTable[0].pieces.find((p) => p.id === 'trunk')!
    expect(trunk.radius).toBeGreaterThan(0)
    const plant = generate(SAMPLES.broadleaf_spreading_fruit, { seed: 4 })
    const g = createPlantObject(THREE as never, plant, createVegetationMaterials(THREE as never), { separable: true })
    const m = g.children.find((c) => c.name === 'trunk')!
    expect(m.userData.destructionPart.radius).toBeGreaterThan(0)
    expect(m.userData.destructionPart.axis.length).toBe(3)
  })
})
