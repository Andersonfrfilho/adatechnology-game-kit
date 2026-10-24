import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { buildStructure, buildWallSpecimen, logCabinConstruction, toDestructibleSpec } from '../src'
import { engine } from './support'
import { rectangularHouse } from './synthetic-plan'
import { breakParts, idsStarting } from './world-helpers'

const massOf = (spec: { parts: { mass?: number }[] }): number => spec.parts.reduce((sum, part) => sum + (part.mass ?? 0), 0)

describe('wallDetail on a generated plan', () => {
  const plan = (template: string, seed = 2): any => engine.generate(template, { seed, state: 'normal' })

  for (const template of ['single_storey_a', 'townhouse', 'high_end_contemporary', 'market']) {
    it(`${template}: panels and units keep the mass of the walls (within 1%)`, () => {
      const generated = plan(template)
      const coarse = toDestructibleSpec(generated.structure, { wallDetail: 'coarse' })
      const panels = toDestructibleSpec(generated.structure, { wallDetail: 'panels' })
      expect(panels.parts.length).toBeGreaterThan(coarse.parts.length)
      expect(Math.abs(massOf(panels) - massOf(coarse)) / massOf(coarse)).toBeLessThan(0.01)
      const hosts = new Map<string, number>()
      for (const part of generated.structure.parts) if (part.id.startsWith('wall_')) hosts.set(part.id, part.mass)
      for (const [wall, mass] of hosts) {
        const pieces = panels.parts.filter((p) => p.id === wall || p.id.startsWith(`${wall}_`))
        expect(Math.abs(pieces.reduce((sum, p) => sum + (p.mass ?? 0), 0) - mass) / mass, wall).toBeLessThan(0.01)
      }
    })
  }

  it('cuts a wall at its windows: piers, sill, lintel bearing 0.2 m on the piers, wall above', () => {
    const generated = plan('single_storey_a', 1)
    const window = generated.structure.openings.find((o: any) => o.kind === 'window')
    const spec = toDestructibleSpec(generated.structure, { wallDetail: 'panels' })
    const pieces = spec.parts.filter((p) => p.id.startsWith(`${window.wall}_`))
    const kinds = pieces.map((p) => p.id.replace(`${window.wall}_`, '').replace(/_\d+$/, ''))
    expect(kinds).toEqual(expect.arrayContaining(['pier', 'sill', 'lintel']))
    const lintel = pieces.find((p) => p.id.includes('_lintel_'))!
    expect(lintel.structure!.role).toBe('beam')
    expect(lintel.reinforcement).toBeDefined()
    expect(pieces.find((p) => p.id.includes('_sill_'))!.structure!.role).toBe('partition')
    const lintelAcross = (lintel.shape as { size: number[] }).size[0]!
    expect(lintelAcross).toBeCloseTo(window.to - window.from + 0.4, 1)
    const onPiers = (spec.joints ?? []).filter((j) => j.a === lintel.id)
    expect(onPiers.length).toBe(2)
    expect(onPiers.every((j) => j.b.includes('_pier_'))).toBe(true)
  })

  it('bearing piers keep the role of the wall and a partition stays a partition', () => {
    const generated = plan('townhouse', 3)
    const spec = toDestructibleSpec(generated.structure, { wallDetail: 'panels' })
    const roleOf = (id: string) => spec.parts.find((p) => p.id === id)!.structure!.role
    for (const part of generated.structure.parts.filter((p: any) => p.id.startsWith('wall_'))) {
      const pier = spec.parts.find((p) => p.id === part.id || p.id.startsWith(`${part.id}_pier_`))
      if (pier) expect(roleOf(pier.id), part.id).toBe(part.role)
    }
  })

  it('the detailed house stands whole: nothing breaks on its own in a minute', () => {
    for (const template of ['single_storey_a', 'townhouse', 'high_end_contemporary']) {
      const spec = toDestructibleSpec(plan(template).structure, { wallDetail: 'panels' })
      expect(breakParts(spec, [], 60).down.size, template).toBe(0)
    }
  })

  it('units: bricks laid one by one in bond, each on two below', () => {
    const generated = plan('budget_slab_house', 1)
    const spec = toDestructibleSpec(generated.structure, { wallDetail: 'units' })
    const bricks = spec.parts.filter((p) => /_u\d+_\d+$/.test(p.id))
    expect(bricks.length).toBeGreaterThan(1000)
    const some = bricks.find((p) => p.id.includes('_u3_'))!
    expect((spec.joints ?? []).filter((j) => j.a === some.id).length).toBeGreaterThanOrEqual(1)
    expect(breakParts(spec, [], 30).down.size).toBe(0)
  })

  it('door lintels bridge the gaps and carry the bond beam over the outside doors', () => {
    const generated = plan('single_storey_a', 1)
    const lintels = generated.structure.parts.filter((p: any) => p.id.startsWith('lintel_'))
    expect(lintels.length).toBe(generated.doors.length)
    for (const lintel of lintels) {
      expect(lintel.role).toBe('beam')
      expect(generated.structure.supports.filter((s: any) => s.part === lintel.id).length).toBeGreaterThanOrEqual(1)
    }
    const outside = generated.doors.filter((door: any) => door.exterior).map((door: any) => `lintel_${door.id}`)
    expect(outside.length).toBeGreaterThan(0)
    for (const id of outside) expect(generated.structure.supports.some((s: any) => s.on === id && s.part.startsWith('plate_')), id).toBe(true)
  })

  it('coarse keeps one box per wall and no assembly layers', () => {
    const spec = toDestructibleSpec(plan('single_storey_a').structure, { wallDetail: 'coarse' })
    expect(spec.parts.some((p) => p.layers !== undefined || p.reinforcement !== undefined)).toBe(false)
  })
})

