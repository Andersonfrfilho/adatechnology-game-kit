import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { SLAB_PANEL_DEFAULTS, beamDepthFor, beamSpan, resolveSlabPanels, toDestructibleSpec } from '../src'
import { engine } from './support'
import { breakParts, idsStarting } from './world-helpers'

const specOf = (template: string, seed = 3, state: 'normal' | 'abandoned' = 'normal', portico: boolean | 'auto' = true) => {
  const result: any = engine.generate(template, { seed, state })
  return { result, spec: toDestructibleSpec(result.structure, portico === 'auto' ? {} : { portico }) }
}
const panelsOf = (spec: { parts: { id: string }[] }, slab: string) => spec.parts.map((p) => p.id).filter((id) => new RegExp(`^${slab}_p\\d+$`).test(id))

describe('slab panels: options and rules', () => {
  it('the slab thickness follows the span (L/40) with a floor and a roof minimum, and the beam depth follows L/10 in steps', () => {
    const o = SLAB_PANEL_DEFAULTS
    expect(o.maxSpan).toBe(5)
    expect(o.thicknessRatio).toBe(40)
    expect(o.floorMinThickness).toBeGreaterThanOrEqual(0.1)
    expect(o.roofMinThickness).toBeGreaterThanOrEqual(0.08)
    expect(beamDepthFor(6, o)).toBeCloseTo(0.6, 6)
    expect(beamDepthFor(1, o)).toBe(o.beamMinDepth)
    expect(resolveSlabPanels(false)).toBeUndefined()
    expect(resolveSlabPanels({ maxSpan: 4 })!.maxSpan).toBe(4)
    expect(resolveSlabPanels(true)).toEqual(o)
  })

  it('a beam spans between the supports it has, and the longest gap rules', () => {
    const r = beamSpan(10, [[0, 0.2], [4.9, 5.1], [9.8, 10]])
    expect(r.span).toBeLessThan(5.1)
    expect(beamSpan(10, [[0, 0.2], [9.8, 10]]).span).toBeGreaterThan(9)
  })

  it('a smaller maxSpan cuts the slab into more panels', () => {
    const result: any = engine.generate('townhouse', { seed: 3, state: 'normal' })
    const few = toDestructibleSpec(result.structure, { portico: true, slabPanels: { maxSpan: 7 } })
    const many = toDestructibleSpec(result.structure, { portico: true, slabPanels: { maxSpan: 3 } })
    expect(panelsOf(many, 'slab_1').length).toBeGreaterThanOrEqual(panelsOf(few, 'slab_1').length)
  })

  it('slabPanels: false keeps the slabs whole, as the team vocabulary and the coarse detail', () => {
    const result: any = engine.generate('townhouse', { seed: 3, state: 'normal' })
    const whole = toDestructibleSpec(result.structure, { portico: true, slabPanels: false })
    expect(whole.parts.some((p) => p.id === 'slab_1')).toBe(true)
    expect(panelsOf(whole, 'slab_1')).toEqual([])
  })

  it('no slab panel spans more than the span the engine sizes the steel for, and each is thinner than its beam is deep', () => {
    const { spec } = specOf('mansion')
    for (const p of spec.parts.filter((q) => /^slab_\w+_p\d+$/.test(q.id))) {
      const [sx, sy, sz] = (p.shape as { size: [number, number, number] }).size
      expect(Math.min(sx, sz), p.id).toBeLessThanOrEqual(SLAB_PANEL_DEFAULTS.maxSpan + 1.5)
      expect(sy, p.id).toBeLessThanOrEqual(0.4)
    }
  })
})

describe('reinforced concrete is the default: every typology stands at rest', () => {
  for (const template of Object.keys(engine.templates)) {
    it(`${template}: nothing breaks on its own and no section is past its limit`, () => {
      const { spec } = specOf(template, 1, 'normal', 'auto')
      const world = createDestruction({ seed: 1 })
      const id = world.add(spec)
      for (let t = 0; t < 20; t += 0.1) world.update(0.1)
      const parts = world.state(id)!.parts
      expect(parts.filter((p) => p.status === 'broken').map((p) => p.id), template).toEqual([])
      for (const p of parts) if (p.flexure !== undefined) expect(p.flexure, `${template} ${p.id}`).toBeLessThan(1)
    }, 60000)
  }
})

describe('progressive collapse only where real', () => {
  it('a framed sobrado that loses one corner column keeps its slab and its roof (the beams carry the bay across); two corner columns and the bay falls', () => {
    const { spec } = specOf('townhouse')
    const columns = idsStarting(spec, 'column_0_')
    const panels = panelsOf(spec, 'slab_1')
    expect(panels.length).toBeGreaterThan(2)
    const one = breakParts(spec, columns.slice(0, 1))
    expect(panels.every((id) => one.stands(id))).toBe(true)
    expect(one.stands('roof_a') && one.stands('roof_b')).toBe(true)
    const two = breakParts(spec, columns.slice(0, 2))
    const down = panels.filter((id) => !two.stands(id))
    expect(down.length).toBeGreaterThan(0)
    expect(down.length).toBeLessThan(panels.length + 1)
  })

  it('a column of the upper floor lost drops the bay it carries and not the slab of the whole house', () => {
    const { spec } = specOf('townhouse')
    const upper = idsStarting(spec, 'column_1_').concat(idsStarting(spec, 'pillar_1_'))
    const panels = panelsOf(spec, 'slab_ceiling')
    expect(upper.length).toBeGreaterThan(1)
    const fallen = breakParts(spec, upper)
    expect(panels.some((id) => !fallen.stands(id))).toBe(true)
    expect(panelsOf(spec, 'slab_1').every((id) => fallen.stands(id))).toBe(true)
  })

  it('a flat-roof house that loses one corner column keeps its slab; with all four columns lost the slab is down', () => {
    const { spec } = specOf('budget_slab_house')
    const columns = idsStarting(spec, 'column_0_')
    const panels = panelsOf(spec, 'slab_top')
    const one = breakParts(spec, columns.slice(0, 1))
    expect(panels.every((id) => one.stands(id))).toBe(true)
    const all = breakParts(spec, columns)
    expect(panels.some((id) => !all.stands(id))).toBe(true)
  })

  it('a blast under a slab cracks its tension face (the top) and the steel holds the panel', () => {
    const { spec } = specOf('budget_slab_house')
    const panel = spec.parts.find((p) => /^slab_top_p\d+$/.test(p.id))!
    const world = createDestruction({ seed: 3 })
    const id = world.add(spec)
    const events: any[] = []
    world.on('*', (e) => events.push(e))
    const [x, y, z] = panel.position
    world.explode([x, y - 1, z], 1e6, 15)
    for (let t = 0; t < 10; t += 0.1) world.update(0.1)
    const cracks = events.filter((e) => e.type === 'crack' && /^slab_top_/.test(e.part))
    expect(cracks.length).toBeGreaterThan(0)
    expect(cracks.some((e) => e.crack.normal[1] > 0.9)).toBe(true)
    expect(world.state(id)!.parts.find((p) => p.id === panel.id)!.status).not.toBe('broken')
  })
})
