import { describe, expect, it } from 'vitest'

import type { StructuredResult } from '../src'
import { ROOF_COVERINGS } from '../src/registry'
import { coveringMass, rafterMass, slopedArea } from '../src/structure/roof-weight'
import { register as registerRural } from '../../game-floorplan-rural/src'
import { engine } from './support'

registerRural(engine)

const generate = (template: string, options: Record<string, unknown> = {}) => engine.generate(template, { seed: 1, state: 'normal', ...options }) as StructuredResult
const plan = (aabb: readonly number[]): number => (aabb[2]! - aabb[0]!) * (aabb[3]! - aabb[1]!)
/** kg per m² of plan of the panes and of the rafters (or trusses) of a roof. */
const perPlan = (result: StructuredResult): { covering: number; frame: number } => {
  const panes = result.structure.parts.filter((p) => p.role === 'roof')
  const frames = result.structure.parts.filter((p) => /^(rafter|truss|ridge)/.test(p.id))
  const area = panes.reduce((t, p) => t + plan(p.aabb), 0)
  return { covering: panes.reduce((t, p) => t + p.mass, 0) / area, frame: frames.reduce((t, p) => t + p.mass, 0) / area }
}

describe('the weight of a roof by its covering and its timber, not by its box', () => {
  it('weighs ceramic tiles at 0.70 kN/m² of slope: 82 kg/m² in plan at 30°, about 0.85 kN/m² with the rafters (NBR 6120)', () => {
    expect(ROOF_COVERINGS.get('colonial')!.weight).toBe(0.7)
    // 1 m² of plan at 30° is 1 / cos 30° = 1.155 m² of slope: 0.70 x 1.155 = 0.808 kN = 82.4 kg
    expect(coveringMass('colonial', slopedArea([0, 0, 1, 1], 1, Math.tan(Math.PI / 6)))).toBeCloseTo((0.7 / Math.cos(Math.PI / 6) * 1000) / 9.81, 6)
    // a 6 x 16 cm pine rafter over a 5.7 m run at 30°: 0.0096 m² x 6.58 m x 500 kg/m³ = 31.6 kg
    expect(rafterMass('wood_soft', 5.7, 5.7 * Math.tan(Math.PI / 6))).toBeCloseTo(0.0096 * (5.7 / Math.cos(Math.PI / 6)) * 500, 6)
    for (const template of ['single_storey_a', 'single_storey_structural', 'townhouse', 'mansion', 'farm']) {
      const { covering, frame } = perPlan(generate(template))
      // was 566 (townhouse) to 1122 (mansion) kg/m², the box of the pane times 12 % of tile: it grew with the ridge
      expect(covering, template).toBeCloseTo(82.4, 0)
      expect(((covering + frame) * 9.81) / 1000, template).toBeGreaterThan(0.8)
      expect(((covering + frame) * 9.81) / 1000, template).toBeLessThan(0.9)
    }
  })

  it('weighs a tower roof, a porch roof of zinc and a tent by their surface too', () => {
    // residential_tower: was 1971 kg/m²; log_cabin porch (zinc): was 4710 kg/m²
    expect(perPlan(generate('residential_tower')).covering).toBeCloseTo(82.4, 0)
    const cabin = generate('log_cabin').structure.parts.find((p) => p.id.startsWith('porch_roof_'))!
    expect(cabin.mass / plan(cabin.aabb)).toBeLessThan(12)
    expect(cabin.mass / plan(cabin.aabb)).toBeGreaterThan(10)
    const canvas = generate('campsite').structure.parts.filter((p) => p.id.startsWith('canvas_'))
    for (const tent of canvas) expect(tent.mass / plan(tent.aabb), tent.id).toBeLessThan(2)
  })

  it("keeps the team's weights in the reproduction of the Visor de casas 3D (its golden)", () => {
    const visor = generate('single_storey_a', { wallDetail: 'coarse', wallPillars: false, groundBeams: false, visorSections: true })
    expect(perPlan(visor).covering).toBeGreaterThan(500)
  })
})
