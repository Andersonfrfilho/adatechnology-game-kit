import { describe, expect, it } from 'vitest'
import { MATERIALS, bearingWallThickness, createDestruction } from '@adatechnology/game-destruction'

import { REBAR_RATIOS, buildStructure, toDestructibleSpec } from '../src'
import { WALL_THICKNESS } from '../src/geometry'
import { rectangularHouse } from './synthetic-plan'

/** Real structure of the houses (game-destruction `structure.flexure` and `structure.masonry`, design T10-estrutura-real.md). */
describe('real structure of the houses', () => {
  const structure = () => buildStructure(rectangularHouse({ width: 8, depth: 6 }), { wallDetail: 'coarse' })

  it('the spec stays the one the Visor de casas 3D describes unless rebar is asked for', () => {
    const spec = toDestructibleSpec(structure(), { wallDetail: 'coarse' })
    expect(spec.parts.some((p) => p.structure?.rebar)).toBe(false)
  })

  it('rebar: the concrete beams and slabs get their tension steel, sized so that they rest at safetyOthers and hold the loss of a bearing wall', () => {
    const spec = toDestructibleSpec(structure(), { wallDetail: 'coarse', rebar: true })
    const declared = spec.parts.filter((p) => p.structure?.rebar)
    expect(declared.length).toBeGreaterThan(0)
    for (const p of declared) {
      expect(p.material).toBe('concrete')
      expect(['beam', 'slab', 'roof', 'stair']).toContain(p.structure!.role)
      expect(p.structure!.rebar!.ratio).toBeGreaterThanOrEqual(REBAR_RATIOS[p.structure!.role as keyof typeof REBAR_RATIOS])
    }
    const world = createDestruction()
    const id = world.add(spec)
    for (const p of world.state(id)!.parts) if (p.flexure !== undefined) expect(p.flexure).toBeLessThanOrEqual(0.45 + 1e-6)
    // unsized it keeps the starting ratios
    const raw = toDestructibleSpec(structure(), { wallDetail: 'coarse', rebar: { slab: 0.003 }, sized: false })
    for (const p of raw.parts.filter((q) => q.structure?.role === 'slab' && q.structure.rebar)) expect(p.structure!.rebar!.ratio).toBe(0.003)
  })

  it('the bearing walls of the unframed masonry house are within what real brick carries for the storeys it builds unframed', () => {
    const brick = MATERIALS.find((m) => m.id === 'brick')!
    // a frame carries the building from three storeys up; two storeys of a house (2.8 m, floors of 11.5 kN per metre of wall) need the 14 cm minimum
    expect(bearingWallThickness({ storeys: 2, storeyHeight: 2.8, floorLoad: 11.5e3, material: brick })[0]!).toBeLessThanOrEqual(WALL_THICKNESS)
  })
})
