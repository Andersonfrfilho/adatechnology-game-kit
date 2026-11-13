import { describe, expect, it } from 'vitest'

import { STRUCTURAL_VIOLATION, applySlabPanels, coresAlong, getMasonryUnit, registerMasonryUnit, resolveSlabPanels, validateStructure } from '../src'
import type { StructuredResult, StructurePart } from '../src'
import {
  GROUT_BAR, barArea, cellArea, designStrength, eccentricityFactor, effectiveHeight, grossArea, MAX_STEEL_IN_CELL, netArea, netStrength, slendernessOf, slendernessReduction, topEccentricity,
} from '../src/structural-masonry/design'
import { CEILING_SLAB_LIVE_LOAD, liveLoadOf, liveLoads } from '../src/structural-masonry/live-loads'
import { pierDesigns } from '../src/validate/structural-masonry-strength'
import { applyPanels } from '../src/wall-detail'
import { engine } from './support'

const generate = (seed: number, options: Record<string, unknown> = {}) => engine.generate('single_storey_structural', { seed, state: 'normal', ...options }) as StructuredResult
const bearing = (result: StructuredResult) => result.structure.parts.filter((p) => /^wall_/.test(p.id) && p.grout !== undefined)
const codesOf = (result: StructuredResult, structure: StructuredResult['structure'] = result.structure): string[] => validateStructure(structure, { doors: result.doors, rooms: result.rooms }).map((v) => v.code)
const designsOf = (result: StructuredResult, unitId = 'concrete_block_14_fbk6') => {
  const { structure } = result
  const framed = applySlabPanels(applyPanels({ parts: structure.parts, supports: structure.supports }, structure, 'panels'), structure, resolveSlabPanels(true)!)
  return pierDesigns({ structure, framed, rooms: result.rooms, unit: getMasonryUnit(unitId), walls: bearing(result) })
}
const BLOCK = getMasonryUnit('concrete_block_14_fbk6')

describe('structural masonry by NBR 16868-1: what it needs instead of the pillars of confined masonry (1)', () => {
  it('stands with no concrete pillar and no bond beam on pillars, on a foundation, with a bond beam course on every bearing wall', () => {
    const result = generate(1)
    const codes = codesOf(result)
    for (const code of ['PILLAR_DOES_NOT_REACH_BOND_BEAM', 'MISSING_GROUND_BEAM', 'MISSING_BOND_BEAM', 'JUNCTION_NOT_INTERLOCKED', 'MISSING_CHANNEL_UNIT']) expect(codes).not.toContain(code)
    // the wall on the soil, with no strip footing under it
    const onSoil = { ...result.structure, supports: result.structure.supports.map((s) => (s.part === 'wall_0_9' ? { ...s, on: 'ground' } : s)) }
    expect(codesOf(result, onSoil)).toContain(STRUCTURAL_VIOLATION.MISSING_GROUND_BEAM)
    // the bond beam course taken off one wall
    const bare = { ...result.structure, supports: result.structure.supports.filter((s) => !(s.on === 'wall_0_9' && s.part.startsWith('plate_'))) }
    expect(codesOf(result, bare)).toContain(STRUCTURAL_VIOLATION.MISSING_BOND_BEAM)
  })

  it('interlocks every corner and T: the bond beams of the two walls tie over it', () => {
    const result = generate(1)
    // the bond beam of the left wall stopped 30 cm short of the front one: the corner is no longer tied
    const parts = result.structure.parts.map((p) => (p.id === 'plate_0_2' ? { ...p, aabb: [p.aabb[0], p.aabb[1] + 0.3, p.aabb[2], p.aabb[3]] as typeof p.aabb } : p))
    expect(codesOf(result, { ...result.structure, parts })).toContain(STRUCTURAL_VIOLATION.JUNCTION_NOT_INTERLOCKED)
  })

  it('needs a channel unit for its reinforced courses', () => {
    const { channel: _channel, ...withoutChannel } = BLOCK
    registerMasonryUnit({ ...withoutChannel, id: 'test_block_14_no_channel' })
    expect(codesOf(generate(1, { masonryUnit: 'test_block_14_no_channel' }))).toContain(STRUCTURAL_VIOLATION.MISSING_CHANNEL_UNIT)
  })
})

