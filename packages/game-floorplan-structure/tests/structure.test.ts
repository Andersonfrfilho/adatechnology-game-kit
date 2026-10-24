import { describe, expect, it } from 'vitest'

import { buildStructure, campConstruction, logCabinConstruction, planWaterTank, registerConstruction, woodFrameConstruction, shackConstruction } from '../src'
import type { Structure, WaterTank } from '../src'
import { engine } from './support'
import { rectangularHouse } from './synthetic-plan'

const SEEDS = Number(process.env.SEEDS) || 8
const STATES = ['normal', 'fortified', 'abandoned']
const TEMPLATES = engine.listTemplates().map((entry: { id: string }) => entry.id) as string[]

/** Follows what every part rests on until the ground; a part that never reaches it would fall on the first frame. */
function ungrounded(structure: Structure): string[] {
  const resting = new Map<string, string[]>()
  for (const support of structure.supports) resting.set(support.part, [...(resting.get(support.part) ?? []), support.on])
  const reaches = (id: string, seen: Set<string>): boolean => {
    if (id === 'ground') return true
    if (seen.has(id)) return false
    seen.add(id)
    return (resting.get(id) ?? []).some((on) => reaches(on, seen))
  }
  return structure.parts.filter((part) => !reaches(part.id, new Set())).map((part) => part.id)
}

describe('every generated plan has a structure', () => {
  for (const template of TEMPLATES) {
    it(`${template}: ${SEEDS} seeds x 3 states have parts, roof, construction, levels and a path to the ground for every part`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        for (const state of STATES) {
          const plan: any = engine.generate(template, { seed, state })
          const where = `${template}#${seed}/${state}`
          expect(plan.structure.parts.length, where).toBeGreaterThan(5)
          expect(plan.construction?.system, where).toBeDefined()
          expect(plan.roof?.panes.length, where).toBeGreaterThan(0)
          expect(plan.structure.levels, where).toHaveLength(plan.floors.length)
          expect(ungrounded(plan.structure), where).toEqual([])
          const roles = new Set(plan.structure.parts.map((p: any) => p.role))
          expect(roles.has('roof') || plan.roof.shape === 'slab', where).toBe(true)
          expect(roles.has('wall') || roles.has('partition'), where).toBe(true)
        }
      }
    })
  }

  it('the result carries construction, extras, tank, structure and roof; the roof is not repeated inside the structure', () => {
    const plan: any = engine.generate('townhouse', { seed: 2, state: 'normal' })
    expect(Object.keys(plan.structure).sort()).toEqual(['construction', 'elevation', 'framed', 'levels', 'openings', 'parts', 'supports'])
    expect(plan.structureExtras).toEqual({})
    expect(plan.waterTank === null || plan.waterTank.id === 'water_tank').toBe(true)
    expect(plan.roof.shape).toBe('gable')
  })

  it('a tank part exists exactly when the plan has a tank', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const plan: any = engine.generate('mid_modern_townhouse', { seed, state: 'normal' })
      expect(plan.structure.parts.some((p: any) => p.id === 'water_tank')).toBe(plan.waterTank !== null)
    }
  })
})