describe('log walls are courses of logs', () => {
  const cabin = () => toDestructibleSpec(buildStructure(rectangularHouse({ width: 8, depth: 6, construction: logCabinConstruction() })), { wallDetail: 'panels' })

  it('ten logs of 26 cm to a wall of 2.6 m, each resting on the one under it', () => {
    const spec = cabin()
    const logs = idsStarting(spec, 'wall_0_0_log')
    expect(logs).toHaveLength(10)
    const second = logs.find((id) => id.startsWith('wall_0_0_log1_'))!
    expect((spec.joints ?? []).filter((j) => j.a === second).map((j) => j.b)).toEqual([logs.find((id) => id.startsWith('wall_0_0_log0_'))])
  })

  it('taking the bottom log away drops every log above it, and the other walls stay', () => {
    const spec = cabin()
    const bottom = idsStarting(spec, 'wall_0_0_log0_')
    const fallen = breakParts(spec, bottom)
    const above = idsStarting(spec, 'wall_0_0_log').filter((id) => !bottom.includes(id))
    expect(above.filter((id) => fallen.stands(id))).toEqual([])
    expect(idsStarting(spec, 'wall_0_1_log').filter((id) => !fallen.stands(id))).toEqual([])
  })

  it('a log in the middle of a wall can go and the rest holds', () => {
    const spec = cabin()
    const fallen = breakParts(spec, idsStarting(spec, 'wall_0_0_log4_'))
    expect(fallen.stands('wall_0_0_log0_0')).toBe(true)
    expect(fallen.stands('wall_0_0_log3_3')).toBe(true)
  })
})