describe('compression on the gross area (2)', () => {
  it('reads f_bk and f_pk on the gross area: f_d = 0.7 x 0.7 x 6 / 2 = 1.47 MPa, and the net area check gives the same ratio', () => {
    expect(designStrength(BLOCK) / 1e6).toBeCloseTo(1.47, 6)
    // one metre of pier under N_d = 150 kN: 150e3 / (1 x 0.14) = 1.07 MPa on the gross area, under 1.47
    const load = 150e3
    expect(load / grossArea(1, BLOCK) / 1e6).toBeCloseTo(1.071, 3)
    expect(load / grossArea(1, BLOCK)).toBeLessThan(designStrength(BLOCK))
    // on the net area (half of it solid) the stress doubles and so does the strength of what is solid: same ratio, the same verdict
    expect(netArea(1, BLOCK)).toBeCloseTo(0.07, 9)
    expect(netStrength(BLOCK)).toBe(12)
    expect(load / netArea(1, BLOCK) / (designStrength(BLOCK) / BLOCK.solid)).toBeCloseTo(load / grossArea(1, BLOCK) / designStrength(BLOCK), 9)
    // the old check put the stress on the net area against the gross strength: 2.14 MPa over 1.47, twice too strict
    expect(load / netArea(1, BLOCK)).toBeGreaterThan(designStrength(BLOCK))
  })
})

describe('pier by pier (3)', () => {
  it('cuts each wall at its windows and loads each pier by the load path', () => {
    const designs = designsOf(generate(1))
    const front = designs.filter((d) => d.wall === 'wall_0_0')
    // (along the centre line: the front wall runs from the corner at 0 to its door jamb at 5.0, half its 17 cm off the jamb's face)
    expect(front.length).toBe(2)
    for (const [d, [from, to]] of front.map((x, k) => [x, [[0, 1.8], [3, 5]][k]!] as const)) {
      expect(d.from).toBeCloseTo(from!, 1)
      expect(d.to).toBeCloseTo(to!, 1)
    }
    for (const d of designs) expect(d.topLoad, `${d.wall} ${d.from}`).toBeGreaterThan(0)
  })

  it('catches a narrow pier the whole wall would hide: wall_0_13 in the 4 MPa block', () => {
    const designs = designsOf(generate(1, { masonryUnit: 'concrete_block_14' }), 'concrete_block_14').filter((d) => d.wall === 'wall_0_13')
    const pier = designs.find((d) => Math.abs(d.from - 1.41) < 0.01)!
    // alone between the back door and the kitchen window, 0.59 m x 0.14 m = 0.083 m² at f_d = 0.98 MPa x Φ 0.89: about 72 kN, under some 97 kN of design load
    expect(pier.flange).toBe(0)
    expect(pier.topLoad).toBeGreaterThan(pier.topResistance)
    // the wall's two piers summed would pass
    const sum = (key: 'topLoad' | 'topResistance'): number => designs.reduce((total, d) => total + d[key], 0)
    expect(sum('topLoad')).toBeLessThan(sum('topResistance'))
  })

  it('lets a pier at a corner or a T work with the walls interlocked into it, up to 6 t each side', () => {
    const stub = designsOf(generate(1)).find((d) => d.wall === 'wall_0_5')!
    // the 20 cm stub between the bathroom door and the T with wall_0_18: 6 x 0.14 = 0.84 m of wall_0_18 each side of the junction, cut at its end
    expect(stub.to - stub.from).toBeCloseTo(0.2, 1)
    expect(stub.flange).toBeGreaterThan(0.8)
    expect(stub.topLoad).toBeLessThan(stub.topResistance)
  })
})

