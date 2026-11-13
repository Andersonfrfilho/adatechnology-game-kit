import { describe, expect, it } from 'vitest'

import { GROUT_SPACING, STRUCTURAL_VIOLATION, applySlabPanels, moduleOf, getMasonryUnit, resolveSlabPanels, validateStructure } from '../src'
import { BEARING_CORE_REACH, beamBearings } from '../src/beam-bearings'
import { loadsAtRest } from '../src/loads'
import type { StructuredResult } from '../src'
import { engine } from './support'

const generate = (seed: number, options: Record<string, unknown> = {}) => engine.generate('single_storey_structural', { seed, state: 'normal', ...options }) as StructuredResult
// (the masonry laid on a door's lintel is part of the lintel's course, not a wall of its own)
const walls = (result: StructuredResult) => result.structure.parts.filter((p) => /^wall_/.test(p.id) && !result.structure.supports.some((s) => s.part === p.id && s.on.startsWith('lintel_')))

describe('structural masonry (NBR 16868): the walls are the structure', () => {
  it('is laid of the concrete block graded for it, every wall carries and no concrete pillar stands in a wall', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      expect(result.structure.construction.walls).toMatchObject({ unit: 'concrete_block_14_fbk6', masonrySystem: 'structural' })
      expect(walls(result).every((w) => w.role === 'wall')).toBe(true)
      expect(result.structure.parts.filter((p) => /^(column_|wall_column_|jamb_column_)/.test(p.id))).toEqual([])
      const framed = applySlabPanels({ parts: result.structure.parts, supports: result.structure.supports }, result.structure, resolveSlabPanels(true)!)
      expect(framed.parts.filter((p) => p.id.startsWith('pillar_')), `seed ${seed}: the slab's beams rest on the walls`).toEqual([])
    }
  })

  it('grouts a core at each end and corner, beside each window and at most every 1.6 m', () => {
    const result = generate(1)
    for (const wall of walls(result)) {
      const along = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1] ? [wall.aabb[0], wall.aabb[2]] : [wall.aabb[1], wall.aabb[3]]
      const grout = wall.grout ?? []
      expect(grout.length, wall.id).toBeGreaterThan(0)
      expect(Math.min(...grout) - along[0]!, wall.id).toBeLessThan(0.3)
      expect(along[1]! - Math.max(...grout), wall.id).toBeLessThan(0.3)
      for (let k = 1; k < grout.length; k++) expect(grout[k]! - grout[k - 1]!, wall.id).toBeLessThanOrEqual(GROUT_SPACING + 0.3)
      for (const o of result.structure.openings.filter((x) => x.wall === wall.id)) for (const side of [o.from, o.to]) expect(grout.some((g) => Math.abs(g - side) < 0.3), `${wall.id} ${o.id}`).toBe(true)
    }
  })

  it('lays the walls on the module of the block (20 cm), doors included', () => {
    const module = moduleOf(getMasonryUnit('concrete_block_14_fbk6'))
    expect(module).toBe(0.2)
    const result = generate(2)
    for (const wall of result.walls) for (const x of [wall.u0, wall.u1, wall.v0, wall.v1]) expect(Math.abs(x / module - Math.round(x / module)), `${x}`).toBeLessThan(0.02)
    for (const door of result.doors) expect(Math.abs((door.at - door.width / 2) / module - Math.round((door.at - door.width / 2) / module)), door.id).toBeLessThan(0.02)
  })

  it('passes its own validator (grout, slenderness, module, compression with the loads of game-load-path) and the walls carry the roof slab', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      expect(validateStructure(result.structure, { doors: result.doors }), `seed ${seed}`).toEqual([])
      const loads = loadsAtRest(result.structure.parts, result.structure.supports)
      expect(walls(result).every((w) => (loads.get(w.id) ?? 0) > w.mass), `seed ${seed}: every wall carries more than its own weight`).toBe(true)
    }
  })

  it('reports a wall left without grout, and refuses a block graded for sealing only', () => {
    const result = generate(1)
    const stripped = { ...result.structure, parts: result.structure.parts.map((p) => (p.id === 'wall_0_0' ? { ...p, grout: [] } : p)) }
    const codes = validateStructure(stripped, { doors: result.doors }).map((v) => v.code)
    expect(codes).toContain(STRUCTURAL_VIOLATION.CORNER_WITHOUT_PILLAR)
    expect(codes).toContain(STRUCTURAL_VIOLATION.OPENING_WITHOUT_GROUT)
    expect(() => generate(1, { masonryUnit: 'ceramic_block_14' })).toThrow(/graded/)
  })

  it('grouts a core under every beam of the slab that bears across a wall (NBR 16868, local bearing)', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      const framed = applySlabPanels({ parts: result.structure.parts, supports: result.structure.supports }, result.structure, resolveSlabPanels(true)!)
      const bearings = beamBearings([...framed.parts.filter((p) => p.role === 'beam'), ...walls(result)])
      expect(bearings.length, `seed ${seed}`).toBeGreaterThan(3)
      for (const { beam, wall, at } of bearings) expect((wall.grout ?? []).some((g) => Math.abs(g - at) <= BEARING_CORE_REACH), `seed ${seed}: ${beam.id} on ${wall.id} at ${at}`).toBe(true)
    }
  })

  it('reports a beam bearing on a wall with no grouted core under it', () => {
    const result = generate(1)
    const framed = applySlabPanels({ parts: result.structure.parts, supports: result.structure.supports }, result.structure, resolveSlabPanels(true)!)
    const { wall, at } = beamBearings([...framed.parts.filter((p) => p.role === 'beam'), ...walls(result)])[0]!
    const stripped = { ...result.structure, parts: result.structure.parts.map((p) => (p.id === wall.id ? { ...p, grout: (p.grout ?? []).filter((g) => Math.abs(g - at) > BEARING_CORE_REACH) } : p)) }
    expect(validateStructure(stripped, { doors: result.doors }).map((v) => v.code)).toContain(STRUCTURAL_VIOLATION.CONCENTRATED_LOAD_WITHOUT_GROUT)
  })

  it('reports masonry past its design strength: the piers of this plan in the 4 MPa block (N_d = 1.4 N_k over f_d A R)', () => {
    const result = generate(1, { masonryUnit: 'concrete_block_14' })
    const over = validateStructure(result.structure, { doors: result.doors }).filter((v) => v.code === STRUCTURAL_VIOLATION.MASONRY_OVERSTRESSED)
    expect(over.map((v) => v.part)).toContain('wall_0_12')
  })

  it('reports a wall too slender, a wall off the module and a concrete pillar standing in a structural wall', () => {
    const result = generate(1)
    const codesOf = (parts: typeof result.structure.parts): string[] => validateStructure({ ...result.structure, parts }, { doors: result.doors }).map((v) => v.code)
    // h/t of a 14 cm block past 24: a wall 3.5 m tall
    expect(codesOf(result.structure.parts.map((p) => (p.id === 'wall_0_0' ? { ...p, y1: p.y0 + 3.5 } : p)))).toContain(STRUCTURAL_VIOLATION.WALL_TOO_SLENDER)
    // an end 7 cm off the 20 cm module
    expect(codesOf(result.structure.parts.map((p) => (p.id === 'wall_0_0' ? { ...p, aabb: [p.aabb[0], p.aabb[1], p.aabb[2] + 0.07, p.aabb[3]] as typeof p.aabb } : p)))).toContain(STRUCTURAL_VIOLATION.OFF_MODULE)
    const wall = result.structure.parts.find((p) => p.id === 'wall_0_0')!
    const [u0, v0, u1, v1] = wall.aabb
    const pillar = { ...wall, id: 'wall_column_0_99', role: 'column' as const, material: 'concrete' as const, aabb: [(u0 + u1) / 2 - 0.07, v0, (u0 + u1) / 2 + 0.07, v1] as typeof wall.aabb, grout: undefined }
    expect(codesOf([...result.structure.parts, pillar])).toContain(STRUCTURAL_VIOLATION.PILLAR_IN_STRUCTURAL_WALL)
  })
})
