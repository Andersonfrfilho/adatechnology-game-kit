import { describe, expect, it } from 'vitest'

import { buildStructure, logCabinConstruction, toDestructibleSpec, woodFrameConstruction } from '../src'
import type { Construction } from '../src'
import { engine } from './support'
import { rectangularHouse } from './synthetic-plan'
import { breakParts, idsStarting } from './world-helpers'

const specOf = (construction: Construction | undefined, porch = 0, wallDetail: 'coarse' | 'panels' = 'panels') =>
  toDestructibleSpec(buildStructure(rectangularHouse({ width: 8, depth: 6, porch, ...(construction ? { construction } : {}) }), { wallDetail }), { wallDetail })

describe('porch: its own posts carry its roof, and only its roof', () => {
  for (const [name, construction] of [['masonry (concrete posts)', undefined], ['wood frame house (wood posts)', woodFrameConstruction()], ['log cabin (wood posts)', logCabinConstruction()]] as const) {
    it(`${name}: taking the posts away drops the porch roof and nothing else`, () => {
      const spec = specOf(construction, 1.8)
      const posts = idsStarting(spec, 'porch_post_')
      expect(posts.length).toBeGreaterThanOrEqual(2)
      const fallen = breakParts(spec, posts)
      expect(fallen.stands('porch_roof_porch')).toBe(false)
      const house = spec.parts.map((p) => p.id).filter((id) => !id.startsWith('porch_') && id !== 'ground' && !id.startsWith('steps_'))
      expect(house.filter((id) => !fallen.stands(id))).toEqual([])
    })
  }

  it('the posts are concrete in masonry and wood in the timber houses', () => {
    const materialsOf = (construction?: Construction) => [...new Set(buildStructure(rectangularHouse({ porch: 1.8, ...(construction ? { construction } : {}) })).parts.filter((p) => p.id.startsWith('porch_post_')).map((p) => p.material))]
    expect(materialsOf()).toEqual(['concrete'])
    expect(materialsOf(woodFrameConstruction())).toEqual(['wood_soft'])
    expect(materialsOf(logCabinConstruction())).toEqual(['wood_hard'])
  })

  it('one post of three is lost and the roof stays on the other two', () => {
    const spec = specOf(woodFrameConstruction(), 1.8)
    const fallen = breakParts(spec, idsStarting(spec, 'porch_post_').slice(0, 1))
    expect(fallen.stands('porch_roof_porch')).toBe(true)
  })

  it('every post stands on a footing and the porch roof rests on the posts', () => {
    const structure = buildStructure(rectangularHouse({ porch: 1.8 }))
    const postIds = structure.parts.filter((p) => p.id.startsWith('porch_post_')).map((p) => p.id)
    const roofSupports = structure.supports.filter((s) => s.part === 'porch_roof_porch' && s.bears !== false).map((s) => s.on)
    expect(roofSupports.sort()).toEqual(postIds.sort())
    expect(structure.supports.filter((s) => s.part === 'porch_floor_porch').every((s) => s.on.startsWith('porch_footing_') || s.on === 'foundation_raft')).toBe(true)
  })

  it('in the coarse detail (as the Visor de casas 3D) the porch roof is also carried by the house wall, so it stays', () => {
    const structure = buildStructure(rectangularHouse({ width: 8, depth: 6, porch: 1.8 }), { wallDetail: 'coarse' })
    const spec = toDestructibleSpec(structure, { wallDetail: 'coarse' })
    const fallen = breakParts(spec, idsStarting(spec, 'porch_post_'))
    expect(fallen.stands('porch_roof_porch')).toBe(true)
  })
})

