import { DENSITY } from '@adatechnology/game-floorplan-structure'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { TEMPLATES, THREE, houseOf, planOf } from './helpers/houses'
import { pieceBoxes } from './helpers/piece-boxes'

const LIMITS = { wiring: 3, pipe: 2.5 }
const CASES = Object.keys(TEMPLATES).flatMap((template) => [1, 2].map((seed) => [template, seed] as const))
/** The sleeves and valves at the ends of a pipe stand this far beyond its end (m). */
const SLEEVE = 0.05
/** Overlap with a fixed solid deeper than this (m) is a piece born inside it: the end cap of a slanted pipe cut at a face reaches one pipe radius (at most 1.9 cm) past it. */
const OVERLAP = 0.02

type Piece = { id: string; box: THREE.Box3 }
type Solid = { id: string; box: THREE.Box3 }

const unionOf = (boxes: THREE.Box3[]): THREE.Box3 => boxes.reduce((all, box) => all.union(box), new THREE.Box3())
const isRun = (id: string): boolean => /^(pipe:run_(outlet|under)|wiring:)/.test(id)

/** The wiring and exposed pipe pieces of a house, each with the box it is drawn in. */
function runPieces(house: House): Piece[] {
  return house.structure.parts.filter((part) => isRun(part.id)).flatMap((part) => {
    const boxes = pieceBoxes(house, part.id)
    return boxes.length ? [{ id: part.id, box: unionOf(boxes) }] : []
  })
}

const solidsOf = (house: House): Solid[] =>
  house.structure.parts.filter((part) => ['slab', 'wall', 'partition'].includes(part.role)).map((part) => ({ id: part.id, box: new THREE.Box3(new THREE.Vector3(part.aabb[0], part.y0, part.aabb[1]), new THREE.Vector3(part.aabb[2], part.y1, part.aabb[3])) }))

const overlapDepth = (a: THREE.Box3, b: THREE.Box3): number =>
  Math.min(a.max.x - b.min.x, b.max.x - a.min.x, a.max.y - b.min.y, b.max.y - a.min.y, a.max.z - b.min.z, b.max.z - a.min.z)

const within = (inner: THREE.Box3, outer: THREE.Box3, margin: number): boolean => outer.clone().expandByScalar(margin).containsBox(inner)

describe('the wiring and pipe runs detach in segments', () => {
  it.each(CASES)('%s, seed %i: no segment is longer than the limit', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const tooLong = runPieces(house).filter(({ id, box }) => box.min.distanceTo(box.max) > (id.startsWith('wiring') ? LIMITS.wiring : LIMITS.pipe) + 2 * SLEEVE)
    expect(tooLong.map(({ id }) => id)).toEqual([])
  })

  it.each(CASES)('%s, seed %i: no segment crosses a slab or wall, nor is born inside one it is not held by', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const solids = solidsOf(house)
    const held = new Map(house.structure.supports.map((support) => [support.part, support.on]))
    const crossing: string[] = []
    for (const { id, box } of runPieces(house)) {
      for (const solid of solids) {
        if (overlapDepth(box, solid.box) <= OVERLAP) continue
        const inside = within(box, solid.box, SLEEVE)
        if (!inside) crossing.push(`${id} crosses ${solid.id}`)
        else if (held.get(id) !== solid.id) crossing.push(`${id} lies in ${solid.id} without being held by it`)
      }
    }
    expect(crossing).toEqual([])
  })

  it.each(CASES)('%s, seed %i: every segment that has a holder hangs from a piece that exists, and nothing is held in a loop', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const ids = new Set(house.structure.parts.map((part) => part.id))
    const held = new Map(house.structure.supports.map((support) => [support.part, support.on]))
    const floating: string[] = []
    for (const { id } of runPieces(house)) {
      const seen = new Set<string>()
      for (let at: string | undefined = id; at; at = held.get(at)) {
        if (seen.has(at) || !ids.has(at) && at !== 'ground') { floating.push(`${id} -> ${at}`); break }
        seen.add(at)
      }
    }
    expect(floating).toEqual([])
  })

  it('the tank outlet is cut at the tank slab, and every stretch of it is held', () => {
    const { house } = houseOf(planOf('casaA', 1))
    const stretches = house.structure.parts.filter((part) => part.id.startsWith('pipe:run_outlet'))
    expect(stretches.length).toBeGreaterThan(1)
    const held = new Map(house.structure.supports.map((support) => [support.part, support.on]))
    for (const stretch of stretches) expect(held.has(stretch.id), stretch.id).toBe(true)
    expect(stretches.some((stretch) => held.get(stretch.id) === 'tank_slab')).toBe(true)
  })

  it('a stretch of 1 m detaches from a run when the limit is 1 m (configurable)', () => {
    const { house } = houseOf(planOf('casaA', 1), {}, { segmentLimits: { pipe: 1 } })
    for (const { id, box } of runPieces(house).filter(({ id: piece }) => piece.startsWith('pipe'))) expect(box.min.distanceTo(box.max), id).toBeLessThanOrEqual(1 + 2 * SLEEVE)
  })

  it.each(CASES)('%s, seed %i: the segments of a run weigh what the run weighs', (template, seed) => {
    const { house } = houseOf(planOf(template, seed))
    const utilities = house.r.utilities
    const massOf = (prefix: string): number => house.structure.parts.filter((part) => part.id === prefix || part.id.startsWith(prefix + ':')).reduce((sum, part) => sum + part.mass, 0)
    for (const run of utilities?.plumbing?.visibleRuns ?? []) {
      if (run.exposed === 'wall') continue
      const length = run.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - run.points[index]![0], point[1] - run.points[index]![1], point[2] - run.points[index]![2]), 0)
      expect(massOf(`pipe:${run.id}`), run.id).toBeCloseTo(DENSITY.plastic! * Math.PI * (run.diameter / 2) ** 2 * length * 0.3, 6)
    }
    const entrance = utilities?.electrical?.serviceEntrance
    if (!entrance?.pole) return
    const drop = entrance.drop ?? []
    const dropLength = (from: readonly number[], to: readonly number[], lift = 0): number => Math.hypot(to[0]! - from[0]!, to[2]! - from[2]!, to[1]! + lift - from[1]!)
    const head = drop[0]
    const end = drop[drop.length - 1]
    const grid = 8 * 22 * Math.PI * 0.007 ** 2
    const wires = head && end ? Math.PI * (0.009 ** 2 * (dropLength(head, end) + dropLength(head, end, 0.04)) + 0.008 ** 2 * Math.hypot(head[0]! - (entrance.pole.u - 0.2), head[2]! - (entrance.pole.h - 0.5), head[1]! - entrance.pole.v)) : 0
    expect(massOf('wiring:grid') + massOf('wiring:drop')).toBeCloseTo(DENSITY.copper! * (grid + wires), 4)
  })
})
