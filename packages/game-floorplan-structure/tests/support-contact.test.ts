import { describe, expect, it } from 'vitest'

import { register as registerRural } from '../../game-floorplan-rural/src'
import { STRUCTURAL_VIOLATION, validateStructure } from '../src'
import type { StructuredResult, StructurePart } from '../src'
import { engine } from './support'

registerRural(engine)

const generate = (template: string, seed: number) => engine.generate(template, { seed, state: 'normal' }) as StructuredResult
const codesOf = (result: StructuredResult, structure = result.structure) => validateStructure(structure, { doors: result.doors }).map((v) => v.code)
const touch = (a: readonly number[], b: readonly number[]): boolean => a[0]! <= b[2]! + 0.02 && a[2]! >= b[0]! - 0.02 && a[1]! <= b[3]! + 0.02 && a[3]! >= b[1]! - 0.02

describe('a pillar carries only what stands on its head', () => {
  it('a tank beam ends on walls, never on the masonry over a doorway, and every pillar under it stands under it (farm 1-6, mid_modern_single_storey 5)', () => {
    for (const [template, seed] of [['farm', 1], ['farm', 2], ['farm', 3], ['farm', 4], ['farm', 5], ['farm', 6], ['mid_modern_single_storey', 5]] as const) {
      const result = generate(template, seed)
      const { parts, supports } = result.structure
      const byId = new Map(parts.map((p) => [p.id, p]))
      expect(codesOf(result), `${template}#${seed}`).not.toContain(STRUCTURAL_VIOLATION.SUPPORT_WITHOUT_CONTACT)
      const overDoors = new Set(supports.filter((s) => s.on.startsWith('lintel_')).map((s) => s.part))
      for (const s of supports.filter((x) => x.part.startsWith('tank_beam_') && !x.part.startsWith('tank_beam_pillar_'))) {
        expect(overDoors.has(s.on), `${template}#${seed}: ${s.part} on ${s.on}`).toBe(false)
        const under = byId.get(s.on)
        if (under?.role === 'column') expect(touch(byId.get(s.part)!.aabb, under.aabb), `${template}#${seed}: ${s.part} on ${s.on}`).toBe(true)
      }
    }
  })

  it('reports a part declared on a pillar it does not touch (a pillar pushed 0.30 m out of a doorway, beside the beam)', () => {
    const result = generate('farm', 1)
    const { parts, supports } = result.structure
    const beam = parts.find((p) => p.id === 'tank_beam_0')!
    const pillar = { ...beam, id: 'tank_beam_pillar_test', role: 'column' as const, aabb: [beam.aabb[0], beam.aabb[3] + 0.3, beam.aabb[0] + 0.14, beam.aabb[3] + 0.6] as typeof beam.aabb, y0: 0, y1: beam.y0 }
    const off = { ...result.structure, parts: [...parts, pillar], supports: [...supports, { part: pillar.id, on: 'ground', joint: 'rebar' as const }, { part: beam.id, on: pillar.id, joint: 'rebar' as const }] }
    expect(codesOf(result, off)).toContain(STRUCTURAL_VIOLATION.SUPPORT_WITHOUT_CONTACT)
  })

  it('a tent canvas is tied to its pegs by the guy ropes, not carried by them', () => {
    const result = generate('campsite', 1)
    const ties = result.structure.supports.filter((s) => s.part.startsWith('canvas_') && s.on.startsWith('peg_'))
    expect(ties.length).toBeGreaterThan(0)
    for (const tie of ties) expect(tie.bears).toBe(false)
  })
})

