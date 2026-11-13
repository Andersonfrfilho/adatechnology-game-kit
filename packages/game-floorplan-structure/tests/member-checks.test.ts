import { describe, expect, it } from 'vitest'

import { GROUND, STRUCTURAL_VIOLATION, validateStructure } from '../src'
import type { StructuredResult, StructurePart, Support } from '../src'
import { engine } from './support'

const generate = (template: string, options: Record<string, unknown> = {}): StructuredResult => engine.generate(template, { seed: 1, ...options }) as StructuredResult
const codesOf = (result: StructuredResult, structure = result.structure): string[] => validateStructure(structure, { doors: result.doors }).map((v) => v.code)
const alongU = (part: StructurePart): boolean => part.aabb[2] - part.aabb[0] >= part.aabb[3] - part.aabb[1]
const span = (part: StructurePart): [number, number] => (alongU(part) ? [part.aabb[0], part.aabb[2]] : [part.aabb[1], part.aabb[3]])

describe('the bond beam runs on over the masonry over a door, however wide the door', () => {
  for (const template of ['gas_station', 'metalworks']) {
    it(`${template}: every exterior over-door masonry is covered end to end by a bond beam resting on it, and no eave beam is left over a doorway`, () => {
      const result = generate(template)
      const { parts, supports } = result.structure
      const overDoors = parts.filter((p) => /^wall_\d+_over_/.test(p.id) && p.exterior)
      expect(overDoors.length).toBeGreaterThan(0)
      for (const wall of overDoors) {
        const beams = supports.filter((s) => s.on === wall.id).map((s) => parts.find((p) => p.id === s.part)).filter((p): p is StructurePart => p?.beamKind === 'bond_beam')
        const [from, to] = span(wall)
        expect(beams.some((b) => span(b)[0] <= from + 0.05 && span(b)[1] >= to - 0.05), `${template}: ${wall.id}`).toBe(true)
      }
      // (the wide doors of the gas station and the metalworks are 3.4 and 5 m: the bond beam was cut there, and an eave beam bridged the gap end to end)
      expect(parts.filter((p) => p.id.startsWith('eave_beam_0_')).map((p) => p.id)).toEqual([])
      expect(codesOf(result)).toEqual([])
    })
  }

  it('reports the masonry over a door whose bond beam stops short of covering it', () => {
    const result = generate('gas_station')
    const { parts, supports } = result.structure
    const wall = parts.find((p) => /^wall_0_over_/.test(p.id) && p.exterior && span(p)[1] - span(p)[0] > 3)!
    const plate = parts.find((p) => p.beamKind === 'bond_beam' && supports.some((s) => s.part === p.id && s.on === wall.id))!
    // the plate cut back to 0.11 m into the masonry over the door, as before the fix
    const cut: StructurePart = { ...plate, aabb: alongU(plate) ? [plate.aabb[0], plate.aabb[1], wall.aabb[0] + 0.11, plate.aabb[3]] : [plate.aabb[0], plate.aabb[1], plate.aabb[2], wall.aabb[1] + 0.11] }
    const structure = { ...result.structure, parts: parts.map((p) => (p === plate ? cut : p)) }
    expect(validateStructure(structure, { doors: result.doors }).filter((v) => v.part === wall.id).map((v) => v.code)).toContain(STRUCTURAL_VIOLATION.BOND_BEAM_NOT_CONTINUOUS)
  })
})

