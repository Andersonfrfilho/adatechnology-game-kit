import { describe, expect, it } from 'vitest'

import { buildStructure, planWaterTank } from '../src'
import type { PlanStructure, StructuredResult, WaterTank } from '../src'
import { loadsAtRest } from '../src/loads'
import { TOWER_TEMPLATES, engine } from './support'
import { rectangularHouse } from './synthetic-plan'

const SEEDS = Number(process.env.SEEDS) || 12
const TEMPLATES = (engine.listTemplates().map((entry: { id: string }) => entry.id) as string[]).filter((id) => !TOWER_TEMPLATES.includes(id))
const SHARE_TOLERANCE = 0.95
const GROUND_ID = 'ground'

/** The tank full to the brim: a litre of water weighs a kilogram, on top of the shell the part already weighs. */
function fullTankMass(structure: PlanStructure, tank: WaterTank): number {
  return tank.capacity + structure.parts.find((p) => p.id === 'water_tank')!.mass
}

/** Loads at rest with the tank counted as a loaded part, full of water (the structure itself leaves the tank out as a part that carries nothing). */
function loadsWithFullTank(structure: PlanStructure, tank: WaterTank): Map<string, number> {
  const mass = fullTankMass(structure, tank)
  const parts = structure.parts.map((p) => (p.id === 'water_tank' ? { ...p, role: 'slab' as const, mass } : p))
  return loadsAtRest(parts, structure.supports)
}

/** The point loads of the full tank reach beam, pillars and the ground: no tank pillar or sleeper bears on a bare panel, and every beam is carried by non-slab parts. */
function expectTankLoadPath(structure: PlanStructure, tank: WaterTank, where: string): void {
  const roleOf = new Map(structure.parts.map((p) => [p.id, p.role]))
  const supportsOf = (id: string): string[] => structure.supports.filter((s) => s.part === id).map((s) => s.on)
  const columns = structure.parts.filter((p) => p.id.startsWith('tank_column_'))
  const sleepers = structure.parts.filter((p) => p.id.startsWith('tank_sleeper_'))
  const beams = structure.parts.filter((p) => p.id.startsWith('tank_beam_') && !p.id.startsWith('tank_beam_pillar_'))
  const loads = loadsWithFullTank(structure, tank)
  const mass = fullTankMass(structure, tank)
  for (const member of [...columns, ...sleepers]) {
    expect(supportsOf(member.id).filter((on) => roleOf.get(on) === 'slab' && on !== 'tank_slab'), `${where} ${member.id} on a panel`).toEqual([])
  }
  for (const column of columns) {
    expect(supportsOf(column.id).some((on) => on.startsWith('tank_beam_')), `${where} ${column.id} on a beam`).toBe(true)
    expect(loads.get(column.id) ?? 0, `${where} ${column.id} carries a quarter of the full tank`).toBeGreaterThanOrEqual((mass / columns.length) * SHARE_TOLERANCE)
  }
  for (const sleeper of sleepers) expect(loads.get(sleeper.id) ?? 0, `${where} ${sleeper.id}`).toBeGreaterThanOrEqual((mass / sleepers.length) * SHARE_TOLERANCE)
  if (columns.length || sleepers.length) expect(beams.length, `${where} beams`).toBeGreaterThanOrEqual(2)
  for (const beam of beams) {
    const carriers = supportsOf(beam.id).filter((on) => roleOf.get(on) !== 'slab')
    expect(carriers.length, `${where} ${beam.id} is carried by walls, bond beams or pillars`).toBeGreaterThanOrEqual(2)
    expect(loads.get(beam.id) ?? 0, `${where} ${beam.id} carries half of the full tank`).toBeGreaterThanOrEqual((mass / beams.length) * SHARE_TOLERANCE)
    // a partition piece over a doorway carries nothing by the rule: the pillar or bond beam beside it takes that end
    expect(carriers.filter((on) => (loads.get(on) ?? 0) > 0).length, `${where} ${beam.id} has a loaded carrier at each end`).toBeGreaterThanOrEqual(2)
  }
}

/** Follows each part down until the ground. */
function reachesGround(structure: PlanStructure, id: string): boolean {
  const seen = new Set<string>()
  const walk = (current: string): boolean => {
    if (current === GROUND_ID) return true
    if (seen.has(current)) return false
    seen.add(current)
    return structure.supports.filter((s) => s.part === current).some((s) => walk(s.on))
  }
  return walk(id)
}

describe('the water tank bears on beams and pillars down to the ground, never on the middle of a panel', () => {
  for (const template of TEMPLATES) {
    it(`${template}: ${SEEDS} seeds, full tank load path`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const plan = engine.generate(template, { seed, state: 'normal' }) as StructuredResult & { waterTank?: WaterTank | null }
        if (!plan.waterTank) continue
        const where = `${template}#${seed}`
        expectTankLoadPath(plan.structure, plan.waterTank, where)
        expect(reachesGround(plan.structure, 'water_tank'), `${where} the tank reaches the ground`).toBe(true)
      }
    })
  }

  it('a 500 L budget tank weighs about half a tonne full and its four pillars each carry a quarter', () => {
    const source = { ...rectangularHouse({ width: 12, depth: 10 }), lot: {}, w: 12, d: 10 }
    const tank = { ...planWaterTank(source, () => 0.5)!, capacity: 500 }
    const structure = buildStructure({ ...source, waterTank: tank })
    expect(tank.place).toBe('raised_slab')
    expect(fullTankMass(structure, tank)).toBeGreaterThan(500)
    expect(fullTankMass(structure, tank)).toBeLessThan(700)
    expectTankLoadPath(structure, tank, 'budget')
  })

  it('with no bearing wall across a support line the beams get pillars of their own, down to the ground', () => {
    const base = { ...rectangularHouse({ width: 12, depth: 10 }), lot: {}, w: 12, d: 10 }
    // an open plan: no wall west of the tank and none north of it
    const source = { ...base, walls: base.walls.filter((w) => !(w.axis === 'v' && w.u0 === 0) && !(w.axis === 'u' && w.v0 === 0)) }
    const tank = planWaterTank(source, () => 0.5)!
    expect(tank.place).toBe('raised_slab')
    const structure = buildStructure({ ...source, waterTank: tank })
    const pillars = structure.parts.filter((p) => p.id.startsWith('tank_beam_pillar_'))
    expect(pillars).toHaveLength(4)
    for (const pillar of pillars) expect(structure.supports.some((s) => s.part === pillar.id && s.on === GROUND_ID), pillar.id).toBe(true)
    expectTankLoadPath(structure, tank, 'open plan')
  })
})
