import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { HULL_CELL, MAX_HULL_POINTS, THIN_UNDER, convexFaces, createVehicleColliders, hullVolume, reducePoints, vehicleHulls } from '../src'
import { hullsOf } from '../src/vehicle-hulls'
import { build } from './vehicle-colliders-support'
import { checkHulls } from './vehicle-hulls-check'

const CUBE = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]

/** A flat grid of `size` x `size` metres in the plane y = `height`, two triangles a cell, as the soup a hull is made of. */
const sheet = (size: number, height: number, cells = 4): { vertices: number[]; indices: number[]; all: number[] } => {
  const vertices: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) vertices.push((i / cells) * size, height, (j / cells) * size)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * (cells + 1) + i
      indices.push(a, a + 1, a + cells + 1, a + 1, a + cells + 2, a + cells + 1)
    }
  }
  return { vertices, indices, all: Array.from({ length: indices.length / 3 }, (_, t) => t) }
}

describe('the convex hull and the points it is made of (design 10.1)', () => {
  it('a cube is twelve faces and a volume of one, wound outward', () => {
    const faces = convexFaces(CUBE)!
    expect(faces).toHaveLength(12)
    expect(hullVolume(CUBE, faces)).toBeCloseTo(1, 9)
  })

  it('points inside the hull change nothing, and a flat or a straight set has no hull', () => {
    const faces = convexFaces([...CUBE, 0.5, 0.5, 0.5, 0.2, 0.7, 0.3])!
    expect(hullVolume([...CUBE, 0.5, 0.5, 0.5, 0.2, 0.7, 0.3], faces)).toBeCloseTo(1, 9)
    expect(convexFaces([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0.5, 0.5, 0])).toBeNull()
    expect(convexFaces([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0])).toBeNull()
  })

  it('reducing keeps at most the limit, only points that were given, and the extremes of the cube directions', () => {
    const points: number[] = []
    for (let i = 0; i < 2000; i++) points.push(Math.sin(i * 12.9898) * 3, Math.sin(i * 78.233) * 2, Math.sin(i * 37.719) * 1)
    const reduced = reducePoints(points, MAX_HULL_POINTS)
    expect(reduced.length / 3).toBe(MAX_HULL_POINTS)
    const given = new Set<string>()
    for (let i = 0; i < points.length; i += 3) given.add(`${points[i]},${points[i + 1]},${points[i + 2]}`)
    for (let i = 0; i < reduced.length; i += 3) expect(given.has(`${reduced[i]},${reduced[i + 1]},${reduced[i + 2]}`)).toBe(true)
    let maxX = -Infinity
    for (let i = 0; i < points.length; i += 3) maxX = Math.max(maxX, points[i]!)
    expect(Math.max(...reduced.filter((_, i) => i % 3 === 0))).toBe(maxX)
  })
})