describe('eave pillars of a three-storey house', () => {
  const result = generate('high_end_contemporary', { floors: 3 })
  const { parts, supports } = result.structure
  const posts = parts.filter((p) => /^eave_beam_\d+_\d+_post_\d+$/.test(p.id))

  it('every slab a pillar runs through is cast on it (braced per storey), a pillar off the strip footings stands on a footing, every eave beam has two supports', () => {
    expect(posts.length).toBeGreaterThan(0)
    for (const post of posts) {
      const crossed = parts.filter((p) => p.role === 'slab' && p.y0 > post.y0 + 0.02 && p.y1 < post.y1 - 0.02 && p.aabb[0] < post.aabb[2] && p.aabb[2] > post.aabb[0] && p.aabb[1] < post.aabb[3] && p.aabb[3] > post.aabb[1])
      for (const slab of crossed) expect(supports.some((s) => s.part === slab.id && s.on === post.id), `${slab.id} on ${post.id}`).toBe(true)
      expect(supports.some((s) => s.part === post.id && s.on === GROUND), `${post.id} on the bare soil`).toBe(false)
    }
    expect(parts.some((p) => p.id.startsWith('footing_pier_eave_beam_'))).toBe(true)
    for (const beam of parts.filter((p) => /^eave_beam_\d+_\d+$/.test(p.id))) expect(supports.filter((s) => s.part === beam.id).length, beam.id).toBeGreaterThanOrEqual(2)
    expect(codesOf(result)).toEqual([])
  })

  it('reports a pillar that runs through slabs not tied to it (λ over its whole height)', () => {
    const tall = posts.reduce((a, b) => (b.y1 - b.y0 > a.y1 - a.y0 ? b : a))
    const untied: Support[] = supports.filter((s) => s.on !== tall.id || parts.find((p) => p.id === s.part)?.role !== 'slab')
    expect(codesOf(result, { ...result.structure, supports: untied })).toContain(STRUCTURAL_VIOLATION.COLUMN_TOO_SLENDER)
  })

  it('reports a pillar standing on the bare soil away from the strip footings', () => {
    const footing = parts.find((p) => p.id.startsWith('footing_pier_eave_beam_'))!
    const post = parts.find((p) => supports.some((s) => s.part === p.id && s.on === footing.id))!
    const bare = { ...result.structure, parts: parts.filter((p) => p !== footing), supports: supports.filter((s) => s.part !== footing.id).map((s) => (s.part === post.id && s.on === footing.id ? { ...s, on: GROUND } : s)) }
    expect(codesOf(result, bare)).toContain(STRUCTURAL_VIOLATION.PILLAR_WITHOUT_FOUNDATION)
  })

  it('reports an eave beam held by a single pillar (a mechanism)', () => {
    const beam = parts.find((p) => /^eave_beam_\d+_\d+$/.test(p.id))!
    const first = supports.find((s) => s.part === beam.id)!
    const single = { ...result.structure, supports: supports.filter((s) => s.part !== beam.id || s === first) }
    expect(codesOf(result, single)).toContain(STRUCTURAL_VIOLATION.BEAM_SINGLE_SUPPORT)
  })

  it('reports a beam between pillars built through a wall of its line it is not joined to', () => {
    const beam = parts.find((p) => /^eave_beam_\d+_\d+$/.test(p.id))!
    const intruder: StructurePart = { ...beam, id: 'wall_9_intruder', role: 'partition', material: 'brick', y0: beam.y0 - 2, y1: beam.y1 }
    const structure = { ...result.structure, parts: [...parts, intruder], supports: [...supports, { part: intruder.id, on: GROUND, joint: 'mortar' as const }] }
    expect(codesOf(result, structure)).toContain(STRUCTURAL_VIOLATION.OVERLAPPING_PARTS)
  })
})