describe('construction systems', () => {
  it('options.construction puts a registered system on any plan, with timber floors and plates', () => {
    const plan: any = engine.generate('townhouse', { seed: 4, state: 'normal', construction: 'wood_frame' })
    expect(plan.construction.system).toBe('wood_frame')
    const ids: string[] = plan.structure.parts.map((p: any) => p.id)
    expect(ids.some((id) => id.startsWith('joist_1'))).toBe(true)
    expect(plan.structure.parts.filter((p: any) => p.beamKind).every((p: any) => p.beamKind === 'plate')).toBe(true)
    expect(ungrounded(plan.structure)).toEqual([])
  })

  it('a construction registered by name builds the plan', () => {
    registerConstruction('test_log_house', ({ result }) => ({ construction: { ...logCabinConstruction(), roof: { ...logCabinConstruction().roof, covering: result.facade.roof === 'slab' ? 'wood' : 'colonial' } } }))
    const plan: any = engine.generate('single_storey_a', { seed: 1, state: 'normal', construction: 'test_log_house' })
    expect(plan.construction.system).toBe('log')
    expect(plan.structure.parts.filter((p: any) => p.role === 'wall' && p.id.startsWith('wall_')).length).toBeGreaterThan(5)
  })

  it('an unknown construction is an error that names it', () => {
    expect(() => engine.generate('single_storey_a', { seed: 1, state: 'normal', construction: 'no_such_system' })).toThrow(/no_such_system/)
  })

  it('log walls are all bearing, shack walls are none', () => {
    const roles = (construction: ReturnType<typeof logCabinConstruction>) => [...new Set(buildStructure(rectangularHouse({ construction })).parts.filter((p) => p.id.startsWith('wall_')).map((p) => p.role))]
    expect(roles(logCabinConstruction())).toEqual(['wall'])
    expect(roles(shackConstruction())).toEqual(['partition'])
  })

  it('timber joists carry the floor and the porch, masonry carries it on a bond beam', () => {
    const wood = buildStructure(rectangularHouse({ floors: 2, construction: woodFrameConstruction() }))
    expect(wood.parts.some((p) => p.id.startsWith('joist_1_'))).toBe(true)
    const masonry = buildStructure(rectangularHouse({ floors: 2 }))
    expect(masonry.parts.some((p) => p.id === 'slab_1')).toBe(true)
    expect(masonry.parts.filter((p) => p.beamKind).every((p) => p.beamKind === 'bond_beam')).toBe(true)
  })

  it('raised foundations stand on footings: basement, crawl space and piles', () => {
    for (const foundation of ['basement', 'crawl_space'] as const) {
      const structure = buildStructure(rectangularHouse({ construction: woodFrameConstruction({ foundation }) }))
      expect(structure.elevation).toBeGreaterThan(0.4)
      expect(ungrounded(structure)).toEqual([])
      expect(structure.parts.some((p) => (foundation === 'basement' ? p.id === 'basement_slab' : p.id.startsWith('footing_pier_')))).toBe(true)
    }
    const piles = buildStructure(rectangularHouse({ construction: logCabinConstruction() }))
    expect(piles.parts.filter((p) => p.id.startsWith('footing_pier_')).every((p) => p.material === 'stone')).toBe(true)
  })

  it('a camp is canvas on aluminium poles with pegs and a groundsheet, no walls', () => {
    const source = rectangularHouse({ construction: campConstruction(), extras: { tents: [{ id: 'tent_1', kind: 'dome', height: 1.2, aabb: [1, 1, 3.3, 3.4] }, { id: 'tent_2', kind: 'tunnel', height: 1.1, aabb: [5, 1, 7.3, 3.4] }] } })
    const structure = buildStructure(source)
    expect(structure.roof.shape).toBe('tent')
    expect(structure.parts.filter((p) => p.role === 'wall' || p.role === 'partition')).toEqual([])
    expect(structure.parts.filter((p) => p.id.startsWith('peg_')).length).toBe(8)
    expect(structure.parts.filter((p) => p.id.startsWith('pole_tent_1')).length).toBe(2)
    expect(ungrounded(structure)).toEqual([])
  })

  it('the chimney rises over the ridge and is tied to the wall it touches; the well mouth is stone on the ground', () => {
    const source = rectangularHouse({ width: 8, depth: 6, extras: { chimney: { kind: 'fireplace', material: 'brick', aabb: [8.07, 2, 8.8, 3] }, well: { aabb: [9.5, 4, 10.3, 4.8] } } })
    const structure = buildStructure(source)
    const chimney = structure.parts.find((p) => p.id === 'chimney')!
    expect(chimney.y1).toBeGreaterThan(structure.roof.ridge!)
    expect(structure.supports.filter((s) => s.part === 'chimney').map((s) => s.on)).toEqual(['ground', 'wall_0_3'])
    expect(structure.parts.find((p) => p.id === 'well')!.material).toBe('stone')
  })
})

describe('water tank', () => {
  const house = () => ({ ...rectangularHouse({ width: 8, depth: 6 }), lot: {}, w: 8, d: 6 })

  it('goes on the slab of a flat roof, on a platform over a pitched roof, or in the attic', () => {
    const slab = planWaterTank({ ...house(), facade: { roof: 'slab' } }, () => 0.5)!
    const platform = planWaterTank(house(), () => 0.5)!
    const attic = planWaterTank(house(), () => 0.05)!
    expect([slab.place, platform.place, attic.place]).toEqual(['slab', 'raised_slab', 'attic'])
    expect(platform.platform!.pillars).toHaveLength(4)
    expect(platform.y).toBe(platform.platform!.topY)
  })

  it('is a part that carries nothing, resting on what holds it', () => {
    for (const tank of [planWaterTank(house(), () => 0.5)!, planWaterTank(house(), () => 0.05)!]) {
      const structure = buildStructure({ ...house(), waterTank: tank })
      expect(structure.parts.find((p) => p.id === 'water_tank')!.role).toBe('none')
      expect(ungrounded(structure)).toEqual([])
    }
  })

  it('a trestle tank has columns and beams of its own', () => {
    const tank: WaterTank = { id: 'water_tank', kind: 'water_tank', itemType: 'water_tank', place: 'trestle', floor: 0, room: 'yard', u: 9, v: 3, y: 1.8, w: 1.1, d: 1.1, h: 1, capacity: 500, aabb: [8.5, 2.5, 9.6, 3.6], stand: { pillars: [{ u: 8.6, v: 2.6, side: 0.1 }, { u: 9.5, v: 2.6, side: 0.1 }, { u: 8.6, v: 3.5, side: 0.1 }, { u: 9.5, v: 3.5, side: 0.1 }], material: 'wood_hard', height: 1.8 } }
    const structure = buildStructure({ ...house(), waterTank: tank })
    expect(structure.parts.filter((p) => p.id.startsWith('trestle_column_'))).toHaveLength(4)
    expect(ungrounded(structure)).toEqual([])
  })

  it('there is none for an apartment or a commercial building', () => {
    expect(planWaterTank({ ...house(), lot: null }, () => 0.5)).toBeNull()
    expect(planWaterTank({ ...house(), style: 'commercial' }, () => 0.5)).toBeNull()
  })
})
