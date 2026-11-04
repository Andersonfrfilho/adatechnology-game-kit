import { registerAssembly } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { STRUCTURAL_VIOLATION, buildSkyscraper, buildStructure, buildTower, buildWallSpecimen, masonryConstruction, validateSpec, validateStructure } from '../src'
import type { SourceWindow, Structure, StructurePart, StructureSource } from '../src'
import { rectangularHouse } from './synthetic-plan'

const codesOf = (structure: Structure, options: Parameters<typeof validateStructure>[1] = {}): string[] => [...new Set(validateStructure(structure, options).map((v) => v.code))].sort()
const withWindow = (plan: StructureSource): StructureSource => ({ ...plan, windows: [{ id: 'win', floor: 0, axis: 'u', pos: 0, at: 5, width: 1.2, y0: 1, y1: 2 } as SourceWindow] })
const without = (structure: Structure, drop: (part: StructurePart) => boolean): Structure => {
  const gone = new Set(structure.parts.filter(drop).map((p) => p.id))
  return { ...structure, parts: structure.parts.filter((p) => !gone.has(p.id)), supports: structure.supports.filter((s) => !gone.has(s.part) && !gone.has(s.on)) }
}
const changed = (structure: Structure, id: string, change: Partial<StructurePart>): Structure => ({ ...structure, parts: structure.parts.map((p) => (p.id === id ? { ...p, ...change } : p)) })

/** A free-standing garden wall of 10 x 3 m, as `wallPiece` of game-floorplan-three builds it. */
function gardenWall(options: Parameters<typeof buildStructure>[1] = {}): Structure {
  const wall = { floor: 0, axis: 'u' as const, u0: -5, v0: 0, u1: 5, v1: 0, thickness: 0.15, sides: ['outside', 'outside'], exterior: true, type: 'wall', h: 3 }
  const source = { floors: [{ y0: 0, ceiling: 3 }], rooms: [], walls: [wall], doors: [], windows: [], items: [], facade: { finish: 'plaster', roof: 'colonial', floors: 1 }, w: 10, d: 0.15 } as unknown as StructureSource
  return buildStructure(source, { wallDetail: 'coarse', construction: masonryConstruction(source), roof: false, ...options })
}