describe('live loads of NBR 6120 and the eccentricity of the slab (4)', () => {
  it('loads each slab by the use of the rooms over it, a ceiling slab by maintenance, and puts a tank\'s water on what it stands on', () => {
    expect([liveLoadOf('bedroom'), liveLoadOf('living'), liveLoadOf('bathroom'), liveLoadOf('laundry'), liveLoadOf('stairs'), liveLoadOf('garage')]).toEqual([1.5, 1.5, 1.5, 2, 2.5, 3])
    const floor: StructurePart = { id: 'slab_1', role: 'slab', material: 'concrete', aabb: [0, 0, 4, 3], y0: 2.68, y1: 2.8, floor: 1, mass: 3456 }
    const ceiling: StructurePart = { ...floor, id: 'slab_ceiling', y0: 5.48, y1: 5.6 }
    const tank: StructurePart = { ...floor, id: 'water_tank', role: 'none', liters: 500, y0: 5.6, y1: 6.2 }
    // a 3 x 4 bedroom over the first floor slab: 1.5 x 12 = 18 kN = 1835 kg; the ceiling slab, 0.5 x 12 = 6 kN = 612 kg, and the 500 L of water on it
    const loads = liveLoads([floor, ceiling, tank], [{ part: 'water_tank', on: 'slab_ceiling', joint: 'resting' }], { rooms: [{ type: 'bedroom', floor: 1, parts: [[0, 0, 4, 3]] }], levels: [0, 2.8] })
    expect(loads.get('slab_1')).toBeCloseTo((18 * 1000) / 9.81, 6)
    expect(loads.get('slab_ceiling')).toBeCloseTo((CEILING_SLAB_LIVE_LOAD * 12 * 1000) / 9.81 + 500, 6)
  })

  it('takes a slab bearing on one face t/6 off the axis, h_ef / 450 more, at least 0.05 t: Φ = 1 - 2 e / t', () => {
    // exterior wall, 14 cm, h_ef 2.6 m, all the top load from a slab on one side: e = 0.14 / 6 + 2.6 / 450 = 0.0291 m, Φ = 1 - 2 x 0.0291 / 0.14 = 0.584
    const e = topEccentricity({ thickness: 0.14, effective: 2.6, oneSidedShare: 1 })
    expect(e).toBeCloseTo(0.14 / 6 + 2.6 / 450, 9)
    expect(eccentricityFactor(e, 0.14)).toBeCloseTo(0.584, 3)
    // slabs on both faces cancel: e = max(2.6 / 450, 0.05 x 0.14) = 0.007 m, Φ = 0.9
    expect(eccentricityFactor(topEccentricity({ thickness: 0.14, effective: 2.6, oneSidedShare: 0 }), 0.14)).toBeCloseTo(0.9, 9)
    // in the house the exterior walls, under the slab on one face, take more of it than the interior ones, under slabs on both
    const designs = designsOf(generate(1))
    const exterior = designs.find((d) => d.wall === 'wall_0_9')!
    const interior = designs.find((d) => d.wall === 'wall_0_4')!
    expect(exterior.eccentricity).toBeLessThan(interior.eccentricity)
  })
})

describe('steel in the grout (5)', () => {
  it('puts a Ø 12.5 mm bar in every core: 1.23 cm² in a 136.5 cm² cell, 0.9 % of it, from Ø 10 mm and up to 8 %', () => {
    const result = generate(1)
    expect(result.structure.construction.walls.groutBar).toBe(GROUT_BAR)
    expect(cellArea(BLOCK) * 1e4).toBeCloseTo(136.5, 6)
    expect(barArea(GROUT_BAR) * 1e4).toBeCloseTo(1.227, 3)
    expect(barArea(GROUT_BAR) / cellArea(BLOCK)).toBeLessThan(MAX_STEEL_IN_CELL)
    const withBar = (bar: number | undefined) => {
      const { groutBar: _groutBar, ...rest } = result.structure.construction.walls
      return { ...result.structure, construction: { ...result.structure.construction, walls: bar === undefined ? rest : { ...rest, groutBar: bar } } }
    }
    expect(codesOf(result, withBar(undefined))).toContain(STRUCTURAL_VIOLATION.GROUT_WITHOUT_BAR)
    expect(codesOf(result, withBar(0.008))).toContain(STRUCTURAL_VIOLATION.GROUT_WITHOUT_BAR)
    // a Ø 40 mm bar: 12.6 cm², 9.2 % of the cell
    expect(codesOf(result, withBar(0.04))).toContain(STRUCTURAL_VIOLATION.GROUT_STEEL_CONGESTED)
  })
})

