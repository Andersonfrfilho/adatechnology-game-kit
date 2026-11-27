import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { FLOATING_AREA, leavesOf, newHullPlan, planDivision, protrusionsOf, unitsOf } from '@adatechnology/game-vehicles'
import type { HullSoup } from '@adatechnology/game-vehicles'

import { createVehicleColliders } from '../src'
import { build } from './vehicle-colliders-support'

/** A quad (two triangles) from four corners, appended to the soup. */
const quad = (soup: { vertices: number[]; indices: number[] }, a: number[], b: number[], c: number[], d: number[]): void => {
  const at = soup.vertices.length / 3
  soup.vertices.push(...a, ...b, ...c, ...d)
  soup.indices.push(at, at + 1, at + 2, at, at + 2, at + 3)
}

/** A roof 1 x 1 m at y = 1 in a grid of cells, made of the same vertices a mesh shares, with a thin rod (4 sides, 3 mm) from its edge up to y = 1.4 and a little to the side. */
const roofWithAntenna = (): HullSoup => {
  const soup = { vertices: [] as number[], indices: [] as number[] }
  const cells = 4
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) quad(soup, [i / cells, 1, j / cells], [(i + 1) / cells, 1, j / cells], [(i + 1) / cells, 1, (j + 1) / cells], [i / cells, 1, (j + 1) / cells])
  const base = soup.vertices.length / 3
  const ring = [[0.5, 1, 0.5], [0.503, 1, 0.5], [0.503, 1, 0.503], [0.5, 1, 0.503]]
  soup.vertices.push(...ring.flat(), ...ring.map(([x, y, z]) => [x! + 0.2, y! + 0.4, z!]).flat())
  for (let k = 0; k < 4; k++) soup.indices.push(base + k, base + (k + 1) % 4, base + 4 + k, base + (k + 1) % 4, base + 4 + (k + 1) % 4, base + 4 + k)
  return soup
}

/** A floor 1 x 1 m with a wall 30 cm high on two opposite sides: a U, whose convex hull fills the mouth. */
const channel = (): HullSoup => {
  const soup = { vertices: [] as number[], indices: [] as number[] }
  const cells = 8
  for (let j = 0; j < cells; j++) {
    quad(soup, [0, 0, j / cells], [1, 0, j / cells], [1, 0, (j + 1) / cells], [0, 0, (j + 1) / cells])
    quad(soup, [0, 0, j / cells], [0, 0.3, j / cells], [0, 0.3, (j + 1) / cells], [0, 0, (j + 1) / cells])
    quad(soup, [1, 0, j / cells], [1, 0.3, j / cells], [1, 0.3, (j + 1) / cells], [1, 0, (j + 1) / cells])
  }
  return soup
}

describe('the thin parts that stick out of a piece (design 10.3, item 1)', () => {
  it('a rod welded to a roof is a protrusion with a soup of its own, and the roof has none other', () => {
    const roof = roofWithAntenna()
    const found = protrusionsOf(roof)
    expect(found).toHaveLength(1)
    expect(Math.max(...found[0]!.soup.vertices.filter((_, i) => i % 3 === 1))).toBeCloseTo(1.4, 9)
    expect(found[0]!.triangles).toHaveLength(8)
  })

  it('the units take off only the protrusions the plan took, the body keeps the key of the piece', () => {
    const roof = roofWithAntenna()
    const id = protrusionsOf(roof)[0]!.id
    expect(unitsOf('roof#1', roof, undefined).map((unit) => unit.key)).toEqual(['roof#1'])
    const units = unitsOf('roof#1', roof, new Set([id]))
    expect(units.map((unit) => unit.key)).toEqual(['roof#1', `roof#1~${id}`])
    expect(Math.max(...units[0]!.soup.vertices.filter((_, i) => i % 3 === 1))).toBeCloseTo(1, 9)
  })

  it('a plain sheet has no protrusion', () => {
    const soup = { vertices: [] as number[], indices: [] as number[] }
    quad(soup, [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1])
    expect(protrusionsOf(soup)).toEqual([])
  })
})

describe('the adaptive division (design 10.3, item 2)', () => {
  it('takes the rod off the roof first and the hull of the roof is flat again', () => {
    const plan = newHullPlan()
    const leaves = planDivision([{ key: 'roof#1', soup: roofWithAntenna() }], plan, 64)
    expect(plan.taken.get('roof#1')?.size).toBe(1)
    expect(leaves.every((leaf) => leaf.floating <= FLOATING_AREA)).toBe(true)
    const body = leaves.find((leaf) => leaf.unit === 'roof#1')!
    expect(Math.max(...body.points!.filter((_, i) => i % 3 === 1))).toBeLessThan(1.1)
  })

  it('cuts a U in the middle of its longest side until no hull floats over the limit, the one that floats most first', () => {
    const plan = newHullPlan()
    const whole = planDivision([{ key: 'floor#1', soup: channel() }], newHullPlan(), 1)
    expect(whole[0]!.floating).toBeGreaterThan(FLOATING_AREA)
    const leaves = planDivision([{ key: 'floor#1', soup: channel() }], plan, 64)
    expect(leaves.length).toBeGreaterThan(1)
    expect(leaves.length).toBeLessThanOrEqual(64)
    const floating = leaves.reduce((sum, leaf) => sum + leaf.floating, 0)
    expect(floating).toBeLessThan(whole[0]!.floating)
    expect(plan.cuts.get('floor#1')).toBeDefined()
  })

  it('stops at the number of hulls the model may have, and gives the same answer twice', () => {
    const run = (): string[] => planDivision([{ key: 'floor#1', soup: channel() }], newHullPlan(), 5).map((leaf) => `${leaf.unit}:${leaf.path}:${leaf.floating.toFixed(6)}`)
    expect(run()).toHaveLength(5)
    expect(run()).toEqual(run())
  })

  it('the cuts of the plan cut a dented piece the same way: same names, the hulls follow the vertices', () => {
    const plan = newHullPlan()
    const soup = channel()
    const leaves = planDivision([{ key: 'floor#1', soup }], plan, 12)
    const dented: HullSoup = { vertices: soup.vertices.map((value, i) => (i === 1 ? value - 0.01 : value)), indices: soup.indices }
    const names = leavesOf('floor#1', dented, plan.cuts.get('floor#1') ?? null).map((leaf) => (leaf.path ? `floor#1:${leaf.path}` : 'floor#1'))
    expect(names).toEqual(leaves.map((leaf) => (leaf.path ? `${leaf.unit}:${leaf.path}` : leaf.unit)))
  })
})

describe('the hulls of a model keep their names when it is dented', () => {
  it('a dent does not change which hulls there are, only the points of the ones it touched', () => {
    const { vehicle, frame, dispose } = build('naked_bike')
    const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true, maxHulls: 64 })
    const first = colliders.hulls()
    expect(first.length).toBeLessThanOrEqual(64)
    const meshes: THREE.Mesh[] = []
    ;(vehicle.vehicle.vehicle as THREE.Object3D).traverse((node) => {
      const candidate = node as THREE.Mesh
      if (candidate.isMesh && candidate.visible && candidate.geometry.getAttribute('position')) meshes.push(candidate)
    })
    const position = meshes[0]!.geometry.getAttribute('position')
    position.setX(0, position.getX(0) + 0.002)
    position.needsUpdate = true
    const after = colliders.hulls()
    const names = (list: readonly { key: string }[]): string[] => list.map((hull) => hull.key).sort()
    expect(names(after)).toEqual(names(first))
    dispose()
  })
})