describe('structural validator: what a structural engineer signs', () => {
  it('passes a masonry house with a window, a garden wall and a wall specimen', () => {
    expect(validateStructure(buildStructure(withWindow(rectangularHouse({ width: 10, depth: 6 }))))).toEqual([])
    expect(validateStructure(buildStructure(rectangularHouse({ width: 12, depth: 8, floors: 2 })))).toEqual([])
    expect(validateStructure(gardenWall(), { wallDetail: 'coarse' })).toEqual([])
    expect(validateSpec(buildWallSpecimen({ assembly: 'brick_wall_plastered', w: 2.4, h: 2.1, opening: 'window' }))).toEqual([])
  })

  it('passes the towers and skyscrapers built as specs', () => {
    expect(validateSpec(buildTower())).toEqual([])
    expect(validateSpec(buildSkyscraper({ storeys: 12 }))).toEqual([])
  })

  it('finds a ground-floor wall on the soil without a ground beam', () => {
    const structure = buildStructure(rectangularHouse(), { groundBeams: false })
    expect(validateStructure(structure).filter((v) => v.code === STRUCTURAL_VIOLATION.MISSING_GROUND_BEAM)).toHaveLength(4)
  })

  it('finds walls without their pillars: span, free end, corner', () => {
    expect(codesOf(buildStructure(rectangularHouse({ width: 12 }), { wallPillars: false }))).toContain(STRUCTURAL_VIOLATION.WALL_SPAN_WITHOUT_PILLAR)
    // and its 10 m bond beam then rests on the bricks alone
    expect(codesOf(gardenWall({ wallPillars: false }), { wallDetail: 'coarse' })).toEqual([STRUCTURAL_VIOLATION.BEAM_ON_WEAK_MASONRY, STRUCTURAL_VIOLATION.WALL_END_WITHOUT_PILLAR, STRUCTURAL_VIOLATION.WALL_SPAN_WITHOUT_PILLAR])
    const corner = buildStructure(rectangularHouse())
    expect(codesOf(without(corner, (p) => p.id === 'column_0_0'))).toEqual([STRUCTURAL_VIOLATION.CORNER_WITHOUT_PILLAR])
  })

  it('finds a pillar that stops under the bond beam, one off the ground, a floating part and a wall without bond beam', () => {
    const house = buildStructure(rectangularHouse())
    const pillar = house.parts.find((p) => p.id.startsWith('wall_column_'))!
    expect(codesOf(changed(house, pillar.id, { y1: pillar.y1 - 0.5 }))).toEqual([STRUCTURAL_VIOLATION.PILLAR_DOES_NOT_REACH_BOND_BEAM])
    expect(codesOf(changed(house, pillar.id, { y0: 0.4 }))).toEqual([STRUCTURAL_VIOLATION.PILLAR_NOT_GROUNDED])
    const floating = { ...house, supports: house.supports.filter((s) => s.part !== 'wall_0_0') }
    expect(codesOf(floating)).toContain(STRUCTURAL_VIOLATION.FLOATING_PART)
    expect(codesOf(without(gardenWall(), (p) => p.beamKind === 'bond_beam'), { wallDetail: 'coarse' })).toEqual([STRUCTURAL_VIOLATION.MISSING_BOND_BEAM])
  })

  it('finds a window without lintel and sill beam, and a door without lintel', () => {
    expect(codesOf(buildStructure(withWindow(rectangularHouse({ width: 10, depth: 6 })), { wallDetail: 'coarse' }), { wallDetail: 'coarse' })).toEqual([
      STRUCTURAL_VIOLATION.OPENING_WITHOUT_LINTEL, STRUCTURAL_VIOLATION.OPENING_WITHOUT_SILL,
    ])
    const plan = rectangularHouse({ width: 10, depth: 6 })
    plan.walls = plan.walls.flatMap((w) => (w.axis === 'u' && w.v0 === 0 ? [{ ...w, u1: 4.5 }, { ...w, u0: 5.5 }] : [w]))
    plan.doors = [{ id: 'front', floor: 0, a: 'living', b: 'outside', exterior: true, u: 5, v: 0, width: 1, axis: 'u' }]
    expect(validateStructure(buildStructure(plan), { doors: plan.doors })).toEqual([])
    expect(codesOf(buildStructure(plan, { wallDetail: 'coarse' }), { doors: plan.doors, wallDetail: 'coarse' })).toEqual([STRUCTURAL_VIOLATION.OPENING_WITHOUT_LINTEL])
  })

  it('finds concrete below the NBR 6118 section, without steel, and a long beam on masonry alone', () => {
    const house = buildStructure(rectangularHouse())
    const pillar = house.parts.find((p) => p.id.startsWith('wall_column_'))!
    const [u, v] = [(pillar.aabb[0] + pillar.aabb[2]) / 2, (pillar.aabb[1] + pillar.aabb[3]) / 2]
    expect(codesOf(changed(house, pillar.id, { aabb: [u - 0.06, v - 0.06, u + 0.06, v + 0.06] }))).toEqual([STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION])
    expect(codesOf({ ...house, construction: { ...house.construction, frame: { ...house.construction.frame, rebar: null } } })).toEqual([STRUCTURAL_VIOLATION.UNREINFORCED_CONCRETE])
    const beam: StructurePart = { id: 'long_beam', role: 'beam', material: 'concrete', aabb: [0.5, -0.07, 5.5, 0.08], y0: 2.4, y1: 2.8, floor: 0, mass: 700 }
    const onBricks = { ...house, parts: [...house.parts, beam], supports: [...house.supports, { part: 'long_beam', on: 'wall_0_0', joint: 'mortar' as const }] }
    expect(codesOf(onBricks)).toContain(STRUCTURAL_VIOLATION.BEAM_ON_WEAK_MASONRY)
  })

  it('finds bricks in stack bond and a brick wall without plaster', () => {
    registerAssembly({ id: 'test_stacked_bare_brick', name: 'stacked bare brick', core: { material: 'brick', thickness: 0.11 }, units: { size: [0.23, 0.075, 0.11], bond: 'stack', mortar: 'plaster' } })
    const construction = masonryConstruction(rectangularHouse())
    const house = buildStructure(rectangularHouse(), { construction: { ...construction, walls: { ...construction.walls, assembly: 'test_stacked_bare_brick' } } })
    expect(codesOf(house)).toEqual([STRUCTURAL_VIOLATION.MISSING_PLASTER, STRUCTURAL_VIOLATION.UNBONDED_MASONRY])
  })

  it('finds a floating part and a pillar off the ground in a spec', () => {
    const spec = buildWallSpecimen({ assembly: 'brick_wall_plastered', w: 2.4, h: 2.1 })
    const lifted = { ...spec, parts: [...spec.parts, { id: 'loose_column', material: 'concrete', shape: { kind: 'box' as const, size: [0.12, 2, 0.12] as [number, number, number] }, position: [3, 1, 0] as [number, number, number], structure: { role: 'column' as const } }] }
    expect(validateSpec(lifted).map((v) => v.code).sort()).toEqual([STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, STRUCTURAL_VIOLATION.PILLAR_NOT_GROUNDED])
  })
})