describe('wall specimens', () => {
  const ASSEMBLIES = ['brick_wall_plastered', 'concrete_block_wall', 'reinforced_concrete', 'drywall', 'wood_frame_wall', 'log_wall', 'sheet_metal_shack']

  for (const assembly of ASSEMBLIES) {
    it(`${assembly}: 2.4 x 2.1 m, whole, with a door and with a window keeps the same mass`, () => {
      const whole = buildStructureMass(assembly, null)
      for (const opening of ['door', 'window'] as const) expect(Math.abs(buildStructureMass(assembly, opening) - whole) / whole, `${assembly} ${opening}`).toBeLessThan(0.01)
    })
  }

  it('a door in brick: two piers, a reinforced lintel bearing 0.2 m, wall above, plaster on every piece', () => {
    const spec = buildWallSpecimen({ assembly: 'brick_wall_plastered', w: 2.4, h: 2.1, opening: 'door' })
    const ids = spec.parts.map((p) => p.id).filter((id) => id !== 'ground')
    expect(ids.sort()).toEqual(['wall_specimen_lintel_0', 'wall_specimen_pier_0', 'wall_specimen_pier_1', 'wall_specimen_spandrel_0'])
    const lintel = spec.parts.find((p) => p.id === 'wall_specimen_lintel_0')!
    expect((lintel.shape as { size: number[] }).size[0]).toBeCloseTo(0.9 + 0.4, 5)
    expect(lintel.reinforcement?.spacing).toBe(0.18)
    expect(spec.parts.filter((p) => p.id !== 'ground' && p.id !== lintel.id).every((p) => p.layers?.[0]?.material === 'plaster')).toBe(true)
    expect(spec.parts.find((p) => p.id === 'ground')!.anchored).toBe(true)
  })

  it('a window adds the sill, which is a partition', () => {
    const spec = buildWallSpecimen({ assembly: 'concrete_block_wall', w: 2.4, h: 2.1, opening: 'window' })
    const sill = spec.parts.find((p) => p.id === 'wall_specimen_sill_0')!
    expect(sill.structure?.role).toBe('partition')
  })

  it('units lay the bricks one by one; coarse is a single part', () => {
    const units = buildWallSpecimen({ assembly: 'brick_wall_plastered', w: 2.4, h: 2.1, detail: 'units' })
    expect(units.parts.length).toBeGreaterThan(200)
    expect(buildWallSpecimen({ assembly: 'brick_wall_plastered', w: 2.4, h: 2.1, detail: 'coarse' }).parts).toHaveLength(2)
    const panels = buildWallSpecimen({ assembly: 'reinforced_concrete', w: 2.4, h: 2.1, detail: 'units' })
    expect(panels.parts.filter((p) => p.id !== 'ground')).toHaveLength(20)
  })

  it('both piers of a door gone: the lintel and the wall above fall, nothing else does', () => {
    const spec = buildWallSpecimen({ assembly: 'brick_wall_plastered', w: 2.4, h: 2.1, opening: 'door' })
    const fallen = breakParts(spec, ['wall_specimen_pier_0', 'wall_specimen_pier_1'], 30)
    expect(fallen.stands('wall_specimen_lintel_0')).toBe(false)
    expect(fallen.stands('wall_specimen_spandrel_0')).toBe(false)
    const one = breakParts(spec, ['wall_specimen_pier_0'], 30)
    expect(one.stands('wall_specimen_lintel_0')).toBe(true)
  })

  it('an unknown assembly is an error that names it', () => {
    expect(() => buildWallSpecimen({ assembly: 'cardboard', w: 1, h: 1 })).toThrow(/cardboard/)
  })

  it('the specimen is a world that settles with nothing broken', () => {
    for (const assembly of ASSEMBLIES) {
      const world = createDestruction({ seed: 1 })
      const id = world.add(buildWallSpecimen({ assembly, w: 2.4, h: 2.1, opening: 'window' }))
      for (let t = 0; t < 10; t += 0.1) world.update(0.1)
      expect(world.state(id)!.parts.filter((p) => p.status === 'broken'), assembly).toEqual([])
    }
  })
})

function buildStructureMass(assembly: string, opening: 'door' | 'window' | null): number {
  return massOf({ parts: buildWallSpecimen({ assembly, w: 2.4, h: 2.1, opening }).parts.filter((p) => p.id !== 'ground') })
}
