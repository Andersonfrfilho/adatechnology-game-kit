import { describe, expect, it } from 'vitest'

import { register as registerRural } from '../../game-floorplan-rural/src'
import { STRUCTURAL_VIOLATION, validateStructure } from '../src'
import type { StructuredResult } from '../src'
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
