import { describe, expect, it } from 'vitest'

import { WALL_PILLAR_SIDE, WALL_PILLAR_SPACING, buildStructure, masonryConstruction, pillarStations, toDestructibleSpec } from '../src'
import type { StructurePart } from '../src'
import { rectangularHouse } from './synthetic-plan'
import { breakParts } from './world-helpers'

const centre = (part: StructurePart): [number, number] => [(part.aabb[0] + part.aabb[2]) / 2, (part.aabb[1] + part.aabb[3]) / 2]
const wallPillars = (parts: readonly StructurePart[]): StructurePart[] => parts.filter((p) => p.id.startsWith('wall_column_'))

describe('pillars along the masonry walls', () => {
  it('stands one at each end of a stretch, flush with it, and as many between as keep every span within the spacing', () => {
    expect(pillarStations(-5, 5, [], WALL_PILLAR_SPACING).map((at) => Math.round(at * 100) / 100)).toEqual([-4.9, -1.63, 1.63, 4.9])
    const stations = pillarStations(0, 12, [], WALL_PILLAR_SPACING)
    for (let k = 1; k < stations.length; k++) expect(stations[k]! - stations[k - 1]!).toBeLessThanOrEqual(WALL_PILLAR_SPACING + 1e-9)
    // a wall meeting it in a T gets its pillar there
    expect(pillarStations(0, 6, [2.5], WALL_PILLAR_SPACING)).toEqual([0.1, 2.5, 5.9])
    // a short pier keeps a pillar at each end (a door jamb beside a corner); one too short for two has one in its middle, one shorter than a pillar none
    expect(pillarStations(0, 0.5, [], WALL_PILLAR_SPACING).map((at) => Math.round(at * 100) / 100)).toEqual([0.1, 0.4])
    expect(pillarStations(0, 0.3, [], WALL_PILLAR_SPACING)).toEqual([0.15])
    expect(pillarStations(0, WALL_PILLAR_SIDE / 2, [], WALL_PILLAR_SPACING)).toEqual([])
  })

  it('puts pillars beside the windows and between the corners of a house, none inside a window', () => {
    const plan = rectangularHouse({ width: 10, depth: 6 })
    plan.windows = [{ id: 'win', floor: 0, axis: 'u', pos: 0, at: 5, width: 1.2, y0: 1, y1: 2.2 } as never]
    const structure = buildStructure(plan)
    const front = wallPillars(structure.parts).filter((p) => Math.abs(centre(p)[1]) < 0.01).map((p) => Math.round(centre(p)[0] * 100) / 100)
    // the window spans 4.4 to 5.6: a pillar right beside each jamb, and between the jambs and the corners (at 0 and 10) no span over 4 m
    expect(front).toContain(4.3)
    expect(front).toContain(5.7)
    expect(front.some((u) => u > 4.4 && u < 5.6)).toBe(false)
    const line = [0, ...front.sort((a, b) => a - b), 10]
    for (let k = 1; k < line.length; k++) expect(line[k]! - line[k - 1]!).toBeLessThanOrEqual(WALL_PILLAR_SPACING + 0.01)
    // each is 0.2 x 0.2 m of the frame's concrete, from the ground to the bond beam, which rests on it
    for (const pillar of wallPillars(structure.parts)) {
      expect(pillar.material).toBe('concrete')
      expect(pillar.aabb[2] - pillar.aabb[0]).toBeCloseTo(WALL_PILLAR_SIDE)
      expect(structure.supports.some((s) => s.part === pillar.id && s.on === 'ground' && s.joint === 'rebar')).toBe(true)
      expect(structure.supports.some((s) => s.on === pillar.id && s.part.startsWith('plate_'))).toBe(true)
    }
  })

  it('can be left out: only the corner pillars, as the Visor de casas 3D builds them', () => {
    expect(wallPillars(buildStructure(rectangularHouse({ width: 10 }), { wallPillars: false }).parts)).toEqual([])
    expect(wallPillars(buildStructure(rectangularHouse({ width: 10 }), { wallPillars: { spacing: 2 } }).parts).length).toBeGreaterThan(wallPillars(buildStructure(rectangularHouse({ width: 10 })).parts).length)
  })

  it('holds the bond beam of a free-standing wall up when the bricks under it break (with the corner pillars alone it falls)', () => {
    const wall = { floor: 0, axis: 'u' as const, u0: -5, v0: 0, u1: 5, v1: 0, thickness: 0.15, sides: ['outside', 'outside'] as [string, string], exterior: true, type: 'wall', h: 3 }
    const source = { floors: [{ y0: 0, ceiling: 3 }], rooms: [], walls: [wall], doors: [], windows: [], items: [], facade: { finish: 'plaster', roof: 'colonial', floors: 1 }, w: 10, d: 0.15 }
    const construction = masonryConstruction(source as never)
    const fall = (pillars: boolean) => {
      const structure = buildStructure(source as never, { wallDetail: 'coarse', construction, roof: false, wallPillars: pillars })
      return breakParts(toDestructibleSpec(structure, { wallDetail: 'coarse', sized: false }), ['wall_0_0'])
    }
    expect(fall(true).stands('wall_0_0')).toBe(false)
    expect(fall(true).stands('plate_0_0')).toBe(true)
    expect(fall(false).stands('plate_0_0')).toBe(false)
  })
})