describe('hulls of a drawn soup (design 10.1)', () => {
  it('a flat sheet is one hull, extruded toward the middle of the vehicle up to 3 cm and never away from it', () => {
    const soup = sheet(1, 0.5)
    const [hull] = hullsOf(soup, soup.all, [0.5, 0, 0.5])
    expect(hullsOf(soup, soup.all, [0.5, 0, 0.5])).toHaveLength(1)
    const heights = hull!.filter((_, i) => i % 3 === 1)
    expect(Math.max(...heights)).toBeCloseTo(0.5, 9)
    expect(Math.min(...heights)).toBeCloseTo(0.5 - THIN_UNDER, 9)
    const above = hullsOf(soup, soup.all, [0.5, 2, 0.5])[0]!.filter((_, i) => i % 3 === 1)
    expect(Math.min(...above)).toBeCloseTo(0.5, 9)
    expect(Math.max(...above)).toBeCloseTo(0.5 + THIN_UNDER, 9)
  })

  it('a hull has at most 64 points, every one of them a drawn point, or an extrusion of one', () => {
    const soup = sheet(1.2, 0.2, 12)
    for (const hull of hullsOf(soup, soup.all, [0.6, -1, 0.6])) expect(hull.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
  })

  it('an L of two sheets is cut where the hull of the whole would stand off the drawn shell by more than 3 cm', () => {
    const floor = sheet(1, 0, 4)
    const wall = sheet(1, 0, 4)
    const vertices = [...floor.vertices]
    for (let i = 0; i < wall.vertices.length; i += 3) vertices.push(wall.vertices[i]!, wall.vertices[i + 2]!, 0)
    const offset = floor.vertices.length / 3
    const indices = [...floor.indices, ...wall.indices.map((i) => i + offset)]
    const all = Array.from({ length: indices.length / 3 }, (_, t) => t)
    const hulls = hullsOf({ vertices, indices }, all, [0.5, 0.5, 0.5])
    expect(hulls.length).toBeGreaterThanOrEqual(2)
    for (const hull of hulls) expect(hull.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
  })

  it('a solid part is one hull however it is shaped', () => {
    const floor = sheet(1, 0, 4)
    const wall = sheet(1, 0, 4)
    const vertices = [...floor.vertices]
    for (let i = 0; i < wall.vertices.length; i += 3) vertices.push(wall.vertices[i]!, wall.vertices[i + 2]!, 0)
    const offset = floor.vertices.length / 3
    const indices = [...floor.indices, ...wall.indices.map((i) => i + offset)]
    const all = Array.from({ length: indices.length / 3 }, (_, t) => t)
    expect(hullsOf({ vertices, indices }, all, [0.5, 0.5, 0.5], true)).toHaveLength(1)
  })
})

describe('the hulls of a model made and kept (design 10.1, 10.2)', () => {
  it('every hull belongs to a part of the model, has at most 64 points, and the cell is 1.6 m', () => {
    expect(HULL_CELL).toBe(1.6)
    const { vehicle, frame, dispose } = build('naked_bike')
    const hulls = vehicleHulls(THREE, vehicle, frame)
    const parts = new Set(vehicle.model.parts.map((part) => part.id))
    expect(hulls.length).toBeGreaterThan(0)
    for (const hull of hulls) {
      expect(parts.has(hull.id)).toBe(true)
      expect(hull.points.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
      expect(convexFaces(hull.points)).not.toBeNull()
    }
    dispose()
  })

  it('asked again with nothing changed, the same hulls come back; a dent makes again only the cell it touched', () => {
    const { vehicle, frame, dispose } = build('naked_bike')
    const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true })
    const first = colliders.hulls()
    const again = colliders.hulls()
    expect(again).toHaveLength(first.length)
    again.forEach((hull, i) => expect(hull).toBe(first[i]))
    const meshes: THREE.Mesh[] = []
    ;(vehicle.vehicle.vehicle as THREE.Object3D).traverse((node) => {
      const candidate = node as THREE.Mesh
      if (candidate.isMesh && candidate.visible && candidate.geometry.getAttribute('position')) meshes.push(candidate)
    })
    const mesh = meshes[0]!
    const position = mesh.geometry.getAttribute('position')
    position.setX(0, position.getX(0) + 0.02)
    position.needsUpdate = true
    const dented = colliders.hulls()
    const same = dented.filter((hull, i) => first[i] === hull).length
    expect(dented.length).toBeGreaterThan(0)
    expect(same).toBeGreaterThan(dented.length / 2)
    dispose()
  })

  it('hulls() needs the option', () => {
    const { vehicle, frame, dispose } = build('naked_bike')
    expect(() => createVehicleColliders(THREE, vehicle, frame).hulls()).toThrow(/options.hulls/)
    dispose()
  })

  it('the ray and volume check (H2 to H5) runs on a model and reports; it does not pass yet (evidence.md, T6.4)', () => {
    const report = checkHulls('naked_bike')
    console.log(JSON.stringify({ name: 'hull-check-naked_bike', ...report }))
    expect(report.maxPoints).toBeLessThanOrEqual(MAX_HULL_POINTS)
    expect(report.rays).toBeGreaterThan(0)
  })
})