describe('reinforced concrete frame: pillars, bond beams and slabs', () => {
  const frameOf = (template: string, seed = 3) => {
    const result: any = engine.generate(template, { seed, state: 'normal' })
    return { result, spec: toDestructibleSpec(result.structure, { portico: true }) }
  }

  it('flat-roof house: one corner pillar lost and the slab stays in part (the corner bay drops); all four and the slab is down', () => {
    const { spec } = frameOf('budget_slab_house')
    const pillars = idsStarting(spec, 'column_0_')
    const panels = idsStarting(spec, 'slab_top_p')
    expect(pillars).toHaveLength(4)
    expect(panels.length).toBeGreaterThan(1)
    expect(panels.some((id) => breakParts(spec, pillars.slice(0, 1)).stands(id))).toBe(true)
    const all = breakParts(spec, pillars)
    expect(panels.some((id) => !all.stands(id))).toBe(true)
  })

  it('two storeys: one pillar lost and the roof and part of the slab above stay; all the pillars of the ground floor and the roof falls', () => {
    const { spec } = frameOf('townhouse')
    const pillars = idsStarting(spec, 'column_0_')
    const panels = idsStarting(spec, 'slab_1_p')
    const one = breakParts(spec, pillars.slice(0, 1))
    expect(one.stands('roof_a')).toBe(true)
    expect(one.stands('roof_b')).toBe(true)
    expect(panels.some((id) => one.stands(id))).toBe(true)
    const all = breakParts(spec, pillars)
    expect(panels.some((id) => !all.stands(id))).toBe(true)
    expect(all.stands('roof_a') && all.stands('roof_b')).toBe(false)
  })

  it('a commercial building is a frame by default: the pillars carry it', () => {
    const result: any = engine.generate('market', { seed: 2, state: 'normal' })
    expect(result.structure.framed).toBe(true)
    const spec = toDestructibleSpec(result.structure)
    const pillars = idsStarting(spec, 'column_0_')
    expect(pillars.length).toBeGreaterThan(2)
    expect(breakParts(spec, pillars.slice(0, 1)).stands('roof_a')).toBe(true)
    expect(breakParts(spec, pillars).stands('roof_a')).toBe(false)
  })

  it('the rebar of the concrete parts is declared by the construction (steel)', () => {
    const result: any = engine.generate('townhouse', { seed: 1, state: 'normal' })
    expect(result.construction.frame.rebar).toBe('steel')
    expect(result.structure.parts.filter((p: any) => p.material === 'concrete').length).toBeGreaterThan(0)
  })
})

describe('wood frame house: the roof section falls with the wall it rests on', () => {
  it('cutting the studs of one long wall drops the roof side above it and leaves the other side', () => {
    const spec = specOf(woodFrameConstruction())
    const fallen = breakParts(spec, ['wall_0_0'])
    expect(fallen.stands('wall_0_0')).toBe(false)
    expect(fallen.stands('plate_0_0')).toBe(false)
    expect(fallen.stands('roof_a')).toBe(false)
    expect(fallen.stands('roof_b')).toBe(true)
    expect(fallen.stands('wall_0_1')).toBe(true)
  })

  it('the load path is declared: roof panes on rafters, rafters on the plates, plates on the walls, walls on the foundation', () => {
    const structure = buildStructure(rectangularHouse({ width: 8, depth: 6, construction: woodFrameConstruction() }))
    const supportsOf = (id: string) => structure.supports.filter((s) => s.part === id).map((s) => s.on)
    expect(supportsOf('roof_a').every((id) => id.startsWith('rafter_a_'))).toBe(true)
    expect(supportsOf('rafter_a_3')).toContain('plate_0_0')
    expect(supportsOf('plate_0_0')).toEqual(['wall_0_0'])
    expect(supportsOf('wall_0_0')).toEqual(['foundation_raft'])
    expect(supportsOf('foundation_raft')).toEqual(['ground'])
    expect(structure.parts.find((p) => p.id === 'ridge')).toBeDefined()
  })

  it('the studs are declared on the wall and a bearing wall weighs 35% of solid wood', () => {
    const structure = buildStructure(rectangularHouse({ construction: woodFrameConstruction() }))
    const wall = structure.parts.find((p) => p.id === 'wall_0_0')!
    expect(wall.studs).toEqual({ spacing: 0.4, section: '38x89' })
    const volume = (wall.aabb[2] - wall.aabb[0]) * (wall.aabb[3] - wall.aabb[1]) * (wall.y1 - wall.y0)
    expect(wall.mass).toBeCloseTo(volume * 500 * 0.35, -1)
  })
})

describe('shack: timber posts carry the roof, the sheet walls only close', () => {
  it('a sheet wall can go and nothing falls', async () => {
    const { shackConstruction } = await import('../src')
    const spec = specOf(shackConstruction())
    const fallen = breakParts(spec, ['wall_0_0'])
    expect(fallen.down).toEqual(new Set(['wall_0_0']))
  })
})