describe('a roof that runs past the walls rests on an eave beam on pillars, made where it is missing', () => {
  const eaveOf = (result: StructuredResult) => result.structure.parts.filter((p) => p.id.startsWith('eave_beam_'))
  const spansOf = (beam: StructurePart, result: StructuredResult): number[] => {
    const alongU = beam.aabb[2] - beam.aabb[0] >= beam.aabb[3] - beam.aabb[1]
    const [from, to] = alongU ? [beam.aabb[0], beam.aabb[2]] : [beam.aabb[1], beam.aabb[3]]
    const byId = new Map(result.structure.parts.map((p) => [p.id, p]))
    const stations = result.structure.supports.filter((s) => s.part === beam.id).map((s) => byId.get(s.on)!).map((p) => (alongU ? (p.aabb[0] + p.aabb[2]) / 2 : (p.aabb[1] + p.aabb[3]) / 2))
    const all = [from, ...stations.map((x) => Math.min(to, Math.max(from, x))), to].sort((a, b) => a - b)
    return all.slice(1).map((x, k) => x - all[k]!)
  }

  it('mansion: the rafters over the terrace rest on a beam along the front eave, from the end of the front plate, on pillars of its own on the front wall below', () => {
    const result = generate('mansion', 1)
    const { parts, supports } = result.structure
    const rafter = parts.find((p) => p.id === 'rafter_a_7')!
    // over the terrace at u 8.2, 2.09 m past the end of plate_2_0 (u 6.11): it rests on the eave beam alone, which it crosses
    const under = supports.filter((s) => s.part === rafter.id).map((s) => s.on)
    expect(under).toEqual(['eave_beam_2_0'])
    const [beam] = eaveOf(result)
    expect(beam!.aabb[0]).toBeCloseTo(6.11, 2)
    // it abuts the plate and bears on a pillar of its own 0.65 m past the plate's end (past the reach of the wall's own pillars), never on the plate's end
    expect(supports.some((s) => s.part === beam!.id && s.on === 'plate_2_0')).toBe(false)
    // NBR 6118: h ≥ L/10 over its longest span between supports (3.3 m: 0.33 m), at least 0.25 m
    expect(beam!.y1 - beam!.y0).toBeGreaterThanOrEqual(Math.max(0.25, Math.max(...spansOf(beam!, result)) / 10) - 0.01)
    const posts = parts.filter((p) => p.id.startsWith(`${beam!.id}_post_`))
    expect(posts.length).toBe(5)
    for (const post of posts) {
      const sides = [post.aabb[2] - post.aabb[0], post.aabb[3] - post.aabb[1]]
      expect(Math.min(...sides) * Math.max(...sides)).toBeGreaterThanOrEqual(0.036 - 1e-9)
      expect(supports.filter((s) => s.part === post.id).map((s) => s.on)).toEqual(['plate_1_0'])
      expect(post.y1).toBeCloseTo(beam!.y0, 6)
    }
  })

  it('gas_station: the bond beam runs on over the 3.4 m garage door, on the masonry over it and its lintel (h = L/10): no eave beam is needed there', () => {
    const result = generate('gas_station', 1)
    expect(eaveOf(result)).toEqual([])
    const { parts, supports } = result.structure
    const header = parts.find((p) => p.id === 'wall_0_over_d0_3')!
    const plate = parts.find((p) => p.beamKind === 'bond_beam' && supports.some((s) => s.part === p.id && s.on === header.id))!
    expect(plate.aabb[0]).toBeLessThanOrEqual(header.aabb[0])
    expect(plate.aabb[2]).toBeGreaterThanOrEqual(header.aabb[2])
    // the lintel under the masonry: 3.4 m door plus 0.2 m of bearing, 0.36 m deep
    const lintel = parts.find((p) => p.id === 'lintel_d0_3')!
    expect(lintel.y1 - lintel.y0).toBeGreaterThanOrEqual((3.4 + 0.2) / 10 - 1e-6)
  })

  it('wood_frame_house: a timber beam on timber posts of its own frame, standing on the foundation raft', () => {
    const result = generate('wood_frame_house', 1)
    const [beam] = eaveOf(result)
    expect(beam!.material).toBe('wood_soft')
    const posts = result.structure.parts.filter((p) => p.id.startsWith(`${beam!.id}_post_`))
    expect(posts.length).toBeGreaterThan(0)
    for (const post of posts) {
      expect(post.material).toBe('wood_soft')
      expect(result.structure.supports.filter((s) => s.part === post.id).map((s) => s.on)).toEqual(['foundation_raft'])
    }
  })

  it('the five typologies whose roofs ran past their walls stand as their construction tests ask, seeds 1-3', () => {
    for (const template of ['mansion', 'high_end_contemporary', 'metalworks', 'gas_station', 'wood_frame_house']) {
      for (const seed of [1, 2, 3]) {
        const result = generate(template, seed)
        expect(validateStructure(result.structure, { doors: result.doors }), `${template}#${seed}`).toEqual([])
      }
    }
  })

  it('the reproduction of the Visor de casas 3D has none (its golden)', () => {
    const visor = engine.generate('mansion', { seed: 1, state: 'normal', wallDetail: 'coarse', wallPillars: false, groundBeams: false, visorSections: true }) as StructuredResult
    expect(eaveOf(visor)).toEqual([])
  })
})