describe('footings sized by their load, posts on what carries, roofs held at their eaves', () => {
  it('each isolated footing takes 1.05 N_k at no more than 200 kPa, a rigid footing h ≥ (B - b) / 3, and a smaller one is reported', () => {
    for (const [template, options, least] of [['apartment_basic', {}, 1.35], ['apartment_modern', { tier: 'high' }, 1.7], ['high_end_contemporary', { floors: 3 }, 0.8]] as const) {
      const result = generate(template, options)
      const { parts, supports } = result.structure
      const footings = parts.filter((p) => p.id.startsWith('footing_pier_') && supports.some((s) => s.on === p.id && s.part === p.id.slice('footing_pier_'.length)))
      expect(footings.length, template).toBeGreaterThan(0)
      for (const footing of footings) {
        const side = footing.aabb[2] - footing.aabb[0]
        expect(side, footing.id).toBeGreaterThanOrEqual(least)
        const column = parts.find((p) => p.id === footing.id.slice('footing_pier_'.length))!
        expect(footing.y1 - footing.y0, footing.id).toBeGreaterThanOrEqual((side - Math.min(column.aabb[2] - column.aabb[0], column.aabb[3] - column.aabb[1])) / 3 - 1e-6)
      }
      expect(codesOf(result), template).toEqual([])
      // the old 0.60 m pad under the same load (the eave posts' footings are sized by the larger of the loads of the whole and the framed slabs: under the
      // framed slabs' 41-46 kN a 0.60 m pad would hold)
      if (template === 'high_end_contemporary') continue
      const small = { ...result.structure, parts: parts.map((p) => (footings.includes(p) ? { ...p, aabb: [p.aabb[0], p.aabb[1], p.aabb[0] + 0.6, p.aabb[1] + 0.6] as typeof p.aabb } : p)) }
      expect(validateStructure(small, { doors: result.doors }).map((v) => v.code), template).toContain(STRUCTURAL_VIOLATION.SOIL_PRESSURE_EXCEEDED)
    }
  })

  it('a weaker soil (100 kPa) asks for wider footings', () => {
    const firm = generate('apartment_basic')
    const soft = engine.generate('apartment_basic', { seed: 1, soilPressure: 100 }) as StructuredResult
    const sideOf = (r: StructuredResult): number => { const f = r.structure.parts.find((p) => p.id === 'footing_pier_building_column_0')!; return f.aabb[2] - f.aabb[0] }
    expect(sideOf(soft)).toBeGreaterThan(sideOf(firm) * 1.3)
    expect(codesOf(soft)).toEqual([])
    expect(validateStructure(firm.structure, { doors: firm.doors, soilPressure: 100 }).map((v) => v.code)).toContain(STRUCTURAL_VIOLATION.SOIL_PRESSURE_EXCEEDED)
  })

  it('no eave post stands on infill masonry, and one put there is reported', () => {
    const result = generate('high_end_contemporary', { floors: 3 })
    const { parts, supports } = result.structure
    const byId = new Map(parts.map((p) => [p.id, p]))
    const posts = parts.filter((p) => /^eave_beam_\d+_\d+_post_\d+$/.test(p.id))
    for (const post of posts) for (const s of supports.filter((x) => x.part === post.id)) expect(byId.get(s.on)?.role, `${post.id} on ${s.on}`).not.toBe('wall')
    const wall = parts.find((p) => p.id === 'wall_0_47')!
    const post = posts[0]!
    const moved = { ...result.structure, supports: supports.map((s) => (s.part === post.id && s.on !== GROUND && byId.get(s.on)?.role !== 'slab' ? { ...s, on: wall.id } : s)) }
    expect(codesOf(result, moved)).toContain(STRUCTURAL_VIOLATION.PILLAR_ON_INFILL)
  })

  it('rafters running metres past their plate over a ceiling slab bear on it through struts, and one left as a cantilever is reported', () => {
    for (const options of [{}, { floors: 3 }]) {
      const result = generate('high_end_contemporary', options)
      const { parts, supports } = result.structure
      const strutted = supports.filter((s) => /^rafter/.test(s.part) && parts.find((p) => p.id === s.on)?.role === 'slab')
      expect(strutted.length, JSON.stringify(options)).toBeGreaterThan(0)
      expect(codesOf(result)).toEqual([])
      const loose = { ...result.structure, supports: supports.filter((s) => !strutted.includes(s)) }
      expect(codesOf(result, loose)).toContain(STRUCTURAL_VIOLATION.ROOF_OVERHANG_TOO_LONG)
    }
  })
})
