import { describe, expect, it } from 'vitest'

import { GROUT_SPACING, SAME_CELL, STRUCTURAL_VIOLATION, applySlabPanels, coresAlong, doubledCores, groutCores, moduleOf, getMasonryUnit, resolveSlabPanels, validateStructure } from '../src'
import { BEARING_CORE_REACH, beamBearings } from '../src/beam-bearings'
import { loadsAtRest } from '../src/loads'
import type { StructuredResult, StructurePart } from '../src'
import { engine } from './support'

const generate = (seed: number, options: Record<string, unknown> = {}) => engine.generate('single_storey_structural', { seed, state: 'normal', ...options }) as StructuredResult
// (the masonry laid on a door's lintel is part of the lintel's course, not a wall of its own)
const walls = (result: StructuredResult) => result.structure.parts.filter((p) => /^wall_/.test(p.id) && !result.structure.supports.some((s) => s.part === p.id && s.on.startsWith('lintel_')))
const validate = (result: StructuredResult, parts: StructurePart[] = result.structure.parts) => validateStructure({ ...result.structure, parts }, { doors: result.doors, rooms: result.rooms })

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

  it('grouts a core at each end and corner, beside each window and at most every 1.6 m (its own cores and the one it shares at a corner)', () => {
    const result = generate(1)
    const all = walls(result)
    for (const wall of all) {
      const along = wall.aabb[2] - wall.aabb[0] >= wall.aabb[3] - wall.aabb[1] ? [wall.aabb[0], wall.aabb[2]] : [wall.aabb[1], wall.aabb[3]]
      const grout = coresAlong(wall, all)
      expect(grout.length, wall.id).toBeGreaterThan(0)
      expect(Math.min(...grout) - along[0]!, wall.id).toBeLessThan(0.3)
      expect(along[1]! - Math.max(...grout), wall.id).toBeLessThan(0.3)
      for (let k = 1; k < grout.length; k++) expect(grout[k]! - grout[k - 1]!, wall.id).toBeLessThanOrEqual(GROUT_SPACING + 0.3)
    }
  })

  it('lays the walls on the module of the block (20 cm), doors included: jambs on the module, heads and lintels on the 20 cm courses', () => {
    const module = moduleOf(getMasonryUnit('concrete_block_14_fbk6'))
    expect(module).toBe(0.2)
    const onGrid = (x: number, step: number): boolean => Math.abs(x / step - Math.round(x / step)) < 0.02
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      for (const wall of result.walls) for (const x of [wall.u0, wall.u1, wall.v0, wall.v1]) expect(onGrid(x, module), `${x}`).toBe(true)
      for (const door of result.doors) expect(onGrid(door.at - door.width / 2, module), door.id).toBe(true)
      const doors = result.structure.openings.filter((o) => o.kind === 'door')
      expect(doors.length, `seed ${seed}`).toBe(result.doors.length)
      for (const door of doors) {
        // the head at 2.20 m (11 courses of 20 cm), the lintel a course of channel blocks over it
        expect(door.y1, door.id).toBeCloseTo(2.2, 6)
        const lintel = result.structure.parts.find((p) => p.id === `lintel_${door.id}`)!
        expect(lintel.y0, door.id).toBeCloseTo(door.y1, 6)
        expect(onGrid(lintel.y1 - lintel.y0, 0.2), door.id).toBe(true)
      }
    }
    // a door lintel off the courses (the confined masonry's 2.10 m)
    const result = generate(1)
    const parts = result.structure.parts.map((p) => (p.id === 'lintel_d0_0' ? { ...p, y0: 2.1, y1: 2.3 } : p))
    expect(validate(result, parts).filter((v) => v.code === STRUCTURAL_VIOLATION.OFF_MODULE).map((v) => v.part)).toContain('lintel_d0_0')
  })

  it('grouts the first cell at a free end and a door jamb, not 30 cm in (5)', () => {
    const result = generate(1)
    // wall_0_0 ends at the front door's jamb at 5.0 m: its core in the first cell, 10 cm in; moved 30 cm in, the end is left without
    const front = result.structure.parts.find((p) => p.id === 'wall_0_0')!
    expect(front.grout).toContain(4.9)
    const moved = result.structure.parts.map((p) => (p.id === 'wall_0_0' ? { ...p, grout: (p.grout ?? []).map((g) => (g === 4.9 ? 4.7 : g)) } : p))
    expect(validate(result, moved).map((v) => v.code)).toContain(STRUCTURAL_VIOLATION.WALL_END_WITHOUT_PILLAR)
  })

  it('runs the bond beam over the whole length of every bearing wall (3)', () => {
    const result = generate(1)
    // the bond beam of the right wall cut back 1.1 m from the front corner: wall_0_9 is left without it there
    const parts = result.structure.parts.map((p) => (p.id === 'plate_0_3' ? { ...p, aabb: [p.aabb[0], p.aabb[1] + 1.1, p.aabb[2], p.aabb[3]] as typeof p.aabb } : p))
    const found = validate(result, parts).filter((v) => v.code === STRUCTURAL_VIOLATION.BOND_BEAM_NOT_CONTINUOUS)
    expect(found.map((v) => v.part)).toContain('wall_0_9')
  })

  it('passes its own validator (grout, steel, coordination, slenderness, piers in compression with the loads of NBR 6120) and the walls carry the roof slab', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      expect(validate(result), `seed ${seed}`).toEqual([])
      const loads = loadsAtRest(result.structure.parts, result.structure.supports)
      expect(walls(result).every((w) => (loads.get(w.id) ?? 0) > w.mass), `seed ${seed}: every wall carries more than its own weight`).toBe(true)
    }
  })

  it('reports a wall left without grout, and refuses a block graded for sealing only', () => {
    const result = generate(1)
    // every core of the corner of wall_0_0 and wall_0_7 gone (each corner is grouted once, by one of the two walls)
    const codes = validate(result, result.structure.parts.map((p) => (p.id === 'wall_0_0' || p.id === 'wall_0_7' ? { ...p, grout: [] } : p))).map((v) => v.code)
    expect(codes).toContain(STRUCTURAL_VIOLATION.CORNER_WITHOUT_PILLAR)
    expect(codes).toContain(STRUCTURAL_VIOLATION.OPENING_WITHOUT_GROUT)
    expect(() => generate(1, { masonryUnit: 'ceramic_block_14' })).toThrow(/graded/)
  })

  it('grouts a core under every beam of the slab that bears across a wall (NBR 16868, local bearing)', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      const framed = applySlabPanels({ parts: result.structure.parts, supports: result.structure.supports }, result.structure, resolveSlabPanels(true)!)
      const all = walls(result)
      const bearings = beamBearings([...framed.parts.filter((p) => p.role === 'beam'), ...all])
      expect(bearings.length, `seed ${seed}`).toBeGreaterThan(3)
      for (const { beam, wall, at } of bearings) expect(coresAlong(wall, all).some((g) => Math.abs(g - at) <= BEARING_CORE_REACH), `seed ${seed}: ${beam.id} on ${wall.id} at ${at}`).toBe(true)
    }
  })

  it('reports a beam bearing on a wall with no grouted core under it', () => {
    const result = generate(1)
    const framed = applySlabPanels({ parts: result.structure.parts, supports: result.structure.supports }, result.structure, resolveSlabPanels(true)!)
    const all = walls(result)
    const bearing = beamBearings([...framed.parts.filter((p) => p.role === 'beam'), ...all]).find((b) => (b.wall.grout ?? []).some((g) => Math.abs(g - b.at) <= BEARING_CORE_REACH))!
    const stripped = result.structure.parts.map((p) => (p.id === bearing.wall.id ? { ...p, grout: (p.grout ?? []).filter((g) => Math.abs(g - bearing.at) > BEARING_CORE_REACH) } : p))
    expect(validate(result, stripped).map((v) => v.code)).toContain(STRUCTURAL_VIOLATION.CONCENTRATED_LOAD_WITHOUT_GROUT)
  })

  it('reports masonry past its design strength: the 20 cm stub of this plan in the 4 MPa block', () => {
    const result = generate(1, { masonryUnit: 'concrete_block_14' })
    const over = validate(result).filter((v) => v.code === STRUCTURAL_VIOLATION.MASONRY_OVERSTRESSED)
    // the stub between the bathroom door and the T with wall_0_18 (with 0.84 m of that wall as flange) takes the roof, the ceiling slab, the bond beam
    // and the door's lintel: (N_d / A R + M_d / 1.5 W) / f_d about 1.4 with f_d = 0.98 MPa, about 0.93 with the 6 MPa block of the typology
    expect(over.map((v) => v.part)).toEqual(['wall_0_5'])
    expect(over[0]!.message).toMatch(/pier 9\.00-9\.20 m/)
  })

  it('reports a wall too slender, a wall off the module and a concrete pillar standing in a structural wall', () => {
    const result = generate(1)
    const codesOf = (parts: StructurePart[]): string[] => validate(result, parts).map((v) => v.code)
    // λ of a 14 cm block past 24: a wall 3.5 m tall, braced at the top (h_ef = h): 3.5 / 0.14 = 25
    expect(codesOf(result.structure.parts.map((p) => (p.id === 'wall_0_9' ? { ...p, y1: p.y0 + 3.5 } : p)))).toContain(STRUCTURAL_VIOLATION.WALL_TOO_SLENDER)
    // an end 7 cm off the 20 cm module
    expect(codesOf(result.structure.parts.map((p) => (p.id === 'wall_0_0' ? { ...p, aabb: [p.aabb[0], p.aabb[1], p.aabb[2] + 0.07, p.aabb[3]] as typeof p.aabb } : p)))).toContain(STRUCTURAL_VIOLATION.OFF_MODULE)
    const wall = result.structure.parts.find((p) => p.id === 'wall_0_0')!
    const [u0, v0, u1, v1] = wall.aabb
    const pillar = { ...wall, id: 'wall_column_0_99', role: 'column' as const, material: 'concrete' as const, aabb: [(u0 + u1) / 2 - 0.07, v0, (u0 + u1) / 2 + 0.07, v1] as typeof wall.aabb, grout: undefined }
    expect(codesOf([...result.structure.parts, pillar])).toContain(STRUCTURAL_VIOLATION.PILLAR_IN_STRUCTURAL_WALL)
  })

  it('grouts each corner and junction once: no two cores in the same cell (8)', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      const all = walls(result)
      expect(doubledCores(all), `seed ${seed}`).toEqual([])
      // the corner of the front and left walls, at the crossing of their centre lines: one core there, of one wall
      const at = groutCores(all).filter((c) => Math.hypot(c.point[0], c.point[1]) < SAME_CELL)
      expect(at.length, `seed ${seed}`).toBe(1)
    }
    const result = generate(1)
    const doubled = result.structure.parts.map((p) => (p.id === 'wall_0_7' ? { ...p, grout: [0.05, ...(p.grout ?? [])] } : p))
    expect(validate(result, doubled).map((v) => v.code)).toContain(STRUCTURAL_VIOLATION.GROUT_CORE_DOUBLED)
  })
})