describe('modular coordination at the openings (6)', () => {
  it('puts the jambs of each window on the 20 cm module, its sill and head on the 20 cm courses, and a core in the first cell beside each jamb', () => {
    for (const seed of [1, 2, 3]) {
      const result = generate(seed)
      const all = bearing(result)
      for (const o of result.structure.openings.filter((x) => x.kind === 'window')) {
        for (const x of [o.from, o.to, o.y0, o.y1]) expect(Math.abs(x / 0.2 - Math.round(x / 0.2)), `seed ${seed} ${o.id} ${x}`).toBeLessThan(0.05)
        const cores = coresAlong(all.find((w) => w.id === o.wall)!, all)
        expect(cores.some((s) => s <= o.from + 0.01 && s >= o.from - 0.21), `seed ${seed} ${o.id} jamb ${o.from}`).toBe(true)
        expect(cores.some((s) => s >= o.to - 0.01 && s <= o.to + 0.21), `seed ${seed} ${o.id} jamb ${o.to}`).toBe(true)
      }
    }
  })

  it('reports a window off the module, a head off the courses and a jamb core in the opening instead of the masonry', () => {
    const result = generate(1)
    const window = result.structure.openings.find((o) => o.wall === 'wall_0_0')!
    const shifted = { ...result.structure, openings: result.structure.openings.map((o) => (o === window ? { ...o, from: o.from + 0.1, to: o.to + 0.1, y1: o.y1 - 0.05 } : o)) }
    const codes = validateStructure(shifted, { doors: result.doors, rooms: result.rooms }).filter((v) => v.code === STRUCTURAL_VIOLATION.OFF_MODULE).map((v) => v.message)
    expect(codes.some((m) => /jamb/.test(m))).toBe(true)
    expect(codes.some((m) => /sill or head/.test(m))).toBe(true)
    // the core beside the left jamb moved 10 cm into the opening
    const parts = result.structure.parts.map((p) => (p.id === 'wall_0_0' ? { ...p, grout: (p.grout ?? []).map((g) => (g < window.from && g > window.from - 0.21 ? window.from + 0.1 : g)) } : p))
    expect(codesOf(result, { ...result.structure, parts })).toContain(STRUCTURAL_VIOLATION.OPENING_WITHOUT_GROUT)
  })
})

describe('slenderness (7)', () => {
  it('takes h_ef = h for a wall braced by its bond beam and slab, 2 h for one free at the top, λ = h_ef / t_ef and R = 1 - (λ / 40)³', () => {
    expect(effectiveHeight(2.6, true)).toBe(2.6)
    expect(effectiveHeight(2.6, false)).toBe(5.2)
    // the exterior walls: 2.6 / 0.14 = 18.6, R = 1 - (18.57 / 40)³ = 0.900; the interior ones to the slab: 2.8 / 0.14 = 20, R = 0.875
    expect(slendernessOf(2.6, 0.14)).toBeCloseTo(18.571, 3)
    expect(slendernessReduction(slendernessOf(2.6, 0.14))).toBeCloseTo(0.9, 3)
    expect(slendernessReduction(20)).toBeCloseTo(0.875, 9)
    const designs = designsOf(generate(1))
    expect(designs.find((d) => d.wall === 'wall_0_9')!.slenderness).toBeCloseTo(18.571, 2)
    expect(designs.find((d) => d.wall === 'wall_0_4')!.slenderness).toBeCloseTo(20, 2)
  })

  it('reports a wall left free at the top: nothing braces it, h_ef = 5.2 m, λ = 37 over 24', () => {
    const result = generate(1)
    const parts = new Map(result.structure.parts.map((p) => [p.id, p]))
    const free = { ...result.structure, supports: result.structure.supports.filter((s) => !(s.on === 'wall_0_9' && (parts.get(s.part)?.role === 'slab' || parts.get(s.part)?.beamKind === 'bond_beam'))) }
    expect(codesOf(result, free)).toContain(STRUCTURAL_VIOLATION.WALL_TOO_SLENDER)
  })
})
